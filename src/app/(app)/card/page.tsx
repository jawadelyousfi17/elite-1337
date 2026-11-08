import { CopyField } from '@/components/copy-field';
import { KiwiNote } from '@/components/kiwi-guide';
import { cardPath } from '@/lib/card-token';
import { requireStudent } from '@/lib/guard';
import { siteUrl } from '@/lib/site';

export const metadata = { title: 'Rank card', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The student's own rank card and the snippets to put it in a GitHub profile README. The signed link is built here, per student, and never stored. */
export default async function CardPage() {
  const user = await requireStudent();
  const path = cardPath(Number(user.id));
  if (!path) return <main className="shell cd"><KiwiNote><h2>Rank card unavailable</h2><p>Try again in a minute.</p></KiwiNote></main>;
  const url = new URL(path, siteUrl).href;
  const markdown = `[![Elite 1337 rank](${url})](${siteUrl.origin})`;
  const html = `<a href="${siteUrl.origin}"><img src="${url}" alt="Elite 1337 rank" width="840"></a>`;
  return <main className="shell cd">
    <header className="cd-head"><h1>Rank card</h1><p>Show your rank on your GitHub profile. It updates by itself, about once an hour.</p></header>
    <section className="cd-preview" aria-label="Preview"><img src={path} alt="Your rank card" width={840} height={340}/></section>
    <section className="cd-steps">
      <h2>Add it to your GitHub profile</h2>
      <ol>
        <li>Create a repository named exactly like your GitHub username (for example <code>my-username/my-username</code>).</li>
        <li>Open its <code>README.md</code> and paste one of the snippets below.</li>
        <li>Commit. The card shows on your profile, in light or dark to match each visitor&apos;s theme.</li>
      </ol>
      <CopyField label="Markdown" value={markdown}/>
      <CopyField label="HTML" value={html}/>
      <p className="cd-note">Anyone with this link can see your card (login, level and ranks), nothing else. Don&apos;t post it if you&apos;d rather keep your rank private.</p>
    </section>
  </main>;
}
