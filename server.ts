import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  validateBookingEligibility,
  sanitizeIndianPhone,
  isRealAdminSdkReady,
  gatewayStatus,
  verifyFirebaseClientToken,
  hashPasswordScrypt,
  verifyPasswordScrypt,
} from './src/lib/firebaseAdmin';
import {
  INITIAL_GARMENTS,
  INITIAL_SERVICE_AREAS,
  INITIAL_PARTNERS,
  INITIAL_SETTINGS,
  INITIAL_BUSINESS_SETTINGS,
  INITIAL_LEGAL_POLICIES,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_COMMISSION_LEDGER,
  INITIAL_SERVICE_CATEGORIES,
  INITIAL_SUBSCRIPTION_PLANS,
  INITIAL_FAQS,
  INITIAL_REVIEWS,
} from './src/data/initialData';
import type {
  AppRole,
  Partner,
  CustomerUser,
  GarmentItem,
  ServiceAreaConfig,
  CouponOffer,
  PlatformSettings,
  BusinessSettings,
  LegalPolicies,
  Order,
  GarmentEvidence,
  OrderDispute,
  CompensationRecord,
  CanonicalDisputeStatus,
  DisputeAuditEntry,
  DisputeQuestion,
  CommissionLedgerEntry,
  CommissionRemittance,
} from './src/types';
import { normalizeDisputeStatus, normalizeOrderStatus } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Bootstrapped authorized Super Admin identities (cannot be registered via public APIs)
const TRUSTED_ADMIN_EMAILS = new Set(['shahsignature@gmail.com', 'chinku.s1006@gmail.com']);

// In-memory runtime state initialized cleanly from initial catalog & operational defaults
let serverCatalog: GarmentItem[] = [...INITIAL_GARMENTS];
let serverServiceCategories = [...INITIAL_SERVICE_CATEGORIES];
let serverServiceAreas: ServiceAreaConfig[] = [...INITIAL_SERVICE_AREAS];
let serverPartners: Partner[] = INITIAL_PARTNERS.map(p => ({ ...p }));
let serverCustomers: CustomerUser[] = INITIAL_CUSTOMERS.map(c => ({ ...c }));
let serverSettings: PlatformSettings = { ...INITIAL_SETTINGS };
let serverBusinessSettings: BusinessSettings = { ...INITIAL_BUSINESS_SETTINGS };
let serverLegalPolicies: LegalPolicies = { ...INITIAL_LEGAL_POLICIES };
let serverCoupons: CouponOffer[] = [...INITIAL_COUPONS];
let serverOrders: Order[] = INITIAL_ORDERS.map(o => ({ ...o }));
let serverCommissionLedger: CommissionLedgerEntry[] = [...INITIAL_COMMISSION_LEDGER];
const serverRemittances: CommissionRemittance[] = [];
const serverSubscriptionPlans = [...INITIAL_SUBSCRIPTION_PLANS];
const serverFaqs = [...INITIAL_FAQS];
const serverReviews = [...INITIAL_REVIEWS];

const serverEvidenceStore = new Map<string, GarmentEvidence & { customerId: string; partnerId?: string }>();
const serverDisputesStore = new Map<string, OrderDispute>();
const serverCompensationStore = new Map<string, CompensationRecord>();
const disputeAuditTrailStore: DisputeAuditEntry[] = [];

for (const o of INITIAL_ORDERS) {
  if (o.garmentEvidence) {
    serverEvidenceStore.set(o.id, {
      ...o.garmentEvidence,
      customerId: o.customerId,
      partnerId: o.assignedPartnerId,
    });
  }
}

// Strictly server-private salted scrypt credentials store (NEVER returned in any HTTP response or Firestore doc)
interface ServerCredentialEntry {
  userId: string;
  role: AppRole;
  email: string;
  salt: string;
  hash: string;
}

const serverCredentialStore = new Map<string, ServerCredentialEntry>();

// Seed server-private scrypt credentials for starter operational accounts without exposing any secrets in client code
const INITIAL_SERVER_SEED_SECRET = process.env.SEEDED_ACCOUNT_PASSWORD || 'ShahSignature@2026';
for (const cust of INITIAL_CUSTOMERS) {
  if (cust.email) {
    const { salt, hash } = hashPasswordScrypt(INITIAL_SERVER_SEED_SECRET);
    serverCredentialStore.set(`CUSTOMER:${cust.id}`, {
      userId: cust.id,
      role: 'CUSTOMER',
      email: cust.email.toLowerCase(),
      salt,
      hash,
    });
  }
}
for (const partner of INITIAL_PARTNERS) {
  if (partner.email) {
    const { salt, hash } = hashPasswordScrypt(INITIAL_SERVER_SEED_SECRET);
    serverCredentialStore.set(`SERVICE_PARTNER:${partner.id}`, {
      userId: partner.id,
      role: 'SERVICE_PARTNER',
      email: partner.email.toLowerCase(),
      salt,
      hash,
    });
  }
}

const atomicOrderLocks = new Map<string, { partnerId: string; partnerName: string; lockedAt: string }>();
const adminLoginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();
const loginRateLimits = new Map<string, { attempts: number; lockedUntil: number }>();
const serverAuditLogs: any[] = [];
const SESSION_TOKEN_SECRET = process.env.ADMIN_SECRET_KEY || crypto.randomBytes(32).toString('hex');

function sanitizeCustomerDto(c: CustomerUser): CustomerUser {
  const copy = { ...c };
  delete (copy as any).passwordHash;
  return copy;
}

function sanitizePartnerDto(p: Partner): Partner {
  const copy = { ...p };
  delete (copy as any).passwordHash;
  return copy;
}

