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
- **Phase 2 — the moments dock. ✅ MOCKUPS APPROVED 2026-08-04, cleared to build.**
  Mockups: `TOURNAMENT_SANDBOX_PHASE2_MOCKUPS.html` (artifact
  `f8a2d820-31cb-409a-bbf0-91b7ceed933c`, rev 1) — **BINDING** for the dock, the jump, both new
  moments and the six-step tour; Phase 1 mockups + the tour-rebuild rev stay binding for
  everything else. Owner ratified, same message ("I agree with your recommendations"):
  - **Shape B — ONE org, THREE tournaments** (not three orgs, not a per-visitor overlay). The
    product's native multi-event model does the heavy lifting; every org-level Phase 1 guarantee
    carries over untouched. Both new moments are STATIC — they re-anchor dates through the same
    stateless reconcile, no cursor, no migration.
  - **Dock = slim third chrome row** ("The year": Registration week / Game day / The morning
    after), moment-aware countdown slot, jump narration through the existing strip.
  - **Tour 4 → 6 steps**; step 6 ends on the operator's Post-Event Summary (not the fan
    champions banner).
  - **Fee AMOUNTS shown in registration week** ($600 / $150 deposit / one past due); payment
    INSTRUCTIONS stay banned, as Phase 1 ruled.
  - **Names:** Riverdale **Season Opener** (ended yesterday) · **Summer Classic** (today,
    untouched) · **Invitational** (3 weeks out).
  - **No Digital Ledger sealing in Phase 2** (possible Phase 3 beat).
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

### Recorded 2026-08-03, the demo-UX investigation and rebuild

**Mockups rev 1:** artifact `f1fcaff5-7777-4a9f-a166-8557686214fc`. Approved by the owner
("go ahead") with the recommendations on Q1–Q6 taken as written. The Phase 1 mockups
(`118b8d75-…`) remain binding for everything this file does not supersede — the banner, the
blocked-save nudge family, the curated corners and both marketing doors are unchanged.

26. **The tour chips were not "subtle". Two of them were dead buttons, and the owner was right.**
    The previous investigation concluded the chips worked and only read as unclear. Measured against
    the running app, that was wrong, and the mechanism is worth remembering: a chip carried an
    `anchor` and an `href`, and fell back to the `href` when the anchor matched nothing. Both
    "watch a score" chips anchored to panels **the product removes whenever no game is live** — the
    fan page's Live Now section (`liveNowGames.length > 0`) and the dashboard's Now Playing strip
    (`if (gd.liveGames.length === 0) return null`). Their fallback href was *the page the visitor
    was already standing on*, so `router.push` produced **no scroll, no navigation, no tick and no
    feedback at all**. Measured: `scrollY 0 → 0`, URL unchanged.
    **The generalised rule, now pinned by a test: a tour step's proof may never be a panel the
    product is free to remove, and a fallback destination may never be the current page.**

27. **The redesign, in three moves.** (a) **Narration replaces rings** — every step ends in a
    sentence in the chrome saying what just happened, so the strip appearing is itself the visible
    change and no step can read as dead again. (b) **One four-step tour spans both halves** instead
    of two disconnected three-chip tours, so the flip into the organizer's seat arrives having
    watched a score come in as a parent; the continuity is the sale. (c) **A live pill** carries the
    score and a running *"changed 1:12 ago"*. Progress key bumped to `_v3` — the old per-side shape
    cannot be mapped onto the new one.
    **Deviation from the approved mockups:** the mockups showed a "Next →" control in the narration
    strip *and* the primary control in the stepper row. Built with one — two buttons doing the same
    thing eight pixels apart is the confusion this redesign exists to remove. The strip keeps the
    "← Back to the tournament" control, which is not a duplicate.

