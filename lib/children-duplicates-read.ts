import 'server-only';
/**
 * THE CHILDREN QUEUE'S SERVER SIDE (Club Tier Stage 14 S6, Ask 11) — the reads that feed the rule in
 * lib/children-duplicates.ts, the join, and "Not the same child". Split lives beside it (`splitChild`).
 *
 * The caller has passed the Families gate (`requireFamiliesAccess`). Every read re-scopes to the org, so another club's child
 * id is simply not found. A join and a split are ONE database call each (mig 445 — `org_children_join`, `org_children_split`):
 * nothing here deletes a season's entry, and no money moves.
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { normalizeGuardianEmail } from './guardian-email';
import { formatStoredDate } from './timezone';
import { pluralize } from './utils';
import { pairKey } from './families-duplicates';
import { proposeChildDuplicates, type ChildProposal, type ChildRecordIn } from './children-duplicates';
import { CHILD_JOIN_WORDS as W, CHILD_SPLIT_WORDS as SW } from './child-join-words';
import { storeNotSameChild } from './past-players';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { personDisplayName } from './families-read';

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const fullName = (first: string | null | undefined, last: string | null | undefined) => `${first ?? ''} ${last ?? ''}`.trim();

type Rel<T> = T | T[] | null;
interface RepRow {
  id: string; child_id: string; team_id: string; program_year_id: string; status: string; created_at: string | null;
  guardian_first_name: string | null; guardian_last_name: string | null; guardian_email: string | null;
  rep_teams: Rel<{ name: string }>;
  rep_program_years: Rel<{ name: string; year: number }>;
}
interface LeagueRow {
  id: string; child_id: string; status: string; registered_at: string | null; waiver_accepted_at: string | null; team_id: string | null;
  guardian_first_name: string | null; guardian_last_name: string | null; guardian_email: string | null; guardian_email_2: string | null;
  league_seasons: Rel<{ name: string; season_start_date: string | null }>;
  league_divisions: Rel<{ name: string }>;
}

/** Every pair of this org's children someone called "not the same child", as "a|b" keys. */
async function readRejectedPairs(childIds: readonly string[]): Promise<Set<string>> {
  const rows = await fetchAllIn<{ child_a_id: string; child_b_id: string }>(childIds, (chunk, from, to) =>
    supabaseAdmin.from('child_match_rejections').select('child_a_id, child_b_id').in('child_a_id', chunk).order('id').range(from, to));
  return new Set(rows.map(r => pairKey(r.child_a_id, r.child_b_id)));
}

/**
 * The proposals standing NOW — the one read the tab, the brief's count and both routes' re-check share.
 * `detail: false` is for a caller that needs only WHICH records match (the brief's count, the join/reject re-check): it skips the
 * document count and the house-league team names, which only feed the card's description lines.
 */
