import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDemoOrgByKind } from '../../lib/demo-org.ts';
import { sandboxMoments, sandboxTourSteps } from '../../lib/sandbox-chrome.ts';
import { SEE_IT_LIVE_PATH } from '../../lib/sandbox-door.ts';
import { filesUnder, reachableFrom, readCode } from './_source-code.ts';

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

/** Every page or route handler under `app/` a pathname could resolve to, repo-relative. */
function routeFilesFor(pathname: string): string[] {
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
    if (!frontier.length) return [];
  }
  return frontier
    .flatMap(dir => ['page.tsx', 'page.ts', 'route.ts', 'route.tsx'].map(f => path.join(dir, f)))
    .filter(f => existsSync(f))
    .map(f => path.relative(ROOT, f).split(path.sep).join('/'));
}

function childDirs(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).map(n => path.join(dir, n)).filter(p => statSync(p).isDirectory());
}

/** A `data-sandbox-tour="…"` value as written in source — the attribute, or a prop forwarded under that name. */
const MARKER = /data-sandbox-tour\s*[=:]\s*\{?\s*["']([a-z0-9-]+)["']/g;
/** A tour step's anchor, which must ring a marker (never a bare `#id` — see the step check). */
const ANCHOR = /^\[data-sandbox-tour="([a-z0-9-]+)"\]$/;

const markerCache = new Map<string, string[]>();
/** The markers one repo-relative source file writes, read as code (a marker named in a comment is not one). */
function markersOf(rel: string): string[] {
  let hit = markerCache.get(rel);
  if (!hit) {
    hit = rel.endsWith('.css') ? [] : [...readCode(rel).matchAll(MARKER)].map(m => m[1]);
    markerCache.set(rel, hit);
  }
  return hit;
}

const markersIn = (files: Iterable<string>) => new Set([...files].flatMap(markersOf));

const kinds = ['tournament', 'coach'] as const;

describe('the demos point only at screens that exist', () => {
  for (const kind of kinds) {
    const demo = getDemoOrgByKind(kind)!;
    const org = { slug: demo.slug, landingPath: demo.landingPath };

    test(`${kind}: the door's landing path is a route`, () => {
      assert.ok(routeFilesFor(demo.landingPath).length, `landing path has no page: ${demo.landingPath}`);
    });

    test(`${kind}: every dock landing (fan and operator side) is a route`, () => {
      for (const m of sandboxMoments(kind, org, { isDemoOrganizer: true })) {
        for (const href of [m.fanPath, m.operatorPath]) {
          assert.ok(routeFilesFor(href).length, `moment "${m.key}" lands on a path with no page: ${href}`);
        }
      }
      // And the not-an-organizer variant falls back to the door, which is itself a route.
      assert.ok(routeFilesFor(SEE_IT_LIVE_PATH).length, `the door has no route: ${SEE_IT_LIVE_PATH}`);
    });

    test(`${kind}: every tour step's destination is a route`, () => {
      for (const step of sandboxTourSteps(kind, org, { isDemoOrganizer: true })) {
        assert.ok(routeFilesFor(step.href).length, `step ${step.n} "${step.label}" has no page: ${step.href}`);
      }
    });
  }
});

describe('every tour anchor names a marker the page it lands on writes', () => {
  const markers = markersIn(['components', 'app'].flatMap(d => [...filesUnder(d, '.tsx'), ...filesUnder(d, '.ts')]));

  test('the marker sweep found something (else the guard below would pass vacuously)', () => {
    assert.ok(markers.size >= 8, `only ${markers.size} data-sandbox-tour markers found under components/ and app/`);
  });

  test('the import walk reaches a page\'s body (else the page check below would pass vacuously)', () => {
    // The tournament Overview page renders its body straight from the page (the old early return went in Stage 8 Part 3d).
    assert.ok(reachableFrom(...routeFilesFor('/an-org/a-tournament')).has('components/public/TournamentOverview.tsx'),
      'the Overview page\'s import walk did not reach components/public/TournamentOverview.tsx');
  });

  for (const kind of kinds) {
    test(`${kind}: each step's anchor is a marker, written in its destination page's source`, () => {
      const demo = getDemoOrgByKind(kind)!;
      let anchored = 0; // a tour whose steps all lost their anchors would otherwise pass with nothing checked
      for (const step of sandboxTourSteps(kind, { slug: demo.slug, landingPath: demo.landingPath })) {
        if (!step.anchor) continue;
        anchored += 1;
        const m = step.anchor.match(ANCHOR);
        // ⚠ Markers only. A bare `#id` used to be allowed and was never checked: the tournament tour's first step rang
        // `#today`, which only the switch-off Overview wrote, so deleting that page would have passed in silence
        // (Stage 8 Part 2, 2026-11-03). An id is a page's own business; a marker is a contract with the tour.
        assert.ok(m, `step ${step.n} has an anchor that is not a data-sandbox-tour marker: ${step.anchor}`);
        assert.ok(markers.has(m[1]),
          `step ${step.n} "${step.label}" rings data-sandbox-tour="${m[1]}", which no component writes any more — `
          + 'the step still narrates but never rings; move the marker or retarget the step');
        // …and on the page the step LANDS on, not merely somewhere. A marker can survive on another page: the bracket's
        // is written by both the switch-off Standings and the new Playoffs, so a step left on `/standings` would pass
        // the line above once the old Standings is deleted, ringing nothing. Layouts are not walked (none holds a
        // marker); while an old and a new half share a page, both count, until the old one is deleted.
        assert.ok(markersIn(reachableFrom(...routeFilesFor(step.href))).has(m[1]),
          `step ${step.n} "${step.label}" lands on ${step.href}, but nothing that page renders writes `
          + `data-sandbox-tour="${m[1]}" — the step narrates on a page where its ring cannot appear`);
      }
      assert.ok(anchored >= 1, `${kind}: no tour step rings an anchor, so nothing above was checked`);
    });
  }
});
