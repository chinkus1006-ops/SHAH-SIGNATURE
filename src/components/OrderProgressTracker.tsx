import React from 'react';
import {
  CheckCircle2,
  PackageCheck,
  Sparkles,
  Truck,
  Home,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Order, CanonicalOrderStatus, normalizeOrderStatus } from '../types';

export type OrderProgressStageKey =
  | 'received'
  | 'in_process'
  | 'out_for_delivery'
  | 'delivered';

export interface OrderProgressStageInfo {
  key: OrderProgressStageKey;
  label: string;
  subtitle: string;
  statuses: CanonicalOrderStatus[];
}

export const ORDER_PROGRESS_STAGES: OrderProgressStageInfo[] = [
  {
    key: 'received',
    label: 'Received',
    subtitle: 'Booking confirmed & valet scheduled',
    statuses: ['BOOKED', 'PARTNER_ASSIGNED', 'PICKUP_SCHEDULED'],
  },
  {
    key: 'in_process',
    label: 'In-Process',
    subtitle: 'Picked up, artisan care & quality check',
    statuses: ['PICKED_UP', 'PROCESSING', 'READY_FOR_DELIVERY'],
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    subtitle: 'Valet en route to your doorstep',
    statuses: ['OUT_FOR_DELIVERY'],
  },
  {
    key: 'delivered',
    label: 'Delivered',
    subtitle: 'Handover verified & completed',
    statuses: ['DELIVERED'],
  },
];

export function getOrderProgressStageIndex(status: Order['status']): number {
  const canonical = normalizeOrderStatus(status);
  if (canonical === 'CANCELLED' || canonical === 'DISPUTED') {
    return -1;
  }
  const idx = ORDER_PROGRESS_STAGES.findIndex(stage =>
    stage.statuses.includes(canonical)
  );
  return idx >= 0 ? idx : 0;
}

const PROGRESS_WIDTH_CLASSES = ['w-0', 'w-1/3', 'w-2/3', 'w-full'] as const;

interface OrderProgressTrackerProps {
  order: Order;
  compact?: boolean;
}

