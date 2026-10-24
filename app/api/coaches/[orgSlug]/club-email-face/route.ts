import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import { systemMailFace } from '@/lib/club-email-context';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/coaches/[orgSlug]/club-email-face — the club's face for a SAMPLE of a family email shown in the coaches portal
 * (the dues reminder preview; The public face, warm: S3b). It returns exactly what the real send reads (club name, colours,
 * a logo only when its size is known, and the reply line a system email carries), so the sample cannot promise a look the
 * email does not have. Read-only; any signed-in member of the club may read it — it is what every family already sees.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const face = await systemMailFace(ctx.org);
  if (!face) return NextResponse.json({ club: null, replyLine: null });
  return NextResponse.json({ club: face.club, replyLine: face.replyLine });
}, { route: '/api/coaches/[orgSlug]/club-email-face' });