28. **The demo had been frozen for a full cycle, and three instruments called it healthy.** The
    database sat exactly 120 minutes behind the clock. Causes, all measured: migration 183's
    scheduler heartbeats on **dispatch** (`pg_net` is fire-and-forget), so `demo_sandbox_tick` read
    green one minute old while the app had not run the reconcile in hours; the probe's "anchored to
    today" compared only the **date** when the drift is in the **time**; and its "live score is
    current" tolerated ±2 while a stale row **saturates at the game's final score**, always within
    tolerance. Fixed: the reconcile now writes its own **`demo_sandbox_reconcile` arrival
    heartbeat** (from the core, so the command-line runner counts too), and the probe compares the
    semifinal's full timestamp and its **status**, which flips once per cycle and cannot coincide.
    The probe also now names the failure — dispatched N minutes ago, arrived never.
    ⚠ **The underlying delivery failure is environmental and still open:** the scheduler posts to
    the Vault-held `app_cron_base_url`, which does not reach this dev environment. Verified after
    the fix: dispatch 2 minutes ago, arrival 23 minutes ago (a manual run). **Until that URL is
    right for an environment, the demo only moves when somebody runs the tick by hand.**

29. **The fan side could never show its own bracket — and it was every customer's bug.** The
    overview gates the whole playoff presentation on `poolPlayComplete` (every non-playoff game
    terminal), but the seed deliberately leaves two U13 pool games open so "Needs a Score" and "Up
    Next" are not empty. So `playoffsSet` was **false forever**: zero `/playoffs` links on any page,
    and the generic hero instead of the playoff one. The tour's bracket step teleported strangers to
    a page the product had decided not to advertise.
    **Fixed for everyone, not routed around:** the bracket now has a **Playoffs tab** in all four
    nav surfaces (desktop rail, phone tabs, desktop top bar, and the shared list they now all read
    from). The test is **structural** — the organizer configured a bracket AND Standings is public —
    so the tab does not appear and disappear as pool play finishes, and it appears **exactly when
    the page renders**, which is the anti-dead-end rule. Costs one divisions query on tournaments
    whose register page is hidden; the common path is unchanged.
    ⚠ **Left alone deliberately:** the hero takeover still waits for pool play to finish. That
    rationale is sound for real customers (organizers pre-build brackets before the event) and
    changing it is a product decision, not a demo fix. ⚠ **Pre-existing and untouched:** a
    *playoff-only* tournament's `/playoffs` page hides itself, because it inherits Standings
    visibility and `isPublicPageEnabled` returns false for standings on playoff-only events. The tab
    correctly does not appear there either. Worth a separate look.

30. **The live score moved far slower than the promise.** Measured: during `semifinal-live` — 73% of
    every cycle — the visible score changed **9 times in 88 minutes**, a mean gap near ten minutes
    and a worst gap of thirteen, against a definition of done that says "a visitor sees a score move
    within two minutes". Two fixes, deliberately both: the pill's freshness reading (which re-proves
    the demo every second without anyone waiting), and **`deterministicBracketScore`**, which doubles
    the runs in bracket games only. Semifinal now ~18 changes / 88 min (mean ≈ 5 min, worst 7); the
    final ≈ 2 min. **Pool play is untouched on purpose** — standings, run differential and therefore
    the bracket's seeding come from pool games alone, so the seeding this change affects is provably
    none of it, and the probe's canonical-seeding check proves it on every run. Health stays 89.

31. **The "try to break it" beat landed on a closed drawer.** The schedule page collapses the
    Schedule Health panel by default (right for an organizer who opens the screen daily), so the
    tour rang a 53px strip reading "Show" with the drag invitation hidden behind a click nobody knew
    to make. In a demo org the panel now arrives expanded. Real customers untouched.

32. **⚠ Build notes 17 and the QA ledger were STALE and would have misled the QA pass.** Both said a
    visitor without the demo session sees two chips and no operator step. The shipped code — and its
    own unit test — always rendered three, pointing the third at the door. Verified in a clean
    window. The rule now: **the step count never changes with who is looking**; only where the
    operator steps point does.

