'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { chainLevels, levelToXp, xpToLevel, type XpProject } from '@/lib/xp-math';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowDown, ArrowRight, ArrowUp, Check, Cohort, Plus, Search, X } from '@/components/icons';
import { matchesSearch } from '@/lib/search';
import { cn } from '@/lib/utils';
import { Slider } from 'radix-ui';

const fmt = (value: number) => Math.round(value).toLocaleString('en-US');
// Intra shows levels cut to two decimals, not rounded.
const lvl = (value: number) => (Math.floor(value * 100) / 100).toFixed(2);
type Picked = { slug: string; mark: number };

/** Levels after one or more projects, in order; projects not validated yet come first in the picker. */
export function XpCalculator({ projects, level, done, skipped, peers, scope }: { projects: XpProject[]; level: number | null; done: Record<string, number>; skipped: string[]; peers: number[] | null; scope: string | null }) {
  const other = useMemo(() => new Set(skipped), [skipped]);
  const bySlug = useMemo(() => new Map(projects.map((project) => [project.slug, project])), [projects]);
  const [picked, setPicked] = useState<Picked[]>([]);
  // The starting level is the student's real one from the rankings; it is not editable.
  const start = level ?? 0;

  const steps = useMemo(() => chainLevels(start, picked.map((item) => ({ xp: bySlug.get(item.slug)!.xp, mark: item.mark, doneMark: done[item.slug] }))), [start, picked, bySlug, done]);
  const final = steps.at(-1)?.level ?? start;
  const update = (slug: string, mark: number) => setPicked((items) => items.map((item) => item.slug === slug ? { ...item, mark } : item));
  const add = (slug: string) => setPicked((items) => [...items, { slug, mark: done[slug] !== undefined ? 125 : 100 }]);
  const taken = new Set(picked.map((item) => item.slug));
  const upNext = projects.filter((project) => done[project.slug] === undefined && !other.has(project.slug) && !taken.has(project.slug)).slice(0, 4);

  return <section className="xp-calc" aria-label="XP calculator">
    <div className="xp-side">
    <div className="xp-hero" aria-live="polite">
      {final > start && <em key={lvl(final)} className="xp-hero-gain">+{(final - start).toFixed(2)}</em>}
      <div className="xp-hero-levels">
        <div className="xp-hero-from"><strong aria-label={`Level now ${lvl(start)}`}>{lvl(start)}</strong></div>
        <span className="xp-hero-arrow" aria-hidden="true"><ArrowRight size={22} weight="bold"/></span>
        <div className="xp-hero-to">
          <strong><CountUp value={final}/></strong>
        </div>
      </div>
      {peers && scope && <Rank peers={peers} from={start} to={final} scope={scope}/>}
      <div className="xp-bar" role="img" aria-label={`${Math.round(final % 1 * 100)}% of the way to level ${Math.floor(final) + 1}`}><i style={{ width: `${final % 1 * 100}%` }}/></div>
    </div>

    {level === null && <p className="xp-note">Your level is not in the rankings yet, so this starts from level 0.</p>}


    {upNext.length > 0 && <section className="xp-panel" aria-label="Up next">
      <h3>Up next</h3>
      <div className="xp-chips">{upNext.map((project) => <button key={project.slug} type="button" className="xp-chip" onClick={() => add(project.slug)}>
        <Plus size={13}/>{project.name}<small>{fmt(project.xp)} XP</small>
      </button>)}</div>
    </section>}

    {picked.length > 0 && <section className="xp-panel" aria-label="Level path">
      <h3>Level path</h3>
      <ol className="xp-path">
        <li className="is-start"><i aria-hidden="true"/><span><b>Now</b></span><strong>{lvl(start)}</strong></li>
        {picked.map((item, index) => {
          const level = steps[index]?.level ?? start, before = index ? steps[index - 1]?.level ?? start : start, last = index === picked.length - 1;
          return <li key={item.slug} className={cn(last && 'is-last')} style={{ '--xp-dot': TONES[index % TONES.length].accent, '--xp-dot-light': TONES[index % TONES.length].ink } as React.CSSProperties}>
            <i aria-hidden="true"/>
            <span><b>{bySlug.get(item.slug)!.name}</b><small>{item.mark}{item.mark > 100 && ' · bonus'} · +{(level - before).toFixed(2)}</small></span>
            <strong>{lvl(level)}</strong>
          </li>;
        })}
      </ol>
    </section>}

    </div>

    <div className="xp-projects">
      <ProjectPicker projects={projects} done={done} other={other} taken={taken} onPick={add}/>
      {picked.length > 0 && <ol className="xp-steps">{picked.map((item, index) => {
        const project = bySlug.get(item.slug)!, doneMark = done[item.slug];
        return <li key={item.slug} className="xp-step">
          <MarkCard tone={TONES[index % TONES.length]} name={project.name} xp={project.xp} doneMark={doneMark} mark={item.mark} onChange={(value) => update(item.slug, value)} onRemove={() => setPicked((items) => items.filter((other) => other.slug !== item.slug))}/>
        </li>;
      })}</ol>}
    </div>
  </section>;
}

