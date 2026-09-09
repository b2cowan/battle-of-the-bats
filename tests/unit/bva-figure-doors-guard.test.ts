/**
 * **EVERY FIGURE ON A BUDGET-VS-ACTUAL ROW OPENS WHAT IS BEHIND IT** — the teeth on the owner
 * ruling of 2026-09-04 (QA §132, round three).
 *
 * WHY THIS EXISTS, PRECISELY. The statement's rows explained themselves in three different
 * registers at once, and each one had a plausible local reason:
 *
 *   · the ACTUAL column had a permanent sub-row — `"$815.00 paid · $125.00 back"` — rendered
 *     OUTSIDE the row's own expander. On an item with no dated periods there was no expander at
 *     all, so the strip read as the expansion of something that could not be expanded, in card
 *     white against the tint of the rows above it. It named two totals and no records: *which*
 *     payments made that figure was unanswerable on this screen under every data shape. Reproducing
 *     the owner's $815 took five database queries against the live fixture, and that is the whole
 *     case for this file.
 *   · the BUDGET column had a door (the `N lines` caption, added one day earlier) and the actual
 *     column did not, so one report answered "what is behind this number?" on one column and
 *     refused on the other. ⚠ The fix moved the door onto the FIGURE, which immediately made the
 *     caption a second way into the same panel a thumb's width away — so it went back to being
 *     plain text hours later (owner: *"why do I need the 2 lines link at all when I can click the
 *     2500?"*). ⚠⚠ **AND THEN THE CAPTION ITSELF WENT** (owner ruling 2026-09-04, QA §133) — the
 *     third ruling on the same two words in three days, and the first to question the premise
 *     rather than the styling. Every earlier round argued from "nothing else on the row says the
 *     row is a merge"; the owner rejected that as a spiral — *"I don't know how much gas is in my
 *     car until I turn it on... there is nothing bad that would happen for a user to see a closed
 *     row, know it's openable, and just not immediately know the count before opening"*. The rule
 *     that survives is wider than this caption: **a fact the coach will learn by opening the thing
 *     does not need a label promising it.** It came off all three screens and all three export
 *     labels in one go.
 *   · the category bar opened on a click anywhere on the row; the item row opened only on its 13px
 *     chevron — two rows in one table with two different rules.
 *
 * ⚠⚠ **THE PAYLOAD IS THE HALF THAT ROTS SILENTLY, WHICH IS WHY IT IS GUARDED FIRST.** The route
 * used to strip `costs` off every item on the way out, and its comment gave a GOOD reason: the
 * report rendered neither list, and shipping both would have been two arrays of raw records per row
 * for nothing. That reason expired the moment a figure became a door, and nothing about the screen
 * would fail if somebody reinstated the optimisation — the panel would simply open on an empty
 * list. A door onto nothing is the politer face of the dead end this change removed, so it fails
 * here instead.
 *
 * ⚠ **AND THE WORD, WHICH HAS NOW BEEN ARGUED THREE TIMES.** `not planned` beside an unplanned
 * row's name was trimmed (2026-08-15), restored (D5.5, 2026-09-02) and removed again on the built
 * screen (2026-09-04) — *"empty budget items give that away clearly"*. The third reading is the one
 * with the evidence behind it: with a tint AND a dash AND a word all saying one thing, the tint
 * stopped reading as a status and started reading as a GROUPING. This guard does not re-litigate
 * that; it pins the CONSEQUENCE, which is that the row must keep a non-visual carrier. A tint is
 * not readable, so removing the visible word without leaving the hidden sentence would take the
 * fact away from a screen reader entirely — and that regression is invisible to every other gate
 * in this repo.
 *
 * ⚠ IT SCANS CODE, NOT PROSE. Both files explain themselves at length and both explanations
 * contain the exact strings this guard forbids; a scan that counted comments would punish the
 * documentation that makes the rule discoverable. Same `codeOnly` shape as
 * `money-one-arithmetic-guard`, and the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PANEL = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx';
const ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts';
/* Scanned too, because the "N lines" caption lived on three screens and in three export labels and
   was removed from ALL of them in one ruling — a partial re-add is the drift this guards. */
