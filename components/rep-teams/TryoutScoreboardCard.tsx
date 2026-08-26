'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, TrendingUp, TrendingDown, Lock, LockOpen } from 'lucide-react';
import TryoutNamesSwitch from './TryoutNamesSwitch';
import styles from './TryoutDayCard.module.css';

interface CategoryDef { key: string; label: string; weight: number }
interface EvaluatorRow { id: string; name: string | null; isSelf: boolean; candidatesScored: number; meanScore: number | null; biasDelta: number | null; biased: boolean }
interface CandidateRow {
  registrationId: string;
  bib: string | null;
  name: string | null;
  composite: number | null;
  evaluatorCount: number;
  categoryAverages: Record<string, number | null>;
  isCheckedIn: boolean;
}
interface Scoreboard {
  blind: boolean;
  locked: boolean;
  scaleMax: number;
  categories: CategoryDef[];
  consensusMean: number | null;
  evaluators: EvaluatorRow[];
  candidates: CandidateRow[];
}

interface Props {
  /** Scoreboard API, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-scoreboard`. */
  apiBase: string;
  /** Tryout-settings API (the sessions route) used to lock/reopen scoring. Omit to hide the control. */
  settingsBase?: string;
  /** Explicit per-component write gate (WI-11) — a no-op while tryouts is all-or-nothing, but the
   *  invariant is reviewable here instead of implicit in the page above. */
  canWrite?: boolean;
  onError?: (msg: string) => void;
}

const POLL_MS = 6000;

export default function TryoutScoreboardCard({ apiBase, settingsBase, canWrite = true, onError }: Props) {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const inFlight = useRef(false);
  // Bumped on every lock toggle so a poll response fetched BEFORE the toggle can't overwrite it.
  const gen = useRef(0);
  // Keep onError behind a ref so `fail` (→ `load` → the polling effect) stays stable across parent
  // re-renders — otherwise reporting an error would tear down and restart the interval.
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((m: string) => { if (onErrorRef.current) onErrorRef.current(m); else console.error(m); }, []);

  const load = useCallback(async (quiet: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const myGen = gen.current;
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load scoreboard');
      // Discard a response that a lock toggle superseded while it was in flight.
      if (myGen === gen.current) setBoard(data);
    } catch (e: any) {
      if (!quiet) fail(e.message ?? 'Failed to load scoreboard.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => {
    load(false);
    // Poll for "live" updates — the portal uses no client Realtime by design.
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function toggleLock() {
    if (!settingsBase || !board || locking) return;
    setLocking(true);
    try {
      const res = await fetch(settingsBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockScores: !board.locked }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Failed to update scoring lock'); }
      // Invalidate any in-flight poll, reflect the new state immediately, then reconcile.
      gen.current++;
      setBoard(b => b ? { ...b, locked: !b.locked } : b);
      await load(false);
    } catch (e: any) {
      fail(e.message ?? 'Failed to update scoring lock.');
    } finally {
      setLocking(false);
    }
  }

  if (loading) return null;
  if (!board) return null;

  const scored = board.candidates.filter(c => c.composite != null);
  const anyScores = scored.length > 0;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>
            <Trophy size={16} /> Live scoreboard
            {!board.locked && <span className={styles.pollDot} aria-hidden />}
          </h3>
          <p className={styles.subtitle}>
            Ranked by weighted average across evaluators. {board.locked ? 'Scoring is closed.' : 'Updates automatically.'}

          </p>
        </div>
        <div className={styles.headActions}>
          {/* The names switch sits beside the lock because they are the two things a head coach
              changes ABOUT a running board, as opposed to the scores on it. */}
          {settingsBase && (
            <TryoutNamesSwitch
              apiBase={settingsBase}
              canWrite={canWrite}
              blind={board.blind}
              // The SAME invalidation the lock toggle does one line down, and for the same reason:
              // a poll GET issued before the switch can resolve after it and repaint the old state.
              // `load` also early-returns while a poll is in flight, so without the optimistic set
              // the pill could stay wrong until the next 6s tick (/review 2026-08-25).
              onChanged={b => {
                gen.current++;
                setBoard(prev => prev ? { ...prev, blind: b } : prev);
                load(false);
              }}
            />
          )}
        {settingsBase && canWrite && (
          <button type="button" className={styles.revealBtn} onClick={toggleLock} disabled={locking}
            title={board.locked ? 'Reopen scoring for evaluators' : 'Freeze evaluator scoring'}>
            {board.locked ? <><LockOpen size={14} /> Reopen scoring</> : <><Lock size={14} /> Lock scoring</>}
          </button>
        )}
        </div>
      </div>

      {board.evaluators.length > 0 && (
        <div className={styles.evalChips}>
          {board.evaluators.map(e => (
            <span key={e.id} className={`${styles.evalChip} ${e.biased ? styles.evalChipBias : ''}`}>
              {e.name ?? 'Evaluator'}{e.isSelf && ' (you)'}
              {e.meanScore != null && <span className={styles.evalChipMean}> avg {e.meanScore}</span>}
              {e.biased && e.biasDelta != null && (
                <span className={styles.biasFlag} title="This evaluator’s average is out of line with the group — worth a look.">
                  {e.biasDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {e.biasDelta > 0 ? 'runs hot' : 'runs cold'}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {!anyScores ? (
        <p className={styles.empty}>Scores appear here as evaluators submit them.</p>
      ) : (
        <div className={styles.sessionList}>
          {board.candidates.map((c, i) => (
            <div key={c.registrationId} className={styles.scoreRow}>
              <div className={styles.rank}>{c.composite != null ? `#${i + 1}` : '—'}</div>
              <div className={styles.scoreMain}>
                <div className={styles.sessionWhen}>
                  <span className={styles.bib}>#{c.bib ?? '—'}</span>
                  {c.name && <span style={{ marginLeft: '0.5rem' }}>{c.name}</span>}
                </div>
                <div className={styles.sessionMeta}>
                  {/* A no-show must never read as merely "unscored" — a kid with a family
                      emergency is not a kid who scored low (WI-3). */}
                  {!c.isCheckedIn && <span style={{ marginRight: '0.7rem', fontWeight: 700 }}>didn’t check in ·</span>}
                  {board.categories.map(cat => {
                    const v = c.categoryAverages[cat.key];
                    return <span key={cat.key} style={{ marginRight: '0.7rem' }}>{cat.label} {v != null ? v.toFixed(1) : '–'}</span>;
                  })}
                </div>
              </div>
              <div className={styles.compositeWrap}>
                <div className={styles.composite}>{c.composite != null ? c.composite.toFixed(1) : '–'}</div>
                {/* No "/5" beside every row (owner 2026-08-23): one tryout has one scale, so the
                    denominator was noise — the raw score + how many scored it carry the row. The
                    scale still reads once from the Set up rubric card ("Scale 1–5"), and the
                    cross-season memory strip deliberately KEEPS its /N, where scales can differ. */}
                <div className={styles.compositeUnit}>{c.evaluatorCount} eval{c.evaluatorCount === 1 ? '' : 's'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
