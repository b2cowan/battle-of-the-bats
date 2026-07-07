# Coaches Portal — Information-Architecture + UX Review (Plan)

> **Status:** IN PROGRESS. **Phase 0 + Phase 1 + Phase 3 (navigation rebuild) BUILT + adversarially reviewed on `dev`.** Owner decisions #1, #3, #9 ACCEPTED (2026-07-04); **#2 REVERSED → Standings CUT (2026-07-06)**; **#4–#8 ACCEPTED 2026-07-06 (Phase 3 build session)**; #10, #11 still open (doc-hygiene only, see §7). Phase 2 (Standings) is dropped. **Phase 3 built at the recommended answers for #4–#8; next major phase is Phase 4 (review depth).**
> **Branch:** `dev` (single shared branch).
> **PM brief:** [COACH_PORTAL_IA_UX_REVIEW_PM_BRIEF.md](COACH_PORTAL_IA_UX_REVIEW_PM_BRIEF.md)
> **Scope:** The **Premium Coaches Portal** (`/{orgSlug}/coaches/*`, `CoachesSidebar` + `CoachesBottomNav`). The Basic portal shell rebuild is owned by [COACH_NAV_REBUILD_PLAN.md](COACH_NAV_REBUILD_PLAN.md) and is referenced, not duplicated, here.
> **Method:** journey map → three-lens (gap/wow/growth) → data+task relationship model + placement rubric → wow moments + demo script → reorganized IA. Grounded in a 19-agent research pass (10 source-doc digests + 8 codebase current-state verifications + a completeness critic). Every current-state claim below is code-verified; where a prior plan's prose disagreed with the code, the code wins (see §10 Source Reconciliation).

---

## 0. What this review is (and is not)

This is a **journey-first IA reorganization** of an accreted-but-mostly-built Premium portal. Almost nothing here is a new feature build: the roster/schedule/fee/announcement editors, the lineup generator + analysis, the depth-chart board, the phase-adaptive hero pattern, the season-record widget, the tryout blind-mode, and the broadcast wow primitives (`RollingNumber`, `MyTeamDock`, `Countdown`, share-card, team-color) **all already exist**. The problem is **placement and phase-awareness**, not capability. The single genuinely-unbuilt data surface is **league/tournament standings for a coach** — and even that reuses an existing engine.

**Design tension this review holds (both, not either):** the surface must be dead-simple for a non-tech, time-poor, seasonal, zero-retention volunteer coach — AND it must put a robust array of meaningful metrics at their fingertips that no group-chat-and-spreadsheet can. The resolution is **phase-adaptive surfacing**: the data richness is always present but the portal only foregrounds what matters *right now*.

---

## 1. Deliverable 1 — Plain-language PM UX Summary

See the PM brief for the stakeholder version. In short: after this work, a coach opening the portal sees **one clear "here's what matters right now" surface that changes with the season** instead of a long scroll that is half setup-wizard and half dashboard. The single most emotionally important number — their season record — moves off the bottom of the page and into that surface. The premium killer feature (auto-fill lineup intelligence) gets a front door instead of being buried three taps into a game. The portal finally answers the competitive coach's first question — **"where do we stand in our pool?"** — which today it cannot. Money stops hiding: "3 players haven't paid, $420 outstanding" surfaces on the home screen. And the navigation is regrouped around how a coach's brain works at the field (my squad / our season / money / talk to my team / the back office) instead of the order features happened to get built in.

---

## 2. Deliverable 2 — Journey Map (per persona)

Job stages, not feature lists. Each stage: **primary job · data needed · the decision · what they look at on their phone · where the current portal fails · highest-value opportunity.**

### 2A. Tournament Coach (Basic / free / org-less)

> Covered in depth by [COACHES_EXPERIENCE_EVAL_PLAN.md]. Summarized here for journey continuity; the Basic build is owned there.

| Stage | Primary job | Data needed | Phone glance | Current failure | Highest-value opportunity |
|---|---|---|---|---|---|
| **Arrive + Claim** | Get into my team | Which tournament, my team | Claim card | Claim-wall = a long scroll of identical cards; no lifecycle chip on the hub card (chip lives on the rail context block, not the card) | Collapse the claim-wall; put the lifecycle chip where the coach first looks |
| **Set Up** | Know my schedule + how to pay | Schedule, fee, deadline | Team home | "Payment handled by organizer" appears 3× but never says how/when; dashboard is a passive archive | Surface the one unpaid/overdue/next-game fact as an action |
| **Pre-Game Prep** | Submit roster if asked | Roster requirements | Roster form | Roster submission flow exists but game-day bridge from portal is thin | Persist roster ("reuse next time") — the free→earned wedge |
| **Game Day** | Know first pitch, who's in | Time, field, opponent | Next-game card | Fully-built public game-day (ScoreTicker, MyTeamDock, live standings) is **unbridged** from the portal | Bridge the live public game-day into the portal Team HQ |
| **Post-Game / Afterglow** | Share the result, feel proud | Final, placement | Result | Team detail never shows final placement, podium, or share card | The one earned upsell moment (afterglow), pride-first |
| **Off-Season** | Come back next year | Last team, history | Hub | Zero-retention coach arrives from scratch each season | "Your teams appear here automatically when you register" |

### 2B. Rep Head Coach (Premium) — the power user and commercial engine

