import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
const { GITHUB_LOGIN, cleanLogin, cleanText, githubLines, linesOf, parseCardText, summarizeRepos, textQuery, uptime } = await import('./github');
const { FULL, renderTerminalCard } = await import('./terminal-card');
const { TEXT_FIELDS } = await import('./github-input');

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
    const plain = flat(githubLines('ada', all, profile, Date.UTC(2026, 10, 9)));
    expect(plain.at(-1)).toBe('// x');
    const busy = flat(githubLines('ada', all, profile, Date.UTC(2026, 10, 9), { commits: 1234, added: 1545, removed: 485 }));
    expect(busy).toHaveLength(24);
    expect(busy.at(-1)).toBe('// x');
    expect(busy.some((row) => row.includes('█'))).toBe(false);
  });
  it('shows commits, and lines added and removed only when they are known', () => {
    const rows = (activity: Parameters<typeof githubLines>[4]) => flat(githubLines('ada', {}, profile, Date.UTC(2026, 10, 9), activity));
    const full = rows({ commits: 2116, added: 1545, removed: 485 });
    expect(full.some((row) => row.includes('Commits') && row.includes('2,116'))).toBe(true);
    const lines = full.find((row) => row.includes('Lines of code'))!;
    expect(lines).toContain('+1,545 -485');
    expect(lines.length).toBe(66);
    const noLines = rows({ commits: 5, added: null, removed: null });
    expect(noLines.some((row) => row.includes('Commits'))).toBe(true);
    expect(noLines.some((row) => row.includes('Lines of code'))).toBe(false);
    expect(rows(null).some((row) => row.includes('Commits'))).toBe(false);
  });
  it('sums only the user\'s own weeks from contributor statistics', () => {
    const stats = [
      { author: { login: 'Ada' }, weeks: [{ a: 10, d: 2 }, { a: 5, d: 1 }] },
      { author: { login: 'bob' }, weeks: [{ a: 99, d: 99 }] },
      { author: null, weeks: [{ a: 7, d: 7 }] },
    ];
    expect(linesOf(stats, 'ada')).toEqual({ added: 15, removed: 3 });
    expect(linesOf(stats, 'nobody')).toEqual({ added: 0, removed: 0 });
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
    expect(renderTerminalCard('x', githubLines('ada', Object.fromEntries(Object.keys(TEXT_FIELDS).map((key) => [key, 'x'])), profile), 'dark', null, {}, FULL)).toContain('height="552"');
  });
});
