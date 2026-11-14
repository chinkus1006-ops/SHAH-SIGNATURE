import { initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';

// Initialize Firebase Admin SDK when credentials exist in environment
let adminApp: App | null = null;
let isRealAdminSdkReady = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    adminApp = initializeApp(
      {
        credential: cert(serviceAccount),
      },
      'shah-signature-admin'
    );
    isRealAdminSdkReady = true;
    console.log('[FirebaseAdmin] Initialized with FIREBASE_SERVICE_ACCOUNT');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminApp = initializeApp(
      {
        credential: applicationDefault(),
      },
      'shah-signature-admin'
    );
    isRealAdminSdkReady = true;
    console.log('[FirebaseAdmin] Initialized with Application Default Credentials');
  } else {
    console.warn('[FirebaseAdmin] Notice: No FIREBASE_SERVICE_ACCOUNT detected. Running local cryptographic session vault (external SMS/Firebase Admin SDK requires configuration).');
  }
} catch (err: any) {
  console.warn('[FirebaseAdmin] Init note:', err.message);
}

// External Notification / Carrier Gateway readiness flags (never fake configured state)
export const gatewayStatus = {
  firebaseAdminSdkReady: isRealAdminSdkReady,
  smsGatewayConfigured: Boolean(process.env.MSG91_AUTH_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)),
  whatsappCloudApiConfigured: Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  emailGatewayConfigured: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY),
};

// Server-side HMAC secret for verification proof tokens (ephemeral fallback if env unset)
const SESSION_HMAC_SECRET = process.env.ADMIN_SECRET_KEY || crypto.randomBytes(32).toString('hex');

interface OtpRecord {
  phone: string;
  hashedOtp: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  role: 'CUSTOMER' | 'SERVICE_PARTNER';
  carrierVerified: boolean;
  createdAt: number;
}

interface RateLimitTracker {
  requestTimestamps: number[];
  lastRequestTime: number;
}

const otpStore = new Map<string, OtpRecord>();
const rateLimitStore = new Map<string, RateLimitTracker>();
const verifiedPhoneProofs = new Map<
  string,
  { phone: string; carrierVerified: boolean; verifiedAt: number; expiresAt: number }
>();

const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const INDIAN_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export function sanitizeIndianPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return rawPhone.trim();
}

export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, '');
  return INDIAN_PHONE_REGEX.test(cleaned);
}

export function isValidIndianPincode(pincode: string): boolean {
  return INDIAN_PINCODE_REGEX.test(pincode.trim());
}

function hashOtpWithSalt(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(otp + salt).digest('hex');
}

export function issuePhoneVerificationProof(phone: string, carrierVerified = true): string {
  const cleanPhone = sanitizeIndianPhone(phone);
  const now = Date.now();
  const payload = `${cleanPhone}.${now}.${carrierVerified ? '1' : '0'}`;
  const sig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(payload).digest('hex');
  const token = `${Buffer.from(payload).toString('base64url')}.${sig}`;
  verifiedPhoneProofs.set(token, {
    phone: cleanPhone,
    carrierVerified,
    verifiedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });
  return token;
}

export function verifyPhoneProofDetails(
  token: string | undefined,
  expectedPhone: string
): { valid: boolean; carrierVerified: boolean } {
  if (!token) return { valid: false, carrierVerified: false };
  const cleanPhone = sanitizeIndianPhone(expectedPhone);
  const stored = verifiedPhoneProofs.get(token);
  if (stored) {
    if (stored.expiresAt < Date.now()) {
      verifiedPhoneProofs.delete(token);
      return { valid: false, carrierVerified: false };
    }
    return {
      valid: stored.phone === cleanPhone,
      carrierVerified: stored.phone === cleanPhone && stored.carrierVerified,
    };
  }

  // Verify HMAC signature in case proof was issued prior to store lookup
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, carrierVerified: false };
  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(payload).digest('hex');
    if (parts[1] !== expectedSig) return { valid: false, carrierVerified: false };
    const [phonePart, tsPart, carrierFlag] = payload.split('.');
    const issuedAt = Number(tsPart);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 24 * 60 * 60 * 1000) {
      return { valid: false, carrierVerified: false };
    }
    const valid = phonePart === cleanPhone;
    return {
      valid,
      carrierVerified: valid && carrierFlag !== '0',
    };
  } catch {
    return { valid: false, carrierVerified: false };
  }
}

