import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { teamChanges, familyKey, type ChangeChild } from './house-league-team-changes';
import { readTeamFacts, sendPlacementEmails, type MailOrg, type MailSeason, type SendOutcome } from './house-league-placement-mail';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TEAM-CHANGE EMAILS AFTER PUBLISHING, THE SERVER'S SIDE (HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PLAN.md, TC·1 to TC·8).
 *
 * `readTeamChanges` is the Review window's read: the families not yet told, derived from the children (the rule is
 * lib/house-league-team-changes.ts), with the fingerprint of what it shows. `tellTeamChanges` is Send / Don't email:
 * the SQL function recomputes the same list under lock and refuses a stale one (`changed`), writes the notice, one email
 * row per family sent and the told stamps in one transaction; only then do the emails go through the existing claim and
 * outcome machinery (`sendPlacementEmails`), so a failure shows in the existing "Send the {n} again" banner.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface TeamChangesRead {
  fingerprint: string;
  families: {
    email: string; lastName: string;
    children: { id: string; name: string; kind: 'placed' | 'moved'; fromTeam: string | null; toTeam: string; coaches: string[] }[];
  }[];
  quiet: { email: string; lastName: string; children: { id: string; name: string; team: string }[] }[];
  noEmail: { id: string; name: string; kind: 'placed' | 'moved'; toTeam: string }[];
}

interface ChildRow {
  id: string; player_first_name: string; player_last_name: string; guardian_email: string | null;
  team_id: string | null; told_team_id: string | null; told_at: string | null; team_changed_at: string | null;
}

/** The division's accepted children as the rule takes them. */
export async function readChangeChildren(divisionId: string): Promise<ChangeChild[]> {
  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select('id, player_first_name, player_last_name, guardian_email, team_id, told_team_id, told_at, team_changed_at')
    .eq('division_id', divisionId).eq('status', 'active').limit(5000);
  if (error) throw new Error(`Couldn't read the players for the team changes: ${error.message}`);
  return ((data ?? []) as ChildRow[]).map(r => ({
    id: r.id, firstName: r.player_first_name, lastName: r.player_last_name, guardianEmail: r.guardian_email,
    teamId: r.team_id, toldTeamId: r.told_team_id, toldAt: r.told_at, teamChangedAt: r.team_changed_at,
  }));
}

/** The Review window's read. Null when the division is not published (there is nothing to tell before Publish). */
export async function readTeamChanges(seasonId: string, divisionId: string): Promise<TeamChangesRead | null> {
  // The fingerprint is read BEFORE the rows: a move landing between them makes the window look stale (refused on its press),
  // never fresh over old rows (the board read's rule, /review 2026-10-25).
  const fp = await supabaseAdmin.rpc('league_division_untold_fingerprint', { p_division: divisionId });
  const [div, children] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id, teams_published_at').eq('id', divisionId).eq('season_id', seasonId).maybeSingle(),
    readChangeChildren(divisionId),
  ]);
  if (div.error) throw new Error(`Couldn't read the division: ${div.error.message}`);
  if (fp.error) throw new Error(`Couldn't read the team changes' fingerprint: ${fp.error.message}`);
  if (!div.data || !div.data.teams_published_at) return null;

  const changes = teamChanges(children);
  const teamIds = [
    ...changes.families.flatMap(f => f.children.flatMap(c => [c.toTeamId, c.fromTeamId])),
    ...changes.quiet.flatMap(q => q.children.map(c => c.teamId)),
    ...changes.noEmail.map(c => c.toTeamId),
  ].filter((t): t is string => !!t);
  const facts = await readTeamFacts(teamIds);
  const nameOf = (id: string | null) => (id && facts.names.get(id)) || null;

  return {
    fingerprint: fp.data as string,
    families: changes.families.map(f => ({
      email: f.email, lastName: f.lastName,
      children: f.children.map(c => ({
        id: c.id, name: c.name, kind: c.kind, fromTeam: nameOf(c.fromTeamId),
        toTeam: nameOf(c.toTeamId) ?? '', coaches: facts.coaches.get(c.toTeamId) ?? [],
      })),
    })),
    quiet: changes.quiet.map(q => ({
      email: q.email, lastName: q.lastName, children: q.children.map(c => ({ id: c.id, name: c.name, team: nameOf(c.teamId) ?? '' })),
    })),
    noEmail: changes.noEmail.map(c => ({ id: c.id, name: c.name, kind: c.kind, toTeam: nameOf(c.toTeamId) ?? '' })),
  };
}

export type TellRefusal = 'finished' | 'not_published' | 'changed';

export interface TellResult {
  refusal: TellRefusal | null;
  /** Families emailed (their rows were sent through the claim machinery) and families not emailed. */
  sentFamilies: number;
  skippedFamilies: number;
  noEmailChildren: number;
  /** The mail outcome; `failed` rows stay in the division's "Send the {n} again". */
  outcome: SendOutcome;
}

/**
 * Send the families in `send`, skip the families in `skip` (together they must be exactly the families untold now, or the
 * answer is `changed`). Addresses are the lower-cased family keys the read returned. Never throws once the facts are
 * written: a send that fails after the commit leaves its rows `failed` and is reported in `outcome`.
 */
export async function tellTeamChanges(params: {
  org: MailOrg; season: MailSeason; divisionId: string; actor: string;
  fingerprint: string; send: readonly string[]; skip: readonly string[];
}): Promise<TellResult> {
  const { data, error } = await supabaseAdmin.rpc('league_division_tell_changes', {
    p_org: params.org.id, p_season: params.season.id, p_division: params.divisionId, p_actor: params.actor,
    p_fingerprint: params.fingerprint, p_send: params.send.map(familyKey), p_skip: params.skip.map(familyKey),
  });
  if (error) throw new Error(`The team changes didn't save: ${error.message}`);
  const r = (Array.isArray(data) ? data[0] : data) as {
    refusal: TellRefusal | null; notice: string | null; email_ids: string[] | null;
    sent_families: number; skipped_families: number; no_email_children: number;
  };
  const none: SendOutcome = { sent: 0, failed: 0, skipped: 0 };
  if (r.refusal) {
    return { refusal: r.refusal, sentFamilies: 0, skippedFamilies: 0, noEmailChildren: 0, outcome: none };
  }
  const ids = r.email_ids ?? [];
  let outcome = none;
  try {
    outcome = await sendPlacementEmails(params.org, params.season, ids);
  } catch (err) {
    // The rows are written (pending); they wait for "Send the {n} again".
    console.error('[team-changes] the emails did not start (they wait for Send again):', err instanceof Error ? err.message : String(err));
    outcome = { sent: 0, failed: ids.length, skipped: 0 };
  }
  return {
    refusal: null, sentFamilies: r.sent_families, skippedFamilies: r.skipped_families,
    noEmailChildren: r.no_email_children, outcome,
  };
}
