import { ShieldCheck } from '@/components/icons';

/** Shown next to the login of students who reported a verified vulnerability. */
export function HackerBadge() {
  return <span className="hk-badge" title="Found a vulnerability in Elite 1337"><ShieldCheck size={12} weight="bold"/>HACKER</span>;
}
