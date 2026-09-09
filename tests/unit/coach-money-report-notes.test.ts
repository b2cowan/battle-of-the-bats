/**
 * THE SENTENCES A MONEY REPORT CARRIES INTO ITS FILE.
 *
 * The screen has always said what its figures mean. From 2026-09-05 the Excel and PDF exports say
 * it too, because a treasurer downloads Budget vs. Actual and emails it to a board — and until
 * then the figures travelled while every caveat stayed behind on the page.
 *
 * ⚠ WHAT THIS GUARDS IS THE **DROP**, not the prose. One rule decides whether a clause reaches a
 * file, and it is invisible when it breaks: a note that quietly loses its fact-half exports a
 * report that no longer explains itself, and a note that quietly keeps its gesture-half tells a
 * board member to tap a piece of paper. Neither shows up in a typecheck, a lint or a render.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthGridNotes, statementNotes, noteTextForFile, noteRunsForFile,
  type ReportNote,
} from '../../lib/coach-money-report-notes';

const NO_MONTH_INPUT = {
  opening: null,
  openingFrom: null,
  cashOnHand: '$0.00',
  forward: null,
  budgetUndated: null,
  truncatedMonths: null,
  shortfall: null,
};

const byId = (notes: ReportNote[], id: string) => {
  const found = notes.find(n => n.id === id);
  assert.ok(found, `expected a "${id}" note — got ${notes.map(n => n.id).join(', ')}`);
  return found;
};

describe('a gesture never reaches a file, and a fact always does', () => {
  test('the itemisation note keeps both facts and drops "Tap a category\'s figure"', () => {
    const note = byId(monthGridNotes({ ...NO_MONTH_INPUT, lens: 'actual' }), 'itemisation');
    const screen = note.segments.map(s => s.text).join('');
    const file = noteTextForFile(note);

    assert.ok(screen.includes('Tap a'), 'the screen still offers the gesture');
    assert.ok(!file.includes('Tap a'), 'the file must not tell a reader to tap paper');
    // The two sentences before it are facts about where money sits, and they travel.
    assert.ok(file.includes('sits on the item it names'));
    assert.ok(file.includes('Not itemized'));
    assert.ok(file.endsWith('row.'), `a trimmed note must still end cleanly — got "${file}"`);
  });

  test('the basis clause keeps the fact and drops the door', () => {
    const notes = statementNotes({
      basis: 'season',
      dues: { state: 'short', planNeeds: '$6,600.00', billed: '$5,000.00', gap: '$1,600.00' },
      canWriteDues: true,
      duesNonCash: false,
      undatedPlan: null,
    });
    const file = noteTextForFile(byId(notes, 'dues'));

    assert.ok(
      file.includes('Both columns compare a whole season’s plan against what has moved so far.'),
      'the fact half is the reason the note exists — it must survive');
    assert.ok(!file.includes('Compare to date'), 'the control does not exist in a spreadsheet');
    assert.ok(!file.includes('sets the plan against the same span'),
      'prose that only makes sense beside the control goes with it');
  });

  test('the undated-plan note drops its months-view bridge and keeps its verb', () => {
    const seasonFile = noteTextForFile(byId(statementNotes({
      basis: 'season', dues: null, canWriteDues: false, duesNonCash: false, undatedPlan: '$2,600.00',
    }), 'undated-plan'));
    const todateFile = noteTextForFile(byId(statementNotes({
      basis: 'todate', dues: null, canWriteDues: false, duesNonCash: false, undatedPlan: '$2,600.00',
    }), 'undated-plan'));

    for (const file of [seasonFile, todateFile]) {
      assert.ok(file.startsWith('$2,600.00 of this plan'));
      assert.ok(!file.includes('See it in the months view'));
      assert.ok(!/\s$/.test(file), 'a dropped trailing clause must not leave a dangling space');
    }
    /* ⚠ THE VERB IS THE WHOLE DIFFERENCE and only one is honest per basis (owner ruling
       2026-09-04). Whole season COUNTS undated money, so telling a coach it was left out would be
       false; only To date can exclude it. Getting this backwards in a FILE is worse than on a
       screen, because nothing beside it says which basis was downloaded. */
    assert.ok(seasonFile.includes('sits in the season total but in no month'));
    assert.ok(!seasonFile.includes('not compared here'));
    assert.ok(todateFile.includes('not compared here'));
    assert.ok(!todateFile.includes('sits in the season total'));
  });

  test('a coach who cannot set dues is not offered the door, on screen or in a file', () => {
    const readOnly = byId(statementNotes({
      basis: 'season',
      dues: { state: 'unset', planNeeds: '$6,600.00', billed: '$0.00', gap: '$6,600.00' },
      canWriteDues: false,
      duesNonCash: false,
      undatedPlan: null,
    }), 'dues');
    assert.ok(!readOnly.segments.some(s => s.control === 'set-dues'));
  });

  /**
   * ⚠ THE CAPTION THAT NEVER REACHED A FILE (owner ruling 2026-09-09). This sentence spent its
   * life as JSX inside the Player dues `<th>`, so a treasurer who downloaded the report and
   * emailed it to a board sent a dues figure that counts a team bill a family paid, with nothing
   * beside it saying so. It is a footnote now, which means it travels — and this test is the
   * thing that stops it quietly becoming screen-only again.
   */
  test('what the dues actual counts is a footnote, and it travels into a file', () => {
    const shown = statementNotes({
      basis: 'season',
      dues: { state: 'short', planNeeds: '$6,600.00', billed: '$5,000.00', gap: '$1,600.00' },
      canWriteDues: true,
      duesNonCash: true,
      undatedPlan: '$2,600.00',
    });
    const file = noteTextForFile(byId(shown, 'dues-actual'));

    assert.equal(
      file,
      'The Player dues actual includes team bills families paid and fundraising credited to dues, less money handed back.',
      'no clause of this note is a gesture, so a file keeps all of it');

    /* ⚠ THE DUES PAIR STAYS TOGETHER. Two answers about one row; an unrelated sentence between
       them would split a question from its other half. */
    const ids = shown.map(n => n.id);
    assert.deepEqual(ids, ['variance-key', 'dues', 'dues-actual', 'undated-plan']);

    /* ⚠ IT QUOTES NO FIGURE, so it can never go stale against one. The amounts are one tap away
       on the Actual figure, where they add up. */
    assert.ok(!/\$/.test(file), 'the note must name no amount');
  });

  test('a season where every dues dollar arrived as cash says nothing', () => {
    const notes = statementNotes({
      basis: 'season',
      dues: { state: 'covered', planNeeds: '$6,600.00', billed: '$6,600.00', gap: '$0.00' },
      canWriteDues: true,
      duesNonCash: false,
      undatedPlan: null,
    });
    assert.ok(!notes.some(n => n.id === 'dues-actual'),
      'a figure that is exactly what a coach expects needs no footnote');
  });
});

