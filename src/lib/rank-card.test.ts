import { describe, expect, it } from 'vitest';
import type { RankingDataset } from './dataset';
import type { StudentRank } from './ranking';
import { ART_COLS, ART_ROWS } from './card-art';
import { cardData, renderPendingCard, renderRankCard, type CardData } from './rank-card';

const student = (id: number, login: string, level: number, extra: Partial<StudentRank> = {}): StudentRank => ({ id, login, displayName: null, poolYear: null, poolMonth: null, commonCoreCohort: '2024', level, campusIds: [16], globalRank: id, campusRanks: { 16: id }, ...extra });
const dataset = (students: StudentRank[]) => ({ students, blackholed: [], acceptedUserIds: [], campuses: [{ id: 16, name: 'Khouribga' }], fetchedAt: '', complete: true }) as RankingDataset;
const data: CardData = { login: 'jel-yous', level: 7.42, campus: 'Khouribga', cohort: '2024', cohortRank: 12, cohortSize: 280, campusRank: 34, campusSize: 900, globalRank: 210, globalSize: 3000, status: null, photo: null };

describe('cardData', () => {
  const set = dataset([student(1, 'a', 9), student(2, 'b', 8, { commonCoreCohort: '2023' }), student(3, 'c', 7, { frozen: true }), student(-1, 'Anonymous', 6, { anonymous: true })]);
  it('reads ranks and size for the student', () => {
    expect(cardData(set, 3)).toMatchObject({ login: 'c', campus: 'Khouribga', cohort: '2024', cohortRank: 2, cohortSize: 3, globalRank: 3, status: 'frozen' });
  });
  it('gives nothing for unknown or anonymized students', () => {
    expect(cardData(set, 99)).toBeNull();
    expect(cardData(set, -1)).toBeNull();
  });
});

describe('renderRankCard', () => {
  it('shows the student numbers in a valid, self-contained SVG', () => {
    const svg = renderRankCard(data);
    expect(svg.startsWith('<svg')).toBe(true);
    for (const text of ['jel-yous@elite-1337', 'Khouribga', '2024', '7.42', '#12 of 280 · top 5%', '#34 of 900', '#210 of 3000', 'Active']) expect(svg).toContain(text);
    expect(svg).not.toMatch(/<image|<script|href=|@import|url\(/);
  });
  it('draws the photo as text, light ink on dark and the reverse on light, and a silhouette without a photo', () => {
    const luma = new Uint8Array(ART_COLS * ART_ROWS).fill(255);
    const dark = renderRankCard(data, 'dark', luma), light = renderRankCard(data, 'light', luma);
    expect(dark).toContain('@@@@@');
    expect(dark).not.toContain('class="art-l"');
    expect(light).not.toContain('@@@@@');
    expect(light).toContain('class="art-l"');
    expect(renderRankCard(data, 'dark')).toContain('class="art"');
    expect(renderRankCard(data)).toContain('class="art-d"');
  });
  it('escapes anything that came from outside', () => {
    const svg = renderRankCard({ ...data, login: '<b>"x"&', campus: '</text><script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;b&gt;&quot;x&quot;&amp;');
  });
  it('follows the viewer theme unless one is forced', () => {
    expect(renderRankCard(data)).toContain('prefers-color-scheme: light');
    expect(renderRankCard(data, 'dark')).not.toContain('prefers-color-scheme');
    expect(renderRankCard(data, 'light')).toContain('.bg{fill:#fff');
  });
  it('shows a dash for missing ranks and the status of frozen and alumni students', () => {
    const svg = renderRankCard({ ...data, cohortRank: null, campusRank: null, status: 'alumni' });
    expect(svg).toContain('class="v">—<');
    expect(svg).toContain('Alumni');
    expect(renderRankCard({ ...data, status: 'frozen' })).toContain('Frozen');
  });
  it('keeps every value inside its line even with a very long campus name', () => {
    expect(renderRankCard({ ...data, campus: 'x'.repeat(200) })).toContain('…');
  });
  it('has a pending card that is also plain SVG', () => {
    expect(renderPendingCard()).toContain('Rankings are updating');
  });
});

describe('card tweaks', () => {
  it('draws each theme on its own surface, and the dark ones keep light ink', () => {
    expect(renderRankCard(data, 'black')).toContain('.bg{fill:#000;');
    expect(renderRankCard(data, 'midnight')).toContain('.bg{fill:#0f172a;');
    expect(renderRankCard(data, 'forest')).toContain('.bg{fill:#0f1d17;');
    expect(renderRankCard(data, 'plum')).toContain('.bg{fill:#1c1222;');
    const plum = renderRankCard(data, 'plum');
    expect(plum).toContain('class="art-d"');
    expect(plum).not.toContain('prefers-color-scheme');
    expect(renderRankCard(data, 'light')).toContain('class="art-l"');
  });
  it('colours the keys with the accent, brighter on dark cards and deeper on the light one', () => {
    expect(renderRankCard(data, 'dark', null, { accent: 'mint' })).toContain('.k{fill:#cafbd2}');
    expect(renderRankCard(data, 'light', null, { accent: 'mint' })).toContain('.k{fill:#0f7b48}');
    const auto = renderRankCard(data, 'auto', null, { accent: 'sky' });
    expect(auto).toContain('.k{fill:#8fd3ff}');
    expect(auto).toContain('.k{fill:#0b6bb0}');
  });
  it('uses the chosen monospace font', () => {
    expect(renderRankCard(data, 'dark', null, { font: 'courier' })).toContain("font-family=\"'Courier New',Courier");
    expect(renderRankCard(data, 'dark')).toContain('font-family="ui-monospace');
  });
  it('can draw the portrait with blocks and hide the logo', () => {
    const bright = new Uint8Array(ART_COLS * ART_ROWS).fill(255);
    expect(renderRankCard(data, 'dark', bright, { art: 'blocks' })).toContain('█████');
    expect(renderRankCard(data, 'dark', bright)).not.toContain('█████');
    expect(renderRankCard(data, 'dark')).toContain('class="lg"');
    expect(renderRankCard(data, 'dark', null, { logo: false })).not.toContain('class="lg"');
  });
});

