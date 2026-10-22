import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { resolvePersonNamer } from './db';
import { sendFamilyEmailBatch } from './family-email';
import { loadFamilyAudience, type FamilyAudienceWorld } from './families-read';
import { audienceChoices, familyAudience, familyCounts, parseScope, type AudienceChoices, type AudiencePerson, type FamilyAudience, type FamilyAudienceScope } from './families-audience';
import { coachCopyWords, headCoachesToCopy, sendCoachCopies } from './families-email-coaches';
import { senderName } from './families-coach-ask';
import { CLUB_EMAIL_CAP, FAMILY_EMAIL_WORDS as W, FAMILY_MESSAGE_REASON } from './families-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EMAIL FAMILIES (Club Tier Stage 7c — Asks 6 and 7, option A each; drawing 4; owner answers 2026-10-22 to the build
 * prompt's Put to the owner 1–6). The club emails every family, some rep teams' families or one house-league season's,
 * through the one club send window (the 2026-10-11 ruling):
 *
 *   · WHO — `familyAudience` (lib/families-audience.ts), ONE function for the preview, the lime's number, the server's
 *     re-count on the press and the send. Each family once; opted-out families counted, never sent to; the sender never
 *     a recipient. The press re-counts and refuses ('changed') when the number differs from the one the sender saw.
 *   · THE CLAIM before a single email — `family_email_claim` (mig 347): a per-club lock, a second press within a minute
 *     refused 'just_sent', a fourth send in any rolling 24 hours refused 'cap' with when the next can go. The claim IS
 *     the log row (the Emails tab), deleted when the send reached nobody so a failed send never spends the day.
 *   · THE SEND — family mail ONLY through the choke point (`sendFamilyEmailBatch`, lib/family-email.ts: the suppression
 *     check and each family's own unsubscribe footer), the provider's batches of 100, all of it inside the request (owner,
 *     Put to the owner 3: work after the response is not kept alive on this host). Replies go to the sender. The row's
 *     counts move as each batch goes, so a send the server never finished reads "Stopped at x of y" (Put to the owner 4).
 *   · THE HEAD COACHES' COPY — colleague mail, in its own file (lib/families-email-coaches.ts), never this one.
 *
 * ⚠ Email only: no notice, no push, no chat, no family login. ⚠ A demo club never reaches here: the proxy refuses a demo
 * club's POST. The log keeps the subject, the message, the audience in words and COUNTS — never a list of families or
 * addresses (owner, Put to the owner 1).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** What the window shows for one choice of Who. */
export interface FamilyEmailPreview {
  choices: AudienceChoices;
  scope: FamilyAudienceScope;
  families: number;
  optedOut: number;
  senderSkipped: boolean;
  /** Head coaches a copy would go to for this choice (0 for a season, or when none can be reached). */
  coaches: number;
  /** This choice's children with no family on file ("Nobody to send to"). */
  noFamily: number;
  lastSent: { at: string; by: string | null; subject: string; families: number } | null;
  cap: { capped: boolean; nextAt: string | null };
  orgName: string;
  reason: string;
}

function noFamilyIn(world: FamilyAudienceWorld, scope: FamilyAudienceScope): number {
  if (scope.kind === 'every') return world.noFamily.length;
  // A list names families that exist; the children with no family on file are a different list, with nobody to email.
  if (scope.kind === 'list') return 0;
  if (scope.kind === 'teams') {
    const ids = new Set(scope.teamIds);
    return world.noFamily.filter(c => c.source === 'rep_roster' && ids.has(c.groupId)).length;
  }
  return world.noFamily.filter(c => c.source === 'league' && c.groupId === scope.seasonId).length;
}

const AUDIENCE_LABEL_MAX = 500;

/** The audience in words, as the log's To and the coach copy name it. */
function audienceLabel(people: readonly AudiencePerson[], scope: FamilyAudienceScope): string {
  if (scope.kind === 'every') return W.audienceEvery;
  if (scope.kind === 'list') return W.audienceList(scope.list);
  if (scope.kind === 'teams') {
    const names = new Map(people.flatMap(p => p.roster.filter(r => r.current).map(r => [r.teamId, r.teamName] as const)));
    const label = W.audienceTeams(scope.teamIds.map(id => names.get(id)).filter((n): n is string => !!n).sort((a, b) => a.localeCompare(b)));
    // The log's To holds up to 500 characters (mig 347): a long run of team names ends in an ellipsis rather than a refused send.
    return label.length > AUDIENCE_LABEL_MAX ? `${label.slice(0, AUDIENCE_LABEL_MAX - 1)}…` : label || W.teams;
  }
  for (const p of people) {
    const l = p.league.find(x => x.current && x.seasonId === scope.seasonId);
    if (l) return l.seasonName;
  }
  return W.season;
}

const familyAddresses = (a: FamilyAudience) => new Set(a.families.flatMap(f => f.addresses));

/** The club's sends in the cap's window, oldest first (bounded — never the club's whole log). */
async function capState(orgId: string): Promise<FamilyEmailPreview['cap']> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin.from('family_email_sends').select('sent_at')
    .eq('org_id', orgId).gt('sent_at', dayAgo).order('sent_at', { ascending: true }).limit(CLUB_EMAIL_CAP * 4);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length < CLUB_EMAIL_CAP) return { capped: false, nextAt: null };
  const oldest = rows[rows.length - CLUB_EMAIL_CAP];
  return { capped: true, nextAt: new Date(new Date(oldest.sent_at).getTime() + 24 * 3600 * 1000).toISOString() };
}

