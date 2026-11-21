import fp from '@/components/marketing/ForPage.module.css';

/**
 * THE ON-SALE PAGES' PICTURES (S3b, W67; owner 2026-11-20: option A, the product's own screens). Each is shot by
 * `scripts/capture-on-sale-pictures.mjs` from Kestrel Bay, an invented club on the dev database, into
 * public/marketing/on-sale/ — 16:10 at 2× — and re-shot quarterly by the `/demos` pass. A plain <img> (no next/image: the
 * sharp-on-Amplify history, and the both-states unit test renders these pages without it). The caption under the grid says
 * they are the product's own screens with a fictional club; no figure is quoted in a caption or alt text.
 */
export const ON_SALE_SHOTS = {
  'leagues-01-registrations': 'The registrations list, with new sign-ups waiting for review',
  'leagues-02-draft': 'The draft board, placing players on teams',
  'leagues-03-standings': "A division's standings on the league's public page",
  'leagues-04-email': 'The Email families window',
  'clubs-01-event': "A tournament's public page, with games live now and the latest results",
  'clubs-02-registrations': 'The house league registrations list',
  'clubs-03-roster': "A coach's team roster in the Premium Coaches Portal",
  'clubs-04-budget': "Budget vs. Actual for the club's fiscal year",
} as const;

export type OnSaleShot = keyof typeof ON_SALE_SHOTS;

export function ScreenShot({ id }: { id: OnSaleShot }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed marketing picture; see the note above
    <img
      src={`/marketing/on-sale/${id}.png`}
      alt={ON_SALE_SHOTS[id]}
      width={1600}
      height={1000}
      loading="lazy"
      decoding="async"
      className={fp.shot}
    />
  );
}

/** The one caption under each page's four pictures (W67, as ruled 2026-11-20). */
export const shotCaption = (who: 'club' | 'house league') =>
  `These are the product's own screens, shown with a fictional ${who}.`;
