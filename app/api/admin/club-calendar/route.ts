import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability, captureAndJson } from '@/lib/observability';
import { isTournamentTier } from '@/lib/billing-urls';
import { calendarPrograms, calendarWindow, readClubCalendar } from '@/lib/club-calendar';
import { CALENDAR_WORDS } from '@/lib/club-calendar-view';

// ---------------------------------------------------------------------------
// The club calendar (Club Tier Stage 6b, Asks 6–7; D5)
// GET /api/admin/club-calendar?orgSlug=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD
//   — every booking of the programs this reader can open, in the org-zone days from…to (six weeks at most), each
//     marked with both sides of any clash 6a's rule finds (`lib/club-calendar.ts`). READ-ONLY (D3): there is no write.
// ---------------------------------------------------------------------------

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // A Tournament-plan organization has no club side at all (its /admin/org is redirected away): no calendar either.
  if (isTournamentTier(ctx.org.planId)) return forbidden();

  const window = calendarWindow(url.searchParams.get('from'), url.searchParams.get('to'));
  if ('error' in window) return NextResponse.json({ error: window.error, code: 'bad_range' }, { status: 400 });

  const member = { role: ctx.role, capabilities: ctx.capabilities };
  // The page shows the programs the reader can open; with none, the door is not drawn — and a direct call says why.
  if (!calendarPrograms(member, ctx.org).length) {
    return NextResponse.json({ error: CALENDAR_WORDS.noPrograms, code: 'no_programs' }, { status: 403 });
  }

  try {
    const read = await readClubCalendar(
      { org: ctx.org, member, userId: ctx.user.id, assignedTournamentIds: ctx.assignedTournamentIds },
      window.from, window.to,
    );
    return NextResponse.json(read);
  } catch (err) {
    return captureAndJson(err, { error: CALENDAR_WORDS.loadFailed, code: 'load_failed' }, 500);
  }
}, { route: '/api/admin/club-calendar' });
