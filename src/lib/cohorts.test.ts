import { describe, expect, it } from 'vitest';
import { cohortSchema, commonCoreCohort } from './cohorts';

describe('HUB promo grouping', () => {
  it.each([
    ['2018-11-05T08:00:00Z', '2018'],
    ['2019-03-04T08:00:00.000Z', '2019-03'],
    ['2019-10-07T08:00:00Z', '2019-10'],
    ['2019-11-04T08:00:00Z', '2019-10'],
    ['2019-01-01T00:00:00Z', '2019-10'],
    ['2021-11-01T08:00:00Z', '2021'],
    ['2025-03-03T08:00:00Z', '2025'],
    ['2025-10-06T08:00:00Z', '2025'],
    ['2027-10-04T08:00:00+01:00', '2027'],
  ])('maps %s to %s', (beginAt, cohort) => {
    expect(commonCoreCohort(beginAt)).toBe(cohort);
    expect(cohortSchema.safeParse(cohort).success).toBe(true);
  });

  it.each([null, undefined, '', '2019', '2019-03', 'invalid', '2019-02-30T00:00:00Z', '2019-13-01T00:00:00Z'])('leaves invalid or missing dates unknown: %s', (beginAt) => {
    expect(commonCoreCohort(beginAt)).toBeNull();
  });

  it.each(['2019', '2019-04', '2019-00', '2025-10', '2019-03-extra'])('rejects noncanonical filter values: %s', (cohort) => {
    expect(cohortSchema.safeParse(cohort).success).toBe(false);
  });
});
