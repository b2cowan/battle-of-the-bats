import { formatStoredDate, orgDayKey, tournamentNow, tournamentToday } from './timezone';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * IS A HOUSE-LEAGUE SEASON'S FORM OPEN? — ONE ANSWER (Club Tier Stage 9b-1, Part 4; owner S2·b "the dates run the form",
 * 2026-10-25 Close / Reopen until…; words HOUSE_LEAGUE_STAGE9B1_COPY.md §5.2–§5.3 and §12).
 *
 * The STATUS says whether the convenor has opened registration (and not closed it); the DATES say when the form runs.
 * Both together, read in the club's wall clock with the stored-as-typed convention (the forms store the time as typed
 * with a literal Z, so the first sixteen characters ARE the club's time — never re-zoned):
 *
 *   notSet      getting ready, no form dates yet            draft
 *   draft       getting ready, dates set                    draft
 *   opensAhead  opened, the open time is still ahead        registration_open
 *   open        taking sign-ups                             registration_open
 *   closedByDate  opened, the close time has passed         registration_open   ("Closed Aug 1")
 *   closedByYou   the convenor pressed Close registration   registration_closed ("You closed registration on Oct 3")
 *   ended       under way or finished                       active / completed / archived
 *
 * The register route, the register page, the season's public page, the club home's Open now, the season page and the
 * home's line all read this, so no surface can say "open" while another refuses. Pure; tested in
 * tests/unit/league-registration-state.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type RegState = 'notSet' | 'draft' | 'opensAhead' | 'open' | 'closedByDate' | 'closedByYou' | 'ended';

export type RegDated = {
  status: string;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  /** When the convenor closed it (a real moment, mig 363). */
  registrationClosedAt?: string | null;
};

/** The club's wall clock as the stored times read: "2026-10-25T14:05". */
export function clubWallClock(now: { date: string; time: string } = tournamentNow()): string {
  return `${now.date}T${now.time.slice(0, 5)}`;
}

const wall = (v: string | null | undefined) => (v && v.length >= 16 ? v.slice(0, 16) : v && v.length >= 10 ? `${v.slice(0, 10)}T00:00` : null);

export function registrationState(season: RegDated, nowWall: string = clubWallClock()): RegState {
  const opens = wall(season.registrationOpenAt), closes = wall(season.registrationCloseAt);
  switch (season.status) {
    case 'draft': return opens && closes ? 'draft' : 'notSet';
    case 'registration_open':
      if (opens && nowWall < opens) return 'opensAhead';
      if (closes && nowWall > closes) return 'closedByDate';
      return 'open';
    case 'registration_closed': return 'closedByYou';
    default: return 'ended';
  }
}

/** Does the form take a sign-up right now? */
export function takesSignups(season: RegDated, nowWall: string = clubWallClock()): boolean {
  return registrationState(season, nowWall) === 'open';
}

/** A stored day as the club reads it (copy §0): "Jun 1", and "Jun 1, 2028" only when the year is not this year. */
export function clubDay(v: string, today: string = tournamentToday()): string {
  const d = v.slice(0, 10);
  return formatStoredDate(d, { withYear: d.slice(0, 4) !== today.slice(0, 4) });
}

const day = (v: string | null | undefined) => (v ? clubDay(v) : null);

/** The refusal a family reads when the form can't take a sign-up (copy §12), or null when it can. */
export function registrationRefusal(season: RegDated, nowWall: string = clubWallClock()): string | null {
  switch (registrationState(season, nowWall)) {
    case 'open': return null;
    case 'opensAhead': return 'Registration for this season isn’t open yet.';
    case 'closedByDate':
    case 'closedByYou': return 'Registration for this season has closed.';
    default: return 'This season is no longer taking registrations.';
  }
}

/** The staff pill and the public chip (copy §5.3): "Opens Jun 1" · "Registration open" · "Closed Aug 1" · "Registration closed". */
export function registrationChip(season: RegDated, nowWall: string = clubWallClock()): string | null {
  switch (registrationState(season, nowWall)) {
    case 'opensAhead': return `Opens ${day(season.registrationOpenAt)}`;
    case 'open': return 'Registration open';
    case 'closedByDate': return `Closed ${day(season.registrationCloseAt)}`;
    case 'closedByYou': return 'Registration closed';
    default: return null;
  }
}

/** The public season page's line under its chip (copy §5.3). It never says who closed it. */
export function publicRegistrationLine(season: RegDated, nowWall: string = clubWallClock()): string | null {
  switch (registrationState(season, nowWall)) {
    case 'opensAhead': return `Registration opens ${day(season.registrationOpenAt)}.`;
    case 'open': return season.registrationCloseAt ? `Registration closes ${day(season.registrationCloseAt)}.` : null;
    case 'closedByDate': return `Registration closed ${day(season.registrationCloseAt)}.`;
    case 'closedByYou': return 'Registration for this season has closed.';
    default: return null;
  }
}

/** The Registration block's dates row (copy §5.2): the value, the line under it, and which door it offers. */
export function registrationDatesRow(season: RegDated, nowWall: string = clubWallClock()):
  { value: string; sub: string | null; door: 'set' | 'close' | 'reopen' | null } {
  const range = [day(season.registrationOpenAt), day(season.registrationCloseAt)].filter(Boolean).join(' – ');
  switch (registrationState(season, nowWall)) {
    case 'notSet': return { value: range || 'Not set', sub: 'Set when the form opens and closes.', door: 'set' };
    case 'draft': return { value: range, sub: `The form opens on ${day(season.registrationOpenAt)} once you open registration.`, door: null };
    case 'opensAhead': return { value: range, sub: `Opens ${day(season.registrationOpenAt)}.`, door: 'close' };
    case 'open': return { value: range || 'No dates set', sub: season.registrationCloseAt ? `Open until ${day(season.registrationCloseAt)}.` : 'Open until you close it.', door: 'close' };
    case 'closedByDate': return { value: `Closed ${day(season.registrationCloseAt)}`, sub: 'The close date passed.', door: 'reopen' };
    case 'closedByYou': {
      const on = season.registrationClosedAt ? clubDay(orgDayKey(season.registrationClosedAt)) : null;
      return {
        value: on ? `You closed registration on ${on}.` : 'You closed registration.',
        sub: season.registrationCloseAt ? `The close date was ${day(season.registrationCloseAt)}.` : null,
        door: 'reopen',
      };
    }
    default: return { value: range || 'Not set', sub: null, door: null };
  }
}
