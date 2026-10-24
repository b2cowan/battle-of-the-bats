/**
 * CLUB TIER 4e, PART 4b: a surface a club's own address can show reads the address through usePublicPathname, never through
 * next/navigation's usePathname. On a club's own host the address has no club name in it (`/teams`), so a component that reads it
 * raw decides on a different path than on fieldlogichq.ca: the spike showed the club frame, the nav and the active tab all
 * vanish. A new component that imports the raw hook fails here, which is the decision point: use lib/use-public-pathname, or
 * say why the surface can never be shown on a club's own address (an operator or platform screen).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname ?? '.', '../..');
const SCAN = ['components', 'lib', 'app'];
const SKIP_DIRS = new Set(['node_modules', '.next']);

/** Surfaces that are never served on a club's own address (the proxy answers 404 for every one of their routes). */
const OPERATOR_OR_PLATFORM = (rel: string) =>
  rel.includes('/admin/') || rel.includes('/coaches/') || rel.includes('platform-admin') || rel.startsWith('app/api/');
/** Named exceptions, each with its reason. */
const EXCEPTIONS: Record<string, string> = {
  'lib/use-public-pathname.ts': 'the hook itself wraps the raw one',
  'lib/use-admin-flip.ts': 'the admin shell only',
  'components/chat/CoachChatView.tsx': 'the chat panel of the signed-in coaches portal',
  'app/(consumer)/account/AccountRail.tsx': 'the signed-in account shell: a club\'s own address 404s /account',
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield p;
  }
}

describe('no surface a club\'s own address can show reads the raw pathname', () => {
  it('every import of usePathname from next/navigation is an operator surface or a named exception', async () => {
    const offenders: string[] = [];
    for (const top of SCAN) {
      for await (const file of walk(path.join(ROOT, top))) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (OPERATOR_OR_PLATFORM(rel + '/') || OPERATOR_OR_PLATFORM('/' + rel) || EXCEPTIONS[rel]) continue;
        const src = await readFile(file, 'utf8');
        if (/import\s*\{[^}]*\busePathname\b[^}]*\}\s*from\s*'next\/navigation'/.test(src)) offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, [], `use usePublicPathname (lib/use-public-pathname) in: ${offenders.join(', ')}`);
  });

  it('every exception still exists and still uses the raw hook (so a stale entry cannot hide a gap)', async () => {
    for (const rel of Object.keys(EXCEPTIONS)) {
      const src = await readFile(path.join(ROOT, rel), 'utf8');
      assert.ok(/usePathname/.test(src), `${rel} no longer reads the raw pathname: drop it from EXCEPTIONS`);
    }
  });
});