export function verifyPhoneProofToken(token: string | undefined, expectedPhone: string): boolean {
  return verifyPhoneProofDetails(token, expectedPhone).valid;
}

/**
 * Send Phone OTP with rate-limiting & 60s cooldown.
 * Dispatches real SMS via MSG91/Twilio when configured; otherwise issues a server-signed in-app challenge
 * so OTP verification works reliably without returning a 503 server error.
 */
export async function sendPhoneOtp(
  rawPhone: string,
  role: 'CUSTOMER' | 'SERVICE_PARTNER'
): Promise<{
  success: boolean;
  verificationId?: string;
  cooldownSeconds?: number;
  smsDispatched?: boolean;
  deliveryMode?: 'sms_carrier' | 'in_app_challenge';
  verificationPreviewCode?: string;
  requiresClientFirebaseAuth?: boolean;
  message: string;
}> {
  const phone = sanitizeIndianPhone(rawPhone);

  if (!isValidIndianPhone(phone)) {
    return {
      success: false,
      message: 'Invalid Indian mobile number. Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.',
    };
  }

  const now = Date.now();
  const tracker = rateLimitStore.get(phone) || { requestTimestamps: [], lastRequestTime: 0 };

  const timeSinceLast = (now - tracker.lastRequestTime) / 1000;
  if (timeSinceLast < 60) {
    const remaining = Math.ceil(60 - timeSinceLast);
    return {
      success: false,
      cooldownSeconds: remaining,
      message: `Please wait ${remaining} seconds before requesting a new OTP.`,
    };
  }

  tracker.requestTimestamps = tracker.requestTimestamps.filter(t => now - t < 15 * 60 * 1000);
  if (tracker.requestTimestamps.length >= 4) {
    return {
      success: false,
      message: 'Rate limit reached. Maximum 4 OTP requests permitted per 15 minutes.',
    };
  }

  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const verificationId = `v_${crypto.randomBytes(12).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedOtp = hashOtpWithSalt(rawOtp, salt);
  const hasRealCarrier = gatewayStatus.smsGatewayConfigured;

  otpStore.set(verificationId, {
    phone,
    hashedOtp,
    salt,
    expiresAt: now + 10 * 60 * 1000,
    attempts: 0,
    role,
    carrierVerified: hasRealCarrier,
    createdAt: now,
  });

  tracker.lastRequestTime = now;
  tracker.requestTimestamps.push(now);
  rateLimitStore.set(phone, tracker);

  if (otpStore.size > 200) {
    for (const [id, rec] of otpStore.entries()) {
      if (rec.expiresAt < now) otpStore.delete(id);
    }
  }

  // Dispatch via configured carrier (MSG91 or Twilio)
  if (process.env.MSG91_AUTH_KEY) {
    try {
      const msgResp = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID || '',
          mobile: phone.replace('+', ''),
          otp: rawOtp,
        }),
      });
      if (!msgResp.ok) {
        throw new Error(`MSG91 HTTP ${msgResp.status}`);
      }
      return {
        success: true,
        verificationId,
        cooldownSeconds: 60,
        smsDispatched: true,
        deliveryMode: 'sms_carrier',
        message: `A 6-digit verification code has been dispatched via SMS to ${phone}. Valid for 10 minutes.`,
      };
    } catch (err: any) {
      otpStore.delete(verificationId);
      return {
        success: false,
        smsDispatched: false,
        message: `SMS gateway delivery failed: ${err.message}`,
      };
    }
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const basicAuth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64');
      const formBody = new URLSearchParams({
        To: phone,
        From: process.env.TWILIO_FROM_NUMBER,
        Body: `Your SHAH SIGNATURE verification code is ${rawOtp}. Valid for 10 minutes.`,
      });
      const twResp = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });
      if (!twResp.ok) {
        throw new Error(`Twilio HTTP ${twResp.status}`);
      }
      return {
        success: true,
        verificationId,
        cooldownSeconds: 60,
        smsDispatched: true,
        deliveryMode: 'sms_carrier',
        message: `A 6-digit verification code has been dispatched via SMS to ${phone}. Valid for 10 minutes.`,
      };
    } catch (err: any) {
      otpStore.delete(verificationId);
      return {
        success: false,
        smsDispatched: false,
        message: `Twilio SMS delivery failed: ${err.message}`,
      };
    }
  }

  // No external telecom SMS gateway configured yet: return server-signed in-app challenge cleanly (HTTP 200)
  return {
    success: true,
    verificationId,
    cooldownSeconds: 60,
    smsDispatched: false,
    deliveryMode: 'in_app_challenge',
    verificationPreviewCode: rawOtp,
    message: `SMS carrier gateway is in in-app verification mode. Enter code ${rawOtp} below to confirm.`,
  };
}

/**
 * Verify Phone OTP
 */
export async function verifyPhoneOtp(
  verificationId: string,
  userEnteredOtp: string,
  targetPhone: string
): Promise<{
  success: boolean;
  phone?: string;
  proofToken?: string;
  carrierVerified?: boolean;
  customToken?: string;
  message: string;
}> {
  const now = Date.now();
  const record = otpStore.get(verificationId);

  if (!record) {
    return {
      success: false,
      message: 'Invalid or expired OTP session. Please request a new verification code.',
    };
  }

  const phone = sanitizeIndianPhone(targetPhone);
  if (record.phone !== phone) {
    return {
      success: false,
      message: 'Mobile number mismatch. Verification failed.',
    };
  }

  if (record.expiresAt < now) {
    otpStore.delete(verificationId);
    return {
      success: false,
      message: 'OTP has expired. Verification codes are valid for 10 minutes.',
    };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpStore.delete(verificationId);
    return {
      success: false,
      message: 'Maximum verification attempts exceeded (5/5). Please request a fresh OTP.',
    };
  }

  const computedHash = hashOtpWithSalt(userEnteredOtp.trim(), record.salt);
  if (computedHash !== record.hashedOtp) {
    const remaining = 5 - record.attempts;
    return {
      success: false,
      message: `Incorrect OTP code. ${remaining} attempt(s) remaining.`,
    };
  }

  otpStore.delete(verificationId);
  const proofToken = issuePhoneVerificationProof(record.phone, record.carrierVerified);

  let customToken: string | undefined;
  if (isRealAdminSdkReady && adminApp) {
    try {
      const uid = `shah_${record.role.toLowerCase()}_${record.phone.replace(/\D/g, '')}`;
      customToken = await getAuth(adminApp).createCustomToken(uid, {
        role: record.role,
        phoneVerified: record.carrierVerified,
      });
    } catch (e: any) {
      console.warn('[FirebaseAdmin] Custom token generation note:', e.message);
    }
  }

  return {
    success: true,
    phone: record.phone,
    proofToken,
    carrierVerified: record.carrierVerified,
    customToken,
    message: record.carrierVerified
      ? 'Mobile number verified via SMS carrier.'
      : 'Verification challenge confirmed for account registration.',
  };
}

const FIREBASE_PROJECT_ID = 'gen-lang-client-0123011776';
let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function fetchGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google Firebase public keys (${resp.status})`);
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  cachedGoogleCerts = { certs, expiresAt: now + ttlMs };
  return certs;
}

