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
 * - IDEMPOTENT (mig 143): every migrated roster/event row carries a `source_basic_*_id` provenance
 *   tag (fees use the natural UNIQUE(program_year_id, player_id) key). This function RECONCILES the
 *   Basic source against the current Premium target each run — it copies only what's missing and
 *   counts the FULL resulting state — so it is safe to re-run to repair a partial migration
 *   (see retryCoachUpgradeMigration). The first provisioning run (nothing present yet) copies
 *   everything exactly as before.
 *
 * Announcements are NOT migrated (the historical send-log stays on the free team by design; the
 * Premium announcements FEATURE exists separately — Phase 3b).
 */

export const MAX_AUTO_MIGRATION_RETRIES = 3;

export type CoachUpgradeMigrationSummary = {
  ok: boolean;
  programYearId: string;
  migratedAt: string;
  retryCount?: number;
  lastRetryAt?: string;
  acknowledgedAt?: string;
  roster: { migrated: number; failed: number; needGuardian: string[]; nameSplitUncertain: string[] };
  schedule: { migrated: number; cancelled: number; failed: number };
  fees: { migrated: number; markedPaid: number; dueDateDefaulted: number; skippedZero: number; skippedNoPlayer: number; failed: number };
  announcementsMigrated: false;
  notes: string[];
  error?: string;
};

