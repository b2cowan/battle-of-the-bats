import { NextRequest, NextResponse } from 'next/server';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { personActionContext, personAuditValue } from '@/lib/platform-person-action';

/** Sign a person out everywhere (the person record's Account tab; through the one front door, Support console Stage 2). */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await personActionContext(req, id);
  if (ctx.response) return ctx.response;
  const { auth, person, reason } = ctx.action;

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