33. **The rebuilt step 1 still lied, just more politely — owner's second QA pass.** *"When I clicked
    'watch the score change' the score did not change, it stayed 3-8."* The clock was running and the
    score DID move (8–3 → 9–3) — **five minutes later**. The button was written in the imperative
    present (*"Watch the score change by itself"*) for a payoff that arrives on the tournament's
    clock, so pressing it handed the visitor a static number and an unbounded wait. **Same class of
    defect as the original complaint, one layer up: a control whose label promises more than the
    press delivers.** Three fixes, and the third is the one that was missing all along:
    - **The label now names what the press does** — *"Show me the game that is live"*. The payoff is
      promised in the sentence beneath, not in the button.
    - **The wait is bounded and stated.** Because the demo's state is a pure function of the clock,
      the next run is not a guess: the beat now carries `nextChangeAtMs` and the narration reads
      *"Next run in about 1:32 — watch it land"*, or, past two minutes, *"— carry on, and it will
      flag itself."* A told wait is a countdown; an untold one is a dead demo.
    - **The run announces itself when it lands.** Previously the single most important moment in the
      whole sandbox passed in complete silence — the number was simply different next time anyone
      looked. The pill now highlights, reads *"just scored"*, and the sentence becomes *"There it is
      — now 11–4."* Polling dropped 30s → 10s so the announcement is prompt (the endpoint touches no
      database, so this costs nothing). **Verified live: pressed the step, waited 396 seconds without
      touching anything, and watched 10–4 become 11–4 with the highlight and the sentence.**
    ⚠ **Measured gaps between runs are four to seven minutes even after the ×2 bracket scoring.**
    Reaching the plan's "within two minutes" by scoring alone would need finals around 30–14, which
    is not a baseball score. The honest resolution is the countdown plus the announcement, plus the
    fact that the remaining three steps occupy the visitor while runs land behind them. **The copy no
    longer tells anyone to sit and watch.**

34. **Step 2 was pointing at the wrong page — the bracket isn't on the Playoffs page.** Owner, third
    QA pass: *"'see the bracket fill itself in' brings me to this screen, which doesn't show the
    brackets."* Correct. The product has two playoff surfaces and I sent the step to the wrong one:
    - **`/playoffs` is the Playoff Picture** — seeding, matchups and the numbers behind them. Its
      own "Full Bracket →" button points at Standings.
    - **The bracket DIAGRAM renders at the top of `/standings`** whenever playoffs are underway.
    So a visitor was told *"that final slot read Winner of SF1"* while looking at a page that never
    draws the slot. Step 2 now goes to `/standings`, rings the bracket block (a new inert
    `data-sandbox-tour="playoff-bracket"` hook), and the sentence says "championship slot" rather
    than naming a page. Verified: lands with the bracket centred, SEMIFINALS/FINALS and the
    unresolved "Semifinal 1 winner" slot on screen.
    **Also fixed, and it was a general defect in the tour machinery:** the ring fired on the next
    animation frame, before the destination had fetched its data — so a late-rendering beat was
    missed entirely, and when it did land the page was still growing, leaving the target half below
    the fold (measured: bracket at 568px of a 900px viewport). It now waits up to three seconds for
    the beat to appear and re-centres once the layout settles (measured after: 225px — centred).
    ⚠ **Product question for the owner, NOT changed here:** a fan looking for the bracket has to go
    to *Standings*, and the new **Playoffs** tab lands on the seeding write-up instead. That is the
    shipped information architecture, not something this project introduced — but the demo makes it
    obvious. Worth deciding whether the Playoffs tab should lead with the bracket.

