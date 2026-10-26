import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { resolvePersonNamer } from './db';
import { sendFamilyEmail, sendFamilyEmailBatch, type FamilySendResult } from './family-email';
import { loadFamilyAudience, loadHouseholdReach, type FamilyAudienceWorld } from './families-read';
import {
  audienceChoices, familyAudience, familyCounts, isSeasonDoorScope, parseScope, scopeNeedsPick, scopeSeasonId,
  type AudienceChoices, type AudienceFamily, type AudiencePerson, type FamilyAudience, type FamilyAudienceScope,
} from './families-audience';
import { coachCopyWords, headCoachesToCopy, sendCoachCopies, type CopiedCoach } from './families-email-coaches';
import { senderName } from './families-coach-ask';
import { clubEmailFacts } from './club-email-context';
import { familyReplyPlan, type ClubEmailFacts } from './email-club-identity';
import {
  CLUB_EMAIL_CAP, CLUB_EMAIL_STOPPED_AFTER_MS, FAMILY_EMAIL_WORDS as W, FAMILY_MESSAGE_REASON, FAMILY_MESSAGE_WORDS as MW,
  SEASON_EMAIL_WORDS as SW, familiesNamed, seasonEmailReason,
} from './families-words';
import { writeOrgAudit } from './org-audit';
import { seasonState } from './house-league-season';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EMAIL FAMILIES (Club Tier Stage 7c — Asks 6 and 7, option A each; drawing 4; owner answers 2026-10-22 to the build
 * prompt's Put to the owner 1–6). The club emails every family, some rep teams' families or one house-league season's,
 * through the one club send window (the 2026-10-11 ruling):
 *
 *   · WHO — `familyAudience` (lib/families-audience.ts), ONE function for the preview, the lime's number, the server's
 *     re-count on the press and the send. Each family once; opted-out families counted, never sent to; the sender never
 *     a recipient. The press re-counts and refuses ('changed') when the number differs from the one the sender saw.
 *   · THE CLAIM before a single email — `family_email_claim` (mig 347, by bucket since 385): a per-club lock, a second
 *     press within a minute refused 'just_sent', a fourth in any rolling 24 hours refused 'cap' with when the next can
 *     go. The claim IS the log row (the Emails tab), deleted when the send reached nobody so a failed send never spends
 *     the allowance.
 *   · THE SEND — family mail ONLY through the choke point (`sendFamilyEmailBatch`, lib/family-email.ts: the suppression
 *     check and each family's own unsubscribe footer), the provider's batches of 100, all of it inside the request (owner,
 *     Put to the owner 3: work after the response is not kept alive on this host). Replies go to the sender. The row's
 *     counts move as each batch goes, so a send the server never finished reads "Stopped at x of y" (Put to the owner 4).
 *   · THE HEAD COACHES' COPY — colleague mail, in its own file (lib/families-email-coaches.ts), never this one.
 *
 * ⚖ A HOUSE-LEAGUE SEASON USES THIS SAME ENGINE (Club Tier Stage 9d-1, owner 9d1·1–12, 2026-10-26): `deliverFamilyEmail`
 * is the one send for both doors. The SCOPE decides three things — the allowance (a scope with a season counts toward
 * that season's own three, from either door: the claim's bucket), the footer ("registered in {season}", 9d1·11) and the
 * label. Each family an email goes to is recorded with how it went (`family_email_recipients`: people and last name,
 * never addresses), so a stopped email can "Send to the N it missed" (9d1·10) — the same row and words, never counted.
 * A one-family message (`messageOneFamily`) is the household door both Families and a season use; it never counts toward
 * a season's three (9d1·5).
 *
 * ⚠ Email only: no notice, no push, no chat, no family login. ⚠ A demo club never reaches here: the proxy refuses a demo
 * club's POST.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Whose three an email counts toward, and how many it has spent in the last 24 hours. */
export interface EmailAllowance {
  /** Emails of this bucket in the last 24 hours (at most the cap; a reader needs no more). */
  used: number;
  capped: boolean;
  /** When the next can go, once capped. */
  nextAt: string | null;
}

/** What the window shows for one choice of Who. */
export interface FamilyEmailPreview {
  choices: AudienceChoices;
  scope: FamilyAudienceScope;
  families: number;
  optedOut: number;
  /** One to three opted-out families named ("the Dubois family"), else null. */
  optedOutNamed: string | null;
  senderSkipped: boolean;
  /** Head coaches a copy would go to for this choice (0 for a season, or when none can be reached). */
  coaches: number;
  /** This choice's children with no family on file ("Nobody to send to"). */
  noFamily: number;
  lastSent: { at: string; by: string | null; subject: string; families: number } | null;
  /** The allowance this choice counts toward: the club's, or the picked season's (9d1·6). */
  cap: EmailAllowance;
  /** The season this choice counts toward, named (null for a club-wide choice). */
  season: { id: string; name: string } | null;
  orgName: string;
  reason: string;
  /** The club's face and the reply line the email will carry (S3b): the sample draws its band and foot from these. */
  club: ClubEmailFacts | null;
  replyLine: string;
}

function noFamilyIn(world: FamilyAudienceWorld, scope: FamilyAudienceScope): number {
  if (scope.kind === 'every') return world.noFamily.length;
  // A list names families that exist; the children with no family on file are a different list, with nobody to email.
  if (scope.kind === 'list') return 0;
  if (scope.kind === 'teams') {
    const ids = new Set(scope.teamIds);
    return world.noFamily.filter(c => c.source === 'rep_roster' && ids.has(c.groupId)).length;
  }
  // A season scope: its own registrations with no person, judged by the audience's own rule.
  const orphan: AudiencePerson = { personId: '', email: '', lists: [], roster: [], league: [], coGuardians: [], seasonRows: world.unattachedLeague };
  return familyAudience([orphan], scope, new Set(), null).optedOutFamilies.reduce((n, f) => n + f.children.length, 0);
}

const AUDIENCE_LABEL_MAX = 500;
const clip = (label: string) => (label.length > AUDIENCE_LABEL_MAX ? `${label.slice(0, AUDIENCE_LABEL_MAX - 1)}…` : label);

/** A season's name, from any registration of it the world holds. */
function seasonNameIn(people: readonly AudiencePerson[], seasonId: string): string | null {
  for (const p of people) {
    const s = p.seasonRows?.find(r => r.seasonId === seasonId);
    if (s) return s.seasonName;
  }
  return null;
}

/** The audience in words, as the log's To and the coach copy name it (a club-wide choice, or a whole season). */
function audienceLabel(people: readonly AudiencePerson[], scope: FamilyAudienceScope): string {
  if (scope.kind === 'every') return W.audienceEvery;
  if (scope.kind === 'list') return W.audienceList(scope.list);
  if (scope.kind === 'teams') {
    const names = new Map(people.flatMap(p => p.roster.filter(r => r.current).map(r => [r.teamId, r.teamName] as const)));
    // The log's To holds up to 500 characters (mig 347): a long run of team names ends in an ellipsis rather than a refused send.
    return clip(W.audienceTeams(scope.teamIds.map(id => names.get(id)).filter((n): n is string => !!n).sort((a, b) => a.localeCompare(b)))) || W.teams;
  }
  // A whole season: the season's own words; Families › Emails prefixes the season's name.
  return SW.everyone;
}

const familyAddresses = (a: FamilyAudience) => new Set(a.families.flatMap(f => f.addresses));

/** The bucket's emails in the allowance's window, oldest first (bounded — never the club's whole log). `seasonId` null:
 *  the club's own (no season). */
export async function emailAllowance(orgId: string, seasonId: string | null): Promise<EmailAllowance> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let q = supabaseAdmin.from('family_email_sends').select('sent_at').eq('org_id', orgId).gt('sent_at', dayAgo);
  q = seasonId ? q.eq('season_id', seasonId) : q.is('season_id', null);
  const { data, error } = await q.order('sent_at', { ascending: true }).limit(CLUB_EMAIL_CAP * 4);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length < CLUB_EMAIL_CAP) return { used: rows.length, capped: false, nextAt: null };
  const oldest = rows[rows.length - CLUB_EMAIL_CAP];
  return { used: CLUB_EMAIL_CAP, capped: true, nextAt: new Date(new Date(oldest.sent_at).getTime() + 24 * 3600 * 1000).toISOString() };
}

