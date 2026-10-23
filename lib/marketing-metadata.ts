import type { Metadata } from 'next';

/**
 * THE MARKETING SET'S TITLES, DESCRIPTIONS AND SHARE CARD — one helper (The public face, warm: S4; P7 "every page says
 * what it is when shared"; owner Ask 8 A, 2026-10-23; the words are `/marketing`'s, PUBLIC_FACE_WARM_S4_COPY.md 1–7).
 *
 * ⚖ A page's own title never carries the brand, a dash or "FieldLogicHQ": the root layout adds " | FieldLogicHQ" once.
 * (Fourteen pages used to add it themselves, so a tab read "Pricing — FieldLogicHQ | FieldLogicHQ".) Home is the one
 * exception, with an absolute title. `tests/unit/public-face-s4-marketing.test.ts` holds both.
 *
 * ⚖ The share card is the MARKETING site's — scoped here, page by page, and deliberately NOT a root `opengraph-image`,
 * which would reach every top-level route without a card of its own. Club and tournament pages keep their own cards
 * (M2: an org's brand wins on its own pages); the neutral fallback is S5's.
 */

export const SITE_NAME = 'FieldLogicHQ';

/** The site's one description (words doc item 1): every page without its own, the home page, and the app manifest. */
export const SITE_DESCRIPTION =
  'Less admin. More sport. Tournaments, house leagues, rep teams and club accounting in one place, for the volunteers who run community sport.';

/** The marketing share card, drawn by `app/share-card.png/route.tsx`. */
export const MARKETING_SHARE_CARD = {
  url: '/share-card.png',
  width: 1200,
  height: 630,
  alt: 'FieldLogicHQ. Less admin. More sport.',
} as const;

type MarketingPage = {
  /** The page's own name, sentence case, no brand (the layout adds it). */
  title: string;
  /** The page's own description; omitted, the site's. */
  description?: string;
  /** The page's address, for the card's link and the canonical. */
  path: string;
  /** Keep the page out of search results (the prospect page, the "open the live demo" doors). */
  noindex?: boolean;
  /** Home only: the whole title, with no " | FieldLogicHQ" added. */
  absolute?: boolean;
};

/** Metadata for one marketing page: its title and description, its canonical, and the shared card. */
export function marketingMetadata({ title, description, path, noindex, absolute }: MarketingPage): Metadata {
  const shared = absolute ? title : `${title} | ${SITE_NAME}`;
  const desc = description ?? SITE_DESCRIPTION;
  return {
    title: absolute ? { absolute: title } : title,
    description: desc,
    ...(noindex ? { robots: { index: false, follow: false } } : { alternates: { canonical: path } }),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: shared,
      description: desc,
      url: path,
      images: [MARKETING_SHARE_CARD],
    },
    twitter: {
      card: 'summary_large_image',
      title: shared,
      description: desc,
      images: [MARKETING_SHARE_CARD.url],
    },
  };
}