/**
 * Cryptographically hash a user password using Node crypto.scryptSync with random 16-byte salt.
 * Never persisted in Firestore or returned to client responses.
 */
export function hashPasswordScrypt(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPasswordScrypt(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Verify Firebase Client ID Token (from Firebase Auth Google Sign-In or Phone Auth).
 * Uses Firebase Admin SDK when configured, or verifies RS256 JWT signature against Google's official X.509 certs.
 */
export async function verifyFirebaseClientToken(idToken: string): Promise<{
  valid: boolean;
  uid?: string;
  phoneNumber?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}> {
  if (!idToken || typeof idToken !== 'string') return { valid: false };

  if (isRealAdminSdkReady && adminApp) {
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(idToken);
      return {
        valid: true,
        uid: decoded.uid,
        phoneNumber: decoded.phone_number,
        email: decoded.email,
        emailVerified: decoded.email_verified,
        name: decoded.name,
      };
    } catch {
      return { valid: false };
    }
  }

  // Cryptographic RS256 signature verification via Google securetoken public certs
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return { valid: false };
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { valid: false };
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== FIREBASE_PROJECT_ID) return { valid: false };
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return { valid: false };
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return { valid: false };
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return { valid: false };
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return { valid: false };

    const certs = await fetchGoogleSecureTokenCerts();
    const pemCert = certs[header.kid];
    if (!pemCert) return { valid: false };

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuf = Buffer.from(sigB64, 'base64url');
    const isSigValid = verifier.verify(pemCert, sigBuf);
    if (!isSigValid) return { valid: false };

    return {
      valid: true,
      uid: payload.sub,
      phoneNumber: payload.phone_number,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name,
    };
  } catch {
    return { valid: false };
  }
}

