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

import { stillToCome } from './sponsor-arrivals';

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
 * WHICH BUDGET LINE THIS RECORD'S MONEY COUNTS TOWARDS (mig 285) — the field's own words, in one
 * place, because five surfaces print them: New fundraiser, Edit fundraiser, Edit sponsor, the
 * recording conversation's new-sponsor branch, and both rooms' facts lines.
 *
 * ⚠ THE LABEL CARRIES NO ASTERISK. "Raising for" is pre-filled and changeable, **neither required
 * nor nudged** (owner ruling 2026-09-08) — a coach never has to answer it, only correct it. Marking
 * it required would be the third time this product asked a question it had already answered.
 */
export const RAISING_FOR_LABEL = 'Raising for';
export const RAISING_FOR_HINT: Record<FundraisingKind, string> = {
  fundraiser: 'Which budget line this drive’s money counts towards.',
  sponsor:    'Which budget line this sponsor’s money counts towards.',
};
/** The nudge a LEGACY record meets — the only place a coach ever sees the unlinked state. */
export const RAISING_FOR_NUDGE: Record<FundraisingKind, string> = {
  fundraiser: 'Pick the budget line this drive is raising for',
  sponsor:    'Pick the budget line this sponsor is raising for',
};

/**
 * The word each shelf's picker OPENS ON — a pre-fill, and nothing more.
 *
 * ⚠⚠ A NAME LOOKUP, DELIBERATELY, AND ONLY BECAUSE OF WHAT IT DECIDES. Every other "which word is
 * this?" question in the product is keyed by id or by a column precisely so a rename cannot move
 * money (mig 280's own header argues that at length). This one moves nothing: it chooses which of
 * the shelf's words a NEW form opens with, the coach sees it in the field, and changing it is one
 * click. The alternative — a `is_standard_default` column on the platform library — would be a
 * migration to decide a default value.
 *
 * ⚠ MATCHED CASE-INSENSITIVELY AGAINST THE SHELF'S OWN WORDS, and a miss is not an error: the form
 * simply opens with the shelf's first word instead. Nothing downstream depends on which one it was.
 */
export const RAISING_FOR_DEFAULT_WORD: Record<FundraisingKind, string> = {
  fundraiser: 'Fundraising drive',
  sponsor:    'Team sponsorship',
};

/**
 * WHO RAISED IT, when nobody in particular did (owner ruling 2026-09-08) — the drive entry with no
 * player, no family share and no dues credit.
 *
 * ⚠⚠ ONE SPELLING, EVERYWHERE A COACH READS IT: the Record window's first option, the drive board's
 * Who column, the remove confirmation, the facts line's separate count, the register's cash strip
 * and the demo's seeded world. It replaced "Team collection" and a "not attributed" note in the cash
 * strip, which were the two other names this same row already had.
 *
 * ⚠ IT IS LOAD-BEARING, NOT A NICETY. With Fundraising and Sponsorship words removed from "Other
 * money in", this is the ONLY way hoodie-table money — money a team raised with nobody counting who
 * sold what — gets into the books at all.
 */
export const WHOLE_TEAM_ENTRY_LABEL = 'The whole team';

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
 * WHERE A SPONSORSHIP STANDS, as the one chip on its row and in its room's header (List · Room ·
 * Question Phase B, 2026-09-02). ⚠ DERIVED FROM THE MONEY, NEVER A FIELD: the stored
 * `sponsor_status` flips to `received` on the FIRST cheque, which would chip a half-kept promise
 * "Received" — true of the record, false to a treasurer chasing the other half. So the chip reads
 * the two figures the row already carries: nothing arrived is a pledge; some of a pledge still to
 * come is part received; the promise kept (or money with no promise behind it) is received.
 */
export type SponsorStanding = 'pledged' | 'part' | 'received';

export const SPONSOR_STANDING_LABEL: Record<SponsorStanding, string> = {
  pledged:  'Pledged',
  part:     'Part received',
  received: 'Received',
};

