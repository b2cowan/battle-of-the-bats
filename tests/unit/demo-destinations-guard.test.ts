import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDemoOrgByKind } from '../../lib/demo-org.ts';
import { sandboxMoments, sandboxTourSteps } from '../../lib/sandbox-chrome.ts';
import { SEE_IT_LIVE_PATH } from '../../lib/sandbox-door.ts';

/**
 * The demos' destinations are a list the build enforces — measure 2 of
 * `DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md`, built 2026-09-13 as part of `DEMO_PROCESS_DECOUPLING_PLAN.md`.
 *
 * Since that ruling, NOTHING asks a developer to think about the demos while shipping a feature.
 * This test is the one per-commit signal that survives, and it is mechanical: every screen the
 * dock or the tour sends a prospect to must still be a real route, and every panel a tour step
 * rings must still be in a component. Move or delete one, and the build fails here — which is
 * the decision point — rather than a prospect finding a 404 or a step with no ring.
 *
 * ⚠ Deliberately NOT a route-existence framework. It resolves a short, hand-listed set of demo
 * destinations against the `app/` tree with the simplest walker that can do it (literal segment,
 * `[param]` segment, route groups transparent). The moment it starts reading Next's router it has
 * become a different project.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = path.join(ROOT, 'app');
const MARKER_ROOTS = ['components', 'app'].map(d => path.join(ROOT, d));

/** Does a pathname resolve to a page or route handler under `app/`? */
function resolvesToRoute(pathname: string): boolean {
  const segments = pathname.split('?')[0].split('/').filter(Boolean);
  // Walk every branch that could match, since a literal dir and a [param] dir can coexist.
  let frontier = [APP];
  for (const seg of segments) {
    const next: string[] = [];
    for (const dir of frontier) {
      for (const candidate of childDirs(dir)) {
        const name = path.basename(candidate);
        if (name === seg || /^\[.+\]$/.test(name)) next.push(candidate);
      }
    }
    // Route groups `(name)` are transparent: descend through them without consuming a segment.
    frontier = next.flatMap(d => [d, ...childDirs(d).filter(c => /^\(.+\)$/.test(path.basename(c)))]);
    if (!frontier.length) return false;
  }
  return frontier.some(dir => ['page.tsx', 'page.ts', 'route.ts', 'route.tsx'].some(f => existsSync(path.join(dir, f))));
}

function childDirs(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).map(n => path.join(dir, n)).filter(p => statSync(p).isDirectory());
}

/** Every `data-sandbox-tour="…"` value written in a component or page. */
function markersInSource(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) { if (entry !== 'node_modules') walk(full); continue; }
      if (!/\.(tsx|ts)$/.test(entry)) continue;
      for (const m of readFileSync(full, 'utf8').matchAll(/data-sandbox-tour\s*[=:]\s*["'{]?\s*["']?([a-z0-9-]+)/g)) found.add(m[1]);
    }
  };
  for (const root of MARKER_ROOTS) walk(root);
  return found;
}

const kinds = ['tournament', 'coach'] as const;

describe('the demos point only at screens that exist', () => {
  for (const kind of kinds) {
    const demo = getDemoOrgByKind(kind)!;
    const org = { slug: demo.slug, landingPath: demo.landingPath };

    test(`${kind}: the door's landing path is a route`, () => {
      assert.ok(resolvesToRoute(demo.landingPath), `landing path has no page: ${demo.landingPath}`);
    });

    test(`${kind}: every dock landing (fan and operator side) is a route`, () => {
      for (const m of sandboxMoments(kind, org, { isDemoOrganizer: true })) {
        for (const href of [m.fanPath, m.operatorPath]) {
          assert.ok(resolvesToRoute(href), `moment "${m.key}" lands on a path with no page: ${href}`);
        }
      }
      // And the not-an-organizer variant falls back to the door, which is itself a route.
      assert.ok(resolvesToRoute(SEE_IT_LIVE_PATH), `the door has no route: ${SEE_IT_LIVE_PATH}`);
    });

    test(`${kind}: every tour step's destination is a route`, () => {
      for (const step of sandboxTourSteps(kind, org, { isDemoOrganizer: true })) {
        assert.ok(resolvesToRoute(step.href), `step ${step.n} "${step.label}" has no page: ${step.href}`);
      }
    });
  }
});

describe('every tour anchor still names a marker that exists in a component', () => {
  const markers = markersInSource();

  test('the marker sweep found something (else the guard below would pass vacuously)', () => {
    assert.ok(markers.size >= 8, `only ${markers.size} data-sandbox-tour markers found under components/ and app/`);
  });

  for (const kind of kinds) {
    test(`${kind}: each step's anchor resolves`, () => {
      const demo = getDemoOrgByKind(kind)!;
      for (const step of sandboxTourSteps(kind, { slug: demo.slug, landingPath: demo.landingPath })) {
        if (!step.anchor) continue;
        const m = step.anchor.match(/^\[data-sandbox-tour="([a-z0-9-]+)"\]$/);
        if (!m) {
          // A bare `#id` anchor is allowed only for a stable element id; keep it explicit.
          assert.ok(/^#[a-z0-9-]+$/.test(step.anchor), `step ${step.n} has an anchor shape this guard does not understand: ${step.anchor}`);
          continue;
        }
        assert.ok(markers.has(m[1]),
          `step ${step.n} "${step.label}" rings data-sandbox-tour="${m[1]}", which no component writes any more — `
          + 'the step still narrates but never rings; move the marker or retarget the step');
      }
    });
  }
});
