import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MARKETING_EMAIL_DEFAULTS,
  ALL_MARKETING_EMAIL_KEYS,
  LIVE_MARKETING_CAMPAIGNS,
  LIVE_MARKETING_EMAIL_KEYS,
  MARKETING_EMAIL_AUDIENCE,
  plannedSendDateFor,
} from '../../lib/marketing-email-defaults.ts';
import { renderHeadingAndBody, fillSubjectTokens } from '../../lib/email-markup.ts';

/**
 * The campaign registry is the ONE place a marketing campaign is declared: its copy, its audience, when it fires, and
 * whether it is still live.
 *
 * EVERY CAMPAIGN IS RETIRED (the Founding Season was removed, 2026-11-20), so the live set is empty and nothing can be
 * sent from the console. The copy is kept as history (Email templates reads it, and "Reset to default" restores it).
 * What still guards something real: the retired set stays accounted for, a retired campaign is refused by the one send
 * path that remains (the template test-send; the campaign send, schedule and preview routes were removed), and the
 * structural rules below still bind a campaign the day one is revived.
 *
 * The reseed generator (scripts/generate-campaign-reseed-migration.mjs) and the "newest reseed migration carries every
 * campaign verbatim" half of this file are gone with the live set: the generator wrote one migration's Founding story
 * and rewrote only live copy, and nothing live remains to reseed.
 */

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

  it('nothing is live: reviving a campaign is a decision, made by editing this test', () => {
    assert.deepEqual([...LIVE_MARKETING_EMAIL_KEYS], [], 'a campaign went live again: re-read the rules below, and the bar for sending one');
    assert.deepEqual(MARKETING_EMAIL_AUDIENCE, {});
    assert.ok(ALL_MARKETING_EMAIL_KEYS.every(k => MARKETING_EMAIL_DEFAULTS[k].retired), 'every kept campaign says when and why it was retired');
  });

  it('a retired campaign cannot be sent, by any path that remains', () => {
    const route = readFileSync(path.join(process.cwd(), 'app/api/platform-admin/email-templates/[key]/test-send/route.ts'), 'utf8');
    assert.match(route, /getMarketingEmailDefault\(key\)\?\.retired/);
    assert.match(route, /status: 409/);
    for (const gone of ['app/api/admin/email/send/route.ts', 'app/api/admin/email/schedule/route.ts', 'app/api/admin/email/preview/route.ts']) {
      assert.equal(existsSync(path.join(process.cwd(), gone)), false, `${gone} is gone: no campaign send, schedule or preview path remains`);
    }
  });

  it('every live campaign (none today) declares an audience the send route can resolve', () => {
    const known = new Set(['not_on_club', 'coaches']);
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

});
