'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
 * coach's Score face on the tryouts hub (`selfMode` + `embedded`, One-Room build 2026-08-23).
 * Fixed-dark by design — see the module header.
 *
 * Two widths, one surface (both doors): narrow keeps the phone field flow byte-for-byte
 * (list ⇄ full-screen player, sticky Done, big sunlight targets); ≥1024px is a master–detail —
 * the player list stays put beside the scorecard, and both back levels stop existing because
 * there is nothing to go back from. No "next" walker either: a tryout runs as stations, so
 * list-pick is the whole navigation (owner 2026-08-23).
 *
 * `apiBase` must answer GET (Context) and POST ({registrationId, categoryKey, score}) with
 * the shared shapes from lib/tryout-score-session.ts.
 */
export default function TryoutScorerSurface({
  apiBase,
  selfMode = false,
  embedded = false,
  active = true,
}: {
  apiBase: string;
  /** Signed-in coach door: "(you) — signed in" identity line, no link-lifetime line. */
  selfMode?: boolean;
  /** Score face of the tryouts hub: no own header/back link (the hub's face row carries
   *  identity + blind), contained card instead of a 100dvh page. */
  embedded?: boolean;
  /** Is this surface the one on screen? The hub keeps faces mounted display:none, so becoming
   *  active again is the moment to quietly re-sync (a lock or late walk-up from another face
   *  must not wait for a window refocus). Standalone doors are always active. */
  active?: boolean;
}) {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind>(null);
  const [scores, setScores] = useState<ScoreMap>({});
  const [selected, setSelected] = useState<string | null>(null);
  // Per-category in-flight keys, so tapping a second category doesn't wait on the first (field speed).
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Sequence token for loads (/review 2026-08-23): quiet refreshes replace the WHOLE score map,
  // and a tap is saved optimistically — so a refresh that was already in flight when the tap
  // landed must be discarded, or it repaints the pre-tap server snapshot over a cell the POST
  // has (or is about to have) saved. `setScore` bumps the token to invalidate anything airborne;
  // overlapping refreshes resolve last-token-wins instead of last-to-arrive-wins.
  const loadSeq = useRef(0);

  // `quiet` refreshes in place: no loading blank, and a transient failure never takes a working
  // scorer down — on a quiet refresh only a REAL session verdict (revoked/expired) may surface;
  // a 5xx/parse miss maps to 'invalid' and is ignored until a loud action meets it (/review
  // 2026-08-23 — a background refresh used to full-screen the scorer on a server blip).
  const load = useCallback(async (quiet = false) => {
    const seq = ++loadSeq.current;
    if (!quiet) { setLoading(true); setError(null); }
    try {
      const res = await fetch(apiBase);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const kind: ErrorKind = d.error === 'revoked' || d.error === 'expired' ? d.error : 'invalid';
        if (!quiet) setError(kind);
        else if (kind !== 'invalid' && seq === loadSeq.current) { setError(kind); setSelected(null); }
        return;
      }
      const data: Context = await res.json();
      if (seq !== loadSeq.current) return; // superseded by a newer load or a tap
      setCtx(data);
      setScores(data.scores ?? {});
    } catch {
      if (!quiet) setError('load');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  // Coming back onto screen (face flip in the hub) re-syncs quietly — a lock toggled from the
  // Live board, or a walk-up checked in on the Check-in face, must show without a refocus.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current && savingKeys.size === 0 && !error) load(true);
    wasActive.current = active;
  }, [active, savingKeys, error, load]);

  // Check-in keeps happening while scoring starts — refresh the list when the scorer comes back
  // into focus so a late arrival doesn't sit under "Not checked in" all session (review finding).
  // Guarded on in-flight saves only (2026-08-23): the old "never while a candidate is open" guard
  // starved the DESKTOP two-pane, where a candidate is open all session. Safe now because the
  // refresh is quiet (no loading blank) and every tap is already saved optimistically — the
  // server's score map IS the local one by the time a refresh lands.
  useEffect(() => {
    const onFocus = () => {
      if (savingKeys.size === 0 && !error) load(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load, savingKeys, error]);

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

    // Invalidate any refresh already in flight — its snapshot predates this tap (see loadSeq).
    loadSeq.current++;
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

  const centerClass = embedded ? `${styles.center} ${styles.centerEmbedded}` : styles.center;
  if (loading) return <div className={centerClass}>Loading…</div>;

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
      <div className={centerClass}>
        <div className={styles.stateCard}>
          {msg}
          {(error === 'load' || (selfMode && error === 'invalid')) && (
            <div><button type="button" className={styles.stateBtn} onClick={() => load()}>Try again</button></div>
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
    return <div className={centerClass}><div className={styles.stateCard}>The coach hasn’t set up the scorecard yet. Check back shortly.</div></div>;
  }

  const openCand = selected ? ctx.candidates.find(c => c.registrationId === selected) : null;

  // Checked-in players first — an evaluator in sunlight shouldn't scroll past no-shows (WI-10).
  // (Pre-check-in, everyone is "absent": the list renders undimmed with no divider.)
  const present = ctx.candidates.filter(c => c.isCheckedIn);
  const absent = ctx.candidates.filter(c => !c.isCheckedIn);
  const dimAbsent = present.length > 0;

  // No "Next player" walker (owner 2026-08-23): a tryout runs as STATIONS, not a queue — kids
  // are hit-evaluated at one time and field-evaluated at another, in whatever order the line
  // forms. Picking a player from the list IS the workflow; any "next" would be fiction.
  const catsScored = openCand ? ctx.categories.filter(c => scores[openCand.registrationId]?.[c.key]?.score != null).length : 0;

  const candidateRow = (c: Candidate, dim: boolean) => (
    <button
      key={c.registrationId}
      type="button"
      className={`${styles.row} ${dim ? styles.rowDim : ''} ${openCand?.registrationId === c.registrationId ? styles.rowOn : ''}`}
      onClick={() => setSelected(c.registrationId)}
    >
      <span className={styles.bib}>#{c.bib ?? '—'}</span>
      <span className={styles.rowMain}>
        {c.name ? <span className={styles.name}>{c.name}</span> : <span className={styles.nameMuted}>Player {c.bib ?? ''}</span>}
      </span>
      {complete(c.registrationId) && <span className={styles.done}><Check size={16} /></span>}
    </button>
  );

  return (
    <div className={`${styles.page} ${embedded ? styles.pageEmbedded : ''} ${openCand ? styles.hasActive : ''}`}>
      {/* The standalone doors keep their header (identity, blind, lifetime). Embedded, the hub's
          face row already says all of it — only a lock still has to shout here. */}
      {!embedded && (
        <header className={`${styles.header} ${styles.topHeader}`}>
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
      )}
      {embedded && ctx.locked && (
        <div className={`${styles.lockedBanner} ${styles.lockedBannerEmbedded}`}><Lock size={13} /> Scoring is closed.</div>
      )}

      <div className={styles.panes}>
        <div className={styles.listPane}>
          <div className={styles.listHead}>{scoredCount} of {ctx.candidates.length} scored</div>
          <div className={styles.list}>
            {present.map(c => candidateRow(c, false))}
            {absent.length > 0 && (
              <>
                {dimAbsent && <div className={styles.divider}>Not checked in ({absent.length})</div>}
                {absent.map(c => candidateRow(c, dimAbsent))}
              </>
            )}
          </div>
        </div>

        <div className={styles.detailPane}>
          {openCand ? (
            <>
              <header className={`${styles.header} ${styles.detailHead}`}>
                <button type="button" className={styles.back} onClick={() => setSelected(null)}><ChevronLeft size={18} /> All players</button>
                <div className={styles.detailBib}>
                  <span className={styles.bib}>#{openCand.bib ?? '—'}</span>
                  {openCand.name ? <span className={styles.name}>{openCand.name}</span> : <span className={styles.nameMuted}>Player {openCand.bib ?? ''}</span>}
                  <span className={styles.catCount}>{catsScored} of {ctx.categories.length} categories</span>
                </div>
                {ctx.locked && <div className={`${styles.lockedBanner} ${styles.detailLock}`}><Lock size={13} /> Scoring is closed.</div>}
              </header>

              <div className={styles.cats}>
                {ctx.categories.map(cat => {
                  const current = scores[openCand.registrationId]?.[cat.key]?.score ?? null;
                  const key = `${openCand.registrationId}:${cat.key}`;
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
                            onClick={() => setScore(openCand.registrationId, cat, n)}
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
          ) : (
            <div className={styles.detailEmpty}>Select a player to score</div>
          )}
        </div>
      </div>
    </div>
  );
}
