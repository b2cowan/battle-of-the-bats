# Plan & billing — one experience for every plan

**Status:** Stage 1 Parts 1–3 implemented 2026-10-28; Part 3 validation and owner-walk gates recorded in §9 · PM brief:
`PLAN_AND_BILLING_ONE_EXPERIENCE_PM_BRIEF.md`

## 1. Why

A person who starts as a Premium coach and later becomes a club owner finds their plan and billing in a
different place, with a different layout and different words, each time. Measured 2026-10-28 (three audits,
spot-checked against the code):

| | Standalone coach | Tournament / Plus | League Plus | Club |
|---|---|---|---|---|
| Title | "Coaches Portal billing" | "Plan & billing" | "Plan & billing" | "Plan & billing" |
| Door | the generic **Admin** door → lands on tournament onboarding (the confusing screen) | Settings & access hub card; no rail row | rail row + org-home tile | rail row + hub row |
| Layout | older page, restyled | same | same | **redesigned kit page** |
| Cancel words | "Cancel Premium" | "Cancel and suspend account" | same | "Cancel and suspend {org}…" |
| Non-owner by URL | page + disabled buttons | same | same | locked card |

Two components sit behind one URL (`BillingPagePlans`, ~1,350 lines, and `BillingKit`, ~460 lines), the
"what's included" list lives in **three** places (page `PLAN_FEATURES`, kit `CLUB_INCLUDES`,
`lib/plan-article-content.ts`), and the same idea is worded differently in each (past due, cancel, trial,
free time, success, cancelled).

## 2. Owner rulings (2026-10-28, binding)

1. **"Same place" means the same look, navigation and experience — NOT the same URL or the same shell.**
   Each portal renders Plan & billing in its own chrome; the *body* is identical.
2. **A standalone coach does not use the admin view for plan & billing.** It renders inside the Coaches
   Portal. The admin view the coach was dropped into (the tournament-setup bounce) is retired for them.
3. **The Club redesign is extended to every plan.** This knowingly reverses the 2026-09-27 "restyle it
   here" ruling for the non-Club plans (that ruling was scoped to a restyle; this replaces it).
4. **Built so a new or changed plan is a data edit, not a screen edit.**
5. **~~Billing can be delegated~~ — REVERSED 2026-10-29 (owner): Plan & billing is the OWNER's alone.** Why: it is
   infrequent, the owner's responsibility, and every door a delegate could reach (checkout, plan moves, the Stripe
   portal, reactivation) touches real money. `hasCapability` now returns false for `billing` and `org_settings` for every
   role but owner, whatever a stored override says; Members → Manage no longer offers the switch; the PATCH route refuses
   a grant. The text below is the superseded 2026-10-28 ruling, kept as the record. Delegation was never on production, so
   no member loses access. Stripe's portal keeps cancel and plan-change OFF in both modes (walk 4 · Call 2).
   Superseded: **Billing can be delegated through the `billing` capability** (owner, Part 3 build, 2026-10-28).
   No role acquires it by default. Only the owner grants/revokes it in Members; a member without billing access sees
   the locked card. Billing-capable members get the page, navigation and reads as well as the existing money actions.
   **Cancel and downgrade stay the owner's alone** (owner ruling 2026-10-29): the four routes check `role === 'owner'`
   and the page shows a delegate neither door. **Keep suspended billing access** to the count-only usage route for recovery. These rulings supersede the earlier
   owner-only billing wording in the stage prompts; later stages must carry the same capability gate.

## 3. Findings that shape the plan (argued from the code)

- ⚠ **"Retire admin for standalone coaches" cannot mean the whole admin area.** A standalone coach's
  hosted tournaments (`CoachHostedTournamentsSection` → `/admin/tournaments/**`, `/admin/org/tournaments`)
  have **no portal twin**, and the workspace's staff helpers (`/admin/org/members`, 3 seats) are not what the
  portal's Staff page manages. What retires is: the **admin hub / tournament-onboarding bounce**, the
  **Admin door** in the portal's nav, and **the billing page in the admin shell** for this audience. The
  hosted-tournament pages stay (reached from the portal's own Tournaments section). See Open question A.
- **Two plan-change mechanisms are not connected:** Club moves (`/api/billing/move`, preview + checkout
  fallback, club ↔ club·association and Plus → Club) vs. the older downgrade preflight (`/downgrade/*`,
  Plus → free only). The unified "Change plan" table is a presentation unification in Stage 1; merging the
  server logic is out of scope and must not be smuggled in.
- **The coaches shell is missing pieces the body needs:** no tournament provider (slot count would read 0),
  no club-brief provider (team count would not load), `FeedbackModal` closes to `/admin/tournaments`, and
  `create-checkout` silently drops any `returnTo` not starting `/{slug}/admin/`. Each is a named Stage 2 task.
- **A cancelled / free-time-ended workspace must still reach billing.** The coaches layout's walls
  (`SubscriptionEndedWall`, `FreeTimeEndedWall`, the zero-team wall) currently offer the owner no billing door;
  today `CancellationGuard` sends them to the admin page. Retiring admin makes this a **must**, not a nicety.
- **Founding Season (D6)** is banned from the Club page and shown on the others. The shared body keeps that
  as a per-plan flag, not a branch in the screen.
- **Already consistent (keep):** one payment door ("Payment method & invoices" → secure portal), owner-only
  billing capability, shared status words (`subscriptionStatusLabel`).
- **Standing defects found on the way (fix in Stage 1):** the payment-portal return URL is hard-wired to
  `/admin/org/billing`, which bounces tournament tiers elsewhere; the "Organization" eyebrow shows on plans with
  no organization; a UAT case (`plan-gating.spec` non-owner) already expects a disabled button the Club page
  no longer renders.

## 4. The design in one paragraph

One **shell-agnostic Plan & billing body** (the Club page's sections, in the Club page's order) driven by a
**plan profile registry** (one entry per plan: name/price from `plan-config`, which usage meters it shows, the
"what's included" list, which plans it can change to, what goes offline on cancel, whether Founding Season
applies, whether it is on sale) and **one words module** (every sentence a billing screen speaks, in the
`lib/online-payment-words.ts` pattern, so copy is edited in one file and a build guard keeps screens off
free-typed strings). Two thin **hosts** wrap the body: the admin host (admin header, club kit chrome) and the
coach host (`CoachPageHeader`, portal chrome). A **shell-aware link resolver** replaces `getBillingHref` so
every email, bell row, Stripe return and wall door goes to the viewer's own host. Adding a plan = one registry
entry + one words entry; changing a price = `plan-config` only.

**Sections, in order, for every plan:** (1) Your plan — name, price line, status chip, renews / trial /
free-through, "Payment method & invoices"; (2) What's in use — the plan's meter(s) (teams, tournament slots,
staff seats); (3) free-time / founding band when applicable; (4) Stripe fees (when any); (5) Change plan — one
table of the plans this owner can move to; (6) What's included; (7) Reduce or cancel (Stage A ruling 6). One cancelled view,
one non-owner locked card, one set of state words.

## 5. Stages (each ends: `verify:changed`, `/review` offered, `/docs` offered, an owner walk written)

**Stage A — Drawn first (blocking, owner mockup session via `/design`).** One checkable Artifact: the body
for **every plan × every state** (active, trial, past due, free time running / ending / ended, founding comp,
cancelled, non-owner), TRUE SIZE, desktop + phone, in BOTH hosts (admin kit chrome and coaches-portal chrome),
plus the new coach "Plan & billing" row in the rail and the phone More sheet, the owner-only door on each wall,
and the "Covered by {Club}" line. Nothing below starts until these are ruled.

**Stage 1 — One body, one registry, one words file, on the existing admin shell.** Extract the body from the
Club page; build the plan profile registry (folding the three "included" lists into one source); the words
module + build guard; every plan's admin page now renders it (tournament, Plus, League, Club, and the coach
workspace still in admin for this stage). Unify the cancel dialog, the cancelled view, the non-owner locked
card, the change-plan table (presentation only). Fix the three defects above; a tournament-tier rail row for
Plan & billing; remove "Organization" where there is none. Repoint the ~12 tests/baselines/help articles that
read the old page's source (list in the working notes). *Visible result: every plan's page looks and reads
like Club's.*

**Stage 2 — The coach host + the door.** New workspace-level page in the Coaches Portal (no team in the URL;
reachable with several teams, none, or only closed seasons). "Plan & billing" row in the portal's rail foot and
More sheet "You" group — **owner-only, standalone-only**; club owners keep "Admin". Provide the missing
providers; `returnTo` allow-list accepts the coach host; the shell-aware link resolver replaces
`getBillingHref` (≈20 callers: emails, bell rows, Stripe success/cancel/return, walls, `/pricing`, lock
lines); the bell gets a label for the new link; owner-only door on the cancelled, free-time-ended and
zero-team walls (so a lapsed owner can always reactivate); the coach's help "?" and `CoachPageHeader` guard.
*Visible result: a standalone coach opens Plan & billing without leaving the portal.*

**Stage 3 — Retire the coach's admin view.** Team workspaces: `/admin` redirects to the portal (precedent:
the accounting / families / rep-teams layouts); the old billing and subscription URLs redirect permanently to
the coach page (old emails and bell rows keep working); the **Admin** door leaves the portal's rail and sheet
for standalone coaches (club owners/admins keep it); the tournament-onboarding bounce can no longer happen.
Hosted-tournament pages and the staff-helper page stay reachable per Open question A.

**Stage 4 — The rest of the family.** "Covered by {Club}" read-only line for coaches on club-owned teams (who
pays, no controls); free Basic teams' upsell footer uses the same plan words; the Money tab's "club bill"
vocabulary checked for collision. (`BillingPagePlans` and its CSS are deleted in Stage 1, once nothing renders them;
Stage 4 only sweeps what is left.)