35. **The demo is now SEALED — every door out is closed but two.** Owner request, 2026-08-03. Build
    note 25 had deliberately let a visitor walk out onto `/pricing` or `/discover` with the hat
    correctly coming off; the owner's ruling reverses that. **A prospect who wanders out of a demo
    they were told was a demo has simply been lost.** Audited live at 1440 and 390 across four fan
    pages and two operator pages, then re-audited to zero:
    - **Fan strip:** the FieldLogicHQ wordmark goes inert (plain text, not a disabled link — a
      control that looks pressable and isn't is worse than one that never invited the press);
      **Discover**, the **chat** icon, the **account** icon and **Sign In** are hidden.
    - **Phone bottom bar** (Home · Scores · Chat · Account) is **removed entirely** — all four were
      exits — and `--bottom-nav-height` drops to `0px` on the fan side so the page reclaims the 72px
      rather than ending in a blank strip. Scoped by a new `data-sandbox-side` marker on `<html>`,
      so the operator half (whose own admin bar already handles the sandbox) is untouched.
    - **Operator strip:** the shared brand lockup goes inert and the **account** door is hidden.
    - **"Built on FieldLogicHQ"** footer credit is not rendered in a demo.
    - **Kept, deliberately:** the ⇄ operator flip (the tour's own beat) and **"Start your own —
      free"** (the conversion path, always on screen).
    ⚠ **The nav bar is mounted by the ROOT layout, above the org layout that provides the sandbox
    context**, so it cannot use `useIsSandbox()`. It derives the answer from the first path segment
    via the same hardcoded allow-list — synchronous, so there is no flash of a door that then
    vanishes. Verified untouched for a real customer at both widths (wordmark still a link,
    Discover present, bottom bar visible, `--bottom-nav-height: 4.5rem`, `main` padding 72px).

36. **Walkthrough delivered in chat, not as a file** (owner preference, 2026-08-03): the narrative
    evaluation script — what you do, what you should see, what you are being asked to judge at each
    beat — as distinct from the ledger's tick-boxes. The open decisions it raised are recorded in
    the ledger's §5.2 judgement-call notes.

37. **✅ FIXED — "Up Next" used to empty in the late-evening cycles, and the sweep that proves it is
    now a script.** The `isUpNextToday` filler sat at `cycleStart + FINAL_STARTS_AT_MINUTE + 150` =
    **242 minutes**, two hours beyond the 120-minute cycle. For replays starting late in the evening
    that landed past midnight, on the day AFTER `eventDate`, so the dashboard's "today and still to
    come" bucket found nothing — about an hour a day, on the one screen the demo uses to argue that
    running a tournament is work. **Pre-existing; not introduced by the tour rebuild.** It survived
    because every spot check happened in the afternoon.
    **Fix:** the filler moves to `cycleStart + 150` — past the 120-minute cycle, so it stays ahead
    for the whole replay — and when a late start pushes even that past midnight it is clamped to
    `23:58` on the event date. A 10pm replay simply cannot have a game both later-today and two
    hours out; the day runs out first. The clamp leaves a gap only in the closing minute of that one
    replay, against roughly an hour before.
    **✅ `scripts/sweep-demo-sandbox.mjs` (NEW) — the guard that should have existed.**
    `check-demo-sandbox.mjs` asks "presentable right now?"; this asks "presentable at every hour?"
    across **84 moments** (12 cycle starts × 7 points, chosen to sit on the seam and the final-live
    tail). Asserts a live game, non-empty Up Next and Needs-a-Score, HEALTHY, zero conflicts, and
    the 89–92 band. **Negative-tested: reinstating the old placement produces exactly 4 failures,
    all "UP NEXT EMPTY" in the 00:00Z/02:00Z final-live tails.** After the fix: 84/84 pass and the
    **health range is unchanged at 89–92**, so the hard-won baseline survived the move.
    ⚠ **Run it after ANY change to the demo's times, durations, facilities or cycle structure.**

38. **The score ticker was sitting on the event title — and it was every customer's bug, on game
    day.** Owner, fourth QA pass: *"I don't think the header spacing was adjusted properly."* Right
    again, and it was not the sandbox chrome's fault. The tournament home's hero hand-composed its
    top clearance as `--nav-height + --ticker-h`, **omitting `--desktop-strip-h`** — the 48px
    platform strip that sits above the navbar on desktop. That is precisely the double-counting trap
    the composed `--chrome-top-*` tokens were introduced to end (*"no consumer has to hand-compose
    nav + ticker again"*, globals.css); this one consumer never migrated.
    **Why it hid for so long:** a pre-event hero is `70vh` and centres its content, which absorbs a
    48px shortfall invisibly. Only when the event is IN PROGRESS does the hero collapse to
    `min-height: auto` **and** the score ticker appear — and then the shortfall becomes the ticker
    painting over the event title. The demo is permanently in that state, which is why it surfaced
    there. **Measured on a real customer's in-progress event too: the title sat at 104px with the
    navbar spanning 48–120px — under the chrome, same bug.**
    **Fix:** the hero uses `--chrome-top-static-h`, which already composes nav + ticker + strip and
    deliberately excludes `--sandbox-chrome-h` (the document is padded by that separately, so adding
    it here would open a gap instead). Measured after: clearance **160px** = 72 + 40 + 48, title
    clears the ticker by 32px, `elementFromPoint` at the title's top edge returns the title itself.
    Real customer without a ticker: 120px = 72 + 0 + 48, also correct. **Below 900px nothing
    changed** — the live shell hides this hero and the page does the clearing.
    ⚠ **Fifth defect in this geometry band.** Every one has been an offset composed by hand instead
    of through the shared token. **Use `--chrome-top-static-h` for page padding and `--chrome-top-h`
    for fixed/sticky tops; never re-add the parts.**

39. **Dev server cache corruption during the session** (not a code defect): two `next dev` processes
    briefly co-existed, leaving `.next` corrupted and every route 500ing with *"Jest worker
    encountered N child process exceptions"*. Repaired by the documented sequence — stop the server,
    delete `.next`, restart. Recorded because the symptom looks exactly like a code failure and is
    not one.

40. **Results opened on an empty screen — changed for EVERY customer, at the owner's direction.**
    *"Default landing on results tab in admin is empty which is initially confusing as a user…
    maybe make that the default in production as well."* The page opened on `pending + submitted`,
    a scorekeeper's worklist. That reads well mid-game-day and badly at every other moment: land on
    a division whose games are all played — the morning after, a finished pool, or the demo, where
    every U11 pool game is complete — and it says **"No games found."** on a tournament with fifteen
    games in it. Untrue, and it arrives before anyone has learned a status filter exists.
    **Now opens on all three buckets.** Costs an organizer nothing — the chips sit above with live
    counts, so narrowing to "needs a score" is one click AND that click teaches the control, whereas
    an empty screen teaches nothing. **Existing organizers are unaffected:** the choice is remembered
    per tournament in the browser, so only a first visit to an unfiltered tournament changes.
    **Plus: the empty state is no longer a dead end.** Filter everything out and it now says
    *"6 games here — all hidden by the status filters above"* with a **Show all games** button; pick
    a stage with nothing in it and it says how many games are in the other stage and offers to
    switch. Verified live: lands with 10 rows and scores showing; forcing the empty state produces
    the message and the button, and pressing it restores the list.
    ⚠ **This is a production behaviour change on a shared admin screen, not a sandbox-only tweak.**

41. **`/simplify` + `/review` (2026-08-04) — the review caught the redesign telling the same lie in
    a new place, twice per cycle, for ever.**

    **`/simplify` (4 lenses): 10 applied, 3 skipped.** Notably: the bracket change had
    **de-parallelised** the tournament layout's two queries (one round-trip became two on the layout
    wrapping every public tournament page) → back to `Promise.all`; the live-beat poll and 1s tick
    now pause on a hidden tab; ring-retry timers got a ref + cleanup; `minuteOfNextRun` defers to
    `minuteScoreReached`; `formatSince` collapsed into `formatResetCountdown(ms, padMinutes)`;
    `ALL_RESULT_STATUSES` extracted; the five `!inSandbox` guards grouped; **`setTournamentNav` went
    from EIGHT positional args to an options object** (it had grown twice, and most params share
    types — a transposition would compile and fail silently); `poolKeyFor` exported and reused; the
    sweep now imports the app's real `isGameLive` (needed `lib/game-status.ts` to use an explicit
    `.ts` import — the very reason the older probe hand-mirrored the rule).
    *Skipped:* the pill's pulsing dot "duplicating" `.live-dot` (that glyph is the RED live marker;
    this is a green/amber freshness signal — reuse would misstate state); the row→metrics mapper
    shared by the two demo scripts (needs a home belonging to neither); refactoring the older probe's
    copied liveness rule (now unblocked, but the wrong moment mid-QA).

    **`/review` — high-risk tier, 4 lenses. Two HIGH findings, both real, both mine, both fixed:**
    - ⚠ **"Just scored" fired where nothing scored.** It keyed on "the score string changed", so the
      semifinal→final handover (14–6 → 0–0) and every replay rollover (9–7 → 0–0) announced
      ***"There it is — now 0–0."*** **The exact class of false claim this redesign exists to
      remove.** A run now means *the same two teams, still playing, with more runs on the board*,
      plus a silent re-baseline on returning from a hidden tab. Verified over a full cycle:
      **0 celebrations at 0–0, 32 genuine runs still announced**, both transitions silent.
    - ⚠ **The "next run in about m:ss" countdown promised a run that never lands.** The closing two
      minutes of every cycle predict minute 120 — but the Final is deliberately never completed, so
      the countdown hit zero and the tournament reset to 0–0 instead. Suppressed at the boundary;
      the banner's "Replays in mm:ss" already tells that truth.
    - **Regression caught by the blast-radius lens:** the admin tournament PREVIEW keeps its hero
      below 900px (the live page hides it), so `.page` and `.hero` both reserved the chrome — a
      **pre-existing double-pad my token change widened by 45px**. Zeroing the hero's padding under
      900px fixes both. ⚠ **The override had to sit AFTER the base rule** — a media query adds no
      specificity, so file order decides. Measured 174px → 0px at 390 and 860.
    - **Security/tenancy: clean.** The new public live-beat route touches no database and cannot be
      steered by its query param; `admin: true` on divisions was pre-existing and still org-scoped
      (only a boolean and an enum reach the browser); the Playoffs tab and the bracket page enforce
      the same predicate, so seeding cannot leak.
    - ⬜ **Confirmed real, pre-existing, NOT fixed:** a playoff-only tournament still cannot show its
      bracket (the page hides itself; the tab matches it, so nothing dead-ends), and the arrival
      heartbeat can move backwards if a manual reconcile races the cron (observability only).

    ⚠ **`check:layout` could NOT be completed.** Another agent's shared-stylesheet edits widened it
    to all 28 coach screens and it exhausted the dev server's heap mid-run. **None of those 28 is a
    surface this work touches.** These surfaces were verified by direct rendered measurement instead.

