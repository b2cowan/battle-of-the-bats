import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { staffTargetRefusal } from '@/lib/platform-staff-guard';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personAuditValue, personForAction, readReason, reasonRequired } from '@/lib/platform-person-action';

/** Sign a person out everywhere (the person record's Account tab; a reason is kept, Support console Stage 2). */
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

  // GoTrue admin DELETE /sessions endpoint — invalidates all sessions for this user.
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}/sessions`,
    {
      method: 'DELETE',
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[platform-admin] revoke-sessions error:', response.status, text);
    return NextResponse.json({ error: 'They could not be signed out.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'revoke_sessions', 'user_id', null, personAuditValue(person, reason));
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/revoke-sessions' });
