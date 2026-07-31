# Free coach Overview — coherence review + recommendation

**Status:** ✅ **DF-1…DF-7 RATIFIED + BUILT ON DEV 2026-07-30 (uncommitted). `/review` DONE (§7.3 —
6 findings confirmed + fixed). `/docs` DONE (§7.4).** Owner ratified all seven at the
recommendations ("take all seven"). Final gate: typecheck 0 · focused lint 0 errors · **600 unit
tests** (17 in this module) · all six colour baselines unchanged (tsx 427) · date-correctness 0 ·
schema parity 0 · dictionary OK · org-context guard clean. **NO migration.** Clean dev restart done
(server stopped → `.next` cleared → restarted; `Ready in 892ms`, platform-admin login 200, both
changed coach routes and both help surfaces compile, **zero** Supabase `EACCES`).
**Remaining = owner QA (§8) → commit.**

Answers the question set by `FREE_COACH_OVERVIEW_COHERENCE_PROMPT.md` (written by the Chunk I session).

**Mockups / binding visual spec once ratified:** `claude.ai/code/artifact/8efbb388-a58c-40b9-8377-62b36f140bde`
(390 × 844 before/after for the two dominant states, plus the state table for the tournament block).

**Scope:** the FREE team Overview — `app/coaches/team/[basicTeamId]/page.tsx`. One recommendation
(DF-2) reaches a module premium calls too; everything else is free-tier only.

---

## 1. The answer: **(b)** — a smaller, specific problem, not a one-thing pass

**The premium page's defect is genuinely absent here, and the handoff's hypothesis was correct on
that point.** I walked all seven conditional blocks. No two can render contradictory instructions;
the setup panel is mutually exclusive with the invite, the divider and the event card (all three
require `history.length > 0`, which is exactly what turns the setup panel off). The "one prose card
per surface" rule already holds — the setup card and the roster invite are the only prose cards and
they cannot co-render. No step points at a tool the coach can't reach (the free-onboarding work
closed that, and the tiles are read-only `div`s, not links, so they can't re-open it).

**What is present is a different defect:**

> Premium's Overview said **two different things at once**.
> The free Overview says **one thing four times** — and ranks the team's own numbers below all four
> repetitions.

That is redundancy plus a stacking-order problem, not a missing priority model. It does **not** need
an ordered anchor resolver, and `lib/coach-overview.ts` should **not** be generalised (it reasons
about assistant-coach capabilities that do not exist on this tier).

### 1.1 Co-render matrix (the check the handoff asked for)

| Block | Renders when | Collides? |
|---|---|---|
| "Your tournaments" list | always (list or empty prose) | **yes** — with the event card |
| "Your event" card | a registration in a published event | **yes** — same tournament, twice |
| Team-tools divider | `history.length > 0` | **yes** — second Explore door |
| "At a glance" tiles | always | no |
| Roster invite | `!isSettingUp` && roster off | **yes** — first Explore door |
| Setup card | `history.length === 0` && steps outstanding | no — excludes all three above |
| Premium shelf | any team content exists | no (enumerated permitted surface) |

---

## 2. Findings

Measured in Chromium at **390 × 844** and **360 × 740** against a reconstruction built from the
shipped stylesheets — not eyeballed from a screenshot. First screenful of content = viewport −
124 px sticky header − 72 px fixed consumer bottom bar = **648 px** (390) / **544 px** (360),
so content y 124 → 772 (390) and 124 → 668 (360).

