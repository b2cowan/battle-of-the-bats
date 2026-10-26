/**
 * Find — the support console's one box (Support console Stage 2, owner rulings A2 + A10, 2026-10-25; drawings
 * Ub7fXLh29SC34Zp4oqKUx1, "Find" and "Find security").
 *
 * ⚖ WHAT EACH ROLE SEARCHES IS DECIDED HERE, ON THE SERVER, FROM THE ONE RULEBOOK. Every role finds clubs and people
 * (the pages every role opens); Stripe numbers are searched only by the roles holding `find_stripe` (Super admin,
 * Billing, Support). A group a role may not read is never searched — its reader is never called — and never appears in
 * the answer: no key, no count, no greyed rows (threats T2, T9). The screen hides nothing; there is nothing to hide.
 *
 * ⚖ STRIPE NUMBERS MATCH WHOLE ONLY: a partial number is a way to walk the list (T4). Subscription CHARGE numbers are
 * kept nowhere on our side, so a pasted `ch_`/`pi_` that is no family payment gets the state-4 sentence until Stage 3
 * reads Stripe (A10). Card digits are never a search key (T10).
 *
 * ⚠ THE WORDS NEVER LEAVE THIS PATH. The caller passes them in a POST body, nothing here logs them, and every failure is
 * replaced by `FIND_FAILED` before anything records it (T6). `tests/unit/support-console-find-guard.test.ts` holds it.
 *
 * Pure apart from the readers it is handed, so the per-role answer is testable without a database.
 */
import { canViewPlatformArea, hasPlatformPower } from './platform-areas';
import type { PlatformRole } from './platform-auth';

export const FIND_MIN_CHARS = 2;
export const FIND_MAX_CHARS = 120;
/** At most this many rows per group — also a LIMIT in the database functions themselves. */
export const FIND_ROWS_PER_GROUP = 8;
/** The one sentence any failure on Find's path becomes, before anything logs it. */
export const FIND_FAILED = 'Find could not search just now. Try again in a moment.';

export type FindGroupKey = 'clubs' | 'people' | 'stripe';

export type FindClubRow = {
  id: string;
  name: string;
  slug: string;
  planLabel: string;
  statusLabel: string;
  ownerEmail: string | null;
};

export type FindPersonClub = { id: string; name: string; role: string };

export type FindPersonRow = {
  id: string;
  email: string;
  name: string | null;
  lastSignInAt: string | null;
  banned: boolean;
  clubs: FindPersonClub[];
};

/**
 * What a typed Stripe number is (Support console Stage 3, owner Q5): a customer or subscription (matched on our own
 * columns), a payment (`ch_`/`py_`/`pi_`: a family payment first, then one exact Stripe read), an invoice (`in_`), or an
 * invoice's PRINTED number (`A1B2C3D4-0007`, through Stripe's Search). Card digits are never one.
 */
export type FindStripeKind = 'customer' | 'subscription' | 'payment' | 'invoice' | 'invoice_number';

export type FindStripeRow = {
  orgId: string;
  orgName: string;
  planLabel: string;
  number: string;
  /** `payment` is a family payment; `charge` and `invoice` are the club's own subscription, read from Stripe. */
  kind: 'customer' | 'subscription' | 'payment' | 'charge' | 'invoice';
  /** A subscription charge or invoice: its amount and day, and the charge the Money tab opens on. */
  amountCents?: number;
  currency?: string;
  at?: string;
  chargeId?: string | null;
};

export type FindGroup<T> = { rows: T[]; total: number };

export type FindAnswer = {
  /** What was searched for this role, in order — the panel's foot names it when a group is trimmed. */
  searched: FindGroupKey[];
  clubs?: FindGroup<FindClubRow>;
  people?: FindGroup<FindPersonRow>;
  stripe?: FindGroup<FindStripeRow>;
  /** A Stripe-shaped number that is neither a family payment nor one of our clubs' (or is the other mode's). */
  stripeNotFound?: boolean;
};

