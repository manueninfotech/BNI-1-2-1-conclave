import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  RefreshCw, TrendingUp, IndianRupee, CheckCircle2, XCircle, Receipt, AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';

/**
 * Superadmin revenue — fed by the Razorpay webhook ledger.
 * GET /admin/revenue            → totals, per-conclave, daily time series
 * GET /admin/revenue/transactions → recent payments (live feed)
 */

// Status colors are RESERVED and always paired with an icon + label (never
// color-alone), so the green/red captured-vs-failed split survives CVD.
const C_CAPTURED = '#059669'; // emerald-600 (good)
const C_FAILED = '#dc2626';   // red-600 (critical)
const C_REVENUE = '#C41230';  // brand red — single-series magnitude-over-time

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Revenue() {
  const [data, setData] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rev, tx] = await Promise.all([
        api.get('/admin/revenue'),
        api.get('/admin/revenue/transactions?limit=50').catch(() => ({ items: [] })),
      ]);
      setData(rev);
      setTxns(tx.items || []);
    } catch (err) {
      console.error('Failed to load revenue:', err);
      setError(err.message || 'Could not load revenue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load();   }, []);

  const series = useMemo(
    () => (data?.timeSeries || []).map((d) => ({ date: d.date, revenue: d.revenue })),
    [data]
  );

  const statusData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Captured', value: data.capturedCount || 0, color: C_CAPTURED },
      { name: 'Failed', value: data.failedCount || 0, color: C_FAILED },
    ].filter((d) => d.value > 0);
  }, [data]);

  const maxConclaveRev = useMemo(
    () => Math.max(1, ...((data?.byConclave || []).map((c) => c.revenue))),
    [data]
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1300px] mx-auto w-full flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="border-b border-zinc-100 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Revenue</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Real-time registration payments across all conclaves, from the Razorpay webhook.
          </p>
        </div>
        <button
          onClick={load}
          type="button"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-bold">{error}</div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Kpi icon={<IndianRupee className="w-4 h-4" />} label="Total revenue" value={inr(data.totalRevenue)}
              sub={data.refundedTotal ? `${inr(data.refundedTotal)} refunded` : 'net of refunds'} accent="brand" />
            <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Captured" value={data.capturedCount}
              sub="successful payments" accent="emerald" />
            <Kpi icon={<XCircle className="w-4 h-4" />} label="Failed" value={data.failedCount}
              sub="failed attempts" accent="red" />
            <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Success rate"
              value={data.successRate != null ? `${Math.round(data.successRate * 100)}%` : '—'}
              sub="captured ÷ attempts" accent="zinc" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue over time — single hue, area */}
            <div className="lg:col-span-2 bg-white border border-zinc-200/80 rounded-xl shadow-sm p-5">
              <h3 className="text-[13px] font-extrabold text-zinc-800 mb-4">Revenue over time</h3>
              {series.length === 0 ? (
                <Empty>No captured payments yet.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C_REVENUE} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={C_REVENUE} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1f1f3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false}
                      tickFormatter={(d) => (d || '').slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₹${v}`} width={48} />
                    <Tooltip
                      formatter={(v) => [inr(v), 'Revenue']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', fontSize: 12, fontWeight: 600 }} />
                    <Area type="monotone" dataKey="revenue" stroke={C_REVENUE} strokeWidth={2}
                      fill="url(#revFill)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Captured vs failed — status donut with labels + icons */}
            <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm p-5 flex flex-col">
              <h3 className="text-[13px] font-extrabold text-zinc-800 mb-2">Payment outcomes</h3>
              {statusData.length === 0 ? (
                <Empty>No payments yet.</Empty>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64}
                        paddingAngle={2} stroke="#fff" strokeWidth={2}>
                        {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', fontSize: 12, fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend: color + icon + label, so identity is never color-alone */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <LegendRow icon={<CheckCircle2 className="w-3.5 h-3.5" style={{ color: C_CAPTURED }} />}
                      label="Captured" value={data.capturedCount} />
                    <LegendRow icon={<XCircle className="w-3.5 h-3.5" style={{ color: C_FAILED }} />}
                      label="Failed" value={data.failedCount} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Per-conclave breakdown */}
          <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm p-5">
            <h3 className="text-[13px] font-extrabold text-zinc-800 mb-4">Revenue by conclave</h3>
            {(!data.byConclave || data.byConclave.length === 0) ? (
              <Empty>No revenue recorded yet.</Empty>
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.byConclave.map((c) => (
                  <div key={c.conclaveId} className="flex items-center gap-3">
                    <div className="w-40 sm:w-56 shrink-0 text-[12px] font-bold text-zinc-700 truncate" title={c.name}>{c.name}</div>
                    <div className="flex-1 h-5 bg-zinc-100 rounded-md overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${(c.revenue / maxConclaveRev) * 100}%`, background: C_REVENUE }} />
                    </div>
                    <div className="w-24 text-right text-[12px] font-extrabold text-zinc-900">{inr(c.revenue)}</div>
                    <div className="w-28 text-right text-[10.5px] font-semibold text-zinc-400">
                      {c.payments} paid{c.failed ? ` · ${c.failed} failed` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm">
            <div className="p-5 pb-3 flex items-center gap-2 border-b border-zinc-100">
              <Receipt className="w-4 h-4 text-zinc-400" />
              <h3 className="text-[13px] font-extrabold text-zinc-800">Recent transactions</h3>
            </div>
            {txns.length === 0 ? (
              <div className="p-6"><Empty>No transactions yet.</Empty></div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {txns.map((t) => (
                  <div key={t.paymentId} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-zinc-800 truncate">{t.email || t.contact || t.paymentId}</p>
                      <p className="text-[10.5px] text-zinc-400 truncate">
                        {t.conclaveName}{t.createdAt ? ` · ${new Date(t.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[13px] font-extrabold text-zinc-900">{inr(t.amount)}</span>
                      <StatusPill status={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }) {
  const tone = {
    brand: 'text-brand-red', emerald: 'text-emerald-600', red: 'text-red-600', zinc: 'text-zinc-700',
  }[accent] || 'text-zinc-700';
  return (
    <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm">
      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1">
        <span className={tone}>{icon}</span> {label}
      </p>
      <h4 className="text-headline-md font-extrabold text-zinc-900 mt-1">{value}</h4>
      <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">{sub}</p>
    </div>
  );
}

function LegendRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between text-[11.5px]">
      <span className="flex items-center gap-1.5 font-bold text-zinc-600">{icon}{label}</span>
      <span className="font-extrabold text-zinc-900">{value}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    captured: ['bg-emerald-50 border-emerald-200 text-emerald-700', <CheckCircle2 className="w-3 h-3" key="i" />, 'Captured'],
    failed: ['bg-red-50 border-red-200 text-red-700', <XCircle className="w-3 h-3" key="i" />, 'Failed'],
    refunded: ['bg-amber-50 border-amber-200 text-amber-700', <AlertTriangle className="w-3 h-3" key="i" />, 'Refunded'],
  };
  const [cls, icon, label] = map[status] || ['bg-zinc-50 border-zinc-200 text-zinc-600', null, status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${cls}`}>
      {icon}{label}
    </span>
  );
}

function Empty({ children }) {
  return <p className="text-[12px] text-zinc-400 font-semibold text-center py-8">{children}</p>;
}
