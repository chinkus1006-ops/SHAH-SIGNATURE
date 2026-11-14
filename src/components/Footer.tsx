import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, 
  MapPin, 
  PhoneCall, 
  MessageCircle, 
  Mail,
  Clock, 
  ShieldCheck, 
  Globe,
  User
} from 'lucide-react';

import { BrandLogo } from './BrandLogo';

export const Footer: React.FC = () => {
  const { 
    language, 
    setLanguage, 
    setRole, 
    businessSettings,
    serviceAreas,
    setIsContactModalOpen,
    setActiveLegalModal 
  } = useApp();

  const cleanWhatsApp = (businessSettings?.whatsappSupportNumber || '+919899229102').replace(/[^0-9]/g, '') || '919899229102';
  const rawTel = (businessSettings?.businessPhone || '9899229102').replace(/[^0-9+]/g, '') || '+919899229102';
  const activeCities = Array.from(new Set(serviceAreas.filter(a => a.isActive).map(a => a.city))).join(', ') || 'Delhi';

  return (
    <footer className="bg-[#060B18] text-white border-t border-[#D4AF37]/20 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
          
          {/* Brand & Purpose */}
          <div className="lg:col-span-2 space-y-4">
            <a href="#" className="hover:opacity-95 transition-opacity inline-block">
              <BrandLogo size="md" showTagline={true} />
            </a>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-sm">
              India’s on-demand luxury garment care & artisan valet marketplace. Verified local partners, transparent direct-to-partner pricing, and high-pressure vacuum steam finishing.
            </p>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-[#F3E5AB]">
                <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Primary HQ: PIN 110086, Delhi · Active Cities: {activeCities}</span>
              </div>
              <div className="text-slate-400 pl-5 text-[11px]">
                {businessSettings.businessAddress}
              </div>
              <div className="flex items-center gap-2 text-slate-300 pl-5 pt-0.5">
                <User className="w-3 h-3 text-[#D4AF37]" />
                <span>Business Owner: <strong>{businessSettings.businessOwnerName}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Concierge Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F3E5AB]">
              Garment Collections
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><a href="#services" className="hover:text-[#D4AF37] transition-colors">Normal Everyday Ironing</a></li>
              <li><a href="#services" className="hover:text-[#D4AF37] transition-colors">Artisan Steam Ironing</a></li>
              <li><a href="#services" className="hover:text-[#D4AF37] transition-colors">Boutique Wash & Fold</a></li>
              <li><a href="#services" className="hover:text-[#D4AF37] transition-colors">Suits & Lehenga Dry Clean</a></li>
              <li><a href="#services" className="hover:text-[#D4AF37] transition-colors">Linen & Heavy Bedding</a></li>
            </ul>
          </div>

          {/* Privacy & Legal Policies */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F3E5AB]">
              Policies & Compliance
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <button 
                  onClick={() => setActiveLegalModal('privacy')} 
                  className="hover:text-[#D4AF37] transition-colors text-left cursor-pointer"
                >
                  Privacy Policy & Data Consent
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveLegalModal('terms')} 
                  className="hover:text-[#D4AF37] transition-colors text-left cursor-pointer"
                >
                  Terms & Service Conditions
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveLegalModal('refund')} 
                  className="hover:text-[#D4AF37] transition-colors text-left cursor-pointer"
                >
                  Cancellation & Refund Policy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveLegalModal('partner')} 
                  className="hover:text-[#D4AF37] transition-colors text-left cursor-pointer"
                >
                  Partner Marketplace Agreement
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setIsContactModalOpen(true)} 
                  className="hover:text-[#D4AF37] transition-colors text-left font-semibold text-[#F3E5AB] cursor-pointer"
                >
                  Contact & Grievance Desk
                </button>
              </li>
            </ul>
          </div>

          {/* Verified Contact Details & Clickable Actions */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F3E5AB]">
              Direct Contact Desk
            </h4>
            
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{businessSettings.supportHours}</span>
              </div>

              {/* Clickable Phone Number */}
              <a 
                href={`tel:${rawTel}`}
                className="flex items-center gap-2 text-white hover:text-[#D4AF37] transition-colors font-mono font-medium"
                title="Call Phone Helpline"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{businessSettings.businessPhone}</span>
              </a>

              {/* Clickable Email Address */}
              <a 
                href={`mailto:${businessSettings.businessEmail}`}
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors truncate"
                title="Send Email"
              >
                <Mail className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span className="truncate">{businessSettings.businessEmail}</span>
              </a>
            </div>

            {/* Clickable WhatsApp Button with +91 Country Code */}
            <div className="pt-2">
              <a
                href={`https://wa.me/${cleanWhatsApp}?text=Hello%20${encodeURIComponent(businessSettings.businessOwnerName || 'Ronak')},%20I%20would%20like%20to%20inquire%20about%20SHAH%20SIGNATURE%20luxury%20garment%20care%20services%20in%20Delhi%20PIN%20110086.`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded transition-colors shadow-sm cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp: +{cleanWhatsApp}</span>
              </a>
            </div>

            {/* Language Switch */}
            <div className="pt-2">
              <button
                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Language: {language === 'en' ? 'English (Switch to हिन्दी)' : 'हिन्दी (Switch to English)'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar strictly obeying Anti-slop clean text rule */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © 2026 SHAH SIGNATURE. ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST. Managed by {businessSettings.businessOwnerName}. All rights reserved. PIN Code 110086, Delhi, India.
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button onClick={() => setRole('customer')} className="hover:text-white cursor-pointer">
              Customer View
            </button>
            <span>·</span>
            <button onClick={() => setRole('partner')} className="hover:text-white cursor-pointer">
              Partner Hub Console
            </button>
            <span>·</span>
            <button onClick={() => setRole('admin')} className="hover:text-white cursor-pointer">
              Super Admin Deck
            </button>
            <span>·</span>
            <button onClick={() => setIsContactModalOpen(true)} className="hover:text-white cursor-pointer">
              Contact Desk
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
