import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { normalizeGuardianEmail } from './guardian-email';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getFamilyReach, getOrgForGate, type FamilyLink } from './family-access';
import { isLiveLeagueSeasonStatus, teamKey, type ReachedTeam, type TeamKind } from './family-link-reach';
import { familyTeamSchedule, HIDDEN, type FamilyTeamSchedule } from './family-team-schedule';
import { clubPublicContact } from './club-email-context';
import { leaguePayToken } from './league-pay-link';
import { openSignupLink } from './league-signup-link';
import { loadLeaguePayFacts } from './league-pay-facts';
import { accountNameOf, clubNameOf } from './family-invitation';
import type { FamilyScheduleEntry } from './family-view';
import { FAMILY_HOME_WORDS } from './family-home-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A SIGNED-IN PARENT'S FAMILY PAGES READ (Signed-in family accounts Stage 4a, Part 6; drawing tabs 3–5). ONE reader for
 * "Your family", the team page's own rows (Your sign-up, Connected to …) and Manage, so the three can never disagree.
 *
 *   readFamilyHome(userId)              the children this account is connected to, every team they reach now (siblings on
 *                                       one team share it), each team's Up next, the sign-ups, and the "removed by the club"
 *                                       lines
 *   readConnectedAdults(userId, child)  Manage: who is connected to one child (only for an account connected to it)
 *   familySignupFor(userId, regId)      the in-app "Your sign-up": the signed link rebuilt for a sign-up this account's
 *                                       connected child is on AND its address is on (never by the link: ruling, drawing 4.2)
 *
 * ⚠ WHAT A PARENT NEVER SEES (drawing tab 3): the roster, other children, other families' contacts. Every shape here names the
 *   account's OWN children only; a team card carries the team's name and its next event, nothing about who else is on it
 *   (tests/unit/family-home-payload.test.ts holds the allow-list).
 * ⚠ The reach is `getFamilyReach` — no team id from the client is ever trusted.
 * ⚠ While the guardian tier is off every reader answers empty: the pages 404 before they ask.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface FamilyChild {
  childId: string;
  linkId: string;
  orgId: string;
  firstName: string;
  invitedAs: FamilyLink['invitedAs'];
  teams: ReachedTeam[];
}

export interface FamilyTeamCard {
  kind: TeamKind;
  teamId: string;
  orgId: string;
  teamName: string;
  divisionName: string | null;
  seasonLine: string | null;
  /** The account's own children on this team, by first name. */
  children: string[];
  childIds: string[];
  /** The team's next event, or null (none, or the schedule isn't shared right now). */
  nextUp: FamilyScheduleEntry | null;
  href: string;
}

export type FamilySignupState =
  | { kind: 'paid' }
  | { kind: 'owing'; cents: number }
  | { kind: 'withdrawn' }
  /** Nothing accepted yet and nothing owed: the row shows no chip. */
  | { kind: 'waiting' };

export interface FamilySignupRow {
  orgId: string;
  /** The sign-up's anchor registration: what the in-app page is addressed by. */
  registrationId: string;
  seasonName: string;
  reference: string | null;
  childCount: number;
  childIds: string[];
  state: FamilySignupState;
  href: string;
}

export interface FamilyClub { orgId: string; name: string; contact: string | null }

export interface FamilyHome {
  clubs: FamilyClub[];
  children: FamilyChild[];
  teams: FamilyTeamCard[];
  signups: FamilySignupRow[];
  /** Drawing 5.3: a child the club removed this account from, with no live connection to it now. */
  removed: { childId: string; firstName: string; club: FamilyClub }[];
}

export const familyTeamHref = (teamId: string) => `/family/teams/${teamId}`;
export const familySignupHref = (registrationId: string) => `/family/signup/${registrationId}`;
export const familyChildHref = (childId: string) => `/family/children/${childId}`;

const EMPTY: FamilyHome = { clubs: [], children: [], teams: [], signups: [], removed: [] };

/** A club from the list the read already holds; one that is somehow absent still names itself ("the club"), never throws. */
const clubFrom = (clubs: readonly FamilyClub[], orgId: string): FamilyClub =>
  clubs.find(c => c.orgId === orgId) ?? { orgId, name: 'the club', contact: null };