export type FindReaders = {
  clubs(query: string): Promise<FindGroup<FindClubRow>>;
  people(query: string): Promise<FindGroup<Omit<FindPersonRow, 'clubs'>>>;
  personClubs(personIds: string[]): Promise<Map<string, FindPersonClub[]>>;
  stripe(number: string, kind: FindStripeKind): Promise<FindStripeRow[]>;
};

/** The groups a role searches, in the panel's order. */
export function findGroupsFor(role: PlatformRole): FindGroupKey[] {
  const groups: FindGroupKey[] = [];
  if (canViewPlatformArea(role, 'organizations')) groups.push('clubs');
  if (canViewPlatformArea(role, 'customer_users')) groups.push('people');
  if (hasPlatformPower(role, 'find_stripe')) groups.push('stripe');
  return groups;
}

const STRIPE_NUMBER = /^(cus|sub|pi|ch|py|in)_[A-Za-z0-9]{6,64}$/;
/**
 * An invoice's printed number: a prefix of letters and digits, a dash, its sequence. The shape is checked BEFORE any
 * query is built, so a quote, a space, `OR` or any other search syntax never reaches Stripe (T20).
 */
const INVOICE_NUMBER = /^[A-Za-z0-9]{3,12}-[0-9]{4,8}$/;

/** The kind of a whole Stripe number, or null when the words are not one. */
export function stripeNumberKind(words: string): FindStripeKind | null {
  if (INVOICE_NUMBER.test(words)) return 'invoice_number';
  const match = STRIPE_NUMBER.exec(words);
  if (!match) return null;
  if (match[1] === 'cus') return 'customer';
  if (match[1] === 'sub') return 'subscription';
  if (match[1] === 'in') return 'invoice';
  return 'payment';
}

/** Stripe's Search query for an invoice's printed number, or null when the words are not one (never built otherwise). */
export function invoiceNumberQuery(words: string): string | null {
  return INVOICE_NUMBER.test(words) ? `number:"${words.toUpperCase()}"` : null;
}

export type FindInputVerdict = { ok: true; words: string } | { ok: false; reason: 'too_short' | 'too_long' };

/** 2–120 characters after trimming, or refused. The words are never echoed back. */
export function checkFindWords(raw: unknown): FindInputVerdict {
  const words = typeof raw === 'string' ? raw.trim() : '';
  if (words.length < FIND_MIN_CHARS) return { ok: false, reason: 'too_short' };
  if (words.length > FIND_MAX_CHARS) return { ok: false, reason: 'too_long' };
  return { ok: true, words };
}

/** Build one role's answer. A group the role does not search is never asked for. */
export async function runFind(role: PlatformRole, words: string, readers: FindReaders): Promise<FindAnswer> {
  const searched = findGroupsFor(role);
  const answer: FindAnswer = { searched };
  const stripeKind = searched.includes('stripe') ? stripeNumberKind(words) : null;

  const [clubs, people, stripeRows] = await Promise.all([
    searched.includes('clubs') ? readers.clubs(words) : Promise.resolve(null),
    searched.includes('people') ? readers.people(words) : Promise.resolve(null),
    stripeKind ? readers.stripe(words, stripeKind) : Promise.resolve(null),
  ]);

  if (clubs) answer.clubs = { rows: clubs.rows.slice(0, FIND_ROWS_PER_GROUP), total: clubs.total };
  if (people) {
    const rows = people.rows.slice(0, FIND_ROWS_PER_GROUP);
    const clubsByPerson = rows.length > 0 ? await readers.personClubs(rows.map(p => p.id)) : new Map<string, FindPersonClub[]>();
    answer.people = { rows: rows.map(p => ({ ...p, clubs: clubsByPerson.get(p.id) ?? [] })), total: people.total };
  }
  if (searched.includes('stripe')) {
    const rows = (stripeRows ?? []).slice(0, FIND_ROWS_PER_GROUP);
    answer.stripe = { rows, total: rows.length };
    if (stripeKind && stripeKind !== 'customer' && stripeKind !== 'subscription' && rows.length === 0) answer.stripeNotFound = true;
  }
  return answer;
}
