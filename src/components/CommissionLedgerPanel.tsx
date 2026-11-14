import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Upload,
  Download,
  IndianRupee,
} from 'lucide-react';

interface CommissionLedgerPanelProps {
  viewerRole: 'partner' | 'admin';
  partnerId?: string;
}

export const CommissionLedgerPanel: React.FC<CommissionLedgerPanelProps> = ({
  viewerRole,
  partnerId,
}) => {
  const {
    commissionLedger,
    remittances,
    partners,
    settings,
    businessSettings,
    submitPartnerRemittance,
    verifyPartnerRemittance,
    togglePartnerCommissionBlock,
  } = useApp();

  const [utrRef, setUtrRef] = useState('');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'IMPS' | 'NEFT' | 'BANK_TRANSFER'>('UPI');
  const [proofFileName, setProofFileName] = useState('');
  const [remitNotes, setRemitNotes] = useState('');
  const [alertMsg, setAlertMsg] = useState('');

  const filteredEntries =
    viewerRole === 'admin'
      ? commissionLedger
      : commissionLedger.filter(e => e.partnerId === partnerId);

  const totalEarnedCommission = filteredEntries.reduce((s, e) => s + e.commissionAmount, 0);
  const commissionReceived = filteredEntries
    .filter(e => e.remittanceStatus === 'verified')
    .reduce((s, e) => s + e.commissionAmount, 0);
  const commissionOutstanding = filteredEntries
    .filter(e => e.remittanceStatus === 'unpaid' || e.remittanceStatus === 'submitted')
    .reduce((s, e) => s + e.commissionAmount, 0);
  const commissionOverdue = filteredEntries
    .filter(e => e.remittanceStatus === 'overdue')
    .reduce((s, e) => s + e.commissionAmount, 0);

  const unpaidEntriesForPartner = filteredEntries.filter(
    e => e.remittanceStatus === 'unpaid' || e.remittanceStatus === 'overdue'
  );
  const dueNowAmount = unpaidEntriesForPartner.reduce((s, e) => s + e.commissionAmount, 0);

  const activePartnerObj = partners.find(p => p.id === partnerId);

  const handleSubmitRemittance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || unpaidEntriesForPartner.length === 0 || !utrRef.trim()) return;

    submitPartnerRemittance({
      partnerId,
      weekKey: unpaidEntriesForPartner[0].weekKey,
      ledgerEntryIds: unpaidEntriesForPartner.map(e => e.id),
      amountSubmitted: dueNowAmount,
      utrReference: utrRef.trim(),
      paymentMode,
      proofFileName: proofFileName.trim() || undefined,
      notes: remitNotes.trim() || undefined,
    });

    setUtrRef('');
    setProofFileName('');
    setRemitNotes('');
    setAlertMsg('Commission remittance UTR submitted to Super Admin for verification.');
    setTimeout(() => setAlertMsg(''), 4000);
  };

  const handleExportLedgerCsv = () => {
    const headers = ['Order Number', 'Partner', 'Week', 'Order Total', 'Rate (%)', '15% Commission', 'Partner Net Share', 'Status', 'UTR', 'Due Date'];
    const rows = filteredEntries.map(e => [
      e.orderNumber,
      `"${e.partnerName}"`,
      e.weekKey,
      e.orderTotal,
      e.commissionRate,
      e.commissionAmount,
      e.partnerNetShare,
      e.remittanceStatus,
      e.utrReference || '-',
      e.dueDate,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `SHAH_SIGNATURE_Commission_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {alertMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Partner Overdue / Blocked Warning */}
      {viewerRole === 'partner' && activePartnerObj?.commissionBlocked && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-center gap-3">
          <Lock className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong>Dispatch Temporarily Locked:</strong> Weekly {settings.platformCommissionPercent}% commission remittance is overdue. Submit your UTR payment reference below to restore live order dispatch.
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-slate-500 uppercase tracking-wider text-[11px]">
            Commission Earned ({settings.platformCommissionPercent}%)
          </div>
          <div className="text-2xl font-bold font-mono text-[#0B132B] mt-1 tabular-nums">
            ₹{totalEarnedCommission}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-slate-500 uppercase tracking-wider text-[11px]">Commission Received</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            ₹{commissionReceived}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-slate-500 uppercase tracking-wider text-[11px]">Commission Outstanding</div>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
            ₹{commissionOutstanding}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-slate-500 uppercase tracking-wider text-[11px]">Overdue Commission</div>
          <div className="text-2xl font-bold font-mono text-rose-600 mt-1 tabular-nums">
            ₹{commissionOverdue}
          </div>
        </div>
      </div>

      {/* Direct-to-Partner Payment & Weekly Remittance Submission (Partner View) */}
      {viewerRole === 'partner' && (
        <div className="bg-[#FAF7F0] rounded-xl border border-[#D4AF37]/40 p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D4AF37]/30">
            <div>
              <h4 className="font-bold text-[#0B132B] text-sm flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#AA7C11]" />
                <span>Direct-to-Partner Settlement & Weekly {settings.platformCommissionPercent}% Remittance</span>
              </h4>
              <p className="text-slate-600 mt-0.5">
                Customers pay 100% directly to your UPI (<strong>{activePartnerObj?.upiId || 'Update UPI in profile'}</strong>) or cash at delivery. You retain {100 - settings.platformCommissionPercent}% and remit {settings.platformCommissionPercent}% weekly.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500">Platform Remittance UPI:</span>
              <div className="font-mono font-bold text-[#0B132B]">
                {businessSettings.platformUpiId || 'shahsignature@okicici'}
              </div>
            </div>
          </div>

          {dueNowAmount > 0 ? (
            <form onSubmit={handleSubmitRemittance} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Amount (INR)</label>
                <div className="px-3 py-2 bg-white border border-slate-300 rounded font-mono font-bold text-[#0B132B]">
                  ₹{dueNowAmount} ({unpaidEntriesForPartner.length} orders)
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                >
                  <option value="UPI">UPI</option>
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">UTR / Transaction Reference *</label>
                <input
                  type="text"
                  required
                  value={utrRef}
                  onChange={e => setUtrRef(e.target.value)}
                  placeholder="e.g. UTR6291048821"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono text-slate-900"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0B132B] hover:bg-black text-[#F3E5AB] font-bold rounded cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Submit UTR</span>
              </button>
            </form>
          ) : (
            <div className="text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All due commission entries have been remitted or verified.</span>
            </div>
          )}
        </div>
      )}

      {/* Admin UTR Verification Queue */}
      {viewerRole === 'admin' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-bold font-brand text-base text-[#0B132B] flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-[#D4AF37]" />
                <span>Weekly Commission UTR Remittances & Partner Compliance</span>
              </h4>
              <p className="text-xs text-slate-500">
                Verify bank/UPI UTR receipts submitted by partners or lock/unlock overdue accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportLedgerCsv}
              className="px-3 py-1.5 bg-[#0B132B] text-[#F3E5AB] rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger CSV</span>
            </button>
          </div>

          {remittances.length === 0 ? (
            <div className="text-xs text-slate-400 py-4">No partner UTR remittance submissions yet.</div>
          ) : (
            <div className="space-y-2 text-xs">
              {remittances.map(rem => (
                <div
                  key={rem.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-[#0B132B]">
                      {rem.partnerName} · ₹{rem.amountSubmitted} ({rem.paymentMode})
                    </div>
                    <div className="font-mono text-[11px] text-slate-600">
                      UTR: {rem.utrReference} · Week: {rem.weekKey} · Orders: {rem.ledgerEntryIds.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        rem.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rem.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rem.status.replace('_', ' ')}
                    </span>
                    {rem.status === 'pending_verification' && (
                      <>
                        <button
                          type="button"
                          onClick={() => verifyPartnerRemittance(rem.id, 'verified', 'UTR matched in bank statement')}
                          className="px-3 py-1 bg-emerald-600 text-white font-bold rounded cursor-pointer"
                        >
                          Verify UTR
                        </button>
                        <button
                          type="button"
                          onClick={() => verifyPartnerRemittance(rem.id, 'rejected', 'UTR not found in statement')}
                          className="px-3 py-1 bg-rose-600 text-white font-bold rounded cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Partner Block/Unblock quick controls */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2">Partner Commission Access Controls:</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {partners.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePartnerCommissionBlock(p.id, !p.commissionBlocked)}
                  className={`px-3 py-1.5 rounded border font-semibold flex items-center gap-1.5 cursor-pointer ${
                    p.commissionBlocked
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {p.commissionBlocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>
                    {p.name}: {p.commissionBlocked ? 'Blocked (Click to Unblock)' : 'Cleared'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order-by-Order Commission Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h4 className="font-bold font-brand text-sm text-[#0B132B]">
          Order-Level {settings.platformCommissionPercent}% Commission Breakdown ({filteredEntries.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="p-2.5">Order</th>
                <th className="p-2.5">Partner</th>
                <th className="p-2.5">Week</th>
                <th className="p-2.5">Gross</th>
                <th className="p-2.5">15% Fee</th>
                <th className="p-2.5">Partner Net</th>
                <th className="p-2.5">Status / UTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredEntries.map(entry => (
                <tr key={entry.id}>
                  <td className="p-2.5 font-bold text-[#0B132B]">{entry.orderNumber}</td>
                  <td className="p-2.5 font-sans text-slate-700">{entry.partnerName}</td>
                  <td className="p-2.5 text-slate-500">{entry.weekKey}</td>
                  <td className="p-2.5">₹{entry.orderTotal}</td>
                  <td className="p-2.5 font-bold text-amber-700">₹{entry.commissionAmount}</td>
                  <td className="p-2.5 font-bold text-emerald-700">₹{entry.partnerNetShare}</td>
                  <td className="p-2.5 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        entry.remittanceStatus === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : entry.remittanceStatus === 'submitted'
                          ? 'bg-sky-100 text-sky-800'
                          : entry.remittanceStatus === 'overdue'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {entry.remittanceStatus}
                    </span>
                    {entry.utrReference && (
                      <span className="ml-1.5 text-slate-500 font-mono">({entry.utrReference})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
