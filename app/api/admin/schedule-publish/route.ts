import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { sendEmail, schedulePublishedHtml, gameDayReminderHtml, resolveCoachRecipient, coachPortalUrl, coachEmailEnabled, SITE_URL } from '@/lib/email';
import { sendMarketingEmail, cancelScheduledEmailForRecipient, COACH_GAME_DAY_REMINDER_EMAIL_KEY } from '@/lib/email-sender';
import { hasPlanFeature } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

// Empty-slot sentinel some games use instead of NULL for an unassigned team.
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// POST /api/admin/schedule-publish
// Body: { tournamentId, divisionIds: string[], visibility: 'published', notify: boolean }
// Two-state schedule (mig 129): publishing always uses REAL team names. The old
// placeholder/anonymized publish mode ('published_generic') was removed.
export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { tournamentId, divisionIds, visibility, notify } = await req.json() as {
      tournamentId: string;
      divisionIds: string[];
      visibility: 'published';
      notify: boolean;
    };

    if (!tournamentId || !divisionIds?.length || !visibility) {
      return Response.json({ error: 'tournamentId, divisionIds, and visibility are required' }, { status: 400 });
    }

    // Two-state only (mig 129): the sole publishable value is 'published' (real names).
    if (visibility !== 'published') {
      return Response.json({ error: 'visibility must be "published"' }, { status: 400 });
    }

    const denied = scopeGuard(ctx, tournamentId);
    if (denied) return denied;

    const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
    if (wrongOrg) return wrongOrg;

    // Publish = real names live AND registration closed, written atomically so the two
    // can never disagree (mig 129). Closing here on the server is the guarantee — the
    // admin client also pre-closes for snappy UI, but a failed client pre-close can no
    // longer leave a division published-but-still-open. Mirrors the reopen→unpublish
    // coupling in /api/admin/divisions (set-closed).
    const { error: updateError } = await supabaseAdmin
      .from('divisions')
      .update({ schedule_visibility: visibility, is_closed: true })
      .in('id', divisionIds)
      .eq('tournament_id', tournamentId);

    if (updateError) throw updateError;

    if (!notify) {
      return Response.json({ success: true, notified: 0 });
    }

    // Plan gate: require tournament_plus for notifications.
    if (!hasPlanFeature(ctx.org.planId as OrgPlan, 'schedule_notification')) {
      return Response.json({ success: true, notified: 0, notifySkipped: true });
    }

    // Fetch tournament details for the email.
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('name, slug, settings')
      .eq('id', tournamentId)
      .single();

    if (!tournament) throw new Error('Tournament not found');

    // Fetch the published division names for the email body.
    const { data: divisionRows } = await supabaseAdmin
      .from('divisions')
      .select('id, name')
      .in('id', divisionIds);

    const divisionNameMap = Object.fromEntries((divisionRows ?? []).map(ag => [ag.id, ag.name]));

    // Fetch accepted teams in the published divisions.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name, coach, email, coach_email, division_id')
      .eq('tournament_id', tournamentId)
      .in('division_id', divisionIds)
      .eq('status', 'accepted');

    const scheduleUrl = `${SITE_URL}/${ctx.org.slug}/${tournament.slug}/schedule`;
    // Coach-facing schedule-published email respects the "Communication with coaches" toggle and
    // resolves the selected contact member. Off → no contact shown.
    const scheduleFallback = (await getOrgOwnerEmail(ctx.org.id)) ?? ctx.org.contactEmail ?? null;
    const contactEmail = (await resolveTournamentContactEmail(tournamentId, scheduleFallback, 'coach')) ?? undefined;

    let notified = 0;
    // 5n: the organizer can disable the schedule-published email (or pause all automatic coach
    // emails) in Event Settings → Notifications & Contact. Default = on (absent key = enabled).
    if (coachEmailEnabled(tournament.settings, 'schedule')) {
      for (const team of teams ?? []) {
        // Recipient prefers the assigned coach (teams.coach_email), falls back to teams.email; skip
        // only when neither exists. The footer keeps teams.email (the claim key, never overwritten).
        const recipient = resolveCoachRecipient(team);
        if (!recipient) continue;
        const divisions = [divisionNameMap[team.division_id] ?? team.division_id];
        const html = schedulePublishedHtml({
          tournamentName: tournament.name,
          coachName: team.coach || team.name,
          divisions,
          scheduleUrl,
          contactEmail,
          registrationId: team.id,
          coachEmail: team.email ?? undefined,
        });
        await sendEmail(recipient, `Schedule Published — ${tournament.name}`, html);
        notified++;
      }
    }

    // ── Game-day reminders (Phase 5m) ───────────────────────────────────────────
    // Schedule a TRANSACTIONAL reminder for each accepted team's FIRST game, the evening before,
    // via Resend `scheduled_at`. Best-effort + fully isolated so it can NEVER break publishing.
    // Cancel-then-schedule per team makes a re-publish idempotent (refreshes, never duplicates).
    try {
      const acceptedTeams = teams ?? [];
      if (acceptedTeams.length > 0) {
        const teamNameById = new Map(acceptedTeams.map(t => [t.id, t.name] as const));
        const teamIds = new Set(acceptedTeams.map(t => t.id));

        type ScheduledGameRow = {
          id: string;
          game_date: string | null;
          game_time: string | null;
          location: string | null;
          home_team_id: string | null;
          away_team_id: string | null;
        };
        const { data: games } = await supabaseAdmin
          .from('games')
          .select('id, game_date, game_time, location, home_team_id, away_team_id')
          .eq('tournament_id', tournamentId)
          .eq('status', 'scheduled')
          .not('game_date', 'is', null)
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true });

        // First scheduled game per team (games are date/time-ordered → first match wins).
        const firstGameByTeam = new Map<string, ScheduledGameRow>();
        for (const g of (games ?? []) as ScheduledGameRow[]) {
          for (const side of [g.home_team_id, g.away_team_id]) {
            if (side && teamIds.has(side) && !firstGameByTeam.has(side)) firstGameByTeam.set(side, g);
          }
        }

        // 5n: the organizer can disable the game-day reminder (or pause all automatic coach emails).
        // The per-team cancel below still runs unconditionally, so turning this off and re-publishing
        // clears any reminders already scheduled — disabling actually removes pending sends.
        const gameDayEnabled = coachEmailEnabled(tournament.settings, 'game_day');

        const now = Date.now();
        for (const team of acceptedTeams) {
          const recipient = resolveCoachRecipient(team);
          if (!recipient) continue;
          const g = firstGameByTeam.get(team.id);
          if (!g?.game_date) continue;

          // Evening before = 1h before game-day UTC midnight (~6-7pm Eastern). Skip if already past
          // (schedule published late — the schedule-published email above already notified them).
          const reminderAtMs = new Date(`${g.game_date}T00:00:00Z`).getTime() - 60 * 60 * 1000;

          // Re-publish safety: drop any prior reminder for this recipient before (re)scheduling.
          await cancelScheduledEmailForRecipient(ctx.org.id, COACH_GAME_DAY_REMINDER_EMAIL_KEY, recipient);
          // Reminders disabled (or all coach emails paused) → cancelled above, schedule none.
          if (!gameDayEnabled) continue;
          if (Number.isNaN(reminderAtMs) || reminderAtMs <= now) continue;

          const dateLabel = new Date(`${g.game_date}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeLabel = g.game_time
            ? new Date(`1970-01-01T${g.game_time}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
            : null;
          const firstGameLabel = timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;

          // Name the opponent only when it's a real assigned team (not a bye / unseeded
          // slot). Otherwise omit it — the email simply doesn't mention an opponent.
          const opponentId = g.home_team_id === team.id ? g.away_team_id : g.home_team_id;
          const realOpponentId = opponentId && opponentId !== NIL_UUID ? opponentId : null;
          const opponentName = realOpponentId ? teamNameById.get(realOpponentId) ?? null : null;

          await sendMarketingEmail({
            emailKey: COACH_GAME_DAY_REMINDER_EMAIL_KEY,
            orgId: ctx.org.id,
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
        }
      }
    } catch (reminderErr) {
      // Non-fatal: a reminder-scheduling failure must never fail schedule publishing.
      console.error('[schedule-publish] game-day reminder scheduling failed (non-fatal):', reminderErr);
    }

    return Response.json({ success: true, notified });

  } catch (err: unknown) {
    console.error('[schedule-publish] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}, { route: '/api/admin/schedule-publish' });
