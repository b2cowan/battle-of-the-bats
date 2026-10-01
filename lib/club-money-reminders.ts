import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { teamIdsInScope } from './club-team-route';
import { loadHeadCoaches } from './club-team-board';
import { markAllocationReminderSent, resolvePersonNamer } from './db';
import { allocationReminderHtml, sendEmail } from './email';
import { tournamentToday } from './timezone';
import { chunked, inParallel } from './supabase-paging';
import { loadClubLoop } from './club-money-reads';
import { teamsMoneyPeople } from './club-money-notify';
import { refused, type Moved } from './club-money-route';
import { COMING_DUE_DAYS, clubInstallmentDaysLate, remindsAbout, sumMoney } from './club-money-figures';
import {
  UNREACHABLE_WORD, reminderEmailLines, reminderEmailSubject, type ReminderEmailLine, type UnreachableWhy,
} from './club-money-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ALLOCATION REMINDERS (Club Tier Stage 3a, Ask 4; C16, J4-015, J4-030).
 *
 * Today's "Run now" emailed a list to whoever clicked it, never a coach; it left out anything already
 * late (the installments worth chasing), sent with no preview, and only owners and admins could press
 * it — so the treasurer who runs the loop couldn't. Now:
 *   · ONE wave (or one team, from inside its bill), remind-about = overdue + due in the next 14 days
 *     (the Coming due window); a payment a coach has SENT is waiting on the club and is never chased;
 *   · to each team's head coaches and any staff the head coach gave money access (ruled 2026-09-30,
 *     question 2) — NEVER the person sending;
 *   · a PREVIEW first: every recipient, every team that can't be reached and why, and the last wave
 *     (when and by whom), so two people don't send the same wave twice;
 *   · the reply goes to the sender (question 3: no payment-instructions setting; the email says to
 *     reply to arrange payment);
 *   · manual only (a schedule is a later ask).
 * Who may send: whoever holds the club's accounting (`canMoveClubMoney`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ReminderLine extends ReminderEmailLine {
  installmentId: string;
  splitId: string;
}

export interface ReminderTeam {
  teamId: string;
  teamName: string;
  recipients: { userId: string; name: string | null; email: string; isHeadCoach: boolean }[];
  lines: ReminderLine[];
  amount: number;
  overdueCount: number;
}

export interface ReminderPreview {
  windowDays: number;
  teams: ReminderTeam[];
  unreachable: { teamId: string; teamName: string; why: UnreachableWhy; whyWords: string; lines: ReminderLine[]; amount: number }[];
  recipientCount: number;
  installmentCount: number;
  amount: number;
  lastSent: { at: string; by: string | null; teamCount: number; recipientCount: number } | null;
}

export async function reminderPreview(
  ctx: AuthContextWithRole,
  opts: { teamId?: string } = {},
  today: string = tournamentToday(),
): Promise<ReminderPreview> {
  const [loop, lastSent] = await Promise.all([
    teamIdsInScope(ctx).then(scope => loadClubLoop(ctx.org.id, scope, opts.teamId ? { teamId: opts.teamId } : {})),
    lastWave(ctx.org.id, opts.teamId ?? null),
  ]);

  const linesByTeam = new Map<string, ReminderLine[]>();
  for (const s of loop.splits) {
    const description = loop.allocations.get(s.allocationId)?.description ?? 'Club allocation';
    for (const i of s.installments) {
      if (!remindsAbout(i, today)) continue;
      const list = linesByTeam.get(s.teamId) ?? [];
      list.push({
        installmentId: i.id, splitId: s.id, allocation: description, number: i.installmentNumber,
        of: s.installments.length, amount: i.amount, dueDate: i.dueDate, daysLate: clubInstallmentDaysLate(i, today),
      });
      linesByTeam.set(s.teamId, list);
    }
  }

  const teamIds = [...linesByTeam.keys()].filter(id => loop.teams.has(id));
  const [people, heads] = await Promise.all([
    teamsMoneyPeople(ctx.org.id, teamIds),
    loadHeadCoaches(ctx.org.id, teamIds),
  ]);

  const teams: ReminderTeam[] = [];
  const unreachable: ReminderPreview['unreachable'] = [];
  for (const teamId of teamIds) {
    const teamName = loop.teams.get(teamId)!.name;
    const lines = linesByTeam.get(teamId)!.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.allocation.localeCompare(b.allocation));
    const all = people.get(teamId) ?? [];
    const recipients = all
      .filter(p => !!p.email && p.userId !== ctx.user.id)
      .map(p => ({ userId: p.userId, name: p.name, email: p.email!, isHeadCoach: p.isHeadCoach }));
    if (recipients.length === 0) {
      // "Invited" is the Rep Teams board's word for it: a head-coach invitation still open, not expired.
      const why: UnreachableWhy = all.some(p => p.userId === ctx.user.id)
        ? 'only_you'
        : (heads.get(teamId)?.invited ?? []).some(inv => !inv.expired) ? 'invitation_unanswered' : 'no_head_coach';
      unreachable.push({ teamId, teamName, why, whyWords: UNREACHABLE_WORD[why], lines, amount: sumMoney(lines) });
      continue;
    }
    teams.push({ teamId, teamName, recipients, lines, amount: sumMoney(lines), overdueCount: lines.filter(l => l.daysLate > 0).length });
  }
  // The late teams first (the reason to send), then by name.
  teams.sort((a, b) => (b.overdueCount > 0 ? 1 : 0) - (a.overdueCount > 0 ? 1 : 0) || a.teamName.localeCompare(b.teamName));
  unreachable.sort((a, b) => a.teamName.localeCompare(b.teamName));

  return {
    windowDays: COMING_DUE_DAYS,
    teams,
    unreachable,
    recipientCount: teams.reduce((acc, t) => acc + t.recipients.length, 0),
    installmentCount: teams.reduce((acc, t) => acc + t.lines.length, 0),
    amount: sumMoney(teams),
    lastSent,
  };
}

