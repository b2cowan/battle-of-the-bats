import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnlessTeamMoneyWrite } from '@/lib/coach-capabilities';
import {
  countBudgetItemUsage, describeBudgetItemUsage, repointBudgetItemReferences,
  itemVisibleToTeam, offeredForSport, mapBudgetItem,
  type OwnedBudgetItem,
} from '@/lib/coach-budget-items';

/**
 * USE A SHARED WORD INSTEAD — a team folds one or more of its own words into a standard or club one
 * (owner ruling 2026-08-16/17, mockup 484b5971 §4).
 *
 * ⚠⚠ THIS IS THE ONLY PLACE IN THE PRODUCT WHERE A WORD WITH HISTORY BEHIND IT DISAPPEARS, and the
 * thing that makes that safe is the re-point, not a refusal. Every other door refuses: the club's
 * delete refuses while any team has filed against a word, the team's own delete refuses while
 * anything at all points at one. Here the records are carried across first, so nothing is left
 * holding a word that has gone.
 *
 * ⚠⚠ AND IT IS THE TEAM THAT PRESSES IT. Publishing promotes a word and does nothing else since P1 —
 * no scan for look-alikes, no absorbing another team's vocabulary. This route is the whole of what
 * remains of merging, and the person pressing the button is the one whose records move. That is what
 * lets the confirmation below be a complete account of the consequences: there is no second team to
 * surprise.
 *
 * The four rules, all ruled and none open:
 *   • **Many onto one.** Several of the team's own words, one target, one confirmation.
 *   • **The target is a STANDARD or CLUB word** — never another team's, never one of their own.
 *   • **Same side only.** The target list is filtered to the sources' direction, so "no money moves"
 *     stays true by construction: the report takes a row's direction from what was filed, never from
 *     the word, and a row can never cross the books here because the word it lands on cannot.
 *   • **Any category** — and the confirmation says so before the button, because it re-files those
 *     records under a different heading on the report.
 *
 * ⚠ WORKING SEASON ONLY. Words are cross-season vocabulary and carry no program year; nothing here
 * reads a `?year=` (`tests/unit/coach-history-endpoint-guard.test.ts` is the contract).
 */
