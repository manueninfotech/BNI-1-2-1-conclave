import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {
  Users,
  Award,
  Calendar,
  Clock,
  ChevronRight,
  UserCheck,
  MapPin,
  Send,
  Shield,
  CheckCircle2,
  Handshake
} from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { colors } from '../config/theme';
import { formatStatus, getStatusBadgeClasses, getStatusDotClasses } from '../utils/statusUtils';
import { useConclaveReferrals } from '../hooks/useConclaveReferrals';

export default function Dashboard({ setActiveTab, selectedConclaveId, setSelectedConclaveId, loggedInAdmin, embedded = false }) {
  // TanStack React Query: Conclaves list
  const { data: conclaves = [], isLoading: isConclavesLoading } = useQuery({
    queryKey: ['conclaves'],
    queryFn: async () => {
      const data = await api.get('/admin/conclaves');
      return Array.isArray(data) ? data : [];
    },
  });

  // TanStack React Query: Conclave stats
  const { data: stats = null } = useQuery({
    queryKey: ['stats', selectedConclaveId],
    queryFn: async () => {
      if (!selectedConclaveId) return null;
      return await api.get(`/admin/conclaves/${selectedConclaveId}/stats`).catch(() => null);
    },
    enabled: Boolean(selectedConclaveId),
  });

  // TanStack React Query: Real-time Conclave Referrals
  const { data: referrals = [] } = useConclaveReferrals(selectedConclaveId);

  const isLoading = isConclavesLoading;


  const selectedConclave = useMemo(() => {
    if (conclaves.length === 0) return null;
    const found = conclaves.find(c => c.id === selectedConclaveId);
    return found || conclaves[0];
  }, [conclaves, selectedConclaveId]);

  // Filtered data based on selected conclave
  const totalMembers = useMemo(() => {
    if (stats) return stats.counts.registered;
    return 0;
  }, [stats]);

  const totalCaptains = useMemo(() => {
    if (stats) return stats.counts.captains;
    return 0;
  }, [stats]);


  const filteredReferrals = useMemo(() => {
    return referrals.filter(r => !r.conclaveId || r.conclaveId === selectedConclaveId);
  }, [referrals, selectedConclaveId]);

  const totalReferrals = useMemo(() => {
    return filteredReferrals.length || (stats ? stats.counts.referrals : 0);
  }, [stats, filteredReferrals]);

  const connectedReferrals = useMemo(() => {
    return filteredReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      return st === 'connected' || st === 'completed' || out === 'accepted';
    }).length;
  }, [filteredReferrals]);

  const closedReferrals = useMemo(() => {
    return filteredReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      return st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);
    }).length;
  }, [filteredReferrals]);

  const pendingReferrals = useMemo(() => {
    return filteredReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      const isConnected = st === 'connected' || st === 'completed' || out === 'accepted';
      const isClosed = st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);
      return !isConnected && !isClosed;
    }).length;
  }, [filteredReferrals]);

  const totalClosedAmount = useMemo(() => {
    return filteredReferrals.reduce((sum, r) => {
      const amt = Number(r.closedAmount || r.amount || 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [filteredReferrals]);

  const conversionRate = totalReferrals > 0 ? Math.round((closedReferrals / totalReferrals) * 100) : 0;
  const activeRate = totalReferrals > 0 ? Math.round(((connectedReferrals + closedReferrals) / totalReferrals) * 100) : 0;

  // Top referral givers for this conclave
  const leaderboard = useMemo(() => {
    const counts = {};
    filteredReferrals.forEach(r => {
      const giverId = r.fromMemberId || r.fromUserId || r.fromName;
      const rawName = r.fromName || 'BNI Member';
      const cleanName = rawName.replace(/\s*\(Active\)/gi, '').trim();
      if (!giverId) return;
      if (!counts[giverId]) {
        counts[giverId] = { name: cleanName, count: 0 };
      }
      counts[giverId].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredReferrals]);

  // Referral Status Distribution Data for Donut Chart
  const referralStatusData = useMemo(() => {
    const total = connectedReferrals + pendingReferrals + closedReferrals;
    if (total === 0) {
      return [{ name: 'No Referrals', value: 1, color: '#e4e4e7' }];
    }
    const data = [];
    if (connectedReferrals > 0) data.push({ name: 'Connected', value: connectedReferrals, color: '#10b981' });
    if (pendingReferrals > 0) data.push({ name: 'Pending', value: pendingReferrals, color: '#f59e0b' });
    if (closedReferrals > 0) data.push({ name: 'Closed', value: closedReferrals, color: colors.bniRed });
    return data;
  }, [connectedReferrals, pendingReferrals, closedReferrals]);

  // Referral Stages Comparison Data for Bar Chart
  const referralPipelineData = useMemo(() => [
    { stage: 'Total', count: totalReferrals, fill: '#64666A' },
    { stage: 'Connected', count: connectedReferrals, fill: '#10b981' },
    { stage: 'Pending', count: pendingReferrals, fill: '#f59e0b' },
    { stage: 'Closed', count: closedReferrals, fill: colors.bniRed }
  ], [totalReferrals, connectedReferrals, pendingReferrals, closedReferrals]);


  // Leaderboard data for horizontal Bar Chart
  const leaderboardChartData = useMemo(() => {
    if (leaderboard.length === 0) return [];
    return leaderboard.map(item => ({
      name: item.name,
      fullName: item.name,
      count: item.count
    }));
  }, [leaderboard]);

  // Status badge styles
  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase().replace(/[\s_-]/g, '');
    switch (s) {
      case 'running':
      case 'active': return 'bg-emerald-600 text-white';
      case 'upcoming':
      case 'registrationopen': return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'completed': return 'bg-zinc-100 text-zinc-600 border border-zinc-200';
      case 'draft': return 'bg-zinc-50 text-zinc-400 border border-zinc-200';
      default: return 'bg-zinc-50 text-zinc-500 border border-zinc-200';
    }
  };

  const displayStatus = (status) => {
    return formatStatus(status);
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Hooks must all run before the early "no conclave" return below.
  const conclaveDate = useMemo(() => {
    if (!selectedConclave) return '';
    if (selectedConclave.startDate && selectedConclave.endDate) {
      const s = new Date(selectedConclave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const e = new Date(selectedConclave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return s === e ? s : `${s} – ${e}`;
    }
    if (selectedConclave.date) {
      return new Date(selectedConclave.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return selectedConclave.dateRange || 'Date TBD';
  }, [selectedConclave]);

  if (!selectedConclave) {
    return (
      <div className="space-y-6 sm:space-y-8 max-w-[1600px] mx-auto w-full pb-10 sm:pb-14">
        {/* Page Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-6">
          <div>
            <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Admin Dashboard</h2>
            <p className="text-body-text text-zinc-500 mt-1">
              Welcome back, {loggedInAdmin?.name || 'Admin'}.
            </p>
          </div>
        </header>

        {/* Empty State Card */}
        <div className="bg-white rounded-xl border border-zinc-200/85 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-zinc-50 border border-zinc-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-base font-bold text-zinc-800">No Active Conclave Assigned</h3>
          <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto font-semibold leading-relaxed">
            There are currently no active conclaves in the database. Please navigate to the Conclaves tab to create one.
          </p>
        </div>
      </div>
    );
  }


  const conclaveVenue = selectedConclave.venueLocation || selectedConclave.venue || selectedConclave.location || 'N/A';
  // Progress = rounds run out of rounds planned (finished = 100%).
  const totalRounds = Number(selectedConclave.roundCount) || 0;
  const roundsRun = Number(selectedConclave.currentRound) || 0;
  const conclaveProgress = (selectedConclave.status || '').toLowerCase() === 'completed'
    ? 100
    : totalRounds > 0 ? Math.round((Math.min(roundsRun, totalRounds) / totalRounds) * 100) : 0;

  return (
    <div className={`space-y-3.5 sm:space-y-4 max-w-[1600px] mx-auto w-full ${embedded ? 'pt-0' : 'p-3 sm:p-5'}`}>
      {/* Dashboard Top Header (the conclave page shows its own) */}
      {!embedded && (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
              {selectedConclave.name || selectedConclave.title || 'Conclave Dashboard'}
            </h1>
            {(() => {
              const displayStatus = formatStatus(selectedConclave);
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs ${getStatusBadgeClasses(displayStatus)}`}>
                  <span className={`w-2 h-2 rounded-full ${getStatusDotClasses(displayStatus)}`} />
                  {displayStatus}
                </span>
              );
            })()}
          </div>

          {/* Clean metadata line */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 font-semibold mt-2">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-red" />
              <span>{conclaveVenue}</span>
            </span>
            <span className="text-zinc-300">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{conclaveDate}</span>
            </span>
            {selectedConclave.coordinator && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Coordinator: <strong className="text-zinc-800 font-bold">{selectedConclave.coordinator}</strong></span>
                </span>
              </>
            )}
            {selectedConclave.region && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-650 text-[11px] font-bold">
                  {selectedConclave.region}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Live session active banner if running */}
      {(selectedConclave.status || '').toLowerCase() === 'running' && (
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-emerald-950">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
          <span><strong className="text-emerald-800 font-extrabold">Live Session Active:</strong> Table rounds are currently progressing in real time.</span>
        </div>
      )}

      {/* Executive KPI Metric Strip (Feedback UI & Typography) */}
      <div className="bg-white border border-zinc-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-2 lg:grid-cols-4 shadow-xs">
        {/* KPI 1: Members */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
              Total Members
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{totalMembers}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Table Captains */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
              Table Captains
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{totalCaptains}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Referrals Exchanged */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
              Referrals Exchanged
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-brand-red tabular-nums">{totalReferrals}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Rounds */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
                Rounds
              </span>
              <span className="text-[10px] font-bold uppercase text-zinc-600 tracking-wider">
                {(selectedConclave.status || '').toLowerCase() === 'completed'
                  ? 'Finished'
                  : totalRounds > 0 ? `Round ${roundsRun} of ${totalRounds}` : 'Not started'}
              </span>
            </div>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{conclaveProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-zinc-100 border border-zinc-200/70">
              <div
                className="h-full rounded-full bg-brand-red transition-all duration-700"
                style={{ width: `${Math.max(conclaveProgress, 2)}%` }}
              />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytics: Referrals & Leaderboard */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-start">

        {/* Referrals Status & Pipeline Chart Card */}
        <div className="p-4 sm:p-5 border border-zinc-200/80 rounded-xl bg-white shadow-2xs hover:shadow-xs transition-smooth flex flex-col">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-brand-red" />
                <h4 className="text-title-lg text-zinc-950 font-semibold">Referrals Status & Pipeline</h4>
              </div>
              <span className="text-label-xs text-zinc-700 font-bold uppercase tracking-wider">{selectedConclave.name}</span>
            </div>

            {/* Donut and Status breakdown */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={referralStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={46}
                      outerRadius={62}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={referralStatusData.length > 1 ? 4 : 0}
                      stroke="none"
                    >
                      {referralStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} referrals`, name]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e4e4e7',
                        borderRadius: '0.5rem',
                        boxShadow: 'none',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-display-sm text-zinc-950 font-extrabold leading-none">{totalReferrals}</span>
                  <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-wider mt-1">Total</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/80">
                  <span className="text-body-sm font-semibold text-emerald-900 flex items-center gap-2">
                    <span className="h-2 w-2 bg-emerald-500 rounded-full"></span> Connected
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-950 text-body-md">{connectedReferrals}</span>
                    <span className="text-[9px] text-emerald-600 font-bold ml-1.5">
                      ({totalReferrals > 0 ? Math.round((connectedReferrals / totalReferrals) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-2 bg-amber-50/50 rounded-lg border border-amber-100/80">
                  <span className="text-body-sm font-semibold text-amber-900 flex items-center gap-2">
                    <span className="h-2 w-2 bg-amber-500 rounded-full"></span> Pending
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-amber-950 text-body-md">{pendingReferrals}</span>
                    <span className="text-[9px] text-amber-600 font-bold ml-1.5">
                      ({totalReferrals > 0 ? Math.round((pendingReferrals / totalReferrals) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-2 bg-red-50/40 rounded-lg border border-red-100/80">
                  <span className="text-body-sm font-semibold text-red-900 flex items-center gap-2">
                    <span className="h-2 w-2 bg-brand-red rounded-full"></span> Closed
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-red-950 text-body-md">{closedReferrals}</span>
                    <span className="text-[9px] text-red-600 font-bold ml-1.5">
                      ({totalReferrals > 0 ? Math.round((closedReferrals / totalReferrals) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Stages Comparison Bar Chart */}
            <div className="mt-3.5 pt-3 border-t border-zinc-100">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Referral Stages Comparison</span>
                <span className="text-[9px] font-semibold text-zinc-400">Activity Funnel</span>
              </div>
              <div className="w-full h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={referralPipelineData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                    <Tooltip
                      cursor={false}
                      formatter={(value) => [`${value} referrals`, 'Volume']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e4e4e7',
                        borderRadius: '0.5rem',
                        boxShadow: 'none',
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={26}>
                      {referralPipelineData.map((entry, index) => (
                        <Cell key={`pipe-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Conversion Metrics Footer */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 text-center">
              <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Conversion</span>
                <span className="text-sm font-extrabold text-zinc-900">{conversionRate}%</span>
              </div>
              <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Active Rate</span>
                <span className="text-sm font-extrabold text-emerald-700">{activeRate}%</span>
              </div>
              <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Closed Value</span>
                <span className="text-sm font-extrabold text-brand-red">
                  {totalClosedAmount > 0 ? `₹${totalClosedAmount.toLocaleString('en-IN')}` : '₹0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Referral Givers — Bar Chart & Leaderboard */}
        <div className="p-4 sm:p-5 border border-zinc-200/80 rounded-xl bg-white shadow-2xs hover:shadow-xs transition-smooth flex flex-col">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-red" />
                <h4 className="text-title-lg text-zinc-950 font-semibold">Top Referral Givers</h4>
              </div>
              <span className="text-label-xs text-zinc-700 font-bold uppercase tracking-wider">Leaderboard</span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 bg-zinc-50 border border-zinc-200 rounded-full flex items-center justify-center mb-2.5">
                  <Send className="w-4 h-4 text-zinc-400" />
                </div>
                <p className="text-body-sm text-zinc-500 font-semibold">No referrals exchanged in this conclave yet.</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">Members who submit referrals during the conclave will automatically appear here with live metrics.</p>
              </div>
            ) : (
              <div>
                {/* Horizontal Bar Chart for Top Givers */}
                <div className="w-full h-40 mb-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={leaderboardChartData}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tick={{ fontSize: 11, fill: '#27272a', fontWeight: 600 }}
                        tickFormatter={(val) => {
                          const s = String(val || '');
                          return s.length > 16 ? s.slice(0, 15) + '…' : s;
                        }}
                        width={115}
                      />
                      <Tooltip
                        cursor={false}
                        formatter={(value, _, item) => [`${value} referrals`, item.payload.fullName]}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#e4e4e7',
                          borderRadius: '0.5rem',
                          boxShadow: 'none',
                        }}
                      />
                      <Bar dataKey="count" fill={colors.bniRed} radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Ranked List */}
                <div className="space-y-1.5 pt-3 border-t border-zinc-100 max-h-48 overflow-y-auto">
                  {leaderboard.map((person, idx) => (
                    <div key={person.name + idx} className="flex items-center justify-between py-1.5 px-2.5 hover:bg-zinc-50 rounded-lg transition-smooth border border-transparent hover:border-zinc-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border ${idx === 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : idx === 1 ? 'bg-zinc-200 text-zinc-800 border-zinc-300' : idx === 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-body-sm font-semibold text-zinc-900 leading-tight">{person.name}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-body-sm font-extrabold text-brand-red">{person.count}</span>
                        <span className="text-[9px] text-zinc-400 font-semibold uppercase block tracking-wider mt-0.5">Referrals</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