function recordServerAudit(
  action: string,
  role: string,
  actor: string,
  details: string,
  status: 'success' | 'warning' | 'blocked'
) {
  const log = {
    id: `srv_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    role,
    actor,
    details,
    status,
  };
  serverAuditLogs.unshift(log);
  if (serverAuditLogs.length > 250) serverAuditLogs.pop();
  console.log(`[AUDIT ${status.toUpperCase()}] ${action} by ${actor} (${role}): ${details}`);
}

interface SignedSessionPayload {
  userId: string;
  role: AppRole;
  email: string;
  name: string;
  exp: number;
  jti: string;
}

function signSessionToken(params: { userId: string; role: AppRole; email: string; name: string }): string {
  const payloadObj: SignedSessionPayload = {
    userId: params.userId,
    role: params.role,
    email: params.email,
    name: params.name,
    exp: Date.now() + 24 * 3600 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

function verifyServerSessionToken(token: string): SignedSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const [payloadB64, sigHex] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(payloadB64).digest('hex');
    const actualBuf = Buffer.from(sigHex, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!parsed || !parsed.userId || !parsed.role || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    if (!['SUPER_ADMIN', 'SERVICE_PARTNER', 'CUSTOMER'].includes(parsed.role)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AuthenticatedIdentity {
  valid: boolean;
  userId: string;
  role: AppRole;
  email: string;
  name: string;
}

async function authenticateRequest(req: Request): Promise<AuthenticatedIdentity | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;

  // 1. Verify HMAC-signed SHAH SIGNATURE server session token
  const hmacPayload = verifyServerSessionToken(rawToken);
  if (hmacPayload) {
    return {
      valid: true,
      userId: hmacPayload.userId,
      role: hmacPayload.role,
      email: hmacPayload.email,
      name: hmacPayload.name,
    };
  }

  // 2. Verify Firebase ID Token cryptographically & map authoritative role strictly from server registries
  const fb = await verifyFirebaseClientToken(rawToken);
  if (fb.valid && fb.uid) {
    const cleanEmail = (fb.email || '').trim().toLowerCase();
    if (fb.emailVerified && TRUSTED_ADMIN_EMAILS.has(cleanEmail)) {
      return {
        valid: true,
        userId: 'adm_ronak_01',
        role: 'SUPER_ADMIN',
        email: cleanEmail,
        name: fb.name || 'Ronak',
      };
    }
    const matchedPartner = serverPartners.find(
      p => p.id === fb.uid || (cleanEmail && p.email?.toLowerCase() === cleanEmail)
    );
    if (matchedPartner && matchedPartner.status !== 'suspended') {
      return {
        valid: true,
        userId: matchedPartner.id,
        role: 'SERVICE_PARTNER',
        email: matchedPartner.email || cleanEmail,
        name: matchedPartner.name,
      };
    }
    const matchedCust = serverCustomers.find(
      c => c.id === fb.uid || (cleanEmail && c.email?.toLowerCase() === cleanEmail)
    );
    return {
      valid: true,
      userId: matchedCust?.id || fb.uid,
      role: 'CUSTOMER',
      email: cleanEmail,
      name: matchedCust?.name || fb.name || 'Customer',
    };
  }

  return null;
}

async function requireAuth(req: Request, res: Response): Promise<AuthenticatedIdentity | null> {
  const identity = await authenticateRequest(req);
  if (!identity) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in with a verified account.',
    });
    return null;
  }
  return identity;
}

async function requireRoles(
  req: Request,
  res: Response,
  allowedRoles: AppRole[]
): Promise<AuthenticatedIdentity | null> {
  const identity = await requireAuth(req, res);
  if (!identity) return null;
  if (!allowedRoles.includes(identity.role)) {
    recordServerAudit(
      'UNAUTHORIZED_ROLE_ACCESS',
      identity.role,
      identity.email || identity.userId,
      `Blocked ${req.method} ${req.path} (requires ${allowedRoles.join('/')})`,
      'blocked'
    );
    res.status(403).json({
      success: false,
      message: `Forbidden: insufficient permissions for role ${identity.role}.`,
    });
    return null;
  }
  return identity;
}

function haversineDistanceKm(lat1?: number, lng1?: number, lat2?: number, lng2?: number): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number'
  ) {
    return 999;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findEligiblePartnersServer(params: {
  pincode: string;
  serviceType: string;
  customerLat?: number;
  customerLng?: number;
  excludedPartnerIds?: string[];
}) {
  const cleanPin = params.pincode.trim();
  const excluded = new Set(params.excludedPartnerIds || []);

  const candidates = serverPartners.filter(p => {
    if (excluded.has(p.id)) return false;
    if (p.status !== 'active') return false;
    if (p.kycVerified === false) return false;
    if (!p.isOnline) return false;
    if (p.commissionBlocked) return false;
    const coversPin =
      p.pincode === cleanPin || (Array.isArray(p.servicePincodes) && p.servicePincodes.includes(cleanPin));
    if (!coversPin) return false;
    const supportsService =
      !params.serviceType ||
      !Array.isArray(p.servicesOffered) ||
      p.servicesOffered.includes(params.serviceType);
    if (!supportsService) return false;
    const maxCap = p.maxDailyCapacity || 25;
    const activeOrders = p.currentActiveOrders || 0;
    if (activeOrders >= maxCap) return false;
    return true;
  });

  // Public matching metadata only — never expose private PII like personal email/UPI/wallet
  return candidates
    .map(p => {
      const distKm = haversineDistanceKm(
        params.customerLat,
        params.customerLng,
        p.coordinates?.lat,
        p.coordinates?.lng
      );
      return {
        partnerId: p.id,
        name: p.name,
        businessName: p.businessName,
        hubName: p.hubName,
        distanceKm: Number.isFinite(distKm) ? Number(distKm.toFixed(2)) : 999,
        rating: p.rating || 0,
        activeLoad: p.currentActiveOrders || 0,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating || a.activeLoad - b.activeLoad);
}

// ==================== AUTHENTICATION API ROUTES ====================

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone, role = 'CUSTOMER' } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    const result = await sendPhoneOtp(phone, role === 'SERVICE_PARTNER' ? 'SERVICE_PARTNER' : 'CUSTOMER');
    if (!result.success) {
      const statusCode = result.requiresClientFirebaseAuth ? 503 : 429;
      recordServerAudit('OTP_REQUEST_STATUS', role, phone, result.message, 'warning');
      return res.status(statusCode).json(result);
    }

    recordServerAudit('OTP_REQUEST_DISPATCHED', role, sanitizeIndianPhone(phone), 'SMS OTP dispatched.', 'success');
    return res.json(result);
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ success: false, message: 'Internal server error processing OTP request.' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { verificationId, otp, phone } = req.body;
    if (!verificationId || !otp || !phone) {
      return res.status(400).json({ success: false, message: 'Verification ID, phone number, and OTP are required.' });
    }

    const result = await verifyPhoneOtp(verificationId, otp, phone);
    if (!result.success) {
      recordServerAudit('OTP_VERIFICATION_FAILED', 'UNKNOWN', sanitizeIndianPhone(phone), result.message, 'blocked');
      return res.status(400).json(result);
    }

    recordServerAudit('OTP_VERIFIED_SUCCESS', 'CUSTOMER', sanitizeIndianPhone(phone), 'Phone number ownership verified.', 'success');
    return res.json(result);
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ success: false, message: 'Internal server error verifying OTP.' });
  }
});

app.post('/api/auth/admin-login', (req, res) => {
  const { usernameOrEmail, password } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ipKey = String(clientIp);

  const now = Date.now();
  const tracker = adminLoginAttempts.get(ipKey) || { attempts: 0, lockedUntil: 0 };

  if (tracker.lockedUntil > now) {
    const waitSecs = Math.ceil((tracker.lockedUntil - now) / 1000);
    recordServerAudit('SUPER_ADMIN_LOCKED_ATTEMPT', 'SUPER_ADMIN', usernameOrEmail || 'Anonymous', `Locked out. Retry in ${waitSecs}s.`, 'blocked');
    return res.status(429).json({
      success: false,
      message: `Too many failed admin login attempts. Security lock active for ${waitSecs} seconds.`,
    });
  }

  const cleanInput = String(usernameOrEmail || '').trim().toLowerCase();
  const isAuthorizedIdentity =
    cleanInput === 'ronak_admin' || TRUSTED_ADMIN_EMAILS.has(cleanInput);

  const validAdminSecret = process.env.ADMIN_SECRET_KEY || 'Ronak@ShahSignature2026';

  if (!isAuthorizedIdentity || !password || password !== validAdminSecret) {
    tracker.attempts += 1;
    if (tracker.attempts >= 5) {
      tracker.lockedUntil = now + 15 * 60 * 1000;
    }
    adminLoginAttempts.set(ipKey, tracker);

    recordServerAudit('UNAUTHORIZED_ADMIN_LOGIN_ATTEMPT', 'SUPER_ADMIN', cleanInput || 'Anonymous', `Failed attempt ${tracker.attempts}/5.`, 'blocked');
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Super Admin credentials.',
    });
  }

  adminLoginAttempts.delete(ipKey);
  const adminToken = signSessionToken({
    userId: 'adm_ronak_01',
    role: 'SUPER_ADMIN',
    email: cleanInput === 'chinku.s1006@gmail.com' ? 'chinku.s1006@gmail.com' : 'shahsignature@gmail.com',
    name: 'Ronak',
  });
  recordServerAudit('SUPER_ADMIN_LOGIN_SUCCESS', 'SUPER_ADMIN', 'Ronak', 'Owner authenticated with full Super Admin privileges.', 'success');

  return res.json({
    success: true,
    token: adminToken,
    user: {
      id: 'adm_ronak_01',
      name: 'Ronak',
      role: 'SUPER_ADMIN',
      email: 'shahsignature@gmail.com',
      username: 'ronak_admin',
      mfaVerified: true,
      lastLoginAt: new Date().toISOString(),
    },
    message: 'Super Admin access granted to Ronak.',
  });
});

app.post('/api/auth/customer-register', (req, res) => {
  const { name, phone, email, password, addressLine, locality, pincode, referralCodeUsed } = req.body || {};

  // Strictly ignore any client-supplied role/privileges (always force CUSTOMER)
  if (!name || !String(name).trim() || !phone || !String(phone).trim() || !email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Name, mobile number, and email are required.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const duplicate = serverCustomers.find(c => c.email?.toLowerCase() === cleanEmail);
  if (duplicate) {
    return res.status(409).json({ success: false, message: 'Email already registered. Please sign in.' });
  }

  const newId = `cust_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const customerCode = `SHAH-CUST-${8600 + serverCustomers.length + 1}`;
  const referralBonus = referralCodeUsed ? serverSettings.referralBonusPoints || 50 : 0;

  if (referralCodeUsed) {
    serverCustomers = serverCustomers.map(c =>
      c.referralCode?.toUpperCase() === String(referralCodeUsed).trim().toUpperCase()
        ? { ...c, rewardPoints: (c.rewardPoints || 0) + (serverSettings.referralBonusPoints || 50) }
        : c
    );
  }

  const { salt, hash } = hashPasswordScrypt(String(password));
  serverCredentialStore.set(`CUSTOMER:${newId}`, {
    userId: newId,
    role: 'CUSTOMER',
    email: cleanEmail,
    salt,
    hash,
  });

  const nowIso = new Date().toISOString();
  const newCustomer: CustomerUser = {
    id: newId,
    customerCode,
    name: String(name).trim(),
    phone: sanitizeIndianPhone(String(phone)),
    phoneVerified: false,
    email: cleanEmail,
    username: String(name).trim().toLowerCase().replace(/\s+/g, '_'),
    addresses: [
      {
        id: `addr_${Date.now()}`,
        label: 'Home',
        addressLine: addressLine ? String(addressLine).trim() : 'Address on file',
        locality: locality ? String(locality).trim() : 'Local Area',
        city: 'Delhi',
        state: 'Delhi',
        pincode: String(pincode || '110086').trim(),
        isDefault: true,
      },
    ],
    isSuspended: false,
    totalOrders: 0,
    totalSpent: 0,
    rewardPoints: referralBonus,
    referralCode: `${String(name).trim().split(' ')[0].toUpperCase()}-SHAH${Math.floor(10 + Math.random() * 89)}`,
    referredByCode: referralCodeUsed ? String(referralCodeUsed).trim().toUpperCase() : undefined,
    createdAt: nowIso,
    lastLoginAt: nowIso,
  };

  serverCustomers.unshift(newCustomer);
  const token = signSessionToken({
    userId: newCustomer.id,
    role: 'CUSTOMER',
    email: cleanEmail,
    name: newCustomer.name,
  });

  recordServerAudit('CUSTOMER_REGISTERED', 'CUSTOMER', newCustomer.name, `Registered ${customerCode} (${cleanEmail}) with CUSTOMER role.`, 'success');
  return res.status(201).json({
    success: true,
    token,
    role: 'CUSTOMER',
    customer: sanitizeCustomerDto(newCustomer),
    message: `Welcome! Customer ID: ${customerCode}.`,
  });
});

app.post('/api/auth/customer-login', (req, res) => {
  const { emailOrCode, password } = req.body || {};
  const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  const rl = loginRateLimits.get(`cust:${clientIp}`) || { attempts: 0, lockedUntil: 0 };
  if (rl.lockedUntil > now) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed login attempts. Please wait a few minutes and try again.',
    });
  }

  const ident = String(emailOrCode || '').trim().toLowerCase();
  if (!ident || !password) {
    return res.status(400).json({ success: false, message: 'Email/Customer ID/Mobile and password are required.' });
  }

  const cleanDigits = ident.replace(/\D/g, '');
  const found = serverCustomers.find(
    c =>
      c.email?.toLowerCase() === ident ||
      c.customerCode?.toLowerCase() === ident ||
      c.username?.toLowerCase() === ident ||
      (cleanDigits.length >= 10 && c.phone.replace(/\D/g, '').endsWith(cleanDigits))
  );

  if (!found) {
    rl.attempts += 1;
    if (rl.attempts >= 10) rl.lockedUntil = now + 5 * 60 * 1000;
    loginRateLimits.set(`cust:${clientIp}`, rl);
    return res.status(401).json({ success: false, message: 'Invalid customer credentials.' });
  }

  const cred = serverCredentialStore.get(`CUSTOMER:${found.id}`);
  if (!cred || !verifyPasswordScrypt(String(password), cred.salt, cred.hash)) {
    rl.attempts += 1;
    if (rl.attempts >= 10) rl.lockedUntil = now + 5 * 60 * 1000;
    loginRateLimits.set(`cust:${clientIp}`, rl);
    recordServerAudit('CUSTOMER_LOGIN_FAILED', 'CUSTOMER', ident, 'Password mismatch.', 'blocked');
    return res.status(401).json({ success: false, message: 'Invalid customer credentials.' });
  }

  if (found.isSuspended) {
    recordServerAudit('SUSPENDED_CUSTOMER_BLOCKED', 'CUSTOMER', found.name, 'Suspended customer blocked.', 'blocked');
    return res.status(403).json({ success: false, message: 'Account suspended. Contact SHAH SIGNATURE concierge.' });
  }

  loginRateLimits.delete(`cust:${clientIp}`);
  found.lastLoginAt = new Date().toISOString();
  const token = signSessionToken({
    userId: found.id,
    role: 'CUSTOMER',
    email: found.email || '',
    name: found.name,
  });

  recordServerAudit('CUSTOMER_LOGIN_SUCCESS', 'CUSTOMER', found.name, `Authenticated ${found.customerCode || found.id}.`, 'success');
  return res.json({
    success: true,
    token,
    role: 'CUSTOMER',
    customer: sanitizeCustomerDto(found),
    message: `Welcome back, ${found.name}!`,
  });
});

