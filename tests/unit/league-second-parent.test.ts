import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSecondParentEmail, SECOND_PARENT_WORDS as SP } from '../../lib/league-second-parent.ts';
import { readCode, readSource, functionBody, filesUnder } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 3, Parts 1–3 (build prompt SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md; asks 1–6 ruled A
 * 2026-11-03): a second parent's email on the house-league sign-up. BEHAVIOUR for the pure reader and the words; SOURCE
 * GUARDS (comments stripped) for the route, the placement and the email builder, which import server-only modules.
 */

describe('reading the second address (behaviour)', () => {
  it('empty is none and changes nothing', () => {
    for (const raw of [null, undefined, '', '   ']) assert.deepEqual(readSecondParentEmail(raw, 'priya@example.com'), { email: null });
  });
  it('a malformed address is refused in the first email’s words', () => {
    assert.deepEqual(readSecondParentEmail('dev.shah@', 'priya@example.com'), { refusal: 'invalid' });
    assert.equal(SP.invalid, 'Enter a valid email address.');
  });
  it('the first parent’s own address is refused, capitals and spaces ignored', () => {
    assert.deepEqual(readSecondParentEmail('  Priya@Example.COM ', 'priya@example.com'), { refusal: 'same' });
    assert.deepEqual(readSecondParentEmail('priya@example.com', ' PRIYA@example.com'), { refusal: 'same' });
  });
  it('a good address is normalised exactly as guardian_email is', () => {
    assert.deepEqual(readSecondParentEmail('  Dev.Shah@Example.com ', 'priya@example.com'), { email: 'dev.shah@example.com' });
  });
});

describe('the second parent’s words (behaviour)', () => {
  it('the drawn words, curly apostrophes, no "(optional)" tag', () => {
    assert.equal(SP.label, 'Second parent’s email');
    assert.ok(!/optional/i.test(SP.label));
    assert.equal(SP.sameAsYours, 'That’s the same email as yours. Leave this empty or enter the other parent’s.');
    assert.equal(SP.greeting, 'Hi,');
    assert.match(SP.coachLine, /and the second parent’s email if you add one\.$/);
  });
  it('the "who added you" line: one child, several, and a club with no contact address', () => {
    assert.equal(
      SP.addedYou('Priya Shah', ['Aarav'], { name: 'Riverdale Minor Ball', contact: 'info@riverdale.example' }),
      'Priya Shah added your email to Aarav’s sign-up so you get the same updates. If you aren’t Aarav’s parent or guardian, or you’d rather not get these, tell the club at info@riverdale.example and they’ll take your address off.',
    );
    assert.equal(
      SP.addedYou('Priya Shah', ['Aarav', 'Maya'], { name: 'Riverdale Minor Ball', contact: null }),
      'Priya Shah added your email to Aarav and Maya’s sign-up so you get the same updates. If you aren’t their parent or guardian, or you’d rather not get these, tell Riverdale Minor Ball and they’ll take your address off.',
    );
  });
});

const ROUTE = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');

