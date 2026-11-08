import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, parseCardStyle, styleQuery, type CardStyle } from './card-style';

const parse = (query: string) => parseCardStyle(new URLSearchParams(query));

describe('parseCardStyle', () => {
  it('uses the default look for an empty or unrelated link', () => {
    expect(parse('')).toEqual(DEFAULT_STYLE);
    expect(parse('t=abc&v=3')).toEqual(DEFAULT_STYLE);
  });
  it('reads every choice', () => {
    expect(parse('theme=forest&accent=sky&font=courier&art=blocks&logo=0')).toEqual({ theme: 'forest', accent: 'sky', font: 'courier', art: 'blocks', logo: false });
  });
  it('falls back to the default for unknown or hostile values', () => {
    expect(parse('theme=neon&accent=%3Cscript%3E&font=comic&art=emoji')).toEqual(DEFAULT_STYLE);
    expect(parse('theme=__proto__&font=constructor')).toEqual(DEFAULT_STYLE);
    expect(parse('logo=false').logo).toBe(true);
  });
});

describe('styleQuery', () => {
  it('is empty for the default look and lists only what changed otherwise', () => {
    expect(styleQuery(DEFAULT_STYLE)).toBe('');
    expect(styleQuery({ ...DEFAULT_STYLE, theme: 'plum', logo: false })).toBe('&theme=plum&logo=0');
  });
  it('round-trips through parseCardStyle', () => {
    const style: CardStyle = { theme: 'midnight', accent: 'peach', font: 'lucida', art: 'blocks', logo: false };
    expect(parse(styleQuery(style).slice(1))).toEqual(style);
  });
});
