import { formatStoredDate, tournamentToday } from './timezone';
import type { LeagueSeasonStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY HOUSE-LEAGUE STATUS CHANGE ASKS (Club Tier Stage 9a, 9a·4; words HOUSE_LEAGUE_STAGE9A_COPY.md §4).
 *
 * One window per change, each saying what changes for families, its loose ends warning (amber, one sentence) and never
 * blocking. Desk title "{Verb} {season}?"; on a phone "{Verb} the season?" with the name as the body's first line. Foot:
 * the sentence at the left, then Cancel, then the primary — whose verb matches the title's.
 *
 * Status moves (the season PATCH's table): draft → registration_open → registration_closed → active → completed → archived,
 * and back: registration_closed → registration_open (only before play, owner 2026-10-24), completed/archived → active.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type StatusMove = 'open' | 'close' | 'reopenRegistration' | 'start' | 'complete' | 'archive' | 'reopen';

/** Where each move goes. */
export const MOVE_TO: Record<StatusMove, LeagueSeasonStatus> = {
  open: 'registration_open',
  close: 'registration_closed',
  reopenRegistration: 'registration_open',
  start: 'active',
  complete: 'completed',
  archive: 'archived',
  reopen: 'active',
};

/** The moves a season in this status offers (its doors), in the order the page shows them. */
export function movesFrom(status: LeagueSeasonStatus | string): StatusMove[] {
  switch (status) {
    case 'draft': return ['open'];
    case 'registration_open': return ['close'];
    case 'registration_closed': return ['start', 'reopenRegistration'];
    case 'active': return ['complete'];
    case 'completed': return ['archive', 'reopen'];
    case 'archived': return ['reopen'];
    default: return [];
  }
}

/** What a window needs to know to say what changes, and its loose ends. */
export type MoveFacts = {
  seasonName: string;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  registrationCloseAt: string | null;
  autoApproveUnderCapacity: boolean;
  pendingReviewCount: number;
  waitlistCount: number;
  unpaidFeeCount: number;
};

export type MoveWords = {
  title: string;
  phoneTitle: string;
  lead: string;
  changes: string[];
  looseEnds: string[];
  foot: string;
  button: string;
  busy: string;
};

const NOT_EMAILED = 'Families are not emailed.';

function waiting(n: number) { return n === 1 ? '1 registration is still waiting for review' : `${n} registrations are still waiting for review`; }
function waitlisted(n: number) { return n === 1 ? '1 family is on the waitlist' : `${n} families are on the waitlist`; }
function owing(n: number) { return n === 1 ? '1 player still owes fees' : `${n} players still owe fees`; }

/** The loose-end sentence (copy §4): only the non-zero parts, joined with commas and "and", one sentence. */
export function looseEndSentence(parts: string[]): string | null {
  if (parts.length === 0) return null;
  const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return `${body}.`;
}

const dayOf = (v: string) => (v.length > 10 ? tournamentToday(new Date(v)) : v.slice(0, 10));
const label = (v: string) => formatStoredDate(v, { withYear: true });

export function moveWords(move: StatusMove, f: MoveFacts, today: string = tournamentToday()): MoveWords {
  const name = f.seasonName;
  switch (move) {
    case 'open':
      return {
        title: `Open registration for ${name}?`, phoneTitle: 'Open registration?',
        lead: 'Families will be able to register as soon as you open it.',
        changes: [
          'The season appears on your public site and on the House league page.',
          'The sign-up form goes live, and the season shows under Open now.',
          f.autoApproveUnderCapacity
            ? 'New registrations are approved while a division has room, and a full division starts a waitlist.'
            : 'New registrations wait for your review, and a full division starts a waitlist.',
          'Families are not emailed when you open registration.',
        ],
        looseEnds: [],
        foot: 'You can close registration at any time.',
        button: 'Open registration', busy: 'Opening…',
      };
    case 'close': {
      const end = looseEndSentence([
        ...(f.pendingReviewCount ? [waiting(f.pendingReviewCount)] : []),
        ...(f.waitlistCount ? [waitlisted(f.waitlistCount)] : []),
      ]);
      return {
        title: `Close registration for ${name}?`, phoneTitle: 'Close registration?',
        lead: 'Families will no longer be able to register.',
        changes: [
          'The sign-up form closes. The season page says "Registration for this season has closed."',
          'Nobody new can join a waitlist. Families already on it keep their place.',
          'You can still approve, waitlist and add registrations by hand.',
          'Families who already registered can still look up their status.',
          NOT_EMAILED,
        ],
        looseEnds: end ? [end] : [],
        foot: 'You can reopen registration later.',
        button: 'Close registration', busy: 'Closing…',
      };
    }
    case 'reopenRegistration': {
      const closePassed = f.registrationCloseAt && dayOf(f.registrationCloseAt) < today;
      return {
        title: `Reopen registration for ${name}?`, phoneTitle: 'Reopen registration?',
        lead: 'The sign-up form goes live again.',
        changes: [
          'Families can register again, and the season shows under Open now.',
          'People already on the waitlist keep their place.',
          NOT_EMAILED,
        ],
        looseEnds: closePassed
          ? [`Your close date, ${label(f.registrationCloseAt!)}, has already passed. Until the dates run the form, it does not close registration by itself, so close it again when you are ready.`]
          : [],
        foot: 'You can close it again at any time.',
        button: 'Reopen registration', busy: 'Reopening…',
      };
    }
    case 'start': {
      const end = looseEndSentence(f.pendingReviewCount ? [waiting(f.pendingReviewCount)] : []);
      return {
        title: `Start ${name}?`, phoneTitle: 'Start the season?',
        lead: 'The season starts.',
        changes: [
          'Your public site shows it as Playing now, or Starts {date} if its first day is ahead, with Schedule and Standings up front.'
            .replace('{date}', f.seasonStartDate ? formatStoredDate(f.seasonStartDate, { withYear: false }) : 'its first day'),
          'Registration stays closed.',
          NOT_EMAILED,
        ],
        looseEnds: end ? [end] : [],
        foot: 'Teams and the schedule can still change while it is running.',
        button: 'Start season', busy: 'Starting…',
      };
    }
    case 'complete': {
      const end = looseEndSentence([
        ...(f.pendingReviewCount ? [waiting(f.pendingReviewCount)] : []),
        ...(f.waitlistCount ? [waitlisted(f.waitlistCount)] : []),
        ...(f.unpaidFeeCount ? [owing(f.unpaidFeeCount)] : []),
      ]);
      const ahead = f.seasonEndDate && dayOf(f.seasonEndDate) >= today
        ? [`Its end date, ${label(f.seasonEndDate)}, is still ahead.`] : [];
      return {
        title: `Complete ${name}?`, phoneTitle: 'Complete the season?',
        lead: 'The season moves to Past seasons. What changes:',
        changes: [
          'Registrations, teams and the schedule can no longer be changed.',
          'Money stays open: you can still mark fees received.',
          'You can still email its families.',
          'Your public site lists it under Past seasons, and its schedule and standings stay up.',
          NOT_EMAILED,
        ],
        looseEnds: [...ahead, ...(end ? [end] : [])],
        foot: 'You can reopen it from Past seasons.',
        button: 'Complete season', busy: 'Completing…',
      };
    }
    case 'archive': {
      const end = looseEndSentence(f.unpaidFeeCount ? [owing(f.unpaidFeeCount)] : []);
      return {
        title: `Archive ${name}?`, phoneTitle: 'Archive the season?',
        lead: 'The season is put away. What changes:',
        changes: [
          'Its public page says "This season has been archived."',
          'It stays under Past seasons, and its schedule and standings stay up.',
          'Nothing else changes: it stays locked, and Money stays open.',
          NOT_EMAILED,
        ],
        looseEnds: end ? [end] : [],
        foot: 'You can reopen it from Past seasons.',
        button: 'Archive season', busy: 'Archiving…',
      };
    }
    case 'reopen':
      return {
        title: `Reopen ${name}?`, phoneTitle: 'Reopen the season?',
        lead: 'The season comes back to Running now. What changes:',
        changes: [
          'Registrations, teams and the schedule can be changed again.',
          'Your public site lists it as Playing now, or as Final standings if its dates have passed.',
          'If its end date has passed it reads "Ended {date}", so you can complete it again.'
            .replace('{date}', f.seasonEndDate ? formatStoredDate(f.seasonEndDate, { withYear: false }) : 'its last day'),
          NOT_EMAILED,
        ],
        looseEnds: [],
        foot: 'You can complete it again at any time.',
        button: 'Reopen season', busy: 'Reopening…',
      };
  }
}

/** The rare door's sentence and link at the end of the season page (copy §4, button summary). */
export function rareDoor(move: 'complete' | 'archive' | 'reopen', f: Pick<MoveFacts, 'seasonEndDate'>, today: string = tournamentToday()) {
  if (move === 'complete') {
    const ended = f.seasonEndDate && dayOf(f.seasonEndDate) < today;
    return {
      sentence: ended ? `This season ended ${formatStoredDate(f.seasonEndDate!, { withYear: false })}.` : 'Done with this season?',
      link: 'Complete the season…',
    };
  }
  if (move === 'archive') return { sentence: 'Finished and settled?', link: 'Archive the season…' };
  return { sentence: 'Need to change something?', link: 'Reopen the season…' };
}
