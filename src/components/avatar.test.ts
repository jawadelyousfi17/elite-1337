import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar, safeAvatarSrc } from './avatar';

describe('avatar rendering', () => {
  it('renders two login characters with no fallback image', () => {
    const html = renderToStaticMarkup(createElement(Avatar, { login: 'yikoubaz' }));
    expect(html).toContain('avatar-fallback');
    expect(html).not.toContain('<img');
    expect(html).toContain('YI');
  });
  it('prefers the name when provided', () => {
    const html = renderToStaticMarkup(createElement(Avatar, { login: 'yikoubaz', name: 'Jawad' }));
    expect(html).toContain('JA');
  });
  it('keeps initials visible in the skeleton while a photo loads', () => {
    const html = renderToStaticMarkup(createElement(Avatar, { login: 'yikoubaz', src: '/api/avatars/42' }));
    expect(html).toContain('is-loading');
    expect(html).toContain('YI');
    expect(html).not.toContain('profile-fallback');
  });
  it('only loads on-site signed avatar and photo references', () => {
    expect(safeAvatarSrc('https://cdn.intra.42.fr/users/photo.jpg')).toBeNull();
    expect(safeAvatarSrc('/api/avatars/42?v=current')).toBe('/api/avatars/42?v=current');
    expect(safeAvatarSrc('/api/photos/42?p=x&s=y')).toBe('/api/photos/42?p=x&s=y');
    expect(safeAvatarSrc(null)).toBeNull();
  });
});
