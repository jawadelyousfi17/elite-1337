/** The pure part of the GitHub card (username and typed text), safe to import from browser code. */
/** GitHub's own rule for usernames: letters, digits and single hyphens, up to 39 characters. */
export const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const cleanLogin = (value: string) => value.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');

/** What the visitor types onto their card. Every field is optional and short; nothing is stored, it all travels in the image link. */
export const TEXT_FIELDS = { name: 24, os: 34, host: 34, role: 34, ide: 34, loc: 30, stack: 44, spoken: 30, hobbies: 44, now: 36, email: 38, web: 38, linkedin: 34, discord: 30, x: 24, fun: 60 } as const;
export type CardText = { -readonly [K in keyof typeof TEXT_FIELDS]?: string };

const UNSAFE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g');
/** Control characters out, spaces collapsed, length capped: card text can never break the SVG or grow without limit. */
export function cleanText(value: string | null | undefined, max: number): string | undefined {
  const text = (value ?? '').replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return text || undefined;
}
export function parseCardText(params: URLSearchParams): CardText {
  const text: CardText = {};
  for (const [key, max] of Object.entries(TEXT_FIELDS) as [keyof CardText, number][]) { const value = cleanText(params.get(key), max); if (value) text[key] = value; }
  return text;
}
/** The query suffix for the typed text, in a fixed order so the same card always has the same link. */
export function textQuery(text: CardText): string {
  return (Object.keys(TEXT_FIELDS) as (keyof CardText)[]).filter((key) => text[key]).map((key) => `&${key}=${encodeURIComponent(text[key]!)}`).join('');
}
