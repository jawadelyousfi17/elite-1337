import { KiwiNote } from '@/components/kiwi-guide';
import { CardPicture } from '@/components/card-picture';
import { getCardArt } from '@/lib/card-art-store';
import { cardPath } from '@/lib/card-token';
import { requireStudent } from '@/lib/guard';
import { siteUrl } from '@/lib/site';

export const metadata = { title: 'Rank card', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The student's own rank card: pick its picture and copy the snippet for a GitHub README. The signed link is built per student and never stored. */
export default async function CardPage() {
  const user = await requireStudent();
  const path = cardPath(Number(user.id));
  if (!path) return <main className="shell cd"><KiwiNote><h2>Rank card unavailable</h2><p>Try again in a minute.</p></KiwiNote></main>;
  const art = await getCardArt(Number(user.id));
  return <main className="shell pl pc cd">
    <CardPicture path={path} current={art ? { source: art.source } : null} origin={siteUrl.origin}/>
  </main>;
}
