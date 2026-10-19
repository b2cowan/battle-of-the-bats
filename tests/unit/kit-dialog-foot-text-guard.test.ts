import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { cssRule, readCode, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SENTENCE IN A WINDOW'S FOOT SITS AT ITS LEFT; THE BUTTONS SIT AT ITS RIGHT (owner, 2026-10-12 — asked twice in
 * one day: the tournament Playoff generator's note, then the club's New schedule count "300 slots for 8 teams.")
 *
 * KitDialog draws `footer` as ONE right-hand group: Cancel, then the primary. A sentence passed in it — a count, who is
 * told, why the main action can't go — hugs the buttons on the right, whatever its own class says: a
 * `margin-right: auto` pushes inside that group, not across the foot. The window's left is `footerStart`.
 *
 * So no KitDialog's `footer` carries a text element, written inline or through the `const` it names. A button's own
 * label (a `<span>` inside a `<button>`) is the button's, not a sentence. Since One Window Stage 2b (2026-10-19) the
 * coaches portal's form shell, `QuestionShell`, hands its `footer` straight to KitDialog, so its callers are read too.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** From the opening bracket at `at`, the balanced span up to and including its close. */
function balanced(src: string, at: number, open: string, close: string): string {
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close && --depth === 0) return src.slice(at, i + 1);
  }
  return '';
}

/**
 * Every `footer={…}` written on a `<KitDialog` opening tag in `code`, each with the `const`s it names appended —
 * `const foot = ( … )` and `const foot = <…>;` both. A footer built any other way (a `useMemo`, a prop handed down,
 * a component of its own) is not read. A source the walker cannot follow FAILS, naming `where`: a guard that hung
 * or silently skipped a window would be worse than one that says so.
 */
function kitDialogFooters(code: string, where = 'the source'): string[] {
  const out: string[] = [];
  for (const tag of code.matchAll(/<(?:KitDialog|QuestionShell)\b/g)) {
    // Walk the opening tag's attributes at brace depth 0 until it ends (`>` or `/>`).
    let i = tag.index + tag[0].length;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '{') {
        const expr = balanced(code, i, '{', '}');
        if (!expr) throw new Error(`${where}: a brace on a <KitDialog> tag never closes — the foot guard cannot read it`);
        if (/\sfooter=$/.test(code.slice(Math.max(0, i - 8), i))) {
          let body = expr;
          for (const id of new Set([...expr.matchAll(/\b([a-z]\w*)\b/g)].map(m => m[1]))) {
            // Only a const that holds MARKUP: a flag or a figure the footer names (`disabled={overCeiling}`) is not foot.
            const def = new RegExp(`const ${id}\\s*=\\s*(\\(\\s*<|<)`).exec(code);
            if (!def) continue;
            const at = def.index + def[0].length - def[1].length;
            body += def[1] !== '<' ? balanced(code, at, '(', ')') : code.slice(at, code.indexOf(';\n', at) + 1 || undefined);
          }
          out.push(body);
        }
        i += expr.length - 1;
      } else if (c === '"' || c === "'") {
        const end = code.indexOf(c, i + 1);
        if (end < 0) throw new Error(`${where}: a quote on a <KitDialog> tag never closes — the foot guard cannot read it`);
        i = end;
      } else if (c === '>') {
        break;
      }
    }
  }
  return out;
}

/**
 * The first sentence left in a foot once its buttons and links (and their labels) are taken out: a text element
 * (`<span>`, `<p>`, a heading…) or words standing loose — in the fragment itself or inside a box (`<div>Words</div>`).
 * A box that holds only buttons is fine. To read loose words, a `{…}` that holds no markup (an attribute's value, an
 * arrow function, `{count}`) is folded to `⟨⟩` first, so `{count} slots` reads as words and `() => go()` does not.
 */
function sentenceIn(footer: string): string | null {
  const actions = footer
    .replace(/<button\b[\s\S]*?<\/button>/g, '')
    // The window's Cancel is a button (KitDialog's `DialogCancel`, the coach shell's `QuestionCancel`).
    .replace(/<(DialogCancel|QuestionCancel)\b[^>]*?\/>|<(DialogCancel|QuestionCancel)\b[\s\S]*?<\/\2>/g, '')
    .replace(/<(Link|a)\b[\s\S]*?<\/\1>/g, '');
  const element = /<(span|p|small|strong|b|em|label|h[1-6]|li)\b[^>]*>/.exec(actions);
  if (element) return element[0];
  let folded = actions;
  for (let prev = ''; prev !== folded;) { prev = folded; folded = folded.replace(/\{[^{}<]*\}/g, '⟨⟩'); }
  const loose = />([^<>]*[A-Za-z][^<>]*)</.exec(folded);
  return loose ? loose[1].trim() : null;
}

