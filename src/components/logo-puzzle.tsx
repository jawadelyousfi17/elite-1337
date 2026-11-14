'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { Dialog } from 'radix-ui';
import { AnonymousAvatar, AnonymousTip } from '@/components/anonymous-tip';
import { Avatar } from '@/components/avatar';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, HandTap, Puzzle, RotateCcw, Timer, Trophy, X } from '@/components/icons';
import { KiwiLoader, KiwiNote } from '@/components/kiwi-guide';
import { pastel } from '@/components/rank-row';
import { track } from '@/lib/analytics';
import { BLANK, SIZE, cellForArrow, dragDirection, isSolved, shuffle, slide, solvedBoard, type Board, type Solver } from '@/lib/puzzle';
import { cn } from '@/lib/utils';
import { dealPuzzle, signInToSolve, submitPuzzle } from './puzzle-actions';

export const PUZZLE_NAME = 'Wedesign challenge - Logo puzzle';
const IMAGE = '/assets/puzzle/elite-mark.webp';
const TOP = 10;
const APPLY_URL = 'https://tally.so/r/6Dj64o';
// How far (share of one cell) a tile must be dragged before letting go slides it; shorter drags snap back.
const DRAG_COMMIT = .35;

const clock = (ms: number) => { const total = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
const plural = (count: number) => `${count} ${count === 1 ? 'move' : 'moves'}`;

// Confetti for the solve pop: spread evenly around the board in the site's mint, lilac and pastel colours.
const BURST = Array.from({ length: 24 }, (_, i) => ({
  '--a': `${i * 15 + (i % 3) * 6}deg`, '--d': `${150 + (i * 37) % 110}px`, '--r': `${(i * 83) % 360}deg`,
  '--c': ['var(--mint)', 'var(--lilac)', 'var(--pastel-2)', 'var(--pastel-4)'][i % 4], animationDelay: `${(i % 4) * 20}ms`,
}) as CSSProperties);

type Drag = { cell: number; startX: number; startY: number; dir: [number, number]; size: number; offset: number; moved: boolean };

// Where a tile's slice of the image sits, and where the tile itself sits on the board.
const tileStyle = (tile: number, cell: number) => ({
  '--pz-x': cell % SIZE, '--pz-y': Math.floor(cell / SIZE),
  backgroundPosition: `${(tile % SIZE) * 50}% ${Math.floor(tile / SIZE) * 50}%`,
}) as CSSProperties;

/** One top-10 entry drawn with the leaderboard's own row, so the two lists look the same. */
function SolverRow({ solver, rank, mine }: { solver: Solver; rank: number; mine: boolean }) {
  const score = <span><b>{plural(solver.moves)}</b> · {clock(solver.ms)}</span>;
  if (!solver.login) return <li className="pl-row is-anonymous" style={{ '--pastel': '#3a3a3a' } as CSSProperties}>
    <span className="pl-avatar"><AnonymousAvatar size={45}/></span>
    <span className="pl-copy"><strong><AnonymousTip/></strong>{score}</span>
    <span className="pl-rank" aria-label={`Rank ${rank}`}>{rank}</span>
  </li>;
  return <li className={cn('pl-row', mine && 'is-mine')} style={{ '--pastel': pastel(rank) } as CSSProperties}>
    <span className="pl-avatar"><Avatar login={solver.login} size={45}/></span>
    <span className="pl-copy"><strong>{solver.login}{mine && <em>You</em>}</strong>{score}</span>
    <span className="pl-rank" aria-label={`Rank ${rank}`}>{rank}</span>
  </li>;
}

/** Landing experiment: the Wedesign challenge, a full-screen 3x3 sliding puzzle with a top-10 list for signed-in students. */
export function LogoPuzzle() {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<Board>(solvedBoard);
  const [moves, setMoves] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Signed-in students get a server-dealt board; visitors (and any failure) fall back to a local, unranked one.
  const [dealing, setDealing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [top, setTop] = useState<Solver[] | null>(null);
  const [best, setBest] = useState<{ moves: number; ms: number } | null>(null);
  // The student's place among all solvers, shown as soon as the solve is saved.
  const [standing, setStanding] = useState<{ place: number; total: number } | null>(null);
  const [ranking, setRanking] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const history = useRef<number[]>([]), round = useRef(0);
  const solved = moves > 0 && isSolved(board);

  // The clock ticks only while a round is being played and the challenge is open.
  useEffect(() => {
    if (!open || startedAt === null || finishedAt !== null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, startedAt, finishedAt]);
  const elapsed = startedAt === null ? 0 : (finishedAt ?? now) - startedAt;

  const restart = () => {
    const id = ++round.current;
    history.current = [];
    setBoard(shuffle()); setMoves(0); setToken(null); setBest(null); setStanding(null); setRanking(false); setDealing(true); setStartedAt(null); setFinishedAt(null);
    dealPuzzle().then((deal) => {
      if (id !== round.current) return;
      setSignedIn(!!deal);
      if (deal) { setBoard(deal.board); setToken(deal.token); setTop(deal.top); setMe(deal.me); }
    }).catch(() => undefined).finally(() => {
      if (id !== round.current) return;
      setDealing(false); setStartedAt(Date.now());
    });
  };
  const show = (next: boolean) => {
    if (next) { restart(); track('puzzle-open'); }
    setOpen(next);
  };
  // Coming back from "Sign in with 42" (/?puzzle=1) reopens the challenge, then drops the flag from the address.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('puzzle') !== '1') return;
    params.delete('puzzle');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
    show(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = (cell: number | null) => {
    if (cell === null || solved || dealing) return;
    const next = slide(board, cell);
    if (next === board) return;
    history.current = [...history.current, cell];
    setBoard(next); setMoves(moves + 1);
    if (!isSolved(next)) return;
    setFinishedAt(Date.now());
    track('puzzle-solved', { moves: moves + 1 });
    if (!token) return;
    const id = round.current;
    setRanking(true);
    submitPuzzle({ token, cells: history.current }).then((result) => {
      if (id !== round.current || !result) return;
      setBest(result.best); setStanding(result.standing);
      if (result.top) setTop(result.top);
    }).catch(() => undefined).finally(() => { if (id === round.current) setRanking(false); });
  };
  // Pointer drag: the tile follows the finger toward the blank only, and a tap still slides it.
  const onDown = (event: PointerEvent, cell: number) => {
    const dir = dragDirection(board, cell), width = boardRef.current?.getBoundingClientRect().width;
    if (solved || dealing || !dir || !width || event.button !== 0) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is a nicety; the drag still works without it */ }
    setDrag({ cell, startX: event.clientX, startY: event.clientY, dir, size: width / SIZE, offset: 0, moved: false });
  };
  const onMove = (event: PointerEvent) => {
    if (!drag) return;
    const along = (event.clientX - drag.startX) * drag.dir[0] + (event.clientY - drag.startY) * drag.dir[1];
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
    setDrag({ ...drag, offset: Math.min(Math.max(along, 0), drag.size), moved });
  };
  const onUp = () => {
    if (!drag) return;
    if (!drag.moved || drag.offset > drag.size * DRAG_COMMIT) play(drag.cell);
    setDrag(null);
  };
  // Pointer taps are handled on release; this keeps clicks from screen readers and other non-pointer sources working.
  const onClick = (event: MouseEvent, cell: number) => { if (event.detail === 0) play(cell); };
  const onKey = (event: KeyboardEvent) => {
    const cell = cellForArrow(board, event.key);
    if (cell === null) return;
    event.preventDefault();
    play(cell);
  };

  return <Dialog.Root open={open} onOpenChange={show}>
    <div className="landing-event">
      <Dialog.Trigger className="landing-event-pill pz-pill" aria-label={`${PUZZLE_NAME}. Solve it`}>
        <span className="landing-event-logo pz-thumb"><Puzzle size={18} weight="fill"/></span>
        <span className="landing-event-label"><span className="pz-kicker">Wedesign challenge - </span>Logo puzzle</span>
        <span className="landing-event-chip">Solve it<ArrowRight size={14} weight="bold"/></span>
      </Dialog.Trigger>
    </div>
    <Dialog.Portal>
      <Dialog.Content className={cn('pz-screen', solved && 'is-solved')} aria-describedby="pz-lead"
        onOpenAutoFocus={(event) => { event.preventDefault(); boardRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions); }}>
        <div className="shell pz-page">
          <header className="pz-head">
            <Dialog.Title className="pz-title">{solved ? 'Solved!' : 'Logo puzzle'}</Dialog.Title>
            <p id="pz-lead" className={cn('pz-keys', solved && 'is-hidden')}>
              <span className="sr-only">{solved ? `Solved in ${plural(moves)} and ${clock(elapsed)}.` : 'Slide the tiles into order to rebuild the Elite mark. Drag, tap or use the arrow keys.'}</span>
              <span className="pz-key" aria-hidden="true"><HandTap size={15}/>Drag or tap</span>
              <span className="pz-key is-arrows" aria-hidden="true"><span className="pz-arrows">{[ArrowLeft, ArrowUp, ArrowDown, ArrowRight].map((Key, i) => <i key={i}><Key size={11} weight="bold"/></i>)}</span>work too</span>
            </p>
            <Dialog.Close className="sv-close pz-close" aria-label="Close"><X size={16}/></Dialog.Close>
          </header>

          <div className="pz-layout">
            <section className="panel pz-game" aria-label="Puzzle">
              <div className="pz-stats">
                <span className="pz-stat is-lilac"><b>{moves}</b> {moves === 1 ? 'move' : 'moves'}</span>
                <span className="pz-stat is-yellow" aria-label={`Time ${clock(elapsed)}`}><Timer size={15} weight="bold"/><b>{clock(elapsed)}</b></span>
                {solved && (ranking || standing) && <span className={cn('pz-stat is-mint', ranking && 'is-ranking')} role="status"
                  aria-label={standing ? `Your rank: ${standing.place} of ${standing.total}${best ? `, best ${plural(best.moves)}` : ''}` : 'Saving your solve'}>
                  <Trophy size={15} weight="bold"/>{standing ? <><b>#{standing.place}</b> of {standing.total}</> : 'Ranking…'}
                </span>}
                <button type="button" className={cn('pz-again', solved && 'is-active')} onClick={restart}><RotateCcw size={15}/>{solved ? 'Play again' : 'Shuffle'}</button>
              </div>
              <div className="pz-board-wrap">
                <div ref={boardRef} className={cn('pz-board', solved && 'is-solved', dealing && 'is-dealing')} role="group" aria-label="Puzzle board" aria-busy={dealing} tabIndex={0} onKeyDown={onKey}>
                  {board.map((tile, cell) => {
                    if (tile === BLANK) return null;
                    const held = drag?.cell === cell ? drag : null;
                    const style = { ...tileStyle(tile, cell), backgroundImage: `url(${IMAGE})`, '--pz-dx': `${held ? held.dir[0] * held.offset : 0}px`, '--pz-dy': `${held ? held.dir[1] * held.offset : 0}px` } as CSSProperties;
                    return <button
                      key={tile} type="button" className={cn('pz-tile', held && 'is-held', dragDirection(board, cell) && !solved && 'is-movable')} style={style}
                      onPointerDown={(event) => onDown(event, cell)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
                      onClick={(event) => onClick(event, cell)} tabIndex={-1} disabled={solved} aria-label={`Tile ${tile + 1}`}><span aria-hidden="true">{tile + 1}</span></button>;
                  })}
                  {solved && <img className="pz-whole" src={IMAGE} alt="The Elite mark, rebuilt"/>}
                </div>
                {solved && <div className="pz-celebrate" aria-hidden="true">{BURST.map((style, i) => <i key={i} className="pz-bit" style={style}/>)}</div>}
                {solved && <span className="pz-stamp"><Check size={14}/>Solved</span>}
              </div>
              {solved && <div className="pz-apply">
                <p><strong>Hmm, you seem cool.</strong>Try to apply and join the Wedesign club.</p>
                <a className="pz-apply-cta" href={APPLY_URL} target="_blank" rel="noopener noreferrer" onClick={(event) => {
                  // Always a new tab, so the solved puzzle and the top 10 stay open behind the form.
                  event.preventDefault();
                  track('puzzle-apply');
                  window.open(APPLY_URL, '_blank', 'noopener,noreferrer');
                }}>
                  Apply to Wedesign<ArrowUpRight size={15} weight="bold"/><span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>}
            </section>

            <section className="pz-list" aria-labelledby="pz-top-title">
              <div className="pl-list-head"><p id="pz-top-title" className="pl-count"><strong>Top {TOP}</strong> solvers<span className="pl-updated"> · fewest moves, then fastest</span></p></div>
              {signedIn === null ? <KiwiLoader title="Loading the top solvers"/>
                : signedIn === false ? <div className="pl-empty">
                  <KiwiNote><h2>Sign in to see the top {TOP}</h2><p>Your solves are saved once you sign in with 42.</p></KiwiNote>
                  <form action={signInToSolve}><button type="submit" className="pl-scope is-active pz-signin">Sign in with 42<ArrowRight size={15} weight="bold"/></button></form>
                </div>
                : !top ? <div className="pl-empty"><KiwiNote><h2>The top {TOP} is resting</h2><p>Your puzzle still works. Try again in a minute.</p></KiwiNote></div>
                : !top.length ? <div className="pl-empty"><KiwiNote><h2>No solvers yet</h2><p>Solve it first and take the top spot.</p></KiwiNote></div>
                : <ol className="pl-rows">{top.map((solver, i) => <SolverRow key={i} solver={solver} rank={i + 1} mine={!!solver.login && solver.login === me}/>)}</ol>}
            </section>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
