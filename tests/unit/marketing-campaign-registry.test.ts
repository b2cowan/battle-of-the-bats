import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MARKETING_EMAIL_DEFAULTS,
  ALL_MARKETING_EMAIL_KEYS,
  LIVE_MARKETING_CAMPAIGNS,
  LIVE_MARKETING_EMAIL_KEYS,
  MARKETING_EMAIL_AUDIENCE,
  plannedSendDateFor,
} from '../../lib/marketing-email-defaults.ts';
import {
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_CARD_WINDOW_OPEN,
} from '../../lib/plan-config.ts';
import { renderHeadingAndBody, fillSubjectTokens } from '../../lib/email-markup.ts';

/**
 * The campaign registry is the ONE place a marketing campaign is declared — its copy, its
 * audience, when it fires, and whether it is still live (Founding Season 2027 Phase 1).
 *
 * Before it existed the set was declared five times: the copy defaults, the send route's key
 * allowlist, the audience map in lib/email-sender.ts, the recipient counts in
 * app/api/admin/email/route.ts and the dashboard's own board. All five had drifted — three
 * campaigns pitched parked products, the Confirm Send dialog quoted subject lines two rewrites
 * old, and two campaigns sat "past due" asking to be sent. Nothing could catch it because
 * nothing compared the lists.
 *
 * These tests are what compares them now.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

/**
 * The newest migration that reseeds campaign copy — it carries a `CAMPAIGN RESEED` marker in its
 * header. A later reseed takes over as the gate simply by carrying the marker too, so this never
 * needs editing when the copy changes; it needs a NEW migration, which is the point.
 */
function latestCampaignReseed(): { file: string; sql: string } {
  const candidates = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();
  for (const file of candidates) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    if (sql.includes('CAMPAIGN RESEED')) return { file, sql };
  }
  throw new Error('no migration carries the CAMPAIGN RESEED marker');
}

/**
 * Split reseed SQL into statements on semicolons that are OUTSIDE a dollar-quoted value.
 *
 * A naive `sql.split(';')` truncates a statement at the first semicolon in an email body — and the
 * campaign bodies are prose, so several contain one. That mistake was made twice while writing
 * these tests, each time producing a confident failure against perfectly correct SQL, so the
 * tokenizer lives here once rather than being re-improvised.
 */
function splitStatements(sql: string): string[] {
  const tag = sql.match(/\$seed\d+\$/)?.[0];
  const out: string[] = [];
  let buf = '';
  let i = 0;
  let inQuote = false;
  while (i < sql.length) {
    if (tag && sql.startsWith(tag, i)) {
      inQuote = !inQuote;
      buf += tag;
      i += tag.length;
      continue;
    }
    const ch = sql[i];
    if (ch === ';' && !inQuote) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
    i += 1;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** Every {{token}} a campaign actually uses, from its subject, heading, body and ::if guards. */
function tokensUsed(key: string): Set<string> {
  const c = MARKETING_EMAIL_DEFAULTS[key];
  const text = `${c.subject}\n${c.heading}\n${c.body}`;
  const used = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) used.add(m[1]);
  // `::if hasCard` reads a variable without brace syntax — it is still a variable the send path
  // must supply, and a missing one silently takes the ::else branch.
  for (const m of text.matchAll(/^::if\s+([A-Za-z0-9_]+)\s*$/gm)) used.add(m[1]);
  return used;
}

describe('marketing campaign registry — the set itself', () => {
  it('every live campaign is non-retired, and every retired one keeps its row but leaves the board', () => {
    const retired = ALL_MARKETING_EMAIL_KEYS.filter(k => MARKETING_EMAIL_DEFAULTS[k].retired);
    assert.ok(retired.length > 0, 'expected at least one retired campaign to be modelled');
    for (const key of retired) {
      assert.ok(!LIVE_MARKETING_EMAIL_KEYS.includes(key), `${key} is retired but still live`);
      assert.ok(!(key in MARKETING_EMAIL_AUDIENCE), `${key} is retired but still has an audience`);
      assert.ok(MARKETING_EMAIL_DEFAULTS[key].body.length > 0, `${key} lost its copy on retirement`);
    }
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      assert.equal(c.retired, undefined, `${c.key} is live and retired at once`);
    }
    assert.equal(
      LIVE_MARKETING_EMAIL_KEYS.length + retired.length,
      ALL_MARKETING_EMAIL_KEYS.length,
      'live + retired must account for every campaign',
    );
  });

  it('every live campaign declares an audience the send route can resolve', () => {
    const known = new Set(['founding', 'not_on_club', 'coaches']);
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      assert.ok(known.has(c.audience), `${c.key} has unknown audience ${c.audience}`);
      assert.equal(MARKETING_EMAIL_AUDIENCE[c.key], c.audience);
      assert.ok(c.audienceLabel.trim().length > 0, `${c.key} has no audience label for the board`);
    }
  });

  it('a dated campaign has a real ISO date; a triggered one has words instead and no date', () => {
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      if (c.timing.kind === 'date') {
        assert.match(c.timing.plannedSendDate, /^\d{4}-\d{2}-\d{2}$/, `${c.key} planned date`);
        const d = new Date(`${c.timing.plannedSendDate}T00:00:00Z`);
        assert.ok(!Number.isNaN(d.getTime()), `${c.key} planned date is not a real day`);
        assert.equal(plannedSendDateFor(c.key), c.timing.plannedSendDate);
      } else {
        assert.ok(c.timing.when.trim().length > 0, `${c.key} trigger needs a description`);
        assert.equal(plannedSendDateFor(c.key), null, `${c.key} is triggered and must have no date`);
      }
    }
  });
});

