'use client';
import type { Ref } from 'react';
import { ArrowRight, Check, Trash2 } from 'lucide-react';
import type { AppNotification, NotificationEventType } from '@/lib/types';
import { NOTIFICATION_EVENT_LABELS, notificationCategory } from '@/lib/notification-labels';
import {
  REFUND_NOTICE_ACTIONS, withAnswer,
  canMarkDone,
  BUNDLE_NOUN, HANDOFF_ACTIONS, entryMembers, handoffNotReceivedLink, iconFor, notificationDestination, notificationStamp,
  type ActivityEntry,
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
 * ⚖ A SETTLED ONE SAYS WHAT HAPPENED (Needs attention clears itself, owner 2026-10-16, A2 + A3): a
 * Needs-attention notification whose request is no longer waiting carries `settled` from the list route —
 * under a hairline, a check, the outcome in bold ("You accepted it"), the reader's own stamp when the record
 * keeps a time, and what it did on a second line. Its onward button goes where the record lives now (or is
 * absent when the record is gone), and never to the page the reader is on; Done is gone with Needs attention.
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
  // A settled one (A2/A3): what happened, and where its record lives now — a string replaces the link, null
  // means there is nothing to open, absent keeps the notification's own.
  const settled = entry.kind === 'item' ? lead.settled ?? null : null;
  const own = members.find(m => m.link)?.link ?? null;
  const onward = settled && settled.link !== undefined ? settled.link : own;
  const link = settled && onward && isThisPage(onward) ? null : onward;
  // The club's hand-off (Club Tier Stage 5c, Ask 28): while it waits, the way on is "Record it" (the coach's own Record
  // money, filled in) and Not received is the same door asking once — two links, nothing posted from the bell.
  const handoff = entry.kind === 'item' && !settled && !lead.clearedAt && lead.eventType === 'club_payment_handed_off' ? link : null;
  // 12c: a refund made in Stripe — "Choose the child"; a still-enrolled child's three answers; a returned house-league
  // refund's "Record the refund sent another way" (F6). Each a link that opens its window on Registrations.
  const waiting = entry.kind === 'item' && !settled && !lead.clearedAt;
  const childFirst = typeof lead.metadata?.childFirst === 'string' ? lead.metadata.childFirst : '';
  const enrolled = waiting && lead.eventType === 'card_refund_still_enrolled' ? link : null;
  const refundLabel = !waiting ? null
    : lead.eventType === 'card_refund_whose' ? REFUND_NOTICE_ACTIONS.whose
      : enrolled ? REFUND_NOTICE_ACTIONS.withdraw(childFirst)
        : lead.eventType === 'card_refund_failed' && typeof lead.metadata?.refundId === 'string' ? REFUND_NOTICE_ACTIONS.anotherWay : null;
  const goLabel = handoff ? HANDOFF_ACTIONS.recordIt : refundLabel ?? notificationDestination(link, portal);
  const goLink = enrolled ? withAnswer(enrolled, 'withdraw') : link;
  const kind = NOTIFICATION_EVENT_LABELS[lead.eventType as NotificationEventType] ?? 'Notification';
  const title = entry.kind === 'bundle'
    ? `${members.length} ${BUNDLE_NOUN[entry.eventType] ?? 'notifications'}`
    : lead.title;
  // Only a single Needs-attention row can be marked Done — the same rule as the row's own Done.
  const doneable = entry.kind === 'item' && notificationCategory(lead.eventType) === 'act' && !lead.clearedAt && !settled && canMarkDone(lead.eventType);

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

      {settled && (
        <p className={styles.settled}>
          <Check size={16} aria-hidden />
          <span>
            <b>{settled.outcome}</b>
            {settled.at && <span className={styles.settledWhen}> · {notificationStamp(settled.at)}</span>}
            {settled.then && <span className={styles.settledThen}>{settled.then}</span>}
          </span>
        </p>
      )}

      <div className={styles.actions}>
        {goLink && goLabel && (
          <a href={goLink} className={`${buttons.btn} ${buttons.primary} ${styles.onward}`}>
            {goLabel} <ArrowRight size={16} aria-hidden />
          </a>
        )}
        {handoff && <a href={handoffNotReceivedLink(handoff)} className={buttons.btn}>{HANDOFF_ACTIONS.notReceived}</a>}
        {enrolled && <a href={withAnswer(enrolled, 'link')} className={buttons.btn}>{REFUND_NOTICE_ACTIONS.link}</a>}
        {enrolled && <a href={withAnswer(enrolled, 'keep')} className={buttons.btn}>{REFUND_NOTICE_ACTIONS.keep(childFirst)}</a>}
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

/** Is this link the page the reader is on? A settled notification never offers it (A3): "Open" reloading the
 *  page you are on was the dead end that started this (Owner QA §322, 2026-10-16). */
function isThisPage(link: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(link, window.location.origin).pathname === window.location.pathname;
  } catch {
    return false;
  }
}
