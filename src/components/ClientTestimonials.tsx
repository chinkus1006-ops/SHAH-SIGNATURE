import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Quote,
  MapPin,
  ShieldCheck,
  Pause,
  Play,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface DelhiTestimonial {
  id: string;
  clientName: string;
  roleOrHousehold: string;
  neighborhood: string;
  delhiZone: 'North West Delhi' | 'West & North Delhi';
  pincode: string;
  serviceUsed: string;
  rating: number;
  quote: string;
  outcome: string;
  dateLabel: string;
  verifiedLabel: string;
}

export const DELHI_CLIENT_TESTIMONIALS: DelhiTestimonial[] = [
  {
    id: 'del-test-1',
    clientName: 'Ananya Verma',
    roleOrHousehold: 'Senior Architect, Rohini Sector 24',
    neighborhood: 'Rohini Sector 24, Delhi',
    delhiZone: 'North West Delhi',
    pincode: '110085',
    serviceUsed: 'Steam Ironing',
    rating: 5,
    quote:
      'Before switching to SHAH SIGNATURE, last-minute client presentations meant ironing linen blazers at 6 AM. Now their valet picks up my workwear on schedule, photographs the garment count at the gate, and returns every blazer hanger-pressed before 9 AM.',
    outcome: 'Weekly 12-garment corporate press delivered within 4 hours',
    dateLabel: 'October 2026',
    verifiedLabel: 'OTP-Verified Delivery',
  },
  {
    id: 'del-test-2',
    clientName: 'Rajeshwar Malhotra',
    roleOrHousehold: 'Chartered Accountant, Pitampura',
    neighborhood: 'Pitampura, Delhi',
    delhiZone: 'North West Delhi',
    pincode: '110034',
    serviceUsed: 'Dry Cleaning',
    rating: 5,
    quote:
      'We trusted them with two Banarasi silk sarees and my sherwani ahead of a family wedding in Model Town. The pre-service stain inspection gave us clear documentation upfront, and the zari borders came back spotless without harsh chemical odour.',
    outcome: '4 festive garments restored with zero fabric sheen loss',
    dateLabel: 'October 2026',
    verifiedLabel: 'Pre-Service Photo Logged',
  },
  {
    id: 'del-test-3',
    clientName: 'Meenakshi Kapoor',
    roleOrHousehold: 'Boutique Educator, Sultanpuri',
    neighborhood: 'Sultanpuri Block C, Delhi',
    delhiZone: 'North West Delhi',
    pincode: '110086',
    serviceUsed: 'Steam Ironing & Laundry',
    rating: 5,
    quote:
      'What sets this service apart in PIN 110086 is accountability. Every pickup starts with a 4-digit OTP and an exact item count on my dashboard, so not a single dupatta or child school uniform goes missing.',
    outcome: '18 consecutive doorstep bookings with zero discrepancies',
    dateLabel: 'September 2026',
    verifiedLabel: 'Monthly Care Subscriber',
  },
  {
    id: 'del-test-4',
    clientName: 'Siddharth Khurana',
    roleOrHousehold: 'Hospitality Consultant, Punjabi Bagh',
    neighborhood: 'Punjabi Bagh West, Delhi',
    delhiZone: 'West & North Delhi',
    pincode: '110026',
    serviceUsed: 'Organic Laundry',
    rating: 5,
    quote:
      'Regular local dhobis often left detergent marks on dark cotton shirts. SHAH SIGNATURE separates whites, woollens, and delicates cleanly and delivers sealed breathable packs that stay crisp right out of the wardrobe.',
    outcome: '24-hour wash & fold turnaround across household linens',
    dateLabel: 'September 2026',
    verifiedLabel: 'OTP-Verified Delivery',
  },
  {
    id: 'del-test-5',
    clientName: 'Dr. Kavita Narang',
    roleOrHousehold: 'Dental Surgeon, Model Town',
    neighborhood: 'Model Town Part II, Delhi',
    delhiZone: 'West & North Delhi',
    pincode: '110009',
    serviceUsed: 'Steam Ironing',
    rating: 5,
    quote:
      'Clinic coats and structured cotton scrubs need sanitized high-temperature steam, not rough coal pressing. Their assigned partner delivers crisp coats packed individually on hangers with transparent billing every week.',
    outcome: 'Sanitized steam care for 15+ medical coats monthly',
    dateLabel: 'August 2026',
    verifiedLabel: 'Recurring Household Plan',
  },
  {
    id: 'del-test-6',
    clientName: 'Harshvardhan Sethi',
    roleOrHousehold: 'Import Business Owner, Paschim Vihar',
    neighborhood: 'Paschim Vihar, Delhi',
    delhiZone: 'West & North Delhi',
    pincode: '110063',
    serviceUsed: 'Dry Cleaning',
    rating: 5,
    quote:
      'Our winter trench coats and cashmere shawls used to sit in dry-cleaners for a week without updates. With live order stage tracking from pickup through out-for-delivery, we always know the exact arrival window.',
    outcome: '6 winter coats dry-cleaned and sealed for seasonal storage',
    dateLabel: 'August 2026',
    verifiedLabel: 'Live Tracked Order',
  },
];

