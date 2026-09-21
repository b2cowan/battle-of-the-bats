/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE GATE THAT WOULD HAVE CAUGHT THE BUDGET PLAN TOOLBAR** (2026-09-21) —
 * `scripts/check-css-selectors.mjs`, direction C (ORPHAN): code asks a module for a class the
 * module does not declare.
 *
 * ⚠⚠ WHY THIS IS TESTED BY RUNNING THE SCRIPT ON A FIXTURE TREE, not by reading its source. The
 * whole defect class is SILENT — a CSS-module class that is not declared resolves to `undefined`
 * and the element renders with `class="undefined"`, no build error, no type error. The 2026-09-17
 * kit commit deleted `.panelToolbar` and missed one caller; Budget Plan stacked its controls in a
 * column for four days while every static check stayed green. A test that only greps the script
 * for the word "orphan" would be green in the same way. This one builds a tiny repo in a temp
 * directory with the exact shapes that fooled the first hand-rolled scan, breaks it on purpose,
 * and asserts the script names the break — and stays quiet on the look-alikes:
 *
 *   • a class named in a CSS COMMENT (a headstone) is NOT declared;
 *   • a class named in a CODE comment (`// styles.x`, `{/* styles.x *\/}`) is NOT a reference;
 *   • a `@keyframes` name IS exported (`animationName: styles.spin` is legitimate);
 *   • `styles['bracket-access']` IS a reference;
 *   • a one-letter alias reused as a lambda parameter (`rows.filter(s => s.id)`) is read ONLY
 *     inside a class expression — `s.id` is data, `className={s.missing}` is an orphan;
 *   • `@/` imports resolve to the repo root like tsconfig `paths` says.
 *
 * Then the ratchet: `--init` grandfathers today's findings, a clean re-run passes, and ONE new
 * reference fails again by name. Fixture classes are all referenced so direction A (dead) stays
 * quiet and cannot mask what C reports.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve('scripts/check-css-selectors.mjs');

type Run = { status: number; stdout: string; stderr: string };
function run(cwd: string, ...args: string[]): Run {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? -1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const CSS = `
/* A headstone — the class it names is NOT declared: .buriedInCss */
.live { color: red; }
.real { color: blue; }
.used { color: green; }
@keyframes spin { from { opacity: 0; } to { opacity: 1; } }
`;

const PAGE = `
import styles from './x.module.css';
import s from '@/app/x.module.css';
// styles.lineOnly — a line comment is not a reference
/* styles.blockOnly — nor is a block comment */
export default function P({ rows }: { rows: { id: string }[] }) {
  const names = rows.filter(s => s.id).map(s => s.id);
  return (
    <div className={styles.live} style={{ animationName: styles.spin }}>
      {/* styles.jsxCommentOnly — nor a JSX comment */}
      <span className={\`\${styles.real} \${styles.gone}\`}>{names.join(' ')}</span>
      <em className={s.used}>{rows.some(s => s.id) ? 'y' : 'n'}</em>
      <b className={s.missing} />
      <i className={styles['bracket-gone']} />
    </div>
  );
}
`;

describe('check:css-selectors — direction C, orphan references', () => {
  let root: string;
  const page = () => path.join(root, 'app', 'page.tsx');

  before(() => {
    root = mkdtempSync(path.join(tmpdir(), 'css-orphans-'));
    mkdirSync(path.join(root, 'app'), { recursive: true });
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    writeFileSync(path.join(root, 'app', 'x.module.css'), CSS);
    writeFileSync(page(), PAGE);
  });
  after(() => { rmSync(root, { recursive: true, force: true }); });

  it('fails with no baseline, naming each orphan by alias, name, line and module', () => {
    const r = run(root);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /3 NEW orphan reference/);
    assert.match(r.stderr, /app\/page\.tsx:11\n\s+styles\.gone — no \.gone in app\/x\.module\.css/);
    assert.match(r.stderr, /app\/page\.tsx:13\n\s+s\.missing — no \.missing in app\/x\.module\.css/);
    assert.match(r.stderr, /app\/page\.tsx:14\n\s+styles\.bracket-gone — no \.bracket-gone in app\/x\.module\.css/);
    // the two-causes-two-fixes guidance rides with the failure
    assert.match(r.stderr, /If the rule was DELETED and this caller left behind/);
  });

  it('stays quiet on the look-alikes: comments, keyframes, and a shadowed alias reading data', () => {
    const r = run(root);
    for (const quiet of ['lineOnly', 'blockOnly', 'jsxCommentOnly', 'spin', 'buriedInCss', 's.id']) {
      assert.doesNotMatch(r.stderr, new RegExp(quiet.replace('.', '\\.')), `${quiet} must not be reported`);
    }
    // and direction A did not fire on the fixture (every declared class is referenced)
    assert.doesNotMatch(r.stderr, /NEW dead class/);
  });

  it('--init grandfathers the population, keyed by name + module, and the ratchet then passes', () => {
    const init = run(root, '--init');
    assert.equal(init.status, 0, init.stderr);
    assert.match(init.stdout, /3 orphan reference\(s\) across 1 code file\(s\)/);
    const baseline = JSON.parse(readFileSync(path.join(root, 'scripts', '.css-selector-baseline.json'), 'utf8'));
    assert.deepEqual(baseline.orphans, {
      'app/page.tsx': ['bracket-gone@app/x.module.css', 'gone@app/x.module.css', 'missing@app/x.module.css'],
    });
    const again = run(root);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /3 orphaned grandfathered/);
  });

  it('one NEW reference to an undeclared class fails again, by name — the Sept 17 shape', () => {
    writeFileSync(page(), PAGE.replace('<b className={s.missing} />', '<b className={s.missing} /><u className={styles.panelToolbar} />'));
    const r = run(root);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /1 NEW orphan reference/);
    assert.match(r.stderr, /styles\.panelToolbar — no \.panelToolbar in app\/x\.module\.css/);
    assert.doesNotMatch(r.stderr, /styles\.gone/, 'the grandfathered finding must not be re-reported');
  });

  it('declaring the class clears the finding — the ratchet reads the stylesheet, not the note', () => {
    writeFileSync(path.join(root, 'app', 'x.module.css'), CSS + '.panelToolbar { display: flex; }\n');
    const r = run(root);
    assert.equal(r.status, 0, r.stderr);
  });
});