app.post('/api/auth/partner-register', (req, res) => {
  const {
    name,
    phone,
    email,
    businessName,
    serviceAddress,
    pincode,
    city,
    state,
    servicesOffered,
    workingHours,
    password,
  } = req.body || {};

  if (!name || !phone || !email || !businessName || !serviceAddress) {
    return res.status(400).json({ success: false, message: 'All required partner hub details must be provided.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = serverPartners.find(p => p.email?.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Partner email already registered.' });
  }

  const newId = `partner_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const partnerCode = `SHAH-PRT-${8600 + serverPartners.length + 1}`;
  const pin = String(pincode || '110086').trim();

  const { salt, hash } = hashPasswordScrypt(String(password));
  serverCredentialStore.set(`SERVICE_PARTNER:${newId}`, {
    userId: newId,
    role: 'SERVICE_PARTNER',
    email: cleanEmail,
    salt,
    hash,
  });

  const nowIso = new Date().toISOString();
  // Always force pending + kycVerified=false + isOnline=false regardless of payload
  const newPartner: Partner = {
    id: newId,
    partnerCode,
    name: String(name).trim(),
    phone: sanitizeIndianPhone(String(phone)),
    email: cleanEmail,
    username: String(name).trim().toLowerCase().replace(/\s+/g, '_'),
    businessName: String(businessName).trim(),
    hubName: `SHAH SIGNATURE ${String(businessName).trim()} Point`,
    serviceAddress: String(serviceAddress).trim(),
    pincode: pin,
    servicePincodes: [pin],
    city: city ? String(city).trim() : 'Delhi',
    state: state ? String(state).trim() : 'Delhi',
    serviceArea: `PIN ${pin} ${city ? String(city).trim() : ''}`.trim(),
    workingHours: workingHours ? String(workingHours).trim() : '08:00 AM - 08:00 PM IST',
    maxDailyCapacity: 20,
    currentActiveOrders: 0,
    isOnline: false,
    status: 'pending',
    kycVerified: false,
    commissionBlocked: false,
    rating: 0,
    reviewCount: 0,
    totalOrdersCompleted: 0,
    walletBalance: 0,
    totalEarnings: 0,
    commissionPaid: 0,
    commissionPending: 0,
    commissionOverdue: 0,
    servicesOffered:
      Array.isArray(servicesOffered) && servicesOffered.length > 0
        ? servicesOffered
        : ['ironing_normal', 'ironing_steam'],
    documents: [],
    performance: {
      totalOffered: 0,
      totalAccepted: 0,
      totalRejected: 0,
      totalCancelledByPartner: 0,
      onTimePickups: 0,
      onTimeDeliveries: 0,
      complaintsCount: 0,
      disputesCount: 0,
      acceptanceRate: 100,
      rejectionRate: 0,
      cancellationRate: 0,
      onTimePickupRate: 100,
      onTimeDeliveryRate: 100,
      complaintRate: 0,
    },
    joinedDate: nowIso.split('T')[0],
    lastLoginAt: nowIso,
  };

  serverPartners.push(newPartner);
  const token = signSessionToken({
    userId: newPartner.id,
    role: 'SERVICE_PARTNER',
    email: cleanEmail,
    name: newPartner.name,
  });

  recordServerAudit('PARTNER_REGISTERED_PENDING', 'SERVICE_PARTNER', newPartner.name, `Partner ${partnerCode} applied (status=pending, kycVerified=false).`, 'warning');
  return res.status(201).json({
    success: true,
    token,
    role: 'SERVICE_PARTNER',
    partner: sanitizePartnerDto(newPartner),
    message: `Application submitted! Partner ID: ${partnerCode}. Pending Super Admin KYC approval.`,
  });
});

app.post('/api/auth/partner-login', (req, res) => {
  const { emailOrCode, password } = req.body || {};
  const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  const rl = loginRateLimits.get(`prt:${clientIp}`) || { attempts: 0, lockedUntil: 0 };
  if (rl.lockedUntil > now) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed partner login attempts. Please wait a few minutes.',
    });
  }

  const ident = String(emailOrCode || '').trim().toLowerCase();
  if (!ident || !password) {
    return res.status(400).json({ success: false, message: 'Email/Partner ID/Mobile and password are required.' });
  }

  const cleanDigits = ident.replace(/\D/g, '');
  const found = serverPartners.find(
    p =>
      p.email?.toLowerCase() === ident ||
      p.partnerCode?.toLowerCase() === ident ||
      p.username?.toLowerCase() === ident ||
      (cleanDigits.length >= 10 && p.phone.replace(/\D/g, '').endsWith(cleanDigits))
  );

  if (!found) {
    rl.attempts += 1;
    if (rl.attempts >= 10) rl.lockedUntil = now + 5 * 60 * 1000;
    loginRateLimits.set(`prt:${clientIp}`, rl);
    return res.status(401).json({ success: false, message: 'Invalid partner credentials.' });
  }

  const cred = serverCredentialStore.get(`SERVICE_PARTNER:${found.id}`);
  if (!cred || !verifyPasswordScrypt(String(password), cred.salt, cred.hash)) {
    rl.attempts += 1;
    if (rl.attempts >= 10) rl.lockedUntil = now + 5 * 60 * 1000;
    loginRateLimits.set(`prt:${clientIp}`, rl);
    recordServerAudit('PARTNER_LOGIN_FAILED', 'SERVICE_PARTNER', ident, 'Password mismatch.', 'blocked');
    return res.status(401).json({ success: false, message: 'Invalid partner credentials.' });
  }

  if (found.status === 'suspended') {
    recordServerAudit('SUSPENDED_PARTNER_BLOCKED', 'SERVICE_PARTNER', found.name, 'Suspended partner blocked.', 'blocked');
    return res.status(403).json({ success: false, message: 'Partner account suspended. Contact Administration.' });
  }

  loginRateLimits.delete(`prt:${clientIp}`);
  found.lastLoginAt = new Date().toISOString();
  const token = signSessionToken({
    userId: found.id,
    role: 'SERVICE_PARTNER',
    email: found.email || '',
    name: found.name,
  });

  recordServerAudit('PARTNER_LOGIN_SUCCESS', 'SERVICE_PARTNER', found.name, `Partner ${found.partnerCode} signed in (status=${found.status}).`, 'success');
  return res.json({
    success: true,
    token,
    role: 'SERVICE_PARTNER',
    partner: sanitizePartnerDto(found),
    message: `Welcome back, ${found.name}!`,
  });
});

app.post('/api/auth/firebase-session', async (req, res) => {
  const { idToken, portal = 'customer' } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Firebase ID token is required.' });
  }

  const verified = await verifyFirebaseClientToken(String(idToken));
  if (!verified.valid || !verified.uid) {
    recordServerAudit('INVALID_FIREBASE_TOKEN', 'UNKNOWN', 'FirebaseSession', 'Rejected invalid or unsigned Firebase ID token.', 'blocked');
    return res.status(401).json({ success: false, message: 'Invalid or expired Firebase verification token.' });
  }

  const cleanEmail = (verified.email || '').trim().toLowerCase();

  // Never allow public elevation to Admin unless verified email matches bootstrapped owners
  if (portal === 'admin') {
    if (verified.emailVerified && TRUSTED_ADMIN_EMAILS.has(cleanEmail)) {
      const token = signSessionToken({
        userId: 'adm_ronak_01',
        role: 'SUPER_ADMIN',
        email: cleanEmail,
        name: verified.name || 'Ronak',
      });
      return res.json({ success: true, role: 'SUPER_ADMIN', token, userName: verified.name || 'Ronak' });
    }
    recordServerAudit('UNAUTHORIZED_FIREBASE_ADMIN_ESCALATION', 'UNKNOWN', cleanEmail || verified.uid, 'Blocked non-owner Google account from Admin session.', 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: Super Admin privileges are restricted to verified owner accounts.' });
  }

  if (portal === 'partner') {
    const partner = serverPartners.find(
      p => p.id === verified.uid || (cleanEmail && p.email?.toLowerCase() === cleanEmail)
    );
    if (!partner) {
      return res.json({
        success: true,
        needsPartnerRegistration: true,
        firebaseEmail: verified.email || '',
        firebaseName: verified.name || '',
        message: 'Google account verified. Complete Partner KYC application below (Admin approval required).',
      });
    }
    if (partner.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Partner account suspended.' });
    }
    const token = signSessionToken({
      userId: partner.id,
      role: 'SERVICE_PARTNER',
      email: partner.email || cleanEmail,
      name: partner.name,
    });
    return res.json({
      success: true,
      role: 'SERVICE_PARTNER',
      token,
      partner: sanitizePartnerDto(partner),
    });
  }

  // Customer sign-in via verified Google/Firebase account
  let cust = serverCustomers.find(
    c => c.id === verified.uid || (cleanEmail && c.email?.toLowerCase() === cleanEmail)
  );
  if (!cust) {
    const newId = `cust_${verified.uid.slice(0, 12)}_${Date.now().toString().slice(-4)}`;
    cust = {
      id: newId,
      customerCode: `SHAH-CUST-${8600 + serverCustomers.length + 1}`,
      name: verified.name || 'SHAH SIGNATURE Guest',
      phone: verified.phoneNumber || '+91 0000000000',
      phoneVerified: Boolean(verified.phoneNumber),
      email: cleanEmail || `${verified.uid}@firebase.user`,
      addresses: [
        {
          id: `addr_${Date.now()}`,
          label: 'Home',
          addressLine: 'Update delivery address in Address Book',
          locality: 'Local Area',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110086',
          isDefault: true,
        },
      ],
      isSuspended: false,
      totalOrders: 0,
      totalSpent: 0,
      rewardPoints: 0,
      referralCode: `SHAH${Math.floor(1000 + Math.random() * 8999)}`,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    serverCustomers.unshift(cust);
  }
  if (cust.isSuspended) {
    return res.status(403).json({ success: false, message: 'Account suspended. Contact SHAH SIGNATURE concierge.' });
  }
  const token = signSessionToken({
    userId: cust.id,
    role: 'CUSTOMER',
    email: cust.email || cleanEmail,
    name: cust.name,
  });
  return res.json({
    success: true,
    role: 'CUSTOMER',
    token,
    customer: sanitizeCustomerDto(cust),
  });
});

app.get('/api/auth/me', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.role === 'SUPER_ADMIN') {
    return res.json({
      success: true,
      role: 'SUPER_ADMIN',
      userId: auth.userId,
      userName: auth.name,
      userEmail: auth.email,
    });
  }

  if (auth.role === 'SERVICE_PARTNER') {
    const partner = serverPartners.find(p => p.id === auth.userId);
    if (!partner || partner.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Partner session inactive or suspended.' });
    }
    return res.json({
      success: true,
      role: 'SERVICE_PARTNER',
      userId: partner.id,
      userName: partner.name,
      userEmail: partner.email,
      partner: sanitizePartnerDto(partner),
    });
  }

  const cust = serverCustomers.find(c => c.id === auth.userId);
  if (cust?.isSuspended) {
    return res.status(403).json({ success: false, message: 'Customer account suspended.' });
  }
  return res.json({
    success: true,
    role: 'CUSTOMER',
    userId: auth.userId,
    userName: cust?.name || auth.name,
    userEmail: cust?.email || auth.email,
    customer: cust ? sanitizeCustomerDto(cust) : undefined,
  });
});

app.post('/api/auth/change-password', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (auth.role === 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Super Admin password is managed via environment security configuration (ADMIN_SECRET_KEY).',
    });
  }

  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'Current password and new password (min 8 chars) required.' });
  }

  const key = `${auth.role}:${auth.userId}`;
  const cred = serverCredentialStore.get(key);
  if (!cred || !verifyPasswordScrypt(String(oldPassword), cred.salt, cred.hash)) {
    return res.status(403).json({ success: false, message: 'Current password is incorrect.' });
  }

  const { salt, hash } = hashPasswordScrypt(String(newPassword));
  serverCredentialStore.set(key, { ...cred, salt, hash });
  recordServerAudit('PASSWORD_CHANGED', auth.role, auth.email || auth.userId, 'Password updated via scrypt verification.', 'success');
  return res.json({ success: true, message: 'Your password has been updated securely.' });
});

app.post('/api/auth/password-reset/request', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: 'Registered email address required.' });
  }
  if (!gatewayStatus.emailGatewayConfigured) {
    recordServerAudit('PASSWORD_RESET_EMAIL_UNCONFIGURED', 'SYSTEM', String(email), 'Email SMTP/Resend not configured for secure out-of-band reset delivery.', 'warning');
    return res.status(503).json({
      success: false,
      message:
        'Automated password reset email carrier (SMTP / Resend) is not configured yet. Never issue password reset tokens directly in the browser — please sign in with Google Auth or contact Ronak (+919899229102).',
    });
  }
  return res.json({
    success: true,
    message: 'If an account matches that email, recovery instructions have been sent.',
  });
});

// ==================== PUBLIC NON-PII CATALOG & LOCATION CHECK ====================

app.get('/api/marketplace/public', (_req, res) => {
  return res.json({
    success: true,
    serviceCategories: serverServiceCategories.filter(s => s.isActive),
    garments: serverCatalog.filter(g => g.isActive !== false),
    serviceAreas: serverServiceAreas.filter(a => a.isActive),
    coupons: serverCoupons.filter(c => c.isActive),
    subscriptionPlans: serverSubscriptionPlans.filter(p => p.isActive),
    faqs: serverFaqs.filter(f => f.isActive),
    reviews: serverReviews,
    businessSettings: {
      brandName: serverBusinessSettings.brandName,
      businessOwnerName: serverBusinessSettings.businessOwnerName,
      tagline: serverBusinessSettings.tagline,
      businessPhone: serverBusinessSettings.businessPhone,
      whatsappSupportNumber: serverBusinessSettings.whatsappSupportNumber,
      businessEmail: serverBusinessSettings.businessEmail,
      businessAddress: serverBusinessSettings.businessAddress,
      businessLogo: serverBusinessSettings.businessLogo,
      supportHours: serverBusinessSettings.supportHours,
      heroTitle: serverBusinessSettings.heroTitle,
      heroSubtitle: serverBusinessSettings.heroSubtitle,
      aboutUsText: serverBusinessSettings.aboutUsText,
      servicePincodes: serverBusinessSettings.servicePincodes,
      socialLinks: serverBusinessSettings.socialLinks,
    },
    legalPolicies: serverLegalPolicies,
    settings: {
      deliveryChargeStandard: serverSettings.deliveryChargeStandard,
      deliveryChargeExpress: serverSettings.deliveryChargeExpress,
      freeDeliveryThreshold: serverSettings.freeDeliveryThreshold,
      scentedStarchPrice: serverSettings.scentedStarchPrice,
      luxuryHangerPrice: serverSettings.luxuryHangerPrice,
      expressTurnaroundPrice: serverSettings.expressTurnaroundPrice,
      currencySymbol: serverSettings.currencySymbol,
    },
  });
});

// Admin-only config synchronization (NEVER open unauthenticated!)
app.post('/api/marketplace/sync-config', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const { garments, serviceAreas, partners, settings, coupons, orders } = req.body || {};
  if (Array.isArray(garments) && garments.length > 0) serverCatalog = garments;
  if (Array.isArray(serviceAreas) && serviceAreas.length > 0) serverServiceAreas = serviceAreas;
  if (Array.isArray(partners) && partners.length > 0) {
    serverPartners = partners.map((p: Partner) => sanitizePartnerDto(p));
  }
  if (settings && typeof settings === 'object') serverSettings = { ...serverSettings, ...settings };
  if (Array.isArray(coupons)) serverCoupons = coupons;
  if (Array.isArray(orders) && orders.length > 0) {
    serverOrders = orders;
    for (const o of orders as Order[]) {
      if (o.garmentEvidence && !serverEvidenceStore.has(o.id)) {
        serverEvidenceStore.set(o.id, {
          ...o.garmentEvidence,
          customerId: o.customerId,
          partnerId: o.assignedPartnerId,
        });
      }
    }
  }
  recordServerAudit('ADMIN_SYNC_CONFIG', 'SUPER_ADMIN', admin.email, 'Synchronized marketplace configuration.', 'success');
  return res.json({ success: true });
});

app.get('/api/location/check', (req, res) => {
  const pincode = String(req.query.pincode || '').trim();
  const serviceType = String(req.query.serviceType || '').trim();
  const area = serverServiceAreas.find(a => a.pincode === pincode && a.isActive);
  const eligiblePartners = findEligiblePartnersServer({ pincode, serviceType });

  return res.json({
    pincode,
    areaActive: Boolean(area),
    area: area || null,
    eligiblePartnersCount: eligiblePartners.length,
    partners: eligiblePartners,
    servicesAvailable: Boolean(area) && eligiblePartners.length > 0,
  });
});

// ==================== STRICTLY ISOLATED CUSTOMER ENDPOINTS ====================

app.get('/api/customers', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;
  return res.json({ success: true, customers: serverCustomers.map(sanitizeCustomerDto) });
});

app.get('/api/customers/:id', async (req, res) => {
  const auth = await requireRoles(req, res, ['SUPER_ADMIN', 'CUSTOMER']);
  if (!auth) return;
  const { id } = req.params;
  if (auth.role !== 'SUPER_ADMIN' && auth.userId !== id) {
    recordServerAudit('CROSS_CUSTOMER_READ_BLOCKED', auth.role, auth.userId, `Blocked read of customer ${id}`, 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: you may only access your own customer profile.' });
  }
  const customer = serverCustomers.find(c => c.id === id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
  return res.json({ success: true, customer: sanitizeCustomerDto(customer) });
});

app.patch('/api/customers/:id', async (req, res) => {
  const auth = await requireRoles(req, res, ['SUPER_ADMIN', 'CUSTOMER']);
  if (!auth) return;
  const { id } = req.params;
  if (auth.role !== 'SUPER_ADMIN' && auth.userId !== id) {
    recordServerAudit('CROSS_CUSTOMER_EDIT_BLOCKED', auth.role, auth.userId, `Blocked edit of customer ${id}`, 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: you cannot modify another customer account.' });
  }

  const customer = serverCustomers.find(c => c.id === id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

  const updates = req.body || {};
  const forbiddenCustomerFields = new Set([
    'id',
    'customerCode',
    'role',
    'isSuspended',
    'rewardPoints',
    'totalOrders',
    'totalSpent',
    'phoneVerified',
    'createdAt',
    'passwordHash',
  ]);

  if (auth.role !== 'SUPER_ADMIN') {
    for (const key of Object.keys(updates)) {
      if (forbiddenCustomerFields.has(key)) {
        recordServerAudit('PRIVILEGE_FIELD_TAMPER_BLOCKED', auth.role, auth.userId, `Blocked customer tampering with "${key}"`, 'blocked');
        return res.status(403).json({
          success: false,
          message: `Forbidden: customers cannot modify protected field "${key}".`,
        });
      }
    }
  }

  const allowedUpdates: Partial<CustomerUser> = {};
  if (typeof updates.name === 'string' && updates.name.trim()) allowedUpdates.name = updates.name.trim();
  if (typeof updates.phone === 'string' && updates.phone.trim()) allowedUpdates.phone = updates.phone.trim();
  if (typeof updates.email === 'string' && updates.email.trim()) allowedUpdates.email = updates.email.trim().toLowerCase();
  if (Array.isArray(updates.addresses)) allowedUpdates.addresses = updates.addresses;
  if (auth.role === 'SUPER_ADMIN' && typeof updates.isSuspended === 'boolean') {
    allowedUpdates.isSuspended = updates.isSuspended;
  }

  const updated = { ...customer, ...allowedUpdates };
  serverCustomers = serverCustomers.map(c => (c.id === id ? updated : c));
  return res.json({ success: true, customer: sanitizeCustomerDto(updated) });
});

// ==================== STRICTLY ISOLATED PARTNER ENDPOINTS ====================

app.get('/api/partners', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;
  return res.json({ success: true, partners: serverPartners.map(sanitizePartnerDto) });
});

app.get('/api/partners/:id', async (req, res) => {
  const auth = await requireRoles(req, res, ['SUPER_ADMIN', 'SERVICE_PARTNER']);
  if (!auth) return;
  const { id } = req.params;
  if (auth.role !== 'SUPER_ADMIN' && auth.userId !== id) {
    recordServerAudit('CROSS_PARTNER_READ_BLOCKED', auth.role, auth.userId, `Blocked read of partner ${id}`, 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: you can only view your own partner dashboard.' });
  }
  const partner = serverPartners.find(p => p.id === id);
  if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });
  return res.json({ success: true, partner: sanitizePartnerDto(partner) });
});

app.patch('/api/partners/:id/profile', async (req, res) => {
  const auth = await requireRoles(req, res, ['SUPER_ADMIN', 'SERVICE_PARTNER']);
  if (!auth) return;
  const { id } = req.params;
  if (auth.role !== 'SUPER_ADMIN' && auth.userId !== id) {
    recordServerAudit('CROSS_PARTNER_EDIT_BLOCKED', auth.role, auth.userId, `Blocked edit of partner ${id}`, 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: cannot modify another partner account.' });
  }

  const partner = serverPartners.find(p => p.id === id);
  if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

  const updates = req.body || {};
  const partnerForbiddenFields = new Set([
    'id',
    'partnerCode',
    'role',
    'status',
    'kycVerified',
    'commissionBlocked',
    'customCommissionPercent',
    'walletBalance',
    'totalEarnings',
    'commissionPaid',
    'commissionPending',
    'commissionOverdue',
    'totalOrdersCompleted',
    'rating',
    'reviewCount',
    'passwordHash',
  ]);

  if (auth.role !== 'SUPER_ADMIN') {
    for (const key of Object.keys(updates)) {
      if (partnerForbiddenFields.has(key)) {
        recordServerAudit('PARTNER_SELF_ESCALATION_BLOCKED', auth.role, auth.userId, `Blocked partner modifying protected field "${key}"`, 'blocked');
        return res.status(403).json({
          success: false,
          message: `Forbidden: partners cannot modify Admin-controlled field "${key}".`,
        });
      }
    }
    if (updates.isOnline === true && (partner.status !== 'active' || partner.kycVerified === false || partner.commissionBlocked)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: pending, unverified, or commission-blocked partners cannot go ONLINE.',
      });
    }
  }

  const allowedUpdates: Partial<Partner> = {};
  if (typeof updates.isOnline === 'boolean') allowedUpdates.isOnline = updates.isOnline;
  if (typeof updates.workingHours === 'string') allowedUpdates.workingHours = updates.workingHours.trim();
  if (typeof updates.serviceAddress === 'string') allowedUpdates.serviceAddress = updates.serviceAddress.trim();
  if (typeof updates.upiId === 'string') allowedUpdates.upiId = updates.upiId.trim();
  if (Array.isArray(updates.servicesOffered)) allowedUpdates.servicesOffered = updates.servicesOffered;
  if (Array.isArray(updates.servicePincodes)) allowedUpdates.servicePincodes = updates.servicePincodes;
  if (typeof updates.maxDailyCapacity === 'number' && updates.maxDailyCapacity > 0) {
    allowedUpdates.maxDailyCapacity = Math.min(200, updates.maxDailyCapacity);
  }

  const updated = { ...partner, ...allowedUpdates };
  serverPartners = serverPartners.map(p => (p.id === id ? updated : p));
  return res.json({ success: true, partner: sanitizePartnerDto(updated) });
});

app.post('/api/partners/:id/approval', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const { id } = req.params;
  const { status, kycVerified, commissionBlocked } = req.body || {};
  const partner = serverPartners.find(p => p.id === id);
  if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

  const nextStatus =
    status === 'active' || status === 'pending' || status === 'suspended' ? status : partner.status;
  const nextKyc =
    typeof kycVerified === 'boolean'
      ? kycVerified
      : nextStatus === 'active'
      ? true
      : partner.kycVerified;
  const nextBlocked =
    typeof commissionBlocked === 'boolean' ? commissionBlocked : partner.commissionBlocked;

  const updated: Partner = {
    ...partner,
    status: nextStatus,
    kycVerified: nextKyc,
    commissionBlocked: nextBlocked,
    isOnline: nextStatus === 'active' ? partner.isOnline : false,
  };
  serverPartners = serverPartners.map(p => (p.id === id ? updated : p));
  recordServerAudit(
    'ADMIN_PARTNER_APPROVAL_UPDATED',
    'SUPER_ADMIN',
    admin.email,
    `Partner ${id} -> status=${nextStatus}, kyc=${nextKyc}, blocked=${nextBlocked}`,
    nextStatus === 'suspended' ? 'warning' : 'success'
  );
  return res.json({ success: true, partner: sanitizePartnerDto(updated) });
});

// ==================== ORDERS, AUTHORITATIVE PRICING & ATOMIC DISPATCH ====================

app.get('/api/orders', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.role === 'SUPER_ADMIN') {
    return res.json({ success: true, orders: serverOrders });
  }

  if (auth.role === 'CUSTOMER') {
    return res.json({
      success: true,
      orders: serverOrders.filter(o => o.customerId === auth.userId),
    });
  }

  if (auth.role === 'SERVICE_PARTNER') {
    const partner = serverPartners.find(p => p.id === auth.userId);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner profile not found.' });
    const isPartnerActive = partner.status === 'active' && partner.kycVerified !== false && !partner.commissionBlocked;

    const visible = serverOrders.filter(o => {
      if (o.assignedPartnerId === auth.userId) return true;
      if (!isPartnerActive) return false;
      const canonical = normalizeOrderStatus(o.status);
      if (canonical === 'BOOKED' && !o.assignedPartnerId) {
        const coversPin =
          partner.pincode === o.pincode || (partner.servicePincodes || []).includes(o.pincode);
        return coversPin && !(o.rejectedPartnerIds || []).includes(auth.userId);
      }
      return false;
    });
    return res.json({ success: true, orders: visible });
  }

  return res.status(403).json({ success: false, message: 'Forbidden.' });
});

app.post('/api/orders/validate-booking', async (req, res) => {
  const auth = await requireRoles(req, res, ['CUSTOMER', 'SUPER_ADMIN']);
  if (!auth) return;

  const {
    customerPhone,
    phoneProofToken,
    firebaseVerifiedPhone,
    pincode,
    serviceType = 'ironing_steam',
    items = [],
    itemCount,
    addOns = {},
    deliveryMode = 'home_valet',
    couponCode,
    customerLat,
    customerLng,
  } = req.body || {};

  // Never let client claim another user's customerId when role === CUSTOMER
  const authoritativeCustomerId =
    auth.role === 'SUPER_ADMIN' && req.body?.customerId ? String(req.body.customerId) : auth.userId;

  const activeAreas = serverServiceAreas.filter(a => a.isActive);
  const matchedArea = activeAreas.find(a => a.pincode === String(pincode || '').trim());
  const eligiblePartners = findEligiblePartnersServer({
    pincode: String(pincode || ''),
    serviceType,
    customerLat,
    customerLng,
  });

  // Authoritative server-side price calculation from catalog ONLY (reject zero/negative/forged items)
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one garment item from catalog is required.' });
  }

  let computedSubtotal = 0;
  let totalGarments = 0;
  for (const line of items) {
    const catalogItem = serverCatalog.find(g => g.id === line.garmentId && g.isActive !== false);
    const qty = Math.floor(Number(line.quantity || 0));
    if (!catalogItem || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid garment item or quantity (${line?.garmentId || 'unknown'}). Pricing must come from verified catalog.`,
      });
    }
    computedSubtotal += catalogItem.price * qty;
    totalGarments += qty;
  }

  const deliveryCharge =
    deliveryMode === 'home_valet'
      ? computedSubtotal >= serverSettings.freeDeliveryThreshold
        ? 0
        : serverSettings.deliveryChargeStandard
      : 0;
  const starchFee = addOns?.scentedStarch ? totalGarments * serverSettings.scentedStarchPrice : 0;
  const hangerFee = addOns?.luxuryHangers ? serverSettings.luxuryHangerPrice : 0;
  const expressFee = addOns?.expressDelivery ? serverSettings.expressTurnaroundPrice : 0;

  let discount = 0;
  if (couponCode) {
    const coupon = serverCoupons.find(
      c => c.code.toUpperCase() === String(couponCode).trim().toUpperCase() && c.isActive
    );
    if (coupon && computedSubtotal >= coupon.minOrder) {
      if (coupon.flatDiscount) discount = coupon.flatDiscount;
      else if (coupon.discountPercent) {
        const raw = Math.round((computedSubtotal * coupon.discountPercent) / 100);
        discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
      }
    }
  }

  const totalAmount = Math.max(0, computedSubtotal + deliveryCharge + starchFee + hangerFee + expressFee - discount);
  const commissionRate = serverSettings.platformCommissionPercent || 15;
  const platformCommissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const partnerNetAmount = totalAmount - platformCommissionAmount;

  const result = validateBookingEligibility({
    customerId: authoritativeCustomerId,
    customerPhone,
    phoneProofToken,
    firebaseVerifiedPhone,
    pincode: String(pincode || ''),
    itemCount: Number(itemCount || totalGarments || 0),
    totalEstimatedAmount: totalAmount,
    serviceType,
    activePincodes: activeAreas.map(a => a.pincode),
    minOrderAmount: matchedArea?.minOrderAmount,
    eligiblePartnersCount: eligiblePartners.length,
  });

  if (!result.eligible) {
    recordServerAudit('BOOKING_REJECTED_SERVER', 'CUSTOMER', customerPhone || authoritativeCustomerId, result.reason || 'Validation failed', 'warning');
    return res.status(403).json({ success: false, message: result.reason });
  }

  const pickupOtp = String(crypto.randomInt(1000, 9999));
  const deliveryOtp = String(crypto.randomInt(1000, 9999));

  recordServerAudit(
    'BOOKING_APPROVED_SERVER',
    'CUSTOMER',
    customerPhone || authoritativeCustomerId,
    `Verified order for PIN ${pincode} (${totalGarments} garments, ₹${totalAmount}, 15% commission ₹${platformCommissionAmount}).`,
    'success'
  );

  return res.json({
    success: true,
    pricing: {
      subtotal: computedSubtotal,
      deliveryCharge,
      discount,
      totalAmount,
      commissionRate,
      platformCommissionAmount,
      partnerNetAmount,
    },
    dispatchCandidates: eligiblePartners,
    recommendedPartner: eligiblePartners[0] || null,
    pickupOtp,
    deliveryOtp,
    message: `Booking verified for ${matchedArea?.areaName || pincode} (${eligiblePartners.length} partner(s) eligible).`,
  });
});

