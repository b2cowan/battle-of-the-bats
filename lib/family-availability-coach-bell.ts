import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { listActiveStaffForTeams, resolveMembershipCapabilities } from './coach-membership';
import { sheetAddressFor } from './coach-schedule-sheet';
import { playerFirstName } from './coach-roster-name';
import { firstNames, type FamilyAnswerChange } from './family-availability';
import { scheduleHeadcounts } from './family-availability-coach';
import {
  COACH_BELL_BUNDLE_MS, coachBellFires, mergeCoachBell, type CoachBellBundle, type CoachBellItem,
} from './family-availability-rules';
import { FAMILY_AVAILABILITY_COACH_WORDS as FW, coachBellEventLabel, coachBellWords, type AnswerStatus } from './family-availability-words';
import { scheduleDayLabel } from './family-schedule-format';

/** Bell lines filed on DEV before One attendance record S2 hold the old family vocabulary ('in' | 'out'); a fold into one would read
 *  "changed to undefined". Map them to the record's words as the line is read (dev only: nothing of the old kind ever reached prod). Delete this shim once no unread dev line from before 2026-11-14 can remain
 *  (a line folds only within the hour, so any time after that day's dev bell has been read or cleared). */
const OLD_ANSWER_WORD: Record<string, AnswerStatus> = { in: 'attending', out: 'absent' };
const currentAnswer = (a: AnswerStatus | null): AnswerStatus | null => (a && Object.hasOwn(OLD_ANSWER_WORD, a) ? OLD_ANSWER_WORD[a] : a);
const withCurrentAnswerWords = (bundle: CoachBellBundle): CoachBellBundle =>
  ({ ...bundle, items: bundle.items.map(i => ({ ...i, answer: currentAnswer(i.answer), prior: currentAnswer(i.prior) })) });

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "FAMILY ANSWERS" — THE COACH'S BELL (Signed-in family accounts Stage 4b, Session 3, Part 8; ask 12; drawing tab 6).
 *
 *   notifyCoachesOfFamilyAnswer(...)   called by the parent's save route after a successful write
 *
 * ⚠ WHEN: a family's Out at any time, an Out taken back at any time (owner, Session 4), or any change (a cleared answer too)
 *   inside the 48 hours before the event (`coachBellFires`). Never a first In, Late or Maybe, never a note-only re-send.
 * ⚠ TO WHOM: the team's coaches who can mark attendance (the `attendance` capability; head coach and assistants by default),
 *   never the parent who answered (a coach who is also a parent). Bell only: the kind's defaults are bell on, email off, push off
 *   (it is not in the push defaults, and `notify()` emails staff only for payment failures), and each coach's own Account →
 *   Notifications choice is honoured by `notify()`.
 * ⚠ NEVER THE NOTE'S WORDS: "left a note" only. A note can hold health or family details; it stays in the attendance room.
 * ⚠ BUNDLING (the choice recorded in the build prompt's Progress block): an answer inside the hour UPDATES the coach's existing
 *   unread line for the same event (one line per event) or for the same family across events (one line per family), instead of
 *   adding a line; no queue, no job. The bell's live badge listens for new rows only, so a folded line shows its new words on the
 *   next open of the bell (it is already unread). A line is folded only while unread: once read, the next answer starts a new one.
 * ⚠ Never throws: a bell that fails must not fail the parent's save.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const KIND = 'family_availability_response';

interface EventRow {
  id: string; org_id: string; program_year_id: string; event_type: string; status: string; starts_at: string;
  name: string; opponent: string | null; home_away: string | null;
}

export async function notifyCoachesOfFamilyAnswer(params: {
  teamId: string;
  eventId: string;
  childId: string;
  /** The parent who answered: named on the line by first name, never notified themselves. */
  actorUserId: string;
  change: FamilyAnswerChange;
  now?: Date;
}): Promise<void> {
  try {
    const now = params.now ?? new Date();
    // The common answer (a first In or Maybe) can never ring: decided before any read.
    if (!coachBellFires(params.change.prior, params.change.next, params.change.startsAt, now)) return;

    const [evRead, staff] = await Promise.all([
      supabaseAdmin.from('rep_team_events')
        .select('id, org_id, program_year_id, event_type, status, starts_at, name, opponent, home_away').eq('id', params.eventId).maybeSingle(),
      listActiveStaffForTeams([params.teamId]),
    ]);
    if (evRead.error) throw evRead.error;
    const event = evRead.data as EventRow | null;
    if (!event) return;
    const coachIds = [...new Set(staff
      .filter(m => m.userId !== params.actorUserId && resolveMembershipCapabilities(m).attendance)
      .map(m => m.userId))];
    // ⚠ Never an empty list: notify() reads an empty list as "everyone in the org".
    if (coachIds.length === 0) return;

    const [player, org, parentNames, counts] = await Promise.all([
      supabaseAdmin.from('rep_roster_players').select('id, player_first_name, player_last_name')
        .eq('program_year_id', event.program_year_id).eq('child_id', params.childId).eq('status', 'active').maybeSingle(),
      supabaseAdmin.from('organizations').select('slug').eq('id', event.org_id).maybeSingle(),
      firstNames([params.actorUserId]),
      scheduleHeadcounts({ teamId: params.teamId, programYearId: event.program_year_id, events: [{
        id: event.id, eventType: event.event_type, status: event.status, startsAt: event.starts_at,
      }], now }),
    ]);
    if (player.error) throw player.error;
    if (org.error) throw org.error;
    const playerRow = player.data as { id: string; player_first_name: string | null; player_last_name: string | null } | null;
    const slug = (org.data as { slug: string } | null)?.slug;
    if (!playerRow || !slug) return;

    // One attendance record (mig 483): the family's answer IS the player's attendance, so no coach mark is left saying something else.
    const count = counts?.[event.id] ? FW.headcount(counts[event.id]) : null;

    const item: CoachBellItem = {
      eventId: event.id,
      eventLabel: coachBellEventLabel({
        startsAt: event.starts_at, eventType: event.event_type, name: event.name, opponent: event.opponent, homeAway: event.home_away,
      }),
      eventDay: scheduleDayLabel(event.starts_at),
      childId: params.childId,
      child: playerFirstName({ playerFirstName: playerRow.player_first_name ?? '', playerLastName: playerRow.player_last_name ?? '' }, 'A player'),
      answer: params.change.next,
      prior: params.change.prior,
      parent: parentNames.get(params.actorUserId) ?? null,
      hasNote: params.change.hasNote,
      count,
    };
    const base = `/${slug}/coaches/teams/${params.teamId}`;
    const linkFor = (b: CoachBellBundle) =>
      b.kind === 'family' && b.items.length > 1 ? `${base}/schedule` : sheetAddressFor(base, b.items[b.items.length - 1].eventId, 'attendance');

    // Each coach's unread lines of this kind from the last hour, for this team: fold into one, or start a new one.
    const since = new Date(now.getTime() - COACH_BELL_BUNDLE_MS).toISOString();
    const { data: openRows, error: openError } = await supabaseAdmin.from('notifications')
      // Keyed by club AND kind (lib/db.ts's dedupe shape): this kind is only ever filed on the club's bell, never a free coach's.
      .select('id, user_id, metadata, created_at').eq('org_id', event.org_id).eq('event_type', KIND).in('user_id', coachIds)
      .is('read_at', null).is('cleared_at', null).gte('created_at', since);
    if (openError) throw openError;
    const openByCoach = new Map<string, { id: string; bundle: CoachBellBundle }[]>();
    const stampOf = new Map<string, string>();
    for (const r of (openRows ?? []) as { id: string; user_id: string; metadata: { bundle?: CoachBellBundle } | null; created_at: string }[]) {
      if (!r.metadata?.bundle) continue;
      stampOf.set(r.id, r.created_at);
      const list = openByCoach.get(r.user_id) ?? [];
      list.push({ id: r.id, bundle: withCurrentAnswerWords(r.metadata.bundle) });
      openByCoach.set(r.user_id, list);
    }

    const fresh: string[] = [];
    // Every coach without a line to fold into gets the same new line.
    const freshBundle: CoachBellBundle = { kind: 'event', teamId: params.teamId, items: [item] };
    await Promise.all(coachIds.map(async coachId => {
      const merged = mergeCoachBell(openByCoach.get(coachId) ?? [], item, params.teamId);
      if (!merged.id) { fresh.push(coachId); return; }
      const words = coachBellWords(merged.bundle);
      // Fold only the line exactly as it was read (still unread, not cleared, same stamp): a coach who opened it, or another answer
      // that folded first, makes this match nothing, and this answer then gets a line of its own rather than being lost.
      const { data: folded, error } = await supabaseAdmin.from('notifications').update({
        title: words.title, body: words.body, link: linkFor(merged.bundle),
        // The rows are re-written with the title and body (Notifications read at a glance, Stage 3): never stale rows under a fresh title.
        metadata: { teamId: params.teamId, eventId: item.eventId, bundle: merged.bundle, facts: words.facts },
        created_at: now.toISOString(),
      }).eq('id', merged.id).eq('user_id', coachId).eq('created_at', stampOf.get(merged.id)!)
        .is('read_at', null).is('cleared_at', null).select('id');
      if (error) console.error('[family-coach-bell] a line could not be folded:', error.message);
      if (error || !folded?.length) fresh.push(coachId);
    }));

    if (fresh.length > 0) {
      const words = coachBellWords(freshBundle);
      await notify({
        orgId: event.org_id, eventType: KIND, title: words.title, body: words.body, link: linkFor(freshBundle),
        userIds: fresh, metadata: { teamId: params.teamId, eventId: item.eventId, bundle: freshBundle, facts: words.facts },
      });
    }
  } catch (err) {
    console.error('[family-coach-bell] the coach bell failed:', err instanceof Error ? err.message : String(err));
  }
}