| Stage | Primary job | Data needed | The decision | Phone glance | Current failure | Highest-value opportunity |
|---|---|---|---|---|---|---|
| **Onboard / Upgrade-in** | Land in a populated portal | Migrated roster/schedule/fees | Trust it carried | Post-upgrade banner | (Handled) — "check these" summary works | Welcome state confirming "your history is linked" |
| **Pre-Season Setup** | Get roster + positions ready | Players, positions, A-squad, caps | Who's on the team, who plays where | Overview setup panel + Roster + Depth chart | Setup is a single-column checklist mixed into the run-mode dashboard; **season-level lineup caps hide in Settings**; Tryouts always visible even if never run | Graceful "finish setup" strip that recedes; phase anchor says "what's next" |
| **Tryouts (if run)** | Evaluate fairly | Candidates, bib numbers, eligibility window | Who makes the team | Tryout Day (blind mode) | Tryouts nav item shown to orgs that never run tryouts | Conditional visibility; guided "run your tryout" flow |
| **In-Season (between games)** | Know next game + who's coming | Next game, attendance, standings, dues | Are we ready; where do we stand | Overview tiles | Standings **absent**; attendance→lineup readiness has **no connective surface**; dues buried as an aggregate | **Standings rank tile** + next-game card that links attendance ⇄ lineup |
| **Game Day (field-side)** | Set lineup, track score | Available players, lineup, live score | Who plays where, are we compliant | Schedule slide-over | **Lineup builder has zero nav presence** (peer tab inside the schedule slide-over); false "lineups done" checklist | **Lineups front door**; live scorebug in the Overview phase anchor |
| **Post-Game** | Record result, tell parents | Score, result, announcement | What to tell the team | Schedule + Announcements | Result derived (good) but afterglow/share not surfaced on Overview; season-record stranded at page bottom | Share card at the afterglow; record surfaced up top |
| **Season Wind-Down** | See how we did | Season record, dues, budget, placement | Was it a good year | History (buried in Admin) | History nested at bottom of Admin, no preview; **no season-over-season, no tournament placement card** | Overview "last season" preview tile; season review with comparison |
| **Off-Season** | Roll into next season | Prior roster, fee template, budget | Start again | Settings → Start next season | Season lifecycle op buried inside a Settings page that also holds division + gameplay rules | Surface "start next season" at the season boundary from Overview/Season |

**Assistant-coach annotation (footnote to the Premium map — not a separate map):** an assistant traverses the *same* stages but through a **capability-gated view**: ungranted areas never render and an "Assistant Coach" label shows. Money is a per-assistant tri-state (Off / Read / Read+Write, default Off); minor DOB + guardian contacts and internal notes are **off by default and require an explicit per-coach grant** (PIPEDA — a module-capability gate is never sufficient); announcements are draft-only unless "can send" is granted. The head coach administers assistants from the **Staff** page (`CoachStaffPanel`, head-coach-only) in all cases — *not* Settings, so this plan's Settings cleanup does not collide with it; the org admin is oversight-only (visibility, remove, optional approval, default off — the admin-side UI is the work currently in flight). This enforcement is **already shipped to prod** (2026-07-03). Every nav item and tile in the reorganized IA must apply these checks at the app layer — the database does not enforce them. See [ASSISTANT_COACHES_PLAN.md].

---

## 3. Deliverable 3 — IA Pain Assessment

Each: **the symptom as the coach feels it → the structural root cause → the design principle it violates.** (Corrected against code — see §10.)

1. **"The home screen makes me scroll to find out how we're doing."**
   *Root cause:* The Overview is a single vertical stack that does two contradictory jobs — setup wizard (progress bar + core/optional steps) and run-mode dashboard (snapshot tiles + week strip) — with the **Season Record widget rendered dead last**, below everything. There is no persistent "what matters most right now" anchor that adapts to the season phase. *(Correction: it is not a hard binary flip — the snapshot tiles always render; only the top "stat strip" flips off during setup, and the setup panel disappears when all steps are satisfied. The real defect is the missing phase anchor and the stranded record, not gating.)*
   *Principle violated:* **Progressive disclosure by relevance** — the most time-sensitive, most emotionally resonant information must be highest, and content should evolve by context, not stack by build order.

2. **"I didn't know the lineup auto-fill existed."**
   *Root cause:* The premium killer feature (auto-fill lineup + arm-care caps + playing-time heat grid) lives **only** as a peer tab inside the Schedule event slide-over, reachable only after opening a specific game. It has **no nav item**, and the setup checklist marks "lineups" done on *game count*, not on a *saved lineup existing* — so it reads Done while no lineup was ever built.
   *Principle violated:* **Discoverability for zero-retention users** — a flagship capability a coach cannot find from the nav does not exist for a coach who arrives each season from scratch.

3. **"To see who owes money I have to dig into Accounting."**
   *Root cause:* Money is a hub of seven sub-pages. *(Correction: the hub itself does show summary cards + an upcoming-payables panel with an overdue count — it is not a blind menu.)* The real defect: this actionable money data **never reaches the Overview** except as one aggregate dollar tile, and "who has paid *nothing*" is computable from the data but surfaced nowhere outside the full dues table.
   *Principle violated:* **Surface the answer, not the container** — "3 players overdue, $420 out" is a home-screen fact, not a four-tap drill-down.

4. **"Settings has my division, my 'start next season' button, and my innings caps all in one place."**
   *Root cause:* Settings has grown to hold per-team identity config (division), a season-lifecycle operation (start next season + past-seasons link), gameplay rules (three innings caps), and org affiliation (link-org) — four different mental models in one route.
   *Principle violated:* **One place, one mental model** — configuration, lifecycle, and gameplay rules are different jobs and should not share a surface.

