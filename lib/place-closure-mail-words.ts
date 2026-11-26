import { warmEmailDocument } from './email-envelope-warm';
import { MAIL } from './club-group-email-words';
import { closedPlaceName, isAre, type ClosureScope } from './place-closures';
import { formatShortWeekdayDate, orgDayKey } from './timezone';
import { closeClock } from './place-closure-window';
import { joinWithAnd } from './utils';
import { ROLE_EMAIL_LABEL } from './member-access';
import type { OrgRole } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE REP COACH'S EMAIL (Club Website Stage 2, K10; the drawing's tab 7; /legal's review
 * docs/agents/legal/CLUB_WEBSITE_STAGE2_CLOSE_A_PLACE_REVIEW.md; words settled by /marketing, plan §10). Pure: the sender
 * renders through it and the guard reads it.
 *
 * ⚖ /legal's fixed skeleton, and nothing else: who sent it (the admin, their role, the club), why this coach got it, how to
 *   reach the sender, and how to say it isn't right for them, in the shipped group-email lines (`MAIL`). From "{Club} via
 *   FieldLogicHQ", reply-to the admin. FIXED WORDS: no admin free text, no link, no button, no offer, no player, no
 *   unsubscribe (a service message to the club's own coach; Privacy §12). Structurally it cannot carry a link: nothing here
 *   writes an anchor and every word is escaped.
 * ⚖ One email per marked team: two games for one team are one email listing both. Reopen's is the same email with one line.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface CoachMailClosure { scope: ClosureScope; placeName: string | null; facilityName: string | null; firstDay: string; lastDay: string }
export interface CoachMailGame {
  startsAt: string; opponent: string | null; closure: CoachMailClosure;
  /** D1 (mig 549): a game at the park with no diamond, marked by two or more of its diamonds, is ONE game named by its
   *  park when closed: "2 diamonds at Lions Park". Absent: the closure's place. (Reopen's words are `reopenPark`'s.) */
  placeWords?: string;
  /** D1, Reopen of the LAST of a park's diamonds over a game with no diamond: the park, said without a count (/legal
   *  2026-11-26: "Diamonds at Lions Park reopened", "reopened the diamonds at Lions Park that were closed" — never "Lions
   *  Park reopened", which overstates, nor a count a later press could contradict). */
  reopenPark?: string;
}

const placeOf = (g: CoachMailGame) => g.placeWords ?? closedPlaceName(g.closure) ?? 'all its fields';
const subjectPlace = (g: CoachMailGame) => g.placeWords ?? closedPlaceName(g.closure) ?? 'Every field';
const days = (c: CoachMailClosure) => (c.firstDay === c.lastDay
  ? `on ${formatShortWeekdayDate(c.firstDay)}`
  : `from ${formatShortWeekdayDate(c.firstDay)} through ${formatShortWeekdayDate(c.lastDay)}`);
const when = (g: CoachMailGame, withDay: boolean) =>
  `${g.opponent ? `against ${g.opponent} ` : ''}at ${closeClock(g.startsAt)}${withDay ? ` on ${formatShortWeekdayDate(orgDayKey(g.startsAt))}` : ''}`;
const sameClosure = (games: readonly CoachMailGame[]) =>
  games.every(g => placeOf(g) === placeOf(games[0]) && g.closure.firstDay === games[0].closure.firstDay && g.closure.lastDay === games[0].closure.lastDay);
/** Reopen is one closure: the D1 park words when every game carries them (/legal), else the closure's own place. */
const reopenedPlace = (games: readonly CoachMailGame[], subject: boolean) => {
  const park = games[0].reopenPark;
  if (park && games.every(g => g.reopenPark === park)) return subject ? `Diamonds at ${park}` : `the diamonds at ${park} that were closed`;
  return subject ? subjectPlace(games[0]) : placeOf(games[0]);
};

export const COACH_MAIL = {
  /** "Lions Park is closed: U13 Ospreys game needs a new date" · "2 diamonds at Lions Park are closed: …". */
  subject: (team: string, games: readonly CoachMailGame[]) => {
    const place = sameClosure(games) ? `${subjectPlace(games[0])} ${isAre(subjectPlace(games[0]))} closed` : 'Fields are closed';
    return `${place}: ${team} ${games.length === 1 ? 'game needs a new date' : 'games need new dates'}`;
  },
  /** "Kestrel Bay Softball Association closed Lions Park on Sat, Nov 28. Your game there that day, against Marlow Heights
   *  at 12:30 p.m., needs a new date. It is marked on your team’s schedule and nothing was moved. Give it a new date, or
   *  cancel it." */
  body: (club: string, games: readonly CoachMailGame[]) => {
    const c = games[0].closure;
    const oneDay = c.firstDay === c.lastDay;
    if (games.length === 1 && sameClosure(games)) {
      return `${club} closed ${placeOf(games[0])} ${days(c)}. Your game there ${oneDay ? 'that day' : `on ${formatShortWeekdayDate(orgDayKey(games[0].startsAt))}`}, `
        + `${when(games[0], false)}, needs a new date. It is marked on your team’s schedule and nothing was moved. Give it a new date, or cancel it.`;
    }
    const intro = sameClosure(games) ? `${club} closed ${placeOf(games[0])} ${days(c)}.` : `${club} closed some of its fields.`;
    const list = joinWithAnd(games.map(g => (sameClosure(games) ? when(g, !oneDay) : `${when(g, true)} at ${placeOf(g)}`)));
    return `${intro} Your ${games.length} games there need new dates: ${list}. They are marked on your team’s schedule and nothing was moved. `
      + 'Give each a new date, or cancel it.';
  },
  /** Reopen (K11 A; drawing tab 3): "{Club} reopened Lions Park. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it." */
  reopenSubject: (team: string, games: readonly CoachMailGame[]) =>
    `${reopenedPlace(games, true)} reopened: ${team} ${games.length === 1 ? 'game wasn’t moved' : 'games weren’t moved'}`,
  reopenBody: (club: string, games: readonly CoachMailGame[]) => {
    const at = (g: CoachMailGame) => `${formatShortWeekdayDate(orgDayKey(g.startsAt))} at ${closeClock(g.startsAt)}`;
    const where = reopenedPlace(games, false);
    return games.length === 1
      ? `${club} reopened ${where}. Your game on ${at(games[0])} wasn’t moved. Keep it or move it.`
      : `${club} reopened ${where}. Your games on ${joinWithAnd(games.map(at))} weren’t moved. Keep them or move them.`;
  },
  /** Why this coach got it (their own role on the team). */
  reasonHead: (team: string) => `You get it because you’re head coach of ${team}.`,
  reasonOther: (team: string) => `You get it because you coach ${team} and it has no head coach on file.`,
  /** The pressing admin has no name on file (/legal 2B): the reply still reaches that person, so say who they are. */
  replyNameless: (role: OrgRole, club: string) => `Reply to this email to reach the ${ROLE_EMAIL_LABEL[role] ?? 'person'} at ${club} who sent it.`,
  removalNameless: 'Not right for you? Reply and tell them.',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** One coach email, rendered in the colleague card (no club band, no family footer, no unsubscribe, no link). */
export function renderCoachClosureEmail(i: {
  kind: 'closed' | 'reopened'; club: string; sender: { name: string | null; role: OrgRole };
  recipient: { firstName: string | null; head: boolean }; team: string; games: readonly CoachMailGame[];
}): { subject: string; html: string; text: string; fromName: string } {
  // ⚖ The reply reaches the admin who pressed (their own address is the Reply-To), never the club's contact: with no name on
  // file the lines say "the {role} at {Club} who sent it", never "reach {Club}" (/legal, Session 2B shipped-words read).
  const name = i.sender.name;
  const reason = i.recipient.head ? COACH_MAIL.reasonHead(i.team) : COACH_MAIL.reasonOther(i.team);
  const lines = name
    ? [`${MAIL.senderLine('sender', i.club, { name, role: i.sender.role })} ${MAIL.replyLine('sender', i.club, name)}`, reason, MAIL.removalLine('sender', i.club, name)]
    : [`${MAIL.senderLine('club', i.club, { name: i.club, role: i.sender.role })} ${COACH_MAIL.replyNameless(i.sender.role, i.club)}`, reason, COACH_MAIL.removalNameless];
  const body = i.kind === 'closed' ? COACH_MAIL.body(i.club, i.games) : COACH_MAIL.reopenBody(i.club, i.games);
  const subject = i.kind === 'closed' ? COACH_MAIL.subject(i.team, i.games) : COACH_MAIL.reopenSubject(i.team, i.games);
  const foot = MAIL.foot(i.club);
  const p = (t: string) => `<p style="margin:0 0 0.75rem;">${esc(t)}</p>`;
  const small = (t: string) => `<p style="margin:0 0 0.35rem;font-size:0.85rem;">${esc(t)}</p>`;
  const html = warmEmailDocument(
    `${p(MAIL.greeting(i.recipient.firstName))}${p(body)}<div style="margin-top:1.25rem;">${lines.map(small).join('')}${small(foot)}</div>`,
  );
  const text = [MAIL.greeting(i.recipient.firstName), body, '', ...lines, foot].join('\n\n');
  return { subject, html, text, fromName: MAIL.from(i.club) };
}
