/**
 * lib/fan-notify.ts — Server-only fan push fan-out
 *
 * Sends a Web Push to every ANONYMOUS fan following either team in a game when a
 * score is posted. Parallel to lib/notify.ts (which is staff/account-scoped) —
 * this path has no user accounts and reads fan_push_subscriptions (migration 107).
 *
 * Gated to Tournament Plus+ via the `fan_score_alerts` plan feature
 * (defense-in-depth — the subscribe route also enforces it). Fire-and-forget:
 * never throws, so it can't break score submission.
 *
 * Triggered from lib/tournament-scoring-service.ts::submitTournamentScore() so it
 * covers the scorekeeper, official, and admin score paths in one place.
 */
import { supabaseAdmin } from './supabase-admin';
import { sendWebPush } from './web-push';
import { hasPlanFeature } from './plan-features';
import type { GameStatus, OrgPlan } from './types';

export async function notifyFansForGame(gameId: string, status: GameStatus): Promise<void> {
  // Only score-posting transitions are interesting to fans.
  if (status !== 'submitted' && status !== 'completed') return;

  try {
    // 1. The game (teams + scores + stage).
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('home_team_id, away_team_id, home_score, away_score, is_playoff, bracket_code, tournament_id, score_submission_source')
      .eq('id', gameId)
      .maybeSingle();
    if (!game || game.home_score == null || game.away_score == null) return;
    // A pending forfeit lands as 'submitted' with the forfeit sentinel score (e.g.
    // 1–0). Don't push it as a real "Score update: 1–0" — it would read as a played
    // game (J6-049 review). The terminal forfeit transition is already suppressed
    // upstream (notifyFansForGame is only called with 'submitted'/'completed').
    if (game.score_submission_source === 'forfeit') return;

    // 2. Tournament + org (slug for the link, plan for the gate).
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, slug, name, org_id, logo_url')
      .eq('id', game.tournament_id)
      .maybeSingle();
    if (!tournament) return;

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug, plan_id, logo_url')
      .eq('id', tournament.org_id)
      .maybeSingle();
    if (!org) return;

    // 3. Plan gate — the signature halo feature is Tournament Plus+.
    if (!hasPlanFeature(org.plan_id as OrgPlan, 'fan_score_alerts')) return;

    // 4. Everyone following either team in this game.
    const teamIds = [game.home_team_id, game.away_team_id].filter(Boolean) as string[];
    if (teamIds.length === 0) return;

    const { data: subs } = await supabaseAdmin
      .from('fan_push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth')
      .eq('tournament_id', tournament.id)
      .eq('notify_scores', true)
      .in('team_id', teamIds);
    if (!subs || subs.length === 0) return;

    // 5. Build the payload.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', teamIds);
    const nameOf = (id: string | null) => (id ? teams?.find(t => t.id === id)?.name ?? 'TBD' : 'TBD');
    const scoreline = `${nameOf(game.away_team_id)} ${game.away_score}–${nameOf(game.home_team_id)} ${game.home_score}`;

    const title = status === 'completed' ? `Final: ${scoreline}` : `Score update: ${scoreline}`;
    const stage = game.is_playoff ? (game.bracket_code || 'Playoff') : '';
    const body = stage ? `${tournament.name} · ${stage}` : tournament.name;
    const link = `/${org.slug}/${tournament.slug}/schedule/${gameId}`;
    // Brand the notification with the event/org logo when present (J6-051). Only an
    // absolute http(s) URL (an uploaded logo on Supabase storage) is usable: the SW
    // shows this outside any page context, so a root-relative stock-logo path (e.g.
    // "/stock-logos/x.svg") wouldn't resolve and an SVG won't render in OS
    // notifications anyway — those fall back to the platform icon. The fan_score_alerts
    // gate above already implies Tournament Plus+ (same plan rank as advanced branding).
    const rawIcon = tournament.logo_url || org.logo_url;
    const icon = rawIcon && /^https?:\/\//i.test(rawIcon) ? rawIcon : undefined;

    // 6. Send, refresh last_used_at, clean up dead endpoints (410/404).
    //    Dedupe by endpoint (a device follows one team per tournament, but be safe).
    const seen = new Set<string>();
    for (const sub of subs) {
      if (seen.has(sub.endpoint)) continue;
      seen.add(sub.endpoint);

      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          { title, body, link, icon },
        );
        await supabaseAdmin
          .from('fan_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) {
          await supabaseAdmin.from('fan_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('[fan-notify] push send failed for', sub.endpoint, err);
        }
      }
    }
  } catch (err) {
    // Best-effort — must never break score submission.
    console.error('[fan-notify] notifyFansForGame error:', err);
  }
}

