'use client';
/**
 * "THE EMAIL" HALF OF AN OFFER (Board Ready Stage 6, Part 2): why the club may email them, the day that reason rests on, /legal's
 * fixed rule sentence and the club's optional note. Offer a deal draws it under "The email"; a deal made as a link only draws
 * it again in Email the offer, so both ask the same way.
 *   · The two reasons that run out (paid in two years, asked in six months) show a required When? directly under the reason
 *     (owner 3A, 2026-11-23; the shipped date field, no day after today). A day too long ago turns its hint into the red line
 *     that says the way forward; Send stays, and pressing it says the same line (the server refuses it too).
 *   · The other two keep round 1's hint, "Kept with the offer, with today's date."
 */
import ck from '../ClubKit.module.css';
import DateInput from '@/components/shared/DateInput';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { OFFER_REASONS, reasonHasClock, reasonHolds, type OfferReason } from '@/lib/club-sponsorship-deals';
import css from './Sponsorships.module.css';

export interface ReasonValue { reason: OfferReason | ''; reasonOn: string; note: string }
export const NO_REASON: ReasonValue = { reason: '', reasonOn: '', note: '' };

/** What stops Send, said where the field is (the server's `parseReasonInput`, the same words). */
export function reasonProblem(v: ReasonValue, today: string): { text: string; field: 'reason' | 'reasonOn' } | null {
  if (!v.reason) return { text: D.offer.errReason, field: 'reason' };
  if (!reasonHasClock(v.reason)) return null;
  if (!v.reasonOn) return { text: D.offer.errWhen, field: 'reasonOn' };
  if (v.reasonOn > today) return { text: D.offer.errWhenFuture, field: 'reasonOn' };
  if (!reasonHolds(v.reason, v.reasonOn, today)) return { text: D.offer.whenOld(v.reason), field: 'reasonOn' };
  return null;
}

/** The body an offer's reason sends: the When? only for a reason that asks one. */
export const reasonBody = (v: ReasonValue) => ({ reason: v.reason, reasonOn: reasonHasClock(v.reason || null) ? v.reasonOn : null, note: v.note });

export default function OfferReasonFields({ idPrefix, value, onChange, today, error }: {
  idPrefix: string;
  value: ReasonValue;
  onChange: (v: ReasonValue) => void;
  today: string;
  /** The field a refusal names ('reason' | 'reasonOn' | 'note'), with its words. */
  error: { text: string; field: string | null } | null;
}) {
  const clock = reasonHasClock(value.reason || null) ? (value.reason as 'paid_recently' | 'asked_recently') : null;
  const old = !!clock && !!value.reasonOn && value.reasonOn <= today && !reasonHolds(clock, value.reasonOn, today);
  const required = <span className={ck.required} aria-hidden>*</span>;
  const fieldError = (field: string) => (error?.field === field ? <p className={css.error} role="alert">{error.text}</p> : null);
  return (
    <>
      <div className={ck.field}>
        <label className={ck.label} htmlFor={`${idPrefix}-reason`}>{D.offer.reason} {required}</label>
        <select id={`${idPrefix}-reason`} className={ck.select} value={value.reason}
          onChange={e => onChange({ ...value, reason: e.target.value as OfferReason })}>
          <option value="" disabled>{D.offer.reasonPick}</option>
          {OFFER_REASONS.map(r => <option key={r} value={r}>{D.offer.reasons[r]}</option>)}
        </select>
        {!clock && <p className={ck.hint}>{D.offer.reasonHint}</p>}
        {fieldError('reason')}
      </div>
      {clock && (
        <div className={ck.field}>
          <label className={ck.label} htmlFor={`${idPrefix}-when`}>{D.offer.when} {required}</label>
          <DateInput id={`${idPrefix}-when`} className={ck.input} value={value.reasonOn} max={today}
            onChange={v => onChange({ ...value, reasonOn: v })} />
          {old
            ? <p className={css.error} role={error?.field === 'reasonOn' ? 'alert' : undefined}>{D.offer.whenOld(clock)}</p>
            : <p className={ck.hint}>{D.offer.whenHint(clock)}</p>}
          {!old && fieldError('reasonOn')}
        </div>
      )}
      {/* /legal: "above Send, always shown" — on a phone too. */}
      <p className={css.rule}>{D.offer.rule}</p>
      <div className={ck.field}>
        <label className={ck.label} htmlFor={`${idPrefix}-note`}>{D.offer.note}</label>
        <textarea id={`${idPrefix}-note`} className={`${ck.textarea} ${css.noteBox}`} rows={3} maxLength={1000} value={value.note}
          onChange={e => onChange({ ...value, note: e.target.value })} />
        <p className={ck.hint}>{D.offer.noteHint}</p>
        {fieldError('note')}
      </div>
    </>
  );
}
