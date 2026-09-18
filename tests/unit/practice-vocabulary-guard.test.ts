import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ═══ ONE VOCABULARY AT BOTH LEVELS — the practice block (re-evaluation stage 2, owner ruling D3,
 * 2026-09-15) ═══
 *
 * A block asks *What you're doing · What you're watching for · Coaching points* — the station's
 * words, the drill library's words, the field screen's words, the printed station line's words and
 * the closed-season reader's words. The block editor was the ONE surface out of step ("Description
 * · Goal"), and the printed sheet's block line said "Goal:" where its station lines said "Watch
 * for:" — three names for one idea on one page. This guard holds the two places that drifted:
 *
 *   · the block's OWN labels inside `BlockCard` — never "Description" or "Goal" as a field label;
 *   · the printed sheet's block-line prefix in `handlePrint` — "Watch for:", never "Goal:".
 *
 * ⚠ Scoped on purpose. "Description" and "Goal" are the right words ONE LEVEL UP — the plan's About
 * fold has a Description and a template's goal line reads "Goal:" (owner rulings 2026-09-14) — so
 * the guard reads the block's slice of the editor, not the whole file. The stored keys stay
 * `description` / `goal`: they are identifiers, and a rename there is a migration nobody needs.
 * The `development-vocabulary-guard` idiom: what a coach READS, comments stripped first.
 */

const ROOT = process.cwd();
const EDITOR = 'app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx';
const PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx';

function read(rel: string): string {
  const file = path.join(ROOT, rel);
  assert.ok(fs.existsSync(file), `${rel} is gone — fix the path`);
  return fs.readFileSync(file, 'utf8');
}

/** The source of ONE top-level function, comments stripped — so a retired word in a comment
 *  explaining why it was retired does not trip the guard. */
function fnSource(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone — the guard reads it`);
  // An INDENTED function (one declared inside a component, like the plan page's `handlePrint`)
  // ends at the next declaration at its own indentation — bounding it at column 0 swallowed the
  // component's whole render, so a word anywhere in the page satisfied a print-path guard
  // (/review, 2026-09-17). A top-level function keeps its old bounds.
  const lineStart = src.lastIndexOf('\n', start) + 1;
  const indent = src.slice(lineStart, start).match(/^\s*/)?.[0] ?? '';
  const rest = src.slice(start);
  const end = indent
    ? rest.search(new RegExp(`\\n${indent}(?:async )?function |\\n${indent}const \\w+ = \\(|\\n${indent}(?:if|return) `))
    : rest.search(/\n(?:async )?function |\n\/\/ ── The editor|\nexport default function /);
  return (end > 0 ? rest.slice(0, end) : rest)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('the practice block speaks the station\'s vocabulary (stage 2, D3)', () => {
  const block = fnSource(read(EDITOR), 'BlockCard');

  it('asks What you\'re doing · What you\'re watching for · Coaching points', () => {
    assert.match(block, /<FieldLabel>What you&apos;re doing<\/FieldLabel>/);
    assert.match(block, /<FieldLabel>What you&apos;re watching for<\/FieldLabel>/);
    assert.ok(block.includes('<CoachingPointsField'), 'the block\'s points are the one field (D10)');
  });

  it('never labels a block field "Description" or "Goal" — those words belong one level up', () => {
    assert.doesNotMatch(block, /<FieldLabel>\s*Description\s*<\/FieldLabel>/);
    assert.doesNotMatch(block, /<FieldLabel>\s*Goal\s*<\/FieldLabel>/);
    assert.doesNotMatch(block, /placeholder="What this is for"/, 'the old Goal placeholder');
  });

  it('the shut row promises no count of coaching points (§133) and says "Whole team", never "everyone"', () => {
    assert.doesNotMatch(block, /Coaching points: \$\{/);
    assert.doesNotMatch(block, /Who: /);
    assert.ok(block.includes("'Whole team'"), 'the block\'s own word for nobody chosen');
  });

  it('the clock row\'s chip says "Rest of practice" and the consequence says "ends" / "runs to"', () => {
    assert.ok(block.includes('>Rest of practice</button>'));
    assert.ok(block.includes("'runs to' : 'ends'"));
  });
});

describe('the printed sheet\'s block line (stage 2, D3 · D11)', () => {
  const print = fnSource(read(PAGE), 'handlePrint');

  it('says "Watch for:" on the block line, as its station lines already do — never "Goal:"', () => {
    assert.ok(print.includes('`Watch for: ${block.goal}`'));
    assert.doesNotMatch(print, /`Goal: /);
  });

  it('prints the block\'s kit beside the block and the bag at the head', () => {
    assert.ok(print.includes('`Equipment: ${blockKit.join'), 'the block\'s own kit, beside the block');
    assert.ok(print.includes('practiceKitBag(plan, equipmentTags).all'), 'the head prints the bag, the same walk the About line reads');
  });
});

