/**
 * The roster-wide dues run's EXCEPTIONS, derived once (owner ruling 2026-09-01 — "Exceptions
 * First", mockup artifact 4f742ce0).
 *
 * "Set dues for all players" writes the same schedule for every active player, and for most of
 * them that is the whole story. This file answers the other question — WHO does this run treat
 * differently, and what happens to them — for the two screens that must never disagree about it:
 * the preview a coach reads, and the write that follows.
 *
 * ⚠ PURE ON PURPOSE, like its two siblings (dues-payments, dues-credits). Nothing here touches a
 * database and no arithmetic is invented: the overpayment delta comes from
 * `planOverpaymentReconcile`, the refusal from `projectScheduleTotalChange` +
 * `payoutFloorViolation`. This file JOINS the existing answers per player; it does not compute a
 * second copy of any of them. That rule is why the preview's dollars and the run's dollars are
 * the same dollars rather than two computations that agree until they don't.
 *
 * ⚠ THE SHAPE COMPARISON MOVED HERE FROM THE WRITE ROUTE, AND ITS REASONING CAME WITH IT — read
 * `describeExistingSchedules` before touching it. Before this file the comparison lived inside
 * `generate-installments/route.ts` and the preview had no idea who was hand-set, so the coach met
 * that question only AFTER pressing the button. Two copies of it would have been worse than one
 * late one: the preview would name a set of players and the write would flatten a different set.
 */
import { planOverpaymentReconcile } from './dues-payments';
import { payoutFloorViolation, projectScheduleTotalChange } from './dues-credit-guards';

/** One existing installment row, as both the preview and the write read them. */
export interface ExistingInstallmentRow {
  playerId: string;
  installmentNumber: number;
  amount: number;
  /** YYYY-MM-DD. */
  dueDate: string;
}

/** The stored row, exactly as `rep_player_dues_installments` returns it. */
export interface StoredInstallmentRow {
  player_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
}

/**
 * The one place the stored column names become this module's names.
 *
 * ⚠ IT LIVES HERE FOR THE SAME REASON THE SHAPE COMPARISON DOES. Both routes read these rows and
 * both feed them to the functions below; written out at each call site — which it was — a column
 * rename has two places to find, and the second one is in the file nobody opens.
 */
export function toExistingInstallmentRows(
  rows: readonly StoredInstallmentRow[] | null | undefined,
): ExistingInstallmentRow[] {
  return (rows ?? []).map(r => ({
    playerId:          r.player_id,
    installmentNumber: r.installment_number,
    amount:            Number(r.amount),
    dueDate:           r.due_date,
  }));
}

/** A player's existing schedule, summarised for the sentence that describes it. */
export interface ExistingScheduleSummary {
  /** What their current plan collects in total. */
  total: number;
  /** How many dated pieces it is cut into. */
  dateCount: number;
}

export interface ExistingSchedulesVerdict {
  /** Players whose schedule is NOT the one most of the roster shares — a per-player arrangement. */
  handSetPlayerIds: Set<string>;
  /** Every player who has a schedule at all, with its total and how many dates it holds. */
  summaryByPlayer: Map<string, ExistingScheduleSummary>;
  /** True when any installment row exists — the run REPLACES rather than creates. */
  hasExistingDues: boolean;
}

/**
 * ⚠ "HAND-SET" IS DECIDED BY COMPARING PLAYERS TO EACH OTHER, **NEVER** BY `source`.
 *
 * `source` looks like the answer and is not (/review 2026-08-14, Critical). The column DEFAULTS
 * to `manual`, and `replaceRepDuesInstallments` — which never sets it — is called by two
 * automated paths as well as the per-player editor:
 *   • SEASON ROLLOVER's carry-fees step, which is **on by default**, and
 *   • the free→Premium upgrade migration.
 * So the morning after a routine rollover, every player on the roster reads `manual` though
 * nobody edited anything. The screen would have named the WHOLE ROSTER as "schedules you set by
 * hand" and offered to skip them all — one click and the coach's team-wide date fix would have
 * applied to nobody. Worse, a coach who learns the list is usually noise stops reading it, which
 * is precisely when it finally names a real hardship arrangement.
 *
 * The shape comparison needs no column, no migration and no backfill, and it models the thing
 * actually at risk: a player whose amounts/dates differ from what everyone else has is the one a
 * team-wide run would flatten. A uniform roster — carried forward, migrated, or generated — flags
 * nobody, which is the correct answer for all three.
 */
