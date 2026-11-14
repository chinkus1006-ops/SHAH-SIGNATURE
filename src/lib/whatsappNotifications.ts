/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanonicalOrderStatus, Order, normalizeOrderStatus } from '../types';

export function cleanPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function generateWhatsAppStatusUrl(
  order: Order,
  targetRecipient: 'customer' | 'owner' | 'partner',
  partnerPhone?: string
): string {
  const ownerNumber = '919899229102';
  const customerNumber = cleanPhoneForWhatsApp(order.customerPhone);
  const valetNumber = partnerPhone ? cleanPhoneForWhatsApp(partnerPhone) : ownerNumber;

  let targetPhone = customerNumber;
  if (targetRecipient === 'owner') targetPhone = ownerNumber;
  if (targetRecipient === 'partner') targetPhone = valetNumber;

  const statusDescriptions: Record<CanonicalOrderStatus, string> = {
    BOOKED: 'Your luxury garment booking is confirmed and awaiting nearby partner assignment.',
    PARTNER_ASSIGNED: `Partner ${order.assignedPartnerName || 'Valet'} has accepted your order.`,
    PICKUP_SCHEDULED: `Doorstep pickup scheduled for ${order.pickupSlot}.`,
    PICKED_UP: 'Garments collected with item count & condition verification.',
    PROCESSING: 'Garments currently undergoing pressing / cleaning care.',
    READY_FOR_DELIVERY: 'Quality inspected & sealed in dust-proof wardrobe packaging.',
    OUT_FOR_DELIVERY: `Valet is en route for doorstep handover in PIN ${order.pincode}.`,
    DELIVERED: 'Order delivered successfully. Thank you for choosing SHAH SIGNATURE.',
    CANCELLED: `Order cancelled. Reason: ${order.cancellationReason || 'Requested by customer'}.`,
    DISPUTED: 'Order marked under dispute review by SHAH SIGNATURE desk.',
  };

  const canonicalStatus = normalizeOrderStatus(order.status);

  const messageText =
`👔 *SHAH SIGNATURE CONCIERGE*
*ONE NAME. MANY SOLUTIONS. SIGNATURE OF TRUST.*

*Order:* #${order.orderNumber}
*Customer:* ${order.customerName}
*Status:* ${canonicalStatus.replace(/_/g, ' ')}
*Details:* ${statusDescriptions[canonicalStatus] || 'Status update'}

📍 *Service Area:* PIN ${order.pincode}, ${order.city || 'India'}
🧥 *Garments:* ${order.items.reduce((s, i) => s + i.quantity, 0)} items (₹${order.totalAmount})
🚴 *Valet Partner:* ${order.assignedPartnerName || 'Shah Signature Fleet'} (${order.assignedPartnerPhone || '9899229102'})

Direct Helpline: +91 9899229102 | SHAH SIGNATURE`;

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}`;
}
