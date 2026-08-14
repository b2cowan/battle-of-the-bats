'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
import InstallmentBreakdown, { balanceColor } from './InstallmentBreakdown';
import { installmentToSend } from '@/lib/dues-installment-view';
import styles from '../../../../coaches.module.css';
import { tournamentToday, addCalendarDays } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import { duesReminderEmail } from '@/lib/dues-reminder-email';
import { fmt } from '@/lib/coach-money-summary';
import { moneySectionHref } from '@/lib/coach-money-links';
import { overpaymentExcess, type InstallmentCoverage } from '@/lib/dues-payments';
import { creditsTotal, normalizeCreditApplicationMode, CREDIT_APPLICATION_MODES, type CreditApplicationMode } from '@/lib/dues-credits';
import type {
  RepRosterPlayer,
  RepPlayerDuesSchedule,
  RepPlayerDuesInstallment,
  RepDuesPayment,
  RepDuesPayout,
  DuesPaymentMethod,
  DuesCredit,
  DuesCreditType,
  SeasonRefundRow,
} from '@/lib/types';

/** One credit's landing on one installment — "covered by fundraising — Bottle Drive". */
interface CreditSource {
  creditId: string;
  creditType: string;
  description: string | null;
  amount: number;
}

/** The dues payload's installment rows. ⚠ `remainingAmount` is the NET figure since the credit
 *  model (2026-08-14): cash remainder − credits applied — what the family is asked to SEND. */
type InstallmentWithCredit = RepPlayerDuesInstallment & {
  remainingAmount?: number;
  creditApplied?: number;
  /** Settled by the SERVER's definition (lib/dues-credits.ts) — never re-derive client-side. */
  creditSettled?: boolean;
  creditSources?: CreditSource[];
};

