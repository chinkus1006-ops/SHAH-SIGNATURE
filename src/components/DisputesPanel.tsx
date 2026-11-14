import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CanonicalDisputeStatus,
  CompensationRecord,
  CompensationType,
  Order,
  OrderDispute,
  RequestedResolutionType,
  normalizeDisputeStatus,
} from '../types';
import { uploadFileToFirebaseStorage } from '../lib/firebaseClient';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  History,
  Lock,
  MessageSquare,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';

interface DisputesPanelProps {
  viewerRole: 'customer' | 'partner' | 'admin';
  customerOrders?: Order[];
  partnerId?: string;
  defaultOrderId?: string;
}

const ALL_DISPUTE_STATUSES: CanonicalDisputeStatus[] = [
  'CLAIM_SUBMITTED',
  'UNDER_REVIEW',
  'PARTNER_RESPONSE_PENDING',
  'CUSTOMER_RESPONSE_PENDING',
  'EVIDENCE_REVIEW',
  'RESOLUTION_PROPOSED',
  'RESOLVED',
  'REJECTED_WITH_REASON',
  'APPEAL_REQUESTED',
  'CLOSED',
];

function getStatusBadgeStyle(status: CanonicalDisputeStatus): string {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'REJECTED_WITH_REASON':
      return 'bg-slate-200 text-slate-800 border border-slate-300';
    case 'APPEAL_REQUESTED':
      return 'bg-rose-100 text-rose-800 border border-rose-200';
    case 'PARTNER_RESPONSE_PENDING':
    case 'CUSTOMER_RESPONSE_PENDING':
      return 'bg-amber-100 text-amber-900 border border-amber-200';
    case 'EVIDENCE_REVIEW':
    case 'UNDER_REVIEW':
    case 'RESOLUTION_PROPOSED':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    default:
      return 'bg-sky-100 text-sky-800 border border-sky-200';
  }
}

