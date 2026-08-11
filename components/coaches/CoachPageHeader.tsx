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
  help,
  helpLabel,
  embedded,
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
  /** Help drawer request → the iconOnly "?" in its fixed corner slot. */
  help?: HelpRequest;
  /** The page name the help drawer opens under (falls back to the request's own label). */
  helpLabel?: string;
  /**
   * Hosted inside a hub whose own header is already on screen (the Money tabs): render ONLY
   * the right-pinned actions row — same classes, same phone tap-floor — and none of the
   * identity chrome. The component owns this shape so six panels can't hand-copy it apart
   * (the budget/bva CSS forks were exactly that failure one level up).
   */
  embedded?: boolean;
}) {
  if (embedded) {
    return actions ? (
      <div className={`${styles.pageHeader} ${styles.pageHeaderStd}`}>
        <div className={styles.pageHeaderActions}>{actions}</div>
      </div>
    ) : null;
  }
  return (
    <div className={`${styles.pageHeader} ${styles.pageHeaderStd}`}>
      <div className={styles.pageHeaderLeft}>
        {Icon && (
          <div className={styles.headerIcon}>
            <Icon size={22} />
          </div>
        )}
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>
            {title}
            {season && <CoachSeasonChip season={season} teamBase={teamBase} extraQuery={chipExtraQuery} />}
          </h1>
          {titleChips}
        </div>
      </div>
      {actions && <div className={styles.pageHeaderActions}>{actions}</div>}
      {help && (
        <span className={styles.pageHeaderHelp}>
          <HelpButton iconOnly label={helpLabel} help={help} />
        </span>
      )}
    </div>
  );
}
