import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import type { LeagueSeason } from './types';
import { loadFamilyAudience, loadMessageWindow, type FamilyAudienceWorld } from './families-read';
import {
  audienceChildren, familyAudience, scopeNeedsPick, seasonChoices,
  type FamilyAudience, type FamilyAudienceScope, type SeasonChoices,
} from './families-audience';
import {
  deliverFamilyEmail, emailAllowance, emailWords, lastFamilyEmail, messageOneFamily, reasonFor, resendMissedFamilies,
  type EmailAllowance, type FamilyEmailPreview, type FamilyEmailResult, type FamilyMessageResult,
} from './families-email';
import { leagueCoachesToCopy } from './families-email-coaches';
import { senderName } from './families-coach-ask';
import { clubEmailFacts } from './club-email-context';
import { familyReplyPlan, type ClubEmailFacts } from './email-club-identity';
import { FAMILY_EMAIL_WORDS as W, SEASON_EMAIL_WORDS as SW, familiesNamed } from './families-words';
import type { FamilyMessageState } from './families-read';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE SEASON EMAILS ITS FAMILIES (Club Tier Stage 9d-1 — owner 9d1·1–12, 2026-10-26; build prompt
 * docs/projects/active/HOUSE_LEAGUE_STAGE9D1_BUILD_PROMPT.md). The season's door onto the club's ONE engine
 * (lib/families-email.ts): the same audience rule (households once, the sender out, opted-out families counted and never
 * sent to), the same claim, batches, recipients and choke point. What is the season's own:
 *
 *   · THE GATE is the season's email right (`houseLeagueRefusal(ctx, 'email')`: the runners and the registrar, every
 *     season status) — NEVER the Families grant, which the registrar does not hold (9d1·2).
 *   · THE WHO LIST: everyone, divisions, PUBLISHED divisions' teams, statuses, the ticked families (9d1·1). A team of an
 *     unpublished division is refused up front, not after Send.
 *   · THE ALLOWANCE: this season's own three in any 24 hours (the claim's bucket; 9d1·12). A one-family message never
 *     counts (9d1·5): one family — a row's ⋯, or ticked children who are one household — goes through the household door.
 *   · THE FOOTER names the season (9d1·11); "Copy the team's coaches" on a team audience, never counted (9d1·9).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The season's divisions and teams, as the Who list and the labels need them. */
export interface SeasonShape {
  divisions: { id: string; name: string; published: boolean }[];
  teams: { id: string; name: string; divisionId: string }[];
}

export async function loadSeasonShape(seasonId: string): Promise<SeasonShape> {
  const [divs, teams] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id, name, teams_published_at, sort_order').eq('season_id', seasonId)
      .order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabaseAdmin.from('league_teams').select('id, name, division_id, sort_order').eq('season_id', seasonId)
      .order('sort_order', { ascending: true }).order('name', { ascending: true }),
  ]);
  if (divs.error) throw divs.error;
  if (teams.error) throw teams.error;
  return {
    divisions: (divs.data ?? []).map(d => ({ id: d.id, name: d.name, published: !!d.teams_published_at })),
    teams: (teams.data ?? []).filter(t => t.division_id).map(t => ({ id: t.id, name: t.name, divisionId: t.division_id as string })),
  };
}

const publishedTeams = (shape: SeasonShape) => {
  const published = new Set(shape.divisions.filter(d => d.published).map(d => d.id));
  return shape.teams.filter(t => published.has(t.divisionId));
};

/** The audience in the season's words — the history's To and the coach copy's "the families on …". */
export function seasonAudienceLabel(scope: FamilyAudienceScope, shape: SeasonShape): string {
  const names = (ids: readonly string[], list: readonly { id: string; name: string }[]) =>
    list.filter(x => ids.includes(x.id)).map(x => x.name).join(' · ');
  switch (scope.kind) {
    case 'season_divisions': return names(scope.divisionIds, shape.divisions) || SW.division;
    case 'season_teams': return names(scope.teamIds, shape.teams) || SW.teams;
    case 'season_statuses': return scope.statuses.map(s => SW.statusNames[s]).join(' · ');
    case 'season_families': return SW.audienceTicked(scope.registrationIds.length);
    default: return SW.everyone;
  }
}

/** One family, when a season scope comes down to one household (a row's ⋯, or ticked children of one family). */
export interface OneFamily {
  personId: string;
  familyName: string | null;
  addresses: string[];
  children: { first: string; last: string }[];
  /** The family's own three in any 24 hours (it never touches the season's). */
  state: FamilyMessageState;
}

