import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import {
  updateRepProgramYear,
  getRepProgramYears,
  getRepRosterPlayers,
  createRepRosterPlayer,
  getRepTeamCoachForUserYear,
  suggestContinuityLinksBulk,
  getActiveRepProgramYear,
  getLatestClosedRepProgramYear,
} from './db';
import { addStaffMember, projectMembershipsOntoProgramYear } from './coach-membership';
import { seasonClosingCashCents } from './coach-register-book';
import { openingBalanceFor, carriesProvenance, type SeasonCarryChoice } from './season-carry';
import { carryBudgetPlan, shiftDateYears } from './rep-budget-carry';
import { createRepPlayerDuesSchedule, replaceRepDuesInstallments } from './db';
import { decideStrayOpenSeasons, isLiveSeasonStatus, twoOpenSeasonsMessage } from './season-live';
import type { RepProgramYear } from './types';

/**
 * Coach Premium — Phase 5: "Start next season" for a standalone Premium coach.
 * ⚖ Club Tier Stage 2 (Ask 1 (a), owner 2026-09-28): the SAME roll is also the club's door for a
 * club-owned team, called by the club's owner or admin — `managedBy` says which, and the two
 * differ in exactly two places (the stray-open-season rule and the no-staff fallback).
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
  /** Structured detail a screen can draw from (the two open seasons, for `two_open_seasons`). */
  details?: Record<string, unknown>;
  constructor(code: string, status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SeasonRolloverError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/* `shiftDateYears` moved to lib/rep-budget-carry.ts with the budget copy (§6.3) — the dues carry
   below still imports it from there; one clamping rule, one home. */

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
  /**
   * WHO HOLDS THIS TEAM'S SEASON DOORS (Club Tier Stage 2, Ask 1 (a)) — required, so neither caller
   * can inherit the other's rules by omission. `'coach'`: a standalone portal's head coach (the
   * self-heal below completes a stray open season). `'club'`: a club owner or admin (it refuses
   * instead, and never mints the initiator onto the team's staff).
   */
  managedBy: 'coach' | 'club';
  /** For the two-open-seasons refusal's sentence. */
  teamName?: string;
}): Promise<RepSeasonRolloverSummary> {
  const { orgId, teamId, workspaceId, currentSeason, initiatorUserId, newName, newYear, carryBudget, carryFees, managedBy } = params;
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
  // A SECOND open season. For a standalone team it is the residue of an earlier roll that failed on
  // its last step, and completing it restores the single-open invariant (a transient failure must
  // not block every future roll). ⚠ For a CLUB team it may be a season somebody made on purpose, so
  // the roll refuses and names both — the rule and its reasons live in `decideStrayOpenSeasons`
  // (pure, unit-tested both ways) rather than in this database-bound module.
  const stray = decideStrayOpenSeasons(existing, currentSeason.id, managedBy);
  if (stray.action === 'refuse') {
    throw new SeasonRolloverError(
      'two_open_seasons', 409,
      twoOpenSeasonsMessage(params.teamName ?? 'This team', stray.open),
      { openSeasons: stray.open },
    );
  }
  if (stray.action === 'complete') {
    for (const staleId of stray.seasonIds) {
      try {
        await updateRepProgramYear(staleId, { status: 'completed' });
      } catch (e) {
        console.error('[rep-season-rollover] could not auto-complete a stale open season:', e);
      }
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
    // ⚠ STANDALONE ONLY. There the initiator IS the team's head coach, so a membership-less team is
    // a pre-M1 data gap to repair. A club's initiator is an owner or admin, NOT a coach — minting
    // them as head coach would put the club's board on the team's staff. A club team with no staff
    // simply starts its season with none, and the club's board says "No head coach".
    if (memberIds.length === 0 && managedBy === 'coach') {
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
          // Best/Never + pitcher/A-squad persist across seasons. `p` came from getRepRosterPlayers
          // (line 255), so a legacy row's stray "Okay" key is already stripped by the DB reader's
          // own sanitizer (lib/lineup-profile.ts:dropLegacyLineupProfileKeys) before it ever
          // reaches here — this copy can't perpetuate it into the new season's row.
          lineupProfile: p.lineupProfile,
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
  // carried player's Skills & Goals tab carries its Previous seasons fold without a
  // "possible returning player — verify" step. (The per-player "bring forward last season's
  // goals?" offer that used to ride this link left the player's page — owner ruling
  // 2026-09-16: linking and what follows it are decided for the TEAM, never one profile at a
  // time; a team-level surface is its next home.) Best-effort: a failed mint warns, never
  // fails the roll; the pair-unique index makes re-runs safe.
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
        summary.notes.push('Each carried player’s history is linked to last season — it reads under Previous seasons on their Skills & Goals tab.');
      }
    } catch (e) {
      summary.warnings.push('Player development history could not be linked automatically — last season’s goals and results will not show under Previous seasons for the carried players.');
      console.error('[rep-season-rollover] continuity link mint failed (non-blocking):', e);
    }
  }

  // ── Planned budget carry (optional): lines + periods + the legacy budget envelope ──
  // ⚠ The line/period copy EXTRACTED to lib/rep-budget-carry.ts (§6.3, 2026-09-02): the empty-plan
  // "Bring last season's plan" door runs the same copy, and two spellings of it would be two
  // places to re-learn the carried-never-defaulted line_kind lesson (the comment rode along).
  if (carryBudget) {
    try {
      const carried = await carryBudgetPlan({
        orgId,
        teamId,
        fromProgramYearId: currentSeason.id,
        toProgramYearId: newSeason.id,
        yearDelta: delta,
      });
      summary.budget.linesCopied += carried.linesCopied;
      summary.budget.periodsCopied += carried.periodsCopied;
      summary.budget.failed += carried.failed;

      // Carry the estimated total too — whenever set it IS the season's plan total
      // (`computeBudgetTotals`), so a rolled plan without it would change what the season costs.
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
  // ⚠ Only a LIVE one. Rolling from a team's newest CLOSED season (the between-seasons door) used to
  // write 'completed' over it too — harmless on a completed season, but it silently un-archived an
  // archived one (Club Tier Stage 2: the club's door rolls from closed seasons as often as live ones).
  try {
    if (isLiveSeasonStatus(currentSeason.status)) {
      await updateRepProgramYear(currentSeason.id, { status: 'completed' });
    }
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

// ── Close and reopen — the other two season doors, one copy for both callers ─────────────────
//
// ⚠ ONE HOME, like the roll above (Club Tier Stage 2 /simplify): the portal's seasons route and the
// club's seasons route both close and reopen through these, so the race-safe WHERE and the staff
// re-seat cannot drift between the two doors. Each route keeps its own gate and its own words.

export interface SeasonRowSummary { id: string; name: string; year: number; status: string }

/**
 * Close one OPEN season. ⚠ NOTHING IS CREATED, MOVED OR DELETED — a status flip on one row, with
 * every condition re-asserted in the WHERE: two people (or a close and a roll) acting in the same
 * second must not close a season that has already moved on. Null when it was no longer open (the
 * losing side of a race); throws on a database error.
 */
export async function closeOpenSeason(teamId: string, seasonId: string): Promise<SeasonRowSummary | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', seasonId)
    .eq('team_id', teamId)
    .in('status', ['draft', 'active'])
    .select('id, name, year, status')
    .maybeSingle<SeasonRowSummary>();
  if (error) throw error;
  return data ?? null;
}

export type ReopenOutcome =
  | { ok: true; season: SeasonRowSummary }
  /** A newer season is live — giving the old one back would mean deleting it (plan §3.4, unbuilt). */
  | { ok: false; reason: 'live_season_exists'; liveSeasonName: string }
  /** No completed season to reopen (an ARCHIVED one is never reopened). */
  | { ok: false; reason: 'nothing_to_reopen' }
  /** It stopped being closed between the read and the write. */
  | { ok: false; reason: 'no_longer_closed' };

/**
 * Reopen the team's NEWEST closed season — the safe half only: refused while any season is live.
 * Throws on a database error.
 *
 * ⚠ RE-SEATS THE CURRENT STAFF on the reopened season (found building Club Tier Stage 2). Staff
 * belong to the team, but a season's write routes admit people through that season's record rows —
 * and a coach added, promoted or re-granted while the team sat between seasons has no row (or a
 * stale one) on a season that closed before they arrived. Without this, reopening locks out exactly
 * the people the team gained since it closed. The projection is collision-tolerant and converges
 * existing rows to each membership; a removed coach is not a member, so their record row stays a
 * record. Best-effort: the reopen has landed.
 */
export async function reopenLatestClosedSeason(teamId: string, orgId: string): Promise<ReopenOutcome> {
  const live = await getActiveRepProgramYear(teamId);
  if (live) return { ok: false, reason: 'live_season_exists', liveSeasonName: live.name };
  const closed = await getLatestClosedRepProgramYear(teamId);
  if (!closed || closed.status !== 'completed') return { ok: false, reason: 'nothing_to_reopen' };
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', closed.id)
    .eq('team_id', teamId)
    .eq('status', 'completed')
    .select('id, name, year, status')
    .maybeSingle<SeasonRowSummary>();
  if (error) throw error;
  if (!data) return { ok: false, reason: 'no_longer_closed' };

  /* ⚠ THE SECOND CHECK — the one that holds (review 2026-09-28). The WHERE above re-asserts THIS row,
     but "no season is live" is a fact about the whole team: a roll (or a first season) landing in
     the same instant leaves two live seasons, the state a club must never reach silently. So the
     team is read again AFTER the flip and, if another season is now live, this one is put back —
     the convergence `setStaffMemberRole` uses for its own count-then-act. A failed re-read keeps the
     reopen (the old behaviour) rather than turning a landed reopen into an error. */
  try {
    const otherLive = (await getRepProgramYears(teamId))
      .filter(s => isLiveSeasonStatus(s.status) && s.id !== data.id);
    if (otherLive.length > 0) {
      await supabaseAdmin
        .from('rep_program_years')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', data.id)
        .eq('team_id', teamId)
        .eq('status', 'active');
      return { ok: false, reason: 'live_season_exists', liveSeasonName: otherLive[0].name };
    }
  } catch (e) {
    console.error('[rep-season-rollover] reopen re-check failed (kept the reopen):', e);
  }

  try {
    await projectMembershipsOntoProgramYear(teamId, orgId, data.id);
  } catch (e) {
    console.error('[rep-season-rollover] staff re-seat on reopen failed (season reopened):', e);
  }
  return { ok: true, season: data };
}
