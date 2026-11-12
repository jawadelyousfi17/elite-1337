import { expect, it } from 'vitest';
import { eligibleEvaluation } from './evaluation-rules';
import { pickEvaluations } from './correctors';
const row = { id: 1, filled_at: '2026-11-01', flag: { name: 'OK', positive: true }, corrector: { id: 1, login: 'student' }, team: { project: { name: 'Libft', slug: 'libft' } } };
it('excludes peer video using name, slug or path, and excludes unknown metadata', () => {
  expect(eligibleEvaluation(row)).toBe(true);
  for (const name of ['Peer Video', 'peer-video', 'PEER_VIDEO', 'PeerVideo']) expect(eligibleEvaluation({ ...row, team: { project: { name } } })).toBe(false);
  expect(eligibleEvaluation({ ...row, team: { project_gitlab_path: 'internship/peer-video' } })).toBe(false);
  expect(eligibleEvaluation({ ...row, team: null })).toBe(false);
  expect(eligibleEvaluation({ ...row, corrector: 'invisible' })).toBe(false);
  expect(eligibleEvaluation({ ...row, filled_at: null })).toBe(false);
  expect(eligibleEvaluation({ ...row, flag: null })).toBe(false);
  expect(pickEvaluations([row, row], 16)).toHaveLength(1);
});