**Stage 5 — Docs, demos, walks.** `/docs` rewrite of the billing help articles (club-plan-and-billing,
subscription-ends, Stripe fees, cancel) and the coach help; `/demos` needs nothing per commit (owner ruling);
UAT specs updated; layout baselines refreshed on staging, not the dev server.

## 6. Open questions for the owner

- **A. Where does a standalone coach reach the staff-helper page and the hosted-tournament pages once the
  Admin door is gone?** Recommended: the portal's Tournaments section already links to the tournaments; add one
  quiet "Tournament helpers" link there (to the members page, kept in the hosted-tournament shell). Alternative:
  build a portal page — larger, not needed for this project.
- **B. Does the unified "Change plan" table list Premium Coaches Portal → Club?** That is pricing/packaging —
  routes to `/strategy` and `/billing`, not decided here. Stage 1 shows only moves that exist today.
- **C. In-app invoice list.** No plan has one; invoices live only in the secure payment portal. Out of scope
  unless the owner asks.

## 7. Risks

- Stage 1 touches the largest and most-tested billing file; five unit tests regex-read its source. They are
  repointed in the same change, not loosened.
- The registry must be the **only** place plan facts live. A build guard (like `check:spelling`) should fail a
  billing screen that hard-codes a plan name, price or included-item.
- Cancelled-workspace access (the `allowSuspendedOrg` layouts and `org-billing-access-guard`) is load-bearing;
  every new file on that path is added to the guard.
- Stripe return paths are the easiest thing to break silently — Stage 2's walk covers each: portal return,
  card-saved, next-season choice, checkout success/cancel, plan move.

## 8. Not in scope

Pricing or packaging changes; merging the two plan-change server mechanisms; an in-app invoice list;
`/account` gaining a plan section (a plan belongs to a workspace, not a person — ruled out on purpose).

## 9. Build prompts and progress

**Who builds what.** Stage A (the drawings) is a Claude `/design` session: it publishes a checkable Artifact and cannot be
handed to Codex. Stages 1–5 are written to run on Codex, one chat per stage, each starting from the shared rules file.

| Stage | Prompt | Gate before it starts |
|---|---|---|
| A | (Claude `/design`) | owner says go; mockup per §5 Stage A |
| 1 | `PLAN_AND_BILLING_STAGE1_BUILD_PROMPT.md` | Parts 1–3 implemented 2026-10-28; validation and remaining owner gates below |
| 2 | `PLAN_AND_BILLING_STAGE2_BUILD_PROMPT.md` | Stage 1 verified |
| 3 | `PLAN_AND_BILLING_STAGE3_BUILD_PROMPT.md` | Stage 2 walked · owner's answer to §6 A written in the prompt |
| 4 | `PLAN_AND_BILLING_STAGE4_BUILD_PROMPT.md` | Stages 1–3 verified · Stage A drawings for the "Covered by" line ruled |
| 5 | `PLAN_AND_BILLING_STAGE5_BUILD_PROMPT.md` | Stages 1–4 verified |

Shared by all: `PLAN_AND_BILLING_CODEX_RULES.md` (design/UX rules, data and safety rules, process, hand-off format).
Slash commands (`/review`, `/simplify`, `/docs`, `/design`) stay Claude-side; each Codex hand-off lists which are owed.

**Stage 1 Part 2 hand-off prompt:** `PLAN_AND_BILLING_STAGE1_PART2_BUILD_PROMPT.md`, prepared 2026-10-28 for another
chat after Part 1's `/simplify`, `/review` and required verification gate. It builds the shared body, neutral UI/data
dependencies and a minimal existing-Club-host integration; the all-plan cutover/navigation stays Part 3. This is not
the Stage 2 Coaches Portal host. Preparing this prompt does not start Part 2 or certify Part 1's review/gates.

**Part 2 review and the next two prompts (2026-10-28):** Part 2 had `/simplify` and `/review` (Claude). Fixed in the
review: the `export *` client-boundary build break in the old FreeTimeBand path, Cancel/Downgrade showing to Founding
Season customers, a failed grant read looking like "no free time" (`getCustomerFreeTime` takes `{ strict }`), the
Founding "still free through" date dropped on a Club free-time plan, org-slug comments. Follow-up items were assigned to
`PLAN_AND_BILLING_STAGE1_PART2_FIXES_PROMPT.md` (failed-read handling, dropped "Keep" sentences, Founding card button,
bfcache, reload flicker, a money-request test); implementation and current checks are in the review-fix hand-off below.
Then `PLAN_AND_BILLING_STAGE1_PART3_BUILD_PROMPT.md`. Two owner
calls remain open and are not for Codex: the usage route's suspended-owner access, and owner-only versus delegable
billing. The admin-lettering baseline needs the owner's `--init`.

