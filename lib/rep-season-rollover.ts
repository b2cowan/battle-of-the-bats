import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import {
  updateRepProgramYear,
  getRepProgramYears,
  getRepRosterPlayers,
  createRepRosterPlayer,
  getRepTeamCoachForUserYear,
  suggestContinuityLinksBulk,
} from './db';
import { addStaffMember, projectMembershipsOntoProgramYear } from './coach-membership';
import { seasonClosingCashCents } from './coach-register-book';
import { openingBalanceFor, carriesProvenance, type SeasonCarryChoice } from './season-carry';
import { createRepPlayerDuesSchedule, replaceRepDuesInstallments } from './db';
import type { RepProgramYear } from './types';

/**
 * Coach Premium — Phase 5: "Start next season" for a standalone Premium coach.
 *
 * Rolls a team into a NEW rep_program_years season WITHOUT an org admin (today admin-only).
 * Per the locked owner decisions (docs/projects/active/COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md):
 *
 * - The ACTIVE roster always carries forward (the coach prunes/adds after).
 * - The coach OPTIONALLY carries (a) a fee template (prior dues structure, paid state stripped) and
 *   (b) the previous season's PLANNED budget (line items + periods + the budget envelope). The
 *   SCHEDULE starts fresh; actual spending / dues payments / paid history do NOT carry.
 * - The previous season becomes READ-ONLY history (status -> 'completed').
 *
 * Shape mirrors lib/coach-upgrade-migration.ts: the structural swap (new active season + coach
 * assignments + active-pointer) is the critical core (revert + throw on failure so the coach is never
 * stranded); the data carry is per-entity best-effort and surfaced in the returned summary, never thrown.
 *
 * No schema change: every operation uses existing tables/columns and existing lib/db.ts helpers.
 */

export type RepSeasonRolloverSummary = {
  ok: boolean;
  newSeason: { id: string; name: string; year: number };
  previousSeason: { id: string; name: string; year: number };
  coaches: { copied: number };
  roster: { copied: number; failed: number };
  budget: { carried: boolean; linesCopied: number; periodsCopied: number; failed: number };
  fees: { carried: boolean; playersCopied: number; failed: number; dueDatesShifted: boolean };
  /**
   * What the new season OPENS with (mig 262) — the closing season's own cash, carried forward.
   *
   * ⚠ THE AMOUNT IS THE SERVER'S, NOT THE DIALOG'S, and it is reported back so the coach can see
   * which figure actually landed. The browser showed a number when the form was drawn; the season
   * starts on the one computed at the moment it was created.
   */
  openingBalance: { carried: boolean; amount: number };
  notes: string[];
  warnings: string[];
};

/* ⚠ THE CARRY DECISION AND ITS TYPE LIVE IN `lib/season-carry.ts`, NOT HERE — this module imports
   `server-only` and touches the database, so anything defined in it is unreachable from a unit
   test, which is exactly how its failure path shipped wrong. That module's header carries the whole
   story. Re-exported so every existing importer of `SeasonCarryChoice` keeps working. */
export type { SeasonCarryChoice } from './season-carry';

export class SeasonRolloverError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'SeasonRolloverError';
    this.code = code;
    this.status = status;
  }
}

/** Shift a 'YYYY-MM-DD' date forward by `delta` years, clamping Feb 29 -> Feb 28 in non-leap years.
 *  Carried fee/budget dates are otherwise absolute and would land in the past on a season roll. */
