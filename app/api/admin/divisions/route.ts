import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { coinTossKey } from '@/lib/tie-breakers';
import { announcePlayoffsSetIfReady, fillPlayoffTeamsThenAnnounce } from '@/lib/playoffs-set';
import { announceChampionsForTournament } from '@/lib/champions-notify';
import { withObservability } from '@/lib/observability';
import { ORG_REFERENCE_REFUSALS, memberInOrg } from '@/lib/org-references';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import { hasPlanFeature } from '@/lib/plan-features';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { INVITE_REFUSALS } from '@/lib/invite-only-words';

function tournamentLockedResponse() {
  return Response.json(
    { error: LOCKED_RESULTS },
    { status: 409 },
  );
}

async function isTournamentLocked(tournamentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();
  return data?.status === 'completed';
}

/** A division's contact is a member of this organization, as the tournament's default contact is (2026-10-16). */
async function contactMemberRefused(orgId: string, memberId: unknown): Promise<Response | null> {
  if (memberId === null || memberId === undefined || memberId === '') return null;
  if (await memberInOrg(orgId, memberId)) return null;
  return Response.json({ error: ORG_REFERENCE_REFUSALS.member }, { status: 400 });
}

type ApiPool = {
  id: string;
  divisionId: string;
  name: string;
  order: number;
};

type DbPool = {
  id: string;
  name: string;
  display_order: number;
};

