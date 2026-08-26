'use client';
import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { ListChecks, Check, EyeOff, Mail } from 'lucide-react';
import TryoutAcceptDrawer, { type AcceptIdentity, type AcceptSuggestedDues, type AcceptPayload } from './TryoutAcceptDrawer';
import TryoutMemoryStrip from './TryoutMemoryStrip';
import ContinuityCompareCard from '@/components/coaches/ContinuityCompareCard';
import { useContinuityLinks } from '@/lib/hooks/useContinuityLinks';
import type { TryoutMemoryPair } from '@/lib/tryout-report';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import styles from './TryoutDayCard.module.css';
// The email switch reuses the accept drawer's fee-toggle track/knob classes VERBATIM (warm
// overrides included) — two visually-identical toggles in one feature must be one style.
import toggleStyles from './TryoutAcceptDrawer.module.css';

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
  /** True only when an offer email (with its response link) has actually gone out — a
   *  record-only offer has nothing to await (D-E9). */
  offerEmailed?: boolean;
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
  /** Keys the device-remembered email switch per team. */
  teamId?: string;
  /** Explicit per-component write gate (WI-11) — a no-op while tryouts is all-or-nothing. */
  canWrite?: boolean;
  onError?: (msg: string) => void;
}

// Returning-player rows ride the shared useContinuityLinks hook + ContinuityCompareCard
// (one plumbing + one compare surface across both verify doors — 3C /simplify).

const CHOICES: { key: Decision; label: string; status: Status }[] = [
  { key: 'offer', label: 'Offer', status: 'offered' },
  { key: 'waitlist', label: 'Waitlist', status: 'waitlisted' },
  { key: 'cut', label: 'Not this season', status: 'declined' },
];

interface AcceptTarget { registrationId: string; identity: AcceptIdentity; suggestedDues: AcceptSuggestedDues | null }

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

/** Device-remembered, per team — presentation state for a per-ACTION flag. The server only ever
 *  emails when the individual decision request carries the flag, so a device that never turned
 *  the switch on can never send anything (D-E9: the failure direction is always "no email"). */
const emailSwitchKey = (teamId: string) => `tryout-email-decisions:${teamId}`;

