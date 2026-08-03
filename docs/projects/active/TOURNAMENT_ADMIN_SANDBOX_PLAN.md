# Tournament Admin Sandbox — Implementation Plan

**Status:** Planned — **mockups APPROVED 2026-08-02, D1–D4 RATIFIED, cleared to build Phase 1.**
Companion brief: `TOURNAMENT_ADMIN_SANDBOX_PM_BRIEF.md`.
**Origin:** Ideas Backlog "Play With a Live One First" (organizer track), grounded 2026-08-02.
**Approved mockups (BINDING visual spec):** `TOURNAMENT_SANDBOX_MOCKUPS.html` — artifact
`118b8d75-1b83-4272-b9f2-bfe0ae9f7ddf`, rev 1, approved by the owner 2026-08-02 (*"this looks
good"*). Covers the sandbox chrome, the fan side, the game-day dashboard, the schedule editor +
drag beat, the blocked-save nudge family, and both marketing doors, each element labelled
NEW / RESTYLED / UNCHANGED. Section 2 of `DEMO_PREVIEW_MOCKUPS.html` was the prior *direction*
and is superseded by this file.
**GTM posture (binding):** `BUSINESS_DECISIONS.md` 2026-08-02 — *"The product demo is UNGATED at
the door."* No email/lead capture, ever; the gating is curation of which admin surfaces the
sandbox exposes. Revisit trigger 2027-01-01. Read that entry before proposing any door change.
**Sibling project:** `COACH_SANDBOX_SEASON_PHASES_PLAN.md`. Whichever sandbox builds first
implements the SHARED demo-mode machinery (demo-session entry pattern, central write block,
outbound silence, demo-org hygiene, re-anchor jobs); the other reuses it. As sequenced today,
THIS project likely builds it first.

## Product shape

A "See it live" door from the marketing site drops a prospect — no login, no email — into a
real, ticking demo tournament on **both sides of the product**:

- **The fan side** (public pages, already anonymous): live scores updating on their own,
  standings, the seeded playoff bracket filling in as the tick driver completes games.
- **The operator side** (the real admin portal, as a demo organizer): the game-day dashboard
  (Now Playing / Up Next / Needs a Score / Schedule Health), the schedule editor with the
  health score reacting to what-if drags, the bracket editor, the registration command center.
  One tap flips between "what you run" and "what parents see" — the dual view is the core
  sales beat.

Sandbox chrome: banner "Live sandbox — nothing here is saved · resets shortly · Start your own
free →", plus 3–4 guided-tour chips (e.g. ① scores tick on their own ② the bracket fills itself
in ③ try to break the schedule ④ this is what parents see).

**Canonical moment:** semifinal morning — pool play complete, bracket seeded, semis in progress
(the state the existing seed already produces well). **Optional Phase 2:** a moments dock like
the coach sandbox — "Registration week / Game day / The morning after" — pending owner call
after Phase 1 ships.

## Architecture

1. **Demo org + clean canonical seed.** Evolve `scripts/seed-live-tournament.mjs` from a
   dev-fixture *clone* (which drags along source-org clutter: stray teams, test payment copy)
   into a self-contained canonical seed: defined teams/divisions/venues/games, deterministic
   scores (existing strength/scoreFor pattern), no dependence on dev-test-org. Fictional
   contacts only; no real payment instructions.
2. **Tick driver + reset loop** (scheduled jobs, existing cron pattern): advance the live
   game(s) on a cadence; when the bracket resolves, hold the champions state briefly, then
   reset to the semifinal-morning snapshot (e.g. every 2 hours); daily date re-anchor so the
   event is always "today". Deterministic outcomes extend the existing scoreFor logic to
   bracket games. Alert on job failure (a frozen "live" demo is worse than none).
3. **Demo organizer session entry** (SHARED machinery with the coach sandbox — build once):
   fixed demo admin user, hardcoded allow-list, no redirect params, trusted-origin resolution,
   rate-limited. Blast radius: the session can only see the fictional demo org.
4. **Central write block** for the demo org across admin API routes (single chokepoint at the
   routing layer, structured `sandbox: true` rejection) + **outbound silence** (notify/email
   chokepoints no-op for the demo org).
