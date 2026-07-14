/**
 * lib/fan-notify.ts — Server-only fan push fan-out
 *
 * Sends a Web Push to fans following the teams involved when a score is posted
 * (and for the playoff/champions/announcement moments). Two recipient sources:
 *
 *  - ACCOUNT (primary, Slice 3 — Business Decisions Log 2026-07-14): signed-in
 *    fans via fan_follows → fan_alert_prefs (absent row = opted in) →
 *    push_subscriptions (mig 101, user-keyed device endpoints).
 *  - ANONYMOUS (legacy): fan_push_subscriptions (mig 107). Closed to NEW opt-ins
 *    at Slice 3 — existing rows keep receiving until they expire naturally.
 *
 * Parallel to lib/notify.ts (staff/org-scoped). Gated to Tournament Plus+ via the
 * `fan_score_alerts` plan feature. Fire-and-forget: never throws, so it can't
 * break score submission.
 *
 * Triggered from lib/tournament-scoring-service.ts::submitTournamentScore() so it
 * covers the scorekeeper, official, and admin score paths in one place.
 */
import { supabaseAdmin } from './supabase-admin';
import { sendWebPush } from './web-push';
import { hasPlanFeature } from './plan-features';
import { filterUsersWithCategoryOn } from './fan-alert-prefs';
import { captureError } from './observability';
import type { GameStatus, OrgPlan } from './types';

interface FanPushTarget {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  /** Which table the row lives in — drives last_used_at refresh + dead-endpoint cleanup. */
  table: 'fan_push_subscriptions' | 'push_subscriptions';
}

interface FanPushPayload {
  title: string;
  body: string;
  link: string;
  icon?: string;
}

/** Legacy anonymous subscriptions for a tournament (existing opt-ins only — the
 *  subscribe UI no longer creates new rows as of Slice 3). */
async function anonymousTargets(
  tournamentId: string,
  category: 'notify_scores' | 'notify_messages',
  teamIds?: string[],
): Promise<FanPushTarget[]> {
  let query = supabaseAdmin
    .from('fan_push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('tournament_id', tournamentId)
    .eq(category, true);
  if (teamIds && teamIds.length > 0) query = query.in('team_id', teamIds);
  const { data } = await query;
  return (data ?? []).map(s => ({ ...s, table: 'fan_push_subscriptions' as const }));
}

/** Account-routed recipients: users following any of these teams, with the given
 *  alert category on (missing prefs row = on), fanned out to every device
 *  endpoint they've registered (push_subscriptions is user-keyed). */
async function accountTargetsForTeams(
  teamIds: string[],
  category: 'game_alerts' | 'event_news',
): Promise<FanPushTarget[]> {
  if (teamIds.length === 0) return [];
  const { data: follows } = await supabaseAdmin
    .from('fan_follows')
    .select('user_id')
    .eq('entity_type', 'team')
    .in('entity_id', teamIds);
  const userIds = Array.from(new Set((follows ?? []).map(f => f.user_id)));
  if (userIds.length === 0) return [];

  const optedIn = await filterUsersWithCategoryOn(userIds, category);
  if (optedIn.length === 0) return [];

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .in('user_id', optedIn);
  return (subs ?? []).map(s => ({ ...s, table: 'push_subscriptions' as const }));
}

/** Tournament-wide moments (playoffs/champions/announcements) reach the followers
 *  of EVERY team in the tournament. */
async function accountTargetsForTournament(
  tournamentId: string,
  category: 'game_alerts' | 'event_news',
): Promise<FanPushTarget[]> {
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId);
  return accountTargetsForTeams((teams ?? []).map(t => t.id), category);
}

/**
 * The merged recipient list every dispatcher wants: account-routed targets plus
 * any surviving legacy anonymous subscriptions, fetched in parallel (independent
 * tables — this runs on the score-submission hot path). `teamIds` scopes the
 * per-game paths; tournament-wide moments omit it. Account category maps to the
 * legacy column: game_alerts ↔ notify_scores, event_news ↔ notify_messages.
 */
async function mergedTargets(
  tournamentId: string,
  category: 'game_alerts' | 'event_news',
  teamIds?: string[],
): Promise<FanPushTarget[]> {
  const [account, anonymous] = await Promise.all([
    teamIds
      ? accountTargetsForTeams(teamIds, category)
      : accountTargetsForTournament(tournamentId, category),
    anonymousTargets(tournamentId, category === 'game_alerts' ? 'notify_scores' : 'notify_messages', teamIds),
  ]);
  // Account first — on a shared endpoint, dedupe keeps the account row.
  return [...account, ...anonymous];
}

