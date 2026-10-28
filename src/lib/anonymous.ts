/**
 * Students who asked to be removed, from ANONYMIZED_LOGINS (comma-separated). They show as an anonymous entry with no
 * level or any other detail, and cannot sign in anymore. Adding a login takes effect on the next deploy.
 */
export function anonymizedLogins(): ReadonlySet<string> {
  return new Set((process.env.ANONYMIZED_LOGINS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
}

export const isAnonymized = (login: string | null | undefined, hidden = anonymizedLogins()) => !!login && hidden.has(login.toLowerCase());

/**
 * Replaces the listed students by anonymous entries that keep only what places them in the list (rank, campus, cohort).
 * Their 42 id is swapped for a negative number so no profile link or lookup can lead back to them.
 */
export function maskAnonymous<T extends { id: number; login: string; displayName: string | null; photo?: string | null }>(items: T[], hidden = anonymizedLogins()): (T & { anonymous?: true })[] {
  if (!hidden.size) return items;
  let next = 0;
  return items.map((item) => hidden.has(item.login.toLowerCase()) ? { ...item, id: -(++next), login: 'Anonymous', displayName: null, photo: null, anonymous: true as const } : item);
}
