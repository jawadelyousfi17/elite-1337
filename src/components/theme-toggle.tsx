'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from '@/components/icons';
import { getServerSettings, getSettings, subscribe, toggleLight } from '@/lib/tweaks-store';

/** Navbar light/dark switch; shares its setting with the Tweaks panel. */
export function ThemeToggle() {
  const light = useSyncExternalStore(subscribe, getSettings, getServerSettings).surface === 'light';
  return <button type="button" className="theme-toggle" onClick={toggleLight} aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} aria-pressed={light}>
    {light ? <Moon size={20}/> : <Sun size={20}/>}
  </button>;
}
