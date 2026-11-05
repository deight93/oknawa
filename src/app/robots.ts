import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    // Allow crawling so crawlers can read noindex on input and result pages.
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
