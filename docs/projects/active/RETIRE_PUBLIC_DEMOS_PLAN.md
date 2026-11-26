# Retire the public demos — Implementation Plan

> **Status:** Building. Phase 1 committed `89814487a` (+ `2bb98904f`) 2026-11-25. Phase 2 committed `ecbc17aed` (migration) + `c5dc00592` (automation) + the script commit 2026-11-26, after `/review`;
> its production run waits on Step 1 and Phase 2 being live on production (see Phase 2 "As built").
> **Created:** 2026-11-25
> **Branch:** dev
> **Ruling:** `docs/agents/strategy/BUSINESS_DECISIONS.md`, "2026-11-25 — Both public demos are RETIRED" (owner: *"Remove both,
> run /strategy to log it"*, then *"Commit, then run /plan for the removal"*).
> **PM brief:** [RETIRE_PUBLIC_DEMOS_PM_BRIEF.md](RETIRE_PUBLIC_DEMOS_PM_BRIEF.md) · **Status lives on the board** (`retire-public-demos`).

## Goal

Take both public no-login demo sandboxes out of the product completely: the tournament demo (`riverdale-minor-ball`, shared
user `demo-organizer@example.com`) and the coach demo (`riverdale-ridge`, shared user `demo-coach@example.com`). That means every
door and every line that promises them, the shared accounts and their data on dev and production, and the machinery that kept
one shared account safe to hand to every visitor. That machinery is what caused the sign-in and session defects; removing it
is the point. When this is done, no page links to a demo or says one is running. No code path special-cases a demo slug or a
demo user, except the reserved-slug list (Decision D3). No job, build step or check refers to the demos.

**Not touched:** the prospect demo seeding (`scripts/seed-prospect-demo.mjs`, `scripts/lib/prospect-demo-*.mjs`, the Milton
config), Track P previews (`lib/preview-org.ts`, `lib/prospect-clubs-server.ts` apart from its reserved-slug use, the
platform-admin Prospect clubs page), and `milton-bats`'s test-org flag. None of them import the public demo code (census
2026-11-25: the only link is a comment in `prospect-demo-rep.mjs:15-18`).

## PM Brief

See [RETIRE_PUBLIC_DEMOS_PM_BRIEF.md](RETIRE_PUBLIC_DEMOS_PM_BRIEF.md).

## Why this order (dependency and rework risk)

1. **The door must be shut in code before anything else.** The marketing buttons are hidden by one switch
   (`sandboxDoorsVisible()`, `lib/sandbox-door.ts:74-78`). In production it is on only because `NEXT_PUBLIC_SEE_IT_LIVE_DOORS`
   is set to `true` in Amplify. Hiding the buttons does **not** shut the door: `/see-it-live` and `/see-it-live/coaches` still
   sign anyone who has the address into the shared account, and `/demos` and the pitch page ignore the switch. The door
   routes are the only way a new demo session starts, so they are shut first.
2. **The data goes before the guards.** The write block in `proxy.ts` (with `lib/demo-guard.ts`) is the only thing that stops
   a demo session saving to the demo clubs. If the code went first, a visitor still holding a demo session cookie would be
   signed in as a club owner with no guard. So the shared accounts are deleted first, which ends every open demo session;
   the guards come out after.
3. **The production demo check retires before the data goes.** `check:demos:prod` treats a missing demo as a failure, and the
   release runbook runs it. The nightly jobs call the platform-admin tick routes that Phase 3 deletes, so they are
   unscheduled before the routes go.
4. **The records go last,** so CLAUDE.md never tells a session the demos are gone while they still run (or the reverse).

## Phases

### Phase 1 — Shut the doors and change the words (one release; undone by reverting its commit; no data touched)

The visitor-facing half. One `/marketing` pass settles the replacement words (see "Words for /marketing") before the commit.

- [x] **The door routes stop signing anyone in.** `app/see-it-live/route.ts` and `app/see-it-live/coaches/route.ts` return a
      permanent redirect (308) to the page in Decision D2, and never call sign-in. The two switch screens
      (`app/see-it-live/switch/page.tsx`, `app/see-it-live/coaches/switch/page.tsx`) and `app/api/sandbox/switch{,-coach}/route.ts`
      redirect the same way (the switch endpoints refuse with 410).
