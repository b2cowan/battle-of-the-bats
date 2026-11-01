import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import { leaguePracticesChangedHtml } from './email';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { seasonEmailReason } from './families-words';
import { familyEmailWords, type FamilyPart } from './club-schedule-league-words';
import { refreshToldAfterClubSend } from './league-practice-tell-server';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FAMILIES' PRACTICE-CHANGE EMAIL (Club Tier Stage 11b Part 5; ruling 9d2·2; the build prompt's argument 7). When the
 * club's Send the changes moves or cancels a house-league team's practices, that team's families hear — one email per
 * household per send, one part per child — AFTER the step has committed, never inside it.
 *
 *   · A SERVICE notice (`sendFamilyServiceBatch`): it is about the family's own child, so a family who unsubscribed from
 *     club news still gets it (the placement email's ground, 9c·4), and the suppression-dropping family audience is the
 *     wrong filter for it. It is never an announcement: only a practice that changed is in it.
 *   · A household is the SQL's: the season's active registrations on a team, grouped by lower(btrim(guardian_email))
 *     (mig 385, Publish teams). A family with children in two seasons hears once per season — the season sentence names
 *     one season, and the history is the season's.
 *   · ⚖ ONE AUTOMATIC ROW PER SEASON TOUCHED (argument 7, taken as recommended): the season's Email families history lists
 *     the send once, tagged Automatic, never counted toward the season's emails. A row per send would put another season's
 *     families on this season's history.
 * Dev sends no email: the row's counts and the server log say which addresses would have been mailed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface Household {
  /** `{season}|{normalized email}`. */
  key: string;
  seasonId: string;
  email: string;
  guardianFirst: string | null;
  children: { name: string; teamId: string; registrationId: string }[];
}

/**
 * The households of these house-league teams: active registrations with an email, grouped as Publish teams groups them.
 * ⚖ Only a PUBLISHED division's placements count. Until a division's teams are published a child's team is the club's
 * draft, and the family has not been told it — a practice email must not be the first they hear (nor name a team they
 * may yet be moved off). The Tell step's own gate says the same on its side; this makes the club's Send the changes
 * agree, since both read their families here.
 */
