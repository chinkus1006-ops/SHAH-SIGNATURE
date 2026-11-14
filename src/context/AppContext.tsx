import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Language,
  UserRole,
  AppRole,
  ServiceType,
  Order,
  Partner,
  GarmentItem,
  CartItem,
  ServiceAreaConfig,
  PlatformSettings,
  BusinessSettings,
  LegalPolicies,
  CouponOffer,
  OrderStatus,
  CustomerUser,
  CustomerAddress,
  PartnerDocument,
  AppNotification,
  AdminUser,
  SecurityActivityLog,
  AuthSession,
  ServiceCategoryConfig,
  CommissionLedgerEntry,
  CommissionRemittance,
  OrderDispute,
  CanonicalDisputeStatus,
  CompensationRecord,
  CompensationType,
  DisputeAuditEntry,
  DisputeQuestion,
  RequestedResolutionType,
  VerifiedReview,
  SubscriptionPlan,
  SupportTicket,
  BulkEnquiry,
  FaqItem,
  GarmentEvidence,
  GeoCoordinates,
  normalizeOrderStatus,
  normalizeDisputeStatus,
} from '../types';
import {
  INITIAL_GARMENTS,
  INITIAL_PARTNERS,
  INITIAL_SERVICE_AREAS,
  INITIAL_SETTINGS,
  INITIAL_BUSINESS_SETTINGS,
  INITIAL_LEGAL_POLICIES,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_ADMIN,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_SERVICE_CATEGORIES,
  INITIAL_COMMISSION_LEDGER,
  INITIAL_SUBSCRIPTION_PLANS,
  INITIAL_FAQS,
  INITIAL_REVIEWS,
  INITIAL_DISPUTES,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_BULK_ENQUIRIES,
} from '../data/initialData';
import { translations } from '../translations';
import { db, auth, persistDocumentSafe, signOutFirebase, testFirestoreConnection } from '../lib/firebaseClient';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function computeHaversineKm(a?: GeoCoordinates, b?: GeoCoordinates): number {
  if (!a || !b) return 999;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getCurrentWeekKey(): string {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;

  role: UserRole;
  setRole: (role: UserRole) => void;

  // Business Settings & Legal
  businessSettings: BusinessSettings;
  updateBusinessSettings: (updates: Partial<BusinessSettings>) => void;
  legalPolicies: LegalPolicies;
  updateLegalPolicies: (updates: Partial<LegalPolicies>) => void;

  // Customers & Address Book
  customers: CustomerUser[];
  customerUser: CustomerUser;
  setActiveCustomerId: (id: string) => void;
  updateCustomerUser: (user: Partial<CustomerUser>) => void;
  addCustomerAddress: (address: Omit<CustomerAddress, 'id'>) => void;
  updateCustomerAddress: (addressId: string, updates: Partial<CustomerAddress>) => void;
  deleteCustomerAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
  toggleCustomerSuspension: (customerId: string) => void;
  registerCustomer: (data: {
    name: string;
    phone: string;
    email?: string;
    addressLine: string;
    locality: string;
    pincode: string;
    city?: string;
    state?: string;
  }) => CustomerUser;

  // Partners & Approvals
  partners: Partner[];
  activePartner: Partner;
  setActivePartnerId: (id: string) => void;
  updatePartnerProfile: (partnerId: string, updates: Partial<Partner>) => void;
  togglePartnerStatus: (partnerId: string, status: 'active' | 'pending' | 'suspended') => void;
  togglePartnerOnline: (partnerId: string) => void;
  togglePartnerCommissionBlock: (partnerId: string, blocked: boolean) => void;
  registerPartner: (partnerData: {
    name: string;
    phone: string;
    email?: string;
    businessName: string;
    serviceAddress: string;
    pincode: string;
    city?: string;
    state?: string;
    servicesOffered: ServiceType[];
    workingHours: string;
    upiId?: string;
  }) => Partner;
  uploadPartnerDocument: (partnerId: string, doc: Omit<PartnerDocument, 'id' | 'uploadedAt' | 'status'>) => void;
  verifyPartnerDocument: (partnerId: string, docId: string, status: 'verified' | 'rejected', reason?: string) => void;

  // Services, Catalog, Areas, Settings & Coupons
  serviceCategories: ServiceCategoryConfig[];
  addServiceCategory: (cat: ServiceCategoryConfig) => void;
  updateServiceCategory: (id: ServiceType, updates: Partial<ServiceCategoryConfig>) => void;
  toggleServiceCategory: (id: ServiceType) => void;

  garments: GarmentItem[];
  addGarment: (item: Omit<GarmentItem, 'id'>) => void;
  updateGarment: (id: string, updates: Partial<GarmentItem>) => void;
  deleteGarment: (id: string) => void;

  serviceAreas: ServiceAreaConfig[];
  addServiceArea: (area: ServiceAreaConfig) => void;
  toggleServiceArea: (pincode: string) => void;
  updateServiceArea: (pincode: string, updates: Partial<ServiceAreaConfig>) => void;

  settings: PlatformSettings;
  updateSettings: (newSettings: Partial<PlatformSettings>) => void;

  coupons: CouponOffer[];
  addCoupon: (coupon: CouponOffer) => void;
  toggleCoupon: (code: string) => void;

  // Pan-India Location & Partner Eligibility
  selectedLocationPin: string;
  setSelectedLocationPin: (pin: string) => void;
  getEligiblePartnersForBooking: (pincode: string, serviceType?: ServiceType, coords?: GeoCoordinates) => Partner[];
  isLocationServiceable: (pincode: string, serviceType?: ServiceType) => {
    serviceable: boolean;
    area?: ServiceAreaConfig;
    eligiblePartners: Partner[];
    reason?: string;
  };

  // Orders & Smart Dispatch
  orders: Order[];
  customerOrders: Order[];
  partnerOrders: Order[];
  createOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'logs' | 'status'>) => Promise<Order>;
  acceptOrder: (orderId: string, partnerId: string) => { success: boolean; message: string };
  rejectOrderOffer: (orderId: string, partnerId: string, reason?: string) => { success: boolean; escalatedTo?: string; message: string };
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, customNote?: string, reason?: string) => void;
  customerCancelOrder: (orderId: string, reason: string) => { success: boolean; message: string };
  adminAssignOrder: (orderId: string, partnerId: string) => void;
  adminCancelOrder: (orderId: string, reason: string) => void;
  rebookOrder: (order: Order) => void;

  // Garment Evidence & OTP Handover
  recordGarmentEvidence: (orderId: string, updates: Partial<GarmentEvidence>) => void;
  verifyHandoverOtp: (orderId: string, stage: 'pickup' | 'delivery', enteredOtp: string) => { success: boolean; message: string };
  customerSignOffEvidence: (orderId: string) => void;
  confirmOrderDeliveryByCustomer: (orderId: string) => void;

  // Commission Ledger & Remittances
  commissionLedger: CommissionLedgerEntry[];
  remittances: CommissionRemittance[];
  submitPartnerRemittance: (data: {
    partnerId: string;
    weekKey: string;
    ledgerEntryIds: string[];
    amountSubmitted: number;
    utrReference: string;
    paymentMode: 'UPI' | 'IMPS' | 'NEFT' | 'BANK_TRANSFER';
    proofFileName?: string;
    notes?: string;
  }) => CommissionRemittance;
  verifyPartnerRemittance: (remittanceId: string, decision: 'verified' | 'rejected', adminNotes?: string) => void;

  // Two-Sided Disputes, Evidence Investigation & Compensation Protection
  disputes: OrderDispute[];
  compensationRecords: CompensationRecord[];
  createOrderDispute: (data: {
    orderId: string;
    category: OrderDispute['category'];
    affectedGarmentDetails?: string;
    affectedQuantity?: number;
    description: string;
    requestedResolution?: RequestedResolutionType;
    requestedAmountInr?: number;
    customerPhotoUrls?: string[];
    supportingDocUrls?: string[];
    evidenceUnavailableNote?: string;
  }) => OrderDispute | null;
  respondToDispute: (
    disputeId: string,
    responseOrPayload:
      | string
      | {
          partnerResponse: string;
          preExistingDamageReported?: boolean;
          preExistingNotes?: string;
          partnerPickupPhotoUrls?: string[];
          partnerServicePhotoUrls?: string[];
          partnerDeliveryPhotoUrls?: string[];
          questionAnswers?: Record<string, string>;
        },
    partnerPhotoUrls?: string[]
  ) => void;
  submitCustomerFollowUp: (
    disputeId: string,
    payload: {
      followUpNote: string;
      photoUrls?: string[];
      questionAnswers?: Record<string, string>;
    }
  ) => void;
  adminUpdateDispute: (
    disputeId: string,
    payload: {
      nextStatus: CanonicalDisputeStatus;
      investigationFindings?: string;
      credibilityAssessment?: OrderDispute['credibilityAssessment'];
      adminDecision?: OrderDispute['adminDecision'];
      decisionReason?: string;
      contractualBasis?: string;
      requestQuestion?: { targetRole: 'partner' | 'customer'; question: string };
      compensation?: {
        compensationType: CompensationType;
        responsibleParty: CompensationRecord['responsibleParty'];
        approvedAmountInr: number;
        valuationBasis: string;
        paymentResponsibility: CompensationRecord['paymentResponsibility'];
        settlementStatus?: CompensationRecord['settlementStatus'];
        settlementReference?: string;
      };
      restrictPartnerAccount?: boolean;
      partnerRestrictionReason?: string;
      urgentProtectiveAction?: boolean;
    }
  ) => { success: boolean; message: string; dispute?: OrderDispute };
  resolveDispute: (disputeId: string, decision: OrderDispute['adminDecision'], resolutionNote: string) => void;
  appealDispute: (disputeId: string, appealNote: string, submittedBy?: 'customer' | 'partner') => { success: boolean; message: string };
  updateCompensationSettlement: (
    compId: string,
    settlementStatus: CompensationRecord['settlementStatus'],
    settlementReference?: string
  ) => void;

  // Retention: Reviews, Subscriptions, Referrals, Support & Bulk
  reviews: VerifiedReview[];
  submitVerifiedReview: (data: { orderId: string; rating: number; comment: string }) => { success: boolean; message: string };
  subscriptionPlans: SubscriptionPlan[];
  addSubscriptionPlan: (plan: Omit<SubscriptionPlan, 'id'>) => void;
  toggleSubscriptionPlan: (id: string) => void;
  subscribeCustomerToPlan: (planId: string) => void;
  redeemRewardPoints: (points: number) => number;

  supportTickets: SupportTicket[];
  submitSupportTicket: (ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => SupportTicket;
  updateSupportTicket: (ticketId: string, status: SupportTicket['status'], adminReply?: string) => void;

  bulkEnquiries: BulkEnquiry[];
  submitBulkEnquiry: (enquiry: Omit<BulkEnquiry, 'id' | 'status' | 'createdAt'>) => BulkEnquiry;
  updateBulkEnquiryStatus: (id: string, status: BulkEnquiry['status']) => void;

  faqs: FaqItem[];
  addFaq: (faq: Omit<FaqItem, 'id'>) => void;
  toggleFaq: (id: string) => void;

  // Booking modal & cart
  isBookingOpen: boolean;
  setIsBookingOpen: (open: boolean) => void;
  selectedCategory: ServiceType;
  setSelectedCategory: (cat: ServiceType) => void;
  cart: CartItem[];
  addToCart: (item: GarmentItem, quantity?: number) => void;
  updateCartQuantity: (garmentId: string, quantity: number) => void;
  removeFromCart: (garmentId: string) => void;
  clearCart: () => void;
  cartSubtotal: number;

  // Tracking
  activeTrackingOrderId: string | null;
  setActiveTrackingOrderId: (id: string | null) => void;

  // In-App Notifications
  notifications: AppNotification[];
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Super Admin Account & Security Logs
  adminUser: AdminUser;
  activityLogs: SecurityActivityLog[];
  addActivityLog: (
    action: string,
    actorRole: AppRole | 'SYSTEM',
    actorName: string,
    details: string,
    status?: 'success' | 'warning' | 'blocked'
  ) => void;

  // Authentication & Session
  phoneProofToken: string | null;
  setPhoneVerifiedSession: (phone: string, proofToken?: string) => void;
  firebaseUid: string | null;
  loginAdmin: (credentials: { emailOrUsername: string; password?: string; token?: string }) => { success: boolean; message: string };
  loginCustomer: (credentials: { emailOrCode: string; password?: string }) => { success: boolean; message: string; customer?: CustomerUser };
  loginPartner: (credentials: { emailOrCode: string; password?: string }) => { success: boolean; message: string; partner?: Partner };
  registerCustomerAccount: (data: {
    name: string;
    phone: string;
    email: string;
    username?: string;
    password?: string;
    addressLine?: string;
    locality?: string;
    pincode?: string;
    referralCodeUsed?: string;
  }) => { success: boolean; customer: CustomerUser; message: string };
  registerPartnerAccount: (data: {
    name: string;
    phone: string;
    email: string;
    username?: string;
    businessName: string;
    serviceAddress: string;
    pincode: string;
    city?: string;
    state?: string;
    servicesOffered: ServiceType[];
    workingHours?: string;
    password?: string;
  }) => { success: boolean; partner: Partner; message: string };
  requestPasswordReset: (email: string, targetRole: AppRole) => { success: boolean; resetToken?: string; message: string };
  confirmPasswordReset: (token: string, newPassword: string) => { success: boolean; message: string };
  changePassword: (role: AppRole, userId: string, oldPass: string, newPass: string) => { success: boolean; message: string };
  logout: () => void;
  authSession: AuthSession | null;

  // Modals
  isContactModalOpen: boolean;
  setIsContactModalOpen: (open: boolean) => void;
  activeLegalModal: 'privacy' | 'terms' | 'refund' | 'partner' | null;
  setActiveLegalModal: (modal: 'privacy' | 'terms' | 'refund' | 'partner' | null) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalRole: UserRole;
  setAuthModalRole: (role: UserRole) => void;
  authModalMode: 'login' | 'register' | 'forgot' | 'reset';
  setAuthModalMode: (mode: 'login' | 'register' | 'forgot' | 'reset') => void;
  openAuthModal: (role?: UserRole, mode?: 'login' | 'register' | 'forgot' | 'reset') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
  ORDERS: 'shah_signature_orders_v4',
  GARMENTS: 'shah_signature_garments_v4',
  SERVICES: 'shah_signature_services_v4',
  PARTNERS: 'shah_signature_partners_v4',
  CUSTOMERS: 'shah_signature_customers_v4',
  AREAS: 'shah_signature_areas_v4',
  SETTINGS: 'shah_signature_settings_v4',
  BUSINESS: 'shah_signature_business_v4',
  LEGAL: 'shah_signature_legal_v4',
  COUPONS: 'shah_signature_coupons_v4',
  LEDGER: 'shah_signature_ledger_v4',
  REMITTANCES: 'shah_signature_remittances_v4',
  DISPUTES: 'shah_signature_disputes_v4',
  COMPENSATIONS: 'shah_signature_compensations_v4',
  REVIEWS: 'shah_signature_reviews_v4',
  PLANS: 'shah_signature_plans_v4',
  TICKETS: 'shah_signature_tickets_v4',
  BULK: 'shah_signature_bulk_v4',
  FAQS: 'shah_signature_faqs_v4',
  LANGUAGE: 'shah_signature_lang_v3',
  ROLE: 'shah_signature_role_v3',
  ACTIVE_PARTNER: 'shah_signature_active_partner_v3',
  ACTIVE_CUSTOMER: 'shah_signature_active_customer_v3',
  NOTIFICATIONS: 'shah_signature_notifications_v3',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE) as Language) || 'en';
  });
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_KEYS.ROLE) as UserRole) || 'customer';
  });
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [phoneProofToken, setPhoneProofToken] = useState<string | null>(() => {
    return localStorage.getItem('shah_phone_proof_v1');
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, lang);
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ROLE, newRole);
  };

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => readStorage('shah_auth_session_v3', null));
  const t = translations[language];

  // Settings & Legal
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() =>
    readStorage(LOCAL_STORAGE_KEYS.BUSINESS, INITIAL_BUSINESS_SETTINGS)
  );
  const updateBusinessSettings = (updates: Partial<BusinessSettings>) => {
    setBusinessSettings(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(LOCAL_STORAGE_KEYS.BUSINESS, JSON.stringify(updated));
      persistDocumentSafe('app_settings', 'business', { id: 'business', ...updated }).catch(() => {});
      return updated;
    });
  };

  const [legalPolicies, setLegalPolicies] = useState<LegalPolicies>(() =>
    readStorage(LOCAL_STORAGE_KEYS.LEGAL, INITIAL_LEGAL_POLICIES)
  );
  const updateLegalPolicies = (updates: Partial<LegalPolicies>) => {
    setLegalPolicies(prev => {
      const updated = { ...prev, ...updates, lastUpdated: new Date().toISOString().split('T')[0] };
      localStorage.setItem(LOCAL_STORAGE_KEYS.LEGAL, JSON.stringify(updated));
      persistDocumentSafe('app_settings', 'legal', { id: 'legal', ...updated }).catch(() => {});
      return updated;
    });
  };

  // Customers
  const [customers, setCustomers] = useState<CustomerUser[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS)
  );
  const [activeCustomerId, setActiveCustomerIdState] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_CUSTOMER) || INITIAL_CUSTOMERS[0].id;
  });
  const setActiveCustomerId = (id: string) => {
    setActiveCustomerIdState(id);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_CUSTOMER, id);
  };
  const customerUser = customers.find(c => c.id === activeCustomerId) || customers[0];

  const updateCustomerUser = (updates: Partial<CustomerUser>) => {
    setCustomers(prev => prev.map(c => (c.id === customerUser.id ? { ...c, ...updates } : c)));
  };

  const addCustomerAddress = (newAddr: Omit<CustomerAddress, 'id'>) => {
    const address: CustomerAddress = { ...newAddr, id: `addr_${Date.now()}` };
    updateCustomerUser({
      addresses: [...customerUser.addresses.map(a => (newAddr.isDefault ? { ...a, isDefault: false } : a)), address],
    });
  };

  const updateCustomerAddress = (addressId: string, updates: Partial<CustomerAddress>) => {
    updateCustomerUser({
      addresses: customerUser.addresses.map(a => {
        if (a.id === addressId) return { ...a, ...updates };
        if (updates.isDefault) return { ...a, isDefault: false };
        return a;
      }),
    });
  };

  const deleteCustomerAddress = (addressId: string) => {
    updateCustomerUser({
      addresses: customerUser.addresses.filter(a => a.id !== addressId),
    });
  };

  const setDefaultAddress = (addressId: string) => {
    updateCustomerUser({
      addresses: customerUser.addresses.map(a => ({ ...a, isDefault: a.id === addressId })),
    });
  };

  const toggleCustomerSuspension = (customerId: string) => {
    setCustomers(prev => prev.map(c => (c.id === customerId ? { ...c, isSuspended: !c.isSuspended } : c)));
  };

  const registerCustomer = (data: {
    name: string;
    phone: string;
    email?: string;
    addressLine: string;
    locality: string;
    pincode: string;
    city?: string;
    state?: string;
  }) => {
    const newId = `cust_${Date.now()}`;
    const newCustomer: CustomerUser = {
      id: newId,
      customerCode: `SHAH-CUST-${8600 + customers.length + 1}`,
      name: data.name,
      phone: data.phone,
      phoneVerified: Boolean(phoneProofToken),
      email: data.email,
      addresses: [
        {
          id: `addr_${Date.now()}`,
          label: 'Home',
          addressLine: data.addressLine,
          locality: data.locality,
          city: data.city || 'Delhi',
          state: data.state || 'Delhi',
          pincode: data.pincode,
          isDefault: true,
        },
      ],
      isSuspended: false,
      totalOrders: 0,
      totalSpent: 0,
      rewardPoints: 0,
      referralCode: `${data.name.split(' ')[0].toUpperCase()}-SHAH${Math.floor(10 + Math.random() * 89)}`,
      createdAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    setActiveCustomerId(newId);
    return newCustomer;
  };

  // Partners
  const [partners, setPartners] = useState<Partner[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.PARTNERS, INITIAL_PARTNERS)
  );
  const [activePartnerId, setActivePartnerIdState] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_PARTNER) || INITIAL_PARTNERS[0].id;
  });
  const setActivePartnerId = (id: string) => {
    setActivePartnerIdState(id);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_PARTNER, id);
  };
  const activePartner = partners.find(p => p.id === activePartnerId) || partners[0];

  const updatePartnerProfile = (partnerId: string, updates: Partial<Partner>) => {
    setPartners(prev => prev.map(p => (p.id === partnerId ? { ...p, ...updates } : p)));
  };

  const togglePartnerStatus = (partnerId: string, status: 'active' | 'pending' | 'suspended') => {
    setPartners(prev =>
      prev.map(p =>
        p.id === partnerId
          ? {
              ...p,
              status,
              kycVerified: status === 'active' ? true : p.kycVerified,
            }
          : p
      )
    );
    addActivityLog(
      'PARTNER_STATUS_CHANGED',
      'SUPER_ADMIN',
      adminUser.name,
      `Partner ${partnerId} status updated to ${status.toUpperCase()}.`,
      status === 'suspended' ? 'warning' : 'success'
    );
  };

  const togglePartnerOnline = (partnerId: string) => {
    setPartners(prev => prev.map(p => (p.id === partnerId ? { ...p, isOnline: !p.isOnline } : p)));
  };

  const togglePartnerCommissionBlock = (partnerId: string, blocked: boolean) => {
    setPartners(prev => prev.map(p => (p.id === partnerId ? { ...p, commissionBlocked: blocked } : p)));
    addActivityLog(
      'PARTNER_COMMISSION_GATE',
      'SUPER_ADMIN',
      adminUser.name,
      `Partner ${partnerId} commission block set to ${blocked}.`,
      blocked ? 'warning' : 'success'
    );
  };

  const registerPartner = (data: {
    name: string;
    phone: string;
    email?: string;
    businessName: string;
    serviceAddress: string;
    pincode: string;
    city?: string;
    state?: string;
    servicesOffered: ServiceType[];
    workingHours: string;
    upiId?: string;
  }): Partner => {
    const newId = `partner_${Date.now()}`;
    const newPartner: Partner = {
      id: newId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      businessName: data.businessName,
      hubName: `SHAH SIGNATURE ${data.businessName} Point`,
      partnerCode: `SHAH-PRT-${Math.floor(1000 + Math.random() * 9000)}`,
      serviceAddress: data.serviceAddress,
      pincode: data.pincode,
      servicePincodes: [data.pincode],
      city: data.city || 'Delhi',
      state: data.state || 'Delhi',
      serviceArea: `PIN ${data.pincode} ${data.city || ''}`,
      workingHours: data.workingHours || '08:00 AM - 08:00 PM IST',
      upiId: data.upiId,
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
      servicesOffered: data.servicesOffered,
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
      joinedDate: new Date().toISOString().split('T')[0],
    };

    setPartners(prev => [...prev, newPartner]);
    setActivePartnerId(newId);
    return newPartner;
  };

  const uploadPartnerDocument = (partnerId: string, docData: Omit<PartnerDocument, 'id' | 'uploadedAt' | 'status'>) => {
    const newDoc: PartnerDocument = {
      ...docData,
      id: `doc_${Date.now()}`,
      uploadedAt: new Date().toISOString().split('T')[0],
      status: 'pending',
    };
    setPartners(prev => prev.map(p => (p.id === partnerId ? { ...p, documents: [...p.documents, newDoc] } : p)));
  };

  const verifyPartnerDocument = (partnerId: string, docId: string, status: 'verified' | 'rejected', reason?: string) => {
    setPartners(prev =>
      prev.map(p => {
        if (p.id === partnerId) {
          const updatedDocs = p.documents.map(d => (d.id === docId ? { ...d, status, rejectionReason: reason } : d));
          const hasVerifiedDoc = updatedDocs.some(d => d.status === 'verified');
          return { ...p, documents: updatedDocs, kycVerified: hasVerifiedDoc };
        }
        return p;
      })
    );
  };

  // Service Categories, Garments, Areas, Settings & Coupons
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryConfig[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.SERVICES, INITIAL_SERVICE_CATEGORIES)
  );
  const addServiceCategory = (cat: ServiceCategoryConfig) => {
    setServiceCategories(prev => [...prev.filter(c => c.id !== cat.id), cat]);
  };
  const updateServiceCategory = (id: ServiceType, updates: Partial<ServiceCategoryConfig>) => {
    setServiceCategories(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };
  const toggleServiceCategory = (id: ServiceType) => {
    setServiceCategories(prev => prev.map(c => (c.id === id ? { ...c, isActive: !c.isActive } : c)));
  };

  const [garments, setGarments] = useState<GarmentItem[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.GARMENTS, INITIAL_GARMENTS)
  );
  const addGarment = (newItem: Omit<GarmentItem, 'id'>) => {
    setGarments(prev => [...prev, { ...newItem, id: `item_${Date.now()}`, isActive: true }]);
  };
  const updateGarment = (id: string, updates: Partial<GarmentItem>) => {
    setGarments(prev => prev.map(g => (g.id === id ? { ...g, ...updates } : g)));
  };
  const deleteGarment = (id: string) => {
    setGarments(prev => prev.filter(g => g.id !== id));
  };

  const [serviceAreas, setServiceAreas] = useState<ServiceAreaConfig[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.AREAS, INITIAL_SERVICE_AREAS)
  );
  const addServiceArea = (area: ServiceAreaConfig) => {
    setServiceAreas(prev => {
      const exists = prev.find(a => a.pincode === area.pincode);
      return exists ? prev.map(a => (a.pincode === area.pincode ? area : a)) : [...prev, area];
    });
  };
  const toggleServiceArea = (pincode: string) => {
    setServiceAreas(prev => prev.map(a => (a.pincode === pincode ? { ...a, isActive: !a.isActive } : a)));
  };
  const updateServiceArea = (pincode: string, updates: Partial<ServiceAreaConfig>) => {
    setServiceAreas(prev => prev.map(a => (a.pincode === pincode ? { ...a, ...updates } : a)));
  };

  const [settings, setSettings] = useState<PlatformSettings>(() =>
    readStorage(LOCAL_STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS)
  );
  const updateSettings = (newSettings: Partial<PlatformSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const [coupons, setCoupons] = useState<CouponOffer[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.COUPONS, INITIAL_COUPONS)
  );
  const addCoupon = (coupon: CouponOffer) => {
    setCoupons(prev => [coupon, ...prev.filter(c => c.code !== coupon.code)]);
  };
  const toggleCoupon = (code: string) => {
    setCoupons(prev => prev.map(c => (c.code === code ? { ...c, isActive: !c.isActive } : c)));
  };

  // Location & Pan-India Partner Gating
  const [selectedLocationPin, setSelectedLocationPin] = useState<string>('110086');

  const getEligiblePartnersForBooking = useCallback(
    (pincode: string, serviceType?: ServiceType, coords?: GeoCoordinates): Partner[] => {
      const cleanPin = pincode.trim();
      return partners
        .filter(p => {
          if (p.status !== 'active') return false;
          if (p.kycVerified === false) return false;
          if (!p.isOnline) return false;
          if (p.commissionBlocked) return false;
          const coversPin = p.pincode === cleanPin || (p.servicePincodes || []).includes(cleanPin);
          if (!coversPin) return false;
          if (serviceType && !p.servicesOffered.includes(serviceType)) return false;
          const activeCount = p.currentActiveOrders || 0;
          const cap = p.maxDailyCapacity || 25;
          if (activeCount >= cap) return false;
          return true;
        })
        .sort((a, b) => {
          const distA = computeHaversineKm(coords, a.coordinates);
          const distB = computeHaversineKm(coords, b.coordinates);
          if (distA !== distB) return distA - distB;
          if (b.rating !== a.rating) return b.rating - a.rating;
          return (a.currentActiveOrders || 0) - (b.currentActiveOrders || 0);
        });
    },
    [partners]
  );

  const isLocationServiceable = useCallback(
    (pincode: string, serviceType?: ServiceType) => {
      const cleanPin = pincode.trim();
      const area = serviceAreas.find(a => a.pincode === cleanPin && a.isActive);
      if (!area) {
        return {
          serviceable: false,
          eligiblePartners: [],
          reason: `PIN ${cleanPin} is not an active coverage zone yet. Ask Admin to enable PIN ${cleanPin} once verified partners onboard.`,
        };
      }
      const eligiblePartners = getEligiblePartnersForBooking(cleanPin, serviceType, area.coordinates);
      if (eligiblePartners.length === 0) {
        return {
          serviceable: false,
          area,
          eligiblePartners: [],
          reason: `Coverage zone ${area.areaName} (${cleanPin}) exists, but no KYC-approved online partner is currently available for this service.`,
        };
      }
      return { serviceable: true, area, eligiblePartners };
    },
    [serviceAreas, getEligiblePartnersForBooking]
  );

  // Orders & Ledger & Disputes & Retention State
  const [orders, setOrders] = useState<Order[]>(() => readStorage(LOCAL_STORAGE_KEYS.ORDERS, INITIAL_ORDERS));
  const [commissionLedger, setCommissionLedger] = useState<CommissionLedgerEntry[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.LEDGER, INITIAL_COMMISSION_LEDGER)
  );
  const [remittances, setRemittances] = useState<CommissionRemittance[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.REMITTANCES, [])
  );
  const [disputes, setDisputes] = useState<OrderDispute[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.DISPUTES, INITIAL_DISPUTES)
  );
  const [compensationRecords, setCompensationRecords] = useState<CompensationRecord[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.COMPENSATIONS, [])
  );
  const [reviews, setReviews] = useState<VerifiedReview[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS)
  );
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.PLANS, INITIAL_SUBSCRIPTION_PLANS)
  );
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.TICKETS, INITIAL_SUPPORT_TICKETS)
  );
  const [bulkEnquiries, setBulkEnquiries] = useState<BulkEnquiry[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.BULK, INITIAL_BULK_ENQUIRIES)
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(() => readStorage(LOCAL_STORAGE_KEYS.FAQS, INITIAL_FAQS));

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    readStorage(LOCAL_STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'notif_1',
        recipientRole: 'customer',
        title: 'Welcome to SHAH SIGNATURE',
        message: 'Verified garment care active in Delhi PIN 110086, 110085 & 110087.',
        timestamp: 'Just now',
        read: false,
      },
    ])
  );

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAllNotifications = () => setNotifications([]);

  // Persist slices to localStorage + sync backend server catalog/areas/partners
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.GARMENTS, JSON.stringify(garments)); }, [garments]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.SERVICES, JSON.stringify(serviceCategories)); }, [serviceCategories]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.PARTNERS, JSON.stringify(partners)); }, [partners]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.AREAS, JSON.stringify(serviceAreas)); }, [serviceAreas]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.COUPONS, JSON.stringify(coupons)); }, [coupons]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.LEDGER, JSON.stringify(commissionLedger)); }, [commissionLedger]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.REMITTANCES, JSON.stringify(remittances)); }, [remittances]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.DISPUTES, JSON.stringify(disputes)); }, [disputes]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.COMPENSATIONS, JSON.stringify(compensationRecords)); }, [compensationRecords]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.REVIEWS, JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.PLANS, JSON.stringify(subscriptionPlans)); }, [subscriptionPlans]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.TICKETS, JSON.stringify(supportTickets)); }, [supportTickets]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.BULK, JSON.stringify(bulkEnquiries)); }, [bulkEnquiries]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.FAQS, JSON.stringify(faqs)); }, [faqs]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications)); }, [notifications]);

  // Sync dynamic config & active orders to Express backend for authoritative API checks
  useEffect(() => {
    fetch('/api/marketplace/sync-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garments, serviceAreas, partners, settings, coupons, orders }),
    }).catch(() => {});
  }, [garments, serviceAreas, partners, settings, coupons, orders]);

  // Firebase Auth state tracking, boot connection check & Firestore listener
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      setFirebaseUid(user ? user.uid : null);
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (user) {
        try {
          const ordersCol = collection(db, 'orders');
          unsubscribeSnapshot = onSnapshot(
            ordersCol,
            snapshot => {
              if (!snapshot.empty) {
                const remoteOrders: Order[] = [];
                snapshot.forEach(docSnap => {
                  const data = docSnap.data();
                  if (data && data.id && data.orderNumber) {
                    remoteOrders.push(data as Order);
                  }
                });
                if (remoteOrders.length > 0) {
                  setOrders(prev => {
                    const orderMap = new window.Map(prev.map(o => [o.id, o]));
                    remoteOrders.forEach(ro => {
                      orderMap.set(ro.id, { ...(orderMap.get(ro.id) || {}), ...ro });
                    });
                    return Array.from(orderMap.values());
                  });
                }
              }
            },
            err => {
              console.warn('Firestore orders listener notice:', err.message);
            }
          );
        } catch (e) {
          console.warn('Could not initialize Firestore listener:', e);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Cart & Modals
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceType>('ironing_steam');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(orders[0]?.id || null);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | 'refund' | 'partner' | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalRole, setAuthModalRole] = useState<UserRole>('customer');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');

  const openAuthModal = (
    targetRole: UserRole = 'customer',
    mode: 'login' | 'register' | 'forgot' | 'reset' = 'login'
  ) => {
    setAuthModalRole(targetRole);
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const addToCart = (item: GarmentItem, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c => (c.item.id === item.id ? { ...c, quantity: c.quantity + quantity } : c));
      }
      return [...prev, { item, quantity, serviceType: item.category }];
    });
  };

  const updateCartQuantity = (garmentId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(garmentId);
      return;
    }
    setCart(prev => prev.map(c => (c.item.id === garmentId ? { ...c, quantity } : c)));
  };

  const removeFromCart = (garmentId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== garmentId));
  };

  const clearCart = () => setCart([]);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);

  // Strict customer/partner isolation
  const customerOrders = orders.filter(o => o.customerId === customerUser.id);
  const partnerOrders = orders.filter(o => o.assignedPartnerId === activePartner.id);

  // Admin & Logs
  const [adminUser] = useState<AdminUser>(INITIAL_ADMIN);
  const [activityLogs, setActivityLogs] = useState<SecurityActivityLog[]>(() =>
    readStorage('shah_logs_v1', INITIAL_ACTIVITY_LOGS)
  );

  const addActivityLog = (
    action: string,
    actorRole: AppRole | 'SYSTEM',
    actorName: string,
    details: string,
    status: 'success' | 'warning' | 'blocked' = 'success'
  ) => {
    const newLog: SecurityActivityLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      actorRole,
      actorName,
      details,
      status,
    };
    setActivityLogs(prev => {
      const updated = [newLog, ...prev.slice(0, 149)];
      localStorage.setItem('shah_logs_v1', JSON.stringify(updated));
      return updated;
    });
  };

  // ==================== ORDERS & SMART PARTNER DISPATCH ====================
  const createOrder = async (
    orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'logs' | 'status'>
  ): Promise<Order> => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const pinPrefix = (orderData.pincode || '110086').slice(-2);
    const orderNumber = `SS-${pinPrefix}-${randomSuffix}`;
    const id = `ord_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const serviceConfig = serviceCategories.find(s => s.id === orderData.serviceType);
    const commissionRate = serviceConfig?.commissionOverridePercent ?? settings.platformCommissionPercent;
    const platformCommissionAmount = Math.round((orderData.totalAmount * commissionRate) / 100);
    const partnerNetAmount = orderData.totalAmount - platformCommissionAmount;

    const candidates = getEligiblePartnersForBooking(
      orderData.pincode,
      orderData.serviceType,
      orderData.coordinates
    );
    const firstOfferPartner = candidates[0];
    const pickupOtp = orderData.pickupOtp || String(Math.floor(1000 + Math.random() * 9000));
    const deliveryOtp = orderData.deliveryOtp || String(Math.floor(1000 + Math.random() * 9000));
    const totalGarmentsCount = orderData.items.reduce((s, i) => s + i.quantity, 0);

    const newOrder: Order = {
      ...orderData,
      id,
      orderNumber,
      status: 'BOOKED',
      commissionRate,
      platformCommissionAmount,
      partnerNetAmount,
      paymentMethod: orderData.paymentMethod || 'direct_to_partner_upi',
      paymentStatus: 'pending_at_delivery',
      candidatePartnerQueue: candidates.map(c => c.id),
      rejectedPartnerIds: [],
      currentOfferPartnerId: firstOfferPartner?.id,
      offerExpiresAt: new Date(Date.now() + settings.broadcastTimeoutSeconds * 1000).toISOString(),
      pickupOtp,
      deliveryOtp,
      garmentEvidence: {
        orderId: id,
        tagReference: `TAG-${orderNumber}`,
        expectedCount: totalGarmentsCount,
        verifiedCount: totalGarmentsCount,
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
      createdAt: nowIso,
      updatedAt: nowIso,
      logs: [
        {
          timestamp: timeFormatted,
          status: 'BOOKED',
          note: `Booking confirmed by ${orderData.customerName} (${orderData.pickupSlot}). Smart dispatch queued ${candidates.length} eligible partner(s); primary offer sent to ${firstOfferPartner ? firstOfferPartner.name : 'Admin Queue'}.`,
          actor: 'Smart Dispatch Engine',
        },
      ],
    };

    setOrders(prev => [newOrder, ...prev]);
    setActiveTrackingOrderId(newOrder.id);
    clearCart();

    // Update customer order count & deduct redeemed reward points if used
    setCustomers(prev =>
      prev.map(c => {
        if (c.id !== orderData.customerId) return c;
        const remainingPts = Math.max(0, (c.rewardPoints || 0) - (orderData.rewardPointsUsed || 0));
        return {
          ...c,
          totalOrders: c.totalOrders + 1,
          totalSpent: c.totalSpent + orderData.totalAmount,
          rewardPoints: remainingPts,
        };
      })
    );

    if (firstOfferPartner) {
      setPartners(prev =>
        prev.map(p => {
          if (p.id !== firstOfferPartner.id || !p.performance) return p;
          const totalOffered = p.performance.totalOffered + 1;
          return {
            ...p,
            performance: {
              ...p.performance,
              totalOffered,
              acceptanceRate: Math.round((p.performance.totalAccepted / totalOffered) * 100),
              rejectionRate: Math.round((p.performance.totalRejected / totalOffered) * 100),
            },
          };
        })
      );
    }

    persistDocumentSafe('orders', newOrder.id, newOrder, 'set').catch(() => {});
    addActivityLog(
      'ORDER_BOOKED_SMART_DISPATCH',
      'CUSTOMER',
      orderData.customerName,
      `Order ${orderNumber} placed in PIN ${orderData.pincode}. Offered first to ${firstOfferPartner?.name || 'Admin Manual Queue'}.`,
      'success'
    );

    addNotification({
      recipientRole: 'partner',
      recipientId: firstOfferPartner?.id,
      title: `Priority Dispatch Offer: ${orderNumber}`,
      message: `Nearest match at ${orderData.locality}, PIN ${orderData.pincode} (${totalGarmentsCount} garments). Respond within ${settings.broadcastTimeoutSeconds}s.`,
      orderId: newOrder.id,
    });

    return newOrder;
  };

  const ensureLedgerEntryForOrder = (order: Order, partner: Partner) => {
    setCommissionLedger(prev => {
      if (prev.some(entry => entry.orderId === order.id)) return prev;
      const rate = partner.customCommissionPercent ?? order.commissionRate ?? settings.platformCommissionPercent;
      const commAmt = Math.round((order.totalAmount * rate) / 100);
      const netShare = order.totalAmount - commAmt;
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const entry: CommissionLedgerEntry = {
        id: `led_${order.id}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        partnerId: partner.id,
        partnerName: partner.name,
        weekKey: getCurrentWeekKey(),
        orderTotal: order.totalAmount,
        commissionRate: rate,
        commissionAmount: commAmt,
        partnerNetShare: netShare,
        remittanceStatus: 'unpaid',
        dueDate,
        createdAt: new Date().toISOString(),
      };
      return [entry, ...prev];
    });
  };

  const acceptOrder = (orderId: string, partnerId: string): { success: boolean; message: string } => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return { success: false, message: 'Order not found.' };

    if (targetOrder.assignedPartnerId && targetOrder.assignedPartnerId !== partnerId) {
      return {
        success: false,
        message: `Order was already claimed by ${targetOrder.assignedPartnerName || 'another partner'}.`,
      };
    }

    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return { success: false, message: 'Partner profile invalid.' };
    if (partner.status !== 'active' || partner.kycVerified === false) {
      return { success: false, message: 'Partner KYC approval required before accepting orders.' };
    }
    if (partner.commissionBlocked) {
      return { success: false, message: 'Order acceptance paused due to overdue commission remittance. Submit UTR to Admin.' };
    }
    if (!partner.isOnline) {
      return { success: false, message: 'Toggle status to ONLINE to accept incoming orders.' };
    }

    const activeLoad = partner.currentActiveOrders || 0;
    const cap = partner.maxDailyCapacity || 25;
    if (activeLoad >= cap) {
      return { success: false, message: `Daily capacity limit reached (${activeLoad}/${cap} active orders).` };
    }

    // Fire server-side atomic lock check asynchronously for cross-client audit
    fetch('/api/orders/accept-atomic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, partnerId, partnerName: partner.name }),
    }).catch(() => {});

    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: 'PARTNER_ASSIGNED',
          assignedPartnerId: partner.id,
          assignedPartnerName: partner.name,
          assignedPartnerPhone: partner.phone,
          currentOfferPartnerId: undefined,
          assignedAt: nowIso,
          acceptedAt: nowIso,
          updatedAt: nowIso,
          logs: [
            ...o.logs,
            {
              timestamp: timeFormatted,
              status: 'PARTNER_ASSIGNED',
              note: `Exclusively locked & assigned to ${partner.name} (${partner.hubName}).`,
              actor: partner.name,
            },
          ],
        };
      })
    );

    setPartners(prev =>
      prev.map(p => {
        if (p.id !== partner.id) return p;
        const perf = p.performance;
        const accepted = (perf?.totalAccepted || 0) + 1;
        const offered = Math.max(accepted, perf?.totalOffered || accepted);
        return {
          ...p,
          currentActiveOrders: (p.currentActiveOrders || 0) + 1,
          performance: perf
            ? {
                ...perf,
                totalOffered: offered,
                totalAccepted: accepted,
                acceptanceRate: Math.round((accepted / offered) * 100),
              }
            : undefined,
        };
      })
    );

    ensureLedgerEntryForOrder(targetOrder, partner);

    addNotification({
      recipientRole: 'customer',
      recipientId: targetOrder.customerId,
      title: `Partner Assigned: ${partner.name}`,
      message: `Valet specialist ${partner.name} accepted order ${targetOrder.orderNumber}. Pickup OTP: ${targetOrder.pickupOtp || 'Verified at doorstep'}.`,
      orderId: targetOrder.id,
    });

    addActivityLog(
      'ORDER_ACCEPTED_ATOMIC',
      'SERVICE_PARTNER',
      partner.name,
      `Acquired atomic lock for ${targetOrder.orderNumber}.`,
      'success'
    );

    return { success: true, message: 'Order exclusively assigned to you!' };
  };

  const rejectOrderOffer = (
    orderId: string,
    partnerId: string,
    reason = 'Busy / capacity unavailable'
  ): { success: boolean; escalatedTo?: string; message: string } => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.assignedPartnerId) {
      return { success: false, message: 'Order already assigned or unavailable.' };
    }

    const rejectedList = Array.from(new Set([...(order.rejectedPartnerIds || []), partnerId]));
    const nextCandidates = getEligiblePartnersForBooking(order.pincode, order.serviceType, order.coordinates).filter(
      p => !rejectedList.includes(p.id)
    );
    const nextPartner = nextCandidates[0];
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          rejectedPartnerIds: rejectedList,
          currentOfferPartnerId: nextPartner?.id,
          offerExpiresAt: nextPartner
            ? new Date(Date.now() + settings.broadcastTimeoutSeconds * 1000).toISOString()
            : undefined,
          logs: [
            ...o.logs,
            {
              timestamp: timeFormatted,
              status: o.status,
              note: nextPartner
                ? `Offer declined (${reason}). Automatically escalated to next eligible partner: ${nextPartner.name}.`
                : `Offer declined (${reason}). No more online candidates in queue — escalated to Super Admin.`,
              actor: 'Smart Dispatch Escalation',
            },
          ],
        };
      })
    );

    setPartners(prev =>
      prev.map(p => {
        if (p.id !== partnerId || !p.performance) return p;
        const totalRejected = p.performance.totalRejected + 1;
        const offered = Math.max(totalRejected, p.performance.totalOffered);
        return {
          ...p,
          performance: {
            ...p.performance,
            totalRejected,
            rejectionRate: Math.round((totalRejected / offered) * 100),
          },
        };
      })
    );

    if (nextPartner) {
      addNotification({
        recipientRole: 'partner',
        recipientId: nextPartner.id,
        title: `Escalated Dispatch Offer: ${order.orderNumber}`,
        message: `Assigned queue escalated to you in PIN ${order.pincode}.`,
        orderId: order.id,
      });
    } else {
      addNotification({
        recipientRole: 'admin',
        title: `Admin Dispatch Attention Needed: ${order.orderNumber}`,
        message: `All eligible partners in PIN ${order.pincode} declined/timed out. Manual assignment needed.`,
        orderId: order.id,
      });
    }

    return {
      success: true,
      escalatedTo: nextPartner?.name,
      message: nextPartner
        ? `Offer passed and automatically escalated to ${nextPartner.name}.`
        : 'Offer passed; escalated to Super Admin desk.',
    };
  };

  // Automatic timeout escalation watcher
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      orders.forEach(o => {
        const canonical = normalizeOrderStatus(o.status);
        if (
          canonical === 'BOOKED' &&
          !o.assignedPartnerId &&
          o.currentOfferPartnerId &&
          o.offerExpiresAt &&
          new Date(o.offerExpiresAt).getTime() < now
        ) {
          rejectOrderOffer(o.id, o.currentOfferPartnerId, 'Acceptance window timed out');
        }
      });
    }, 15000);
    return () => clearInterval(interval);
  });

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus, customNote?: string, reason?: string) => {
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();
    const canonicalNew = normalizeOrderStatus(newStatus);

    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        const prevCanonical = normalizeOrderStatus(o.status);
        const defaultNotes: Record<string, string> = {
          BOOKED: 'Order placed and queued for partner assignment.',
          PARTNER_ASSIGNED: `Valet specialist ${o.assignedPartnerName || 'Assigned'} confirmed the order.`,
          PICKUP_SCHEDULED: `Doorstep pickup scheduled for ${o.pickupSlot}.`,
          PICKED_UP: `Garments collected, counted & tagged at doorstep.`,
          PROCESSING: `Garments in artisan cleaning / steam pressing at workshop.`,
          READY_FOR_DELIVERY: `Quality inspection passed. Sealed in protective wardrobe cover.`,
          OUT_FOR_DELIVERY: `Valet en route for delivery to ${o.customerAddress}.`,
          DELIVERED: `Delivered & direct payment settled to partner.`,
          CANCELLED: reason || customNote || 'Order cancelled.',
          DISPUTED: reason || customNote || 'Order flagged for dispute review.',
        };

        const note = customNote || defaultNotes[canonicalNew] || `Status updated to ${canonicalNew}`;

        // When transitioning to DELIVERED for the first time, update partner totals, ledger & customer reward points
        if (canonicalNew === 'DELIVERED' && prevCanonical !== 'DELIVERED') {
          const commRate = o.commissionRate ?? settings.platformCommissionPercent;
          const commAmt = Math.round((o.totalAmount * commRate) / 100);
          const partnerShare = o.totalAmount - commAmt;

          if (o.assignedPartnerId) {
            setPartners(prevPartners =>
              prevPartners.map(p => {
                if (p.id !== o.assignedPartnerId) return p;
                return {
                  ...p,
                  walletBalance: p.walletBalance + partnerShare,
                  totalEarnings: p.totalEarnings + partnerShare,
                  commissionPending: (p.commissionPending || 0) + commAmt,
                  totalOrdersCompleted: p.totalOrdersCompleted + 1,
                  currentActiveOrders: Math.max(0, (p.currentActiveOrders || 1) - 1),
                };
              })
            );
          }

          const earnedPts = Math.floor((o.totalAmount / 100) * (settings.rewardPointsPerHundredRupees || 5));
          if (earnedPts > 0) {
            setCustomers(prevCust =>
              prevCust.map(c =>
                c.id === o.customerId ? { ...c, rewardPoints: (c.rewardPoints || 0) + earnedPts } : c
              )
            );
          }
        }

        if (canonicalNew === 'CANCELLED' && prevCanonical !== 'CANCELLED' && o.assignedPartnerId) {
          setPartners(prevPartners =>
            prevPartners.map(p =>
              p.id === o.assignedPartnerId
                ? { ...p, currentActiveOrders: Math.max(0, (p.currentActiveOrders || 1) - 1) }
                : p
            )
          );
        }

        return {
          ...o,
          status: canonicalNew,
          cancellationReason: reason || o.cancellationReason,
          pickedUpAt: canonicalNew === 'PICKED_UP' ? nowIso : o.pickedUpAt,
          deliveredAt: canonicalNew === 'DELIVERED' ? nowIso : o.deliveredAt,
          completedAt: canonicalNew === 'DELIVERED' ? nowIso : o.completedAt,
          paymentStatus: canonicalNew === 'DELIVERED' ? 'paid_to_partner' : o.paymentStatus,
          updatedAt: nowIso,
          logs: [
            ...o.logs,
            {
              timestamp: timeFormatted,
              status: canonicalNew,
              note,
              actor: o.assignedPartnerName || 'Operations',
            },
          ],
        };
      })
    );

    persistDocumentSafe('orders', orderId, { status: canonicalNew, updatedAt: nowIso }, 'update').catch(() => {});
  };

  const customerCancelOrder = (orderId: string, reason: string): { success: boolean; message: string } => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    const canonical = normalizeOrderStatus(order.status);
    if (!['BOOKED', 'PARTNER_ASSIGNED', 'PICKUP_SCHEDULED'].includes(canonical)) {
      return {
        success: false,
        message: 'Self-cancellation is only allowed before pickup. Please raise a support ticket for active processing orders.',
      };
    }
    updateOrderStatus(orderId, 'CANCELLED', `Cancelled by customer: ${reason}`, reason);
    addActivityLog('CUSTOMER_CANCELLED_ORDER', 'CUSTOMER', order.customerName, `Cancelled ${order.orderNumber}: ${reason}`, 'warning');
    return { success: true, message: `Order ${order.orderNumber} cancelled.` };
  };

  const adminAssignOrder = (orderId: string, partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId);
    const order = orders.find(o => o.id === orderId);
    if (!partner || !order) return;

    if (partner.status !== 'active') {
      addActivityLog('ADMIN_ASSIGN_BLOCKED', 'SUPER_ADMIN', adminUser.name, `Blocked assigning suspended/pending partner ${partner.name}`, 'blocked');
      return;
    }

    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: 'PARTNER_ASSIGNED',
          assignedPartnerId: partner.id,
          assignedPartnerName: partner.name,
          assignedPartnerPhone: partner.phone,
          currentOfferPartnerId: undefined,
          assignedAt: nowIso,
          updatedAt: nowIso,
          logs: [
            ...o.logs,
            {
              timestamp: timeFormatted,
              status: 'PARTNER_ASSIGNED',
              note: `Super Admin assigned order to ${partner.name} (${partner.hubName}).`,
              actor: 'Super Admin',
            },
          ],
        };
      })
    );

    ensureLedgerEntryForOrder(order, partner);
    addActivityLog('ADMIN_ASSIGNED_ORDER', 'SUPER_ADMIN', adminUser.name, `Assigned ${order.orderNumber} to ${partner.name}.`, 'success');
  };

  const adminCancelOrder = (orderId: string, reason: string) => {
    updateOrderStatus(orderId, 'CANCELLED', undefined, reason);
    addActivityLog('ADMIN_CANCELLED_ORDER', 'SUPER_ADMIN', adminUser.name, `Cancelled ${orderId}: ${reason}`, 'warning');
  };

  const rebookOrder = (order: Order) => {
    clearCart();
    order.items.forEach(line => {
      const catalogMatch = garments.find(g => g.id === line.garmentId) || {
        id: line.garmentId,
        nameEn: line.name,
        nameHi: line.name,
        category: order.serviceType,
        price: line.unitPrice,
      };
      addToCart(catalogMatch, line.quantity);
    });
    setSelectedCategory(order.serviceType);
    setSelectedLocationPin(order.pincode);
    setRole('customer');
    setIsBookingOpen(true);
  };

  // ==================== GARMENT EVIDENCE & OTP ====================
  const recordGarmentEvidence = (orderId: string, updates: Partial<GarmentEvidence>) => {
    const nowIso = new Date().toISOString();
    const targetOrder = orders.find(o => o.id === orderId);
    const roleUpper = role === 'admin' || role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : role === 'partner' || role === 'SERVICE_PARTNER' ? 'SERVICE_PARTNER' : 'CUSTOMER';
    const actorId =
      roleUpper === 'SUPER_ADMIN'
        ? adminUser.id
        : roleUpper === 'SERVICE_PARTNER'
        ? targetOrder?.assignedPartnerId || activePartner.id
        : targetOrder?.customerId || customerUser.id;

    fetch('/api/evidence/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {}),
      },
      body: JSON.stringify({ orderId, actorRole: roleUpper, actorId, updates }),
    }).catch(() => {});

    setOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        const current: GarmentEvidence = o.garmentEvidence || {
          orderId: o.id,
          tagReference: `TAG-${o.orderNumber}`,
          expectedCount: o.items.reduce((s, i) => s + i.quantity, 0),
          verifiedCount: o.items.reduce((s, i) => s + i.quantity, 0),
          hasPreExistingDamage: false,
          damageNotes: '',
          stainChecklist: [],
          pickupPhotoUrls: [],
          beforeServicePhotoUrls: [],
          afterServicePhotoUrls: [],
          deliveryPhotoUrls: [],
          customerSignOff: false,
          pickupOtp: o.pickupOtp,
          pickupOtpVerified: false,
          deliveryOtp: o.deliveryOtp,
          deliveryOtpVerified: false,
          recordedAt: nowIso,
        };
        const merged: GarmentEvidence = {
          ...current,
          ...updates,
          recordedAt: current.recordedAt || nowIso,
          updatedAt: nowIso,
        };
        persistDocumentSafe('garment_evidence', `ev_${orderId}`, {
          id: `ev_${orderId}`,
          customerId: o.customerId,
          partnerId: o.assignedPartnerId,
          ...merged,
        }).catch(() => {});
        return {
          ...o,
          garmentEvidence: merged,
          logs: [
            ...o.logs,
            {
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: o.status,
              note: `Garment evidence updated (${merged.verifiedCount}/${merged.expectedCount} picked${typeof merged.deliveredCount === 'number' ? `, ${merged.deliveredCount} delivered` : ''}, Tag: ${merged.tagReference}).`,
              actor: roleUpper === 'CUSTOMER' ? o.customerName : o.assignedPartnerName || 'Valet Inspection',
            },
          ],
        };
      })
    );
  };

  const verifyHandoverOtp = (
    orderId: string,
    stage: 'pickup' | 'delivery',
    enteredOtp: string
  ): { success: boolean; message: string } => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    const expected = stage === 'pickup' ? order.pickupOtp : order.deliveryOtp;
    if (!expected || enteredOtp.trim() !== expected.trim()) {
      return { success: false, message: `Invalid ${stage} OTP. Ask the customer for their 4-digit ${stage} code.` };
    }
    if (stage === 'pickup') {
      recordGarmentEvidence(orderId, { pickupOtpVerified: true, customerSignOff: true, customerSignedAt: new Date().toISOString() });
      updateOrderStatus(orderId, 'PICKED_UP', `Pickup OTP ${expected} verified & garments sealed.`);
    } else {
      recordGarmentEvidence(orderId, {
        deliveryOtpVerified: true,
        deliveredCount: order.garmentEvidence?.deliveredCount ?? order.garmentEvidence?.verifiedCount ?? order.items.reduce((s, i) => s + i.quantity, 0),
        deliveryConfirmedByCustomer: true,
        deliveryConfirmedAt: new Date().toISOString(),
      });
      updateOrderStatus(orderId, 'DELIVERED', `Delivery OTP ${expected} verified. Direct payment confirmed.`);
    }
    return { success: true, message: `${stage === 'pickup' ? 'Pickup' : 'Delivery'} OTP verified!` };
  };

  const customerSignOffEvidence = (orderId: string) => {
    recordGarmentEvidence(orderId, { customerSignOff: true, customerSignedAt: new Date().toISOString() });
  };

  const confirmOrderDeliveryByCustomer = (orderId: string) => {
    recordGarmentEvidence(orderId, {
      deliveryConfirmedByCustomer: true,
      deliveryConfirmedAt: new Date().toISOString(),
    });
  };

  // ==================== COMMISSION LEDGER & REMITTANCES ====================
  const submitPartnerRemittance = (data: {
    partnerId: string;
    weekKey: string;
    ledgerEntryIds: string[];
    amountSubmitted: number;
    utrReference: string;
    paymentMode: 'UPI' | 'IMPS' | 'NEFT' | 'BANK_TRANSFER';
    proofFileName?: string;
    notes?: string;
  }): CommissionRemittance => {
    const partner = partners.find(p => p.id === data.partnerId);
    const id = `rem_${Date.now()}`;
    const remittance: CommissionRemittance = {
      id,
      partnerId: data.partnerId,
      partnerName: partner?.name || data.partnerId,
      weekKey: data.weekKey,
      ledgerEntryIds: data.ledgerEntryIds,
      amountDue: data.amountSubmitted,
      amountSubmitted: data.amountSubmitted,
      utrReference: data.utrReference.trim(),
      paymentMode: data.paymentMode,
      proofFileName: data.proofFileName,
      notes: data.notes,
      status: 'pending_verification',
      submittedAt: new Date().toISOString(),
    };

    setRemittances(prev => [remittance, ...prev]);
    setCommissionLedger(prev =>
      prev.map(entry =>
        data.ledgerEntryIds.includes(entry.id)
          ? { ...entry, remittanceStatus: 'submitted', remittanceId: id, utrReference: remittance.utrReference }
          : entry
      )
    );

    addNotification({
      recipientRole: 'admin',
      title: `Commission UTR Submitted: ${remittance.partnerName}`,
      message: `₹${remittance.amountSubmitted} via ${remittance.paymentMode} (UTR: ${remittance.utrReference}) awaiting Admin verification.`,
    });
    addActivityLog(
      'COMMISSION_UTR_SUBMITTED',
      'SERVICE_PARTNER',
      remittance.partnerName,
      `Submitted remittance ₹${remittance.amountSubmitted} (UTR ${remittance.utrReference}).`,
      'warning'
    );
    return remittance;
  };

  const verifyPartnerRemittance = (remittanceId: string, decision: 'verified' | 'rejected', adminNotes?: string) => {
    const target = remittances.find(r => r.id === remittanceId);
    if (!target) return;
    const nowIso = new Date().toISOString();

    setRemittances(prev =>
      prev.map(r =>
        r.id === remittanceId
          ? { ...r, status: decision, adminNotes, verifiedAt: nowIso, verifiedBy: adminUser.name }
          : r
      )
    );

    setCommissionLedger(prev =>
      prev.map(entry => {
        if (!target.ledgerEntryIds.includes(entry.id)) return entry;
        return {
          ...entry,
          remittanceStatus: decision === 'verified' ? 'verified' : 'unpaid',
          verifiedBy: decision === 'verified' ? adminUser.name : undefined,
          verifiedAt: decision === 'verified' ? nowIso : undefined,
        };
      })
    );

    if (decision === 'verified') {
      setPartners(prev =>
        prev.map(p =>
          p.id === target.partnerId
            ? {
                ...p,
                commissionPaid: p.commissionPaid + target.amountSubmitted,
                commissionPending: Math.max(0, (p.commissionPending || 0) - target.amountSubmitted),
                commissionOverdue: 0,
                commissionBlocked: false,
              }
            : p
        )
      );
    }

    addActivityLog(
      decision === 'verified' ? 'COMMISSION_VERIFIED' : 'COMMISSION_REJECTED',
      'SUPER_ADMIN',
      adminUser.name,
      `Remittance ${target.utrReference} (${target.partnerName}, ₹${target.amountSubmitted}) marked ${decision}.`,
      decision === 'verified' ? 'success' : 'blocked'
    );
  };

  // ==================== TWO-SIDED DISPUTES & FAIRNESS SYSTEM ====================
  const createOrderDispute = (data: {
    orderId: string;
    category: OrderDispute['category'];
    affectedGarmentDetails?: string;
    affectedQuantity?: number;
    description: string;
    requestedResolution?: RequestedResolutionType;
    requestedAmountInr?: number;
    customerPhotoUrls?: string[];
    supportingDocUrls?: string[];
    evidenceUnavailableNote?: string;
  }): OrderDispute | null => {
    const order = orders.find(o => o.id === data.orderId);
    if (!order) return null;
    const id = `disp_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const auditEntry: DisputeAuditEntry = {
      id: `da_${Date.now()}`,
      timestamp: nowIso,
      actorRole: 'CUSTOMER',
      actorName: order.customerName,
      action: 'CLAIM_SUBMITTED',
      toStatus: 'CLAIM_SUBMITTED',
      note: `Claim submitted for ${data.category.replace(/_/g, ' ')}${(data.customerPhotoUrls?.length || 0) === 0 ? ' (filed without photos — eligible for full Admin evidence review)' : ''}.`,
    };

    const dispute: OrderDispute = {
      id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      partnerId: order.assignedPartnerId || 'unassigned',
      partnerName: order.assignedPartnerName || 'Unassigned Hub',
      category: data.category,
      affectedGarmentDetails: data.affectedGarmentDetails?.trim() || undefined,
      affectedQuantity: data.affectedQuantity || 1,
      description: data.description.trim(),
      requestedResolution: data.requestedResolution || 'partial_refund',
      requestedAmountInr: typeof data.requestedAmountInr === 'number' && data.requestedAmountInr >= 0 ? data.requestedAmountInr : undefined,
      customerPhotoUrls: data.customerPhotoUrls || [],
      supportingDocUrls: data.supportingDocUrls || [],
      evidenceUnavailableNote: data.evidenceUnavailableNote?.trim() || undefined,
      status: 'CLAIM_SUBMITTED',
      credibilityAssessment: 'pending_review',
      adminQuestions: [],
      auditTrail: [auditEntry],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setDisputes(prev => [dispute, ...prev]);
    setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, hasDispute: true, disputeId: id, status: 'DISPUTED' } : o)));

    persistDocumentSafe('disputes', id, dispute).catch(() => {});
    persistDocumentSafe('dispute_audit_logs', auditEntry.id, { disputeId: id, ...auditEntry }).catch(() => {});

    fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispute),
    }).catch(() => {});

    if (order.assignedPartnerId) {
      setPartners(prev =>
        prev.map(p =>
          p.id === order.assignedPartnerId && p.performance
            ? {
                ...p,
                performance: {
                  ...p.performance,
                  disputesCount: p.performance.disputesCount + 1,
                  complaintsCount: p.performance.complaintsCount + 1,
                  complaintRate: Math.round(((p.performance.complaintsCount + 1) / Math.max(1, p.totalOrdersCompleted)) * 100),
                },
              }
            : p
        )
      );
    }

    addNotification({
      recipientRole: 'partner',
      recipientId: order.assignedPartnerId,
      title: `Damage / Issue Claim: ${order.orderNumber}`,
      message: `Customer filed ${data.category.replace(/_/g, ' ')}. Review pickup/service evidence & submit your response.`,
      orderId: order.id,
    });
    addNotification({
      recipientRole: 'admin',
      title: `New Customer Protection Claim: ${order.orderNumber}`,
      message: `${order.customerName} filed ${data.category.replace(/_/g, ' ')} claim against ${order.assignedPartnerName || 'partner'}.`,
      orderId: order.id,
    });
    addActivityLog('DISPUTE_OPENED', 'CUSTOMER', order.customerName, `Opened claim ${id} (${data.category}) on ${order.orderNumber}.`, 'warning');
    return dispute;
  };

  const respondToDispute = (
    disputeId: string,
    responseOrPayload:
      | string
      | {
          partnerResponse: string;
          preExistingDamageReported?: boolean;
          preExistingNotes?: string;
          partnerPickupPhotoUrls?: string[];
          partnerServicePhotoUrls?: string[];
          partnerDeliveryPhotoUrls?: string[];
          questionAnswers?: Record<string, string>;
        },
    partnerPhotoUrls: string[] = []
  ) => {
    const nowIso = new Date().toISOString();
    const payload =
      typeof responseOrPayload === 'string'
        ? {
            partnerResponse: responseOrPayload,
            partnerPickupPhotoUrls: partnerPhotoUrls,
          }
        : responseOrPayload;

    const target = disputes.find(d => d.id === disputeId);
    if (!target) return;

    const prevStatus = normalizeDisputeStatus(target.status);
    const qAnswers = payload.questionAnswers || {};
    const updatedQuestions: DisputeQuestion[] = (target.adminQuestions || []).map(q =>
      q.targetRole === 'partner' && qAnswers[q.id]?.trim()
        ? { ...q, answer: qAnswers[q.id].trim(), answeredAt: nowIso }
        : q
    );

    const pickupImgs = payload.partnerPickupPhotoUrls || [];
    const serviceImgs = payload.partnerServicePhotoUrls || [];
    const deliveryImgs = payload.partnerDeliveryPhotoUrls || [];
    const combinedImgs = [...pickupImgs, ...serviceImgs, ...deliveryImgs, ...partnerPhotoUrls];

    const auditEntry: DisputeAuditEntry = {
      id: `da_${Date.now()}`,
      timestamp: nowIso,
      actorRole: 'SERVICE_PARTNER',
      actorName: target.partnerName || activePartner.name,
      action: 'PARTNER_EVIDENCE_SUBMITTED',
      fromStatus: prevStatus,
      toStatus: 'EVIDENCE_REVIEW',
      note: `Partner explanation submitted${payload.preExistingDamageReported ? ' (pre-existing damage cited)' : ''}.`,
    };

    const updatedDispute: OrderDispute = {
      ...target,
      partnerResponse: payload.partnerResponse.trim(),
      partnerPreExistingDamageReported: Boolean(payload.preExistingDamageReported) || target.partnerPreExistingDamageReported,
      partnerPreExistingNotes: payload.preExistingNotes?.trim() || target.partnerPreExistingNotes,
      partnerPickupPhotoUrls: [...(target.partnerPickupPhotoUrls || []), ...pickupImgs],
      partnerServicePhotoUrls: [...(target.partnerServicePhotoUrls || []), ...serviceImgs],
      partnerDeliveryPhotoUrls: [...(target.partnerDeliveryPhotoUrls || []), ...deliveryImgs],
      partnerPhotoUrls: [...(target.partnerPhotoUrls || []), ...combinedImgs],
      partnerRespondedAt: nowIso,
      adminQuestions: updatedQuestions,
      status: 'EVIDENCE_REVIEW',
      auditTrail: [...(target.auditTrail || []), auditEntry],
      updatedAt: nowIso,
    };

    setDisputes(prev => prev.map(d => (d.id === disputeId ? updatedDispute : d)));
    persistDocumentSafe('disputes', disputeId, updatedDispute).catch(() => {});
    persistDocumentSafe('dispute_audit_logs', auditEntry.id, { disputeId, ...auditEntry }).catch(() => {});

    fetch(`/api/disputes/${disputeId}/partner-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerId: target.partnerId,
        partnerResponse: payload.partnerResponse,
        preExistingDamageReported: payload.preExistingDamageReported,
        preExistingNotes: payload.preExistingNotes,
        partnerPickupPhotoUrls: pickupImgs,
        partnerServicePhotoUrls: serviceImgs,
        partnerDeliveryPhotoUrls: deliveryImgs,
        questionAnswers: qAnswers,
      }),
    }).catch(() => {});

    addNotification({
      recipientRole: 'admin',
      title: `Partner Responded: ${target.orderNumber}`,
      message: `${target.partnerName} submitted counter-evidence. Ready for Admin adjudication.`,
      orderId: target.orderId,
    });
    addActivityLog('DISPUTE_PARTNER_RESPONSE', 'SERVICE_PARTNER', target.partnerName, `Submitted counter-evidence for ${disputeId}.`, 'success');
  };

  const submitCustomerFollowUp = (
    disputeId: string,
    payload: {
      followUpNote: string;
      photoUrls?: string[];
      questionAnswers?: Record<string, string>;
    }
  ) => {
    const nowIso = new Date().toISOString();
    const target = disputes.find(d => d.id === disputeId);
    if (!target) return;

    const prevStatus = normalizeDisputeStatus(target.status);
    const qAnswers = payload.questionAnswers || {};
    const updatedQuestions: DisputeQuestion[] = (target.adminQuestions || []).map(q =>
      q.targetRole === 'customer' && qAnswers[q.id]?.trim()
        ? { ...q, answer: qAnswers[q.id].trim(), answeredAt: nowIso }
        : q
    );

    const auditEntry: DisputeAuditEntry = {
      id: `da_${Date.now()}`,
      timestamp: nowIso,
      actorRole: 'CUSTOMER',
      actorName: target.customerName,
      action: 'CUSTOMER_FOLLOWUP_SUBMITTED',
      fromStatus: prevStatus,
      toStatus: 'EVIDENCE_REVIEW',
      note: payload.followUpNote.trim() || 'Customer responded to Admin follow-up request.',
    };

    const updatedDispute: OrderDispute = {
      ...target,
      customerFollowUpNote: payload.followUpNote.trim(),
      customerPhotoUrls: [...(target.customerPhotoUrls || []), ...(payload.photoUrls || [])],
      adminQuestions: updatedQuestions,
      status: 'EVIDENCE_REVIEW',
      auditTrail: [...(target.auditTrail || []), auditEntry],
      updatedAt: nowIso,
    };

    setDisputes(prev => prev.map(d => (d.id === disputeId ? updatedDispute : d)));
    persistDocumentSafe('disputes', disputeId, updatedDispute).catch(() => {});
    persistDocumentSafe('dispute_audit_logs', auditEntry.id, { disputeId, ...auditEntry }).catch(() => {});

    fetch(`/api/disputes/${disputeId}/customer-followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: target.customerId,
        followUpNote: payload.followUpNote,
        photoUrls: payload.photoUrls || [],
        questionAnswers: qAnswers,
      }),
    }).catch(() => {});

    addActivityLog('DISPUTE_CUSTOMER_FOLLOWUP', 'CUSTOMER', target.customerName, `Submitted follow-up details for ${disputeId}.`, 'success');
  };

  const adminUpdateDispute: AppContextType['adminUpdateDispute'] = (disputeId, payload) => {
    const target = disputes.find(d => d.id === disputeId);
    if (!target) return { success: false, message: 'Dispute record not found.' };

    const targetStatus = normalizeDisputeStatus(payload.nextStatus);

    if (
      ['RESOLUTION_PROPOSED', 'RESOLVED', 'REJECTED_WITH_REASON', 'CLOSED'].includes(targetStatus) &&
      (!payload.decisionReason || !payload.decisionReason.trim())
    ) {
      return {
        success: false,
        message: 'Fairness Policy: A written decision reason is required before proposing, resolving, rejecting, or closing a claim.',
      };
    }

    if (
      targetStatus === 'REJECTED_WITH_REASON' &&
      target.customerPhotoUrls.length === 0 &&
      (!payload.investigationFindings || payload.investigationFindings.trim().length < 10)
    ) {
      return {
        success: false,
        message: 'Fairness Policy: Claims submitted without photos cannot be rejected without documented investigation findings.',
      };
    }

    if (
      payload.restrictPartnerAccount &&
      !payload.urgentProtectiveAction &&
      (!payload.investigationFindings?.trim() || !payload.contractualBasis?.trim() || !payload.partnerRestrictionReason?.trim())
    ) {
      return {
        success: false,
        message: 'Fairness Policy: Partner account restriction requires documented findings, contractual basis, and written notice (unless urgent safety escalation).',
      };
    }

    if (
      payload.compensation &&
      payload.compensation.approvedAmountInr > 0 &&
      (!payload.compensation.valuationBasis || !payload.compensation.valuationBasis.trim())
    ) {
      return {
        success: false,
        message: 'Fairness Policy: Monetary compensation requires an explicit valuation basis (repair bill, service fee, etc.).',
      };
    }

    const nowIso = new Date().toISOString();
    const prevStatus = normalizeDisputeStatus(target.status);

    const updatedQuestions: DisputeQuestion[] = [...(target.adminQuestions || [])];
    if (payload.requestQuestion && payload.requestQuestion.question.trim()) {
      updatedQuestions.push({
        id: `dq_${Date.now()}`,
        targetRole: payload.requestQuestion.targetRole,
        question: payload.requestQuestion.question.trim(),
        askedBy: adminUser.name,
        askedAt: nowIso,
      });
    }

    let compRecord: CompensationRecord | undefined = target.compensationRecord;
    if (payload.compensation && Number.isFinite(payload.compensation.approvedAmountInr)) {
      compRecord = {
        id: compRecord?.id || `comp_${Date.now()}`,
        disputeId: target.id,
        orderId: target.orderId,
        orderNumber: target.orderNumber,
        compensationType: payload.compensation.compensationType,
        responsibleParty: payload.compensation.responsibleParty,
        approvedAmountInr: Math.max(0, Number(payload.compensation.approvedAmountInr)),
        valuationBasis: payload.compensation.valuationBasis.trim() || 'Admin reviewed adjustment',
        reason: (payload.decisionReason || payload.investigationFindings || 'Dispute adjudication').trim(),
        contractualBasis: (payload.contractualBasis || 'SHAH SIGNATURE Fair Garment Protection Policy').trim(),
        paymentResponsibility: payload.compensation.paymentResponsibility,
        settlementStatus:
          payload.compensation.settlementStatus ||
          (targetStatus === 'RESOLVED' ? 'approved_pending_payout' : 'proposed'),
        deductedFromCommission: false,
        approvedBy: adminUser.name,
        approvedAt: nowIso,
        settledAt: payload.compensation.settlementStatus === 'settled' ? nowIso : undefined,
        settlementReference: payload.compensation.settlementReference,
      };

      setCompensationRecords(prev => {
        const exists = prev.some(c => c.id === compRecord!.id);
        return exists ? prev.map(c => (c.id === compRecord!.id ? compRecord! : c)) : [compRecord!, ...prev];
      });
      persistDocumentSafe('compensation_records', compRecord.id, compRecord).catch(() => {});
    }

    const auditEntry: DisputeAuditEntry = {
      id: `da_${Date.now()}`,
      timestamp: nowIso,
      actorRole: 'SUPER_ADMIN',
      actorName: adminUser.name,
      action: `ADMIN_${targetStatus}`,
      fromStatus: prevStatus,
      toStatus: targetStatus,
      note: `${payload.decisionReason || payload.investigationFindings || payload.requestQuestion?.question || 'Admin updated claim'}${compRecord ? ` | Compensation ₹${compRecord.approvedAmountInr} (${compRecord.compensationType}, deductedFromCommission=false)` : ''}`,
    };

    const updatedDispute: OrderDispute = {
      ...target,
      status: targetStatus,
      investigationFindings: payload.investigationFindings?.trim() || target.investigationFindings,
      credibilityAssessment: payload.credibilityAssessment || target.credibilityAssessment,
      adminDecision: payload.adminDecision || target.adminDecision,
      decisionReason: payload.decisionReason?.trim() || target.decisionReason,
      contractualBasis: payload.contractualBasis?.trim() || target.contractualBasis,
      resolutionNote: payload.decisionReason?.trim() || target.resolutionNote,
      adminQuestions: updatedQuestions,
      compensationId: compRecord?.id || target.compensationId,
      compensationRecord: compRecord,
      partnerRestrictionApplied: Boolean(payload.restrictPartnerAccount) || target.partnerRestrictionApplied,
      partnerRestrictionReason: payload.partnerRestrictionReason?.trim() || target.partnerRestrictionReason,
      secondReviewDecision: prevStatus === 'APPEAL_REQUESTED' ? (payload.decisionReason?.trim() || target.secondReviewDecision) : target.secondReviewDecision,
      auditTrail: [...(target.auditTrail || []), auditEntry],
      resolvedAt: targetStatus === 'RESOLVED' || targetStatus === 'REJECTED_WITH_REASON' ? nowIso : target.resolvedAt,
      closedAt: targetStatus === 'CLOSED' ? nowIso : target.closedAt,
      updatedAt: nowIso,
    };

    setDisputes(prev => prev.map(d => (d.id === disputeId ? updatedDispute : d)));
    persistDocumentSafe('disputes', disputeId, updatedDispute).catch(() => {});
    persistDocumentSafe('dispute_audit_logs', auditEntry.id, { disputeId, ...auditEntry }).catch(() => {});

    if (payload.restrictPartnerAccount && target.partnerId && target.partnerId !== 'unassigned') {
      togglePartnerStatus(target.partnerId, 'suspended');
      addActivityLog(
        'PARTNER_DISPUTE_RESTRICTION',
        'SUPER_ADMIN',
        adminUser.name,
        `Suspended partner ${target.partnerName} after documented review (${payload.partnerRestrictionReason}).`,
        'warning'
      );
    }

    if ((targetStatus === 'RESOLVED' || targetStatus === 'REJECTED_WITH_REASON' || targetStatus === 'CLOSED')) {
      const linkedOrder = orders.find(o => o.id === target.orderId);
      if (linkedOrder && normalizeOrderStatus(linkedOrder.status) === 'DISPUTED') {
        updateOrderStatus(target.orderId, 'DELIVERED', `Claim ${target.id} marked ${targetStatus}: ${payload.decisionReason}`);
      }
    }

    if (authSession?.token) {
      fetch(`/api/disputes/${disputeId}/admin-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.token}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }

    addNotification({
      recipientRole: 'customer',
      recipientId: target.customerId,
      title: `Claim Update (${targetStatus.replace(/_/g, ' ')})`,
      message: `${target.orderNumber}: ${payload.decisionReason || payload.requestQuestion?.question || 'Super Admin updated your garment protection claim.'}`,
      orderId: target.orderId,
    });
    addNotification({
      recipientRole: 'partner',
      recipientId: target.partnerId,
      title: `Claim Review (${targetStatus.replace(/_/g, ' ')})`,
      message: `${target.orderNumber}: ${payload.decisionReason || payload.requestQuestion?.question || 'Admin updated dispute review.'}`,
      orderId: target.orderId,
    });

    addActivityLog('DISPUTE_ADMIN_UPDATE', 'SUPER_ADMIN', adminUser.name, `Updated ${disputeId} to ${targetStatus}.`, 'success');
    return { success: true, message: `Claim moved to ${targetStatus.replace(/_/g, ' ')}.`, dispute: updatedDispute };
  };

  const resolveDispute = (disputeId: string, decision: OrderDispute['adminDecision'], resolutionNote: string) => {
    adminUpdateDispute(disputeId, {
      nextStatus: 'RESOLVED',
      adminDecision: decision,
      decisionReason: resolutionNote,
      investigationFindings: 'Reviewed pickup, service & delivery records by Super Admin.',
    });
  };

  const appealDispute = (
    disputeId: string,
    appealNote: string,
    submittedBy: 'customer' | 'partner' = 'customer'
  ): { success: boolean; message: string } => {
    const target = disputes.find(d => d.id === disputeId);
    if (!target) return { success: false, message: 'Claim not found.' };

    const currentStatus = normalizeDisputeStatus(target.status);
    if (currentStatus !== 'RESOLVED' && currentStatus !== 'REJECTED_WITH_REASON') {
      return { success: false, message: 'Only RESOLVED or REJECTED_WITH_REASON decisions can be appealed.' };
    }
    if (!appealNote.trim() || appealNote.trim().length < 5) {
      return { success: false, message: 'Please enter a detailed appeal reason (min 5 chars).' };
    }

    const nowIso = new Date().toISOString();
    const auditEntry: DisputeAuditEntry = {
      id: `da_${Date.now()}`,
      timestamp: nowIso,
      actorRole: submittedBy === 'partner' ? 'SERVICE_PARTNER' : 'CUSTOMER',
      actorName: submittedBy === 'partner' ? target.partnerName : target.customerName,
      action: 'APPEAL_REQUESTED',
      fromStatus: currentStatus,
      toStatus: 'APPEAL_REQUESTED',
      note: appealNote.trim(),
    };

    const updated: OrderDispute = {
      ...target,
      status: 'APPEAL_REQUESTED',
      appealNote: appealNote.trim(),
      appealSubmittedBy: submittedBy,
      appealedAt: nowIso,
      auditTrail: [...(target.auditTrail || []), auditEntry],
      updatedAt: nowIso,
    };

    setDisputes(prev => prev.map(d => (d.id === disputeId ? updated : d)));
    persistDocumentSafe('disputes', disputeId, updated).catch(() => {});
    persistDocumentSafe('dispute_audit_logs', auditEntry.id, { disputeId, ...auditEntry }).catch(() => {});

    fetch(`/api/disputes/${disputeId}/appeal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: submittedBy === 'partner' ? 'SERVICE_PARTNER' : 'CUSTOMER',
        actorId: submittedBy === 'partner' ? target.partnerId : target.customerId,
        appealNote: appealNote.trim(),
      }),
    }).catch(() => {});

    addNotification({
      recipientRole: 'admin',
      title: `Second Review Appeal: ${target.orderNumber}`,
      message: `${auditEntry.actorName} requested an appeal: "${appealNote.trim()}"`,
      orderId: target.orderId,
    });
    addActivityLog('DISPUTE_APPEALED', auditEntry.actorRole, auditEntry.actorName, `Submitted appeal on ${disputeId}.`, 'warning');
    return { success: true, message: 'Appeal submitted for Super Admin second review.' };
  };

  const updateCompensationSettlement = (
    compId: string,
    settlementStatus: CompensationRecord['settlementStatus'],
    settlementReference?: string
  ) => {
    const nowIso = new Date().toISOString();
    setCompensationRecords(prev =>
      prev.map(c => {
        if (c.id !== compId) return c;
        const updated: CompensationRecord = {
          ...c,
          settlementStatus,
          settlementReference: settlementReference?.trim() || c.settlementReference,
          settledAt: settlementStatus === 'settled' ? nowIso : c.settledAt,
        };
        persistDocumentSafe('compensation_records', compId, updated).catch(() => {});
        return updated;
      })
    );
    setDisputes(prev =>
      prev.map(d =>
        d.compensationRecord?.id === compId
          ? {
              ...d,
              compensationRecord: {
                ...d.compensationRecord,
                settlementStatus,
                settlementReference: settlementReference?.trim() || d.compensationRecord.settlementReference,
                settledAt: settlementStatus === 'settled' ? nowIso : d.compensationRecord.settledAt,
              },
              updatedAt: nowIso,
            }
          : d
      )
    );
    addActivityLog('COMPENSATION_SETTLEMENT_UPDATED', 'SUPER_ADMIN', adminUser.name, `Compensation ${compId} -> ${settlementStatus}.`, 'success');
  };

  // ==================== RETENTION: REVIEWS, SUBSCRIPTIONS, SUPPORT, BULK, FAQS ====================
  const submitVerifiedReview = (data: { orderId: string; rating: number; comment: string }) => {
    const order = orders.find(o => o.id === data.orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (normalizeOrderStatus(order.status) !== 'DELIVERED') {
      return { success: false, message: 'Verified reviews can only be submitted after delivery is completed.' };
    }
    if (order.reviewSubmitted) {
      return { success: false, message: 'You have already submitted a verified review for this order.' };
    }
    if (!order.assignedPartnerId) {
      return { success: false, message: 'No partner was assigned to review.' };
    }

    const rev: VerifiedReview = {
      id: `rev_${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      partnerId: order.assignedPartnerId,
      partnerName: order.assignedPartnerName || 'Partner',
      rating: Math.min(5, Math.max(1, Number(data.rating))),
      comment: data.comment.trim(),
      serviceType: order.serviceType,
      isVerifiedDelivery: true,
      createdAt: new Date().toISOString(),
    };

    const nextReviews = [rev, ...reviews];
    setReviews(nextReviews);
    setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, reviewSubmitted: true } : o)));

    const partnerReviews = nextReviews.filter(r => r.partnerId === order.assignedPartnerId);
    const avgRating = Number(
      (partnerReviews.reduce((s, r) => s + r.rating, 0) / partnerReviews.length).toFixed(2)
    );
    setPartners(prev =>
      prev.map(p =>
        p.id === order.assignedPartnerId ? { ...p, rating: avgRating, reviewCount: partnerReviews.length } : p
      )
    );

    return { success: true, message: 'Thank you! Your verified delivery review has been published.' };
  };

  const addSubscriptionPlan = (plan: Omit<SubscriptionPlan, 'id'>) => {
    setSubscriptionPlans(prev => [...prev, { ...plan, id: `plan_${Date.now()}` }]);
  };
  const toggleSubscriptionPlan = (id: string) => {
    setSubscriptionPlans(prev => prev.map(p => (p.id === id ? { ...p, isActive: !p.isActive } : p)));
  };
  const subscribeCustomerToPlan = (planId: string) => {
    const plan = subscriptionPlans.find(p => p.id === planId);
    if (!plan) return;
    const now = new Date();
    const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    updateCustomerUser({
      activeSubscription: {
        planId: plan.id,
        planName: plan.name,
        pricePaid: plan.monthlyPrice,
        garmentCreditsRemaining: plan.includedGarments,
        startsAt: now.toISOString(),
        expiresAt: exp.toISOString(),
        status: 'active',
      },
    });
    addActivityLog('SUBSCRIPTION_ACTIVATED', 'CUSTOMER', customerUser.name, `Subscribed to ${plan.name}.`, 'success');
  };

  const redeemRewardPoints = (points: number) => {
    const available = customerUser.rewardPoints || 0;
    const usable = Math.min(available, Math.max(0, points));
    return usable * (settings.rewardPointValueInInr || 1);
  };

  const submitSupportTicket = (ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const nowIso = new Date().toISOString();
    const newTicket: SupportTicket = {
      ...ticket,
      id: `tkt_${Date.now()}`,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setSupportTickets(prev => [newTicket, ...prev]);
    addNotification({
      recipientRole: 'admin',
      title: `New Support Ticket: ${ticket.subject}`,
      message: `From ${ticket.senderName} (${ticket.senderPhone})`,
    });
    return newTicket;
  };

  const updateSupportTicket = (ticketId: string, status: SupportTicket['status'], adminReply?: string) => {
    setSupportTickets(prev =>
      prev.map(tkt =>
        tkt.id === ticketId
          ? { ...tkt, status, adminReply: adminReply ?? tkt.adminReply, updatedAt: new Date().toISOString() }
          : tkt
      )
    );
  };

  const submitBulkEnquiry = (enquiry: Omit<BulkEnquiry, 'id' | 'status' | 'createdAt'>) => {
    const item: BulkEnquiry = {
      ...enquiry,
      id: `bulk_${Date.now()}`,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    setBulkEnquiries(prev => [item, ...prev]);
    addNotification({
      recipientRole: 'admin',
      title: `Bulk Care Enquiry: ${enquiry.organizationName}`,
      message: `${enquiry.estimatedMonthlyGarments} garments/mo in ${enquiry.city} (${enquiry.pincode})`,
    });
    return item;
  };

  const updateBulkEnquiryStatus = (id: string, status: BulkEnquiry['status']) => {
    setBulkEnquiries(prev => prev.map(b => (b.id === id ? { ...b, status } : b)));
  };

  const addFaq = (faq: Omit<FaqItem, 'id'>) => {
    setFaqs(prev => [...prev, { ...faq, id: `faq_${Date.now()}` }]);
  };
  const toggleFaq = (id: string) => {
    setFaqs(prev => prev.map(f => (f.id === id ? { ...f, isActive: !f.isActive } : f)));
  };

  // ==================== AUTHENTICATION & SESSIONS ====================
  const setPhoneVerifiedSession = (phone: string, proofToken?: string) => {
    if (proofToken) {
      setPhoneProofToken(proofToken);
      localStorage.setItem('shah_phone_proof_v1', proofToken);
    }
    updateCustomerUser({ phone, phoneVerified: true });
    if (authSession) {
      const updated = { ...authSession, userPhone: phone, phoneVerified: true };
      setAuthSession(updated);
      localStorage.setItem('shah_auth_session_v3', JSON.stringify(updated));
    }
  };

  const loginAdmin = (credentials: { emailOrUsername: string; password?: string; token?: string }) => {
    const ident = credentials.emailOrUsername.trim().toLowerCase();
    if (
      ident === adminUser.email.toLowerCase() ||
      ident === adminUser.username.toLowerCase() ||
      ident === 'chinku.s1006@gmail.com'
    ) {
      setRole('admin');
      const session: AuthSession = {
        isAuthenticated: true,
        activeRole: 'SUPER_ADMIN',
        userId: adminUser.id,
        userName: adminUser.name,
        userEmail: ident,
        token: credentials.token,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };
      setAuthSession(session);
      localStorage.setItem('shah_auth_session_v3', JSON.stringify(session));
      addActivityLog('SUPER_ADMIN_LOGIN', 'SUPER_ADMIN', 'Ronak', 'Super Admin authenticated.', 'success');
      return { success: true, message: 'Super Admin access granted to Ronak.' };
    }
    addActivityLog('FAILED_ADMIN_LOGIN', 'SYSTEM', 'Unauthorized', `Failed admin attempt: ${credentials.emailOrUsername}`, 'blocked');
    return { success: false, message: 'Invalid credentials. Reserved exclusively for Super Admin.' };
  };

  const loginCustomer = (credentials: { emailOrCode: string; password?: string }) => {
    const ident = credentials.emailOrCode.trim().toLowerCase();
    const cleanDigits = ident.replace(/\D/g, '');
    const found = customers.find(
      c =>
        c.email?.toLowerCase() === ident ||
        c.customerCode?.toLowerCase() === ident ||
        c.username?.toLowerCase() === ident ||
        (cleanDigits.length >= 10 && c.phone.replace(/\D/g, '').endsWith(cleanDigits))
    );

    if (found) {
      if (found.isSuspended) {
        addActivityLog('SUSPENDED_CUSTOMER_LOGIN_BLOCKED', 'CUSTOMER', found.name, 'Suspended customer login blocked.', 'blocked');
        return { success: false, message: 'Account suspended. Contact SHAH SIGNATURE concierge.' };
      }
      setActiveCustomerId(found.id);
      setRole('customer');
      const session: AuthSession = {
        isAuthenticated: true,
        activeRole: 'CUSTOMER',
        userId: found.id,
        userName: found.name,
        userEmail: found.email,
        userPhone: found.phone,
        phoneVerified: found.phoneVerified,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };
      setAuthSession(session);
      localStorage.setItem('shah_auth_session_v3', JSON.stringify(session));
      addActivityLog('CUSTOMER_LOGIN_SUCCESS', 'CUSTOMER', found.name, `Customer ${found.customerCode || found.id} authenticated.`, 'success');
      return { success: true, customer: found, message: `Welcome back, ${found.name}!` };
    }
    return { success: false, message: 'No registered customer found. Please register or verify mobile OTP.' };
  };

  const loginPartner = (credentials: { emailOrCode: string; password?: string }) => {
    const ident = credentials.emailOrCode.trim().toLowerCase();
    const cleanDigits = ident.replace(/\D/g, '');
    const found = partners.find(
      p =>
        p.email?.toLowerCase() === ident ||
        p.partnerCode?.toLowerCase() === ident ||
        p.username?.toLowerCase() === ident ||
        (cleanDigits.length >= 10 && p.phone.replace(/\D/g, '').endsWith(cleanDigits))
    );

    if (found) {
      if (found.status === 'suspended') {
        addActivityLog('SUSPENDED_PARTNER_LOGIN_BLOCKED', 'SERVICE_PARTNER', found.name, 'Suspended partner login blocked.', 'blocked');
        return { success: false, message: 'Partner account suspended. Contact Administration.' };
      }
      setActivePartnerId(found.id);
      setRole('partner');
      const session: AuthSession = {
        isAuthenticated: true,
        activeRole: 'SERVICE_PARTNER',
        userId: found.id,
        userName: found.name,
        userEmail: found.email,
        userPhone: found.phone,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };
      setAuthSession(session);
      localStorage.setItem('shah_auth_session_v3', JSON.stringify(session));
      addActivityLog('PARTNER_LOGIN_SUCCESS', 'SERVICE_PARTNER', found.name, `Partner ${found.partnerCode} signed in.`, 'success');
      return { success: true, partner: found, message: `Welcome back, ${found.name}!` };
    }
    return { success: false, message: 'No partner account found. Please submit a Partner Application.' };
  };

  const registerCustomerAccount = (data: {
    name: string;
    phone: string;
    email: string;
    username?: string;
    password?: string;
    addressLine?: string;
    locality?: string;
    pincode?: string;
    referralCodeUsed?: string;
  }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = customers.find(c => c.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, customer: existing, message: 'Email already registered. Please sign in.' };
    }

    const newId = `cust_${Date.now()}`;
    const customerCode = `SHAH-CUST-${8600 + customers.length + 1}`;
    const referralBonus = data.referralCodeUsed ? settings.referralBonusPoints || 50 : 0;

    if (data.referralCodeUsed) {
      setCustomers(prev =>
        prev.map(c =>
          c.referralCode?.toUpperCase() === data.referralCodeUsed?.trim().toUpperCase()
            ? { ...c, rewardPoints: (c.rewardPoints || 0) + (settings.referralBonusPoints || 50) }
            : c
        )
      );
    }

    const newCustomer: CustomerUser = {
      id: newId,
      customerCode,
      name: data.name.trim(),
      phone: data.phone.trim(),
      phoneVerified: Boolean(phoneProofToken),
      email: cleanEmail,
      username: data.username || data.name.toLowerCase().replace(/\s+/g, '_'),
      addresses: [
        {
          id: `addr_${Date.now()}`,
          label: 'Home',
          addressLine: data.addressLine || 'Address on file',
          locality: data.locality || 'Local Area',
          pincode: data.pincode || '110086',
          isDefault: true,
        },
      ],
      isSuspended: false,
      totalOrders: 0,
      totalSpent: 0,
      rewardPoints: referralBonus,
      referralCode: `${data.name.trim().split(' ')[0].toUpperCase()}-SHAH${Math.floor(10 + Math.random() * 89)}`,
      referredByCode: data.referralCodeUsed?.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    setCustomers(prev => [newCustomer, ...prev]);
    setActiveCustomerId(newId);
    setRole('customer');
    addActivityLog('CUSTOMER_REGISTERED', 'CUSTOMER', newCustomer.name, `Customer ${customerCode} registered.`, 'success');
    return { success: true, customer: newCustomer, message: `Welcome! Customer ID: ${customerCode}.` };
  };

  const registerPartnerAccount = (data: {
    name: string;
    phone: string;
    email: string;
    username?: string;
    businessName: string;
    serviceAddress: string;
    pincode: string;
    city?: string;
    state?: string;
    servicesOffered: ServiceType[];
    workingHours?: string;
    password?: string;
  }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = partners.find(p => p.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, partner: existing, message: 'Partner email already registered.' };
    }

    const newId = `partner_${Date.now()}`;
    const partnerCode = `SHAH-PRT-${8600 + partners.length + 1}`;
    const pin = data.pincode.trim() || '110086';

    const newPartner: Partner = {
      id: newId,
      partnerCode,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: cleanEmail,
      username: data.username || data.name.toLowerCase().replace(/\s+/g, '_'),
      businessName: data.businessName.trim(),
      hubName: `SHAH SIGNATURE ${data.businessName} Point`,
      serviceAddress: data.serviceAddress.trim(),
      pincode: pin,
      servicePincodes: [pin],
      city: data.city || 'Delhi',
      state: data.state || 'Delhi',
      serviceArea: `PIN ${pin} ${data.city || ''}`,
      workingHours: data.workingHours || '08:00 AM - 08:00 PM IST',
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
      servicesOffered: data.servicesOffered.length > 0 ? data.servicesOffered : ['ironing_normal', 'ironing_steam'],
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
      joinedDate: new Date().toISOString().split('T')[0],
      lastLoginAt: new Date().toISOString(),
    };

    setPartners(prev => [...prev, newPartner]);
    setActivePartnerId(newId);
    setRole('partner');
    addActivityLog('PARTNER_REGISTERED', 'SERVICE_PARTNER', newPartner.name, `Partner ${partnerCode} applied (Pending KYC Approval).`, 'warning');
    return {
      success: true,
      partner: newPartner,
      message: `Application submitted! Partner ID: ${partnerCode}. Pending Super Admin KYC approval.`,
    };
  };

  const requestPasswordReset = (email: string, targetRole: AppRole) => {
    const clean = email.trim().toLowerCase();
    const token = `rst_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    addActivityLog('PASSWORD_RESET_TOKEN_ISSUED', targetRole, clean, `Recovery request logged for ${clean}.`, 'warning');
    return {
      success: true,
      resetToken: token,
      message: `Expiring recovery token generated for ${clean} (Valid 15 minutes).`,
    };
  };

  const confirmPasswordReset = () => {
    addActivityLog('PASSWORD_RESET_COMPLETED', 'SYSTEM', 'Password Recovery', 'Password reset completed.', 'success');
    return { success: true, message: 'Password updated. Please sign in.' };
  };

  const changePassword = (targetRole: AppRole, userId: string) => {
    addActivityLog('PASSWORD_CHANGED', targetRole, userId, 'Password updated.', 'success');
    return { success: true, message: 'Your password has been updated.' };
  };

  const logout = () => {
    addActivityLog('LOGOUT', role === 'admin' ? 'SUPER_ADMIN' : role === 'partner' ? 'SERVICE_PARTNER' : 'CUSTOMER', 'Session End', 'User signed out.', 'success');
    setAuthSession(null);
    setPhoneProofToken(null);
    localStorage.removeItem('shah_auth_session_v3');
    localStorage.removeItem('shah_phone_proof_v1');
    signOutFirebase().catch(() => {});
    setRole('customer');
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        role,
        setRole,
        businessSettings,
        updateBusinessSettings,
        legalPolicies,
        updateLegalPolicies,
        customers,
        customerUser,
        setActiveCustomerId,
        updateCustomerUser,
        addCustomerAddress,
        updateCustomerAddress,
        deleteCustomerAddress,
        setDefaultAddress,
        toggleCustomerSuspension,
        registerCustomer,
        partners,
        activePartner,
        setActivePartnerId,
        updatePartnerProfile,
        togglePartnerStatus,
        togglePartnerOnline,
        togglePartnerCommissionBlock,
        registerPartner,
        uploadPartnerDocument,
        verifyPartnerDocument,
        serviceCategories,
        addServiceCategory,
        updateServiceCategory,
        toggleServiceCategory,
        garments,
        addGarment,
        updateGarment,
        deleteGarment,
        serviceAreas,
        addServiceArea,
        toggleServiceArea,
        updateServiceArea,
        settings,
        updateSettings,
        coupons,
        addCoupon,
        toggleCoupon,
        selectedLocationPin,
        setSelectedLocationPin,
        getEligiblePartnersForBooking,
        isLocationServiceable,
        orders,
        customerOrders,
        partnerOrders,
        createOrder,
        acceptOrder,
        rejectOrderOffer,
        updateOrderStatus,
        customerCancelOrder,
        adminAssignOrder,
        adminCancelOrder,
        rebookOrder,
        recordGarmentEvidence,
        verifyHandoverOtp,
        customerSignOffEvidence,
        confirmOrderDeliveryByCustomer,
        commissionLedger,
        remittances,
        submitPartnerRemittance,
        verifyPartnerRemittance,
        disputes,
        compensationRecords,
        createOrderDispute,
        respondToDispute,
        submitCustomerFollowUp,
        adminUpdateDispute,
        resolveDispute,
        appealDispute,
        updateCompensationSettlement,
        reviews,
        submitVerifiedReview,
        subscriptionPlans,
        addSubscriptionPlan,
        toggleSubscriptionPlan,
        subscribeCustomerToPlan,
        redeemRewardPoints,
        supportTickets,
        submitSupportTicket,
        updateSupportTicket,
        bulkEnquiries,
        submitBulkEnquiry,
        updateBulkEnquiryStatus,
        faqs,
        addFaq,
        toggleFaq,
        isBookingOpen,
        setIsBookingOpen,
        selectedCategory,
        setSelectedCategory,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        activeTrackingOrderId,
        setActiveTrackingOrderId,
        notifications,
        markNotificationRead,
        clearAllNotifications,
        isContactModalOpen,
        setIsContactModalOpen,
        activeLegalModal,
        setActiveLegalModal,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalRole,
        setAuthModalRole,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
        adminUser,
        activityLogs,
        addActivityLog,
        phoneProofToken,
        setPhoneVerifiedSession,
        firebaseUid,
        loginAdmin,
        loginCustomer,
        loginPartner,
        registerCustomerAccount,
        registerPartnerAccount,
        requestPasswordReset,
        confirmPasswordReset,
        changePassword,
        logout,
        authSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
