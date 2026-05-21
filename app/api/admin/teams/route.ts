import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
} from '@/lib/email';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getTournamentRegistrationFieldAnswersForRegistrations,
  getTournamentRegistrationFields,
} from '@/lib/db';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const teams = (data ?? []).map((t: any) => ({
    id: t.id,
    tournamentId: t.tournament_id,
    ageGroupId: t.age_group_id,
    name: t.name,
    coach: t.coach,
    email: t.email,
    players: t.players || [],
    status: t.status || 'accepted',
    paymentStatus: t.payment_status || 'paid',
    registered_at: t.registered_at,
    registeredAt: t.registered_at,
    adminNotes: t.admin_notes,
    poolId: t.pool_id,
    waitlistPosition: t.waitlist_position ?? null,
    slotId: t.slot_id ?? null,
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
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
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

      if (!hasPlanFeature(ctx.org.planId, 'waitlist_automation')) {
        return new Response(JSON.stringify({ error: requiresTournamentPlusCopy('waitlist_automation') }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let slotId = targetSlotId ?? null;

      if (!slotId) {
        // Find lowest empty slot for this age group, ordered by pool then slot_number
        const { data: emptySlots } = await supabaseAdmin
          .from('pool_slots')
          .select('id, slot_number, pools(display_order)')
          .eq('age_group_id', team.age_group_id)
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
        .eq('age_group_id', team.age_group_id)
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
          ageGroupId: team.age_group_id,
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
    let items: { id: string; updates: any }[] = [];
    if (body.ids && body.updates) {
      items = body.ids.map((id: string) => ({ id, updates: body.updates }));
    } else if (Array.isArray(body.updates)) {
      items = body.updates;
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), { status: 400 });
    }
    if (items.length > 1 && !hasPlanFeature(ctx.org.planId, 'bulk_registration_actions')) {
      return new Response(JSON.stringify({ error: requiresTournamentPlusCopy('bulk_registration_actions') }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ids = items.map(i => i.id);

    // Fetch current records for email comparison and scope enforcement
    const { data: currents } = await supabaseAdmin
      .from('teams')
      .select('*')
      .in('id', ids);

    if (!currents) throw new Error('Could not find records to update');

    // Scope check: all teams must belong to an assigned tournament
    if (ctx.assignedTournamentIds !== null) {
      for (const team of currents) {
        const denied = scopeGuard(ctx, team.tournament_id);
        if (denied) return denied;
      }
    }

    const upsertData = items.map(item => {
      const dbUpdates: any = { id: item.id, ...item.updates };
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
      return dbUpdates;
    });

    const { error: updateErr } = await supabaseAdmin.from('teams').upsert(upsertData);
    if (updateErr) throw updateErr;

    // Release slots for teams being rejected
    for (const item of items) {
      if (item.updates.status !== 'rejected') continue;
      const current = currents.find((c: any) => c.id === item.id);
      if (!current || current.status === 'rejected' || !current.slot_id) continue;
      await supabaseAdmin.from('pool_slots').update({ team_id: null }).eq('id', current.slot_id);
      await supabaseAdmin.from('teams').update({ slot_id: null }).eq('id', item.id);
    }

    // Handle Emails
    for (const item of items) {
      const current = currents.find((c: any) => c.id === item.id);
      if (!current) continue;

      const p = {
        teamName:       current.name,
        coachName:      current.coach,
        ageGroupName:   'Division',
        tournamentName: 'Tournament',
        teamId:         current.id,
      };

      const updates = item.updates;
      if (updates.status === 'accepted' && current.status !== 'accepted') {
        await sendEmail(current.email, `Your Team Has Been Accepted — ${current.name}`, acceptanceHtml(p));
      }
      if (updates.status === 'rejected' && current.status !== 'rejected') {
        await sendEmail(current.email, `Registration Update — ${current.name}`, rejectionHtml(p));
      }
      if ((updates.payment_status === 'paid' || updates.paymentStatus === 'paid') && current.payment_status !== 'paid') {
        await sendEmail(current.email, `Payment Recorded — ${current.name}`, paymentConfirmationHtml(p));
      }
    }

    return new Response(JSON.stringify({ success: true, count: items.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Admin Teams API Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { ids } = await req.json();

    // Scope check: look up the teams to verify tournament membership
    if (ctx.assignedTournamentIds !== null && ids?.length) {
      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('tournament_id')
        .in('id', ids);

      for (const team of teams ?? []) {
        const denied = scopeGuard(ctx, team.tournament_id);
        if (denied) return denied;
      }
    }

    const { error } = await supabaseAdmin.from('teams').delete().in('id', ids);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