const BUDGET  = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx';
const EXPORTS = 'lib/coach-money-exports.ts';
/* The shared month grid, which draws BOTH drill-in panels — the one behind a spent figure and the
   one behind a planned figure. It is scanned for the rule below: neither may dead-end. */
const GRID = 'components/coaches/MoneyMonthGrid.tsx';

/**
 * Comments stripped, because this guard is about CODE. Block comments go wholesale; line comments
 * only when the line is nothing but a comment, so a `//` inside a string literal is never mistaken
 * for one.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

const panel = codeOnly(readFileSync(join(ROOT, PANEL), 'utf8'));
const route = codeOnly(readFileSync(join(ROOT, ROUTE), 'utf8'));
const grid  = codeOnly(readFileSync(join(ROOT, GRID), 'utf8'));

test('the payload keeps the records behind a row — both lists, or the doors open onto nothing', () => {
  assert.ok(
    !/costs:\s*_costs|_costCount/.test(route),
    'The report route is stripping `costs` off its items again. Both figures on a statement row are '
    + 'doors now: the Budget figure opens the plan lines, the Actual figure opens the payments. '
    + 'Removing either list does not break a render — it opens an empty panel, which is exactly the '
    + 'dead end QA §132 closed. If the payload weight is the problem, the answer is paging the list '
    + 'inside the panel, never dropping it here.',
  );
});

test('the client type still declares both lists, so a dropped field is a type error and not a blank panel', () => {
  for (const field of ['lines:', 'costs:', 'refunds:']) {
    assert.ok(
      panel.includes(field),
      `The statement's item type no longer declares \`${field}\`. That is the only thing standing `
      + 'between a payload regression and a panel that silently opens empty.',
    );
  }
});

test('an unplanned row keeps a carrier a screen reader can actually read', () => {
  /* The visible word is gone by ruling; the tint cannot replace it, because a colour has no
     reading. What must survive is the item row's hidden sentence and the category header's
     `aria-describedby` twin — remove either and the fact leaves the product for a non-visual
     reader without a single gate noticing. */
  assert.ok(
    /srOnly[\s\S]{0,80}not planned/.test(panel),
    'The item row lost its visually hidden "not planned" sentence. The visible word was removed on '
    + '2026-09-04 precisely BECAUSE the dash and the tint already carry it for a sighted reader — '
    + 'neither carries it for anyone else. Restore the hidden sentence, or put the visible word back.',
  );
  assert.ok(
    panel.includes('aria-describedby={noteId}'),
    'The category header lost its `aria-describedby` sentence — see the note above; same reason.',
  );
});

test('the visible "not planned" word has not crept back beside the tint', () => {
  const visible = panel
    .split('\n')
    .filter(l => /not planned/.test(l))
    .filter(l => !/srOnly/.test(l));
  assert.deepEqual(
    visible, [],
    'A visible "not planned" label is back on the statement. It has been argued three times and '
    + 'settled: the em-dash under Budget states it, the tint scans it, and a hidden sentence reads '
    + 'it. A fourth signal is what made the tint read as a grouping rather than a status.',
  );
});

