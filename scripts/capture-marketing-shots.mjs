/**
 * CAPTURE THE MARKETING SCREENSHOTS — re-take every picture in the pre-sales walkthrough
 * pages from the seeded demo world, deterministically, in one command.
 *
 * Thin wrapper: the mechanics (demo-world guard, door contexts, readiness waits, chrome
 * suppression, size write-back — and the incident history behind each) live ONCE in
 * scripts/lib/shot-capture.mjs. The editorial rules for WHAT gets photographed and how
 * the words around it behave live in lib/marketing-shots.ts, this manifest's one home.
 *
 * Marketing-specific notes:
 *   - `door: 'public'` shots run as a logged-out visitor with NO door press — fan-facing
 *     pictures must not carry the demo operator's chrome into "what parents see".
 *   - These images are the SPINE of the walkthrough pages; `--check` is wired into
 *     `verify:changed`, so a missing/renamed picture fails the build rather than
 *     silently dropping a panel.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/capture-marketing-shots.mjs              re-take all of them
 *   node scripts/capture-marketing-shots.mjs --only=a,b   just these manifest ids
 *   node scripts/capture-marketing-shots.mjs --list       print the manifest and exit
 *   node scripts/capture-marketing-shots.mjs --check      verify each picture has a file
 *                                                         and the manifest has its size
 *
 * Needs the dev server up (`npm run dev`) and the demo worlds seeded/fresh
 * (`npm run check:demos` self-heals dev). Both are reported rather than assumed.
 */
import { runShotCli } from './lib/shot-capture.mjs';
import { MARKETING_SHOTS } from '../lib/marketing-shots.ts';

await runShotCli({
  shots: MARKETING_SHOTS,
  manifestPath: 'lib/marketing-shots.ts',
  outputRoot: 'public/marketing',
  groupOf: s => s.persona,
  baseUrl: process.env.MARKETING_SHOTS_BASE_URL || 'http://localhost:3000',
  seedHint: 'npm run check:demos',
  retakeCmd: 'node scripts/capture-marketing-shots.mjs',
  label: 'Marketing screenshots',
});
