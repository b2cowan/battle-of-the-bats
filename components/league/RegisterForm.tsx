'use client';

import { useState } from 'react';
import DateInput from '@/components/shared/DateInput';
import { CheckCircle } from 'lucide-react';
import { useOrgHref } from '@/lib/use-public-pathname';
import { childTag, childLine, forecastChildren, hasAgeBands, nameList, ordinal, signupHeadline, signupToPay, type FormDivision, type FormSeason, type PlacedChild } from '@/lib/league-signup';
import { dollarsLine } from '@/lib/house-league-season';
import type { Cutoff } from '@/lib/born-years';
import styles from './register.module.css';
import formKit from '@/components/public/ClubForm.module.css';
import kit from '@/components/public/ClubKit.module.css';

/**
 * THE FAMILY'S SIGN-UP FORM (Club Tier Stage 9b-1, Part 5; drawing §4, words HOUSE_LEAGUE_STAGE9B1_COPY.md §7–§8; owner Q5,
 * 9b·4, 9b·5, 9b·9, 9b·12, 9b·13). One sign-up registers one child or several. Each child's date of birth finds the
 * division (required whenever the season sorts by age), and before anyone presses Sign up each child shows what will
 * happen: a spot and its price (the early bird applied, or when it ended), or the waitlist and nothing to pay. Two
 * divisions for one age group: the family picks, seeing each one's note and room. No division takes the birth year: the
 * form says so with the club's contact, and that child is left out (the others can still sign up). The total counts only
 * children who will be accepted; payment stays "payable separately" until online payment exists. After Sign up: the
 * reference, each child's tag ("Accepted", never "Approved"), and the club's how-to-pay words.
 */

type Child = { key: number; firstName: string; lastName: string; dob: string; divisionId: string; jersey: string; position: string; notes: string; more: boolean };
const blankChild = (key: number): Child => ({ key, firstName: '', lastName: '', dob: '', divisionId: '', jersey: '', position: '', notes: '', more: false });
const MAX_CHILDREN = 8;

type Result = {
  reference: string;
  guardianEmail: string;
  howToPay: string | null;
  children: (PlacedChild & { outcome: 'active' | 'pending_review' | 'waitlisted' | 'duplicate' | 'nofit' })[];
};

interface Props {
  orgSlug: string;
  orgName: string;
  seasonSlug: string;
  seasonName: string;
  /** "May 31 – Aug 30" for the eyebrow, or null. */
  seasonDates: string | null;
  waiverText: string | null;
  askEmailConsent: boolean;
  divisions: FormDivision[];
  season: FormSeason;
  cutoff: Cutoff;
  /** The club's day the form was drawn (the early bird is judged on it). */
  today: string;
  /** Where a family's questions go (the no-division-fits card). */
  contact: { email: string | null; phone: string | null };
}

