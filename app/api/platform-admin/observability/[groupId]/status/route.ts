import { NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const VALID_STATUSES = ['open', 'resolved', 'ignored', 'snoozed'] as const;
type ObsStatus = (typeof VALID_STATUSES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clampSnoozeHours(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 24;
  return Math.min(720, Math.max(1, Math.round(n))); // 1h … 30d
}

type GroupRow = { id: string; status: string };

export const POST = withObservability(async (req: Request, ctx: { params: Promise<{ groupId: string }> }) => {
  // Write gate: super_admin + product only (manage_product). support is view-only → 403.
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const { groupId } = await ctx.params;
  if (!UUID_RE.test(groupId)) {
    return NextResponse.json({ error: 'Invalid issue id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !VALID_STATUSES.includes(status as ObsStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  const newStatus = status as ObsStatus;

  const { data: current, error: currentError } = await supabaseAdmin
    .from('error_groups')
    .select('id, status')
    .eq('id', groupId)
    .maybeSingle<GroupRow>();
  if (currentError || !current) {
    return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const actor = auth.user.email ?? 'platform-admin';

  // resolved_at / resolved_by / snooze_until are derived from the target status so the
  // group's lifecycle columns stay consistent (e.g. reopening clears resolution + snooze).
  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'resolved') {
    update.resolved_at = nowIso;
    update.resolved_by = actor;
    update.snooze_until = null;
  } else if (newStatus === 'snoozed') {
    const hours = clampSnoozeHours(body.snoozeHours);
    update.snooze_until = new Date(Date.now() + hours * 3_600_000).toISOString();
    update.resolved_at = null;
    update.resolved_by = null;
  } else {
    // open | ignored — clear any prior resolution / snooze
    update.resolved_at = null;
    update.resolved_by = null;
    update.snooze_until = null;
  }

  const { error: updateError } = await supabaseAdmin
    .from('error_groups')
    .update(update)
    .eq('id', groupId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    actor,
    null,
    'update_error_group_status',
    'status',
    current.status,
    { status: newStatus, groupId, snoozeUntil: update.snooze_until ?? null },
  );

  return NextResponse.json({ ok: true, status: newStatus });
}, { route: '/api/platform-admin/observability/[groupId]/status' });
