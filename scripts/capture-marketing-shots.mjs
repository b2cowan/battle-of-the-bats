/**
 * THE MARKETING SCREENSHOT MANIFEST CHECK — `--check` proves every picture in the pre-sales
 * walkthrough pages still has its file, alt text, caption and size.
 *
 * Thin wrapper: the mechanics live ONCE in scripts/lib/shot-capture.mjs, and the editorial rules
 * for WHAT is pictured live in lib/marketing-shots.ts, this manifest's one home.
 *
 * ⚠ THIS SCRIPT NO LONGER TAKES PICTURES. It re-took them from the public demo worlds, which were
 * retired (owner ruling 2026-11-25, RETIRE_PUBLIC_DEMOS_PLAN.md Decision D6). The images under
 * `public/marketing/**` stay. These images are the SPINE of the walkthrough pages; `--check` is
 * wired into `verify:changed`, so a missing/renamed picture fails the build rather than silently
 * dropping a panel.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/capture-marketing-shots.mjs --list       print the manifest and exit
 *   node scripts/capture-marketing-shots.mjs --check      verify each picture has a file
 *                                                         and the manifest has its size
 */
import { runShotCli } from './lib/shot-capture.mjs';
import { MARKETING_SHOTS } from '../lib/marketing-shots.ts';

await runShotCli({
  shots: MARKETING_SHOTS,
  outputRoot: 'public/marketing',
  groupOf: s => s.persona,
  label: 'Marketing screenshots',
});