/**
 * Fan push fan-out for the "Playoffs are set" moment — one push to EVERY anonymous fan
 * following ANY team in the tournament (not just the two in a game). Fired once, the
 * first time a playoff bracket is materialized (guarded upstream by
 * tournaments.playoffs_published_at). Gated to Tournament Plus+ via `fan_score_alerts`,
 * same as the score path. Fire-and-forget — never throws.
 */
export async function notifyFansForPlayoff(tournamentId: string): Promise<void> {
  try {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, slug, name, org_id, logo_url')
      .eq('id', tournamentId)
      .maybeSingle();
    if (!tournament) return;

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug, plan_id, logo_url')
      .eq('id', tournament.org_id)
      .maybeSingle();
    if (!org) return;

    // The signature halo feature is Tournament Plus+.
    if (!hasPlanFeature(org.plan_id as OrgPlan, 'fan_score_alerts')) return;

    // Everyone following any team in this tournament.
    // Playoffs/champions are tournament-wide result moments — gate on the score-alerts category
    // (a fan who turned scores off won't get them). No team filter: any scores-on subscriber is
    // included, including a no-team fan who left scores on. A messages-only sub (scores off) is
    // excluded.
    const { data: subs } = await supabaseAdmin
      .from('fan_push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth')
      .eq('tournament_id', tournament.id)
      .eq('notify_scores', true);
    if (!subs || subs.length === 0) return;

    const title = '🏆 The playoff bracket is set!';
    const body = `${tournament.name} · See the seeding & who plays who`;
    // Deep-link straight to the shareable Playoff Picture.
    const link = `/${org.slug}/${tournament.slug}/playoffs`;
    const rawIcon = tournament.logo_url || org.logo_url;
    const icon = rawIcon && /^https?:\/\//i.test(rawIcon) ? rawIcon : undefined;

    const seen = new Set<string>();
    for (const sub of subs) {
      if (seen.has(sub.endpoint)) continue;
      seen.add(sub.endpoint);
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          { title, body, link, icon },
        );
        await supabaseAdmin
          .from('fan_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) {
          await supabaseAdmin.from('fan_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('[fan-notify] playoff push send failed for', sub.endpoint, err);
        }
      }
    }
  } catch (err) {
    console.error('[fan-notify] notifyFansForPlayoff error:', err);
  }
}

/**
 * Fan push fan-out for the "Champions crowned" moment — one push to EVERY anonymous fan
 * following ANY team in the tournament (not just a game's two teams). Fired once, the first
 * time the whole tournament's playoffs become complete (guarded upstream by
 * tournaments.champions_crowned_at). Gated to Tournament Plus+ via `fan_score_alerts`,
 * same as the playoff/score paths. Deep-links to the shareable /champions recap page.
 * `headline` is the pre-computed champion line (e.g. "Brampton Blazers Gold"). Fire-and-forget.
 */
