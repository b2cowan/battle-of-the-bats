import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import {
  buildCancellationPreflight,
  retentionDeadline,
  writeOrgBillingAudit,
} from '@/lib/billing-retention';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;

  const preflight = await buildCancellationPreflight(ctx.org);
  const retentionUntil = retentionDeadline();
  const actorEmail = ctx.user.email ?? null;

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .insert({
      org_id: ctx.org.id,
      intent_type: 'cancellation',
      status: 'applied',
      from_plan: ctx.org.planId,
      target_plan: null,
      keep_tournament_ids: [],
      retention_until: retentionUntil,
      reason,
      created_by: ctx.user.id,
      created_by_email: actorEmail,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (intentError) return Response.json({ error: intentError.message }, { status: 500 });

  if (preflight.tournaments.length > 0) {
    const retainedIds = preflight.tournaments.map(t => t.id);
    const { error: archiveError } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'archived', is_active: false })
      .eq('organization_id', ctx.org.id)
      .in('id', retainedIds);
    if (archiveError) return Response.json({ error: archiveError.message }, { status: 500 });

    const { error: recordError } = await supabaseAdmin
      .from('billing_retained_records')
      .insert(preflight.tournaments.map(t => ({
        intent_id: intent.id,
        org_id: ctx.org.id,
        record_type: 'tournament',
        record_id: t.id,
        display_name: t.name,
        retained_state: 'retained_inactive',
        retention_until: retentionUntil,
        metadata: {
          previousStatus: t.status,
          slug: t.slug,
          year: t.year,
          startDate: t.startDate,
          endDate: t.endDate,
          retentionReason: 'account_cancellation',
          fromPlan: ctx.org.planId,
        },
      })));
    if (recordError) return Response.json({ error: recordError.message }, { status: 500 });
  }

  const { error: accountRecordError } = await supabaseAdmin
    .from('billing_retained_records')
    .insert({
      intent_id: intent.id,
      org_id: ctx.org.id,
      record_type: 'account',
      record_id: null,
      display_name: ctx.org.name,
      retained_state: 'retained_inactive',
      retention_until: retentionUntil,
      metadata: {
        retentionReason: 'account_cancellation',
        fromPlan: ctx.org.planId,
        moduleShutdown: preflight.shutsDown,
      },
    });
  if (accountRecordError) return Response.json({ error: accountRecordError.message }, { status: 500 });

  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      is_public: false,
      billing_suspended_at: new Date().toISOString(),
      billing_suspension_reason: reason,
    })
    .eq('id', ctx.org.id);
  if (orgError) return Response.json({ error: orgError.message }, { status: 500 });

  await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_cancellation_confirmed', {
    fromPlan: ctx.org.planId,
    retainedTournamentIds: preflight.tournaments.map(t => t.id),
    retentionUntil,
  });

  return Response.json({
    ok: true,
    retainedCount: preflight.tournaments.length + 1,
    retentionUntil,
  });
}