/** The season window's read, for one choice of Who. */
export interface SeasonEmailPreview {
  season: { id: string; name: string; status: string };
  choices: SeasonChoices;
  /** Divisions whose teams aren't published yet ("…'s teams aren't published yet"), said before anyone picks a team. */
  unpublished: { divisionId: string; name: string }[];
  anyPublished: boolean;
  scope: FamilyAudienceScope | null;
  families: number;
  children: number;
  optedOut: number;
  optedOutNamed: string | null;
  senderSkipped: boolean;
  noFamily: number;
  /** "See who gets it": each family once, with its children and their team; opted-out families tagged. */
  who: { familyName: string | null; children: { first: string; last: string; team: string | null }[]; optedOut: boolean }[];
  /** A team audience's coaches a copy would go to (9d1·9). */
  coaches: number;
  /** One household: the window becomes "Message this family". */
  one: OneFamily | null;
  allowance: EmailAllowance;
  lastSent: FamilyEmailPreview['lastSent'];
  orgName: string;
  reason: string;
  club: ClubEmailFacts | null;
  replyLine: string;
}

/** The person whose household a one-family season scope is: the one holding a picked registration. */
function oneFamilyPerson(world: FamilyAudienceWorld, audience: FamilyAudience, scope: FamilyAudienceScope): string | null {
  if (scope.kind !== 'season_families') return null;
  const all = [...audience.families, ...audience.optedOutFamilies];
  if (all.length !== 1) return null;
  const picked = new Set(scope.registrationIds);
  return world.people.find(p => all[0].personIds.includes(p.personId) && (p.seasonRows ?? []).some(r => picked.has(r.regId)))?.personId
    ?? all[0].personIds[0] ?? null;
}

export async function seasonEmailPreview(ctx: AuthContextWithRole, season: LeagueSeason, scope: FamilyAudienceScope | null): Promise<SeasonEmailPreview> {
  // The window's open runs the attach (the club's own registrations, added by hand since the last visit, join their
  // family before anyone counts) — so the count the sender sees is the count the press finds.
  const [world, shape, allowance, lastSent, club, sender] = await Promise.all([
    loadFamilyAudience(ctx.org.id, ctx.org.slug, { attach: true }), loadSeasonShape(season.id),
    emailAllowance(ctx.org.id, season.id), lastFamilyEmail(ctx.org.id, season.id),
    clubEmailFacts(ctx.org), senderName(ctx).catch(() => null),
  ]);
  const senderEmail = ctx.user.email ?? null;
  const teams = publishedTeams(shape);
  const choices = seasonChoices(world.people, world.suppressed, senderEmail, season.id, shape.divisions, teams);
  const activeDivisions = new Set(world.people.flatMap(p => (p.seasonRows ?? [])
    .filter(r => r.seasonId === season.id && r.status === 'active' && r.divisionId).map(r => r.divisionId as string)));
  const base = {
    season: { id: season.id, name: season.name, status: season.status },
    choices,
    unpublished: shape.divisions.filter(d => !d.published && activeDivisions.has(d.id)).map(d => ({ divisionId: d.id, name: d.name })),
    anyPublished: teams.length > 0,
    allowance, lastSent, orgName: ctx.org.name, reason: reasonFor(season.name), club,
    replyLine: familyReplyPlan({ kind: 'person', clubName: ctx.org.name, senderEmail, senderName: sender }).line,
  };
  if (!scope || scopeNeedsPick(scope)) {
    return { ...base, scope, families: 0, children: 0, optedOut: 0, optedOutNamed: null, senderSkipped: false, noFamily: 0, who: [], coaches: 0, one: null };
  }
  const audience = familyAudience(world.people, scope, world.suppressed, senderEmail);
  const teamName = new Map(shape.teams.map(t => [t.id, t.name]));
  const who = [
    ...audience.families.map(f => ({ f, optedOut: false })), ...audience.optedOutFamilies.map(f => ({ f, optedOut: true })),
  ].map(({ f, optedOut }) => ({
    familyName: f.familyName, optedOut,
    children: f.children.map(c => ({ first: c.first, last: c.last, team: c.teamId ? teamName.get(c.teamId) ?? null : null })),
  })).sort((a, b) => (a.children[0]?.first ?? '').localeCompare(b.children[0]?.first ?? ''));
  const coaches = scope.kind === 'season_teams'
    ? (await leagueCoachesToCopy(ctx.org.id, season.id, scope.teamIds, ctx.user.id, new Set(audience.families.flatMap(f => f.addresses)))).length
    : 0;
  const personId = oneFamilyPerson(world, audience, scope);
  let one: OneFamily | null = null;
  if (personId) {
    const read = await loadMessageWindow(ctx.org.id, personId);
    const f = [...audience.families, ...audience.optedOutFamilies][0];
    if (read) {
      one = {
        personId, familyName: f.familyName, addresses: read.recipients.filter(r => !r.optedOut).map(r => r.email),
        children: f.children.map(c => ({ first: c.first, last: c.last })), state: read.state,
      };
    }
  }
  const orphan = { personId: '', email: '', lists: [], roster: [], league: [], coGuardians: [], seasonRows: world.unattachedLeague };
  return {
    ...base, scope,
    families: audience.families.length, children: audienceChildren(audience), optedOut: audience.optedOut,
    optedOutNamed: familiesNamed(audience.optedOutFamilies.map(f => f.familyName)), senderSkipped: audience.senderSkipped,
    noFamily: familyAudience([orphan], scope, new Set(), null).optedOutFamilies.reduce((n, f) => n + f.children.length, 0),
    who, coaches, one,
  };
}

