import express from 'express';
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
} from './src/lib/firebaseAdmin';
import {
  INITIAL_GARMENTS,
  INITIAL_SERVICE_AREAS,
  INITIAL_PARTNERS,
  INITIAL_SETTINGS,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
} from './src/data/initialData';
import type {
  Partner,
  GarmentItem,
  ServiceAreaConfig,
  CouponOffer,
  PlatformSettings,
  Order,
  GarmentEvidence,
  OrderDispute,
  CompensationRecord,
  CanonicalDisputeStatus,
  DisputeAuditEntry,
  DisputeQuestion,
} from './src/types';
import { normalizeDisputeStatus } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// In-memory runtime state synchronized from admin/initial defaults for server-side validation & atomic dispatch
let serverCatalog: GarmentItem[] = [...INITIAL_GARMENTS];
let serverServiceAreas: ServiceAreaConfig[] = [...INITIAL_SERVICE_AREAS];
let serverPartners: Partner[] = [...INITIAL_PARTNERS];
let serverSettings: PlatformSettings = { ...INITIAL_SETTINGS };
let serverCoupons: CouponOffer[] = [...INITIAL_COUPONS];
let serverOrders: Order[] = [...INITIAL_ORDERS];
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

const atomicOrderLocks = new Map<string, { partnerId: string; partnerName: string; lockedAt: string }>();

const adminLoginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();
const serverAuditLogs: any[] = [];
const ADMIN_TOKEN_SECRET = process.env.ADMIN_SECRET_KEY || crypto.randomBytes(32).toString('hex');

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

function haversineDistanceKm(
  lat1?: number,
  lng1?: number,
  lat2?: number,
  lng2?: number
): number {
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

function signAdminSession(email: string): string {
  const exp = Date.now() + 24 * 3600 * 1000;
  const payload = `${email}.${exp}`;
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifyAdminBearerToken(authHeader?: string): { valid: boolean; email?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('hex');
    if (parts[1] !== expectedSig) return { valid: false };
    const lastDot = payload.lastIndexOf('.');
    const email = payload.slice(0, lastDot);
    const exp = Number(payload.slice(lastDot + 1));
    if (!Number.isFinite(exp) || Date.now() > exp) return { valid: false };
    return { valid: true, email };
  } catch {
    return { valid: false };
  }
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
        phone: p.phone,
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
  const { usernameOrEmail, password } = req.body;
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

  const cleanInput = (usernameOrEmail || '').trim().toLowerCase();
  const isAuthorizedIdentity =
    cleanInput === 'ronak_admin' ||
    cleanInput === 'shahsignature@gmail.com' ||
    cleanInput === 'chinku.s1006@gmail.com';

  const validAdminSecret = process.env.ADMIN_SECRET_KEY || 'Ronak@ShahSignature2026';

  if (!isAuthorizedIdentity || password !== validAdminSecret) {
    tracker.attempts += 1;
    if (tracker.attempts >= 5) {
      tracker.lockedUntil = now + 15 * 60 * 1000;
    }
    adminLoginAttempts.set(ipKey, tracker);

    recordServerAudit('UNAUTHORIZED_ADMIN_LOGIN_ATTEMPT', 'SUPER_ADMIN', cleanInput, `Failed attempt ${tracker.attempts}/5.`, 'blocked');
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Super Admin credentials.',
    });
  }

  adminLoginAttempts.delete(ipKey);
  const adminToken = signAdminSession(cleanInput);
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

// ==================== MARKETPLACE CONFIG SYNC & AVAILABILITY ====================

