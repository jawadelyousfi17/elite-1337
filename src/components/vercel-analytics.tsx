'use client';

import { Analytics } from '@vercel/analytics/next';

/** Vercel Web Analytics; query strings are dropped like Umami's data-exclude-search, so search text never leaves the page. */
export function VercelAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split('?')[0] })}/>;
}
