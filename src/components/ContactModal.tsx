import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Phone, 
  MessageCircle, 
  Mail, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  User,
  ShieldCheck
} from 'lucide-react';

export const ContactModal: React.FC = () => {
  const {
    isContactModalOpen,
    setIsContactModalOpen,
    businessSettings,
    submitSupportTicket,
    customerUser,
  } = useApp();

  const [senderName, setSenderName] = useState(customerUser?.name || '');
  const [senderPhone, setSenderPhone] = useState(customerUser?.phone || '');
  const [senderSubject, setSenderSubject] = useState('General Support / Booking Enquiry');
  const [senderMessage, setSenderMessage] = useState('');
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  if (!isContactModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderPhone.trim() || !senderMessage.trim()) return;
    const ticket = submitSupportTicket({
      customerId: customerUser?.id,
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      subject: senderSubject.trim() || 'Concierge Support Enquiry',
      message: senderMessage.trim(),
      priority: 'normal',
    });
    setSubmittedTicketId(ticket.id);
    setTimeout(() => {
      setSubmittedTicketId(null);
      setSenderMessage('');
      setIsContactModalOpen(false);
    }, 2500);
  };

  // Clean raw phone for tel link
  const rawTel = businessSettings.businessPhone.replace(/[^0-9+]/g, '') || '+919899229102';
  const cleanWhatsApp = businessSettings.whatsappSupportNumber.replace(/[^0-9]/g, '') || '919899229102';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-[#0B132B] px-6 py-5 text-white flex items-center justify-between border-b border-[#D4AF37]/30">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
              <span>SHAH SIGNATURE Concierge Desk</span>
              <span aria-hidden="true">·</span>
              <span>PIN 110086, Delhi</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-brand text-white mt-1">
              Contact & Direct Concierge
            </h2>
          </div>

          <button
            onClick={() => setIsContactModalOpen(false)}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close contact modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Quick Contact Cards with Clickable Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            {/* Clickable WhatsApp */}
            <a
              href={`https://wa.me/${cleanWhatsApp}?text=Hello%20${encodeURIComponent(businessSettings.businessOwnerName || 'Ronak')},%20I%20have%20an%20inquiry%20regarding%20SHAH%20SIGNATURE%20garment%20care%20services%20in%20Delhi%20PIN%20110086.`}
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/90 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-emerald-950 text-sm">WhatsApp Concierge</div>
                  <div className="text-emerald-800 font-mono mt-0.5">+{cleanWhatsApp}</div>
                  <div className="text-[10px] text-emerald-700">Instant Chat & Status Support</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                Chat →
              </span>
            </a>

            {/* Clickable Phone */}
            <a
              href={`tel:${rawTel}`}
              className="p-4 rounded-xl border border-slate-200 bg-[#FAF7F0] hover:bg-[#F3E5AB]/40 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0B132B] text-[#F3E5AB] rounded-lg shadow-sm">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">Call Direct</div>
                  <div className="text-slate-800 font-mono font-semibold mt-0.5">{businessSettings.businessPhone}</div>
                  <div className="text-[10px] text-slate-500">Concierge Desk Helpline</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0B132B] group-hover:translate-x-0.5 transition-transform">
                Call →
              </span>
            </a>

            {/* Clickable Email */}
            <a
              href={`mailto:${businessSettings.businessEmail}`}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-700 text-white rounded-lg shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">Email Inquiries</div>
                  <div className="text-slate-700 font-mono truncate max-w-[170px] mt-0.5">{businessSettings.businessEmail}</div>
                  <div className="text-[10px] text-slate-500">Corporate & Business Desk</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:translate-x-0.5 transition-transform">
                Email →
              </span>
            </a>

            {/* Service Area & Location */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
              <div className="p-2.5 bg-[#D4AF37]/20 text-[#0B132B] rounded-lg shadow-sm">
                <MapPin className="w-5 h-5 text-[#AA7C11]" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Active Service PIN</div>
                <div className="text-slate-800 font-semibold mt-0.5">PIN 110086, Delhi</div>
                <div className="text-[10px] text-slate-500">Sultanpuri, Nangloi Rd, Rohini Ext</div>
              </div>
            </div>

          </div>

          {/* Business Hours & Verified Management Note */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Operating Hours: <strong>{businessSettings.supportHours}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <User className="w-4 h-4 text-slate-500" />
              <span>Business Owner: <strong>{businessSettings.businessOwnerName}</strong></span>
            </div>
          </div>

          {/* Contact Inquiry Form */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="font-bold font-brand text-slate-900 text-sm mb-3">
              Send Concierge a Message
            </h3>

            {submittedTicketId ? (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Support Ticket {submittedTicketId} Logged!</span> Our concierge desk will review your request shortly.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-[#0B132B]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="+91 98XXX XXXXX"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 font-mono focus:outline-none focus:border-[#0B132B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={senderSubject}
                    onChange={(e) => setSenderSubject(e.target.value)}
                    placeholder="e.g. General Support / Order Assistance / Bulk Inquiry"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-[#0B132B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Message or Special Request *</label>
                  <textarea
                    rows={3}
                    required
                    value={senderMessage}
                    onChange={(e) => setSenderMessage(e.target.value)}
                    placeholder="Describe your inquiry, bulk garment requirements, or feedback..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-[#0B132B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsContactModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:text-black cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Send Message</span>
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
