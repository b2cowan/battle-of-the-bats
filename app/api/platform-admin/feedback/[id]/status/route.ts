import { NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

// Feedback triage status mutation. Write-gated to super_admin + product (manage_product);
// support is view-only → 403. Mirrors the observability status route.
const VALID_STATUSES = ['new', 'triaged', 'acknowledged', 'resolved'] as const;
type FeedbackStatus = (typeof VALID_STATUSES)[number];

const VALID_SEVERITIES = ['critical', 'error', 'warning', 'info'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FeedbackRow = { id: string; status: string; org_id: string | null };

export const POST = withObservability(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid feedback id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !VALID_STATUSES.includes(status as FeedbackStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  const newStatus = status as FeedbackStatus;
  const severity =
    typeof body.severity === 'string' && VALID_SEVERITIES.includes(body.severity as (typeof VALID_SEVERITIES)[number])
      ? body.severity
      : undefined;

  const { data: current, error: currentError } = await supabaseAdmin
    .from('feedback_submissions')
    .select('id, status, org_id')
    .eq('id', id)
    .maybeSingle<FeedbackRow>();
  if (currentError || !current) {
    return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });
  }

  const actor = auth.user.email ?? 'platform-admin';
  const nowIso = new Date().toISOString();

  // updated_at has no DB trigger — set it explicitly. triaged_by/_at stamp once it leaves 'new'.
  const update: Record<string, unknown> = { status: newStatus, updated_at: nowIso };
  if (newStatus !== 'new') {
    update.triaged_by = actor;
    update.triaged_at = nowIso;
  }
  if (severity !== undefined) update.severity = severity;

  const { error: updateError } = await supabaseAdmin
    .from('feedback_submissions')
    .update(update)
    .eq('id', id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    actor,
    current.org_id,
    'update_feedback_status',
    'status',
    current.status,
    { status: newStatus, id, severity: severity ?? null },
  );

  return NextResponse.json({ ok: true, status: newStatus });
}, { route: '/api/platform-admin/feedback/[id]/status' });
