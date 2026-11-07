'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Calendar, Check, Discord, MapPin, Users, X } from '@/components/icons';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { PromoAccess } from '@/app/api/promos/route';

export type Promo = {
  id: string;
  name: string;
  short: string;
  when?: string;
  kicker: string;
  pitch: string;
  facts: { icon: ReactNode; text: string }[];
  chip: string;
  cta: string;
  ctaIcon: ReactNode;
  /** The one campus allowed in; the server holds the real check (src/lib/promos.ts). */
  campus: string;
  /** Shown when a signed-in student from another campus tries to follow the promo. */
  denied: string;
  /** Shown when the promo has no outside link and the student is let through. */
  allowed?: string;
  logo: string;
};

/** Open campus promos, shown on the landing page and in the navbar announcements. Remove an entry once its event is over. */
export const PROMOS: Promo[] = [
  {
    id: 'robotics', name: '1337 Robotics Club', short: 'Robotics Club', kicker: 'Club · Khouribga',
    pitch: 'Workshops are coming this month. Only a few spots are available, so grab yours early.',
    facts: [{ icon: <Calendar size={15}/>, text: 'Workshops coming this month' }, { icon: <Users size={15}/>, text: 'Only a few spots available' }, { icon: <MapPin size={15}/>, text: '1337 Khouribga' }],
    chip: 'Join', cta: 'Join our Discord server', ctaIcon: <Discord size={16} weight="fill"/>, campus: 'Khouribga',
    denied: 'The 1337 Robotics Club is open to Khouribga students only, and your 42 profile shows another campus.',
    logo: '/assets/events/robotics-logo.webp',
  },
];

/** Every promo link goes through the server, which signs the student in, checks the campus, and returns them to `back`. */
export const promoHref = (id: string, back = '/') => `/api/promos/${id}${back === '/' ? '' : `?back=${encodeURIComponent(back)}`}`;

export function PromoLogo({ promo, big }: { promo: Promo; big?: boolean }) {
  return <span className={cn('landing-event-logo', big && 'is-big')}>
    <img src={promo.logo} alt="" width={big ? 56 : 36} height={big ? 56 : 36}/>
  </span>;
}

export type PromoResult = 'allowed' | 'denied' | 'error';
export type ShownResult = { promo: Promo; result: PromoResult } | null;
const RESULTS: string[] = ['allowed', 'denied', 'error'];

let access: Promise<PromoAccess | null> | null = null;
/** Loads, once per page, which promos the student may open. Called on hover so the click itself never waits. */
export function preloadPromoAccess() {
  access ??= fetch('/api/promos', { cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<PromoAccess> : null).catch(() => null);
  return access;
}

/**
 * Follows a promo without leaving the page when the outcome is known: opens the link in a new tab, or shows why not.
 * Signed-out visitors (and any failure) fall back to the server route, which signs them in first.
 */
export async function followPromo(promo: Promo, back: string, where: string, show: (shown: ShownResult) => void, busy?: (on: boolean) => void) {
  track('event-subscribe-click', { promo: promo.id, where });
  busy?.(true);
  const known = await preloadPromoAccess();
  const entry = known?.signedIn ? known.promos[promo.id] : undefined;
  // Signed out: the busy state stays on until the browser leaves for the 42 sign-in.
  if (!entry) { window.location.assign(promoHref(promo.id, back)); return; }
  busy?.(false);
  try { navigator.sendBeacon?.(`/api/promos/${promo.id}`); } catch { /* stats must never block the click */ }
  if (entry.outcome === 'allowed' && entry.href) {
    const tab = window.open(entry.href, '_blank');
    if (tab) tab.opener = null; else window.location.assign(entry.href);
    return;
  }
  show({ promo, result: entry.outcome });
}

/** Busy state for a promo button; cleared again when the browser restores this page from its back/forward cache. */
export function usePromoBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setBusy(null); };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  return [busy, setBusy] as const;
}

/** The outcome dialog, plus the one the server leaves in ?promo=<id>&result=<...> after a 42 sign-in (read once, then removed). */
export function usePromoResult() {
  const [shown, setShown] = useState<ShownResult>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const promo = PROMOS.find((entry) => entry.id === params.get('promo')), result = params.get('result');
    if (!promo || !result || !RESULTS.includes(result)) return;
    setShown({ promo, result: result as PromoResult });
    track('event-subscribe-result', { promo: promo.id, result });
    params.delete('promo'); params.delete('result');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, []);
  return [shown, setShown] as const;
}

export function PromoDialog({ shown, onClose }: { shown: ShownResult; onClose: () => void }) {
  if (!shown) return null;
  const { promo, result } = shown;
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="sv-overlay"/>
      <Dialog.Content className="sv-dialog" aria-describedby="promo-result-lead">
        <Dialog.Close className="sv-close" aria-label="Close"><X size={16}/></Dialog.Close>
        {result === 'allowed' ? <span className="sv-icon is-done" aria-hidden="true"><Check size={22}/></span> : <span className="ev-ask-logo"><PromoLogo promo={promo} big/></span>}
        <Dialog.Title className="sv-title">{result === 'allowed' ? "You're in" : result === 'error' ? 'We could not check your campus' : `${promo.campus} students only`}</Dialog.Title>
        <p className="sv-lead" id="promo-result-lead">{result === 'allowed' ? promo.allowed : result === 'error' ? '42 Intra did not answer in time. Please try again in a minute.' : promo.denied}</p>
        <div className="sv-actions">
          {result === 'error' && <a className="sv-secondary" href={promoHref(promo.id, window.location.pathname)}>Try again</a>}
          <Dialog.Close className="sv-primary">Close</Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
