'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import styles from './TournamentAdminUI.module.css';

/**
 * The page header the tournament screens share (schedule, results, registrations, check-in, communication).
 *
 * It is `AdminPageHeader`: the page's name as the title in sentence case, and nothing above
 * it — the pinned event header directly above names the event, so a page names only itself (Tournament
 * admin redesign G1, 2026-09-29). On a phone the page's actions join the title's line. ⚖ The page's "?" is the chrome's since
 * navigation Phase 6b (owner 2026-11-13): the strip between the bell and the account button, the phone bar's last control
 * (`lib/admin-page-help.ts`), so this header has no `help` prop and a header with no buttons draws no row. No icon
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
  locked = false,
}: {
  /** The page's name, in sentence case. */
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** When true, renders a read-only banner below the header. */
  locked?: boolean;
}) {
  return (
    <>
      <AdminPageHeader
        inlineActions
        title={title}
        titleChips={meta}
        actions={actions}
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