export const DisputesPanel: React.FC<DisputesPanelProps> = ({
  viewerRole,
  customerOrders = [],
  partnerId,
  defaultOrderId,
}) => {
  const {
    orders,
    disputes,
    compensationRecords,
    customerUser,
    createOrderDispute,
    respondToDispute,
    submitCustomerFollowUp,
    adminUpdateDispute,
    appealDispute,
    updateCompensationSettlement,
  } = useApp();

  // Customer claim submission state
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    defaultOrderId || customerOrders[0]?.id || ''
  );
  const [category, setCategory] = useState<OrderDispute['category']>('damaged_garment');
  const [affectedGarmentDetails, setAffectedGarmentDetails] = useState('');
  const [affectedQuantity, setAffectedQuantity] = useState<number>(1);
  const [requestedResolution, setRequestedResolution] =
    useState<RequestedResolutionType>('partial_refund');
  const [requestedAmountInr, setRequestedAmountInr] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photoRefs, setPhotoRefs] = useState<string[]>([]);
  const [docRefs, setDocRefs] = useState<string[]>([]);
  const [evidenceUnavailableNote, setEvidenceUnavailableNote] = useState('');

  // Filters & interactive maps
  const [statusFilter, setStatusFilter] = useState<CanonicalDisputeStatus | 'ALL'>('ALL');
  const [partnerReplyMap, setPartnerReplyMap] = useState<Record<string, string>>({});
  const [partnerPreExistingMap, setPartnerPreExistingMap] = useState<Record<string, boolean>>({});
  const [partnerPreNotesMap, setPartnerPreNotesMap] = useState<Record<string, string>>({});
  const [partnerPickupPicsMap, setPartnerPickupPicsMap] = useState<Record<string, string[]>>({});
  const [partnerServicePicsMap, setPartnerServicePicsMap] = useState<Record<string, string[]>>({});
  const [partnerDeliveryPicsMap, setPartnerDeliveryPicsMap] = useState<Record<string, string[]>>({});
  const [questionReplyMap, setQuestionReplyMap] = useState<Record<string, string>>({});
  const [customerFollowUpMap, setCustomerFollowUpMap] = useState<Record<string, string>>({});

  // Admin investigation & compensation state maps
  const [adminNextStatusMap, setAdminNextStatusMap] = useState<Record<string, CanonicalDisputeStatus>>({});
  const [adminCredibilityMap, setAdminCredibilityMap] = useState<
    Record<string, NonNullable<OrderDispute['credibilityAssessment']>>
  >({});
  const [adminFindingsMap, setAdminFindingsMap] = useState<Record<string, string>>({});
  const [adminDecisionMap, setAdminDecisionMap] = useState<
    Record<string, NonNullable<OrderDispute['adminDecision']>>
  >({});
  const [adminReasonMap, setAdminReasonMap] = useState<Record<string, string>>({});
  const [adminBasisMap, setAdminBasisMap] = useState<Record<string, string>>({});
  const [askQuestionTextMap, setAskQuestionTextMap] = useState<Record<string, string>>({});
  const [askQuestionTargetMap, setAskQuestionTargetMap] = useState<Record<string, 'partner' | 'customer'>>({});

  const [enableCompMap, setEnableCompMap] = useState<Record<string, boolean>>({});
  const [compTypeMap, setCompTypeMap] = useState<Record<string, CompensationType>>({});
  const [compPartyMap, setCompPartyMap] = useState<Record<string, CompensationRecord['responsibleParty']>>({});
  const [compAmountMap, setCompAmountMap] = useState<Record<string, string>>({});
  const [compValuationMap, setCompValuationMap] = useState<Record<string, string>>({});
  const [compPayRespMap, setCompPayRespMap] = useState<Record<string, CompensationRecord['paymentResponsibility']>>({});

  const [restrictPartnerMap, setRestrictPartnerMap] = useState<Record<string, boolean>>({});
  const [restrictReasonMap, setRestrictReasonMap] = useState<Record<string, string>>({});
  const [urgentSafetyMap, setUrgentSafetyMap] = useState<Record<string, boolean>>({});

  const [settlementRefMap, setSettlementRefMap] = useState<Record<string, string>>({});
  const [appealNoteMap, setAppealNoteMap] = useState<Record<string, string>>({});
  const [auditOpenMap, setAuditOpenMap] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (defaultOrderId) {
      setSelectedOrderId(defaultOrderId);
    }
  }, [defaultOrderId]);

  const roleScopedDisputes =
    viewerRole === 'admin'
      ? disputes
      : viewerRole === 'partner'
      ? disputes.filter(d => d.partnerId === partnerId)
      : disputes.filter(d => d.customerId === customerUser.id);

  const visibleDisputes = roleScopedDisputes.filter(d =>
    statusFilter === 'ALL' ? true : normalizeDisputeStatus(d.status) === statusFilter
  );

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleOpenDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !description.trim()) return;
    const parsedReqAmount = requestedAmountInr.trim() ? Number(requestedAmountInr) : undefined;
    const created = createOrderDispute({
      orderId: selectedOrderId,
      category,
      affectedGarmentDetails: affectedGarmentDetails.trim() || undefined,
      affectedQuantity: Number(affectedQuantity) || 1,
      description,
      requestedResolution,
      requestedAmountInr:
        parsedReqAmount !== undefined && Number.isFinite(parsedReqAmount) && parsedReqAmount >= 0
          ? parsedReqAmount
          : undefined,
      customerPhotoUrls: photoRefs,
      supportingDocUrls: docRefs,
      evidenceUnavailableNote: evidenceUnavailableNote.trim() || undefined,
    });
    if (created) {
      setAffectedGarmentDetails('');
      setAffectedQuantity(1);
      setRequestedAmountInr('');
      setDescription('');
      setPhotoRefs([]);
      setDocRefs([]);
      setEvidenceUnavailableNote('');
      showToast(
        'success',
        `Claim ${created.id} submitted (${created.orderNumber}) — status: CLAIM_SUBMITTED.`
      );
    }
  };

  const handleAttachment = async (
    target: 'customer_photo' | 'customer_doc' | 'partner_pickup' | 'partner_service' | 'partner_delivery',
    disputeKey: string,
    file?: File
  ) => {
    if (!file) return;
    const res = await uploadFileToFirebaseStorage('disputes', `${disputeKey}_${target}`, file);
    const ref = res.success && res.url ? res.url : `local-ref:${file.name}`;
    if (target === 'customer_photo') setPhotoRefs(prev => [...prev, ref]);
    else if (target === 'customer_doc') setDocRefs(prev => [...prev, ref]);
    else if (target === 'partner_pickup') {
      setPartnerPickupPicsMap(prev => ({ ...prev, [disputeKey]: [...(prev[disputeKey] || []), ref] }));
    } else if (target === 'partner_service') {
      setPartnerServicePicsMap(prev => ({ ...prev, [disputeKey]: [...(prev[disputeKey] || []), ref] }));
    } else {
      setPartnerDeliveryPicsMap(prev => ({ ...prev, [disputeKey]: [...(prev[disputeKey] || []), ref] }));
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs border flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Customer New Damage / Missing Item Claim Form */}
      {viewerRole === 'customer' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold font-brand text-[#0B132B] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
              <span>File a Garment Damage, Missing Item or Protection Claim</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fair two-sided review: your partner provides workshop & pickup inspection records, and Super Admin adjudicates with written reasoning. Photos help speed review, but claims without photos are never auto-rejected.
            </p>
          </div>

          {customerOrders.length === 0 ? (
            <div className="text-xs text-slate-500">Place an order first before raising a protection claim.</div>
          ) : (
            <form onSubmit={handleOpenDispute} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Order *</label>
                  <select
                    value={selectedOrderId}
                    onChange={e => setSelectedOrderId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 bg-white"
                  >
                    {customerOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} · ₹{o.totalAmount} ({o.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Issue Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as OrderDispute['category'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 bg-white"
                  >
                    <option value="damaged_garment">Garment Damage / Scorch / Tear / Shrinkage</option>
                    <option value="missing_item">Missing Garment Item</option>
                    <option value="quality_issue">Pressing / Cleaning Quality Issue</option>
                    <option value="wrong_item">Wrong Garment Swapped</option>
                    <option value="delayed_delivery">Severe Delivery Delay</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Requested Resolution *</label>
                  <select
                    value={requestedResolution}
                    onChange={e => setRequestedResolution(e.target.value as RequestedResolutionType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 bg-white"
                  >
                    <option value="partial_refund">Partial Service Refund</option>
                    <option value="service_charge_refund">Service Charge Refund</option>
                    <option value="repair_reimbursement">Tailor / Repair Cost Reimbursement</option>
                    <option value="damage_compensation">Verified Damage Compensation</option>
                    <option value="missing_garment_resolution">Missing Garment Recovery / Compensation</option>
                    <option value="repress_or_redo">Free Re-Press / Redo Service</option>
                    <option value="full_refund">Full Order Refund</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Affected Garment Details (Name / Color / Tag Ref)
                  </label>
                  <input
                    type="text"
                    value={affectedGarmentDetails}
                    onChange={e => setAffectedGarmentDetails(e.target.value)}
                    placeholder="e.g. Ivory Silk Kurta (Tag TAG-SHAH-9041-1)"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Qty Affected</label>
                    <input
                      type="number"
                      min={1}
                      value={affectedQuantity}
                      onChange={e => setAffectedQuantity(Number(e.target.value))}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Claim Amt (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={requestedAmountInr}
                      onChange={e => setRequestedAmountInr(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Detailed Problem Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the exact damage, missing piece count, or issue observed at delivery..."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-[#AA7C11]" />
                    <span>Garment Photos ({photoRefs.length})</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleAttachment('customer_photo', selectedOrderId || 'claim', e.target.files?.[0])}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Receipt / Repair Quote ({docRefs.length})</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => handleAttachment('customer_doc', selectedOrderId || 'doc', e.target.files?.[0])}
                    />
                  </label>
                </div>

                <div>
                  <input
                    type="text"
                    value={evidenceUnavailableNote}
                    onChange={e => setEvidenceUnavailableNote(e.target.value)}
                    placeholder="If photo unavailable (e.g. missing garment), note reason here"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  Fairness Guarantee: Missing photos do not waive your right to investigation.
                </span>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded cursor-pointer"
                >
                  Submit Protection Claim
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Disputes List & Role Adjudication Desk */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold font-brand text-[#0B132B] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#D4AF37]" />
              <span>
                {viewerRole === 'admin'
                  ? `Admin Customer Protection & Dispute Desk (${visibleDisputes.length}/${roleScopedDisputes.length})`
                  : viewerRole === 'partner'
                  ? `Partner Claims & Evidence Defense (${visibleDisputes.length})`
                  : `My Claims & Resolution Tracker (${visibleDisputes.length})`}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              10-stage transparent workflow, immutable audit logs & separate non-commission compensation tracking.
            </p>
          </div>

          {viewerRole === 'admin' && compensationRecords.length > 0 && (
            <div className="text-[11px] bg-[#FAF7F0] border border-[#D4AF37]/40 px-3 py-1.5 rounded-lg text-[#0B132B] font-semibold">
              Compensation Records: {compensationRecords.length} · Approved Payouts: ₹
              {compensationRecords.reduce((s, c) => s + (c.approvedAmountInr || 0), 0)} (Commission Never Auto-Deducted)
            </div>
          )}
        </div>

        {/* Status Filter Strip */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#0B132B] text-[#F3E5AB]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({roleScopedDisputes.length})
          </button>
          {ALL_DISPUTE_STATUSES.map(st => {
            const count = roleScopedDisputes.filter(d => normalizeDisputeStatus(d.status) === st).length;
            if (count === 0 && viewerRole !== 'admin') return null;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#0B132B] text-[#F3E5AB]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st.replace(/_/g, ' ')} ({count})
              </button>
            );
          })}
        </div>

        {visibleDisputes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No claims matching this filter.
          </div>
        ) : (
          <div className="space-y-5">
            {visibleDisputes.map(d => {
              const canonical = normalizeDisputeStatus(d.status);
              const linkedOrder = orders.find(o => o.id === d.orderId);
              const ev = linkedOrder?.garmentEvidence;
              const isResolvedOrRejected =
                canonical === 'RESOLVED' || canonical === 'REJECTED_WITH_REASON';
              const isClosed = canonical === 'CLOSED';
              const targetAdminStatus = adminNextStatusMap[d.id] || (canonical === 'CLAIM_SUBMITTED' ? 'UNDER_REVIEW' : 'RESOLVED');

              return (
                <div
                  key={d.id}
                  className="p-5 rounded-xl border border-slate-200 bg-[#FBFBFC] space-y-4 text-xs"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-[#0B132B] text-sm">{d.orderNumber}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{d.id}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold uppercase text-[10px]">
                        {d.category.replace(/_/g, ' ')}
                      </span>
                      {d.requestedResolution && (
                        <span className="px-2 py-0.5 rounded bg-[#FAF7F0] border border-[#D4AF37]/40 text-[#0B132B] font-semibold text-[10px]">
                          Requested: {d.requestedResolution.replace(/_/g, ' ')}
                          {typeof d.requestedAmountInr === 'number' ? ` (₹${d.requestedAmountInr})` : ''}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded font-bold uppercase text-[10px] ${getStatusBadgeStyle(canonical)}`}
                    >
                      {canonical}
                    </span>
                  </div>

                  {/* Two-Sided Evidence Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <div className="font-bold text-[#0B132B] flex items-center justify-between">
                        <span>Customer Claim ({d.customerName})</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {d.affectedGarmentDetails && (
                        <div className="text-[11px] font-semibold text-slate-700">
                          Item: {d.affectedGarmentDetails} (Qty: {d.affectedQuantity || 1})
                        </div>
                      )}
                      <p className="text-slate-700 leading-relaxed">{d.description}</p>
                      {d.customerFollowUpNote && (
                        <div className="p-2 rounded bg-sky-50 border border-sky-200 text-sky-900 text-[11px]">
                          <strong>Customer Follow-Up:</strong> {d.customerFollowUpNote}
                        </div>
                      )}
                      {d.evidenceUnavailableNote && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded">
                          Photo note: {d.evidenceUnavailableNote}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500">
                        Photos: {d.customerPhotoUrls.length} · Supporting Docs: {d.supportingDocUrls?.length || 0}
                        {d.customerPhotoUrls.length > 0 && ` (${d.customerPhotoUrls.join(', ')})`}
                      </div>
                    </div>

                    <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <div className="font-bold text-[#0B132B] flex items-center justify-between">
                        <span>Partner Defense ({d.partnerName})</span>
                        {d.partnerRespondedAt && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(d.partnerRespondedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {d.partnerResponse ? (
                        <>
                          <p className="text-slate-700 leading-relaxed">{d.partnerResponse}</p>
                          {d.partnerPreExistingDamageReported && (
                            <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                              <strong>Pre-Existing Damage Cited:</strong>{' '}
                              {d.partnerPreExistingNotes || 'Flagged in workshop intake log'}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500">
                            Counter Photos: Pickup ({d.partnerPickupPhotoUrls?.length || 0}) · Service ({d.partnerServicePhotoUrls?.length || 0}) · Delivery ({d.partnerDeliveryPhotoUrls?.length || 0})
                          </div>
                        </>
                      ) : (
                        <p className="text-slate-400 italic">
                          No partner explanation submitted yet. (Admin may still review pickup & service logs fairly.)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Linked Order Pickup/Service/Delivery Evidence Summary */}
                  {ev && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] space-y-1">
                      <div className="font-bold text-[#0B132B] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Linked Order Protection Evidence ({ev.tagReference})
                        </span>
                        <span className="text-slate-500 font-mono">
                          Pickup: {ev.verifiedCount}/{ev.expectedCount} · Delivered: {ev.deliveredCount ?? 'pending'}
                        </span>
                      </div>
                      <div className="text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong>Pre-Existing Marks:</strong>{' '}
                          {ev.hasPreExistingDamage
                            ? ev.damageNotes || ev.stainChecklist.join(', ') || 'Yes'
                            : 'None noted'}
                        </span>
                        <span>
                          <strong>Customer Pickup Sign-Off:</strong> {ev.customerSignOff ? 'Confirmed' : 'Pending'}
                        </span>
                        <span>
                          <strong>Delivery OTP:</strong> {ev.deliveryOtpVerified ? 'Verified' : 'Pending'}
                        </span>
                        <span>
                          <strong>Order Photos:</strong> P({ev.pickupPhotoUrls.length}) · S({(ev.beforeServicePhotoUrls?.length || 0) + (ev.afterServicePhotoUrls?.length || 0)}) · D({ev.deliveryPhotoUrls.length})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Admin Follow-Up Questions Thread */}
                  {d.adminQuestions && d.adminQuestions.length > 0 && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2">
                      <div className="font-bold text-indigo-950 text-[11px] uppercase tracking-wider">
                        Admin Investigation Questions
                      </div>
                      {d.adminQuestions.map(q => (
                        <div key={q.id} className="bg-white p-2.5 rounded border border-indigo-100 space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-bold text-indigo-900">
                              To {q.targetRole.toUpperCase()}: {q.question}
                            </span>
                            <span className="text-slate-400">{new Date(q.askedAt).toLocaleDateString()}</span>
                          </div>
                          {q.answer ? (
                            <div className="text-emerald-800 bg-emerald-50 px-2 py-1 rounded text-[11px]">
                              <strong>Reply:</strong> {q.answer}
                            </div>
                          ) : (
                            ((viewerRole === 'partner' && q.targetRole === 'partner') ||
                              (viewerRole === 'customer' && q.targetRole === 'customer')) && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={questionReplyMap[q.id] || ''}
                                  onChange={e => setQuestionReplyMap(p => ({ ...p, [q.id]: e.target.value }))}
                                  placeholder="Type your response to Super Admin question..."
                                  className="flex-1 px-2.5 py-1 border border-slate-300 rounded text-xs"
                                />
                                {viewerRole === 'customer' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ans = (questionReplyMap[q.id] || '').trim();
                                      if (!ans) return;
                                      submitCustomerFollowUp(d.id, {
                                        followUpNote: ans,
                                        questionAnswers: { [q.id]: ans },
                                      });
                                      showToast('success', 'Follow-up answer submitted to Admin.');
                                    }}
                                    className="px-3 py-1 bg-[#0B132B] text-white font-bold rounded text-[11px] cursor-pointer"
                                  >
                                    Send Answer
                                  </button>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Investigation Findings, Resolution & Compensation Summary */}
                  {(d.investigationFindings || d.decisionReason || d.resolutionNote) && (
                    <div
                      className={`p-3.5 rounded-lg border space-y-1.5 ${
                        canonical === 'REJECTED_WITH_REASON'
                          ? 'bg-slate-100 border-slate-300 text-slate-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>
                          Admin Adjudication ({d.adminDecision?.replace(/_/g, ' ') || canonical})
                        </strong>
                        {d.credibilityAssessment && (
                          <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-300 text-[10px] font-bold uppercase">
                            Credibility: {d.credibilityAssessment.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      {d.investigationFindings && (
                        <div>
                          <strong>Findings:</strong> {d.investigationFindings}
                        </div>
                      )}
                      <div>
                        <strong>Decision Reason:</strong> {d.decisionReason || d.resolutionNote}
                      </div>
                      {d.contractualBasis && (
                        <div className="text-[11px] opacity-80">
                          <strong>Policy / Contractual Basis:</strong> {d.contractualBasis}
                        </div>
                      )}
                      {d.secondReviewDecision && (
                        <div className="p-2 bg-white/80 rounded border border-emerald-200 text-[11px]">
                          <strong>Second Review (Appeal Outcome):</strong> {d.secondReviewDecision}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compensation Record Card (Separate from Commission!) */}
                  {d.compensationRecord && (
                    <div className="p-3.5 rounded-lg bg-[#FAF7F0] border border-[#D4AF37]/50 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-[#0B132B] flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#AA7C11]" />
                          <span>
                            Compensation Record: ₹{d.compensationRecord.approvedAmountInr} ·{' '}
                            {d.compensationRecord.compensationType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-white border border-[#D4AF37]/40 text-[10px] font-bold uppercase text-[#0B132B]">
                            {d.compensationRecord.settlementStatus.replace(/_/g, ' ')}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <Lock className="w-2.5 h-2.5" />
                            Not Deducted from Commission
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <div>
                          <strong>Responsible Party:</strong> {d.compensationRecord.responsibleParty.replace(/_/g, ' ')}
                        </div>
                        <div>
                          <strong>Payment Method:</strong> {d.compensationRecord.paymentResponsibility.replace(/_/g, ' ')}
                        </div>
                        <div className="sm:col-span-2">
                          <strong>Valuation Basis:</strong> {d.compensationRecord.valuationBasis}
                        </div>
                        {d.compensationRecord.settlementReference && (
                          <div className="sm:col-span-2 font-mono">
                            <strong>Settlement Ref:</strong> {d.compensationRecord.settlementReference}
                          </div>
                        )}
                      </div>

                      {viewerRole === 'admin' && d.compensationRecord.settlementStatus !== 'settled' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={settlementRefMap[d.compensationRecord.id] || ''}
                            onChange={e =>
                              setSettlementRefMap(p => ({
                                ...p,
                                [d.compensationRecord!.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional UTR / credit voucher ref"
                            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateCompensationSettlement(
                                d.compensationRecord!.id,
                                'settled',
                                settlementRefMap[d.compensationRecord!.id]
                              )
                            }
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Mark Compensation Settled
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateCompensationSettlement(
                                d.compensationRecord!.id,
                                'disputed',
                                settlementRefMap[d.compensationRecord!.id]
                              )
                            }
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Mark Disputed Hold
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {d.appealNote && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900">
                      <strong>
                        Appeal Requested ({d.appealSubmittedBy || 'customer'}):
                      </strong>{' '}
                      {d.appealNote}
                    </div>
                  )}

                  {/* Partner Defense Form */}
                  {viewerRole === 'partner' && !isClosed && !isResolvedOrRejected && (
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2.5">
                      <div className="font-bold text-[#0B132B]">
                        Submit Partner Explanation & Counter-Evidence
                      </div>
                      <textarea
                        rows={2}
                        value={partnerReplyMap[d.id] || ''}
                        onChange={e => setPartnerReplyMap(p => ({ ...p, [d.id]: e.target.value }))}
                        placeholder="Explain pickup condition, workshop care, pre-existing flaws, or proposed settlement..."
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(partnerPreExistingMap[d.id])}
                            onChange={e =>
                              setPartnerPreExistingMap(p => ({ ...p, [d.id]: e.target.checked }))
                            }
                          />
                          <span>Garment had pre-existing damage at pickup</span>
                        </label>
                        {partnerPreExistingMap[d.id] && (
                          <input
                            type="text"
                            value={partnerPreNotesMap[d.id] || ''}
                            onChange={e =>
                              setPartnerPreNotesMap(p => ({ ...p, [d.id]: e.target.value }))
                            }
                            placeholder="Describe pre-existing stain/tear reference..."
                            className="flex-1 min-w-[200px] px-2.5 py-1 border border-slate-300 rounded"
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold cursor-pointer">
                            <Camera className="w-3 h-3" />
                            <span>Pickup ({partnerPickupPicsMap[d.id]?.length || 0})</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleAttachment('partner_pickup', d.id, e.target.files?.[0])}
                            />
                          </label>
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>Service ({partnerServicePicsMap[d.id]?.length || 0})</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleAttachment('partner_service', d.id, e.target.files?.[0])}
                            />
                          </label>
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>Delivery ({partnerDeliveryPicsMap[d.id]?.length || 0})</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleAttachment('partner_delivery', d.id, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const text = (partnerReplyMap[d.id] || '').trim();
                            if (!text) {
                              showToast('error', 'Please enter partner explanation text before submitting.');
                              return;
                            }
                            respondToDispute(d.id, {
                              partnerResponse: text,
                              preExistingDamageReported: Boolean(partnerPreExistingMap[d.id]),
                              preExistingNotes: partnerPreNotesMap[d.id],
                              partnerPickupPhotoUrls: partnerPickupPicsMap[d.id] || [],
                              partnerServicePhotoUrls: partnerServicePicsMap[d.id] || [],
                              partnerDeliveryPhotoUrls: partnerDeliveryPicsMap[d.id] || [],
                              questionAnswers: questionReplyMap,
                            });
                            showToast('success', 'Partner evidence submitted — moved to EVIDENCE_REVIEW.');
                          }}
                          className="px-4 py-1.5 bg-[#0B132B] hover:bg-black text-white font-bold rounded cursor-pointer"
                        >
                          Submit Defense & Evidence
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Customer Follow-Up Input when CUSTOMER_RESPONSE_PENDING */}
                  {viewerRole === 'customer' && canonical === 'CUSTOMER_RESPONSE_PENDING' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                      <div className="font-bold text-amber-950">
                        Admin Requested Additional Customer Clarification
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customerFollowUpMap[d.id] || ''}
                          onChange={e =>
                            setCustomerFollowUpMap(p => ({ ...p, [d.id]: e.target.value }))
                          }
                          placeholder="Provide supporting garment details, bill reference, or clarification..."
                          className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const note = (customerFollowUpMap[d.id] || '').trim();
                            if (!note) return;
                            submitCustomerFollowUp(d.id, {
                              followUpNote: note,
                              questionAnswers: questionReplyMap,
                            });
                            showToast('success', 'Follow-up details sent to Admin review desk.');
                          }}
                          className="px-4 py-1.5 bg-[#0B132B] text-white font-bold rounded cursor-pointer"
                        >
                          Submit Follow-Up
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Admin Investigation, Fairness Guardrails & Compensation Adjudication */}
                  {viewerRole === 'admin' && canonical !== 'CLOSED' && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <div className="font-bold text-[#0B132B] flex items-center gap-1.5">
                        <Gavel className="w-4 h-4 text-[#D4AF37]" />
                        <span>Super Admin Investigation, Fairness & Compensation Console</span>
                      </div>

                      {/* Ask Question Sub-bar */}
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-2 items-center">
                        <select
                          value={askQuestionTargetMap[d.id] || 'partner'}
                          onChange={e =>
                            setAskQuestionTargetMap(p => ({
                              ...p,
                              [d.id]: e.target.value as 'partner' | 'customer',
                            }))
                          }
                          className="px-2 py-1 border border-slate-300 rounded bg-white text-[11px]"
                        >
                          <option value="partner">Ask Partner</option>
                          <option value="customer">Ask Customer</option>
                        </select>
                        <input
                          type="text"
                          value={askQuestionTextMap[d.id] || ''}
                          onChange={e =>
                            setAskQuestionTextMap(p => ({ ...p, [d.id]: e.target.value }))
                          }
                          placeholder="Request additional info / clarification before ruling..."
                          className="flex-1 min-w-[200px] px-2.5 py-1 border border-slate-300 rounded bg-white text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const qText = (askQuestionTextMap[d.id] || '').trim();
                            if (!qText) return;
                            const tRole = askQuestionTargetMap[d.id] || 'partner';
                            const res = adminUpdateDispute(d.id, {
                              nextStatus:
                                tRole === 'partner'
                                  ? 'PARTNER_RESPONSE_PENDING'
                                  : 'CUSTOMER_RESPONSE_PENDING',
                              requestQuestion: { targetRole: tRole, question: qText },
                              investigationFindings: adminFindingsMap[d.id] || d.investigationFindings,
                            });
                            if (res.success) {
                              setAskQuestionTextMap(p => ({ ...p, [d.id]: '' }));
                              showToast('success', res.message);
                            } else {
                              showToast('error', res.message);
                            }
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[11px] cursor-pointer"
                        >
                          Send Question
                        </button>
                      </div>

                      {/* Core Ruling Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Target Status (10-Stage)
                          </label>
                          <select
                            value={targetAdminStatus}
                            onChange={e =>
                              setAdminNextStatusMap(p => ({
                                ...p,
                                [d.id]: e.target.value as CanonicalDisputeStatus,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                          >
                            {ALL_DISPUTE_STATUSES.map(st => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Credibility Assessment
                          </label>
                          <select
                            value={adminCredibilityMap[d.id] || d.credibilityAssessment || 'pending_review'}
                            onChange={e =>
                              setAdminCredibilityMap(p => ({
                                ...p,
                                [d.id]: e.target.value as NonNullable<OrderDispute['credibilityAssessment']>,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                          >
                            <option value="pending_review">Pending Review</option>
                            <option value="genuine_claim">Genuine Claim Verified</option>
                            <option value="pre_existing_damage_confirmed">Pre-Existing Damage Confirmed</option>
                            <option value="inconclusive_evidence">Inconclusive / Disputed</option>
                            <option value="unsubstantiated_or_fraudulent">Unsubstantiated / False Claim</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Admin Decision
                          </label>
                          <select
                            value={adminDecisionMap[d.id] || d.adminDecision || 'partial_compensation'}
                            onChange={e =>
                              setAdminDecisionMap(p => ({
                                ...p,
                                [d.id]: e.target.value as NonNullable<OrderDispute['adminDecision']>,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                          >
                            <option value="refund_or_repress">Free Re-Press / Service Refund</option>
                            <option value="repair_reimbursement">Repair Cost Reimbursement</option>
                            <option value="partial_compensation">Partial Compensation</option>
                            <option value="missing_garment_settlement">Missing Garment Settlement</option>
                            <option value="full_refund">Full Order Refund</option>
                            <option value="partner_cleared">Partner Cleared (Pre-Existing / Intact)</option>
                            <option value="rejected_insufficient_basis">Rejected With Reason</option>
                            <option value="escalated">Escalated for Second Review</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={adminFindingsMap[d.id] ?? d.investigationFindings ?? ''}
                          onChange={e =>
                            setAdminFindingsMap(p => ({ ...p, [d.id]: e.target.value }))
                          }
                          placeholder="Documented investigation findings (required before rejecting photo-less claims)..."
                          className="px-3 py-1.5 border border-slate-300 rounded text-slate-900"
                        />
                        <input
                          type="text"
                          value={adminBasisMap[d.id] ?? d.contractualBasis ?? ''}
                          onChange={e => setAdminBasisMap(p => ({ ...p, [d.id]: e.target.value }))}
                          placeholder="Contractual / policy basis (e.g. Garment Care Policy Clause 4.2)"
                          className="px-3 py-1.5 border border-slate-300 rounded text-slate-900"
                        />
                      </div>

                      <input
                        type="text"
                        value={adminReasonMap[d.id] ?? d.decisionReason ?? ''}
                        onChange={e => setAdminReasonMap(p => ({ ...p, [d.id]: e.target.value }))}
                        placeholder="Mandatory written reason explaining decision for customer & partner..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-900"
                      />

                      {/* Compensation Toggle & Fields */}
                      <div className="p-3 rounded-lg bg-[#FAF7F0] border border-[#D4AF37]/40 space-y-2">
                        <label className="flex items-center gap-2 font-bold text-[#0B132B] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(enableCompMap[d.id])}
                            onChange={e =>
                              setEnableCompMap(p => ({ ...p, [d.id]: e.target.checked }))
                            }
                          />
                          <span>
                            Issue Compensation / Refund Record (Explicitly separate from 15% Partner Commission)
                          </span>
                        </label>

                        {enableCompMap[d.id] && (
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                            <select
                              value={compTypeMap[d.id] || 'partial_refund'}
                              onChange={e =>
                                setCompTypeMap(p => ({
                                  ...p,
                                  [d.id]: e.target.value as CompensationType,
                                }))
                              }
                              className="px-2 py-1.5 border border-slate-300 rounded bg-white"
                            >
                              <option value="service_charge_refund">Service Charge Refund</option>
                              <option value="repair_reimbursement">Repair Reimbursement</option>
                              <option value="damage_compensation">Damage Compensation</option>
                              <option value="missing_garment_resolution">Missing Garment Resolution</option>
                              <option value="partial_refund">Partial Refund</option>
                              <option value="full_refund">Full Refund</option>
                              <option value="disputed_compensation">Disputed Compensation Hold</option>
                              <option value="no_financial_payout">No Financial Payout (₹0)</option>
                            </select>

                            <select
                              value={compPartyMap[d.id] || 'partner'}
                              onChange={e =>
                                setCompPartyMap(p => ({
                                  ...p,
                                  [d.id]: e.target.value as CompensationRecord['responsibleParty'],
                                }))
                              }
                              className="px-2 py-1.5 border border-slate-300 rounded bg-white"
                            >
                              <option value="partner">Partner Responsible</option>
                              <option value="shared">Shared Responsibility (50/50)</option>
                              <option value="platform">Platform Goodwill</option>
                              <option value="customer_acknowledged_pre_existing">Pre-Existing (No Payout)</option>
                              <option value="none">None</option>
                            </select>

                            <select
                              value={compPayRespMap[d.id] || 'partner_direct_settlement'}
                              onChange={e =>
                                setCompPayRespMap(p => ({
                                  ...p,
                                  [d.id]: e.target.value as CompensationRecord['paymentResponsibility'],
                                }))
                              }
                              className="px-2 py-1.5 border border-slate-300 rounded bg-white"
                            >
                              <option value="partner_direct_settlement">Partner Direct Payout</option>
                              <option value="platform_goodwill_credit">Platform Goodwill Credit</option>
                              <option value="shared_50_50">Shared 50/50</option>
                              <option value="none">None</option>
                            </select>

                            <input
                              type="number"
                              min={0}
                              value={compAmountMap[d.id] || ''}
                              onChange={e =>
                                setCompAmountMap(p => ({ ...p, [d.id]: e.target.value }))
                              }
                              placeholder="Amount ₹ (manual)"
                              className="px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                            />

                            <input
                              type="text"
                              value={compValuationMap[d.id] || ''}
                              onChange={e =>
                                setCompValuationMap(p => ({ ...p, [d.id]: e.target.value }))
                              }
                              placeholder="Mandatory valuation basis (e.g. tailor bill ₹180 / service fee refund)"
                              className="sm:col-span-4 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                            />
                          </div>
                        )}
                      </div>

                      {/* Fair Account Restriction Section */}
                      <div className="p-2.5 rounded border border-rose-200 bg-rose-50/50 space-y-2">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-1.5 font-semibold text-rose-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(restrictPartnerMap[d.id])}
                              onChange={e =>
                                setRestrictPartnerMap(p => ({ ...p, [d.id]: e.target.checked }))
                              }
                            />
                            <span>Apply Documented Partner Account Restriction</span>
                          </label>
                          {restrictPartnerMap[d.id] && (
                            <label className="flex items-center gap-1.5 text-[11px] text-rose-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(urgentSafetyMap[d.id])}
                                onChange={e =>
                                  setUrgentSafetyMap(p => ({ ...p, [d.id]: e.target.checked }))
                                }
                              />
                              <span>Urgent Safety / Fraud Hold</span>
                            </label>
                          )}
                        </div>
                        {restrictPartnerMap[d.id] && (
                          <input
                            type="text"
                            value={restrictReasonMap[d.id] || ''}
                            onChange={e =>
                              setRestrictReasonMap(p => ({ ...p, [d.id]: e.target.value }))
                            }
                            placeholder="Written notice & contractual reason for partner restriction..."
                            className="w-full px-2.5 py-1 bg-white border border-rose-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const useComp = Boolean(enableCompMap[d.id]);
                            const amt = compAmountMap[d.id]?.trim()
                              ? Number(compAmountMap[d.id])
                              : 0;
                            const res = adminUpdateDispute(d.id, {
                              nextStatus: targetAdminStatus,
                              credibilityAssessment: adminCredibilityMap[d.id] || d.credibilityAssessment,
                              investigationFindings: adminFindingsMap[d.id] ?? d.investigationFindings,
                              adminDecision: adminDecisionMap[d.id] || d.adminDecision || 'partial_compensation',
                              decisionReason: adminReasonMap[d.id] ?? d.decisionReason,
                              contractualBasis: adminBasisMap[d.id] ?? d.contractualBasis,
                              compensation: useComp
                                ? {
                                    compensationType: compTypeMap[d.id] || 'partial_refund',
                                    responsibleParty: compPartyMap[d.id] || 'partner',
                                    approvedAmountInr: Number.isFinite(amt) ? amt : 0,
                                    valuationBasis: compValuationMap[d.id] || '',
                                    paymentResponsibility: compPayRespMap[d.id] || 'partner_direct_settlement',
                                  }
                                : undefined,
                              restrictPartnerAccount: Boolean(restrictPartnerMap[d.id]),
                              partnerRestrictionReason: restrictReasonMap[d.id],
                              urgentProtectiveAction: Boolean(urgentSafetyMap[d.id]),
                            });
                            showToast(res.success ? 'success' : 'error', res.message);
                          }}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer"
                        >
                          Record Decision & Update Claim
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Appeal Control (Customer or Partner on RESOLVED / REJECTED_WITH_REASON) */}
                  {(viewerRole === 'customer' || viewerRole === 'partner') && isResolvedOrRejected && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <input
                        type="text"
                        value={appealNoteMap[d.id] || ''}
                        onChange={e => setAppealNoteMap(p => ({ ...p, [d.id]: e.target.value }))}
                        placeholder="Disagree with this ruling? Request a second review with reason..."
                        className="flex-1 min-w-[220px] px-3 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const note = (appealNoteMap[d.id] || '').trim();
                          const res = appealDispute(
                            d.id,
                            note,
                            viewerRole === 'partner' ? 'partner' : 'customer'
                          );
                          showToast(res.success ? 'success' : 'error', res.message);
                          if (res.success) setAppealNoteMap(p => ({ ...p, [d.id]: '' }));
                        }}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded cursor-pointer flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Request Second Review (Appeal)</span>
                      </button>
                    </div>
                  )}

                  {/* Audit Trail Toggle */}
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setAuditOpenMap(p => ({ ...p, [d.id]: !p[d.id] }))
                      }
                      className="text-[11px] font-semibold text-slate-600 hover:text-[#0B132B] flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>
                        {auditOpenMap[d.id] ? 'Hide' : 'View'} Immutable Audit Log ({d.auditTrail?.length || 1} entries)
                      </span>
                    </button>

                    {auditOpenMap[d.id] && (
                      <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-slate-300 text-[11px]">
                        {(d.auditTrail && d.auditTrail.length > 0
                          ? d.auditTrail
                          : [
                              {
                                id: 'init',
                                timestamp: d.createdAt,
                                actorRole: 'CUSTOMER' as const,
                                actorName: d.customerName,
                                action: 'CLAIM_SUBMITTED',
                                note: d.description,
                              },
                            ]
                        ).map(entry => (
                          <div key={entry.id} className="bg-white p-2 rounded border border-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-1 text-slate-500">
                              <span className="font-bold text-[#0B132B]">
                                {entry.action} · {entry.actorName} ({entry.actorRole})
                              </span>
                              <span className="font-mono text-[10px]">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-slate-700 mt-0.5">{entry.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