export function sponsorStanding(pledged: number | null, arrived: number): SponsorStanding {
  if (arrived <= 0.005) return 'pledged';
  if (pledged && pledged > arrived + 0.005) return 'part';
  return 'received';
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

/* ⚰⚰ `resolveCredit(total, value, unit)` stood here and was deleted on 2026-09-01 (cleanup tranche
   6) with zero callers. ⚠ THE RULE IT CARRIED IS STILL LAW, WHICH IS THE ONLY REASON THIS COMMENT
   IS LONGER THAN ONE LINE: the DOLLARS ARE AUTHORITATIVE AND THE PERCENT IS ONLY PROVENANCE. A
   percentage is how the coach *entered* a family credit; what lands on a family's dues is a fixed
   amount, snapshotted at the moment it is logged. Storing the percentage as the source of truth
   would mean correcting a sponsor's total months later silently revalued a credit already sitting
   on a bill — the same trap `player_rebate_percent` avoids the same way.

   The arrivals model (migs 268/269) superseded the helper, not the rule: a sponsor's credits are
   resolved against the money that has actually ARRIVED, on the server, at the point each arrival is
   recorded — so a single pure function over one "total" no longer describes the arithmetic. Do not
   restore this as a shortcut for a screen that wants to preview a credit; a preview computed one
   way and a record written another is exactly the disagreement the rule above exists to prevent. */

/**
 * The season figures the Fundraising tab prints above its list.
 *
 * ⚠ A PLEDGE IS NOT MONEY IN. It is carried separately so the summary can say so out loud; folding
 * it into the sponsor total would let a season flatter itself with a cheque nobody has received.
 *
 * ⚠⚠ `sponsorPledged` MEANS STILL TO COME — promise minus arrived, floored at zero, per sponsor —
 * AND IT USED TO MEAN SOMETHING ELSE THAT WAS ALWAYS ZERO (fixed 2026-09-03). It summed
 * `totalRaised` for sponsors whose stored `sponsor_status` was not yet `received`; but that column
 * flips on the FIRST cheque (mig 268 — see `sponsorStanding` above, whose whole existence is that
 * distinction), so a row reaching that branch had by definition received nothing and contributed 0.
 * The tab's "· $X pledged" caption was therefore UNREACHABLE: dead copy claiming to report the
 * outstanding promise on a screen that had never once shown it — one nav level below a Money-hub
 * rail printing the real figure under the same word.
 *
 * The hub's derivation was the correct one, and this is now the same arithmetic (`stillToCome` per
 * sponsor) so the two surfaces cannot disagree. It is also why the row shape gained
 * `pledgedAmount`: the promise cannot be recovered from the arrivals, which is precisely why the
 * old branch could not have computed this figure however it was written.
 *
 * ⚠⚠ AND NOTHING HERE READS `sponsorStatus` ANY MORE — every figure is summed from MONEY (review,
 * 2026-09-04). This is the same ruling `sponsorStanding` above already states for the row's chip
 * ("DERIVED FROM THE MONEY, NEVER A FIELD"); the rollup was simply still reading the field.
 *
 * It is not tidying. `writeSponsorArrivalRow` flips the status in an UNCHECKED write after the
 * arrival and its credits are already committed, and `undoSponsorArrival` decides the same flag
 * from a read taken before its deletes — so a failed write or a concurrent arrival can leave a
 * sponsor whose money HAS landed still stamped `pledged`. Gated on the status, such a row was
 * counted in neither `sponsorReceived` (status says no) nor `sponsorPledged` (`stillToCome` is a
 * SHORTFALL, and there is none once the pledge is met): **the arrived dollars vanished from every
 * tile with nothing on screen to say so.** Reading the money instead cannot lose them.
 *
 * ⚠ Safe because the DATABASE guarantees it, not because the app is careful. Migration 268 §5
 * REFUSES to run while any pledged sponsor's entry carries an accounting row or credit, then
 * deletes the remaining pledged-sponsor entries outright — so post-268 a promise has no entry to
 * sum, and `totalRaised > 0` means money that actually arrived. That is what makes summing
 * unconditionally safe here, and it is why this must NOT be copied to a reader that sums ENTRIES
 * directly: the "promised money counted as banked" defect `isRealisedRecord` exists to prevent was
 * a Critical, and it reached the settlement pot families are paid out of.
 */
export interface FundraisingRollup {
  fundraiserRaised: number;
  fundraiserCount: number;
  sponsorReceived: number;
  sponsorPledged: number;
  /** Sponsors with something still to come — the COUNT behind `sponsorPledged`, so the figure and
   *  its caption are decided by one walk and cannot name different sponsors. */
  sponsorsAwaiting: number;
  sponsorCount: number;
  teamKeeps: number;
  creditedToFamilies: number;
}

export function rollUpFundraising(
  rows: Array<{
    kind: FundraisingKind;
    /** What a sponsor PROMISED. Null on a drive, and on a sponsor recorded without a figure. */
    pledgedAmount?: number | null;
    /** What has actually ARRIVED — arrivals for a sponsor, logged entries for a drive. */
    totalRaised: number;
    teamNet: number;
    totalCredits: number;
  }>,
): FundraisingRollup {
  const r: FundraisingRollup = {
    fundraiserRaised: 0, fundraiserCount: 0,
    sponsorReceived: 0, sponsorPledged: 0, sponsorsAwaiting: 0, sponsorCount: 0,
    teamKeeps: 0, creditedToFamilies: 0,
  };
  for (const row of rows) {
    if (row.kind === 'sponsor') {
      r.sponsorCount += 1;
      // Arrived money, whatever the promise was — so a part-paid sponsor's cheques count here.
      r.sponsorReceived += row.totalRaised;
      // ⚠ NOT AN else-BRANCH, AND THAT IS THE FIX: what is still to come is a property of every
      // sponsor carrying an unmet promise, INCLUDING the part-paid ones the old branch — which
      // read the STATUS — could never reach.
      const awaited = stillToCome(row.pledgedAmount ?? null, row.totalRaised);
      if (awaited > 0.005) r.sponsorsAwaiting += 1;
      r.sponsorPledged += awaited;
    } else {
      r.fundraiserCount += 1;
      r.fundraiserRaised += row.totalRaised;
    }
    // A pledge has kept the team nothing and credited nobody — enforced by the DATA, see above.
    r.teamKeeps += row.teamNet;
    r.creditedToFamilies += row.totalCredits;
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
