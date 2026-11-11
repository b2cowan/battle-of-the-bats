import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { readTeamPayToken, signTeamPayToken, teamPayUrl } from '../../lib/team-pay-link.ts';
import { readLeaguePayToken, signLeaguePayToken } from '../../lib/league-pay-link.ts';

/**
 * A tournament team's pay link can be replaced (Board Ready W2 fix D, item 2; mig 467). The house-league family link has had a
 * version since mig 419; this is the same scheme with its own message. The promise that matters most to a club: EVERY LINK
 * ALREADY EMAILED KEEPS WORKING until the club sends a new one.
 */
const SECRET = 'x'.repeat(40);
const TEAM = '44e793cd-617d-40bd-bad3-406a6304a1bc';
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('a team pay link has a version, and old links keep working', () => {
  it('version 0 is byte-for-byte the link that was emailed before the version existed', () => {
    // Rebuilt here from the ORIGINAL scheme (message "team-pay:{id}", no third segment) — not from the module under test.
    const id = Buffer.from(TEAM.replace(/-/g, ''), 'hex').toString('base64url');
    const sig = createHmac('sha256', SECRET).update(`team-pay:${TEAM}`).digest().subarray(0, 16).toString('base64url');
    const emailedBefore = `${id}.${sig}`;
    assert.equal(signTeamPayToken(TEAM, SECRET), emailedBefore);
    assert.equal(signTeamPayToken(TEAM, SECRET, 0), emailedBefore);
    assert.deepEqual(readTeamPayToken(emailedBefore, SECRET), { teamId: TEAM, version: 0 });
  });

  it('a bumped link carries its version and reads back as that version', () => {
    const v1 = signTeamPayToken(TEAM, SECRET, 1);
    assert.ok(v1.endsWith('.1'));
    assert.notEqual(v1, signTeamPayToken(TEAM, SECRET));
    assert.deepEqual(readTeamPayToken(v1, SECRET), { teamId: TEAM, version: 1 });
    assert.deepEqual(readTeamPayToken(signTeamPayToken(TEAM, SECRET, 27), SECRET), { teamId: TEAM, version: 27 });
  });

  it('a token cannot be edited to another version', () => {
    const v0 = signTeamPayToken(TEAM, SECRET);
    const v1 = signTeamPayToken(TEAM, SECRET, 1);
    assert.equal(readTeamPayToken(`${v0}.1`, SECRET), null, 'appending a version to the original link');
    assert.equal(readTeamPayToken(`${v1.slice(0, -2)}.2`, SECRET), null, 'raising a version');
    assert.equal(readTeamPayToken(v1.slice(0, -2), SECRET), null, 'dropping the version off a bumped link');
    assert.equal(readTeamPayToken(`${v0}.0`, SECRET), null, 'an explicit ".0" is not a form the product mints');
    assert.equal(readTeamPayToken(`${v0}.01`, SECRET), null);
  });

  it('refuses a version it would never mint', () => {
    assert.throws(() => signTeamPayToken(TEAM, SECRET, -1));
    assert.throws(() => signTeamPayToken(TEAM, SECRET, 1.5));
    assert.throws(() => signTeamPayToken(TEAM, SECRET, 1_000_000));
  });

  it('a team link and a family link can never be read as each other, at any version', () => {
    for (const v of [0, 1, 5]) {
      assert.equal(readTeamPayToken(signLeaguePayToken(TEAM, SECRET, v), SECRET), null);
      assert.equal(readLeaguePayToken(signTeamPayToken(TEAM, SECRET, v), SECRET), null);
    }
  });

  it('the whole link is minted at the version it is given (and a caller must give one)', () => {
    process.env.PAY_LINK_SECRET = SECRET;
    const at = { orgSlug: 'dev-club', tournamentSlug: 'spring-cup', teamId: TEAM };
    const v0 = teamPayUrl('https://www.fieldlogichq.ca/', { ...at, version: 0 })!;
    const v2 = teamPayUrl('https://www.fieldlogichq.ca', { ...at, version: 2 })!;
    assert.ok(v0.startsWith('https://www.fieldlogichq.ca/dev-club/spring-cup/pay/'));
    assert.deepEqual(readTeamPayToken(v0.split('/pay/')[1], SECRET), { teamId: TEAM, version: 0 });
    assert.deepEqual(readTeamPayToken(v2.split('/pay/')[1], SECRET), { teamId: TEAM, version: 2 });
  });
});

