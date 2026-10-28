import { describe, expect, it } from 'vitest';
import { hideRequestPayload } from './hide-requests';
import { hideRequestSchema } from './hide-request-rules';

describe('hide requests', () => {
  it('needs a reason of at least 10 characters and the acknowledgement', () => {
    expect(hideRequestSchema.safeParse({ reason: 'I prefer privacy', acknowledged: true }).success).toBe(true);
    expect(hideRequestSchema.safeParse({ reason: 'too short', acknowledged: true }).success).toBe(false);
    expect(hideRequestSchema.safeParse({ reason: '   short   ', acknowledged: true }).success).toBe(false);
    expect(hideRequestSchema.safeParse({ reason: 'I prefer privacy', acknowledged: false }).success).toBe(false);
  });
  it('builds a Discord message that cannot ping anyone', () => {
    const body = hideRequestPayload('jel-yous', 'I prefer privacy');
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0].description).toBe('I prefer privacy');
  });
});
