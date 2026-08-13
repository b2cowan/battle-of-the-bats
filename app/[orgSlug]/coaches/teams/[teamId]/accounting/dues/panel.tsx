'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, X, CheckCircle2, AlertTriangle, ChevronRight, Plus, Trash2, ChevronDown, Bell, ArrowLeft, DollarSign } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import HelpTooltip from '@/components/help/HelpTooltip';
import { DUES_EXPORT_COLUMNS, duesExportRows, duesPdfRows } from '@/lib/coach-money-exports';
import { isNeverPaidPlayer, duesStatusLabel } from '@/lib/dues-status';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import GenerateInstallmentsModal from '../GenerateInstallmentsModal';
import styles from '../../../../coaches.module.css';
import { tournamentToday } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import { fmt } from '@/lib/coach-money-summary';
import type {
  RepRosterPlayer,
  RepPlayerDuesSchedule,
  RepPlayerDuesInstallment,
  DuesCredit,
  DuesCreditType,
  SeasonRefundRow,
} from '@/lib/types';

interface PlayerWithDues {
  player: RepRosterPlayer;
  schedule: RepPlayerDuesSchedule | null;
  installments: RepPlayerDuesInstallment[];
  paidAmount: number;
  outstanding: number;
  credits: DuesCredit[];
  totalCredits: number;
  rollingBalance: number;
}

interface SeasonSurplusData {
  surplus: { id: string; totalSurplus: number; notes: string | null } | null;
  breakdown: SeasonRefundRow[];
  totalAllCredits: number;
  evenPool: number;
  playerCount: number;
}

/* (`fmt` is the shared one — this file's local copy was byte-for-byte the same behaviour. The other
   Money panels' local `fmt`s are NOT duplicates: several deliberately strip the sign because their
   callers print their own, so they stay where they are.) */

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** ⚠ A SETTLED BALANCE IS QUIET, NOT GREEN (Money-hub table pass 2026-08-13, approved render
 *  `14181bd3`). Zero used to be drawn in the same success green as a credit, so a roster where
 *  everyone had paid was a full column of green — the loudest thing on the screen saying nothing.
 *  Colour in this table now means "there is something here": green a credit, amber an amount still
 *  owed, muted a nil. The two that matter keep the colour they always had. */
function balanceColor(b: number): string {
  if (b < -0.005) return 'var(--success-light)'; // in credit (good)
  if (b > 0.005)  return 'var(--warning)'; // still owes
  return 'var(--home-dim, rgba(255,255,255,0.35))'; // fully clear — nothing to flag
}

/** The colour each dues status is drawn in. The WORD comes from the shared list so this table
 *  and the Money hub's "Player dues" export can never call the same player two different
 *  things; colour is presentation and stays here, where the table is. */
const DUES_STATUS_COLOR: Record<ReturnType<typeof duesStatusLabel>, string> = {
  'Not set':    'var(--home-dim, rgba(255,255,255,0.3))',
  'In credit':  'var(--success-light)',
  'Fully paid': 'var(--success-light)',
  Partial:      'var(--warning)',
  Unpaid:       'var(--home-dim, rgba(255,255,255,0.4))',
};

function statusLabel(p: PlayerWithDues) {
  const label = duesStatusLabel(p);
  return { label, color: DUES_STATUS_COLOR[label] };
}

const CREDIT_TYPE_LABELS: Record<DuesCreditType, string> = {
  contribution: 'Contribution',
  fundraiser:   'Fundraiser',
  overpayment:  'Overpayment',
  other:        'Other',
};

interface InstallmentRow {
  installmentNumber: number;
  amount: string;
  dueDate: string;
}

const BLANK_SCHEDULE_FORM = { totalAmount: '', notes: '' };

const BLANK_CREDIT_FORM = {
  amount:     '',
  description:'',
  creditType: 'contribution' as DuesCreditType,
  creditDate: tournamentToday(),
  notes:      '',
};

// ⚠ The columns and the row mapping are NOT declared here. They live in `lib/coach-money-exports`
// alongside the Money hub's own "Player dues" export, so this screen's file and the hub's file
// cannot drift into two different spreadsheets from one product. This panel only supplies the
// players it already holds.