const MIN_MARK = 50, MAX_MARK = 125;
/** One colour per project card, in the app's pastel family: a deep fill for dark mode, a pastel fill for light mode. */
const TONES = [
  { dark: '#4a3460', light: '#f2d1fb', accent: '#e9b8fb', ink: '#7a2f93' },
  { dark: '#5c4a17', light: '#fff0b5', accent: '#ffd96a', ink: '#8a6400' },
  { dark: '#283f6b', light: '#d6e4ff', accent: '#9fc1ff', ink: '#2453a6' },
  { dark: '#1d5157', light: '#d9f7fa', accent: '#7fe4ec', ink: '#13737b' },
  { dark: '#62303a', light: '#f7c5ce', accent: '#ffa3b4', ink: '#a1263f' },
  { dark: '#3c3570', light: '#e3def5', accent: '#bbaff7', ink: '#4b3fa8' },
];
const at = (mark: number) => `${(mark - MIN_MARK) / (MAX_MARK - MIN_MARK) * 100}%`;

/**
 * The whole project card is the mark slider: drag anywhere on it and a soft fill follows from the left. A line marks
 * 100, so the bonus zone is visible. The buttons on top stay clickable; arrow keys work on the focused card.
 */
function MarkCard({ tone, name, xp, doneMark, mark, onChange, onRemove }: { tone: typeof TONES[number]; name: string; xp: number; doneMark?: number; mark: number; onChange: (mark: number) => void; onRemove: () => void }) {
  // Buttons sit above the slider: stop their press from also moving the mark.
  const own = { onPointerDown: (event: React.PointerEvent) => event.stopPropagation() };
  const colours = { '--xp-fill': tone.dark, '--xp-fill-light': tone.light, '--xp-accent': tone.accent, '--xp-ink': tone.ink } as React.CSSProperties;
  return <div className={cn('xp-mark', mark > 100 && 'is-bonus')} style={colours}>
    <Slider.Root className="xp-mark-slider" value={[mark]} min={MIN_MARK} max={MAX_MARK} step={1} onValueChange={([next]) => onChange(next)}>
      <Slider.Track className="xp-mark-track"><Slider.Range className="xp-mark-fill"/></Slider.Track>
      <Slider.Thumb className="xp-mark-thumb" aria-label={`Mark for ${name}`}/>
    </Slider.Root>
    <span className="xp-mark-pass" style={{ left: at(100) }} aria-hidden="true"/>
    <div className="xp-mark-body">
      <div className="xp-mark-title"><strong>{name}</strong><small>{fmt(xp)} XP{doneMark !== undefined && <> · validated at {doneMark}</>}</small></div>
      <div className="xp-mark-value" aria-hidden="true"><b>{mark}</b><small>{mark > 100 ? 'bonus' : mark === 100 ? 'full' : 'mark'}</small></div>
    </div>
    <div className="xp-mark-tools">
      <span className="xp-mark-hint">Drag to set the mark</span>
      <div className="xp-presets" role="group" aria-label={`Quick marks for ${name}`}>
        {[100, 125].map((value) => <button key={value} type="button" {...own} className={cn(mark === value && 'is-on')} aria-pressed={mark === value} onClick={() => onChange(value)}>{value === 125 ? '125 · bonus' : '100'}</button>)}
        <button type="button" {...own} className="xp-remove" onClick={onRemove} aria-label={`Remove ${name}`}><X size={14}/></button>
      </div>
    </div>
  </div>;
}

