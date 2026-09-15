import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ═══ ONE WORD PER THING — the development vocabulary (re-evaluation stage 1, owner rulings B1 + B2,
 * 2026-09-14) ═══
 *
 * The coach met the two kinds of metric under FIVE labels across the product ("Measured test" /
 * "Observed skill" on the Metrics tab, the editor and the scope dialog; "· observation" in the
 * Insights dropdown; "Skill" and "Test" on the Overview card and the help's own intro), and the
 * number a stopwatch gives had three names (reading · attempt · result). The ladder is now fixed:
 *
 *     metric → test | skill → result | observation → attempt
 *
 * This guard reads what a coach READS — JSX text and prose-shaped string literals, never code or
 * comments — on every development surface and refuses the retired words. Help copy is swept by
 * /docs and keeps the old terms as search keywords by convention, so it is not scanned here.
 * Add a surface when you add a screen; add a phrase when a ruling retires one.
 */

const ROOT = process.cwd();
const SURFACES = [
  'app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/development/sessions/[sessionId]/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/history/development/panel.tsx',
  'app/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]/replace/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/observations/route.ts',
  'components/coaches/MetricDefinitionSheet.tsx',
  'components/coaches/SessionSheet.tsx',
  'components/coaches/MetricPickerCombobox.tsx',
  'components/coaches/SessionRecordGrid.tsx',
  'components/coaches/PlayerDevelopmentSection.tsx',
  'components/coaches/DevelopmentHandoutPreview.tsx',
  'components/coaches/ReviewGoalDialog.tsx',
  'components/coaches/RecordObservationDialog.tsx',
  'lib/measurable-definition.ts',
  'lib/measurable-series.ts',
  'lib/development-report.ts',
  'lib/development-session-view.ts',
  'lib/development-session-move.ts',
  'lib/development-input.ts',
  'lib/development-goal-history.ts',
  'lib/player-notes-timeline.ts',
];

/** The retired words, as a coach would meet them. Case-insensitive; whole words. */
const RETIRED: ReadonlyArray<[RegExp, string]> = [
  [/\bmeasured tests?\b/i, '"measured test" — the kind is "test" (B1)'],
  [/\bobserved skills?\b/i, '"observed skill" — the kind is "skill" (B1)'],
  [/\bmeasurable types?\b/i, '"measurable type" — it is a "metric" (B1)'],
  [/\bmeasurables?\b/i, '"measurable" — a test produces a "result" (B2)'],
  [/\breadings?\b/i, '"reading" — the number inside a result is an "attempt"; a row is a "result" (B2)'],
];

/** What a coach reads: JSX text nodes and string literals that look like prose. Comments stripped first. */
function prose(source: string, jsx: boolean): string[] {
  const src = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const out: string[] = [];
  // JSX text nodes — .tsx only; in a .ts file a `>…<` span is a generic's type list, not prose.
  if (jsx) for (const m of src.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) { const t = m[1].trim(); if (t.length > 2 && !/\)\s*:|=>|\[\]/.test(t)) out.push(t); }
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) {
    const t = m[2];
    if (/\s/.test(t) && /[a-z]{3}/.test(t) && !/className|import|from|\.tsx|\/api\/|^[a-z-]+:/.test(t)) out.push(t);
  }
  return out;
}

describe('the development vocabulary — one word per thing, on every surface a coach reads', () => {
  for (const rel of SURFACES) {
    it(rel, () => {
      const file = path.join(ROOT, rel);
      assert.ok(fs.existsSync(file), `${rel} is gone — drop it from SURFACES or fix the path`);
      const lines = prose(fs.readFileSync(file, 'utf8'), rel.endsWith('.tsx'));
      const hits: string[] = [];
      for (const line of lines) {
        for (const [re, why] of RETIRED) {
          if (re.test(line)) hits.push(`${why}: ${JSON.stringify(line.slice(0, 90))}`);
        }
      }
      assert.deepEqual(hits, [], `${rel} still says a retired word:\n  ${hits.join('\n  ')}`);
    });
  }
});
