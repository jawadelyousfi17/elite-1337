export const metadata = { title: 'Removed from Elite 1337', robots: { index: false, follow: false } };

import Image from 'next/image';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { CONTACT_DISCORD, CONTACT_EMAIL } from '@/lib/site';

/** Where students who asked to be removed land when they try to sign in again; they can ask the admin to come back. */
export default function Removed() {
  return <><Nav/><main className="shell dn">
    <Image className="dn-art" src="/assets/hide-me/goodbye.webp" alt="" width={160} height={160} priority/>
    <h1>You asked to be removed from this app</h1>
    <p>Your profile was removed from Elite 1337, so you can&apos;t sign in anymore. Want to join again? Contact me: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or Discord <b>{CONTACT_DISCORD}</b>.</p>
    <Link className="dn-home" href="/">Back home</Link>
  </main></>;
}