/** "Last sent …": the newest email that reached a family (one that reached nobody is not it; one still going counts from
 *  its first batch). `seasonId`: that season's own (its door); undefined: any (the club's door). */
export async function lastFamilyEmail(orgId: string, seasonId?: string): Promise<FamilyEmailPreview['lastSent']> {
  let q = supabaseAdmin.from('family_email_sends')
    .select('sent_at, sent_by, subject, reached_count').eq('org_id', orgId).gt('reached_count', 0);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q.order('sent_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const nameOf = await resolvePersonNamer(orgId, [row.sent_by]);
  return { at: row.sent_at, by: nameOf(row.sent_by), subject: row.subject, families: row.reached_count };
}

/** The reason a family is getting it, completing "Sent by {club} because …": a season's email names the season. */
export const reasonFor = (seasonName: string | null) => (seasonName ? seasonEmailReason(seasonName) : FAMILY_MESSAGE_REASON);

export async function familyEmailPreview(ctx: AuthContextWithRole, scope: FamilyAudienceScope): Promise<FamilyEmailPreview> {
  const seasonId = scopeSeasonId(scope);
  const [world, lastSent, cap, club, sender] = await Promise.all([
    loadFamilyAudience(ctx.org.id, ctx.org.slug, { lists: true }), lastFamilyEmail(ctx.org.id), emailAllowance(ctx.org.id, seasonId || null),
    clubEmailFacts(ctx.org), senderName(ctx).catch(() => null),
  ]);
  const senderEmail = ctx.user.email ?? null;
  const choices = audienceChoices(world.people, world.suppressed, senderEmail);
  const audience = familyAudience(world.people, scope, world.suppressed, senderEmail);
  // A house-league season copies no head coach: its audience names no rep team, so this reads nobody.
  const coaches = await headCoachesToCopy(ctx.org.id, audience.coachTeamIds, ctx.user.id, familyAddresses(audience));
  const seasonName = seasonId ? seasonNameIn(world.people, seasonId) : null;
  // The picker names each season's state the way the season's own pages do ("Registration closed", "Finished"): every
  // status is offered now (9d1·6), so the sender can tell a running season from a finished one.
  if (choices.seasons.length > 0) {
    const { data } = await supabaseAdmin.from('league_seasons')
      .select('id, status, season_start_date, season_end_date, registration_open_at, registration_close_at, registration_closed_at')
      .eq('org_id', ctx.org.id).in('id', choices.seasons.map(s => s.seasonId));
    const byId = new Map((data ?? []).map(s => [s.id as string, s]));
    choices.seasons = choices.seasons.map(s => {
      const row = byId.get(s.seasonId);
      return row ? {
        ...s, label: seasonState({
          status: row.status, seasonStartDate: row.season_start_date, seasonEndDate: row.season_end_date,
          registrationOpenAt: row.registration_open_at, registrationCloseAt: row.registration_close_at, registrationClosedAt: row.registration_closed_at,
        }).label,
      } : s;
    });
  }
  return {
    choices, scope,
    families: audience.families.length, optedOut: audience.optedOut,
    optedOutNamed: familiesNamed(audience.optedOutFamilies.map(f => f.familyName)), senderSkipped: audience.senderSkipped,
    coaches: coaches.length, noFamily: noFamilyIn(world, scope),
    lastSent, cap, season: seasonId && seasonName ? { id: seasonId, name: seasonName } : null,
    orgName: ctx.org.name, reason: reasonFor(seasonName),
    club, replyLine: familyReplyPlan({ kind: 'person', clubName: ctx.org.name, senderEmail, senderName: sender }).line,
  };
}

export type FamilyEmailResult =
  | {
    ok: true; families: number; reached: number; failed: number; optedOut: number; coaches: number;
    /** The email's row, for "Open the email". */
    sendId: string | null;
    /** The families it couldn't reach, named when one to three ("the Rossi and Nguyen families"). */
    missedNamed: string | null;
  }
  | { ok: false; status: number; body: Record<string, unknown> };

const refuse = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): FamilyEmailResult =>
  ({ ok: false, status, body: { error, code, ...extra } });

