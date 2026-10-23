import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  checkTryoutContactEmail,
  tryoutContactNudge,
  liveTryoutContactEmail,
  tryoutStateShowsCoachContact,
  publicPersonName,
  tryoutContactUnsetLine,
  tryoutContactSetLine,
  SIGN_IN_ADDRESS_NOTE,
  NOT_AN_ADDRESS,
  TRYOUT_ROLE_ADDRESS_NUDGE,
  type TryoutContactRow,
  type TryoutContactSetter,
} from '../../lib/tryout-contact-rules.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Club Tier Stage 4c-2 Part B — the head coach's tryout questions address (Asks 1–3, ruled 2026-10-22).
 *
 * One address per team. Any head coach sets it; it belongs to whoever set it and ENDS WITH THEIR HEAD-COACH ROLE —
 * removed or demoted — twice over: the membership writes clear it, and every reader shows it only while the setter is
 * an active head coach of the team. The sign-in address is allowed, with a note. Words: CLUB_TIER_STAGE4C2_COPY.md §H.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TEAM = 'team-1';
const row = (over: Partial<TryoutContactRow> = {}): TryoutContactRow => ({
  email: 'tryouts@lynx.ca', setByMembershipId: 'm-dana', ...over,
});
const dana = (over: Partial<TryoutContactSetter> = {}): TryoutContactSetter => ({
  id: 'm-dana', teamId: TEAM, coachRole: 'head_coach', status: 'active', ...over,
});

describe('the address a head coach types (H5, H6, H7)', () => {
  it('a valid address is kept, trimmed', () => {
    assert.deepEqual(checkTryoutContactEmail('  tryouts@lynx.ca '), { ok: true, value: 'tryouts@lynx.ca' });
  });
  it('the sign-in address is ALLOWED and gets a quiet note, compared trimmed and ignoring case (owner 2026-10-23)', () => {
    assert.deepEqual(checkTryoutContactEmail(' Dana@Home.CA '), { ok: true, value: 'Dana@Home.CA' });
    assert.equal(tryoutContactNudge('Dana@Home.CA', ' dana@home.ca '), SIGN_IN_ADDRESS_NOTE);
    assert.equal(tryoutContactNudge('dana@home.ca', 'someone@else.ca'), null);
    assert.match(SIGN_IN_ADDRESS_NOTE, /sign in with/);
  });
  it('a malformed address is refused with the shared words', () => {
    assert.deepEqual(checkTryoutContactEmail('dana at home'), { ok: false, error: NOT_AN_ADDRESS });
    assert.equal(NOT_AN_ADDRESS, "That doesn't look like an email address.");
  });
  it('blank is refused here — removing is its own door, never a part-typed save', () => {
    assert.equal(checkTryoutContactEmail('   ').ok, false);
    assert.equal(checkTryoutContactEmail(undefined).ok, false);
  });
  it('an address that could carry extra mailto fields is refused', () => {
    assert.equal(checkTryoutContactEmail('a@b.ca?cc=x@y.ca').ok, false);
  });
  it('the nudge is for a personal-looking address and is never a refusal', () => {
    assert.equal(tryoutContactNudge('dana.whitfield@gmail.com'), TRYOUT_ROLE_ADDRESS_NUDGE);
    assert.equal(tryoutContactNudge('tryouts@lynx.ca'), null);
    assert.equal(checkTryoutContactEmail('dana.whitfield@gmail.com').ok, true);
    assert.match(TRYOUT_ROLE_ADDRESS_NUDGE, /tryouts@/);
  });
});

