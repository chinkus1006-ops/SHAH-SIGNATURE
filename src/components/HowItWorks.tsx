import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Smartphone, 
  Radio, 
  Sparkles, 
  PackageCheck, 
  ArrowRight,
  ShieldAlert,
  Zap
} from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const { t, setIsBookingOpen } = useApp();

  const steps = [
    {
      num: '01',
      icon: <Smartphone className="w-6 h-6 text-[#D4AF37]" />,
      title: 'Select Garments & Mode',
      desc: 'Pick your items, choose Home Valet Pickup & Delivery or Self-Drop at our Sultanpuri hub, and pick a convenient time slot.',
    },
    {
      num: '02',
      icon: <Radio className="w-6 h-6 text-[#D4AF37]" />,
      title: 'Instant Rapido-Style Radar',
      desc: 'Our dispatch algorithm broadcasts to verified active partners in PIN 110086. The first available master specialist accepts immediately.',
    },
    {
      num: '03',
      icon: <Sparkles className="w-6 h-6 text-[#D4AF37]" />,
      title: 'Artisan Steam & Care',
      desc: 'Fabrics are inspected, sanitized, and finished on industrial vacuum boards without sheen marks or burn risks.',
    },
    {
      num: '04',
      icon: <PackageCheck className="w-6 h-6 text-[#D4AF37]" />,
      title: 'Delivered in Sealed Wardrobe Bags',
      desc: 'Delivered to your doorstep on custom hangers or boutique fold. Track every movement in real time on our portal.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-[#060B18] text-white border-b border-[#D4AF37]/20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase mb-3">
            <span>On-Demand Dispatch Architecture</span>
            <span aria-hidden="true">·</span>
            <span>Speed Meets Craft</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-brand tracking-tight text-white text-balance">
            How SHAH SIGNATURE Works
          </h2>
          <p className="mt-3 text-slate-300 text-base leading-relaxed">
            Combining the rapid responsiveness of instant mobility apps with the exacting quality of a Savile Row valet service.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <div 
              key={step.num}
              className="p-6 rounded-lg bg-[#0B132B]/80 border border-[#D4AF37]/30 hover:border-[#D4AF37] transition-all flex flex-col justify-between relative group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-[#060B18] rounded-md border border-[#D4AF37]/40">
                    {step.icon}
                  </div>
                  <span className="font-serif text-2xl font-bold text-[#F3E5AB]/40 group-hover:text-[#D4AF37] transition-colors">
                    {step.num}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 font-brand">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {step.desc}
                </p>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-20 text-[#D4AF37]/40">
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Smart Assignment Architecture Highlight Callout */}
        <div className="mt-14 p-6 rounded-lg bg-[#0B132B] border border-[#D4AF37]/30 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#D4AF37]/10 rounded-md text-[#D4AF37] shrink-0 mt-1">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#F3E5AB] font-brand">
                Smart Concurrency-Locked Partner Assignment
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                When an order is placed in PIN 110086, it broadcasts simultaneously to online nearby partners. Concurrency locks ensure that the moment one partner accepts, it is exclusively reserved—preventing double assignments. If unassigned within 45 seconds, our system auto-escalates to senior partner hubs or admin desk.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsBookingOpen(true)}
            className="px-6 py-3 bg-[#D4AF37] hover:bg-[#C5A059] text-[#060B18] font-bold text-xs sm:text-sm rounded-md transition-all whitespace-nowrap shadow-md cursor-pointer shrink-0"
          >
            Experience It Now
          </button>
        </div>

      </div>
    </section>
  );
};