5. **What-if drags — the one delicate UI slice.** The schedule/bracket editors persist drags via
   API calls today; under the write block a raw drag would appear broken (error/revert). The
   sandbox needs the editors to treat the `sandbox: true` rejection as "keep my local state,
   show the nudge" — a graceful catch at the shared fetch layer if feasible, else scoped to the
   two editors. Schedule-health recomputation already runs client-side against the in-memory
   games list (pure engine), so the health score reacting to a blocked-but-visible drag works
   naturally. This slice gets its own design + review attention; if it proves gnarly, Phase 1
   falls back to read-only editors + the public what-if beats, and the drag slice ships as a
   fast-follow.
6. **Marketing doors:** "See it live" beside "Start Free — No Credit Card" on
   /for-tournament-organizers, and on the homepage Tournament persona/module cards. A unified
   `/see-it-live` chooser (organizer | coach) is shared with the coach sandbox — whichever
   ships second adds the second branch. Copy via /marketing; GTM decision logged via /strategy
   when the door ships.
7. **Hygiene:** demo org excluded from /discover, admin metrics, and observability alerts —
   **plus search-engine exclusion of the demo org's public pages** (added 2026-08-02 with the
   ungated-door ruling). The fan pages are genuine public tournament pages; left alone they can
   be indexed and surface in searches for real events, or be mistaken for a real association.
   Plan tier for the demo org: **RATIFIED D2 — comped Tournament Plus**, using an existing comp
   mechanism (no "demo" plan, no new feature key, out of the price catalog and billing metrics).
   Any Plus-only capability visible in the sandbox stays honestly labelled as Plus.
8. **Curated surface — hide, never dead-end (RATIFIED 2026-08-02).** A defined set of admin areas
   is hidden in the sandbox rather than allowed to dead-end, for demo *quality*, not secrecy:
   **billing/subscription screens** (a comped org's billing page answers a question nobody is
   asking yet), **staff invitations** (fully outbound → a screen made entirely of locked controls
   reads as a broken product), **data tools / exports** (exporting invented data teaches nothing),
   and **deep settings forms** (long forms where a stranger cannot tell what changed). This is the
   binding archive-is-opt-in principle from `CLAUDE.md` — *hide the entry point rather than let it
   dead-end* — applied to a second surface. Everything else in the tournament module stays
   reachable: the demo is meant to show the product deeply, not defensively.

## Mockups-first gate (owner requirement) — ✅ CLEARED 2026-08-02

All four required screens were produced, labelled NEW / RESTYLED / UNCHANGED, and approved:
1. Sandbox banner + tour chips over the real public pages;
2. Admin-side sandbox: game-day dashboard + schedule editor with the write-block nudge and the
   "flip to fan view" affordance;
3. The blocked-save nudge moment (copy + placement);
4. Marketing door placement on /for-tournament-organizers and the homepage.

**`TOURNAMENT_SANDBOX_MOCKUPS.html` (artifact `118b8d75-1b83-4272-b9f2-bfe0ae9f7ddf`, rev 1) is
now the BINDING visual spec.** Build to it; flag any deviation the code forces rather than
quietly diverging. Copy in the mockups is a working draft — the *shapes and placements* are what
was approved; final wording goes through `/marketing` before the door opens.

## Rollout

- **Phase 1:** clean seed + tick/reset/re-anchor jobs + demo session entry + write block +
  outbound silence + banner/chips + public experience + admin dashboard read + curated-surface
  hiding + hygiene (incl. search exclusion) + doors (dev only; prod rollout is a separate release
  decision).

  **Ratified slice order (2026-08-02)** — deliberately puts the block before the door, so the
  guarantee is proven before anyone can walk in. **Build status as of 2026-08-03:**

  | # | Slice | Status | Why here |
  |---|---|---|---|
  | S1 | Self-contained canonical seed | ✅ **BUILT + VERIFIED** | Everything downstream depends on it being clean and deterministic through the bracket |
  | S2 | Demo-org identity + central write block + outbound silence | ✅ **BUILT + VERIFIED (22 contract tests)** | **Verified before the door exists** |
  | S5 | Reconcile job (tick + replay + re-anchor in one) | ✅ **BUILT + VERIFIED**; **SCHEDULED 2026-08-03 (mig 224, every 2 min, DEV-ONLY — prod-pending)** | A frozen "live" demo is worse than none |
  | S3 | Demo-organizer session entry | ✅ **BUILT** (15 further contract tests) | One fixed account, hardcoded, rate-limited, no request-influenced target |
  | S4 | Sandbox chrome (banner, chips, countdown, toast catch-all, locked outbound) | ✅ **BUILT** | Public + admin, from one mount in the org shell |
  | S6 | Hygiene remainder — metrics, observability, **search exclusion**, curated-surface hiding | ✅ **BUILT** | Directory exclusion was already in the seed |
  | S7 | Marketing doors, dev only | ✅ **BUILT, env-flagged OFF in production builds** | Prod promotion is a separate owner call |
  | 1b | The drag beat | ✅ **BUILT — it did not fight** | The fence was not needed; see Build note 12 |

  **Phase 1 is code-complete on dev and UNCOMMITTED. Browser QA by the owner is outstanding for
  every slice, including S1/S2/S5.** The handoff that produced S3/S4/S6/S7/1b is
  `TOURNAMENT_ADMIN_SANDBOX_BUILD_PROMPT.md`.

