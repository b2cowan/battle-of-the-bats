import { bornFitsDate, type Cutoff } from './born-years';
import { leaguePrice } from './league-price';
import { dollarsLine } from './house-league-season';
import { clubDay } from './league-registration-state';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE SIGN-UP, SEVERAL CHILDREN — THE FAMILY'S WORDS AND THE FORM'S FORECAST (Club Tier Stage 9b-1, Parts 5–6; owner Q5,
 * 9b·4, 9b·5, 9b·12, 9b·13; words HOUSE_LEAGUE_STAGE9B1_COPY.md §7–§11). One home for what a child's outcome is called
 * ("Accepted", never "Approved", on every family screen and email), the ordinal, a list of names, the total to pay, the
 * headline, the email subject and the staff notice — so the form, the confirmation, the status page and the emails can
 * never say one thing two ways. Also the form's forecast: which division a date of birth finds, and what will happen to
 * each child before anyone presses Sign up (the server decides for real, under the lock).
 *
 * Pure and client-safe. Tested in tests/unit/league-signup.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type ChildOutcome = 'active' | 'pending_review' | 'waitlisted';

/** "1st", "2nd", "3rd", "11th", "21st". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "Henry", "Henry and Ava", "Henry, Ava and Sam" (no comma before "and"). */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A child's tag on the confirmation and the status page (9b·12: "Accepted" for the family). */
export function childTag(status: string, waitlistPosition: number | null): string {
  if (status === 'active') return 'Accepted';
  if (status === 'pending_review') return 'Received';
  if (status === 'waitlisted') return waitlistPosition ? `Waitlist · ${ordinal(waitlistPosition)}` : 'Waitlist';
  if (status === 'declined') return 'Declined';
  if (status === 'withdrawn') return 'Withdrawn';
  return status;
}

export type PlacedChild = {
  firstName: string;
  lastName: string;
  divisionName: string;
  status: ChildOutcome;
  waitlistPosition: number | null;
  /** The price recorded at sign-up (null: none set). */
  fee: number | null;
};

/** What an accepted child adds to "To pay". */
const owed = (c: PlacedChild) => (c.status === 'active' ? c.fee ?? 0 : 0);

/** "To pay": accepted children only (a received child pays once accepted; a waitlisted one unless a spot opens). */
export function signupToPay(children: readonly PlacedChild[]): number {
  return Math.round(children.reduce((s, c) => s + owed(c), 0) * 100) / 100;
}

/** The confirmation's and the email's headline (copy §8, §10). */
export function signupHeadline(children: readonly PlacedChild[]): string {
  if (children.some(c => c.status === 'active')) return 'You’re signed up';
  if (children.some(c => c.status === 'pending_review')) return 'We’ve received your sign-up';
  return 'You’re on the waitlist';
}

/** The sign-up email's subject (copy §10.1–§10.4). */
export function signupSubject(children: readonly PlacedChild[], seasonName: string): string {
  const accepted = children.filter(c => c.status === 'active');
  const received = children.filter(c => c.status === 'pending_review');
  const waiting = children.filter(c => c.status === 'waitlisted');
  if (waiting.length === children.length) return `You’re on the waitlist — ${seasonName}`;
  if (received.length === children.length) return `We’ve received your sign-up — ${seasonName}`;
  if (accepted.length === children.length) {
    return accepted.length === 1 ? `${accepted[0].firstName} is accepted — ${seasonName}` : `${accepted.length} children accepted — ${seasonName}`;
  }
  const parts = [
    accepted.length ? `${accepted.length} accepted` : null,
    received.length ? `${received.length} received` : null,
    waiting.length ? `${waiting.length} on the waitlist` : null,
  ].filter(Boolean);
  return `Your sign-up for ${seasonName}: ${parts.join(', ')}`;
}

/** The staff notice (copy §11): one per sign-up. Staff words: approved, to review, on the waitlist. */
export function signupNotice(children: readonly PlacedChild[], guardianName: string, seasonName: string): { title: string; body: string } {
  const names = children.map(c => `${c.firstName} ${c.lastName}`);
  const title = names.length === 1 ? `New sign-up: ${names[0]}`
    : names.length === 2 ? `New sign-up: ${names[0]} and ${names[1]}`
    : `New sign-up: ${names[0]} and ${names.length - 1} more`;
  const count = (s: ChildOutcome) => children.filter(c => c.status === s).length;
  const parts = [
    count('active') ? `${count('active')} approved` : null,
    count('pending_review') ? `${count('pending_review')} to review` : null,
    count('waitlisted') ? `${count('waitlisted')} on the waitlist` : null,
  ].filter(Boolean);
  return { title, body: [guardianName, seasonName, parts.join(', ')].filter(Boolean).join(' · ') };
}

