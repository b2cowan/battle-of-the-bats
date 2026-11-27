import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import {
  getDivisionsForSeason, getLeagueSeasons, getOrgPlaceNames, getPracticesForSeason, getSeasonGamesEveryStatus, getTeamsForSeason,
  mapLeagueRegistration,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { orderSeasons, seasonGroup } from '@/lib/house-league-season';
import { likeOrTerm, matchesSearch } from '@/lib/house-league-registrations';
import { loadRegistrationMoneyLines } from '@/lib/league-money-read';
import { loadRegistrationDebits } from '@/lib/league-pay-facts';
import { seasonCalendar, teamNextBooking, type SeasonBooking } from '@/lib/league-season-calendar';
import {
  FIND_ALL, FIND_FIRST, FIND_MIN, findMoney, findNames, findNextLine, findOrder, findStatus, type FindRow,
} from '@/lib/house-league-find';
import { tournamentToday } from '@/lib/timezone';
import type { LeagueRegistration } from '@/lib/types';

/**
 * FIND A CHILD OR A PARENT (Club Tier Stage 13e-4 A, 13e-1 A; lib/house-league-find.ts holds the words and the rules).
 * GET ?orgSlug=…&q=…[&past=1][&all=1] — every registration in every RUNNING season (every view: To review, Active, Waitlist,
 * Ended) that Registrations' own search would find; `past=1` adds the finished seasons. The first FIND_FIRST rows, then
 * `total` for "Show all"; `all=1` lists up to FIND_ALL.
 *
 * ⚖ The ONE new read of 13e. Gated exactly as Registrations is (`houseLeagueRefusal(ctx, 'read')` — the season list's own
 * gate): the treasurer, who cannot open Registrations, is refused here too (no side door). Read-only.
 */
export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;
  const orgId = ctx!.org.id;

  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  const withPast = url.searchParams.get('past') === '1';
  const all = url.searchParams.get('all') === '1';
  if (query.length < FIND_MIN) return NextResponse.json({ rows: [], total: 0 });

  // Running seasons first, in the home page's own order; the finished ones only when asked. A season still being set up
  // ("Getting ready") takes no registrations, so it is never searched.
  const seasons = orderSeasons((await getLeagueSeasons(orgId)).filter(s => {
    const g = seasonGroup(s);
    return g === 'running' || (withPast && g === 'past');
  }));
  if (seasons.length === 0) return NextResponse.json({ rows: [], total: 0 });
  const rank = new Map(seasons.map((s, i) => [s.id, i]));
  const seasonById = new Map(seasons.map(s => [s.id, s]));

  // The database narrows by the longest word typed, over the child's, the guardian's and both emails; Registrations' own
  // search (`matchesSearch`) then decides on the whole text. The word goes into a PostgREST `.or()` string through the season
  // list's own escape (`likeOrTerm`: a comma, bracket or quote can never add a condition).
  const word = query.split(/\s+/).sort((a, b) => b.length - a.length)[0];
  const s = likeOrTerm(word);
  const { data, error } = await supabaseAdmin.from('league_registrations').select('*')
    .eq('org_id', orgId).in('season_id', seasons.map(x => x.id))
    .or([
      'player_first_name', 'player_last_name', 'guardian_first_name', 'guardian_last_name', 'guardian_email', 'guardian_email_2',
    ].map(c => `${c}.ilike.%${s}%`).join(','))
    // In a stable order, so a two-letter word that matches past the cap reads the same rows (and count) on every call.
    .order('id')
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matched = findOrder(((data ?? []) as Record<string, unknown>[]).map(mapLeagueRegistration)
    .filter(r => matchesSearch(r, query))
    .map(r => ({ r, seasonRank: rank.get(r.seasonId) ?? 0, ...findNames(r) })));
  const total = matched.length;
  const shown = matched.slice(0, all ? FIND_ALL : FIND_FIRST);
  if (shown.length === 0) return NextResponse.json({ rows: [], total });

  // Each season with a row: its divisions and teams (names) and — only where a shown child is on a team — the schedule the
  // season page draws, for the team's next game or practice. What is owing reads only the shown children's own lines (the
  // child's page reads them the same way), never each season's whole book.
  const today = tournamentToday();
  const nowMs = Date.now();
  const bySeason = new Map<string, LeagueRegistration[]>();
  for (const { r } of shown) {
    const list = bySeason.get(r.seasonId);
    if (list) list.push(r); else bySeason.set(r.seasonId, [r]);
  }
  const shownIds = shown.map(m => m.r.id);
  const anyTeam = shown.some(m => m.r.teamId);
  const [debits, lines, places, perSeason] = await Promise.all([
    loadRegistrationDebits(orgId, shownIds),
    loadRegistrationMoneyLines(shownIds),
    anyTeam ? getOrgPlaceNames(orgId) : Promise.resolve(null),
    Promise.all([...bySeason].map(async ([seasonId, regs]) => {
      const teamed = regs.some(r => r.teamId);
      const [divisions, teams, games, practices] = await Promise.all([
        getDivisionsForSeason(seasonId),
        getTeamsForSeason(seasonId),
        teamed ? getSeasonGamesEveryStatus(seasonId) : Promise.resolve([]),
        teamed ? getPracticesForSeason(seasonId) : Promise.resolve([]),
      ]);
      return { seasonId, divisions, teams, games, practices };
    })),
  ]);

  const facts = new Map(perSeason.map(p => {
    const season = seasonById.get(p.seasonId)!;
    const teamName = new Map(p.teams.map(t => [t.id, t.name]));
    const divisionName = new Map(p.divisions.map(d => [d.id, d.name]));
    // The schedule's own bookings (`seasonCalendar`, as the season page builds them): a postponed game has left them. The
    // place is named as the public schedule names it (`getOrgPlaceNames`).
    const bookings: SeasonBooking[] = p.games.length || p.practices.length ? seasonCalendar({
      seasonName: season.name, sport: season.sport ?? null, games: p.games, practices: p.practices, teamName, divisionName,
      placeOf: (venueId, facilityId) => {
        const venue = places?.venues.get(venueId);
        return venue ? {
          venue: venue.name, facility: facilityId ? places!.facilities.get(facilityId) ?? null : null, address: venue.address,
          sections: facilityId ? places!.sections.get(facilityId) : undefined,
        } : null;
      },
    }).bookings : [];
    return [p.seasonId, { season, teamName, divisionName, bookings }];
  }));

  const rows: FindRow[] = shown.map(({ r, child, guardian }) => {
    const f = facts.get(r.seasonId)!;
    const team = r.teamId ? f.teamName.get(r.teamId) ?? null : null;
    // A child waiting or still to review shows their place and no team line (drawing tab 3 note 5).
    const placed = r.status === 'active' && !!r.teamId && !!team;
    return {
      id: r.id, seasonId: r.seasonId, season: f.season.name, past: seasonGroup(f.season) === 'past',
      child, division: r.divisionId ? f.divisionName.get(r.divisionId) ?? null : null,
      team: placed ? team : null, guardian, email: r.guardianEmail,
      status: findStatus(r),
      money: findMoney(r, f.season, lines.get(r.id) ?? [], today, debits[r.id] ?? null),
      next: placed ? findNextLine(team!, teamNextBooking(f.bookings, r.teamId!, nowMs)) : null,
    };
  });
  return NextResponse.json({ rows, total });
}, { route: '/api/admin/house-league/find' });