describe('marketing campaign registry — the copy', () => {
  it('declares exactly the variables it uses — no unfilled token, no dead chip', () => {
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      const used = tokensUsed(c.key);
      const declared = new Set(c.variables);
      for (const t of used) {
        assert.ok(declared.has(t), `${c.key} uses {{${t}}} but does not declare it — it would send blank`);
      }
      for (const t of declared) {
        assert.ok(used.has(t), `${c.key} declares "${t}" but never uses it`);
      }
    }
  });

  it('renders with nothing left over — no stray directive, no unfilled brace', () => {
    const vars: Record<string, string | number> = {
      firstName: 'Dana', orgName: 'Milton Softball Association',
      setupUrl: '#', billingUrl: '#', planCompareUrl: '#',
      coachShareUrl: '#', interestUrl: '#', shareUrl: '#',
      weeksPhrase: '9 weeks', hasActivity: '1', tournamentsPhrase: '2 tournaments',
      gamesPhrase: '47 games', gameCount: 47, hasHistory: '1', hasActive: '1',
      activePhrase: '1 active tournament', hasPast: '1', pastPhrase: '3 past tournaments',
      hasCard: '',
    };
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      for (const hasCard of ['', '1']) {
        const html = renderHeadingAndBody({ heading: c.heading, body: c.body, vars: { ...vars, hasCard } });
        assert.ok(!html.includes('{{'), `${c.key} left an unfilled token (hasCard="${hasCard}")`);
        assert.ok(!/(^|\n)\s*::/.test(html), `${c.key} left a raw ::directive (hasCard="${hasCard}")`);
        assert.ok(html.length > 200, `${c.key} rendered suspiciously short`);
      }
      assert.ok(!fillSubjectTokens(c.subject, vars).includes('{{'), `${c.key} subject left a token`);
    }
  });

  it('reads its dates from config — every live campaign names the free-season end, none names the old cliff', () => {
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      const text = `${c.subject}\n${c.heading}\n${c.body}\n${c.description}`;
      assert.ok(
        text.includes(FOUNDING_SEASON_END_LABEL),
        `${c.key} never names the free-season end (${FOUNDING_SEASON_END_LABEL}) — it is probably hand-typed or missing`,
      );
      // The superseded world. "December 31, 2026" is NOT here: it is the live signup deadline and
      // several campaigns legitimately name it.
      for (const stale of ['January 1, 2027', 'Jan 1, 2027', 'Dec 31', 'through December 31', 'until January']) {
        assert.ok(!text.includes(stale), `${c.key} still says "${stale}" — the January cliff is gone`);
      }
    }
  });

  it('keeps the brand-voice bans out of live customer copy', () => {
    const banned = ['unlock', 'supercharge', 'level up', 'game-changing', 'seamless', 'robust',
                    'feature-rich', 'best-in-class', 'cutting-edge', 'free trial'];
    for (const c of LIVE_MARKETING_CAMPAIGNS) {
      const text = `${c.subject} ${c.heading} ${c.body}`.toLowerCase();
      for (const word of banned) {
        assert.ok(!text.includes(word), `${c.key} uses banned word "${word}"`);
      }
    }
  });

  it('sends the summer sequence in order, all of it before the free season ends', () => {
    const end = new Date(FOUNDING_SEASON_END).getTime();
    const cardWindow = new Date(FOUNDING_SEASON_CARD_WINDOW_OPEN).getTime();
    const at = (key: string) => new Date(`${plannedSendDateFor(key)}T12:00:00Z`).getTime();

    const renewal = at('founding_renewal');
    const nudge = at('founding_nudge');
    const final = at('founding_final');
    assert.ok(renewal < nudge, 'the plan-choice note must precede the reminder');
    assert.ok(nudge < final, 'the reminder must precede the final notice');
    assert.ok(final < end, 'the final notice must arrive before the free season ends');
    // The first of the three is the one that opens the card ask, so it must not land before the
    // billing page starts asking — a note saying "add a card" that links to a page saying
    // "nothing is needed" is the drift this ordering prevents.
    assert.ok(renewal >= cardWindow, 'the plan-choice note must not precede the card window opening');
  });
});