/**
 * Send one payload to a merged target list: dedupe by endpoint (a device can hold
 * BOTH a legacy anonymous row and an account registration — account wins by list
 * order), refresh last_used_at on success, delete dead endpoints (410/404) from
 * their own table. Returns { sent, failed } — failed counts unexpected errors
 * only, never routine dead-endpoint cleanup.
 */
async function sendToTargets(
  targets: FanPushTarget[],
  payload: FanPushPayload,
  label: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const sub of targets) {
    if (seen.has(sub.endpoint)) continue;
    seen.add(sub.endpoint);
    try {
      await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload,
      );
      sent++;
      await supabaseAdmin
        .from(sub.table)
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id);
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 410 || code === 404) {
        // Expired/revoked subscription — dead for every message; routine cleanup,
        // not a failure. push_subscriptions is shared with staff notifications,
        // but a dead endpoint is dead for that pipeline too.
        await supabaseAdmin.from(sub.table).delete().eq('endpoint', sub.endpoint);
      } else {
        failed++;
        // Log AND record to observability — fan push is best-effort so we never
        // rethrow, but a persistent failure (e.g. a VAPID mismatch) must be
        // visible on the error dashboard, same as the staff pipeline (lib/notify).
        console.error(`[fan-notify] ${label} push send failed for`, sub.endpoint, err);
        await captureError(err, {
          route: 'lib/fan-notify (push dispatch)',
          severity: 'warning',
          title: 'Fan web push send failed',
          statusCode: code,
          requestContext: { dispatcher: label, table: sub.table },
        });
      }
    }
  }
  return { sent, failed };
}

/** Tournament + org context shared by every dispatcher; null on any gate miss. */
async function fanPushContext(tournamentId: string): Promise<{
  tournament: { id: string; slug: string; name: string; logo_url: string | null };
  org: { slug: string; logo_url: string | null };
  icon?: string;
} | null> {
  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('id, slug, name, org_id, logo_url')
    .eq('id', tournamentId)
    .maybeSingle();
  if (!tournament) return null;

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('slug, plan_id, logo_url')
    .eq('id', tournament.org_id)
    .maybeSingle();
  if (!org) return null;

  // Plan gate — the signature halo feature is Tournament Plus+.
  if (!hasPlanFeature(org.plan_id as OrgPlan, 'fan_score_alerts')) return null;

  // Brand the notification with the event/org logo when present (J6-051). Only an
  // absolute http(s) URL (an uploaded logo on Supabase storage) is usable: the SW
  // shows this outside any page context, so a root-relative stock-logo path (e.g.
  // "/stock-logos/x.svg") wouldn't resolve and an SVG won't render in OS
  // notifications anyway — those fall back to the platform icon.
  const rawIcon = tournament.logo_url || org.logo_url;
  const icon = rawIcon && /^https?:\/\//i.test(rawIcon) ? rawIcon : undefined;

  return { tournament, org, icon };
}

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

    // 2. Tournament + org + plan gate.
    const ctx = await fanPushContext(game.tournament_id);
    if (!ctx) return;

    // 3. Everyone following either team in this game — account path merged with
    //    any surviving legacy anonymous subscriptions.
    const teamIds = [game.home_team_id, game.away_team_id].filter(Boolean) as string[];
    if (teamIds.length === 0) return;

    const targets = await mergedTargets(ctx.tournament.id, 'game_alerts', teamIds);
    if (targets.length === 0) return;

    // 4. Build the payload.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', teamIds);
    const nameOf = (id: string | null) => (id ? teams?.find(t => t.id === id)?.name ?? 'TBD' : 'TBD');
    const scoreline = `${nameOf(game.away_team_id)} ${game.away_score}–${nameOf(game.home_team_id)} ${game.home_score}`;

    const title = status === 'completed' ? `Final: ${scoreline}` : `Score update: ${scoreline}`;
    const stage = game.is_playoff ? (game.bracket_code || 'Playoff') : '';
    const body = stage ? `${ctx.tournament.name} · ${stage}` : ctx.tournament.name;
    const link = `/${ctx.org.slug}/${ctx.tournament.slug}/schedule/${gameId}`;

    await sendToTargets(targets, { title, body, link, icon: ctx.icon }, 'game');
  } catch (err) {
    // Best-effort — must never break score submission.
    console.error('[fan-notify] notifyFansForGame error:', err);
  }
}

