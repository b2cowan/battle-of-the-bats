/**
 * THE HELP SCREENSHOT MANIFEST CHECK — `--check` proves every picture in the help guides still
 * has its file, alt text, caption and size.
 *
 * Thin wrapper: the mechanics live ONCE in scripts/lib/shot-capture.mjs, shared with
 * capture-marketing-shots.mjs. The editorial rules for when a help picture is allowed to exist at
 * all stay in lib/help-shots.ts.
 *
 * ⚠ THIS SCRIPT NO LONGER TAKES PICTURES. It re-took them from the public demo worlds, which were
 * retired (owner ruling 2026-11-25, RETIRE_PUBLIC_DEMOS_PLAN.md Decision D6). The images under
 * `public/help/**` stay.
 *
 * ⚠ THESE IMAGES PROVE NOTHING. `check:layout` reads computed styles precisely
 * because eyeballing a screenshot produced the wrong fix twice in this portal. What
 * these pictures are is documentation for readers, never evidence about a layout.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/capture-help-shots.mjs --list       print the manifest and exit
 *   node scripts/capture-help-shots.mjs --check      verify each picture has a file
 *                                                    and the manifest has its size
 */
import { runShotCli } from './lib/shot-capture.mjs';
import { HELP_SHOTS } from '../lib/help-shots.ts';

await runShotCli({
  shots: HELP_SHOTS,
  outputRoot: 'public/help',
  groupOf: s => s.module,
  label: 'Help screenshots',
});
