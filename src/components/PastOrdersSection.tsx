import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Receipt,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Printer,
  Search,
  FileText,
  MapPin,
} from 'lucide-react';
import { Order, normalizeOrderStatus } from '../types';

interface PastOrdersSectionProps {
  orders: Order[];
  onRebook: (order: Order) => void;
  onTrackOrder: (orderId: string) => void;
  onBookNew?: () => void;
  maxVisible?: number;
  onViewAll?: () => void;
}

const SERVICE_LABEL_MAP: Record<string, string> = {
  ironing_normal: 'Normal Ironing',
  ironing_steam: 'Steam Ironing',
  laundry: 'Organic Laundry',
  dry_cleaning: 'Dry Cleaning',
};

function formatServiceTitle(serviceType: string): string {
  return SERVICE_LABEL_MAP[serviceType] || serviceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatOrderDateTime(iso?: string): string {
  if (!iso) return 'Date recorded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const PastOrdersSection: React.FC<PastOrdersSectionProps> = ({
  orders,
  onRebook,
  onTrackOrder,
  onBookNew,
  maxVisible,
  onViewAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const completedOrders = useMemo(() => {
    return orders
      .filter(o => normalizeOrderStatus(o.status) === 'DELIVERED')
      .sort((a, b) => {
        const aTime = new Date(a.deliveredAt || a.completedAt || a.createdAt).getTime();
        const bTime = new Date(b.deliveredAt || b.completedAt || b.createdAt).getTime();
        return bTime - aTime;
      });
  }, [orders]);

  const filteredCompletedOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = !q
      ? completedOrders
      : completedOrders.filter(o => {
          const matchesOrderNum = o.orderNumber.toLowerCase().includes(q);
          const matchesService = formatServiceTitle(o.serviceType).toLowerCase().includes(q);
          const matchesItem = o.items.some(i => i.name.toLowerCase().includes(q));
          const matchesLocality = (o.locality || o.pincode || '').toLowerCase().includes(q);
          return matchesOrderNum || matchesService || matchesItem || matchesLocality;
        });
    return typeof maxVisible === 'number' ? list.slice(0, maxVisible) : list;
  }, [completedOrders, searchQuery, maxVisible]);

  const totalCompletedSpend = useMemo(
    () => completedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [completedOrders]
  );

  const totalCompletedGarments = useMemo(
    () =>
      completedOrders.reduce(
        (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0),
        0
      ),
    [completedOrders]
  );

  return (
    <div
      id="past-orders"
      className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FBFBFC]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#AA7C11]">
            Completed Services &amp; Invoices
          </div>
          <h3 className="text-lg sm:text-xl font-bold font-brand text-[#0B132B] mt-0.5">
            Past Orders ({completedOrders.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete list of delivered garment care services with completion dates and itemized invoice summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {completedOrders.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs">
              <div>
                <div className="font-mono font-bold text-sm text-[#0B132B] tabular-nums">
                  {totalCompletedGarments} pcs
                </div>
                <div className="text-[11px] text-slate-500">Cared For</div>
              </div>
              <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
              <div>
                <div className="font-mono font-bold text-sm text-[#0B132B] tabular-nums">
                  ₹{totalCompletedSpend}
                </div>
                <div className="text-[11px] text-slate-500">Total Billed</div>
              </div>
            </div>
          )}

          {!maxVisible && completedOrders.length > 1 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search order # or service..."
                aria-label="Search past orders"
                className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#0B132B] w-56"
              />
            </div>
          )}

          {onViewAll && completedOrders.length > (maxVisible || 0) && (
            <button
              type="button"
              onClick={onViewAll}
              className="px-3.5 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
            >
              View All Past Orders ({completedOrders.length})
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {completedOrders.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Completed Orders Yet</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Once an active order completes OTP-verified doorstep delivery, its completion date and full invoice summary will appear here.
          </p>
          {onBookNew && (
            <button
              type="button"
              onClick={onBookNew}
              className="px-5 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] text-xs font-semibold rounded-lg cursor-pointer"
            >
              Schedule a Pickup
            </button>
          )}
        </div>
      ) : filteredCompletedOrders.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500">
          No completed orders match &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredCompletedOrders.map(order => {
            const isExpanded = expandedInvoiceId === order.id;
            const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);
            const completedDate = order.deliveredAt || order.completedAt || order.updatedAt || order.createdAt;
            const serviceLabel = formatServiceTitle(order.serviceType);
            const invoiceNumber = `INV-${order.orderNumber.replace(/^SS-?/i, '')}`;

            return (
              <div key={order.id} className="p-5 sm:px-6 transition-colors hover:bg-slate-50/70">
                {/* Summary Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold font-brand text-base text-[#0B132B]">
                        {order.orderNumber}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">{serviceLabel}</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#AA7C11]" />
                        <span>Delivered: {formatOrderDateTime(completedDate)}</span>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{totalPieces} garments</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span>Valet: {order.assignedPartnerName || 'SHAH SIGNATURE Hub'}</span>
                    </div>
                  </div>

                  {/* Right: Invoice Total & Actions */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="text-left md:text-right">
                      <div className="text-[11px] font-mono text-slate-400">
                        {invoiceNumber}
                      </div>
                      <div className="text-base font-bold font-mono text-[#0B132B] tabular-nums">
                        ₹{order.totalAmount}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {order.paymentStatus === 'paid_to_partner'
                          ? 'Paid'
                          : order.paymentMethod === 'direct_to_partner_cash'
                          ? 'Settled (Cash)'
                          : 'Settled (UPI / Direct)'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedInvoiceId(prev => (prev === order.id ? null : order.id))
                        }
                        aria-expanded={isExpanded}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-[#0B132B] border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#AA7C11]" />
                        <span>{isExpanded ? 'Hide Invoice' : 'Invoice Summary'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onRebook(order)}
                        className="px-3 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rebook</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Detailed Invoice Summary */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200 bg-[#F8F9FB] rounded-xl p-4 sm:p-5 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <div className="font-bold text-[#0B132B] text-sm">
                          Invoice Summary · {invoiceNumber}
                        </div>
                        <div className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>Booked: {formatOrderDateTime(order.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>Slot: {order.pickupSlot}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onTrackOrder(order.id)}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded cursor-pointer"
                        >
                          View Full Log
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-[#0B132B] font-semibold rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#AA7C11]" />
                          <span>Print Invoice</span>
                        </button>
                      </div>
                    </div>

                    {/* Itemized Garment Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="py-2 pr-3 font-semibold">Garment / Service Item</th>
                            <th className="py-2 px-3 font-semibold text-right">Qty</th>
                            <th className="py-2 px-3 font-semibold text-right">Rate</th>
                            <th className="py-2 pl-3 font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {order.items.map((item, idx) => (
                            <tr key={`${order.id}-item-${idx}`}>
                              <td className="py-2 pr-3 font-medium text-slate-800">{item.name}</td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                ₹{item.unitPrice}
                              </td>
                              <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                ₹{item.totalPrice}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals & Address Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                      <div className="space-y-1 text-slate-600">
                        <div className="font-semibold text-[#0B132B] flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#AA7C11]" />
                          <span>Service Address</span>
                        </div>
                        <p className="leading-relaxed">
                          {order.customerAddress}, {order.locality ? `${order.locality}, ` : ''}
                          PIN {order.pincode}
                        </p>
                        {order.couponCode && (
                          <div className="text-[11px] text-emerald-700 font-medium">
                            Coupon Applied: <span className="font-mono">{order.couponCode}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 sm:max-w-xs sm:ml-auto w-full">
                        <div className="flex justify-between text-slate-600">
                          <span>Items Subtotal</span>
                          <span className="font-mono tabular-nums">₹{order.subtotal}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Doorstep Valet</span>
                          <span className="font-mono tabular-nums">
                            {order.deliveryCharge === 0 ? 'FREE' : `₹${order.deliveryCharge}`}
                          </span>
                        </div>
                        {order.discount > 0 && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span>Discount / Rewards</span>
                            <span className="font-mono tabular-nums">-₹{order.discount}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-[#0B132B]">
                          <span>Total Paid</span>
                          <span className="font-mono tabular-nums">₹{order.totalAmount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
