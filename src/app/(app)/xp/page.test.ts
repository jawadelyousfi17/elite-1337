import * as React from 'react';
import type { ComponentProps, ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import XpPage from './page';
import { XpCalculator } from '@/components/xp-calculator';
import { XpFor } from '@/components/xp-for';
import { requireStudent } from '@/lib/guard';
import { loadRankingDataset } from '@/lib/dataset';
import { loadJourney } from '@/lib/journey';
import { loadOwnCoalition } from '@/lib/coalitions';
import { loadAdvancedProjects, loadXpProjects } from '@/lib/xp';
import { chainLevels } from '@/lib/xp-math';
import type { StudentRank } from '@/lib/ranking';

vi.mock('@/components/xp-calculator', () => ({ XpCalculator: () => null }));
vi.mock('@/components/xp-for', () => ({ XpFor: () => null }));
vi.mock('@/lib/guard', () => ({ requireStudent: vi.fn() }));
vi.mock('@/lib/dataset', () => ({ loadRankingDataset: vi.fn(), campusName: () => 'Khouribga' }));
vi.mock('@/lib/journey', () => ({ loadJourney: vi.fn() }));
vi.mock('@/lib/coalitions', () => ({ loadOwnCoalition: vi.fn() }));
vi.mock('@/lib/xp', () => ({ loadAdvancedProjects: vi.fn(), loadXpProjects: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

const student = (id: number, login: string, level: number): StudentRank => ({ id, login, level, displayName: null, poolYear: '2018', poolMonth: 'july', commonCoreCohort: '2019-10', campusIds: [16], globalRank: 1, campusRanks: { 16: 1 } });
const libft = { slug: '42cursus-libft', name: 'Libft', xp: 462, circle: 0 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('React', React);
  vi.mocked(requireStudent).mockResolvedValue({ id: '900000001', login: 'me' });
  vi.mocked(loadRankingDataset).mockResolvedValue({ status: 'ready', data: {
    students: [student(900000001, 'me', 6.5), student(900000002, 'other', 12.5)],
    blackholed: [], acceptedUserIds: [900000001, 900000002], campuses: [{ id: 16, name: 'Khouribga' }], fetchedAt: '2026-11-08T00:00:00Z', complete: true,
  } });
  vi.mocked(loadJourney).mockResolvedValue({ status: 'ready', journey: { start: '2019-10-01T00:00:00Z', fell: null, now: '2026-11-08T00:00:00Z', stops: [
    { project: 'Libft', slug: libft.slug, exam: false, passed: true, pending: false, at: '2019-10-10T00:00:00Z', gapDays: 9, attempts: [{ at: '2019-10-10T00:00:00Z', passed: true, mark: 100 }] },
  ] } });
  vi.mocked(loadOwnCoalition).mockResolvedValue({ id: 1, name: 'Fixture coalition', color: null, rank: 1, total: 4, score: 100 });
  vi.mocked(loadXpProjects).mockResolvedValue({ core: [libft, { slug: 'so_long', name: 'so_long', xp: 1000, circle: 2 }], next: [libft, { slug: 'codexion', name: 'Codexion', xp: 2000, circle: 3 }] });
  vi.mocked(loadAdvancedProjects).mockResolvedValue([{ slug: 'advanced-project', name: 'Advanced project', xp: 3000, campuses: [55] }]);
});
afterEach(() => { vi.unstubAllGlobals(); });

async function render(query: Record<string, string | string[] | undefined>) {
  const page = await XpPage({ searchParams: Promise.resolve(query) });
  const calculator = page.props.children[1] as ReactElement<ComponentProps<typeof XpCalculator>>;
  const picker = page.props.children[0].props.children[1] as ReactElement<ComponentProps<typeof XpFor>>;
  return { calculator, picker };
}

describe('XP calculator sources', () => {
  it('uses a custom level with full XP and no personal progress or extra profile reads', async () => {
    const { calculator, picker } = await render({ level: '10.89', user: 'other' });
    expect(calculator.key).toBe('custom');
    expect(calculator.props).toMatchObject({ level: 10.89, custom: true, done: {}, skipped: [], peers: null, scope: null, coalition: null });
    expect(picker.props).toMatchObject({ customLevel: 10.89, invalidLevel: false, viewing: null });
    expect(loadRankingDataset).not.toHaveBeenCalled();
    expect(loadJourney).not.toHaveBeenCalled();
    expect(loadOwnCoalition).not.toHaveBeenCalled();
    const project = calculator.props.core!.find((project) => project.slug === libft.slug)!;
    expect(chainLevels(calculator.props.level!, [{ xp: project.xp, mark: 100, doneMark: calculator.props.done[project.slug] }])[0].gain).toBe(462);
  });

  it('offers both Common Core tracks once and Advanced projects across campuses', async () => {
    const { calculator } = await render({ level: '10.89' });
    expect(calculator.props.core?.map((project) => project.slug)).toEqual(['42cursus-libft', 'so_long', 'codexion']);
    expect(await calculator.props.advanced).toMatchObject([{ slug: 'advanced-project' }]);
  });

  it('keeps a custom plan mounted when its starting level changes', async () => {
    const first = await render({ level: '10.89' }), second = await render({ level: '11.25' });
    expect(second.calculator.key).toBe(first.calculator.key);
    expect(second.calculator.props.level).toBe(11.25);
  });

  it.each(['', 'invalid', '-1', '30.01', ['10', '20']])('shows invalid custom URLs as level zero with an error: %s', async (level) => {
    const { calculator, picker } = await render({ level });
    expect(calculator.props).toMatchObject({ level: 0, custom: true, done: {} });
    expect(picker.props).toMatchObject({ customLevel: 0, invalidLevel: true });
    expect(loadJourney).not.toHaveBeenCalled();
  });

  it.each([['me', {}, 900000001, 6.5], ['other', { user: 'other' }, 900000002, 12.5]] as const)('preserves %s progress and coalition', async (_name, query, id, level) => {
    const { calculator, picker } = await render(query);
    expect(calculator.props).toMatchObject({ custom: false, level, done: { '42cursus-libft': 100 }, coalition: { rank: 1 } });
    expect(picker.props.customLevel).toBeNull();
    expect(loadJourney).toHaveBeenCalledWith(id);
    expect(loadOwnCoalition).toHaveBeenCalledWith(id, 16);
    expect(calculator.props.core?.map((project) => project.slug)).toEqual(['42cursus-libft', 'so_long']);
  });
});
