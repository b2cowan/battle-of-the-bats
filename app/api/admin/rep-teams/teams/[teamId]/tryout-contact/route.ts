import { NextResponse } from 'next/server';
import { resolveClubTeam } from '@/lib/club-team-route';
import {
  readTryoutContact, resetTryoutContactByClub, restoreTryoutContactByClub, type ClubResetUndo,
} from '@/lib/coach-tryout-contact';
import { NO_COACH_ADDRESS, COACH_CHANGED_IT, CANT_PUT_BACK } from '@/lib/tryout-contact-rules';
import { withObservability } from '@/lib/observability';
import { getOrgPublicSiteContent } from '@/lib/db';

/**
 * The club's view of a head coach's tryout questions address (Club Tier Stage 4c-2 Part B, Ask 2) — the admin team
 * Tryouts page, Sign-ups section: "Tryout questions on this page go to {address} · Set by {name}, head coach."
 *
 * GET: anyone who reads the team's Tryouts page (Rep Teams). DELETE ("Use the club's address"): the owner, or an admin
 * with Rep Teams — the rep-teams write gate. It records when and who, so the coach's row can say the club put its own
 * address back. The coach may set one again.
 */
type Ctx = { params: Promise<{ teamId: string }> };

export const GET = withObservability(async (req: Request, { params }: Ctx) => {
  const { teamId } = await params;
  const r = await resolveClubTeam(req, teamId, { write: false });
  if ('error' in r) return r.error;
  const [view, site] = await Promise.all([
    readTryoutContact(r.ctx.org.id, r.team.id),
    getOrgPublicSiteContent(r.ctx.org.id).catch(() => null),
  ]);
  return NextResponse.json({
    email: view.email,
    setByName: view.setter?.name ?? null,
    clubAddress: site?.contactEmail ?? null,
  });
}, { route: '/api/admin/rep-teams/teams/[teamId]/tryout-contact' });

export const DELETE = withObservability(async (req: Request, { params }: Ctx) => {
  const { teamId } = await params;
  const r = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in r) return r.error;
  // The address the club's window showed: a coach's change since then is never wiped (409, the line re-reads).
  const body = await req.json().catch(() => null) as { expectedEmail?: unknown } | null;
  const expected = typeof body?.expectedEmail === 'string' ? body.expectedEmail : '';
  const done = await resetTryoutContactByClub(r.ctx.org.id, r.team.id, r.ctx.user.id, expected);
  if (done === 'none') return NextResponse.json({ error: NO_COACH_ADDRESS }, { status: 409 });
  if (done === 'changed') return NextResponse.json({ error: COACH_CHANGED_IT }, { status: 409 });
  // `undo` is what the page sends back to POST if the club changes its mind (the page's Undo).
  return NextResponse.json({ email: null, setByName: null, undo: done });
}, { route: '/api/admin/rep-teams/teams/[teamId]/tryout-contact' });

/** The club's Undo: puts the coach's address back right after "Use the club's address". Same gate as the reset. */
export const POST = withObservability(async (req: Request, { params }: Ctx) => {
  const { teamId } = await params;
  const r = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in r) return r.error;
  const body = await req.json().catch(() => null) as { undo?: Partial<ClubResetUndo> } | null;
  const u = body?.undo;
  if (!u || typeof u.email !== 'string' || typeof u.membershipId !== 'string' || typeof u.setAt !== 'string' || typeof u.resetAt !== 'string') {
    return NextResponse.json({ error: CANT_PUT_BACK }, { status: 409 });
  }
  const done = await restoreTryoutContactByClub(r.ctx.org.id, r.team.id, r.ctx.user.id, {
    email: u.email, membershipId: u.membershipId, setAt: u.setAt, resetAt: u.resetAt,
  });
  if (done === 'gone') return NextResponse.json({ error: CANT_PUT_BACK }, { status: 409 });
  return NextResponse.json({ restored: true });
}, { route: '/api/admin/rep-teams/teams/[teamId]/tryout-contact' });
