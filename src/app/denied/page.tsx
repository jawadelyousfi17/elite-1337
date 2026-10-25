export const metadata = { title: 'Sign-in Help', robots: { index: false, follow: false } };

import Link from 'next/link';
import { Nav } from '@/components/nav';

/** A failed 42 sign-in almost always means the app's 42 API budget for the hour is spent. */
export default async function Denied({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><Nav/><main className="shell empty">
    <h1>42 Intra is busy right now</h1>
    <p className="muted">We hit the 1,200 requests per hour cap of the 42 API. Please come back after this hour ends.</p>
    {error && <p className="muted">Error code: {error.slice(0, 40)}</p>}
    <Link className="btn" href="/">Back home</Link>
  </main></>;
}
