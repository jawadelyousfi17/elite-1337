import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { AccessPlatformButton } from '@/components/access-platform-button';
import { Credits } from '@/components/credits';
import { LegalLinks } from '@/components/legal-page';
import { GitHubStars } from '@/components/github-stars';
import { REPO_URL } from '@/lib/github';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${siteUrl.origin}/#website`, url: siteUrl.href, name: siteName, alternateName: ['Elite1337', 'Elite 1337 rankings'], description: siteDescription, inLanguage: 'en' },
    { '@type': 'Organization', '@id': `${siteUrl.origin}/#organization`, name: siteName, url: siteUrl.href, logo: new URL('/assets/horse-emblem.webp', siteUrl).href, sameAs: [REPO_URL] },
  ],
};

export const metadata = { alternates: { canonical: '/' } };

export default async function Home() {
  return <main className="landing">
    <div className="landing-top-bar"><LegalLinks/><GitHubStars variant="landing"/></div>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-visual" aria-hidden="true">
        <span className="landing-glow"/>
        <img src="/assets/spy.webp" alt="" width={1400} height={893} fetchPriority="high"/>
      </div>
      <img className="landing-emblem" src="/assets/horse-emblem-mono.webp" alt="Elite 1337" width={309} height={480}/>
      <h1 id="landing-title">See where you stand at 1337.</h1>
      <form action={async () => {
        'use server';
        const session = await auth();
        if (session?.user?.id) redirect('/leaderboard');
        await signIn('42', { redirectTo: '/leaderboard' });
      }}>
        <AccessPlatformButton/>
      </form>
    </section>

    <footer className="landing-credits">
      <Credits/>
    </footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}/>
  </main>;
}
