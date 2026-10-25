import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

/** Why schedule generation was refused (or what to watch), shown over the page. */
export default function GenWarningBanner({ genWarning, onClose }) {
  return (
    <>
  {genWarning && (
    <div
      role="alert"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-xl flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-lg ${genWarning.type === 'captain'
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-red-50 border-red-300 text-red-900'
        }`}
    >
      <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${genWarning.type === 'captain' ? 'text-amber-500' : 'text-red-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[13px] leading-snug">{genWarning.title}</p>
        <p className="text-[12px] mt-0.5 leading-relaxed opacity-90">{genWarning.message}</p>

        {/* Blocking issues — the reasons the engine refused to generate. */}
        {Array.isArray(genWarning.issues) && genWarning.issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {genWarning.issues.map((it, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                <span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0" />
                <span>{it.message || it.code || String(it)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Soft warnings — generation could still proceed, but flag these. */}
        {Array.isArray(genWarning.warnings) && genWarning.warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {genWarning.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug opacity-80">
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                <span>{w.message || w.code || String(w)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* The roster math the engine derived, so the admin sees the shape. */}
        {genWarning.derived && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] font-semibold opacity-75">
            {genWarning.derived.activeCount != null && <span>{genWarning.derived.activeCount} members</span>}
            {genWarning.derived.tableCount != null && <span>· {genWarning.derived.tableCount} tables</span>}
            {genWarning.derived.captainsDesignated != null && genWarning.derived.captainsRequired != null && (
              <span>· {genWarning.derived.captainsDesignated}/{genWarning.derived.captainsRequired} captains</span>
            )}
            {genWarning.derived.distinctCategories != null && <span>· {genWarning.derived.distinctCategories} categories</span>}
          </div>
        )}

        {genWarning.hint && (
          <p className="mt-2 text-[11.5px] font-semibold leading-snug">💡 {genWarning.hint}</p>
        )}
      </div>
      <button onClick={onClose} aria-label="Dismiss warning" className="shrink-0 rounded-md p-1 hover:bg-black/10 transition-colors cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  )}
    </>
  );
}
