import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { staffTargetRefusal } from '@/lib/platform-staff-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personAuditValue, personForAction, readReason, reasonRequired } from '@/lib/platform-person-action';

/** Mark a person's email confirmed (the person record's Account tab; a reason is kept, Support console Stage 2). */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('person_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const found = await personForAction(id);
  if (found.response) return found.response;
  const { person } = found;
  // Support acts on customers' accounts, never on a staff account (2026-10-16).
  const staffRefused = await staffTargetRefusal(auth.role, { userId: id, emails: [person.email] });
  if (staffRefused) return staffRefused;
  const reason = readReason(body);
  if (!reason) return reasonRequired();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true });
  if (error) {
    console.error('[platform-admin] confirm-email error:', error);
    return NextResponse.json({ error: 'The email could not be confirmed.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'confirm_email', 'user_id', 'unconfirmed', personAuditValue(person, reason));
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/confirm-email' });