// POST /api/coaches/[orgSlug]/budget-items/merge
//   { teamId, sourceIds: string[], targetId }
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return forbidden();

  const body = await req.json().catch(() => ({}));
  const teamId: string = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  /* ⚠ THE TEAM IS NAMED AND CHECKED — the item must never authorise itself, or any coach in the org
     could fold away any team's words. Through the shared gate, so all four money-write doors in this
     directory answer a blocked coach with the same two sentences (see `denyUnlessTeamMoneyWrite`). */
  const denied = denyUnlessTeamMoneyWrite(assignments, teamId);
  if (denied) return denied;

  /* ⚠ DEDUPED. The same word twice is harmless to the re-point and would double every count in the
     confirmation the coach was shown — the one number this whole screen is judged on. */
  const rawSources: unknown[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
  const sourceIds: string[] = [...new Set(
    rawSources.filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
  )];
  const targetId: string = typeof body.targetId === 'string' ? body.targetId.trim() : '';

  if (sourceIds.length === 0 || !targetId) {
    return NextResponse.json({
      error: 'Pick at least one of your own words, and the shared word to use instead.',
    }, { status: 400 });
  }
  if (sourceIds.includes(targetId)) {
    return NextResponse.json({ error: 'A word cannot be folded into itself.' }, { status: 400 });
  }

  /* One read for the target and every source, with each one's category beside it — the fold needs
     the category to move with the item, and the confirmation needs to name the headings. */
  const { data: rows, error: readError } = await supabaseAdmin
    .from('budget_items')
    /* ⚠ `*` RATHER THAN THE FIELDS THIS HANDLER READS (/review, correctness lens). The reply maps
       the target through `mapBudgetItem`, which reads `suggested_amount`, `sort_order`, `is_default`
       and `created_at` — a hand-picked list left all four `undefined` on a response typed as a whole
       `BudgetItem`. Nothing consumes them today, which is exactly what makes it a trap. */
    .select('*, budget_categories(name, sports)')
    .in('id', [...sourceIds, targetId]);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const byId = new Map((rows ?? []).map(r => [r.id as string, r as Record<string, unknown>]));
  const target  = byId.get(targetId);
  const sources = sourceIds.map(id => byId.get(id));

  /* ⚠ ONE ANSWER FOR "no such word", "another club's" and "another team's". Separating them would
     confirm the existence of another team's rows to anyone who guessed an id — the same reasoning
     every other door in this area uses. */
  if (sources.some(s => !s || s.org_id !== ctx.org.id || s.team_id !== teamId)) {
    return NextResponse.json({
      error: 'You can only fold words your own team created. Standard words and the ones your club '
        + 'shares belong to everybody.',
    }, { status: 403 });
  }
  const found = sources as Array<Record<string, unknown>>;

  /* ⚠ THE TEAM'S SPORT STILL DECIDES WHAT IT MAY USE (mig 241). A target outside this team's sport
     is one its own picker will never show — so folding onto it would file every one of those records
     under a word the coach cannot see or choose again. Checked on the item AND on its category,
     exactly as `resolveBudgetItem` does for every other write path. */
  const team = await getRepTeam(teamId);
  const targetCategory = (target?.budget_categories ?? null) as { name?: string; sports?: string[] | null } | null;
  const targetUsable = target
    && !target.team_id                                                    // club or standard only
    && !target.is_misc                                                    // never offered anywhere
    && itemVisibleToTeam(target as OwnedBudgetItem, ctx.org.id, teamId)
    && offeredForSport(target as OwnedBudgetItem, team?.sport ?? null)
    && (!targetCategory || offeredForSport(targetCategory, team?.sport ?? null));
  if (!targetUsable) {
    return NextResponse.json({
      error: 'Pick a standard or club word to use instead — one your team can choose from its own '
        + 'lists. Another team\'s word is not available here.',
    }, { status: 400 });
  }

  /* ⚠⚠ SAME SIDE, ALWAYS, AND THIS IS THE CHECK "no money moves" RESTS ON. The report takes a row's
     direction from what was actually filed rather than from the word, so a cross-side fold would not
     move a dollar — it would leave an expense filed under an income word, which is worse: the money
     is unchanged and reads as the opposite of itself. The client filters the target list to the
     sources' side, so this only ever fires for a stale tab or a direct caller. */
  const side = target!.direction as string;
  if (found.some(s => s.direction !== side)) {
    return NextResponse.json({
      error: 'A word can only be folded into another on the same side of the books. Pick a target '
        + `that is ${side === 'in' ? 'money in' : 'an expense'}, like the words you chose.`,
    }, { status: 400 });
  }

  /* What is about to move — counted BEFORE anything changes, so the reply names the same number the
     coach agreed to rather than one derived from a world this request has already altered.
     ⚠ TWO NARROW RACES ARE ACCEPTED HERE, both examined and both left deliberately (/review,
     correctness + concurrency lenses, 2026-08-17):
       · A record filed against a source between this count and the re-point IS carried across (the
         update is keyed on the item, not on this list) but is not counted, so the "Done" sentence
         can under-report by one. Reporting the number the coach consented to is the better wrong
         answer than reporting one they never saw.
       · A record filed in the gap between the re-count below and the delete is caught by neither,
         and `ON DELETE SET NULL` then clears its item. Narrow, and it degrades to "the money is
         intact, one record lost its label" — the same behaviour every other delete in this area
         has. Closing it properly needs a database-level constraint, not more application checks. */
  const moving = await countBudgetItemUsage(sourceIds);

  /* ⚠ THE ORG IS PASSED, NOT INFERRED. Another org's admin can point one of their org budget lines
     at this team's word (that writer validates nothing), so a re-point keyed on the item alone would
     rewrite a row belonging to a tenant with no relationship to this fold. See the note on
     `repointBudgetItemReferences`. */
  const repoint = await repointBudgetItemReferences(
    found.map(s => ({ id: s.id as string, name: s.name as string })),
    {
      id: targetId,
      name: target!.name as string,
      categoryId: target!.category_id as string,
      categoryName: (targetCategory?.name as string | undefined) ?? null,
    },
    ctx.org.id,
  );

  /* ⚠⚠ A PARTIAL RE-POINT STOPS HERE AND SAYS SO. Every link is `ON DELETE SET NULL`, so deleting
     the words now would not fail — it would blank the item on precisely the records that did not
     make it across, on a path that had just told the coach their records were safe. Nothing is
     removed, the records that did move stay moved (they are on a real word, filed correctly), and
     the sentence names both halves so the coach can act rather than guess. */
  if (!repoint.ok) {
    return NextResponse.json({
      error: `Only part of that could be moved, so nothing was removed. Your ${repoint.movedLabels.join(', ') || 'records'} `
        + `now use “${target!.name as string}”; the ${repoint.failedLabel} could not be moved and still `
        + `use the words you picked. Nothing has been lost — try again, and only what is left will move.`,
    }, { status: 500 });
  }

  /* ⚠ RE-COUNTED, NOT ASSUMED. A coach in another tab can file a cost against one of these words
     between the re-point and this moment, and that record would be silently unclassified by the
     delete below — the same `ON DELETE SET NULL` behaviour, arriving through a much narrower door.
     The words simply stay; the coach folds again and the straggler comes with it. */
  const leftBehind = await countBudgetItemUsage(sourceIds);
  if (leftBehind.total > 0) {
    return NextResponse.json({
      error: `Your records moved onto “${target!.name as string}”, but ${describeBudgetItemUsage(leftBehind)} `
        + `${leftBehind.total === 1 ? 'was' : 'were'} filed against the old words while that was happening, `
        + `so they have been kept. Fold them again to finish.`,
    }, { status: 409 });
  }

  /* ⚠ OWNERSHIP RE-ASSERTED IN THE WHERE, not merely checked above. Between the read and here the
     rows could have been published (team_id cleared) by a club admin in another tab — and a delete
     keyed on id alone would then remove a word the whole club had just been given. */
  const { data: removed, error: deleteError } = await supabaseAdmin
    .from('budget_items')
    .delete()
    .in('id', sourceIds)
    .eq('org_id', ctx.org.id)
    .eq('team_id', teamId)
    .select('id');

  if (deleteError) {
    /* The records are already safe on the target — that is the half that matters, and saying so is
       the difference between "your money is fine, some tidying is left" and a coach assuming the
       worst about a screen that just moved their whole season. */
    return NextResponse.json({
      error: `Your records now use “${target!.name as string}” and nothing was lost, but the old words `
        + `could not be removed. Open this screen again and remove them — nothing is filed against `
        + `them any more.`,
    }, { status: 500 });
  }

  return NextResponse.json({
    moved: moving,
    removed: (removed ?? []).length,
    item: mapBudgetItem(target as Record<string, unknown>),
  });
}, { route: '/api/coaches/[orgSlug]/budget-items/merge' });
