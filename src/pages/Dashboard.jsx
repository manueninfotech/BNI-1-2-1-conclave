import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2
} from 'lucide-react';

import { api } from '../services/api';
import { colors } from '../config/theme';
import { formatStatus } from '../utils/statusUtils';

export default function Dashboard({ setActiveTab, selectedConclaveId, setSelectedConclaveId, loggedInAdmin }) {
  const [referrals, setReferrals] = useState(() => {
    const stored = localStorage.getItem('bni_referrals');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    const sync = () => {
      const s = localStorage.getItem('bni_referrals');
      setReferrals(s ? JSON.parse(s) : []);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_admin_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [stats, setStats] = useState(() => {
    const cached = localStorage.getItem('bni_admin_stats_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch conclaves
  useEffect(() => {
    async function loadConclaves() {
      setIsLoading(false);
      try {
        const data = await api.get('/admin/conclaves');
        if (Array.isArray(data)) {
          setConclaves(data);
          localStorage.setItem('bni_admin_conclaves_cache', JSON.stringify(data));
        }
      } catch (err) {
        console.error("Failed to load conclaves:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConclaves();
  }, []);

  // Fetch stats for the selected conclave
  // Fetch stats & live referrals for the selected conclave
  useEffect(() => {
    if (!selectedConclaveId) return;
    async function loadStatsAndReferrals() {
      try {
        const [statsData, refData] = await Promise.all([
          api.get(`/admin/conclaves/${selectedConclaveId}/stats`).catch(() => null),
          api.get(`/admin/conclaves/${selectedConclaveId}/referrals`).catch(() => null)
        ]);

        if (statsData) {
          setStats(statsData);
          localStorage.setItem('bni_admin_stats_cache', JSON.stringify(statsData));
        }

        if (Array.isArray(refData)) {
          setReferrals(refData);
          localStorage.setItem('bni_referrals', JSON.stringify(refData));
        }
      } catch (err) {
        console.warn("Failed to load conclave stats/referrals:", err?.message || err);
      }
    }
    loadStatsAndReferrals();
  }, [selectedConclaveId]);


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

  // Top referral givers for this conclave
  const leaderboard = useMemo(() => {
    const counts = {};
    filteredReferrals.forEach(r => {
      const giverId = r.fromMemberId || r.fromUserId || r.fromName;
      const giverName = r.fromName || 'BNI Member';
      if (!giverId) return;
      if (!counts[giverId]) {
        counts[giverId] = { name: giverName, count: 0 };
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
      name: item.name.length > 12 ? item.name.substring(0, 10) + '...' : item.name,
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

  if (!selectedConclave) {
    return (
      <div className="space-y-6 sm:space-y-8 p-4 sm:p-8 max-w-[1600px] mx-auto w-full">
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

  const conclaveDate = useMemo(() => {
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

  const conclaveVenue = selectedConclave.venueLocation || selectedConclave.venue || selectedConclave.location || 'N/A';
  const conclaveProgress = (selectedConclave.status || '').toLowerCase() === 'completed' ? 100 : (selectedConclave.status || '').toLowerCase() === 'running' ? 60 : 0;

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-8 max-w-[1600px] mx-auto w-full">
      {/* Dashboard Top Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
            {selectedConclave.name || selectedConclave.title || 'Conclave Dashboard'}
          </h1>
          {(selectedConclave.status || '').toLowerCase() === 'running' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Running Live
            </span>
          ) : (selectedConclave.status || '').toLowerCase() === 'completed' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-250">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              {formatStatus(selectedConclave.status)}
            </span>
          )}
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

      {/* Live session active banner if running */}
      {(selectedConclave.status || '').toLowerCase() === 'running' && (
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-emerald-950">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
          <span><strong className="text-emerald-800 font-extrabold">Live Session Active:</strong> Table rounds are currently progressing in real time.</span>
        </div>
      )}

      {/* Unified Core Metrics Grid — Displayed ONCE */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Members */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Members</span>
            <span className="p-2 rounded-lg bg-red-50 text-brand-red">
              <Users className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalMembers}</span>
            <p className="text-[11px] text-zinc-400 font-semibold mt-1.5">
              {selectedConclave.memberLimit ? `of ${selectedConclave.memberLimit} capacity` : 'Enrolled Attendees'}
            </p>
          </div>
        </div>

        {/* Card 2: Captains */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-zinc-500 uppercase font-semibold">Table Captains</span>
            <span className="p-2 rounded-lg bg-red-50 text-brand-red">
              <Shield className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalCaptains}</span>
            <p className="text-[11px] text-zinc-400 font-semibold mt-1.5">
              {totalCaptains > 0 ? `${totalCaptains} Table Leads Assigned` : 'Table Anchors'}
            </p>
          </div>
        </div>

        {/* Card 3: Referrals */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-zinc-500 uppercase font-semibold">Referrals Exchanged</span>
            <span className="p-2 rounded-lg bg-red-50 text-brand-red">
              <Send className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-display-sm font-extrabold text-brand-red leading-none">{totalReferrals}</span>
            <p className="text-[11px] text-zinc-400 font-semibold mt-1.5">
              {connectedReferrals} Connected · {pendingReferrals} Pending
            </p>
          </div>
        </div>

        {/* Card 4: Conclave Progress */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-zinc-500 uppercase font-semibold">Conclave Progress</span>
            <span className="p-2 rounded-lg bg-zinc-100 text-zinc-600">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaveProgress}%</span>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                {(selectedConclave.status || '').toLowerCase() === 'completed' ? 'Finished' : (selectedConclave.status || '').toLowerCase() === 'running' ? 'Active' : 'Scheduled'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-100 mt-2 border border-zinc-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 to-brand-red transition-all duration-700"
                style={{ width: `${Math.max(conclaveProgress, 2)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Analytics: Referrals & Leaderboard */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Referrals Status & Pipeline Chart Card */}
        <div className="p-6 border border-zinc-200/80 rounded-xl bg-white shadow-sm hover:shadow-md transition-smooth flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-brand-red" />
                <h4 className="text-title-lg text-zinc-950 font-semibold">Referrals Status & Pipeline</h4>
              </div>
              <span className="text-label-xs text-zinc-400 font-bold uppercase tracking-wider">{selectedConclave.name}</span>
            </div>

            {/* Donut and Status breakdown */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
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
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Total</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2.5">
                <div className="flex justify-between items-center p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/80">
                  <span className="text-body-sm font-semibold text-emerald-900 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full"></span> Connected
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-950 text-body-md">{connectedReferrals}</span>
                    <span className="text-[9px] text-emerald-600 font-bold ml-1.5">
                      ({totalReferrals > 0 ? Math.round((connectedReferrals / totalReferrals) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-amber-50/50 rounded-lg border border-amber-100/80">
                  <span className="text-body-sm font-semibold text-amber-900 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-amber-500 rounded-full"></span> Pending
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-amber-950 text-body-md">{pendingReferrals}</span>
                    <span className="text-[9px] text-amber-600 font-bold ml-1.5">
                      ({totalReferrals > 0 ? Math.round((pendingReferrals / totalReferrals) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-red-50/40 rounded-lg border border-red-100/80">
                  <span className="text-body-sm font-semibold text-red-900 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-brand-red rounded-full"></span> Closed
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
            <div className="mt-5 pt-4 border-t border-zinc-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Referral Stages Comparison</span>
                <span className="text-[9px] font-semibold text-zinc-400">Activity Funnel</span>
              </div>
              <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={referralPipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                      {referralPipelineData.map((entry, index) => (
                        <Cell key={`pipe-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Top Referral Givers — Bar Chart & Leaderboard */}
        <div className="p-6 border border-zinc-200/80 rounded-xl bg-white shadow-sm hover:shadow-md transition-smooth flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-red" />
                <h4 className="text-title-lg text-zinc-950 font-semibold">Top Referral Givers</h4>
              </div>
              <span className="text-label-xs text-zinc-400 font-bold uppercase tracking-wider">Leaderboard</span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-zinc-50 border border-zinc-200 rounded-full flex items-center justify-center mb-3">
                  <Send className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-body-sm text-zinc-500 font-semibold">No referrals exchanged in this conclave yet.</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">Members who submit referrals during the conclave will automatically appear here with live metrics.</p>
              </div>
            ) : (
              <div>
                {/* Horizontal Bar Chart for Top Givers */}
                <div className="w-full h-44 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={leaderboardChartData}
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#27272a', fontWeight: 600 }}
                        width={85}
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
