import { describe, expect, it } from 'vitest';
import type { RankingDataset } from './dataset';
import type { StudentRank } from './ranking';
import { cardData, renderPendingCard, renderRankCard, type CardData } from './rank-card';

const student = (id: number, login: string, level: number, extra: Partial<StudentRank> = {}): StudentRank => ({ id, login, displayName: null, poolYear: null, poolMonth: null, commonCoreCohort: '2024', level, campusIds: [16], globalRank: id, campusRanks: { 16: id }, ...extra });
const dataset = (students: StudentRank[]) => ({ students, blackholed: [], acceptedUserIds: [], campuses: [{ id: 16, name: 'Khouribga' }], fetchedAt: '', complete: true }) as RankingDataset;
const data: CardData = { login: 'jel-yous', level: 7.42, campus: 'Khouribga', cohort: '2024', cohortRank: 12, cohortSize: 280, campusRank: 34, globalRank: 210, globalSize: 900, status: null };

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
    for (const text of ['jel-yous', '#12', '7.42', '#34', '#210', 'Khouribga', 'Cohort 2024', 'of 280']) expect(svg).toContain(text);
    expect(svg).not.toMatch(/<image|<script|href=|@import|url\(/);
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
  it('shows a dash for a missing rank and the status badge', () => {
    const svg = renderRankCard({ ...data, cohortRank: null, campusRank: null, status: 'alumni' });
    expect(svg).toContain('>—<');
    expect(svg).toContain('ALUMNI');
  });
  it('has a pending card that is also plain SVG', () => {
    expect(renderPendingCard()).toContain('Rankings are updating');
  });
});
