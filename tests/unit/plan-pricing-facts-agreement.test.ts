/**
 * THE FACTS DOC AND THE PLAN CONFIG AGREE ON EVERY PLAN'S NAME AND PRICE (Plans & pricing Stage 1 Part 3).
 *
 * `docs/agents/strategy/PLAN_PRICING_FACTS.md` is the canonical record of plan names and prices (CLAUDE.md,
 * "Plan & pricing — single source of truth"); `lib/plan-config.ts` is what the product charges and shows.
 * Nothing used to check that they agree, so a price changed on one side only would ship silently.
 *
 * This reads ONLY the "Plans at a glance" table, so ordinary edits to the doc's prose never fail the build.
 * For each row it compares the public name, the monthly price and the annual price with PLAN_CONFIG.
 * A plan missing from the table fails, and so does a row that names no plan (unless it is listed in
 * NOT_A_PLAN with its reason).
 *
 * Which side to believe: the Facts doc. Change `lib/plan-config.ts` to match, or log the change through
 * `/strategy` first and then change both in the same unit of work.
 *
 * Related, already covered elsewhere (do not duplicate here): `lib/stripe-price-validation.ts` checks a
 * Stripe price against PLAN_CONFIG when staff wire it in Plans & pricing (amount, currency, interval,
 * environment). The fee rates have their own test against this doc.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_CONFIG } from '../../lib/plan-config';
import type { OrgPlan } from '../../lib/types';

const FACTS_PATH = 'docs/agents/strategy/PLAN_PRICING_FACTS.md';
const TABLE_HEADING = '## Plans at a glance';

/** The table's public name (the bold part of the first cell) → the plan key it describes. */
const FACTS_ROW_TO_PLAN: Record<string, OrgPlan> = {
  'Tournament': 'tournament',
  'Tournament Plus': 'tournament_plus',
  'League Plus': 'league',
  'Club': 'club',
  'Club · Association': 'club_large',
  'Premium Coaches Portal': 'team',
};

/** Rows in the table that are deliberately not a plan key. Each needs its reason. */
const NOT_A_PLAN: Record<string, string> = {
  // The free League floor is a setting on an organization (`free_floor = 'league_starter'`), not an OrgPlan;
  // it is parked and has no row in PLAN_CONFIG.
  'League': 'the free League floor, a free_floor setting rather than a plan',
};

const BELIEVE = 'The Facts doc is canonical: change lib/plan-config.ts to match, or log the change through /strategy first.';

interface FactsRow {
  name: string;
  monthly: number | null;
  annual: number | null;
}

/** "Free" → 0, "$2,190" → 2190, ignoring bold and any *(italic aside)*. Null when no price is found. */
function parsePrice(cell: string): number | null {
  const plain = cell.replace(/\*\([^)]*\)\*/g, '').replace(/\*/g, '');
  const match = plain.match(/Free|\$\s?([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  if (match[0] === 'Free') return 0;
  return Number(match[1].replace(/,/g, ''));
}

/** The rows of the "Plans at a glance" table, and nothing else in the document. */
function parseFactsTable(markdown: string): FactsRow[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === TABLE_HEADING);
  if (start === -1) throw new Error(`${FACTS_PATH} has no "${TABLE_HEADING}" heading`);
  const rows: FactsRow[] = [];
  let seenTable = false;
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (seenTable) break;
      continue;
    }
    seenTable = true;
    const cells = trimmed.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (/^:?-+:?$/.test(cells[0]) || /^Plan\b/.test(cells[0])) continue; // separator and header
    const bold = cells[0].match(/\*\*([^*]+)\*\*/);
    rows.push({
      name: (bold ? bold[1] : cells[0]).trim(),
      monthly: parsePrice(cells[1] ?? ''),
      annual: parsePrice(cells[2] ?? ''),
    });
  }
  return rows;
}

