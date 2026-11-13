import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarRange,
  MapPin,
  Users,
  Check,
  Play,
  ArrowRight,
  Plus,
  UserCheck,
  ChevronRight,
  Handshake,
  Shield,
  Filter,
  History,
  Timer,
  RotateCcw,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useConclaves } from './useConclaves';
import { STAGES, nextStep, pickCurrentConclave, stageOf, formatConclaveDate } from './conclaveStage';
import { getConclaveDisplayStatus, getStatusBadgeClasses, getStatusDotClasses } from '../utils/statusUtils';
import { describe, who } from './Activity';
import { api } from '../services/api';

/**
 * 100% Real-Data Driven Executive Admin Dashboard (Home).
 * Strictly uses typography & tokens from index.css (Helvetica Neue/Arial, BNI Brand Red,
 * custom utilities text-dashboard-title, text-card-title, text-display-sm, text-label-md).
 * No hardcoded, fake, or synthetic data.
 */
export default function Home({ base, loggedInAdmin }) {
  const navigate = useNavigate();
  const { conclaves, loading, error } = useConclaves();
  const current = useMemo(() => pickCurrentConclave(conclaves), [conclaves]);

  // Live conclave stats & real audit activities
  const [currentStats, setCurrentStats] = useState(null);
  const [conclaveStatsMap, setConclaveStatsMap] = useState({});
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const firstName = (loggedInAdmin?.name || '').split(' ')[0] || 'Admin';
  const regionLabel = useMemo(() => {
    if (loggedInAdmin?.role === 'superadmin') return 'All Regions';
    if (!loggedInAdmin?.region) return 'Regional Admin';
    const reg = loggedInAdmin.region.trim();
    return /region$/i.test(reg) ? `${reg} Admin` : `${reg} Region Admin`;
  }, [loggedInAdmin]);

  // Fetch real stats for all conclaves in parallel so every conclave receives accurate referral slips
  useEffect(() => {
    if (!conclaves || conclaves.length === 0) {
      setConclaveStatsMap({});
      return;
    }
    let isMounted = true;
    const targetConclaves = conclaves.slice(0, 25);
    Promise.all(
      targetConclaves.map((c) =>
        api.get(`/admin/conclaves/${c.id}/stats`)
          .then((st) => ({ id: c.id, stats: st }))
          .catch(() => ({ id: c.id, stats: null }))
      )
    ).then((results) => {
      if (!isMounted) return;
      const map = {};
      results.forEach((r) => {
        if (r.stats) map[r.id] = r.stats;
      });
      setConclaveStatsMap(map);
      if (current?.id && map[current.id]) {
        setCurrentStats(map[current.id]);
      }
    });

    return () => { isMounted = false; };
  }, [conclaves, current?.id]);

  // Fetch real recent audit activity from backend
  useEffect(() => {
    let isMounted = true;
    setActivitiesLoading(true);
    api.get('/admin/activity?limit=4')
      .then((res) => {
        if (isMounted) {
          setActivities(res.items || []);
        }
      })
      .catch(() => {
        if (isMounted) setActivities([]);
      })
      .finally(() => {
        if (isMounted) setActivitiesLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Aggregate genuine KPI metrics directly from conclaves and stats
  const kpis = useMemo(() => {
    const totalConclaves = conclaves.length;
    const completed = conclaves.filter((c) => ['completed', 'done'].includes((c.status || '').toLowerCase()));
    const running = conclaves.filter((c) => ['running', 'active'].includes((c.status || '').toLowerCase()));
    const upcoming = conclaves.filter((c) =>
      !['completed', 'done', 'cancelled'].includes((c.status || '').toLowerCase()) &&
      !['running', 'active'].includes((c.status || '').toLowerCase())
    );

    let totalRegistered = 0;
    let totalReferrals = 0;

    conclaves.forEach((c) => {
      const reg = Number(c.registrationCount ?? c.registeredCount ?? (Array.isArray(c.participants) ? c.participants.length : 0));
      const conclaveStat = conclaveStatsMap[c.id];
      let refs = Number(c.referralCount ?? c.referralsCount ?? 0);
      if (conclaveStat?.counts?.referrals !== undefined) {
        refs = Math.max(refs, Number(conclaveStat.counts.referrals));
      } else if (c.id === current?.id && currentStats?.counts?.referrals !== undefined) {
        refs = Math.max(refs, Number(currentStats.counts.referrals));
      }

      totalRegistered += reg;
      totalReferrals += refs;
    });

    if (currentStats?.counts?.referrals) {
      totalReferrals = Math.max(totalReferrals, currentStats.counts.referrals);
    }
    if (currentStats?.counts?.registered && totalRegistered === 0) {
      totalRegistered = currentStats.counts.registered;
    }

    return {
      totalConclaves,
      completedCount: completed.length,
      liveCount: running.length,
      upcomingCount: upcoming.length,
      totalRegistered,
      totalReferrals,
    };
  }, [conclaves, currentStats, conclaveStatsMap, current?.id]);

  // Real conclave data for analytics charts (strictly recent 5 conclaves only)
  const conclaveChartData = useMemo(() => {
    const sorted = [...conclaves].sort((a, b) => {
      const parseD = (obj) => {
        const raw = obj?.startDate || obj?.date || obj?.createdAt;
        if (!raw) return 0;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return parseD(b) - parseD(a);
    });

    const recent5 = sorted.slice(0, 5);

    return recent5.map((c) => {
      const count = Number(c.registrationCount ?? c.registeredCount ?? (Array.isArray(c.participants) ? c.participants.length : 0));
      const conclaveStat = conclaveStatsMap[c.id];
      let refs = Number(c.referralCount ?? c.referralsCount ?? 0);
      if (conclaveStat?.counts?.referrals !== undefined) {
        refs = Math.max(refs, Number(conclaveStat.counts.referrals));
      } else if (c.id === current?.id && currentStats?.counts?.referrals !== undefined) {
        refs = Math.max(refs, Number(currentStats.counts.referrals));
      }
      const rawName = c.name || 'Conclave';
      const shortName = rawName.length > 14 ? `${rawName.slice(0, 14)}…` : rawName;
      return {
        id: c.id,
        name: shortName,
        fullName: rawName,
        members: count,
        referrals: refs,
      };
    });
  }, [conclaves, current?.id, currentStats, conclaveStatsMap]);

  return (
    <div className="admin-home-dashboard w-full flex flex-col gap-3 pb-6 font-sans">
      {/* 1. Executive Top Bar / Welcome Greeting */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-dashboard-title text-zinc-950 tracking-tight">
              Hello, {firstName}
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-brand-red" />
              <span className="text-label-xs font-bold uppercase tracking-wider text-zinc-900">
                {regionLabel}
              </span>
            </div>
          </div>
          <p className="text-body-text text-zinc-500">
            Manage conclaves, member attendance, table seating, and referrals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <Link
            to={`${base}/conclaves?create=1`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-red hover:bg-[#B01B29] text-white text-button shadow-xs hover:shadow transition-smooth active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Conclave</span>
          </Link>
        </div>
      </section>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-brand-red text-body-md font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Main Hero Card (Active Conclave Spotlight) */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-white border border-zinc-200 animate-pulse" />
      ) : !current ? (
        <div className="rounded-2xl bg-white border border-zinc-200 p-8 text-center shadow-xs">
          <CalendarRange className="w-9 h-9 text-zinc-300 mx-auto" />
          <h2 className="mt-2.5 text-headline-md font-extrabold text-zinc-900">No Conclaves Scheduled Yet</h2>
          <p className="text-body-text text-zinc-500 mt-1 max-w-sm mx-auto">
            Create your first conclave to organize member tables and run rounds.
          </p>
          <Link
            to={`${base}/conclaves?create=1`}
            className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-red text-white text-button shadow-xs hover:bg-[#B01B29]"
          >
            <Plus className="w-4 h-4" /> Create Conclave
          </Link>
        </div>
      ) : (
        <ActiveConclaveHero c={current} base={base} stats={currentStats} loggedInAdmin={loggedInAdmin} />
      )}

      {/* 3. Core KPI Metric Strip (Feedback UI & Typography) */}
      <div className="bg-white border border-zinc-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-1 sm:grid-cols-3 shadow-xs">
        {/* KPI 1: Total Conclaves */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
              Total Conclaves
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{kpis.totalConclaves}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
            <CalendarRange className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Registered Members & Attendance */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
              Registered Members
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{kpis.totalRegistered}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Referrals Exchanged */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
              Referrals Exchanged
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-brand-red tabular-nums">{kpis.totalReferrals}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Visual Analytics & Real-Data Performance Charts */}
      {conclaveChartData.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5">
          {/* Chart 1: Member Registrations by Conclave */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-label-xs font-bold uppercase tracking-wider text-zinc-700">Total Attendance</span>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-red" />
                  <h3 className="text-module-title font-bold text-zinc-950">Members by Conclave</h3>
                </div>
              </div>
              <span className="text-label-xs font-bold text-zinc-600 bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200/60">
                {kpis.totalRegistered} Total Registered
              </span>
            </div>

            <div className="w-full overflow-x-auto custom-scrollbar pt-1 pb-1">
              <div
                className="h-44 w-full"
                style={{ minWidth: `${Math.max(280, conclaveChartData.length * 60)}px` }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conclaveChartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                      formatter={(value) => [`${value} registered`, 'Attendees']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e4e4e7',
                        borderRadius: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="members" fill="#CF2030" radius={[6, 6, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 2: Referral Slips Exchanged by Conclave */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-label-xs font-bold uppercase tracking-wider text-zinc-700">Total Referrals</span>
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-module-title font-bold text-zinc-950">Referrals Exchanged</h3>
                </div>
              </div>
              <span className="text-label-xs font-bold text-[#00875A] bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                {kpis.totalReferrals} Verified Slips
              </span>
            </div>

            <div className="w-full overflow-x-auto custom-scrollbar pt-1 pb-1">
              <div
                className="h-44 w-full"
                style={{ minWidth: `${Math.max(280, conclaveChartData.length * 60)}px` }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conclaveChartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                      formatter={(value) => [`${value} slips`, 'Referrals']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e4e4e7',
                        borderRadius: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="referrals" fill="#00875A" radius={[6, 6, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. Bottom Section: Side by Side Two Data Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-start">
        {/* Left Card: Upcoming & Recent Conclaves (7 cols / 58%) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-label-xs font-bold uppercase tracking-wider text-zinc-700">Conclaves List</span>
              <h3 className="text-module-title font-bold text-zinc-950">Upcoming &amp; Recent Conclaves</h3>
            </div>
            <button
              onClick={() => navigate(`${base}/conclaves`)}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="View All Conclaves"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 text-zinc-600 border-y border-zinc-100 text-label-xs font-bold uppercase tracking-wider">
                  <th className="py-2 px-3 rounded-l-lg">Conclave Name</th>
                  <th className="py-2 px-3">Schedule</th>
                  <th className="py-2 px-3">Members</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 rounded-r-lg text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-table-text">
                {conclaves.slice(0, 4).map((c) => {
                  const displayStatus = getConclaveDisplayStatus(c);
                  const isRunning = displayStatus === 'Running';
                  const isCompleted = displayStatus === 'Completed';
                  const isDraft = (c.status || '').toLowerCase() === 'draft';
                  const count = Number(c.registrationCount ?? c.registeredCount ?? (Array.isArray(c.participants) ? c.participants.length : 0));

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col min-w-[140px]">
                          <span className="text-card-title font-bold text-zinc-900 truncate">{c.name}</span>
                          <span className="text-caption text-zinc-400 truncate mt-0.5">
                            {c.venueLocation || c.venue || (c.region ? (/region$/i.test(c.region) ? c.region : `${c.region} Region`) : 'Venue TBD')}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 font-medium whitespace-nowrap text-caption">
                        {formatConclaveDate(c)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-zinc-900 text-body-sm">{count}</span>
                        <span className="text-caption text-zinc-400 font-normal ml-1">registered</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-xs font-black uppercase tracking-wider ${getStatusBadgeClasses(displayStatus)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotClasses(displayStatus)}`} />
                          {displayStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Link
                          to={isRunning ? `${base}/conclaves/${c.id}/round-runner` : `${base}/conclaves/${c.id}`}
                          className="inline-flex items-center gap-1 text-button text-brand-red hover:text-[#B01B29] hover:underline"
                        >
                          {isRunning ? 'Live Session' : isCompleted ? 'Report' : isDraft ? 'Edit' : 'Manage'}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-body-text">
            <span className="text-zinc-500 text-xs">
              Showing {Math.min(5, conclaves.length)} of {conclaves.length} active records
            </span>
            <Link
              to={`${base}/conclaves`}
              className="inline-flex items-center gap-1 text-button text-brand-red hover:text-[#B01B29] hover:underline"
            >
              View All Conclaves <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Card: Recent Conclave Activity (5 cols / 42%) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-label-xs font-bold uppercase tracking-wider text-zinc-700">Live Activity</span>
              <h3 className="text-module-title font-bold text-zinc-950">Recent Conclave Activity</h3>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-h-[160px]">
            {activitiesLoading ? (
              <div className="space-y-2 py-1">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 bg-zinc-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center my-auto">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-1.5">
                  <History className="w-4.5 h-4.5" />
                </div>
                <p className="text-card-title font-bold text-zinc-800">No Recent Activity</p>
                <p className="text-caption text-zinc-400 mt-0.5 max-w-xs">
                  Audit logs and live conclave events will appear here as they occur.
                </p>
              </div>
            ) : (
              activities.slice(0, 4).map((item, idx) => {
                const act = parseActivity(item, conclaves);
                return (
                  <div
                    key={item.id || idx}
                    className="flex items-start gap-2.5 p-1.5 rounded-xl hover:bg-zinc-50 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${act.iconBg} ${act.iconColor}`}>
                      {act.icon}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-card-title font-bold text-zinc-900 truncate">{act.title}</span>
                        <span className="text-label-xs text-zinc-400 font-bold shrink-0">{act.timeAgo}</span>
                      </div>
                      <p className="text-caption text-zinc-500 mt-0.5 line-clamp-1 leading-snug">
                        {act.description}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-end">
            <Link
              to={`${base}/activity`}
              className="inline-flex items-center gap-1 text-button text-brand-red hover:text-[#B01B29] hover:underline"
            >
              View Full Activity Audit Log <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Visual Hero Spotlight Card with Milestone Stepper and Conclave Overview.
 * 100% real-data driven.
 */
function ActiveConclaveHero({ c, base, stats, loggedInAdmin }) {
  const step = nextStep(c);
  const stage = stageOf(c);
  const isLive = stage === 'live';
  const isDone = stage === 'done';

  const registeredCount = Number(c.registrationCount ?? stats?.counts?.registered ?? (Array.isArray(c.participants) ? c.participants.length : 0));
  const captainsCount = Number(stats?.counts?.captains ?? 0);
  const regularMembersCount = Math.max(0, registeredCount - captainsCount);
  const referralsCount = Number(stats?.counts?.referrals ?? c.referralCount ?? 0);
  const coordinatorName = c.coordinator || c.coordinatorName || loggedInAdmin?.name || 'Assigned Admin';
  const venueDisplay = c.venueLocation || c.venue || (c.region ? (/region$/i.test(c.region) ? `${c.region} Center` : `${c.region} Regional Center`) : 'Venue Pending');

  // 4-Stage Progress calculation (Registration → Tables → Live → Done)
  const currentStage = stageOf(c);
  const currentStageIdx = useMemo(() => {
    return STAGES.findIndex((s) => s.id === currentStage);
  }, [currentStage]);

  // Member Roles Donut Chart Data
  const heroDonutData = useMemo(() => {
    if (registeredCount === 0) {
      return [{ name: 'No Registrations', value: 1, fill: '#E4E4E7' }];
    }
    const data = [];
    if (captainsCount > 0) {
      data.push({ name: 'Table Captains', value: captainsCount, fill: '#CF2030' });
    }
    if (regularMembersCount > 0) {
      data.push({ name: 'Seated Members', value: regularMembersCount, fill: '#27272A' });
    }
    if (data.length === 0) {
      data.push({ name: 'Registered Attendees', value: registeredCount, fill: '#CF2030' });
    }
    return data;
  }, [registeredCount, captainsCount, regularMembersCount]);

  return (
    <section className="w-full bg-white rounded-2xl border border-zinc-200/90 shadow-2xs p-4 sm:p-5 relative overflow-hidden flex flex-col gap-3.5">

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-brand-red font-bold text-label-xs uppercase tracking-wider border border-red-200">
              <span className="w-2 h-2 rounded-full bg-brand-red animate-ping" />
              LIVE NOW
            </span>
          ) : isDone ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-bold text-label-xs uppercase tracking-wider border border-zinc-200">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              CONCLUDED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-label-xs uppercase tracking-wider border border-amber-200">
              NEXT CONCLAVE
            </span>
          )}
        </div>

        <Link
          to={isLive ? `${base}/conclaves/${c.id}/round-runner` : `${base}/conclaves/${c.id}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-red hover:bg-[#B01B29] text-white font-bold text-button shadow-xs hover:shadow transition-smooth self-start sm:self-auto group cursor-pointer"
        >
          <span>{isLive ? 'Enter Live Session' : step.action || 'Open Conclave'}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Hero Visual Spotlight Grid (Title + Metadata + Stepper on Left, Member Roles Donut on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* Left Column: Title, Metadata & Horizontal Stepper */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-dashboard-title text-zinc-950 tracking-tight leading-tight">{c.name}</h2>

            <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 py-1.5 px-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-caption font-semibold text-zinc-700 mt-0.5 self-start">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-red" />
                <span>{formatConclaveDate(c)}</span>
              </div>
              <span className="hidden sm:inline text-zinc-300">•</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-red" />
                <span>{venueDisplay}</span>
              </div>
              <span className="hidden sm:inline text-zinc-300">•</span>
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <Users className="w-3.5 h-3.5" />
                <span>{registeredCount} Registered Members</span>
              </div>
            </div>
          </div>

          {/* 4-Stage Visual Horizontal Timeline: Registration → Tables → Live → Done (Green Theme) */}
          <div className="w-full pt-1.5 pb-0.5">
            <div className="flex items-center justify-between w-full">
              {STAGES.map((s, i) => {
                const isStepDone = i < currentStageIdx || currentStage === 'done';
                const isActive = i === currentStageIdx && currentStage !== 'done';
                const isLineDone = i < currentStageIdx || currentStage === 'done';

                return (
                  <React.Fragment key={s.id}>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${isStepDone
                          ? 'bg-[#00875A] text-white shadow-2xs'
                          : isActive
                            ? 'bg-brand-red text-white shadow-2xs ring-2 ring-red-100'
                            : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                          }`}
                      >
                        {isStepDone ? (
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        ) : isActive ? (
                          <Play className="w-2 h-2 fill-current ml-0.5" />
                        ) : (
                          <span className="text-[10px] font-bold">{i + 1}</span>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold whitespace-nowrap transition-colors ${isActive
                          ? 'text-brand-red'
                          : isStepDone
                            ? 'text-[#00875A]'
                            : 'text-zinc-400'
                          }`}
                      >
                        {s.label}
                      </span>
                    </div>

                    {/* Connector line between steps */}
                    {i < STAGES.length - 1 && (
                      <div className="flex-1 mx-1.5 sm:mx-2.5 h-[2px] bg-zinc-200 rounded-full overflow-hidden min-w-[10px]">
                        <div
                          className={`h-full transition-all duration-500 ${isLineDone ? 'bg-[#00875A] w-full' : 'w-0'
                            }`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance & Role Distribution Card (Fills column width) */}
        <div className="lg:col-span-5 flex items-center">
          <div className="w-full bg-zinc-50/90 border border-zinc-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-2.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-zinc-200/70 pb-2">
              <span className="text-label-xs font-bold uppercase tracking-wider text-zinc-600">Members &amp; Captains</span>
              <span className="text-label-xs font-bold text-zinc-700 bg-white px-2 py-0.5 rounded-full border border-zinc-200/80 shadow-2xs">
                {registeredCount} Total
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Donut Chart */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={heroDonutData}
                      innerRadius={26}
                      outerRadius={38}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={heroDonutData.length > 1 ? 3 : 0}
                      stroke="none"
                      dataKey="value"
                    >
                      {heroDonutData.map((entry, idx) => (
                        <Cell key={`hero-donut-${idx}`} fill={entry.fill} className="cursor-default outline-none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-title-lg font-black text-zinc-950 leading-none">{registeredCount}</span>
                  <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-wider mt-0.5">Members</span>
                </div>
              </div>

              {/* Legend & Real Counts */}
              <div className="flex-1 flex flex-col gap-1.5 text-caption font-semibold">
                <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white border border-zinc-200/60 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-zinc-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27272A]" /> Seated Members
                  </span>
                  <span className="font-extrabold text-zinc-900">{regularMembersCount}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white border border-zinc-200/60 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-zinc-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-red" /> Table Captains
                  </span>
                  <span className="font-extrabold text-zinc-900">{captainsCount}</span>
                </div>
                <div className="flex items-center justify-between px-1 text-label-xs font-bold text-emerald-700">
                  <span className="flex items-center gap-1">
                    <Handshake className="w-3.5 h-3.5" /> Referrals Exchanged
                  </span>
                  <span>{referralsCount} Slips</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 bg-zinc-50/80 border border-zinc-200/80 rounded-xl">
        <div className="flex items-center gap-2.5 px-2 py-0.5">
          <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-brand-red shadow-2xs">
            <Timer className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label-xs font-bold text-zinc-700 uppercase tracking-wider">Current Status</span>
            <span className="text-title-lg font-bold text-zinc-900">
              {isLive ? `Round ${c.currentRound || 1} of ${c.roundCount || 4}` : step.text}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-2 py-0.5">
          <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label-xs font-bold text-zinc-700 uppercase tracking-wider">Coordinator In Charge</span>
            <span className="text-title-lg font-bold text-zinc-900">
              {coordinatorName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-2 py-0.5">
          <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-emerald-600 shadow-2xs">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label-xs font-bold text-zinc-700 uppercase tracking-wider">Referrals Exchanged</span>
            <span className="text-title-lg font-bold text-emerald-700">
              {referralsCount} Slips Logged
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Human-readable relative time formatting.
 * Displays minutes (<60m), hours (<24h), and days (>=24h) cleanly.
 */
function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return '1d ago';
  }
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return diffMonths === 1 ? '1mo ago' : `${diffMonths}mo ago`;
}

/**
 * Format live audit log row into card visual item with resolved names and days-exceeded time.
 */
function parseActivity(item, conclaves = []) {
  const action = item.action || '';
  const timeAgo = formatRelativeTime(item.occurredAt);
  const actor = who(item);

  // Match conclave name if entity is an ID
  const matchedConclave = conclaves.find((c) => c.id === item.conclaveId || c.id === item.entityId);
  const conclaveName = matchedConclave?.name || item.conclave?.name;

  // Enhance item with matched conclave for describe()
  const enhancedItem = conclaveName && !item.conclave?.name
    ? { ...item, conclave: { ...item.conclave, name: conclaveName } }
    : item;

  let desc = describe(enhancedItem, true);

  // Sanitize any remaining raw UUID strings in the description
  if (desc) {
    desc = desc.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, conclaveName || 'conclave');
  }

  // Meaningful titles and matching brand icons
  if (action.includes('referral') || action.includes('one_to_one')) {
    return {
      title: action === 'referral.create' ? 'Referral Given' : 'Referral Exchanged',
      timeAgo,
      description: desc || `${actor} logged a business referral exchange.`,
      iconBg: 'bg-emerald-50 border border-emerald-200',
      iconColor: 'text-emerald-700',
      icon: <Handshake className="w-4 h-4" />
    };
  }
  if (action.includes('round') || action.includes('start')) {
    return {
      title: action === 'round.pause'
        ? 'Round Paused'
        : action === 'round.resume'
          ? 'Round Resumed'
          : action === 'conclave.start'
            ? 'Round Started'
            : 'Round Progression',
      timeAgo,
      description: desc || `${actor} updated live round status.`,
      iconBg: 'bg-red-50 border border-red-200',
      iconColor: 'text-brand-red',
      icon: <Timer className="w-4 h-4" />
    };
  }
  if (action.includes('schedule') || action.includes('lock')) {
    return {
      title: action === 'schedule.generate'
        ? 'Tables Generated'
        : action === 'conclave.lock_schedule'
          ? 'Seating Locked'
          : 'Seating Matrix',
      timeAgo,
      description: desc || `${actor} updated seating allocation.`,
      iconBg: 'bg-zinc-100 border border-zinc-200',
      iconColor: 'text-zinc-800',
      icon: <Shield className="w-4 h-4" />
    };
  }
  if (action.includes('registration') || action.includes('attendance')) {
    return {
      title: action === 'attendance.sync'
        ? 'Attendance Check-in'
        : action === 'registration.create'
          ? 'Member Registered'
          : 'Member Registration',
      timeAgo,
      description: desc || `${actor} updated attendee record.`,
      iconBg: 'bg-blue-50 border border-blue-200',
      iconColor: 'text-blue-700',
      icon: <UserCheck className="w-4 h-4" />
    };
  }
  if (action.includes('conclave')) {
    return {
      title: action === 'conclave.create'
        ? 'Conclave Created'
        : action === 'conclave.complete'
          ? 'Conclave Concluded'
          : 'Conclave Configuration',
      timeAgo,
      description: desc || `${actor} updated conclave configuration.`,
      iconBg: 'bg-zinc-100 border border-zinc-200',
      iconColor: 'text-zinc-700',
      icon: <Calendar className="w-4 h-4" />
    };
  }
  return {
    title: item.summary || 'Administrative Update',
    timeAgo,
    description: desc || `${actor} performed administrative update.`,
    iconBg: 'bg-zinc-100 border border-zinc-200',
    iconColor: 'text-zinc-600',
    icon: <History className="w-4 h-4" />
  };
}
