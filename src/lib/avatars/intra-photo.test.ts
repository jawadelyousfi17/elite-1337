import { beforeEach, describe, expect, it } from 'vitest';
import { cursusUserSchema } from '../fortytwo-api';
import { intraPhotoPath, intraPhotoUrl, photoContentType, photoReferences, validPhotoSignature } from './intra-photo';

const small = '/users/c10658bc667e3e1f6e21cac83d956028/small_tester.jpg';
const image = { link: 'https://cdn.intra.42.fr/users/68081dc9aaae5bf6dd3721196607f67c/tester.jpg', versions: { small: `https://cdn.intra.42.fr${small}` } };
beforeEach(() => { process.env.AUTH_SECRET = 'test-secret-for-photo-signatures'; });

describe('42 Intra photo references', () => {
  it('keeps only the small CDN path and rejects other hosts or shapes', () => {
    expect(intraPhotoPath(image)).toBe(small);
    expect(intraPhotoPath({ link: image.link })).toBe('/users/68081dc9aaae5bf6dd3721196607f67c/tester.jpg');
    expect(intraPhotoPath({ link: 'https://evil.example/users/68081dc9aaae5bf6dd3721196607f67c/a.jpg' })).toBeNull();
    expect(intraPhotoPath({ link: 'http://cdn.intra.42.fr/users/68081dc9aaae5bf6dd3721196607f67c/a.jpg' })).toBeNull();
    expect(intraPhotoPath({ link: 'https://cdn.intra.42.fr/users/../../etc/passwd' })).toBeNull();
    expect(intraPhotoPath(null)).toBeNull();
    expect(intraPhotoPath('not an object')).toBeNull();
  });
  it('never fails API parsing because of a malformed image', () => {
    const record = { id: 1, cursus_id: 21, level: 3, user: { id: 7, login: 'tester', image: { link: 42 } } };
    expect(cursusUserSchema.parse(record).user.image).toBeNull();
    expect(cursusUserSchema.parse({ ...record, user: { id: 7, login: 'tester', image } }).user.image).toBe(small);
  });
  it('signs each photo path for one user only', () => {
    const url = new URL(intraPhotoUrl(7, small)!, 'http://localhost');
    expect(url.pathname).toBe('/api/photos/7');
    const signature = url.searchParams.get('s')!;
    expect(validPhotoSignature(7, url.searchParams.get('p')!, signature)).toBe(true);
    expect(validPhotoSignature(8, small, signature)).toBe(false);
    expect(validPhotoSignature(7, '/users/c10658bc667e3e1f6e21cac83d956028/small_other.jpg', signature)).toBe(false);
    expect(intraPhotoUrl(7, null)).toBeNull();
  });
  it('prefers an uploaded avatar over the 42 photo', () => {
    const references = photoReferences([{ id: 7, photo: small }, { id: 8, photo: small }, { id: 9, photo: null }], { 8: '/api/avatars/8?v=x' });
    expect(references[7]).toMatch(/^\/api\/photos\/7\?/);
    expect(references[8]).toBe('/api/avatars/8?v=x');
    expect(references[9]).toBeUndefined();
  });
  it('recognizes image bytes and rejects HTML', () => {
    expect(photoContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(photoContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(photoContentType(new TextEncoder().encode('<html>403</html>'))).toBeNull();
  });
});