describe('the sign-up route (source guard)', () => {
  it('reads the second address through the one reader and refuses with its words', () => {
    assert.match(ROUTE, /readSecondParentEmail\(str\(body\.guardianEmail2, 200\), guardianEmail\)/);
    assert.match(ROUTE, /errors\.guardianEmail2 = secondParentRefusalWords\(second\.refusal, 'parent'\)/);
  });
  it('throttles the second address on its own, after the first and before anything is placed', () => {
    const first = ROUTE.indexOf('throttlePublicFormRecipient(guardianEmail!)');
    const second = ROUTE.indexOf('throttlePublicFormRecipient(guardianEmail2)');
    const place = ROUTE.indexOf('placeLeagueRegistration(');
    assert.ok(first > 0 && second > first && place > second, 'first throttle, then the second, then the placement');
  });
  it('every placed child carries the second address', () => {
    assert.match(ROUTE, /guardianEmail: guardianEmail!, guardianEmail2, guardianPhone/);
  });
  it('ask 3: the marketing consent takes the FIRST address only', () => {
    const at = ROUTE.indexOf('recordLeagueMarketingConsent(');
    const call = ROUTE.slice(at, ROUTE.indexOf('});', at));
    assert.ok(at > 0);
    assert.match(call, /normalizeGuardianEmailRequired\(guardianEmail!\)/);
    assert.ok(!/guardianEmail2|second/.test(call), 'the second address never reaches a consent row');
  });
  it('ask 2: the second parent’s confirmation is the built-in email, its own message, each copy in its own try', () => {
    const at = ROUTE.indexOf('const copies = [');
    assert.ok(at > 0);
    const block = ROUTE.slice(at, ROUTE.indexOf('notify(', at));
    assert.match(block, /\{ to: guardianEmail!, secondParentLine: null \}/);
    assert.match(block, /guardianEmail2 \? \[\{\s*to: guardianEmail2,\s*secondParentLine: SP\.addedYou\(/);
    assert.match(block, /for \(const copy of copies\) \{[^]*?try \{\s*const result = await sendTransactionalEmail\(\{/);
    // The second copy follows only a first copy that went (the rule every other sender holds).
    assert.match(block, /if \(copy\.secondParentLine && !firstWent\) break;/);
    assert.match(block, /if \(!copy\.secondParentLine\) firstWent = went\(result\);/);
    assert.match(block, /to: copy\.to,/);
    assert.match(block, /builtInOnly: copy\.secondParentLine != null/);
    assert.match(block, /catch \(e\)/);
    assert.ok(!/\bcc\b/i.test(block), 'never a Cc');
  });
  it('the response names the second address for the finish screen', () => {
    assert.match(ROUTE, /guardianEmail: guardianEmail!,\s*guardianEmail2,/);
  });
});

describe('the placement and the migration (source guard)', () => {
  it('the one placement step passes the second address in the child', () => {
    const body = functionBody(readCode('lib/league-registration-place.ts'), 'placeLeagueRegistration');
    assert.match(body, /guardianEmail2: normalizeGuardianEmail\(c\.guardianEmail2\) \?\? ''/);
  });
  it('mig 430 writes it, and the duplicate rule still keys on the FIRST address only', () => {
    const sql = readSource('supabase/migrations/430_a_second_parent_gets_the_signup_emails.sql');
    assert.match(sql, /league_is_duplicate\(p_season, NULL, v_first, v_last, v_dob, v_email\)/);
    assert.ok(!/league_is_duplicate\([^)]*v_email2/.test(sql));
    assert.match(sql, /guardian_email, guardian_email_2, guardian_phone/);
    assert.match(sql, /v_email, v_email2, nullif/);
    assert.match(sql, /guardian_email_2 <> lower\(btrim\(guardian_email\)\)/);
  });
});

describe('the confirmation email (source guard)', () => {
  const EMAIL = readCode('lib/email.ts');
  const signup = EMAIL.slice(EMAIL.indexOf('export function leagueSignupHtml('), EMAIL.indexOf('export function leagueAdminApprovedHtml('));
  it('the second parent’s copy greets "Hi," and carries the escaped line; the first parent’s is unchanged', () => {
    assert.match(signup, /p\.secondParentLine\s*\?\s*`<p>\$\{escapeEmailHtml\(SECOND_PARENT_WORDS\.greeting\)\}<\/p>/);
    assert.match(signup, /<p>\$\{p\.secondParentLine\}<\/p>/);
    assert.match(signup, /: `<p>Hi <strong>\$\{p\.guardianFirstName\}<\/strong>,<\/p>`/);
    assert.match(signup, /const p = escapeEmailFields\(input\)/);
  });
  it('builtInOnly skips the customised template and nothing else', () => {
    const send = functionBody(readCode('lib/platform-email-templates.ts'), 'sendTransactionalEmail');
    assert.match(send, /opts\.builtInOnly\s*\?\s*\{ subject: opts\.defaultSubject, html: opts\.defaultHtml \}/);
  });
});

describe('the form (source guard)', () => {
  const FORM = readCode('components/league/RegisterForm.tsx');
  it('the box has a bare label, its hint and its error; the body sends it; the coach line says so', () => {
    assert.match(FORM, /htmlFor="g-email2">\{SP\.label\}<\/label>/);
    assert.match(FORM, /\{SP\.hint\}/);
    assert.match(FORM, /errors\.guardianEmail2 && <p className=\{formKit\.errorMsg\}>/);
    assert.match(FORM, /guardianEmail2: guardian\.email2 \|\| undefined/);
    assert.match(FORM, /\{SP\.coachLine\}/);
  });
  it('the finish sentence names both addresses, and reads as before with one', () => {
    assert.match(FORM, /We’ve emailed this to <strong>\{result\.guardianEmail\}<\/strong>\{result\.guardianEmail2 && <> and <strong>\{result\.guardianEmail2\}<\/strong><\/>\}\. Keep/);
  });
});

/**
 * Stage 3b, Parts 1–3 (build prompt SIGNED_IN_FAMILY_STAGE3B_BUILD_PROMPT.md; owner calls O1–O5 ruled 2026-11-06): a second
 * parent can stop the sign-up emails. The stop IS the removal (it clears the column), so these guards pin where the new table
 * is read (the three entry points and the record window, and nowhere a message is sent) and what the stop page may write.
 */
describe('a stopped address is refused where an address can enter (Stage 3b, O4, source guard)', () => {
  const PUBLIC = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
  const ADD = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts');
  const EDIT = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');

  it('the refusal sentence exists once, in the words module, and no route writes its own', () => {
    assert.equal(SP.stoppedAddress, 'That address has asked not to get these emails from this club. Enter another or leave it empty.');
    const files = ['lib', 'app', 'components'].flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')]);
    for (const file of files) {
      if (file === 'lib/league-second-parent.ts') continue;
      assert.ok(!/asked not to get these emails/.test(readSource(file)), `${file} must take the refusal from SECOND_PARENT_WORDS`);
    }
  });
  it('the public register route, Add registration and the record-window edit each look the address up AFTER reading it', () => {
    for (const [name, code] of [['register', PUBLIC], ['add', ADD], ['edit', EDIT]] as const) {
      const read = code.indexOf('readSecondParentEmail(');
      const look = code.indexOf('stoppedSecondParentRefusal(');
      assert.ok(read > 0 && look > read, `${name}: the stop lookup follows readSecondParentEmail`);
    }
    assert.match(PUBLIC, /else if \(guardianEmail2\) \{ const stopped = await stoppedSecondParentRefusal\(org\.id, guardianEmail2\); if \(stopped\) errors\.guardianEmail2 = stopped; \}/);
    assert.match(ADD, /stoppedSecondParentRefusal\(ctx!\.org\.id, second\.email\)/);
    assert.match(EDIT, /stoppedSecondParentRefusal\(ctx!\.org\.id, second\.email\)/);
  });
  it('the lookup is this club’s, fails closed, and keeps readSecondParentEmail pure', () => {
    const body = functionBody(readCode('lib/league-second-parent-stop.ts'), 'stoppedSecondParentRefusal');
    assert.match(body, /\.eq\('org_id', orgId\)\.eq\('email', normalized\)/);
    assert.match(body, /if \(error\) throw error;/);
    assert.ok(!/supabase|await/.test(functionBody(readCode('lib/league-second-parent.ts'), 'readSecondParentEmail')));
  });
});

describe('the record window shows the stop (Stage 3b, O3, source guard)', () => {
  it('words: "Stopped by the address owner, {date}", in the staff words', () => {
    assert.equal(SP.staff.stopped('Nov 6, 2026'), 'Stopped by the address owner, Nov 6, 2026');
  });
  it('the list and every redrawn row carry the date; it is set only while the sign-up has no second address', () => {
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts'), /await withSecondParentStops\(ctx!\.org\.id, /);
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts'), /withSecondParentStops\(data\.org_id, \[mapLeagueRegistration\(data\)\]\)/);
    const stopLib = readCode('lib/league-second-parent-stop.ts');
    const fn = stopLib.slice(stopLib.indexOf('function withSecondParentStops'));
    assert.match(fn, /regs\.filter\(r => !r\.guardianEmail2\)/);
    assert.match(fn, /\.eq\('org_id', orgId\)\.overlaps\('registration_ids', bare\)/);
    assert.match(fn, /secondParentStoppedAt: r\.guardianEmail2 \? null/);
  });
  it('the window draws the line through formatStoredDate and keeps its Add control (a different address replaces the line)', () => {
    const win = readCode('components/admin/kit/club/league/registrations/RegistrationRecordWindow.tsx');
    assert.match(win, /SP\.stopped\(formatStoredDate\(reg\.secondParentStoppedAt\)\)/);
    assert.match(win, /\{reg\.guardianEmail2 \? SP\.change : SP\.add\}/);
  });
});

describe('nothing that sends mail reads the stop table (Stage 3b: the stop IS the removal)', () => {
  it('second_parent_stops appears only in the stop helper and the stop page', () => {
    const files = ['lib', 'app', 'components'].flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')]);
    const readers = files.filter(f => /second_parent_stops/.test(readCode(f))).sort();
    assert.deepEqual(readers, ['app/second-parent-stop/page.tsx', 'lib/league-second-parent-stop.ts']);
  });
  it('the stop clears only the org’s own sign-ups, in the database function the route calls', () => {
    const sql = readSource('supabase/migrations/448_a_second_parent_can_stop.sql');
    assert.match(sql, /UPDATE public\.league_registrations\s+SET guardian_email_2 = NULL\s+WHERE org_id = p_org/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.second_parent_stop\(uuid, text, text\) TO service_role;/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  });
});

describe('the stop page and its handler (Stage 3b, source guard)', () => {
  const PAGE = readCode('app/second-parent-stop/page.tsx');
  const ROUTE = readCode('app/api/second-parent-stop/route.ts');
  it('a GET writes nothing: the page only reads (mail scanners prefetch links)', () => {
    assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(PAGE), 'no write on the page');
    assert.ok(!/export (async )?function (POST|PUT|PATCH|DELETE)/.test(PAGE));
    assert.ok(!/export (async )?function GET/.test(ROUTE), 'the handler has no GET');
    assert.match(PAGE, /<form method="post" action="\/api\/second-parent-stop"/);
  });
  it('the token is verified before anything is read or written', () => {
    const view = functionBody(PAGE, 'viewOf');
    assert.ok(view.indexOf('verifySecondParentStopToken(') > 0 && view.indexOf('verifySecondParentStopToken(') < view.indexOf('supabaseAdmin'));
    const post = ROUTE.slice(ROUTE.indexOf('export const POST'));
    assert.ok(post.indexOf('verifySecondParentStopToken(') > 0 && post.indexOf('verifySecondParentStopToken(') < post.indexOf('supabaseAdmin'));
  });
  it('the POST makes the one stop call and answers with a 303; a repeat visit reads the stop and shows done', () => {
    const post = ROUTE.slice(ROUTE.indexOf('export const POST'));
    assert.equal((post.match(/\.rpc\('second_parent_stop'/g) ?? []).length, 1);
    assert.match(ROUTE, /NextResponse\.redirect\(.*, 303\)/);
    assert.match(PAGE, /stop\.data\s*\?\s*\{ state: 'done'/);
  });
  it('the path is reserved so a club can never claim it', () => {
    assert.match(readCode('lib/reserved-slugs.ts'), /'second-parent-stop'/);
  });
});