export async function notifyFansForChampions(tournamentId: string, headline?: string): Promise<void> {
  try {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, slug, name, org_id, logo_url')
      .eq('id', tournamentId)
      .maybeSingle();
    if (!tournament) return;

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug, plan_id, logo_url')
      .eq('id', tournament.org_id)
      .maybeSingle();
    if (!org) return;

    // The signature halo feature is Tournament Plus+.
    if (!hasPlanFeature(org.plan_id as OrgPlan, 'fan_score_alerts')) return;

    // Champions is a result moment — gate on the score-alerts category (see notifyFansForPlayoff).
    const { data: subs } = await supabaseAdmin
      .from('fan_push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth')
      .eq('tournament_id', tournament.id)
      .eq('notify_scores', true);
    if (!subs || subs.length === 0) return;

    const title = '🏆 Champions crowned!';
    const body = headline
      ? `${tournament.name} · ${headline} — see the final results`
      : `${tournament.name} · See the final results`;
    // Deep-link straight to the shareable Champions recap.
    const link = `/${org.slug}/${tournament.slug}/champions`;
    const rawIcon = tournament.logo_url || org.logo_url;
    const icon = rawIcon && /^https?:\/\//i.test(rawIcon) ? rawIcon : undefined;

    const seen = new Set<string>();
    for (const sub of subs) {
      if (seen.has(sub.endpoint)) continue;
      seen.add(sub.endpoint);
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          { title, body, link, icon },
        );
        await supabaseAdmin
          .from('fan_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) {
          await supabaseAdmin.from('fan_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('[fan-notify] champions push send failed for', sub.endpoint, err);
        }
      }
    }
  } catch (err) {
    console.error('[fan-notify] notifyFansForChampions error:', err);
  }
}

/**
 * Fan push fan-out for an organizer ANNOUNCEMENT (e.g. a rain-delay / day-of notice) — one push to
 * EVERY anonymous fan following ANY team in the tournament (not just a game's two teams). Fired when
 * an organizer posts an announcement with the "push to fans" channel selected
 * (app/api/admin/communications). Gated to Tournament Plus+ via `fan_score_alerts`, same as the
 * score/playoff/champions paths. Deep-links to the public News page where the full message lives.
 *
 * Returns `{ sent, failed }`: `sent` = devices actually pushed, `failed` = unexpected send errors
 * (NOT expired 410/404 subscriptions, which are silently cleaned up — those aren't real failures).
 * `sent = 0, failed = 0` means "no one has alerts on yet"; `failed > 0` signals a real push problem
 * (e.g. misconfigured keys). Both 0 on any gate miss / missing tournament. Fire-and-forget — never throws.
 */
export async function notifyFansForAnnouncement(
  tournamentId: string,
  message: { title: string; body: string },
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  try {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, slug, name, org_id, logo_url')
      .eq('id', tournamentId)
      .maybeSingle();
    if (!tournament) return { sent, failed };

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug, plan_id, logo_url')
      .eq('id', tournament.org_id)
      .maybeSingle();
    if (!org) return { sent, failed };

    // The signature halo feature is Tournament Plus+.
    if (!hasPlanFeature(org.plan_id as OrgPlan, 'fan_score_alerts')) return { sent, failed };

    // Every subscriber of this tournament who wants messages — team-followers AND no-team
    // (messages-only) subscribers. Gate on the messages category.
    const { data: subs } = await supabaseAdmin
      .from('fan_push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth')
      .eq('tournament_id', tournament.id)
      .eq('notify_messages', true);
    if (!subs || subs.length === 0) return { sent, failed };

    // The organizer's own words carry the notification. Collapse whitespace and cap the body so a
    // long, multi-line message reads cleanly in an OS notification (which truncates anyway).
    const title = message.title.trim() || tournament.name;
    const flatBody = message.body.trim().replace(/\s+/g, ' ');
    const body = flatBody ? (flatBody.length > 160 ? `${flatBody.slice(0, 159)}…` : flatBody) : tournament.name;
    const link = `/${org.slug}/${tournament.slug}/news`;
    const rawIcon = tournament.logo_url || org.logo_url;
    const icon = rawIcon && /^https?:\/\//i.test(rawIcon) ? rawIcon : undefined;

    const seen = new Set<string>();
    for (const sub of subs) {
      if (seen.has(sub.endpoint)) continue;
      seen.add(sub.endpoint);
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          { title, body, link, icon },
        );
        sent++;
        await supabaseAdmin
          .from('fan_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) {
          // Expired/revoked subscription — a 410/404 endpoint is dead for every message, so remove
          // it. Not counted as a failure (it's routine cleanup, not a broken push).
          await supabaseAdmin.from('fan_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          failed++;
          console.error('[fan-notify] announcement push send failed for', sub.endpoint, err);
        }
      }
    }
  } catch (err) {
    console.error('[fan-notify] notifyFansForAnnouncement error:', err);
  }
  return { sent, failed };
}
