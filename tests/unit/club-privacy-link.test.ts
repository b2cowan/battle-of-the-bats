/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY 4.P — A CLUB SETS ITS OWN PRIVACY LINK (owner 2026-11-21; rulings: "Owner and admin", "Show it on the log",
 * the words as drafted).
 *
 *   1. The ONE scheme rule, as behaviour: the setting accepts https and http, refuses `javascript:`, `data:` and a bare
 *      word, trims, clears on empty, caps the length; the readers' seam still shows nothing for a bad stored value.
 *   2. The audit line's change ("added" / "changed" / "removed"), judged by what families saw.
 *   3. The route: owner or admin only, refused server-side; validates with the seam; a clear stores null; a real change
 *      writes ONE audit line holding `{ change }` and never the address; a same-value save writes nothing.
 *   4. The owner's log shows it (the sentence).
 *   5. The three family-facing doors still read the link through the seam, and the stored text is only ever an `<a href>`.
 *   6. The screen: the card on Settings for the owner and the admin, its field showing the route's (seam-read) value.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, functionBody } from './_source-code.ts';
import {
  getOrgPrivacyPolicyHref, parsePrivacyPolicyInput, privacyLinkChange, PRIVACY_POLICY_URL_MAX, PRIVACY_POLICY_WORDS,
} from '../../lib/privacy-policy.ts';
import { auditChangeSentence, AUDIT_LOG_ACTIONS, PRIVACY_LINK_AUDIT_ACTION } from '../../lib/member-audit.ts';

const ROUTE = 'app/api/admin/org-settings/privacy-policy/route.ts';

describe('the setting checks the address by the seam’s own rule', () => {
  it('accepts https and http, trimmed', () => {
    assert.deepEqual(parsePrivacyPolicyInput('  https://club.example/privacy  '), { ok: true, value: 'https://club.example/privacy' });
    assert.deepEqual(parsePrivacyPolicyInput('http://club.example/privacy'), { ok: true, value: 'http://club.example/privacy' });
  });
  it('refuses javascript:, data:, a bare word and a schemeless address with the one sentence', () => {
    for (const bad of [
      'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'privacy', 'club.example/privacy', 'ftp://club.example/p', 'mailto:a@b.c',
      // /review 4.P: Node reads these as https://club.example/, a browser on our https page as a path on OUR site.
      'https:club.example/privacy', 'https:/club.example/privacy',
      // A browser strips an inner tab or newline, so what is stored would not be what opens.
      'https://club.exa\tmple/privacy', 'https://club.example/pri\nvacy', 'https://club.example/a b',
      // No credentials in a family-facing link.
      'https://user:pass@club.example/privacy', 'https://user@club.example/privacy',
    ]) {
      assert.deepEqual(parsePrivacyPolicyInput(bad), { ok: false, error: PRIVACY_POLICY_WORDS.badScheme }, bad);
    }
    assert.deepEqual(parsePrivacyPolicyInput(42), { ok: false, error: PRIVACY_POLICY_WORDS.badScheme });
  });
  it('empty, blank or null clears (null)', () => {
    for (const empty of ['', '   ', null, undefined]) assert.deepEqual(parsePrivacyPolicyInput(empty), { ok: true, value: null });
  });
  it('caps the length', () => {
    const long = `https://club.example/${'a'.repeat(PRIVACY_POLICY_URL_MAX)}`;
    assert.deepEqual(parsePrivacyPolicyInput(long), { ok: false, error: PRIVACY_POLICY_WORDS.tooLong });
    const fits = `https://e.x/${'a'.repeat(PRIVACY_POLICY_URL_MAX - 'https://e.x/'.length)}`;
    assert.equal(fits.length, PRIVACY_POLICY_URL_MAX);
    assert.deepEqual(parsePrivacyPolicyInput(fits), { ok: true, value: fits });
  });
  it('the readers’ seam still returns null for a bad stored value, and the link for a good one', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'privacy', '', '   ']) {
      assert.equal(getOrgPrivacyPolicyHref({ privacyPolicyUrl: bad }), null, bad);
    }
    assert.equal(getOrgPrivacyPolicyHref({ privacyPolicyUrl: null }), null);
    assert.equal(getOrgPrivacyPolicyHref(null), null);
    assert.equal(getOrgPrivacyPolicyHref({ privacyPolicyUrl: ' https://club.example/p ' }), 'https://club.example/p');
  });
  it('the setting and the seam agree on every address (one rule, not two)', () => {
    for (const v of ['https://a.b/c', 'http://a.b', 'javascript:x', 'data:x', 'word', 'a.b/c']) {
      const parsed = parsePrivacyPolicyInput(v);
      assert.equal(parsed.ok ? parsed.value : null, getOrgPrivacyPolicyHref({ privacyPolicyUrl: v }), v);
    }
  });
});

