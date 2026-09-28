# Tryouts from a phone — the tryouts room, the helper's scoring link and the tryout history, read and used at phone width

**Created:** 2026-09-25 · **Owner:** product owner · **Phase:** design — measured and drawn, **rulings owed (T1–T8)**; no code until the owner pastes them back.
**Hub (mockup · brief · plan · decisions · QA walk, one artifact for the project's life):** `docs/projects/active/COACH_TRYOUTS_PHONE_HUB.html` — published as a Claude Artifact at https://claude.ai/artifact/QYuRFVutfDhACnjKqfAwsu (v1, 2026-09-25). Republish the same file path to stack a version.
**PM brief:** `COACH_TRYOUTS_PHONE_PM_BRIEF.md` · **TODO:** one line under Active Tasks · **Ledger:** no § until something is built (a planning entry is not a §).
**Kickoff prompt:** `COACH_TRYOUTS_PHONE_DESIGN_PROMPT.md`.

> **One stage at a time**, the phone programme's rhythm: drawn at true size on the hub → owner rules (paste-back) → build → `/review` → QA walk on the hub → owner QA → next stage.

---

## 0 · What this is, and how it was measured

Neither phone project ("Coaching from a phone" stages 0–6, "Practice plans on a phone") ever listed tryouts. Tryouts One Room (2026-08-23, §81) gave the two field tools a desktop and declared the phone "byte-for-byte" unchanged — which, measured, turns out to be true of the helper's link and **not** of the coach's own Score face (F02). This plan is the first time the phone was measured since the room was assembled.

**Method (2026-09-25, `dev`).** Playwright, every number read from the browser's own geometry (`getBoundingClientRect` / `getComputedStyle`), never a screenshot. Four contexts: **390×844** and **360×780** (touch, DPR 2), **768×1024** (touch — the 641–768 band ruling), **1440×900** (mouse, the One Room desktop reference). Per screen: page height, the first row of content, pinned chrome, every control under 44px, every word under 12px, the looked-for values on the field screens, row heights and natural widths, and three tap paths driven by hand. Probes lived in the gitignored `.probe/` and were removed afterwards.

**The three specimens, and which numbers came from which.**

| Specimen | What it is | Used for |
|---|---|---|
| **Marker team** (`tphone Selects 12U`, dev-club-org) | Provisioned for this session the smoke spec's way — its own marker team and marker head coach, pre-cleaned, every insert error-checked. 14 candidates (9 checked in), a 5-category 1–5 scorecard (weights 3·2·2·1·1, two categories with a hint), 2 sessions today, **3 helper links minted through the product's own API** with 105 scores (one helper runs a point hot; one player split 3.0 apart), 3 decisions (2 Offering, 1 Waitlist). **Torn down, teardown asserted: 0 marker teams, 0 marker candidates, 0 marker users.** | Every room screen (Set up, Tryout day's three faces, Decide, Build team), the helper's link, the family's pages, all three tap paths. |
| **UAT Test Team** (`tests/uat/.auth/coach.json`) | The owner's shared fixture. It carries an **empty tryout workspace** (the row exists, 0 candidates) — so "the UAT team has no tryout" is true in substance, not in the table. Nothing was written to it. | The tryout history page; the empty room's Set up. |
| **Coach demo, Riverdale Ridge 11U** (read only) | Frozen at Tryout day: 28 candidates, 3 evaluators. | The 28-candidate scale check (board, check-in, Decide). |

**Why not provision on the UAT team, as the prompt said.** It already holds a tryout workspace, so marker candidates would have landed inside the owner's own tryout; opening the Score face mints a self-evaluator session on it; and flipping the names switch stamps a **write-once** `namesShownAt` on it. The smoke spec's actual pattern — a separate marker team and coach — measures the same components with zero writes to the shared fixture.

**Where a real tryout (60 candidates, three helpers, two sessions) changes the answer** — extrapolated from the measured row heights, nothing seeded at that size:

| Screen at 390 | 14 candidates (measured) | 60 candidates (extrapolated) |
|---|---|---|
| Live board | 3,192px (3.8 screens) | ≈ 10,900px (≈ 13 screens) — 172px a player |
| Decide | 3,384px (4.0 screens) | ≈ 11,500px (≈ 14 screens) — 165–216px a player |
| Check-in | 1,427px (1.7 screens) | ≈ 4,300px (≈ 5 screens) — search becomes the tool |
| Score list (either door) | 1,413 / 1,299px | ≈ 4,400px — and F02's landing gets worse the further down the kid is |

Two sessions change nothing on a phone beyond the print chooser ("which morning is this sheet for?"), which is a desk task.

## 1 · Findings, with their measurements (390×844 unless a width is named)

### F01 — The helper's scoring link wears the public site bar
The volunteer's `/tryout-score/{token}` page renders FieldLogicHQ's public bar (**Discover · Pricing · Sign in**, 72px, fixed at the top) **on top of** the scorer's own sticky header, at 390, 360, 768 and 1440. The team name collides with "Discover", the Blind chip with "Sign in", "Scoring as Priya Shah" sits half under it; on an open player "All players" and the bib sit under it for the whole scroll. Cause: `components/Navbar.tsx` renders on every path it doesn't classify — not admin, not a marketing path, no org slug — and the token route is one of them. **This is a production defect, not a design question**: a parent volunteer opens a link that says "no account needed" and is shown *Pricing* and *Sign in* over the thing they came to do. See T7.

### F02 — The coach's open player loses its name and its Done
On the room's **Score** face the scorer is embedded in a card with `overflow: hidden`, which silently turns both of its sticky pieces into ordinary ones. Measured with the page scrolled 0 → 250 → end: the player header goes 267 → 17 → **−184**, and **Done** goes 1,120 → 870 → 669 — it moves with the page and is pinned nowhere. And the path that matters: scroll the list, tap the ninth player — the page clamps from 569 to 451, the name and bib are **184px above the screen**, and the first category's buttons sit at 9px, under the 37px masthead (at 360: −270 and **−55** — the first category is gone too). A coach can score a player without being able to see which player. §81's "the scorer on a phone is untouched — sticky Done" is true of the helper's link (header pinned at 0, Done pinned at 778) and **false of the coach's face** since the embedding.

### F03 — "All players" is an 18px target
The only way back to the list besides Done, on both doors: 92×18px. The worst control on the day's screens.

### F04 — 542px of head before the first ranked player
Tryout day's Live board at 390: masthead to 37 · title to 99 · the four **stage tabs** 99–146 — and at 390 only three fit: **Build team and "How tryouts work" are off the right edge** of a scroller with no sign it scrolls · the **face row** 164–216 · the hint line 231–250 · the board card's head **287–448 (161px)**: title, a two-line subtitle, the names switch (44) and Lock scoring (33) on separate lines · helper chips 463–528 · the **first ranked player at 542**. One player fits on the first screen. Check-in's first row is at 435, the Score list's at 312, Decide's at 590. (S.2: one identity line at rest.)

### F05 — A Live board row is 172px, and prints the rank and the bib the same way
At ≤560 the row wraps into four stacked lines: the rank, then "#bib name", then five category averages over two lines, then the score alone on the last line. **The rank and the bib both print as "#1"** — "#1 / #1 Mason Okafor" reads as one number twice; lower down "#3 / #4 Ethan" reads as a contradiction. 14 players = 2,408px of rows (28 in the demo: 191px each, 5,348px). At 768 the same row is 64px on one line — the phone is the only width that pays.

### F06 — Decide: 590px of explanation before the first row, 69 targets under the floor
Before the first player: the stage intro (3 lines), the names switch, the board's title and a two-sentence subtitle (the blind note), the "nothing is sent" note (3 lines), the tally (2 lines) — **five blocks, two of them saying the same sentence** ("Sort each ranked player into…" / "Sort each player into a pile…"). Rows 165–216px. **69 controls under 44px** (360: 73; 768 — a touch tablet: 74; the demo's 28: 134): the pile buttons are 40px, the three-best-categories line is a **16px-tall** toggle, "Not scored yet" 37px, "family's note" 16px. **40 words at 10px** ("3 evals", "no email on file — reach them by phone", "no score"). The three pile buttons need 269px and take a full row whatever else happens.

### F07 — Check-in's pinned header slides under the masthead
The header (progress, names switch, bar, search, Add player, Print sheet) is sticky at `top: 0` while the masthead is sticky 0–37 — so once the list scrolls, **the progress count and the names switch go under the masthead**. The header is 165px (172 at 360); with the masthead and the bar, 274px of 844 is chrome. Search is 38px, Add player and Print sheet 35px. **The rows themselves are right**: 56px, bib 20px, name 16px — the field floor holds, the three-cue check state reads in glare. At 60 candidates the list is registration order with checked-in and not-yet interleaved, so "who hasn't shown?" is answered only by scrolling all 60.

### F08 — A walk-up costs a tap before the first letter
Add player → the sheet (covers the nav — correct, it is a form) → **First name is not focused**, so the keyboard needs a tap → type → *Add & check in* (41px). 3 taps + typing; 2 once the name is focused. (Coach's first check-in from the room: 2 taps — 1 when nobody is checked in yet, because the room opens on Check-in.)

### F09 — The field floor, missed in three places
S.5: nothing under 12px on a screen read standing up; the looked-for value at 14 or more. Check-in passes (name 16, bib 20). The scorer passes (bib 20, name 16, category 16, hint 14, buttons 16) **except the "Not checked in (5)" divider at 11px** on both doors. Decide (read sitting or standing) carries "3 evals", "no score" and "no email on file" at **10px**. From the code, not a specimen: "Possible returning player — verify" is an inline-styled **10.5px button about 20px tall**, and the confirmed "↩ returning · 2026 Season" 11.2px.

### F10 — Tryout history has no door
`/tryouts/history` is linked from **nowhere**: 0 links on the room, none on the closed-season page, none in either nav or the More sheet. On a live season it reads *that season's own* tryout — the one the room already shows live. On a closed season the season gate sends the coach to the closed-season page before it can mount (it is not one of the gate's two record paths). On the UAT team it renders **"0 candidates — level with 2025 Season · 0 offered"** over an empty table ("level with" a season that held no tryout). Its help article promises it is readable "under Tryouts … for as long as that season is the one your team is on", and "open that season's tryout history" — neither is true. **Drawing its phone form would polish a page no coach can reach.** See T8.

### F11 — Helpers disagreeing is invisible at rest (named, and stopped there)
The breakdown already says it plainly — "These helpers are 3.0 apart on the same player — worth a second look" — but only after a row is opened (189 → 572px). At rest, on either board, a 4.0 that three helpers agreed on and a 4.0 made of a 5, a 5 and a 2 look identical. **The split-opinion flag is the shortlisted Draft Brief, which is out of this project unless the owner brings it in**; nothing here draws it.

### F12 — Two names for one board; two precisions for one figure
The face is **"Live board"**, the card it shows is **"Live scoreboard"**, the help says both. Helper averages print "avg 4.6", "avg 3.4" and **"avg 3.62"** side by side (the mean is rendered unrounded). The board also mixes "evaluators" (subtitle), "helpers" (switch, breakdown) and "evals" (the unit).

### F13 — The helper's link tells the time in the device's clock
"Link active until Sun 27 Sept, 12:45" is built with `toLocaleString(undefined, …)` — the phone's own locale, so it reads "12:45" here and "12:45 PM" on another phone. The house clock is **"12:45 p.m."** and `formatTime()` is the one place a clock label is built (the 2026-08-26 ruling). The spelling gate cannot see it — it is assembled at runtime.

### F14 — The family's pages
Public, dark, server-rendered, not the portal. Landing 916px (1.09 screens) with a 53px lime *Register for Tryouts*; register 1,745px (2.07 screens), one column, 15 controls under 44 (inputs 38–41px; the 16px checkboxes sit in 42–84px labels, so the label is the target and that part is fine), section headings at 11px. The larger finding is not a phone finding: **the landing never says when or where the tryout is** — only the coach's free text. The sessions exist (the coach's Schedule projects them). See T5.

