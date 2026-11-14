export type Language = 'en' | 'hi';

export type AppRole = 'SUPER_ADMIN' | 'CUSTOMER' | 'SERVICE_PARTNER';

export type UserRole = 'customer' | 'partner' | 'admin' | 'CUSTOMER' | 'SERVICE_PARTNER' | 'SUPER_ADMIN';

export type ServiceType = 'ironing_normal' | 'ironing_steam' | 'laundry' | 'dry_cleaning' | string;

export type DeliveryMode = 'home_valet' | 'self_drop';

/**
 * Standardized 10 Canonical Order Statuses + backward-compatible aliases:
 * - BOOKED
 * - PARTNER_ASSIGNED
 * - PICKUP_SCHEDULED
 * - PICKED_UP
 * - PROCESSING
 * - READY_FOR_DELIVERY
 * - OUT_FOR_DELIVERY
 * - DELIVERED
 * - CANCELLED
 * - DISPUTED
 */
export type CanonicalOrderStatus =
  | 'BOOKED'
  | 'PARTNER_ASSIGNED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'DISPUTED';

export type OrderStatus =
  | CanonicalOrderStatus
  | 'order_placed'
  | 'searching_for_partner'
  | 'partner_assigned'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'processing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  // Legacy aliases
  | 'placed'
  | 'broadcasting'
  | 'accepted'
  | 'out_for_pickup'
  | 'quality_checked'
  | 'delivered';

