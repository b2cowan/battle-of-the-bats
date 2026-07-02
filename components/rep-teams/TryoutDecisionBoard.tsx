'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ListChecks, Check, EyeOff } from 'lucide-react';
import TryoutAcceptDrawer, { type AcceptIdentity, type AcceptSuggestedDues, type AcceptPayload } from './TryoutAcceptDrawer';
import styles from './TryoutDayCard.module.css';

type Status = 'pending_review' | 'offered' | 'waitlisted' | 'accepted' | 'declined' | 'withdrawn';
type Decision = 'offer' | 'waitlist' | 'cut';

interface Candidate {
  registrationId: string;
  bib: string | null;
  name: string | null;
  composite: number | null;
  evaluatorCount: number;
  status: Status;
  // 2B.5: the family's self-serve offer response + a lazily-computed deadline lapse (offered rows only).
  offerResponse?: 'accepted' | 'declined' | null;
  offerExpired?: boolean;
}
interface Counts { offered: number; waitlisted: number; declined: number; accepted: number; pending: number }
interface Board {
  blind: boolean;
  locked: boolean;
  scaleMax: number;
  counts: Counts;
  total: number;
  candidates: Candidate[];
}

interface Props {
  /** Decisions API, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-decisions`. */
  apiBase: string;
  onError?: (msg: string) => void;
}

const CHOICES: { key: Decision; label: string; status: Status }[] = [
  { key: 'offer', label: 'Offer', status: 'offered' },
  { key: 'waitlist', label: 'Waitlist', status: 'waitlisted' },
  { key: 'cut', label: 'Not this season', status: 'declined' },
];

interface AcceptTarget { registrationId: string; identity: AcceptIdentity; suggestedDues: AcceptSuggestedDues | null }

