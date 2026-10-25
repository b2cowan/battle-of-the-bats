'use client';

import { useState } from 'react';
import kit from '@/components/public/ClubKit.module.css';
import { childTag, nameList } from '@/lib/league-signup';
import { dollarsLine } from '@/lib/house-league-season';
import { clubDay } from '@/lib/league-registration-state';
import { ASK_WORDS, methodInBrackets } from '@/lib/house-league-money-words';

/**
 * THE FAMILY'S STATUS PAGE (Club Tier Stage 9b-1, Part 5; drawing §5, words HOUSE_LEAGUE_STAGE9B1_COPY.md §9). The email they
 * signed up with and their reference find the whole sign-up: each child with its tag ("Accepted", never "Approved"), its
 * division and its fee, then ONE pay block for what is still owed with the club's own how-to-pay words, and a greyed
 * "Pay now" (online payment comes later). No team yet.
 * 9b-2 (copy §14): the money is read from the club's book — a part payment after a price change, a refund, a fee the club
 * kept on an ended child — and "Ask to withdraw a child" sends the club a request (nothing changes until the club acts).
 */

type Registration = {
  ref: string;
  status: string;
  playerFirstName: string;
  playerLastName: string;
  divisionName: string;
  waitlistPosition: number | null;
  fee: number | null;
  received: number;
  paid: boolean;
  owing: number;
  paidOn: string | null;
  child: string;
  refund: { amount: number; day: string; method: string | null } | null;
  kept: { amount: number; reason: string } | null;
  withdrawRequestedAt: string | null;
};
type Found = { registrations: Registration[]; howToPay: string | null; clubName: string; reviewFirst: boolean; finished: boolean };

// Field, label and button faces are the club frame's (Club Tier Stage 4b-1): 44px fields with the form-field border,
// 14px/600 labels, the club's fill on the one button.
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--club-card)',
  border: '1px solid var(--club-field)', borderRadius: '8px',
  color: 'var(--club-text)', font: '400 1rem var(--club-text-face)',
  minHeight: '44px', padding: '0 0.75rem',
  outline: 'none', minWidth: 0, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--club-text)', marginBottom: '0.4rem',
};
const soft: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--club-soft)', margin: 0 };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem', padding: '0.25rem 0' };

const ended = (r: Registration) => r.status === 'declined' || r.status === 'withdrawn';

/** A child's fee line (copy §9.2; 9b-2 §14.4). */
function feeLine(r: Registration): { text: string; sub?: string; owing: boolean } {
  if (ended(r)) {
    if (r.refund) return { text: `${dollarsLine(r.refund.amount)} refunded on ${clubDay(r.refund.day)}${methodInBrackets(r.refund.method)}`, owing: false };
    if (r.kept) return { text: `The club is keeping the ${dollarsLine(r.kept.amount)}: ${r.kept.reason}`, owing: false };
    return { text: '—', owing: false };
  }
  if (r.status === 'waitlisted') return { text: 'Nothing to pay unless a spot opens', owing: false };
  if (r.fee == null) return { text: '—', owing: false };
  if (r.fee === 0) return { text: 'Free', owing: false };
  if (r.status === 'pending_review') return { text: `${dollarsLine(r.fee)} once accepted`, owing: false };
  // A price raised after a payment: the difference is to pay (§14.4 `status.child.fee.partial`).
  if (r.owing > 0 && r.received > 0) {
    return { text: `${dollarsLine(r.owing)} to pay`, sub: `The price is now ${dollarsLine(r.fee)}. ${dollarsLine(r.received)} received${r.paidOn ? ` ${clubDay(r.paidOn)}` : ''}.`, owing: true };
  }
  if (r.owing > 0) return { text: `${dollarsLine(r.fee)} to pay`, owing: true };
  const paid = r.paidOn ? `${dollarsLine(r.received || r.fee)} · paid ${clubDay(r.paidOn)}` : `${dollarsLine(r.received || r.fee)} · paid`;
  // A price lowered after a payment: the refund of the difference (§14.4 `status.child.fee.partRefund`).
  return { text: paid, sub: r.refund ? `${dollarsLine(r.refund.amount)} refunded ${clubDay(r.refund.day)}.` : undefined, owing: false };
}

