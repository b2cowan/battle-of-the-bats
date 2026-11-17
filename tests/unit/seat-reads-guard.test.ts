/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * INSIDE-CLUB SEAT READS — Board Ready W2 fix E (access sweep 3, findings 4 + 5 and the seat smalls).
 *
 * Fix A put the tournament-admin reads behind the capability their screen implies. This is the next layer in: a member who
 * rightly opens a screen reads MORE of it than the seat needs. Each read below was cut to what its seat uses:
 *
 *   4  the returning-player scan — past-season guardian names, emails and the child's birth date need `rosterPii`
 *      (owner 2026-11-11); the match itself stays for the Development grant.
 *   5  the tournament team export, and the private admin notes on the Teams read — `manage_registrations`
 *      (or `create_tournaments`, as import allows). Staff keep the team list for schedule and check-in.
 *   -  the scorekeeper feed — no submitter id or email, no game or venue notes (the screen draws none).
 *   -  a permit's file — the Venue library's savers and the Accounting seat (the file can state the hidden fee).
 *   -  the rep-team link and the permits' team list — a member limited to team groups sees and links only those.
 *   -  the house-league registrations search — nothing typed adds a PostgREST condition.
 *   -  Members — an owner's name and title are the owner's; the invite looks an account up across every page.
 *
 * These pin the source (comments stripped) so a refactor that drops a check goes red. The two small rules are pure and run.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import { canManageRegistrations } from '../../lib/registration-access.ts';
import { canOpenPermitDocument } from '../../lib/venue-library.ts';
import { likeOrTerm } from '../../lib/house-league-registrations.ts';

describe('the two small rules', () => {
  it('canManageRegistrations: owners, admins and the capability holders; not tournament staff or volunteers', () => {
    assert.equal(canManageRegistrations('owner', null), true);
    assert.equal(canManageRegistrations('admin', null), true);
    assert.equal(canManageRegistrations('staff', null), false);
    assert.equal(canManageRegistrations('official', null), false);
    assert.equal(canManageRegistrations('coach', null), false);
    assert.equal(canManageRegistrations('staff', { manage_registrations: true }), true);
    assert.equal(canManageRegistrations('staff', { create_tournaments: true }), true);
    assert.equal(canManageRegistrations(null, null), false);
  });

  it('canOpenPermitDocument: a saver or a money seat, nobody else', () => {
    assert.equal(canOpenPermitDocument(true, false), true);
    assert.equal(canOpenPermitDocument(false, true), true);
    assert.equal(canOpenPermitDocument(false, false), false);
  });
});

describe('finding 4: the returning-player scan', () => {
  const code = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/route.ts');
  it('reads rosterPii and withholds the guardian and birth-date fields without it', () => {
    assert.match(code, /seesContacts\s*=\s*Boolean\(assignment\.capabilities\.rosterPii\)/);
    for (const field of ['dateOfBirth', 'guardianFirstName', 'guardianLastName', 'guardianEmail']) {
      assert.match(code, new RegExp(`${field}:\\s*seesContacts \\? prior\\.${field} : null`), `${field} must be withheld without rosterPii`);
    }
    assert.match(code, /contactHidden:\s*true/);
  });
  it('the match still runs on the full identities (the redaction is only on the response)', () => {
    assert.match(code, /matchPriorIdentities\(current\.identity, priors\)/);
  });
  it('the compare card says the details are limited instead of "no birth date on file"', () => {
    const card = readCode('components/coaches/ContinuityCompareCard.tsx');
    assert.match(card, /row\.prior\.contactHidden/);
  });
});

