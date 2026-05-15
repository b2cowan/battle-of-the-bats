import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';

type RetentionRecordRow = {
  id: string;
  org_id: string;
  retention_until: string;
  extension_count: number | null;
};

function clampDays(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 365) return null;
  return rounded;
}

export async function POST(req: Request, ctx: { params: Promise<{ recordId: string }> }) {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const { recordId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const days = clampDays(body.days ?? 30);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!days) {
    return NextResponse.json({ error: 'Extension must be between 1 and 365 days.' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, org_id, retention_until, extension_count')
    .eq('id', recordId)
    .single<RetentionRecordRow>();
  if (currentError || !current) {
    return NextResponse.json({ error: 'Retention record not found.' }, { status: 404 });
  }

  const nextDate = new Date(current.retention_until);
  nextDate.setDate(nextDate.getDate() + days);
  const nextIso = nextDate.toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('billing_retained_records')
    .update({
      retention_until: nextIso,
      extension_count: (current.extension_count ?? 0) + 1,
      last_extended_at: new Date().toISOString(),
      last_extended_by: auth.user.email ?? 'platform-admin',
      last_extension_reason: reason,
    })
    .eq('id', recordId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    current.org_id,
    'extend_billing_retention',
    'retention_until',
    current.retention_until,
    { retentionUntil: nextIso, days, reason, recordId },
  );

  return NextResponse.json({ ok: true, retentionUntil: nextIso });
}
