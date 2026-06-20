import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getBasicCoachTeamPlayers } from './basic-coach-roster';
import { getBasicCoachTeamEvents } from './basic-coach-schedule';
import { getBasicCoachTeamFees } from './basic-coach-fees';
import {
  createRepRosterPlayer,
  createRepTeamEvents,
  createRepPlayerDuesSchedule,
  replaceRepDuesInstallments,
  type CreateRepTeamEventFields,
} from './db';
import type { RepEventType } from './types';

/**
 * Coach Premium Upgrade — Phase 4: copy a free Basic team's roster / schedule / fees into the new
 * Premium season on provisioning. Per the locked reconciliation contract
 * (docs/projects/active/COACH_PREMIUM_UPGRADE_FLOW_PLAN.md):
 *
 * - DETERMINISTIC mapping (not "best-effort guessing"); uncertain items are SURFACED, never faked.
 * - PER-ENTITY RESILIENT: roster, schedule, and fees each run independently; one failing does not
 *   block the others, and per-row failures are collected, not thrown.
 * - WEBHOOK-SAFE: the caller (provisioner) wraps this so it never throws out of the provision/webhook
 *   path — a migration hiccup must never fail the payment. This function also never throws; it
 *   returns a summary (with `ok: false` + `error` if it hit a top-level problem).
 * - IDEMPOTENCY is the CALLER's responsibility (atomic claim of basic_coach_teams.team_workspace_id);
 *   this function just does the copy for a team that has been claimed for the first time.
 *
 * Announcements are NOT migrated (the historical send-log stays on the free team by design; the
 * Premium announcements FEATURE exists separately — Phase 3b).
 */

export type CoachUpgradeMigrationSummary = {
  ok: boolean;
  migratedAt: string;
  roster: { migrated: number; failed: number; needGuardian: string[]; nameSplitUncertain: string[] };
  schedule: { migrated: number; cancelled: number; failed: number };
  fees: { migrated: number; markedPaid: number; dueDateDefaulted: number; skippedZero: number; skippedNoPlayer: number; failed: number };
  announcementsMigrated: false;
  notes: string[];
  error?: string;
};

function emptySummary(): CoachUpgradeMigrationSummary {
  return {
    ok: true,
    migratedAt: new Date().toISOString(),
    roster: { migrated: 0, failed: 0, needGuardian: [], nameSplitUncertain: [] },
    schedule: { migrated: 0, cancelled: 0, failed: 0 },
    fees: { migrated: 0, markedPaid: 0, dueDateDefaulted: 0, skippedZero: 0, skippedNoPlayer: 0, failed: 0 },
    announcementsMigrated: false,
    notes: [],
  };
}

/** Split a single free-text name into first/last. Last whitespace token = surname; everything
 *  before it = first name. 1-token (no surname) or 3+-token names are flagged uncertain so the
 *  coach reviews them. player_first/last_name are NOT NULL, so a 1-token name keeps last = ''. */
function splitName(full: string): { first: string; last: string; uncertain: boolean } {
  const tokens = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: 'Unknown', last: '', uncertain: true };
  if (tokens.length === 1) return { first: tokens[0], last: '', uncertain: true };
  return {
    first: tokens.slice(0, -1).join(' '),
    last: tokens[tokens.length - 1],
    uncertain: tokens.length > 2,
  };
}

/** Split an OPTIONAL guardian name into first/last (guardian fields are nullable as of mig 139, so
 *  a blank guardian stays fully null — never fabricated). */
function splitGuardian(full: string | null): { first: string | null; last: string | null } {
  const tokens = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: null, last: null };
  if (tokens.length === 1) return { first: tokens[0], last: null };
  return { first: tokens.slice(0, -1).join(' '), last: tokens[tokens.length - 1] };
}

const EVENT_TYPE_MAP: Record<'practice' | 'game' | 'event', RepEventType> = {
  practice: 'practice',
  game: 'scrimmage', // Free never tracked a result, so no loss; coach can reclassify
  event: 'team_event',
};

