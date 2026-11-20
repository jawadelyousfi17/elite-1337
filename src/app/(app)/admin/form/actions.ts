'use server';

import { z } from 'zod';
import { requireStudent } from '@/lib/guard';
import { isAccessAdmin } from '@/lib/user-controls';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { intraPhotoUrl } from '@/lib/avatars/intra-photo';

export type ApplicantProfile = { name: string | null; photo: string | null; level: number; cohort: string | null; campus: string | null; blackholed?: true };
const loginsSchema = z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{2,40}$/)).max(500);

/**
 * Names and photos for the applicants the admin imported, read from the shared rankings cache, so it costs no extra
 * 42 requests. Logins outside the rankings (or removed students) come back missing and show initials.
 */
export async function lookupApplicants(input: string[]): Promise<Record<string, ApplicantProfile>> {
  const user = await requireStudent();
  if (!await isAccessAdmin(user.login)) throw new Error('Not authorized');
  const logins = loginsSchema.safeParse(input);
  if (!logins.success) return {};
  const loaded = await loadRankingDataset();
  if (loaded.status !== 'ready') return {};
  const wanted = new Set(logins.data), found: Record<string, ApplicantProfile> = {}, data = loaded.data;
  for (const student of data.students) if (!student.anonymous && wanted.has(student.login.toLowerCase()))
    found[student.login.toLowerCase()] = { name: student.displayName, photo: intraPhotoUrl(student.id, student.photo), level: student.level, cohort: student.commonCoreCohort, campus: student.campusIds[0] ? campusName(data, student.campusIds[0]) : null };
  for (const student of data.blackholed) if (!student.anonymous && wanted.has(student.login.toLowerCase()) && !found[student.login.toLowerCase()])
    found[student.login.toLowerCase()] = { name: student.displayName, photo: intraPhotoUrl(student.id, student.photo), level: student.level, cohort: student.commonCoreCohort, campus: student.campusIds[0] ? campusName(data, student.campusIds[0]) : null, blackholed: true };
  return found;
}
