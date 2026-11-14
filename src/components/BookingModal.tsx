import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ServiceType, DeliveryMode, GeoCoordinates } from '../types';
import {
  X,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Clock,
  Tag,
  AlertCircle,
  Truck,
  Building,
  CheckCircle2,
  Crosshair,
  Award,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export const BookingModal: React.FC = () => {
  const {
    isBookingOpen,
    setIsBookingOpen,
    selectedCategory,
    setSelectedCategory,
    serviceCategories,
    garments,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    cartSubtotal,
    settings,
    coupons,
    serviceAreas,
    customerUser,
    updateCustomerUser,
    createOrder,
    selectedLocationPin,
    setSelectedLocationPin,
    isLocationServiceable,
    phoneProofToken,
    t,
    language,
    setRole,
    authSession,
    openAuthModal,
  } = useApp();

  // 5-Step Pan-India Booking Flow:
  // 1: Location & Serviceability -> 2: Service & Garments -> 3: Pickup & Delivery Options -> 4: Notes, Add-ons & Rewards -> 5: Confirm -> 6: Success
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  const defaultAddress = customerUser.addresses?.find(a => a.isDefault) || customerUser.addresses?.[0];

  const [pincode, setPincode] = useState(selectedLocationPin || defaultAddress?.pincode || '110086');
  const [gpsCoords, setGpsCoords] = useState<GeoCoordinates | undefined>(defaultAddress?.coordinates);
  const [gpsStatus, setGpsStatus] = useState('');

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('home_valet');
  const [customerName, setCustomerName] = useState(customerUser.name || '');
  const [customerPhone, setCustomerPhone] = useState(customerUser.phone || '');
  const [address, setAddress] = useState(defaultAddress?.addressLine || '');
  const [locality, setLocality] = useState(defaultAddress?.locality || '');
  const [pickupSlot, setPickupSlot] = useState('Today, Within 45 Minutes (Express)');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [scentedStarch, setScentedStarch] = useState(false);
  const [luxuryHangers, setLuxuryHangers] = useState(false);
  const [expressDelivery, setExpressDelivery] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    message: string;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [useRewardPoints, setUseRewardPoints] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccessOrder, setBookingSuccessOrder] = useState<{
    orderNumber: string;
    pickupOtp?: string;
    deliveryOtp?: string;
    assignedHint?: string;
    total: number;
  } | null>(null);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    if (selectedLocationPin && selectedLocationPin !== pincode) {
      setPincode(selectedLocationPin);
    }
  }, [selectedLocationPin]);

  if (!isBookingOpen) return null;

  const serviceability = isLocationServiceable(pincode, selectedCategory);
  const activeServiceCategories = serviceCategories
    .filter(c => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const selectedServiceMeta = serviceCategories.find(c => c.id === selectedCategory);
  const filteredGarments = garments.filter(g => g.category === selectedCategory && g.isActive !== false);

  const totalGarmentsCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const deliveryFee =
    deliveryMode === 'home_valet'
      ? cartSubtotal >= settings.freeDeliveryThreshold
        ? 0
        : settings.deliveryChargeStandard
      : 0;

  const starchFee = scentedStarch ? totalGarmentsCount * settings.scentedStarchPrice : 0;
  const hangerFee = luxuryHangers ? settings.luxuryHangerPrice : 0;
  const expressFee = expressDelivery ? settings.expressTurnaroundPrice : 0;

  const availableRewardPoints = customerUser.rewardPoints || 0;
  const maxRedeemablePoints = Math.min(availableRewardPoints, Math.floor(cartSubtotal * 0.5));
  const pointsToUse = useRewardPoints ? maxRedeemablePoints : 0;
  const rewardDiscount = pointsToUse * (settings.rewardPointValueInInr || 1);

  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const totalDiscount = couponDiscount + rewardDiscount;
  const estimatedTotal = Math.max(0, cartSubtotal + deliveryFee + starchFee + hangerFee + expressFee - totalDiscount);

  const standardHours = serviceability.area?.standardDeliveryHours || selectedServiceMeta?.turnaroundHours || 12;
  const expressHours = serviceability.area?.expressDeliveryHours || selectedServiceMeta?.expressHours || 4;
  const estimatedDeliveryText = expressDelivery
    ? `Estimated delivery within ${expressHours} hrs`
    : `Estimated delivery within ${standardHours} hrs`;

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS not supported in this browser.');
      return;
    }
    setGpsStatus('Detecting your GPS location...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        const activeAreas = serviceAreas.filter(a => a.isActive && a.coordinates);
        if (activeAreas.length > 0) {
          let nearest = activeAreas[0];
          let minD = Infinity;
          for (const area of activeAreas) {
            if (!area.coordinates) continue;
            const d = Math.hypot(coords.lat - area.coordinates.lat, coords.lng - area.coordinates.lng);
            if (d < minD) {
              minD = d;
              nearest = area;
            }
          }
          setPincode(nearest.pincode);
          setSelectedLocationPin(nearest.pincode);
          setLocality(nearest.areaName);
          setGpsStatus(`GPS matched ${nearest.areaName}, ${nearest.city} (${nearest.pincode})`);
        } else {
          setGpsStatus(`GPS captured (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}). Enter 6-digit PIN.`);
        }
      },
      err => {
        setGpsStatus(`GPS unavailable: ${err.message}`);
      },
      { timeout: 6000 }
    );
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    const found = coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.isActive);
    if (!found) {
      setCouponError('Invalid or inactive voucher code.');
      setAppliedCoupon(null);
      return;
    }
    if (cartSubtotal < found.minOrder) {
      setCouponError(`Requires minimum order of ₹${found.minOrder}.`);
      setAppliedCoupon(null);
      return;
    }
    let discount = 0;
    if (found.flatDiscount) {
      discount = found.flatDiscount;
    } else if (found.discountPercent) {
      const raw = Math.round((cartSubtotal * found.discountPercent) / 100);
      discount = found.maxDiscount ? Math.min(raw, found.maxDiscount) : raw;
    }
    setAppliedCoupon({
      code: found.code,
      discount,
      message: language === 'en' ? found.descriptionEn : found.descriptionHi,
    });
  };

  const handleConfirmOrder = async () => {
    setBookingError('');
    if (!authSession?.isAuthenticated || !authSession.token) {
      setBookingError('Please sign in or register as a Customer before confirming your booking.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !address.trim() || !pincode.trim()) {
      setBookingError('Please complete your name, mobile number, address, and PIN code.');
      return;
    }
    if (!serviceability.serviceable) {
      setBookingError(serviceability.reason || 'No active approved partner is available in this PIN code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderItems = cart.map(c => ({
        garmentId: c.item.id,
        name: language === 'en' ? c.item.nameEn : c.item.nameHi,
        quantity: c.quantity,
        unitPrice: c.item.price,
        totalPrice: c.item.price * c.quantity,
      }));

      const validationRes = await fetch('/api/orders/validate-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.token}`,
        },
        body: JSON.stringify({
          customerId: customerUser.id,
          customerPhone: customerPhone.trim(),
          phoneProofToken: phoneProofToken || undefined,
          firebaseVerifiedPhone: customerUser.phoneVerified ?? false,
          pincode: pincode.trim(),
          serviceType: selectedCategory,
          deliveryMode,
          items: orderItems,
          itemCount: totalGarmentsCount,
          addOns: { scentedStarch, luxuryHangers, expressDelivery },
          couponCode: appliedCoupon?.code,
          customerLat: gpsCoords?.lat,
          customerLng: gpsCoords?.lng,
          totalEstimatedAmount: estimatedTotal,
        }),
      });

      const validationData = await validationRes.json();
      if (!validationRes.ok || !validationData.success) {
        setBookingError(validationData.message || 'Server booking validation rejected this request.');
        setIsSubmitting(false);
        return;
      }

      updateCustomerUser({ name: customerName.trim(), phone: customerPhone.trim() });

      const finalTotal = Math.max(
        0,
        (validationData.pricing?.totalAmount ?? estimatedTotal) - rewardDiscount
      );

      const newOrder = await createOrder({
        customerId: customerUser.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerPhoneVerified: Boolean(phoneProofToken || customerUser.phoneVerified),
        customerAddress: address.trim(),
        pincode: pincode.trim(),
        city: serviceability.area?.city || 'Delhi',
        state: serviceability.area?.state || 'Delhi',
        locality: locality.trim() || serviceability.area?.areaName || pincode.trim(),
        coordinates: gpsCoords || serviceability.area?.coordinates,
        deliveryMode,
        serviceType: selectedCategory,
        items: orderItems,
        addOns: { scentedStarch, luxuryHangers, expressDelivery },
        pickupSlot,
        deliverySlot: estimatedDeliveryText,
        estimatedPickupEta: pickupSlot,
        estimatedDeliveryEta: estimatedDeliveryText,
        specialInstructions: specialInstructions.trim(),
        couponCode: appliedCoupon?.code,
        rewardPointsUsed: pointsToUse,
        rewardDiscount,
        subtotal: validationData.pricing?.subtotal ?? cartSubtotal,
        deliveryCharge: validationData.pricing?.deliveryCharge ?? deliveryFee,
        discount: (validationData.pricing?.discount ?? couponDiscount) + rewardDiscount,
        totalAmount: finalTotal,
        pickupOtp: validationData.pickupOtp,
        deliveryOtp: validationData.deliveryOtp,
      });

      setBookingSuccessOrder({
        orderNumber: newOrder.orderNumber,
        pickupOtp: newOrder.pickupOtp,
        deliveryOtp: newOrder.deliveryOtp,
        assignedHint: validationData.recommendedPartner?.name,
        total: finalTotal,
      });
      setStep(6);
    } catch {
      setBookingError('Network error while validating booking with server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsBookingOpen(false);
    setStep(1);
    setBookingSuccessOrder(null);
    setBookingError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Bar */}
        <div className="bg-[#0B132B] px-6 py-4 text-white flex items-center justify-between border-b border-[#D4AF37]/30">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
              <span>SHAH SIGNATURE Pan-India Dispatch</span>
              <span aria-hidden="true">·</span>
              <span>PIN {pincode || '110086'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-brand text-white mt-0.5">
              {t.booking.title}
            </h2>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close booking modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Step Progress Stepper */}
        {step < 6 && (
          <div className="px-4 sm:px-6 py-3 bg-[#F8F9FB] border-b border-slate-200 grid grid-cols-5 gap-1 text-[11px] font-semibold">
            {[
              { n: 1, label: '1. Location' },
              { n: 2, label: '2. Service' },
              { n: 3, label: '3. Pickup' },
              { n: 4, label: '4. Care Notes' },
              { n: 5, label: '5. Confirm' },
            ].map(s => (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  if (s.n <= step || (s.n === 2 && serviceability.serviceable) || (s.n > 2 && cart.length > 0)) {
                    setStep(s.n as 1 | 2 | 3 | 4 | 5);
                  }
                }}
                className={`py-1.5 px-2 rounded text-center truncate cursor-pointer transition-colors ${
                  step === s.n
                    ? 'bg-[#0B132B] text-[#F3E5AB]'
                    : step > s.n
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'text-slate-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* STEP 1: Select Location & Verify Serviceability */}
        {step === 1 && (
          <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#0B132B] uppercase tracking-wider">
                Step 1: Select Delivery City / PIN Code
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Services are only unlocked where KYC-approved SHAH SIGNATURE partners are actively serving.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative">
                <MapPin className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setPincode(v);
                    if (v.length === 6) setSelectedLocationPin(v);
                  }}
                  placeholder="Enter 6-digit PIN code (e.g. 110086)"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:border-[#0B132B]"
                />
              </div>

              <button
                type="button"
                onClick={handleDetectGps}
                className="px-4 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Crosshair className="w-4 h-4 text-[#D4AF37]" />
                <span>Use GPS Location</span>
              </button>
            </div>

            {gpsStatus && <div className="text-xs text-slate-600">{gpsStatus}</div>}

            {/* Quick City PIN Chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              {serviceAreas
                .filter(a => a.isActive)
                .map(area => (
                  <button
                    key={area.pincode}
                    type="button"
                    onClick={() => {
                      setPincode(area.pincode);
                      setSelectedLocationPin(area.pincode);
                      setLocality(area.areaName);
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                      pincode === area.pincode
                        ? 'bg-[#0B132B] text-[#F3E5AB] border-[#0B132B]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {area.pincode} · {area.areaName} ({area.city})
                  </button>
                ))}
            </div>

            {/* Live Serviceability Result */}
            {serviceability.serviceable ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>
                    Service Active in {serviceability.area?.areaName}, {serviceability.area?.city} ({pincode})
                  </span>
                </div>
                <p>
                  <strong>{serviceability.eligiblePartners.length}</strong> KYC-approved online partner(s) ready ·
                  Min Order: ₹{serviceability.area?.minOrderAmount} · Turnaround ~{standardHours}h.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Partner Availability Check</div>
                  <p className="mt-0.5">{serviceability.reason}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!serviceability.serviceable}
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Select Service & Garments</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Select Service & Garments */}
        {step === 2 && (
          <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Step 2: Select Service Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeServiceCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id as ServiceType)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-[#0B132B] text-white border-[#0B132B] shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{language === 'en' ? cat.nameEn : cat.nameHi}</div>
                    <div className={`text-[10px] mt-0.5 ${selectedCategory === cat.id ? 'text-[#F3E5AB]' : 'text-slate-400'}`}>
                      ~{cat.turnaroundHours}h turnaround
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredGarments.map(garment => {
                const cartItem = cart.find(c => c.item.id === garment.id);
                const qty = cartItem?.quantity || 0;
                return (
                  <div
                    key={garment.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-[#D4AF37]/40 flex items-center justify-between shadow-2xs"
                  >
                    <div className="pr-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {language === 'en' ? garment.nameEn : garment.nameHi}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {language === 'en' ? garment.descriptionEn : garment.descriptionHi}
                      </div>
                      <div className="text-sm font-bold text-[#0B132B] mt-1 tabular-nums">₹{garment.price}</div>
                    </div>

                    {qty > 0 ? (
                      <div className="flex items-center border border-slate-300 rounded-md bg-slate-50 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(garment.id, qty - 1)}
                          className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-200 rounded-l cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-slate-900 tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(garment.id, qty + 1)}
                          className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-200 rounded-r cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(garment, 1)}
                        className="px-3 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-semibold rounded-md flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {cart.length > 0 && (
              <div className="divide-y divide-slate-100 bg-[#FAF7F0] p-3 rounded-lg border border-[#D4AF37]/30 max-h-36 overflow-y-auto">
                {cart.map(c => (
                  <div key={c.item.id} className="py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-medium text-slate-900">{language === 'en' ? c.item.nameEn : c.item.nameHi}</span>
                      <span className="text-slate-500">× {c.quantity}</span>
                    </div>
                    <span className="font-bold text-[#0B132B] tabular-nums">₹{c.item.price * c.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Location</span>
              </button>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">{totalGarmentsCount} items</div>
                  <div className="text-lg font-bold text-[#0B132B] font-mono tabular-nums">₹{cartSubtotal}</div>
                </div>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <span>Pickup & Address</span>
                  <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Pickup/Delivery Mode & Address */}
        {step === 3 && (
          <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMode('home_valet')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  deliveryMode === 'home_valet' ? 'border-[#0B132B] bg-[#0B132B] text-white' : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Truck className="w-4 h-4 text-[#D4AF37]" />
                  <span>{t.booking.deliveryModeHome}</span>
                </div>
                <p className={`text-xs mt-1 ${deliveryMode === 'home_valet' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Free above ₹{settings.freeDeliveryThreshold} (otherwise ₹{settings.deliveryChargeStandard}).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryMode('self_drop')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  deliveryMode === 'self_drop' ? 'border-[#0B132B] bg-[#0B132B] text-white' : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Building className="w-4 h-4 text-[#D4AF37]" />
                  <span>{t.booking.deliveryModeDrop}</span>
                </div>
                <p className={`text-xs mt-1 ${deliveryMode === 'self_drop' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Zero delivery fee. Drop & collect at nearest SHAH SIGNATURE partner hub.
                </p>
              </button>
            </div>

            {customerUser.addresses && customerUser.addresses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customerUser.addresses.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAddress(a.addressLine);
                      setPincode(a.pincode);
                      setSelectedLocationPin(a.pincode);
                      setLocality(a.locality || '');
                    }}
                    className={`px-3 py-1.5 rounded text-xs border font-medium cursor-pointer ${
                      address === a.addressLine ? 'bg-[#0B132B] text-white border-[#0B132B]' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {a.label}: {a.addressLine.slice(0, 26)}... ({a.pincode})
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">{t.booking.contactName} *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">{t.booking.contactPhone} *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">{t.booking.pickupAddress} *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="House / Flat No., Floor, Street"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Locality / Landmark</label>
                <input
                  type="text"
                  value={locality}
                  onChange={e => setLocality(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Preferred Pickup Slot</label>
                <select
                  value={pickupSlot}
                  onChange={e => setPickupSlot(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
                >
                  <option value="Today, Within 45 Minutes (Express)">Today, Within 45 Minutes (Express)</option>
                  <option value="Today, 04:00 PM - 06:00 PM">Today, 04:00 PM - 06:00 PM</option>
                  <option value="Tomorrow Morning, 08:00 AM - 10:00 AM">Tomorrow Morning, 08:00 AM - 10:00 AM</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Garments</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <span>Add-ons & Notes</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Add-ons, Special Notes, Coupons & Rewards */}
        {step === 4 && (
          <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-xs">
            <div className="space-y-2">
              <div className="font-bold text-slate-700 uppercase tracking-wider">{t.booking.addOns}</div>
              <label className="flex items-center justify-between p-2.5 rounded border border-slate-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={scentedStarch} onChange={e => setScentedStarch(e.target.checked)} />
                  <span>{t.booking.scentedStarch}</span>
                </div>
                <span className="font-mono font-bold">+₹{starchFee}</span>
              </label>
              <label className="flex items-center justify-between p-2.5 rounded border border-slate-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={luxuryHangers} onChange={e => setLuxuryHangers(e.target.checked)} />
                  <span>{t.booking.luxuryHangers}</span>
                </div>
                <span className="font-mono font-bold">+₹{settings.luxuryHangerPrice}</span>
              </label>
              <label className="flex items-center justify-between p-2.5 rounded border border-slate-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={expressDelivery} onChange={e => setExpressDelivery(e.target.checked)} />
                  <span>{t.booking.expressDelivery}</span>
                </div>
                <span className="font-mono font-bold">+₹{settings.expressTurnaroundPrice}</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.booking.specialNotes}</label>
              <textarea
                rows={2}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Crisp collar starch, handle silk embroidery delicately..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <form onSubmit={handleApplyCoupon} className="flex gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="Promo code (e.g. SIGNATURE100)"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded uppercase font-mono"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-[#0B132B] text-white font-semibold rounded cursor-pointer">
                Apply
              </button>
            </form>
            {appliedCoupon && (
              <div className="text-emerald-700 bg-emerald-50 p-2 rounded flex justify-between">
                <span>Applied {appliedCoupon.code}: -₹{appliedCoupon.discount}</span>
                <button type="button" onClick={() => setAppliedCoupon(null)} className="text-red-600 font-bold">
                  Remove
                </button>
              </div>
            )}
            {couponError && <div className="text-red-600">{couponError}</div>}

            {maxRedeemablePoints > 0 && (
              <label className="flex items-center justify-between p-3 bg-[#FAF7F0] border border-[#D4AF37]/40 rounded-lg cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={useRewardPoints} onChange={e => setUseRewardPoints(e.target.checked)} />
                  <Award className="w-4 h-4 text-[#AA7C11]" />
                  <span>
                    Redeem <strong>{maxRedeemablePoints}</strong> Loyalty Points (Balance: {availableRewardPoints})
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-700">-₹{maxRedeemablePoints * (settings.rewardPointValueInInr || 1)}</span>
              </label>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Address & Slot</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <span>Review Summary</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Final Summary & Confirm Booking */}
        {step === 5 && (
          <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-xs">
            {bookingError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {(!authSession?.isAuthenticated || !authSession.token) && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Sign in to your verified Customer account to confirm your order. Your cart stays saved.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openAuthModal('customer', 'login')}
                    className="px-3 py-1.5 bg-[#0B132B] text-[#F3E5AB] font-bold rounded cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('customer', 'register')}
                    className="px-3 py-1.5 bg-white border border-amber-400 text-amber-900 font-semibold rounded cursor-pointer"
                  >
                    Register
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <div className="text-[11px] uppercase text-slate-500 font-bold">Pickup & Delivery Details</div>
                <div className="font-bold text-slate-900">{customerName} · {customerPhone}</div>
                <div className="text-slate-600">{address}, {locality}, PIN {pincode}</div>
                <div className="text-emerald-700 font-semibold">{pickupSlot} · {estimatedDeliveryText}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase text-slate-500 font-bold">Payment & Handover Security</div>
                <div className="font-semibold text-[#0B132B]">Direct-to-Partner UPI or Cash on Delivery</div>
                <div className="text-slate-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Phone status: {customerUser.phoneVerified || phoneProofToken ? 'Verified' : 'Standard (OTP verified at doorstep)'}
                  </span>
                </div>
                <div className="text-slate-500">Free cancellation before partner pickup.</div>
              </div>
            </div>

            <div className="p-4 bg-[#0B132B] text-white rounded-xl space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Garments Subtotal ({totalGarmentsCount} items):</span>
                <span className="font-mono">₹{cartSubtotal}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Delivery ({deliveryMode === 'home_valet' ? 'Home Valet' : 'Self Drop'}):</span>
                <span className="font-mono">{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
              </div>
              {(starchFee > 0 || hangerFee > 0 || expressFee > 0) && (
                <div className="flex justify-between text-slate-300">
                  <span>Add-ons:</span>
                  <span className="font-mono">₹{starchFee + hangerFee + expressFee}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex justify-between text-[#F3E5AB]">
                  <span>Coupon + Loyalty Discount:</span>
                  <span className="font-mono">-₹{totalDiscount}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-700 flex justify-between text-base font-bold text-[#F3E5AB]">
                <span>Total Payable Direct to Partner:</span>
                <span className="font-mono text-lg">₹{estimatedTotal}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmOrder}
                className="px-7 py-3 bg-[#D4AF37] hover:bg-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Validating & Dispatching...' : t.booking.confirmBooking}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Booking Success + Doorstep Pickup/Delivery OTPs */}
        {step === 6 && bookingSuccessOrder && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <div className="text-xs uppercase font-semibold text-[#AA7C11] tracking-widest">
                Smart Dispatch Activated
              </div>
              <h3 className="text-2xl font-bold font-brand text-[#0B132B] mt-1">
                Order Confirmed: {bookingSuccessOrder.orderNumber}
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Priority offer dispatched {bookingSuccessOrder.assignedHint ? `first to nearest partner (${bookingSuccessOrder.assignedHint})` : `in PIN ${pincode}`}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-xs">
              <div className="p-3 bg-[#FAF7F0] border border-[#D4AF37]/40 rounded-lg">
                <div className="text-slate-500">Pickup Handover OTP</div>
                <div className="text-xl font-bold font-mono text-[#0B132B] tracking-widest mt-0.5">
                  {bookingSuccessOrder.pickupOtp}
                </div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-slate-500">Delivery Handover OTP</div>
                <div className="text-xl font-bold font-mono text-emerald-800 tracking-widest mt-0.5">
                  {bookingSuccessOrder.deliveryOtp}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setRole('customer');
                  window.location.hash = '#track';
                }}
                className="px-6 py-3 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                Track Live Order & Evidence
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
