import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  // Never include room, participant or generated-result URLs.
  return [{ url: SITE_URL }];
}
