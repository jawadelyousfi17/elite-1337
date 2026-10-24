'use client';

import { useSyncExternalStore } from 'react';
import { Popover } from 'radix-ui';
import { RotateCcw, SlidersHorizontal, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { accents, DEFAULTS, getServerSettings, getSettings, radii, resetSettings, setSettings, subscribe, surfaces } from '@/lib/tweaks-store';

export function Tweaks() {
  const settings = useSyncExternalStore(subscribe, getSettings, getServerSettings);
  const set = setSettings;
  const changed = settings.surface !== DEFAULTS.surface || settings.accent !== DEFAULTS.accent || settings.radius !== DEFAULTS.radius;

  return <Popover.Root>
    <Popover.Trigger className="tw-trigger" aria-label="Tweaks"><SlidersHorizontal size={20}/>{changed && <i className="tw-dot" aria-hidden="true"/>}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="tw-panel" side="top" align="end" sideOffset={12} collisionPadding={16} aria-label="Tweaks">
        <header><strong>Tweaks</strong><span className="tw-badge">Experiment</span><Popover.Close className="tw-close" aria-label="Close"><X size={15}/></Popover.Close></header>

        <fieldset><legend>Theme</legend>
          <div className="tw-surfaces">{surfaces.map((item) => {
            const tones = item.tones ?? { bg: '#000', card: '#141414', raise: '#202020', hover: '#2b2b2b' };
            return <button key={item.key} type="button" aria-pressed={settings.surface === item.key} onClick={() => set({ surface: item.key })}>
              <span className="tw-surface-preview" style={{ background: tones.bg }} aria-hidden="true"><i style={{ background: tones.card }}/><i style={{ background: tones.raise }}/></span>{item.label}
            </button>;
          })}</div>
        </fieldset>

        <fieldset><legend>Accent</legend>
          <div className="tw-accents">{accents.map((item) => <button key={item.key} type="button" aria-pressed={settings.accent === item.key} onClick={() => set({ accent: item.key })} title={item.label} aria-label={item.label} style={{ background: item.swatch }}/>)}</div>
        </fieldset>

        <fieldset><legend>Corner radius</legend>
          <div className="tw-radii">{radii.map((item) => <button key={item.key} type="button" aria-pressed={settings.radius === item.key} onClick={() => set({ radius: item.key })}>
            <span className="tw-radius-preview" style={{ borderTopLeftRadius: `${14 * (item.scale ?? 1)}px` }} aria-hidden="true"/>{item.label}
          </button>)}</div>
        </fieldset>

        <button type="button" className={cn('tw-reset', !changed && 'is-idle')} disabled={!changed} onClick={resetSettings}><RotateCcw size={14}/>Reset to default</button>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
