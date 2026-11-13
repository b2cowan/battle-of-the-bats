import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { getFamilySuppressionList, sendFamilyEmail } from './family-email';
import { inParallel } from './supabase-paging';
import { readClubEmailOrg, systemMailFace } from './club-email-context';
import { normalizeGuardianEmail } from './guardian-email';
import { playerFirstName } from './coach-roster-name';
import { coachFamilyAnswersSetting, lastRemindedAt, type KnownRepTeam } from './family-availability-coach';
import { familyAnswerState, remindAgainAt, remindPlan } from './family-availability-rules';
import { FAMILY_REMINDER_WORDS as RW, reminderEventLabel, clockOf } from './family-availability-words';
import { scheduleDayLabel } from './family-schedule-format';
import { orgDayKey, zonedWallClockToUtc } from './timezone';
import type { RepAttendanceStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "FAMILIES SAY IF THEY'RE COMING" — REMIND (Signed-in family accounts Stage 4b, Session 3, Part 7; ask 2; drawing tab 4).
 *
 *   remindPreview(...)  what the coach's confirm shows: which players, how many parents, how many get the app note only, who
 *                       is not reminded and why, when Remind was last used, and a sample of the email
 *   sendRemind(...)     the send: re-derives everything, claims the event's 24-hour slot, then a bell and an email per parent
 *
 * ⚠ WHO (ask 2, `remindPlan`): connected parents (a verified link WITH an account) of players with no family answer AND "Not
 *   marked" in the coach's book, on an event that is open (not started, not cancelled, covered by the switch). Never an address
 *   that has not joined; never the sign-up's addresses. The email goes to the connected ACCOUNT's own address.
 * ⚠ THE ONE FAMILY DOOR: every email goes through `sendFamilyEmail`, which reads the club's unsubscribe list and FAILS CLOSED (a
 *   list that cannot be read throws, and nothing is sent). A parent on that list gets the bell only. The Stage 3b stop list is
 *   never read here (a stop ends the parent's link, so they are not a recipient at all).
 * ⚠ IT CANNOT ANSWER ANYTHING: the email and the bell open the SIGNED-IN team page at the event (`?event=`); no token, no answer
 *   in a link, no address in a link.
 * ⚠ ONCE PER EVENT PER 24 HOURS for the whole staff: the database's claim (`event_availability_remind_claim`) is taken BEFORE
 *   the send so two coaches pressing at once cannot both send. The emails go first and the bells after: a send where every email
 *   plainly failed gives the slot back BEFORE any bell, so nobody is touched and a retry cannot bell a parent twice.
 * ⚠ The report is COUNTS (parents reached, app-only) and the players' names, never who received what, never an address.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

interface EventRow {
  id: string; team_id: string; org_id: string; program_year_id: string; event_type: string; status: string; starts_at: string;
  name: string; opponent: string | null; home_away: string | null; location: string | null;
}

/** One parent to reach, and the children of theirs this reminder is about. `appOnly`: no address, or on the club's unsubscribe
 *  list. `capped`: already had a reminder EMAIL from this team today (owner, Session 4: one per parent per day; the app note still
 *  goes). */
interface Recipient { userId: string; email: string | null; appOnly: boolean; capped: boolean; children: string[] }

interface Gathered {
  event: EventRow;
  teamName: string;
  orgName: string;
  /** The club's row, for the email's face (read once here, reused by the send). */
  org: Awaited<ReturnType<typeof readClubEmailOrg>>;
  /** The club's unsubscribe list (empty when nobody is reminded). */
  suppressed: Set<string>;
  /** First names, in roster order. */
  remind: string[];
  marked: string[];
  noParent: string[];
  recipients: Recipient[];
  /** How many of the recipients get the app note only because of their address (none, or unsubscribed). */
  appOnly: number;
  /** How many get the app note only because they already had a reminder email from this team today (the daily cap). */
  capped: number;
  remindedAt: string | null;
}

export type RemindRefusal = 'not_found' | 'closed' | 'nobody' | 'too_soon';

function firstNameOfPlayer(p: { player_first_name: string | null; player_last_name: string | null }): string {
  return playerFirstName({ playerFirstName: p.player_first_name ?? '', playerLastName: p.player_last_name ?? '' });
}

async function gather(params: {
  teamId: string; programYearId: string; eventId: string; team?: KnownRepTeam; now: Date;
}): Promise<Gathered | { refused: RemindRefusal; remindedAt?: string | null }> {
  const setting = await coachFamilyAnswersSetting(params.teamId, params.team);
  if (!setting) return { refused: 'not_found' };
  const { data: ev, error: evError } = await supabaseAdmin.from('rep_team_events')
    .select('id, team_id, org_id, program_year_id, event_type, status, starts_at, name, opponent, home_away, location')
    .eq('id', params.eventId).maybeSingle();
  if (evError) throw evError;
  const event = ev as EventRow | null;
  if (!event || event.team_id !== params.teamId || event.program_year_id !== params.programYearId) return { refused: 'not_found' };
  const state = familyAnswerState(setting, { eventType: event.event_type, status: event.status, startsAt: event.starts_at }, params.now);
  if (state === 'not_covered') return { refused: 'not_found' };
  if (state !== 'open') return { refused: 'closed' };

  const [roster, teamName, org, book, answers, last] = await Promise.all([
    supabaseAdmin.from('rep_roster_players').select('id, child_id, player_first_name, player_last_name')
      .eq('program_year_id', params.programYearId).eq('status', 'active').order('player_last_name').order('player_first_name'),
    // The routes pass the team they already hold; a caller without it reads the name.
    params.team?.name ?? supabaseAdmin.from('rep_teams').select('name').eq('id', params.teamId).maybeSingle()
      .then(r => { if (r.error) throw r.error; return (r.data as { name: string } | null)?.name ?? null; }),
    readClubEmailOrg(event.org_id),
    supabaseAdmin.from('rep_team_event_attendance').select('player_id, status').eq('event_id', event.id),
    supabaseAdmin.from('event_availability_answers').select('child_id').eq('event_kind', 'rep_event').eq('event_id', event.id),
    lastRemindedAt(event.id),
  ]);
  for (const r of [roster, book, answers]) if (r.error) throw r.error;
  const players = (roster.data ?? []) as { id: string; child_id: string; player_first_name: string | null; player_last_name: string | null }[];
  const childIds = players.map(p => p.child_id);
  const { data: linkData, error: linkError } = childIds.length
    ? await supabaseAdmin.from('family_links').select('child_id, user_id')
      .in('child_id', childIds).eq('status', 'verified').not('user_id', 'is', null)
    : { data: [], error: null };
  if (linkError) throw linkError;
  const links = (linkData ?? []) as { child_id: string; user_id: string }[];

  const status = new Map(((book.data ?? []) as { player_id: string; status: RepAttendanceStatus }[]).map(b => [b.player_id, b.status]));
  const answered = new Set(((answers.data ?? []) as { child_id: string }[]).map(a => a.child_id));
  const connected = new Set(links.map(l => l.child_id));
  const plan = remindPlan(players.map(p => ({
    playerId: p.id, status: status.get(p.id) ?? 'unknown', answered: answered.has(p.child_id), connected: connected.has(p.child_id),
  })));
  const byId = new Map(players.map(p => [p.id, p]));
  const nameOf = (id: string) => firstNameOfPlayer(byId.get(id)!);

  // One recipient per parent ACCOUNT, naming every child of theirs being reminded (two children on the team = one email).
  const remindChildren = new Map(plan.remind.map(id => [byId.get(id)!.child_id, nameOf(id)]));
  const childrenOf = new Map<string, string[]>();
  for (const l of links) {
    const child = remindChildren.get(l.child_id);
    if (!child) continue;
    const list = childrenOf.get(l.user_id) ?? [];
    if (!list.includes(child)) list.push(child);
    childrenOf.set(l.user_id, list);
  }
  // The account's OWN address (never the invited address). Fails closed: an unreadable unsubscribe list throws here.
  const suppressed = childrenOf.size ? await getFamilySuppressionList(event.org_id) : new Set<string>();
  const recipients: Recipient[] = await inParallel([...childrenOf], 8, async ([userId, children]) => {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    // A lookup that failed is not "no address": it must not be reported to the coach as "app note only".
    if (error) throw error;
    const email = normalizeGuardianEmail(data?.user?.email ?? null);
    return { userId, email, appOnly: !email || suppressed.has(email), capped: false, children };
  });
  const emailedToday = await remindEmailedToday(recipients.filter(r => !r.appOnly).map(r => r.userId), params.teamId, params.now);
  for (const r of recipients) r.capped = !r.appOnly && emailedToday.has(r.userId);

  return {
    event,
    teamName: teamName ?? 'Your team',
    orgName: org.name,
    org,
    suppressed,
    remind: plan.remind.map(nameOf),
    marked: plan.marked.map(nameOf),
    noParent: plan.noParent.map(nameOf),
    recipients,
    appOnly: recipients.filter(r => r.appOnly).length,
    capped: recipients.filter(r => r.capped).length,
    remindedAt: last,
  };
}

/**
 * The daily cap (owner, Session 4; /legal): which of these parents already had a reminder EMAIL from this team today (the org's
 * day). Read from their own reminder bell lines, which say whether the email went (`metadata.emailed`); a parent whose bell is
 * off or who deleted the line is not seen, so the cap can only err toward one more email, never toward a missed reminder.
 */
async function remindEmailedToday(userIds: readonly string[], teamId: string, now: Date): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const dayStart = zonedWallClockToUtc(orgDayKey(now.toISOString()), '00:00');
  if (!dayStart) return new Set();
  const { data, error } = await supabaseAdmin.from('notifications').select('user_id')
    .eq('event_type', 'family_availability_reminder').in('user_id', [...userIds]).gte('created_at', dayStart)
    .eq('metadata->>teamId', teamId).eq('metadata->>emailed', 'true');
  if (error) throw error;
  return new Set(((data ?? []) as { user_id: string }[]).map(r => r.user_id));
}