describe('the alert is a finding, so it travels', () => {
  test('the shortfall band exports, and its tense follows the lens', () => {
    const cash = byId(monthGridNotes({
      ...NO_MONTH_INPUT, lens: 'actual',
      shortfall: { month: 'July 2026', amount: '$1,154.00' },
    }), 'shortfall');
    const plan = byId(monthGridNotes({
      ...NO_MONTH_INPUT, lens: 'budget',
      shortfall: { month: 'July 2026', amount: '$1,154.00' },
    }), 'shortfall');

    assert.equal(cash.tone, 'alert', 'the band keeps its attention treatment in the file');
    assert.ok(noteTextForFile(cash).startsWith('Your balance went below zero in July 2026'));
    /* "On this plan you go short" is a PROJECTION's sentence — plainly wrong under Cash, where the
       money has already gone and no plan is being discussed. */
    assert.ok(noteTextForFile(plan).startsWith('On this plan you go short in July 2026'));
    assert.ok(noteTextForFile(plan).includes('bring dues forward'));
    assert.ok(!noteTextForFile(cash).includes('bring dues forward'),
      'you cannot bring dues forward in a month that has already happened');
  });

  test('a lens with no balance rows has no shortfall to report', () => {
    for (const lens of ['difference', 'spending'] as const) {
      const notes = monthGridNotes({ ...NO_MONTH_INPUT, lens, shortfall: null });
      assert.ok(!notes.some(n => n.tone === 'alert'));
    }
  });
});