- [x] **The buttons go.** `sandboxDoorsVisible()` returns `false` in code, independent of the Amplify variable. Every gated door
      disappears together: `app/page.tsx`, `app/for-tournament-organizers/page.tsx`, `app/for-coaches/page.tsx`,
      `app/for-clubs/page.tsx` (the demo block and the rep-teams door), `components/PricingSection.tsx` ("Not ready? See … first"),
      `components/Footer.tsx` ("Live demos"), and the walkthrough buttons (`lib/walkthrough-content.ts:950,998` via
      `WalkthroughPage.tsx:115`). Where a page's layout leans on the door, Phase 1 places the `/marketing` replacement (or nothing).
- [x] **`/demos` redirects** (308, Decision D2) instead of rendering. `app/demos/page.tsx` becomes a redirect;
      `app/sitemap.ts:30-31` drops it.
- [x] **The ungated promises are re-worded** (`/marketing`): `components/marketing/ProspectDeckPage.tsx:38-46,99-105` ("a live
      demo behind every one of them", "The demo is running right now.", the `/demos` button and printed address);
      `lib/walkthrough-content.ts:980,1040` (closing text); `lib/walkthrough-derive.ts:48` (SEO description).
- [x] **Tests.** Update `tests/unit/demo-sandbox-door-and-chrome.test.ts` and `tests/unit/public-face-s4-marketing*` (or
      whichever assert the doors render) to assert the doors are absent and the door routes redirect without signing in. The
      Phase 3 deletion removes the demo-only tests; Phase 1 must not leave them red.
- [ ] `/docs`: `lib/help-content/platform-admin.tsx:255,338,368-370,1933,1969` ("a demo club" as a reason a button is absent)
      leaves the help text in Phase 3, when the reason stops existing. It is listed here so the `/docs` pass is scheduled once.
- [x] Verify: `npm run verify:changed`; a quick local check that the home page, pricing, the three persona pages, the footer, a
      walkthrough and a pitch page show no demo, and that `/see-it-live` lands on the D2 page signed out.
- **Walk:** none of its own. The owner looks at the five public pages once on staging, folded into the next release's public-page look.
- **As built (2026-11-25):**
  - The four door addresses answer 308 to `/pricing` (the two routes on the host the visitor asked for); the two swap endpoints
    answer 410. None imports any session code; a probe on the dev server saw no `Set-Cookie` on any of them. A browser still
    holding a demo session is signed out by the unchanged exit rule when it reaches `/pricing`.
  - `sandboxDoorsVisible()` returns `false`; the gated door branches stay in the pages until Phase 3 deletes them with the switch.
    `RETIRED_DEMO_LANDING` (`lib/sandbox-door.ts`) names the landing once.
  - Pricing's "Not ready?" line now points at the two walkthroughs (no longer behind the switch).
  - **Wider than the plan listed:** the walkthroughs' opening lines (also present mode's first slide) and both closing titles
    promised a running demo too; all re-worded. `app/demos/page.module.css` and `app/see-it-live/switch/switch.module.css` were
    deleted (orphaned by the redirects; the dead-class gate flagged them).
  - `tests/unit/demo-sandbox-exit.test.ts` had not run under `npm test` since 2026-11-22 (a `<T>[]` assertion the type-stripping
    runner refuses fails the whole file); fixed to `as`, and its 26 tests pass.
  - Verify: `check:spelling` green; the 6 flipped test files pass (176); `verify:changed` stops at `npm test` on other sessions'
    in-flight work (48 failures, none in a file this phase touched), so the later gates were run one by one: all pass apart from
    findings in other sessions' files. `tsc` clean apart from another session's `place-closures.test.ts`.
  - Local look (dev server): home, pricing, the three persona pages, both walkthroughs and the sitemap carry no demo link or
    demo words. No pitch page could be opened: dev has no saved deck with a share link.

### Phase 2 — Retire the production check, unschedule the jobs, delete the data (dev, then production)

