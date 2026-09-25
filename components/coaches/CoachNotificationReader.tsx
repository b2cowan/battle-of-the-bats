'use client';
import { useEffect, useId, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { AppNotification, NotificationEventType } from '@/lib/types';
import { NOTIFICATION_EVENT_LABELS, notificationCategory } from '@/lib/notification-labels';
import {
  BUNDLE_NOUN, entryMembers, iconFor, notificationDestination, notificationStamp, type ActivityEntry,
} from '@/lib/notification-view';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import sheet from './CoachesBottomNav.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import own from './CoachNotificationReader.module.css';

/**
 * THE NOTIFICATION READER — a coach notification, opened (owner ruling 2026-09-25, D3 option B, on
 * the mockup "One Row for Notifications"). A tap on a row in the coach feed opens this instead of
 * leaving the page: the whole message, the day and the clock it arrived, and ONE button on to the
 * place that deals with it. Opening it marks it read — the owner's reason for the ruling: *"it
 * allows me to mark individual ones as read (open, read, close) without having to leave the
 * notifications page."* Going on is a second, deliberate tap.
 *
 * It also closes the hole the 09-24 phone clamp left: the week in review is cut to two lines on a
 * phone, and its link (Insights) describes the team TODAY — so an older review had nowhere to be
 * read. Here it reads whole, whatever its age.
 *
 * ⚖ A MENU, NOT A FORM, by the drawer ruling (2026-09-23): nothing is typed and nothing can be
 * lost, so on a phone it is the More sheet's own container at the bar's top edge — `.sheetAnchor`
 * / `.sheetScrim` / `.dropdown` / `.sheetGrab` from `CoachesBottomNav.module.css`, one skin with
 * More, the team sheet and the RSVP sheet — and the bar stays visible and tappable beneath it.
 * Deliberately NOT registered with `useOverlayOpen` (that would hide the bar it is drawn against).
 * Above the nav breakpoint the nav module draws nothing, so the same panel is a small centered
 * dialog (the RSVP sheet's answer, same reason).
 *
 * It stands on `useDialogFloor`: Escape, the Tab trap, focus back to the row on close, and the
 * phone's Back gesture closes the reader rather than leaving the page ("Back goes up ONE level").
 *
 * The onward control is a real `<a href>`: it is navigation, and it keeps the feed's full-document
 * load (R8 — client navigation on tap is deferred with its URL-state half; see useNotificationFeed).
 *
 * ⚠ Rendered in-tree, never through a portal: the warm skin is a wrapper above the providers.
 */
export default function CoachNotificationReader({
  entry,
  onClose,
  onClear,
}: {
  /** What was opened — one notification, or a same-day bundle of one kind. */
  entry: ActivityEntry;
  onClose: () => void;
  /** Take a Needs-attention row off the list (the row's own Clear, offered here too). */
  onClear: (n: AppNotification) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFloor(true, panelRef, { onClose });

  /* ⚠ A TAP ON THE BAR BENEATH CLOSES THE READER FIRST — never two sheets (/review 2026-09-25, High).
     The bar stays tappable under a menu-layer sheet, and the More sheet draws in the NAV's stacking
     context (300) over this anchor (260): opening More from here buried the reader, still open, with
     nothing on screen to say so. The team sheet's rule, applied the same way — a pointer-down outside
     this sheet's own subtree (scrim + panel) is a tap on the bar, and it closes the reader before More
     opens. ⚠ The boundary is the ANCHOR, not the panel: a pointer-down on the scrim must NOT close
     here, or the tap's click would land on the notification row the scrim was covering and open a
     second reader (the scrim-outside-its-boundary trap). The scrim closes on its own click, as before.
     A local listener rather than `useDismissable`: that hook also answers Escape and CLAIMS it, which
     would take the key from the floor that owns this sheet's Escape, focus return and Back step. */
  const closeRef = useLatestRef(onClose);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [closeRef]);

  const members = entryMembers(entry);
  const lead = members[0];
  const link = members.find(m => m.link)?.link ?? null;
  const goLabel = notificationDestination(link);
  const kind = NOTIFICATION_EVENT_LABELS[lead.eventType as NotificationEventType] ?? 'Notification';
  const title = entry.kind === 'bundle'
    ? `${members.length} ${BUNDLE_NOUN[entry.eventType] ?? 'notifications'}`
    : lead.title;
  // Only a single Needs-attention row can be cleared — the same rule as the row's own Clear.
  const clearable = entry.kind === 'item' && notificationCategory(lead.eventType) === 'act' && !lead.clearedAt;

  return (
    <div ref={anchorRef} className={`${sheet.sheetAnchor} ${own.floor}`} data-notification-reader>
      <div className={`${sheet.sheetScrim} ${own.scrim}`} aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`${sheet.dropdown} ${own.panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* The grab line is a real control on a phone — a tap on it closes, like the scrim. */}
        <button type="button" className={own.grabBtn} aria-label="Close" onClick={onClose}>
          <span className={sheet.sheetGrab} aria-hidden />
        </button>

        <p className={own.eyebrow}>
          <span className={own.icon} aria-hidden>{iconFor(lead.eventType)}</span>
          <span>{kind}</span>
          {/* The stamp is NOT uppercased: the eyebrow's caps would turn "7:00 p.m." into "P.M." on
              screen, a second spelling of the house clock that no source-text gate can see. */}
          <span className={own.stamp}>· {notificationStamp(lead.createdAt)}</span>
        </p>
        <h2 id={titleId} className={own.title}>{title}</h2>

        {entry.kind === 'item' ? (
          lead.body ? <p className={own.body}>{lead.body}</p> : null
        ) : (
          <ul className={own.members}>
            {members.map(m => (
              <li key={m.id} className={own.member}>
                <p className={own.memberTitle}>{m.title}</p>
                {m.body && <p className={own.memberBody}>{m.body}</p>}
                <p className={own.memberTime}>{notificationStamp(m.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}

        <div className={own.actions}>
          {link && goLabel && (
            <a href={link} className={`${shared.btnPrimary} ${own.go}`}>
              {goLabel} <ArrowRight size={16} aria-hidden />
            </a>
          )}
          {clearable && (
            <button
              type="button"
              className={shared.btnSecondary}
              aria-label={`Clear “${lead.title}” from Needs attention`}
              onClick={() => onClear(lead)}
            >
              Clear
            </button>
          )}
          <button type="button" className={shared.btnSecondary} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