/** The email and bell one parent gets (the same words the confirm's sample shows). */
function messageFor(g: Gathered, children: readonly string[]) {
  const label = reminderEventLabel({
    teamName: g.teamName, eventType: g.event.event_type, name: g.event.name, opponent: g.event.opponent, homeAway: g.event.home_away,
  });
  const date = scheduleDayLabel(g.event.starts_at);
  return {
    label, date,
    subject: RW.subject(label, date, children.length),
    title: RW.title(children),
    body: RW.body({ label, date, clock: clockOf(g.event.starts_at), place: g.event.location, children }),
    bellTitle: RW.bellTitle(children, date),
    bellBody: RW.bellBody(label),
  };
}

/** The team page at this event, signed in (a sign-in is asked for if needed). No token, no answer, no address. */
const teamPagePath = (teamId: string, eventId: string) => `/family/teams/${teamId}?event=${eventId}`;

export interface RemindPreview {
  /** The players whose parents are reminded (named in the confirm; owner, Session 4: name players, count parents). */
  players: string[];
  parents: number;
  appOnly: number;
  /** Parents who get the app note only because of the daily cap. */
  capped: number;
  marked: string[];
  noParent: string[];
  remindedAt: string | null;
  /** When Remind is offered again (null = now). */
  againAt: string | null;
  isPractice: boolean;
  label: string;
  date: string;
  clubName: string;
  /** The first family's email as it would be sent, for "See what they'll get". */
  sample: { subject: string; title: string; body: string; button: string } | null;
}

