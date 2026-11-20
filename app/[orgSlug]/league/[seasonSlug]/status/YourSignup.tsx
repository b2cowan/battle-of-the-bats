'use client';

import { useState } from 'react';
import kit from '@/components/public/ClubKit.module.css';
import form from '@/components/public/ClubForm.module.css';
import { childTag, nameList } from '@/lib/league-signup';
import { dollarsLine } from '@/lib/house-league-season';
import { clubDay } from '@/lib/league-registration-state';
import { ASK_WORDS, methodInBrackets } from '@/lib/house-league-money-words';
import { LEAGUE_PAY_WORDS as LW, SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import type { LeaguePayView } from '@/lib/league-pay-view';
import LeaguePayBlock from '@/components/public/LeaguePayBlock';
import FriendFields, { FriendCodeRow, friendsToSend, codeHasTypo, type FriendDraft } from '@/components/league/FriendFields';
import { FRIEND_WORDS as FW, type FriendAsked } from '@/lib/league-friends';
import reg from '@/components/league/register.module.css';
import { SignupAnswers, SignupRetick } from '@/components/league/YourSignupForm';
import type { FamilyFormState } from '@/lib/club-form-family';

/**
 * THE FAMILY'S "YOUR SIGN-UP" PAGE (Club Tier Stage 9b-1, Part 5; drawing §5, words HOUSE_LEAGUE_STAGE9B1_COPY.md §9;
 * renamed from the status lookup form by Signed-in family accounts Stage 1, drawing tab 1). The family's signed link
 * opens the whole sign-up: each child by FIRST name with its tag ("Accepted", never "Approved"), its division and its
 * fee, then ONE pay block for what is still owed with the club's own how-to-pay words. The email-and-reference form is
 * gone (Stage 1: "Email me my link", `EmailMyLinkForm`, sends the link to the inbox instead); the reference stays as a
 * number to quote to the club, and a quiet foot line says the club can replace the link.
 * 9b-2 (copy §14): the money is read from the club's book — a part payment after a price change, a refund, a fee the club
 * kept on an ended child — and "Ask to withdraw a child" sends the club a request (nothing changes until the club acts).
 * 12b (owner §0e c): while the club takes card payments the pay block is THE one pay block (Pay by card, receipts, confirming). When it doesn't,
 * the block is today's, word for word, and there is no button at all (A6) — the greyed "Pay now" is gone.
 * Board Ready Stage 1 (drawing tab 2, rulings A5, A10): while the club asks for friends, each child shows its friend code
 * with Copy, and "Plays with" one line per friend the family named (the name or code they typed — never the name behind
 * a code, never whether it was honoured). Change opens the same question as the sign-up form, until the child's
 * division has its teams made; then the lines stay and "Friend requests closed when the teams were made."
 * Board Ready Stage 4 Part 2 (drawing tab 7, rulings 8 and 20): the club's sign-up form. FIRST on the page, while a
 * document needs a tick, the re-tick block; after the children, each child's answers and the sign-up's own in folded rows
 * with Change until the teams are made (`components/league/YourSignupForm.tsx`).
 */

type Registration = {
  ref: string;
  status: string;
  playerFirstName: string;
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
  endedAt: string | null;
  /** 9c: an accepted child's team (name null = not set yet), its coaches, and a move after publishing. */
  team: { name: string | null; coaches: string[]; movedFrom: { team: string; day: string } | null } | null;
  /** Board Ready Stage 1 (tab 2): the child's friend code, what the family asked, and whether it can still change. */
  friends: { code: string | null; asked: FriendAsked[]; open: boolean } | null;
};
type Found = {
  registrations: Registration[]; howToPay: string | null; clubName: string; reviewFirst: boolean; finished: boolean;
  /** Board Ready Stage 1: friends a family can name per child (0: the club doesn't ask). */
  friendMax: number;
  /** The pay block while the club takes card payments; null keeps today's words (A6). */
  pay: LeaguePayView | null;
};

// Field, label and button faces are the club frame's (Club Tier Stage 4b-1): the note is ClubForm's textarea (its focus
// ring included), 14px/600 labels, the club's fill on the one button.
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--club-text)', marginBottom: '0.4rem',
};
const soft: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--club-soft)', margin: 0 };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem', padding: '0.25rem 0' };