function emptySummary(programYearId: string): CoachUpgradeMigrationSummary {
  return {
    ok: true,
    programYearId,
    migratedAt: new Date().toISOString(),
    roster: { migrated: 0, failed: 0, needGuardian: [], nameSplitUncertain: [] },
    schedule: { migrated: 0, cancelled: 0, failed: 0 },
    fees: { migrated: 0, markedPaid: 0, dueDateDefaulted: 0, skippedZero: 0, skippedNoPlayer: 0, failed: 0 },
    announcementsMigrated: false,
    notes: [],
  };
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
  const { basicCoachTeamId, orgId, teamId, programYearId } = params;
  const summary = emptySummary(programYearId);

  // ── Roster ──────────────────────────────────────────────────────────────
  // Idempotent: skip Basic players already copied (matched by source_basic_player_id), copy + stamp
  // the rest. Build a basicPlayerId → newRepPlayerId map (existing + new) for the fees pass.
  const playerIdMap = new Map<string, string>();
  try {
    const { data: existingRows } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id, source_basic_player_id')
      .eq('program_year_id', programYearId);
    for (const row of (existingRows ?? []) as Array<{ id: string; source_basic_player_id: string | null }>) {
      if (row.source_basic_player_id) playerIdMap.set(row.source_basic_player_id, row.id);
    }

    const players = await getBasicCoachTeamPlayers(basicCoachTeamId);
    for (const p of players) {
      const label = p.name?.trim() || p.firstName || p.id;
      // Names map 1:1 now (free + Premium both store first/last) — no split, no "uncertain name" flag.
      // Recomputed every run (incl. already-copied players) so the summary stays accurate across retries.
      if (!p.contactEmail || !p.guardianFirstName) summary.roster.needGuardian.push(label);

      if (playerIdMap.has(p.id)) { summary.roster.migrated++; continue; } // already copied — skip
      try {
        const created = await createRepRosterPlayer({
          programYearId,
          teamId,
          orgId,
          source: 'admin_manual',
          playerFirstName: p.firstName,
          playerLastName: p.lastName,
          playerDateOfBirth: p.dateOfBirth,
          playerNumber: p.jerseyNumber,
          guardianFirstName: p.guardianFirstName,
          guardianLastName: p.guardianLastName,
          guardianEmail: p.contactEmail,
          guardianPhone: p.contactPhone,
          notes: p.notes,
          sourceBasicPlayerId: p.id,
        });
        playerIdMap.set(p.id, created.id);
        summary.roster.migrated++;
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

  // ── Schedule ────────────────────────────────────────────────────────────
  // Idempotent: count events already copied (by source_basic_event_id), bulk-insert only the missing
  // ones. Events are all-or-nothing per insert, so a failed batch lands 0 and a retry re-inserts.
  try {
    const { data: existingEvents } = await supabaseAdmin
      .from('rep_team_events')
      .select('source_basic_event_id, status')
      .eq('program_year_id', programYearId)
      .not('source_basic_event_id', 'is', null);
    const existingEventSources = new Set<string>();
    for (const ev of (existingEvents ?? []) as Array<{ source_basic_event_id: string; status: string }>) {
      existingEventSources.add(ev.source_basic_event_id);
      if (ev.status === 'cancelled') summary.schedule.cancelled++;
    }
    summary.schedule.migrated += existingEventSources.size;

    const events = await getBasicCoachTeamEvents(basicCoachTeamId);
    const rows: CreateRepTeamEventFields[] = events
      .filter(ev => !existingEventSources.has(ev.id))
      .map(ev => ({
        programYearId,
        teamId,
        orgId,
        eventType: EVENT_TYPE_MAP[ev.eventType] ?? 'team_event',
        name: ev.title,
        description: ev.notes,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        location: ev.location,
        opponent: ev.opponent,
        status: ev.status,
        sourceBasicEventId: ev.id,
      }));
    if (rows.length > 0) {
      try {
        const created = await createRepTeamEvents(rows);
        summary.schedule.migrated += created.length;
        summary.schedule.cancelled += created.filter(e => e.status === 'cancelled').length;
      } catch (e) {
        // A 23505 means a concurrent retry already inserted these (the partial-unique index on
        // source_basic_event_id won the race) — not a real failure; the next reconcile read counts them.
        if ((e as { code?: string })?.code !== '23505') {
          summary.schedule.failed += rows.length; // bulk insert is all-or-nothing
          summary.notes.push('Schedule import hit a problem; some events may be missing.');
          console.error('[coach-upgrade-migration] schedule insert failed:', e);
        }
      }
    }
  } catch (e) {
    summary.ok = false;
    summary.notes.push('Schedule import hit a problem; some events may be missing.');
    console.error('[coach-upgrade-migration] schedule pass failed:', e);
  }

  // ── Fees → per-player dues schedules ──────────────────────────────────────
  // Default due date 30 days out (avoids a back-dated "overdue" on a migrated fee); flagged for
  // coach review. $0 fees and fees with no/unmapped player are surfaced, not migrated. Idempotent:
  // a player who already has a dues schedule is skipped (schedules are deleted on failure below, so
  // an existing one is complete); UNIQUE(program_year_id, player_id) is the dedup key.
  const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const { data: existingSchedules } = await supabaseAdmin
      .from('rep_player_dues_schedules')
      .select('id, player_id')
      .eq('program_year_id', programYearId);
    const existingScheduleByPlayer = new Map<string, string>();
    for (const s of (existingSchedules ?? []) as Array<{ id: string; player_id: string }>) {
      existingScheduleByPlayer.set(s.player_id, s.id);
    }

    const fees = await getBasicCoachTeamFees(basicCoachTeamId);
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
      let existingScheduleId = existingScheduleByPlayer.get(newPlayerId);

      // Reconcile an existing schedule (from a prior run): a COMPLETE one (has installments) is
      // counted + its paid state reconciled, without re-creating; an installment-less ORPHAN (a prior
      // partial whose cleanup also failed) is deleted and re-created below.
      if (existingScheduleId) {
        try {
          const { data: insts } = await supabaseAdmin
            .from('rep_player_dues_installments')
            .select('id, installment_number, paid_at')
            .eq('schedule_id', existingScheduleId)
            .order('installment_number');
          if (insts && insts.length > 0) {
            summary.fees.migrated += playerFees.length;
            // Reconcile paid state from the Basic ledger: stamp any Basic-paid fee whose installment
            // is not yet paid (never un-stamps a coach-set paid_at). markedPaid reflects ACTUAL state.
            let stampError = false;
            for (let i = 0; i < playerFees.length; i++) {
              const inst = (insts as Array<{ id: string; installment_number: number; paid_at: string | null }>)
                .find(x => x.installment_number === i + 1);
              if (!inst) continue;
              if (inst.paid_at) { summary.fees.markedPaid++; continue; }
              if (playerFees[i].status === 'paid') {
                const paidAt = playerFees[i].markedPaidAt ?? new Date().toISOString();
                const { error } = await supabaseAdmin
                  .from('rep_player_dues_installments')
                  .update({ paid_at: paidAt })
                  .eq('id', inst.id);
                if (error) stampError = true; else summary.fees.markedPaid++;
              }
            }
            if (stampError) summary.fees.failed++; // surface so a retry re-reconciles
            continue;
          }
          // Orphan (schedule exists, zero installments) — remove it and fall through to re-create.
          await supabaseAdmin.from('rep_player_dues_schedules').delete().eq('id', existingScheduleId);
          existingScheduleId = undefined;
        } catch (e) {
          summary.fees.failed += playerFees.length;
          console.error('[coach-upgrade-migration] dues reconcile failed:', e);
          continue;
        }
      }

      // Create path — a player with no schedule yet (or an orphan just deleted).
      let createdScheduleId: string | null = null;
      try {
        const total = playerFees.reduce((sum, f) => sum + f.amount, 0);
        const schedule = await createRepPlayerDuesSchedule({
          programYearId,
          playerId: newPlayerId,
          teamId,
          orgId,
          totalAmount: total,
          notes: playerFees.map(f => f.label).join(', '),
        });
        createdScheduleId = schedule.id;
        const installments = await replaceRepDuesInstallments(
          schedule.id,
          newPlayerId,
          playerFees.map((f, i) => ({ installmentNumber: i + 1, amount: f.amount, dueDate: defaultDueDate })),
          orgId,
          teamId,
        );
        summary.fees.migrated += playerFees.length;
        summary.fees.dueDateDefaulted += playerFees.length;
        // Preserve paid state per fee: stamp the matching installment's paid_at from the free ledger.
        // A stamp FAILURE is surfaced (fees.failed++) so the run is ok:false and a retry re-stamps it
        // via the reconcile path above — otherwise a paid fee would silently show unpaid in Premium.
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
          if (error) summary.fees.failed++; else summary.fees.markedPaid++;
        }
      } catch (e) {
        summary.fees.failed += playerFees.length;
        // Delete the just-created schedule if its installments failed to land, so a retry re-creates
        // it cleanly and an installment-less orphan can't overcount outstanding dues.
        if (createdScheduleId) {
          try { await supabaseAdmin.from('rep_player_dues_schedules').delete().eq('id', createdScheduleId); }
          catch (delErr) { console.error('[coach-upgrade-migration] orphan dues-schedule cleanup failed:', delErr); }
        }
        console.error('[coach-upgrade-migration] fee group failed:', e);
      }
    }
  } catch (e) {
    summary.ok = false;
    summary.notes.push('Fees import hit a problem; some fees may be missing.');
    console.error('[coach-upgrade-migration] fees pass failed:', e);
  }

  // A per-row failure in any entity also marks the run not-ok (a retry will re-attempt those).
  if (summary.roster.failed > 0 || summary.schedule.failed > 0 || summary.fees.failed > 0) {
    summary.ok = false;
  }

  return summary;
}

