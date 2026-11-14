import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OrderStatus, ServiceType, normalizeOrderStatus } from '../types';
import { 
  Radio, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Phone, 
  MessageCircle, 
  Wallet, 
  AlertCircle, 
  ChevronRight, 
  Truck, 
  Sparkles,
  FileText,
  Upload,
  UserPlus,
  Check,
  X,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { GarmentEvidencePanel } from './GarmentEvidencePanel';
import { CommissionLedgerPanel } from './CommissionLedgerPanel';
import { DisputesPanel } from './DisputesPanel';
import { uploadFileToFirebaseStorage } from '../lib/firebaseClient';

export const PartnerDashboard: React.FC = () => {
  const { 
    partners, 
    activePartner, 
    setActivePartnerId, 
    togglePartnerOnline, 
    updatePartnerProfile,
    registerPartner,
    uploadPartnerDocument,
    orders, 
    partnerOrders,
    acceptOrder, 
    rejectOrderOffer,
    updateOrderStatus, 
    settings,
    t, 
    openAuthModal,
    logout,
    authSession,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'radar' | 'assigned' | 'earnings' | 'disputes' | 'documents' | 'register'>('radar');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [upiInput, setUpiInput] = useState(activePartner.upiId || '');

  // Document upload form state
  const [docType, setDocType] = useState<'aadhaar' | 'trade_license' | 'shop_photo'>('trade_license');
  const [docFileName, setDocFileName] = useState('');
  const [docFileUrl, setDocFileUrl] = useState('');

  // Partner Registration Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regShopName, setRegShopName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPin, setRegPin] = useState('110086');
  const [regCity, setRegCity] = useState('Delhi');
  const [regState, setRegState] = useState('Delhi');
  const [regHours, setRegHours] = useState('08:00 AM - 08:00 PM IST');
  const [regServices] = useState<ServiceType[]>(['ironing_normal', 'ironing_steam', 'laundry', 'dry_cleaning']);

  // Guard unauthenticated or non-partner visitors
  if (
    !authSession?.isAuthenticated ||
    (authSession.activeRole !== 'SERVICE_PARTNER' && authSession.activeRole !== 'SUPER_ADMIN') ||
    !authSession.token
  ) {
    return (
      <section className="py-16 bg-[#F4F5F8] min-h-[550px]">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-4">
            <h2 className="text-xl font-bold font-brand text-[#0B132B]">Service Partner Authentication Required</h2>
            <p className="text-xs text-slate-600">
              Please sign in with your registered Service Partner credentials to view assigned orders and dispatch requests.
            </p>
            <button
              onClick={() => openAuthModal('partner', 'login')}
              className="px-5 py-2.5 bg-[#0B132B] text-[#F3E5AB] font-bold text-xs rounded-lg cursor-pointer"
            >
              Partner Sign In
            </button>
          </div>
        </div>
      </section>
    );
  }

  const partnerCoversPin = (pin: string) =>
    activePartner.pincode === pin || (activePartner.servicePincodes || []).includes(pin);

  // Incoming smart dispatch radar: prioritize offers targeted to this partner + unassigned in their area
  const incomingOrders = orders
    .filter(o => {
      const canonical = normalizeOrderStatus(o.status);
      if (canonical !== 'BOOKED' || o.assignedPartnerId) return false;
      if ((o.rejectedPartnerIds || []).includes(activePartner.id)) return false;
      return partnerCoversPin(o.pincode);
    })
    .sort((a, b) => (a.currentOfferPartnerId === activePartner.id ? -1 : b.currentOfferPartnerId === activePartner.id ? 1 : 0));

  // Active orders assigned to this partner (isolated)
  const assignedOrders = partnerOrders.filter(o => {
    const c = normalizeOrderStatus(o.status);
    return c !== 'DELIVERED' && c !== 'CANCELLED';
  });

  // Completed orders by this partner (isolated)
  const completedOrders = partnerOrders.filter(o => normalizeOrderStatus(o.status) === 'DELIVERED');

  const handleAcceptOrder = async (orderId: string) => {
    if (activePartner.status !== 'active' || activePartner.kycVerified === false) {
      setActionAlert({
        type: 'error',
        message: 'Your partner KYC account is pending approval or suspended. You cannot accept orders.',
      });
      return;
    }
    if (activePartner.commissionBlocked) {
      setActionAlert({
        type: 'error',
        message: 'Order acceptance paused due to overdue commission remittance. Submit UTR in Commission Ledger.',
      });
      return;
    }
    if (!activePartner.isOnline) {
      setActionAlert({
        type: 'error',
        message: 'You are currently OFFLINE. Toggle your status to Online to accept requests.',
      });
      return;
    }

    try {
      const lockRes = await fetch('/api/orders/accept-atomic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.token}`,
        },
        body: JSON.stringify({ orderId, partnerId: activePartner.id, partnerName: activePartner.name }),
      });
      const lockData = await lockRes.json();
      if (!lockRes.ok) {
        setActionAlert({
          type: 'error',
          message: lockData.message || 'Server denied order acceptance.',
        });
        return;
      }
    } catch {
      setActionAlert({
        type: 'error',
        message: 'Unable to reach dispatch lock server. Please retry.',
      });
      return;
    }

    const result = acceptOrder(orderId, activePartner.id);
    setActionAlert({ type: result.success ? 'success' : 'error', message: result.message });
    if (result.success) setActiveTab('assigned');
    setTimeout(() => setActionAlert(null), 4000);
  };

  const handleDeclineOffer = async (orderId: string, pincode: string, serviceType: string) => {
    const res = rejectOrderOffer(orderId, activePartner.id, 'Declined by partner');
    fetch('/api/orders/escalate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.token}`,
      },
      body: JSON.stringify({
        orderId,
        pincode,
        serviceType,
        excludedPartnerIds: [activePartner.id],
      }),
    }).catch(() => {});
    setActionAlert({ type: res.success ? 'success' : 'error', message: res.message });
    setTimeout(() => setActionAlert(null), 4000);
  };

  const handleUpdateStatus = (orderId: string, nextStatus: OrderStatus, label: string) => {
    updateOrderStatus(orderId, nextStatus);
    setActionAlert({
      type: 'success',
      message: `Order status advanced to: ${label}`,
    });
    setTimeout(() => setActionAlert(null), 4000);
  };

  const getNextStatusAction = (currentStatus: OrderStatus): { nextStatus: OrderStatus; label: string } | null => {
    const canonical = normalizeOrderStatus(currentStatus);
    switch (canonical) {
      case 'PARTNER_ASSIGNED':
        return { nextStatus: 'PICKUP_SCHEDULED', label: 'Schedule Doorstep Pickup' };
      case 'PICKUP_SCHEDULED':
        return { nextStatus: 'PICKED_UP', label: 'Confirm Doorstep Collection' };
      case 'PICKED_UP':
        return { nextStatus: 'PROCESSING', label: 'Start Steam Ironing / Care' };
      case 'PROCESSING':
        return { nextStatus: 'READY_FOR_DELIVERY', label: 'Quality Checked & Packed' };
      case 'READY_FOR_DELIVERY':
        return { nextStatus: 'OUT_FOR_DELIVERY', label: 'Mark Out for Delivery' };
      case 'OUT_FOR_DELIVERY':
        return { nextStatus: 'DELIVERED', label: 'Confirm Delivered & Direct Payment' };
      default:
        return null;
    }
  };

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFileName.trim()) return;

    uploadPartnerDocument(activePartner.id, {
      docType,
      fileName: docFileName.trim(),
      fileUrl: docFileUrl || undefined,
    });

    setDocFileName('');
    setDocFileUrl('');
    setActionAlert({
      type: 'success',
      message: 'Verification document submitted. Super Admin review pending.',
    });
    setTimeout(() => setActionAlert(null), 4000);
  };

  const handleDocFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFileName(file.name);
    const up = await uploadFileToFirebaseStorage('kyc', activePartner.id, file);
    if (up.success && up.url) {
      setDocFileUrl(up.url);
    }
  };

  const handleRegisterPartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim() || !regShopName.trim() || !regAddress.trim()) {
      setActionAlert({ type: 'error', message: 'Please fill in all required partner details.' });
      return;
    }

    const created = registerPartner({
      name: regName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim(),
      businessName: regShopName.trim(),
      serviceAddress: regAddress.trim(),
      pincode: regPin.trim(),
      city: regCity.trim() || 'Delhi',
      state: regState.trim() || 'Delhi',
      servicesOffered: regServices,
      workingHours: regHours.trim(),
    });

    setActionAlert({
      type: 'success',
      message: `Partner registration submitted for ${created.name}! Awaiting Admin KYC approval.`,
    });
    setActiveTab('documents');
  };

  return (
    <section className="py-10 bg-[#F4F5F8] min-h-[850px] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Top Control Bar with Online/Offline Switcher & Partner Identity */}
        <div className="bg-[#0B132B] text-white p-6 rounded-xl border border-[#D4AF37]/30 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
              <span>SHAH SIGNATURE Service Partner Hub</span>
              <span aria-hidden="true">·</span>
              <span>PIN {activePartner.pincode} Sultanpuri</span>
            </div>
            <h2 className="text-2xl font-bold font-brand text-white flex flex-wrap items-center gap-2">
              <span>{activePartner.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40">
                {activePartner.partnerCode || `SHAH-PRT-${activePartner.id.slice(-4)}`}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                activePartner.status === 'active' 
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                  : 'bg-amber-950 text-amber-300 border border-amber-700/60'
              }`}>
                {activePartner.status === 'active' ? `Approved · ★ ${activePartner.rating}` : 'Pending Approval'}
              </span>
            </h2>
            <p className="text-xs text-slate-300">
              {activePartner.businessName} ({activePartner.hubName}) · {activePartner.serviceAddress}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAuthModal('partner')}
              className="px-3 py-1.5 bg-[#FAF7F0] hover:bg-white text-[#0B132B] rounded text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Partner Sign In / Register
            </button>
            {authSession && authSession.activeRole === 'SERVICE_PARTNER' && (
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 rounded text-xs font-medium cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>

          {/* Partner Switcher only visible to Super Admin */}
          <div className="flex flex-wrap items-center gap-3">
            {authSession.activeRole === 'SUPER_ADMIN' && (
              <div className="text-xs text-slate-400">
                <span className="mr-1">Inspect Partner (Admin):</span>
                <select
                  value={activePartner.id}
                  onChange={(e) => setActivePartnerId(e.target.value)}
                  className="bg-[#060B18] text-white border border-slate-700 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#D4AF37]"
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status === 'active' ? 'Approved' : 'Pending'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Online / Offline Toggle Button */}
            <button
              onClick={() => {
                if (activePartner.status !== 'active') {
                  setActionAlert({
                    type: 'error',
                    message: 'Account pending admin verification. You cannot go online until approved.',
                  });
                  return;
                }
                togglePartnerOnline(activePartner.id);
              }}
              className={`px-5 py-2.5 rounded-md text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                activePartner.status !== 'active'
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : activePartner.isOnline
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-[#060B18]'
                  : 'bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700'
              }`}
            >
              <Radio className={`w-4 h-4 ${activePartner.isOnline && activePartner.status === 'active' ? 'animate-pulse' : ''}`} />
              <span>
                {activePartner.status !== 'active'
                  ? 'VERIFICATION PENDING'
                  : activePartner.isOnline
                  ? 'ONLINE (ACCEPTING ORDERS)'
                  : 'OFFLINE (PAUSED)'}
              </span>
            </button>
          </div>
        </div>

        {/* Prominent Pending Approval Warning Banner */}
        {activePartner.status === 'pending' && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Partner Account Verification Underway:</span> Your workshop registration is being reviewed by Ronak and the SHAH SIGNATURE admin desk. Upload verification documents below to expedite approval.
              </div>
            </div>
            <button
              onClick={() => setActiveTab('documents')}
              className="px-3.5 py-1.5 bg-amber-600 text-white font-semibold rounded text-xs hover:bg-amber-700 cursor-pointer whitespace-nowrap"
            >
              Upload Documents
            </button>
          </div>
        )}

        {/* Global Action Alert Notification */}
        {actionAlert && (
          <div className={`p-4 rounded-lg text-xs font-semibold flex items-center justify-between ${
            actionAlert.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {actionAlert.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionAlert.message}</span>
            </div>
            <button onClick={() => setActionAlert(null)} className="text-slate-500 hover:text-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Key Partner Metrics Grid (Strict Partner Isolation) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Live Radar Requests</div>
            <div className="text-2xl font-bold font-mono text-[#0B132B] mt-1 tabular-nums">
              {incomingOrders.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">PIN 110086 Sultanpuri</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 uppercase tracking-wider">My Active Assignments</div>
            <div className="text-2xl font-bold font-mono text-[#0B132B] mt-1 tabular-nums">
              {assignedOrders.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">In collection or steam press</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Wallet Balance</div>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
              ₹{activePartner.walletBalance}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Net of {settings.platformCommissionPercent}% platform fee</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Deliveries Completed</div>
            <div className="text-2xl font-bold font-mono text-[#0B132B] mt-1 tabular-nums">
              {Math.max(activePartner.totalOrdersCompleted, completedOrders.length)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Capacity: {activePartner.currentActiveOrders || 0}/{activePartner.maxDailyCapacity || 25} active</div>
          </div>
        </div>

        {/* Partner Performance Scorecard & Direct UPI Settings Strip */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold text-[#0B132B]">
              <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
              <span>Performance Scorecard:</span>
            </div>
            <span>Accept Rate: <strong>{activePartner.performance?.acceptanceRate ?? 100}%</strong></span>
            <span>Reject Rate: <strong>{activePartner.performance?.rejectionRate ?? 0}%</strong></span>
            <span>On-Time Pickup: <strong>{activePartner.performance?.onTimePickupRate ?? 100}%</strong></span>
            <span>On-Time Delivery: <strong>{activePartner.performance?.onTimeDeliveryRate ?? 100}%</strong></span>
            <span>Complaints: <strong className="text-rose-600">{activePartner.performance?.complaintsCount ?? 0}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 whitespace-nowrap">Direct Customer UPI ID:</span>
            <input
              type="text"
              value={upiInput}
              onChange={e => setUpiInput(e.target.value)}
              placeholder="partner@okicici"
              className="px-2.5 py-1 border border-slate-300 rounded font-mono text-xs w-44"
            />
            <button
              type="button"
              onClick={() => {
                updatePartnerProfile(activePartner.id, { upiId: upiInput.trim() });
                setActionAlert({ type: 'success', message: 'Direct UPI ID updated for customer settlements.' });
              }}
              className="px-3 py-1 bg-[#0B132B] text-[#F3E5AB] font-semibold rounded cursor-pointer"
            >
              Save UPI
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('radar')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'radar'
                ? 'bg-[#0B132B] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-[#D4AF37]" />
            <span>Dispatch Radar ({incomingOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'assigned'
                ? 'bg-[#0B132B] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Truck className="w-4 h-4 text-[#D4AF37]" />
            <span>Active Assignments ({assignedOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'earnings'
                ? 'bg-[#0B132B] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4 text-[#D4AF37]" />
            <span>15% Commission Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'disputes'
                ? 'bg-[#0B132B] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
            <span>Disputes</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'documents'
                ? 'bg-[#0B132B] text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            <span>KYC Docs ({activePartner.documents?.length || 0})</span>
          </button>

          <button
            onClick={() => openAuthModal('partner', 'register')}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          >
            <UserPlus className="w-4 h-4 text-[#D4AF37]" />
            <span>Register New Hub</span>
          </button>
        </div>

        {/* TAB 1: Live Nearby Dispatch Radar (First-Valid-Acceptance Atomic Concurrency) */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Broadcasting Orders in Sultanpuri & North West Delhi PIN 110086
              </span>
              <span>First approved partner to accept acquires atomic exclusive lock</span>
            </div>

            {activePartner.status !== 'active' ? (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">Account Awaiting Verification</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Only approved partners can receive and accept incoming customer orders. Once Super Admin approves your workshop credentials, the live radar will activate.
                </p>
              </div>
            ) : incomingOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                <Radio className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
                <h3 className="font-bold text-slate-800 text-base">Radar Active: No Unassigned Orders</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Listening for newly placed bookings in PIN 110086. When a customer confirms a valet booking, it will appear here instantly.
                </p>
                <div className="pt-2">
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
                    Partner status: <strong>{activePartner.isOnline ? 'Online & Listening' : 'Offline'}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingOrders.map(order => {
                  const partnerShare = Math.round(order.totalAmount * (1 - settings.platformCommissionPercent / 100));

                  return (
                    <div
                      key={order.id}
                      className="bg-white p-5 rounded-xl border-2 border-[#D4AF37] shadow-md space-y-4 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold tracking-widest text-[#AA7C11] uppercase">
                            Nearby Customer Dispatch Request
                          </span>
                          <h4 className="text-lg font-bold font-brand text-[#0B132B]">
                            {order.orderNumber}
                          </h4>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-400">Your Net Payout:</div>
                          <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                            ₹{partnerShare}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-slate-800">
                          <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">{order.customerAddress}</span>
                            <div className="text-slate-500">PIN: {order.pincode} ({order.locality})</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Pickup Slot: <strong>{order.pickupSlot}</strong></span>
                        </div>

                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                          <div className="font-semibold text-slate-700 flex justify-between">
                            <span>{order.serviceType.replace('_', ' ').toUpperCase()}</span>
                            <span>{order.items.reduce((s, i) => s + i.quantity, 0)} total garments</span>
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {order.items.map(i => `${i.name} (${i.quantity})`).join(', ')}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-slate-400">
                          Total Value: ₹{order.totalAmount}
                          {order.currentOfferPartnerId === activePartner.id && ' · Priority Queue Offer'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeclineOffer(order.id, order.pincode, order.serviceType)}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-md cursor-pointer"
                          >
                            Pass / Escalate
                          </button>
                          <button
                            onClick={() => handleAcceptOrder(order.id)}
                            className="px-5 py-2 bg-[#0B132B] hover:bg-black text-white font-bold text-xs rounded-md shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>Accept Atomic</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Active Assigned Orders & Status Pipeline Updater */}
        {activeTab === 'assigned' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Orders Currently Assigned to You ({assignedOrders.length})
              </span>
              <span>Advance the lifecycle as you collect, press, and deliver garments</span>
            </div>

            {assignedOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                <Truck className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">No Active Assignments</h3>
                <p className="text-xs text-slate-500">
                  Switch to the Live Radar tab to accept incoming orders in PIN 110086.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignedOrders.map(order => {
                  const nextAction = getNextStatusAction(order.status);
                  const partnerShare = Math.round(order.totalAmount * (1 - settings.platformCommissionPercent / 100));

                  return (
                    <div
                      key={order.id}
                      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            Customer: {order.customerName} · {order.customerPhone}
                          </div>
                          <div className="text-xl font-bold font-brand text-[#0B132B] mt-0.5">
                            {order.orderNumber}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(order.customerName)},%20I%20am%20${encodeURIComponent(activePartner.name)}%20from%20SHAH%20SIGNATURE%20regarding%20your%20order%20${order.orderNumber}.`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp Customer</span>
                          </a>
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="p-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
                            title="Call customer"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF7F0] border border-[#D4AF37]/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Current State:</span>
                          <div className="font-bold text-[#0B132B] text-sm mt-0.5">
                            {t.statusLabels[order.status] || order.status}
                          </div>
                        </div>

                        {nextAction && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, nextAction.nextStatus, nextAction.label)}
                            className="px-4 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold text-xs rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>{nextAction.label}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Quick Stage Advance Bar */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Stage Shortcut:</span>
                        {normalizeOrderStatus(order.status) !== 'PICKED_UP' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'PICKED_UP', 'Valet collected garments at doorstep')}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Picked Up
                          </button>
                        )}
                        {normalizeOrderStatus(order.status) !== 'PROCESSING' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'PROCESSING', 'Artisan boiler press & sanitization in progress')}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Processing
                          </button>
                        )}
                        {normalizeOrderStatus(order.status) !== 'READY_FOR_DELIVERY' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'READY_FOR_DELIVERY', 'Quality inspected & sealed in wardrobe packaging')}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Ready for Delivery
                          </button>
                        )}
                        {normalizeOrderStatus(order.status) !== 'OUT_FOR_DELIVERY' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'OUT_FOR_DELIVERY', 'Valet en route to customer')}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Out for Delivery
                          </button>
                        )}
                        {normalizeOrderStatus(order.status) !== 'DELIVERED' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'DELIVERED', 'Delivered & direct payment settled')}
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold cursor-pointer"
                          >
                            Delivered
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-700">Doorstep Location:</div>
                          <p className="text-slate-600 leading-relaxed">
                            {order.customerAddress}, {order.pincode} ({order.locality})
                          </p>
                          <div className="text-slate-500">Slot: {order.pickupSlot} · Net Share: ₹{partnerShare}</div>
                        </div>

                        <div className="space-y-1">
                          <div className="font-semibold text-slate-700">Garments Checklist:</div>
                          <div className="divide-y divide-slate-100">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="py-1 flex justify-between text-slate-600">
                                <span>{it.name} × {it.quantity}</span>
                                <span className="font-mono tabular-nums">₹{it.totalPrice}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <GarmentEvidencePanel order={order} viewerRole="partner" />

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Commission Ledger & Weekly UTR Remittances */}
        {activeTab === 'earnings' && (
          <CommissionLedgerPanel viewerRole="partner" partnerId={activePartner.id} />
        )}

        {/* TAB: Disputes */}
        {activeTab === 'disputes' && (
          <DisputesPanel viewerRole="partner" partnerId={activePartner.id} />
        )}

        {/* TAB 4: Document Verification Uploads */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold font-brand text-slate-900">Submit Verification Documents</h3>
              <p className="text-xs text-slate-500">
                To receive nearby customer requests in PIN 110086, partners must submit business trade license or ID verification.
              </p>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                >
                  <option value="trade_license">MCD Trade License / Registration</option>
                  <option value="aadhaar">Government ID / Aadhaar Card</option>
                  <option value="shop_photo">Workshop & Steam Equipment Photo</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Upload Document File (Firebase Storage) *</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleDocFileInput}
                  className="w-full px-3 py-2 border border-dashed border-slate-300 rounded text-xs text-slate-700 bg-slate-50 cursor-pointer"
                />
                {docFileUrl && (
                  <div className="mt-1 text-[10px] text-emerald-700 font-semibold">
                    File uploaded securely to cloud storage.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document File Name or Identifier *</label>
                <input
                  type="text"
                  required
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                  placeholder="e.g. mcd_trade_license_sultanpuri_2026.pdf"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Submit Document to Admin</span>
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-800">Uploaded Documents ({activePartner.documents?.length || 0}):</div>
              {activePartner.documents?.length === 0 ? (
                <div className="text-slate-400">No documents submitted yet.</div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {activePartner.documents.map(d => (
                    <div key={d.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{d.fileName}</div>
                        <div className="text-[11px] text-slate-400">Uploaded on {d.uploadedAt}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        d.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {d.status === 'verified' ? 'Verified by Admin' : 'Review Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Register New Partner Hub */}
        {activeTab === 'register' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold font-brand text-slate-900">Partner Onboarding Registration</h3>
              <p className="text-xs text-slate-500">
                Join SHAH SIGNATURE as an artisan steam pressing or laundry partner across India.
              </p>
            </div>

            <form onSubmit={handleRegisterPartner} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ramesh Chandra"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="partner@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Workshop / Business Name *</label>
                  <input
                    type="text"
                    required
                    value={regShopName}
                    onChange={(e) => setRegShopName(e.target.value)}
                    placeholder="e.g. Chandra Steam Pressing Hub"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">6-Digit PIN Code *</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    placeholder="110086"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="Delhi"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={regState}
                    onChange={(e) => setRegState(e.target.value)}
                    placeholder="Delhi"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Working Hours</label>
                  <input
                    type="text"
                    value={regHours}
                    onChange={(e) => setRegHours(e.target.value)}
                    placeholder="08:00 AM - 08:30 PM IST"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Service Address *</label>
                  <input
                    type="text"
                    required
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Shop 12, Main Market, Sultanpuri, Delhi 110086"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                >
                  Submit Registration for Admin Approval
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </section>
  );
};
