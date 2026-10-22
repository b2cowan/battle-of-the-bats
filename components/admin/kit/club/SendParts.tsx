'use client';
/**
 * THE ONE CLUB SEND WINDOW'S PARTS (the 2026-10-11 ruling: one window and one log shape for everything the club sends).
 * Send the schedule (`schedules/SendWindow.tsx`), Send reminders (`money/RemindersWindow.tsx`) and Message this family
 * (`families/MessageFamilyWindow.tsx`) all wear them: who it reaches, a row each — ticked where the sender chooses —
 * and the sample email behind "See …'s email". Extracted in Club Tier Stage 5a so the third window wears the shape
 * rather than drawing a third copy (memory `feedback_shared_component_over_shared_class`).
 *
 * The rest of the shape is the kit's own: `KitDialog` (eyebrow · title · × · footer, a standing reason in `footerStart`),
 * `Statement` (what sending does — `schedules/ScheduleParts`), the `ck.hint` line with "Last sent … by …", and the
 * lime that counts who it reaches.
 */
import type { ReactNode } from 'react';
import type { EmailWords } from '@/lib/club-schedule-words';
import { repKit } from './RepKit';
import s from './SendParts.module.css';

/** Who the send reaches — a framed list of rows. `group` names a pick-one set (`radio`, named by the heading `labelledBy`)
 *  or a ticked set (`label`) for a screen reader; a plain list needs none. */
export function SendRows({ children, group }: { children: ReactNode; group?: { radio?: boolean; labelledBy?: string; label?: string } }) {
  return (
    <div className={s.rows} role={group ? (group.radio ? 'radiogroup' : 'group') : undefined}
      aria-labelledby={group?.labelledBy} aria-label={group?.label}>
      {children}
    </div>
  );
}

/** One row: who, and a second line under it. `pick` makes it a ticked row the sender can untick — or, with `pick.radio`
 *  (the group's name), one of a pick-one set (Email families' Who, Stage 7c). `off` dims a row the send will not reach
 *  (its second line says why). */
export function SendRow({ title, sub, pick, off }: {
  title: ReactNode;
  sub?: ReactNode;
  pick?: { checked: boolean; onChange: (checked: boolean) => void; radio?: string };
  off?: boolean;
}) {
  const main = (
    <span className={`${s.rowMain}${off ? ` ${s.rowOff}` : ''}`}>
      {title}
      {sub && <small>{sub}</small>}
    </span>
  );
  return pick ? (
    <label className={`${s.row} ${s.rowPick}`}>
      <input type={pick.radio ? 'radio' : 'checkbox'} name={pick.radio} checked={pick.checked} onChange={e => pick.onChange(e.target.checked)} />
      {main}
    </label>
  ) : (
    <div className={s.row}>{main}</div>
  );
}

/** A standing reason the send can't go, in the lime's place at the foot's LEFT (`KitDialog footerStart`) — amber, the
 *  count first, with the lime ABSENT rather than greyed (the 2026-10-12 rulings). */
export function SendStanding({ children }: { children: ReactNode }) {
  return <p className={s.standing} role="alert">{children}</p>;
}

/** The family envelope's parts inside a sample: the club as its kicker, the typed message as written, the footer. */
export const sendEnvelope = { kicker: s.envelopeKicker, body: s.envelopeBody, foot: s.envelopeFoot };

/** A colleague email's words drawn inside a sample (`SendSample`) — Send the schedule's and Ask the coaches' (both build
 *  the scheduler's `EmailWords`, the shape the house mail renders). */
export function EmailWordsSample({ w }: { w: EmailWords }) {
  return (
    <>
      <p><b>{w.subject}</b></p>
      <p>{w.greeting}</p>
      {w.paragraphs.map(p => <p key={p}>{p}</p>)}
      {w.lists.map((l, i) => (
        <div key={i}>
          {l.title && <p><b>{l.title}</b></p>}
          <ul>{l.items.map(it => <li key={it}>{it}</li>)}</ul>
        </div>
      ))}
      {w.link && <p><u>{w.link.label}</u></p>}
      {w.outro && <p>{w.outro}</p>}
    </>
  );
}

/** The sample email, behind its door ("See the email", "See 15U AAA’s email"). */
export function SendSample({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className={s.details}>
      <summary className={repKit.inlineLink}>{summary}</summary>
      <div className={s.sample}>{children}</div>
    </details>
  );
}