type RecipientStatus = 'pending' | 'sent' | 'failed' | 'opted_out';

/** One family's outcome from the results so far: reached (an address accepted — 'skipped' is a transport switched off
 *  here, not a failure), failed (every address decided, none accepted), else still pending. The same rule as
 *  `familyCounts`. */
function familyStatus(f: AudienceFamily, results: ReadonlyMap<string, FamilySendResult>): RecipientStatus {
  const statuses = f.addresses.map(a => results.get(a)?.status);
  if (statuses.some(s => s === 'sent' || s === 'skipped')) return 'sent';
  return statuses.every(s => s !== undefined) ? 'failed' : 'pending';
}

/** Move each recipient row to its family's status, writing only what changed since the last batch. */
async function recordOutcomes(ids: readonly string[], families: readonly AudienceFamily[], results: ReadonlyMap<string, FamilySendResult>, known: RecipientStatus[]) {
  const moves = new Map<RecipientStatus, string[]>();
  families.forEach((f, i) => {
    const s = familyStatus(f, results);
    if (s === known[i]) return;
    known[i] = s;
    moves.set(s, [...(moves.get(s) ?? []), ids[i]]);
  });
  for (const [status, list] of moves) {
    const { error } = await supabaseAdmin.from('family_email_recipients')
      .update({ status, updated_at: new Date().toISOString() }).in('id', list);
    if (error) console.error('[families-email] a family\'s outcome was not recorded (the send goes on):', error.message);
  }
}