### What S1 / S2 / S5 actually delivered (dev only, uncommitted)

- **A self-contained seed.** Builds the org, the one demo organizer, 2 divisions, 8 teams, 1 venue
  with 4 diamonds and 15 games from first principles. No clone of the dev fixture, no inherited
  clutter, no payment copy, every contact an unreachable `@example.com` address. Refuses to run
  against production without an explicit flag. The U11 bracket is seeded by running the app's OWN
  standings engine, so the demo's bracket is provably the bracket the product would produce.
- **A write block at the request layer**, above every route, redirect and session check, returning
  a structured `sandbox: true` rejection. Plus the enumerated body-identified exceptions
  (registration, following) which carry the guard themselves and are pinned by a decision-point
  test list.
- **Outbound silence at three independent chokepoints** — in-app/email notifications, marketing
  email, and the anonymous fan-alert pipeline. That third one is not optional: the demo's scores
  change on a schedule and a comped org passes the plan gate, so without it a score alert would
  reach real devices every cycle.
- **One stateless reconcile job** that is the tick, the reset and the date re-anchor at once, plus
  a command-line runner and a `check-demo-sandbox` health/staleness probe that asserts the demo is
  presentable (live game present, dashboard non-empty, bracket correct, schedule healthy).
- **Measured, not assumed:** the schedule scores **89–92 and reads HEALTHY at every hour of the
  day with zero conflicts**, verified across all 72 cycle-start × phase combinations.
- **Phase 1b (flagged slice):** what-if drags in schedule/bracket editors with graceful nudge.
- **Phase 2 (owner call):** moments dock (Registration week / Game day / The morning after) —
  registration-week needs a second seeded tournament state with pending teams/payments in the
  command center.
- **Phase 3:** polish — QR/share collateral, /see-it-live chooser if coach sandbox hasn't built
  it.

## Build notes — deviations from the plan and the approved mockups (2026-08-02)

Recorded as they were made, per the "flag anything the code forces me to deviate from" commitment.
None change an approved *shape or placement*; all are consequences of how the real engines behave.

1. **Three scheduled jobs became ONE.** The plan called for a tick driver, a reset loop and a
   nightly date re-anchor. Because the demo's state is computed as a pure function of the clock
   (dates included), those are the same operation observed over different timescales: run it twice
   in five minutes and it is a tick; either side of a cycle boundary and it is a reset; tomorrow
   and it is a re-anchor. **Materially better for the "never frozen" requirement** — the job is
   stateless, idempotent and self-healing, so a missed or half-finished run is repaired by the next
   one rather than leaving a stuck cursor. Also means no cursor table, so no migration.
2. **No champion is ever crowned.** The plan said "hold the champions state briefly, then reset".
   The Final now goes live and the cycle resets before it ends. Two reasons: a landing state of
   "this tournament is over" sells nothing, and crowning would reach for the champions/notification
   path the sandbox must never touch. Every score including the Final's is still deterministic, so
   the loop is exactly repeatable — the story simply stops before the last out.
3. **Game times float with the clock; they are not literally 9:00 AM / 2:15 PM.** Liveness in this
   app is decided by a game's time WINDOW, not a status flag, so the only way to have something
   live at 11am and at 11pm is to anchor the semifinal to the current cycle. The mockups' clock
   times were illustrative; the STATE they depict (one semifinal live, one final, the Final
   awaiting a winner) is exact and is what was built.
4. **Four diamonds, not two, and pool play at midday.** Both forced by the real schedule-health
   engine. Two diamonds made the divisions contend for fields; morning pool play gave every real
   team three "early" games while the Final's unresolved slot had none, and the resulting spread
   cost 12 points. Measured across all 72 cycle-start/phase combinations the schedule now scores
   **89–92 and reads HEALTHY at every hour of the day, with zero conflicts** — the mockup's 92 is
   the top of that range, and the "break it" beat has something intact to break.