export default function RegisterForm({
  orgSlug, orgName, seasonSlug, seasonName, seasonDates, waiverText, askEmailConsent, divisions, season, cutoff, today, contact,
}: Props) {
  const orgHref = useOrgHref(orgSlug);
  const bands = hasAgeBands(divisions);
  const [children, setChildren] = useState<Child[]>([blankChild(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [guardian, setGuardian] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [waiver, setWaiver] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const forecast = forecastChildren(children.map(c => ({ dob: c.dob, divisionId: c.divisionId })), divisions, season, cutoff, today);
  const going = forecast.filter(f => f.kind === 'spot' || f.kind === 'waitlist' || f.kind === 'pick' || f.kind === 'needDob').length;

  const clear = (key: string) => setErrors(prev => {
    if (!prev[key]) return prev;
    const copy = { ...prev };
    delete copy[key];
    return copy;
  });
  const setChild = (i: number, patch: Partial<Child>) => {
    setChildren(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    for (const k of Object.keys(patch)) clear(`children.${i}.${k === 'dob' ? 'dateOfBirth' : k}`);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setErrors({});
    // Only the children who will be registered are sent (a child no division takes is left out, 9b·4).
    const send = children.filter((_, i) => forecast[i].kind !== 'nofit');
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          children: send.map(c => ({
            firstName: c.firstName, lastName: c.lastName, dateOfBirth: c.dob || undefined, divisionId: c.divisionId || undefined,
            jerseyPref: c.jersey || undefined, positionPref: c.position || undefined, notes: c.notes || undefined,
          })),
          guardianFirstName: guardian.firstName,
          guardianLastName: guardian.lastName,
          guardianEmail: guardian.email,
          guardianPhone: guardian.phone || undefined,
          waiverAccepted: waiver,
          emailConsent: consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data.errors) {
        // The server numbers the children it was sent; map them back onto the form's own order.
        const sentIndex = children.map((_, i) => i).filter(i => forecast[i].kind !== 'nofit');
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.errors as Record<string, string>)) {
          const m = k.match(/^children\.(\d+)\.(.+)$/);
          mapped[m ? `children.${sentIndex[Number(m[1])]}.${m[2]}` : k] = v;
        }
        setErrors(mapped);
        return;
      }
      if (!res.ok) {
        setGlobalError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setResult(data as Result);
    } catch {
      setGlobalError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <Confirmation result={result} seasonName={seasonName} orgName={orgName} statusHref={orgHref(`/league/${seasonSlug}/status`)} forecast={children.map((c, i) => ({ name: c.firstName, kind: forecast[i].kind }))} />;

  // ── The total (copy §7.8): accepted children only ──
  const free = divisions.every(d => ((d.price ?? season.registrationFee) ?? 0) === 0);
  const spots = forecast.flatMap((f, i) => (f.kind === 'spot' ? [{ name: children[i].firstName || `Child ${i + 1}`, amount: f.amount ?? 0 }] : []));
  const waits = forecast.flatMap((f, i) => (f.kind === 'waitlist' ? [children[i].firstName || `Child ${i + 1}`] : []));
  const sum = Math.round(spots.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  const review = !season.autoApproveUnderCapacity;

  return (
    <form className={formKit.form} onSubmit={handleSubmit} noValidate>
      <div className={formKit.section}>
        <p className={formKit.hint} style={{ marginTop: 0 }}>{[seasonName, seasonDates].filter(Boolean).join(' · ')}</p>
        <p className={formKit.hint}>Sign up one child or several.{bands ? ' Each child’s date of birth finds their division.' : ''}</p>
      </div>

      {children.map((c, i) => {
        const f = forecast[i];
        const name = c.firstName.trim() || `Child ${i + 1}`;
        const err = (k: string) => errors[`children.${i}.${k}`];
        return (
          <div key={c.key} className={formKit.section}>
            <div className={styles.childHead}>
              <h2 className={formKit.sectionTitle}>Child {i + 1}</h2>
              {i > 0 && (
                <button type="button" className={styles.linkButton} aria-label={`Remove child ${i + 1}`}
                  onClick={() => setChildren(cs => cs.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
            <div className={formKit.fieldRow}>
              <div>
                <label className={formKit.label} htmlFor={`c${c.key}-first`}>First name <span className={formKit.required}>*</span></label>
                <input id={`c${c.key}-first`} className={`${formKit.input}${err('firstName') ? ` ${formKit.inputError}` : ''}`} type="text"
                  value={c.firstName} onChange={e => setChild(i, { firstName: e.target.value })} maxLength={80} autoComplete="off" />
                {err('firstName') && <p className={formKit.errorMsg}>{err('firstName')}</p>}
              </div>
              <div>
                <label className={formKit.label} htmlFor={`c${c.key}-last`}>Last name <span className={formKit.required}>*</span></label>
                <input id={`c${c.key}-last`} className={`${formKit.input}${err('lastName') ? ` ${formKit.inputError}` : ''}`} type="text"
                  value={c.lastName} onChange={e => setChild(i, { lastName: e.target.value })} maxLength={80} autoComplete="off" />
                {err('lastName') && <p className={formKit.errorMsg}>{err('lastName')}</p>}
              </div>
            </div>
            <div className={formKit.field}>
              <label className={formKit.label} htmlFor={`c${c.key}-dob`}>Date of birth {bands && <span className={formKit.required}>*</span>}</label>
              <DateInput id={`c${c.key}-dob`} className={formKit.input} value={c.dob} max={today} onChange={v => setChild(i, { dob: v, divisionId: '' })} />
              {err('dateOfBirth') && <p className={formKit.errorMsg}>{err('dateOfBirth')}</p>}
            </div>

            {/* What will happen, before Sign up (9b·5). */}
            {f.kind === 'spot' && (
              <div className={styles.fit}>
                <p className={styles.fitLine}>
                  {[f.division.name, f.division.note, f.division.capacity != null ? `${f.division.capacity - f.division.heldCount} ${f.division.capacity - f.division.heldCount === 1 ? 'spot' : 'spots'} left` : null,
                    f.amount != null ? `${dollarsLine(f.amount)}${f.early ? ' early bird' : ''}` : null].filter(Boolean).join(' · ')}
                </p>
                {f.earlyEnded && <p className={styles.fitDim}>The early-bird price ({dollarsLine(f.earlyEnded.amount)}) ended {f.earlyEnded.until}.</p>}
                {f.review && (f.amount ?? 0) > 0 && <p className={styles.fitDim}>The club reviews each sign-up. Nothing is due until {name} is accepted.</p>}
              </div>
            )}
            {f.kind === 'waitlist' && (
              <div className={styles.fit}>
                <p className={styles.fitLine}>
                  {f.division.name} is full · {name} joins the waitlist, {ordinal(f.position ?? 1)} in line · {f.review ? 'nothing to pay unless a spot opens' : `${name} pays nothing unless a spot opens`}
                </p>
              </div>
            )}
            {f.kind === 'pick' && (
              <fieldset className={styles.pick}>
                <legend className={formKit.label}>{bands ? `${name} fits more than one division. Choose one.` : 'Division'}</legend>
                <div className={styles.divisionList}>
                  {f.options.map(d => {
                    const left = d.capacity == null ? null : d.capacity - d.heldCount;
                    const full = (left != null && left <= 0) || d.waitlistCount > 0;
                    const price = (d.price ?? season.registrationFee);
                    return (
                      <label key={d.id} className={`${styles.divisionOption}${c.divisionId === d.id ? ` ${styles.divisionOptionSelected}` : ''}`}>
                        <span className={styles.divisionOptionLeft}>
                          <input type="radio" name={`c${c.key}-division`} value={d.id} checked={c.divisionId === d.id}
                            onChange={() => setChild(i, { divisionId: d.id })} className={styles.divisionRadio} />
                          <span>
                            <span className={styles.divisionOptionName}>{d.name}</span>
                            <span className={styles.divisionCapacity}>
                              {[d.note, full ? 'Full · joins the waitlist' : left != null ? `${left} ${left === 1 ? 'spot' : 'spots'} left` : null,
                                !full && price != null ? dollarsLine(price) : null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {err('divisionId') && <p className={formKit.errorMsg}>{err('divisionId')}</p>}
                {!c.divisionId && <p className={styles.fitDim}>Choose a division to see what happens next.</p>}
              </fieldset>
            )}
            {f.kind === 'nofit' && (
              <div className={`${kit.card} ${styles.nofit}`} role="status">
                <p className={styles.nofitTitle}>{name} doesn’t fit a division this season</p>
                <p className={styles.fitDim}>No division takes children born in {f.year}. {orgName} can tell you what is available.</p>
                <p className={styles.fitDim}>
                  {contact.email || contact.phone ? (
                    <>Contact {orgName}: {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.email && contact.phone && ' · '}{contact.phone}</>
                  ) : `Contact ${orgName} to ask what is available.`}
                </p>
                <p className={styles.fitDim}>Nothing is signed up for {name}.</p>
              </div>
            )}

            <button type="button" className={styles.linkButton} aria-expanded={c.more} onClick={() => setChild(i, { more: !c.more })}>
              Jersey number, position and notes
            </button>
            {c.more && (
              <>
                <div className={formKit.fieldRow}>
                  <div>
                    <label className={formKit.label} htmlFor={`c${c.key}-jersey`}>Jersey number preference</label>
                    <input id={`c${c.key}-jersey`} className={formKit.input} type="text" value={c.jersey} maxLength={3} placeholder="e.g. 12"
                      onChange={e => setChild(i, { jersey: e.target.value })} />
                  </div>
                  <div>
                    <label className={formKit.label} htmlFor={`c${c.key}-position`}>Position preference</label>
                    <input id={`c${c.key}-position`} className={formKit.input} type="text" value={c.position} maxLength={60}
                      onChange={e => setChild(i, { position: e.target.value })} />
                  </div>
                </div>
                <div className={formKit.field}>
                  <label className={formKit.label} htmlFor={`c${c.key}-notes`}>Additional notes</label>
                  <textarea id={`c${c.key}-notes`} className={formKit.textarea} value={c.notes} maxLength={500} rows={3}
                    onChange={e => setChild(i, { notes: e.target.value })} />
                  <p className={formKit.hint}>Up to 500 characters.</p>
                </div>
              </>
            )}
          </div>
        );
      })}

      {children.length < MAX_CHILDREN ? (
        <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={() => { setChildren(cs => [...cs, blankChild(nextKey)]); setNextKey(k => k + 1); }}>
          + Add another child
        </button>
      ) : (
        <p className={formKit.hint}>You can sign up {MAX_CHILDREN} children at once. Sign up again for more.</p>
      )}

      <div className={formKit.section}>
        <h2 className={formKit.sectionTitle}>Parent or guardian</h2>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label} htmlFor="g-first">First name <span className={formKit.required}>*</span></label>
            <input id="g-first" className={`${formKit.input}${errors.guardianFirstName ? ` ${formKit.inputError}` : ''}`} type="text" value={guardian.firstName}
              onChange={e => { setGuardian(g => ({ ...g, firstName: e.target.value })); clear('guardianFirstName'); }} maxLength={80} autoComplete="given-name" />
            {errors.guardianFirstName && <p className={formKit.errorMsg}>{errors.guardianFirstName}</p>}
          </div>
          <div>
            <label className={formKit.label} htmlFor="g-last">Last name <span className={formKit.required}>*</span></label>
            <input id="g-last" className={`${formKit.input}${errors.guardianLastName ? ` ${formKit.inputError}` : ''}`} type="text" value={guardian.lastName}
              onChange={e => { setGuardian(g => ({ ...g, lastName: e.target.value })); clear('guardianLastName'); }} maxLength={80} autoComplete="family-name" />
            {errors.guardianLastName && <p className={formKit.errorMsg}>{errors.guardianLastName}</p>}
          </div>
        </div>
        <div className={formKit.fieldRow}>
          <div>
            <label className={formKit.label} htmlFor="g-email">Email <span className={formKit.required}>*</span></label>
            <input id="g-email" className={`${formKit.input}${errors.guardianEmail ? ` ${formKit.inputError}` : ''}`} type="email" value={guardian.email}
              onChange={e => { setGuardian(g => ({ ...g, email: e.target.value })); clear('guardianEmail'); }} maxLength={200} autoComplete="email" />
            <p className={formKit.hint}>We’ll send the confirmation here. You’ll need this email and your reference to check your status later.</p>
            {errors.guardianEmail && <p className={formKit.errorMsg}>{errors.guardianEmail}</p>}
          </div>
          <div>
            <label className={formKit.label} htmlFor="g-phone">Phone</label>
            <input id="g-phone" className={formKit.input} type="tel" value={guardian.phone}
              onChange={e => setGuardian(g => ({ ...g, phone: e.target.value }))} maxLength={30} autoComplete="tel" />
          </div>
        </div>
      </div>

      {(waiverText || askEmailConsent) && (
        <div className={formKit.section}>
          {waiverText && (
            <>
              <h2 className={formKit.sectionTitle}>Waiver and agreement</h2>
              <div className={styles.waiverBox}>{waiverText}</div>
              <div className={styles.checkRow}>
                <input type="checkbox" id="waiverAccepted" checked={waiver} onChange={e => { setWaiver(e.target.checked); clear('waiverAccepted'); }} />
                <label htmlFor="waiverAccepted">I have read and agree to the waiver.</label>
              </div>
              {errors.waiverAccepted && <p className={formKit.errorMsg} style={{ marginTop: '0.5rem' }}>{errors.waiverAccepted}</p>}
            </>
          )}
          {askEmailConsent && (
            <div className={styles.checkRow}>
              <input type="checkbox" id="emailConsent" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <label htmlFor="emailConsent">
                {orgName} may email me about future seasons and club news. You can unsubscribe at any time.
                <span className={styles.fitDim} style={{ display: 'block' }}>Emails about this sign-up are sent either way.</span>
              </label>
            </div>
          )}
        </div>
      )}

      <div>
        <div className={styles.feeNote}>
          {free ? (
            <p><strong>Free.</strong> There is nothing to pay.</p>
          ) : review ? (
            <p>
              <strong>Nothing to pay yet.</strong> The club reviews each sign-up, and you pay once a child is accepted.
              {sum > 0 && <> If {spots.length === 1 ? spots[0].name : 'all'} {spots.length === 1 ? 'is' : 'are'} accepted: <strong>{dollarsLine(sum)}</strong>.</>}
            </p>
          ) : spots.length === 0 && waits.length > 0 ? (
            <p><strong>Nothing to pay.</strong> {nameList(waits)} {waits.length === 1 ? 'pays' : 'pay'} nothing unless a spot opens. We’ll email you if one does.</p>
          ) : spots.length > 0 ? (
            <>
              <p>
                <strong>{dollarsLine(sum)} to pay</strong> for {spots.length === 1 ? spots[0].name : `${spots.length} children`}. Payable separately to {orgName}. How to pay is on the next screen and in your email.
              </p>
              {spots.length > 1 && <p className={styles.fitDim}>{spots.map(s => `${s.name} ${dollarsLine(s.amount)}`).join(' · ')}</p>}
              {waits.map(w => <p key={w} className={styles.fitDim}>{w} pays nothing unless a spot opens.</p>)}
            </>
          ) : null}
        </div>
        {globalError && <div className={formKit.globalError}>{globalError}</div>}
        {going > 0 && (
          <button type="submit" className={formKit.submitBtn} disabled={submitting}>
            {submitting ? 'Signing up…' : going === 1 ? 'Sign up' : `Sign up ${going} children`}
          </button>
        )}
      </div>
    </form>
  );
}

/** The moment after Sign up (copy §8): the reference, each child's tag and line, the pay card with the club's words. */
function Confirmation({ result, seasonName, orgName, statusHref, forecast }: {
  result: Result;
  seasonName: string;
  orgName: string;
  statusHref: string;
  forecast: { name: string; kind: string }[];
}) {
  const placed = result.children.filter(c => c.outcome === 'active' || c.outcome === 'pending_review' || c.outcome === 'waitlisted');
  const toPay = signupToPay(placed);
  const accepted = placed.filter(c => c.status === 'active');
  const free = placed.every(c => (c.fee ?? 0) === 0);
  return (
    <div className={formKit.successPanel}>
      <div className={formKit.successIcon}><CheckCircle size={28} /></div>
      <p className={formKit.hint} style={{ margin: 0 }}>{seasonName}</p>
      <h2 className={formKit.successTitle}>{signupHeadline(placed)}</h2>
      <div className={formKit.refBox}>Your reference: <span className={formKit.refCode}>{result.reference}</span> (one for this sign-up)</div>

      <div className={styles.results}>
        {result.children.map((c, i) => {
          const was = forecast.find(f => f.name === c.firstName);
          return (
            <div key={`${c.firstName}-${c.lastName}-${i}`} className={kit.card}>
              <div className={styles.resultHead}>
                <strong>{c.firstName} {c.lastName}</strong>
                {(c.outcome === 'active' || c.outcome === 'pending_review' || c.outcome === 'waitlisted') && (
                  <span className={`${kit.chip} ${c.outcome === 'active' ? kit.chipOk : kit.chipNeutral}`}>{childTag(c.outcome, c.waitlistPosition)}</span>
                )}
              </div>
              {c.outcome === 'duplicate' ? (
                <p className={styles.fitDim}>{c.firstName} {c.lastName} is already signed up for this season, so nothing changed for {c.firstName}.</p>
              ) : (
                <p className={styles.fitDim}>Division · {childLine(c)}</p>
              )}
              {c.outcome === 'waitlisted' && was?.kind === 'spot' && (
                <p className={styles.fitDim}>A spot filled while you were signing up, so {c.firstName} joined the waitlist.</p>
              )}
            </div>
          );
        })}
      </div>

      {accepted.length > 0 && !free && toPay > 0 ? (
        <div className={kit.card}>
          <div className={styles.resultHead}><strong>To pay</strong><strong>{dollarsLine(toPay)}</strong></div>
          {accepted.length > 1 && <p className={styles.fitDim}>{accepted.map(c => `${c.firstName} · ${dollarsLine(c.fee ?? 0)}`).join('; ')}</p>}
          {result.howToPay && <p>How to pay: {result.howToPay}</p>}
          <p className={styles.fitDim}>Payable separately to {orgName}.</p>
          <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} disabled title="Online payment isn’t available yet. Use the instructions above." style={{ opacity: 0.5 }}>Pay now</button>
        </div>
      ) : placed.some(c => c.status === 'pending_review') ? (
        <div className={kit.card}>
          <strong>Nothing to pay yet</strong>
          <p className={styles.fitDim}>The club will review {placed.length === 1 ? 'this sign-up' : 'each child'}. Once {placed.length === 1 ? placed[0].firstName : 'a child'} is accepted, we’ll email you what to pay and how.</p>
        </div>
      ) : free && accepted.length > 0 ? (
        <p className={styles.fitDim}>This season is free. There is nothing to pay.</p>
      ) : placed.length > 0 && placed.every(c => c.status === 'waitlisted') ? (
        <p className={styles.fitDim}>Nothing to pay unless a spot opens. We’ll email you if one does.</p>
      ) : null}

      <p className={formKit.successBody}>We’ve emailed this to <strong>{result.guardianEmail}</strong>. Keep your reference to check your status.</p>
      <p className={styles.fitDim}>Didn’t get it? Check your spam folder, or look up your status with your reference.</p>
      <p className={styles.successStatusLink}><a href={statusHref}>Check your status →</a></p>
    </div>
  );
}
