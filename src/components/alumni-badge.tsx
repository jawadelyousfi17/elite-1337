import { Students } from '@/components/icons';

/** Shown next to the login of students the 42 API marks as alumni. */
export function AlumniBadge() {
  return <span className="al-badge" title="42 alumni"><Students size={12} weight="bold"/>ALUMNI</span>;
}
