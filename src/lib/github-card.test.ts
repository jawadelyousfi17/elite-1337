import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
const { GITHUB_LOGIN, cleanLogin, cleanText, githubLines, parseCardText, summarizeRepos, textQuery, uptime } = await import('./github-card');
const { FULL, renderTerminalCard } = await import('./rank-card');
const { TEXT_FIELDS } = await import('./github-card-input');

describe('github card input', () => {
  it('accepts GitHub usernames only', () => {
    for (const ok of ['jawad', 'a-b', 'A1', 'x'.repeat(39)]) expect(GITHUB_LOGIN.test(ok)).toBe(true);
    for (const bad of ['', '-a', 'a-', 'a--b', 'a_b', 'x'.repeat(40), 'a/b', '../x']) expect(GITHUB_LOGIN.test(bad)).toBe(false);
  });
  it('turns a pasted profile link or @name into the username', () => {
    expect(cleanLogin(' @jawad ')).toBe('jawad');
    expect(cleanLogin('https://github.com/jawad/repos')).toBe('jawad');
  });
  it('strips control characters, collapses spaces and caps the length', () => {
    expect(cleanText('  a\n\tb‮  c ', 20)).toBe('a b c');
    expect(cleanText('x'.repeat(100), 10)).toBe('x'.repeat(10));
    expect(cleanText('   ', 10)).toBeUndefined();
  });
  it('reads only the known fields and round-trips through the link', () => {
    const text = parseCardText(new URLSearchParams('name=Ada&evil=1&stack=Go, Rust&fun=a%26b'));
    expect(text).toEqual({ name: 'Ada', stack: 'Go, Rust', fun: 'a&b' });
    expect(parseCardText(new URLSearchParams(textQuery(text).slice(1)))).toEqual(text);
  });
});

describe('github card content', () => {
  const repos = [
    { fork: false, stargazers_count: 5, language: 'TypeScript' }, { fork: false, stargazers_count: 2, language: 'TypeScript' },
    { fork: false, stargazers_count: 0, language: 'Go' }, { fork: true, stargazers_count: 900, language: 'C' }, { fork: false, stargazers_count: 1, language: null },
  ];
  it('ignores forks and ranks languages by repository count', () => {
    const { stars, languages } = summarizeRepos(repos);
    expect(stars).toBe(8);
    expect(languages.map((language) => language.name)).toEqual(['TypeScript', 'Go']);
    expect(languages[0].share).toBeCloseTo(2 / 3);
  });
  const profile = { login: 'ada', name: 'Ada L', bio: 'Maths', location: null, repos: 12, followers: 1, following: 3, createdAt: '2019-01-15T00:00:00Z', stars: 8, languages: [{ name: 'Go', share: 1 }] };
  const flat = (rows: ReturnType<typeof githubLines>) => rows.map((row) => row.map(([, part]) => part).join(''));
  it('counts the account age like an uptime', () => {
    expect(uptime('2019-01-15T00:00:00Z', Date.UTC(2026, 10, 9))).toBe('7 years, 9 months, 25 days');
    expect(uptime('2026-11-08T00:00:00Z', Date.UTC(2026, 10, 9))).toBe('1 day');
  });
  it('fills rows from the typed text and GitHub, and drops what is empty', () => {
    const rows = flat(githubLines('ada', { role: 'Compilers', now: 'a VM', email: 'a@b.dev' }, profile, Date.UTC(2026, 10, 9)));
    for (const wanted of ['Role', 'Compilers', 'Building', '- Contact', 'Email', 'Uptime', 'Languages.Programming', 'Go', 'Followers', 'Following', 'Repos', 'Stars']) expect(rows.some((row) => row.includes(wanted)), wanted).toBe(true);
    for (const missing of ['Discord', 'Hobbies', 'Location', 'IDE']) expect(rows.some((row) => row.includes(missing)), missing).toBe(false);
    expect(rows.length).toBeLessThanOrEqual(22);
  });
  it('keeps the fun fact line when every field is filled in', () => {
    const all = Object.fromEntries(Object.keys(TEXT_FIELDS).map((key) => [key, 'x'])) as Record<string, string>;
    const rows = flat(githubLines('ada', all, profile, Date.UTC(2026, 10, 9)));
    expect(rows).toHaveLength(22);
    expect(rows.at(-1)).toBe('// x');
  });
  it('keeps every row the same width so the columns line up', () => {
    const rows = flat(githubLines('ada', { os: 'Arch', host: 'Home', web: 'ada.dev' }, profile, Date.UTC(2026, 10, 9)));
    expect(rows.filter((row) => row.includes('Followers'))[0].length).toBe(66);
    expect(rows.filter((row) => row.startsWith('. OS'))[0].length).toBe(66);
  });
  it('still draws without GitHub data', () => {
    expect(flat(githubLines('ada', {}, null)).some((row) => row.includes('github.com/ada'))).toBe(true);
  });
  it('escapes typed text in the SVG', () => {
    const svg = renderTerminalCard('x', githubLines('ada', { fun: '<script>alert(1)</script>' }, null), 'auto', null, {}, FULL);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
  it('draws the 80s look: one phosphor color, and the CRT effects only when asked', () => {
    const rows = githubLines('ada', {}, null);
    const plain = renderTerminalCard('x', rows, 'phosphor', null, {}, FULL), crt = renderTerminalCard('x', rows, 'phosphor', null, { crt: true }, FULL);
    expect(plain).toContain('#39ff6a');
    expect(plain).not.toContain('feGaussianBlur');
    for (const part of ['feGaussianBlur', 'url(#sl)', 'class="cur k"', 'prefers-reduced-motion']) expect(crt).toContain(part);
    expect(crt).toContain('width="985" height="408"');
    expect(renderTerminalCard('x', githubLines('ada', Object.fromEntries(Object.keys(TEXT_FIELDS).map((key) => [key, 'x'])), profile), 'dark', null, {}, FULL)).toContain('height="530"');
  });
});
