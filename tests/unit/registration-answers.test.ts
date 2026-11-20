/**
 * THE TOURNAMENT REGISTRATION QUESTIONS — F1–F3 (Board Ready; owner ruling 15, 2026-11-20).
 *
 *   F1  an archived question's answers stay with the registration: on the team's record ("No longer asked") and in the
 *       export (after the current questions) — the public form still never shows the question.
 *   F2  a file answer is its NAME on the record, opened through a one-hour signed link by a route that checks the answers'
 *       own access; the export says "Attached". The storage key never leaves the server.
 *   F3  a file is a PDF, JPEG, PNG or HEIC, read from its bytes; the form's files together fit the proxy's limit.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import {
  exportAnswerColumns, exportAnswerValue, looksLikeRegistrationFile, registrationFileKeyBelongs, registrationFileName,
  REGISTRATION_FILE_KINDS, REGISTRATION_FILE_WORDS, REGISTRATION_FILES_MAX_BYTES, teamRecordAnswers,
} from '../../lib/registration-answers.ts';
import { checkDocumentUpload, sniffDocumentUpload } from '../../lib/document-upload.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const TOURN = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';
const OTHER_TEAM = '44444444-4444-4444-8444-444444444444';
const F_ACTIVE = '55555555-5555-4555-8555-555555555555';
const F_ARCHIVED = '66666666-6666-4666-8666-666666666666';
const F_FILE = '77777777-7777-4777-8777-777777777777';
const F_ARCHIVED_EMPTY = '88888888-8888-4888-8888-888888888888';
const UUID = '99999999-9999-4999-8999-999999999999';
const KEY = `${ORG}/${TOURN}/${TEAM}/${F_FILE}-${UUID}-Medical_form.pdf`;

const fields = [
  { id: F_ACTIVE, label: 'Hotel block?', fieldType: 'short_text', isArchived: false },
  { id: F_ARCHIVED, label: 'Jersey colour', fieldType: 'short_text', isArchived: true },
  { id: F_FILE, label: 'Medical form', fieldType: 'file', isArchived: false },
  { id: F_ARCHIVED_EMPTY, label: 'Old waiver', fieldType: 'checkbox', isArchived: true },
];
const answer = (registrationId: string, fieldId: string, over: Partial<{ valueText: string | null; valueJson: unknown; fileUrl: string | null }> = {}) =>
  ({ registrationId, fieldId, valueText: null, valueJson: null, fileUrl: null, ...over });
const answers = [
  answer(TEAM, F_ARCHIVED, { valueText: 'Red' }),
  answer(TEAM, F_ACTIVE, { valueText: 'Yes, 4 rooms' }),
  answer(TEAM, F_FILE, { fileUrl: KEY }),
  answer(TEAM, F_ARCHIVED_EMPTY, { valueText: '' }),
];

describe('F1 · an archived question’s answers stay with the registration', () => {
  it('the record shows them after the current answers, marked archived', () => {
    const list = teamRecordAnswers(fields, answers).get(TEAM)!;
    assert.deepEqual(list.map(a => [a.label, a.value, Boolean(a.archived)]), [
      ['Hotel block?', 'Yes, 4 rooms', false],
      ['Medical form', 'Medical_form.pdf', false],
      ['Jersey colour', 'Red', true],
    ]);
  });
  it('an archived question with nothing in it says nothing', () => {
    assert.ok(!teamRecordAnswers(fields, answers).get(TEAM)!.some(a => a.fieldId === F_ARCHIVED_EMPTY));
  });
  it('an answer whose question is gone altogether is not shown', () => {
    assert.equal(teamRecordAnswers(fields, [answer(TEAM, UUID, { valueText: 'x' })]).get(TEAM), undefined);
  });
  it('the export adds a column for an archived question a team answered, after the current questions', () => {
    assert.deepEqual(exportAnswerColumns(fields, answers).map(c => c.heading),
      ['Hotel block?', 'Medical form', REGISTRATION_FILE_WORDS.archivedColumn('Jersey colour')]);
  });
  it('the export has no column for an archived question nobody answered', () => {
    assert.deepEqual(exportAnswerColumns(fields, [answer(TEAM, F_ACTIVE, { valueText: 'x' })]).map(c => c.fieldId), [F_ACTIVE, F_FILE]);
  });
  it('the teams list and the export read every question, archived included; the public form does not', () => {
    for (const file of ['app/api/admin/teams/route.ts', 'app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts']) {
      assert.match(readCode(file), /getTournamentRegistrationFields\(tournamentId, \{ includeArchived: true \}\)/, file);
    }
    assert.match(readCode('lib/public-tournament-data.ts'), /getTournamentRegistrationFields\(tournament\.id\)/);
    assert.match(readCode('app/api/register/route.ts'), /await getTournamentRegistrationFields\(tournamentId\)/);
  });
});

describe('F2 · a file answer is a name and a link, never the storage key', () => {
  it('the record carries the file’s name and `file`, never the key', () => {
    const row = teamRecordAnswers(fields, answers).get(TEAM)!.find(a => a.fieldId === F_FILE)!;
    assert.equal(row.value, 'Medical_form.pdf');
    assert.equal(row.file, true);
    assert.ok(!JSON.stringify(teamRecordAnswers(fields, answers).get(TEAM)).includes(ORG), 'no folder of the key');
  });
  it('the export writes "Attached"', () => {
    assert.equal(exportAnswerValue(answer(TEAM, F_FILE, { fileUrl: KEY })), 'Attached');
    assert.equal(exportAnswerValue(answer(TEAM, F_ACTIVE, { valueJson: { checked: true } })), 'Yes');
    assert.equal(exportAnswerValue(undefined), '');
  });
  it('a file’s name is read back from its key; an odd key shows only its last part', () => {
    assert.equal(registrationFileName(KEY), 'Medical_form.pdf');
    assert.equal(registrationFileName('a/b/c/photo.jpg'), 'photo.jpg');
    assert.equal(registrationFileName(''), 'File');
  });
  it('a key belongs only under this club’s, tournament’s and team’s folder', () => {
    assert.ok(registrationFileKeyBelongs(KEY, ORG, TOURN, TEAM));
    assert.ok(!registrationFileKeyBelongs(KEY, ORG, TOURN, OTHER_TEAM));
    assert.ok(!registrationFileKeyBelongs(`${ORG}/${TOURN}/${TEAM}/../${OTHER_TEAM}/x.pdf`, ORG, TOURN, TEAM));
    assert.ok(!registrationFileKeyBelongs('', ORG, TOURN, TEAM));
  });
  it('no route sends the raw key to a screen', () => {
    assert.doesNotMatch(readCode('app/api/admin/teams/route.ts'), /fileUrl/);
    assert.doesNotMatch(readCode('app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts'), /fileUrl/);
  });
});

// ── The signed-link route, run for real against a fake database ─────────────────────────────────────────────────
const FILE_ROUTE = 'app/api/admin/tournaments/[tournamentId]/registrations/[regId]/file/route.ts';

type Member = { role: string; capabilities?: Record<string, boolean> };
function fileRoute(member: Member, rows: { teamTournament?: string; fieldTournament?: string; key?: string | null } = {}) {
  const signed: Array<{ bucket: string; key: string; ttl: number; opts: unknown }> = [];
  const tables: Record<string, Record<string, unknown> | null> = {
    teams: { id: TEAM, tournament_id: rows.teamTournament ?? TOURN },
    tournament_registration_fields: { id: F_FILE, tournament_id: rows.fieldTournament ?? TOURN },
    tournament_registration_field_answers: rows.key === null ? null : { file_url: rows.key ?? KEY },
  };
  const query = (table: string) => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: tables[table], error: null }) };
    return chain;
  };
  const supabaseAdmin = {
    from: query,
    storage: { from: (bucket: string) => ({
      createSignedUrl: async (key: string, ttl: number, opts: unknown) => {
        signed.push({ bucket, key, ttl, opts });
        return { data: { signedUrl: `https://storage.test/sign/${key}?token=t` }, error: null };
      },
    }) },
  };
  const ctx = {
    user: { id: 'u1', email: 'm@club.test' },
    role: member.role,
    capabilities: member.capabilities ?? null,
    org: { id: ORG, slug: 'club', planId: 'tournament_plus', subscriptionStatus: 'active', enabledAddons: [] },
  };
  const load = billingTestLoader({
    'next/server': { NextRequest, NextResponse },
    '@/lib/observability': { withObservability: (handler: unknown) => handler, captureAndJson: (_e: unknown, body: unknown, status: number) => NextResponse.json(body, { status }) },
    '@/lib/supabase-admin': { supabaseAdmin },
    '@/lib/api-auth': {
      getAuthContextWithScope: async () => ctx,
      unauthorized: () => new Response(null, { status: 401 }),
      forbidden: () => new Response(null, { status: 403 }),
      scopeGuard: () => null,
      requireTournamentInOrg: async () => null,
    },
  });
  const { GET } = load(FILE_ROUTE) as { GET: (req: NextRequest, ctx: { params: Promise<{ tournamentId: string; regId: string }> }) => Promise<Response> };
  const open = (fieldId = F_FILE) => GET(
    new NextRequest(`http://localhost/api/admin/tournaments/${TOURN}/registrations/${TEAM}/file?orgSlug=club&fieldId=${fieldId}`),
    { params: Promise.resolve({ tournamentId: TOURN, regId: TEAM }) },
  );
  return { open, signed };
}

describe('F2 · the signed-link route', () => {
  it('refuses a member who cannot open the tournaments area, and signs nothing', async () => {
    for (const member of [{ role: 'coach' }, { role: 'treasurer' }, { role: 'official' }, { role: 'admin', capabilities: { module_tournaments: false } }]) {
      const api = fileRoute(member);
      const res = await api.open();
      assert.equal(res.status, 403, member.role);
      assert.equal(api.signed.length, 0, `${member.role}: no link was made`);
    }
  });
  it('sends a member who reads the answers on to a one-hour download link', async () => {
    for (const member of [{ role: 'owner' }, { role: 'staff' }]) {
      const api = fileRoute(member);
      const res = await api.open();
      assert.equal(res.status, 302, member.role);
      assert.equal(res.headers.get('location'), `https://storage.test/sign/${KEY}?token=t`);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
      assert.deepEqual(api.signed, [{ bucket: 'tournament-registration-files', key: KEY, ttl: 3600, opts: { download: 'Medical_form.pdf' } }]);
    }
  });
  it('signs nothing for another tournament’s team or question, a missing answer, or a key outside the team’s folder', async () => {
    const cases = [
      { teamTournament: UUID }, { fieldTournament: UUID }, { key: null },
      { key: `${ORG}/${TOURN}/${OTHER_TEAM}/${F_FILE}-${UUID}-x.pdf` },
    ];
    for (const rows of cases) {
      const api = fileRoute({ role: 'owner' }, rows);
      assert.equal((await api.open()).status, 404, JSON.stringify(rows));
      assert.equal(api.signed.length, 0);
    }
    const api = fileRoute({ role: 'owner' });
    assert.equal((await api.open('not-a-uuid')).status, 404);
  });
  it('asks the same door as the answers it opens (the teams list), so the two cannot drift apart', () => {
    const door = "canOpenModule(ctx, ctx.org, 'module_tournaments')";
    assert.ok(readCode('app/api/admin/teams/route.ts').includes(door));
    assert.ok(readCode(FILE_ROUTE).includes(door));
  });
});

// ── F3 · what a file may be ─────────────────────────────────────────────────────────────────────────────────────
const ascii = (s: string) => new TextEncoder().encode(s);
const bytes = (...parts: Array<Uint8Array | number[]>) => {
  const all = parts.map(p => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
};
/** An ISO media file's first box: `ftyp`, a major brand, a version, then compatible brands. */
const ftyp = (major: string, ...compatible: string[]) => {
  const size = 16 + compatible.length * 4;
  return bytes([0, 0, 0, size], ascii('ftyp'), ascii(major), [0, 0, 0, 0], ...compatible.map(ascii), new Uint8Array(32));
};