export default function TryoutDecisionBoard({ apiBase, onError }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [acceptLoadingId, setAcceptLoadingId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<AcceptTarget | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((m: string) => { if (onErrorRef.current) onErrorRef.current(m); else console.error(m); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load decision board');
      setBoard(data);
    } catch (e: any) {
      fail(e.message ?? 'Failed to load decision board.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => { load(); }, [load]);

  async function decide(c: Candidate, choice: Decision) {
    if (savingId) return;
    const target = CHOICES.find(x => x.key === choice)!;
    if (c.status === target.status) return; // no-op
    setSavingId(c.registrationId);
    const prevStatus = c.status;
    // Optimistic: update the one candidate + the tally.
    setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, status: target.status } : x), counts: recount(b.candidates, c.registrationId, target.status) } : b);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: c.registrationId, decision: choice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to save decision');
    } catch (e: any) {
      // Revert just this candidate.
      setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, status: prevStatus } : x), counts: recount(b.candidates, c.registrationId, prevStatus) } : b);
      fail(e.message ?? 'Failed to save decision.');
    } finally {
      setSavingId(null);
    }
  }

  // Re-send the offer email with a fresh Accept/Decline link + new deadline (clears any prior response).
  async function resendOffer(c: Candidate) {
    if (resendingId || savingId) return;
    setResendingId(c.registrationId);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: c.registrationId, decision: 'resend' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to resend offer');
      // Fresh link + deadline + cleared response → the row is back to "awaiting".
      setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, offerResponse: null, offerExpired: false } : x) } : b);
    } catch (e: any) {
      fail(e.message ?? 'Failed to resend the offer.');
    } finally {
      setResendingId(null);
    }
  }

  // Open the accept drawer for an offered candidate: fetch identity + the team's standard fee schedule.
  async function openAccept(c: Candidate) {
    if (acceptLoadingId || savingId) return;
    setAcceptLoadingId(c.registrationId);
    try {
      const res = await fetch(`${apiBase}/accept?registrationId=${encodeURIComponent(c.registrationId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Could not open accept');
      setAcceptTarget({ registrationId: c.registrationId, identity: data.registration, suggestedDues: data.suggestedDues ?? null });
    } catch (e: any) {
      fail(e.message ?? 'Could not open the accept form.');
    } finally {
      setAcceptLoadingId(null);
    }
  }

  // Confirm accept → atomic roster + optional dues. On success flip the candidate to the Accepted chip.
  async function confirmAccept(payload: AcceptPayload) {
    if (!acceptTarget) return;
    const regId = acceptTarget.registrationId;
    const res = await fetch(`${apiBase}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: regId, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to add the player.');
    setBoard(b => b ? {
      ...b,
      candidates: b.candidates.map(x => x.registrationId === regId ? { ...x, status: 'accepted' } : x),
      counts: recount(b.candidates, regId, 'accepted'),
    } : b);
    setAcceptTarget(null);
  }

  if (loading) return null;
  if (!board) return null;

  if (board.total === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.head}>
          <div>
            <h3 className={styles.title}><ListChecks size={16} /> Decision board</h3>
            <p className={styles.subtitle}>Offer, waitlist, or pass on each player — ranked by score.</p>
          </div>
        </div>
        <p className={styles.empty}>No candidates yet. Players appear here once they&apos;ve registered or checked in.</p>
      </div>
    );
  }

  // Offered candidates whose family has declined — still 'offered' status until the coach acts, so they
  // sit inside counts.offered. Surface them so the "offered" number never implies a spot is still open.
  const familyDeclined = board.candidates.filter(c => c.status === 'offered' && c.offerResponse === 'declined').length;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}><ListChecks size={16} /> Decision board</h3>
          <p className={styles.subtitle}>
            Offer, waitlist, or pass on each player — ranked by score.
            {board.blind && <> <EyeOff size={12} style={{ verticalAlign: '-1px' }} /> Blind — reveal names on the Tryout Day card to decide by name.</>}
          </p>
        </div>
      </div>

      <div className={styles.tally}>
        <span className={styles.tallyItem}><strong>{board.counts.offered}</strong> offered</span>
        <span className={styles.tallyItem}><strong>{board.counts.waitlisted}</strong> waitlist</span>
        <span className={styles.tallyItem}><strong>{board.counts.declined}</strong> passed</span>
        {board.counts.accepted > 0 && <span className={styles.tallyItem}><strong>{board.counts.accepted}</strong> accepted</span>}
        {familyDeclined > 0 && <span className={styles.tallyItem} style={{ color: '#f87171' }}><strong>{familyDeclined}</strong> declined by family</span>}
        <span className={styles.tallyItem} style={{ marginLeft: 'auto' }}><strong>{board.counts.pending}</strong> undecided</span>
      </div>

      {/* 2B.5: a spot may have opened (a family declined or an offer lapsed) and players are waitlisted.
          We only flag the coach — never auto-offer (D2). */}
      {board.counts.waitlisted > 0 &&
        board.candidates.some(c => c.status === 'offered' && (c.offerResponse === 'declined' || c.offerExpired)) && (
        <p className={styles.offerNudge}>
          A spot may have opened — <strong>{board.counts.waitlisted}</strong> {board.counts.waitlisted === 1 ? 'player is' : 'players are'} waitlisted. Extend an offer when you&apos;re ready.
        </p>
      )}

      <div className={styles.sessionList}>
        {board.candidates.map((c, i) => {
          const accepted = c.status === 'accepted';
          return (
            <div key={c.registrationId} className={styles.scoreRow}>
              <div className={styles.rank}>{c.composite != null ? `#${i + 1}` : '—'}</div>
              <div className={styles.scoreMain}>
                <div className={styles.sessionWhen}>
                  <span className={styles.bib}>#{c.bib ?? '—'}</span>
                  {c.name && <span style={{ marginLeft: '0.5rem' }}>{c.name}</span>}
                </div>
                <div className={styles.sessionMeta}>
                  {c.composite != null ? <>score {c.composite.toFixed(1)}/{board.scaleMax} · {c.evaluatorCount} eval{c.evaluatorCount === 1 ? '' : 's'}</> : 'not scored yet'}
                </div>
              </div>
              {accepted ? (
                <span className={styles.acceptedChip}><Check size={13} /> Accepted</span>
              ) : (
                <div className={styles.decisionCol}>
                  <div className={styles.choiceGroup} role="group" aria-label="Decision">
                    {CHOICES.map(choice => (
                      <button
                        key={choice.key}
                        type="button"
                        className={`${styles.choiceBtn} ${c.status === choice.status ? styles[`choice_${choice.key}`] : ''}`}
                        onClick={() => decide(c, choice.key)}
                        disabled={!!savingId}
                        aria-pressed={c.status === choice.status}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  {c.status === 'offered' && (
                    <>
                      {offerBadge(c)}
                      <button
                        type="button"
                        className={styles.acceptRosterBtn}
                        onClick={() => openAccept(c)}
                        disabled={!!savingId || !!acceptLoadingId}
                      >
                        {acceptLoadingId === c.registrationId ? 'Opening…'
                          : c.offerResponse === 'accepted' ? 'Confirm → add to roster'
                          : 'Accept → add to roster'}
                      </button>
                      {c.offerResponse !== 'accepted' && (
                        <button
                          type="button"
                          className={styles.resendBtn}
                          onClick={() => resendOffer(c)}
                          disabled={!!resendingId || !!savingId}
                          title="Re-send the offer email with a fresh Accept/Decline link + new deadline"
                        >
                          {resendingId === c.registrationId ? 'Resending…' : 'Resend offer'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {acceptTarget && (
        <TryoutAcceptDrawer
          identity={acceptTarget.identity}
          suggestedDues={acceptTarget.suggestedDues}
          onClose={() => setAcceptTarget(null)}
          onConfirm={confirmAccept}
        />
      )}
    </div>
  );
}

/** A small chip showing where a family's offer response stands (offered rows only). */
function offerBadge(c: Candidate) {
  let text: string, color: string;
  if (c.offerResponse === 'accepted') { text = '✓ Family accepted'; color = 'var(--logic-lime, #a3e635)'; }
  else if (c.offerResponse === 'declined') { text = '✕ Family declined'; color = '#f87171'; }
  else if (c.offerExpired) { text = 'Offer expired'; color = '#fbbf24'; }
  else { text = 'Awaiting response'; color = 'rgba(255,255,255,0.45)'; }
  return <span style={{ fontSize: '0.72rem', fontWeight: 700, color, textAlign: 'right' }}>{text}</span>;
}

/** Recompute the tally after one candidate's status changes (keeps the header honest without a refetch). */
function recount(candidates: Candidate[], changedId: string, newStatus: Status): Counts {
  const counts: Counts = { offered: 0, waitlisted: 0, declined: 0, accepted: 0, pending: 0 };
  for (const c of candidates) {
    const s = c.registrationId === changedId ? newStatus : c.status;
    if (s === 'offered') counts.offered++;
    else if (s === 'waitlisted') counts.waitlisted++;
    else if (s === 'declined') counts.declined++;
    else if (s === 'accepted') counts.accepted++;
    else counts.pending++;
  }
  return counts;
}
