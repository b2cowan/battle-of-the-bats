/**
 * WHAT THE PUBLIC TOURNAMENT FEED SENDS ABOUT THE EVENT ITSELF (the public feed fix, Stage 8 §16).
 *
 * `getPublicTournamentPageData` feeds the public pages AND the anonymous `/api/public/tournament-data` endpoint, so
 * whatever it returns is readable by anyone who can type a URL. Until this module it returned the whole internal
 * `Tournament` record (settings, fee schedule, payment instructions, directory flags, coach-email switches…) and every
 * other tournament of the club. The pages read about twenty of those fields.
 *
 * The rule, held by the compiler on the server: the feed's `tournament` is a {@link PublicTournament}, and the only way
 * to make one is {@link publicTournament}. A raw `Tournament` is not assignable to it (the brand), so a new feed branch
 * that forgets the scrub fails to build instead of shipping the record. (The brand is a type, erased on the wire: a
 * browser that parses the JSON holds an assertion, not proof — the guarantee is what the server builds.)
 *
 * Money shown on the Register page follows the organizer's own switches: the fee schedule goes out only when the
 * page would show it (payments tracked and "show fees" on), and the how-to-pay text only when it is also set to
 * appear on the form. Every other section carries none of it.
 *
 * Pure (no I/O), so a plain Node unit test reads it.
 */
import { isPublicPageEnabled } from './public-pages';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import type { Announcement, Division, Tournament, TournamentSettings } from './types';
import type { LookTournament } from './tournament-look';

declare const publicBrand: unique symbol;

/** The settings keys a public page reads. Everything else in `settings` stays on the server. */
type PublicTournamentSettings = Pick<TournamentSettings,
  // every section
  | 'format' | 'game_duration_minutes' | 'tie_breakers' | 'tie_breaker_scope'
  // the Register section only (see publicTournament)
  | 'fee_scope' | 'show_fees_on_register' | 'payment_instructions' | 'payment_instructions_on_form'
  | 'coach_email_pause_all' | 'coach_email_confirmation'>;

export type PublicTournament = Pick<Tournament,
  | 'id' | 'name' | 'slug' | 'status' | 'startDate' | 'endDate' | 'contactEmail' | 'publicHiddenPages'
  | 'requireScoreFinalization' | 'championsCrownedAt'
  // Register only, and only while the page shows fees:
  | 'feeScheduleMode' | 'depositAmount' | 'depositDueDate' | 'totalFeeAmount' | 'totalFeeDueDate'>
  & Partial<LookTournament>
  & { settings?: Partial<PublicTournamentSettings> }
  & { readonly [publicBrand]: true };

/** The event facts the pure helpers read. Structural (no brand), so a raw record and the public shape both fit. */
export type PublicTournamentFacts = Pick<Tournament,
  | 'id' | 'name' | 'slug' | 'status' | 'startDate' | 'endDate' | 'publicHiddenPages' | 'requireScoreFinalization'
  | 'championsCrownedAt' | 'settings'>;

export type PublicTournamentOptions = {
  /** The Register section: the fee schedule and how-to-pay text, as far as the organizer shows them. */
  register?: boolean;
  /** The event's look (theme + logo), for server-only readers (share images, scores feed). The HTTP route never sets it. */
  look?: boolean;
};

/** Whether the Register page shows the fee schedule — the one answer both ends use. */
export function registerShowsFees(settings: Pick<TournamentSettings, 'fee_scope' | 'show_fees_on_register'> | undefined | null): boolean {
  return tournamentTracksPayments(settings) && settings?.show_fees_on_register !== false;
}

export function publicTournament(t: Tournament, contactEmail: string | undefined, options: PublicTournamentOptions = {}): PublicTournament {
  const s = t.settings;
  const register = options.register === true;
  const showFees = register && registerShowsFees(s);
  const instructions = showFees && s?.payment_instructions_on_form === true ? (s.payment_instructions ?? '').trim() : '';
  const settings: Partial<PublicTournamentSettings> = {
    format: s?.format,
    game_duration_minutes: s?.game_duration_minutes,
    tie_breakers: s?.tie_breakers,
    tie_breaker_scope: s?.tie_breaker_scope,
  };
  if (register) {
    settings.fee_scope = s?.fee_scope;
    settings.show_fees_on_register = s?.show_fees_on_register;
    settings.coach_email_pause_all = s?.coach_email_pause_all;
    settings.coach_email_confirmation = s?.coach_email_confirmation;
    if (instructions) {
      settings.payment_instructions = instructions;
      settings.payment_instructions_on_form = true;
    }
  }
  const shown: Omit<PublicTournament, typeof publicBrand> = {
    id: t.id, name: t.name, slug: t.slug, status: t.status, startDate: t.startDate, endDate: t.endDate,
    contactEmail,
    publicHiddenPages: t.publicHiddenPages,
    requireScoreFinalization: t.requireScoreFinalization,
    championsCrownedAt: t.championsCrownedAt,
    settings,
  };
  if (showFees) {
    shown.feeScheduleMode = t.feeScheduleMode;
    shown.depositAmount = t.depositAmount;
    shown.depositDueDate = t.depositDueDate;
    shown.totalFeeAmount = t.totalFeeAmount;
    shown.totalFeeDueDate = t.totalFeeDueDate;
  }
  if (options.look === true) {
    shown.themePreset = t.themePreset; shown.themePrimary = t.themePrimary; shown.themeAccent = t.themeAccent;
    shown.themeFont = t.themeFont; shown.logoUrl = t.logoUrl;
  }
  return shown as PublicTournament;
}

const FEE_FIELDS = ['depositAmount', 'depositDueDate', 'totalFeeAmount', 'totalFeeDueDate'] as const;

/** A division as a public page gets it: its fee schedule goes only where the Register page shows fees. */
export function publicDivision(division: Division, showFees: boolean): Division {
  if (showFees) return division;
  const shown = { ...division };
  for (const key of FEE_FIELDS) delete shown[key];
  return shown;
}

/** Every division of a feed section. The fee decision is made here and in {@link publicTournament} from the same
 *  {@link registerShowsFees} answer, so the event's fees and its divisions' fees cannot disagree. */
export function publicDivisions(divisions: Division[], settings: TournamentSettings | undefined, register = false): Division[] {
  const showFees = register && registerShowsFees(settings);
  return divisions.map(d => publicDivision(d, showFees));
}

/** The only announcement fields a public page reads (the Schedule's pinned notice). */
export type PublicNotice = Pick<Announcement, 'id' | 'title' | 'body' | 'pinned'>;

/**
 * The pinned notices the Schedule may show: none when the organizer hid News, and none aimed at a division whose
 * schedule is still held back (a post naming a held-back division would give the division away). A post that targets
 * no division is for everyone; an id that no longer matches a division is ignored.
 */
export function publicNotices(
  announcements: Announcement[],
  tournament: Pick<Tournament, 'publicHiddenPages' | 'settings'>,
  divisions: Pick<Division, 'id' | 'scheduleVisibility'>[],
): PublicNotice[] {
  if (!isPublicPageEnabled(tournament, 'news')) return [];
  const pinned = announcements.filter(a => a.pinned);
  if (pinned.length === 0) return [];
  const byId = new Map(divisions.map(d => [d.id, d]));
  return pinned
    .filter(a => !(a.divisionIds ?? []).some(id => { const d = byId.get(id); return d !== undefined && d.scheduleVisibility !== 'published'; }))
    .map(a => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned }));
}
