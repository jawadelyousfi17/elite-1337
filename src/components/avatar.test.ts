import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar, safeAvatarSrc } from './avatar';

describe('avatar rendering', () => {
  it('renders initials as the fallback', () => {
    expect(renderToStaticMarkup(createElement(Avatar, { login: 'yikoubaz' }))).toContain('YI');
  });
  it('only loads on-site signed avatar and photo references', () => {
    expect(safeAvatarSrc('https://cdn.intra.42.fr/users/photo.jpg')).toBeNull();
    expect(safeAvatarSrc('/api/avatars/42?v=current')).toBe('/api/avatars/42?v=current');
    expect(safeAvatarSrc('/api/photos/42?p=x&s=y')).toBe('/api/photos/42?p=x&s=y');
    expect(safeAvatarSrc(null)).toBeNull();
  });
});
