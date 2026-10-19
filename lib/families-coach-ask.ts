import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { inParallel } from './supabase-paging';
import { resolvePersonNamer } from './db';
import { loadHeadCoaches } from './club-team-board';
import { emailHtml } from './club-schedule-send';
import type { EmailWords } from './club-schedule-words';
import { sendEmail } from './email';
import { notify } from './notify';
import { repChildrenWithNoFamily } from './families-read';
import { FAMILY_COACH_ASK_WORDS as W } from './families-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ASK THE COACHES (Club Tier Stage 5b, Ask 4 — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P1).
 *
 * Since Club Stage 2 a rep roster is the COACH's, so the club cannot type a rep child's guardian anywhere, and Families'
 * landing list ("No family on file") was work the club could not do (S5-01). This send emails each team's head coach the
 * names of their players with no guardian on file and where to add one (their Roster), through the one club send window
 * — and delivers the way the club already reaches coaches (the scheduler's send, `lib/club-schedule-send.ts`):
 *   · COLLEAGUE MAIL, replies to the sender — ⚠ never the family door (`sendFamilyEmail` is for families);
 *   · a "Your club" bell to each head coach the email went to — INFORMATIONAL (`club_guardians_asked` is a 'know'
 *     notice), not Needs attention, unless the owner rules otherwise;
 *   · ONE log row per send (`family_coach_asks`, mig 335), CLAIMED before any email goes (a second press within a minute
 *     is refused), completed with what went, removed when nothing did. It keeps teams and counts, NEVER the names.
 * Head coaches only (the build prompt: "each team's head coach"), never the person sending.
 * Who may send: whoever can open Families (the route's gate) — the same people who see the list it acts on.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface CoachAskTeam {
  teamId: string;
  teamName: string;
  /** The head coaches the email reaches (named; never the sender). Empty = "Nobody to send to", with `why`. */
  coaches: { userId: string; name: string | null; email: string }[];
  why: string | null;
  /** The players the email names. */
  players: string[];
  /** The sample, as the coach will read it. */
  sample: EmailWords;
}

export interface CoachAskPreview {
  teams: CoachAskTeam[];
  coachCount: number;
  lastSent: { at: string; by: string | null } | null;
}

function teamEmail(orgName: string, orgSlug: string, team: { teamId: string; teamName: string; players: string[] }, coachName: string | null, sender: string): EmailWords {
  return {
    subject: W.emailSubject(team.teamName),
    greeting: W.emailGreeting(coachName?.split(' ')[0] ?? null),
    paragraphs: [W.emailLead(orgName, team.teamName, team.players.length)],
    lists: [{ title: W.emailListTitle, items: team.players }],
    link: { label: W.emailLink, path: `/${orgSlug}/coaches/teams/${team.teamId}/roster` },
    outro: W.emailOutro(sender),
  };
}

async function lastAsk(orgId: string): Promise<CoachAskPreview['lastSent']> {
  // A send that reached someone: a claim still in flight (or one a crash left behind) is not "Last sent".
  const { data, error } = await supabaseAdmin.from('family_coach_asks')
    .select('sent_at, sent_by').eq('org_id', orgId).gt('recipient_count', 0).order('sent_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const nameOf = await resolvePersonNamer(orgId, [row.sent_by]);
  return { at: row.sent_at, by: nameOf(row.sent_by) };
}

/** The person sending, by the club's name for them (their address, then the club, when it holds none). */
export async function senderName(ctx: AuthContextWithRole): Promise<string> {
  return (await resolvePersonNamer(ctx.org.id, [ctx.user.id]))(ctx.user.id) ?? ctx.user.email ?? ctx.org.name;
}

/** Who a send reaches, team by team, and who sends it — the preview and the send read this one plan. */
async function coachAskPlan(ctx: AuthContextWithRole) {
  const [teams, sender] = await Promise.all([repChildrenWithNoFamily(ctx.org.id, ctx.org.slug), senderName(ctx)]);
  const heads = await loadHeadCoaches(ctx.org.id, teams.map(t => t.teamId));
  const plan = teams.map(t => {
    const h = heads.get(t.teamId) ?? { people: [], invited: [] };
    const coaches = h.people
      .filter(p => !!p.email && p.userId !== ctx.user.id)
      .map(p => ({ userId: p.userId, name: p.name, email: p.email! }));
    const why = coaches.length > 0 ? null
      : h.people.some(p => p.userId === ctx.user.id) ? W.onlyYou
      : h.invited.some(i => !i.expired) ? W.invitationOpen : W.noHeadCoach;
    return { teamId: t.teamId, teamName: t.teamName, coaches, why, players: [...t.children].sort((a, b) => a.localeCompare(b)) };
  }).sort((a, b) => a.teamName.localeCompare(b.teamName));
  return { teams: plan, sender };
}

export async function coachAskPreview(ctx: AuthContextWithRole): Promise<CoachAskPreview> {
  const [{ teams, sender }, lastSent] = await Promise.all([coachAskPlan(ctx), lastAsk(ctx.org.id)]);
  const out: CoachAskTeam[] = teams.map(t => ({ ...t, sample: teamEmail(ctx.org.name, ctx.org.slug, t, t.coaches[0]?.name ?? null, sender) }));
  return { teams: out, coachCount: out.reduce((n, t) => n + t.coaches.length, 0), lastSent };
}

export type CoachAskResult =
  | { ok: true; coaches: number; teams: number; failed: number }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Send what the preview named. The server recomputes the preview (never a list from the browser) and sends only to teams
 * the sender saw (`teamIds`), so a team that became reachable after the window opened is not emailed unseen.
 */
export async function sendCoachAsk(ctx: AuthContextWithRole, teamIds: unknown): Promise<CoachAskResult> {
  if (!Array.isArray(teamIds) || teamIds.length === 0 || !teamIds.every(x => typeof x === 'string')) {
    return { ok: false, status: 400, body: { error: W.nothing, code: 'teams_required' } };
  }
  const plan = await coachAskPlan(ctx);
  const confirmed = new Set(teamIds as string[]);
  const teams = plan.teams.filter(t => confirmed.has(t.teamId) && t.coaches.length > 0);
  if (teams.length === 0) return { ok: false, status: 409, body: { error: W.nobodyReachable, code: 'nothing_to_send' } };

  const claim = await supabaseAdmin.rpc('family_coach_ask_claim', {
    p_org: ctx.org.id, p_actor: ctx.user.id, p_team_ids: teams.map(t => t.teamId),
    p_player_count: teams.reduce((n, t) => n + t.players.length, 0),
  });
  if (claim.error) throw claim.error;
  const claimed = claim.data as { ok: boolean; code?: string; askId?: string };
  if (!claimed.ok || !claimed.askId) {
    return { ok: false, status: 409, body: { error: W.justSent, code: 'just_sent', lastSent: await lastAsk(ctx.org.id) } };
  }
  const askId = claimed.askId;

  const sends = teams.flatMap(t => t.coaches.map(c => {
    const words = teamEmail(ctx.org.name, ctx.org.slug, t, c.name, plan.sender);
    return { teamId: t.teamId, userId: c.userId, email: c.email, subject: words.subject, html: emailHtml(words) };
  }));
  // Colleague mail, a few at a time, replies to the sender (the scheduler's and the reminders' delivery). ⚠ A transport
  // that THROWS (a network failure, not a provider refusal) is one failed email, never an escaped error: the claim above
  // must always be completed or released below (/review 2026-10-17 — a throw left a claim reading "Last sent" and a
  // minute's refusal behind it).
  const results = await inParallel(sends, 5, async s => {
    try { return await sendEmail(s.email, s.subject, s.html, { replyTo: ctx.user.email ?? null }); }
    catch (e) { console.error('[families-coach-ask] an email threw:', e); return { status: 'provider_error' as const }; }
  });
  const went = sends.filter((_, i) => results[i].status === 'sent');
  const reached = teams.filter(t => went.some(s => s.teamId === t.teamId));
  if (reached.length === 0) {
    // Nothing went, so nothing was sent: the claim comes off and a retry is not refused as "just sent".
    const { error } = await supabaseAdmin.from('family_coach_asks').delete().eq('id', askId);
    if (error) console.error('[families-coach-ask] could not release a claim that sent nothing:', error);
    return { ok: false, status: 502, body: { error: W.failed, code: 'send_failed' } };
  }

  // The bells ("Your club"): each head coach the email reached, on their team's Roster. Best-effort — the send went.
  await inParallel(reached, 5, async t => {
    try {
      const userIds = [...new Set(went.filter(s => s.teamId === t.teamId).map(s => s.userId))];
      await notify({
        orgId: ctx.org.id, userIds, excludeUserIds: [ctx.user.id], eventType: 'club_guardians_asked',
        title: W.bellTitle, body: W.bellBody(t.teamName, t.players.length),
        link: `/${ctx.org.slug}/coaches/teams/${t.teamId}/roster`, metadata: { teamId: t.teamId },
      });
    } catch (e) {
      console.error('[families-coach-ask] a notice failed (the send went):', e);
    }
  });

  // The record: the teams reached, the players they named, the coaches emailed — counts, never names.
  const { error } = await supabaseAdmin.from('family_coach_asks').update({
    team_ids: reached.map(t => t.teamId),
    player_count: reached.reduce((n, t) => n + t.players.length, 0),
    recipient_count: went.length,
  }).eq('id', askId);
  if (error) console.error('[families-coach-ask] the log could not be completed (the send went):', error);

  return { ok: true, coaches: went.length, teams: reached.length, failed: results.length - went.length };
}
