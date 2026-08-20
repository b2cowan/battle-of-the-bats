/**
 * CAPTURE THE HELP SCREENSHOTS — re-take every picture in the help guides from the
 * seeded demo world, deterministically, in one command.
 *
 * ── WHY A SCRIPT AND NOT A PERSON WITH A CROPPING TOOL ────────────────────────
 * A hand-taken screenshot is a promise nobody can keep. It carries whatever data the
 * person happened to have on screen, at whatever width their laptop happened to be,
 * and when the product moves there is no way to find which pictures went stale or to
 * re-take them without doing the whole ritual again. Everything here exists so that
 * "the screen changed" has a one-command answer.
 *
 * Thin wrapper: the mechanics (demo-world guard, door contexts, readiness waits, chrome
 * suppression, size write-back — and the incident history behind each) live ONCE in
 * scripts/lib/shot-capture.mjs, shared with capture-marketing-shots.mjs. The editorial
 * rules for when a help picture is allowed to exist at all stay in lib/help-shots.ts.
 *
 * ⚠ THESE IMAGES PROVE NOTHING. `check:layout` reads computed styles precisely
 * because eyeballing a screenshot produced the wrong fix twice in this portal. What
 * this script makes is documentation for readers, never evidence about a layout.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/capture-help-shots.mjs              re-take all of them
 *   node scripts/capture-help-shots.mjs --only=a,b   just these manifest ids
 *   node scripts/capture-help-shots.mjs --list       print the manifest and exit
 *   node scripts/capture-help-shots.mjs --check      verify each picture has a file
 *                                                    and the manifest has its size
 *
 * Needs the dev server up (`npm run dev`) and the coach/tournament demo worlds seeded
 * (`npm run seed:demo-coach`). Both are reported rather than assumed.
 */
import { runShotCli } from './lib/shot-capture.mjs';
import { HELP_SHOTS } from '../lib/help-shots.ts';

await runShotCli({
  shots: HELP_SHOTS,
  manifestPath: 'lib/help-shots.ts',
  outputRoot: 'public/help',
  groupOf: s => s.module,
  baseUrl: process.env.HELP_SHOTS_BASE_URL || 'http://localhost:3000',
  seedHint: 'npm run seed:demo-coach',
  retakeCmd: 'node scripts/capture-help-shots.mjs',
  label: 'Help screenshots',
});
