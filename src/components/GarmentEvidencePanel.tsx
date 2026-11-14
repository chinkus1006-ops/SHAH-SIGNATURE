import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GarmentConditionRecord, Order, normalizeOrderStatus } from '../types';
import { uploadFileToFirebaseStorage } from '../lib/firebaseClient';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  Tag,
  ShieldCheck,
  Upload,
  Check,
  Clock,
  FileWarning,
  Sparkles,
  Lock,
} from 'lucide-react';

interface GarmentEvidencePanelProps {
  order: Order;
  viewerRole: 'customer' | 'partner' | 'admin';
  onReportIssue?: (order: Order) => void;
}

const STAIN_OPTIONS = [
  'Collar / Cuff Ink',
  'Oil / Food Mark',
  'Color Bleed Risk',
  'Delicate Embroidery / Zari',
  'Missing Button Noted',
  'Loose Seam / Pre-Tear',
];

const CONDITION_OPTIONS: { value: GarmentConditionRecord['conditionAtPickup']; label: string }[] = [
  { value: 'intact', label: 'Intact / Good' },
  { value: 'pre_existing_stain', label: 'Pre-Existing Stain' },
  { value: 'pre_existing_tear', label: 'Pre-Existing Tear' },
  { value: 'delicate_trim', label: 'Delicate / Zari Trim' },
  { value: 'loose_button', label: 'Loose Button' },
];

function buildInitialGarmentRecords(order: Order): GarmentConditionRecord[] {
  if (order.garmentEvidence?.garmentRecords && order.garmentEvidence.garmentRecords.length > 0) {
    return order.garmentEvidence.garmentRecords;
  }
  return order.items.map((item, idx) => ({
    id: `gr_${order.id}_${idx}`,
    garmentId: item.garmentId,
    garmentName: item.name,
    category: order.serviceType,
    quantity: item.quantity,
    tagId: `TAG-${order.orderNumber}-${idx + 1}`,
    conditionAtPickup: 'intact',
    preExistingIssueNotes: '',
    specialHandlingCare: '',
  }));
}

