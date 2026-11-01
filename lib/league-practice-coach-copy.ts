import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn, inParallel } from './supabase-paging';
import { sendEmail } from './email';
import { emailHtml } from './club-schedule-send';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { coachTeamPath } from './house-league-coach-invites';
import { coachCopyWords, upcoming, type ToldPractice } from './league-practice-tell';
import type { LeagueSeason } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE COACHES' COPY OF A TEAM'S FIRST PRACTICE-TIMES EMAIL (House League 9d-3 Part 5, copy section D).
 *
 * One short email to each of a team's coaches the FIRST time its families are told their practice times: who was told,
 * how many dates, and the way to the team page. ONCE PER TEAM EVER — a later change reaches the coaches through the 11b
 * coach email (lib/club-schedule-send.ts), never through this.
 *
 *   · CLAIMED BEFORE IT IS SENT (`league_team_practices_told.coaches_copied_at`, null → now WHERE null): only a team this
 *     send told (`notice_id` = the send), so a second press, a "Send again" or two sends at once copy the coaches once. A
 *     copy that fails after its claim is not retried (it is a copy: the families' email is the notice).
 *   · A team this send reached NOBODY on is not told, so it is not claimed: its coaches are copied by the send that does.
 *   · ⚖ WHO IS A COACH: a row that accepted its invite and is not removed (`houseLeagueCoachAccess`'s rule) — the email
 *     opens the team page, which an invited coach can't open yet. (The 11b coach email also mails invited coaches.)
 *   · Its own file: it sends staff mail with `sendEmail`, and the family-email guard forbids that beside a guardian name.
 * Never throws: the families' emails have gone.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export async function copyCoachesOnFirstTell(p: { org: ClubEmailOrg & { slug?: string }; season: LeagueSeason; noticeId: string }): Promise<void> {
  try {
    const firsts = await fetchAll<{ team_id: string; snapshot: ToldPractice[] }>((a, b) => supabaseAdmin.from('league_practice_tells')
      .select('team_id, snapshot').eq('notice_id', p.noticeId).eq('kind', 'first').order('team_id').range(a, b));
    if (!firsts.length) return;
    const { data: claimed, error } = await supabaseAdmin.from('league_team_practices_told')
      .update({ coaches_copied_at: new Date().toISOString() })
      .in('team_id', firsts.map(t => t.team_id)).eq('notice_id', p.noticeId).is('coaches_copied_at', null)
      .select('team_id');
    if (error) throw error;
    const teamIds = (claimed ?? []).map(r => r.team_id as string);
    if (!teamIds.length) return;

    const [reachedRows, coaches, teams, slug, face] = await Promise.all([
      fetchAll<{ team_ids: string[] }>((a, b) => supabaseAdmin.from('league_practice_emails')
        .select('team_ids').eq('notice_id', p.noticeId).eq('status', 'sent').order('id').range(a, b)),
      fetchAllIn<{ team_id: string; email: string; first_name: string | null }>(teamIds, (c, a, b) => supabaseAdmin.from('league_team_coaches')
        .select('team_id, email, first_name').in('team_id', c).is('removed_at', null).not('accepted_at', 'is', null).not('user_id', 'is', null)
        .order('id').range(a, b)),
      fetchAllIn<{ id: string; name: string }>(teamIds, (c, a, b) => supabaseAdmin.from('league_teams').select('id, name').in('id', c).order('id').range(a, b)),
      p.org.slug ? Promise.resolve(p.org.slug) : orgSlugOf(p.org.id),
      systemMailFace(p.org),
    ]);
    const names = new Map(teams.map(t => [t.id, t.name]));
    const reached = new Map<string, number>();
    for (const r of reachedRows) for (const id of new Set(r.team_ids)) reached.set(id, (reached.get(id) ?? 0) + 1);
    const nowMs = Date.now();
    const dates = new Map(firsts.map(t => [t.team_id, upcoming(t.snapshot ?? [], nowMs).length]));

    const sends = coaches.filter(c => c.email?.trim()).map(c => {
      const team = names.get(c.team_id) ?? 'Your team';
      const w = coachCopyWords({
        club: p.org.name, team, season: p.season.name, firstName: c.first_name,
        families: reached.get(c.team_id) ?? 0, dates: dates.get(c.team_id) ?? 0, path: coachTeamPath(slug, p.season.slug, c.team_id),
      });
      return { to: c.email.trim(), subject: w.subject, html: emailHtml(w) };
    });
    await inParallel(sends, 5, s => sendEmail(s.to, s.subject, s.html, {
      kind: 'house_league_practice_coach_copy', replyTo: face?.sendOpts.replyTo ?? null, fromName: face?.sendOpts.fromName ?? null,
    }).catch(err => console.error('[league-practice-coach-copy] a coach\'s copy failed:', err instanceof Error ? err.message : String(err))));
  } catch (err) {
    console.error('[league-practice-coach-copy] the coaches\' copy was not sent (the families\' emails went):', err instanceof Error ? err.message : String(err));
  }
}

async function orgSlugOf(orgId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).single();
  if (error) throw error;
  return data.slug as string;
}
