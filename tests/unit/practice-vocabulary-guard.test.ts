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
/** The paper's builder — moved out of the plan page's `handlePrint` at stage 6 (R5) so the
 *  closed-season reader prints through the same one; the print-path guards read it here. */
const SHEET = 'lib/practice-sheet.ts';

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
  const print = fnSource(read(SHEET), 'buildPracticeSheet');

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
  const print = fnSource(read(SHEET), 'buildPracticeSheet');

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

// ── Stage 6 · Afterwards & who sees what (owner rulings R1 · R2 · R3 · R5 · R6, 2026-09-18) ────
// A finished practice is a RECORD with one face — the sheet read-only, "How it went" first —
// and the record never claims the practice happened. These hold the words on every surface the
// record reaches: the plan page, the editor's read mode, the closed-season reader and its shelf.

const READER = 'app/[orgSlug]/coaches/teams/[teamId]/history/development/practices/[eventId]/page.tsx';
const SEASON_END = 'app/[orgSlug]/coaches/teams/[teamId]/season-end/page.tsx';
const CHROME = 'components/coaches/PracticeSheetChrome.tsx';
const SCHEDULE = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';
const HELPER = 'components/coaches/CoachHelperHome.tsx';
/** What a coach READS — comments stripped first (the `development-vocabulary-guard` idiom). */
const prose = (rel: string) => read(rel)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the record is ONE document (stage 6, R5) — the reader mounts the sheet, and its own labels are gone', () => {
  const reader = prose(READER);
  it('mounts the sheet in read mode with the recap first, fed by its own GET-only route', () => {
    assert.ok(reader.includes('<PracticePlanEditor'), 'the reader renders the sheet, not a document of its own');
    assert.match(reader, /readOnly\s+record/, 'read-only AND the record\'s word');
    assert.ok(reader.includes('<HowItWent first'), '"How it went" first');
    assert.ok(reader.includes("practice-plan/read"), 'the route it always called');
    assert.ok(reader.includes("searchParams.get('year')"), 'it keeps its year — HISTORY_PAGES is unchanged');
  });
  it('the three labels that claimed the night happened are gone — and no ReadStation survives beside the sheet', () => {
    for (const label of ['What this practice was for', 'Who was assigned', 'On the night', 'ReadStation', 'ReadField']) {
      assert.ok(!reader.includes(label), `"${label}" was the reader's own rendering — one document, one mode`);
    }
  });
  it('the reader offers no write: no edit door, no recap box, no Run practice, no Save as template', () => {
    for (const control of ['Edit the plan', 'onChange={next', 'Run practice', 'Save as template', 'send-to-staff', 'library-toggle']) {
      assert.ok(!reader.includes(control), `"${control}" on a closed season's record`);
    }
    assert.ok(reader.includes('Print the sheet'), 'paper is the one control (frame 159)');
  });
});

describe('the record\'s face on the plan page (stage 6, R1 · R2 · R3)', () => {
  const page = prose(PAGE);
  const chrome = prose(CHROME);
  const editor = prose(EDITOR);
  it('the boundary is the lib\'s ONE predicate, read from the minute clock — no date arithmetic of the page\'s own', () => {
    assert.ok(page.includes('practiceIsRecord(event?.startsAt, nowMs, event?.endsAt)'));
    assert.doesNotMatch(page, /3 \* 60 \* 60 \* 1000|RUN_WINDOW_MS|\+ ?3 ?\* ?H\b/);
  });
  it('the promise line is gone (R3) — a page states what it has, not what it will have', () => {
    assert.ok(!page.includes('appears here once the practice has started'));
    assert.ok(!read('app/[orgSlug]/coaches/coaches.module.css').includes('.ppDocNote {'), 'and its class with it');
  });
  it('the when-line is a FACT on a record — the schedule invitation renders only off the record', () => {
    assert.ok(chrome.includes('!record && scheduleHref'), '"Set it on the schedule ›" is gated on the live face');
    assert.ok(chrome.includes("practicePlannedLabel(fit, { record })"), '"Nothing planned", never "yet", on a record');
  });
  it('"Goal:" is the record\'s word, "Tonight:" the live page\'s (the paper prints GOAL)', () => {
    assert.ok(editor.includes("withoutPeople || record ? 'Goal:' : 'Tonight:'"));
    assert.ok(editor.includes("'Nothing written for this one.'"), 'an unwritten goal is silence in the muted ink');
    assert.ok(!editor.includes("'No goal written'"));
  });
  it('the record\'s toolbar: Send to staff and Library gated on the live face, a quiet Edit the plan for a writer', () => {
    assert.ok(page.includes('{writing && (data.staffPeople?.length ?? 0) > 1 && ('), 'Send to staff — gated, never deleted');
    assert.ok(page.includes('data-testid="send-to-staff"'), 'the who-runs-it build\'s button is still here');
    assert.ok(page.includes('{writing && canDock && ('), 'Library — gated');
    assert.ok(page.includes('{recordMode && canWrite && ('), 'Edit the plan — a writer, on a record');
    assert.ok(page.includes('data-testid="edit-the-plan"'));
  });
  it('a record with no plan says the reader\'s sentence, never the live page\'s "yet … once there is one"', () => {
    assert.ok(chrome.includes('No plan was written for this practice.'));
    assert.ok(page.includes('{!recordMode && !hasPlan && !canWrite && ('), 'the assistant\'s live empty state is off the record');
    assert.ok(page.includes('{recordMode && !hasBlocks && ('), 'the no-plan record, by the hub\'s one definition');
  });
  it('the record never says the practice happened', () => {
    for (const claim of ['practice ran', 'you ran', 'was run', 'took place', 'Completed']) {
      assert.ok(!page.includes(claim) && !chrome.includes(claim), `"${claim}" would be a claim about what HAPPENED`);
    }
  });
});

