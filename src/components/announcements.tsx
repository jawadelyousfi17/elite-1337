'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, Megaphone } from '@/components/icons';
import { PROMOS, PromoDialog, PromoLogo, followPromo, preloadPromoAccess, promoHref, usePromoResult } from '@/components/promo-shared';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Navbar announcements: hover (or tap on phones) shows the open campus promos, each behind the same campus check. */
export function Announcements() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = usePromoResult();
  const [busy, setBusy] = useState<string | null>(null);

  // Signed-in pages already looked up the student's profile for the navbar, so checking access early costs no extra 42 request.
  useEffect(() => { const timer = setTimeout(() => void preloadPromoAccess(), 1200); return () => clearTimeout(timer); }, []);

  // Tapping outside or pressing Escape closes the panel opened by a tap.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [open]);

  if (!PROMOS.length) return null;
  return <div ref={root} className={cn('ann', open && 'is-open')} onPointerEnter={() => void preloadPromoAccess()} onFocus={() => void preloadPromoAccess()}>
    <button type="button" className="ann-button" aria-expanded={open} aria-controls="ann-panel" aria-label={`Announcements, ${PROMOS.length} open`} onClick={() => setOpen((value) => !value)}>
      <Megaphone size={20}/><span className="ann-count" aria-hidden="true">{PROMOS.length}</span>
    </button>
    <div className="ann-panel" id="ann-panel">
      <div className="ann-panel-inner">
        <header className="ann-head"><h2>Announcements</h2></header>
        <ul className="ann-list">{PROMOS.map((promo) => <li key={promo.id} className="ann-item">
          <PromoLogo promo={promo}/>
          <div className="ann-body">
            <h3>{promo.short}</h3>
            <p>{promo.when ? `${promo.when} · ${promo.campus}` : promo.campus}</p>
          </div>
          <a className="ann-cta" data-no-pending aria-busy={busy === promo.id} href={promoHref(promo.id, pathname)} onClick={(event) => { event.preventDefault(); void followPromo(promo, pathname, 'navbar', (next) => { setOpen(false); setShown(next); }, (on) => setBusy(on ? promo.id : null)); }} aria-label={`${promo.name}: ${promo.cta}`}>
            {promo.chip}{busy === promo.id ? <LoaderCircle size={13} className="ann-spin"/> : <ArrowRight size={13} weight="bold"/>}
          </a>
        </li>)}</ul>
      </div>
    </div>
    <PromoDialog shown={shown} onClose={() => setShown(null)}/>
  </div>;
}