export async function setUserRoleClaims(
  uid: string,
  role: 'SUPER_ADMIN' | 'CUSTOMER' | 'SERVICE_PARTNER',
  additionalClaims: Record<string, any> = {}
): Promise<{ success: boolean; message: string }> {
  if (!isRealAdminSdkReady || !adminApp) {
    return {
      success: false,
      message: 'Firebase Admin SDK service account not configured; cannot mint Firebase Custom Claims.',
    };
  }

  try {
    await getAuth(adminApp).setCustomUserClaims(uid, {
      role,
      ...additionalClaims,
    });
    return {
      success: true,
      message: `Custom claim '${role}' set on user ${uid}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to set claims: ${err.message}`,
    };
  }
}

export interface BookingValidationInput {
  customerId: string;
  customerPhone: string;
  phoneProofToken?: string;
  firebaseVerifiedPhone?: boolean;
  pincode: string;
  itemCount: number;
  totalEstimatedAmount: number;
  serviceType?: string;
  activePincodes?: string[];
  minOrderAmount?: number;
  eligiblePartnersCount?: number;
}

/**
 * Server-Side Booking Protection:
 * Dynamic Pan-India PIN validation + eligible partner availability check + phone format & session validation.
 */
export function validateBookingEligibility(bookingData: BookingValidationInput): {
  eligible: boolean;
  reason?: string;
} {
  if (!bookingData.customerId || bookingData.customerId.trim() === '') {
    return { eligible: false, reason: 'Customer authentication required before booking.' };
  }

  if (!bookingData.customerPhone || !isValidIndianPhone(bookingData.customerPhone)) {
    return { eligible: false, reason: 'Valid Indian mobile number (+91) required for valet dispatch.' };
  }

  // Check if cryptographic proof or Firebase phone verification exists when SMS gateway is active
  if (gatewayStatus.smsGatewayConfigured) {
    const hasProof =
      Boolean(bookingData.firebaseVerifiedPhone) ||
      verifyPhoneProofToken(bookingData.phoneProofToken, bookingData.customerPhone);
    if (!hasProof) {
      return {
        eligible: false,
        reason: 'Phone verification proof missing or expired. Please verify your mobile number via OTP.',
      };
    }
  }

  const cleanPin = bookingData.pincode.trim();
  if (!isValidIndianPincode(cleanPin)) {
    return {
      eligible: false,
      reason: `Invalid Indian PIN code "${cleanPin}". Please enter a valid 6-digit PIN code.`,
    };
  }

  if (bookingData.activePincodes && bookingData.activePincodes.length > 0) {
    if (!bookingData.activePincodes.includes(cleanPin)) {
      return {
        eligible: false,
        reason: `Doorstep service is not yet active in PIN ${cleanPin}. We are expanding city-by-city across India.`,
      };
    }
  }

  if (typeof bookingData.eligiblePartnersCount === 'number' && bookingData.eligiblePartnersCount <= 0) {
    return {
      eligible: false,
      reason: `No KYC-approved online partners are currently available for this service in PIN ${cleanPin}.`,
    };
  }

  if (bookingData.itemCount <= 0) {
    return { eligible: false, reason: 'Minimum 1 garment or laundry service item required.' };
  }

  if (
    typeof bookingData.minOrderAmount === 'number' &&
    bookingData.totalEstimatedAmount < bookingData.minOrderAmount
  ) {
    return {
      eligible: false,
      reason: `Minimum order value for PIN ${cleanPin} is ₹${bookingData.minOrderAmount}.`,
    };
  }

  return { eligible: true };
}

export { adminApp, isRealAdminSdkReady };
