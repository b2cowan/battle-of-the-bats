'use client';
import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { ListChecks, Check, EyeOff } from 'lucide-react';
import TryoutMemoryStrip from './TryoutMemoryStrip';
import ContinuityCompareCard from '@/components/coaches/ContinuityCompareCard';
import { useContinuityLinks } from '@/lib/hooks/useContinuityLinks';
import type { TryoutMemoryPair } from '@/lib/tryout-report';
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
  /** Whether the club holds an email address for this family — a coach who now delivers EVERY
   *  decision personally needs to know when there is no address to write to (owner 2026-08-26:
   *  the platform sends nothing on their behalf). Nothing here mails anyone. */
  hasGuardianEmail?: boolean;
  isCheckedIn?: boolean;
  playerNotes?: string | null;
  /** Each category's cross-evaluator average, keyed by the scorecard's category key. */
  categoryAverages?: Record<string, number | null>;
  /** What each evaluator, alone, made of this player — highest first. The reason the panel
   *  exists: 4.1 from a 4.6 and a 3.5 is a different player from 4.1 three people agreed on. */
  evaluatorScores?: { name: string | null; composite: number }[];
}
interface Counts { offered: number; waitlisted: number; declined: number; accepted: number; pending: number }
interface Board {
  blind: boolean;
  locked: boolean;
  scaleMax: number;
  /** The scorecard as the coach set it — label + weight per category, in card order. Drives the
   *  breakdown's rows AND its share percentages, so a renamed category renames here too. */
  categories: { key: string; label: string; weight: number }[];
  counts: Counts;
  total: number;
  candidates: Candidate[];
}

interface Props {
  /** Decisions API, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-decisions`. */
  apiBase: string;
  /** Returning-player continuity API (Player Development 3C), e.g.
   *  `/api/coaches/{orgSlug}/teams/{teamId}/development/continuity`. Optional — chips only
   *  render when provided AND the candidate's name is visible (never in blind mode: a
   *  prior-season name beside an anonymized bib would break blind integrity). */
  continuityApiBase?: string;
  /**
   * Candidate-memory API (Tryout Insights Phase 3), e.g.
   * `/api/coaches/{orgSlug}/teams/{teamId}/tryout-memory`. Optional — the strip renders only for
   * candidates the SERVER paired, which it does only post-reveal and only on confirmed links
   * (R6/R7). This component adds no gate of its own beyond not asking while blind.
   */
  memoryApiBase?: string;
  /**
   * True while Decide is the visible stage. The hub keeps every stage MOUNTED and hides them with
   * CSS, so without this the memory fetch — and the multi-season resolution behind it — would run
   * on every visit to Tryouts, including visits that never open Decide. Same `active` contract the
   * report and baseline cards on the Build stage already take.
   */
  active?: boolean;
  /** Explicit per-component write gate (WI-11) — a no-op while tryouts is all-or-nothing. */
  canWrite?: boolean;
  onError?: (msg: string) => void;
}

// Returning-player rows ride the shared useContinuityLinks hook + ContinuityCompareCard
// (one plumbing + one compare surface across both verify doors — 3C /simplify).

/**
 * ⚠ THESE ARE THREE PILES, NOT THREE ACTIONS (owner ruling 2026-08-26). The label was "Offer" — the
 * only VERB among two states — and it read as a button that fires something outward, which is
 * exactly what this board no longer does. "Offering" is a stance the coach holds; the word stays in
 * the offer family on purpose, so the report ("Offers extended"), the season record and the
 * returning-player strip keep their one vocabulary. Do not reintroduce an action-shaped label here.
 */
const CHOICES: { key: Decision; label: string; status: Status }[] = [
  { key: 'offer', label: 'Offering', status: 'offered' },
  { key: 'waitlist', label: 'Waitlist', status: 'waitlisted' },
  { key: 'cut', label: 'Not this season', status: 'declined' },
];


/** How far apart the highest and lowest evaluator were on one player. Null below two evaluators —
 *  one person cannot disagree with themselves, and "0.0 apart" would read as agreement. */
function evaluatorSpread(c: Candidate): number | null {
  const vals = (c.evaluatorScores ?? []).map(e => e.composite);
  if (vals.length < 2) return null;
  return Math.round((Math.max(...vals) - Math.min(...vals)) * 100) / 100;
}

/** A whole point apart on the same kid, on the same scorecard, is the threshold at which a coach
 *  should look before deciding rather than trust the average. Scale-relative, because a 1-point gap
 *  means something different on a 1–10 card than on a 1–5 one. */
