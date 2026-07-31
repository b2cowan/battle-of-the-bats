'use client';
import { useState, useEffect, useCallback } from 'react';
import { EyeOff, ChevronLeft, Check, Lock } from 'lucide-react';
import styles from './TryoutScorerSurface.module.css';

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
  expiresAt: string | null;
}

type ErrorKind = 'invalid' | 'revoked' | 'expired' | 'load' | null;

/**
 * The field scoring surface — ONE implementation behind two doors (Chunk E, WI-1):
 * the public /tryout-score/{token} page (volunteer evaluators, bearer-token URL) and the
 * coach's authenticated tryouts/score sub-page (`selfMode`). Fixed-dark by design — see
 * the module header.
 *
 * `apiBase` must answer GET (Context) and POST ({registrationId, categoryKey, score}) with
 * the shared shapes from lib/tryout-score-session.ts.
 */
export default function TryoutScorerSurface({
  apiBase,
  selfMode = false,
  backHref,
}: {
  apiBase: string;
  /** Signed-in coach door: "(you) — signed in" identity line, no link-lifetime line. */
  selfMode?: boolean;
  /** Where the header's back link points (self mode only). */
  backHref?: string;
}) {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind>(null);
  const [scores, setScores] = useState<ScoreMap>({});
  const [selected, setSelected] = useState<string | null>(null);
  // Per-category in-flight keys, so tapping a second category doesn't wait on the first (field speed).
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  // Check-in keeps happening while scoring starts — refresh the list when the scorer comes back
  // into focus so a late arrival doesn't sit under "Not checked in" all session (review finding).
  // Guarded: never while a candidate is open or a save is in flight (a reload mid-entry would
  // yank the scorer's state out from under them).
  useEffect(() => {
    const onFocus = () => {
      if (selected == null && savingKeys.size === 0 && !error) load();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load, selected, savingKeys, error]);

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
        // A link that died MID-SESSION becomes the same full-screen state it would be on load —
        // a silent cell revert reads as "my taps stopped counting" on a sunny field (WI-8).
        if (d.error === 'revoked' || d.error === 'expired' || d.error === 'invalid') {
          setError(d.error);
          setSelected(null);
        }
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
    // The default copy differs by DOOR: "ask the coach" is written for the volunteer-token page;
    // on the signed-in door the viewer IS the coach (a 403/404/500 lands here too), so the copy
    // sends them back to their own hub instead of to themselves (review finding).
    const msg = error === 'revoked' ? 'This scoring link has been turned off by the coach. Your saved scores are kept — if this is a mistake, ask the coach for a fresh link.'
      : error === 'expired' ? 'This scoring link has expired. Your saved scores are kept — ask the coach for a new link.'
      : error === 'load' ? 'Couldn’t load the scorecard. Check your connection and try again.'
      : selfMode ? 'Couldn’t open your scoring session. Head back to Tryouts and try again.'
      : 'This link isn’t valid. Ask the coach to send a new one.';
    return (
      <div className={styles.center}>
        <div className={styles.stateCard}>
          {msg}
          {(error === 'load' || (selfMode && error === 'invalid')) && (
            <div><button type="button" className={styles.stateBtn} onClick={load}>Try again</button></div>
          )}
          {selfMode && backHref && error !== 'load' && (
            <div><a className={styles.stateBtn} style={{ display: 'inline-block', lineHeight: '46px', textDecoration: 'none' }} href={backHref}>Back to Tryouts</a></div>
          )}
        </div>
      </div>
    );
  }
  if (!ctx) return null;

  const complete = (regId: string) => ctx.categories.length > 0 && ctx.categories.every(c => scores[regId]?.[c.key]?.score != null);
  const scoredCount = ctx.candidates.filter(c => complete(c.registrationId)).length;

  // No scorecard configured yet.
  if (ctx.categories.length === 0) {
    return <div className={styles.center}><div className={styles.stateCard}>The coach hasn’t set up the scorecard yet. Check back shortly.</div></div>;
  }

  const active = selected ? ctx.candidates.find(c => c.registrationId === selected) : null;

  // Checked-in players first — an evaluator in sunlight shouldn't scroll past no-shows (WI-10).
  // (Pre-check-in, everyone is "absent": the list renders undimmed with no divider.)
  const present = ctx.candidates.filter(c => c.isCheckedIn);
  const absent = ctx.candidates.filter(c => !c.isCheckedIn);
  const dimAbsent = present.length > 0;

  const candidateRow = (c: Candidate, dim: boolean) => (
    <button key={c.registrationId} type="button" className={`${styles.row} ${dim ? styles.rowDim : ''}`} onClick={() => setSelected(c.registrationId)}>
      <span className={styles.bib}>#{c.bib ?? '—'}</span>
      <span className={styles.rowMain}>
        {c.name ? <span className={styles.name}>{c.name}</span> : <span className={styles.nameMuted}>Player {c.bib ?? ''}</span>}
      </span>
      {complete(c.registrationId) && <span className={styles.done}><Check size={16} /></span>}
    </button>
  );

  return (
    <div className={styles.page}>
      {!active ? (
        <>
          <header className={styles.header}>
            {selfMode && backHref && (
              <a className={styles.backLink} href={backHref}><ChevronLeft size={15} /> Back to Tryouts</a>
            )}
            <div className={styles.headerRow}>
              <div>
                <div className={styles.team}>{ctx.teamName ?? 'Tryout'}</div>
                <div className={styles.who}>
                  Scoring as {ctx.evaluatorName ?? 'evaluator'}{selfMode && ' (you) — signed in'}
                </div>
              </div>
              {ctx.blind && <span className={styles.blindChip}><EyeOff size={13} /> Blind</span>}
            </div>
            <div className={styles.progress}>{scoredCount} of {ctx.candidates.length} scored</div>
            {/* The link's own lifetime, said up front — a volunteer scoring across a multi-day
                tryout shouldn't be blindsided by a silent lockout (WI-8). Token door only. */}
            {!selfMode && ctx.expiresAt && !ctx.locked && (
              <div className={styles.expiry}>
                Link active until {new Date(ctx.expiresAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
            {ctx.locked && <div className={styles.lockedBanner}><Lock size={13} /> Scoring is closed.</div>}
          </header>

          <div className={styles.list}>
            {present.map(c => candidateRow(c, false))}
            {absent.length > 0 && (
              <>
                {dimAbsent && <div className={styles.divider}>Not checked in ({absent.length})</div>}
                {absent.map(c => candidateRow(c, dimAbsent))}
              </>
            )}
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
