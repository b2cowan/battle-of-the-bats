'use client';
import { useId, useRef, type RefObject } from 'react';
import type { ActivityEntry } from '@/lib/notification-view';
import NotificationMessage from './NotificationMessage';
import type { NotificationFeed } from './useNotificationFeed';
import SheetFrame from '@/components/coaches/SheetFrame';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import own from './NotificationReader.module.css';

/**
 * THE NOTIFICATION READER — a notification, opened from a Notifications page (owner ruling
 * 2026-09-25, D3 option B, on the mockup "One Row for Notifications"). A tap on a row opens this
 * instead of leaving the page: the whole message, the day and the clock it arrived, and ONE button on
 * to the place that deals with it. Opening it marks it read — the owner's reason for the ruling: *"it
 * allows me to mark individual ones as read (open, read, close) without having to leave the
 * notifications page."* Going on is a second, deliberate tap.
 *
 * It also closes the hole the 09-24 phone clamp left: the week in review is cut to two lines on a
 * phone, and its link (Insights) describes the team TODAY — so an older review had nowhere to be
 * read. Here it reads whole, whatever its age.
 *
 * ⚖ ONE READER, BOTH PORTALS (Notifications Open in Place step 3, owner 2026-10-06, Q1 on hub screen
 * 10). The coach's Notifications page has worn it since 09-25; the ADMIN's page wears it too (D5: "the
 * coach's 09-25 sheet in the admin's styling") — on a phone the admin's only place to read a
 * notification, since neither portal has a bell there. It moved here from `components/coaches/` so the
 * two pages share one file, not two frames that drift. `portal` names whose page words the onward
 * button speaks (D4). The admin's in-tree marker (`adminKitAttr`) carries the same
 * `data-coach-warm-enabled` the coach shell does, so the warm remaps reach it unchanged.
 * ⚠ It must never load `coaches.module.css` (~945KB): the admin renders it. The sheet frame stopped
 * borrowing that stylesheet for its dim in Sheet Frame step 4 — which is what let this reader onto it.
 *
 * ⚖ THIS FILE IS THE FRAME; THE MESSAGE IS SHARED (step 2, 2026-10-06). What the reader SAYS — the kind
 * and stamp, the title, the body or the bundle's members, and Open · Done · Close · Delete in that order
 * — is `NotificationMessage`, the block the bell's drawer wears too, so the two cannot drift (hub screen
 * 7). Close is passed in because this frame closes from its button row; the drawer's pane closes with
 * its own ×.
 *
 * ⚖ A MENU, NOT A FORM, by the drawer ruling (2026-09-23): nothing is typed and nothing can be lost.
 * Wherever the bar shows (≤900) it is the portal's sheet frame in the MENU layer (Sheet Frame step 4,
 * 2026-10-06): on the bar, the bar lit and tappable beneath it, never modal. The frame owns its keys
 * (every sheet's since step 5; owner 2026-10-06 — what the old floor gave it stays: Escape, the phone's Back, focus in on
 * open and home to the row; the hold on the keyboard goes, and Tab past the end closes it) and closes it
 * on a tap on the bar BEFORE the bar acts — the More sheet draws over a sheet still standing, which is
 * how the 09-25 /review found the reader buried under More; the frame's rule is that review's fix. Its
 * record head keeps the grab line as a 44px Close (`grabCloses`). Above 900 — no bar — the same message
 * is a small centred dialog on its own floor (the RSVP sheet's answer, same reason).
 *
 * Done and Delete act on the FEED here, once for both pages, then close. The reader hands over its
 * snapshot, taken before opening marked it read; the feed swaps in the LIVE row for both (/review
 * 2026-09-25: a failed Done's rollback, and an Undo, must bring back the read row, not the unread copy).
 * A delete leaves the page's Undo note (D3).
 *
 * ⚠ The `data-notification-reader` marker stays on the outermost box. ⚠ Rendered in-tree, never
 * through a portal: the warm skin is a wrapper above the providers.
 */
export default function NotificationReader({
  entry,
  portal,
  feed,
  onClose,
  opener,
}: {
  /** What was opened — one notification, or a same-day bundle of one kind. */
  entry: ActivityEntry;
  /** Whose page words name the onward button (D4). */
  portal: 'coach' | 'admin';
  /** The page's feed: Done and Delete act on it. */
  feed: Pick<NotificationFeed, 'clearRow' | 'deleteRows'>;
  onClose: () => void;
  /** The row that opened it — focus goes home to it (a tap on iOS never focused it). */
  opener: RefObject<HTMLElement | null>;
}) {
  const isPhoneNav = useIsPhoneNav();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // The centred dialog's own floor; wherever the bar shows the frame's is the floor.
  useDialogFloor(!isPhoneNav, panelRef, { onClose, opener });

  const message = (
    <NotificationMessage
      entry={entry}
      portal={portal}
      titleId={titleId}
      onDone={n => { void feed.clearRow(n); onClose(); }}
      onDelete={members => { feed.deleteRows(members); onClose(); }}
      onClose={onClose}
    />
  );

  if (isPhoneNav) {
    return (
      <div data-notification-reader style={{ display: 'contents' }}>
        <SheetFrame grabCloses onClose={onClose} opener={opener} role="dialog" aria-labelledby={titleId}>
          <div className={own.body}>{message}</div>
        </SheetFrame>
      </div>
    );
  }
  return (
    <div className={own.floor} data-notification-reader>
      <div className={own.scrim} aria-hidden onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className={own.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {message}
      </div>
    </div>
  );
}