/**
 * Fan push fan-out for the "Playoffs are set" moment — one push to every fan
 * following ANY team in the tournament (not just the two in a game). Fired once,
 * the first time a playoff bracket is materialized (guarded upstream by
 * tournaments.playoffs_published_at). Playoffs/champions are tournament-wide
 * RESULT moments — they ride the game-alerts (scores) category, matching the
 * legacy notify_scores semantics. Fire-and-forget — never throws.
 */
export async function notifyFansForPlayoff(tournamentId: string): Promise<void> {
  try {
    const ctx = await fanPushContext(tournamentId);
    if (!ctx) return;

    const targets = await mergedTargets(ctx.tournament.id, 'game_alerts');
    if (targets.length === 0) return;

    const title = '🏆 The playoff bracket is set!';
    const body = `${ctx.tournament.name} · See the seeding & who plays who`;
    // Deep-link straight to the shareable Playoff Picture.
    const link = `/${ctx.org.slug}/${ctx.tournament.slug}/playoffs`;

    await sendToTargets(targets, { title, body, link, icon: ctx.icon }, 'playoff');
  } catch (err) {
    console.error('[fan-notify] notifyFansForPlayoff error:', err);
  }
}

/**
 * Fan push fan-out for the "Champions crowned" moment — one push to every fan
 * following ANY team in the tournament. Fired once, the first time the whole
 * tournament's playoffs become complete (guarded upstream by
 * tournaments.champions_crowned_at). Rides the game-alerts category (result
 * moment, see notifyFansForPlayoff). Deep-links to the shareable /champions
 * recap. `headline` is the pre-computed champion line. Fire-and-forget.
 */
export async function notifyFansForChampions(tournamentId: string, headline?: string): Promise<void> {
  try {
    const ctx = await fanPushContext(tournamentId);
    if (!ctx) return;

    const targets = await mergedTargets(ctx.tournament.id, 'game_alerts');
    if (targets.length === 0) return;

    const title = '🏆 Champions crowned!';
    const body = headline
      ? `${ctx.tournament.name} · ${headline} — see the final results`
      : `${ctx.tournament.name} · See the final results`;
    // Deep-link straight to the shareable Champions recap.
    const link = `/${ctx.org.slug}/${ctx.tournament.slug}/champions`;

    await sendToTargets(targets, { title, body, link, icon: ctx.icon }, 'champions');
  } catch (err) {
    console.error('[fan-notify] notifyFansForChampions error:', err);
  }
}

/**
 * Fan push fan-out for an organizer ANNOUNCEMENT (e.g. a rain-delay / day-of notice) —
 * one push to every fan following ANY team in the tournament. Fired when an organizer
 * posts an announcement with the "push to fans" channel selected
 * (app/api/admin/communications). Rides the event-news category (legacy
 * notify_messages). Deep-links to the public News page where the full message lives.
 *
 * Returns `{ sent, failed }`: `sent` = devices actually pushed, `failed` = unexpected
 * send errors (NOT expired 410/404 subscriptions, which are silently cleaned up).
 * `sent = 0, failed = 0` means "no one has alerts on yet"; `failed > 0` signals a real
 * push problem (e.g. misconfigured keys). Both 0 on any gate miss / missing tournament.
 * Fire-and-forget — never throws.
 */
export async function notifyFansForAnnouncement(
  tournamentId: string,
  message: { title: string; body: string },
): Promise<{ sent: number; failed: number }> {
  try {
    const ctx = await fanPushContext(tournamentId);
    if (!ctx) return { sent: 0, failed: 0 };

    const targets = await mergedTargets(ctx.tournament.id, 'event_news');
    if (targets.length === 0) return { sent: 0, failed: 0 };

    // The organizer's own words carry the notification. Collapse whitespace and cap the
    // body so a long, multi-line message reads cleanly in an OS notification (which
    // truncates anyway).
    const title = message.title.trim() || ctx.tournament.name;
    const flatBody = message.body.trim().replace(/\s+/g, ' ');
    const body = flatBody ? (flatBody.length > 160 ? `${flatBody.slice(0, 159)}…` : flatBody) : ctx.tournament.name;
    const link = `/${ctx.org.slug}/${ctx.tournament.slug}/news`;

    return await sendToTargets(targets, { title, body, link, icon: ctx.icon }, 'announcement');
  } catch (err) {
    console.error('[fan-notify] notifyFansForAnnouncement error:', err);
    return { sent: 0, failed: 0 };
  }
}
