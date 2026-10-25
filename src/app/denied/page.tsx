export const metadata = { title: 'Sign-in Help', robots: { index: false, follow: false } };

import Image from 'next/image';
import Link from 'next/link';
import { Nav } from '@/components/nav';

/** A failed 42 sign-in almost always means the app's 42 API budget for the hour is spent. */
export default async function Denied({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><Nav/><main className="shell dn">
    <Image className="dn-cat" src="/assets/cats/kiwi-mascot.webp" alt="Kiwi the cat, napping" width={160} height={160} priority/>
    <h1>42 Intra is busy right now</h1>
    <p>We hit the 1,200 requests per hour cap of the 42 API. Kiwi is taking a nap until it resets. Please come back after this hour ends.</p>
    <Link className="dn-home" href="/">Back home</Link>
    {error && <small>Error code: {error.slice(0, 40)}</small>}
  </main></>;
}
