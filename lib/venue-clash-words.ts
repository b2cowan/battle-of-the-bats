/**
 * venue-clash-words.ts — every sentence the clash check says, in one place (Club Tier Stage 6a, Asks 3–5 and 13,
 * ratified 2026-10-08). The coach's form, house league's windows, the tryout day, a server response and, later,
 * the tournament's screens (Tournament Stage 3) and the club calendar (6b) all speak through here, so one booking
 * reads the same words wherever it is seen. Client-safe, pure.
 *
 * ⚠ THE SURFACE WORD IS NEVER WRITTEN IN (owner wording ruling, 2026-10-08): "Diamond 2 is booked by …" for
 * softball and baseball, "Court 2 …" for basketball, "Field" when a sport has none — `fieldNounFor` /
 * `surfaceLabel` (lib/sports.ts) from the team's, league season's or tournament's sport. A facility the club named
 * in full ("Diamond 2", "North Court") is said as named; a bare code ("2") takes the sport's noun.
 *
 * ⚠ A COACH SEES ANOTHER TEAM'S NAME, THE KIND OF EVENT AND ITS TIME — NOTHING ELSE (Ask 5). Another program is
 * named by what it is ("a 2026 Fall House League game", "a UAT Rep Club Invitational 2026 game"), never by its
 * players, families or opponent. These builders only ever receive a `ClashOther`, which carries nothing more.
 *
 * Copy status: drafted to the hub's drawings (specimens 1, 3 and 7); /marketing words the tagged sentences.
 */
import { fieldNounFor, surfaceLabel } from './sports.ts';
import { formatTimeRange } from './utils.ts';
import { formatStoredDate, utcToZonedInputs } from './timezone.ts';
import type { ClashFinding, ClashOther, ClashBookingKind } from './venue-clash.ts';

/** The quiet line under a place the club doesn't own, in a club with a Venue library (Ask 3). */
export const NOT_CHECKED_LINE = 'Not one of the club’s venues, so it isn’t checked for clashes.';

const KIND_WORD: Record<ClashBookingKind, string> = {
  practice: 'practice',
  game: 'game',
  tryout: 'tryout',
  team_event: 'team event',
};

/** "a" or "an" before a name — by sound, so "a UAT Rep Club …" and "an Eastview Classic …" both read right. */
function article(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  // An initialism is read letter by letter: "an RBI Classic", "a UAT Invitational".
  if (/^[A-Z]{2,}$/.test(first)) return /^[AEFHILMNORSX]/.test(first) ? 'an' : 'a';
  return /^[aeiou]/i.test(first) ? 'an' : 'a';
}

/** How another booking is named in a sentence: "14U AA practice", "a 2026 Fall House League game". */
export function clashOtherName(o: Pick<ClashOther, 'program' | 'ownerName' | 'kind'>): string {
  const word = KIND_WORD[o.kind] ?? 'booking';
  if (o.program === 'rep') return `${o.ownerName} ${word}`;
  return `${article(o.ownerName)} ${o.ownerName} ${word}`;
}

/** "5:30–7:30 p.m." — a booking's time, read in the platform zone. */
export function clashTimeRange(startMs: number, endMs: number): string {
  const s = utcToZonedInputs(new Date(startMs).toISOString()).time;
  const e = utcToZonedInputs(new Date(endMs).toISOString()).time;
  return formatTimeRange(s, e);
}

/** A facility as a reader says it: the club's own name, or "Diamond 2" for a bare "2" (the sport's noun). */
export function facilityWords(sport: string | null | undefined, name: string | null | undefined): string {
  const n = name?.trim() ?? '';
  return n ? surfaceLabel(sport, n) || n : '';
}

/** Items that carry their own commas ("14U AA practice, 5:30–7:30 p.m.") join with ", and" so each stays whole. */
function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/** End a sentence once: a time already ends in "p.m.", which is its own full stop. */
function stop(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}

/** Bare dates join plainly: "Nov 3 and Nov 10", "Nov 3, Nov 10 and Nov 17". */
function joinDates(dates: string[]): string {
  if (dates.length <= 1) return dates[0] ?? '';
  return `${dates.slice(0, -1).join(', ')} and ${dates[dates.length - 1]}`;
}

export interface ClashLineContext {
  /** The program's sport — the facility's word. */
  sport: string | null | undefined;
  /** The proposed booking's venue and facility names (the club's). */
  venueName: string;
  facilityName: string | null;
}

/**
 * One line, as the drawing sets it: `lead` in bold, `rest` plain, and its ink — `warn` (amber) when a facility is
 * booked, `busy` (soft words, an amber mark) when the venue is only busy because a facility isn't set on one side.
 */
export interface ClashLine {
  tone: 'warn' | 'busy';
  lead: string;
  rest: string;
}

