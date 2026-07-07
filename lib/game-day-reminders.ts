/**
 * Game-day reminder re-sync after a bulk reschedule — Rain-Delay Day-of Ops (Feature B).
 *
 * Game-day reminders are Resend-scheduled jobs whose send time is baked in at publish time from
 * `game_date` (the evening before, ~6–7pm Eastern) and are NOT recomputed when a game later moves.
 * After the "shift the day" tool changes game times, this brings the affected teams' reminders in
 * line with the new schedule using the SAME idempotent cancel-then-schedule the publish route runs
 * (see app/api/admin/schedule-publish/route.ts): for each affected accepted team's first still-
 * scheduled game, cancel any previously scheduled reminder, then (re)schedule one — skipping any
 * send-time already in the past.
 *
 * Because reminders fire the evening BEFORE game day, a same-day shift's reminder has usually
 * already been sent; the past-time skip makes that case a correct no-op, and the genuine value is
 * a game pushed across midnight into a new day (its reminder is re-scheduled for that new evening).
 *
 * Best-effort + fully isolated: the caller runs this fire-and-forget so a reminder hiccup can never
 * affect the reschedule itself.
 */

import { supabaseAdmin, getOrgOwnerEmail } from './supabase-admin';
import { resolveTournamentContactEmail } from './db';
import { gameDayReminderHtml, resolveCoachRecipient, coachPortalUrl, coachEmailEnabled } from './email';
import { sendMarketingEmail, cancelScheduledEmailForRecipient, COACH_GAME_DAY_REMINDER_EMAIL_KEY } from './email-sender';

// Empty-slot sentinel some games use instead of NULL for an unassigned team (mirrors publish route).
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

interface SyncParams {
  orgId: string;
  /** Fallback contact email (e.g. ctx.org.contactEmail); the org owner is looked up if absent. */
  orgContactEmail?: string | null;
  tournamentId: string;
  /**
   * Restrict the re-sync to teams that had a game touched by the shift/cancel. Passing this keeps
   * the work (and Resend cancel/schedule calls) bounded to the day's teams instead of the whole
   * tournament. Null/undefined re-syncs every accepted team.
   */
  affectedTeamIds?: string[] | null;
}

export async function syncGameDayRemindersAfterReschedule(params: SyncParams): Promise<{ rescheduled: number }> {
  const { orgId, tournamentId } = params;
  let rescheduled = 0;

  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('name, slug, settings')
    .eq('id', tournamentId)
    .single();
  if (!tournament) return { rescheduled };

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, coach_email')
    .eq('tournament_id', tournamentId)
    .eq('status', 'accepted');
  if (!teams?.length) return { rescheduled };

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, game_date, game_time, location, home_team_id, away_team_id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'scheduled')
    .not('game_date', 'is', null)
    .order('game_date', { ascending: true })
    .order('game_time', { ascending: true });

  const teamIds = new Set(teams.map((t) => t.id));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name] as const));

  // First still-scheduled game per team (rows are date/time-ordered → first match wins).
  type GameRow = { id: string; game_date: string | null; game_time: string | null; location: string | null; home_team_id: string | null; away_team_id: string | null };
  const firstGameByTeam = new Map<string, GameRow>();
  for (const g of (games ?? []) as GameRow[]) {
    for (const side of [g.home_team_id, g.away_team_id]) {
      if (side && teamIds.has(side) && !firstGameByTeam.has(side)) firstGameByTeam.set(side, g);
    }
  }

  const affected = params.affectedTeamIds ? new Set(params.affectedTeamIds) : null;
  const gameDayEnabled = coachEmailEnabled(tournament.settings, 'game_day');
  const contactEmail = (await resolveTournamentContactEmail(
    tournamentId,
    params.orgContactEmail ?? (await getOrgOwnerEmail(orgId)) ?? null,
    'coach',
  )) ?? undefined;
  const now = Date.now();

  for (const team of teams) {
    if (affected && !affected.has(team.id)) continue;
    const recipient = resolveCoachRecipient(team);
    if (!recipient) continue;

    // Clear any previously scheduled reminder first — idempotent, and also correct for a team
    // whose only game was cancelled (no reschedule follows, so the reminder is simply removed).
    await cancelScheduledEmailForRecipient(orgId, COACH_GAME_DAY_REMINDER_EMAIL_KEY, recipient);

    const g = firstGameByTeam.get(team.id);
    if (!g?.game_date || !gameDayEnabled) continue;

    const reminderAtMs = new Date(`${g.game_date}T00:00:00Z`).getTime() - 60 * 60 * 1000;
    if (Number.isNaN(reminderAtMs) || reminderAtMs <= now) continue; // already fired / past → nothing to send

    const dateLabel = new Date(`${g.game_date}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = g.game_time
      ? new Date(`1970-01-01T${g.game_time}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
      : null;
    const firstGameLabel = timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;

    const opponentId = g.home_team_id === team.id ? g.away_team_id : g.home_team_id;
    const realOpponentId = opponentId && opponentId !== NIL_UUID ? opponentId : null;
    const opponentName = realOpponentId ? teamNameById.get(realOpponentId) ?? null : null;

    await sendMarketingEmail({
      emailKey: COACH_GAME_DAY_REMINDER_EMAIL_KEY,
      orgId,
      toEmail: recipient,
      toName: team.coach || team.name,
      subject: `${team.name}: your first game at ${tournament.name}`,
      html: gameDayReminderHtml({
        teamName: team.name,
        coachName: team.coach || team.name,
        tournamentName: tournament.name,
        firstGameLabel,
        location: g.location,
        opponentName,
        portalUrl: coachPortalUrl({ registrationId: team.id, email: team.email ?? undefined }),
        contactEmail,
      }),
      scheduledAt: new Date(reminderAtMs).toISOString(),
      skipOptOutCheck: true, // transactional — the organizer's marketing opt-out can't suppress it
    });
    rescheduled++;
  }

  return { rescheduled };
}
