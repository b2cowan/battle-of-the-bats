import type { MetadataRoute } from 'next';
import { getDirectorySitemapEntries } from '@/lib/directory';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

// Dynamic — every opted-in, publicly-visible tournament page is enumerated here so
// search engines can find them, alongside the core marketing pages.
export const dynamic = 'force-dynamic';

// Public marketing surfaces (the only logged-out, indexable top-level routes).
const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                          priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/discover',                 priority: 0.9, changeFrequency: 'daily'   },
  { path: '/pricing',                  priority: 0.7, changeFrequency: 'monthly' },
  { path: '/for-tournament-organizers', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-leagues',              priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-clubs',                priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-coaches',              priority: 0.6, changeFrequency: 'monthly' },
  { path: '/changelog',                priority: 0.5, changeFrequency: 'weekly'  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(s => ({
    url: `${SITE_URL}${s.path}`,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  let tournamentEntries: MetadataRoute.Sitemap = [];
  try {
    const entries = await getDirectorySitemapEntries();
    tournamentEntries = entries.map(e => ({
      url: `${SITE_URL}${e.href}`,
      lastModified: e.lastModified ? new Date(e.lastModified) : undefined,
      changeFrequency: 'daily',
      priority: 0.6,
    }));
  } catch {
    // Never let a directory-query hiccup break the whole sitemap — ship the static set.
    tournamentEntries = [];
  }

  return [...staticEntries, ...tournamentEntries];
}
