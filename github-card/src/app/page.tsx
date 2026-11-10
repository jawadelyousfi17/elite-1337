import { CardMaker } from '@/components/card-maker';

/** The whole site: type a GitHub username, fill in what you like, copy the snippet. */
export default function Home() {
  return <main className="gc-shell"><CardMaker siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ''}/></main>;
}
