'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Journey, Stop } from '@/lib/journey';
import { circlesDone } from '@/lib/circles';
import { Check, Crown, Muted, Sound, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { hushSfx, playSfx, unlockSfx, type Cue } from './race-sfx';

/** Horizontal geometry of the track, in px. */
const GAP = 250, START = 120, RUN_UP = 110, LAND = 110, GROUND = 196;
/** Collision box: half the obstacle art's width (hurdle 72px, exam gate 64px) and half the runner's (64px). */
const HALF = { project: 36, exam: 32 }, RUNNER_HALF = 32;
/** Story pacing (solo): a stretch's length grows with the real number of days between two projects. */
const runTime = (days: number) => 320 + 430 * Math.log1p(days);
const CRASH = 820, JUMP = 640, FALL = 1500;
/** Calendar pacing (versus): shorter moves so both runners stay close to their real dates. */
const VS_CRASH = 700, VS_JUMP = 600, VS_TARGET = 110_000, VS_MIN_RUN = 450;
/** High enough to clear the tallest obstacle (exam gate, 64px) with a margin. */
const JUMP_HEIGHT = 124;
const DAY = 86_400_000;

type Segment =
  | { kind: 'run'; t0: number; dur: number; from: number; to: number }
  | { kind: 'wait'; t0: number; dur: number; at: number }
  | { kind: 'crash'; t0: number; dur: number; at: number; edge: number; stop: number; attempt: number }
  | { kind: 'jump'; t0: number; dur: number; from: number; to: number; stop: number; attempt: number }
  | { kind: 'fall'; t0: number; dur: number; at: number };
type Timeline = { segments: Segment[]; total: number; endX: number; doneCount: number };

const hurdleX = (index: number) => START + GAP * (index + 1);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const fmtGap = (days: number) => days < 1 ? 'same day' : days < 60 ? `${days} ${days === 1 ? 'day' : 'days'}` : `${Math.round(days / 30.4)} months`;
const daysOf = (journey: Journey) => (Date.parse(journey.fell ?? journey.now) - Date.parse(journey.start)) / DAY;

/**
 * Builds the runner's moves. Without a clock, each stretch lasts according to the gap (story pacing).
 * With a clock (ms per day), every attempt happens at its real day since the student's Common Core start,
 * so two runners can share one timeline.
 */
function buildTimeline(journey: Journey, msPerDay?: number): Timeline {
  const segments: Segment[] = [];
  const fell = !!journey.fell, start = Date.parse(journey.start);
  const when = (iso: string) => msPerDay ? (Date.parse(iso) - start) / DAY * msPerDay : 0;
  let t = 0, x = START;
  const push = (segment: Segment) => { segments.push(segment); t = segment.t0 + segment.dur; };
  const waitUntil = (at: number, position: number) => { if (msPerDay && at > t + 1) push({ kind: 'wait', t0: t, dur: at - t, at: position }); };
  const done = journey.stops.filter((stop) => !stop.pending);
  done.forEach((stop, index) => {
    const hx = hurdleX(index);
    const arrive = msPerDay ? Math.max(t + VS_MIN_RUN, when(stop.attempts[0].at)) : t + runTime(stop.gapDays);
    push({ kind: 'run', t0: t, dur: arrive - t, from: x, to: hx - RUN_UP });
    stop.attempts.forEach((attempt, a) => {
      waitUntil(when(attempt.at), hx - RUN_UP);
      if (attempt.passed || a === stop.attempts.length - 1) push({ kind: 'jump', t0: t, dur: msPerDay ? VS_JUMP : JUMP, from: hx - RUN_UP, to: hx + LAND, stop: index, attempt: a });
      else push({ kind: 'crash', t0: t, dur: msPerDay ? VS_CRASH : CRASH, at: hx, edge: hx - (stop.exam ? HALF.exam : HALF.project), stop: index, attempt: a });
    });
    x = hx + LAND;
  });
  const endX = hurdleX(done.length) - (fell ? 40 : RUN_UP);
  const finish = msPerDay ? Math.max(t + 300, when(journey.fell ?? journey.now)) : t + 700;
  push({ kind: 'run', t0: t, dur: finish - t, from: x, to: endX });
  if (fell) push({ kind: 'fall', t0: t, dur: FALL, at: endX });
  return { segments, total: t, endX, doneCount: done.length };
}

/** Where the runner is and what it is doing at time t. */
function poseAt(segments: Segment[], t: number) {
  const segment = segments.find((s) => t < s.t0 + s.dur) ?? segments.at(-1)!;
  const p = Math.min(1, Math.max(0, (t - segment.t0) / segment.dur));
  switch (segment.kind) {
    case 'run': return { x: segment.from + (segment.to - segment.from) * p, y: 0, rot: 0, pose: t >= segment.t0 + segment.dur ? 'idle' : 'run' };
    case 'wait': return { x: segment.at, y: 0, rot: 0, pose: 'idle' };
    case 'jump': return { x: segment.from + (segment.to - segment.from) * p, y: -Math.sin(Math.PI * p) * JUMP_HEIGHT, rot: -12 * Math.sin(Math.PI * p), pose: 'jump' };
    case 'crash': {
      // run in until the runner's front touches the obstacle's front edge (2px squash), bounce back, line up again
      const near = segment.edge - RUNNER_HALF + 2, back = segment.at - RUN_UP - 26;
      if (p < .32) return { x: segment.at - RUN_UP + (near - (segment.at - RUN_UP)) * (p / .32), y: 0, rot: 0, pose: 'run' };
      if (p < .7) { const q = (p - .32) / .38; return { x: near + (back - near) * q, y: -Math.sin(Math.PI * q) * 30, rot: -24 * Math.sin(Math.PI * q), pose: 'crash' }; }
      const q = (p - .7) / .3; return { x: back + (segment.at - RUN_UP - back) * q, y: 0, rot: 0, pose: 'run' };
    }
    case 'fall': return { x: segment.at + 70 * Math.min(1, p * 2), y: p < .25 ? -20 * Math.sin(Math.PI * p * 2) : (p - .25) * 420, rot: p * 220, pose: 'fall' };
  }
}

/** How many attempts each hurdle has revealed at time t. */
function revealedAt(segments: Segment[], t: number) {
  const shown = new Map<number, number>();
  for (const s of segments) {
    if (s.kind === 'crash' && t >= s.t0 + s.dur * .32) shown.set(s.stop, Math.max(shown.get(s.stop) ?? 0, s.attempt + 1));
    if (s.kind === 'jump' && t >= s.t0 + s.dur * .5) shown.set(s.stop, Math.max(shown.get(s.stop) ?? 0, s.attempt + 1));
  }
  return shown;
}

/** Attempt badges above a hurdle: each crash shows while the runner is still trying; once cleared, they fold into one small "× N" badge. */
function Tries({ attempts }: { attempts: Stop['attempts'] }) {
  const fails = attempts.filter((attempt) => !attempt.passed), pass = attempts.find((attempt) => attempt.passed);
  const folded = !!pass || fails.length > 3;
  return <span className="race-tries">
    {folded ? fails.length > 0 && <i className="is-fail is-folded" key={`n${fails.length}`}><X size={10} weight="bold"/><em>×{fails.length}</em></i> : fails.map((attempt, a) => <i key={a} className="is-fail"><X size={11} weight="bold"/>{attempt.mark !== null && <em>{attempt.mark}</em>}</i>)}
    {pass && <i className="is-pass"><Check size={11} weight="bold"/>{pass.mark !== null && <em>{pass.mark}</em>}</i>}
  </span>;
}

const hurdleArt = (stop: Stop) => <img src={stop.exam ? '/assets/race/exam-gate-flat.webp' : '/assets/race/project-hurdle-flat.webp'} alt="" width={stop.exam ? 64 : 72} height={stop.exam ? 64 : 48}/>;

type Runner = { journey: Journey; login: string; art: string; tag?: boolean };

function Lane({ runner, timeline, t, finished, versus, width, leading = false }: { runner: Runner; timeline: Timeline; t: number; finished: boolean; versus: boolean; width: number; leading?: boolean }) {
  const { journey } = runner, fell = !!journey.fell;
  const done = journey.stops.filter((stop) => !stop.pending), ahead = fell ? [] : journey.stops.filter((stop) => stop.pending);
  const pose = poseAt(timeline.segments, t), shown = revealedAt(timeline.segments, t);
  return <div className={cn('race-track', versus && 'is-versus')} style={{ width }}>
    <span className="race-ground" style={{ width: fell ? timeline.endX + 40 : width - 60 }}/>
    {fell && <span className="race-cliff" style={{ left: timeline.endX + 40 }} aria-hidden="true"/>}
    <span className="race-start" style={{ left: START - 70 }}><img className="race-start-art" src="/assets/race/start-flag.webp" alt="" width={44} height={66}/><b>{versus ? runner.login : 'Start'}</b><small>{fmtDate(journey.start)}</small></span>
    {done.map((stop, index) => {
      const count = shown.get(index) ?? 0, x = hurdleX(index), prev = index === 0 ? START : hurdleX(index - 1);
      return <div key={stop.slug} className={cn('race-stop', stop.exam && 'is-exam', count > 0 && 'is-reached', count === stop.attempts.length && 'is-cleared')} style={{ left: x }}>
        {!versus && <span className="race-gap" style={{ left: (prev - x) / 2 }}>{fmtGap(stop.gapDays)}</span>}
        <Tries attempts={stop.attempts.slice(0, count)}/>
        <span className="race-hurdle" aria-hidden="true">{hurdleArt(stop)}</span>
        <span className="race-label"><b>{stop.project}</b>{!versus && <small>{fmtDate(stop.at)}</small>}</span>
      </div>;
    })}
    {circlesDone(done).map((circle) => {
      const index = done.findIndex((stop) => stop.slug === circle.slug);
      const stop = done[index], unlocked = (shown.get(index) ?? 0) >= stop.attempts.length;
      return <div key={circle.circle} className={cn('race-circle', unlocked && 'is-unlocked')} style={{ left: hurdleX(index) + GAP / 2 }} title={`Circle ${circle.circle} done · ${fmtDate(circle.at)}`}>
        <span className="race-circle-star" aria-hidden="true">★</span>
        <span className="race-circle-label">{unlocked ? `Circle ${circle.circle} finished` : `Circle ${circle.circle}`}</span>
      </div>;
    })}
    {ahead.map((stop, index) => <div key={stop.slug} className={cn('race-stop is-ahead', stop.exam && 'is-exam')} style={{ left: hurdleX(timeline.doneCount + index) }}>
      <span className="race-hurdle" aria-hidden="true">{hurdleArt(stop)}</span>
      <span className="race-label"><b>{stop.project}</b><small>in progress</small></span>
    </div>)}
    <div className={cn('race-runner', `is-${pose.pose}`, finished && !fell && 'is-home')} style={{ transform: `translate3d(${pose.x - 32}px, ${GROUND - 64 + pose.y}px, 0) rotate(${pose.rot}deg)` }} aria-hidden="true">
      <img src={runner.art} alt="" width={64} height={64}/>
      {pose.pose === 'crash' && <span className="race-bonk"><X size={14} weight="bold"/></span>}
      {runner.tag && <span className="race-tag">{leading && <span className="race-tag-crown" aria-hidden="true"><Crown size={22}/></span>}{runner.login}</span>}
    </div>
    {finished && !fell && <span className="race-here" style={{ left: timeline.endX }}>{versus ? 'Today' : 'You are here'}</span>}
    {finished && fell && <span className="race-fell" style={{ left: timeline.endX + 40 }}>Blackholed · {fmtDate(journey.fell!)}</span>}
  </div>;
}

type SoundCue = { t: number; cue: Cue; rate?: number; gain?: number; length?: number };
const SOUND_KEY = 'elite-race-sound';

/** What each lane sounds like over the race: jumps, crashes, a coin per pass, a fall, and a purr at today. The opponent is a little lower and quieter. */
function soundCues(timelines: Timeline[], runners: Runner[], marks: { t: number }[]): SoundCue[] {
  const cues: SoundCue[] = [];
  timelines.forEach((timeline, lane) => {
    const voice = lane ? { rate: .88, gain: .6 } : {};
    const done = runners[lane].journey.stops.filter((stop) => !stop.pending);
    for (const s of timeline.segments) {
      if (s.kind === 'jump') {
        cues.push({ t: s.t0, cue: 'jump', ...voice });
        if (done[s.stop]?.attempts[s.attempt]?.passed) cues.push({ t: s.t0 + s.dur * .5, cue: 'coin', ...voice });
      }
      if (s.kind === 'crash') cues.push({ t: s.t0 + s.dur * .32, cue: 'crash', ...voice });
      if (s.kind === 'fall') cues.push({ t: s.t0 + s.dur * .2, cue: 'crash', rate: .55, gain: 1.2 });
    }
    if (!runners[lane].journey.fell) cues.push({ t: timeline.total, cue: 'purr', length: 2.6, gain: lane ? .5 : 1 });
  });
  // circle stars: a quick high double coin right after the pass
  for (const mark of marks) cues.push({ t: mark.t + 140, cue: 'coin', rate: 1.5, gain: .8 }, { t: mark.t + 290, cue: 'coin', rate: 1.9, gain: .8 });
  return cues.sort((a, b) => a.t - b.t);
}

/** One runner with story pacing, or two runners on a shared calendar clock counted from each one's first Common Core day. */
const lanePending = (runner: Runner) => runner.journey.fell ? 0 : runner.journey.stops.filter((stop) => stop.pending).length;

export function JourneyRace({ runners, label }: { runners: Runner[]; label: string }) {
  const versus = runners.length > 1;
  const msPerDay = useMemo(() => versus ? Math.min(260, Math.max(40, VS_TARGET / Math.max(...runners.map((runner) => daysOf(runner.journey))))) : undefined, [runners, versus]);
  const timelines = useMemo(() => runners.map((runner) => buildTimeline(runner.journey, msPerDay)), [runners, msPerDay]);
  const total = Math.max(...timelines.map((timeline) => timeline.total));

  // Opens on today (or the blackhole); the race runs only when Play is pressed.
  const [t, setT] = useState(total);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const [sound, setSound] = useState(true);
  useEffect(() => { try { if (localStorage.getItem(SOUND_KEY) === 'off') setSound(false); } catch { /* storage unavailable */ } }, []);
  const toggleSound = () => {
    const next = !sound; setSound(next);
    if (next) unlockSfx(); else hushSfx();
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* storage unavailable */ }
  };
  const [speed, setSpeed] = useState(1);
  // One scroll area per lane, each with its own camera; dragging a lane stops only that lane's camera.
  const stages = useRef<(HTMLDivElement | null)[]>([]);
  const follow = useRef<boolean[]>([]);
  const followAll = () => { follow.current = runners.map(() => true); };
  const last = useRef<number | null>(null);

  useEffect(() => {
    setT(total); setPlaying(false); setPlayed(false); followAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let frame = 0;
    const tick = (now: number) => {
      const delta = last.current === null ? 0 : now - last.current;
      last.current = now;
      setT((current) => { const next = Math.min(total, current + delta * speed); if (next >= total) setPlaying(false); return next; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total]);

  // Each camera keeps its own runner in view: a bit left of center when solo, centered in a race.
  const xs = timelines.map((timeline) => poseAt(timeline.segments, Math.min(t, timeline.total)).x);
  const xKey = xs.map((x) => Math.round(x)).join(',');
  useEffect(() => {
    xs.forEach((x, i) => {
      const el = stages.current[i];
      if (el && follow.current[i] !== false) el.scrollLeft = x - el.clientWidth * (versus ? .5 : .35);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xKey, versus]);

  const replay = useCallback(() => { hushSfx(); followAll(); setT(0); setPlaying(true); setPlayed(true); }, // eslint-disable-next-line react-hooks/exhaustive-deps
  []);
  // Gold marks on the progress bar where the first runner finishes each circle.
  const marks = useMemo(() => {
    const done = runners[0].journey.stops.filter((stop) => !stop.pending);
    return circlesDone(done).flatMap((circle) => {
      const index = done.findIndex((stop) => stop.slug === circle.slug);
      const jump = timelines[0].segments.find((segment) => segment.kind === 'jump' && segment.stop === index);
      return jump ? [{ circle: circle.circle, t: jump.t0 + jump.dur * .5 }] : [];
    });
  }, [runners, timelines]);
  const finished = t >= total - 1;
  const cues = useMemo(() => soundCues(timelines, runners, marks), [timelines, runners, marks]);
  // Sounds follow the clock only while the race plays, never while scrubbing; at 4× the jump blips drop out.
  const heard = useRef(t), live = useRef(false);
  useEffect(() => {
    const from = heard.current; heard.current = t;
    if (!live.current || !sound || t <= from) return;
    cues.filter((c) => c.t > from && c.t <= t && !(speed === 4 && c.cue === 'jump')).slice(-3)
      .forEach((c) => playSfx(c.cue, { rate: c.rate, gain: c.gain, length: c.length }));
  }, [t, sound, speed, cues]);
  const passedAt = (i: number) => [...revealedAt(timelines[i].segments, Math.min(t, timelines[i].total))].filter(([stop, count]) => runners[i].journey.stops.filter((s) => !s.pending)[stop]?.attempts.slice(0, count).some((a) => a.passed)).length;
  const passed = runners.map((_, i) => passedAt(i));
  // Bars share one scale: the most projects either player passes by the end.
  const scale = Math.max(1, ...runners.map((runner) => runner.journey.stops.filter((stop) => stop.passed && !stop.pending).length));
  const leader = passed[0] === passed[1] ? -1 : passed[0] > passed[1] ? 0 : 1;
  // The crown changing hands gets its own sound.
  const crowned = useRef(leader);
  useEffect(() => {
    if (versus && playing && sound && leader !== -1 && crowned.current !== -1 && leader !== crowned.current) playSfx('tab');
    if (leader !== -1) crowned.current = leader;
  }, [leader, versus, playing, sound]);

  return <section className={cn('race', playing && 'is-playing', versus && 'is-versus')} aria-label={label}>
    {versus && msPerDay && <div className="race-compare" aria-live="off">
      <span className="race-day">Day {Math.floor(t / msPerDay).toLocaleString('en-US')}</span>
      <div className="race-compare-rows">{runners.map((runner, i) => <div key={runner.login} className={cn('race-compare-row', leader === i && 'is-leader')}>
        <img src={runner.art} alt="" width={24} height={24}/>
        <b>{runner.login}{leader === i && <span className="race-crown" aria-label="leading"><Crown size={15}/></span>}</b>
        <span className="race-compare-bar" aria-hidden="true"><i style={{ width: `${passed[i] / scale * 100}%` }}/></span>
        <em>{passed[i]} passed</em>
      </div>)}</div>
    </div>}
    {runners.map((runner, i) => <div key={runner.login + i} className="race-stage" ref={(el) => { stages.current[i] = el; }} onWheel={() => { follow.current[i] = false; }} onPointerDown={() => { follow.current[i] = false; }}>
      <Lane runner={runner} timeline={timelines[i]} t={Math.min(t, timelines[i].total)} finished={t >= timelines[i].total - 1} versus={versus} width={hurdleX(timelines[i].doneCount + lanePending(runner)) + 220} leading={leader === i}/>
    </div>)}
    <div className="race-controls">
      <button type="button" className="race-play" onClick={() => { if (sound) unlockSfx(); live.current = !playing || finished; if (finished) replay(); else setPlaying(!playing); }}>{finished ? played ? 'Replay' : 'Play' : playing ? 'Pause' : 'Play'}</button>
      <div className="race-progress" style={{ '--p': `${total ? t / total * 100 : 0}%` } as React.CSSProperties}>
        <input type="range" className="race-scrub" min={0} max={Math.ceil(total)} value={Math.round(t)} onChange={(event) => { live.current = false; setPlaying(false); setPlayed(true); followAll(); setT(Math.min(total, Number(event.target.value))); }} aria-label="Race position" aria-valuetext={versus && msPerDay ? `Day ${Math.floor(t / msPerDay)}` : `${Math.round(t / total * 100)}%`}/>
        {marks.map((mark) => <span key={mark.circle} className={cn('race-mark', t >= mark.t && 'is-on')} style={{ left: `${mark.t / total * 100}%` }} title={`Circle ${mark.circle}`} aria-hidden="true">★</span>)}
        <span className="race-progress-ends" aria-hidden="true"><span>Start</span><span>{runners[0].journey.fell ? 'Blackholed' : 'Today'}</span></span>
      </div>
      <div className="race-speed" role="group" aria-label="Speed">{[1, 2, 4].map((value) => <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
      <button type="button" className="race-sound" aria-pressed={sound} onClick={toggleSound} aria-label={sound ? 'Mute race sounds' : 'Turn race sounds on'} title={sound ? 'Sound on' : 'Sound off'}>{sound ? <Sound size={18}/> : <Muted size={18}/>}</button>
    </div>
  </section>;
}
