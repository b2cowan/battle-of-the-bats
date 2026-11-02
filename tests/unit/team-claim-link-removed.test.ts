/**
 * Signed-in family accounts Stage 2, Part 2: the old tournament-team claim link is gone.
 *
 * It was a link that let a tournament coach claim a paid team page. Nothing in production created one (the only creator was
 * a developer seed route), and a tournament coach now keeps their account at registration. What stays is the TABLE of past
 * claims: Tournament Chat reads it to work out which coaches are in a tournament's chat, and checkout metadata that already
 * carries a claim id is still honoured.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';

const gone = (rel: string) => !existsSync(new URL(`../../${rel}`, import.meta.url));

describe('the claim link no longer exists', () => {
  it('has no page, no old address, no developer seed, and no token reader', () => {
    assert.ok(gone('app/coaches/claim'), 'the claim page');
    assert.ok(gone('app/team/claim'), 'the legacy /team/claim redirect');
    assert.ok(gone('app/api/dev/seed/team-claim'), 'the developer seed route');
    const claims = readCode('lib/team-workspace-claims.ts');
    for (const name of [
      'createTournamentTeamWorkspaceClaim', 'getTeamWorkspaceClaimByToken', 'verifyTeamWorkspaceClaimForCheckout',
      'generateTeamWorkspaceClaimToken', 'buildTeamWorkspaceClaimUrl', 'claim_token_hash',
    ]) assert.doesNotMatch(claims, new RegExp(name), `${name} is gone`);
  });

  it('is named by no route list: no public-path entry, no warm-journey prefix, no rewrite', () => {
    assert.doesNotMatch(readCode('proxy.ts'), /'claim'/);
    assert.doesNotMatch(readCode('lib/consumer-routes.ts'), /coaches\/claim/);
    const routes = readCode('lib/coaches-portal-routes.ts');
    assert.doesNotMatch(routes, /COACHES_CLAIM_PATH|team\/claim/);
  });

  it('is not a way into team checkout any more: no token is read, verified or sent', () => {
    const route = readCode('app/api/billing/create-team-checkout/route.ts');
    assert.doesNotMatch(route, /claimToken|verifyTeamWorkspaceClaimForCheckout/);
    assert.doesNotMatch(readCode('lib/team-checkout.ts'), /claimToken/);
    assert.doesNotMatch(readCode('lib/portal-keep-premium.ts'), /claimToken/);
    const card = readCode('app/team/TeamSignupClient.tsx');
    assert.doesNotMatch(card, /claimToken|TeamClaimPrefill|claim\?\./);
  });

  it('is created by nothing in the app: no code outside the table readers writes to team_workspace_claims', () => {
    const writers = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
      .filter(f => /from\('team_workspace_claims'\)\s*\.insert\(/.test(readCode(f)));
    assert.deepEqual(writers, [], 'no insert into the claim table');
  });
});

describe('what stays', () => {
  it('Tournament Chat still reads the claim table to find a tournament’s coaches', () => {
    const chat = readCode('lib/chat-resolvers.ts');
    const reads = chat.match(/\.from\('team_workspace_claims'\)/g) ?? [];
    assert.ok(reads.length >= 3, `the chat resolver reads the table (${reads.length} reads)`);
  });

  it('checkout metadata that already carries a claim id is still honoured', () => {
    const claims = readCode('lib/team-workspace-claims.ts');
    assert.match(claims, /export async function assertTeamWorkspaceClaimAvailableForProvisioning/);
    assert.match(claims, /export async function markTeamWorkspaceClaimed/);
    assert.match(claims, /export class TeamWorkspaceClaimError/);
    assert.match(readCode('lib/team-checkout.ts'), /markTeamWorkspaceClaimed\(/);
  });
});
