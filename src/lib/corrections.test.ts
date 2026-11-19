import { beforeEach, expect, it, vi } from 'vitest';
const waiting = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./fortytwo-api', async (original) => ({ ...await original<object>(), fortyTwoApi: { waitingForCorrection: waiting } }));
vi.mock('./config', () => ({ campusIds: () => [16], cursusId: () => 21 }));
vi.mock('./demo', () => ({ isDemo: () => false }));
beforeEach(() => { vi.resetModules(); waiting.mockReset(); });
it('includes old submissions but excludes locked/in-progress projects and other curricula', async () => {
  const row = { id: 1, status: 'waiting_for_correction', cursus_ids: [21], user: { id: 42, login: 'student' }, project: { name: 'Libft', slug: 'libft' }, current_team_id: 10, updated_at: '2020-01-01T00:00:00Z' };
  waiting.mockResolvedValue([row, { ...row, id: 2, status: 'in_progress' }, { ...row, id: 3, cursus_ids: [9] }]);
  const { loadPendingCorrections } = await import('./corrections');
  const result = await loadPendingCorrections(16);
  expect(result.status).toBe('ready');
  if (result.status === 'ready') expect(result.rows).toMatchObject([{ id: 1, login: 'student', teamId: 10, updatedAt: row.updated_at }]);
  expect(waiting).toHaveBeenCalledWith(16);
});
