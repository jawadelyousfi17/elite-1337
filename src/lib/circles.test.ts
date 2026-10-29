import { describe, expect, it } from 'vitest';
import { circlesDone, trackOf } from './circles';
import type { Stop } from './journey';

const stop = (slug: string, day: number, passed = true): Stop => ({ project: slug, slug, exam: slug.startsWith('exam'), attempts: [{ at: new Date(Date.UTC(2025, 0, day)).toISOString(), passed, mark: passed ? 100 : 0 }], passed, pending: false, at: new Date(Date.UTC(2025, 0, day)).toISOString(), gapDays: 0 });

describe('circlesDone', () => {
  it('completes a circle on the day its last required project passes', () => {
    const done = circlesDone([stop('42cursus-libft', 1), stop('42cursus-ft_printf', 5), stop('born2beroot', 9), stop('42cursus-get_next_line', 7)]);
    expect(done.map((circle) => [circle.circle, circle.slug])).toEqual([[0, '42cursus-libft'], [1, 'born2beroot']]);
  });
  it('accepts any project of a choice group', () => {
    const base = [stop('42cursus-libft', 1), stop('42cursus-ft_printf', 2), stop('42cursus-get_next_line', 3), stop('born2beroot', 4)];
    const done = circlesDone([...base, stop('42cursus-fdf', 10), stop('42cursus-push_swap', 12), stop('minitalk', 11), stop('exam-rank-02', 13)]);
    expect(done.at(-1)).toMatchObject({ circle: 2, slug: 'exam-rank-02' });
  });
  it('stops at the first unfinished circle, even if later projects are done', () => {
    const done = circlesDone([stop('42cursus-libft', 1), stop('42cursus-ft_printf', 2), stop('42cursus-get_next_line', 3, false), stop('born2beroot', 4), stop('42cursus-minishell', 20)]);
    expect(done.map((circle) => circle.circle)).toEqual([0]);
  });
});

describe('trackOf', () => {
  it('puts students with a new-track project on the 2025 Common Core, even if they tried so_long', () => {
    expect(trackOf(['42cursus-libft', 'so_long', 'python-module-00'])).toBe('next');
  });
  it('keeps students with an old-only project on the old Common Core', () => {
    expect(trackOf(['42cursus-libft', 'so_long', 'exam-rank-02'], '2025-10-13T08:30:00Z')).toBe('core');
  });
  it('does not let late projects that both tracks may take decide the track', () => {
    expect(trackOf(['42cursus-libft', 'agent-smith'], '2024-10-21T09:13:00Z')).toBe('core');
  });
  it('uses the entry date while only shared projects are done', () => {
    expect(trackOf(['42cursus-libft'], '2025-10-13T08:30:00Z')).toBe('next');
    expect(trackOf(['42cursus-libft'], '2024-10-21T09:13:00Z')).toBe('core');
  });
});

describe('circlesDone on the 2025 track', () => {
  it('needs every Python module and the new exam for circle 2', () => {
    const base = [stop('42cursus-libft', 1), stop('42cursus-ft_printf', 2), stop('42cursus-get_next_line', 3), stop('born2beroot', 4), stop('42cursus-push_swap', 5), stop('a-maze-ing', 20)];
    const modules = Array.from({ length: 11 }, (_, i) => stop(`python-module-${String(i).padStart(2, '0')}`, 6 + i));
    expect(circlesDone([...base, ...modules]).map((circle) => circle.circle)).toEqual([0, 1]);
    expect(circlesDone([...base, ...modules, stop('42next-exam-rank-02', 22)]).at(-1)).toMatchObject({ circle: 2, slug: '42next-exam-rank-02' });
  });
});
