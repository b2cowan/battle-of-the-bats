'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ListChecks, Check, EyeOff } from 'lucide-react';
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

export default function TryoutDecisionBoard({ apiBase, onError }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
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
        <span className={styles.tallyItem} style={{ marginLeft: 'auto' }}><strong>{board.counts.pending}</strong> undecided</span>
      </div>

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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