export function describeExistingSchedules(
  rows: readonly ExistingInstallmentRow[],
): ExistingSchedulesVerdict {
  const parts = new Map<string, string[]>();
  const summaryByPlayer = new Map<string, ExistingScheduleSummary>();
  for (const r of rows) {
    const list = parts.get(r.playerId);
    const piece = `${r.installmentNumber}:${Number(r.amount).toFixed(2)}:${r.dueDate}`;
    if (list) list.push(piece); else parts.set(r.playerId, [piece]);
    const summary = summaryByPlayer.get(r.playerId);
    const amount = Math.round(Number(r.amount) * 100);
    if (summary) {
      summary.total = Math.round(summary.total * 100 + amount) / 100;
      summary.dateCount += 1;
    } else {
      summaryByPlayer.set(r.playerId, { total: amount / 100, dateCount: 1 });
    }
  }

  const shapeByPlayer = new Map<string, string>();
  const shapeCounts = new Map<string, number>();
  for (const [playerId, pieces] of parts) {
    const shape = [...pieces].sort().join('|');
    shapeByPlayer.set(playerId, shape);
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
  }

  // The roster's common schedule = the shape the most players share. Ties break on the shape
  // string so the answer is stable across runs rather than depending on row order.
  let commonShape: string | null = null;
  let commonCount = 0;
  for (const [shape, count] of [...shapeCounts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > commonCount) { commonShape = shape; commonCount = count; }
  }

  const handSetPlayerIds = new Set<string>();
  for (const [playerId, shape] of shapeByPlayer) {
    if (shape !== commonShape) handSetPlayerIds.add(playerId);
  }

  return { handSetPlayerIds, summaryByPlayer, hasExistingDues: rows.length > 0 };
}

/**
 * Whose families would be told a due date they have not been told before.
 *
 * ⚠ Guarded on a non-empty proposal: an empty one matches nothing and would report every family's
 * dates as moving.
 */
export function playersWithDateChange(
  rows: readonly ExistingInstallmentRow[],
  newDueDates: readonly string[],
): Set<string> {
  const moved = new Set<string>();
  if (newDueDates.length === 0) return moved;
  const dates = new Set(newDueDates);
  for (const r of rows) if (!dates.has(r.dueDate)) moved.add(r.playerId);
  return moved;
}

/** One player the run does not treat like everybody else. */
export interface DuesRunException {
  playerId: string;
  /** Display only — names collide (twins, two "Unnamed player" rows). The id is the identity. */
  name: string;
  /**
   * `blocked` — the payout floor refuses this family; the run completes without them.
   * `warn`     — a schedule set by hand that this run would flatten (the keep-checkbox's subject).
   * `plain`    — money already recorded, re-applying to the new plan.
   */
  tone: 'plain' | 'warn' | 'blocked';
  /** Dollars already recorded against this player this season (0 when none). */
  paymentsTotal: number;
  /** NEW overpayment credit this run would create for them (0 when none). From the reconcile
   *  planner itself, never re-derived — the credit engine consolidates, so "payments beyond the
   *  new total" and "credit created now" are genuinely different figures. */
  creditCreated: number;
  /** Their existing per-player arrangement, when `tone` is `warn`. */
  handSet: ExistingScheduleSummary | null;
  /** Dollars already handed back in cash, when `tone` is `blocked`. Feeds `payoutFloorMessage`. */
  paidOut: number | null;
}

/* ⚠ NO PER-ROW `dateChange` FLAG, DELIBERATELY. A team-wide date fix moves EVERYBODY's dates, so a
   row per moved family would print twelve names to say one thing — the wall this screen exists to
   pull down. Moved dates travel as `dateChangePlayerIds` instead: ids rather than a count, so the
   screen's "N families' due dates change" can follow the keep-checkbox without another round trip. */

export interface DuesRunPlanInput {
  /** Active roster, in the order the screen should read them. */
  players: readonly { id: string; name: string }[];
  /** What every player is being given, per player, in total. */
  newScheduleTotal: number;
  /** The due dates this run would write. */
  newDueDates: readonly string[];
  /** Every existing installment row for the season. */
  existingRows: readonly ExistingInstallmentRow[];
  /** Recorded payment dollars per player. */
  paymentTotals: ReadonlyMap<string, number>;
  /** Every credit each family holds, newest first — the shape `planOverpaymentReconcile` wants. */
  creditsByPlayer: ReadonlyMap<string, readonly { id: string; amount: number; creditType: string; consolidatable?: boolean }[]>;
  /** Cash already handed back, per family. */
  payoutsByPlayer: ReadonlyMap<string, readonly { amount: number }[]>;
}