const SPLIT_THRESHOLD = (scaleMax: number) => scaleMax * 0.2;

/** The player's three strongest categories, for the collapsed row: "Hitting 4.6 · Attitude 4.5 · …".
 *  Ordered by score, not by card order — the row is answering "what is this kid good at?". */
function topCategories(c: Candidate, categories: Board['categories']): string {
  const scored = categories
    .map(def => ({ label: def.label, avg: c.categoryAverages?.[def.key] ?? null }))
    .filter((x): x is { label: string; avg: number } => x.avg != null)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);
  return scored.map(x => `${x.label} ${x.avg.toFixed(1)}`).join(' · ');
}

/**
 * What made the number — opened by tapping a player on the board (owner 2026-08-25).
 *
 * Two halves, and the second is the one that earns the feature: the categories say WHERE the score
 * came from, weighted by the share the coach gave them; the evaluator chips say WHO it came from.
 * A composite cannot distinguish three people agreeing on 4.1 from one person at 4.6 and another at
 * 3.5, and those are different players to offer a spot to.
 *
 * ⚠ It renders only what the server sent. The per-evaluator numbers are composited server-side with
 * the SAME weighting as the headline score (`weightedComposite`), so this component does no
 * arithmetic beyond the spread — a second opinion here is how the panel would start contradicting
 * the row it opened from.
 */
function ScoreBreakdown({ candidate, categories, scaleMax }: {
  candidate: Candidate;
  categories: Board['categories'];
  scaleMax: number;
}) {
  const evals = candidate.evaluatorScores ?? [];
  if (candidate.composite == null) {
    return (
      <div className={styles.breakdown}>
        <p className={styles.breakdownNote}>
          Nobody has scored {candidate.name ?? `bib ${candidate.bib ?? '—'}`} yet, so there is nothing behind the number.
        </p>
      </div>
    );
  }

  // Shares, not raw weights (owner ruling, tryout scorecard weights): a coach set "Hitting 3" and
  // needs to read "40% of the score". Zero total = an unweighted card, where every category counts
  // the same — say so rather than printing a row of 0%.
  //
  // ⚠ THE SHARE IS OVER THE CATEGORIES THAT WERE ACTUALLY SCORED, not over the whole scorecard
  // (/review 2026-08-25). The composite re-normalizes over the scored subset — an unscored category
  // contributes nothing and is not a zero — so totalling every weight made the panel contradict the
  // number at the top of it: a candidate scored on Hitting and Fielding only was told "Attitude, 17%
  // of the score" for a category that had contributed none of it. An unscored row now says so
  // instead of claiming a share.
  const scored = categories.filter(def => candidate.categoryAverages?.[def.key] != null);
  const weightTotal = scored.reduce((sum, c) => sum + (c.weight > 0 ? c.weight : 0), 0);
  const lowest = scored.length
    ? Math.min(...scored.map(def => candidate.categoryAverages![def.key]!))
    : null;
  const spread = evaluatorSpread(candidate);
  const split = spread != null && spread >= SPLIT_THRESHOLD(scaleMax);

  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownHead}>What made {candidate.composite.toFixed(1)}</div>
      <div className={styles.catList}>
        {categories.map(def => {
          const avg = candidate.categoryAverages?.[def.key] ?? null;
          // Unscored ⇒ no share to claim; unweighted card ⇒ every scored category counts alike.
          const share = avg == null || weightTotal <= 0
            ? null
            : Math.round((Math.max(def.weight, 0) / weightTotal) * 100);
          return (
            <div key={def.key} className={styles.catRow}>
              <span className={styles.catLabel}>
                <b>{def.label}</b>
                <span>
                  {avg == null ? 'not scored' : share != null ? `${share}% of the score` : 'counts the same as the rest'}
                </span>
              </span>
              <span className={styles.catTrack}>
                {avg != null && (
                  <i
                    className={avg === lowest ? styles.catFillThin : undefined}
                    style={{ width: `${Math.min(100, (avg / scaleMax) * 100)}%` }}
                  />
                )}
              </span>
              <span className={`${styles.catNum} ${avg == null ? styles.catNumNone : ''}`}>
                {avg != null ? avg.toFixed(1) : '–'}
              </span>
            </div>
          );
        })}
      </div>

      {evals.length > 0 && (
        <>
          <div className={styles.breakdownHead}>Each helper’s number for this player</div>
          <div className={styles.evalRow}>
            {evals.map((e, idx) => (
              <span key={idx} className={styles.evalScore}>
                {e.name ?? 'Evaluator'} <b>{e.composite.toFixed(1)}</b>
              </span>
            ))}
          </div>
        </>
      )}

      <p className={styles.breakdownNote}>
        {split
          ? <><strong>These helpers are {spread!.toFixed(1)} apart</strong> on the same player — worth a second look before you decide.</>
          : spread != null
            ? <>All {evals.length} helpers landed within {spread.toFixed(1)} of each other.</>
            : <>Scored by one helper so far.</>}
        {lowest != null && <> Lowest category is marked.</>}
      </p>
    </div>
  );
}