describe('the audit line says what families saw change', () => {
  it('added, changed, removed', () => {
    assert.equal(privacyLinkChange(null, 'https://a.b/p'), 'added');
    assert.equal(privacyLinkChange('https://a.b/old', 'https://a.b/new'), 'changed');
    assert.equal(privacyLinkChange('https://a.b/p', null), 'removed');
    // An unsafe value left by the old operator path showed no link, so replacing it is an addition.
    assert.equal(privacyLinkChange('javascript:alert(1)', 'https://a.b/p'), 'added');
  });
  it('nothing to log when families see no difference', () => {
    assert.equal(privacyLinkChange('javascript:alert(1)', null), null);
    assert.equal(privacyLinkChange('', null), null);
    assert.equal(privacyLinkChange('  ', null), null);
    assert.equal(privacyLinkChange(' https://a.b/p ', 'https://a.b/p'), null);
    assert.equal(privacyLinkChange(null, null), null);
  });
  it('the owner’s log lists it, in words', () => {
    assert.ok((AUDIT_LOG_ACTIONS as readonly string[]).includes(PRIVACY_LINK_AUDIT_ACTION));
    assert.equal(auditChangeSentence(PRIVACY_LINK_AUDIT_ACTION, { change: 'added' }), 'Privacy policy link added');
    assert.equal(auditChangeSentence(PRIVACY_LINK_AUDIT_ACTION, { change: 'changed' }), 'Privacy policy link changed');
    assert.equal(auditChangeSentence(PRIVACY_LINK_AUDIT_ACTION, { change: 'removed' }), 'Privacy policy link removed');
  });
});

