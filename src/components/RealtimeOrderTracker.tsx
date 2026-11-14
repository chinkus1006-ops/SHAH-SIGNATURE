/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Order, OrderStatus, normalizeOrderStatus } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  Bike, 
  Sparkles, 
  Shirt, 
  PackageCheck, 
  Home, 
  Calendar, 
  Phone, 
  MessageCircle, 
  ExternalLink, 
  ShieldCheck, 
  ChevronRight,
  Flame,
  Waves
} from 'lucide-react';
import { createGoogleCalendarEvent } from '../lib/googleCalendar';
import { getAccessToken, googleSignIn } from '../lib/googleAuth';

interface RealtimeOrderTrackerProps {
  order: Order;
  onUpdateStatus?: (newStatus: OrderStatus, note?: string) => void;
  showPartnerQuickActions?: boolean;
}

export const RealtimeOrderTracker: React.FC<RealtimeOrderTrackerProps> = ({
  order,
  onUpdateStatus,
  showPartnerQuickActions = true,
}) => {
  const { updateOrderStatus, businessSettings } = useApp();

  // Calendar sync modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string; link?: string } | null>(null);

  const canonicalStatus = normalizeOrderStatus(order.status);

  // Status mapping to pipeline steps
  const steps = [
    {
      id: 'PICKUP_SCHEDULED',
      label: 'Booked & Scheduled',
      sublabel: 'Doorstep Valet Assigned',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      id: 'PICKED_UP',
      label: 'Picked Up',
      sublabel: 'Count & Tag Verified',
      icon: <Bike className="w-4 h-4" />,
    },
    {
      id: 'PROCESSING',
      label: 'Cleaning & Press',
      sublabel: 'Artisan Steam Care',
      icon: <Flame className="w-4 h-4" />,
    },
    {
      id: 'READY_FOR_DELIVERY',
      label: 'Ready & Packed',
      sublabel: 'Quality Inspected',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'DELIVERED',
      label: 'Delivered',
      sublabel: 'OTP Handover Done',
      icon: <Home className="w-4 h-4" />,
    },
  ];

  // Determine current step index
  const getCurrentStepIndex = (status: OrderStatus): number => {
    const c = normalizeOrderStatus(status);
    switch (c) {
      case 'BOOKED':
      case 'PARTNER_ASSIGNED':
      case 'PICKUP_SCHEDULED':
        return 0;
      case 'PICKED_UP':
        return 1;
      case 'PROCESSING':
        return 2;
      case 'READY_FOR_DELIVERY':
        return 3;
      case 'OUT_FOR_DELIVERY':
        return 4;
      case 'DELIVERED':
        return 5;
      case 'CANCELLED':
      case 'DISPUTED':
        return 0;
      default:
        return 0;
    }
  };

  const currentStepIdx = getCurrentStepIndex(order.status);

  // Quick Action Handler for Partner Simulation / Actual Partner Action
  const handlePartnerAction = (newStatus: OrderStatus, customNote?: string) => {
    if (onUpdateStatus) {
      onUpdateStatus(newStatus, customNote);
    } else {
      updateOrderStatus(order.id, newStatus, customNote);
    }
  };

  // Google Calendar Sync with Mandatory User Confirmation
  const handleConfirmCalendarSync = async () => {
    setCalendarSyncStatus({ type: 'loading', message: 'Connecting to Google Calendar...' });

    let token = await getAccessToken();
    if (!token) {
      try {
        const signResult = await googleSignIn();
        token = signResult?.accessToken || null;
      } catch (err: any) {
        setCalendarSyncStatus({ type: 'error', message: err.message || 'Google Sign-in failed.' });
        return;
      }
    }

    if (!token) {
      setCalendarSyncStatus({ type: 'error', message: 'Google Calendar authentication required.' });
      return;
    }

    // Schedule event starting today/tomorrow based on pickupSlot
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const endTime = new Date(now.getTime() + 120 * 60 * 1000).toISOString();

    const result = await createGoogleCalendarEvent(token, {
      summary: `SHAH SIGNATURE Valet: ${order.orderNumber}`,
      description: `Luxury Garment Valet Appointment for Order ${order.orderNumber}.\nCustomer: ${order.customerName} (${order.customerPhone})\nValet Partner: ${order.assignedPartnerName || 'Assigned Specialist'} (${order.assignedPartnerPhone || businessSettings.businessPhone})\nDelivery Slot: ${order.pickupSlot}\nService: Luxury Steam Pressing & Laundry`,
      location: `${order.customerAddress}, PIN ${order.pincode}, Delhi`,
      startDateTime: startTime,
      endDateTime: endTime,
    });

    if (result.success) {
      setCalendarSyncStatus({
        type: 'success',
        message: 'Doorstep valet schedule successfully synced with Google Calendar!',
        link: result.eventLink,
      });
    } else {
      setCalendarSyncStatus({
        type: 'error',
        message: result.error || 'Failed to sync event to Google Calendar.',
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="bg-[#0B132B] text-white p-5 border-b border-[#D4AF37]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Real-Time Order Radar</span>
            <span aria-hidden="true">·</span>
            <span>PIN {order.pincode} ({order.city || 'Delhi'})</span>
          </div>
          <h3 className="text-xl font-bold font-brand text-white mt-0.5 flex items-center gap-2">
            <span>{order.orderNumber}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40 uppercase">
              {canonicalStatus.replace(/_/g, ' ')}
            </span>
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            Doorstep slot: <strong className="text-white">{order.pickupSlot}</strong> · {order.items.length} garment types ({order.items.reduce((s, i) => s + i.quantity, 0)} items)
          </p>
        </div>

        {/* Quick Valet Contact & Calendar Sync */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCalendarSyncStatus(null);
              setIsCalendarModalOpen(true);
            }}
            className="px-3 py-1.5 bg-[#15224F] hover:bg-[#1C2541] text-[#F3E5AB] border border-[#D4AF37]/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Sync to Calendar</span>
          </button>

          {order.assignedPartnerPhone ? (
            <a
              href={`tel:${order.assignedPartnerPhone}`}
              className="px-3.5 py-1.5 bg-[#D4AF37] hover:bg-[#c29d29] text-[#0B132B] text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Valet</span>
            </a>
          ) : (
            <a
              href={`tel:${businessSettings.businessPhone}`}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Concierge Desk</span>
            </a>
          )}
        </div>
      </div>

      {/* Real-Time Stepper Progress Bar */}
      <div className="p-6 bg-slate-50 border-b border-slate-200">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-4 right-4 h-1 bg-slate-200 hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-[#0B132B] via-[#D4AF37] to-emerald-600 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(5, (currentStepIdx / (steps.length - 1)) * 100))}%` }}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
            {steps.map((st, idx) => {
              const isPast = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const isFuture = idx > currentStepIdx;

              return (
                <div key={st.id} className="flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                      isPast
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-[#0B132B] text-[#D4AF37] ring-4 ring-[#D4AF37]/30 scale-110 animate-pulse'
                        : 'bg-white text-slate-400 border border-slate-300'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-5 h-5 text-white" /> : st.icon}
                  </div>
                  <div className="mt-2 font-bold text-xs text-slate-900">{st.label}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-1">{st.sublabel}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Partner Live Action Switcher (Instant Real-time Update) */}
      {showPartnerQuickActions && canonicalStatus !== 'DELIVERED' && canonicalStatus !== 'CANCELLED' && (
        <div className="p-4 bg-[#FAF7F0] border-b border-[#D4AF37]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-800 font-semibold">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>Partner Real-Time Operations Controls:</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Advance stage & update customer dashboard live.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canonicalStatus !== 'PICKED_UP' && currentStepIdx < 1 && (
              <button
                onClick={() => handlePartnerAction('PICKED_UP', 'Valet collected and verified items at customer doorstep.')}
                className="px-3 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] font-bold text-xs rounded shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Bike className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>1. Valet Picked Up</span>
              </button>
            )}

            {canonicalStatus === 'PICKED_UP' && (
              <button
                onClick={() => handlePartnerAction('PROCESSING', 'Steam boilers active. Garments in artisan press & delicate wash.')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>2. Start Cleaning & Steam Press</span>
              </button>
            )}

            {canonicalStatus === 'PROCESSING' && (
              <button
                onClick={() => handlePartnerAction('READY_FOR_DELIVERY', 'Inspection passed. Sealed in dust-proof wardrobe packaging.')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded shadow-xs cursor-pointer flex items-center gap-1"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>3. Mark Cleaned & Packed</span>
              </button>
            )}

            {canonicalStatus === 'READY_FOR_DELIVERY' && (
              <button
                onClick={() => handlePartnerAction('OUT_FOR_DELIVERY', `Valet en route to customer address in PIN ${order.pincode}.`)}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Bike className="w-3.5 h-3.5" />
                <span>4. Out for Delivery</span>
              </button>
            )}

            {canonicalStatus === 'OUT_FOR_DELIVERY' && (
              <button
                onClick={() => handlePartnerAction('DELIVERED', 'Customer inspected garments, verified OTP and accepted delivery.')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow-xs cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>5. Confirm Delivery</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Timeline & Garment Care Specs */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Real-Time Audit Log */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Real-Time Audit Timeline</span>
          </h4>

          <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
            {order.logs.map((log, idx) => (
              <div key={idx} className="relative text-xs">
                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#0B132B] ring-2 ring-white" />
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="font-mono text-[11px] font-bold text-[#0B132B]">{log.timestamp}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-700">{log.actor}</span>
                </div>
                <p className="text-slate-600 mt-0.5 leading-relaxed">{log.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Valet & Garment Details */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Valet & Processing Details
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">Assigned Valet Specialist:</span>
              <span className="font-bold text-slate-900">{order.assignedPartnerName || 'Shah Signature Fleet Specialist'}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">Service Category:</span>
              <span className="font-bold text-[#0B132B] uppercase">{order.serviceType.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">Delivery Address:</span>
              <span className="font-medium text-slate-800 text-right max-w-xs">{order.customerAddress} (PIN {order.pincode})</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500">Total Order Value:</span>
              <span className="font-mono font-bold text-base text-[#0B132B]">₹{order.totalAmount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Google Calendar Sync Confirmation Modal (Workspace Integration Policy Requirement) */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#0B132B] text-white p-4 flex items-center gap-2 border-b border-[#D4AF37]/30">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
              <h4 className="text-sm font-bold font-brand text-[#F3E5AB]">
                Add Doorstep Valet to Google Calendar
              </h4>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                You are about to create an event in your primary Google Calendar:
              </p>

              <div className="bg-[#FAF7F0] p-3 rounded-lg border border-[#D4AF37]/40 text-xs space-y-1">
                <div className="font-bold text-[#0B132B]">SHAH SIGNATURE Valet: {order.orderNumber}</div>
                <div className="text-slate-600">Slot: {order.pickupSlot}</div>
                <div className="text-slate-600">Location: {order.customerAddress}, Delhi PIN {order.pincode}</div>
              </div>

              {calendarSyncStatus && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center justify-between ${
                    calendarSyncStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : calendarSyncStatus.type === 'error'
                      ? 'bg-rose-50 text-rose-900 border border-rose-200'
                      : 'bg-sky-50 text-sky-900 border border-sky-200'
                  }`}
                >
                  <span>{calendarSyncStatus.message}</span>
                  {calendarSyncStatus.link && (
                    <a
                      href={calendarSyncStatus.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 font-bold underline flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCalendarSync}
                  className="px-4 py-2 rounded text-xs font-bold bg-[#0B132B] hover:bg-[#15224F] text-[#F3E5AB] flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Confirm & Add Event</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