export default function TryoutDecisionBoard({ apiBase, continuityApiBase, memoryApiBase, active = true, teamId, canWrite = true, onError }: Props) {
  const confirm = useConfirm();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [continuityOpenId, setContinuityOpenId] = useState<string | null>(null);
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  /** Which player's score breakdown is open. ONE at a time on purpose: the panel is for looking
   *  hard at one kid, and a board with five open panels is the ranked list nobody can scan. */
  const [breakdownOpenId, setBreakdownOpenId] = useState<string | null>(null);
  const [notifyFamily, setNotifyFamily] = useState(false);
  const {
    byCurrent: continuityByReg, decide: decideContinuityShared, dismiss: dismissContinuity,
    busy: continuityBusy, error: continuityErr,
  } = useContinuityLinks(continuityApiBase ?? null, 'registrations');
  const [memoryByReg, setMemoryByReg] = useState<Record<string, TryoutMemoryPair>>({});
  /** Bumped when a continuity link is CONFIRMED — see the memory effect. */
  const [memoryEpoch, setMemoryEpoch] = useState(0);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [acceptLoadingId, setAcceptLoadingId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<AcceptTarget | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((m: string) => { if (onErrorRef.current) onErrorRef.current(m); else console.error(m); }, []);

  // Rehydrate the switch after mount (SSR-safe), per team.
  useEffect(() => {
    if (!teamId) return;
    try { setNotifyFamily(localStorage.getItem(emailSwitchKey(teamId)) === '1'); } catch { /* private mode */ }
  }, [teamId]);
  const toggleNotify = () => {
    setNotifyFamily(v => {
      const next = !v;
      if (teamId) { try { localStorage.setItem(emailSwitchKey(teamId), next ? '1' : '0'); } catch { /* private mode */ } }
      return next;
    });
  };

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

    // Lock BEFORE any await: the confirm below suspends this call mid-dialog, and the shared
    // ConfirmProvider holds a single resolver — a second decide() slipping in while the dialog
    // is open would orphan this one's promise forever (review finding). savingId also disables
    // the other rows' buttons, which is exactly right while a decision dialog is up.
    setSavingId(c.registrationId);

    // With emails ON, a pass sends a release note the moment it lands — and an email cannot be
    // unsent, from a button that sits adjacent to Offer. Ask first, naming what the family gets.
    // Record-only mode needs no ask: nothing outward happens and the tap is fully re-tappable.
    if (choice === 'cut' && notifyFamily) {
      const who = c.name ?? `Bib #${c.bib ?? '—'}`;
      const ok = await confirm({
        title: `Pass on ${who}?`,
        message: c.hasGuardianEmail === false
          ? 'This family has no email on file, so nothing will be sent — remember to tell them yourself.'
          : 'Their family receives a respectful “not this season” email right away. You can change the decision later, but an email can’t be unsent.',
        confirmText: c.hasGuardianEmail === false ? 'Pass' : 'Pass & send',
        cancelText: 'Cancel',
        tone: 'danger',
      });
      if (!ok) { setSavingId(null); return; }
    }

    const prevStatus = c.status;
    // Optimistic: update the one candidate + the tally.
    setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, status: target.status } : x), counts: recount(b.candidates, c.registrationId, target.status) } : b);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: c.registrationId, decision: choice, notifyFamily }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to save decision');
      // Mirror the server's offer-link truth so badges never go stale within a session:
      // an EMAILED offer has a live link; every other transition (waitlist/cut clears the link
      // server-side; a record-only offer never mints one) leaves nothing to await.
      const emailed = choice === 'offer' && notifyFamily && c.hasGuardianEmail !== false;
      setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, offerEmailed: emailed, offerResponse: null, offerExpired: false } : x) } : b);
    } catch (e: any) {
      // Revert just this candidate.
      setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, status: prevStatus } : x), counts: recount(b.candidates, c.registrationId, prevStatus) } : b);
      fail(e.message ?? 'Failed to save decision.');
    } finally {
      setSavingId(null);
    }
  }

  // "Email this offer" / re-send: a fresh Accept/Decline link + new deadline (clears any prior
  // response). The one explicit per-row send that works whatever the switch says.
  async function emailOffer(c: Candidate) {
    if (resendingId || savingId) return;
    setResendingId(c.registrationId);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: c.registrationId, decision: 'resend' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to email the offer');
      // Fresh link + deadline + cleared response → the row is (back to) "awaiting".
      setBoard(b => b ? { ...b, candidates: b.candidates.map(x => x.registrationId === c.registrationId ? { ...x, offerEmailed: true, offerResponse: null, offerExpired: false } : x) } : b);
    } catch (e: any) {
      fail(e.message ?? 'Failed to email the offer.');
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
      // The welcome email follows the same switch as every other decision email (D-E9).
      body: JSON.stringify({ registrationId: regId, notifyFamily, ...payload }),
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
    // data-sandbox-tour: the beat the demo's "how 28 kids got ranked" step rings — the ranked
    // board, still blind. Inert off a demo org.
    <div className={styles.card} data-sandbox-tour="tryout-decisions">
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}><ListChecks size={16} /> Decision board</h3>
          <p className={styles.subtitle}>
            Offer, waitlist, or pass on each player — ranked by score.
            {board.blind && <> <EyeOff size={12} style={{ verticalAlign: '-1px' }} /> Names are hidden — use the switch above to decide by name.</>}
          </p>
        </div>
      </div>

      {/* D-E9: the email switch lives directly above the decision buttons, so what a tap does is
          visible at the moment of decision. Default OFF — decisions are the coach's to deliver. */}
      {canWrite && (
        <div className={styles.notifyRow}>
          <button
            type="button"
            role="switch"
            aria-checked={notifyFamily}
            aria-label="Email families my decisions"
            className={toggleStyles.toggle}
            onClick={toggleNotify}
          >
            <span className={`${toggleStyles.switch} ${notifyFamily ? toggleStyles.switchOn : ''}`}>
              <span className={toggleStyles.knob} aria-hidden />
            </span>
          </button>
          <div className={styles.notifyText}>
            <span className={styles.notifyLabel}><Mail size={13} style={{ verticalAlign: '-2px' }} /> Email families my decisions</span>
            <span className={styles.notifyHint}>
              {notifyFamily
                ? 'On — each choice emails the family right away: an offer with an Accept/Decline link, a waitlist update, or a respectful release note on “Not this season”.'
                : 'Off — decisions are only recorded here; you reach out yourself. Offered players keep an “Email this offer” button for selective sends.'}
            </span>
          </div>
        </div>
      )}

      <div className={styles.tally}>
        <span className={styles.tallyItem}><strong>{board.counts.offered}</strong> offered</span>
        <span className={styles.tallyItem}><strong>{board.counts.waitlisted}</strong> waitlist</span>
        <span className={styles.tallyItem}><strong>{board.counts.declined}</strong> passed</span>
        {board.counts.accepted > 0 && <span className={styles.tallyItem}><strong>{board.counts.accepted}</strong> accepted</span>}
        {familyDeclined > 0 && <span className={styles.tallyItem} style={{ color: 'var(--danger-light)' }}><strong>{familyDeclined}</strong> declined by family</span>}
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
                    <span className={styles.noEmailChip} title="No guardian email was captured for this candidate — no decision email can reach this family.">
                      no email on file — notify by phone
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
                <span className={styles.acceptedChip}><Check size={13} /> Accepted</span>
              ) : canWrite ? (
                <div className={styles.decisionCol}>
                  <div className={styles.choiceGroup} role="group" aria-label="Decision">
                    {CHOICES.map(choice => (
                      <button
                        key={choice.key}
                        type="button"
                        className={`${styles.choiceBtn} ${c.status === choice.status ? styles[`choice_${choice.key}`] : ''}`}
                        onClick={() => decide(c, choice.key)}
                        // Also locked while an accept drawer is LOADING — cutting a candidate whose
                        // drawer is about to open would present a stale accept form (server 409s
                        // either way; this keeps the UI honest).
                        disabled={!!savingId || !!acceptLoadingId}
                        aria-pressed={c.status === choice.status}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  {c.status === 'offered' && (
                    <>
                      {/* Response badges only make sense once an offer EMAIL exists — a
                          record-only offer has nothing to await (D-E9). */}
                      {c.offerEmailed && offerBadge(c)}
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
                      {c.offerResponse !== 'accepted' && c.hasGuardianEmail !== false && (
                        <button
                          type="button"
                          className={styles.resendBtn}
                          onClick={() => emailOffer(c)}
                          disabled={!!resendingId || !!savingId}
                          title="Email the offer with a fresh Accept/Decline link + response deadline"
                        >
                          {resendingId === c.registrationId ? 'Sending…' : c.offerEmailed ? 'Resend offer' : '✉ Email this offer'}
                        </button>
                      )}
                    </>
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

/** A small chip showing where a family's offer response stands (emailed offers only). */
function offerBadge(c: Candidate) {
  let text: string, color: string;
  if (c.offerResponse === 'accepted') { text = '✓ Family accepted'; color = 'var(--logic-lime)'; }
  else if (c.offerResponse === 'declined') { text = '✕ Family declined'; color = 'var(--danger-light)'; }
  else if (c.offerExpired) { text = 'Offer expired'; color = 'var(--warning-light)'; }
  else { text = 'Awaiting response'; color = 'var(--home-dim, rgba(255,255,255,0.45))'; }
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
