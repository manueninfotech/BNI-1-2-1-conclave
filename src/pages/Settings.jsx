import { useEffect, useState, useMemo } from 'react';
import {
  Tag,
  Timer,
  Sliders,
  MapPin,
  Bell,
  Plus,
  X,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  Search,
  Smartphone,
  Info,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import { broadcastTabMessage, subscribeTabMessages } from '../utils/syncBus';

const capitalizeFirst = (value) => value.charAt(0).toLocaleUpperCase() + value.slice(1);

// eslint-disable-next-line no-control-regex -- strip unprintable ASCII/control bytes for Postgres jsonb
const STRIP_CONTROL_REGEX = /[\u0000-\u001F\u007F-\u009F]/g;
const stripControlChars = (str) => String(str || '').replace(STRIP_CONTROL_REGEX, '').trim();

function parseNamesCsv(text, kind) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('The CSV has an unclosed quotation mark.');
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  const names = rows.map((cells) => cells[0]?.trim()).filter(Boolean);
  const headers = ['name', 'category', 'region', 'business category', 'business categories', 'regions'];
  if (headers.includes(names[0]?.toLocaleLowerCase())) names.shift();
  if (names.length === 0) throw new Error(`No ${kind} found. Use a CSV with one ${kind} per row.`);
  return names.map(capitalizeFirst);
}

// Native unzipper + reader for modern Excel (.xlsx) files using browser DecompressionStream and DOMParser
async function parseXlsx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Not a valid Excel (.xlsx) file.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const files = {};
  let cur = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(cur, true) !== 0x02014b50) break;
    const method = view.getUint16(cur + 10, true);
    const compressedSize = view.getUint32(cur + 20, true);
    const fileNameLen = view.getUint16(cur + 28, true);
    const extraLen = view.getUint16(cur + 30, true);
    const commentLen = view.getUint16(cur + 32, true);
    const localHeaderOffset = view.getUint32(cur + 42, true);

    const fileNameBytes = bytes.subarray(cur + 46, cur + 46 + fileNameLen);
    const fileName = new TextDecoder().decode(fileNameBytes);

    if (fileName === 'xl/sharedStrings.xml' || (fileName.startsWith('xl/worksheets/sheet') && fileName.endsWith('.xml'))) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const rawData = bytes.subarray(dataStart, dataStart + compressedSize);

      let decompressedText = '';
      if (method === 0) {
        decompressedText = new TextDecoder().decode(rawData);
      } else if (method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(rawData);
        writer.close();
        const resp = new Response(ds.readable);
        decompressedText = await resp.text();
      }
      files[fileName] = decompressedText;
    }

    cur += 46 + fileNameLen + extraLen + commentLen;
  }

  const sharedStrings = [];
  if (files['xl/sharedStrings.xml']) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(files['xl/sharedStrings.xml'], 'text/xml');
    const siNodes = doc.getElementsByTagName('si');
    for (let i = 0; i < siNodes.length; i++) {
      const tNodes = siNodes[i].getElementsByTagName('t');
      let str = '';
      for (let j = 0; j < tNodes.length; j++) {
        str += tNodes[j].textContent || '';
      }
      sharedStrings.push(str.trim());
    }
  }

  const sheetKey = Object.keys(files).find((k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'));
  const values = [];

  if (sheetKey && files[sheetKey]) {
    const parser = new DOMParser();
    const sheetDoc = parser.parseFromString(files[sheetKey], 'text/xml');
    const rowNodes = sheetDoc.getElementsByTagName('row');

    for (let i = 0; i < rowNodes.length; i++) {
      const cNodes = rowNodes[i].getElementsByTagName('c');
      for (let j = 0; j < cNodes.length; j++) {
        const c = cNodes[j];
        const r = c.getAttribute('r') || '';
        // Strictly import Column A (e.g. A1, A2); ignore Column B, C, AA, etc.
        if (/^A\d+$/i.test(r)) {
          const t = c.getAttribute('t');
          let val = '';
          if (t === 's') {
            const v = c.getElementsByTagName('v')[0]?.textContent;
            const idx = parseInt(v, 10);
            if (!isNaN(idx) && sharedStrings[idx] !== undefined) {
              val = sharedStrings[idx];
            }
          } else if (t === 'inlineStr') {
            val = c.getElementsByTagName('t')[0]?.textContent || '';
          } else {
            val = c.getElementsByTagName('v')[0]?.textContent || '';
          }
          val = stripControlChars(val);
          if (val) values.push(val);
          break;
        }
      }
    }
  }

  return values;
}

async function parseImportFile(file, kind) {
  const fileName = (file.name || '').toLowerCase();

  if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
    throw new Error('Legacy Excel 97-2003 (.xls) format is not supported. Please save or export your file as modern Excel (.xlsx) or CSV (.csv).');
  }

  const buffer = await file.arrayBuffer();
  const headerBytes = new Uint8Array(buffer.slice(0, 4));
  const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4B && headerBytes[2] === 0x03 && headerBytes[3] === 0x04;

  let rawNames = [];
  if (fileName.endsWith('.xlsx') || isZip) {
    rawNames = await parseXlsx(buffer);
  } else {
    const text = new TextDecoder('utf-8').decode(buffer);
    rawNames = parseNamesCsv(text, kind);
  }

  const cleaned = rawNames
    .map((name) => stripControlChars(name))
    .filter((name) => name.length > 0 && name.length <= 100);

  const headers = ['name', 'names', 'category', 'categories', 'region', 'regions', 'business category', 'business categories', 'chapter', 'chapters'];
  if (cleaned.length > 0 && headers.includes(cleaned[0].toLowerCase())) {
    cleaned.shift();
  }

  if (cleaned.length === 0) {
    throw new Error(`No valid ${kind} found in file. Please provide a file with one ${kind} per row.`);
  }

  return cleaned.map(capitalizeFirst);
}

