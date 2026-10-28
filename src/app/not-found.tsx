import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import { Nav } from '@/components/nav';

export const metadata = { title: 'Page not found', robots: { index: false, follow: false } };

/** The 404 for the whole site, with the navigation when the visitor is signed in. */
export default async function NotFound() {
  const session = await auth();
  const signedIn = !!session?.user?.id;
  return <><Nav loggedIn={signedIn}/><main className="shell dn">
    <Image className="dn-art" src="/assets/cats/kiwi-mascot.webp" alt="" width={160} height={160} priority/>
    <p className="dn-code">404</p>
    <h1>Kiwi can&apos;t find this page</h1>
    <p>It may have moved, or the link is wrong. Let&apos;s get you back on track.</p>
    <Link className="dn-home" href={signedIn ? '/leaderboard' : '/'}>{signedIn ? 'Back to the ranks' : 'Back home'}</Link>
  </main></>;
}
