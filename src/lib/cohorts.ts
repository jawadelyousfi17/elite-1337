import { z } from 'zod';

/** Keep filters aligned with HUB's two 2019 promos and yearly groups thereafter. */
export const cohortSchema = z.string().regex(/^(?:2019-(?:03|10)|(?!2019)\d{4})$/);
const beginAtSchema = z.iso.datetime({ offset: true });

/** HUB preserves March 2019 separately and groups all other 2019 starts into October. */
export function commonCoreCohort(beginAt: string | null | undefined): string | null {
  const parsed = beginAtSchema.safeParse(beginAt);
  if (!parsed.success) return null;
  const year = parsed.data.slice(0, 4);
  return year === '2019' ? (parsed.data.startsWith('2019-03') ? '2019-03' : '2019-10') : year;
}