const toneOf = (exact: boolean): ClashLine['tone'] => (exact ? 'warn' : 'busy');

/**
 * The amber line under the place (Ask 5), from one booking's findings — or null when nothing clashes.
 *   booked_by:  "Diamond 2 is booked by 14U AA practice, 5:30–7:30 p.m."
 *               "Diamond 3 is booked by 12U AA practice, 6:00–7:30 p.m., and by a 2026 Fall House League game, 7:00–8:30 p.m."
 *   busy_then:  "Lions Park is busy then: 14U AA practice on Diamond 2, 5:30–7:30 p.m. Pick a diamond to be sure."
 *               (this booking's diamond set, the other's not:) "Lions Park is busy then: 14U AA practice, 5:30–7:30 p.m., with no diamond set."
 */
export function clashLine(findings: readonly ClashFinding[], ctx: ClashLineContext): ClashLine | null {
  if (!findings.length) return null;
  const noun = fieldNounFor(ctx.sport).toLowerCase();
  const booked = findings.filter(f => f.kind === 'booked_by');
  const busy = findings.filter(f => f.kind === 'busy_then');

  const busySentence = (also: boolean): string => {
    if (!busy.length) return '';
    const items = busy.map(({ other }) => {
      const name = clashOtherName(other);
      const time = clashTimeRange(other.startMs, other.endMs);
      const theirs = facilityWords(ctx.sport, other.facilityName);
      if (theirs && !ctx.facilityName) return `${name} on ${theirs}, ${time}`;
      if (!theirs && ctx.facilityName) return `${name}, ${time}, with no ${noun} set`;
      return `${name}, ${time}`;
    });
    const tail = ctx.facilityName ? '' : ` Pick a ${noun} to be sure.`;
    return `${ctx.venueName} is ${also ? 'also ' : ''}busy then: ${stop(joinAnd(items))}${tail}`;
  };

  if (booked.length) {
    const fac = facilityWords(ctx.sport, ctx.facilityName) || ctx.venueName;
    const parts = booked.map(({ other }) => `${clashOtherName(other)}, ${clashTimeRange(other.startMs, other.endMs)}`);
    const lead = parts.length > 1 ? `${fac} is booked by ${parts[0]},` : stop(`${fac} is booked by ${parts[0]}`);
    const more = parts.slice(1);
    let rest = '';
    if (more.length === 1) rest = ` ${stop(`and by ${more[0]}`)}`;
    else if (more.length > 1) rest = ` ${stop(`${more.slice(0, -1).map(p => `by ${p}`).join(', ')}, and by ${more[more.length - 1]}`)}`;
    const tail = busy.length ? ` ${busySentence(true)}` : '';
    return { tone: toneOf(true), lead, rest: `${rest}${tail}` };
  }
  return { tone: toneOf(false), lead: '', rest: busySentence(false) };
}

/** The whole line as one string (a server message, a toast, an export cell). */
export function clashLineText(line: ClashLine | null): string {
  return line ? `${line.lead}${line.rest}`.trim() : '';
}

/**
 * A weekly series' date mark (specimen 1): "Diamond 2 · 14U AA practice, 5:30–7:30 p.m." — the first booking that
 * holds the place that night; "Lions Park · …" when it holds the venue with no facility on one side.
 */
export function seriesDateMark(findings: readonly ClashFinding[], ctx: ClashLineContext): string {
  const f = findings[0];
  if (!f) return '';
  const where = f.kind === 'booked_by'
    ? facilityWords(ctx.sport, ctx.facilityName) || ctx.venueName
    : ctx.venueName;
  return `${where} · ${clashOtherName(f.other)}, ${clashTimeRange(f.other.startMs, f.other.endMs)}`;
}

/**
 * The one summary under a series' list (specimen 1), from each date's findings: "2 of 8 dates clash on Diamond 2."
 * (bold) then "Remove them, or change the time or diamond for all." With no facility picked the dates are only busy:
 * "2 of 8 dates are busy at Lions Park." then "Pick a diamond to be sure, or remove them."
 */
export function seriesSummary(byDate: readonly (readonly ClashFinding[])[], ctx: ClashLineContext): ClashLine | null {
  const clashing = byDate.filter(f => f.length).length;
  if (!clashing) return null;
  const total = byDate.length;
  const anyExact = byDate.some(f => f.some(x => x.kind === 'booked_by'));
  const noun = fieldNounFor(ctx.sport).toLowerCase();
  const of = `${clashing} of ${total} date${total === 1 ? '' : 's'}`;
  const them = clashing === 1 ? 'it' : 'them';
  if (anyExact) {
    const fac = facilityWords(ctx.sport, ctx.facilityName) || ctx.venueName;
    return { tone: toneOf(true), lead: `${of} clash${clashing === 1 ? 'es' : ''} on ${fac}.`, rest: ` Remove ${them}, or change the time or ${noun} for all.` };
  }
  return { tone: toneOf(false), lead: `${of} ${clashing === 1 ? 'is' : 'are'} busy at ${ctx.venueName}.`, rest: ` Pick a ${noun} to be sure, or remove ${them}.` };
}

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
/** "Nov 10" — a series date as a line names it. */
const dateWords = (date: string) => formatStoredDate(date, { withYear: false });

