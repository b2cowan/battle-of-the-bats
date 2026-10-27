import { TEAM_RECORD_WORDS } from '@/lib/registration-words';
import { teamPayNowLink } from '@/lib/online-payment-receipt';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, manualTeamRegistrationHtml, teamInvitationHtml,
  coachEmailBlock, resolveCoachRecipient, acceptanceFeeLine,
} from '@/lib/email';
import { cancelScheduledEmailForRecipient, COACH_GAME_DAY_REMINDER_EMAIL_KEY } from '@/lib/email-sender';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { canOpenModule } from '@/lib/member-access';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { captureError, withObservability } from '@/lib/observability';
import { refreshTournamentChatMembership } from '@/lib/chat-service';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { notifyTeamCoaches } from '@/lib/team-coach-notices';
import { TEAM_COACH_WORDS } from '@/lib/team-coach-notice-plan';

function tournamentLockedResponse() {
  return new Response(
    JSON.stringify({ error: LOCKED_RESULTS }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  );
}

async function isTournamentLocked(tournamentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();
  return data?.status === 'completed';
}
import {
  getTournamentRegistrationFieldAnswersForRegistrations,
  getTournamentRegistrationFields,
} from '@/lib/db';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { paymentErrorResponse, payTeamDue } from '@/lib/team-payments-server';
import { announceTeamPaid } from '@/lib/team-payment-notices';
import { notify } from '@/lib/notify';
import {
  duplicateTournamentTeamMessage,
  findDuplicateTournamentTeam,
} from '@/lib/team-registration-duplicates';
import { claimNextOpenSlot } from '@/lib/slot-claim';
import { ourTeamIdsAmong } from '@/lib/club-own-tournament-team';
import { runsInviteOnlyEvents, teamUpdateAllowed } from '@/lib/invite-only-event';
import { INVITATION_EMAIL_WORDS, INVITE_REFUSALS } from '@/lib/invite-only-words';
import {
  TEAM_STATUSES, TEAM_UPDATE_REFUSALS, emailsToCheck, poolIdsToCheck, poolOutsideDivision, readTeamUpdates, type TeamUpdateColumns,
} from '@/lib/team-update-allowlist';

/** A write to an area an invite-only event hides (the free tournament tier, B2, 2026-10-16). */
function inviteOnlyRefusal() {
  return new Response(JSON.stringify({ error: INVITE_REFUSALS.hidden }), { status: 403, headers: { 'Content-Type': 'application/json' } });
}

/** An update the Teams screen would never send (lib/team-update-allowlist.ts). */
function badUpdate(error: string) {
  return new Response(JSON.stringify({ error }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // Teams' contacts, payments and admin notes are the tournaments area's to read — never any member of the club
  // (a scorekeeper or a coach-role member with no assignment passed until 2026-10-16; the second sweep).
  if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const teams = (data ?? []).map((t: any) => ({
    id: t.id,
    tournamentId: t.tournament_id,
    divisionId: t.division_id,
    name: t.name,
    coach: t.coach,
    email: t.email,
    status: t.status || 'accepted',
    paymentStatus: t.payment_status || 'pending',
    checkInStatus: t.check_in_status ?? 'not_arrived',
    registered_at: t.registered_at,
    registeredAt: t.registered_at,
    adminNotes: t.admin_notes,
    poolId: t.pool_id,
    waitlistPosition: t.waitlist_position ?? null,
    slotId: t.slot_id ?? null,
    seed: t.seed ?? null,
  }));

  const [fields, answers] = await Promise.all([
    getTournamentRegistrationFields(tournamentId),
    getTournamentRegistrationFieldAnswersForRegistrations(teams.map(team => team.id)),
  ]);
  const fieldMap = new Map(fields.map(field => [field.id, field]));
  const answersByRegistration = new Map<string, Array<{
    fieldId: string;
    label: string;
    fieldType: string;
    value: string;
  }>>();
  for (const answer of answers) {
    const field = fieldMap.get(answer.fieldId);
    if (!field) continue;
    let value = answer.fileUrl ?? answer.valueText ?? '';
    if (!value && answer.valueJson && typeof answer.valueJson === 'object' && 'checked' in answer.valueJson) {
      value = (answer.valueJson as { checked?: unknown }).checked ? 'Yes' : 'No';
    }
    const list = answersByRegistration.get(answer.registrationId) ?? [];
    list.push({ fieldId: field.id, label: field.label, fieldType: field.fieldType, value });
    answersByRegistration.set(answer.registrationId, list);
  }

  const teamsWithAnswers = teams.map(team => ({
    ...team,
    customAnswers: answersByRegistration.get(team.id) ?? [],
  }));

  return new Response(JSON.stringify(teamsWithAnswers), { status: 200, headers: { 'Content-Type': 'application/json' } });
}, { route: '/api/admin/teams' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const body = await req.json();

    // ── promote-from-waitlist ─────────────────────────────────────────────────
    // Assigns a waitlisted team to the lowest empty slot of its own division.
    // Body: { action, teamId }. It took a `slotId` too, which no screen sent and nothing checked
    // belonged to the team's tournament — any organization's slot could be written (2026-10-16).
    if (body.action === 'promote-from-waitlist') {
      const { teamId } = body as { teamId: string };

      const { data: team } = await supabaseAdmin
        .from('teams').select('*').eq('id', teamId).single();
      if (!team) return new Response(JSON.stringify({ error: 'Team not found' }), { status: 404 });

      const denied = scopeGuard(ctx, team.tournament_id);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, team.tournament_id);
      if (wrongOrg) return wrongOrg;
      if (await isTournamentLocked(team.tournament_id)) return tournamentLockedResponse();

      if (!hasPlanFeature(ctx.org.planId, 'waitlist_automation')) {
        return new Response(JSON.stringify({ error: requiresTournamentPlusCopy('waitlist_automation') }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Find lowest empty slot for this division, ordered by pool then slot_number
      const { data: emptySlots } = await supabaseAdmin
        .from('pool_slots')
        .select('id, slot_number, pools(display_order)')
        .eq('division_id', team.division_id)
        .is('team_id', null);

      const sorted = (emptySlots ?? []).sort((a: any, b: any) => {
        const oa = (a.pools as any)?.display_order ?? 0;
        const ob = (b.pools as any)?.display_order ?? 0;
        return oa !== ob ? oa - ob : a.slot_number - b.slot_number;
      });

      if (!sorted[0]) {
        return new Response(JSON.stringify({ error: 'No empty slots available' }), { status: 409 });
      }
      const slotId: string = sorted[0].id;

      await supabaseAdmin.from('pool_slots').update({ team_id: teamId }).eq('id', slotId);
      await supabaseAdmin.from('teams').update({ slot_id: slotId, waitlist_position: null }).eq('id', teamId);

      // Reorder remaining waitlist queue to close the gap
      const { data: remaining } = await supabaseAdmin
        .from('teams')
        .select('id, waitlist_position')
        .eq('division_id', team.division_id)
        .not('waitlist_position', 'is', null)
        .order('waitlist_position', { ascending: true });

      for (let i = 0; i < (remaining ?? []).length; i++) {
        await supabaseAdmin.from('teams').update({ waitlist_position: i + 1 }).eq('id', remaining![i].id);
      }

      await writePlatformEvent({
        eventType: 'tournament_plus_feature_used',
        source: 'app',
        orgId: ctx.org.id,
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        planId: ctx.org.planId,
        metadata: {
          feature: 'waitlist_automation',
          action: 'waitlist_promotion',
          tournamentId: team.tournament_id,
          divisionId: team.division_id,
          registrationId: teamId,
        },
      });

      return new Response(JSON.stringify({ success: true, slotId }), { status: 200 });
    }

    // ── swap-slots ────────────────────────────────────────────────────────────
    // Swaps two teams' slot assignments. Games are unaffected (they reference slot IDs).
    // Body: { action, slotAId, slotBId }
    if (body.action === 'swap-slots') {
      const { slotAId, slotBId } = body as { slotAId: string; slotBId: string };

      const [{ data: slotA }, { data: slotB }] = await Promise.all([
        supabaseAdmin.from('pool_slots').select('id, team_id, tournament_id, division_id').eq('id', slotAId).single(),
        supabaseAdmin.from('pool_slots').select('id, team_id, tournament_id, division_id').eq('id', slotBId).single(),
      ]);

      if (!slotA || !slotB) {
        return new Response(JSON.stringify({ error: 'One or both slots not found' }), { status: 404 });
      }

      const denied = scopeGuard(ctx, slotA.tournament_id);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, slotA.tournament_id);
      if (wrongOrg) return wrongOrg;
      if (await isTournamentLocked(slotA.tournament_id)) return tournamentLockedResponse();
      // The checks above ran on slot A's tournament, so slot B must be in it — in the same division, as the
      // screen offers them. Until 2026-10-16 slot B was never checked: a swap could write another
      // organization's slot and team.
      if (slotB.tournament_id !== slotA.tournament_id || slotB.division_id !== slotA.division_id) {
        return new Response(JSON.stringify({ error: 'Those two spots aren’t in the same division.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Swap team_id on pool_slots
      await supabaseAdmin.from('pool_slots').update({ team_id: slotB.team_id }).eq('id', slotAId);
      await supabaseAdmin.from('pool_slots').update({ team_id: slotA.team_id }).eq('id', slotBId);

      // Update slot_id on the affected teams
      if (slotA.team_id) {
        await supabaseAdmin.from('teams').update({ slot_id: slotBId }).eq('id', slotA.team_id);
      }
      if (slotB.team_id) {
        await supabaseAdmin.from('teams').update({ slot_id: slotAId }).eq('id', slotB.team_id);
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // ── create-team ───────────────────────────────────────────────────────────
    if (body.action === 'create-team') {
      const team = body.team as {
        name?: string;
        coach?: string;
        email?: string;
        divisionId?: string;
        tournamentId?: string;
        status?: string;
        paymentStatus?: string;
        notifyTeam?: boolean;
      };

      if (!team?.name?.trim() || !team.divisionId || !team.tournamentId) {
        return new Response(JSON.stringify({ error: 'Team name, division, and tournament are required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // The status is one a team can have, as the update checks it (2026-10-16); Add team sends `accepted`.
      if (team.status !== undefined && !TEAM_STATUSES.has(team.status)) return badUpdate(TEAM_UPDATE_REFUSALS.status);

      const denied = scopeGuard(ctx, team.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, team.tournamentId);
      if (wrongOrg) return wrongOrg;
      if (await isTournamentLocked(team.tournamentId)) return tournamentLockedResponse();

      const { data: group } = await supabaseAdmin
        .from('divisions')
        .select('id, name, tournament_id')
        .eq('id', team.divisionId)
        .single();

      if (!group || group.tournament_id !== team.tournamentId) {
        return new Response(JSON.stringify({ error: 'Division does not belong to this tournament.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // An invite-only event's added team is in at once, and no payment is recorded on a plan without payment tracking.
      if (!teamUpdateAllowed(ctx.org.planId, 'accepted', { status: team.status, paymentStatus: team.paymentStatus === 'paid' ? 'paid' : undefined })) {
        return inviteOnlyRefusal();
      }

      if (team.notifyTeam && !team.email?.trim()) {
        return new Response(JSON.stringify({ error: 'Email is required when notifying the team.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // FieldLogicHQ staff are NOT coaches — never let a staff email become a team contact
      // (mirrors the public register route; the email is optional, so this only fires when set).
      if (team.email?.trim() && (await isPlatformAdminEmail(team.email.trim()))) {
        return new Response(JSON.stringify({ error: "That email belongs to FieldLogicHQ staff and can't be used as a team contact." }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const duplicateTeam = await findDuplicateTournamentTeam({
        tournamentId: team.tournamentId,
        divisionId: team.divisionId,
        teamName: team.name,
      });
      if (duplicateTeam) {
        return new Response(JSON.stringify({ error: duplicateTournamentTeamMessage(team.name) }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data: tournament } = await supabaseAdmin
        .from('tournaments')
        .select('id, name, contact_email, settings')
        .eq('id', team.tournamentId)
        .single();

      const id = crypto.randomUUID();
      const paymentStatus = team.paymentStatus === 'paid' ? 'paid' : 'pending';
      const { error: insertErr } = await supabaseAdmin.from('teams').insert({
        id,
        tournament_id: team.tournamentId,
        division_id: team.divisionId,
        name: team.name.trim(),
        // `|| null`, not `?? ''`: "no coach" must be stored as NULL, the same way every other
        // write path records it. This line wrote '' to satisfy prod's old NOT NULL (dropped in
        // migration 202) and was the sole source of a two-encodings-of-absent split — 17 of prod's
        // 21 teams held '' while dev held NULL. `||` (not `??`) so a whitespace-only name, which
        // trims to '', also normalizes to NULL rather than slipping through.
        coach: team.coach?.trim() || null,
        email: team.email?.trim() ?? '',
        status: team.status ?? 'accepted',
        // "Paid" at creation is recorded below as a payment (mig 345), so the ledger and the coach's view agree.
        payment_status: 'pending',
        fee_changed_by: ctx.user.id,
        registered_at: new Date().toISOString(),
      });

      if (insertErr) throw insertErr;

      if (paymentStatus === 'paid') {
        const paid = await payTeamDue({ teamId: id, actorId: ctx.user.id, scope: 'all' });
        if ('error' in paid) {
          // A team that could not be recorded as paid is not left behind half-made (a closed fiscal year, for one).
          await supabaseAdmin.from('teams').delete().eq('id', id);
          return paymentErrorResponse(paid.error, ctx.org.id);
        }
        // No fee schedule: nothing is owed, so only the status is marked.
        if (paid.outcome.noFee) {
          await supabaseAdmin.from('teams').update({ payment_status: 'paid', fee_changed_by: ctx.user.id }).eq('id', id);
        }
      }

      // An invite-only event: the email is the invitation to claim the team into a Coaches Portal (B3).
      if (team.notifyTeam && team.email?.trim() && runsInviteOnlyEvents(ctx.org.planId)) {
        await sendEmail(
          team.email.trim(),
          INVITATION_EMAIL_WORDS.subject(team.name.trim(), tournament?.name ?? 'Tournament'),
          teamInvitationHtml({
            teamName: team.name.trim(),
            coachName: team.coach?.trim() ?? '',
            divisionName: group.name ?? 'Division',
            tournamentName: tournament?.name ?? 'Tournament',
            registrationId: id,
            coachEmail: team.email.trim(),
          }),
          { kind: 'team_invitation', orgId: ctx.org.id, askedBy: ctx.user.id },
        );
      } else if (team.notifyTeam && team.email?.trim()) {
        await sendEmail(
          team.email.trim(),
          `Team Registered - ${team.name.trim()}`,
          manualTeamRegistrationHtml({
            teamName: team.name.trim(),
            coachName: team.coach?.trim() ?? '',
            divisionName: group.name ?? 'Division',
            tournamentName: tournament?.name ?? 'Tournament',
            paymentStatus,
            paymentsTracked: tournamentTracksPayments(tournament?.settings),
            contactEmail: tournament?.contact_email ?? ctx.org.contactEmail ?? undefined,
            registrationId: id,
            coachEmail: team.email.trim(),
          }),
          { kind: 'tournament_team_registered', orgId: ctx.org.id, askedBy: ctx.user.id },
        );
      }

      // Notify org admins of manually-added registration (fire-and-forget)
      notify({
        orgId: ctx.org.id,
        tournamentId: team.tournamentId,
        eventType: 'registration_new',
        title: `New registration: ${team.name.trim()}`,
        body: `${group.name} · Added manually`,
        link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${team.tournamentId}`,
        excludeUserIds: [ctx.user.id],
      }).catch(console.error);

      return new Response(JSON.stringify({ success: true, id }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── update ────────────────────────────────────────────────────────────────
    // Only what the Teams screen edits, as columns (lib/team-update-allowlist.ts): an unknown key, a bad value or
    // a malformed id refuses the whole request before anything is read.
    const read = readTeamUpdates(body);
    if (!read.ok) return badUpdate(read.error);
    const items = read.items;
    const ids = items.map(i => i.id);

    // Fetch current records for email comparison and scope enforcement
    const { data: currents } = await supabaseAdmin
      .from('teams')
      .select('*')
      .in('id', ids);

    if (!currents) throw new Error('Could not find records to update');

    // Org check (runs for owners too): every team must belong to a tournament in the caller's org
    for (const tId of new Set((currents as Array<{ tournament_id: string }>).map(t => t.tournament_id))) {
      const wrongOrg = await requireTournamentInOrg(ctx, tId);
      if (wrongOrg) return wrongOrg;
    }

    // Scope check: all teams must belong to an assigned tournament
    if (ctx.assignedTournamentIds !== null) {
      for (const team of currents) {
        const denied = scopeGuard(ctx, team.tournament_id);
        if (denied) return denied;
      }
    }

    // One tournament per request — the lock, the fees and the email names below are read from it.
    if (new Set((currents as Array<{ tournament_id: string | null }>).map(t => t.tournament_id)).size > 1) {
      return badUpdate(TEAM_UPDATE_REFUSALS.oneTournament);
    }
    const bulkTournamentId = (currents[0] as any)?.tournament_id;
    if (bulkTournamentId && await isTournamentLocked(bulkTournamentId)) return tournamentLockedResponse();

    const currentById = new Map((currents as any[]).map(t => [t.id, t]));

    // A pool must be one of the team's own division's, in its own tournament — checked against the rows the
    // update would point at, not only the team's current tournament.
    const poolIds = poolIdsToCheck(items);
    if (poolIds.length) {
      const { data: poolRows, error: poolErr } = await supabaseAdmin
        .from('pools').select('id, division_id, divisions(tournament_id)').in('id', poolIds);
      if (poolErr) throw poolErr;
      const pools = new Map((poolRows ?? []).map((p: any) => [p.id as string, {
        division_id: p.division_id as string,
        tournament_id: ((Array.isArray(p.divisions) ? p.divisions[0] : p.divisions)?.tournament_id ?? null) as string | null,
      }]));
      if (poolOutsideDivision(items, currentById, pools)) return badUpdate(TEAM_UPDATE_REFUSALS.pool);
    }

    // FieldLogicHQ staff are not coaches — the same refusal Add team gives (above) and the coach's own screen gives.
    for (const email of emailsToCheck(items)) {
      if (await isPlatformAdminEmail(email)) return badUpdate(TEAM_UPDATE_REFUSALS.staffEmail);
    }

    // Organizer-authored payment instructions (tournament-wide) for the acceptance email, plus the
    // per-tournament coach-email switches, the REAL tournament + division names, and the organizer
    // contact — so status emails don't ship "Tournament"/"Division" placeholders (J5-056) or fall
    // back to the platform inbox as the contact (J5-057).
    let bulkPaymentInstructions: string | undefined;
    let bulkCoachSettings: unknown = null;
    let bulkTournamentName = 'Tournament';
    let bulkContactEmail: string | undefined;
    let bulkFeeMode: string | null = null;
    let bulkTournamentFee: { depositAmount: number | null; depositDueDate: string | null; totalFeeAmount: number | null; totalFeeDueDate: string | null } | null = null;
    type BulkDivisionFee = { name: string; deposit_amount: number | null; deposit_due_date: string | null; total_fee_amount: number | null; total_fee_due_date: string | null };
    const bulkDivisions = new Map<string, BulkDivisionFee>();
    if (bulkTournamentId) {
      const { data: bulkTournament } = await supabaseAdmin
        .from('tournaments')
        .select('name, contact_email, org_id, settings, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
        .eq('id', bulkTournamentId)
        .single();
      bulkCoachSettings = bulkTournament?.settings ?? null;
      bulkTournamentName = bulkTournament?.name ?? 'Tournament';
      bulkFeeMode = bulkTournament?.fee_schedule_mode ?? null;
      bulkTournamentFee = {
        depositAmount: bulkTournament?.deposit_amount ?? null,
        depositDueDate: bulkTournament?.deposit_due_date ?? null,
        totalFeeAmount: bulkTournament?.total_fee_amount ?? null,
        totalFeeDueDate: bulkTournament?.total_fee_due_date ?? null,
      };
      const raw = (bulkTournament?.settings as { payment_instructions?: unknown } | null)?.payment_instructions;
      if (typeof raw === 'string') bulkPaymentInstructions = raw;

      const bulkOrgId = bulkTournament?.org_id ?? null;
      const bulkFallback = bulkOrgId ? (await getOrgOwnerEmail(bulkOrgId)) ?? null : null;
      bulkContactEmail = (await resolveTournamentContactEmail(bulkTournamentId, bulkFallback, 'coach')) ?? undefined;

      const divIds = [...new Set((currents as Array<{ division_id: string | null }>).map(t => t.division_id).filter(Boolean) as string[])];
      if (divIds.length) {
        const { data: divs } = await supabaseAdmin
          .from('divisions').select('id, name, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date').in('id', divIds);
        for (const d of divs ?? []) bulkDivisions.set(d.id, { name: d.name, deposit_amount: d.deposit_amount, deposit_due_date: d.deposit_due_date, total_fee_amount: d.total_fee_amount, total_fee_due_date: d.total_fee_due_date });
      }
    }

    // The invite-only event (B2): the server holds what the screens hide — no payment or check-in write on a plan
    // without them, and on an invite-only event only a team still waiting can be answered (M10). Paid plans unchanged.
    for (const item of items) {
      const current = (currents as Array<{ id: string; status: string | null }>).find(c => c.id === item.id);
      if (!teamUpdateAllowed(ctx.org.planId, current?.status, item.updates ?? {})) return inviteOnlyRefusal();
    }

    // A "Mark paid" is a recorded payment (mig 345): the rest of the fee, dated today, in one locked step — the same payment
    // the Record button makes, so "Paid" reconciles to $0 owed on the coach side too (J5-026). A team with no fee schedule
    // has nothing to pay, so only its status is marked. The paid figures are never written from here: the database keeps them
    // as the sum of the team's payments (tests/unit/team-payments-guard.test.ts).
    const paidNow = new Map<string, number>();
    const markedByPayment = new Set<string>();
    // 12c Part 6 (words §3.2): a bank debit on its way is the payment; it goes in the record when it clears. Checked for
    // the whole batch FIRST, so a refusal never leaves the teams before it already paid (review 2026-10-26).
    const toMark = items.filter(i => i.updates.payment_status === 'paid').map(i => i.id);
    if (toMark.length) {
      const { data: clearingRows } = await supabaseAdmin.from('online_payments').select('team_id').in('team_id', toMark).eq('status', 'clearing');
      const clearingTeam = (clearingRows ?? [])[0]?.team_id as string | undefined;
      if (clearingTeam) {
        return Response.json({ error: TEAM_RECORD_WORDS.clearingMarkPaid(String(currentById.get(clearingTeam)?.name ?? 'this team')) }, { status: 409 });
      }
    }
    for (const item of items) {
      const current = currentById.get(item.id);
      if (item.updates.payment_status === 'paid') {
        const paid = await payTeamDue({ teamId: item.id, actorId: ctx.user.id, scope: 'all' });
        if ('error' in paid) return paymentErrorResponse(paid.error, ctx.org.id);
        // Only a payment that was actually recorded moved the status. Nothing due (the fee was lowered after it was paid in
        // full) leaves the status to this update, so the team reads paid.
        if (!paid.outcome.noFee && paid.outcome.recorded) {
          markedByPayment.add(item.id);
          if (paid.outcome.becamePaid) paidNow.set(item.id, paid.outcome.total);
        }
      } else if (item.updates.payment_status === 'pending' && Number(current?.total_paid ?? 0) > 0) {
        // The payments are what make a team paid: taking it back to unpaid means removing them, one at a time.
        return badUpdate(TEAM_UPDATE_REFUSALS.removePayments);
      }
    }
    const updateData = items.map(item => {
      // The checked columns, copied. A payment recorded above already moved the status, so it is not written again.
      const dbUpdates: TeamUpdateColumns & Record<string, unknown> = { ...item.updates };
      if (markedByPayment.has(item.id)) delete dbUpdates.payment_status;
      return { id: item.id, updates: dbUpdates };
    });

    for (const item of updateData) {
      if (Object.keys(item.updates).length === 0) continue;
      const paymentChanged = 'payment_status' in item.updates;
      const stampedUpdates = paymentChanged ? { ...item.updates, fee_changed_by: ctx.user.id } : item.updates;
      const { error: updateErr } = await supabaseAdmin
        .from('teams')
        .update(stampedUpdates)
        .eq('id', item.id);
      if (updateErr) throw updateErr;
    }

    // F6 (owner-ratified 2026-07-29) — this loop is where a team changes status, which changes who
    // belongs in that event's chat rooms (a division change did too; this route no longer makes one).
    // Refresh here, at the write, instead of leaving room membership (and the dashboard's "in the
    // chat" count) stale until somebody opens the admin chat screen.
    //
    // Only for edits that can actually move someone: a rename or a payment update touches no room,
    // and this reconciles every room of the tournament, so firing it unconditionally would do real
    // work on every roster edit for nothing.
    //
    // AWAITED, not fire-and-forget — Amplify has no waitUntil bridge, so a detached promise can be
    // frozen the moment the response is sent and silently never run, reintroducing the exact
    // staleness this closes. The helper swallows its own failures, so it can't fail a roster edit.
    const chatRelevantTournamentIds = new Set(
      updateData
        .filter(u => 'status' in u.updates)
        .map(u => (currents as Array<{ id: string; tournament_id: string | null }>)
          .find(c => c.id === u.id)?.tournament_id)
        .filter(Boolean) as string[],
    );
    for (const tId of chatRelevantTournamentIds) {
      await refreshTournamentChatMembership(tId);
    }

    // Release slots for teams being rejected
    for (const item of items) {
      if (item.updates.status !== 'rejected') continue;
      const current = currents.find((c: any) => c.id === item.id);
      if (!current || current.status === 'rejected' || !current.slot_id) continue;
      await supabaseAdmin.from('pool_slots').update({ team_id: null }).eq('id', current.slot_id);
      await supabaseAdmin.from('teams').update({ slot_id: null }).eq('id', item.id);
    }

    // J1-066: claim a slot for teams transitioning into 'accepted' in a
    // slot-configured division, so they stay on the board instead of vanishing.
    // No-op when the division has no empty slot — the team then surfaces in the
    // always-on "Unplaced" attention list.
    for (const item of items) {
      if (item.updates.status !== 'accepted') continue;
      const current = currents.find((c: any) => c.id === item.id);
      if (!current || current.status === 'accepted') continue;
      if (current.slot_id) continue;
      await claimNextOpenSlot(item.id, current.division_id);
    }

    // A free coach's bell (Free coach header parity, 2026-10-13): the same three moments, collected here and
    // written after the emails — OUTSIDE the host's email switches (A6), to every coach on the team (A5).
    const bellAccepted: string[] = [];
    const bellDeclined: string[] = [];

    // Handle Emails. The registration emails never fire on an invite-only event (the free tournament tier, Part 3): a
    // team still waiting there (R2) is answered on the screen and told by its coach's bell, below.
    const inviteOnlyEmails = runsInviteOnlyEvents(ctx.org.planId);
    const ourTeams = await ourTeamIdsAmong(ids);
    for (const item of items) {
      const current = currents.find((c: any) => c.id === item.id);
      if (!current) continue;

      const p = {
        teamName:       current.name,
        coachName:      current.coach,
        divisionName:   bulkDivisions.get(current.division_id)?.name ?? 'Division',
        tournamentName: bulkTournamentName,
        teamId:         current.id,
        coachEmail:     current.email,
        contactEmail:   bulkContactEmail,
      };
      // Route to the assigned coach (teams.coach_email) when set, else teams.email (the claim key,
      // which the footer keeps using — teams.email is never overwritten).
      const recipient = resolveCoachRecipient(current);

      const updates = item.updates;
      if (updates.status === 'accepted' && current.status !== 'accepted') {
        bellAccepted.push(current.id);
        if (!inviteOnlyEmails && !coachEmailBlock(bulkCoachSettings, 'acceptance', current)) {
          // J5-063: state the amount owed (deposit-first) — skipped for an already-paid team, including
          // when this same update marks it paid (effective post-update status).
          const div = bulkDivisions.get(current.division_id);
          // Our own team owes no entry fee (owner 2026-10-21), so it reads as nothing owed too.
          const willBePaid = current.payment_status === 'paid' || updates.payment_status === 'paid' || paidNow.has(current.id) || ourTeams.has(current.id);
          // "Not tracked here": the email has no Payment panel at all (no amount, no how-to-pay).
          const paymentsTracked = tournamentTracksPayments(bulkCoachSettings);
          const feeLine = willBePaid || !paymentsTracked ? undefined : acceptanceFeeLine({
            feeMode: bulkFeeMode,
            tournament: bulkTournamentFee,
            division: div ? { depositAmount: div.deposit_amount, depositDueDate: div.deposit_due_date, totalFeeAmount: div.total_fee_amount, totalFeeDueDate: div.total_fee_due_date } : null,
          });
          // Club Tier Stage 12a: Pay now while the club takes payments online (the team is accepted by now; absent → today's email).
          const pay = paymentsTracked && !willBePaid ? await teamPayNowLink(current.id) : null;
          await sendEmail(recipient, `Your Team Has Been Accepted — ${current.name}`, acceptanceHtml({ ...p, paymentInstructions: bulkPaymentInstructions, feeLine, paymentsTracked, payUrl: pay?.url ?? null }), { kind: 'tournament_registration_accepted', orgId: ctx.org.id, askedBy: ctx.user.id });
        }
        // Notify other org admins of the status change (fire-and-forget)
        notify({
          orgId: ctx.org.id,
          tournamentId: current.tournament_id,
          eventType: 'registration_status_changed',
          title: `Registration accepted: ${current.name}`,
          body: 'Team status changed to accepted',
          link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${current.tournament_id}`,
          excludeUserIds: [ctx.user.id],
        }).catch(console.error);
      }
      if (updates.status === 'rejected' && current.status !== 'rejected') {
        bellDeclined.push(current.id);
        if (!inviteOnlyEmails && !coachEmailBlock(bulkCoachSettings, 'rejection', current)) {
          await sendEmail(recipient, `Registration Update — ${current.name}`, rejectionHtml(p), { kind: 'tournament_registration_rejected', orgId: ctx.org.id, askedBy: ctx.user.id });
        }
        // 5m: a rejected team is no longer playing — cancel any scheduled game-day reminder.
        if (recipient) await cancelScheduledEmailForRecipient(ctx.org.id, COACH_GAME_DAY_REMINDER_EMAIL_KEY, recipient);
        // Notify other org admins of the status change (fire-and-forget)
        notify({
          orgId: ctx.org.id,
          tournamentId: current.tournament_id,
          eventType: 'registration_status_changed',
          title: `Registration declined: ${current.name}`,
          body: 'Team status changed to rejected',
          link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${current.tournament_id}`,
          excludeUserIds: [ctx.user.id],
        }).catch(console.error);
      }
      if (updates.status === 'waitlist' && current.status !== 'waitlist') {
        notify({
          orgId: ctx.org.id,
          tournamentId: current.tournament_id,
          eventType: 'registration_status_changed',
          title: `Registration waitlisted: ${current.name}`,
          body: 'Team status changed to waitlist',
          link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${current.tournament_id}`,
          excludeUserIds: [ctx.user.id],
        }).catch(console.error);
      }
      // The payment that completes a team's fee (a recorded payment) or a status-only "paid" for a team with no fee schedule:
      // the coach's email, the host's bell and the coach's bell, in one place (lib/team-payment-notices.ts).
      const completedFee = paidNow.has(current.id);
      if (completedFee || (updates.payment_status === 'paid' && current.payment_status !== 'paid')) {
        await announceTeamPaid(ctx, current.id, paidNow.get(current.id) ?? null);
      }
    }

    // Awaited together, never thrown: a notice can't fail the organizer's change (lib/team-coach-notices).
    await Promise.all([
      notifyTeamCoaches({ registrationIds: bellAccepted, eventType: 'team_coach_accepted', compose: TEAM_COACH_WORDS.accepted, excludeUserIds: [ctx.user.id] }),
      notifyTeamCoaches({ registrationIds: bellDeclined, eventType: 'team_coach_declined', compose: TEAM_COACH_WORDS.declined, excludeUserIds: [ctx.user.id] }),
    ]);

    return new Response(JSON.stringify({ success: true, count: items.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Admin Teams API Error:', err);
    void captureError(err, { ctx, route: '/api/admin/teams', method: 'POST', statusCode: 500 });
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { route: '/api/admin/teams' });

export const DELETE = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { ids, force } = await req.json();

    // Look up the teams to verify org ownership (always — incl. owners) and tournament scope (scoped users)
    if (ids?.length) {
      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('tournament_id')
        .in('id', ids);

      for (const tId of new Set((teams ?? []).map(t => t.tournament_id as string))) {
        const wrongOrg = await requireTournamentInOrg(ctx, tId);
        if (wrongOrg) return wrongOrg;
        // A finished event's teams stay, as every other write here refuses a completed tournament (2026-10-16).
        if (await isTournamentLocked(tId)) return tournamentLockedResponse();
      }

      if (ctx.assignedTournamentIds !== null) {
        for (const team of teams ?? []) {
          const denied = scopeGuard(ctx, team.tournament_id);
          if (denied) return denied;
        }
      }
    }

    // Deleting a team is destructive to SCHEDULE history, not just the roster row: every game
    // the team played references it, and those rows are the OPPONENT's record of the fixture
    // (and its score) too. Prod's FK was ON DELETE CASCADE until migration 200, so this
    // endpoint silently destroyed scored games; the FK is now SET NULL in both environments,
    // which preserves the game but strands it with an empty side. Neither outcome should be a
    // surprise, so a team with games requires an explicit acknowledgement.
    if (ids?.length) {
      // ids reach a PostgREST filter STRING, so they are validated as UUIDs first — an
      // unvalidated value here would be filter injection, not just a bad query.
      const safeIds = (ids as unknown[]).filter(
        (id): id is string =>
          typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
      );
      if (safeIds.length !== ids.length) {
        return new Response(JSON.stringify({ error: 'Invalid team id' }), { status: 400 });
      }
      const idList = safeIds.join(',');
      const { data: linkedGames } = await supabaseAdmin
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score')
        .or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`);

      const affected = linkedGames ?? [];
      // Strict `!== true` — only a literal boolean confirmation skips the guard (see the divisions
      // guard for the same reasoning); a stray truthy value must never bypass a data-loss prompt.
      if (affected.length > 0 && force !== true) {
        const scored = affected.filter(g => g.home_score !== null || g.away_score !== null).length;
        return new Response(
          JSON.stringify({
            error: 'TEAM_HAS_GAMES',
            message:
              `This team appears in ${affected.length} game${affected.length === 1 ? '' : 's'}` +
              `${scored > 0 ? ` (${scored} with a recorded score)` : ''}. ` +
              `Deleting it leaves those games without that side — the opponent's record and score are kept. ` +
              `Remove or reassign the games first, or confirm to continue.`,
            gameCount: affected.length,
            scoredGameCount: scored,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    const { error } = await supabaseAdmin.from('teams').delete().in('id', ids);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    void captureError(err, { ctx, route: '/api/admin/teams', method: 'DELETE', statusCode: 500 });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}, { route: '/api/admin/teams' });