5. **The U13 team names differ from one filler line in the mockup** ("Hawks U13"). The seed uses
   the consistent four-club Riverdale world throughout. Copy detail, not a spec element.
6. **The write block is a chokepoint PLUS one enumerated exception.** The proxy identifies the org
   from the URL, which covers every authenticated admin and coach write (the app has no server
   actions — everything goes through `/api/*`). Public registration names its org in the request
   BODY via a tournament id, which middleware cannot read, so that route calls the guard itself.
   The mockups' "single chokepoint" claim holds for everything reachable from the sandbox UI; the
   honest phrasing is "one chokepoint plus registration".

### Recorded 2026-08-03, building S3 / S4 / S6 / S7 / 1b

7. **The door never clobbers a visitor's existing session.** *(S3, new deviation.)* The mockups'
   flow assumed a logged-out prospect. If somebody who is already signed in presses "See it live",
   establishing the demo session would replace their auth cookies and sign them out of their own
   account — a genuinely destructive act for a marketing button. The door therefore checks for an
   existing session first and, if it finds a non-demo user, hands them the **fan page** and leaves
   their cookies alone. They lose nothing they don't already have: they own the operator half for
   real. A logged-out visitor — the entire target audience — is unaffected.

8. **Tour chips navigate when they cannot point.** *(S4.)* The mockups show a chip scrolling to a
   beat and ringing it. Two of the six beats live on other pages (the bracket is its own tab; the
   schedule editor is its own screen), so a chip carries an anchor AND a destination: it rings the
   beat when it is on this page, and navigates when it isn't. No chip is ever a dead button — that
   is pinned by a test. Only three `data-sandbox-tour` attributes were added to real screens; the
   public page's own `#live-now` section id did the rest.

9. **The four curated corners resolved to three nav keys.** *(S6.)* `settings` is the Settings &
   Access hub and carries **three** of the four ratified corners at once (subscription, staff
   invitations, registration-field builder). With `settings/event` (the deep event form) and
   `data-tools` (exports) that is the whole list. **Judgement call worth the owner's eye:** hiding
   `settings/event` follows the ratified wording ("deep settings forms") but does cost the demo one
   genuinely product-y screen. Easy to reverse — one line in `lib/sandbox-curation.ts`.

10. **Metrics exclusion is by org AND by the sandbox's own event.** *(S6.)* Most tables scope by
    `org_id`, but `teams` hangs off a tournament, so eight invented teams would have kept counting.
    Both exclusions are resolved once per request and fail QUIET — a broken lookup leaves the
    numbers momentarily off by one sandbox rather than taking down the platform overview. Error
    alerting is suppressed for demo orgs but the error is still RECORDED, so a stranger tripping a
    500 in the sandbox is a bug report we can act on rather than a 2am page.

11. **The marketing doors ship behind an environment flag, not a code branch.** *(S7.)* Visible in
    local development, hidden in any production build, overridable by
    `NEXT_PUBLIC_SEE_IT_LIVE_DOORS`. Amplify builds every branch with `NODE_ENV=production`, so a
    deployed dev branch also hides them until somebody sets the variable deliberately — which is
    exactly the release step the plan describes, expressed as an action rather than a hope. The
    door itself (`/see-it-live`) is always live wherever the sandbox is seeded, so the owner can
    walk the demo before anyone can find it.

12. **The drag beat did not fight, so the fence was not needed.** *(1b.)* The editor already moved
    the game optimistically; what snapped it back was the `refresh()` that followed the save. In
    the sandbox the save returns the `X-Sandbox-Blocked` marker, so the editor applies the change
    to its in-memory list and **skips the refresh** — the visitor's move stays on screen and the
    health engine, which already recomputes in the browser, scores it correctly with no new maths.
    One branch, one file. The mockups' "Put it back" is a re-read of the server's untouched copy,
    so a visitor can never wedge the demo for themselves. **The BRACKET editor was not touched** —
    inline bracket editing is still a planned project, so there is no drag there to catch yet.

### Recorded 2026-08-03, first owner QA pass

14. **The banner was invisible on public pages — geometry, not code.** The chrome pins itself to the
    top of the viewport and publishes its height so everything else pinned there drops below it. The
    OPERATOR bars were taught that; the PUBLIC ones were not, so the site navbar painted straight
    over the banner and the visitor saw an orphaned chip rail with no promise, no countdown and no
    CTA. Fixed by giving the navbar, score ticker, side rail and both alert prompts the same term
    the operator strips already carry. **This is the failure mode to watch: it is silent — the
    banner keeps its space, something just covers it.** Any new top-pinned chrome must carry the
    term. (Page PADDING deliberately does not: the document is already padded once, and adding it
    twice opens a gap.)

