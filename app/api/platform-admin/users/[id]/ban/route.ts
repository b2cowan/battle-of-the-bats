import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personActionContext, personAuditValue } from '@/lib/platform-person-action';

/** Ban a person, or lift the ban (the person record's Account tab; through the one front door, Support console Stage 2). */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await personActionContext<{ action?: string }>(req, id);
  if (ctx.response) return ctx.response;
  const { auth, person, body, reason } = ctx.action;

  const action = body.action;
  if (action !== 'ban' && action !== 'unban') {
    return NextResponse.json({ error: 'action must be "ban" or "unban"' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: action === 'ban' ? '87600h' : 'none' });
  if (error) {
    console.error(`[platform-admin] ${action} user error:`, error);
    return NextResponse.json({ error: action === 'ban' ? 'The ban did not go through.' : 'The ban could not be lifted.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, action === 'ban' ? 'ban_user' : 'unban_user', 'user_id',
    action === 'ban' ? 'active' : 'banned', personAuditValue(person, reason));
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/ban' });
