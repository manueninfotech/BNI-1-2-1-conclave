import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown } from 'lucide-react';
import { api } from '../services/api';

/**
 * Create / edit a conclave. Kept to what an organiser actually decides:
 *
 *   name, venue, day and time, whether registration is open (and, optionally,
 *   when it closes by itself), and the fee.
 *
 * Everything else is either worked out by the system (the stage, the date
 * text, captains = one per table when tables are generated) or tucked under
 * "More options" (member limit, several days, coordinator, description).
 *
 * `FeeSection` is the existing fee + optional offline-payment block.
 */
export default function ConclaveForm({ mode, formData, setFormData, onSubmit, onCancel, isSuperadmin, assignedAdminRegion, FeeSection }) {
  const set = (patch) => setFormData((prev) => ({ ...prev, ...patch }));
  const locked = Boolean(formData.isScheduleLocked);
  const [regions, setRegions] = useState([]);
  const [showMore, setShowMore] = useState(
    () => mode === 'edit' && Boolean(formData.description || (formData.endDate && formData.endDate !== formData.startDate)),
  );
  const multiDay = Boolean(formData.multiDay);

  useEffect(() => {
    if (!isSuperadmin) return;
    api.get('/admin/regions')
      .then((list) => setRegions((Array.isArray(list) ? list : list?.regions || []).map((r) => (typeof r === 'string' ? r : r.name)).filter(Boolean)))
      .catch(() => setRegions([]));
  }, [isSuperadmin]);

  const input = 'w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white disabled:bg-zinc-100 disabled:text-zinc-500';
  const lbl = 'text-xs font-semibold text-zinc-600 block mb-1';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 animate-fade-in">
      <form onSubmit={onSubmit} className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
          <h3 className="font-extrabold text-zinc-950">{mode === 'edit' ? 'Edit conclave' : 'New conclave'}</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="p-1 hover:bg-zinc-100 rounded text-zinc-400 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {/* What and where */}
          <div className="space-y-3">
            <div>
              <label className={lbl} htmlFor="cf-name">Name</label>
              <input id="cf-name" className={input} required value={formData.name} onChange={(e) => set({ name: e.target.value })} placeholder="BNI Guntur 121 Conclave" />
            </div>
            <div>
              <label className={lbl} htmlFor="cf-venue">Venue</label>
              <input id="cf-venue" className={input} required value={formData.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="ITC, Guntur" />
            </div>
            {isSuperadmin ? (
              <div>
                <label className={lbl} htmlFor="cf-region">Region</label>
                <select id="cf-region" className={input} required value={formData.region || ''} onChange={(e) => set({ region: e.target.value })}>
                  <option value="" disabled>Choose a region</option>
                  {[...new Set([...(formData.region ? [formData.region] : []), ...regions])].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Region: <span className="font-semibold text-zinc-700">{assignedAdminRegion || formData.region || '—'}</span></p>
            )}
          </div>

          {/* When */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className={lbl} htmlFor="cf-date">{multiDay ? 'Starts on' : 'Date'}</label>
              <input id="cf-date" type="date" className={input} required value={formData.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </div>
            <div>
              <label className={lbl} htmlFor="cf-start">Starts at</label>
              <input id="cf-start" type="time" className={input} required value={formData.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            </div>
            <div>
              <label className={lbl} htmlFor="cf-end">Ends at</label>
              <input id="cf-end" type="time" className={input} required value={formData.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </div>
          </div>

          {/* Registration */}
          <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
            <label className={`flex items-start justify-between gap-3 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
              <span>
                <span className="block text-sm font-bold text-zinc-900">Registration open</span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  {locked
                    ? 'Closed for good: the tables are locked.'
                    : formData.isRegistrationOpen
                      ? 'Members can register in the app now.'
                      : 'Members can see the conclave but not register yet.'}
                </span>
              </span>
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 accent-emerald-600 shrink-0"
                disabled={locked}
                checked={!locked && Boolean(formData.isRegistrationOpen)}
                onChange={(e) => set({ isRegistrationOpen: e.target.checked })}
              />
            </label>
            {!locked && formData.isRegistrationOpen && (
              <div>
                <span className={lbl}>Close registration automatically (optional)</span>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" aria-label="Close registration on" className={input} value={formData.regEndDate || ''} onChange={(e) => set({ regEndDate: e.target.value })} />
                  <input type="time" aria-label="Close registration at" className={input} value={formData.regEndTime || ''} onChange={(e) => set({ regEndTime: e.target.value })} disabled={!formData.regEndDate} />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">Leave empty to close it yourself before generating the tables.</p>
              </div>
            )}
          </div>

          {FeeSection && <FeeSection formData={formData} setFormData={setFormData} />}

          {/* More options */}
          <div>
            <button type="button" onClick={() => setShowMore((v) => !v)} className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer">
              <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} /> More options
            </button>
            {showMore && (
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-brand-red" checked={multiDay} onChange={(e) => set({ multiDay: e.target.checked, endDate: e.target.checked ? formData.endDate || formData.startDate : '' })} />
                  Runs over more than one day
                </label>
                {multiDay && (
                  <div>
                    <label className={lbl} htmlFor="cf-enddate">Ends on</label>
                    <input id="cf-enddate" type="date" className={input} min={formData.startDate || undefined} value={formData.endDate || ''} onChange={(e) => set({ endDate: e.target.value })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl} htmlFor="cf-limit">Maximum members</label>
                    <input id="cf-limit" type="number" min="1" className={input} value={formData.memberLimit} onChange={(e) => set({ memberLimit: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl} htmlFor="cf-coord">Coordinator</label>
                    <input id="cf-coord" className={input} value={formData.coordinator} onChange={(e) => set({ coordinator: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={lbl} htmlFor="cf-desc">Description</label>
                  <textarea id="cf-desc" rows={3} className={input} value={formData.description} onChange={(e) => set({ description: e.target.value })} placeholder="Shown to members in the app" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-zinc-100 flex justify-end gap-2.5 shrink-0">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-brand-red hover:bg-red-700 text-white text-sm font-bold cursor-pointer">
            {mode === 'edit' ? 'Save changes' : 'Create conclave'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/**
 * The request body for POST / PUT /admin/conclaves from the form.
 * Registration: open → "open"; open with a close time → "auto" (opens now,
 * closes at that time); off → "closed". Stage and date text are left to the
 * server; captains come from the tables.
 */
export function conclavePayload(fd, { isSuperadmin, assignedAdminRegion, loggedInAdmin }) {
  const today = new Date().toISOString().slice(0, 10);
  const auto = fd.isRegistrationOpen && fd.regEndDate;
  return {
    name: fd.name.trim(),
    venueLocation: fd.venue.trim(),
    region: isSuperadmin ? fd.region || assignedAdminRegion : assignedAdminRegion || fd.region || '',
    coordinator: (fd.coordinator || '').trim() || loggedInAdmin?.name || '',
    description: fd.description || '',
    date: fd.startDate,
    endDate: fd.multiDay && fd.endDate ? fd.endDate : fd.startDate,
    startTime: fd.startTime,
    endTime: fd.endTime,
    registrationOverride: fd.isRegistrationOpen ? (auto ? 'auto' : 'open') : 'closed',
    isRegistrationOpen: Boolean(fd.isRegistrationOpen),
    regStartDate: auto ? today : undefined,
    regEndDate: auto ? fd.regEndDate : undefined,
    regEndTime: auto ? fd.regEndTime || '23:59' : undefined,
    memberLimit: Number(fd.memberLimit) || 100,
    paymentDetails: {
      registrationFee: Number(fd.registrationFee) || 0,
      bankName: (fd.bankName || '').trim(),
      accountNumber: (fd.accountNumber || '').trim(),
      ifscCode: (fd.ifscCode || '').trim(),
      accountHolderName: (fd.accountHolderName || '').trim(),
      upiId: (fd.upiId || '').trim(),
      upiQrImageUrl: (fd.upiQrImageUrl || '').trim(),
    },
  };
}