const no = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): FamilyEmailResult =>
  ({ ok: false, status, body: { error, code, ...extra } });

/** The season's press, for a scope the route has tied to this season. One household goes through the household door. */
export async function sendSeasonEmail(ctx: AuthContextWithRole, season: LeagueSeason, scope: FamilyAudienceScope, body: Record<string, unknown>):
  Promise<FamilyEmailResult | (FamilyMessageResult & { one: true; familyName: string | null })> {
  const pick = scopeNeedsPick(scope);
  if (pick) {
    const say = { teams: SW.pickTeam, divisions: SW.pickDivision, statuses: SW.pickStatus, families: SW.pickFamilies, season: W.pickSeason }[pick];
    return no(400, say, `${pick}_required`);
  }
  const words = emailWords(body);
  if ('error' in words) return no(400, words.error, words.code);
  const shape = await loadSeasonShape(season.id);
  if (scope.kind === 'season_teams') {
    // A team of an unpublished division is not on the list; a press naming one is refused before anything is claimed.
    const published = new Set(publishedTeams(shape).map(t => t.id));
    if (scope.teamIds.some(id => !published.has(id))) return no(409, SW.noneUnpublished, 'unpublished');
  }
  const expected = typeof body.expected === 'number' ? body.expected : -1;

  // A send is an ACTION: it attaches first, and the re-count has to match what the sender saw.
  const world = await loadFamilyAudience(ctx.org.id, ctx.org.slug, { attach: true });
  const audience = familyAudience(world.people, scope, world.suppressed, ctx.user.email ?? null);
  const personId = oneFamilyPerson(world, audience, scope);
  if (personId) {
    // One household (9d1·5): the family's own three, never the season's.
    const familyName = [...audience.families, ...audience.optedOutFamilies][0].familyName;
    const r = await messageOneFamily(ctx, personId, words.subject, words.message, { id: season.id, name: season.name });
    return { ...r, one: true, familyName };
  }
  if (audience.families.length === 0) {
    if (audience.optedOut > 0) return no(409, W.nobodyOptedOut, 'nobody');
    const orphan = { personId: '', email: '', lists: [], roster: [], league: [], coGuardians: [], seasonRows: world.unattachedLeague };
    const noAddress = familyAudience([orphan], scope, new Set(), null).optedOutFamilies.reduce((n, f) => n + f.children.length, 0);
    return no(409, noAddress > 0 ? SW.noAddress(noAddress) : W.nobodyAtAll, 'nobody');
  }
  if (audience.families.length !== expected) {
    return no(409, W.changed(audience.families.length), 'changed', { families: audience.families.length });
  }
  const label = seasonAudienceLabel(scope, shape);
  return deliverFamilyEmail({
    ctx, scope, world, audience, label, seasonName: season.name, ...words,
    copy: scope.kind === 'season_teams' && body.copyCoaches === true
      ? { league: true, coaches: addresses => leagueCoachesToCopy(ctx.org.id, season.id, scope.teamIds, ctx.user.id, addresses) }
      : null,
    words: { capReason: nextAt => SW.capReason(season.name, nextAt), sentNoneDelivered: SW.sentNoneDelivered },
  });
}

/** "Send to the N it missed" from the season's door: only this season's own emails. */
export const resendSeasonEmail = (ctx: AuthContextWithRole, season: LeagueSeason, sendId: string) =>
  resendMissedFamilies(ctx, sendId, { seasonId: season.id });
