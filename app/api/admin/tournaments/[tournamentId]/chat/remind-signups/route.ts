import { NextRequest, NextResponse } from 'next/server';
import { coachAccessReminderHtml, sendEmail } from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature } from '@/lib/plan-features';
import { resolveTournamentChatParticipants } from '@/lib/chat-resolvers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';

/**
 * One-click "remind coaches to sign up" from the tournament dashboard's Chat Adoption panel.
 *
 * Batches the SAME access-link email the single-team `resend-access` route already sends, over every
 * "Not yet joined" team that has a contact email (i.e. no coach has claimed their portal yet — the
 * prerequisite for Tournament Chat). Reuses the canonical participant resolver so the target set
 * matches the panel's own "not yet joined" count exactly. Guarded to Tournament Plus+ (the only tiers
 * that have a chat room to fill) as defense-in-depth behind the panel's own gating.
 *
 * Owner decisions 2026-07-29 (Coach Chat program, Step 1):
 *  - S1-A — a 24h cooldown, counted PER TOURNAMENT, so an organizer cannot re-mail the same pending
 *    coaches on repeat clicks and two co-organizers cannot double up on each other. Enforced HERE
 *    (not just in the UI) because the panel's disabled button is only a courtesy.
 *  - S1-B — every batch records when it went out, who sent it, and how many teams it reached.
 *  - CH-1 — chat persists read-only after an event finishes, so the reminder RETIRES at that point:
 *    nudging a coach to join a room for a tournament that is already over is a bad send.
 */

type RouteParams = { params: Promise<{ tournamentId: string }> };

// Safety ceiling — a tournament this large is unusual; keeps a single click from firing an unbounded
// blast. Anything beyond this is skipped (reported back), never silently dropped.
const MAX_REMINDERS = 500;

/** S1-A: per-tournament stand-down between reminder batches. */
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * How long a PROVISIONAL claim (stamped, but with no delivery count written yet) blocks the next
 * attempt. The claim is taken before sending and released if the batch reaches nobody — but if the
 * release write ITSELF fails, the release can't retry its way out, because the thing that broke it
 * is usually the same outage that broke the send. Without this, one bad minute would lock the
 * organizer out of reminders for a full day with no way to clear it.
 *
 * A completed batch always writes `chat_reminder_last_sent_count`, so `count IS NULL` after this
 * grace means "claimed but never finished" and is safe to take over. Comfortably longer than the
 * 500-email ceiling could take, so it can never cut a live batch off at the knees.
 */
const CLAIM_GRACE_MS = 10 * 60 * 1000;

