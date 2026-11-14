import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Search,
  Star,
  Crosshair,
  AlertCircle,
} from 'lucide-react';
import heroConciergeImg from '../assets/images/signature_hero_concierge_1794169586410.jpg';

export const Hero: React.FC = () => {
  const {
    t,
    setIsBookingOpen,
    serviceAreas,
    partners,
    orders,
    reviews,
    setIsContactModalOpen,
    businessSettings,
    selectedLocationPin,
    setSelectedLocationPin,
    isLocationServiceable,
  } = useApp();

  const [pincodeQuery, setPincodeQuery] = useState(selectedLocationPin || '110086');
  const [geoStatus, setGeoStatus] = useState('');
  const [pincodeResult, setPincodeResult] = useState<{
    status: 'idle' | 'available' | 'no_partners' | 'expanding';
    areaName?: string;
    partnerCount?: number;
    reason?: string;
  }>({ status: 'idle' });

  const checkPinCoverage = (pin: string) => {
    const cleanPin = pin.trim();
    if (!cleanPin) return;
    setSelectedLocationPin(cleanPin);

    const check = isLocationServiceable(cleanPin);
    if (check.serviceable && check.area) {
      setPincodeResult({
        status: 'available',
        areaName: `${check.area.areaName}, ${check.area.city}, ${check.area.state}`,
        partnerCount: check.eligiblePartners.length,
      });
    } else if (check.area) {
      setPincodeResult({
        status: 'no_partners',
        areaName: `${check.area.areaName}, ${check.area.city}`,
        reason: check.reason,
      });
    } else {
      setPincodeResult({
        status: 'expanding',
        reason: check.reason,
      });
    }
  };

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    checkPinCoverage(pincodeQuery);
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGeoStatus('GPS geolocation is not supported by this browser. Enter your 6-digit PIN manually.');
      return;
    }
    setGeoStatus('Detecting nearest active SHAH SIGNATURE hub...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const activeAreas = serviceAreas.filter(a => a.isActive && a.coordinates);
        if (activeAreas.length === 0) {
          setGeoStatus('No geocoded PIN areas active yet.');
          return;
        }
        let nearest = activeAreas[0];
        let bestDist = Infinity;
        for (const area of activeAreas) {
          if (!area.coordinates) continue;
          const d = Math.hypot(latitude - area.coordinates.lat, longitude - area.coordinates.lng);
          if (d < bestDist) {
            bestDist = d;
            nearest = area;
          }
        }
        setPincodeQuery(nearest.pincode);
        setGeoStatus(`Matched nearest coverage hub: ${nearest.areaName}, ${nearest.city} (${nearest.pincode})`);
        checkPinCoverage(nearest.pincode);
      },
      err => {
        setGeoStatus(`Location access unavailable (${err.message}). Enter PIN code manually.`);
      },
      { timeout: 6000 }
    );
  };

  // Real computed platform metrics (no hardcoded fake claims)
  const activeAreasCount = serviceAreas.filter(a => a.isActive).length;
  const approvedOnlinePartners = partners.filter(
    p => p.status === 'active' && p.kycVerified !== false && p.isOnline && !p.commissionBlocked
  ).length;
  const deliveredOrdersCount = orders.filter(
    o => o.status === 'DELIVERED' || o.status === 'completed' || o.status === 'delivered'
  ).length;
  const avgVerifiedRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <section className="relative bg-[#0B132B] text-white overflow-hidden pt-8 pb-16 lg:py-20 border-b border-[#D4AF37]/20">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#1C2541]/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
              <span className="text-[#D4AF37]">{businessSettings.brandName || 'SHAH SIGNATURE'}</span>
              <span aria-hidden="true">·</span>
              <span>{businessSettings.tagline || 'ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST.'}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] font-brand max-w-2xl text-balance">
              {businessSettings.heroTitle || 'Impeccable Garment Care,'}{' '}
              <span className="gold-gradient-text">Concierge Delivered.</span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl font-normal">
              {businessSettings.heroSubtitle || t.heroSubhead}
            </p>

            {/* Pan-India PIN Code & GPS Service Availability Checker */}
            <div className="p-4 sm:p-5 rounded-lg bg-[#060B18]/85 border border-[#D4AF37]/30 max-w-xl shadow-lg space-y-2.5">
              <div className="text-xs font-semibold tracking-wider text-[#F3E5AB] uppercase flex items-center justify-between gap-2">
                <span>Check Pan-India Service & Partner Availability</span>
                <button
                  type="button"
                  onClick={handleDetectGps}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4AF37] hover:text-white cursor-pointer normal-case"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Use GPS</span>
                </button>
              </div>

              <form onSubmit={handlePincodeCheck} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]" />
                  <input
                    type="text"
                    maxLength={6}
                    value={pincodeQuery}
                    onChange={e => {
                      setPincodeQuery(e.target.value.replace(/\D/g, ''));
                      if (pincodeResult.status !== 'idle') setPincodeResult({ status: 'idle' });
                    }}
                    placeholder="Enter 6-digit Indian PIN (e.g. 110086)"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B132B] border border-slate-700 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#C5A059] text-[#060B18] font-semibold text-xs sm:text-sm rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-4 h-4" />
                  <span>Check Availability</span>
                </button>
              </form>

              {geoStatus && <div className="text-[11px] text-slate-300">{geoStatus}</div>}

              {pincodeResult.status === 'available' && (
                <div className="mt-2 flex items-start gap-2 text-xs text-emerald-300 bg-emerald-950/50 p-2.5 rounded border border-emerald-800/60">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Service Available:</span>{' '}
                    {pincodeResult.areaName}. {pincodeResult.partnerCount} KYC-approved partner(s) online for dispatch.
                  </div>
                </div>
              )}

              {pincodeResult.status === 'no_partners' && (
                <div className="mt-2 flex items-start gap-2 text-xs text-amber-300 bg-amber-950/50 p-2.5 rounded border border-amber-800/60">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Temporarily Paused in {pincodeResult.areaName}:</span>{' '}
                    {pincodeResult.reason}
                  </div>
                </div>
              )}

              {pincodeResult.status === 'expanding' && (
                <div className="mt-2 flex items-start gap-2 text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded border border-amber-800/50">
                  <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Not Active Yet:</span>{' '}
                    {pincodeResult.reason || 'Services show only in PIN codes where approved partners are onboarded.'}
                  </div>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => setIsBookingOpen(true)}
                className="px-7 py-3.5 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t.bookNow}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button
                onClick={() => setIsContactModalOpen(true)}
                className="px-5 py-3.5 bg-[#060B18] border border-[#D4AF37]/40 text-[#F3E5AB] hover:text-white hover:border-[#D4AF37] font-medium text-xs sm:text-sm rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Concierge Desk ({businessSettings.businessOwnerName})</span>
              </button>

              <a
                href="#services"
                className="px-5 py-3.5 text-slate-300 hover:text-white font-medium text-xs sm:text-sm transition-colors flex items-center justify-center"
              >
                {t.exploreServices}
              </a>
            </div>

            {/* Live Database-Driven Platform Telemetry Bar (Zero fabricated metrics) */}
            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-left max-w-xl">
              <div>
                <div className="flex items-center gap-1 text-[#D4AF37] font-semibold text-base tabular-nums">
                  <Star className="w-4 h-4 fill-current" />
                  <span>{avgVerifiedRating ? `${avgVerifiedRating} / 5.0` : `${approvedOnlinePartners} Online`}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {avgVerifiedRating ? `${reviews.length} Verified Reviews` : 'KYC Partners Ready'}
                </div>
              </div>
              <div>
                <div className="text-white font-semibold text-base tabular-nums">
                  {activeAreasCount} {activeAreasCount === 1 ? 'Zone' : 'Zones'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Active PIN Coverage</div>
              </div>
              <div>
                <div className="text-white font-semibold text-base tabular-nums">
                  {deliveredOrdersCount > 0 ? `${deliveredOrdersCount} Completed` : '4–12 Hours'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {deliveredOrdersCount > 0 ? 'Delivered Batches' : 'Express & Std ETA'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-lg overflow-hidden border border-[#D4AF37]/30 shadow-2xl bg-[#060B18]">
              <img
                src={heroConciergeImg}
                alt="SHAH SIGNATURE Bespoke Garment Care Wardrobe"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover aspect-[4/3] lg:aspect-[3/4] hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-4 left-4 right-4 p-3.5 bg-[#060B18]/90 backdrop-blur-md rounded border border-[#D4AF37]/40 text-xs">
                <div className="flex items-center justify-between text-[#F3E5AB] font-semibold mb-1">
                  <span>Garment Protection & OTP Handover</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5" /> KYC Verified Hubs
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Every pickup includes garment tagging, condition sign-off, 4-digit handover OTP, and direct partner settlement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

