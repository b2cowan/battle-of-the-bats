/**
 * club-schedule-league-words.ts — what Send the changes says about HOUSE LEAGUE (Club Tier Stage 11b Part 5; frame h4;
 * rulings 9d2·2, 9d2·13, 9d2·16): a house-league team's row in the window, the house-league coach's email, the families'
 * practice-change email and the league admins' notice. Settled words: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` (h4, "The
 * house-league coach's email", "The families' practice-change email"). Every `[marketing]` tag is a string the copy file
 * does not settle yet (a cancelled practice, the league admins' notice) — /marketing words it before the walk.
 * House rules: "8:00 a.m." (formatTime), `possessive()`, `pluralize()`, sport-neutral, "league admin". Client-safe, pure.
 */
import { formatTime, formatTimeRange, joinWithAnd, pluralize, possessive } from './utils';
import { formatShortWeekdayDate, formatStoredDate, formatWeekRange } from './timezone';
import { weekdayPlural } from './permit-words';
import { weeklyDays, type EmailWords } from './club-schedule-words';
import type { LeagueRow, PracticeFace } from './club-schedule-league-plan';

/** A practice's place: the venue and its facility (a venue without facilities has none). */
export interface LeaguePlace { venue: string; facility: string | null }

/** "Sun, Nov 8" · "Sundays from Nov 8" · "Sundays, Nov 8 – Dec 20" (+ ", not Nov 22") — when a row's practices were. */
export function rowWhen(r: Pick<LeagueRow, 'days' | 'throughEnd' | 'was'>): string {
  const days = r.days;
  if (days.length === 1) return formatShortWeekdayDate(days[0]);
  const first = days[0], last = days[days.length - 1];
  const missing = weeklyDays(first, last).filter(d => !days.includes(d));
  const not = missing.length === 0 ? ''
    : missing.length <= 3 ? `, not ${joinWithAnd(missing.map(d => formatStoredDate(d, { withYear: false })))}`
    : `, not on ${missing.length} of those weeks`;
  // "from Nov 8" only when nothing of the team's on that weekday, time and place stays after the last date — otherwise a
  // family would read every later Sunday as moved.
  return r.throughEnd
    ? `${weekdayPlural(r.was.weekday)} from ${formatStoredDate(first, { withYear: false })}${not}`
    : `${weekdayPlural(r.was.weekday)}, ${formatWeekRange(first, last, false)}${not}`;
}

const short = (p: LeaguePlace) => p.facility ?? p.venue;
const full = (p: LeaguePlace) => (p.facility ? `${p.venue} · ${p.facility}` : p.venue);
const samePlace = (a: PracticeFace, b: PracticeFace) => a.venueId === b.venueId && a.facilityId === b.facilityId;

/**
 * The h4 row, after the team's name (`changeTeamLine`): "Sundays from Nov 8: Field 1 → Field 3, 11:00 a.m. → 12:30 p.m."
 * — only what changed. A cancel is [marketing]: "Sundays from Nov 8, 11:00 a.m. · Field 1: cancelled".
 */
export function leagueRowLine(r: LeagueRow, placeOf: (f: PracticeFace) => LeaguePlace): string {
  const when = rowWhen(r);
  const was = placeOf(r.was);
  if (r.kind === 'cancelled' || !r.now) return `${when}, ${formatTime(r.was.startClock)} · ${short(was)}: cancelled`;
  const now = placeOf(r.now);
  const parts: string[] = [];
  if (r.now.day !== r.was.day) {
    parts.push(r.days.length === 1 ? `${formatShortWeekdayDate(r.was.day)} → ${formatShortWeekdayDate(r.now.day)}` : `${weekdayPlural(r.was.weekday)} → ${weekdayPlural(r.now.weekday)}`);
  }
  if (!samePlace(r.was, r.now)) {
    // Two venues can share a facility's name ("Field 1"): the venue joins the words when the venue moved.
    parts.push(r.was.venueId === r.now.venueId ? `${short(was)} → ${short(now)}` : `${full(was)} → ${full(now)}`);
  }
  if (r.now.startClock !== r.was.startClock) parts.push(`${formatTime(r.was.startClock)} → ${formatTime(r.now.startClock)}`);
  return `${when}: ${parts.length ? parts.join(', ') : `${short(was)} → ${short(now)}`}`;
}

/** h4's line under a house-league team's row: "House league · U9 Rookie · 2 coaches and 11 families". */
export function leagueGroupLine(division: string, coaches: number, families: number): string {
  const who = [coaches ? pluralize(coaches, 'coach', 'coaches') : '', families ? pluralize(families, 'family', 'families') : ''].filter(Boolean);
  // [marketing] a team with nobody to email.
  return ['House league', division, who.length ? joinWithAnd(who) : 'nobody to email'].filter(Boolean).join(' · ');
}

const firstNames = (names: readonly (string | null)[]) => {
  const firsts = names.map(n => (n ?? '').trim().split(/\s+/)[0]).filter(Boolean);
  return firsts.length ? `Hi ${joinWithAnd(firsts)},` : 'Hi,';
};

/** The house-league coach's email (h4; the rep coach's `changesEmail` shape — only the noun differs). */
export function leagueCoachEmail(p: {
  orgName: string; scheduleName: string; teamName: string; recipientNames: readonly (string | null)[];
  lines: string[]; familiesTold: boolean; link: string; zoneSentence: string;
}): EmailWords {
  return {
    subject: `${p.scheduleName}: ${possessive(p.teamName)} practices changed`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [`${p.orgName} changed ${possessive(p.teamName)} practices on ${p.scheduleName}:`],
    lists: [{ title: null, items: p.lines }],
    link: { label: `Open ${possessive(p.teamName)} team page →`, path: p.link },
    // Never a promised notice that doesn't go: "Your families get this change too" only when they do.
    outro: `${p.familiesTold ? 'Your families get this change too. ' : ''}Everything else stays as it was.`,
    foot: p.zoneSentence,
  };
}

