import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { countsOfSource as count, compareToBaseline, markerRole, KINDS, ROLES } from '../../scripts/lib/public-type.mjs';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE PUBLIC FACE'S TYPE CHECK (The public face, warm: S1, 2026-10-23) — `scripts/check-public-type.mjs`
 *
 * The check holds P1 (docs/agents/brand/VISUAL_IDENTITY.md): the typewriter face is for the wordmark, a plan
 * chip and real data, never a sentence, a label, a button, a heading or a link. Its counter lives in
 * `scripts/lib/public-type.mjs` so it can be fed a string here. What must stay true:
 *
 *   1. A signal is counted in a stylesheet, in an inline style, AND in an email's template string
 *      (`font-family:'Courier New'` inside a backtick string, which the admin check cannot see).
 *   2. A `type-ok: <role>` marker exempts a line only for the signals its role may carry. An eyebrow may be
 *      in capitals but never in the typewriter face; nothing exempts an 800 or 900 weight.
 *   3. A marker that names no allowed role is an error, not an exemption.
 *   4. Comments are not code.
 *   5. The ratchet only goes down: a count above its baseline fails, a file not in the baseline holds none,
 *      and a drop must be locked in.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

describe('public type check — what is counted', () => {
  it('counts the face, capitals and a heavy weight in a stylesheet', () => {
    const { c } = count('x.module.css', `.a {\n  font-family: var(--font-data);\n  text-transform: uppercase;\n  font-weight: 900;\n}\n`);
    assert.deepEqual(c, { face: 1, caps: 1, heavy: 1 });
  });

  it('counts Courier and monospace named in an email template string', () => {
    const { c } = count('lib/some-email.ts', "export const t = `<p style=\"font-family:'Courier New',Courier,monospace;font-size:15px;\">hi</p>`;\n");
    assert.deepEqual(c, { face: 1 });
  });

  it('counts a camel-cased inline style', () => {
    const { c } = count('x.tsx', `const s = { fontFamily: "ui-monospace, Menlo, monospace", textTransform: 'uppercase', fontWeight: 800 };\n`);
    assert.deepEqual(c, { face: 1, caps: 1, heavy: 1 });
  });

  it('does not count the body face, a 700 weight or tracking', () => {
    const { c } = count('x.module.css', `.a { font-family: var(--font-sans); font-weight: 700; letter-spacing: 0.2em; }\n`);
    assert.deepEqual(c, {});
  });

  it('does not count an email style that names another face before a semicolon-less end', () => {
    const { c } = count('lib/some-email.ts', 'export const t = `<div style="font-family:Arial,Helvetica,sans-serif">Courier service</div>`;\n');
    assert.deepEqual(c, {});
  });

  it('counts a double-quoted face name', () => {
    assert.deepEqual(count('x.module.css', '.x { font-family: "Courier New", serif; }\n').c, { face: 1 });
    assert.deepEqual(count('x.html', '<style>.x { font-family: "IBM Plex Mono"; }</style>\n').c, { face: 1 });
  });

  it('reads a declaration split across lines as one, credited to the line it starts on', () => {
    const css = count('x.module.css', `.x {\n  font-family:\n    Inter,\n    'Courier New',\n    monospace;\n}\n`);
    assert.deepEqual(css.c, { face: 1 });
    assert.deepEqual(css.lines, [2]);
    const ts = count('x.tsx', `const s = {\n  fontFamily:\n    'Courier New',\n  textTransform:\n    'uppercase',\n  fontWeight:\n    900,\n};\n`);
    assert.deepEqual(ts.c, { face: 1, caps: 1, heavy: 1 });
  });

  it('counts a hit that only exists once a comment between the property and its value is removed', () => {
    assert.deepEqual(count('x.module.css', '.x { text-transform:/**/uppercase; }\n').c, { caps: 1 });
    assert.deepEqual(count('x.ts', "const s = { fontWeight:/* c */900 };\n").c, { heavy: 1 });
  });

  it('does not count a custom property that merely ends in font-family, or the text after a tag', () => {
    assert.deepEqual(count('x.module.css', '.x { --brand-font-family: monospace; }\n').c, {});
    assert.deepEqual(count('lib/some-email.ts', "export const t = `<td style='font-family:Arial'>Courier service</td>`;\n").c, {});
  });

  it('ignores a commented-out declaration', () => {
    const css = count('x.module.css', `/* font-family: var(--font-data); text-transform: uppercase; */\n.a { color: red; }\n`);
    const ts = count('x.ts', `// fontFamily: 'monospace'\nconst a = 1;\n`);
    assert.deepEqual(css.c, {});
    assert.deepEqual(ts.c, {});
  });
});

