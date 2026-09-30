/**
 * A RECORD OPENED FROM A LIST, in the admin kit's form window (Tournament admin redesign Stage 2,
 * Part 1 — design decisions 2026-09-30: "an admin record opened from a list names its neighbours at its
 * foot", and the record's name is its editable title). A SOURCE READ — this repo renders no React in
 * the unit suite; the owner walk and `.probe/s2b/` prove the pixels. It holds the rules that are one
 * edit away from quietly going:
 *
 *   1. An END of the list has NO button (the depth chart's player, F-43), and the position is always
 *      there, so it never moves.
 *   2. A record opens with the PANEL focused — never a field: a phone would open its keyboard on the name.
 *   3. The editable title carries no required marker, and the window keeps the record's saved name as
 *      its accessible name while the field is typed in (`ariaLabel` replaces `aria-labelledby`).
 *   4. The save word inside a window is the kit's own SavePill (inline), never a second save word.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const kit = readFileSync(join(ROOT, 'components/admin/kit/club/KitDialog.tsx'), 'utf8');
const css = readFileSync(join(ROOT, 'components/admin/kit/club/KitDialog.module.css'), 'utf8');
const rep = readFileSync(join(ROOT, 'components/admin/kit/club/RepKit.tsx'), 'utf8');

describe('the record window names its neighbours', () => {
  it('draws Previous and Next only where a neighbour exists, and the position always', () => {
    assert.match(kit, /\{steps\.prev && \(/, 'Previous must be absent at the start of the list');
    assert.match(kit, /\{steps\.next && \(/, 'Next must be absent at the end of the list');
    assert.match(kit, /<span className=\{styles\.stepPos\}>/, 'the position is unconditional');
    assert.match(css, /\.stepNext \{ grid-column: 3;/, 'Next keeps its own column, so an absent Previous moves nothing');
    assert.match(css, /\.stepPos \{\s*grid-column: 2;/);
  });

  it('names the neighbour to a screen reader, not only on the button face', () => {
    assert.match(kit, /aria-label=\{`Previous \$\{steps\.noun\}, \$\{steps\.prev\.name\}`\}/);
    assert.match(kit, /aria-label=\{`Next \$\{steps\.noun\}, \$\{steps\.next\.name\}`\}/);
  });

  it('opens a record on its panel, not a field, and a step keeps the keyboard inside', () => {
    assert.match(kit, /const first = isRecord \? null :/);
    assert.match(kit, /target\.onStep\(\);\s*bodyRef\.current\?\.scrollTo\(\{ top: 0 \}\);\s*panelRef\.current\?\.focus/);
  });
});

describe('the record\'s name is its title', () => {
  it('is a field with a dashed rule at rest and a pencil, and no required marker', () => {
    const field = kit.slice(kit.indexOf('export function KitTitleField'));
    assert.match(field, /<Pencil /);
    assert.doesNotMatch(field, /required|\*<\/|className=\{[^}]*req/, 'the title slot takes no required marker');
    assert.match(css, /\.titleInput \{[^}]*border-bottom: 1px dashed/);
  });

  it('keeps the saved name as the window\'s accessible name while it is edited', () => {
    assert.match(kit, /aria-labelledby=\{ariaLabel \? undefined : titleId\}/);
    assert.match(kit, /aria-label=\{ariaLabel\}/);
  });

  it('says "Saved" with the kit\'s one save word, inline', () => {
    assert.match(rep, /inline \? `\$\{styles\.savePill\} \$\{styles\.savePillInline\}`/);
  });
});