export function normalizeOrderStatus(status: OrderStatus | string): CanonicalOrderStatus {
  const s = String(status).toUpperCase();
  if (s === 'ORDER_PLACED' || s === 'SEARCHING_FOR_PARTNER' || s === 'PLACED' || s === 'BROADCASTING' || s === 'BOOKED') return 'BOOKED';
  if (s === 'PARTNER_ASSIGNED' || s === 'ACCEPTED') return 'PARTNER_ASSIGNED';
  if (s === 'PICKUP_SCHEDULED' || s === 'OUT_FOR_PICKUP') return 'PICKUP_SCHEDULED';
  if (s === 'PICKED_UP') return 'PICKED_UP';
  if (s === 'PROCESSING') return 'PROCESSING';
  if (s === 'READY_FOR_DELIVERY' || s === 'QUALITY_CHECKED') return 'READY_FOR_DELIVERY';
  if (s === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (s === 'DELIVERED' || s === 'COMPLETED') return 'DELIVERED';
  if (s === 'CANCELLED') return 'CANCELLED';
  if (s === 'DISPUTED') return 'DISPUTED';
  return 'BOOKED';
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface ServiceCategoryConfig {
  id: ServiceType;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  turnaroundHours: number;
  expressHours: number;
  commissionOverridePercent?: number;
  isActive: boolean;
  displayOrder: number;
}

export interface GarmentItem {
  id: string;
  nameEn: string;
  nameHi: string;
  category: ServiceType;
  price: number; // in INR
  iconName?: string;
  descriptionEn?: string;
  descriptionHi?: string;
  isActive?: boolean;
}

export interface CartItem {
  item: GarmentItem;
  quantity: number;
  serviceType: ServiceType;
}

export interface OrderAuditLog {
  timestamp: string;
  status: OrderStatus;
  note: string;
  actor: string;
}

export interface GarmentConditionRecord {
  id: string;
  garmentId?: string;
  garmentName: string;
  category: ServiceType;
  quantity: number;
  tagId: string;
  conditionAtPickup: 'intact' | 'pre_existing_stain' | 'pre_existing_tear' | 'delicate_trim' | 'loose_button';
  preExistingIssueNotes?: string;
  specialHandlingCare?: string;
  conditionAtDelivery?: 'delivered_intact' | 'repaired' | 'damaged' | 'missing';
}

export interface GarmentEvidence {
  orderId: string;
  tagReference: string;
  expectedCount: number;
  verifiedCount: number;
  deliveredCount?: number;
  garmentRecords?: GarmentConditionRecord[];
  hasPreExistingDamage: boolean;
  damageNotes: string;
  stainChecklist: string[];
  customerInstructions?: string;
  specialCareNotes?: string;
  pickupPhotoUrls: string[];
  beforeServicePhotoUrls?: string[];
  afterServicePhotoUrls?: string[];
  deliveryPhotoUrls: string[];
  serviceCompletedAt?: string;
  customerSignOff: boolean;
  customerSignedAt?: string;
  deliveryConfirmedByCustomer?: boolean;
  deliveryConfirmedAt?: string;
  pickupOtp?: string;
  pickupOtpVerified: boolean;
  deliveryOtp?: string;
  deliveryOtpVerified: boolean;
  recordedByPartnerId?: string;
  recordedAt: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerPhoneVerified?: boolean;
  customerAddress: string;
  pincode: string;
  city?: string;
  state?: string;
  locality: string;
  coordinates?: GeoCoordinates;
  deliveryMode: DeliveryMode;
  serviceType: ServiceType;
  items: {
    garmentId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  addOns: {
    scentedStarch?: boolean;
    luxuryHangers?: boolean;
    expressDelivery?: boolean;
  };
  pickupSlot: string;
  deliverySlot?: string;
  estimatedPickupEta?: string;
  estimatedDeliveryEta?: string;
  specialInstructions?: string;
  couponCode?: string;
  rewardPointsUsed?: number;
  rewardDiscount?: number;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  totalAmount: number;
  commissionRate?: number;
  platformCommissionAmount?: number;
  partnerNetAmount?: number;
  paymentMethod?: 'direct_to_partner_upi' | 'direct_to_partner_cash';
  paymentStatus?: 'pending_at_delivery' | 'paid_to_partner';
  status: OrderStatus;
  cancellationReason?: string;
  cancelledByRole?: AppRole;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  assignedPartnerPhone?: string;
  candidatePartnerQueue?: string[];
  rejectedPartnerIds?: string[];
  currentOfferPartnerId?: string;
  offerExpiresAt?: string;
  assignedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  garmentEvidence?: GarmentEvidence;
  pickupOtp?: string;
  deliveryOtp?: string;
  hasDispute?: boolean;
  disputeId?: string;
  reviewSubmitted?: boolean;
  logs: OrderAuditLog[];
  createdAt: string;
  updatedAt?: string;
}

export interface PartnerDocument {
  id: string;
  docType: 'aadhaar' | 'pan' | 'trade_license' | 'shop_photo' | 'gst' | 'other';
  fileName: string;
  fileUrl?: string;
  uploadedAt: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
}

export interface PartnerPerformanceMetrics {
  totalOffered: number;
  totalAccepted: number;
  totalRejected: number;
  totalCancelledByPartner: number;
  onTimePickups: number;
  onTimeDeliveries: number;
  complaintsCount: number;
  disputesCount: number;
  acceptanceRate: number;
  rejectionRate: number;
  cancellationRate: number;
  onTimePickupRate: number;
  onTimeDeliveryRate: number;
  complaintRate: number;
}

export interface Partner {
  id: string;
  partnerCode?: string;
  name: string;
  phone: string;
  email?: string;
  username?: string;
  passwordHash?: string;
  businessName: string;
  hubName: string;
  serviceAddress: string;
  pincode: string;
  servicePincodes?: string[];
  city?: string;
  state?: string;
  coordinates?: GeoCoordinates;
  serviceArea: string;
  workingHours: string;
  upiId?: string;
  upiQrLabel?: string;
  maxDailyCapacity?: number;
  currentActiveOrders?: number;
  isOnline: boolean;
  status: 'active' | 'pending' | 'suspended';
  kycVerified?: boolean;
  commissionBlocked?: boolean;
  rating: number;
  reviewCount?: number;
  totalOrdersCompleted: number;
  walletBalance: number;
  totalEarnings: number;
  commissionPaid: number;
  commissionPending?: number;
  commissionOverdue?: number;
  customCommissionPercent?: number;
  servicesOffered: ServiceType[];
  documents: PartnerDocument[];
  performance?: PartnerPerformanceMetrics;
  joinedDate: string;
  lastLoginAt?: string;
}

export interface CustomerAddress {
  id: string;
  label: 'Home' | 'Office' | 'Other';
  addressLine: string;
  locality: string;
  city?: string;
  state?: string;
  pincode: string;
  landmark?: string;
  coordinates?: GeoCoordinates;
  isDefault: boolean;
}

export interface CustomerSubscription {
  planId: string;
  planName: string;
  pricePaid: number;
  garmentCreditsRemaining: number;
  startsAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'cancelled';
}

export interface CustomerUser {
  id: string;
  customerCode?: string;
  name: string;
  phone: string;
  phoneVerified?: boolean;
  email?: string;
  username?: string;
  passwordHash?: string;
  addresses: CustomerAddress[];
  isSuspended?: boolean;
  totalOrders: number;
  totalSpent: number;
  rewardPoints?: number;
  referralCode?: string;
  referredByCode?: string;
  activeSubscription?: CustomerSubscription;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  role: 'SUPER_ADMIN';
  mfaEnabled: boolean;
  lastLoginAt?: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  activeRole: AppRole;
  userEmail?: string;
  userPhone?: string;
  phoneVerified?: boolean;
  userId?: string;
  userName?: string;
  token?: string;
  expiresAt?: string;
}

export interface PasswordResetToken {
  id: string;
  email: string;
  token: string;
  role: AppRole;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface SecurityActivityLog {
  id: string;
  timestamp: string;
  action: string;
  actorRole: AppRole | 'SYSTEM';
  actorName: string;
  actorEmail?: string;
  details: string;
  status: 'success' | 'warning' | 'blocked';
}

export interface ServiceAreaConfig {
  pincode: string;
  areaName: string;
  city: string;
  state: string;
  isActive: boolean;
  minOrderAmount: number;
  standardDeliveryHours: number;
  expressDeliveryHours: number;
  coordinates?: GeoCoordinates;
}

export interface PlatformSettings {
  brandName: string;
  primaryPincode: string;
  deliveryChargeStandard: number;
  deliveryChargeExpress: number;
  freeDeliveryThreshold: number;
  platformCommissionPercent: number; // Default 15%
  broadcastTimeoutSeconds: number; // e.g. 60s
  scentedStarchPrice: number;
  luxuryHangerPrice: number;
  expressTurnaroundPrice: number;
  currencySymbol: string;
  rewardPointsPerHundredRupees?: number;
  rewardPointValueInInr?: number;
  referralBonusPoints?: number;
  weeklyRemittanceDueDay?: string;
  overdueGraceDays?: number;
  autoBlockOverduePartners?: boolean;
  freeCancellationMinutes?: number;
  postPickupCancellationFee?: number;
}

export interface BusinessSettings {
  brandName: string;
  businessOwnerName: string;
  tagline: string;
  businessPhone: string;
  whatsappSupportNumber: string;
  businessEmail: string;
  businessAddress: string;
  businessLogo: string;
  supportHours: string;
  platformUpiId?: string;
  platformBankDetails?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  aboutUsText?: string;
  servicePincodes: string[];
  socialLinks: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
  };
}

export interface LegalPolicies {
  privacyPolicy: string;
  termsAndConditions: string;
  cancellationRefundPolicy: string;
  partnerAgreement: string;
  contactSupportInfo: string;
  lastUpdated: string;
}

export interface AppNotification {
  id: string;
  recipientRole: UserRole;
  recipientId?: string;
  title: string;
  message: string;
  orderId?: string;
  timestamp: string;
  read: boolean;
}

export interface CouponOffer {
  code: string;
  discountPercent?: number;
  flatDiscount?: number;
  minOrder: number;
  maxDiscount?: number;
  applicableCategory?: ServiceType | 'ALL';
  descriptionEn: string;
  descriptionHi: string;
  isActive: boolean;
  expiresAt?: string;
}

export interface CommissionLedgerEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName: string;
  weekKey: string; // e.g. "2026-W45"
  orderTotal: number;
  commissionRate: number;
  commissionAmount: number;
  partnerNetShare: number;
  remittanceStatus: 'unpaid' | 'submitted' | 'verified' | 'overdue';
  remittanceId?: string;
  utrReference?: string;
  dueDate: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface CommissionRemittance {
  id: string;
  partnerId: string;
  partnerName: string;
  weekKey: string;
  ledgerEntryIds: string[];
  amountDue: number;
  amountSubmitted: number;
  utrReference: string;
  paymentMode: 'UPI' | 'IMPS' | 'NEFT' | 'BANK_TRANSFER';
  proofFileName?: string;
  notes?: string;
  status: 'pending_verification' | 'verified' | 'rejected';
  adminNotes?: string;
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export type CanonicalDisputeStatus =
  | 'CLAIM_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PARTNER_RESPONSE_PENDING'
  | 'CUSTOMER_RESPONSE_PENDING'
  | 'EVIDENCE_REVIEW'
  | 'RESOLUTION_PROPOSED'
  | 'RESOLVED'
  | 'REJECTED_WITH_REASON'
  | 'APPEAL_REQUESTED'
  | 'CLOSED';

export type LegacyDisputeStatus =
  | 'open'
  | 'partner_responded'
  | 'under_admin_review'
  | 'resolved'
  | 'appealed';

export type DisputeStatus = CanonicalDisputeStatus | LegacyDisputeStatus;

export function normalizeDisputeStatus(status: DisputeStatus | string): CanonicalDisputeStatus {
  const s = String(status || '').toUpperCase();
  if (s === 'OPEN' || s === 'CLAIM_SUBMITTED') return 'CLAIM_SUBMITTED';
  if (s === 'UNDER_REVIEW' || s === 'UNDER_ADMIN_REVIEW') return 'UNDER_REVIEW';
  if (s === 'PARTNER_RESPONSE_PENDING') return 'PARTNER_RESPONSE_PENDING';
  if (s === 'CUSTOMER_RESPONSE_PENDING') return 'CUSTOMER_RESPONSE_PENDING';
  if (s === 'PARTNER_RESPONDED' || s === 'EVIDENCE_REVIEW') return 'EVIDENCE_REVIEW';
  if (s === 'RESOLUTION_PROPOSED') return 'RESOLUTION_PROPOSED';
  if (s === 'RESOLVED') return 'RESOLVED';
  if (s === 'REJECTED_WITH_REASON') return 'REJECTED_WITH_REASON';
  if (s === 'APPEALED' || s === 'APPEAL_REQUESTED') return 'APPEAL_REQUESTED';
  if (s === 'CLOSED') return 'CLOSED';
  return 'CLAIM_SUBMITTED';
}

export type RequestedResolutionType =
  | 'service_charge_refund'
  | 'repair_reimbursement'
  | 'damage_compensation'
  | 'missing_garment_resolution'
  | 'partial_refund'
  | 'full_refund'
  | 'repress_or_redo';

export type CompensationType =
  | 'service_charge_refund'
  | 'repair_reimbursement'
  | 'damage_compensation'
  | 'missing_garment_resolution'
  | 'partial_refund'
  | 'full_refund'
  | 'disputed_compensation'
  | 'no_financial_payout';

export interface DisputeQuestion {
  id: string;
  targetRole: 'partner' | 'customer';
  question: string;
  askedBy: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
}

export interface DisputeAuditEntry {
  id: string;
  timestamp: string;
  actorRole: AppRole | 'SYSTEM';
  actorName: string;
  action: string;
  fromStatus?: CanonicalDisputeStatus;
  toStatus?: CanonicalDisputeStatus;
  note: string;
}

export interface CompensationRecord {
  id: string;
  disputeId: string;
  orderId: string;
  orderNumber: string;
  compensationType: CompensationType;
  responsibleParty: 'partner' | 'platform' | 'shared' | 'customer_acknowledged_pre_existing' | 'none';
  approvedAmountInr: number;
  valuationBasis: string;
  reason: string;
  contractualBasis: string;
  paymentResponsibility: 'partner_direct_settlement' | 'platform_goodwill_credit' | 'shared_50_50' | 'none';
  settlementStatus: 'proposed' | 'approved_pending_payout' | 'settled' | 'disputed' | 'cancelled';
  deductedFromCommission: false; // Fairness invariant: NEVER automatically deducted from partner commission
  approvedBy: string;
  approvedAt: string;
  settledAt?: string;
  settlementReference?: string;
}

export interface OrderDispute {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  partnerId: string;
  partnerName: string;
  category: 'missing_item' | 'damaged_garment' | 'wrong_item' | 'delayed_delivery' | 'quality_issue';
  affectedGarmentDetails?: string;
  affectedQuantity?: number;
  description: string;
  requestedResolution: RequestedResolutionType;
  requestedAmountInr?: number;
  customerPhotoUrls: string[];
  supportingDocUrls?: string[];
  evidenceUnavailableNote?: string;
  partnerResponse?: string;
  partnerPreExistingDamageReported?: boolean;
  partnerPreExistingNotes?: string;
  partnerPhotoUrls?: string[];
  partnerPickupPhotoUrls?: string[];
  partnerServicePhotoUrls?: string[];
  partnerDeliveryPhotoUrls?: string[];
  partnerRespondedAt?: string;
  customerFollowUpNote?: string;
  adminQuestions?: DisputeQuestion[];
  status: DisputeStatus;
  credibilityAssessment?:
    | 'pending_review'
    | 'genuine_claim'
    | 'pre_existing_damage_confirmed'
    | 'inconclusive_evidence'
    | 'unsubstantiated_or_fraudulent';
  investigationFindings?: string;
  adminDecision?:
    | 'refund_or_repress'
    | 'partial_compensation'
    | 'full_refund'
    | 'repair_reimbursement'
    | 'missing_garment_settlement'
    | 'partner_cleared'
    | 'rejected_insufficient_basis'
    | 'escalated';
  decisionReason?: string;
  contractualBasis?: string;
  resolutionNote?: string;
  compensationId?: string;
  compensationRecord?: CompensationRecord;
  partnerRestrictionApplied?: boolean;
  partnerRestrictionReason?: string;
  appealNote?: string;
  appealSubmittedBy?: 'customer' | 'partner';
  appealedAt?: string;
  secondReviewDecision?: string;
  auditTrail?: DisputeAuditEntry[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface VerifiedReview {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  partnerId: string;
  partnerName: string;
  rating: number; // 1-5
  comment: string;
  serviceType: ServiceType;
  isVerifiedDelivery: boolean;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  includedGarments: number;
  freeExpressDeliveries: number;
  priorityDispatch: boolean;
  isActive: boolean;
}

export interface ReferralRecord {
  id: string;
  referrerCustomerId: string;
  referrerCode: string;
  referredCustomerId?: string;
  referredPhoneOrEmail: string;
  rewardPointsAwarded: number;
  status: 'invited' | 'completed_first_order';
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  customerId?: string;
  partnerId?: string;
  orderNumber?: string;
  senderName: string;
  senderPhone: string;
  senderEmail?: string;
  subject: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  adminReply?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkEnquiry {
  id: string;
  organizationName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  pincode: string;
  estimatedMonthlyGarments: number;
  serviceTypes: ServiceType[];
  notes: string;
  status: 'new' | 'contacted' | 'quoted' | 'active';
  createdAt: string;
}

export interface FaqItem {
  id: string;
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  category: 'booking' | 'garment_care' | 'payments' | 'partners';
  isActive: boolean;
}
