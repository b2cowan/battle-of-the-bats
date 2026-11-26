import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CLAIM_CODE_ALPHABET, CLAIM_WORDS, claimPath, claimRecordText, claimedPlanLine, formatClaimCode, isClaimCodeShape, maskClaimantEmail,
  normaliseClaimCode,
} from '../../lib/preview-claim.ts';
import { claimPassMatches, signClaimPass, claimVisitorKeyFromIp } from '../../lib/preview-claim-pass.ts';
import { startDoorNext } from '../../lib/login-destination.ts';
import { buildRoomCardDoc, ROOM_CARD_SIZE } from '../../lib/preview-room-card.ts';

/**
 * CLUB WEBSITE TRACK P, SESSION P3 — the room and the claim (owner rulings T5, T7–T10, T14–T16, 2026-11-25).
 *
 *   1. The claim code: no 0, O, 1 or I; read the way a person types it.
 *   2. The pass a right code hands on: bound to the club and its CURRENT code, and it lapses.
 *   3. The claim door holds every rule Start a club's own door holds, and the claim is one database step.
 *   4. The room window is the owner's only; the code is never in an email.
 *   5. Migration 540's order of steps (the marker before the seat; one lock order; the undo's fail-closed scan).
 *   6. The words /legal wrote, word for word.
 *   7. The room card is half a letter page and carries the code.
 */

