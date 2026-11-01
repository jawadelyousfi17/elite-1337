/** 42 campus ids of the 1337 campuses a promo can be limited to. */
export const CAMPUS = { khouribga: 16, benguerir: 21 } as const;

/** `href: null` is a test promo: allowed students come back with a "you're in" dialog instead of leaving. */
type PromoTarget = { href: string | null; campus: number };

/**
 * Landing promos and the one campus each is open to. Links live here, on the server, so they never reach the page.
 */
export const PROMO_TARGETS: Record<string, PromoTarget> = {
  robotics: { href: 'https://discord.gg/n4B2PrXmX', campus: CAMPUS.khouribga },
  'cp0-ctf': { href: 'https://cp-zero.site/register', campus: CAMPUS.khouribga },
};

export type PromoOutcome = 'allowed' | 'denied' | 'error';

/** A student may follow a promo when any of their 42 campus memberships is its campus, so transfers still get in. */
export function promoOutcome(campusUsers: { campus_id: number }[] | null, campus: number): PromoOutcome {
  if (!campusUsers) return 'error';
  return campusUsers.some((entry) => entry.campus_id === campus) ? 'allowed' : 'denied';
}

/** Where to send the student back to: a path on this site only (no other host, no query), else the landing page. */
export function safeBack(value: string | null | undefined) {
  if (!value || value.length > 120 || !/^\/[a-z0-9\-/]*$/i.test(value) || value.startsWith('//')) return '/';
  return value;
}
