import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await params;
  const ctx = await getAuthContext({ orgSlug });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.org.slug !== orgSlug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  return NextResponse.json({ assignments });
}
