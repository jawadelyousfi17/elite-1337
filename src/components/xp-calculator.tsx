'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { chainLevels, MAX_XP_LEVEL, type XpCoalition, type XpOption } from '@/lib/xp-math';
import { customLevelSchema } from '@/lib/xp-custom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowDown, ArrowRight, ArrowUp, Check, Cohort, Pencil, Plus, Search, X } from '@/components/icons';
import { matchesSearch } from '@/lib/search';
import { cn } from '@/lib/utils';
import { Slider, Switch, Tooltip } from 'radix-ui';
import { CoalitionMark } from '@/components/coalition-marks';
import { XpViewTabs, type XpView } from '@/components/xp-view-tabs';

const fmt = (value: number) => Math.round(value).toLocaleString('en-US');
// Intra truncates levels; ignore floating-point noise at an exact hundredth.
const lvl = (value: number) => (Math.floor(value * 100 + 1e-9) / 100).toFixed(2);
type Picked = { slug: string; mark: number; boost: boolean };
const levelHint = `Enter a level from 0 to ${MAX_XP_LEVEL}, with up to two decimal places.`;

/**
 * Levels after one or more projects, in order; projects not validated yet come first in the picker. Both lists live
 * in the page: the Common Core one arrives with it, the slow Advanced one streams in after, so switching between them
 * never reloads the page or clears the plan. `null` means a list is unavailable right now.
 */
