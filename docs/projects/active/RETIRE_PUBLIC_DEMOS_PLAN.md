# Retire the public demos — Implementation Plan

> **Status:** Planning (written 2026-11-25, nothing built; both owner asks ruled 2026-11-25, Phase 1 is ready to build)
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

- [ ] **The door routes stop signing anyone in.** `app/see-it-live/route.ts` and `app/see-it-live/coaches/route.ts` return a
      permanent redirect (308) to the page in Decision D2, and never call sign-in. The two switch screens
      (`app/see-it-live/switch/page.tsx`, `app/see-it-live/coaches/switch/page.tsx`) and `app/api/sandbox/switch{,-coach}/route.ts`
      redirect the same way (the switch endpoints refuse with 410).
- [ ] **The buttons go.** `sandboxDoorsVisible()` returns `false` in code, independent of the Amplify variable. Every gated door
      disappears together: `app/page.tsx`, `app/for-tournament-organizers/page.tsx`, `app/for-coaches/page.tsx`,
      `app/for-clubs/page.tsx` (the demo block and the rep-teams door), `components/PricingSection.tsx` ("Not ready? See … first"),
      `components/Footer.tsx` ("Live demos"), and the walkthrough buttons (`lib/walkthrough-content.ts:950,998` via
      `WalkthroughPage.tsx:115`). Where a page's layout leans on the door, Phase 1 places the `/marketing` replacement (or nothing).
- [ ] **`/demos` redirects** (308, Decision D2) instead of rendering. `app/demos/page.tsx` becomes a redirect;
      `app/sitemap.ts:30-31` drops it.
