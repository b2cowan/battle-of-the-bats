/**
 * THE KIND DECIDES WHAT A ROW IS — the one idea behind sponsorships (owner-approved 2026-08-15,
 * `docs/projects/active/COACH_SPONSORSHIPS_PLAN.md`).
 *
 * A **fundraiser** asks "what did each player raise?" — its row expands into the logged entries.
 * A **sponsor** asks "what came in, and who brought it?" — its row expands into its arrivals.
 * Both are rows of the Fundraising tab that open IN PLACE (drives joined sponsors on 2026-08-31;
 * the drive's separate drill-in screen retired with the move).
 *
 * Everything downstream follows from that distinction, which is why it lives in one small module
 * rather than as a string compared in nine places.
 */

export type FundraisingKind = 'fundraiser' | 'sponsor';

/* ⚰ A local `fmt` lived here for one day (2026-08-31, re-homed from the retired detail.tsx) and
   was retired by /simplify: `lib/coach-money-summary.ts` already exports the hub's ONE money
   formatter under the same name — identical output for the non-negative figures fundraising
   prints, and it parenthesises a negative instead of dropping its sign. Two same-named
   formatters with different contracts in one lib/ tree is exactly the drift the one-word rulings
   exist to catch. Import `fmt` from there. */
export type SponsorStatus = 'pledged' | 'received';

export const FUNDRAISING_KINDS: FundraisingKind[] = ['fundraiser', 'sponsor'];
export const SPONSOR_STATUSES: SponsorStatus[] = ['pledged', 'received'];

/** Coach-facing names. Singular, because they label ONE record — the tab that holds both is
 *  "Fundraising" (owner ruling: "Fundraisers" would name half its contents). */
export const KIND_LABEL: Record<FundraisingKind, string> = {
  fundraiser: 'Fundraiser',
  sponsor:    'Sponsor',
};

export const KIND_HINT: Record<FundraisingKind, string> = {
  fundraiser: 'The whole team takes part — a bottle drive, a chocolate sale.',
  sponsor:    'One business or grant gives directly.',
};

export const SPONSOR_STATUS_LABEL: Record<SponsorStatus, string> = {
  pledged:  'Pledged',
  received: 'Received',
};

/** What the money-in figure MEANS for each status — the reason the two are distinguished at all. */
export const SPONSOR_STATUS_HINT: Record<SponsorStatus, string> = {
  pledged:  'Promised, but not arrived — it counts toward the plan, never as money in.',
  received: 'The money is in: it posts to the books and any family credit lands on their dues.',
};

export function isFundraisingKind(v: unknown): v is FundraisingKind {
  return v === 'fundraiser' || v === 'sponsor';
}

/**
 * What the Fundraising list is showing — and, since 2026-08-15, a URL parameter rather than a
 * component state.
 *
 * ⚠ IT MOVED INTO THE ADDRESS BECAUSE A ROW BECAME A DOOR. The Money overview now carries a
 * Fundraisers row and a Sponsorships row, and what earns a second row is that it opens the tab
 * ALREADY FILTERED — two doors onto an identical view would be a second navigation system, which
 * is the thing the hub's own rules keep removing. A filter that lives in component state cannot be
 * addressed, so it could not have been the destination.
 *
 * Two consequences worth stating: the filtered view is now shareable and Back steps through it,
 * and `kind` MUST join the hub's ONE_SHOT_KEYS or it rides to Expenses and comes back with the
 * coach's list silently narrowed.
 */
export type KindFilter = 'all' | FundraisingKind;

/** A `?kind=` from the address, or a stored value, read defensively. Anything unrecognised — a
 *  typo, an old link, a hand-edited URL — means "show everything", never an empty screen. */
export function normalizeKindFilter(v: unknown): KindFilter {
  return isFundraisingKind(v) ? v : 'all';
}

export function isSponsorStatus(v: unknown): v is SponsorStatus {
  return v === 'pledged' || v === 'received';
}

