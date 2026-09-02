# Tournament Sandbox — Daily Snapshot (retiring the live-scoring cycle)

**Status:** In progress — 2026-09-02
**Owner call:** the "See it live" tournament demo (`riverdale-minor-ball`) stops simulating a
scoreboard that moves while a visitor watches. It becomes a once-a-day snapshot, exactly like the
coach sandbox (`riverdale-ridge`) already works. Reverses the 2026-08-02 product-shape decision
("a real, ticking demo tournament") and the D3 ruling in the archived
`TOURNAMENT_ADMIN_SANDBOX_PLAN.md` — both were deliberate and QA-iterated, not oversights; recorded
here as a considered reversal, not a correction.

## Why

Triggered by an AWS cost review (2026-09-02): the tournament demo's live-tick cron
(`pg_cron` → `/api/platform-admin/demo-sandbox-tick`, every 2 minutes, on both dev and prod) plus
its client-side polling (every visitor's browser hitting `/api/sandbox/live-beat` every 10 seconds)
were a meaningful share of the month's ~103,000 Amplify requests. Investigation showed the dollar
savings from removing this alone are small (the whole AWS bill was $10.81 for the month) — the real
reason to do this is product philosophy, stated directly by the owner: **the sandbox is read-only
(a visitor can never write to it), so it exists for exploring functionality, not for watching a
number move.** The live-scoring illusion was expensive to build and maintain (see the archived
plan's QA history — multiple owner passes fixing "the score didn't move when I watched") for a
payoff nobody asked for going forward.

## What changes for a visitor

- **Today:** load the demo and a semifinal is visibly mid-play, the score ticks up over the
  minutes, a banner counts down to the next "moment," a tour step says "nobody typed this score in
  — it updates on its own."
- **After:** load the demo any time and it looks like a snapshot of a real tournament day — both
  semifinals played and final (real scores, no animation), the championship bracket slot filled in
  with the real winner's name, and the final itself sitting scheduled later that day, not yet
  played. The whole picture re-anchors to "today" once a night. No countdown, no "changed 90 seconds
  ago," no live dot anywhere — matching exactly how the coach sandbox already presents itself.
- No visible change to the coach sandbox.

## Design

`resolveDemoState(now)` currently anchors to a rolling, real-time 2-hour cycle (`DEMO_CYCLE_MINUTES
= 120`) and steps scores up minute by minute via `partialScore`. It becomes a **fixed daily
snapshot**: every game's date is still `now`-anchored (so "today" always re-anchors on the nightly
run), but the *hour* each game sits at is now a fixed constant, and no game's score is ever partial.

Fixed hours (all "today," org timezone, chosen to avoid the schedule-health engine's "edge game"
penalty — before-noon / after-5pm — the same reason pool play sits at noon/2pm rather than 9am/11am):

| Game | Hour | Status | Score |
|---|---|---|---|
| SF2 (seed2 vs seed3) | 12:00 | completed | real final score |
| SF1 (seed1 vs seed4) | 14:00 | completed | real final score |
| Final (seed1 vs seed2's-slot) | 16:00 | scheduled, seeded | null — not yet played |
| "Up Next" filler (U13) | 17:00 | scheduled | null |

("Up Next" moved to 17:00 — after the Final, not before — during build: at 15:00 the dashboard's
"Up Next" card went empty for hours every evening once that game's own window passed with nothing
later scheduled to replace it. 17:00 is the last hour still inside the schedule-health engine's
safe band, so it's the latest this fix could push the gap without a bigger redesign.)

The Final's home slot is **always** seeded with the top seed's real name (no more "Winner SF1"
placeholder state — that transition happened before any visitor could arrive, so tour copy that
described *watching* it fill in is rewritten to describe the *capability* instead of a witnessed
event). Pool play is unchanged (still 2 days / 1 day before "today," same deterministic scores).

Removed entirely as dead code once nothing is ever "live": `DEMO_CYCLE_MINUTES`, `cycleStart`,
`minuteInCycle`, `phase`/`DemoPhase`, `finalIsSeeded` (folds to unconditional), `partialScore`,
`resolveDemoLiveBeat`/`DemoLiveBeat`, the `/api/sandbox/live-beat` route, and the chrome's
countdown + live-pill polling machinery (a real secondary win: that polling ran every 10 seconds
per visitor tab, which was itself adding to the request count this whole investigation started
from).

Copy rewritten (no longer claims motion): the "Game day" moment ("...is live right now"), the tour's
step 1 ("nobody types these scores in — updates on its own") and step 2 ("...finishing the game did
it"), the banner countdown, the live dot. One marketing screenshot (`fan-live-score`) pointed at the
`#live-now` section, which will now never render for the demo (SF1 is always `completed`, never
mid-window with `scheduled` status) — retargeted to the standings page's bracket diagram, which now
reliably shows the filled-in slot.

**Precedent already litigated:** `lib/sandbox-chrome.ts`'s coach-moments comment records that
dropping a "live" claim risked reading as inert ("they don't seem to do anything," owner QA, three
times, on an early coach mockup) — but the shipped decision there was still to never claim motion
the clock won't deliver. This change brings the tournament sandbox in line with that same, already-
accepted tradeoff.

**Cron:** `demo-sandbox-tick` reschedules from `*/2 * * * *` to once daily (matching the coach
sandbox's `coach-sandbox-tick` pattern) via a new migration — `cron.schedule` upserts by jobname, so
no `cron.unschedule` is needed. New migration, dev first; prod apply is a deliberate release step
like the original 224/226 (adds no columns, so `check:migrations` cannot see it — track as
prod-owed until applied).

**Follow-up (not in this change):** `CLAUDE.md`'s demo-sandbox section should get a note at the next
release describing the new no-live-cadence design, per that doc's own convention of recording
sandbox-affecting changes.

## Files touched

- `lib/demo-tournament.ts` — core state function rewrite (see design above)
- `lib/demo-reconcile.ts` — `finalIsSeeded` → unconditional; doc comments; `DemoReconcileResult`
  drops `phase`/`minuteInCycle`
- `app/api/platform-admin/demo-sandbox-tick/route.ts` — audit payload + doc comment
- `app/api/sandbox/live-beat/route.ts` — deleted
- `lib/sandbox-chrome.ts` — moments/tour copy, drop `isLive`/`watchesLiveScore`/countdown helpers
- `components/sandbox/SandboxChrome.tsx` — remove countdown + live-pill polling UI and state
- `app/[orgSlug]/layout.tsx` — drop the now-removed `cycleMinutes` prop
- `lib/marketing-shots.ts` — retarget the live-score shot
- `lib/walkthrough-content.ts` — fix stale internal comments (2-minute re-anchor)
- `tests/unit/demo-sandbox-moments.test.ts`, `tests/unit/demo-sandbox-door-and-chrome.test.ts`
- `scripts/seed-demo-tournament.mjs`, `scripts/check-demo-sandbox.mjs`,
  `scripts/sweep-demo-sandbox.mjs`, `scripts/tick-demo-sandbox.mjs`
- New migration: reschedule `demo-sandbox-tick`

## Verification

`npm run typecheck`, `npm run lint:focused` on changed files, the two sandbox unit test files,
`node scripts/sweep-demo-sandbox.mjs` and `node --env-file=.env.local scripts/check-demo-sandbox.mjs`
against dev, `npm run check:demos`.
