import { redirect } from 'next/navigation';

/** The GitHub card moved to its own site. */
const GITHUB_CARD_URL = 'https://github-card.elite-1337.app/';
export const metadata = { title: 'GitHub card', robots: { index: false } };

export default function GithubCardPage() {
  redirect(GITHUB_CARD_URL);
}
