'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, TrendingUp, TrendingDown, EyeOff } from 'lucide-react';
import styles from './TryoutDayCard.module.css';

interface CategoryDef { key: string; label: string; weight: number }
interface EvaluatorRow { id: string; name: string | null; candidatesScored: number; meanScore: number | null; biasDelta: number | null; biased: boolean }
interface CandidateRow {
  registrationId: string;
  bib: string | null;
  name: string | null;
  composite: number | null;
  evaluatorCount: number;
  categoryAverages: Record<string, number | null>;
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
  onError?: (msg: string) => void;
}

const POLL_MS = 6000;

export default function TryoutScoreboardCard({ apiBase, onError }: Props) {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  // Keep onError behind a ref so `fail` (→ `load` → the polling effect) stays stable across parent
  // re-renders — otherwise reporting an error would tear down and restart the interval.
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((m: string) => { if (onErrorRef.current) onErrorRef.current(m); else console.error(m); }, []);

  const load = useCallback(async (quiet: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load scoreboard');
      setBoard(data);
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
            <span className={styles.pollDot} aria-hidden />
          </h3>
          <p className={styles.subtitle}>
            Ranked by weighted average across evaluators. Updates automatically.
            {board.blind && <> <EyeOff size={12} style={{ verticalAlign: '-1px' }} /> Blind — bib numbers only.</>}
          </p>
        </div>
      </div>

      {board.evaluators.length > 0 && (
        <div className={styles.evalChips}>
          {board.evaluators.map(e => (
            <span key={e.id} className={`${styles.evalChip} ${e.biased ? styles.evalChipBias : ''}`}>
              {e.name ?? 'Evaluator'}
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
                  {board.categories.map(cat => {
                    const v = c.categoryAverages[cat.key];
                    return <span key={cat.key} style={{ marginRight: '0.7rem' }}>{cat.label} {v != null ? v.toFixed(1) : '–'}</span>;
                  })}
                </div>
              </div>
              <div className={styles.compositeWrap}>
                <div className={styles.composite}>{c.composite != null ? c.composite.toFixed(1) : '–'}</div>
                <div className={styles.compositeUnit}>/{board.scaleMax} · {c.evaluatorCount} eval{c.evaluatorCount === 1 ? '' : 's'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