// Creates missing slots and trims empty slots above capacity for every pool in a division.
// Idempotent: safe to call after every save/update.
async function syncSlots(tournamentId: string, divisionId: string, capacity: number | undefined) {
  if (!capacity || capacity <= 0) return;

  const { data: poolRows } = await supabaseAdmin
    .from('pools')
    .select('id, name')
    .eq('division_id', divisionId)
    .order('display_order', { ascending: true });

  const pools = poolRows ?? [];
  if (pools.length === 0) return;

  const slotCount = Math.floor(capacity / pools.length);
  if (slotCount <= 0) return;

  for (const pool of pools) {
    const namePrefix = pools.length === 1 ? '' : pool.name;

    const { data: existing } = await supabaseAdmin
      .from('pool_slots')
      .select('id, slot_number, team_id')
      .eq('pool_id', pool.id)
      .order('slot_number', { ascending: true });

    const existingSlots = existing ?? [];
    const existingNums = new Set(existingSlots.map((s: any) => s.slot_number));

    const toInsert: any[] = [];
    for (let n = 1; n <= slotCount; n++) {
      if (!existingNums.has(n)) {
        toInsert.push({
          pool_id:       pool.id,
          tournament_id: tournamentId,
          division_id:  divisionId,
          slot_number:   n,
          display_name:  namePrefix ? `${namePrefix} Team ${n}` : `Team ${n}`,
        });
      }
    }
    if (toInsert.length > 0) {
      await supabaseAdmin.from('pool_slots').insert(toInsert);
    }

    const emptyAbove = existingSlots.filter((s: any) => s.slot_number > slotCount && s.team_id === null);
    if (emptyAbove.length > 0) {
      await supabaseAdmin.from('pool_slots').delete().in('id', emptyAbove.map((s: any) => s.id));
    }
  }
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return Response.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  // ?counts=1 (Divisions' list, Tournament admin redesign Stage 5): each division's games, teams and waitlist too, so its
  // record can ask "Delete U11 Girls?" ONCE with what goes — never a refusal and a second question.
  const withCounts = url.searchParams.get('counts') === '1';
  const [{ data, error }, teamsRes, gamesRes] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('*, pools(*)')
      .eq('tournament_id', tournamentId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('teams')
      .select('division_id, status')
      .eq('tournament_id', tournamentId),
    withCounts
      ? supabaseAdmin.from('games').select('division_id, home_score, away_score').eq('tournament_id', tournamentId)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (error) return Response.json({ error: 'The divisions didn’t load.' }, { status: 500 });
  if (teamsRes.error || gamesRes.error) return Response.json({ error: 'The divisions didn’t load.' }, { status: 500 });

  // Accepted teams (every caller), and with ?counts=1 every team and the waitlist, keyed by division_id.
  const teamRows = (teamsRes.data ?? []) as { division_id: string; status: string | null }[];
  const tally = (rows: { division_id: string | null }[]) => rows.reduce<Record<string, number>>(
    (acc, row) => { if (row.division_id) acc[row.division_id] = (acc[row.division_id] ?? 0) + 1; return acc; },
    {},
  );
  const acceptedByDivision = tally(teamRows.filter(t => t.status === 'accepted'));
  const teamsByDivision = tally(teamRows);
  const waitlistByDivision = tally(teamRows.filter(t => t.status === 'waitlist'));
  const gameRows = (gamesRes.data ?? []) as { division_id: string | null; home_score: number | null; away_score: number | null }[];
  const gamesByDivision = tally(gameRows);
  const scoredByDivision = tally(gameRows.filter(g => g.home_score !== null || g.away_score !== null));

  return Response.json((data ?? []).map(group => ({
    id: group.id,
    tournamentId: group.tournament_id,
    name: group.name,
    minAge: group.min_age,
    maxAge: group.max_age,
    order: group.display_order,
    contactMemberId: group.contact_member_id ?? null,
    isClosed: group.is_closed,
    capacity: group.capacity,
    poolCount: group.pool_count,
    poolNames: group.pool_names,
    requiresPoolSelection: group.requires_pool_selection,
    playoffConfig: group.playoff_config,
    scheduleVisibility: group.schedule_visibility,
    playoffsAnnouncedAt: group.playoffs_announced_at ?? null,
    depositAmount: group.deposit_amount ?? null,
    depositDueDate: group.deposit_due_date ?? null,
    totalFeeAmount: group.total_fee_amount ?? null,
    totalFeeDueDate: group.total_fee_due_date ?? null,
    settings: (group.settings && typeof group.settings === 'object') ? group.settings : {},
    acceptedCount: acceptedByDivision[group.id] ?? 0,
    ...(withCounts ? {
      counts: {
        games: gamesByDivision[group.id] ?? 0,
        scoredGames: scoredByDivision[group.id] ?? 0,
        teams: teamsByDivision[group.id] ?? 0,
        waitlist: waitlistByDivision[group.id] ?? 0,
      },
    } : {}),
    pools: ((group.pools ?? [])
      .map((pool: { id: string; division_id: string; name: string; display_order: number }) => ({
        id: pool.id,
        divisionId: pool.division_id,
        name: pool.name,
        order: pool.display_order,
      })) as ApiPool[])
      .sort((a, b) => a.order - b.order),
  })));
}, { route: '/api/admin/divisions' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data, force, expected } = await req.json();
    // The free tournament tier (B2): an invite-only event has no spots and takes no registrations, and fees are written
    // only on a plan with payment tracking. A division's stored values stay as they are (R2's records read in place).
    const inviteOnly = runsInviteOnlyEvents(ctx.org.planId);
    const writesFees = hasPlanFeature(ctx.org.planId, 'payment_tracking');

    if (action === 'save') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;
      if (await isTournamentLocked(data.tournamentId)) return tournamentLockedResponse();
      const contactRefused = await contactMemberRefused(ctx.org.id, data.contactMemberId);
      if (contactRefused) return contactRefused;

      const { data: insertedGroup, error } = await supabaseAdmin.from('divisions').insert({
        tournament_id:           data.tournamentId,
        name:                    data.name,
        min_age:                 data.minAge,
        max_age:                 data.maxAge,
        display_order:           data.order,
        contact_member_id:       data.contactMemberId ?? null,
        is_closed:               data.isClosed,
        capacity:                inviteOnly ? null : data.capacity,
        pool_count:              data.poolCount,
        pool_names:              data.poolNames,
        requires_pool_selection: data.requiresPoolSelection,
        playoff_config:          data.playoffConfig,
        deposit_amount:          writesFees ? data.depositAmount ?? null : null,
        deposit_due_date:        writesFees ? data.depositDueDate ?? null : null,
        total_fee_amount:        writesFees ? data.totalFeeAmount ?? null : null,
        total_fee_due_date:      writesFees ? data.totalFeeDueDate ?? null : null,
        schedule_visibility:     data.scheduleVisibility ?? 'unpublished',
        settings:                data.settings ?? {},
      }).select('id').single();
      if (error) throw error;

      const poolCount = data.poolCount || 0;
      if (insertedGroup?.id && poolCount >= 2) {
        const names = (data.poolNames || '').split(',').map((n: string) => n.trim());
        const poolRows = Array.from({ length: poolCount }).map((_, index) => ({
          division_id: insertedGroup.id,
          name: names[index] || String.fromCharCode(65 + index),
          display_order: index,
        }));
        const { error: poolError } = await supabaseAdmin.from('pools').insert(poolRows);
        if (poolError) throw poolError;
      }

      if (insertedGroup?.id) {
        await syncSlots(data.tournamentId, insertedGroup.id, data.capacity);
      }
    }

    else if (action === 'update' && id) {
      const { data: ag } = await supabaseAdmin
        .from('divisions')
        .select('tournament_id, playoff_config')
        .eq('id', id)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, ag.tournament_id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(ag.tournament_id)) return tournamentLockedResponse();
      }

      // Merge playoff_config defensively. coinTossResults is owned by the
      // 'record-coin-toss' action, so always preserve it from the DB — never let a
      // (possibly stale) division-form payload drop or overwrite it.
      const currentConfig = (ag?.playoff_config ?? {}) as Record<string, unknown>;
      const incomingConfig = { ...(data.playoffConfig ?? {}) } as Record<string, unknown>;
      delete incomingConfig.coinTossResults;
      const mergedConfig = { ...currentConfig, ...incomingConfig };
      const contactRefused = await contactMemberRefused(ctx.org.id, data.contactMemberId);
      if (contactRefused) return contactRefused;

      const { error: agError } = await supabaseAdmin.from('divisions').update({
        name:                    data.name,
        min_age:                 data.minAge,
        max_age:                 data.maxAge,
        display_order:           data.order,
        contact_member_id:       data.contactMemberId ?? null,
        ...(inviteOnly ? {} : { capacity: data.capacity }),
        pool_count:              data.poolCount,
        pool_names:              data.poolNames,
        requires_pool_selection: data.requiresPoolSelection,
        playoff_config:          mergedConfig,
        ...(writesFees ? {
          deposit_amount:          data.depositAmount ?? null,
          deposit_due_date:        data.depositDueDate ?? null,
          total_fee_amount:        data.totalFeeAmount ?? null,
          total_fee_due_date:      data.totalFeeDueDate ?? null,
        } : {}),
        schedule_visibility:     data.scheduleVisibility,
        settings:                data.settings ?? {},
      }).eq('id', id);
      if (agError) throw agError;

      const newPoolCount = data.poolCount || 0;
      const newNames = (data.poolNames || '').split(',').map((n: string) => n.trim());

      const { data: existingPools } = await supabaseAdmin
        .from('pools')
        .select('*')
        .eq('division_id', id)
        .order('display_order', { ascending: true });

      const pools: DbPool[] = existingPools || [];

      if (newPoolCount < 2) {
        if (pools.length > 0) {
          await supabaseAdmin.from('pools').delete().in('id', pools.map(p => p.id));
        }
      } else {
        for (let i = 0; i < newPoolCount; i++) {
          const name = newNames[i] || String.fromCharCode(65 + i);
          if (pools[i]) {
            await supabaseAdmin.from('pools').update({ name, display_order: i }).eq('id', pools[i].id);
          } else {
            await supabaseAdmin.from('pools').insert({ division_id: id, name, display_order: i });
          }
        }
        if (pools.length > newPoolCount) {
          await supabaseAdmin.from('pools').delete().in('id', pools.slice(newPoolCount).map(p => p.id));
        }
      }

      if (ag) {
        await syncSlots(ag.tournament_id, id, data.capacity);
      }
    }

    else if (action === 'record-coin-toss' && id) {
      // Record (or clear) an admin coin-toss result for a tied group in this division.
      // Body: { action, id: divisionId, groupKey, orderedTeamIds: string[] }
      // orderedTeamIds = the organizer's finishing order (best → worst) for the tied set;
      // an empty array clears the recorded result. Stored in playoff_config.coinTossResults.
      const { groupKey, orderedTeamIds } = (data ?? {}) as { groupKey?: string; orderedTeamIds?: unknown };

      const { data: div } = await supabaseAdmin
        .from('divisions')
        .select('tournament_id, playoff_config')
        .eq('id', id)
        .single();
      if (!div) return Response.json({ error: 'Division not found' }, { status: 404 });

      const denied = scopeGuard(ctx, div.tournament_id);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, div.tournament_id);
      if (wrongOrg) return wrongOrg;
      // Match every other mutating action here: a locked (completed) tournament
      // must not have its bracket re-seeded by a late coin toss.
      if (await isTournamentLocked(div.tournament_id)) return tournamentLockedResponse();

      if (typeof groupKey !== 'string' || !groupKey) {
        return Response.json({ error: 'groupKey required' }, { status: 400 });
      }
      const ordered = Array.isArray(orderedTeamIds)
        ? orderedTeamIds.filter((t): t is string => typeof t === 'string')
        : [];

      const playoffConfig = (div.playoff_config ?? {}) as { coinTossResults?: Record<string, string[]> };
      const results: Record<string, string[]> = { ...(playoffConfig.coinTossResults ?? {}) };

      // The groupKey must name only accepted teams in THIS division — for both
      // recording and clearing — so no caller can read/write/delete entries keyed
      // by teams outside the division.
      const { data: divTeams } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('division_id', id)
        .eq('status', 'accepted');
      const validIds = new Set((divTeams ?? []).map(t => t.id));
      const keyTeamIds = groupKey.split('|');
      if (keyTeamIds.length < 2 || !keyTeamIds.every(t => validIds.has(t))) {
        return Response.json({ error: 'groupKey does not name a valid tied group in this division' }, { status: 400 });
      }

      if (ordered.length === 0) {
        // Clear the recorded result for this group.
        delete results[groupKey];
      } else {
        // The submitted order must cover exactly the tied set named by groupKey.
        if (coinTossKey(ordered) !== groupKey) {
          return Response.json({ error: 'orderedTeamIds do not match groupKey' }, { status: 400 });
        }
        results[groupKey] = ordered;
      }

      const { error } = await supabaseAdmin
        .from('divisions')
        .update({ playoff_config: { ...playoffConfig, coinTossResults: results } })
        .eq('id', id);
      if (error) throw error;

      // Re-run seed resolution so an already-filled bracket re-points its
      // first-round slots to the coin-toss-resolved order. Without this the toss
      // is persisted but inert — the bracket, filled earlier in arbitrary tied
      // order, never updates and the toss appears to do nothing (J1-084). Only
      // re-points slots still carrying a standings placeholder, so games already
      // played are untouched. Best-effort: a failure here must not roll back the
      // recorded toss (which is the source of truth for standings either way). The toss settles the last tied seed: if
      // the division is published, "Playoffs are set" is now true (A69 / P4).
      await fillPlayoffTeamsThenAnnounce(div.tournament_id, [id], ctx.user.id);
    }

    else if (action === 'set-visibility') {
      // Lightweight bulk-or-single visibility update.
      // Body: { action, id?, tournamentId?, scheduleVisibility }
      const { id: agId, tournamentId: tId, scheduleVisibility: vis } = data ?? {};
      if (!vis) throw new Error('scheduleVisibility required');
      // Two-state only (mig 129): reject the removed/legacy values fast with a clear
      // 400 instead of letting the DB CHECK surface a raw error. Real names are the
      // only published mode now.
      if (vis !== 'unpublished' && vis !== 'published') {
        return Response.json({ error: 'scheduleVisibility must be "unpublished" or "published"' }, { status: 400 });
      }

      if (agId) {
        const { data: ag } = await supabaseAdmin.from('divisions').select('tournament_id').eq('id', agId).single();
        if (ag) {
          const denied = scopeGuard(ctx, ag.tournament_id);
          if (denied) return denied;
          const wrongOrg = await requireTournamentInOrg(ctx, ag.tournament_id);
          if (wrongOrg) return wrongOrg;
          if (await isTournamentLocked(ag.tournament_id)) return tournamentLockedResponse();
        }
        const { error } = await supabaseAdmin.from('divisions').update({ schedule_visibility: vis }).eq('id', agId);
        if (error) throw error;
        // Publishing a division whose playoff teams are known is the moment "Playoffs are set" is true (P4).
        if (vis === 'published') await announcePlayoffsSetIfReady(agId, ctx.user.id);
        // The champions moment waits while any division is held back (Stage 0 · D1), so publishing asks again.
        if (vis === 'published' && ag) await announceChampionsForTournament(ag.tournament_id, ctx.user.id);
      } else if (tId) {
        const denied = scopeGuard(ctx, tId);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, tId);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(tId)) return tournamentLockedResponse();
        const { data: published, error } = await supabaseAdmin.from('divisions').update({ schedule_visibility: vis }).eq('tournament_id', tId).select('id');
        if (error) throw error;
        if (vis === 'published') await Promise.all((published ?? []).map(d => announcePlayoffsSetIfReady(d.id as string, ctx.user.id)));
        if (vis === 'published') await announceChampionsForTournament(tId, ctx.user.id);
      } else {
        throw new Error('id or tournamentId required');
      }
    }

    else if (action === 'set-closed' && id) {
      // Opening or closing registration is not part of an invite-only event (its Registration row is the plan's lock).
      if (inviteOnly) return new Response(JSON.stringify({ error: INVITE_REFUSALS.hidden }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      const { data: ag } = await supabaseAdmin.from('divisions').select('tournament_id').eq('id', id).single();
      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, ag.tournament_id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(ag.tournament_id)) return tournamentLockedResponse();
      }
      // Reopening registration (isClosed → false) atomically takes the public schedule
      // back offline: a division can never be open for registration AND showing a live
      // schedule at the same time. Both columns update in one write so the two states
      // can never drift, even if the request is retried. (Closing does not touch
      // visibility — publishing is a separate, explicit action.)
      const updates: { is_closed: boolean; schedule_visibility?: string } = { is_closed: data.isClosed };
      if (data.isClosed === false) updates.schedule_visibility = 'unpublished';
      const { error } = await supabaseAdmin.from('divisions').update(updates).eq('id', id);
      if (error) throw error;
    }

    else if (action === 'delete' && id) {
      const { data: ag } = await supabaseAdmin
        .from('divisions')
        .select('tournament_id')
        .eq('id', id)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, ag.tournament_id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(ag.tournament_id)) return tournamentLockedResponse();
      }

      // Deleting a division is destructive well beyond the division row: games.division_id and
      // teams.division_id both CASCADE, so this removes the division's ENTIRE SCHEDULE — scores
      // included — and every team registered into it. That happened silently until now; prod had
      // no games FK at all (added in migration 203) and dev has cascaded since day one behind
      // this unguarded endpoint. The FK makes the deletion coherent; this guard makes it consented.
      // Mirrors the TEAM_HAS_GAMES guard on DELETE /api/admin/teams (migration 200).
      // Strict `!== true`: only a literal boolean confirmation skips the guard, so a stray truthy
      // value from a malformed client ("no", 0-length string, 1) can never silently bypass it.
      if (force !== true) {
        const [{ data: linkedGames }, { count: teamCount }] = await Promise.all([
          supabaseAdmin
            .from('games')
            .select('id, home_score, away_score')
            .eq('division_id', id),
          supabaseAdmin
            .from('teams')
            .select('id', { count: 'exact', head: true })
            .eq('division_id', id),
        ]);

        const games = linkedGames ?? [];
        const teams = teamCount ?? 0;
        if (games.length > 0 || teams > 0) {
          const scored = games.filter(g => g.home_score !== null || g.away_score !== null).length;
          const parts: string[] = [];
          if (games.length) parts.push(`${games.length} game${games.length === 1 ? '' : 's'}${scored > 0 ? ` (${scored} with a recorded score)` : ''}`);
          if (teams) parts.push(`${teams} registered team${teams === 1 ? '' : 's'}`);
          return Response.json(
            {
              error: 'DIVISION_HAS_GAMES',
              message:
                `This division still holds ${parts.join(' and ')}. Deleting it removes ${games.length ? 'those games and their scores' : 'them'}` +
                `${games.length && teams ? ' along with the teams' : ''} permanently. ` +
                `Move them to another division first, or confirm to continue.`,
              gameCount: games.length,
              scoredGameCount: scored,
              teamCount: teams,
            },
            { status: 409 },
          );
        }
      }

      // Asked once with the counts (Stage 5): the question named what goes, so delete only if that is still what goes.
      // A team that registered (or a game added) since then is said in a fresh question, never removed unseen.
      if (force === true && expected && typeof expected === 'object') {
        const [{ data: games }, { data: teams }] = await Promise.all([
          supabaseAdmin.from('games').select('home_score, away_score').eq('division_id', id),
          supabaseAdmin.from('teams').select('status').eq('division_id', id),
        ]);
        const now = {
          games: (games ?? []).length,
          scoredGames: (games ?? []).filter(g => g.home_score !== null || g.away_score !== null).length,
          teams: (teams ?? []).length,
          waitlist: (teams ?? []).filter(t => t.status === 'waitlist').length,
        };
        // The question named the games, how many have a score, and the teams: any of them moving asks again.
        if (now.games !== Number(expected.games) || now.teams !== Number(expected.teams)
          || (expected.scoredGames !== undefined && now.scoredGames !== Number(expected.scoredGames))) {
          return Response.json({ error: 'DIVISION_CHANGED', counts: now }, { status: 409 });
        }
      }

      const { error } = await supabaseAdmin.from('divisions').delete().eq('id', id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    console.error('Division Admin Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { route: '/api/admin/divisions' });
