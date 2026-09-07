import {
  PLAN_CONFIG,
  formatPriceAmount,
  foundingSeasonOfferLine,
  FOUNDING_SEASON_AFTER_LINE,
  FOUNDING_SEASON_YEAR_LABEL,
} from '@/lib/plan-config';
import styles from './FoundingSeasonPanel.module.css';

/**
 * The Founding Season offer panel (Founding Season 2027, owner-approved mockups 2026-09-07).
 *
 * ONE component, two placements: the homepage hero (directly under the sub-headline, above the
 * persona cards — `showProducts` lists the two products with the price being waived) and the top
 * of the pricing page (`showProducts` off, because the plan cards beneath carry the prices; it
 * also owns the `#founding-season` anchor the site-wide bar links to).
 *
 * The words are the copy canon's, single-sourced from lib/plan-config.ts so the date can never
 * drift from its own wording: the promise at headline weight, the one offer sentence, and the
 * "after line". The product lines are TEXT, not doors — on the homepage the persona cards directly
 * below are the doors (owner choice 2 of 3, 2026-09-07).
 *
 * Callers render it only while the SIGNUP window is open (`isFoundingSeasonPromoActive`); it does
 * not gate itself, so a caller cannot accidentally mount it beside copy that has already fallen
 * back to the list price.
 */
export default function FoundingSeasonPanel({
  showProducts = false,
  product,
  id,
}: {
  showProducts?: boolean;
  /**
   * The Founding Season speaks for BOTH promos or falls back to Tournament Plus alone
   * (design_decisions 2026-08-08 rule 3): pass `'tournament_plus'` when the Premium Coaches
   * Portal checkout is gated in this environment, so the panel never advertises a product a
   * visitor cannot sign up for (/review 2026-09-07).
   */
  product?: 'tournament_plus';
  id?: string;
}) {
  return (
    <section id={id} className={styles.panel} aria-label="Founding Season offer">
      <div className={styles.lead}>
        <p className={styles.eyebrow}>Founding Season</p>
        <h2 className={styles.headline}>Your {FOUNDING_SEASON_YEAR_LABEL} season, free.</h2>
        <p className={styles.offerLine}>{foundingSeasonOfferLine(product)}</p>
        <p className={styles.afterLine}>{FOUNDING_SEASON_AFTER_LINE}</p>
      </div>
      {showProducts && (
        <dl className={styles.products}>
          <div className={styles.product}>
            <dt className={styles.productName}>Tournament Plus</dt>
            <dd className={styles.productPrice}>normally {formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month</dd>
          </div>
          {product !== 'tournament_plus' && (
            <div className={styles.product}>
              <dt className={styles.productName}>Premium Coaches Portal</dt>
              <dd className={styles.productPrice}>normally {formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
