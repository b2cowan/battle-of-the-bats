import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import * as React from 'react';
import { billingTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import { profileFixture } from './_public-team-profile-fixture.ts';
import { teamProfilePreview, teamProfileView } from '../../lib/public-team-profile.ts';

// PRIVACY (Stage 8 Part 3c): the image withholds a held-back division ALWAYS. Until 3c it did so only with the
// preview switch on; "dropping the gate" meant always withholding, never that it stops withholding.
describe('Stage 5 review: the held-back team share image', () => {
  const card = async (visibility: 'published' | 'unpublished' | undefined) => {
    const load = billingTestLoader({
      'next/og': { ImageResponse: class { body: string; constructor(node: ReactNode) { this.body = renderToStaticMarkup(node); } } },
      '@/lib/public-tournament-data': { getPublicTournamentPageData: async () => ({
        tournament: { name:'Classic' }, games: [],
        teams: [{ id:'secret',name:'Held-back Rapids',divisionId:'d' }],
        divisions: [{ id:'d',name:'Held-back Division',scheduleVisibility:visibility }],
      }) },
      // The image reads no switch; a read would throw, its catch would hand back the generic card, and the public case fails.
      '@/lib/public-frame-server': { isPublicFrameOn: async () => { throw new Error('the switch is gone from the share image'); } },
      '@/lib/themes': { resolveTheme: () => ({ primary:'#123456',primaryRgb:'18,52,86' }) },
    });
    const { default: Image } = load('app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx') as {
      default: (args: { params: Promise<{orgSlug:string;tournamentSlug:string;id:string}> }) => Promise<{body:string}>;
    };
    return (await Image({ params:Promise.resolve({orgSlug:'club',tournamentSlug:'cup',id:'secret'}) })).body;
  };
  for (const visibility of ['unpublished', undefined] as const) {
    it(`always uses the generic image for a held-back team (${visibility ?? 'no visibility set'}), with no name or division`, async () => {
      const html = await card(visibility);
      assert.match(html, /FieldLogicHQ/);
      assert.doesNotMatch(html, /Held-back|RECORD|Classic/);
    });
  }
  it('a published team keeps its public image, and the route reads no switch', async () => {
    assert.match(await card('published'), /Held-back Rapids/);
    assert.doesNotMatch(readCode('app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx'), /isPublicFrameOn|public-frame-server/);
  });
});

describe('Stage 5 review: the page clock works without a replacement feed', () => {
  it('wakes at kickoff and the live-window end, and cleans up its timer', () => {
    const {profile,options} = profileFixture();
    const data = teamProfilePreview(profile,options);
    const OriginalDate = Date;
    let instant = OriginalDate.parse('2026-10-30T17:59:59.000Z');
    const key = 'club/cup/me';
    let entry = {key,data,error:null,now:new OriginalDate(instant)};
    let slot = 0;
    const effects: Array<() => void | (() => void)> = [];
    let wake: (() => void) | null = null;
    let delay = 0;
    let cleared = 0;
    const globals = ['Date','document','setTimeout','clearTimeout'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
    const load = billingTestLoader({
      'react': { ...React,
        useState: () => slot++ === 0 ? [entry,(update:(previous:typeof entry)=>typeof entry)=>{entry=update(entry);}] : [0,()=>{}],
        useRef: () => ({current:null}),useEffect:(effect:()=>void|(()=>void))=>effects.push(effect),
      },
      'next/navigation': {useRouter:()=>({refresh(){}})},
      '@/lib/use-public-pathname': {useOrgHref:()=> (path:string)=>`/club${path}`},
      '@/lib/follow': {},
    });
    try {
      class ClockDate extends OriginalDate {
        constructor(value?:string|number|Date) { super(value === undefined ? instant : value instanceof OriginalDate ? value.getTime() : value); }
        static now() {return instant;}
      }
      Object.defineProperties(globalThis,{
        Date:{configurable:true,value:ClockDate},
        document:{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'visible'}},
        setTimeout:{configurable:true,value:(callback:()=>void,ms:number)=>{wake=callback;delay=ms;return 1;}},
        clearTimeout:{configurable:true,value:()=>{cleared++;}},
      });
      const {default:Page} = load('components/public/PublicTeamPage.tsx') as {
        default:(props:{orgSlug:string;tournamentSlug:string;teamId:string})=>unknown;
      };
      const renderClock = () => {
        slot=0;effects.length=0;
        Page({orgSlug:'club',tournamentSlug:'cup',teamId:'me'});
        // The network effect is deliberately not run: exercise the real independent local-clock effect.
        return effects[1]();
      };
      let cleanup = renderClock();
      assert.equal(delay,1010);
      instant += delay; (wake as unknown as ()=>void)();
      assert.equal(teamProfileView(data,entry.now).moment.kind,'live');
      if(typeof cleanup==='function') cleanup();
      cleanup=renderClock();
      assert.equal(delay,120*60_000);
      instant += delay; (wake as unknown as ()=>void)();
      assert.equal(teamProfileView(data,entry.now).moment.kind,'none');
      if(typeof cleanup==='function') cleanup();
      assert.equal(cleared,2);
    } finally {
      for(const [name,descriptor] of globals) {
        if(descriptor) Object.defineProperty(globalThis,name,descriptor);
        else Reflect.deleteProperty(globalThis,name);
      }
    }
  });
});

describe('Stage 5 review: browser follow reads', () => {
  it('does not read or subscribe while disabled, and keeps the installed-app follow intact', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis,'window');
    const effects: (() => unknown)[] = [];
    let reads = 0;
    let subscriptions = 0;
    let state: string | null = 'retained-follow';
    const load = billingTestLoader({
      'react': { useState: () => [state, (next:string|null) => { state=next; }],
        useEffect: (fn:() => unknown) => effects.push(fn), useCallback: (fn:unknown) => fn },
      './auth': { getSession: async () => null },
      './supabase-browser': { createClient: () => ({ auth:{onAuthStateChange() {}} }) },
    });
    try {
      Object.defineProperty(globalThis,'window',{ configurable:true,value:{
        localStorage: {getItem() { reads++;return JSON.stringify({id:'retained-follow',name:'Rapids',divisionId:'d'}); }},
        addEventListener() { subscriptions++; },removeEventListener() {},
      } });
      const {useFollowedTeam} = load('lib/follow.ts') as {
        useFollowedTeam:(org:string,cup:string,enabled?:boolean)=>{followedTeamId:string|null};
      };
      assert.equal(useFollowedTeam('club','cup',false).followedTeamId, null);
      effects.splice(0).forEach(effect=>effect());
      assert.equal(reads,0);assert.equal(subscriptions,0);
      useFollowedTeam('club','cup',true);
      const cleanups = effects.splice(0).map(effect=>effect());
      assert.equal(reads,1);assert.equal(subscriptions,2);
      assert.equal(state,'retained-follow');
      cleanups.forEach(cleanup=>{ if(typeof cleanup==='function') cleanup(); });
    } finally {
      if(descriptor) Object.defineProperty(globalThis,'window',descriptor);
      else Reflect.deleteProperty(globalThis,'window');
    }
  });
  it('both preview pages disable follow reads in browsers; Schedule also gates its synchronous selection', () => {
    for(const name of ['PublicSchedule','PublicStandings'])
      assert.match(readCode(`components/public/${name}.tsx`), /useFollowedTeam\(orgSlug, tournamentSlug, !isPreview && installed\)/);
    assert.match(readCode('components/public/PublicSchedule.tsx'), /!isPreview && isStandalonePWA\(\) \? readFollowedTeamId/);
  });
});