interface PlayerWithDues {
  player: RepRosterPlayer;
  schedule: RepPlayerDuesSchedule | null;
  installments: InstallmentWithCredit[];
  /** Payment FACTS (mig 232) — each row is a receipt with its own date, method and ledger line. */
  payments: RepDuesPayment[];
  /** Per-installment CASH coverage derived from payments — the "$200.00 of $300.00" chips. */
  coverage: InstallmentCoverage[];
  paidAmount: number;
  outstanding: number;
  credits: DuesCredit[];
  totalCredits: number;
  rollingBalance: number;
  /** The three-state position (owner model 2026-08-14): dues − cash − credits applied. */
  leftToSend: number;
  creditApplied: number;
  owedBack: number;
  /** The outbox (mig 234): cash already handed back, and the receipts for it. */
  payouts: RepDuesPayout[];
  paidOut: number;
  /** The most that may be handed over in cash right now — credits not yet paid out, INCLUDING
   *  any currently sitting on a bill (paying those out simply puts the bill back up). */
  payableNow: number;
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

/* `balanceColor` (settled-is-quiet ruling) now lives with the By-installment lens in
   InstallmentBreakdown.tsx and is imported above — ONE definition, so the two views of this
   list can never colour the same balance differently. */

/** The colour each dues status is drawn in. The WORD comes from the shared list so this table
 *  and the Money hub's "Player dues" export can never call the same player two different
 *  things; colour is presentation and stays here, where the table is. */
const DUES_STATUS_COLOR: Record<ReturnType<typeof duesStatusLabel>, string> = {
  'Not set':    'var(--home-dim, rgba(255,255,255,0.3))',
  'In credit':  'var(--success-light)',
  // Settled = the balance cleared with credits doing part of the work (Paid stays cash — owner
  // model 2026-08-14). Same good green as Fully paid: the family owes nothing either way.
  Settled:      'var(--success-light)',
  'Fully paid': 'var(--success-light)',
  Partial:      'var(--warning)',
  Unpaid:       'var(--home-dim, rgba(255,255,255,0.4))',
};

function statusLabel(p: PlayerWithDues) {
  const label = duesStatusLabel(p);
  return { label, color: DUES_STATUS_COLOR[label] };
}

const CREDIT_TYPE_LABELS: Record<DuesCreditType, string> = {
  contribution:  'Contribution',
  fundraiser:    'Fundraiser',
  overpayment:   'Overpayment',
  other:         'Other',
  // New kinds (mig 233). Neither is offered by the manual Add-credit picker: forgiveness is
  // granted from the settlement sheet (Pass 3) and reimbursements ride out-of-pocket expenses
  // (Pass 2) — one door each, so the story of a credit is always traceable to its act.
  forgiven:      'Forgiven',
  reimbursement: 'Reimbursement',
};

const CREDIT_MODE_LABELS: Record<CreditApplicationMode, string> = {
  last_first:    'The last payment first',
  next_first:    'The next payment first',
  keep_separate: "They don't — settle at season's end",
};

const CREDIT_MODE_HINTS: Record<CreditApplicationMode, string> = {
  last_first:    'Fundraising shrinks the far end of the schedule; near-term amounts keep their dates',
  next_first:    'Relief lands on the next bill due',
  keep_separate: 'Bills never move — every credit waits for season’s end',
};

const PAYMENT_METHOD_LABELS: Record<DuesPaymentMethod, string> = {
  etransfer: 'E-transfer',
  cash:      'Cash',
  cheque:    'Cheque',
  other:     'Other',
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

const BLANK_PAYOUT_FORM = {
  amount:   '',
  paidDate: tournamentToday(),
  method:   'etransfer' as DuesPaymentMethod,
  note:     '',
};

const BLANK_PAYMENT_FORM = {
  amount:       '',
  receivedDate: tournamentToday(),
  method:       'etransfer' as DuesPaymentMethod,
  note:         '',
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

  // Payments (mig 232 — the receipt book)
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [payForm, setPayForm] = useState(BLANK_PAYMENT_FORM);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [payNotice, setPayNotice] = useState('');
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Set dues for all players. It opens the SAME generator the Budget Plan tab uses (owner ruling
  // 2026-08-13) — this screen used to carry a second, cruder bulk form of its own: type a total,
  // type installments, no preview of what any player would actually owe, and a save path that
  // deleted paid installments along with the rest. One door, and the safe one.
  const [applyAllOpen, setApplyAllOpen] = useState(false);

  // Reminders (installments past due or due soon)
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ emailsSent: number; installmentsTagged: number } | null>(null);
  const [reminderError, setReminderError] = useState('');
  // Emails to real families is the one click on this toolbar that can't be un-clicked — it
  // confirms first, and the confirm states the scope (owner call 2026-08-14).
  const [confirmRemindersOpen, setConfirmRemindersOpen] = useState(false);

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

  // ── View lens: Season totals (default, the existing table) vs By installment ──────────────
  // The choice rides the URL (owner-approved mockup d7162867) so a bookmarked or shared link
  // opens the same view; `replace` rather than `push` so toggling doesn't stack history entries.
  // Every other param (section, year) is preserved — this page is addressed by `?section=`.
  const router = useRouter();
  const pathname = usePathname();
  const wantsInstallments = seasonSearchParams.get('duesView') === 'installments';
  function setDuesView(next: 'totals' | 'installments') {
    const sp = new URLSearchParams(seasonSearchParams.toString());
    if (next === 'installments') sp.set('duesView', 'installments');
    else sp.delete('duesView');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useOverlayOpen(!!selected);
  // The bulk-dues generator registers its own overlay — a second one here would double-count.
  // The two reminder modals register BELOW (one call — they are mutually exclusive); without it
  // the phone bottom nav stayed tappable under the confirm dialog (/review 2026-08-14).

  // PDF branding and its plan gate both live in MoneyExportButton now — one place for every
  // Money tab, and the branding is fetched on the first PDF export rather than on every mount.

  // Automatic Dues Reminders toggle (moved here from the Money hub — it belongs with dues).
  const [autoReminders, setAutoReminders] = useState<boolean | null>(null);
  const [autoRemindersSaving, setAutoRemindersSaving] = useState(false);
  // The team-wide credits setting (owner Call 2, mig 233) — how credits meet bills.
  const [creditMode, setCreditMode] = useState<CreditApplicationMode | null>(null);
  const [creditModeSaving, setCreditModeSaving] = useState(false);
  // Paying a credit out in cash (mig 234) — the mirror of Record payment.
  const [payingOut, setPayingOut] = useState(false);
  const [payoutForm, setPayoutForm] = useState(BLANK_PAYOUT_FORM);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  // "See an example" — what the reminder email says and when it goes out. Read-only, so it
  // carries no unsaved-changes guard and needs none of the tabActive plumbing.
  const [reminderPreviewOpen, setReminderPreviewOpen] = useState(false);
  useOverlayOpen(confirmRemindersOpen || reminderPreviewOpen);

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
      .then(d => {
        if (!d) return;
        setAutoReminders(d.autoRemindersEnabled ?? true);
        // Normalize at the fetch boundary (mirror of the server's mapper) so everything below
        // trusts the state as a real mode.
        setCreditMode(normalizeCreditApplicationMode(d.creditApplication));
      })
      .catch(() => {});
  }, [orgSlug, teamId, seasonQuery]);

  /** Hand a family their credit back in cash. Their bills go back up — those dollars are settled
   *  now — which is why this reloads rather than patching state locally. */
  async function savePayout() {
    if (!selected) return;
    setPayoutError('');
    setPayoutSaving(true);
    try {
      const amount = parseFloat(payoutForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Enter an amount to pay out');
      // The ceiling itself is the SERVER's call (it re-derives from the database and owns the
      // refusal wording); this is only the local guard that keeps the button honest.
      if (amount > selected.payableNow + 0.005) throw new Error(payoutOverMessage);
      if (!payoutForm.paidDate) throw new Error('Enter the day the money left');
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-payouts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            paidDate: payoutForm.paidDate,
            method: payoutForm.method,
            note: payoutForm.note.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to record the payout');
      setPayingOut(false);
      setPayoutForm(BLANK_PAYOUT_FORM);
      await load();
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : 'Failed to record the payout');
    } finally {
      setPayoutSaving(false);
    }
  }

  /** The undo: voids the books entry and the money goes back to being owed. */
  async function deletePayout(payoutId: string) {
    if (!selected) return;
    setDeletingPayoutId(payoutId);
    setPayoutError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-payouts/${payoutId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to remove the payout');
      await load();
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : 'Failed to remove the payout');
    } finally {
      setDeletingPayoutId(null);
    }
  }

