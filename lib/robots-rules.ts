import type { MetadataRoute } from 'next';
import { RETIRED_DEMO_ORG_SLUGS } from './reserved-slugs';
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
        // The two retired demo clubs (owner 2026-11-25; their names stay reserved). Old links and cached pages still
        // point at them, and a crawler has no reason to fetch an address that no longer serves a club.
        // BOTH forms per org. robots.txt matches by PREFIX, so `/riverdale-minor-ball/` covers
        // every subpage but can never match the bare org root `/riverdale-minor-ball`.
        ...RETIRED_DEMO_ORG_SLUGS.flatMap(slug => [`/${slug}`, `/${slug}/`]),
      ],
    },
    sitemap: `${siteOriginForHost(host, configuredSiteUrl)}/sitemap.xml`,
  };
}
