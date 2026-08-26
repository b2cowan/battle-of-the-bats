import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getActiveRepProgramYear,
  getLatestClosedRepProgramYear,
  getSeasonName,
  updateRepTeam,
  updateRepProgramYear,
  setRepTeamShareClubBook,
} from '@/lib/db';
import { getEntitledTeamMembership, resolveMembershipCapabilities } from '@/lib/coach-membership';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { normalizeLineupSettings } from '@/lib/lineup-caps';
import type { Organization } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteScoutingSummary, canViewMoney } from '@/lib/coach-capabilities';
import { resolveClubBookAccessFor } from '@/lib/coach-club-book';

/**
 * M1 (2026-08-16): the gate is TEAM MEMBERSHIP, and the between-seasons state is ordinary.
 * The old resolver required a live assignment + an active year, which walled Settings off with
 * "Settings unavailable" for a coach whose season had just ended — one of the two shipped limbo
 * dead-ends the membership model closes. READS fall back to the newest closed season
 * (`requireLiveSeason: false`); WRITES still demand the live one — a finished season's
 * configuration is part of its record.
 */
async function resolveCoachContext(
  orgSlug: string,
  teamId: string,
  opts: { requireLiveSeason: boolean },
) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  // Independent lookups resolve together; the checks run in order after they land.
  const [team, membership, liveYear] = await Promise.all([
    getRepTeam(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
    getActiveRepProgramYear(teamId),
  ]);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  if (!membership) return { error: forbidden() };
  const assignment = {
    coachRole: membership.coachRole,
    capabilities: resolveMembershipCapabilities(membership),
  };

  const programYear = liveYear
    ?? (opts.requireLiveSeason ? null : await getLatestClosedRepProgramYear(teamId));
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

/** Who may self-manage seasons + division: a head coach of a STANDALONE Team workspace (not an
 *  org-owned/adopted team — those stay under the club admin). `linked` still counts as standalone. */
function computeScope(
  org: Pick<Organization, 'accountKind' | 'planId' | 'teamWorkspaceStatus'>,
  coachRole: 'head_coach' | 'assistant_coach',
) {
  const isStandalone =
    isTeamWorkspaceOrg(org) &&
    org.teamWorkspaceStatus !== 'org_owned' &&
    org.teamWorkspaceStatus !== 'archived';
  const isHeadCoach = coachRole === 'head_coach';
  return {
    isStandalone,
    isHeadCoach,
    canManageSeasons: isStandalone && isHeadCoach,
    canEditDivision: isStandalone && isHeadCoach,
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId] — team identity + current season + scope (Settings page)
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  // Read: works between seasons too (newest closed year stands in; status says which it is).
  const resolved = await resolveCoachContext(orgSlug, teamId, { requireLiveSeason: false });
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;

  const scope = computeScope(ctx.org, assignment.coachRole);
  const clubAccess = resolveClubBookAccessFor(ctx.org, team);

  return NextResponse.json({
    team: { id: team.id, name: team.name, division: team.division, sport: team.sport },
    season: {
      id: programYear.id, name: programYear.name, year: programYear.year, status: programYear.status,
      lineupSettings: programYear.lineupSettings, // P3 season-default caps (any assigned coach may edit)
    },
    nextYearDefault: programYear.year + 1,
    scope,
    /**
     * Club Shared Book — the head coach's switch. `showSwitch` is false unless BOTH the Club
     * plan includes the feature and the club admin has turned sharing on for the org: a coach
     * must never be offered a switch that would do nothing, and a non-Club org sees no trace
     * of the feature at all (absent, not locked — owner ruling §8 Q3).
     */
    clubBook: {
      showSwitch: clubAccess.showTeamSwitch,
      sharing: clubAccess.teamSharing,
      canEdit: canWriteScoutingSummary(assignment.capabilities),
    },
    /**
     * The Money group's two settings, for the Settings page.
     *
     * ⚠ Served from HERE rather than by a second request to the accounting-settings route: that
     * route re-resolves the auth context, the team, the assignments and the active program year —
     * all four of which this handler has already done — purely to read two fields off the
     * `programYear` sitting in scope right now. Two round trips and eight queries where one and
     * four will do.
     *
     * ⚠ NULL for a coach without money access — the two figures never leave the server for
     * someone who may not see team finances. The client keys the whole group off the same
     * capability rather than off this being present, so the two cannot disagree. Writes still go
     * to the accounting-settings route, which gates them on money WRITE independently.
     */
    money: canViewMoney(assignment.capabilities)
      ? {
          autoRemindersEnabled: programYear.autoRemindersEnabled,
          creditApplication: programYear.creditApplication,
          // The team's standard split (mig 237). It pre-fills the new-fundraiser and new-sponsor
          // forms and NOTHING else — it is never applied to a record that already exists.
          defaultPlayerCreditPercent: programYear.defaultPlayerCreditPercent ?? 0,
          /* What the team was already holding when this season started (mig 262) — the one setting
             in this group that MOVES a figure elsewhere (Cash on hand, the register's first line,
             every running balance on Budget vs. Actual).
             ⚠ NULL IS NOT ZERO: a season that carried nothing shows no opening line anywhere, and
             the settings row says "None carried" rather than "$0.00". */
          openingBalance: programYear.openingBalance,
          openingBalanceFrom: await getSeasonName(programYear.openingBalanceFromYearId),
        }
      : null,
    // Assistant Coaches: the caller's effective capability set + their role, so the client can
    // hide/disable ungranted areas (defense-in-depth — the routes also enforce server-side).
    coachRole: assignment.coachRole,
    capabilities: assignment.capabilities,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]' });

// PATCH /api/coaches/[orgSlug]/teams/[teamId] — coach edits team division (standalone head coach only)
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  // Write: the live season only — a finished season's configuration is part of its record.
  const resolved = await resolveCoachContext(orgSlug, teamId, { requireLiveSeason: true });
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;

  const body = await req.json().catch(() => ({}));

  /**
   * Club Shared Book — "Share our book with the club" (owner ruling §8 Q1: the club admin
   * enables, each head coach opts their own team in). `notes`-gated, the same grant that owns
   * the book line, because this decides whose words become club-readable.
   *
   * ⚠ The org-level switch is re-checked HERE and not merely on the GET: a stale tab, or a
   * hand-rolled request, must not be able to turn on sharing in an org that never allowed it.
   */
  if ('shareClubBook' in body) {
    const denied = denyUnless(
      canWriteScoutingSummary(assignment.capabilities),
      'Only coaches with notes access can change book sharing.',
    );
    if (denied) return denied;
    const access = resolveClubBookAccessFor(ctx.org, team);
    if (!access.showTeamSwitch) {
      return NextResponse.json(
        { error: 'Your club has not turned on opponent-book sharing.' },
        { status: 403 },
      );
    }
    if (typeof body.shareClubBook !== 'boolean') {
      return NextResponse.json({ error: 'shareClubBook must be true or false' }, { status: 400 });
    }
    // A JSON error rather than an unhandled throw: the client reverts its optimistic switch on
    // any non-ok response, and a switch that governs who may read this team's notes must never
    // be left showing a state the server did not accept.
    try {
      const sharing = await setRepTeamShareClubBook(teamId, body.shareClubBook);
      return NextResponse.json({ ok: true, shareClubBook: sharing });
    } catch {
      return NextResponse.json({ error: 'Could not change book sharing.' }, { status: 500 });
    }
  }

  // Lineup season-default caps (P3) — an OPERATIONAL setting, gated on the lineups capability
  // (a head coach or an assistant granted lineups). Program-year scoped.
  if ('lineupSettings' in body) {
    const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
    if (denied) return denied;
    const settings = normalizeLineupSettings(body.lineupSettings);
    const updated = await updateRepProgramYear(programYear.id, { lineupSettings: settings });
    return NextResponse.json({ ok: true, lineupSettings: updated.lineupSettings });
  }

  // Division — restricted to the head coach of a standalone team.
  if ('division' in body) {
    const scope = computeScope(ctx.org, assignment.coachRole);
    if (!scope.canEditDivision) {
      return NextResponse.json(
        { error: 'Only the head coach of a standalone Premium team can change the division.' },
        { status: 403 },
      );
    }
    const raw = body.division;
    if (raw != null && typeof raw !== 'string') {
      return NextResponse.json({ error: 'division must be a string or null' }, { status: 400 });
    }
    const division = typeof raw === 'string' ? raw.trim() : '';
    if (division.length > 30) {
      return NextResponse.json({ error: 'Division must be 30 characters or fewer.' }, { status: 400 });
    }
    const team = await updateRepTeam(teamId, { division: division || null });
    return NextResponse.json({ ok: true, division: team.division });
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]' });
