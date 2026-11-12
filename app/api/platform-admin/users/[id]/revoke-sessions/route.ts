import { NextRequest, NextResponse } from 'next/server';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { signOutEverywhere } from '@/lib/two-step-reset';
import { personActionContext, personAuditValue } from '@/lib/platform-person-action';

/** Sign a person out everywhere (the person record's Account tab; through the one front door, Support console Stage 2). */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await personActionContext(req, id);
  if (ctx.response) return ctx.response;
  const { auth, person, reason } = ctx.action;

  // The one sign-out-everywhere (mig 474's function). The sign-in service's own admin DELETE /sessions route does not
  // exist, so this door answered "could not be signed out" for everyone until 2026-11-12.
  if (!(await signOutEverywhere(id))) {
    return NextResponse.json({ error: 'They could not be signed out.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'revoke_sessions', 'user_id', null, personAuditValue(person), { reason });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/revoke-sessions' });
