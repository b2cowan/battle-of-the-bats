import type { MetadataRoute } from 'next';
import { DEMO_ORG_SLUGS } from './demo-org';
import { siteOriginForHost } from './own-hosts';

/**
 * robots.txt for the host a request arrived on (`app/robots.ts` supplies the host). Pure so a test can pin
 * it per host: on a club's own web address (Club Tier 4e) the sitemap line must name THAT address - a
 * crawler told to read another host's sitemap would index the wrong site's pages.
 */
export function robotsFor(host: string | null | undefined, configuredSiteUrl: string): MetadataRoute.Robots {
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
    sitemap: `${siteOriginForHost(host, configuredSiteUrl)}/sitemap.xml`,
  };
}