/**
 * ⚠ THIS BOARD SENDS NOTHING TO A FAMILY, and there is no switch that changes that (owner ruling
 * 2026-08-26, binding). A rep offer is a custom letter the family SIGNS — frequently conditional,
 * frequently the opening of a conversation — so a generic platform email is not that artifact and
 * cannot stand in for it. The removed "Email families my decisions" switch and per-row "Email this
 * offer" button were a mis-tap risk one tap from "Not this season" with no upside, and their
 * removal took the family self-serve Accept/Decline loop with them (the reply token only ever
 * travelled inside the offer email). Do not reintroduce either without an owner ruling —
 * off-by-default is a mitigation, not the answer. Plan:
 * docs/projects/active/COACH_TRYOUT_EMAIL_REMOVAL_PLAN.md.
 */
export default function TryoutDecisionBoard({ apiBase, continuityApiBase, memoryApiBase, active = true, canWrite = true, onError }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [continuityOpenId, setContinuityOpenId] = useState<string | null>(null);
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  /** Which player's score breakdown is open. ONE at a time on purpose: the panel is for looking
   *  hard at one kid, and a board with five open panels is the ranked list nobody can scan. */
  const [breakdownOpenId, setBreakdownOpenId] = useState<string | null>(null);
  const {
    byCurrent: continuityByReg, decide: decideContinuityShared, dismiss: dismissContinuity,
    busy: continuityBusy, error: continuityErr,
  } = useContinuityLinks(continuityApiBase ?? null, 'registrations');
  const [memoryByReg, setMemoryByReg] = useState<Record<string, TryoutMemoryPair>>({});
  /** Bumped when a continuity link is CONFIRMED — see the memory effect. */
  const [memoryEpoch, setMemoryEpoch] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
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

  /**
   * ⚠ **Reload whenever Decide becomes the visible stage — not once on mount** (/review 2026-08-03).
   *
   * Revealing names happens on the SET UP stage, in a different card, which updates only its own
   * state. The hub keeps every stage mounted, so a mount-only load meant the board a coach came
   * back to still held the payload it fetched while blind: bib numbers, no names, the "Blind —
   * reveal names" banner, and — once Phase 3 landed — no memory strips either, because the strip
   * waits on `blind === false`. Reveal → Decide is the documented workflow, so the feature would
   * simply not have appeared for the coach who followed it, until they happened to hard-refresh.
   *
   * Same `active`-driven refresh the report card on the Build stage already uses.
   */
  useEffect(() => { if (active) load(); }, [active, load]);

  /**
   * Candidate memory — fetched only when Decide is open AND the board says names are revealed
   * (R6). The server refuses while blind anyway; not asking is the second lock, and it also
   * spares every blind tryout a request that can only answer "nothing".
   *
   * Re-runs when `board.blind` flips, so revealing names fills the strips in without a reload.
   * A failure is silent: memory is enrichment, and a candidate row must still be decidable.
   *
   * ⚠ It also re-runs on `memoryEpoch`, which CONFIRMING a returning-player match bumps
   * (/review 2026-08-03). The verify card sits inside this very board, and a confirmed identity is
   * exactly what creates a pair server-side — so without this, the coach who followed the intended
   * "verify, then decide" flow confirmed the match and watched nothing happen, because the shared
   * continuity hook updates only its own local state.
   *
   * The guarded path deliberately clears NOTHING: the map is only ever filled by the fetch below.
   * Not clearing also means tabbing back to Decide keeps the strips up while they refresh instead
   * of flashing empty.
   *
   * ⚠⚠ **THIS USED TO SAY "revealing names is one-way, so there is no transition that could strand
   * stale memory on screen." THAT PREMISE DIED on 2026-08-25** when the switch became two-way — the
   * board can now go names-shown → names-hidden without unmounting, whenever the switch is flipped
   * on one of the other three screens. What actually holds the line today is the render gate below:
   * every strip is `c.name && memoryByReg[...]`, and the server nulls `name` again the moment this
   * board refetches while hidden. **Do not delete that `c.name &&` as redundant** — it is now the
   * only thing standing between a re-hidden tryout and a prior season's real name sitting beside a
   * bib number (/review 2026-08-25, traced: no live leak, one edit away from one).
   */
  const blind = board?.blind;
  useEffect(() => {
    if (!memoryApiBase || !active || blind !== false) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(memoryApiBase);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMemoryByReg(data.byRegistration ?? {});
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [memoryApiBase, active, blind, memoryEpoch]);

  // Surface the shared hook's decide errors through the board's own error channel.
  useEffect(() => { if (continuityErr) fail(continuityErr); }, [continuityErr, fail]);

  async function decide(c: Candidate, choice: Decision) {
    if (savingId) return;
    const target = CHOICES.find(x => x.key === choice)!;
    if (c.status === target.status) return; // no-op

    // No confirm on "Not this season" any more. The dialog existed for exactly one reason — a
    // release email could not be unsent — and with nothing outward happening a pass is a recorded
    // decision the coach can change back in one tap. Asking twice for a reversible, private write
    // is friction with no purpose (owner ruling 2026-08-26).
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

  // One tap → roster place. No drawer, no fees, no welcome email: the coach has had the
  // conversation already, and the amount a family owes depends on a roster size that does not
  // exist yet (owner 2026-08-26).
  async function addToRoster(c: Candidate) {
    if (addingId || savingId) return;
    setAddingId(c.registrationId);
    try {
      const res = await fetch(`${apiBase}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: c.registrationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to add the player.');
      setBoard(b => b ? {
        ...b,
        candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, status: 'accepted' } : x),
        counts: recount(b.candidates, c.registrationId, 'accepted'),
      } : b);
    } catch (e: any) {
      fail(e.message ?? 'Failed to add the player.');
    } finally {
      setAddingId(null);
    }
  }

  /**
   * Take a rostered player back off, returning them to Offering.
   *
   * ⚠ THE SERVER REFUSES THIS ONCE ANYTHING HAS ATTACHED TO THE PLAYER, and that guard is the
   * whole feature. Nineteen tables cascade off a roster player — dues payments, fundraiser credits,
   * attendance, lineups, awards, development goals and measurables, documents, family links — so an
   * unguarded undo would silently erase a season's records with no warning. Free for a mis-tap,
   * refused for a player who has actually been playing, and the refusal says which.
   */
  async function undoAccept(c: Candidate) {
    if (undoingId || savingId) return;
    setUndoingId(c.registrationId);
    try {
      const res = await fetch(`${apiBase}/accept`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: c.registrationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Could not undo this.');
      setBoard(b => b ? {
        ...b,
        candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, status: 'offered' } : x),
        counts: recount(b.candidates, c.registrationId, 'offered'),
      } : b);
    } catch (e: any) {
      fail(e.message ?? 'Could not undo this.');
    } finally {
      setUndoingId(null);
    }
  }

  // Only the FIRST load blanks the stage. A refresh triggered by returning to Decide keeps the
  // board a coach was just looking at on screen until the new payload lands, rather than flashing
  // the panel empty every time they tab away and back.
  if (loading && !board) return null;
  if (!board) return null;

  if (board.total === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.head}>
          <div>
            <h3 className={styles.title}><ListChecks size={16} /> Decision board</h3>
            <p className={styles.subtitle}>Sort each player into a pile — ranked by score.</p>
          </div>
        </div>
        <p className={styles.empty}>No candidates yet. Players appear here once they&apos;ve registered or checked in.</p>
      </div>
    );
  }

  return (
    // data-sandbox-tour: the beat the demo's "how 28 kids got ranked" step rings — the ranked
    // board, still blind. Inert off a demo org.
    <div className={styles.card} data-sandbox-tour="tryout-decisions">
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}><ListChecks size={16} /> Decision board</h3>
          <p className={styles.subtitle}>
            Sort each player into a pile — ranked by score.
            {board.blind && <> <EyeOff size={12} style={{ verticalAlign: '-1px' }} /> Names are hidden — use the switch above to decide by name.</>}
          </p>
        </div>
      </div>

      {/* The two things the buttons cannot say for themselves: nothing goes out, and the Offering
          pile is what Build your team draws from. Read once, then ignored — which is the right
          trade for a line that stops a coach assuming families have been told (owner 2026-08-26). */}
      <p className={styles.sortNote}>
        Sorting only — <strong>nothing is sent to anyone</strong>. Whoever sits in Offering is who you
        build the roster from.
      </p>

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
          // Chips are BLIND-SAFE: only when the candidate's name is already visible —
          // a prior-season name beside an anonymized bib would break blind integrity.
          const contRows = c.name ? (continuityByReg[c.registrationId] ?? []) : [];
          const suggested = contRows.filter(r => r.status === 'suggested');
          const confirmedRow = contRows.find(r => r.status === 'confirmed');
          const hasFamilyNote = !!c.playerNotes;
          return (
            <Fragment key={c.registrationId}>
            <div className={`${styles.scoreRow} ${breakdownOpenId === c.registrationId ? styles.scoreRowOpen : ''}`}>
              <div className={styles.rank}>{c.composite != null ? `#${i + 1}` : '—'}</div>
              {/* THE RATING, as the row's anchor (owner 2026-08-25). It used to sit inside the meta
                  line as grey text, while the live scoreboard — same players, same ranking, same
                  arithmetic — showed it large on the right. The two screens had drifted; this is
                  Decide catching up. Doubles as the tap target for the breakdown. */}
              <button
                type="button"
                className={styles.ratingBtn}
                onClick={() => setBreakdownOpenId(id => id === c.registrationId ? null : c.registrationId)}
                aria-expanded={breakdownOpenId === c.registrationId}
                aria-label={c.composite != null
                  ? `Score ${c.composite.toFixed(1)} from ${c.evaluatorCount} evaluator${c.evaluatorCount === 1 ? '' : 's'} — show what made it`
                  : 'Not scored yet'}
              >
                <span className={`${styles.ratingVal} ${c.composite == null ? styles.ratingNone : ''}`}>
                  {c.composite != null ? c.composite.toFixed(1) : '–'}
                </span>
                <span className={styles.ratingUnit}>
                  {c.composite != null
                    ? `${c.evaluatorCount} eval${c.evaluatorCount === 1 ? '' : 's'}`
                    : 'no score'}
                </span>
              </button>
              <div className={styles.scoreMain}>
                <div className={styles.sessionWhen}>
                  <span className={styles.bib}>#{c.bib ?? '—'}</span>
                  {c.name && <span style={{ marginLeft: '0.5rem' }}>{c.name}</span>}
                  {c.hasGuardianEmail === false && (
                    <span className={styles.noEmailChip} title="No guardian email was captured for this candidate — you'll need a phone number to reach this family.">
                      no email on file — reach them by phone
                    </span>
                  )}
                  {suggested.length > 0 && (
                    <button type="button"
                      style={{ marginLeft: '0.5rem', background: 'rgba(var(--home-rust-rgb, 180,83,9),0.18)', border: '1px solid var(--warning)', color: 'var(--home-amber, #fcd34d)', fontSize: '0.66rem', fontWeight: 700, padding: '0.14rem 0.5rem', borderRadius: 999, cursor: 'pointer' }}
                      onClick={() => setContinuityOpenId(id => id === c.registrationId ? null : c.registrationId)}>
                      Possible returning player — verify
                    </button>
                  )}
                  {confirmedRow && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--logic-lime)', fontSize: '0.7rem' }}>
                      ↩ returning · {confirmedRow.prior.seasonLabel}
                    </span>
                  )}
                </div>
                <div className={styles.sessionMeta}>
                  {/* A no-show must never read as merely "not scored yet" — a kid with a family
                      emergency is not a kid who scored low (WI-3). */}
                  {c.isCheckedIn === false && <span style={{ fontWeight: 700 }}>didn’t check in · </span>}
                  {/* The score itself moved OUT of this line into the rating block. What stays is
                      the player's three best categories — a row that says something about the kid
                      before anyone opens anything. Same ruling as the live scoreboard (owner
                      2026-08-23): no per-row "/5". */}
                  {c.composite != null ? (
                    <button
                      type="button"
                      className={styles.noteToggle}
                      onClick={() => setBreakdownOpenId(id => id === c.registrationId ? null : c.registrationId)}
                      aria-expanded={breakdownOpenId === c.registrationId}
                    >
                      {topCategories(c, board.categories) || 'what made this score'}
                      {' '}{breakdownOpenId === c.registrationId ? '▾' : '▸'}
                    </button>
                  ) : 'not scored yet'}
                  {hasFamilyNote && (
                    <button type="button" className={styles.noteToggle}
                      onClick={() => setNotesOpenId(id => id === c.registrationId ? null : c.registrationId)}
                      aria-expanded={notesOpenId === c.registrationId}>
                      {notesOpenId === c.registrationId ? '▾' : '▸'} family&apos;s note
                    </button>
                  )}
                </div>
                {notesOpenId === c.registrationId && hasFamilyNote && (
                  <div className={styles.familyNote}>{c.playerNotes}</div>
                )}
                {breakdownOpenId === c.registrationId && (
                  <ScoreBreakdown candidate={c} categories={board.categories} scaleMax={board.scaleMax} />
                )}
              </div>
              {accepted ? (
                <div className={styles.decisionCol}>
                  <span className={styles.acceptedChip}><Check size={13} /> On the roster</span>
                  {/* Accepting used to be a ONE-WAY DOOR — the board refused to touch the row and
                      releasing them from the roster did not put them back, so a mis-tap was
                      permanent. Undo is deliberately guarded rather than free: nineteen tables
                      cascade off a roster player, so an unguarded delete would silently take a
                      season of dues, attendance, lineups and development with it (owner 2026-08-26). */}
                  {canWrite && (
                    <button
                      type="button"
                      className={styles.undoBtn}
                      onClick={() => undoAccept(c)}
                      disabled={!!savingId || undoingId === c.registrationId}
                      title="Take this player back off the roster and return them to the board"
                    >
                      {undoingId === c.registrationId ? 'Undoing…' : 'Undo'}
                    </button>
                  )}
                </div>
              ) : canWrite ? (
                <div className={styles.decisionCol}>
                  <div className={styles.choiceGroup} role="group" aria-label="Decision">
                    {CHOICES.map(choice => (
                      <button
                        key={choice.key}
                        type="button"
                        className={`${styles.choiceBtn} ${c.status === choice.status ? styles[`choice_${choice.key}`] : ''}`}
                        onClick={() => decide(c, choice.key)}
                        disabled={!!savingId || !!addingId}
                        aria-pressed={c.status === choice.status}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  {/* ONE TAP, no drawer (owner 2026-08-26). The drawer's fee half was removed — a
                      per-player amount cannot be known before the roster size is, which is the very
                      thing it depends on — and what remained were three optional fields the Roster
                      page already edits better, all players at once. Finishing a tryout gets you a
                      roster place and nothing more; dues come later, from Set dues for all players. */}
                  {c.status === 'offered' && (
                    <button
                      type="button"
                      className={styles.acceptRosterBtn}
                      onClick={() => addToRoster(c)}
                      disabled={!!savingId || !!addingId}
                    >
                      {addingId === c.registrationId ? 'Adding…' : 'Add to roster'}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            {/* Candidate memory (Phase 3, frame 06). Gated on the SERVER's pairing plus a visible
                name — the server pairs only post-reveal and only on confirmed links, so an
                unverified match reaches this line with nothing to render, which is the spec. */}
            {c.name && memoryByReg[c.registrationId] && (
              <div className={styles.memorySlot}>
                <TryoutMemoryStrip pair={memoryByReg[c.registrationId]} />
              </div>
            )}
            {continuityOpenId === c.registrationId && suggested.length > 0 && (
              <div style={{ margin: '0 0 0.6rem 2.2rem' }}>
                {/* No manual panel-close on reject/dismiss: both remove the row from the
                    hook map, and the `suggested.length > 0` render gate collapses the
                    panel when the LAST row goes — other pending rows stay visible
                    (profile-card parity; 3C review fix). */}
                {suggested.map(row => (
                  <ContinuityCompareCard key={row.linkId} row={row} busy={continuityBusy}
                    // A confirmed identity is what makes this candidate's history readable, so ask
                    // for it the moment the coach vouches for them. A failed confirm just costs a
                    // harmless re-read.
                    onConfirm={async () => {
                      await decideContinuityShared(c.registrationId, row, 'confirm');
                      setMemoryEpoch(e => e + 1);
                    }}
                    onReject={() => decideContinuityShared(c.registrationId, row, 'reject')}
                    onDismiss={() => dismissContinuity(c.registrationId, row.linkId)} />
                ))}
              </div>
            )}
            </Fragment>
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