export const GarmentEvidencePanel: React.FC<GarmentEvidencePanelProps> = ({
  order,
  viewerRole,
  onReportIssue,
}) => {
  const {
    recordGarmentEvidence,
    verifyHandoverOtp,
    customerSignOffEvidence,
    confirmOrderDeliveryByCustomer,
  } = useApp();

  const ev = order.garmentEvidence;
  const canonicalStatus = normalizeOrderStatus(order.status);
  const expectedCount = ev?.expectedCount ?? order.items.reduce((s, i) => s + i.quantity, 0);

  const [verifiedCount, setVerifiedCount] = useState<number>(ev?.verifiedCount ?? expectedCount);
  const [deliveredCount, setDeliveredCount] = useState<number>(
    ev?.deliveredCount ?? ev?.verifiedCount ?? expectedCount
  );
  const [hasDamage, setHasDamage] = useState<boolean>(ev?.hasPreExistingDamage ?? false);
  const [damageNotes, setDamageNotes] = useState<string>(ev?.damageNotes ?? '');
  const [selectedStains, setSelectedStains] = useState<string[]>(ev?.stainChecklist ?? []);
  const [customerInstructions, setCustomerInstructions] = useState<string>(
    ev?.customerInstructions ?? order.specialInstructions ?? ''
  );
  const [specialCareNotes, setSpecialCareNotes] = useState<string>(ev?.specialCareNotes ?? '');
  const [garmentRecords, setGarmentRecords] = useState<GarmentConditionRecord[]>(() =>
    buildInitialGarmentRecords(order)
  );

  const [pickupOtpInput, setPickupOtpInput] = useState('');
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingStage, setUploadingStage] = useState<
    'pickup' | 'before_service' | 'after_service' | 'delivery' | null
  >(null);

  const toggleStain = (label: string) => {
    setSelectedStains(prev =>
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  };

  const updateGarmentRecord = (
    idx: number,
    patch: Partial<GarmentConditionRecord>
  ) => {
    setGarmentRecords(prev => {
      const next = prev.map((rec, i) => (i === idx ? { ...rec, ...patch } : rec));
      const anyDamage = next.some(
        r => r.conditionAtPickup === 'pre_existing_stain' || r.conditionAtPickup === 'pre_existing_tear' || r.conditionAtPickup === 'loose_button'
      );
      if (anyDamage) setHasDamage(true);
      return next;
    });
  };

  const handleSaveInspection = (e: React.FormEvent) => {
    e.preventDefault();
    recordGarmentEvidence(order.id, {
      verifiedCount,
      deliveredCount:
        canonicalStatus === 'OUT_FOR_DELIVERY' || canonicalStatus === 'DELIVERED' || ev?.deliveredCount !== undefined
          ? deliveredCount
          : undefined,
      garmentRecords,
      hasPreExistingDamage: hasDamage,
      damageNotes: damageNotes.trim(),
      stainChecklist: selectedStains,
      customerInstructions: customerInstructions.trim(),
      specialCareNotes: specialCareNotes.trim(),
      recordedByPartnerId: order.assignedPartnerId,
    });
    setFeedback({
      type: 'success',
      text: 'Pickup, per-garment condition & special care evidence saved to audit trail.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleMarkServiceCompleted = () => {
    const nowIso = new Date().toISOString();
    recordGarmentEvidence(order.id, {
      serviceCompletedAt: nowIso,
      specialCareNotes: specialCareNotes.trim(),
      recordedByPartnerId: order.assignedPartnerId,
    });
    setFeedback({
      type: 'success',
      text: `Service completion timestamp logged (${new Date(nowIso).toLocaleTimeString()}).`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePhotoUpload = async (
    stage: 'pickup' | 'before_service' | 'after_service' | 'delivery',
    file?: File
  ) => {
    if (!file) return;
    setUploadingStage(stage);
    const res = await uploadFileToFirebaseStorage('garment_evidence', `${order.id}_${stage}`, file);
    const entryLabel = res.success && res.url ? res.url : `local-ref:${file.name}`;

    if (stage === 'pickup') {
      recordGarmentEvidence(order.id, {
        pickupPhotoUrls: [...(ev?.pickupPhotoUrls || []), entryLabel],
        recordedByPartnerId: order.assignedPartnerId,
      });
    } else if (stage === 'before_service') {
      recordGarmentEvidence(order.id, {
        beforeServicePhotoUrls: [...(ev?.beforeServicePhotoUrls || []), entryLabel],
        recordedByPartnerId: order.assignedPartnerId,
      });
    } else if (stage === 'after_service') {
      recordGarmentEvidence(order.id, {
        afterServicePhotoUrls: [...(ev?.afterServicePhotoUrls || []), entryLabel],
        recordedByPartnerId: order.assignedPartnerId,
      });
    } else {
      recordGarmentEvidence(order.id, {
        deliveryPhotoUrls: [...(ev?.deliveryPhotoUrls || []), entryLabel],
        recordedByPartnerId: order.assignedPartnerId,
      });
    }

    setUploadingStage(null);
    setFeedback({
      type: res.success ? 'success' : 'error',
      text: res.success
        ? `${stage.replace(/_/g, ' ')} photo uploaded securely.`
        : `Recorded "${file.name}" metadata (${res.error || 'Firebase Storage requires authenticated upload rules'}).`,
    });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleOtpSubmit = (stage: 'pickup' | 'delivery') => {
    const code = stage === 'pickup' ? pickupOtpInput : deliveryOtpInput;
    const res = verifyHandoverOtp(order.id, stage, code);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) {
      if (stage === 'pickup') setPickupOtpInput('');
      else setDeliveryOtpInput('');
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const countMismatch =
    typeof ev?.deliveredCount === 'number' &&
    ev.deliveredCount < (ev.verifiedCount ?? expectedCount);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B132B]">
            Garment Protection, Service Evidence & OTP Handover
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FAF7F0] border border-[#D4AF37]/40 text-[#0B132B] font-bold">
            <Tag className="w-3 h-3 text-[#AA7C11]" />
            {ev?.tagReference || `TAG-${order.orderNumber}`}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
            Pickup: {ev?.verifiedCount ?? expectedCount}/{expectedCount}
          </span>
          {typeof ev?.deliveredCount === 'number' && (
            <span
              className={`px-2 py-0.5 rounded font-semibold ${
                countMismatch
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Delivered: {ev.deliveredCount}/{ev?.verifiedCount ?? expectedCount}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500 text-[10px]"
            title="Evidence restricted to Customer, Assigned Partner & Super Admin"
          >
            <Lock className="w-2.5 h-2.5" />
            Private Evidence
          </span>
        </div>
      </div>

      {countMismatch && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Quantity Discrepancy Alert:</strong> {ev?.verifiedCount} picked up vs{' '}
              {ev?.deliveredCount} delivered. Customer may report missing garment immediately.
            </span>
          </div>
          {viewerRole === 'customer' && onReportIssue && (
            <button
              type="button"
              onClick={() => onReportIssue(order)}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px] shrink-0 cursor-pointer"
            >
              Report Missing Item
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`p-2.5 rounded-lg text-xs border flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Handover OTP Verification Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-[#F8F9FB] border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
              Pickup Handover OTP
            </span>
            {ev?.pickupOtpVerified ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Verified
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Pending Pickup
              </span>
            )}
          </div>

          {viewerRole === 'customer' || viewerRole === 'admin' ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Share with pickup valet:</span>
              <span className="font-mono text-base font-bold tracking-widest text-[#0B132B] bg-white px-2.5 py-0.5 rounded border border-slate-300">
                {order.pickupOtp || '----'}
              </span>
            </div>
          ) : (
            !ev?.pickupOtpVerified &&
            canonicalStatus !== 'CANCELLED' && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={4}
                  value={pickupOtpInput}
                  onChange={e => setPickupOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-digit Pickup OTP"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleOtpSubmit('pickup')}
                  className="px-3 py-1.5 bg-[#0B132B] hover:bg-black text-white font-bold rounded text-[11px] cursor-pointer"
                >
                  Verify & Pick Up
                </button>
              </div>
            )
          )}
        </div>

        <div className="p-3 rounded-lg bg-[#F8F9FB] border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
              Delivery Handover OTP
            </span>
            {ev?.deliveryOtpVerified ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Verified
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                Pending Delivery
              </span>
            )}
          </div>

          {viewerRole === 'customer' || viewerRole === 'admin' ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Share after inspecting items:</span>
              <span className="font-mono text-base font-bold tracking-widest text-[#0B132B] bg-white px-2.5 py-0.5 rounded border border-slate-300">
                {order.deliveryOtp || '----'}
              </span>
            </div>
          ) : (
            !ev?.deliveryOtpVerified &&
            ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(canonicalStatus) && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={4}
                  value={deliveryOtpInput}
                  onChange={e => setDeliveryOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-digit Delivery OTP"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleOtpSubmit('delivery')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] cursor-pointer"
                >
                  Verify & Deliver
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Partner View: Full Pickup + Service + Delivery Evidence Editor */}
      {viewerRole === 'partner' ? (
        <form onSubmit={handleSaveInspection} className="space-y-3 text-xs pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Pickup Garment Count
              </label>
              <input
                type="number"
                min={0}
                value={verifiedCount}
                onChange={e => setVerifiedCount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Delivered Garment Count
              </label>
              <input
                type="number"
                min={0}
                value={deliveredCount}
                onChange={e => setDeliveredCount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-900"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50 w-full cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDamage}
                  onChange={e => setHasDamage(e.target.checked)}
                  className="rounded text-[#0B132B]"
                />
                <span className="font-semibold text-slate-800">
                  Pre-existing stain/tear at pickup
                </span>
              </label>
            </div>
          </div>

          {/* Per-Garment Category & Condition Table */}
          {garmentRecords.length > 0 && (
            <div className="p-3 rounded-lg bg-[#F8F9FB] border border-slate-200 space-y-2">
              <div className="font-bold text-[#0B132B] text-[11px] uppercase tracking-wider">
                Item-Level Pickup Condition & Care Checklist
              </div>
              <div className="space-y-1.5">
                {garmentRecords.map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200"
                  >
                    <div className="sm:col-span-4 font-semibold text-slate-800">
                      {rec.garmentName} × {rec.quantity}{' '}
                      <span className="text-[10px] font-mono text-slate-400">({rec.tagId})</span>
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={rec.conditionAtPickup}
                        onChange={e =>
                          updateGarmentRecord(idx, {
                            conditionAtPickup: e.target.value as GarmentConditionRecord['conditionAtPickup'],
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] bg-white text-slate-900"
                      >
                        {CONDITION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={rec.preExistingIssueNotes || ''}
                        onChange={e => updateGarmentRecord(idx, { preExistingIssueNotes: e.target.value })}
                        placeholder="Pre-existing note / special care"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] text-slate-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {STAIN_OPTIONS.map(stain => {
              const active = selectedStains.includes(stain);
              return (
                <button
                  key={stain}
                  type="button"
                  onClick={() => toggleStain(stain)}
                  className={`px-2.5 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#0B132B] text-[#F3E5AB] border-[#0B132B]'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {active && <Check className="w-3 h-3 inline mr-1" />}
                  {stain}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Pre-Existing Damage / Condition Remarks
              </label>
              <input
                type="text"
                value={damageNotes}
                onChange={e => setDamageNotes(e.target.value)}
                placeholder="e.g. Pre-existing collar fray / silk pin noted"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Customer Instructions & Special Care
              </label>
              <input
                type="text"
                value={customerInstructions}
                onChange={e => setCustomerInstructions(e.target.value)}
                placeholder="e.g. Low steam, no starch on silk kurta"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Workshop Handling / Special Service Log
            </label>
            <input
              type="text"
              value={specialCareNotes}
              onChange={e => setSpecialCareNotes(e.target.value)}
              placeholder="e.g. Mild hydrocarbon spot treatment performed at 110°C steam finish"
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-900"
            />
          </div>

          {/* 4-Stage Photo Evidence Uploads & Service Completion Time */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold cursor-pointer">
                <Camera className="w-3.5 h-3.5 text-[#AA7C11]" />
                <span>{uploadingStage === 'pickup' ? 'Uploading...' : `Pickup (${ev?.pickupPhotoUrls.length || 0})`}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload('pickup', e.target.files?.[0])}
                />
              </label>

              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold cursor-pointer">
                <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                <span>
                  {uploadingStage === 'before_service'
                    ? 'Uploading...'
                    : `Before Service (${ev?.beforeServicePhotoUrls?.length || 0})`}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload('before_service', e.target.files?.[0])}
                />
              </label>

              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold cursor-pointer">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {uploadingStage === 'after_service'
                    ? 'Uploading...'
                    : `After Service (${ev?.afterServicePhotoUrls?.length || 0})`}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload('after_service', e.target.files?.[0])}
                />
              </label>

              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                <span>{uploadingStage === 'delivery' ? 'Uploading...' : `Delivery (${ev?.deliveryPhotoUrls.length || 0})`}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload('delivery', e.target.files?.[0])}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMarkServiceCompleted}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3 h-3" />
                <span>{ev?.serviceCompletedAt ? 'Update Service Time' : 'Log Service Completion'}</span>
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold rounded text-xs cursor-pointer"
              >
                Save Inspection Evidence
              </button>
            </div>
          </div>

          {ev?.serviceCompletedAt && (
            <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Service completed at {new Date(ev.serviceCompletedAt).toLocaleString()}</span>
            </div>
          )}
        </form>
      ) : (
        /* Customer & Admin Evidence View */
        <div className="pt-2 border-t border-slate-100 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600">
            <div className="p-3 bg-[#F8F9FB] rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-[#0B132B]">Pickup & Pre-Existing Condition</div>
              <div>
                <strong>Stain / Marks:</strong>{' '}
                {ev?.stainChecklist?.length
                  ? ev.stainChecklist.join(', ')
                  : ev?.hasPreExistingDamage
                  ? 'Pre-existing condition flagged'
                  : 'No pre-existing marks recorded'}
              </div>
              {ev?.damageNotes && (
                <div>
                  <strong>Notes:</strong> "{ev.damageNotes}"
                </div>
              )}
              {ev?.customerInstructions && (
                <div>
                  <strong>Customer Instructions:</strong> {ev.customerInstructions}
                </div>
              )}
              {ev?.garmentRecords && ev.garmentRecords.length > 0 && (
                <div className="pt-1 space-y-0.5 text-[11px]">
                  {ev.garmentRecords.map(r => (
                    <div key={r.id} className="flex justify-between">
                      <span>{r.garmentName} (×{r.quantity})</span>
                      <span className="font-mono text-slate-500">
                        {r.conditionAtPickup.replace(/_/g, ' ')}
                        {r.preExistingIssueNotes ? ` · ${r.preExistingIssueNotes}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-[#F8F9FB] rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-[#0B132B]">Service & Delivery Audit</div>
              <div>
                <strong>Photos Logged:</strong> Pickup ({ev?.pickupPhotoUrls.length || 0}) · Before ({ev?.beforeServicePhotoUrls?.length || 0}) · After ({ev?.afterServicePhotoUrls?.length || 0}) · Delivery ({ev?.deliveryPhotoUrls.length || 0})
              </div>
              {ev?.specialCareNotes && (
                <div>
                  <strong>Special Care:</strong> {ev.specialCareNotes}
                </div>
              )}
              {ev?.serviceCompletedAt && (
                <div>
                  <strong>Service Completed:</strong> {new Date(ev.serviceCompletedAt).toLocaleString()}
                </div>
              )}
              <div>
                <strong>Customer Confirmations:</strong>{' '}
                {ev?.customerSignOff ? 'Pickup Confirmed' : 'Pickup Sign-Off Pending'} ·{' '}
                {ev?.deliveryConfirmedByCustomer || ev?.deliveryOtpVerified
                  ? 'Delivery Confirmed'
                  : 'Delivery Confirmation Pending'}
              </div>
            </div>
          </div>

          {viewerRole === 'customer' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {ev?.customerSignOff ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pickup Condition Signed Off
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => customerSignOffEvidence(order.id)}
                    className="px-3.5 py-1.5 bg-[#0B132B] hover:bg-[#1C2541] text-[#F3E5AB] font-bold rounded text-xs cursor-pointer"
                  >
                    Confirm Pickup Condition ({ev?.verifiedCount ?? expectedCount} items)
                  </button>
                )}

                {(canonicalStatus === 'OUT_FOR_DELIVERY' || canonicalStatus === 'DELIVERED') &&
                  (ev?.deliveryConfirmedByCustomer || ev?.deliveryOtpVerified ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Delivery Receipt Confirmed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => confirmOrderDeliveryByCustomer(order.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs cursor-pointer"
                    >
                      Confirm Delivery Received
                    </button>
                  ))}
              </div>

              {onReportIssue && (
                <button
                  type="button"
                  onClick={() => onReportIssue(order)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold rounded text-xs cursor-pointer"
                >
                  <FileWarning className="w-3.5 h-3.5" />
                  <span>Report Missing / Damaged Item</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
