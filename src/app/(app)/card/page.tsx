import { getCardSharing } from '@/lib/card-sharing';
import { updateCardSharing } from './sharing-actions';
import { KiwiNote } from '@/components/kiwi-guide';
import { CardPicture } from '@/components/card-picture';
import { getCardArt } from '@/lib/card-art-store';
import { cardPath } from '@/lib/card-token';
import { requireStudent } from '@/lib/guard';
import { siteUrl } from '@/lib/site';

export const metadata = { title: 'Rank card', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The student's own rank card: pick its picture and copy the snippet for a GitHub README. The signed link is built per student and never stored. */
export default async function CardPage({ searchParams }: { searchParams: Promise<{ sharing?: string }> }) {
  const user = await requireStudent();
  const result = (await searchParams).sharing;
  const sharing = await getCardSharing(Number(user.id)).catch(() => null);
  const path = sharing ? cardPath(Number(user.id), sharing.version) : null;
  if (!path) return <main className="shell cd"><KiwiNote><h2>Rank card unavailable</h2><p>Try again in a minute.</p></KiwiNote></main>;
  const art = await getCardArt(Number(user.id));
  return <main className="shell pl pc cd">
    <section className="xp-panel"><h1>Card sharing</h1>
      <p>{sharing?.enabled ? 'Sharing is enabled.' : 'Sharing is disabled.'} Regenerating invalidates your previous link. Images already cached by other sites may remain temporarily.</p>
      {result && <p role="status">{result === 'saved' ? 'Sharing updated.' : 'Could not update sharing. Try again.'}</p>}
      <form action={updateCardSharing}><button className="pl-chip" name="action" value="regenerate">{sharing?.enabled ? 'Regenerate link' : 'Enable sharing'}</button>{sharing?.enabled && <button className="pl-chip" name="action" value="disable">Disable sharing</button>}</form>
    </section>
    {sharing?.enabled && <CardPicture path={path} current={art ? { source: art.source } : null} origin={siteUrl.origin}/> }
  </main>;
}
