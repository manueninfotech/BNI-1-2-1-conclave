import React from 'react';
import { Check } from 'lucide-react';
import { STAGES, stageOf } from './conclaveStage';

/** Registration → Tables → Live → Done, with the current stage highlighted. */
export default function StageSteps({ conclave }) {
  const current = stageOf(conclave);
  if (current === 'cancelled') {
    return <p className="text-sm font-bold text-zinc-500">Cancelled</p>;
  }
  const idx = STAGES.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3" aria-label="Conclave stage">
      {STAGES.map((s, i) => {
        const done = i < idx || current === 'done';
        const active = i === idx && current !== 'done';
        return (
          <li key={s.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className={`flex items-center gap-1.5 text-[12px] sm:text-[13px] font-bold whitespace-nowrap ${
                active ? 'text-brand-red' : done ? 'text-zinc-800' : 'text-zinc-400'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                  active ? 'bg-brand-red text-white' : done ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < STAGES.length - 1 && <span className={`h-px w-4 sm:w-8 ${i < idx ? 'bg-zinc-800' : 'bg-zinc-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