describe('public type check — the allowed roles', () => {
  it('exempts the wordmark\'s face and capitals, but never its weight', () => {
    const { c } = count('x.module.css', `.w {\n  font-family: var(--font-data); /* type-ok: wordmark */\n  font-weight: 900;\n  text-transform: uppercase; /* type-ok: wordmark */\n}\n`);
    assert.deepEqual(c, { heavy: 1 });
  });

  it('takes a marker from the line above', () => {
    const { c } = count('x.ts', `const s = {\n  // type-ok: plan chip\n  fontFamily: 'monospace',\n};\n`);
    assert.deepEqual(c, {});
  });

  it('takes a marker above an email template string, where a comment cannot sit inside the string', () => {
    const src = "// type-ok: wordmark\nconst WORDMARK = `<p style=\"font-family:'Courier New',monospace;\">FIELD</p>`;\n";
    assert.deepEqual(count('lib/email-envelope-warm.ts', src).c, {});
  });

  it('lets an eyebrow be in capitals but not in the typewriter face', () => {
    const caps = count('x.module.css', `.e { text-transform: uppercase; } /* type-ok: eyebrow */\n`);
    assert.deepEqual(caps.c, {});
    const face = count('x.module.css', `.e { font-family: var(--font-data); } /* type-ok: eyebrow */\n`);
    assert.deepEqual(face.c, { face: 1 });
  });

  it('lets data be the typewriter face but not capitals', () => {
    const { c } = count('x.module.css', `.d { font-family: monospace; text-transform: uppercase; } /* type-ok: data */\n`);
    assert.deepEqual(c, { caps: 1 });
  });

  it('lets a marker trailing one declaration cover that declaration only, not the line below', () => {
    const { c, lines } = count('x.module.css', `.a {\n  text-transform: uppercase; /* type-ok: eyebrow */\n  text-transform: uppercase;\n}\n`);
    assert.deepEqual(c, { caps: 1 });
    assert.deepEqual(lines, [3]);
  });

  it('lets a marker standing alone on its own line cover the next line', () => {
    assert.deepEqual(count('x.module.css', `.a {\n  /* type-ok: eyebrow */\n  text-transform: uppercase;\n}\n`).c, {});
  });

  it('reads a marker only in its own form: a colon, and not as the tail of another word', () => {
    assert.equal(markerRole('x // type-ok data'), null);
    assert.equal(markerRole('xtype-ok: data'), null);
    assert.equal(markerRole('/* a type-ok: data */'), 'data');
  });

  it('treats a marker that names no allowed role as an error and counts the line', () => {
    const { c, badRoles } = count('x.module.css', `.a { font-family: monospace; } /* type-ok: because */\n`);
    assert.deepEqual(c, { face: 1 });
    assert.deepEqual(badRoles, [1]);
  });

  it('reads a role out of a comment however it is closed', () => {
    assert.equal(markerRole('x /* type-ok: plan chip */'), 'plan chip');
    assert.equal(markerRole('x <!-- type-ok: wordmark -->'), 'wordmark');
    assert.equal(markerRole('x // type-ok: data — a count'), 'data');
    assert.equal(markerRole('no marker'), null);
    assert.equal(markerRole('type-ok: datastore'), '');
  });

  it('exempts exactly the signals each role allows, and never a heavy weight', () => {
    const line = {
      face: 'font-family: monospace;',
      caps: 'text-transform: uppercase;',
      heavy: 'font-weight: 900;',
    } as Record<string, string>;
    for (const [role, allowed] of Object.entries(ROLES) as [string, string[]][]) {
      for (const kind of KINDS as string[]) {
        const { c } = count('x.module.css', `.a { ${line[kind]} } /* type-ok: ${role} */\n`);
        assert.equal(Object.keys(c).length === 0, allowed.includes(kind), `${role} / ${kind}`);
      }
    }
    for (const allowed of Object.values(ROLES) as string[][]) assert.ok(!allowed.includes('heavy'));
  });
});

