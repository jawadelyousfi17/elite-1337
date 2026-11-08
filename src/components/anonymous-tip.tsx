import { Avatar } from '@/components/avatar';
import { Ghost } from '@/components/icons';

export const ANONYMOUS_NOTE = 'This student asked to be removed from Elite 1337, so only their place in the ranking is shown.';

/** Avatar stand-in for a removed student: a ghost instead of initials. */
export function AnonymousAvatar({ size }: { size: number }) {
  return <Avatar login="Anonymous student" src={null} size={size} icon={<Ghost size={Math.round(size * 0.5)} weight="bold"/>}/>;
}

/** A label that explains itself on hover, focus or tap, so nobody wonders who "Anonymous" is. */
export function AnonymousTip({ children = 'Anonymous student' }: { children?: React.ReactNode }) {
  return <span className="pl-anon-tip" tabIndex={0} role="note" data-tip={ANONYMOUS_NOTE} aria-label={`${children}. ${ANONYMOUS_NOTE}`}>{children}</span>;
}
