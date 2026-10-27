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
import { clubBand, platformLineWords, type ClubEmailFacts } from '@/lib/email-club-identity';
import { BRAND_NAME, BRAND_NAME_HQ } from '@/lib/brand-mark';
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
export function SendRow({ title, sub, pick, off, below }: {
  title: ReactNode;
  sub?: ReactNode;
  pick?: { checked: boolean; onChange: (checked: boolean) => void; radio?: string };
  off?: boolean;
  /** Controls that belong to the row but are not its label (a search box, buttons): drawn under the row, inside its edge,
   *  OUTSIDE the label — a `<label>` may hold only the control it names, and a click in a search field must not tick it.
   *  ⚠ PASS `null`, never `undefined`, on the renders where a row that CAN carry controls has none: the wrapper stays put
   *  while the prop is defined, so ticking the row's radio doesn't remount it and drop the keyboard's focus. */
  below?: ReactNode;
}) {
  const main = (
    <span className={`${s.rowMain}${off ? ` ${s.rowOff}` : ''}`}>
      {title}
      {sub && <small>{sub}</small>}
    </span>
  );
  const row = pick ? (
    <label className={`${s.row} ${s.rowPick}`}>
      <input type={pick.radio ? 'radio' : 'checkbox'} name={pick.radio} checked={pick.checked} onChange={e => pick.onChange(e.target.checked)} />
      {main}
    </label>
  ) : (
    <div className={s.row}>{main}</div>
  );
  return below !== undefined ? <div className={s.rowSet}>{row}{below && <div className={s.rowBelow}>{below}</div>}</div> : row;
}

/** A standing reason the send can't go, in the lime's place at the foot's LEFT (`KitDialog footerStart`) — amber, the
 *  count first, with the lime ABSENT rather than greyed (the 2026-10-12 rulings). */
export function SendStanding({ children }: { children: ReactNode }) {
  return <p className={s.standing} role="alert">{children}</p>;
}

/** The family envelope's parts inside a sample: the club as its kicker, the typed message as written, the footer. */
export const sendEnvelope = { kicker: s.envelopeKicker, body: s.envelopeBody, foot: s.envelopeFoot };

/**
 * The club's band at the top of a family-email sample (The public face, warm: S3b): the strip the real email wears, from the
 * same `clubBand()` — the club's name as text, its logo or initials in a tile, the accent rule under it. A logo only
 * shows when the email would show it (a PNG or JPEG of known size), so the sample never promises a look the email lacks.
 */
export function SampleBand({ club }: { club: ClubEmailFacts }) {
  const b = clubBand(club);
  return (
    <div className={s.sampleBand} style={{ background: b.fill, color: b.onFill, borderBottom: b.accent ? `3px solid ${b.accent}` : undefined }}>
      {b.logo ? (
        <span className={s.sampleBandTile} style={{ background: 'var(--white-fixed)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- an email's own image, drawn as the email will draw it */}
          <img src={b.logo.src} width={b.logo.width} height={b.logo.height} alt={b.initials} />
        </span>
      ) : b.initials ? (
        <span className={s.sampleBandTile} style={{ background: b.tileBackground, color: b.tileInk }}>{b.initials}</span>
      ) : null}
      <span className={s.sampleBandName}>{b.name}</span>
    </div>
  );
}

/** The quiet platform line at the foot of a family-email sample: the email's own words (`platformLineWords`), the name line between. */
export function SamplePlatformLine({ clubName }: { clubName: string }) {
  const w = platformLineWords(clubName);
  return <p className={s.samplePlatform}>{w.lead}<b>{BRAND_NAME}<i>{BRAND_NAME_HQ}</i></b>{w.tail}</p>;
}

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

      {w.foot && <p><small>{w.foot}</small></p>}
/** The sample email, behind its door ("See the email", "See 15U AAA’s email"). */
export function SendSample({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className={s.details}>
      <summary className={repKit.inlineLink}>{summary}</summary>
      <div className={s.sample}>{children}</div>
    </details>
  );
}
