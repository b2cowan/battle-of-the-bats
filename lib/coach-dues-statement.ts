/**
 * lib/coach-dues-statement.ts
 * The per-family dues statement — one household's money, assembled for paper. PURE, no I/O.
 *
 * PDF Export Quality Phase 2, Statements & handouts pass (owner picks 2026-08-23: the drawn
 * one-pager, reached from the player's drawer AND as a whole-team print run). The reader is a
 * PARENT, and two rules follow from that:
 *
 *   ⚠ ONE HOUSEHOLD'S CHILDREN AND NOBODY ELSE'S. Everything here is scoped to a single family
 *     group; no figure, name or status from any other family may appear. This is a privacy rule,
 *     not a taste call — it is the whole reason this document exists beside the team sheet.
 *
 *   ⚠ EVERY FIGURE IS THE DUES SCREEN'S OWN ARITHMETIC. Installment asks are the served
 *     `remainingAmount` (net of credits, remainders never face values — mig 232), the household
 *     roll-up is `computeFamilyDues` (the one grouping-and-naming home, shared with the season
 *     settlement), and money is spelled by the shared Money formatter. Nothing is re-derived.
 *
 * Sibling grouping rides `familyKey` — the dues payload's one-way hash of the normalized guardian
 * email — so it survives PII redaction: a money-cleared coach without the guardian-names grant
 * still gets ONE statement per household, addressed by the children's names (the `familyLabel`
 * seam handles that automatically because redacted surnames simply never arrive here).
 */
import { computeFamilyDues, type FamilyDuesPlayer } from './coach-family-dues';
import { formatMoneyCell as money } from './coach-money-exports';
import { formatStoredDate } from './timezone';
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from './types';
import { SCHEDULE_CHANGE_CREDIT_DESCRIPTION } from './dues-payments';

// ── Input: the dues payload, structurally ────────────────────────────────────
// These are the fields the coach dues GET already serves — the panel passes what it has.

export interface StatementInstallment {
  id: string;
  dueDate: string;
  amount: number;
  paidAt: string | null;
  /** NET ask: cash remainder − credits applied — what the family is asked to send. */
  remainingAmount?: number;
  creditApplied?: number;
  creditSettled?: boolean;
}

export interface StatementPlayerInput {
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  /** The dues payload's opaque household token; null when no guardian contact is recorded. */
  familyKey: string | null;
  /** Already redacted upstream for a coach without the PII grant. */
  guardianLastName: string | null;
  schedule: { totalAmount: number } | null;
  installments: StatementInstallment[];
  /** Per-installment CASH coverage — the "$200.00 of $300.00" figures. */
  coverage: { installmentId: string; allocated: number }[];
  payments: { amount: number; receivedDate: string; method: DuesPaymentMethod; note: string | null }[];
  credits: { amount: number; creditDate: string; description: string }[];
  payouts: { amount: number; paidDate: string; method: DuesPaymentMethod; note: string | null }[];
  paidAmount: number;
  outstanding: number;
  totalCredits: number;
  leftToSend: number;
  creditApplied: number;
  owedBack: number;
}

// ── Output: one statement per household, strings ready to draw ───────────────

export interface FamilyDuesStatement {
  /** Stable household identity — the family key, or `player:{id}` when there is none. */
  key: string;
  /** How a sentence names them: "the Marchands" / "Isla and Emmett's family". */
  label: string;
  /** How a filename or continuation header names them: "Marchand family" / "Isla and Emmett". */
  receiptLabel: string;
  /** The children, as speech: "Isla and Emmett". */
  childrenLine: string;
  /** kebab-case of receiptLabel, for filenames. */
  fileSlug: string;
  /** True when the label came from the children's names (no guardian surname available) —
   *  the addressee line then skips the children, who would otherwise be named twice. */
  labelledByPlayer: boolean;
  paidUp: boolean;
  /** The headline band, pre-formatted. Credits read "—" when none. */
  stats: { billed: string; received: string; credits: string; leftToSend: string };
  /** "What's next" — sentences, in reading order. Never empty. */
  next: string[];
  /** One section per billed child: label + [Payment, Due date, Amount, Received, Credit,
   *  Still to send, Status] rows. */
  schedules: { label: string; rows: string[][] }[];
  /** [Date, Player, Amount, How it arrived, Note] — every recorded payment, oldest first. */
  payments: string[][];
  /** [Date, Player, Amount, Where it came from] — oldest first. */
  credits: string[][];
  /** [Date, Player, Amount, How, Note] — money handed back; section absent when empty. */
  payouts: string[][];
}