describe('marketing campaign registry — the database seed', () => {
  it('the newest reseed migration carries every campaign, verbatim', () => {
    const { file, sql } = latestCampaignReseed();
    for (const key of ALL_MARKETING_EMAIL_KEYS) {
      const c = MARKETING_EMAIL_DEFAULTS[key];
      const why = (field: string) =>
        `${file} does not carry ${key}'s ${field}. The live send copy is the database row, so a ` +
        `change here that never reaches a migration means the app and the sends disagree. ` +
        `Regenerate the seed into a NEW migration carrying the CAMPAIGN RESEED marker.`;
      assert.ok(sql.includes(c.subject), why('subject'));
      assert.ok(sql.includes(c.heading), why('heading'));
      assert.ok(sql.includes(c.body), why('body'));
      assert.ok(sql.includes(c.label), why('label'));
      assert.ok(sql.includes(c.description), why('description'));
      assert.ok(sql.includes(JSON.stringify(c.variables)), why('variables'));
      assert.ok(sql.includes(`where key = `) || sql.includes(`values (`), why('write'));
    }
  });

  it('carries it verbatim in EVERY statement that writes it, not just one of them', () => {
    // A brand-new campaign appears TWICE — once in its INSERT (its columns are NOT NULL, so the
    // real copy has to be there) and once in the ordinary content UPDATE. A whole-file substring
    // check cannot tell those apart, so a typo in one copy would hide behind the other
    // (/review 2026-09-07). Check each writing statement on its own.
    const { file, sql } = latestCampaignReseed();
    const tag = sql.match(/\$seed\d+\$/)?.[0];
    assert.ok(tag, `${file} has no dollar-quote tag`);
    const statements = splitStatements(sql).filter(s => /\bbody\b/i.test(s));
    assert.ok(statements.length > 0, `${file} has no statements that write a body`);

    for (const key of ALL_MARKETING_EMAIL_KEYS) {
      const c = MARKETING_EMAIL_DEFAULTS[key];
      // Match the QUOTED key, not loose text: the header comment names several campaigns in
      // prose, and matching that swept the file header in as a statement "writing" them.
      const writing = statements.filter(s => s.includes(`${tag}${key}${tag}`));
      assert.ok(writing.length > 0, `${file} never writes ${key}'s body`);
      for (const stmt of writing) {
        assert.ok(
          stmt.includes(c.body),
          `${file}: a statement writing ${key} carries a body that is not the registry's. ` +
          'Regenerate with scripts/generate-campaign-reseed-migration.mjs rather than editing SQL by hand.',
        );
      }
    }
  });

  it('the seed is data-only and never deletes a campaign row', () => {
    const { file, sql } = latestCampaignReseed();
    const lowered = sql.toLowerCase();
    for (const forbidden of ['drop table', 'alter table', 'delete from platform_email_templates']) {
      assert.ok(!lowered.includes(forbidden), `${file} does ${forbidden} — a retired campaign keeps its row`);
    }
    // Every content write respects a saved operator override.
    //
    // Parse the SQL with the dollar-quoted VALUES removed first. Campaign bodies contain
    // semicolons and the word "update"; reading the raw file would mistake prose for statements
    // (the first version of this test did exactly that and failed on three real, correct rows).
    const skeleton = sql.replace(/\$seed\d+\$[\s\S]*?\$seed\d+\$/g, "'…'");
    const updates = skeleton.split(/update platform_email_templates/i).slice(1);
    assert.ok(updates.length > 0, 'expected content updates in the reseed');
    for (const block of updates) {
      const stmt = block.split(';')[0];
      // Every write needs a WHERE at all — an unguarded UPDATE would rewrite every template row
      // in the table, marketing and transactional alike.
      assert.ok(/\bwhere\b/i.test(stmt), `an update with no WHERE clause: ${stmt.slice(0, 120)}`);
      if (/planned_send_date\s*=/i.test(stmt)) {
        // A date move has no is_customised flag of its own to read, so it must prove BOTH that the
        // row is untouched by a human and that it still holds a value one of our seeds wrote.
        // Checking only that the words appear is not enough — that was the first version of this
        // assertion, and it would have passed an unconditional date write (/review 2026-09-07).
        assert.match(stmt, /updated_by\s+like/i, `a date move must check updated_by: ${stmt.slice(0, 160)}`);
        assert.match(stmt, /planned_send_date\s+is\s+null\s+or\s+planned_send_date\s+in/i,
          `a date move must check the prior seeded value: ${stmt.slice(0, 160)}`);
      }
      assert.match(stmt, /is_customised\s*=\s*false/i,
        `every write must be gated on is_customised = false so an operator override wins: ${stmt.slice(0, 120)}`);
    }
    // The new campaign is inserted, not upserted over an operator's row.
    if (/insert into platform_email_templates/i.test(skeleton)) {
      assert.match(skeleton, /on conflict \(key\) do nothing/i,
        'an inserted campaign must not clobber an existing row');
    }
  });
});