async function lastWave(orgId: string, teamId: string | null): Promise<ReminderPreview['lastSent']> {
  let q = supabaseAdmin.from('rep_allocation_reminder_waves')
    .select('sent_at, sent_by, team_ids, recipient_count').eq('org_id', orgId)
    .order('sent_at', { ascending: false }).limit(1);
  if (teamId) q = q.contains('team_ids', [teamId]);
  const { data, error } = await q;
  if (error) throw error;
  const w = data?.[0];
  if (!w) return null;
  const nameOf = await resolvePersonNamer(orgId, [w.sent_by]);
  return { at: w.sent_at, by: nameOf(w.sent_by), teamCount: (w.team_ids ?? []).length, recipientCount: w.recipient_count };
}

/**
 * Send the wave the preview named. The server recomputes the preview (it never trusts a list from
 * the browser) and sends only to teams the caller confirmed (`teamIds` from the preview they saw), so
 * a team that became reachable after the preview is not emailed unseen.
 */
export async function sendReminders(
  ctx: AuthContextWithRole,
  opts: { teamId?: string; teamIds: unknown },
): Promise<Moved<{ teams: number; recipients: number; failed: number; installments: number; amount: number }>> {
  if (!Array.isArray(opts.teamIds) || opts.teamIds.length === 0 || !opts.teamIds.every(x => typeof x === 'string')) {
    return refused(400, { error: 'Send to the teams the preview named.', code: 'teams_required' });
  }
  const preview = await reminderPreview(ctx, { teamId: opts.teamId });
  const confirmed = new Set(opts.teamIds as string[]);
  const teams = preview.teams.filter(t => confirmed.has(t.teamId));
  if (teams.length === 0) {
    return refused(409, { error: 'Nothing on that list is owed any more, or nobody there can be reached.', code: 'nothing_to_send' });
  }

  /* ⚖ CLAIM THE WAVE BEFORE ANY EMAIL GOES (found by /review 2026-10-01). A double submit or two
     people at once used to both read "nothing sent in the last minute" and both email every coach.
     The claim is one database step under a per-club lock, so the second waits, sees the first wave
     and is refused; the wave row is then completed with what actually went. */
  const claim = await supabaseAdmin.rpc('club_reminder_wave_claim', {
    p_org: ctx.org.id, p_actor: ctx.user.id, p_team: opts.teamId ?? null, p_team_ids: teams.map(t => t.teamId),
    p_installment_count: teams.reduce((acc, t) => acc + t.lines.length, 0), p_amount: sumMoney(teams),
  });
  if (claim.error) throw claim.error;
  const claimed = claim.data as { ok: boolean; code?: string; waveId?: string };
  if (!claimed.ok || !claimed.waveId) {
    return refused(409, {
      error: 'These reminders were just sent.', code: 'just_sent',
      lastSent: await lastWave(ctx.org.id, opts.teamId ?? null),
    });
  }
  const waveId = claimed.waveId;

  const senderName = (await resolvePersonNamer(ctx.org.id, [ctx.user.id]))(ctx.user.id) ?? ctx.user.email ?? ctx.org.name;
  const sends = teams.flatMap(t => {
    const html = allocationReminderHtml(reminderEmailLines({ orgName: ctx.org.name, teamName: t.teamName, senderName, lines: t.lines }));
    const subject = reminderEmailSubject({ orgName: ctx.org.name, teamName: t.teamName });
    return t.recipients.map(p => ({ teamId: t.teamId, email: p.email, subject, html }));
  });
  // A few at a time: a club-wide wave is tens of emails, and one after another risked the time limit.
  const results = await inParallel(sends, 5, s => sendEmail(s.email, s.subject, s.html, { replyTo: ctx.user.email ?? null }));
  const reachedIds = new Set(sends.filter((_, i) => results[i].status === 'sent').map(s => s.teamId));
  const sent = results.filter(r => r.status === 'sent').length;
  const reached = teams.filter(t => reachedIds.has(t.teamId));
  if (reached.length === 0) {
    // Nothing went, so nothing was sent: the claim comes off and a retry is not refused as "just sent".
    const { error } = await supabaseAdmin.from('rep_allocation_reminder_waves').delete().eq('id', waveId);
    if (error) console.error('[club-money-reminders] could not release a wave that sent nothing:', error);
    return refused(502, { error: 'The reminders couldn’t be sent. Try again in a few minutes.', code: 'send_failed' });
  }

  // The wave records what actually went: the teams reached, the people emailed, what they owe.
  const lines = reached.flatMap(t => t.lines);
  const amount = sumMoney(reached);
  const { error } = await supabaseAdmin.from('rep_allocation_reminder_waves')
    .update({ team_ids: reached.map(t => t.teamId), recipient_count: sent, installment_count: lines.length, amount })
    .eq('id', waveId);
  if (error) throw error;
  for (const ids of chunked(lines.map(l => l.installmentId))) await markAllocationReminderSent(ids);

  return { ok: true, teams: reached.length, recipients: sent, failed: results.length - sent, installments: lines.length, amount };
}