describe('it ends with the setter\'s head-coach role (Ask 1)', () => {
  it('shows while the setter is an active head coach of this team', () => {
    assert.equal(liveTryoutContactEmail(row(), dana(), TEAM), 'tryouts@lynx.ca');
  });
  it('removal: a revoked seat shows nothing', () => {
    assert.equal(liveTryoutContactEmail(row(), dana({ status: 'revoked' }), TEAM), null);
  });
  it('demotion: an assistant seat shows nothing', () => {
    assert.equal(liveTryoutContactEmail(row(), dana({ coachRole: 'assistant_coach' }), TEAM), null);
  });
  it('a second head coach: the address belongs to whoever set it, never the reader', () => {
    // Pat (another head coach) is not the setter — the row still reads Dana's seat, and only Dana's seat counts.
    const pat = dana({ id: 'm-pat' });
    assert.equal(liveTryoutContactEmail(row(), pat, TEAM), null);
  });
  it('a membership deleted with its user (NULL setter) reads as unset', () => {
    assert.equal(liveTryoutContactEmail(row({ setByMembershipId: null }), null, TEAM), null);
  });
  it('another team\'s seat never counts', () => {
    assert.equal(liveTryoutContactEmail(row(), dana({ teamId: 'team-2' }), TEAM), null);
  });
  it('the club\'s reset: no address, so nothing shows', () => {
    assert.equal(liveTryoutContactEmail(row({ email: null, setByMembershipId: null }), null, TEAM), null);
  });
});

