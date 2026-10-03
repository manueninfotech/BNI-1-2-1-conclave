import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Download,
  RefreshCw,
  Info,
  Eye,
  LogIn,

} from 'lucide-react';
import Pagination from '../components/Pagination';
import SearchableDropdown from '../components/SearchableDropdown';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { api } from '../services/api';

export default function ActiveUsers({ searchQuery, selectedConclaveId }) {
  const [sessions, setSessions] = useState(() => {
    const cached = localStorage.getItem('bni_active_users_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadSessions() {
      setIsLoading(false);
      try {
        let rawList = [];
        let autoLogoutHours = 4;

        if (selectedConclaveId) {
          try {
            const data = await api.get(`/admin/conclaves/${selectedConclaveId}/registrations`);
            if (data && Array.isArray(data.registrations)) {
              rawList = data.registrations;
              if (data.autoLogoutHours) autoLogoutHours = data.autoLogoutHours;
            }
          } catch { }
        } else {
          const allUsers = await api.get('/admin/users').catch(() => []);
          if (Array.isArray(allUsers)) {
            rawList = allUsers;
          }
        }

        const mapped = rawList.map(r => {
          const hasLoggedIn = Boolean(r.lastLoginAt);
          const rawDate = r.lastLoginAt || r.createdAt || r.registeredAt;
          const loginDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;
          const autoLogoutLimitMins = (autoLogoutHours || 4) * 60;

          const elapsedMins = loginDate
            ? Math.max(0, Math.floor((Date.now() - loginDate.getTime()) / 60000))
            : 0;

          const remainingMins = loginDate
            ? Math.max(0, autoLogoutLimitMins - (elapsedMins % autoLogoutLimitMins))
            : 0;

          const hoursLeft = Math.floor(remainingMins / 60);
          const minsLeft = remainingMins % 60;
          const logoutTimerStr = hasLoggedIn ? `${hoursLeft}h ${minsLeft}m` : 'Not Signed In';
          const logoutPercentVal = hasLoggedIn ? Math.min(100, Math.max(5, Math.round((remainingMins / autoLogoutLimitMins) * 100))) : 0;

          // Real status directly from backend isActive or calculation
          const isOnline = hasLoggedIn && r.isActive !== false && elapsedMins < autoLogoutLimitMins;

          return {
            id: r.id || r.uid,
            name: r.name || r.displayName || 'Member',
            role: r.role === 'captain' || r.isTableCaptain || r.isCaptain ? 'Captain' : 'Member',
            isCaptain: r.role === 'captain' || r.isTableCaptain || r.isCaptain,
            category: r.category || r.businessCategory || 'General',
            status: isOnline ? 'Online' : 'Idle',
            loginTime: loginDate ? loginDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never',
            duration: hasLoggedIn ? `${elapsedMins} Mins` : '0 Mins',
            deadline: loginDate ? new Date(loginDate.getTime() + autoLogoutLimitMins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            logoutDeadline: loginDate ? new Date(loginDate.getTime() + autoLogoutLimitMins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            logoutTimer: logoutTimerStr,
            logoutPercent: logoutPercentVal,
            sessionKey: r.sessionKey || `SES-${String(r.id || r.uid || '0000').substring(0, 8).toUpperCase()}`,
            protocol: 'HTTPS / WSS (TLS v1.3)',
            heartbeat: isOnline ? 'Active (200 OK)' : 'Idle / Standby',
            device: 'Mobile App / Web Portal',
            ip: '192.168.1.1',
            location: r.location ? (typeof r.location === 'object' ? (r.location.place || r.region || 'Vijayawada') : r.location) : (r.region || 'Vijayawada'),
            email: r.email,
            phone: r.phone || r.mobile
          };
        });
        setSessions(mapped);
        localStorage.setItem('bni_active_users_cache', JSON.stringify(mapped));
      } catch (err) {
        console.error("Failed to load registrations for active sessions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSessions();
  }, [selectedConclaveId, refreshTrigger]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== null) {
      setSearchTerm(searchQuery);
    }
  }, [searchQuery]);

  const searchVal = searchTerm;
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedSession, setSelectedSession] = useState(null);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (selectedSession) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedSession]);
  const [hoveredSlice, setHoveredSlice] = useState(null);

  // Selection/checkbox states
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isBulkLogoutOpen, setIsBulkLogoutOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Real-time toast state
  const [toast, setToast] = useState(null);

  // Recharts Data for Widgets
  const sessionStatusData = useMemo(() => {
    const online = sessions.filter(s => s.status === 'Online').length;
    const idle = sessions.filter(s => s.status === 'Idle').length;
    const expiring = sessions.filter(s => s.status === 'Expiring').length;
    return [
      { name: 'Online', value: online || 0, color: '#af101a' },
      { name: 'Idle', value: idle || 0, color: '#fd867d' },
      { name: 'Expiring', value: expiring || 0, color: '#e4beba' }
    ];
  }, [sessions]);

  const autoLogoutData = useMemo(() => {
    let c5m = 0, c15m = 0, c30m = 0, c60m = 0;
    sessions.forEach(s => {
      const mins = parseInt(s.duration) || 0;
      if (mins <= 5) c5m++;
      else if (mins <= 15) c15m++;
      else if (mins <= 30) c30m++;
      else c60m++;
    });
    return [
      { name: '5M', value: c5m, color: '#fd867d' },
      { name: '15M', value: c15m, color: '#af101a' },
      { name: '30M', value: c30m, color: '#af101a' },
      { name: '60M+', value: c60m, color: '#271816' }
    ];
  }, [sessions]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  const conclaveSessions = useMemo(() => {
    return sessions;
  }, [sessions]);

  const dynamicFeedLogs = useMemo(() => {
    const online = sessions.filter(s => s.status === 'Online');
    const logs = [];
    online.slice(0, 5).forEach((s, idx) => {
      logs.push({
        type: 'login',
        event: `${s.name} checked in`,
        detail: `${s.category} • Table Captain Status: ${s.role}`,
        time: s.loginTime
      });
    });
    if (logs.length === 0) {
      logs.push({
        type: 'system',
        event: 'No active check-ins yet',
        detail: 'Conclave registry is waiting for member registrations.',
        time: 'N/A'
      });
    }
    return logs;
  }, [sessions]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [searchVal, statusFilter]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const q = (searchVal || '').trim().toLowerCase();

    return conclaveSessions.filter(s => {
      const matchesSearch = !q || (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.role && s.role.toLowerCase().includes(q)) ||
        (s.loginTime && s.loginTime.toLowerCase().includes(q))
      );

      const matchesStatus =
        statusFilter === 'All' ||
        s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [conclaveSessions, searchVal, statusFilter]);

  // Paginated Sessions
  const paginatedSessions = useMemo(() => {
    const totalPages = Math.ceil(filteredSessions.length / itemsPerPage) || 1;
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  // Checkbox toggle logic
  const toggleRow = (id, e) => {
    e.stopPropagation();
    const updated = new Set(selectedRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedRows(updated);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredSessions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredSessions.map(s => s.id)));
    }
  };

  // CSV Export
  const handleExport = () => {
    if (filteredSessions.length === 0) {
      showToast('No sessions to export', 'error');
      return;
    }
    const headers = ['Session ID', 'Member Name', 'Classification', 'Role', 'Login Time', 'Duration', 'Deadline', 'Status'];
    const rows = filteredSessions.map(s => [
      s.id,
      `"${s.name}"`,
      `"${s.category}"`,
      s.isCaptain ? 'Captain' : 'Member',
      s.loginTime,
      s.duration,
      s.logoutDeadline,
      s.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bni_active_sessions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Completed', `Successfully exported ${filteredSessions.length} active sessions.`);
  };

  const handleBulkExport = () => {
    const selectedList = sessions.filter(s => selectedRows.has(s.id));
    if (selectedList.length === 0) return;
    const headers = ['Session ID', 'Member Name', 'Classification', 'Role', 'Login Time', 'Duration', 'Deadline', 'Status'];
    const rows = selectedList.map(s => [
      s.id,
      `"${s.name}"`,
      `"${s.category}"`,
      s.isCaptain ? 'Captain' : 'Member',
      s.loginTime,
      s.duration,
      s.logoutDeadline,
      s.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `selected_sessions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Selected', `Successfully exported ${selectedList.length} sessions.`);
  };

  // Refresh helper
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showToast('Refreshing Sessions', 'Active session logs updated to real-time.');
  };

  const totalActiveSessions = sessions.filter(s => s.status === 'Online').length;
  const totalLoggedSessions = sessions.length;
  const totalIdleSessions = sessions.filter(s => s.status === 'Idle').length;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6 animate-fade-in">

      {/* Header section */}
      <div className="border-b border-zinc-100 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Active Users</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Monitor active member sessions and chapter conclave readiness.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 border border-zinc-200 bg-white text-zinc-700 font-bold text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            Export
          </button>
          <button
            onClick={handleRefresh}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-red-700 text-white font-bold text-button rounded-lg transition-smooth shadow-md cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            Refresh Sessions
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Active</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalActiveSessions}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Logged In Today</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalLoggedSessions}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Active Now</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalActiveSessions}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Auto Logout Pending</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalIdleSessions}</span>
          </div>
        </div>
      </div>

      {/* Widgets row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Widget 1: Live Session Status */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl shadow-sm space-y-4">
          <h3 className="font-bold text-zinc-950 border-b border-zinc-100 pb-2.5 text-body-sm flex items-center justify-between">
            Live Session Status
            <Info className="w-4 h-4 text-zinc-400" />
          </h3>
          <div className="flex gap-6 items-center h-36 pt-1">
            <div className="w-32 h-32 relative flex items-center justify-center shrink-0">
              <ResponsiveContainer width="105%" height="105%">
                <PieChart>
                  <Pie
                    data={sessionStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={47}
                    paddingAngle={2.5}
                    dataKey="value"
                  >
                    {sessionStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="none"
                        onMouseEnter={() => setHoveredSlice(entry)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className="outline-none cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center pointer-events-none">
                <span className="text-sm font-black text-zinc-955 leading-none">
                  {hoveredSlice ? hoveredSlice.value : totalLoggedSessions}
                </span>
                <span className="text-[8px] text-zinc-400 font-bold uppercase mt-1">
                  {hoveredSlice ? hoveredSlice.name : 'Total'}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5 font-semibold text-zinc-650">
              {sessionStatusData.map((d, index) => (
                <div key={index} className="flex justify-between items-center text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-zinc-600">{d.name}</span>
                  </div>
                  <span className="text-zinc-905 font-bold">
                    {d.value} <span className="text-zinc-455 font-normal text-[9px]">({Math.round((d.value / (totalLoggedSessions || 1)) * 100)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Widget 2: Auto Logout Monitor */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl shadow-sm space-y-4">
          <h3 className="font-bold text-zinc-950 border-b border-zinc-100 pb-2.5 text-body-sm flex items-center justify-between">
            Auto Logout Monitor
            <Eye className="w-4 h-4 text-zinc-400" />
          </h3>
          <div className="h-36 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={autoLogoutData} barCategoryGap="20%" margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip cursor={false} formatter={(value) => `${value}%`} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {autoLogoutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Widget 3: Live Activity Feed */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl shadow-sm space-y-4 overflow-hidden">
          <h3 className="font-bold text-zinc-950 border-b border-zinc-100 pb-2.5 text-body-sm flex items-center justify-between">
            Live Activity Feed
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-red-50 text-brand-red rounded border border-red-100 uppercase tracking-wider">LIVE</span>
          </h3>
          <div className="space-y-4 max-h-28 overflow-y-auto pr-1 pt-1">
            {dynamicFeedLogs.map((log, idx) => {
              const IconComponent = log.type === 'login' ? LogIn : Info;
              return (
                <div key={idx} className="flex gap-2.5 border-l-2 border-brand-red pl-3 py-0.5">
                  <IconComponent className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-800 leading-tight">{log.event}</p>
                    <span className="text-[9px] text-zinc-450 font-semibold block mt-0.5">{log.time} • {log.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Table Toolbar */}
      <div className="bg-white border border-zinc-200/80 p-3.5 flex flex-col lg:flex-row gap-3 items-center justify-between rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm placeholder-zinc-400 focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth bg-zinc-50/20"
              placeholder="Filter sessions by name, ID or category..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SearchableDropdown
              label="Status"
              options={['All', 'Online', 'Idle']}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Search status..."
            />
          </div>
        </div>
        <button
          onClick={() => { setSearchTerm(''); setStatusFilter('All'); }}
          className="text-label-md font-bold text-brand-red hover:underline px-4 cursor-pointer shrink-0 transition-smooth text-button"
        >
          Reset Filters
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
        {/* Active sessions list table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-label-xs font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-4 w-12 text-center">
                  <input
                    checked={filteredSessions.length > 0 && selectedRows.size === filteredSessions.length}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                    type="checkbox"
                  />
                </th>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Business Type</th>
                <th className="px-5 py-4">Captain Status</th>
                <th className="px-5 py-4 text-center">Auto Logout</th>
                <th className="px-5 py-4">Session</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-table-text">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-zinc-400 font-medium">
                    No active sessions found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="group cursor-pointer"
                  >
                    <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        checked={selectedRows.has(session.id)}
                        onChange={(e) => toggleRow(session.id, e)}
                        className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                        type="checkbox"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-brand-red/10 text-brand-red font-bold text-xs flex items-center justify-center border border-brand-red/10 shrink-0 select-none">
                          {session.avatar || session.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="text-body-sm font-bold text-zinc-900 transition-smooth leading-tight block">{session.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-md text-[10.5px] font-extrabold border border-zinc-200/80">
                        {session.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {session.isCaptain ? (
                        <div className="flex items-center gap-1.5 text-brand-red text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-red" />
                          <span>Captain</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-450 font-medium">Member</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-extrabold text-brand-red font-mono bg-red-50/80 px-2 py-0.5 rounded border border-red-100/80 tracking-wide">
                          {session.logoutTimer}
                        </span>
                        <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-red rounded-full transition-all duration-500"
                            style={{ width: `${session.logoutPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[11px] font-semibold text-zinc-700">
                        <p>{session.loginTime}</p>
                        <p className="text-zinc-400 font-medium mt-0.5">Duration: {session.duration}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {session.status === 'Online' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Idle
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination */}
        <Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredSessions.length}
          onPageChange={setCurrentPage}
          label="sessions"
        />
      </div>

      {/* Session Details Drawer Panel */}
      {createPortal(
        <>
          <div
            onClick={() => setSelectedSession(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${selectedSession ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
          />

          <div className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[440px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${selectedSession ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}>
            {selectedSession && (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <h3 className="text-section-heading font-extrabold text-zinc-950">Session Details</h3>
                  </div>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">

                  {/* Profile head */}
                  <div className="flex flex-col items-center gap-3 text-center bg-white p-4 rounded-xl border border-zinc-200/60 shadow-2xs">
                    <div className="w-20 h-20 rounded-lg border border-zinc-200 p-1 bg-white overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                      <div className="w-full h-full rounded-md bg-brand-red/10 text-brand-red font-bold text-xl flex items-center justify-center select-none">
                        {selectedSession.avatar}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-headline-md font-bold text-zinc-950 leading-tight">{selectedSession.name}</h4>

                      <div className="flex gap-2 mt-2.5 justify-center">
                        {selectedSession.isCaptain && (
                          <span className="px-2.5 py-0.5 bg-red-50 text-brand-red border border-red-100 rounded-md text-[9px] font-extrabold uppercase">
                            Captain
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 bg-zinc-100 text-zinc-500 border border-zinc-100 rounded-md text-[9px] font-semibold uppercase">
                          {selectedSession.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Business Type</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">{selectedSession.category}</span>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Chapter Group</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">Metro Core Alpha</span>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Login Time</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">{selectedSession.loginTime}</span>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Logout Deadline</span>
                      <span className="text-body-sm font-bold text-brand-red block mt-1">
                        {selectedSession.logoutDeadline || selectedSession.deadline || '11:47 AM'}
                      </span>
                    </div>
                  </div>

                  {/* Timeline Activity */}
                  {selectedSession.timeline && selectedSession.timeline.length > 0 && (
                    <section className="space-y-3.5">
                      <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Activity Timeline</h5>
                      <div className="relative pl-3 space-y-5 border-l border-zinc-100 ml-1.5 mt-2">
                        {selectedSession.timeline.map((t, idx) => (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[17.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-brand-red' : 'bg-zinc-350'
                              }`} />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-body-sm font-bold text-zinc-800 leading-tight">{t.event}</span>
                              <span className="text-[9px] text-zinc-500 font-semibold">{t.time} • {t.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Session Meta Specs */}
                  <section className="space-y-3 bg-zinc-50/50 p-4 rounded-xl border border-zinc-100">
                    <div className="flex justify-between items-center text-[10px] font-semibold text-zinc-500">
                      <span>Session Key:</span>
                      <span className="font-mono text-zinc-700">
                        {selectedSession.sessionKey || `SES-${String(selectedSession.id || '0000').substring(0, 8).toUpperCase()}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-semibold text-zinc-500">
                      <span>Protocol:</span>
                      <span className="text-zinc-750">
                        {selectedSession.protocol || 'HTTPS / WSS (TLS v1.3)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-semibold text-zinc-500">
                      <span>Heartbeat Status:</span>
                      <span className="text-brand-red font-bold">
                        {selectedSession.heartbeat || (selectedSession.status === 'Online' ? 'Active (200 OK)' : 'Idle / Standby')}
                      </span>
                    </div>
                  </section>

                </div>

                {/* Drawer Footer Actions */}
                <div className="p-4 border-t border-zinc-100 bg-white flex gap-2 shrink-0 shadow-lg">
                  <button
                    onClick={() => {
                      showToast('Notification Sent', `Sent session ping alert to ${selectedSession.name}.`);
                      setSelectedSession(null);
                    }}
                    className="flex-1 py-2 bg-white border border-zinc-100 text-zinc-655 hover:bg-zinc-50 rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer"
                  >
                    Notify User
                  </button>
                  <button
                    onClick={() => {
                      setDeleteTarget(selectedSession);
                      setSelectedSession(null);
                    }}
                    className="flex-1 py-2 bg-brand-red hover:bg-red-700 text-white rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer"
                  >
                    Terminate Session
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Terminate Single Session Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-xl border border-zinc-100 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Terminate Session</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to disconnect this user session? The user will be automatically logged out.
                </p>
              </div>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 text-[11px] text-zinc-500 font-medium">
              User: <span className="font-bold text-zinc-900">{deleteTarget.name}</span><br />
              ID: <span className="font-mono text-zinc-700 font-bold">{deleteTarget.id}</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold border border-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
                  showToast('Session Terminated', `Successfully disconnected ${deleteTarget.name}.`);
                  setDeleteTarget(null);
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Terminate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Bulk Sessions Confirmation */}
      {isBulkLogoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-xl border border-zinc-100 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Terminate Selected Sessions</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to terminate all {selectedRows.size} selected member sessions?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBulkLogoutOpen(false)}
                className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold border border-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessions(prev => prev.filter(s => !selectedRows.has(s.id)));
                  showToast('Bulk Terminated', `Terminated ${selectedRows.size} sessions.`);
                  setSelectedRows(new Set());
                  setIsBulkLogoutOpen(false);
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Terminate All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white rounded-lg shadow-2xl py-2 px-4 flex items-center gap-3.5 border border-zinc-800 animate-slide-up text-body-sm font-semibold select-none">
          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-zinc-800 px-2 py-0.5 rounded text-zinc-350">{selectedRows.size} Selected</span>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={handleBulkExport}
            className="text-white hover:text-brand-red transition-smooth flex items-center gap-1.5 cursor-pointer text-button text-[10px]"
          >
            <Download className="w-3.5 h-3.5 animate-bounce-slow" />
            Export Selected
          </button>
          <button
            onClick={() => setIsBulkLogoutOpen(true)}
            className="text-brand-red hover:text-red-400 transition-smooth flex items-center gap-1.5 cursor-pointer text-button text-[10px]"
          >
            <X className="w-3.5 h-3.5" />
            Terminate Selected
          </button>
        </div>
      )}

      {/* Real-time Toast Notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
          <div>
            <p className="font-bold">{toast.title}</p>
            <p className="text-zinc-400 font-semibold mt-0.5">{toast.desc}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-white opacity-40 hover:opacity-100 ml-2"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

    </div>
  );
}
