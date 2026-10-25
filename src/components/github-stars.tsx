import { GitHub, Star } from '@/components/icons';
import { REPO_URL, repoStars } from '@/lib/github';
import { cn } from '@/lib/utils';

const compact = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value);

export async function GitHubStars({ variant }: { variant: 'nav' | 'landing' }) {
  const stars = await repoStars();
  const label = stars === null ? 'Star Elite 1337 on GitHub' : `Star Elite 1337 on GitHub, ${stars} stars`;
  return <a className={cn('gh-stars', `is-${variant}`)} href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={label} data-umami-event="github-click" data-umami-event-where={variant}>
    <GitHub size={variant === 'nav' ? 20 : 18}/>
    {variant === 'landing' && <span className="gh-stars-label">Star us on GitHub</span>}
    {stars === null ? <Star size={15} weight="fill" className="gh-stars-icon"/> : <span className="gh-stars-count"><Star size={13} weight="fill"/>{compact(stars)}</span>}
    {variant === 'nav' && <span className="gh-tip" aria-hidden="true">We are public!</span>}
  </a>;
}
