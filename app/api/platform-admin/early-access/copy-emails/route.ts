import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { copyEmails, listFromParams } from '@/lib/lead-writes';

/**
 * Tools › Copy emails (Support console Stage 7 Part 9; owner Q10). On the server, over the list the screen shows: only
 * leads who said yes to release emails, never one who asked not to be contacted. An audit entry says who, when, how many
 * and which list, with no addresses in it.
 */
export const POST = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const r = await copyEmails(auth.user.email!, listFromParams(req.nextUrl.searchParams));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ emails: r.emails }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/platform-admin/early-access/copy-emails' });
