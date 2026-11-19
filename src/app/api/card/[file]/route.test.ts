import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { loadRankingDataset, type RankingDataset } from '@/lib/dataset';
import { getCardSharing } from '@/lib/card-sharing';
import { cardPath } from '@/lib/card-token';
import { GET } from './route';

vi.mock('@/lib/card-sharing', () => ({ getCardSharing: vi.fn(async () => ({ enabled: true, version: 'legacy' })) }));

vi.mock('@/lib/dataset', async (original) => ({ ...(await original<typeof import('@/lib/dataset')>()), loadRankingDataset: vi.fn() }));

const students = [{ id: 42, login: 'jel-yous', displayName: null, poolYear: null, poolMonth: null, commonCoreCohort: '2024', level: 7.4, campusIds: [16], globalRank: 5, campusRanks: { 16: 3 } }];
const ready = { status: 'ready', data: { students, blackholed: [], acceptedUserIds: [], campuses: [{ id: 16, name: 'Khouribga' }], fetchedAt: '', complete: true } as RankingDataset } as const;
const call = (file: string, query = '') => GET(new NextRequest(`http://localhost:3000/api/card/${file}${query}`), { params: Promise.resolve({ file }) });
const signed = (id: number) => new URL(cardPath(id)!, 'http://x').search;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getCardSharing).mockResolvedValue({ enabled: true, version: 'legacy' }); process.env.AUTH_SECRET = 'route-test-secret'; vi.mocked(loadRankingDataset).mockResolvedValue(ready); });

describe('rank card route', () => {
  it('serves a cacheable SVG without a session when the token is valid', async () => {
    const response = await call('42.svg', signed(42));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    const body = await response.text();
    expect(body).toContain('jel-yous');
    expect(body).toContain('#3');
  });
  it('rejects a missing, wrong or other-student token before reading any rankings', async () => {
    for (const [file, query] of [['42.svg', ''], ['42.svg', `?t=${'a'.repeat(43)}`], ['43.svg', signed(42)], ['42.png', signed(42)], ['abc.svg', signed(42)]] as const) {
      expect((await call(file, query)).status).toBe(404);
    }
    expect(loadRankingDataset).not.toHaveBeenCalled();
  });
  it('404s for a signed id that is not ranked (for example removed students)', async () => {
    expect((await call('77.svg', signed(77))).status).toBe(404);
  });
  it('shows a short-lived placeholder while the rankings are not ready', async () => {
    vi.mocked(loadRankingDataset).mockResolvedValue({ status: 'rate-limited' });
    const response = await call('42.svg', signed(42));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('Rankings are updating');
  });
  it('applies the look chosen in the link and ignores bad values', async () => {
    const body = await (await call('42.svg', `${signed(42)}&theme=forest&accent=mint&font=courier&logo=0`)).text();
    expect(body).toContain('.bg{fill:#0f1d17;');
    expect(body).toContain('.k{fill:#cafbd2}');
    expect(body).toContain("'Courier New'");
    expect(body).not.toContain('class="lg"');
    expect(await (await call('42.svg', `${signed(42)}&theme=neon&font=comic`)).text()).toContain('prefers-color-scheme');
  });
  it('can force a theme', async () => {
    expect(await (await call('42.svg', `${signed(42)}&theme=light`)).text()).not.toContain('prefers-color-scheme');
  });
});

it('does not expose a disabled card or serve a card when its policy cannot load', async () => {
  vi.mocked(getCardSharing).mockResolvedValue({ enabled: false, version: 'rotated' });
  expect((await call('42.svg', signed(42))).status).toBe(404);
  vi.mocked(getCardSharing).mockRejectedValue(new Error('offline'));
  expect((await call('42.svg', signed(42))).status).toBe(503);
  expect(loadRankingDataset).not.toHaveBeenCalled();
});