export async function readFamilyHome(userId: string): Promise<FamilyHome> {
  return (await buildFamilyHome(userId)).home;
}

type TeamSchedules = Map<string, FamilyTeamSchedule | typeof HIDDEN>;

async function buildFamilyHome(userId: string): Promise<{ home: FamilyHome; schedules: TeamSchedules }> {
  if (!GUARDIAN_TIER_ENABLED) return { home: EMPTY, schedules: new Map() };
  const [reach, removedLinks] = await Promise.all([getFamilyReach(userId), readClubRemovedLinks(userId)]);
  const childIds = [...new Set([...reach.map(r => r.link.childId), ...removedLinks.map(r => r.child_id)])];
  const firstNames = await childFirstNames(childIds);

  // A child connected through two links (rare: an upgrade, an old invitation) is one child here.
  const children: FamilyChild[] = [];
  const seenChild = new Set<string>();
  for (const r of reach) {
    if (seenChild.has(r.link.childId)) continue;
    seenChild.add(r.link.childId);
    children.push({
      childId: r.link.childId, linkId: r.link.id, orgId: r.link.orgId,
      firstName: firstNames.get(r.link.childId) ?? '', invitedAs: r.link.invitedAs, teams: r.teams,
    });
  }

  const orgIds = [...new Set([...children.map(c => c.orgId), ...removedLinks.map(r => r.org_id)])];
  const clubs = await clubsOf(orgIds);
  const clubOf = (orgId: string) => clubFrom(clubs, orgId);

  // Teams: one card per team; siblings on one team share it.
  const byTeam = new Map<string, { kind: TeamKind; teamId: string; orgId: string; children: FamilyChild[] }>();
  for (const c of children) {
    for (const t of c.teams) {
      const k = teamKey(t.kind, t.teamId);
      const card = byTeam.get(k);
      if (card) card.children.push(c); else byTeam.set(k, { kind: t.kind, teamId: t.teamId, orgId: c.orgId, children: [c] });
    }
  }
  const schedules = await Promise.all([...byTeam.values()].map(t => familyTeamSchedule(t.kind, t.teamId)));
  const teams: FamilyTeamCard[] = [];
  const kept: TeamSchedules = new Map();
  [...byTeam.values()].forEach((t, i) => {
    const s = schedules[i];
    if (s === null) return;
    kept.set(teamKey(t.kind, t.teamId), s);
    const shown = s === HIDDEN ? null : s;
    teams.push({
      kind: t.kind, teamId: t.teamId, orgId: t.orgId,
      teamName: shown?.teamName ?? '', divisionName: shown?.divisionName ?? null, seasonLine: shown?.seasonLine ?? null,
      children: t.children.map(c => c.firstName), childIds: t.children.map(c => c.childId),
      nextUp: shown?.entries.find(e => e.isNextUp) ?? null,
      href: familyTeamHref(t.teamId),
    });
  });
  // A hidden team still needs its name on the card: read it once from the team row.
  await nameHiddenTeams(teams);

  const signups = await readFamilySignups(reach.map(r => r.link));

  const live = new Set(children.map(c => c.childId));
  const removed: FamilyHome['removed'] = [];
  const seenRemoved = new Set<string>();
  for (const r of removedLinks) {
    if (live.has(r.child_id) || seenRemoved.has(r.child_id)) continue;
    seenRemoved.add(r.child_id);
    removed.push({ childId: r.child_id, firstName: firstNames.get(r.child_id) ?? '', club: clubOf(r.org_id) });
  }

  return { home: { clubs, children, teams, signups, removed }, schedules: kept };
}

/** The team page's question: this account's view of ONE team it reaches, or null (it reaches no such team now). */
export async function readFamilyTeam(userId: string, teamId: string): Promise<{
  home: FamilyHome; team: FamilyTeamCard; schedule: FamilyTeamSchedule | typeof HIDDEN;
} | null> {
  const { home, schedules } = await buildFamilyHome(userId);
  const team = home.teams.find(t => t.teamId === teamId);
  const schedule = team ? schedules.get(teamKey(team.kind, team.teamId)) : undefined;
  return team && schedule ? { home, team, schedule } : null;
}

