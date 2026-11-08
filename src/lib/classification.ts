import type { ApiCursusUser } from './fortytwo-api';

export type ExclusionReason =
  | 'wrong-cursus' | 'manual-exclusion' | 'staff-or-nonstudent' | 'inactive'
  | 'alumni-or-completed' | 'missing-level' | 'unverified-account';

export type Classification = { eligible: true } | { eligible: false; reason: ExclusionReason };

/**
 * The 42 API hides freezes from non-staff apps. A paused account whose enrollment
 * has not ended is the closest public signal. The blackhole date is ignored: a freeze
 * does not move it and can leave it empty. Blackholed students have their enrollment closed.
 * Level 0 rules out new students whose accounts are not activated yet.
 */
export function likelyFrozen(record: ApiCursusUser, now = Date.now()): boolean {
  const user = record.user;
  return (user.active === false || user['active?'] === false) && user['alumni?'] !== true && user.alumni !== true
    && !record.end_at && (record.level ?? 0) > 0;
}

export function classifyCommonCore(record: ApiCursusUser, cursusId: number, excludedUserIds: ReadonlySet<number> = new Set(), now = Date.now()): Classification {
  const user = record.user;
  if (record.cursus_id !== cursusId) return { eligible: false, reason: 'wrong-cursus' };
  if (excludedUserIds.has(user.id)) return { eligible: false, reason: 'manual-exclusion' };
  if (user['staff?'] === true || (user.kind !== null && user.kind !== undefined && user.kind !== 'student')) return { eligible: false, reason: 'staff-or-nonstudent' };
  // Alumni stay ranked: their accounts often go inactive and their enrollment ends after graduating.
  const alumni = user['alumni?'] === true || user.alumni === true, paused = alumni || likelyFrozen(record, now);
  if (!paused && (user.active === false || user['active?'] === false)) return { eligible: false, reason: 'inactive' };
  if (!alumni && record.end_at) return { eligible: false, reason: 'alumni-or-completed' };
  // blackholed_at is often a future deadline on live, active records. It is
  // not an authoritative current account state by itself.
  if (record.level === null || record.level === undefined || !Number.isFinite(record.level)) return { eligible: false, reason: 'missing-level' };
  if ((!paused && user.active !== true && user['active?'] !== true) || (user.kind !== 'student' && user['staff?'] !== false)) return { eligible: false, reason: 'unverified-account' };
  return { eligible: true };
}

export function piscineSession(poolYear: string | null | undefined, poolMonth: string | null | undefined) {
  const year = poolYear && /^\d{4}$/.test(poolYear) ? poolYear : null;
  const month = poolMonth?.trim().toLowerCase() ?? null;
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  return { poolYear: year, poolMonth: month && months.includes(month) ? month : null };
}

export function admissionOutcome(hasCommonCoreEnrollment: boolean): 'Accepted' | 'Unknown' {
  // A Common Core enrollment verifies acceptance. Missing one does not prove rejection.
  return hasCommonCoreEnrollment ? 'Accepted' : 'Unknown';
}
