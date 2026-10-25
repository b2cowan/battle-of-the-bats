import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import {
  deleteDraftLeagueSeason,
  getLeagueSeasonAttachments,
  getLeagueSeasonById,
  getDivisionsForSeason,
  getRegistrationsForSeason,
  getTeamsForSeason,
  updateLeagueSeason,
} from '@/lib/db';
import type { LeagueSeasonStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { cutoffFor } from '@/lib/born-years';
import { openRegistrationRefusal } from '@/lib/house-league-season';
import { registrationOwes, seasonCharges } from '@/lib/league-price';
import { isCalendarDate } from '@/lib/timezone';
import { clubWallClock, registrationState } from '@/lib/league-registration-state';

// Two steps go back (Club Tier Stage 9a; owner 2026-10-24): Reopen registration only while registration is closed and play
// has not started, and Reopen a finished season (completed or archived) back to running. A finished season is locked
// through the one gate (Q16), so without the way back that lock would be permanent.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:                ['registration_open'],
  // An opened season whose close date has passed may start straight away (9b-1 Part 4: the dates closed it; checked below).
  registration_open:    ['registration_closed', 'active'],
  registration_closed:  ['active', 'registration_open'],
  active:               ['completed'],
  completed:            ['archived', 'active'],
  archived:             ['active'],
};

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const [divisions, regs, teams] = await Promise.all([
    getDivisionsForSeason(seasonId),
    getRegistrationsForSeason(seasonId),
    getTeamsForSeason(seasonId),
  ]);

  const teamsByDivision = new Map<string, number>();
  for (const t of teams) {
    teamsByDivision.set(t.divisionId, (teamsByDivision.get(t.divisionId) ?? 0) + 1);
  }

  const activeByDivision = new Map<string, number>();
  const heldByDivision = new Map<string, number>();
  const waitlistByDivision = new Map<string, number>();
  const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
  for (const r of regs) {
    if (!r.divisionId) continue;
    if (r.status === 'active') bump(activeByDivision, r.divisionId);
    // A spot is held by an accepted or a received child (mig 362): the Players column counts both.
    if (r.status === 'active' || r.status === 'pending_review') bump(heldByDivision, r.divisionId);
    else if (r.status === 'waitlisted') bump(waitlistByDivision, r.divisionId);
  }

  const divisionsWithStats = divisions.map(d => ({
    ...d,
    activeCount:   activeByDivision.get(d.id)   ?? 0,
    heldCount:     heldByDivision.get(d.id)     ?? 0,
    waitlistCount: waitlistByDivision.get(d.id) ?? 0,
    teamCount:     teamsByDivision.get(d.id)    ?? 0,
  }));

  // Delete is offered only to a shell: not yet open, with no families, teams, games or sent email. The page leaves the door out
  // otherwise; DELETE below enforces the same rule.
  // A failed count must never take the whole season page down for a convenience, so it reads as "not deletable".
  const deletable = season.status === 'draft'
    && await getLeagueSeasonAttachments(seasonId, ctx!.org.id).then(a => !a.any, () => false);

  return NextResponse.json({
    season,
    deletable,
    // The club's cut-off for this season's sport — what the division windows' birth years count from (Stage 4c-2).
    birthdayCutoff: cutoffFor(ctx!.org.birthdayCutoffs, season.sport),
    divisions: divisionsWithStats,
    summary: {
      activeRegistrationCount: regs.filter(r => r.status === 'active').length,
      waitlistCount:           regs.filter(r => r.status === 'waitlisted').length,
      pendingReviewCount:      regs.filter(r => r.status === 'pending_review').length,
      // Stage 9a: the Teams figure's hint, and the status windows' "still owe fees" loose end (0 on a free season).
      unplacedCount:           regs.filter(r => r.status === 'active' && !r.teamId).length,
      unpaidFeeCount:          regs.filter(r => r.status === 'active' && !r.registrationFeePaid && (registrationOwes(r, season) ?? 0) > 0).length,
    },
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'changeStatus');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  const patch: Parameters<typeof updateLeagueSeason>[2] = {};

  // Field updates
  if (typeof body.name         === 'string') patch.name         = body.name.trim() || undefined;
  if (typeof body.slug         === 'string') patch.slug         = body.slug.trim().toLowerCase() || undefined;
  if (typeof body.sport        === 'string') patch.sport        = body.sport;
  if ('description'            in body)      patch.description  = body.description ?? null;
  if ('registrationFee'        in body) {
    const fee = body.registrationFee;
    if (fee != null && (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0)) {
      return NextResponse.json({ error: 'The registration fee is a number of dollars, 0 or more.' }, { status: 400 });
    }
    patch.registrationFee = fee ?? null;
  }
  // ⚰ autoGenerateFees is no longer written (Club Tier Stage 9a, S1·b): read by nothing; a body carrying it is ignored.
  if ('autoApproveUnderCapacity' in body)    patch.autoApproveUnderCapacity = Boolean(body.autoApproveUnderCapacity);
  if ('autoPromoteWaitlist'    in body)      patch.autoPromoteWaitlist = Boolean(body.autoPromoteWaitlist);
  if ('registrationOpenAt'     in body)      patch.registrationOpenAt  = body.registrationOpenAt  ?? null;
  if ('registrationCloseAt'    in body)      patch.registrationCloseAt = body.registrationCloseAt ?? null;
  if ('seasonStartDate'        in body)      patch.seasonStartDate = body.seasonStartDate ?? null;
  if ('seasonEndDate'          in body)      patch.seasonEndDate   = body.seasonEndDate   ?? null;
  if ('waiverText'             in body)      patch.waiverText      = body.waiverText      ?? null;
  // The season's one early-bird day (9b·2), the club's day as a plain date.
  if ('earlyBirdUntil' in body) {
    const v = body.earlyBirdUntil;
    if (v != null && v !== '' && (typeof v !== 'string' || !isCalendarDate(v))) {
      return NextResponse.json({ error: 'Pick the early-bird date from the calendar.' }, { status: 400 });
    }
    patch.earlyBirdUntil = v ? v : null;
  }
  // The club's own words on how to pay (9b·9).
  if ('howToPay' in body) {
    const v = typeof body.howToPay === 'string' ? body.howToPay.trim() : '';
    if (v.length > 1000) return NextResponse.json({ error: 'How to pay is 1,000 characters or fewer.' }, { status: 400 });
    patch.howToPay = v || null;
  }

  // A status move is its own permission (it stays open on a finished season, to reopen or archive it); a field edit is a
  // season edit, refused once the season is finished (Q16). Decided on the fields this route writes, not the body's keys.
  if (Object.keys(patch).length > 0) {
    const refused = houseLeagueRefusal(ctx, 'run', season);
    if (refused) return refused;
  }

  // Lifecycle transition
  if (typeof body.status === 'string') {
    const newStatus = body.status as LeagueSeasonStatus;
    const allowed = ALLOWED_TRANSITIONS[season.status] ?? [];

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from '${season.status}' to '${newStatus}'` },
        { status: 422 },
      );
    }

    if (season.status === 'registration_open' && newStatus === 'active' && registrationState(season) !== 'closedByDate') {
      return NextResponse.json({ error: 'Close registration before you start the season.' }, { status: 422 });
    }
    // The convenor closing it is remembered (the page says "You closed registration on Oct 3"); reopening forgets it, and
    // must leave the form a close date that has not passed (Reopen until…).
    if (newStatus === 'registration_closed') patch.registrationClosedAt = new Date().toISOString();
    if (season.status === 'registration_closed' && newStatus === 'registration_open') {
      patch.registrationClosedAt = null;
      const closes = 'registrationCloseAt' in patch ? patch.registrationCloseAt : season.registrationCloseAt;
      if (closes && String(closes).slice(0, 16) < clubWallClock()) {
        return NextResponse.json({ error: 'Pick the day the form should close.' }, { status: 422 });
      }
    }
    // Open registration only once the checklist is done (9b·1): enforced HERE, on the values this save leaves, with the
    // same function the page reads, so the page can never offer what this refuses.
    if (season.status === 'draft' && newStatus === 'registration_open') {
      const divisions = await getDivisionsForSeason(seasonId);
      const refusal = openRegistrationRefusal({ ...season, ...patch }, divisions);
      if (refusal) return NextResponse.json({ error: refusal }, { status: 422 });
    }

    patch.status = newStatus;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  if ('howToPay' in patch && !patch.howToPay && (patch.status ?? season.status) === 'registration_open') {
    const divisions = await getDivisionsForSeason(seasonId);
    if (seasonCharges(divisions, { registrationFee: patch.registrationFee !== undefined ? patch.registrationFee : season.registrationFee })) {
      return NextResponse.json({ error: 'Registration is open and a division has a price, so how to pay can’t be empty.' }, { status: 400 });
    }
  }

  await updateLeagueSeason(seasonId, ctx!.org.id, patch);
  const updated = await getLeagueSeasonById(seasonId, ctx!.org.id);
  return NextResponse.json(updated);
}, { route: '/api/admin/house-league/seasons/[seasonId]' });

// A season is deleted only while it is a shell (owner, 2026-10-25): it has not opened registration, and no family, team, game
// or sent email is attached. After that it is official, and it ends by being archived, never deleted. Same people as editing it.
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const { seasonId } = await params;
  // The season is read first so a finished season is refused through the one gate (423), like every other write.
  const season = ctx ? await getLeagueSeasonById(seasonId, ctx.org.id) : null;
  const err = houseLeagueRefusal(ctx, 'run', season);
  if (err) return err;
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  if (season.status !== 'draft') {
    return NextResponse.json({ error: 'Only a season that has not opened registration can be deleted. Archive it instead.' }, { status: 409 });
  }
  if ((await getLeagueSeasonAttachments(seasonId, ctx!.org.id)).any) {
    return NextResponse.json({ error: 'This season already has families, teams, games, email or money entries attached, so it can’t be deleted. Archive it instead.' }, { status: 409 });
  }
  if (!(await deleteDraftLeagueSeason(seasonId, ctx!.org.id))) {
    return NextResponse.json({ error: 'This season just changed, so it can’t be deleted. Reload the page.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]' });
