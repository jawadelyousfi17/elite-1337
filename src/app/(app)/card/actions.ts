'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { clearCardArt, saveCardArt, validCells, type CardArtSource, type SaveResult } from '@/lib/card-art-store';
import { imageToCells } from '@/lib/card-photo';
import { fetchImageBytes, ImageFetchError, parseImageUrl } from '@/lib/safe-image-fetch';

export type PictureResult = { ok: boolean; message: string };
const GITHUB_HOSTS = ['github.com', 'avatars.githubusercontent.com'] as const;
const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const fail = (message: string): PictureResult => ({ ok: false, message });

/** The student always comes from the session, never from the form. */
async function studentId(): Promise<number | null> {
  const id = Number((await auth())?.user?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function finish(result: SaveResult, done: string): PictureResult {
  if (result === 'saved') { revalidatePath('/card'); return { ok: true, message: done }; }
  if (result === 'limited') return fail('Slow down a little, try again in a few seconds.');
  if (result === 'unavailable') return fail('Could not save right now, try again in a minute.');
  return fail('That picture could not be used.');
}
async function fromUrl(userId: number, url: URL, source: CardArtSource, label: string, allowed?: readonly string[]): Promise<PictureResult> {
  try {
    const cells = await imageToCells(await fetchImageBytes(url, allowed));
    if (!cells) return fail('Could not read that image (use a JPG, PNG, WebP or GIF).');
    return finish(await saveCardArt(userId, { source, label, cells: Buffer.from(cells).toString('base64') }), 'Saved. Your card now uses that picture.');
  } catch (error) {
    if (error instanceof ImageFetchError) return fail(error.message);
    console.error('Card picture download failed:', error instanceof Error ? error.name : 'unknown');
    return fail('Could not load that image.');
  }
}

/** Back to the 42 photo. */
export async function chooseIntraPhoto(): Promise<PictureResult> {
  const userId = await studentId();
  return userId ? finish(await clearCardArt(userId), 'Saved. Your card uses your 42 photo.') : fail('Sign in again.');
}
/** An uploaded image, already shrunk to gray cells in the browser, so the file itself never reaches the server. */
export async function chooseUploadedPicture(cells: string): Promise<PictureResult> {
  const userId = await studentId();
  if (!userId) return fail('Sign in again.');
  if (!validCells(cells)) return fail('That image could not be used.');
  return finish(await saveCardArt(userId, { source: 'upload', label: 'Uploaded image', cells }), 'Saved. Your card now uses your image.');
}
export async function chooseGithubPicture(username: string): Promise<PictureResult> {
  const userId = await studentId();
  if (!userId) return fail('Sign in again.');
  const login = String(username).trim().replace(/^@/, '');
  if (!GITHUB_LOGIN.test(login)) return fail('That does not look like a GitHub username.');
  const url = parseImageUrl(`https://github.com/${login}.png?size=240`, GITHUB_HOSTS);
  return url ? fromUrl(userId, url, 'github', `@${login}`, GITHUB_HOSTS) : fail('That does not look like a GitHub username.');
}
export async function chooseLinkPicture(link: string): Promise<PictureResult> {
  const userId = await studentId();
  if (!userId) return fail('Sign in again.');
  const url = parseImageUrl(String(link));
  if (!url) return fail('Use a full https:// link to an image.');
  return fromUrl(userId, url, 'link', url.hostname);
}
