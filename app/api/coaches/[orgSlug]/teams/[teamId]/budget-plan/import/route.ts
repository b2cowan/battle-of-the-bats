import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, createRepTeamExpense,
  getOrgMemberDisplayName, recordRepTeamImport,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import { composeTwoPieceInstallments } from '@/lib/payable-plan';
import { formatMonthLabel } from '@/lib/coach-budget-months';
import {
  isFundingKind, FUNDING_LINE_KINDS, budgetLineKindForItem, type BudgetItemActualSource,
} from '@/lib/coach-budget-totals';
import { budgetItemSourceForCategory } from '@/lib/coach-budget-item-tiers';
import {
  itemVisibleToTeam, categoryVisibleToTeam, isDuplicateItemLineError, parseBudgetItemDirection,
  type OwnedBudgetItem, type OwnedBudgetCategory,
} from '@/lib/coach-budget-items';
import {
  reviewBudgetRows, reviewPayableRows, moneyValue, toKnownCategories, wordsFor,
  snapBudgetRowsToLibrary, snapPayableRowsToLibrary,
  MAX_IMPORT_ROWS,
  type DraftBudgetRow, type DraftPayableRow, type KnownCategory, type ExistingBudgetLine,
} from '@/lib/coach-budget-import';

/**
 * Commit a reviewed budget/payables import (chunk H2).
 *
 * Contracts this route keeps, all of them hard-won elsewhere in the portal:
 *
 *  â¢ **Preview first, never all-or-nothing.** Rows are written one at a time and a failure does
 *    NOT abort the rest; the response names what landed and what didn't. A coach importing forty
 *    lines with one bad row gets thirty-nine lines plus an honest error.
 *  â¢ **Never dress a total failure as success.** Zero writes returns an error, not "0 imported".
 *  â¢ **The sheet's order is the budget's order.** `sort_order` is written explicitly, continuing
 *    from the plan's current end â display order has no other tiebreaker.
 *  â¢ **The server reviews independently.** The client's preview may be stale if another coach
 *    edited the plan while the sheet was open, so the outcome is recomputed here against live data
 *    and a row the client called an "add" can become an "update" (or be refused) at this point.
 *  â¢ **Taxonomy ownership is checked**, exactly as the single-line POST does: a category or item
 *    must be a platform default or belong to THIS org.
 */

const NAME_MAX = 200;
const NOTE_MAX = 500;

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function toBudgetDraft(raw: unknown, index: number): DraftBudgetRow {
  const source = (raw ?? {}) as Record<string, unknown>;
  const periods = Array.isArray(source.periods) ? source.periods : [];
  return {
    rowNumber: typeof source.rowNumber === 'number' ? source.rowNumber : index + 1,
    categoryName: str(source.categoryName, NAME_MAX),
    lineName: str(source.lineName, NAME_MAX),
    amount: str(source.amount, 40),
    notes: str(source.notes, NOTE_MAX),
    periods: periods.slice(0, 36).map(p => {
      const period = (p ?? {}) as Record<string, unknown>;
      return { month: str(period.month, 7), amount: str(period.amount, 40) };
    }).filter(p => /^\d{4}-\d{2}$/.test(p.month)),
    /* Which BAND of the plan file this row came from. Narrowed rather than trusted: anything that is
       not the word 'in' is money out, which is also what every payload written before this field
       existed meant. The client is not the authority here — the route re-reviews every row against
       live data — but a row's side decides which words it may match and which kind it writes, so it
       is normalised at the door like every other field.
       ⚠ THROUGH `parseBudgetItemDirection`, WHICH IS THE ONE PARSER FOR THIS RULE (/simplify,
       2026-09-10). It carries the comment "ONE PARSER, THREE WRITE DOORS", written after the coach
       item POST, the coach item PATCH and the admin item POST had each grown their own copy and
       drifted — and this was a fourth copy sitting in the same file that imports three other names
       from that module. `?? 'out'` is the same fallback the hand-written ternary computed for a
       missing field, a wrong type or a garbage string. */
    direction: parseBudgetItemDirection(source.direction) ?? 'out',
  };
}

