import type { MetadataRoute } from 'next';
import { brand } from '@/config/brand';

/**
 * robots.txt.
 *
 * Everything behind a session, plus checkout and the parameterised search
 * page, is kept out of the index — those URLs carry personal state or produce
 * near-infinite duplicate content. The canonical entry points for crawlers are
 * the destination, activity and listing pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/account/',
          '/owner/',
          '/book',
          '/book/',
          '/login',
          '/login/',
          '/offline',
          // Faceted search produces unbounded URL variants; the destination
          // pages are the canonical version of the same inventory.
          '/charters/search',
        ],
      },
    ],
    sitemap: `https://${brand.domain}/sitemap.xml`,
    host: `https://${brand.domain}`,
  };
}