- [ ] **The ungated promises are re-worded** (`/marketing`): `components/marketing/ProspectDeckPage.tsx:38-46,99-105` ("a live
      demo behind every one of them", "The demo is running right now.", the `/demos` button and printed address);
      `lib/walkthrough-content.ts:980,1040` (closing text); `lib/walkthrough-derive.ts:48` (SEO description).
- [ ] **Tests.** Update `tests/unit/demo-sandbox-door-and-chrome.test.ts` and `tests/unit/public-face-s4-marketing*` (or
      whichever assert the doors render) to assert the doors are absent and the door routes redirect without signing in. The
      Phase 3 deletion removes the demo-only tests; Phase 1 must not leave them red.
- [ ] `/docs`: `lib/help-content/platform-admin.tsx:255,338,368-370,1933,1969` ("a demo club" as a reason a button is absent)
      leaves the help text in Phase 3, when the reason stops existing. It is listed here so the `/docs` pass is scheduled once.
- [ ] Verify: `npm run verify:changed`; a quick local check that the home page, pricing, the three persona pages, the footer, a
      walkthrough and a pitch page show no demo, and that `/see-it-live` lands on the D2 page signed out.
- **Walk:** none of its own. The owner looks at the five public pages once on staging, folded into the next release's public-page look.

### Phase 2 — Retire the production check, unschedule the jobs, delete the data (dev, then production)

Migration first, per the planning rules. Each automation change gets its own commit, with a message stating the behavior change
(AGENCY_RULES "shared agent automation"; the owner's ruling for this project covers these changes as its subject).

- [ ] **Migration `540_the_public_demos_stop_refreshing.sql`** (number re-checked at build): `cron.unschedule` the demo tournament
      tick and the coach tick jobs (scheduled in 224 and 226, made nightly in 273). Idempotent: unschedule only if present. Apply
      to dev; production goes with the Phase 2 release. Record it in `MANUAL_PROD_STEPS.json` if that is the route at build.
      Commit on its own: *"The two nightly demo refresh jobs no longer run."*
- [ ] **Dictionary and snapshots:** no table or column changes. Run `npm run refresh:snapshots` (dev and prod) after the apply,
      and `npm run check:dictionary`. If the dictionary lists the cron jobs, remove those lines in the same commit.
- [ ] **Retire the production demo check** before any data goes:
      - `check:demos:prod` and its steps in `.claude/commands/release.md` (around :159-177, :368-372, :399);
      - `check:demos` in `package.json` and `check-demos.mjs` from `verify:changed` (`scripts/verify-changed.mjs` or wherever it is
        wired);
      - the `reseed-demos-if-stale` step in `amplify.yml:119-126`.
      Its own commit: *"Releases no longer check or rebuild the public demos."*
- [ ] **A one-off retirement script,** `scripts/retire-public-demos.mjs`:
      - Dry run by default; `--apply` deletes; `--prod` requires the host guard used by the other prod scripts.
      - It deletes the two demo orgs with the **same purge the platform-admin delete uses** (`app/api/platform-admin/orgs/[id]/delete/route.ts`,
        storage included). The console's demo refusal stays in place until Phase 3, so the script calls the purge directly.
        It does not weaken the route.
      - It deletes the two shared auth users, and their sessions with them.
      - It prints counts only, never rows (the 2026-11-18 production-read rule). The demo data is fictional, but the
        script still reports counts, never rows.
- [ ] Run it on **dev** (`--apply`). Confirm the door routes still redirect and the public pages render.
- [ ] Run it on **production** only on the owner's yes in that session (Decision D4): dry run first, its counts shown to the owner,
      then `--apply`. Record it in the release history.
- [ ] Local fixtures that assume `riverdale-minor-ball` exists: `scripts/seed-public-frame-fixtures.mjs:6,191`,
      `scripts/layout-screens.mjs:2050-2054`, `scripts/seed-qa-day-fixtures.mjs:839`. Point them at a dev fixture org, or drop the
      demo screens from the layout list.

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
      - delete the `package.json` scripts `tick:demos` and `reseed:demos{,:dry}` (`check:demos*` went in Phase 2).
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

- [ ] Home page persona cards (tournament and coach): the "See it live" link — cut, or a walkthrough or screenshot link — prospects
- [ ] `/for-tournament-organizers` (two door buttons), `/for-coaches` (two door buttons) — cut or replace — prospects
- [ ] `/for-clubs`: the "Both halves are live today" demo block and the rep-teams card door — rewrite or cut — club buyers
- [ ] Pricing cards: "Not ready? See a live tournament first →" / "Not ready? See a coach's season first →" — cut or replace — buyers
- [ ] Footer: "Live demos" — cut — everyone
- [ ] Pitch page: "A handful of screens, picked for one conversation — and a live demo behind every one of them." and "The demo
      is running right now." plus its button and printed address — rewrite for a deck shown with us in the room — prospects in a meeting
- [ ] Walkthrough ending "The demo is running right now…" and the description "Walk the live demo yourself" — rewrite — prospects, search
- [ ] Constraint (from the ruling): never imply a free try of the live product without signing up.

## Owner asks — RULED 2026-11-25 (owner: *"Ask 1 A, Ask 2 A, commit"*)

- **A1 — Where an old demo address lands. RULED A:** `/demos`, `/see-it-live` and `/see-it-live/coaches` permanently redirect
  (308) to `/pricing`. (Not chosen: B, the home page; C, a "not found" page.)
- **A2 — Who runs the production deletion. RULED A:** the building session runs the Phase 2 script on production, after the
  owner has seen its dry-run counts and said yes **in that session**. An earlier yes, including this ruling, does not carry
  over. (Not chosen: B, the owner runs it.)

## Open Questions

- [ ] Which tests assert the doors render (Phase 1 needs them flipped, not deleted): list them at build with a grep for
      `sandboxDoorsVisible` and `see-it-live` under `tests/`.
- [ ] Does any exclusion in Phase 3 depend on the demo list *instead of* `is_test_organization` for an org that is not a demo?
      (Check `platform-metrics.ts` and `free-time-*.ts` first.)
- [ ] Whether `capture-marketing-shots.mjs --check` still earns its place in `verify:changed` once the capture mode is gone.
