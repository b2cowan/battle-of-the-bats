import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { readFamilyHome } from '@/lib/family-home';
import { endFamilyLink } from '@/lib/family-invitation';

/**
 * "Leave {child}'s team" (Signed-in family accounts Stage 4a, Part 6.2; ruling 7; /legal draft (e)). Ends ONLY this account's
 * own connection to the child (ended_by = 'parent'): neither parent removes the other, nobody is emailed, and it is never
 * invited again automatically (only the club's Send again). 404 while the guardian tier is off, or for a child this account is
 * not connected to.
 */
export const POST = withObservability(async (_req: Request, { params }: { params: Promise<{ childId: string }> }) => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { childId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const child = (await readFamilyHome(user.id)).children.find(c => c.childId === childId);
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await endFamilyLink({ by: 'parent', linkId: child.linkId, userId: user.id });
  return NextResponse.json({ ok: true });
}, { route: '/api/family/children/[childId]/leave' });
