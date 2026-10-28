'use client';
/**
 * THE ONE CLUB SEND WINDOW'S PARTS (the 2026-10-11 ruling: one window and one log shape for everything the club sends).
 * Send the schedule (`schedules/SendWindow.tsx`), Send reminders (`money/RemindersWindow.tsx`) and Message this family
 * (`families/MessageFamilyWindow.tsx`) all wear them: who it reaches, a row each — ticked where the sender chooses —
 * and the sample email in its own level ("See …'s email" → `MailView`). Extracted in Club Tier Stage 5a so the third window wears the shape
 * rather than drawing a third copy (memory `feedback_shared_component_over_shared_class`).
 *
 * The rest of the shape is the kit's own: `KitDialog` (eyebrow · title · × · footer, a standing reason in `footerStart`),
 * `Statement` (what sending does — `schedules/ScheduleParts`), the `ck.hint` line with "Last sent … by …", and the
 * lime that counts who it reaches.
 */
import { useState, type ReactNode } from 'react';
import type { EmailWords } from '@/lib/club-schedule-words';
import { clubBand, platformLineWords, type ClubEmailFacts } from '@/lib/email-club-identity';
import { BRAND_NAME, BRAND_NAME_HQ } from '@/lib/brand-mark';
import { SEND_VIEW_WORDS } from '@/lib/families-words';
import LoadingState from '@/components/shared/LoadingState';
import { repKit } from './RepKit';
import ck from './ClubKit.module.css';
import s from './SendParts.module.css';

/** A who-gets-it list longer than this earns a search. */
const WHO_SEARCH_FROM = 8;

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

/** A colleague email's words drawn inside a sample (`MailView`) — Send the schedule's and Ask the coaches' (both build
 *  the scheduler's `EmailWords`, the shape the house mail renders). The subject is the mail view's own header line. */
export function EmailWordsSample({ w }: { w: EmailWords }) {
  return (
    <>
      <p>{w.greeting}</p>
      {w.paragraphs.map(p => <p key={p}>{p}</p>)}
      {w.lists.map((l, i) => (
        <div key={i}>
          {l.title && <p><b>{l.title}</b></p>}
          <ul>{l.items.map((it, n) => <li key={n} className={s.sampleItem}>{it}</li>)}</ul>
        </div>
      ))}
      {w.link && <p><u>{w.link.label}</u></p>}
      {w.outro && <p>{w.outro}</p>}
      {w.foot && <p><small>{w.foot}</small></p>}
    </>
  );
}

/**
 * A LEVEL INSIDE THE SEND WINDOW (owner, 2026-10-26: "who gets it … opening it in line does not seem built for purpose";
 * the sample "might look better … like an actual email from an email app"). "See the email" and "See who gets it" take the
 * window's place behind a named back — the kit's level idiom (`KitDialog back`, Stage 3d), never a second window over a
 * form with words typed in it. The form's state lives in the window, so it is all still there on the way back.
 * Spread `dialog` onto the `KitDialog`; draw the level instead of the form when `level` is not `'form'`.
 */
export type SendLevel = 'form' | 'email' | 'who';
export function useSendLevel(backLabel: string) {
  const [level, setLevel] = useState<SendLevel>('form');
  const dialog = level === 'form' ? {} : { back: { label: backLabel, onBack: () => setLevel('form') }, levelKey: level };
  return { level, open: setLevel, dialog };
}

/** Two `SendDoor`s on one line — the first at the left, the second at the right ("See who gets it" · "See the email"). */
export function SendDoors({ children }: { children: ReactNode }) {
  return <div className={s.doors}>{children}</div>;
}

/** The door to a level: a plain link in the form ("See the email", "See 15U AAA’s email", "See who gets it"). */
export function SendDoor({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return (
    <div className={s.door}>
      <button type="button" className={repKit.inlineLink} onClick={onOpen}>{children}</button>
    </div>
  );
}

/**
 * The sample email as a mail app shows it: From / To / Subject, then the message as it will arrive. `to` opens the list
 * of who gets it when the window has one (`onTo`). The subject is the header's line, so the body leads with the club.
 */
export function MailView({ from, to, onTo, subject, children }: {
  from?: ReactNode; to: ReactNode; onTo?: () => void; subject: ReactNode; children: ReactNode;
}) {
  return (
    <>
      <p className={ck.hint}>{SEND_VIEW_WORDS.mailNote}</p>
      <div className={s.mail}>
        <dl className={s.mailHead}>
          {from && <div><dt>{SEND_VIEW_WORDS.from}</dt><dd>{from}</dd></div>}
          <div>
            <dt>{SEND_VIEW_WORDS.to}</dt>
            <dd>{onTo ? <button type="button" className={repKit.inlineLink} onClick={onTo}>{to}</button> : to}</dd>
          </div>
          <div><dt>{SEND_VIEW_WORDS.subject}</dt><dd><b>{subject}</b></dd></div>
        </dl>
        <div className={s.mailBody}>{children}</div>
      </div>
    </>
  );
}

/** A sample family's email, read from the server the first time "See the email" opens (Publish schedule, Changes to send). */
export type EmailSample = { to: string; words: EmailWords };
export function useEmailSample(previewUrl: string) {
  const [sample, setSample] = useState<EmailSample | null>(null);
  const [failed, setFailed] = useState(false);
  async function load() {
    if (sample) return;
    setFailed(false);
    const r = await fetch(previewUrl, { cache: 'no-store' }).catch(() => null);
    const data = (r?.ok ? await r.json().catch(() => null) : null) as { sample?: EmailSample | null } | null;
    if (data?.sample) setSample(data.sample); else setFailed(true);
  }
  return { sample, failed, load };
}

/** The email level's body: the sample as a mail app shows it, while it loads, or the sentence that says it didn't. */
export function SampleMail({ state, failedText }: { state: { sample: EmailSample | null; failed: boolean }; failedText: string }) {
  if (state.sample) return <MailView to={state.sample.to} subject={state.sample.words.subject}><EmailWordsSample w={state.sample.words} /></MailView>;
  return state.failed ? <p className={repKit.formError} role="alert">{failedText}</p> : <LoadingState inline label="Loading the email…" />;
}

/** Who gets it, however many: a count, a search once the list is long, then a row each. Each row's `title` is what the search reads. */
export function SendWhoList({ head, items }: { head: string; items: { title: string; sub?: string; off?: boolean }[] }) {
  const [text, setText] = useState('');
  const t = text.trim().toLowerCase();
  const shown = t ? items.filter(i => i.title.toLowerCase().includes(t)) : items;
  return (
    <>
      <p className={repKit.factsLabel}>{head}</p>
      {items.length > WHO_SEARCH_FROM && (
        <>
          <input type="search" className={ck.input} value={text} onChange={e => setText(e.target.value)}
            placeholder={SEND_VIEW_WORDS.search} aria-label={SEND_VIEW_WORDS.search} data-autofocus="" />
          {t && <p className={ck.hint} role="status">{shown.length === 0 ? SEND_VIEW_WORDS.noMatch(text.trim()) : SEND_VIEW_WORDS.matching(shown.length, items.length)}</p>}
        </>
      )}
      {shown.length > 0 && (
        <SendRows>
          {shown.map((i, n) => <SendRow key={n} title={i.title} sub={i.sub} off={i.off} />)}
        </SendRows>
      )}
    </>
  );
}
