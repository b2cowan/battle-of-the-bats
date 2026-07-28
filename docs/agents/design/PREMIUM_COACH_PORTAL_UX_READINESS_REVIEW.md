# Premium Coaches Portal — UX/Design Readiness Review

> **Date:** 2026-07-28 · **Method:** 18-agent evaluation (6 season-journey walkthroughs as a first-time coach, 4 cross-cutting audits, 1 competitor-informed wow-factor scan, 6 adversarial verification batches, 1 synthesis). All agents read live code (85 findings, 77 strengths, 12 wow ideas; 56 missing/critical claims adversarially verified against the codebase — **0 refuted**). Scope: the premium operator "HQ" at `app/[orgSlug]/coaches/` only; the free companion portal at `app/coaches/` referenced only as contrast/entry path.

---

## Executive Summary

The Premium Coaches Portal (the paid "HQ" experience) has real bones: a phase-adaptive Overview, a genuinely wizard-grade setup checklist, a well-designed Money hub, a strong 4-stage Tryouts flow, and an Insights hub that turns sparse data into encouraging, honest copy instead of blank numbers. Auto-save, reconciliation banners, and several mobile-first patterns (depth chart tap-to-cycle, roster card reflow, tryout check-in) show the team knows how to design for a volunteer coach standing at a field with a phone.

But underneath that foundation are a handful of **structural problems that will actively hurt the launch**, not just polish gaps:

- A coach's own paid tournament games — plausibly the main reason they upgraded — have **no attendance or lineup tools attached to them at all**.
- The **Premium Tournaments page is a dead end**: no explanation, no call to action, no way to figure out how to get a team registered.
- On mobile, **Save/Add buttons on most forms are physically covered by the bottom navigation bar**, and tapping in that zone activates a nav tab instead of saving the coach's work.
- A club-owned team's coach can be **locked out of their entire portal** the moment the season is marked complete, with the one "season wrap-up, nice job" screen the team built never rendering for them.
- The Overview and its setup checklist — the only guided tour a new coach gets — **never mention five of the portal's eleven sections** (Chat, Staff, Documents, Announcements, Development), so a coach can "finish setup" at 100% and still not know half of what they paid for exists.
- Every heavy form in the paid product (Add Player, Add Event, Staff capabilities, Add Payable) shows **10-13 fields/controls at once with no progressive disclosure** — while the free, non-paying tier already solved this exact problem elsewhere in the same codebase. Paying more currently buys a *denser* form, not a better one.

None of these are hard to fix, and several have an existing pattern elsewhere in the app to copy. This is exactly the moment the owner wants to catch them — before the interaction patterns calcify and get copied into new features.

