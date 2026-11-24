import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users, X } from 'lucide-react';
import { api } from '../services/api';

/**
 * BNI chapters members pick from at sign-up and in their profile. One shared
 * spelling per chapter keeps the "keep chapter members apart" seating rule
 * accurate. An empty list leaves the app's chapter field as free text.
 * Suggestions are chapters members already typed, so the list can be built
 * from real data in a few clicks.
 */
export default function ChaptersCard() {
  const [chapters, setChapters] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/admin/chapters');
      setChapters(r?.chapters || []);
      setSuggestions(r?.suggestions || []);
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load chapters.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e?.message || 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  };

  const add = (name) =>
    run(async () => {
      const n = (name ?? draft).trim();
      if (!n) return;
      await api.post('/admin/chapters', { name: n });
      if (name === undefined) setDraft('');
    });
  const remove = (name) => run(() => api.post('/admin/chapters/remove', { name }));
  const addAllSuggestions = () =>
    run(() => api.put('/admin/chapters', { chapters: [...chapters, ...suggestions.map((s) => s.name)] }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? chapters.filter((c) => c.toLowerCase().includes(q)) : chapters;
  }, [chapters, search]);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0 border border-emerald-100">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-950">BNI Chapters</h3>
              <span className="px-2 py-0.2 bg-zinc-100 text-zinc-700 text-[10px] font-bold rounded-full">{chapters.length} total</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Members pick their chapter from this list in the app, so one chapter is never spelled two ways. Leave it empty to let members type it.
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter chapters..."
            className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs font-bold text-brand-red bg-red-50 border border-red-200 p-2.5 rounded-lg mt-3" role="alert">
          {error}
        </p>
      )}

      <div className="pt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="Add a chapter (e.g. BNI Amaravati)..."
          className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <button
          type="button"
          onClick={() => add()}
          disabled={busy || !draft.trim()}
          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Chapter</span>
        </button>
      </div>

      <div className="pt-4 flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <span className="text-xs text-zinc-400 italic py-2">
            {search ? 'No chapters match your search.' : 'No chapters yet. Members type their chapter until you add some.'}
          </span>
        ) : (
          filtered.map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-zinc-100 text-zinc-800 text-xs font-semibold rounded-lg border border-zinc-200">
              <span>{name}</span>
              <button
                type="button"
                onClick={() => remove(name)}
                title="Remove chapter"
                disabled={busy}
                className="w-4 h-4 rounded hover:bg-zinc-300 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-zinc-700">Typed by members, not on the list yet</p>
            <button type="button" onClick={addAllSuggestions} disabled={busy} className="text-xs font-bold text-[#00875A] hover:underline cursor-pointer disabled:opacity-50">
              Add all
            </button>
          </div>
          <div className="pt-2 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => add(s.name)}
                disabled={busy}
                title="Add to the list"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-zinc-700 text-xs font-semibold rounded-lg border border-dashed border-zinc-300 hover:border-zinc-500 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>{s.name}</span>
                <span className="text-zinc-400">{s.members}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
