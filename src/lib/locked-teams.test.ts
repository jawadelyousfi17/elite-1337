import { describe, expect, it } from 'vitest';
import { pickLockedTeams } from './locked-teams';

const row = (id: number, team: { id: number; locked_at: string | null; users: number }, extra: { cursus?: number[]; current?: number } = {}) => ({
  id, status: 'in_progress', updated_at: '2026-11-03T10:00:00Z', cursus_ids: extra.cursus ?? [21], current_team_id: extra.current ?? team.id,
  project: { id: 1, name: 'ft_irc', slug: 'ft_irc' }, user: { id: id * 10, login: `user${id}` },
  teams: [{ id: team.id, locked_at: team.locked_at, users: Array.from({ length: team.users }, (_, i) => ({ id: i })) }],
});
const from = Date.parse('2026-11-01T00:00:00Z');

describe('pickLockedTeams', () => {
  it('keeps group teams locked in the window, newest first', () => {
    const picked = pickLockedTeams([row(1, { id: 5, locked_at: '2026-11-02T00:00:00Z', users: 3 }), row(2, { id: 6, locked_at: '2026-11-03T00:00:00Z', users: 2 })], 16, 21, from);
    expect(picked.map((item) => [item.teamId, item.login, item.at])).toEqual([[6, 'user2', '2026-11-03T00:00:00Z'], [5, 'user1', '2026-11-02T00:00:00Z']]);
  });
  it('drops solo teams, unlocked or old locks, other cursus and old teams', () => {
    const rows = [
      row(1, { id: 5, locked_at: '2026-11-02T00:00:00Z', users: 1 }),
      row(2, { id: 6, locked_at: null, users: 3 }),
      row(3, { id: 7, locked_at: '2026-10-20T00:00:00Z', users: 3 }),
      row(4, { id: 8, locked_at: '2026-11-02T00:00:00Z', users: 3 }, { cursus: [9] }),
      row(5, { id: 9, locked_at: '2026-11-02T00:00:00Z', users: 3 }, { current: 99 }),
    ];
    expect(pickLockedTeams(rows, 16, 21, from)).toEqual([]);
  });
});
