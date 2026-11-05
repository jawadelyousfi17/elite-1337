/** A correction row that may belong to a 42 team (`teamId` is the project's current team). */
export type TeamMemberRow = { id: number; teamId?: number | null; projectSlug: string };

/**
 * Rows of the same team and project together, so a group project pushed by three students reads as one entry.
 * Rows without a team stay alone. Groups keep the order of their first row (the list arrives newest first).
 */
export function groupTeams<T extends TeamMemberRow>(rows: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.teamId ? `${row.teamId}|${row.projectSlug}` : `row-${row.id}`;
    const group = groups.get(key);
    if (group) group.push(row); else groups.set(key, [row]);
  }
  return [...groups.values()];
}
