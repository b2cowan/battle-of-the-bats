'use client';
import { use, useState, useEffect, useCallback } from 'react';
import { EyeOff, ChevronLeft, Check, Lock } from 'lucide-react';
import styles from './tryout-score.module.css';

interface CategoryDef { key: string; label: string; weight: number; instructions?: string }
interface Candidate { registrationId: string; bib: string | null; name: string | null; isCheckedIn: boolean }
type ScoreMap = Record<string, Record<string, { score: number; note: string | null }>>;
interface Context {
  evaluatorName: string | null;
  teamName: string | null;
  blind: boolean;
  locked: boolean;
  scaleMax: number;
  categories: CategoryDef[];
  candidates: Candidate[];
  scores: ScoreMap;
}

export default function TryoutScorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const apiBase = `/api/tryout-score/${token}`;

  const [ctx, setCtx] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'invalid' | 'revoked' | 'expired' | 'load' | null>(null);
  const [scores, setScores] = useState<ScoreMap>({});
  const [selected, setSelected] = useState<string | null>(null);
  // Per-category in-flight keys, so tapping a second category doesn't wait on the first (field speed).
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiBase);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error === 'revoked' || d.error === 'expired' ? d.error : 'invalid');
          return;
        }
        const data: Context = await res.json();
        setCtx(data);
        setScores(data.scores ?? {});
      } catch {
        setError('load');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  const setScore = useCallback(async (registrationId: string, category: CategoryDef, value: number) => {
    if (!ctx || ctx.locked) return;
    const key = `${registrationId}:${category.key}`;
    // Capture ONLY this category's prior value so a failed save reverts just this cell —
    // never a whole-map snapshot that would wipe out other categories tapped in parallel.
    const prevEntry = scores[registrationId]?.[category.key] ?? null;
    const revertThisCell = () => setScores(s => {
      const reg = { ...(s[registrationId] ?? {}) };
      if (prevEntry != null) reg[category.key] = prevEntry; else delete reg[category.key];
      return { ...s, [registrationId]: reg };
    });

    setSavingKeys(s => new Set(s).add(key));
    // Optimistic (functional update — safe against concurrent taps).
    setScores(s => ({ ...s, [registrationId]: { ...(s[registrationId] ?? {}), [category.key]: { score: value, note: s[registrationId]?.[category.key]?.note ?? null } } }));
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, categoryKey: category.key, score: value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === 'locked') { setCtx(c => c ? { ...c, locked: true } : c); }
        revertThisCell();
      }
    } catch {
      revertThisCell();
    } finally {
      setSavingKeys(s => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [apiBase, ctx, scores]);

  if (loading) return <div className={styles.center}>Loading…</div>;

  if (error) {
    const msg = error === 'revoked' ? 'This scoring link has been turned off by the coach.'
      : error === 'expired' ? 'This scoring link has expired. Ask the coach for a new one.'
      : error === 'load' ? 'Couldn’t load the scorecard. Check your connection and try again.'
      : 'This link isn’t valid. Ask the coach to resend it.';
    return <div className={styles.center}><div className={styles.stateCard}>{msg}</div></div>;
  }
  if (!ctx) return null;

  const complete = (regId: string) => ctx.categories.length > 0 && ctx.categories.every(c => scores[regId]?.[c.key]?.score != null);
  const scoredCount = ctx.candidates.filter(c => complete(c.registrationId)).length;

  // No scorecard configured yet.
  if (ctx.categories.length === 0) {
    return <div className={styles.center}><div className={styles.stateCard}>The coach hasn’t set up the scorecard yet. Check back shortly.</div></div>;
  }

  const active = selected ? ctx.candidates.find(c => c.registrationId === selected) : null;

  return (
    <div className={styles.page}>
      {!active ? (
        <>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div>
                <div className={styles.team}>{ctx.teamName ?? 'Tryout'}</div>
                <div className={styles.who}>Scoring as {ctx.evaluatorName ?? 'evaluator'}</div>
              </div>
              {ctx.blind && <span className={styles.blindChip}><EyeOff size={13} /> Blind</span>}
            </div>
            <div className={styles.progress}>{scoredCount} of {ctx.candidates.length} scored</div>
            {ctx.locked && <div className={styles.lockedBanner}><Lock size={13} /> Scoring is closed.</div>}
          </header>

          <div className={styles.list}>
            {ctx.candidates.map(c => (
              <button key={c.registrationId} type="button" className={styles.row} onClick={() => setSelected(c.registrationId)}>
                <span className={styles.bib}>#{c.bib ?? '—'}</span>
                <span className={styles.rowMain}>
                  {c.name ? <span className={styles.name}>{c.name}</span> : <span className={styles.nameMuted}>Player {c.bib ?? ''}</span>}
                </span>
                {complete(c.registrationId) && <span className={styles.done}><Check size={16} /></span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <header className={styles.header}>
            <button type="button" className={styles.back} onClick={() => setSelected(null)}><ChevronLeft size={18} /> All players</button>
            <div className={styles.detailBib}>
              <span className={styles.bib}>#{active.bib ?? '—'}</span>
              {active.name ? <span className={styles.name}>{active.name}</span> : <span className={styles.nameMuted}>Player {active.bib ?? ''}</span>}
            </div>
            {ctx.locked && <div className={styles.lockedBanner}><Lock size={13} /> Scoring is closed.</div>}
          </header>

          <div className={styles.cats}>
            {ctx.categories.map(cat => {
              const current = scores[active.registrationId]?.[cat.key]?.score ?? null;
              const key = `${active.registrationId}:${cat.key}`;
              return (
                <div key={cat.key} className={styles.cat}>
                  <div className={styles.catLabel}>{cat.label}</div>
                  {cat.instructions && <div className={styles.catHint}>{cat.instructions}</div>}
                  <div className={styles.scale}>
                    {Array.from({ length: ctx.scaleMax }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        type="button"
                        className={`${styles.scaleBtn} ${current === n ? styles.scaleBtnOn : ''}`}
                        onClick={() => setScore(active.registrationId, cat, n)}
                        disabled={ctx.locked || savingKeys.has(key)}
                        aria-pressed={current === n}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.detailFooter}>
            <button type="button" className={styles.doneBtn} onClick={() => setSelected(null)}>Done</button>
          </div>
        </>
      )}
    </div>
  );
}
