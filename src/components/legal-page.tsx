import type { ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { Nav } from '@/components/nav';
import { Credits } from '@/components/credits';
import { CONTACT_DISCORD, CONTACT_EMAIL } from '@/lib/site';

/** Last real change to either legal page; bump it with every edit. */
export const LEGAL_UPDATED = 'October 25, 2026';

export const CONTACT = <>a message on 42 Intra to <a href="https://profile.intra.42.fr/users/jel-yous" target="_blank" rel="noopener noreferrer">jel-yous</a> or <a href="https://profile.intra.42.fr/users/yikoubaz" target="_blank" rel="noopener noreferrer">yikoubaz</a>, an email to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or a Discord message to <strong>{CONTACT_DISCORD}</strong></>;

export async function LegalPage({ title, intro, sections, other }: { title: string; intro: ReactNode; sections: { id: string; title: string; body: ReactNode }[]; other: { href: string; label: string } }) {
  // Signed-in visitors keep their navigation and theme; everyone else gets the public header.
  const session = await auth();
  return <>
    <Nav loggedIn={!!session?.user}/>
    <main className="shell legal">
      <header className="legal-head">
        <p className="legal-kicker">Elite 1337 · Updated {LEGAL_UPDATED}</p>
        <h1>{title}</h1>
        <div className="legal-intro">{intro}</div>
      </header>
      <div className="legal-layout">
        <nav className="legal-toc" aria-label="On this page">
          <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
          <Link href={other.href} className="legal-other">{other.label} →</Link>
        </nav>
        <div className="legal-body">
          {sections.map((section) => <section key={section.id} id={section.id}><h2>{section.title}</h2>{section.body}</section>)}
        </div>
      </div>
    </main>
    <footer className="footer"><div className="shell"><Credits/><LegalLinks/></div></footer>
  </>;
}

/** Small links under the credits, on the landing page and inside the app. */
export function LegalLinks() {
  return <nav className="legal-links" aria-label="Legal"><Link href="/privacy">Privacy</Link><span aria-hidden="true">·</span><Link href="/terms">Terms</Link></nav>;
}
