import Link from 'next/link';
export function DatasetState({ status }: { status: 'incomplete' | 'rate-limited' | 'unavailable' }) {
  const details = { incomplete: ['Ranking data is incomplete', 'The 42 API did not return the full campus population. No global ranks are shown until a complete refresh succeeds.'], 'rate-limited': ['42 API limit reached', 'The ranking refresh is paused by the application request limit. Please return later.'], unavailable: ['Rankings are temporarily unavailable', 'The 42 API could not provide a complete result. Please try again shortly.'] }[status];
  return <main className="shell empty"><h1>{details[0]}</h1><p className="muted">{details[1]}</p><Link className="btn btn-subtle" href="/">Back home</Link></main>;
}