test('both newly-shipped record lists are read through a deploy-skew guard', () => {
  /* ⚠ BOTH FIELDS ARE NEWER THAN A CLIENT THAT MAY ASK FOR THEM — the same deleted helper stripped
     `lines` and `costs` together, so a rolling deploy really does pair a new bundle with a route
     that still omits them. `lines` was guarded on the first pass and `costs` was not, and the
     unguarded read sat in a predicate that runs for EVERY row on every render: the whole statement
     threw before a single figure painted. Typing them optional is what forces the guard; this pins
     the reads themselves. */
  /* ⚠ IT LOOKS FOR THE UNGUARDED FORM, NOT FOR THE GUARDED ONE. Asserting "a guarded read exists"
     passes as soon as ANY one read is guarded, which is exactly the state this finding was: the
     `.map` was safe and the predicate was not. There are only two ways to touch these arrays, so
     both spellings of the raw access are named. */
  for (const field of ['lines', 'costs']) {
    for (const raw of [`item.${field}.length`, `item.${field}.map`, `item.${field}.filter`]) {
      assert.ok(
        !panel.includes(raw),
        `\`${raw}\` is read without a deploy-skew guard. Read it as \`item.${field}?.length ?? 0\` `
        + `or \`(item.${field} ?? [])\`, and keep the field optional so the compiler insists.`,
      );
    }
    assert.ok(
      panel.includes(`${field}?:`),
      `\`${field}\` is no longer optional on the item type — without that, the guard above is advice `
      + 'rather than something the compiler enforces on the next reader.',
    );
  }
});

test('the records panel stands on the portal\'s shared dialog floor', () => {
  /* A hand-rolled overlay has no Escape, no Tab trap, no focus restore and no dialog role. That is
     the defect the §134 walk found on the bill room, and the reason the shared shell exists — so
     this panel uses it rather than re-deriving it and missing the same four things again. */
  assert.ok(
    panel.includes('<QuestionShell'),
    'The records panel is a hand-rolled overlay again. Use QuestionShell: it carries Escape, the '
    + 'Tab trap, focus into the panel on open and focus back to the opener on close. A coach who '
    + 'opens this panel with the keyboard must be able to close it with the keyboard.',
  );
});

test('the row itself opens, on both levels of the table', () => {
  assert.ok(
    panel.includes('shared.rowTappable'),
    'The statement\'s item rows are no longer tappable as a whole. The category bar above them has '
    + 'always opened on a click anywhere; an item row that opens only on its 13px chevron is the '
    + 'same table teaching two rules (owner, 2026-09-04, restating the plan page\'s 2026-08-13 rule).',
  );
  assert.ok(
    /window\.getSelection\(\)\?\.toString\(\)/.test(panel),
    'The tappable row lost its text-selection guard. A click that ends a selection is a copy '
    + 'gesture, not a tap — without this, highlighting an amount to copy it folds the row.',
  );
});

test('every control inside the tappable row stops the row from also toggling', () => {
  /* A nested control that forgets this does TWO things on one click — opens its panel and folds
     the row underneath it, so the panel appears over a table that just moved. */
  const opens = panel.split('\n').filter(l => /openBehind\(item, '(plan|actual)'\)/.test(l));
  assert.equal(
    opens.length, 2,
    `Exactly two controls on a row open the records panel — the Budget figure and the Actual figure — `
    + `and found ${opens.length}. A THIRD is how the "2 lines" caption came to be a second door onto `
    + `the panel the figure beside it already opened (owner, 2026-09-04: "why do I need the 2 lines `
    + `link at all when I can click the 2500?"). One row, one way in per column.`,
  );
  for (const line of opens) {
    assert.ok(
      line.includes('e.stopPropagation()'),
      `A control opening the records panel does not stop propagation:\n${line.trim()}`,
    );
  }
});