**Stage A drawings:** drawn 2026-10-28 — local owner source `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` (read end to end,
879 lines, 2026-10-28); original artifact: https://claude.ai/artifact/P5nxScMk51Qc6qMi5T86FP. Nine tabs: the body in
both chromes, every plan, every state, change plan, cancel, doors, coach page, Covered by, Asks. Compared all six
included lists, body/state/window builders, both chromes/phone treatment and the 13 Asks against the copy document;
differences and recommendations are itemised in copy §12. Today/Before screens and rejected alternatives were
distinguished from ruled A choices. Owner source was neither edited nor rendered. **All 13 asks ruled by the owner
2026-10-28 (see below).** The Before screens are rebuilt from code, not captured. **Placement ruled by the owner:**
Plan & billing sits in the rail foot beside Help on every plan; Club/League move it out of Organization and tournament
tiers gain the foot row. The phone drawing puts it in More → You (the earlier reading still recorded below for
confirmation). What the drawings found against the original plan:
- **"Moves that exist today" includes Plus → Club; no screen opens it.** The move window is mounted only on Club screens; the server supports it. Drawing it adds a door (ask 7).
- **Section order:** the original §4 listed Included before Change plan; the Club page puts Change first. Ask 6 ruled Club's order, now reflected in §4. Tab 1 still defaults to the rejected brief-order alternative.
- **The Admin door is an owner-or-admin door,** not a standalone-only feature. "Standalone owner" needs its own test in Stage 2 (ask 13).
- **Closed-season sheet:** only the team tools collapse; Notifications, You and the foot stay, so a Plan & billing row stays reachable on desktop and phone.
- **Open question A is bigger than stated:** "Tournaments you run" lives inside the team's Tournaments page, which a closed season redirects to Season's End. A coach with only a closed season would lose the hosted-tournament pages once Admin goes (ask 4).
- **Zero-team wall has no chrome at all,** so Plan & billing cannot sit under it; the cancelled and free-time-ended walls cannot tell an owner from anyone else today (the role is not passed). Stage 2 supplies both.
- **Non-owner on the older page** is not "disabled buttons": most controls are hidden, and Upgrade / Reactivate stay clickable until the server refuses.
- **Found, not changed:** coach retention is told as 365 days on the review and 90 in the result message; two cancel lists still promise "invoices and reconciliation"; the Club page's last-14-days text says "choose it below" with nothing to choose; the server accepts any Club or Association downgrade at once with no team-cap check; a Premium shelf card would read "0-day trial".
**Stage A rulings (owner, 2026-10-28, binding; every one is option A, the recommendation, in the drawings' Asks tab):**
1. "Covered by {Club}" lives in **Team settings, first card** (read-only, club-paid teams only).
2. The Tournament **Settings & access** hub card **stays** beside the new rail row.
3. The Coaches Portal page is titled **"Plan & billing"**.
4. Open question A: a standalone coach reaches hosted tournaments and tournament helpers through **a workspace-level "Tournaments you run" link next to Plan & billing, plus the quiet "Tournament helpers" link**.
5. On a phone the change-plan table becomes **cards**, one per plan.
6. Section order is **the Club page's: Change plan, then What's included** (the body's order is: Your plan, What's in use, band, Stripe fees, Change plan, What's included, Reduce or cancel).
7. **Plus → Club: draw it, build it when Club opens** (until then the Club rows read "Contact us to move").
8. The Premium coach's Change plan slot holds the existing **"Part of a club?"** door.
9. The plan entry is the **only source** for days kept and for what goes offline: **365 for Premium, 90 for organizations; accounting words as the Club page says them.**
10. The Premium cancel button reads **"Cancel Premium…"**.
11. After paying, success and errors use **the Club page's fading line, everywhere** (no modal).
12. "Managing more than tournaments?" stays as **a quiet last section on tournament plans only**.
13. Stage 2 adds a **test for "owner of a standalone Coaches Portal"** and uses it for the row and for removing the Admin door.
Earlier the same day the owner ruled **Plan & billing sits in the rail foot, beside Help, on every plan** (above).
**Follow-through:** the small drawing for portal workspace links and the plan-details link is owed before Stage 3.
The later P-b/P-c rulings below settle Plus rows now/real move when Club opens, and phone More → You on every plan.

**Progress — 2026-10-28, Stage 1 Part 0:**

- Read both billing components end to end and traced shared free-time, move, fee, cancellation and reactivation words.
  Prepared `PLAN_AND_BILLING_COPY.md` (today's wording by concept, proposed wording, included-list ownership choice)
  and `PLAN_AND_BILLING_STAGE1_IMPACT_INVENTORY.md` (six direct screen-reader tests, three nav tests, one stale UAT
  assertion, regression coverage, baseline/script/help dependencies). The owner accepted Part 0 in the follow-up
  recorded below; drawing differences are listed for explicit decisions rather than silently selected.
- Recorded concrete defects: Premium cancellation result says 90 days while its review/server say 365; the shared
  server shutdown list still claims invoices/reconciliation; org free-time copy points at a hidden chooser; old
  generic trial text can say zero days; blanket restoration wording omits the retention window and slot limits.
  Corrections are approved subject to the specified drawing/trial/door decisions; no runtime edits at this checkpoint.
- Owner approved one registry owning paired billing/article feature variants, unchanged article feature strings/order,
  and guards for both requirements; the honest org-free-time contact invitation is also approved (below).
- Club notice presentation means successes fade and errors persist. This agrees with the drawing's success-state
  note and Ask 11; no modal/automatic jump is carried into the proposed body.
- Read the local drawings source end to end and recorded the checked areas above and every discrepancy in copy §12.
- Owner ruled `check-public-tokens.mjs` stays unchanged. The deleted CSS's named entry is **stale entry, harmless,
  tidy later** because discovery uses `existsSync`; page.tsx remains the host. Do not ask again to edit the stale list.
- Parts 1–3 require the explicit “build Part 1” instruction; Stage 1 is not declared complete from this audit.

### Owner Part 0 follow-up rulings — 2026-10-28 (binding)

1. Part 0 is accepted. Read the local Stage A HTML source end to end, compare every plan/state and report differences;
   the owner decides each difference, with words taking precedence when ruled. Do not edit the owner HTML.
2. Leave `check-public-tokens.mjs` alone and do not ask again. Missing named CSS is skipped with `existsSync`;
   retain the admin page host. Record the obsolete entry as harmless. Coverage of the new shared billing body is a
   separate recommendation/owner decision and would be its own commit; no shared automation edit is authorised here.
3. Org ending copy “To keep {given}, contact us.” is approved with a working contact door. List every surface/test
   before editing `lib/free-time-copy.ts`, preserve running copy, and leave portal Keep Premium untouched. Two display
   variants per plan are approved inside one registry; add guards for both-present and every existing article feature
   string remaining unchanged from today's `plan-article-content.ts`. Other proposed copy is approved subject to the
   trial and upgrade-door checks and explicit reconciliation of drawing differences.
4. Verify the trial sentence against config and actual checkout paths for every trial plan. Report differences;
   change/drop any unsupported card-collection or first-charge promise. Do not ship what checkout cannot keep.
5. A visible “See what {plan} includes” door must be in Change plan on every plan with a table. Check the drawing;
   if absent, report it and do not invent placement. Retiring the old pitch must not leave only an Upgrade button.

**Requested now:** docs-only updates and findings. **No runtime work, test implementation, or Part 1 before the owner
says “build Part 1”; no commit.** Unrelated scheduling failures belong to the other sessions and remain untouched.

**Findings, not added rulings:** only Premium's included list differs (drawn 7 / proposed billing 5 / published article
8). All five other plan lists match. Copy §12 records the wording/renderer differences and recommendations, including
the missing table details-door placement. Actual subscription checkout collects a payment method by default but does
not explicitly restrict it to cards; merged trial days and history decide eligibility. Existing Club card-specific canon
needs the owner's wording decision (§13). Copy §14 and the impact inventory list both org builder callers, the alias,
renderer, affected help instruction, and the single direct old-sentence test pin. General operator/TSX token coverage
already covers `components/billing`; extension of stricter whole-file coverage is only a recommendation for later.

### Owner rulings on the copy §12 / §13 decisions — 2026-10-28 (binding)

The owner answered every card of the decision page, taking Codex's recommendation each time. The three drawing
inconsistencies (D29 hosting line during Premium free time, D30 closed Club "Move" buttons, D31 Organization eyebrow on
Premium) were acknowledged: the existing rules stand. IDs refer to copy §12 unless noted.

| ID | Ruled |
|---|---|
| D1 | Premium billing list = the **seven drawn items**; the hosting item is left out during staff free time. The eight-item published article stays unchanged. |
| D5 | Meter captions: "{n} of {limit} tournament slots", "{n} staff seats · unlimited" (connected-figure layout, pluralised). |
| D25 | Club cancel list: **short program names with the active team count**, fed from the one server source. |
| D32 | A quiet "See what {plan} includes" link **under each target plan's name**, desktop and phone. |
| T1 (§13) | "Payment method" wording everywhere, **including the public pricing page**. Billing screens use it in Stage 1; the shared Club trial sentence (also on the pricing page and the brand copy doc) changes in its own step through `/marketing`. Checkout is not changed to force cards. |
| P-b | Plus owners see the Club rows now ("Contact us to move" until Club is on sale); the real move is wired when Club opens. |
| P-c | Phone: More sheet, **You** group, on every plan (owner only). |
| P-a | One small drawing session covers the "Tournaments you run" / "Tournament helpers" links and the plan-details link, before Stage 3. |
| D2, D3, D4 | "What's included"; "Free"; "Holds" on every table. |
| D6, D7 | "Normally $X a year." (sentence case, full stop); "…choose a plan for your {year} season." |
| D8, D9, D11 | Bounded, product-specific cancel copy; offline list shown in the window; real archived counts, restoring limited by time and plan. |
| D12, D13, D14 | "Keep Premium"; "Cancel Premium"; left-hand foot sentence "Your data is kept for {days} days." (365 Premium, 90 organizations). |
| D26, D34 | Existing server wording "The Premium local tournament slot"; plain × on desktop, Back on phone forms. |
| D15–D19 | "Premium is cancelled"; "Reactivate {plan} and restore your data"; qualified restore checklist; "Reactivate Premium"; extra cancelled-view paragraphs left out except retention facts that must be true. |
| D20–D24 | "Downgrade to Tournament?"; drawing's reason box ("Why are you downgrading?" / "For your records and ours. You can leave it empty."); buttons "Keep {current plan}" and "Downgrade to {target}"; detailed lost-feature list plus the true branding note; the downgrade door appears once, in Change plan. |

D27 and D28 were ruled earlier (org ending contact invitation; running band unchanged); D29–D31 follow the existing rules.
**Still owed:** the small drawing for the portal links and plan-details link (P-a); a `/marketing` pass for the shared
trial sentence (T1); `verify:changed` cleared of the unrelated lint-setup error before Part 1 is called done. Part 1
was subsequently authorised by “build part 1”; see the implementation record below. The unrelated lint gate must
still be cleared before Part 1 is called done; no gate is bypassed here.

### Part 0 verification and hand-off — 2026-10-28

**Customer/role outcome:** documentation prepared for review; customer behavior follows in Parts 1–3. The proposal
gives owners the same billing body with appropriate plan actions and gives every non-owner the locked card. No
runtime code, pricing, server mechanism, auth, navigation, baseline or permission change was made at this checkpoint.

**Files prepared:** new `PLAN_AND_BILLING_COPY.md` and `PLAN_AND_BILLING_STAGE1_IMPACT_INVENTORY.md`; updated this plan,
its PM brief (ruled section order and Part 0 checkpoint), and this project's one-line TODO index entry. Existing
unrelated working-tree edits were preserved. No commit was made.

**Checks:**

- Document validation passed: four documents parse as UTF-8, 352 Markdown table rows have consistent columns,
  and no trailing whitespace. TypeScript AST comparison of the two original components found every static prose
  literal longer than 22 characters represented in the inventory (excluding a CSS class string); dynamic sentences
  were reviewed by concept. This supplements, not replaces, the manual end-to-end read.
- `git diff --check -- <five task paths>` passed; new/untracked documents were also checked directly above.
- `npm run check:spelling` passed. `npm run check:todo-size` passed (56 KB).
- `npm run verify:changed -- <four documentation paths>` stopped in the unit-test stage: **11,494 passed / 2 failed /
  11,496 total**. The package script chains checks with `&&`; downstream lint/token/type/date/schema/etc. checks did
  not run after that failure. Its appended path arguments do not limit the initial whole unit suite. No clean full
  verification result is claimed. Failure output from unchanged scheduling files:

  ```text
  tests/unit/club-schedule-league-plan.test.ts:115
  a slot cleared from the schedule, nothing in its week: cancelled
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal
  actual additionally contains games: { move: [], postpone: [], remove: [] }

  tests/unit/club-schedule-league-plan.test.ts:194
  is the same whatever the order, and changes when a practice is added
  TypeError: Cannot read properties of undefined (reading 'move')
  at leagueFingerprint (lib/club-schedule-league-plan.ts:221:19)
  ```

- `npm run typecheck` ran separately and exited 2 with six diagnostics in unchanged scheduling code/tests:

  ```text
  lib/club-schedule-send.ts(774,5): TS2322 — Property 'games' is missing in type
    '{ teams: PreviewLeagueTeam[]; seen: string; }' but required in the expected type.
  lib/club-schedule-send.ts(975,42): TS2345 — Type '{ moved: number; cancelled: number;
    divisions: string[]; }' is missing gamesMoved, gamesNeedDate, gamesRemoved, gamesWaiting
    required by LeagueNoticeCounts.
  tests/unit/club-schedule-league-plan.test.ts(197,36): TS2345 — Property 'games' is missing
    in the argument but required in LeagueStepArg.
  tests/unit/club-schedule-league-plan.test.ts(197,58): TS2345 — same missing 'games'.
  tests/unit/club-schedule-league-plan.test.ts(198,39): TS2345 — same missing 'games'.
  tests/unit/club-schedule-league-plan.test.ts(198,61): TS2345 — same missing 'games'.
  ```

  Full command outputs are in the session temp files `plan-billing-stage1-part0-verify.log` and
  `plan-billing-stage1-part0-typecheck.log`; these are not new repository files. The scheduling defects were reported,
  not repaired as part of this billing copy task.

**States/flows:** source-walked active, trial, past due, no card, no fees, free time running/last 14 days/ended for org
and coach, Founding comp/card/next-season states, cancelled/reactivate, non-owner typed URL, Stripe failure branches,
and one-shot success/card-saved/next-season flags. No browser, 390px rendering, real payment, empty-invoice portal,
or actual Stripe return was exercised. Portal return, card-save, next-season choice, checkout success/cancel and
plan-move returns remain implementation/walk work; no return URL was changed here.

**Owed for the completed Stage 1 build:** `/simplify` before `/review`, then `/docs`, the Claude-written owner walk,
and the dev-server restart required after the new runtime files/shared modules. The current checkpoint is docs-only
and does not hand off a changed screen for browser testing; no dev server was started or restarted. Local drawings
have now been read in source; their copy differences and missing door placement await the owner's decisions. No full
layout sweep was run.

**Approval scope after follow-up:** registry variants and the real Contact us invitation are now owner-approved;
ordinary proposed fallback/state copy is approved subject to the trial/door checks. The drawing's conflicting wording
remains an explicit decision list in copy §12, not a set of inferred rulings. The follow-up validation results below
are separate from the initial suite/typecheck results above.

### Docs-only owner follow-up verification — 2026-10-28

- Changed only the copy document, impact inventory, this plan, PM brief and this project's single TODO line. No
  runtime code, tests, hooks, check scripts, configuration or owner drawing was edited; no commit. Source comparison
  covered every plan's included list, body/state/window wording, 13 Asks and desktop/phone variants. Drawing SHA-256
  matched its initial read after the work. Article feature arrays were captured as dated count/hash anchors for the
  future preservation guard; the new tests themselves wait for Part 1.
- All five documents passed UTF-8/readability, table-column and trailing-whitespace checks (425 table rows across the
  files). `git diff --check -- <five task paths>` passed. The direct explicit-file checker
  `node scripts/verify-changed.mjs <five markdown paths>` passed: “No changed lintable JS/TS files found.”
- `npm run check:spelling` passed; `npm run check:todo-size` passed (56 KB).
- Re-ran the requested `npm run verify:changed -- <five docs paths>` once. **All 11,507 unit tests passed**; the
  previous two scheduling failures did not recur. The command then exited 2 during ESLint of the shared tree's
  26 changed JS/TS files, not these docs:

  ```text
  ESLint: 9.39.4
  A configuration object specifies rule "react-hooks/set-state-in-effect",
  but could not find plugin "react-hooks".
  ```

  This configuration failure is outside this docs-only task; no ESLint/plugin fix was attempted. Remaining chained
  gates were not reached. Full output: session temp file `plan-billing-stage1-part0-followup-verify.log`. The npm
  wrapper still does not pass its appended doc arguments to the middle lint command, so the direct explicit-file
  check above is the scoped result. No check script was changed to work around this behavior.
- Did not re-run typecheck: this follow-up changes only docs, and the owner assigned the prior six scheduling type
  errors to other sessions. The initial diagnostics remain historical evidence above, not a claim about their current
  state. No browser/Stripe action, render, full layout sweep or dev-server restart was needed or performed.
- Remaining owner decisions/recommendations appear once in copy §12 (drawing reconciliation), §13 (Club's card-specific
  trial canon versus payment-method wording) and the inventory's token-coverage recommendation. The table details door
  is required but has no approved placement drawing. **Wait for “build Part 1”.**

### Stage 1 Part 1 implementation — 2026-10-28

**Authorisation and scope:** owner said “build part 1”. Built the registry, words and guard-test foundation. The newer
owner-ruling block above governs the seven-item Premium billing variant, Holds heading, yearly comp helper and
downgrade vocabulary. It does not authorise Parts 2–3 or the separate public-trial `/marketing` step. No commit.

**What customers see:** current screens, roles, controls and routes remain. Both live billing lists now read from the
registry, and published article text/order is unchanged. The Premium profile has the ruled seven items ready for the
shared body; its old five-item constant was not rendered by the current coach page (the old feature-list loop is in
the non-coach self-serve reactivation branch). No new plan price, entitlement, sale gate or purchase action.

**Files changed, grouped:**

- Data/words: new `lib/plan-billing-profile.ts`, `lib/plan-billing-words.ts`, `lib/billing-cancellation-policy.ts`,
  `lib/plan-move-options.ts`. Config-backed names/prices/caps; mandatory paired included variants; meters; supported
  checkout/move/downgrade descriptions; existing-comp display flag; shared retention and add-on-aware cancellation
  projections. D25's short program names/team count and detailed server wording derive from the same selected areas.
- Existing consumers: `lib/plan-article-content.ts`, `app/[orgSlug]/admin/org/billing/page.tsx`,
  `components/admin/kit/club/BillingKit.tsx`. Their duplicate included arrays are removed. All four article arrays
  retain their dated count/hash and article keys; no new article route is invented for the other two profiles.
- Server compatibility: `lib/billing-retention.ts` and `lib/plan-move.ts` consume/re-export the extracted pure policy.
  Owned-plan selection, enabled add-ons, retention, supported move map and Stripe/DB execution are unchanged. The
  cancellation and downgrade mechanisms remain separate. No migration or production access.
- Tests: new `tests/unit/plan-billing-profile.test.ts`, `plan-billing-words.test.ts`,
  `plan-billing-source-guard.test.ts`; repointed only the moved constant assertion in
  `coaches-portal-cancellation-guard.test.ts`, retaining the preflight-use assertion. Source guard scans actual
  literals/JSX, with two exact retiring-file exceptions carrying written reasons and frozen hashes; no exemption for
  a directory or new body. Fake-plan coverage proves registry extensibility; rendering remains a Part 2 assertion.
- Tracking: plan, PM brief, copy status, impact inventory and this project's single TODO line. Other sessions' edits,
  the owner's HTML, hooks, permissions, check scripts, config and baselines remain untouched.

**Part boundaries:** the words module prepares the ruled vocabulary but the old screens have not been rewritten to
use all of it. Org free-time ending copy changes with its real contact door/help/test changes in the shared body;
the running/portal builders are untouched now. The old preflight's accounting sentence is preserved during this
no-screen-change extraction, with the approved correction prepared in the words module. The Club page's remaining
hand-built concise cancellation sentence moves to the shared preflight projection with the body. Public
`clubTrialLine()` remains for its specifically assigned `/marketing` step; the new billing words say payment method.

**Checks and results:** focused new tests passed (18); complete unit suite passed (11,601 on the first run; final
rerun recorded below). Typecheck passed. Focused ESLint on all 13 task code/test files passed, using the unchanged
repo configuration. Full `verify:changed` reached shared-tree lint and failed with:

```text
ESLint: 9.39.4
A configuration object specifies rule "react-hooks/set-state-in-effect",
but could not find plugin "react-hooks".
```

The Next lint config registers the plugin for its JS/TS file patterns; shared-tree lint also includes unrelated
files. No config/automation workaround was applied, and the full verification gate is not called green. Unchanged
spelling and full token checks passed separately. The unchanged admin-type check reported unrelated debt (none of
these CSS files was edited by this task):

```text
components/admin/kit/club/PayoutsCard.module.css: face 1, line 27
components/shared/SystemScreen.module.css: track 1, line 83
app/platform-admin/early-access/[leadId]/lead.module.css: face 1, line 24
```

**States/flows:** tested config price/cycle/date values, trial eligibility, non-owner words/possessives, no-comp-on-Club
flag, shared free-time/fees/status builder references, retained-count grammar and coach/org retention/add-ons. Current
source guards/whole unit suite cover the unchanged existing flows. No browser/390px rendering, real Stripe action,
or full layout sweep. Portal/card-save/next-season/checkout success/cancel/plan-move returns are untouched and were
not re-walked. No-card, no-invoice, no-fee and UI loading/error presentation stays with the old screens until the body.

**Owed:** `/simplify` then `/review` for the shared abstractions. `/docs` and the Claude-written owner walk accompany
the screen-changing parts. Full verification must clear the shared-tree findings before Part 1 is called done.
Dev-server restart and final checks are recorded below; Part 2 has not started.

**Final Part 1 validation:** after applying the recorded owner decisions and the short cancellation projection, the
unit suite again passed **11,601/11,601**; final `npm run typecheck` exited 0; focused ESLint on the final changed
modules/tests passed. Full `verify:changed` again stopped at the same unrelated shared-tree plugin error, so the
owner's full-green completion gate remains open. Final logs: session temp files
`plan-billing-stage1-part1-final-verify.log` and `plan-billing-stage1-part1-final-typecheck.log`.

Restarted the verified workspace dev process tree after the final shared-module batch using network-enabled
`npm run dev`; it reached Ready and the required `/platform-admin/login?next=%2Fplatform-admin` check returned
**HTTP 200**, with no Supabase `EACCES` failures in the restart/request logs. The server remains running. No browser
test or cache deletion. TODO size passed (57 KB); explicit-path whitespace/document checks passed at hand-off.

### Stage 1 Part 2 entry-gate audit — 2026-10-28

The owner requested execution of `PLAN_AND_BILLING_STAGE1_PART2_BUILD_PROMPT.md`. Checked the shared `dev`
branch and preserved other sessions' edits. The latest Part 1 hand-off above lists `/simplify` then `/review`
as owed; no subsequent completion record was found in this project's records. The Part 2 prompt explicitly
requires both reviews and a green full `verify:changed` result before implementation.

Re-ran the unchanged `npm run verify:changed` command (through `npm.cmd` for PowerShell execution-policy
compatibility). Lockfile check and **11,638/11,638 unit tests passed**. The command exited **1** at ESLint:
**3 errors and 9 warnings** across the current shared tree. The three blocking errors are all in the
unrelated `app/dev/crash-test/page.tsx`:

- `9:15`: `react-hooks/purity` — `Date.now()` called during render.
- `11:5`: `react-hooks/globals` — module-level `failUntil` reassigned during render.
- `12:5`: `react-hooks/globals` — module-level `rearmAfter` reassigned during render.

The historical missing-`react-hooks`-plugin configuration error did not recur in this run. Later gates did
not execute after the lint failure; no independent typecheck or CSS check was run at this checkpoint.
Full output: session temp file `plan-billing-part2-entry-gate.log`. No gate was bypassed, no files were hidden
from verification, and unrelated lint/config/automation work was left to its owning session.

**Outcome:** entry audit and tracking updates only. Owners and non-owners retain the existing billing
screens. Part 2 implementation awaits the required review completion evidence and a green full gate;
this checkpoint does not certify Part 1 or Stage 1. Only this plan, the PM brief and the existing TODO line
were updated. No runtime changes, commit, push, Stripe-return change, browser/390px walk, preview route,
or dev-server restart. Existing server left untouched. The Part 2 state/flow checklist, `/simplify`,
`/review`, `/docs` and owner walk remain for the implementation. Part 3's all-plan admin cutover/navigation
and Stage 2's Coaches Portal host remain outside this checkpoint.

### Stage 1 Part 2 implementation and hand-off — 2026-10-28

**Owner confirmation and scope:** after the entry audit, the owner said “simplify and review were done, go ahead”.
Accepted that confirmation for Part 1's reviews and proceeded with Part 2 after reporting the concrete shared-tree
lint failure. This authorises the implementation; it does not turn a failing completion gate green. Work stays on
`dev`; no commit or push. Part 3 and Stage 2 remain separate.

**Customer outcome by role:** Club owners now use the profile-driven shared billing body inside their existing
header/chrome. It keeps the connected plan/renewal/usage band, names real active teams in cancellation, bounds
restoration by retention and capacity, offers target details below each plan name, and uses the approved words.
Non-owners get the locked card before any billing read mounts. Other plans keep their existing live admin screen;
the new body's actual rendering is exercised for all six profiles and an isolated extra profile. The shared org
ending invitation and its real contact door also reach the still-live non-Club screen. No new coach host or nav.

**Implementation files, grouped (paths below are relative to the repo):**

- Body and neutral billing presentation: `components/billing/BillingBody.tsx`, `Billing.module.css`,
  `PlanMoveDialog.tsx`, `PlanArticlePanel.tsx`, `FreeTimeBand.tsx`, `FreeTimeBand.module.css`,
  `StripeFeesList.tsx`, `StripeFeesList.module.css`, `PaymentsEndingSection.tsx`.
- Neutral shipped window/notice implementations: `components/shared/KitDialog.tsx`, `KitDialog.module.css`,
  `PageNotice.tsx`, `PageNotice.module.css`. The real window retains the focus floor, overlay count, history Back,
  dirty-close ask, busy blocking, layering and phone treatment. Notices retain the existing success fade/error
  persistence. Existing admin paths re-export these implementations; they are not dependencies of the body.
- Minimal host and compatibility: `components/admin/kit/club/BillingKit.tsx` owns the old header/chrome and supplies
  billing/Rep teams destinations. Existing `KitDialog.tsx`, `PageNotice.tsx`, `PlanMoveDialog.tsx`,
  `StripeFeesList.tsx`, `PaymentsEndingSection.tsx`, and `components/admin/FreeTimeBand.tsx` retain imports for other
  callers. Retired copies of `components/admin/kit/club/{Billing,KitDialog,StripeFeesList}.module.css` and
  `components/admin/FreeTimeBand.module.css` were removed after implementation/styles moved.
- Data and words: `lib/plan-billing-data.ts`, `billing-usage.ts`, `plan-billing-profile.ts`,
  `plan-billing-words.ts`, `billing-cancellation-policy.ts`, `billing-retention.ts`, `free-time-copy.ts`;
  `app/api/billing/usage/route.ts`, `app/api/admin/org/free-time/route.ts`. Profiles carry the optional discovery,
  club invitation and free-time included-item omissions. No second registry/words file/included array. The
  published article-key set and exact article feature strings/order retain their hash guards.
- Affected legacy consumer/help: `app/[orgSlug]/admin/org/billing/page.tsx`, `lib/help-content/org.tsx`.
  Both org ending band and ending billing line have contact doors. Running and portal sentence assertions stay
  exact. The Club help's ending instruction, bounded restoration paragraph and search text follow those changes.
- New actual-render/service/route coverage: `tests/unit/plan-billing-body.test.ts`,
  `plan-billing-usage.test.ts`, `_billing-test-loader.ts`. React itself renders the actual body and shipped parts;
  the test adapter handles TSX/CSS/Next Link and explicit external dependencies, not a replacement screen.
- Existing billing guards updated: `plan-billing-profile.test.ts`, `plan-billing-source-guard.test.ts`,
  `free-time-surfaces.test.ts`, `org-billing-access-guard.test.ts`, and all six old-screen readers:
  `support-console-stage4b-coach-guard.test.ts`, `stripe-fees-owner-rulings.test.ts`, `team-move-words.test.ts`,
  `tournament-one-at-a-time.test.ts`, `gated-plan-availability-copy.test.ts`, `plan-panel-host.test.ts`.
  Club's frozen literal exception was removed because its literals left; the live non-Club hash stays unchanged.
- Relocation-only guard reads: `admin-overlay-guard.test.ts`, `admin-record-delete-guard.test.ts`,
  `club-stage3c-screens-guard.test.ts`, `club-stage3d-screens-guard.test.ts`,
  `coach-practice-plans-phone-guard.test.ts`, `install-banner-layer-guard.test.ts`,
  `kit-dialog-floor-guard.test.ts`, `kit-dialog-foot-text-guard.test.ts`, `kit-dialog-record-guard.test.ts`,
  `one-window-stage1-guard.test.ts`, `one-window-stage2-guard.test.ts`,
  `support-console-stage4b-ending-reminders.test.ts`. They inspect the same implementation at its neutral home;
  the admin overlay census explicitly includes the window it borrows. Assertions remain in force.
- Tracking: this plan, PM brief, copy status, impact inventory and the existing single TODO line.

**Added reads and why:** `GET /api/billing/usage?orgSlug=…` is owner-only, explicitly scoped, read-only and
count-only, with suspended-owner comeback access documented in its guard. The old members/count route provides
only seats, lacks the owner billing check, and substitutes zero for failed counts; cancellation preflight names
records and counts completed tournaments, so neither supplies safe slot/team meters. The new service uses
`getNonArchivedRepTeamCount`, `SLOT_STATUSES`, `seatExemptRoles`, effective org tournament/team limits and the
enforcement seat limit. Errors return unavailable. Cancellation preflight uses that same team-count source and
the shared short shutdown projection, including enabled add-ons and the corrected accounting description.

The existing free-time read also accepts owner-only `billing=1`: failures return unavailable, and old ended coach
grants remain distinguishable after the informational 30-day band window. This reuses `endedPortalFreeTime` and
returns only the state/day, never the Basic team id. Other consumers keep their informational window. Without
that mode an old ended grant, or a failed grant read, could falsely show cancellation/retention. There is no new
capability, write endpoint, migration, Stripe/server import in the client graph, or production operation.

**Returns and actions:** the host supplies the billing base to checkout/reactivation and the move fallback;
portal/card/next-season requests also carry it, while their existing server return behaviour stays in place.
`billingReturnState` consumes `success`, `card_saved` and `next_season` once while retaining `plan` and other
query parameters. A remembered checkout choice suppresses the chooser even after flags are removed and before
the webhook catches up. Checkout remains busy while leaving; browser-cache returns release busy state. Applied
checkout results use retained/restored counts. Move and downgrade still use their separate existing endpoints.
The server allow-list and portal/card/next-season return resolvers were not broadened or retargeted. Tests check
two supplied host bases, flag consumption and the fallback source; no real Stripe action was walked.

**Checks:** final recorded results below. The full gate remains a requirement; Part 2 is implemented, not declared
verified. The first full unit run found two relocated-source guard failures; both were repointed, then the full
suite passed. Focused flow coverage includes all profiles/roles, an extra profile, usage errors and isolation,
long-ended coach grants, details prices, Founding chooser suppression and existing article hashes.

**State/flow checklist:** actual React render/unit coverage for no card, absent fees, loading/error, return success
and one-shot flags, past due, a real trial-end date, org/coach free time running/ending/ended, Founding holders and
choices, cancelled owners, non-owner entry, scheduled moves, retention/add-ons and target details. No in-app invoice
list was added; invoices keep their existing Stripe portal door. Browser focus/history/dirty interactions, actual
Stripe portal/card/next-season/checkout/move/downgrade operations and 390px visual behaviour are **owner checks**,
not claimed walked. Phone cards/tap floors are implemented; no browser test or full layout sweep was run.

**Nearest shipped components/deviations:** the real KitDialog and PageNotice implementations, CoachCard/Eyebrow/Chip,
LoadingState, global buttons, Club billing/table type, FreeTimeBand, PlanArticlePanel, StripeFeesList and
PaymentsEndingSection. No preview route or replacement sales paragraphs. Association's unpublished details use
its own profile label/price/article variant inside the existing drawer, without adding public article keys. An
owner billing read mode for long-ended grants was the necessary additional data fix described above. The window
uses the required plain desktop ×. No new visual framework or all-plan live cutover.

**Owed:** Part 2 `/simplify`, then `/review`, `/docs` and the owner browser walk. Part 1 review completion is confirmed
by the owner and is not owed again. Part 3 still owns all-plan admin integration, rail/More navigation, portal-return
fix and legacy-screen retirement; Stage 2 owns the Coaches Portal host. Public Club trial/brand copy stays in its
separate `/marketing` step. Hooks, check scripts, automation/config, generated baselines and the owner HTML were
preserved. Other sessions' edits remain intact.

**Final verification record:**

- Final `npm run verify:changed`: **11,709/11,709 unit tests passed**, then exited **1** at shared-tree ESLint
  (**3 errors / 8 warnings**). Errors remain in `app/dev/crash-test/page.tsx`: `9:15` `react-hooks/purity`
  (`Date.now()` during render), `11:5` and `12:5` `react-hooks/globals` (module-level mutations). No task lint
  error was reported. Later commands in the full gate did not run. Log: `plan-billing-part2-final-verify.log`
  in the session temp directory.
- Final `npm run typecheck`: **exit 0** (`plan-billing-part2-final-typecheck.log`). Focused ESLint over the task's
  51 code/test files: **exit 0**; final small component/help changes are also included in the last full ESLint
  run above. Focused actual-render/data/guard runs passed; the complete final suite is the result above.
- Unchanged token checks, spelling consistency and CSS Module purity: **passed**. Explicit-path whitespace
  check and TODO size: **passed**. No layout sweep or generated-baseline rewrite.
- Separate CSS selector check: **exit 1**, with four observed unrelated orphan references:
  `app/platform-admin/early-access/[leadId]/LeadRecord.tsx:31`,
  `app/platform-admin/feedback/[id]/FeedbackRecord.tsx:24`,
  `app/platform-admin/feedback/[id]/ReplyWindow.tsx:25` (all `record.module`),
  `app/platform-admin/orgs/[id]/MoneyTab.tsx:180` (`money.compare`). Ten unrelated dead classes were reported in
  `app/[orgSlug]/admin/public-site/public-site.module.css` (`addressFact`, `addressText`),
  `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css` (`formInput`, `formTextarea`),
  `app/[orgSlug]/coaches/coaches.module.css` (`statItem`),
  `app/platform-admin/observability/observability.module.css` (`eventList`, `eventStrong`, `eventSummary`), and
  `app/platform-admin/overview.module.css` (`sourceList`, `sourceListTitle`). Log: `plan-billing-part2-css.log`.
- Separate admin lettering check: **exit 1**. Existing findings:
  `components/admin/kit/club/PayoutsCard.module.css:27`, `components/shared/SystemScreen.module.css:83`,
  `app/platform-admin/early-access/[leadId]/lead.module.css:24`. It also requires locking the **task's reductions**
  for the deleted old `components/admin/kit/club/Billing.module.css` and `KitDialog.module.css` baseline entries.
  No check/baseline was edited under this prompt's automation boundary. Copied eyebrow/readout declarations carry
  the gate's existing explicit role annotations and preserve their shipped appearance. Log:
  `plan-billing-part2-admin-type.log`. Those baseline reductions are a task-associated gate follow-up, distinct
  from the unrelated CSS findings.

**Dev-server hand-off:** verified the workspace supervisor/process ancestry before stopping only its tree.
Restarted with network-enabled **`npm run dev`**, reached Ready, and the required
`/platform-admin/login?next=%2Fplatform-admin` returned **HTTP 200**. Restart/request logs showed no Supabase
`EACCES`. The server is left running. No cache deletion. Logs: `plan-billing-part2-dev.out.log` and
`plan-billing-part2-dev.err.log` in the session temp directory. Browser/real Stripe verification stays with the owner.

### Part 2 review-fix hand-off — 2026-10-28

Executed `PLAN_AND_BILLING_STAGE1_PART2_FIXES_PROMPT.md` on `dev`. This fixes the shared Part 2 body; the existing
Club host consumes it. Other admin plans still cut over in Part 3, and the workspace-level coach host remains
Stage 2. Stage 1 completion requires those remaining steps and its verification/owner gates.

**Customer outcomes:** Club owners regain their growth/largest-band/free-team explanations. Cancelled paid owners
retain a recovery door when Founding status cannot load. Cancelled Premium owners regain the Basic tournament
records card; running/ending Premium free time regains its billing sentence. Founding holders returning from card
setup read the no-charge promise while their season is active; “Change plan or card” opens the existing Stripe
portal, matching the old page rather than submitting their same choice again. Non-owners keep the locked card,
without mounting billing reads. No capability or server authorization rule changes.

**Failed-read states (the read is an error, not “no grant”):**

| Known state / failed read | What the owner sees and can do |
|---|---|
| Free-time read fails, any stored status or plan, including stored-cancelled staff grants and ended Premium free time | Plan name, warning-tone “Billing status unavailable”, read error, Try again and Contact us; fees may remain below. No asserted price, renewal, cancellation, retention, Reactivate or Keep Premium. The unreadable grant cannot distinguish those states. |
| Free-time succeeds with no running grant/portal; cancelled paid org; Founding fails | Cancelled recovery card and retention facts. Reactivate checkout when its own paid plan is known on sale; otherwise Contact us to reactivate. Founding is unnecessary for this screen. |
| Free-time succeeds with no grant/portal; cancelled free Tournament; Founding or gating fails (or gating succeeds) | Cancelled recovery card with Contact us to reactivate, never a free-tier checkout. The old page explicitly excluded Tournament from self-serve reactivation. |
| Free-time succeeds with no grant/portal; cancelled Premium; Founding or gating fails | Reactivate Premium for the same workspace, Basic tournament records door, retention facts; Try again. |
| Free-time confirms an ended Premium grant; Founding or gating fails | Free-time-ended card/band, Keep Premium for the same workspace, outlined Join a club; Try again. No cancellation or retention claim. |
| Free-time confirms a running/ending staff grant, including stored-cancelled orgs; Founding fails | Known free-time plan/band and helper sentences remain; paid cancellation, payment and move controls remain absent. Try again appears for the failed read. |
| Gating fails with ordinary active billing | Contact us to move replaces availability-dependent actions; the Premium discovery door also falls back to Contact us. Supported downgrade does not depend on a sale gate. Try again appears. |
| Non-owner, any state | Owner-locked card; no billing reads or money controls. |

Try again refreshes org context and reruns the reads even if that context refresh rejects. A same-URL revision keeps
its previous result while the new request is pending; a changed URL/org cannot paint the old read, and owner bodies
remain keyed by org id. A failed response replaces the old result with an error. An open cancel review owns its
captured preflight data rather than depending on a refetch. A successful money action keeps its success notice if
the following context refresh fails; background reload rejections are caught.

**Return handling:** persisted `pageshow` resets busy/leaving and `justChose`, then refreshes. A next-season return
automatically rereads until a choice arrives, up to five 1.5-second retries; after that the chooser returns with an
error notice and working retry action rather than remaining hidden forever. Return flags still consume once and
preserve other parameters. Portal/card/checkout/next-season server return resolvers remain for their existing stages.

**Copy restored, none retired:** the existing `growingTeams`, `largestTeams` and `freeTeams` builders supply plan
names and limits from config/profiles. The portal billing line comes through `W.portalFreeTime`, including its
distinct running and ending sentences. The cancelled Premium card uses `W.reactivate.basicTitle/basicBody/basicDoor`
and the existing `/coaches/tournaments` destination. The card-return notice uses `W.notice.foundingCardSaved` only
after resolving an actual active holder. No requested Keep sentence is obsolete; D15–D19 removes other redundant
cancelled prose and does not retire these sentences. Holds uses a new vocabulary capacity formatter (“1 tournament
at a time”), retaining count/limit captions in actual usage meters.

**Files in this fix pass:** presentation in `components/billing/BillingBody.tsx` and `PlanMoveDialog.tsx`; vocabulary
in `lib/plan-billing-words.ts`; render regressions and corrected presence/order assertions in
`tests/unit/plan-billing-body.test.ts`; new executable action/lifecycle coverage in
`tests/unit/plan-billing-actions.test.ts`; this §9, the PM brief and the single TODO index line. `teamsHref` is now
required by the shared move dialog and body: both existing hosts already supply it, including the retained admin
shim, so the Rep teams refusal door cannot silently disappear. No hard-coded admin destination enters the neutral body.

The new tests drive the real owner/action/window functions with deterministic hooks and a stubbed fetch. Exact
endpoint, method, headers and body fields are checked for checkout/reactivation at two supplied host bases, portal,
card, scoped bodyless keep DELETE, cancellation, downgrade preflight/confirm, next-season choice, move preview and
up/down confirmation, and checkout fallback. They also check the actual change-choice portal button, active/inactive
Founding card returns, bfcache reset, delayed/missing webhook choice, retry stability, org URL isolation, review
stability, required Rep teams destination, and successful-action refresh failure. React static renders cover failed
reads and all restored sentences. This is unit coverage of real handlers, not a browser or Stripe walk.

**Verification and restart (current fix pass):**

- Focused ESLint on the five code/test files: **exit 0**. Focused action/render/profile/usage/words/source/free-time/
  cancelled-access/panel coverage: **142/142 passed**, **exit 0**. The new action file contributes 19 executable cases.
- Final `npm run typecheck`: **exit 0**. An earlier iteration caught an incomplete new test Organization fixture;
  required fields were supplied and the final check passed. Log: `%TEMP%/plan-billing-part2-fixes-typecheck.log`.
- Final `npm run verify:changed`: **exit 1**. **11,775/11,775 unit tests passed**, then focused ESLint over the shared
  working tree reported **3 errors / 9 warnings**. All three errors are the preserved unrelated
  `app/dev/crash-test/page.tsx`: **9:15** `react-hooks/purity` (`Date.now()` during render), **11:5** and **12:5**
  `react-hooks/globals` (module-level mutations). No task-file lint error/warning was reported. Log:
  `%TEMP%/plan-billing-part2-fixes-verify.log`. The package command stopped there: later token, lettering, spelling,
  CSS, export, root-file, database and other chained gates **did not run**. This pass does not recertify or repair the
  earlier hand-off's downstream findings/baseline reductions. No failed command is treated as passing.
- Explicit-path `git diff --check`: **exit 0**. TODO size: **57 KB, passed**. New task files also checked directly for
  trailing whitespace. No full layout sweep or generated-baseline rewrite.
- Restarted the verified workspace dev-server process tree with network-enabled **`npm run dev`**, waited for Ready,
  then verified **HTTP 200** at `/platform-admin/login?next=%2Fplatform-admin`; startup/request logs contain **no
  Supabase EACCES**. Server left running. No cache deletion. Logs: `%TEMP%/plan-billing-part2-fixes-dev.out.log` and
  `%TEMP%/plan-billing-part2-fixes-dev.err.log`. This health request is not browser-based product verification.

**Owed / untouched:** `/simplify` on this delta, `/review` of the fixed hunks, `/docs`, and the owner browser/390px/real
Stripe walk. Previous cleanup/review happened before this fix pass and is not a substitute for reviewing these hunks.
No browser test, layout sweep, live Stripe action, real bfcache trip or real webhook delay was walked. Usage-route
suspended access and owner-only versus delegable billing remain owner calls. Part 3 navigation/cutover/portal-return,
Stage 2 coach host, upgrade-cycle choice and mixed-state upgrade-door questions remain in their assigned stages.
No usage route/guard entry, re-export shim, gate/check script, hook, config, baseline, owner HTML, pricing, entitlement,
migration or production operation changed in this pass. No commit or push.

### Part 3 hand-off — 2026-10-28 build, validation continued 2026-10-29

Executed `PLAN_AND_BILLING_STAGE1_PART3_BUILD_PROMPT.md` on `dev`, against Parts 1–2 and the fix pass in
`bc0e52c60` (entry gate met). **Parts 1–3 are implemented; Stage 1 still awaits the owner walk and the Claude gates
below.** The owner authorized the Part 3 commit on 2026-10-29. Other sessions' working-tree changes were preserved.

**Owner decisions in this session (supersede the earlier owner-only wording):**

- **Delegate billing through the `billing` capability.** No role gains it by default. Only the owner can grant/revoke
  it in the existing Members → Manage window. A billing delegate can read the page and use its existing money actions
  (card, invoices, portal, upgrade, next-season choice, reactivate, usage, fees) **except cancel and downgrade, which
  are the owner's alone (ruling 2026-10-29; see "Part 3 fix pass" below)**;
  the page, upgrade drawer, rail/More row, usage, free-time billing mode and Stripe-fee reads use that same capability.
  Settings remain owner-only. The member list displays the grant and the existing access-change email names it.
  Existing member PATCH authorization still refuses a non-owner's capability changes, including another billing grant.
- **Keep suspended billing access** to the count-only usage route. Its explicit `orgSlug`, no-store response,
  membership/capability check, no-PII projection and no-program-access boundary remain. Cancellation does not strand
  an owner or granted billing member. Later stage prompts must follow these two decisions.

**Customer outcome by plan and role:**

| Plan | Existing admin billing home | Result for owners / billing delegates | Result without billing access |
|---|---|---|---|
| Tournament | tournament settings subscription | Shared body; no Organization eyebrow; upgrade-cycle choice | Locked card; no billing reads or actions |
| Tournament Plus | tournament settings subscription | Shared body; no Organization eyebrow; existing supported change mechanisms | Same locked card |
| Premium Coaches Portal workspace | organization billing, until Stage 2 | Shared body; no Organization eyebrow; Keep Premium / Founding / cancelled distinctions retained | Same locked card |
| League Plus | organization billing | Shared body, Organization header | Same locked card |
| Club | organization billing | Same shared body, Organization header | Same locked card |
| Club · Association | organization billing | Same shared body, Organization header | Same locked card |

Every billing user gets the desktop row in the rail foot immediately beside Help and the phone row in More → You.
Club/League Organization groups no longer contain billing. Tournament Settings & access retains its card. The
existing subscription page remains an alias of the same host. No Coaches Portal host or portal nav row was added.

**Files added:**

- `app/[orgSlug]/admin/tournaments/settings/subscription/mock-portal/page.tsx`: reuses the existing mock portal on
  the tournament-safe path; its old org-only path was behind the tier boundary.
- `tests/unit/plan-billing-admin-host.test.ts`: actual host rendering on both entry routes for all six profiles,
  actual body authorization before reads, Stripe/mock return request capture, card-session exits, Founding
  next-season return destinations and owner-only delegation/revocation with the real member PATCH handler.

**Files changed, grouped:**

- Admin host/navigation: `app/[orgSlug]/admin/org/billing/page.tsx`, its `mock-portal/MockPortalClient.tsx`,
  `app/[orgSlug]/admin/tournaments/settings/page.tsx`, `components/admin/kit/{AdminKitRail,AdminKitBottomNav,useAdminKitNav}.tsx`
  (`useAdminKitNav` is `.ts`), `components/admin/kit/club/{BillingKit,ClubHubKit}.tsx`, `lib/admin-kit-nav.ts`.
- Shared body/words/access: `components/billing/{BillingBody,PlanPanelDrawer}.tsx`, `Billing.module.css`,
  `lib/{plan-billing-data,plan-billing-words,member-access,roles}.ts`,
  `components/admin/kit/club/{ManageMemberDialog,MembersKit}.tsx`, `member-summary.ts`, and
  `app/api/admin/members/[memberId]/route.ts`. No role default or module entitlement changed.
- Existing return services/read routes: `lib/billing-setup.ts`, `app/api/billing/{portal,setup-payment-method,
  choose-next-season,mock-apply,usage,stripe-fees}/route.ts`, `app/api/admin/org/free-time/route.ts`.
  The mock apply request now names its org and checks the billing capability instead of falling back to a home org.
- Compatibility imports: `components/admin/kit/club/{KitDialog,PageNotice,PaymentsEndingSection,StripeFeesList}.tsx`.
  Retained because other shipped screens still import them; all exports are named, including types. The existing
  named-only `components/admin/FreeTimeBand.tsx` shim still serves the Basic team page and portal band, so it stays.
- Help: only affected navigation/section/cancel/return/fee instructions and their search text in
  `lib/help-content/org.tsx`, plus the role/delegation statements made false by the owner's new access ruling.
  The full help rewrite remains Stage 5.
- Regression guards: `tests/unit/{admin-kit-nav,nav-standard-guard,notification-open-in-place-guard,
  stripe-fees-owner-rulings,team-move-words,tournament-one-at-a-time,support-console-stage4b-coach-guard,
  plan-panel-host,plan-billing-source-guard,plan-billing-profile,plan-billing-body,plan-billing-actions,
  plan-billing-usage,plan-billing-words,member-access,member-summary,club-stage1-screens-guard,
  org-billing-access-guard,plan-reader-door-guard}.test.ts`, `lib/billing-urls.test.ts`, and
  `tests/uat/scenarios/{plan-gating,marketing-seam}.spec.ts`. The gated-availability and notification-reader
  regressions already target live/shared sources and pass without edits. The literal hash/legacy exception is
  removed with the old implementation; no replacement hash grandfathers copy.
- Tracking: this plan, its PM brief, `PLAN_AND_BILLING_CODEX_RULES.md` (new owner access ruling) and the single TODO line.

**Files deleted:** `app/[orgSlug]/admin/org/billing/billing.module.css`; `BillingPagePlans` was removed from the
retained thin `page.tsx`. The words/profile registry remains the only plan-fact/included-list source. The extra-plan
render test remains in force. No check script, hook, config, generated baseline, owner drawing, migration, price,
entitlement or production operation changed.

**Part 3d choices and reasons:**

1. **Monthly / Yearly:** reused the cancelled view's existing native select, labels and styles immediately above
   the Change plan table, shown only for an available checkout upgrade. It sets the existing checkout-cycle state;
   the current plan's displayed price reads its actual subscription period, so changing a prospective purchase does
   not misrepresent today's subscription. A real-handler test changes the select, presses Upgrade and asserts the
   exact annual checkout request, including for a delegated billing user. No control was added for a prorated move,
   which keeps its live subscription cycle.
2. **Staff free time with a free own plan:** preserved the ruled absence of payment/move/cancel/purchase controls,
   including the underlying free plan's Upgrade. The rules and drawing hide those controls during a grant; the old
   page's upgrade exception would widen that ruling. A rendered regression pins this mixed state. Free-time contact
   and the coach's distinct Keep Premium invitation stay available as already built.
3. **Founding / browser cache:** the committed fix pass already routes Change plan or card through the payment portal
   and resets busy/leaving/`justChose` on persisted `pageshow`; those real-handler regressions remain passing. No
   duplicate lifecycle code was added.
4. **Undrawn doors:** no Tournaments you run / Tournament helpers or new plan-details placement was invented. Existing
   `?plan=` validation and details support remain; the placement drawing stays owed before Stage 3.

**Returns and guard preservation:** portal and mock portal, real/mock card-save, and real/mock next-season returns
use the existing `getBillingHref(slug, planId)`. Return URLs follow the effective tier used by the layout; purchase
eligibility, selected plan and price still use the own plan. The billing-action guard permits exactly the single
destination resolver expression in choose-next-season and continues rejecting effective-plan reads everywhere else
in its action logic. Tests exercise a different own/effective plan to pin that distinction. No resolver rewrite or
Coaches Portal return target was introduced. Existing checkout/reactivation/move fallback still receive the host's
billing base; move and downgrade remain separate server mechanisms.

**State / flow checklist — what was actually checked:**

| Area | Automated/source evidence | Owner/live check still owed |
|---|---|---|
| Six plans × owner / non-owner | Actual host/body render tests, shared body fixtures; denied users mount no reads | Sign in and open each real workspace |
| Explicit billing delegation | Real member PATCH grant/revoke; non-owner grant refusal; no settings grant; usage/free-time read checks; real upgrade action | Grant, sign in as delegate, revoke, confirm all doors close |
| Rail foot / More → You | Shared nav-data capability matrix, order/icon/position guards; focused layout at 361 and 1440 | Open More, folded sidebar and keyboard/focus interactions on each plan |
| Free time | Running / ending / ended org and Premium render tests; mixed own-free upgrade exclusion | Actual timed grant transitions |
| Founding | Card/no-card/choice renders; real portal action, bfcache reset and delayed-choice handler tests | Real saved card, real Back/forward cache and webhook timing |
| Cancelled / past due / trial | All-profile locked-card fixtures; cancelled recovery, failed reads, retention, trial-end and past-due renders | Live cancellation/reactivation and declined-payment journey |
| Portal / card / next-season returns | Executed route/service handlers with captured Stripe parameters and mock responses | Real Stripe redirects and persisted card/choice |
| Checkout / plan move / downgrade | Existing real-handler request tests with exact fields and host return; source guard retains own-plan action rule | Real payment, preview/proration and scheduled move |
| Empty / loading / errors | No-card, absent-fees, unavailable reads, retry stability and API/action-error regressions | Visual and interactive error recovery |

The focused layout check is automation, not a claimed owner/browser/Stripe walk. No in-app invoice list was added;
invoices stay in the existing secure portal. No whole-product sweep ran.

**Owed:** Claude `/simplify` on this delta, `/review`, `/docs`, and the owner walk written by a Claude session.
The owner also controls the earlier generated-baseline reductions. Stage 2 adds the workspace-level coach host and
must honour delegated billing; Stage 3 retires that audience's admin billing view and places the undrawn workspace
links. Do not call Stage 1 complete before those Stage 1 review/walk gates are satisfied.

**Final validation record (2026-10-29):**

- **Start-of-part gate:** `npm run verify:changed` ran **11,775/11,775 passing unit tests**, then exited **1**
  at shared-tree ESLint: **3 errors / 9 warnings**. The errors were `app/dev/crash-test/page.tsx` **9:15**
  (`react-hooks/purity`, `Date.now()` during render), **11:5** and **12:5** (`react-hooks/globals`, module-level
  mutations). Its later chained checks did not run. Log: `%TEMP%/plan-billing-part3-start-verify.log`.
- **Focused:** task-file ESLint **exit 0**, **0 errors / 4 existing warnings**. The warned expressions are unchanged:
  member PATCH **475:60** (`no-explicit-any`), Stripe-fee projection **31:75** (`_hidden` unused),
  ManageMemberDialog **157:5** and MembersKit **129:10** (`set-state-in-effect`). The focused regression suite passed
  **656/656**, then the return/own-plan guard run passed **97/97**. The final full suite below includes the subsequent
  mixed own/effective-plan cases. Logs: `%TEMP%/plan-billing-part3-{lint,focused,returns}.log`.
- **Type-aware:** final `npm run typecheck` **exit 0**, using a process-local
  `NODE_OPTIONS=--max-old-space-size=6144`; no package/config change. The first attempt exhausted Node's default
  heap (**exit 134**) before diagnostics. After stopping the verified dev-server tree to release its memory, the
  bounded retry and final check passed. Final log: `%TEMP%/plan-billing-part3-final-typecheck.log`.
- **Full unit suite:** final `npm test` **12,021/12,021 passed**, **exit 0**. The earlier full run caught the
  own-plan source guard interpreting the destination resolver as a purchase decision; its exact one-expression
  routing allowance and executed mixed-plan coverage are described above. No purchase-rule assertion was removed.
  Log: `%TEMP%/plan-billing-part3-unit.log`.
- **Final full gate:** `npm run verify:changed` **exit 1** after **12,021/12,021 unit tests passed**, then
  **3 ESLint errors / 13 warnings**. The same three crash-test errors above are the only errors. Four extra warnings
  are the pre-existing expressions in task-touched files listed above, which the changed-file gate now includes.
  Later chained gates **did not run**: this is not a green full gate or a database/release certification.
  Log: `%TEMP%/plan-billing-part3-verify.log`.
- **Separate unchanged local checks:** token coverage/ratchets, spelling consistency and CSS Module purity **exit 0**.
  TODO size **57 KB, exit 0**. No shared check script was edited.
- **Separate CSS selector check, exit 1:** same four unrelated orphan references:
  `app/platform-admin/early-access/[leadId]/LeadRecord.tsx:31`,
  `app/platform-admin/feedback/[id]/FeedbackRecord.tsx:24`,
  `app/platform-admin/feedback/[id]/ReplyWindow.tsx:25` (each `record.module`), and
  `app/platform-admin/orgs/[id]/MoneyTab.tsx:180` (`money.compare`). Same ten unrelated dead classes:
  `addressFact/addressText` in admin public-site CSS; `formInput/formTextarea` in tournament schedule CSS;
  `statItem` in coaches CSS; `eventList/eventStrong/eventSummary` in platform observability CSS;
  `sourceList/sourceListTitle` in platform overview CSS. Log: `%TEMP%/plan-billing-part3-css-selectors.log`.
- **Separate admin lettering check, exit 1:** `components/admin/kit/club/PayoutsCard.module.css:27` (face),
  `components/shared/SystemScreen.module.css:83` (tracking),
  `app/platform-admin/early-access/[leadId]/lead.module.css:24` (face), and the earlier extraction's baseline reductions
  for deleted Club `Billing.module.css` (heavy 1 → none) and `KitDialog.module.css` (face/caps 1 → none).
  The latter are task-associated owner-controlled baseline follow-ups, not unrelated debt.
  Log: `%TEMP%/plan-billing-part3-admin-type.log`.
- **Separate old-look check, exit 1:** unrelated
  `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css`, `kitScope` **100 → 102** above baseline.
  Log: `%TEMP%/plan-billing-part3-old-look.log`. This stylesheet was not edited by Part 3.
- **Required focused layout:** `npm run check:layout -- --changed
  --only=admin-org-billing,admin-t-settings-subscription-panel --workers=1` **exit 0**, both screens at **361 / 1440**,
  **no new findings**. The first run identified the phone table header's clipped row overflow; the local CSS fix
  keeps that header clipped without overflowing its box. Six baseline findings no longer reproduce; no baseline was
  rewritten or pruned. This is a two-screen check, not a whole-product sweep or a 390px owner walk.
  Log: `%TEMP%/plan-billing-part3-layout.log`.

**Dev-server hand-off:** inspected process commands/ancestry and stopped only the verified workspace supervisor's
tree. Restarted with network-enabled **`npm run dev`**, reached **Ready**, then the required
`http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returned **HTTP 200**. Startup/request logs contain
**no EACCES**. The server is left running. No `.next` deletion. Logs:
`%TEMP%/plan-billing-part3-dev.out.log` and `plan-billing-part3-dev.err.log`. Real browser/payment verification remains
with the owner as listed in the checklist.

### Part 3 fix pass — 2026-10-29 (after `/simplify` + `/review`; nothing committed yet)

Owner ruling 2026-10-29: **cancel and downgrade are the owner's alone.** A member granted `billing` keeps every other
billing action. The four routes (`cancel/{preflight,confirm}`, `downgrade/{preflight,confirm}`) were NOT changed: they
still check `role !== 'owner'`. The page now never offers a delegate a door the server refuses.

- **Delegate on an active org:** no cancel-record read, no "Reduce or cancel" section, no Downgrade row (the Tournament
  Plus → Tournament row is not listed at all), and no banner or Try again button caused by that read.
- **Delegate on a cancelled org:** the reactivate card works (checkout is capability-gated). Chosen: the chip reads the
  plain status ("Cancelled") with no date, and the "Kept until" line is left out, because both come from the
  owner-only record. No error, no empty chip.
- **Demo sandboxes:** the billing row is gone from the rail foot and the More sheet (`kitBillingLink` takes the sandbox
  flag; `lib/sandbox-curation.ts` already said billing entry points are hidden there).
- **Tournament / Tournament Plus customers:** every emailed or notified billing link now goes through `getBillingHref`
  (payment-failed notice, trial-ending, cancel and downgrade confirmations, retention warnings, the payments-ending
  warning, the platform-admin cancel email), so they reach the subscription page instead of being bounced to the
  dashboard. The two confirm routes read `ownPlanOf(org)` (plan-reader-door-guard bans the door's planId in billing
  actions); the rest read the stored plan. The retention cron's org select now includes `plan_id`.
  **Found, not fixed:** `app/api/admin/email/send/route.ts:257` puts the org's UUID where its slug goes (pre-existing).
- **`?plan=` deep link:** the details panel now lives in the shared body view and offers Upgrade exactly where the
  Change plan table does (a checkout change, on sale, ordinary billing view — not staff free time, not cancelled), in
  the chosen cycle, through the same checkout path. Billing delegates may upgrade.
- **Small:** the Change plan cell renders nothing until its reads are in (no "Contact us to move" flash); the reactivate
  cycle choice disables while a request runs; Try again shows "Trying again…" and disables while the context refresh
  runs (the sub-reads that follow are not covered).

**Reported, not changed (owner decides):**
1. *Lower-band move for a delegate.* The shared body offers a delegate the one lower move that exists — **Club ·
   Association → Club**, mechanism `move`, direction `down` — and the capability-gated `move` route can schedule it (it
   takes effect at renewal; the delegate can also keep the current plan). It is a reduction by another door.
2. *Stripe portal.* A delegate can open the Stripe payment portal (capability-gated). The code creates the portal
   session with no configuration, so whether the portal shows a Cancel subscription button is a Stripe Dashboard
   setting that cannot be read from this repo. If it is on, a delegate can cancel there; the `customer.subscription.deleted`
   webhook then runs the normal cancellation path.
3. Delegates get no payment-failed alerts (the webhook notifies owners only); a members manager can remove a grantee;
   a delegate's email becomes the Stripe customer email on first checkout; two rail rows highlight at once on the
   tournament tiers.