42. **✅ CLOSED — the bracket-only gap, plus a second miss it exposed in my own gate (2026-08-04).**
    Two tournaments could not show a bracket they plainly had, for two different reasons:
    - **Bracket-only events.** The playoffs page inherited `isPublicPageEnabled(…, 'standings')`,
      which force-returns false for that format — conflating *"the organizer hid Standings"* (a
      privacy choice that SHOULD take the bracket with it) with *"this format has no round robin"*
      (where the bracket is the entire tournament). So the one format most defined by having a
      bracket was the only one that could never show it. New `isPublicBracketVisible()` separates
      the two; a bracket-only organizer can still hide it, since Standings is their only lever.
      **The page and the tab now read the SAME predicate**, so the anti-dead-end invariant holds by
      construction rather than by two rules agreeing.
    - ⚠ **`visibleTournamentTabs` dropped Playoffs whenever Standings was absent** — it `continue`d
      past a hidden tab before reaching the insert. Bracket-only events strip Standings from the
      nav by definition, so the tab would still have been missing even after the fix above.
    - ⚠ **And my own structural gate was wrong.** `teamsQualifying >= 2` looked reasonable but that
      field is optional in real data: **a live customer tournament with twenty-nine playoff games
      already built** carries `{type:'single', crossover:'standard', hasThirdPlace:false}` and no
      count, so it was silently denied the tab. Now the test is presence of a playoff config, not
      its shape. *Found only because a browser check disagreed with an assumption.*
    Pinned by `tests/unit/public-bracket-visibility.test.ts` (8 tests). Verified live on all three
    shapes — bracket-only, round-robin-with-playoffs, and the real customer — with tab and page
    agreeing in every case. `lib/public-pages.ts` + `lib/tournament-phase.ts` moved to explicit
    `.ts` relative imports so these visibility rules are unit-testable at all (the third time today
    that extension blocked verification). Help guide updated with the bracket-only exception.

