'use client';

import { LogoPuzzle } from '@/components/logo-puzzle';
import { PromoDialog, usePromoResult } from '@/components/promo-shared';

/** The landing top bar: the Wedesign challenge puzzle, plus the result dialog for students coming back from a campus promo. */
export function EventBanner() {
  const [shown, setShown] = usePromoResult();
  return <div className="landing-events">
    <LogoPuzzle/>
    <PromoDialog shown={shown} onClose={() => setShown(null)}/>
  </div>;
}
