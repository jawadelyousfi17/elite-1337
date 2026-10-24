import { describe, expect, it } from 'vitest';
import { FortyTwoClient, IncompletePopulationError, RateBudgetError, RequestPacer } from './fortytwo-api';

const row = (id: number) => ({ id, cursus_id: 21, level: 10, end_at: null, user: { id, login: `student${id}`, 'active?': true } });
function clientFor(total: number, missingPage = false) {
  process.env.FORTYTWO_CLIENT_ID = 'fixture-id'; process.env.FORTYTWO_CLIENT_SECRET = 'fixture-secret';
  const requested: number[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(input.toString());
    if (url.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 'fixture-token', expires_in: 3600 }), { status: 200 });
    const page = Number(url.searchParams.get('page[number]'));
    requested.push(page);
    const start = (page - 1) * 100 + 1;
    const size = missingPage && page === 2 ? 80 : Math.max(0, Math.min(100, total - start + 1));
    return new Response(JSON.stringify(Array.from({ length: size }, (_, i) => row(start + i))), { status: 200, headers: { 'x-total': String(total) } });
  }) as typeof fetch;
  return { api: new FortyTwoClient(new RequestPacer(0, 1180), fetcher), requested };
}
describe('42 API pagination and limits', () => {
  it('rejects incomplete active campus location pages', async () => {
    process.env.FORTYTWO_CLIENT_ID = 'fixture-id'; process.env.FORTYTWO_CLIENT_SECRET = 'fixture-secret';
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 'fixture-token', expires_in: 3600 }));
      const page = Number(url.searchParams.get('page[number]'));
      const count = page === 1 ? 100 : 0;
      return new Response(JSON.stringify(Array.from({ length: count }, (_, i) => ({
        id: i + 1, campus_id: 16, host: `e1r1p${i + 1}`, begin_at: '2026-10-19T17:00:00Z', end_at: null, user: { id: i + 1 },
      }))), { headers: { 'x-total': '101' } });
    }) as typeof fetch;
    const api = new FortyTwoClient(new RequestPacer(0, 1180), fetcher);
    await expect(api.campusActiveLocations(16)).rejects.toBeInstanceOf(IncompletePopulationError);
  });
  it('verifies complete Piscine pages before showing candidates', async () => {
    process.env.FORTYTWO_CLIENT_ID = 'fixture-id'; process.env.FORTYTWO_CLIENT_SECRET = 'fixture-secret';
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.pathname === '/oauth/token') return new Response(JSON.stringify({ access_token: 'fixture-token', expires_in: 3600 }));
      const page = Number(url.searchParams.get('page[number]'));
      const start = (page - 1) * 100 + 1;
      const count = page === 1 ? 100 : 2;
      return new Response(JSON.stringify(Array.from({ length: count }, (_, i) => ({ id: start + i, login: `user${start + i}`, pool_year: '2024', pool_month: 'july' }))), { headers: { 'x-total': '102' } });
    }) as typeof fetch;
    const api = new FortyTwoClient(new RequestPacer(0, 1180), fetcher);
    expect(await api.usersByPiscine(16, '2024', 'july')).toHaveLength(102);
  });
  it('fetches all pages and verifies the reported total', async () => {
    const { api, requested } = clientFor(201);
    const records = await api.cursusUsers(16, 21);
    expect(records).toHaveLength(201);
    expect(requested.sort()).toEqual([1, 2, 3]);
  });
  it('rejects a partial population instead of publishing misleading ranks', async () => {
    const { api } = clientFor(201, true);
    await expect(api.cursusUsers(16, 21)).rejects.toBeInstanceOf(IncompletePopulationError);
  });
  it('enforces an hourly request budget', async () => {
    const pace = new RequestPacer(0, 2);
    await pace.acquire(); await pace.acquire();
    await expect(pace.acquire()).rejects.toBeInstanceOf(RateBudgetError);
  });
  it('retries HTTP 429 and succeeds without using partial data', async () => {
    process.env.FORTYTWO_CLIENT_ID = 'fixture-id'; process.env.FORTYTWO_CLIENT_SECRET = 'fixture-secret';
    let attempts = 0;
    const fetcher = (async (input: RequestInfo | URL) => {
      if (input.toString().includes('/oauth/token')) return new Response(JSON.stringify({ access_token: 'fixture-token', expires_in: 3600 }));
      attempts++;
      if (attempts === 1) return new Response('', { status: 429 });
      return new Response(JSON.stringify([row(1)]), { headers: { 'x-total': '1' } });
    }) as typeof fetch;
    const api = new FortyTwoClient(new RequestPacer(0, 1180), fetcher);
    expect(await api.cursusUsers(16, 21)).toHaveLength(1);
    expect(attempts).toBe(2);
  });
});
