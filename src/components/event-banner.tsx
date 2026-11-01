'use client';

import type { MouseEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { ArrowRight } from '@/components/icons';
import { PROMOS, PromoDialog, PromoLogo, followPromo, preloadPromoAccess, promoHref, usePromoBusy, usePromoResult, type Promo, type ShownResult } from '@/components/promo-shared';

/** One campus promo: a pill that opens a full card on hover. */
function PromoPill({ promo, show, busy, setBusy }: { promo: Promo; show: (shown: ShownResult) => void; busy: boolean; setBusy: (id: string | null) => void }) {
  const href = promoHref(promo.id);
  const go = (where: string) => (event: MouseEvent) => { event.preventDefault(); if (!busy) void followPromo(promo, '/', where, show, (on) => setBusy(on ? promo.id : null)); };
  const spinner = <LoaderCircle size={14} className="ann-spin" aria-hidden="true"/>;
  return <div className="landing-event" onPointerEnter={() => void preloadPromoAccess()} onFocus={() => void preloadPromoAccess()}>
    <a className="landing-event-pill" data-no-pending aria-busy={busy} href={href} onClick={go('pill')} aria-label={`${promo.name}. ${promo.cta}`}>
      <PromoLogo promo={promo}/>
      <span className="landing-event-label">{promo.short}{promo.when && <span className="landing-event-when"> · {promo.when}</span>}</span>
      <span className="landing-event-chip">{promo.chip}{busy ? spinner : <ArrowRight size={14} weight="bold"/>}</span>
    </a>
    <div className="landing-event-card">
      <div className="landing-event-card-inner">
        <div className="landing-event-head">
          <PromoLogo promo={promo} big/>
          <div>
            <p className="landing-event-kicker">{promo.kicker}</p>
            <h2>{promo.name}</h2>
          </div>
        </div>
        <p className="landing-event-pitch">{promo.pitch}</p>
        <ul className="landing-event-facts">{promo.facts.map(fact => <li key={fact.text}>{fact.icon}{fact.text}</li>)}</ul>
        <a className="landing-event-cta" data-no-pending aria-busy={busy} href={href} onClick={go('card')}>
          {promo.cta}<span className="landing-event-cta-icon">{busy ? <LoaderCircle size={16} className="ann-spin" aria-hidden="true"/> : promo.ctaIcon}</span>
        </a>
      </div>
    </div>
  </div>;
}

/** Campus promos for the landing top bar. */
export function EventBanner() {
  const [shown, setShown] = usePromoResult();
  const [busy, setBusy] = usePromoBusy();
  return <div className="landing-events">
    {PROMOS.map(promo => <PromoPill key={promo.id} promo={promo} show={setShown} busy={busy === promo.id} setBusy={setBusy}/>)}
    <PromoDialog shown={shown} onClose={() => setShown(null)}/>
  </div>;
}
