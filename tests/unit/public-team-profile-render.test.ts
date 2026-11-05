import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { now, profileFixture } from './_public-team-profile-fixture.ts';
import { teamProfilePreview, type PreviewTeamProfile } from '../../lib/public-team-profile.ts';

const load = billingTestLoader({
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  '@/lib/use-public-pathname': { useOrgHref: () => (path: string) => `/club${path}` },
  '@/lib/follow': { useFollowedTeam: () => ({ followedTeamId:'me',follow(){} }),useAccountFollowedTeamIds:()=>new Set(),unfollowTeamEverywhere(){} },
  './SharePageButton': { __esModule:true,default:({ariaLabel}: {ariaLabel:string})=>createElement('button',{'aria-label':ariaLabel}) },
  './UnfollowConfirmSheet': { __esModule:true,default:()=>null },
});
const {PublicTeamBody,default:Page}=load('components/public/PublicTeamPage.tsx') as {
  PublicTeamBody: ComponentType<{data:PreviewTeamProfile;now:Date;orgSlug:string;tournamentSlug:string}>;
  default:ComponentType<{orgSlug:string;tournamentSlug:string;teamId:string}>;
};
function render(patch?: (fixture:ReturnType<typeof profileFixture>)=>void) {
  const f=profileFixture(); patch?.(f);
  return renderToStaticMarkup(createElement(PublicTeamBody,{data:teamProfilePreview(f.profile,f.options),now,orgSlug:'club',tournamentSlug:'cup'}));
}
describe('the real preview team page',()=>{
  it('orders next game, Results, record and the single standings door, without a table',()=>{
    const html=render();
    assert.match(html,/<h2>Riverdale Rapids<\/h2>/);
    assert.doesNotMatch(html,/Share this team/);
    assert.match(html,/data-public-team-game="final"/);
    assert.ok(html.indexOf('data-public-team-game')<html.indexOf('id="team-results"'));
    assert.ok(html.indexOf('id="team-results"')<html.indexOf('Place in A Pool'));
    assert.ok(html.indexOf('Place in A Pool')<html.indexOf('U11 standings · A Pool'));
    assert.match(html,/<dt>Place in A Pool<\/dt><dd>1st of 3<\/dd>/);
    assert.doesNotMatch(html,/<table|FollowAlertsToggle|formBubbles|text-transform/);
    assert.equal((html.match(/href="\/club\/cup\/standings"/g)??[]).length,1);
    // The standings link is a link row with its second line (Public page layout standard A13).
    assert.match(html,/U11 standings · A Pool<\/span><span class="rowSub">Riverdale Rapids is 1st of 3<\/span>/);
  });
  it('draws a game in play on the stacked card, the team first and bold, no pill, no Directions, scoreless live without zeros',()=>{
    const html=render();
    assert.match(html,/<h2 class="headTitle" id="team-focus">Live now<\/h2>/);
    assert.match(html,/class="matchLink stacked edge" data-state="live"/);
    assert.doesNotMatch(html,/class="gameStatus"/, 'the heading says Live now; the edge, not a pill (R9)');
    assert.match(html,/data-own="true"><span class="gameName">Riverdale Rapids<\/span>/);
    assert.ok(html.indexOf('Riverdale Rapids</span>')<html.indexOf('Cedar Hollow Cyclones</span>'));
    assert.doesNotMatch(html,/Directions/);
    assert.equal((html.match(/>No score yet</g)??[]).length,1);
    assert.doesNotMatch(html,/>0–0</);
  });
  it('results put round under opponent, with a 56px date column and real game links',()=>{
    const html=render(f=>Object.assign(f.profile.games[2],{status:'completed',homeScore:5,awayScore:2}));
    assert.match(html,/vs Cedar Hollow Cyclones<small>Playoff · Championship<\/small>/);
    assert.match(html,/href="\/club\/cup\/schedule\/final"/);
    assert.ok(html.indexOf('Oct 30')<html.indexOf('Oct 29'));
  });
  it('no games has Share but no empty record or standings door; coach privacy is kept',()=>{
    let html=render(f=>{f.profile.games=[];f.options.games=[];});
    assert.match(html,/No games scheduled yet/);
    assert.doesNotMatch(html,/<dt>|href="\/club\/cup\/standings"|coach /);
    html=render(f=>{f.profile.team.coach='Dana Whitfield';});
    assert.match(html,/coach Dana Whitfield/);
  });
  it('keeps app-only symbols separate and a stable Follow label',()=>{
    const html=render();
    assert.equal((html.match(/class="appOnly"/g)??[]).length,2);
    assert.match(html,/aria-label="Follow Riverdale Rapids" aria-pressed="true"/);
    assert.match(html,/aria-label="Add to calendar"/);
    assert.doesNotMatch(html,/Following Riverdale|Alerts/);
  });
  it('the initial fetch state says Loading team, with no back link (A14: the menu goes to Teams)',()=>{
    const html=renderToStaticMarkup(createElement(Page,{orgSlug:'club',tournamentSlug:'cup',teamId:'me'}));
    assert.match(html,/Loading team…/);assert.doesNotMatch(html,/All Teams|‹/);
    assert.doesNotMatch(html,/Team not found|Couldn't load/);
  });
});
