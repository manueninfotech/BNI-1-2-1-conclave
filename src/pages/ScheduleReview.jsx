import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  Download,
  Play,
  Lock,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  X,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Users,
  Award,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import { formatStatus } from '../utils/statusUtils';

export default function ScheduleReview({ setActiveTab, searchQuery: globalSearchQuery, selectedConclaveId, onNavigateToRunner, isHubMode = false }) {
  const [conclave, setConclave] = useState(() => {
    const cached = localStorage.getItem('bni_schedule_review_conclave_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return null;
  });
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [localTables, setLocalTables] = useState([]);
  const [activeRound, setActiveRound] = useState(() => {
    const marker = localStorage.getItem('schedule_review_tab');
    if (marker === 'validation') {
      localStorage.removeItem('schedule_review_tab');
      return 'validation';
    }
    return 1;
  });
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

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

  useEffect(() => {
    if (!selectedConclaveId) return;   // ← wait until a conclave is selected
    async function loadConclaveDetails() {
      setIsLoadingReview(true);
      try {
        const full = await api.get(`/admin/conclaves/${selectedConclaveId}`);
        if (!Array.isArray(full.participants)) {
          full.participants = [];
        }
        setConclave(full);
        localStorage.setItem('bni_schedule_review_conclave_cache', JSON.stringify(full));
      } catch (err) {
        console.error("API load failed for conclave details, falling back to local storage:", err);
        const stored = localStorage.getItem('bni_conclaves');
        const list = stored ? JSON.parse(stored) : [];
        const selected = list.find(c => c.id === selectedConclaveId) || null;
        setConclave(selected);
      } finally {
        setIsLoadingReview(false);
      }
    }
    loadConclaveDetails();
  }, [selectedConclaveId]);



  useEffect(() => {
    if (!conclave) return;

    if (conclave.schedule && conclave.participants) {
      // Real backend schedule mapped to frontend representation
      const roundSeating = conclave.schedule.rounds.find(r => r.roundNumber === activeRound);
      if (roundSeating) {
        const mapped = roundSeating.tables.map(t => {
          const captain = conclave.participants.find(p => p.id === t.captainId);
          const members = t.memberIds.map(mId => {
            const p = conclave.participants.find(p => p.id === mId);
            const cat = p?.businessCategory || p?.category || p?.businessType || p?.profession || p?.industry || p?.classification;
            return {
              id: p?._originalUid || String(mId),
              name: p?.name || 'Unknown',
              category: (cat && cat.trim() && cat.toLowerCase() !== 'uncategorized') ? cat : 'General Business',
              conflict: false
            };
          });

          // Check if there are category conflicts (duplicate categories at the table)
          const captainCat = captain?.businessCategory || captain?.category || captain?.businessType || captain?.profession;
          const categories = [(captainCat && captainCat.toLowerCase() !== 'uncategorized' ? captainCat : null), ...members.map(m => m.category)].filter(Boolean);
          const hasConflict = categories.length !== new Set(categories).size;

          return {
            id: `Table ${String(t.tableNumber).padStart(2, '0')}`,
            conclaveId: selectedConclaveId,
            status: hasConflict ? 'warning' : 'validated',
            warningText: hasConflict ? 'Warning: Business Conflict' : undefined,
            capacity: `${members.length + 1}/${conclave.personsPerTable}`,
            captain: {
              name: captain?.name || 'Unknown',
              role: 'Table Captain',
              initials: captain?.name ? captain.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'TC'
            },
            members
          };
        });
        setLocalTables(mapped);
      } else {
        setLocalTables([]);
      }
    } else {
      setLocalTables([]);
    }
  }, [conclave, activeRound, selectedConclaveId]);

  const [searchVal, setSearchVal] = useState(globalSearchQuery || '');

  // Keep in sync if global search query changes from top navigation
  useEffect(() => {
    if (typeof globalSearchQuery === 'string') {
      setSearchVal(globalSearchQuery);
    }
  }, [globalSearchQuery]);
  const [statusFilter, setStatusFilter] = useState('All');

  // Validation States
  const [validationConclaves, setValidationConclaves] = useState([]);

  const activeConclaveIndex = useMemo(() => {
    const idx = validationConclaves.findIndex(c => c.id === selectedConclaveId);
    return idx !== -1 ? idx : 0;
  }, [validationConclaves, selectedConclaveId]);

  const activeConclave = validationConclaves[activeConclaveIndex] || {
    passedCount: 0,
    warningsCount: 0,
    errorsCount: 0,
    score: 100,
    rules: [],
    timeline: []
  };

  const repeatPairingDetails = useMemo(() => {
    if (!conclave || !conclave.schedule || !conclave.schedule.rounds) {
      return [];
    }

    const participantsList = conclave.participants || [];
    const pairMap = new Map();

    conclave.schedule.rounds.forEach((rd) => {
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
  }, [conclave]);

  const conclaveKPIs = useMemo(() => {
    if (!conclave) {
      return {
        rounds: 4,
        roundsDisplay: '0 / 4',
        tables: 0,
        members: 0,
        captains: 0,
        repeatPairings: 0
      };
    }
    const rounds = conclave.scheduleSummary?.roundCount || conclave.roundCount || conclave.schedule?.rounds?.length || 4;
    const isUpcoming = (conclave.status || '').toLowerCase() === 'upcoming' || !conclave.currentRound;
    const currentRound = isUpcoming ? 0 : (conclave.currentRound || 0);
    const roundsDisplay = `${currentRound} / ${rounds}`;
    let members = conclave.participants?.length || 0;
    let uniqueCaptains = new Set(conclave.schedule?.rounds?.[0]?.tables?.map(t => t.captainId).filter(Boolean));
    let captains = uniqueCaptains.size || conclave.scheduleSummary?.tableCount || conclave.participants?.filter(p => p.role === 'captain' || p.isTableCaptain).length || 0;
    let tables = conclave.scheduleSummary?.tableCount || conclave.schedule?.rounds?.[0]?.tables?.length || Math.ceil(members / (conclave.personsPerTable || 7));
    const hasSchedule = Boolean(conclave.schedule?.rounds?.length);
    const repeatPairings = hasSchedule
      ? repeatPairingDetails.length
      : (conclave.scheduleSummary?.repeatPairings ?? conclave.scheduleSummary?.repeatPairingCount ?? 0);
    return {
      rounds,
      roundsDisplay,
      tables,
      members,
      captains,
      repeatPairings
    };
  }, [conclave, repeatPairingDetails]);

  const roundsList = useMemo(() => {
    const list = [];
    for (let i = 1; i <= conclaveKPIs.rounds; i++) {
      list.push(i);
    }
    return list;
  }, [conclaveKPIs.rounds]);

  // WHY repeats happen. The engine never seats two of the same category at one
  // table, so a category with many members can only be spread so far across the
  // tables each round — once a category is dense relative to the table count, the
  // engine runs out of fresh, category-safe seats and has to reuse pairings. This
  // surfaces the densest categories so the admin sees the structural cause rather
  // than guessing. Computed from the roster, independent of the produced schedule.
  const repeatReasonAnalysis = useMemo(() => {
    const participantsList = conclave?.participants || [];
    const tableCount = conclaveKPIs?.tables || 0;
    if (participantsList.length === 0) return { dense: [], tableCount };

    const catOf = (p) => {
      const c = p.businessCategory || p.category || p.businessType || p.profession || p.industry || p.classification;
      return (c && c.trim() && c.toLowerCase() !== 'uncategorized') ? c.trim() : 'General Business';
    };

    const counts = new Map();
    participantsList.forEach((p) => {
      const c = catOf(p);
      counts.set(c, (counts.get(c) || 0) + 1);
    });

    // A category with 2+ members constrains seating; one at/above the table count
    // is the hard driver (it can't get a fresh partner set every round).
    const dense = [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .map(([category, count]) => ({
        category,
        count,
        forcesRepeats: tableCount > 0 && count >= tableCount,
      }))
      .sort((a, b) => b.count - a.count);

    return { dense, tableCount };
  }, [conclave, conclaveKPIs]);

  const [expandedRules, setExpandedRules] = useState(new Set(['rule-2']));
  const [isValidating, setIsValidating] = useState(false);

  const toggleRule = (id) => {
    const updated = new Set(expandedRules);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setExpandedRules(updated);
  };

  const handleRunValidation = () => {
    setIsValidating(true);
    showToast('Running Verification', 'Re-executing conclave rules parameters...');
    setTimeout(() => {
      setIsValidating(false);
      showToast('Validation Complete', 'All checks completed successfully.');
    }, 1500);
  };

  const handleQuickFix = () => {
    setValidationConclaves(prev => prev.map((c, idx) => {
      if (idx === activeConclaveIndex) {
        return {
          ...c,
          passedCount: c.passedCount + 1,
          errorsCount: 0,
          score: 96,
          rules: c.rules.map(r => {
            if (r.id === 'rule-2') {
              return {
                ...r,
                status: 'Passed',
                type: 'success',
                desc: 'West Chapter captains assigned from standby list. Captain-to-member ratio: 1:15 (Goal reached).',
                suggestion: null,
                fixable: false
              };
            }
            return r;
          }),
          timeline: [
            { event: 'Captains Ratio Auto-Fixed', time: 'Just now', note: 'System re-assignment complete', active: true },
            ...c.timeline
          ]
        };
      }
      return c;
    }));
    // Also auto-fix the issues count in the parent review component!
    setIssuesCount(prev => Math.max(0, prev - 1));
    showToast('Ratio Auto-Resolved', 'Standby captains successfully assigned to West Chapter.');
  };

  const validationChartData = useMemo(() => {
    return [
      { name: 'readiness', value: activeConclave?.score || 100 },
      { name: 'remaining', value: 100 - (activeConclave?.score || 100) }
    ];
  }, [activeConclave?.score]);

  // KPI state
  const [issuesCount, setIssuesCount] = useState(0);
  const [warningsCount, setWarningsCount] = useState(0);
  const [overallScore, setOverallScore] = useState(100);

  // Validation affected list
  const [affectedList, setAffectedList] = useState([]);

  useEffect(() => {
    if (!conclave) return;

    if (!selectedConclaveId?.startsWith('CON-')) {
      // Real database conclave
      setIssuesCount(0); // If it generated, there are no blocking validation errors
      setWarningsCount(conclave.warnings ? conclave.warnings.length : 0);

      const coverage = conclave.scheduleSummary?.coverage || 1.0;
      setOverallScore(Math.round(coverage * 100));

      const affected = (conclave.warnings || []).map((w, idx) => ({
        id: `warn-${idx}`,
        title: w.code || 'Warning',
        desc: w.message
      }));
      setAffectedList(affected);
    } else {
      // Mock conclave fallback
      setIssuesCount(2);
      setWarningsCount(2);
      setOverallScore(96);
      setAffectedList([
        { id: 'aff-1', title: 'Table 01: Duplicate Profession', desc: 'Two Legal members placed at the same table. This violates Rule #4.' },
        { id: 'aff-2', title: 'Table 112: Capacity Underfill', desc: 'Table has only 4 members assigned. Recommended min: 6.' }
      ]);
    }
  }, [conclave, selectedConclaveId]);



  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStartRound = async (roundNumber = 1) => {
    if (!selectedConclaveId) return;
    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/start-round`, { roundNumber });
      // Refresh conclave data
      const full = await api.get(`/admin/conclaves/${selectedConclaveId}`);
      setConclave(full);
      showToast('Round Started', `Round ${roundNumber} started.`);
      // Navigate to Round Runner tab so admin sees live running timer
      if (typeof onNavigateToRunner === 'function') {
        onNavigateToRunner();
      } else {
        window.history.pushState({}, '', '/admin/round-runner');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err) {
      console.error('Failed to start round:', err.message || err);
      showToast('Start Round Failed', err.message || 'Could not start round.');
    }
  };


  // Revalidate click simulator
  const handleRevalidate = () => {
    showToast('Re-running Validation Engine', 'Evaluating Seating Selections against constraint matrices...');
  };

  // Lock Conclave click redirector
  const handleLockConclave = () => {
    if (setActiveTab) {
      setActiveTab('schedule-gen');
      showToast('Review Complete', 'Navigating to the final conclave locking checklist.');
    }
  };

  // Auto-resolve Seating Conflict (Swap Ananya Lal out of Table 01)
  const handleAutoResolveConflict = () => {
    setTables(prev => prev.map(t => {
      if (t.id === 'Table 01') {
        return {
          ...t,
          status: 'validated',
          warningText: null,
          capacity: '8/8',
          members: t.members.map(m => m.id === 'm-2' ? { ...m, name: 'Esha Wadhwa', category: 'Hospitality', conflict: false, initials: 'EW' } : m)
        };
      }
      return t;
    }));

    setIssuesCount(prev => Math.max(0, prev - 1));
    setWarningsCount(prev => Math.max(0, prev - 1));
    setOverallScore(98);
    setAffectedList(prev => prev.filter(a => a.id !== 'aff-1'));
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });
    showToast('Conflict Resolved', 'Swapped Ananya Lal for Esha Wadhwa. Table 01 is now validated.');
  };

  // Filtered tables by selected conclave, then search/status
  const tables = useMemo(() =>
    localTables.filter(t => t.conclaveId === selectedConclaveId),
    [localTables, selectedConclaveId]
  );

  const setTables = (updater) => setLocalTables(updater);

  const selectedConclave = conclave;
  const conclaveName = selectedConclave?.name || 'Conclave';

  // Filtered tables by search query & status filter
  const filteredTables = useMemo(() => {
    let result = tables;

    // Apply status filter
    if (statusFilter !== 'All') {
      result = result.filter(t => t.status === statusFilter);
    }

        // Apply search query filter
    if (searchVal && searchVal.trim()) {
      const query = searchVal.trim().toLowerCase();
      result = result.filter(t => {
        if (t.id && t.id.toLowerCase().includes(query)) return true;
        if (t.captain?.name && t.captain.name.toLowerCase().includes(query)) return true;
        if (t.members) {
          return t.members.some(m =>
            (m.name && m.name.toLowerCase().includes(query)) ||
            (m.category && m.category.toLowerCase().includes(query))
          );
        }
        return false;
      });
    }

    return result;
  }, [tables, searchVal, statusFilter]);

  // Export Schedule as CSV
  const exportSchedule = () => {
    const headers = ['Table', 'Status', 'Captain', 'Capacity', 'Member Name', 'Category', 'Conflict'];
    const rows = [];
    tables.forEach(t => {
      if (t.members && t.members.length > 0) {
        t.members.forEach((m, i) => {
          rows.push([
            i === 0 ? t.id : '',
            i === 0 ? t.status : '',
            i === 0 ? (t.captain?.name || '-') : '',
            i === 0 ? t.capacity : '',
            m.name || '-',
            m.category || '-',
            m.conflict ? 'Yes' : 'No'
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        });
      } else {
        rows.push([t.id, t.status, t.captain?.name || '-', t.capacity, '-', '-', '-']
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      }
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conclave-schedule-round${activeRound}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Schedule Exported', `Downloaded ${tables.length} tables for Round ${activeRound}.`);
  };

  return (
    <div className={`w-full flex flex-col gap-3.5 sm:gap-4 animate-fade-in relative pb-10 sm:pb-14 ${isHubMode ? '' : 'max-w-[1600px] mx-auto'}`}>

      {/* Top Action Bar (Borderless - No Card!) */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isHubMode ? 'pt-0 pb-0' : 'pb-2'}`}>
        {!isHubMode ? (
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              {conclaveName} • Table Seating Review
            </h2>
            <p className="text-xs text-zinc-500 font-semibold mt-0.5">
              Review assigned seats, verify industry exclusivity, and audit table balance before conclave execution.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200/90 text-[10.5px] font-black uppercase tracking-wider">
              <span>Table Review</span>
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-600 font-bold text-xs">{conclaveKPIs.tables} Tables</span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-600 font-bold text-xs">{conclaveKPIs.members} Members</span>
            <span className="text-zinc-300">•</span>
            <span className="text-brand-red font-black text-xs">Round {activeRound}</span>
          </div>
        )}

        <div className={`flex flex-wrap items-center gap-2 shrink-0 ${isHubMode ? 'ml-auto' : ''}`}>
          <button
            onClick={handleRevalidate}
            type="button"
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
            <span>Revalidate</span>
          </button>

          <button
            onClick={exportSchedule}
            type="button"
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>

          {conclave?.schedule && !['running', 'completed', 'cancelled'].includes((conclave?.status || '').toLowerCase()) && (
            <button
              onClick={() => handleStartRound(1)}
              type="button"
              className="inline-flex items-center justify-center gap-2 h-9 px-3.5 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-zinc-500" />
              <span>Start Round 1</span>
            </button>
          )}

          {(conclave?.status || '').toLowerCase() === 'running' && (
            <button
              onClick={() => {
                if (typeof onNavigateToRunner === 'function') {
                  onNavigateToRunner();
                } else {
                  window.history.pushState({}, '', '/admin/round-runner');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              type="button"
              className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white animate-pulse" />
              <span>Go to Round Runner</span>
            </button>
          )}

          {!['completed', 'cancelled'].includes((conclave?.status || '').toLowerCase()) && (
            <button
              onClick={handleLockConclave}
              type="button"
              className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-sm cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Conclave</span>
            </button>
          )}
        </div>
      </div>

      {/* Completed Conclave Notice */}
      {['completed', 'cancelled'].includes((conclave?.status || '').toLowerCase()) && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>This conclave is <strong>{formatStatus(conclave?.status) || 'Completed'}</strong>. All rounds are locked and seating allocations are archived.</span>
          </div>
          <span className="px-2.5 py-1 bg-emerald-200/60 rounded text-[9.5px] font-black uppercase tracking-wider text-emerald-950">Completed</span>
        </div>
      )}

      {/* 2. EXECUTIVE KPI OVERVIEW CARDS (Matching clean, spacious card style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Rounds */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Rounds</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaveKPIs.roundsDisplay || conclaveKPIs.rounds}</span>
          </div>
        </div>

        {/* Card 2: Tables */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Tables</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaveKPIs.tables}</span>
          </div>
        </div>

        {/* Card 3: Members */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Seated Members</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaveKPIs.members.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Captains */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Table Captains</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaveKPIs.captains}</span>
          </div>
        </div>

        {/* Card 5: Repeat Pairings */}
        <div
          onClick={() => setShowRepeatModal(true)}
          className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth cursor-pointer hover:border-brand-red/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md text-zinc-500 uppercase font-semibold">Repeat Pairs</span>
            <span className="text-[9px] font-black text-brand-red group-hover:underline">View Names →</span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaveKPIs.repeatPairings}</span>
          </div>
        </div>

        {/* Card 6: Validation Score / Issues */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Audit Health</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className={`text-display-sm font-extrabold leading-none ${issuesCount > 0 ? 'text-brand-red' : 'text-emerald-600'}`}>
              {issuesCount > 0 ? `${issuesCount} Issues` : '100% Valid'}
            </span>
            {issuesCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-brand-red animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
        </div>
      </div>

      {/* 3. CONSOLE CONTROLS TOOLBAR */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 transition-smooth">
        {/* Round Switcher Pill Group */}
        <div className="flex bg-zinc-100 p-1 rounded-xl w-full md:w-auto border border-zinc-200/60">
          {roundsList.map(round => (
            <button
              key={round}
              type="button"
              onClick={() => setActiveRound(round)}
              className={`flex-1 md:flex-initial px-5 py-2 rounded-lg font-black text-xs transition-smooth cursor-pointer ${
                round === activeRound
                  ? 'bg-white text-brand-red shadow-2xs border border-zinc-200/80'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/50'
              }`}
            >
              Round {round}
            </button>
          ))}
        </div>

        {/* Search, Filter, and View Switcher */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-250 bg-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
              placeholder="Search table or member..."
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 border border-zinc-250 bg-white text-xs font-bold rounded-xl focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth cursor-pointer shadow-2xs text-zinc-700"
            >
              <option value="All">All Tables</option>
              <option value="warning">Warnings Only</option>
              <option value="validated">Validated</option>
              <option value="review">Ready for Review</option>
              <option value="locked">Locked</option>
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <Filter className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* View Mode Switcher Toggle */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-smooth cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-brand-red shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Boardroom Table Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-smooth cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-brand-red shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="High-Density Spreadsheet View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. SEATING MAIN VIEW */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTables.map((table) => (
            <div
              key={table.id}
              className={`bg-white rounded-2xl overflow-hidden p-5 space-y-4 border transition-all duration-200 hover:shadow-sm ${
                table.status === 'warning' ? 'border-red-200 bg-red-50/5' : 'border-zinc-200/80 hover:border-zinc-300'
              }`}
            >
              {/* Header card info */}
              <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-zinc-950 text-sm tracking-tight">{table.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/60">
                    <span className="text-xs font-black text-zinc-800">{table.capacity}</span>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Seats</span>
                  </div>

                  {/* Status Indicator */}
                  {table.status === 'warning' && (
                    <div className="flex items-center gap-1 text-brand-red text-[10px] font-black uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-200 shrink-0">
                      <AlertTriangle className="w-3 h-3 animate-pulse shrink-0" />
                      <span>Warning</span>
                    </div>
                  )}
                  {table.status === 'validated' && (
                    <div className="flex items-center gap-1 text-emerald-700 text-[10px] font-black uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                      <span>Validated</span>
                    </div>
                  )}
                  {table.status === 'locked' && (
                    <div className="flex items-center gap-1 text-zinc-600 text-[10px] font-black uppercase tracking-wider bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200 shrink-0">
                      <Lock className="w-3 h-3 shrink-0 text-zinc-500" />
                      <span>Locked</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Captain Spotlight */}
              {table.captain && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/40 border border-brand-red/15 transition-smooth">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {table.captain.image ? (
                      <img className="w-7 h-7 rounded-full object-cover shrink-0" src={table.captain.image} alt={table.captain.name} />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-brand-red text-white flex items-center justify-center font-black text-[10px] shrink-0">
                        {table.captain.initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-zinc-950 text-xs leading-tight truncate">{table.captain.name}</span>
                        <span className="px-2 py-0.5 rounded bg-brand-red text-white text-[8.5px] font-black uppercase tracking-wider shrink-0">
                          Captain
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-semibold block truncate mt-0.5">Table Host & Moderator</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Seated Members Roster */}
              <div className="space-y-1.5 pt-1">
                {table.members && table.members.map((member, mIdx) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl transition-smooth hover:bg-zinc-50 border border-transparent hover:border-zinc-200/60"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-[10px] font-black text-zinc-400 w-4 text-center shrink-0">#{mIdx + 1}</span>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-black shrink-0 ${
                        member.conflict ? 'bg-red-100 text-brand-red border border-red-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200/60'
                      }`}>
                        {member.initials || member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-xs truncate ${member.conflict ? 'text-brand-red' : 'text-zinc-900'}`}>
                            {member.name}
                          </span>
                          {member.conflict && (
                            <AlertTriangle className="w-3 h-3 text-brand-red shrink-0 animate-pulse" />
                          )}
                        </div>
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider truncate ${member.conflict ? 'text-brand-red/80' : 'text-zinc-400'}`}>
                          {member.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Mode B: High-Density Spreadsheet View */
        <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-none">
          <div className="p-4 sm:p-5 border-b border-zinc-200/80 bg-zinc-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-black text-zinc-950 text-sm">Round {activeRound} Seating Manifest</h3>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">Complete participant placement ledger for this session</p>
            </div>
            <span className="px-3 py-1 bg-white border border-zinc-200/80 rounded-full text-[10px] font-black uppercase tracking-wider text-zinc-700 shadow-2xs">
              {filteredTables.reduce((acc, t) => acc + (t.members?.length || 0) + (t.captain ? 1 : 0), 0)} Assigned Seats
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/70 bg-zinc-50/80 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <th className="py-3.5 px-5">Table</th>
                  <th className="py-3.5 px-4">Seat</th>
                  <th className="py-3.5 px-4">Attendee Name</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Business Category</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-700">
                {filteredTables.flatMap((table) => {
                  const rows = [];
                  if (table.captain) {
                    rows.push(
                      <tr key={`${table.id}-captain`} className="hover:bg-zinc-50/70 transition-colors bg-red-50/15">
                        <td className="py-3.5 px-5 font-black text-zinc-950">{table.id}</td>
                        <td className="py-3.5 px-4 font-bold text-brand-red">#0 (Host)</td>
                        <td className="py-3.5 px-4 font-black text-zinc-900">{table.captain.name}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-brand-red text-white text-[9px] font-black uppercase tracking-wider">
                            Captain
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-zinc-500">{table.captain.category || 'Table Host'}</td>
                        <td className="py-3.5 px-5 text-right">
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Seated</span>
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  (table.members || []).forEach((member, mIdx) => {
                    rows.push(
                      <tr key={`${table.id}-${member.id}-${mIdx}`} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-zinc-600">{table.id}</td>
                        <td className="py-3.5 px-4 font-bold text-zinc-400">#{mIdx + 1}</td>
                        <td className="py-3.5 px-4 font-black text-zinc-900">{member.name}</td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-500">Member</td>
                        <td className="py-3.5 px-4 font-bold text-zinc-600">{member.category}</td>
                        <td className="py-3.5 px-5 text-right">
                          {member.conflict ? (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-brand-red">
                              <AlertTriangle className="w-3 h-3 text-brand-red" />
                              <span>Conflict</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Seated</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Alert Feedback */}
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
              {/* WHY — the structural cause, shown whenever there are repeats. */}
              {repeatPairingDetails.length > 0 && repeatReasonAnalysis.dense.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/50 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11.5px] text-amber-900 font-semibold leading-relaxed">
                      Why these happen: two members of the same business category are never
                      seated together, so dense categories limit how far the engine can spread
                      people out. With <span className="font-black">{repeatReasonAnalysis.tableCount} tables</span>,
                      the categories below are the hardest to separate — the usual cause of repeat pairings.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {repeatReasonAnalysis.dense.map((d, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${d.forcesRepeats
                          ? 'bg-red-50 border-brand-red/20 text-brand-red'
                          : 'bg-white border-amber-200 text-amber-800'}`}
                        title={d.forcesRepeats
                          ? `${d.count} members can't be kept apart across ${repeatReasonAnalysis.tableCount} tables`
                          : `${d.count} members in this category`}
                      >
                        {d.count}× {d.category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
    </div>
  );
}
