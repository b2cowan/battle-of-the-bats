/**
 * THE SHOT-MANIFEST CHECK — one implementation of "does every declared picture exist, with its
 * words and its size?", shared by scripts/capture-help-shots.mjs and
 * scripts/capture-marketing-shots.mjs, which stay thin: they name their manifest and output root,
 * and the mechanics happen here ONCE.
 *
 * ── THIS FILE USED TO TAKE THE PICTURES, AND NO LONGER DOES ───────────────────
 * Until 2026-11 it photographed screens in the two public demo worlds (the demo doors,
 * the `riverdale-*` allow-list, the demo-chrome suppression). Both demos were retired (owner
 * ruling 2026-11-25, `docs/projects/active/RETIRE_PUBLIC_DEMOS_PLAN.md` Decision D6): the existing
 * images under `public/marketing/**` and `public/help/**` stay, their capture source went. A future
 * re-shoot needs another source — a dev fixture org or a prospect world — and a capture mode built
 * for it; that is new work, not a thing to restore from history unread. The capture code, with its
 * seven incident notes (door rate limits, hidden-but-mounted panels, timezone, the dev-tools badge,
 * a fixed bar over a prepare click), is in git history before this change.
 *
 * What remains is `--list` and `--check`, wired into `verify:changed` through
 * `npm run check:marketing-shots` and `npm run check:help-shots`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shotManifestProblems } from '../../lib/shot-health.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Run the CLI (--list / --check).
 *
 * @param {object} cfg
 * @param {Array}  cfg.shots       the manifest array (HelpShot[] / MarketingShot[])
 * @param {string} cfg.outputRoot  repo-relative folder holding the images
 * @param {(s: any) => string} cfg.groupOf  the shot's subfolder (help: module; marketing: persona)
 * @param {string} cfg.label       human name for messages ("Help screenshots")
 */
export async function runShotCli({ shots, outputRoot, groupOf, label }) {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    for (const s of shots) console.log(`${s.id.padEnd(34)} ${groupOf(s).padEnd(12)} ${outputRoot}/${groupOf(s)}/${s.id}.png`);
    return;
  }

  /* ── --check: no browser, just prove every declared picture actually exists. ──
     ⚠ The four rules themselves live in lib/shot-health.ts, NOT here, because the Pitch Deck
     Studio's library view asks the same four of the same manifest. Shared rather than copied — and
     read that module's header for the large thing these four questions do NOT prove. */
  if (args.includes('--check')) {
    const problems = [];
    for (const s of shots) {
      const where = `${outputRoot}/${groupOf(s)}/${s.id}.png`;
      const present = existsSync(path.join(ROOT, outputRoot, groupOf(s), `${s.id}.png`));
      for (const p of shotManifestProblems(s, { present, where })) problems.push(`${s.id}: ${p}`);
    }
    if (problems.length) {
      console.error(`✖ ${label}:`);
      for (const p of problems) console.error('    ' + p);
      console.error('  Restore the image, or fix the manifest entry (or take the picture out of the page).');
      process.exit(1);
    }
    console.log(`✓ ${label}: ${shots.length} declared, all present with alt, caption and size.`);
    return;
  }

  console.error(`${label}: nothing to run. This script no longer takes pictures (the demo worlds were retired); use --check or --list.`);
  process.exit(1);
}
