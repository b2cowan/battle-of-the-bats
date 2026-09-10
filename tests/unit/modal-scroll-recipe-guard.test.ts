/**
 * **A DIALOG THAT OPTS INTO THE SCROLLING RECIPE MUST NAME THE PART THAT SCROLLS — EVERY DIALOG.**
 *
 * `.modalScrollBody` is `display:flex; flex-direction:column; overflow:hidden` and expects exactly
 * one child that scrolls (`.scrollPane`, or one of the older named shapes). A dialog that puts the
 * class on its frame and renders a body matching none of them clips its own content at the frame's
 * bottom edge — no error, no log; the wheel does nothing and the list simply ends early. It stays
 * invisible for as long as the dialogs people open are short.
 *
 * Three dialogs shipped that way. The two Budget-vs-Actual statement panels were caught on
 * 2026-09-09 and are guarded in `bva-figure-doors-guard.test.ts`, for those two files only. The
 * THIRD was found the same day by the owner, the other way round: the coach's vocabulary dialog
 * listed 64 rows (4,296px) in an 810px box, and the only two rows a coach could edit sat 81px below
 * the edge — it read as "my item isn't editable". A guard scoped to two files cannot catch a third.
 *
 * ⚠ SO THIS ONE SCANS THE TREE. Every `.tsx` under `components/` and the coach portal that mentions
 * `modalScrollBody` (as a class or through a `scroll` prop) must also mention one of the recipe's
 * scrolling children. Scanning code, not prose — a file's own comment explaining the recipe must
 * not be what satisfies it (`codeOnly`, the shape `money-one-arithmetic-guard` set).
 *
 * ⚠ THE LIST OF SHAPES IS THE STYLESHEET'S, READ FROM IT rather than restated: a new named shape
 * added to `coaches.module.css` counts here the moment it exists, and a shape removed there stops
 * counting the same moment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STYLESHEET = 'app/[orgSlug]/coaches/coaches.module.css';
const SCAN_ROOTS = ['components', 'app/[orgSlug]/coaches'];

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** The recipe's scrolling children, straight from the rules `.modalScrollBody > .X { overflow-y: auto …}`. */
function scrollingShapes(): string[] {
  const css = readFileSync(join(ROOT, STYLESHEET), 'utf8');
  const shapes = new Set<string>();
  for (const m of css.matchAll(/\.modalScrollBody\s*>\s*(?:form\s*>\s*)?\.([A-Za-z0-9_]+)\s*\{[^}]*overflow-y:\s*auto/g)) {
    shapes.add(m[1]);
  }
  return [...shapes];
}

/** Read once — the stylesheet cannot change between the two tests below. */
const SHAPES = scrollingShapes();

test('the stylesheet still declares scrolling children for the recipe, including the general one', () => {
  assert.ok(SHAPES.includes('scrollPane'), `scrollPane is the recipe's general shape; found only: ${SHAPES.join(', ')}`);
  assert.ok(SHAPES.length >= 2, 'the recipe lost its named shapes');
});

test('every dialog on the scrolling recipe names one of its scrolling children', () => {
  const offenders: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      /* The shell that APPLIES the recipe on behalf of its children is not a dialog on it — its
         callers are, and they are scanned. */
      if (file.endsWith('QuestionShell.tsx')) continue;
      const src = codeOnly(readFileSync(file, 'utf8'));
      if (!/modalScrollBody/.test(src) && !/\bscroll\b(?!Height|Top|Left|Width|Into|By|To|able|ing|er|Y|X)/.test(src)) continue;
      if (!/modalScrollBody/.test(src)) {
        /* A `scroll` word alone is not the recipe (scrollIntoView, a scroll listener…). Only files
           naming the class, or handing QuestionShell its `scroll` prop, are on the recipe. */
        if (!/<QuestionShell[\s\S]{0,400}?\bscroll\b/.test(src)) continue;
      }
      const names = SHAPES.some(s => new RegExp(`\\b${s}\\b`).test(src));
      if (!names) offenders.push(relative(ROOT, file));
    }
  }
  assert.deepEqual(
    offenders, [],
    'These dialogs put the scrolling recipe on their frame and name no scrolling child, so they clip '
    + 'their own content silently — nothing throws, the wheel does nothing, the list ends early. Put '
    + '`shared.scrollPane` (or `styles.scrollPane`) on the element between the header and the footer:\n  '
    + offenders.join('\n  '),
  );
});
