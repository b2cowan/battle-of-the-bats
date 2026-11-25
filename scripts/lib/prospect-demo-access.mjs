/**
 * prospect-demo-access.mjs — people's access survives a prospect-demo rebuild (owner 2026-11-25: "keep anyone who I have
 * added as an additional user").
 *
 * The rebuild leaves club memberships alone, but deleting the world takes these with it:
 *   · rep team staff (the seat and its season rows) and pending team-staff invitations — they go with the rep teams
 *   · house-league coaches and their pending invitations — they go with the seasons
 *   · "only these rep groups" / "only these tournaments" limits — they go with the groups and tournaments
 *
 *   saveAccess(ctx)      before the reset: reads them all and writes them to .probe/ (git-ignored)
 *   restoreAccess(ctx)   after the build: puts them back, as they were
 *
 * ⚖ WHAT WAS THERE WINS. A seat the seed also builds (a demo coach, say) is replaced by the saved one, so a permission
 * changed by hand stays changed. A demo seat that was deleted outright leaves nothing to save, so the build adds it again.
 * The same rule means a coach CHANGED IN THE CONFIG is added beside the saved one; remove the old one in the product.
 *
 * ⚠ THE FILE IS THE SAFETY NET. A rebuild that stops half-way has already deleted these rows; the next run reads the file,
 * and the file wins over whatever the half-built world holds. After a run that FINISHED, the file holds only what the
 * database refused (the database wins for everything else), so a later change made by hand is never undone.
 *
 * NOT kept: family connections. They hang off children the rebuild replaces, and the walks invite those parents live.
 * Kestrel Bay: its one rep team is made by the pictures' extras script with a new id each time, so a seat added there by
 * hand cannot be matched and is listed as not put back.
 *
 * Rep team, season and group ids are stable across rebuilds (prospect-demo-rep.mjs › stableId); house-league divisions and
 * teams and tournaments are not, so those are matched by name and slug. Anything whose team no longer exists is listed.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pendingFile = (root, slug) => join(root, '.probe', `prospect-demo-access-${slug}.json`);
const asideFile = (file, why) => file.replace(/\.json$/, `-${why}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

/** Whole or not at all: a run killed mid-write must not leave the only copy half-written. */
function writeCopy(file, data) {
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
}

/** One person on one rep team: their seat and season rows are saved, merged and put back as ONE thing. */
const pair = (r) => `${r.team_id}|${r.user_id}`;
const PAIRED = ['repStaff', 'repCoaches'];

const LISTS = {
  repStaff: pair,
  repCoaches: pair,
  teamInvites: (r) => r.id,
  leagueCoaches: (r) => `${r.place.season}|${r.place.division}|${r.place.team}|${r.row.email}`,
  groupScopes: (r) => `${r.member_id}|${r.group_id}`,
  tournamentLimits: (r) => `${r.org_member_id}|${r.slug}`,
};

/** The saved lists win by key; a key only the database has is added (every row of it: a coach keeps their history). */
function merge(saved, current) {
  // Program years stay the saved list: a season only the half-built world has was never part of what is being put back.
  const out = { ...current, programYears: saved.programYears, names: { ...current.names, ...saved.names } };
  // A pair the file knows takes NOTHING from the database: a season row the half-built world added to someone who had been
  // removed from it would otherwise come back as access.
  const onTeams = new Set(PAIRED.flatMap(list => saved[list].map(pair)));
  for (const [list, key] of Object.entries(LISTS)) {
    const held = PAIRED.includes(list) ? onTeams : new Set(saved[list].map(key));
    out[list] = [...saved[list], ...current[list].filter(r => !held.has(key(r)))];
  }
  return out;
}

async function leaguePlaces({ db, ORG, one }) {
  const seasons = await one('seasons', db.from('league_seasons').select('id, slug').eq('org_id', ORG));
  if (!seasons.length) return [];
  const ids = seasons.map(s => s.id);
  const divisions = await one('divisions', db.from('league_divisions').select('id, name, season_id').in('season_id', ids));
  const teams = await one('league teams', db.from('league_teams').select('id, name, division_id').in('season_id', ids));
  return teams.map(t => {
    const d = divisions.find(x => x.id === t.division_id);
    return { id: t.id, season: seasons.find(s => s.id === d?.season_id)?.slug, division: d?.name, team: t.name };
  });
}