describe('the editor\'s read mode is a FACE, not a disabled form (stage 6, R2)', () => {
  const editor = prose(EDITOR);
  const fields = prose('components/coaches/PracticeFields.tsx');
  it('the five teaching fields read as text through the shared face — the modal, the flattened station and the drill sheet alike', () => {
    assert.ok(fields.includes('if (readOnly) return <TeachingFacts values={values} equipmentTags={equipmentTags} />;'));
    assert.ok(fields.includes('if (readOnly) return <ReadPoints points={current} />;'));
    assert.ok(!editor.includes('function DrillFacts('), 'the editor\'s private read face moved to the shared module');
  });
  it('no input, textarea or button on the sheet is ever merely disabled by read mode', () => {
    // The tag pickers keep `disabled={readOnly}`: their disabled face IS the read face (chips, no
    // search box). A native control greyed by read mode is the shape this rules out.
    // The opening tag's props, whichever line they sit on (a negated class matches a newline — no
    // dotAll flag, which the project's TypeScript target predates) and whichever order: an inline
    // arrow handler's `=>` before the `disabled` prop is let through so it cannot hide the match.
    assert.doesNotMatch(editor, /<(input|textarea|button)\b(?:[^>]|=>)*disabled=\{readOnly/, 'a greyed box reads as broken; read mode renders text');
  });
  it('rows open to read: the ghost row, the gaps and the drag handle stay behind `layout.timeline`, the doors behind `!readOnly`', () => {
    assert.ok(editor.includes('timeline: !readOnly && !soloBlock'));
    assert.ok(editor.includes('{!readOnly && (doors.length > 0 || promoteDoor) && ('));
    assert.ok(editor.includes('const canDrag = !readOnly && !solo && blockCount > 1;'));
  });
});

describe('the shelf is "Practices" (stage 6, R6) — the product never says "ran"', () => {
  it('the closed-season shelf\'s title, its intro sentence, and the demo\'s tour line', () => {
    const seasonEnd = prose(SEASON_END);
    assert.ok(seasonEnd.includes('title="Practices"'));
    assert.ok(!seasonEnd.toLowerCase().includes('practices you ran'), 'the forbidden verb on the record\'s own shelf');
    assert.ok(!prose('lib/sandbox-chrome.ts').includes('practices you ran'));
  });
});

describe('who sees what (stage 6, R8 · R9) — one grant, one definition of "has a plan"', () => {
  it('the Schedule panel\'s door follows the plan page\'s grant, never "head coach", and says why', () => {
    const schedule = prose(SCHEDULE);
    assert.ok(schedule.includes('canWritePracticePlans(page.capabilities)'));
    assert.ok(!schedule.includes('page.capabilities?.isHeadCoach ?'));
    assert.ok(schedule.includes('No plan yet. Writing the plan comes with Schedule: View + edit — ask your head coach.'));
    assert.ok(schedule.includes('practiceHasPlan(selectedEvent)'), 'the hub\'s one definition — at least one block');
  });
  it('the helper\'s "Open my station" waits for a BLOCK, not a bare plan row', () => {
    const helper = prose(HELPER);
    assert.ok(helper.includes('hasPlan: practiceHasPlan(e),'));
    assert.ok(!helper.includes('Boolean(e.practicePlan)'));
  });
});