test('no surface counts the lines behind a merged row — not a caption, not a suffix', () => {
  /* ⚠⚠ THIS TEST USED TO ASSERT THE OPPOSITE, and that is the point of reading it. For two days it
     REQUIRED the "N lines" caption to exist, on the reasoning that it was "the only thing on the row
     that says the row is a merge". The owner struck down the reasoning rather than the styling
     (2026-09-04, QA §133): a coach who opens the row learns the count, and nothing bad happens in
     the meantime — *"I don't know how much gas is in my car until I turn it on"*.

     Guarded across every surface at once, because the words were kept in step on purpose and a
     partial removal would put the two views of one report back into two vocabularies, which is the
     defect all three earlier rounds of this argument were separately trying to fix.

     ⚠ If you are about to re-add it, the question is not "would this be useful?" — it is: does the
     coach get this fact by opening the thing anyway? If yes, the label is over-explaining, and
     over-explaining is what fills these screens with text. */
  const surfaces: Array<[string, string]> = [
    ['the Budget vs. Actual statement', panel],
    ['the Budget tab (list view + by-period grid)', codeOnly(readFileSync(join(ROOT, BUDGET), 'utf8'))],
    ['the money exports', codeOnly(readFileSync(join(ROOT, EXPORTS), 'utf8'))],
  ];
  /* Deliberately narrow: it matches a count read OFF A ROW (`item.` / `row.`) and printed beside the
     word. It must NOT catch the two counts that survived on their own merits — the "Bring last
     season's plan (12 lines)" button, which sizes an action nothing on screen reveals, and the edit
     form's "already has 2 lines on this plan" hint, which explains why the field beside it just
     changed its label. Neither is a row telling you about itself. */
  const COUNT_BESIDE_LINES = /\b(?:item|row)\.(?:lineCount|lines\.length)\b[^\n]{0,40}\blines\b/;
  for (const [what, src] of surfaces) {
    const hit = src.split('\n').find(l => COUNT_BESIDE_LINES.test(l));
    assert.ok(
      !hit,
      `A line count is back on a merged row in ${what}:\n${(hit ?? '').trim()}\n`
      + 'Owner ruling 2026-09-04 (QA §133) took it off every surface in one go. A fact the coach '
      + 'gets by opening the row does not need a label promising it first.',
    );
  }
  assert.ok(
    !/budget lines'/.test(panel),
    'The plan panel is counting its own list again ("$2,500.00 planned, from 2 budget lines"). Those '
    + 'lines are printed directly underneath that sentence, so it tells the reader the length of the '
    + 'list they are already looking at.',
  );
  assert.ok(
    !panel.includes('lineCountBtn'),
    'The old caption\'s control styling is back — a dotted underline, a focus ring and a 44px touch '
    + 'box. There is no caption left for it to dress.',
  );
});

/**
 * A READ-ONLY COACH MUST NOT MEET A PANEL WITH NO WAY OUT (owner ruling 2026-09-04).
 *
 * The two drill-in panels were asymmetric for exactly one role. A spent figure's panel carries
 * ungated doors ("Open the Ledger", "Open Sponsors"), so an assistant coach gets them. A planned
 * figure's panel has no doors at all — its way out is that every line IS a link, and those links
 * are drawn only for a coach who can write. Take them away and the panel ended.
 *
 * The rule is not "add a button": a coach who can write must NOT see one, because the line beside
 * it lands on the line itself and a second, worse door to the same screen is how a panel becomes a
 * menu. So the door exists exactly when the lines are not links.
 */
