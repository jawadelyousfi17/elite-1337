import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl.href }, { url: new URL('/privacy', siteUrl).href }, { url: new URL('/terms', siteUrl).href }];
}
