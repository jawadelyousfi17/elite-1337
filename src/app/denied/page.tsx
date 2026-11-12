export const metadata = { title: 'Sign-in Help', robots: { index: false, follow: false } };

import Image from 'next/image';
import Link from 'next/link';
import { Nav } from '@/components/nav';

/** A failed 42 sign-in almost always means the app's 42 API budget for the hour is spent. */
export default async function Denied({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
  const { error, reason } = await searchParams, blocked = reason === 'blocked';
  return <><Nav/><main className="shell dn">
    <Image className="dn-cap-cat" src="/assets/cats/kiwi-cap-reached.png" alt="Kiwi holding a flag that says 1,200 cap reached" width={1254} height={1254} sizes="(max-width: 400px) 72vw, 280px" priority/>
    <h1>{blocked ? 'Access unavailable' : '42 Intra is busy right now'}</h1>
    <p>{blocked ? 'Your account does not currently have access to Elite 1337. Contact an administrator if you think this is a mistake.' : 'We hit the 1,200 requests per hour cap of the 42 API. Kiwi is taking a nap until it resets. Please come back after this hour ends.'}</p>
    <Link className="dn-home" href="/">Back home</Link>
    {error && <small>Error code: {error.slice(0, 40)}</small>}
  </main></>;
}
