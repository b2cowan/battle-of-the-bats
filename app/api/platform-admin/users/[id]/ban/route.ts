import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { staffTargetRefusal } from '@/lib/platform-staff-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personAuditValue, personForAction, readReason, reasonRequired } from '@/lib/platform-person-action';

/** Ban a person, or lift the ban (the person record's Account tab; a reason is kept, Support console Stage 2). */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('person_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { action?: string; reason?: string };
  const found = await personForAction(id);
  if (found.response) return found.response;
  const { person } = found;
  // Support acts on customers' accounts, never on a staff account (2026-10-16).
  const staffRefused = await staffTargetRefusal(auth.role, { userId: id, emails: [person.email] });
  if (staffRefused) return staffRefused;

  const action = body.action;
  if (action !== 'ban' && action !== 'unban') {
    return NextResponse.json({ error: 'action must be "ban" or "unban"' }, { status: 400 });
  }
  const reason = readReason(body);
  if (!reason) return reasonRequired();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: action === 'ban' ? '87600h' : 'none' });
  if (error) {
    console.error(`[platform-admin] ${action} user error:`, error);
    return NextResponse.json({ error: action === 'ban' ? 'The ban did not go through.' : 'The ban could not be lifted.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, action === 'ban' ? 'ban_user' : 'unban_user', 'user_id',
    action === 'ban' ? 'active' : 'banned', personAuditValue(person, reason));
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/ban' });
