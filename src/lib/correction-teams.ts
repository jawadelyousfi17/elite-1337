/** A correction row that may belong to a 42 team (`teamId` is the project's current team). */
export type TeamMemberRow = { id: number; teamId?: number | null; projectSlug: string };

/** What a project filter may hold; 42 slugs use underscores (ft_printf, ft_transcendence). */
export const PROJECT_SLUG = /^[a-z0-9_.-]{1,80}$/;

/** Colour slot for a project, from its name, so a project keeps its colour across rows, filters and visits. */
export function projectTone(project: string, tones: number) {
  let hash = 2166136261;
  for (const char of project) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash ^ hash >>> 15) >>> 0) % tones;
}

type StepRow = { userId: number; project: string; projectSlug: string; teamId?: number | null };
const INTERNSHIP = /^(?:42cursus-)?(work-experience-i+)(?=-|$)/;

/**
 * One row per student and internship: 42 lists every step of a Work Experience as its own project ("Work Experience I
 * - Peer Video"), which would fill the list with the same student. The row keeps its first place and names its steps.
 */
export function mergeInternshipSteps<T extends StepRow>(rows: T[]): (T & { steps?: string[] })[] {
  const merged = new Map<string, T & { steps: string[] }>();
  return rows.flatMap((row): (T & { steps?: string[] })[] => {
    const family = INTERNSHIP.exec(row.projectSlug)?.[1];
    if (!family) return [row];
    const [project, step] = row.project.split(/\s+-\s+/, 2), key = `${row.userId}|${family}`, card = merged.get(key);
    if (card) { if (step) card.steps.push(step); return []; }
    const first = { ...row, project, projectSlug: family, teamId: null, steps: step ? [step] : [] };
    merged.set(key, first);
    return [first];
  });
}

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
