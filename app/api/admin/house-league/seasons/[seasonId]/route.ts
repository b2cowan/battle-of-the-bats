import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import {
  getLeagueSeasonById,
  getDivisionsForSeason,
  getRegistrationsForSeason,
  getTeamsForSeason,
  updateLeagueSeason,
} from '@/lib/db';
import type { LeagueSeasonStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { cutoffFor } from '@/lib/born-years';

// Two steps go back (Club Tier Stage 9a; owner 2026-10-24): Reopen registration only while registration is closed and play
// has not started, and Reopen a finished season (completed or archived) back to running. A finished season is locked
// through the one gate (Q16), so without the way back that lock would be permanent.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:                ['registration_open'],
  registration_open:    ['registration_closed'],
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
  const waitlistByDivision = new Map<string, number>();
  for (const r of regs) {
    if (!r.divisionId) continue;
    if (r.status === 'active') {
      activeByDivision.set(r.divisionId, (activeByDivision.get(r.divisionId) ?? 0) + 1);
    } else if (r.status === 'waitlisted') {
      waitlistByDivision.set(r.divisionId, (waitlistByDivision.get(r.divisionId) ?? 0) + 1);
    }
  }

  const divisionsWithStats = divisions.map(d => ({
    ...d,
    activeCount:   activeByDivision.get(d.id)   ?? 0,
    waitlistCount: waitlistByDivision.get(d.id) ?? 0,
    teamCount:     teamsByDivision.get(d.id)    ?? 0,
  }));

  return NextResponse.json({
    season,
    // The club's cut-off for this season's sport — what the division windows' birth years count from (Stage 4c-2).
    birthdayCutoff: cutoffFor(ctx!.org.birthdayCutoffs, season.sport),
    divisions: divisionsWithStats,
    summary: {
      activeRegistrationCount: regs.filter(r => r.status === 'active').length,
      waitlistCount:           regs.filter(r => r.status === 'waitlisted').length,
      pendingReviewCount:      regs.filter(r => r.status === 'pending_review').length,
      // Stage 9a: the Teams figure's hint, and the status windows' "still owe fees" loose end (0 on a free season).
      unplacedCount:           regs.filter(r => r.status === 'active' && !r.teamId).length,
      unpaidFeeCount:          (season.registrationFee ?? 0) > 0
        ? regs.filter(r => r.status === 'active' && !r.registrationFeePaid).length : 0,
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
  if ('division'               in body)      patch.division     = body.division ?? null;
  if ('description'            in body)      patch.description  = body.description ?? null;
  if ('registrationFee'        in body)      patch.registrationFee = body.registrationFee ?? null;
  // ⚰ autoGenerateFees is no longer written (Club Tier Stage 9a, S1·b): read by nothing; a body carrying it is ignored.
  if ('autoApproveUnderCapacity' in body)    patch.autoApproveUnderCapacity = Boolean(body.autoApproveUnderCapacity);
  if ('autoPromoteWaitlist'    in body)      patch.autoPromoteWaitlist = Boolean(body.autoPromoteWaitlist);
  if ('registrationOpenAt'     in body)      patch.registrationOpenAt  = body.registrationOpenAt  ?? null;
  if ('registrationCloseAt'    in body)      patch.registrationCloseAt = body.registrationCloseAt ?? null;
  if ('seasonStartDate'        in body)      patch.seasonStartDate = body.seasonStartDate ?? null;
  if ('seasonEndDate'          in body)      patch.seasonEndDate   = body.seasonEndDate   ?? null;
  if ('waiverText'             in body)      patch.waiverText      = body.waiverText      ?? null;

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

    if (season.status === 'draft' && newStatus === 'registration_open') {
      const divisions = await getDivisionsForSeason(seasonId);
      if (divisions.length === 0) {
        return NextResponse.json(
          { error: 'Add at least one division before opening registration' },
          { status: 422 },
        );
      }
    }

    patch.status = newStatus;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await updateLeagueSeason(seasonId, ctx!.org.id, patch);
  const updated = await getLeagueSeasonById(seasonId, ctx!.org.id);
  return NextResponse.json(updated);
}, { route: '/api/admin/house-league/seasons/[seasonId]' });