const CENT = 0.005;

/** "Maya" / "Maya and Dev" / "Maya, Dev and Sam". */
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family';

const dash = (n: number) => (n > CENT ? money(n) : '—');

/**
 * Assemble one statement per billed household, alphabetical by family name — the order a coach
 * hands them out in. Families with no dues arrangement at all do not get a statement; a family
 * with nothing left to pay gets a RECEIPT (the tone check: thanks, not a bill).
 */
export function buildFamilyDuesStatements(input: {
  players: StatementPlayerInput[];
  /** Today, `YYYY-MM-DD`, in the org's zone — same semantics as the dues screen. */
  todayISO: string;
}): FamilyDuesStatement[] {
  const { players, todayISO } = input;

  // The one grouping-and-naming home (shared with the season settlement sheet).
  const rollupPlayers: FamilyDuesPlayer[] = players.map(p => ({
    playerId: p.playerId,
    playerName: [p.playerFirstName, p.playerLastName].filter(Boolean).join(' '),
    guardianKey: p.familyKey,
    guardianLastName: p.guardianLastName,
    outstanding: p.outstanding,
    leftToSend: p.leftToSend,
    installments: p.installments.map(i => ({
      dueDate: i.dueDate, amount: i.amount, paidAt: i.paidAt, remainingAmount: i.remainingAmount,
    })),
  }));
  const rollup = computeFamilyDues({ players: rollupPlayers, todayISO });

  const byId = new Map(players.map(p => [p.playerId, p]));

  const statements = [...rollup.owing, ...rollup.paidUp].map(group => {
    const members = groupPlayerIds(group.key, players)
      .map(id => byId.get(id))
      .filter((p): p is StatementPlayerInput => !!p);

    // First names carry the sections; a duplicated first name keeps its surname so two siblings
    // called after the same grandparent stay two rows.
    const firstNames = members.map(p => p.playerFirstName);
    const displayName = (p: StatementPlayerInput) =>
      firstNames.filter(n => n === p.playerFirstName).length > 1
        ? [p.playerFirstName, p.playerLastName].filter(Boolean).join(' ')
        : p.playerFirstName;

    const billed = members.reduce((s, p) => s + (p.schedule?.totalAmount ?? 0), 0);
    const received = members.reduce((s, p) => s + p.paidAmount, 0);
    const credits = members.reduce((s, p) => s + p.totalCredits, 0);
    const creditApplied = members.reduce((s, p) => s + p.creditApplied, 0);
    const owedBack = members.reduce((s, p) => s + p.owedBack, 0);
    const leftToSend = group.outstanding;
    const childrenLine = joinNames(members.map(displayName));

    // ── "What's next", in sentences ─────────────────────────────────────────
    const next: string[] = [];
    const overdue = group.unpaid.filter(u => u.overdue);
    const upcoming = group.unpaid.filter(u => !u.overdue);
    if (overdue.length === 1) {
      next.push(`${money(overdue[0].amount)} of the ${formatStoredDate(overdue[0].dueDate)} installment is still open.`);
    } else if (overdue.length > 1) {
      const total = Math.round(overdue.reduce((s, u) => s + u.amount, 0) * 100) / 100;
      next.push(`${money(total)} from ${overdue.length} earlier installments is still open.`);
    }
    if (upcoming.length > 0) {
      const dueDate = upcoming[0].dueDate; // earliest — group.unpaid is sorted by due date
      const atDate = upcoming.filter(u => u.dueDate === dueDate);
      const amt = Math.round(atDate.reduce((s, u) => s + u.amount, 0) * 100) / 100;
      const isLast = upcoming.every(u => u.dueDate === dueDate);
      const contributors = new Set(atDate.map(u => u.playerId)).size;
      const across = contributors === 2 ? ' across both players' : contributors > 2 ? ` across ${contributors} players` : '';
      next.push(`The ${isLast ? 'last' : 'next'} payment — ${money(amt)}${across} — falls due ${formatStoredDate(dueDate)}.`);
    }
    if (creditApplied > CENT) {
      next.push(`Credits of ${money(creditApplied)} have already been applied for you.`);
    }
    if (owedBack > CENT) {
      next.push(`${money(owedBack)} in credit is set aside for your family — your coach can hand it back or apply it.`);
    }
    if (next.length === 0) {
      next.push(`Nothing — ${childrenLine}’s dues are fully paid. Thank you!`);
    }

    // ── The record: per-child schedules, then receipts ──────────────────────
    const schedules = members
      .filter(p => p.installments.length > 0)
      .map(p => {
        const cashById = new Map(p.coverage.map(c => [c.installmentId, c.allocated]));
        const ordered = [...p.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const rows = ordered.map((inst, i) => {
          const ask = inst.remainingAmount ?? inst.amount;
          const status = inst.paidAt
            ? `Paid ${formatStoredDate(inst.paidAt)}`
            : ask <= CENT
              ? 'Covered by credit'
              : inst.dueDate && inst.dueDate < todayISO
                ? 'Still open'
                : 'Upcoming';
          return [
            `${i + 1} of ${ordered.length}`,
            formatStoredDate(inst.dueDate),
            money(inst.amount),
            dash(cashById.get(inst.id) ?? 0),
            dash(inst.creditApplied ?? 0),
            inst.paidAt ? '—' : dash(ask),
            status,
          ];
        });
        const label = p.leftToSend > CENT
          ? `${displayName(p)} — ${money(p.leftToSend)} to send`
          : `${displayName(p)} — paid in full`;
        return { label, rows };
      });

    const methodLabel = (m: DuesPaymentMethod) => DUES_PAYMENT_METHOD_LABEL[m] ?? m;
    const paymentRows = members
      .flatMap(p => p.payments.map(pay => ({ child: displayName(p), ...pay })))
      .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate))
      .map(pay => [formatStoredDate(pay.receivedDate), pay.child, money(pay.amount), methodLabel(pay.method), pay.note ?? '']);
    const creditRows = members
      .flatMap(p => p.credits.map(c => ({ child: displayName(p), ...c })))
      .sort((a, b) => a.creditDate.localeCompare(b.creditDate))
      // The engine's follows-the-schedule credit has no single day — its stored date moves to
      // the last schedule change, and printing THAT reads as when the money arose (review
      // 2026-09-01; same ruling that keeps the drawer's row dateless).
      .map(c => [c.description === SCHEDULE_CHANGE_CREDIT_DESCRIPTION ? '—' : formatStoredDate(c.creditDate), c.child, money(c.amount), c.description || '']);
    const payoutRows = members
      .flatMap(p => p.payouts.map(po => ({ child: displayName(p), ...po })))
      .sort((a, b) => a.paidDate.localeCompare(b.paidDate))
      .map(po => [formatStoredDate(po.paidDate), po.child, money(po.amount), methodLabel(po.method), po.note ?? '']);

    return {
      key: group.key,
      label: group.label,
      receiptLabel: group.receiptLabel,
      childrenLine,
      fileSlug: slug(group.receiptLabel),
      labelledByPlayer: group.labelledByPlayer,
      paidUp: !(leftToSend > CENT),
      stats: {
        billed: money(billed),
        received: money(received),
        credits: credits > CENT ? money(credits) : '—',
        leftToSend: money(Math.max(leftToSend, 0)),
      },
      next,
      schedules,
      payments: paymentRows,
      credits: creditRows,
      payouts: payoutRows,
    };
  });

  return statements.sort((a, b) => a.receiptLabel.localeCompare(b.receiptLabel));
}

/**
 * The player ids that belong to one rollup group, in the group's own member order. The rollup
 * carries names, not ids, so this re-derives membership by the same key rule it used —
 * deliberately the SAME line of code shape (`guardianKey ?? player:{id}`), kept adjacent to the
 * one call site that needs it.
 */
function groupPlayerIds(groupKey: string, players: StatementPlayerInput[]): string[] {
  return players
    .filter(p => (p.familyKey ?? `player:${p.playerId}`) === groupKey)
    .filter(p => (p.installments?.length ?? 0) > 0 || (p.outstanding ?? 0) > 0)
    .map(p => p.playerId);
}