// ── Stage 5 · Paper & the field (owner rulings P2 · P3 · P5, 2026-09-17) ───────────────────────

const RUN_PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx';
const STATION_VIEW = 'app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticeStationView.tsx';

describe('the printed sheet\'s where-line reads the stored arrival time through the ONE clock formatter (stage 5, P2)', () => {
  const print = fnSource(read(PAGE), 'handlePrint');

  it('prints "Arrive 5:45 p.m.", never the raw "HH:mm" — the eighth hand-rolled clock', () => {
    assert.ok(print.includes('`Arrive ${formatStoredClock(event.arrivalTime)}`'),
      'the where-line formats the stored field through lib/utils — the same guard the Schedule reads it through');
    assert.doesNotMatch(print, /`Arrive \$\{event\.arrivalTime\}`/, 'the raw stored string printed on paper for a month');
  });

  it('says "Whole team" where the paper printed nothing, and leaves a coach\'s list as written', () => {
    assert.ok(print.includes("'Whole team'"));
    assert.doesNotMatch(print, /groupNames:/, 'groups are cells now, never columns (the turned shape is proved in pdf-export-contract)');
  });
});

describe('the field screen has NO CLOCK (stage 5, P10) and never claims the practice ran (D4)', () => {
  const strip = (src: string) => src
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
  const src = strip(read(RUN_PAGE));
  const station = strip(read(STATION_VIEW));

  it('nothing ticks, nothing counts down, nothing is "over" or "due" — the coach is the clock', () => {
    for (const file of [src, station]) {
      assert.doesNotMatch(file, /setInterval|Date\.now\(\)|nowMs|anchorMs|useMinuteClock/, 'a clock on the field screen was ruled out (P10)');
      for (const word of ['Over by', 'Rotation due', 'Until they rotate', 'Left of', 'Planned for', 'The clock starts', 'until they rotate', 'were due to rotate', 'Move the groups on']) {
        assert.ok(!file.includes(word), `"${word}" is the counter's vocabulary — it went with the counter`);
      }
    }
  });
  it('the plan\'s length is stated as information, from the lib\'s one wording', () => {
    assert.ok(src.includes('runStepLengthLabel(step)'), '"15 min" / "10 min a round" / "Rest of practice"');
  });
  it('always opens on the first stop and holds nothing between opens — no storage of any kind', () => {
    for (const file of [src, station]) {
      assert.doesNotMatch(file, /sessionStorage|localStorage|fl\.practice-run\./, 'the field is a plain reader: it opens at the top every time (P10 revised)');
    }
  });
  it('everyone has Back / Next — a helper gets the line naming who moves the team, never fewer buttons', () => {
    assert.ok(src.includes('these buttons move only your screen'), 'the helper line says what the buttons do');
    assert.ok(!src.includes('canAdvance ?'), 'the buttons are never conditional on the reader');
  });
  it('no surface on the field claims the practice happened', () => {
    for (const claim of ['>Ran ', 'Was run', 'Took place', 'Ran on', 'Completed']) {
      assert.ok(!src.includes(claim), `"${claim}" would be a claim about what HAPPENED — nothing is written at the field`);
    }
  });
  it('never carries a second copy of the run window — the one constant lives in lib/practice-state', () => {
    assert.doesNotMatch(src, /3 \* 60 \* 60 \* 1000|RUN_WINDOW_MS/);
  });
  it('the rotation\'s words: "nobody" for an empty station, a sitting-out group as a line under the list', () => {
    assert.ok(src.includes("'nobody'"), 'a station with nobody that round says so');
    assert.ok(src.includes('sits round {shownRow.round} out'), 'a sitting-out group is a line under the list');
  });
});

describe('the station view\'s one-off note takes the editor\'s own label (stage 5)', () => {
  // Comments stripped: the one explaining why the old label went names it.
  const src = read(STATION_VIEW).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  it('says "Just for tonight" — the field, the editor and the paper\'s "Tonight" are one field', () => {
    assert.ok(src.includes('>Just for tonight</p>'));
    assert.ok(!src.includes('Note for tonight'));
  });
});
