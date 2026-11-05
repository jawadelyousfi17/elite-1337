import { describe, expect, it } from 'vitest';
import { PROJECT_SLUG, groupTeams, mergeInternshipSteps, projectTone } from './correction-teams';

describe('PROJECT_SLUG', () => {
  it('accepts real 42 slugs and refuses anything else', () => {
    for (const slug of ['libft', 'ft_printf', 'ft_transcendence', '42cursus-push_swap', 'work-experience-i']) expect(PROJECT_SLUG.test(slug)).toBe(true);
    for (const slug of ['', 'a b', '../x', 'a'.repeat(81)]) expect(PROJECT_SLUG.test(slug)).toBe(false);
  });
});

describe('projectTone', () => {
  it('gives a project the same slot every time, inside the palette', () => {
    expect(projectTone('ft_printf', 6)).toBe(projectTone('ft_printf', 6));
    const names = ['libft', 'ft_printf', 'push_swap', 'minishell', 'cub3d', 'ft_irc', 'ft_transcendence', 'Work Experience I'];
    const tones = names.map((name) => projectTone(name, 6));
    expect(tones.every((tone) => tone >= 0 && tone < 6)).toBe(true);
    expect(new Set(tones).size).toBeGreaterThan(1);
  });
});

describe('mergeInternshipSteps', () => {
  const row = (id: number, userId: number, project: string, projectSlug: string) => ({ id, userId, project, projectSlug, teamId: id });
  it('shows one row per student and internship, in the place of their newest step', () => {
    const merged = mergeInternshipSteps([
      row(1, 7, 'Work Experience I - Company Mid Evaluation', 'work-experience-i-work-experience-i-company-mid-evaluation'),
      row(2, 8, 'libft', 'libft'),
      row(3, 7, 'Work Experience I  - Contract Upload', 'work-experience-i-work-experience-i-contract-upload'),
      row(4, 7, 'Work Experience I', 'work-experience-i'),
    ]);
    expect(merged.map(({ id, project, projectSlug, steps, teamId }) => ({ id, project, projectSlug, steps, teamId }))).toEqual([
      { id: 1, project: 'Work Experience I', projectSlug: 'work-experience-i', steps: ['Company Mid Evaluation', 'Contract Upload'], teamId: null },
      { id: 2, project: 'libft', projectSlug: 'libft', steps: undefined, teamId: 2 },
    ]);
  });
  it('keeps different students and different internships apart', () => {
    const merged = mergeInternshipSteps([
      row(1, 7, 'Work Experience I - Duration', 'work-experience-i-work-experience-i-duration'),
      row(2, 8, 'Work Experience I - Duration', 'work-experience-i-work-experience-i-duration'),
      row(3, 7, 'Work Experience II - Duration', 'work-experience-ii-work-experience-ii-duration'),
    ]);
    expect(merged.map((item) => item.projectSlug)).toEqual(['work-experience-i', 'work-experience-i', 'work-experience-ii']);
  });
  it('leaves projects that only look similar alone', () => {
    const merged = mergeInternshipSteps([row(1, 7, 'Work Experience Plus', 'work-experience-plus')]);
    expect(merged[0].project).toBe('Work Experience Plus');
  });
});

describe('groupTeams', () => {
  it('puts the members of one team and project in one group, in first-seen order', () => {
    const rows = [
      { id: 1, teamId: 10, projectSlug: 'ft_irc' },
      { id: 2, teamId: null, projectSlug: 'libft' },
      { id: 3, teamId: 10, projectSlug: 'ft_irc' },
      { id: 4, teamId: 10, projectSlug: 'ft_irc' },
    ];
    expect(groupTeams(rows).map((group) => group.map((row) => row.id))).toEqual([[1, 3, 4], [2]]);
  });
  it('keeps rows without a team, or of different projects, apart', () => {
    const rows = [{ id: 1, projectSlug: 'libft' }, { id: 2, projectSlug: 'libft' }, { id: 3, teamId: 7, projectSlug: 'a' }, { id: 4, teamId: 7, projectSlug: 'b' }];
    expect(groupTeams(rows)).toHaveLength(4);
  });
});