/** Keys for the friend blocks (unique for the page's life; React only needs them distinct within a list). */
let draftSeq = 1;
const nextDraftKey = () => draftSeq++;

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
  // Just the amount, in amber: the "To pay" card below says what it is and how to pay it.
  if (r.owing > 0) return { text: dollarsLine(r.fee), owing: true };
  const paid = r.paidOn ? `${dollarsLine(r.received || r.fee)} · paid ${clubDay(r.paidOn)}` : `${dollarsLine(r.received || r.fee)} · paid`;
  // A price lowered after a payment: the refund of the difference (§14.4 `status.child.fee.partRefund`).
  return { text: paid, sub: r.refund ? `${dollarsLine(r.refund.amount)} refunded ${clubDay(r.refund.day)}.` : undefined, owing: false };
}

export default function YourSignup({
  orgSlug,
  seasonSlug,
  contactEmail,
  found,
  token,
  emailShown,
  returnedSession = null,
  left = false,
  footLine = SW.foot,
  wayBack = null,
  signupForm = null,
}: {
  orgSlug: string;
  seasonSlug: string;
  contactEmail: string | null;
  /** The sign-up the link opened (`openSignupLink`), shaped by `buildSignupStatus`, with its pay block. */
  found: Found;
  /** The link's key: the withdraw request's possession proof. */
  token: string;
  /** The family's address, masked on the server ("m•••@gmail.com"): the withdraw ask's "sent" line. */
  emailShown: string | null;
  /** Stripe's return (`?paid=`): the pay block waits for the record. */
  returnedSession?: string | null;
  /** Left Stripe's page before paying (`?left=1`). */
  left?: boolean;
  /** The foot line: "Anyone with this link…" on the emailed page; inside the signed-in app (Signed-in family accounts Stage 4a,
   *  Part 6.5, drawing 4.2) "You're seeing this because you're signed in as {child}'s parent." — no link is involved there. */
  footLine?: string;
  /** The emailed page's way back to the app (Stage 4a, Part 6.6, drawing 4.1), once a child on it is on a team. */
  wayBack?: React.ReactNode;
  /** Board Ready Stage 4 Part 2: the season's sign-up form as this sign-up stands on it (null: nothing to show). */
  signupForm?: FamilyFormState | null;
}) {
  // "Ask to withdraw a child" (9b-2): the link is the possession proof (Stage 1: the only one).
  const [asked, setAsked] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askChild, setAskChild] = useState('');
  const [askNote, setAskNote] = useState('');
  const [askState, setAskState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [askError, setAskError] = useState('');
  const [askSent, setAskSent] = useState<string | null>(null);

  // Friend requests (Board Ready Stage 1): one child's question open at a time; a save shows what was asked at once.
  const [friendsFor, setFriendsFor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<FriendDraft[]>([]);
  const [friendErrors, setFriendErrors] = useState<Record<string, string>>({});
  const [friendState, setFriendState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [friendError, setFriendError] = useState('');
  const [askedNow, setAskedNow] = useState<Record<string, FriendAsked[]>>({});
  const [friendSaved, setFriendSaved] = useState<string | null>(null);
  const openFriends = (r: Registration) => {
    const asked = askedNow[r.child] ?? r.friends?.asked ?? [];
    setDrafts(asked.map(a => ('code' in a
      ? { key: nextDraftKey(), by: 'code' as const, first: '', last: '', parent: '', code: a.code }
      : { key: nextDraftKey(), by: 'name' as const, first: a.first ?? '', last: a.last ?? '', parent: a.parent ?? '', code: '' })));
    if (asked.length === 0) setDrafts([{ key: nextDraftKey(), by: 'name', first: '', last: '', parent: '', code: '' }]);
    setFriendErrors({});
    setFriendState('idle');
    setFriendSaved(null);
    setFriendsFor(r.child);
  };
  async function saveFriends(r: Registration) {
    if (drafts.some(d => d.by === 'code' && codeHasTypo(d.code))) return;
    setFriendState('saving');
    setFriendError('');
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, child: r.child, friends: friendsToSend(drafts) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data.errors) { setFriendErrors(data.errors); setFriendState('idle'); return; }
      if (!res.ok) { setFriendError(data?.error ?? FW.errGeneric); setFriendState('error'); return; }
      setAskedNow(m => ({ ...m, [r.child]: (data.asked ?? []) as FriendAsked[] }));
      setFriendsFor(null);
      setFriendState('idle');
      setFriendSaved(r.child);
    } catch {
      setFriendError(FW.errGeneric);
      setFriendState('error');
    }
  }

  const regs = found.registrations;
  const owed = regs.filter(r => feeLine(r).owing);
  const toPay = owed.reduce((s, r) => s + r.owing, 0);
  const paidKids = regs.filter(r => r.status === 'active' && r.paid && (r.fee ?? 0) > 0);
  const accepted = regs.filter(r => r.status === 'active' && (r.fee ?? 0) > 0);
  // A child can be asked about while live and not already asked about.
  const askable = found.finished ? [] : regs.filter(r => !ended(r) && !r.withdrawRequestedAt && asked !== r.child);
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
        body: JSON.stringify({ token, child: askFor.child, note: askNote.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAskError(data?.error ?? ASK_WORDS.errGeneric); setAskState('error'); return; }
      setAsked(askFor.child);
      setAskSent(ASK_WORDS.sent(emailShown ?? '', askFor.playerFirstName));
      setAskOpen(false);
      setAskNote('');
      setAskState('idle');
    } catch {
      setAskError(ASK_WORDS.errGeneric);
      setAskState('error');
    }
  }
  const sharedRef = regs.length > 0 && regs.every(r => r.ref === regs[0].ref) ? regs[0].ref : null;

  const pay = found.pay;
  // The one pay block owns the money's end of the page while it is waiting on Stripe or there is something to pay.
  const payBlockOwns = !!pay && (!!returnedSession || pay.kind === 'owing' || pay.kind === 'refused' || pay.receipts.length > 0 || pay.clearing.length > 0);
  const endedOnly = pay?.kind === 'ended' ? regs.filter(ended) : [];

  // Each part is a section of the page itself (PublicPage frame="club" width="form"), 24 px apart (club round C5).
  return (
    <>
      {regs.length > 0 && (
        <>
          {/* Board Ready Stage 4 Part 2 (tab 7): the re-tick block comes first, only while a document needs one. */}
          {signupForm && !found.finished && (
            <SignupRetick asks={signupForm.asks} childCount={signupForm.children.length} orgSlug={orgSlug} seasonSlug={seasonSlug}
              token={token} club={found.clubName} contact={contactEmail} />
          )}
          {sharedRef && <p style={soft}>{SW.reference} <strong style={{ color: 'var(--club-text)' }}>{sharedRef}</strong> {SW.referenceQuote}</p>}
          {/* R5 (club round, 2026-11-05): the children are one framed list, a row each on a hairline (they were a card
              each). Every fact a row carried stays in it — the shipped page wins over the drawing's one-line row. */}
          <ul className={kit.list} style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Your children">
          {regs.map((r, i) => {
            const fee = feeLine(r);
            return (
              <li key={r.child} style={{ padding: '12px 16px', borderTop: i === 0 ? 0 : '1px solid var(--club-line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', minHeight: '32px', marginBottom: '0.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--club-text)' }}>
                    {r.playerFirstName}
                  </div>
                  <span className={`${kit.chip} ${r.status === 'active' ? kit.chipOk : kit.chipNeutral}`}>
                    {childTag(r.status, r.waitlistPosition)}
                  </span>
                </div>
                <div style={row}><span style={{ color: 'var(--club-soft)' }}>Division</span><span style={{ color: 'var(--club-text)' }}>{r.divisionName}</span></div>
                {/* 9c (copy §11): an accepted child's team, then their coach once the team is set. */}
                {r.team && (
                  <div style={row}>
                    <span style={{ color: 'var(--club-soft)' }}>Team</span>
                    <span style={{ color: 'var(--club-text)', fontWeight: r.team.name ? 600 : 400 }}>{r.team.name ?? 'Not set yet'}</span>
                  </div>
                )}
                {r.team?.name && (
                  <div style={row}>
                    <span style={{ color: 'var(--club-soft)' }}>Coach</span>
                    <span style={{ color: 'var(--club-text)', textAlign: 'right' }}>{r.team.coaches.length > 0 ? nameList(r.team.coaches) : 'To be announced'}</span>
                  </div>
                )}
                <div style={row}>
                  <span style={{ color: 'var(--club-soft)' }}>Fee</span>
                  <span style={{ color: 'var(--club-text)', fontWeight: fee.owing ? 700 : 400, textAlign: 'right' }}>{fee.text}</span>
                </div>
                {fee.sub && <p style={{ ...soft, textAlign: 'right' }}>{fee.sub}</p>}
                {r.friends && (() => {
                  const fr = r.friends;
                  const asked = askedNow[r.child] ?? fr.asked;
                  const editing = friendsFor === r.child && fr.open;
                  return (
                    <>
                      {fr.code && (
                        <>
                          <div style={{ ...row, alignItems: 'center' }}>
                            <span style={{ color: 'var(--club-soft)' }}>{FW.codeLabel}</span>
                            <FriendCodeRow code={fr.code} childName={r.playerFirstName} />
                          </div>
                          <p className={reg.codeShare} style={{ marginTop: 0 }}>{FW.codeShare(r.playerFirstName)}</p>
                        </>
                      )}
                      {editing ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <FriendFields idPrefix={`s${r.child}`} childName={r.playerFirstName} division={r.divisionName !== '—' ? r.divisionName : null}
                            max={found.friendMax} friends={drafts} nextKey={() => nextDraftKey()} errors={friendErrors} headingLevel={3}
                            onChange={next => { setDrafts(next); setFriendErrors({}); }} />
                          {friendState === 'error' && <p style={{ fontSize: '0.875rem', color: 'var(--danger)', margin: '0.5rem 0 0' }} role="alert">{friendError}</p>}
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={() => setFriendsFor(null)}>{FW.cancel}</button>
                            <button type="button" className={`${kit.btn} ${kit.btnPrimary}`} disabled={friendState === 'saving'} onClick={() => void saveFriends(r)}>
                              {friendState === 'saving' ? FW.saving : FW.save}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {asked.length > 0 ? asked.map((a, n) => (
                            <div key={n} style={row}>
                              <span style={{ color: 'var(--club-soft)' }}>{n === 0 ? FW.playsWith : ''}</span>
                              <span style={{ color: 'var(--club-text)', textAlign: 'right' }}>{'code' in a ? FW.codeLine(a.code) : a.name}</span>
                            </div>
                          )) : (
                            <div style={row}>
                              <span style={{ color: 'var(--club-soft)' }}>{FW.playsWith}</span>
                              <span style={{ color: 'var(--club-soft)', textAlign: 'right' }}>
                                {FW.noOne}{fr.open && <> <button type="button" className={reg.linkButton} onClick={() => openFriends(r)}>{FW.addOne}</button></>}
                              </span>
                            </div>
                          )}
                          {fr.open && asked.length > 0 && (
                            <div style={{ textAlign: 'right' }}>
                              <button type="button" className={reg.linkButton} onClick={() => openFriends(r)}>{FW.change}</button>
                            </div>
                          )}
                          {!fr.open && <p style={{ ...soft, marginTop: '0.4rem' }}>{FW.closed}</p>}
                          {friendSaved === r.child && <p style={{ ...soft, textAlign: 'right' }} role="status">{FW.saved}</p>}
                        </>
                      )}
                    </>
                  );
                })()}
                {(r.withdrawRequestedAt || asked === r.child) && !ended(r) && (
                  <p style={{ ...soft, marginTop: '0.4rem' }}>
                    {ASK_WORDS.childLine(r.playerFirstName, clubDay((r.withdrawRequestedAt ?? new Date().toISOString()).slice(0, 10)))}
                  </p>
                )}
                {!sharedRef && <div style={row}><span style={{ color: 'var(--club-soft)' }}>Reference</span><span>{r.ref}</span></div>}
                {r.status === 'waitlisted' && <p style={{ ...soft, marginTop: '0.4rem' }}>We’ll email you if a spot opens.</p>}
                {r.team && !r.team.name && <p style={{ ...soft, marginTop: '0.4rem' }}>We’ll email you when the teams are set.</p>}
                {r.team?.movedFrom && <p style={{ ...soft, marginTop: '0.4rem' }}>Moved from {r.team.movedFrom.team} on {clubDay(r.team.movedFrom.day)}.</p>}
              </li>
            );
          })}
          </ul>

          {/* Board Ready Stage 4 Part 2 (tab 7, ruling 20): each child's answers and the sign-up's own, with Change. */}
          {signupForm && (
            <SignupAnswers state={signupForm} orgSlug={orgSlug} seasonSlug={seasonSlug} token={token} club={found.clubName} contact={contactEmail} />
          )}

          {wayBack}

          {pay && payBlockOwns ? (
            <LeaguePayBlock pay={pay} returnedSession={returnedSession} left={left} />
          ) : toPay > 0 ? (
            <div className={kit.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--club-text)' }}>To pay</span>
                {/* The total is 20 px in the club's title face (standard R10, club build Part 3, 2026-11-05: was 18.4 at weight 750). */}
                <span style={{ fontFamily: 'var(--club-title-face)', fontWeight: 'var(--club-title-weight)', fontSize: '1.25rem', lineHeight: 1.15, color: 'var(--club-text)' }}>{dollarsLine(toPay)}</span>
              </div>
              <p style={{ ...soft, marginTop: '0.35rem' }}>
                {owed.map(r => `${r.playerFirstName} · ${r.divisionName}`).join('; ')}.
                {paidKids.length > 0 && ` ${nameList(paidKids.map(r => r.playerFirstName))} ${paidKids.length === 1 ? 'is' : 'are'} paid.`}
              </p>
              {found.howToPay && <p style={{ fontSize: '0.875rem', color: 'var(--club-text)', margin: '0.6rem 0 0' }}>How to pay: {found.howToPay}</p>}
              <p style={{ ...soft, marginTop: '0.35rem' }}>Payable separately to {found.clubName}.</p>
            </div>
          ) : pay?.kind === 'ended' && endedOnly.length === regs.length ? (
            // b5: a link to a sign-up that has ended — nothing to pay, and where questions go.
            <div className={kit.card}>
              <p style={{ fontWeight: 700, color: 'var(--club-text)', margin: '0 0 0.35rem' }}>{LW.endedTitle}</p>
              {endedOnly.map(r => (
                <p key={r.child} style={soft}>
                  {r.status === 'withdrawn'
                    ? LW.endedWithdrawn(r.playerFirstName, r.endedAt ? clubDay(r.endedAt.slice(0, 10)) : null)
                    : LW.endedDeclined(r.playerFirstName)}
                </p>
              ))}
              <p style={{ ...soft, marginTop: '0.35rem' }}>{LW.endedQuestions(found.clubName, contactEmail)}</p>
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
                      {r.playerFirstName}
                    </label>
                  ))}
                </fieldset>
              )}
              <label style={labelStyle} htmlFor="ask-note">{ASK_WORDS.noteLabel}</label>
              <textarea id="ask-note" value={askNote} maxLength={300} rows={3} onChange={e => setAskNote(e.target.value)}
                className={form.textarea} style={{ minHeight: '88px' }} aria-describedby="ask-note-hint" />
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

          <p style={{ ...soft, borderTop: '1px solid var(--club-line)', paddingTop: '0.75rem' }}>{footLine}</p>
        </>
      )}
    </>
  );
}
