import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { AccessPlatformButton } from '@/components/access-platform-button';
import { Credits } from '@/components/credits';
import { LegalLinks } from '@/components/legal-page';
import { GitHubStars } from '@/components/github-stars';
import { LandingSupport } from '@/components/landing-support';

export const metadata = { alternates: { canonical: '/' } };

export default async function Home() {
  return <main className="landing">
    <div className="landing-top-bar"><LegalLinks/><GitHubStars variant="landing"/></div>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-visual" aria-hidden="true">
        <span className="landing-glow"/>
        <img src="/assets/spy.webp" alt="" width={1400} height={893} fetchPriority="high"/>
      </div>
      <img className="landing-emblem" src="/assets/horse-emblem.webp" alt="Elite 1337" width={306} height={480}/>
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

    <footer className="landing-credits"><LandingSupport/><Credits/></footer>
  </main>;
}
