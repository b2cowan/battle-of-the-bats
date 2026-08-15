'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
/* (ChevronDown went with the settlement accordion's twist — it had no other caller here.) */
import { Users, X, CheckCircle2, AlertTriangle, ChevronRight, Plus, Trash2, Bell, ArrowLeft, DollarSign, Banknote, Pencil } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import HelpTooltip from '@/components/help/HelpTooltip';
import { DUES_EXPORT_COLUMNS, duesExportRows, duesPdfRows } from '@/lib/coach-money-exports';
import { isNeverPaidPlayer, duesStatusLabel, hasPastDueInstallment } from '@/lib/dues-status';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import DuesPayoutSheet from '@/components/coaches/DuesPayoutSheet';
import SettlementRow from '@/components/coaches/SettlementRow';
import GenerateInstallmentsModal from '../GenerateInstallmentsModal';
import InstallmentBreakdown, { balanceColor } from './InstallmentBreakdown';
import { installmentToSend } from '@/lib/dues-installment-view';
import styles from '../../../../coaches.module.css';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import { fmt } from '@/lib/coach-money-summary';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { moneySectionHref } from '@/lib/coach-money-links';
import { overpaymentExcess, type InstallmentCoverage } from '@/lib/dues-payments';
import {
  creditsTotal, normalizeCreditApplicationMode, CREDIT_MODE_SENTENCES, type CreditApplicationMode,
} from '@/lib/dues-credits';
import { patchAccountingSetting, fetchAccountingSettings } from '@/lib/coach-accounting-settings';
import DuesReminderPreviewModal from '@/components/coaches/DuesReminderPreviewModal';
import DuesMoneySettingRows from '@/components/coaches/DuesMoneySettingRows';
import { closeOutBlockers } from '@/lib/season-settlement';
import type { SettlementSheet, SettlementSheetRow } from '@/lib/season-settlement';
import type {
  RepRosterPlayer,
  RepPlayerDuesSchedule,
  RepPlayerDuesInstallment,
  RepDuesPayment,
  RepDuesPayout,
  DuesPaymentMethod,
  DuesCredit,
  DuesCreditType,
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

/* The settlement sheet's shape is the SERVER's (lib/season-settlement.ts `SettlementSheet`) —
   this panel renders what it is given and derives none of it. The local shape that stood here
   described the old calculator's four typed-pot figures, and went with it. */

/* (`fmt` is the shared one — this file's local copy was byte-for-byte the same behaviour. The other
   Money panels' local `fmt`s are NOT duplicates: several deliberately strip the sign because their
   callers print their own, so they stay where they are.) */

/* ⚠ THE SHARED ONE, and it must be: this panel prints date-only columns (`due_date`,
   `received_date`, `paid_date`) AND timestamps (`paid_at` is timestamptz — a PROJECTION
   written when payments cover an installment, mig 232) — often in the SAME ROW. The local
   `new Date(s + 'T00:00:00')` was right for the first and printed the literal words
   "Invalid Date" for the second, which is what every paid row of this ledger was showing. */
const fmtDate = formatStoredDate;

/* `balanceColor` (settled-is-quiet ruling) now lives with the By-installment lens in
   InstallmentBreakdown.tsx and is imported above — ONE definition, so the two views of this
   list can never colour the same balance differently. */

/** The colour each dues status is drawn in. The WORD comes from the shared list so this table
 *  and the Money hub's "Player dues" export can never call the same player two different
 *  things; colour is presentation and stays here, where the table is. */
/* ⚠ THE COLUMN IS QUIET EXCEPT WHERE ACTION IS NEEDED (owner call 2026-08-14).
   "Up to date" is the commonest state on a healthy roster, so it takes ORDINARY INK, not green —
   a column that is mostly green has no colour left to spend on the row that matters. Green is
   reserved for the season's finished states, and danger for the only status that is a call to
   action. (Past due also carries a ⚠ glyph at the cell: colour never states a verdict alone.) */
const DUES_STATUS_COLOR: Record<ReturnType<typeof duesStatusLabel>, string> = {
  'Not set':     'var(--home-dim, rgba(255,255,255,0.3))',
  'In credit':   'var(--success-light)',
  // Settled = the balance cleared with credits doing part of the work (Paid stays cash — owner
  // model 2026-08-14). Same good green as Fully paid: the family owes nothing either way.
  Settled:       'var(--success-light)',
  'Fully paid':  'var(--success-light)',
  'Past due':    'var(--danger-light)',
  'Up to date':  'var(--home-ink-soft, rgba(255,255,255,0.7))',
};

function statusLabel(p: PlayerWithDues) {
  // ⚠ Installments go in, because the label is a question about TIME — "is this family behind?"
  // — and without them it could only grade season completion (which called a faithfully-paying
  // family and a month-late one both "Partial").
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

/* ⚠ RENAMED FROM "Mark Paid" (owner call 2026-08-14). The button is not a flag — it RECORDS A
   PAYMENT, for whatever is still owed on the installment, dated today, and that payment appears
   in the receipt book below and can be removed like any other. "Mark paid" described the
   pre-payment-record world where it stamped a row, and the old word left a coach reasonably
   asking what the difference was between this and Record payment. There is none, except that
   this one does not stop to ask how much, what day and how it arrived.
   ⚠ DUES ONLY. Expenses, payables and allocations keep their own Mark Paid — those really are
   flags on a commitment, with no receipt book behind them. */
const MARK_PAID_LABEL      = 'Record as paid';
const MARK_PAID_REST_LABEL = 'Record rest as paid';

/* ── One installment, as the player ledger draws it (owner-approved mockup `e73e9842`) ────────
 * FOUR FIGURES PER INSTALLMENT, and each one totals to a tile at the head of the drawer:
 *
 *     installment  −  credit applied  =  after fundraising
 *     after fundraising  −  cash paid  =  owing
 *
 * ⚠ DERIVED ONCE, HANDED TO BOTH RENDERERS. The drawer draws this list twice — an eight-column
 * table on a desktop, collapsible cards on a phone — and the two must never be able to disagree
 * about what a family owes. The alternative (each renderer doing its own arithmetic off the same
 * payload) is the shape of every "the phone said something different" defect this hub has had.
 *
 * ⚠ `owing` is the SERVER's net remainder, never `amount − credit − paid` computed here. Credit
 * allocation across installments is the server's model (lib/dues-credits.ts); re-deriving it
 * client-side is how the two silently drift apart.
 */
function ledgerRowFor(inst: InstallmentWithCredit, coverage: InstallmentCoverage[]) {
  const cov = coverage.find(c => c.installmentId === inst.id);
  const paidCash = cov?.allocated ?? 0;
  const creditApplied = inst.creditApplied ?? 0;
  const owing = installmentToSend(inst, cov);
  const afterFundraising = Math.max(inst.amount - creditApplied, 0);
  const partial = !inst.paidAt && paidCash > 0.005;
  // A row credits settled is never late — nothing is being asked for.
  const overdue = owing > 0.005 && isInstallmentOverdue(inst.dueDate, inst.paidAt);
  // Settled is the SERVER's call (payload creditSettled) — a local threshold here would
  // silently drift from applyCreditsToBills.
  const coveredByCredit = !inst.paidAt && creditApplied > 0.005 && (inst.creditSettled ?? false);
  const coveredLabel = (inst.creditSources ?? []).every(s => s.creditType === 'fundraiser')
    ? 'Covered by fundraising' : 'Covered by credit';
  const sourceNote = (inst.creditSources ?? [])
    .map(s => s.description || CREDIT_TYPE_LABELS[s.creditType as DuesCreditType] || s.creditType)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');
  return { paidCash, creditApplied, owing, afterFundraising, partial, overdue, coveredByCredit, coveredLabel, sourceNote };
}

type LedgerRow = ReturnType<typeof ledgerRowFor>;

/**
 * The Note cell — the row's one sentence, and the reason the ledger fits on single lines.
 *
 * ⚠ "PAID ON <date>" AND "$X COVERED BY <effort>" ARE THE SAME KIND OF THING (owner call,
 * 2026-08-14): both EXPLAIN the row rather than measure it, and a row is almost never both —
 * cash settled it, or fundraising did. One column carries whichever applies, so the money
 * columns hold nothing but money and no row needs a second line. The rare row that is both
 * (a credit, then cash for the rest) prints both clauses, which is the honest answer.
 *
 * The dollars stay on a PART-covered row and go on a FULLY covered one: there, "After
 * fundraising $0.00" beside the installment's own amount already states the figure, and what is
 * left to say is who earned it.
 */
function LedgerNote({ inst, row }: { inst: InstallmentWithCredit; row: LedgerRow }) {
  const good = { display: 'inline-flex', alignItems: 'center', gap: '0.28rem', color: 'var(--success-light)', fontWeight: 600 } as const;
  const source = row.sourceNote ? ` — ${row.sourceNote}` : '';
  if (inst.paidAt) {
    return (
      <>
        <span style={good}><CheckCircle2 size={12} aria-hidden /> Paid {fmtDate(inst.paidAt, { withYear: false })}</span>
        {row.creditApplied > 0.005 && <> · {fmt(row.creditApplied)} covered{source}</>}
      </>
    );
  }
  if (row.coveredByCredit) {
    /* Deliberately NOT "Paid" — Paid stays cash, so the books can always say which was
       which (owner Call 1). */
    return (
      <>
        <span style={good}><CheckCircle2 size={12} aria-hidden /> {row.coveredLabel}</span>{source}
      </>
    );
  }
  if (row.creditApplied > 0.005) {
    return <>{row.partial && <>{fmt(row.paidCash)} received · </>}{fmt(row.creditApplied)} covered{source}</>;
  }
  if (row.overdue) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', color: 'var(--danger-light)', fontWeight: 600 }}>
        <AlertTriangle size={12} aria-hidden /> Overdue
      </span>
    );
  }
  return null;
}

/** The phone card's collapsed line: the one number a coach came to the schedule for. */
function ledgerSummary(inst: InstallmentWithCredit, row: LedgerRow) {
  if (row.owing > 0.005) return { text: fmt(row.owing), color: 'var(--danger-light)' };
  if (inst.paidAt)        return { text: 'Paid',         color: 'var(--success-light)' };
  if (row.coveredByCredit) return { text: 'Covered',     color: 'var(--success-light)' };
  return { text: 'Settled', color: 'var(--home-dim, rgba(255,255,255,0.45))' };
}

/** The settlement sheet's ONE remaining honesty strip: the team is short of what it owes families.
 *
 *  ⚠ It took a `tone` and had an amber sibling — "you are waiting on someone" — which the
 *  close-out ruling retired (2026-08-14): the readiness checklist beside the money summary states
 *  that where the question is asked, and saying it twice was the defect. The parameter went with
 *  the caller rather than being left as an untravelled branch for a future reader to trust.
 *
 *  ⚠ Never colour alone: the strip carries its sentence, because the olive↔danger pair is 1.0 ΔE
 *  apart for a deutan reader. */
