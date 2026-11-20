import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readCode } from './_source-code.ts';

/**
 * A PAGE TITLE NEVER CARRIES THE BRAND TWICE (small fixes from the on-sale doors walk, call C5, 2026-11-19).
 *
 * The root layout adds " | FieldLogicHQ" to every page title (`title.template`). A page that also wrote
 * "… — FieldLogicHQ" into its own title read "Get started — FieldLogicHQ | FieldLogicHQ" in the tab. A page gives only
 * its own name; the template adds the brand once. The one exception is a page that opts out of the template with
 * `absolute` (the home page, whose title is the brand's own line).
 */
const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/^(page|layout)\.tsx$/.test(name)) out.push(path);
  }
  return out;
}

/** A `title:` key (metadata), not an attribute (`title={…}`), the web-app title or a route's notification payload. */
const TITLE_KEY_WITH_BRAND = /(?<![-\w])title:\s*[`'"][^`'"\n]*FieldLogicHQ/;

describe('a page title carries the brand once, from the root template', () => {
  it('the root layout still appends the brand (the premise of this guard)', () => {
    assert.match(readCode('app/layout.tsx'), /template:\s*'%s \| FieldLogicHQ'/);
  });

  it('no page or layout writes the brand into its own title unless it opts out of the template', () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'app'))) {
      const rel = relative(ROOT, file).replaceAll('\\', '/');
      if (rel === 'app/layout.tsx' || rel.startsWith('app/api/')) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (TITLE_KEY_WITH_BRAND.test(line) && !/absolute/.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
    assert.deepEqual(offenders, [], 'a title names its page only; the root layout adds "| FieldLogicHQ"');
  });

  it('the guard catches the doubled shape it exists for', () => {
    assert.ok(TITLE_KEY_WITH_BRAND.test("  title: 'Get started — FieldLogicHQ',"));
    assert.ok(TITLE_KEY_WITH_BRAND.test("export const metadata = { title: `${LABEL} — FieldLogicHQ` };"));
    assert.ok(!TITLE_KEY_WITH_BRAND.test("      'apple-mobile-web-app-title': 'FieldLogicHQ',"));
    assert.ok(!TITLE_KEY_WITH_BRAND.test('<SystemScreen title={WORDS.doneTitle} legal="FieldLogicHQ · Canada">'));
  });
});
