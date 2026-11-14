import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, 
  ShoppingBag, 
  User, 
  MapPin, 
  Globe, 
  ShieldCheck, 
  Bike, 
  Menu, 
  X,
  PhoneCall,
  MessageCircle,
  FileText
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { UserRole } from '../types';

export const Navbar: React.FC = () => {
  const { 
    t, 
    language, 
    setLanguage, 
    role, 
    setRole, 
    setIsBookingOpen, 
    cart, 
    customerOrders, 
    setActiveTrackingOrderId,
    businessSettings,
    setIsContactModalOpen,
    setActiveLegalModal,
    openAuthModal,
    logout,
    authSession,
    selectedLocationPin,
    serviceAreas,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const activeOrdersCount = authSession?.isAuthenticated
    ? customerOrders.filter(
        o => o.status !== 'completed' && o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'CANCELLED' && o.status !== 'DELIVERED'
      ).length
    : 0;

  const currentArea = serviceAreas.find(a => a.pincode === selectedLocationPin);
  const activeHubsCount = serviceAreas.filter(a => a.isActive).length;

  const cleanWhatsApp = businessSettings.whatsappSupportNumber.replace(/[^0-9]/g, '') || '919899229102';
  const cleanPhone = businessSettings.businessPhone.replace(/[^0-9+]/g, '') || '+919899229102';

  return (
    <>
      {/* Top micro announcement bar */}
      <div className="bg-[#060B18] text-[#F3E5AB] text-xs py-1.5 px-4 border-b border-[#D4AF37]/20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs tracking-wide">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>
                {currentArea
                  ? `${currentArea.city} PIN ${currentArea.pincode} · ${currentArea.areaName}`
                  : `PIN ${selectedLocationPin} · Pan-India Marketplace`}{' '}
                ({activeHubsCount} Active Zones)
              </span>
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline text-slate-300">
              Free Doorstep Valet on Orders above ₹299
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {/* Clickable WhatsApp Concierge Link */}
            <a 
              href={`https://wa.me/${cleanWhatsApp}?text=Hello%20${encodeURIComponent(businessSettings.businessOwnerName || 'Ronak')},%20I%20would%20like%20to%20inquire%20about%20SHAH%20SIGNATURE%20luxury%20garment%20care%20in%20Delhi%20PIN%20110086.`}
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[#F3E5AB] hover:text-[#D4AF37] transition-colors font-medium"
              title="Chat on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp: +{cleanWhatsApp}</span>
            </a>

            <span className="text-slate-600">|</span>

            {/* Clickable Phone helpline */}
            <a
              href={`tel:${cleanPhone}`}
              className="hidden sm:flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
              title="Call Helpline"
            >
              <PhoneCall className="w-3 h-3 text-[#D4AF37]" />
              <span>{businessSettings.businessPhone}</span>
            </a>

            <span className="text-slate-600 hidden sm:inline">|</span>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                {language === 'en' ? 'हिन्दी' : 'English'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Top Bar strictly obeying Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#D4AF37]/20 text-white transition-all shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          
          {/* Zone 1: Authentic SHAH SIGNATURE Brand Crest & Wordmark */}
          <a href="#" className="hover:opacity-95 transition-opacity">
            <BrandLogo size="md" showTagline={true} />
          </a>

          {/* Zone 2: 4-5 clean single-line nav links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-200">
            <a href="#services" className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0">
              {t.nav.services}
            </a>
            <a href="#how-it-works" className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0">
              {t.nav.howItWorks}
            </a>
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-200"
            >
              Contact Us
            </button>
            <a 
              href="#track" 
              onClick={() => {
                setRole('customer');
                if (authSession?.isAuthenticated && customerOrders.length > 0) {
                  setActiveTrackingOrderId(customerOrders[0].id);
                }
              }}
              className="flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
            >
              <span>{t.nav.trackOrder}</span>
              {activeOrdersCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" title={`${activeOrdersCount} active orders`} />
              )}
            </a>
            <button
              onClick={() => setActiveLegalModal('privacy')}
              className="text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Policies
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Quick Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Role Switcher Toolbar (Customer / Partner / Admin) */}
            <div className="hidden md:flex items-center p-1 bg-[#060B18] border border-[#D4AF37]/30 rounded-md text-xs font-medium">
              <button
                onClick={() => setRole('customer')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  role === 'customer' 
                    ? 'bg-[#D4AF37] text-[#060B18] font-bold shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Customer</span>
              </button>
              <button
                onClick={() => setRole('partner')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  role === 'partner' 
                    ? 'bg-[#D4AF37] text-[#060B18] font-bold shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Bike className="w-3 h-3" />
                <span>Partner</span>
              </button>
              <button
                onClick={() => setRole('admin')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  role === 'admin' 
                    ? 'bg-[#D4AF37] text-[#060B18] font-bold shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Admin</span>
              </button>
            </div>

            {/* Cart Trigger if items present */}
            {cartItemCount > 0 && (
              <button
                onClick={() => setIsBookingOpen(true)}
                className="relative p-2 text-[#F3E5AB] hover:text-white transition-colors cursor-pointer"
                title="View Selected Garments"
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-[#D4AF37] text-[#060B18] font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              </button>
            )}

            {/* Authentication Portal Trigger / Active Session */}
            {authSession?.isAuthenticated ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openAuthModal(role, 'login')}
                  className="px-3 py-2 text-xs font-semibold text-[#F3E5AB] bg-[#060B18] border border-[#D4AF37]/50 rounded-md hover:border-[#D4AF37] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title={`${authSession.userName || 'Account'} (${authSession.activeRole})`}
                >
                  <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="hidden sm:inline">{(authSession.userName || 'Account').split(' ')[0]}</span>
                </button>
                <button
                  onClick={logout}
                  className="px-2.5 py-2 text-xs font-semibold text-rose-200 bg-rose-950/60 border border-rose-800/60 rounded-md hover:bg-rose-900 transition-colors cursor-pointer whitespace-nowrap"
                  title="Sign Out"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Exit</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuthModal(role, 'login')}
                className="px-3.5 py-2 text-xs font-semibold text-[#F3E5AB] bg-[#060B18] border border-[#D4AF37]/50 rounded-md hover:border-[#D4AF37] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Sign In / Register (Customer, Partner, Admin)"
              >
                <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Primary Action Button */}
            <button
              onClick={() => {
                setRole('customer');
                setIsBookingOpen(true);
              }}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#0B132B] bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] rounded-md hover:brightness-105 active:scale-[0.98] transition-all whitespace-nowrap shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-[#060B18]" />
              <span>{t.bookNow}</span>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-300 hover:text-white transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#060B18] border-b border-[#D4AF37]/30 px-6 py-4 space-y-4">
            <nav className="flex flex-col space-y-3 text-sm font-medium">
              <a 
                href="#services" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#D4AF37] transition-colors py-1"
              >
                {t.nav.services}
              </a>
              <a 
                href="#how-it-works" 
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#D4AF37] transition-colors py-1"
              >
                {t.nav.howItWorks}
              </a>
              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsContactModalOpen(true);
                }}
                className="text-left hover:text-[#D4AF37] transition-colors py-1 text-slate-200"
              >
                Contact Us (Ronak: {businessSettings.businessPhone})
              </button>
              <a 
                href="#track" 
                onClick={() => {
                  setRole('customer');
                  setMobileMenuOpen(false);
                }}
                className="hover:text-[#D4AF37] transition-colors py-1 flex items-center justify-between"
              >
                <span>{t.nav.trackOrder}</span>
                {activeOrdersCount > 0 && (
                  <span className="text-xs bg-[#D4AF37] text-[#060B18] px-2 py-0.5 rounded font-bold">
                    {activeOrdersCount} Active
                  </span>
                )}
              </a>
              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  setActiveLegalModal('privacy');
                }}
                className="text-left text-xs text-slate-400 hover:text-white py-1"
              >
                Privacy & Legal Policies
              </button>
            </nav>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Switch Portal:</span>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => { setRole('customer'); setMobileMenuOpen(false); }}
                  className={`px-2 py-1 rounded ${role === 'customer' ? 'bg-[#D4AF37] text-black font-bold' : 'text-slate-300'}`}
                >
                  Customer
                </button>
                <button
                  onClick={() => { setRole('partner'); setMobileMenuOpen(false); }}
                  className={`px-2 py-1 rounded ${role === 'partner' ? 'bg-[#D4AF37] text-black font-bold' : 'text-slate-300'}`}
                >
                  Partner
                </button>
                <button
                  onClick={() => { setRole('admin'); setMobileMenuOpen(false); }}
                  className={`px-2 py-1 rounded ${role === 'admin' ? 'bg-[#D4AF37] text-black font-bold' : 'text-slate-300'}`}
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
