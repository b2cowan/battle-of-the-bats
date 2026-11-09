import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { canHideWorkspace } from '@/lib/user-contexts';
import { hideWorkspace, showWorkspace } from '@/lib/user-hidden-workspaces';

/**
 * Hide a PAUSED workspace from the signed-in person's own Home, or show it again (migration 456).
 *
 * HIDE, NOT LEAVE (owner ruling 2026-11-09): this writes one personal row. The club's roster, the team's records and the
 * person's assignment are untouched and nobody is told. Account-scoped on purpose — it is a fact about THIS person's Home,
 * so it lives beside the other consumer preferences, not under an org.
 *
 * PATCH { orgId, hidden } → 204.
 *   hidden: true  — only for a workspace that is PAUSED for this person (409 otherwise: a hide on a working workspace would
 *                   silently remove a door they use). Idempotent.
 *   hidden: false — always allowed; removes their own row. Idempotent.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const raw = (body as { orgId?: unknown; hidden?: unknown } | null) ?? {};
  if (typeof raw.orgId !== 'string' || !UUID.test(raw.orgId)) {
    return NextResponse.json({ error: 'orgId must be a workspace id.' }, { status: 400 });
  }
  if (typeof raw.hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden must be true or false.' }, { status: 400 });
  }

  if (raw.hidden) {
    if (!(await canHideWorkspace(user.id, raw.orgId))) {
      return NextResponse.json({ error: 'Only a paused workspace can be hidden.' }, { status: 409 });
    }
    await hideWorkspace(user.id, raw.orgId);
  } else {
    await showWorkspace(user.id, raw.orgId);
  }
  return new NextResponse(null, { status: 204 });
}, { route: '/api/consumer/hidden-workspaces' });
