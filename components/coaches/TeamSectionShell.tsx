import type { CSSProperties, ReactNode } from 'react';
import { teamColor, teamInitials } from '@/lib/team-color';
import shared from '@/app/coaches/coaches-portal.module.css';
import styles from '@/app/coaches/team/[basicTeamId]/team.module.css';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';

/**
 * Shared header + page frame for a team section sub-route (roster / schedule / fees /
 * announcements / tournaments). Renders the team identity band (same one the Overview uses)
 * + a section title, then the section body. Keeps every sub-route thin and visually identical
 * so the team identity is constant as the coach moves between sections.
 */
export default function TeamSectionShell({
  teamName,
  title,
  meta,
  help,
  children,
}: {
  teamName: string;
  title: string;
  /** Optional right-aligned header meta (e.g. "12 players"). */
  meta?: ReactNode;
  /** Optional in-context "?" help — opens the matching coaches guide section in the drawer. */
  help?: HelpRequest;
  children: ReactNode;
}) {
  return (
    <div className={`${shared.page} ${styles.pageWide}`}>
      <div
        className={styles.identityBand}
        style={{ '--team-color': teamColor(teamName) } as CSSProperties}
      >
        <p className={styles.identityWatermark} aria-hidden>{teamInitials(teamName)}</p>
        <div className={styles.identityMonogram} aria-hidden>{teamInitials(teamName)}</div>
        <div className={styles.identityText}>
          <h1 className={styles.identityName}>{teamName}</h1>
          <p className={styles.identityMeta}>{title}</p>
        </div>
        {help && (
          <div className={styles.identityHelp}>
            <HelpButton help={help} label={title} iconOnly />
          </div>
        )}
      </div>

      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>{title}</h2>
          {meta && <div style={{ marginLeft: 'auto' }}>{meta}</div>}
        </div>
        {children}
      </section>
    </div>
  );
}