describe('F3 · a registration file is a PDF, JPEG, PNG or HEIC, read from its bytes', () => {
  it('reads a phone’s HEIC photo, and a generic HEIF only when it carries a HEIC brand', () => {
    assert.equal(sniffDocumentUpload(ftyp('heic', 'mif1', 'heic')), 'heic');
    assert.equal(sniffDocumentUpload(ftyp('mif1', 'mif1', 'heic')), 'heic');
    assert.equal(sniffDocumentUpload(ftyp('mif1', 'mif1', 'avif')), null); // an AVIF
    assert.equal(sniffDocumentUpload(ftyp('isom', 'mp41')), null); // a video
    const sizeZero = ftyp('mif1', 'mif1', 'heic'); sizeZero[3] = 0; // a box that runs to the end of the file
    assert.equal(sniffDocumentUpload(sizeZero), 'heic');
  });
  it('takes the four', () => {
    assert.equal(checkDocumentUpload(ascii('%PDF-1.7'), 'form.pdf', REGISTRATION_FILE_KINDS)?.contentType, 'application/pdf');
    assert.equal(checkDocumentUpload(bytes([0xff, 0xd8, 0xff, 0xe0]), 'a.jpg', REGISTRATION_FILE_KINDS)?.contentType, 'image/jpeg');
    assert.equal(checkDocumentUpload(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'a.png', REGISTRATION_FILE_KINDS)?.contentType, 'image/png');
    const heic = checkDocumentUpload(ftyp('heic', 'mif1'), 'IMG_0001.HEIC', REGISTRATION_FILE_KINDS);
    assert.equal(heic?.contentType, 'image/heic');
    assert.equal(heic?.storedName, 'IMG_0001.HEIC');
  });
  it('refuses anything else, whatever its name says', () => {
    assert.equal(checkDocumentUpload(ascii('<html><script>alert(1)</script>'), 'form.pdf', REGISTRATION_FILE_KINDS), null);
    assert.equal(checkDocumentUpload(bytes([0x4d, 0x5a, 0x90, 0x00]), 'photo.jpg', REGISTRATION_FILE_KINDS), null);
    assert.equal(checkDocumentUpload(bytes([0x50, 0x4b, 0x03, 0x04], ascii('word/document.xml')), 'form.docx', REGISTRATION_FILE_KINDS), null);
  });
  it('the other upload doors are unchanged: they still take Word and still refuse HEIC', () => {
    assert.ok(checkDocumentUpload(bytes([0x50, 0x4b, 0x03, 0x04], ascii('word/document.xml')), 'form.docx'));
    assert.equal(checkDocumentUpload(ftyp('heic', 'mif1'), 'IMG.heic'), null);
  });
  it('the refusal names the four types', () => {
    assert.equal(REGISTRATION_FILE_WORDS.wrongType('Medical form'), 'Medical form: upload a PDF, JPEG, PNG or HEIC file.');
  });
  it('the picker’s early answer goes by name or type, and the files together stay under the proxy’s 10 MB', () => {
    assert.ok(looksLikeRegistrationFile('scan.PDF', ''));
    assert.ok(looksLikeRegistrationFile('IMG_0001.heic', ''));
    assert.ok(looksLikeRegistrationFile('photo.HEIF', ''));
    assert.ok(looksLikeRegistrationFile('photo', 'image/jpeg'));
    assert.ok(!looksLikeRegistrationFile('roster.xlsx', 'application/vnd.ms-excel'));
    assert.ok(!looksLikeRegistrationFile('pdf', ''));
    assert.ok(REGISTRATION_FILES_MAX_BYTES < 10 * 1024 * 1024);
  });
  it('the upload route reads the bytes, stores the checked type, and says which question was refused', () => {
    const src = readCode('app/api/register/route.ts');
    assert.match(src, /checkDocumentUpload\(bytes, \(file as File\)\.name, REGISTRATION_FILE_KINDS\)/);
    assert.match(src, /if \(!checked\) return \{ error: REGISTRATION_FILE_WORDS\.wrongType\(field\.label\), fieldId: field\.id \}/);
    assert.match(src, /contentType: answer\.file\.contentType/);
    assert.doesNotMatch(src, /answer\.file\.type/, 'never the browser’s claimed type');
  });
  it('the public form filters the picker and puts a refusal under its question', () => {
    const src = readCode('components/public/RegisterContent.tsx');
    assert.match(src, /accept=\{REGISTRATION_FILE_ACCEPT\}/);
    assert.match(src, /id=\{`reg-file-\$\{field\.id\}-error`\} className=\{styles\.inlineError\} role="alert"/);
    assert.match(src, /throw fileFieldError\(fieldId, error\)/);
    // a picker remounted on the way back holds its chosen file again, and is not re-required while one is held
    assert.match(src, /ref=\{el => restoreHeldFile\(el, customFiles\[field\.id\]\)\}/);
    assert.match(src, /required=\{field\.required && !customFiles\[field\.id\]\}/);
  });
});
