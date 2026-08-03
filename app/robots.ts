import type { MetadataRoute } from 'next';
import { DEMO_ORG_SLUGS } from '@/lib/demo-org';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep private/authenticated surfaces out of the index. Public tournament pages
      // (/{org}/{tournament}) and the marketing site stay crawlable; the org-scoped
      // operator/coach/volunteer routes and API/auth do not.
      disallow: [
        '/api/',
        '/auth/',
        '/platform-admin/',
        '/coaches/',
        '/*/admin',
        '/*/coaches',
        '/*/scorekeeper',
        '/*/official',
        '/*/check-in',
        // The "See it live" door and every page of every sandbox org. A demo org's fan pages are
        // GENUINE public tournament pages — left unmarked they can be indexed and surface in a
        // search for a real event, or be mistaken for a real association. Belt and braces with the
        // per-page `noindex` the org layout emits: robots.txt asks a crawler not to fetch, the
        // meta tag stops a page that was fetched anyway from being listed.
        '/see-it-live',
        // BOTH forms per org. robots.txt matches by PREFIX, so `/riverdale-minor-ball/` covers
        // every subpage but can never match the bare org root `/riverdale-minor-ball` — which is
        // the org's own home page, and exactly the URL most likely to be mistaken for a real
        // association. (The per-page `noindex` covers it either way; this closes the fetch.)
        ...DEMO_ORG_SLUGS.flatMap(slug => [`/${slug}`, `/${slug}/`]),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
