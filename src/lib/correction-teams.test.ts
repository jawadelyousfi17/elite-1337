import { describe, expect, it } from 'vitest';
import { groupTeams } from './correction-teams';

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