5. **"The 'Admin' group is a junk drawer."**
   *Root cause:* Admin holds Accounting (money ops), Documents (filing), History (review), Staff (people), Settings (config) — five heterogeneous items placed as each was built, with no relationship model.
   *Principle violated:* **Placement by rubric, not by build order.**

6. **"Checking who's coming Friday and setting the lineup feel like two unrelated screens."**
   *Root cause:* Attendance affects lineup readiness (shown on the Overview next-up tile), but there is no connective surface — a coach in attendance can't jump to the lineup with the available players carried, the standings data doesn't exist to link the record to, and the season-record widget has no link to the per-game scores that produced it.
   *Principle violated:* **Model the relationships, not just the pages** — related data should be reachable from each other's context.

7. **"Tryouts is in my nav and I never run tryouts."**
   *Root cause:* Tryouts is always visible regardless of whether the org runs tryouts.
   *Principle violated:* **Conditional visibility** — show a section when it is relevant, not unconditionally.

8. **"The Tournaments tab goes nowhere for me."**
   *Root cause:* The Season group makes the team's own frequent schedule a peer of infrequent external-tournament history; a coach who never registers for external tournaments dead-ends there.
   *Principle violated:* **Match nav rhythm to use rhythm.**

9. **"I can't find last year, and nothing reminds me how we did."**
   *Root cause:* History is nested at the bottom of Admin with no preview; previous-season records (wins, dues, expenses) — emotionally resonant for competitive coaches — are never surfaced proactively.
   *Principle violated:* **Proactive value** — resonant data should come to the coach, not wait to be excavated.

10. **"Where do we stand? The tool can't tell me."**
    *Root cause:* League/tournament standings position — the competitive coach's #1 question — is **not surfaced anywhere in the coach portal**. The standings engine exists and is wired to admin/public surfaces; there is simply no coach-side route or tile. Per-player attendance trends, proactive lineup alerts, "who's paid nothing," tournament placement cards, and season-over-season comparison are similarly absent or buried.
    *Principle violated:* **The data is the product** — a portal that holds the data but cannot answer the coach's first question is a liability even when no single page is "broken."

---

## 4. Deliverable 4 — Data Richness Inventory + Placement Map

| # | Data stream | State (code-verified) | Coaching question it answers | Value | Target surface (new IA) | Format |
|---|---|---|---|---|---|---|
| 1 | **Season W-L-T record** | EXISTS — `SeasonRecordWidget`, currently at Overview **bottom** | "How are we doing this season?" | High (emotional) | **Overview phase anchor** (moved up) + Season Review | Big number + form pips + streak |
| 2 | **League / tournament standings rank** | **NEEDS-NEW route** (engine exists, no coach route) | "Where do we stand in our pool/division?" | **Highest** | **Overview rank tile** → **Standings view** (Season group) | Rank ("2nd of 6, 4-1") + mini standings table |
| 3 | **Next-game attendance headcount** | EXISTS — schedule + Overview next-up tile | "Who's coming Saturday?" | High (operational) | Overview **next-game card** | "12 of 15 in" + status pills |
| 4 | **Lineup readiness + analysis alerts** | PARTIAL — `analyzeLineup` runs only inside the open slide-over | "Is my lineup set and compliant?" | High | Overview next-game card **alert chips** + Lineups page | Chips: "no pitcher set", "2 under min innings", "no catcher" |
| 5 | **Dues: who's paid nothing + overdue** | PARTIAL — per-player data in dues API; Overview shows only an aggregate | "Who hasn't paid?" | High (operational) | **Money tile on Overview** + Money hub | Count + names + $ outstanding + overdue |
| 6 | **Budget remaining vs spent** | EXISTS — budget tile + accounting summary cards | "Are we on budget?" | Medium | Money tile + Money hub | Progress bar |
| 7 | **Per-player attendance reliability / trend** | **NEEDS-NEW** (no aggregation, no model) | "Who's reliable / flaky?" | Medium | Player detail + Season Review | Percentage / sparkline |
| 8 | **Tournament placement / result** | **NEEDS-NEW** (`computePlacementStandings` wired only to public schedule) | "Did we place?" | High (emotional) | **Afterglow card** + Tournaments | Placement card + share |
| 9 | **Season-over-season comparison** | **NEEDS-NEW** | "Are we better than last year?" | Medium (emotional) | Season Review + Overview **last-season preview** | Side-by-side W-L-T / dues / budget |
| 10 | **Position-coverage gaps** | PARTIAL — depth chart + `analyzeLineup` unfilled positions | "Do we even have a catcher?" | Medium | Roster/Depth chart + Overview roster tile | Alert ("no catcher on roster") |

**Placement note:** items 1, 3, 5, 6 are *reuse-and-relocate* (no new data). Item 2 is the flagship *new route, no migration*. Items 7, 8, 9 are new routes (7 and 9 aggregate existing rows; 8 wires an existing function). **No item on this list requires a schema migration** — a genuine selling point for the phasing.

---

## 5. Deliverable 5 — Proposed Reorganized IA

### 5.1 The placement rubric (name these; reference by name in future sessions)

- **Dashboard** — what matters most *right now*, phase-adaptive. (Overview)
- **Manage** — CRUD over a named entity. (Roster, Schedule, Fees/Money, Documents)
- **Operate** — real-time game-day action. (Attendance-live, Lineups, Chat, live score)
- **Review** — history, analysis, comparison. (Standings, Season Review, placement)
- **Admin** — configuration, billing, lifecycle. (Settings, Staff, Start-next-season, org link)

