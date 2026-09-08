/**
 * generate-campaign-reseed-migration.mjs
 *
 * Writes the data-only migration that re-seeds the marketing campaign copy in
 * `platform_email_templates` FROM the campaign registry (`lib/marketing-email-defaults.ts`).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The campaigns render from the DB row, not from the code default — so the code is not the live
 * copy, the row is. Every time the copy changes, the rows have to be re-seeded, and until
 * 2026-09-07 that meant hand-copying eight email bodies into a .sql file and trusting a
 * "KEEP IN SYNC" comment (migration 198's). Hand-copying prose into dollar-quoted SQL is exactly
 * the job a machine should do: one missed character is a customer-visible email that differs from
 * the one that was approved.
 *
 * `tests/unit/marketing-campaign-registry.test.ts` is the other half — it fails the build when the
 * newest reseed migration and the registry disagree, so a copy change that never reached a
 * migration cannot ship quietly.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   node --import ./tests/ts-resolver.mjs scripts/generate-campaign-reseed-migration.mjs
 *   node --import ./tests/ts-resolver.mjs scripts/generate-campaign-reseed-migration.mjs --number=285
 *
 * The `--import` is required: this reads a TypeScript module whose imports are extensionless.
 * Without a `--number` it claims the next free migration number and says which one it took.
 * ⚠ Re-check that number right before you commit — another session may have claimed it too.
 *
 * Then apply it:  node scripts/apply-migration-api.mjs supabase/migrations/<file>.sql
 *
 * ⚠ The output is DATA-ONLY, so `check:migrations` and `check:parity` are BLIND to it — neither can
 * prove it ran on production. Record the prod apply in the release history by hand.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MARKETING_EMAIL_DEFAULTS,
  ALL_MARKETING_EMAIL_KEYS,
  plannedSendDateFor,
} from '../lib/marketing-email-defaults.ts';
import {
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_SIGNUP_CLOSE_LABEL,
} from '../lib/plan-config.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

/**
 * The planned dates migration 180 seeded. A row still holding one of these has never been edited
 * by an operator, so a reseed may move it; anything else is a deliberate choice and is left alone.
 * ⚠ Append to this map rather than rewriting it — it is a record of what was seeded WHEN, and a
 * later reseed still has to recognise an older seeded value to know the operator never touched it.
 */
const PRIOR_SEEDED_DATES = {
  founding_renewal: ['2026-11-01', '2027-06-01'],
  founding_final: ['2026-12-15', '2027-09-15'],
  founding_nudge: ['2027-08-01'],
  spotlight_club: ['2026-08-01'],
  spotlight_league: ['2026-09-01'],
  spotlight_coaches_org: ['2026-10-01'],
  spotlight_coaches_coach: ['2026-10-01'],
  spotlight_club_last: ['2026-10-15'],
  spotlight_full_picture: ['2026-11-15'],
};

const SLUG = 'the_campaigns_learn_the_summer_calendar';

function nextMigrationNumber() {
  const highest = readdirSync(MIGRATIONS)
    .filter(f => /^\d+_/.test(f))
    .map(f => Number(f.split('_')[0]))
    .reduce((a, b) => Math.max(a, b), 0);
  return String(highest + 1);
}

const arg = process.argv.find(a => a.startsWith('--number='));
const N = arg ? arg.split('=')[1] : nextMigrationNumber();
if (!/^\d+$/.test(N)) {
  console.error(`Not a migration number: ${N}`);
  process.exit(1);
}

const TAG = `$seed${N}$`;
const q = (s) => {
  const v = String(s);
  if (v.includes(TAG)) throw new Error(`content collides with the dollar-quote tag ${TAG}`);
  return `${TAG}${v}${TAG}`;
};

const out = [];
out.push(`-- ${N}_${SLUG}.sql
--
-- CAMPAIGN RESEED  <- marker: tests/unit/marketing-campaign-registry.test.ts checks the
--                     HIGHEST-numbered migration carrying this line against the registry, so a
--                     later reseed takes over as the gate simply by carrying it too.
--
-- Founding Season 2027, Phase 1 (plan: docs/projects/active/FOUNDING_SEASON_2027_PLAN.md §3).
-- The free season now runs through ${FOUNDING_SEASON_END_LABEL} for everyone who signs up by
-- ${FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}, but the LIVE campaign send-copy is the
-- platform_email_templates row (migration 179 seed, re-seeded by 198) and every one of those rows
-- still described the January 1, 2027 cliff. Campaigns render from the row unconditionally
-- (alwaysRenderFromTemplate), so a send would have contradicted every other surface in the app.
--
-- GENERATED, NEVER HAND-TYPED, by scripts/generate-campaign-reseed-migration.mjs from
-- lib/marketing-email-defaults.ts — the campaign registry, whose dates and prices are themselves
-- derived from lib/plan-config.ts. Pinned by tests/unit/marketing-campaign-registry.test.ts, which
-- fails the build if this file and the registry ever disagree (the "KEEP IN SYNC" comment on
-- migration 198 was an honour system; this is what replaces it).
--
-- Follows the migration-198 pattern: DATA-ONLY (no schema change) and every write is gated on
-- is_customised = false, so a saved operator override always wins.
--
-- ⚠ DATA-ONLY MIGRATIONS ARE INVISIBLE TO check:migrations — both drift checks compare SCHEMA, so
-- nothing can prove this ran on production. Record the prod apply in the release history.
--
-- WHAT CHANGES
--   · The live campaigns get the summer-2027 calendar. Every date and price reads from config.
--   · founding_renewal moves Nov 1, 2026 -> Jun 1, 2027 (the card window opens with it).
--   · founding_final  moves Dec 15, 2026 -> Sep 15, 2027.
--   · founding_nudge is NEW (Aug 1, 2027) — inserted here.
--   · spotlight_club / spotlight_league / spotlight_club_last are RETIRED: their description says
--     so, and the app no longer lists, previews, test-sends or sends them. Their BODIES ARE
--     DELIBERATELY UNTOUCHED so the copy survives for the day League or Club un-parks.
--   · No row is deleted. A data-only DELETE cannot be seen by any gate we have, which is how
--     migration 264 ended up stranded (CLAUDE.md).
--
-- A planned date moves only while it still holds a value a previous seed wrote (or is NULL) —
-- an operator who has picked their own date keeps it.
`);