export function PlayerDuesPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
  /** Is this panel the tab currently on screen? The hub passes it to every panel; this one
   *  needs it because the bulk-dues generator it opens guards against unsaved work, and a
   *  guard left armed on a background tab hijacks clicks app-wide. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [players, setPlayers] = useState<PlayerWithDues[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<PlayerWithDues | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [form, setForm] = useState(BLANK_SCHEDULE_FORM);
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([
    { installmentNumber: 1, amount: '', dueDate: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  // Credits
  const [addingCredit, setAddingCredit] = useState(false);
  const [creditForm, setCreditForm] = useState(BLANK_CREDIT_FORM);
  const [creditSaving, setCreditSaving] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [deletingCreditId, setDeletingCreditId] = useState<string | null>(null);

  // Set dues for all players. It opens the SAME generator the Budget Plan tab uses (owner ruling
  // 2026-08-13) — this screen used to carry a second, cruder bulk form of its own: type a total,
  // type installments, no preview of what any player would actually owe, and a save path that
  // deleted paid installments along with the rest. One door, and the safe one.
  const [applyAllOpen, setApplyAllOpen] = useState(false);

  // Reminders (proximity — installments due soon)
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ emailsSent: number; installmentsTagged: number } | null>(null);
  const [reminderError, setReminderError] = useState('');

  // "Haven't paid anything yet" nudges (never-paid players)
  const [remindingAll, setRemindingAll] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [unpaidResult, setUnpaidResult] = useState<{ emailsSent: number; playersReminded: number; playersMissingEmail: number } | null>(null);
  const [unpaidError, setUnpaidError] = useState('');

  // Season refund
  const [refundOpen, setRefundOpen] = useState(false);
  const [surplusData, setSurplusData] = useState<SeasonSurplusData | null>(null);
  const [surplusLoading, setSurplusLoading] = useState(false);
  const [surplusInput, setSurplusInput] = useState('');
  const [surplusNotes, setSurplusNotes] = useState('');
  const [surplusSaving, setSurplusSaving] = useState(false);
  const [surplusError, setSurplusError] = useState('');

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  useOverlayOpen(!!selected);
  // The bulk-dues generator registers its own overlay — a second one here would double-count.

  // PDF branding and its plan gate both live in MoneyExportButton now — one place for every
  // Money tab, and the branding is fetched on the first PDF export rather than on every mount.

  // Automatic Dues Reminders toggle (moved here from the Money hub — it belongs with dues).
  const [autoReminders, setAutoReminders] = useState<boolean | null>(null);
  const [autoRemindersSaving, setAutoRemindersSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues${seasonQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setPlayers(data.players ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load player dues.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings${seasonQuery}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAutoReminders(d.autoRemindersEnabled ?? true); })
      .catch(() => {});
  }, [orgSlug, teamId, seasonQuery]);

  async function toggleAutoReminders(enabled: boolean) {
    setAutoRemindersSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRemindersEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setAutoReminders(enabled);
    } finally {
      setAutoRemindersSaving(false);
    }
  }

  // ── Export helpers ───────────────────────────────────────────────────────────

  // Rows and columns both come from the SHARED contract: this screen supplies the players it
  // already holds in state, and the Money hub's own "Player dues" export supplies the ones it
  // fetches. One mapping, so the two cannot become two different spreadsheets.
  /**
   * Built at click time from the players already on screen — no refetch, and no chance of
   * exporting a roster the coach is no longer looking at. Columns and row mapping come from the
   * shared contract so this file and any other view of dues cannot disagree about a player.
   */
  function buildExport() {
    return {
      dataset: 'player-dues',
      title: 'Player Dues',
      columns: DUES_EXPORT_COLUMNS,
      rows: duesExportRows(players),
      pdfRows: duesPdfRows,
      scopeLabel: assignment?.programYearName ?? '',
      teamName: assignment?.teamName ?? '',
      emptyMessage: 'There are no player dues to export yet.',
    };
  }

  // Keep selected player data fresh after reload
  useEffect(() => {
    if (!selected) return;
    const updated = players.find(p => p.player.id === selected.player.id);
    if (updated) setSelected(updated);
  }, [players]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSurplus() {
    setSurplusLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus${seasonQuery}`);
      const data = await res.json();
      setSurplusData(data);
      setSurplusInput(data.surplus ? String(data.surplus.totalSurplus) : '');
      setSurplusNotes(data.surplus?.notes ?? '');
    } finally {
      setSurplusLoading(false);
    }
  }

  function openEdit(p: PlayerWithDues) {
    setSelected(p);
    setForm({
      totalAmount: p.schedule ? String(p.schedule.totalAmount) : '',
      notes: p.schedule?.notes ?? '',
    });
    setInstallmentRows(
      p.installments.length
        ? p.installments.map(i => ({
            installmentNumber: i.installmentNumber,
            amount: String(i.amount),
            dueDate: i.dueDate,
          }))
        : [{ installmentNumber: 1, amount: '', dueDate: '' }],
    );
    setEditingSchedule(true);
    setSaveError('');
  }

  async function saveSchedule(playerId: string) {
    setSaveError('');
    setSaving(true);
    try {
      const totalAmount = parseFloat(form.totalAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) throw new Error('Enter a valid total amount');
      const installments = installmentRows.map((r, idx) => ({
        installmentNumber: r.installmentNumber ?? idx + 1,
        amount: parseFloat(r.amount),
        dueDate: r.dueDate,
      }));
      if (installments.some(i => isNaN(i.amount) || !i.dueDate)) {
        throw new Error('All installments need a valid amount and due date');
      }
      const instSum = installments.reduce((s, i) => s + i.amount, 0);
      if (Math.abs(instSum - totalAmount) > 0.01) {
        throw new Error(`Installments sum (${fmt(instSum)}) must equal total (${fmt(totalAmount)})`);
      }
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, totalAmount, notes: form.notes || null, installments }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setEditingSchedule(false);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(p: PlayerWithDues, inst: RepPlayerDuesInstallment) {
    if (!p.schedule) return;
    setMarking(prev => ({ ...prev, [inst.id]: true }));
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/dues/${p.schedule.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setMarking(prev => ({ ...prev, [inst.id]: false }));
    }
  }

  async function saveCredit() {
    if (!selected) return;
    setCreditError('');
    setCreditSaving(true);
    try {
      const amount = parseFloat(creditForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid credit amount');
      if (!creditForm.description.trim()) throw new Error('Description is required');
      if (!creditForm.creditDate) throw new Error('Date is required');
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-credits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            description: creditForm.description.trim(),
            creditType:  creditForm.creditType,
            creditDate:  creditForm.creditDate,
            notes:       creditForm.notes.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save credit');
      setAddingCredit(false);
      setCreditForm(BLANK_CREDIT_FORM);
      await load();
    } catch (e: unknown) {
      setCreditError(e instanceof Error ? e.message : 'Failed to save credit');
    } finally {
      setCreditSaving(false);
    }
  }

  async function deleteCredit(creditId: string) {
    if (!selected) return;
    setDeletingCreditId(creditId);
    try {
      await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-credits/${creditId}`,
        { method: 'DELETE' },
      );
      await load();
    } finally {
      setDeletingCreditId(null);
    }
  }

  async function saveSurplus() {
    setSurplusError('');
    setSurplusSaving(true);
    try {
      const totalSurplus = parseFloat(surplusInput);
      if (isNaN(totalSurplus) || totalSurplus < 0) throw new Error('Enter a valid surplus amount (0 or more)');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalSurplus, notes: surplusNotes.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      const data = await res.json();
      setSurplusData(data);
    } catch (e: unknown) {
      setSurplusError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSurplusSaving(false);
    }
  }

  async function sendReminders() {
    setSendingReminders(true);
    setReminderError('');
    setReminderResult(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues/send-reminders`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send reminders');
      setReminderResult({ emailsSent: data.emailsSent, installmentsTagged: data.installmentsTagged });
    } catch (e: unknown) {
      setReminderError(e instanceof Error ? e.message : 'Failed to send reminders.');
    } finally {
      setSendingReminders(false);
    }
  }

  async function remindUnpaid(playerId?: string) {
    if (playerId) setRemindingId(playerId); else setRemindingAll(true);
    setUnpaidError('');
    setUnpaidResult(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues/remind-unpaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerId ? { playerId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send reminder');
      setUnpaidResult(data);
    } catch (e: unknown) {
      setUnpaidError(e instanceof Error ? e.message : 'Failed to send reminder.');
    } finally {
      setRemindingId(null);
      setRemindingAll(false);
    }
  }

  function addInstallmentRow(rows: InstallmentRow[], setRows: (r: InstallmentRow[]) => void) {
    setRows([...rows, { installmentNumber: rows.length + 1, amount: '', dueDate: '' }]);
  }

  function removeInstallmentRow(idx: number, rows: InstallmentRow[], setRows: (r: InstallmentRow[]) => void) {
    setRows(rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, installmentNumber: i + 1 })));
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Reminders (both proximity + never-paid) require money = write. Read-only money coaches
  // see the list but no send buttons.
  const moneyCanWrite = page.canWrite(page.capabilities?.money === 'write');
  // Never-paid = same predicate as the Overview "N unpaid" badge, so the two always agree.
  const neverPaid = players.filter(isNeverPaidPlayer);

  // ── Season totals rail (Option C, owner-ratified 2026-08-02) ──────────────────────────────
  // Every figure is summed from `players`, which this page already has — the rail exists because
  // on a fifteen-player table these numbers are off-screen exactly while you read the rows they
  // summarise, not because anything new needed computing. Overdue reuses the SHARED installment
  // predicate, so the rail can't disagree with the ⚠ flags on the rows beneath it.
  const railTotals = (() => {
    let collected = 0;
    let outstanding = 0;
    let overduePlayers = 0;
    let nextDue: string | null = null;
    for (const p of players) {
      collected += p.paidAmount;
      if (p.rollingBalance > 0.005) outstanding += p.rollingBalance;
      let hasOverdue = false;
      for (const inst of p.installments) {
        if (inst.paidAt) continue;
        if (isInstallmentOverdue(inst.dueDate, inst.paidAt)) { hasOverdue = true; continue; }
        // "Next due" is the soonest date still AHEAD — an overdue date is not a plan, it's a debt,
        // and it is already reported on its own line.
        if (inst.dueDate && (!nextDue || inst.dueDate < nextDue)) nextDue = inst.dueDate;
      }
      if (hasOverdue) overduePlayers += 1;
    }
    return { collected, outstanding, overduePlayers, nextDue };
  })();
  /** Is anyone ACTUALLY late? Distinct from "hasn't paid" — see the chase card below. */
  const anyoneLate = railTotals.overduePlayers > 0;

  // Page-level action ruling 2026-08-13, decision 2 — "PLAYER DUES RESOLVES ITSELF": its two
  // bulk actions act on the DUES LIST, not on Money, so they come down into the list's own
  // toolbar with everything else. That is what stopped this hub's header from running four
  // buttons wide. The reminder status lines stay stacked under the buttons — they are feedback
  // about this action group, so they travel with it.
  // ⚠ EXPORT IS NOT A HEADER ACTION ANY MORE, on either surface. It sits in the list's own
  // toolbar below, beside the bulk actions — the same place it sits on every other Money tab
  // (owner ruling 2026-08-13). Dues is the one dataset whose export has no view state to honour,
  // which is exactly why it must NOT be the exception: a coach should not have to learn where
  // Export lives per screen.
  const duesExport = (
    <MoneyExportButton
      label="Player dues"
      formats={['xlsx', 'csv', 'pdf']}
      build={buildExport}
      disabled={players.length === 0}
    />
  );
  // ⚠ THE ROW RENDERS FOR A READ-ONLY MONEY ASSISTANT TOO — only its write buttons are gated.
  // Reading is not writing: an assistant who can see every dues figure can take them away in a
  // spreadsheet, and gating Export behind write access would have been a quiet permission change
  // smuggled in by a layout move.
  const duesToolbar = (
    <div className={styles.panelToolbar}>
      <div className={styles.panelToolbarActions}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {duesExport}
            {moneyCanWrite && (
            <>
            <button className={styles.btnSecondary} onClick={() => setApplyAllOpen(true)}>
              <DollarSign size={14} aria-hidden /> Set dues for all players
            </button>
            <button
              className={styles.btnSecondary}
              onClick={sendReminders}
              disabled={sendingReminders}
              style={{ opacity: sendingReminders ? 0.6 : 1 }}
              /* Tracks the visible ternary — a static label would tell AT "Send due
                 reminders" while sighted users watch "Sending…" (/review finding). */
              aria-label={sendingReminders ? 'Sending reminders' : 'Send due reminders'}
            >
              <Bell size={14} aria-hidden /> {sendingReminders ? 'Sending…' : 'Send Due Reminders'}
            </button>
            </>
            )}
          </div>
          {reminderResult && reminderResult.emailsSent > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--success-light)' }}>
              Sent {reminderResult.emailsSent} reminder email{reminderResult.emailsSent !== 1 ? 's' : ''} covering {reminderResult.installmentsTagged} installment{reminderResult.installmentsTagged !== 1 ? 's' : ''}.
            </span>
          )}
          {reminderResult && reminderResult.emailsSent === 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>
              No reminders needed — no installments due within 3 days.
            </span>
          )}
          {reminderError && <span style={{ fontSize: '0.8rem', color: 'var(--danger-light)' }}>{reminderError}</span>}
        </div>
      </div>
    </div>
  );



  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Header (page-header ruling 2026-08-11: one shape, actions right, phone secondaries
          icon-only, "?" in its fixed corner). The reminder status lines stay stacked under the
          buttons — they're feedback about the action group, so they travel with it. */}
      {!embedded && (
        <CoachBackLink href={`${base}/accounting${seasonQuery}`}>Back to Money</CoachBackLink>
      )}
      <CoachPageHeader
        embedded={embedded}
        icon={Users}
        title="Player Dues"
        season={page.season}
        teamBase={page.teamBase}
        helpLabel="Player Dues"
        help={{ module: 'coaches', sectionIds: ['premium-money'], fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !players.length ? (
        <div className={styles.emptyState}>No active roster players found.</div>
      ) : (
        <>
          {/* The budget cross-link banner that used to sit here is GONE (owner, 2026-08-13). It
              pushed the coach out to a page to do a thing this screen can now do in place —
              "Set dues for all players" opens the generator itself, and carries the
              start-with-a-budget nudge as its own empty state, at the moment it's wanted. */}

          {/* Who to chase — ONE LINE plus the bulk action (owner ruling 2026-08-03).
              It used to list every never-paid player with a per-player Remind. On a team early in
              its season that WAS the table: eleven names here, the same eleven a screen below with
              "Unpaid" beside them. The table is the list; this is only the summary and the one
              thing the table can't do — nudge everyone at once. Per-player Remind moved into the
              player's own modal, beside Mark Paid, where the coach is already looking at them.

              ⚠ AND IT ONLY RAISES AN ALARM WHEN SOMEONE IS ACTUALLY LATE. It fired on "nothing
              paid yet" regardless of whether anything was DUE yet, so a roster four weeks ahead of
              its first due date opened under a warning triangle and eleven flagged names. A status
              surface that cries wolf gets ignored. Before the due date this is a quiet line. */}
          {neverPaid.length > 0 && (
            <div style={{
              marginBottom: '1.5rem', borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${anyoneLate ? 'color-mix(in srgb, var(--warning) 25%, transparent)' : 'var(--home-line, rgba(255,255,255,0.08))'}`,
              background: anyoneLate ? 'color-mix(in srgb, var(--warning) 6%, transparent)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.85rem 1.1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--home-ink, #f0f0f0)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {anyoneLate && <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />}
                    {anyoneLate
                      ? `${railTotals.overduePlayers} past their due date`
                      : `${neverPaid.length} ${neverPaid.length !== 1 ? 'players have' : 'player has'} not paid yet`}
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                    {anyoneLate
                      ? `${neverPaid.length} ${neverPaid.length !== 1 ? 'players owe' : 'player owes'} dues with no payment recorded.`
                      : railTotals.nextDue
                        ? `Nothing is late — the first payment is due ${fmtDate(railTotals.nextDue)}.`
                        : 'Nothing is late.'}
                  </p>
                </div>
                {moneyCanWrite && (
                  <button
                    className={styles.btnPrimary}
                    onClick={() => remindUnpaid()}
                    disabled={remindingAll || !!remindingId}
                    style={{ opacity: (remindingAll || remindingId) ? 0.6 : 1, whiteSpace: 'nowrap' }}
                  >
                    {remindingAll ? 'Sending…' : `Remind all ${neverPaid.length}`}
                  </button>
                )}
              </div>

              {(unpaidResult || unpaidError) && (
                <div style={{ padding: '0.55rem 1.1rem', borderTop: '1px solid var(--home-line, rgba(255,255,255,0.06))', fontSize: '0.8rem' }}>
                  {unpaidError && <span style={{ color: 'var(--danger-light)' }}>{unpaidError}</span>}
                  {unpaidResult && (
                    <span style={{ color: unpaidResult.emailsSent > 0 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                      {unpaidResult.emailsSent > 0
                        ? `Sent ${unpaidResult.emailsSent} reminder${unpaidResult.emailsSent !== 1 ? 's' : ''} covering ${unpaidResult.playersReminded} player${unpaidResult.playersReminded !== 1 ? 's' : ''}.`
                        : 'No reminders sent.'}
                      {unpaidResult.playersMissingEmail > 0 &&
                        ` ${unpaidResult.playersMissingEmail} ${unpaidResult.playersMissingEmail !== 1 ? 'players have' : 'player has'} no guardian email on file.`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* The dues list's own toolbar — the bulk actions sit with the list they act on. */}
          {duesToolbar}

          <div className={styles.railCols}>
          <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Player</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Total Dues</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Credits</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Paid</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Balance</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const { label, color } = statusLabel(p);
                  return (
                    <tr
                      key={p.player.id}
                      className={styles.tr}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelected(p); setEditingSchedule(false); setAddingCredit(false); setSaveError(''); }}
                    >
                      <td className={styles.td} data-label="Player">
                        {[p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' ')}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Total Dues">
                        {p.schedule ? fmt(p.schedule.totalAmount) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits" style={{ color: p.totalCredits > 0 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                        {p.totalCredits > 0 ? `-${fmt(p.totalCredits)}` : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Paid" style={{ color: p.paidAmount > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.35))' }}>
                        {p.schedule ? fmt(p.paidAmount) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Balance" style={{ color: balanceColor(p.rollingBalance), fontWeight: 600 }}>
                        {p.schedule ? fmt(p.rollingBalance) : '—'}
                      </td>
                      <td className={styles.td} data-label="Status">
                        <span style={{ color, fontSize: '0.82rem', fontWeight: 500 }}>{label}</span>
                      </td>
                      <td className={styles.td}>
                        <ChevronRight size={14} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Season totals — the numbers the table is made of, kept beside the rows instead of
              scrolling away above them. Read-only by design: "Remind all" stays with the list it
              acts on, because a send button beside a total invites nudging people you haven't
              looked at. Moves below the table on a phone (no rail there). */}
          <aside className={styles.rail}>
            <div className={styles.railGroup}>
              <span className={styles.railLabel}>Season totals</span>
              <div className={styles.railRow}>
                <span className={styles.railRowName}>Collected</span>
                <span className={`${styles.railValue} ${styles.railValueBig}`}>{fmt(railTotals.collected)}</span>
              </div>
              <div className={styles.railRow}>
                <span className={styles.railRowName}>Outstanding</span>
                <span className={`${styles.railValue} ${styles.railValueBig}`} data-warn={railTotals.outstanding > 0.005 ? 'true' : undefined}>
                  {fmt(railTotals.outstanding)}
                </span>
              </div>
              {railTotals.nextDue && (
                <div className={styles.railRow}>
                  <span className={styles.railRowName}>Next due</span>
                  <span className={styles.railValue}>{fmtDate(railTotals.nextDue)}</span>
                </div>
              )}
            </div>

            {/* Overdue ONLY. "Paid nothing yet" was here and was removed (owner, 2026-08-03): the
                "Haven't paid anything yet" card sits a few hundred pixels above this, and it is
                strictly better — it NAMES the families and carries the Remind-all button, where
                this could only repeat its count. Overdue stays because nothing else on the page
                totals it; it appears only as a ⚠ against individual installments.
                Absent entirely when nobody is overdue — a zero here would read as a score. */}
            {railTotals.overduePlayers > 0 && (
              <div className={styles.railGroup}>
                <span className={styles.railLabel}>Needs a nudge</span>
                <div className={styles.railRow}>
                  <span className={styles.railRowName}>Overdue</span>
                  <span className={styles.railValue} data-warn="true">{railTotals.overduePlayers}</span>
                </div>
              </div>
            )}
          </aside>
          </div>

          {/* Season Refund Calculator */}
          <div style={{
            marginTop: '2rem',
            borderRadius: 10,
            border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
            overflow: 'hidden',
          }}>
            <button
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '0.85rem 1.25rem', background: 'var(--home-card, rgba(255,255,255,0.03))',
                border: 'none', cursor: 'pointer', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))',
              }}
              onClick={() => {
                const next = !refundOpen;
                setRefundOpen(next);
                if (next && !surplusData) loadSurplus();
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Season Refund Calculator</span>
              {refundOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {refundOpen && (
              <div style={{ padding: '1.25rem', borderTop: '1px solid var(--home-line, rgba(255,255,255,0.06))' }}>
                <p style={{ fontSize: '0.83rem', color: 'var(--home-dim, rgba(255,255,255,0.5))', margin: '0 0 1rem' }}>
                  Enter the total remaining team funds at season end. Each player&apos;s individual credits come off the top, then the remainder is divided evenly.
                </p>

                {surplusLoading ? (
                  <p className={styles.muted}>Loading…</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <label className={styles.label}>Total Remaining Funds</label>
                        <input
                          className={styles.input}
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="e.g. 10500"
                          value={surplusInput}
                          onChange={e => setSurplusInput(e.target.value)}
                          style={{ width: '160px' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className={styles.label}>Notes</label>
                        <input
                          className={styles.input}
                          placeholder="e.g. End of 2025 season"
                          value={surplusNotes}
                          onChange={e => setSurplusNotes(e.target.value)}
                        />
                      </div>
                      <button
                        className={styles.btnPrimary}
                        disabled={surplusSaving}
                        onClick={saveSurplus}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {surplusSaving ? 'Saving…' : 'Calculate'}
                      </button>
                    </div>
                    {surplusError && <p className={styles.errorText}>{surplusError}</p>}

                    {surplusData && surplusData.surplus && surplusData.breakdown.length > 0 && (
                      <>
                        <div style={{
                          display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
                          padding: '0.75rem 1rem', borderRadius: 8,
                          background: 'color-mix(in srgb, var(--success-light) 5%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--success-light) 15%, transparent)',
                          marginBottom: '1rem', fontSize: '0.82rem',
                        }}>
                          <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                            Total: <strong style={{ color: 'var(--home-ink, #f0f0f0)' }}>{fmt(surplusData.surplus.totalSurplus)}</strong>
                          </span>
                          <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                            Individual credits: <strong style={{ color: 'var(--success-light)' }}>-{fmt(surplusData.totalAllCredits)}</strong>
                          </span>
                          <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                            Even pool: <strong style={{ color: 'var(--home-ink, #f0f0f0)' }}>{fmt(surplusData.evenPool)}</strong>
                          </span>
                          <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                            Per player (base): <strong style={{ color: 'var(--home-ink, #f0f0f0)' }}>
                              {fmt(surplusData.evenPool / (surplusData.playerCount || 1))}
                            </strong>
                          </span>
                        </div>

                        {/* ⚠ `tableAsCards` added 2026-08-13 (Money-hub table pass). This frame carried
                            `.tableWrap` alone, whose `overflow-x: auto` let a five-column refund
                            table scroll sideways on a phone with NOTHING saying it could — the
                            silent sideways scroll every other table in the hub already avoids.
                            One record per row makes it a list, so it stacks; it does not scroll. */}
                        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th className={styles.th}>Player</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Rolling Balance</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Credit Portion</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Even Share</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Total Refund</th>
                              </tr>
                            </thead>
                            <tbody>
                              {surplusData.breakdown.map(row => (
                                <tr key={row.playerId} className={styles.tr}>
                                  <td className={styles.td} data-label="Player">{[row.playerFirstName, row.playerLastName].filter(Boolean).join(' ')}</td>
                                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Rolling balance" style={{ color: balanceColor(row.rollingBalance) }}>
                                    {fmt(row.rollingBalance)}
                                  </td>
                                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Credit portion" style={{ color: row.creditPortion > 0 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                                    {row.creditPortion > 0 ? fmt(row.creditPortion) : '—'}
                                  </td>
                                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Even share">{fmt(row.evenShare)}</td>
                                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Total refund" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
                                    {fmt(row.totalRefund)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Automatic Dues Reminders — team-level toggle (moved from the Money hub). */}
          {autoReminders !== null && (
            <div className={styles.detailSection} style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Bell size={20} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: 'var(--home-ink, rgba(255,255,255,0.9))', margin: 0 }}>Automatic Dues Reminders</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>
                  {autoReminders
                    ? 'On — guardians receive email reminders at 30 days and 7 days before each installment due date.'
                    : 'Off — no automatic reminder emails will be sent for this team.'}
                </p>
              </div>
              {moneyCanWrite && (
                <button
                  className={autoReminders ? styles.btnPrimary : styles.btnGhost}
                  disabled={autoRemindersSaving}
                  onClick={() => toggleAutoReminders(!autoReminders)}
                  style={{ flexShrink: 0, fontSize: '0.8rem', padding: '0.35rem 0.9rem' }}
                >
                  {autoRemindersSaving ? '…' : autoReminders ? 'Enabled' : 'Disabled'}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Player slide-over */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => { setSelected(null); setEditingSchedule(false); setAddingCredit(false); }}>
          <div className={styles.slideOver} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <button className={styles.modalBackBtn} aria-label="Back" onClick={() => { setSelected(null); setEditingSchedule(false); setAddingCredit(false); }}>
                <ArrowLeft size={20} />
              </button>
              <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>
                {[selected.player.playerFirstName, selected.player.playerLastName].filter(Boolean).join(' ')}
              </span>
              <button className={styles.modalCloseBtn} onClick={() => { setSelected(null); setEditingSchedule(false); setAddingCredit(false); }}>
                <X size={18} />
              </button>
            </div>

            {!editingSchedule ? (
              <>
                {selected.schedule ? (
                  <>
                    {/* Rolling balance summary */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
                      padding: '0.85rem 1rem', marginBottom: '1rem',
                      background: 'var(--home-card, rgba(255,255,255,0.03))', borderRadius: 8,
                      border: '1px solid var(--home-line, rgba(255,255,255,0.06))',
                    }}>
                      {[
                        { label: 'Total Dues', value: fmt(selected.schedule.totalAmount), color: undefined },
                        { label: 'Credits', value: selected.totalCredits > 0 ? `-${fmt(selected.totalCredits)}` : '—', color: selected.totalCredits > 0 ? 'var(--success-light)' : undefined },
                        { label: 'Paid', value: fmt(selected.paidAmount), color: 'var(--success-light)' },
                        { label: 'Balance', value: fmt(selected.rollingBalance), color: balanceColor(selected.rollingBalance) },
                      ].map(stat => (
                        <div key={stat.label}>
                          <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--home-dim, rgba(255,255,255,0.35))', marginBottom: '0.15rem' }}>
                            {stat.label}
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: stat.color ?? 'var(--home-ink, rgba(255,255,255,0.85))', fontVariantNumeric: 'tabular-nums' }}>
                            {stat.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {selected.rollingBalance < -0.005 && (
                      <div style={{
                        padding: '0.6rem 0.85rem', marginBottom: '1rem', borderRadius: 7,
                        background: 'color-mix(in srgb, var(--success-light) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success-light) 20%, transparent)',
                        fontSize: '0.82rem', color: 'var(--success-light)',
                      }}>
                        This player is in credit — their balance is {fmt(Math.abs(selected.rollingBalance))} in their favour.
                      </div>
                    )}

                    {/* Per-player actions. "Remind" lives HERE now (owner ruling 2026-08-03) rather
                        than on a duplicated chase list above the table — this is where the coach is
                        already looking at that one family, and it keeps the page from naming the
                        same players twice. Offered only when there is something to chase. */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {moneyCanWrite && isNeverPaidPlayer(selected) && (
                        <button
                          className={styles.btnSecondary}
                          onClick={() => remindUnpaid(selected.player.id)}
                          disabled={remindingAll || !!remindingId}
                          style={{ fontSize: '0.78rem', opacity: (remindingAll || remindingId) ? 0.6 : 1 }}
                        >
                          {remindingId === selected.player.id ? 'Sending…' : 'Remind'}
                        </button>
                      )}
                      <button className={styles.btnGhost} onClick={() => openEdit(selected)} style={{ fontSize: '0.78rem' }}>
                        Edit schedule
                      </button>
                    </div>
                    {/* The reminder's own result, beside the button that sent it. */}
                    {(unpaidError || unpaidResult) && remindingId === null && (
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', textAlign: 'right', color: unpaidError ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                        {unpaidError || (unpaidResult && unpaidResult.emailsSent > 0
                          ? 'Reminder sent.'
                          : unpaidResult?.playersMissingEmail
                            ? 'No guardian email on file for this player.'
                            : '')}
                      </p>
                    )}

                    {/* Installments.
                        ⚠ `tableAsCards` added 2026-08-13 (Money-hub table pass) — see the refund
                        preview above: this frame also carried `.tableWrap` alone and scrolled
                        sideways on a phone in silence. One instalment per row is a list. */}
                    {selected.installments.length > 0 && (
                      <div className={`${styles.tableWrap} ${styles.tableAsCards}`} style={{ marginBottom: '1.25rem' }}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th className={styles.th}>#</th>
                              <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                              <th className={styles.th}>Due</th>
                              <th className={styles.th}>Status</th>
                              <th className={styles.th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.installments.map(inst => {
                              const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
                              return (
                                <tr key={inst.id} className={styles.tr}>
                                  <td className={styles.td} data-label="Instalment" style={{ color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>{inst.installmentNumber}</td>
                                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">{fmt(inst.amount)}</td>
                                  <td className={styles.td} data-label="Due" style={{ color: overdue ? 'var(--danger-light)' : 'var(--home-ink-soft, rgba(255,255,255,0.65))' }}>
                                    {fmtDate(inst.dueDate)}
                                    {overdue && <AlertTriangle size={11} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--danger-light)' }} />}
                                  </td>
                                  <td className={styles.td} data-label="Status">
                                    {inst.paidAt ? (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--success-light)' }}>
                                        <CheckCircle2 size={12} /> Paid {fmtDate(inst.paidAt)}
                                      </span>
                                    ) : (
                                      <span className={`${styles.badge} ${overdue ? styles.badgeCompleted : styles.badgeDraft}`} style={{ fontSize: '0.75rem' }}>
                                        {overdue ? 'Overdue' : 'Unpaid'}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`${styles.td} ${styles.cardActionCell}`}>
                                    {!inst.paidAt && (
                                      <button
                                        className={`${styles.btnSecondary} ${styles.compactAction}`}
                                        disabled={!!marking[inst.id]}
                                        onClick={() => markPaid(selected, inst)}
                                      >
                                        {marking[inst.id] ? '…' : 'Mark Paid'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Credits section */}
                    <div style={{
                      borderTop: '1px solid var(--home-line, rgba(255,255,255,0.07))',
                      paddingTop: '1rem',
                      marginTop: selected.installments.length > 0 ? 0 : '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>
                          Credits
                        </span>
                        {!addingCredit && (
                          <button
                            className={styles.btnGhost}
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={() => { setAddingCredit(true); setCreditForm(BLANK_CREDIT_FORM); setCreditError(''); }}
                          >
                            <Plus size={12} /> Add Credit
                          </button>
                        )}
                      </div>

                      {/* Add credit form */}
                      {addingCredit && (
                        <div style={{
                          padding: '0.85rem', marginBottom: '0.85rem',
                          background: 'var(--home-card, rgba(255,255,255,0.03))', borderRadius: 8,
                          border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
                        }}>
                          <p className={styles.formHint} style={{ marginBottom: '0.6rem' }}>
                            <span className={styles.labelRequired}>*</span> Required
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                            <div>
                              <label className={styles.label}>Amount <span className={styles.labelRequired}>*</span></label>
                              <input
                                className={styles.input}
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="e.g. 300"
                                value={creditForm.amount}
                                onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className={styles.label}>Date <span className={styles.labelRequired}>*</span></label>
                              <input
                                className={styles.input}
                                type="date"
                                value={creditForm.creditDate}
                                onChange={e => setCreditForm(f => ({ ...f, creditDate: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.6rem' }}>
                            <label className={styles.label}>Description <span className={styles.labelRequired}>*</span></label>
                            <input
                              className={styles.input}
                              placeholder="e.g. Player bat contribution"
                              value={creditForm.description}
                              onChange={e => setCreditForm(f => ({ ...f, description: e.target.value }))}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                            <div>
                              <label className={styles.label}>Type</label>
                              <select
                                className={styles.input}
                                value={creditForm.creditType}
                                onChange={e => setCreditForm(f => ({ ...f, creditType: e.target.value as DuesCreditType }))}
                              >
                                {(Object.entries(CREDIT_TYPE_LABELS) as [DuesCreditType, string][]).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={styles.label}>Notes</label>
                              <input
                                className={styles.input}
                                placeholder="Optional notes"
                                value={creditForm.notes}
                                onChange={e => setCreditForm(f => ({ ...f, notes: e.target.value }))}
                              />
                            </div>
                          </div>
                          {creditError && <p className={styles.errorText}>{creditError}</p>}
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className={styles.btnGhost} onClick={() => { setAddingCredit(false); setCreditError(''); }} style={{ fontSize: '0.8rem' }}>Cancel</button>
                            <button className={styles.btnPrimary} disabled={creditSaving} onClick={saveCredit} style={{ fontSize: '0.8rem' }}>
                              {creditSaving ? 'Saving…' : 'Save Credit'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Credits list */}
                      {selected.credits.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {selected.credits.map(c => (
                            <div key={c.id} style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.5rem 0.65rem', borderRadius: 7,
                              background: 'color-mix(in srgb, var(--success-light) 5%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--success-light) 12%, transparent)',
                              fontSize: '0.83rem',
                            }}>
                              <span style={{ color: 'var(--success-light)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                -{fmt(c.amount as number)}
                              </span>
                              <span style={{ flex: 1, color: 'var(--home-ink-soft, rgba(255,255,255,0.75))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.description}
                              </span>
                              <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', fontSize: '0.75rem', flexShrink: 0 }}>
                                {CREDIT_TYPE_LABELS[c.creditType]} · {fmtDate(c.creditDate as string)}
                              </span>
                              <button
                                style={{ background: 'none', border: 'none', color: 'var(--home-dim, rgba(255,255,255,0.3))', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                disabled={deletingCreditId === c.id}
                                onClick={() => deleteCredit(c.id)}
                                title="Remove credit"
                              >
                                {deletingCreditId === c.id ? '…' : <Trash2 size={13} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !addingCredit && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.3))', margin: 0 }}>
                            No credits applied to this player.
                          </p>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <p className={styles.muted} style={{ marginBottom: '1rem' }}>No dues schedule set for this player.</p>
                    <button className={styles.btnPrimary} onClick={() => openEdit(selected)}>
                      Set dues schedule
                    </button>
                  </div>
                )}
                {saveError && <p className={styles.errorText} style={{ marginTop: '0.5rem' }}>{saveError}</p>}
              </>
            ) : (
              <ScheduleForm
                form={form}
                setForm={setForm}
                installmentRows={installmentRows}
                setInstallmentRows={setInstallmentRows}
                saveError={saveError}
                saving={saving}
                onSave={() => saveSchedule(selected.player.id)}
                onCancel={() => { setEditingSchedule(false); setSaveError(''); }}
                addRow={() => addInstallmentRow(installmentRows, setInstallmentRows)}
                removeRow={(idx) => removeInstallmentRow(idx, installmentRows, setInstallmentRows)}
              />
            )}
          </div>
        </div>
      )}

      {/* Set dues for all players — the shared generator. `duesHref` is deliberately omitted:
          its success state links to the dues list, and this IS the dues list. */}
      {applyAllOpen && (
        <GenerateInstallmentsModal
          orgSlug={orgSlug}
          teamId={teamId}
          seasonQuery={seasonQuery}
          budgetHref={`${base}/accounting?section=budget`}
          tabActive={tabActive}
          onClose={() => setApplyAllOpen(false)}
          onGenerated={load}
        />
      )}
    </div>
  );
}

// ── Shared schedule form ──────────────────────────────────────────────────────

interface ScheduleFormProps {
  form: { totalAmount: string; notes: string };
  setForm: (f: { totalAmount: string; notes: string }) => void;
  installmentRows: { installmentNumber: number; amount: string; dueDate: string }[];
  setInstallmentRows: (r: { installmentNumber: number; amount: string; dueDate: string }[]) => void;
  saveError: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  addRow: () => void;
  removeRow: (idx: number) => void;
}

/** ONE player's dues schedule. The roster-wide version is not this form any more — it is the
 *  shared Generate Installments modal (see the toolbar button), which is why the configurable
 *  save label that used to live here is gone with its only caller. */
function ScheduleForm({
  form, setForm, installmentRows, setInstallmentRows,
  saveError, saving, onSave, onCancel, addRow, removeRow,
}: ScheduleFormProps) {
  return (
    <div>
      <div className={styles.formGrid} style={{ marginBottom: '1rem' }}>
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Total amount *</label>
          <input
            className={styles.input}
            type="number"
            min={0}
            step="0.01"
            value={form.totalAmount}
            onChange={e => setForm({ ...form, totalAmount: e.target.value })}
            placeholder="e.g. 1200"
          />
        </div>
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Notes</label>
          <input className={styles.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
        </div>
      </div>

      <p className={styles.label} style={{ marginBottom: '0.5rem' }}>
        Installments
        <HelpTooltip
          title="What is an installment?"
          body="An installment is one payment in a dues schedule. For example, a $500 annual due might be split into 5 monthly installments of $100 each."
        />
      </p>
      {installmentRows.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.4))', width: '1.5rem', textAlign: 'right', flexShrink: 0 }}>#{row.installmentNumber}</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            style={{ width: '7rem' }}
            value={row.amount}
            onChange={e => {
              const updated = installmentRows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r);
              setInstallmentRows(updated);
            }}
          />
          <input
            className={styles.input}
            type="date"
            style={{ flex: 1 }}
            value={row.dueDate}
            onChange={e => {
              const updated = installmentRows.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r);
              setInstallmentRows(updated);
            }}
          />
          {installmentRows.length > 1 && (
            <button className={styles.btnGhost} onClick={() => removeRow(idx)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}>×</button>
          )}
        </div>
      ))}
      <button className={styles.btnGhost} onClick={addRow} style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
        + Add installment
      </button>

      {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

      <div className={styles.modalFooter}>
        <button className={styles.btnGhost} onClick={onCancel}>Cancel</button>
        <button className={styles.btnPrimary} disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
    </div>
  );
}