Several items span two categories (Schedule = Manage + Operate; Money = Manage + Review). The rubric resolves *primary home*; connective flows (§5.5) handle the secondary relationship.

### 5.2 Proposed Premium sidebar (desktop)

| Group (header) | Items | Rubric | Change from today |
|---|---|---|---|
| *(ungrouped)* | **Overview** | Dashboard | Becomes phase-aware (§5.4) |
| **Squad** | **Roster** (+Depth-chart toggle), **Lineups** ⟵ new nav, **Tryouts** (conditional) | Manage / Operate | Lineups gains a front door; Tryouts hidden unless run |
| **Season** | **Schedule**, **Standings** ⟵ new, **Tournaments** (conditional) | Manage / Operate / Review | Standings added; Tournaments hidden until first external registration |
| **Money** | **Money** (was "Accounting") | Manage / Review | Renamed to plain language; overdue surfaced upward to Overview |
| **Communication** | **Announcements**, **Chat** | Operate | (unchanged grouping) |
| **Team admin** | **Staff**, **Documents**, **History** (→ "Season Review"), **Settings** | Admin / Review | "Admin" junk-drawer relabeled; History given an Overview preview + rename |

Footer keeps Help + Sign out (unchanged). Six headers total (Overview + 5) — a deliberate ceiling to avoid nav-on-nav.

**Rationale for the group names:** they read as a coach's mental model — *my squad · our season · money · talk to my team · the back office* — not as an org chart. "Money" and "Season Review" replace jargon ("Accounting", "History") for a non-tech user. "Team admin" honestly signals "rarely-touched back office" so a coach doesn't hunt there for daily jobs.

**Tradeoff flagged (Owner Decision):** History is a *Review*-rubric item but is placed in the **Team admin** group to avoid a thin one-item "Review" group. The real fix for its discoverability is the **Overview last-season preview tile** (§5.4), not its group. Alternative: a dedicated "Records" group housing Standings + Season Review — cleaner by rubric, but adds a 7th header. Recommendation: keep 6 headers, use the Overview preview.

### 5.3 Mobile bottom nav

**Primary four are FIXED (owner decision 2026-06-29): Overview · Schedule · Chat · Roster.** Not in scope to change. All reorg happens in the **More** drawer, every item under a section header (design rule):

- **Squad:** Lineups (new), Tryouts *(conditional)*
- **Season:** Standings (new), Tournaments *(conditional)*
- **Money:** Money
- **Team admin:** Staff, Documents, Season Review (History), Settings
- **Current team:** team switcher (only when 2+ teams)
- *(footer)* Help · Sign out

Standings and Lineups — the two highest-value additions — are one tap into More on mobile; they are also surfaced as **Overview tiles/cards** so a field-side coach reaches them without opening More at all.

### 5.4 The phase-aware Overview (described, not wireframed)

Replace "one long single-column stack doing two jobs" with a **phase-adaptive anchor** at the top of Overview, reusing the pattern already proven by the phase-adaptive Team HQ hero (its `pending / accepted_prep / schedule_live / game_day / result` logic). The anchor answers **"what do I do right now?"** and changes by season phase:

- **Pre-season:** a compact "finish setting up" strip (roster / positions) that **gracefully recedes** as steps complete — not a binary panel that vanishes. Next action stated in plain language.
- **In-season (between games):** next-game card (Countdown "first pitch in…", opponent, **attendance "12 of 15 in"**, **lineup-ready** flag) + **standings rank** + **money alert** ("2 players haven't paid").
- **Game day (field-side):** live scorebug (`RollingNumber`) + today's lineup + live attendance. Sunlight-safe styling (solid fills, bold weight; lime is not a text color).
- **Result / afterglow:** last result + **Season Record moved up here** + share card + (if a tournament) placement card + **the one earned upsell** (org-data-sharing bridge, pressure-ladder compliant).

Below the anchor, the existing snapshot tiles remain but are **phase-ordered** (most time-sensitive first) and the false "lineups" checklist signal is corrected to "a lineup is saved for the next scheduled game."

**Conflict flagged (Deliverable 7 / conflict protocol):** the phase-adaptive hero currently exists as the **tournament** variant of `TeamHQ`; the Premium Overview builds its own header and does **not** consume it. Bringing phase-adaptivity to Premium's Overview is **"reuse the pattern with adaptation,"** not a drop-in and not a rebuild — the phase logic is portable but the Premium Overview's setup-panel/tiles composition differs. This is a real (small) build, not free. Owner should accept the "adapt the pattern" cost vs the cheaper "reorder-only" alternative (move Season Record up, phase-order tiles, no anchor).

### 5.5 Conditional visibility logic

