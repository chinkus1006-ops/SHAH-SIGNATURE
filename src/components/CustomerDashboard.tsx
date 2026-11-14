import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OrderStatus, normalizeOrderStatus } from '../types';
import { 
  Sparkles, 
  MapPin, 
  Phone, 
  MessageCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText,
  Home,
  Building,
  RotateCcw,
  Star,
  AlertTriangle,
  Award,
  XCircle,
} from 'lucide-react';
import { LiveTrackingMap } from './LiveTrackingMap';
import { RealtimeOrderTracker } from './RealtimeOrderTracker';
import { GarmentEvidencePanel } from './GarmentEvidencePanel';
import { DisputesPanel } from './DisputesPanel';

export const CustomerDashboard: React.FC = () => {
  const { 
    customerOrders, 
    activeTrackingOrderId, 
    setActiveTrackingOrderId, 
    customerUser, 
    updateCustomerUser,
    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,
    setDefaultAddress,
    businessSettings,
    setIsContactModalOpen,
    t, 
    setIsBookingOpen,
    openAuthModal,
    logout,
    changePassword,
    authSession,
    customerCancelOrder,
    rebookOrder,
    submitVerifiedReview,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'track' | 'history' | 'disputes' | 'addresses' | 'profile'>('track');
  const [disputeOrderId, setDisputeOrderId] = useState<string | undefined>(undefined);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(customerUser.name);
  const [profilePhone, setProfilePhone] = useState(customerUser.phone);
  const [profileEmail, setProfileEmail] = useState(customerUser.email || '');

  // Cancellation, Review & Feedback states
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [dashAlert, setDashAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Address modal/form state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [addrLine, setAddrLine] = useState('');
  const [addrLocality, setAddrLocality] = useState('');
  const [addrPin, setAddrPin] = useState('110086');
  const [addrLandmark, setAddrLandmark] = useState('');

  // Get currently tracked order from this customer's isolated orders
  const currentOrder = customerOrders.find(o => o.id === activeTrackingOrderId) || customerOrders[0];
  const currentCanonical = currentOrder ? normalizeOrderStatus(currentOrder.status) : 'BOOKED';

  const pipelineStages: { status: OrderStatus; label: string; desc: string }[] = [
    { status: 'BOOKED', label: 'Booked', desc: 'Smart dispatch initiated' },
    { status: 'PARTNER_ASSIGNED', label: 'Partner Assigned', desc: 'KYC-verified hub locked' },
    { status: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled', desc: 'Valet en route for collection' },
    { status: 'PICKED_UP', label: 'Garments Picked', desc: 'Count, photo & OTP verified' },
    { status: 'PROCESSING', label: 'Processing', desc: 'Artisan press / clean care' },
    { status: 'READY_FOR_DELIVERY', label: 'Ready for Delivery', desc: 'Quality checked & packed' },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Doorstep valet en route' },
    { status: 'DELIVERED', label: 'Delivered', desc: 'OTP verified & settled' },
  ];

  const getStageIndex = (status: OrderStatus) => {
    const canonical = normalizeOrderStatus(status);
    if (canonical === 'CANCELLED' || canonical === 'DISPUTED') return -1;
    return pipelineStages.findIndex(s => s.status === canonical);
  };

  const currentStageIdx = currentOrder ? getStageIndex(currentOrder.status) : 0;

  const handleConfirmCustomerCancel = () => {
    if (!cancelOrderId || !cancelReason.trim()) return;
    const res = customerCancelOrder(cancelOrderId, cancelReason.trim());
    setDashAlert({ type: res.success ? 'success' : 'error', text: res.message });
    setCancelOrderId(null);
    setCancelReason('');
    setTimeout(() => setDashAlert(null), 5000);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder || !reviewComment.trim()) return;
    const res = submitVerifiedReview({
      orderId: currentOrder.id,
      rating: reviewRating,
      comment: reviewComment.trim(),
    });
    setDashAlert({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setReviewComment('');
    setTimeout(() => setDashAlert(null), 5000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerUser({
      name: profileName,
      phone: profilePhone,
      email: profileEmail,
    });
    setEditingProfile(false);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrLine.trim() || !addrPin.trim()) return;

    if (editingAddrId) {
      updateCustomerAddress(editingAddrId, {
        label: addrLabel,
        addressLine: addrLine.trim(),
        locality: addrLocality.trim(),
        pincode: addrPin.trim(),
        landmark: addrLandmark.trim(),
      });
      setEditingAddrId(null);
    } else {
      addCustomerAddress({
        label: addrLabel,
        addressLine: addrLine.trim(),
        locality: addrLocality.trim(),
        pincode: addrPin.trim(),
        landmark: addrLandmark.trim(),
        isDefault: customerUser.addresses.length === 0,
      });
    }

    setIsAddingAddress(false);
    setAddrLine('');
    setAddrLocality('');
    setAddrPin('110086');
    setAddrLandmark('');
  };

  const cleanWhatsApp = businessSettings.whatsappSupportNumber.replace(/[^0-9]/g, '') || '919899229102';

  if (
    !authSession?.isAuthenticated ||
    (authSession.activeRole !== 'CUSTOMER' && authSession.activeRole !== 'SUPER_ADMIN') ||
    !authSession.token
  ) {
    return (
      <section id="track" className="py-12 bg-[#F8F9FB] border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#0B132B] text-[#D4AF37] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-xs font-semibold text-[#AA7C11] tracking-widest uppercase">
              Private Customer Concierge Portal
            </div>
            <h2 className="text-2xl font-bold font-brand text-[#0B132B]">
              Sign In to Track Orders &amp; View Receipts
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Your live order tracking, doorstep pickup/delivery OTPs, saved addresses, and garment protection claims are protected and private to your account.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => openAuthModal('customer', 'login')}
                className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] text-xs font-bold rounded-lg cursor-pointer shadow-sm"
              >
                Customer Sign In
              </button>
              <button
                onClick={() => openAuthModal('customer', 'register')}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="track" className="py-12 bg-[#F8F9FB] min-h-[700px] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Customer Portal Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#AA7C11] tracking-widest uppercase">
              <span>Customer Concierge Portal</span>
              <span aria-hidden="true">·</span>
              <span>PIN 110086 Sultanpuri Hub</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-brand text-[#0B132B] mt-1 flex flex-wrap items-center gap-2">
              <span>Welcome, {customerUser.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-[#D4AF37]/20 text-[#0B132B] border border-[#D4AF37]/40">
                {customerUser.customerCode || 'SHAH-CUST-8601'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#AA7C11]" />
                {customerUser.rewardPoints || 0} Points
              </span>
              {customerUser.activeSubscription && (
                <span className="text-xs px-2.5 py-0.5 rounded font-semibold bg-[#0B132B] text-[#F3E5AB]">
                  {customerUser.activeSubscription.planName}
                </span>
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAuthModal('customer')}
              className="px-3 py-1.5 bg-[#0B132B] text-white rounded text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
            >
              Account Login / Switch
            </button>
            {authSession && authSession.activeRole === 'CUSTOMER' && (
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('track')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'track'
                  ? 'bg-[#0B132B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              Live Tracking
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-[#0B132B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              My Orders ({customerOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('disputes')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeTab === 'disputes'
                  ? 'bg-[#0B132B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Disputes</span>
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'addresses'
                  ? 'bg-[#0B132B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              Address Book ({customerUser.addresses?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-[#0B132B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              Profile
            </button>
          </div>
        </div>

        {dashAlert && (
          <div
            className={`mb-6 p-3.5 rounded-lg text-xs font-semibold border ${
              dashAlert.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {dashAlert.text}
          </div>
        )}

        {/* TAB 1: Real-Time Order Tracking */}
        {activeTab === 'track' && (
          <>
            {!currentOrder ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 max-w-md mx-auto space-y-4">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">No Orders Placed Yet</h3>
                <p className="text-xs text-slate-500">
                  Book your first valet pressing or luxury laundry order to experience live tracking in Delhi 110086.
                </p>
                <button
                  onClick={() => setIsBookingOpen(true)}
                  className="px-6 py-2.5 bg-[#0B132B] text-white font-semibold text-xs rounded-md shadow-sm cursor-pointer"
                >
                  Schedule Your First Service
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column (8 cols): Interactive Progress Stepper & Timeline */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Real-Time Status & Lifecycle Tracker */}
                  <RealtimeOrderTracker order={currentOrder} showPartnerQuickActions={false} />

                  {/* Garment Inspection Evidence, Photos & Handover OTPs */}
                  <GarmentEvidencePanel
                    order={currentOrder}
                    viewerRole="customer"
                    onReportIssue={ord => {
                      setDisputeOrderId(ord.id);
                      setActiveTab('disputes');
                    }}
                  />

                  {/* Real-Time Doorstep & Valet Transit Map */}
                  <LiveTrackingMap 
                    order={currentOrder} 
                    valetName={currentOrder.assignedPartnerName} 
                    valetPhone={currentOrder.assignedPartnerPhone} 
                  />

                  {/* Active Order Banner Card */}
                  <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                          Tracking Active Order
                        </div>
                        <div className="text-xl sm:text-2xl font-bold font-brand text-[#0B132B] mt-0.5">
                          {currentOrder.orderNumber}
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="text-right">
                        <span className="text-xs font-semibold text-[#0B132B] tracking-wide uppercase">
                          {t.statusLabels[currentOrder.status] || currentOrder.status}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {currentOrder.pickupSlot}
                        </div>
                      </div>
                    </div>

                    {/* Progress Pipeline Visualization (All Standardized Milestones) */}
                    <div className="space-y-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Garment Concierge Milestones (Real-Time Updates)
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {pipelineStages.map((stage, idx) => {
                          const isDone = currentStageIdx >= idx;
                          const isCurrent = currentStageIdx === idx;

                          return (
                            <div 
                              key={stage.status}
                              className={`p-3 rounded-lg border text-xs transition-colors ${
                                isCurrent
                                  ? 'bg-[#0B132B] text-white border-[#0B132B] shadow-sm'
                                  : isDone
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-bold mb-1">
                                {isDone ? (
                                  <CheckCircle2 className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#D4AF37]' : 'text-emerald-600'}`} />
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px]">
                                    {idx + 1}
                                  </span>
                                )}
                                <span>{stage.label}</span>
                              </div>
                              <p className={`text-[11px] ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                                {stage.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assigned Partner Profile Card with Instant WhatsApp & Call Contact */}
                    <div className="p-4 rounded-lg bg-[#FAF7F0] border border-[#D4AF37]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0B132B] text-[#F3E5AB] flex items-center justify-center font-serif text-lg font-bold border border-[#D4AF37]">
                          {currentOrder.assignedPartnerName ? currentOrder.assignedPartnerName[0] : 'S'}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider">
                            Assigned Valet Specialist
                          </div>
                          <div className="font-bold text-slate-900 text-sm">
                            {currentOrder.assignedPartnerName || 'Broadcasting in PIN 110086...'}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {currentOrder.assignedPartnerPhone ? `Direct: ${currentOrder.assignedPartnerPhone}` : 'Searching nearby verified partners'}
                          </div>
                        </div>
                      </div>

                      {currentOrder.assignedPartnerPhone ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://wa.me/${currentOrder.assignedPartnerPhone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(currentOrder.assignedPartnerName || '')},%20regarding%20my%20SHAH%20SIGNATURE%20order%20${currentOrder.orderNumber}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp Valet</span>
                          </a>

                          <a
                            href={`tel:${currentOrder.assignedPartnerPhone}`}
                            className="p-2 border border-slate-300 rounded-md text-slate-700 hover:bg-white transition-colors"
                            title="Call Valet"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <a
                          href={`https://wa.me/${cleanWhatsApp}?text=Hello%20Ronak,%20regarding%20my%20SHAH%20SIGNATURE%20order%20${currentOrder.orderNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Concierge</span>
                        </a>
                      )}
                    </div>

                    {/* Customer Pre-Pickup Cancel, Rebook & Post-Delivery Review */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex flex-wrap gap-2">
                        {['BOOKED', 'PARTNER_ASSIGNED', 'PICKUP_SCHEDULED'].includes(currentCanonical) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelOrderId(currentOrder.id);
                              setCancelReason('');
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Before Pickup</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => rebookOrder(currentOrder)}
                          className="px-3 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] rounded font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rebook This Order</span>
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Direct Payment: UPI / Cash upon delivery
                      </span>
                    </div>

                    {currentCanonical === 'DELIVERED' && !currentOrder.reviewSubmitted && (
                      <form onSubmit={handleSubmitReview} className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3 text-xs">
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-[#D4AF37]" />
                          <span>Rate Your Verified Delivery ({currentOrder.orderNumber})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Rating:</span>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className={`px-2 py-1 rounded border font-bold cursor-pointer ${
                                reviewRating >= star
                                  ? 'bg-[#D4AF37] text-[#060B18] border-[#D4AF37]'
                                  : 'bg-white text-slate-400 border-slate-200'
                              }`}
                            >
                              ★ {star}
                            </button>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          required
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          placeholder="Share honest feedback on crease crispness, hygiene & punctuality..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#0B132B] text-white font-bold rounded cursor-pointer"
                        >
                          Publish Verified Review
                        </button>
                      </form>
                    )}

                    {/* Live Audit Log Timeline */}
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Real-Time Activity Audit Log
                      </div>
                      <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
                        {currentOrder.logs.map((log, lIdx) => (
                          <div key={lIdx} className="relative text-xs">
                            <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#0B132B]" />
                            <div className="flex items-center gap-2 text-slate-500">
                              <span className="font-mono text-[11px] font-semibold text-slate-700">{log.timestamp}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-slate-800">{log.actor}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5 leading-relaxed">
                              {log.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right Column (4 cols): Detailed Receipt & Delivery Coordinates */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Receipt Breakdown Card */}
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 flex items-center justify-between">
                      <span>Order Receipt</span>
                      <span className="text-xs font-normal text-slate-500">{currentOrder.items.length} garment types</span>
                    </h3>

                    {/* Garments list */}
                    <div className="space-y-2.5 text-xs">
                      {currentOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-slate-800 font-medium">
                            {item.name} × {item.quantity}
                          </span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            ₹{item.totalPrice}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Charges calculation */}
                    <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-mono tabular-nums">₹{currentOrder.subtotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valet Delivery:</span>
                        <span className="font-mono tabular-nums">
                          {currentOrder.deliveryCharge === 0 ? 'FREE' : `₹${currentOrder.deliveryCharge}`}
                        </span>
                      </div>
                      {currentOrder.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Discount Voucher:</span>
                          <span className="font-mono tabular-nums">-₹{currentOrder.discount}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                        <span>Total Amount:</span>
                        <span className="font-mono text-base tabular-nums text-[#0B132B]">₹{currentOrder.totalAmount}</span>
                      </div>
                    </div>

                    {/* Doorstep Address info */}
                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Delivery Location:</span>
                      </div>
                      <p className="leading-relaxed pl-4">
                        {currentOrder.customerAddress}, {currentOrder.pincode} ({currentOrder.locality})
                      </p>
                    </div>

                    {/* Concierge Support Buttons with Ronak's details */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <a
                        href={`https://wa.me/${cleanWhatsApp}?text=Need%20assistance%20with%20SHAH%20SIGNATURE%20order%20${currentOrder.orderNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat on WhatsApp (+{cleanWhatsApp})</span>
                      </a>

                      <button
                        onClick={() => setIsContactModalOpen(true)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded cursor-pointer transition-colors"
                      >
                        Contact Concierge Desk (Ronak)
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </>
        )}

        {/* TAB 2: Order History (Strict Customer Data Isolation) */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 font-brand">Your Garment Care History</h3>
                <p className="text-xs text-slate-500">Only your private orders are displayed here.</p>
              </div>
              <span className="text-xs text-slate-500">{customerOrders.length} bookings</span>
            </div>

            {customerOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                You have not placed any orders yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customerOrders.map(order => (
                  <div 
                    key={order.id}
                    className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold font-brand text-[#0B132B]">{order.orderNumber}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 font-medium">
                          {order.serviceType.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-semibold text-[#0B132B] uppercase">
                          {t.statusLabels[order.status] || order.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500">
                        <span>{order.items.reduce((s, i) => s + i.quantity, 0)} garments</span>
                        <span className="mx-1.5">|</span>
                        <span>Slot: {order.pickupSlot}</span>
                        <span className="mx-1.5">|</span>
                        <span>Valet: {order.assignedPartnerName || 'Searching...'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#0B132B] tabular-nums font-mono">
                          ₹{order.totalAmount}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => rebookOrder(order)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rebook</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTrackingOrderId(order.id);
                            setActiveTab('track');
                          }}
                          className="px-3.5 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                        >
                          Track
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Disputes & Garment Protection */}
        {activeTab === 'disputes' && (
          <DisputesPanel
            viewerRole="customer"
            customerOrders={customerOrders}
            defaultOrderId={disputeOrderId}
          />
        )}

        {/* TAB 3: Address Book Management */}
        {activeTab === 'addresses' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold font-brand text-slate-900 text-lg">My Address Book</h3>
                <p className="text-xs text-slate-500">Manage multiple delivery addresses in Delhi PIN 110086.</p>
              </div>

              {!isAddingAddress && (
                <button
                  onClick={() => {
                    setIsAddingAddress(true);
                    setEditingAddrId(null);
                    setAddrLine('');
                    setAddrLocality('');
                    setAddrPin('110086');
                  }}
                  className="px-4 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Add New Address</span>
                </button>
              )}
            </div>

            {/* Add / Edit Address Form */}
            {isAddingAddress && (
              <form onSubmit={handleSaveAddress} className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-4 text-xs">
                <div className="font-bold text-slate-900">
                  {editingAddrId ? 'Edit Address' : 'Add New Doorstep Address'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Address Label</label>
                    <select
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                    >
                      <option value="Home">Home</option>
                      <option value="Office">Office</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Delhi PIN Code *</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={addrPin}
                      onChange={(e) => setAddrPin(e.target.value)}
                      placeholder="110086"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Locality / Landmark</label>
                    <input
                      type="text"
                      value={addrLocality}
                      onChange={(e) => setAddrLocality(e.target.value)}
                      placeholder="e.g. Sultanpuri Block B"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-slate-700 font-medium mb-1">House / Flat No., Floor, Street Address *</label>
                    <input
                      type="text"
                      required
                      value={addrLine}
                      onChange={(e) => setAddrLine(e.target.value)}
                      placeholder="e.g. House 14, 2nd Floor, Main Market Road"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAddress(false);
                      setEditingAddrId(null);
                    }}
                    className="px-3.5 py-1.5 text-slate-600 hover:text-black cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-semibold rounded cursor-pointer"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            )}

            {/* Address Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customerUser.addresses?.map(addr => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                    addr.isDefault ? 'border-[#D4AF37] bg-[#FAF7F0] shadow-xs' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {addr.label === 'Home' ? <Home className="w-4 h-4 text-[#AA7C11]" /> : <Building className="w-4 h-4 text-slate-600" />}
                        <span className="font-bold text-slate-900 text-sm">{addr.label}</span>
                      </div>
                      {addr.isDefault && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          Default Address
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                      {addr.addressLine}
                      {addr.locality && <>, {addr.locality}</>}
                    </p>
                    <div className="text-xs font-mono text-slate-500 mt-1">
                      PIN Code: {addr.pincode} (Delhi)
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    {!addr.isDefault ? (
                      <button
                        onClick={() => setDefaultAddress(addr.id)}
                        className="text-slate-600 hover:text-black font-semibold cursor-pointer"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-medium">Primary Valet Drop</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingAddrId(addr.id);
                          setAddrLabel(addr.label);
                          setAddrLine(addr.addressLine);
                          setAddrLocality(addr.locality || '');
                          setAddrPin(addr.pincode);
                          setIsAddingAddress(true);
                        }}
                        className="text-slate-500 hover:text-black p-1"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {customerUser.addresses.length > 1 && (
                        <button
                          onClick={() => deleteCustomerAddress(addr.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 4: Profile Details */}
        {activeTab === 'profile' && (
          <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold font-brand text-slate-900 text-lg">Customer Account</h3>
                <p className="text-xs text-slate-500">Manage your profile details and notifications.</p>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded cursor-pointer"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {editingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Mobile Phone (for Valet Contact & OTP)</label>
                  <input
                    type="tel"
                    required
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="px-4 py-2 text-slate-600 hover:text-black cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0B132B] text-white font-semibold rounded cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-semibold text-slate-900">{customerUser.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Mobile Phone:</span>
                  <span className="font-semibold text-slate-900 font-mono">{customerUser.phone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-semibold text-slate-900">{customerUser.email || 'None provided'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Customer Reference Code:</span>
                  <span className="font-mono font-bold text-[#AA7C11]">{customerUser.customerCode || 'SHAH-CUST-8601'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Account Status:</span>
                  <span className="font-semibold text-emerald-700">Active Customer</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Total Bookings:</span>
                  <span className="font-semibold text-slate-900 font-mono">{customerOrders.length} orders</span>
                </div>
              </div>
            )}

            {/* Change Password Card */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span>Security & Password Protection</span>
              </div>
              
              {pwdMsg && (
                <div className={`p-2.5 rounded text-xs ${
                  pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {pwdMsg.text}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newPwd.length < 8) {
                    setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
                    return;
                  }
                  if (newPwd !== confirmPwd) {
                    setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
                    return;
                  }
                  const res = await changePassword('CUSTOMER', customerUser.id, currentPwd, newPwd);
                  if (res.success) {
                    setPwdMsg({ type: 'success', text: res.message });
                    setCurrentPwd('');
                    setNewPwd('');
                    setConfirmPwd('');
                  } else {
                    setPwdMsg({ type: 'error', text: res.message });
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block text-slate-600 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#0B132B] text-white rounded text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Customer Self-Cancellation Modal */}
      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h4 className="font-bold font-brand text-slate-900 text-base">Cancel Order Before Pickup</h4>
            <p className="text-slate-600">
              Free self-cancellation is available prior to garment pickup. Please provide a quick reason:
            </p>
            <textarea
              rows={3}
              required
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Plans changed / need to reschedule pickup slot"
              className="w-full p-2.5 border border-slate-300 rounded text-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOrderId(null)}
                className="px-4 py-2 text-slate-600 hover:text-black cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={handleConfirmCustomerCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded cursor-pointer disabled:opacity-40"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
