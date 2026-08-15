'use client';
import type { ComponentType, ReactNode } from 'react';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import CoachSeasonChip from '@/components/coaches/CoachSeasonChip';
import type { SeasonView } from '@/lib/coaches-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The ONE page header for every standard coach-portal page (ruling 2026-08-11; binding mockup
 * = COACH_PAGE_HEADER_CONSISTENCY_MOCKUP.html). Fixed slots, enforced by construction:
 *
 *   [icon 22 in the 48px tile] [h1 title + archive chip] [titleChips] … [actions] [help "?"]
 *
 * Three shapes, all owned here so no caller hand-rolls a fourth, and selected by ONE `variant`
 * prop so the set stays exhaustive: `standard` (the page header above), `embedded` (a hub tab
 * whose page header is already on screen — actions only), and `nested` (a hub tab that has
 * drilled into ONE record — the same slots at h2, no season chip, no "?").
 *
 * - NO SUBTITLE SLOT EXISTS. The masthead above owns season + role; live facts live in the
 *   body they describe; required framing lines live in the card they frame. A page that wants
 *   a line under its title is a page trying to re-litigate the ruling.
 * - The help "?" is chrome, not an action: its own slot, always LAST, top-right at every width.
 *   On phones (≤640px) it holds the title line's corner while the actions drop to one
 *   right-pinned row beneath (the .pageHeaderStd grid in coaches.module.css).
 * - Secondary action buttons opt into phone icon-only by wrapping their label in
 *   `styles.headerBtnLabel` + carrying an aria-label; the one lime primary keeps its words.
 * - The archive chip renders INSIDE the <h1> so an archived page's accessible name says so
 *   ("Roster 2025 · Complete") — this was previously done two different ways.
 *
 * CoachModalHeader is this component's older sibling for modals; pages went years without the
 * equivalent and grew ~40 hand-rolled copies, two forked CSS blocks and one live bug.
 */
export default function CoachPageHeader({
  icon: Icon,
  title,
  titleChips,
  season,
  teamBase,
  chipExtraQuery,
  actions,
  actionsPhoneHidden,
  help,
  helpLabel,
  variant = 'standard',
}: {
  /** Section icon, drawn at 22px in the shared 48px tile. Omit only where the ruling omits it (Overview). */
  icon?: ComponentType<{ size?: number | string }>;
  /** The page's name — a string on hub pages, an entity's name on detail pages. */
  title: ReactNode;
  /** Identity/state chips beside the title (premium badge, status badge, division). Never quantities. */
  titleChips?: ReactNode;
  /** Season view → the "{year} · Complete" archive chip inside the h1. Renders nothing live. */
  season?: SeasonView;
  /** `/{org}/coaches/teams/{teamId}` — where the archive chip's season switch lands. */
  teamBase?: string;
  /** Extra query preserved by the chip's season switch (tabbed hubs put the tab here). */
  chipExtraQuery?: string;
  /** The action group — primary + secondaries. Rendered right of the title, left of help. */
  actions?: ReactNode;
  /**
   * This page's actions do not exist at phone width — drop the whole row, don't collapse it.
   *
   * Rule 11 of the page-level action ruling (2026-08-13): "phones get outputs, not files". The
   * Money hub's Import/Export menus produce spreadsheets and need a file picker, so at 390px the
   * header is title and "?" alone. Hiding only the BUTTONS would leave an empty grid row behind
   * and a ~12px dead band under the title, so the flag lives here, on the slot's owner, rather
   * than in each caller's stylesheet.
   *
   * ⚠ Only legal where the actions are genuinely absent on a phone — not as a way to tidy away
   * something a coach still needs there. Anything hidden this way must remain reachable at 390px
   * by another route (for Money, every empty state keeps its import offer).
   */
  actionsPhoneHidden?: boolean;
  /** Help drawer request → the iconOnly "?" in its fixed corner slot. */
  help?: HelpRequest;
  /** The page name the help drawer opens under (falls back to the request's own label). */
  helpLabel?: string;
  /**
   * WHICH of the three shapes this is. One prop rather than a boolean per shape, so the shapes
   * stay exhaustive and the invalid combinations cannot be written: two flags meant
   * `embedded + nested` compiled cleanly and silently rendered the embedded one, and the fourth
   * shape would have made it 2³ nominal states for 4 real ones, disambiguated by branch order.
   *
   * - `standard` (default) — a page's own header: icon · h1 + archive chip · actions · help "?".
   * - `embedded` — hosted inside a hub whose header is already on screen (the Money tabs): ONLY
   *   the right-pinned actions row, same classes and same phone tap-floor, no identity chrome.
   *   The component owns this shape so seven panels can't hand-copy it apart (the budget/bva CSS
   *   forks were exactly that failure one level up).
   * - `nested` — a hub tab that has drilled into ONE record (Money → Fundraisers → one drive).
   *   Same slots one level down: a smaller tile and an `<h2>`, so the hub's `<h1>` keeps naming
   *   the screen and a screen reader gets a real heading hierarchy rather than two competing page
   *   titles. ⚠ `season` and `help` are IGNORED in this shape — the header above already carries
   *   the archive chip and the "?" for this screen, and a second copy of either is two doors to
   *   the same place one line apart. A drill-in that wants its own help topic is a page.
   */
  variant?: 'standard' | 'embedded' | 'nested';
}) {
  const nested = variant === 'nested';
  if (variant === 'embedded') {
    return actions ? (
      <div className={`${styles.pageHeader} ${styles.pageHeaderStd}`}>
        <div className={styles.pageHeaderActions}>{actions}</div>
      </div>
    ) : null;
  }
  return (
    <div className={`${styles.pageHeader} ${styles.pageHeaderStd}${nested ? ` ${styles.pageHeaderNested}` : ''}`}>
      <div className={styles.pageHeaderLeft}>
        {Icon && (
          <div className={`${styles.headerIcon}${nested ? ` ${styles.headerIconNested}` : ''}`}>
            <Icon size={nested ? 18 : 22} />
          </div>
        )}
        <div className={styles.pageTitleWrap}>
          {nested ? (
            <h2 className={`${styles.pageTitle} ${styles.pageTitleNested}`}>{title}</h2>
          ) : (
            <h1 className={styles.pageTitle}>
              {title}
              {season && <CoachSeasonChip season={season} teamBase={teamBase} extraQuery={chipExtraQuery} />}
            </h1>
          )}
          {titleChips}
        </div>
      </div>
      {actions && (
        <div className={`${styles.pageHeaderActions}${actionsPhoneHidden ? ` ${styles.pageHeaderActionsWideOnly}` : ''}`}>
          {actions}
        </div>
      )}
      {/* `!nested` is the doc above made true rather than merely stated: a nested header sits one
          line under a header that already carries this screen's "?", and two of them would be two
          doors to the same drawer. */}
      {help && !nested && (
        <span className={styles.pageHeaderHelp}>
          <HelpButton iconOnly label={helpLabel} help={help} />
        </span>
      )}
    </div>
  );
}
