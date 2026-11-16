# Fix: the coach Overview re-requests two pages about three times a second

**Owner go:** running this prompt is the owner's go (2026-11-15) to investigate this defect, fix it, and commit the
fix on `dev` (explicit pathspecs, never `master`). It is not a go to change `next.config.ts`, `proxy.ts`, `amplify.yml`
or any hosting setting: if the root cause lives there, stop, report the cause and the proposed change, and ask.

## What was seen

Found by the layout sweep's new timing line (Release process hardening, Stage 1A, 2026-11-15; evidence in
`docs/projects/active/RELEASE_PROCESS_HARDENING_PLAN.md` §2.5).

- On staging (`https://dev.fieldlogichq.ca`, build `f12aad4d9`), signed in as the UAT coach, the team Overview
  link-prefetches the same two addresses every ~300 ms for as long as it is open:
  - the "Take attendance" door: `/{org}/coaches/teams/{team}/schedule?event={id}&tab=attendance`
    (built in `app/[orgSlug]/coaches/teams/[teamId]/page.tsx`, about line 1829);
  - the money-report door: `/{org}/coaches/teams/{team}/accounting?section=budget-vs-actual`.
- Each answer is a `200`, ~4 KB, `content-type: text/x-component`, `cache-control: no-store`, `vary: Accept-Encoding`,
  sent with `next-router-prefetch: 1`.
- The Overview's other door prefetches (Announcements, Tryouts, Staff) have no query string and are fetched once.
  The pattern so far: **a prefetched link whose address carries a query string loops.** That is a lead, not a finding.
- In the sweep, about three-quarters of the coach screens measured never went network-idle and waited out the 30 s cap:
  the Overview and team hub, Roster, the practice plan, the money report, an event's attendance. Every other kind of
  screen had a median of 1–5 s. The 2026-10-13 whole-product sweep took 16 min warm, so the loop probably arrived
  after that.

**Why it matters:** every open Overview is a steady stream of requests. That costs a coach's phone data and battery,
and each request makes the server render the page again, database reads included. It also makes the release sweep
take hours.

## Reproduce first

Save this as `.probe/prefetch-loop/probe.mjs` and run it with
`UAT_BASE_URL=https://dev.fieldlogichq.ca node .probe/prefetch-loop/probe.mjs coach-overview`. It prints the requests
still in flight after 12 s and every request after the first 3 s. Pass any screen id from `scripts/layout-screens.mjs`.

```js
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolveUatContext } from '../../scripts/uat-fixture-context.mjs';
import { SCREENS } from '../../scripts/layout-screens.mjs';
const ctx = await resolveUatContext();
const base = new URL(ctx.baseUrl);
const s = SCREENS.find((x) => x.id === process.argv[2]);
const file = { coach: 'coach.json', repClubOwner: 'rep-club-owner.json', orgOwner: 'org-owner.json', freeCoach: 'free-coach.json' }[s.session];
const state = file ? JSON.parse(readFileSync(`tests/uat/.auth/${file}`, 'utf8')) : { cookies: [], origins: [] };
for (const c of state.cookies) { c.domain = base.hostname; c.secure = base.protocol === 'https:'; }
const b = await chromium.launch();
const p = await (await b.newContext({ storageState: state })).newPage();
const inflight = new Map(); const log = []; const t0 = Date.now();
p.on('request', (r) => { inflight.set(r, Date.now()); log.push(`${Date.now() - t0}ms ${r.method()} ${r.url().slice(0, 160)}`); });
p.on('requestfinished', (r) => inflight.delete(r)); p.on('requestfailed', (r) => inflight.delete(r));
await p.goto(ctx.baseUrl + s.path(ctx), { waitUntil: 'domcontentloaded' });
await p.waitForSelector(s.ready, { state: 'attached' });
await p.waitForTimeout(12000);
console.log('in flight after 12 s:'); for (const [r] of inflight) console.log('  ' + r.url().slice(0, 160));
console.log('after 3 s:'); for (const l of log) if (parseInt(l) > 3000) console.log('  ' + l);
await b.close();
```

## Investigate (answer each before changing code)

1. **Does it happen on the local dev server and on a local production build** (`next build` + `next start` on another
   port; see the memory notes on building from `C:\` and pre-loading `.env.local`), or only on staging? Staging-only
   points at the hosting layer (Amplify/CloudFront headers: note `vary` carries none of Next's router headers).
2. **Does it happen in production?** Check a coach Overview in the public demo sandbox (`riverdale-ridge`) by visiting it
   only. Never sign in, write or seed anything there. A yes means customers are paying for it today.
3. **Which commit introduced it?** Candidates to test first: the Next 16.3 upgrade, the Overview's 2026-11-14 game-day
   change (`960394e86`), and anything that changed how these two doors are built. A local `git worktree` at an older
   commit plus the probe answers it. Never check out an older commit in the shared tree.
4. **Why does a query-string prefetch loop?** Read the prefetch and segment-cache sections of the guides in
   `node_modules/next/dist/docs/` (AGENTS.md: this Next has breaking changes). Check how these two pages are rendered
   (dynamic, `no-store`) and whether the router treats their prefetch answer as unusable and asks again.
5. **How wide is it?** List every link in the product (coach portal, admin, club site, public pages) that the same
   cause would make loop: the census, with the probe run on one screen per kind. Delegate the census to a helper.

## Fix

- Fix the cause, not the symptom. Turning prefetch off on two links (`prefetch={false}`) is acceptable only if
  question 4 shows the loop is the framework's behaviour for that kind of page and there is no supported way to
  prefetch it correctly. Then apply it to every link the census found, and say what it costs: the first tap on that
  door loses its head start.
- If the cause is in `next.config.ts`, `proxy.ts`, `amplify.yml` or the hosting setup, stop and ask (see the go above).
- Change nothing about the layout sweep's waits. They are correct to wait.

## Prove it

- The probe shows each door prefetched once (or not at all, if prefetch is off), and nothing in flight after 12 s, on
  the Overview, Roster, the practice plan, the money report and an event's attendance.
- On the dev server: `npm run check:layout -- --only=coach-overview,coach-roster,coach-practice-plan,coach-budget-vs-actual,coach-schedule-attendance --width=361`
  prints a run cost line with p95 under 10 s, and the same findings as before the fix (`--dump` both runs and compare
  the keys as sets).
- Unit tests for any logic you add. Run `npm run verify:changed` and `npm run typecheck`, but never while a layout sweep
  is running on the PC: check first, because other sessions run them.

## Rules for this session

- Other sessions share this tree. Release process hardening Stage 1A has uncommitted changes in `scripts/` and
  `.claude/commands/release.md`: do not stage them. Stage explicit paths only, and check `git show --stat HEAD` after
  committing.
- No whole-product layout sweep here. Slices only.
- The fix changes what a coach's phone does in the background, not what they see. Say so in the hand-off. No help-doc
  change is expected, unless the census finds a visible behaviour change.
- Offer `/simplify` (if you add an abstraction) and `/review` before the commit.

## Hand-off

- Report to the owner in plain language: what caused it, since when, whether production customers have it, what was
  changed, and what a coach notices (nothing, or a slower first tap on a door, if prefetch was turned off).
- Add the result under §2.5 of `RELEASE_PROCESS_HARDENING_PLAN.md`, with the commit hash and date.
- The next whole-product sweep's cost line is the measure of the effect on the release. Do not run that sweep here.
