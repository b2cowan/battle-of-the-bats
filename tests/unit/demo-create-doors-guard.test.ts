// ⚖ Board Ready trust close-out 1 (owner 2026-11-18): a "See it live" demo account is refused outright at every door that
// CREATES a workspace. These doors name no club, so the proxy's demo match cannot see them, and the one-club rule that used
// to turn the demo away lets a request through when its own read fails. Each handler must call `demoActorRefusal`, return
// its answer, and do so before it can change anything. A NEW route that creates a club or a team fails here until it is
// listed (and so refuses).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { demoActorRefusal, demoBillingRefusal } from '../../lib/demo-guard.ts';
import { DEMO_ORGS } from '../../lib/demo-org.ts';

const CREATE_DOORS: Record<string, string> = {
  'app/api/org/create/route.ts': 'creates a club',
  'app/api/coaches/teams/route.ts': 'creates a coach team',
  'app/api/coaches/basic-teams/route.ts': 'claims a tournament entry, and can create a coach team for it',
  'app/api/register/route.ts': 'a signed-in sign-up files the entry under a coach team, and can create one',
};

/** Calls that create a workspace. A route that makes one must be a listed door. */
const CREATES = /\b(createOrganization|createBasicCoachTeam|linkTournamentRegistrationToBasicCoachTeam)\(/;

/** The source without its comments, so a mention in prose never counts. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const SIDE_EFFECT = /\b(supabaseAdmin|createOrganization|createOrganizationMember|createBasicCoachTeam\w*|linkTournamentRegistrationToBasicCoachTeam|sendEmail|clearStartDoor)\b|\.(?:insert|update|delete|upsert)\(/;

describe('demo accounts at the create doors', () => {
  test('both demo accounts are refused as actors, anyone else is not', () => {
    assert.ok(DEMO_ORGS.length >= 2);
    for (const demo of DEMO_ORGS) {
      const r = demoActorRefusal({ email: demo.organizerEmail.toUpperCase() });
      assert.ok(r, `${demo.organizerEmail} refused`);
      assert.equal(r!.status, 403);
      assert.equal(r!.headers.get('X-Sandbox-Blocked'), '1');
    }
    assert.equal(demoActorRefusal({ email: 'coach@dev.local' }), null);
    assert.equal(demoActorRefusal(null), null);
    assert.equal(demoBillingRefusal({ email: DEMO_ORGS[0].organizerEmail })?.status, 403, 'billing keeps the same refusal');
  });

  for (const [file, why] of Object.entries(CREATE_DOORS)) {
    test(`${file} (${why}) refuses the demo account before it changes anything`, () => {
      const src = code(readFileSync(file, 'utf8'));
      const m = /export (?:const|async function|function) POST\b/.exec(src);
      assert.ok(m, `${file} has no POST`);
      const body = src.slice(m!.index);
      const at = body.search(/\bdemoActorRefusal\(/);
      assert.ok(at >= 0, `${file}: POST never calls demoActorRefusal`);
      assert.match(body, /if \(demoRefusal\) return demoRefusal;/, `${file}: POST does not return the refusal`);
      const effect = body.search(SIDE_EFFECT);
      assert.ok(effect < 0 || effect > at, `${file}: POST changes something before it refuses the demo account`);
    });
  }

  test('every route that creates a club or a team is a listed door', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name === 'route.ts') files.push(p.replace(/\\/g, '/'));
      }
    };
    walk('app/api');
    const creators = files.filter(f => CREATES.test(code(readFileSync(f, 'utf8'))));
    assert.ok(creators.length >= 3, `found ${creators.length}`);
    for (const f of creators) assert.ok(f in CREATE_DOORS, `${f} creates a workspace but is not a listed create door`);
  });
});
