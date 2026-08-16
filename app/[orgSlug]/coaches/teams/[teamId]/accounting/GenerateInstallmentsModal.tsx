'use client';
import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import {
  computeBudgetTotals, describeInstallmentBases, splitPerPlayer,
  type InstallmentBasis,
} from '@/lib/coach-budget-totals';
import { tournamentToday, formatDayMonth } from '@/lib/timezone';
import type { RepBudgetPlan, RepInstallmentPreviewRow } from '@/lib/types';
import DateField from './DateField';
import styles from './budget/budget.module.css';
// ⚠ One `..` shallower than the panels' copy of this import — this file sits at the accounting
// root, they sit in a tab folder below it. TypeScript will not catch a wrong depth here (CSS
// modules are wildcard-typed); only the compiler will, at request time.
import shared from '../../../coaches.module.css';

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BASIS_LABEL: Record<Exclude<InstallmentBasis, 'manual'>, string> = {
  budget:   'Split the budget evenly',
  estimate: 'Split the season estimate evenly',
};

interface InstallmentRow { date: string; amount: string }
const DEFAULT_INSTALLMENT: InstallmentRow = { date: '', amount: '' };

interface GenerateResult {
  playersProcessed: number;
  /** Players whose recorded payments were kept and re-applied to the new schedule (mig 232 —
   *  nothing is skipped any more; money and plan are separate records). */
  playersWithPaymentsKept: number;
  /** Dollars of payments beyond a player's NEW total, auto-saved as overpayment credits. */
  overpaymentCreditsCreated: number;
  /** Players whose dues could NOT be written. Named, because the coach has to go fix them by
   *  hand and a bare count would leave them checking the whole roster. */
  playersFailed: string[];
  /** Hand-set schedules the coach chose to keep — left completely untouched by the run. */
  playersSkipped: number;
}

/** A per-player arrangement a plain replace would flatten. Named, so it can be kept. */
interface HandSetPlayer { id: string; name: string }

/**
 * What the confirm step needs from the ALREADY_HAS_DUES 409 — the two things it actually says out
 * loud. The response also carries `playersWithDues` / `playersWithPayments`, which the old
 * count-based copy used and this screen no longer does; they are deliberately NOT stored, because
 * state the screen never reads is state the next reader has to chase down before believing it is
 * inert.
 */
interface ReplaceFacts {
  handSetPlayers: HandSetPlayer[];
  playersWithDateChange: number;
}

/**
 * THE bulk-dues door — one modal, reached from two places.
 *
 * The Budget Plan tab opens it as "generate from this budget"; Player Dues opens it as "set dues
 * for all players" (owner ruling 2026-08-13, replacing that tab's own total-and-installments
 * form). Those were two divergent flows writing the same rows, and only one of them showed the
 * coach what each player would actually owe before committing it.
 *
 * Two things it is careful about, both learned from what it replaces:
 *
 *  1. **It owns its budget read.** Player Dues has no budget in hand, so the modal fetches the
 *     plan itself and computes the basis with the same shared helper the preview API uses. One
 *     source of truth beats two callers prop-drilling their own idea of the total.
 *  2. **A re-run never destroys money.** The old "Set dues for all players" deleted every
 *     installment for a player — paid ones, with their accounting entries, included. Since
 *     mig 232 the receipts live in their own table: replacing rewrites every player's PLAN,
 *     recorded payments are kept and re-applied to it, and anything paid beyond a player's new
 *     total becomes an overpayment credit — all said out loud in the success state.
 */