### F15 — The sweep measures one tryout screen, and its baseline describes a room that no longer exists
`coach-tryouts` renders the landing only (a stage the coach was last on; faces and stages are never visited). Its 23 accepted findings name **"Reveal player names (one-way — can't switch back)"** and **"Open day-of check-in"** — controls retired on 2026-08-25 and 2026-08-23. Nobody re-read the baseline after §48, §81 or the names switch. The helper's link, check-in and the scorer are also not declared field-floor surfaces (A4 declared the console, the run screen and attendance-taking). See T6.

### F16 — The tablet band
At 768 (a touch device) the scorer is still the phone flow — full-width cards, **129×48px** buttons — until 1024; Decide at 768 has 74 targets under 44. Named: big buttons on a tablet are not a defect; the targets under 44 are, and the T4b fixes reach them if they are scoped to ≤768 rather than ≤640.

**Measured and fine — not drawn.** **Set up**: 916px (1.09 screens); the one control under 44 is the masthead's Public site chip. **Build team**: 1,184px (1.4 screens), a clean report; Export is 33px and its section labels sit at the portal's 11px label step, on a screen read at a desk. **The helper's open player** (apart from F01/F03/F09): header pinned, Done pinned above the home indicator, five categories in 1.2 screens, **2 taps from opening the link to a saved score**, buttons 60×48 (54 at 360). **Check-in rows**: see F07.

