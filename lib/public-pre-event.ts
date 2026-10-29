/**
 * lib/public-pre-event.ts — THE WORDS OF THE FRAME OVERVIEW'S BEFORE-THE-EVENT PAGE (Public tournament pages Stage 2
 * Part 3; plan docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §5, hub "Before the event, phone browser").
 * Pure, so tests/unit/public-pre-event.test.ts pins them.
 *
 *   · THE REGISTER CARD — "Starts Tue, Nov 17" with the countdown, "11 of 16 team spots taken · U11 and U13", the
 *     button, one line about the free Coaches Portal. The spots line keeps today's privacy rule (the old pre-event panel's
 *     own): a COUNT follows the team list's visibility (a hidden Teams page must not leak it, owner 2026-07-15), the total
 *     capacity is never private, and it exists only when EVERY division has one.
 *   · THE FACTS LIST — Divisions, Where, Schedule ("Posted before the event" until there is a game to show), Rules.
 *
 * Absent beats empty: a line with nothing to say is not in the result.
 */
import { formatShortWeekdayDate } from './timezone';

/** "U11", "U11 and U13", "U11, U13 and U15"; past four names, the first three and "+n more". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  if (names.length <= 4) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

/** The total spots across the divisions: only when every division states one, and never for an invite-only event. */
export function totalSpots(divisions: readonly { capacity?: number | null }[], inviteOnly: boolean): number | null {
  if (inviteOnly || divisions.length === 0) return null;
  return divisions.every(d => d.capacity != null && d.capacity > 0)
    ? divisions.reduce((sum, d) => sum + (d.capacity ?? 0), 0)
    : null;
}

export interface SpotsInput {
  inviteOnly: boolean;
  /** The Teams page is public: the only case an accepted-team COUNT may be printed. */
  showTeamsPage: boolean;
  accepted: number;
  capacity: number | null;
  divisionNames: readonly string[];
}

export function teamSpotsLine({ inviteOnly, showTeamsPage, accepted, capacity, divisionNames }: SpotsInput): string | null {
  if (inviteOnly) return null;
  let spots: string | null = null;
  if (showTeamsPage && capacity) spots = `${accepted} of ${capacity} team spots taken`;
  else if (showTeamsPage && accepted > 0) spots = `${accepted} team${accepted === 1 ? '' : 's'} accepted`;
  else if (!showTeamsPage && capacity) spots = `${capacity} team spots`;
  if (!spots) return null;
  return divisionNames.length ? `${spots} · ${joinNames(divisionNames)}` : spots;
}

export interface RegisterCardView {
  /** "Starts Tue, Nov 17"; null when the event has no start date yet. */
  starts: string | null;
  /** ISO instant the countdown counts to; null with no start date. */
  countdownTarget: string | null;
  /** The spots line, or the registration state's own words when sign-ups are closed. */
  spots: string | null;
  button: { href: string; label: string } | null;
  /** The waitlist's reason (the divisions are full); never with a plain Register button. */
  waitlistNote: string | null;
  /** One line about the free Coaches Portal; only beside a button. */
  portalNote: string | null;
}

export interface RegisterCardInput {
  startDate: string | null;
  firstPitchISO: string | null;
  spotsLine: string | null;
  /** `getRegistrationState`'s answer. */
  registration: { label: string; detail: string; cta: 'register' | 'waitlist' | null };
  /** The Register page is on and the event takes sign-ups at all (not invite-only). */
  registerOn: boolean;
  registerHref: string;
  /** The organizer's admin preview: it shows the card, never the way to register. */
  isPreview: boolean;
}

/**
 * The one card that today's two inline Register blocks (the hero's and the phone panel's) become. Null when it has
 * nothing to say: no start date and no button. With sign-ups closed the card is the start line and the state's words;
 * the button, the spots and the Coaches Portal line exist only while a family can actually register.
 */
export function registerCardView(i: RegisterCardInput): RegisterCardView | null {
  const open = i.registerOn && !i.isPreview && i.registration.cta !== null;
  const view: RegisterCardView = {
    starts: i.startDate ? `Starts ${formatShortWeekdayDate(i.startDate)}` : null,
    countdownTarget: i.startDate ? i.firstPitchISO : null,
    spots: open ? i.spotsLine : i.registerOn ? i.registration.label : null,
    button: open ? { href: i.registerHref, label: i.registration.cta === 'waitlist' ? 'Join the waitlist' : 'Register a team' } : null,
    waitlistNote: open && i.registration.cta === 'waitlist' ? i.registration.detail : null,
    portalNote: open
      ? `${i.registration.cta === 'waitlist' ? 'Joining the waitlist' : 'Registering'} also sets up your free Coaches Portal: schedule, status and organizer updates in one place. Just following along? You don't need an account.`
      : null,
  };
  return view.starts || view.button ? view : null;
}

export interface FactRow {
  key: 'divisions' | 'where' | 'schedule' | 'rules';
  label: string;
  text: string;
  /** A door when set; plain (soft) text when not. */
  href?: string;
  /** "+2 more" after the place when the event has several. */
  more?: string;
}

export interface FactsInput {
  divisionNames: readonly string[];
  venue: { name: string; href: string | null; others: number } | null;
  /** The Schedule page is on. */
  showSchedulePage: boolean;
  /** At least one game families can see (`readPublicGames`: a held-back division's never counts). */
  hasVisibleGames: boolean;
  scheduleHref: string;
  /** The Rules page is on. */
  showRulesPage: boolean;
  rulesHref: string;
}

export function preEventFacts(i: FactsInput): FactRow[] {
  const rows: FactRow[] = [];
  if (i.divisionNames.length) rows.push({ key: 'divisions', label: 'Divisions', text: i.divisionNames.slice(0, 4).join(' · ') + (i.divisionNames.length > 4 ? ` +${i.divisionNames.length - 4} more` : '') });
  if (i.venue) rows.push({ key: 'where', label: 'Where', text: i.venue.name, href: i.venue.href ?? undefined, more: i.venue.others > 0 ? `+${i.venue.others} more` : undefined });
  if (i.showSchedulePage) {
    rows.push(i.hasVisibleGames
      ? { key: 'schedule', label: 'Schedule', text: 'Full schedule', href: i.scheduleHref }
      : { key: 'schedule', label: 'Schedule', text: 'Posted before the event' });
  }
  if (i.showRulesPage) rows.push({ key: 'rules', label: 'Rules', text: 'Format and rules', href: i.rulesHref });
  return rows;
}