// ── Manage: who is connected to one child (drawing 5.1) ───────────────────────────────────────

export interface ConnectedAdult {
  /** Joined: the account's name (or the address); invited: the address, until they join (the sign-up holds no name). */
  label: string;
  you: boolean;
  state: 'joined' | 'invited';
  /** Joined on / invited on (an ISO timestamp). */
  at: string;
}

export async function readConnectedAdults(userId: string, childId: string): Promise<{
  child: FamilyChild; club: FamilyClub; adults: ConnectedAdult[]; teamNames: string[];
} | null> {
  const home = await readFamilyHome(userId);
  const child = home.children.find(c => c.childId === childId);
  if (!child) return null;
  const club = clubFrom(home.clubs, child.orgId);
  const teamNames = home.teams.filter(t => t.childIds.includes(childId)).map(t => t.teamName).filter(Boolean);
  return { child, club, adults: await adultsOf(userId, child), teamNames };
}

/** The team page's "Connected to {child}: you, and …" for each of these children (the others: a name once joined, the address
 *  marked invited until then). */
export async function connectedLines(userId: string, children: readonly FamilyChild[]): Promise<{
  childId: string; child: string; others: string[];
}[]> {
  return Promise.all(children.map(async c => ({
    childId: c.childId,
    child: c.firstName,
    others: (await adultsOf(userId, c)).filter(a => !a.you).map(a => (a.state === 'invited' ? `${a.label} ${FAMILY_HOME_WORDS.team.invitedSuffix}` : a.label)),
  })));
}