export async function migrateBasicTeamIntoWorkspace(params: {
  basicCoachTeamId: string;
  orgId: string;
  teamId: string;
  programYearId: string;
}): Promise<CoachUpgradeMigrationSummary> {
  const summary = emptySummary();

  // ── Roster ────────────────────────────────────────────────────────────────
  // Build a freePlayerId → newRepPlayerId map for the fees pass.
  const playerIdMap = new Map<string, string>();
  try {
    const players = await getBasicCoachTeamPlayers(params.basicCoachTeamId);
    for (const p of players) {
      try {
        const name = splitName(p.name);
        const guardian = splitGuardian(p.guardianName);
        const created = await createRepRosterPlayer({
          programYearId: params.programYearId,
          teamId: params.teamId,
          orgId: params.orgId,
          source: 'admin_manual',
          playerFirstName: name.first,
          playerLastName: name.last,
          playerDateOfBirth: p.dateOfBirth,
          playerNumber: p.jerseyNumber,
          guardianFirstName: guardian.first,
          guardianLastName: guardian.last,
          guardianEmail: p.contactEmail,
          guardianPhone: p.contactPhone,
          notes: p.notes,
        });
        playerIdMap.set(p.id, created.id);
        summary.roster.migrated++;
        const label = p.name?.trim() || created.id;
        if (name.uncertain) summary.roster.nameSplitUncertain.push(label);
        // Flag any missing guardian contact (name OR email) — both came over nullable; the coach
        // should complete them (an email is what re-enables dues reminders).
        if (!p.contactEmail || !p.guardianName) summary.roster.needGuardian.push(label);
      } catch (e) {
        summary.roster.failed++;
        console.error('[coach-upgrade-migration] roster player failed:', e);
      }
    }
  } catch (e) {
    summary.ok = false;
    summary.notes.push('Roster import hit a problem; some players may be missing.');
    console.error('[coach-upgrade-migration] roster pass failed:', e);
  }

  // ── Schedule ──────────────────────────────────────────────────────────────
  try {
    const events = await getBasicCoachTeamEvents(params.basicCoachTeamId);
    const rows: CreateRepTeamEventFields[] = events.map(ev => ({
      programYearId: params.programYearId,
      teamId: params.teamId,
      orgId: params.orgId,
      eventType: EVENT_TYPE_MAP[ev.eventType] ?? 'team_event',
      name: ev.title,
      description: ev.notes,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      location: ev.location,
      opponent: ev.opponent,
      status: ev.status,
    }));
    if (rows.length > 0) {
      try {
        const created = await createRepTeamEvents(rows);
        summary.schedule.migrated += created.length;
        // Count cancelled only among events that actually landed (accurate on partial/total failure).
        summary.schedule.cancelled += created.filter(e => e.status === 'cancelled').length;
      } catch (e) {
        summary.schedule.failed += rows.length; // bulk insert is all-or-nothing
        summary.ok = false;
        summary.notes.push('Schedule import hit a problem; some events may be missing.');
        console.error('[coach-upgrade-migration] schedule insert failed:', e);
      }
    }
  } catch (e) {
    summary.ok = false;
    summary.notes.push('Schedule import hit a problem; some events may be missing.');
    console.error('[coach-upgrade-migration] schedule pass failed:', e);
  }

  // ── Fees → per-player dues schedules ──────────────────────────────────────
  // Default due date 30 days out (avoids a back-dated "overdue" on a migrated fee); flagged for
  // coach review. $0 fees and fees with no/unmapped player are surfaced, not migrated.
  const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const fees = await getBasicCoachTeamFees(params.basicCoachTeamId);
    // Premium allows exactly ONE dues schedule per player per season (UNIQUE program_year_id+player_id),
    // so GROUP each player's fees into one schedule with one installment per fee. $0 fees and fees with
    // no/unmapped player are surfaced (counted), not migrated.
    const feesByPlayer = new Map<string, typeof fees>();
    for (const fee of fees) {
      if (fee.amount <= 0) { summary.fees.skippedZero++; continue; }
      const newPlayerId = fee.playerId ? playerIdMap.get(fee.playerId) : undefined;
      if (!newPlayerId) { summary.fees.skippedNoPlayer++; continue; }
      const list = feesByPlayer.get(newPlayerId) ?? [];
      list.push(fee);
      feesByPlayer.set(newPlayerId, list);
    }
    for (const [newPlayerId, playerFees] of feesByPlayer) {
      try {
        const total = playerFees.reduce((sum, f) => sum + f.amount, 0);
        const schedule = await createRepPlayerDuesSchedule({
          programYearId: params.programYearId,
          playerId: newPlayerId,
          teamId: params.teamId,
          orgId: params.orgId,
          totalAmount: total,
          notes: playerFees.map(f => f.label).join(', '),
        });
        const installments = await replaceRepDuesInstallments(
          schedule.id,
          newPlayerId,
          playerFees.map((f, i) => ({ installmentNumber: i + 1, amount: f.amount, dueDate: defaultDueDate })),
          params.orgId,
          params.teamId,
        );
        summary.fees.migrated += playerFees.length;
        summary.fees.dueDateDefaulted += playerFees.length;
        // Preserve paid state per fee: stamp the matching installment's paid_at from the free ledger.
        for (let i = 0; i < playerFees.length; i++) {
          const fee = playerFees[i];
          if (fee.status !== 'paid') continue;
          const inst = installments.find(x => x.installmentNumber === i + 1);
          if (!inst) continue;
          const paidAt = fee.markedPaidAt ?? new Date().toISOString();
          const { error } = await supabaseAdmin
            .from('rep_player_dues_installments')
            .update({ paid_at: paidAt })
            .eq('id', inst.id);
          if (!error) summary.fees.markedPaid++;
        }
      } catch (e) {
        summary.fees.failed += playerFees.length;
        console.error('[coach-upgrade-migration] fee group failed:', e);
      }
    }
  } catch (e) {
    summary.ok = false;
    summary.notes.push('Fees import hit a problem; some fees may be missing.');
    console.error('[coach-upgrade-migration] fees pass failed:', e);
  }

  return summary;
}
