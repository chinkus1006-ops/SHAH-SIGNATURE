import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ServiceType } from '../types';
import {
  Sparkles,
  ArrowRight,
  Plus,
  Check,
  Clock,
  ShieldCheck,
  Flame,
  Shirt,
  Waves,
  Crown,
  AlertCircle,
} from 'lucide-react';

const SERVICE_IMAGES: Record<string, string> = {
  ironing_steam: '/src/assets/images/signature_steam_ironing_1794169587088.jpg',
  ironing_normal: '/src/assets/images/signature_deluxe_packaging_1794169587899.jpg',
  laundry: '/src/assets/images/signature_hero_concierge_1794169586410.jpg',
  dry_cleaning: '/src/assets/images/signature_dryclean_craft_1794169588382.jpg',
};

const getServiceIcon = (id: string) => {
  if (id === 'ironing_steam') return <Flame className="w-5 h-5 text-[#D4AF37]" />;
  if (id === 'ironing_normal') return <Shirt className="w-5 h-5 text-[#D4AF37]" />;
  if (id === 'laundry') return <Waves className="w-5 h-5 text-[#D4AF37]" />;
  return <Crown className="w-5 h-5 text-[#D4AF37]" />;
};

export const ServicesShowcase: React.FC = () => {
  const {
    t,
    language,
    garments,
    serviceCategories,
    selectedLocationPin,
    isLocationServiceable,
    setSelectedCategory,
    setIsBookingOpen,
    addToCart,
    cart,
  } = useApp();

  const activeCategories = serviceCategories
    .filter(c => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const [activeTab, setActiveTab] = useState<ServiceType>(
    activeCategories[0]?.id || 'ironing_steam'
  );

  const currentCat =
    activeCategories.find(c => c.id === activeTab) || activeCategories[0];
  const currentKey = currentCat?.id || activeTab;

  const itemsInCurrentCategory = garments.filter(
    g => g.category === currentKey && g.isActive !== false
  );
  const lowestPrice =
    itemsInCurrentCategory.length > 0
      ? Math.min(...itemsInCurrentCategory.map(i => i.price))
      : 15;

  const availability = isLocationServiceable(selectedLocationPin, currentKey);

  const handleBookService = (category: ServiceType) => {
    setSelectedCategory(category);
    setIsBookingOpen(true);
  };

  return (
    <section id="services" className="py-20 bg-white text-slate-900 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#C5A059] tracking-widest uppercase mb-3">
            <span>SHAH SIGNATURE Concierge Menu</span>
            <span aria-hidden="true">·</span>
            <span>Selected PIN: {selectedLocationPin}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0B132B] font-brand text-balance">
            {t.servicesTitle}
          </h2>
          <p className="mt-3 text-slate-600 text-base leading-relaxed">
            {t.servicesSubhead}
          </p>
        </div>

        {/* Live Availability Strip for selected PIN */}
        <div className="max-w-3xl mx-auto mb-8">
          {availability.serviceable ? (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>{availability.eligiblePartners.length} approved partner(s)</strong> active in PIN{' '}
                <strong>{selectedLocationPin}</strong> ({availability.area?.areaName}, {availability.area?.city}) for this service.
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{availability.reason}</span>
            </div>
          )}
        </div>

        {/* Scalable Service Category Tabs */}
        <div className="flex items-center justify-center mb-10 overflow-x-auto pb-2">
          <div className="flex items-center gap-1.5 p-1.5 bg-[#F4F5F8] rounded-lg border border-slate-200 shadow-inner">
            {activeCategories.map(cat => {
              const isActive = currentKey === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#0B132B] text-white shadow-md'
                      : 'text-slate-700 hover:text-black hover:bg-white/60'
                  }`}
                >
                  {getServiceIcon(cat.id)}
                  <span>{language === 'en' ? cat.nameEn : cat.nameHi}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Category Feature Spotlight & Live Items Grid */}
        {currentCat && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 bg-[#0B132B] text-white rounded-lg overflow-hidden border border-[#D4AF37]/30 shadow-xl flex flex-col justify-between">
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={
                    SERVICE_IMAGES[currentCat.id] ||
                    '/src/assets/images/signature_hero_concierge_1794169586410.jpg'
                  }
                  alt={currentCat.nameEn}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B132B] via-transparent to-transparent opacity-80" />

                <div className="absolute top-3 left-3 text-[11px] font-medium text-[#F3E5AB] tracking-wide uppercase">
                  Turnaround: {currentCat.turnaroundHours}h · Express: {currentCat.expressHours}h
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Pickup ETA ~45 mins in active PINs</span>
                  </span>
                  <span className="font-semibold text-[#F3E5AB]">From ₹{lowestPrice}/piece</span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <h3 className="text-2xl font-bold font-brand text-white">
                  {language === 'en' ? currentCat.nameEn : currentCat.nameHi}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {language === 'en' ? currentCat.descriptionEn : currentCat.descriptionHi}
                </p>

                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>Pre-pickup garment count, stain notes & photo protection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>4-digit pickup/delivery OTP & direct payment to verified partner</span>
                  </div>
                </div>

                <button
                  onClick={() => handleBookService(currentCat.id)}
                  className="w-full mt-2 py-3 bg-[#D4AF37] hover:bg-[#C5A059] text-[#060B18] font-bold text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Book {currentCat.nameEn} Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200">
                <span className="font-semibold text-slate-700 uppercase tracking-wider">
                  Garments & Transparent Pricing ({itemsInCurrentCategory.length} items)
                </span>
                <span>Dynamic Admin Catalog</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {itemsInCurrentCategory.map(item => {
                  const cartEntry = cart.find(c => c.item.id === item.id);
                  const quantityInCart = cartEntry?.quantity || 0;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-slate-200 bg-[#FBFBFC] hover:border-[#D4AF37]/50 hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-slate-900 text-sm">
                            {language === 'en' ? item.nameEn : item.nameHi}
                          </h4>
                          <div className="text-base font-bold text-[#0B132B] tabular-nums whitespace-nowrap">
                            ₹{item.price}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                          {language === 'en' ? item.descriptionEn : item.descriptionHi}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {item.category === 'laundry' && item.id.includes('fold')
                            ? 'Per 1 KG'
                            : 'Per Piece'}
                        </span>

                        {quantityInCart > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#0B132B] bg-[#D4AF37]/20 px-2.5 py-1 rounded">
                              {quantityInCart} added
                            </span>
                            <button
                              onClick={() => addToCart(item, 1)}
                              className="p-1.5 rounded bg-[#0B132B] text-white hover:bg-black transition-colors cursor-pointer"
                              title="Add another"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item, 1)}
                            className="px-3 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>Add to Order</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-lg bg-[#FAF7F0] border border-[#D4AF37]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>
                    <strong>Custom garment or bulk requirement?</strong> Add notes during checkout or call concierge.
                  </span>
                </div>
                <button
                  onClick={() => setIsBookingOpen(true)}
                  className="font-bold text-[#0B132B] hover:text-[#AA7C11] underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Proceed to Checkout ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