export async function buildChildProposals(orgId: string, { detail = true }: { detail?: boolean } = {}): Promise<ChildProposal[]> {
  const [children, rep, league, docs] = await Promise.all([
    fetchAll<{ id: string; first_name: string; last_name: string | null; date_of_birth: string | null; medical_notes: string | null }>((from, to) =>
      supabaseAdmin.from('org_children').select('id, first_name, last_name, date_of_birth, medical_notes').eq('org_id', orgId).order('id').range(from, to)),
    // Call-ups are read too: the one-child-per-season index counts them, so they can block a join (they are never a season).
    fetchAll<RepRow>((from, to) =>
      supabaseAdmin.from('rep_roster_players')
        .select('id, child_id, team_id, program_year_id, status, created_at, guardian_first_name, guardian_last_name, guardian_email, rep_teams(name), rep_program_years(name, year)')
        .eq('org_id', orgId).order('id').range(from, to)),
    fetchAll<LeagueRow>((from, to) =>
      supabaseAdmin.from('league_registrations')
        .select('id, child_id, status, registered_at, waiver_accepted_at, team_id, guardian_first_name, guardian_last_name, guardian_email, guardian_email_2, league_seasons(name, season_start_date), league_divisions(name)')
        .eq('org_id', orgId).neq('status', 'declined').order('id').range(from, to)),
    detail
      ? fetchAll<{ player_id: string }>((from, to) =>
        supabaseAdmin.from('rep_player_documents').select('player_id').eq('org_id', orgId).order('id').range(from, to))
      : Promise.resolve([] as { player_id: string }[]),
  ]);

  const leagueTeamIds = !detail ? [] : [...new Set(league.map(r => r.team_id).filter((x): x is string => !!x))];
  const teamRows = leagueTeamIds.length
    ? await fetchAllIn<{ id: string; name: string }>(leagueTeamIds, (chunk, from, to) =>
      supabaseAdmin.from('league_teams').select('id, name').in('id', chunk).order('id').range(from, to))
    : [];
  const leagueTeamName = new Map(teamRows.map(t => [t.id, t.name]));

  const docsByEntry = new Map<string, number>();
  for (const d of docs) docsByEntry.set(d.player_id, (docsByEntry.get(d.player_id) ?? 0) + 1);

  const repBy = new Map<string, RepRow[]>();
  for (const r of rep) { const l = repBy.get(r.child_id); if (l) l.push(r); else repBy.set(r.child_id, [r]); }
  const leagueBy = new Map<string, LeagueRow[]>();
  for (const r of league) { const l = leagueBy.get(r.child_id); if (l) l.push(r); else leagueBy.set(r.child_id, [r]); }

  const records: ChildRecordIn[] = [];
  for (const c of children) {
    const reps = repBy.get(c.id) ?? [];
    const leagues = leagueBy.get(c.id) ?? [];
    const seen = reps.filter(r => r.status !== 'callup');
    if (seen.length + leagues.length === 0) continue; // nothing the child page would show: not a record to join
    const seasonLines: { year: number; text: string }[] = [];
    for (const r of seen) {
      const y = one(r.rep_program_years);
      seasonLines.push({ year: Number(y?.year ?? 0), text: `${one(r.rep_teams)?.name ?? 'Rep team'}, ${y?.name ?? ''}`.replace(/, $/, '') });
    }
    for (const r of leagues) {
      const s = one(r.league_seasons);
      const start = s?.season_start_date ? Number(String(s.season_start_date).slice(0, 4)) : Number(String(r.registered_at ?? '').slice(0, 4));
      const team = r.team_id ? leagueTeamName.get(r.team_id) ?? null : null;
      const tail = [one(r.league_divisions)?.name, team].filter(Boolean).join(' · ');
      seasonLines.push({ year: start || 0, text: `House league, ${s?.name ?? 'season'}${tail ? ` · ${tail}` : ''}` });
    }
    seasonLines.sort((a, b) => b.year - a.year || a.text.localeCompare(b.text));

    const typed = [...seen, ...leagues].sort((a, b) =>
      String(('created_at' in a ? a.created_at : a.registered_at) ?? '').localeCompare(String(('created_at' in b ? b.created_at : b.registered_at) ?? '')) * -1);
    const withParent = typed.find(r => fullName(r.guardian_first_name, r.guardian_last_name) || r.guardian_email);
    const emails = new Set<string>();
    for (const r of [...seen, ...leagues]) {
      const e1 = normalizeGuardianEmail(r.guardian_email); if (e1) emails.add(e1);
      if ('guardian_email_2' in r) { const e2 = normalizeGuardianEmail(r.guardian_email_2); if (e2) emails.add(e2); }
    }
    const docCount = seen.reduce((n, r) => n + (docsByEntry.get(r.id) ?? 0), 0);
    const waiver = leagues.filter(r => r.waiver_accepted_at).sort((a, b) => String(b.waiver_accepted_at).localeCompare(String(a.waiver_accepted_at)))[0];
    const detailLine = [
      docCount > 0 ? pluralize(docCount, 'document') : null,
      c.medical_notes && c.medical_notes.trim() ? 'medical note on file' : null,
      docCount === 0 && waiver ? `Waiver accepted ${formatStoredDate(String(waiver.waiver_accepted_at))}` : null,
    ].filter(Boolean).join(' · ');

    records.push({
      id: c.id, firstName: c.first_name, lastName: c.last_name, birthDate: c.date_of_birth,
      parentEmails: [...emails],
      parentLine: withParent
        ? [fullName(withParent.guardian_first_name, withParent.guardian_last_name), withParent.guardian_email].filter(Boolean).join(' · ') || null
        : null,
      seasons: seasonLines.map(s => s.text),
      detailLine: detailLine || null,
      // Every roster entry of the child (call-ups too) — the lock counts them all.
      teamSeasons: reps.map(r => ({ key: `${r.team_id}|${r.program_year_id}`, label: `${one(r.rep_teams)?.name ?? 'team'} ${one(r.rep_program_years)?.name ?? ''}`.trim() })),
      seasonCount: seen.length + leagues.length,
    });
  }

  const rejected = await readRejectedPairs(records.map(r => r.id));
  return withConnectedParents(orgId, proposeChildDuplicates({ children: records, rejected }));
}

