import type { BlackholedStudent, RankingDataset } from './dataset';
import type { StudentRank } from './ranking';

const DAY = 86_400_000;
export const WEEKS = 26;
export const MONTHS = 7;

export type Bucket = { key: string; start: number; count: number };
export type MonthBucket = { key: string; count: number; change: number | null; byCampus: Record<number, number> };
export type MatrixCell = { active: number; blackholed: number; rate: number | null };
export type PlatformStats = {
  active: number; blackholedTotal: number; blackholed7: number; blackholed30: number; previous30: number; blackholed90: number;
  avgLevel: number; medianLevel: number; survival: number;
  weekly: Bucket[]; monthly: MonthBucket[];
  campuses: { campusId: number; active: number; avgLevel: number; blackholed30: number }[];
  matrix: { years: string[]; campusIds: number[]; cells: Record<string, Record<number, MatrixCell>> };
  levels: { level: number; count: number }[];
  leaders: { year: string; student: StudentRank; cohortSize: number }[];
  calendar: { month: string; days: { date: string; count: number }[] };
  latest: BlackholedStudent[];
};

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export const monthKey = (time: number) => new Date(time).toISOString().slice(0, 7);
function shiftMonth(key: string, by: number) {
  const [year, month] = key.split('-').map(Number);
  return monthKey(Date.UTC(year, month - 1 + by, 1));
}

/** Everything the stats page shows. `campusId` narrows every figure except the campus comparison and the campus × cohort matrix. */
export function computeStats(dataset: Pick<RankingDataset, 'students' | 'blackholed'>, options: { campusId?: number; month?: string; now?: number } = {}): PlatformStats {
  const { campusId, now = Date.now() } = options;
  const inScope = (ids: number[]) => !campusId || ids.includes(campusId);
  const students = dataset.students.filter((student) => inScope(student.campusIds));
  const lost = dataset.blackholed.filter((student) => inScope(student.campusIds));
  const times = lost.map((student) => Date.parse(student.blackholedAt));
  const between = (from: number, to: number) => times.filter((time) => time > now - from * DAY && time <= now - to * DAY).length;

  const weekly = Array.from({ length: WEEKS }, (_, index) => {
    const end = now - (WEEKS - 1 - index) * 7 * DAY, start = end - 7 * DAY;
    return { key: new Date(start + DAY).toISOString().slice(0, 10), start: start + DAY, count: times.filter((time) => time > start && time <= end).length };
  });

  const current = monthKey(now);
  const perMonth = (key: string) => times.filter((time) => monthKey(time) === key).length;
  const monthly = Array.from({ length: MONTHS }, (_, index) => {
    const key = shiftMonth(current, index - MONTHS + 1), count = perMonth(key), before = perMonth(shiftMonth(key, -1));
    // Attribute each student once so the stack preserves the unique monthly total.
    const byCampus: Record<number, number> = {};
    for (const student of lost) {
      if (monthKey(Date.parse(student.blackholedAt)) !== key) continue;
      const id = campusId ?? student.campusIds[0] ?? 0;
      byCampus[id] = (byCampus[id] ?? 0) + 1;
    }
    return { key, count, change: before ? (count - before) / before : null, byCampus };
  });

  const campusIds = [...new Set(dataset.students.flatMap((student) => student.campusIds))].sort((a, b) => a - b);
  const campuses = campusIds.map((id) => {
    const members = dataset.students.filter((student) => student.campusIds.includes(id));
    return { campusId: id, active: members.length, avgLevel: average(members.map((student) => student.level)), blackholed30: dataset.blackholed.filter((student) => student.campusIds.includes(id) && now - Date.parse(student.blackholedAt) <= 30 * DAY).length };
  });

  const years = [...new Set([...dataset.students, ...dataset.blackholed].map((student) => student.commonCoreEntryYear).filter((year): year is string => !!year))].sort((a, b) => b.localeCompare(a));
  const cells: PlatformStats['matrix']['cells'] = {};
  for (const year of years) {
    cells[year] = {};
    for (const id of campusIds) {
      const active = dataset.students.filter((student) => student.commonCoreEntryYear === year && student.campusIds.includes(id)).length;
      const blackholed = dataset.blackholed.filter((student) => student.commonCoreEntryYear === year && student.campusIds.includes(id)).length;
      cells[year][id] = { active, blackholed, rate: active + blackholed ? active / (active + blackholed) : null };
    }
  }

  const top = Math.max(0, ...students.map((student) => Math.floor(student.level)));
  const levels = Array.from({ length: top + 1 }, (_, level) => ({ level, count: students.filter((student) => Math.floor(student.level) === level).length }));

  const leaders = years.flatMap((year) => {
    const cohort = students.filter((student) => student.commonCoreEntryYear === year);
    const best = cohort.reduce<StudentRank | undefined>((winner, student) => !winner || student.level > winner.level ? student : winner, undefined);
    return best ? [{ year, student: best, cohortSize: cohort.length }] : [];
  });

  const month = options.month && /^\d{4}-\d{2}$/.test(options.month) && options.month <= current ? options.month : current;
  const [year, monthIndex] = month.split('-').map(Number);
  const length = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days = Array.from({ length }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    return { date, count: lost.filter((student) => student.blackholedAt.slice(0, 10) === date).length };
  });

  return {
    active: students.length, blackholedTotal: lost.length,
    blackholed7: between(7, 0), blackholed30: between(30, 0), previous30: between(60, 30), blackholed90: between(90, 0),
    avgLevel: average(students.map((student) => student.level)), medianLevel: median(students.map((student) => student.level)),
    survival: students.length + lost.length ? students.length / (students.length + lost.length) : 0,
    weekly, monthly, campuses, matrix: { years, campusIds, cells }, levels, leaders,
    calendar: { month, days }, latest: lost.slice(0, 6),
  };
}

export { shiftMonth };
