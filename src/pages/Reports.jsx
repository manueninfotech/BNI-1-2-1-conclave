import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Pagination from '../components/Pagination';
import { api } from '../services/api';
import {
  Printer,
  FileSpreadsheet,
  FileDown,
  Calendar,
  Search,
  CheckCircle2,
  TrendingUp,
  X,
  PieChart as PieChartIcon,
  Users,
  RefreshCw,
  Shield,
  ChevronDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const initialMembers = [];

export default function Reports({ searchQuery: globalSearchQuery, selectedConclaveId }) {
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_admin_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });
  const [stats, setStats] = useState(() => {
    const cached = localStorage.getItem('bni_admin_stats_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return null;
  });

  useEffect(() => {
    async function loadConclaves() {
      try {
        const data = await api.get('/admin/conclaves');
        if (Array.isArray(data)) {
          setConclaves(data);
          localStorage.setItem('bni_admin_conclaves_cache', JSON.stringify(data));
        }
      } catch (err) {
        console.error("Failed to load conclaves:", err);
      }
    }
    loadConclaves();
  }, []);

  useEffect(() => {
    if (!selectedConclaveId) return;
    async function loadStats() {
      try {
        const data = await api.get(`/admin/conclaves/${selectedConclaveId}/stats`);
        setStats(data);
      } catch (err) {
        console.error("Failed to load conclave stats:", err);
      }
    }
    loadStats();
  }, [selectedConclaveId]);

  const [isConclaveSelectorOpen, setIsConclaveSelectorOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [activeConclaveIndex, setActiveConclaveIndex] = useState(0);

  const selectedConclave = useMemo(() => {
    if (selectedConclaveId) {
      const found = conclaves.find(c => c.id === selectedConclaveId);
      if (found) return found;
    }
    return conclaves[activeConclaveIndex] || conclaves[0] || { name: 'Conclave', details: 'No details available', memberCount: 0 };
  }, [conclaves, selectedConclaveId, activeConclaveIndex]);
  const searchVal = globalSearchQuery !== undefined ? globalSearchQuery : localSearchQuery;
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  const [showRepeatModal, setShowRepeatModal] = useState(false);

  // Lock body scroll when repeat audit modal is active
  useEffect(() => {
    if (showRepeatModal) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showRepeatModal]);

  const repeatPairingDetails = useMemo(() => {
    if (!selectedConclave || !selectedConclave.schedule || !selectedConclave.schedule.rounds) {
      return [];
    }

    const participantsList = selectedConclave.participants || [];
    const pairMap = new Map();

    selectedConclave.schedule.rounds.forEach((rd) => {
      const roundNum = rd.round || rd.roundNumber || rd.number;
      (rd.tables || []).forEach((tbl) => {
        const tableNum = tbl.tableNumber || tbl.number;
        const occupants = [];

        if (tbl.captainId !== undefined || Array.isArray(tbl.memberIds)) {
          if (tbl.captainId !== undefined) {
            const capt = participantsList.find(p => p.id === tbl.captainId) || { id: tbl.captainId, name: `Captain ${tbl.captainId}` };
            occupants.push(capt);
          }
          if (Array.isArray(tbl.memberIds)) {
            tbl.memberIds.forEach(mId => {
              const mem = participantsList.find(p => p.id === mId) || { id: mId, name: `Member ${mId}` };
              occupants.push(mem);
            });
          }
        } else {
          const rawMembers = tbl.participants || tbl.members || [];
          const captainObj = tbl.captain || (tbl.captainName ? { name: tbl.captainName, id: tbl.captainId, uid: tbl.captainId } : null);

          occupants.push(...rawMembers);
          if (captainObj) {
            const captId = captainObj.uid || captainObj.id || captainObj.name;
            if (captId && !occupants.some(p => (p.uid || p.id || p.name) === captId)) {
              occupants.unshift(captainObj);
            }
          }
        }

        for (let i = 0; i < occupants.length; i++) {
          for (let j = i + 1; j < occupants.length; j++) {
            const m1 = occupants[i];
            const m2 = occupants[j];
            const u1 = m1.uid || m1.id || m1._originalUid || m1.name;
            const u2 = m2.uid || m2.id || m2._originalUid || m2.name;

            if (u1 === undefined || u2 === undefined || u1 === u2) continue;

            const sorted = [m1, m2].sort((a, b) => String(a.name || a.id || '').localeCompare(String(b.name || b.id || '')));
            const key = `${sorted[0].uid || sorted[0].id || sorted[0].name}_${sorted[1].uid || sorted[1].id || sorted[1].name}`;

            if (!pairMap.has(key)) {
              pairMap.set(key, {
                member1: sorted[0],
                member2: sorted[1],
                occurrences: []
              });
            }

            pairMap.get(key).occurrences.push({
              round: roundNum,
              tableNumber: tableNum
            });
          }
        }
      });
    });

    const repeats = [];
    pairMap.forEach((val) => {
      if (val.occurrences.length > 1) {
        repeats.push(val);
      }
    });

    return repeats;
  }, [selectedConclave]);

  // Dynamically resolve participants from conclave state
  const conclaveParticipants = useMemo(() => {
    if (!selectedConclave || !selectedConclave.participants) return [];
    return selectedConclave.participants.map((p, idx) => {
      const isCap = p.role === 'captain';
      return {
        id: p.id || String(idx),
        name: p.name || 'Unknown Member',
        region: p.chapter || selectedConclave.region || 'Guntur Central',
        category: p.businessCategory || 'Uncategorized',
        captain: isCap ? 'Table Captain' : 'Regular Member',
        rounds: selectedConclave.scheduleSummary?.roundCount || selectedConclave.roundCount || 4,
        meetings: (selectedConclave.scheduleSummary?.roundCount || selectedConclave.roundCount || 4) * ((selectedConclave.personsPerTable || 8) - 1),
        status: p.isActive ?? true ? 'Checked In' : 'Absent'
      };
    });
  }, [selectedConclave]);

  // Dynamically resolve Categories list for filters dropdown
  const categoriesList = useMemo(() => {
    const set = new Set(conclaveParticipants.map(p => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [conclaveParticipants]);

  // Dynamically resolve Captains list for filters dropdown
  const captainsList = useMemo(() => {
    const namesSet = new Set();
    (selectedConclave?.participants || []).forEach(p => {
      if (p.role === 'captain' || p.isCaptain || p.role === 'CAPTAIN') {
        if (p.name) namesSet.add(p.name);
      }
    });
    (selectedConclave?.schedule?.rounds || []).forEach(r => {
      (r.tables || []).forEach(t => {
        if (t.captainName) namesSet.add(t.captainName);
        if (t.captainId) {
          const p = selectedConclave?.participants?.find(part => part.id === t.captainId);
          if (p?.name) namesSet.add(p.name);
        }
      });
    });
    return Array.from(namesSet).sort();
  }, [selectedConclave]);

  // Recharts Participation Data (R1 - R6) calculated dynamically
  const barData = useMemo(() => {
    const roundsNum = selectedConclave?.scheduleSummary?.roundCount || selectedConclave?.roundCount || 4;
    const totalCaptains = stats?.counts?.captains || selectedConclave?.schedule?.rounds?.[0]?.tables?.filter(t => t.captainId).length || 0;
    const totalMembers = stats?.counts?.members || selectedConclave?.participants?.filter(p => p.role !== 'captain').length || 0;
    
    return Array.from({ length: roundsNum }).map((_, idx) => ({
      name: `R${idx + 1}`,
      Members: totalMembers || 0,
      Captains: totalCaptains || 0
    }));
  }, [selectedConclave, stats]);

  // Recharts Business Diversity Data calculated dynamically
  const donutData = useMemo(() => {
    if (!selectedConclave || !selectedConclave.participants || selectedConclave.participants.length === 0) {
      return [];
    }
    const counts = {};
    selectedConclave.participants.forEach(p => {
      const cat = p.businessCategory || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const colors = ['#af101a', '#005f7b', '#fd867d', '#bee9ff', '#271816', '#ffe2de'];
    return sorted.map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [selectedConclave]);

  // Recharts Mini Gauge Data
  const satisfactionData = useMemo(() => {
    const liveMatchRate = selectedConclave?.scheduleSummary?.coverage !== undefined
      ? Math.round(selectedConclave.scheduleSummary.coverage * 100)
      : 98;
    return [{ value: liveMatchRate }, { value: 100 - liveMatchRate }];
  }, [selectedConclave]);

  const diversityData = useMemo(() => {
    const liveValidationScore = selectedConclave?.warnings?.length
      ? Math.max(70, 100 - selectedConclave.warnings.length * 10)
      : 100;
    return [{ value: liveValidationScore }, { value: 100 - liveValidationScore }];
  }, [selectedConclave]);

  const captainData = useMemo(() => {
    const activePercent = stats?.counts?.registered
      ? Math.round((stats.counts.active / stats.counts.registered) * 100)
      : 100;
    return [{ value: activePercent }, { value: 100 - activePercent }];
  }, [stats]);

  const [filterRound, setFilterRound] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCaptain, setFilterCaptain] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Seating Table filter
  const filteredMembers = useMemo(() => {
    return conclaveParticipants.filter(m => {
      const matchSearch = !searchVal ||
        m.name.toLowerCase().includes(searchVal.toLowerCase()) ||
        m.category.toLowerCase().includes(searchVal.toLowerCase()) ||
        m.captain.toLowerCase().includes(searchVal.toLowerCase());
      const matchCategory = filterCategory === 'all' || m.category === filterCategory;
      const matchCaptain = filterCaptain === 'all' || m.captain === filterCaptain;
      return matchSearch && matchCategory && matchCaptain;
    });
  }, [conclaveParticipants, searchVal, filterCategory, filterCaptain]);

  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMembers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMembers, currentPage]);

  // Reset to page 1 on filter change
  useEffect(() => { setCurrentPage(1); }, [searchVal, filterCategory, filterCaptain]);

  // Export helpers
  const exportCSV = () => {
    const headers = ['Name', 'Region', 'Category', 'Captain', 'Rounds', 'Meetings', 'Status'];
    const rows = filteredMembers.map(m =>
      [m.name, m.region, m.category, m.captain, m.rounds, m.meetings, m.status]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conclave-report-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV Downloaded', `Exported ${filteredMembers.length} member records.`);
  };

  const exportPDF = () => {
    const printContent = `
      <html><head><title>Conclave Report</title>
      <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#af101a;color:white}</style>
      </head><body>
      <h2>Conclave Report — ${selectedConclave.name}</h2>
      <p>${selectedConclave.details}</p>
      <table><thead><tr><th>Name</th><th>Region</th><th>Category</th><th>Captain</th><th>Rounds</th><th>Meetings</th><th>Status</th></tr></thead><tbody>
      ${filteredMembers.map(m => `<tr><td>${m.name}</td><td>${m.region}</td><td>${m.category}</td><td>${m.captain}</td><td>${m.rounds}</td><td>${m.meetings}</td><td>${m.status}</td></tr>`).join('')}
      </tbody></table></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(printContent);
    w.document.close();
    w.focus();
    w.print();
    showToast('PDF Ready', 'Print dialog opened for PDF export.');
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6 animate-fade-in relative">

      {/* Header & Actions */}
      <div className="border-b border-zinc-100 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Reports & Analytics</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Analyze conclave attendance, participation, and scheduling metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 border border-zinc-200 bg-white text-zinc-700 font-bold text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-zinc-400" />
            Print Report
          </button>

          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 border border-zinc-200 bg-white text-zinc-700 font-bold text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
            Export CSV
          </button>

          <button
            onClick={exportPDF}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 bg-brand-red hover:bg-red-700 text-white font-bold text-button rounded-lg transition-smooth shadow-md cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters Selection Card */}
      <section className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-wrap items-center gap-5 shadow-sm">
        <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-1">Selected Conclave</label>
          <div
            onClick={() => setIsConclaveSelectorOpen(true)}
            className="relative cursor-pointer border border-zinc-200 rounded-lg px-4 py-2.5 flex items-center justify-between hover:border-brand-red transition-smooth"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-brand-red" />
              <div>
                <p className="text-body-sm font-bold text-zinc-800">{selectedConclave.name}</p>
                <p className="text-[10px] text-zinc-450 font-semibold">{selectedConclave.details}</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${isConclaveSelectorOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <div className="hidden lg:block w-px h-10 bg-zinc-150" />

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-1">Date Range</label>
            <select
              value={filterRound}
              onChange={e => setFilterRound(e.target.value)}
              className="px-4 py-2.5 border border-zinc-200 bg-white rounded-lg text-body-sm font-bold text-zinc-700 transition-smooth cursor-pointer focus:outline-none focus:border-brand-red"
            >
              <option value="all">All Rounds</option>
              {Array.from({ length: selectedConclave?.roundCount || 4 }).map((_, idx) => (
                <option key={idx + 1} value={`R${idx + 1}`}>{`Round ${idx + 1}`}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-1">Business Type</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 border border-zinc-200 bg-white rounded-lg text-body-sm font-bold text-zinc-700 transition-smooth cursor-pointer focus:outline-none focus:border-brand-red"
            >
              <option value="all">All Categories</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-1">Captain</label>
            <select
              value={filterCaptain}
              onChange={e => setFilterCaptain(e.target.value)}
              className="px-4 py-2.5 border border-zinc-200 bg-white rounded-lg text-body-sm font-bold text-zinc-700 transition-smooth cursor-pointer focus:outline-none focus:border-brand-red"
            >
              <option value="all">All Captains</option>
              {captainsList.map(cap => (
                <option key={cap} value={cap}>{cap}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* KPI Dashboard Row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-smooth">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-brand-red">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">Total Members</p>
            <h4 className="text-headline-md font-extrabold text-zinc-955 mt-0.5">
              {(stats?.counts?.registered || selectedConclave?.participants?.length || 0).toLocaleString()}
            </h4>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-smooth">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-500">
              <TrendingUp className="w-4.5 h-4.5 text-brand-red" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">Unique Meetings</p>
            <h4 className="text-headline-md font-extrabold text-zinc-955 mt-0.5">
              {selectedConclave?.scheduleSummary?.coverage ? `${Math.round(selectedConclave.scheduleSummary.coverage * 100)}%` : '0%'}
            </h4>
          </div>
        </div>

        <div 
          onClick={() => setShowRepeatModal(true)}
          className="bg-white border border-zinc-200/80 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md hover:border-brand-red/40 transition-smooth cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-500">
              <RefreshCw className="w-4.5 h-4.5 text-brand-red" />
            </div>
            <span className="text-[9px] font-extrabold text-brand-red opacity-80 group-hover:opacity-100 transition-opacity">View Names →</span>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">Repeat Pairings</p>
            <h4 className="text-headline-md font-extrabold text-zinc-955 mt-0.5">
              {selectedConclave?.schedule?.rounds?.length
                ? repeatPairingDetails.length
                : (selectedConclave?.scheduleSummary?.repeatPairings !== undefined ? selectedConclave.scheduleSummary.repeatPairings : 0)}
            </h4>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-smooth">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-500">
              <CheckCircle2 className="w-4.5 h-4.5 text-brand-red" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">Seating Quality</p>
            <h4 className="text-headline-md font-extrabold text-zinc-955 mt-0.5">
              {selectedConclave?.scheduleSummary?.coverage ? Math.round(selectedConclave.scheduleSummary.coverage * 100) : 0}
              <span className="text-body-sm font-normal text-zinc-455">/100</span>
            </h4>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-smooth">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-500">
              <Shield className="w-4.5 h-4.5 text-brand-red" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">Validation Score</p>
            <h4 className="text-headline-md font-extrabold text-zinc-955 mt-0.5">
              {selectedConclave?.warnings?.length ? Math.max(70, 100 - selectedConclave.warnings.length * 10) : 100}
              <span className="text-body-sm font-normal text-zinc-455">/100</span>
            </h4>
          </div>
        </div>
      </section>

      {/* Event Performance Analytics section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
        {/* Attendance breakdown */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 mb-4">
              <h4 className="text-body-sm font-extrabold text-zinc-955 uppercase">Attendance Breakdown</h4>
              <span className="px-2 py-0.5 bg-red-50 text-brand-red border border-red-100 rounded text-[9px] font-extrabold tracking-wider">LIVE</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-body-sm font-bold text-zinc-700 mb-1.5">
                  <span>Checked In (Active)</span>
                  <span>{stats?.counts?.active || 0} / {stats?.counts?.registered || 0}</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-red rounded-full transition-all duration-500" 
                    style={{ width: `${stats?.counts?.registered ? Math.round((stats.counts.active / stats.counts.registered) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px] font-semibold text-zinc-550 pt-2 border-t border-dashed border-zinc-100">
                <div>
                  <p className="text-zinc-450">Checked In Ratio</p>
                  <p className="text-body-sm font-bold text-zinc-800 mt-0.5">
                    {stats?.counts?.registered ? `${Math.round((stats.counts.active / stats.counts.registered) * 100)}%` : '0%'}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-450">Absent Members</p>
                  <p className="text-body-sm font-bold text-zinc-800 mt-0.5">
                    {(stats?.counts?.registered || 0) - (stats?.counts?.active || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Productivity */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 mb-4">
              <h4 className="text-body-sm font-extrabold text-zinc-955 uppercase">Referral Productivity</h4>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded text-[9px] font-extrabold tracking-wider">KPI</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[28px] font-black text-zinc-900 tracking-tight">{stats?.counts?.referrals || 0}</p>
                  <p className="text-[10px] text-zinc-450 font-bold uppercase mt-0.5">Total Referrals Logged</p>
                </div>
                <div className="text-right">
                  <p className="text-[28px] font-black text-brand-red tracking-tight">
                    {stats?.counts?.active ? (stats.counts.referrals / stats.counts.active).toFixed(2) : '0.00'}
                  </p>
                  <p className="text-[10px] text-zinc-450 font-bold uppercase mt-0.5">Avg Referrals / Attendee</p>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 bg-zinc-50/50 rounded-lg p-2.5 border border-zinc-150 font-semibold leading-relaxed">
                Referral logging measures the direct business value generated face-to-face during the conclave's rotating rounds.
              </div>
            </div>
          </div>
        </div>

        {/* Table Seating Allocation */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 mb-4">
              <h4 className="text-body-sm font-extrabold text-zinc-955 uppercase">Table Allocation</h4>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 rounded text-[9px] font-extrabold tracking-wider">ENGINE</span>
            </div>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-zinc-500">Seating Density Limit</span>
                <span className="font-extrabold text-zinc-800 text-body-sm">{selectedConclave?.personsPerTable || 8} Members / Table</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-zinc-500">Total Seated Captains</span>
                <span className="font-extrabold text-zinc-800 text-body-sm">
                  {stats?.counts?.captains || selectedConclave?.schedule?.rounds?.[0]?.tables?.filter(t => t.captainId).length || 0} Captains
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-zinc-500">Active Rounds Run</span>
                <span className="font-extrabold text-zinc-800 text-body-sm">
                  {selectedConclave?.currentRound || 0} / {selectedConclave?.scheduleSummary?.roundCount || selectedConclave?.roundCount || 4} Rounds
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Main section */}
      <div className="space-y-6">

        {/* Charts & Tables Area */}
        <div className="space-y-6">

          {/* Member table section */}
          <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/20">
              <h3 className="text-body-sm font-extrabold text-zinc-950 uppercase">Member Participation</h3>
              <div className="flex gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchVal}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                    placeholder="Search members..."
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100 text-[10px] font-bold text-zinc-455 uppercase">
                    <th className="px-6 py-3">Member</th>
                    <th className="px-6 py-3">Business Type</th>
                    <th className="px-6 py-3">Captain</th>
                    <th className="px-6 py-3">Rounds</th>
                    <th className="px-6 py-3">Meetings</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 font-semibold text-zinc-650">
                  {paginatedMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/10">
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-50 text-brand-red border border-red-100 flex items-center justify-center font-bold text-[11px] shadow-xs shrink-0">
                            {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-800 leading-tight">{m.name}</p>
                            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">{m.region}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-md text-[10.5px] font-extrabold border border-zinc-200/80">
                          {m.category}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
                          <span className="text-[11px] whitespace-nowrap">{m.captain}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4.5 font-mono">{m.rounds}</td>
                      <td className="px-6 py-4.5 font-mono">{m.meetings}</td>
                      <td className="px-6 py-4.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border uppercase whitespace-nowrap ${m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-zinc-400 italic py-8">No matching records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Reusable Pagination Component */}
            <Pagination
              totalItems={filteredMembers.length}
              itemsPerPage={ITEMS_PER_PAGE}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              label="members"
            />
          </div>
        </div>
      </div>

      {/* SWITCH ACTIVE CONCLAVE SELECTOR MODAL */}
      {isConclaveSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-zinc-950 text-body-sm">Switch Conclave Data</h3>
              <button type="button" onClick={() => setIsConclaveSelectorOpen(false)} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 transition-smooth">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 max-h-[50vh] overflow-y-auto">
              {conclaves.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveConclaveIndex(idx);
                    setIsConclaveSelectorOpen(false);
                    showToast('Conclave Swapped', `Displaying analytics logs for ${c.name}.`);
                  }}
                  className={`p-3.5 border rounded-xl cursor-pointer transition-smooth flex items-center justify-between ${idx === activeConclaveIndex ? 'border-brand-red bg-red-50/10' : 'border-zinc-100 hover:bg-zinc-50'
                    }`}
                >
                  <div>
                    <h4 className="text-body-sm font-bold text-zinc-900 leading-tight">{c.name}</h4>
                    <p className="text-[10px] text-zinc-450 font-semibold mt-1">{c.details || c.venueLocation || c.venue || 'No details available'}</p>
                  </div>
                  {idx === activeConclaveIndex && (
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-red" />
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsConclaveSelectorOpen(false)}
                className="px-4 py-2 border border-zinc-100 bg-white text-zinc-700 text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repeat Pairings Audit Modal */}
      {showRepeatModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl space-y-5 border border-zinc-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 shrink-0">
              <div>
                <h3 className="text-body-lg font-black text-zinc-900">Repeat Pairings Audit</h3>
                <p className="text-[11px] text-zinc-400 font-medium">Members seated together more than once across rounds</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRepeatModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-smooth cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 flex-1">
              {repeatPairingDetails.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto font-black text-lg">✓</div>
                  <h4 className="text-body-md font-extrabold text-emerald-900">Zero Repeat Pairings!</h4>
                  <p className="text-[11px] text-emerald-700">Every member meets 100% unique partners in every single round of this conclave.</p>
                </div>
              ) : (
                repeatPairingDetails.map((pair, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-brand-red bg-red-50 px-2 py-0.5 rounded border border-brand-red/10">
                        {pair.occurrences.length} Times Paired
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-lg border border-zinc-200/60 shadow-2xs">
                        <p className="text-[12px] font-black text-zinc-850 truncate">{pair.member1.name}</p>
                        <p className="text-[10px] text-zinc-450 truncate mt-0.5">{pair.member1.company || pair.member1.businessCategory || 'Member 1'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-zinc-200/60 shadow-2xs">
                        <p className="text-[12px] font-black text-zinc-850 truncate">{pair.member2.name}</p>
                        <p className="text-[10px] text-zinc-450 truncate mt-0.5">{pair.member2.company || pair.member2.businessCategory || 'Member 2'}</p>
                      </div>
                    </div>
                    <div className="text-[10.5px] text-zinc-500 font-medium pt-1">
                      <span className="font-bold text-zinc-700">Seated Together: </span>
                      {pair.occurrences.map(o => `Round ${o.round} (Table ${o.tableNumber})`).join(' & ')}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 text-right shrink-0">
              <button
                type="button"
                onClick={() => setShowRepeatModal(false)}
                className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-[12px] rounded-xl transition-smooth cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
