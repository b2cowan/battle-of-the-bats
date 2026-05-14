import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';

const STARTUP_TASK_IDS = ['tournament', 'divisions', 'welcome', 'venues', 'contacts'];

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

function hasStoredSavedStartupWork(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const tasks = value as Record<string, { status?: unknown } | undefined>;
  return STARTUP_TASK_IDS.some(taskId => {
    const status = tasks[taskId]?.status;
    return status === 'complete';
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only organization owners can change onboarding plans.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body?.planKey !== 'tournament') {
    return NextResponse.json({ error: 'Only the free Tournament plan can be selected here.' }, { status: 400 });
  }

  if (ctx.org.onboardingCompletedAt) {
    return NextResponse.json({ error: 'Plan changes after onboarding should be managed from Subscription.' }, { status: 409 });
  }

  const [{ count: tournamentCount, error: tournamentError }, startupRead] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.org.id)
      .neq('status', 'archived'),
    supabaseAdmin
      .from('organizations')
      .select('startup_tasks')
      .eq('id', ctx.org.id)
      .single(),
  ]);

  if (tournamentError) {
    return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  }

  if (startupRead.error && !isMissingStartupTasksColumn(startupRead.error)) {
    return NextResponse.json({ error: startupRead.error.message }, { status: 500 });
  }

  const hasStartupTasksStorage = !startupRead.error;

  if ((tournamentCount ?? 0) > 0 || hasStoredSavedStartupWork(startupRead.data?.startup_tasks)) {
    return NextResponse.json({ error: 'Plan selection is locked after setup has started.' }, { status: 409 });
  }

  const subscriptionId = ctx.org.stripeSubscriptionId ?? '';
  if (subscriptionId && !subscriptionId.startsWith('mock_sub_')) {
    return NextResponse.json({ error: 'This subscription must be changed from Subscription.' }, { status: 409 });
  }

  const updatePayload: Record<string, unknown> = {
    plan_id: 'tournament',
    tournament_limit: PLAN_CONFIG.tournament.tournamentLimit,
    subscription_status: 'active',
    stripe_subscription_id: null,
  };

  if (hasStartupTasksStorage) {
    updatePayload.startup_tasks = {};
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updatePayload)
    .eq('id', ctx.org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
