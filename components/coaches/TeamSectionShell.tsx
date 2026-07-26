import type { ReactNode } from 'react';
import shared from '@/app/coaches/coaches-portal.module.css';
import styles from '@/app/coaches/team/[basicTeamId]/team.module.css';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';

/**
 * Shared page frame for a team section sub-route (roster / schedule / fees /
 * announcements / tournaments / explore). Team identity now lives in the persistent
 * shell header (A2 consumer chrome — the old per-page identity band is retired, so the
 * team name is stated once, by the chrome). Each section keeps the section-header
 * grammar: mono eyebrow title (the page's h1) + optional right-aligned meta + "?" help.
 */
export default function TeamSectionShell({
  title,
  meta,
  help,
  children,
}: {
  /** Kept for call-site compatibility; the shell header renders the team name now. */
  teamName?: string;
  title: string;
  /** Optional right-aligned header meta (e.g. "12 players"). */
  meta?: ReactNode;
  /** Optional in-context "?" help — opens the matching coaches guide section in the drawer. */
  help?: HelpRequest;
  children: ReactNode;
}) {
  return (
    <div className={`${shared.page} ${styles.pageWide}`}>
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h1 className={shared.sectionTitle}>{title}</h1>
          <div className={styles.sectionHeadEnd}>
            {meta}
            {help && <HelpButton help={help} label={title} iconOnly />}
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}
