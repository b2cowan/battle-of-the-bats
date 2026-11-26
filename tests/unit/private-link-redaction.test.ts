/**
 * PRIVATE LINKS NEVER REACH AN ERROR REPORT (Board Ready Stage 6 fixes, Part B-1; ruled 2026-11-25). The redactor itself,
 * the one choke point that uses it, and the build gate: a new no-sign-in page or a new link with a secret after `?` fails
 * here until the redactor covers it.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PRIVATE_QUERY_NAMES, redactPrivateLinks } from '../../lib/observability/redact-links.ts';
import { redactContext, scrubText } from '../../lib/observability/redact.ts';

const read = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const SIGNED = 'cc-MYb5dSe-B_isyMy_dRw.JVStMLSOvP67zXnihcivLA'; // the signed shape (a deal, a team's pay page, a sign-up)
const RANDOM = 'TG39XG_uLf8gEYY3we_I_WG6SovskZ1uFVYdw1Xtaxo';    // 43 random characters (an invitation, a scorer)
const FEED = 'cc-MYb5dSe-B_isyMy_dRw.k3j9.JVStMLSOvP67zXnihcivLA';

describe('a private page address is stored as its template', () => {
  const cases: [string, string][] = [
    // The platform's address, then the club's own (the club's name dropped).
    [`/lakeshore/sponsorship/${SIGNED}`, '/lakeshore/sponsorship/[token]'],
    [`/sponsorship/${SIGNED}.2`, '/sponsorship/[token]'],
    [`/lakeshore/spring-classic/pay/${SIGNED}`, '/lakeshore/spring-classic/pay/[token]'],
    [`/spring-classic/pay/${SIGNED}`, '/spring-classic/pay/[token]'],
    [`/lakeshore/league/2026-fall/status/${SIGNED}`, '/lakeshore/league/2026-fall/status/[token]'],
    [`/league/2026-fall/status/${SIGNED}`, '/league/2026-fall/status/[token]'],
    [`/family/claim/${RANDOM}`, '/family/claim/[token]'],
    [`/tryout-score/${RANDOM}`, '/tryout-score/[token]'],
    ['/pitch/Wm9vZm9vYmFyYmF6cXV4MTIz', '/pitch/[slug]'],
    // Their data routes, and the calendar feeds.
    [`/api/public/sponsorship/${SIGNED}/invoice`, '/api/public/sponsorship/[token]/invoice'],
    [`/api/pay/team/${SIGNED}/status?session=cs_1`, '/api/pay/team/[token]/status?session=cs_1'],
    [`/api/pay/league/${SIGNED}`, '/api/pay/league/[token]'],
    [`/api/family/claim/${RANDOM}/resend`, '/api/family/claim/[token]/resend'],
    [`/api/tryout-score/${RANDOM}`, '/api/tryout-score/[token]'],
    [`/api/calendar/coach/${FEED}.ics`, '/api/calendar/coach/[token].ics'],
    [`/api/calendar/league-coach/${FEED}.ics`, '/api/calendar/league-coach/[token].ics'],
    [`/api/family/calendar/${RANDOM}`, '/api/family/calendar/[token]'],
    // Inside a longer sentence, and a whole address.
    [`Failed to fetch https://www.fieldlogichq.ca/lakeshore/sponsorship/${SIGNED}?left=1.`,
      'Failed to fetch https://www.fieldlogichq.ca/lakeshore/sponsorship/[token]?left=1.'],
    [`    at load (https://www.lakeshore.ca/sponsorship/${SIGNED}:12:3)`, '    at load (https://www.lakeshore.ca/sponsorship/[token]:12:3)'],
  ];
  for (const [raw, safe] of cases) it(safe, () => assert.equal(redactPrivateLinks(raw), safe));

  it('a secret after ? or #, and the address a link nests', () => {
    const q: [string, string][] = [
      [`/auth/accept-assistant-invite?token=${RANDOM}`, '/auth/accept-assistant-invite?token=[redacted]'],
      [`/auth/accept-league-coach?token=${RANDOM}&left=1`, '/auth/accept-league-coach?token=[redacted]&left=1'],
      [`/auth/two-step/confirm-reset?token=${RANDOM}`, '/auth/two-step/confirm-reset?token=[redacted]'],
      [`/start/claim/lakeshore?pass=abc123.${'a'.repeat(24)}`, '/start/claim/lakeshore?pass=[redacted]'],
      ['/auth/reset-confirm?link=https%3A%2F%2Fx.supabase.co%2Fauth%2Fv1%2Fverify%3Ftoken%3Dabc', '/auth/reset-confirm?link=[redacted]'],
      ['/auth/reset-password?code=9f2c', '/auth/reset-password?code=[redacted]'],
      ['/auth/callback#access_token=eyJ.x.y&refresh_token=zz', '/auth/callback#access_token=[redacted]&refresh_token=[redacted]'],
      [`/unsubscribe?org=u1&guardian=pat%40example.com&token=${'f'.repeat(32)}`, '/unsubscribe?org=u1&guardian=[redacted]&token=[redacted]'],
      [`/auth/login?next=%2Ffamily%2Fclaim%2F${RANDOM}`, '/auth/login?next=%2Ffamily%2Fclaim%2F[token]'],
      [`/auth/signup?next=%252Flakeshore%252Fsponsorship%252F${SIGNED}`, '/auth/signup?next=%252Flakeshore%252Fsponsorship%252F[token]'],
      [`/auth/login?next=%2Fauth%2Faccept-league-coach%3Ftoken%3D${RANDOM}%26a%3D1`, '/auth/login?next=%2Fauth%2Faccept-league-coach%3Ftoken%3D[redacted]%26a%3D1'],
    ];
    for (const [raw, safe] of q) assert.equal(redactPrivateLinks(raw), safe);
  });

  it('running it twice changes nothing more', () => {
    for (const [raw] of cases) assert.equal(redactPrivateLinks(redactPrivateLinks(raw)), redactPrivateLinks(raw));
  });

  it('a feed token whose middle part spells a file extension, and an address with an apostrophe (/review 2026-11-26)', () => {
    assert.equal(redactPrivateLinks('/api/calendar/coach/Kx1qLgAAQACAAAAAAAAAAA.js.T3lxgUnQ0V901PiWTQd9Qa.ics'), '/api/calendar/coach/[token].ics');
    assert.equal(redactPrivateLinks("?org=u1&guardian=o'brien%40example.com&token=abc"), '?org=u1&guardian=[redacted]&token=[redacted]');
  });

  it('a word that only ends like a shape is left alone', () => {
    for (const s of ["Cannot find module './repay/calculateRepaymentSchedule'", '/autopay/subscription_schedules', 'node_modules/some-pitch/dist-bundle-esm-output/x']) {
      assert.equal(redactPrivateLinks(s), s);
    }
  });

  it('leaves ordinary addresses and source files alone', () => {
    for (const s of [
      '/lakeshore/admin/sponsorships/2b1d6a2e-0000-4000-8000-000000000000',
      '/api/pay/tournament/2b1d6a2e-0000-4000-8000-000000000000',
      '/api/pay/team/[token]/status', '/[orgSlug]/sponsorship/[token]',
      'at x (webpack://app/components/pitch/PitchDeckStudioViewer.tsx:1:2)',
      '/lakeshore/league/2026-fall/status', '/pitch/overview', '/auth/login?next=%2Fmy',
    ]) assert.equal(redactPrivateLinks(s), s);
  });
});

describe('every stored and logged value goes through it', () => {
  it('a context blob, whatever its key', () => {
    const out = redactContext({ path: `/sponsorship/${SIGNED}`, route: `/family/claim/${RANDOM}`, componentStack: `at /tryout-score/${RANDOM}` });
    assert.doesNotMatch(JSON.stringify(out), /cc-MYb5dSe|TG39XG/);
  });

  it('free text loses emails and links together', () => {
    assert.equal(scrubText(`pat@example.com opened /family/claim/${RANDOM}`), '[redacted-email] opened /family/claim/[token]');
  });

  it('captureError reads only redacted values', () => {
    const src = read('lib/observability/capture.ts');
    assert.match(src, /const route = rawRoute === undefined \? undefined : scrubText\(rawRoute\);/);
    assert.match(src, /const name = scrubText\(raw\.name\);/);
    assert.match(src, /const stack = raw\.stack === undefined \? undefined : redactPrivateLinks\(raw\.stack\);/);
    assert.match(src, /const title = opts\.title \? scrubText\(opts\.title\) :/);
    // The raw options are read once, to be redacted: nothing downstream goes back to them.
    assert.equal((src.match(/opts\.route\b/g) ?? []).length, 1);
    assert.equal((src.match(/opts\.title\b/g) ?? []).length, 2);
  });

  it('the feedback window saves redacted text', () => {
    const src = read('app/api/feedback/route.ts');
    assert.match(src, /const safeTitle = title \? scrubText\(title\) : null;/);
    assert.match(src, /const safeBody = scrubText\(body\);/);
    assert.match(src, /const safeContext = redactContext\(/);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

describe('the build gate: a new private link must be covered', () => {
  /** Segments whose name sounds secret and isn't: say why. */
  const NOT_SECRET = new Set([
    '[key]',         // an email template's name, and a fiscal year: both behind a sign-in
    '[opponentKey]', // an opponent's name key, behind a sign-in
  ]);
  const SAMPLE: Record<string, string> = { '[orgSlug]': 'lakeshore', '[tournamentSlug]': 'spring-classic', '[seasonSlug]': '2026-fall' };
  const SECRET_NAME = /^\[[^\]]*(token|secret|pass|code|key)[^\]]*\]$/i;

  it('every page and route with a secret-named segment, with and without the club’s name', () => {
    const files = walk('app').filter(f => /\/(page\.tsx|route\.ts)$/.test(f));
    let checked = 0;
    for (const file of files) {
      const parts = file.split('/').slice(1, -1).filter(p => !p.startsWith('(')); // route groups aren't in an address
      const secrets = parts.filter(p => SECRET_NAME.test(p) && !NOT_SECRET.has(p));
      if (!secrets.length) continue;
      checked += 1;
      const url = (segments: string[]) => '/' + segments.map(p => (secrets.includes(p) ? SIGNED : SAMPLE[p] ?? (p.startsWith('[') ? 'abc123' : p))).join('/');
      const forms = [url(parts)];
      if (parts[0] === '[orgSlug]') forms.push(url(parts.slice(1))); // a club's own web address
      for (const form of forms) assert.ok(!redactPrivateLinks(form).includes(SIGNED), `${file}: ${form} keeps its secret. Add its shape to lib/observability/redact-links.ts.`);
    }
    assert.ok(checked >= 20, `the walk found only ${checked} private routes`);
  });

  it('the one private page whose segment is named like a public one', () => {
    assert.ok(statSync('app/pitch/[slug]/page.tsx').isFile());
    assert.equal(redactPrivateLinks('/pitch/Wm9vZm9vYmFyYmF6cXV4MTIz'), '/pitch/[slug]');
  });

  it('every secret a link puts after ? is a name the redactor knows', () => {
    const files = ['app', 'lib', 'components'].flatMap(d => walk(d)).filter(f => /\.tsx?$/.test(f));
    const known = new Set<string>(PRIVATE_QUERY_NAMES);
    for (const file of files) {
      for (const m of read(file).matchAll(/[?&]([A-Za-z_]*(?:token|pass|secret|key|link|code)[A-Za-z_]*)=/gi)) {
        assert.ok(known.has(m[1].toLowerCase()), `${file}: "?${m[1]}=" is not in PRIVATE_QUERY_NAMES (lib/observability/redact-links.ts).`);
      }
    }
  });
});