async function readAccess(ctx) {
  const { db, ORG, one } = ctx;
  const all = (table, label, col = 'org_id') => one(label, db.from(table).select('*').eq(col, ORG));
  const members = await all('organization_members', 'members', 'organization_id');
  const memberIds = members.map(m => m.id);
  const places = await leaguePlaces(ctx);
  const tournaments = await one('tournaments', db.from('tournaments').select('id, slug').eq('org_id', ORG));
  const repGroups = await one('rep groups', db.from('rep_team_groups').select('id, name').eq('org_id', ORG));
  const forMembers = async (table, col) => (memberIds.length ? one(table, db.from(table).select('*').in(col, memberIds)) : []);
  const nameOf = (m) => m.display_name ?? m.invited_email ?? m.user_id;
  return {
    org: ORG,
    // by account id AND by membership id: the limits name the membership
    names: Object.fromEntries(members.flatMap(m => [[m.user_id, nameOf(m)], [m.id, nameOf(m)]])),
    programYears: (await one('program years', db.from('rep_program_years').select('id').eq('org_id', ORG))).map(r => r.id),
    repStaff: await all('rep_team_staff_memberships', 'team staff'),
    repCoaches: await all('rep_team_coaches', 'team season staff'),
    teamInvites: await all('assistant_invite_tokens', 'team staff invitations'),
    leagueCoaches: (await all('league_team_coaches', 'house league coaches')).map(row => {
      const p = places.find(x => x.id === row.team_id);
      return { place: { season: p?.season, division: p?.division, team: p?.team }, row };
    }),
    groupScopes: (await forMembers('org_member_rep_group_scopes', 'member_id'))
      .map(r => ({ member_id: r.member_id, group_id: r.group_id, name: repGroups.find(g => g.id === r.group_id)?.name })),
    tournamentLimits: (await forMembers('org_member_tournament_assignments', 'org_member_id'))
      .map(r => ({ org_member_id: r.org_member_id, slug: tournaments.find(t => t.id === r.tournament_id)?.slug })),
  };
}

export async function saveAccess(ctx) {
  const { root, slug, ORG, ok } = ctx;
  const file = pendingFile(root, slug);
  let saved = await readAccess(ctx);
  mkdirSync(join(root, '.probe'), { recursive: true });
  if (existsSync(file)) {
    const earlier = JSON.parse(readFileSync(file, 'utf8'));
    if (earlier.org === ORG) {
      saved = merge(earlier, saved);
      ok('picked up access saved by an earlier run that is still owed');
    } else renameSync(file, asideFile(file, 'other-org')); // the club was made again: keep the old copy, don't apply it
  }
  writeCopy(file, saved);
  ok(`saved before the reset: ${saved.repStaff.length} rep team staff · ${saved.leagueCoaches.length} house league coach rows · ${saved.teamInvites.length} team staff invitations · ${saved.groupScopes.length + saved.tournamentLimits.length} access limits`);
  return saved;
}

