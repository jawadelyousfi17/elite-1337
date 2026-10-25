import { CONTACT, LegalPage } from '@/components/legal-page';

export const metadata = { title: 'Privacy Policy', description: 'What Elite 1337 reads, keeps and shares, and how to ask for removal.' };

export default function Privacy() {
  return <LegalPage
    title="Privacy Policy"
    other={{ href: '/terms', label: 'Terms of Use' }}
    intro={<p>Elite 1337 is an independent student project. It is not run by 42 or 1337. We keep as little as we can: there is no database of rankings, no ads and no selling of data. This page explains exactly what the site reads and keeps.</p>}
    sections={[
      { id: 'sign-in', title: 'Signing in', body: <>
        <p>You sign in with your 42 Intra account through 42&apos;s official login (OAuth), with the <strong>public</strong> scope only. We never see your 42 password.</p>
        <p>After sign-in, your browser keeps one encrypted session cookie with your 42 user id and login. It lasts up to 7 days, or until you log out. It is needed for the site to work and is not used for tracking.</p>
      </> },
      { id: 'data', title: 'Data we read from 42', body: <>
        <p>To build the pages, our server reads public 42 Intra data through the 42 API: logins, names, campus, levels, profile photos, Common Core projects and attempts, evaluations, blackhole dates and workstation sessions.</p>
        <p>This data is cached on the server for between a few minutes and a few hours, then fetched again. It is not stored in a database.</p>
        <ul>
          <li><strong>Visible to every signed-in student:</strong> the leaderboard, stats, corrections and each student&apos;s Common Core race, the same kind of information already visible on 42 Intra.</li>
          <li><strong>Visible only to you:</strong> your logtime stats on My race (hours, streaks, seats, schedule). Other students cannot open them.</li>
        </ul>
      </> },
      { id: 'stored', title: 'What we store', body: <>
        <ul>
          <li><strong>Uploaded avatar</strong> (optional): if you upload one, a cropped 256×256 WebP is kept in private storage (Supabase), linked to your 42 user id. Removing it deletes it.</li>
          <li><strong>Cat poll vote</strong> (optional): your 42 user id and the cat you picked, so you can change your vote.</li>
        </ul>
        <p>Nothing else is stored about you on our side.</p>
      </> },
      { id: 'survey', title: 'Career survey', body: <>
        <p>The career survey is optional. Only the answers you pick (work status, salary range, place, sector, satisfaction) are sent, through Web3Forms, as an email to the team. They are sent <strong>without your login, name or 42 id</strong> and are used only for anonymous, overall statistics.</p>
      </> },
      { id: 'feedback', title: 'Bug reports and feedback', body: <>
        <p>When you send feedback, your message, its type (bug, idea or other), the page you were on and your screen size are sent through Web3Forms as an email to the team. Your login is added <strong>only if you tick the box</strong>, so we can reply on 42 Intra. Please do not put passwords or private information in the message.</p>
      </> },
      { id: 'device', title: 'Stored on your device', body: <>
        <p>Your browser keeps a few small settings in local storage: theme, race sound on or off, whether you closed the survey, and your poll choice. They never leave your device, and clearing your browser data removes them.</p>
      </> },
      { id: 'analytics', title: 'Analytics', body: <>
        <p>We use Umami Cloud to count visits and a few clicks (sign-in and GitHub). Umami uses no cookies and keeps no personal profiles. We never send logins, names or search text to it. Search and filter values in the address bar are ignored.</p>
      </> },
      { id: 'others', title: 'Services we rely on', body: <>
        <ul>
          <li><strong>42 Intra</strong>: sign-in and all student data.</li>
          <li><strong>Vercel</strong>: hosting. Like any web host, it keeps short technical logs, such as IP addresses and errors.</li>
          <li><strong>Supabase</strong>: avatar and vote storage.</li>
          <li><strong>Web3Forms</strong>: delivery of survey answers and feedback.</li>
          <li><strong>Umami Cloud</strong>: visit counts.</li>
        </ul>
        <p>Links to student offers, GitHub and 42 Intra take you to those sites, which have their own privacy policies.</p>
      </> },
      { id: 'rights', title: 'Your choices', body: <>
        <p>You can remove your avatar and change your vote at any time. You can also ask us to <strong>hide you from the leaderboard and stats</strong>, or ask what we hold about you. Send {CONTACT}. We will answer as soon as we can, usually within a few days.</p>
        <p>In Morocco, personal data is protected by Law 09-08, and you can also contact the CNDP.</p>
      </> },
      { id: 'changes', title: 'Changes', body: <p>If this policy changes, the date at the top changes too. Important changes will be announced on the site.</p> },
    ]}
  />;
}
