'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import styles from './TournamentAdminUI.module.css';

/**
 * The page header the tournament screens share (schedule, results, registrations, check-in, communication).
 *
 * It is `AdminPageHeader`: the page's name as the title in sentence case, and nothing above
 * it — the pinned event header directly above names the event, so a page names only itself (Tournament
 * admin redesign G1, 2026-09-29). On a phone the page's actions and "?" join the title's line. No icon
 * tile and no subtitle (F3). `meta` — the one live fact, the Schedule's "Published" — becomes a state chip
 * beside the title. The read-only banner stays under the header.
 *
 * ⚰ The switch-off branch (the console header: lime eyebrow, monospace title, subtitle) and the unused
 * toolbar parts that lived in this file went with admin type sweep Stage 5 (2026-10-20): the admin
 * layout always turns the kit on, and nothing imported the toolbar parts.
 */
export function TournamentAdminHeader({
  title,
  meta,
  actions,
  help,
  locked = false,
}: {
  /** The page's name, in sentence case. */
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** When set, renders a "?" Help button in the header actions that opens the
   *  in-context HelpDrawer to this page's mapped guide section(s). */
  help?: HelpRequest;
  /** When true, renders a read-only banner below the header. */
  locked?: boolean;
}) {
  // The "?" is named after the title, and is the coaches portal's bare glyph at every width
  // (owner, 2026-10-01).
  const helpButton = help && <HelpButton help={help} label={typeof title === 'string' ? title : undefined} iconOnly />;
  return (
    <>
      <AdminPageHeader
        inlineActions
        title={title}
        titleChips={meta}
        actions={(actions || help) ? <>{actions}{helpButton}</> : undefined}
      />
      {locked && (
        <div className={styles.kitLockedBanner} role="status">
          <Lock size={13} aria-hidden />
          {/* The one "completed and locked" sentence (Stage 4): the way back is the record's Reopen. */}
          <span>{LOCKED_RESULTS}</span>
        </div>
      )}
    </>
  );
}
