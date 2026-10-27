import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  SlidersHorizontal,
  Play,
  CheckCircle2,
} from 'lucide-react';
import ScheduleGen from './ScheduleGen';
import ScheduleReview from './ScheduleReview';
import RoundRunner from './RoundRunner';
import { api } from '../services/api';

export default function ScheduleHub({
  selectedConclaveId,
  showGenWarning,
  clearGenWarning,
  searchQuery,
  initialStage = 'auto',
  onStageChange,
}) {
  const [conclave, setConclave] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load selected conclave details to know status and schedule state
  useEffect(() => {
    let isMounted = true;
    async function fetchConclave() {
      if (!selectedConclaveId) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null);
        if (isMounted && data) {
          setConclave(data);
        }
      } catch (err) {
        console.warn('Failed to load conclave in ScheduleHub:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchConclave();
    return () => { isMounted = false; };
  }, [selectedConclaveId]);

  // Determine stage: 'generate' | 'review' | 'runner'
  const [stage, setStage] = useState(() => {
    if (initialStage && initialStage !== 'auto') {
      return initialStage;
    }
    return 'generate';
  });

  // Auto-switch to appropriate stage when conclave loads if initialStage was 'auto'
  useEffect(() => {
    if (!conclave || initialStage !== 'auto') return;
    const status = (conclave.status || '').toLowerCase();
    const hasSchedule = Boolean(conclave.scheduleSummary || conclave.schedule || conclave.rounds?.length > 0 || conclave.isScheduleLocked);

    if (status === 'running') {
      setStage('runner');
    } else if (hasSchedule || status === 'completed') {
      setStage('review');
    } else {
      setStage('generate');
    }
  }, [conclave?.id, conclave?.status, initialStage]);

  // Synchronize when initialStage prop changes externally (e.g., from URL navigation)
  useEffect(() => {
    if (initialStage && initialStage !== 'auto' && initialStage !== stage) {
      setStage(initialStage);
    }
  }, [initialStage]);

  const conclaveStatus = (conclave?.status || '').toLowerCase();
  const isLive = conclaveStatus === 'running';
  const hasSchedule = Boolean(conclave?.scheduleSummary || conclave?.schedule || conclave?.rounds?.length > 0 || conclave?.isScheduleLocked);

  const stages = [
    {
      id: 'generate',
      title: 'Create Schedule',
      Icon: TrendingUp,
      isComplete: hasSchedule
    },
    {
      id: 'review',
      title: 'Review Tables',
      Icon: SlidersHorizontal,
      isComplete: isLive || conclaveStatus === 'completed'
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
      review: 'schedule-review',
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
            {conclave?.name || conclave?.title || 'Selected Conclave'} · {conclave?.region || 'All Regions'} · {isRunnerStage ? 'Live round execution and real-time seating analytics.' : 'Create schedules, inspect tables, and run rounds.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
          {/* Progression Mode Switcher */}
          <div className="inline-flex items-center p-0.5 bg-zinc-200/80 rounded-xl border border-zinc-200 shadow-2xs">
            <button
              type="button"
              onClick={async () => {
                if (!conclave?.id) return;
                setConclave(prev => ({ ...prev, roundProgressionMode: 'manual' }));
                try {
                  await api.post(`/admin/conclaves/${conclave.id}/progression-mode`, { mode: 'manual' });
                } catch (e) { console.error(e); }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                (conclave?.roundProgressionMode || 'manual') === 'manual'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Manual: Admin starts every round"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Manual</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!conclave?.id) return;
                setConclave(prev => ({ ...prev, roundProgressionMode: 'automatic' }));
                try {
                  await api.post(`/admin/conclaves/${conclave.id}/progression-mode`, { mode: 'automatic' });
                } catch (e) { console.error(e); }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                conclave?.roundProgressionMode === 'automatic'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Automatic: Rounds progress automatically when timer ends"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${conclave?.roundProgressionMode === 'automatic' ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
              <span>Automatic</span>
            </button>
          </div>

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
                className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${isActive
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
            onScheduleReady={() => handleStageSelect('review')}
            isHubMode={true}
          />
        )}

        {stage === 'review' && (
          <ScheduleReview
            setActiveTab={handleStageSelect}
            searchQuery={searchQuery}
            selectedConclaveId={selectedConclaveId}
            onNavigateToRunner={() => handleStageSelect('runner')}
            isHubMode={true}
          />
        )}

        {stage === 'runner' && (
          <RoundRunner
            selectedConclaveId={selectedConclaveId}
            onNavigateToReview={() => handleStageSelect('review')}
            isHubMode={true}
          />
        )}
      </div>
    </div>
  );
}
