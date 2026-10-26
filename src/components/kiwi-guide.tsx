import { cn } from '@/lib/utils';

/** Kiwi inside empty and loading states. */
export function KiwiNote({ children, mood = 'idle' }: { children: React.ReactNode; mood?: 'idle' | 'busy' }) {
  return <div className={cn('kiwi-note', mood === 'busy' && 'is-busy')}>
    <img src="/assets/cats/kiwi-mascot.webp" alt="" width={96} height={96}/>
    <div>{children}</div>
  </div>;
}

/** Loading card on top of a page's skeleton: a progress bar and Kiwi at work. */
export function KiwiLoader({ title, note }: { title: string; note?: string }) {
  return <div className="pc-loader" role="status" aria-live="polite">
    <div className="pc-loader-bar"><span/></div>
    <KiwiNote mood="busy"><strong>{title}</strong>{note && <span>{note}</span>}</KiwiNote>
  </div>;
}
