/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A HOUSE-LEAGUE CHILD PAYS — THE ONE PRICE RULE (Club Tier Stage 9b-1; owner rulings 2026-10-24 Q2 · 9b·2, and
 * 2026-10-25 "record the price at sign-up").
 *
 *   1. The division's own price, else the season's (the same rule as the tournament's `registrationFee`: a division's own
 *      fee, else the event's).
 *   2. One early-bird date per season, an early amount per division: a sign-up ON OR BEFORE that day pays the division's
 *      early amount, when the division has one.
 *   3. The day is the club's day the family signed up (`tournamentToday()` at the moment of sign-up), compared as a
 *      plain YYYY-MM-DD; never re-zoned.
 *
 * The amount is RECORDED on the registration when the child signs up (`league_registrations.fee_amount`, mig 361) and
 * never moves when a convenor later edits a price: "A price change applies to new sign-ups only." Every reader of "what
 * does this registration owe" goes through `registrationOwes`; the database's one fee write (`club_league_fee_set`)
 * applies the same fallback in SQL. A registration written before mig 361 (or by code that predates it) carries no
 * amount and owes the season's price, which is what it always owed.
 *
 * Pure: no I/O. Tested in tests/unit/league-price.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PricedDivision { price: number | null; earlyPrice: number | null }
export interface PricedSeason { registrationFee: number | null; earlyBirdUntil: string | null }

export interface LeaguePrice {
  /** What this child pays when signing up on that day. */
  amount: number;
  /** The early amount applied. */
  early: boolean;
  /** The price without the early bird (the same as `amount` when no early amount applies). */
  regular: number;
  /** The division has an early amount whose day has already passed (the form says "Early bird ($145) ended Jun 30"). */
  earlyEnded: boolean;
}

const day = (v: string | null | undefined): string | null => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** The division's price for a sign-up on `signupDay`, or null when neither the division nor the season sets one. */
export function leaguePrice(division: PricedDivision, season: PricedSeason, signupDay: string): LeaguePrice | null {
  const regular = division.price ?? season.registrationFee;
  if (regular == null) return null;
  const until = day(season.earlyBirdUntil);
  const hasEarly = division.earlyPrice != null && until != null;
  const early = hasEarly && signupDay.slice(0, 10) <= until!;
  return {
    amount: early ? division.earlyPrice! : regular,
    early,
    regular,
    earlyEnded: hasEarly && !early,
  };
}

/** The early bird as families are offered it while it runs (the season page's cards and the public rows' "Save…" line). */
export interface EarlyBirdOffer {
  /** The last day the early amount applies (YYYY-MM-DD). */
  until: string;
  /** The smallest and largest saving among the divisions that have an early amount. */
  saveLow: number;
  saveHigh: number;
  /** Some priced division has no early amount, so the saving is "up to". */
  partial: boolean;
}

/** The early bird running for a sign-up on `today`, or null when none is (no early amounts, no date, or the day has passed). */
export function earlyBirdOffer(
  divisions: readonly PricedDivision[],
  season: PricedSeason,
  today: string,
): EarlyBirdOffer | null {
  const until = day(season.earlyBirdUntil);
  if (!until || today.slice(0, 10) > until) return null;
  const prices = divisions.map(d => leaguePrice(d, season, today)).filter((p): p is LeaguePrice => p != null);
  const saves = prices.filter(p => p.early && p.regular > p.amount).map(p => Math.round((p.regular - p.amount) * 100) / 100);
  if (saves.length === 0) return null;
  return { until, saveLow: Math.min(...saves), saveHigh: Math.max(...saves), partial: prices.some(p => !p.early || p.regular <= p.amount) };
}

/** A price a convenor typed, as the routes accept it: dollars, 0 or more, at most two decimals. undefined = not sent. */
export function priceFromBody(v: unknown): { value: number | null } | { error: string } | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return { value: null };
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return { error: 'Enter $0 or more.' };
  if (n > 100000) return { error: 'A price can’t be more than $100,000.' };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { error: 'Enter dollars and cents, like 165 or 165.50.' };
  return { value: Math.round(n * 100) / 100 };
}

/** The early amount can't be more than the price it discounts (copy §4 `record.err.early`). */
export function earlyPriceRefusal(price: number | null, earlyPrice: number | null): string | null {
  return price != null && earlyPrice != null && earlyPrice > price ? 'The early-bird amount can’t be more than the price.' : null;
}

/** What one registration owes: the amount recorded at sign-up, else the season's price (a row from before mig 361). */
export function registrationOwes(
  reg: { feeAmount: number | null },
  season: { registrationFee: number | null },
): number | null {
  return reg.feeAmount ?? season.registrationFee;
}

/** Every price a season's divisions charge (for the checklist and the Overview's "$165 – $175"). Null when any division
 *  has no price at all (neither its own nor the season's). */
export function seasonPriceRange(
  divisions: readonly PricedDivision[],
  season: Pick<PricedSeason, 'registrationFee'>,
): { low: number; high: number } | null {
  if (divisions.length === 0) return null;
  const prices = divisions.map(d => d.price ?? season.registrationFee);
  if (prices.some(p => p == null)) return null;
  const nums = prices as number[];
  return { low: Math.min(...nums), high: Math.max(...nums) };
}

/** Is any price in the season above $0? (9b·9: then how-to-pay is required before Open registration.) */
export function seasonCharges(divisions: readonly PricedDivision[], season: Pick<PricedSeason, 'registrationFee'>): boolean {
  if (divisions.length === 0) return (season.registrationFee ?? 0) > 0;
  return divisions.some(d => ((d.price ?? season.registrationFee) ?? 0) > 0);
}