/** The confirm (tab 4, frame 1). Refused while nothing about answers exists, or the event is not open. */
export async function remindPreview(params: {
  teamId: string; programYearId: string; eventId: string; team?: KnownRepTeam; now?: Date;
}): Promise<RemindPreview | { refused: RemindRefusal }> {
  const now = params.now ?? new Date();
  const g = await gather({ ...params, now });
  if ('refused' in g) return { refused: g.refused };
  const againAt = g.remindedAt && Date.parse(remindAgainAt(g.remindedAt)) > now.getTime() ? remindAgainAt(g.remindedAt) : null;
  const first = g.recipients[0];
  const m = messageFor(g, first?.children ?? g.remind.slice(0, 1));
  return {
    players: g.remind,
    parents: g.recipients.length,
    appOnly: g.appOnly,
    capped: g.capped,
    marked: g.marked,
    noParent: g.noParent,
    remindedAt: g.remindedAt,
    againAt,
    isPractice: g.event.event_type === 'practice',
    label: m.label,
    date: m.date,
    clubName: g.orgName || g.teamName,
    sample: first ? { subject: m.subject, title: m.title, body: m.body, button: RW.button } : null,
  };
}

/** `parents` = every parent reached (each gets the app note); `appOnly` = of those, how many got NO email (turned off, no address,
 *  or the email did not go out), so the report counts what reached them, not what was attempted (owner, Session 4). */
export interface RemindReport { remindedAt: string; players: string[]; parents: number; appOnly: number }

