import { describe, expect, it } from 'vitest';
import { circlesDone } from './circles';
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
