/**
 * Settings in both workspaces, Session 2 — names and addresses, both workspaces; More print options (owner rulings A1, A3,
 * A5, A6, A8, A9 and C1–C4, C6, 2026-11-20; build prompt docs/projects/active/SETTINGS_BOTH_WORKSPACES_BUILD_PROMPT.md).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NAME_MAX, cleanName, workspaceNameFor, mayChangeWorkspaceIdentity, birthdayCutoffApplies,
} from '../../lib/workspace-identity.ts';
import {
  PRINT_OPTION_KEYS, PRINT_OPTION_WORDS, cleanPrintOptions, mergePrintOptions, printOptionsOf, type PrintOptions,
} from '../../lib/team-print-options.ts';
import { NAME_AND_ADDRESS_WORDS, TEAM_ORGANIZATION_WORDS } from '../../lib/workspace-identity-words.ts';
import { WEB_ADDRESS_WORDS } from '../../lib/web-address-words.ts';
import { tournamentSettingsTabs } from '../../lib/admin-kit-nav.ts';
import { readCode, readSource } from './_source-code.ts';

type Org = Parameters<typeof birthdayCutoffApplies>[0];
const premium = { accountKind: 'team_workspace', planId: 'team', teamWorkspaceStatus: 'active', enabledAddons: [] } as unknown as Org;
const movedIntoClub = { ...premium, teamWorkspaceStatus: 'org_owned' } as unknown as Org;
const tournament = { accountKind: 'organization', planId: 'tournament', teamWorkspaceStatus: null, enabledAddons: [] } as unknown as Org;
const tournamentPlus = { ...tournament, planId: 'tournament_plus' } as unknown as Org;
const club = { accountKind: 'organization', planId: 'club', teamWorkspaceStatus: null, enabledAddons: [] } as unknown as Org;

describe('the team name (A5, C1): one save renames the team and the workspace', () => {
  it('a name is 1 to 40 characters, trimmed', () => {
    assert.equal(NAME_MAX, 40);
    assert.deepEqual(cleanName('  Riverdale Ridge 14U  '), { name: 'Riverdale Ridge 14U' });
    assert.ok('error' in cleanName('   '));
    assert.ok('error' in cleanName(42));
    assert.ok('error' in cleanName('x'.repeat(41)));
    assert.deepEqual(cleanName('x'.repeat(40)), { name: 'x'.repeat(40) });
  });
  it('the workspace follows as "{team} Coaches Portal"', () => {
    assert.equal(workspaceNameFor('Riverdale Ridge 14U'), 'Riverdale Ridge 14U Coaches Portal');
  });
  it('the database function renames both, and the copies C1 ruled follow, in one transaction', () => {
    const sql = readSource('supabase/migrations/517_a_team_rename_carries_its_workspace.sql');
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.rename_team_workspace\(p_team uuid, p_name text\)/);
    assert.match(sql, /char_length\(v_name\) > 40/);
    assert.match(sql, /UPDATE rep_teams SET name = v_name/);
    assert.match(sql, /UPDATE organizations SET name = v_name \|\| ' Coaches Portal'/);
    assert.match(sql, /UPDATE basic_coach_teams/);
    assert.match(sql, /name = v_old \|\| ' staff'/, 'the chat room follows only while it carries the old name');
    assert.match(sql, /status IN \('pending', 'pending_approval'\)/, 'waiting invites only');
    assert.match(sql, /status NOT IN \('completed', 'archived'\) AND name = v_old \|\| ' ' \|\| year/, 'a live, untouched season label only');
    assert.match(sql, /NOT IN \('org_owned', 'archived'\)/, 'never a club’s team');
    assert.doesNotMatch(sql, /SET slug|slug =/, 'neither web address changes');
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.rename_team_workspace\(uuid, text\) TO service_role/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.rename_team_workspace\(uuid, text\) FROM PUBLIC, anon, authenticated/);
  });
  it('the route renames for the workspace owner only, through the one function', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/route.ts');
    const start = route.indexOf("'name' in body)");
    assert.ok(start > 0, 'the rename branch exists');
    const branch = route.slice(start, route.indexOf("if ('shareClubBook' in body)"));
    assert.ok(branch.length > 0);
    assert.match(branch, /mayChangeWorkspaceIdentity\(ctx\.org, member\?\.role\)/);
    assert.match(branch, /status: 403/);
    assert.match(branch, /cleanName\(body\.name\)/);
    assert.match(branch, /supabaseAdmin\.rpc\('rename_team_workspace', \{ p_team: teamId, p_name: cleaned\.name \}\)/);
  });
});

describe('who changes the Organization rows (A3)', () => {
  it('the owner of a standalone Premium workspace, and no one else', () => {
    assert.equal(mayChangeWorkspaceIdentity(premium, 'owner'), true);
    assert.equal(mayChangeWorkspaceIdentity(premium, 'coach'), false, 'a head coach who is not the owner reads');
    assert.equal(mayChangeWorkspaceIdentity(premium, null), false);
    assert.equal(mayChangeWorkspaceIdentity(movedIntoClub, 'owner'), false, 'a club’s team: its club owns these');
    assert.equal(mayChangeWorkspaceIdentity(tournament, 'owner'), false);
  });
  it('the team settings read serves "canChange" from the caller’s own seat, and nothing for a club’s team', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/route.ts');
    assert.match(route, /scope\.isStandalone \? getAcceptedMember\(ctx\.org\.id, ctx\.user\.id\) : null/);
    assert.match(route, /organization: scope\.isStandalone\s*\? \{\s*canChange: mayChangeWorkspaceIdentity\(ctx\.org, orgMember\?\.role\)/);
  });
  it('a changed organization name is held to 40 on the server too — an older, longer one still saves other settings', () => {
    const route = readCode('app/api/admin/org-settings/route.ts');
    assert.match(route, /if \(trimmed !== org\.name && trimmed\.length > NAME_MAX\)/);
  });
});

describe('when birthdays count from (A6): opens for a Premium workspace, never for a Tournament plan', () => {
  it('the gate', () => {
    assert.equal(birthdayCutoffApplies(premium), true);
    assert.equal(birthdayCutoffApplies(movedIntoClub), false);
    assert.equal(birthdayCutoffApplies(tournament), false);
    assert.equal(birthdayCutoffApplies(tournamentPlus), false);
    assert.equal(birthdayCutoffApplies(club), true);
  });
  it('the route reads and writes through that one gate, owner only', () => {
    const route = readCode('app/api/admin/org-settings/birthday-cutoffs/route.ts');
    assert.match(route, /import \{ birthdayCutoffApplies as appliesTo \} from '@\/lib\/workspace-identity';/);
    assert.equal(route.match(/if \(ctx\.role !== 'owner'\) return forbidden\(\);/g)?.length, 2);
    assert.equal(route.match(/appliesTo\(ctx\.org\)/g)?.length, 2);
  });
});

describe('More print options (A8, C2, C3): six rows, saved by Save look, the owner’s', () => {
  const base: PrintOptions = {
    showPageNumbers: true, showDateStamp: true, showBranding: true, orientation: 'portrait', reportDensity: 'readable',
    includeGuardianContacts: true,
  };
  it('six keys — Player notes is not one (no printout reads it, C2)', () => {
    assert.deepEqual([...PRINT_OPTION_KEYS].sort(), Object.keys(base).sort());
    assert.ok(!(PRINT_OPTION_KEYS as readonly string[]).includes('includePlayerNotes'));
    assert.doesNotMatch(JSON.stringify(PRINT_OPTION_WORDS), /Player notes/);
  });
  it('a save is checked whole', () => {
    assert.deepEqual(cleanPrintOptions(base), { print: base });
    assert.ok('error' in cleanPrintOptions({ ...base, orientation: 'sideways' }));
    assert.ok('error' in cleanPrintOptions({ ...base, reportDensity: 'tiny' }));
    assert.ok('error' in cleanPrintOptions({ ...base, showBranding: 'yes' }));
    assert.ok('error' in cleanPrintOptions(null));
    // A stray key never travels on.
    assert.deepEqual(printOptionsOf({ ...base, includePlayerNotes: false } as PrintOptions), base);
  });
  it('merged into the stored settings, every other key kept', () => {
    const stored = { headerLine1: 'Ridge', includePlayerNotes: true, showPageNumbers: true };
    assert.deepEqual(mergePrintOptions(stored, { ...base, showPageNumbers: false }), {
      ...base, showPageNumbers: false, headerLine1: 'Ridge', includePlayerNotes: true,
    });
  });
  it('the summary names the state, and the lines say what the paper does (C3)', () => {
    assert.equal(PRINT_OPTION_WORDS.summary(base), 'Page numbers on · FieldLogicHQ mark on · Portrait');
    assert.equal(PRINT_OPTION_WORDS.summary({ ...base, showBranding: false, orientation: 'landscape' }), 'Page numbers on · FieldLogicHQ mark off · Landscape');
    assert.equal(PRINT_OPTION_WORDS.date.desc('2026-11-20'), '“Exported: 2026-11-20” in the foot of every page.');
    assert.doesNotMatch(PRINT_OPTION_WORDS.guardian.desc, /each time you print/);
    assert.doesNotMatch(PRINT_OPTION_WORDS.direction.desc, /always print wide/);
  });
  it('the route refuses print options from anyone but the owner BEFORE it saves anything', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/pdf-settings/route.ts');
    const put = route.slice(route.indexOf('export const PUT'));
    const refuse = put.indexOf("'Only the owner can change the print options.'");
    assert.ok(refuse > 0 && refuse < put.indexOf('await updateRepTeamPdfLook'));
    assert.match(put, /mergePrintOptions\(row\?\.pdf_settings/);
  });
  it('the card sends them with Save look, and the preview reads the page numbers, the date and the mark', () => {
    const card = readCode('components/coaches/TeamDocumentsLookCard.tsx');
    assert.match(card, /put\(printDirty && printDraft \? \{ \.\.\.draft, print: printDraft \} : draft,/);
    assert.match(card, /paper\.showDateStamp \? `Exported: \$\{tournamentToday\(\)\}` : null/);
    assert.match(card, /paper\.showBranding !== false \? 'Generated by FieldLogicHQ' : null/);
    assert.match(card, /\{paper\.showPageNumbers !== false && <span>Page 1 of 2<\/span>\}/);
    assert.match(card, /<details className=\{styles\.printFold\}>/, 'folded');
  });
});

describe('Name & address (A1, A9) and the Premium Organization section (A3–A6, C4)', () => {
  it('the tab is "Name & address", at the same address', () => {
    const tabs = tournamentSettingsTabs('/x/admin', { members: true, payouts: true, pdf: true });
    assert.deepEqual(tabs.map(t => t.label), ['Members', 'Payouts', 'PDF settings', 'Name & address']);
    assert.equal(tabs[3].href, '/x/admin/tournaments/settings/web-address');
    assert.equal(NAME_AND_ADDRESS_WORDS.tab, WEB_ADDRESS_WORDS.tabName);
  });
  it('the window lands where it was opened from, in that audience’s words', () => {
    const win = readCode('app/[orgSlug]/admin/tournaments/settings/WebAddressWindow.tsx');
    assert.match(win, /router\.push\(destination \? destination\(data\.slug\) : `\/\$\{data\.slug\}\/admin\/tournaments\/settings\/web-address`\)/);
    assert.match(win, /audience === 'team' \? W\.teamWarning : W\.warning/);
    assert.match(WEB_ADDRESS_WORDS.teamWarning, /team’s public page/);
    const page = readCode('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx');
    assert.match(page, /destination=\{slug => `\/\$\{slug\}\/coaches\/teams\/\$\{teamId\}\/settings\?section=organization`\}/);
    assert.match(page, /audience="team"/);
  });
  it('the section shows its own rows whether or not Club is on sale; only Join a club waits on Club (C4)', () => {
    const page = readCode('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx');
    assert.match(page, /scope\.isStandalone && \(!capabilities \|\| capabilities\.isHeadCoach\) && \(data\.organization \|\| clubOpen\) &&/);
    assert.match(page, /\{clubOpen && \(\s*<div className=\{styles\.settingRow\}>/);
    assert.match(page, /: <span className=\{styles\.settingRowDesc\}>\{OW\.ownerOnly\}<\/span>/, 'a non-owner reads Owner only');
    assert.equal(TEAM_ORGANIZATION_WORDS.meta('Riverdale Ridge 13U'), 'Riverdale Ridge 13U · not in a club');
    assert.equal(TEAM_ORGANIZATION_WORDS.who, 'The owner changes these.');
  });
});