## 2 · Rulings built on, not reopened

- **One Room (§81).** Stages and faces are URL-backed links; faces stay mounted; the two navigate-away buttons are gone. Every proposal here rearranges what the room shows, not where it lives — the stage sheet's rows and the faces are the same `?stage=` / `?view=` links.
- **FieldLogicHQ sends a tryout family nothing as a consequence of a coach's decision** (2026-08-26, §108). No proposal draws a send, a switch or a reply.
- **The product never appears to make the cut.** The boards stay ranked by score, as they are today at every width; the phone keeps the disclosure line that says so, the helper count on every row, and the no-show marker.
- **Names are baseline** (2026-08-03); **the names switch** (2026-08-25) stays mounted on check-in, the live board, Set up and Decide, and governs helpers only.
- **Integer scores 1..scaleMax; five columns always** (2026-08-17); the scorecard weights, the setup checklist and Tryout Insights keep their shapes.
- **Stations, not a queue** (2026-08-23): no "next player" on either door.
- **The Decide row's content** (2026-08-25): the rating leads the row and opens the breakdown; the player's three best categories stay on the row.
- **The returning-candidate `high` tier admits twins.** The drawing shows a confirmed link (the coach's own confirmation) and an unconfirmed one as a *question*; neither reads as certainty.
- **Standing phone rules:** the field floor (S.5), the 44px tap floor, one identity line (S.2), a table whose columns fit stays a table (S.7), the two drawer layers (a FORM covers the nav, a MENU sits on top of it), icon-only mobile actions, the transient Saved pill, every delete asks, back goes up one level inside every sheet, "8:00 a.m.", one spelling.
- **Out:** the Draft Brief, money, the club-admin tryouts screen, the Schedule's own drawing (tryout sessions are projected onto it read-only — noted, not redrawn).

## 3 · The decisions (owner rules; recommendation marked)

### T1 · The room's head on a phone
- **A — as today.** Stage tabs, then the face row, then the hint: 542px to the first ranked player; Build team and the guide off the right edge at 390.
- **B — the stage moves into the title; the faces are the one row. (Recommended.)** At ≤640 the page-title row reads *Tryouts* with a **stage chip** — "② Tryout day ▾" — that opens a **menu sheet** of the four stages (their checks and the current dot, one short fact each) with *How tryouts work* as its last row. A menu, so it sits on top of the nav (§13). The face row becomes one full-width 44px segmented control; the check-in count rides on its own face ("Check-in 9/14") and the hint line goes. The board card's head collapses to one 44px row — "9 of 14 scored ●" · the names switch · a 44px Lock square — under one disclosure line. **In the true-size drawing: first ranked player 542 → 358** (drawn, to be measured at build). Trade-off: the stage is one tap further away (the stage chip) — stages change a few times a season, the faces a hundred times a morning, so the row goes to the faces.
- **C — the faces behind a sheet too.** Saves one more row, but hides the day's most-flipped control behind a tap. Not recommended.

### T2 · Check-in at the gate
- **A — as today.**
- **B — the header fixed.** Pinned **below** the masthead (never under it); search, Add player (a 44px "+" square, icon-only) and Print sheet (a 44px square) on one row at 44px; First name focused when the Add player sheet opens (the keyboard comes up — 3 taps → 2); *Add & check in* at 44px. The rows are unchanged — they pass. Header 165 → ~118px, with nothing hidden.
- **C — B, plus "Not here yet". (Recommended.)** Beside the progress count, one 44px toggle — "Not here yet · 5" — filters the list to the players who haven't checked in. At 60 candidates it answers the gate's closing question ("who's missing?") without scrolling 60 rows; checking a filtered player in leaves the row in place (with its Undo) until the filter is toggled, so nothing jumps under a thumb. Client-side; no new data.

### T3 · Scoring on the field — one drawing for both doors
- **A — as today** (F02 stands on the coach's face).
- **B — keep the player in the page; fix the pinning.** The card stops clipping, the header pins under the masthead and Done above the nav; opening a player scrolls its header into view. Categories get 844 − 37 − 56 − 64 − 72 ≈ 615px.
- **C — an open player is a full-screen sheet, on both doors. (Recommended.)** Tapping a player opens the scorecard as a full-screen sheet — it covers the masthead and the nav (a FORM, §13), carries a 44px ← and the player's bib and name pinned at the top and Done pinned at the foot, and registers its back step (§219). It is **byte-identical to the helper's link**, so it is literally **one drawing**: the only difference between the doors is the name ("Lucas Fitzgerald" for the coach, "Player 6" for a helper on bibs). F02 cannot happen — a sheet opens at its own top. At 390 all five categories fit above Done (the last ends at ~734; Done starts at 768). Trade-off: while a player is open the coach can't glance at the Live board without closing the player (one tap) — at a station you score, then go back to the list, so the cost is small.
- Common to B and C: "All players"/← at 44px (F03); the "Not checked in" divider at 12px (F09). Taps to the first saved score: coach 3, helper 2 — unchanged.

### T4a · The Live board at 360
S.7's test: with its five category averages a board row needs ≈ 714px (the averages alone are 441px on one line) — **it does not fit 328px**, so the categories cannot be columns. Without them — rank · bib and name · score · helpers — it fits in ~300px.
- **A — cards, as today** (172px a player).
- **B — one-line rows; the categories behind the tap. (Recommended.)** A four-column list: the rank as a plain muted numeral (never "#"), the bib as "#N" before the name, the score large, the helper count; a no-show carries "didn't check in" as a second line. Tapping a row opens the same breakdown Decide opens. **172 → 48px a player; 8 players on the first screen instead of 1; 60 players ≈ 3,240px instead of ≈ 10,900.** It earns its order the way the desktop does: the disclosure line ("Ranked by weighted average across your helpers — tap a player for what made it") sits directly above, the helper count is on every row (a 4.4 from one helper is not a 4.4 from three), and a no-show never reads as a low score.

### T4b · Decide on a phone
The pile buttons alone need 269px, so Decide cannot be a table at 360; it stays a card list.
- **A — as today.**
- **B — the head folded, the row compacted, every target at 44. (Recommended.)** The intro, the subtitle and the "nothing is sent" note become **one** two-line note that keeps the owner's words ("nothing is sent to anyone"); the tally is one 44px line. A row: rank · #bib name · the rating (its button, 44px, opens the breakdown); the three best categories as plain text (the 2026-08-25 ruling keeps them on the row — they stop being a 16px toggle); the facts that exist ("no email on file", "didn't check in", "last season: …", "family's note ›" as a 44px row) at 12px or more; the piles as **one 44px segmented control**; *Add to roster* 44px on an Offering row. **First row 590 → ~275; rows 165–216 → ~146 (198 with Add to roster); 69 targets under 44 → 0.** Scoped to ≤768 so the tablet gets the targets (F16). The memory strip and the verify question are drawn at 44px too.
- **C — B, plus the tally as a filter.** The tally line becomes four filters (Offering · Waitlist · Passed · Undecided); a decided row stays in place until the filter is re-tapped. Useful at 60 candidates; it is a new behaviour, so it is offered, not recommended.

### T5 · The family's register page
- **A — in this project.**
- **B — its own small project, with F14 handed over. (Recommended.)** It is a different surface (public, dark, the org's public chrome), a different reader (a parent, before tryout day), and its biggest finding is a product question — should the page show the tryout's dates and place from the sessions the coach already entered? — not a phone layout. On a phone it already works: one column, 1–2 screens, a clear call to action.

### T6 · Keeping the phone measured
- **A — leave the one entry.**
- **B — give the sweep a tryout to look at. (Recommended.)** The UAT seeder writes a small tryout onto the UAT team (≈ 12 candidates, two checked-in states, a 5-category card, two helper links with scores) — a fixture change the owner's walks will see, which is why it is asked. Then entries for **Tryout day · board / check-in / score (list and an open player)**, **Decide**, **Build team**, **the helper's link** (seeded token, no session) and the Set up landing; re-baseline `coach-tryouts` (its 23 entries describe retired controls); declare **check-in and both scorer doors** field-floor surfaces for the `field-floor` rule.
- **C — point the entries at the coach demo's 11U.** No fixture change, 28 candidates — but a public sandbox that re-seeds itself and ends its session when a path leaves it; a sweep standing on it would flake.

### T7 · The site bar on the helper's link (F01)
- **A — fix it now, as a defect, ahead of this project. (Recommended.)** It is live, the fall window is open, and the fix is small (the public bar learns that the scoring link is not a public-site page).
- **B — fix it in stage 1 with the rest of the helper's link.**

### T8 · Tryout history (F10)
- **A — leave it** (an orphan with a promise in the help).
- **B — retire the page and correct its help article. (Recommended.)** "Have we seen this kid before?" is already answered where it is asked: the returning marker at check-in and the memory strip on Decide. The page duplicates the room on a live season and cannot open on a closed one.
- **C — give a closed season's tryout a shelf on the closed-season page.** The CLAUDE.md rule: a closed season shows something through a shelf, and every shelf gets its own owner mockup session first. If the owner wants the record, this is the way — a separate session, not a phone drawing.

### Named, not asked
- **F11** — helpers disagreeing is invisible at rest; the Draft Brief stays out.
- **F12** — "Live board" / "Live scoreboard", and evaluators / helpers / evals: a one-spelling decision for `/marketing`; the phone drawing sidesteps it by dropping the card title (the face names the board) and does not rename anything. The "3.62" rounding rides with T4a.
- **F13** — the lifetime clock rides with stage 1 (it is the helper's header).
- **Help drift** (`recipe-run-tryouts`): still describes a "Names hidden" switch (it reads "Helpers see bibs" and governs helpers only), buttons labelled "Offer" (they read "Offering"), and names appearing "on the scoreboard and decision board" when revealed (the coach always sees names since 2026-08-26). A `/docs` pass after the build — the build will change these same screens again.
- **1440 — Decide, Set up and Build were not measured** (the session expired mid-run — the refresh-token rotation trap). They are desktop screens this project does not touch; the board, check-in and both scorer doors were measured at 1440.

## 4 · The stage ladder

| Stage | Covers | Asks | Why this order |
|---|---|---|---|
| 0 · The fixture and the sweep | A tryout on the UAT team; the seven entries; the stale baseline re-read; field-floor declarations | T6 | Every later stage is then measured before and after by the build, not by a one-off probe. |
| 1 · The helper's link | The site bar gone (unless T7 = A already did it); ← at 44; the divider at 12; the lifetime in the house clock | T7, F03, F09, F13 | Smallest, most exposed, and in front of volunteers this month. |
| 2 · The open player | One sheet, both doors | T3 | The one defect a coach can act on wrongly (scoring the wrong kid). |
| 3 · The room's head and check-in | The stage chip and its sheet, the face row, the board's head; check-in's header and walk-up | T1, T2 | The morning's first two screens. |
| 4 · The boards | The Live board's rows; Decide's head and rows | T4a, T4b | The largest change; wants stages 0–3 on the fixture to measure against. |
| — · History | Retire or shelf | T8 | Independent of the phone; can run any time. |

A stage may be built ahead of the previous walk when the owner says so (the Practices precedent).

## 5 · Verification at build

- **Probes** at 390/360 (touch), 768 (touch) and 1440 (mouse), every number from the browser: first row, pinned chrome, targets under 44, words under 12, looked-for values ≥ 14 on check-in and the scorer; the three tap paths re-driven; **F02's landing re-driven** (scroll the list, open the ninth player, the name must be on screen); the helper's link opened with **no session** at all four widths with nothing over its header.
- **`check:layout --only=`** (with the equals sign) on the new entries at 361/390/768/1440; the `field-floor` rule green on check-in and both scorer doors.
- **Unit guards:** the One Room addresses unchanged (stage and face hrefs); the names switch still mounted on its four surfaces; nothing on Decide can mail a family (the §108 guard); the full-screen sheet enrols in the shared overlay signal and registers its back step; the public bar does not render on the token route.
- **Existing specs:** `coach-tryouts-smoke.spec.ts` (it drives the faces and the scorer at 360 — the sheet changes its locators) and `tryout-blindfold-boundary.spec.ts` (the helper's view on bibs) must pass unchanged in intent.
- **QA walk** on the hub per stage, the sign-in card naming the dev UAT coach with the password read from `.env.local`.

## 6 · Migrations, APIs, years

**None expected.** Every proposal is presentation at phone width, plus two client-side filters (T2 C, T4b C) over data the screens already hold. No route learns a year; `HISTORY_ENDPOINTS` is untouched (T8 B removes a page; T8 C would be its own decision under the three questions). T6's fixture is a seeder change, not a migration.

## 7 · Specimen record

Marker team `tphone Selects 12U` (dev-club-org), marker coach `tphone-head@dev.local`, provisioned and seeded 2026-09-25 through the product's own API, **torn down the same session with the teardown asserted** (0 teams, 0 candidates, 0 users carrying the marker). The UAT fixture was read, never written. The demo sandbox was read only.