function stripStyle(): React.CSSProperties {
  const token = 'var(--danger-light)';
  return {
    display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
    padding: '0.65rem 0.85rem', marginTop: '0.9rem', borderRadius: 7,
    background: `color-mix(in srgb, ${token} 8%, transparent)`,
    border: `1px solid color-mix(in srgb, ${token} 25%, transparent)`,
    fontSize: '0.82rem', color: token, lineHeight: 1.45,
  };
}

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
  /**
   * The open player's installments with their four figures, derived ONCE.
   *
   * ⚠ BOTH RENDERERS ARE ALWAYS IN THE DOM — the desktop table and the phone cards are drawn
   * unconditionally and one is hidden by a media query, not unmounted. Deriving inside each
   * block therefore ran every coverage lookup twice on every render of the drawer.
   */
  const ledgerRows = useMemo(
    () => (selected?.installments ?? []).map(inst => ({ inst, row: ledgerRowFor(inst, selected!.coverage) })),
    [selected],
  );
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [form, setForm] = useState(BLANK_SCHEDULE_FORM);
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([
    { installmentNumber: 1, amount: '', dueDate: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});
  /** The portal's own confirm (never window.confirm) — mounted for every coach screen. */
  const confirm = useConfirm();
  /** Set while the payment/credit sheet is correcting an existing row rather than adding one.
   *  ONE sheet does both jobs — a separate edit form is two places for the same fields to drift. */
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);

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

  // ── The season settlement sheet (Pass 3, 2026-08-14) ─────────────────────────────────────
  // Everything below is DERIVED by the server (lib/coach-season-settlement.ts) and rendered as
  // given. There is no typed pot and no Calculate button: the one figure a coach may state is
  // the hold-back, and even that is capped at the surplus.
  const [settlement, setSettlement] = useState<SettlementSheet | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState('');
  /** Which row is open to its own breakdown — nothing is explained in the table itself. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [holdBackEditing, setHoldBackEditing] = useState(false);
  const [holdBackInput, setHoldBackInput] = useState('');
  const [holdBackSaving, setHoldBackSaving] = useState(false);
  /* (The settlement's own per-row payout state stood here — a `payingRow`, its form and its
     saving flag. All three went with the per-row Pay out button, 2026-08-14. The PLAYER DRAWER's
     payout state is separate and untouched: `payingOut` / `payoutForm` / `payoutSaving`.) */
  const [payAllBusy, setPayAllBusy] = useState(false);
  /** The Set-refund sheet: an even share / a set amount / no share / forgive the balance. */
  const [choiceFor, setChoiceFor] = useState<SettlementSheetRow | null>(null);
  const [choiceKind, setChoiceKind] = useState<'even' | 'fixed' | 'no_share'>('even');
  const [choiceAmount, setChoiceAmount] = useState('');
  const [choiceSaving, setChoiceSaving] = useState(false);

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
    setUrlParam('duesView', next === 'installments' ? 'installments' : null);
  }

  /** The settlement sheet's open state rides the URL for the same reason the view lens does: a
   *  coach who sends "here's what we owe everyone" should be sending the sheet, not the page it
   *  is folded into. `replace` rather than `push`, so opening and closing doesn't stack history. */
  const refundOpen = seasonSearchParams.get('settlement') === 'open';
  function setRefundOpen(next: boolean) {
    setUrlParam('settlement', next ? 'open' : null);
  }

  /** One writer for every param this screen owns — each of them must preserve `section`, `year`
   *  and the others, and three hand-copies of that dance is three chances to drop one. */
  function setUrlParam(key: string, value: string | null) {
    const sp = new URLSearchParams(seasonSearchParams.toString());
    if (value === null) sp.delete(key); else sp.set(key, value);
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
  const [moneySettingError, setMoneySettingError] = useState('');
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
  // ⚠ Every overlay this panel opens registers here — without it the phone's bottom nav stays
  // tappable underneath (/review 2026-08-14). The Set-refund sheet joins the same call: they are
  // mutually exclusive, so one registration covers them.
  // ⚠ `refundOpen` joined this list when the settlement became a modal (2026-08-14) — as an
  // accordion it was page content and correctly absent. An unregistered overlay leaves the
  // portal's chrome (bottom nav, scroll lock) behaving as though nothing is open on top of it.
  useOverlayOpen(confirmRemindersOpen || reminderPreviewOpen || !!choiceFor || refundOpen);

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

  /** Both writes go through the ONE shared helper (lib/coach-accounting-settings) that Team
   *  settings → Money also uses — the two screens had drifted into different failure behaviour
   *  while each held a fix the other lacked. What differs here is the CONSEQUENCE, not the save. */
  /** Failed save ⇒ ask the server what these actually are. Reverting to a captured value is
   *  unsound once two saves overlap — see `fetchAccountingSettings` for the trace. */
  async function resyncMoneySettings() {
    const fresh = await fetchAccountingSettings(orgSlug, teamId);
    if (!fresh) return;
    setAutoReminders(fresh.autoRemindersEnabled);
    setCreditMode(fresh.creditApplication);
  }

  async function saveCreditMode(mode: CreditApplicationMode) {
    setCreditMode(mode); // optimistic — the hint line explains the choice immediately
    setCreditModeSaving(true);
    setMoneySettingError('');
    try {
      await patchAccountingSetting(orgSlug, teamId, { creditApplication: mode });
      // The setting changes every "to send" figure on this screen — reload so the table,
      // drawer and lens all tell the new story at once. (Team settings has nothing to reload,
      // which is exactly why the shared helper owns the request and not the aftermath.)
      await load();
    } catch (e) {
      setMoneySettingError(e instanceof Error ? e.message : 'Could not save that setting.');
      await resyncMoneySettings();
    } finally {
      setCreditModeSaving(false);
    }
  }

  async function toggleAutoReminders(enabled: boolean) {
    setAutoReminders(enabled); // optimistic, matching the picker beside it
    setAutoRemindersSaving(true);
    setMoneySettingError('');
    try {
      await patchAccountingSetting(orgSlug, teamId, { autoRemindersEnabled: enabled });
    } catch (e) {
      // ⚠ This used to throw into nothing — the switch simply stopped moving and the coach was
      // told why by no one. A setting that decides whether families get emailed must never fail
      // in silence, and must never end up SHOWING off while the schedule still sends.
      setMoneySettingError(e instanceof Error ? e.message : 'Could not save that setting.');
      await resyncMoneySettings();
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

  const applySettlement = useCallback((data: SettlementSheet) => {
    setSettlement(data);
    setHoldBackInput(data.pot.holdBack > 0 ? String(data.pot.holdBack) : '');
  }, []);

  const loadSettlement = useCallback(async () => {
    setSettlementLoading(true);
    setSettlementError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus${seasonQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      applySettlement(await res.json());
    } catch (e) {
      setSettlementError(e instanceof Error ? e.message : 'Failed to load the settlement sheet.');
    } finally {
      setSettlementLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery, applySettlement]);

  // Fetch the sheet the first time it is opened — including on a link that arrives with it
  // ALREADY open (`?settlement=open`), which is the state a shared link and the layout sweep
  // both land in. Loading it on mount instead would put a dozen queries behind every dues page.
  // ⚠ RE-READ EVERY TIME IT OPENS, not only the first time. As an accordion this fetched once per
  // mount and that was fine; as a modal a coach opens it, closes it, records a payment on the grid
  // behind it and opens it again — and the guard `!settlement` meant the second open showed the
  // first open's answer, including a "Ready to close" verdict that was no longer true (found by
  // /review 2026-08-14). Money safety never depended on this — the server re-derives at write time
  // — but a checklist that misreports readiness is the whole point of the checklist, undone.
  const wasRefundOpen = useRef(false);
  useEffect(() => {
    const justOpened = refundOpen && !wasRefundOpen.current;
    wasRefundOpen.current = refundOpen;
    if (justOpened && !settlementLoading) loadSettlement();
  }, [refundOpen, settlementLoading, loadSettlement]);

  /** The one figure a coach may state. Refused above the surplus — server-side, with the reason. */
  async function saveHoldBack() {
    setHoldBackSaving(true);
    setSettlementError('');
    try {
      const holdBackAmount = holdBackInput.trim() === '' ? 0 : parseFloat(holdBackInput);
      if (isNaN(holdBackAmount) || holdBackAmount < 0) throw new Error('Enter an amount to hold back (0 or more).');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdBackAmount, notes: settlement?.notes ?? null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      applySettlement(await res.json());
      setHoldBackEditing(false);
    } catch (e) {
      setSettlementError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setHoldBackSaving(false);
    }
  }

  /** An even share / a set amount / no share / forgive the balance — one door, four choices. */
  async function saveRowChoice(playerId: string, kind: 'even' | 'fixed' | 'no_share' | 'forgive' | 'unforgive', amount = 0) {
    setChoiceSaving(true);
    setSettlementError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, kind, amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      applySettlement(await res.json());
      setChoiceFor(null);
      // Forgiveness changes what the family owes, so the dues table above must catch up too.
      if (kind === 'forgive' || kind === 'unforgive') await load();
    } catch (e) {
      setSettlementError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setChoiceSaving(false);
    }
  }

  /**
   * Settle in cash — one row, one family, or the lot. The amount is the sheet's own figure
   * unless the coach typed a smaller one; either way the SERVER re-derives and re-checks it,
   * so a stale screen can never hand a family money twice.
   */
  /**
   * Close the season out — pay every family what the sheet says, in one act.
   *
   * ⚠ This took `(playerIds, amount)` and served two callers: the bulk settle AND a per-row payout
   * sheet inside the settlement table. The per-row caller is gone (owner ruling 2026-08-14 — the
   * settlement settles a season, not a family), so the parameters went with it.
   *
   * ⚠ Paying ONE family early still happens from that player's drawer via `savePayout` — which
   * posts to `/players/[playerId]/dues-payouts`, a DIFFERENT route that carries no close-out gate
   * by design. (This comment said "the same route" and was wrong; /review caught it 2026-08-14.
   * Worth being exact: a maintainer reasoning about which paths the gate covers would have been
   * misled into thinking the early-payout path was gated when it deliberately is not.)
   */
  async function closeOutSeason() {
    setPayAllBusy(true);
    setSettlementError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerIds: null,
          amount: null,
          paidDate: tournamentToday(),
          method: 'etransfer',
          note: null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to record the payout');
      applySettlement(await res.json());
      // Paying out puts bills back up and moves the Credits column — reload the table with it.
      await load();
    } catch (e) {
      const failure = e instanceof Error ? e.message : 'Failed to record the payout';
      // ⚠ RE-READ ON FAILURE. A close-out writes one cheque at a time, so a failure partway
      // through leaves some families genuinely paid — and leaving the old totals on screen would
      // tell the coach nothing happened and invite them to pay those families a second time. The
      // server is the truth; go and get it.
      await loadSettlement();
      await load();
      // ⚠ SET THE MESSAGE **AFTER** THE RE-READ, NOT BEFORE. `loadSettlement()` clears the error
      // as its first statement — correct for an ordinary load, fatal here: written before the
      // call, the payout's real failure was wiped in the same tick and a coach whose money-write
      // had just failed saw an empty screen and no reason. Found by /review 2026-08-14.
      setSettlementError(failure);
    } finally {
      setPayAllBusy(false);
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

  /**
   * ⚠ THE CONFIRM IS WHAT MAKES AN ICON-ONLY MONEY BUTTON HONEST (owner call 2026-08-14).
   * The control shrank to a 28px tick in the same pass; a tick that writes a payment the instant
   * it is touched asks the coach to trust a glyph. The dialog is where the three facts the button
   * no longer has room to state get stated — HOW MUCH, WHAT DAY, and that it lands in the receipt
   * book and can be taken back out. It costs one extra click on the fastest path in the hub,
   * which is the trade the owner made deliberately.
   */
  async function markPaid(p: PlayerWithDues, inst: RepPlayerDuesInstallment, owing: number) {
    if (!p.schedule) return;
    const name = [p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' ') || 'this player';
    const ok = await confirm({
      title: 'Record this as paid?',
      message: `Records a payment of ${fmt(owing)} from ${name} for installment #${inst.installmentNumber}, dated today (${fmtDate(tournamentToday())}).\n\nIt posts to the team's books on that date and appears in Payments below, where you can edit or remove it.`,
      confirmText: `Record ${fmt(owing)}`,
      cancelText: 'Cancel',
      tone: 'info',
    });
    if (!ok) return;
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

  /** Open the credit form on an existing credit. Only reachable for coach-authored ones —
   *  see `creditIsOwned` at the row. */
  function openEditCredit(c: DuesCredit) {
    closeMoneySheets();
    setEditingCreditId(c.id);
    setCreditForm({
      amount:      String(c.amount),
      description: c.description,
      creditType:  c.creditType,
      creditDate:  c.creditDate,
      notes:       c.notes ?? '',
    });
    setCreditError('');
    setAddingCredit(true);
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
      // ⚠ The credit TYPE is not sent on an edit. It is provenance ("where did this come from"),
      // and a contribution that becomes a fundraiser rebate by retyping is a credit whose story
      // no longer matches any record. Wrong type ⇒ remove it and add the right one.
      const editing = editingCreditId;
      const res = await fetch(
        editing
          ? `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-credits/${editing}`
          : `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-credits`,
        {
          method: editing ? 'PATCH' : 'POST',
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
      setEditingCreditId(null);
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

  /**
   * ⚠ ONE RESET FOR EVERY WAY THE MONEY SHEETS CAN BE DISMISSED — and the reason it exists is a
   * real defect this replaced (/review 2026-08-14, Critical).
   *
   * The sheets are shared between ADD and EDIT: a boolean says "the sheet is open", an id says
   * "…on this existing row". Six call sites closed or reopened them, and each had to remember to
   * clear BOTH. The payment Add button cleared the boolean and not the id (the credit one cleared
   * both — the asymmetry is what gave it away), and no drawer-close path cleared either. So:
   * pencil a payment → close the drawer with X → reopen the player → press "Record payment" →
   * fill in what you believe is a SECOND payment → save. It sent a PATCH, and the family's
   * original receipt was silently replaced by the new figures.
   *
   * A stale id is unsurvivable state: nothing on screen says which row a blank form is pointed at
   * (the only tell was the footer button reading "Save correction"). So no caller is trusted to
   * remember — every entry and exit goes through here.
   */
  function closeMoneySheets() {
    setRecordingPayment(false);
    setEditingPaymentId(null);
    setAddingCredit(false);
    setEditingCreditId(null);
    setPayError('');
    setPayNotice('');
    setCreditError('');
  }

  /** Open the payment sheet on an existing receipt, prefilled. */
  function openEditPayment(pm: RepDuesPayment) {
    closeMoneySheets();
    setEditingPaymentId(pm.id);
    setPayForm({
      amount:       String(pm.amount),
      receivedDate: pm.receivedDate,
      method:       pm.method,
      note:         pm.note ?? '',
    });
    setPayError('');
    setPayNotice('');
    setRecordingPayment(true);
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
      // ⚠ An edit is a CORRECTION, not an update: the server voids the old ledger entry and posts
      // a new one, because a posted entry is never rewritten in this product. The coach sees an
      // edit; the books keep the trail.
      const editing = editingPaymentId;
      const res = await fetch(
        editing
          ? `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-payments/${editing}`
          : `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-payments`,
        {
          method: editing ? 'PATCH' : 'POST',
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
      setEditingPaymentId(null);
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

  // The one sentence the Pay out sheet says when the coach types more than the family has left
  // in credit. The amount and the over-ceiling test now live inside the shared sheet
  // (components/coaches/DuesPayoutSheet) — they were three independent copies of the same
  // arithmetic and wording before, and the save guard below still reads this same message.
  const payoutOverMessage = selected
    ? `This family has ${fmt(selected.payableNow)} left in credit — you can't pay out more than that.`
    : '';
  /** One rendering of the payout error, used inside the sheet and beside the strip. */
  const payoutErrorNote = payoutError
    ? <p className={styles.errorText} style={{ margin: '0 0 0.6rem', fontSize: '0.78rem' }}>{payoutError}</p>
    : null;
  // Never-paid = same predicate as the Overview "N unpaid" badge, so the two always agree.
  const neverPaid = players.filter(isNeverPaidPlayer);

  // ── The settlement section's own derived values ──────────────────────────────────────────
  // The closed-state headline comes from figures THIS PAGE ALREADY HOLDS, so a coach learns the
  // team is holding families' money without the sheet being fetched at all.
  const owedBackTotal = Math.round(players.reduce((s, p) => s + (p.owedBack ?? 0) * 100, 0)) / 100;

  /**
   * Dues still to come in, from figures THIS PAGE ALREADY HOLDS.
   *
   * ⚠ Deliberately NOT `settlement.pot.expectedIn`, which is the same quantity from the server:
   * the door has to say whether the season can be closed BEFORE the sheet is fetched, and
   * fetching a settlement on every visit to the dues page to label one line would be a poor
   * trade. The sheet's own figure is what GATES the payout (`closeOutReady`); this one only
   * chooses the door's wording, and the modal reprints the server's number the moment it lands.
   */
  const seasonOutstanding = Math.round(players.reduce((s, p) => s + Math.max(0, p.leftToSend ?? 0) * 100, 0)) / 100;

  /**
   * Can the season be closed out? (owner ruling 2026-08-14 — the settlement is a close-out.)
   *
   * ⚠ TWO CONDITIONS, AND THE SECOND IS NOT REDUNDANT. This was first written as `expectedIn`
   * alone, reasoning that a season with nothing left to collect must have every refund positive
   * and therefore payouts equal to the cash on hand. That is FALSE, and a randomised test in
   * tests/unit/season-settlement.test.ts is what caught it: `sharePaid` — money already handed to
   * a family — is not bounded by their eventual share, so a family paid out EARLY (now the
   * documented way to settle someone leaving mid-season) can owe value back at close-out. One
   * negative row is enough for `payable` to exceed the cash, which is the exact overdraw this
   * whole gate exists to prevent. `awaitingCash` is the server's name for that gap.
   *
   * The two SOFTER conditions — a budget still planning to spend, and club money the sheet can't
   * attribute to one season — warn further down and deliberately do NOT block: both are the
   * coach's judgement, and the hold-back exists to answer the first.
   */
  // ⚠ THE SHARED PREDICATE, not a copy of it. This was a hand-written boolean here, another in
  // the server's payout guard and a third in the unit test — so a regression to one condition
  // would have shipped with every test green (found by /review 2026-08-14). `closeOutBlockers`
  // in lib/season-settlement.ts is the one definition, and the test exercises IT.
  const closeOut = settlement ? closeOutBlockers(settlement) : null;
  const closeOutReady = !!closeOut?.canClose;

  /* The two family counts the sheet quotes — each was being scanned for twice in the JSX, once for
     the number and again to pluralise the word after it. */
  const owingCount = settlement?.rows.filter(r => r.leftToSend > 0.005).length ?? 0;
  const payableCount = settlement?.rows.filter(r => r.payableNow > 0.005).length ?? 0;

  /**
   * Rows in family order: households with siblings first and adjacent, because they are one
   * conversation and one cheque. Everyone else follows in roster order.
   *
   * ⚠ It hands back ROWS AND NOTHING ELSE now. It used to dress each group with the family's
   * `label`, `payable` and `playerIds` for a caption row and a "Pay X in one" button — the button
   * went with the close-out ruling, and the caption went when it turned out to name a guardian
   * surname nobody on the roster shares. What survives of the grouping is the ORDER (siblings
   * adjacent) and the fact each row states its own household on itself.
   */
  const settlementGroups = (() => {
    if (!settlement) return [];
    const byKey = new Map<string, SettlementSheetRow[]>();
    for (const r of settlement.rows) {
      const list = byKey.get(r.familyKey);
      if (list) list.push(r); else byKey.set(r.familyKey, [r]);
    }
    // Households first, then everyone else — one pass. (Two `.filter`s and a `.map` stood here,
    // left over from when each branch had to be dressed with a label, payable and playerIds for
    // the family caption row and its "Pay in one" button. Both are gone; so is the scaffolding.)
    type Group = { key: string; rows: SettlementSheetRow[] };
    const households: Group[] = [];
    const singles: Group[] = [];
    for (const [key, rows] of byKey) (rows.length > 1 ? households : singles).push({ key, rows });
    return [...households, ...singles];
  })();

  function openRowChoice(row: SettlementSheetRow) {
    setChoiceFor(row);
    setChoiceKind(row.choice === 'fixed' ? 'fixed' : row.choice === 'none' ? 'no_share' : 'even');
    setChoiceAmount(row.choice === 'fixed' ? String(row.cashShare) : '');
    setSettlementError('');
  }

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
      // ⚠ THE SHARED PREDICATE, not a second loop. This footer's count and the Status column's
      // "Past due" are answers to the same question, and a table that gives two different ones is
      // a table nobody trusts. (It WAS two: the footer counted late players while the status
      // column could not see time at all.)
      if (hasPastDueInstallment(p.installments)) overduePlayers += 1;
      for (const inst of p.installments) {
        if (inst.paidAt) continue;
        // A bill with nothing left to SEND is not late for anyone — credits settled it, and
        // paid_at deliberately never stamps on credit-covered rows (Paid stays cash).
        if (installmentToSend(inst, p.coverage.find(c => c.installmentId === inst.id)) <= 0.005) continue;
        if (isInstallmentOverdue(inst.dueDate, inst.paidAt)) continue;
        // "Next due" is the soonest date still AHEAD — an overdue date is not a plan, it's a debt,
        // and it is already reported on its own line.
        if (inst.dueDate && (!nextDue || inst.dueDate < nextDue)) nextDue = inst.dueDate;
      }
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
  /** The two money settings have arrived. Their two consumers — the setup block (no dues yet)
   *  and the policy line (dues exist) — are mutually exclusive on `showSeasonTotals`, so this
   *  says only "we know the answer yet", nothing about which of the two is showing. */
  const moneySettingsLoaded = autoReminders !== null && creditMode !== null;
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
        variant={embedded ? 'embedded' : 'standard'}
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

          {/* ── Before any dues exist: the setup moment ────────────────────────────────────
              The two team-wide settings live in Team settings → Money, EXCEPT here. No family
              owes anything yet, so nothing these change can surprise anyone — and this is the
              one moment a coach is actually deciding how dues will work, which is the moment
              to show that the choices exist at all (owner call 2026-08-14).

              The instant the first schedule exists this block is replaced by the table and the
              one-line policy statement below it, so there is never a second place to change
              them and never a question about which one is authoritative.

              ⚠ It carries "Set dues for all players" itself. An empty state that only explains
              is a dead end — the page-level action has to be reachable from the empty screen. */}
          {!showSeasonTotals && moneySettingsLoaded && (
            <div style={{
              marginBottom: '1.5rem', padding: '1rem', borderRadius: 10,
              border: '1px dashed var(--home-line-strong, rgba(255,255,255,0.16))',
              background: 'var(--home-olive-soft, rgba(255,255,255,0.03))',
              display: 'flex', flexDirection: 'column', gap: '0.85rem',
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 650, fontSize: '0.95rem', color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>
                  No dues set yet
                </p>
                <p className={styles.muted} style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', maxWidth: '62ch' }}>
                  Set what each family pays and when. Two choices shape every schedule you create —
                  set them now, and you&apos;ll find them later under Team settings → Money.
                </p>
              </div>

              {/* The SAME rows Team settings → Money renders — one component, so the sentences a
                  coach reads about their families cannot say two different things. */}
              <div className={styles.settingRows} style={{ background: 'var(--home-card, rgba(255,255,255,0.03))' }}>
                <DuesMoneySettingRows
                  autoReminders={autoReminders}
                  creditMode={creditMode}
                  canWrite={moneyCanWrite}
                  remindersSaving={autoRemindersSaving}
                  creditModeSaving={creditModeSaving}
                  onToggleReminders={enabled => void toggleAutoReminders(enabled)}
                  onChangeCreditMode={mode => void saveCreditMode(mode)}
                  onPreviewReminder={() => setReminderPreviewOpen(true)}
                />
                {moneySettingError && (
                  <div className={styles.settingRow}>
                    <p className={styles.errorText} style={{ margin: 0 }}>{moneySettingError}</p>
                  </div>
                )}
              </div>

              {moneyCanWrite && (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className={styles.btnPrimary} onClick={() => setApplyAllOpen(true)}>
                    <DollarSign size={14} aria-hidden /> Set dues for all players
                  </button>
                  <span className={styles.settingRowDesc}>
                    Start from your budget plan, or type the amounts yourself.
                  </span>
                </div>
              )}
            </div>
          )}

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
                setSelected(p); setEditingSchedule(false); setSaveError(''); closeMoneySheets();
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
                      onClick={() => { setSelected(p); setEditingSchedule(false); setSaveError(''); closeMoneySheets(); }}
                    >
                      <td className={styles.td} data-label="Player">
                        {[p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' ')}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Total Dues">
                        {p.schedule ? fmt(p.schedule.totalAmount) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits" style={{ color: p.totalCredits > 0 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                        {/* Credits reduce the bill, so they read as a negative — and since the
                            brackets ruling (2026-08-14) the FORMATTER draws that, not a
                            hand-written dash in front of a positive number. */}
                        {p.totalCredits > 0 ? fmt(-p.totalCredits) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Paid" style={{ color: p.paidAmount > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.35))' }}>
                        {p.schedule ? fmt(p.paidAmount) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Balance" style={{ color: balanceColor(p.rollingBalance), fontWeight: 600 }}>
                        {p.schedule ? fmt(p.rollingBalance) : '—'}
                      </td>
                      <td className={styles.td} data-label="Status">
                        {/* ⚠ THE ⚠ IS NOT DECORATION. "Past due" is the one status that is a call
                            to action, and the design principle is absolute here: colour never
                            carries a verdict alone. A coach who cannot separate the danger red
                            from the ordinary ink still sees which rows are behind. */}
                        <span style={{ color, fontSize: '0.82rem', fontWeight: label === 'Past due' ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: '0.28rem' }}>
                          {label === 'Past due' && <AlertTriangle size={12} aria-hidden />}
                          {label}
                        </span>
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
                        {seasonTotals.credits > 0.005 ? fmt(-seasonTotals.credits) : '—'}
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

          {/* ── What the table above is obeying ────────────────────────────────────────────
              The two team-wide dues settings USED to sit here as two ~70px cards a coach met
              every time they came to chase a payment. They are set-once decisions, so the
              controls moved to Team settings → Money (owner call 2026-08-14) — but the SENTENCE
              stays, because "credits reduce the last payment first" is the explanation for why
              a family's far-end installments keep shrinking while their next bill does not.
              Move the control, keep the fact. Same shape the Depth Chart uses for lineup caps.

              ⚠⚠ ABSENT ENTIRELY IN AN ARCHIVE, and the reason is worth keeping. This line first
              shipped showing the policy in a past season too, on the argument that a finished
              season should still explain its own numbers. It cannot: the settings route this
              reads resolves the team's ACTIVE program year and ignores the `?year=` the panel
              sends it, so an archived season would have printed TODAY's policy over LAST year's
              table — governing rule 3 of the archive ruling ("does it show what the coach could
              see AT THE TIME, not today?") failed by a surface whose own comment claimed to
              satisfy it. A record page stating a live setting is worse than a record page
              stating nothing, so in a read-only season the table simply stands on its own.

              Serving the season's OWN policy would mean joining the season-read rail, and that
              is a deliberate decision point (the allow-list fails the build until someone edits
              it) — logged as an open question in the plan rather than taken here. */}
          {showSeasonTotals && moneySettingsLoaded && !page.isReadOnly && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
              margin: '0.9rem 0.15rem 0', fontSize: '0.78rem',
              color: 'var(--home-dim, rgba(255,255,255,0.5))',
            }}>
              <Bell size={13} aria-hidden style={{ flexShrink: 0 }} />
              <span>
                {autoReminders ? 'Reminders on — 30 and 7 days before each due date' : 'Automatic reminders off'}
              </span>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span>{CREDIT_MODE_SENTENCES[creditMode]}</span>
              {/* The whole line is live-season-only now, so the link needs no gate of its own. */}
              {moneyCanWrite && (
                <>
                  <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                  <Link
                    href={`${base}/settings?section=money`}
                    /* ⚠ 44px, even though the line around it is deliberately quiet. Type size is
                       how this stays understated; TAP size is not negotiable, and the rendered
                       sweep caught this link at 20px — the same mouse-only exception the money
                       rail already rejected once. */
                    style={{
                      color: 'var(--home-olive, var(--primary-light))', fontWeight: 600,
                      textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                      minHeight: 44,
                    }}
                  >
                    Change in Team settings
                  </Link>
                </>
              )}
            </div>
          )}

          {/* ══ The season settlement (owner model 2026-08-14; modal ruling same day) ═══════════
              What stands here is a settlement screen: what the team owes each family, what there
              is to share, and — when the season is done collecting — one act that pays everyone.

              ⚠ IT IS A DOOR, NOT A DRAWER. This was a full-width accordion, and opening it roughly
              doubled the page. It is an end-of-season act, so the page should not pay for it on
              every visit: one line that never grows, and the sheet itself in a modal.

              ⚠ IT IS STILL HONEST YEAR-ROUND, not gated on season end. A family holding an
              unapplied rebate in October is owed that money in October — so the LINE says so
              before anything is fetched, from figures this page already holds, and the sheet
              opens early as a forecast. What it cannot do early is pay anyone. */}
          {/* ⚠ THE DOOR MAY NOT PROMISE MORE THAN THE SHEET WILL DELIVER. It labelled itself from
              `seasonOutstanding` alone — the FIRST of the gate's two conditions — so a season fully
              collected but short of cash (a family overpaid early) got a primary "Close out the
              season" button that opened onto "Not ready to close yet" (found by /review
              2026-08-14). Once the sheet has been fetched its verdict wins; before that the page's
              own figure is an honest preview, and the pre-fetch state deliberately does NOT take
              the primary treatment on its own. */}
          <div className={styles.settlementDoor}>
            <span className={styles.settlementDoorTitle}>Season settlement</span>
            <span className={styles.settlementDoorNote}>
              {closeOut
                ? closeOut.canClose
                  ? 'Everything is in — the season is ready to close'
                  : closeOut.duesOutstanding > 0
                    ? `${fmt(closeOut.duesOutstanding)} of dues still to come in`
                    : `${fmt(closeOut.cashShort)} more than the team holds is needed to pay everyone`
                : seasonOutstanding > 0.005
                  ? owedBackTotal > 0.005
                    ? `The team is holding ${fmt(owedBackTotal)} of families’ money · ${fmt(seasonOutstanding)} of dues still to come in`
                    : `${fmt(seasonOutstanding)} of dues still to come in`
                  : 'All dues are in — open to check the season is ready to close'}
            </span>
            <button
              className={closeOutReady ? styles.btnPrimary : styles.btnGhost}
              style={{ fontSize: '0.78rem', minHeight: 44, flexShrink: 0 }}
              aria-haspopup="dialog"
              aria-expanded={refundOpen}
              onClick={() => setRefundOpen(true)}
            >
              {closeOutReady ? 'Close out the season' : 'Review settlement'}
            </button>
          </div>

          {refundOpen && (
            <div
              className={styles.modalOverlay}
              onMouseDown={e => { if (e.target === e.currentTarget && !payAllBusy) setRefundOpen(false); }}
            >
              <div
                className={`${styles.modal} ${styles.modalSettlement} ${styles.modalScrollBody} ${styles.modalFlushFooter}`}
                role="dialog"
                aria-modal="true"
                aria-label="Season settlement"
              >
                <div className={styles.modalHeader}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 className={styles.modalTitle}>
                      {closeOutReady
                        ? 'Ready to close the budget and pay families back?'
                        : 'Not ready to close yet'}
                    </h2>
                    {/* ⚠ NOT `.muted` — that class is the empty-state helper and carries
                        `padding: 2rem`, which indented this line 32px and blew the header open.
                        `.mutedInline` is the colour-only one; this has its own class because it
                        also sets the size. */}
                    {/* ⚠ The subtitle no longer restates what is owed. It read "Families still owe
                        $X", which is now the first line of the checklist beside the summary — and
                        a blocking figure printed twice invites the reader to check whether the two
                        agree. The heading says the verdict, the checklist says why. */}
                    <p className={styles.settlementSubtitle}>
                      {assignment?.teamName ?? ''}
                      {closeOutReady ? ' · Nothing is paid until you choose it below' : ''}
                    </p>
                  </div>
                  <button type="button" className={styles.modalCloseBtn} onClick={() => setRefundOpen(false)} aria-label="Close" disabled={payAllBusy}>
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.settlementScroll}>
                {settlementError && <p className={styles.errorText} style={{ marginTop: 0 }}>{settlementError}</p>}
                {settlementLoading && !settlement ? (
                  <p className={styles.muted}>Loading…</p>
                ) : !settlement ? null : (
                  /* Two columns from 760px: the money summary beside the family payouts, which is
                     what turns a scroll into a screenful. `.settlementBody` owns the split — the
                     summary's old `maxWidth: 460` is gone with it, since a fixed width inside a
                     grid track is exactly what left dead space beside it. */
                  <div className={styles.settlementBody}>
                    <div className={styles.settlementTop}>
                    {/* ── Where the pot comes from — derived, and showing its work ──────────── */}
                    <div className={styles.settlementSummary} style={{
                      borderRadius: 9, border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
                      background: 'var(--home-card, rgba(255,255,255,0.02))',
                      padding: '0.9rem 1.1rem',
                      fontSize: '0.84rem',
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))', marginBottom: '0.55rem' }}>
                        The team&apos;s money
                      </div>
                      {([
                        ['Dues received', settlement.pot.duesReceived, false],
                        ['Fundraising raised', settlement.pot.fundraisingRaised, false],
                        ['Spent', -settlement.pot.cashOut, false],
                        ...(settlement.pot.payoutsTotal > 0.005 ? [['Paid back to families', -settlement.pot.payoutsTotal, false] as const] : []),
                        ['Cash the team holds', settlement.pot.cashHeld, true],
                        // "Credits owed to families", not "Owed to families (credits)" — since the
                        // brackets ruling the figure carries its own (…), and the old label put two
                        // sets of brackets side by side on one line.
                        ['Credits owed to families', -settlement.pot.owedBack, false],
                        ...(settlement.pot.sharePaid > 0.005 ? [['Refunds already shared out', settlement.pot.sharePaid, false] as const] : []),
                        ...(settlement.pot.expectedIn > 0.005 ? [['Dues still to come in', settlement.pot.expectedIn, false] as const] : []),
                      ] as Array<readonly [string, number, boolean]>).map(([label, value, strong], i) => (
                        <div key={`${label}-${i}`} style={{
                          display: 'flex', justifyContent: 'space-between', gap: '1rem',
                          padding: '0.24rem 0',
                          borderTop: strong ? '1px solid var(--home-line, rgba(255,255,255,0.12))' : undefined,
                          marginTop: strong ? '0.35rem' : undefined,
                          paddingTop: strong ? '0.45rem' : undefined,
                          fontWeight: strong ? 700 : 400,
                          color: strong ? 'var(--home-ink, rgba(255,255,255,0.92))' : 'var(--home-ink-soft, rgba(255,255,255,0.68))',
                        }}>
                          <span>{label}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
                        </div>
                      ))}
                      {/* ⚠ HOLD-BACK SITS ABOVE THE TOTAL, because the total already contains it
                          (owner ruling 2026-08-14). `pot.surplus` is `surplusBeforeHold − holdBack`
                          — printing the hold-back UNDER the line it had already changed left the
                          visible column short by exactly that amount, so anyone adding up the
                          figures on screen found a hole the size of the hold-back. Same figure,
                          same control, drawn as the subtraction it is. */}
                      {/* ⚠ `flexWrap` was 'wrap' and the 44px Change control pushed the figure onto
                          its own line in a 320px column — the label sat alone above a stray
                          "($500.00) Change". The Change chip belongs BESIDE THE LABEL (the
                          approved mockup), the figure stays in the money column with every other
                          row, and nothing wraps. */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center',
                        flexWrap: 'nowrap', padding: '0.24rem 0',
                        color: 'var(--home-ink-soft, rgba(255,255,255,0.68))',
                      }}>
                        {/* The label no longer truncates — it was ellipsing to "Hold back for
                            next s…" in the side-by-side column that has since been retired. */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          <span>Hold back for next season</span>
                          {/* ⚠ DEAD WHILE A CLOSE-OUT IS IN FLIGHT. The old bulk button was
                              mutually exclusive with the per-row payout sheet; that sheet went, and
                              nothing replaced the exclusion for the two writers still living in
                              this modal — the hold-back and a family's share — so both stayed
                              clickable while cheques were being written (found by /review
                              2026-08-14). Changing what the pot holds mid-payout is a race worth
                              refusing outright. */}
                          {moneyCanWrite && !holdBackEditing && (
                            <button
                              className={styles.btnGhost}
                              disabled={payAllBusy}
                              onClick={() => setHoldBackEditing(true)}
                              style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', minHeight: 44, flexShrink: 0 }}
                            >
                              Change
                            </button>
                          )}
                        </span>
                        {holdBackEditing ? (
                          <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                              className={styles.input}
                              type="number" min={0} max={settlement.pot.holdBackCap} step="0.01"
                              aria-label="Amount to hold back for next season"
                              value={holdBackInput}
                              onChange={e => setHoldBackInput(e.target.value)}
                              style={{ width: 110, fontSize: '0.8rem' }}
                            />
                            <button className={styles.btnPrimary} disabled={holdBackSaving || payAllBusy} onClick={saveHoldBack} style={{ fontSize: '0.75rem', minHeight: 44 }}>
                              {holdBackSaving ? '…' : 'Save'}
                            </button>
                            <button className={styles.btnGhost} onClick={() => { setHoldBackEditing(false); setHoldBackInput(settlement.pot.holdBack > 0 ? String(settlement.pot.holdBack) : ''); }} style={{ fontSize: '0.75rem', minHeight: 44 }}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          /* Negated so it reads as the subtraction it is — the formatter draws
                             the brackets; `holdBack` itself is stored positive. */
                          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {settlement.pot.holdBack > 0.005 ? fmt(-settlement.pot.holdBack) : fmt(0)}
                          </span>
                        )}
                      </div>
                      {holdBackEditing && (
                        <p className={styles.mutedInline} style={{ fontSize: '0.74rem', margin: '0.35rem 0 0' }}>
                          At most {fmt(settlement.pot.holdBackCap)} — the rest is money the team owes families.
                        </p>
                      )}
                      {/* The bottom line — or, in a shortfall, the fact that there isn't one. */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', gap: '1rem',
                        borderTop: '1px solid var(--home-line, rgba(255,255,255,0.12))',
                        marginTop: '0.35rem', paddingTop: '0.45rem', fontWeight: 700,
                        color: 'var(--home-ink, rgba(255,255,255,0.92))',
                      }}>
                        <span>Surplus to share</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(settlement.pot.surplus)}</span>
                      </div>
                    </div>

                    {/* ── What the sheet has to say ABOUT that money, beside it ─────────────────
                        ⚠ These notes read as `.muted` and are NOT: that class is the empty-state
                        helper (`padding: 2rem`), which wrapped each of these one-liners in 32px of
                        air. `.mutedInline` is the colour. */}
                    {/* ⚠ THE CHECKLIST ANSWERS THE HEADING. The modal opens saying "Not ready to
                        close yet" and, until this existed, made a coach hunt for why — the reason
                        was one amber strip below a table. This states every condition at once, in
                        the space beside the summary, so "what is stopping me" is answered before
                        anything is scrolled. Nothing here is newly computed; each line is a figure
                        the sheet already derived.

                        ⚠ Two of the four BLOCK and two only WARN, and the marks say which: the
                        season's own plans and money the sheet can't attribute are the coach's
                        judgement, not the product's (owner ruling 2026-08-14). */}
                    <div className={styles.settlementNotes}>
                      <div className={styles.settlementChecksTitle}>
                        {closeOutReady ? 'Ready to close' : 'Before the season can close'}
                      </div>
                      <ul className={styles.settlementChecks}>
                        <li data-state={settlement.pot.expectedIn > 0.005 ? 'blocked' : 'done'}>
                          {settlement.pot.expectedIn > 0.005
                            ? <AlertTriangle size={14} aria-hidden />
                            : <CheckCircle2 size={14} aria-hidden />}
                          <span>
                            {settlement.pot.expectedIn > 0.005
                              ? <>{owingCount} famil{owingCount === 1 ? 'y' : 'ies'}
                                  {' '}still owe {fmt(settlement.pot.expectedIn)}</>
                              : 'Every family is square on their dues'}
                          </span>
                        </li>
                        <li data-state={settlement.awaitingCash > 0.005 ? 'blocked' : 'done'}>
                          {settlement.awaitingCash > 0.005
                            ? <AlertTriangle size={14} aria-hidden />
                            : <CheckCircle2 size={14} aria-hidden />}
                          <span>
                            {settlement.awaitingCash > 0.005
                              ? <>Paying everyone needs {fmt(settlement.awaitingCash)} more than the team holds</>
                              : 'The team is holding enough to pay every refund'}
                          </span>
                        </li>
                        {/* ⚠ A season still spending is not a season with a surplus — but this
                            WARNS and never blocks, and the hold-back is how a coach answers it. */}
                        {settlement.unspentPlan > 0.005 && settlement.pot.surplus > 0.005 && (
                          <li data-state="warn">
                            <AlertTriangle size={14} aria-hidden />
                            <span>The season still plans to spend {fmt(settlement.unspentPlan)} — hold that back first</span>
                          </li>
                        )}
                        {/* ⚠ Money the pot cannot honestly claim. Club funding and payments to the
                            club carry no season of their own, so they cannot be attributed to THIS
                            one — counting them would let a team in its third season share money an
                            earlier season received. Said out loud rather than silently dropped. */}
                        {settlement.clubMoneyUncounted > 0.005 && (
                          <li data-state="warn">
                            <AlertTriangle size={14} aria-hidden />
                            <span>
                              {fmt(settlement.clubMoneyUncounted)} of club funding isn&apos;t counted — it
                              isn&apos;t recorded against a single season
                            </span>
                          </li>
                        )}
                      </ul>
                      {/* The one piece of guidance the retired strip carried that the checklist
                          does not: where an early payout now happens, said once. */}
                      {!closeOutReady && (
                        <p className={styles.mutedInline} style={{ fontSize: '0.75rem', margin: '0.15rem 0 0' }}>
                          A family who needs paying sooner is paid from their own record.
                        </p>
                      )}
                    </div>
                    </div>

                    {/* ── The families ───────────────────────────────────────────────────────── */}
                    <div className={styles.settlementCol}>

                    {/* ── When the team can't cover what it owes (owner Call 9) ─────────────── */}
                    {settlement.pot.shortfall > 0.005 && (
                      <div style={stripStyle()}>
                        <AlertTriangle size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>
                          <strong>The team is {fmt(settlement.pot.shortfall)} short of what it owes families.</strong>{' '}
                          <span className={styles.mutedInline}>
                            Cash held {fmt(settlement.pot.cashHeld)} · owed to families {fmt(settlement.pot.owedBack)}.
                            There is no surplus to share — this is a debt, not a refund. Nothing is reduced
                            automatically; you decide who is paid from what&apos;s left.
                          </span>
                        </span>
                      </div>
                    )}

                    {settlement.rows.length === 0 ? (
                      <p className={styles.muted}>No families are owed anything yet.</p>
                    ) : (
                      <>
                        {/* One record per row, so on a phone it stacks rather than scrolling
                            sideways in silence (the Money-hub table ruling, 2026-08-13). */}
                        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th className={styles.th}>Player</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Owed back</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Even share</th>
                                {/* ⚠ THE TERM THAT WAS DRIVING EVERY REFUND AND APPEARED ON NO
                                    COLUMN (owner review 2026-08-14). A refund is
                                    `owedBack + cashShare − leftToSend − sharePaid`; without
                                    `leftToSend` on the table, a family with a $347.14 share and
                                    $150 owing showed $197.14 with nothing on the row to explain
                                    it, and seven rows of that read as arbitrary. Nothing is
                                    derived here — `leftToSend` was already on the payload. */}
                                <th className={`${styles.th} ${styles.thNum}`}>Still owes</th>
                                <th className={`${styles.th} ${styles.thNum}`}>Refund</th>
                                {/* (The trailing actions column is gone with the per-row Change
                                    button — it now lives inside the row's own breakdown.) */}
                              </tr>
                            </thead>
                            <tbody>
                              {settlementGroups.map(group => (
                                <Fragment key={group.key}>
                                  {/* ⚠ THE FAMILY CAPTION ROW IS GONE (owner question 2026-08-14).
                                      It read "<Guardian> family — one payout, N shares" above each
                                      multi-player household and failed twice over: it had no
                                      closing boundary, so on a roster whose one household sorts
                                      first it captioned the WHOLE table; and its label is the
                                      GUARDIAN's surname, which on a roster of Ledgers named an
                                      Okafor nobody could find. The fact it carried — these players
                                      are paid together — now rides the rows themselves, naming the
                                      sibling. The GROUPING is untouched: they share one payout. */}
                                  {group.rows.map(row => {
                                    const name = [row.playerFirstName, row.playerLastName].filter(Boolean).join(' ');
                                    return (
                                      <SettlementRow
                                        key={row.playerId}
                                        row={row}
                                        name={name}
                                        isOpen={openRow === row.playerId}
                                        onToggle={() => setOpenRow(openRow === row.playerId ? null : row.playerId)}
                                        canWrite={moneyCanWrite && !settlement.readOnly && !payAllBusy}
                                        onChangeChoice={() => openRowChoice(row)}
                                        fmtDate={fmtDate}
                                      />
                                    );
                                  })}
                                </Fragment>
                              ))}
                            </tbody>
                            {/* `.tableFoot` is what gives a totals row its divider and ground —
                                the shared Option-C recipe every Money-hub footer uses, including
                                the Season totals footer 300 lines above. Without the class the
                                row renders as an ordinary row wearing footer labels. */}
                            <tfoot className={styles.tableFoot}>
                              {/* ⚠ NO LABELS ON THE TOTALS, same ruling as the dues grid's footer
                                  (2026-08-14): each figure sits under the column heading that
                                  already names it, and a totals row on the footer line reads as a
                                  total without being told. Only "Team" survives — the one thing
                                  the columns do not say.
                                  ⚠ The `data-label`s STAY. Unlike the dues grid, this table
                                  becomes a card stack on a phone, where there are no headings to
                                  read across to — `.tableAsCards` re-captions from those. */}
                              <tr className={styles.tr}>
                                {/* The count IS the label — a totals row on the footer line needs no
                                    word telling the reader it totals the team. */}
                                <td className={`${styles.td} ${styles.footLeadCell}`} data-label="">
                                  <span className={styles.footValue}>
                                    {settlement.rows.length} player{settlement.rows.length !== 1 ? 's' : ''}
                                  </span>
                                </td>
                                <td className={`${styles.td} ${styles.tdNum}`} data-label="Owed back">
                                  <span className={styles.footValue} style={{ color: 'var(--success-light)' }}>{fmt(settlement.totals.owedBack)}</span>
                                </td>
                                <td className={`${styles.td} ${styles.tdNum}`} data-label="Even share">
                                  <span className={styles.footValue}>{fmt(settlement.totals.cashShare)}</span>
                                </td>
                                {/* The column the refunds subtract, totalled — so the "$X still to
                                    come in" on the summary beside it has something to tie to. */}
                                <td className={`${styles.td} ${styles.tdNum}`} data-label="Still owes">
                                  <span className={styles.footValue} style={{ color: settlement.pot.expectedIn > 0.005 ? 'var(--warning)' : undefined }}>
                                    {settlement.pot.expectedIn > 0.005 ? fmt(settlement.pot.expectedIn) : '—'}
                                  </span>
                                </td>
                                {/* ⚠ The SUM OF THE ROWS, not the sum of the columns beside it.
                                    Where a family still owes, those differ — and the rows are what
                                    will actually be paid. Rows re-adding to the cash on hand is the
                                    promise this whole sheet rests on, and with `Still owes` now on
                                    the table it is finally provable by reading across. */}
                                <td className={`${styles.td} ${styles.tdNum}`} data-label="Refund">
                                  <span className={styles.footValue} style={{ color: 'var(--success-light)' }}>{fmt(settlement.totals.refund)}</span>
                                </td>
                                {/* ⚠ The close-out button MOVED TO THE MODAL FOOTER, and the
                                    actions column with it. It lived in this cell when the sheet
                                    was a page section and the table's last row was the bottom of
                                    the screen; inside a modal that puts the one action a coach
                                    came for halfway down a scroll, under a pinned footer that is
                                    where a dialog's action belongs. */}
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* ⚠ WHY THE SHEET CANNOT PAY YET, naming who it is waiting on.
                            This strip used to sit beside a LIVE "Pay all" button and merely warn
                            that a forward-looking split spends money that has not arrived. Since
                            the close-out ruling the button is dead until this strip is gone, so
                            the strip's job changed from a caution to the explanation of a
                            disabled control — and it leads with the season, not the bank
                            balance, because "families still owe" is the condition that matters. */}
                        {/* ⚠ THE "WHY IT CAN'T CLOSE" STRIP STOOD HERE AND IS GONE. It said exactly
                            what the checklist beside the summary now says, only further down and
                            after the table — and a blocking reason stated twice is the same defect
                            as a blocking figure stated twice (owner, 2026-08-14). The checklist is
                            the one place; it sits where the heading raises the question.
                            ⚠ The SHORTFALL strip above is NOT this and stays: a team owing families
                            more than it holds is a debt, not a delay, and the checklist does not
                            cover it. */}

                        {settlement.unallocated > 0.005 && (
                          <p className={styles.mutedInline} style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
                            {fmt(settlement.unallocated)} of the surplus stays with the team — nobody is taking it.
                          </p>
                        )}

                        {/* ⚠ The per-row Pay out sheet stood here and is GONE with the close-out
                            ruling (2026-08-14). Paying ONE family is still entirely possible — it
                            happens in that player's own money record (the drawer's own
                            DuesPayoutSheet, further down this file), which is where the rest of
                            their history is. Nothing about the server path changed: it still
                            accepts a single-player payout at any point in the season. */}
                      </>
                    )}
                    </div>
                  </div>
                )}
                </div>
                {/* ⚠ ONE ACTION, AND ONLY WHEN THE SEASON IS DONE COLLECTING (owner ruling
                    2026-08-14). This used to offer `Pay all` the moment anything was payable —
                    while families still owed, and for more cash than the team held. The sheet
                    ALREADY computed that gap and printed a warning beside the live button, which
                    is not a safeguard. */}
                <div className={styles.modalFooter}>
                  {/* ⚠ Only once the season CAN close. While it is still collecting, "$1,011.68 to
                      4 families" beside a dead button reads as money queued to go out — the exact
                      impression the close-out gate exists to prevent. What is blocking is already
                      said, in words, at the top of the sheet. */}
                  {closeOutReady && settlement && settlement.totals.payable > 0.005 && (
                    <span className={styles.mutedInline} style={{ marginRight: 'auto', fontSize: '0.78rem' }}>
                      {fmt(settlement.totals.payable)} to {payableCount} famil{payableCount === 1 ? 'y' : 'ies'}
                    </span>
                  )}
                  <button className={styles.btnGhost} style={{ minHeight: 44 }} onClick={() => setRefundOpen(false)} disabled={payAllBusy}>
                    {closeOutReady ? 'Not yet' : 'Close'}
                  </button>
                  {settlement && moneyCanWrite && !settlement.readOnly && settlement.totals.payable > 0.005 && (
                    <button
                      className={styles.btnPrimary}
                      style={{ minHeight: 44 }}
                      disabled={payAllBusy || !closeOutReady}
                      title={closeOutReady ? undefined : 'The season can’t be closed yet — see the note above.'}
                      onClick={closeOutSeason}
                    >
                      {payAllBusy ? 'Recording…' : 'Pay everyone and close the season'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {/* Player slide-over */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => { setSelected(null); setEditingSchedule(false); closeMoneySheets(); }}>
          <div className={`${styles.slideOver} ${styles.slideOverLedger}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <button className={styles.modalBackBtn} aria-label="Back" onClick={() => { setSelected(null); setEditingSchedule(false); closeMoneySheets(); }}>
                <ArrowLeft size={20} />
              </button>
              <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>
                {[selected.player.playerFirstName, selected.player.playerLastName].filter(Boolean).join(' ')}
              </span>
              <button className={styles.modalCloseBtn} onClick={() => { setSelected(null); setEditingSchedule(false); closeMoneySheets(); }}>
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
                          on. The in-credit strip below still reports a negative balance.

                          ⚠ THESE FOUR TILES ARE THE FOUR COLUMNS OF THE TABLE BELOW, TOTALLED
                          (owner-approved mockup `e73e9842`, 2026-08-14) — and that is why the
                          table carries NO totals row: it would be these same four figures a
                          second time, forty millimetres down.

                          ⚠ CREDITS BECAME "AFTER FUNDRAISING", stating the RESULT rather than the
                          deduction. A negative in a row of positives was the one tile a treasurer
                          had to stop and decode; as a result, every neighbouring pair relates
                          — $800 → $550 → $400 → $150, each step readable left to right. The credit
                          itself is not lost: the strip directly below names it and offers the
                          payout. */}
                      {[
                        { label: 'Total dues', value: fmt(selected.schedule.totalAmount), color: undefined },
                        {
                          label: 'After fundraising',
                          value: fmt(Math.max(selected.schedule.totalAmount - selected.creditApplied, 0)),
                          color: selected.creditApplied > 0.005 ? 'var(--success-light)' : undefined,
                        },
                        { label: 'Paid', value: fmt(selected.paidAmount), color: 'var(--success-light)' },
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
                                {selected.leftToSend > 0.005 ? ` — and ${fmt(selected.leftToSend)} is still to send on their installments.` : '.'}</>
                            /* "installments", not "bills" (owner 2026-08-14): the word the rest of
                               this screen, the schedule editor and the help guide all use. A second
                               noun for the same object made a coach wonder whether a bill and an
                               installment were different things. */
                            : <>This family&apos;s {fmt(selected.payableNow)} is lowering their installments. You can hand it over in cash instead — their installments go back up.</>}
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

                    {/* Pay out — the ONE sheet (components/coaches/DuesPayoutSheet), shared with
                        the season settlement's rows. Here the ceiling is the family's remaining
                        CREDIT; there it is what the settlement says they are owed. */}
                    {payingOut && (
                      <DuesPayoutSheet
                        form={payoutForm}
                        onChange={setPayoutForm}
                        ceiling={selected.payableNow}
                        overCeilingMessage={payoutOverMessage}
                        consequence={amt =>
                          `Posts ${fmt(amt)} money out to the team ledger, dated ${fmtDate(payoutForm.paidDate)}${
                            selected.creditApplied > 0.005
                              ? ' — and their installments go back up by whatever this money was covering.'
                              : '.'}`}
                        error={payoutError}
                        saving={payoutSaving}
                        onCancel={() => { setPayingOut(false); setPayoutError(''); }}
                        onSubmit={savePayout}
                      />
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
                          /* closeMoneySheets FIRST — an "add" must never inherit an edit target. */
                          onClick={() => { closeMoneySheets(); setRecordingPayment(true); setPayForm(BLANK_PAYMENT_FORM); }}
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
                          // ⚠ On a correction the row being replaced must come OUT of the running
                          // total first — otherwise the preview counts the old receipt and the
                          // new one together and warns about an overpayment that will never
                          // exist.
                          const editingRow = editingPaymentId
                            ? selected.payments.find(p => p.id === editingPaymentId)
                            : undefined;
                          const excess = overpaymentExcess(
                            selected.schedule.totalAmount,
                            paymentsTotal - (editingRow?.amount ?? 0),
                            amt,
                          );
                          return (
                            <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                              {editingPaymentId
                                ? <>Replaces this receipt: the old books entry is voided and {fmt(amt)} is posted afresh, dated {fmtDate(payForm.receivedDate || tournamentToday())}.</>
                                : <>Posts {fmt(amt)} income to the team ledger, dated {fmtDate(payForm.receivedDate || tournamentToday())} — the day it arrived.</>}
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
                          <button className={styles.btnGhost} onClick={() => closeMoneySheets()} style={{ fontSize: '0.8rem' }}>Cancel</button>
                          <button className={styles.btnPrimary} disabled={paySaving} onClick={savePayment} style={{ fontSize: '0.8rem' }}>
                            {paySaving
                              ? (editingPaymentId ? 'Saving…' : 'Recording…')
                              : (editingPaymentId ? 'Save correction' : 'Record Payment')}
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

                    {/* ── Installments: four figures per row, desktop ────────────────────────
                        The table carries NO totals row on purpose — the four tiles at the head
                        of the drawer ARE its totals, and printing both would be the same four
                        figures twice on one screen (owner call on mockup `e73e9842`).

                        ⚠ `tableAsCards` is GONE from this frame. It was the right answer while
                        this was a four-column list; at eight columns a stacked card is eight
                        label/value lines per installment, and a twelve-installment season became
                        a hundred lines of scroll. The phone gets the collapsible list below
                        instead — the ONE reason it is safe to hide this table under 640. */}
                    {selected.installments.length > 0 && (
                      <div className={`${styles.tableWrap} ${styles.duesDesktopOnly}`} style={{ marginBottom: '1.25rem' }}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th className={styles.th}>#</th>
                              <th className={styles.th}>Due</th>
                              <th className={`${styles.th} ${styles.thNum}`}>Installment</th>
                              <th className={`${styles.th} ${styles.thNum}`}>After fundraising</th>
                              <th className={`${styles.th} ${styles.thNum}`}>Paid</th>
                              <th className={`${styles.th} ${styles.thNum}`}>Owing</th>
                              <th className={styles.th}>Note</th>
                              <th className={styles.th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerRows.map(({ inst, row }) => {
                              return (
                                <tr key={inst.id} className={styles.tr}>
                                  <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>{inst.installmentNumber}</td>
                                  {/* `.tdDate` — a date is one token and never breaks. Without it
                                      the long credit note starved this column and "Sep 15, 2026"
                                      folded after the comma, standing EVERY row at two lines. */}
                                  <td className={`${styles.td} ${styles.tdDate}`} style={{ color: row.overdue ? 'var(--danger-light)' : 'var(--home-ink-soft, rgba(255,255,255,0.65))' }}>
                                    {fmtDate(inst.dueDate)}
                                    {row.overdue && <AlertTriangle size={11} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--danger-light)' }} />}
                                  </td>
                                  <td className={`${styles.td} ${styles.tdNum}`}>{fmt(inst.amount)}</td>
                                  {/* The cut fundraising made, as a RESULT rather than a deduction —
                                      the same reading as the "After fundraising" tile above. */}
                                  <td className={`${styles.td} ${styles.tdNum}`} style={row.creditApplied > 0.005 ? { color: 'var(--success-light)', fontWeight: 650 } : undefined}>
                                    {fmt(row.afterFundraising)}
                                  </td>
                                  <td className={`${styles.td} ${styles.tdNum}`} style={row.paidCash > 0.005 ? { color: 'var(--success-light)', fontWeight: 650 } : { color: 'var(--home-dim, rgba(255,255,255,0.35))' }}>
                                    {row.paidCash > 0.005 ? fmt(row.paidCash) : '—'}
                                  </td>
                                  <td className={`${styles.td} ${styles.tdNum}`} style={row.owing > 0.005 ? { color: 'var(--danger-light)', fontWeight: 700 } : { color: 'var(--home-dim, rgba(255,255,255,0.35))' }}>
                                    {row.owing > 0.005 ? fmt(row.owing) : '—'}
                                  </td>
                                  <td className={styles.td} style={{ fontSize: '0.78rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                                    <LedgerNote inst={inst} row={row} />
                                  </td>
                                  <td className={styles.td} style={{ textAlign: 'right' }}>
                                    {/* Hidden once credits leave nothing to ask the family for —
                                        a one-tap charge on a "Covered by fundraising" row is an
                                        invitation to double-collect. Real cash arriving anyway
                                        goes through Record payment (and frees the credit back
                                        to owed-back — the self-correcting rule).

                                        ⚠ ICON-ONLY HERE, WORDS ON THE PHONE (owner call, mockup
                                        `e73e9842` option B). A desktop row has hover and a
                                        pointer to explain a 28px glyph; a phone has neither, and
                                        an open installment card has room for the full label. The
                                        accessible name below is what makes the tick a button
                                        rather than a decoration — it quotes the AMOUNT, so
                                        "record as paid" is never a leap of faith. */}
                                    {!inst.paidAt && moneyCanWrite && row.owing > 0.005 && (
                                      <button
                                        className={styles.rowIconBtn}
                                        disabled={!!marking[inst.id]}
                                        onClick={() => markPaid(selected, inst, row.owing)}
                                        title={`${row.partial ? MARK_PAID_REST_LABEL : MARK_PAID_LABEL} — ${fmt(row.owing)}, dated today`}
                                        aria-label={`${row.partial ? MARK_PAID_REST_LABEL : MARK_PAID_LABEL}: ${fmt(row.owing)}, dated today, installment ${inst.installmentNumber}`}
                                        /* One tap records a payment for what's still UNCOVERED
                                           on this installment, dated today — it can never
                                           double-charge a part-paid row. */
                                      >
                                        {marking[inst.id] ? '…' : <Banknote size={15} aria-hidden />}
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

                    {/* ── Installments: phone, one collapsible card each ─────────────────────
                        CLOSED, A ROW IS A DATE AND ONE NUMBER — the amount owing, or Paid, or
                        Covered. That is the whole question a phone is usually asked, and it
                        means a twelve-installment season fits on one screen instead of twelve
                        six-line blocks, with the only rows wearing a number being the ones that
                        want attention.

                        The season answer never moves: it lives in the four tiles at the top,
                        which is precisely why they stayed and the table's totals row did not.

                        Same `.duesCard*` idiom as the By-installment lens's per-player cards —
                        one collapsible-card language in this hub, not two. */}
                    {selected.installments.length > 0 && (
                      <div className={styles.duesCards} style={{ marginBottom: '1.25rem' }}>
                        {ledgerRows.map(({ inst, row }) => {
                          const summary = ledgerSummary(inst, row);
                          return (
                            <details key={inst.id} className={styles.duesCard}>
                              <summary className={styles.duesCardHead}>
                                <ChevronRight size={14} className={styles.duesCardTwist} aria-hidden />
                                <span className={styles.duesCardName} style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtDate(inst.dueDate)}
                                  {row.overdue && <AlertTriangle size={11} aria-hidden style={{ marginLeft: 4, verticalAlign: '-1px', color: 'var(--danger-light)' }} />}
                                </span>
                                <span className={styles.duesCardSum}>
                                  <span className={styles.duesCardDue} style={{ color: summary.color }}>{summary.text}</span>
                                </span>
                              </summary>
                              <div className={styles.duesCardBody}>
                                <div className={styles.duesCardRow}>
                                  <span className={styles.duesCardRowLab}>Installment</span>
                                  <span className={styles.duesCardRowVal} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(inst.amount)}</span>
                                </div>
                                {/* Only when fundraising actually moved this installment — an
                                    identical figure repeated under a second label is the noise a
                                    card has no columns to justify. */}
                                {row.creditApplied > 0.005 && (
                                  <div className={styles.duesCardRow}>
                                    <span className={styles.duesCardRowLab}>After fundraising</span>
                                    <span className={styles.duesCardRowVal} style={{ color: 'var(--success-light)', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.afterFundraising)}</span>
                                  </div>
                                )}
                                <div className={styles.duesCardRow}>
                                  <span className={styles.duesCardRowLab}>Paid</span>
                                  <span className={styles.duesCardRowVal} style={{ color: row.paidCash > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.35))', fontVariantNumeric: 'tabular-nums' }}>
                                    {row.paidCash > 0.005 ? fmt(row.paidCash) : '—'}
                                  </span>
                                </div>
                                <div className={styles.duesCardRow}>
                                  <span className={styles.duesCardRowLab}>Owing</span>
                                  <span className={styles.duesCardRowVal} style={{ color: row.owing > 0.005 ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.35))', fontWeight: row.owing > 0.005 ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                                    {row.owing > 0.005 ? fmt(row.owing) : '—'}
                                  </span>
                                </div>
                                {/* ⚠ THE PHONE'S RECORD BUTTON LIVES INSIDE THE OPEN CARD, NEVER ON
                                    THE COLLAPSED BAR (owner question, ruled 2026-08-14) — and it
                                    keeps its WORDS, where the desktop row shows a tick.

                                    Two reasons, both about the phone specifically:
                                    1. THE COLLAPSED BAR IS ITSELF A TAP TARGET. Putting a
                                       money-WRITING control inside a harmless toggle, at the right
                                       edge where thumbs land, makes the two compete: miss the small
                                       one and you open a card (nothing), miss the big one and you
                                       record a payment. The costs of the two mis-taps are wildly
                                       unequal, so they must not share a target.
                                    2. OPENING THE CARD IS THE CONFIRMATION A DESKTOP DOESN'T NEED.
                                       It shows the $150.00 about to be recorded before the tap that
                                       records it. The phone's job here is one family at practice,
                                       not a reconciliation session — two taps is not the cost, and
                                       the second tap is the one that removes doubt.
                                    An icon would also be undefended here: no hover, no pointer, no
                                    tooltip. There is room for the label, so it gets the label. */}
                                <div className={styles.duesCardFoot}>
                                  <span style={{ flex: 1, minWidth: 0 }}><LedgerNote inst={inst} row={row} /></span>
                                  {!inst.paidAt && moneyCanWrite && row.owing > 0.005 && (
                                    <button
                                      className={`${styles.btnSecondary} ${styles.compactAction}`}
                                      disabled={!!marking[inst.id]}
                                      onClick={() => markPaid(selected, inst, row.owing)}
                                      aria-label={`${row.partial ? MARK_PAID_REST_LABEL : MARK_PAID_LABEL}: ${fmt(row.owing)}, dated today, installment ${inst.installmentNumber}`}
                                    >
                                      {marking[inst.id] ? '…' : row.partial ? MARK_PAID_REST_LABEL : MARK_PAID_LABEL}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </details>
                          );
                        })}
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
                              {/* ⚠ EDIT BEFORE DELETE, and it is the reason this row stopped being
                                  a dead end. Until now the ONLY correction was Delete, so fixing a
                                  typo'd amount meant destroying a receipt and re-typing all four
                                  fields — a coach one slip away from losing the note and the real
                                  arrival date. What the server does is still a void-and-re-post
                                  (a posted entry is never rewritten); what the coach does is fix
                                  the number. */}
                              {moneyCanWrite && (
                                <button
                                  className={styles.rowIconBtn}
                                  style={{ flexShrink: 0 }}
                                  disabled={deletingPaymentId === pm.id || paySaving}
                                  onClick={() => openEditPayment(pm)}
                                  title={`Edit this ${fmt(pm.amount)} payment`}
                                  aria-label={`Edit the ${fmt(pm.amount)} payment received ${fmtDate(pm.receivedDate)}`}
                                >
                                  <Pencil size={13} aria-hidden />
                                </button>
                              )}
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
                              {/* Money OUT — the brackets are the arithmetic, not an alarm. */}
                              <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.75))', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {fmt(-po.amount)}
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
                            onClick={() => { closeMoneySheets(); setAddingCredit(true); setCreditForm(BLANK_CREDIT_FORM); }}
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
                              {/* ⚠ FIXED ONCE SET. The type is PROVENANCE — where this money came
                                  from — and the server ignores it on a correction for that reason.
                                  A contribution that becomes a fundraiser rebate by retyping is a
                                  credit whose story matches no record anywhere. Wrong type ⇒
                                  remove it and add the right one, which is one extra step and
                                  leaves the books honest. Disabled rather than hidden, so the
                                  coach can still SEE what kind of credit they are correcting. */}
                              <select
                                className={styles.input}
                                value={creditForm.creditType}
                                disabled={!!editingCreditId}
                                title={editingCreditId ? 'The kind of credit cannot be changed — remove it and add the right kind' : undefined}
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
                            <button className={styles.btnGhost} onClick={() => closeMoneySheets()} style={{ fontSize: '0.8rem' }}>Cancel</button>
                            <button className={styles.btnPrimary} disabled={creditSaving} onClick={saveCredit} style={{ fontSize: '0.8rem' }}>
                              {creditSaving ? 'Saving…' : editingCreditId ? 'Save changes' : 'Save Credit'}
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
                              {/* A credit reduces the bill, so it reads negative — and the FORMATTER
                                  draws that. This hand-wrote a dash in front of a positive number,
                                  which was consistent until brackets arrived (2026-08-14) and left
                                  one credit line saying "-$50.00" two rows from another saying
                                  "($50.00)". */}
                              <span style={{ color: 'var(--success-light)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {fmt(-(c.amount as number))}
                              </span>
                              <span style={{ flex: 1, color: 'var(--home-ink-soft, rgba(255,255,255,0.75))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.description}
                              </span>
                              <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', fontSize: '0.75rem', flexShrink: 0 }}>
                                {CREDIT_TYPE_LABELS[c.creditType]} · {fmtDate(c.creditDate as string)}
                              </span>
                              {/* ⚠ EDIT ONLY WHAT THE COACH AUTHORED. A credit carrying a
                                  fundraiser entry, a payment or an expense was CREATED BY that
                                  record, and that record states its amount — a rebate is raised ×
                                  rate, an overpayment is the payment's excess, a reimbursement is
                                  the out-of-pocket cost. Typing over any of them here would leave
                                  two disagreeing numbers with no way to tell which is true, and
                                  the next reconcile would quietly overwrite the coach's fix. Those
                                  are corrected where they are born; the row says so instead. */}
                              {c.fundraiserEntryId || c.expenseId ? (
                                <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', fontSize: '0.7rem', flexShrink: 0 }} title={c.fundraiserEntryId ? 'Set by the fundraiser that earned it — change it there' : 'Set by the out-of-pocket expense that created it — change it there'}>
                                  {c.fundraiserEntryId ? 'from fundraiser' : 'from expense'}
                                </span>
                              ) : !c.paymentId && (
                                <button
                                  className={styles.rowIconBtn}
                                  style={{ flexShrink: 0 }}
                                  disabled={creditSaving || deletingCreditId === c.id}
                                  onClick={() => openEditCredit(c)}
                                  title={`Edit this ${fmt(c.amount as number)} credit`}
                                  aria-label={`Edit the ${fmt(c.amount as number)} credit, ${c.description}`}
                                >
                                  <Pencil size={13} aria-hidden />
                                </button>
                              )}
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
      {/* ── Set refund — one family's choice (owner Call 10) ────────────────────────────────
          Four options, all BOUNDED. There is deliberately no free-text override of a refund
          TOTAL: that would let the rows stop adding up to the pot, which is the exact defect
          deriving the pot removed. A hand-set amount replaces a family's SHARE and never their
          owed-back money — that is theirs, not a distribution the coach can redirect. */}
      {choiceFor && settlement && (() => {
        const row = settlement.rows.find(r => r.playerId === choiceFor.playerId) ?? choiceFor;
        const name = [row.playerFirstName, row.playerLastName].filter(Boolean).join(' ');
        const evenTakers = settlement.rows.filter(r => r.choice === 'even').length;
        return (
          <div className={styles.modalOverlay} onClick={() => setChoiceFor(null)}>
            <div className={styles.modal} style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>Set refund — {name}</span>
                <button className={styles.modalCloseBtn} aria-label="Close" onClick={() => setChoiceFor(null)}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.9rem' }}>
                {([
                  ['even', 'An even share', row.choice === 'even'
                    ? `${fmt(row.refund)} — ${fmt(row.owedBack)} owed back plus one of ${evenTakers} shares`
                    : `Puts ${name} back in the split with everyone else`],
                  ['fixed', 'A set amount', 'Their owed-back money is paid either way; this replaces the share'],
                  ['no_share', 'No share — leave it to the team', 'The rest goes to the other families, raising every other share'],
                ] as Array<[typeof choiceKind, string, string]>).map(([value, title, sub]) => (
                  <button
                    key={value}
                    onClick={() => setChoiceKind(value)}
                    style={{
                      textAlign: 'left', padding: '0.6rem 0.8rem', borderRadius: 8, cursor: 'pointer',
                      background: choiceKind === value ? 'color-mix(in srgb, var(--success-light) 8%, transparent)' : 'var(--home-card, rgba(255,255,255,0.03))',
                      border: `1px solid ${choiceKind === value ? 'color-mix(in srgb, var(--success-light) 35%, transparent)' : 'var(--home-line, rgba(255,255,255,0.08))'}`,
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--home-ink, rgba(255,255,255,0.88))' }}>{title}</span>
                    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>{sub}</span>
                  </button>
                ))}
                {choiceKind === 'fixed' && (
                  <div>
                    <label className={styles.label}>Their share</label>
                    <input
                      className={styles.input}
                      type="number" min={0} step="0.01"
                      value={choiceAmount}
                      onChange={e => setChoiceAmount(e.target.value)}
                      style={{ maxWidth: 160 }}
                    />
                    <p className={styles.muted} style={{ fontSize: '0.74rem', margin: '0.3rem 0 0' }}>
                      Whatever this frees up goes straight to the other families — the sheet is never
                      left holding a remainder.
                    </p>
                  </div>
                )}
              </div>
              {/* Forgiving a balance is NOT one of the three above: it is a credit, and it changes
                  what the family owes rather than what they take. It sits here because this is
                  where a coach decides it. */}
              {row.leftToSend > 0.005 && (
                <div style={{ borderTop: '1px solid var(--home-line, rgba(255,255,255,0.08))', paddingTop: '0.7rem', marginBottom: '0.9rem' }}>
                  <p style={{ fontSize: '0.8rem', margin: '0 0 0.45rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>
                    {name} still has <strong>{fmt(row.leftToSend)}</strong> to send.
                  </p>
                  <button
                    className={styles.btnSecondary}
                    disabled={choiceSaving}
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => saveRowChoice(row.playerId, 'forgive')}
                  >
                    Forgive the {fmt(row.leftToSend)} balance
                  </button>
                  <p className={styles.muted} style={{ fontSize: '0.74rem', margin: '0.35rem 0 0' }}>
                    The team has genuinely given them that money, so it counts as their share, already
                    received — and their installments stop being chased.
                  </p>
                </div>
              )}
              {row.forgiven > 0.005 && (
                <div style={{ borderTop: '1px solid var(--home-line, rgba(255,255,255,0.08))', paddingTop: '0.7rem', marginBottom: '0.9rem' }}>
                  <p style={{ fontSize: '0.8rem', margin: '0 0 0.45rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>
                    {fmt(row.forgiven)} of this family&apos;s balance was forgiven.
                  </p>
                  <button
                    className={styles.btnGhost}
                    disabled={choiceSaving}
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => saveRowChoice(row.playerId, 'unforgive')}
                  >
                    Undo the forgiveness
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className={styles.btnGhost} onClick={() => setChoiceFor(null)}>Cancel</button>
                <button
                  className={styles.btnPrimary}
                  disabled={choiceSaving}
                  onClick={() => saveRowChoice(row.playerId, choiceKind, parseFloat(choiceAmount) || 0)}
                >
                  {choiceSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {reminderPreviewOpen && (
        <DuesReminderPreviewModal
          teamName={assignment?.teamName ?? ''}
          onClose={() => setReminderPreviewOpen(false)}
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