export default function StatusLookupForm({
  orgSlug,
  seasonSlug,
  contactEmail,
}: {
  orgSlug: string;
  seasonSlug: string;
  contactEmail: string | null;
}) {
  const [email, setEmail] = useState('');
  const [refCode, setRefCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [found, setFound] = useState<Found | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  // "Ask to withdraw a child" (9b-2): the reference the family looked up with is the possession proof again.
  const [asked, setAsked] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askChild, setAskChild] = useState('');
  const [askNote, setAskNote] = useState('');
  const [askState, setAskState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [askError, setAskError] = useState('');
  const [askSent, setAskSent] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/status-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, refCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }
      setFound({
        registrations: Array.isArray(data.registrations) ? data.registrations : [],
        howToPay: data.howToPay ?? null, clubName: data.clubName ?? '', reviewFirst: !!data.reviewFirst, finished: !!data.finished,
      });
      setState('done');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  const regs = found?.registrations ?? [];
  const owed = regs.filter(r => feeLine(r).owing);
  const toPay = owed.reduce((s, r) => s + r.owing, 0);
  const paidKids = regs.filter(r => r.status === 'active' && r.paid && (r.fee ?? 0) > 0);
  const accepted = regs.filter(r => r.status === 'active' && (r.fee ?? 0) > 0);
  // A child can be asked about while live and not already asked about.
  const askable = found?.finished ? [] : regs.filter(r => !ended(r) && !r.withdrawRequestedAt && asked !== r.child);
  const askOne = askable.length === 1 ? askable[0] : null;
  const askFor = askOne ?? askable.find(r => r.child === askChild) ?? null;

  async function sendAsk() {
    if (!askFor) return;
    setAskState('sending');
    setAskError('');
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/withdraw-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, refCode, child: askFor.child, note: askNote.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAskError(data?.error ?? ASK_WORDS.errGeneric); setAskState('error'); return; }
      setAsked(askFor.child);
      setAskSent(ASK_WORDS.sent(email.trim(), askFor.playerFirstName));
      setAskOpen(false);
      setAskNote('');
      setAskState('idle');
    } catch {
      setAskError(ASK_WORDS.errGeneric);
      setAskState('error');
    }
  }
  const sharedRef = regs.length > 0 && regs.every(r => r.ref === regs[0].ref) ? regs[0].ref : null;

  return (
    <>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <p style={{ ...soft, marginBottom: '1rem' }}>Enter the email you signed up with and your reference.</p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle} htmlFor="status-email">Parent or guardian email</label>
          <input
            id="status-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle} htmlFor="status-ref">Reference</label>
          {/* A reference is read off a confirmation and typed back, so the field shows capitals whichever way it is
              typed; the face is the club's text face, not a typewriter's. */}
          <input
            id="status-ref"
            type="text"
            value={refCode}
            onChange={e => setRefCode(e.target.value)}
            placeholder="e.g. 069806EA"
            required
            maxLength={12}
            style={{ ...inputStyle, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}
          />
          <p style={{ ...soft, margin: '0.4rem 0 0' }}>The 8 characters on your confirmation screen and in your email.</p>
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className={`${kit.btn} ${kit.btnPrimary}`}
          style={{ whiteSpace: 'nowrap' }}
        >
          {state === 'loading' ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {state === 'error' && (
        <div
          className={kit.card}
          style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderColor: 'var(--danger)' }}
        >
          <p style={{ fontSize: '0.875rem', color: 'var(--danger)', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      {state === 'done' && regs.length === 0 && (
        <div className={kit.card} style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1rem', color: 'var(--club-text)', margin: 0 }}>
            We couldn&apos;t find a sign-up with that email and reference.
          </p>
          <p style={{ ...soft, marginTop: '0.75rem' }}>
            Check both against your confirmation email, or{' '}
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} style={{ color: 'var(--club-ink)', textDecoration: 'underline' }}>
                contact the club
              </a>
            ) : 'contact the club'}.
          </p>
        </div>
      )}

      {state === 'done' && regs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 className={kit.band} style={{ margin: 0 }}>{regs.length === 1 ? 'Your registration' : 'Your registrations'}</h2>
          {sharedRef && <p style={soft}>Reference: <strong style={{ color: 'var(--club-text)' }}>{sharedRef}</strong></p>}
          {regs.map(r => {
            const fee = feeLine(r);
            return (
              <div key={`${r.ref}-${r.playerFirstName}-${r.playerLastName}`} className={kit.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--club-text)' }}>
                    {r.playerFirstName} {r.playerLastName}
                  </div>
                  <span className={`${kit.chip} ${r.status === 'active' ? kit.chipOk : kit.chipNeutral}`}>
                    {childTag(r.status, r.waitlistPosition)}
                  </span>
                </div>
                <div style={row}><span style={{ color: 'var(--club-soft)' }}>Division</span><span style={{ color: 'var(--club-text)' }}>{r.divisionName}</span></div>
                <div style={row}>
                  <span style={{ color: 'var(--club-soft)' }}>Fee</span>
                  <span style={{ color: fee.owing ? 'var(--badge-warning-ink, var(--club-text))' : 'var(--club-text)', fontWeight: fee.owing ? 650 : 400, textAlign: 'right' }}>{fee.text}</span>
                </div>
                {fee.sub && <p style={{ ...soft, textAlign: 'right' }}>{fee.sub}</p>}
                {(r.withdrawRequestedAt || asked === r.child) && !ended(r) && (
                  <p style={{ ...soft, marginTop: '0.4rem' }}>
                    {ASK_WORDS.childLine(r.playerFirstName, clubDay((r.withdrawRequestedAt ?? new Date().toISOString()).slice(0, 10)))}
                  </p>
                )}
                {!sharedRef && <div style={row}><span style={{ color: 'var(--club-soft)' }}>Reference</span><span>{r.ref}</span></div>}
                {r.status === 'waitlisted' && <p style={{ ...soft, marginTop: '0.4rem' }}>We’ll email you if a spot opens.</p>}
              </div>
            );
          })}

          {toPay > 0 ? (
            <div className={kit.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--club-text)' }}>To pay</span>
                <span style={{ fontWeight: 750, fontSize: '1.15rem', color: 'var(--club-text)' }}>{dollarsLine(toPay)}</span>
              </div>
              <p style={{ ...soft, marginTop: '0.35rem' }}>
                {owed.map(r => `${r.playerFirstName} ${r.playerLastName} · ${r.divisionName}`).join('; ')}.
                {paidKids.length > 0 && ` ${nameList(paidKids.map(r => r.playerFirstName))} ${paidKids.length === 1 ? 'is' : 'are'} paid.`}
              </p>
              {found?.howToPay && <p style={{ fontSize: '0.875rem', color: 'var(--club-text)', margin: '0.6rem 0 0' }}>How to pay: {found.howToPay}</p>}
              <p style={{ ...soft, marginTop: '0.35rem' }}>Payable separately to {found?.clubName}.</p>
              <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} disabled title="Online payment isn’t available yet. Use the instructions above." style={{ marginTop: '0.75rem', opacity: 0.5 }}>
                Pay now
              </button>
            </div>
          ) : accepted.length > 0 && accepted.every(r => r.paid) ? (
            <p style={soft}>Everything is paid. Thank you.</p>
          ) : regs.some(r => r.status === 'pending_review') ? (
            <p style={soft}>Received. Nothing to pay until the club accepts.</p>
          ) : null}

          {askSent && <p style={{ ...soft, color: 'var(--club-text)' }} role="status">{askSent}</p>}
          {askable.length > 0 && !askOpen && (
            <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} style={{ alignSelf: 'flex-start' }} onClick={() => { setAskOpen(true); setAskSent(null); }}>
              {ASK_WORDS.door(askOne ? askOne.playerFirstName : null)}
            </button>
          )}
          {askable.length > 0 && askOpen && (
            <div className={kit.card} role="group" aria-label={ASK_WORDS.door(askOne ? askOne.playerFirstName : null)}>
              <p style={{ fontWeight: 700, color: 'var(--club-text)', margin: '0 0 0.75rem' }}>{ASK_WORDS.door(askOne ? askOne.playerFirstName : null)}</p>
              {!askOne && (
                <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
                  <legend style={labelStyle}>{ASK_WORDS.pick}</legend>
                  {askable.map(r => (
                    <label key={r.child} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '44px', color: 'var(--club-text)' }}>
                      <input type="radio" name="ask-child" value={r.child} checked={askChild === r.child} onChange={() => setAskChild(r.child)} />
                      {r.playerFirstName} {r.playerLastName}
                    </label>
                  ))}
                </fieldset>
              )}
              <label style={labelStyle} htmlFor="ask-note">{ASK_WORDS.noteLabel}</label>
              <textarea id="ask-note" value={askNote} maxLength={300} rows={3} onChange={e => setAskNote(e.target.value)}
                style={{ ...inputStyle, minHeight: '88px', padding: '0.6rem 0.75rem', resize: 'vertical' }} aria-describedby="ask-note-hint" />
              <p id="ask-note-hint" style={{ ...soft, margin: '0.4rem 0 0.9rem' }}>{ASK_WORDS.noteHint}</p>
              {askState === 'error' && <p style={{ fontSize: '0.875rem', color: 'var(--danger)', margin: '0 0 0.75rem' }} role="alert">{askError}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <p style={{ ...soft, flex: '1 1 16rem' }}>{ASK_WORDS.foot(askFor ? askFor.playerFirstName : null)}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={() => { setAskOpen(false); setAskState('idle'); }}>{ASK_WORDS.cancel}</button>
                  {askFor && (
                    <button type="button" className={`${kit.btn} ${kit.btnPrimary}`} disabled={askState === 'sending'} onClick={() => void sendAsk()}>
                      {askState === 'sending' ? ASK_WORDS.working : ASK_WORDS.submit}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