/** The subject and message, as both doors read them from a body. */
export function emailWords(body: Record<string, unknown>): { subject: string; message: string } | { error: string; code: string } {
  const subject = typeof body.subject === 'string' ? body.subject.replace(/\s*[\r\n]+\s*/g, ' ').trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  if (!subject) return { error: W.needSubject, code: 'subject' };
  if (!message) return { error: W.needMessage, code: 'message' };
  if (subject.length > 200 || message.length > 5000) return { error: W.tooLong, code: 'too_long' };
  return { subject, message };
}

/**
 * The Families door's press. `body`: { kind, teamIds | seasonId | list, subject, body, copyCoaches, expected } —
 * `expected` is the number on the lime the sender pressed; the server's own count must equal it, or nothing is claimed
 * and nothing goes. A season picked here counts toward THAT season's three (9d1·6); its divisions, teams and statuses
 * stay on the season's own door.
 */
export async function sendFamilyEmailToClub(ctx: AuthContextWithRole, body: Record<string, unknown>): Promise<FamilyEmailResult> {
  const scope = parseScope(body);
  if (!scope || isSeasonDoorScope(scope)) return refuse(400, W.failed, 'kind');
  const pick = scopeNeedsPick(scope);
  if (pick === 'teams') return refuse(400, W.pickTeams, 'teams_required');
  if (pick === 'season') return refuse(400, W.pickSeason, 'season_required');
  const words = emailWords(body);
  if ('error' in words) return refuse(400, words.error, words.code);
  const expected = typeof body.expected === 'number' ? body.expected : -1;

  // A send is an ACTION: it attaches first, so a registration whose person was minted since the window opened is in the
  // re-count — and the re-count then has to match what the sender saw.
  const world = await loadFamilyAudience(ctx.org.id, ctx.org.slug, { attach: true, lists: scope.kind === 'list' });
  const audience = familyAudience(world.people, scope, world.suppressed, ctx.user.email ?? null);
  if (audience.families.length === 0) {
    return refuse(409, audience.optedOut > 0 ? W.nobodyOptedOut : W.nobodyAtAll, 'nobody');
  }
  if (audience.families.length !== expected) {
    return refuse(409, W.changed(audience.families.length), 'changed', { families: audience.families.length });
  }
  const seasonId = scopeSeasonId(scope);
  const seasonName = seasonId ? seasonNameIn(world.people, seasonId) : null;
  return deliverFamilyEmail({
    ctx, scope, world, audience, label: audienceLabel(world.people, scope), seasonName, ...words,
    copy: body.copyCoaches === true && audience.coachTeamIds.length > 0
      ? { league: false, coaches: addresses => headCoachesToCopy(ctx.org.id, audience.coachTeamIds, ctx.user.id, addresses) }
      : null,
    words: seasonName
      ? { capReason: nextAt => SW.capReason(seasonName, nextAt), sentNoneDelivered: SW.sentNoneDelivered }
      : { capReason: W.capReason, sentNoneDelivered: W.sentNoneDelivered },
  });
}