/** A child's detail line in the confirmation and the emails (copy §8, §10). */
export function childLine(c: PlacedChild): string {
  const price = c.fee == null ? null : dollarsLine(c.fee);
  if (c.status === 'waitlisted') return `${c.divisionName} · nothing to pay unless a spot opens`;
  if (c.status === 'pending_review') return price ? `${c.divisionName} · ${price}${c.fee ? ' once accepted' : ''}` : c.divisionName;
  return price ? `${c.divisionName} · ${price}` : c.divisionName;
}

// ── The form's forecast ──────────────────────────────────────────────────────────────────────────

/** A division as the public form reads it. */
export type FormDivision = {
  id: string;
  name: string;
  note: string | null;
  capacity: number | null;
  /** Accepted and received: what holds a spot. */
  heldCount: number;
  waitlistCount: number;
  bornFromYear: number | null;
  bornToYear: number | null;
  price: number | null;
  earlyPrice: number | null;
};
export type FormSeason = { registrationFee: number | null; earlyBirdUntil: string | null; autoApproveUnderCapacity: boolean };

/** Does the season sort children by age? (Any division with birth years: then a date of birth is required and picks.) */
export function hasAgeBands(divisions: readonly FormDivision[]): boolean {
  return divisions.some(d => d.bornFromYear != null || d.bornToYear != null);
}

/** The divisions a date of birth fits. With no age bands, every division (the family picks). */
export function divisionsFor(dob: string, divisions: readonly FormDivision[], cutoff: Cutoff): FormDivision[] {
  if (!hasAgeBands(divisions)) return [...divisions];
  // An empty side is "no limit", so a division with no years at all takes every child (bornFitsDate).
  return divisions.filter(d => bornFitsDate({ from: d.bornFromYear, to: d.bornToYear }, cutoff, dob));
}

export type ChildForecast =
  | { kind: 'needDob' }
  | { kind: 'nofit'; year: number }
  | { kind: 'pick'; options: FormDivision[] }
  | { kind: 'spot' | 'waitlist'; division: FormDivision; amount: number | null; early: boolean; earlyEnded: { amount: number; until: string } | null; position: number | null; review: boolean };

/**
 * What will happen to each child, in the form's order, before Sign up (9b·5). A spot taken by an earlier child in the same
 * sign-up counts against the next; a division with a waitlist is joined, never jumped (mig 362: nobody jumps the line).
 * The server decides for real under the season lock; the confirmation says so if a spot filled meanwhile.
 */
export function forecastChildren(
  children: readonly { dob: string; divisionId: string }[],
  divisions: readonly FormDivision[],
  season: FormSeason,
  cutoff: Cutoff,
  today: string,
): ChildForecast[] {
  const taken = new Map<string, number>(), queued = new Map<string, number>();
  const bands = hasAgeBands(divisions);
  return children.map(ch => {
    if (bands && !ch.dob) return { kind: 'needDob' } as const;
    const fits = ch.dob ? divisionsFor(ch.dob, divisions, cutoff) : [...divisions];
    if (fits.length === 0) return { kind: 'nofit', year: Number(ch.dob.slice(0, 4)) } as const;
    const chosen = fits.length === 1 ? fits[0] : fits.find(d => d.id === ch.divisionId);
    if (!chosen) return { kind: 'pick', options: fits } as const;
    const held = chosen.heldCount + (taken.get(chosen.id) ?? 0);
    const waiting = chosen.waitlistCount + (queued.get(chosen.id) ?? 0);
    const room = chosen.capacity == null || held < chosen.capacity;
    const price = leaguePrice(chosen, season, today);
    const ended = price?.earlyEnded && chosen.earlyPrice != null && season.earlyBirdUntil
      ? { amount: chosen.earlyPrice, until: clubDay(season.earlyBirdUntil, today) } : null;
    if (room && waiting === 0) {
      taken.set(chosen.id, (taken.get(chosen.id) ?? 0) + 1);
      return { kind: 'spot', division: chosen, amount: price?.amount ?? null, early: !!price?.early, earlyEnded: ended, position: null, review: !season.autoApproveUnderCapacity } as const;
    }
    queued.set(chosen.id, (queued.get(chosen.id) ?? 0) + 1);
    return { kind: 'waitlist', division: chosen, amount: price?.amount ?? null, early: false, earlyEnded: null, position: waiting + 1, review: !season.autoApproveUnderCapacity } as const;
  });
}