/**
 * Has this record's money ACTUALLY LANDED? The single question every "how much did we raise?"
 * figure must ask before it counts a row.
 *
 * ⚠⚠ THREE SEASON-WIDE READERS DID NOT ASK IT (found in review, 2026-08-15). A sponsor's entry is
 * written the moment the sponsor is recorded — it holds the arrangement — but while the sponsor is
 * `pledged`, no income has posted and no dues credit exists. Summing entries blindly therefore
 * counted promised money as banked in the Money hub's headline figure, in Budget vs. Actual's
 * "actual", and — worst — in the season settlement pot that families are PAID OUT OF, where a
 * pledge could have funded a real refund of money the team never received.
 *
 * A FUNDRAISER is always realised: a drive's row only exists once a player has raised something.
 * Only a sponsor can be a promise.
 */
export function isRealisedRecord(record: { kind: FundraisingKind | string; sponsorStatus?: SponsorStatus | string | null }): boolean {
  return record.kind !== 'sponsor' || record.sponsorStatus === 'received';
}

/** The unit a coach typed a sponsor's family credit in. Dollars is what gets STORED either way. */
export type CreditUnit = 'amount' | 'percent';

/**
 * Resolve a family credit entered as either dollars or a percentage of the sponsor's total.
 *
 * ⚠ THE DOLLARS ARE AUTHORITATIVE AND THE PERCENT IS ONLY PROVENANCE. A percentage is how the
 * coach *entered* it; the credit that lands on a family's dues is a fixed amount. Storing the
 * percentage as the source of truth would mean correcting a sponsor's total months later silently
 * revalued a credit already sitting on a bill — the same trap `player_rebate_percent` avoids by
 * snapshotting onto each entry at the moment it is logged.
 *
 * Returns both because the row keeps `rebate_percent` beside `rebate_amount`, and a reader
 * comparing them is how "50% of $250" stays explicable after the fact.
 */
export function resolveCredit(total: number, value: number, unit: CreditUnit): { credit: number; percent: number } {
  const amount = Math.max(0, Number(total) || 0);
  const typed = Math.max(0, Number(value) || 0);
  if (unit === 'percent') {
    const percent = Math.min(100, typed);
    return { credit: Math.round(amount * percent) / 100, percent };
  }
  // Dollars: never let a credit exceed what actually came in — a family cannot keep more than the
  // sponsor gave, and the derived percent would be meaningless past 100.
  const credit = Math.round(Math.min(amount, typed) * 100) / 100;
  return { credit, percent: amount > 0 ? Math.round((credit / amount) * 10000) / 100 : 0 };
}

/**
 * The season figures the Fundraising tab prints above its list, split by kind.
 *
 * ⚠ A PLEDGE IS NOT MONEY IN. It is carried separately so the summary can say so out loud; folding
 * it into the sponsor total would let a season flatter itself with a cheque nobody has received.
 */
export interface FundraisingRollup {
  fundraiserRaised: number;
  fundraiserCount: number;
  sponsorReceived: number;
  sponsorPledged: number;
  sponsorCount: number;
  teamKeeps: number;
  creditedToFamilies: number;
}

export function rollUpFundraising(
  rows: Array<{
    kind: FundraisingKind;
    sponsorStatus: SponsorStatus | null;
    totalRaised: number;
    teamNet: number;
    totalCredits: number;
  }>,
): FundraisingRollup {
  const r: FundraisingRollup = {
    fundraiserRaised: 0, fundraiserCount: 0,
    sponsorReceived: 0, sponsorPledged: 0, sponsorCount: 0,
    teamKeeps: 0, creditedToFamilies: 0,
  };
  for (const row of rows) {
    if (row.kind === 'sponsor') {
      r.sponsorCount += 1;
      if (row.sponsorStatus === 'received') r.sponsorReceived += row.totalRaised;
      else r.sponsorPledged += row.totalRaised;
    } else {
      r.fundraiserCount += 1;
      r.fundraiserRaised += row.totalRaised;
    }
    // "Team keeps" and "credited" describe money that has actually moved, so a pledge contributes
    // to neither — it has kept nobody anything yet.
    if (row.kind === 'fundraiser' || row.sponsorStatus === 'received') {
      r.teamKeeps += row.teamNet;
      r.creditedToFamilies += row.totalCredits;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    ...r,
    fundraiserRaised: round(r.fundraiserRaised),
    sponsorReceived: round(r.sponsorReceived),
    sponsorPledged: round(r.sponsorPledged),
    teamKeeps: round(r.teamKeeps),
    creditedToFamilies: round(r.creditedToFamilies),
  };
}
