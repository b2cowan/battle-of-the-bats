import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { applyClubSections } from '@/lib/club-record-changes';

/**
 * A club's add-on sections (the one rule is `applyClubSections`; the record's pencil saves through `…/record`). From
 * Support console Stage 2 a section change keeps its reason, like every other change.
 */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_sections');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { enabledAddons?: string[]; reason?: string };
  if (!Array.isArray(body.enabledAddons)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });

  const result = await applyClubSections({ orgId: id, enabledAddons: body.enabledAddons, reason, actorEmail: auth.user.email! });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/orgs/[id]/addons' });
