import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Gift,
  Star,
  Crown,
  Copy,
  Check,
  Building2,
  Send,
  CheckCircle2,
  Award,
} from 'lucide-react';

export const RetentionHub: React.FC = () => {
  const {
    customerUser,
    subscriptionPlans,
    subscribeCustomerToPlan,
    reviews,
    submitBulkEnquiry,
    settings,
  } = useApp();

  const [copiedReferral, setCopiedReferral] = useState(false);

  // Corporate / Bulk enquiry state
  const [orgName, setOrgName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [bulkPhone, setBulkPhone] = useState('');
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkCity, setBulkCity] = useState('Delhi');
  const [bulkPin, setBulkPin] = useState('110086');
  const [monthlyGarments, setMonthlyGarments] = useState(250);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkSubmitted, setBulkSubmitted] = useState(false);

  const handleCopyReferral = () => {
    if (!customerUser.referralCode) return;
    navigator.clipboard?.writeText(customerUser.referralCode).catch(() => {});
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  const handleSubmitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !contactPerson.trim() || !bulkPhone.trim()) return;
    submitBulkEnquiry({
      organizationName: orgName.trim(),
      contactPerson: contactPerson.trim(),
      phone: bulkPhone.trim(),
      email: bulkEmail.trim(),
      city: bulkCity.trim(),
      pincode: bulkPin.trim(),
      estimatedMonthlyGarments: Number(monthlyGarments) || 100,
      serviceTypes: ['ironing_steam', 'laundry'],
      notes: bulkNotes.trim(),
    });
    setBulkSubmitted(true);
    setOrgName('');
    setContactPerson('');
    setBulkPhone('');
    setBulkEmail('');
    setBulkNotes('');
    setTimeout(() => setBulkSubmitted(false), 4000);
  };

  return (
    <section className="py-14 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Rewards, Referral & Subscription Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Rewards & Referral Card */}
          <div className="lg:col-span-5 bg-[#0B132B] text-white rounded-xl p-6 border border-[#D4AF37]/40 shadow-md flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] uppercase tracking-widest">
                <Gift className="w-4 h-4 text-[#D4AF37]" />
                <span>SHAH SIGNATURE Loyalty & Referrals</span>
              </div>
              <h3 className="text-2xl font-bold font-brand">
                {customerUser.rewardPoints || 0} Reward Points
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn {settings.rewardPointsPerHundredRupees || 5} points per ₹100 spent (1 pt = ₹
                {settings.rewardPointValueInInr || 1} discount at checkout). Invite friends using your code to earn{' '}
                {settings.referralBonusPoints || 50} bonus points.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#060B18] border border-[#D4AF37]/30 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Your Referral Code</div>
                <div className="font-mono font-bold text-[#F3E5AB] text-sm">
                  {customerUser.referralCode || 'SHAH-VIP'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyReferral}
                className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#C5A059] text-[#060B18] font-bold text-xs rounded flex items-center gap-1 cursor-pointer"
              >
                {copiedReferral ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReferral ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {customerUser.activeSubscription && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>Active Plan: {customerUser.activeSubscription.planName}</span>
                </div>
                <div className="text-slate-300 mt-0.5">
                  {customerUser.activeSubscription.garmentCreditsRemaining} garment credits remaining this cycle.
                </div>
              </div>
            )}
          </div>

          {/* Monthly Concierge Subscription Plans */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <h3 className="text-xl font-bold font-brand text-[#0B132B]">
                Monthly Care Subscriptions
              </h3>
              <p className="text-xs text-slate-500">
                Predictable monthly wardrobe care for households and professionals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subscriptionPlans
                .filter(p => p.isActive)
                .map(plan => {
                  const isCurrent = customerUser.activeSubscription?.planId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 ${
                        isCurrent
                          ? 'border-[#D4AF37] bg-[#FAF7F0] shadow-sm'
                          : 'border-slate-200 bg-[#FBFBFC]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#0B132B] text-base flex items-center gap-1.5">
                            <Crown className="w-4 h-4 text-[#D4AF37]" />
                            {plan.name}
                          </span>
                          <span className="font-mono font-bold text-lg text-[#0B132B]">
                            ₹{plan.monthlyPrice}/mo
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{plan.description}</p>
                        <ul className="text-[11px] text-slate-600 space-y-1 pt-1">
                          <li>· {plan.includedGarments} garments included monthly</li>
                          <li>· {plan.freeExpressDeliveries} free express turnarounds</li>
                          {plan.priorityDispatch && <li>· Priority partner dispatch queue</li>}
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => subscribeCustomerToPlan(plan.id)}
                        className={`w-full py-2 rounded font-bold text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB]'
                        }`}
                      >
                        {isCurrent ? 'Active Subscription' : 'Activate Monthly Plan'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Genuine Verified Customer Reviews + Corporate Bulk Enquiry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-200">
          {/* Verified Reviews Only (Zero fabricated testimonials) */}
          <div className="lg:col-span-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold font-brand text-[#0B132B] flex items-center gap-2">
                <Star className="w-5 h-5 text-[#D4AF37] fill-current" />
                <span>Verified Delivery Reviews ({reviews.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                100% genuine reviews submitted strictly by customers after verified doorstep delivery.
              </p>
            </div>

            {reviews.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">No verified customer reviews published yet.</div>
                <p>
                  Once a booking reaches <strong>DELIVERED</strong>, customers can rate their partner from the Customer Dashboard to appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {reviews.map(r => (
                  <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-[#FBFBFC] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B132B]">{r.customerName}</span>
                      <span className="text-[#D4AF37] font-bold">★ {r.rating}/5</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{r.comment}</p>
                    <div className="text-[10px] text-slate-400">
                      Verified Order {r.orderNumber} · Partner: {r.partnerName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bulk & Corporate Laundry Enquiry */}
          <div className="lg:col-span-6 bg-[#F8F9FB] rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold font-brand text-[#0B132B] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#D4AF37]" />
                <span>Bulk, Hotel & Corporate Garment Care Enquiry</span>
              </h3>
              <p className="text-xs text-slate-500">
                Pan-India recurring B2B contracts for hotels, clinics, uniforms, and event wardrobes.
              </p>
            </div>

            {bulkSubmitted ? (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Bulk enquiry logged! Ronak and our corporate desk will reach out shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitBulk} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Company / Hotel / Clinic Name *"
                    className="px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    placeholder="Contact Person Name *"
                    className="px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                  <input
                    type="tel"
                    required
                    value={bulkPhone}
                    onChange={e => setBulkPhone(e.target.value)}
                    placeholder="Mobile Number *"
                    className="px-3 py-2 bg-white border border-slate-300 rounded font-mono text-slate-900"
                  />
                  <input
                    type="email"
                    value={bulkEmail}
                    onChange={e => setBulkEmail(e.target.value)}
                    placeholder="Work Email"
                    className="px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                  <input
                    type="text"
                    value={bulkCity}
                    onChange={e => setBulkCity(e.target.value)}
                    placeholder="City"
                    className="px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                  <input
                    type="number"
                    min={50}
                    value={monthlyGarments}
                    onChange={e => setMonthlyGarments(Number(e.target.value))}
                    placeholder="Est. Garments/Month"
                    className="px-3 py-2 bg-white border border-slate-300 rounded font-mono text-slate-900"
                  />
                </div>
                <textarea
                  rows={2}
                  value={bulkNotes}
                  onChange={e => setBulkNotes(e.target.value)}
                  placeholder="Specify linen, uniforms, turnaround schedule, or PIN codes..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Submit Bulk Care Request</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