export default function GenerateInstallmentsModal({
  orgSlug, teamId, budgetHref, duesHref, tabActive = true, onClose, onGenerated,
}: {
  orgSlug: string;
  teamId: string;
  /** '' or '?year=…' — the season the caller is showing. */
  /** Where "Build your budget" goes when there is nothing to divide up yet. */
  budgetHref: string;
  /** Success-state link to the dues list. Omit when the caller IS the dues list. */
  duesHref?: string;
  /** ⚠ Is the caller's tab the one on screen? The Money hub keeps a visited panel MOUNTED
   *  (display:none) when the coach switches tabs, and this modal goes with it — so without
   *  this flag a half-typed schedule on a background tab keeps a document-level click
   *  interceptor armed and prompts "Unsaved changes" on every link in the app. That is a
   *  defect this repo has already paid for once (the Money hub tab-bar review). The panel
   *  that renders this modal MUST pass its own `tabActive`; the default is for standalone
   *  routes, where the panel is the whole page and therefore always on screen. */
  tabActive?: boolean;
  onClose: () => void;
  onGenerated: () => void | Promise<void>;
}) {
  const [loading,        setLoading]        = useState(true);
  const [plan,           setPlan]           = useState<RepBudgetPlan | null>(null);
  const [seasonTotal,    setSeasonTotal]    = useState<number | null>(null);
  const [loadError,      setLoadError]      = useState('');

  const [installments,   setInstallments]   = useState<InstallmentRow[]>([{ ...DEFAULT_INSTALLMENT }]);
  const [preview,        setPreview]        = useState<RepInstallmentPreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError,   setPreviewError]   = useState('');
  const [generating,     setGenerating]     = useState(false);
  const [generateError,  setGenerateError]  = useState('');
  /** The sandbox's own answer — an invitation, not a failure. See `handleGenerate`. */
  const [sandboxNote,    setSandboxNote]    = useState('');
  const [result,         setResult]         = useState<GenerateResult | null>(null);
  /** Set when the server reports a schedule already exists — the coach is asked to confirm a
   *  replace instead of being handed the raw refusal. Carries WHAT is at stake, including the
   *  names of any hand-set schedules, so the question can be answered rather than guessed at.
   *  See `handleGenerate`. */
  const [replaceFacts, setReplaceFacts] = useState<ReplaceFacts | null>(null);

  // Only the LATEST preview request may write to state. Editing a row clears the preview, but a
  // slow response from before the edit would otherwise land afterwards and restore a table that
  // no longer matches the form — with Confirm re-enabled under it.
  const previewToken = useRef(0);
  // Belt to `generating`'s braces: a second click can land before React has committed the
  // disabled attribute, and the write path is delete-then-insert — two of them interleaved is
  // exactly the collision the server can no longer silently swallow.
  const generatingRef = useRef(false);

  useOverlayOpen(true);

  const dirty = !result && installments.some(i => i.date || i.amount);
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'installment schedule' });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res  = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`);
        const data = await res.json().catch(() => null);
        if (!live) return;
        if (!res.ok || !data) throw new Error(data?.error ?? 'Failed to load your budget');
        setPlan(data.plan ?? null);
        setSeasonTotal(data.seasonBudgetAmount ?? null);
      } catch (e: unknown) {
        if (live) setLoadError(e instanceof Error ? e.message : 'Failed to load your budget');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [orgSlug, teamId]);

  const totals = useMemo(() => computeBudgetTotals({
    lines: (plan?.lines ?? []).map(l => ({ totalAmount: l.totalAmount, lineKind: l.lineKind })),
    estimatedTotal: seasonTotal,
    rosterCount: plan?.rosterCount ?? 0,
  }), [plan, seasonTotal]);

  const rosterCount = plan?.rosterCount ?? 0;
  /** Already-generated (or hand-set) schedules exist — this run replaces rather than creates. */
  const replacing = !!plan?.hasInstallments;

  const bases = useMemo(() => describeInstallmentBases(totals), [totals]);

  /**
   * ⚠ NO `useEffect` HERE, DELIBERATELY. Defaulting the basis in an effect would re-run whenever
   * the budget re-read and quietly move the coach off a choice they had made. `null` means
   * "hasn't chosen", and the default is computed from the same data every render.
   */
  const [pickedBasis, setPickedBasis] = useState<InstallmentBasis | null>(null);
  const basis: InstallmentBasis =
    pickedBasis
    ?? (!bases.budget.unavailable ? 'budget' : !bases.estimate.unavailable ? 'estimate' : 'manual');

  /**
   * ⚠ ONE REMAINING HARD BLOCKER, down from four (owner ruling 2026-08-13).
   *
   * "No budget", "funding covers the season" and "a $0 estimate" all used to end this sheet. Each
   * says only that there is no number to DIVIDE — which stops a split, not a coach typing $400.
   * They now travel as reasons on the split cards while manual stays live. An empty roster is
   * different in kind: there is nobody to charge, so there is nothing to write in any mode.
   */
  const blocker: { title: string; body: string } | null =
    loading || loadError ? null
    : rosterCount === 0
      ? { title: 'Add players to the roster first',
          body: 'Dues are split across your active roster, so there has to be one before a schedule can be built.' }
      : null;

  /**
   * In a split mode the amounts are a CONSEQUENCE, not an input: the basis divided by the roster
   * and then by however many dates are on screen. Adding a date re-cuts every row, which is the
   * "split between players and periods" the owner asked for.
   */
  const splitAmounts = useMemo(() => {
    if (basis === 'manual') return null;
    const option = bases[basis];
    if (option.unavailable || option.perPlayer == null) return null;
    return splitPerPlayer(option.perPlayer, installments.length);
  }, [basis, bases, installments.length]);

  /** What each row is worth ON THE FORM — for the boxes and the running comparison only. The
   *  amounts that get WRITTEN come back from the preview the coach approved; see `handleGenerate`. */
  const rowAmounts = installments.map((inst, i) =>
    splitAmounts ? splitAmounts[i] : parseFloat(inst.amount));

  /** ⚠ A row without a date is INCOMPLETE, not ignorable. It used to be silently dropped, which
   *  was survivable while the server re-derived everything — but the split divides by the number
   *  of rows, so a dropped row would show a three-way split and create a two-way one. */
  const missingDate   = installments.some(i => !i.date);
  const missingAmount = basis === 'manual' && rowAmounts.some(a => !(a > 0));
  const basisUnusable = basis !== 'manual' && splitAmounts == null;
  /** The form is complete enough to WRITE. `loadPreview` re-checks the three flags separately so
   *  it can name the one that is missing; this is the belt on the confirm path. */
  const canGenerate   = !missingDate && !missingAmount && !basisUnusable;

  /** What this schedule collects, and how it compares to what players have to fund. Never a
   *  barrier — a deposit-only schedule is a legitimate thing to build on purpose. */
  const perPlayerScheduled = rowAmounts.reduce((s, a) => s + (Number.isFinite(a) ? a : 0), 0);
  const teamScheduled      = Math.round(perPlayerScheduled * rosterCount * 100) / 100;
  const yardstick          = totals.fundedByPlayers;
  const gap                = Math.round((yardstick - teamScheduled) * 100) / 100;
  /** Silent when there is no budget to measure against — see the manual-with-no-budget case. */
  const reconcile: 'short' | 'over' | 'match' | null =
    yardstick <= 0 || perPlayerScheduled <= 0 ? null
    : Math.abs(gap) < 0.005 ? 'match'
    : gap > 0 ? 'short' : 'over';

  /**
   * The comparison line, drawn on the form and again on the confirm step.
   *
   * ONE function, because it is one sentence. Written out twice it had already drifted apart in
   * wording within a single change — and the reason it appears twice is precisely that a coach
   * must not lose sight of a shortfall between typing it and committing it, which only works if
   * both copies say the same thing. `compact` drops the reassurances and the all-clear: the
   * confirm step is not where a coach needs to be told everything is fine.
   */
  function reconcileLine(compact: boolean) {
    if (!reconcile || (compact && reconcile === 'match')) return null;
    const tone = reconcile === 'short' ? styles.reconShort
      : reconcile === 'over' ? styles.reconOver
      : styles.reconMatch;
    return (
      <p className={`${styles.reconStrip} ${tone}`}>
        <span aria-hidden className={styles.reconMark}>{reconcile === 'match' ? '✓' : '!'}</span>
        <span>
          Collecting <strong>{fmt(perPlayerScheduled)}</strong> per player —{' '}
          <strong>{fmt(teamScheduled)}</strong> across the roster.
          {reconcile === 'match'
            ? <> <strong>Matches what players need to fund.</strong></>
            : reconcile === 'short'
              ? <> That&apos;s <strong>{fmt(gap)} short</strong> of what players need to fund.</>
              : <> That&apos;s <strong>{fmt(gap)} more</strong> than players need to fund.</>}
          {!compact && reconcile === 'short' && (
            <span className={styles.reconAside}>
              You can still generate this. Add more installments later if you need to.
            </span>
          )}
          {!compact && reconcile === 'over' && (
            <span className={styles.reconAside}>Families will be billed the higher amount.</span>
          )}
        </span>
      </p>
    );
  }

  /** Drop the preview AND retire any preview request still in flight. Both halves matter:
   *  clearing the table without advancing the token lets a slow response restore it. */
  function invalidatePreview() {
    previewToken.current += 1;
    setPreview(null);
    /**
     * ⚠ AND CLEAR THE SPINNER, or the Preview button never comes back.
     *
     * `loadPreview`'s `finally` only lowers the flag when its own token is still current — correct
     * for the data, wrong for the button. Edit anything while a preview is in flight and the
     * response lands superseded, the `finally` skips, and `previewLoading` stays true forever with
     * `disabled={previewLoading}` on the only way forward; the sole escape is closing the sheet
     * through the discard prompt and starting again. Invalidating means no request in flight is
     * relevant any more, so the flag drops here. (A fresh `loadPreview` raises it again on entry.)
     */
    setPreviewLoading(false);
  }

  async function loadPreview() {
    if (missingDate)   { setPreviewError('Every installment needs a due date.'); return; }
    if (missingAmount) { setPreviewError('Every installment needs an amount greater than zero.'); return; }
    if (basisUnusable) { setPreviewError('Pick a different way to set the amounts.'); return; }
    const token = ++previewToken.current;
    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);

    const qs = new URLSearchParams({ installmentCount: String(installments.length), basis });
    installments.forEach(i => qs.append('dates[]', i.date));
    // Only manual sends amounts — a split is the server's own arithmetic, run from the same shared
    // helper this form filled its boxes with, so the two cannot drift.
    if (basis === 'manual') rowAmounts.forEach(a => qs.append('amounts[]', String(a)));

    try {
      const res  = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/installment-preview?${qs}`);
      const data = await res.json().catch(() => null);
      // Superseded — the coach edited a row (or re-previewed) while this was in flight. Writing
      // now would put a table back on screen that the form no longer matches, and re-enable
      // Confirm underneath it.
      if (token !== previewToken.current) return;
      if (!res.ok || !data) throw new Error(data?.error ?? 'Preview failed');
      setPreview(data.preview);
    } catch (e: unknown) {
      if (token !== previewToken.current) return;
      setPreviewError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      if (token === previewToken.current) setPreviewLoading(false);
    }
  }

  /**
   * `replace` is the coach's INTENT, never the client's guess about what the database holds.
   *
   * It used to be `plan.hasInstallments`, and that was wrong twice over: that flag counts only
   * BUDGET-GENERATED installments, so a roster with any hand-set schedule reported "nothing
   * here", sent replace:false, and hit a 409 quoting a "replace" option no screen offered — a
   * permanent dead end reached by the commonest path in the product, since per-player dues and
   * bulk dues live on the same screen. The same dead end appeared if anyone generated dues in
   * another tab while this modal sat open, because the flag was read once at mount.
   *
   * So the server is now the authority: it refuses with a code, and that refusal becomes a
   * question the coach can answer, in place, without losing what they typed.
   */
  async function handleGenerate(replace = false, skipPlayerIds: string[] = []) {
    /**
     * ⚠ THE PREVIEW IS THE PAYLOAD. Every player gets the same schedule, so the first previewed
     * row IS the schedule, and it is sent back verbatim.
     *
     * This is the whole point of the change and it has to be true by DATA FLOW, not by good
     * intentions. Rebuilding the amounts here from local state would leave two computations of
     * the same figure — the server's, which the coach read and approved, and the client's, run
     * against a budget snapshot taken once at mount. Those agree right up until the budget or the
     * roster moves in another tab, at which point the table says one thing and the write does
     * another. That is the identical defect this sheet was rebuilt to close, relocated one layer
     * down rather than removed.
     */
    const confirmed = preview?.[0]?.installments ?? [];
    if (confirmed.length === 0 || !canGenerate) return;
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setGenerateError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/generate-installments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replace,
          // Empty on a first attempt and on "apply to everyone" — only the coach's explicit
          // "keep the ones I set by hand" fills it.
          skipPlayerIds,
          // Which of the three answers produced these amounts. The write path does not recompute
          // from it — it records it, so "why is this player being charged $340?" has an answer.
          basis,
          installments: confirmed.map(inst => ({
            installmentNumber: inst.installmentNumber,
            dueDate:           inst.dueDate,
            amount:            inst.amount,
          })),
        }),
      });
      const data = await res.json().catch(() => null);

      /**
       * ⚠ THE SANDBOX SAYING NO IS THE DEMO WORKING, NOT BREAKING.
       *
       * Both demo orgs refuse every write at the request layer, so a prospect who builds a schedule
       * here and presses Confirm always lands on a 403. Without this branch they read the literal
       * string "SandboxReadOnly" — an internal code name, on a marketing surface, at the exact
       * moment they have decided they want the feature. The guard already ships the sentence that
       * belongs there ("Nothing is saved here. To keep your changes, start your own team — it's
       * free."); this shows it, in its own voice rather than in red.
       *
       * The header is the contract, checked the same way the two admin screens check it — the body
       * flag is belt to its braces.
       */
      if (res.headers.get('X-Sandbox-Blocked') === '1' || (res.status === 403 && data?.sandbox)) {
        setSandboxNote(data?.message ?? 'Nothing is saved here. To keep your changes, start your own team — it\'s free.');
        return;
      }

      // The roster already has dues. Ask rather than refuse — the coach keeps their form and
      // answers one question, now with the facts attached. Only THEIR yes sends replace.
      if (res.status === 409 && data?.code === 'ALREADY_HAS_DUES') {
        setReplaceFacts({
          handSetPlayers:        Array.isArray(data.handSetPlayers) ? data.handSetPlayers : [],
          playersWithDateChange: data.playersWithDateChange ?? 0,
        });
        return;
      }
      if (!res.ok || !data) throw new Error(data?.error ?? 'Generation failed');
      setResult({
        playersProcessed:          data.playersProcessed ?? 0,
        playersWithPaymentsKept:   data.playersWithPaymentsKept ?? 0,
        overpaymentCreditsCreated: data.overpaymentCreditsCreated ?? 0,
        playersFailed:             Array.isArray(data.playersFailed) ? data.playersFailed : [],
        playersSkipped:            data.playersSkipped ?? 0,
      });
      await onGenerated();
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  return (
    <div className={shared.modalOverlay} onClick={close}>
      {/* The discard guard covers dismissing this modal; this covers walking away from it. It
          rides WITH the modal rather than sitting in each caller — that is the point of one door. */}
      <UnsavedChangesGuard
        active={dirty}
        interceptClicks={dirty && tabActive}
        message="You haven't saved what you entered on this form. Leave without saving it?"
      />
      <div className={`${shared.modal} ${shared.modalFlushFooter}`} style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <CoachModalHeader
          /* Stable title. Whether this run replaces anything is the SERVER's answer, not a guess
             from the plan flag — and when it is a replace, that step carries its own heading. */
          title="Generate Player Installments"
          onClose={close}
        />

        {loading ? (
          <p className={styles.muted}>Loading your budget…</p>
        ) : loadError ? (
          <p className={styles.errorText}>{loadError}</p>
        ) : result ? (
          <div className={styles.successState}>
            <p>✓ Dues set for {result.playersProcessed} {result.playersProcessed === 1 ? 'player' : 'players'}.</p>
            {/* The kept arrangements, confirmed back. A coach who chose to protect three families
                needs to be told it happened — "dues set for 12 players" on a 15-player roster
                otherwise reads as three failures. */}
            {result.playersSkipped > 0 && (
              <p className={styles.muted} style={{ marginTop: '0.5rem' }}>
                {result.playersSkipped === 1
                  ? 'One player kept the schedule you set by hand — nothing of theirs changed.'
                  : `${result.playersSkipped} players kept the schedules you set by hand — nothing of theirs changed.`}
              </p>
            )}
            {/* Money kept across a replace must be said out loud (mig 232) — a coach who just
                rewrote the season's dues needs to hear that the dollars already collected came
                along, and where any excess went. */}
            {result.playersWithPaymentsKept > 0 && (
              <p className={styles.muted} style={{ marginTop: '0.5rem' }}>
                {result.playersWithPaymentsKept} {result.playersWithPaymentsKept === 1 ? 'player' : 'players'} had
                payments recorded — every payment was kept and now counts toward the new schedule.
                {result.overpaymentCreditsCreated > 0.005 && (
                  <> Payments beyond a player&apos;s new total ({fmt(result.overpaymentCreditsCreated)} across the
                  roster) were saved as overpayment credits.</>
                )}
              </p>
            )}
            {/* ⚠ NAMED, and drawn as an error rather than a footnote. These players have no
                working schedule right now; a count alone would leave the coach auditing a whole
                roster to find out who. */}
            {result.playersFailed.length > 0 && (
              <p className={styles.errorText} style={{ marginTop: '0.6rem' }}>
                {result.playersFailed.length === 1
                  ? 'One player could not be saved and has no dues schedule right now: '
                  : `${result.playersFailed.length} players could not be saved and have no dues schedule right now: `}
                <strong>{result.playersFailed.join(', ')}</strong>. Set {result.playersFailed.length === 1 ? 'theirs' : 'theirs'} from
                the player’s own row, or run this again.
              </p>
            )}
            {duesHref
              ? <Link href={duesHref} className={shared.btnPrimary} style={{ marginTop: '1rem' }}>View Player Dues →</Link>
              : <button type="button" className={shared.btnPrimary} style={{ marginTop: '1rem' }} onClick={onClose}>Done</button>}
          </div>
        ) : replaceFacts ? (
          /* The server said dues already exist. This is the coach's decision, asked once, with
             their form still intact behind it — Back returns to it unchanged.

             ⚠ THE COPY USED TO BE REASSURING AND INCOMPLETE. "Recorded payments are kept" is
             true and stayed, but it was the ONLY consequence named — so the screen read as
             "nothing of value is at risk" while the run was about to flatten every per-player
             arrangement on the roster: a hardship plan, a deposit-then-balance schedule, a
             mid-season joiner's prorated dates. Money was never the thing at risk here.
             Now the screen names what is, by name, and offers to keep it. */
          <div className={styles.successState}>
            <p style={{ fontWeight: 700 }}>This roster already has dues</p>
            <p className={styles.muted} style={{ marginTop: '0.4rem' }}>
              Generating now <strong>replaces</strong> the existing schedule with the one you just previewed.
              Recorded payments are kept — money already collected counts toward the new schedule, and anything
              beyond a player&apos;s new total becomes an overpayment credit.
            </p>
            {/* Due dates families may already have been told. Stated whenever they move, because
                the reminder emails will start quoting the new ones without further ceremony. */}
            {replaceFacts.playersWithDateChange > 0 && (
              <p className={styles.muted} style={{ marginTop: '0.5rem' }}>
                <strong>Due dates change</strong> for {replaceFacts.playersWithDateChange === 1
                  ? 'one player'
                  : `${replaceFacts.playersWithDateChange} players`}. Reminder emails will quote the new dates.
              </p>
            )}
            {replaceFacts.handSetPlayers.length > 0 && (
              <div className={styles.replaceHandSet}>
                <p style={{ fontWeight: 700, margin: 0 }}>
                  {replaceFacts.handSetPlayers.length === 1
                    ? 'One player has a schedule you set by hand'
                    : `${replaceFacts.handSetPlayers.length} players have a schedule you set by hand`}
                </p>
                <p style={{ margin: '0.3rem 0 0' }}>
                  {replaceFacts.handSetPlayers.map(p => p.name).join(', ')}
                </p>
                <p className={styles.muted} style={{ margin: '0.35rem 0 0' }}>
                  Applying to everyone gives them the same schedule as the rest of the roster.
                </p>
              </div>
            )}
            {sandboxNote && <p className={styles.sandboxNote}>{sandboxNote}</p>}
            {generateError && <p className={styles.errorText} style={{ marginTop: '0.6rem' }}>{generateError}</p>}
            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={() => { setReplaceFacts(null); setGenerateError(''); }}>
                Back
              </button>
              {/* ⚠ KEEPING THE HAND-SET SCHEDULES IS THE PRIMARY, and "everyone" the quieter
                  button. The destructive answer is still one click away for the coach who means
                  it — it is simply no longer the only one, and no longer the default. */}
              {replaceFacts.handSetPlayers.length > 0 ? (
                <>
                  <button
                    type="button"
                    className={shared.btnSecondary}
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                  >
                    {generating ? 'Working…' : 'Apply to everyone'}
                  </button>
                  <button
                    type="button"
                    className={shared.btnPrimary}
                    onClick={() => handleGenerate(true, replaceFacts.handSetPlayers.map(p => p.id))}
                    disabled={generating}
                  >
                    {generating
                      ? 'Working…'
                      : `Keep the ${replaceFacts.handSetPlayers.length} I set by hand`}
                  </button>
                </>
              ) : (
                <button type="button" className={shared.btnPrimary} onClick={() => handleGenerate(true)} disabled={generating}>
                  {generating ? 'Replacing…' : 'Replace the dues schedule'}
                </button>
              )}
            </div>
          </div>
        ) : blocker ? (
          <div className={styles.successState}>
            <p style={{ fontWeight: 700 }}>{blocker.title}</p>
            <p className={styles.muted} style={{ marginTop: '0.4rem' }}>{blocker.body}</p>
          </div>
        ) : (
          <>
            {/* ⚠ TRIMMED (owner call 3, 2026-08-13). This paragraph used to carry the whole
                funded-by-players sum — which the basis cards below now print on the card that
                actually uses it. Three stacked paragraphs before the first field meant a phone
                reached the picker with one card visible; it now reaches it with two. */}
            <p className={styles.genInstructions}>
              Every active roster player receives the same schedule.
            </p>
            {/* Over-planned: dues follow the estimate (owner ruling), so the shortfall is
                stated HERE too — this is the moment it turns into real money owed. */}
            {totals.overPlanned && (
              <p className={styles.errorText} style={{ fontSize: '0.82rem', margin: '0 0 0.9rem' }}>
                Your line items are {fmt(Math.abs(totals.difference))} above your {fmt(totals.estimatedTotal ?? 0)} estimate
                — dues follow the estimate.
              </p>
            )}
            {/* Said before the coach types, not after — "this replaces what's there" is the kind
                of thing that has to arrive while it can still change their mind. ADVISORY ONLY:
                this flag counts budget-generated dues, so it stays quiet for a roster whose dues
                were set by hand. Those coaches still get the question, just at the confirm step,
                from the server — which is why nothing about the write path reads this. */}
            {replacing && (
              <p className={styles.muted} style={{ fontSize: '0.82rem', margin: '0 0 0.9rem' }}>
                This roster already has dues. Generating replaces the schedule; payments already
                recorded are kept and count toward the new one.
              </p>
            )}

            {/* ── How the amounts are set (owner ruling 2026-08-13) ─────────────────────────
                Each card shows what it works out to BEFORE it is chosen, so all three answers
                are comparable without committing to one. A basis with no number to offer is
                never drawn as "$0.00" — it carries the reason and cannot be selected. */}
            <fieldset className={styles.basisSection}>
              <legend className={styles.label}>How amounts are set</legend>

              {(['budget', 'estimate'] as const).map(key => {
                const option = bases[key];
                const disabled = !!option.unavailable;
                return (
                  <label
                    key={key}
                    className={`${styles.basisCard} ${basis === key ? styles.basisCardOn : ''} ${disabled ? styles.basisCardOff : ''}`}
                  >
                    <input
                      type="radio"
                      name="installment-basis"
                      className={styles.basisRadio}
                      checked={basis === key}
                      disabled={disabled}
                      onChange={() => { setPickedBasis(key); invalidatePreview(); }}
                    />
                    <span className={styles.basisName}>{BASIS_LABEL[key]}</span>
                    <span className={styles.basisValue}>
                      {option.unavailable
                        ? <span className={styles.basisValueMuted}>{option.amount == null ? 'Not set' : 'Nothing owing'}</span>
                        : <>{fmt(option.perPlayer ?? 0)}<small>per player</small></>}
                    </span>
                    <span className={`${styles.basisMath} ${disabled ? styles.basisMathStop : ''}`}>
                      {option.unavailable ?? (
                        key === 'budget'
                          ? `${fmt(totals.itemized)} line items${totals.expectedFunding > 0 ? ` − ${fmt(totals.expectedFunding)} expected fundraising` : ''} ÷ ${rosterCount} players`
                          : `${fmt(totals.estimatedTotal ?? 0)} estimate${totals.expectedFunding > 0 ? ` − ${fmt(totals.expectedFunding)} expected fundraising` : ''} ÷ ${rosterCount} players`
                      )}
                    </span>
                  </label>
                );
              })}

              <label className={`${styles.basisCard} ${basis === 'manual' ? styles.basisCardOn : ''}`}>
                <input
                  type="radio"
                  name="installment-basis"
                  className={styles.basisRadio}
                  checked={basis === 'manual'}
                  onChange={() => { setPickedBasis('manual'); invalidatePreview(); }}
                />
                <span className={styles.basisName}>Set the amounts myself</span>
                <span className={styles.basisValue}><span className={styles.basisValueMuted}>You decide</span></span>
                <span className={styles.basisMath}>
                  {yardstick > 0
                    ? `Type each installment. We'll show how it compares to the ${fmt(yardstick)} players need to fund.`
                    : 'Type each installment. Nothing to compare against until you have a budget.'}
                </span>
              </label>
            </fieldset>

            {/* ⚠ The budget nudge SURVIVES as a link rather than a wall (owner call 1). A coach
                reaching this sheet from Player Dues with no budget is no longer turned away —
                but the offer that used to block them is still the first thing under the picker. */}
            {bases.budget.unavailable && bases.estimate.unavailable && (
              <Link href={budgetHref} className={styles.basisNudge}>
                Build a Season Budget Plan first →
              </Link>
            )}

            <div className={styles.genInstallmentsSection}>
              <div className={styles.genInstallmentsHeader}>
                <span className={styles.label}>Installments</span>
                <button
                  type="button"
                  className={styles.addPeriodBtn}
                  onClick={() => { setInstallments(p => [...p, { ...DEFAULT_INSTALLMENT }]); invalidatePreview(); }}
                >
                  + Add
                </button>
              </div>
              {installments.map((inst, i) => (
                <div key={i} className={styles.periodInputRow}>
                  <div className={styles.periodGroupHead}>
                    <span className={styles.periodGroupNum}>Installment {i + 1}</span>
                    {installments.length > 1 && (
                      <button
                        type="button"
                        className={styles.periodGroupRemove}
                        onClick={() => { setInstallments(p => p.filter((_, j) => j !== i)); invalidatePreview(); }}
                      >
                        Remove <X size={12} aria-hidden />
                      </button>
                    )}
                  </div>
                  <span className={styles.installmentNum}>#{i + 1}</span>
                  <label className={`${styles.periodFieldLabel} ${styles.periodFieldDate}`}>
                    <span className={styles.periodFieldLabelText}>Due date</span>
                    <DateField
                      value={inst.date}
                      min={tournamentToday()}
                      ariaLabel={`Due date for installment ${i + 1}`}
                      onChange={v => { setInstallments(p => { const n=[...p]; n[i]={...n[i],date:v}; return n; }); invalidatePreview(); }}
                    />
                  </label>
                  <label className={styles.periodFieldLabel}>
                    <span className={styles.periodFieldLabelText}>Amount per player ($)</span>
                    {/* In a split mode this is an OUTPUT. Drawn as one — dashed, muted, badged
                        "Auto" — rather than as a live box that silently ignores typing, which is
                        precisely the lie this whole change exists to end. */}
                    {splitAmounts ? (
                      <output className={styles.amountAuto}>
                        {fmt(splitAmounts[i] ?? 0)}
                        <span className={styles.autoChip}>Auto</span>
                      </output>
                    ) : (
                      <input
                        className={styles.input}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Amount per player ($)"
                        value={inst.amount}
                        onChange={e => { setInstallments(p => { const n=[...p]; n[i]={...n[i],amount:e.target.value}; return n; }); invalidatePreview(); }}
                      />
                    )}
                  </label>
                  {installments.length > 1 && (
                    <button
                      type="button"
                      className={styles.removePeriodBtn}
                      aria-label={`Remove installment ${i + 1}`}
                      onClick={() => { setInstallments(p => p.filter((_, j) => j !== i)); invalidatePreview(); }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ── What this collects, against what players have to fund ────────────────────
                A SENTENCE, NEVER A BARRIER (owner ruling 2026-08-13). Over-collecting takes the
                sharper colour: it is the one that charges families money they do not owe. An
                exact match is stated rather than left silent, so a coach who did the arithmetic
                themselves sees it confirmed. */}
            {reconcileLine(false)}

            {previewError && <p className={styles.errorText}>{previewError}</p>}

            {!preview ? (
              <div className={shared.modalFooter}>
                <button type="button" className={shared.btnGhost} onClick={close}>Cancel</button>
                <button type="button" className={shared.btnSecondary} onClick={loadPreview} disabled={previewLoading}>
                  {previewLoading ? 'Loading preview…' : 'Preview'}
                </button>
              </div>
            ) : (
              <>
                {/* The comparison travels WITH the coach to the step where they commit. It used
                    to be left behind on the form, so the last thing read before charging ten
                    families said nothing about a shortfall. */}
                {reconcileLine(true)}

                <div className={styles.previewSection}>
                  <div className={styles.label} style={{ marginBottom: '0.6rem' }}>Preview — {preview.length} players</div>
                  {/* Player × installment is a genuine 2-D grid with fixed money columns, so four
                      installments overflow a phone sheet. It scrolls with the player name pinned
                      rather than crushing the amounts.

                      ⚠ `--cols` counts the installments PLUS the total. It used to go unset,
                      leaving the 3-column default, so a one-installment schedule drew two phantom
                      money columns. */}
                  <CoachScrollX sticky frame={false} hint="Swipe to see every installment">
                    <div
                      className={styles.previewTable}
                      style={{ '--cols': (preview[0]?.installments.length ?? 1) + 1 } as CSSProperties}
                    >
                      <div className={styles.previewHeader}>
                        <span className={shared.scrollXStickyCell}>Player</span>
                        {/* The due date alone. `#1 / #2` was dropped (owner, 2026-08-13): the date
                            already says which payment this is, and the number cost a column's
                            worth of width on a phone to repeat what the row order shows. */}
                        {preview[0]?.installments.map((inst, i) => (
                          <span key={i} className={shared.thNum}>{inst.dueDate ? formatDayMonth(inst.dueDate) : `#${i + 1}`}</span>
                        ))}
                        <span className={shared.thNum}>Total</span>
                      </div>
                      {preview.slice(0, 10).map(row => (
                        <div key={row.playerId} className={styles.previewRow}>
                          <span className={shared.scrollXStickyCell}>{[row.playerLastName, row.playerFirstName].filter(Boolean).join(', ')}</span>
                          {row.installments.map((inst, i) => (
                            <span key={i} className={shared.tdNum}>{fmt(inst.amount)}</span>
                          ))}
                          <span className={`${shared.tdNum} ${styles.previewTotalCell}`}>
                            {fmt(row.installments.reduce((s, inst) => s + inst.amount, 0))}
                          </span>
                        </div>
                      ))}
                      {preview.length > 10 && (
                        <div className={styles.previewMore}>+{preview.length - 10} more players</div>
                      )}
                      {/* What the team is actually asking families for, in total — the number a
                          coach is really approving, and it was nowhere on this screen. */}
                      <div className={`${styles.previewRow} ${styles.previewFootRow}`}>
                        <span className={shared.scrollXStickyCell}>Team total</span>
                        {(preview[0]?.installments ?? []).map((_, i) => (
                          <span key={i} className={shared.tdNum}>
                            {fmt(preview.reduce((s, row) => s + (row.installments[i]?.amount ?? 0), 0))}
                          </span>
                        ))}
                        <span className={`${shared.tdNum} ${styles.previewTotalCell}`}>
                          {fmt(preview.reduce((s, row) => s + row.installments.reduce((t, inst) => t + inst.amount, 0), 0))}
                        </span>
                      </div>
                    </div>
                  </CoachScrollX>
                </div>

                {sandboxNote && <p className={styles.sandboxNote}>{sandboxNote}</p>}
                {generateError && <p className={styles.errorText}>{generateError}</p>}

                <div className={shared.modalFooter}>
                  <button type="button" className={shared.btnGhost} onClick={() => invalidatePreview()}>Back</button>
                  {/* Never sends replace. If dues already exist the server says so and the coach
                      is asked — see `replaceFacts`. An onClick of `handleGenerate` alone would
                      pass React's event object as the `replace` argument, which is truthy. */}
                  <button type="button" className={shared.btnPrimary} onClick={() => handleGenerate(false)} disabled={generating}>
                    {generating
                      ? 'Generating…'
                      : `Confirm & Generate for ${preview.length} Players`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
