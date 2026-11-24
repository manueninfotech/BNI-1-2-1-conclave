import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { api, fileUrl } from '../services/api';
import { useConclave } from '../hooks/useConclave';

const MAX_SIDE = 2000;
const MAX_FLYERS = 12;

/**
 * Reads an image file and scales it so its longest side is at most 2000 px,
 * as a JPEG data URL. Phone photos are often 5-12 MB; this keeps uploads fast
 * and under the server's 8 MB limit without visible loss on a phone screen.
 */
function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('Choose a JPEG, PNG or WebP image.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // transparent PNGs get a white page, not black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The conclave's cover image and flyers. Members see them in the app; every
 * change reaches open phones and panels within seconds over the live stream.
 */
export default function ConclaveImagesPanel({ conclaveId }) {
  const queryClient = useQueryClient();
  const { data: conclave } = useConclave(conclaveId);
  const cover = conclave?.coverImage || null;
  const flyers = Array.isArray(conclave?.flyers) ? conclave.flyers.filter(Boolean) : [];
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const coverInput = useRef(null);
  const flyerInput = useRef(null);

  // Apply the server's answer at once; the live stream confirms it shortly.
  const patch = (fields) =>
    queryClient.setQueryData(['conclave', conclaveId], (old) => (old ? { ...old, ...fields } : old));

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const uploadCover = (file) =>
    run('cover', async () => {
      const dataUrl = await toDataUrl(file);
      const r = await api.put(`/admin/conclaves/${conclaveId}/cover`, { dataUrl, name: file.name });
      patch({ coverImage: r?.coverImage ?? null });
    });

  const removeCover = () =>
    run('cover', async () => {
      await api.delete(`/admin/conclaves/${conclaveId}/cover`);
      patch({ coverImage: null });
    });

  const addFlyers = (files) =>
    run('flyers', async () => {
      const room = MAX_FLYERS - flyers.length;
      const list = Array.from(files).slice(0, Math.max(0, room));
      if (list.length === 0) throw new Error(`A conclave can have up to ${MAX_FLYERS} flyers.`);
      let latest = flyers;
      for (const file of list) {
        const dataUrl = await toDataUrl(file);
        const r = await api.post(`/admin/conclaves/${conclaveId}/flyers`, { dataUrl, name: file.name });
        latest = r?.flyers ?? latest;
        patch({ flyers: latest });
      }
    });

  const removeFlyer = (f) => {
    if (!window.confirm(`Remove "${f.name}"? Members will no longer see it.`)) return;
    run(`flyer:${f.id}`, async () => {
      const r = await api.delete(`/admin/conclaves/${conclaveId}/flyers/${f.id}`);
      patch({ flyers: r?.flyers ?? flyers.filter((x) => x.id !== f.id) });
    });
  };

  const move = (index, delta) =>
    run('order', async () => {
      const ids = flyers.map((f) => f.id);
      const j = index + delta;
      if (j < 0 || j >= ids.length) return;
      [ids[index], ids[j]] = [ids[j], ids[index]];
      const r = await api.put(`/admin/conclaves/${conclaveId}/flyers/order`, { ids });
      patch({ flyers: r?.flyers ?? flyers });
    });

  return (
    <div className="space-y-5 pt-4">
      {error && (
        <p className="text-xs font-bold text-brand-red bg-red-50 border border-red-200 p-2.5 rounded-lg" role="alert">
          {error}
        </p>
      )}

      <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Cover image</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Shown on the conclave card and page in the app, and on shared links. A wide image (16:9) works best.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {cover && (
              <button
                type="button"
                onClick={removeCover}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" /> {busy === 'cover' ? 'Uploading...' : cover ? 'Replace' : 'Upload'}
            </button>
            <input
              ref={coverInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) uploadCover(f);
              }}
            />
          </div>
        </div>
        <div className="mt-4 aspect-video max-w-xl rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 flex items-center justify-center">
          {cover ? (
            <img src={fileUrl(cover.url)} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" /> No cover yet. The app shows the plain design.
            </span>
          )}
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">
              Flyers <span className="text-zinc-400 font-semibold">{flyers.length} of {MAX_FLYERS}</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Members swipe through these on the conclave page and can share them. Use the arrows to set the order.
            </p>
          </div>
          <button
            type="button"
            onClick={() => flyerInput.current?.click()}
            disabled={Boolean(busy) || flyers.length >= MAX_FLYERS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 shrink-0"
          >
            <ImagePlus className="w-3.5 h-3.5" /> {busy === 'flyers' ? 'Uploading...' : 'Add flyers'}
          </button>
          <input
            ref={flyerInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              const copy = files ? Array.from(files) : [];
              e.target.value = '';
              if (copy.length) addFlyers(copy);
            }}
          />
        </div>

        {flyers.length === 0 ? (
          <p className="text-xs text-zinc-400 italic mt-4">No flyers yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {flyers.map((f, i) => (
              <figure key={f.id} className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50">
                <img src={fileUrl(f.url)} alt={f.name} className="w-full aspect-[3/4] object-cover" />
                <figcaption className="flex items-center gap-1 p-2">
                  <span className="text-[11px] font-semibold text-zinc-700 truncate flex-1" title={f.name}>
                    {i + 1}. {f.name}
                  </span>
                  <button type="button" title="Move earlier" disabled={Boolean(busy) || i === 0} onClick={() => move(i, -1)} className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30 cursor-pointer">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Move later" disabled={Boolean(busy) || i === flyers.length - 1} onClick={() => move(i, 1)} className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30 cursor-pointer">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Remove flyer" disabled={Boolean(busy)} onClick={() => removeFlyer(f)} className="p-1 rounded hover:bg-red-100 text-zinc-500 hover:text-brand-red disabled:opacity-30 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