describe('public type check — the ratchet', () => {
  const base = { 'a.css': { face: 3, caps: 2 }, 'b.css': { face: 1 } };

  it('passes when nothing rose', () => {
    const { rises, drops } = compareToBaseline({ 'a.css': { face: 3, caps: 2 }, 'b.css': { face: 1 } }, base);
    assert.equal(rises.length, 0);
    assert.equal(drops.length, 0);
  });

  it('refuses a count above its baseline', () => {
    const { rises } = compareToBaseline({ 'a.css': { face: 4, caps: 2 }, 'b.css': { face: 1 } }, base);
    assert.equal(rises.length, 1);
    assert.equal(rises[0].f, 'a.css');
    assert.deepEqual(rises[0].over, ['face']);
  });

  it('refuses a new signal in a file that had a baseline without it', () => {
    const { rises } = compareToBaseline({ 'a.css': { face: 3, caps: 2, heavy: 1 }, 'b.css': { face: 1 } }, base);
    assert.deepEqual(rises[0].over, ['heavy']);
  });

  it('holds a file that is not in the baseline to none', () => {
    const { rises } = compareToBaseline({ ...base, 'new.css': { caps: 1 } }, base);
    assert.deepEqual(rises.map((r: { f: string }) => r.f), ['new.css']);
  });

  it('asks for a drop to be locked in, including a file that left the count', () => {
    const { drops, rises } = compareToBaseline({ 'a.css': { face: 1, caps: 2 } }, base);
    assert.equal(rises.length, 0);
    assert.deepEqual(drops.map((d: { f: string }) => d.f).sort(), ['a.css', 'b.css']);
  });
});

describe('public type check — the command, end to end', () => {
  const SCRIPT = join(process.cwd(), 'scripts', 'check-public-type.mjs');

  const made: string[] = [];
  afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });

  /** A scratch checkout holding one email builder and a baseline, so the real script reads a tree the test controls. */
  function scratch(emailSource: string, baseline: Record<string, unknown>) {
    const dir = mkdtempSync(join(tmpdir(), 'public-type-'));
    made.push(dir);
    mkdirSync(join(dir, 'lib'));
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, 'lib', 'some-email.ts'), emailSource);
    writeFileSync(join(dir, 'scripts', '.public-type-baseline.json'), JSON.stringify(baseline));
    return dir;
  }
  const run = (dir: string, ...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  const COURIER = "export const t = `<p style=\"font-family:'Courier New',monospace;\">x</p>`;\n";

  it('fails a new email builder that sets the typewriter face, and --init will not admit it', () => {
    const dir = scratch(COURIER, {});
    const check = run(dir);
    assert.equal(check.status, 1, check.stderr);
    assert.match(check.stderr, /lib\/some-email\.ts/);
    const init = run(dir, '--init');
    assert.equal(init.status, 1, init.stderr);
    assert.match(init.stderr, /only lowers/);
  });

  it('passes when the same line carries its role', () => {
    const dir = scratch(`// type-ok: wordmark\n${COURIER}`, {});
    assert.equal(run(dir).status, 0);
  });

  it('holds a baselined count and asks for a drop to be locked in', () => {
    const held = scratch(COURIER, { 'lib/some-email.ts': { face: 1 } });
    const dropped = scratch('export const t = 1;\n', { 'lib/some-email.ts': { face: 1 } });
    assert.equal(run(held).status, 0);
    const drop = run(dropped);
    assert.equal(drop.status, 1);
    assert.match(drop.stderr, /went DOWN/);
    assert.equal(run(dropped, '--init').status, 0);
    assert.equal(run(dropped).status, 0);
  });
});