Migration first, per the planning rules. Each automation change gets its own commit, with a message stating the behavior change
(AGENCY_RULES "shared agent automation"; the owner's ruling for this project covers these changes as its subject).

- [x] **Migration `543_the_public_demos_stop_refreshing.sql`** (number re-checked at build: 540–542 were taken): `cron.unschedule` the demo tournament
      tick and the coach tick jobs (scheduled in 224 and 226, made nightly in 273). Idempotent: unschedule only if present. Apply
      to dev; production goes with the Phase 2 release. Record it in `MANUAL_PROD_STEPS.json` if that is the route at build.
      Commit on its own: *"The two nightly demo refresh jobs no longer run."*
- [x] **Dictionary and snapshots:** no table or column changes. Run `npm run refresh:snapshots` (dev and prod) after the apply,
      and `npm run check:dictionary`. If the dictionary lists the cron jobs, remove those lines in the same commit.
- [x] **Retire the production demo check** before any data goes:
      - `check:demos:prod` and its steps in `.claude/commands/release.md` (around :159-177, :368-372, :399);
      - `check:demos` in `package.json` and `check-demos.mjs` from `verify:changed` (`scripts/verify-changed.mjs` or wherever it is
        wired);
      - the `reseed-demos-if-stale` step in `amplify.yml:119-126`.
      Its own commit: *"Releases no longer check or rebuild the public demos."*
- [x] **A one-off retirement script,** `scripts/retire-public-demos.mjs`:
      - Dry run by default; `--apply` deletes; `--prod` requires the host guard used by the other prod scripts.
      - It deletes the two demo orgs with the **same purge the platform-admin delete uses** (`app/api/platform-admin/orgs/[id]/delete/route.ts`,
        storage included). The console's demo refusal stays in place until Phase 3, so the script calls the purge directly.
        It does not weaken the route.
      - It deletes the two shared auth users, and their sessions with them.
      - It prints counts only, never rows (the 2026-11-18 production-read rule). The demo data is fictional, but the
        script still reports counts, never rows.
- [x] Run it on **dev** (`--apply`). Confirm the door routes still redirect and the public pages render.
- [ ] Run it on **production** only on the owner's yes in that session (Decision D4): dry run first, its counts shown to the owner,
      then `--apply`. Record it in the release history.
- [x] Local fixtures that assume `riverdale-minor-ball` exists: `scripts/seed-public-frame-fixtures.mjs:6,191`,
      `scripts/layout-screens.mjs:2050-2054`, `scripts/seed-qa-day-fixtures.mjs:839`. Point them at a dev fixture org, or drop the
      demo screens from the layout list.

- **As built (2026-11-26):**
  - **Owner yeses, this session:** "go, yes to all four, accept staging" (the UX summary; the four automation changes:
    the build file, the release runbook, the package scripts, the everyday check chain; staging's old demo buttons
    erroring until Step 1 is pushed there).
  - **Migration 543** unschedules both jobs, each only if present, and also deletes their four heartbeat rows (two dispatch,
    two arrival). Without that, the platform-admin job-freshness panel would have listed four forever-stale demo jobs.
    Applied to dev twice, read back 0 jobs and 0 rows. `MANUAL_PROD_STEPS.json` entry `pending`. No table or column changes, and
    the dictionary never listed the jobs. `check:dictionary` OK. The snapshot hook ran (the divergences it reports are
    other sessions' 540–542).
  - **Automation:** `amplify.yml`'s reseed step is gone. ⚠ That step ran on **every** branch, dev included, so until this
    change is pushed, a staging build would re-seed the dev demos (re-run the script if one does). `release.md` §1d-1 is a
    retired stub (the heading is kept so references resolve), and Phase 2b's demo step and the promote's "No live-demo gate"
    line are gone. `package.json` lost `check:demos`, `check:demos:prod`, `tick:demos`, `reseed:demos` and `reseed:demos:dry` (the
    owner approved all four command families). `verify:changed` no longer runs `check-demos.mjs`. `capture-marketing-shots.mjs
    --check` stays: it only checks that the files exist, never the demo.
  - **The script** uses the console delete's purge without calling the route. The route's own steps are written inline and
    pinned line by line by four other projects' guard tests, so it was not extracted. The script repeats the route's
    table deletes in the same order and removes files through the same shared helpers, and
    `tests/unit/retire-public-demos-script.test.ts` fails if the two drift apart. It refuses before any change on a live
    subscription, an online-payments account, a club web address, a member other than the shared account, or an account in
    another club. It deletes an account only when none of the 14 non-cascading account columns still name it (re-counted
    after the clubs go). It checks the two slugs against `lib/demo-org.ts`, writes `delete_organization` /
    `delete_organization_files` / `delete_demo_account` audit rows, and prints counts only.
  - **After `/review` (2026-11-26):** the shared account is found as the demo club's own member and must carry the registry's
    email. The script never lists every account, which on production would load real people's records (the 2026-11-18 rule),
    and it cannot reach a stranger who signed up with a demo address. The `delete_organization` row is written strictly,
    before anything changes, and records the club's id, its rules files and its account id. A re-run uses it to finish an
    account or a file removal an earlier run left behind (a `_files_failed` row is retried), and a failed read-back is a
    failure. A dev dry run after the change found both clubs gone and the files done, with nothing to redo.
    Coverage note: `pubt-overview` now sweeps a registration-open Overview, not a games-in-progress one.
  - **Dev run (2026-11-26):** riverdale-minor-ball had 1 member, 3 tournaments and 0 files; riverdale-ridge had 1 member, 5 teams
    and 0 files (its account was named by 101 non-cascading records, all inside the club, 0 after it went). Both clubs and
    both accounts deleted, read back 0 and 0, and a second run reports everything already gone. After the run on the dev server:
    the five old demo addresses still 308 to `/pricing` with no cookie set, and home, pricing and the three persona pages
    plus the sign-in page answer 200. A fixture sign-in (`uat-asst-money-read`) works. `/riverdale-minor-ball` and
    `/riverdale-ridge` now answer 404, as expected with the clubs gone and the slugs reserved (D3).
  - **Fixtures:** `pubt-overview` now measures `/stage2-cedar-valley/winter-warmup` (a club in a dark colour, renders the frame
    band). `seed-public-frame-fixtures.mjs` no longer lists Riverdale. A stale comment in `seed-qa-day-fixtures.mjs` was corrected.
  - **Production: NOT run.** When this was built, production was at `6e361818b` (11-24) and Step 1 was not even on
    `origin/dev`. Its three conditions: (1) Step 1 is live on production, (2) 543 is applied there, (3) the reseed step is out
    of the live build. Then the `--prod` dry run, the owner sees the counts, the owner says yes **in that session**, `--apply`, and
    the run is recorded in the release history.

### Phase 3 — Remove the machinery (code only; the data is already gone)

One unit of work, which may land as several commits. Grep for `demo-org`, `demo-guard`, `demo-session`, `sandbox-`,
`isDemoOrgSlug`, `isDemoOrganizerEmail`, `flhq-in-sandbox` and `data-sandbox-tour` until the only hits are the reserved slugs and history.

- [ ] **Delete the core modules:**
      - `lib/demo-org.ts`, `lib/demo-org-server.ts`, `lib/demo-guard.ts`, `lib/demo-session.ts`, `lib/demo-tournament.ts`;
      - `lib/demo-moments.ts`, `lib/demo-coach.ts`, `lib/demo-reconcile*.ts`, `lib/demo-coach-reconcile*.ts`, `lib/demo-sandbox-heartbeat.ts`;
      - `lib/sandbox-chrome.ts`, `lib/sandbox-exit.ts`, `lib/sandbox-exit-rule.ts`, `lib/sandbox-door.ts`, `lib/sandbox-curation.ts`;
      - `lib/coach-sandbox-refusal.ts`, `components/sandbox/*`.
- [ ] **Delete the routes:**
      - `app/see-it-live/**` and `app/api/sandbox/**`;
      - `app/api/platform-admin/demo-sandbox-tick/route.ts` and `coach-sandbox-tick/route.ts` (the jobs were unscheduled in Phase 2);
      - `app/demos/page.tsx`. The D2 redirects for `/demos` and `/see-it-live*` move to `next.config` redirects, so the
        old addresses keep landing somewhere.
- [ ] **`proxy.ts`:** remove the demo imports (:5-9), the write block (:62-73), the exit-and-short-circuit (:85-109), the anonymous
      demo-admin redirect (:284-294) and the `flhq-in-sandbox` matcher entry (:372-391). `proxy.ts` is a restart-required change.
- [ ] **Sign-in special cases:**
      - `app/(consumer)/auth/login/page.tsx:147-161`;
      - `app/(consumer)/account/security/page.tsx` and `SecurityClient.tsx`, `app/(consumer)/auth/two-step/page.tsx:173-174`;
      - `app/api/auth/{password,password-reset-notice,sign-out-others,accept-invite,invitations,two-step/*}`;
      - `lib/use-client-signed-in.ts`, `lib/supabase-server.ts`, `lib/club-forward.ts`, `lib/legal-acceptance-exempt.ts:17-26`,
        `lib/two-step-club-reset.ts`;
      - `components/consumer/ConsumerNav.tsx` (Sign out shows for everyone again).
- [ ] **Demo-guard calls:**
      - all `app/api/billing/*` routes, `app/api/admin/payouts{,/return}`, `consumer/follows`, `register`, `tryout-score/[token]`;
      - `org/create`, `coaches/teams`, `coaches/basic-teams`, `app/coaches/start/page.tsx:28-44`;
      - the platform-admin delete's demo refusal (`orgs/[id]/delete/route.ts:20,123,162-165`).
- [ ] **Exclusions (no demo org left to exclude):**
      - `lib/notify.ts`, `email-sender.ts`, `fan-notify.ts`, `team-coach-notices.ts`, `notify-recipients.ts`, `insights-digest.ts`, `dues-reminders.ts`;
      - `lib/platform-metrics.ts`, `free-time-*.ts`, `lead-book.ts`, `lead-writes.ts`, `platform-people-lookup.ts`, `purchase-details-server.ts`;
      - `lib/observability/capture.ts:165`;
      - `app/api/platform-admin/find`, `orgs/[id]/money` and its refund route.
      - **Check each one:** an exclusion that also leaves out *test* orgs keeps its test-org half (`is_test_organization`).
- [ ] **UI that reads the sandbox context:**
      - `app/[orgSlug]/layout.tsx:72-136` (robots tag and chrome mount), `[tournamentSlug]/layout.tsx`, `ClubBar`, `TournamentBand`, `TournamentFooter`;
      - `AdminTopStrip`, `DeskNamedPage`, `useAdminKitNav`, `kit-tournament-groups.ts`, `CoachTopStrip`, `CoachesBottomNav`, `CoachesSidebar`, `MoreSheetFoot`, `BrandLockup`;
      - `MessageComposer`, `ScheduleHealthPanel`, the schedule page, `useScheduleHealthRules`, the five coach money panels;
      - `app/[orgSlug]/coaches/layout.tsx:22,94-97`, `app/[orgSlug]/admin/tournaments/summary/page.tsx:29,100-131`, `lib/tournament-context.tsx`.
- [ ] **Tour anchors:** remove every `data-sandbox-tour` attribute (about 21 files). `tests/uat/scenarios/coach-development-metrics.spec.ts:221`
      selects on one: give that element a `data-testid` and retarget the test (Decision D5).
- [ ] **Robots:** drop `/see-it-live` from `lib/robots-rules.ts`. Keep the two slugs disallowed (cheap, and consistent with D3).
- [ ] **Scripts:**
      - delete `seed-demo-tournament.mjs`, `seed-demo-coach.mjs`, `check-demo-sandbox.mjs`, `check-demo-coach.mjs`, `check-demos.mjs`;
      - delete `reseed-demos-if-stale.mjs`, `lib/demo-world-fingerprint.mjs`, `sweep-demo-sandbox.mjs`, `tick-demo-sandbox.mjs`, `tick-demo-coach.mjs`;
      - (the `package.json` scripts `check:demos*`, `tick:demos` and `reseed:demos{,:dry}` all went in Phase 2);
      - delete `retire-public-demos.mjs` and `tests/unit/retire-public-demos-script.test.ts` once production has run it;
      - `capture-marketing-shots.mjs`'s `seedHint` still names the removed `npm run check:demos` (it prints only in capture
        mode, which this phase removes).
- [ ] **Screenshots (Decision D6):**
      - keep the images in `public/marketing/**` and the help images, and whatever registry the pages read;
      - remove the demo page addresses and the demo capture mode from `lib/marketing-shots.ts`, `lib/help-shots.ts`,
        `scripts/lib/shot-capture.mjs`, `capture-marketing-shots.mjs`, `capture-help-shots.mjs` and `capture-on-sale-pictures.mjs`;
      - keep `capture-marketing-shots.mjs --check` (file existence) if it still guards the images;
      - remove the demo path column from the pitch deck studio (`app/platform-admin/pitch-deck-studio/report.ts`, `SlideCard.tsx`, `page.tsx`).
- [ ] **Tests:**
      - delete `demo-destinations-guard`, `demo-sandbox-write-guard`, `demo-sandbox-door-and-chrome`, `demo-sandbox-moments`,
        `demo-sandbox-exit`, `demo-coach-world` and `demo-create-doors-guard`;
      - edit the roughly 20 tests that import demo symbols (`legal-acceptance-doors`, `preview-org-guard`, `public-face-s4-marketing`,
        `two-step-server-check-guard`, `support-console-stage*-guard`, `org-storage-purge`, `plan-billing-*`, `workspace-move-money`,
        and the rest found by grep);
      - leave tests that only use "Riverdale" as a made-up name alone (about 90 files).
- [ ] **Help text** (`/docs`): the platform-admin articles stop naming "a demo club".
- [ ] Verify: `npm run typecheck`, `npm run verify:changed`, `npm run lint:focused` on the touched files. Restart the dev server
      (`proxy.ts` and shared modules changed).
- [ ] `/review` on the diff: auth, request-layer and billing-guard edits are substantive.
- **Walk:** one short walk (§ at build): sign in and sign out on each portal; two-step setup; the account menu on a phone; the
  home and pricing pages; an old `/see-it-live` address. About 15 boxes. These are the screens the demo special cases bent.

### Phase 4 — The records

- [ ] `CLAUDE.md`: delete the "Demo sandboxes" section.
- [ ] `.claude/commands/demos.md` retired: delete it, or leave a one-line pointer to the ruling. Edit the demo mentions in
      `.claude/commands/release.md` (any left after Phase 2), `docs.md`, `marketing.md` and `prewalk.md`.
- [ ] `DEMO_PROCESS_DECOUPLING_PLAN.md` and its PM brief: a closing line pointing at this plan, then move both to `docs/projects/archive/`.
      Do the same for the other demo/sandbox plans still in `docs/projects/active/` (`DEMO_TOUR_TRIM_PLAN.md`, the sandbox plans;
      list them at build).
- [ ] In-repo `memory/`: mark the demo memory files superseded and update `memory/MEMORY.md` in the same change.
- [ ] Board: `demo-decoupling`'s "remains" stops saying the live demo rebuilds itself; this project's line goes to its done
      state. The owner closes it.
- [ ] **Owner step:** delete `NEXT_PUBLIC_SEE_IT_LIVE_DOORS` from the Amplify console (inert after Phase 3; tidy only).

## Architectural Decisions

- **D1 — Shut the door in code, not by the Amplify variable.** **Rationale:** the variable hides the buttons but not the door
  routes, `/demos` or the pitch page, and reverting a commit is as quick as flipping a console variable and a rebuild. Phase 1
  can be undone by reverting its commit, and nothing irreversible happens before Phase 2.
- **D2 — Old addresses redirect permanently; they do not 404.** `/demos` was sent to industry contacts (2026-08-11) and the
  door addresses sit in shared links and QR codes. A permanent redirect to `/pricing` (the place to start) is the honest landing.
  The ruling's "a door that quietly lands elsewhere is a bug" is about buttons on our own pages, which are removed; an old
  address arriving from outside is a different case. **Owner ask A1 ruled A (2026-11-25): `/pricing`.**
- **D3 — The two demo slugs stay reserved** (`lib/reserved-slugs.ts`, the `lib/db.ts:1686` check, `prospect-clubs-server.ts:57`
  through a plain list rather than `isDemoOrgSlug`). **Rationale:** old links, QR codes and cached pages point at
  `/riverdale-minor-ball/...` and `/riverdale-ridge/...`. A real club that signed up under one of those names would receive a
  stranger's traffic labelled as a demo. Reserving two names costs nothing. `see-it-live` and `demos` stay reserved for the same
  reason. **The reserved list moves from `lib/demo-org.ts` into `lib/reserved-slugs.ts`** so it survives the deletion.
- **D4 — Production data is deleted by a script on the owner's yes, never by a weakened console.** The delete route's demo
  refusal is kept until the code that needs it goes. The script reports counts only.
- **D5 — The UAT test keeps its target through a `data-testid`,** not a surviving tour attribute. A `data-sandbox-tour` left
  behind would invite the next session to think the tour still exists.
- **D6 — The existing screenshots stay; their demo capture source goes.** A future re-shoot needs another source (a dev
  fixture org or a prospect world). That is new work when the owner wants it, not part of this project.
- **No plan gating.** No feature, key, price or tier moves (the ruling's drift check). The demo orgs' Tournament Plus comp ends
  with their data.

## Words for /marketing

> One pass, before the Phase 1 commit. Each line is a cut or a replacement; `/marketing` decides which.
> **Settled 2026-11-25** (one `/marketing` pass; the build session trimmed two walkthrough bodies to claims the persona pages
> already make). The pitch page is written for a prospect who **opens the link alone** (its own code says so, and it prints as
> a leave-behind), not for "a deck shown with us in the room" as this list first framed it.

- [x] Home page persona cards (tournament and coach): the "See it live" link — cut, or a walkthrough or screenshot link — prospects
      **Settled: CUT.** Both cards fall back to the whole-card link the League and Club cards use.
- [x] `/for-tournament-organizers` (two door buttons), `/for-coaches` (two door buttons) — cut or replace — prospects
      **Settled: CUT** all four buttons and both "No sign-up, no email…" lines; each page already links its walkthrough under the hero.
- [x] `/for-clubs`: the "Both halves are live today" demo block and the rep-teams card door — rewrite or cut — club buyers
      **Settled: CUT** the whole card (both variants) and the rep-teams link; the facts it sat beside are said elsewhere on the page, and no club demo is coming.
- [x] Pricing cards: "Not ready? See a live tournament first →" / "Not ready? See a coach's season first →" — cut or replace — buyers
      **Settled: REPLACE** with "Not ready? See the 90-second walkthrough first" → each product's walkthrough.
- [x] Footer: "Live demos" — cut — everyone
      **Settled: CUT.**
- [x] Pitch page: "A handful of screens, picked for one conversation — and a live demo behind every one of them." and "The demo
      is running right now." plus its button and printed address — rewrite for a deck shown with us in the room — prospects in a meeting
      **Settled:** sub "A handful of screens, picked for one conversation."; closing eyebrow "That was the pitch. Here’s where to go next.", title "Pick the plan that fits, when you’re ready.", body "Every plan and its price is on one page, and Tournament is free to start. Questions first? Email support@fieldlogichq.ca." (the contact constant); button "See plans and prices" → `/pricing`; printed address `fieldlogichq.ca/pricing`.
- [x] Walkthrough ending "The demo is running right now…" and the description "Walk the live demo yourself" — rewrite — prospects, search
      **Settled:** subs "Five jobs that stop being yours the day the tournament runs on FieldLogicHQ." / "The jobs the Coaches Portal takes off your plate, one screen at a time."; both eyebrows "That was the pitch. Here’s where to go next."; tournament "Your next tournament can run like this." + "Tournament is free to start: no credit card, no time limit."; coach "Your season, in one place." + "Roster, lineups, schedule, budget and team documents, from tryout day to the season’s end." (no "free": Premium is paid); SEO description: the closing sentence CUT, it ends on the last shown phrase.
- [x] Constraint (from the ruling): never imply a free try of the live product without signing up.
      Held: no line offers a try of the live product; "free" is said only of Tournament.

## Owner asks — RULED 2026-11-25 (owner: *"Ask 1 A, Ask 2 A, commit"*)

- **A1 — Where an old demo address lands. RULED A:** `/demos`, `/see-it-live` and `/see-it-live/coaches` permanently redirect
  (308) to `/pricing`. (Not chosen: B, the home page; C, a "not found" page.)
- **A2 — Who runs the production deletion. RULED A:** the building session runs the Phase 2 script on production, after the
  owner has seen its dry-run counts and said yes **in that session**. An earlier yes, including this ruling, does not carry
  over. (Not chosen: B, the owner runs it.)

## Open Questions

- [x] Which tests assert the doors render: answered at build (2026-11-25). Flipped: `demo-sandbox-door-and-chrome` (the S3
      block now pins the shut doors), `demo-sandbox-exit`, `public-face-s4-marketing`, `public-plan-pages-both-states`,
      `legal-acceptance-doors` and `pitch-slide-library` (the SEO description's closing sentence).
- [x] **Owner question (found at build): the coach walkthrough's "Start free" → the tournament sign-up. RULED 2026-11-25:**
      *"fix the coach walkthrough button now."* Each walkthrough now carries its own ask: Tournament keeps "Start free" →
      `/start/tournament`; the coach walkthrough says "Start now" → `/coaches/start?source=coach_walkthrough`, the
      `/for-coaches` button word for word, and becomes the same express-interest button while the Premium plan is off sale
      (the route reads the live gate). Pinned in `pitch-slide-library.test.ts`.
- [ ] Does any exclusion in Phase 3 depend on the demo list *instead of* `is_test_organization` for an org that is not a demo?
      (Check `platform-metrics.ts` and `free-time-*.ts` first.)
- [ ] Whether `capture-marketing-shots.mjs --check` still earns its place in `verify:changed` once the capture mode is gone.
