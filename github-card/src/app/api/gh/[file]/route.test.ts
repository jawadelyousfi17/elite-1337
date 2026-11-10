import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const loadGithub = vi.fn();
vi.mock('next/cache', () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock('@/lib/photo', () => ({ loadGithubLuma: vi.fn(async () => null) }));
vi.mock('@/lib/github', async (original) => ({ ...(await original<typeof import('@/lib/github')>()), loadGithub }));
const { GET } = await import('./route');
const call = (file: string, query = '') => GET(new NextRequest(`http://localhost/api/gh/${file}${query}`), { params: Promise.resolve({ file }) });

beforeEach(() => loadGithub.mockReset());
describe('GET /api/gh/[file]', () => {
  it('rejects names that are not GitHub usernames without asking GitHub', async () => {
    for (const file of ['a--b.svg', '-x.svg', 'a_b.svg', 'x.png', 'a.svg.svg']) expect((await call(file)).status).toBe(404);
    expect(loadGithub).not.toHaveBeenCalled();
  });
  it('is 404 for a user GitHub does not know', async () => {
    loadGithub.mockResolvedValue({ status: 'missing' });
    expect((await call('nobody.svg')).status).toBe(404);
  });
  it('draws a public, sandboxed SVG with the typed text even when GitHub is down', async () => {
    loadGithub.mockResolvedValue(null);
    const response = await call('ada.svg', '?role=Compilers&theme=black');
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(body).toContain('Compilers');
    expect(body).toContain('scale(.019)');
    expect(await (await call('ada.svg', '?logo=0')).text()).not.toContain('scale(.019)');
    expect(Number(/max-age=(\d+)/.exec(response.headers.get('cache-control')!)![1])).toBeLessThanOrEqual(300);
  });
});