### Recorded 2026-08-04, building Phase 2 (the moments dock)

**Mockups:** `TOURNAMENT_SANDBOX_PHASE2_MOCKUPS.html` (artifact `f8a2d820-31cb-409a-bbf0-91b7ceed933c`,
rev 1) — approved with all five recommendations taken as drawn. Built same day. Phase 1 + tour-rebuild
specs stay binding for everything Phase 2 does not supersede.

43. **Shape B built: ONE org, THREE tournaments — and the product did most of the work.** The
    handoff leaned toward three orgs; measured against the product, that inverted. Multi-event
    orgs are the native model: the sidebar's "Editing Tournament" dropdown appears by itself at
    two events, fan URLs are per-event, `tournament_plus` has unlimited slots. Every org-keyed
    Phase 1 guarantee (write block, outbound silence, curation, chrome, sealed exits) covers all
    three events with zero changes. **Verified, not assumed:** platform-metrics excludes ALL of a
    demo org's tournaments (it queries the list, not the one slug), and robots excludes by org
    path prefix — both already covered the new events.
44. **The two new moments are STILL — dates only — and the reconcile stays ONE stateless job.**
    `lib/demo-moments.ts` defines them as pure functions of the clock (Opener always ended
    yesterday; Invitational always three weeks out, registrations re-anchored per team). The same
    diff-only reconcile drags their dates along: **proven by a future(+2d)/restore/steady
    round-trip against the dev DB — every date moved, moved back, then zero writes.** No cursor,
    no migration; mig 224's every-2-min schedule now carries the moments at ~zero cost.