/** The house-league coaches of a season team audience, found by the caller (9d1·9): never counted as families. */
export interface CoachCopy { coaches: (familyAddresses: ReadonlySet<string>) => Promise<CopiedCoach[]>; league: boolean }

/**
 * THE ONE SEND, for both doors. The caller has decided who (the audience, re-counted on the press and matched to what the
 * sender saw) and the words; this claims (the scope's bucket), records each family, sends through the choke point with
 * progress, gives the claim back when nobody was reached, completes the row and copies the coaches if asked.
 */
export async function deliverFamilyEmail(d: {
  ctx: AuthContextWithRole;
  scope: FamilyAudienceScope;
  world: FamilyAudienceWorld;
  audience: FamilyAudience;
  label: string;
  seasonName: string | null;
  subject: string;
  message: string;
  copy: CoachCopy | null;
  /** The season door's own refusal words; the club door's otherwise. */
  words: { capReason: (nextAt: string | null) => string; sentNoneDelivered: string };
}): Promise<FamilyEmailResult> {
  const { ctx, scope, world, audience } = d;
  const senderEmail = ctx.user.email ?? null;

  // The claim and the allowance, in one step, before any email goes.
  const claim = await supabaseAdmin.rpc('family_email_claim', {
    p_org: ctx.org.id, p_actor: ctx.user.id, p_subject: d.subject, p_body: d.message, p_kind: scope.kind, p_label: clip(d.label),
    p_team_ids: scope.kind === 'teams' || scope.kind === 'season_teams' ? scope.teamIds : [],
    p_season_id: scopeSeasonId(scope),
    p_family_count: audience.families.length, p_opted_out_count: audience.optedOut,
  });
  if (claim.error) throw claim.error;
  const c = claim.data as { ok: boolean; code?: string; nextAt?: string | null; sendId?: string };
  if (!c.ok || !c.sendId) {
    if (c.code === 'cap') return refuse(409, d.words.capReason(c.nextAt ?? null), 'cap', { nextAt: c.nextAt ?? null });
    return refuse(409, W.justSent, 'just_sent');
  }
  const sendId = c.sendId;
  const row = () => supabaseAdmin.from('family_email_sends');

  // Each family, before the first batch: pending, or opted out. A stopped email reads whom it missed from these.
  const ids = audience.families.map(() => crypto.randomUUID());
  const recipientRows = [
    ...audience.families.map((f, i) => ({ id: ids[i], send_id: sendId, org_id: ctx.org.id, person_ids: f.personIds, family_name: f.familyName, status: 'pending' })),
    ...audience.optedOutFamilies.map(f => ({ send_id: sendId, org_id: ctx.org.id, person_ids: f.personIds, family_name: f.familyName, status: 'opted_out' })),
  ];
  for (let i = 0; i < recipientRows.length; i += 500) {
    const { error } = await supabaseAdmin.from('family_email_recipients').insert(recipientRows.slice(i, i + 500));
    if (error) console.error('[families-email] the families were not recorded (the send goes on):', error.message);
  }
  const known: RecipientStatus[] = audience.families.map(() => 'pending');

  // The club's face and where a reply goes (S3b). Both degrade to a plainer email, never to a failed send: the claim is held.
  const [club, sender] = await Promise.all([clubEmailFacts(ctx.org), senderName(ctx).catch(() => null)]);
  const reply = familyReplyPlan({ kind: 'person', clubName: ctx.org.name, senderEmail, senderName: sender });

  // The family send — through the choke point only, with progress written as each batch goes.
  const results = await sendFamilyEmailBatch({
    orgId: ctx.org.id,
    to: audience.families.flatMap(f => f.addresses),
    subject: d.subject,
    content: { teamName: ctx.org.name, orgName: ctx.org.name, title: d.subject, body: d.message, reason: reasonFor(d.seasonName), club, replyLine: reply.line },
    suppressed: world.suppressed,
    replyTo: senderEmail,
    onBatch: async so => {
      const n = familyCounts(audience, so);
      const { error } = await row().update({ reached_count: n.reached, failed_count: n.failed }).eq('id', sendId);
      if (error) console.error('[families-email] progress not recorded (the send goes on):', error.message);
      await recordOutcomes(ids, audience.families, so, known);
    },
  });
  await recordOutcomes(ids, audience.families, results, known);
  const { reached, failed } = familyCounts(audience, results);
  if (reached === 0) {
    // Nobody got it, so it was no send: the claim goes (and its families with it), so it neither spends the allowance
    // nor reads as Last sent.
    const { error } = await row().delete().eq('id', sendId).eq('org_id', ctx.org.id);
    if (error) console.error('[families-email] a claim that reached nobody was not removed:', error.message);
    return refuse(502, d.words.sentNoneDelivered, 'not_delivered');
  }

  // The families have all been tried: the row reads Done now, so a request that dies during the coach copies below
  // never leaves a finished send reading "Stopped at x of y".
  const { error: doneErr } = await row().update({ reached_count: reached, failed_count: failed, status: 'done' }).eq('id', sendId);
  if (doneErr) console.error('[families-email] the log could not be completed (the send went):', doneErr.message);

  // The coaches' copy — colleague mail, each once, never the sender or a parent the send reached.
  let coaches = 0;
  if (d.copy) {
    try {
      const [copied, name] = await Promise.all([d.copy.coaches(familyAddresses(audience)), senderName(ctx)]);
      coaches = await sendCoachCopies(copied, coach => coachCopyWords({
        orgName: ctx.org.name, audience: d.label, families: reached, subject: d.subject, body: d.message, sender: name,
        coachName: coach.name, league: d.copy!.league,
      }), senderEmail);
    } catch (e) {
      console.error('[families-email] the coach copies failed (the family send went):', e);
    }
  }
  if (coaches > 0) {
    const { error: coachErr } = await row().update({ coach_count: coaches }).eq('id', sendId);
    if (coachErr) console.error('[families-email] the coach count could not be recorded (the send went):', coachErr.message);
  }
  const missed = audience.families.filter((_, i) => known[i] !== 'sent');
  return {
    ok: true, families: audience.families.length, reached, failed, optedOut: audience.optedOut, coaches, sendId,
    missedNamed: missed.length ? familiesNamed(missed.map(f => f.familyName)) : null,
  };
}