- **Tryouts** — show only when the team has a tryout signal (any tryout session/event exists, or a per-team "runs tryouts" flag). Otherwise available to re-enable from More/Explore. *(Owner Decision #5.)*
- **Tournaments** — show only when the team has ≥1 external tournament registration; otherwise hidden but rediscoverable. *(Owner Decision #6.)*
- **Standings** — show the tile/view only in a standings-bearing context (an active/complete tournament pool, or a league/division with peer teams). Hidden for a team that only scrimmages. *(Owner Decision #2.)*
- **Assistant gating** — every item above is additionally subject to capability gating: ungranted areas never render for an assistant, money respects the tri-state, PII surfaces require an explicit grant.

### 5.6 Lineup-builder nav presence

Add a **Lineups** nav item (Squad group) that opens a list of upcoming game events, each with a "build lineup" action opening the existing builder (the same generator/analysis, no rebuild). This gives the flagship a front door for zero-retention coaches without duplicating the per-game builder or removing it from the game slide-over. *(Owner Decision #3: own nav item vs elevate-within-Schedule — recommendation: own item.)*

### 5.7 Section-relationship connective flows

- **Attendance → Lineup:** the next-game card's "Build lineup" carries the attendance context (available players pre-marked); the Lineup surface shows the headcount inline.
- **Standings ↔ Schedule ↔ Record:** the standings tile links to the played games that produced it and to the Season Record; the Season Record links back to per-game scores.
- **Dues ↔ Budget:** the Money tile shows "who hasn't paid" + outstanding and links to the budget it funds.
- **History → Next season:** the Overview last-season preview tile links into "Start next season," which already carries roster forward.

---

## 6. Deliverable 6 — Signature Wow Moments + 5-Minute Demo Script

### 6.1 The wow moments (trigger · what's seen · intended reaction · delivering primitive)

1. **Clarity wow — "it just tells me."** *Trigger:* open Overview. *Sees:* the phase anchor — "First game in 3 days · 12 of 15 in · lineup not set." *Reaction:* "I don't have to hunt." *Primitive:* phase-adaptive hero pattern + `Countdown` (both built).
2. **Intelligence wow — "I didn't know software could do that."** *Trigger:* tap Build lineup → Auto-fill. *Sees:* Competitive/Balanced/Development mode dial, arm-care innings cap warning, playing-time heat grid. *Reaction:* "This is smarter than me with a clipboard." *Primitive:* `lib/lineup-generator.ts` + `lib/lineup-analysis.ts` + `DepthChartBoard` (all built).
3. **Standings wow — "it knows where we stand."** *Trigger:* Overview rank tile. *Sees:* "2nd in Pool A · 4-1." *Reaction:* "The group chat could never." *Primitive:* **the one unbuilt candidate** — new coach-side route over the existing standings engine (no migration).
4. **Emotional peak — "the whole team is watching."** *Trigger:* game day → final. *Sees:* live scorebug ticking (`RollingNumber`), then a share card at the whistle. *Reaction:* pride; wants to post it. *Primitive:* `TeamHQ` game_day + `CoachLiveSchedule` + `lib/share-card.ts` (all built).
5. **Aspiration / growth bridge — the single earned ask.** *Trigger:* the afterglow, and only there. *Sees:* one quiet line about how a Club org would share this team's records into the club's dashboards. *Reaction:* "maybe my club should have this." *Primitive:* afterglow card, org-data-sharing framing (pressure-ladder compliant; not price).

### 6.2 The 5-minute self-serve demo script

**Audience:** a prospective volunteer head coach who just signed up or was invited, on their own phone, sideline lighting, deciding *pay for Premium vs go back to the group chat.* No sales rep. The portal must sell itself in five minutes by **doing the coach's job for them.**

- **0:00 — Land.** Overview opens on the phase anchor: *"Your first game is in 3 days. 0 of 15 marked. Set your roster →."* No reading, no tour. (Clarity wow.)
- **0:45 — Roster + positions.** Add players (or watch them carry in from the free portal). Open the Depth-chart board: drag a player's best positions, star the A-squad. It auto-saves; undo is one tap. *"Okay, it remembers everything."* (Data richness.)
- **1:45 — The peak.** Tap the next game → Attendance shows who's in → **Build lineup** → Auto-fill → flip the mode dial to Competitive → a warning: *"Ava is 1 inning over her arm-care cap"* → the playing-time heat grid shows everyone gets fair time. *"I didn't know software could do that."* (Intelligence wow — the emotional high point of the demo.)
- **3:00 — The answer.** Back on Overview, the standings tile: *"You're 2nd in your pool, 4-1."* The question every coach and parent asks first, answered in the portal. (Standings wow.)
- **3:45 — Game day, compressed.** The anchor flips to game-day: the scorebug ticks a run in; the game goes Final; a share card renders with the team colors and the score. One tap posts it to the team chat. (Emotional peak.)
- **4:30 — Afterglow + the one ask.** The record ticks to 5-1, "your season is saved for next year," and a single quiet line: *"Clubs on FieldLogicHQ share every team's record into one dashboard."* No pushy pitch, no "unlock," no price war. (Aspiration.)
- **Close (5:00):** in five minutes the coach set a roster, built a compliant lineup, learned where they stand, and shared a result — the exact things a group chat and a spreadsheet can never do together. That is the buy.

---

## 7. Deliverable 7 — Owner Decisions List

| # | Decision | Options | Recommendation | Tradeoff |
|---|---|---|---|---|
| **1** ✅ | **House-league coach extension** in scope? — **ACCEPTED 2026-07-04: Separate stream (out of scope).** | In this review · Separate stream | **Separate stream (out of scope)** | House-league coach is a HIGH-severity dead end, but its fix (a team-scoped `league_teams.coach_email` relationship) is a data/access build, not IA. **Action item:** assign ownership to [ASSISTANT_COACHES_PLAN.md] Phase 5 (which already claims this fix) so it isn't double-built. |
| **2** ❌ | **Standings** — **REVERSED 2026-07-06: CUT entirely (was "conditional tile + view" 2026-07-04).** | Always-on · Conditional · **Off (chosen)** | **No standings feature.** | Owner call: standings are only computable when the team plays in a FieldLogicHQ-hosted tournament (where the platform has every team's games). Most tournaments will be OFF-platform (at least early), so a standings tile would be built on a thin, unrepresentative slice of a team's season — misleading. A season-long "league table" from the team's own games is impossible (we only have one side). Retired; the reserved anchor slot was removed. **Same data caveat applies to the Phase 4 "tournament placement card" — see §8.** |
| **3** ✅ | **Lineups nav presence** — **ACCEPTED 2026-07-04: Own "Lineups" nav item.** | Own primary nav item · Elevate within Schedule | **Own "Lineups" nav item** | Own item = discoverable for zero-retention coaches (the point). Elevating within Schedule is cheaper but keeps it a second-class citizen. |
| **4** ✅ | **History Overview preview tile** — **ACCEPTED 2026-07-06: Yes** (built: money-gated "Last season" tile → Season Review). | Yes · No | **Yes** | A last-season preview makes resonant data proactive; costs one tile + a small history-summary read. |
| **5** ✅ | **Tryouts hide trigger** — **ACCEPTED 2026-07-06: Hide unless signal** (signal = a tryout workspace row exists for the season; rediscoverable under "Explore"). | Always show · Hide unless run · Explore-only | **Hide unless a tryout signal exists** | Cleaner nav for the majority; needs a reliable "runs tryouts" signal (event presence or per-team flag). |
| **6** ✅ | **Tournaments hide trigger** — **ACCEPTED 2026-07-06: Hide until ≥1 registration** (rediscoverable under "Explore"; self-heals to its group on first visit). | Always show · Hide until first registration | **Hide until ≥1 external registration** | Removes a dead-end for rep-only coaches; keep rediscoverable so it's not "lost." |
| **7** ✅ | **Settings split** — **ACCEPTED 2026-07-06: Light split** (Settings was already cleanly sectioned; "Start next season" already surfaced from the Overview result phase — no rework needed beyond confirming it). | Keep mixed · Light split | **Light split:** Settings = config (division, org link, lineup rules); surface "Start next season" from Season/Overview at the boundary (also keep in Settings) | Cleaner mental models; more than one surface touches "start next season" (acceptable — it's a moment, not a page). |
| **8** ✅ | **"Accounting" → "Money" rename + Overview surfacing** — **ACCEPTED 2026-07-06: Rename + surface** (nav + hub title + all 8 sub-page breadcrumbs → "Money"; routes unchanged; overdue already surfaced on the Overview). | Keep name · Rename + surface | **Rename + surface overdue on Overview** | Plain language for non-tech coaches; requires copy + a help-doc touch. |
| **9** ✅ | **Phase-aware Overview** — **ACCEPTED 2026-07-04: Full phase anchor.** | Full phase anchor (adapt TeamHQ pattern) · Reorder-only | **Full phase anchor** | The anchor is the core of the review; reorder-only (move Season Record up, phase-order tiles) is a cheap partial that leaves the "two jobs" problem. Accepts the "adapt the TeamHQ pattern" build cost noted in §5.4. |
| **10** | **Naming reconciliation** | — | Route the brand doc's "Coach Portal" (singular) to `/marketing`; canonical is **"Coaches Portal" / "Premium Coaches Portal."** | Doc-hygiene, not UX; flagged so nav labels don't inherit the wrong name. |
| **11** | **In-product upsell label** | "Express interest" · Info-first (no button) | **Info-first (design log wins)** | The design-decisions log (binding) says the in-product `ScopeShelf` footer is info-first, no button; "express interest" applies only to the lead-capture page. Resolve so new surfaces don't reintroduce a button. |

---

## 8. Deliverable 8 — Phasing (structured around the coach journey)

Every phase is shippable and demonstrably better for a coach. **No phase requires a schema migration.** Assistant-capability + PIPEDA gating is a **constraint threaded through every phase**, not a phase of its own.

### Phase 0 — Stop the portal lying (verify + reconcile; no visible change)
- Produce a single build-state truth table (the two shells; what's built dev vs prod-pending — see §10).
- Fix the two correctness defects that erode trust: the **false "lineups done" checklist** (complete only when a lineup is saved for an upcoming game) and any residual **pricing/naming drift** ($19→$29, $179→$219, "Coaches Portal Premium"→"Premium Coaches Portal").
- **Coach gains:** the portal stops claiming work is done that isn't, and never shows a dead price.

### Phase 1 — Dashboard clarity (IA-only, no migration)
- Phase-aware Overview anchor (adapt the TeamHQ phase pattern); **Season Record moved up**; setup becomes a graceful receding strip; snapshot tiles phase-ordered; **Money overdue surfaced** on Overview; connective **next-game ↔ attendance ↔ lineup** flow.
- **Coach gains:** "what do I do right now?" answered without reading or scrolling.

### Phase 2 — Standings — ❌ CUT 2026-07-06 (owner decision; see §7 #2)
- **Dropped.** Standings are only truthful when the team is in a FieldLogicHQ-hosted tournament (the only context where the platform holds every team's games). With most tournaments off-platform early on, the feature would be sparse/misleading, and a season-long table from the team's own one-sided results is impossible. No standings route, tile, or view will be built. The reserved anchor slot was removed from the Phase-1 Overview.
- **Caveat carried forward:** the Phase-4 "tournament placement card" shares this exact limitation — it can only show a real placement for a FieldLogicHQ-hosted tournament. Scope it to that case (or cut it too) rather than implying a placement we don't have data for.

### Phase 3 — Navigation rebuild (Premium; IA-only, no migration) — ✅ BUILT on `dev` 2026-07-06
- Regrouped sidebar (Squad / Season / Money / Communication / Team admin); **Lineups** nav item; conditional Tryouts + Tournaments; **More-drawer reorg** under section headers; Settings light-split; **"Accounting" → "Money"** rename.
- **Coach gains:** nav that matches the coach's mental model; the lineup builder has a front door.
- **BUILT (2026-07-06):** desktop sidebar + mobile More-drawer regrouped into the five plain-language groups; new **Lineups** nav item + a **Lineups landing page** (upcoming/recent games → each deep-links to `/schedule?event=<id>&tab=lineup`, which now opens that game's builder — the Overview "Build lineup"/"Take attendance" CTAs use the same deep-link, capability-gated); **Tryouts + Tournaments** hide into an **"Explore"** group until a signal exists (two cheap read-only per-assignment signals `hasTryoutSignal`/`hasTournamentHistory`), still reachable (not a dead end); money-gated **"Last season"** tile on the Overview → Season Review; **"Accounting" → "Money"** (nav + hub + 8 breadcrumbs) and **"History" → "Season Review"** (nav + page). The `navVisible` gate was extracted to a **single shared module** (`lib/coach-nav-visibility.ts`) consumed by both nav components (was duplicated) + a new `Lineups` → `caps.lineups` rule. No migration. Typecheck + focused lint clean.
- **Adversarial review — COMPLETE (2 passes).** First workflow (5 dimensions, per-finding verification) → 3 in-scope fixes (Overview lineup-CTA gate, Season-Review page-title match, Lineups pre-caps fetch guard). Formal `/review` (high-risk funnel) → 2 more Low/Advisory fixes folded (Season-Review link-label stragglers on the Overview + Settings; error logging on the new nav-signal helper); 1 High **refuted** (mobile primary-tab capability filter is pre-existing/unchanged — git-diff confirmed); 1 pre-existing **Medium flagged** for a separate pass (assistant without `rosterPii` sees a false "N missing email" badge — older code, untouched here).
- **Owner decisions on the 2 pre-existing findings:** mobile primary-tab filter → **leave as-is** (consistent with the gating model); org-invite 2nd-lime CTA → **FIXED** (the "Review invite" button demoted to `btn-outline` so the phase anchor keeps the single lime action, CP-1).
- **`/docs` — COMPLETE.** Coaches guide updated: new sidebar grouping (Squad/Season/Money/Communication/Team admin), a **"Where do I build lineups?"** FAQ (Lineups front door), Money/Season Review renames, and the Explore hide-until-used behaviour — with the old terms ("accounting", "history", "past seasons") kept as search aliases so existing searches still land. Flows to the platform-admin support mirror automatically; no anchors renamed.
- **Follow-ups remaining:** owner browser test → commit → promote when ready.

### Phase 4 — Review depth (new routes; no migration)
- History **Overview preview tile**; **season-over-season comparison**; **per-player attendance reliability**; **"who's paid nothing"** segment; **tournament placement card** (wire the existing placement function to a coach route).
- **Coach gains:** the robust-metrics half of the promise — rich, resonant data at their fingertips.

### Phase 5 — Assistant-aware verification pass (enforcement is already LIVE on prod — this verifies against shipped code, not pending work)
- Confirm every new nav item, tile, and connective flow from Phases 1–4 respects the **already-shipped** capability gating (money tri-state, PII redaction via the `rosterPii` grant, announcements draft-only) at the app layer — including the duplicated `navVisible` filter in both nav components and the new Lineups `lineups`-capability rule.
- Note the existing gating is **fail-open** when capabilities are absent; the verification pass should decide whether new sensitive tiles (money "who's paid nothing", guardian contacts) should fail *closed* instead.
- **Coach gains:** safe delegation — assistants see exactly what the head coach granted, nothing more.

**Migration ledger:** Phases 0–5 are **migration-free**. Phase 2 (standings), Phase 4 (attendance-reliability, season-over-season, placement) each need **new API routes only**. This is a deliberate design choice and a phasing selling point.

---

## 9. Constraints respected (binding — do not violate in implementation)

- **Franchise model:** coach = primary operator; org/club = oversight only. Assistant management lives in the coach's Settings, never routed through org admin.
- **Separate codepaths (locked 2026-06-19):** Basic (`basic_coach_*`, `CoachPortalShell`) and Premium (`rep_*`, `CoachesSidebar`) stay separate; no unification proposed.
- **Premium ≥ Free (locked 2026-06-18):** every relocation preserves or improves capability; no regressions.
- **Assistant capability-gated nav + PIPEDA (binding):** ungranted areas never render; minor DOB + guardian contacts require an explicit per-coach grant (module-cap gate is never sufficient); app-layer enforcement on every nav element and route.
- **Sport-neutrality (binding):** no hard-coded "Runs / innings / mercy cap" — all vocab/rules route through the Sport Pack. New standings + placement surfaces read labels from the pack.
- **Plan naming + pricing (binding):** "Basic/Premium Coaches Portal"; never show a participating coach "Basic"/"Premium" as competing tiers — one identity "Your Coaches Portal," Premium additive. Standalone **$29/mo · $290/yr**; Club **$219**, Club·Association **$379**. Never restate a price from memory — reconcile against [PLAN_PRICING_FACTS.md].
- **Pressure-ladder / one earned ask:** pre-event surfaces pitch-free; the single acquisition moment is the afterglow. In-product upsell footer is **info-first, no button** (design log).
- **Cannibalization guardrail:** standalone Premium must not undercut Club; Club messaging emphasizes **org data-sharing, not price**.
- **Mobile-first (binding):** primary four bottom-nav tabs fixed (Overview/Schedule/Chat/Roster); reorg is the More drawer only. `900px` = shell reflow, `640px` = content reflow. Touch ≥40px (≥36px dense grids). Lime = fills/borders/CTAs only, never small text, never sunlight-readable as text — solid fills + bold weight for game-day.
- **Two dialects, one brand:** coach = warm/rounded; admin = dense cockpit. Align brand chrome only; do not blend.
- **Reuse don't rebuild:** shell, sidebar, hero pattern, editors, lineup generator + analysis, depth-chart board, season-record widget, and the broadcast primitives are built — design around them.

---

## 10. Source reconciliation (code beats prose)

Where a prior plan's prose disagreed with the code, the code (2026-07-04 grounding) wins:

- **Overview is not a hard binary flip.** Snapshot tiles always render; only the top stat strip flips off during setup; the setup panel disappears at "all satisfied." Real defect = no phase anchor + Season Record stranded at bottom.
- **Lineup builder is a peer tab to Attendance** in the schedule slide-over (not "below attendance"). It has no nav item. Depth-chart *is* a nav sub-page under Roster.
- **Accounting hub already shows summary cards + an overdue payables panel** — the defect is that this never reaches Overview and "who's paid nothing" isn't segmented, not that the hub is a blind menu.
- **Standings for a coach = genuinely unbuilt** (engine exists, wired only to admin/public; coach gets a link to the public standings page in the result phase only). New route, no migration.
- **Naming:** canonical is "Coaches Portal" / "Premium Coaches Portal" (pricing facts + design log, both binding); the brand doc's "Coach Portal" singular is the outlier → `/marketing`.
- **Pricing:** $19/team meter is retired; only standalone price is **$29/mo**; Club is **$219** (the growth plan's "$179" is stale). No "$19" in any copy.
- **In-product upsell:** info-first, no button (design log 2026-06-17) — overrides the growth plan's "express interest" for the in-product footer.
- **Build-state — verified against live git 2026-07-04 (supersedes the stale digests):**
  - **Assistant Coaches P1–P2 coach-side is SHIPPED to prod**, not "prod-pending." Commit `89863484` ("assistant-coach capabilities & invites, depth chart board, lineup innings caps") + `15f2664f` ("apply migs 164–174 to prod") landed via the 2026-07-03 release. Prod watermark is now **#174** (memory's "#163" is stale). Assistant capability enforcement, Lineup Intelligence, and the Tryouts suite are all LIVE.
  - **Coach nav already enforces capability gating** via a `navVisible(label)` filter **duplicated byte-for-byte in both `CoachesSidebar.tsx` (lines 66–81) and `CoachesBottomNav.tsx` (lines 58–71)** — gates Roster (`money`? no: `roster!=='off'`), Schedule, Tryouts, Announcements (`announcementsSend`), Accounting + History (`money!=='off'`), Documents (`documents!=='off'`), Staff (`isHeadCoach`). **Fail-open** if caps absent. Capability data arrives via `CoachesContext` (`useCoaches()`), not props. **Implication for Phase 3:** the nav regroup must carry `navVisible` into BOTH components and add rules for new items — **Lineups → gate on the `lineups` capability**, Standings → ungated (default visible), Money → keep `money!=='off'`.
  - **Per-assistant management lives on the STAFF page** (`.../staff/page.tsx` → `CoachStaffPanel.tsx`), NOT Settings. Settings holds exactly the four sections this plan reorganizes (division, start-next-season, lineup rules, org link). **The §7 Settings light-split is therefore collision-free** with assistant work.
  - **Active in-flight work (uncommitted 2026-07-04) is admin-side only:** an org-admin assistant-coaches oversight page + coach-settings/approve-invite APIs (under `admin/rep-teams/`), touching `lib/db.ts` and `lib/assistant-invites.ts` **additively**. It does not touch any coach-portal page this plan edits; the only shared file (`lib/db.ts`) is appended-to, so no coach-portal collision.
  - Basic nav-rebuild Phase 4 marked built but eval Phase A is "mostly built, needs a verified remediation pass" — still worth a quick Basic-side confirm before any Basic work (out of scope here).

---

## 11. Reuse inventory (built primitives this plan leans on — do not rebuild)

`TeamHQ` (phase-adaptive hero pattern) · `CoachLiveSchedule` (live scorebug) · `SeasonRecordWidget` · `DepthChartBoard` (desktop grid / mobile accordion, A-squad `--gold` star, undo/redo autosave) · `lib/lineup-generator.ts` + `lib/lineup-analysis.ts` (sport-neutral) · `TryoutCheckIn` (blind mode) · `RollingNumber` · `MyTeamDock` / `DesktopMyTeamRailCard` · `Countdown` · `SharePageButton` + `lib/share-card.ts` · `lib/team-color.ts` · `CoachEmptyState` (medallion + glow; note: not literally illustrated) · `getStandings` / `computeTournamentStandings` (engine for the new standings route) · `computePlacementStandings` (for the placement card route) · `CollapsibleCard`, `sheetOnMobile`, `stickyActionBar`, `tableAsCards`, `scrollX`.

---

*End of plan. Awaiting owner sign-off on §7 Owner Decisions before an implementation session begins. Any commercially-durable decisions accepted from §7 (e.g. standings gating tier) should be logged via `/strategy`.*