describe('the route', () => {
  const code = readCode(ROUTE);
  const seat = functionBody(code, 'seat');

  it('only the owner or an admin, refused on the server for every other seat', () => {
    assert.match(seat, /if \(!ctx\) return \{ ctx: null, refused: unauthorized\(\) \};/);
    assert.match(seat, /if \(ctx\.role !== 'owner' && ctx\.role !== 'admin'\) return \{ ctx: null, refused: forbidden\(\) \};/);
    // Both methods go through the one seat check before anything else.
    const get = code.slice(code.indexOf('export const GET'), code.indexOf('export const PATCH'));
    const patch = code.slice(code.indexOf('export const PATCH'));
    for (const body of [get, patch]) {
      assert.ok(body.indexOf('await seat(req)') >= 0 && body.indexOf('await seat(req)') < body.indexOf('readStored'));
    }
  });
  it('the read answers through the seam, so a bad stored value reads as empty', () => {
    const get = code.slice(code.indexOf('export const GET'), code.indexOf('export const PATCH'));
    assert.match(get, /url: getOrgPrivacyPolicyHref\(\{ privacyPolicyUrl: stored\.raw \}\)/);
  });
  it('the save validates with the seam’s rule, stores the parsed value (null clears), and has no regex of its own', () => {
    const patch = code.slice(code.indexOf('export const PATCH'));
    assert.match(patch, /const parsed = parsePrivacyPolicyInput\(body\.url\);/);
    assert.match(patch, /if \(!parsed\.ok\) return NextResponse\.json\(\{ error: parsed\.error \}, \{ status: 400 \}\);/);
    assert.match(patch, /\.update\(\{ privacy_policy_url: next \}\)/);
    assert.ok(patch.indexOf('parsePrivacyPolicyInput') < patch.indexOf('.update('), 'validated before the write');
    assert.doesNotMatch(code, /https\?|protocol/, 'the scheme rule lives only in lib/privacy-policy.ts');
  });
  it('a visible change writes ONE audit line with { change } only — never the address; a same-value save writes nothing', () => {
    const patch = code.slice(code.indexOf('export const PATCH'));
    const audits = patch.match(/writeOrgAudit\(/g) ?? [];
    assert.equal(audits.length, 1);
    assert.match(patch, /const change = privacyLinkChange\(stored\.raw, next\);\s+if \(change\) await writeOrgAudit\(ctx\.org\.id, ctx\.user\.id, null, PRIVACY_LINK_AUDIT_ACTION, \{ change \}\);/);
    const same = patch.indexOf('=== next) return');
    assert.ok(same >= 0 && same < patch.indexOf('.update(') && same < patch.indexOf('writeOrgAudit('));
    assert.ok(patch.indexOf('if (error)') < patch.indexOf('writeOrgAudit('), 'the line follows a successful write');
  });
  it('the write lands only on the value this request read (two tabs never overwrite blind), and a lost race logs nothing', () => {
    const patch = code.slice(code.indexOf('export const PATCH'));
    assert.match(patch, /write = stored\.raw === null \? write\.is\('privacy_policy_url', null\) : write\.eq\('privacy_policy_url', stored\.raw\);/);
    const lost = patch.indexOf('if (!written?.length)');
    assert.ok(lost >= 0 && lost < patch.indexOf('writeOrgAudit('));
    const lostBranch = patch.slice(lost, patch.indexOf('const change ='));
    assert.match(lostBranch, /getOrgPrivacyPolicyHref\(\{ privacyPolicyUrl: now\.raw \}\)/, 'answers the stored value through the seam');
    assert.doesNotMatch(lostBranch, /writeOrgAudit/);
  });
});

describe('the three family-facing doors read the link through the seam', () => {
  const READERS = [
    'app/[orgSlug]/league/[seasonSlug]/register/page.tsx',
    'app/[orgSlug]/teams/[teamSlug]/tryouts/register/page.tsx',
    'app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx',
  ];
  it('the sign-up pages pass getOrgPrivacyPolicyHref(org), never the raw field', () => {
    for (const rel of READERS) {
      const code = readCode(rel);
      assert.match(code, /getOrgPrivacyPolicyHref\(org\)/, rel);
      assert.doesNotMatch(code, /privacyPolicyUrl|privacy_policy_url/, rel);
    }
  });
  it('the guardian accept page’s sender reads the column only into the seam', () => {
    const code = readCode('lib/family-invitation.ts');
    assert.match(code, /privacyNoticeUrl: getOrgPrivacyPolicyHref\(\{ privacyPolicyUrl: org\?\.privacy_policy_url \}\)/);
    const uses = code.match(/privacy_policy_url/g) ?? [];
    // The select, the row's type, and the seam call — nowhere else.
    assert.equal(uses.length, 3);
  });
  it('the doors render the link only as an <a href> that opens a new tab', () => {
    assert.match(readCode('components/league/SignupFormFields.tsx'), /<a href=\{privacyUrl\} target="_blank" rel="noopener/);
    assert.match(readCode('components/rep-teams/TryoutRegisterForm.tsx'), /href=\{privacyPolicyHref\}\s+target="_blank"\s+rel="noopener noreferrer"/);
    assert.match(readCode('app/(consumer)/family/claim/[token]/ClaimClient.tsx'), /href=\{club\.privacyNoticeUrl\} target="_blank" rel="noopener noreferrer"/);
  });
  it('the org mapper still hands the readers the column as privacyPolicyUrl', () => {
    const db = readCode('lib/db.ts');
    assert.match(db, /privacyPolicyUrl:\s+r\.privacy_policy_url \?\? null/);
  });
});

describe('the screen', () => {
  const kit = readCode('components/admin/kit/club/SettingsKit.tsx');
  const card = readCode('components/admin/kit/club/PrivacyPolicyCard.tsx');

  it('the card shows for the owner and the admin, and for no one else', () => {
    const adminBranch = kit.slice(kit.indexOf("if (userRole === 'admin') {\n    return ("), kit.indexOf("if (userRole !== 'owner') return <NotYours"));
    assert.match(adminBranch, /<PrivacyPolicyCard orgQuery=\{orgQuery\} initial=\{privacy\} \/>/);
    const ownerPage = kit.slice(kit.indexOf("if (userRole !== 'owner') return <NotYours"));
    assert.match(ownerPage, /<PrivacyPolicyCard orgQuery=\{orgQuery\} initial=\{privacy\} \/>/);
    // Every other seat stops at the one "not yours" screen before either.
    assert.ok(kit.indexOf("if (userRole !== 'owner') return <NotYours") < kit.lastIndexOf('<PrivacyPolicyCard'));
  });
  it('the field starts from the route’s seam-read value and checks with the same rule before sending', () => {
    assert.match(card, /fetch\(`\/api\/admin\/org-settings\/privacy-policy\$\{orgQuery\}`\)/);
    assert.match(card, /const parsed = parsePrivacyPolicyInput\(draft\);/);
    assert.match(card, /body: JSON\.stringify\(\{ url: parsed\.value \}\)/);
    // The save pill reads the real dirty state, so a refused save never reads "Saved" (/review 4.P).
    assert.match(card, /<SavePill saving=\{saving\} dirty=\{dirty\} error=\{saveError\}/);
    // A failed read says so, never an empty field.
    assert.match(card, /\{W\.loadFailed\}/);
    // The card never renders the stored address as a link — only as the field's value.
    assert.doesNotMatch(card, /<a\b/);
    assert.doesNotMatch(card, /dangerouslySetInnerHTML/);
  });
  it('the words are the ruled ones', () => {
    assert.equal(PRIVACY_POLICY_WORDS.title, 'Your privacy policy');
    assert.equal(PRIVACY_POLICY_WORDS.label, 'Link to your privacy policy');
    // Terms §4 in its own words (owner ruling after /legal, 2026-11-21).
    assert.match(PRIVACY_POLICY_WORDS.hint, /FieldLogicHQ stores it outside Canada, mainly in the United States\./);
    assert.match(card, /\{W\.label\}/);
    assert.equal(PRIVACY_POLICY_WORDS.badScheme, 'Enter a web address that starts with https:// or http://.');
    assert.equal(PRIVACY_POLICY_WORDS.tooLong, 'That web address is too long.');
    assert.match(card, /\{W\.title\}/);
    assert.match(card, /\{W\.hint\}/);
  });
});
