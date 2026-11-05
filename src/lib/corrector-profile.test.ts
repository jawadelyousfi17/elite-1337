import { describe, expect, it } from 'vitest';
import { summarizeCorrections } from './corrector-profile';

const ok = { name: 'Ok', positive: true }, crash = { name: 'Crash', positive: false };

describe('summarizeCorrections', () => {
  it('counts returns among filled evaluations and averages the ratings received', () => {
    const profile = summarizeCorrections([
      { filled_at: '2026-11-01', flag: ok, feedbacks: [{ rating: 5 }] },
      { filled_at: '2026-11-02', flag: crash, feedbacks: [{ rating: 3 }] },
      { filled_at: '2026-11-03', flag: ok, feedbacks: [] },
      { filled_at: '2026-11-04', flag: ok, feedbacks: [{ rating: null }] },
      { filled_at: null, flag: crash, feedbacks: [{ rating: 0 }] },
    ]);
    expect(profile).toEqual({ evaluations: 4, returned: 1, rate: .25, rated: 2, rating: 4 });
  });
  it('has no rate or rating without evaluations', () => {
    expect(summarizeCorrections([])).toEqual({ evaluations: 0, returned: 0, rate: null, rated: 0, rating: null });
  });
});