**Independently-confirmed patterns** (the same problem found by more than one specialist, which raises confidence it's real and not a one-off read): form overwhelm on paid roster/event/staff/payable forms, the missing Attendance nav entry, the mobile-modal/nav-bar collision family, lineup touch-target sizing, and money-page mobile tables. These are called out below.

---

## Per-Question Assessment

### Q1 — Is it easy to find things / do patterns feel intuitive? — **Grade: C+**
The navigation shell itself is well engineered: sidebar and mobile bottom nav share one source of truth, so a capability that's visible on desktop is visible on mobile too, and there's no drift between them. Conditional features (Tryouts, Tournaments) use an honest "Explore" bucket that graduates items into their real group once used, rather than hiding them.

What drags this down: the season attendance report has **no home in either nav** (confirmed independently by two separate reviews) and is only reachable through a small secondary button or a buried hub tile. "Chat" and "Announcements" sit side by side with identical styling despite serving completely different audiences (organizers/other coaches vs. your own families) — a coach will click the wrong one first. The mobile notification bell simply doesn't exist. The in-app help center promises "look for the ? icons next to items" across the portal, but only 3 of roughly 25 team pages actually have one. A stale label ("Season Review") still points at what's now called "Insights" in three places. Individually minor; together they chip away at the "I always know where to go" feeling a paid product should have.

### Q2 — Is core functionality hidden — does the coach know it exists? — **Grade: D+**
This is the weakest area, and it matters most because it's a commercial risk: the signup page sells "dues, documents, attendance, lineups" as reasons to pay $29/month, but nothing inside the product ever walks a new coach past Roster/Schedule/Budget. The Overview page and its setup checklist — the only guided path a first-season coach gets — never mention Chat, Staff, Documents, or Announcements, and Development is essentially invisible too. A coach can hit "100% done" on setup and still have no idea half the product exists.

Worse, the Tournaments page — arguably the single most important feature for validating what this product is for — is a dead end with no explanation and no next step, and a team's *real* tournament games (played through an actual platform tournament, not a manually-added one) have no attendance or lineup tools attached at all. Tryout day promises "score them" but the actual scoring tool is a detour through Setup → Evaluators that reads like a tool for handing off to someone else, not for the coach themselves.

### Q3 — Field/option overwhelm — **Grade: C-**
This is a real, cross-cutting pattern, not an isolated screen problem. The Add Player modal (11 fields), the Add/Edit Event modal (up to 13 fields across five always-open sections), the assistant-coach capability panel (10 access decisions in one flat grid, auto-saving instantly with no confirmation), and the Add Payable modal (11 fields, no grouping) all show everything at once with no "start simple, add detail if you need it" pattern. The frustrating part: **the free, non-paying tier already built the fix** for the identical roster/schedule forms — fields collapse behind "optional" toggles there. Right now the paid product is objectively heavier to use for the same task than the free one, which is a bad look for something billed as the premium tier.

### Q4 — Guided workflows for empty sections — **Grade: C+**
Genuinely mixed. Three flows are legitimately wizard-grade and worth being proud of: the Overview "Get set up" checklist (required vs. skippable steps, live progress, per-step help), the Money hub's phase-driven Plan → Collect → Spend → Review anchor that always names one next action, and the Tryouts 4-stage flow with a "do this next" prompt. The Insights hub deserves particular credit — every empty report says something instructive and specific ("save a lineup for a few games and this fills in on its own") instead of a blank state.

But three sections are outright dead ends for a first-season coach: Chat (structurally empty outside an active tournament, with a link that goes nowhere useful), Development (four separately-empty pieces with no order or connective tissue), and Attendance (explains what it *would* show but never links to where you'd actually go record it). And the one true wizard — the setup checklist — gives a false sense of "you're done" by never routing a coach toward Staff, Documents, Tryouts, or Announcements even as optional steps.

### Q5 — Mobile + desktop friendliness — **Grade: D+**
There are excellent patterns here that prove the team can do this well: the roster table reflows into cards with move-up/down buttons in place of drag, the depth chart avoids drag-and-drop entirely with a tap-to-cycle control, the tryout check-in screen is glare-legible with large forgiving tap targets, and Schedule/Lineups got a genuine bottom-sheet mobile treatment.

The grade is dragged down hard by one critical, broad bug: on nearly every other page (Roster, Documents, all five accounting sub-pages, Tryouts setup), the **Save/Add button sits at a lower stacking layer than the fixed mobile bottom navigation bar**, so it can be visually and functionally covered by it — a tap in that zone hits a nav tab instead of the button the coach meant to press. The mobile "More" menu, separately, has no height cap or internal scroll, so on a shorter phone its top rows (including sign-out) can render above the top of the screen with nothing to scroll them into view. Money's densest reports have zero mobile adaptation at all. Several touch targets (lineup reorder arrows, lineup position cells) sit at 18-32px against an established ~36-44px standard the team uses elsewhere. This is the category with the single scariest bug in the whole review, but also the clearest existing in-house fix pattern (the bottom-sheet treatment already built for two pages) to roll out fast.

### Q6 — Wow-factor / delight — **Grade: C**
Nothing currently ships that a coach would screenshot and send to another coach. The product is solid and honest but plain — sparse-state copy is thoughtful, but there's no moment where the app hands a coach something they didn't have to build themselves (a season recap, a shareable scorebug link for parents, a player card, a "wrapped"-style season close). This is genuinely good news: the ingredients (team color system, attendance %, lineup history, development test trends, awards) already exist server-side across different pages — assembling them into a shareable, parent-facing artifact is presentation work on top of what's already built, not new plumbing. See the shortlist below.

---

## Prioritized Action List

### P0 — Fix before go-to-market (structural; harder to retrofit later)

**1. A club-owned team's coach can be locked entirely out of the portal at season's end.**
When an org admin closes out a program year before the coach's next-season assignment exists, the coach's whole Coaches Portal for that org collapses to a "not assigned to any teams" wall — instead of the well-built "season complete, nice work" screen the team already designed. This is the single scariest bug in the review: it can strand a paying customer with no path back in except contacting support. *Lives in*: the season/program-year closing flow and the coach-assignment lookup that decides what a coach can see.

**2. Real tournament games have no attendance or lineup tools.**
When a team plays in an actual FieldLogicHQ tournament (as opposed to a manually-typed practice game), the schedule shows it as a read-only chip with nothing behind it — no attendance tab, no lineup builder. For many teams, tournament games *are* their season. This undercuts the entire "run your team here" pitch on exactly the games most likely to matter most. *Lives in*: how the schedule renders tournament-sourced games vs. self-entered ones.

**3. The Tournaments page is a dead end.**
Empty state, no explanation, no button, no link — not even to where registration actually happens. A confused coach can't tell "you haven't registered" from "your account isn't linked yet." *Lives in*: the team-scoped Tournaments list and its empty-state component.

**4. Mobile Save/Add buttons are covered by the bottom navigation bar.**
This affects nearly every add/edit form outside two pages (Roster, Documents, all Accounting sub-pages, Tryouts check-in). A coach's tap in that zone can silently hit a nav tab instead of saving their work. This is a stacking-order bug with a known, already-proven fix elsewhere in the same product (the bottom-sheet treatment used for Schedule and Lineups) — it just needs to be applied everywhere else. *Lives in*: the shared modal/overlay styling used by every "add" form.

**5. The mobile "More" menu can grow taller than the screen.**
No scroll limit means a full-capability coach's menu (10+ rows plus headers) can push items — including sign-out — above the top of a shorter phone screen, with no way to scroll to them. *Lives in*: the mobile bottom-nav's overflow/"more" sheet.

**6. The guided onboarding path never mentions half the product.**
The Overview page and its setup checklist are the only tour a new coach gets, and between them they cover exactly 5 of 11 sidebar destinations. Chat, Staff, Documents, and Announcements are never linked, previewed, or mentioned anywhere on Overview — and the checklist itself never grows to include them even as optional steps. A coach can hit "100% set up" and still not know Staff invites or a document library exist. Given these are explicitly part of what's sold at signup, this is a direct value-realization gap for paying customers. *Lives in*: the Overview page's snapshot tiles and the setup-checklist step list.

**7. No fast way to add a roster.**
Adding 15 players means 15 full open-fill-save-close modal round trips with no CSV/paste import and no "save and add another." This is the highest-friction task in the entire first two weeks of using the product and a well-known point where a busy volunteer just gives up and goes back to a spreadsheet or group chat. *Lives in*: the Add Player flow on the Roster page.

**8. Every heavy form in the paid product overwhelms with 10-13 simultaneous fields — a regression versus the free tier.**
Add Player, Add/Edit Event, the assistant-coach capability grid, and Add Payable all show everything at once, with capability changes on the staff panel saving instantly with no confirmation even for money access or family contact info. The free (non-paying) tier already solved this exact problem with collapsible "optional" sections on the identical forms. Right now, the thing coaches pay for is measurably *harder* to fill out than the thing that's free. *Lives in*: Add Player (Roster), Add/Edit Event (Schedule), the assistant capability panel (Staff), Add Payable (Money/Expenses).

### P1 — High-value, soon after launch

- **Fix the Chat vs. Announcements mix-up.** Add a one-line description under each nav label so a coach knows before clicking that Chat talks to organizers/other coaches, while Announcements emails their own families.
- **Give Chat an honest empty state.** For most of a non-tournament season, Chat is structurally empty; say so plainly instead of pointing at a link that goes nowhere useful.
- **Give Attendance a real home.** Add it as a real nav item (not a secondary button that disappears in one roster view), and link the season summary report to wherever attendance is actually recorded, and vice versa. Found independently by two reviewers — a strong signal this is a real gap, not a one-off read.
- **Put a notification bell somewhere on mobile.** Right now, a phone-only coach can never see their notification feed or reach notification settings at all.
- **Extend the "don't lose my work" safety net to Accounting and Tryout setup forms.** Roster, Schedule, and Announcements all warn before discarding unsaved changes; the longest, most annoying-to-redo forms in the product (a full tournament payable, a hand-built budget split, a tryout scorecard) currently do not.
- **Fix weekly recurrence for league schedules.** "Repeat weekly" locks every generated game to one fixed opponent, so it doesn't actually save time for a real round-robin schedule — worse, it takes more total clicks than not using it at all.
- **Add schedule import.** Same rationale as roster bulk-add, one tier down in urgency since recurrence covers some of the practice-only case.
- **Fix the game-day card downgrade.** Three days before a game, Overview gives one-tap links straight into lineup and attendance. On the actual game day — the moment with the least patience — it downgrades to one generic link. This should be backwards.
- **Bump lineup touch targets on mobile.** The reorder arrows and per-inning position cells are both under the touch-target size used elsewhere in the same screen family — found independently in two reviews.
- **Make Money's reports mobile-usable.** Budget vs. Actual and related tables have zero mobile adaptation, unlike the rest of Money which already reflows nicely — found independently in two reviews.
- **Reflow forms to one column on phones.** Add Player and Player Detail keep a rigid two-column layout that squeezes every input to roughly a third of a phone's width.
- **Add a first-visit orientation moment for coaches who never had a free team.** Right now only migrated teams get a "welcome, here's what this is" banner; a coach who signed up cold gets straight into an operational checklist with no reorientation.
- **Clarify what guardian fields actually do.** There's no parent/player invite or account-linking anywhere in Roster — just contact info. Either make that explicit in-product or cross-link to wherever parent access actually happens, so support doesn't have to explain it after the fact.
- **Sort the Tournaments list and add in-context help.** Bundle with the P0 Tournaments fix — order entries chronologically/by status, and add the same help affordance the sibling Tryouts page already has.
- **Give the season a "you're probably done" nudge.** Once games stop appearing on the schedule, nothing tells a coach their season may be over — the product just quietly stops, which is exactly the risk this review set out to check.
- **Fix the tryout scoring detour.** Put a "score as yourself" shortcut directly on the Tryout Day tab instead of requiring a coach to generate an "evaluator" link meant for someone else.
- **True up the help-icon promise.** Either roll the "?" icon out further, or soften the help copy that claims it's everywhere — right now only 3 of ~25 team pages have one.

### P2 — Polish

Two competing, confusingly similar "coverage" doors on the Development hub; a permanent "coming later" placeholder card on a brand-new team's Development hub; a "Give an award" picker with no explanatory text when empty; the "Season Review" stale label lingering in three spots after the section was renamed to "Insights"; Settings' season-rollover summary not mentioning what happens to development history or awards; the Explore nav group sitting unexplained at the very bottom of the sidebar with no seasonal nudge; capability-gated nav items (Money, Announcements, Staff) vanishing outright for restricted assistants instead of showing a locked state; the depth-chart toggle having no "try this" highlight for coaches who've never clicked it; two unconnected "documents" concepts (template library vs. per-player signed submissions) with no cross-link; document uploads never prompting a "let families know?" nudge into Announcements; inconsistent "(paid only)" caveats on Money's headline numbers; no cross-link between Payment Requests and Org Allocations; a native browser confirm() for removing an assistant coach and a native alert() for a budget-delete failure, both breaking from the app's own styled dialogs; a missing live duplicate-jersey check in the Add Player modal (only shown after saving); no "save & add another" shortcut even within the accepted one-player-at-a-time flow; two different position-editing interfaces for the same underlying field; a data-quality nudge that requires opening each flagged player individually rather than editing inline; a buried calendar-sync option on the regular schedule versus a dedicated, well-labeled button on the tournament schedule; a two-tap attendance-marking flow with no single-tap status toggle; desktop data grids (Depth Chart, Budget vs. Actual) capped to a narrow reading column and then forced into their own internal horizontal scroll on wide monitors anyway; Insights tables scrolling sideways with no visible hint that they do; a "Coming in a later phase" note not otherwise distinguished from the fact that it applies to the whole hub; and Month view's calendar grid staying uncomfortably tight on phones.

---

## Wow-Factor Shortlist

Eight ideas worth building, chosen for high impact relative to effort and for how directly they patch a finding above:

1. **First-10-Minutes Setup Momentum Ring** — a visible progress trail (roster added → first game scheduled → first lineup built → first announcement sent → money started) on Overview for a brand-new team. Directly answers the P0 finding that a new coach's first look at the product is five flat "None"/"0" tiles, and gives the missing-feature-awareness problem (finding #6 above) a natural home to point to Chat/Staff/Documents too.
2. **A real Game Day card for regular-season games**, not just tournaments — kickoff time, a lineup-ready/not-set chip, and an arm-care warning if a pitcher is near their innings cap, all on the page a coach lands on by default. Directly fixes the game-day-card downgrade finding.
3. **One-tap postgame recap draft into Announcements** — the moment a final score is entered, pre-write the "here's how it went" message to families using the game's saved lineup and any award given, ready to review and send. Removes the single most repetitive chore in a coach's week and turns the Chat/Announcements confusion into a moment where Announcements proves its own value.
4. **A live, no-login "follow this game" link for parents** — reuses the scorebug and share-link patterns already built for tournaments, extended to regular games. The single most likely-to-go-viral feature in the list; a parent who couldn't make the game forwarding this to grandparents is free marketing.
5. **A shareable player "trading card"** — number, position, season stats, development-test improvement, and awards, styled in the team's own colors, generated from data the product already tracks. Pure parent-facing bragging-rights material.
6. **A Season Recap page per player** — attendance, playing-time in plain English, development before/after, and awards, assembled from four datasets the product already computes, with a one-tap "send to family" action. This is the single thing every parent actually wants at season's end and gives the currently-broken season-end experience (see P0 finding #1) something worth celebrating instead of a dead end.
7. **A "Season Wrapped" shareable highlight card** — final record, longest streak, closest game, top award-winner, attendance rate, styled like a highlight reel. Turns the moment the season currently "just stops" into deliberate ceremony, and gives coaches a reason to open the app one more time when renewal goodwill is highest.
8. **Printable award certificates** — a two-click print-ready certificate straight from the existing awards history, for the actual end-of-season pizza-party moment. Small build, outsized emotional payoff, and a natural companion to the Wrapped/Recap ideas above.

---

## Top 5 Strengths to Protect

Whatever gets rebuilt in the P0/P1 pass, these should survive untouched — they're genuinely good and were confirmed by direct code reading, not assumed:

1. **The Overview "Get set up" checklist** — one required step, every optional step explicitly skippable (not just ignorable), a live progress bar, and skip-state that's remembered per team. This is close to matching the standard of the admin tournament wizard and should be the template extended to cover Staff/Documents/Development (P0 #6), not replaced.
2. **The Money hub's phase-driven Plan → Collect → Spend → Review flow**, which always names exactly one next action based on the team's real data, and correctly hides Org Allocations/Payment Requests for standalone teams rather than showing every door to everyone. This is the single best answer in the whole portal to "does this feel overwhelming."
3. **Auto-save with reconciliation, everywhere it's used.** Attendance and lineups both save within a second with a persistent status indicator, and a two-way banner catches "marked in but not in the lineup" / "in the lineup but marked out" with one-tap fixes. No save button to forget on a windy field.
4. **The Tryouts 4-stage flow and its field check-in tool.** A "do this next" prompt, a plain-language walkthrough of all four stages, and a genuinely well-built, sunlight-legible, large-tap-target check-in screen with a forgiving undo. This should be the reference pattern the team reaches for whenever another feature needs the "explain yourself to a first-timer" treatment.
5. **The Insights hub's honest, instructive empty-state copy.** Every report — playing time, attendance, awards, development — turns a lack of data into a specific, encouraging next step instead of a blank number or chart. This is a real point of polish that shouldn't get flattened while other empty states (Chat, Tournaments, Attendance) get fixed to match it.

*Honorable mentions worth noting but not in the top 5:* the shared design system for confirmations and empty states (used consistently almost everywhere it should be), the depth-chart's tap-to-cycle mobile control that deliberately avoided a fragile drag-and-drop pattern, and the roster table's card-reflow-with-move-buttons fallback for mobile reordering.

---

## Appendix — Finding-to-Route Map

*(Grouped by theme; findings merged where two or more specialists independently confirmed the same underlying issue are marked "×2"/"×3".)*

| Theme | Route(s) | Merged findings |
|---|---|---|
| Season-end lockout for club teams | Team Overview / program-year status change | f5-0 |
| Real tournament games missing attendance/lineup | Schedule, Tournament registration detail | f2-0 |
| Tournaments empty state dead end | Team Tournaments list | f3-0, f3-1, f8-4 (×3) |
| Mobile Save button hidden under bottom nav | Roster, Documents, all Accounting pages, Tryouts check-in | f9-0, f9-5 (×2) |
| Mobile "More" menu no scroll cap | Bottom nav overflow sheet | f6-1 |
| Overview/checklist omits Chat/Staff/Documents/Announcements/Development | Team Overview, setup checklist | f0-0, f8-3 (×2) |
| No bulk/fast roster add | Roster — Add Player | f1-0, f1-8 |
| Heavy-form overwhelm (Roster, Schedule, Staff, Payables) | Add Player, Add/Edit Event, Staff capability panel, Add Payable | f1-1, f7-0 (×2), f7-1, f1-4, f7-2 (×2), f7-4 |
| Chat vs. Announcements confusion | Chat, Announcements | f4-0 |
| Chat dead end outside tournaments | Chat | f8-0 |
| Attendance has no nav home | Attendance report, Roster, Insights hub | f2-6, f6-0 (×2), f8-2 |
| No mobile notification bell | Portal-wide mobile chrome | f4-1 |
| Unsaved-changes guard missing | Accounting modals, Tryout setup modals | f7-3, f7-7 |
| Weekly recurrence fixed-opponent | Schedule — Add Event | f2-1 |
| No schedule bulk import | Schedule | f2-2 |
| Game-day card downgrade | Team Overview "Now" card | f2-3 |
| Lineup mobile touch targets | Lineup builder | f2-4, f2-8, f9-4 (×2) |
| Money tables no mobile adaptation | Budget vs. Actual, Budget, Expenses, Allocations, Fundraisers | f4-2, f9-1 (×2), f4-3 |
| Roster/Player Detail forms no mobile reflow | Roster (Add modal), Player Detail | f1-3 |
| No welcome banner for cold-signup coaches | Team Overview | f0-3 |
| Guardian fields are contact-only, no invite path | Roster, Player Detail | f1-2 |
| Tournament list ordering / no in-context help | Team Tournaments list | f3-2, f3-3 |
| Season winding-down no cue | Team Overview | f5-1 |
| Tryout scoring hidden detour | Tryouts — Tryout Day tab | f3-4 |
| Help-icon coverage promise vs. reality | Portal-wide, Help content | f6-3 |
| Guidance-copy dead code (stages never render) | Team Overview | f0-1 |
| Mobile snapshot "wide tile" CSS unused | Team Overview | f0-2 |
| Two documents concepts unconnected | Documents, Roster/Player Detail | f4-5 |
| Documents upload doesn't prompt announcement | Documents | f4-4 |
| Development hub — two overlapping doors, no connective flow | Development hub | f5-3, f8-1 |
| Development "coming later" placeholder | Development hub | f5-4 |
| Give-award modal blank empty state | Awards — Give an Award modal | f5-5 |
| Playing-time report mobile table | Insights — Playing Time | f5-6, f9-3 |
| Stale "Season Review" label | Settings, Overview result card | f5-2 |
| Settings rollover copy omits Development/Awards | Settings | f5-7 |
| Explore nav group unexplained / buried | Sidebar, bottom-nav More sheet | f3-5, f6-6 |
| Insights label churn / unclear mapping | Sidebar, Insights hub | f6-4 |
| Lineups/Schedule split nav groups | Sidebar | f6-5 |
| Capability-gated items disappear vs. lock | Sidebar, bottom-nav | f6-7 |
| Depth chart no discovery nudge | Roster — Depth Chart toggle | f6-8 |
| ReleaseDot missing on mobile | Sidebar vs. bottom-nav Help link | f6-2 |
| Multi-team hub thin onboarding | Org-level My Teams hub | f0-5 |
| Help button small icon-only trigger | Team Overview header | f0-4 |
| Two position-editing UIs | Roster Add modal vs. Player Detail/Depth Chart | f1-5 |
| Data-quality nudges require full navigation | Roster list | f1-6 |
| Duplicate jersey number no live check | Roster — Add Player modal | f1-7 |
| Calendar sync buried in Export menu | Schedule vs. Tournament record | f2-5 |
| Attendance two-tap marking flow | Schedule — event slide-over | f2-7 |
| Roster-submit zero state no link to Roster | Tournament registration detail | f3-6 |
| Money headline caveat inconsistent | Money hub | f4-6 |
| Payment Requests / Allocations no cross-link | Money — Payment Requests, Allocations | f4-7 |
| Native confirm() for removing assistant | Staff | f7-5 |
| Native alert() on budget delete failure | Budget | f7-6 |
| Budget split hint missing until error | Budget — Add/Edit Line | f7-8 |
| Desktop grids capped to narrow column | Depth Chart, Budget vs. Actual | f9-2 |
| Month calendar tight mobile cells | Schedule — Month view | f9-6 |