/**
 * Keys this reseed must CREATE rather than update. A key already seeded by an earlier migration is
 * not listed. Kept explicit — inserting every key "just in case" would resurrect a row an operator
 * had deliberately had deleted.
 */
const NEW_KEYS = ['founding_nudge'];

for (const key of NEW_KEYS) {
  const c = MARKETING_EMAIL_DEFAULTS[key];
  if (!c) throw new Error(`NEW_KEYS names a campaign the registry does not have: ${key}`);
  out.push(`
-- ── NEW: ${key} ──────────────────────────────────────────────────────────────
insert into platform_email_templates
  (key, label, description, subject, heading, body, variables, category, is_customised, planned_send_date, updated_at, updated_by)
values (
  ${q(key)},
  ${q(c.label)},
  ${q(c.description)},
  ${q(c.subject)},
  ${q(c.heading)},
  ${q(c.body)},
  ${q(JSON.stringify(c.variables))}::jsonb,
  ${q('marketing')},
  false,
  ${q(plannedSendDateFor(key))}::date,
  now(),
  ${q(`migration-${N}`)}
)
on conflict (key) do nothing;
`);
}

// ── Every campaign's copy ────────────────────────────────────────────────────
for (const key of ALL_MARKETING_EMAIL_KEYS) {
  const c = MARKETING_EMAIL_DEFAULTS[key];
  const banner = c.retired
    ? `-- ${key} — RETIRED ${c.retired.on} (${c.retired.why}). Description only; the copy is kept as written.`
    : `-- ${key}`;
  out.push(`\n${banner}`);

  // ⚠ THE DATE MOVE MUST COME FIRST, and the ordering is load-bearing.
  //
  // There is no is_customised flag for planned_send_date — the schedule route edits the date and
  // stamps updated_by, but never sets is_customised. So the only evidence that a human has touched
  // this row at all is updated_by NOT being one of our own migration stamps. The content UPDATE
  // below overwrites updated_by with this migration's stamp, which would destroy that evidence
  // before the date guard could read it. Emitting the date first keeps the guard honest.
  //
  // Belt and braces: the date moves only if the row is untouched by a human (updated_by) AND still
  // holds a value one of our seeds wrote (planned_send_date). An operator who has picked their own
  // date — even one that happens to equal an old default — keeps it.
  const planned = plannedSendDateFor(key);
  const priors = (PRIOR_SEEDED_DATES[key] ?? []).filter(d => d !== planned);
  if (!c.retired && planned && priors.length > 0) {
    const list = priors.map(d => `${q(d)}::date`).join(', ');
    out.push(`
update platform_email_templates
  set planned_send_date = ${q(planned)}::date,
      updated_at = now(),
      updated_by = ${q(`migration-${N}`)}
where key = ${q(key)}
  and is_customised = false
  and (updated_by is null or updated_by like ${q('migration-%')})
  and (planned_send_date is null or planned_send_date in (${list}));`);
  }

  out.push(`
update platform_email_templates set
  label = ${q(c.label)},
  description = ${q(c.description)},
  subject = ${q(c.subject)},
  heading = ${q(c.heading)},
  body = ${q(c.body)},
  variables = ${q(JSON.stringify(c.variables))}::jsonb,
  updated_at = now(),
  updated_by = ${q(`migration-${N}`)}
where key = ${q(key)}
  and is_customised = false;`);
}
out.push('');

const file = path.join(MIGRATIONS, `${N}_${SLUG}.sql`);
writeFileSync(file, out.join('\n'), 'utf8');
console.log(`Wrote ${path.relative(ROOT, file)}`);
console.log(`  ${ALL_MARKETING_EMAIL_KEYS.length} campaigns (${NEW_KEYS.length} inserted, ` +
            `${ALL_MARKETING_EMAIL_KEYS.filter(k => MARKETING_EMAIL_DEFAULTS[k].retired).length} retired)`);
console.log(`  ⚠ Re-check that ${N} is still free before you commit, then apply it:`);
console.log(`      node scripts/apply-migration-api.mjs ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