15. **A signed-in visitor met a login loop, and it was older than this project.** The admin shell
    treats "not signed in" and "signed in but not a member of THIS org" identically and sends both
    to the login page — which sees a valid session with a workspace, honours the `next`, and sends
    them straight back. Any signed-in person typing any other org's `/admin` URL could hit it; the
    sandbox merely put it one tap from a public page. The shell now splits the two: no session →
    login, wrong session → their own workspace. **General fix, not a sandbox fix.**

16. **The tour chips were ticking on click, which made them lie.** A chip claimed "done" whether or
    not the visitor saw anything, and because two of three beats live on other pages a visitor could
    collect three ticks having seen nothing. Now a chip earns its tick on DELIVERY — an on-page beat
    when it has been scrolled to and ringed, an off-page beat after the navigation lands. Chips also
    say which kind they are (an arrow means it travels), the ring holds for its whole duration
    instead of pulsing through invisible, and the progress key was versioned so stale ticks from the
    old behaviour don't carry over. Shapes and placements are unchanged — this is behaviour only.

17. **The tour no longer offers a door it cannot open.** "See the organizer's side" appears only
    when the visitor actually holds the demo organizer's session. Anonymous visitors and customers
    signed in as themselves get a two-beat fan-side tour instead of a third step that walks into a
    wall. Costs one session lookup, taken ONLY on the demo org so no real customer's public page
    pays for it. ⚠ **This is the fallback shape while the open question below is unanswered** — if
    the door is later allowed to take over a session, the chip becomes universal again on its own.

**⬜ OPEN QUESTION FOR THE OWNER (raised 2026-08-03):** what should the door do when the visitor is
ALREADY SIGNED IN? Today it refuses to replace their session (Build note 7), which costs them the
operator half. Options put to the owner: (a) ask once, with a plain warning — the recommendation,
and not a violation of the ungated ruling because it warns a customer rather than collecting
anything from a stranger; (b) always take over; (c) keep today's behaviour, with note 17 as the
permanent shape.

### Recorded 2026-08-03, adversarial review + `/marketing` pass

19. **The write block had a live bypass, and it is the most important thing in this document.**
    Percent-encoding one character of the slug (`%72iverdale-…`) read as "not a demo org" at the
    chokepoint and as the real demo org at the handler, because `URL.pathname` keeps `%XX` while the
    router decodes it. Proven live — the encoded request returned the ROUTE's 401 instead of the
    guard's 403. With a demo session, which the door hands to anyone, that was a real write against
    the sandbox. Fixed by decoding each segment once, mirroring the router; re-verified live against
    four variants; pinned by a regression test. **The lesson generalises: any guard that reads a URL
    must decode exactly the way the router does, or the two will disagree.**

20. **A second write path existed that the chokepoint can never see.** `/api/events/league` takes
    its org from the request BODY and can also attribute a row to the ACTOR alone — so there is no
    org for the guard to refuse. Guarded on the actor instead (the demo organizer must never write
    anything, anywhere), and a second decision-point list now pins it alongside the body-identified
    one. It could only ever write an instrumentation row, never customer data.

21. **The demo-org id cache could permanently defeat outbound silence.** A lookup made before the
    seed ran cached "there are no demo orgs" for the life of the process — and that cache is what
    `notify()` and the fan-alert pipeline consult before sending. A warm server that once saw a
    pre-seed state would have answered "not a demo org" forever and let the demo's scores reach real
    people. Now only a COMPLETE resolution is cached.

22. **The door's failure branches ran before its rate limiter**, so an unseeded environment could be
    hammered for uncapped queries and uncapped `critical` alerts. Metering now happens first, and
    "not seeded here" — a standing condition, not an event — pages once per process.

