import { formatTime } from './utils';
import { formatShortWeekdayDate, utcToZonedInputs } from './timezone';
import { familyClose } from './club-schedule-league-words';
import type { EmailWords } from './club-schedule-words';
import { placeDiffers, type GameSnapshot, type NetChange } from './league-game-changes';
import { SCHEDULE_EMAIL_WORDS as W, whenAndPlace } from './league-schedule-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FAMILIES' GAME EMAILS, PURE (House League 9d-2b Part 4; frame f3; rulings 9d2·1, 9d2·2; words settled in
 * HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2b" f3). One email per family per Publish or send, one part per child:
 *   · Schedule published — the child's team's games as families now know them, one line each;
 *   · Games changed — the NET effect of each game's sent changes (`netChangeOf`), one item per game: a moved game's Now
 *     and Was are its own lines, and Was names only what changed.
 * The sender (lib/league-schedule-mail.ts) reads the rows; the previews ("See the email") read the same words. Pure.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** "Thu, Jun 24" and "6:00 p.m." in the club's zone ('' for a game with no date). */
export function dayAndClock(iso: string | null): { day: string; clock: string } {
  const z = utcToZonedInputs(iso);
  return { day: z.date ? formatShortWeekdayDate(z.date) : '', clock: z.time ? formatTime(z.time) : '' };
}

/** How a family reads a game's place: "Maple Grove Park · Diamond 1", or the typed place. */
export type PlaceText = (s: GameSnapshot) => string;

/** A published game's line: "Tue, Jun 1 · 6:00 p.m. · Cardinals vs Rays · Maple Grove Park · Diamond 1". */
export function publishedLine(s: GameSnapshot, title: string, placeOf: PlaceText): string {
  const { day, clock } = dayAndClock(s.scheduledAt);
  return W.gameLine(day, clock, title, placeOf(s));
}

/** "Was: 6:00 p.m." — only what changed: the day, the clock, the place. */
function wasClause(before: GameSnapshot, now: GameSnapshot, placeOf: PlaceText): string {
  const b = dayAndClock(before.scheduledAt), n = dayAndClock(now.scheduledAt);
  const when = [b.day !== n.day ? b.day : '', b.clock !== n.clock ? b.clock : ''].filter(Boolean).join(', ');
  const place = placeDiffers(before, now) ? placeOf(before) : '';
  return [when, place].filter(Boolean).join(' · ');
}

/** One game's item in a "Games changed" part (Now / Was), or null when there is nothing to say. The admin tray's row has
 *  its own words on purpose (`trayChangeLine`, "6:00 p.m. → 7:30 p.m."). */
export function emailChangeLine(net: NetChange, title: string, placeOf: PlaceText): string | null {
  const now = dayAndClock(net.now.scheduledAt);
  const nowFull = whenAndPlace(now.day, now.clock, placeOf(net.now));
  switch (net.kind) {
    case 'added': return W.added(title, nowFull);
    case 'back_on':
    case 'given_date': return W.backOn(title, nowFull);
    case 'cancelled': {
      const was = net.before ?? net.now;
      const b = dayAndClock(was.scheduledAt);
      return W.cancelled(title, whenAndPlace(b.day, b.clock, placeOf(was)));
    }
    case 'postponed': return W.postponed(title, dayAndClock((net.before ?? net.now).scheduledAt).day);
    case 'moved':
    case 'place': {
      if (!net.before) return null;
      const was = wasClause(net.before, net.now, placeOf);
      return was ? W.moved(title, nowFull, was) : null;
    }
  }
}

/** One child's part: "{Club} changed Ava’s games with Twins:" and its games' lines. */
export interface SchedulePart { child: string; team: string; teamId?: string; lines: string[] }

/** A family's email words (the house mail's `EmailWords`, which the preview draws too). */
export function scheduleEmailWords(p: {
  kind: 'published' | 'changed';
  club: string;
  season: string;
  guardianFirst: string | null;
  parts: readonly SchedulePart[];
  zoneSentence: string;
  /** The public schedule's path ("See the full schedule →"). */
  schedulePath: string;
}): EmailWords {
  const teams = p.parts.map(x => x.team);
  return {
    subject: p.kind === 'published' ? W.publishedSubject(teams) : W.changedSubject(teams),
    greeting: p.guardianFirst?.trim() ? `Hi ${p.guardianFirst.trim()},` : 'Hi,',
    paragraphs: [],
    lists: p.parts.map(x => ({
      title: p.kind === 'published' ? W.publishedPart(p.club, p.season, x.child, x.team) : W.changedPart(p.club, x.child, x.team),
      items: x.lines,
    })),
    link: { label: W.seeSchedule, path: p.schedulePath },
    outro: familyClose(teams),
    foot: p.zoneSentence,
  };
}