/**
 * House league's series line, which has no date list to mark (specimen 3): "2 of 8 Tuesdays clash on Diamond B:
 * 11U AA practice, 6:00–7:30 p.m., on Nov 3 and Nov 10." Grouped by who holds the place, in date order; the dates
 * (YYYY-MM-DD) are said here, and the weekday is the series' own.
 */
export function leagueSeriesLine(
  byDate: readonly { date: string; findings: readonly ClashFinding[] }[],
  ctx: ClashLineContext,
): ClashLine | null {
  const hits = byDate.filter(d => d.findings.length);
  const total = byDate.length;
  const weekdayPlural = byDate[0] ? WEEKDAYS[new Date(`${byDate[0].date}T12:00:00Z`).getUTCDay()] : 'weeks';
  if (!hits.length) return null;
  const anyExact = hits.some(d => d.findings.some(f => f.kind === 'booked_by'));
  const where = anyExact ? (facilityWords(ctx.sport, ctx.facilityName) || ctx.venueName) : ctx.venueName;
  const groups = new Map<string, string[]>();
  for (const d of hits) {
    const f = d.findings[0];
    const who = `${clashOtherName(f.other)}, ${clashTimeRange(f.other.startMs, f.other.endMs)}`;
    groups.set(who, [...(groups.get(who) ?? []), dateWords(d.date)]);
  }
  const said = [...groups.entries()].map(([who, dates]) => `${who}, on ${joinDates(dates)}`);
  const one = hits.length === 1;
  const verb = anyExact ? (one ? 'clashes on' : 'clash on') : (one ? 'is busy at' : 'are busy at');
  return { tone: toneOf(anyExact), lead: `${hits.length} of ${total} ${weekdayPlural} ${verb} ${where}:`, rest: ` ${stop(said.join('; '))}` };
}

/**
 * House league's own refusal, said under the field before Create (specimen 3, Ask 4) — the same shape, in red:
 * "Diamond B already has Greens vs Golds, 6:00–7:30 p.m. Two league games can't share a diamond: change the time
 * or the diamond." A series names the date it refuses on.
 */
export function leagueRefusalLine(opts: {
  sport: string | null | undefined;
  /** 'facility' = the same diamond (said by the diamond) · 'venue' = the same park with a diamond unset (said by the park). */
  matchedOn: 'facility' | 'venue';
  venueName: string;
  facilityName: string | null;
  partnerLabel: string;
  partnerKind: 'game' | 'practice';
  proposedKind: 'game' | 'practice';
  startIso: string | null;
  endIso: string | null;
  /** A series: the date (YYYY-MM-DD) the refusal falls on — said "Nov 10". */
  date?: string | null;
}): { tone: 'refuse'; lead: string; rest: string } {
  const where = opts.matchedOn === 'facility' ? (facilityWords(opts.sport, opts.facilityName) || opts.venueName) : opts.venueName;
  const noun = fieldNounFor(opts.sport).toLowerCase();
  const startMs = opts.startIso ? Date.parse(opts.startIso) : NaN;
  const endMs = opts.endIso ? Date.parse(opts.endIso) : NaN;
  const time = Number.isNaN(startMs) ? '' : clashTimeRange(startMs, Number.isNaN(endMs) ? startMs : endMs);
  const when = [opts.date ? dateWords(opts.date) : '', time].filter(Boolean).join(', ');
  const both = opts.partnerKind === 'game' && opts.proposedKind === 'game'
    ? 'Two league games can’t share'
    : 'League bookings can’t share';
  return {
    tone: 'refuse',
    lead: stop(`${where} already has ${opts.partnerLabel}${when ? `, ${when}` : ''}`),
    rest: ` ${both} a ${noun}: change the time or the ${noun}.`,
  };
}

/** The quiet line under Venue: where the name came from and, for the club's own, its address (Ask 13). */
export function venueSourceLine(source: 'club' | 'place' | 'typed' | null, address: string | null | undefined, inClub: boolean): string {
  const addr = address?.trim() ?? '';
  if (!source) return '';
  if (!inClub) return source === 'place' ? addr : '';
  if (source === 'club') return addr ? `The club’s venue · ${addr}` : 'The club’s venue';
  if (source === 'place') return addr ? `Your own place · ${addr}` : 'Your own place';
  return 'Typed · not checked for clashes';
}
