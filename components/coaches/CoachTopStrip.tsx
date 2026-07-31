'use client';

/**
 * CoachTopStrip — the operator frame strip in the PREMIUM coach portal (Nav Unification
 * Stage H.1; D2 ratified 2026-07-31: "the FieldLogicHQ branding applies to the coaches
 * portal just like tournament admin — same product surface, admin hubs"). Reverses the
 * portal's no-wordmark ruling — logged in memory/design_decisions.md the same day.
 *
 * Sibling of AdminTopStrip: same anatomy (shared BrandLockup left; personal doors right),
 * this shell's skin — the CSS reads the portal's own tokens, so the strip flips warm/dark
 * with the account theme exactly like the sidebar beside it. Desktop >900px only; the
 * phone portal keeps its bottom nav + More sheet (mobile doors = the Stage H mobile pass,
 * gated on the More-sheet overflow check).
 *
 * Deliberate differences from AdminTopStrip (approved mockup = spec):
 *  • NO bell — the portal's NotificationBell stays in the sidebar header (its
 *    notifications are portal-scoped; the mockup shows no bell in this strip).
 *  • NO chat door — owner ruling 2026-07-31, see below.
 *
 * ⚠ THE CHAT DOOR WAS REMOVED (owner-ruled 2026-07-31; logged in memory/design_decisions.md —
 * do NOT re-add it from the earlier mockup). It was justified here as "your own conversations"
 * versus the portal's "team chat", but that distinction does not exist: the portal's own Chat
 * screen is per-USER, not per-team — it resolves from the same chat membership, lists the same
 * staff + tournament rooms, and heads itself "Your chats". So the strip's icon was a second
 * desktop door to the same conversations, sitting beside the sidebar's "Chat" at the same width.
 *
 * The portal's door won because this one EJECTED the coach into consumer chrome — the trip that
 * already needed a "Back to your Coaches Portal" rescue link added at A3 QA. The strip keeps only
 * genuine leave-this-place doors (wordmark · account · workspaces); chat is a section of the work,
 * not an exit. Side effect: this shell no longer runs a third always-mounted chat-unread pipeline,
 * which retires the KNOWN COST this file used to carry.
 */

import Link from 'next/link';
import { User } from 'lucide-react';
import BrandLockup from '@/components/shared/BrandLockup';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import { useRoleSummary } from '@/lib/use-role-summary';
import styles from './CoachTopStrip.module.css';

export default function CoachTopStrip() {
  // The premium portal only renders signed-in, so this may run unconditionally.
  const roleSummary = useRoleSummary(true);

  return (
    <header className={styles.strip}>
      <BrandLockup
        fieldClassName={styles.logoField}
        logicClassName={styles.logoLogic}
        hqClassName={styles.logoHq}
      />
      <div className={styles.doors}>
        <Link href="/account" className={styles.iconDoor} aria-label="Account">
          <User size={17} strokeWidth={1.8} />
        </Link>
        {/* 2+ places only (shared threshold inside the pill) — a single-team coach is
            already standing in their one place. warm: the popover reads the portal's
            --home-* set when the warm skin is active (falls back to HUD tokens in dark). */}
        <WorkspacesPill workspaces={roleSummary?.workspaces ?? []} className={styles.pill} warm />
      </div>
    </header>
  );
}