const root = resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(resolve(root, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    if (statSync(resolve(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel.split('\\').join('/'));
  }
  return out;
}

describe('1. the claim code (T7)', () => {
  it('leaves out 0, O, 1 and I', () => {
    for (const c of ['0', 'O', '1', 'I']) assert.ok(!CLAIM_CODE_ALPHABET.includes(c), `${c} is in the alphabet`);
    assert.equal(CLAIM_CODE_ALPHABET.length, 32);
  });
  it('reads the way a person types it, and prints in two threes', () => {
    assert.equal(normaliseClaimCode(' 7k4 pq2 '), '7K4PQ2');
    assert.equal(normaliseClaimCode('7k4-pq2'), '7K4PQ2');
    assert.ok(isClaimCodeShape('7K4PQ2'));
    assert.ok(!isClaimCodeShape('7K4PQ0'), 'a zero is never a code character');
    assert.ok(!isClaimCodeShape('7K4PQ'), 'six characters');
    assert.equal(formatClaimCode('7k4pq2'), '7K4 PQ2');
  });
});

describe('2. the pass (T7)', () => {
  const org = '11111111-2222-4333-8444-555555555555';
  process.env.PAY_LINK_SECRET = 'x'.repeat(40);
  it('is good for its club and its current code', () => {
    const pass = signClaimPass(org, '7K4PQ2')!;
    assert.ok(pass);
    assert.ok(!pass.includes('7K4PQ2'), 'the pass never carries the code');
    assert.ok(claimPassMatches(pass, org, '7K4PQ2'));
  });
  it('dies with a new code, on another club, when it lapses, and when it is changed', () => {
    const now = Date.now();
    const pass = signClaimPass(org, '7K4PQ2', now)!;
    assert.ok(!claimPassMatches(pass, org, 'ABCDEF'), 'New code kills every pass made from the old one');
    assert.ok(!claimPassMatches(pass, '11111111-2222-4333-8444-666666666666', '7K4PQ2'));
    assert.ok(!claimPassMatches(pass, org, '7K4PQ2', now + 25 * 3600_000), 'a day later it is gone');
    assert.ok(!claimPassMatches(pass.slice(0, -2) + 'AA', org, '7K4PQ2'));
    assert.ok(!claimPassMatches(null, org, '7K4PQ2'));
  });
  it('a visitor is a one-way hash, never the address', () => {
    const key = claimVisitorKeyFromIp('203.0.113.7');
    assert.ok(!key.includes('203'));
    assert.equal(key, claimVisitorKeyFromIp('203.0.113.7'));
  });
});

describe('3. the claim door (tab 6.3; /legal finding 1; T9)', () => {
  const route = code(read('app/api/start/claim/route.ts'));
  it('holds every rule Start a club’s own door holds, the Terms first', () => {
    for (const rule of ['demoActorRefusal(', 'isPlatformAdminEmail(', 'requireAcceptance(', 'readRealSeats(', 'hasLiveInvitation(',
      'getActiveOwnedTeamWorkspace(', "isPaidDoorOpen('club')"]) {
      assert.ok(route.includes(rule), `the claim door must ask ${rule}`);
    }
    assert.ok(route.indexOf('requireAcceptance(') < route.indexOf('openClaimPass('), 'the Terms before anything else is read');
  });
  it('refuses without the authority tick, and records the sentence shown', () => {
    assert.match(route, /body\.authority !== true/);
    assert.match(route, /boxText: claimRecordText\(club\.name\)/);
    assert.ok(claimRecordText('Oakridge').startsWith(CLAIM_WORDS.publisher), 'the record keeps the paragraph with the tick');
    assert.ok(claimRecordText('Oakridge').length < 1000, 'within the record’s CHECK');
  });
  it('starts exactly what Start a club starts: the Club plan step, unchanged (T9)', () => {
    assert.match(route, /startPlan: 'club'/);
    assert.match(route, /planStepPath\(result\.slug, null\)/);
  });
  it('forgets the remembered start door, as every path that gives an account its club does', () => {
    assert.ok(route.indexOf("clearStartDoor(user.id, ['club'])") > route.indexOf('claimPreviewClub('));
  });
  it('the claim is ONE database step', () => {
    const server = code(read('lib/preview-claim-server.ts'));
    assert.match(server, /rpc\('claim_preview_club'/);
    assert.ok(!/from\('organization_members'\)\s*\.insert/.test(server), 'the seat is the database step’s, never a second write');
  });
  it('the code page asks the code before anyone makes an account', () => {
    const page = code(read('app/(consumer)/start/claim/[slug]/page.tsx'));
    assert.ok(page.indexOf('openClaimPass(') < page.indexOf("kind: 'account'"));
  });
  it('a signed-in person returning to the claim is let through sign-in with no workspace', () => {
    assert.equal(startDoorNext('/start/claim/oakridge-minor-softball?pass=abc'), '/start/claim/oakridge-minor-softball?pass=abc');
    assert.equal(startDoorNext('/start/claim/../admin'), null);
  });
  it('the band carries Claim it to our own page', () => {
    assert.equal(claimPath('oakridge-minor-softball'), '/start/claim/oakridge-minor-softball');
    assert.match(code(read('components/public/PreviewBand.tsx')), /href=\{claimPath\(slug\)\}/);
  });
});

describe('4. the room window is the owner’s, and the code never travels by email (T2, T7)', () => {
  it('every handler of the room route asks the owner gate first', () => {
    const src = code(read('app/api/platform-admin/prospect-clubs/[orgId]/route.ts'));
    const handlers = src.split(/export const (?:GET|POST) =/).slice(1);
    assert.equal(handlers.length, 2);
    for (const h of handlers) assert.match(h, /^\s*withObservability\(async[^{]*\{\s*const gate = await requirePlatformOwnerApi\(\);/);
  });
  it('only the room’s and the claim’s server half reads the stored code', () => {
    const readers = ['app', 'lib', 'components'].flatMap(d => walk(d)).filter(f => /claim_code/.test(code(read(f))));
    assert.deepEqual(readers, ['lib/preview-claim-server.ts'], 'the stored code is read in one place (T7)');
    for (const f of ['app', 'lib', 'components'].flatMap(d => walk(d)).filter(f => /email|mail/i.test(f))) {
      assert.ok(!/claim_code|formatClaimCode|claimCode/.test(code(read(f))), `${f} is a mail file and must never carry the code`);
    }
  });
});

describe('5. migration 540: the claim, the undo, the room’s writes', () => {
  const mig = read('supabase/migrations/540_claim_a_club_made_for_a_meeting.sql');
  const fn = (name: string) => {
    const at = mig.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    assert.ok(at >= 0, `${name} is defined`);
    return mig.slice(at, mig.indexOf('$$;', at));
  };
  it('the claim: club locked first, sample cleared under the marker, the marker, then the seat', () => {
    const f = fn('claim_preview_club');
    const order = ['FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview FOR UPDATE', 'preview_clear_sample(',
      'SET claimed_at = now()', 'INSERT INTO public.organization_members', "INSERT INTO public.preview_claim_records"];
    let last = -1;
    for (const step of order) {
      const at = f.indexOf(step);
      assert.ok(at > last, `"${step}" is out of order in the claim`);
      last = at;
    }
    assert.match(f, /created_at = now\(\)/, 'T10: a customer from the claim day');
  });
  it('the undo fails closed on anything the club holds, and gives back the day we made it', () => {
    const f = fn('undo_preview_claim');
    assert.match(f, /FROM pg_constraint c/);
    assert.match(f, /confrelid = 'public\.organizations'::regclass/);
    assert.ok(f.indexOf('DELETE FROM public.organization_members') < f.indexOf('SET claimed_at = NULL'), 'the claimant leaves first (PV001)');
    assert.match(f, /created_at = v_rec\.created_at/);
  });
  it('clearing and making a sample refuse a customer’s club', () => {
    for (const name of ['preview_clear_sample', 'preview_make_sample', 'preview_make_tournament']) {
      assert.match(fn(name), /o\.is_preview\) THEN\s+RAISE EXCEPTION USING ERRCODE = 'PV020'/, `${name} must refuse a club that is not a preview`);
    }
  });
  it('the code door counts one check at a time per club', () => {
    assert.match(fn('preview_claim_door'), /pg_advisory_xact_lock\(hashtext\('preview_claim_door:'/);
  });
  it('every new function is the service role’s only', () => {
    const names = [...mig.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(/g)].map(m => m[1])
      // A trigger function is never called directly; make_preview_club keeps 536's grants through CREATE OR REPLACE.
      .filter(n => !['organization_previews_mark_removed', 'preview_claim_records_refuse_change', 'make_preview_club'].includes(n));
    for (const n of names) {
      assert.match(mig, new RegExp(`REVOKE ALL ON FUNCTION public\\.${n}\\(`), `${n} is revoked from the public`);
    }
  });
});

describe('6. /legal’s words, word for word (CLUB_WEBSITE_TRACK_P_REVIEW.md rec. 1 and 3)', () => {
  it('the publisher paragraph and the authority tick', () => {
    assert.equal(CLAIM_WORDS.publisher, 'FieldLogicHQ made and published this preview, using the club’s name, logo and colours from its own site. The club did not make it and is not responsible for it. From here the club is yours, and so is what you put on it. The name, logo and colours stay until you change them.');
    assert.equal(CLAIM_WORDS.authority('Oakridge Minor Softball'), 'I’m allowed to claim this club for Oakridge Minor Softball and to agree to the Terms on its behalf.');
  });
  it('"already claimed" asserts nothing it does not know', () => {
    assert.equal(CLAIM_WORDS.err.claimed, 'This club has already been claimed. If you’re with the club and didn’t claim it, write to support@fieldlogichq.ca.');
  });
  it('the claimant shows masked (T15), and the plan line is the plan’s own name', () => {
    assert.equal(maskClaimantEmail('sam@westvale.ca'), 's•••@w•••.ca');
    assert.equal(maskClaimantEmail('not-an-email'), null);
    assert.equal(claimedPlanLine('Club', 'trialing'), 'Club, on trial');
    assert.equal(claimedPlanLine(null, null), 'No plan yet');
  });
});

describe('7. the room card (tab 4B)', () => {
  it('is half a letter page and carries the code, the address and the foot line', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = buildRoomCardDoc(jsPDF, {
      clubName: 'Oakridge Minor Softball', slug: 'oakridge-minor-softball', tagline: 'Softball for Oakridge kids',
      code: '7K4PQ2', removalDate: 'Thu, Jan 7, 2027', primary: '#16284d', accent: '#d6aa3c', qrDataUrl: null, logoDataUrl: null,
    });
    assert.equal(doc.getNumberOfPages(), 1);
    const size = doc.internal.pageSize;
    assert.ok(Math.abs(size.getWidth() - ROOM_CARD_SIZE.width) < 0.01 && Math.abs(size.getHeight() - ROOM_CARD_SIZE.height) < 0.01);
    const out = doc.output() as string;
    assert.ok(out.includes('7K4 PQ2'), 'the code is printed');
    assert.ok(out.includes('fieldlogichq.ca/oakridge-minor-softball'));
    assert.ok(out.includes('Prepared by FieldLogicHQ for Oakridge Minor Softball'));
  });
  it('a long web address breaks where it reads and stays on the card (/design M5)', async () => {
    const { jsPDF } = await import('jspdf');
    const slug = 'oakville-girls-softball-association-of-the-halton-region';
    const doc = buildRoomCardDoc(jsPDF, {
      clubName: 'Oakville Girls Softball Association', slug, tagline: null, code: '7K4PQ2', removalDate: 'Thu, Jan 7, 2027',
      primary: '#ffe14d', accent: '#16284d', qrDataUrl: null, logoDataUrl: null,
    });
    const out = doc.output() as string;
    assert.ok(!out.includes(`fieldlogichq.ca/${slug}`), 'the address is not one line');
    assert.ok(out.includes('fieldlogichq.ca/'), 'its first piece is printed');
    assert.equal(doc.getNumberOfPages(), 1);
  });
});
