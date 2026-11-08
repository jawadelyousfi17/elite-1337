import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cardPath, validCardToken } from './card-token';

const token = (id: number) => new URL(cardPath(id)!, 'http://x').searchParams.get('t')!;
beforeEach(() => { process.env.AUTH_SECRET = 'test-secret-one'; });
afterEach(() => { delete process.env.AUTH_SECRET; });

describe('rank card link', () => {
  it('signs a student id and accepts only that signature for that id', () => {
    expect(cardPath(42)).toMatch(/^\/api\/card\/42\.svg\?t=[A-Za-z0-9_-]{43}$/);
    expect(validCardToken(42, token(42))).toBe(true);
    expect(validCardToken(43, token(42))).toBe(false);
    expect(validCardToken(42, `${token(42).slice(0, 42)}x`)).toBe(false);
    expect(validCardToken(42, '')).toBe(false);
  });
  it('is revoked for everyone when the secret changes', () => {
    const old = token(42);
    process.env.AUTH_SECRET = 'test-secret-two';
    expect(validCardToken(42, old)).toBe(false);
  });
  it('refuses bad ids and a missing secret', () => {
    expect(cardPath(0)).toBeNull();
    expect(cardPath(-5)).toBeNull();
    expect(cardPath(1.5)).toBeNull();
    const signed = token(7);
    delete process.env.AUTH_SECRET;
    expect(cardPath(7)).toBeNull();
    expect(validCardToken(7, signed)).toBe(false);
  });
});