// ── The families' practice-change email (9d2·2) ──────────────────────────────────────────────────

/** One child's part: their team, its Now / Was lines (`familyRowLines`) and the first date that changed. */
export interface FamilyPart { child: string; team: string; lines: string[]; firstDay: string }

/**
 * The families' practice-change email (9d2·2), one per household per send: one part per child, each Now / Was; the close
 * once. It stands on its own — until 9d-3 a family may never have been told the practice time. No link, by ruling. The
 * envelope adds the season sentence ("Sent by {club} because your family is registered in {season}.").
 */
export function familyEmailWords(p: { club: string; guardianFirst: string | null; parts: readonly FamilyPart[]; zoneSentence: string }): EmailWords {
  const teams = p.parts.map(x => x.team);
  return {
    subject: familySubject(teams),
    greeting: p.guardianFirst?.trim() ? `Hi ${p.guardianFirst.trim()},` : 'Hi,',
    paragraphs: [],
    lists: p.parts.map(x => ({ title: familyPartOpening(p.club, x.child, x.team, x.firstDay), items: x.lines })),
    link: null,
    outro: familyClose(teams),
    foot: p.zoneSentence,
  };
}

/** "Reds’ practices changed" · "Practices changed for Reds and Blues". */
export function familySubject(teams: readonly string[]): string {
  const once = [...new Set(teams)];
  return once.length === 1 ? `${possessive(once[0])} practices changed` : `Practices changed for ${joinWithAnd(once)}`;
}

/** "Sundays" for a run, "Sun, Nov 8" for one date. */
const nowWhen = (r: LeagueRow, f: PracticeFace) => (r.days.length === 1 ? formatShortWeekdayDate(f.day) : weekdayPlural(f.weekday));

/**
 * A row as the family reads it: "Now: Sundays, 12:30–2:00 p.m. · Lakeshore Dome · Field 3" (in full) and "Was: Sundays,
 * 11:00 a.m.–12:30 p.m. · Field 1" (only what changed). A cancel is one line, [marketing].
 */
export function familyRowLines(r: LeagueRow, placeOf: (f: PracticeFace) => LeaguePlace): string[] {
  const was = placeOf(r.was);
  const wasRange = formatTimeRange(r.was.startClock, r.was.endClock);
  if (r.kind === 'cancelled' || !r.now) return [`Cancelled: ${rowWhen(r)}, ${wasRange} · ${full(was)}`];
  const now = placeOf(r.now);
  const timeChanged = r.now.startClock !== r.was.startClock || r.now.endClock !== r.was.endClock;
  const wasPlace = samePlace(r.was, r.now) ? '' : r.was.venueId === r.now.venueId ? short(was) : full(was);
  return [
    `Now: ${nowWhen(r, r.now)}, ${formatTimeRange(r.now.startClock, r.now.endClock)} · ${full(now)}`,
    `Was: ${nowWhen(r, r.was)}${timeChanged ? `, ${wasRange}` : ''}${wasPlace ? ` · ${wasPlace}` : ''}`,
  ];
}

/** "{club} changed Sam’s practices with Reds, from Sun, Nov 8:" — the opening of a child's part. */
export const familyPartOpening = (club: string, child: string, team: string, firstDay: string) =>
  `${club} changed ${possessive(child)} practices with ${team}, from ${formatShortWeekdayDate(firstDay)}:`;

/** "Questions? Ask Reds’ coach." — no link: families have no page that shows practices (the public team page is games only). */
export const familyClose = (teams: readonly string[]) => {
  const once = [...new Set(teams)];
  // [marketing] several teams: "Questions? Ask the Reds or Blues coach."
  return once.length === 1 ? `Questions? Ask ${possessive(once[0])} coach.` : `Questions? Ask the ${once.join(once.length === 2 ? ' or ' : ', ').replace(/, ([^,]*)$/, ', or $1')} coach.`;
};

/** The season's Email families history: the Automatic row's subject and body ([marketing]; the shape of 9d-1's
 *  `automaticBody`). */
export const PRACTICES_CHANGED_NOTICE = {
  subject: (division: string | null) => (division ? `Practices changed: ${division}` : 'Practices changed'),
  body: (cap: number) =>
    `FieldLogicHQ sent this when the club sent changes that moved or cancelled practices: one email per family, about their own children. Automatic emails don’t count toward the season’s ${cap}.`,
} as const;

// ── The league admins' notice (9d2·13; [marketing]) ───────────────────────────────────────────────

export const LEAGUE_ADMIN_NOTICE = {
  title: (scheduleName: string) => `${scheduleName} changed house league’s practices`,
  body: (p: { divisions: string[]; moved: number; cancelled: number }) => {
    const what = [p.moved ? `${pluralize(p.moved, 'practice')} moved` : '', p.cancelled ? `${pluralize(p.cancelled, 'practice')} cancelled` : ''].filter(Boolean);
    const told = `${joinWithAnd(what)}.`;
    return p.divisions.length ? `${joinWithAnd(p.divisions)}: ${told}` : told.charAt(0).toUpperCase() + told.slice(1);
  },
} as const;