function shiftDateYears(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const newYear = y + delta;
  const daysInMonth = new Date(newYear, m, 0).getDate(); // m is 1-based; day 0 = last day of month m
  const newDay = Math.min(d, daysInMonth);
  return `${newYear}-${String(m).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
}

/** Best-effort rollback of a half-created new season (delete coach rows, then the empty year). */
async function cleanupNewSeason(newSeasonId: string, coachIds: string[]): Promise<void> {
  try {
    if (coachIds.length > 0) {
      await supabaseAdmin.from('rep_team_coaches').delete().in('id', coachIds);
    }
    await supabaseAdmin.from('rep_program_years').delete().eq('id', newSeasonId);
  } catch (e) {
    console.error('[rep-season-rollover] cleanup of half-created season failed:', e);
  }
}

export async function startNextRepSeason(params: {
  orgId: string;
  teamId: string;
  workspaceId: string | null;
  currentSeason: RepProgramYear;
  initiatorUserId: string;
  newName: string;
  newYear: number;
  carryBudget: boolean;
  carryFees: boolean;
  /** What to do with the money the closing season is holding (mig 262). Absent ⇒ carry nothing,
   *  which is what every roll did before this existed. */
  carryCash?: SeasonCarryChoice;
}): Promise<RepSeasonRolloverSummary> {
  const { orgId, teamId, workspaceId, currentSeason, initiatorUserId, newName, newYear, carryBudget, carryFees } = params;
  const carryCash: SeasonCarryChoice = params.carryCash ?? { mode: 'none' };

  const summary: RepSeasonRolloverSummary = {
    ok: true,
    newSeason: { id: '', name: newName, year: newYear },
    previousSeason: { id: currentSeason.id, name: currentSeason.name, year: currentSeason.year },
    coaches: { copied: 0 },
    roster: { copied: 0, failed: 0 },
    budget: { carried: carryBudget, linesCopied: 0, periodsCopied: 0, failed: 0 },
    fees: { carried: carryFees, playersCopied: 0, failed: 0, dueDatesShifted: false },
    openingBalance: { carried: false, amount: 0 },
    notes: [],
    warnings: [],
  };

  const delta = newYear - currentSeason.year;
  let dataIssue = false; // set when a whole data-carry pass (roster/budget/fees) fails — flips summary.ok

  // ── Pre-checks ────────────────────────────────────────────────────────────
  const existing = await getRepProgramYears(teamId);
  if (existing.some(y => y.year === newYear)) {
    throw new SeasonRolloverError('year_exists', 409, `A ${newYear} season already exists for this team. Pick a different year.`);
  }
  // Self-heal a prior partial roll: complete any open season that isn't the current one. A standalone
  // team has no other legitimate open season, so a leftover 'active'/'draft' row is the residue of an
  // earlier attempt that failed on its last step — completing it restores the single-open invariant
  // and prevents a transient failure from permanently blocking future rolls.
  const staleOpen = existing.filter(
    y => (y.status === 'draft' || y.status === 'active') && y.id !== currentSeason.id,
  );
  for (const stale of staleOpen) {
    try {
      await updateRepProgramYear(stale.id, { status: 'completed' });
    } catch (e) {
      console.error('[rep-season-rollover] could not auto-complete a stale open season:', e);
    }
  }

  /* ── What the new season opens with (mig 262, owner ruling 2026-08-23) ──────────────────────
     ⚠⚠ COMPUTED BEFORE THE INSERT AND WRITTEN WITH IT, in one statement, so a season can never
     exist for a moment holding money it was not given — nothing else in this function is allowed to
     see a half-carried year either.
     ⚠⚠ AND COMPUTED FROM THE REGISTER'S OWN WALK, never from the figure the dialog displayed. That
     is the difference between a number a coach saw and a number the team had; this one is written
     to the database and corrected afterwards only by hand.
     ⚠ A FAILURE HERE DOES NOT STOP THE ROLL. Starting next season is the ordinary thing to do at
     the end of a year, and refusing it because a cash read stumbled would be the product holding a
     season hostage to a figure the coach can type in Team settings in ten seconds. It warns, in the
     same voice unsettled money does.

     ⚠⚠ AND A FAILURE CARRIES **NOTHING**, NEVER ZERO — `null` is the initial value for exactly that
     reason (fixed 2026-08-25 by `/review` during money centralization P3; the bug is written up in
     Owner QA §104). This started at `0` and the catch only logged, so a transient read error fell
     through to `openingBalance = 0` — which is not merely a wrong figure, it is a wrong FACT: the
     provenance stamp below fires on `openingBalance !== null`, so the new season was recorded as
     *"carried from the 2025 Season: $0.00"*, confidently and permanently, for a team that may have
     closed holding thousands. The modal's warning is shown once and then gone; the false record is
     not, and it reads back on the register's first line, on Budget vs. Actual and in Team settings.
     ⚠ That is this file's own rule below — *null is not zero* — losing on the one path where it
     mattered most. A `catch` that leaves a money variable at its initialiser is how a failure gets
     promoted to a measurement: initialise to the value that means "we do not know". */
  /** null = we do not know what it closed at. NEVER "it closed at zero" — see `openingBalanceFor`. */
  let closingCents: number | null = null;
  if (carryCash.mode === 'all') {
    try {
      closingCents = await seasonClosingCashCents(currentSeason, teamId);
    } catch (e) {
      console.error('[rep-season-rollover] closing cash read failed; carrying nothing:', e);
      summary.warnings.push(
        'We could not work out what the last season closed with, so the new season starts with '
        + 'nothing carried forward. Set it under Team settings → Money.');
    }
  }
  /* ⚠ NULL, NOT ZERO, WHEN NOTHING WAS CARRIED. A season that starts at zero because nobody carried
     anything shows no opening line on the register or the report; one deliberately carried at $0
     shows a line saying so. Same number, different facts — decided in ONE tested place. */
  const openingBalance = openingBalanceFor(carryCash, closingCents);

  // ── Critical core: new active season + coaching access (revert + throw on failure) ──
  // Insert the season already-active in ONE statement (no draft->active window that could strand a
  // half-created year and block retries via the duplicate-year guard).
  let newSeason: { id: string };
  const createdCoachIds: string[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('rep_program_years')
      .insert({
        org_id: orgId, team_id: teamId, name: newName, year: newYear, status: 'active',
        tryout_open: false,
        opening_balance: openingBalance,
        /* The provenance the settings row and the register's first line read back. Null on a
           hand-typed amount: "carried from the 2026 Season" would be vouching for a figure the
           coach chose rather than one the season closed at.
           ⚠ AND NULL WHEN THE READ FAILED, which this expresses only because `openingBalance` is
           null on that path — see the block above. This line is what turns a wrong figure into a
           wrong CLAIM, so the two must be changed together or not at all. */
        opening_balance_from_year_id: carriesProvenance(carryCash, openingBalance)
          ? currentSeason.id : null,
      })
      .select('id')
      .single();
    if (error) throw error;
    newSeason = { id: data.id as string };
  } catch (e) {
    if ((e as { code?: string })?.code === '23505') {
      throw new SeasonRolloverError('year_exists', 409, `A ${newYear} season already exists for this team. Pick a different year.`);
    }
    console.error('[rep-season-rollover] create new season failed:', e);
    throw new SeasonRolloverError('create_failed', 500, 'Could not create the new season. Nothing was changed — please try again.');
  }
  summary.newSeason.id = newSeason.id;
  summary.openingBalance = { carried: openingBalance !== null, amount: openingBalance ?? 0 };

  try {
    // M1 (2026-08-16): the new season's staff RECORD is written from the team's MEMBERSHIPS —
    // role AND capability grants — not copied from last season's rows. This is the change that
    // ends the silent yearly reset of customized grants (rows used to be re-minted with NULL
    // capabilities) and it means a member added between seasons is not skipped. Access itself
    // never derives from these rows any more; they are the record + what the write routes read.
    let memberIds = await projectMembershipsOntoProgramYear(teamId, orgId, newSeason.id);
    if (memberIds.length === 0) {
      // The initiator reached this code as the team's head coach; a team with zero memberships is
      // a data gap (pre-M1 stragglers), and the roll must not strand them — mint theirs now.
      // addStaffMember also projects onto the live year, which IS the just-created active season,
      // so the row lands there; point-read it back for the rollback bookkeeping.
      await addStaffMember({ orgId, teamId, userId: initiatorUserId, coachRole: 'head_coach' });
      const initiatorRow = await getRepTeamCoachForUserYear(newSeason.id, initiatorUserId);
      memberIds = initiatorRow ? [initiatorRow.id] : [];
    }
    createdCoachIds.push(...memberIds);
  } catch (e) {
    console.error('[rep-season-rollover] coach assignment failed; rolling back new season:', e);
    await cleanupNewSeason(newSeason.id, createdCoachIds);
    throw new SeasonRolloverError('assign_failed', 500, 'Could not set up coaching access for the new season. Nothing was changed — please try again.');
  }
  summary.coaches.copied = createdCoachIds.length;

  // ── Re-point the workspace's active-season pointer (hygiene; non-blocking) ──
  if (workspaceId) {
    const { error } = await supabaseAdmin
      .from('team_workspaces')
      .update({ active_program_year_id: newSeason.id, updated_at: new Date().toISOString() })
      .eq('id', workspaceId);
    if (error) {
      console.error('[rep-season-rollover] active_program_year_id repoint failed (non-blocking):', error);
    }
  }

  // ── Roster carry (always): copy ACTIVE players; build old->new id map for the fee carry ──
  const playerIdMap = new Map<string, string>();
  try {
    const players = await getRepRosterPlayers(currentSeason.id);
    const active = players.filter(p => p.status === 'active');
    for (const p of active) {
      try {
        const created = await createRepRosterPlayer({
          programYearId: newSeason.id,
          teamId,
          orgId,
          source: 'admin_manual', // a season roll is a coach action, not a tryout conversion
          playerFirstName: p.playerFirstName,
          playerLastName: p.playerLastName,
          playerDateOfBirth: p.playerDateOfBirth,
          playerNumber: p.playerNumber,
          primaryPosition: p.primaryPosition,
          secondaryPosition: p.secondaryPosition,
          guardianFirstName: p.guardianFirstName,
          guardianLastName: p.guardianLastName,
          guardianEmail: p.guardianEmail,
          guardianPhone: p.guardianPhone,
          notes: p.notes,
          // Player-intrinsic profile fields persist across seasons (safety/handedness/size)
          medicalNotes: p.medicalNotes,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
          bats: p.bats,
          throws: p.throws,
          jerseySize: p.jerseySize,
          lineupProfile: p.lineupProfile, // Best/Okay/Never + pitcher/A-squad persist across seasons
          // adminNotes + tryoutRegistrationId intentionally dropped (stale staff/tryout provenance)
        });
        playerIdMap.set(p.id, created.id);
        summary.roster.copied++;
      } catch (e) {
        summary.roster.failed++;
        console.error('[rep-season-rollover] roster player carry failed:', e);
      }
    }
  } catch (e) {
    dataIssue = true;
    summary.warnings.push('The roster import hit a problem; some players may be missing from the new season.');
    console.error('[rep-season-rollover] roster carry pass failed:', e);
  }
  if (summary.roster.copied > 0) {
    summary.notes.push('Player waivers and documents are not carried — collect fresh ones for the new season.');
  }

  // ── Continuity links (Player Development 3D): the roll copied each row itself, so the
  // (new, old) pair is factual provenance — mint the history links CONFIRMED so every
  // carried player's profile shows their previous seasons (and the one-time carry-forward
  // offer) without a redundant "possible returning player — verify" step. Best-effort:
  // a failed mint warns, never fails the roll; the pair-unique index makes re-runs safe.
  if (playerIdMap.size > 0) {
    try {
      const minted = await suggestContinuityLinksBulk(
        [...playerIdMap.entries()].map(([oldId, newId]) => ({
          orgId,
          teamId,
          currentRosterId: newId,
          priorRosterId: oldId,
          confidence: 'high' as const,
        })),
        { status: 'confirmed', decidedBy: initiatorUserId },
      );
      if (minted.length > 0) {
        summary.notes.push('Each carried player’s history is linked to last season — look for the “bring forward” offer on their Development card.');
      }
    } catch (e) {
      summary.warnings.push('Player development history could not be linked automatically — the returning-player check on each profile will offer the link instead.');
      console.error('[rep-season-rollover] continuity link mint failed (non-blocking):', e);
    }
  }

  // ── Planned budget carry (optional): lines + periods + the legacy budget envelope ──
  if (carryBudget) {
    try {
      const { data: oldLines } = await supabaseAdmin
        .from('rep_budget_lines')
        .select('*')
        .eq('program_year_id', currentSeason.id)
        .eq('org_id', orgId)
        .order('sort_order');
      type BudgetLineRow = {
        id: string;
        category_id: string | null;
        item_id: string | null;
        description: string;
        total_amount: number;
        /** ⚠ Carried, never defaulted. Omitting it let the column default win, which silently
         *  reclassified every EXPECTED-FUNDING line as a COST in the new season — money the team
         *  planned to raise came back as money it planned to spend, doubling the season total and
         *  the dues generated from it, with nothing on screen to reveal it. A write path, so the
         *  damage was permanent and invisible without a DB audit. */
        line_kind: string | null;
        notes: string | null;
        sort_order: number;
      };
      type BudgetPeriodRow = {
        period_label: string;
        period_date: string | null;
        amount: number;
        sort_order: number;
      };
      for (const line of (oldLines ?? []) as BudgetLineRow[]) {
        try {
          const { data: newLine, error: lineErr } = await supabaseAdmin
            .from('rep_budget_lines')
            .insert({
              org_id: orgId,
              team_id: teamId,
              program_year_id: newSeason.id,
              category_id: line.category_id ?? null,
              item_id: line.item_id ?? null,
              description: line.description,
              total_amount: line.total_amount,
              line_kind: line.line_kind ?? 'cost',
              notes: line.notes ?? null,
              sort_order: line.sort_order ?? 0,
            })
            .select('id')
            .single();
          if (lineErr || !newLine) { summary.budget.failed++; continue; }
          summary.budget.linesCopied++;

          const { data: oldPeriods } = await supabaseAdmin
            .from('rep_budget_periods')
            .select('*')
            .eq('budget_line_id', line.id)
            .order('sort_order');
          const periodRows = ((oldPeriods ?? []) as BudgetPeriodRow[]).map(pd => ({
            budget_line_id: newLine.id as string,
            period_label: pd.period_label,
            period_date: pd.period_date ? shiftDateYears(pd.period_date, delta) : null,
            amount: pd.amount,
            sort_order: pd.sort_order ?? 0,
          }));
          if (periodRows.length > 0) {
            const { data: createdPeriods, error: pErr } = await supabaseAdmin
              .from('rep_budget_periods')
              .insert(periodRows)
              .select('id');
            if (pErr) summary.budget.failed++; // a line copied without its period breakdown — flag it, don't lose it silently
            else summary.budget.periodsCopied += createdPeriods?.length ?? 0;
          }
        } catch (e) {
          summary.budget.failed++;
          console.error('[rep-season-rollover] budget line carry failed:', e);
        }
      }

      // Carry the legacy single-number budget envelope too (still read by the /budget summary).
      if (currentSeason.budgetAmount != null) {
        await updateRepProgramYear(newSeason.id, { budgetAmount: currentSeason.budgetAmount });
      }
    } catch (e) {
      dataIssue = true;
      summary.warnings.push('The budget import hit a problem; some planned budget lines may be missing.');
      console.error('[rep-season-rollover] budget carry pass failed:', e);
    }
  }

  // ── Fee template carry (optional): prior per-player dues structure, paid state stripped ──
  if (carryFees) {
    try {
      const { data: oldSchedules } = await supabaseAdmin
        .from('rep_player_dues_schedules')
        .select('id, player_id, total_amount, notes')
        .eq('program_year_id', currentSeason.id)
        .eq('org_id', orgId);
      for (const sched of (oldSchedules ?? []) as Array<{ id: string; player_id: string; total_amount: number; notes: string | null }>) {
        const newPlayerId = playerIdMap.get(sched.player_id);
        if (!newPlayerId) continue; // player not carried (inactive/pruned) — their dues don't carry
        let createdScheduleId: string | null = null;
        try {
          const newSchedule = await createRepPlayerDuesSchedule({
            programYearId: newSeason.id,
            playerId: newPlayerId,
            teamId,
            orgId,
            totalAmount: sched.total_amount,
            notes: sched.notes,
          });
          createdScheduleId = newSchedule.id;
          const { data: oldInst } = await supabaseAdmin
            .from('rep_player_dues_installments')
            .select('installment_number, amount, due_date')
            .eq('schedule_id', sched.id)
            .order('installment_number');
          const installments = ((oldInst ?? []) as Array<{ installment_number: number; amount: number; due_date: string }>).map(i => ({
            installmentNumber: i.installment_number,
            amount: i.amount,
            dueDate: shiftDateYears(i.due_date, delta), // paid_at / reminders / ledger links all reset to null
          }));
          if (installments.length > 0) {
            await replaceRepDuesInstallments(newSchedule.id, newPlayerId, installments, orgId, teamId);
            summary.fees.dueDatesShifted = true;
          }
          summary.fees.playersCopied++;
        } catch (e) {
          summary.fees.failed++;
          // Remove the just-created schedule if its installments failed to land, so an installment-less
          // orphan schedule (total_amount > 0, no installments) can't overcount outstanding dues.
          if (createdScheduleId) {
            try { await supabaseAdmin.from('rep_player_dues_schedules').delete().eq('id', createdScheduleId); }
            catch (delErr) { console.error('[rep-season-rollover] orphan dues-schedule cleanup failed:', delErr); }
          }
          console.error('[rep-season-rollover] fee template carry failed for a player:', e);
        }
      }
      if (summary.fees.dueDatesShifted) {
        summary.notes.push('Fee due dates were shifted forward a year — confirm them for the new season.');
      }
    } catch (e) {
      dataIssue = true;
      summary.warnings.push('The fee import hit a problem; some dues may be missing from the new season.');
      console.error('[rep-season-rollover] fee carry pass failed:', e);
    }
  }

  // ── Finalize: complete the previous season so it becomes read-only history ──
  try {
    await updateRepProgramYear(currentSeason.id, { status: 'completed' });
  } catch (e) {
    summary.warnings.push('The previous season could not be marked complete — it may still show as active. Refresh, or contact support if it persists.');
    console.error('[rep-season-rollover] complete previous season failed:', e);
  }

  // `ok` reflects the DATA carry only — a soft finalize hiccup (completing the old season, re-pointing
  // the active pointer) records a warning but must not mark an otherwise-successful roll as failed.
  summary.ok =
    !dataIssue &&
    summary.roster.failed === 0 &&
    summary.budget.failed === 0 &&
    summary.fees.failed === 0;

  return summary;
}
