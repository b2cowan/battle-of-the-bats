import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { staffTargetRefusal } from '@/lib/platform-staff-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personAuditValue, personForAction, readReason, reasonRequired } from '@/lib/platform-person-action';

/**
 * A person's name and/or email (the person record's one pencil; a reason is kept, Support console Stage 2). The audit
 * entry says what changed: `emailFrom`/`emailTo`, `nameFrom`/`nameTo`.
 */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('person_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { email?: string; displayName?: string; reason?: string };
  const found = await personForAction(id);
  if (found.response) return found.response;
  const { person } = found;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  // Support acts on customers' accounts: not a staff account, and never to a staff email (2026-10-16).
  const staffRefused = await staffTargetRefusal(auth.role, { userId: id, emails: [person.email, email] });
  if (staffRefused) return staffRefused;

  const emailChanges = !!email && email !== person.email;
  const name = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;
  const nameChanges = name !== undefined && name !== (person.displayName ?? '');
  if (!emailChanges && !nameChanges) return NextResponse.json({ error: 'Nothing changed.' }, { status: 400 });
  if (emailChanges && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 });
  const reason = readReason(body);
  if (!reason) return reasonRequired();

  const updatePayload: Record<string, unknown> = {};
  if (emailChanges) {
    updatePayload.email = email;
    updatePayload.email_confirm = true;
  }
  if (nameChanges) updatePayload.user_metadata = { display_name: name };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
  if (error) {
    console.error('[platform-admin] update-user error:', error);
    return NextResponse.json({ error: error.message ?? 'The change could not be saved.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'update_user', 'user_id', person.email, personAuditValue(person, reason, {
    ...(emailChanges ? { emailFrom: person.email, emailTo: email } : {}),
    ...(nameChanges ? { nameFrom: person.displayName, nameTo: name } : {}),
  }));
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/update' });