async function adultsOf(userId: string, child: FamilyChild): Promise<ConnectedAdult[]> {
  const childId = child.childId;
  const { data: links, error } = await supabaseAdmin.from('family_links')
    .select('id, user_id, invited_email, status, approved_at, created_at')
    .eq('org_id', child.orgId).eq('child_id', childId).in('status', ['verified', 'invited', 'requested']);
  if (error) throw error;
  const rows = (links ?? []) as { id: string; user_id: string | null; invited_email: string; status: string; approved_at: string | null; created_at: string }[];
  const adults: ConnectedAdult[] = [];
  const named = new Set<string>();
  for (const r of rows.filter(x => x.status === 'verified')) {
    named.add(r.invited_email);
    const name = r.user_id ? await accountLabel(r.user_id) : null;
    adults.push({ label: name ?? r.invited_email, you: r.user_id === userId, state: 'joined', at: r.approved_at ?? r.created_at });
  }

  // Invited, not joined: an address on the child's sign-up (or a rep coach's) with an invitation that was not cancelled.
  const { data: regs, error: regError } = await supabaseAdmin.from('league_registrations')
    .select('guardian_email, guardian_email_2').eq('org_id', child.orgId).eq('child_id', childId);
  if (regError) throw regError;
  const addresses = new Set<string>();
  for (const r of (regs ?? []) as { guardian_email: string | null; guardian_email_2: string | null }[]) {
    for (const a of [r.guardian_email, r.guardian_email_2]) { const n = normalizeGuardianEmail(a); if (n) addresses.add(n); }
  }
  const INV = 'email, child_id, source, created_at';
  const now = new Date().toISOString(); // an expired invitation is not "invited"
  const [repInvs, placementInvs] = await Promise.all([
    // A rep coach's invitation names the child; a placement invitation names only the address (one acceptance, several children).
    supabaseAdmin.from('family_invitations').select(INV)
      .eq('org_id', child.orgId).eq('child_id', childId).is('cancelled_at', null).is('used_at', null).gt('expires_at', now),
    addresses.size
      ? supabaseAdmin.from('family_invitations').select(INV)
        .eq('org_id', child.orgId).eq('source', 'placement').in('email', [...addresses]).is('cancelled_at', null).is('used_at', null).gt('expires_at', now)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (repInvs.error) throw repInvs.error;
  if (placementInvs.error) throw placementInvs.error;
  const invs = ([...(repInvs.data ?? []), ...(placementInvs.data ?? [])] as { email: string; created_at: string }[])
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const seenInvited = new Set<string>();
  for (const inv of invs) {
    if (named.has(inv.email) || seenInvited.has(inv.email)) continue;
    seenInvited.add(inv.email);
    adults.push({ label: inv.email, you: false, state: 'invited', at: inv.created_at });
  }

  adults.sort((a, b) => Number(b.you) - Number(a.you) || Number(a.state === 'invited') - Number(b.state === 'invited') || a.at.localeCompare(b.at));
  return adults;
}

// ── The in-app "Your sign-up" (drawing 4.2) ───────────────────────────────────────────────────

/** The signed link for a sign-up this account may open in the app, or null. The account must hold a live connection to a child
 *  on the sign-up, through an address that is ON the sign-up (its own sign-up, as first or second parent). */
export async function familySignupFor(userId: string, registrationId: string): Promise<{
  token: string; row: FamilySignupRow; children: string[]; home: FamilyHome;
} | null> {
  const home = await readFamilyHome(userId);
  const row = home.signups.find(s => s.registrationId === registrationId);
  if (!row) return null;
  const { data, error } = await supabaseAdmin.from('league_registrations').select('id, link_version').eq('id', registrationId).maybeSingle();
  if (error) throw error;
  const token = data ? currentSignupToken(registrationId, { linkVersion: Number((data as { link_version: number | null }).link_version ?? 0) }) : null;
  if (!token) return null;
  const children = home.children.filter(c => row.childIds.includes(c.childId)).map(c => c.firstName);
  return { token, row, children, home };
}

/** The sign-up's CURRENT signed link: signed with its anchor's `link_version`, so the club's "Send a new link" is followed,
 *  never signed as an old (replaced) one. */
function currentSignupToken(registrationId: string, f: { linkVersion: number }): string | null {
  return leaguePayToken(registrationId, f.linkVersion);
}

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────

async function readClubRemovedLinks(userId: string): Promise<{ child_id: string; org_id: string }[]> {
  const { data, error } = await supabaseAdmin.from('family_links')
    .select('child_id, org_id').eq('user_id', userId).eq('status', 'revoked').eq('ended_by', 'club')
    .order('revoked_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as { child_id: string; org_id: string }[];
}

async function childFirstNames(childIds: readonly string[]): Promise<Map<string, string>> {
  if (childIds.length === 0) return new Map();
  // First name only, and nothing else of the child's record (medical notes and emergency contacts live on the same row).
  const rows = await fetchAllIn<{ id: string; first_name: string }>(
    [...childIds],
    (chunk, from, to) => supabaseAdmin.from('org_children').select('id, first_name').in('id', chunk).order('id').range(from, to),
  );
  return new Map(rows.map(r => [r.id, r.first_name]));
}

async function clubsOf(orgIds: readonly string[]): Promise<FamilyClub[]> {
  return Promise.all(orgIds.map(async orgId => {
    // A cancelled club still names itself in the removed line; its pages stop through the schedule's own gate.
    const [org, contact] = await Promise.all([getOrgForGate(orgId), clubPublicContact(orgId)]);
    return { orgId, name: org?.name ?? (await clubNameOf(orgId)), contact };
  }));
}

async function nameHiddenTeams(teams: FamilyTeamCard[]): Promise<void> {
  const rep = teams.filter(t => !t.teamName && t.kind === 'rep').map(t => t.teamId);
  const league = teams.filter(t => !t.teamName && t.kind === 'league').map(t => t.teamId);
  const [r, l] = await Promise.all([
    rep.length ? supabaseAdmin.from('rep_teams').select('id, name').in('id', rep) : Promise.resolve({ data: [], error: null }),
    league.length ? supabaseAdmin.from('league_teams').select('id, name').in('id', league) : Promise.resolve({ data: [], error: null }),
  ]);
  if (r.error) throw r.error;
  if (l.error) throw l.error;
  const names = new Map([...(r.data ?? []), ...(l.data ?? [])].map(x => [(x as { id: string }).id, (x as { name: string }).name]));
  for (const t of teams) if (!t.teamName) t.teamName = names.get(t.teamId) ?? '';
}

async function accountLabel(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return accountNameOf(data.user.user_metadata) ?? data.user.email ?? null;
}

type SignupRegRow = {
  id: string; org_id: string; season_id: string; child_id: string; signup_ref: string | null; status: string;
  guardian_email: string | null; guardian_email_2: string | null; link_version: number | null;
  league_seasons: { name: string } | { name: string }[] | null;
};
const one = <X>(v: X | X[] | null): X | null => (Array.isArray(v) ? v[0] ?? null : v);

/**
 * The sign-ups the family pages show (drawing 3.2–3.4): a sign-up of a connected child that carries the link's own address, while
 * its page is still open (the emailed link's rule: `openSignupLink` — open while the season runs, while money is owed, and for
 * 30 days after the season is finished). One row per sign-up, however many of the account's children are on it.
 */
async function readFamilySignups(links: readonly FamilyLink[]): Promise<FamilySignupRow[]> {
  if (links.length === 0) return [];
  const regs = await fetchAllIn<SignupRegRow>(
    [...new Set(links.map(l => l.childId))],
    (chunk, from, to) => supabaseAdmin.from('league_registrations')
      .select('id, org_id, season_id, child_id, signup_ref, status, guardian_email, guardian_email_2, link_version, league_seasons(name)')
      .in('child_id', chunk).order('id').range(from, to),
  );
  const mine = regs.filter(r => links.some(l => l.childId === r.child_id && l.orgId === r.org_id && (
    normalizeGuardianEmail(r.guardian_email) === l.invitedEmail || normalizeGuardianEmail(r.guardian_email_2) === l.invitedEmail)));
  // One sign-up = the season, its reference and its first address (`signupRowsFromAnchor`'s rule); no reference = one row.
  const groups = new Map<string, SignupRegRow[]>();
  for (const r of mine) {
    const k = r.signup_ref ? `${r.season_id}|${r.signup_ref}|${normalizeGuardianEmail(r.guardian_email) ?? ''}` : r.id;
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  const out: FamilySignupRow[] = [];
  for (const group of groups.values()) {
    const anchor = [...group].sort((a, b) => a.id.localeCompare(b.id))[0];
    const token = currentSignupToken(anchor.id, { linkVersion: Number(anchor.link_version ?? 0) });
    if (!token) continue;
    const link = await openSignupLink(token);
    if (!link.ok) continue;
    const statuses = link.rows.map(r => r.status);
    let state: FamilySignupState;
    if (statuses.every(s => s === 'withdrawn' || s === 'declined')) state = { kind: 'withdrawn' };
    else {
      const facts = await loadLeaguePayFacts(link.registrationId);
      // "Paid" only once a child is accepted: a sign-up still waiting for review owes nothing yet, and says nothing.
      state = facts && facts.owingCents > 0 ? { kind: 'owing', cents: facts.owingCents }
        : statuses.includes('active') ? { kind: 'paid' } : { kind: 'waiting' };
    }
    out.push({
      orgId: anchor.org_id,
      registrationId: anchor.id,
      seasonName: one(anchor.league_seasons)?.name ?? '',
      reference: anchor.signup_ref,
      childCount: link.rows.length,
      childIds: [...new Set(group.map(r => r.child_id))],
      state,
      href: familySignupHref(anchor.id),
    });
  }
  return out.sort((a, b) => a.seasonName.localeCompare(b.seasonName));
}

/**
 * The emailed "Your sign-up" page's question for its way back (Part 6.6, drawing 4.1): the first names of the children on this
 * sign-up who are on a team now (accepted, on a team, the division's teams published, the season not closed). Empty while the
 * guardian tier is off, so the page draws nothing new.
 */
export async function placedOnSignup(
  rows: readonly { status: string; team_id?: string | null; division_id: string | null; player_first_name: string }[],
  seasonStatus: string,
): Promise<string[]> {
  if (!GUARDIAN_TIER_ENABLED || !isLiveLeagueSeasonStatus(seasonStatus)) return [];
  const onTeam = rows.filter(r => r.status === 'active' && r.team_id && r.division_id);
  if (onTeam.length === 0) return [];
  const { data, error } = await supabaseAdmin.from('league_divisions')
    .select('id').in('id', [...new Set(onTeam.map(r => r.division_id as string))]).not('teams_published_at', 'is', null);
  if (error) throw error;
  const published = new Set(((data ?? []) as { id: string }[]).map(d => d.id));
  return onTeam.filter(r => published.has(r.division_id as string)).map(r => r.player_first_name);
}
