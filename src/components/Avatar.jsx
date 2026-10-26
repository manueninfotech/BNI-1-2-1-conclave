import React, { useState } from 'react';
import { fileUrl } from '../services/api';

/** A member's photo, or their initials when there is none (or it fails to load). */
export default function Avatar({ name, photoUrl, size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);
  const src = !broken && fileUrl(photoUrl);
  const initials = String(name || '?').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      style={style}
      className={`rounded-full object-cover shrink-0 bg-zinc-100 border border-zinc-200 ${className}`}
    />
  ) : (
    <span
      aria-hidden="true"
      style={style}
      className={`rounded-full shrink-0 inline-flex items-center justify-center font-bold bg-brand-red/10 text-brand-red border border-brand-red/10 ${className}`}
    >
      {initials}
    </span>
  );
}