app.post('/api/orders/create', async (req, res) => {
  const auth = await requireRoles(req, res, ['CUSTOMER', 'SUPER_ADMIN']);
  if (!auth) return;

  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one garment item is required.' });
  }

  const authoritativeCustomerId =
    auth.role === 'SUPER_ADMIN' && body.customerId ? String(body.customerId) : auth.userId;

  const pincode = String(body.pincode || '').trim();
  const activeAreas = serverServiceAreas.filter(a => a.isActive);
  const matchedArea = activeAreas.find(a => a.pincode === pincode);
  if (!matchedArea) {
    return res.status(403).json({ success: false, message: `Service is not active in PIN ${pincode}.` });
  }

  let computedSubtotal = 0;
  let totalGarments = 0;
  const verifiedItems = [];
  for (const line of items) {
    const catalogItem = serverCatalog.find(g => g.id === line.garmentId && g.isActive !== false);
    const qty = Math.floor(Number(line.quantity || 0));
    if (!catalogItem || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid garment catalog item or quantity.' });
    }
    const lineTotal = catalogItem.price * qty;
    computedSubtotal += lineTotal;
    totalGarments += qty;
    verifiedItems.push({
      garmentId: catalogItem.id,
      name: catalogItem.nameEn,
      quantity: qty,
      unitPrice: catalogItem.price,
      totalPrice: lineTotal,
    });
  }

  const deliveryMode = body.deliveryMode === 'self_drop' ? 'self_drop' : 'home_valet';
  const addOns = body.addOns || {};
  const deliveryCharge =
    deliveryMode === 'home_valet'
      ? computedSubtotal >= serverSettings.freeDeliveryThreshold
        ? 0
        : serverSettings.deliveryChargeStandard
      : 0;
  const starchFee = addOns.scentedStarch ? totalGarments * serverSettings.scentedStarchPrice : 0;
  const hangerFee = addOns.luxuryHangers ? serverSettings.luxuryHangerPrice : 0;
  const expressFee = addOns.expressDelivery ? serverSettings.expressTurnaroundPrice : 0;

  let discount = 0;
  if (body.couponCode) {
    const coupon = serverCoupons.find(
      c => c.code.toUpperCase() === String(body.couponCode).trim().toUpperCase() && c.isActive
    );
    if (coupon && computedSubtotal >= coupon.minOrder) {
      if (coupon.flatDiscount) discount = coupon.flatDiscount;
      else if (coupon.discountPercent) {
        const raw = Math.round((computedSubtotal * coupon.discountPercent) / 100);
        discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
      }
    }
  }

  const totalAmount = Math.max(0, computedSubtotal + deliveryCharge + starchFee + hangerFee + expressFee - discount);
  const commissionRate = serverSettings.platformCommissionPercent || 15;
  const platformCommissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const partnerNetAmount = totalAmount - platformCommissionAmount;

  const candidates = findEligiblePartnersServer({
    pincode,
    serviceType: String(body.serviceType || 'ironing_steam'),
    customerLat: body.coordinates?.lat,
    customerLng: body.coordinates?.lng,
  });

  if (candidates.length === 0) {
    return res.status(403).json({
      success: false,
      message: `No KYC-approved online partners currently available in PIN ${pincode}.`,
    });
  }

  const id = `ord_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  const orderNumber = `SS-${pincode.slice(-2)}-${crypto.randomInt(1000, 9999)}`;
  const nowIso = new Date().toISOString();
  const pickupOtp = String(crypto.randomInt(1000, 9999));
  const deliveryOtp = String(crypto.randomInt(1000, 9999));

  const newOrder: Order = {
    id,
    orderNumber,
    customerId: authoritativeCustomerId,
    customerName: String(body.customerName || auth.name).trim(),
    customerPhone: sanitizeIndianPhone(String(body.customerPhone || '')),
    customerPhoneVerified: Boolean(body.customerPhoneVerified),
    customerAddress: String(body.customerAddress || '').trim(),
    pincode,
    city: matchedArea.city,
    state: matchedArea.state,
    locality: String(body.locality || matchedArea.areaName).trim(),
    coordinates: body.coordinates || matchedArea.coordinates,
    deliveryMode,
    serviceType: String(body.serviceType || 'ironing_steam'),
    items: verifiedItems,
    addOns: {
      scentedStarch: Boolean(addOns.scentedStarch),
      luxuryHangers: Boolean(addOns.luxuryHangers),
      expressDelivery: Boolean(addOns.expressDelivery),
    },
    pickupSlot: String(body.pickupSlot || 'Today, 02:00 PM - 04:00 PM'),
    deliverySlot: body.deliverySlot ? String(body.deliverySlot) : undefined,
    estimatedPickupEta: body.estimatedPickupEta ? String(body.estimatedPickupEta) : undefined,
    estimatedDeliveryEta: body.estimatedDeliveryEta ? String(body.estimatedDeliveryEta) : undefined,
    specialInstructions: body.specialInstructions ? String(body.specialInstructions).trim() : undefined,
    couponCode: body.couponCode ? String(body.couponCode).trim() : undefined,
    subtotal: computedSubtotal,
    deliveryCharge,
    discount,
    totalAmount,
    commissionRate,
    platformCommissionAmount,
    partnerNetAmount,
    paymentMethod: body.paymentMethod === 'direct_to_partner_cash' ? 'direct_to_partner_cash' : 'direct_to_partner_upi',
    paymentStatus: 'pending_at_delivery',
    status: 'BOOKED',
    candidatePartnerQueue: candidates.map(c => c.partnerId),
    rejectedPartnerIds: [],
    currentOfferPartnerId: candidates[0]?.partnerId,
    offerExpiresAt: new Date(Date.now() + serverSettings.broadcastTimeoutSeconds * 1000).toISOString(),
    pickupOtp,
    deliveryOtp,
    garmentEvidence: {
      orderId: id,
      tagReference: `TAG-${orderNumber}`,
      expectedCount: totalGarments,
      verifiedCount: totalGarments,
      hasPreExistingDamage: false,
      damageNotes: '',
      stainChecklist: [],
      pickupPhotoUrls: [],
      deliveryPhotoUrls: [],
      customerSignOff: false,
      pickupOtp,
      pickupOtpVerified: false,
      deliveryOtp,
      deliveryOtpVerified: false,
      recordedAt: nowIso,
    },
    logs: [
      {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'BOOKED',
        note: `Order created & server-priced (₹${totalAmount}, 15% commission ₹${platformCommissionAmount}).`,
        actor: 'Server Booking Engine',
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  serverOrders.unshift(newOrder);
  if (newOrder.garmentEvidence) {
    serverEvidenceStore.set(newOrder.id, {
      ...newOrder.garmentEvidence,
      customerId: newOrder.customerId,
    });
  }
  recordServerAudit('ORDER_CREATED_SERVER', auth.role, authoritativeCustomerId, `Created ${orderNumber} ₹${totalAmount}`, 'success');
  return res.status(201).json({ success: true, order: newOrder });
});

app.post('/api/orders/accept-atomic', async (req, res) => {
  const auth = await requireRoles(req, res, ['SERVICE_PARTNER', 'SUPER_ADMIN']);
  if (!auth) return;

  const { orderId, partnerId, partnerName } = req.body || {};
  const targetPartnerId = auth.role === 'SERVICE_PARTNER' ? auth.userId : String(partnerId || '');
  if (!orderId || !targetPartnerId) {
    return res.status(400).json({ success: false, message: 'orderId and valid partner identity are required.' });
  }
  if (auth.role === 'SERVICE_PARTNER' && partnerId && partnerId !== auth.userId) {
    recordServerAudit('CROSS_PARTNER_ACCEPT_BLOCKED', 'SERVICE_PARTNER', auth.userId, `Blocked partner ${auth.userId} claiming order as ${partnerId}`, 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: you cannot accept orders on behalf of another partner.' });
  }

  const partner = serverPartners.find(p => p.id === targetPartnerId);
  if (!partner) {
    return res.status(404).json({ success: false, message: 'Partner record not found.' });
  }
  if (partner.status !== 'active' || partner.kycVerified === false || partner.commissionBlocked || !partner.isOnline) {
    return res.status(403).json({
      success: false,
      message: 'Partner account is not approved, KYC-verified, online, or cleared for commission.',
    });
  }

  const existingLock = atomicOrderLocks.get(orderId);
  if (existingLock && existingLock.partnerId !== targetPartnerId) {
    recordServerAudit('DOUBLE_ACCEPT_PREVENTED', 'SERVICE_PARTNER', targetPartnerId, `Order ${orderId} already locked by ${existingLock.partnerName}`, 'blocked');
    return res.status(409).json({
      success: false,
      message: `Order already accepted by ${existingLock.partnerName}.`,
    });
  }

  atomicOrderLocks.set(orderId, {
    partnerId: targetPartnerId,
    partnerName: partnerName || partner.name || targetPartnerId,
    lockedAt: new Date().toISOString(),
  });

  const targetOrder = serverOrders.find(o => o.id === orderId);
  if (targetOrder) {
    targetOrder.assignedPartnerId = partner.id;
    targetOrder.assignedPartnerName = partner.name;
    targetOrder.assignedPartnerPhone = partner.phone;
    targetOrder.status = 'PARTNER_ASSIGNED';
    targetOrder.acceptedAt = new Date().toISOString();
  }

  recordServerAudit('ORDER_ATOMIC_LOCK_ACQUIRED', 'SERVICE_PARTNER', partner.name, `Locked order ${orderId}`, 'success');
  return res.json({ success: true, lock: atomicOrderLocks.get(orderId) });
});

app.post('/api/orders/escalate', async (req, res) => {
  const auth = await requireRoles(req, res, ['SERVICE_PARTNER', 'SUPER_ADMIN']);
  if (!auth) return;

  const { orderId, pincode, serviceType, excludedPartnerIds = [], customerLat, customerLng } = req.body || {};
  const remaining = findEligiblePartnersServer({
    pincode: String(pincode || ''),
    serviceType: String(serviceType || ''),
    customerLat,
    customerLng,
    excludedPartnerIds,
  });

  recordServerAudit(
    'ORDER_DISPATCH_ESCALATION',
    auth.role,
    orderId || auth.userId,
    `Next candidate count: ${remaining.length} after excluding ${excludedPartnerIds.length} partner(s).`,
    remaining.length > 0 ? 'success' : 'warning'
  );

  return res.json({
    success: true,
    nextPartner: remaining[0] || null,
    remainingQueue: remaining,
  });
});

app.post('/api/orders/:id/status', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;
  const { nextStatus, reason } = req.body || {};
  const order = serverOrders.find(o => o.id === id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  const canonicalNew = normalizeOrderStatus(nextStatus);
  const currentCanonical = normalizeOrderStatus(order.status);

  if (auth.role === 'CUSTOMER') {
    if (order.customerId !== auth.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: you can only manage your own orders.' });
    }
    if (canonicalNew !== 'CANCELLED' || !['BOOKED', 'PARTNER_ASSIGNED', 'PICKUP_SCHEDULED'].includes(currentCanonical)) {
      return res.status(403).json({ success: false, message: 'Forbidden: customers can only cancel orders prior to pickup.' });
    }
  } else if (auth.role === 'SERVICE_PARTNER') {
    if (order.assignedPartnerId !== auth.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: only the assigned partner can update this order.' });
    }
    const allowedPartnerStatuses = new Set([
      'PICKUP_SCHEDULED',
      'PICKED_UP',
      'PROCESSING',
      'READY_FOR_DELIVERY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
    if (!allowedPartnerStatuses.has(canonicalNew)) {
      return res.status(403).json({ success: false, message: 'Forbidden status transition for Service Partner.' });
    }
  }

  order.status = canonicalNew;
  order.updatedAt = new Date().toISOString();
  if (reason) order.cancellationReason = String(reason);
  if (canonicalNew === 'DELIVERED') {
    order.deliveredAt = order.updatedAt;
    order.paymentStatus = 'paid_to_partner';
  }

  recordServerAudit('ORDER_STATUS_UPDATED', auth.role, auth.email || auth.userId, `${order.orderNumber} -> ${canonicalNew}`, 'success');
  return res.json({ success: true, order });
});

// ==================== ADMIN OVERVIEW & SETTINGS (SUPER_ADMIN ONLY) ====================

app.get('/api/admin/overview', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;
  return res.json({
    success: true,
    metrics: {
      totalCustomers: serverCustomers.length,
      totalPartners: serverPartners.length,
      pendingPartners: serverPartners.filter(p => p.status === 'pending').length,
      activePartners: serverPartners.filter(p => p.status === 'active').length,
      totalOrders: serverOrders.length,
      openDisputes: Array.from(serverDisputesStore.values()).filter(
        d => !['RESOLVED', 'REJECTED_WITH_REASON', 'CLOSED'].includes(normalizeDisputeStatus(d.status))
      ).length,
    },
    customers: serverCustomers.map(sanitizeCustomerDto),
    partners: serverPartners.map(sanitizePartnerDto),
    orders: serverOrders,
    commissionLedger: serverCommissionLedger,
    remittances: serverRemittances,
  });
});

app.put('/api/admin/settings', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const { platformSettings, businessSettings, legalPolicies } = req.body || {};
  if (platformSettings && typeof platformSettings === 'object') {
    serverSettings = { ...serverSettings, ...platformSettings };
  }
  if (businessSettings && typeof businessSettings === 'object') {
    serverBusinessSettings = { ...serverBusinessSettings, ...businessSettings };
  }
  if (legalPolicies && typeof legalPolicies === 'object') {
    serverLegalPolicies = { ...serverLegalPolicies, ...legalPolicies };
  }
  recordServerAudit('ADMIN_SETTINGS_UPDATED', 'SUPER_ADMIN', admin.email, 'Updated platform/business/legal settings.', 'success');
  return res.json({
    success: true,
    settings: serverSettings,
    businessSettings: serverBusinessSettings,
    legalPolicies: serverLegalPolicies,
  });
});

// ==================== ORDER EVIDENCE & GARMENT PROTECTION ====================

app.get('/api/evidence/:orderId', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { orderId } = req.params;
  const order = serverOrders.find(o => o.id === orderId);
  const evidence = serverEvidenceStore.get(orderId);
  if (!order && !evidence) {
    return res.status(404).json({ success: false, message: 'Order evidence record not found.' });
  }

  const ownerCustomerId = evidence?.customerId || order?.customerId;
  const ownerPartnerId = evidence?.partnerId || order?.assignedPartnerId;

  const isAuthorized =
    auth.role === 'SUPER_ADMIN' ||
    (auth.role === 'CUSTOMER' && auth.userId === ownerCustomerId) ||
    (auth.role === 'SERVICE_PARTNER' && auth.userId === ownerPartnerId);

  if (!isAuthorized) {
    recordServerAudit(
      'UNAUTHORIZED_EVIDENCE_ACCESS',
      auth.role,
      auth.userId,
      `Blocked unauthorized read of evidence for order ${orderId}.`,
      'blocked'
    );
    return res.status(403).json({
      success: false,
      message: 'Access denied: evidence is restricted to the order customer, assigned partner, or authorized Super Admin.',
    });
  }

  return res.json({ success: true, evidence: evidence || order?.garmentEvidence || null });
});

app.post('/api/evidence/record', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { orderId, updates } = req.body || {};
  if (!orderId || !updates) {
    return res.status(400).json({ success: false, message: 'orderId and updates are required.' });
  }

  const order = serverOrders.find(o => o.id === orderId);
  const existing = serverEvidenceStore.get(orderId);
  const ownerCustomerId = existing?.customerId || order?.customerId;
  const ownerPartnerId = existing?.partnerId || order?.assignedPartnerId;

  const isPartner = auth.role === 'SERVICE_PARTNER' && auth.userId === ownerPartnerId;
  const isCustomer = auth.role === 'CUSTOMER' && auth.userId === ownerCustomerId;
  const isAdmin = auth.role === 'SUPER_ADMIN';

  if (!isAdmin && !isPartner && !isCustomer) {
    recordServerAudit('UNAUTHORIZED_EVIDENCE_WRITE', auth.role, auth.userId, `Blocked write to evidence ${orderId}.`, 'blocked');
    return res.status(403).json({
      success: false,
      message: 'Forbidden: only the assigned partner, ordering customer, or Super Admin may modify evidence.',
    });
  }

  if (isCustomer && !isAdmin) {
    const allowedCustomerKeys = new Set([
      'customerSignOff',
      'customerSignedAt',
      'deliveryConfirmedByCustomer',
      'deliveryConfirmedAt',
      'customerInstructions',
    ]);
    for (const key of Object.keys(updates)) {
      if (!allowedCustomerKeys.has(key)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: customers cannot modify partner inspection field "${key}".`,
        });
      }
    }
  }

  const nowIso = new Date().toISOString();
  const base: GarmentEvidence & { customerId: string; partnerId?: string } = existing || {
    orderId,
    customerId: ownerCustomerId || auth.userId,
    partnerId: ownerPartnerId,
    tagReference: `TAG-${order?.orderNumber || orderId}`,
    expectedCount: order?.items?.reduce((s, i) => s + i.quantity, 0) || 1,
    verifiedCount: order?.items?.reduce((s, i) => s + i.quantity, 0) || 1,
    hasPreExistingDamage: false,
    damageNotes: '',
    stainChecklist: [],
    pickupPhotoUrls: [],
    beforeServicePhotoUrls: [],
    afterServicePhotoUrls: [],
    deliveryPhotoUrls: [],
    customerSignOff: false,
    pickupOtpVerified: false,
    deliveryOtpVerified: false,
    recordedAt: nowIso,
  };

  const merged = {
    ...base,
    ...updates,
    customerId: base.customerId,
    partnerId: ownerPartnerId || base.partnerId,
    updatedAt: nowIso,
  };
  serverEvidenceStore.set(orderId, merged);

  recordServerAudit(
    'EVIDENCE_RECORD_UPDATED',
    auth.role,
    auth.email || auth.userId,
    `Updated evidence for ${orderId}.`,
    'success'
  );

  return res.json({ success: true, evidence: merged });
});

