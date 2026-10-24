'use client';

import { useEffect, useRef, useState, useTransition, type PointerEvent } from 'react';
import { Popover } from 'radix-ui';
import { CATS, type CatId, type CatTally } from '@/lib/cat-votes';
import { cn } from '@/lib/utils';
import { voteForCat } from './cat-actions';

const LOCAL_KEY = 'elite-best-cat';
type Shared = { tally: CatTally; mine: CatId | null } | null;

/** Vote state: shared through the server when storage is on, otherwise remembered in this browser. */
function useCatPoll(shared: Shared, canVote: boolean) {
  const [mine, setMine] = useState<CatId | null>(shared?.mine ?? null);
  const [tally, setTally] = useState(shared?.tally ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (shared) return;
    try { const saved = localStorage.getItem(LOCAL_KEY); if (CATS.some((cat) => cat.id === saved)) setMine(saved as CatId); } catch { /* storage unavailable */ }
  }, [shared]);

  function vote(cat: CatId) {
    if (cat === mine || pending || (shared && !canVote)) return;
    const previous = mine;
    setMine(cat);
    if (!shared) { try { localStorage.setItem(LOCAL_KEY, cat); } catch { /* ignore */ } return; }
    // Move the vote right away; the server confirms and the page refreshes with everyone's numbers.
    setTally((current) => current && { total: current.total + (previous ? 0 : 1), counts: { ...current.counts, [cat]: current.counts[cat] + 1, ...(previous ? { [previous]: current.counts[previous] - 1 } : {}) } });
    startTransition(async () => { if (!(await voteForCat(cat))) { setMine(previous); setTally(shared.tally); } });
  }
  return { mine, tally, pending, vote, locked: !!shared && !canVote };
}

function CatGrid({ poll }: { poll: ReturnType<typeof useCatPoll> }) {
  const { mine, tally, pending, vote, locked } = poll;
  const leader = tally && tally.total ? CATS.reduce((best, cat) => tally.counts[cat.id] > tally.counts[best.id] ? cat : best, CATS[0]) : null;
  return <div className="st-cats-grid" role="radiogroup" aria-label="Vote for the best cat">
    {CATS.map((cat) => {
      const share = tally && tally.total ? Math.round(tally.counts[cat.id] / tally.total * 100) : null;
      return <button key={cat.id} type="button" role="radio" aria-checked={mine === cat.id} className={cn('st-cat', mine === cat.id && 'is-mine', leader?.id === cat.id && 'is-leader')} onClick={() => vote(cat.id)} disabled={pending || locked} title={locked ? 'Sign in to vote' : undefined}>
        <img src={`/assets/cats/${cat.id}.webp`} alt="" width={120} height={120} loading="lazy"/>
        <span className="st-cat-name">{cat.name}</span>
        {(mine || locked) && share !== null ? <span className="st-cat-share">{share}%</span> : mine === cat.id ? <span className="st-cat-share">Your vote</span> : null}
      </button>;
    })}
  </div>;
}

/** "Best cat?" card for the Stats page. */
export function CatVote({ shared }: { shared: Shared }) {
  const poll = useCatPoll(shared, true);
  return <section className="st-card st-cats" aria-labelledby="st-cats">
    <header><h2 id="st-cats">Best cat?</h2>{poll.tally && <span className="st-note-chip">{poll.tally.total.toLocaleString('en-US')} {poll.tally.total === 1 ? 'vote' : 'votes'}</span>}</header>
    <CatGrid poll={poll}/>
  </section>;
}

/** Floating cat for the landing page; hovering (or tapping) pops up the same vote. */
export function CatBubble({ shared, signedIn }: { shared: Shared; signedIn: boolean }) {
  const poll = useCatPoll(shared, signedIn);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpened = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  useEffect(() => clear, []);
  const hover = (next: boolean) => (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clear();
    if (open && !hoverOpened.current) return;
    timer.current = setTimeout(() => { if (next && !open) hoverOpened.current = true; setOpen(next); }, next ? 120 : 260);
  };
  const face = poll.mine ?? 'kiwi';
  return <Popover.Root open={open} onOpenChange={(next) => { clear(); if (!next) hoverOpened.current = false; setOpen(next); }}>
    <Popover.Trigger className="cat-bubble" aria-label="Best cat? Vote" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onPointerDown={() => { clear(); hoverOpened.current = false; }}>
      <img src={`/assets/cats/${face}.webp`} alt="" width={120} height={120}/>
      <span className="cat-bubble-label">Best cat?</span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="cat-pop st-cats" side="top" align="end" sideOffset={12} collisionPadding={16} aria-label="Vote for the best cat" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onOpenAutoFocus={(event) => { if (hoverOpened.current) event.preventDefault(); }}>
        <header><h2>Best cat?</h2>{poll.tally && <span className="st-note-chip">{poll.tally.total.toLocaleString('en-US')} {poll.tally.total === 1 ? 'vote' : 'votes'}</span>}</header>
        <CatGrid poll={poll}/>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
