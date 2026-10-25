import { describe, expect, it } from 'vitest';
import { collectBlackholed } from './dataset';
import type { ApiCursusUser } from './fortytwo-api';

const now = Date.parse('2026-10-22T12:00:00Z');
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();

describe('blackholed students', () => {
  const record = (id: number, overrides: Partial<ApiCursusUser> = {}, user: Partial<ApiCursusUser['user']> = {}): ApiCursusUser => ({ id: id * 10, cursus_id: 21, level: 3.5, begin_at: '2023-10-02T08:00:00.000Z', end_at: inDays(-30), blackholed_at: inDays(-30), grade: null, user: { id, login: `u${id}`, displayname: `User ${id}`, kind: 'student', 'active?': false, 'staff?': false, ...user }, ...overrides });
  it('keeps only ended enrollments past their blackhole date that are not ranked or staff', () => {
    const lost = collectBlackholed([{ campusId: 16, records: [
      record(1),
      record(2, { blackholed_at: inDays(10) }),
      record(3, {}, { 'staff?': true }),
      record(4, { end_at: null }, { 'active?': true }),
      record(5),
      record(6, { end_at: null }, { 'active?': false }),
    ] }], 21, new Set([5]), now);
    expect(lost.map((item) => item.id)).toEqual([1]);
    expect(lost[0]).toMatchObject({ login: 'u1', commonCoreEntryYear: '2023', campusIds: [16] });
  });
  it('leaves alumni out of the blackholed list', () => {
    const lost = collectBlackholed([{ campusId: 16, records: [record(7, {}, { 'alumni?': true }), record(10)] }], 21, new Set(), now);
    expect(lost.map((item) => item.id)).toEqual([10]);
  });
});
