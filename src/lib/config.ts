import { z } from 'zod';

const positive = z.coerce.number().int().positive();
export function campusIds(): number[] {
  // Verified against the live 42 campus directory in October 2026.
  const verified = [16, 21, 55, 75];
  const configured = (process.env.FORTYTWO_CAMPUS_IDS ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => positive.parse(x));
  if (configured.some((id) => !verified.includes(id))) throw new Error('FORTYTWO_CAMPUS_IDS contains an unverified 1337 campus');
  return verified;
}
export function cursusId(): number { return positive.parse(process.env.FORTYTWO_CURSUS_ID); }

export function excludedUserIds(): ReadonlySet<number> {
  const ids = (process.env.FORTYTWO_EXCLUDED_USER_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean).map((value) => positive.parse(value));
  return new Set(ids);
}
