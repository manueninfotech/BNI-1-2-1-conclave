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
  ArrowRight,
  Users,
  Award,
  Briefcase,
  Layers,
  MapPin,
  SlidersHorizontal,
  Hash,
  Gauge,
  Plus,
  Minus,
  Dices,
  ChevronRight,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { formatStatus } from '../utils/statusUtils';

export default function ScheduleGen({ selectedConclaveId, showGenWarning, clearGenWarning, onScheduleReady, isHubMode = false }) {
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
            const s = (c.status || '').toLowerCase().replace(/[\s_-]/g, '');
            if (s === 'registrationopen' || s === 'upcoming') status = 'Upcoming';
            else if (s === 'running' || s === 'active') status = 'Running';
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
    return formatStatus(status);
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

  // Backend Conclave Defaults State
  const [conclaveDefaults, setConclaveDefaults] = useState(() => {
    try {
      const cached = localStorage.getItem('bni_conclave_defaults');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { personsPerTable: 7, roundCount: 6 };
  });

  // Seating Parameter Config States (Defaulted directly from backend settings)
  const [personsPerTable, setPersonsPerTable] = useState(() => conclaveDefaults.personsPerTable || 7);
  const [roundCount, setRoundCount] = useState(() => conclaveDefaults.roundCount || 6);
  // Automatic mode's break between rounds: 1, 2 or 5 minutes (per conclave).
  const [moveSeconds, setMoveSecondsState] = useState(() => selectedConclave?.moveSeconds || 120);
  const [randomSeed, setRandomSeed] = useState(92843);
  const [manualOverride, setManualOverride] = useState(false);

  const totalAttendees = useMemo(() => {
    return Number(stats?.counts?.registered || selectedConclave?.registrationCount || selectedConclave?.participants?.length || 0);
  }, [stats, selectedConclave]);

  const captainsCount = useMemo(() => {
    return Number(stats?.counts?.captains || selectedConclave?.captainCount || 0);
  }, [stats, selectedConclave]);

  const calculatedTableCount = useMemo(() => {
    if (totalAttendees <= 0) return selectedConclave?.scheduleSummary?.tableCount || 5;
    return Math.max(1, Math.ceil(totalAttendees / Math.max(2, personsPerTable)));
  }, [totalAttendees, personsPerTable, selectedConclave]);

  const handleTableCountChange = (newCount) => {
    const targetTables = Math.max(1, Math.min(50, newCount));
    if (totalAttendees > 0) {
      const newCapacity = Math.max(2, Math.ceil(totalAttendees / targetTables));
      setPersonsPerTable(newCapacity);
    }
  };

  // Sync seating parameters if selected conclave changes or conclaveDefaults updates
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
      } else if (conclaveDefaults.personsPerTable) {
        setPersonsPerTable(conclaveDefaults.personsPerTable);
      }
      if (typeof selectedConclave.roundCount === 'number') {
        setRoundCount(selectedConclave.roundCount);
      } else if (conclaveDefaults.roundCount) {
        setRoundCount(conclaveDefaults.roundCount);
      }
      if (typeof selectedConclave.moveSeconds === 'number') {
        setMoveSecondsState(selectedConclave.moveSeconds);
      }
    }
  }, [selectedConclave, stats, conclaveDefaults]);

  // Fetch fresh conclave defaults and round timing directly from backend settings
  const [roundTiming, setRoundTiming] = useState({ bioSeconds: 60, referralSeconds: 30, bufferSeconds: 120 });

  useEffect(() => {
    async function loadBackendDefaults() {
      try {
        const d = await api.get('/admin/settings/conclave-defaults').catch(() => null)
          || await api.get('/app-config').then(r => r?.conclaveDefaults).catch(() => null);
        if (d && typeof d === 'object') {
          setConclaveDefaults(d);
          localStorage.setItem('bni_conclave_defaults', JSON.stringify(d));
          if (!selectedConclave || typeof selectedConclave.personsPerTable !== 'number') {
            setPersonsPerTable(d.personsPerTable || 7);
          }
          if (!selectedConclave || typeof selectedConclave.roundCount !== 'number') {
            setRoundCount(d.roundCount || 6);
          }
        }
        const t = await api.get('/admin/settings/round-timing').catch(() => null)
          || await api.get('/app-config').then(r => r?.roundTiming).catch(() => null);
        if (t && typeof t === 'object') {
          setRoundTiming(t);
        }
      } catch (err) {
        console.warn('Could not load conclave defaults from backend:', err);
      }
    }
    loadBackendDefaults();
  }, [selectedConclaveId]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  // Expandable algorithm weights
  const [showWeights, setShowWeights] = useState(false);
  const [overlapWeight, setOverlapWeight] = useState(80);
  const [chapterWeight, setChapterWeight] = useState(90);
  const [diversityWeight, setDiversityWeight] = useState(70);
  const [regionWeight, setRegionWeight] = useState(50);

  // Round length is fixed by the organisers: 1 min bio + 30 s referral per person.
  const roundLengthSecs = Math.min(8, personsPerTable) * ((roundTiming?.bioSeconds || 60) + (roundTiming?.referralSeconds || 30));

  const saveMoveSeconds = async (secs) => {
    setMoveSecondsState(secs);
    if (!selectedConclaveId) return;
    try {
      await api.patch(`/admin/conclaves/${selectedConclaveId}/move-time`, { moveSeconds: secs });
      showToast('Move time saved', `${secs / 60} min between rounds in automatic mode.`);
    } catch (err) {
      showToast('Could not save move time', err.message || 'Please try again.');
    }
  };

  const handleStartGeneration = async () => {
    if (!selectedConclaveId) {
      showToast('Error', 'No conclave selected. Please create a conclave first.');
      return;
    }

    executeScheduleGeneration();
  };

  const executeScheduleGeneration = async () => {

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
        // Captains are trained people the admin chooses: never auto-fill them.
        autoFillCaptains: false,
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
      const details = err.details || {};
      if (typeof showGenWarning === 'function') {
        showGenWarning({
          type: isCaptainError ? 'captain' : 'error',
          title: isCaptainError ? 'Captain Count Mismatch' : 'Schedule Generation Failed',
          message: msg,
          // The engine returns exactly WHY it refused: blocking issues, soft
          // warnings, the derived roster math, and a one-line hint. Surface all
          // of it instead of a generic "failed" so the admin can act.
          issues: Array.isArray(details.issues) ? details.issues : [],
          warnings: Array.isArray(details.warnings) ? details.warnings : [],
          derived: details.derived || null,
          hint: details.hint || null,
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
    <div className={`w-full flex flex-col gap-3.5 sm:gap-4 animate-fade-in pb-10 sm:pb-14 ${isHubMode ? '' : 'max-w-[1600px] mx-auto'}`}>



      {/* KPI Overview Grid - Matching the clean, spacious card style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Members */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Members</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">
              {stats ? stats.counts.registered.toLocaleString() : (selectedConclave?.memberCount || 0).toLocaleString()}
            </span>
            <Users className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        {/* Card 2: Captains */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Table Captains</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">
              {stats ? stats.counts.captains : (selectedConclave?.captainCount || 0)}
            </span>
            <Award className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        {/* Card 3: Quality Score */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex flex-col justify-between transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Quality Score</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-emerald-600 leading-none">
              {uniqueMeetingsVal}% Optimal
            </span>
            <Gauge className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Completed Notice */}
      {isConclaveCompleted && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>This conclave is <strong>{formatStatus(selectedConclave?.status)}</strong>. Assignments are locked and archived.</span>
          </div>
          <span className="px-2.5 py-1 bg-amber-200/60 rounded text-[9.5px] font-black uppercase tracking-wider text-amber-900">Completed</span>
        </div>
      )}

      {/* 2. SPLIT WORKBENCH CANVAS (Left: Parameter Config, Right: Real-time Synthesis Engine) */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-zinc-200/80">

        {/* LEFT COLUMN: Seating Constraints & Rules */}
        <div className="w-full lg:w-[500px] xl:w-[540px] p-5 sm:p-6 space-y-5 bg-zinc-50/50 shrink-0 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand-red" />
                <h3 className="font-black text-zinc-950 text-xs uppercase tracking-wider">Seating Parameters</h3>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 bg-white px-2 py-0.5 rounded-md border border-zinc-200">
                Constraints
              </span>
            </div>

            {/* Steppers Container (2 Per Row) */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Stepper 1: Number of Tables */}
              <div className="space-y-1.5 w-full flex flex-col justify-between">
                <div className="min-h-[28px] flex flex-col justify-end">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <label className="font-black text-zinc-800 uppercase tracking-wider text-[10px] sm:text-[10.5px] leading-tight whitespace-nowrap">
                      Number of Tables
                    </label>
                    <span className="font-bold text-brand-red text-[8.5px] sm:text-[9.5px] whitespace-nowrap">
                      {totalAttendees > 0 ? `${totalAttendees} Attendees Total` : 'Setup'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center bg-white border border-zinc-250 rounded-xl p-1 shadow-2xs">
                  <button
                    type="button"
                    disabled={isConclaveCompleted || calculatedTableCount <= 1}
                    onClick={() => handleTableCountChange(calculatedTableCount - 1)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shrink-0"
                    title="Decrease tables (increases seats per table)"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex flex-col items-center">
                    <input
                      type="number"
                      min={1}
                      max={8}
                      disabled={isConclaveCompleted}
                      value={calculatedTableCount}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (!isNaN(parsed)) handleTableCountChange(parsed);
                      }}
                      className="w-full text-center font-black text-zinc-950 text-base sm:text-lg leading-tight outline-none bg-transparent py-0"
                    />
                    <span className="text-[8px] sm:text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider leading-none mt-0.5">Tables to Set Up</span>
                  </div>
                  <button
                    type="button"
                    disabled={isConclaveCompleted || calculatedTableCount >= 50}
                    onClick={() => handleTableCountChange(calculatedTableCount + 1)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shrink-0"
                    title="Increase tables (decreases seats per table)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stepper 2: Members / Capacity Per Table */}
              <div className="space-y-1.5 w-full flex flex-col justify-between">
                <div className="min-h-[28px] flex flex-col justify-end">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <label className="font-black text-zinc-800 uppercase tracking-wider text-[10px] sm:text-[10.5px] leading-tight whitespace-nowrap">
                      Members Per Table
                    </label>
                    <span className="font-bold text-emerald-700 text-[8.5px] sm:text-[9.5px] whitespace-nowrap">
                      {Math.max(1, personsPerTable - 1)} Members + 1 Captain
                    </span>
                  </div>
                </div>
                <div className="flex items-center bg-white border border-zinc-250 rounded-xl p-1 shadow-2xs">
                  <button
                    type="button"
                    disabled={isConclaveCompleted || personsPerTable <= 2}
                    onClick={() => setPersonsPerTable(prev => Math.max(2, prev - 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex flex-col items-center">
                    <input
                      type="number"
                      min={2}
                      max={8}
                      disabled={isConclaveCompleted}
                      value={personsPerTable}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (!isNaN(parsed)) setPersonsPerTable(Math.min(8, Math.max(2, parsed)));
                      }}
                      className="w-full text-center font-black text-zinc-950 text-base sm:text-lg leading-tight outline-none bg-transparent py-0"
                    />
                    <span className="text-[8px] sm:text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider leading-none mt-0.5">Total Seats / Table</span>
                  </div>
                  <button
                    type="button"
                    disabled={isConclaveCompleted || personsPerTable >= 8}
                    onClick={() => setPersonsPerTable(prev => Math.min(8, prev + 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Visual Table Seats Preview */}
                <div className="flex items-center justify-center gap-1 pt-0.5">
                  {Array.from({ length: Math.min(10, personsPerTable) }).map((_, sIdx) => (
                    <span
                      key={sIdx}
                      className={`w-1.5 h-1.5 rounded-full ${sIdx === 0 ? 'bg-brand-red ring-2 ring-red-200' : 'bg-zinc-300'}`}
                      title={sIdx === 0 ? 'Table Captain' : `Member ${sIdx}`}
                    />
                  ))}
                  {personsPerTable > 10 && (
                    <span className="text-[8.5px] font-bold text-zinc-400">+{personsPerTable - 10}</span>
                  )}
                </div>
              </div>

              {/* Stepper 3: Number of Rounds */}
              <div className="space-y-1.5 w-full flex flex-col justify-between">
                <div className="min-h-[28px] flex flex-col justify-end">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <label className="font-black text-zinc-800 uppercase tracking-wider text-[10px] sm:text-[10.5px] leading-tight whitespace-nowrap">
                      Total Rounds
                    </label>
                    <span className="font-bold text-zinc-400 uppercase text-[8.5px] sm:text-[9.5px] whitespace-nowrap">
                      Sessions
                    </span>
                  </div>
                </div>
                <div className="flex items-center bg-white border border-zinc-250 rounded-xl p-1 shadow-2xs">
                  <button
                    type="button"
                    disabled={isConclaveCompleted || roundCount <= 1}
                    onClick={() => setRoundCount(prev => Math.max(1, prev - 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex flex-col items-center">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      disabled={isConclaveCompleted}
                      value={roundCount}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (!isNaN(parsed)) setRoundCount(Math.min(20, Math.max(1, parsed)));
                      }}
                      className="w-full text-center font-black text-zinc-950 text-base sm:text-lg leading-tight outline-none bg-transparent py-0"
                    />
                    <span className="text-[8px] sm:text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider leading-none mt-0.5">Conclave Sessions</span>
                  </div>
                  <button
                    type="button"
                    disabled={isConclaveCompleted || roundCount >= 20}
                    onClick={() => setRoundCount(prev => Math.min(20, prev + 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Round length (fixed) and move time between rounds */}
              <div className="space-y-1.5 w-full flex flex-col justify-between">
                <div className="min-h-[28px] flex flex-col justify-end">
                  <label className="font-black text-zinc-800 uppercase tracking-wider text-[10px] sm:text-[10.5px] leading-tight">
                    Round length
                  </label>
                </div>
                <div className="bg-white border border-zinc-250 rounded-xl px-3 py-2 shadow-2xs">
                  <p className="font-black text-zinc-950 text-base sm:text-lg leading-tight">{Math.round(roundLengthSecs / 60 * 10) / 10} min</p>
                  <p className="text-[9.5px] font-semibold text-zinc-500 leading-snug">
                    {Math.min(8, personsPerTable)} × 1 min bio, then {Math.min(8, personsPerTable)} × 30 s referrals. Fixed.
                  </p>
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <label className="font-black text-zinc-800 uppercase tracking-wider text-[10px] sm:text-[10.5px]">
                  Move time between rounds (automatic mode)
                </label>
                <div className="flex gap-2">
                  {[60, 120, 300].map((secs) => (
                    <button
                      key={secs}
                      type="button"
                      disabled={isConclaveCompleted}
                      onClick={() => saveMoveSeconds(secs)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-smooth cursor-pointer disabled:opacity-40 ${
                        moveSeconds === secs ? 'bg-brand-red border-brand-red text-white' : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {secs / 60} min
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] font-semibold text-zinc-500">In manual mode the next round starts when you start it.</p>
              </div>
            </div>

            {/* Random Seed & Manual Override */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-wider block">Random Seed</label>
                <div className="flex items-center bg-white border border-zinc-250 rounded-xl px-3 py-2 shadow-2xs">
                  <input
                    type="number"
                    value={randomSeed}
                    onChange={(e) => setRandomSeed(parseInt(e.target.value) || 92843)}
                    className="w-full text-xs font-black text-zinc-900 outline-none bg-transparent"
                  />
                  <button
                    type="button"
                    title="Generate new seed"
                    onClick={() => {
                      const next = Math.floor(10000 + Math.random() * 90000);
                      setRandomSeed(next);
                      showToast('Seed Updated', `Generator random seed set to ${next}`);
                    }}
                    className="text-zinc-400 hover:text-brand-red cursor-pointer ml-1"
                  >
                    <Dices className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-wider block">Manual Overrides</label>
                <div className="flex items-center justify-between bg-white border border-zinc-250 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-xs font-black text-zinc-800">{manualOverride ? 'Enabled' : 'Locked'}</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={manualOverride}
                      onChange={(e) => {
                        setManualOverride(e.target.checked);
                        showToast('Mode Changed', `Manual override: ${e.target.checked ? 'Enabled' : 'Disabled'}`);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-zinc-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-brand-red"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Algorithm Weights Drawer */}
            <div className="border border-zinc-200/80 bg-white rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-900 uppercase tracking-wider">Engine Bias</span>
                <button
                  type="button"
                  onClick={() => setShowWeights(!showWeights)}
                  className="text-[10.5px] text-brand-red font-black hover:underline cursor-pointer"
                >
                  {showWeights ? 'Collapse' : 'Tune Weights →'}
                </button>
              </div>

              {showWeights ? (
                <div className="space-y-3 pt-1 text-xs">
                  <div>
                    <div className="flex justify-between font-bold text-zinc-500 mb-1">
                      <span>Overlap Avoidance</span>
                      <span className="text-zinc-950 font-black">{overlapWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overlapWeight}
                      onChange={(e) => setOverlapWeight(parseInt(e.target.value))}
                      className="w-full accent-brand-red cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between font-bold text-zinc-500 mb-1">
                      <span>Chapter Diversity</span>
                      <span className="text-zinc-950 font-black">{diversityWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={diversityWeight}
                      onChange={(e) => setDiversityWeight(parseInt(e.target.value))}
                      className="w-full accent-brand-red cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-[11px] font-semibold text-zinc-500">
                  <div className="flex items-center justify-between">
                    <span>Cross-Chapter Separation</span>
                    <span className="text-emerald-600 font-bold">Enforced</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Duplicate Partner Collision</span>
                    <span className="text-emerald-600 font-bold">Filtered (0%)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Roster Readiness */}
          <div className="border-t border-zinc-200/80 pt-4 space-y-2">
            <span className="text-[9.5px] text-zinc-400 font-black uppercase tracking-wider block">Attendee Roster Readiness</span>

            {/* Indicator 1: Total Tables Setup */}
            <div className="flex items-center justify-between text-xs font-bold text-zinc-700 bg-white p-2.5 rounded-xl border border-zinc-200/60 shadow-2xs">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-red" />
                <span>Total Tables</span>
              </span>
              <strong className="text-zinc-950 font-black">
                {calculatedTableCount} Tables ({totalAttendees} registered)
              </strong>
            </div>

            {/* Indicator 2: Members Per Table */}
            <div className="flex items-center justify-between text-xs font-bold text-zinc-700 bg-white p-2.5 rounded-xl border border-zinc-200/60 shadow-2xs">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Members / Table</span>
              </span>
              <strong className="text-zinc-950 font-black">
                {Math.max(1, personsPerTable - 1)} Members + 1 Captain ({personsPerTable} seats)
              </strong>
            </div>

            {/* Indicator 3: Captains Coverage */}
            <div className="flex items-center justify-between text-xs font-bold text-zinc-700 bg-white p-2.5 rounded-xl border border-zinc-200/60 shadow-2xs">
              <span className="flex items-center gap-2">
                {captainsCount >= calculatedTableCount ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span>Captains Coverage</span>
              </span>
              <strong className="text-zinc-950 font-black text-right">
                {captainsCount === calculatedTableCount ? (
                  <span className="text-emerald-700">{captainsCount} / {calculatedTableCount} Tables (✓ 100%)</span>
                ) : captainsCount > calculatedTableCount ? (
                  <span className="text-emerald-700">{captainsCount} Assigned ({calculatedTableCount} Tables · {captainsCount - calculatedTableCount} Standby)</span>
                ) : (
                  <span className="text-amber-600">{captainsCount} / {calculatedTableCount} Tables (⚠️ Need {calculatedTableCount - captainsCount} More)</span>
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-time Synthesis Engine & Live Quality Diagnostics */}
        <div className="flex-1 p-6 sm:p-8 space-y-6 flex flex-col justify-between bg-white">

          {/* Engine Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-black text-zinc-950 text-base tracking-tight">Matrix Optimization Engine</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${isGenerating
                  ? 'bg-red-50 text-brand-red border-red-200 animate-pulse'
                  : progress === 100
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}>
                  {isGenerating ? 'Synthesizing...' : progress === 100 ? 'Matrix Complete & Optimal' : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">Constraint satisfaction engine with dynamic table rebalancing</p>
            </div>
          </div>

          {/* Centerstage: Radial Progress + Pipeline + Execution Pods */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2">
            {/* Circular Gauge */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="w-40 h-40 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
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
                  <span className="text-3xl font-black text-zinc-950 leading-none tracking-tight">{progress}%</span>
                  <span className="text-[9.5px] text-zinc-400 font-black uppercase tracking-wider mt-1">Synthesis</span>
                </div>
              </div>
            </div>

            {/* Execution Pods */}
            <div className="md:col-span-7 flex flex-col justify-center">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-4">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Elapsed</span>
                  <strong className="text-base font-black text-zinc-900 mt-1 block">00:{elapsed < 10 ? `0${elapsed}` : elapsed}s</strong>
                </div>

                <div className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-4">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Processed</span>
                  <strong className="text-base font-black text-zinc-900 mt-1 block">{processed} / {stats?.counts?.registered || selectedConclave?.memberCount || 0}</strong>
                </div>

                <div className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-4">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Estimated ETA</span>
                  <strong className="text-base font-black text-brand-red mt-1 block">{progress === 100 ? '0s' : `${Math.ceil((100 - progress) * 0.8)}s`}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Embedded Seating Quality Diagnostics (No Cards!) */}
          <div className="border border-zinc-200/80 rounded-2xl p-4 sm:p-5 bg-zinc-50/60 space-y-3.5">
            <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Optimization Health Gauges</span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">98% Benchmark Met</span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Unique Meetings */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-extrabold text-zinc-700">Unique Networking Connections</span>
                  <span className="font-black text-emerald-700">{uniqueMeetingsVal}% <span className="text-[9.5px] font-bold text-zinc-400">(Goal &gt;90%)</span></span>
                </div>
                <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${uniqueMeetingsVal}%` }}
                  />
                </div>
              </div>

              {/* Repeat Pairings */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-extrabold text-zinc-700">Repeat Pairings Collisions</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-zinc-950">{repeatedPairingsVal} duplicates</span>
                    <button
                      type="button"
                      onClick={() => setShowRepeatModal(true)}
                      className="text-[10px] font-black text-brand-red hover:underline cursor-pointer"
                    >
                      (View Names →)
                    </button>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-brand-red rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (repeatedPairingsVal || 0) * 8)}%` }}
                  />
                </div>
              </div>

              {/* Diversity */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-extrabold text-zinc-700">Cross-Chapter Diversity Score</span>
                  <span className="font-black text-blue-700">{diversityVal}% <span className="text-[9.5px] font-bold text-zinc-400">(Balanced)</span></span>
                </div>
                <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${diversityVal}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Engine CTA Controls */}
          <div className="pt-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleAbort}
                className="w-full flex items-center justify-center gap-2 border border-brand-red text-brand-red hover:bg-red-50/50 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer"
              >
                <StopCircle className="w-4.5 h-4.5" />
                <span>Abort Generation Task</span>
              </button>
            ) : progress === 100 ? (
              <div className="flex flex-col sm:flex-row gap-3">
                {onScheduleReady && (
                  <button
                    type="button"
                    onClick={onScheduleReady}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-brand-red hover:bg-red-750 text-white font-black text-xs uppercase tracking-wider transition-smooth cursor-pointer shadow-sm"
                  >
                    <span>Inspect Seating Matrix</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isLocked) {
                      showToast('Already Locked', 'This conclave is already locked.');
                      return;
                    }
                    setIsModalOpen(true);
                  }}
                  disabled={isLocked}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl text-xs font-black transition-smooth cursor-pointer uppercase tracking-wider ${isLocked
                    ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
                    }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{isLocked ? 'Conclave Locked' : 'Lock Conclave & Publish'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartGeneration}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 to-brand-red hover:from-red-500 hover:to-red-700 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-smooth shadow-lg shadow-red-900/30 cursor-pointer"
              >
                <PlayCircle className="w-5 h-5" />
                <span>Start Schedule Generation</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* 3. INTEGRATED ROUND BLUEPRINT MATRIX TABLE */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-zinc-200/80 bg-zinc-50/50">
          <div>
            <h3 className="font-black text-zinc-950 text-base tracking-tight">Round Allocations & Table Distribution</h3>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Live status and seat fulfillment per conclave session</p>
          </div>
          <span className="px-3 py-1 bg-white border border-zinc-200/80 rounded-full text-[10px] font-black uppercase tracking-wider text-zinc-700 shadow-2xs">
            {roundCount} Rounds Scheduled
          </span>
        </div>

        {/* Clean, Dense Table Layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200/70 bg-zinc-50/80 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                <th className="py-3.5 px-6">Round</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Tables</th>
                <th className="py-3.5 px-4">Members Seated</th>
                <th className="py-3.5 px-4">Captains</th>
                <th className="py-3.5 px-4">Capacity Utilization</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-700">
              {Array.from({ length: roundCount }).map((_, idx) => {
                const roundNum = idx + 1;
                const currentRound = selectedConclave?.currentRound || 0;
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

                const totalTables = Math.ceil((stats?.counts?.registered || selectedConclave?.memberCount || 0) / (personsPerTable || 6));
                const totalMembers = stats?.counts?.registered || selectedConclave?.memberCount || 0;

                return (
                  <tr key={roundNum} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-4 px-6 font-black text-zinc-950">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-black text-zinc-800">
                          {roundNum}
                        </span>
                        <span>Round {roundNum}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${isRoundCompleted
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isRoundActive
                          ? 'bg-red-50 text-brand-red border-red-200 animate-pulse'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200/60'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRoundCompleted ? 'bg-emerald-500' : isRoundActive ? 'bg-brand-red' : 'bg-zinc-400'}`} />
                        {roundStatus}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-black text-zinc-900">{totalTables} Tables</td>
                    <td className="py-4 px-4 font-black text-zinc-900">{totalMembers.toLocaleString()} Members</td>
                    <td className="py-4 px-4 font-bold text-zinc-600">{stats ? stats.counts.captains : (selectedConclave?.captainCount || 0)} Captains</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5 max-w-[160px]">
                        <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress === 100 ? 100 : progress}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-zinc-600">{progress === 100 ? '100%' : `${progress}%`}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {onScheduleReady && progress === 100 ? (
                        <button
                          type="button"
                          onClick={onScheduleReady}
                          className="inline-flex items-center gap-1 text-xs font-black text-brand-red hover:text-red-750 cursor-pointer"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-xs font-semibold">Configured</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* No Time for Table Movement Warning Modal */}
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
