'use client';
import { useEffect, useId, useState, type ReactNode, type RefObject } from 'react';
import { CalendarDays, Check, Copy, RotateCcw, X } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import {
  CALENDAR_APP_NAMES,
  calendarAppOrder,
  calendarSubscribeDoors,
  type CalendarApp,
} from '@/lib/calendar-subscribe';
import { SUBSCRIBE_WORDS as W } from '@/lib/calendar-subscribe-words';
import SheetFrame from './SheetFrame';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './CalendarSubscribeWindow.module.css';
import LoadingState from '@/components/shared/LoadingState';

/**
 * THE SUBSCRIBE WINDOW — one part for every feed (Club Tier Stage 6d, specimen 2, ruled 2026-10-11; the design log's
 * 2026-10-11 entry, ruling 2). The coach wears it today; the club admin (deferred, Ask 4) and the family view (waits for
 * counsel) will wear it with their own words. The public team page wears its first half in its own skin
 * (`components/public/TeamSubscribeButton`) — the doors come from the same module either way (`lib/calendar-subscribe`).
 *
 * It READS FIRST and has no foot — nothing in it is a form, so there is no Done and no Save (the 2026-10-09 rulings);
 * a plain × closes it. Top to bottom: the record head (the context over the title), the lead, three equal app doors
 * and the link with Copy, What's in it (with the season line), How often (the honest sentence), Your link, Your
 * calendar, and Reset the link ENDING THE BODY in RecordAction's look (its mark and words at body weight, in ink — not
 * red: nothing is deleted, only the old link stops), which the caller asks about first. After a reset the floating
 * pill says "New link made" and fades (a success fades; only an error stays).
 *
 *   At a desk  the one window, 520 wide over the dimmed page, doors at the one control height (34).
 *   On a phone a tall MENU-layer sheet on the Sheet Frame — nothing in it is typed, so a stray tap on the bar loses
 *              nothing and the bar stays live (the frame's test, D1) — with a record head and the 44px × a tall menu
 *              keeps (D2), four 44px doors with THIS PHONE'S OWN calendar app first and Copy the link last; no link
 *              field (a phone subscribes through a door). No colour marks a door: order says which comes first.
 *
 * The caller decides the width (it opened on a tap, so the page has measured it) and owns the link's loading, Reset's
 * question and the request; this part owns the layout, Copy and the pill.
 */
export interface CalendarSubscribeLines {
  whatsIn: string;
  seasonLine?: string;
  howOften: string;
  /** A personal link's line ("Yours alone; …"); absent for a feed that is nobody's. */
  yourLink?: string;
  /** "Not read by a calendar yet." / "Read by your calendar today." — absent for a feed that is nobody's. */
  yourCalendar?: string;
}

