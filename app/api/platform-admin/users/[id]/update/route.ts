import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personActionContext, personAuditValue } from '@/lib/platform-person-action';

const cleanEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : undefined);

/**
 * A person's name and/or email (the person record's one pencil; through the one front door, Support console Stage 2). The
 * new email is named to the staff refusal too. The audit entry says what changed: `emailFrom`/`emailTo`,
 * `nameFrom`/`nameTo`.
 */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await personActionContext<{ email?: string; displayName?: string }>(req, id, body => [cleanEmail(body.email)]);
  if (ctx.response) return ctx.response;
  const { auth, person, body, reason } = ctx.action;

  const email = cleanEmail(body.email);
  const emailChanges = !!email && email !== person.email;
  const name = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;
  const nameChanges = name !== undefined && name !== (person.displayName ?? '');
  if (!emailChanges && !nameChanges) return NextResponse.json({ error: 'Nothing changed.' }, { status: 400 });
  if (emailChanges && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 });

  const updatePayload: Record<string, unknown> = {};
  if (emailChanges) {
    updatePayload.email = email;
    updatePayload.email_confirm = true;
  }
  // Every name key: the lookup reads display_name, then full_name, then name, so writing one alone could leave the old
  // name showing (a cleared name would come straight back from full_name).
  if (nameChanges) updatePayload.user_metadata = { display_name: name, full_name: name, name };

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