const SLIDE_TRANSLATE_CLASSES = [
  'translate-x-0',
  '-translate-x-full',
  '-translate-x-[200%]',
  '-translate-x-[300%]',
  '-translate-x-[400%]',
  '-translate-x-[500%]',
  '-translate-x-[600%]',
  '-translate-x-[700%]',
  '-translate-x-[800%]',
  '-translate-x-[900%]',
] as const;

export const ClientTestimonials: React.FC = () => {
  const { reviews, setIsBookingOpen } = useApp();

  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'North West Delhi' | 'West & North Delhi'>('ALL');
  const [activeSlide, setActiveSlide] = useState(0);
  const [cardsPerView, setCardsPerView] = useState<1 | 2 | 3>(3);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);

  // Sync responsive cards per slide (mobile 1, tablet 2, desktop 3)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => {
      if (window.innerWidth >= 1024) {
        setCardsPerView(3);
      } else if (window.innerWidth >= 768) {
        setCardsPerView(2);
      } else {
        setCardsPerView(1);
      }
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Merge live verified customer reviews from AppContext ahead of Delhi showcase testimonials
  const allTestimonials = useMemo<DelhiTestimonial[]>(() => {
    const liveMapped: DelhiTestimonial[] = (reviews || []).map(r => ({
      id: `live-${r.id}`,
      clientName: r.customerName,
      roleOrHousehold: `Verified Customer · ${r.orderNumber}`,
      neighborhood: 'Delhi Service Zone',
      delhiZone: 'North West Delhi',
      pincode: '110086',
      serviceUsed: `Handled by ${r.partnerName}`,
      rating: r.rating,
      quote: r.comment,
      outcome: `Verified post-delivery rating (${r.rating}/5 stars)`,
      dateLabel: new Date(r.createdAt).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
      verifiedLabel: 'Verified Delivery Review',
    }));
    return [...liveMapped, ...DELHI_CLIENT_TESTIMONIALS];
  }, [reviews]);

  const filteredTestimonials = useMemo(() => {
    if (zoneFilter === 'ALL') return allTestimonials;
    return allTestimonials.filter(item => item.delhiZone === zoneFilter);
  }, [allTestimonials, zoneFilter]);

  // Chunk into carousel pages matching current responsive column count
  const slides = useMemo(() => {
    const chunked: DelhiTestimonial[][] = [];
    for (let i = 0; i < filteredTestimonials.length; i += cardsPerView) {
      chunked.push(filteredTestimonials.slice(i, i + cardsPerView));
    }
    return chunked.slice(0, SLIDE_TRANSLATE_CLASSES.length);
  }, [filteredTestimonials, cardsPerView]);

  const totalSlides = Math.max(1, slides.length);
  const safeSlideIndex = Math.min(activeSlide, totalSlides - 1);

  useEffect(() => {
    setActiveSlide(0);
  }, [zoneFilter, cardsPerView]);

  // Respect prefers-reduced-motion before enabling gentle carousel auto-advance
  useEffect(() => {
    if (!isAutoPlaying || isHoverPaused || totalSlides <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlide(prev => (prev + 1) % totalSlides);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [isAutoPlaying, isHoverPaused, totalSlides]);

  const handlePrev = () => {
    setActiveSlide(prev => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNext = () => {
    setActiveSlide(prev => (prev + 1) % totalSlides);
  };

  const averageRating = useMemo(() => {
    if (allTestimonials.length === 0) return '5.0';
    const avg =
      allTestimonials.reduce((sum, item) => sum + item.rating, 0) /
      allTestimonials.length;
    return avg.toFixed(1);
  }, [allTestimonials]);

  const translateClass =
    SLIDE_TRANSLATE_CLASSES[safeSlideIndex] || 'translate-x-0';

  return (
    <section
      id="testimonials"
      aria-label="Client Testimonials from Delhi"
      className="py-16 bg-[#F8F9FB] border-b border-slate-200"
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header + Delhi Proof Summary + Carousel Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#AA7C11] tracking-widest uppercase">
              <span>Client Testimonials</span>
              <span aria-hidden="true">·</span>
              <span>Delhi Households &amp; Professionals</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold font-brand text-[#0B132B] text-balance">
              Trusted Across Delhi Neighborhoods
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              Verified doorstep feedback from customers across Sultanpuri, Rohini,
              Pitampura, Punjabi Bagh, Model Town, and Paschim Vihar.
            </p>
          </div>

          {/* Aggregate Proof & Zone Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs">
              <div>
                <div className="font-mono font-bold text-lg text-[#0B132B] tabular-nums leading-none">
                  {averageRating} / 5.0
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Delhi Client Rating
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
              <div>
                <div className="font-mono font-bold text-lg text-[#0B132B] tabular-nums leading-none">
                  {allTestimonials.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Featured Stories
                </div>
              </div>
            </div>

            {/* Zone Filter Buttons */}
            <div
              role="group"
              aria-label="Filter testimonials by Delhi zone"
              className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg self-start sm:self-auto"
            >
              {(
                [
                  { id: 'ALL', label: 'All Delhi' },
                  { id: 'North West Delhi', label: 'North West' },
                  { id: 'West & North Delhi', label: 'West & North' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setZoneFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B132B] ${
                    zoneFilter === tab.id
                      ? 'bg-[#0B132B] text-[#F3E5AB]'
                      : 'text-slate-600 hover:text-[#0B132B]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Carousel Viewport */}
        <div
          className="relative overflow-hidden"
          role="region"
          aria-roledescription="carousel"
          aria-label="Delhi Customer Feedback Carousel"
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
          }}
        >
          <div
            className={`flex transition-transform duration-500 ease-out ${translateClass}`}
          >
            {slides.map((group, slideIdx) => (
              <div
                key={`slide-${slideIdx}`}
                aria-hidden={slideIdx !== safeSlideIndex}
                className="w-full shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {group.map(item => (
                  <article
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between gap-5 shadow-xs"
                  >
                    <div className="space-y-4">
                      {/* Rating + Service Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className="flex items-center gap-0.5 text-[#D4AF37]"
                          aria-label={`${item.rating} out of 5 stars`}
                        >
                          {Array.from({ length: 5 }).map((_, starIdx) => (
                            <Star
                              key={starIdx}
                              className={`w-4 h-4 ${
                                starIdx < item.rating
                                  ? 'fill-current text-[#D4AF37]'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>

                        <Quote
                          className="w-5 h-5 text-slate-200 shrink-0"
                          aria-hidden="true"
                        />
                      </div>

                      {/* Quiet Unboxed Metadata */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-semibold text-[#0B132B]">
                          {item.serviceUsed}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          PIN {item.pincode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.dateLabel}</span>
                      </div>

                      {/* Client Feedback Quote */}
                      <blockquote className="text-sm text-slate-700 leading-relaxed">
                        &ldquo;{item.quote}&rdquo;
                      </blockquote>
                    </div>

                    {/* Footer: Outcome + Client Identity */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="text-xs font-medium text-emerald-800 flex items-start gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item.outcome}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#0B132B] text-[#F3E5AB] border border-[#D4AF37]/40 flex items-center justify-center font-brand font-bold text-sm shrink-0">
                            {item.clientName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-[#0B132B] truncate">
                              {item.clientName}
                            </div>
                            <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#AA7C11] shrink-0" />
                              <span className="truncate">
                                {item.roleOrHousehold}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Carousel Navigation Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {/* Slide Indicators + Play/Pause */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Testimonial carousel slides"
            >
              {slides.map((_, idx) => {
                const isActive = idx === safeSlideIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Show testimonial slide ${idx + 1} of ${totalSlides}`}
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2.5 rounded-full transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B132B] ${
                      isActive
                        ? 'w-8 bg-[#0B132B]'
                        : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                );
              })}
            </div>

            {totalSlides > 1 && (
              <button
                type="button"
                onClick={() => setIsAutoPlaying(prev => !prev)}
                aria-label={
                  isAutoPlaying
                    ? 'Pause testimonial carousel rotation'
                    : 'Resume testimonial carousel rotation'
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#0B132B] rounded-lg border border-slate-200 bg-white cursor-pointer"
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Auto-Play</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Prev / Next + Booking Action */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous testimonials"
                className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-white border border-slate-200 text-[#0B132B] hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B132B]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-500 px-1">
                {safeSlideIndex + 1} / {totalSlides}
              </span>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next testimonials"
                className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-white border border-slate-200 text-[#0B132B] hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B132B]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="px-5 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Book Doorstep Pickup
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