/** "Last sent …": the newest send that reached a family (one that reached nobody is not it; one still going counts from its first batch). */
async function lastSend(orgId: string): Promise<FamilyEmailPreview['lastSent']> {
  const { data, error } = await supabaseAdmin.from('family_email_sends')
    .select('sent_at, sent_by, subject, reached_count').eq('org_id', orgId).gt('reached_count', 0)
    .order('sent_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const nameOf = await resolvePersonNamer(orgId, [row.sent_by]);
  return { at: row.sent_at, by: nameOf(row.sent_by), subject: row.subject, families: row.reached_count };
}

export async function familyEmailPreview(ctx: AuthContextWithRole, scope: FamilyAudienceScope): Promise<FamilyEmailPreview> {
  const [world, lastSent, cap] = await Promise.all([
    loadFamilyAudience(ctx.org.id, ctx.org.slug, { lists: true }), lastSend(ctx.org.id), capState(ctx.org.id),
  ]);
  const senderEmail = ctx.user.email ?? null;
  const choices = audienceChoices(world.people, world.suppressed, senderEmail);
  const audience = familyAudience(world.people, scope, world.suppressed, senderEmail);
  // A house-league season copies no head coach: its audience names no rep team, so this reads nobody.
  const coaches = await headCoachesToCopy(ctx.org.id, audience.coachTeamIds, ctx.user.id, familyAddresses(audience));
  return {
    choices, scope,
    families: audience.families.length, optedOut: audience.optedOut, senderSkipped: audience.senderSkipped,
    coaches: coaches.length, noFamily: noFamilyIn(world, scope),
    lastSent, cap, orgName: ctx.org.name, reason: FAMILY_MESSAGE_REASON,
  };
}

export type FamilyEmailResult =
  | { ok: true; families: number; reached: number; failed: number; optedOut: number; coaches: number }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * The press. `body`: { kind, teamIds | seasonId, subject, body, copyCoaches, expected } — `expected` is the number on the
 * lime the sender pressed; the server's own count must equal it, or nothing is claimed and nothing goes.
 */
export async function sendFamilyEmailToClub(ctx: AuthContextWithRole, body: Record<string, unknown>): Promise<FamilyEmailResult> {
  const refuse = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): FamilyEmailResult =>
    ({ ok: false, status, body: { error, code, ...extra } });

  const scope = parseScope(body);
  if (!scope) return refuse(400, W.failed, 'kind');
  if (scope.kind === 'teams' && scope.teamIds.length === 0) return refuse(400, W.pickTeams, 'teams_required');
  if (scope.kind === 'season' && !scope.seasonId) return refuse(400, W.pickSeason, 'season_required');
  const subject = typeof body.subject === 'string' ? body.subject.replace(/\s*[\r\n]+\s*/g, ' ').trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  if (!subject) return refuse(400, W.needSubject, 'subject');
  if (!message) return refuse(400, W.needMessage, 'message');
  if (subject.length > 200 || message.length > 5000) return refuse(400, W.tooLong, 'too_long');
  const expected = typeof body.expected === 'number' ? body.expected : -1;

  // A send is an ACTION: it attaches first, so a registration whose person was minted since the window opened is in the
  // re-count — and the re-count then has to match what the sender saw.
  const world = await loadFamilyAudience(ctx.org.id, ctx.org.slug, { attach: true, lists: scope.kind === 'list' });
  const senderEmail = ctx.user.email ?? null;
  const audience = familyAudience(world.people, scope, world.suppressed, senderEmail);
  if (audience.families.length === 0) {
    return refuse(409, audience.optedOut > 0 ? W.nobodyOptedOut : W.nobodyAtAll, 'nobody');
  }
  if (audience.families.length !== expected) {
    return refuse(409, W.changed(audience.families.length), 'changed', { families: audience.families.length });
  }
  const label = audienceLabel(world.people, scope);

  // The claim and the cap, in one step, before any email goes.
  const claim = await supabaseAdmin.rpc('family_email_claim', {
    p_org: ctx.org.id, p_actor: ctx.user.id, p_subject: subject, p_body: message, p_kind: scope.kind, p_label: label,
    p_team_ids: scope.kind === 'teams' ? scope.teamIds : [], p_season_id: scope.kind === 'season' ? scope.seasonId : null,
    p_family_count: audience.families.length, p_opted_out_count: audience.optedOut,
  });
  if (claim.error) throw claim.error;
  const c = claim.data as { ok: boolean; code?: string; nextAt?: string | null; sendId?: string };
  if (!c.ok || !c.sendId) {
    if (c.code === 'cap') return refuse(409, W.capReason(c.nextAt ?? null), 'cap', { nextAt: c.nextAt ?? null });
    return refuse(409, W.justSent, 'just_sent');
  }
  const sendId = c.sendId;
  const row = () => supabaseAdmin.from('family_email_sends');

  // The family send — through the choke point only, with progress written as each batch goes.
  const results = await sendFamilyEmailBatch({
    orgId: ctx.org.id,
    to: audience.families.flatMap(f => f.addresses),
    subject,
    content: { teamName: ctx.org.name, orgName: ctx.org.name, title: subject, body: message, reason: FAMILY_MESSAGE_REASON },
    suppressed: world.suppressed,
    replyTo: senderEmail,
    onBatch: async so => {
      const n = familyCounts(audience, so);
      const { error } = await row().update({ reached_count: n.reached, failed_count: n.failed }).eq('id', sendId);
      if (error) console.error('[families-email] progress not recorded (the send goes on):', error.message);
    },
  });
  const { reached, failed } = familyCounts(audience, results);
  if (reached === 0) {
    // Nobody got it, so it was no send: the claim goes, so it neither spends the day's three nor reads as Last sent.
    const { error } = await row().delete().eq('id', sendId).eq('org_id', ctx.org.id);
    if (error) console.error('[families-email] a claim that reached nobody was not removed:', error.message);
    return refuse(502, W.sentNoneDelivered, 'not_delivered');
  }

  // The families have all been tried: the row reads Done now, so a request that dies during the coach copies below
  // never leaves a finished send reading "Stopped at x of y".
  const { error: doneErr } = await row().update({ reached_count: reached, failed_count: failed, status: 'done' }).eq('id', sendId);
  if (doneErr) console.error('[families-email] the log could not be completed (the send went):', doneErr.message);

  // The head coaches' copy — colleague mail, each once, never the sender or a parent the send reached.
  let coaches = 0;
  if (body.copyCoaches === true) {
    try {
      const [copied, sender] = await Promise.all([
        headCoachesToCopy(ctx.org.id, audience.coachTeamIds, ctx.user.id, familyAddresses(audience)), senderName(ctx),
      ]);
      coaches = await sendCoachCopies(copied, coach => coachCopyWords({
        orgName: ctx.org.name, audience: label, families: reached, subject, body: message, sender, coachName: coach.name,
      }), senderEmail);
    } catch (e) {
      console.error('[families-email] the head coach copies failed (the family send went):', e);
    }
  }

  if (coaches > 0) {
    const { error: coachErr } = await row().update({ coach_count: coaches }).eq('id', sendId);
    if (coachErr) console.error('[families-email] the coach count could not be recorded (the send went):', coachErr.message);
  }
  return { ok: true, families: audience.families.length, reached, failed, optedOut: audience.optedOut, coaches };
}