export interface DuesRunPlan {
  exceptions: DuesRunException[];
  /** Players the payout floor would refuse — excluded from what the button promises. */
  blockedPlayerIds: string[];
  /** Per-player arrangements this run would flatten — the keep-checkbox's subjects. */
  handSetPlayerIds: string[];
  /** Everyone whose dates move, kept as ids so the count can follow the keep-checkbox exactly. */
  dateChangePlayerIds: string[];
  hasExistingDues: boolean;
}

/**
 * The whole exceptions verdict for one bulk run — the preview's payload and the write's own
 * expectations, from one derivation.
 *
 * ⚠ BLOCKED OUTRANKS HAND-SET OUTRANKS PAID, and the order matters for more than colour: the
 * write route refuses a floor-violating family BEFORE it looks at anything else and leaves their
 * old schedule standing, so a blocked player's credit delta and hand-set status are facts about a
 * run that will not touch them. The row states the refusal and stops.
 */
export function planRosterDuesRun(input: DuesRunPlanInput): DuesRunPlan {
  const { players, newScheduleTotal, newDueDates, existingRows,
          paymentTotals, creditsByPlayer, payoutsByPlayer } = input;

  const { handSetPlayerIds, summaryByPlayer, hasExistingDues } = describeExistingSchedules(existingRows);
  const dateMoved = playersWithDateChange(existingRows, newDueDates);

  const exceptions: DuesRunException[] = [];
  const blockedPlayerIds: string[] = [];

  for (const player of players) {
    const paymentsTotal = paymentTotals.get(player.id) ?? 0;
    const credits       = creditsByPlayer.get(player.id) ?? [];
    const payouts       = payoutsByPlayer.get(player.id) ?? [];
    const handSet       = handSetPlayerIds.has(player.id) ? summaryByPlayer.get(player.id) ?? null : null;

    /* Door 6 of the payout floor (lib/dues-credit-guards.ts), asked here exactly as the write
       route asks it — same projection, same guard, same dollars. Only a family that has been
       handed cash can reach it at all.

       ⚠ THE WRITE ROUTE STILL RUNS ITS OWN COPY OF THIS LOOP, AND THAT IS NOT AN OVERSIGHT — do
       not "simplify" it into a call to this function. It asks the floor with a PER-PLAYER total
       (`overrides` in its request body), and `newScheduleTotal` here is one figure for the whole
       roster. Folding the two together would either drop override support silently or widen this
       module's contract for a caller that does not exist yet. The arithmetic underneath — the
       projection and the guard — is already shared, which is the part that could actually drift. */
    let paidOut: number | null = null;
    if (payouts.length > 0) {
      const violation = payoutFloorViolation(
        projectScheduleTotalChange({ familyCredits: credits, paymentsTotal, newScheduleTotal }),
        payouts,
      );
      if (violation) paidOut = violation.paidOut;
    }

    if (paidOut != null) {
      blockedPlayerIds.push(player.id);
      exceptions.push({
        playerId: player.id, name: player.name, tone: 'blocked',
        paymentsTotal, creditCreated: 0, handSet, paidOut,
      });
      continue;
    }

    // The credit the run would actually CREATE for them — the planner's own figure, on the
    // schedule-change path (consolidate: the engine tops its one row up rather than appending).
    const creditCreated = paymentsTotal > 0
      ? planOverpaymentReconcile(credits, paymentsTotal, newScheduleTotal, { consolidate: true }).create
      : 0;

    if (handSet) {
      exceptions.push({
        playerId: player.id, name: player.name, tone: 'warn',
        paymentsTotal, creditCreated, handSet, paidOut: null,
      });
      continue;
    }

    if (paymentsTotal > 0.005) {
      exceptions.push({
        playerId: player.id, name: player.name, tone: 'plain',
        paymentsTotal, creditCreated, handSet: null, paidOut: null,
      });
    }
  }

  // Both lists are narrowed to the ACTIVE roster: a player who left the team mid-season keeps
  // their installment rows (the season's record), and naming them here would offer the coach a
  // decision about somebody this run cannot touch.
  const onRoster = new Set(players.map(p => p.id));
  return {
    exceptions,
    blockedPlayerIds,
    handSetPlayerIds: [...handSetPlayerIds].filter(id => onRoster.has(id)),
    dateChangePlayerIds: [...dateMoved].filter(id => onRoster.has(id)),
    hasExistingDues,
  };
}
