import type { MetadataRoute } from 'next';

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
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