/**
 * Re-run the (idempotent) copy to repair a partial migration, then persist the fresh full-state
 * summary on the workspace with retry bookkeeping. Safe to call repeatedly: each call fills only
 * what's still missing. The caller (route) enforces the auto-retry cap; a manual "Try again" bypasses
 * it. Never throws — returns the prior summary on a top-level problem.
 */
export async function retryCoachUpgradeMigration(params: {
  workspaceId: string;
  orgId: string;
  teamId: string;
  basicCoachTeamId: string;
  programYearId: string;
  priorSummary: CoachUpgradeMigrationSummary;
}): Promise<CoachUpgradeMigrationSummary> {
  try {
    const fresh = await migrateBasicTeamIntoWorkspace({
      basicCoachTeamId: params.basicCoachTeamId,
      orgId: params.orgId,
      teamId: params.teamId,
      programYearId: params.programYearId,
    });
    const merged: CoachUpgradeMigrationSummary = {
      ...fresh,
      // Preserve the original first-migration timestamp + any prior acknowledgement.
      migratedAt: params.priorSummary.migratedAt ?? fresh.migratedAt,
      acknowledgedAt: params.priorSummary.acknowledgedAt,
      retryCount: (params.priorSummary.retryCount ?? 0) + 1,
      lastRetryAt: new Date().toISOString(),
    };
    await supabaseAdmin
      .from('team_workspaces')
      .update({ migration_summary: merged })
      .eq('id', params.workspaceId);
    return merged;
  } catch (e) {
    console.error('[coach-upgrade-migration] retry failed (non-fatal):', e);
    return params.priorSummary;
  }
}
