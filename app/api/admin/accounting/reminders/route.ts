import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { clubTeamFor } from '@/lib/club-team-route';
import { reminderPreview, sendReminders } from '@/lib/club-money-reminders';

/**
 * GET  /api/admin/accounting/reminders?orgSlug=[&teamId=]  — the preview (Ask 4): who gets one (each
 *      team, its head coaches and money staff, what it owes, overdue included), who can't be reached
 *      and why, and the last wave (when, by whom).
 * POST /api/admin/accounting/reminders?orgSlug=[&teamId=]  { teamIds } — send to the teams the
 *      preview named. 409 `just_sent` (a double submit) · `nothing_to_send`; 502 `send_failed`.
 *
 * `teamId` is the single-team variant ("Remind 16U Girls", from inside the team's bill). Both ask
 * `canMoveClubMoney` — the treasurer who runs the loop can send them now.
 */
async function resolve(req: Request) {
  const r = await resolveClubMoney(req, { scope: 'loop', write: true });
  if ('error' in r) return r;
  const teamId = new URL(req.url).searchParams.get('teamId') ?? undefined;
  if (teamId) {
    const t = await clubTeamFor(r.ctx, teamId);
    if ('error' in t) return t;
  }
  return { ctx: r.ctx, teamId };
}

export const GET = withObservability(async (req: Request) => {
  const r = await resolve(req);
  if ('error' in r) return r.error;
  return NextResponse.json(await reminderPreview(r.ctx, { teamId: r.teamId }));
}, { route: '/api/admin/accounting/reminders' });

export const POST = withObservability(async (req: Request) => {
  const r = await resolve(req);
  if ('error' in r) return r.error;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await sendReminders(r.ctx, { teamId: r.teamId, teamIds: body.teamIds });
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({
    teams: out.teams, recipients: out.recipients, failed: out.failed, installments: out.installments, amount: out.amount,
  });
}, { route: '/api/admin/accounting/reminders' });