export const OrderProgressTracker: React.FC<OrderProgressTrackerProps> = ({
  order,
  compact = false,
}) => {
  const canonical = normalizeOrderStatus(order.status);
  const isCancelled = canonical === 'CANCELLED';
  const isDisputed = canonical === 'DISPUTED';
  const activeIndex = getOrderProgressStageIndex(order.status);

  // If cancelled/disputed, derive highest reached stage from audit logs for context
  const inferredStageIndex = (() => {
    if (activeIndex >= 0) return activeIndex;
    let highest = 0;
    for (const log of order.logs || []) {
      const logCanonical = normalizeOrderStatus(log.status);
      const idx = ORDER_PROGRESS_STAGES.findIndex(s =>
        s.statuses.includes(logCanonical)
      );
      if (idx > highest) highest = idx;
    }
    return highest;
  })();

  const effectiveIndex = isCancelled ? -1 : inferredStageIndex;
  const fillWidthClass =
    effectiveIndex >= 0 && effectiveIndex < PROGRESS_WIDTH_CLASSES.length
      ? PROGRESS_WIDTH_CLASSES[effectiveIndex]
      : 'w-0';

  const getStageIcon = (key: OrderProgressStageKey, className: string) => {
    switch (key) {
      case 'received':
        return <PackageCheck className={className} />;
      case 'in_process':
        return <Sparkles className={className} />;
      case 'out_for_delivery':
        return <Truck className={className} />;
      case 'delivered':
        return <Home className={className} />;
    }
  };

  const getStageTimestamp = (key: OrderProgressStageKey): string | null => {
    const stage = ORDER_PROGRESS_STAGES.find(s => s.key === key);
    if (!stage) return null;

    if (key === 'received' && order.createdAt) {
      const parsed = new Date(order.createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (key === 'in_process' && order.pickedUpAt) {
      const parsed = new Date(order.pickedUpAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (key === 'delivered' && (order.deliveredAt || order.completedAt)) {
      const parsed = new Date(order.deliveredAt || order.completedAt || '');
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }

    const matchingLog = (order.logs || []).find(log =>
      stage.statuses.includes(normalizeOrderStatus(log.status))
    );
    return matchingLog ? matchingLog.timestamp : null;
  };

  if (compact) {
    return (
      <div className="w-full pt-3 mt-3 border-t border-slate-100">
        {isCancelled ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
            <XCircle className="w-3.5 h-3.5" />
            <span>Order Cancelled</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-[#0B132B] via-[#D4AF37] to-emerald-600 transition-all duration-500 ${fillWidthClass}`}
                />
              </div>

              {ORDER_PROGRESS_STAGES.map((stage, idx) => {
                const isCompleted =
                  idx < effectiveIndex ||
                  (idx === 3 && effectiveIndex === 3 && !isDisputed);
                const isCurrent = idx === effectiveIndex && !isCompleted;

                return (
                  <div
                    key={stage.key}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-[#0B132B] border-[#D4AF37] text-[#F3E5AB] ring-2 ring-[#D4AF37]/30'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        getStageIcon(stage.key, 'w-3 h-3')
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-4 gap-1 text-center">
              {ORDER_PROGRESS_STAGES.map((stage, idx) => {
                const isCompleted =
                  idx < effectiveIndex ||
                  (idx === 3 && effectiveIndex === 3 && !isDisputed);
                const isCurrent = idx === effectiveIndex && !isCompleted;
                return (
                  <span
                    key={stage.key}
                    className={`text-[10px] leading-tight font-semibold truncate ${
                      isCompleted
                        ? 'text-emerald-700'
                        : isCurrent
                        ? 'text-[#0B132B] font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      aria-label="Order Progress Tracker"
    >
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-[#0B132B] to-[#15224F] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4AF37]/30">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#F3E5AB]">
            Order Progress Tracker
          </div>
          <div className="text-sm sm:text-base font-bold font-brand text-white flex flex-wrap items-center gap-2 mt-0.5">
            <span>{order.orderNumber}</span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-medium text-slate-200">
              {isCancelled
                ? 'Cancelled'
                : isDisputed
                ? 'Protection Review Active'
                : ORDER_PROGRESS_STAGES[effectiveIndex]?.label || 'Received'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {order.estimatedDeliveryEta && !isCancelled && canonical !== 'DELIVERED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-[#F3E5AB] font-medium">
              <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>ETA: {order.estimatedDeliveryEta}</span>
            </span>
          )}
          {canonical === 'DELIVERED' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Delivered</span>
            </span>
          )}
        </div>
      </div>

      {/* Special Status Alert Banner for Cancelled / Disputed */}
      {isCancelled && (
        <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">This order has been cancelled</div>
            {order.cancellationReason && (
              <p className="text-rose-700 mt-0.5">Reason: {order.cancellationReason}</p>
            )}
          </div>
        </div>
      )}

      {isDisputed && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Garment Protection / Dispute Under Review</div>
            <p className="text-amber-800 mt-0.5">
              Our concierge resolution desk is reviewing submitted evidence for this order.
            </p>
          </div>
        </div>
      )}

      {/* 4-Stage Visual Progress Track */}
      <div className="p-5 sm:p-6 bg-white">
        <div className="relative">
          {/* Desktop / Tablet horizontal track */}
          <div className="hidden sm:block absolute top-6 left-12 right-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-[#0B132B] via-[#D4AF37] to-emerald-600 transition-all duration-700 ${fillWidthClass}`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-3 relative z-10">
            {ORDER_PROGRESS_STAGES.map((stage, idx) => {
              const isCompleted =
                !isCancelled &&
                (idx < effectiveIndex ||
                  (idx === 3 && effectiveIndex === 3 && !isDisputed));
              const isCurrent = !isCancelled && idx === effectiveIndex && !isCompleted;
              const timestamp = getStageTimestamp(stage.key);

              return (
                <div
                  key={stage.key}
                  className={`flex sm:flex-col items-start sm:items-center sm:text-center gap-3 sm:gap-2 p-3 sm:p-2 rounded-xl border sm:border-0 transition-colors ${
                    isCurrent
                      ? 'bg-[#FAF7F0] border-[#D4AF37]/50 sm:bg-transparent'
                      : isCompleted
                      ? 'bg-emerald-50/50 border-emerald-200/70 sm:bg-transparent'
                      : 'bg-slate-50/70 border-slate-200/70 sm:bg-transparent'
                  }`}
                >
                  {/* Step Node */}
                  <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm ${
                      isCompleted
                        ? 'bg-emerald-600 text-white border-2 border-emerald-600'
                        : isCurrent
                        ? 'bg-[#0B132B] text-[#F3E5AB] border-2 border-[#D4AF37] ring-4 ring-[#D4AF37]/25 scale-105'
                        : 'bg-white text-slate-400 border-2 border-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      getStageIcon(stage.key, 'w-5 h-5')
                    )}
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex sm:flex-col items-center sm:items-center justify-between gap-1.5">
                      <span
                        className={`text-sm font-bold tracking-tight ${
                          isCompleted
                            ? 'text-emerald-800'
                            : isCurrent
                            ? 'text-[#0B132B]'
                            : 'text-slate-400'
                        }`}
                      >
                        {stage.label}
                      </span>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCurrent
                            ? 'bg-[#0B132B] text-[#F3E5AB]'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isCompleted
                          ? 'Completed'
                          : isCurrent
                          ? 'In Stage'
                          : isCancelled
                          ? 'Halted'
                          : 'Upcoming'}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] mt-1 leading-snug ${
                        isCompleted || isCurrent ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {stage.subtitle}
                    </p>

                    {timestamp && (isCompleted || isCurrent) && (
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        {timestamp}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
