import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import {
  updateRepProgramYear,
  getRepProgramYears,
  getRepRosterPlayers,
  createRepRosterPlayer,
  getRepTeamCoaches,
  addRepTeamCoach,
  suggestContinuityLinksBulk,
} from './db';
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
  notes: string[];
  warnings: string[];
};

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
}): Promise<RepSeasonRolloverSummary> {
  const { orgId, teamId, workspaceId, currentSeason, initiatorUserId, newName, newYear, carryBudget, carryFees } = params;

  const summary: RepSeasonRolloverSummary = {
    ok: true,
    newSeason: { id: '', name: newName, year: newYear },
    previousSeason: { id: currentSeason.id, name: currentSeason.name, year: currentSeason.year },
    coaches: { copied: 0 },
    roster: { copied: 0, failed: 0 },
    budget: { carried: carryBudget, linesCopied: 0, periodsCopied: 0, failed: 0 },
    fees: { carried: carryFees, playersCopied: 0, failed: 0, dueDatesShifted: false },
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

  // ── Critical core: new active season + coaching access (revert + throw on failure) ──
  // Insert the season already-active in ONE statement (no draft->active window that could strand a
  // half-created year and block retries via the duplicate-year guard).
  let newSeason: { id: string };
  const createdCoachIds: string[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('rep_program_years')
      .insert({ org_id: orgId, team_id: teamId, name: newName, year: newYear, status: 'active', tryout_open: false })
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

  try {
    // Carry forward every coaching assignment (head + any assistants) so the team's staff continues.
    const coaches = await getRepTeamCoaches(currentSeason.id);
    let initiatorIncluded = false;
    for (const c of coaches) {
      const created = await addRepTeamCoach(newSeason.id, teamId, orgId, c.userId, c.coachRole);
      createdCoachIds.push(created.id);
      if (c.userId === initiatorUserId) initiatorIncluded = true;
    }
    if (!initiatorIncluded) {
      const created = await addRepTeamCoach(newSeason.id, teamId, orgId, initiatorUserId, 'head_coach');
      createdCoachIds.push(created.id);
    }
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
