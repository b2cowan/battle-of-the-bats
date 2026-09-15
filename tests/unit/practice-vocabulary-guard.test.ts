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
  const rest = src.slice(start);
  const end = rest.search(/\n(?:async )?function |\n\/\/ ── The editor|\nexport default function /);
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
