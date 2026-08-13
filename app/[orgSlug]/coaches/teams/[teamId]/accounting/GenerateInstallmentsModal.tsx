'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { computeBudgetTotals } from '@/lib/coach-budget-totals';
import { tournamentToday } from '@/lib/timezone';
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

interface InstallmentRow { date: string; amount: string }
const DEFAULT_INSTALLMENT: InstallmentRow = { date: '', amount: '' };

interface GenerateResult {
  playersProcessed: number;
  playersSkipped: number;
  /** Players whose dues could NOT be written. Named, because the coach has to go fix them by
   *  hand and a bare count would leave them checking the whole roster. */
  playersFailed: string[];
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
 *     installment for a player — paid ones, with their accounting entries, included. Replacing
 *     here SKIPS any player who has paid something and says so afterwards.
 */
export default function GenerateInstallmentsModal({
  orgSlug, teamId, seasonQuery, budgetHref, duesHref, tabActive = true, onClose, onGenerated,
}: {
  orgSlug: string;
  teamId: string;
  /** '' or '?year=…' — the season the caller is showing. */
  seasonQuery: string;
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
  const [result,         setResult]         = useState<GenerateResult | null>(null);
  /** Set when the server reports a schedule already exists — the coach is asked to confirm a
   *  replace instead of being handed the raw refusal. See `handleGenerate`. */
  const [confirmReplace, setConfirmReplace] = useState(false);

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
        const res  = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan${seasonQuery}`);
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
  }, [orgSlug, teamId, seasonQuery]);

  const totals = useMemo(() => computeBudgetTotals({
    lines: (plan?.lines ?? []).map(l => ({ totalAmount: l.totalAmount, lineKind: l.lineKind })),
    estimatedTotal: seasonTotal,
    rosterCount: plan?.rosterCount ?? 0,
  }), [plan, seasonTotal]);

  const rosterCount = plan?.rosterCount ?? 0;
  /** Already-generated (or hand-set) schedules exist — this run replaces rather than creates. */
  const replacing = !!plan?.hasInstallments;

  /** Why there is nothing to divide up — the reason has to name the RIGHT one, or a coach told
   *  "your funding covers the budget" goes looking for a fundraiser that doesn't exist. Mirrors
   *  the preview API's own three cases so the modal never contradicts the server. */
  const blocker: { title: string; body: string; cta: boolean } | null =
    loading || loadError ? null
    : rosterCount === 0
      ? { title: 'Add players to the roster first',
          body: 'Dues are split across your active roster, so there has to be one before a schedule can be built.',
          cta: false }
    : totals.fundedByPlayers > 0 ? null
    : totals.expectedFunding > 0 && totals.expectedFunding >= totals.totalPlanned
      ? { title: 'Your funding already covers the season',
          body: 'Expected funding matches or exceeds the whole budget, so there is nothing left for players to fund. Lower it, or add more cost lines, to charge dues.',
          cta: true }
    : totals.estimatedTotal != null && totals.totalPlanned <= 0
      ? { title: 'Your season estimate is $0',
          body: 'There is nothing for players to fund. Raise the estimate, or clear it to use your line items instead.',
          cta: true }
      : { title: 'Start with your Season Budget Plan',
          body: 'Dues come from the budget: add what the season costs and this can build every player’s installment schedule in one step — same dates and amounts for the whole roster.',
          cta: true };

  const validRows = installments.filter(i => i.date && parseFloat(i.amount) > 0);

  /** Drop the preview AND retire any preview request still in flight. Both halves matter:
   *  clearing the table without advancing the token lets a slow response restore it. */
  function invalidatePreview() {
    previewToken.current += 1;
    setPreview(null);
  }

  async function loadPreview() {
    if (validRows.length === 0) { setPreviewError('Add at least one installment with a date and amount'); return; }
    const token = ++previewToken.current;
    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);

    const qs = new URLSearchParams({ installmentCount: String(validRows.length) });
    validRows.forEach(i => qs.append('dates[]', i.date));

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
  async function handleGenerate(replace = false) {
    if (!preview || validRows.length === 0) return;
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
          installments: validRows.map((inst, i) => ({
            installmentNumber: i + 1,
            dueDate:           inst.date,
            amount:            parseFloat(inst.amount),
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      // The roster already has dues. Ask rather than refuse — the coach keeps their form and
      // answers one question. Only THEIR yes sends replace.
      if (res.status === 409 && data?.code === 'ALREADY_HAS_DUES') { setConfirmReplace(true); return; }
      if (!res.ok || !data) throw new Error(data?.error ?? 'Generation failed');
      setResult({
        playersProcessed: data.playersProcessed ?? 0,
        playersSkipped:   data.playersSkipped ?? 0,
        playersFailed:    Array.isArray(data.playersFailed) ? data.playersFailed : [],
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
            {/* The skip is the whole point of the safe replace — it must be said out loud, or a
                coach believes a player they already collected from is on the new schedule. */}
            {result.playersSkipped > 0 && (
              <p className={styles.muted} style={{ marginTop: '0.5rem' }}>
                {result.playersSkipped} {result.playersSkipped === 1 ? 'player has' : 'players have'} already paid
                something, so their existing schedule was left as it is.
                Adjust {result.playersSkipped === 1 ? 'it' : 'those'} from the player’s own row.
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
        ) : confirmReplace ? (
          /* The server said dues already exist. This is the coach's decision, asked once, with
             their form still intact behind it — Back returns to it unchanged. */
          <div className={styles.successState}>
            <p style={{ fontWeight: 700 }}>This roster already has dues</p>
            <p className={styles.muted} style={{ marginTop: '0.4rem' }}>
              Generating now <strong>replaces</strong> the existing schedule with the one you just previewed.
              Anyone who has already paid something is left exactly as they are, so no recorded payment is lost.
            </p>
            {generateError && <p className={styles.errorText} style={{ marginTop: '0.6rem' }}>{generateError}</p>}
            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={() => { setConfirmReplace(false); setGenerateError(''); }}>
                Back
              </button>
              <button type="button" className={shared.btnPrimary} onClick={() => handleGenerate(true)} disabled={generating}>
                {generating ? 'Replacing…' : 'Replace the dues schedule'}
              </button>
            </div>
          </div>
        ) : blocker ? (
          <div className={styles.successState}>
            <p style={{ fontWeight: 700 }}>{blocker.title}</p>
            <p className={styles.muted} style={{ marginTop: '0.4rem' }}>{blocker.body}</p>
            {blocker.cta && (
              <Link href={budgetHref} className={shared.btnPrimary} style={{ marginTop: '1rem' }}>
                Open Budget Plan →
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className={styles.genInstructions}>
              Set due dates and amounts for each installment. Every active roster player will receive the same schedule.
              {/* The basis is what players FUND, not what the season costs — the whole point of
                  budgeting expected funding is that dues come down by it. */}
              {totals.fundingLineCount > 0 ? (
                <>
                  {' '}Funded by players: <strong>{fmt(totals.fundedByPlayers)}</strong>{' '}
                  ({fmt(totals.totalPlanned)} less {fmt(totals.expectedFunding)} expected funding)
                  {' '}÷ {rosterCount} players = <strong>{totals.perPlayer != null ? fmt(totals.perPlayer) : '—'}</strong> each.
                </>
              ) : (
                <>
                  {' '}Total budget: <strong>{fmt(totals.totalPlanned)}</strong> ÷ {rosterCount} players.
                </>
              )}
            </p>
            {/* Over-planned: dues follow the estimate (owner ruling), so the shortfall is
                stated HERE too — this is the moment it turns into real money owed. */}
            {totals.overPlanned && (
              <p className={styles.errorText} style={{ fontSize: '0.82rem', margin: '0 0 0.9rem' }}>
                Your line items are {fmt(Math.abs(totals.difference))} above your {fmt(totals.estimatedTotal ?? 0)} estimate.
                Dues generated now are based on the estimate, so they won&apos;t cover everything you&apos;ve planned.
              </p>
            )}
            {/* Said before the coach types, not after — "this replaces what's there" is the kind
                of thing that has to arrive while it can still change their mind. ADVISORY ONLY:
                this flag counts budget-generated dues, so it stays quiet for a roster whose dues
                were set by hand. Those coaches still get the question, just at the confirm step,
                from the server — which is why nothing about the write path reads this. */}
            {replacing && (
              <p className={styles.muted} style={{ fontSize: '0.82rem', margin: '0 0 0.9rem' }}>
                This roster already has a dues schedule. Generating replaces it — except for players
                who have already paid something, who are left exactly as they are.
              </p>
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
                    <input
                      className={styles.input}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Amount per player ($)"
                      value={inst.amount}
                      onChange={e => { setInstallments(p => { const n=[...p]; n[i]={...n[i],amount:e.target.value}; return n; }); invalidatePreview(); }}
                    />
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
                <div className={styles.previewSection}>
                  <div className={styles.label} style={{ marginBottom: '0.6rem' }}>Preview — {preview.length} players</div>
                  {/* Player × installment is a genuine 2-D grid with fixed 90px money
                      columns, so four installments overflow a phone sheet. It scrolls
                      with the player name pinned rather than crushing the amounts. */}
                  <CoachScrollX sticky frame={false} hint="Swipe to see every installment">
                    <div className={styles.previewTable}>
                      <div className={styles.previewHeader}>
                        <span className={shared.scrollXStickyCell}>Player</span>
                        {preview[0]?.installments.map((_, i) => (
                          <span key={i} style={{ textAlign: 'right' }}>#{i + 1}</span>
                        ))}
                      </div>
                      {preview.slice(0, 10).map(row => (
                        <div key={row.playerId} className={styles.previewRow}>
                          <span className={shared.scrollXStickyCell}>{[row.playerLastName, row.playerFirstName].filter(Boolean).join(', ')}</span>
                          {row.installments.map((inst, i) => (
                            <span key={i} style={{ textAlign: 'right' }}>{fmt(inst.amount)}</span>
                          ))}
                        </div>
                      ))}
                      {preview.length > 10 && (
                        <div className={styles.previewMore}>+{preview.length - 10} more players</div>
                      )}
                    </div>
                  </CoachScrollX>
                </div>

                {generateError && <p className={styles.errorText}>{generateError}</p>}

                <div className={shared.modalFooter}>
                  <button type="button" className={shared.btnGhost} onClick={() => invalidatePreview()}>Back</button>
                  {/* Never sends replace. If dues already exist the server says so and the coach
                      is asked — see `confirmReplace`. An onClick of `handleGenerate` alone would
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
