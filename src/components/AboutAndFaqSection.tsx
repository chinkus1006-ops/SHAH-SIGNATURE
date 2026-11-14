import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HelpCircle, ShieldCheck, ChevronDown, ChevronUp, Info } from 'lucide-react';

export const AboutAndFaqSection: React.FC = () => {
  const { businessSettings, faqs, language, settings, setActiveLegalModal } = useApp();
  const [openFaqId, setOpenFaqId] = useState<string | null>(faqs[0]?.id || null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const activeFaqs = faqs.filter(
    f => f.isActive && (categoryFilter === 'all' || f.category === categoryFilter)
  );

  return (
    <section id="about-faq" className="py-16 bg-[#F8F9FB] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* About Us & Garment Protection Policy Summary */}
        <div className="lg:col-span-5 space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#AA7C11] uppercase tracking-widest">
            <Info className="w-4 h-4" />
            <span>About {businessSettings.brandName}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-brand text-[#0B132B]">
            {businessSettings.tagline}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {businessSettings.aboutUsText ||
              'Founded by Ronak in Delhi PIN 110086, SHAH SIGNATURE delivers vetted doorstep ironing, organic laundry, and dry cleaning with transparent pricing and pan-India readiness.'}
          </p>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 text-xs">
            <div className="font-bold text-[#0B132B] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>Garment Protection & Cancellation Policy</span>
            </div>
            <ul className="space-y-1.5 text-slate-600">
              <li>· Photo count, stain inspection & 4-digit OTP required at every doorstep handover.</li>
              <li>· Free self-cancellation before pickup within {settings.freeCancellationMinutes || 30} mins.</li>
              <li>· Two-sided dispute desk with photo evidence and owner audit review.</li>
            </ul>
            <button
              type="button"
              onClick={() => setActiveLegalModal('refund')}
              className="text-xs font-bold text-[#0B132B] underline underline-offset-4 cursor-pointer"
            >
              Read Full Policies & Terms
            </button>
          </div>
        </div>

        {/* Dynamic FAQs */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xl font-bold font-brand text-[#0B132B] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#D4AF37]" />
              <span>Frequently Asked Questions</span>
            </h3>
            <div className="flex flex-wrap gap-1 text-[11px]">
              {['all', 'booking', 'garment_care', 'payments', 'partners'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded font-semibold capitalize cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#0B132B] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {activeFaqs.map(faq => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full px-5 py-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-[#0B132B] cursor-pointer hover:bg-slate-50"
                  >
                    <span>{language === 'en' ? faq.questionEn : faq.questionHi}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {language === 'en' ? faq.answerEn : faq.answerHi}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
