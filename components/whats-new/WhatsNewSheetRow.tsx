'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { markReleasesSeen, useReleaseUnread } from './release-seen';
import styles from './whats-new.module.css';

/**
 * The phone More sheet's "What's new" tile (owner 2026-11-07): the "You" group's row, beside Account, for the club admin's,
 * the Premium coach's and the free coach's sheets. The sheets each own their row look (`itemClass` is the bar's own
 * dropItem), so this renders no skin of its own. It sits in the "You" group, NOT in the foot (Help · Send feedback ·
 * Download app · Sign out), whose order is nav standard N7. Opens the public release notes in a new tab and clears the
 * "New" tag; the sheet closes a beat later so the new tab is not cancelled.
 */
export default function WhatsNewSheetRow({ itemClass, id, onClose }: { itemClass: string; id: string; onClose: () => void }) {
  const unread = useReleaseUnread();
  return (
    <Link
      className={itemClass}
      href="/changelog"
      target="_blank"
      rel="noopener noreferrer"
      role="menuitem"
      id={id}
      onClick={() => { markReleasesSeen(); window.setTimeout(onClose); }}
    >
      <Sparkles size={17} aria-hidden /><span>What’s new</span>
      {unread && <span className={styles.newTag}>New</span>}
    </Link>
  );
}
