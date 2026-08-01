import type { MetadataRoute } from 'next';
import { getDirectorySitemapEntries, getOrgSitemapEntries } from '@/lib/directory';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

// Dynamic — every opted-in, publicly-visible tournament page is enumerated here so
// search engines can find them, alongside the core marketing pages.
export const dynamic = 'force-dynamic';

// Public marketing surfaces (the only logged-out, indexable top-level routes).
const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                          priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/discover',                 priority: 0.9, changeFrequency: 'daily'   },
  { path: '/scores',                   priority: 0.8, changeFrequency: 'daily'   },
  { path: '/pricing',                  priority: 0.7, changeFrequency: 'monthly' },
  { path: '/for-tournament-organizers', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-leagues',              priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-clubs',                priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-coaches',              priority: 0.6, changeFrequency: 'monthly' },
  { path: '/changelog',                priority: 0.5, changeFrequency: 'weekly'  },
];

/** Map one dynamic scan's rows into sitemap entries, or contribute nothing if the scan fails.
 *  States the fail-quiet contract once, for every scan. */
async function safeEntries<T>(
  scan: Promise<T[]>,
  toEntry: (row: T) => MetadataRoute.Sitemap[number],
): Promise<MetadataRoute.Sitemap> {
  try {
    return (await scan).map(toEntry);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(s => ({
    url: `${SITE_URL}${s.path}`,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  // Each dynamic scan fails INDEPENDENTLY and quietly: one hiccup must not cost the sitemap the
  // other scan's pages, and neither may break the static set above.
  const [tournamentEntries, orgEntries] = await Promise.all([
    safeEntries(getDirectorySitemapEntries(), e => ({
      url: `${SITE_URL}${e.href}`,
      lastModified: e.lastModified ? new Date(e.lastModified) : undefined,
      changeFrequency: 'daily',
      priority: 0.6,
    })),
    // Nav Unification Stage E.4 — an org's public home, but ONLY where that page is a real
    // destination (the resolver applies the shared rule); a redirecting or placeholder page is
    // never emitted. Ranked just under its own event pages: the hub is a genuine landing page
    // for a club's families, but an event page is what a search is usually looking for.
    safeEntries(getOrgSitemapEntries(), e => ({
      url: `${SITE_URL}${e.href}`,
      changeFrequency: 'weekly',
      priority: 0.5,
    })),
  ]);

  return [...staticEntries, ...tournamentEntries, ...orgEntries];
}