45. **The chrome and the admin's tournament context talk through a narrow contract.** The chrome
    mounts ABOVE the provider, so: the provider stamps its current event on `<html>` + announces
    changes; the dock/tour announce selections; `?tournamentSlug=` was added to the provider's
    existing deep-link resolution (slug beats id for shareability — ids differ per environment;
    a general improvement, customer-usable). **Every sandbox link into the admin pins its event**
    because the tournaments list orders by year with unspecified tie order — an unpinned link
    lands on whichever event the context last held.
46. **The champion is crowned by the seed, never by the scoring path.** `announceChampionsIfComplete`
    fires only from the app's scoring service; the seed writes rows directly and sets
    `champions_crowned_at` itself — so the crown exists, no notification can ever fire, and the
    real announce path can never later claim an already-claimed timestamp. Champion is **Cedar
    Hollow Cyclones** — deliberately not the Classic's leading club; pinned by probe + test.
47. **Registration week's money story is division-level fee schedules, and one date does the
    work.** The U13 deposit deadline sits 5 days in the PAST (re-anchored daily), so exactly one
    accepted team that never paid its deposit reads Past Due, while U11's future deadlines keep
    its unpaid teams at Pending. The mockups' exact buckets — 2 review / 2 waitlist / 3 unpaid /
    **1 past due** / 0 missing-email — are pinned three ways, all through the app's REAL
    attention engine: the probe (live DB), the sweep (84 moments incl. midnight/DST seams), and
    unit tests. Fee amounts $600/$150 shown; payment instructions still banned (probe asserts).
