import type { Stop } from './journey';

/**
 * Common Core circles. A circle is done once every group in it has one passed project
 * (a group lists alternatives, e.g. so_long, FdF or fract-ol).
 */
export const CIRCLES: string[][][] = [
  [['42cursus-libft']],
  [['42cursus-ft_printf'], ['42cursus-get_next_line'], ['born2beroot']],
  [['so_long', '42cursus-fdf', '42cursus-fract-ol'], ['42cursus-push_swap'], ['pipex', 'minitalk'], ['exam-rank-02']],
  [['42cursus-minishell'], ['42cursus-philosophers'], ['exam-rank-03']],
  [['netpractice'], ['cub3d', 'minirt'], ['cpp-module-00'], ['cpp-module-01'], ['cpp-module-02'], ['cpp-module-03'], ['cpp-module-04'], ['exam-rank-04']],
  [['inception'], ['ft_irc', 'webserv'], ['cpp-module-05'], ['cpp-module-06'], ['cpp-module-07'], ['cpp-module-08'], ['cpp-module-09'], ['exam-rank-05']],
  [['ft_transcendence'], ['exam-rank-06']],
];

export type CircleDone = { circle: number; at: string; slug: string };

/** Circles completed, each with the date and the project whose pass completed it; stops at the first unfinished circle. */
export function circlesDone(stops: Stop[]): CircleDone[] {
  const passed = new Map<string, string>();
  for (const stop of stops) if (stop.passed) passed.set(stop.slug, stop.at);
  const done: CircleDone[] = [];
  for (const [circle, groups] of CIRCLES.entries()) {
    let latest: { at: string; slug: string } | null = null;
    for (const group of groups) {
      const first = group.map((slug) => passed.has(slug) ? { slug, at: passed.get(slug)! } : null).filter((hit) => hit !== null).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
      if (!first) return done;
      if (!latest || Date.parse(first.at) > Date.parse(latest.at)) latest = first;
    }
    done.push({ circle, at: latest!.at, slug: latest!.slug });
  }
  return done;
}