/** CH-1: an event that has finished no longer chases sign-ups. */
const FINISHED_STATUSES = new Set(['completed', 'archived']);

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (
    !hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') &&
    !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')
  ) {
    return forbidden();
  }
  // Only tiers that actually have a chat room to fill can send the chat-adoption nudge.
  if (!hasPlanFeature(ctx.org.planId, 'tournament_chat')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, org_id, status, chat_reminder_last_sent_at, chat_reminder_last_sent_by, chat_reminder_last_sent_count')
    .eq('id', tournamentId)
    .maybeSingle<{
      id: string;
      name: string;
      org_id: string;
      status: string | null;
      chat_reminder_last_sent_at: string | null;
      chat_reminder_last_sent_by: string | null;
      chat_reminder_last_sent_count: number | null;
    }>();
  if (tournamentError) return json({ error: tournamentError.message }, 500);
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  // CH-1 — the event is over; the room stays readable but stops recruiting.
  // `userMessage` is the explicit "safe to show a person" channel — the panel prints only this,
  // never `error`, so a raw driver string can never reach an organizer's screen.
  if (tournament.status && FINISHED_STATUSES.has(tournament.status)) {
    const msg = 'This tournament has finished, so sign-up reminders are no longer sent.';
    return json({ error: msg, userMessage: msg }, 409);
  }

  // S1-A — CLAIM the cooldown window BEFORE sending anything, in one conditional UPDATE.
  //
  // Read-check-then-send-then-stamp would leave the whole send (up to 500 emails, seconds of wall
  // clock) inside a gap where a second request reads the same stale stamp and passes the same
  // check — which is exactly the co-organizer double-click this feature exists to prevent. The
  // `.is(null)` / `.lt(cutoff)` predicate makes the claim atomic: whoever's UPDATE matches a row
  // owns the window, and the loser gets zero rows back and is turned away.
  const claimedAtIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - REMINDER_COOLDOWN_MS).toISOString();
  const previousStamp = tournament.chat_reminder_last_sent_at;

  const graceIso = new Date(Date.now() - CLAIM_GRACE_MS).toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('tournaments')
    .update({
      chat_reminder_last_sent_at: claimedAtIso,
      chat_reminder_last_sent_by: ctx.user.id,
      // Cleared as part of the claim: a claim in flight has no count yet, and that absence is what
      // marks it provisional (see CLAIM_GRACE_MS).
      chat_reminder_last_sent_count: null,
    })
    .eq('id', tournamentId)
    .or(
      [
        'chat_reminder_last_sent_at.is.null',                       // never reminded
        `chat_reminder_last_sent_at.lt."${cutoffIso}"`,             // cooldown elapsed
        `and(chat_reminder_last_sent_count.is.null,chat_reminder_last_sent_at.lt."${graceIso}")`, // stranded claim
      ].join(','),
    )
    .select('id');

  if (claimError) {
    console.error('[chat/remind-signups] cooldown claim failed:', claimError.message);
    return json({ error: 'Could not send reminders. Please try again.' }, 500);
  }

  if (!claimed || claimed.length === 0) {
    // Someone else holds the window — an earlier batch inside 24h, or a concurrent click that won
    // the race by milliseconds. Re-read rather than reusing our own pre-race value: after losing a
    // race that value is stale, and computing the wait from it would understate it by ~23 hours.
    const { data: fresh } = await supabaseAdmin
      .from('tournaments')
      .select('chat_reminder_last_sent_at')
      .eq('id', tournamentId)
      .maybeSingle<{ chat_reminder_last_sent_at: string | null }>();
    const heldStamp = fresh?.chat_reminder_last_sent_at ?? previousStamp;
    const heldSince = Date.parse(heldStamp ?? '');
    const readyAt = (Number.isFinite(heldSince) ? heldSince : Date.now()) + REMINDER_COOLDOWN_MS;
    const hoursLeft = Math.min(24, Math.max(1, Math.ceil((readyAt - Date.now()) / 3_600_000)));
    const msg = `A reminder was already sent for this tournament. You can send another in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.`;
    return json({
      error: msg,
      userMessage: msg,
      cooldown: true,
      reminderLastSentAt: heldStamp,
    }, 429);
  }

  /**
   * Hand the window back when the batch reached nobody. The claim is taken up-front to close the
   * race, so every early exit and every total-failure path below MUST release it — otherwise a
   * send that mailed no one still locks the organizer out for a day.
   */
  async function releaseClaim() {
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({
        // Restore ALL THREE audit fields — a released claim means no batch was sent, so the record
        // must read exactly as it did before the attempt, not as a phantom send by this user.
        chat_reminder_last_sent_at: previousStamp,
        chat_reminder_last_sent_by: tournament!.chat_reminder_last_sent_by,
        chat_reminder_last_sent_count: tournament!.chat_reminder_last_sent_count,
      })
      .eq('id', tournamentId)
      .eq('chat_reminder_last_sent_at', claimedAtIso); // only if the claim is still ours
    if (error) console.error('[chat/remind-signups] cooldown release failed:', error.message);
  }

  // "Not yet joined" teams (no coach with a completed login) — the same set the panel shows.
  let pending;
  try {
    ({ pending } = await resolveTournamentChatParticipants(tournamentId));
  } catch (err) {
    console.error('[chat/remind-signups] participant resolve failed:', err);
    await releaseClaim();
    return json({ error: 'Could not work out which teams to remind. Please try again.' }, 500);
  }

  const remindable = pending.filter(p => (p.email ?? '').trim() !== '');
  const skippedNoEmail = pending.length - remindable.length;
  const targets = remindable.slice(0, MAX_REMINDERS);
  const skippedOverCap = remindable.length - targets.length;

  if (targets.length === 0) {
    await releaseClaim();
    return json({ ok: true, sent: 0, failed: 0, skippedNoEmail, skippedOverCap, notJoined: pending.length, reminderLastSentAt: previousStamp });
  }

  // Trusted base URL for the emailed access links — only our own hosts are honored from the
  // request Origin; an attacker host falls back to the canonical URL. See resolveTrustedAppOrigin.
  const origin = resolveTrustedAppOrigin(req);
  const loginUrl = `${origin}/auth/login?next=${encodeURIComponent('/coaches/tournaments')}`;

  const results = await Promise.allSettled(targets.map(async (team) => {
    const email = (team.email ?? '').trim().toLowerCase();
    const joinUrl = `${origin}/coaches/join?registrationId=${encodeURIComponent(team.teamId)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent('/coaches/tournaments')}`;
    return sendEmail(
      email,
      `Your FieldLogicHQ registration dashboard — ${team.teamName}`,
      coachAccessReminderHtml({
        teamName: team.teamName,
        coachName: team.coachName ?? '',
        tournamentName: tournament.name,
        joinUrl,
        loginUrl,
        // This batch exists to fill the chat room — say so. The single-team resend path leaves
        // this off, since it runs on events that may have no chat.
        mentionsChat: true,
      }),
    );
  }));

  // Count DELIVERIES, not settled promises. sendEmail() resolves for a dead API key
  // ('skipped') and for a Resend rejection ('provider_error') — counting `fulfilled` would report
  // "sent to 40 teams" and arm a 24h lockout on a batch that reached nobody.
  const sent = results.filter(r => r.status === 'fulfilled' && r.value.status === 'sent').length;
  const failed = results.length - sent;
  if (failed > 0) {
    console.error(`[chat/remind-signups] ${failed}/${results.length} reminder emails failed for tournament ${tournamentId}`);
  }

  // S1-B — finish the audit record on the window already claimed above. If nothing was actually
  // delivered, hand the window back rather than locking the organizer out for a day over a
  // provider outage.
  let reminderLastSentAt: string | null = claimedAtIso;
  if (sent === 0) {
    await releaseClaim();
    reminderLastSentAt = previousStamp;
  } else {
    const { error: stampError } = await supabaseAdmin
      .from('tournaments')
      .update({ chat_reminder_last_sent_count: sent })
      .eq('id', tournamentId)
      .eq('chat_reminder_last_sent_at', claimedAtIso);
    // The cooldown is already armed by the claim; only the count is at stake here.
    if (stampError) console.error('[chat/remind-signups] reminder count write failed:', stampError.message);
  }

  return json({
    ok: true,
    sent,
    failed,
    skippedNoEmail,
    skippedOverCap,
    notJoined: pending.length,
    reminderLastSentAt,
  });
}, { route: '/api/admin/tournaments/[tournamentId]/chat/remind-signups' });