describe('the doors: one reader, every minter asks for the version', () => {
  /** Every source file under app/, lib/ and components/ (not tests): a new caller anywhere is seen, not just the ones listed. */
  function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (rel: string): void => {
      for (const entry of readdirSync(new URL(`../../${rel}/`, import.meta.url), { withFileTypes: true })) {
        const path = `${rel}/${entry.name}`;
        if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== '.next') walk(path); }
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
      }
    };
    for (const dir of ['app', 'lib', 'components']) walk(dir);
    return out;
  }
  /** Source with comments removed, so prose never counts as a call. */
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

  it('EVERY caller of teamPayUrl in the app passes the team’s link_version', () => {
    let seen = 0;
    for (const file of sourceFiles()) {
      if (file === 'lib/team-pay-link.ts') continue;
      for (const call of code(read(file)).match(/teamPayUrl\(.*\)/g) ?? []) {
        seen += 1;
        assert.match(call, /version: facts\.linkVersion/, `${file}: ${call}`);
      }
    }
    assert.ok(seen >= 5, `expected the five known minting sites, found ${seen}`);
  });

  it('only the one door decodes a token: no other file in the app reads one', () => {
    const readers = sourceFiles().filter(f => /\breadTeamPayToken\(/.test(code(read(f))) && f !== 'lib/team-pay-link.ts');
    // The door, and the paid-return address: both check the version against the team's row themselves.
    assert.deepEqual(readers, ['lib/team-pay-view.ts']);
    const view = read('lib/team-pay-view.ts');
    assert.match(view, /export async function teamFromPayToken/);
    assert.match(view, /read\.version === Number\(data\.link_version \?\? 0\)/);
    for (const file of ['app/api/pay/team/[token]/route.ts', 'app/api/pay/team/[token]/status/route.ts']) {
      assert.match(read(file), /await teamFromPayToken\(token/, file);
    }
    assert.match(view, /await teamFromPayToken\(token\);/, 'the page view');
  });

  it('coming back from Stripe on a replaced link carries on at the current address, only for a payment that is the team’s own', () => {
    const view = read('lib/team-pay-view.ts');
    const at = view.indexOf('export async function currentAddressForPaidReturn');
    const body = view.slice(at, view.indexOf('async function receiptsFor'));
    assert.ok(at > 0);
    // Not replaced → null (the page opens it as it always did); no session → null; a session of another team → null.
    assert.match(body, /if \(read\.version === current\) return null;/);
    assert.match(body, /readTeamPayToken\(token, secret\) : null/);
    assert.match(body, /\.eq\('stripe_checkout_session_id', paidSession\)\.eq\('team_id', read\.teamId\)/);
    assert.match(body, /f\.org\.slug !== at\.orgSlug \|\| f\.tournament\.slug !== at\.tournamentSlug\) return null/);
    assert.match(body, /signTeamPayToken\(read\.teamId, secret, current\)/);
    // The page asks it BEFORE building the view, and sends the payer on with the same session.
    const page = read('app/[orgSlug]/[tournamentSlug]/pay/[token]/page.tsx');
    assert.ok(page.indexOf('currentAddressForPaidReturn(token, paid,') > 0);
    assert.ok(page.indexOf('currentAddressForPaidReturn(token, paid,') < page.indexOf('buildTeamPayView(token'));
    assert.match(page, /redirect\(`\$\{current\}\?paid=\$\{encodeURIComponent\(paid!\)\}`\)/);
  });

  it('the poll after Checkout skips the version rule (a team that paid must still see it confirmed); the page and the pay route do not', () => {
    assert.match(read('app/api/pay/team/[token]/status/route.ts'), /teamFromPayToken\(token, \{ afterCheckout: true \}\)/);
    assert.ok(!read('app/api/pay/team/[token]/route.ts').includes('afterCheckout'));
    assert.match(read('lib/team-pay-view.ts'), /await teamFromPayToken\(token\);/);
  });

  it('the facts carry the version from the team row', () => {
    const facts = read('lib/team-pay-facts.ts');
    assert.match(facts, /entry_lowered, link_version'/);
    assert.match(facts, /linkVersion: Number\(team\.link_version \?\? 0\)/);
  });
});

describe('"Send a new link", the server half (the club’s button is a /design session)', () => {
  const src = read('lib/online-payment-receipt.ts');
  const start = src.indexOf('export async function replaceTeamPayLink');
  const body = src.slice(start, src.indexOf('export async function sendLeaguePayLink'));

  it('bumps the version with a conditional update, so two presses cannot claim the same number', () => {
    assert.ok(start > 0);
    assert.match(body, /link_version: current \+ 1, link_replaced_at:/);
    assert.match(body, /\.eq\('link_version', current\)/);
  });

  it('stops the old links whatever the send does, and sends the new one with the existing "Email the pay link" words', () => {
    assert.match(body, /await sendTeamPayLink\(teamId/);
    assert.match(body, /stopped: true, notSent/);
    // The send is attempted AFTER the bump, so the new email carries the new version (the facts are re-read inside the send).
    assert.ok(body.indexOf('link_version: current + 1') < body.indexOf('sendTeamPayLink('));
  });

  it('is reachable by an admin only through the route that already checks the club, the event and the refund power', () => {
    const route = read('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
    const at = route.indexOf("body.action === 'replace_pay_link'");
    assert.ok(at > route.indexOf('canRefundOnline('), 'after the power check');
    assert.ok(at > route.indexOf('requireTournamentInOrg(ctx, tournamentId)'), 'after the event-in-club check');
    assert.match(route.slice(at, at + 700), /team\?\.tournament_id !== tournamentId/);
  });

  it('migration 467 adds the version with a default of 0 and a non-negative check', () => {
    const sql = read('supabase/migrations/467_a_teams_pay_link_can_be_replaced.sql');
    assert.match(sql, /link_version integer NOT NULL DEFAULT 0/);
    assert.match(sql, /link_replaced_at timestamptz NULL/);
    assert.match(sql, /CHECK \(link_version >= 0\)/);
  });
});
