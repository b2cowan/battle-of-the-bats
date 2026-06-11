import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { recordPlatformAdminVisit } from '@/lib/platform-admin-visits';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({})) as { path?: string };
  try {
    await recordPlatformAdminVisit({
      actorUserId: auth.user.id,
      actorEmail: auth.user.email ?? 'platform-admin',
      path: body.path ?? '/platform-admin',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[platform-admin] visit record failed', error);
    return NextResponse.json({ error: 'Visit record failed' }, { status: 500 });
  }
}, { route: '/api/platform-admin/visits' });