/**
 * "SEND TO THE N IT MISSED" (9d1·10). A stopped email (still `sending` past the grace period) goes again, the SAME row and
 * words, to its families that never reached `sent` — never a new claim, never counted. Each family's address is read as
 * it is NOW (a corrected address is reached; one opted out since is skipped). `seasonId`: the season's door may resend
 * only its own; the Families door any of the club's.
 */
export async function resendMissedFamilies(ctx: AuthContextWithRole, sendId: string, opts: { seasonId?: string } = {}): Promise<FamilyEmailResult> {
  const cutoff = new Date(Date.now() - CLUB_EMAIL_STOPPED_AFTER_MS).toISOString();
  let q = supabaseAdmin.from('family_email_sends')
    .update({ retried_at: new Date().toISOString() })
    .eq('id', sendId).eq('org_id', ctx.org.id).eq('status', 'sending').lt('sent_at', cutoff)
    .or(`retried_at.is.null,retried_at.lt.${cutoff}`);
  if (opts.seasonId) q = q.eq('season_id', opts.seasonId);
  // Taking the row is the press's claim: a second press finds it already taken, and nothing goes twice.
  const { data: taken, error } = await q.select('id, subject, body, season_id, family_count').maybeSingle();
  if (error) throw error;
  if (!taken) return refuse(409, SW.notStopped, 'not_stopped');

  const { data: missedRows, error: mErr } = await supabaseAdmin.from('family_email_recipients')
    .select('id, person_ids, family_name, status').eq('send_id', sendId).in('status', ['pending', 'failed']);
  if (mErr) throw mErr;
  const missed = missedRows ?? [];

  const world = await loadFamilyAudience(ctx.org.id, ctx.org.slug, { attach: true });
  const emailOf = new Map(world.people.map(p => [p.personId, p.email]));
  const sender = (ctx.user.email ?? '').trim().toLowerCase();
  // Each missed family, at its address as it is now: reachable (sent below), opted out since, or no address at all.
  const now = missed.map(r => {
    const all = [...new Set((r.person_ids as string[]).map(id => emailOf.get(id)).filter((a): a is string => !!a && a !== sender))];
    return { r, all, reachable: all.filter(a => !world.suppressed.has(a)).sort() };
  });
  const going = now.filter(x => x.reachable.length > 0);
  const families: AudienceFamily[] = going.map(x => ({ addresses: x.reachable, teamIds: [], personIds: x.r.person_ids, familyName: x.r.family_name, children: [] }));
  const familyIds = going.map(x => x.r.id as string);
  const decided = new Map<'opted_out' | 'failed', string[]>([
    ['opted_out', now.filter(x => x.reachable.length === 0 && x.all.length > 0).map(x => x.r.id as string)],
    ['failed', now.filter(x => x.all.length === 0).map(x => x.r.id as string)],
  ]);
  for (const [status, list] of decided) {
    if (list.length) await supabaseAdmin.from('family_email_recipients').update({ status, updated_at: new Date().toISOString() }).in('id', list);
  }

  const seasonName = taken.season_id ? await seasonNameOf(taken.season_id) : null;
  const [club, name] = await Promise.all([clubEmailFacts(ctx.org), senderName(ctx).catch(() => null)]);
  const reply = familyReplyPlan({ kind: 'person', clubName: ctx.org.name, senderEmail: ctx.user.email ?? null, senderName: name });
  const known: RecipientStatus[] = families.map(() => 'pending');
  const results = families.length === 0 ? new Map<string, FamilySendResult>() : await sendFamilyEmailBatch({
    orgId: ctx.org.id,
    to: families.flatMap(f => f.addresses),
    subject: taken.subject,
    content: { teamName: ctx.org.name, orgName: ctx.org.name, title: taken.subject, body: taken.body, reason: reasonFor(seasonName), club, replyLine: reply.line },
    suppressed: world.suppressed,
    replyTo: ctx.user.email ?? null,
    onBatch: async so => recordOutcomes(familyIds, families, so, known),
  });
  await recordOutcomes(familyIds, families, results, known);

  // The row's counts, from its families as they now stand.
  const counts = await supabaseAdmin.from('family_email_recipients').select('status').eq('send_id', sendId);
  if (counts.error) throw counts.error;
  const reached = (counts.data ?? []).filter(r => r.status === 'sent').length;
  const failedNow = (counts.data ?? []).filter(r => r.status === 'failed').length;
  const { error: doneErr } = await supabaseAdmin.from('family_email_sends')
    .update({ reached_count: reached, failed_count: failedNow, status: 'done' }).eq('id', sendId);
  if (doneErr) console.error('[families-email] the resent email could not be completed:', doneErr.message);

  const stillMissed = families.filter((_, i) => known[i] !== 'sent');
  return {
    ok: true, families: taken.family_count, reached, failed: failedNow, optedOut: decided.get('opted_out')!.length, coaches: 0, sendId,
    missedNamed: stillMissed.length ? familiesNamed(stillMissed.map(f => f.familyName)) : null,
  };
}

