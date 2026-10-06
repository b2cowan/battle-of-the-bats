'use client';
import type { Ref } from 'react';
import { ArrowRight, Check, Trash2 } from 'lucide-react';
import type { AppNotification, NotificationEventType } from '@/lib/types';
import { NOTIFICATION_EVENT_LABELS, notificationCategory } from '@/lib/notification-labels';
import {
  BUNDLE_NOUN, entryMembers, iconFor, notificationDestination, notificationStamp, type ActivityEntry,
} from '@/lib/notification-view';
import buttons from './notification-buttons.module.css';
import styles from './NotificationMessage.module.css';

/**
 * ONE OPENED NOTIFICATION — the message block every frame wears (owner ruling 2026-10-05, D1 + D3,
 * "Notifications Open in Place"; hub screen 7: "the kind, the day and time, the title, the message,
 * the buttons and their order are the same block in all three. Only the frame around it differs, so
 * they can't drift apart"). Lifted out of the coach reader (09-25) in step 2, so the bell's drawer
 * and the reader read one block:
 *   · the reader both Notifications pages open — a menu-layer sheet on a phone, a small dialog on a
 *     computer (`NotificationReader`, the coach's since 09-25 and the admin's since step 3; its FRAME
 *     belongs to the Sheet Frame project);
 *   · the bell's drawer — the pane beside the list (`NotificationDrawer`).
 *
 * ⚖ OPEN · DONE · CLOSE · DELETE, in that order in every frame (D3 + D8): the way on, named for its
 * page in that portal's own words (`notificationDestination`); Done (the old Clear) only on a single
 * Needs-attention row; Close where the frame closes from its button row (a sheet, a dialog — the
 * drawer's pane has its own ×); and the trash, set apart at the end. No Mark read: opening reads.
 *
 * The onward control is a real `<a href>` — navigation, with the feed's full-document load (R8,
 * client navigation on tap, is deferred with its URL-state half; see useNotificationFeed).
 *
 * ⚠ The buttons are the notification surfaces' own (`notification-buttons.module.css`, shared with the
 * drawer's toolbar), not the coach portal's `.btnPrimary` / `.btnSecondary`: those live in
 * `coaches.module.css`, ~945KB, and the bell renders on every admin page. Lime with dark ink for the way
 * on (olive is never a button's fill), the card with a strong hairline for the rest.
 */
export default function NotificationMessage({
  entry,
  portal,
  titleId,
  titleRef,
  onDone,
  onDelete,
  onClose,
}: {
  /** What was opened — one notification, or a same-day bundle of one kind. */
  entry: ActivityEntry;
  /** Whose words name the onward page (D4): the coach's pages, or the admin's. */
  portal: 'coach' | 'admin';
  /** The title's id — the frame's accessible name. */
  titleId: string;
  /** The title, for a frame that puts the keyboard on it when a message opens (the drawer's pane). */
  titleRef?: Ref<HTMLHeadingElement>;
  /** Take a Needs-attention row off the list — Done. */
  onDone: (n: AppNotification) => void;
  /** Delete what is open — the notification, or every member of a bundle (D3). */
  onDelete: (members: AppNotification[]) => void;
  /** A frame that closes from its button row passes this, and Close joins the row before the trash. */
  onClose?: () => void;
}) {
  const members = entryMembers(entry);
  const lead = members[0];
  const link = members.find(m => m.link)?.link ?? null;
  const goLabel = notificationDestination(link, portal);
  const kind = NOTIFICATION_EVENT_LABELS[lead.eventType as NotificationEventType] ?? 'Notification';
  const title = entry.kind === 'bundle'
    ? `${members.length} ${BUNDLE_NOUN[entry.eventType] ?? 'notifications'}`
    : lead.title;
  // Only a single Needs-attention row can be marked Done — the same rule as the row's own Done.
  const doneable = entry.kind === 'item' && notificationCategory(lead.eventType) === 'act' && !lead.clearedAt;

  return (
    <>
      <p className={styles.eyebrow}>
        <span className={styles.icon} aria-hidden>{iconFor(lead.eventType)}</span>
        <span>{kind}</span>
        {/* The stamp is NOT uppercased: the eyebrow's caps would turn "7:00 p.m." into "P.M." on
            screen, a second spelling of the house clock that no source-text gate can see. */}
        <span className={styles.stamp}>· {notificationStamp(lead.createdAt)}</span>
      </p>
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>{title}</h2>

      {entry.kind === 'item' ? (
        lead.body ? <p className={styles.body}>{lead.body}</p> : null
      ) : (
        <ul className={styles.members}>
          {members.map(m => (
            <li key={m.id} className={styles.member}>
              <p className={styles.memberTitle}>{m.title}</p>
              {m.body && <p className={styles.memberBody}>{m.body}</p>}
              <p className={styles.memberTime}>{notificationStamp(m.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        {link && goLabel && (
          <a href={link} className={`${buttons.btn} ${buttons.primary} ${styles.onward}`}>
            {goLabel} <ArrowRight size={16} aria-hidden />
          </a>
        )}
        {doneable && (
          <button
            type="button"
            className={buttons.btn}
            aria-label={`Mark “${lead.title}” done`}
            onClick={() => onDone(lead)}
          >
            <Check size={14} aria-hidden /> Done
          </button>
        )}
        {onClose && <button type="button" className={buttons.btn} onClick={onClose}>Close</button>}
        <button
          type="button"
          className={`${buttons.btn} ${styles.trash}`}
          aria-label={`Delete “${title}”`}
          title="Delete"
          onClick={() => onDelete(members)}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </>
  );
}
