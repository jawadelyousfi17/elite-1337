'use client';

import { Palette, Picture, Sun, TextAa } from '@/components/icons';
import { ACCENTS, ACCENT_COLORS, ARTS, FONTS, FONT_LABELS, THEMES, THEME_LABELS, type CardStyle } from '@/lib/card-style';
import { cn } from '@/lib/utils';

/** Theme, color, font and picture style for a card: shared by the rank card and the GitHub card pages. */
export function CardTweaks({ style, onChange }: { style: CardStyle; onChange: <K extends keyof CardStyle>(key: K, value: CardStyle[K]) => void }) {
  return <div className="pl-groups cd-tweaks">
    <div className="pl-chip-group" role="group" aria-label="Theme"><span className="pl-chip-label"><Sun size={17}/>Theme</span>
      <div className="pl-chips">{THEMES.map((id) => <button key={id} type="button" className="pl-chip is-mint" data-active={style.theme === id || undefined} aria-pressed={style.theme === id} onClick={() => onChange('theme', id)}>{THEME_LABELS[id]}</button>)}</div></div>
    <div className="pl-chip-group" role="group" aria-label="Color"><span className="pl-chip-label"><Palette size={17}/>Color</span>
      <div className="pl-chips">{ACCENTS.map((id) => <button key={id} type="button" className={cn('cd-swatch', style.accent === id && 'is-active')} style={{ '--swatch': ACCENT_COLORS[id].dark } as React.CSSProperties} aria-pressed={style.accent === id} aria-label={id} title={id} onClick={() => onChange('accent', id)}/>)}</div></div>
    <div className="pl-chip-group" role="group" aria-label="Font"><span className="pl-chip-label"><TextAa size={17}/>Font</span>
      <div className="pl-chips">{FONTS.map((id) => <button key={id} type="button" className="pl-chip is-mint" data-active={style.font === id || undefined} aria-pressed={style.font === id} onClick={() => onChange('font', id)}>{FONT_LABELS[id]}</button>)}</div></div>
    <div className="pl-chip-group" role="group" aria-label="Picture style"><span className="pl-chip-label"><Picture size={17}/>Picture style</span>
      <div className="pl-chips">{ARTS.map((id) => <button key={id} type="button" className="pl-chip is-mint" data-active={style.art === id || undefined} aria-pressed={style.art === id} onClick={() => onChange('art', id)}>{id === 'ascii' ? 'ASCII' : 'Blocks'}</button>)}
        <button type="button" className="pl-chip is-mint" data-active={style.logo || undefined} aria-pressed={style.logo} onClick={() => onChange('logo', !style.logo)}>1337 logo</button>
        <button type="button" className="pl-chip is-mint" data-active={style.crt || undefined} aria-pressed={style.crt} onClick={() => onChange('crt', !style.crt)}>CRT effect</button></div></div>
  </div>;
}