export async function restoreAccess(ctx, saved) {
  const { db, ORG, one, ok, root, slug } = ctx;
  const skipped = []; // what it belonged to (a team, a season, an account) is not in the rebuilt world
  const widened = []; // a limit that could not return: that person may now see MORE
  const failed = [];  // the database refused it: it stays in the file, and the next run tries again
  const owed = Object.fromEntries(Object.keys(LISTS).map(list => [list, []]));
  const who = (id) => saved.names[id] ?? id;
  /** Runs one write. A missing account or parent (foreign key) cannot ever succeed; anything else is owed to a next run. */
  const tried = async (label, query, owe) => {
    const { error } = await query;
    if (!error) return true;
    if (error.code === '23503') skipped.push(`${label}: the account or record it points at no longer exists`);
    else { failed.push(`${label}: ${error.message}`); for (const [list, rows] of Object.entries(owe)) owed[list].push(...rows); }
    return false;
  };
  const idsOf = async (table, col = 'org_id') => new Set((await one(table, db.from(table).select('id').eq(col, ORG))).map(r => r.id));

  const teams = await idsOf('rep_teams');
  const yearRows = await one('program years', db.from('rep_program_years').select('id, team_id, status').eq('org_id', ORG));
  const years = new Set(yearRows.map(r => r.id));

  // Rep team staff: for everyone who was on a team, the seat and its season rows go back exactly as they were. Seasons
  // that existed at save time (and any being written back) are replaced; the live season then follows the seat.
  const pairs = new Map([...saved.repStaff, ...saved.repCoaches].map(r => [pair(r), r]));
  const known = new Set(saved.programYears.filter(id => years.has(id)));
  let staff = 0;
  for (const { team_id, user_id } of pairs.values()) {
    const label = `team staff ${who(user_id)}`;
    if (!teams.has(team_id)) { skipped.push(`${label} (their rep team is no longer in the demo)`); continue; }
    const seat = saved.repStaff.find(r => r.team_id === team_id && r.user_id === user_id);
    const rows = saved.repCoaches.filter(r => r.team_id === team_id && r.user_id === user_id);
    const back = rows.filter(r => years.has(r.program_year_id));
    const owe = { repStaff: seat ? [seat] : [], repCoaches: rows };
    if (seat) {
      if (!(await tried(label, db.from('rep_team_staff_memberships').delete().eq('team_id', team_id).eq('user_id', user_id), owe))) continue;
      if (!(await tried(label, db.from('rep_team_staff_memberships').insert(seat), owe))) continue;
      staff++;
    }
    const replace = [...new Set([...known, ...back.map(r => r.program_year_id)])];
    if (replace.length && !(await tried(label, db.from('rep_team_coaches').delete().eq('team_id', team_id).eq('user_id', user_id).in('program_year_id', replace), owe))) continue;
    if (back.length && !(await tried(label, db.from('rep_team_coaches').insert(back), owe))) continue;
    if (back.length < rows.length) skipped.push(`${label}: ${rows.length - back.length} season(s) that are no longer in the demo`);
    // A live season these rows don't cover (a new season year, or theirs was dropped) follows the seat: the portal's
    // writes read the season row, so a removed person must have none and a kept one must have theirs.
    const live = yearRows.find(y => y.team_id === team_id && y.status === 'active')?.id;
    if (!seat || !live || back.some(r => r.program_year_id === live)) continue;
    if (seat.status !== 'active') {
      await tried(label, db.from('rep_team_coaches').delete().eq('program_year_id', live).eq('user_id', user_id), owe);
    } else if (!known.has(live) || back.length < rows.length) {
      await tried(label, db.from('rep_team_coaches').upsert({ program_year_id: live, team_id, org_id: ORG, user_id, coach_role: seat.coach_role, capabilities: seat.capabilities }, { onConflict: 'program_year_id,user_id' }), owe);
    }
  }

  let invites = 0;
  for (const row of saved.teamInvites) {
    const label = `team staff invitation ${row.invited_email}`;
    if (!teams.has(row.team_id)) { skipped.push(`${label} (the rep team is no longer in the demo)`); continue; }
    const program_year_id = years.has(row.program_year_id) ? row.program_year_id : null;
    if (await tried(label, db.from('assistant_invite_tokens').upsert({ ...row, program_year_id }, { onConflict: 'id' }), { teamInvites: [row] })) invites++;
  }

  // House-league coaches: found again by season, division and team name; the database sets the season from the team.
  const places = await leaguePlaces(ctx);
  const groups = new Map();
  for (const c of saved.leagueCoaches) {
    const key = LISTS.leagueCoaches(c);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  let coaches = 0;
  for (const group of groups.values()) {
    const { place, row } = group[0];
    const label = `house league coach ${row.email} (${place.division} ${place.team})`;
    const team = places.find(p => p.season === place.season && p.division === place.division && p.team === place.team);
    if (!team) { skipped.push(`${label}: that team is no longer in the demo`); continue; }
    const owe = { leagueCoaches: group };
    if (!(await tried(label, db.from('league_team_coaches').delete().eq('team_id', team.id).eq('email', row.email), owe))) continue;
    if (await tried(label, db.from('league_team_coaches').insert(group.map(c => ({ ...c.row, team_id: team.id }))), owe)) coaches += group.length;
  }

  // Limits on a club member. No limit means "sees everything", so each one that cannot return is named and fails the run.
  const members = await idsOf('organization_members', 'organization_id');
  const repGroups = await idsOf('rep_team_groups');
  const tournaments = await one('tournaments', db.from('tournaments').select('id, slug').eq('org_id', ORG));
  let limits = 0;
  for (const s of saved.groupScopes) {
    if (!members.has(s.member_id)) continue; // no seat, nothing to limit
    if (!repGroups.has(s.group_id)) { widened.push(`${who(s.member_id)} was limited to the rep group "${s.name ?? s.group_id}", which is no longer in the demo`); continue; }
    if (await tried(`rep-group limit for ${who(s.member_id)}`, db.from('org_member_rep_group_scopes').upsert({ member_id: s.member_id, group_id: s.group_id }, { onConflict: 'member_id,group_id', ignoreDuplicates: true }), { groupScopes: [s] })) limits++;
  }
  for (const t of saved.tournamentLimits) {
    if (!members.has(t.org_member_id)) continue;
    const tournament = tournaments.find(x => x.slug === t.slug);
    if (!tournament) { widened.push(`${who(t.org_member_id)} was limited to the tournament "${t.slug}", which is no longer in the demo`); continue; }
    if (await tried(`tournament limit for ${who(t.org_member_id)}`, db.from('org_member_tournament_assignments').upsert({ org_member_id: t.org_member_id, tournament_id: tournament.id }, { onConflict: 'org_member_id,tournament_id', ignoreDuplicates: true }), { tournamentLimits: [t] })) limits++;
  }

  ok(`put back: ${staff} rep team staff · ${coaches} house league coach rows · ${invites} team staff invitations · ${limits} access limits`);

  const file = pendingFile(root, slug);
  for (const s of skipped) console.warn(`  ⚠ Not put back — ${s}`);
  for (const w of widened) console.warn(`  ✗ CHECK MEMBERS, this person may now see more: ${w}`);
  for (const f of failed) console.warn(`  ✗ Not put back — ${f}`);
  if (skipped.length || widened.length) {
    const kept = asideFile(file, 'not-restored');
    writeCopy(kept, saved);
    console.warn(`  ⚠ A full copy of what was saved is kept at ${kept}`);
  }
  if (failed.length) {
    writeCopy(file, { ...saved, ...owed });
    console.warn(`  ✗ ${failed.length} could not be saved to the database. They are kept at ${file}; run the rebuild again to retry.`);
  } else rmSync(file, { force: true });
  if (failed.length || widened.length) process.exitCode = 1;
  return { staff, coaches, invites, limits, skipped, widened, failed };
}
