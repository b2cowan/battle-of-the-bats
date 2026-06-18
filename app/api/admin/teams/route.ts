import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml, manualTeamRegistrationHtml,
  coachEmailEnabled, resolveCoachRecipient, acceptanceFeeLine,
} from '@/lib/email';
import { cancelScheduledEmailForRecipient, COACH_GAME_DAY_REMINDER_EMAIL_KEY } from '@/lib/email-sender';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { captureError, withObservability } from '@/lib/observability';

function tournamentLockedResponse() {
  return new Response(
    JSON.stringify({ error: 'This tournament is completed and locked. Set the status to Active in Event Settings to make changes.' }),
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
import { effectiveFee, markPaidInFullPatch } from '@/lib/mark-paid';
import { notify } from '@/lib/notify';
import {
  duplicateTournamentTeamMessage,
  findDuplicateTournamentTeam,
} from '@/lib/team-registration-duplicates';
import { claimNextOpenSlot } from '@/lib/slot-claim';

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

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
    // Assigns a waitlisted team to a specific slot, or to the lowest empty slot.
    // Body: { action, teamId, slotId? }
    if (body.action === 'promote-from-waitlist') {
      const { teamId, slotId: targetSlotId } = body as { teamId: string; slotId?: string };

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

      let slotId = targetSlotId ?? null;

      if (!slotId) {
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
        slotId = sorted[0].id;
      }

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
        supabaseAdmin.from('pool_slots').select('id, team_id, tournament_id').eq('id', slotAId).single(),
        supabaseAdmin.from('pool_slots').select('id, team_id').eq('id', slotBId).single(),
      ]);

      if (!slotA || !slotB) {
        return new Response(JSON.stringify({ error: 'One or both slots not found' }), { status: 404 });
      }

      const denied = scopeGuard(ctx, slotA.tournament_id);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, slotA.tournament_id);
      if (wrongOrg) return wrongOrg;
      if (await isTournamentLocked(slotA.tournament_id)) return tournamentLockedResponse();

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

    // ── bulk update ───────────────────────────────────────────────────────────
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
        .select('id, name, contact_email')
        .eq('id', team.tournamentId)
        .single();

      const id = crypto.randomUUID();
      const paymentStatus = team.paymentStatus === 'paid' ? 'paid' : 'pending';
      const { error: insertErr } = await supabaseAdmin.from('teams').insert({
        id,
        tournament_id: team.tournamentId,
        division_id: team.divisionId,
        name: team.name.trim(),
        coach: team.coach?.trim() ?? '',
        email: team.email?.trim() ?? '',
        status: team.status ?? 'accepted',
        payment_status: paymentStatus,
        registered_at: new Date().toISOString(),
      });

      if (insertErr) throw insertErr;

      if (team.notifyTeam && team.email?.trim()) {
        await sendEmail(
          team.email.trim(),
          `Team Registered - ${team.name.trim()}`,
          manualTeamRegistrationHtml({
            teamName: team.name.trim(),
            coachName: team.coach?.trim() ?? '',
            divisionName: group.name ?? 'Division',
            tournamentName: tournament?.name ?? 'Tournament',
            paymentStatus,
            contactEmail: tournament?.contact_email ?? ctx.org.contactEmail ?? undefined,
            registrationId: id,
            coachEmail: team.email.trim(),
          })
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

    let items: { id: string; updates: any }[] = [];
    if (body.ids && body.updates) {
      items = body.ids.map((id: string) => ({ id, updates: body.updates }));
    } else if (Array.isArray(body.updates)) {
      items = body.updates;
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), { status: 400 });
    }
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

    // Lock check: use the first record's tournament (bulk ops always target one tournament)
    const bulkTournamentId = (currents[0] as any)?.tournament_id;
    if (bulkTournamentId && await isTournamentLocked(bulkTournamentId)) return tournamentLockedResponse();

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

    // J5-026: when an update marks a team paid, stamp the paid-in-full AMOUNTS the same way the
    // bulk "Mark Paid in Full" path does — not just the raw status. The single-row toggle posts
    // { paymentStatus:'paid' } here; without the amounts the coach portal's resolver still shows
    // "OWED" for fee-schedule teams. Load the tournament fee + division fee map once, only when a
    // paid-mark is actually present, and only enrich updates that don't already pass amounts.
    const marksPaid = items.some(i => i.updates?.paymentStatus === 'paid' || i.updates?.payment_status === 'paid');
    let feeTournament: { fee_schedule_mode: string | null; deposit_amount: number | null; total_fee_amount: number | null } | null = null;
    const divisionFeeMap = new Map<string, { deposit_amount: number | null; total_fee_amount: number | null }>();
    if (marksPaid && bulkTournamentId) {
      const { data: ft } = await supabaseAdmin
        .from('tournaments').select('fee_schedule_mode, deposit_amount, total_fee_amount').eq('id', bulkTournamentId).single();
      feeTournament = ft ?? null;
      if (ft?.fee_schedule_mode === 'division') {
        const divIds = [...new Set((currents as Array<{ division_id: string | null }>).map(t => t.division_id).filter(Boolean) as string[])];
        if (divIds.length) {
          const { data: divs } = await supabaseAdmin
            .from('divisions').select('id, deposit_amount, total_fee_amount').in('id', divIds);
          for (const d of divs ?? []) divisionFeeMap.set(d.id, { deposit_amount: d.deposit_amount, total_fee_amount: d.total_fee_amount });
        }
      }
    }
    const currentById = new Map((currents as any[]).map(t => [t.id, t]));

    const updateData = items.map(item => {
      const dbUpdates: any = { ...item.updates };
      if (dbUpdates.poolId !== undefined) {
        dbUpdates.pool_id = dbUpdates.poolId || null;
        delete dbUpdates.poolId;
      }
      if (dbUpdates.paymentStatus !== undefined) {
        dbUpdates.payment_status = dbUpdates.paymentStatus;
        delete dbUpdates.paymentStatus;
      }
      if (dbUpdates.depositPaid !== undefined) {
        dbUpdates.deposit_paid = dbUpdates.depositPaid;
        delete dbUpdates.depositPaid;
      }
      if (dbUpdates.totalPaid !== undefined) {
        dbUpdates.total_paid = dbUpdates.totalPaid;
        delete dbUpdates.totalPaid;
      }
      if (dbUpdates.slotId !== undefined) {
        dbUpdates.slot_id = dbUpdates.slotId ?? null;
        delete dbUpdates.slotId;
      }
      if (dbUpdates.waitlistPosition !== undefined) {
        dbUpdates.waitlist_position = dbUpdates.waitlistPosition ?? null;
        delete dbUpdates.waitlistPosition;
      }
      if (dbUpdates.adminNotes !== undefined) {
        dbUpdates.admin_notes = dbUpdates.adminNotes;
        delete dbUpdates.adminNotes;
      }
      if (dbUpdates.seed !== undefined) {
        const n = Number(dbUpdates.seed);
        dbUpdates.seed = Number.isInteger(n) && n > 0 && n <= 999 ? n : null;
      }
      // J5-026: enrich a paid-mark with the paid-in-full amounts (unless the caller already passed
      // them explicitly), so "Paid" reconciles to $0 owed on the coach side too.
      if (
        feeTournament &&
        dbUpdates.payment_status === 'paid' &&
        dbUpdates.total_paid === undefined &&
        dbUpdates.deposit_paid === undefined
      ) {
        const current = currentById.get(item.id);
        if (current) {
          const fee = effectiveFee(current, feeTournament, divisionFeeMap.get(current.division_id) ?? null);
          Object.assign(dbUpdates, markPaidInFullPatch(current, fee));
        }
      }
      return { id: item.id, updates: dbUpdates };
    });

    for (const item of updateData) {
      const { error: updateErr } = await supabaseAdmin
        .from('teams')
        .update(item.updates)
        .eq('id', item.id);
      if (updateErr) throw updateErr;
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
    // always-on "Unplaced" attention list. Skip teams the same update already
    // placed into a slot (item carried an explicit slotId).
    for (const item of items) {
      if (item.updates.status !== 'accepted') continue;
      const current = currents.find((c: any) => c.id === item.id);
      if (!current || current.status === 'accepted') continue;
      if (current.slot_id || item.updates.slotId || item.updates.slot_id) continue;
      await claimNextOpenSlot(item.id, current.division_id);
    }

    // Handle Emails
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
        if (recipient && coachEmailEnabled(bulkCoachSettings, 'acceptance')) {
          // J5-063: state the amount owed (deposit-first) — skipped for an already-paid team, including
          // when this same update marks it paid (effective post-update status).
          const div = bulkDivisions.get(current.division_id);
          const willBePaid = current.payment_status === 'paid' || updates.payment_status === 'paid' || updates.paymentStatus === 'paid';
          const feeLine = willBePaid ? undefined : acceptanceFeeLine({
            feeMode: bulkFeeMode,
            tournament: bulkTournamentFee,
            division: div ? { depositAmount: div.deposit_amount, depositDueDate: div.deposit_due_date, totalFeeAmount: div.total_fee_amount, totalFeeDueDate: div.total_fee_due_date } : null,
          });
          await sendEmail(recipient, `Your Team Has Been Accepted — ${current.name}`, acceptanceHtml({ ...p, paymentInstructions: bulkPaymentInstructions, feeLine }));
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
        if (recipient && coachEmailEnabled(bulkCoachSettings, 'rejection')) {
          await sendEmail(recipient, `Registration Update — ${current.name}`, rejectionHtml(p));
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
      if ((updates.payment_status === 'paid' || updates.paymentStatus === 'paid') && current.payment_status !== 'paid') {
        if (recipient && coachEmailEnabled(bulkCoachSettings, 'payment')) {
          await sendEmail(recipient, `Payment Recorded — ${current.name}`, paymentConfirmationHtml(p));
        }
        // Notify org admins of received payment (fire-and-forget)
        notify({
          orgId: ctx.org.id,
          tournamentId: current.tournament_id,
          eventType: 'payment_received',
          title: `Payment received: ${current.name}`,
          body: 'Team payment recorded as paid',
          link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${current.tournament_id}`,
          excludeUserIds: [ctx.user.id],
        }).catch(console.error);
      }
    }

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
    const { ids } = await req.json();

    // Look up the teams to verify org ownership (always — incl. owners) and tournament scope (scoped users)
    if (ids?.length) {
      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('tournament_id')
        .in('id', ids);

      for (const tId of new Set((teams ?? []).map(t => t.tournament_id as string))) {
        const wrongOrg = await requireTournamentInOrg(ctx, tId);
        if (wrongOrg) return wrongOrg;
      }

      if (ctx.assignedTournamentIds !== null) {
        for (const team of teams ?? []) {
          const denied = scopeGuard(ctx, team.tournament_id);
          if (denied) return denied;
        }
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
