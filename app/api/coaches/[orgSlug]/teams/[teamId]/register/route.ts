import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { getSeasonName } from '@/lib/db';
import { loadSeasonRegisterRows } from '@/lib/coach-register-book';
import { buildBook } from '@/lib/coach-register';

/**
 * GET /api/coaches/[orgSlug]/teams/[teamId]/register — the season's whole book.
 *
 * ⚠⚠ EVERY MOVEMENT OF CASH ON HAND, AND NOTHING ELSE. The register's headline rule is that the
 * balance at Today IS Cash on hand (plan §4.2), which only holds if this route emits exactly the
 * records `money-summary` counts — no more, no fewer. **The two are a matched pair: a source added
 * to one and not the other breaks the identity silently**, because both figures still look
 * plausible. When you touch either, read the other.
 *
 * Working season only — no `?year=` here or anywhere near it
 * (`tests/unit/coach-history-endpoint-guard.test.ts` is the contract).
 *
 * ⚖⚖ **THIS FILE USED TO SAY "NOTHING PENDING A DECISION EVER APPEARS." THAT IS NO LONGER TRUE, and
 * the change is an owner ruling (2026-08-17, money redesign P4), recorded here rather than quietly
 * edited away.** A club request awaiting an answer now appears in the FORWARD view — never on the
 * settled book, never in Cash on hand, never in the Budget Plan, never on the report. The argument
 * that overturned it was that this book already carries a sponsor PLEDGE in the same view, and a
 * pledge a sponsor may not honour is the same species of uncertainty as a request a club may
 * decline. The full reasoning sits on the loop that emits the row.
 *
 * 🔒 The rule that survives intact: **nothing undecided may touch a settled figure.** The identity
 * above is an identity at TODAY, and everything projected sits strictly beyond it.
 */

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠⚠ THE ASSEMBLY LIVES IN lib/coach-register-book.ts (2026-08-25). It moved because
     `Start next season` now carries this season's closing cash into the next one's opening balance
     (mig 262) and has to compute it from THIS walk — a figure that gets written to the database
     must not come from a second reading of the same records. Nothing about which records are cash
     changed; that module's header carries the whole rule. */
  const rows = await loadSeasonRegisterRows(programYear, teamId);

  /* ⚠⚠ THE BOOK OPENS ON WHAT THE SEASON WAS HANDED (mig 262). It is not a row and never becomes
     one — no kind, no filter, no export line — it is where the running balance STARTS, so every
     balance down the page and the projection past Today are one continuous line. A season that
     carried nothing opens at zero, exactly as every season did before this. */
  const book = buildBook(rows, programYear.openingBalance ?? 0);
  return NextResponse.json({
    book: book.book,
    todayIndex: book.todayIndex,
    cashOnHand: book.cashOnHand,
    projectedBalance: book.projectedBalance,
    /* What the season was handed on day one, and by whom (mig 262). The screen names its first
       line with it and links to the one place it can be corrected. Zero on every season that
       carried nothing, which is every season that existed before this shipped. */
    opening: book.opening,
    openingFrom: await getSeasonName(programYear.openingBalanceFromYearId),
    // The filter strip drops its "from Club" option on a standalone team workspace — an option that
    // can never match anything is a dead control, not a reassurance.
    orgLinked: !isTeamWorkspaceOrg(ctx.org),
    /* ⚠ NO `readOnly` FIELD, deliberately. A finished season renders every money surface as a
       record, but the screen already knows that from the season page context and gates every write
       affordance on it — a second answer travelling down with the data would be one more thing that
       can disagree with the first, on the question of whether a coach may change anything. */
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/register' });