app.post('/api/marketplace/sync-config', (req, res) => {
  const { garments, serviceAreas, partners, settings, coupons, orders } = req.body || {};
  if (Array.isArray(garments) && garments.length > 0) serverCatalog = garments;
  if (Array.isArray(serviceAreas) && serviceAreas.length > 0) serverServiceAreas = serviceAreas;
  if (Array.isArray(partners) && partners.length > 0) serverPartners = partners;
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

// ==================== ORDERS & SMART PARTNER DISPATCH ====================

app.post('/api/orders/validate-booking', (req, res) => {
  const {
    customerId,
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
  } = req.body;

  const activeAreas = serverServiceAreas.filter(a => a.isActive);
  const matchedArea = activeAreas.find(a => a.pincode === String(pincode || '').trim());
  const eligiblePartners = findEligiblePartnersServer({
    pincode: String(pincode || ''),
    serviceType,
    customerLat,
    customerLng,
  });

  // Authoritative server-side price & commission calculation
  let computedSubtotal = 0;
  let totalGarments = 0;
  for (const line of Array.isArray(items) ? items : []) {
    const catalogItem = serverCatalog.find(g => g.id === line.garmentId);
    const qty = Math.max(0, Number(line.quantity || 0));
    const unitPrice = catalogItem ? catalogItem.price : Number(line.unitPrice || 0);
    computedSubtotal += unitPrice * qty;
    totalGarments += qty;
  }

  if (computedSubtotal === 0 && Number(req.body.totalEstimatedAmount) > 0) {
    computedSubtotal = Number(req.body.totalEstimatedAmount);
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
    customerId,
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
    recordServerAudit('BOOKING_REJECTED_SERVER', 'CUSTOMER', customerPhone || customerId, result.reason || 'Validation failed', 'warning');
    return res.status(403).json({ success: false, message: result.reason });
  }

  const pickupOtp = String(crypto.randomInt(1000, 9999));
  const deliveryOtp = String(crypto.randomInt(1000, 9999));

  recordServerAudit(
    'BOOKING_APPROVED_SERVER',
    'CUSTOMER',
    customerPhone,
    `Verified order for PIN ${pincode} (${totalGarments || itemCount} garments, ₹${totalAmount}, 15% commission ₹${platformCommissionAmount}).`,
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

app.post('/api/orders/accept-atomic', (req, res) => {
  const { orderId, partnerId, partnerName } = req.body || {};
  if (!orderId || !partnerId) {
    return res.status(400).json({ success: false, message: 'orderId and partnerId are required.' });
  }

  const partner = serverPartners.find(p => p.id === partnerId);
  if (partner && (partner.status !== 'active' || partner.commissionBlocked || !partner.isOnline)) {
    return res.status(403).json({
      success: false,
      message: 'Partner account is not active, online, or cleared for commission.',
    });
  }

  const existingLock = atomicOrderLocks.get(orderId);
  if (existingLock && existingLock.partnerId !== partnerId) {
    recordServerAudit('DOUBLE_ACCEPT_PREVENTED', 'SERVICE_PARTNER', partnerId, `Order ${orderId} already locked by ${existingLock.partnerName}`, 'blocked');
    return res.status(409).json({
      success: false,
      message: `Order already accepted by ${existingLock.partnerName}.`,
    });
  }

  atomicOrderLocks.set(orderId, {
    partnerId,
    partnerName: partnerName || partner?.name || partnerId,
    lockedAt: new Date().toISOString(),
  });

  recordServerAudit('ORDER_ATOMIC_LOCK_ACQUIRED', 'SERVICE_PARTNER', partnerName || partnerId, `Locked order ${orderId}`, 'success');
  return res.json({ success: true, lock: atomicOrderLocks.get(orderId) });
});

app.post('/api/orders/escalate', (req, res) => {
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
    'SYSTEM',
    orderId || 'Dispatch',
    `Next candidate count: ${remaining.length} after excluding ${excludedPartnerIds.length} partner(s).`,
    remaining.length > 0 ? 'success' : 'warning'
  );

  return res.json({
    success: true,
    nextPartner: remaining[0] || null,
    remainingQueue: remaining,
  });
});

// ==================== ORDER EVIDENCE & GARMENT PROTECTION ====================

app.get('/api/evidence/:orderId', (req, res) => {
  const { orderId } = req.params;
  const viewerRole = String(req.query.viewerRole || '').toUpperCase();
  const viewerId = String(req.query.viewerId || '');
  const adminCheck = verifyAdminBearerToken(req.headers.authorization);

  const order = serverOrders.find(o => o.id === orderId);
  const evidence = serverEvidenceStore.get(orderId);
  if (!order && !evidence) {
    return res.status(404).json({ success: false, message: 'Order evidence record not found.' });
  }

  const ownerCustomerId = evidence?.customerId || order?.customerId;
  const ownerPartnerId = evidence?.partnerId || order?.assignedPartnerId;

  const isAuthorized =
    adminCheck.valid ||
    (viewerRole === 'CUSTOMER' && viewerId && viewerId === ownerCustomerId) ||
    (viewerRole === 'SERVICE_PARTNER' && viewerId && viewerId === ownerPartnerId);

  if (!isAuthorized) {
    recordServerAudit(
      'UNAUTHORIZED_EVIDENCE_ACCESS',
      viewerRole || 'UNKNOWN',
      viewerId || 'Anonymous',
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

app.post('/api/evidence/record', (req, res) => {
  const { orderId, actorRole, actorId, updates } = req.body || {};
  if (!orderId || !updates) {
    return res.status(400).json({ success: false, message: 'orderId and updates are required.' });
  }

  const adminCheck = verifyAdminBearerToken(req.headers.authorization);
  const roleUpper = String(actorRole || '').toUpperCase();
  const order = serverOrders.find(o => o.id === orderId);
  const existing = serverEvidenceStore.get(orderId);

  const ownerCustomerId = existing?.customerId || order?.customerId || updates.customerId;
  const ownerPartnerId = existing?.partnerId || order?.assignedPartnerId || updates.recordedByPartnerId;

  const isPartner = roleUpper === 'SERVICE_PARTNER' && actorId && actorId === ownerPartnerId;
  const isCustomer = roleUpper === 'CUSTOMER' && actorId && actorId === ownerCustomerId;

  if (!adminCheck.valid && !isPartner && !isCustomer) {
    recordServerAudit('UNAUTHORIZED_EVIDENCE_WRITE', roleUpper || 'UNKNOWN', actorId || 'Anonymous', `Blocked write to evidence ${orderId}.`, 'blocked');
    return res.status(403).json({
      success: false,
      message: 'Forbidden: only the assigned partner, ordering customer, or Super Admin may modify evidence.',
    });
  }

  // Customers may only update customer sign-off, instructions, or delivery confirmation — never alter partner pickup logs
  if (isCustomer && !adminCheck.valid) {
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
    customerId: ownerCustomerId || 'cust_01',
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
    partnerId: ownerPartnerId || base.partnerId,
    updatedAt: nowIso,
  };
  serverEvidenceStore.set(orderId, merged);

  recordServerAudit(
    'EVIDENCE_RECORD_UPDATED',
    roleUpper || 'ADMIN',
    actorId || adminCheck.email || 'Admin',
    `Updated evidence for ${orderId} (pickupCount=${merged.verifiedCount}, deliveredCount=${merged.deliveredCount ?? 'pending'}).`,
    'success'
  );

  return res.json({ success: true, evidence: merged });
});

// ==================== CUSTOMER PROTECTION & DISPUTES API ====================

app.get('/api/disputes', (req, res) => {
  const viewerRole = String(req.query.viewerRole || '').toUpperCase();
  const viewerId = String(req.query.viewerId || '');
  const adminCheck = verifyAdminBearerToken(req.headers.authorization);

  const allDisputes = Array.from(serverDisputesStore.values());

  if (adminCheck.valid) {
    return res.json({
      success: true,
      disputes: allDisputes,
      compensations: Array.from(serverCompensationStore.values()),
      auditTrail: disputeAuditTrailStore,
    });
  }

  if (viewerRole === 'CUSTOMER' && viewerId) {
    return res.json({
      success: true,
      disputes: allDisputes.filter(d => d.customerId === viewerId),
    });
  }

  if (viewerRole === 'SERVICE_PARTNER' && viewerId) {
    return res.json({
      success: true,
      disputes: allDisputes.filter(d => d.partnerId === viewerId),
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized: valid role identity or Admin Bearer token required to read disputes.',
  });
});

app.post('/api/disputes', (req, res) => {
  const {
    id,
    orderId,
    orderNumber,
    customerId,
    customerName,
    partnerId,
    partnerName,
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

  if (!orderId || !customerId || !description || String(description).trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Order ID, authenticated customerId, and a description (min 5 chars) are required.',
    });
  }

  const order = serverOrders.find(o => o.id === orderId);
  if (order && order.customerId !== customerId) {
    recordServerAudit('DISPUTE_IDENTITY_SPOOF_BLOCKED', 'CUSTOMER', customerId, `Customer ${customerId} attempted dispute on order ${orderId} belonging to ${order.customerId}.`, 'blocked');
    return res.status(403).json({
      success: false,
      message: 'Forbidden: you can only file damage or missing garment claims for your own orders.',
    });
  }

  const nowIso = new Date().toISOString();
  const disputeId = id || `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const auditEntry: DisputeAuditEntry = {
    id: `da_${Date.now()}`,
    timestamp: nowIso,
    actorRole: 'CUSTOMER',
    actorName: customerName || order?.customerName || customerId,
    action: 'CLAIM_SUBMITTED',
    toStatus: 'CLAIM_SUBMITTED',
    note: `Submitted ${category || 'quality_issue'} claim${Array.isArray(customerPhotoUrls) && customerPhotoUrls.length === 0 ? ' (no photo uploaded — fairness protection ensures full review)' : ''}.`,
  };

  const dispute: OrderDispute = {
    id: disputeId,
    orderId,
    orderNumber: orderNumber || order?.orderNumber || orderId,
    customerId,
    customerName: customerName || order?.customerName || 'Customer',
    partnerId: partnerId || order?.assignedPartnerId || 'unassigned',
    partnerName: partnerName || order?.assignedPartnerName || 'Unassigned Partner',
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

app.post('/api/disputes/:id/partner-response', (req, res) => {
  const { id } = req.params;
  const {
    partnerId,
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
  if (dispute.partnerId !== partnerId) {
    recordServerAudit('UNAUTHORIZED_PARTNER_DISPUTE_RESPONSE', 'SERVICE_PARTNER', partnerId || 'Unknown', `Blocked response attempt on dispute ${id}.`, 'blocked');
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

app.post('/api/disputes/:id/customer-followup', (req, res) => {
  const { id } = req.params;
  const { customerId, followUpNote, photoUrls = [], questionAnswers = {} } = req.body || {};

  const dispute = serverDisputesStore.get(id);
  if (!dispute) return res.status(404).json({ success: false, message: 'Dispute claim not found.' });
  if (dispute.customerId !== customerId) {
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

app.post('/api/disputes/:id/admin-action', (req, res) => {
  const adminCheck = verifyAdminBearerToken(req.headers.authorization);
  if (!adminCheck.valid) {
    recordServerAudit('UNAUTHORIZED_DISPUTE_ADMIN_ACTION', 'UNKNOWN', 'Unauthenticated', `Blocked Admin dispute action on ${req.params.id}.`, 'blocked');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: only authenticated Super Admin with valid Bearer token may issue dispute rulings.',
    });
  }

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

  // Fairness Guardrail 1: Decisions that resolve, propose, or reject MUST carry a recorded reason
  if (
    ['RESOLUTION_PROPOSED', 'RESOLVED', 'REJECTED_WITH_REASON', 'CLOSED'].includes(targetStatus) &&
    (!decisionReason || !String(decisionReason).trim())
  ) {
    return res.status(400).json({
      success: false,
      message: 'Fairness Policy: A written decision reason is mandatory before resolving, proposing, rejecting, or closing a claim.',
    });
  }

  // Fairness Guardrail 2: Never reject a claim solely because customer photos were unavailable
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

  // Fairness Guardrail 3: Partner restriction requires documented review + contractual basis (unless urgent protective action)
  if (restrictPartnerAccount) {
    if (!urgentProtectiveAction && (!investigationFindings || !contractualBasis || !partnerRestrictionReason)) {
      return res.status(400).json({
        success: false,
        message: 'Fairness Policy: Account restriction requires documented investigation findings, contractual basis, and restriction notice (unless urgent protective action is flagged).',
      });
    }
  }

  const nowIso = new Date().toISOString();
  const prevStatus = normalizeDisputeStatus(dispute.status);

  // Build optional Admin question for Partner or Customer
  const updatedQuestions: DisputeQuestion[] = [...(dispute.adminQuestions || [])];
  if (requestQuestion && requestQuestion.question && requestQuestion.targetRole) {
    updatedQuestions.push({
      id: `dq_${Date.now()}`,
      targetRole: requestQuestion.targetRole === 'customer' ? 'customer' : 'partner',
      question: String(requestQuestion.question).trim(),
      askedBy: adminCheck.email || 'Ronak (Admin)',
      askedAt: nowIso,
    });
  }

  // Build Compensation Record if provided (NEVER auto-deducted from commission!)
  let compensationRecord: CompensationRecord | undefined = dispute.compensationRecord;
  if (compensation && typeof compensation.approvedAmountInr === 'number') {
    const compAmount = Number(compensation.approvedAmountInr);
    if (compAmount < 0 || !Number.isFinite(compAmount)) {
      return res.status(400).json({ success: false, message: 'Approved compensation amount must be a valid non-negative number.' });
    }
    if (compAmount > 0 && (!compensation.valuationBasis || !String(compensation.valuationBasis).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Fairness Policy: Monetary compensation requires an explicit valuation basis (repair receipt, service fee, etc.) — never invent garment values.',
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
      approvedBy: adminCheck.email || 'Ronak',
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
    actorName: adminCheck.email || 'Ronak (Super Admin)',
    action: `ADMIN_${targetStatus}`,
    fromStatus: prevStatus,
    toStatus: targetStatus,
    note: `${decisionReason || investigationFindings || 'Status updated by Admin'}${compensationRecord ? ` | Compensation ₹${compensationRecord.approvedAmountInr} (${compensationRecord.compensationType}, deductedFromCommission=false)` : ''}`,
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
  recordServerAudit('DISPUTE_ADMIN_RULING', 'SUPER_ADMIN', adminCheck.email || 'Ronak', `Claim ${id} -> ${targetStatus}`, 'success');

  return res.json({ success: true, dispute: updated, compensationRecord });
});

app.post('/api/disputes/:id/appeal', (req, res) => {
  const { id } = req.params;
  const { actorRole, actorId, appealNote } = req.body || {};

  const dispute = serverDisputesStore.get(id);
  if (!dispute) return res.status(404).json({ success: false, message: 'Dispute claim not found.' });

  const roleUpper = String(actorRole || '').toUpperCase();
  const isCust = roleUpper === 'CUSTOMER' && actorId === dispute.customerId;
  const isPart = roleUpper === 'SERVICE_PARTNER' && actorId === dispute.partnerId;

  if (!isCust && !isPart) {
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

app.get('/api/compensation', (req, res) => {
  const adminCheck = verifyAdminBearerToken(req.headers.authorization);
  const viewerRole = String(req.query.viewerRole || '').toUpperCase();
  const viewerId = String(req.query.viewerId || '');

  const allComp = Array.from(serverCompensationStore.values());
  if (adminCheck.valid) {
    return res.json({ success: true, records: allComp });
  }

  if ((viewerRole === 'CUSTOMER' || viewerRole === 'SERVICE_PARTNER') && viewerId) {
    const allowedDisputeIds = new Set(
      Array.from(serverDisputesStore.values())
        .filter(d => (viewerRole === 'CUSTOMER' ? d.customerId === viewerId : d.partnerId === viewerId))
        .map(d => d.id)
    );
    return res.json({
      success: true,
      records: allComp.filter(c => allowedDisputeIds.has(c.disputeId)),
    });
  }

  return res.status(401).json({ success: false, message: 'Unauthorized access to compensation records.' });
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
    recentAuditLogs: serverAuditLogs.slice(0, 15),
  });
});

app.post('/api/notifications/test', (req, res) => {
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

  recordServerAudit(`NOTIFICATION_${kind.toUpperCase()}_SENT`, 'SYSTEM', recipient || 'Target', 'External notification dispatched.', 'success');
  return res.json({
    success: true,
    configured: true,
    message: `${type} gateway configured and test dispatch logged.`,
  });
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
