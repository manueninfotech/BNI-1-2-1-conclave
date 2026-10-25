import React, { useState, useEffect } from 'react';
import {
  RefreshCw, CheckCircle2, Clock, XCircle, CreditCard, Users as UsersIcon,
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Per-conclave member payment status (any conclave admin).
 * GET /admin/conclaves/:id/payments → { counts, members[], failedAttempts[] }
 * Paid/pending come from registrations; failed attempts come from the webhook
 * ledger (members who tried to pay and couldn't, so never registered).
 */
export default function Payments({ selectedConclaveId }) {
  const [data, setData] = useState(null);
  const [conclaveName, setConclaveName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    if (!selectedConclaveId) return;
    setLoading(true);
    setError(null);
    try {
      const [pay, full] = await Promise.all([
        api.get(`/admin/conclaves/${selectedConclaveId}/payments`),
        api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null),
      ]);
      setData(pay);
      if (full) setConclaveName(full.name || '');
    } catch (err) {
      console.error('Failed to load payments:', err);
      setError(err.message || 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load();   }, [selectedConclaveId]);

  if (!selectedConclaveId) {
    return <div className="p-8 text-center text-zinc-400 font-semibold">Select a conclave to see its payments.</div>;
  }

  const counts = data?.counts || { paid: 0, pending: 0, failed: 0, total: 0 };
  const members = (data?.members || []).filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [m.name, m.email, m.phone].some((v) => (v || '').toLowerCase().includes(q));
  });
  const failed = data?.failedAttempts || [];

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="border-b border-zinc-100 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Payments</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Each member's registration payment for <span className="font-bold text-brand-red">{conclaveName || 'this conclave'}</span>.
          </p>
        </div>
        <button onClick={load} type="button"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer">
          <RefreshCw className={`w-4 h-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-bold">{error}</div>}

      {/* Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Count icon={<CheckCircle2 className="w-4 h-4" />} label="Paid" value={counts.paid} tone="emerald" />
        <Count icon={<Clock className="w-4 h-4" />} label="Pending" value={counts.pending} tone="amber" />
        <Count icon={<XCircle className="w-4 h-4" />} label="Failed" value={counts.failed} tone="red" />
        <Count icon={<UsersIcon className="w-4 h-4" />} label="Registered" value={counts.total} tone="zinc" />
      </div>

      {/* Search */}
      <input
        type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search member by name, email or phone…"
        className="w-full sm:w-80 px-4 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
      />

      {/* Members table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 text-[13px] font-extrabold text-zinc-800">Registered members</div>
        {members.length === 0 ? (
          <p className="text-[12px] text-zinc-400 font-semibold text-center py-8">
            {loading ? 'Loading…' : 'No members found.'}
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {members.map((m) => (
              <div key={m.uid} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 flex items-center justify-center font-black text-[10px] shrink-0">
                    {(m.name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-zinc-800 truncate">{m.name || 'Member'}</p>
                    <p className="text-[10.5px] text-zinc-400 truncate">{m.email || m.phone || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.amount != null && <span className="text-[12px] font-extrabold text-zinc-900">₹{m.amount}</span>}
                  {m.paymentMethod && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                      <CreditCard className="w-3 h-3" />{m.paymentMethod}
                    </span>
                  )}
                  <PayPill status={m.paymentStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failed attempts — from the webhook ledger (tried but never registered) */}
      {failed.length > 0 && (
        <div className="bg-white border border-red-200/70 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-red-100 text-[13px] font-extrabold text-red-700 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Failed payment attempts ({failed.length})
          </div>
          <div className="divide-y divide-red-50">
            {failed.map((f, i) => (
              <div key={f.paymentId || i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold text-zinc-800 truncate">{f.email || f.phone || f.paymentId}</p>
                  <p className="text-[10.5px] text-red-500 truncate">{f.errorDescription || 'Payment failed'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {f.amount != null && <span className="text-[12px] font-extrabold text-zinc-700">₹{f.amount}</span>}
                  <PayPill status="failed" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Count({ icon, label, value, tone }) {
  const t = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', zinc: 'text-zinc-700' }[tone];
  return (
    <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm">
      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><span className={t}>{icon}</span>{label}</p>
      <h4 className="text-headline-md font-extrabold text-zinc-900 mt-1">{value}</h4>
    </div>
  );
}

function PayPill({ status }) {
  const map = {
    paid: ['bg-emerald-50 border-emerald-200 text-emerald-700', <CheckCircle2 className="w-3 h-3" key="i" />, 'Paid'],
    pending: ['bg-amber-50 border-amber-200 text-amber-700', <Clock className="w-3 h-3" key="i" />, 'Pending'],
    failed: ['bg-red-50 border-red-200 text-red-700', <XCircle className="w-3 h-3" key="i" />, 'Failed'],
  };
  const [cls, icon, label] = map[status] || ['bg-zinc-50 border-zinc-200 text-zinc-600', null, status || 'Unknown'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${cls}`}>
      {icon}{label}
    </span>
  );
}