export async function readHouseholds(teamIds: readonly string[]): Promise<Household[]> {
  if (!teamIds.length) return [];
  const regs = await fetchAllIn<{ id: string; season_id: string; division_id: string | null; team_id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null; guardian_email: string | null }>(
    teamIds, (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, season_id, division_id, team_id, player_first_name, player_last_name, guardian_first_name, guardian_email')
      .in('team_id', c).eq('status', 'active').order('id').range(a, b));
  const divisionIds = [...new Set(regs.map(r => r.division_id).filter((d): d is string => !!d))];
  const published = new Set((await fetchAllIn<{ id: string; teams_published_at: string | null }>(divisionIds, (c, a, b) => supabaseAdmin
    .from('league_divisions').select('id, teams_published_at').in('id', c).order('id').range(a, b)))
    .filter(d => d.teams_published_at).map(d => d.id));
  const out = new Map<string, Household>();
  for (const r of [...regs].filter(x => x.division_id && published.has(x.division_id)).sort((x, y) => `${x.player_first_name} ${x.player_last_name}`.localeCompare(`${y.player_first_name} ${y.player_last_name}`))) {
    const email = (r.guardian_email ?? '').trim().toLowerCase();
    if (!email) continue;
    const key = `${r.season_id}|${email}`;
    const h = out.get(key) ?? out.set(key, { key, seasonId: r.season_id, email, guardianFirst: r.guardian_first_name, children: [] }).get(key)!;
    h.children.push({ name: `${r.player_first_name} ${r.player_last_name}`.trim(), teamId: r.team_id, registrationId: r.id });
  }
  return [...out.values()];
}

/** A household's parts: one per child on a team whose practices changed (a child on an unchanged team isn't news). */
export function householdParts(h: Household, partOf: (teamId: string, child: string) => FamilyPart | null): FamilyPart[] {
  return h.children.map(c => partOf(c.teamId, c.name.split(' ')[0] || c.name)).filter((p): p is FamilyPart => !!p);
}

export interface FamiliesOutcome { families: number; sent: number; failed: number }

/**
 * Send each household its email and write each season's Automatic row (counts follow what went). Never throws: the step
 * has landed; a failure is logged and counted, and the send log keeps the rest.
 */
export async function sendPracticeChangeNotices(p: {
  org: ClubEmailOrg;
  seasons: ReadonlyMap<string, string>;
  /** The division, when the season's changed teams are all of one (the history's "Practices changed: U9 Rookie"). */
  divisionOf: ReadonlyMap<string, string | null>;
  households: readonly Household[];
  partOf: (teamId: string, child: string) => FamilyPart | null;
  zoneSentence: string;
  actorId: string;
  sendId: string;
}): Promise<FamiliesOutcome> {
  const outcome: FamiliesOutcome = { families: 0, sent: 0, failed: 0 };
  const bySeason = new Map<string, { h: Household; parts: FamilyPart[] }[]>();
  for (const h of p.households) {
    const parts = householdParts(h, p.partOf);
    if (parts.length) (bySeason.get(h.seasonId) ?? bySeason.set(h.seasonId, []).get(h.seasonId)!).push({ h, parts });
  }
  const total = [...bySeason.values()].reduce((n, list) => n + list.length, 0);
  try {
    const face = await systemMailFace(p.org);
    for (const [seasonId, list] of bySeason) {
      const seasonName = p.seasons.get(seasonId) ?? '';
      const { data: notice, error } = await supabaseAdmin.from('league_season_notices').insert({
        org_id: p.org.id, season_id: seasonId, division_id: p.divisionOf.get(seasonId) ?? null, kind: 'practices_changed',
        family_count: list.length, created_by: p.actorId, club_schedule_send_id: p.sendId,
      }).select('id').single();
      if (error) console.error('[club-schedule-league-mail] the history row was not written (the emails still go):', error.message);
      const messages: FamilyServiceMessage[] = list.map(({ h, parts }) => {
        const w = familyEmailWords({ club: p.org.name, guardianFirst: h.guardianFirst, parts, zoneSentence: p.zoneSentence });
        return {
          to: h.email, subject: w.subject,
          html: leaguePracticesChangedHtml({ greeting: w.greeting, parts: w.lists, outro: w.outro, foot: w.foot ?? null, reason: seasonEmailReason(seasonName), face }),
        };
      });
      const results = await sendFamilyServiceBatch({
        kind: 'house_league_practice_change', messages,
        fromName: face?.sendOpts.fromName ?? null, replyTo: face?.sendOpts.replyTo ?? null,
      });
      const sent = results.filter(r => r.status === 'sent').length;
      // 9d-3: a told team whose families this reached now knows the moved times, so a later hand-out never sends them the
      // same change again (the told snapshot follows; an untold team stays untold — its first email lists every date).
      // A team follows only when this email was ABOUT it (a child with a part on it) and EVERY household it was about was
      // reached — one family's email going must not tell the rest (review 2026-10-31). A team left behind reads "changed"
      // on the Tell step, so the unreached families hear it there.
      // (Dev sends nothing — "skipped" — and counts as reached there, so a walk can see the told state follow.)
      const heard = new Map<string, boolean>();
      results.forEach((r, i) => {
        const reached = r.status === 'sent' || (r.status === 'skipped' && process.env.NODE_ENV !== 'production');
        for (const c of list[i].h.children) {
          if (!p.partOf(c.teamId, c.name.split(' ')[0] || c.name)) continue;
          heard.set(c.teamId, (heard.get(c.teamId) ?? true) && reached);
        }
      });
      await refreshToldAfterClubSend(p.org.id, [...heard].filter(([, all]) => all).map(([teamId]) => teamId));
      outcome.families += list.length;
      outcome.sent += sent;
      outcome.failed += list.length - sent;
      if (notice) {
        const { error: upErr } = await supabaseAdmin.from('league_season_notices')
          .update({ reached_count: sent, failed_count: list.length - sent }).eq('id', notice.id);
        if (upErr) console.error('[club-schedule-league-mail] a notice\'s counts were not updated (the emails went):', upErr.message);
      }
    }
  } catch (e) {
    // Every household not yet tried counts as failed, so the send's result never reads clean when families weren't told
    // (/review 2026-10-27).
    console.error('[club-schedule-league-mail] the families\' emails failed part-way (the send landed):', e instanceof Error ? e.message : String(e));
    outcome.failed += total - outcome.families;
    outcome.families = total;
  }
  return outcome;
}
