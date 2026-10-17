/**
 * THE TEAM-UPDATE SWEEP'S SMALLER FINDINGS (security fix, 2026-10-16), each a write that stored what it was sent:
 *  - a division's contact member, a club ledger's tournament and a ledger entry's payee are now this organization's
 *    (lib/org-references.ts) — checked before the write;
 *  - deleting a team respects the completed-event lock, as every other write in the teams route does;
 *  - Add team's status is one a team can have, as the update checks it.
 * Source scans: each check sits before its write and refuses.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };
const after = (src: string, from: string, to?: string) => {
  const a = at(src, from);
  return to ? src.slice(a, at(src.slice(a + 1), to) + a + 1) : src.slice(a);
};

describe('a row the write names is this organization’s', () => {
  it('a division’s contact member — on create and on update', () => {
    const route = readCode('app/api/admin/divisions/route.ts');
    assert.match(route, /async function contactMemberRefused\(orgId: string, memberId: unknown\)[\s\S]*?if \(await memberInOrg\(orgId, memberId\)\) return null;\s*return Response\.json\(\{ error: ORG_REFERENCE_REFUSALS\.member \}, \{ status: 400 \}\);/);
    const save = after(route, "if (action === 'save')", "else if (action === 'update' && id)");
    assert.ok(at(save, 'const contactRefused = await contactMemberRefused(ctx.org.id, data.contactMemberId);\n      if (contactRefused) return contactRefused;') < at(save, ".from('divisions').insert("));
    const update = after(route, "else if (action === 'update' && id)");
    assert.ok(at(update, 'const contactRefused = await contactMemberRefused(ctx.org.id, data.contactMemberId);\n      if (contactRefused) return contactRefused;') < at(update, ".from('divisions').update("));
  });

  it('a club ledger’s tournament', () => {
    const route = readCode('app/api/admin/accounting/ledgers/route.ts');
    const post = after(route, 'export const POST');
    assert.ok(at(post, "if (entityType === 'tournament' && !(await tournamentInOrg(ctx!.org.id, entityId))) {\n    return NextResponse.json({ error: ORG_REFERENCE_REFUSALS.tournament }, { status: 400 });") < at(post, ".from('accounting_ledgers')"));
  });

  it('a ledger entry’s payee — on create and on edit', () => {
    const create = after(readCode('app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts'), 'export const POST');
    assert.ok(at(create, 'if (payeeId && !(await payeeInOrg(ctx!.org.id, payeeId))) {\n    return NextResponse.json({ error: ORG_REFERENCE_REFUSALS.payee }, { status: 400 });') < at(create, 'const entry = await createEntry('));
    const edit = readCode('app/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]/route.ts');
    assert.ok(at(edit, 'if (input.payeeId && !(await payeeInOrg(ctx!.org.id, input.payeeId))) {\n      return NextResponse.json({ error: ORG_REFERENCE_REFUSALS.payee }, { status: 400 });') < at(edit, 'updateEntry('));
  });

  it('the shared check reads the row by id AND organization', () => {
    const lib = readCode('lib/org-references.ts');
    assert.match(lib, /\.from\(table\)\.select\('id'\)\.eq\('id', id\)\.eq\(orgColumn, orgId\)\.maybeSingle\(\)/);
    assert.match(lib, /memberInOrg = \(orgId: string, memberId: unknown\) => ownedBy\('organization_members', 'organization_id', memberId, orgId\)/);
    assert.match(lib, /tournamentInOrg = \(orgId: string, tournamentId: unknown\) => ownedBy\('tournaments', 'org_id', tournamentId, orgId\)/);
    assert.match(lib, /payeeInOrg = \(orgId: string, payeeId: unknown\) => ownedBy\('org_payees', 'org_id', payeeId, orgId\)/);
  });
});

describe('the teams route', () => {
  const route = readCode('app/api/admin/teams/route.ts');

  it('deleting a team refuses a completed tournament, before the delete', () => {
    const del = after(route, 'export const DELETE');
    assert.ok(at(del, 'if (await isTournamentLocked(tId)) return tournamentLockedResponse();') < at(del, ".from('teams').delete()"));
  });

  it('Add team’s status is one a team can have, before the insert', () => {
    const create = after(route, "if (body.action === 'create-team')", "const read = readTeamUpdates(body);");
    assert.ok(at(create, 'if (team.status !== undefined && !TEAM_STATUSES.has(team.status)) return badUpdate(TEAM_UPDATE_REFUSALS.status);') < at(create, ".from('teams').insert("));
  });
});