48. **The Registration Health panel arrives expanded in a demo** (mirror of note 31's schedule
    panel — the panel IS step 5's destination). Tour anchors: `registration-health` on the
    panel (renders whenever teams exist — seed guarantees it), `post-event-summary` on the
    summary PAGE HEADER (renders in every page state), both chosen against the
    never-a-removable-panel rule.
49. **Deviations from the drawn mockups, all copy-detail:** the Opener's final is the engine's
    5–4 (Cyclones def. Rapids), not the illustrative 8–6; the pipeline holds 15 registrations
    (11 accepted + 2 pending + 2 waitlisted), not the drawn "13" — narration sentences updated to
    the seeded truth; the org home's "Upcoming Events" lists the Invitational and the Classic but
    not the completed Opener (product rule — the dock is its door, as ratified with no sealing).
50. **Verified by rendered measurement, not screenshots** (the standing rule): at 1440 and 390,
    both halves — chrome publishes its measured height, nothing paints over the banner
    (`elementFromPoint` at the banner), dock renders three moments with the right active tab and
    banner slot on all three fan pages; operator-side dock presses navigate, switch the editing
    context, flip the active tab + banner slot, and narrate ("three weeks back" / "day after it
    all ended"); health panel arrives open; summary anchor rings. ⚠ First measurement run showed
    two "failures" that were **dev-server cold-compile latency**, not defects — re-measured warm,
    all green. Contract tests: 43 existing pass unchanged + **17 new** in
    `tests/unit/demo-sandbox-moments.test.ts` (shape-B pin: the allow-list must still hold
    exactly one tournament org; year-order invariants; bucket counts; dock/tour rules).
    `sweep-demo-sandbox.mjs` extended per sample: **84/84, health range unchanged at 89–92.**
51. **Accepted, deliberately:** the Opener's team `registered_at` stamps sit at seed time and
    drift (visible only inside expanded rows of a locked, completed event); the operator ⇄ flip
    resolver was left untouched (product truth for multi-event orgs — dock/tour pins carry the
    moment alignment); the fan-side register form renders fully and submits into the Phase 1
    write block's existing refusal + toast.

52. **✅ `/simplify` + `/review` + `/docs` (2026-08-04, Phase 2).**
    **`/simplify` (4 lenses): 10 applied, 4 skipped.** Applied: pool-key formula unified into ONE
    parameterized `poolKeyFor` (its own docstring had warned against a second copy — and a second
    copy existed); the chrome↔provider contract constants moved to `lib/demo-org.ts` so the shared
    provider never imports from the demo chrome's module (dependency direction); date math,
    coach-email formula, and the Opener's slot pattern now derive from the Classic's exports
    instead of retyped copies; the seed's wipe + venue blocks became shared helpers used by all
    three events; the probe's contact rule extracted; the Invitational bucket plumbing became ONE
    helper in `demo-moments.ts` used by sweep + tests (an inline copy had already drifted onto
    hardcoded fee literals); the tour state became discriminated unions (`strip`, `pendingNav`) so
    "one strip, one voice" is type-enforced; moment keys derive from one array.
    *Skipped with reasons:* gating reconcile child-reads behind the window diff (would trade the
    2-minute self-heal for a 24-hour one to save ~5 tiny selects/2min on a demo cron); parallelizing
    the two moment blocks and per-row writes (non-issues per the efficiency lens's own weighing);
    a shared "demo-expanded panel" hook at two call sites (promote at the third).
    **`/review` — high-risk tier, 5 lenses (correctness, security, data-contract, concurrency,
    regression). Security and regression came back CLEAN — no path from sandbox machinery to a
    real customer. 7 findings confirmed and FIXED:**
    - ⚠ **[High] The dock's active-moment press was a silent no-op from that moment's own
      subpages** — prefix matching made `/standings` read as "already at game day", so the strip
      claimed "Back to game day" while nothing moved: the exact false-claim class this project
      exists to remove, reintroduced by my own "narrate in place" branch. Now "here" means the
      exact page; a subpage press navigates home. Verified live.
    - **[Med] A dock/tour selection arriving before the provider's first fetch resolved was
      silently dropped** (the press navigated but the editing context never switched and the
      narration never fired — a few-hundred-ms window exactly where a fast fan→operator visitor
      lives). Unmatched selections are now stashed and honoured when the list lands.
    - **[Med] The Opener's self-heal restored a hand-edited game's status/scores but not its
      submission trail** — contradicting the shared helper's own docstring; heals whole now, and
      the probe asserts provenance on every run.
    - [Low] 0-row updates during a reconcile-vs-reseed race logged as successful re-anchors
      (writes now confirm a row changed); leaving the operator half cleared the tournament stamp
      without announcing it (announced now); the probe's bucket check used an implicit "today"
      (explicit now); "← Back to game day" was hardcoded in org-agnostic chrome (per-kind now).
    *Refuted:* "payment_status mislabels deposit-paid teams" — the column's legal domain is two
    values; richer states are computed by the display layer. *Confirmed-as-intended:* dock presses
    narrate but don't ring anchors (the tour is the guided path); the slug deep-link is guessable
    but crosses no boundary (server-side org+assignment scoping); two tabs share the per-org
    editing memory (pre-existing product semantics).
    **Post-fix gate:** tsc 0 errors · lint 0 · 60/60 tests · probe all-green (incl. the new
    provenance assertion) · sweep 84/84 at 89–92 · High fix proven in the browser.
    **`/docs`: no help changes** — the demo stays undocumented while the doors are env-hidden
    (Phase 1 precedent), and no real-customer flow moved; nothing any guide says became wrong.

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
