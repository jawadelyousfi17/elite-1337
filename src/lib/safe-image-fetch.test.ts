import { describe, expect, it } from 'vitest';
import { isPublicAddress, parseImageUrl } from './safe-image-fetch';

describe('isPublicAddress', () => {
  it('accepts public addresses', () => {
    for (const address of ['8.8.8.8', '140.82.112.3', '185.199.108.153', '2606:4700:4700::1111', '2a00:1450:4007:80d::200e']) expect(isPublicAddress(address)).toBe(true);
  });
  it('refuses private, loopback, link-local, shared, multicast and reserved ranges', () => {
    for (const address of ['0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '224.0.0.1', '255.255.255.255', '198.18.0.1',
      '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '2001:db8::1', '::ffff:127.0.0.1', '::ffff:10.0.0.5', '64:ff9b::7f00:1']) expect(isPublicAddress(address), address).toBe(false);
  });
  it('refuses things that are not addresses', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('999.1.1.1')).toBe(false);
  });
  it('treats the edges of the private 172 range correctly', () => {
    expect(isPublicAddress('172.15.0.1')).toBe(true);
    expect(isPublicAddress('172.32.0.1')).toBe(true);
  });
});

describe('parseImageUrl', () => {
  it('accepts https links on real host names', () => {
    expect(parseImageUrl('https://example.com/me.jpg')?.hostname).toBe('example.com');
    expect(parseImageUrl('  https://cdn.example.org:443/a/b.png?x=1 ')?.href).toContain('cdn.example.org');
  });
  it('refuses http, credentials, odd ports, IP literals, local names and junk', () => {
    for (const link of ['http://example.com/a.jpg', 'ftp://example.com/a.jpg', 'https://user:pw@example.com/a.jpg', 'https://example.com:8443/a.jpg', 'https://127.0.0.1/a.jpg', 'https://[::1]/a.jpg',
      'https://169.254.169.254/latest', 'https://localhost/a.jpg', 'https://app.localhost/a.jpg', 'https://printer.local/a.jpg', 'https://db.internal/a.jpg', 'https://intranet/a.jpg', 'not a url', '', 'javascript:alert(1)', `https://example.com/${'a'.repeat(500)}`]) expect(parseImageUrl(link), link).toBeNull();
  });
  it('can be limited to some hosts', () => {
    const hosts = ['github.com', 'avatars.githubusercontent.com'];
    expect(parseImageUrl('https://github.com/x.png', hosts)).not.toBeNull();
    expect(parseImageUrl('https://avatars.githubusercontent.com/u/1', hosts)).not.toBeNull();
    expect(parseImageUrl('https://evil.example/x.png', hosts)).toBeNull();
    expect(parseImageUrl('https://github.com.evil.example/x.png', hosts)).toBeNull();
  });
});
