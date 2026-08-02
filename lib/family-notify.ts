import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { getFamilySuppressionList, sendFamilyEmail } from './family-email';
import { formatInOrgZone } from './timezone';
import { isVisibleToFamilies } from './family-access';

/**
 * lib/family-notify.ts — telling connected families when their team's plan changes.
 *
 * IN-APP + EMAIL ONLY. No push. The Android/prod VAPID delivery runbook is still open
 * (discovery G9) and there is no owner-verified delivery on record, so a family cannot be
 * promised a push notification yet. This is a deliberate hole, not an oversight — when the
 * runbook passes, the event type joins the push defaults and nothing else here changes.
 *
 * The email half goes through `lib/family-email.ts` rather than `notify()`'s email channel:
 * family email must honour the per-family opt-out list and must carry a working unsubscribe,
 * and `notify()` knows about neither because its email channel was built for staff. That
 * module is the single choke point where both rules live, so no sender has to remember them.
 *
 * Fire-and-forget: never throws. A notification failure must not roll back a coach's
 * schedule edit.
 */

export type FamilyGameUpdateKind = 'schedule_change' | 'final_score' | 'cancelled' | 'reinstated';

interface EventFacts {
  id: string;
  teamId: string;
  orgId: string;
  eventType: string;
  name: string;
  startsAt: string;
  location: string | null;
  opponent: string | null;
  homeAway: string | null;
  teamScore: number | null;
  opponentScore: number | null;
  result: string | null;
  status: string;
}

function describe(event: EventFacts, teamName: string, kind: FamilyGameUpdateKind): { title: string; body: string } {
  const opponent = event.opponent ? `${event.homeAway === 'away' ? 'at' : 'vs'} ${event.opponent}` : event.name;
  const when = formatInOrgZone(event.startsAt, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  if (kind === 'final_score') {
    const outcome = event.result === 'win' ? 'Won' : event.result === 'loss' ? 'Lost' : 'Tied';
    return {
      title: `${teamName} — final score`,
      body: `${outcome} ${event.teamScore}–${event.opponentScore} ${opponent}.`,
    };
  }
  const noun = event.eventType === 'practice' ? 'practice' : 'game';
  if (kind === 'cancelled') {
    return {
      title: `${teamName} — ${opponent} cancelled`,
      body: `The ${when} ${noun} has been cancelled.`,
    };
  }
  // A family told a game was off must be told when it is back on — otherwise the last thing
  // they heard remains wrong and they don't turn up.
  if (kind === 'reinstated') {
    return {
      title: `${teamName} — ${opponent} is back on`,
      body: `The ${noun} is going ahead ${when}${event.location ? ` at ${event.location}` : ''}.`,
    };
  }
  return {
    title: `${teamName} — schedule change`,
    body: `${opponent} is now ${when}${event.location ? ` at ${event.location}` : ''}.`,
  };
}

/**
 * Tell this team's connected families that something moved.
 *
 * Silent by design when the team's schedule is closed to `staff`: if a family cannot open
 * the schedule, telling them it changed is a notification that leads nowhere.
 */
export async function notifyFamiliesOfGameUpdate(params: {
  eventId: string;
  kind: FamilyGameUpdateKind;
  /** The coach who made the change — never notified about their own action. */
  actorUserId?: string;
}): Promise<void> {
  try {
    const { data: eventRow } = await supabaseAdmin
      .from('rep_team_events')
      .select('id, team_id, org_id, event_type, name, starts_at, location, opponent, home_away, team_score, opponent_score, result, status')
      .eq('id', params.eventId)
      .maybeSingle();
    if (!eventRow) return;

    const row = eventRow as Record<string, unknown>;
    const event: EventFacts = {
      id: row.id as string,
      teamId: row.team_id as string,
      orgId: row.org_id as string,
      eventType: row.event_type as string,
      name: row.name as string,
      startsAt: row.starts_at as string,
      location: (row.location as string) ?? null,
      opponent: (row.opponent as string) ?? null,
      homeAway: (row.home_away as string) ?? null,
      teamScore: (row.team_score as number) ?? null,
      opponentScore: (row.opponent_score as number) ?? null,
      result: (row.result as string) ?? null,
      status: (row.status as string) ?? 'scheduled',
    };

    const { data: teamRow } = await supabaseAdmin
      .from('rep_teams')
      .select('id, name, schedule_visibility')
      .eq('id', event.teamId)
      .maybeSingle();
    if (!teamRow) return;
    const team = teamRow as { name: string; schedule_visibility: string | null };
    if (!isVisibleToFamilies(team.schedule_visibility)) return;

    const { data: orgRow } = await supabaseAdmin
      .from('organizations')
      .select('name, slug')
      .eq('id', event.orgId)
      .maybeSingle();
    const org = (orgRow as { name: string; slug: string } | null) ?? { name: 'Your team', slug: '' };

    // Verified links only. A pending, declined or revoked family is not a recipient — the
    // same rule that governs whether they can read the schedule governs whether we mail
    // them about it.
    const { data: linkRows } = await supabaseAdmin
      .from('family_links')
      .select('user_id, invited_email')
      .eq('rep_team_id', event.teamId)
      .eq('status', 'verified');
    const links = (linkRows ?? []) as { user_id: string | null; invited_email: string }[];
    if (links.length === 0) return;

    const { title, body } = describe(event, team.name, params.kind);
    const link = `/family/teams/${event.teamId}`;

    // ── In-app (bell). Push is deliberately not in this event's defaults. ──
    const userIds = links
      .map(l => l.user_id)
      .filter((id): id is string => !!id && id !== params.actorUserId);
    if (userIds.length > 0) {
      await notify({
        orgId: event.orgId,
        eventType: 'family_game_update',
        title,
        body,
        link,
        userIds,
      });
    }

    // ── Email, through the one guarded sender. ──
    // The opt-out list is loaded ONCE and handed to each send, so the guard runs per
    // recipient without a query per recipient. Honest limit: because the set is a snapshot,
    // someone who unsubscribes DURING this loop can still receive this one message. The
    // window is seconds and the alternative is a database round-trip per recipient on a path
    // that already runs inside a coach's save; a same-second opt-out arriving one message
    // late is the right side of that trade.
    const suppressed = await getFamilySuppressionList(event.orgId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const recipients = Array.from(new Set(links.map(l => l.invited_email).filter(Boolean)));

    // Sent in bounded parallel, NOT one at a time. This dispatcher runs inside the coach's
    // "save score" request (awaited, because this host has no reliable after-response hook),
    // so a team at the follower ceiling would otherwise add fifty sequential provider
    // round-trips to a button press — long enough to look hung and be retried. Eight at a
    // time keeps a full team under a second or two without hammering the provider.
    const SEND_CONCURRENCY = 8;
    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
      await Promise.allSettled(
        recipients.slice(i, i + SEND_CONCURRENCY).map(email =>
          sendFamilyEmail({
            orgId: event.orgId,
            to: email,
            subject: title,
            suppressed,
            content: {
              teamName: team.name,
              orgName: org.name,
              title,
              body,
              cta: { href: `${appUrl}${link}`, label: 'See the full schedule →' },
              reason: `you follow ${team.name}`,
            },
          }).catch(err => {
            console.error('[family-notify] one recipient failed:', err);
          }),
        ),
      );
    }
  } catch (err) {
    // Never let a notification break the coach's edit.
    console.error('[family-notify] game update dispatch failed:', err);
  }
}