| # | Finding | Severity |
|---|---|---|
| **F-1** | **The same tournament is stated up to four times before the team's own numbers.** List row → event card (drawn from the *same array*) → Tournaments tile value → the sticky header's own chip + dates. Measured: list y 200→335, card y 367→487 = **287 px = 44 %** of the first screenful at 390 px, **53 %** at 360 px. | High |
| **F-2** | **The Overview's lead section is a verbatim copy of the Tournaments tab.** Same component (`CoachRegistrationCard`), same source, same order; the only differences are that the Overview forces `fanView={null}` and the tab adds an entry count. Tournaments is a permanent Tier-1 tab, one tap away at every width. | High |
| **F-3** | **For a brand-new team the setup card sits below 474 px of zeros, off-screen.** Five tiles reading `0 · None · $0.00 · 0 · 0` occupy y 365→838; "Let's set up your team" starts at **y 854** — 82 px below the fold at 390 px, **186 px** below at 360 px. This is premium's finding #3 with the tiers swapped: there the returning coach's data was buried under onboarding; here the new coach's onboarding is buried under data that doesn't exist yet. | High |
| **F-4** | **The phone is the only width that gets a one-column tile strip.** `.hqStrip` is 2-up at 701–1120 px and 5-up above; the phone stacks all five full-width for **474 px**. Premium's Chunk I board is 2-up on a phone by ratified rule (D9). Two-up here measures **337 px** (−137 px). | Medium |
| **F-5** | **Three doors, two destinations, one screen.** The divider's "See everything included →" and the invite's "Set it up →" both land on Explore ~450 px apart with overlapping arguments; the Premium shelf follows. Each is individually sanctioned (the Overview *is* on the pressure ladder's permitted list) — the problem is that all three co-render. | Medium |
| **F-6** | **"Your event" can name the wrong event, and can name a finished one under a present-tense heading.** `pickFanViewRegistration` filters on `tournament.status === 'active'` — the *publication* status, not the lifecycle — then takes the first match from a list sorted by `registeredAt` **desc**. So (a) a future event registered yesterday outranks the one being played today, and (b) a finished-but-unarchived event still qualifies and now renders Chunk I's `Finished` chip under a heading that says "Your event", while the sticky header two inches above hides `complete` chips by rule. **Both tiers** — premium calls the same picker with the same ordering. | Medium · both tiers |
| **F-7** | **The free team's Tournaments tab is the only list not sorted live-first.** The account hub (`app/coaches/tournaments/page.tsx`) and premium's team list both call `sortByCoachLifecycle`; the free team-scoped tab doesn't. Same coach, two orders on two screens. | Low · drift |

---

## 3. Recommendation — seven decisions (DF-1 … DF-7)

Build order as listed. **No migration, no new API route, no new component.** The only new code is
one small pure resolver + unit tests; the rest is source order, CSS and copy.

| Ref | Decision | Cost |
|---|---|---|
| **DF-1** | **The Overview names ONE tournament; the list stays on the Tournaments tab.** Delete the separate "Your event" section; render a single `CoachRegistrationCard` with its fan-view door **restored**, plus the Tournaments tile as the door to the full list. *(Alternative recorded and not recommended: keep `CoachLiveEventCard` and drop the list — the registration card is a link to the record, carries organizer + status, and matches the tab. Either way the shared event card is **not forked**; it simply keeps serving premium's `layout="row"` tail.)* | small |
| **DF-2** | **That block is chosen by LIFECYCLE, not registration date — and the heading follows the state.** Sort candidates live-first before picking. A finished event is chosen only when nothing is current, and is never headed "Your event". Fix the picker's doc comment (it claims "live/upcoming"; `active` is publication state). | small · **both tiers** |
| **DF-3** | **Tiles go 2-up on the phone; Tournaments takes the full-width final row and becomes the door to the list.** One media-query change + one span rule. | trivial |
| **DF-4** | **While a team is still setting up, the setup card comes BEFORE the numbers.** Source-order swap on the existing `isSettingUp` flag. No new condition. | trivial |
| **DF-5** | **A tile for a tool that isn't switched on says what it would give, not "0".** Muted value + one companion-voice line. Tiles stay read-only — they do **not** become doors, so no step can point at a section the coach can't reach. | small |
| **DF-6** | **The team-tools seam keeps its sentence and loses its link.** Its job is to stop roster/schedule reading as tournament homework; that needs no link, and removing it leaves exactly one Explore door. **The Premium shelf is untouched.** | trivial |
| **DF-7** | **The free team's Tournaments tab sorts live-first**, via the same shared helper. | trivial |

### 3.1 Measured effect

| | today | proposed | delta |
|---|---|---|---|
| State A doc height @390 | 1600 px (1.90 screens) | **1312 px** (1.55) | −288 px |
| State A "At a glance" head | y 672 | **y 521** | −151 px |
| State A tiles on first screen | 1 (clipped) | **4 of 5** | |
| State A tile strip | 474 px | **337 px** | −137 px |
| State B setup card @390 | y 854 (**82 px below fold**) | **y 340** (432 px above) | |
| State B setup card @360 | y 854 (**186 px below fold**) | **y 340** | |

### 3.2 The tournament block, state by state (DF-1 + DF-2)

| State | Block names | Chip | Fan view |
|---|---|---|---|
| Playing today | that event | Game Day / Live | yes |
| Within 14 days | the soonest | In N days | yes |
| Further out | the soonest | Mon YYYY | yes |
| Two events, one live | **the live one** | Live | yes |
| All finished | most recent | Complete | yes |
| Registered, event unpublished | that registration | status badge | no door |
| No tournaments | **the existing empty prose — unchanged** | — | — |

---

## 4. Explicitly NOT proposed (and why)

- **An ordered anchor resolver.** Nothing to arbitrate — see §1.
- **Generalising `lib/coach-overview.ts`.** Capability-shaped and premium-shaped; the free tier has
  no assistant-coach capability model. A shared module only one caller's inputs make sense for is
  worse than two honest ones.
- **A six-tile board or premium's operator voice.** Free stays the **companion** (two-family ruling).
- **Touching the free sections' existing empty-state copy.** It is already correct.
- **Removing or moving the Premium shelf.** The Overview is an enumerated permitted ask surface;
  the **pressure ladder is not reopened by a layout pass** (BUSINESS_DECISIONS.md 2026-07-27).
- **Re-litigating "tournaments lead the free Overview"** (owner call, A3 QA 2026-07-27). They still
  do — once instead of twice.

## 5. If the owner picks (a) — close the question instead

Legitimate: nothing here errors, and the page ships today. **DF-2 should still be taken on its own**
— it is a correctness bug in a module both tiers call, and it can name the wrong event on a game
weekend. Log the (a) ruling in `memory/design_decisions.md` so the question stops re-opening every
time the tiers are compared.

## 6. Build gate (once ratified)

- `/simplify` is likely NOT needed — no new shared abstraction beyond one small pure function
  (confirm at build; if DF-1's resolver grows, run it).
- `/review` **is** needed for DF-2 (shared module, reaches premium) — re-check premium's Overview.
- `/docs` **is** needed: two user-facing behaviours change (the Overview no longer lists every
  tournament; a not-yet-on tool reads differently). `lib/help-content/coaches.tsx`.
- Standing gate: `npm run verify:changed`, all six colour baselines ZERO, phone probe @360×740.

## 7. Build record (2026-07-30)

**Shipped exactly as ratified.** Measured after the build, same harness, same viewports:

| | before | after |
|---|---|---|
| State A doc @390 | 1600 px | **1305 px** |
| State A "At a glance" head | y 672 | **y 521** |
| State A tile strip | 474 px | **329 px** |
| State B setup card @390 / @360 | y 854 (82 / 186 px **below** fold) | **y 340** (above at both) |

### 7.1 Deliberate deviations + judgement calls (all flagged)

1. **DF-1 ships as the shared registration card, not the compact event card** (the recorded
   alternative). It is already a door to the record, carries organizer + status, and matches the
   Tournaments tab — so the coach sees one anatomy in both places.
2. **`CoachLiveEventCard` is now premium-tail-only.** Not a fork — its `layout="card"` face simply
   has no caller. Its header comment claimed "ONE component for both tiers", which is no longer
   true; **truthed up in place** rather than left to mislead (the Chunk I review's own lesson). The
   rules it protected did not move: lifecycle derivation stays in `lib/coach-tournament-lifecycle`,
   and both "which registration is current" and "does this row have a fan door" now live in
   `lib/coach-alert-registration` — so a new state still reaches both tiers by construction.
3. **`resolveRowFanView` extracted** because DF-1 would otherwise have been a **third** inline copy
   of `org.slug && tournament.slug && (active || completed)` (free tab + premium tab already had
   one each). Both tabs now call it. Note it is deliberately **wider** than
   `pickFanViewRegistration`: a row opens for a completed event, a "current event" block does not
   (owner call 2026-07-23).
4. **DF-5's gate is "off AND genuinely empty", not "off".** The tool sub-routes are not gated on
   activation (a coach can reach `/schedule` by bookmark and add an event while the tool is off),
   and the **Fees tile also carries the real tournament ENTRY fee owed to the organizer**, which has
   nothing to do with the fees tool. Printing "Not on" over a number that exists would be a worse
   lie than the zero it replaces. Tiles stay **read-only** — deliberately not turned into doors, so
   nothing can rebuild the one-way door the setup panel exists to close.
5. **DF-3's span rule is scoped to ≤1120 px.** Above that the strip is 5-across and an unscoped
   `grid-column: 1 / -1` would have swallowed the whole row. The 2-up value size steps to 1.12rem
   so a long figure ("Entry fee · clear") doesn't wrap to three lines; the full-width tile keeps
   1.25rem.
6. **`.historyList` deleted from `team.module.css`** (genuinely orphaned — verified the other two
   `.historyList` rules in the repo belong to platform-admin change-requests and admin data-tools,
   which have their own modules). A retirement note sits in its place.
7. **`activatedFeatures` / `historyHref` are OPTIONAL props** on the standalone TeamHQ variant, so
   the tournament variant and any future caller are untouched and keep today's behaviour.

### 7.2 Tests

`tests/unit/coach-alert-registration.test.ts` — 13 cases. Every fixture is written in
`registeredAt` DESC order **on purpose** (that is what both callers actually pass), so a regression
that trusts array position fails. Covers: live beats later-registered · soonest upcoming · most
recent finished · anything-ahead beats finished · unpublished registration is still named but has no
door · empty history · a registration whose tournament row is missing · the premium picker staying
narrower than the row rule · all four publication statuses.

## 7.3 `/review` — high-risk tier, 4 lenses, 6 findings CONFIRMED and fixed (2026-07-30)

Deterministic gate ran first and was green, so no agent time went on types/lint/tokens/migrations.
Lenses: correctness/logic · regression & blast-radius · UX-state & data contract · CSS/responsive.
**Two lenses independently converged on the same top finding**, which is the strongest signal in
the pass.

**Three of the six were defects this chunk INTRODUCED. All six fixed in-pass.**

1. **[HIGH · found by the correctness AND state lenses independently] The page could name two
   different tournaments as current, on one screen.** DF-2's lifecycle ordering was applied to the
   featured card but **not** to the Tournaments tile's sub-line, which still read off `history[0]` —
   i.e. the most recently *registered* entry — twelve lines above the new code. A team registered
   for an August event yesterday while playing one today got *"Your tournament · LIVE · Summer
   Slam"* with *"Accepted - Fall Classic"* directly beneath it. **This is the exact contradiction
   DF-1/DF-2 exist to remove, reintroduced by fixing only half of it.** Fixed: the label derives
   from `featured`, so the two cannot disagree by construction.
2. **[HIGH · correctness lens] A REJECTED registration could headline the Overview over one the
   team is actually in.** `pickFeaturedRegistration` sorted purely by dates, and `history` carries
   rejections unfiltered (deliberately — they are the team's record). Rejected-from-a-live-event +
   accepted-to-one-in-three-weeks ⇒ the Overview headlined the tournament the team is **not**
   playing in, and pushed the one needing action behind "See all". Fixed: anything the team is
   still in outranks anything it was turned away from; a rejection is featured only when it is the
   only entry (which is the honest answer, better than an empty page). **The 13 original tests all
   hard-coded `accepted`, so this path was untested** — 4 cases added.
3. **[HIGH · correctness + state lenses] …and the card would not have SAID it was rejected.**
   `CoachRegistrationCard` suppresses the status label on a `live` row ("the chip wins"). That rule
   was written when the card was one row among many; DF-1 makes it the *only* tournament
   information on the page, so a swallowed "Not Accepted" becomes a false claim. Fixed at the
   shared card: the live chip only implies a status when that status is `accepted`. Improves all
   three coach tournament lists, not just the Overview.
4. **[HIGH · CSS lens, then MEASURED] "ANNOUNCEMENTS" escaped its card by up to 37px.** A one-word
   uppercase mono label with no wrap protection, in a tile that DF-3 had just halved in width.
   Measured in Chromium rather than estimated: needs 92px, gets **55px @320 / 75px @360 / 90px
   @390**. Fixed by taking the label back toward its desktop size in the 2-up regime (0.7→0.64rem,
   tracking 0.08→0.045em — the same "the room D-1 gave it is now spent on a second column"
   reasoning that already stepped the value 1.25→1.12rem) plus `overflow-wrap` as a never-spill
   floor. Verified across 320/360/390/430: **no spill at any width**; one line from 390px up, a
   wrap (not a spill) at 320–360px. *Residual, accepted: the label wraps to two lines on a 360px
   Android. Cosmetic, flagged for owner override.*
5. **[HIGH · CSS lens] The new "See all →" door could vanish with no affordance.** It was appended
   inside the tile's sub-line, which is `-webkit-line-clamp: 2` — a hard cut with no ellipsis — so
   a long "{status} - {tournament name}" swallowed it entirely. Reachable at **every** width and
   worst on desktop (the untouched 5-col layout has the tightest text column). Fixed: the link is
   now a sibling of the sub-line, on its own row.
6. **[MEDIUM-HIGH · CSS lens] The "Not on" value failed AA under the default theme.** `--white-40`
   collapses onto one token in warm (the whole 35–65 band does), landing at **~3.8:1** on the white
   card at 16px/750 — under the 4.5:1 threshold, and warm is the platform default. Fixed with
   `--white-70` (~9.6:1), which still reads a clear step below a real figure. *(The lens correctly
   noted `.hqLabel` shares the old token — pre-existing and systemic, not introduced here; left
   alone rather than widened into an unrelated sweep.)*

**Also fixed:** the "See all" link's tap target (~16px inline sliver → its own padded row,
`min-height: 24px`) — same edit as #5.

**Accepted, not defects (checked, no change):** the "Not on" value staying at 1rem on phones rather
than taking D-1's mobile floor — it is a description, not a figure, and 16px/750 is legible;
`.hqItemWide` vs `.hqFeeAlert`/`.hqOff` specificity — currently unreachable (the wide tile has
neither state) and resolves the right way if it ever isn't; the fractional-pixel 700/701 media
boundary — pre-existing, untouched by this diff. The `.hqItemWide strong` rule's **source-order
dependence is real**, so a KEEP-THIS-BLOCK-LAST warning now sits on it naming the exact
merge-the-two-2-col-blocks refactor that would silently revert it.

**Refuted with evidence (no change):** premium's tail correctly *inherits* the DF-2 fix (its call
site passes no `today`, which defaults correctly, and its data carries real dates); the
tournament-variant hero shares no changed class and is a disjoint prop union; `.historyList`'s
deletion is safe (the two other same-named rules live in separate modules with their own importers);
no test, Playwright spec, portal tour or deep link targeted the removed structure; `next/link` from
a Server Component is already the established pattern on this very page; `!featured` and
`history.length === 0` are provably equivalent (the sort never changes length); the "See all" count
cannot disagree with the tab (one unfiltered source); **"Not on" can never mask real data** —
every empty-predicate is false whenever a figure exists, including the structural
`unpaidCount === 0 ⇒ unpaidTotal === 0`, and the activatable-feature keys were verified to match
the tile keys exactly; the lifecycle sort is stable and its null/`unknown` handling is correct; no
`composes`/keyframe Turbopack gotchas; the fan-view link colour passes AA in warm (6.4:1).

**Deferred to `/docs` (finding 7, blast-radius lens):** the in-app coach guide still describes
"Your tournaments … followed by Your event" and the compact event card — the section the Overview's
own "?" button opens. Handled in §7.4.

**Post-fix gate:** typecheck 0 · focused lint 0 errors · **600 unit tests** (17 in this module) ·
all six colour baselines unchanged (tsx 427) · date-correctness 0 · schema parity 0 · dictionary OK
· org-context guard clean. Re-measured after the fixes: doc **1302px** @390, "At a glance"
**y 521**, setup card **y 340**.

## 7.4 `/docs` — coach guide synced (2026-07-30)

Only `lib/help-content/coaches.tsx` describes this flow, and one module serves both the customer
guide and the platform-admin support mirror. **No anchor was renamed or removed**, so every existing
deep link still resolves; two new FAQ ids only, and no hub card / quickLink change.

**Corrected — the guide described a screen that no longer exists.** This is the section the
Overview's own "?" button opens, so a coach tapping Help on the changed page was reading the old
layout back to themselves:
- *"**Your tournaments** comes first — every event you've entered — followed by **Your event** while
  a tournament is live or coming up"* → rewritten to the shipped shape: one card naming the event
  that matters now, the seam, then the team's own tiles.
- The paragraph describing a *"compact tournament card… with a ⇄ Fan view link"* as a separate block
  → folded into the one card, and now names the actual badge vocabulary (Live · Game Day · In N days
  · Complete) plus the condition for the fan-view door (the organizer has published the event).
- The first-run section now states that the setup card sits **above** the At-a-glance tiles and that
  those tiles read "Not on" until a tool is switched on.

**Added — behaviour with no coverage at all:**
- `faq-overview-one-tournament` *(popular)* — "My Overview only shows one tournament — where are the
  others?" Names the priority order, points at the Tournaments tab + the tile's "See all", confirms
  rejected entries are kept there, and — importantly for support — explains the one case where the
  Overview deliberately skips a live event: **a team turned away from this weekend's tournament sees
  the one it is actually in.**
- `faq-overview-tile-not-on` — why a tile reads "Not on" instead of 0, that a real number always
  wins over "Not on", and that a tournament **entry fee** shows regardless of the fees tool.

**Search metadata updated** (the guide matches keywords/searchText/answerText, never rendered
prose): ~35 new terms including *only one tournament · where are my other tournaments · see all ·
tournament list gone · wrong tournament · rejected tournament showing · tiles two across · not on ·
tile says not on instead of zero · above the tiles · nothing to report yet · game day · in 5 days*.

**Verified:** focused lint clean, typecheck clean, both `/coaches/help` and the platform-admin
mirror resolve with no compile errors in the dev log.

## 8. Owner QA

Free portal, phone first (390 × 844 and 360 × 740), then desktop:

| State | Expect |
|---|---|
| One accepted upcoming tournament | ONE tournament block headed **"Your tournament"** with the ⇄ Fan view line under it; no second event card; the seam has no link; tiles 2-up with Tournaments full-width carrying "See all →" |
| Two tournaments, one live today | the block names the **LIVE** one (not the most recently registered) |
| All tournaments finished | the block names the most recent; card shows its status/lifecycle; "See all →" still works |
| Brand-new scratch team | "Let's set up your team" is visible **without scrolling**; the four tool tiles read **"Not on"** + one line each; Tournaments reads 0 |
| Team with real data but a tool switched off | that tile shows its **number**, never "Not on" |
| Team in a tournament with an entry fee owed | Fees tile shows the owed entry fee in alarm styling even if the fees tool is off |
| Tournaments tab | live/upcoming first, finished after (newest first) |
| Premium team Overview | tail row unchanged in shape; names the live event when there is one |

## 9. Provenance

Reviewed 2026-07-30 under `/design` + `/ux`. Inherits without re-litigating: the two-family ruling
(free = companion), the pressure ladder's enumerated ask surfaces, "tournaments lead the free
Overview", Chunk I's absence-is-never-a-state rule, and the one-dashed-frame rule. Frames are
reconstructions from the shipped stylesheets, measured in Chromium — **owner browser QA is still
the last word on how it reads**.
