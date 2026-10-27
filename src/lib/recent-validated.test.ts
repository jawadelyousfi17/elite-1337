import { describe, expect, it } from 'vitest';
import { pickRecentValidated } from './recent-validated';

const row = (id: number, at: string, validated: boolean, cursus = [21]) => ({
  id, status: 'finished', updated_at: at, created_at: at, cursus_ids: cursus, occurrence: 0, 'validated?': validated, marked_at: at, final_mark: validated ? 100 : 0, teams: [],
  project: { id: 1, name: 'libft', slug: 'libft' }, user: { id: id * 10, login: `u${id}` },
});

describe('pickRecentValidated', () => {
  it('keeps validated Common Core projects, newest first, up to the limit', () => {
    const rows = [row(1, '2026-10-25T10:00:00Z', true), row(2, '2026-10-27T10:00:00Z', true), row(3, '2026-10-26T10:00:00Z', false), row(4, '2026-10-26T12:00:00Z', true, [9])];
    expect(pickRecentValidated(rows, 16, 21).map((item) => item.id)).toEqual([2, 1]);
    expect(pickRecentValidated(rows, 16, 21, 1)).toEqual([expect.objectContaining({ id: 2, login: 'u2', mark: 100, campusId: 16 })]);
    const step = { ...row(5, '2026-10-27T11:00:00Z', true), project: { id: 2, name: 'Work Experience I - Peer Video', slug: 'peer-video', parent_id: 1 } };
    expect(pickRecentValidated([step], 16, 21)).toEqual([]);
  });
});
