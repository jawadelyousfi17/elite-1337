'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from '@/components/icons';
import { cn } from '@/lib/utils';

/** Kiwi, the app's mascot: a quiet corner companion on desktop that says hello when clicked. */
export function KiwiGuide() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Click anywhere else or press Escape to close the bubble.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [open]);

  return <div ref={root} className={cn('kiwi', open && 'is-open')}>
    {open && <div className="kiwi-bubble" role="status" aria-live="polite">
      <button type="button" className="kiwi-close" onClick={() => setOpen(false)} aria-label="Close"><X size={13}/></button>
      <p>Hello!</p>
    </div>}
    <button type="button" className="kiwi-face" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Say hi to Kiwi">
      <img src="/assets/cats/kiwi-mascot.webp" alt="" width={160} height={160}/>
    </button>
  </div>;
}

/** Kiwi inside empty and loading states. */
export function KiwiNote({ children, mood = 'idle' }: { children: React.ReactNode; mood?: 'idle' | 'busy' }) {
  return <div className={cn('kiwi-note', mood === 'busy' && 'is-busy')}>
    <img src="/assets/cats/kiwi-mascot.webp" alt="" width={96} height={96}/>
    <div>{children}</div>
  </div>;
}

/** Loading card on top of a page's skeleton: a progress bar and Kiwi at work. */
export function KiwiLoader({ title, note }: { title: string; note?: string }) {
  return <div className="pc-loader" role="status" aria-live="polite">
    <div className="pc-loader-bar"><span/></div>
    <KiwiNote mood="busy"><strong>{title}</strong>{note && <span>{note}</span>}</KiwiNote>
  </div>;
}
