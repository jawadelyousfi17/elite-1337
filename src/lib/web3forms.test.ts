import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitWeb3Form } from './web3forms';

afterEach(() => vi.unstubAllGlobals());

describe('Web3Forms submissions', () => {
  it('sends answers with the access key and without cookies or a referrer', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetch);
    await submitWeb3Form('Career survey', { employment_status: 'Not working' });
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('https://api.web3forms.com/submit');
    expect(request).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(JSON.parse(request.body)).toEqual({
      access_key: expect.any(String), subject: 'Career survey', from_name: 'Elite 1337', employment_status: 'Not working',
    });
  });

  it.each([
    [200, { success: false }],
    [429, { success: false }],
    [500, { success: true }],
    [200, {}],
  ])('rejects unsuccessful or unconfirmed responses (%s)', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
    await expect(submitWeb3Form('Career survey', {})).rejects.toThrow();
  });

  it('rejects network failures and invalid responses', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(new Response('not JSON'));
    vi.stubGlobal('fetch', fetch);
    await expect(submitWeb3Form('Career survey', {})).rejects.toThrow();
    await expect(submitWeb3Form('Career survey', {})).rejects.toThrow();
  });
});