/** Every disagreement between the table and PLAN_CONFIG, as a sentence naming the plan. */
function compareToConfig(rows: FactsRow[]): string[] {
  const problems: string[] = [];
  const covered = new Set<OrgPlan>();
  for (const row of rows) {
    if (row.name in NOT_A_PLAN) continue;
    const plan = FACTS_ROW_TO_PLAN[row.name];
    if (!plan) {
      problems.push(`The Facts doc row "${row.name}" names no plan. Add it to FACTS_ROW_TO_PLAN (or NOT_A_PLAN, with its reason) in this test, or correct the row.`);
      continue;
    }
    covered.add(plan);
    const cfg = PLAN_CONFIG[plan];
    if (cfg.label !== row.name) {
      problems.push(`Plan ${plan}: the Facts doc names it "${row.name}" but lib/plan-config.ts says "${cfg.label}".`);
    }
    if (row.monthly !== cfg.monthlyPrice) {
      problems.push(`Plan ${plan} (${row.name}): the Facts doc says ${row.monthly === null ? 'no monthly price' : `$${row.monthly}/month`} but lib/plan-config.ts says $${cfg.monthlyPrice}/month.`);
    }
    if (row.annual !== cfg.annualPrice) {
      problems.push(`Plan ${plan} (${row.name}): the Facts doc says ${row.annual === null ? 'no annual price' : `$${row.annual}/year`} but lib/plan-config.ts says $${cfg.annualPrice}/year.`);
    }
  }
  for (const plan of Object.keys(PLAN_CONFIG) as OrgPlan[]) {
    if (!covered.has(plan)) problems.push(`Plan ${plan} (${PLAN_CONFIG[plan].label}) has no row in the Facts doc's "Plans at a glance" table.`);
  }
  return problems;
}

const facts = readFileSync(join(process.cwd(), FACTS_PATH), 'utf8');

describe('the Facts doc and the plan config agree on every plan', () => {
  it('reads the whole table (the check is not blind)', () => {
    const rows = parseFactsTable(facts);
    assert.ok(rows.length >= Object.keys(PLAN_CONFIG).length, `found only ${rows.length} rows in "${TABLE_HEADING}"`);
    for (const row of rows) {
      if (row.name in NOT_A_PLAN) continue;
      assert.notEqual(row.monthly, null, `could not read a monthly price for "${row.name}"`);
      assert.notEqual(row.annual, null, `could not read an annual price for "${row.name}"`);
    }
  });

  it('every plan has the same public name, monthly price and annual price on both sides', () => {
    const problems = compareToConfig(parseFactsTable(facts));
    assert.deepEqual(problems, [], `${problems.join('\n')}\n${BELIEVE}`);
  });

  it('a changed price, a renamed plan and a missing row all fail with a sentence naming the plan', () => {
    const tampered = facts
      .replace(/\| \*\*Tournament Plus\*\* \| \$39/, '| **Tournament Plus** | $49')
      .replace('**Club · Association**', '**Club Association**')
      .replace(/^\| \*\*Premium Coaches Portal\*\*.*$/m, '');
    const problems = compareToConfig(parseFactsTable(tampered));
    assert.ok(problems.includes('Plan tournament_plus (Tournament Plus): the Facts doc says $49/month but lib/plan-config.ts says $39/month.'), problems.join('\n'));
    assert.ok(problems.some(p => p.startsWith('The Facts doc row "Club Association" names no plan.')), problems.join('\n'));
    assert.ok(problems.includes('Plan club_large (Club · Association) has no row in the Facts doc\'s "Plans at a glance" table.'), problems.join('\n'));
    assert.ok(problems.includes('Plan team (Premium Coaches Portal) has no row in the Facts doc\'s "Plans at a glance" table.'), problems.join('\n'));
  });

  it('reads prices written the doc\'s several ways', () => {
    const rows = parseFactsTable([
      TABLE_HEADING, '',
      '| Plan (public name) | Monthly | Annual |',
      '|---|---|---|',
      '| **Club** | **$219** *(was $179)* | **$2,190** |',
      '| **Tournament** (free) | Free | Free |',
      '| **Tournament Plus** | $39 *(Founding Season closed 2026-10-25; see Promotions)* | $390 |',
      '',
      '| **Not this** | $1 | $2 |',
    ].join('\n'));
    assert.deepEqual(rows, [
      { name: 'Club', monthly: 219, annual: 2190 },
      { name: 'Tournament', monthly: 0, annual: 0 },
      { name: 'Tournament Plus', monthly: 39, annual: 390 },
    ]);
  });
});
