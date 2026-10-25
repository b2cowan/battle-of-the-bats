import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { applyClubIdentity } from '@/lib/club-record-changes';

/** A club's name and web name (the one rule is `applyClubIdentity`; the record's pencil saves through `…/record`). */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> },) => {
  const auth = await requirePlatformPower('club_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { name?: string; slug?: string; reason?: string };
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });

  const result = await applyClubIdentity({
    orgId: id,
    name: typeof body.name === 'string' ? body.name : undefined,
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    reason,
    actorEmail: auth.user.email!,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/orgs/[id]/identity' });