export default function CalendarSubscribeWindow({
  phone, opener, context, title, lead, link, loadError, lines, onReset, resetting = false, newLinkKey = 0, onClose,
}: {
  phone: boolean;
  /** What opened it — focus goes home there however it closes. */
  opener: RefObject<HTMLElement | null>;
  /** The record head's context line: "13U AAA · Schedule". */
  context: string;
  title: string;
  lead: string;
  /** The feed's https address and the calendar's name; null while it loads. */
  link: { https: string; calendarName: string } | null;
  loadError?: string;
  lines: CalendarSubscribeLines;
  /** Reset the link — the caller asks first and makes the request. Absent: no Reset (a feed with no secret). */
  onReset?: () => void;
  resetting?: boolean;
  /** Bumped by the caller each time a new link is made — shows "New link made" once per bump. */
  newLinkKey?: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const doors = link ? calendarSubscribeDoors(link.https, link.calendarName) : null;
  // This phone's own app first — read once from the browser's description of itself (the window opens on a tap, so the
  // browser is there); a desk always lists Apple · Google · Outlook.
  const [order] = useState<CalendarApp[]>(() =>
    calendarAppOrder({ phone, userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent }));

  const body = (
    <>
      <p className={styles.lead}>{lead}</p>
      {/* A failure says so where the doors are; with a link in hand (a Reset that failed) the doors stay — the old
          link still works. */}
      {loadError && <p className={`${shared.errorText} ${styles.error}`} role="status">{loadError}</p>}
      {!doors ? (
        !loadError && <LoadingState inline label={W.loading} />
      ) : (
        <>
          <div className={phone ? styles.doorsPhone : styles.doors}>
            {order.map(app => (
              <a
                key={app}
                className={`${shared.btnSecondary} ${styles.door}`}
                href={doors[app]}
                // Apple's webcal:// hands off to the Calendar app; the web doors open their own add page beside this one.
                {...(app === 'apple' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              >
                <CalendarDays size={15} aria-hidden /> {CALENDAR_APP_NAMES[app]}
              </a>
            ))}
            {phone && <CopyButton text={doors.https} label={W.copyLink} wide />}
          </div>
          {!phone && (
            <div className={styles.linkRow}>
              <input className={styles.linkField} readOnly value={doors.https} aria-label={W.linkLabel}
                onFocus={e => e.currentTarget.select()} />
              <CopyButton text={doors.https} label={W.copy} />
            </div>
          )}
        </>
      )}

      <dl className={styles.lines}>
        <Line head={W.whatsInHead}>
          {lines.whatsIn}
          {lines.seasonLine && <small className={styles.season}>{lines.seasonLine}</small>}
        </Line>
        <Line head={W.howOftenHead}>{lines.howOften}</Line>
        {lines.yourLink && <Line head={W.yourLinkHead}>{lines.yourLink}</Line>}
        {lines.yourCalendar && <Line head={W.yourCalendarHead}>{lines.yourCalendar}</Line>}
      </dl>

      {onReset && (
        <div className={styles.resetRow}>
          <button type="button" className={styles.reset} onClick={onReset} disabled={resetting || !doors}>
            <RotateCcw size={15} aria-hidden /> {W.reset}
          </button>
        </div>
      )}
      <NewLinkPill showKey={newLinkKey} />
    </>
  );

  if (phone) {
    return (
      <SheetFrame onClose={onClose} opener={opener} busy={resetting} role="dialog" aria-labelledby={titleId}>
        <div className={styles.sheetBody}>
          <div className={styles.sheetHead}>
            <div className={styles.headWords}>
              <h2 id={titleId} className={styles.title}>{title}</h2>
              <p className={styles.sheetContext}>{context}</p>
            </div>
            <button type="button" className={styles.sheetClose} aria-label={W.close} onClick={onClose}>
              <X size={20} aria-hidden />
            </button>
          </div>
          {body}
        </div>
      </SheetFrame>
    );
  }
  /* ⚖ AT A DESK IT IS THE ONE WINDOW (One Window 2d, calls B5 / B6): 520, the record head's context over the title (the
     window's eyebrow), a plain ×, no foot; Escape and Back close it, Tab stays inside, a tap outside does nothing, and
     focus goes home to the door that opened it (`opener` — it opens from a menu item, gone by the time it closes).
     Held while a reset is in flight. `KitDialog` itself, not the coach shell, because this part is built for the club
     admin and the family view too (the header). The phone keeps its sheet above (Sheet Frame governs sheets; the owner's
     D recorded this window as "opens on a computer only"). */
  return (
    <KitDialog kind="form" eyebrow={context} title={title} onClose={onClose} busy={resetting} opener={opener}
      openOn="panel" ownType>
      <div className={styles.deskBody}>{body}</div>
    </KitDialog>
  );
}

function Line({ head, children }: { head: string; children: ReactNode }) {
  return (
    <div className={styles.line}>
      <dt>{head}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Copy the link — the button says "Copied" for a moment and goes back (`useCopyToClipboard`, shared with the public
 * page's Copy the link).
 */
function CopyButton({ text, label, wide = false }: { text: string; label: string; wide?: boolean }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <button type="button" className={`${shared.btnSecondary} ${wide ? styles.door : styles.copy}`} onClick={() => copy(text)}>
      {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      <span aria-live="polite">{copied ? W.copied : label}</span>
    </button>
  );
}

/**
 * "New link made" — the portal's floating pill (`.savePill`, the autosave word's): it shows when a reset lands, lingers,
 * fades, and is gone (the 2026-09-24 ruling: a success fades, only an error stays). Rendered INSIDE the window so it
 * paints over it at every width (a phone's sheet sits above the page's own pill layer). The live region never
 * unmounts; its text clears once it has faded.
 */
function NewLinkPill({ showKey }: { showKey: number }) {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'fading'>('hidden');
  const [seen, setSeen] = useState(showKey);
  if (showKey !== seen) {
    setSeen(showKey);
    setPhase(showKey > 0 ? 'shown' : 'hidden');
  }
  useEffect(() => {
    if (phase === 'hidden') return;
    const t = setTimeout(() => setPhase(phase === 'shown' ? 'fading' : 'hidden'), phase === 'shown' ? 2500 : 300);
    return () => clearTimeout(t);
  }, [phase]);
  return (
    <div className={`${shared.savePill} ${styles.pill}`} data-state="saved" data-phase={phase}>
      <span className={shared.saveStatus} aria-live="polite">
        {phase === 'hidden' ? null : <><Check size={13} aria-hidden /> {W.resetDone}</>}
      </span>
    </div>
  );
}