describe('finding 5: tournament staff and the export / admin notes', () => {
  it('the export refuses a member who cannot manage registrations, before the plan event is written', () => {
    const code = readCode('app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts');
    const gate = code.indexOf('canManageRegistrations(ctx.role, ctx.capabilities)');
    assert.ok(gate > 0, 'the export must ask canManageRegistrations');
    assert.ok(gate < code.indexOf('writePlatformEvent({'), 'the gate comes before the first event is written');
  });
  it('the Teams read blanks admin_notes for everyone else', () => {
    const code = readCode('app/api/registrations/route.ts');
    assert.match(code, /mayReadNotes\s*=\s*canManageRegistrations\(ctx\.role, ctx\.capabilities\)/);
    assert.match(code, /admin_notes:\s*mayReadNotes \? r\.admin_notes : null/);
  });
  it('the other team list (schedule, bracket, Teams) blanks them the same way', () => {
    const code = readCode('app/api/admin/teams/route.ts');
    assert.match(code, /mayReadNotes\s*=\s*canManageRegistrations\(ctx\.role, ctx\.capabilities\)/);
    assert.match(code, /adminNotes:\s*mayReadNotes \? t\.admin_notes : null/);
  });
  it('the Teams screen draws neither the Export menu nor the notes for them', () => {
    const page = readCode('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
    assert.match(page, /\{mayManageRegistrations && <ExportMenu/);
    assert.match(page, /showNotes=\{mayManageRegistrations\}/);
    const record = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx');
    assert.match(record, /props\.showNotes && <RecordSection title=\{W\.notes\}>/);
  });
});

describe('the scorekeeper feed', () => {
  const code = readCode('app/api/official/[orgSlug]/score/get-score.ts');
  it('selects and sends no submitter identity and no notes', () => {
    assert.doesNotMatch(code, /score_submitted_by_email/);
    assert.doesNotMatch(code, /score_submitted_by_user_id/);
    assert.doesNotMatch(code, /scoreSubmittedByEmail|scoreSubmittedByUserId/);
    assert.doesNotMatch(code, /\bnotes\b/);
  });
});

describe('the venue permit file', () => {
  it('opens only for a saver or a money seat', () => {
    const code = readCode('app/api/admin/org/permits/document/route.ts');
    assert.match(code, /canOpenPermitDocument\(canSaveVenueLibrary\(g\.ctx\.role, g\.ctx\.capabilities\), canMoveClubMoney\(g\.ctx, g\.ctx\.org\)\)/);
  });
  it('the window draws the name as text, not a button, for a reader who cannot open it', () => {
    assert.match(readCode('components/admin/kit/club/PermitWindows.tsx'), /canOpenPermitDocument\(canSave, money\)/);
  });
  it('the permits "For: One team" list honours the group limit', () => {
    const code = readCode('app/api/admin/org/permits/route.ts');
    assert.match(code, /teamsQ\.in\('group_id', limit\)/);
  });
});

describe('the rep-team link', () => {
  const code = readCode('app/api/admin/teams/rep-team-link/route.ts');
  it('checks the group limit on link, on unlink and on the list', () => {
    assert.ok((code.match(/repGroupScopeGuard\(/g) ?? []).length >= 2, 'POST and DELETE each ask repGroupScopeGuard');
    assert.match(code, /repTeamIdsInGroups\(/);
    // A link save REPLACES the registration's existing link, so POST also asks about the link it would replace.
    const post = code.slice(code.indexOf('export const POST'), code.indexOf('export const DELETE'));
    assert.match(post, /linkedRepTeamIdOfRegistration\(registrationId\)/);
    assert.ok((post.match(/repGroupScopeGuard\(/g) ?? []).length >= 2, 'POST guards the new team and the one it replaces');
  });
});

describe('the coach removing a family connection', () => {
  it('asks first and says plainly that it ends every team', () => {
    const code = readCode('components/coaches/PlayerGuardiansCard.tsx');
    assert.match(code, /on every team/);
    assert.match(code, /onClick=\{\(\) => void removeConnected\(r\)\}/);
    // The Remove button on a CONNECTED row opens the question; only Cancel invite (nobody connected yet) still calls decide.
    assert.match(code, /removeConnected\(r\)\}[^>]*>\s*Remove\s*</);
  });
});

describe('the house-league registrations search', () => {
  // The escape has ONE home (`likeOrTerm`, lib/house-league-registrations.ts, Club Tier Stage 13e): the season's list and Find
  // a child (the cross-season search) both put typed text into a PostgREST `.or()` through it, never a copy of their own.
  it('turns commas, brackets, quotes and dots into the single-character wildcard before the .or()', () => {
    const helper = readCode('lib/house-league-registrations.ts');
    assert.match(helper, /export const likeOrTerm = [^\n]*\.replace\(\/\[,\(\)"\.\]\/g, '_'\)/);
    for (const route of ['app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts', 'app/api/admin/house-league/find/route.ts']) {
      const code = readCode(route);
      assert.match(code, /= likeOrTerm\(/, `${route} escapes through likeOrTerm`);
      assert.doesNotMatch(code, /\.replace\(\/\[,\(\)"\.\]\/g/, `${route} keeps no copy of the escape`);
    }
  });
  it('the replacement leaves no condition separator in a hostile string', () => {
    assert.doesNotMatch(likeOrTerm('x,status.eq.paid)(y'), /[,()".]/);
  });
});

describe('Members', () => {
  it('an owner row keeps its name and title for the owner', () => {
    const code = readCode('app/api/admin/members/[memberId]/route.ts');
    assert.match(code, /\(hasDisplayNameUpdate \|\| hasTitleUpdate\) && target\.role === 'owner' && ctx\.role !== 'owner'\) return ownerRowRefusal\(\)/);
  });
  it('the invite looks an existing account up across every page and fails closed', () => {
    const code = readCode('app/api/admin/members/invite/route.ts');
    assert.match(code, /findAuthUserByEmail\(email\)/);
    assert.doesNotMatch(code, /listUsers/);
  });
});
