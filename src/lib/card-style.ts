/** The look of a rank card. Choices travel in the card link (`&theme=…`), so nothing about them is stored. */
export const THEMES = ['auto', 'dark', 'light', 'black', 'midnight', 'forest', 'plum'] as const;
export const ACCENTS = ['lilac', 'mint', 'lime', 'sky', 'peach', 'lemon'] as const;
export const FONTS = ['system', 'courier', 'menlo', 'lucida'] as const;
export const ARTS = ['ascii', 'blocks'] as const;
export type CardTheme = (typeof THEMES)[number];
export type CardAccent = (typeof ACCENTS)[number];
export type CardFont = (typeof FONTS)[number];
export type CardArt = (typeof ARTS)[number];
export type CardStyle = { theme: CardTheme; accent: CardAccent; font: CardFont; art: CardArt; logo: boolean };

export const DEFAULT_STYLE: CardStyle = { theme: 'auto', accent: 'lilac', font: 'system', art: 'ascii', logo: true };

/** Each accent has a bright variant for dark cards and a deeper one for the light card, like the site's Tweaks. */
export const ACCENT_COLORS: Record<CardAccent, { dark: string; light: string }> = {
  lilac: { dark: '#d2a8ff', light: '#8250df' },
  mint: { dark: '#cafbd2', light: '#0f7b48' },
  lime: { dark: '#d4f26a', light: '#587d00' },
  sky: { dark: '#8fd3ff', light: '#0b6bb0' },
  peach: { dark: '#ffc4a3', light: '#c2561f' },
  lemon: { dark: '#f6e27a', light: '#8a6d00' },
};
/** Monospace stacks only: the portrait and the columns rely on equal-width letters. */
export const FONT_STACKS: Record<CardFont, string> = {
  system: "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace",
  courier: "'Courier New',Courier,'Liberation Mono',monospace",
  menlo: "Menlo,Monaco,'DejaVu Sans Mono',Consolas,monospace",
  lucida: "'Lucida Console','Lucida Sans Typewriter',Monaco,'DejaVu Sans Mono',monospace",
};
export const FONT_LABELS: Record<CardFont, string> = { system: 'System', courier: 'Courier', menlo: 'Menlo', lucida: 'Lucida' };
export const THEME_LABELS: Record<CardTheme, string> = { auto: 'Auto', dark: 'Dark', light: 'Light', black: 'Black', midnight: 'Midnight', forest: 'Forest', plum: 'Plum' };

const pick = <T extends string>(options: readonly T[], value: string | null | undefined, fallback: T): T => options.find((option) => option === value) ?? fallback;

/** Reads the look from a link's query string; anything unknown falls back to the default, so a link can never break the card. */
export function parseCardStyle(params: URLSearchParams): CardStyle {
  return {
    theme: pick(THEMES, params.get('theme'), DEFAULT_STYLE.theme), accent: pick(ACCENTS, params.get('accent'), DEFAULT_STYLE.accent),
    font: pick(FONTS, params.get('font'), DEFAULT_STYLE.font), art: pick(ARTS, params.get('art'), DEFAULT_STYLE.art),
    logo: params.get('logo') !== '0',
  };
}

/** The query suffix for a look: only what differs from the default, so a default card keeps the shortest link. */
export function styleQuery(style: CardStyle): string {
  const parts: string[] = [];
  if (style.theme !== DEFAULT_STYLE.theme) parts.push(`theme=${style.theme}`);
  if (style.accent !== DEFAULT_STYLE.accent) parts.push(`accent=${style.accent}`);
  if (style.font !== DEFAULT_STYLE.font) parts.push(`font=${style.font}`);
  if (style.art !== DEFAULT_STYLE.art) parts.push(`art=${style.art}`);
  if (!style.logo) parts.push('logo=0');
  return parts.length ? `&${parts.join('&')}` : '';
}
