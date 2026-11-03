import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Play,
  CheckCircle2,
} from 'lucide-react';
import ScheduleGen from './ScheduleGen';
import RoundRunner from './RoundRunner';
import { api } from '../services/api';

export default function ScheduleHub({
  selectedConclaveId,
  showGenWarning,
  clearGenWarning,
  initialStage = 'auto',
  onStageChange,
}) {
  const [conclave, setConclave] = useState(null);

  // Load selected conclave details to know status and schedule state
  useEffect(() => {
    let isMounted = true;
    async function fetchConclave() {
      if (!selectedConclaveId) return;
      try {
        const data = await api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null);
        if (isMounted && data) {
          setConclave(data);
        }
      } catch (err) {
        console.warn('Failed to load conclave in ScheduleHub:', err);
      }
    }

    fetchConclave();
    return () => { isMounted = false; };
  }, [selectedConclaveId]);

  // Determine stage: 'generate' | 'runner'
  const [stage, setStage] = useState(() => {
    if (initialStage && initialStage !== 'auto') {
      if (initialStage === 'review') return 'generate';
      return initialStage;
    }
    return 'generate';
  });

  // Auto-switch to appropriate stage when conclave loads if initialStage was 'auto'
  useEffect(() => {
    if (!conclave || initialStage !== 'auto') return;
    const status = (conclave.status || '').toLowerCase();

    if (status === 'running') {
      setStage('runner');
    } else {
      setStage('generate');
    }
  }, [conclave, initialStage]);

  // Synchronize when initialStage prop changes externally (e.g., from URL navigation)
  useEffect(() => {
    if (initialStage && initialStage !== 'auto') {
      const normalized = initialStage === 'review' ? 'generate' : initialStage;
      if (normalized !== stage) {
        setStage(normalized);
      }
    }
  }, [initialStage, stage]);

  const conclaveStatus = (conclave?.status || '').toLowerCase();
  const isLive = conclaveStatus === 'running';
  const hasSchedule = Boolean(conclave?.scheduleSummary || conclave?.schedule || conclave?.rounds?.length > 0 || conclave?.isScheduleLocked);

  const stages = [
    {
      id: 'generate',
      title: 'Schedule & Seating',
      Icon: LayoutGrid,
      isComplete: hasSchedule
    },
    {
      id: 'runner',
      title: 'Round Runner',
      Icon: Play,
      isLive: isLive
    }
  ];

  useEffect(() => {
    if (typeof onStageChange === 'function') {
      onStageChange(stage);
    }
  }, [stage, onStageChange]);

  const handleStageSelect = (stageId) => {
    setStage(stageId);
    if (typeof onStageChange === 'function') {
      onStageChange(stageId);
    }
    // Update browser URL gently without full page reload
    const role = localStorage.getItem('bni_user_role') || 'admin';
    const tabUrlMap = {
      generate: 'schedule-gen',
      review: 'schedule-gen',
      runner: 'round-runner'
    };
    window.history.replaceState({}, '', `/${role}/${tabUrlMap[stageId] || 'schedule-hub'}`);
  };

  const isRunnerStage = stage === 'runner';

  return (
    <div className="w-full mx-auto max-w-[1700px] space-y-4 sm:space-y-5 pb-10">
      {/* Sleek Borderless Header & Modern Segmented Pill Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
              Schedule & Rounds
            </h1>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Round Active
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-semibold mt-0.5">
            {conclave?.name || conclave?.title || 'Selected Conclave'} · {conclave?.region || 'All Regions'} · {isRunnerStage ? 'Manage live rounds and timer' : 'Set up tables, review seating, and start rounds'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
          {/* Modern Pill Switcher */}
          <div className="inline-flex items-center p-1 bg-zinc-200/70 rounded-xl border border-zinc-200/80 shadow-2xs shrink-0">
            {stages.map((st) => {
              const isActive = stage === st.id;
              const IconComponent = st.Icon;

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStageSelect(st.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/50'
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-brand-red' : 'text-zinc-400'}`} />
                  <span>{st.title}</span>
                  {st.isLive ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  ) : st.isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Render Active Stage Component */}
      <div className="w-full transition-all duration-200">
        {stage === 'generate' && (
          <ScheduleGen
            selectedConclaveId={selectedConclaveId}
            showGenWarning={showGenWarning}
            clearGenWarning={clearGenWarning}
            onNavigateToRunner={() => handleStageSelect('runner')}
            isHubMode={true}
          />
        )}

        {stage === 'runner' && (
          <RoundRunner
            selectedConclaveId={selectedConclaveId}
            onNavigateToSchedule={() => handleStageSelect('generate')}
            isHubMode={true}
          />
        )}
      </div>
    </div>
  );
}
