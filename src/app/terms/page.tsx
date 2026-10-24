import Link from 'next/link';
import { CONTACT, LegalPage } from '@/components/legal-page';

export const metadata = { title: 'Terms of Use', description: 'The rules for using Elite 1337.' };

export default function Terms() {
  return <LegalPage
    title="Terms of Use"
    other={{ href: '/privacy', label: 'Privacy Policy' }}
    intro={<p>By using Elite 1337 you agree to these terms. They are short, and written to be read.</p>}
    sections={[
      { id: 'about', title: 'About Elite 1337', body: <>
        <p>Elite 1337 is a free, independent community project made by 1337 students. It is <strong>not affiliated with, endorsed by or run by 42, 1337 or UM6P</strong>. &quot;42&quot; and &quot;1337&quot; are their owners&apos; names and are used here only to describe what the site is about.</p>
      </> },
      { id: 'access', title: 'Who can use it', body: <>
        <p>You need a 42 Intra account to sign in. Use your own account only, and follow 42&apos;s rules and your campus rules while using the site.</p>
      </> },
      { id: 'accuracy', title: 'Rankings and stats', body: <>
        <p>Everything shown is calculated from 42 API data. The 42 API can be late, incomplete or briefly unavailable, so the numbers may differ from Intra. Logtime, return rates, streaks and races are <strong>estimates for fun and motivation</strong>, not official figures.</p>
        <p>Do not rely on them for exams, evaluations, blackhole planning or anything official. Always check 42 Intra.</p>
      </> },
      { id: 'respect', title: 'Be respectful', body: <>
        <p>The site shows other students&apos; public progress. Do not use it to harass, shame or target anyone, for example about failed attempts, blackholes or strict evaluations.</p>
        <p>Do not scrape the site, overload it, try to get around sign-in or reach data that is not shown to you. Do not upload avatars you have no right to use, or that are offensive or misleading.</p>
        <p>We may remove content or block access to protect students or the site.</p>
      </> },
      { id: 'offers', title: 'Offers and support', body: <>
        <p>The Offers page links to third-party student deals (GitHub, Google, Microsoft, JetBrains and others). Their terms, prices and eligibility are set by those companies and can change at any time. Check them on their sites.</p>
        <p>The Canva offer is arranged directly with the team over WhatsApp. It is a separate agreement between you and us, not with Canva.</p>
        <p>Ko-fi donations are optional gifts and do not unlock anything.</p>
      </> },
      { id: 'survey', title: 'Polls and survey', body: <p>The cat poll and the career survey are optional. Answer honestly or not at all. Survey results may be shared as anonymous, overall numbers.</p> },
      { id: 'warranty', title: 'No guarantee', body: <>
        <p>The site is provided as it is, for free, without any guarantee that it will always be available, correct or error-free. As far as the law allows, the team is not responsible for decisions made or losses suffered because of the site.</p>
      </> },
      { id: 'changes', title: 'Changes and contact', body: <>
        <p>We may update these terms. The date at the top shows the latest version, and continuing to use the site means you accept it.</p>
        <p>Questions, removal requests or problems: send {CONTACT}. See also the <Link href="/privacy">Privacy Policy</Link>.</p>
      </> },
    ]}
  />;
}
