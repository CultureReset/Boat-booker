import type { MetadataRoute } from 'next';
import { brand } from '@/config/brand';
import { activities, boatTypes } from '@/config/taxonomy';
import { staticPages } from '@/content/pages';
import { getDb } from '@/lib/storage';

/**
 * XML sitemap.
 *
 * Built from live data so a listing that is unpublished today is not still
 * being advertised to crawlers tomorrow. Authenticated areas, checkout and the
 * bare search page are deliberately absent — they are marked `noindex` too.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${brand.domain}`;
  const now = new Date();

  const db = await getDb();

  const published = db.charters.filter((charter) => charter.published && !charter.snoozed);

  const destinationIds = new Set(published.map((charter) => charter.destinationId));

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/activity`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/boat-type`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/locations`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/countries`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/states`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/sitemap`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/boating-near-me`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/loyalty`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  for (const page of staticPages) {
    entries.push({
      url: `${base}/pages/${page.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    });
  }

  for (const activity of activities) {
    entries.push({
      url: `${base}/activity/${activity.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const type of boatTypes) {
    entries.push({
      url: `${base}/boat-type/${type.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  for (const destination of db.destinations) {
    // Only destinations with inventory are worth a crawl budget.
    if (!destinationIds.has(destination.id)) continue;
    entries.push({
      url: `${base}/destination/${destination.slug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  for (const charter of published) {
    entries.push({
      url: `${base}/charters/view/${charter.id}`,
      lastModified: new Date(charter.availabilityUpdatedAt),
      changeFrequency: 'daily',
      priority: 0.8,
    });
  }

  return entries;
}
