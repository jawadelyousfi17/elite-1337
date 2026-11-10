import Link from 'next/link';
import { GithubCardMaker } from '@/components/github-card-maker';
import { LegalLinks } from '@/components/legal-page';
import { siteUrl } from '@/lib/site';

export const metadata = { title: 'GitHub card', description: 'Make a card for your GitHub profile README from your username. No sign-in.' };

/** Public on purpose (no sign-in): anyone can make a card from a GitHub username. */
export default function GithubCardPage() {
  return <>
    <header className="shell gh-top"><Link href="/" className="gh-home">Elite 1337</Link></header>
    <main className="shell pl pc cd"><GithubCardMaker origin={siteUrl.origin}/></main>
    <footer className="footer"><div className="shell"><LegalLinks/></div></footer>
  </>;
}