describe('each lens states its own basis and nobody else’s', () => {
  test('the reading a file explains is the reading it holds', () => {
    const idsFor = (lens: 'actual' | 'spending' | 'budget' | 'scheduled' | 'difference') =>
      monthGridNotes({ ...NO_MONTH_INPUT, lens }).map(n => n.id);

    assert.ok(idsFor('actual').includes('basis-actual'));
    assert.ok(idsFor('actual').includes('two-truths'), 'only Cash owes the Statement an explanation');
    assert.ok(!idsFor('spending').includes('two-truths'));
    assert.ok(idsFor('spending').includes('basis-spending'));
    assert.ok(idsFor('budget').includes('basis-budget'));
    assert.ok(idsFor('scheduled').includes('basis-scheduled'));
    assert.ok(idsFor('difference').includes('basis-difference'));
    // Exactly one basis note per lens — two would be a file arguing with itself.
    for (const lens of ['actual', 'spending', 'budget', 'scheduled', 'difference'] as const) {
      const bases = idsFor(lens).filter(id => id.startsWith('basis-'));
      assert.equal(bases.length, 1, `${lens} stated ${bases.length} bases`);
    }
  });

  test('the opening balance says which of its two facts is true, and never both', () => {
    const set = monthGridNotes({ ...NO_MONTH_INPUT, lens: 'actual', opening: '$500.00' });
    const unset = monthGridNotes({ ...NO_MONTH_INPUT, lens: 'actual' });
    assert.ok(set.some(n => n.id === 'opening-set') && !set.some(n => n.id === 'opening-unset'));
    assert.ok(unset.some(n => n.id === 'opening-unset') && !unset.some(n => n.id === 'opening-set'));
    /* ⚠ NULL IS NOT ZERO — a season carried at exactly $0 says so; one that carried nothing says
       something different. Both facts reach the file. */
    assert.ok(noteTextForFile(byId(
      monthGridNotes({ ...NO_MONTH_INPUT, lens: 'actual', opening: '$0.00' }), 'opening-set',
    )).includes('This season opened with $0.00'));
  });

  test('Scheduled projects from real money, and the two lenses that carry a season opening do not', () => {
    const scheduled = monthGridNotes({
      ...NO_MONTH_INPUT, lens: 'scheduled', opening: '$500.00', cashOnHand: '$3,762.00',
    });
    assert.ok(!scheduled.some(n => n.id.startsWith('opening-')),
      'the forward view starts from today’s real money, which already contains the carry');
    assert.ok(noteTextForFile(byId(scheduled, 'basis-scheduled')).includes('$3,762.00'));
  });
});

describe('the bold a board reads is the bold the coach reads', () => {
  test('runs survive into the file with their emphasis intact', () => {
    const runs = noteRunsForFile(byId(monthGridNotes({ ...NO_MONTH_INPUT, lens: 'actual' }), 'basis-actual'));
    const bolded = runs.filter(r => r.bold).map(r => r.text);
    assert.ok(bolded.includes('Cash is money that moved.'));
    assert.ok(bolded.includes('Expenses are what you paid vendors.'));
    assert.ok(runs.every(r => r.text.length > 0), 'an empty run writes an empty rich-text segment');
  });
});
