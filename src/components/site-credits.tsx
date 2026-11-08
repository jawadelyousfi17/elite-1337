import { Credits } from '@/components/credits';
import { loadContributors } from '@/lib/contributors';

/** The footer credits with the repository's contributors, loaded on the server so the page never waits on GitHub for long. */
export async function SiteCredits({ className }: { className?: string }) {
  return <Credits className={className} contributors={await loadContributors()}/>;
}
