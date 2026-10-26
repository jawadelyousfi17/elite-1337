'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from '@/components/icons';
import { sendRankTestAnswer } from '@/components/rank-test-actions';
import type { RankTestChoice, ScrollMode } from '@/lib/rank-test';

const LATER = 'rank-test-later';
const MIN_SECONDS = 12;
const COPY: Record<ScrollMode, { now: string; other: string; keep: string; change: string }> = {
  pages: { now: 'page numbers', other: 'infinite scroll, where the list keeps loading as you scroll', keep: 'Keep page numbers', change: 'Switch to infinite scroll' },
  infinite: { now: 'infinite scroll', other: 'page numbers, one page of 25 at a time', keep: 'Keep infinite scroll', change: 'Switch to page numbers' },
};

/**
 * Asks once, after the student has used the list (reached its end, or loaded more) for a little while,
 * whether to keep the leaderboard style they got or switch. "Later" hides it for this browser session.
 */
export function RankTestPrompt({ mode }: { mode: ScrollMode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle');

  useEffect(() => {
    try { if (sessionStorage.getItem(LATER)) return; } catch { /* storage blocked: still ask */ }
    const started = Date.now();
    let engaged = false, timer: ReturnType<typeof setTimeout> | undefined;
    const engage = () => {
      if (engaged) return;
      engaged = true;
      timer = setTimeout(() => setOpen(true), Math.max(0, MIN_SECONDS * 1000 - (Date.now() - started)));
    };
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting && (entry.target as HTMLElement).dataset.rankEnd !== undefined)) engage(); });
    const watch = () => document.querySelectorAll('[data-rank-end]').forEach((element) => observer.observe(element));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-rank-end'] });
    window.addEventListener('rank-test:engaged', engage);
    return () => { observer.disconnect(); mutations.disconnect(); window.removeEventListener('rank-test:engaged', engage); if (timer) clearTimeout(timer); };
  }, []);

  const later = () => { try { sessionStorage.setItem(LATER, '1'); } catch { /* nothing to remember */ } setOpen(false); };
  const answer = async (choice: RankTestChoice) => {
    setSent('sending');
    const saved = await sendRankTestAnswer(choice).catch(() => null);
    if (!saved) { setSent('failed'); return; }
    setSent('done');
    setTimeout(() => { setOpen(false); router.refresh(); }, 1400);
  };

  if (!open) return null;
  const copy = COPY[mode];
  return <aside className="ab-prompt" role="dialog" aria-labelledby="ab-title" aria-describedby="ab-text">
    <button type="button" className="ab-close" onClick={later} aria-label="Ask me later"><X size={14}/></button>
    {sent === 'done' ? <p className="ab-thanks" role="status"><strong>Thanks!</strong> Your leaderboard is updated.</p> : <>
      <h2 id="ab-title">Quick question</h2>
      <p id="ab-text">You are using <b>{copy.now}</b>. Other students get {copy.other}. Which do you prefer?</p>
      <div className="ab-actions">
        <button type="button" className="ab-keep" disabled={sent === 'sending'} onClick={() => answer('keep')}>{copy.keep}</button>
        <button type="button" className="ab-switch" disabled={sent === 'sending'} onClick={() => answer('switch')}>{copy.change}</button>
      </div>
      {sent === 'failed' ? <p className="ab-note" role="alert">Could not save your answer. Try again in a minute.</p> : <button type="button" className="ab-later" onClick={later}>Ask me later</button>}
    </>}
  </aside>;
}
