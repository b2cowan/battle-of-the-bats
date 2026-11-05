import 'server-only';
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S CHILD PAGE — one read of everything a child is across seasons (Club Tier Stage 14 S5, drawings tab 5;
 * owner 2026-11-05 "agree as recommended" on the S5 Part 0 calls).
 *
 * The caller has passed the Families gate (`requireFamiliesAccess`: the member holds Families, the plan carries it, the
 * member is not limited to a group of teams) — a child spans teams and the house league, exactly as a household does.
 * Every query re-scopes to the org, so another club's child id reads as "not found".
 *
 *   Seasons   — every rep entry (call-ups are their own child, never here) and every house-league sign-up (declined ones
 *               left out), each season's fees READ from that season's book: a rep season through `readRepMoney` (the
 *               team's own derivation, as the Families book reads it), a sign-up through what its season's book received.
 *   Documents — per TEAM the child has a live entry on, the coach's rule (`documentStateRows` over that team's templates
 *               and the child's papers on that team), never pooled across teams (S5 call D: the board, the Families book
 *               and the coach's Family tab count per team). A child with no live team shows the newest team's history.
 *               House league keeps no papers; a sign-up that accepted the waiver adds "{season} waiver" to the history.
 *   Health    — the child's ONE current value (mig 441) and the once-a-season check, asked as the coach's page asks it
 *               (`readHealthCheck` per live entry). The club's Confirm stamps every live entry (`confirmChildHealth`).
 *   Parents   — the people the child's entries name, and a co-guardian whose NEWEST link to the child is verified (the
 *               household's rule — a revoked link is the coach's latest word). With nobody on file, the newest entry's
 *               typed guardian, with no door.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { supabaseAdmin } from './supabase-admin';
import { readRepMoney, leagueFeeLine, personDisplayName, LEAGUE_FEE_FACTS, type LeagueFeeFacts } from './families-read';
import { loadRegistrationsReceivedCents } from './league-money-read';
import { readChildTeamDocuments, readHealthCheck } from './child-documents';
import { documentStateRows, healthAskLine, healthAskTitle } from './document-state';
import { templatesForTeam } from './forms-coverage';
import { isLiveSeasonStatus } from './season-live';
import { isFinishedLeagueSeason } from './house-league-access';
import {
  currentChip, documentRows, historyOnlyRows, leagueFeesLine, leagueSeasonStatus, repFeesLine, repSeasonStatus,
  sortSeasonRows, type ChildDocumentRow, type ChildSeasonRow,
} from './child-page-words';

export interface ChildPageDocuments {
  teamId: string;
  teamName: string;
  /** The working season these states are for, or null (history only — the child has no live season on this team). */
  seasonName: string | null;
  seasonYear: number | null;
  rows: ChildDocumentRow[];
  toSign: number;
}

