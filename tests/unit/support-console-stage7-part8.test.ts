/**
 * Support console Stage 7 Part 8 — the public form (drawing J, owner ruling 2026-10-27 "as drawn"): the build prompt's
 * guards 5 and 6 for the new fields, and threats 4, 10 (the throttle) and 16.
 *
 *   • The pure rules: what a second form from a known address may change (lib/early-access-refill.ts), what a visitor's
 *     answer and a link tag are allowed to be (lib/lead-form-answers.ts).
 *   • The places: both lead writers follow the rule (a coach button is not a back door), the early-access route is
 *     throttled and never prints the database's words, and the public pages store no cookie.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { decideRefill, isWorkedLead, type KnownLead, type RefillIncoming } from '../../lib/early-access-refill.ts';
import {
  HEARD_FROM_CHOICES, LINK_TAGS, LINK_TAG_MAX, cleanHeardFrom, cleanLinkTag, heardFromLabel, linkTagLabel, sourceFromHeard,
} from '../../lib/lead-form-answers.ts';
import { isLeadSource } from '../../lib/early-access-admin.ts';
import { leadNumbers, type LeadFacts, type PayRead } from '../../lib/lead-numbers.ts';

const FRESH: KnownLead = {
  internal_status: 'new', source: null, source_words: null, linked_at: null, converted_org_id: null,
  last_contacted_at: null, next_action: null, follow_up_due_at: null, release_notifications_consent: true,
};
const NEW_WORDS: RefillIncoming = {
  name: 'Morgan E.', organization_name: 'Cedar Hollow', role: 'Registrar', sports: 'Baseball', plan_interest: ['club'],
  features_interested: ['accounting'], notes: 'We now have 44 teams.', heard_from: 'searched', consent: true,
};

describe('Stage 7 Part 8 · what a visitor’s answer and a link tag may be', () => {
  it('a choice is on the list, kept as a code the database accepts, mapped to a real staff source', () => {
    assert.equal(HEARD_FROM_CHOICES.length, 8);
    for (const c of HEARD_FROM_CHOICES) {
      assert.match(c.code, /^[a-z][a-z_]{1,39}$/, `${c.code} must pass the database's format check`);
      assert.ok(isLeadSource(c.source), `${c.code} maps to ${c.source}`);
      assert.equal(sourceFromHeard(c.code), c.source);
      assert.equal(heardFromLabel(c.code), c.label);
    }
  });

  it('anything not on the list is dropped, never stored and never shown', () => {
    assert.equal(cleanHeardFrom('searched'), 'searched');
    assert.equal(cleanHeardFrom('<script>alert(1)</script>'), null);
    assert.equal(cleanHeardFrom(''), null);
    assert.equal(cleanHeardFrom(42), null);
    assert.equal(sourceFromHeard('not-a-code'), null);
    assert.equal(heardFromLabel(null), null);
  });

  it('only a tag on the list is kept; a long or hostile tag is cut and dropped, never shown raw', () => {
    for (const tag of Object.keys(LINK_TAGS)) {
      assert.match(tag, /^[a-z0-9][a-z0-9-]{0,31}$/, `${tag} must pass the database's format check`);
      assert.equal(cleanLinkTag(tag), tag);
      assert.equal(cleanLinkTag(` ${tag.toUpperCase()} `), tag, 'tidied before the list is asked');
      assert.ok(linkTagLabel(tag));
    }
    assert.equal(cleanLinkTag('friend-of-bob'), null);
    assert.equal(cleanLinkTag('<script>alert(1)</script>'), null);
    assert.equal(cleanLinkTag('spring-mailout' + 'x'.repeat(200)), null, 'cut to the database length first, then dropped');
    assert.equal(cleanLinkTag('__proto__'), null);
    assert.equal(cleanLinkTag('constructor'), null);
    assert.equal(cleanLinkTag(undefined), null);
    assert.equal(LINK_TAG_MAX, 32);
  });

  it('a tag since taken off the list reads as "An old link", never its raw text', () => {
    assert.equal(linkTagLabel('retired-tag'), 'An old link');
    assert.equal(linkTagLabel(null), null);
  });
});

describe('Stage 7 Part 8 · a second form from a known address (threat 4)', () => {
  it('"worked" means any step past New, a note, a source, a link, or a plan for the lead', () => {
    assert.equal(isWorkedLead(FRESH, false), false);
    assert.equal(isWorkedLead(FRESH, true), true, 'a note');
    assert.equal(isWorkedLead({ ...FRESH, internal_status: 'contacted' }, false), true, 'a step past New');
    assert.equal(isWorkedLead({ ...FRESH, source: 'search' }, false), true, 'a source');
    assert.equal(isWorkedLead({ ...FRESH, source_words: 'told by a registrar' }, false), true, 'source words');
    assert.equal(isWorkedLead({ ...FRESH, linked_at: '2026-10-27T00:00:00Z' }, false), true, 'a link');
    assert.equal(isWorkedLead({ ...FRESH, converted_org_id: 'org' }, false), true, 'a linked club');
    assert.equal(isWorkedLead({ ...FRESH, last_contacted_at: '2026-10-27T00:00:00Z' }, false), true, 'contacted');
    assert.equal(isWorkedLead({ ...FRESH, next_action: 'Call' }, false), true, 'a next action');
    assert.equal(isWorkedLead({ ...FRESH, follow_up_due_at: '2026-11-01' }, false), true, 'a follow-up');
  });

  it('a lead staff have worked keeps every field; the refill is only a timeline entry', () => {
    const out = decideRefill({ ...FRESH, internal_status: 'qualified' }, true, NEW_WORDS);
    assert.deepEqual(out.patch, {}, 'nothing on the lead changes');
    assert.equal(out.entry.their_words, 'We now have 44 teams.');
    assert.equal(out.entry.heard_from, 'searched', 'their answer is kept on the timeline, never written over staff’s source');
  });

  it('a blank box is not new words: it never wipes what the first form said', () => {
    const out = decideRefill(FRESH, false, { ...NEW_WORDS, role: null, sports: null, notes: null });
    for (const k of ['role', 'sports', 'notes']) assert.ok(!(k in out.patch), `${k} is left alone`);
    assert.equal(out.entry.their_words, null);
  });

  it('a lead nobody has worked takes the visitor’s new words', () => {
    const out = decideRefill(FRESH, false, NEW_WORDS);
    assert.equal(out.patch.name, 'Morgan E.');
    assert.equal(out.patch.notes, 'We now have 44 teams.');
    assert.deepEqual(out.patch.plan_interest, ['club']);
    assert.equal(out.patch.heard_from, 'searched');
  });

  it('where the lead arrived never moves: first page, first tag, first browser, and staff’s source', () => {
    for (const worked of [false, true]) {
      const keys = Object.keys(decideRefill(FRESH, worked, NEW_WORDS).patch);
      for (const never of ['source_path', 'ref_tag', 'user_agent', 'created_at', 'source', 'source_words', 'internal_status']) {
        assert.ok(!keys.includes(never), `${never} is never in a refill's patch (worked: ${worked})`);
      }
    }
  });

  it('a "yes" never replaces a "no", on any lead; the timeline says it was not applied', () => {
    for (const worked of [false, true]) {
      const out = decideRefill({ ...FRESH, release_notifications_consent: false }, worked, { ...NEW_WORDS, consent: true });
      assert.ok(!('release_notifications_consent' in out.patch), `worked: ${worked}`);
      assert.equal(out.entry.yes_not_applied, true);
      assert.equal(out.entry.withdrew_consent, false);
    }
  });

  it('a withdrawal always lands, on a worked lead too', () => {
    for (const worked of [false, true]) {
      const out = decideRefill(FRESH, worked, { ...NEW_WORDS, consent: false });
      assert.equal(out.patch.release_notifications_consent, false, `worked: ${worked}`);
      assert.equal(out.entry.withdrew_consent, true);
    }
  });

  it('a form with no consent box (the coach form) never changes consent either way', () => {
    for (const lead of [FRESH, { ...FRESH, release_notifications_consent: false }]) {
      for (const worked of [false, true]) {
        const out = decideRefill(lead, worked, { ...NEW_WORDS, consent: undefined });
        assert.ok(!('release_notifications_consent' in out.patch));
        assert.equal(out.entry.yes_not_applied, false);
        assert.equal(out.entry.withdrew_consent, false);
      }
    }
  });
});

describe('Stage 7 Part 8 · the early-access route (threats 4, 10)', () => {
  const route = readCode('app/api/early-access/route.ts');

  it('is throttled before it reads anything, in buckets apart from the family forms', () => {
    assert.match(route, /throttleLeadForm\(req\)/);
    assert.ok(route.indexOf('throttleLeadForm(req)') < route.indexOf('req.json()'), 'the throttle comes first');
    const throttle = readCode('lib/public-form-throttle.ts');
    assert.match(throttle, /const leadIpLimiter = new FixedWindowRateLimiter/);
    assert.match(throttle, /const leadGlobalLimiter = new FixedWindowRateLimiter/);
  });

  it('a lost first-insert race reads as a known address; a refill is kept after the lead, never before it', () => {
    assert.match(route, /error\.code !== '23505'/);
    assert.ok(route.indexOf('.update({') < route.indexOf("from('early_access_lead_submissions')"), 'the lead is updated before its dated entry');
    assert.match(route, /if \(entryError\) await captureError\(entryError\)/, 'a missing entry is logged, never shown: a known address answers as an unknown one');
    const coach = readCode('lib/basic-coach-interest.ts');
    assert.ok(coach.indexOf('.update(worked') < coach.indexOf("from('early_access_lead_submissions')"));
  });

  it('text the database refuses (NUL, a lone surrogate) is cleaned, and a body of null does not throw', () => {
    assert.match(route, /replace\(\/\\u0000\/g, ''\)\.toWellFormed\(\)/);
    assert.match(route, /\(await req\.json\(\)\.catch\(\(\) => null\)\) \?\? \{\}/);
  });

  it('never prints the database’s words: no error.message in a response, a fixed sentence instead', () => {
    assert.doesNotMatch(route, /error\.message|Error\.message|\.message\s*\}/);
    assert.match(route, /COULD_NOT_SAVE/);
    assert.match(route, /captureAndJson/, 'the real cause still goes to the error log');
  });

  it('answers a known address and an unknown one the same way', () => {
    const ok = route.match(/NextResponse\.json\(\{ ok: true \}\)/g) ?? [];
    assert.ok(ok.length >= 3, 'honeypot, new lead and refill all answer { ok: true }');
    assert.doesNotMatch(route, /alreadyExists|already_exists|known:\s*true/i);
  });

  it('keeps the visitor’s tag and answer only through the lists, and never writes a refill over a worked lead', () => {
    assert.match(route, /cleanHeardFrom\(body\.heardFrom\)/);
    assert.match(route, /cleanLinkTag\(body\.refTag\)/);
    assert.match(route, /decideRefill\(/);
    assert.match(route, /isWorkedLead\(/);
    assert.match(route, /\.update\(\{\s*\.\.\.outcome\.patch,/, 'a refill writes only the rule’s patch, so the first page is never rewritten');
  });

  it('a coach team’s interest button follows the same rule (not a back door)', () => {
    const coach = readCode('lib/basic-coach-interest.ts');
    assert.match(coach, /isWorkedLead\(/);
    assert.match(coach, /early_access_lead_submissions/);
    assert.match(coach, /worked\s*\n?\s*\?\s*\{ updated_at: now, last_submitted_at: now, submission_count/);
  });
});

describe('Stage 7 Part 8 · the forms, the tag, and what is not stored (threat 16)', () => {
  it('both forms send the optional answer and the tag, and the answer carries no star', () => {
    for (const f of ['components/EarlyAccessForm.tsx', 'components/coaches/CoachStartInterest.tsx']) {
      const code = readCode(f);
      assert.match(code, /heardFrom/, f);
      assert.match(code, /readRefTag\(\)/, f);
      assert.match(code, /How did you hear about us\?<\/span>/, f);
      assert.doesNotMatch(code, /How did you hear about us\?[^<]*\*/, `${f}: optional questions carry no star`);
      assert.match(code, /<option value="">Choose one<\/option>/, f);
    }
  });

  it('the tag lives in this tab only: session storage, no cookie, no other storage, no referrer', () => {
    const code = readCode('lib/ref-tag-client.ts');
    assert.match(code, /sessionStorage/);
    assert.doesNotMatch(code, /document\.cookie|localStorage|document\.referrer|indexedDB/);
    assert.match(readCode('app/layout.tsx'), /<RefTagCapture \/>/);
  });

  it('migration 402 keeps nothing about the visitor’s device and grants the server its own access', () => {
    const sql = readCode('supabase/migrations/402_a_second_form_is_kept_dated.sql');
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.early_access_lead_submissions FROM anon, authenticated/);
    assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.early_access_lead_submissions TO service_role/);
    const statements = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
    assert.doesNotMatch(statements, /user_agent|ip_address|referrer|device/i);
  });

  it('the timeline dates every refill from the stored rows', () => {
    const code = readCode('lib/lead-timeline.ts');
    assert.match(code, /early_access_lead_submissions/);
    assert.match(code, /key: `refill:\$\{r\.id\}`/);
    assert.match(code, /Ticked yes to release emails\. The lead still says no\./);
  });
});