describe('the membership writes clear it (Ask 1, twice over)', () => {
  const src = readFileSync('lib/coach-membership.ts', 'utf8');
  const fn = (name: string) => {
    const start = src.indexOf(`export async function ${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    const next = src.indexOf('\nexport ', start + 10);
    return src.slice(start, next < 0 ? undefined : next);
  };
  it('removal clears the address it set, after the last-head-coach re-check, keyed on the seat whatever was revoked', () => {
    const body = fn('removeStaffMember');
    const clear = body.indexOf("if (seatId) await clearTryoutContactOf(teamId, seatId, 'removal')");
    assert.ok(clear > 0, 'removeStaffMember clears the address');
    assert.ok(clear > body.indexOf("return 'last_head';\n  }\n\n"), 'after the race restore, so an undone removal keeps it');
    assert.match(body, /addStaffMember\(\{ orgId, teamId, userId, coachRole: 'head_coach', keepTryoutContact: true \}\)/);
  });
  it('removal turns the name switch off (owner ruling 2026-10-22)', () => {
    assert.match(fn('removeStaffMember'), /status: 'revoked'[^\n]*show_name_public: false/);
  });
  it('any role change clears the address it set — last, after the second check and the projection', () => {
    const body = fn('setStaffMemberRole');
    const clear = body.indexOf("await clearTryoutContactOf(teamId, membershipId, 'role change')");
    assert.ok(clear > 0, 'setStaffMemberRole clears');
    assert.ok(clear > body.lastIndexOf("reason: 'last_head'"), 'after the race restore');
    assert.ok(clear > body.indexOf('await syncLiveSeasonProjection(membership)'), 'a failed clear never skips the projection');
  });
  it('a re-add or re-promotion never revives an address the seat set before', () => {
    const body = fn('addStaffMember');
    assert.match(body, /if \(!input\.keepTryoutContact\) await clearTryoutContactOf\(membership\.teamId, membership\.id, 'staff add'\)/);
  });
  it('the coach\'s save re-checks the seat after writing, and clears what outlived it', () => {
    const route = readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/tryout-contact/route.ts', 'utf8');
    const put = route.slice(route.indexOf('export const PUT'), route.indexOf('export const DELETE'));
    assert.ok(put.indexOf('getTeamStaffMembershipById(r.membership.id)') > put.indexOf('await setTryoutContact('));
    assert.match(put, /clearTryoutContactSetBy\(r\.team\.id, r\.membership\.id\)/);
  });

  it('the club\'s reset records when and who, and a coach setting again clears that note', () => {
    const lib = readFileSync('lib/coach-tryout-contact.ts', 'utf8');
    assert.match(lib, /reset_at: now, reset_by: resetBy/);
    assert.match(lib, /set_at: new Date\(\)\.toISOString\(\),\s*reset_at: null,\s*reset_by: null/);
    // The club's reset only resets the address its window showed, and its setter (a coach's change since is kept).
    assert.match(lib, /email !== expectedEmail\) return 'changed'/);
    assert.match(lib, /\.eq\('set_by_membership_id', setter\.id\)/);
    // The clear (a leaf module) touches only the address THIS membership set, and never the club's reset note.
    const clear = readFileSync('lib/coach-tryout-contact-clear.ts', 'utf8');
    assert.match(clear, /\.eq\('set_by_membership_id', membershipId\)/);
    assert.doesNotMatch(clear, /reset_at|reset_by/);
  });
  it('the public read never falls back to the account email for a name', () => {
    const lib = readFileSync('lib/coach-tryout-contact.ts', 'utf8');
    const pub = lib.slice(lib.indexOf('export async function getPublicTryoutContact'), lib.indexOf('export async function setTryoutContact'));
    assert.match(pub, /publicPersonName\(\(await getOrgMemberDisplayNames\(orgId, \[live\.setter\.userId\]\)\)\[live\.setter\.userId\]\)/);
    assert.doesNotMatch(pub, /resolveCoachUserIdentities|\.email \?\?/);
  });
});

describe('the row\'s status line (H2, H2b, H4, H8, H10)', () => {
  const NOW = '2026-10-22T16:00:00Z';
  it('nothing set: where questions go now', () => {
    assert.equal(tryoutContactUnsetLine('info@lynx.ca', null, NOW),
      'They go to the club (info@lynx.ca). Add your own address for this team’s tryout page.');
    assert.equal(tryoutContactUnsetLine(null, null, NOW),
      'The page shows no questions address yet. Add your own for this team’s tryout page.');
  });
  it('an assistant (H9) reads where questions go, never the invitation to set one', () => {
    assert.equal(tryoutContactUnsetLine('info@lynx.ca', null, NOW, false), 'They go to the club (info@lynx.ca).');
    assert.equal(tryoutContactUnsetLine(null, null, NOW, false), 'The page shows no questions address yet.');
    assert.equal(tryoutContactUnsetLine('info@lynx.ca', '2026-10-22T13:00:00Z', NOW, false),
      'The club put its own address back on Oct 22. Questions go to info@lynx.ca.');
  });
  it('the club put its own back: the date, no year this year', () => {
    assert.equal(tryoutContactUnsetLine('info@lynx.ca', '2026-10-22T13:00:00Z', NOW),
      'The club put its own address back on Oct 22. Questions go to info@lynx.ca. You can set your own again.');
  });
  it('the club put its own back last year: the year shows', () => {
    assert.match(tryoutContactUnsetLine('info@lynx.ca', '2025-10-22T13:00:00Z', NOW), /on Oct 22, 2025\./);
  });
  it('set: by you, or by another head coach', () => {
    assert.equal(tryoutContactSetLine('tryouts@lynx.ca', true, 'Dana Whitfield'), 'tryouts@lynx.ca · on your tryout page');
    assert.equal(tryoutContactSetLine('tryouts@lynx.ca', false, 'Dana Whitfield'), 'tryouts@lynx.ca · set by Dana Whitfield');
  });
});

describe('a name as a public page prints it', () => {
  it('trimmed; blank and address-shaped names are left out', () => {
    assert.equal(publicPersonName('  Dana Whitfield '), 'Dana Whitfield');
    assert.equal(publicPersonName(''), null);
    assert.equal(publicPersonName(null), null);
    assert.equal(publicPersonName('dana@home.ca'), null);
  });
});

describe('which tryout states carry the coach\'s line (Ask 3)', () => {
  it('open and not open yet', () => {
    assert.equal(tryoutStateShowsCoachContact('open'), true);
    assert.equal(tryoutStateShowsCoachContact('notOpenYet'), true);
  });
  it('finished and closed keep the club\'s line', () => {
    assert.equal(tryoutStateShowsCoachContact('finished'), false);
    assert.equal(tryoutStateShowsCoachContact('closed'), false);
  });
});
