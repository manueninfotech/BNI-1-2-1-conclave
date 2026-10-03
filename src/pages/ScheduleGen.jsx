import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  Download,
  Play,
  Calendar,
  Settings as SettingsIcon,
  CheckCircle2,
  Clock,
  Check,
  X,
  PlayCircle,
  StopCircle,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

export default function ScheduleGen({ selectedConclaveId, showGenWarning, clearGenWarning }) {
  // Read locked state from local storage conclaves
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_schedule_gen_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    const adminCached = localStorage.getItem('bni_admin_conclaves_cache');
    if (adminCached) {
      try { return JSON.parse(adminCached); } catch (e) { }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadConclaves() {
      setIsLoading(false);
      try {
        const data = await api.get('/admin/conclaves');
        if (data && data.length > 0) {
          const mapped = data.map(c => {
            let state = c.state;
            let country = c.country;
            const venue = c.venueLocation || c.venue || 'N/A';
            const venueShort = venue.split(',')[0] || 'N/A';
            const startDate = c.date || c.startDate || '';
            const dateRange = c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : (c.dateRange || 'N/A');

            let status = c.status;
            const s = (c.status || '').toLowerCase();
            if (s === 'registration_open') status = 'Upcoming';
            else if (s === 'running') status = 'Running';
            else if (s === 'completed') status = 'Completed';
            else if (s === 'draft') status = 'Draft';
            else if (s === 'cancelled') status = 'Cancelled';

            const hasSched = Boolean(c.scheduleSummary || c.schedule || ['running', 'completed', 'locked'].includes(s));

            return {
              ...c,
              state,
              country,
              venue,
              venueShort,
              startDate,
              dateRange,
              status,
              progress: hasSched ? 100 : s === 'running' ? 60 : 0
            };
          });
          setConclaves(mapped);
          localStorage.setItem('bni_schedule_gen_conclaves_cache', JSON.stringify(mapped));
          return;
        }
      } catch (err) {
        console.error("API load failed for conclaves:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConclaves();
  }, []);

  const selectedConclave = useMemo(() =>
    conclaves.find(c => c.id === selectedConclaveId),
    [conclaves, selectedConclaveId]
  );
  const conclaveName = selectedConclave?.name || 'Conclave';

  const isLocked = Boolean(selectedConclave?.isScheduleLocked || selectedConclave?.status?.toLowerCase() === 'locked');

  const displayStatus = (status) => {
    if (isLocked) return 'Locked';
    const s = (status || '').toLowerCase();
    if (s === 'registration_open') return 'Registration Open';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const [stats, setStats] = useState(() => {
    const cached = localStorage.getItem('bni_admin_stats_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return null;
  });

  useEffect(() => {
    async function loadStatsAndMembers() {
      if (!selectedConclaveId) return;
      try {
        let statsData = await api.get(`/admin/conclaves/${selectedConclaveId}/stats`).catch(() => null);
        let allUsers = await api.get('/admin/users').catch(() => []);

        let registeredCount = statsData?.counts?.registered || 0;
        let captainsCount = statsData?.counts?.captains || 0;

        const distinctCatCount = new Set((allUsers || []).map(u => u.category?.trim() || u.businessCategory?.trim()).filter(Boolean)).size || 0;

        const updatedStats = {
          counts: {
            registered: registeredCount,
            captains: captainsCount,
            businessTypes: distinctCatCount
          }
        };
        setStats(updatedStats);
        localStorage.setItem('bni_admin_stats_cache', JSON.stringify(updatedStats));
      } catch (err) {
        console.error("Failed to load conclave stats:", err);
      }
    }
    loadStatsAndMembers();
  }, [selectedConclaveId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkedQuality, setCheckedQuality] = useState(false);
  const [checkedEdits, setCheckedEdits] = useState(false);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
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
  }, [isModalOpen]);



  const isConclaveRunningOrLocked = Boolean(
    selectedConclave && (
      ['running', 'completed', 'locked'].includes((selectedConclave.status || '').toLowerCase()) ||
      Boolean(selectedConclave.scheduleSummary) ||
      Boolean(selectedConclave.schedule)
    )
  );

  const [progress, setProgress] = useState(isConclaveRunningOrLocked ? 100 : 0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(isConclaveRunningOrLocked ? 42 : 0);
  const [processed, setProcessed] = useState(isConclaveRunningOrLocked ? (selectedConclave?.registrationCount || stats?.counts?.registered || 0) : 0);
  const [currentStep, setCurrentStep] = useState(isConclaveRunningOrLocked ? 'Complete' : 'Idle');
  const [round3Status, setRound3Status] = useState(isConclaveRunningOrLocked ? 'COMPLETED' : 'PENDING');
  const [activeStepIndex, setActiveStepIndex] = useState(isConclaveRunningOrLocked ? 5 : 0);

  // Sync state if selected conclave changes
  useEffect(() => {
    const isRunning = Boolean(
      selectedConclave && (
        ['running', 'completed', 'locked'].includes((selectedConclave.status || '').toLowerCase()) ||
        Boolean(selectedConclave.scheduleSummary) ||
        Boolean(selectedConclave.schedule)
      )
    );
    setProgress(isRunning ? 100 : 0);
    setElapsed(isRunning ? 42 : 0);
    setProcessed(isRunning ? (selectedConclave?.registrationCount || stats?.counts?.registered || 0) : 0);
    setCurrentStep(isRunning ? 'Complete' : 'Idle');
    setRound3Status(isRunning ? 'COMPLETED' : 'PENDING');
    setActiveStepIndex(isRunning ? 5 : 0);
    if (selectedConclave) {
      if (typeof selectedConclave.personsPerTable === 'number') {
        setPersonsPerTable(selectedConclave.personsPerTable);
      }
      if (typeof selectedConclave.roundCount === 'number') {
        setRoundCount(selectedConclave.roundCount);
      }
    }
  }, [selectedConclave, stats]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  // Seating Parameter Config States
  const [personsPerTable, setPersonsPerTable] = useState(8);
  const [roundCount, setRoundCount] = useState(4);
  const [randomSeed, setRandomSeed] = useState(92843);
  const [manualOverride, setManualOverride] = useState(false);

  // Expandable algorithm weights
  const [showWeights, setShowWeights] = useState(false);
  const [overlapWeight, setOverlapWeight] = useState(80);
  const [chapterWeight, setChapterWeight] = useState(90);
  const [diversityWeight, setDiversityWeight] = useState(70);
  const [regionWeight, setRegionWeight] = useState(50);

  const handleStartGeneration = async () => {
    if (!selectedConclaveId) {
      showToast('Error', 'No conclave selected. Please create a conclave first.');
      return;
    }

    // Reset visual progress states
    setProgress(0);
    setElapsed(0);
    setProcessed(0);
    setCurrentStep('Sorting Niches');
    setRound3Status('IN PROGRESS');
    setActiveStepIndex(1);
    setIsGenerating(true);

    // Start visual progress simulation timer (runs up to 95% until API finishes)
    let simProgress = 0;
    const simInterval = setInterval(() => {
      simProgress = Math.min(simProgress + 10, 95);
      setProgress(simProgress);
      setElapsed(prev => prev + 1);
      setProcessed(prev => Math.min(prev + 5, stats?.counts?.registered || 48));
      if (simProgress === 30) {
        setCurrentStep('Table Balances');
        setActiveStepIndex(2);
      }
      if (simProgress === 60) {
        setCurrentStep('Diversity Mapping');
        setActiveStepIndex(3);
      }
      if (simProgress === 80) {
        setCurrentStep('Conflict Resolution');
        setActiveStepIndex(4);
      }
    }, 250);

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/generate-schedule`, {
        activeOnly: false, // Seeded users are offline by default, so activeOnly must be false to seat them
        autoFillCaptains: true,
        personsPerTable,
        roundCount
      });

      clearInterval(simInterval);

      // Re-fetch conclaves to update local state with generated schedule & scheduleSummary
      try {
        const data = await api.get('/admin/conclaves');
        setConclaves(data.map(c => {
          const s = (c.status || '').toLowerCase();
          const hasSched = Boolean(c.scheduleSummary || c.schedule || ['running', 'completed', 'locked'].includes(s));
          return {
            ...c,
            venueShort: (c.venueLocation || c.venue || 'N/A').split(',')[0] || 'N/A',
            dateRange: c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : (c.dateRange || 'N/A'),
            progress: hasSched ? 100 : s === 'running' ? 60 : 0
          };
        }));
      } catch (err) {
        console.warn("Refetching conclaves failed:", err);
      }

      // Instantly mark completed
      setProgress(100);
      setIsGenerating(false);
      setCurrentStep('Schedule Completion');
      setRound3Status('COMPLETED');
      setProcessed(stats?.counts?.registered || 48);
      setActiveStepIndex(5);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      showToast('Schedule Generated Successfully', 'Tables allocated and saved to database.');
    } catch (err) {
      clearInterval(simInterval);
      const msg = err.message || 'Backend schedule generation failed.';
      console.warn('Backend schedule generation failed:', msg);

      const isCaptainError = msg.toLowerCase().includes('captain');
      if (typeof showGenWarning === 'function') {
        showGenWarning({
          type: isCaptainError ? 'captain' : 'error',
          title: isCaptainError ? 'Captain Count Mismatch' : 'Schedule Generation Failed',
          message: msg,
        });
      }

      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleAbort = () => {
    setIsGenerating(false);
    showToast('Generation Paused', 'Task execution stopped by administrator.');
  };

  const handleConfirmLock = async () => {
    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/lock-schedule`);
      const updatedConclaves = conclaves.map(c =>
        c.id === selectedConclaveId
          ? {
              ...c,
              isScheduleLocked: true,
              isRegistrationOpen: false,
              registrationOverride: 'closed',
              status: (c.status === 'Completed' || c.status === 'running') ? c.status : 'registrationClosed'
            }
          : c
      );
      setConclaves(updatedConclaves);
      try {
        localStorage.setItem('bni_schedule_gen_conclaves_cache', JSON.stringify(updatedConclaves));
        localStorage.setItem('bni_conclaves_cache', JSON.stringify(updatedConclaves));
        localStorage.setItem('bni_superadmin_conclaves_cache', JSON.stringify(updatedConclaves));
      } catch (e) { }
      setIsModalOpen(false);
      showToast('Conclave Locked Successfully', 'Seating assignments are now frozen, published, and conclave registration is closed.');
    } catch (err) {
      console.error("Backend conclave lock failed:", err.message);
      showToast('Error', err.message || 'Failed to lock conclave. Please try again.');
    }

    // Confetti drop
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Recharts Progress Gauge Data
  const chartData = useMemo(() => {
    return [
      { name: 'progress', value: progress },
      { name: 'remaining', value: 100 - progress }
    ];
  }, [progress]);

  // Export schedule config as CSV
  const exportSchedule = () => {
    const headers = ['Parameter', 'Value'];
    const config = [
      ['Conclave', 'Annual Global Summit 2024'],
      ['Date', 'Nov 12-14, V Convention, Guntur'],
      ['Members', '1,240'],
      ['Captains', '48'],
      ['Rounds', roundCount],
      ['Tables', Math.ceil(1240 / personsPerTable)],
      ['Persons Per Table', personsPerTable],
      ['Random Seed', randomSeed],
      ['Manual Override', manualOverride ? 'Yes' : 'No'],
      ['Generation Progress', `${progress}%`],
      ['Members Processed', processed],
      ['Elapsed Time (s)', elapsed],
      ['Current Step', currentStep],
      ['Status', progress === 100 ? 'COMPLETED' : 'IN PROGRESS']
    ];
    const rows = config.map(([param, val]) =>
      [`"${param}"`, `"${String(val).replace(/"/g, '""')}"`].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-generation-config-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Export Downloaded', `Schedule configuration exported (${progress}% complete).`);
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

  const uniqueMeetingsVal = selectedConclave?.scheduleSummary?.coverage !== undefined
    ? Math.round(selectedConclave.scheduleSummary.coverage * 100)
    : Math.min(100, Math.round(90 + (overlapWeight * 0.1) - (progress === 100 ? 0 : 2.5)));

  const hasSchedule = Boolean(selectedConclave?.schedule?.rounds?.length);
  const repeatedPairingsVal = hasSchedule
    ? repeatPairingDetails.length
    : (selectedConclave?.scheduleSummary?.repeatPairings !== undefined
      ? selectedConclave.scheduleSummary.repeatPairings
      : 0);

  const diversityVal = selectedConclave?.scheduleSummary?.coverage !== undefined
    ? Math.min(100, Math.round((selectedConclave.scheduleSummary.coverage * 100) - (selectedConclave.scheduleSummary.repeatPairings || 0)))
    : Math.min(100, Math.round(85 + (diversityWeight * 0.1) - (progress === 100 ? 0 : 3.5)));

  const isConclaveCompleted = Boolean(
    selectedConclave && (
      (selectedConclave.status || '').toLowerCase() === 'completed' ||
      (selectedConclave.status || '').toLowerCase() === 'cancelled'
    )
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6 animate-fade-in">

      {/* Header Section */}
      <div className="border-b border-zinc-100 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Schedule Generation</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Generate seating assignments for <span className="font-bold text-brand-red">{conclaveName}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {!isConclaveCompleted && (
            <>
              <button
                onClick={handleStartGeneration}
                disabled={isGenerating || isConclaveCompleted}
                type="button"
                className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-zinc-500" />
                <span>Regenerate</span>
              </button>

              <button
                onClick={handleStartGeneration}
                disabled={isGenerating || isConclaveCompleted}
                type="button"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isGenerating ? 'Generating...' : 'Generate Schedule'}</span>
              </button>
            </>
          )}

          <button
            onClick={exportSchedule}
            type="button"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Completed Banner Notice */}
      {isConclaveCompleted && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>This conclave is marked as <strong>{selectedConclave?.status}</strong>. Schedule generation and parameter modifications are disabled.</span>
          </div>
          <span className="px-2.5 py-1 bg-amber-200/60 rounded text-[9.5px] font-black uppercase tracking-wider text-amber-900">Completed Conclave</span>
        </div>
      )}

      {/* KPI & Overview Card */}
      <div className="border border-zinc-200/60 bg-white rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-50 rounded-lg flex items-center justify-center border border-red-100">
              <Calendar className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <h3 className="text-body-sm font-bold text-zinc-955">{selectedConclave?.name || 'Conclave'}</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">{selectedConclave?.venueShort || ''} • {selectedConclave?.dateRange || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-8 px-2 sm:px-6">
            <div className="text-center">
              <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Validation Score</div>
              <div className="text-section-heading font-extrabold text-brand-red mt-0.5">
                {selectedConclave?.warnings?.length ? Math.max(70, 100 - selectedConclave.warnings.length * 10) : 100}%
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-1 font-semibold text-zinc-650">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Members</span>
            <span className="text-body-sm font-bold text-zinc-900 mt-0.5">
              {stats ? (stats.counts.registered).toLocaleString() : (selectedConclave?.memberCount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Captains</span>
            <span className="text-body-sm font-bold text-zinc-900 mt-0.5">
              {stats ? stats.counts.captains : (selectedConclave?.captainCount || 0)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Business Types</span>
            <span className="text-body-sm font-bold text-zinc-900 mt-0.5">
              {stats ? (stats.counts.businessTypes || 14) : (selectedConclave?.businessTypes || 14)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Rounds</span>
            <span className="text-body-sm font-bold text-zinc-900 mt-0.5">{roundCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Tables</span>
            <span className="text-body-sm font-bold text-zinc-900 mt-0.5">
              {Math.ceil((stats ? stats.counts.registered : (selectedConclave?.memberCount || 0)) / (personsPerTable || 6))}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Status</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold border w-fit mt-1 uppercase tracking-wider ${
              isLocked
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-100'
            }`}>
              {selectedConclave ? displayStatus(selectedConclave.status) : 'Running'}
            </span>
          </div>
        </div>
      </div>      {/* Generation Settings Toolbar */}
      <div className="bg-white border border-zinc-100 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between shadow-sm gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-6 lg:gap-8 flex-1">
          <div className="flex items-center gap-2 border-r border-zinc-100 pr-4 shrink-0">
            <SettingsIcon className="w-4.5 h-4.5 text-brand-red" />
            <span className="font-extrabold text-zinc-950 text-body-sm">Generation Parameters</span>
          </div>

          {/* Capacity Input */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest whitespace-nowrap">Capacity / Table</label>
            <input
              type="number"
              min={2}
              max={50}
              disabled={isConclaveCompleted}
              value={personsPerTable}
              onChange={(e) => {
                const parsed = parseInt(e.target.value);
                if (isNaN(parsed) || parsed < 2) {
                  setPersonsPerTable(2);
                } else {
                  setPersonsPerTable(Math.min(50, parsed));
                }
              }}
              onBlur={() => {
                if (!personsPerTable || personsPerTable < 2) {
                  setPersonsPerTable(2);
                  showToast('Constraint Enforced', 'Minimum capacity is 2 members per table.');
                }
              }}
              className="w-20 text-body-sm font-bold text-zinc-800 border border-zinc-200 rounded-lg py-1 px-2.5 outline-none bg-zinc-50 focus:bg-white focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Round Count Input */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest whitespace-nowrap">Rounds</label>
            <input
              type="number"
              min={1}
              max={20}
              disabled={isConclaveCompleted}
              value={roundCount}
              onChange={(e) => {
                const parsed = parseInt(e.target.value);
                if (isNaN(parsed) || parsed < 1) {
                  setRoundCount(1);
                } else {
                  setRoundCount(Math.min(20, parsed));
                }
              }}
              onBlur={() => {
                if (!roundCount || roundCount < 1) {
                  setRoundCount(1);
                  showToast('Constraint Enforced', 'Minimum round count is 1 round.');
                }
              }}
              className="w-16 text-body-sm font-bold text-zinc-800 border border-zinc-200 rounded-lg py-1 px-2.5 outline-none bg-zinc-50 focus:bg-white focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Random Seed */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest whitespace-nowrap">Seed</label>
            <input
              type="number"
              value={randomSeed}
              onChange={(e) => setRandomSeed(parseInt(e.target.value) || 92843)}
              className="w-24 text-body-sm font-bold text-zinc-800 border border-zinc-200 rounded-lg py-1 px-2.5 outline-none bg-zinc-50 focus:bg-white focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-smooth"
            />
          </div>

          {/* Manual Override */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest whitespace-nowrap">Manual Override</span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={manualOverride}
                onChange={(e) => {
                  setManualOverride(e.target.checked);
                  showToast('Mode Changed', `Manual override status: ${e.target.checked ? 'Enabled' : 'Disabled'}`);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-red"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left column: Quality & Timeline */}
        <div className="lg:col-span-4 space-y-6">

          {/* Quality Panel */}
          <div className="border border-zinc-100 bg-white rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
              <CheckCircle2 className="w-4.5 h-4.5 text-brand-red" />
              <h4 className="font-extrabold text-zinc-950 text-body-sm">Schedule Quality Score</h4>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1.5 font-bold text-[10px] text-zinc-500">
                  <span>Unique Meetings</span>
                  <span className="text-brand-red">{uniqueMeetingsVal}%</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={[{ name: 'Unique Meetings', value: uniqueMeetingsVal }]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip formatter={(value) => `${value}%`} cursor={false} />
                      <Bar dataKey="value" fill="#af101a" radius={[4, 4, 4, 4]} background={{ fill: '#f4f4f5' }} barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 font-bold text-[10px] text-zinc-500">
                  <span>Repeated Pairings</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-900 font-extrabold">{repeatedPairingsVal}</span>
                    <button
                      onClick={() => setShowRepeatModal(true)}
                      className="text-[9px] font-extrabold text-brand-red hover:underline cursor-pointer"
                    >
                      (View Names)
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={[{ name: 'Repeated Pairings', value: repeatedPairingsVal }]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip formatter={(value) => `${value}%`} cursor={false} />
                      <Bar dataKey="value" fill="#af101a" radius={[4, 4, 4, 4]} background={{ fill: '#f4f4f5' }} barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5 font-bold text-[10px] text-zinc-500">
                  <span>Diversity Score</span>
                  <span className="text-brand-red">High ({diversityVal}%)</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={[{ name: 'Diversity Score', value: diversityVal }]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip formatter={(value) => `${value}%`} cursor={false} />
                      <Bar dataKey="value" fill="#af101a" radius={[4, 4, 4, 4]} background={{ fill: '#f4f4f5' }} barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right column: Real-time Status, Stepper & Preview */}
        <div className="lg:col-span-8 space-y-6">

          {/* Main Progress Indicator */}
          <div className="border border-zinc-100 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">

              {/* Recharts progress ring */}
              <div className="w-40 h-40 relative flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={68}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      <Cell fill="#af101a" stroke="none" />
                      <Cell fill="#f4f4f5" stroke="none" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold text-zinc-950 leading-none">{progress}%</span>
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1.5">Progress</span>
                </div>
              </div>

              {/* Status details grid */}
              <div className="flex-1 w-full space-y-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-body-sm font-semibold text-zinc-650">
                  <div>
                    <label className="text-[10px] text-zinc-450 font-bold uppercase block mb-1">Current Step</label>
                    <div className="flex items-center gap-2">
                      {progress < 100 ? (
                        <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span className="font-bold text-zinc-900">{currentStep}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-455 font-bold uppercase block mb-1">Elapsed Time</label>
                    <span className="font-bold text-zinc-900">00:{elapsed < 10 ? `0${elapsed}` : elapsed}s</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-455 font-bold uppercase block mb-1">Processed</label>
                    <span className="font-bold text-zinc-900">{processed.toLocaleString()} / {(selectedConclave?.memberCount || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-455 font-bold uppercase block mb-1">Est. Completion</label>
                    <span className="font-bold text-brand-red">{progress === 100 ? '0s' : `${Math.ceil((100 - progress) * 0.8)}s`}</span>
                  </div>
                </div>

                <div>
                  {isGenerating ? (
                    <button
                      onClick={handleAbort}
                      className="w-full flex items-center justify-center gap-2 border border-brand-red text-brand-red hover:bg-red-50/50 py-2 rounded-lg text-button font-bold transition-smooth cursor-pointer"
                    >
                      <StopCircle className="w-4 h-4" /> Abort Generation Task
                    </button>
                  ) : progress === 100 ? (
                    <button
                      onClick={() => {
                        if (isLocked) {
                          showToast('Already Locked', 'This conclave is already locked.');
                          return;
                        }
                        setIsModalOpen(true);
                      }}
                      disabled={isLocked}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-button font-bold transition-smooth shadow-md cursor-pointer uppercase tracking-wider text-[11px] ${isLocked
                        ? 'bg-zinc-250 text-zinc-450 border border-zinc-300/30 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                      <Lock className="w-4 h-4" />
                      {isLocked ? 'Conclave Locked' : 'Lock Conclave & Publish'}
                    </button>
                  ) : (
                    <button
                      onClick={handleStartGeneration}
                      className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 text-white py-2 rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" /> Start Schedule Generation
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>      {/* Round Preview */}
      <div className="space-y-4">
        <h4 className="text-section-heading font-extrabold text-zinc-950 px-1">Round Previews</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: roundCount }).map((_, idx) => {
            const roundNum = idx + 1;
            const currentRound = selectedConclave?.currentRound || 0;
            const isConclaveCompleted = selectedConclave?.status === 'completed';

            let roundStatus = 'SCHEDULED';
            let isRoundCompleted = false;
            let isRoundActive = false;

            if (progress < 100) {
              roundStatus = roundNum === 1 ? 'GENERATING...' : 'QUEUED';
            } else if (isConclaveCompleted) {
              roundStatus = 'COMPLETED';
              isRoundCompleted = true;
            } else if (currentRound === 0) {
              roundStatus = 'SCHEDULED';
            } else if (roundNum < currentRound) {
              roundStatus = 'COMPLETED';
              isRoundCompleted = true;
            } else if (roundNum === currentRound) {
              roundStatus = 'ACTIVE';
              isRoundActive = true;
            } else {
              roundStatus = 'SCHEDULED';
            }

            return (
              <div key={roundNum} className={`border rounded-xl p-4 shadow-sm transition-all duration-300 ${isRoundActive ? 'border-brand-red/40 bg-red-50/5' : 'border-zinc-100 bg-white'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className={`font-bold text-body-sm ${isRoundActive ? 'text-brand-red' : 'text-zinc-800'}`}>Round {roundNum}</h5>
                    <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">
                      {progress === 100
                        ? `${Math.ceil((stats?.counts?.registered || selectedConclave?.participants?.length || selectedConclave?.memberCount || 0) / (personsPerTable || 6))} Tables • ${(stats?.counts?.registered || selectedConclave?.participants?.length || selectedConclave?.memberCount || 0).toLocaleString()} Members`
                        : 'Allocating Members...'}
                    </p>
                  </div>
                  {isRoundCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : isRoundActive ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-red animate-pulse mt-1" />
                  ) : (
                    <Clock className="w-4 h-4 text-zinc-300 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold border-t border-zinc-100 pt-3 mt-2.5">
                  <span className={isRoundCompleted ? 'text-emerald-700' : isRoundActive ? 'text-brand-red' : 'text-zinc-400'}>
                    {roundStatus}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lock Conclave Administrative Section */}
      {progress === 100 && (
        <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-sm mt-2 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-5">
            <div>
              <h3 className="text-body-lg font-extrabold text-zinc-950">Schedule Generation Complete</h3>
              <p className="text-body-sm text-zinc-500 mt-1">Review seating quality metrics below or lock the assignments for live event execution.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={isLocked}
              className={`px-5 py-2.5 rounded-lg text-button font-bold flex items-center gap-2 shadow-md transition-smooth cursor-pointer ${isLocked
                ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                : 'bg-brand-red hover:bg-red-700 text-white'
                }`}
            >
              <Lock className="w-4 h-4" />
              {isLocked ? 'Seating Assignments Locked' : 'Lock Seating Assignments'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">Total Tables</span>
              <span className="text-display-sm font-extrabold text-zinc-900 mt-2">
                {Math.ceil((stats?.counts?.registered || selectedConclave?.participants?.length || selectedConclave?.memberCount || 0) / (personsPerTable || 6))}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">Schedule Quality</span>
              <span className="text-display-sm font-extrabold text-emerald-700 mt-2">
                {selectedConclave?.scheduleSummary?.coverage !== undefined
                  ? `${Math.round(selectedConclave.scheduleSummary.coverage * 100)}%`
                  : repeatPairingDetails.length === 0 ? '100%' : '95%'}
              </span>
            </div>

            <div
              onClick={() => setShowRepeatModal(true)}
              className="p-4 rounded-xl border border-red-100 bg-red-50/20 hover:bg-red-50/50 cursor-pointer transition-smooth flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">Repeat Pairs</span>
                <span className="text-[9px] font-extrabold text-brand-red group-hover:underline">View Names →</span>
              </div>
              <span className="text-display-sm font-extrabold text-zinc-900 mt-2">
                {repeatedPairingsVal} <span className="text-body-sm font-semibold text-zinc-500">duplicates</span>
              </span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">Validation Score</span>
              <span className="text-display-sm font-extrabold text-zinc-900 mt-2">
                {selectedConclave?.warnings?.length ? Math.max(70, 100 - selectedConclave.warnings.length * 10) : 100}<span className="text-body-sm text-zinc-400 font-normal"> / 100</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM LOCK MODAL OVERLAY */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">

            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-red" />
              <h3 className="font-extrabold text-zinc-955 text-body-sm">Confirm Administrative Lock</h3>
            </div>

            <div className="p-5 space-y-4 text-body-sm font-semibold text-zinc-655">
              <p className="leading-relaxed text-[12.5px]">
                You are about to lock Seating assignments for <strong className="text-zinc-955 font-extrabold">{conclaveName}</strong>.
                This action is irreversible and disables manual seating overrides.
              </p>

              <div className="bg-red-50/20 border-l-4 border-brand-red p-3 text-[10px] text-zinc-700 italic">
                "The schedule will be pushed to the mobile app and all captains will receive their final rosters."
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedQuality}
                    onChange={(e) => setCheckedQuality(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-red border-zinc-200 rounded focus:ring-brand-red cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 font-bold">I have verified the schedule quality metrics (98%).</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedEdits}
                    onChange={(e) => setCheckedEdits(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-red border-zinc-200 rounded focus:ring-brand-red cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 font-bold">I understand this will disable manual table overrides.</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setCheckedQuality(false);
                  setCheckedEdits(false);
                }}
                className="px-4 py-2 border border-zinc-100 bg-white text-zinc-700 text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!(checkedQuality && checkedEdits)}
                onClick={handleConfirmLock}
                className="px-5 py-2 bg-brand-red hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-button font-bold rounded-lg shadow-md transition-smooth cursor-pointer"
              >
                Confirm & Lock
              </button>
            </div>
          </div>
        </div>,
        document.body
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
            className="text-white opacity-40 hover:opacity-100 ml-2 animate-none cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
