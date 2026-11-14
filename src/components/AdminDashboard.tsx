import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ServiceType,
  OrderStatus,
  normalizeOrderStatus,
  normalizeDisputeStatus,
  CanonicalOrderStatus,
  FaqItem,
  SupportTicket,
  BulkEnquiry,
} from '../types';
import {
  ShieldCheck,
  Package,
  Users,
  Bike,
  MapPin,
  Settings,
  Database,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Download,
  Phone,
  MessageCircle,
  FileText,
  CheckCircle2,
  Lock,
  Shirt,
  MessageSquare,
  Search,
  Bell,
  Scale,
  Tag,
  HelpCircle,
  CreditCard,
  Layers,
  Menu,
} from 'lucide-react';
import { GoogleChatHub } from './GoogleChatHub';
import { CommissionLedgerPanel } from './CommissionLedgerPanel';
import { DisputesPanel } from './DisputesPanel';
import { generateWhatsAppStatusUrl } from '../lib/whatsappNotifications';

type AdminTab =
  | 'orders'
  | 'commissions'
  | 'disputes'
  | 'partners'
  | 'customers'
  | 'catalog'
  | 'areas'
  | 'marketing'
  | 'tickets'
  | 'business'
  | 'settings'
  | 'googlechat'
  | 'legal'
  | 'logs'
  | 'firebase';

const CANONICAL_STATUSES: CanonicalOrderStatus[] = [
  'BOOKED',
  'PARTNER_ASSIGNED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'PROCESSING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'DISPUTED',
];

