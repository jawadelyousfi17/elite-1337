import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('completes the local 42 OAuth callback and creates a session', async () => {
  vi.stubEnv('AUTH_URL', 'http://localhost:3000');
  vi.stubEnv('AUTH_SECRET', 'local-oauth-test-secret-with-enough-length');
  vi.stubEnv('FORTYTWO_CLIENT_ID', 'fixture-id');
  vi.stubEnv('FORTYTWO_CLIENT_SECRET', 'fixture-secret');

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input.toString());
    if (url.pathname === '/oauth/token' && url.host === 'api.intra.42.fr') {
      const body = new URLSearchParams(init?.body as URLSearchParams);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('fixture-code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/42');
      return new Response(JSON.stringify({ access_token: 'fixture-access-token', token_type: 'bearer', expires_in: 3600 }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/v2/me' && url.host === 'api.intra.42.fr') {
      return new Response(JSON.stringify({ id: 123, login: 'fixture-login' }), { headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected OAuth request: ${url.origin}${url.pathname}`);
  }));

  const { handlers } = await import('./auth');
  const cookies = new Map<string, string>();
  const saveCookies = (response: Response) => {
    for (const header of response.headers.getSetCookie()) {
      const [name, value] = header.split(';', 1)[0].split('=');
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    }
  };
  const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');

  const csrf = await handlers.GET(new NextRequest('http://localhost:3000/api/auth/csrf'));
  saveCookies(csrf);
  const { csrfToken } = await csrf.json();
  const signin = await handlers.POST(new NextRequest('http://localhost:3000/api/auth/signin/42', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, callbackUrl: 'http://localhost:3000/leaderboard' })
  }));
  saveCookies(signin);
  const authorization = new URL(signin.headers.get('location')!);
  expect(authorization.host).toBe('api.intra.42.fr');
  expect(authorization.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/42');
  const state = authorization.searchParams.get('state');
  expect(state).toBeTruthy();

  const callback = await handlers.GET(new NextRequest(`http://localhost:3000/api/auth/callback/42?code=fixture-code&state=${encodeURIComponent(state!)}`, {
    headers: { cookie: cookieHeader() }
  }));
  saveCookies(callback);
  expect(callback.headers.get('location')).toBe('http://localhost:3000/leaderboard');

  const session = await handlers.GET(new NextRequest('http://localhost:3000/api/auth/session', { headers: { cookie: cookieHeader() } }));
  expect(await session.json()).toMatchObject({ user: { id: '123', login: 'fixture-login' } });
});