/**
 * Modern Executive Settings & Configurations.
 * Manages conclave default parameters, business categories,
 * BNI official round timing standards, regional scoping, and push notifications.
 * 100% connected to real backend APIs.
 */
export default function Settings() {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'defaults', 'categories', 'timing', 'regions', 'notifications'

  // Categories
  const [categories, setCategories] = useState([]);
  const [catSearch, setCatSearch] = useState('');
  const [newCatDraft, setNewCatDraft] = useState('');
  const [catErr, setCatErr] = useState(false);
  const [catActionLoading, setCatActionLoading] = useState(false);
  const [catImportStatus, setCatImportStatus] = useState('');

  // Regions
  const [regions, setRegions] = useState([]);
  const [newRegionDraft, setNewRegionDraft] = useState('');
  const [regState, setRegState] = useState('');
  const [regionImportStatus, setRegionImportStatus] = useState('');

  // Round timing (Official BNI Standard)
  const [timing, setTiming] = useState({ bioSeconds: 60, referralSeconds: 30, bufferSeconds: 120 });

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
      try {
        const c = await api.get('/admin/categories');
        setCategories(c.categories || []);
      } catch {
        setCatErr(true);
      }
      try {
        const r = await api.get('/admin/settings/regions');
        setRegions(r.regions || []);
      } catch { }
      try {
        const t = await api.get('/admin/settings/round-timing');
        if (t) setTiming(t);
      } catch { }
      try {
        const d = await api.get('/admin/settings/conclave-defaults');
        if (d) {
          setDefaults(d);
          localStorage.setItem('bni_conclave_defaults', JSON.stringify(d));
        }
      } catch { }
      try {
        const n = await api.get('/admin/settings/notifications');
        if (n) setNotif(n);
      } catch { }
    })();

    // Listen to real-time cross-tab updates (e.g. category or region changed in another tab)
    const unsubscribe = subscribeTabMessages((msg) => {
      if (msg.type === 'SETTINGS_CHANGED') {
        if (msg.kind === 'categories' && Array.isArray(msg.categories)) {
          setCategories(msg.categories);
        } else if (msg.kind === 'regions' && Array.isArray(msg.regions)) {
          setRegions(msg.regions);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Category Actions ---
  const addCategory = async (name) => {
    const raw = (name || newCatDraft).trim();
    const trimmed = raw ? capitalizeFirst(raw) : '';
    if (!trimmed) return;
    setCatActionLoading(true);
    try {
      const r = await api.post('/admin/categories', { name: trimmed });
      const updated = r.categories || [];
      setCategories(updated);
      broadcastTabMessage({ type: 'SETTINGS_CHANGED', kind: 'categories', categories: updated });
      setNewCatDraft('');
      setCatErr(false);
    } catch {
      setCatErr(true);
    } finally {
      setCatActionLoading(false);
    }
  };

  const removeCategory = async (name) => {
    const previous = categories;
    const next = categories.filter((c) => c.toLowerCase() !== name.toLowerCase());
    setCategories(next);
    setCatActionLoading(true);
    try {
      const r = await api.post('/admin/categories/remove', { name });
      const updated = r?.categories || next;
      setCategories(updated);
      broadcastTabMessage({ type: 'SETTINGS_CHANGED', kind: 'categories', categories: updated });
      setCatErr(false);
    } catch {
      setCategories(previous);
      setCatErr(true);
    } finally {
      setCatActionLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase().trim();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const handleNamesImport = async (kind, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const setImportStatus = kind === 'category' ? setCatImportStatus : setRegionImportStatus;
    const currentNames = kind === 'category' ? categories : regions;
    setImportStatus('Importing…');
    if (kind === 'category') setCatActionLoading(true);
    else setRegState('saving');

    try {
      const importedNames = await parseImportFile(file, kind === 'category' ? 'categories' : 'regions');
      const existing = new Set(currentNames.map((name) => name.toLocaleLowerCase()));
      const additions = [];
      for (const name of importedNames) {
        const key = name.toLocaleLowerCase();
        if (!existing.has(key)) {
          existing.add(key);
          additions.push(name);
        }
      }

      if (additions.length === 0) {
        setImportStatus('No new entries; all imported names already exist.');
        return;
      }

      if (kind === 'category') {
        const merged = [...currentNames, ...additions];
        const result = await api.put('/admin/categories', { categories: merged });
        const updated = result.categories || merged;
        setCategories(updated);
        broadcastTabMessage({ type: 'SETTINGS_CHANGED', kind: 'categories', categories: updated });
        setCatErr(false);
      } else {
        const merged = [...currentNames, ...additions];
        const result = await api.put('/admin/settings/regions', { regions: merged });
        const updated = result.regions || merged;
        setRegions(updated);
        broadcastTabMessage({ type: 'SETTINGS_CHANGED', kind: 'regions', regions: updated });
        setRegState('saved');
      }
      const skipped = importedNames.length - additions.length;
      setImportStatus(`Imported ${additions.length}${skipped ? `; skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`);
    } catch (error) {
      let msg = error.message || `Could not import ${kind}s.`;
      if (msg.includes('Failed query:') || msg.includes('insert into') || msg.includes('Internal Server Error')) {
        msg = `Could not import ${kind}s. Please check the file contents and try again.`;
      }
      setImportStatus(`Error: ${msg}`);
      if (kind === 'region') setRegState('error');
    } finally {
      if (kind === 'category') setCatActionLoading(false);
      else setTimeout(() => setRegState(''), 2500);
    }
  };

  // --- Region Actions ---
  const saveRegions = async (next) => {
    const capitalizedRegions = next.map((region) => {
      const trimmed = region.trim();
      return trimmed ? capitalizeFirst(trimmed) : '';
    }).filter(Boolean);
    const previous = regions;
    setRegions(capitalizedRegions);
    setRegState('saving');
    try {
      const r = await api.put('/admin/settings/regions', { regions: capitalizedRegions });
      const updated = r.regions || capitalizedRegions;
      setRegions(updated);
      broadcastTabMessage({ type: 'SETTINGS_CHANGED', kind: 'regions', regions: updated });
      setRegState('saved');
      setNewRegionDraft('');
    } catch {
      setRegions(previous);
      setRegState('error');
    }
    setTimeout(() => setRegState(''), 2500);
  };

  const addRegion = () => {
    const raw = newRegionDraft.trim();
    const trimmed = raw ? capitalizeFirst(raw) : '';
    if (!trimmed) return;
    if (!regions.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      saveRegions([...regions, trimmed]);
    } else {
      setNewRegionDraft('');
    }
  };

  // --- Save Helpers ---
  const saveDefaults = async () => {
    setDefState('saving');
    try {
      const body = {
        personsPerTable: Math.min(8, Math.max(2, Number(defaults.personsPerTable) || 7)),
        roundCount: Math.max(1, Number(defaults.roundCount) || 6),
      };
      const r = await api.put('/admin/settings/conclave-defaults', body);
      setDefaults(r);
      localStorage.setItem('bni_conclave_defaults', JSON.stringify(r));
      setDefState('saved');
    } catch {
      setDefState('error');
    }
    setTimeout(() => setDefState(''), 2500);
  };

  const saveNotif = async () => {
    setNotifState('saving');
    try {
      const r = await api.put('/admin/settings/notifications', notif);
      setNotif(r);
      setNotifState('saved');
    } catch {
      setNotifState('error');
    }
    setTimeout(() => setNotifState(''), 2500);
  };

  // Notification helper
  const insertPlaceholder = (key, field, placeholder) => {
    const current = notif[key]?.[field] || '';
    setNotif({
      ...notif,
      [key]: {
        ...notif[key],
        [field]: `${current} ${placeholder}`.trim(),
      },
    });
  };

  const notifConfigs = [
    {
      key: 'roundStarted',
      label: 'Round Started Alert',
      hint: 'Sent to attendees when a new round kicks off.',
      variable: '{round}',
      varLabel: 'Round Number',
    },
    {
      key: 'conclaveEnded',
      label: 'Conclave Concluded Alert',
      hint: 'Sent when all rounds finish, prompting attendees to submit feedback.',
      variable: null,
      varLabel: null,
    },
    {
      key: 'referralReceived',
      label: 'Referral Received Alert',
      hint: 'Sent to a member when someone passes them a business lead.',
      variable: '{giver}',
      varLabel: 'Giver Name',
    },
  ];

  // Calculated interaction capacity
  const uniqueContactsCount = useMemo(() => {
    const persons = Number(defaults.personsPerTable) || 7;
    const rounds = Number(defaults.roundCount) || 6;
    return Math.max(0, (persons - 1) * rounds);
  }, [defaults]);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto w-full font-sans select-none pb-8">
      {/* 1. Frameless Header */}
      <div>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Settings & Configurations</h1>
        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
          Global conclave parameters, timing rules, business categories, and push notification templates.
        </p>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100/80 rounded-xl border border-zinc-200/70 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'all'
              ? 'bg-white text-zinc-950 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900'
            }`}
        >
          All Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('defaults')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'defaults'
              ? 'bg-white text-zinc-950 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900'
            }`}
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-500" />
          <span>Defaults</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'categories'
              ? 'bg-white text-zinc-950 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900'
            }`}
        >
          <Tag className="w-3.5 h-3.5 text-zinc-500" />
          <span>Categories ({categories.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timing')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'timing'
              ? 'bg-white text-zinc-950 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900'
            }`}
        >
          <Timer className="w-3.5 h-3.5 text-zinc-500" />
          <span>Round Timing</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('regions')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'regions'
              ? 'bg-white text-zinc-950 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900'
            }`}
        >
          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
          <span>Regions ({regions.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'notifications'
              ? 'bg-white text-zinc-950 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900'
            }`}
        >
          <Bell className="w-3.5 h-3.5 text-zinc-500" />
          <span>Notifications</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* Section 1: Conclave Defaults */}
        {(activeTab === 'all' || activeTab === 'defaults') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 text-brand-red flex items-center justify-center shrink-0 border border-red-100">
                  <Sliders className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Default Conclave Configuration</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Pre-fills initial seating capacity and round targets when creating new conclaves.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveDefaults}
                  disabled={defState === 'saving'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-red hover:bg-[#b51c2a] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  {defState === 'saving' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Defaults</span>
                </button>
                <StatusBadge state={defState} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                  Persons per Table
                </label>
                <p className="text-[11px] text-zinc-400 mb-2">Maximum 8 members per round table.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="8"
                    value={defaults.personsPerTable}
                    onChange={(e) =>
                      setDefaults({
                        ...defaults,
                        personsPerTable: Math.min(8, Math.max(2, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-28 px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                  <span className="text-xs text-zinc-500 font-semibold">members</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                  Default Rounds Count
                </label>
                <p className="text-[11px] text-zinc-400 mb-2">Planned rounds for conclave sessions.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={defaults.roundCount}
                    onChange={(e) =>
                      setDefaults({
                        ...defaults,
                        roundCount: Math.max(1, Number(e.target.value) || 0),
                      })
                    }
                    className="w-28 px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-black text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                  <span className="text-xs text-zinc-500 font-semibold">rounds</span>
                </div>
              </div>

              <div className="bg-zinc-50 rounded-lg p-3.5 border border-zinc-200/80 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
                  Attendee Reach Estimate
                </span>
                <div className="my-1">
                  <span className="text-2xl font-black text-zinc-950 tabular-nums">
                    {uniqueContactsCount}
                  </span>
                  <span className="text-xs font-bold text-[#00875A] ml-1.5">Direct 1-to-1s</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Each attendee pitches to and exchanges referrals with {uniqueContactsCount} unique peers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Business Categories */}
        {(activeTab === 'all' || activeTab === 'categories') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0 border border-emerald-100">
                    <Tag className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-zinc-950">Business Categories</h3>
                      <span className="px-2 py-0.2 bg-zinc-100 text-zinc-700 text-[10px] font-bold rounded-full">
                        {categories.length} total
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      1-2-1 Connect classification standard. No two members sharing the same category are seated together.
                    </p>
                  </div>
                </div>
                <label
                  title="Import categories from Excel (.xlsx) or CSV (.csv)"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-50 ${catActionLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import
                  <input
                    type="file"
                    accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                    disabled={catActionLoading}
                    className="hidden"
                    onChange={(event) => handleNamesImport('category', event)}
                  />
                </label>
              </div>

              {/* Category Search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Filter categories..."
                  className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
                {catSearch && (
                  <button
                    type="button"
                    onClick={() => setCatSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {catErr && (
              <p className="text-xs font-bold text-brand-red bg-red-50 border border-red-200 p-2.5 rounded-lg mt-3">
                Failed to communicate with categories API. Please retry.
              </p>
            )}
            {catImportStatus && (
              <p className={`text-xs font-semibold mt-3 ${catImportStatus.startsWith('Error:') ? 'text-brand-red' : 'text-emerald-700'}`} role="status">
                {catImportStatus}
              </p>
            )}

            {/* Add Category Input */}
            <div className="pt-4 flex gap-2">
              <input
                value={newCatDraft}
                onChange={(e) => setNewCatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCategory();
                }}
                placeholder="Enter new business category (e.g. Corporate Law, Interior Design)..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
              <button
                type="button"
                onClick={() => addCategory()}
                disabled={catActionLoading || !newCatDraft.trim()}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </div>

            {/* Categories Chips Grid */}
            <div className="pt-4 flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
              {filteredCategories.length === 0 ? (
                <span className="text-xs text-zinc-400 italic py-2">
                  {catSearch ? 'No categories match your search.' : 'No categories configured.'}
                </span>
              ) : (
                filteredCategories.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-zinc-100 hover:bg-zinc-150 text-zinc-800 text-xs font-semibold rounded-lg border border-zinc-200 transition-colors"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(name)}
                      title="Remove category"
                      disabled={catActionLoading}
                      className="w-4 h-4 rounded hover:bg-zinc-300 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Section 3: Official Round Timing Standard */}
        {(activeTab === 'all' || activeTab === 'timing') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
                  <Timer className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-950">1-2-1 Connect Round Timing Standard</h3>
                    <span className="px-2 py-0.2 bg-emerald-50 text-[#00875A] border border-emerald-200 text-[10px] font-bold rounded-full">
                      Official Fixed Format
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Ensures strict equality of presentation time across all attending members and chapters.
                  </p>
                </div>
              </div>
            </div>

            {/* Timing Phase Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Phase 1</span>
                  <span className="text-xs font-black text-[#00875A] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {timing.bioSeconds}s (1 min) / person
                  </span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900">Member Bio Pitch</h4>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Each attendee is spotlighted sequentially to deliver their 60-second business pitch to the table.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Phase 2</span>
                  <span className="text-xs font-black text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                    {timing.referralSeconds}s / person
                  </span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900">Referral Exchange</h4>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Single collective round-table slot following all bios for members to log referrals on their mobile app.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Phase 3</span>
                  <span className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    1 - 2 mins move
                  </span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900">Table Transition Break</h4>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Configured per conclave (manual admin trigger or automatic timer) for members to rotate to their next seating assignment.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg flex items-center gap-2 text-xs text-amber-900 font-medium">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Standard timing formulas (60s bio + 30s referral) are locked across the 1-2-1 Connect network to maintain competitive integrity. Live conclave admins may add +1m, +2m, or +5m extensions in real time if required.
              </span>
            </div>
          </div>
        )}

        {/* Section 4: Regional Scoping */}
        {(activeTab === 'all' || activeTab === 'regions') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
                  <MapPin className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Regions & Geographic Scopes</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Regions available for conclave scheduling and regional admin permissions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  title="Import regions from Excel (.xlsx) or CSV (.csv)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import
                  <input
                    type="file"
                    accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                    className="hidden"
                    onChange={(event) => handleNamesImport('region', event)}
                  />
                </label>
                <StatusBadge state={regState} />
              </div>
            </div>
            {regionImportStatus && (
              <p className={`text-xs font-semibold mt-3 ${regionImportStatus.startsWith('Error:') ? 'text-brand-red' : 'text-emerald-700'}`} role="status">
                {regionImportStatus}
              </p>
            )}

            <div className="pt-4 flex gap-2">
              <input
                value={newRegionDraft}
                onChange={(e) => setNewRegionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addRegion();
                }}
                placeholder="Add new region (e.g. Hyderabad East, Bangalore Central)..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
              <button
                type="button"
                onClick={addRegion}
                disabled={!newRegionDraft.trim()}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Region</span>
              </button>
            </div>

            <div className="pt-4 flex flex-wrap gap-2">
              {regions.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold rounded-lg"
                >
                  <MapPin className="w-3 h-3 text-purple-600" />
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => saveRegions(regions.filter((r) => r !== name))}
                    title="Remove region"
                    className="w-4 h-4 rounded hover:bg-purple-200 text-purple-500 hover:text-purple-800 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section 5: Push Notification Templates */}
        {(activeTab === 'all' || activeTab === 'notifications') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-100">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Push Notification Templates</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Messages delivered to member mobile devices. Variables in braces are populated in real time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveNotif}
                  disabled={notifState === 'saving'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-red hover:bg-[#b51c2a] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  {notifState === 'saving' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Templates</span>
                </button>
                <StatusBadge state={notifState} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
              {notifConfigs.map(({ key, label, hint, variable, varLabel }) => (
                <div
                  key={key}
                  className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-zinc-900">{label}</span>
                      {variable && (
                        <button
                          type="button"
                          onClick={() => insertPlaceholder(key, 'body', variable)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-700 cursor-pointer transition-colors"
                          title={`Insert ${varLabel}`}
                        >
                          + {variable}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mb-2.5">{hint}</p>

                    <label className="block mb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Notification Title
                      </span>
                      <input
                        value={notif[key]?.title || ''}
                        onChange={(e) =>
                          setNotif({
                            ...notif,
                            [key]: { ...notif[key], title: e.target.value },
                          })
                        }
                        placeholder="e.g. Round Starting"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Notification Body
                      </span>
                      <textarea
                        value={notif[key]?.body || ''}
                        onChange={(e) =>
                          setNotif({
                            ...notif,
                            [key]: { ...notif[key], body: e.target.value },
                          })
                        }
                        placeholder="e.g. Round {round} has commenced. Check your table assignment."
                        rows={3}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-brand-red leading-relaxed"
                      />
                    </label>
                  </div>

                  {/* Lock Screen Preview */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-200/70 flex items-start gap-2 text-[10px] text-zinc-400">
                    <Smartphone className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <span className="truncate">
                      Preview: <strong>{notif[key]?.title || 'Alert'}</strong> · {notif[key]?.body || 'Message body...'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ state }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-semibold">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#00875A] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        <Check className="w-3 h-3" /> Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-brand-red font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
        <AlertTriangle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return null;
}