async function seasonNameOf(seasonId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('league_seasons').select('name').eq('id', seasonId).maybeSingle();
  return data?.name ?? null;
}

export type FamilyMessageResult =
  | { ok: true; recipients: number; sent: number; messageId: string }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * MESSAGE THIS FAMILY (chunk F; Club Tier Stage 5a, Ask 9 — the one club send window), the household door BOTH Families
 * and a house-league season use (9d1·5). In order: the household's reach is re-read; nobody reachable is refused in
 * words; the send is CLAIMED and the cap checked in ONE step (`family_message_claim`, mig 334 — two presses at two of
 * three serialize there, and the second is refused with when the next can go); each guardian is emailed through
 * `sendFamilyEmail` with replies to the sender; a claim whose send reached nobody is removed; the club's audit log
 * records the send (counts only — never the words, never the addresses). From a season it names the season on its row
 * and in its footer, and NEVER counts toward the season's three.
 */
export async function messageOneFamily(ctx: AuthContextWithRole, personId: string, rawSubject: string, rawMessage: string,
  season: { id: string; name: string } | null = null): Promise<FamilyMessageResult> {
  const no = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): FamilyMessageResult =>
    ({ ok: false, status, body: { error, code, ...extra } });

  // A send is an ACTION: it attaches first, so an email a coach changed since the last worklist visit is followed
  // before anyone is mailed (/review 2026-10-17). Reads stay attach-free; the worklist is the visit's one attach.
  const reach = await loadHouseholdReach(ctx.org.id, personId, { attach: true });
  if (!reach) return no(404, 'Not found', 'not_found');
  // The reach, decided on the press — never trusted from the window.
  const to = [...new Set(reach.recipients.filter(r => !r.optedOut).map(r => r.email))];
  if (to.length === 0) return no(409, MW.optedOutRace, 'opted_out');

  // The claim and the cap, in one step, before any email goes.
  const { data: claim, error: claimErr } = await supabaseAdmin.rpc('family_message_claim', {
    p_org_id: ctx.org.id, p_person_id: personId, p_actor: ctx.user.id,
  });
  if (claimErr) throw claimErr;
  const c = claim as { ok: boolean; code?: string; nextAt?: string | null; messageId?: string };
  if (!c.ok || !c.messageId) {
    if (c.code === 'cap') return no(409, MW.capRace(c.nextAt ?? null), 'cap', { nextAt: c.nextAt ?? null });
    return no(404, 'Not found', 'not_found');
  }
  if (season) {
    // The season's history lists it (never its words); the claim's own count is untouched.
    const { error } = await supabaseAdmin.from('family_messages').update({ season_id: season.id }).eq('id', c.messageId);
    if (error) console.error('[families] the message\'s season was not recorded (the send goes on):', error.message);
  }

  // The reach's own suppression list, shared across the household's sends; the choke point re-runs the guard against
  // it per recipient. A transport that throws (the network dropped) is that guardian's refused send — never a 500 that
  // keeps the claim and invites a second press that mails the others twice (/review 2026-10-17).
  const { suppressed } = reach;
  // The club's face and where a reply goes (S3b): read once for the household, not once per address.
  const [club, sender] = await Promise.all([clubEmailFacts(ctx.org), senderName(ctx).catch(() => null)]);
  const reply = familyReplyPlan({ kind: 'person', clubName: ctx.org.name, senderEmail: ctx.user.email, senderName: sender });
  const results = await Promise.all(to.map(address =>
    sendFamilyEmail({
      orgId: ctx.org.id,
      to: address,
      subject: rawSubject,
      content: {
        teamName: ctx.org.name,
        orgName: ctx.org.name,
        title: rawSubject,
        body: rawMessage,
        reason: reasonFor(season?.name ?? null),
        club,
        replyLine: reply.line,
      },
      suppressed,
      // Ask 9: replies go to the person who wrote it.
      replyTo: ctx.user.email ?? null,
    }).catch(err => {
      console.error('[families] message send failed:', err instanceof Error ? err.message : String(err));
      return { status: 'provider_error' as const };
    }),
  ));
  const sent = results.filter(r => r.status === 'sent').length;
  // A send that reached NOBODY (every one refused by the transport, or suppressed since the read) is no send: the
  // claim goes, so it neither spends the family's three nor reads as "Last messaged". A transport switched off in this
  // environment ('skipped') is not a failure of the send.
  const reachedNobody = results.every(r => r.status === 'provider_error' || r.status === 'suppressed');
  if (reachedNobody) {
    const { error: giveBack } = await supabaseAdmin.from('family_messages').delete().eq('id', c.messageId).eq('org_id', ctx.org.id);
    if (giveBack) console.error('[families] a claim that reached nobody was not removed:', giveBack.message);
    return no(502, MW.sentNoneDelivered, 'not_delivered');
  }

  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'family_messaged', { personId, guardians: to.length, delivered: sent, ...(season ? { seasonId: season.id } : {}) });
  return { ok: true, recipients: to.length, sent, messageId: c.messageId };
}