export const AdminDashboard: React.FC = () => {
  const {
    orders,
    partners,
    customers,
    garments,
    addGarment,
    updateGarment,
    deleteGarment,
    serviceCategories,
    addServiceCategory,
    toggleServiceCategory,
    serviceAreas,
    addServiceArea,
    toggleServiceArea,
    settings,
    updateSettings,
    businessSettings,
    updateBusinessSettings,
    legalPolicies,
    updateLegalPolicies,
    coupons,
    addCoupon,
    toggleCoupon,
    commissionLedger,
    remittances,
    disputes,
    supportTickets,
    updateSupportTicket,
    bulkEnquiries,
    updateBulkEnquiryStatus,
    faqs,
    addFaq,
    toggleFaq,
    subscriptionPlans,
    addSubscriptionPlan,
    toggleSubscriptionPlan,
    adminAssignOrder,
    adminCancelOrder,
    updateOrderStatus,
    togglePartnerStatus,
    updatePartnerProfile,
    togglePartnerCommissionBlock,
    verifyPartnerDocument,
    toggleCustomerSuspension,
    t,
    activityLogs,
    adminUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Orders filter & cancel modal
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [cancelModalOrder, setCancelModalOrder] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Garment & Service Category form state
  const [isAddingGarment, setIsAddingGarment] = useState(false);
  const [newGarmentNameEn, setNewGarmentNameEn] = useState('');
  const [newGarmentNameHi, setNewGarmentNameHi] = useState('');
  const [newGarmentCategory, setNewGarmentCategory] = useState<ServiceType>('ironing_steam');
  const [newGarmentPrice, setNewGarmentPrice] = useState<number>(30);
  const [newGarmentDescEn, setNewGarmentDescEn] = useState('');
  const [editingGarmentId, setEditingGarmentId] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState<number>(0);

  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatId, setNewCatId] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatNameHi, setNewCatNameHi] = useState('');
  const [newCatDescEn, setNewCatDescEn] = useState('');
  const [newCatHours, setNewCatHours] = useState(24);

  // Pan-India New Area form
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [newAreaPin, setNewAreaPin] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaCity, setNewAreaCity] = useState('Delhi');
  const [newAreaState, setNewAreaState] = useState('Delhi');
  const [newAreaMinOrder, setNewAreaMinOrder] = useState<number>(149);
  const [newAreaStdHours, setNewAreaStdHours] = useState<number>(12);
  const [newAreaExpHours, setNewAreaExpHours] = useState<number>(4);

  // Marketing (Coupon / Plan / FAQ) form state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState<number>(15);
  const [newCouponMinOrder, setNewCouponMinOrder] = useState<number>(299);
  const [newCouponDesc, setNewCouponDesc] = useState('');

  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState<number>(599);
  const [newPlanCredits, setNewPlanCredits] = useState<number>(30);
  const [newPlanDesc, setNewPlanDesc] = useState('');

  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');
  const [newFaqCat, setNewFaqCat] = useState<FaqItem['category']>('booking');

  // Support ticket reply
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Business settings & CMS form state
  const [brandNameInput, setBrandNameInput] = useState(businessSettings.brandName || 'SHAH SIGNATURE');
  const [taglineInput, setTaglineInput] = useState(businessSettings.tagline || 'ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST.');
  const [ownerNameInput, setOwnerNameInput] = useState(businessSettings.businessOwnerName);
  const [phoneInput, setPhoneInput] = useState(businessSettings.businessPhone);
  const [whatsappInput, setWhatsappInput] = useState(businessSettings.whatsappSupportNumber);
  const [emailInput, setEmailInput] = useState(businessSettings.businessEmail);
  const [addressInput, setAddressInput] = useState(businessSettings.businessAddress);
  const [logoInput, setLogoInput] = useState(businessSettings.businessLogo || '');
  const [hoursInput, setHoursInput] = useState(businessSettings.supportHours);
  const [platformUpiInput, setPlatformUpiInput] = useState(businessSettings.platformUpiId || '9899229102@upi');
  const [platformBankInput, setPlatformBankInput] = useState(businessSettings.platformBankDetails || '');
  const [heroTitleInput, setHeroTitleInput] = useState(businessSettings.heroTitle || '');
  const [heroSubtitleInput, setHeroSubtitleInput] = useState(businessSettings.heroSubtitle || '');
  const [aboutUsInput, setAboutUsInput] = useState(businessSettings.aboutUsText || '');
  const [businessSavedAlert, setBusinessSavedAlert] = useState(false);

  // Platform fees & rules form state
  const [commissionInput, setCommissionInput] = useState(settings.platformCommissionPercent);
  const [standardDeliveryInput, setStandardDeliveryInput] = useState(settings.deliveryChargeStandard);
  const [freeDeliveryInput, setFreeDeliveryInput] = useState(settings.freeDeliveryThreshold);
  const [broadcastTimeoutInput, setBroadcastTimeoutInput] = useState(settings.broadcastTimeoutSeconds);
  const [overdueGraceInput, setOverdueGraceInput] = useState(settings.overdueGraceDays ?? 3);
  const [freeCancelMinsInput, setFreeCancelMinsInput] = useState(settings.freeCancellationMinutes ?? 30);
  const [platformSavedAlert, setPlatformSavedAlert] = useState(false);

  // Legal policies editor state
  const [privacyInput, setPrivacyInput] = useState(legalPolicies.privacyPolicy);
  const [termsInput, setTermsInput] = useState(legalPolicies.termsAndConditions);
  const [refundInput, setRefundInput] = useState(legalPolicies.cancellationRefundPolicy);
  const [partnerAgreementInput, setPartnerAgreementInput] = useState(legalPolicies.partnerAgreement);
  const [legalSavedAlert, setLegalSavedAlert] = useState(false);

  // Real-time Database-Driven Metrics Calculation (All 16 KPIs)
  const todayIsoDate = new Date().toISOString().split('T')[0];
  const totalCustomers = customers.length;
  const totalPartners = partners.length;
  const pendingPartnersCount = partners.filter(p => p.status === 'pending').length;
  const approvedPartnersCount = partners.filter(p => p.status === 'active').length;
  const activePartnersCount = partners.filter(p => p.status === 'active' && p.isOnline).length;

  const todaysBookingsCount = orders.filter(o => (o.createdAt || '').startsWith(todayIsoDate)).length;
  const pendingOrdersCount = orders.filter(o => normalizeOrderStatus(o.status) === 'BOOKED').length;
  const activeOrdersCount = orders.filter(o => {
    const c = normalizeOrderStatus(o.status);
    return (
      c === 'PARTNER_ASSIGNED' ||
      c === 'PICKUP_SCHEDULED' ||
      c === 'PICKED_UP' ||
      c === 'PROCESSING' ||
      c === 'READY_FOR_DELIVERY' ||
      c === 'OUT_FOR_DELIVERY'
    );
  }).length;
  const completedOrdersCount = orders.filter(o => normalizeOrderStatus(o.status) === 'DELIVERED').length;
  const cancelledOrdersCount = orders.filter(o => normalizeOrderStatus(o.status) === 'CANCELLED').length;

  const totalGmv = orders.reduce(
    (sum, o) => sum + (normalizeOrderStatus(o.status) !== 'CANCELLED' ? o.totalAmount : 0),
    0
  );
  const platformCommissionEarned = commissionLedger.length
    ? commissionLedger.reduce((s, e) => s + e.commissionAmount, 0)
    : Math.round(totalGmv * (settings.platformCommissionPercent / 100));
  const commissionReceived = commissionLedger
    .filter(e => e.remittanceStatus === 'verified')
    .reduce((s, e) => s + e.commissionAmount, 0);
  const commissionOutstanding = commissionLedger
    .filter(e => e.remittanceStatus === 'unpaid' || e.remittanceStatus === 'submitted')
    .reduce((s, e) => s + e.commissionAmount, 0);
  const commissionOverdue = commissionLedger
    .filter(e => e.remittanceStatus === 'overdue')
    .reduce((s, e) => s + e.commissionAmount, 0);
  const openSupportTicketsCount = supportTickets.filter(tk => tk.status === 'open').length;

  const openDisputesCount = disputes.filter(d => {
    const s = normalizeDisputeStatus(d.status);
    return s !== 'RESOLVED' && s !== 'REJECTED_WITH_REASON' && s !== 'CLOSED';
  }).length;
  const pendingRemittancesCount = remittances.filter(r => r.status === 'pending_verification').length;
  const totalNotificationsCount =
    pendingPartnersCount + openDisputesCount + pendingRemittancesCount + openSupportTicketsCount;

  const q = searchQuery.trim().toLowerCase();

  const filteredOrders = orders.filter(o => {
    const canonical = normalizeOrderStatus(o.status);
    const matchesFilter =
      orderFilter === 'all'
        ? true
        : orderFilter === 'new'
        ? canonical === 'BOOKED'
        : orderFilter === 'running'
        ? canonical !== 'DELIVERED' && canonical !== 'CANCELLED' && canonical !== 'BOOKED'
        : orderFilter === 'completed'
        ? canonical === 'DELIVERED'
        : orderFilter === 'cancelled'
        ? canonical === 'CANCELLED'
        : canonical === orderFilter;
    if (!matchesFilter) return false;
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.toLowerCase().includes(q) ||
      o.pincode.includes(q) ||
      (o.assignedPartnerName || '').toLowerCase().includes(q)
    );
  });

  const filteredPartners = partners.filter(
    p =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.businessName.toLowerCase().includes(q) ||
      p.pincode.includes(q) ||
      (p.city || '').toLowerCase().includes(q)
  );

  const filteredCustomers = customers.filter(
    c =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
  );

  const handleSaveBusinessSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessSettings({
      brandName: brandNameInput.trim(),
      businessOwnerName: ownerNameInput.trim(),
      tagline: taglineInput.trim(),
      businessPhone: phoneInput.trim(),
      whatsappSupportNumber: whatsappInput.trim().replace(/[^0-9]/g, ''),
      businessEmail: emailInput.trim(),
      businessAddress: addressInput.trim(),
      businessLogo: logoInput.trim(),
      supportHours: hoursInput.trim(),
      platformUpiId: platformUpiInput.trim(),
      platformBankDetails: platformBankInput.trim(),
      heroTitle: heroTitleInput.trim(),
      heroSubtitle: heroSubtitleInput.trim(),
      aboutUsText: aboutUsInput.trim(),
    });
    setBusinessSavedAlert(true);
    setTimeout(() => setBusinessSavedAlert(false), 3500);
  };

  const handleSavePlatformSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      platformCommissionPercent: Number(commissionInput),
      deliveryChargeStandard: Number(standardDeliveryInput),
      freeDeliveryThreshold: Number(freeDeliveryInput),
      broadcastTimeoutSeconds: Number(broadcastTimeoutInput),
      overdueGraceDays: Number(overdueGraceInput),
      freeCancellationMinutes: Number(freeCancelMinsInput),
    });
    setPlatformSavedAlert(true);
    setTimeout(() => setPlatformSavedAlert(false), 3500);
  };

  const handleSaveLegalPolicies = (e: React.FormEvent) => {
    e.preventDefault();
    updateLegalPolicies({
      privacyPolicy: privacyInput,
      termsAndConditions: termsInput,
      cancellationRefundPolicy: refundInput,
      partnerAgreement: partnerAgreementInput,
    });
    setLegalSavedAlert(true);
    setTimeout(() => setLegalSavedAlert(false), 3500);
  };

  const handleExportCSV = () => {
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Phone',
      'Address',
      'PIN Code',
      'Service',
      'Garments Count',
      'Total (INR)',
      'Commission (INR)',
      'Status',
      'Partner',
    ];
    const rows = orders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString(),
      `"${o.customerName}"`,
      o.customerPhone,
      `"${o.customerAddress}"`,
      o.pincode,
      o.serviceType,
      o.items.reduce((s, i) => s + i.quantity, 0),
      o.totalAmount,
      o.platformCommissionAmount ?? Math.round(o.totalAmount * (settings.platformCommissionPercent / 100)),
      normalizeOrderStatus(o.status),
      `"${o.assignedPartnerName || 'Unassigned'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SHAH_SIGNATURE_Orders_${todayIsoDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          { orders, partners, garments, serviceCategories, serviceAreas, businessSettings, commissionLedger, disputes },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SHAH_SIGNATURE_DataBackup_${todayIsoDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleConfirmCancelOrder = () => {
    if (cancelModalOrder && cancelReason.trim()) {
      adminCancelOrder(cancelModalOrder, cancelReason.trim());
      setCancelModalOrder(null);
      setCancelReason('');
    }
  };

  const handleCreateGarment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarmentNameEn.trim() || newGarmentPrice <= 0) return;

    addGarment({
      nameEn: newGarmentNameEn,
      nameHi: newGarmentNameHi || newGarmentNameEn,
      category: newGarmentCategory,
      price: Number(newGarmentPrice),
      descriptionEn: newGarmentDescEn || 'Standard valet care',
      descriptionHi: 'विशेष देखभाल',
      isActive: true,
    });

    setIsAddingGarment(false);
    setNewGarmentNameEn('');
    setNewGarmentNameHi('');
    setNewGarmentPrice(30);
    setNewGarmentDescEn('');
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatId.trim() || !newCatNameEn.trim()) return;
    addServiceCategory({
      id: newCatId.trim().toLowerCase().replace(/\s+/g, '_'),
      nameEn: newCatNameEn.trim(),
      nameHi: newCatNameHi.trim() || newCatNameEn.trim(),
      descriptionEn: newCatDescEn.trim() || 'On-demand garment service',
      descriptionHi: 'ऑन-डिमांड गारमेंट सेवा',
      turnaroundHours: Number(newCatHours),
      expressHours: Math.max(2, Math.round(Number(newCatHours) / 3)),
      isActive: true,
      displayOrder: serviceCategories.length + 1,
    });
    setIsAddingCat(false);
    setNewCatId('');
    setNewCatNameEn('');
    setNewCatNameHi('');
    setNewCatDescEn('');
  };

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaPin.trim() || !newAreaName.trim()) return;

    addServiceArea({
      pincode: newAreaPin.trim(),
      areaName: newAreaName.trim(),
      city: newAreaCity.trim() || 'Delhi',
      state: newAreaState.trim() || 'Delhi',
      isActive: true,
      minOrderAmount: Number(newAreaMinOrder),
      standardDeliveryHours: Number(newAreaStdHours),
      expressDeliveryHours: Number(newAreaExpHours),
    });

    setIsAddingArea(false);
    setNewAreaPin('');
    setNewAreaName('');
    setNewAreaMinOrder(149);
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    addCoupon({
      code: newCouponCode.trim().toUpperCase(),
      discountPercent: Number(newCouponPercent),
      minOrder: Number(newCouponMinOrder),
      descriptionEn: newCouponDesc.trim() || `${newCouponPercent}% off on orders above ₹${newCouponMinOrder}`,
      descriptionHi: `₹${newCouponMinOrder}+ के ऑर्डर पर ${newCouponPercent}% की छूट`,
      isActive: true,
    });
    setNewCouponCode('');
    setNewCouponDesc('');
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    addSubscriptionPlan({
      name: newPlanName.trim(),
      description: newPlanDesc.trim() || 'Monthly valet garment care subscription',
      monthlyPrice: Number(newPlanPrice),
      includedGarments: Number(newPlanCredits),
      freeExpressDeliveries: 2,
      priorityDispatch: true,
      isActive: true,
    });
    setNewPlanName('');
    setNewPlanDesc('');
  };

  const handleCreateFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQ.trim() || !newFaqA.trim()) return;
    addFaq({
      questionEn: newFaqQ.trim(),
      questionHi: newFaqQ.trim(),
      answerEn: newFaqA.trim(),
      answerHi: newFaqA.trim(),
      category: newFaqCat,
      isActive: true,
    });
    setNewFaqQ('');
    setNewFaqA('');
  };

  const navItems: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'orders', label: `Orders (${orders.length})`, icon: <Package className="w-4 h-4" /> },
    { key: 'commissions', label: 'Commissions & UTR', icon: <CreditCard className="w-4 h-4" />, badge: pendingRemittancesCount },
    { key: 'disputes', label: `Disputes (${disputes.length})`, icon: <Scale className="w-4 h-4" />, badge: openDisputesCount },
    { key: 'partners', label: `Partners & KYC (${partners.length})`, icon: <Bike className="w-4 h-4" />, badge: pendingPartnersCount },
    { key: 'customers', label: `Customers (${customers.length})`, icon: <Users className="w-4 h-4" /> },
    { key: 'catalog', label: 'Services & Catalog', icon: <Shirt className="w-4 h-4" /> },
    { key: 'areas', label: `Pan-India Areas (${serviceAreas.length})`, icon: <MapPin className="w-4 h-4" /> },
    { key: 'marketing', label: 'Coupons, Plans & FAQs', icon: <Tag className="w-4 h-4" /> },
    { key: 'tickets', label: 'Tickets & Bulk Desk', icon: <HelpCircle className="w-4 h-4" />, badge: openSupportTicketsCount },
    { key: 'business', label: 'Business & CMS', icon: <Phone className="w-4 h-4" /> },
    { key: 'settings', label: 'Fees & Rules', icon: <Settings className="w-4 h-4" /> },
    { key: 'googlechat', label: 'Google Chat Deck', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'legal', label: 'Legal & Policies', icon: <FileText className="w-4 h-4" /> },
    { key: 'logs', label: `Audit Logs (${activityLogs.length})`, icon: <Lock className="w-4 h-4" /> },
    { key: 'firebase', label: 'Firebase Schema', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <section className="py-8 bg-[#F4F5F8] min-h-[920px] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Operations Command Header */}
        <div className="bg-[#0B132B] text-white p-6 rounded-xl border border-[#D4AF37]/30 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>SHAH SIGNATURE Super Admin Control Room</span>
              <span aria-hidden="true">·</span>
              <span>Owner: {adminUser?.name || businessSettings.businessOwnerName}</span>
            </div>
            <h2 className="text-2xl font-bold font-brand text-white mt-1">
              Marketplace Operations, CMS & Commission Ledger
            </h2>
            <p className="text-xs text-slate-300">
              Control Pan-India PINs, services, catalog pricing, partner KYC, disputes, UTR commission settlements & content.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search order, PIN, partner..."
                className="w-full pl-8 pr-3 py-2 bg-[#060B18] border border-slate-700 rounded text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Notification Summary Pill */}
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  pendingRemittancesCount > 0
                    ? 'commissions'
                    : openDisputesCount > 0
                    ? 'disputes'
                    : pendingPartnersCount > 0
                    ? 'partners'
                    : 'tickets'
                )
              }
              className="px-3 py-2 bg-[#060B18] border border-[#D4AF37]/40 rounded text-xs font-semibold text-[#F3E5AB] flex items-center gap-1.5 cursor-pointer hover:bg-black"
              title="Action items requiring admin review"
            >
              <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{totalNotificationsCount} Alerts</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-[#060B18] hover:bg-black text-[#F3E5AB] border border-[#D4AF37]/40 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="px-3 py-2 bg-[#060B18] hover:bg-black text-slate-200 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* All 16 Real-Time Database-Driven KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {[
            { label: 'Total Customers', val: totalCustomers, tone: 'text-[#0B132B]' },
            { label: 'Total Partners', val: totalPartners, tone: 'text-[#0B132B]' },
            { label: 'Pending Partner Apps', val: pendingPartnersCount, tone: 'text-amber-700' },
            { label: 'Approved Partners', val: approvedPartnersCount, tone: 'text-emerald-700' },
            { label: 'Active Online Partners', val: activePartnersCount, tone: 'text-emerald-600' },
            { label: "Today's Bookings", val: todaysBookingsCount, tone: 'text-indigo-700' },
            { label: 'Pending Orders', val: pendingOrdersCount, tone: 'text-sky-700' },
            { label: 'Active Orders', val: activeOrdersCount, tone: 'text-indigo-700' },
            { label: 'Completed Orders', val: completedOrdersCount, tone: 'text-emerald-700' },
            { label: 'Cancelled Orders', val: cancelledOrdersCount, tone: 'text-rose-700' },
            { label: 'Customer GMV', val: `₹${totalGmv}`, tone: 'text-[#0B132B]' },
            { label: `Commission (${settings.platformCommissionPercent}%)`, val: `₹${platformCommissionEarned}`, tone: 'text-emerald-800' },
            { label: 'Commission Received', val: `₹${commissionReceived}`, tone: 'text-emerald-700' },
            { label: 'Commission Due', val: `₹${commissionOutstanding}`, tone: 'text-amber-700' },
            { label: 'Overdue Commission', val: `₹${commissionOverdue}`, tone: 'text-rose-700' },
            { label: 'New Support Tickets', val: openSupportTicketsCount, tone: 'text-rose-700' },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider truncate" title={kpi.label}>
                {kpi.label}
              </div>
              <div className={`text-lg font-bold font-mono mt-1 tabular-nums ${kpi.tone}`}>{kpi.val}</div>
            </div>
          ))}
        </div>

        {/* Responsive Mobile Menu Toggle for Admin Sidebar */}
        <div className="lg:hidden flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-[#0B132B] uppercase tracking-wider">
            Section: {navItems.find(n => n.key === activeTab)?.label}
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpenMobile(!sidebarOpenMobile)}
            className="px-3 py-1.5 bg-[#0B132B] text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Menu className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Menu</span>
          </button>
        </div>

        {/* Main Workspace: Sidebar + Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Navigation */}
          <aside className={`lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-1 ${sidebarOpenMobile ? 'block' : 'hidden lg:block'}`}>
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Control Room Navigation
            </div>
            {navItems.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSidebarOpenMobile(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-left ${
                  activeTab === tab.key
                    ? 'bg-[#0B132B] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className={activeTab === tab.key ? 'text-[#D4AF37]' : 'text-slate-400'}>{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-[#060B18]">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Content Workspace */}
          <div className="lg:col-span-9 space-y-6">
            {/* TAB: Orders */}
            {activeTab === 'orders' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold font-brand text-slate-900 text-lg">Orders Command & Partner Assignment</h3>
                    <p className="text-xs text-slate-500">
                      Assign/reassign approved partners, update standardized statuses, or cancel with recorded audit reasons.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    {['all', 'new', 'running', 'completed', 'cancelled'].map(f => (
                      <button
                        key={f}
                        onClick={() => setOrderFilter(f)}
                        className={`px-3 py-1.5 rounded font-medium capitalize cursor-pointer ${
                          orderFilter === f ? 'bg-[#0B132B] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-3">Order</th>
                        <th className="p-3">Customer & Location</th>
                        <th className="p-3">Service</th>
                        <th className="p-3">Total (₹)</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Partner</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map(order => {
                        const canonical = normalizeOrderStatus(order.status);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-bold font-brand text-[#0B132B] whitespace-nowrap">
                              {order.orderNumber}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{order.customerName}</div>
                              <div className="text-[11px] text-slate-500">{order.pincode} · {order.locality}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{order.customerPhone}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-slate-800">{order.serviceType.replace(/_/g, ' ').toUpperCase()}</div>
                              <div className="text-[11px] text-slate-500">{order.items.reduce((s, i) => s + i.quantity, 0)} garments</div>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900 tabular-nums">
                              ₹{order.totalAmount}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-[#0B132B]">
                                {t.statusLabels[canonical] || canonical}
                              </span>
                              {order.cancellationReason && (
                                <div className="text-[10px] text-rose-600">Reason: {order.cancellationReason}</div>
                              )}
                            </td>
                            <td className="p-3">
                              {canonical !== 'DELIVERED' && canonical !== 'CANCELLED' ? (
                                <select
                                  value={order.assignedPartnerId || ''}
                                  onChange={e => {
                                    if (e.target.value) adminAssignOrder(order.id, e.target.value);
                                  }}
                                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                                >
                                  <option value="">Broadcast Queue</option>
                                  {partners
                                    .filter(p => p.status === 'active')
                                    .map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.pincode}) {p.isOnline ? '🟢' : '⚪'}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span className="text-slate-600 font-medium">{order.assignedPartnerName || 'None'}</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {canonical !== 'CANCELLED' && (
                                  <select
                                    value={canonical}
                                    onChange={e =>
                                      updateOrderStatus(
                                        order.id,
                                        e.target.value as OrderStatus,
                                        `Admin updated status to ${e.target.value}`
                                      )
                                    }
                                    className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[11px] text-slate-800 font-semibold"
                                  >
                                    {CANONICAL_STATUSES.map(st => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <a
                                  href={generateWhatsAppStatusUrl(order, 'customer', order.assignedPartnerPhone)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded inline-flex items-center"
                                  title="Send WhatsApp Update"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>

                                {canonical !== 'CANCELLED' && canonical !== 'DELIVERED' && (
                                  <button
                                    onClick={() => {
                                      setCancelModalOrder(order.id);
                                      setCancelReason('');
                                    }}
                                    className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[11px] font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {cancelModalOrder && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
                      <h4 className="font-bold font-brand text-slate-900 text-base">Record Cancellation Reason</h4>
                      <textarea
                        rows={3}
                        required
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        placeholder="Enter audit cancellation reason..."
                        className="w-full p-2.5 border border-slate-300 rounded text-xs text-slate-900"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setCancelModalOrder(null)}
                          className="px-4 py-2 text-xs text-slate-600 cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmCancelOrder}
                          disabled={!cancelReason.trim()}
                          className={`px-5 py-2 text-xs font-semibold rounded text-white cursor-pointer ${
                            cancelReason.trim() ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300'
                          }`}
                        >
                          Confirm Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Commission Ledger & UTR Remittances */}
            {activeTab === 'commissions' && <CommissionLedgerPanel viewerRole="admin" />}

            {/* TAB: Disputes */}
            {activeTab === 'disputes' && <DisputesPanel viewerRole="admin" />}

            {/* TAB: Partners & KYC */}
            {activeTab === 'partners' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Service Partners & KYC Approvals</h3>
                  <p className="text-xs text-slate-500">
                    Approve/reject KYC documents, manage capacity, suspend partners, or block orders for overdue commissions.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPartners.map(partner => (
                    <div
                      key={partner.id}
                      className="p-5 rounded-xl border border-slate-200 bg-[#FBFBFC] space-y-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold font-brand text-slate-900 text-base">{partner.name}</h4>
                            <div className="text-xs font-semibold text-[#0B132B]">{partner.businessName}</div>
                            <div className="text-[11px] text-slate-500">
                              {partner.city || 'Delhi'}, {partner.state || 'Delhi'} · PIN {partner.pincode}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              partner.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : partner.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {partner.status}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <div>Address: <strong>{partner.serviceAddress}</strong></div>
                          <div>Contact: <strong className="font-mono">{partner.phone}</strong></div>
                          <div>UPI ID: <strong className="font-mono">{partner.upiId || 'Not set'}</strong></div>
                          <div>Status: <strong>{partner.isOnline ? 'Online' : 'Offline'}</strong> · ★ {partner.rating}</div>
                          <div className="flex items-center gap-2 pt-1">
                            <span>Daily Capacity:</span>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={partner.maxDailyCapacity || 25}
                              onChange={e => updatePartnerProfile(partner.id, { maxDailyCapacity: Number(e.target.value) })}
                              className="w-16 px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200 text-xs">
                          <div className="font-semibold text-slate-700 mb-1">KYC Documents ({partner.documents?.length || 0}):</div>
                          {partner.documents?.length === 0 ? (
                            <div className="text-[11px] text-slate-400">No documents uploaded yet</div>
                          ) : (
                            <div className="space-y-1">
                              {partner.documents.map(d => (
                                <div key={d.id} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-slate-200">
                                  <span className="truncate max-w-[140px]">{d.fileName}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                        d.status === 'verified'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : d.status === 'rejected'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {d.status}
                                    </span>
                                    {d.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => verifyPartnerDocument(partner.id, d.id, 'verified')}
                                          className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                                        >
                                          Verify
                                        </button>
                                        <button
                                          onClick={() => verifyPartnerDocument(partner.id, d.id, 'rejected', 'Unclear document')}
                                          className="text-[10px] text-rose-700 hover:underline font-bold cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        {partner.status === 'active' ? (
                          <button
                            onClick={() => togglePartnerStatus(partner.id, 'suspended')}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-semibold cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => togglePartnerStatus(partner.id, 'active')}
                            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded font-semibold cursor-pointer"
                          >
                            {partner.status === 'pending' ? 'Approve Partner' : 'Re-Activate'}
                          </button>
                        )}

                        <button
                          onClick={() => togglePartnerCommissionBlock(partner.id, !partner.commissionBlocked)}
                          className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                            partner.commissionBlocked
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {partner.commissionBlocked ? 'Unblock Commission Hold' : 'Hold Orders (Commission)'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: Customers */}
            {activeTab === 'customers' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Customer Directory</h3>
                  <p className="text-xs text-slate-500">
                    View customer profiles, reward balances, saved Pan-India addresses, and suspension status.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-3">Customer</th>
                        <th className="p-3">Phone & Email</th>
                        <th className="p-3">Saved Addresses</th>
                        <th className="p-3">Orders / Spend</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/80">
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{c.name}</div>
                            <div className="text-[10px] text-amber-700">Points: {c.rewardPoints || 0}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-slate-800">{c.phone}</div>
                            <div className="text-[11px] text-slate-500">{c.email || 'No email'}</div>
                          </td>
                          <td className="p-3 max-w-xs">
                            {c.addresses?.map(a => (
                              <div key={a.id} className="text-[11px] text-slate-600">
                                <strong>{a.label}:</strong> {a.addressLine}, {a.pincode}
                              </div>
                            ))}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900 tabular-nums">
                            {c.totalOrders} · ₹{c.totalSpent}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                c.isSuspended ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {c.isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => toggleCustomerSuspension(c.id)}
                              className={`text-xs font-semibold cursor-pointer ${
                                c.isSuspended ? 'text-emerald-600 hover:underline' : 'text-rose-600 hover:underline'
                              }`}
                            >
                              {c.isSuspended ? 'Unsuspend' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: Services & Catalog */}
            {activeTab === 'catalog' && (
              <div className="space-y-6">
                {/* Scalable Service Categories Manager */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold font-brand text-slate-900 text-lg flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#D4AF37]" />
                        <span>Scalable Service Categories</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Enable, disable, or launch new on-demand garment categories dynamically.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsAddingCat(!isAddingCat)}
                      className="px-4 py-2 bg-[#0B132B] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Add Service Category</span>
                    </button>
                  </div>

                  {isAddingCat && (
                    <form onSubmit={handleCreateCategory} className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <input
                        type="text"
                        required
                        value={newCatId}
                        onChange={e => setNewCatId(e.target.value)}
                        placeholder="Key ID (e.g. shoe_spa)"
                        className="px-3 py-2 bg-white border border-slate-300 rounded font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={newCatNameEn}
                        onChange={e => setNewCatNameEn(e.target.value)}
                        placeholder="Category Name (English)"
                        className="px-3 py-2 bg-white border border-slate-300 rounded"
                      />
                      <input
                        type="text"
                        value={newCatNameHi}
                        onChange={e => setNewCatNameHi(e.target.value)}
                        placeholder="Category Name (Hindi)"
                        className="px-3 py-2 bg-white border border-slate-300 rounded"
                      />
                      <input
                        type="number"
                        value={newCatHours}
                        onChange={e => setNewCatHours(Number(e.target.value))}
                        placeholder="Turnaround hours"
                        className="px-3 py-2 bg-white border border-slate-300 rounded font-mono"
                      />
                      <input
                        type="text"
                        value={newCatDescEn}
                        onChange={e => setNewCatDescEn(e.target.value)}
                        placeholder="Description"
                        className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded"
                      />
                      <div className="sm:col-span-2 flex justify-end gap-2">
                        <button type="button" onClick={() => setIsAddingCat(false)} className="px-3 py-1.5 text-slate-600 cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" className="px-4 py-1.5 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                          Save Category
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {serviceCategories.map(cat => (
                      <div key={cat.id} className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{cat.nameEn}</div>
                          <div className="text-[11px] text-slate-500">Key: {cat.id} · {cat.turnaroundHours}h std</div>
                        </div>
                        <button
                          onClick={() => toggleServiceCategory(cat.id)}
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                            cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {cat.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Garment Items & Pricing Catalog */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold font-brand text-slate-900 text-lg">Garments & Pricing Catalog</h3>
                      <p className="text-xs text-slate-500">Edit base prices or add new items without editing code.</p>
                    </div>
                    <button
                      onClick={() => setIsAddingGarment(true)}
                      className="px-4 py-2 bg-[#0B132B] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{t.admin.addGarment}</span>
                    </button>
                  </div>

                  {isAddingGarment && (
                    <form onSubmit={handleCreateGarment} className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          required
                          value={newGarmentNameEn}
                          onChange={e => setNewGarmentNameEn(e.target.value)}
                          placeholder="Item Name (English) *"
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="text"
                          value={newGarmentNameHi}
                          onChange={e => setNewGarmentNameHi(e.target.value)}
                          placeholder="Item Name (Hindi)"
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                        />
                        <select
                          value={newGarmentCategory}
                          onChange={e => setNewGarmentCategory(e.target.value as ServiceType)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                        >
                          {serviceCategories.map(sc => (
                            <option key={sc.id} value={sc.id}>
                              {sc.nameEn}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          required
                          min={1}
                          value={newGarmentPrice}
                          onChange={e => setNewGarmentPrice(Number(e.target.value))}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono"
                        />
                        <input
                          type="text"
                          value={newGarmentDescEn}
                          onChange={e => setNewGarmentDescEn(e.target.value)}
                          placeholder="Description"
                          className="sm:col-span-2 px-3 py-1.5 bg-white border border-slate-300 rounded"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsAddingGarment(false)} className="px-3 py-1.5 text-slate-600 cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" className="px-5 py-1.5 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                          Save Item
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="p-3">Garment</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Price (₹)</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {garments.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{item.nameEn}</div>
                              <div className="text-[11px] text-slate-500">{item.nameHi}</div>
                            </td>
                            <td className="p-3 uppercase text-[11px] font-medium text-slate-700">
                              {item.category.replace(/_/g, ' ')}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900">
                              {editingGarmentId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    value={editingPriceVal}
                                    onChange={e => setEditingPriceVal(Number(e.target.value))}
                                    className="w-20 px-2 py-1 border border-[#0B132B] rounded text-xs"
                                  />
                                  <button
                                    onClick={() => {
                                      updateGarment(item.id, { price: Number(editingPriceVal) });
                                      setEditingGarmentId(null);
                                    }}
                                    className="p-1 text-emerald-600 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingGarmentId(null)} className="p-1 text-slate-400 cursor-pointer">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>₹{item.price}</span>
                                  <button
                                    onClick={() => {
                                      setEditingGarmentId(item.id);
                                      setEditingPriceVal(item.price);
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#0B132B] cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => deleteGarment(item.id)}
                                className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Pan-India Service Areas */}
            {activeTab === 'areas' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold font-brand text-slate-900 text-lg">Pan-India Service Areas & PIN Codes</h3>
                    <p className="text-xs text-slate-500">
                      Expand into new Indian cities & PIN codes dynamically alongside primary 110086 Delhi hub.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddingArea(!isAddingArea)}
                    className="px-4 py-2 bg-[#0B132B] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{t.admin.addPincode}</span>
                  </button>
                </div>

                {isAddingArea && (
                  <form onSubmit={handleCreateArea} className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={newAreaPin}
                        onChange={e => setNewAreaPin(e.target.value)}
                        placeholder="6-Digit PIN (e.g. 400001)"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={newAreaName}
                        onChange={e => setNewAreaName(e.target.value)}
                        placeholder="Locality (e.g. Nariman Point)"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                      />
                      <input
                        type="text"
                        required
                        value={newAreaCity}
                        onChange={e => setNewAreaCity(e.target.value)}
                        placeholder="City (e.g. Mumbai)"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                      />
                      <input
                        type="text"
                        required
                        value={newAreaState}
                        onChange={e => setNewAreaState(e.target.value)}
                        placeholder="State (e.g. Maharashtra)"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded"
                      />
                      <input
                        type="number"
                        value={newAreaMinOrder}
                        onChange={e => setNewAreaMinOrder(Number(e.target.value))}
                        placeholder="Min Order (₹)"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={newAreaStdHours}
                          onChange={e => setNewAreaStdHours(Number(e.target.value))}
                          placeholder="Std Hrs"
                          className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                        />
                        <input
                          type="number"
                          value={newAreaExpHours}
                          onChange={e => setNewAreaExpHours(Number(e.target.value))}
                          placeholder="Exp Hrs"
                          className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setIsAddingArea(false)} className="px-3 py-1.5 text-slate-600 cursor-pointer">
                        Cancel
                      </button>
                      <button type="submit" className="px-5 py-1.5 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                        Save PIN Area
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviceAreas.map(area => (
                    <div
                      key={area.pincode}
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        area.isActive ? 'bg-white border-[#D4AF37]/50' : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-[#0B132B]">{area.pincode}</span>
                          <span className="font-semibold text-slate-800 text-sm">{area.areaName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {area.city}, {area.state} · Min ₹{area.minOrderAmount} · {area.standardDeliveryHours}h / {area.expressDeliveryHours}h
                        </div>
                      </div>
                      <button
                        onClick={() => toggleServiceArea(area.pincode)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                          area.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {area.isActive ? 'Active Zone' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: Coupons, Subscription Plans & FAQs */}
            {activeTab === 'marketing' && (
              <div className="space-y-6">
                {/* Coupons */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Promo Coupons</h3>
                  <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <input
                      type="text"
                      required
                      value={newCouponCode}
                      onChange={e => setNewCouponCode(e.target.value)}
                      placeholder="CODE (e.g. FESTIVE15)"
                      className="px-3 py-2 border border-slate-300 rounded font-mono uppercase"
                    />
                    <input
                      type="number"
                      required
                      min={1}
                      max={90}
                      value={newCouponPercent}
                      onChange={e => setNewCouponPercent(Number(e.target.value))}
                      placeholder="Discount %"
                      className="px-3 py-2 border border-slate-300 rounded font-mono"
                    />
                    <input
                      type="number"
                      required
                      value={newCouponMinOrder}
                      onChange={e => setNewCouponMinOrder(Number(e.target.value))}
                      placeholder="Min Order ₹"
                      className="px-3 py-2 border border-slate-300 rounded font-mono"
                    />
                    <button type="submit" className="px-4 py-2 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                      Add Coupon
                    </button>
                    <input
                      type="text"
                      value={newCouponDesc}
                      onChange={e => setNewCouponDesc(e.target.value)}
                      placeholder="Offer description..."
                      className="sm:col-span-4 px-3 py-2 border border-slate-300 rounded"
                    />
                  </form>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {coupons.map(c => (
                      <div key={c.code} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-bold text-[#0B132B]">{c.code}</div>
                          <div className="text-[11px] text-slate-500">{c.descriptionEn}</div>
                        </div>
                        <button
                          onClick={() => toggleCoupon(c.code)}
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                            c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {c.isActive ? 'Active' : 'Paused'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subscription Plans */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Monthly Garment Plans</h3>
                  <form onSubmit={handleCreatePlan} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <input
                      type="text"
                      required
                      value={newPlanName}
                      onChange={e => setNewPlanName(e.target.value)}
                      placeholder="Plan Name"
                      className="px-3 py-2 border border-slate-300 rounded"
                    />
                    <input
                      type="number"
                      required
                      value={newPlanPrice}
                      onChange={e => setNewPlanPrice(Number(e.target.value))}
                      placeholder="Price ₹"
                      className="px-3 py-2 border border-slate-300 rounded font-mono"
                    />
                    <input
                      type="number"
                      required
                      value={newPlanCredits}
                      onChange={e => setNewPlanCredits(Number(e.target.value))}
                      placeholder="Garments"
                      className="px-3 py-2 border border-slate-300 rounded font-mono"
                    />
                    <button type="submit" className="px-4 py-2 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                      Add Plan
                    </button>
                    <input
                      type="text"
                      value={newPlanDesc}
                      onChange={e => setNewPlanDesc(e.target.value)}
                      placeholder="Plan description..."
                      className="sm:col-span-4 px-3 py-2 border border-slate-300 rounded"
                    />
                  </form>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subscriptionPlans.map(plan => (
                      <div key={plan.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#0B132B]">{plan.name} — ₹{plan.monthlyPrice}/mo</div>
                          <div className="text-[11px] text-slate-500">{plan.includedGarments} garments · {plan.description}</div>
                        </div>
                        <button
                          onClick={() => toggleSubscriptionPlan(plan.id)}
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                            plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Paused'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQ Manager */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Frequently Asked Questions (CMS)</h3>
                  <form onSubmit={handleCreateFaq} className="space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={newFaqQ}
                        onChange={e => setNewFaqQ(e.target.value)}
                        placeholder="Question..."
                        className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded"
                      />
                      <select
                        value={newFaqCat}
                        onChange={e => setNewFaqCat(e.target.value as FaqItem['category'])}
                        className="px-3 py-2 border border-slate-300 rounded"
                      >
                        <option value="booking">Booking</option>
                        <option value="garment_care">Garment Care</option>
                        <option value="payments">Payments</option>
                        <option value="partners">Partners</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newFaqA}
                        onChange={e => setNewFaqA(e.target.value)}
                        placeholder="Answer..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded"
                      />
                      <button type="submit" className="px-4 py-2 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                        Add FAQ
                      </button>
                    </div>
                  </form>
                  <div className="space-y-2">
                    {faqs.map(fq => (
                      <div key={fq.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-slate-900">{fq.questionEn}</div>
                          <div className="text-[11px] text-slate-500">{fq.answerEn}</div>
                        </div>
                        <button
                          onClick={() => toggleFaq(fq.id)}
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer shrink-0 ${
                            fq.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {fq.isActive ? 'Published' : 'Hidden'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Support Tickets & Bulk Enquiries */}
            {activeTab === 'tickets' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Customer & Partner Support Tickets ({supportTickets.length})</h3>
                  {supportTickets.length === 0 ? (
                    <div className="text-xs text-slate-400">No support tickets filed yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {supportTickets.map(tk => (
                        <div key={tk.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-[#0B132B]">{tk.subject}</span>
                              <span className="text-slate-500 ml-2">by {tk.senderName} ({tk.senderPhone})</span>
                            </div>
                            <select
                              value={tk.status}
                              onChange={e => updateSupportTicket(tk.id, e.target.value as SupportTicket['status'])}
                              className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
                          <p className="text-slate-700">{tk.message}</p>
                          {tk.adminReply && (
                            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
                              <strong>Admin Reply:</strong> {tk.adminReply}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyDrafts[tk.id] || ''}
                              onChange={e => setReplyDrafts({ ...replyDrafts, [tk.id]: e.target.value })}
                              placeholder="Write reply to ticket..."
                              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const msg = replyDrafts[tk.id];
                                if (!msg?.trim()) return;
                                updateSupportTicket(tk.id, 'resolved', msg.trim());
                                setReplyDrafts({ ...replyDrafts, [tk.id]: '' });
                              }}
                              className="px-3 py-1.5 bg-[#0B132B] text-white font-semibold rounded cursor-pointer"
                            >
                              Send & Resolve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Corporate & Hotel Bulk Enquiries ({bulkEnquiries.length})</h3>
                  {bulkEnquiries.length === 0 ? (
                    <div className="text-xs text-slate-400">No corporate enquiries yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {bulkEnquiries.map(enq => (
                        <div key={enq.id} className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-bold text-[#0B132B]">{enq.organizationName} ({enq.city} - {enq.pincode})</div>
                            <div className="text-slate-600">{enq.contactPerson} · {enq.phone} · ~{enq.estimatedMonthlyGarments} garments/mo</div>
                            {enq.notes && <div className="text-[11px] text-slate-500 mt-1">{enq.notes}</div>}
                          </div>
                          <select
                            value={enq.status}
                            onChange={e => updateBulkEnquiryStatus(enq.id, e.target.value as BulkEnquiry['status'])}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-semibold"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="quoted">Quoted</option>
                            <option value="active">Active Contract</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Business Owner, CMS & Settlement Bank */}
            {activeTab === 'business' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold font-brand text-slate-900 text-lg">
                      Business Profile, Homepage CMS & Platform Bank/UPI
                    </h3>
                    <p className="text-xs text-slate-500">
                      Updates brand info, Hero text, About Us section, WhatsApp links & commission settlement UPI live.
                    </p>
                  </div>
                </div>

                {businessSavedAlert && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Business & CMS settings saved!</span>
                  </div>
                )}

                <form onSubmit={handleSaveBusinessSettings} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Official Brand Name *</label>
                      <input type="text" required value={brandNameInput} onChange={e => setBrandNameInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded font-bold" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Business Owner *</label>
                      <input type="text" required value={ownerNameInput} onChange={e => setOwnerNameInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Brand Tagline *</label>
                      <input type="text" required value={taglineInput} onChange={e => setTaglineInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Business Phone *</label>
                      <input type="text" required value={phoneInput} onChange={e => setPhoneInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">WhatsApp Number (91 prefix) *</label>
                      <input type="text" required value={whatsappInput} onChange={e => setWhatsappInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Business Email *</label>
                      <input type="email" required value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Platform Commission Settlement UPI ID</label>
                      <input type="text" value={platformUpiInput} onChange={e => setPlatformUpiInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Platform Bank Details (Shown on Partner UTR Remittance)</label>
                      <input type="text" value={platformBankInput} onChange={e => setPlatformBankInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Hero Headline (CMS)</label>
                      <input type="text" value={heroTitleInput} onChange={e => setHeroTitleInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Hero Subtitle (CMS)</label>
                      <input type="text" value={heroSubtitleInput} onChange={e => setHeroSubtitleInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">About Us Content (CMS)</label>
                      <textarea rows={3} value={aboutUsInput} onChange={e => setAboutUsInput(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Custom Logo URL (Optional)</label>
                      <input type="text" value={logoInput} onChange={e => setLogoInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Support Hours</label>
                      <input type="text" value={hoursInput} onChange={e => setHoursInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">HQ Physical Address</label>
                      <input type="text" value={addressInput} onChange={e => setAddressInput(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded" />
                    </div>
                  </div>
                  <button type="submit" className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded-md cursor-pointer">
                    Save Business & CMS Settings
                  </button>
                </form>
              </div>
            )}

            {/* TAB: Fees, Commissions & Rules */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Commission, Delivery & Cancellation Rules</h3>
                </div>
                {platformSavedAlert && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Platform fee & dispatch rules updated!</span>
                  </div>
                )}
                <form onSubmit={handleSavePlatformSettings} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Platform Commission (%)</label>
                      <input type="number" min={0} max={50} value={commissionInput} onChange={e => setCommissionInput(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Broadcast Timeout (Seconds)</label>
                      <input type="number" min={15} max={300} value={broadcastTimeoutInput} onChange={e => setBroadcastTimeoutInput(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Home Delivery Charge (₹)</label>
                      <input type="number" min={0} value={standardDeliveryInput} onChange={e => setStandardDeliveryInput(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Free Delivery Threshold (₹)</label>
                      <input type="number" min={0} value={freeDeliveryInput} onChange={e => setFreeDeliveryInput(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Commission Overdue Grace (Days)</label>
                      <input type="number" min={0} max={30} value={overdueGraceInput} onChange={e => setOverdueGraceInput(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Free Customer Cancel Window (Mins)</label>
                      <input type="number" min={0} max={240} value={freeCancelMinsInput} onChange={e => setFreeCancelMinsInput(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded font-mono" />
                    </div>
                  </div>
                  <button type="submit" className="px-6 py-2.5 bg-[#0B132B] text-white font-bold rounded-md cursor-pointer">
                    Save Platform Rules
                  </button>
                </form>
              </div>
            )}

            {/* TAB: Google Chat Operations Deck */}
            {activeTab === 'googlechat' && <GoogleChatHub />}

            {/* TAB: Legal Policies */}
            {activeTab === 'legal' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold font-brand text-slate-900 text-lg">Legal & Privacy Policies Editor</h3>
                  <span className="text-[11px] text-slate-400">Updated: {legalPolicies.lastUpdated}</span>
                </div>
                {legalSavedAlert && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs">
                    Legal policies updated!
                  </div>
                )}
                <form onSubmit={handleSaveLegalPolicies} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Privacy Policy *</label>
                    <textarea rows={3} required value={privacyInput} onChange={e => setPrivacyInput(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Terms & Conditions *</label>
                    <textarea rows={3} required value={termsInput} onChange={e => setTermsInput(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Cancellation & Refund Policy *</label>
                    <textarea rows={3} required value={refundInput} onChange={e => setRefundInput(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Partner Marketplace Agreement *</label>
                    <textarea rows={3} required value={partnerAgreementInput} onChange={e => setPartnerAgreementInput(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded" />
                  </div>
                  <button type="submit" className="px-6 py-2.5 bg-[#0B132B] text-white font-bold rounded-md cursor-pointer">
                    Save All Legal Policies
                  </button>
                </form>
              </div>
            )}

            {/* TAB: Security Audit Logs */}
            {activeTab === 'logs' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="font-bold font-brand text-slate-900 text-lg">Security & Activity Audit Ledger ({activityLogs.length})</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B132B] text-white">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {activityLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{log.action}</td>
                          <td className="py-2 px-3 font-sans">{log.actorRole} · {log.actorName}</td>
                          <td className="py-2 px-3 uppercase font-bold">{log.status}</td>
                          <td className="py-2 px-3 font-sans text-slate-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: Firebase Schema */}
            {activeTab === 'firebase' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 text-xs">
                <h3 className="font-bold font-brand text-slate-900 text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#D4AF37]" />
                  <span>Firestore Collections & Security Rules Architecture</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <strong>/orders, /garment_evidence, /disputes</strong>
                    <div className="text-slate-500 font-sans mt-1">Scoped per customerId, assignedPartnerId, and admin claims.</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <strong>/commission_ledger, /commission_remittances</strong>
                    <div className="text-slate-500 font-sans mt-1">Weekly 15% platform commission & UTR verification workflow.</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <strong>/service_categories, /service_areas, /garments</strong>
                    <div className="text-slate-500 font-sans mt-1">Dynamic CMS & Pan-India marketplace configuration.</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <strong>/support_tickets, /bulk_enquiries, /reviews, /faqs</strong>
                    <div className="text-slate-500 font-sans mt-1">Verified post-delivery reviews, retention & support queues.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
