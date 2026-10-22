import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIVE_SEASON_STATUSES } from '@/lib/season-live';
import { birthdaySportRows, type BirthdaySeasonInput, type BirthdaySportRow, type BirthdayTeamInput } from '@/lib/birthday-cutoff';

/**
 * The sports a club runs, with what the "When birthdays count from" card says about each (Club Tier Stage 4c-2 Part A).
 * Four plain reads, the rows kept to the columns the rule needs (and a team's seasons to the LIVE ones — the only years the
 * card reads — so the read stays small as a club's history grows); the rule itself is `birthdaySportRows`. The Settings card
 * reads it, and so does the org-settings route, to refuse a cut-off for a sport the club does not run.
 */
export async function loadBirthdaySports(orgId: string): Promise<BirthdaySportRow[]> {
  const [teamsRes, seasonsRes] = await Promise.all([
    supabaseAdmin.from('rep_teams').select('id, name, sport, is_archived').eq('org_id', orgId),
    supabaseAdmin.from('league_seasons').select('id, sport, status').eq('org_id', orgId),
  ]);
  if (teamsRes.error) throw teamsRes.error;
  if (seasonsRes.error) throw seasonsRes.error;
  const teamRows = teamsRes.data ?? [];
  const seasonRows = seasonsRes.data ?? [];

  const teamIds = teamRows.filter(t => !t.is_archived).map(t => t.id as string);
  const seasonIds = seasonRows.filter(s => s.status !== 'archived').map(s => s.id as string);
  const [yearsRes, divisionsRes] = await Promise.all([
    teamIds.length
      ? supabaseAdmin.from('rep_program_years').select('team_id, status, created_at, born_from_year, born_to_year').in('team_id', teamIds).in('status', [...LIVE_SEASON_STATUSES])
      : Promise.resolve({ data: [], error: null }),
    seasonIds.length
      ? supabaseAdmin.from('league_divisions').select('season_id, name, born_from_year, born_to_year').in('season_id', seasonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (yearsRes.error) throw yearsRes.error;
  if (divisionsRes.error) throw divisionsRes.error;

  const yearsByTeam = new Map<string, BirthdayTeamInput['seasons']>();
  for (const y of yearsRes.data ?? []) {
    const list = yearsByTeam.get(y.team_id as string) ?? [];
    list.push({ status: y.status as string, createdAt: y.created_at as string, bornFromYear: (y.born_from_year as number | null) ?? null, bornToYear: (y.born_to_year as number | null) ?? null });
    yearsByTeam.set(y.team_id as string, list);
  }
  const divisionsBySeason = new Map<string, BirthdaySeasonInput['divisions']>();
  for (const d of divisionsRes.data ?? []) {
    const list = divisionsBySeason.get(d.season_id as string) ?? [];
    list.push({ name: d.name as string, bornFromYear: (d.born_from_year as number | null) ?? null, bornToYear: (d.born_to_year as number | null) ?? null });
    divisionsBySeason.set(d.season_id as string, list);
  }

  const teams: BirthdayTeamInput[] = teamRows.map(t => ({
    name: t.name as string,
    sport: t.sport as string | null,
    isArchived: !!t.is_archived,
    seasons: yearsByTeam.get(t.id as string) ?? [],
  }));
  const seasons: BirthdaySeasonInput[] = seasonRows.map(s => ({
    sport: s.sport as string | null,
    status: s.status as string,
    divisions: divisionsBySeason.get(s.id as string) ?? [],
  }));
  return birthdaySportRows(teams, seasons);
}
