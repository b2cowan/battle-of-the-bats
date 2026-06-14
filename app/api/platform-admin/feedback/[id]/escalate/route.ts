import { NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

// Flag-for-product escalation (F3 Phase 4). Write-gated to the `feedback` area
// (super_admin / product / support / billing) — same gate as the status route — so support
// and billing can formally hand an item to product without leaving the console.
//
// POST body { escalate: true }  → stamp escalated_at = now(), escalated_by = actor.
// POST body { escalate: false } → clear both (de-escalate). No history kept by design; the
// platform_audit_log entry is the durable trail. Idempotent on re-escalate / re-clear.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FeedbackRow = { id: string; org_id: string | null; escalated_at: string | null };

export const POST = withObservability(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformAreaApi('feedback', 'write');
  if (auth.response) return auth.response;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid feedback id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.escalate !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request: `escalate` boolean required.' }, { status: 400 });
  }
  const escalate = body.escalate as boolean;

  const { data: current, error: currentError } = await supabaseAdmin
    .from('feedback_submissions')
    .select('id, org_id, escalated_at')
    .eq('id', id)
    .maybeSingle<FeedbackRow>();
  if (currentError || !current) {
    return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });
  }

  const actor = auth.user.email ?? 'platform-admin';
  const nowIso = new Date().toISOString();

  // updated_at has no DB trigger — set it explicitly. Re-escalating keeps the original
  // escalated_at/_by (no clobber); clearing nulls both.
  const update: Record<string, unknown> = { updated_at: nowIso };
  if (escalate) {
    if (current.escalated_at) {
      // Already escalated — no-op (idempotent), don't restamp who/when.
      return NextResponse.json({ ok: true, escalated: true });
    }
    update.escalated_at = nowIso;
    update.escalated_by = actor;
  } else {
    update.escalated_at = null;
    update.escalated_by = null;
  }

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
    escalate ? 'escalate_feedback' : 'clear_feedback_escalation',
    'escalated_at',
    current.escalated_at,
    { escalated: escalate, id },
  );

  return NextResponse.json({ ok: true, escalated: escalate });
}, { route: '/api/platform-admin/feedback/[id]/escalate' });
