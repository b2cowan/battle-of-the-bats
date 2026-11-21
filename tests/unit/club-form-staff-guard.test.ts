import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode } from './_source-code.ts';

/**
 * WHO SEES A FAMILY'S ANSWERS, FILES AND TICKS (Board Ready Stage 4 Part 3; drawing tab 6's who-sees-what table; rulings 5,
 * 6, 11–13). Answers, files and ticks are read only behind the Registrations read (`houseLeagueRefusal(ctx, 'read')`, the
 * action the registrations list and the single registration open on); a health answer never rides the list, the filter,
 * the board, an email, a push or a bell line, and leaves only in the one opt-in export. A new reader is a decision: add it
 * here with its gate, or don't add it.
 */

const STAFF = 'lib/club-form-staff.ts';
const STAFF_ROUTE = 'lib/club-form-staff-route.ts';
const LIST = 'app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts';
const ONE = 'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts';
const RECORD = 'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/answers/route.ts';
const FILE = 'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/files/[fileId]/route.ts';
const EXPORT = 'app/api/admin/house-league/seasons/[seasonId]/registrations/answers/route.ts';
const BOARD = 'app/api/admin/house-league/seasons/[seasonId]/teams-board/route.ts';
const SWEEP = 'app/api/platform-admin/club-form-files-sweep/route.ts';

const READERS = ['readSeasonAnswerGrid', 'readRegistrationForm', 'openFamilyFile', 'readAnswerColumns', 'saveAnswerColumns', 'readBoardAnswers'];
const ALLOWED = new Set([LIST, RECORD, FILE, EXPORT, BOARD]);

const code = (dir: string) => [...filesUnder(dir, '.ts'), ...filesUnder(dir, '.tsx')];
const actionOf = (src: string) => /houseLeagueRefusal\(ctx, '(\w+)'\)/.exec(src)?.[1];

describe('1 · the staff readers have a fixed list of callers', () => {
  it('only the five routes call a staff reader', () => {
    const callers = [...code('app'), ...code('lib'), ...code('components')]
      .filter(f => f !== STAFF && READERS.some(r => new RegExp(`\\b${r}\\(`).test(readCode(f))));
    assert.deepEqual(callers.filter(f => !ALLOWED.has(f)), [], 'a new caller of the staff answer readers');
  });
  it('the platform sweep only runs the clock and the removals, never a reader', () => {
    const src = readCode(SWEEP);
    assert.ok(!READERS.some(r => src.includes(r)));
    assert.match(src, /runRetentionSweep\(\)/);
    assert.match(src, /clearStorageRemovals\(\)/);
  });
});

describe('2 · every caller sits behind the Registrations read', () => {
  it('the list asks the same action the single registration opens on', () => {
    assert.equal(actionOf(readCode(LIST)), actionOf(readCode(ONE)));
  });
  it('the record, the file and the export routes ask that action first, in every handler', () => {
    for (const f of [RECORD, FILE, EXPORT]) {
      const src = readCode(f);
      const gates = src.match(new RegExp(`const err = houseLeagueRefusal\\(ctx, '${actionOf(readCode(ONE))}'\\);\\s*if \\(err \\|\\| !ctx\\) return`, 'g')) ?? [];
      assert.equal(gates.length, (src.match(/withObservability\(/g) ?? []).length, `${f} has a handler without the Registrations read in front`);
    }
    assert.ok(!/houseLeagueRefusal/.test(readCode(STAFF_ROUTE)), 'the helper only finds the season; the routes ask the gate');
  });
});

describe('3 · a health answer never rides the list', () => {
  it('the list asks for the grid without health, and only the opt-in export asks with it', () => {
    assert.match(readCode(LIST), /readSeasonAnswerGrid\(\{[\s\S]{0,300}?health: false \}\)/);
    const withHealth = [...code('app'), ...code('lib')].filter(f => /readSeasonAnswerGrid\(\{[\s\S]{0,300}?health: true \}\)/.test(readCode(f)));
    assert.deepEqual(withHealth, [EXPORT]);
  });
  it('the grid leaves health questions out unless asked', () => {
    assert.match(functionBody(readCode(STAFF), 'readSeasonAnswerGrid'), /all\.filter\(q => input\.health \|\| !q\.health\)/);
  });
  it('the opt-in export is written to the club’s activity log', () => {
    // Written first, and nothing leaves when it can't be (owner call 3).
    assert.match(readCode(EXPORT), /!\(await writeOrgAuditFirst\([^)]*HEALTH_EXPORT_ACTION[^)]*\)\)\)\s*\{\s*return NextResponse\.json\(/);
  });
  it('the Answer columns save keeps health questions out', () => {
    assert.match(readCode(EXPORT), /\.eq\('health', false\)/);
  });
});

describe('4 · never in an email, a push or a bell line', () => {
  it('no mail, notification or push module reads the staff answers or a health answer', () => {
    const senders = code('lib').filter(f => /(email|mail|notify|notification|push|bell)/i.test(f.split('/').pop() ?? ''));
    assert.ok(senders.length > 5, 'the sender list came back empty: the pattern is broken');
    for (const f of senders) {
      const src = readCode(f);
      assert.ok(!/club-form-staff/.test(src), `${f} imports the staff answer readers`);
      assert.ok(!/value_text|value_choice_ids|value_bool|value_date/.test(src), `${f} reads an answer's value`);
    }
  });
});

describe('5 · the browser never reads the form tables', () => {
  it('no component or page names a family-data table', () => {
    const browser = [...code('components'), ...filesUnder('app', '.tsx')];
    for (const f of browser) {
      assert.ok(!/['"`](club_form_answers|club_form_ticks|club_form_files|club_form_storage_removals|club_form_submissions)['"`]/.test(readCode(f)), `${f} names a form table`);
    }
  });
  it('the new removal list is walled off from anon and signed-in browsers', () => {
    const sql = readCode('supabase/migrations/518_a_club_reads_its_answers_and_removes_them_on_a_clock.sql');
    assert.match(sql, /club_form_storage_removals ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON public\.club_form_storage_removals FROM anon, authenticated/);
  });
});

describe('6 · a family file opens as a one-hour download, recorded', () => {
  it('the link lasts an hour, downloads, and the opening is logged without the file’s name', () => {
    const body = functionBody(readCode(STAFF), 'openFamilyFile');
    assert.match(body, /createSignedUrl\(f\.path, 3600, \{ download:/);
    assert.match(body, /writeOrgAuditFirst\([^;]*FILE_OPENED_ACTION, \{ registrationId: input\.reg\.id, fileId: f\.id \}\)\)\) return 'unrecorded';/);
    assert.ok(body.indexOf('writeOrgAuditFirst(') < body.indexOf('createSignedUrl('), 'the link is made before the opening is recorded');
    assert.ok(!/file_name[^;]*writeOrgAuditFirst\(|writeOrgAuditFirst\([^;]*file_name/.test(body));
  });
  it('only an attached file of this registration (or its sign-up) opens', () => {
    const body = functionBody(readCode(STAFF), 'openFamilyFile');
    assert.match(body, /f\.status !== 'attached'/);
    assert.match(body, /\.eq\('org_id', input\.orgId\)/);
  });
});
