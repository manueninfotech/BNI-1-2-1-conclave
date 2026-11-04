import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Star,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Search,
  ArrowUpDown,
  X,
  AlertCircle,
  Handshake,
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Modern, Chart-Driven Feedback & Satisfaction Analytics.
 * Designed with Recharts visualizations, an executive KPI metric strip,
 * and a high-density attendee submissions data table (no chunky cards).
 * 100% real backend data.
 */
export default function Feedback({ selectedConclaveId, embedded = false }) {
  const [data, setData] = useState(null);
  const [memberInfoByUid, setMemberInfoByUid] = useState({});
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [conclaveName, setConclaveName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all', '5', '4', 'low', 'comments'
  const [sortOption, setSortOption] = useState('date-desc'); // 'date-desc', 'rating-desc', 'rating-asc', 'referrals-desc'
  const [expandedComments, setExpandedComments] = useState(new Set());

  const load = useCallback(async () => {
    if (!selectedConclaveId) return;
    setLoading(true);
    setError(null);
    try {
      const [fb, full] = await Promise.all([
        api.get(`/admin/conclaves/${selectedConclaveId}/feedback`),
        api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null),
      ]);
      setData(fb || { count: 0, avgRating: null, items: [] });
      if (full) {
        setConclaveName(full.name || '');
        const map = {};
        const participants = full.participants || [];
        setTotalParticipants(participants.length);
        participants.forEach((p) => {
          const uid = p._originalUid || p.uid || p.id;
          if (uid != null) {
            const rawName = p.name || 'Member';
            map[String(uid)] = {
              name: rawName,
              chapter: p.chapter || p.chapterName || '',
              category: p.businessCategory || p.category || p.classification || '',
              company: p.company || p.companyName || '',
              initials:
                rawName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'M',
            };
          }
        });
        setMemberInfoByUid(map);
      }
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setError(err.message || 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }, [selectedConclaveId]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => data?.items || [], [data]);
  const totalReviews = items.length;

  const avgRatingValue = useMemo(() => {
    if (data?.avgRating != null) return Number(data.avgRating);
    if (!totalReviews) return 0;
    return +(items.reduce((s, it) => s + (Number(it.rating) || 0), 0) / totalReviews).toFixed(2);
  }, [data?.avgRating, items, totalReviews]);

  // Star Counts (5, 4, 3, 2, 1)
  const starCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    items.forEach((it) => {
      const r = Math.round(Number(it.rating) || 0);
      if (counts[r] !== undefined) counts[r]++;
    });
    return counts;
  }, [items]);

  // Chart 1 Data: Rating Distribution Bar Chart
  const ratingChartData = useMemo(() => {
    const colorsMap = {
      5: '#00875A', // BNI Emerald
      4: '#10B981', // Green
      3: '#F59E0B', // Amber
      2: '#F97316', // Orange
      1: '#CF2030', // BNI Red
    };
    return [5, 4, 3, 2, 1].map((star) => {
      const count = starCounts[star] || 0;
      const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
      return {
        label: `${star}★`,
        star,
        count,
        percent: pct,
        fill: colorsMap[star],
      };
    });
  }, [starCounts, totalReviews]);

  // Referrals Statistics & Chart Data
  const referralsTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (typeof it.referrals === 'number' ? it.referrals : 0), 0);
  }, [items]);

  const referralsAvg = useMemo(() => {
    if (!totalReviews) return 0;
    return +(referralsTotal / totalReviews).toFixed(1);
  }, [referralsTotal, totalReviews]);

  const referralDistributionData = useMemo(() => {
    const buckets = { '0 Leads': 0, '1 Lead': 0, '2 Leads': 0, '3 Leads': 0, '4+ Leads': 0 };
    items.forEach((it) => {
      const ref = typeof it.referrals === 'number' ? it.referrals : 0;
      if (ref === 0) buckets['0 Leads']++;
      else if (ref === 1) buckets['1 Lead']++;
      else if (ref === 2) buckets['2 Leads']++;
      else if (ref === 3) buckets['3 Leads']++;
      else buckets['4+ Leads']++;
    });
    return Object.entries(buckets).map(([category, count]) => ({
      category,
      count,
      percent: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0,
    }));
  }, [items, totalReviews]);

  // Response Rate
  const responseRate = useMemo(() => {
    if (!totalParticipants) return null;
    return Math.min(100, Math.round((totalReviews / totalParticipants) * 100));
  }, [totalReviews, totalParticipants]);

  // Comments Count
  const commentsCount = useMemo(() => {
    return items.filter((it) => it.comment && it.comment.trim()).length;
  }, [items]);

  // Filtered & Sorted Submissions
  const filteredAndSortedItems = useMemo(() => {
    const filtered = items.filter((it) => {
      const info = memberInfoByUid[String(it.uid)] || {};
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchName = info.name?.toLowerCase().includes(query);
        const matchChapter = info.chapter?.toLowerCase().includes(query);
        const matchCategory = info.category?.toLowerCase().includes(query);
        const matchComment = it.comment?.toLowerCase().includes(query);
        if (!matchName && !matchChapter && !matchCategory && !matchComment) return false;
      }

      if (activeFilterTab === '5') return Math.round(Number(it.rating) || 0) === 5;
      if (activeFilterTab === '4') return Math.round(Number(it.rating) || 0) === 4;
      if (activeFilterTab === 'low') return Math.round(Number(it.rating) || 0) <= 3;
      if (activeFilterTab === 'comments') return Boolean(it.comment && it.comment.trim());

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === 'rating-desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (sortOption === 'rating-asc') return (Number(a.rating) || 0) - (Number(b.rating) || 0);
      if (sortOption === 'referrals-desc') return (Number(b.referrals) || 0) - (Number(a.referrals) || 0);
      if (sortOption === 'date-asc') {
        const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return dateA - dateB;
      }
      // Default: date-desc
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [items, memberInfoByUid, searchQuery, activeFilterTab, sortOption]);

  const toggleCommentExpand = (uid) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  if (!selectedConclaveId) {
    return (
      <div className="p-12 text-center text-zinc-500 font-sans max-w-md mx-auto my-12 bg-white rounded-xl border border-zinc-200 shadow-xs">
        <MessageSquare className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-800">Select a Conclave</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Please select a conclave from the header workspace to view attendee feedback.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 sm:space-y-4 max-w-[1600px] mx-auto w-full font-sans select-none pb-8 ${embedded ? 'pt-0' : ''}`}>
      {/* 1. Header Toolbar */}
      <div>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Feedback & Analytics</h1>
        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
          Post-conclave satisfaction metrics, referral tracking, and member reviews for{' '}
          <span className="font-bold text-brand-red">{conclaveName || 'this Conclave'}</span>.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!error && !loading && items.length === 0 && (
        <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-300 rounded-xl max-w-lg mx-auto my-6 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 text-zinc-400 flex items-center justify-center mb-3 shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-zinc-900">No Feedback Submitted Yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">
            Attendees can submit their session rating, referrals, and feedback via their mobile app after the conclave wraps up.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-red hover:bg-[#b51c2a] text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check for Responses</span>
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* 2. Executive KPI Metric Strip (Clean 3-Metric Layout) */}
          <div className="bg-white border border-zinc-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-1 sm:grid-cols-3 shadow-xs">
            {/* KPI 1: Overall Satisfaction */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
                  Average Rating
                </span>
                <div className="my-1.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-zinc-950 tabular-nums">
                    {avgRatingValue > 0 ? avgRatingValue.toFixed(1) : '—'}
                  </span>
                  <span className="text-xs font-bold text-zinc-400">/ 5.0</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        s <= Math.round(avgRatingValue)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-zinc-200 fill-zinc-100'
                      }`}
                    />
                  ))}
                  <span className="text-[10px] font-bold text-[#00875A] ml-1">
                    {avgRatingValue >= 4.5 ? 'World Class' : avgRatingValue >= 4.0 ? 'High' : 'Good'}
                  </span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-amber-400" />
              </div>
            </div>

            {/* KPI 2: Response Rate */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
                  Response Turnout
                </span>
                <div className="my-1.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-zinc-950 tabular-nums">{totalReviews}</span>
                  {totalParticipants > 0 && (
                    <span className="text-xs font-semibold text-zinc-400">/ {totalParticipants}</span>
                  )}
                </div>
                <div className="text-[10px] font-bold text-[#00875A]">
                  {responseRate != null ? `${responseRate}% response rate` : 'Logged'}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3: Referrals Passed */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
                  Referrals Passed
                </span>
                <div className="my-1.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-zinc-950 tabular-nums">{referralsTotal}</span>
                  <span className="text-xs font-bold text-zinc-400">leads</span>
                </div>
                <div className="text-[10px] font-bold text-brand-red">
                  {referralsAvg} avg per attendee
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
                <Handshake className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 3. Interactive Charts Grid (Side-by-side balanced 2-column layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Chart 1: Satisfaction Rating Distribution BarChart */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-4.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h3 className="text-sm font-bold text-zinc-950">Rating Distribution</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">1 to 5 Stars</span>
              </div>

              <div className="pt-3 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ratingChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="label"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#52525b', fontSize: 11, fontWeight: 700 }}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-zinc-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-md border border-zinc-800">
                              <span className="font-extrabold text-amber-400">{d.star} Stars:</span> {d.count} reviews ({d.percent}%)
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    >
                      {ratingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                <span>Top tier (5★): <strong>{starCounts[5] || 0} reviews</strong></span>
                <span className="text-zinc-400">Total: {totalReviews}</span>
              </div>
            </div>

            {/* Chart 2: Referral Contribution Distribution BarChart */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-4.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-red" />
                  <h3 className="text-sm font-bold text-zinc-950">Referrals Passed</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Leads Distribution</span>
              </div>

              <div className="pt-3 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={referralDistributionData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <XAxis
                      dataKey="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a1a1aa', fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-zinc-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-md border border-zinc-800">
                              <span className="font-extrabold text-red-400">{d.category}:</span> {d.count} attendees ({d.percent}%)
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#CF2030"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                <span>Total Leads: <strong className="text-zinc-900">{referralsTotal}</strong></span>
                <span className="text-brand-red font-bold">{referralsAvg} avg / member</span>
              </div>
            </div>
          </div>

          {/* 4. Attendee Feedback Data Table (Modern Ledger - NO CARDS) */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            {/* Table Control Bar: Search + Segmented Filter Tabs + Sort */}
            <div className="p-4 border-b border-zinc-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-zinc-50/50">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFilterTab === 'all'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  All ({totalReviews})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('5')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFilterTab === '5'
                      ? 'bg-[#00875A] text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  5★ ({starCounts[5] || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('4')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFilterTab === '4'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  4★ ({starCounts[4] || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('low')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFilterTab === 'low'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  ≤ 3★ ({(starCounts[1] || 0) + (starCounts[2] || 0) + (starCounts[3] || 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('comments')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFilterTab === 'comments'
                      ? 'bg-brand-red text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  Comments ({commentsCount})
                </button>
              </div>

              {/* Search + Sort */}
              <div className="flex items-center gap-2.5">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search attendee or notes..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="h-8 pl-2.5 pr-7 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-brand-red cursor-pointer appearance-none"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="rating-desc">Highest Rating</option>
                    <option value="rating-asc">Lowest Rating</option>
                    <option value="referrals-desc">Most Referrals</option>
                  </select>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Table Header & Rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    <th className="py-3 px-4">Attendee</th>
                    <th className="py-3 px-3">Satisfaction</th>
                    <th className="py-3 px-3">Referrals</th>
                    <th className="py-3 px-4">Attendee Note & Feedback</th>
                    <th className="py-3 px-4 text-right">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 text-xs">
                  {filteredAndSortedItems.length > 0 ? (
                    filteredAndSortedItems.map((it) => {
                      const info = memberInfoByUid[String(it.uid)] || {};
                      const name = info.name || 'Member';
                      const initials = info.initials || 'M';
                      const rating = Number(it.rating) || 0;
                      const hasComment = Boolean(it.comment && it.comment.trim());
                      const isExpanded = expandedComments.has(it.uid);

                      return (
                        <tr key={it.uid} className="hover:bg-zinc-50/70 transition-colors">
                          {/* Attendee Info */}
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {initials}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-zinc-950 truncate">{name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {info.chapter && (
                                    <span className="text-[10px] bg-zinc-100 text-zinc-700 font-semibold px-1.5 py-0.2 rounded">
                                      {info.chapter}
                                    </span>
                                  )}
                                  {info.category && (
                                    <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                                      {info.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Satisfaction Rating */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-extrabold text-xs border ${
                                rating >= 5
                                  ? 'bg-emerald-50 text-[#00875A] border-emerald-200'
                                  : rating >= 4
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : rating >= 3
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-red-50 text-brand-red border-red-200'
                              }`}
                            >
                              <span>{rating}</span>
                              <Star className="w-3 h-3 fill-current" />
                            </span>
                          </td>

                          {/* Referrals */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            {typeof it.referrals === 'number' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                <TrendingUp className="w-3 h-3 text-[#00875A]" />
                                <span>{it.referrals} {it.referrals === 1 ? 'Lead' : 'Leads'}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-300 font-bold">—</span>
                            )}
                          </td>

                          {/* Written Comment */}
                          <td className="py-3 px-4 align-top">
                            {hasComment ? (
                              <div className="text-zinc-700 leading-snug">
                                <span className="italic text-zinc-400 mr-1">“</span>
                                <span>
                                  {isExpanded || it.comment.length <= 120
                                    ? it.comment
                                    : `${it.comment.slice(0, 120)}...`}
                                </span>
                                <span className="italic text-zinc-400 ml-1">”</span>
                                {it.comment.length > 120 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCommentExpand(it.uid)}
                                    className="ml-1 text-[11px] font-bold text-brand-red hover:underline cursor-pointer"
                                  >
                                    {isExpanded ? 'Show less' : 'Read more'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">No written comment</span>
                            )}
                          </td>

                          {/* Submitted Time */}
                          <td className="py-3 px-4 align-top text-right text-zinc-400 text-[11px] font-medium whitespace-nowrap">
                            {it.submittedAt ? (
                              new Date(it.submittedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-400 font-medium">
                        No submissions match the search query or active filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-xs text-zinc-500 font-medium">
              <span>
                Showing <strong>{filteredAndSortedItems.length}</strong> of {totalReviews} attendee submissions
              </span>
              {(searchQuery || activeFilterTab !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilterTab('all');
                  }}
                  className="text-brand-red font-bold hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