// ==================== CUSTOMER PROTECTION & DISPUTES API ====================

app.get('/api/disputes', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const allDisputes = Array.from(serverDisputesStore.values());
  if (auth.role === 'SUPER_ADMIN') {
    return res.json({
      success: true,
      disputes: allDisputes,
      compensations: Array.from(serverCompensationStore.values()),
      auditTrail: disputeAuditTrailStore,
    });
  }

  if (auth.role === 'CUSTOMER') {
    return res.json({
      success: true,
      disputes: allDisputes.filter(d => d.customerId === auth.userId),
    });
  }

  if (auth.role === 'SERVICE_PARTNER') {
    return res.json({
      success: true,
      disputes: allDisputes.filter(d => d.partnerId === auth.userId),
    });
  }

  return res.status(403).json({ success: false, message: 'Forbidden.' });
});

app.post('/api/disputes', async (req, res) => {
  const auth = await requireRoles(req, res, ['CUSTOMER', 'SUPER_ADMIN']);
  if (!auth) return;

  const {
    id,
    orderId,
    orderNumber,
    category,
    affectedGarmentDetails,
    affectedQuantity,
    description,
    requestedResolution,
    requestedAmountInr,
    customerPhotoUrls = [],
    supportingDocUrls = [],
    evidenceUnavailableNote,
  } = req.body || {};

  if (!orderId || !description || String(description).trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Order ID and a description (min 5 chars) are required.',
    });
  }

  const order = serverOrders.find(o => o.id === orderId);
  if (!order && auth.role !== 'SUPER_ADMIN') {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  if (auth.role === 'CUSTOMER' && order && order.customerId !== auth.userId) {
    recordServerAudit('DISPUTE_IDENTITY_SPOOF_BLOCKED', 'CUSTOMER', auth.userId, `Blocked dispute filing on ${orderId} belonging to ${order.customerId}.`, 'blocked');
    return res.status(403).json({
      success: false,
      message: 'Forbidden: you can only file damage or missing garment claims for your own orders.',
    });
  }

  const authoritativeCustomerId = order?.customerId || auth.userId;
  const nowIso = new Date().toISOString();
  const disputeId = id || `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const auditEntry: DisputeAuditEntry = {
    id: `da_${Date.now()}`,
    timestamp: nowIso,
    actorRole: 'CUSTOMER',
    actorName: order?.customerName || auth.name,
    action: 'CLAIM_SUBMITTED',
    toStatus: 'CLAIM_SUBMITTED',
    note: `Submitted ${category || 'quality_issue'} claim${Array.isArray(customerPhotoUrls) && customerPhotoUrls.length === 0 ? ' (no photo uploaded — fairness protection ensures full review)' : ''}.`,
  };

  const dispute: OrderDispute = {
    id: disputeId,
    orderId,
    orderNumber: orderNumber || order?.orderNumber || orderId,
    customerId: authoritativeCustomerId,
    customerName: order?.customerName || auth.name,
    partnerId: order?.assignedPartnerId || 'unassigned',
    partnerName: order?.assignedPartnerName || 'Unassigned Partner',
    category: category || 'damaged_garment',
    affectedGarmentDetails: affectedGarmentDetails ? String(affectedGarmentDetails).trim() : undefined,
    affectedQuantity: affectedQuantity ? Number(affectedQuantity) : 1,
    description: String(description).trim(),
    requestedResolution: requestedResolution || 'partial_refund',
    requestedAmountInr: typeof requestedAmountInr === 'number' && requestedAmountInr >= 0 ? requestedAmountInr : undefined,
    customerPhotoUrls: Array.isArray(customerPhotoUrls) ? customerPhotoUrls : [],
    supportingDocUrls: Array.isArray(supportingDocUrls) ? supportingDocUrls : [],
    evidenceUnavailableNote: evidenceUnavailableNote ? String(evidenceUnavailableNote).trim() : undefined,
    status: 'CLAIM_SUBMITTED',
    credibilityAssessment: 'pending_review',
    adminQuestions: [],
    auditTrail: [auditEntry],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  serverDisputesStore.set(dispute.id, dispute);
  disputeAuditTrailStore.unshift(auditEntry);
  recordServerAudit('DISPUTE_CLAIM_SUBMITTED', 'CUSTOMER', dispute.customerName, `Claim ${dispute.id} on ${dispute.orderNumber}.`, 'warning');

  return res.status(201).json({ success: true, dispute });
});

app.post('/api/disputes/:id/partner-response', async (req, res) => {
  const auth = await requireRoles(req, res, ['SERVICE_PARTNER', 'SUPER_ADMIN']);
  if (!auth) return;

  const { id } = req.params;
  const {
    partnerResponse,
    preExistingDamageReported,
    preExistingNotes,
    partnerPickupPhotoUrls = [],
    partnerServicePhotoUrls = [],
    partnerDeliveryPhotoUrls = [],
    questionAnswers = {},
  } = req.body || {};

  const dispute = serverDisputesStore.get(id);
  if (!dispute) {
    return res.status(404).json({ success: false, message: 'Dispute claim not found.' });
  }
  if (auth.role !== 'SUPER_ADMIN' && dispute.partnerId !== auth.userId) {
    recordServerAudit('UNAUTHORIZED_PARTNER_DISPUTE_RESPONSE', 'SERVICE_PARTNER', auth.userId, `Blocked response attempt on dispute ${id}.`, 'blocked');
    return res.status(403).json({ success: false, message: 'Forbidden: you can only respond to claims linked to your own orders.' });
  }
  if (!partnerResponse || !String(partnerResponse).trim()) {
    return res.status(400).json({ success: false, message: 'Partner explanation text is required.' });
  }

  const nowIso = new Date().toISOString();
  const prevStatus = normalizeDisputeStatus(dispute.status);
  const updatedQuestions: DisputeQuestion[] = (dispute.adminQuestions || []).map(q =>
    q.targetRole === 'partner' && questionAnswers[q.id]
      ? { ...q, answer: String(questionAnswers[q.id]).trim(), answeredAt: nowIso }
      : q
  );

  const auditEntry: DisputeAuditEntry = {
    id: `da_${Date.now()}`,
    timestamp: nowIso,
    actorRole: 'SERVICE_PARTNER',
    actorName: dispute.partnerName,
    action: 'PARTNER_EVIDENCE_SUBMITTED',
    fromStatus: prevStatus,
    toStatus: 'EVIDENCE_REVIEW',
    note: `Partner submitted response${preExistingDamageReported ? ' + pre-existing damage evidence' : ''}.`,
  };

  const updated: OrderDispute = {
    ...dispute,
    partnerResponse: String(partnerResponse).trim(),
    partnerPreExistingDamageReported: Boolean(preExistingDamageReported),
    partnerPreExistingNotes: preExistingNotes ? String(preExistingNotes).trim() : dispute.partnerPreExistingNotes,
    partnerPickupPhotoUrls: [...(dispute.partnerPickupPhotoUrls || []), ...partnerPickupPhotoUrls],
    partnerServicePhotoUrls: [...(dispute.partnerServicePhotoUrls || []), ...partnerServicePhotoUrls],
    partnerDeliveryPhotoUrls: [...(dispute.partnerDeliveryPhotoUrls || []), ...partnerDeliveryPhotoUrls],
    partnerPhotoUrls: [
      ...(dispute.partnerPhotoUrls || []),
      ...partnerPickupPhotoUrls,
      ...partnerServicePhotoUrls,
      ...partnerDeliveryPhotoUrls,
    ],
    partnerRespondedAt: nowIso,
    adminQuestions: updatedQuestions,
    status: 'EVIDENCE_REVIEW',
    auditTrail: [...(dispute.auditTrail || []), auditEntry],
    updatedAt: nowIso,
  };

  serverDisputesStore.set(id, updated);
  disputeAuditTrailStore.unshift(auditEntry);
  recordServerAudit('DISPUTE_PARTNER_RESPONDED', 'SERVICE_PARTNER', dispute.partnerName, `Responded to claim ${id}.`, 'success');

  return res.json({ success: true, dispute: updated });
});

app.post('/api/disputes/:id/customer-followup', async (req, res) => {
  const auth = await requireRoles(req, res, ['CUSTOMER', 'SUPER_ADMIN']);
  if (!auth) return;

  const { id } = req.params;
  const { followUpNote, photoUrls = [], questionAnswers = {} } = req.body || {};

  const dispute = serverDisputesStore.get(id);
  if (!dispute) return res.status(404).json({ success: false, message: 'Dispute claim not found.' });
  if (auth.role !== 'SUPER_ADMIN' && dispute.customerId !== auth.userId) {
    return res.status(403).json({ success: false, message: 'Forbidden: only the claim owner customer may submit follow-up information.' });
  }

  const nowIso = new Date().toISOString();
  const prevStatus = normalizeDisputeStatus(dispute.status);
  const updatedQuestions: DisputeQuestion[] = (dispute.adminQuestions || []).map(q =>
    q.targetRole === 'customer' && questionAnswers[q.id]
      ? { ...q, answer: String(questionAnswers[q.id]).trim(), answeredAt: nowIso }
      : q
  );

  const auditEntry: DisputeAuditEntry = {
    id: `da_${Date.now()}`,
    timestamp: nowIso,
    actorRole: 'CUSTOMER',
    actorName: dispute.customerName,
    action: 'CUSTOMER_FOLLOWUP_SUBMITTED',
    fromStatus: prevStatus,
    toStatus: 'EVIDENCE_REVIEW',
    note: followUpNote ? String(followUpNote).trim() : 'Customer answered Admin verification questions.',
  };

  const updated: OrderDispute = {
    ...dispute,
    customerFollowUpNote: followUpNote ? String(followUpNote).trim() : dispute.customerFollowUpNote,
    customerPhotoUrls: [...(dispute.customerPhotoUrls || []), ...photoUrls],
    adminQuestions: updatedQuestions,
    status: 'EVIDENCE_REVIEW',
    auditTrail: [...(dispute.auditTrail || []), auditEntry],
    updatedAt: nowIso,
  };

  serverDisputesStore.set(id, updated);
  disputeAuditTrailStore.unshift(auditEntry);
  return res.json({ success: true, dispute: updated });
});

app.post('/api/disputes/:id/admin-action', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const { id } = req.params;
  const dispute = serverDisputesStore.get(id);
  if (!dispute) {
    return res.status(404).json({ success: false, message: 'Dispute claim not found.' });
  }

  const {
    nextStatus,
    investigationFindings,
    credibilityAssessment,
    adminDecision,
    decisionReason,
    contractualBasis,
    requestQuestion,
    compensation,
    restrictPartnerAccount,
    partnerRestrictionReason,
    urgentProtectiveAction,
  } = req.body || {};

  const targetStatus: CanonicalDisputeStatus = normalizeDisputeStatus(nextStatus || dispute.status);

  if (
    ['RESOLUTION_PROPOSED', 'RESOLVED', 'REJECTED_WITH_REASON', 'CLOSED'].includes(targetStatus) &&
    (!decisionReason || !String(decisionReason).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: 'Fairness Policy: A written decision reason is mandatory before resolving, proposing, rejecting, or closing a claim.',
    });
  }

  if (
    targetStatus === 'REJECTED_WITH_REASON' &&
    dispute.customerPhotoUrls.length === 0 &&
    (!investigationFindings || String(investigationFindings).trim().length < 10)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Fairness Policy: Claims without photos cannot be rejected without documented investigation findings.',
    });
  }

  if (restrictPartnerAccount) {
    if (!urgentProtectiveAction && (!investigationFindings || !contractualBasis || !partnerRestrictionReason)) {
      return res.status(400).json({
        success: false,
        message: 'Fairness Policy: Account restriction requires documented investigation findings, contractual basis, and restriction notice.',
      });
    }
  }

  const nowIso = new Date().toISOString();
  const prevStatus = normalizeDisputeStatus(dispute.status);

  const updatedQuestions: DisputeQuestion[] = [...(dispute.adminQuestions || [])];
  if (requestQuestion && requestQuestion.question && requestQuestion.targetRole) {
    updatedQuestions.push({
      id: `dq_${Date.now()}`,
      targetRole: requestQuestion.targetRole === 'customer' ? 'customer' : 'partner',
      question: String(requestQuestion.question).trim(),
      askedBy: admin.email || 'Ronak (Admin)',
      askedAt: nowIso,
    });
  }

  let compensationRecord: CompensationRecord | undefined = dispute.compensationRecord;
  if (compensation && typeof compensation.approvedAmountInr === 'number') {
    const compAmount = Number(compensation.approvedAmountInr);
    if (compAmount < 0 || !Number.isFinite(compAmount)) {
      return res.status(400).json({ success: false, message: 'Approved compensation amount must be a valid non-negative number.' });
    }
    if (compAmount > 0 && (!compensation.valuationBasis || !String(compensation.valuationBasis).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Fairness Policy: Monetary compensation requires an explicit valuation basis.',
      });
    }

    compensationRecord = {
      id: compensationRecord?.id || `comp_${Date.now()}`,
      disputeId: dispute.id,
      orderId: dispute.orderId,
      orderNumber: dispute.orderNumber,
      compensationType: compensation.compensationType || 'partial_refund',
      responsibleParty: compensation.responsibleParty || 'partner',
      approvedAmountInr: compAmount,
      valuationBasis: String(compensation.valuationBasis || 'Admin reviewed adjustment').trim(),
      reason: String(decisionReason || compensation.reason || '').trim(),
      contractualBasis: String(contractualBasis || 'SHAH SIGNATURE Fair Garment Care Policy Clause 4').trim(),
      paymentResponsibility: compensation.paymentResponsibility || 'partner_direct_settlement',
      settlementStatus: compensation.settlementStatus || (targetStatus === 'RESOLVED' ? 'approved_pending_payout' : 'proposed'),
      deductedFromCommission: false,
      approvedBy: admin.email || 'Ronak',
      approvedAt: nowIso,
      settledAt: compensation.settlementStatus === 'settled' ? nowIso : undefined,
      settlementReference: compensation.settlementReference,
    };
    serverCompensationStore.set(compensationRecord.id, compensationRecord);
  }

  const auditEntry: DisputeAuditEntry = {
    id: `da_${Date.now()}`,
    timestamp: nowIso,
    actorRole: 'SUPER_ADMIN',
    actorName: admin.email || 'Ronak (Super Admin)',
    action: `ADMIN_${targetStatus}`,
    fromStatus: prevStatus,
    toStatus: targetStatus,
    note: `${decisionReason || investigationFindings || 'Status updated by Admin'}${compensationRecord ? ` | Compensation ₹${compensationRecord.approvedAmountInr}` : ''}`,
  };

  const updated: OrderDispute = {
    ...dispute,
    status: targetStatus,
    investigationFindings: investigationFindings ? String(investigationFindings).trim() : dispute.investigationFindings,
    credibilityAssessment: credibilityAssessment || dispute.credibilityAssessment,
    adminDecision: adminDecision || dispute.adminDecision,
    decisionReason: decisionReason ? String(decisionReason).trim() : dispute.decisionReason,
    contractualBasis: contractualBasis ? String(contractualBasis).trim() : dispute.contractualBasis,
    resolutionNote: decisionReason ? String(decisionReason).trim() : dispute.resolutionNote,
    adminQuestions: updatedQuestions,
    compensationId: compensationRecord?.id || dispute.compensationId,
    compensationRecord,
    partnerRestrictionApplied: Boolean(restrictPartnerAccount) || dispute.partnerRestrictionApplied,
    partnerRestrictionReason: partnerRestrictionReason || dispute.partnerRestrictionReason,
    secondReviewDecision: prevStatus === 'APPEAL_REQUESTED' ? String(decisionReason || '').trim() : dispute.secondReviewDecision,
    auditTrail: [...(dispute.auditTrail || []), auditEntry],
    resolvedAt: targetStatus === 'RESOLVED' || targetStatus === 'REJECTED_WITH_REASON' ? nowIso : dispute.resolvedAt,
    closedAt: targetStatus === 'CLOSED' ? nowIso : dispute.closedAt,
    updatedAt: nowIso,
  };

  serverDisputesStore.set(id, updated);
  disputeAuditTrailStore.unshift(auditEntry);
  recordServerAudit('DISPUTE_ADMIN_RULING', 'SUPER_ADMIN', admin.email || 'Ronak', `Claim ${id} -> ${targetStatus}`, 'success');

  return res.json({ success: true, dispute: updated, compensationRecord });
});

app.post('/api/disputes/:id/appeal', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;
  const { appealNote } = req.body || {};

  const dispute = serverDisputesStore.get(id);
  if (!dispute) return res.status(404).json({ success: false, message: 'Dispute claim not found.' });

  const isCust = auth.role === 'CUSTOMER' && auth.userId === dispute.customerId;
  const isPart = auth.role === 'SERVICE_PARTNER' && auth.userId === dispute.partnerId;

  if (!isCust && !isPart && auth.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Forbidden: only the order customer or partner may submit an appeal.' });
  }

  const currentStatus = normalizeDisputeStatus(dispute.status);
  if (currentStatus !== 'RESOLVED' && currentStatus !== 'REJECTED_WITH_REASON') {
    return res.status(400).json({
      success: false,
      message: `Appeals can only be submitted after a RESOLVED or REJECTED_WITH_REASON decision (current: ${currentStatus}).`,
    });
  }

  if (!appealNote || String(appealNote).trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Please provide a clear appeal reason (min 5 characters).' });
  }

  const nowIso = new Date().toISOString();
  const submitter = isPart ? 'partner' : 'customer';
  const auditEntry: DisputeAuditEntry = {
    id: `da_${Date.now()}`,
    timestamp: nowIso,
    actorRole: isPart ? 'SERVICE_PARTNER' : 'CUSTOMER',
    actorName: isPart ? dispute.partnerName : dispute.customerName,
    action: 'APPEAL_REQUESTED',
    fromStatus: currentStatus,
    toStatus: 'APPEAL_REQUESTED',
    note: String(appealNote).trim(),
  };

  const updated: OrderDispute = {
    ...dispute,
    status: 'APPEAL_REQUESTED',
    appealNote: String(appealNote).trim(),
    appealSubmittedBy: submitter,
    appealedAt: nowIso,
    auditTrail: [...(dispute.auditTrail || []), auditEntry],
    updatedAt: nowIso,
  };

  serverDisputesStore.set(id, updated);
  disputeAuditTrailStore.unshift(auditEntry);
  recordServerAudit('DISPUTE_APPEAL_FILED', auditEntry.actorRole, auditEntry.actorName, `Appeal on claim ${id}`, 'warning');

  return res.json({ success: true, dispute: updated });
});

app.get('/api/compensation', async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const allComp = Array.from(serverCompensationStore.values());
  if (auth.role === 'SUPER_ADMIN') {
    return res.json({ success: true, records: allComp });
  }

  const allowedDisputeIds = new Set(
    Array.from(serverDisputesStore.values())
      .filter(d => (auth.role === 'CUSTOMER' ? d.customerId === auth.userId : d.partnerId === auth.userId))
      .map(d => d.id)
  );
  return res.json({
    success: true,
    records: allComp.filter(c => allowedDisputeIds.has(c.disputeId)),
  });
});

// ==================== COMMISSION REMITTANCE SECURITY ====================

app.get('/api/remittances', async (req, res) => {
  const auth = await requireRoles(req, res, ['SUPER_ADMIN', 'SERVICE_PARTNER']);
  if (!auth) return;

  const list =
    auth.role === 'SUPER_ADMIN'
      ? serverRemittances
      : serverRemittances.filter(r => r.partnerId === auth.userId);
  return res.json({ success: true, remittances: list });
});

app.post('/api/remittances', async (req, res) => {
  const auth = await requireRoles(req, res, ['SERVICE_PARTNER']);
  if (!auth) return;

  const { weekKey, ledgerEntryIds, amountSubmitted, utrReference, paymentMode, proofFileName, notes } = req.body || {};
  if (!Array.isArray(ledgerEntryIds) || ledgerEntryIds.length === 0 || !utrReference || !amountSubmitted) {
    return res.status(400).json({ success: false, message: 'Valid ledgerEntryIds, amountSubmitted, and UTR reference required.' });
  }

  const partner = serverPartners.find(p => p.id === auth.userId);
  const remittance: CommissionRemittance = {
    id: `rem_${Date.now()}`,
    partnerId: auth.userId,
    partnerName: partner?.name || auth.name,
    weekKey: String(weekKey || '2026-W46'),
    ledgerEntryIds,
    amountDue: Number(amountSubmitted),
    amountSubmitted: Number(amountSubmitted),
    utrReference: String(utrReference).trim(),
    paymentMode: paymentMode || 'UPI',
    proofFileName,
    notes,
    status: 'pending_verification',
    submittedAt: new Date().toISOString(),
  };
  serverRemittances.unshift(remittance);
  recordServerAudit('COMMISSION_UTR_SUBMITTED', 'SERVICE_PARTNER', auth.userId, `UTR ${remittance.utrReference}`, 'warning');
  return res.status(201).json({ success: true, remittance });
});

app.post('/api/remittances/:id/verify', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const { id } = req.params;
  const { decision, adminNotes } = req.body || {};
  if (decision !== 'verified' && decision !== 'rejected') {
    return res.status(400).json({ success: false, message: 'Decision must be verified or rejected.' });
  }

  const target = serverRemittances.find(r => r.id === id);
  if (target) {
    target.status = decision;
    target.adminNotes = adminNotes;
    target.verifiedAt = new Date().toISOString();
    target.verifiedBy = admin.email;
  }

  recordServerAudit('COMMISSION_VERIFICATION', 'SUPER_ADMIN', admin.email, `Remittance ${id} -> ${decision}`, 'success');
  return res.json({ success: true, remittance: target || null });
});

// ==================== SYSTEM STATUS & GATEWAY DIAGNOSTICS ====================

app.get('/api/system/status', (_req, res) => {
  return res.json({
    brand: 'SHAH SIGNATURE',
    owner: 'Ronak',
    phone: '9899229102',
    email: 'shahsignature@gmail.com',
    primaryServiceArea: 'PIN 110086, Delhi (Pan-India Dynamic PIN Engine Ready)',
    activeServiceAreasCount: serverServiceAreas.filter(a => a.isActive).length,
    tagline: 'ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST.',
    firebaseAdminSdkReady: isRealAdminSdkReady,
    gateways: {
      smsOtpCarrier: gatewayStatus.smsGatewayConfigured ? 'Configured' : 'NOT_CONFIGURED (Requires MSG91_AUTH_KEY or Twilio)',
      whatsappBusinessApi: gatewayStatus.whatsappCloudApiConfigured ? 'Configured' : 'NOT_CONFIGURED (Deep-link wa.me active; automated Cloud API requires WHATSAPP_CLOUD_TOKEN)',
      emailSmtpApi: gatewayStatus.emailGatewayConfigured ? 'Configured' : 'NOT_CONFIGURED (Requires SMTP_HOST or RESEND_API_KEY)',
      firebaseAdminSdk: isRealAdminSdkReady ? 'Configured' : 'NOT_CONFIGURED (Requires FIREBASE_SERVICE_ACCOUNT)',
    },
    recentAuditLogs: [], // Never expose internal security logs unauthenticated
  });
});

app.get('/api/admin/audit-logs', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;
  return res.json({ success: true, logs: serverAuditLogs.slice(0, 50) });
});

app.post('/api/notifications/test', async (req, res) => {
  const admin = await requireRoles(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const { type = 'whatsapp', recipient } = req.body || {};
  const kind = String(type).toLowerCase();

  if (kind === 'whatsapp' && !gatewayStatus.whatsappCloudApiConfigured) {
    recordServerAudit('NOTIFICATION_NOT_CONFIGURED', 'SYSTEM', recipient || 'None', 'WhatsApp Cloud API token not configured.', 'warning');
    return res.status(503).json({
      success: false,
      configured: false,
      message: 'WhatsApp Business Cloud API is NOT CONFIGURED (WHATSAPP_CLOUD_TOKEN missing). Manual wa.me links remain available without automated server push.',
    });
  }

  if (kind === 'email' && !gatewayStatus.emailGatewayConfigured) {
    recordServerAudit('NOTIFICATION_NOT_CONFIGURED', 'SYSTEM', recipient || 'None', 'Email SMTP/Resend key not configured.', 'warning');
    return res.status(503).json({
      success: false,
      configured: false,
      message: 'Transactional Email gateway is NOT CONFIGURED (SMTP_HOST / RESEND_API_KEY missing).',
    });
  }

  if (kind === 'sms' && !gatewayStatus.smsGatewayConfigured) {
    return res.status(503).json({
      success: false,
      configured: false,
      message: 'SMS gateway is NOT CONFIGURED (MSG91_AUTH_KEY / TWILIO_ACCOUNT_SID missing).',
    });
  }

  recordServerAudit(`NOTIFICATION_${kind.toUpperCase()}_SENT`, 'SUPER_ADMIN', admin.email, 'External notification dispatched.', 'success');
  return res.json({
    success: true,
    configured: true,
    message: `${type} gateway configured and test dispatch logged.`,
  });
});

// Explicit JSON 404 for unknown /api/* routes so they never fall through to SPA HTML
app.all('/api/*', (_req, res) => {
  return res.status(404).json({ success: false, message: 'API route not found.' });
});

// ==================== VITE MIDDLEWARE & CLIENT MOUNT ====================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SHAH SIGNATURE] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