23. **Copy pass (`/marketing`).** The mockups' wording was always a working draft; this is the pass
    they called for. Notable changes: the fan banner leads with what it IS ("A real tournament,
    running right now") before the caveat; the operator banner says "You're in the organizer's seat"
    rather than naming our plumbing; chips lost our vocabulary ("tick", "land", "Flip") for the
    reader's ("update on their own", "come in", "See what parents see"); "Break the schedule" became
    "**Try to** break the schedule" so it reads as an invitation rather than an instruction; and the
    confirm screen's footnote lost a clause that was arguing with itself.
    **The one term change worth knowing about: "LIVE SANDBOX" → "LIVE DEMO" in customer-facing copy.**
    *Sandbox* is developer vocabulary and this audience is volunteers. **The code, the plan and the
    project name all keep "sandbox" — this is the visible label only.**

24. **The clock is now scheduled — migration 224, DEV-ONLY.** S5 built the reconcile route but
    nothing called it, so the demo only moved when somebody ran it by hand; the first QA pass found
    it frozen, twice. `224_demo_sandbox_tick_schedule.sql` schedules it **every two minutes**, reusing
    migration 183's existing tick wrapper wholesale (Vault base URL + shared secret, async dispatch,
    and a heartbeat row the platform-admin observability freshness chip already reads — so a stopped
    demo now surfaces where every other stalled job does).
    **Two minutes because the plan's definition of done is "a visitor sees a score move within two
    minutes"** — the cadence has to be at least as fast as the promise. The cost is near zero: the
    reconcile is diff-only, so a run the clock implies no change for writes nothing.
    ⚠ **Adds no tables and no columns, so — like migs 122 and 183 — `check:migrations` CANNOT detect
    prod missing it.** It is PROD-PENDING and belongs to the sandbox's production release step.
    Harmless to apply early: an environment with no demo org seeded is a successful no-op, and the
    day one is seeded the schedule simply starts working.

25. **Not built, deliberately: a sandbox banner on non-org pages.** The chrome mounts from the org
    shell, so it covers every page under `/{orgSlug}` — the whole sandbox. If a visitor navigates
    to a platform page (`/pricing`, `/discover`) they leave the sandbox and the hat correctly comes
    off. Nothing is left un-hatted *inside* the demo.

## Risks

- Editors' drag-persistence under the write block (mitigated by the flagged slice + fallback).
- Seed determinism must extend to bracket play-out or the reset loop produces inconsistent
  states.
- Tick cadence vs. public pages' refresh interval: the "alive" feel rides the existing ~30s
  polling — set expectations accordingly (fine at sandbox pacing).
- Shared-machinery coordination with the coach sandbox chat: the demo-session/write-block/
  silence pattern must be built ONCE and shared — coordinate via the plans and the owner.
- Do not run destructive seed/reset scripts against prod during development; prod demo org
  creation is an explicit release step with the owner.
- **Search indexing (added 2026-08-02).** The demo org's fan pages are genuine public tournament
  pages. Left unmarked they can be indexed and surface in searches for real events. Search
  exclusion is part of the hygiene slice, not an afterthought.
- **Traffic abuse, not competitive exposure, is the real open risk** (the competitive question was
  put to the owner 2026-08-02 and closed — see `BUSINESS_DECISIONS.md`). One shared no-login door
  is a scraping target; rate-limiting is in scope and nothing is writable, so the exposure is read
  load on one small tournament. Watch it, don't gate for it.

## Owner decisions — ✅ ALL RATIFIED 2026-08-02

Logged in full in `BUSINESS_DECISIONS.md` (2026-08-02 entry). Do not re-litigate.

| # | Decision | Ratified answer |
|---|---|---|
| D1 | Demo org/tournament naming | **Riverdale Minor Ball Association** running the **Riverdale Summer Classic**; teams Rapids / Cyclones / Marauders / Sharks. Extends the existing "Riverdale" fictional convention (Chunk-G coach budget sample) so both sandboxes share one invented world. All contacts invented. |
| D2 | Demo org plan tier | **Comped Tournament Plus** via an existing comp mechanism. Not a repricing, not a new SKU, no new feature key; out of the price catalog and billing metrics. Plus-only capabilities shown stay honestly labelled as Plus. |
| D3 | Reset cadence | **2-hour replay + nightly date re-anchor**, with a visible `mm:ss` countdown in the banner (the countdown is the proof it is running, not recorded). |
| D4 | Phase 2 moments dock | **Deferred, not cut.** Ship the one canonical moment first; registration-week needs a second seeded state and is better designed after watching real prospects. |
| — | Gating the door | **Ungated. No email, no form, no lead capture — ever.** See the GTM posture entry; revisit trigger 2027-01-01. |

## Effort

M/L. The public half is nearly free (anonymous live pages exist; seed exists as a base). The new
work is the clean seed, the scheduled driver, the shared demo-mode machinery, and the flagged
editor-drag slice.
