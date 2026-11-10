import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/auth';
import { clearCardArt, saveCardArt } from '@/lib/card-art-store';
import { imageToCells } from '@/lib/card-photo';
import { fetchImageBytes, ImageFetchError } from '@/lib/safe-image-fetch';
import { ART_COLS, ART_ROWS } from '@/lib/card-art';
import { chooseGithubPicture, chooseIntraPhoto, chooseLinkPicture, chooseUploadedPicture } from './actions';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/card-art-store', async (original) => ({ ...(await original<typeof import('@/lib/card-art-store')>()), saveCardArt: vi.fn(), clearCardArt: vi.fn() }));
vi.mock('@/lib/card-photo', () => ({ imageToCells: vi.fn() }));
vi.mock('@/lib/safe-image-fetch', async (original) => ({ ...(await original<typeof import('@/lib/safe-image-fetch')>()), fetchImageBytes: vi.fn() }));

const cells = new Uint8Array(ART_COLS * ART_ROWS).fill(9);
const encoded = Buffer.from(cells).toString('base64');
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: '4242' } } as never);
  vi.mocked(saveCardArt).mockResolvedValue('saved');
  vi.mocked(clearCardArt).mockResolvedValue('saved');
  vi.mocked(fetchImageBytes).mockResolvedValue(new Uint8Array([1]));
  vi.mocked(imageToCells).mockResolvedValue(cells);
});

describe('card picture actions', () => {
  it('needs a signed-in student and never takes the id from the caller', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    for (const result of [await chooseIntraPhoto(), await chooseUploadedPicture(encoded), await chooseGithubPicture('octocat'), await chooseLinkPicture('https://example.com/a.jpg')]) expect(result.ok).toBe(false);
    expect(saveCardArt).not.toHaveBeenCalled();
    expect(clearCardArt).not.toHaveBeenCalled();
  });
  it('goes back to the 42 photo by clearing the saved picture', async () => {
    expect((await chooseIntraPhoto()).ok).toBe(true);
    expect(clearCardArt).toHaveBeenCalledWith(4242);
  });
  it('saves an uploaded picture only when the cells are valid', async () => {
    expect((await chooseUploadedPicture('nope')).ok).toBe(false);
    expect(saveCardArt).not.toHaveBeenCalled();
    expect((await chooseUploadedPicture(encoded)).ok).toBe(true);
    expect(saveCardArt).toHaveBeenCalledWith(4242, { source: 'upload', label: 'Uploaded image', cells: encoded });
  });
  it('accepts a GitHub username, tolerates a leading @, and only talks to GitHub hosts', async () => {
    expect((await chooseGithubPicture('@octocat')).ok).toBe(true);
    const [url, hosts] = vi.mocked(fetchImageBytes).mock.calls[0];
    expect(url.href).toBe('https://github.com/octocat.png?size=240');
    expect(hosts).toEqual(['github.com', 'avatars.githubusercontent.com']);
    expect(saveCardArt).toHaveBeenCalledWith(4242, { source: 'github', label: '@octocat', cells: encoded });
  });
  it('rejects things that are not GitHub usernames before any request', async () => {
    for (const name of ['', 'a/b', '-bad', 'bad-', 'two--dashes', '../x', 'x'.repeat(40), 'a b', 'octo.cat']) expect((await chooseGithubPicture(name)).ok, name).toBe(false);
    expect(fetchImageBytes).not.toHaveBeenCalled();
  });
  it('rejects unsafe links before any request, and shows download problems to the student', async () => {
    for (const link of ['http://example.com/a.jpg', 'https://127.0.0.1/a.jpg', 'file:///etc/passwd', 'x']) expect((await chooseLinkPicture(link)).ok, link).toBe(false);
    expect(fetchImageBytes).not.toHaveBeenCalled();
    vi.mocked(fetchImageBytes).mockRejectedValue(new ImageFetchError('That link is not allowed.'));
    expect(await chooseLinkPicture('https://example.com/a.jpg')).toEqual({ ok: false, message: 'That link is not allowed.' });
    vi.mocked(fetchImageBytes).mockRejectedValue(new Error('socket hang up on 10.0.0.1'));
    expect((await chooseLinkPicture('https://example.com/a.jpg')).message).not.toContain('10.0.0.1');
  });
  it('says so when the image cannot be read or the save is rate limited', async () => {
    vi.mocked(imageToCells).mockResolvedValue(null);
    expect((await chooseLinkPicture('https://example.com/a.jpg')).ok).toBe(false);
    vi.mocked(imageToCells).mockResolvedValue(cells);
    vi.mocked(saveCardArt).mockResolvedValue('limited');
    expect((await chooseLinkPicture('https://example.com/a.jpg')).message).toMatch(/slow down/i);
  });
});