export function XpCalculator({ core, advanced: advancedList, view: initialView, level, custom = false, invalidLevel = false, done, skipped, peers, scope, coalition }: { core: XpOption[] | null; advanced: Promise<XpOption[] | null>; view: XpView; level: number | null; custom?: boolean; invalidLevel?: boolean; done: Record<string, number>; skipped: string[]; peers: number[] | null; scope: string | null; coalition: XpCoalition | null }) {
  const router = useRouter(), searchParams = useSearchParams();
  const [levelPending, changeLevel] = useTransition();
  const [editing, setEditing] = useState(invalidLevel);
  const [levelTip, setLevelTip] = useState(false);
  const [draft, setDraft] = useState(lvl(level ?? 0));
  const [levelError, setLevelError] = useState<string | null>(invalidLevel ? `${levelHint} Using level 0 for now.` : null);
  const levelInput = useRef<HTMLInputElement>(null), editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setDraft(lvl(level ?? 0));
    setEditing(invalidLevel);
    setLevelError(invalidLevel ? `${levelHint} Using level 0 for now.` : null);
  }, [level, invalidLevel]);
  useEffect(() => { if (editing) { levelInput.current?.focus(); levelInput.current?.select(); } }, [editing]);
  const saveLevel = () => {
    if (!editing || levelPending) return;
    const parsed = customLevelSchema.safeParse(draft);
    if (!parsed.success) { setLevelError(levelHint); return; }
    setLevelError(null); setEditing(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('level', String(parsed.data));
    changeLevel(() => router.push(`/xp?${params}`, { scroll: false }));
  };
  const other = useMemo(() => new Set(skipped), [skipped]);
  const [view, setView] = useState(initialView);
  const [advanced, setAdvanced] = useState<XpOption[] | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    advancedList.then((list) => { if (live) setAdvanced(list); }, () => { if (live) setAdvanced(null); });
    return () => { live = false; };
  }, [advancedList]);
  const bySlug = useMemo(() => new Map([...core ?? [], ...advanced ?? []].map((project) => [project.slug, project])), [core, advanced]);
  const [selected, setPicked] = useState<Picked[]>([]);
  // Returning to a student can narrow the available projects; keep missing entries out of the calculation.
  const picked = useMemo(() => selected.filter((item) => bySlug.has(item.slug)), [selected, bySlug]);
  // Custom plans can change their starting level while keeping the selected projects and marks.
  const start = level ?? 0;
  // The #1 coalition's bonus is on by default; 42 does not publish it, so 4.2% is an estimate the student can change.
  const [bonusEnabled, setBoosted] = useState(coalition?.rank === 1);
  useEffect(() => { setBoosted(coalition?.rank === 1); }, [coalition?.name, coalition?.rank]);
  const boosted = (custom || !!coalition) && bonusEnabled;
  const [percent, setPercent] = useState('4.2');
  const bonus = boosted ? Math.min(Math.max(Number(percent) || 0, 0), 100) : 0;

  const steps = useMemo(() => chainLevels(start, picked.map((item) => ({ xp: bySlug.get(item.slug)!.xp, mark: item.mark, doneMark: done[item.slug], boost: item.boost })), bonus), [start, picked, bySlug, done, bonus]);
  const final = steps.at(-1)?.level ?? start;
  const toggleBoost = (slug: string) => setPicked((items) => items.map((item) => item.slug === slug ? { ...item, boost: !item.boost } : item));
  const update = (slug: string, mark: number) => setPicked((items) => items.map((item) => item.slug === slug ? { ...item, mark } : item));
  const add = (slug: string) => setPicked((items) => [...items, { slug, mark: done[slug] !== undefined ? 125 : 100, boost: true }]);
  const taken = new Set(picked.map((item) => item.slug));
  // The next Common Core projects in circle order; empty once the circles are done.
  const upNext = (core ?? []).filter((project) => done[project.slug] === undefined && !other.has(project.slug) && !taken.has(project.slug)).slice(0, 4);

  const totalGain = steps.reduce((sum, step) => sum + step.gain, 0);
  return <section className="xp-calc" aria-label="XP calculator">
    <div className="xp-side">
    <div className="xp-hero" aria-live="polite">
      {final > start && <em key={lvl(final)} className="xp-hero-gain">+{(final - start).toFixed(2)}</em>}
      <div className="xp-hero-levels">
        <div className="xp-hero-from">
          <form className="xp-start-editor" aria-label="Edit starting level" aria-busy={levelPending} onSubmit={(event) => { event.preventDefault(); saveLevel(); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) saveLevel(); }}>
            <span className="xp-start-number">
              <strong className={cn(editing && 'is-editing')} aria-hidden={editing || undefined} aria-label={editing ? undefined : `${custom ? 'Starting level' : 'Level now'} ${lvl(start)}`}>{editing ? draft || '0.00' : lvl(start)}</strong>
              {editing && <input ref={levelInput} type="text" inputMode="decimal" maxLength={6} value={draft} onChange={(event) => { setDraft(event.target.value); setLevelError(null); }} aria-label="Starting level" aria-invalid={!!levelError} aria-describedby={levelError ? 'xp-level-error' : undefined} onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault(); setDraft(lvl(start)); setLevelError(null); setEditing(false); editButton.current?.focus();
              }}/>}
            </span>
            <Tooltip.Provider delayDuration={250}>
              <Tooltip.Root open={!editing && levelTip} onOpenChange={setLevelTip}>
                <Tooltip.Trigger asChild><button ref={editButton} type={editing ? 'submit' : 'button'} className="xp-level-edit" aria-label={editing ? 'Save starting level' : 'Custom level'} disabled={levelPending} onClick={(event) => { if (!editing) { event.preventDefault(); setDraft(lvl(start)); setEditing(true); } }}>{editing ? <Check size={15}/> : <Pencil size={15}/>}</button></Tooltip.Trigger>
                <Tooltip.Portal><Tooltip.Content className="xp-level-tip" side="top" sideOffset={6}>Custom level<Tooltip.Arrow/></Tooltip.Content></Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </form>
        </div>
        <span className="xp-hero-arrow" aria-hidden="true"><ArrowRight size={22} weight="bold"/></span>
        <div className="xp-hero-to">
          <strong><CountUp value={final}/></strong>
        </div>
      </div>
      {levelError && <p id="xp-level-error" className="xp-level-error" role="alert">{levelError}</p>}
      {picked.length > 0 && <p className="xp-hero-total" aria-label={`Total gained ${fmt(totalGain)} XP from ${picked.length} projects`}><b>+{fmt(totalGain)} XP</b><span>from {picked.length} {picked.length === 1 ? 'project' : 'projects'}</span></p>}
      {peers && scope && <Rank peers={peers} from={start} to={final} scope={scope}/>}
      <div className="xp-bar" role="img" aria-label={`${Math.round(final % 1 * 100)}% of the way to level ${Math.floor(final) + 1}`}><i style={{ width: `${final % 1 * 100}%` }}/></div>
    </div>

    {level === null && <p className="xp-note">Your level is not in the rankings yet, so this starts from level 0.</p>}
    {custom && <p className="xp-note">Custom plan from level {lvl(start)}. Each project adds its full XP.</p>}

    {(custom || coalition) && <section className="xp-panel xp-coalition" aria-label="Coalition">
      <h3>Coalition</h3>
      {coalition && <p className="xp-coalition-name"><i style={coalition.color ? { background: coalition.color } : undefined} aria-hidden="true"><CoalitionMark name={coalition.name}/></i><b>{coalition.name}</b><span>#{coalition.rank} of {coalition.total}</span></p>}
      <div className="xp-bonus">
        <Switch.Root id="xp-bonus" className="xp-switch" checked={boosted} onCheckedChange={setBoosted}><Switch.Thumb className="xp-switch-thumb"/></Switch.Root>
        <label htmlFor="xp-bonus">Coalition bonus</label>
        <span className="xp-bonus-field"><input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={percent} disabled={!boosted} onChange={(event) => setPercent(event.target.value)} aria-label="Coalition bonus in percent"/>%</span>
      </div>
    </section>}


    {upNext.length > 0 && <section className="xp-panel" aria-label="Up next">
      <h3>Up next</h3>
      <div className="xp-chips">{upNext.map((project) => <button key={project.slug} type="button" className="xp-chip" onClick={() => add(project.slug)}>
        <Plus size={13}/>{project.name}<small>{fmt(project.xp)} XP</small>
      </button>)}</div>
    </section>}

    {picked.length > 0 && <section className="xp-panel" aria-label="Level path">
      <h3>Level path</h3>
      <ol className="xp-path">
        <li className="is-start"><i aria-hidden="true"/><span><b>{custom ? 'Start' : 'Now'}</b></span><strong>{lvl(start)}</strong></li>
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
      <ProjectPicker projects={view === 'core' ? core : advanced} view={view} onView={setView} done={done} other={other} taken={taken} onPick={add}/>
      {/* Newest card on top; `picked` stays in added order because the levels chain through it and the colours follow it. */}
      {picked.length > 0 && <ol className="xp-steps">{picked.map((item, index) => {
        const project = bySlug.get(item.slug)!, doneMark = done[item.slug];
        return <li key={item.slug} className="xp-step">
          <MarkCard tone={TONES[index % TONES.length]} name={project.name} gain={steps[index]?.gain ?? 0} coalition={boosted && bonus > 0 ? { on: item.boost, percent: bonus, onToggle: () => toggleBoost(item.slug) } : null} doneMark={doneMark} mark={item.mark} onChange={(value) => update(item.slug, value)} onRemove={() => setPicked((items) => items.filter((other) => other.slug !== item.slug))}/>
        </li>;
      }).reverse()}</ol>}
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
function MarkCard({ tone, name, gain, coalition, doneMark, mark, onChange, onRemove }: { tone: typeof TONES[number]; name: string; gain: number; coalition: { on: boolean; percent: number; onToggle: () => void } | null; doneMark?: number; mark: number; onChange: (mark: number) => void; onRemove: () => void }) {
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
      <div className="xp-mark-title"><strong>{name}</strong>{doneMark !== undefined && <small>Validated at {doneMark}</small>}<em className="xp-mark-gain" aria-label={`Gains ${fmt(gain)} XP`}>+{fmt(gain)} XP</em></div>
      <div className="xp-mark-value" aria-hidden="true"><b>{mark}</b><small>{mark > 100 ? 'bonus' : mark === 100 ? 'full' : 'mark'}</small></div>
    </div>
    <div className="xp-mark-tools">
      <span className="xp-mark-hint">Drag to set the mark</span>
      <div className="xp-presets" role="group" aria-label={`Quick marks for ${name}`}>
        {coalition && <button type="button" {...own} className={cn('xp-coal', coalition.on && 'is-on')} aria-pressed={coalition.on} aria-label={`Coalition bonus for ${name}`} onClick={coalition.onToggle}>{coalition.on ? <Check size={13} weight="bold"/> : <X size={13} weight="bold"/>}+{Number(coalition.percent.toFixed(1))}%</button>}
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

/**
 * Searchable project list in a popover (full screen on phones): next projects first, then validated ones to improve,
 * then skipped alternatives. The curriculum tabs switch the list in place; `undefined` projects are still loading.
 * Touch screens keep focus off the search box, so opening the list does not pull up the keyboard over it.
 */
function ProjectPicker({ projects, view, onView, done, other, taken, onPick }: { projects: XpOption[] | null | undefined; view: XpView; onView: (view: XpView) => void; done: Record<string, number>; other: Set<string>; taken: Set<string>; onPick: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const shown = (projects ?? []).filter((project) => !taken.has(project.slug) && (!q || matchesSearch(q, [project.name, project.slug])));
  const groups = [
    { label: 'Not validated yet', items: shown.filter((project) => done[project.slug] === undefined && !other.has(project.slug)) },
    { label: 'Validated · improve your mark', items: shown.filter((project) => done[project.slug] !== undefined) },
    { label: 'Other options', items: shown.filter((project) => other.has(project.slug)) },
  ].filter((group) => group.items.length);
  const pick = (slug: string) => { onPick(slug); setOpen(false); setQ(''); };

  return <Popover modal open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQ(''); }}>
    <PopoverTrigger asChild><button type="button" className="xp-add"><Plus size={16}/>Add a project</button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} className="xp-picker" onOpenAutoFocus={(event) => { event.preventDefault(); (matchMedia('(pointer: fine)').matches ? input.current : event.target as HTMLElement)?.focus(); }}>
      <div className="xp-picker-head">
      <div className="xp-picker-top">
        <div className="xp-picker-search">
          <Search size={16}/>
          <input ref={input} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search a project" aria-label="Search a project"
            onKeyDown={(event) => { if (event.key === 'Enter' && groups[0]?.items[0]) { event.preventDefault(); pick(groups[0].items[0].slug); } }}/>
        </div>
        <button type="button" className="xp-picker-close" onClick={() => { setOpen(false); setQ(''); }} aria-label="Close"><X size={18}/></button>
      </div>
      <XpViewTabs view={view} onChange={onView}/>
      </div>
      <div className="xp-picker-list" role="listbox" aria-label="Projects">
        {projects === undefined ? <p className="xp-picker-empty is-loading">Loading the Advanced projects…</p>
          : projects === null ? <p className="xp-picker-empty">These projects are unavailable right now. Try again in a minute.</p>
          : !groups.length ? <p className="xp-picker-empty">{q ? <>No project matches “{q}”.</> : 'No project left to add.'}</p> : groups.map((group) => <div key={group.label} role="group" aria-label={group.label}>
          <p className="xp-picker-label">{group.label}</p>
          {group.items.map((project) => <button key={project.slug} type="button" role="option" aria-selected={false} className="xp-option" onClick={() => pick(project.slug)}>
            <span className="xp-option-circle">{project.tag}</span>
            <span className="xp-option-name">{project.name}</span>
            {done[project.slug] !== undefined && <span className="xp-option-done"><Check size={12}/>{done[project.slug]}</span>}
            <span className="xp-option-xp">{fmt(project.xp)} XP</span>
          </button>)}
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}