/** Rank among the scope's other students (ties share a rank): now, after the plan, and the move between them. */
function Rank({ peers, from, to, scope }: { peers: number[]; from: number; to: number; scope: string }) {
  const rankAt = (level: number) => 1 + peers.filter((other) => other > level).length;
  const now = rankAt(from), next = rankAt(to), moved = now - next;
  return <p className="xp-rank" aria-label={`Rank ${now} now, ${next} after the plan, in ${scope}`}>
    <span>#{now}</span>
    <ArrowRight size={14} weight="bold" aria-hidden="true"/>
    <b key={next}>#{next}</b>
    <em className={cn(moved > 0 ? 'is-up' : moved < 0 ? 'is-down' : 'is-same')}>{moved > 0 ? <ArrowUp size={12}/> : moved < 0 ? <ArrowDown size={12}/> : null}{moved ? Math.abs(moved) : 'same'}</em>
    <small><Cohort size={14} aria-hidden="true"/>{scope}</small>
  </p>;
}

/** The new level counts up (or down) to its value, so adding a project visibly moves it. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = value; setShown(value); return; }
    const began = performance.now(), duration = 650;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration), eased = 1 - (1 - t) ** 3;
      const next = start + (value - start) * eased;
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{lvl(shown)}</>;
}

/** Searchable project list in a popover: next projects first, then validated ones to improve, then skipped alternatives. */
function ProjectPicker({ projects, done, other, taken, onPick }: { projects: XpProject[]; done: Record<string, number>; other: Set<string>; taken: Set<string>; onPick: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const shown = projects.filter((project) => !taken.has(project.slug) && (!q || matchesSearch(q, [project.name, project.slug])));
  const groups = [
    { label: 'Not validated yet', items: shown.filter((project) => done[project.slug] === undefined && !other.has(project.slug)) },
    { label: 'Validated · improve your mark', items: shown.filter((project) => done[project.slug] !== undefined) },
    { label: 'Other options', items: shown.filter((project) => other.has(project.slug)) },
  ].filter((group) => group.items.length);
  const pick = (slug: string) => { onPick(slug); setOpen(false); setQ(''); };

  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQ(''); }}>
    <PopoverTrigger asChild><button type="button" className="xp-add"><Plus size={16}/>Add a project</button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} className="xp-picker" onOpenAutoFocus={(event) => { event.preventDefault(); input.current?.focus(); }}>
      <div className="xp-picker-search">
        <Search size={16}/>
        <input ref={input} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search a project" aria-label="Search a project"
          onKeyDown={(event) => { if (event.key === 'Enter' && groups[0]?.items[0]) { event.preventDefault(); pick(groups[0].items[0].slug); } }}/>
      </div>
      <div className="xp-picker-list" role="listbox" aria-label="Projects">
        {!groups.length ? <p className="xp-picker-empty">No project matches “{q}”.</p> : groups.map((group) => <div key={group.label} role="group" aria-label={group.label}>
          <p className="xp-picker-label">{group.label}</p>
          {group.items.map((project) => <button key={project.slug} type="button" role="option" aria-selected={false} className="xp-option" onClick={() => pick(project.slug)}>
            <span className="xp-option-circle">C{project.circle}</span>
            <span className="xp-option-name">{project.name}</span>
            {done[project.slug] !== undefined && <span className="xp-option-done"><Check size={12}/>{done[project.slug]}</span>}
            <span className="xp-option-xp">{fmt(project.xp)} XP</span>
          </button>)}
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}
