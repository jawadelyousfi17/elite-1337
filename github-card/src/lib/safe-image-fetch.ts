import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

/** An error whose message is safe to show the student. */
export class ImageFetchError extends Error {}

const MAX_BYTES = 2 * 1024 * 1024, MAX_REDIRECTS = 3, TIMEOUT_MS = 6_000;

/** True only for addresses on the public internet; private, loopback, link-local, multicast and reserved ranges are refused. */
export function isPublicAddress(address: string): boolean {
  const v4 = (text: string) => {
    const parts = text.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b, c] = parts;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 0) || (a === 192 && b === 0 && c === 2) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
  };
  if (isIP(address) === 4) return v4(address);
  if (isIP(address) !== 6) return false;
  const text = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (mapped) return v4(mapped[1]);
  if (text === '::' || text === '::1' || /^(fc|fd|fe[89ab]|ff)/.test(text) || text.startsWith('2001:db8') || text.startsWith('64:ff9b') || text.startsWith('100:')) return false;
  return true;
}

/** An https URL on a normal port with a real host name (no IP literals, credentials or localhost), optionally limited to some hosts. */
export function parseImageUrl(input: string, allowedHosts?: readonly string[]): URL | null {
  if (input.length > 500) return null;
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || isIP(host.replace(/^\[|\]$/g, ''))) return null;
  if (allowedHosts && !allowedHosts.includes(host)) return null;
  return url;
}

type Reply = { status: number; location?: string; type: string; body: Uint8Array };

/** One GET connected to `address` (already checked), so a second DNS answer cannot redirect it to a private host. */
function get(url: URL, address: { address: string; family: number }): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', timeout: TIMEOUT_MS, headers: { accept: 'image/*', 'user-agent': 'elite-1337-card' },
      lookup: ((_host: string, options: { all?: boolean }, callback: (error: Error | null, address: unknown, family?: number) => void) =>
        options?.all ? callback(null, [{ address: address.address, family: address.family }]) : callback(null, address.address, address.family)) as never,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { req.destroy(); reject(new ImageFetchError('That image is too big (2 MB at most).')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, type: String(res.headers['content-type'] ?? '').toLowerCase(), body: new Uint8Array(Buffer.concat(chunks)) }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new ImageFetchError('That link took too long to answer.')); });
    req.on('error', (error) => reject(error instanceof ImageFetchError ? error : new ImageFetchError('Could not load that link.')));
    req.end();
  });
}

/**
 * Downloads an image for the rank card. Every hop (the first URL and each redirect) must be https, on a real host name
 * and resolve only to public addresses; the body is capped at 2 MB and must be a raster image. SVG is refused.
 */
export async function fetchImageBytes(start: URL, allowedHosts?: readonly string[]): Promise<Uint8Array> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let answers;
    try { answers = await lookup(url.hostname, { all: true }); } catch { throw new ImageFetchError('That link could not be found.'); }
    if (!answers.length || !answers.every((entry) => isPublicAddress(entry.address))) throw new ImageFetchError('That link is not allowed.');
    const reply = await get(url, answers[0]);
    if (reply.status >= 300 && reply.status < 400 && reply.location) {
      const next = parseImageUrl(new URL(reply.location, url).href, allowedHosts);
      if (!next) throw new ImageFetchError('That link redirects somewhere that is not allowed.');
      url = next;
      continue;
    }
    if (reply.status === 404) throw new ImageFetchError('Nothing found at that link.');
    if (reply.status !== 200) throw new ImageFetchError('That link did not return an image.');
    if (!reply.type.startsWith('image/') || reply.type.includes('svg')) throw new ImageFetchError('That link is not a photo (use a JPG, PNG, WebP or GIF).');
    return reply.body;
  }
  throw new ImageFetchError('That link redirects too many times.');
}
