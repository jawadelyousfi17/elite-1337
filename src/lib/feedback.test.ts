import { afterEach, describe, expect, it, vi } from 'vitest';
import { discordPayload, feedbackSchema, isFeedbackAdmin, type FeedbackEntry } from './feedback';

afterEach(() => vi.unstubAllEnvs());

const entry: FeedbackEntry = { id: 1, login: 'jdoe', kind: 'bug', message: 'Broken @everyone', page: '/stats', screen: '1280×720', createdAt: '2026-10-25T00:00:00.000Z' };

describe('feedback', () => {
  it('only lets configured logins read feedback', () => {
    expect(isFeedbackAdmin('jdoe')).toBe(false);
    vi.stubEnv('ADMIN_LOGINS', ' JDoe , other ');
    expect(isFeedbackAdmin('jdoe')).toBe(true);
    expect(isFeedbackAdmin('someone')).toBe(false);
    expect(isFeedbackAdmin(undefined)).toBe(false);
  });

  it('rejects unknown kinds and short or oversized messages', () => {
    const base = { kind: 'bug', message: 'hello', page: '/', screen: '1x1', reply: true };
    expect(feedbackSchema.safeParse(base).success).toBe(true);
    expect(feedbackSchema.safeParse({ ...base, kind: 'spam' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, message: '  a ' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, message: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('builds a Discord message that cannot ping anyone', () => {
    const payload = discordPayload(entry);
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds[0].description).toBe('Broken @everyone');
    expect(payload.embeds[0].fields[0].value).toContain('jdoe');
    expect(discordPayload({ ...entry, login: null }).embeds[0].fields[0].value).toBe('Anonymous');
  });
});
