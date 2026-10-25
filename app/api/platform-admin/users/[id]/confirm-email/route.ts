import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personActionContext, personAuditValue } from '@/lib/platform-person-action';

/** Mark a person's email confirmed (the person record's Account tab; through the one front door, Support console Stage 2). */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await personActionContext(req, id);
  if (ctx.response) return ctx.response;
  const { auth, person, reason } = ctx.action;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true });
  if (error) {
    console.error('[platform-admin] confirm-email error:', error);
    return NextResponse.json({ error: 'The email could not be confirmed.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'confirm_email', 'user_id', 'unconfirmed', personAuditValue(person, reason));
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/confirm-email' });
