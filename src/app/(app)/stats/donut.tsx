'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type DonutPart = { key: string | number; label: string; value: number; color: string; dim?: boolean };

const fmt = (value: number) => value.toLocaleString('en-US');
const share = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

/**
 * Part-to-whole ring with a legend that carries every label, count and share.
 * Hovering (or focusing, or tapping) a slice or legend row shows that part in the center.
 */
export function Donut({ parts, total, caption, label }: { parts: DonutPart[]; total: number; caption: string; label: string }) {
  const [active, setActive] = useState<string | number | null>(null);
  const radius = 70, circumference = 2 * Math.PI * radius, gap = 3;
  const shown = parts.find((part) => part.key === active);
  let offset = 0;
  const focus = (key: string | number) => ({ onPointerEnter: () => setActive(key), onPointerLeave: () => setActive(null), onFocus: () => setActive(key), onBlur: () => setActive(null) });
  return <div className={cn('sc-donut', active !== null && 'is-hovering')}>
    <div className="sc-donut-ring">
      <svg viewBox="0 0 180 180" role="img" aria-label={`${label}: ${parts.map((part) => `${part.label} ${part.value}`).join(', ')}`}>
        <circle cx="90" cy="90" r={radius} className="sc-donut-track"/>
        {parts.map((part) => {
          const length = total ? part.value / total * circumference : 0, dash = Math.max(0, length - gap);
          const segment = <circle key={part.key} cx="90" cy="90" r={radius} fill="none" stroke={part.color} strokeWidth="22" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
            className={cn('sc-donut-seg', part.dim && 'is-dim', active === part.key && 'is-active')} transform="rotate(-90 90 90)" {...focus(part.key)}/>;
          offset += length;
          return segment;
        })}
      </svg>
      <div className="sc-donut-center" aria-live="polite">
        {shown ? <><strong>{fmt(shown.value)}</strong><span className="sc-donut-label">{shown.label}</span><span>{share(shown.value, total)}% of {fmt(total)}</span></>
          : <><strong>{fmt(total)}</strong><span>{caption}</span></>}
      </div>
    </div>
    <ul className="sc-legend">{parts.map((part) => <li key={part.key} className={cn(part.dim && 'is-dim', active === part.key && 'is-active')} tabIndex={0} {...focus(part.key)} onClick={() => setActive((current) => current === part.key ? null : part.key)}>
      <i style={{ background: part.color }}/><span>{part.label}</span><b>{fmt(part.value)}</b><small>{share(part.value, total)}%</small>
    </li>)}</ul>
  </div>;
}
