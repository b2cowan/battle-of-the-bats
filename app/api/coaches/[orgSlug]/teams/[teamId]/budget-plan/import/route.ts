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
import { isFundingKind, FUNDING_LINE_KINDS } from '@/lib/coach-budget-totals';
import {
  itemVisibleToTeam, categoryVisibleToTeam, isDuplicateItemLineError,
  type OwnedBudgetItem, type OwnedBudgetCategory,
} from '@/lib/coach-budget-items';
import {
  reviewBudgetRows, reviewPayableRows, moneyValue,
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
    .select('id, name, org_id, team_id, budget_items(id, name, org_id, team_id, direction)')
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    // Team-visible categories only â the same filter the coach's own picker applies, so an
    // imported sheet can never link a team budget to an org-admin-only category.
    .in('scope', ['team', 'both']);

  const categories: KnownCategory[] = (categoryRows ?? [])
    /* ⚠⚠ AND THIS TEAM'S VISIBLE CATEGORIES ONLY (mig 277) — the same rule the items below have
       carried since mig 240, now that the heading has an owner too. Without it an imported sheet
       could name another team's private heading in free text, match it, and file this team's whole
       plan under a category its own picker will never show it. An import matches on WORDS, which is
       exactly why it needs the ownership filter the picker applies: a name is guessable. */
    .filter(c => categoryVisibleToTeam(c as OwnedBudgetCategory, ctx!.org.id, team.id))
    .map((c: Record<string, unknown>) => {
      // ⚠ THIS TEAM'S VISIBLE ITEMS ONLY (mig 240) — platform, club-published, or its own. Another
      // team's word must never be matched against, or an import would silently file this team's
      // budget under vocabulary its own picker will not even show.
      const visible = ((c.budget_items ?? []) as Array<Record<string, unknown>>)
        .filter(i => itemVisibleToTeam(i as OwnedBudgetItem, ctx!.org.id, team.id));
      return {
        id: c.id as string,
        name: c.name as string,
        /* ⚠ AND COST WORDS ONLY (mig 248). A word's SIDE is part of what identifies it — a team may
           hold "Grant" as income (the cheque) and "Grant" as an expense (the application fee) — and
           the coach's own picker shows one side at a time. This importer writes cost lines and
           nothing else, so an unfiltered list let a spending row attach itself to an income word
           the coach was never offered, on a screen where they could not see it happen. */
        items: visible
          .filter(i => (i.direction as string) === 'out')
          .map(i => ({ id: i.id as string, name: i.name as string })),
        /* ⚠ COUNTED EVEN THOUGH THIS ROUTE NEVER READS IT (/review, 2026-09-06). It is the field
           that lets the template tell "no cost names yet" from "income names only", and this is the
           second place in the product that builds a `KnownCategory`. Leaving it off here is correct
           only for as long as nobody feeds this list to a reader that shows it — and the day someone
           does, the failure is a category quietly mislabelled on a coach's downloaded file, with no
           gate anywhere able to see it. Two lines now beats that. */
        incomeNameCount: visible.filter(i => (i.direction as string) === 'in').length,
      };
    });
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
    // â  COST lines only. An imported sheet row is a cost by definition (the sheet has no column
    // for a kind), and matching is by DESCRIPTION â so without this filter a row called
    // "Fundraising" would match the team's expected-FUNDING line and quietly overwrite its amount
    // and category, turning money coming in into money going out.
    const { data: lineRows } = await supabaseAdmin
      .from('rep_budget_lines')
      // ⚠ `item_id` rides along for the one-word-one-line guard below (owner ruling 2026-09-09).
      .select('id, description, item_id, total_amount, sort_order, line_kind, budget_categories(name)')
      .eq('program_year_id', programYear.id)
      .order('sort_order');

    // â  COST lines only for MATCHING. An imported sheet row is a cost by definition (the sheet has
    // no column for a kind), and matching is by DESCRIPTION â so without this filter a row called
    // "Fundraising" would match the team's expected-FUNDING line and quietly overwrite its amount
    // and category, turning money coming in into money going out.
    const existing: ExistingBudgetLine[] = (lineRows ?? [])
      .filter((l: Record<string, unknown>) => !isFundingKind(l.line_kind as string | null))
      .map((l: Record<string, unknown>) => ({
        id: l.id as string,
        description: l.description as string,
        categoryName: ((l.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
        totalAmount: (l.total_amount as number) ?? 0,
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
      let item = category.items.find(i => i.name.trim().toLowerCase() === row.lineName.trim().toLowerCase());
      if (!item && row.lineName.trim()) {
        const name = row.lineName.trim().slice(0, 80);
        const { data: madeItem, error: itemError } = await supabaseAdmin
          .from('budget_items')
          .insert({
            category_id: category.id, org_id: ctx!.org.id, team_id: team.id,
            name, is_default: false, is_misc: false,
            /* ⚠ ALWAYS 'out', AND THAT IS A FACT ABOUT THIS DOOR, NOT A DEFAULT (mig 246). The
               importer refuses money-IN lines outright — funding and sponsorship rows are filtered
               at the read and blocked again at the write — so every line it can possibly create an
               item for is a cost. A word invented here therefore belongs on the Expense side, and
               the coach finds it exactly where the row that created it lives. */
            direction: 'out',
          })
          .select('id, name')
          .single();
        if (madeItem) {
          item = { id: madeItem.id as string, name: madeItem.name as string };
          // Keep the in-memory library current so two sheet rows naming the same thing land on ONE
          // item rather than racing to create it twice.
          category.items.push(item);
        } else if (itemError?.code === '23505') {
          /* ⚠ SOMEBODY ELSE CREATED IT BETWEEN OUR READ AND OUR WRITE — a second import in another
             tab, or a coach using "+ Add custom item" mid-import. Swallowing this left `item`
             undefined and wrote the line with NO item, reported as a clean import: the row lands
             under "Not itemized" and neither coach is told. Take the winner instead. */
          /* ⚠ `direction` IS PART OF THE KEY THIS RECOVERY IS RECOVERING FROM (mig 248). Without
             it, a team already holding this name on the INCOME side matches two rows and
             `maybeSingle()` fails — turning a race we know how to survive into "Could not add this
             to your item list", which tells the coach nothing they can act on. */
          const { data: winner } = await supabaseAdmin
            .from('budget_items')
            .select('id, name')
            .eq('category_id', category.id).eq('org_id', ctx!.org.id).eq('team_id', team.id)
            .eq('direction', 'out')
            .ilike('name', name)
            .maybeSingle();
          if (winner) {
            item = { id: winner.id as string, name: winner.name as string };
            category.items.push(item);
          }
        }
        if (!item) {
          // Still nothing to name it with — refuse the row rather than importing a nameless line
          // and calling it a success.
          failed.push({ rowNumber: row.rowNumber, name: label, error: 'Could not add this to your item list' });
          continue;
        }
      }

      /* ⚠ THE WORD IS ALREADY SPOKEN FOR — SKIPPED, NOT SUMMED AND NOT OVERWRITTEN. A file has one
         row per word, so a second row naming a word this plan (or this file) already used is a
         mistake in the sheet, and the coach is the only one who can say which figure they meant.
         Summing would invent an amount nobody typed; overwriting would lose one in silence, which
         is what used to happen when two rows shared a match. It lands in the skipped list with the
         word named, beside every other row that needs a look. */
      const takenLineId = item ? (itemsWrittenThisRun.has(item.id) ? 'this-file' : lineIdByItem.get(item.id)) : undefined;
      if (item && takenLineId && takenLineId !== row.matchedLineId) {
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
      if (row.outcome === 'update' && lineId) {
        const { error } = await supabaseAdmin
          .from('rep_budget_lines')
          .update({
            total_amount: row.total,
            notes: row.notes || null,
            category_id: category.id,
            item_id: item?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lineId)
          .eq('program_year_id', programYear.id)
          /* Belt and braces with the cost-only read above: the matched id came from a payload the
             client sends back, so the write refuses a MONEY-IN line even if that payload is stale
             or crafted.
             ⚠⚠ THE HAND-WRITTEN LIST WENT STALE TWICE, so it is gone. It named only 'funding'
             until 2026-08-15 — and its replacement comment then claimed "both kinds" while
             migration 274 was about to add a THIRD money-in kind (2026-09-02), which nobody came
             back for. So an `other_income` line has been open to being overwritten with a COST
             row's word and amount: the exact "the kind disagrees with its item" state migration
             280 exists to make unexpressible, arriving through the one write door that does not
             go through the derivation. Built from the shared list now, so a fifth kind is covered
             by nothing more than being declared. */
          .not('line_kind', 'in', `(${FUNDING_LINE_KINDS.join(',')})`);
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
            item_id: item?.id ?? null,
            description: row.lineName,
            total_amount: row.total,
            notes: row.notes || null,
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
              ? `${item?.name ?? label} is already on this plan — change that line instead.`
              : (error?.message ?? 'Could not be saved'),
          });
          continue;
        }
        lineId = data.id as string;
        nextSortOrder += 1;
        created.push({ rowNumber: row.rowNumber, name: label });
      }
      // Written — so a later row in this same file naming the same word is caught above.
      if (item) itemsWrittenThisRun.add(item.id);

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