/**
 * Send it (tab 4, frame 2). Re-derives everything from the database (never from the client's list), claims the event's 24-hour
 * slot, then per parent: a bell (no push) and, unless they turned off the club's emails, one email through the family door.
 */
export async function sendRemind(params: {
  teamId: string; programYearId: string; eventId: string; actorUserId: string; team?: KnownRepTeam; now?: Date;
}): Promise<{ ok: true; report: RemindReport } | { ok: false; refused: RemindRefusal | 'send_failed'; remindedAt?: string | null }> {
  const now = params.now ?? new Date();
  const g = await gather({ ...params, now });
  if ('refused' in g) return { ok: false, refused: g.refused };
  if (g.recipients.length === 0) return { ok: false, refused: 'nobody' };

  const { data: claimData, error: claimError } = await supabaseAdmin.rpc('event_availability_remind_claim', {
    p_kind: 'rep_event', p_event: g.event.id, p_by: params.actorUserId,
  });
  if (claimError) throw claimError;
  const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as { claimed: boolean; reminder_id: string | null; reminded_at: string } | null;
  if (!claim?.claimed || !claim.reminder_id) return { ok: false, refused: 'too_soon', remindedAt: claim?.reminded_at ?? null };

  const release = async () => {
    const { error } = await supabaseAdmin.from('event_availability_reminders').delete().eq('id', claim.reminder_id!);
    if (error) console.error('[family-remind] the 24-hour slot could not be given back:', error.message);
  };

  let emailsTried = 0;
  let emailsFailed = 0;
  /** The parents an email actually went to (their bell line says so; the next reminder today reads it for the cap). */
  const emailed = new Set<string>();
  try {
    const face = await systemMailFace(g.org);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const link = teamPagePath(params.teamId, g.event.id);

    // The emails FIRST, the bells after: when every email plainly failed the slot is given back and nobody has been touched, so a
    // retry cannot bell the same parents twice.
    await inParallel(g.recipients, 8, async r => {
      if (r.appOnly || r.capped || !r.email) return;
      const m = messageFor(g, r.children);
      emailsTried++;
      const result = await sendFamilyEmail({
        kind: 'family_availability_reminder',
        orgId: g.event.org_id,
        to: r.email,
        subject: m.subject,
        suppressed: g.suppressed,
        content: {
          teamName: g.teamName,
          orgName: g.orgName || null,
          title: m.title,
          body: m.body,
          cta: { href: `${appUrl}${link}`, label: RW.button },
          reason: RW.reason(r.children, g.teamName),
          club: face?.club,
          replyLine: face?.replyLine,
        },
        replyTo: face?.replyTo,
      }).catch(err => {
        console.error('[family-remind] one email failed:', err instanceof Error ? err.message : String(err));
        return { status: 'provider_error' as const };
      });
      if (result.status === 'provider_error') emailsFailed++;
      if (result.status === 'sent' || result.status === 'no_answer') emailed.add(r.userId);
    });

    // Only a plain failure of EVERY email gives the slot back ("skipped" and "no answer" may yet have gone out).
    if (emailsTried > 0 && emailsFailed === emailsTried) {
      await release();
      return { ok: false, refused: 'send_failed' };
    }

    // The bell (no push: `family_availability_reminder` is not in the push defaults). notify() never throws.
    await inParallel(g.recipients, 8, r => {
      const m = messageFor(g, r.children);
      return notify({
        orgId: g.event.org_id, eventType: 'family_availability_reminder', title: m.bellTitle, body: m.bellBody, link,
        userIds: [r.userId], metadata: { teamId: params.teamId, eventId: g.event.id, emailed: emailed.has(r.userId) },
      });
    });
  } catch (err) {
    await release();
    throw err;
  }

  // The log keeps what was PLANNED (`families` = players reminded, `parents`, `app_only` = no email by choice or no address); the
  // coach's report counts what reached them (every parent minus those an email went to), so it can read higher.
  const { error: countError } = await supabaseAdmin.from('event_availability_reminders')
    .update({ families: g.remind.length, parents: g.recipients.length, app_only: g.appOnly }).eq('id', claim.reminder_id);
  if (countError) console.error('[family-remind] the counts were not recorded:', countError.message);

  // What REACHED them: every parent got the app note; those with no email that went out are the app-only count.
  return { ok: true, report: { remindedAt: claim.reminded_at, players: g.remind, parents: g.recipients.length, appOnly: g.recipients.length - emailed.size } };
}
