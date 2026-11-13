import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { broadcastTabMessage } from '../utils/syncBus';
import { getInitials } from '../utils/initials';
import {
  X,
  Lock,
  ShieldAlert,
  Users,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  Layers,
  Clock,
  Zap,
  Search,
  Coffee,
  CalendarDays,
  Download,
  BarChart3,
  Crown,
  Armchair,
  Table as TableIcon,
  Sparkles,
  RotateCw,
  Eye,
  Printer,
  Maximize2,
  Minimize2,
  List,
  LayoutGrid,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { formatStatus } from '../utils/statusUtils';

export default function ScheduleGen({
  selectedConclaveId,
  showGenWarning,
  onScheduleReady,
  onNavigateToRunner,
  isHubMode = false,
}) {
  const queryClient = useQueryClient();
  // Conclaves list state
  const [conclaves, setConclaves] = useState([]);

  useEffect(() => {
    async function loadConclaves() {
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
          localStorage.setItem('connect_schedule_gen_conclaves_cache', JSON.stringify(mapped));
        }
      } catch (err) {
        console.error('API load failed for conclaves:', err);
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
  const isConclaveCompleted = Boolean(
    selectedConclave && (
      (selectedConclave.status || '').toLowerCase() === 'completed' ||
      (selectedConclave.status || '').toLowerCase() === 'cancelled'
    )
  );
  const isRunning = Boolean(['running'].includes((selectedConclave?.status || '').toLowerCase()));
  const isConclaveRunningOrLocked = Boolean(isLocked || isConclaveCompleted || isRunning);
  const hasGeneratedSchedule = Boolean(selectedConclave?.schedule || selectedConclave?.scheduleSummary);

  // Stats state - scoped strictly per conclave ID without static fallbacks
  const [stats, setStats] = useState(() => {
    if (selectedConclaveId) {
      try {
        const cached = localStorage.getItem(`bni_admin_stats_cache_${selectedConclaveId}`);
        if (cached) return JSON.parse(cached);
      } catch { }
    }
    return null;
  });

  useEffect(() => {
    let alive = true;
    async function loadStatsAndMembers() {
      if (!selectedConclaveId) {
        setStats(null);
        return;
      }
      try {
        let statsData = await api.get(`/admin/conclaves/${selectedConclaveId}/stats`).catch(() => null);
        let allUsers = await api.get('/admin/users').catch(() => []);

        let registeredCount = statsData?.counts?.registered ?? 0;
        let activeCount = statsData?.counts?.active ?? 0;
        let captainsCount = statsData?.counts?.captains ?? 0;

        const distinctCatCount = new Set((allUsers || []).map(u => u.category?.trim() || u.businessCategory?.trim()).filter(Boolean)).size || 0;

        const updatedStats = {
          counts: {
            registered: registeredCount,
            active: activeCount,
            captains: captainsCount,
            businessTypes: distinctCatCount,
            referrals: statsData?.counts?.referrals ?? 0,
            attendanceRecords: statsData?.counts?.attendanceRecords ?? 0
          }
        };
        if (alive) {
          setStats(updatedStats);
          try {
            localStorage.setItem(`bni_admin_stats_cache_${selectedConclaveId}`, JSON.stringify(updatedStats));
          } catch { }
        }
      } catch (err) {
        console.error('Failed to load conclave stats:', err);
      }
    }
    loadStatsAndMembers();
    const interval = setInterval(loadStatsAndMembers, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [selectedConclaveId]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [checkedQuality, setCheckedQuality] = useState(false);
  const [checkedEdits, setCheckedEdits] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

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

  const [progress, setProgress] = useState(hasGeneratedSchedule ? 100 : 0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(hasGeneratedSchedule ? 42 : 0);
  const [processed, setProcessed] = useState(hasGeneratedSchedule ? (selectedConclave?.registrationCount || stats?.counts?.registered || 0) : 0);
  const [genStep, setGenStep] = useState(hasGeneratedSchedule ? 'Schedule Ready' : 'Idle');

  // Backend Conclave Defaults State
  const [conclaveDefaults, setConclaveDefaults] = useState(() => {
    try {
      const cached = localStorage.getItem('bni_conclave_defaults');
      if (cached) return JSON.parse(cached);
    } catch { }
    return { personsPerTable: 5, roundCount: 2 };
  });

  // Parameters
  const [personsPerTable, setPersonsPerTable] = useState(() => conclaveDefaults.personsPerTable || 5);
  const [roundCount, setRoundCount] = useState(() => conclaveDefaults.roundCount || 2);
  const [moveSeconds, setMoveSecondsState] = useState(() => selectedConclave?.moveSeconds || 120);

  // Active sub-tab inside Schedule Generation: 'visual' | 'blueprint'
  const [activeTab, setActiveTab] = useState('visual');
  const [visualRound, setVisualRound] = useState(1);
  const [tableSearch, setTableSearch] = useState('');
  const [roundTimeMinutes, setRoundTimeMinutes] = useState('7.5');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  const [membersList, setMembersList] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [roundSelectOpen, setRoundSelectOpen] = useState(false);

  // When opening preview, refresh conclave data to ensure stand-in captains and live updates are loaded
  useEffect(() => {
    if (isPreviewOpen && selectedConclaveId) {
      api.get(`/admin/conclaves/${selectedConclaveId}`).then(fresh => {
        if (fresh && fresh.id) {
          setConclaves(prev => prev.map(c => c.id === fresh.id ? { ...c, ...fresh } : c));
        }
      }).catch(() => null);
    }
  }, [isPreviewOpen, selectedConclaveId, visualRound]);

  // Close preview on Escape key and lock body scroll
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isPreviewOpen) {
        setIsPreviewOpen(false);
      }
    };
    if (isPreviewOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    let alive = true;
    async function loadMembers() {
      if (!selectedConclaveId) return;
      try {
        const res = await api.get(`/admin/conclaves/${selectedConclaveId}/registrations`).catch(() => null);
        const list = res?.registrations || (Array.isArray(res) ? res : []);
        if (alive && Array.isArray(list)) {
          setMembersList(list);
        }
      } catch (err) {
        console.warn('Could not load conclave registrations:', err);
      }
    }
    loadMembers();
    return () => { alive = false; };
  }, [selectedConclaveId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCSV = () => {
    if (!selectedConclave?.schedule?.rounds?.length) {
      showToast('No Schedule', 'Please generate a schedule first before exporting.');
      return;
    }
    let csv = 'Round,Table,Captain,Members\n';
    selectedConclave.schedule.rounds.forEach(r => {
      const rNum = r.roundNumber || r.round || r.number;
      (r.tables || []).forEach(t => {
        const tNum = t.tableNumber || t.number;
        const capt = t.captainName || t.captain?.name || (t.captainId !== undefined ? `Captain ${t.captainId}` : 'None');
        const mems = (t.memberNames || t.members?.map(m => m.name) || t.memberIds || []).join('; ');
        csv += `"${rNum}","${tNum}","${capt}","${mems}"\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `connect_schedule_${(selectedConclave?.name || 'conclave').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportOpen(false);
    showToast('Exported', 'Schedule CSV downloaded successfully.');
  };

  // Attendee Seating Pool Scope: false = all registered members; true = only members active in the room today
  const [activeOnly, setActiveOnly] = useState(() => {
    if (selectedConclaveId) {
      try {
        const stored = sessionStorage.getItem(`connect_schedule_active_only_${selectedConclaveId}`);
        if (stored === 'true') return true;
        if (stored === 'false') return false;
      } catch { }
    }
    return false;
  });

  const handleActiveOnlyToggle = (val) => {
    if (isConclaveRunningOrLocked) return;
    setActiveOnly(val);
    if (selectedConclaveId) {
      try {
        sessionStorage.setItem(`connect_schedule_active_only_${selectedConclaveId}`, val ? 'true' : 'false');
      } catch { }
    }
  };

  useEffect(() => {
    if (!selectedConclave) return;
    const snap = selectedConclave.snapshot;
    const isStored = snap && typeof snap === 'object' ? snap.activeOnly : undefined;
    if (typeof isStored === 'boolean') {
      setActiveOnly(isStored);
      if (selectedConclave.id) {
        try {
          sessionStorage.setItem(`connect_schedule_active_only_${selectedConclave.id}`, isStored ? 'true' : 'false');
        } catch { }
      }
    }
  }, [selectedConclave?.id, selectedConclave?.snapshot]);

  const registeredAttendees = useMemo(() => {
    if (stats?.counts?.registered !== undefined && stats?.counts?.registered !== null) {
      return Number(stats.counts.registered);
    }
    if (selectedConclave?.registrationCount !== undefined && selectedConclave?.registrationCount !== null) {
      return Number(selectedConclave.registrationCount);
    }
    if (Array.isArray(membersList) && membersList.length > 0) {
      return membersList.length;
    }
    if (Array.isArray(selectedConclave?.participants) && selectedConclave.participants.length > 0) {
      return selectedConclave.participants.length;
    }
    return 0;
  }, [stats, selectedConclave, membersList]);

  const activeAttendees = useMemo(() => {
    if (stats?.counts?.active !== undefined && stats?.counts?.active !== null) {
      return Number(stats.counts.active);
    }
    if (Array.isArray(membersList) && membersList.length > 0) {
      return membersList.filter(m => Boolean(m.isOnline || m.checkedIn || m.presence === 'online' || m.isActive === true || (m.status?.toLowerCase() === 'active'))).length;
    }
    return 0;
  }, [stats, membersList]);

  const effectiveAttendees = activeOnly ? activeAttendees : registeredAttendees;
  const totalAttendees = effectiveAttendees;

  const captainsCount = useMemo(() => {
    if (stats?.counts?.captains !== undefined && stats?.counts?.captains !== null) {
      return Number(stats.counts.captains);
    }
    if (selectedConclave?.captainCount !== undefined && selectedConclave?.captainCount !== null) {
      return Number(selectedConclave.captainCount);
    }
    if (Array.isArray(membersList) && membersList.length > 0) {
      return membersList.filter(m => (m.role || '').toLowerCase() === 'captain' || m.isCaptain).length;
    }
    return 0;
  }, [stats, selectedConclave, membersList]);

  const [targetTableCount, setTargetTableCount] = useState(null);

  const calculatedTableCount = useMemo(() => {
    if (targetTableCount !== null && targetTableCount > 0) {
      return targetTableCount;
    }
    if (totalAttendees <= 0) return selectedConclave?.scheduleSummary?.tableCount || 0;
    return Math.max(1, Math.ceil(totalAttendees / Math.max(2, personsPerTable)));
  }, [targetTableCount, totalAttendees, personsPerTable, selectedConclave]);

  const handleTableCountChange = (newCount) => {
    if (isConclaveRunningOrLocked) return;
    const targetTables = Math.max(1, Math.min(50, newCount));
    setTargetTableCount(targetTables);
    const count = totalAttendees > 0 ? totalAttendees : 6;
    const newCapacity = Math.max(2, Math.min(12, Math.ceil(count / targetTables)));
    setPersonsPerTable(newCapacity);
  };

  // Track previous conclave ID so we only initialize parameters when changing conclaves
  const prevConclaveIdRef = useRef(null);

  // Sync parameters only when selecting a different conclave
  useEffect(() => {
    if (!selectedConclave) return;

    const hasSched = Boolean(selectedConclave.scheduleSummary || selectedConclave.schedule);
    setProgress(hasSched ? 100 : 0);
    setElapsed(0);
    setProcessed(hasSched ? (selectedConclave?.registrationCount || stats?.counts?.registered || 0) : 0);

    // Only populate input parameters when switching to a different conclave or on first load
    if (prevConclaveIdRef.current !== selectedConclave.id) {
      prevConclaveIdRef.current = selectedConclave.id;
      setTargetTableCount(null);
      const hasGeneratedSchedule = Boolean(selectedConclave.schedule || selectedConclave.scheduleSummary || isRunning);
      if (hasGeneratedSchedule && typeof selectedConclave.personsPerTable === 'number') {
        setPersonsPerTable(selectedConclave.personsPerTable);
      } else if (conclaveDefaults?.personsPerTable) {
        setPersonsPerTable(conclaveDefaults.personsPerTable);
      } else if (typeof selectedConclave.personsPerTable === 'number') {
        setPersonsPerTable(selectedConclave.personsPerTable);
      }
      if (hasGeneratedSchedule && typeof selectedConclave.roundCount === 'number') {
        setRoundCount(selectedConclave.roundCount);
      } else if (conclaveDefaults?.roundCount) {
        setRoundCount(conclaveDefaults.roundCount);
      } else if (typeof selectedConclave.roundCount === 'number') {
        setRoundCount(selectedConclave.roundCount);
      }
      if (typeof selectedConclave.moveSeconds === 'number') {
        setMoveSecondsState(selectedConclave.moveSeconds);
      }
    }
  }, [selectedConclave?.id, conclaveDefaults]);

  // Round Timing
  const [roundTiming, setRoundTiming] = useState({ bioSeconds: 60, referralSeconds: 30, bufferSeconds: 120 });

  useEffect(() => {
    async function loadBackendDefaults() {
      try {
        const d = await api.get('/admin/settings/conclave-defaults').catch(() => null)
          || await api.get('/app-config').then(r => r?.conclaveDefaults).catch(() => null);
        if (d && typeof d === 'object') {
          setConclaveDefaults(d);
          localStorage.setItem('bni_conclave_defaults', JSON.stringify(d));
          const hasGeneratedSchedule = Boolean(selectedConclave?.schedule || selectedConclave?.scheduleSummary || isConclaveRunningOrLocked);
          if (!hasGeneratedSchedule) {
            if (d.personsPerTable) setPersonsPerTable(d.personsPerTable);
            if (d.roundCount) setRoundCount(d.roundCount);
          } else {
            if (!selectedConclave || typeof selectedConclave.personsPerTable !== 'number') {
              setPersonsPerTable(d.personsPerTable || 5);
            }
            if (!selectedConclave || typeof selectedConclave.roundCount !== 'number') {
              setRoundCount(d.roundCount || 2);
            }
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
  }, [selectedConclaveId, selectedConclave]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  const roundLengthSecs = Math.min(8, personsPerTable) * ((roundTiming?.bioSeconds || 60) + (roundTiming?.referralSeconds || 30));

  const saveMoveSeconds = async (secs) => {
    if (isConclaveRunningOrLocked) return;
    setMoveSecondsState(secs);
    if (!selectedConclaveId) return;
    try {
      await api.patch(`/admin/conclaves/${selectedConclaveId}/move-time`, { moveSeconds: secs });
      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      queryClient.invalidateQueries({ queryKey: ['conclaves'] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclaves'] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclaves'] });
      showToast('Move time saved', `${secs / 60} min between rounds in automatic mode.`);
    } catch (err) {
      showToast('Could not save move time', err.message || 'Please try again.');
    }
  };

  const handleStartGeneration = async () => {
    if (!selectedConclaveId) {
      showToast('Error', 'No conclave selected. Please select a conclave first.');
      return;
    }
    if (activeOnly && activeAttendees === 0) {
      showToast(
        'No Active Members',
        'There are no members currently active in the room. Switch to "All Registered" or wait for members to open the mobile app.'
      );
      return;
    }
    executeScheduleGeneration();
  };

  const executeScheduleGeneration = async () => {
    setProgress(0);
    setElapsed(0);
    setProcessed(0);
    setGenStep('Checking member businesses...');
    setIsGenerating(true);

    let simProgress = 0;
    const simInterval = setInterval(() => {
      simProgress = Math.min(simProgress + 10, 95);
      setProgress(simProgress);
      setElapsed(prev => prev + 1);
      setProcessed(prev => Math.min(prev + 5, effectiveAttendees || 0));
      if (simProgress === 30) setGenStep('Separating members from same chapter...');
      if (simProgress === 60) setGenStep('Balancing tables...');
      if (simProgress === 80) setGenStep('Checking for repeat meetings...');
    }, 250);

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/generate-schedule`, {
        activeOnly,
        // Auto-assign captains when none are designated, so a chapter/region with
        // no captain format can still generate and run the conclave instead of
        // being blocked by "Need More Table Captains". (If captains ARE
        // designated, those are used.)
        autoFillCaptains: true,
        personsPerTable,
        roundCount,
        tableCount: calculatedTableCount
      });

      if (selectedConclaveId) {
        try {
          sessionStorage.setItem(`connect_schedule_active_only_${selectedConclaveId}`, activeOnly ? 'true' : 'false');
        } catch { }
      }

      clearInterval(simInterval);

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
        console.warn('Refetching conclaves failed:', err);
      }

      setProgress(100);
      setIsGenerating(false);
      setGenStep('Schedule Ready');
      setProcessed(effectiveAttendees || 0);
      setShowSuccessModal(true);

      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      queryClient.invalidateQueries({ queryKey: ['conclaves'] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclaves'] });

      showToast('Schedule Created', 'All tables and members have been arranged.');
    } catch (err) {
      clearInterval(simInterval);
      const msg = err.message || 'Schedule creation failed.';
      console.warn('Schedule creation failed:', msg);

      const isCaptainError = msg.toLowerCase().includes('captain');
      const details = err.details || {};
      if (typeof showGenWarning === 'function') {
        showGenWarning({
          type: isCaptainError ? 'captain' : 'error',
          title: isCaptainError ? 'Need More Table Captains' : 'Could Not Create Schedule',
          message: msg,
          issues: Array.isArray(details.issues) ? details.issues : [],
          warnings: Array.isArray(details.warnings) ? details.warnings : [],
          derived: details.derived || null,
          hint: details.hint || null,
        });
      }

      setIsGenerating(false);
      setProgress(0);
      setGenStep('Idle');
    }
  };

  const handleAbort = () => {
    setIsGenerating(false);
    setProgress(0);
    setGenStep('Stopped');
    showToast('Stopped', 'Schedule creation stopped.');
  };

  const handleConfirmLock = async () => {
    if (isLocking) return;
    setIsLocking(true);
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
      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      queryClient.invalidateQueries({ queryKey: ['conclaves'] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclaves'] });
      setIsModalOpen(false);
      showToast('Seating Finalized & Locked', 'Table assignments are now locked and visible in the mobile app.');
    } catch (err) {
      console.error('Backend conclave lock failed:', err.message);
      showToast('Error', err.message || 'Failed to lock seating. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  const handleStartRound = async (roundNumber = 1) => {
    if (!selectedConclaveId) return;
    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/start-round`, { roundNumber });
      showToast('Round 1 Started', 'Round 1 is now in progress.');
      if (typeof onNavigateToRunner === 'function') {
        onNavigateToRunner();
      }
    } catch (err) {
      console.error('Failed to start round:', err.message || err);
      showToast('Start Round Failed', err.message || 'Could not start round.');
    }
  };

  const [showRepeatModal, setShowRepeatModal] = useState(false);

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
    : (selectedConclave?.schedule?.stats?.coverage !== undefined
      ? Math.round(selectedConclave.schedule.stats.coverage * 100)
      : 0);

  const hasSchedule = Boolean(selectedConclave?.schedule?.rounds?.length);
  const repeatedPairingsVal = hasSchedule
    ? repeatPairingDetails.length
    : (selectedConclave?.scheduleSummary?.repeatPairings !== undefined
      ? selectedConclave.scheduleSummary.repeatPairings
      : (selectedConclave?.schedule?.stats?.repeatPairings !== undefined
        ? selectedConclave.schedule.stats.repeatPairings
        : 0));

  const diversityVal = selectedConclave?.scheduleSummary?.coverage !== undefined
    ? Math.max(0, Math.min(100, Math.round((selectedConclave.scheduleSummary.coverage * 100) - (selectedConclave.scheduleSummary.repeatPairings || 0))))
    : (selectedConclave?.schedule?.stats?.coverage !== undefined
      ? Math.max(0, Math.min(100, Math.round((selectedConclave.schedule.stats.coverage * 100) - (selectedConclave.schedule.stats.repeatPairings || 0))))
      : 0);


  // Visual layout round data
  const currentVisualRoundData = useMemo(() => {
    if (!selectedConclave?.schedule?.rounds) return null;
    return selectedConclave.schedule.rounds.find(r => (r.roundNumber || r.round || r.number) === visualRound) || selectedConclave.schedule.rounds[0];
  }, [selectedConclave, visualRound]);

  const displayedMembers = useMemo(() => {
    let list = [];
    if (membersList && membersList.length > 0) {
      list = membersList.map(m => {
        const name = m.name || m.userName || m.fullName || 'Member';
        const role = (m.role || '').toLowerCase() === 'captain' || m.isCaptain ? 'Table Captain' : 'Member';
        const isAct = Boolean(m.isOnline || m.checkedIn || m.presence === 'online' || m.isActive === true || (m.status?.toLowerCase() === 'active'));
        const initials = getInitials(name, 'U');
        return { id: m.id || m.uid || name, name, role, active: isAct, initials };
      });
    } else if (selectedConclave?.participants && selectedConclave.participants.length > 0) {
      list = selectedConclave.participants.map(m => {
        const name = m.name || 'Member';
        const role = (m.role || '').toLowerCase() === 'captain' || m.isCaptain ? 'Table Captain' : 'Member';
        const isAct = Boolean(m.isOnline || m.checkedIn || m.presence === 'online' || m.isActive === true || (m.status?.toLowerCase() === 'active'));
        const initials = getInitials(name, 'U');
        return { id: m.id || name, name, role, active: isAct, initials };
      });
    } else {
      list = [];
    }

    if (activeOnly) {
      return list.filter(m => m.active);
    }
    return list;
  }, [membersList, selectedConclave, activeOnly]);

  const tablesData = useMemo(() => {
    const count = calculatedTableCount;
    if (count <= 0) return [];
    const list = [];
    const r1 = selectedConclave?.schedule?.rounds?.[0];

    for (let i = 1; i <= count; i++) {
      const tbl = r1?.tables?.find(t => (t.tableNumber || t.number) === i);
      const hasCaptain = tbl
        ? (tbl.captainId !== undefined || Boolean(tbl.captainName))
        : (i <= captainsCount);

      let assignedText = '';
      if (tbl) {
        const memberCount = tbl.memberIds?.length || (tbl.participants?.length ? (hasCaptain ? tbl.participants.length - 1 : tbl.participants.length) : (personsPerTable - (hasCaptain ? 1 : 0)));
        assignedText = hasCaptain ? `${memberCount} Members + 1 Captain` : `${memberCount} Members`;
      } else {
        assignedText = hasCaptain ? `${personsPerTable - 1} Members + 1 Captain` : `${personsPerTable} Members`;
      }

      list.push({
        tableNum: i,
        seats: personsPerTable,
        assigned: assignedText
      });
    }
    return list;
  }, [calculatedTableCount, selectedConclave, captainsCount, personsPerTable]);

  return (
    <div className={`w-full flex flex-col gap-3 sm:gap-3.5 animate-fade-in pb-8 sm:pb-10 ${isHubMode ? '' : 'max-w-[1600px] mx-auto'}`}>

      {/* Top Header Row with Divider (Clean Header, No Big Background Card) */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3 sm:gap-3.5">
          {/* Calendar Icon Box */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FFF0F2] border border-rose-100/90 text-brand-red flex items-center justify-center shrink-0 shadow-3xs">
            <CalendarDays className="w-5 h-5 text-brand-red" />
          </div>

          {/* Vertical Divider */}
          <div className="h-7 sm:h-8 w-px bg-zinc-200/90 shrink-0" />

          {/* Title & Subtitle */}
          <div>
            <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight leading-tight">
              Schedule Generation
            </h2>
            <p className="text-[11px] sm:text-xs font-medium text-zinc-600 mt-0.5">
              Configure tables, rounds and timing, then generate the conclave schedule.
            </p>
          </div>
        </div>
      </div>

      {/* Central Configurations & Rounds Summary Grid (50% / 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        {/* Left Column (50%): Seating Pool & Configurations */}
        <div className="bg-white border border-rose-100/80 rounded-2xl p-4 sm:p-5 shadow-3xs flex flex-col justify-between h-full space-y-4">
          {/* Top: Seating Pool Header */}
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-950">Seating Pool</h3>
                <p className="text-[11px] text-zinc-500 font-medium">Configure who will be included for table arrangement.</p>
              </div>
            </div>

            {/* Radio Selector: All Eligible Members vs Custom Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <button
                type="button"
                disabled={isConclaveRunningOrLocked}
                onClick={() => handleActiveOnlyToggle(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-smooth cursor-pointer ${!activeOnly
                  ? 'bg-rose-50/70 border border-brand-red text-brand-red shadow-3xs'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!activeOnly ? 'border-brand-red' : 'border-zinc-300'}`}>
                    {!activeOnly && <span className="w-2 h-2 rounded-full bg-brand-red" />}
                  </span>
                  <span className="truncate">Registered members</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums shrink-0 ${!activeOnly
                  ? 'bg-brand-red text-white'
                  : 'bg-zinc-150 text-zinc-700'
                  }`}>
                  {registeredAttendees}
                </span>
              </button>

              <button
                type="button"
                disabled={isConclaveRunningOrLocked}
                onClick={() => handleActiveOnlyToggle(true)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-smooth cursor-pointer ${activeOnly
                  ? 'bg-rose-50/70 border border-brand-red text-brand-red shadow-3xs'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${activeOnly ? 'border-brand-red' : 'border-zinc-300'}`}>
                    {activeOnly && <span className="w-2 h-2 rounded-full bg-brand-red" />}
                  </span>
                  <span className="truncate">Active Members</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums shrink-0 ${activeOnly
                  ? 'bg-brand-red text-white'
                  : 'bg-zinc-150 text-zinc-700'
                  }`}>
                  {activeAttendees}
                </span>
              </button>
            </div>
          </div>

          {/* Middle: Seating Configuration */}
          <div className="space-y-2.5 pt-1 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-red" />
              <h4 className="text-xs sm:text-sm font-black text-zinc-950 tracking-tight">Seating Configuration</h4>
            </div>

            {/* 3 Columns: Tables, Seats per Table, Total Rounds */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
              {/* Tables */}
              <div className="flex flex-col gap-1.5 sm:pr-4">
                <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5 leading-none">
                  <TableIcon className="w-3.5 h-3.5 text-brand-red" />
                  <span>Tables</span>
                </span>
                <div className="flex items-center justify-between h-9 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl px-2 shadow-3xs transition-smooth">
                  <button
                    type="button"
                    disabled={isConclaveRunningOrLocked || calculatedTableCount <= 1}
                    onClick={() => handleTableCountChange(calculatedTableCount - 1)}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black text-zinc-950 tabular-nums">
                    {calculatedTableCount}
                  </span>
                  <button
                    type="button"
                    disabled={isConclaveRunningOrLocked || calculatedTableCount >= 50}
                    onClick={() => handleTableCountChange(calculatedTableCount + 1)}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Seats per Table */}
              <div className="flex flex-col gap-1.5 sm:px-4 pt-2 sm:pt-0">
                <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5 leading-none">
                  <Armchair className="w-3.5 h-3.5 text-brand-red" />
                  <span>Seats per Table</span>
                </span>
                <div className="flex items-center justify-between h-9 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl px-2 shadow-3xs transition-smooth">
                  <button
                    type="button"
                    disabled={isConclaveRunningOrLocked || personsPerTable <= 2}
                    onClick={() => setPersonsPerTable(p => Math.max(2, p - 1))}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black text-zinc-950 tabular-nums">
                    {personsPerTable}
                  </span>
                  <button
                    type="button"
                    disabled={isConclaveRunningOrLocked || personsPerTable >= 16}
                    onClick={() => setPersonsPerTable(p => Math.min(16, p + 1))}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Total Rounds */}
              <div className="flex flex-col gap-1.5 sm:pl-4 pt-2 sm:pt-0">
                <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5 leading-none">
                  <RotateCw className="w-3.5 h-3.5 text-brand-red" />
                  <span>Total Rounds</span>
                </span>
                <div className="flex items-center justify-between h-9 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl px-2 shadow-3xs transition-smooth">
                  <button
                    type="button"
                    disabled={isConclaveRunningOrLocked || roundCount <= 1}
                    onClick={() => setRoundCount(r => Math.max(1, r - 1))}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black text-zinc-950 tabular-nums">
                    {roundCount}
                  </span>
                  <button
                    type="button"
                    disabled={isConclaveRunningOrLocked || roundCount >= 20}
                    onClick={() => setRoundCount(r => Math.min(20, r + 1))}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Round Timing */}
          <div className="space-y-2.5 pt-1 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-red" />
              <h4 className="text-xs sm:text-sm font-black text-zinc-950 tracking-tight">Round Timing</h4>
            </div>

            {/* 2 Columns: Break Between Rounds (Move Time) on left, Round Duration (Calculated) on right */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
              {/* Break Between Rounds (Move Time - Shifted to Left) */}
              <div className="flex flex-col gap-1.5 sm:pr-4">
                <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5 leading-none">
                  <Coffee className="w-3.5 h-3.5 text-brand-red" />
                  <span>Break Between Rounds</span>
                </span>
                <div className="relative w-full">
                  <select
                    value={moveSeconds}
                    disabled={isConclaveRunningOrLocked}
                    onChange={(e) => saveMoveSeconds(Number(e.target.value))}
                    className="w-full appearance-none h-9 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl pl-3 pr-8 py-1 text-xs font-bold text-zinc-900 shadow-3xs outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/30 cursor-pointer disabled:opacity-50 transition-smooth"
                  >
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Round Duration (Shifted to Right - Calculated dynamically from backend) */}
              <div className="flex flex-col gap-1.5 sm:pl-4 pt-2 sm:pt-0">
                <div className="flex items-center justify-between leading-none">
                  <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                    <Armchair className="w-3.5 h-3.5 text-brand-red" />
                    <span>Round Duration</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    Calculated
                  </span>
                </div>
                <div className="h-9 bg-zinc-50/80 border border-zinc-200 rounded-xl px-3 flex items-center justify-between text-xs font-bold text-zinc-900 shadow-3xs">
                  <span>
                    {(roundLengthSecs / 60) % 1 === 0
                      ? `${roundLengthSecs / 60} minutes`
                      : `${(roundLengthSecs / 60).toFixed(1)} minutes`}
                  </span>
                  <span className="text-[10.5px] font-semibold text-zinc-400">
                    ({personsPerTable} seats × 90s)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (50%): Rounds Summary */}
        <div className="bg-white border border-rose-100/80 rounded-2xl p-4 sm:p-5 shadow-3xs flex flex-col justify-between h-full space-y-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-brand-red" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-zinc-950">Rounds Summary</h3>
            </div>

            {/* 4 Metric Row (Moved to top) */}
            <div className="grid grid-cols-4 divide-x divide-zinc-150 text-center pb-3 border-b border-zinc-150">
              <div className="flex flex-col items-center justify-center px-1">
                <Users className="w-3.5 h-3.5 text-brand-red mb-1" />
                <span className="text-base font-black text-zinc-950 leading-none">{roundCount}</span>
                <span className="text-[10px] font-bold text-zinc-500 mt-1 whitespace-nowrap">Rounds</span>
              </div>

              <div className="flex flex-col items-center justify-center px-1">
                <TableIcon className="w-3.5 h-3.5 text-brand-red mb-1" />
                <span className="text-base font-black text-zinc-950 leading-none">{calculatedTableCount}</span>
                <span className="text-[10px] font-bold text-zinc-500 mt-1 whitespace-nowrap">Tables / Round</span>
              </div>

              <div className="flex flex-col items-center justify-center px-1">
                <Users className="w-3.5 h-3.5 text-brand-red mb-1" />
                <span className="text-base font-black text-zinc-950 leading-none">{totalAttendees}</span>
                <span className="text-[10px] font-bold text-zinc-500 mt-1 whitespace-nowrap">Members Seated</span>
              </div>

              <div className="flex flex-col items-center justify-center px-1">
                <Crown className="w-3.5 h-3.5 text-brand-red mb-1" />
                <span className="text-base font-black text-zinc-950 leading-none">{captainsCount}</span>
                <span className="text-[10px] font-bold text-zinc-500 mt-1 whitespace-nowrap">Captains Assigned</span>
              </div>
            </div>

            {/* 3 Prominent Stat Lines (Moved to bottom) */}
            <div className="space-y-3.5 pt-0.5">
              {/* Line 1: New Connections */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-extrabold text-zinc-800">New Connections</span>
                  <span className="font-black text-emerald-600 tabular-nums">{uniqueMeetingsVal}%</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-150 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${uniqueMeetingsVal}%` }}
                  />
                </div>
              </div>

              {/* Line 2: Chapter Mixing */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-extrabold text-zinc-800">Chapter Mixing</span>
                  <span className="font-black text-blue-600 tabular-nums">{diversityVal}%</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-150 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${diversityVal}%` }}
                  />
                </div>
              </div>

              {/* Line 3: Repeat Pairings */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-zinc-800">Repeat Pairings</span>
                    <button
                      type="button"
                      onClick={() => setShowRepeatModal(true)}
                      className="text-[11px] font-black text-brand-red bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md border border-brand-red/20 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      title="View members with repeat pairings"
                    >
                      <span>See Names</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-black text-zinc-950 tabular-nums">{repeatedPairingsVal}</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-150 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (repeatedPairingsVal / Math.max(1, totalAttendees)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Generation Progress Bar (shown when isGenerating) */}
      {isGenerating && (
        <div className="pt-2 border-t border-zinc-100 bg-zinc-50/70 p-3.5 rounded-xl space-y-2.5 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-zinc-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-red animate-pulse" />
              <span>{genStep}</span>
            </span>
            <span className="font-black text-brand-red">{progress}% complete</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-red rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: Action Buttons */}
      <div className="pt-4 border-t border-zinc-150/70 flex items-center justify-end gap-3 relative z-10">
        {/* Action Buttons: Preview & Generate Schedule */}
        <div className="flex items-center gap-3">
          {/* Preview Button */}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="h-9 px-4 rounded-xl border border-brand-red text-brand-red hover:bg-rose-50/70 font-bold text-xs inline-flex items-center gap-1.5 transition-smooth cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-brand-red" />
            <span>Preview</span>
          </button>

          {/* Lock Schedule Button (Visible when schedule is generated but not yet locked) */}
          {hasGeneratedSchedule && !isLocked && !isConclaveRunningOrLocked && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={isGenerating || isLocking}
              className="h-9 px-4 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-800 font-bold text-xs inline-flex items-center gap-1.5 transition-smooth cursor-pointer shadow-3xs disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5 text-zinc-600" />
              <span>Lock Schedule</span>
            </button>
          )}

          {/* Generate / Regenerate / Locked Button */}
          <button
            type="button"
            onClick={handleStartGeneration}
            disabled={isGenerating || isLocked || isConclaveCompleted || isRunning}
            className="h-9 inline-flex items-center gap-2 px-5 rounded-xl bg-brand-red hover:bg-red-750 text-white text-xs font-bold transition-smooth shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLocked || isConclaveCompleted ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Schedule Locked</span>
              </>
            ) : isRunning ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Conclave Running</span>
              </>
            ) : isGenerating ? (
              <>
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span>Generating...</span>
              </>
            ) : hasGeneratedSchedule ? (
              <>
                <RotateCw className="w-3.5 h-3.5" />
                <span>Regenerate Schedule</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* PREVIEW MODAL OVERLAY (Matches Mockup with Fullscreen Toggle) */}
      {isPreviewOpen && createPortal(
        <div className={`fixed inset-0 z-[99999] transition-all duration-200 ${isPreviewFullscreen
          ? 'bg-white flex flex-col overflow-hidden'
          : 'bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in'
          }`}>
          <div className={`w-full bg-white flex flex-col overflow-hidden ${isPreviewFullscreen
            ? 'h-full w-full rounded-none border-none'
            : 'max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl border border-zinc-200 animate-scale-up'
            }`}>
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-150 flex items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-brand-red" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-zinc-950 truncate">
                    Preview – Room View
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium truncate">
                    Overview of table-wise seating and assigned members for this schedule.
                  </p>
                </div>
              </div>

              {/* Right Side: Round Switcher Pill + Fullscreen Toggle + Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Round Switcher Pill Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRoundSelectOpen(!roundSelectOpen)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 shadow-3xs transition-smooth cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-brand-red" />
                    <span>Round {visualRound} of {roundCount}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </button>

                  {roundSelectOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-50 animate-scale-up">
                      <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Select Round
                      </div>
                      {Array.from({ length: roundCount }).map((_, idx) => {
                        const rNum = idx + 1;
                        return (
                          <button
                            key={rNum}
                            type="button"
                            onClick={() => {
                              setVisualRound(rNum);
                              setRoundSelectOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between cursor-pointer ${visualRound === rNum
                              ? 'bg-red-50 text-brand-red font-black'
                              : 'text-zinc-700 hover:bg-zinc-50'
                              }`}
                          >
                            <span>Round {rNum}</span>
                            {visualRound === rNum && <CheckCircle2 className="w-3.5 h-3.5 text-brand-red" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Fullscreen Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsPreviewFullscreen(!isPreviewFullscreen)}
                  className="w-8 h-8 rounded-xl hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-smooth cursor-pointer border border-zinc-200 shadow-3xs"
                  title={isPreviewFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isPreviewFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="w-8 h-8 rounded-xl hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-smooth cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-zinc-50/50">
              {/* 4 Stat Metric Cards Across */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Tables */}
                <div className="bg-white border border-rose-100/90 rounded-2xl p-3 sm:p-3.5 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                    <TableIcon className="w-5 h-5 text-brand-red" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-brand-red leading-tight">
                      {calculatedTableCount}
                    </div>
                    <div className="text-[11px] font-bold text-zinc-600">Tables</div>
                  </div>
                </div>

                {/* 2. Total Seats */}
                <div className="bg-white border border-blue-100/90 rounded-2xl p-3 sm:p-3.5 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-zinc-950 leading-tight">
                      {calculatedTableCount * personsPerTable}
                    </div>
                    <div className="text-[11px] font-bold text-zinc-600">Total Seats</div>
                  </div>
                </div>

                {/* 3. Seated Members */}
                <div className="bg-white border border-emerald-100/90 rounded-2xl p-3 sm:p-3.5 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-zinc-950 leading-tight">
                      {totalAttendees}
                    </div>
                    <div className="text-[11px] font-bold text-zinc-600">Seated Members</div>
                  </div>
                </div>

                {/* 4. Available Seats */}
                <div className="bg-white border border-amber-100/90 rounded-2xl p-3 sm:p-3.5 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Armchair className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-zinc-950 leading-tight">
                      {Math.max(0, (calculatedTableCount * personsPerTable) - (totalAttendees || 0))}
                    </div>
                    <div className="text-[11px] font-bold text-zinc-600">Available Seats</div>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="pt-1">
                {/* Search input */}
                <div className="relative w-full max-w-md">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search by member name, business, or table number..."
                    className="w-full pl-9.5 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand-red transition-smooth shadow-3xs"
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Room Grid View */}
              {(() => {
                  const query = tableSearch.toLowerCase().trim();
                  const participants = selectedConclave?.participants || [];
                  const standIns = selectedConclave?.standInCaptains?.[String(visualRound)] || {};

                  const allTables = Array.from({ length: calculatedTableCount }).map((_, tblIdx) => {
                    const tableNum = tblIdx + 1;
                    const scheduledTable = currentVisualRoundData?.tables?.find(t => (t.tableNumber || t.number) === tableNum);

                    const standInUid = standIns[String(tableNum)];
                    const anchorCaptain = scheduledTable
                      ? participants.find(p => p.id === scheduledTable.captainId || p.uid === scheduledTable.captainId || p._originalUid === scheduledTable.captainId) || (scheduledTable.captainName ? { name: scheduledTable.captainName } : null)
                      : null;

                    const standInCaptain = standInUid
                      ? participants.find(p => p._originalUid === standInUid || p.uid === standInUid || String(p.id) === String(standInUid))
                      : null;

                    const captain = standInCaptain || anchorCaptain || (scheduledTable ? { name: `Captain ${tableNum}` } : null);
                    const isStandIn = Boolean(standInCaptain);

                    const rawMembers = scheduledTable && Array.isArray(scheduledTable.memberIds)
                      ? scheduledTable.memberIds.map(mId => participants.find(p => p.id === mId || p.uid === mId || p._originalUid === mId) || { name: `Member ${mId}` })
                      : [];

                    // If a stand-in captain is designated, remove them from members list of this table so they aren't duplicated
                    const seatedMembers = isStandIn
                      ? rawMembers.filter(m => {
                          const mUid = m._originalUid || m.uid || String(m.id);
                          const sUid = standInCaptain._originalUid || standInCaptain.uid || String(standInCaptain.id);
                          return mUid !== sUid && m.id !== standInCaptain.id;
                        })
                      : rawMembers;

                    const captainCat = captain?.category || captain?.businessCategory || '';
                    const allCats = [captainCat, ...seatedMembers.map(m => m.category || m.businessCategory || '')].filter(Boolean).map(c => c.trim().toLowerCase());
                    const hasCategoryConflict = allCats.length !== new Set(allCats).size;

                    const matches = !query ||
                      tableNum.toString() === query ||
                      `table ${tableNum}`.includes(query) ||
                      (captain?.name || '').toLowerCase().includes(query) ||
                      (anchorCaptain?.name || '').toLowerCase().includes(query) ||
                      captainCat.toLowerCase().includes(query) ||
                      seatedMembers.some(m =>
                        (m.name || '').toLowerCase().includes(query) ||
                        (m.category || m.businessCategory || '').toLowerCase().includes(query)
                      );

                    return {
                      tableNum,
                      captain,
                      anchorCaptain,
                      isStandIn,
                      seatedMembers,
                      hasCategoryConflict,
                      matches
                    };
                  });

                  const visibleTables = allTables.filter(t => t.matches);

                  if (visibleTables.length === 0) {
                    return (
                      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-zinc-200 space-y-2">
                        <p className="text-xs font-bold text-zinc-500">No tables matching "{tableSearch}" in Round {visualRound}.</p>
                        <button
                          type="button"
                          onClick={() => setTableSearch('')}
                          className="text-xs font-extrabold text-brand-red hover:underline cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {visibleTables.map(({ tableNum, captain, anchorCaptain, isStandIn, seatedMembers, hasCategoryConflict }) => {
                        const occupiedCount = (captain ? 1 : 0) + seatedMembers.length;
                        const displaySeats = personsPerTable;

                        return (
                          <div
                            key={tableNum}
                            className={`bg-white rounded-2xl border p-4 space-y-3.5 shadow-3xs transition-smooth ${tableNum === 1
                              ? 'border-brand-red ring-1 ring-brand-red/20'
                              : 'border-zinc-200/80 hover:border-zinc-300'
                              }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-lg bg-brand-red text-white font-black text-xs flex items-center justify-center shrink-0">
                                  {tableNum}
                                </span>
                                <span className="text-xs font-black text-zinc-900">Table {tableNum}</span>
                                {hasCategoryConflict && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[8.5px] font-black uppercase">
                                    Conflict
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-brand-red bg-rose-50/80 border border-rose-150 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                <Armchair className="w-3.5 h-3.5 text-brand-red" />
                                <span>{occupiedCount} / {displaySeats} Seats</span>
                              </div>
                            </div>

                            {/* Table Captain Box */}
                            <div className={`border rounded-xl p-3 flex items-center gap-3 transition-smooth ${isStandIn ? 'bg-amber-50/90 border-amber-200 ring-1 ring-amber-300/30' : 'bg-rose-50/70 border-rose-100'}`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isStandIn ? 'bg-amber-200/90 text-amber-800' : 'bg-amber-100/90 text-amber-500'}`}>
                                <Crown className="w-4 h-4 fill-current" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${isStandIn ? 'text-amber-800' : 'text-brand-red'}`}>
                                    {isStandIn ? 'STAND-IN CAPTAIN' : 'TABLE CAPTAIN'}
                                  </span>
                                  {isStandIn && (
                                    <span className="text-[8.5px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 uppercase tracking-tight">
                                      Round {visualRound}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-black text-zinc-900 truncate mt-1">
                                  {captain?.name || (captain ? captain.name : `Captain ${tableNum}`)}
                                </div>
                                {isStandIn && anchorCaptain?.name && (
                                  <div className="text-[10px] font-medium text-zinc-500 truncate mt-0.5">
                                    Standing in for <span className="line-through text-zinc-400 font-semibold">{anchorCaptain.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Members Section */}
                            <div className="space-y-2 pt-0.5">
                              <div className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                                MEMBERS ({seatedMembers.length})
                              </div>
                              <div className="space-y-1.5">
                                {seatedMembers.length > 0 ? (
                                  seatedMembers.map((m, mIdx) => {
                                    const nameParts = (m.name || 'Member').trim().split(/\s+/);
                                    const initials = nameParts.length >= 2
                                      ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                                      : (m.name || 'M').substring(0, 2).toUpperCase();

                                    return (
                                      <div
                                        key={mIdx}
                                        className="bg-white p-2 rounded-xl border border-zinc-150 flex items-center justify-between gap-2 shadow-3xs hover:border-zinc-300 transition-smooth"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-6 h-6 rounded-lg bg-rose-50 text-brand-red text-[10px] font-black flex items-center justify-center shrink-0">
                                            {initials}
                                          </span>
                                          <span className="text-xs font-bold text-zinc-900 truncate">
                                            {m.name || `Member ${mIdx + 1}`}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-zinc-500 truncate text-right shrink-0 max-w-[140px]">
                                          {m.category || m.businessCategory || 'Member'}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="p-3 text-center bg-zinc-50/80 rounded-xl border border-dashed border-zinc-200 text-[11px] font-semibold text-zinc-400">
                                    No members assigned
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
            </div>

            {/* Modal Footer (Matching Mockup) */}
            <div className="p-3.5 sm:p-4 border-t border-zinc-200 bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-brand-red hover:bg-rose-50 font-bold text-xs shadow-3xs transition-smooth cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setExportOpen(!exportOpen)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-brand-red hover:bg-rose-50 font-bold text-xs shadow-3xs transition-smooth cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {exportOpen && (
                  <div className="absolute right-0 bottom-full mb-1.5 w-52 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-50 animate-scale-up">
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        window.print();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span>Export Seating Chart (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span>Export Schedule (CSV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        window.print();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span>Print Table Placards</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-6 py-2 rounded-xl bg-brand-red hover:bg-red-750 text-white font-bold text-xs shadow-xs transition-smooth cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Schedule Generated Success Modal */}
      {showSuccessModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200/90 space-y-5 animate-scale-up text-left">
            {/* Header: Green Check Icon + Title */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-zinc-950 leading-tight">
                    Schedule Generated!
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSuccessModal(false)}
                    className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                  All attending members have been arranged across tables and rounds. Seating is in draft mode and ready for your review.
                </p>
              </div>
            </div>

            {/* Quick Metrics Summary Grid */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-zinc-50/80 rounded-xl border border-zinc-200/70 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Rounds</span>
                <p className="text-base font-black text-zinc-900 mt-0.5">{roundCount}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tables / Round</span>
                <p className="text-base font-black text-zinc-900 mt-0.5">{calculatedTableCount}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Seated Members</span>
                <p className="text-base font-black text-brand-red mt-0.5">{totalAttendees}</p>
              </div>
            </div>

            {/* Quality Summary */}
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/80 flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>New Connections: <strong>{uniqueMeetingsVal}%</strong></span>
              </span>
              <span>Repeat Pairings: <strong>{repeatedPairingsVal}</strong></span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-smooth cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsPreviewOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-red-750 text-white text-xs font-bold rounded-xl shadow-xs transition-smooth cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Seating</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM LOCK MODAL OVERLAY */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">

            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-red" />
              <h3 className="font-extrabold text-zinc-900 text-sm">Lock & Finalize Seating</h3>
            </div>

            <div className="p-5 space-y-4 text-xs font-semibold text-zinc-600">
              <p className="leading-relaxed text-[12.5px]">
                You are about to lock the seating arrangement for <strong className="text-zinc-950 font-extrabold">{conclaveName}</strong>.
                Once locked, the schedule is final and members will see their assigned tables in the mobile app.
              </p>

              <div className="bg-red-50/50 border-l-4 border-brand-red p-3 text-[11px] text-zinc-700 italic rounded-r-lg">
                "Table assignments will be sent to the mobile app and table captains."
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedQuality}
                    onChange={(e) => setCheckedQuality(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-red border-zinc-300 rounded focus:ring-brand-red cursor-pointer accent-brand-red"
                  />
                  <span className="text-[11px] text-zinc-600 font-bold">I have reviewed the tables and seating arrangement.</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedEdits}
                    onChange={(e) => setCheckedEdits(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-red border-zinc-300 rounded focus:ring-brand-red cursor-pointer accent-brand-red"
                  />
                  <span className="text-[11px] text-zinc-600 font-bold">I understand seating will be locked and cannot be changed.</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isLocking}
                onClick={() => {
                  if (isLocking) return;
                  setIsModalOpen(false);
                  setCheckedQuality(false);
                  setCheckedEdits(false);
                }}
                className="px-4 py-2 border border-zinc-200 bg-white text-zinc-700 text-xs font-bold rounded-xl hover:bg-zinc-50 transition-smooth cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLocking || !(checkedQuality && checkedEdits)}
                onClick={handleConfirmLock}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-red hover:bg-red-750 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-smooth cursor-pointer"
              >
                {isLocking ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Locking Seating...</span>
                  </>
                ) : (
                  <span>Lock Seating</span>
                )}
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
                <h3 className="text-base font-black text-zinc-900">Repeat Meetings List</h3>
                <p className="text-[11px] text-zinc-400 font-medium">Members sitting together at the same table more than once</p>
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
                  <h4 className="text-sm font-extrabold text-emerald-900">No Repeat Meetings!</h4>
                  <p className="text-[11px] text-emerald-700">Every member will meet completely different people in every single round.</p>
                </div>
              ) : (
                repeatPairingDetails.map((pair, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-brand-red bg-red-50 px-2 py-0.5 rounded border border-brand-red/10">
                        Sitting Together {pair.occurrences.length} Times
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                        <p className="text-[12px] font-black text-zinc-800 truncate">{pair.member1.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pair.member1.company || pair.member1.businessCategory || 'Member 1'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                        <p className="text-[12px] font-black text-zinc-800 truncate">{pair.member2.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pair.member2.company || pair.member2.businessCategory || 'Member 2'}</p>
                      </div>
                    </div>
                    <div className="text-[10.5px] text-zinc-500 font-medium pt-1">
                      <span className="font-bold text-zinc-700">Tables: </span>
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
                className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs rounded-xl transition-smooth cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-xl shadow-xl flex items-center gap-3 border border-zinc-800 animate-slide-up">
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
