'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, CalendarPlus, Check, Copy, X } from 'lucide-react';
import {
  CALENDAR_APP_NAMES,
  calendarAppOrder,
  calendarSubscribeDoors,
  type CalendarApp,
} from '@/lib/calendar-subscribe';
import { SUBSCRIBE_WORDS as W } from '@/lib/calendar-subscribe-words';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useDismissable } from '@/lib/overlay-hooks';
import styles from './TeamSubscribeButton.module.css';

/**
 * SUBSCRIBE ON THE TEAM'S PUBLIC PAGE (Club Tier Stage 6d, B3 — specimen 3's public frames, Ask 3, ruled 2026-10-11).
 *
 * A 44px button at the right end of the Schedule heading's line — above what it takes, the house rule for an export
 * (2026-09-01), because this page has no Export (the design log's 6d ruling 1). The page renders it exactly when it
 * renders the schedule: both come from ONE question (`getPublicTeamSchedule`), which the feed asks too (S6D-09).
 *
 * The feed is the page's own address with /calendar on the end — no secret, nothing to reset, nobody's link — so this
 * wears the Subscribe window's FIRST HALF only: this phone's app first, then the others and Copy the link, and one
 * sentence about how often. No "your link", no last read, no Reset.
 *   On a phone (≤640) a sheet rises (record head "Subscribe to this schedule" over "{team} · {club}", a 44px ×).
 *   At a desk the same choices open in a panel under the button (the page is a 680 column at every width).
 * The org's public site is permanently dark: one skin, the platform's dark tokens, no Warm/Dark pair.
 */
export default function TeamSubscribeButton({ feedPath, calendarName }: {
  /** `/{org}/teams/{team}/calendar` — the client adds its own origin (the visitor's host is the page's host). */
  feedPath: string;
  /** "13U AAA · UAT Rep Club" — the sheet's context line and the Outlook door's calendar name. */
  calendarName: string;
}) {
  const [open, setOpen] = useState<null | 'sheet' | 'panel'>(null);
  const isPhone = useIsPhone();
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** A tap elsewhere just closes; the keyboard's ways out (Escape, ×) hand focus back to the button. */
  const dismiss = () => setOpen(null);
  const close = () => { setOpen(null); buttonRef.current?.focus({ preventScroll: true }); };

  return (
    <div className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={W.publicButton}
        aria-expanded={open !== null}
        onClick={() => {
          if (open) { close(); return; }
          setOpen(isPhone ? 'sheet' : 'panel');
        }}
      >
        <CalendarPlus size={18} aria-hidden /> <span className={styles.label}>{W.publicButton}</span>
      </button>
      {open && (
        <SubscribeChoices
          mode={open}
          feedUrl={`${window.location.origin}${feedPath}`}
          calendarName={calendarName}
          opener={buttonRef}
          onDismiss={dismiss}
          onClose={close}
        />
      )}
    </div>
  );
}

function SubscribeChoices({ mode, feedUrl, calendarName, opener, onDismiss, onClose }: {
  mode: 'sheet' | 'panel';
  feedUrl: string;
  calendarName: string;
  opener: React.RefObject<HTMLButtonElement | null>;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const doors = calendarSubscribeDoors(feedUrl, calendarName);
  const [order] = useState<CalendarApp[]>(() => calendarAppOrder({ phone: mode === 'sheet', userAgent: navigator.userAgent }));

  // Focus moves in once, on open. A tap outside the panel (or on the sheet's dim) closes it; Escape closes it and hands
  // focus back to the button — the repo's one dismiss rule (`useDismissable`).
  useEffect(() => { panelRef.current?.focus({ preventScroll: true }); }, []);
  useDismissable(true, [panelRef, opener], onDismiss, onClose);

  const choices = (
    <>
      <p className={styles.lead}>{W.publicLead}</p>
      <div className={styles.doors}>
        {order.map(app => (
          <a key={app} className={styles.door} href={doors[app]}
            {...(app === 'apple' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
            <CalendarDays size={16} aria-hidden /> {CALENDAR_APP_NAMES[app]}
          </a>
        ))}
        <CopyDoor text={doors.https} />
      </div>
      {/* The desk panel says how often; the phone's sheet adds that cancelled events stay (both as drawn). */}
      <p className={styles.note}>{mode === 'sheet' ? W.publicLine : W.howOften}</p>
    </>
  );

  if (mode === 'panel') {
    return (
      <div ref={panelRef} className={styles.panel} role="dialog" aria-label={W.publicTitle} tabIndex={-1}>
        {choices}
      </div>
    );
  }
  return (
    <>
      <div className={styles.dim} aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.grab} aria-hidden />
        <div className={styles.sheetHead}>
          <div className={styles.headWords}>
            <h2 id={titleId} className={styles.title}>{W.publicTitle}</h2>
            <p className={styles.context}>{calendarName}</p>
          </div>
          <button type="button" className={styles.close} aria-label={W.close} onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </div>
        {choices}
      </div>
    </>
  );
}

function CopyDoor({ text }: { text: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <button type="button" className={styles.door} onClick={() => copy(text)}>
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      <span aria-live="polite">{copied ? W.copied : W.copyLink}</span>
    </button>
  );
}