test('the plan panel gives a read-only coach a door, and gives a writer none', () => {
  assert.match(
    grid,
    /!canWrite && \(\s*<div className={shared\.modalFooter}>[\s\S]{0,320}?moneySectionHref\(base, 'budget'\)/,
    'The plan panel no longer offers a read-only coach any way out. Every line in it is a link only '
    + 'when the coach can write, so without this door an assistant opens the panel, reads it, and '
    + 'can go nowhere — while the spent-figure panel two inches away hands them "Open the Ledger". '
    + 'Restore the door, or give read-only coaches the line links.',
  );
  assert.ok(
    // ⚠ THE BANG IS THE WHOLE ASSERTION, so the pattern has to refuse to match it: without the
    // lookbehind, "!canWrite" contains "canWrite" and this fires on the very door above.
    !/(?<![!\w])canWrite && \(\s*<div className={shared\.modalFooter}>/.test(grid),
    'The plan panel is offering its budget door to a coach who can WRITE. Their lines already open '
    + 'the exact budget line; a button beside them is a second door to the same screen that lands '
    + 'further from the work.',
  );
});

/**
 * **AND THE RULE ABOVE REACHED THE WRONG PANELS FIRST** (owner, 2026-09-09: *"why aren't we
 * providing button links on the statement modals like we are on the monthly?"*).
 *
 * The 2026-09-04 ruling was written about the MONTHS GRID's two panels and pinned there — the test
 * above even cites the spent panel's ungated doors as the reason the plan panel needed one. Nobody
 * checked the STATEMENT's own panels, which are the same question asked from the other view of the
 * same report. Both of them ended in prose:
 *
 *   · `RecordsBehind`'s actual half closed on *"Edit them on Transactions."* — naming a destination
 *     and refusing to go there, with nothing clickable on it for ANY role, writer included;
 *   · `DuesBehind` closed on *"see Cash for what your account did"* with the same shape.
 *
 * That is the defect the ruling describes, one screen over, surviving the gate written for it.
 * These assertions are on the STATEMENT panel, so the next person to take a door off has to argue
 * with the file that owns the panel rather than with its twin.
 */
test('the statement panel does not dead-end either — every figure it opens has a way out', () => {
  assert.match(
    panel,
    /moneySectionHref\(base, 'ledger', \{ view: 'timeline' \}\)/,
    'The statement\'s spent-figure panel has lost its ledger door. It closes on a sentence naming '
    + 'Transactions; without the button that sentence tells a coach where to go and does not take '
    + 'them, which is the dead end QA §132 closed on the Months grid and this ruling closed here.',
  );
  assert.match(
    panel,
    /Open Player Dues[\s\S]{0,400}?Open the Ledger/,
    'The dues panel ("What families contributed") no longer offers both doors. Its twin on the '
    + 'Months grid answers "dues, actual" with Player Dues AND the Ledger (`cellPanelSpec`); one '
    + 'report giving two answers to one figure is the thing that rule exists to stop.',
  );
  /* ⚠ AND THE PLAN HALF TAKES THE SAME SHAPE THE GRID'S DOES — the door exactly when the lines are
     NOT links. Same rule, same reason, now pinned on both files rather than on one of the two
     surfaces it governs, which is how the statement went a ruling without it. */
  assert.match(
    panel,
    /side === 'plan' \? \(!canWrite && \(\s*<div className={shared\.modalFooter}>/,
    'The statement\'s PLAN panel has lost its read-only door. Its lines are links only for a coach '
    + 'who can write, so without it an assistant opens the panel, reads it, and can go nowhere.',
  );
  assert.ok(
    !/side === 'plan' \? \((?<![!\w])canWrite && /.test(panel),
    'The statement\'s plan panel is offering its budget door to a coach who can WRITE. Their lines '
    + 'already open the exact budget line; a button beside them is a second door to the same screen '
    + 'that lands further from the work.',
  );
});

/**
 * **A DRIVE'S OR SPONSOR'S ROW IS THE ONE MOVEMENT THAT OPENS SOMETHING**, and the reason the old
 * blanket rule ("the actual list states and never links") expired.
 *
 * That row used to be a POOL — one line reading "From your fundraisers", a name with no record
 * behind it. Since the 2026-09-07 ruling it is one row per drive or sponsor, each of which has a
 * room. Linking it is the exact mirror of the plan half opening its budget line, and it is why this
 * panel needs no second "Open Sponsors" hub button beside rows that already ARE the door.
 */
test('a derived row opens the drive or sponsor it names', () => {
  assert.match(
    panel,
    /c\.derived[\s\S]{0,400}?moneySectionHref\(base, 'fundraisers', \{ fundraiser: c\.derived\.recordId \}\)/,
    'A sponsor\'s row on the statement no longer opens that sponsor. The row names a record with a '
    + 'room of its own; leaving it as plain text sends the coach back to a hub to find it by hand, '
    + 'while the identical row on the Months grid opens it directly.',
  );
});

/**
 * **THE UNTRUTH THIS RELEASE REMOVED, AND THE FIX THAT WOULD PUT IT BACK.**
 *
 * A derived row sums several arrivals, so `paidDate` is null on it — and the panel printed
 * "no date recorded" for five fully-dated sponsor cheques while the Months view of the same report
 * printed their dates. The obvious-looking repair is to synthesise a date into `paidDate`. **That is
 * the wrong one**: `paidDate` is the dated grain every month and chart feed reads, and a value there
 * would place derived money a SECOND time on feeds the cash strip already places per arrival — a
 * figure defect, where today's is only a wording one. The span travels beside it instead.
 */
test('a derived row keeps a null paidDate and carries its span separately', () => {
  assert.match(
    route,
    /paidDate: null,[\s\S]{0,600}?derived: \{[\s\S]{0,200}?firstDay:[\s\S]{0,120}?lastDay:/,
    'The derived rows have stopped carrying their arrival span beside a null `paidDate`. If a date '
    + 'was synthesised into `paidDate` to fix the panel\'s wording, revert it: that field feeds the '
    + 'month grid and the cumulative chart, which already place every one of these arrivals through '
    + 'the cash strip, and a second placement is a wrong FIGURE rather than a wrong sentence.',
  );
  assert.match(
    panel,
    /c\.derived\.count[\s\S]{0,160}?c\.derived\.firstDay[\s\S]{0,80}?c\.derived\.lastDay/,
    'The panel has stopped reading the arrival span, so every drive and sponsor row is back to '
    + '"no date recorded" on money that is fully dated — the exact sentence the owner found on '
    + 'five sponsor rows at once.',
  );
});

/**
 * **A RECORD THAT RAISED NOTHING IS NOT A PAYMENT** (`/review` correctness lens, 2026-09-09).
 *
 * `rep_fundraiser_entries` is CHECK `amount_raised >= 0` — deliberately, so a coach can log a family
 * who took part in the drive and sold nothing — and a drive's entries are ALWAYS realised. Counted,
 * such a row inflates "N payments" past what arrived AND, worse, drags `firstDay` back to a day on
 * which no money came in. The count exists to tell a coach the row is an addition; a signal that
 * counts non-events is worse than no signal.
 *
 * ⚠ THE TEST IS GROSS, NOT KEPT: a fully-rebated entry is a real arrival on a real day (the row's
 * own words already say "$X of $Y, $Z to families"), so it must keep counting. Only "nothing came
 * in" is skipped — which is why the guard below pins `amountRaised`, not `kept`.
 */
test('an entry that brought no money in is not counted as a payment', () => {
  assert.match(
    route,
    /e\.amountRaised > 0\.005\)\s*row\.days\.push/,
    'The arrival-day collection has stopped screening $0 entries. A drive with three participants '
    + 'and one sale now reads "3 payments", and its date span starts on a day nothing arrived. '
    + 'Screen on amountRaised (gross), never on kept — a fully-rebated entry IS an arrival.',
  );
  assert.match(
    panel,
    /c\.derived\?\.count/,
    'The panel is back to keying the date line on the mere presence of `derived` rather than on its '
    + 'count. A record whose every entry raised $0 has a name and a room but no arrivals — it must '
    + 'still link, and must fall through to wording that is honest about having no day.',
  );
});

/**
 * **A DIALOG THAT OPTS INTO THE SCROLLING RECIPE MUST NAME THE PART THAT SCROLLS.**
 *
 * `.modalScrollBody` is `display:flex; overflow:hidden` and expects one child that scrolls. Both
 * statement panels passed `scroll` and rendered a bare fragment, so no child matched: the list was
 * a shrinking flex item inside a clipped box, and a row with enough records lost its tail with no
 * error anywhere. It stayed invisible because the panels people opened were short.
 */
test('the statement panels name a scrolling pane for the recipe they opted into', () => {
  const opens = (panel.match(/scroll\s*\n?\s*>/g) ?? []).length;
  const panes = (panel.match(/shared\.scrollPane/g) ?? []).length;
  assert.ok(
    panes >= opens && panes > 0,
    `${opens} panel(s) here ask QuestionShell for the scrolling recipe and only ${panes} name a `
    + 'pane for it. A dialog that opts in without one clips its own content silently — nothing '
    + 'throws, nothing logs, the list simply ends early.',
  );
});