describe('a sentence in a window\'s foot sits at its left (owner, 2026-10-12)', () => {
  it('the window draws `footerStart` at the far left and `footer` as one right-hand group', () => {
    const win = readCode('components/admin/kit/club/KitDialog.tsx');
    assert.match(win,
      // One Window Stage 2: `footStart` / `footEnd` are the caller's `footerStart` / `footer`, or the ask while it asks.
      /\{footStart && <div className=\{styles\.footStart\}>\{footStart\}<\/div>\}\s*<div ref=\{setReasonSlot\}[^>]*\/>\s*\{footEnd != null && <div className=\{styles\.footEnd\}>\{footEnd\}<\/div>\}/,
      'the foot reads left to right: the note (or a door), the refusal\'s reason, then the buttons');
    const css = stripComments(readSource('components/admin/kit/club/KitDialog.module.css'));
    assert.match(cssRule(css, '.footStart'), /margin-right:\s*auto/);
    assert.match(cssRule(css, '.footEnd'), /margin-left:\s*auto/);
  });

  it('the scanner sees a sentence among the buttons, and not a button\'s own label', () => {
    const offender = `<KitDialog kind="form" title="x" onClose={c} footer={<><span className={s.footNote}>300 slots</span><button type="button">Go</button></>}>`;
    assert.equal(sentenceIn(kitDialogFooters(offender)[0]), '<span className={s.footNote}>');
    const named = `const foot = (<><p className={x}>Told</p><button>Go</button></>);\n<KitDialog footer={step ? foot : undefined} title="t">`;
    assert.equal(sentenceIn(kitDialogFooters(named)[0]), '<p className={x}>');
    const bare = `const foot = <><p className={x}>Told</p><button>Go</button></>;\n<KitDialog footer={foot} title="t">`;
    assert.equal(sentenceIn(kitDialogFooters(bare)[0]), '<p className={x}>');
    const boxed = `<KitDialog footer={<><div className={s.note}>{n} teams are told</div><button>Go</button></>}>`;
    assert.equal(sentenceIn(kitDialogFooters(boxed)[0]), '⟨⟩ teams are told');
    const loose = `<KitDialog footer={<>{count} slots<button>Go</button></>}>`;
    assert.equal(sentenceIn(kitDialogFooters(loose)[0]), '⟨⟩ slots');
    const labelled = `<KitDialog footer={<button type="button"><span className={ck.btnWord}>Save</span></button>} footerStart={<span>Note</span>}>`;
    assert.equal(sentenceIn(kitDialogFooters(labelled)[0]), null);
    const buttonsOnly = `<KitDialog footer={<div className={s.row}>{busy > 0 && <button onClick={() => go({ a: 1 })}>Go</button>}<Link href={h}>Open</Link></div>}>`;
    assert.equal(sentenceIn(kitDialogFooters(buttonsOnly)[0]), null);
    assert.throws(() => kitDialogFooters(`<KitDialog footer={'{'} title="t">`, 'probe.tsx'), /probe\.tsx: a brace on a <KitDialog> tag never closes/);
  });

  it('no KitDialog (or the coach shell over it) carries a sentence in its `footer` — it goes in `footerStart`', () => {
    const offenders: string[] = [];
    let footers = 0;
    for (const dir of ['app', 'components']) {
      for (const file of walk(path.join(ROOT, dir))) {
        const src = readFileSync(file, 'utf8');
        if (!src.includes('<KitDialog') && !src.includes('<QuestionShell')) continue;
        const code = stripComments(src.replace(/\r\n/g, '\n'));
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        for (const footer of kitDialogFooters(code, rel)) {
          footers++;
          const hit = sentenceIn(footer);
          if (hit) offenders.push(`${rel}: ${hit}`);
        }
      }
    }
    assert.ok(footers > 70, `the scan found only ${footers} window footers — it has stopped reading them`);
    assert.deepEqual(offenders, [], 'a sentence in a window\'s foot goes in `footerStart`, at the left — never among the buttons');
  });
});