  async function saveCreditMode(mode: CreditApplicationMode) {
    const previous = creditMode;
    setCreditMode(mode); // optimistic — the hint line explains the choice immediately
    setCreditModeSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditApplication: mode }),
      });
      if (!res.ok) throw new Error();
      // The setting changes every "to send" figure on this screen — reload so the table,
      // drawer and lens all tell the new story at once.
      await load();
    } catch {
      // Revert only if a NEWER choice hasn't superseded this one — an old failure must never
      // stomp a selection the coach has already moved past (/review 2026-08-14).
      setCreditMode(current => (current === mode ? previous : current));
    } finally {
      setCreditModeSaving(false);
    }
  }

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

  async function savePayment() {
    if (!selected) return;
    setPayError('');
    setPayNotice('');
    setPaySaving(true);
    try {
      const amount = parseFloat(payForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid payment amount');
      if (!payForm.receivedDate) throw new Error('Date received is required');
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            receivedDate: payForm.receivedDate,
            method:       payForm.method,
            note:         payForm.note.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to record payment');
      setRecordingPayment(false);
      setPayForm(BLANK_PAYMENT_FORM);
      // The automatic overpayment credit (owner ruling 2026-08-13) is stated, never silent —
      // the coach must see that $50 of what they just typed became a credit, not dues.
      if (data.overpaymentCredit > 0.005) {
        setPayNotice(`${fmt(data.overpaymentCredit)} was more than this player's schedule — saved as an overpayment credit.`);
      }
      await load();
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setPaySaving(false);
    }
  }

  async function deletePayment(paymentId: string) {
    if (!selected) return;
    setDeletingPaymentId(paymentId);
    setPayNotice('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-payments/${paymentId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to remove payment');
      }
      await load();
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : 'Failed to remove payment');
    } finally {
      setDeletingPaymentId(null);
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

  // ── The Pay out sheet's derived values, in ONE place ─────────────────────────────────────
  // The amount, whether it clears the ceiling, and the one sentence that says so — declared
  // once so the preview line, the submit button and the save guard cannot disagree about any
  // of the three (they were three independent copies of the same arithmetic and wording).
  const payoutAmount = parseFloat(payoutForm.amount) || 0;
  const payoutOverCeiling = !!selected && payoutAmount > selected.payableNow + 0.005;
  const payoutOverMessage = selected
    ? `This family has ${fmt(selected.payableNow)} left in credit — you can't pay out more than that.`
    : '';
  /** One rendering of the payout error, used inside the sheet and beside the strip. */
  const payoutErrorNote = payoutError
    ? <p className={styles.errorText} style={{ margin: '0 0 0.6rem', fontSize: '0.78rem' }}>{payoutError}</p>
    : null;
  // Never-paid = same predicate as the Overview "N unpaid" badge, so the two always agree.
  const neverPaid = players.filter(isNeverPaidPlayer);

  // ── Season totals (owner ruling 2026-08-13, mockup artifact `c19d8500`) ────────────────────
  // Every figure is summed from `players`, which this page already has — nothing new is computed
  // or fetched. These used to live in a 300px reference rail beside the table (Option C rails,
  // 2026-08-02); they now sit in the table's own <tfoot>, under the column each one totals.
  // Overdue reuses the SHARED installment predicate, so the footer can't disagree with the ⚠
  // flags on the rows above it.
  const seasonTotals = (() => {
    let assessed = 0;
    // ONE credit definition (lib/dues-credits.ts) — this was the fifth hand-copied credit sum,
    // the only client-side one, accumulating floats across the roster.
    const credits = creditsTotal(players.map(p => ({ amount: p.totalCredits })));
    let collected = 0;
    let outstanding = 0;
    let overduePlayers = 0;
    let nextDue: string | null = null;
    for (const p of players) {
      if (p.schedule) assessed += p.schedule.totalAmount;
      collected += p.paidAmount;
      if (p.rollingBalance > 0.005) outstanding += p.rollingBalance;
      let hasOverdue = false;
      for (const inst of p.installments) {
        if (inst.paidAt) continue;
        // A bill with nothing left to SEND is not late for anyone — credits settled it, and
        // paid_at deliberately never stamps on credit-covered rows (Paid stays cash).
        if (installmentToSend(inst, p.coverage.find(c => c.installmentId === inst.id)) <= 0.005) continue;
        if (isInstallmentOverdue(inst.dueDate, inst.paidAt)) { hasOverdue = true; continue; }
        // "Next due" is the soonest date still AHEAD — an overdue date is not a plan, it's a debt,
        // and it is already reported on its own line.
        if (inst.dueDate && (!nextDue || inst.dueDate < nextDue)) nextDue = inst.dueDate;
      }
      if (hasOverdue) overduePlayers += 1;
    }
    return { assessed, credits, collected, outstanding, overduePlayers, nextDue };
  })();
  /** Is anyone ACTUALLY late? Distinct from "hasn't paid" — see the chase card below. */
  const anyoneLate = seasonTotals.overduePlayers > 0;
  // ⚠ NOTHING SET YET MEANS NO FOOTER, not a row of $0.00. On a roster whose dues haven't been
  // built, every figure here is zero and a totals row would total nothing — the same reason the
  // overdue line hides itself when nobody is behind (owner ruling 2026-08-13).
  // Asks whether a SCHEDULE exists, not whether `assessed > 0`: a real schedule totalling zero is
  // a decision a coach made, and its footer should say zero rather than vanish.
  const showSeasonTotals = players.some(p => p.schedule);
  // The By-installment lens needs at least one schedule for the same reason the footer does —
  // with none, its band and grid would be a page of dashes. The toggle hides with it, and a
  // bookmarked ?duesView=installments URL quietly falls back to the totals table.
  const installmentView = wantsInstallments && showSeasonTotals;

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
      {/* The view lens sits on the toolbar's left — exactly the slot the panel-toolbar ruling
          reserved for "a view switch, a status filter, a lens picker". Desktop-only: phones
          have one view (the cards), so a toggle there would be two buttons that do nothing. */}
      {showSeasonTotals && (
        <div className={`${styles.segChoice} ${styles.duesViewSeg} ${styles.duesDesktopOnly}`} role="group" aria-label="Dues view">
          <button
            type="button"
            className={`${styles.segBtn} ${!installmentView ? styles.segBtnActive : ''}`}
            onClick={() => setDuesView('totals')}
          >
            Season totals
          </button>
          <button
            type="button"
            className={`${styles.segBtn} ${installmentView ? styles.segBtnActive : ''}`}
            onClick={() => setDuesView('installments')}
          >
            By installment
          </button>
        </div>
      )}
      <div className={styles.panelToolbarActions}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {duesExport}
            {moneyCanWrite && (
            <>
            {/* Secondaries go icon-only on phones (`.headerBtnLabel` — the page-header
                ruling's mechanism, same reason: three worded buttons stacked three rows
                deep before the list began). aria-labels carry the words. */}
            <button className={styles.btnSecondary} onClick={() => setApplyAllOpen(true)} aria-label="Set dues for all players">
              <DollarSign size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Set dues for all players</span>
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => setConfirmRemindersOpen(true)}
              disabled={sendingReminders}
              style={{ opacity: sendingReminders ? 0.6 : 1 }}
              /* Tracks the visible ternary — a static label would tell AT "Send due
                 reminders" while sighted users watch "Sending…" (/review finding). */
              aria-label={sendingReminders ? 'Sending reminders' : 'Send due reminders'}
            >
              <Bell size={14} aria-hidden /> <span className={styles.headerBtnLabel}>{sendingReminders ? 'Sending…' : 'Send Due Reminders'}</span>
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
              No reminders needed — nothing is past due or due within 3 days.
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
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-dues', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
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
                      ? `${seasonTotals.overduePlayers} past their due date`
                      : `${neverPaid.length} ${neverPaid.length !== 1 ? 'players have' : 'player has'} not paid yet`}
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                    {anyoneLate
                      ? `${neverPaid.length} ${neverPaid.length !== 1 ? 'players owe' : 'player owes'} dues with no payment recorded.`
                      : seasonTotals.nextDue
                        ? `Nothing is late — the first payment is due ${fmtDate(seasonTotals.nextDue)}.`
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

          {/* Two lenses on ONE list — on DESKTOP. Phones carry no toggle (owner call
              2026-08-14): the collapsible cards answer both questions, so below 640 the
              breakdown (band + cards) always renders and the totals table stands down.
              On desktop, By-installment shows the breakdown and Season totals shows the
              table below, byte-for-byte what it was before the lens existed. Opening a
              player lands in the same drawer from everywhere. */}
          {showSeasonTotals && (
            <InstallmentBreakdown
              players={players}
              desktopActive={installmentView}
              onOpenPlayer={id => {
                const p = players.find(x => x.player.id === id);
                if (!p) return;
                setSelected(p); setEditingSchedule(false); setAddingCredit(false); setSaveError('');
                setRecordingPayment(false); setPayError(''); setPayNotice('');
              }}
            />
          )}
          {!installmentView && (
          <div className={`${styles.tableWrap} ${styles.tableAsCards}${showSeasonTotals ? ` ${styles.duesDesktopOnly}` : ''}`}>
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
                      onClick={() => { setSelected(p); setEditingSchedule(false); setAddingCredit(false); setSaveError(''); setRecordingPayment(false); setPayError(''); setPayNotice(''); }}
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

              {/* Season totals, each under the column it totals (owner ruling 2026-08-13, chosen
                  from a four-option mockup — artifact `c19d8500`). This replaces the reference rail
                  that stood to the right of this table; the trade the owner accepted is that these
                  now scroll with the roster, on the grounds that a dues list runs 12–20 rows.

                  Read-only, as the rail was: "Remind all" stays with the chase card it belongs to,
                  because a send button beside a total invites nudging people you haven't looked at.

                  ⚠ `data-label` on every cell is what makes this work at 640, where the table
                  becomes cards and this row becomes the last card in the list. */}
              {showSeasonTotals && (
                <tfoot className={styles.tableFoot}>
                  <tr>
                    {/* `footLeadCell` keeps this caption visible in card mode — the cell is named
                        rather than reached for by position, matching `cardActionCell` at the other
                        end of the row. */}
                    <td className={`${styles.td} ${styles.footLeadCell}`}>
                      <span className={styles.footLabel}>Season</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Assessed">
                      <span className={styles.footLabel}>Assessed</span>
                      <span className={styles.footValue}>{fmt(seasonTotals.assessed)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits">
                      <span className={styles.footLabel}>Credits</span>
                      <span className={styles.footValue}>
                        {seasonTotals.credits > 0.005 ? `-${fmt(seasonTotals.credits)}` : '—'}
                      </span>
                    </td>
                    {/* The Paid column totals to COLLECTED; the Balance column totals under its
                        OWN name. This cell used to say "Outstanding" — but it sums positive
                        ROLLING balances (credits subtracted), and "Outstanding" is the credits-
                        EXCLUDED figure the digest and Ask quote. Same word, two numbers, drifting
                        by exactly the credited amount (inventory row 2, fixed Pass 2). */}
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Collected">
                      <span className={styles.footLabel}>Collected</span>
                      <span className={styles.footValue}>{fmt(seasonTotals.collected)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Balance owing">
                      <span className={styles.footLabel}>Balance owing</span>
                      <span className={styles.footValue} data-warn={seasonTotals.outstanding > 0.005 ? 'true' : undefined}>
                        {fmt(seasonTotals.outstanding)}
                      </span>
                    </td>
                    {/* Next due, plus the overdue headcount when there is one. Overdue has no
                        column of its own to sit under, and the Status column is where the per-row
                        version of exactly this fact lives. Absent when nobody is behind — a zero
                        here would read as a score (the 2026-08-03 ruling, carried over intact). */}
                    {/* ⚠ `cardStackCell` ONLY WHEN THE SECOND LINE EXISTS. At ≤640 a card cell is a
                        single-row flex (label ::before | value, space-between), so a cell carrying
                        BOTH a value and the overdue note would print all three on one line instead
                        of the note sitting under the figure. `cardStackCell` is this file's own
                        answer for a cell too big for one label/value line — applied conditionally
                        because with no overdue note this cell is exactly one line and should read
                        like its five siblings. */}
                    <td
                      className={`${styles.td}${seasonTotals.overduePlayers > 0 ? ` ${styles.cardStackCell}` : ''}`}
                      data-label="Next due"
                    >
                      <span className={styles.footLabel}>Next due</span>
                      <span className={styles.footValue} style={{ fontSize: '0.82rem' }}>
                        {seasonTotals.nextDue ? fmtDate(seasonTotals.nextDue) : '—'}
                      </span>
                      {seasonTotals.overduePlayers > 0 && (
                        <span className={styles.footNote} data-warn="true">
                          {seasonTotals.overduePlayers} overdue
                        </span>
                      )}
                    </td>
                    <td className={styles.td}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          )}

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
                            {/* Net of anything already handed back in cash — the label says so,
                                because the figure quietly changed meaning (/review 2026-08-14). */}
                            Credits still owed: <strong style={{ color: 'var(--success-light)' }}>-{fmt(surplusData.totalAllCredits)}</strong>
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

          {/* Automatic Dues Reminders — ONE compact row (owner, 2026-08-13: the old card spent
              ~200px saying one sentence). Title, a short status, "See an example" (opens the
              schedule + a rendered sample of the REAL email), and the toggle. */}
          {autoReminders !== null && (
            <div className={styles.detailSection} style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 1rem' }}>
              <Bell size={15} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>Automatic Dues Reminders</span>
                <span className={styles.muted} style={{ fontSize: '0.78rem' }}>
                  {autoReminders ? '30 and 7 days before each due date' : 'Off — no automatic emails'}
                </span>
              </div>
              <button
                className={styles.btnGhost}
                /* Quiet by type size, NOT by tap size — 44px is the portal's floor and the
                   mouse-only exception was already rejected once (money-rail pass). */
                style={{ flexShrink: 0, fontSize: '0.75rem', padding: '0.2rem 0.55rem', minHeight: 44 }}
                onClick={() => setReminderPreviewOpen(true)}
              >
                See an example
              </button>
              {moneyCanWrite && (
                <button
                  className={autoReminders ? styles.btnPrimary : styles.btnGhost}
                  disabled={autoRemindersSaving}
                  onClick={() => toggleAutoReminders(!autoReminders)}
                  style={{ flexShrink: 0, fontSize: '0.8rem', padding: '0.25rem 0.8rem' }}
                >
                  {autoRemindersSaving ? '…' : autoReminders ? 'Enabled' : 'Disabled'}
                </button>
              )}
            </div>
          )}

          {/* Credits reduce — the ONE team-wide credits setting (owner Call 2, 2026-08-14).
              A per-credit picker was considered and dropped: it turns every fundraiser entry
              into a decision, and two credits pointing different ways on one player is a story
              no one can retell. Same compact-row recipe as the reminders row above. */}
          {creditMode !== null && (
            <div className={styles.detailSection} style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 1rem' }}>
              <DollarSign size={15} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>Credits reduce</span>
                <span className={styles.muted} style={{ fontSize: '0.78rem' }}>
                  {CREDIT_MODE_HINTS[creditMode]}
                </span>
              </div>
              {moneyCanWrite ? (
                <select
                  className={styles.input}
                  aria-label="How credits reduce dues"
                  value={creditMode}
                  disabled={creditModeSaving}
                  onChange={e => saveCreditMode(e.target.value as CreditApplicationMode)}
                  style={{ flexShrink: 0, width: 'auto', fontSize: '0.8rem', minHeight: 44 }}
                >
                  {/* One source for the three sentences — the read-only label and the picker
                      can never drift. */}
                  {CREDIT_APPLICATION_MODES.map(m => (
                    <option key={m} value={m}>{CREDIT_MODE_LABELS[m]}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.muted} style={{ fontSize: '0.8rem', flexShrink: 0 }}>
                  {CREDIT_MODE_LABELS[creditMode]}
                </span>
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
                      {/* "Left to send" replaced Balance here (binding mockup §1, 2026-08-14):
                          dues − cash − credits applied — the number a family can actually act
                          on. The in-credit strip below still reports a negative balance. */}
                      {[
                        { label: 'Total Dues', value: fmt(selected.schedule.totalAmount), color: undefined },
                        { label: 'Paid', value: fmt(selected.paidAmount), color: 'var(--success-light)' },
                        { label: 'Credits', value: selected.totalCredits > 0 ? `-${fmt(selected.totalCredits)}` : '—', color: selected.totalCredits > 0 ? 'var(--success-light)' : undefined },
                        { label: 'Left to send', value: fmt(selected.leftToSend), color: balanceColor(selected.leftToSend) },
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

                    {/* Owed-back, not rolling balance (owner model 2026-08-14): the strip states
                        the model's own fact — the team is holding this family's money — and is
                        mode-safe, where a keep_separate team's negative rolling balance used to
                        claim "in their favour" beside bills still owed in full. */}
                    {/* Offered whenever there is credit left to hand over — including credit
                        currently lowering a bill, which paying out simply puts back up (binding
                        mockup §5). The sentence changes with the state; the door doesn't. */}
                    {selected.payableNow > 0.005 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                        padding: '0.6rem 0.85rem', marginBottom: '1rem', borderRadius: 7,
                        background: 'color-mix(in srgb, var(--success-light) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success-light) 20%, transparent)',
                        fontSize: '0.82rem', color: 'var(--success-light)',
                      }}>
                        <span style={{ flex: 1, minWidth: 200 }}>
                          {selected.owedBack > 0.005
                            ? <>The team is holding {fmt(selected.owedBack)} of this family&apos;s money
                                {selected.leftToSend > 0.005 ? ` — and ${fmt(selected.leftToSend)} is still to send on their bills.` : '.'}</>
                            : <>This family&apos;s {fmt(selected.payableNow)} is lowering their bills. You can hand it over in cash instead — their bills go back up.</>}
                        </span>
                        {moneyCanWrite && !payingOut && (
                          <button
                            className={styles.btnSecondary}
                            style={{ fontSize: '0.78rem', flexShrink: 0 }}
                            onClick={() => {
                              setPayingOut(true);
                              setPayoutForm({ ...BLANK_PAYOUT_FORM, amount: String(selected.payableNow) });
                              setPayoutError('');
                            }}
                          >
                            Pay out
                          </button>
                        )}
                      </div>
                    )}

                    {/* Pay out — the mirror of Record payment: how much, the day it LEFT, how. */}
                    {payingOut && (
                      <div style={{
                        padding: '0.85rem', marginBottom: '1rem',
                        background: 'var(--home-card, rgba(255,255,255,0.03))', borderRadius: 8,
                        border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                          <div>
                            <label className={styles.label}>Amount paid out <span className={styles.labelRequired}>*</span></label>
                            <input
                              className={styles.input}
                              type="number" min={0} step="0.01"
                              value={payoutForm.amount}
                              onChange={e => setPayoutForm(f => ({ ...f, amount: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className={styles.label}>Date paid <span className={styles.labelRequired}>*</span></label>
                            <input
                              className={styles.input}
                              type="date"
                              value={payoutForm.paidDate}
                              onChange={e => setPayoutForm(f => ({ ...f, paidDate: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className={styles.label}>Method</label>
                            <select
                              className={styles.input}
                              value={payoutForm.method}
                              onChange={e => setPayoutForm(f => ({ ...f, method: e.target.value as DuesPaymentMethod }))}
                            >
                              {(Object.entries(PAYMENT_METHOD_LABELS) as [DuesPaymentMethod, string][]).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={styles.label}>Note (optional)</label>
                            <input
                              className={styles.input}
                              type="text"
                              placeholder="e.g. sent to Dana"
                              value={payoutForm.note}
                              onChange={e => setPayoutForm(f => ({ ...f, note: e.target.value }))}
                            />
                          </div>
                        </div>
                        {/* What it does to the family's bills, BEFORE saving — the consequence a
                            coach would otherwise discover on the dues table afterwards. */}
                        {payoutAmount > 0 && (
                          <p style={{
                            margin: '0 0 0.6rem', fontSize: '0.78rem',
                            color: payoutOverCeiling ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.55))',
                          }}>
                            {payoutOverCeiling
                              ? payoutOverMessage
                              : `Posts ${fmt(payoutAmount)} money out to the team ledger, dated ${fmtDate(payoutForm.paidDate)}${
                                  selected.creditApplied > 0.005
                                    ? ' — and their bills go back up by whatever this money was covering.'
                                    : '.'}`}
                          </p>
                        )}
                        {payoutErrorNote}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button className={styles.btnGhost} onClick={() => { setPayingOut(false); setPayoutError(''); }} style={{ fontSize: '0.78rem' }}>
                            Cancel
                          </button>
                          <button
                            className={styles.btnPrimary}
                            disabled={payoutSaving || payoutOverCeiling || payoutAmount <= 0}
                            onClick={savePayout}
                            style={{ fontSize: '0.78rem' }}
                          >
                            {payoutSaving ? 'Recording…' : 'Pay out'}
                          </button>
                        </div>
                      </div>
                    )}
                    {!payingOut && payoutErrorNote}

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
                      {moneyCanWrite && !recordingPayment && (
                        <button
                          className={styles.btnPrimary}
                          onClick={() => { setRecordingPayment(true); setPayForm(BLANK_PAYMENT_FORM); setPayError(''); setPayNotice(''); }}
                          style={{ fontSize: '0.78rem' }}
                        >
                          Record payment
                        </button>
                      )}
                    </div>

                    {/* Record a payment — three facts (how much, when it arrived, how) and a
                        statement of where it lands BEFORE saving. Amounts spread oldest-first;
                        the coach never allocates by hand. */}
                    {recordingPayment && (
                      <div style={{
                        padding: '0.85rem', marginBottom: '1rem',
                        background: 'var(--home-card, rgba(255,255,255,0.03))', borderRadius: 8,
                        border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                          <div>
                            <label className={styles.label}>Amount received <span className={styles.labelRequired}>*</span></label>
                            <input
                              className={styles.input}
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="e.g. 100"
                              value={payForm.amount}
                              onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className={styles.label}>Date received <span className={styles.labelRequired}>*</span></label>
                            <input
                              className={styles.input}
                              type="date"
                              value={payForm.receivedDate}
                              onChange={e => setPayForm(f => ({ ...f, receivedDate: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                          <div>
                            <label className={styles.label}>Method</label>
                            <select
                              className={styles.input}
                              value={payForm.method}
                              onChange={e => setPayForm(f => ({ ...f, method: e.target.value as DuesPaymentMethod }))}
                            >
                              {(Object.entries(PAYMENT_METHOD_LABELS) as [DuesPaymentMethod, string][]).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={styles.label}>Note</label>
                            <input
                              className={styles.input}
                              /* Neutral example on purpose (owner ruling 2026-08-13, thread 3A):
                                 the old "from Dana's account" TAUGHT coaches to put guardian
                                 names where money-view assistants without the family-privacy
                                 grant can read them. */
                              placeholder="e.g. paid at practice"
                              value={payForm.note}
                              onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
                            />
                          </div>
                        </div>
                        {(() => {
                          const amt = parseFloat(payForm.amount);
                          if (isNaN(amt) || amt <= 0 || !selected.schedule) return null;
                          const paymentsTotal = selected.payments.reduce((s, p) => s + p.amount, 0);
                          // The SAME cents-safe helper the server's write path uses — a preview
                          // that does its own arithmetic is a preview that can disagree with
                          // the credit actually created.
                          const excess = overpaymentExcess(selected.schedule.totalAmount, paymentsTotal, amt);
                          return (
                            <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                              Posts {fmt(amt)} income to the team ledger, dated {fmtDate(payForm.receivedDate || tournamentToday())} — the day it arrived.
                              {excess > 0.005 && (
                                <span style={{ display: 'block', color: 'var(--warning)', marginTop: '0.2rem' }}>
                                  {fmt(excess)} is more than what&apos;s left on this schedule — it will be saved as an overpayment credit.
                                </span>
                              )}
                            </p>
                          );
                        })()}
                        {payError && <p className={styles.errorText}>{payError}</p>}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className={styles.btnGhost} onClick={() => { setRecordingPayment(false); setPayError(''); }} style={{ fontSize: '0.8rem' }}>Cancel</button>
                          <button className={styles.btnPrimary} disabled={paySaving} onClick={savePayment} style={{ fontSize: '0.8rem' }}>
                            {paySaving ? 'Recording…' : 'Record Payment'}
                          </button>
                        </div>
                      </div>
                    )}
                    {payNotice && (
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--warning)' }}>{payNotice}</p>
                    )}
                    {!recordingPayment && payError && (
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--danger-light)' }}>{payError}</p>
                    )}
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
                              // Coverage comes from recorded payments (mig 232). A part-covered
                              // installment says HOW FAR it has got — "$200.00 of $300.00" was
                              // this project's reason to exist; "Unpaid" beside two faithful
                              // transfers was the defect.
                              const cov = selected.coverage.find(c => c.installmentId === inst.id);
                              const allocated = cov?.allocated ?? 0;
                              const partial = !inst.paidAt && allocated > 0.005;
                              // Credits meet the bills (2026-08-14): what the family is actually
                              // asked to SEND, net of credits applied here — with the earning
                              // named, because "your bill dropped and here is why" is the best
                              // sentence a fundraising program can show.
                              const creditApplied = inst.creditApplied ?? 0;
                              const toSend = installmentToSend(inst, cov);
                              // A row credits settled is never late — nothing is being asked for.
                              const overdue = toSend > 0.005 && isInstallmentOverdue(inst.dueDate, inst.paidAt);
                              // Settled is the SERVER's call (payload creditSettled) — a local
                              // threshold here would silently drift from applyCreditsToBills.
                              const coveredByCredit = !inst.paidAt && creditApplied > 0.005 && (inst.creditSettled ?? false);
                              const coveredLabel = (inst.creditSources ?? []).every(s => s.creditType === 'fundraiser')
                                ? 'Covered by fundraising' : 'Covered by credit';
                              const sourceNote = (inst.creditSources ?? [])
                                .map(s => s.description || CREDIT_TYPE_LABELS[s.creditType as DuesCreditType] || s.creditType)
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .join(' · ');
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
                                    ) : coveredByCredit ? (
                                      /* Deliberately NOT "Paid" — Paid stays cash, so the books
                                         can always say which was which (owner Call 1). */
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--success-light)' }}>
                                        <CheckCircle2 size={12} /> {coveredLabel}
                                      </span>
                                    ) : partial || creditApplied > 0.005 ? (
                                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: creditApplied > 0.005 ? 'var(--success-light)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                                        {fmt(toSend)} to send
                                      </span>
                                    ) : (
                                      <span className={`${styles.badge} ${overdue ? styles.badgeCompleted : styles.badgeDraft}`} style={{ fontSize: '0.75rem' }}>
                                        {overdue ? 'Overdue' : `${fmt(toSend)} to send`}
                                      </span>
                                    )}
                                    {!inst.paidAt && creditApplied > 0.005 && (
                                      <span style={{ display: 'block', marginTop: '0.15rem', fontSize: '0.7rem', color: 'var(--home-dim, rgba(255,255,255,0.45))' }}>
                                        {partial ? `${fmt(allocated)} received · ` : ''}
                                        {fmt(creditApplied)} covered{sourceNote ? ` — ${sourceNote}` : ''}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`${styles.td} ${styles.cardActionCell}`}>
                                    {/* Hidden once credits leave nothing to ask the family for —
                                        a one-tap charge on a "Covered by fundraising" row is an
                                        invitation to double-collect. Real cash arriving anyway
                                        goes through Record payment (and frees the credit back
                                        to owed-back — the self-correcting rule). */}
                                    {!inst.paidAt && moneyCanWrite && toSend > 0.005 && (
                                      <button
                                        className={`${styles.btnSecondary} ${styles.compactAction}`}
                                        disabled={!!marking[inst.id]}
                                        onClick={() => markPaid(selected, inst)}
                                        /* One tap records a payment for what's still UNCOVERED
                                           on this installment, dated today — it can never
                                           double-charge a part-paid row. */
                                      >
                                        {marking[inst.id] ? '…' : partial ? 'Mark rest paid' : 'Mark Paid'}
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

                    {/* Payments — the receipt book (mig 232). Each row is a FACT with its own
                        date, method and ledger line; removing one voids that ledger entry and
                        takes any auto-created overpayment credit with it. */}
                    {selected.payments.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--home-dim, rgba(255,255,255,0.4))', marginBottom: '0.65rem' }}>
                          Payments — {fmt(selected.payments.reduce((s, p) => s + p.amount, 0))} received
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {selected.payments.map(pm => (
                            <div key={pm.id} style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.5rem 0.65rem', borderRadius: 7,
                              background: 'var(--home-card, rgba(255,255,255,0.03))',
                              border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
                              fontSize: '0.83rem',
                            }}>
                              <span style={{ color: 'var(--success-light)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {fmt(pm.amount)}
                              </span>
                              <span style={{ flex: 1, color: 'var(--home-ink-soft, rgba(255,255,255,0.75))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {PAYMENT_METHOD_LABELS[pm.method]}{pm.note ? ` · ${pm.note}` : ''}
                              </span>
                              <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', fontSize: '0.75rem', flexShrink: 0 }}>
                                {fmtDate(pm.receivedDate)}
                              </span>
                              {moneyCanWrite && (
                                <button
                                  style={{ background: 'none', border: 'none', color: 'var(--home-dim, rgba(255,255,255,0.3))', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                  disabled={deletingPaymentId === pm.id}
                                  onClick={() => deletePayment(pm.id)}
                                  title="Remove payment (voids its ledger entry)"
                                >
                                  {deletingPaymentId === pm.id ? '…' : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paid out — the outbox's receipts (mig 234), the mirror of Payments above.
                        Removing one voids its books entry and the money goes back to being owed. */}
                    {selected.payouts.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--home-dim, rgba(255,255,255,0.4))', marginBottom: '0.65rem' }}>
                          Paid out — {fmt(selected.paidOut)} handed back
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {selected.payouts.map(po => (
                            <div key={po.id} style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.5rem 0.65rem', borderRadius: 7,
                              background: 'var(--home-card, rgba(255,255,255,0.03))',
                              border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
                              fontSize: '0.83rem',
                            }}>
                              {/* Money OUT — the minus is the arithmetic, not an alarm. */}
                              <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.75))', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                −{fmt(po.amount)}
                              </span>
                              <span style={{ flex: 1, color: 'var(--home-ink-soft, rgba(255,255,255,0.75))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {PAYMENT_METHOD_LABELS[po.method]}{po.note ? ` · ${po.note}` : ''}
                              </span>
                              <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', fontSize: '0.75rem', flexShrink: 0 }}>
                                {fmtDate(po.paidDate)}
                              </span>
                              {moneyCanWrite && (
                                <button
                                  style={{ background: 'none', border: 'none', color: 'var(--home-dim, rgba(255,255,255,0.3))', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                  disabled={deletingPayoutId === po.id}
                                  onClick={() => deletePayout(po.id)}
                                  title="Remove payout (voids its ledger entry; the money goes back to being owed)"
                                >
                                  {deletingPayoutId === po.id ? '…' : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Credits section */}
                    <div style={{
                      borderTop: '1px solid var(--home-line, rgba(255,255,255,0.07))',
                      paddingTop: '1rem',
                      marginTop: selected.installments.length > 0 || selected.payments.length > 0 ? 0 : '0.5rem',
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
                              {/* An auto-created overpayment credit rides its payment (DB
                                  CASCADE) — deleting it alone would un-balance the books, so
                                  the delete lives on the payment row instead. */}
                              {c.paymentId ? (
                                <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', fontSize: '0.7rem', flexShrink: 0 }} title="Created by an overpayment — remove that payment to remove it">
                                  auto
                                </span>
                              ) : (
                                <button
                                  style={{ background: 'none', border: 'none', color: 'var(--home-dim, rgba(255,255,255,0.3))', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                  disabled={deletingCreditId === c.id}
                                  onClick={() => deleteCredit(c.id)}
                                  title="Remove credit"
                                >
                                  {deletingCreditId === c.id ? '…' : <Trash2 size={13} />}
                                </button>
                              )}
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
          budgetHref={moneySectionHref(base, 'budget', undefined, seasonQuery)}
          tabActive={tabActive}
          onClose={() => setApplyAllOpen(false)}
          onGenerated={load}
        />
      )}

      {/* "See an example" — the reminder schedule and a rendered sample of the email. The sample
          is built by the SAME template every sender uses (lib/dues-reminder-email.ts), so what a
          coach reads here is what a family receives — a hand-written sample would drift the
          first time the wording changed. Sample rows show both cases: untouched, and part-paid
          with the thank-you. */}
      {/* Confirm before emailing families (owner call 2026-08-14). The one toolbar click that
          can't be un-clicked states its whole scope up front: past due + the next 3 days,
          remainders only, one email per family, and the 7-day no-repeat guard. */}
      {confirmRemindersOpen && (
        <div className={styles.modalOverlay} onClick={() => setConfirmRemindersOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>Send due reminders?</span>
              <button className={styles.modalCloseBtn} aria-label="Close" onClick={() => setConfirmRemindersOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.1rem' }}>
              <p style={{ margin: 0 }}>
                This emails every family with an installment that is <strong>past due</strong> or{' '}
                <strong>due within the next 3 days</strong> — one email per family, asking only for
                what&apos;s still owing.
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                A family already reminded in the last 7 days isn&apos;t emailed again. Fully paid and
                up-to-date families never receive one.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className={styles.btnGhost} onClick={() => setConfirmRemindersOpen(false)}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={() => { setConfirmRemindersOpen(false); sendReminders(); }}
              >
                <Bell size={14} aria-hidden /> Send reminders
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderPreviewOpen && (() => {
        const sampleDue = addCalendarDays(tournamentToday(), 30);
        const sample = duesReminderEmail({
          teamName: assignment?.teamName ?? 'your team',
          window: 30,
          guardianFirst: 'Jordan',
          items: [
            { playerFirstName: 'Alex', playerLastName: 'Rivera', amount: 300, remainingAmount: 300, dueDate: sampleDue, installmentNumber: 2, totalInstallments: 4 },
            // One row shows the part-payment thank-you, the other the fundraising line — the
            // two sentences this template exists to get right.
            { playerFirstName: 'Sam', playerLastName: 'Rivera', amount: 300, remainingAmount: 100, creditApplied: 120, creditNote: 'Bottle Drive', dueDate: sampleDue, installmentNumber: 2, totalInstallments: 4 },
          ],
        });
        return (
          <div className={styles.modalOverlay} onClick={() => setReminderPreviewOpen(false)}>
            <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>Dues reminder emails</span>
                <button className={styles.modalCloseBtn} aria-label="Close" onClick={() => setReminderPreviewOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '0.83rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0 }}>
                  <strong>When they go out:</strong> with Automatic Dues Reminders on, each family is emailed
                  about an unpaid installment <strong>30 days</strong> before its due date and again
                  <strong> 7 days</strong> before — one email per family per wave, never twice in the same week.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Send Due Reminders</strong> (above the table) emails right now about anything past
                  due or due in the next 3 days. The <strong>Remind all</strong> button on the chase card is
                  separate — it only ever writes to families with no payment recorded at all.
                </p>
                <p style={{ margin: 0 }}>
                  Emails ask only for <strong>what&apos;s still owing</strong> — a family part-way through paying
                  is thanked for what&apos;s arrived, never billed the full amount again.
                </p>
              </div>

              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--home-line, rgba(255,255,255,0.12))', background: 'white' }}>
                <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--home-line, rgba(0,0,0,0.08))', fontSize: '0.75rem', color: 'black', opacity: 0.55 }}>
                  Subject: {sample.subject}
                </div>
                {/* The template's own inline styles carry the email's look; colours here only
                    ground it on the white "email client" card. */}
                <div style={{ color: 'black', fontSize: '0.85rem' }} dangerouslySetInnerHTML={{ __html: sample.html }} />
              </div>
              <p className={styles.muted} style={{ fontSize: '0.72rem', margin: '0.5rem 0 0' }}>
                Sample family and amounts — real emails use your roster&apos;s names, figures and due dates.
              </p>
            </div>
          </div>
        );
      })()}
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
