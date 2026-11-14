import React from 'react';
import { useApp } from '../context/AppContext';
import { X, ShieldCheck, FileText, RefreshCw, Handshake, Mail } from 'lucide-react';

export const LegalModal: React.FC = () => {
  const { 
    activeLegalModal, 
    setActiveLegalModal, 
    legalPolicies,
    businessSettings 
  } = useApp();

  if (!activeLegalModal) return null;

  const tabs: { key: 'privacy' | 'terms' | 'refund' | 'partner'; label: string; icon: React.ReactNode }[] = [
    { key: 'privacy', label: 'Privacy Policy', icon: <ShieldCheck className="w-4 h-4" /> },
    { key: 'terms', label: 'Terms & Conditions', icon: <FileText className="w-4 h-4" /> },
    { key: 'refund', label: 'Cancellation & Refund', icon: <RefreshCw className="w-4 h-4" /> },
    { key: 'partner', label: 'Partner Agreement', icon: <Handshake className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-[#0B132B] px-6 py-5 text-white flex items-center justify-between border-b border-[#D4AF37]/30">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
              <span>SHAH SIGNATURE Legal & Compliance</span>
              <span aria-hidden="true">·</span>
              <span>Delhi PIN 110086</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-brand text-white mt-1">
              Policies & Legal Terms
            </h2>
          </div>

          <button
            onClick={() => setActiveLegalModal(null)}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close legal modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 py-2.5 bg-[#F8F9FB] border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveLegalModal(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeLegalModal === tab.key
                  ? 'bg-[#0B132B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-black hover:bg-slate-200'
              }`}
            >
              <span className={activeLegalModal === tab.key ? 'text-[#D4AF37]' : 'text-slate-400'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs text-slate-700 leading-relaxed">
          
          {activeLegalModal === 'privacy' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold font-brand text-slate-900">Privacy Policy & Data Protection</h3>
              <p className="whitespace-pre-line text-slate-700">{legalPolicies.privacyPolicy}</p>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900">Customer Consent & Purpose of Collection:</h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li><strong>Mobile Number:</strong> Used strictly for SMS/WhatsApp pickup dispatch updates, valet driver identification, and OTP verification.</li>
                  <li><strong>Doorstep Address:</strong> Used solely to dispatch vetted valet specialists to your specific location in Delhi PIN 110086.</li>
                  <li><strong>Strict Isolation:</strong> No customer can view another customer's orders, addresses, or phone numbers.</li>
                </ul>
              </div>
            </div>
          )}

          {activeLegalModal === 'terms' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold font-brand text-slate-900">Terms of Valet Garment Service</h3>
              <p className="whitespace-pre-line text-slate-700">{legalPolicies.termsAndConditions}</p>
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-slate-600">
                <div>· Operating in Delhi PIN 110086 (Sultanpuri, Nangloi Rd, Rohini Ext).</div>
                <div>· Garment count is verified at doorstep pickup.</div>
                <div>· White-glove European steam iron calibration used on all fabrics.</div>
              </div>
            </div>
          )}

          {activeLegalModal === 'refund' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold font-brand text-slate-900">Cancellation & Refund Policy</h3>
              <p className="whitespace-pre-line text-slate-700">{legalPolicies.cancellationRefundPolicy}</p>
              
              <div className="p-4 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 space-y-1">
                <span className="font-bold">100% Satisfaction Re-Press Guarantee:</span> If you are not completely satisfied with collar crispness or crease finishing, we collect and re-press free of charge within 24 hours.
              </div>
            </div>
          )}

          {activeLegalModal === 'partner' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold font-brand text-slate-900">Service Partner Marketplace Agreement</h3>
              <p className="whitespace-pre-line text-slate-700">{legalPolicies.partnerAgreement}</p>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-slate-600">
                <div>· All partners must be verified and approved by SHAH SIGNATURE Admin before order dispatch.</div>
                <div>· Orders are claimed on a first-valid-acceptance basis with atomic locking.</div>
                <div>· Partners maintain confidentiality of customer contact details.</div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-500 text-[11px]">
            <span>Policies last updated: {legalPolicies.lastUpdated} · Owner: {businessSettings.businessOwnerName}</span>
            <span>Inquiries: {businessSettings.businessEmail}</span>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => setActiveLegalModal(null)}
            className="px-5 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-semibold rounded cursor-pointer transition-colors"
          >
            I Understand & Close
          </button>
        </div>

      </div>
    </div>
  );
};
