import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
} from '@/lib/email';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const body = await req.json();

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
      return dbUpdates;
    });

    const { error: updateErr } = await supabaseAdmin.from('teams').upsert(upsertData);
    if (updateErr) throw updateErr;

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
        await sendEmail(current.email, `Payment Confirmed — ${current.name}`, paymentConfirmationHtml(p));
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