describe('Stage 7 Part 8 · Numbers: By link tag', () => {
  const lead = (over: Partial<LeadFacts>): LeadFacts => ({
    id: 'l', createdAt: '2026-08-04T21:48:00Z', step: 'new', linkedAt: null, signedUpAt: null, orgId: null, linkMethod: null,
    plans: ['league'], sourcePath: '/start/league', source: null, refTag: null, followUpDueAt: null,
    stepChangedAt: '2026-10-25T00:00:00Z', lastNoteAt: null, lastFollowUpSetAt: null, demo: false, ...over,
  });
  const PAY: PayRead = { kind: 'read', paying: new Set() };
  const ACCOUNTS = { kind: 'read' as const, created: [] };
  const run = (leads: LeadFacts[]) => leadNumbers(leads, { from: null, to: null }, PAY, ACCOUNTS, new Set());

  it('with no tag used anywhere, the table is not drawn', () => {
    assert.deepEqual(run([lead({ id: 'a' }), lead({ id: 'b' })]).byTag, []);
  });

  it('once a tag is used (a stored tag not on the list reads "An old link"), "No tag" is the first row so the tagged rows are not mistaken for all of them', () => {
    const rows = run([lead({ id: 'a' }), lead({ id: 'b', refTag: 'a-mailout' }), lead({ id: 'c', refTag: 'a-mailout' })]).byTag;
    assert.deepEqual(rows.map(r => [r.label, r.leads]), [['No tag', 1], ['An old link', 2]]);
  });

  it('a filtered view never draws an empty "No tag" row', () => {
    const rows = run([lead({ id: 'b', refTag: 'a-mailout' })]).byTag;
    assert.deepEqual(rows.map(r => r.label), ['An old link']);
  });

  it('the export says whether a Source is staff’s or the form’s', () => {
    assert.match(readCode('app/api/platform-admin/early-access/export/route.ts'), /'Source recorded by'/);
    assert.match(readCode('lib/lead-book.ts'), /sourceFromForm: !r\.source && !!sourceFromHeard\(r\.heard_from\)/);
  });

  it('a lead’s Source is its staff source, else its visitor answer, and the book maps it that way', () => {
    assert.match(readCode('lib/lead-book.ts'), /source: r\.source \?\? sourceFromHeard\(r\.heard_from\)/);
  });
});
