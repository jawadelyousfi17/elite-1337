export const metadata = { title: 'Sign-in Help', robots: { index: false, follow: false } };

import Link from 'next/link';
import { Nav } from '@/components/nav';
export default async function Denied({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configuration = error === 'Configuration';
  return <><Nav/><main className="shell empty"><h1>Sign-in could not be completed</h1><p className="muted">{configuration ? 'The site encountered an OAuth configuration error. Check the 42 credentials in Vercel and the callback request in Vercel Logs.' : 'Please try signing in with your 42 Intra account again.'}</p>{configuration && <p className="muted">Error code: Configuration</p>}<Link className="btn" href="/">Back home</Link></main></>;
}