/**
 * Name each side's CONNECTED parents (Signed-in family accounts Stage 4a, Part 8.3; drawing tab 8): a join gives every parent of
 * both records the one child's teams, so the confirm names them before the club presses. A verified connection only (a name
 * from the Families book, else the address). Nothing while the guardian tier is off: the window reads as before.
 */
async function withConnectedParents(orgId: string, proposals: ChildProposal[]): Promise<ChildProposal[]> {
  if (!GUARDIAN_TIER_ENABLED || proposals.length === 0) return proposals;
  const ids = [...new Set(proposals.flatMap(p => p.sides.map(s => s.childId)))];
  const links = await fetchAllIn<{ id: string; child_id: string; person_id: string | null; invited_email: string }>(
    ids,
    (chunk, from, to) => supabaseAdmin.from('family_links').select('id, child_id, person_id, invited_email')
      .eq('org_id', orgId).eq('status', 'verified').in('child_id', chunk).order('id').range(from, to),
  );
  if (links.length === 0) return proposals;
  const personIds = [...new Set(links.map(l => l.person_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (personIds.length) {
    const { data, error } = await supabaseAdmin.from('org_people').select('id, first_name, last_name, email_normalized')
      .eq('org_id', orgId).in('id', personIds);
    if (error) throw error;
    for (const p of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; email_normalized: string | null }[]) {
      names.set(p.id, personDisplayName(p));
    }
  }
  const byChild = new Map<string, string[]>();
  for (const l of links) {
    const label = (l.person_id ? names.get(l.person_id) : null) || l.invited_email;
    const list = byChild.get(l.child_id) ?? [];
    if (!list.includes(label)) list.push(label);
    byChild.set(l.child_id, list);
  }
  return proposals.map(p => ({ ...p, sides: p.sides.map(s => ({ ...s, connectedParents: (byChild.get(s.childId) ?? []).sort((a, b) => a.localeCompare(b)) })) }));
}

export type ChildActionResult = { ok: true; joined?: number } | { ok: false; status: number; error: string; code?: string; joined?: number };

/** Is it a Postgres error whose message names this rule? */
const pgIs = (e: { code?: string; message?: string; details?: string } | null, code: string, text?: string) =>
  !!e && e.code === code && (!text || `${e.message ?? ''} ${e.details ?? ''}`.includes(text));

/**
 * Join every record in `mergeIds` into `keepId` — one database call each, the kept record keeping its name and birth date.
 * The caller has already matched the asked ids to ONE standing proposal.
 */
export async function joinChildren(keepId: string, mergeIds: readonly string[], blockedBy: string | null): Promise<ChildActionResult> {
  if (blockedBy) return { ok: false, status: 409, error: W.blocked(blockedBy), code: 'same_team_season' };
  let joined = 0;
  for (const absorb of mergeIds) {
    const { error } = await supabaseAdmin.rpc('org_children_join', { p_keep: keepId, p_absorb: absorb, p_keep_identity: true });
    if (error) {
      if (pgIs(error, '23505', 'rep_roster_players_one_child_per_season')) {
        // A race: the entry that blocks appeared after the list was read. The same words as the card.
        return { ok: false, status: 409, error: W.blocked('same team and season'), code: 'same_team_season', joined };
      }
      if (pgIs(error, '23514') && `${error.message}`.startsWith('guardian_cap_reached')) {
        return { ok: false, status: 409, error: W.capReached, code: 'guardian_cap', joined };
      }
      if (error.code === '23514' || error.code === '42501') console.error('[children-join] refused:', error.message);
      return { ok: false, status: 400, error: joined > 0 ? `${joined} of ${mergeIds.length} records joined; the rest couldn’t be. They stay on this list.` : W.failed, joined };
    }
    joined++;
  }
  return { ok: true, joined };
}

/** "Not the same child": every pair among the asked ids is remembered and never proposed again. */
export async function rejectChildren(ids: readonly string[], userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await storeNotSameChild(ids[i], ids.slice(i + 1), 'children_queue', userId);
  }
}

// ── Split records (the child page) ────────────────────────────────────────────────────────────────────────────────────
export type SplitResult = { ok: true; newChildId: string; moved: number } | { ok: false; status: number; error: string; code: string };

const SEASON_KEY = /^(rep|league):([0-9a-f-]{36})$/i;

/**
 * Split the chosen seasons of a child off to a NEW child. `keys` are the child page's season keys (`rep:{entryId}`,
 * `league:{signUpId}`). The chosen seasons must be some — not none and not all — of the seasons the page shows (a call-up or a
 * declined sign-up is never a season, so a crafted key naming one is refused). One database call (mig 445): nothing is
 * deleted, a sign-up a roster entry came from moves with it, parent links stay with the kept child, and the pair is stored
 * as a "no" so the Children queue never proposes it again.
 */
export async function splitChild(orgId: string, childId: string, keys: readonly string[], userId: string): Promise<SplitResult> {
  const rosterIds: string[] = []; const leagueIds: string[] = [];
  for (const k of new Set(keys)) {
    const m = SEASON_KEY.exec(k);
    if (!m) return { ok: false, status: 400, error: SW.changed, code: 'bad_key' };
    (m[1].toLowerCase() === 'rep' ? rosterIds : leagueIds).push(m[2]);
  }
  const [childRes, repRes, leagueRes] = await Promise.all([
    supabaseAdmin.from('org_children').select('id').eq('org_id', orgId).eq('id', childId).maybeSingle(),
    supabaseAdmin.from('rep_roster_players').select('id').eq('org_id', orgId).eq('child_id', childId).neq('status', 'callup'),
    supabaseAdmin.from('league_registrations').select('id').eq('org_id', orgId).eq('child_id', childId).neq('status', 'declined'),
  ]);
  if (childRes.error) throw childRes.error;
  if (repRes.error) throw repRes.error;
  if (leagueRes.error) throw leagueRes.error;
  if (!childRes.data) return { ok: false, status: 404, error: SW.gone, code: 'gone' };
  const visibleRep = new Set((repRes.data ?? []).map(r => r.id as string));
  const visibleLeague = new Set((leagueRes.data ?? []).map(r => r.id as string));
  const total = visibleRep.size + visibleLeague.size;
  const moving = rosterIds.length + leagueIds.length;
  if (moving === 0 || moving >= total) return { ok: false, status: 400, error: SW.chooseSome, code: 'choose_some' };
  if (!rosterIds.every(id => visibleRep.has(id)) || !leagueIds.every(id => visibleLeague.has(id))) {
    return { ok: false, status: 409, error: SW.changed, code: 'changed' };
  }

  const { data, error } = await supabaseAdmin.rpc('org_children_split', {
    p_child: childId, p_rosters: rosterIds, p_leagues: leagueIds, p_actor: userId,
  });
  if (error) {
    if (error.code === 'P0002') return { ok: false, status: 404, error: SW.gone, code: 'gone' };
    if (error.code === '23514') return { ok: false, status: 409, error: SW.changed, code: 'changed' };
    throw error;
  }
  return { ok: true, newChildId: data as string, moved: moving };
}
