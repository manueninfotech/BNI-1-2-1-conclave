import { useEffect, useState } from 'react';
import { Plus, X, Save, Loader2, Check, AlertTriangle, Tag, Timer, Sliders, MapPin, Bell } from 'lucide-react';
import { api } from '../services/api';
import { setTimingConfig } from '../utils/roundTiming';

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------
function Card({ icon: Icon, title, desc, children }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-5 md:p-6 mb-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-zinc-900">{title}</h3>
          {desc && <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Status({ state }) {
  if (state === 'saving') return <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>;
  if (state === 'saved') return <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-bold"><Check className="w-3 h-3" /> Saved</span>;
  if (state === 'error') return <span className="inline-flex items-center gap-1 text-[11px] text-brand-red font-bold"><AlertTriangle className="w-3 h-3" /> Failed</span>;
  return null;
}

function NumberField({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number" min="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-3 py-2 rounded-lg border border-zinc-200 text-sm font-bold text-zinc-900 focus:outline-none focus:border-brand-red"
        />
        {suffix && <span className="text-[11px] text-zinc-400">{suffix}</span>}
      </div>
    </label>
  );
}

function SaveBtn({ onClick, state }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        type="button" onClick={onClick} disabled={state === 'saving'}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" /> Save
      </button>
      <Status state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// An editable string list (add / remove). mode 'instant' uses add/remove
// endpoints; mode 'replace' edits locally and saves the whole list.
// ---------------------------------------------------------------------------
function EditableList({ items, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onAdd(draft.trim()); setDraft(''); } }}
          placeholder="Add new…"
          className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-brand-red"
        />
        <button
          type="button"
          onClick={() => { if (draft.trim()) { onAdd(draft.trim()); setDraft(''); } }}
          className="inline-flex items-center gap-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 && <span className="text-[11px] text-zinc-400">Nothing yet.</span>}
        {items.map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-zinc-100 text-zinc-700 text-[11px] font-bold rounded-full">
            {name}
            <button type="button" onClick={() => onRemove(name)} title="Remove" className="w-4 h-4 rounded-full hover:bg-zinc-300 flex items-center justify-center cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Settings() {
  // Categories (instant add/remove)
  const [categories, setCategories] = useState([]);
  const [catErr, setCatErr] = useState(false);

  // Regions (edit + replace)
  const [regions, setRegions] = useState([]);
  const [regState, setRegState] = useState('');

  // Round timing
  const [timing, setTiming] = useState({ bioSeconds: 60, referralSeconds: 30, bufferSeconds: 120 });
  const [timingState, setTimingState] = useState('');

  // Conclave defaults
  const [defaults, setDefaults] = useState({ personsPerTable: 7, roundCount: 6 });
  const [defState, setDefState] = useState('');

  // Notification templates
  const [notif, setNotif] = useState({
    roundStarted: { title: '', body: '' },
    conclaveEnded: { title: '', body: '' },
    referralReceived: { title: '', body: '' },
  });
  const [notifState, setNotifState] = useState('');

  useEffect(() => {
    (async () => {
      try { const c = await api.get('/admin/categories'); setCategories(c.categories || []); } catch { setCatErr(true); }
      try { const r = await api.get('/admin/settings/regions'); setRegions(r.regions || []); } catch {}
      try { const t = await api.get('/admin/settings/round-timing'); setTiming(t); } catch {}
      try {
        const d = await api.get('/admin/settings/conclave-defaults');
        if (d) {
          setDefaults(d);
          localStorage.setItem('bni_conclave_defaults', JSON.stringify(d));
        }
      } catch {}
      try { const n = await api.get('/admin/settings/notifications'); setNotif(n); } catch {}
    })();
  }, []);

  // --- Categories ---
  const addCategory = async (name) => {
    try { const r = await api.post('/admin/categories', { name }); setCategories(r.categories || []); setCatErr(false); }
    catch (e) { setCatErr(true); }
  };
  const removeCategory = async (name) => {
    try { const r = await api.post('/admin/categories/remove', { name }); setCategories(r.categories || []); }
    catch (e) { setCatErr(true); }
  };

  // --- Regions (replace) ---
  const saveRegions = async (next) => {
    setRegState('saving');
    try { const r = await api.put('/admin/settings/regions', { regions: next }); setRegions(r.regions || next); setRegState('saved'); }
    catch { setRegState('error'); }
    setTimeout(() => setRegState(''), 2000);
  };

  // --- Save helpers ---
  const saveDefaults = async () => {
    setDefState('saving');
    try {
      const body = {
        personsPerTable: Math.min(8, Number(defaults.personsPerTable)),
        roundCount: Number(defaults.roundCount),
      };
      const r = await api.put('/admin/settings/conclave-defaults', body);
      setDefaults(r);
      localStorage.setItem('bni_conclave_defaults', JSON.stringify(r));
      setDefState('saved');
    } catch { setDefState('error'); }
    setTimeout(() => setDefState(''), 2000);
  };
  const saveNotif = async () => {
    setNotifState('saving');
    try { const r = await api.put('/admin/settings/notifications', notif); setNotif(r); setNotifState('saved'); }
    catch { setNotifState('error'); }
    setTimeout(() => setNotifState(''), 2000);
  };

  const notifKeys = [
    ['roundStarted', 'Round started', 'Use {round} for the round number'],
    ['conclaveEnded', 'Conclave ended', ''],
    ['referralReceived', 'Referral received', 'Use {giver} for the giver’s name'],
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-zinc-900">Settings</h1>
        <p className="text-[12px] text-zinc-500 mt-1">Changes take effect immediately — no app update needed.</p>
      </div>

      <Card icon={Tag} title="Business Categories" desc="What members choose from at registration. No two members of the same category share a table.">
        {catErr && <p className="text-[11px] text-brand-red mb-2">Couldn’t reach categories. Try again.</p>}
        <EditableList items={categories} onAdd={addCategory} onRemove={removeCategory} />
        <p className="text-[10px] text-zinc-400 mt-2">{categories.length} categories</p>
      </Card>

      <Card icon={Timer} title="Round Timing" desc="Fixed for every conclave.">
        <ul className="text-[12.5px] text-zinc-700 space-y-1">
          <li><strong>Bios:</strong> 1 minute per person.</li>
          <li><strong>Referrals:</strong> 30 seconds per person, in one slot after everyone's bio.</li>
          <li><strong>A round</strong> with 8 per table takes 12 minutes. Admins can add +1, +2 or +5 minutes to a live round.</li>
          <li><strong>Between rounds:</strong> the admin starts each round (manual), or the next one starts after a 1, 2 or 5 minute move break (automatic, chosen per conclave).</li>
        </ul>
      </Card>

      <Card icon={Sliders} title="Default Conclave Config" desc="Pre-filled when creating a new conclave.">
        <div className="flex flex-wrap gap-5">
          <NumberField label="Persons / table (max 8)" value={defaults.personsPerTable} onChange={(v) => setDefaults({ ...defaults, personsPerTable: Math.min(8, Number(v) || 0) })} />
          <NumberField label="Rounds" value={defaults.roundCount} onChange={(v) => setDefaults({ ...defaults, roundCount: v })} />
        </div>
        <SaveBtn onClick={saveDefaults} state={defState} />
      </Card>

      <Card icon={MapPin} title="Regions" desc="Region options for conclaves and member scoping.">
        <EditableList
          items={regions}
          onAdd={(name) => { if (!regions.some((r) => r.toLowerCase() === name.toLowerCase())) saveRegions([...regions, name]); }}
          onRemove={(name) => saveRegions(regions.filter((r) => r !== name))}
        />
        <div className="mt-2"><Status state={regState} /></div>
      </Card>

      <Card icon={Bell} title="Notification Wording" desc="Push messages sent to members. Placeholders in braces are filled automatically.">
        <div className="space-y-4">
          {notifKeys.map(([key, label, hint]) => (
            <div key={key} className="border border-zinc-100 rounded-xl p-3">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
              <input
                value={notif[key]?.title || ''}
                onChange={(e) => setNotif({ ...notif, [key]: { ...notif[key], title: e.target.value } })}
                placeholder="Title"
                className="w-full px-3 py-2 mb-2 rounded-lg border border-zinc-200 text-sm font-bold focus:outline-none focus:border-brand-red"
              />
              <textarea
                value={notif[key]?.body || ''}
                onChange={(e) => setNotif({ ...notif, [key]: { ...notif[key], body: e.target.value } })}
                placeholder="Body" rows={2}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-brand-red"
              />
              {hint && <p className="text-[10px] text-zinc-400 mt-1">{hint}</p>}
            </div>
          ))}
        </div>
        <SaveBtn onClick={saveNotif} state={notifState} />
      </Card>
    </div>
  );
}
