'use client';

/** Look-and-feel settings shared by the Tweaks panel and the navbar theme toggle; saved per browser. */
export const surfaces = [
  { key: 'black', label: 'Black', tones: null },
  { key: 'charcoal', label: 'Charcoal', tones: { bg: '#121212', card: '#1a1a1a', raise: '#242424', hover: '#2e2e2e' } },
  { key: 'midnight', label: 'Midnight', tones: { bg: '#060a14', card: '#0e1424', raise: '#172036', hover: '#1f2a44' } },
  { key: 'forest', label: 'Forest', tones: { bg: '#040b07', card: '#0c1a12', raise: '#13261b', hover: '#1b3324' } },
  { key: 'plum', label: 'Plum', tones: { bg: '#0b0710', card: '#161021', raise: '#21182e', hover: '#2b203b' } },
  { key: 'light', label: 'Light', tones: { bg: '#f3f3f1', card: '#ffffff', raise: '#ececea', hover: '#e2e2df' } },
] as const;
export const accents = [
  { key: 'mint', label: 'Mint', color: null, swatch: '#cafbd2' },
  { key: 'lime', label: 'Lime', color: '#d9f99d', swatch: '#d9f99d' },
  { key: 'sky', label: 'Sky', color: '#bfe3ff', swatch: '#bfe3ff' },
  { key: 'lilac', label: 'Lilac', color: '#e6ccff', swatch: '#e6ccff' },
  { key: 'peach', label: 'Peach', color: '#ffd6bf', swatch: '#ffd6bf' },
  { key: 'lemon', label: 'Lemon', color: '#fff3a3', swatch: '#fff3a3' },
] as const;
export const radii = [
  { key: 'sharp', label: 'Sharp', scale: .4 },
  { key: 'soft', label: 'Soft', scale: .7 },
  { key: 'default', label: 'Default', scale: null },
  { key: 'round', label: 'Round', scale: 1.35 },
] as const;

export type Settings = { surface: string; accent: string; radius: string; lastDark?: string };
export const DEFAULTS: Settings = { surface: 'black', accent: 'mint', radius: 'round' };
// Start fresh after retiring the experimental production preferences.
const STORAGE_KEY = 'elite-tweaks-v2';
// Dark and Round became the defaults: saved settings from before still hold the old defaults, so drop those two once.
const RADIUS_KEY = 'elite-tweaks-radius-v3';

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function apply(settings: Settings) {
  const root = document.documentElement;
  root.classList.toggle('dark', settings.surface !== 'light');
  const surface = surfaces.find((item) => item.key === settings.surface)?.tones;
  const accent = accents.find((item) => item.key === settings.accent)?.color;
  const radius = radii.find((item) => item.key === settings.radius)?.scale;
  if (settings.surface === 'light') root.dataset.twLight = ''; else delete root.dataset.twLight;
  if (surface) { root.dataset.twSurface = settings.surface; for (const [name, value] of Object.entries(surface)) root.style.setProperty(`--tw-${name}`, value); }
  else { delete root.dataset.twSurface; for (const name of ['bg', 'card', 'raise', 'hover']) root.style.removeProperty(`--tw-${name}`); }
  if (accent) { root.dataset.twAccent = settings.accent; root.style.setProperty('--tw-accent', accent); }
  else { delete root.dataset.twAccent; root.style.removeProperty('--tw-accent'); }
  if (radius) { root.dataset.twRadius = settings.radius; root.style.setProperty('--tw-r', String(radius)); }
  else { delete root.dataset.twRadius; root.style.removeProperty('--tw-r'); }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null;
    if (saved && !localStorage.getItem(RADIUS_KEY)) { delete saved.radius; delete saved.surface; }
    localStorage.setItem(RADIUS_KEY, '1');
    if (saved) current = { ...DEFAULTS, ...saved };
  } catch { /* storage unavailable: keep defaults */ }
  apply(current);
}

export function getSettings() { load(); return current; }
export const getServerSettings = () => DEFAULTS;
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function setSettings(change: Partial<Settings> | ((settings: Settings) => Partial<Settings>)) {
  load();
  current = { ...current, ...(typeof change === 'function' ? change(current) : change) };
  apply(current);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach((listener) => listener());
}

export function resetSettings() { setSettings({ ...DEFAULTS, lastDark: undefined }); }

/** Light ↔ the dark surface used before switching to light. */
export function toggleLight() {
  setSettings((settings) => settings.surface === 'light'
    ? { surface: settings.lastDark && settings.lastDark !== 'light' ? settings.lastDark : 'black' }
    : { surface: 'light', lastDark: settings.surface });
}