function toPayableDraft(raw: unknown, index: number): DraftPayableRow {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    rowNumber: typeof source.rowNumber === 'number' ? source.rowNumber : index + 1,
    payee: str(source.payee, NAME_MAX),
    description: str(source.description, NAME_MAX),
    categoryName: str(source.categoryName, NAME_MAX),
    amount: str(source.amount, 40),
    depositAmount: str(source.depositAmount, 40),
    depositDueDate: str(source.depositDueDate, 10),
    balanceAmount: str(source.balanceAmount, 40),
    balanceDueDate: str(source.balanceDueDate, 10),
  };
}

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const shape = body?.shape === 'payables' ? 'payables' : 'budget';
  const incoming: unknown[] = Array.isArray(body?.rows) ? body.rows : [];

  // Receipt fields (migration 231) â description of the ACT, never of the write. They are
  // normalized to the values the CHECK constraints allow and are used nowhere else, so a client
  // sending nonsense degrades the history line and cannot touch what lands in the budget.
  const sheetShape: 'month-grid' | 'list' | 'payables' =
    body?.sheetShape === 'list' ? 'list' : body?.sheetShape === 'payables' || shape === 'payables' ? 'payables' : 'month-grid';
  const importSource: 'paste' | 'file' = body?.source === 'file' ? 'file' : 'paste';
  const sourceFilename = typeof body?.sourceFilename === 'string' && body.sourceFilename.trim()
    ? body.sourceFilename.trim().slice(0, 200)
    : null;

  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No rows were sent.' }, { status: 400 });
  }
  if (incoming.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `You can import up to ${MAX_IMPORT_ROWS} rows at a time.` },
      { status: 400 },
    );
  }

  // The taxonomy this org may link to: platform defaults + its own custom entries.
  const { data: categoryRows } = await supabaseAdmin
    .from('budget_categories')
    /* ⚠ `income_source` rides along because THE SHELF DECIDES who fills a money-in word in (mig
       285): a money-in word this import invents takes its `actual_source` from the heading it lands
       under, exactly as the Add-item door does. The items' own `actual_source` is the same fact for
       a word that already exists, and is what a line's KIND is derived from. */
    .select('id, name, org_id, team_id, income_source, budget_items(id, name, org_id, team_id, direction, actual_source)')
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    // Team-visible categories only - the same filter the coach's own picker applies, so an
    // imported sheet can never link a team budget to an org-admin-only category.
    .in('scope', ['team', 'both']);

  const visibleCategoryRows = (categoryRows ?? [])
    /* ⚠⚠ AND THIS TEAM'S VISIBLE CATEGORIES ONLY (mig 277) — the same rule the items below have
       carried since mig 240, now that the heading has an owner too. Without it an imported sheet
       could name another team's private heading in free text, match it, and file this team's whole
       plan under a category its own picker will never show it. An import matches on WORDS, which is
       exactly why it needs the ownership filter the picker applies: a name is guessable. */
    .filter(c => categoryVisibleToTeam(c as OwnedBudgetCategory, ctx!.org.id, team.id))
    .map((c: Record<string, unknown>) => ({
      row: c,
      // ⚠ THIS TEAM'S VISIBLE ITEMS ONLY (mig 240) — platform, club-published, or its own. Another
      // team's word must never be matched against, or an import would silently file this team's
      // budget under vocabulary its own picker will not even show.
      visible: ((c.budget_items ?? []) as Array<Record<string, unknown>>)
        .filter(i => itemVisibleToTeam(i as OwnedBudgetItem, ctx!.org.id, team.id)),
    }));

  /* ⚠⚠ ONE BUILDER, SHARED WITH THE THREE SCREENS THAT MOUNT THE IMPORT SHEET (2026-09-10). This
     route used to write the mapping out by hand, and its own comment called that "the second place
     in the product that builds a `KnownCategory`" — correct, and the day the two sides had to be
     held apart, both places needed the same change made the same way by two different people.
     `toKnownCategories` holds that split (mig 248: a word's side is part of its identity); this
     route asks it rather than re-deriving it. */
  const categories: KnownCategory[] = toKnownCategories(
    visibleCategoryRows.map(({ row, visible }) => ({
      id: row.id as string,
      name: row.name as string,
      items: visible.map(i => ({
        id: i.id as string,
        name: i.name as string,
        orgId: (i.org_id as string | null) ?? null,
        teamId: (i.team_id as string | null) ?? null,
        direction: i.direction as string,
      })),
    })),
  );
  /** The shelf's own answer to who fills its money-in words in — for a word this run has to create. */
  const categoryIncomeSource = new Map(
    visibleCategoryRows.map(({ row }) => [row.id as string, (row.income_source as string | null) ?? null]),
  );
  /** A word's own stored source, which is what its line's KIND derives from. */
  const itemActualSource = new Map<string, BudgetItemActualSource>();
  for (const { visible } of visibleCategoryRows) {
    for (const i of visible) itemActualSource.set(i.id as string, i.actual_source as BudgetItemActualSource);
  }
  const categoryByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]));

  const created: Array<{ rowNumber: number; name: string }> = [];
  const updated: Array<{ rowNumber: number; name: string }> = [];
  const failed: Array<{ rowNumber: number; name: string; error: string }> = [];
  const skipped: Array<{ rowNumber: number; name: string; reason: string }> = [];

  if (shape === 'payables') {
    // ââ payables âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    const { data: existingRows } = await supabaseAdmin
      .from('rep_team_expenses')
      .select('description')
      .eq('program_year_id', programYear.id);

    const reviewed = reviewPayableRows(
      snapPayableRowsToLibrary(incoming.map(toPayableDraft), categories),
      categories,
      (existingRows ?? []).map((e: { description: string }) => e.description),
    );

    for (const row of reviewed) {
      if (row.outcome === 'blocked') {
        skipped.push({ rowNumber: row.rowNumber, name: row.description || `Row ${row.rowNumber}`, reason: row.reason ?? 'Could not be read' });
        continue;
      }
      const deposit = moneyValue(row.depositAmount);
      const balance = moneyValue(row.balanceAmount);
      /* The sheet's split, as the PLAN it means (Payables Rebuild P2). The sheet still speaks
         deposit/balance - coaches' own spreadsheets do - but the record stores installments now.
         The remainder conventions (a blank half takes the remainder; each half's missing date
         falls back to the other's) are `composeTwoPieceInstallments`, shared with the payables
         form so the sheet and the form cannot drift. */
      const split = (balance != null && balance > 0) || !!row.balanceDueDate;
      const installments = split
        ? composeTwoPieceInstallments({
            total: row.total,
            depositAmount: deposit,
            depositDueDate: row.depositDueDate || null,
            balanceAmount: balance,
            balanceDueDate: row.balanceDueDate || null,
            fallbackDueDate: tournamentToday(),
          })
        : [{ amount: row.total, dueDate: row.depositDueDate || tournamentToday() }];
      try {
        // The SAME writer the Add Payable form uses â so an imported payable carries its payee
        // and its author in the columns that hold them, rather than a second shape of the row.
        await createRepTeamExpense({
          orgId: ctx!.org.id,
          teamId: team.id,
          programYearId: programYear.id,
          // The stored type is unchanged â chunk H generalised the WORDS, not the data.
          expenseType: 'tournament_payable',
          description: row.description,
          category: row.categoryName || null,
          installments,
          payeePayer: row.payee || null,
          createdBy: ctx!.user.id,
        });
        created.push({ rowNumber: row.rowNumber, name: row.description });
      } catch (e: unknown) {
        failed.push({
          rowNumber: row.rowNumber,
          name: row.description,
          error: e instanceof Error ? e.message : 'Could not be saved',
        });
      }
    }
  } else {
    // ââ budget lines âââââââââââââââââââââââââââââââââââââââââââââââââââââ
    /* ⚠⚠ EVERY LINE, BOTH SIDES — AND THE SIDE IS PART OF THE MATCH (2026-09-10). This read was
       cost-only, with a comment declaring "an imported sheet row is a cost by definition (the sheet
       has no column for a kind)". That was true of the DATA and false of the FILE: the plan's own
       export writes two bands, and hiding the money-in lines from the matcher is precisely why
       every one of them re-imported as a NEW COST inside a revenue category. `ExistingBudgetLine`
       carries its side now and `reviewBudgetRows` matches within it, which keeps the thing the old
       filter was protecting — a row called "Fundraising" can still never overwrite the funding line
       — in BOTH directions rather than by concealment. */
    const { data: lineRows } = await supabaseAdmin
      .from('rep_budget_lines')
      /* ⚠ `item_id` rides along for TWO rules now: the one-word-one-line guard below (owner ruling
         2026-09-09), and — since 2026-09-10 — the MATCH itself, because a line's word is its
         identity on the plan and its description is only what the coach typed. */
      .select('id, description, item_id, total_amount, sort_order, line_kind, budget_categories(name)')
      .eq('program_year_id', programYear.id)
      .order('sort_order');

    const existing: ExistingBudgetLine[] = (lineRows ?? [])
      .map((l: Record<string, unknown>) => ({
        id: l.id as string,
        description: l.description as string,
        categoryName: ((l.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
        totalAmount: (l.total_amount as number) ?? 0,
        itemId: (l.item_id as string | null) ?? null,
        // The stored kind, narrowed through the ONE home for that question — not a hand-written
        // list of money-in kinds, which has gone stale twice in this file alone.
        direction: (isFundingKind(l.line_kind as string | null) ? 'in' : 'out') as 'in' | 'out',
      }));

    // Continue the plan's existing order rather than restarting at 0 â write order IS display
    // order, and an import must land after what the coach already has, in sheet order.
    // â  Measured over EVERY line, funding included: ordering is a property of the whole plan, and
    // taking the maximum over the cost-only subset lets an imported line collide with the
    // sort_order of a funding line that already holds it.
    /* ⚠⚠ ONE WORD, ONE LINE ON A PLAN, THROUGH THIS DOOR TOO (owner ruling 2026-09-09, migration
       286). This is one of the three doors that create budget lines, and the only one where the
       coach is not watching the plan while it happens — so a sheet holding two rows that snap to
       the same library word used to mint a twin in silence.
       Two lookups, and both are needed: the plan's existing words catch a NEW row for a word that
       is already there, and the words written during this run catch two rows in the SAME file
       naming one word — which the review cannot see, because it matches sheet text against the
       database, never rows against each other. */
    const lineIdByItem = new Map<string, string>();
    for (const l of (lineRows ?? []) as Array<Record<string, unknown>>) {
      if (l.item_id) lineIdByItem.set(l.item_id as string, l.id as string);
    }
    const itemsWrittenThisRun = new Set<string>();

    let nextSortOrder = (lineRows ?? []).reduce(
      (max: number, l: Record<string, unknown>) => Math.max(max, (l.sort_order as number) ?? 0), -1,
    ) + 1;

    /* The client already snapped these against the same library before showing the coach the
       preview. Doing it again here is the same belt-and-braces as reviewing again: this route
       never trusts that the payload came from our own screen. */
    const reviewed = reviewBudgetRows(snapBudgetRowsToLibrary(incoming.map(toBudgetDraft), categories), categories, existing);

    for (const row of reviewed) {
      const label = row.lineName || `Row ${row.rowNumber}`;
      if (row.outcome === 'blocked') {
        skipped.push({ rowNumber: row.rowNumber, name: label, reason: row.reason ?? 'Could not be read' });
        continue;
      }

      const category = categoryByName.get(row.categoryName.trim().toLowerCase());
      // Reviewed rows always carry a known category; this is belt-and-braces against a client
      // that posted something the review didn't see.
      if (!category) {
        skipped.push({ rowNumber: row.rowNumber, name: label, reason: 'Category not found' });
        continue;
      }
      /* ⚠ AN IMPORTED LINE MUST END UP WITH AN ITEM (mig 240) — the item is what NAMES it on the
         plan and on Budget vs. Actual, so a row that matched nothing in the library would arrive
         nameless, under "Not itemized", and be invisible to the report it was imported for. So a
         sheet name the library does not know CREATES a team item from it: the same thing the coach
         would have done in the picker, done for them by the door they actually used. It belongs to
         this team alone, like every other item a coach creates. */
      /* ⚠ AND ON THE ROW'S OWN SIDE, ALWAYS. `wordsFor` is the one answer to "which words may this
         row become" — shared with the snapper, the preview's type-ahead and the new-word verdict,
         so a money-in row can neither match nor mint a spending word. */
      const words = wordsFor(category, row.direction);
      let item = words.find(i => i.name.trim().toLowerCase() === row.lineName.trim().toLowerCase());
      if (!item && row.lineName.trim()) {
        const name = row.lineName.trim().slice(0, 80);
        /* ⚠ THE SHELF DECIDES WHO FILLS IT IN (mig 285), never this door's own guess — the same call
           `budgetItemSourceForCategory` makes for the Add-item form, so a word invented here is
           indistinguishable from one the coach typed in the picker. A money-out word is always
           'typed', which the database's own CHECK also insists on.
           ⚠ DERIVED ONCE (/simplify, 2026-09-10). It was computed twice from the same two inputs —
           once into the insert and once into the map the line's KIND is read from — which is two
           chances for a future edit to change one and not the other, and the two disagreeing is
           precisely the "kind disagrees with its item" state migration 280 exists to forbid. */
        const newWordSource = budgetItemSourceForCategory(
          row.direction,
          { income_source: categoryIncomeSource.get(category.id) ?? null },
        );
        const { data: madeItem, error: itemError } = await supabaseAdmin
          .from('budget_items')
          .insert({
            category_id: category.id, org_id: ctx!.org.id, team_id: team.id,
            name, is_default: false, is_misc: false,
            /* ⚠ THE ROW'S OWN SIDE, READ FROM THE FILE'S BANDS (mig 246 + 2026-09-10). This was
               hardcoded `'out'`, on the reasoning that "the importer refuses money-IN lines
               outright" — true until the day the file's FUNDING band could be read, and the reason
               a re-imported plan minted "Chocolate Sale" as something the team SPENDS money on. */
            direction: row.direction,
            actual_source: newWordSource,
          })
          .select('id, name')
          .single();
        if (madeItem) {
          item = { id: madeItem.id as string, name: madeItem.name as string };
          // The word this run invented takes the source it was WRITTEN with, so the line's kind
          // below reads it from the same place a pre-existing word's does.
          itemActualSource.set(item.id, newWordSource);
          // Keep the in-memory library current so two sheet rows naming the same thing land on ONE
          // item rather than racing to create it twice.
          words.push(item);
        } else if (itemError?.code === '23505') {
          /* ⚠ SOMEBODY ELSE CREATED IT BETWEEN OUR READ AND OUR WRITE — a second import in another
             tab, or a coach using "+ Add custom item" mid-import. Swallowing this left `item`
             undefined and wrote the line with NO item, reported as a clean import: the row lands
             under "Not itemized" and neither coach is told. Take the winner instead. */
          /* ⚠ `direction` IS PART OF THE KEY THIS RECOVERY IS RECOVERING FROM (mig 248). Without
             it, a team already holding this name on the OTHER side matches two rows and
             `maybeSingle()` fails — turning a race we know how to survive into "Could not add this
             to your item list", which tells the coach nothing they can act on. It is the ROW's side
             now, not a literal: a money-in row recovering onto the cost word of the same name would
             file money coming in as spending, which is the very thing this build exists to stop. */
          const { data: winner } = await supabaseAdmin
            .from('budget_items')
            .select('id, name, actual_source')
            .eq('category_id', category.id).eq('org_id', ctx!.org.id).eq('team_id', team.id)
            .eq('direction', row.direction)
            .ilike('name', name)
            .maybeSingle();
          if (winner) {
            item = { id: winner.id as string, name: winner.name as string };
            itemActualSource.set(item.id, winner.actual_source as BudgetItemActualSource);
            words.push(item);
          }
        }
        if (!item) {
          // Still nothing to name it with — refuse the row rather than importing a nameless line
          // and calling it a success.
          failed.push({ rowNumber: row.rowNumber, name: label, error: 'Could not add this to your item list' });
          continue;
        }
      }

      /* ⚠⚠ EVERY ROW PAST THIS POINT HAS A WORD, AND IT REFUSES RATHER THAN DEFAULTS (/simplify,
         2026-09-10). It cannot be reached today: a nameless row is blocked in the review, and every
         path through the block above either sets `item` or `continue`s. It is here because the four
         places below USED to hedge — `item ? … : undefined`, `item && …`, `item?.id ?? null` twice,
         and worst of all a `line_kind` falling back to `'cost'`. That last one is not an inert
         placeholder the way a null item id is; it is a MEANING, and if the invariant ever moved it
         would silently file money coming in as SPENDING — the exact state migration 280 and this
         whole build exist to forbid. `budgetLineKindForItem` two modules away made the same call in
         the same words: "a loud failure on a developer's own mistake is the cheaper of the two".
         Stated once, here, so the rest of the loop can simply say what it means. */
      if (!item) {
        failed.push({ rowNumber: row.rowNumber, name: label, error: 'Could not work out what this row is — it was left out.' });
        continue;
      }

      /* ⚠ THE WORD IS ALREADY SPOKEN FOR — SKIPPED, NOT SUMMED AND NOT OVERWRITTEN. A file has one
         row per word, so a second row naming a word this plan (or this file) already used is a
         mistake in the sheet, and the coach is the only one who can say which figure they meant.
         Summing would invent an amount nobody typed; overwriting would lose one in silence, which
         is what used to happen when two rows shared a match. It lands in the skipped list with the
         word named, beside every other row that needs a look. */
      const takenLineId = itemsWrittenThisRun.has(item.id) ? 'this-file' : lineIdByItem.get(item.id);
      if (takenLineId && takenLineId !== row.matchedLineId) {
        skipped.push({
          rowNumber: row.rowNumber,
          name: label,
          reason: takenLineId === 'this-file'
            ? `${item.name} appears more than once in this file — only the first row was imported.`
            : `${item.name} is already on this plan. Change that line instead, or give this row a different item.`,
        });
        continue;
      }

      let lineId = row.matchedLineId;
      /* ⚠⚠ THE KIND IS DERIVED FROM THE WORD, NEVER DEFAULTED (mig 280, and the one home for that
         question is `budgetLineKindForItem`). This insert wrote no `line_kind` at all and took the
         column default, `cost` — which was invisible for as long as every row was a cost, and is
         the write half of the round-trip defect: a fundraising line re-imported would have landed
         with a money-IN item and a `cost` kind, the exact "the kind disagrees with its item" state
         mig 280 exists to make unexpressible. Reading the item's own source means a fifth money-in
         kind is covered by nothing more than being declared. */
      const lineKind = budgetLineKindForItem({
        direction: row.direction,
        actualSource: itemActualSource.get(item.id) ?? 'typed',
      });
      if (row.outcome === 'update' && lineId) {
        const write = supabaseAdmin
          .from('rep_budget_lines')
          .update({
            total_amount: row.total,
            notes: row.notes || null,
            category_id: category.id,
            item_id: item.id,
            // Written on the way through so the line's kind can never disagree with the word it now
            // names — the same derivation the single-line edit door goes through.
            line_kind: lineKind,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lineId)
          .eq('program_year_id', programYear.id);
        /* ⚠ A ROW MAY ONLY EVER CHANGE A LINE ON ITS OWN SIDE, and it is SYMMETRIC now where it used
           to be a one-way "cost rows may not touch money-in lines". A money-in row must not reach a
           cost line either; the review above already refuses to match one, and this is that same
           rule restated at the write.
           ⚠ THIS COMMENT USED TO SAY THE MATCHED ID "CAME FROM A PAYLOAD THE CLIENT SENDS BACK",
           AND THAT WAS FALSE (/review, 2026-09-10) — inherited from an earlier draft and extended
           without being checked. `toBudgetDraft` never reads `matchedLineId`; it is computed HERE by
           `reviewBudgetRows`, against lines this route read itself under this program year. A
           crafted id in the request body is discarded before it can reach this filter. The guard is
           still worth keeping — it is the rule stated where the write happens — but it defends an
           invariant, not a hostile input, and a comment that misnames its own threat model teaches
           the next reader the wrong thing about where this door's trust boundary sits.
           ⚠⚠ THE HAND-WRITTEN LIST WENT STALE TWICE, so it is gone. It named only 'funding' until
           2026-08-15 — and its replacement comment then claimed "both kinds" while migration 274 was
           about to add a THIRD money-in kind (2026-09-02), which nobody came back for. Built from
           the shared list, so a fifth kind is covered by nothing more than being declared. */
        const { error } = await (row.direction === 'in'
          ? write.in('line_kind', FUNDING_LINE_KINDS)
          : write.not('line_kind', 'in', `(${FUNDING_LINE_KINDS.join(',')})`));
        if (error) { failed.push({ rowNumber: row.rowNumber, name: label, error: error.message }); continue; }
        updated.push({ rowNumber: row.rowNumber, name: label });
      } else {
        const { data, error } = await supabaseAdmin
          .from('rep_budget_lines')
          .insert({
            org_id: ctx!.org.id,
            team_id: team.id,
            program_year_id: programYear.id,
            category_id: category.id,
            item_id: item.id,
            description: row.lineName,
            total_amount: row.total,
            notes: row.notes || null,
            line_kind: lineKind,
            sort_order: nextSortOrder,
          })
          .select('id')
          .single();
        if (error || !data) {
          /* ⚠ THE INDEX REFUSED A SECOND LINE ON ONE WORD — say so in the coach's words rather than
             Postgres's. The map above catches the ordinary case; this is the race it cannot close,
             where a single-line save lands between this run's read and this insert. */
          failed.push({
            rowNumber: row.rowNumber,
            name: label,
            error: isDuplicateItemLineError(error)
              ? `${item.name} is already on this plan — change that line instead.`
              : (error?.message ?? 'Could not be saved'),
          });
          continue;
        }
        lineId = data.id as string;
        nextSortOrder += 1;
        created.push({ rowNumber: row.rowNumber, name: label });
      }
      // Written — so a later row in this same file naming the same word is caught above.
      itemsWrittenThisRun.add(item.id);

      // Payment periods, when the sheet had month columns. A full replace, matching the periods
      // endpoint's own contract: the sheet is the coach's statement of when this line is paid.
      if (!lineId) continue;
      const periods = row.periods
        .map(p => ({ month: p.month, amount: moneyValue(p.amount) ?? 0 }))
        .filter(p => p.amount > 0);

      if (periods.length === 0) continue;
      const periodSum = Math.round(periods.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      // Periods must sum to the line total (Â±2Â¢) or the DB's own invariant is broken. The review
      // computes the total FROM the periods, so this only fires if a client edited one and not
      // the other â in which case the line still lands, without a schedule it can't honour.
      if (Math.abs(periodSum - row.total) > 0.02) {
        skipped.push({
          rowNumber: row.rowNumber,
          name: label,
          reason: 'Saved as a single amount â its month figures didnât add up to the total.',
        });
        continue;
      }

      await supabaseAdmin.from('rep_budget_periods').delete().eq('budget_line_id', lineId);
      const { error: perErr } = await supabaseAdmin.from('rep_budget_periods').insert(
        periods.map((p, i) => ({
          budget_line_id: lineId,
          // What the coach will actually read on the line form â "Mar '26", not a month key.
          period_label: formatMonthLabel(p.month),
          // A month column means "this is due in this month" â the 1st is the only honest day to
          // pick, and the coach can move it on the line's own form.
          period_date: `${p.month}-01`,
          amount: p.amount,
          sort_order: i,
        })),
      );
      if (perErr) {
        skipped.push({ rowNumber: row.rowNumber, name: label, reason: 'Saved, but its month split could not be stored.' });
      }
    }
  }

  if (created.length === 0 && updated.length === 0) {
    // Every row failed. The request succeeded but the coach got nothing â never dress that up.
    const first = failed[0]?.error ?? skipped[0]?.reason;
    return NextResponse.json(
      { error: first ? `Nothing was imported. ${first}` : 'Nothing could be imported.', created, updated, failed, skipped },
      { status: 400 },
    );
  }

  // The receipt â written only once something actually landed, and only AFTER the early return
  // above, so "Recent imports" can never list an import that imported nothing. Best-effort by
  // contract: `recordRepTeamImport` never throws, because a lost history line must not cost a
  // coach the rows they just successfully imported.
  //
  // â  The attribution name comes from ONE indexed membership lookup, not from the season's staff
  // list. Resolving it through `getRepTeamStaffForYear` would query every coach on the team and
  // then call the Supabase Auth admin API once per coach â an N+1 on the request path of every
  // import, to learn the display name of the one person who is already authenticated here.
  const createdByName = await getOrgMemberDisplayName(ctx!.org.id, ctx!.user.id).catch(() => null);
  await recordRepTeamImport({
    teamId: team.id,
    orgId: ctx!.org.id,
    programYearId: programYear.id,
    dataset: shape === 'payables' ? 'payables' : 'budget_lines',
    shape: sheetShape,
    source: importSource,
    sourceFilename,
    rowsCreated: created.length,
    rowsUpdated: updated.length,
    rowsSkipped: skipped.length,
    rowsFailed: failed.length,
    createdBy: ctx!.user.id,
    createdByName,
  });

  return NextResponse.json({ created, updated, failed, skipped });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/import' });