export interface ChildPageParent {
  /** Null for a typed guardian who is not in the Families book (no door). */
  personId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ChildPagePayload {
  child: { id: string; firstName: string; lastName: string | null; name: string; dateOfBirth: string | null };
  /** "Lynx 12U AAA · 2027" — where the child plays now, or null. */
  currentChip: string | null;
  seasons: ChildSeasonRow[];
  documents: ChildPageDocuments[];
  /** House-league waivers when the child has no rep team at all (the Documents section's only rows). */
  leagueOnlyWaivers: string[];
  health: {
    medicalNotes: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
    /** The question, or null when nothing asks this season. */
    ask: { title: string; line: string; seasonName: string } | null;
  };
  parents: ChildPageParent[];
}

const fullName = (first: string | null | undefined, last: string | null | undefined) => `${first ?? ''} ${last ?? ''}`.trim();
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

// The two row shapes the selects below return (a joined relation comes back as an object or a one-element array).
type Rel<T> = T | T[] | null;
interface RepRow {
  id: string; child_id: string; person_id: string | null; team_id: string; program_year_id: string; status: string;
  player_number: string | number | null; medical_notes: string | null; emergency_contact_name: string | null;
  emergency_contact_phone: string | null; health_confirmed_at: string | null;
  guardian_first_name: string | null; guardian_last_name: string | null; guardian_email: string | null; guardian_phone: string | null;
  created_at: string | null;
  rep_teams: Rel<{ name: string }>;
  rep_program_years: Rel<{ id: string; name: string; year: number; status: string; credit_application: string | null }>;
}
interface LeagueRow {
  id: string; child_id: string; person_id: string | null; status: string; season_id: string; division_id: string | null;
  team_id: string | null; fee_amount: number | null; registration_fee_paid?: boolean | null; /* read only — never written here */ registered_at: string | null;
  waiver_accepted_at: string | null;
  guardian_first_name: string | null; guardian_last_name: string | null; guardian_email: string | null; guardian_phone: string | null;
  league_seasons: Rel<{ name: string; status: string; registration_fee: number | null; season_start_date: string | null }>;
  league_divisions: Rel<{ name: string }>;
}
const yearOf = (r: Pick<RepRow, 'rep_program_years'>) => one(r.rep_program_years);
const teamNameOf = (r: RepRow) => one(r.rep_teams)?.name ?? 'Rep team';
const byYearDesc = (a: RepRow, b: RepRow) => Number(yearOf(b)?.year ?? 0) - Number(yearOf(a)?.year ?? 0);

const REP_SELECT = 'id, child_id, person_id, team_id, program_year_id, status, player_number, player_first_name, player_last_name, '
  + 'medical_notes, emergency_contact_name, emergency_contact_phone, health_confirmed_at, '
  + 'guardian_first_name, guardian_last_name, guardian_email, guardian_phone, created_at, '
  + 'rep_teams(name), rep_program_years(id, name, year, status, credit_application)';
const LEAGUE_SELECT = 'id, child_id, person_id, status, season_id, division_id, team_id, fee_amount, registration_fee_paid, '
  + 'registered_at, waiver_accepted_at, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, '
  + 'league_seasons(name, status, registration_fee, season_start_date), league_divisions(name)';

/** The child's rows: the record, every non-call-up rep entry, every house-league sign-up that was not declined. */
async function readChildRows(orgId: string, childId: string) {
  const [childRes, repRes, leagueRes] = await Promise.all([
    supabaseAdmin.from('org_children').select('id, first_name, last_name, date_of_birth, medical_notes, emergency_contact_name, emergency_contact_phone')
      .eq('org_id', orgId).eq('id', childId).maybeSingle(),
    supabaseAdmin.from('rep_roster_players').select(REP_SELECT)
      .eq('org_id', orgId).eq('child_id', childId).neq('status', 'callup').order('created_at', { ascending: false }),
    supabaseAdmin.from('league_registrations').select(LEAGUE_SELECT)
      .eq('org_id', orgId).eq('child_id', childId).neq('status', 'declined').order('registered_at', { ascending: false }),
  ]);
  if (childRes.error) throw childRes.error;
  if (repRes.error) throw repRes.error;
  if (leagueRes.error) throw leagueRes.error;
  return {
    child: childRes.data as { id: string; first_name: string; last_name: string | null; date_of_birth: string | null; medical_notes: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null } | null,
    rep: (repRes.data ?? []) as unknown as RepRow[],
    league: (leagueRes.data ?? []) as unknown as LeagueRow[],
  };
}

/** The rep entries on a LIVE season (draft or active) — the working season per team. */
const liveRepEntries = <T extends Pick<RepRow, 'rep_program_years'>>(rep: readonly T[]) => rep.filter(r => isLiveSeasonStatus(yearOf(r)?.status));

export async function buildChildPage(orgId: string, childId: string): Promise<ChildPagePayload | null> {
  const { child, rep, league } = await readChildRows(orgId, childId);
  if (!child) return null; // another org's child, or none — indistinguishable on purpose

  // House-league team names by id (the sign-up carries two team columns, so the read names them itself). league_teams has
  // no org column; the ids come from this org's own sign-ups, which is what scopes the read.
  const leagueTeamIds = [...new Set(league.map(r => r.team_id).filter(Boolean))] as string[];
  // Everything below depends only on the rows above, so the reads that need no one else's answer run together.
  const [money, received, leagueTeams, parents, templatesRes] = await Promise.all([
    readRepMoney(orgId, rep.map(r => ({ ...r, rep_program_years: yearOf(r) }))),
    loadRegistrationsReceivedCents(league.map(r => r.id)),
    leagueTeamIds.length
      ? supabaseAdmin.from('league_teams').select('id, name').in('id', leagueTeamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    readParents(orgId, rep, league),
    rep.length
      ? supabaseAdmin.from('rep_document_templates').select('id, team_id, name, document_type, validity').eq('org_id', orgId).eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (leagueTeams.error) throw leagueTeams.error;
  if (templatesRes.error) throw templatesRes.error;
  const templateRows = (templatesRes.data ?? []) as { id: string; team_id: string | null; name: string; document_type: string; validity: string | null }[];
  const leagueTeamName = new Map(((leagueTeams.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]));

  // ── Seasons ──
  const seasons: ChildSeasonRow[] = [];
  for (const r of rep) {
    const y = yearOf(r);
    const live = isLiveSeasonStatus(y?.status);
    const f = money.figures.get(r.id);
    const status = repSeasonStatus(r.status, live);
    seasons.push({
      key: `rep:${r.id}`, kind: 'rep', seasonName: String(y?.name ?? ''), year: Number(y?.year ?? 0),
      where: teamNameOf(r), number: r.player_number ? String(r.player_number) : null,
      status, live,
      fees: repFeesLine(f ? {
        duesCents: Math.round(f.ladder.dues * 100), paidCents: Math.round(f.ladder.paid * 100), balanceCents: Math.round(f.balance * 100),
      } : null),
    });
  }
  for (const r of league) {
    const s = one(r.league_seasons);
    const finished = isFinishedLeagueSeason(s);
    const status = leagueSeasonStatus(r.status, finished);
    const facts: LeagueFeeFacts = { receivedCents: received.get(r.id) ?? 0, priceChanged: false, corrected: null };
    const fee = leagueFeeLine({ ...r, league_seasons: s, [LEAGUE_FEE_FACTS]: facts });
    const division = one(r.league_divisions)?.name ?? null;
    const team = r.team_id ? leagueTeamName.get(r.team_id) ?? null : null;
    const start = s?.season_start_date ? Number(String(s.season_start_date).slice(0, 4)) : Number(String(r.registered_at ?? '').slice(0, 4));
    seasons.push({
      key: `league:${r.id}`, kind: 'league', seasonName: String(s?.name ?? 'House league'), year: start || 0,
      where: [division, team].filter(Boolean).join(' · ') || 'House league', number: null,
      status, live: !finished, fees: leagueFeesLine(fee, status),
    });
  }
  const sortedSeasons = sortSeasonRows(seasons);

  // ── Documents, per team ──
  const leagueWaivers = league.filter(r => r.waiver_accepted_at).map(r => String(one(r.league_seasons)?.name ?? 'House league'));
  const liveEntries = liveRepEntries(rep);
  const documents: ChildPageDocuments[] = [];
  const asEntry = (r: RepRow) => ({ id: r.id, childId: r.child_id, teamId: r.team_id, orgId, status: r.status });
  // One live entry per team (the one-child-per-season lock allows one per season; a team has one live season).
  const liveByTeam = new Map<string, RepRow>();
  for (const r of liveEntries) if (!liveByTeam.has(r.team_id)) liveByTeam.set(r.team_id, r);
  let waiversPlaced = false;
  for (const r of liveByTeam.values()) {
    const y = yearOf(r)!;
    const docs = await readChildTeamDocuments(asEntry(r));
    const state = documentStateRows({ templates: templatesForTeam(templateRows, r.team_id), documents: docs, season: { id: y.id, name: y.name } });
    const rows = documentRows({ state, documents: docs, workingSeasonId: y.id, leagueWaivers: waiversPlaced ? [] : leagueWaivers });
    if (rows.some(x => x.documentType === 'waiver')) waiversPlaced = true;
    documents.push({
      teamId: r.team_id, teamName: teamNameOf(r), seasonName: y.name, seasonYear: Number(y.year),
      rows, toSign: rows.filter(x => x.state === 'needs_signing').length,
    });
  }
  if (documents.length === 0 && rep.length > 0) {
    // No live season on any team: the newest team's papers, as history.
    const newest = rep.slice().sort(byYearDesc)[0];
    const docs = await readChildTeamDocuments(asEntry(newest));
    const rows = historyOnlyRows(docs, leagueWaivers);
    if (rows.length) { waiversPlaced = true; documents.push({ teamId: newest.team_id, teamName: teamNameOf(newest), seasonName: null, seasonYear: null, rows, toSign: 0 }); }
  }

  // ── Health: the child's one value; asked as the coach's page asks it ──
  let ask: ChildPagePayload['health']['ask'] = null;
  for (const r of liveEntries.slice().sort(byYearDesc)) {
    const y = yearOf(r)!;
    const check = await readHealthCheck({
      id: r.id, childId: r.child_id, teamId: r.team_id, orgId, status: r.status,
      medicalNotes: r.medical_notes ?? null, emergencyContactName: r.emergency_contact_name ?? null,
      emergencyContactPhone: r.emergency_contact_phone ?? null, healthConfirmedAt: r.health_confirmed_at ?? null,
    }, { year: Number(y.year), name: String(y.name) });
    if (check.ask) {
      ask = { title: healthAskTitle(check.seasonName), line: healthAskLine(check.lastCheckedSeasonName), seasonName: check.seasonName };
      break;
    }
  }

  return {
    child: {
      id: child.id, firstName: child.first_name, lastName: child.last_name ?? null,
      name: fullName(child.first_name, child.last_name), dateOfBirth: child.date_of_birth ?? null,
    },
    currentChip: currentChip(sortedSeasons),
    seasons: sortedSeasons,
    documents,
    leagueOnlyWaivers: waiversPlaced ? [] : leagueWaivers,
    health: {
      medicalNotes: child.medical_notes ?? null,
      emergencyName: child.emergency_contact_name ?? null,
      emergencyPhone: child.emergency_contact_phone ?? null,
      ask,
    },
    parents,
  };
}

async function readParents(orgId: string, rep: readonly RepRow[], league: readonly LeagueRow[]): Promise<ChildPageParent[]> {
  const ids = new Set<string>([...rep, ...league].map(r => r.person_id).filter((id): id is string => !!id));
  // A co-guardian: their NEWEST link to one of the child's rep entries is verified (householdOf's rule).
  if (rep.length) {
    const { data: links, error } = await supabaseAdmin.from('family_links').select('person_id, status, updated_at')
      .eq('org_id', orgId).in('player_id', rep.map(r => r.id));
    if (error) throw error;
    const newestLink = new Map<string, { status: string; updated_at: string | null }>();
    for (const l of (links ?? []) as { person_id: string | null; status: string; updated_at: string | null }[]) {
      if (!l.person_id) continue;
      const cur = newestLink.get(l.person_id);
      if (!cur || String(l.updated_at ?? '') > String(cur.updated_at ?? '')) newestLink.set(l.person_id, l);
    }
    for (const [pid, l] of newestLink) if (l.status === 'verified') ids.add(pid);
  }
  if (ids.size > 0) {
    const { data, error } = await supabaseAdmin.from('org_people').select('id, first_name, last_name, email_normalized, phone')
      .eq('org_id', orgId).in('id', [...ids]);
    if (error) throw error;
    return (data ?? [])
      .map(p => ({ personId: p.id as string, name: personDisplayName(p), email: p.email_normalized ?? null, phone: p.phone ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  // Nobody in the Families book: the newest entry's typed guardian, with no door.
  const stamp = (r: RepRow | LeagueRow) => String(('created_at' in r ? r.created_at : r.registered_at) ?? '');
  const newest = [...rep, ...league].sort((a, b) => stamp(b).localeCompare(stamp(a)))
    .find(r => fullName(r.guardian_first_name, r.guardian_last_name) || r.guardian_email);
  if (!newest) return [];
  return [{
    personId: null, name: fullName(newest.guardian_first_name, newest.guardian_last_name) || newest.guardian_email || '',
    email: newest.guardian_email ?? null, phone: newest.guardian_phone ?? null,
  }];
}

/**
 * The club's Confirm (S5 call C): the medical note and emergency contact are the CHILD's one value, so a club Confirm
 * marks it checked on every live entry of the child that has not been — every coach's "Still right?" goes with it.
 * Returns how many entries it stamped (0 = nothing asked).
 */
export async function confirmChildHealth(orgId: string, childId: string, userId: string): Promise<number> {
  // Only the record and the rep entries are needed — not the house-league sign-ups the page also reads.
  const [childRes, repRes] = await Promise.all([
    supabaseAdmin.from('org_children').select('id').eq('org_id', orgId).eq('id', childId).maybeSingle(),
    supabaseAdmin.from('rep_roster_players').select('id, health_confirmed_at, rep_program_years(status)')
      .eq('org_id', orgId).eq('child_id', childId).neq('status', 'callup'),
  ]);
  if (childRes.error) throw childRes.error;
  if (repRes.error) throw repRes.error;
  if (!childRes.data) return -1;
  const rep = (repRes.data ?? []) as unknown as Pick<RepRow, 'id' | 'health_confirmed_at' | 'rep_program_years'>[];
  const ids = liveRepEntries(rep).filter(r => !r.health_confirmed_at).map(r => r.id);
  if (ids.length === 0) return 0;
  const { data, error } = await supabaseAdmin.from('rep_roster_players')
    .update({ health_confirmed_at: new Date().toISOString(), health_confirmed_by: userId })
    .eq('org_id', orgId).eq('child_id', childId).in('id', ids).is('health_confirmed_at', null)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}
