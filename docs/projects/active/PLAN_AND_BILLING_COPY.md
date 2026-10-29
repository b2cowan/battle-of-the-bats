# Plan & billing — copy inventory and proposal

**Part 0 accepted; decision cards ruled; Parts 1–2 implemented 2026-10-28 · verification in plan §9.**

This is the approval document required by `PLAN_AND_BILLING_STAGE1_BUILD_PROMPT.md`, Part 0. It records today's
words and the shared wording before implementation. The historical comparison and subsequent owner rulings are distinguished below. Read alongside
`PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md` §9 and `PLAN_AND_BILLING_STAGE1_IMPACT_INVENTORY.md`.

**Approval log — 2026-10-28:** owner accepted Part 0; approved the org ending invitation “To keep {given}, contact us.”
with a working contact door and unchanged running/portal copy; approved paired billing/article variants and guards for
pair completeness and unchanged existing article features; approved the rest of the proposal subject to trial
verification and the visible plan-details door. Drawing/copy differences in §12 are reported for explicit decisions,
not silently resolved by that initial blanket approval. The later decisions are recorded in plan §9 and govern the
implementation. Trial evidence is in §13; the free-time impact census is in §14. The owner ruled the visible details
door under each target plan's name on desktop/phone; its small drawing session is owed before Stage 3.
The token-check script stays untouched. **Part 1 was authorised by “build part 1”.**

**Current implementation record — 2026-10-28:** the owner subsequently ruled all decision cards (binding table in
the plan §9) and authorised Part 1. The comparison in §12 remains the historical audit, not a current list of open
questions. The registry implements the seven-item Premium billing variant and preserves the eight-item published
article; other published article hashes are also unchanged. The new words follow Holds, yearly comp helper,
product-specific cancel actions and the ruled downgrade wording. The public Club trial helper remains assigned to
its own `/marketing` step. Old screens retain their existing behavior pending Parts 2–3; no unresolved recommendation
is inferred from a build instruction. Implementation and verification results are in plan §9.

## How to read the tables

- **Club** means `components/admin/kit/club/BillingKit.tsx` (read end to end).
- **Other** means `BillingPagePlans` in `app/[orgSlug]/admin/org/billing/page.tsx` (read end to end). Its
  Club constants are inventoried even though the top-level switch currently sends Club owners to the kit.
- A dash means that implementation does not speak the concept. Repeated strings are listed once per concept.
  Fragments that are joined in JSX are written as the sentence the customer reads. Singular/plural forms use
  `{count: noun/nouns}` to avoid pretending the source has only one form.
- `{plan}`, `{target}`, `{own}`, plan prices, capacities, trial lengths and dates are runtime values, not new facts
  written into this document. Names/prices/limits come from `lib/plan-config.ts` and the canonical
  `docs/agents/strategy/PLAN_PRICING_FACTS.md`. `{org's}` means `possessive(orgName)`; dates use the relevant stored-date
  or existing free-time date helper; `{card}` uses `formatCardOnFile()`.
- **Keep shared** means use the named existing copy builder; do not copy its strings into a second words module.
- **Remove** retires a duplicate sentence/control, not its underlying capability. The shared body still preserves
  the plan drawer, real upgrade/downgrade/move actions, Keep Premium, Join a club, and the tournament cross-sell doors.

## 1. Title, sections, status, access and loading

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Document title | Plan & billing | Plan & billing | Plan & billing |
| Visible title | Plan & billing | Plan & billing / Coaches Portal billing | Plan & billing |
| Eyebrow | Organization | Organization, including coach/tournament workspaces | Organization only where an organization exists; omit for Tournament, Tournament Plus and coach workspaces. |
| Plan band | Your plan | `{plan} Plan` | Your plan; name from profile, without added “Plan”. |
| Usage section | Teams on your plan | Separate usage cards | What's in use |
| Change section | Club’s two sizes | Get more from your tournaments / downgrade under Reduce or cancel plan | Change plan |
| Included section | What Club includes | Feature lists on reactivation/plan drawers | What's included |
| Cancel section | Reduce or cancel | Reduce or cancel plan / Cancel Premium access | Reduce or cancel |
| Paid billing section | — | Billing tools | Remove separate heading; payment door stays in Your plan. |
| Free/comp billing section | — | Billing | Keep the applicable billing-state sentence in Your plan/band. |
| Status chips | Active / Trial / Past due / Cancelled | Same via `subscriptionStatusLabel()` | Keep shared: `subscriptionStatusLabel()`. |
| Non-owner title | Plan & billing is the owner’s | — | Plan & billing is the owner’s |
| Non-owner explanation | Only `{org's}` owner can see and change the plan and how it’s paid. | Only organization owners can manage payment methods, invoices, billing details, and downgrade or cancel the plan. | Only `{org's}` owner can see and change the plan and how it’s paid. One locked card for all plans, including cancelled and free-time states. |
| Screen loading | Loading plan & billing… | Loading plan & billing… | Loading plan & billing… (one `LoadingState`). |
| Usage loading | Loading… | Usage omitted or context count before read | Loading… inside the count only; never imply zero before a successful read. |

Section order is the ruled order: **Your plan → What's in use → applicable free-time/Founding band → Stripe fees →
Change plan → What's included → Reduce or cancel**. The quiet tournament cross-sell ends the page. Zero fees means no
fees section; non-owner means the locked card only. Inapplicable controls are absent.

## 2. Price, renewal, trial, payment door and scheduled moves

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Monthly price | `{price} CAD / month` | Same | `{price} CAD / month` |
| Yearly price | `{price} CAD / year` | Same | `{price} CAD / year` |
| Free price | — | Free / Free forever | Free |
| Billing cycle | `· billed yearly` / `· billed monthly` | Billed annually / Billed monthly | `· billed yearly` / `· billed monthly` |
| Cycle choice | Monthly / Yearly; reactivation: `Monthly · {price}`, `Yearly · {price}` | Monthly / Annual; chooser: annual / monthly | Monthly / Yearly; price beside each choice when shown. Stored value stays `annual`. |
| Select accessible name | Billing | — | Billing |
| Renewal | Renews `{date}` | Renews `{date}` | Renews `{date}` |
| Trial end | Trial ends `{date}` | Trial ends `{date}` | Trial ends `{date}` |
| Portal button | Payment method & invoices | Payment method & invoices | Payment method & invoices |
| Portal helper | — | Open the secure billing portal for payment methods, invoices, and billing details. | Keep if a helper is needed by the drawing; same sentence. |
| Portal busy | Opening… | Redirecting… | Opening payment portal… |
| Scheduled move | Moves to `{target}` on `{date}` / at renewal. | — | Moves to `{target}` on `{date}` / at renewal. |
| Scheduled row badge | From `{date}` / From renewal | — | From `{date}` / From renewal |
| Keep current plan | Keep `{plan}` | — | Keep `{plan}` |
| Keep success | `{org}` stays on `{plan}`. | — | `{org}` stays on `{plan}`. |
| Shelf starting price | — | from `{price}` CAD / month | From `{price}` CAD / month; prices remain derived. |
| Annual saving | — | `formatAnnualSavings(plan)` | Keep shared: `formatAnnualSavings(plan)`. |
| Trial note | — | Early-access trial details collected in Stripe / `{days}`-day trial · Payment details collected in Stripe | Verified conditional wording: `{days}`-day trial — you add a payment method at checkout, and you're first charged when the trial ends. Use only with confirmed effective checkout eligibility/duration; otherwise “Payment details collected in Stripe”. The existing Club `clubTrialLine()` says “card”; its difference from the unrestricted checkout methods is for owner review (§13), not silently rewritten. No zero-day or paid-move trial promise. |
| Past-due notice | Your last payment didn’t go through. Everything stays open during the grace period — update your card in Payment method & invoices to keep it that way. | Your last payment failed. Your access remains active during the grace period — please update your payment method via Payment method & invoices below to avoid service interruption. | Your last payment didn’t go through. Everything stays open during the grace period — update your card in Payment method & invoices to keep it that way. Keep the portal link actionable. |

## 3. Staff free time — preserve the existing sources

These strings are supplied to both pages by `lib/free-time-copy.ts` and to the coach workspace by
`lib/portal-free-time.ts`. They stay there. The matrix records all customer-visible branches rather than introducing
another copy of those builders. No giver identity, internal reason, grant metadata or unused-day credit is exposed.

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Price | Free through `{through}` | Same | Keep shared. |
| Org source/fallback | from FieldLogicHQ · then the free Tournament plan / `{own}` again, automatically | Same | Keep shared; names resolved by the existing helper. |
| Portal source/fallback | — | from FieldLogicHQ · then the free Coaches Portal, automatically | Keep shared. |
| Running eyebrow | Free time | Same | Keep shared. |
| Org running title | `{given}` is free through `{through}`. | Same | Keep shared. |
| Org running body | FieldLogicHQ gave your organization `{given}` for a while. On `{after}` it goes back to `{own}` automatically`{founding suffix}`. Nothing is charged, and nothing you made is deleted. / Nothing is charged for this, and nothing you made is deleted. | Same | Keep shared. |
| Founding suffix | , still free through `{foundingThrough}` as a founding organization | Same | Keep shared, only while that comp is still running. |
| Running phone body | On `{after}` it goes back to `{own}` automatically`{founding suffix}`. Nothing is charged or deleted. | Same for orgs; portal uses its own rest-of-body | Keep shared. |
| Running billing line | Not rendered by Club | No billing action needed: your free time runs through `{through}`. | Keep shared where applicable. |
| Ending eyebrow | Free time · `{days: day/days}` left / Free time · last day | Same | Keep shared. |
| Ending title | Your free time runs through `{through}`. / Your free time ends today. | Same | Keep shared. |
| Org ending body | On `{after}` you go back to `{own}` automatically`{founding suffix}`. To keep `{given}`, choose it below. | Same | **Correct in the existing builder:** “On `{after}` you go back to `{own}` automatically`{founding suffix}`.” Append “To keep `{given}`, contact us.” while moves are absent during free time; do not point at a nonexistent choice. Contact us must be a working door. |
| Closed-plan ending suffix | `{given}` isn't open for sign-up yet, so there is nothing to choose on this page. | Same | Keep shared. |
| Over-limit suffix | Your tournaments are kept; you can start a new one once you're back within `{own}`. | Same | Keep shared; uses the existing over-limit fact. |
| Ending billing line, on sale | Not rendered by Club | Your free time runs through `{through}`. To keep `{given}`, choose it below. Otherwise there is nothing to do. | Match the contact door above in the existing builder; never promise a hidden chooser. |
| Ending billing line, closed | Not rendered by Club | Your free time runs through `{through}`. There is nothing to do: on `{after}` you go back to `{own}`. | Keep shared. |
| Ended eyebrow | Free time ended | Same | Keep shared. |
| Org ended title | Your free time on `{given}` ran through `{through}`. | Same | Keep shared. |
| Org ended body | You're on the free Tournament plan again. / You're back on `{own}``{founding suffix}`. Everything you made is kept, including teams you added. The tools that come only with `{given}` are closed until you choose it. / … are closed. `{given}` isn't open for sign-up yet. | Same | Keep shared; “including teams you added” only for a Club grant. Ended state may show the ordinary supported plan actions again. |
| Team-count helper | Teams you add while `{given}` is free are kept after it ends. | — | Keep, parameterised; no paid-subscription controls during free time. |
| Portal running title | — | Premium Coaches Portal is free through `{through}`. | Keep shared. |
| Portal running body | — | FieldLogicHQ gave you Premium for a while. On `{after}` you go back to the free Coaches Portal automatically. Nothing is charged, and nothing you made is deleted. Everything you made on Premium is saved, and it comes back if you choose Premium again. | Keep shared, including the existing phone version without the first sentence. |
| Portal ending body | — | On `{after}` you go back to the free Coaches Portal automatically, and everything you made on Premium is saved. To keep Premium, choose it below. | Keep shared: Keep Premium is actually present. |
| Portal ending billing line | — | Your free time runs through `{through}`. To keep Premium, choose it below. Otherwise there is nothing to do. | Keep shared. |
| Portal ended title | — | Your Premium free time ran through `{through}`. | Keep shared. |
| Portal ended body | — | You're back on the free Coaches Portal, with your team as it was when your free time started. Everything you made on Premium is saved, and it comes back if you choose Premium again. | Keep shared. This is not a cancellation and starts no retention clock. |
| Keep Premium title/action | — | Keep Premium | Keep shared. |
| Keep Premium helper | — | Next you choose how to pay. Your team and everything you made stay as they are. | Keep shared: `KEEP_PREMIUM_LINE`. |
| Hosting exclusion | — | Hosting a tournament isn't part of free time. | Keep shared: `PORTAL_FREE_TIME_HOSTING_LINE`; no tournament-slot meter during portal free time. |

The contact-door wording is **owner-approved 2026-10-28** and introduces no new self-serve purchase path. It reconciles
“absent payment/move/cancel during free time” with the existing “choose it below” promise. The existing closed-plan
branch already says there is nothing to choose and is not the branch containing that broken instruction.
Both live-plan ending strings (band and billing line) must change together; the running copy and the portal's Keep
Premium path stay unchanged. Before that future runtime edit, use the complete reader/test census in §14.

## 4. Founding Season, card on file and next-season choice

All of this is absent on the Club profiles. Existing comp holders keep their promises; this is not a reopened offer.
Dates and years below are the existing `FOUNDING_SEASON_*` constants, never fresh literals.

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Comp price | — | Free through `{end}` | Keep. |
| Comp price helper | — | normally `{price}`/month · in `{decisionMonth}` you'll choose a plan for `{nextYear}` | Normally `{price}`/month · in `{decisionMonth}` you'll choose a plan for `{nextYear}`. |
| Band eyebrow | — | Founding Season / Founding Season · ends `{end}` | Keep. |
| Before-window headline | — | `{plan}` is free through `{end}`. | Keep. |
| Before-window body | — | You're running `{plan}` free through `{end}` as a founding coach / organization — normally `{price}`/month. No credit card. In `{decisionMonth}` you'll choose a plan for your `{nextYear}` season. | Keep, parameterised by profile/audience. |
| Window headline | — | Your Founding Season ends `{end}`. | Keep. |
| Window body | — | Choose a plan for your `{nextYear}` season below. Nothing is charged before `{firstCharge}`, and you can change your mind until then. | Keep only while the chooser is available. Once a choice is recorded, use its confirmation rather than a second instruction to choose. |
| Chooser heading | — | Choose your `{nextYear}` plan | Keep. |
| Chooser intro, org | — | You’re on `{plan}` today. Keep it for `{nextYear}`, or move to the free `{freePlan}` plan when the season ends. | Keep. |
| Chooser intro, coach | — | You’re on `{plan}` today. Keep it for `{nextYear}`, or let it end on `{end}` and keep your free Basic team records. | Keep. |
| Radio label | — | `{plan}` · annual / monthly | `{plan}` · yearly / monthly |
| Price units | — | / year / / month | Keep. |
| Guarantee | — | First charge `{firstCharge}` · nothing before then | Keep. |
| Choice button | — | Choose `{plan}` · annual / monthly | Choose `{plan}` · yearly / monthly; annual remains the initial selection. |
| Save-card lead | — | Prefer to decide later? | Keep. |
| Save-only action | — | Save a card without choosing | Keep. |
| Chosen eyebrow | — | Your `{nextYear}` season is set | Keep. |
| Chosen heading | — | `{plan}`, billed annually / monthly from `{firstCharge}`. | `{plan}`, billed yearly / monthly from `{firstCharge}`. |
| Chosen amount | — | `{price}` will be charged to `{card}` on `{firstCharge}` — your first charge, and nothing before it. Your Founding Season runs free until then. | Keep; omit the card clause when unknown, never invent an amount or use zero when the plan key cannot be resolved. |
| Unknown chosen amount fallback | — | Your plan will be charged… | “Your next-season choice is recorded. We couldn’t load its price. Try again.” Persistent error; do not assert a price until resolved. |
| Change-choice line | — | You can change this until `{end}`. | Keep. |
| Change-choice action | — | Change plan or card | Keep. |
| No-choice heading | — | If you choose nothing | Keep. |
| No-choice, coach | — | Your Premium portal ends on `{end}`. Your team's Basic tournament records stay available, and your season's work is kept. | Keep; no promise of an unbuilt read-only season. |
| No-choice, org | — | Your organization moves to the free `{freePlan}` plan on `{firstCharge}`. Your tournaments and records stay. | Keep. |
| Before-window billing | — | No billing action needed — your Founding Season runs free through `{end}`. We'll remind you during the summer when it's time to choose a plan for `{nextYear}`. | Keep. |
| Card present | — | `{card}` is on file. Nothing is charged before `{firstCharge}`. | Keep. |
| No card | — | No payment method on file yet. Nothing is charged before `{firstCharge}`. | Keep. |
| Card actions | — | Update payment method / Add payment method | Keep; summer-window and owner conditions preserved. |
| Held-offer trial note | — | No credit card — nothing is charged before `{firstCharge}` | Keep only for an eligible held comp; not a new offer after signup close. |

## 5. Usage and change-plan table

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Team meter label | Teams on your plan | — | Teams |
| Team count/accessibility | `{count}` of `{limit}` teams / of unlimited teams | — | `{count}` of `{limit}` teams / of unlimited teams |
| Tournament label | — | Tournament slots in use | Tournament slots |
| Staff label | — | Staff seats | Staff seats |
| Staff exemption | — | · `{count: scorekeeper/scorekeepers}` free | · `{count: scorekeeper/scorekeepers}` free |
| Uncapped value | unlimited | Unlimited | Unlimited (lowercase inside a sentence). |
| Custom team limit | Your plan holds up to `{limit}` teams, a custom limit for `{org}`. Archived teams don’t count. | — | Keep. |
| Team cap reached | `{org}` holds `{limit}` teams on `{plan}`, its limit. Move to `{target}` to add more. | — | Keep move sentence only when a supported on-sale move can actually open; otherwise “Contact us to add more.” |
| Team-cap growth | `{plan}` holds up to `{limit}` teams. Archived teams don’t count. Growing past `{limit}`? `{target}` holds `{targetLimit}`. | — | Keep, derived from profiles/config. |
| Largest-band helper | `{plan}` holds up to `{limit}` teams. Archived teams don’t count. More than `{limit}`? Contact us for a custom plan. | — | Keep. |
| Change headings | Plan / Teams / Monthly / Yearly / Your choice (screen reader) | — | Plan / Teams (where relevant) / Monthly / Yearly / Your choice |
| Band range | Up to `{limit}` / `{lowerLimit}` to `{limit}` | — | Keep; derived from config, no fresh band numbers. |
| Current row | Your plan | — | Your plan |
| Scheduled row | From `{date}` / renewal | — | Keep. |
| Move action | Move to `{target}` | — | Move to `{target}` |
| Unavailable move | Contact us to move | Disabled “Coming soon” / “Not open yet” upgrade | Contact us to move (including Plus → Club until the live gate opens). No disabled purchase control. |
| Upgrade | — | Upgrade to `{target}` | Upgrade to `{target}`; only `upgradePlansFor()`'s supported choices. |
| Downgrade | — | Downgrade to `{target}` | Downgrade to `{target}`; keep the separate downgrade preflight/API. |
| Large-club helper | More than `{largestLimit}` teams? Contact us for a custom plan. | — | Keep; Club profiles only. |
| Gated tag | — | `gatedPlanTag(plan)` | Keep shared and live-gate-driven. |
| Gated note | — | `gatedPlanNote(plan)` | Keep shared; no new “early access” copy. |
| Drawer door | — | See what `{plan}` includes | See what `{plan}` includes |
| Main upsell heading | — | Get more from your tournaments | Replaced by Change plan. |
| Main upsell intro | — | Tournament Plus adds registration control, custom branding, exports, and scheduling automation — everything you need to run repeat events without the spreadsheet. | Remove duplicate sales paragraph from the table; drawer retains its own approved explanation. |
| Club-link heading | — | Part of a club? | Part of a club? (the coach's Change plan slot, ruling 8). |
| Club-link body | — | If your club runs on FieldLogicHQ, it can bring your team in. Everything the team built comes with it, and you won’t be charged for your own Coaches Portal again. | Keep; move team data through the existing link flow. |
| Club-link action | — | Join a club | Join a club |
| Last-section heading | — | Managing more than tournaments? | Keep, tournament profiles only, as a quiet final section. |
| Last-section intro, team shelf present | — | If you also manage a team, a league program, or a full club outside your tournament, these are the next FieldLogicHQ workspaces to watch. | Keep if shown by the approved drawing. |
| Last-section intro, no team shelf | — | For organizations running more than tournament weekends, these plans bring year-round programs, teams, and finances into the same operating system. | Keep if shown by the approved drawing. |
| Shelf audience labels | — | For rep teams / For league programs / For full clubs | Keep only if present in the approved quiet section; no new headings invented. |
| Start separate portal | — | Start your Coaches Portal | Keep; this starts its own workspace, never changes this org's plan. |
| Unused shelf labels | — | Preview Coaches Portal / Preview League Plus / Preview Club in `detailLabel` (not rendered) | Remove unused constants with the old screen; not customer-facing today. |

## 6. Reduce/cancel section, window and result

`{days}` comes from the profile resolved against server preflight: **365 for a Premium workspace, 90 for an
organization** (ruling 9). A cancelled portal's free-time-ended state is different and has no cancellation clock.
`{offline}` comes from the one cancellation preflight source, not screen-authored lists. The known stale accounting
sentence in that source must be corrected as copy only (see §11).

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Org section body | Cancelling suspends `{org}`: `{offline}` go offline. Everything is kept for `{days}` days and comes back if you reactivate. | Downgrades and cancellations run through a short review first so tournament data and retention choices are clear. | Cancelling suspends `{org}`: `{offline}` go offline. Your data is kept for `{days}` days. Reactivate within that time to restore the tools and records your plan allows. |
| Coach section body | — | Cancellation turns off Premium tools and keeps Basic tournament records available. Premium team data is retained for the restore window. | Cancelling turns off Premium tools. Basic tournament records stay available. Premium team data is kept for `{days}` days and comes back if you reactivate within that time. |
| Org cancel door | Cancel and suspend `{org}`… | Cancel and suspend account | Cancel and suspend `{org}`… |
| Coach cancel door | — | Cancel Premium | Cancel Premium… (ruling 10). |
| Org window title | Cancel and suspend `{org}`? | Cancel account | Cancel and suspend `{org}`? |
| Coach window title | — | Cancel Premium Coaches Portal | Cancel Premium? |
| Org warning | `{org}` is suspended the moment you confirm: `{offline}` go offline, and families opening your pages will see that they aren’t available. | Cancellation suspends the full account. Public pages and modules shut down, and data is retained for `{days}` days. | `{org}` is suspended the moment you confirm: `{offline}` go offline, and families opening your pages will see that they aren’t available. |
| Coach warning | — | Premium tools will become inactive and premium team data is retained for `{days}` days. Basic tournament records stay available in Coaches Portal. | Premium tools stop when you confirm. Premium team data is kept for `{days}` days. Basic tournament records stay available in Coaches Portal. |
| Kept body | Everything is kept for `{days}` days. `{count: tournament/tournaments}` move into the archive until then. Reactivating brings it all back: the public site, every team’s coach portal and your tournaments. | Archived during retention / Premium data retained | Your data is kept for `{days}` days. Reactivate within that time to restore the tools and records your plan allows. Append applicable archive count and profile-specific restore list; over-cap tournaments stay retained, and no team-portal promise is shown on a tournament-only plan. |
| Org archive description | `{count: tournament/tournaments}` move into the archive until then. | `{count: tournament/tournaments}` will move into archive retention. / No active tournament records need to be archived. | `{count: tournament/tournaments}` move into the archive until then. / No tournament records need to be archived. |
| Coach retained description | — | Roster, documents, accounting setup, schedule data, and local Premium tournament data stay restorable during the retention window. | Roster, documents, team budget, schedule data, and local Premium tournament data stay restorable for `{days}` days. |
| Impact heading | — | Access suspended / Premium tools inactive | What goes offline / Premium tools inactive (appropriate profile). |
| Org impact intro | — | Based on your current plan, these areas will be unavailable while the account is cancelled. | These areas are unavailable while `{org}` is cancelled. |
| Coach impact intro | — | Basic tournament records remain available, but these Premium areas stop being active. | Basic tournament records stay available. These Premium tools stop when you confirm. |
| Cancel reason label | Why are you cancelling? | Placeholder: Optional cancellation reason | Why are you cancelling? |
| Reason helper | For your records and ours. You can leave it empty. | — | For your records and ours. You can leave it empty. |
| Window footer sentence | — | — | Your data is kept for `{days}` days. (`footerStart`; no invented new promise.) |
| Keep button | Keep `{plan}` | Close | Keep `{plan}` |
| Org confirm | Cancel and suspend | Confirm cancellation | Cancel and suspend |
| Coach confirm | — | Confirm cancellation | Cancel Premium |
| Cancel busy | Suspending… | Suspending… | Suspending… for an org; Cancelling Premium… for a coach. |
| Org success | Refreshes into cancelled card, no extra text | Account suspended / Public pages and modules have been shut down. Data is retained for 90 days. | `{org}` is cancelled. Your data is kept for `{days}` days. |
| Coach success | — | Account suspended / Premium Coaches Portal is inactive. Basic tournament records remain available and premium team data is retained for 90 days. | Premium is cancelled. Basic tournament records stay available. Premium team data is kept for `{days}` days. |
| Modal error heading | — | Something went wrong | Remove modal heading; keep the specific error in the shared persistent notice. |

### Cancellation's offline list — one server source

The Club screen currently hand-builds a list. The older screen renders `cancelPreflight.shutsDown`. The registry must
resolve that same preflight list (including enabled add-ons), rather than guessing from a plan name alone.

| Concept | Today's Club wording | Today's other wording (server preflight) | Proposed shared wording / source |
|---|---|---|---|
| Tournament/public access | tournaments; the public site when entitled | Public tournament pages and registration links | Keep server item. |
| Tournament tools | tournaments | Tournament setup, scheduling, communications, and score updates | Keep server item. |
| Tournament staff | — | Member and staff access to tournament workflows | Keep server item. |
| Public org site | the public site | Public organization site | Keep server item only when applicable. |
| House league | house league | House league seasons, registration, schedules, and standings | Keep server item only when applicable. |
| Rep teams | Rep teams and every team’s coach portal (`{count: team/teams}` when known) | Rep teams tryouts, rosters, coach portal, and player documents | Keep server item only when applicable; do not maintain a second screen list. |
| Accounting | Accounting | Accounting ledgers, invoices, budgets, and reconciliation | Accounting: ledgers, the club budget, allocations to teams (correct the single shared copy source). |
| Families | Families | The Families area — household records, the family worklist, and duplicate review | Keep server item only when applicable. |
| Premium coach tools | — | Premium roster, schedule, attendance, lineup, documents, dues, and budget tools | Keep server item. |
| Premium coach reminders | — | Coach-managed payment reminders and premium team documents | Keep server item. |
| Premium hosted slot | — | The Premium local tournament slot | Keep server item for paid cancellation, not for staff-free-time expiry. |

## 7. Cancelled view and reactivation

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Cancelled eyebrow | `{org}` is cancelled | — | `{org}` is cancelled; coach profile: Premium is cancelled. |
| Cancelled chip | Cancelled `{since}` / Cancelled | Cancelled | Cancelled `{since}` when known, otherwise Cancelled. |
| Reactivate heading | Reactivate `{plan}` and everything comes back | Reactivate your account / Reactivate Coaches Portal | Reactivate `{plan}` and restore your data |
| Org cancelled explanation | — | Your subscription has been cancelled. Public pages and modules are suspended while retained data remains restorable during the retention window. | Your plan is cancelled. Public pages and tools are suspended. Reactivate within the retention window to restore your data. |
| Coach cancelled explanation | — | Your Premium Coaches Portal subscription has been cancelled. Premium tools are inactive, premium team data remains in retention, and Basic tournament records stay available. | Premium tools are inactive. Your Premium team data is kept until `{until}`. Basic tournament records stay available. Omit the dated assertion if the actual deadline is unavailable; use “during the retention window.” |
| Reactivation intro | — | Pick up where you left off — everything below comes back on day one: | Reactivating within the retention window restores: |
| Restored items | Your public site goes back online / Every team’s coach portal reopens / Archived tournaments return / Retention reminders stop | `PLAN_FEATURES[currentPlanKey]` (includes claims unrelated to restore) | Profile-specific restore items only: applicable public site/pages, Premium tools/team portals, retained tournaments within the plan's slot limit, retention reminders. Explain any retained remainder from the server result. Do not use the included-features list as the restore promise. |
| Retention deadline | Kept until `{until}`. | — | Kept until `{until}`. No date guessed. |
| Coach Basic heading | — | Basic records are still available | Basic records are still available |
| Coach Basic body | — | Tournament registrations linked to your Basic coach team profile remain in Coaches Portal while Premium tools are inactive. | Keep. |
| Basic action | — | Open tournament records | Open tournament records |
| Coach reactivation helper | — | Start a new Premium subscription to restore team operations during the retention window. | Reactivate Premium to restore your team's tools and retained data. Preserve the existing workspace/comp-aware reactivation path. |
| Reactivation action | Reactivate `{plan}` | Reactivate `{plan}` / Reactivate Premium | Reactivate `{plan}`; coach may use the ruled short label Reactivate Premium. |
| Not-on-sale reactivation | Contact us to reactivate | No comparable contact door | Contact us to reactivate |
| Reactivation busy | Opening checkout… | Redirecting… | Opening checkout… |
| Staff-free-time-ended coach | — | Free time ended plus the free-time band and Keep Premium | Keep this distinct state; do not claim cancellation, retained-data deadline or a second portal is needed. |

## 8. Notices, errors and downgrade review

Success uses the shipped Club notice pattern (fades). Errors stay visible, matching the shared rules and
`PageNotice.tsx`. Server refusal messages remain authoritative; local fallback errors below name the failed action.

| Concept | Today's Club wording | Today's other wording | Proposed shared wording / treatment |
|---|---|---|---|
| Checkout success | Your plan is active. Everything it includes is open now. | Subscription activated! / Your plan has been upgraded. Enjoy your new features — they're applied immediately. | Your plan is active. Everything it includes is open now. |
| Card saved, ordinary | Your payment method is on file. | Card saved / Your payment method is on file for future invoices. | Your payment method is on file. |
| Card saved, comp active | Your payment method is on file. | Your payment method is on file. Nothing will be charged before `{firstCharge}` — your Founding Season stays free through `{end}`. | Your payment method is on file. Nothing is charged before `{firstCharge}`. Your Founding Season stays free through `{end}`. |
| Next-season success | — | Your next season is set / Nothing is charged before `{firstCharge}`. Your Founding Season stays free through `{end}`, and you can change your choice until then. (Direct-applied variant omits final clause.) | Your next season is set. Nothing is charged before `{firstCharge}`. Your Founding Season stays free through `{end}`, and you can change your choice until then. |
| Applied-plan heading | — | Plan updated | No modal heading; show the result sentence. |
| Applied-plan result | — | Your plan has been updated to `{plan}`. `{restored: tournament/tournaments}` restored. `{remaining: tournament/tournaments}` still exceed this plan limit and remain in retention. | Your plan is now `{plan}`. `{restored: retained tournament/retained tournaments}` restored. `{remaining: retained tournament/retained tournaments}` remain in retention because they exceed this plan's limit. Omit zero-count clauses; keep shared `planUpdatedMessage()` consumers consistent when migrating it. |
| Downgrade success | — | `{count: tournament/tournaments}` moved to retention for 90 days. / Your plan was updated. | Your plan is now `{target}`. `{count: tournament/tournaments}` moved to retention for `{days}` days. Omit the count sentence when zero. |
| Portal failure | The payment portal didn’t open. / The payment portal didn’t open. Try again. | Portal did not return a destination. | The payment portal didn’t open. Try again. |
| Card-save failure | — | Card setup did not return a destination. | Card setup didn’t open. Try again. |
| Checkout failure | Checkout didn’t open. / Checkout didn’t open. Try again. | Something went wrong. Please try again. / shared upgrade: Checkout failed / Checkout did not return a destination. | Checkout didn’t open. Try again. |
| Keep-plan failure | That didn’t go through. / That didn’t go through. Try again. | — | Keeping your current plan didn’t go through. Try again. |
| Cancel-review failure | — | Cancellation review failed / Cancellation review failed. | The cancellation review didn’t load. Try again. |
| Cancel failure | The cancellation didn’t go through. / The cancellation didn’t go through. Try again. | Cancellation failed / Cancellation failed. | The cancellation didn’t go through. Try again. |
| Next-season failure | — | The plan choice did not go through. / The plan choice did not return a destination. | Your next-season choice didn’t go through. Try again. |
| Downgrade-review failure | — | Downgrade review failed / Downgrade review failed. | The plan-change review didn’t load. Try again. |
| Downgrade failure | — | Downgrade failed / Downgrade failed. | The plan change didn’t go through. Try again. |
| Generic failure | — | Something went wrong. Please try again. | Something went wrong. Try again. Only when the action-specific fallback cannot be used. |
| Read failure (currently silent) | Move/preflight/gating reads silently fail | Seat/status/free-time reads silently fail | We couldn’t load `{section}`. Try again. Required reads must not silently enable actions or display invented counts; reuse the shipped retry control/pattern when implementing. |
| Busy upgrade/choice | — | Applying… / Redirecting… | Applying… for a direct update; Opening checkout… for Stripe. |
| Downgrade review title | — | Downgrade to `{target}` | Downgrade to `{target}` |
| Review close | — | Close | Close (plain × remains the window close glyph). |
| Target tournament capacity | — | Unlimited tournaments. / One tournament at a time: a draft or an active event holds the slot, and a finished one stays online. / `{limit}` tournaments at a time: drafts and active events hold the slots, and finished ones stay online. | Keep; count/limit comes from preflight and slot policy. |
| Current count | — | In use now: `{count}`. | In use now: `{count}`. |
| Lost Plus features | — | Tournament Plus features become inactive on the free plan: custom tournament branding, custom registration controls, exports, payment reminders, waitlist promotion, cloning, targeted announcements, and post-event summaries. Saved branding remains stored but public tournament pages use FieldLogicHQ defaults until you upgrade again. | Moving to `{target}` turns off the tools that come only with `{currentPlan}`. Saved branding is kept; public tournament pages use FieldLogicHQ defaults until you upgrade again. Any detailed feature list must come from the profile/feature source, not this screen. |
| Keep/archive selection | — | Choose `{allowed: tournament/tournaments}` to keep active. The rest move to archive retention for `{days}` days. | Keep, parameterised from preflight. |
| Fits capacity | — | Your current tournament usage fits this plan. No tournaments need to move into retention. | Keep. |
| Tournament row | — | `{name}` / `{status}` · `{year}` | Keep data, with existing human-readable status labels; no new state words. |
| Downgrade reason | — | Optional note for your records (placeholder) | Note for your records (ordinary label); helper: “You can leave it empty.” |
| Downgrade confirm | — | Confirm downgrade | Downgrade to `{target}` |
| Downgrade busy | — | Applying… | Applying… |

## 9. Plan-specific descriptions and included items

### Descriptions retired from the body

The Club benchmark does not include a plan tagline plus a second sales paragraph. Remove these duplicates from the
shared body; keep relevant facts in What's included or the existing drawer. This table inventories every current
constant, including the dormant Club branches.

| Plan key / concept | Today's Club wording | Today's other wording | Proposal |
|---|---|---|---|
| tournament tagline | — | Free for an invite-only event: you add every team, and each coach claims it by email. | Remove duplicate tagline; inclusion preserves the invitation fact. |
| team tagline | — | Built for rep team coaches who also run local tournaments — roster, schedule, dues, and documents for your team, plus one hosted tournament at a time. | Remove duplicate tagline; use profile features. |
| team free-time tagline | — | Built for rep team coaches who also run local tournaments — roster, schedule, dues, and documents for your team. | Remove duplicate tagline; keep hosting exclusion from `portal-free-time.ts`. |
| tournament_plus tagline | — | Events teams register for: public registration, payment tracking, check-in, volunteers, automation, branding, and reporting. | Remove duplicate tagline. |
| league tagline | — | Manage your league, registrations, and public presence — all in one place. | Remove duplicate tagline. |
| club tagline (dormant) | — | The complete operating system for your sports organization. | Remove duplicate tagline. |
| club_large tagline (dormant) | — | The complete operating system, sized for a larger club or association — every team and coach included. | Remove duplicate tagline. |
| tournament meta | — | You're on the free Tournament plan: an invite-only event. Upgrade when teams should register for your event, or when you need payment tracking, check-in, volunteers, branding, or repeat-event tools. | Remove duplicate meta paragraph. |
| team meta | — | You're on Premium Coaches Portal. Your team tools are active, and you can host one tournament at a time. | Remove duplicate meta paragraph. |
| team free-time meta | — | You're on Premium Coaches Portal. Your team tools are active. Hosting a tournament isn't part of free time. | Remove duplicate meta paragraph; retain the shared exclusion. |
| tournament_plus meta | — | You're on Tournament Plus. Your tournament operations tools are active. | Remove duplicate meta paragraph. |
| league meta | — | You're on League Plus. Need accounting or rep team tools? Club is the complete platform. | Remove duplicate meta paragraph. |
| club meta (dormant) | — | You're on the complete Club platform. Your whole coaching staff is included, up to 15 teams. | Remove duplicate meta paragraph; limits derive from config. |
| club_large meta (dormant) | — | You're on Club · Association — the complete platform, sized for a larger association of up to 30 teams. | Remove duplicate meta paragraph; limits derive from config. |

### Billing included lists

Each line below is a separate proposed included item. Names and numeric caps within a sentence must be parameterised
from the profile/config in code. Existing article/marketing wording is deliberately handled separately below.

| Plan / item | Today's Club wording | Today's other wording (`PLAN_FEATURES`) | Proposed billing included wording |
|---|---|---|---|
| tournament 1 | — | You add every team — each coach claims it from an email invitation | Keep. |
| tournament 2 | — | Manual tournament scheduling | Keep. |
| tournament 3 | — | Basic standings and score entry | Keep. |
| tournament 4 | — | A public event site with live scores families can follow | Keep. |
| tournament 5 | — | Venue management | Keep. |
| tournament 6 | — | Default FieldLogicHQ public styling | Keep. |
| tournament 7 | — | Public news posts and basic team email | Keep. |
| tournament 8 | — | 3 staff / admin seats · 1 tournament at a time | `{seats}` staff / admin seats · `{slots}` tournament at a time (pluralise when needed). |
| team 1 | — | One rep team Coaches Portal | Keep. |
| team 2 | — | Premium tools for roster, schedule, dues, and documents | Keep. |
| team 3 | — | Team budget and payment reminder tools | Keep. |
| team 4 | — | One hosted tournament at a time — invite-only, with PDF exports | Keep for paid/comped access; omit during staff free time and show the shared hosting exclusion. |
| team 5 | — | Unlimited coaching staff · 3 staff / admin seats on your tournament | Unlimited coaching staff · `{seats}` staff / admin seats on your tournament; omit tournament clause during staff free time. |
| tournament_plus 1 | — | Everything in Tournament | Everything in `{basePlan}` |
| tournament_plus 2 | — | Public registration — the review queue, waitlist, questions, file uploads, and exports | Keep. |
| tournament_plus 3 | — | Fees and payment tracking, and check-in | Keep. |
| tournament_plus 4 | — | Unlimited tournament slots | Keep, derived from cap. |
| tournament_plus 5 | — | Round-robin and playoff generators | Keep. |
| tournament_plus 6 | — | Full branding control | Keep. |
| tournament_plus 7 | — | Tournament cloning, announcements, and post-event archives | Keep. |
| tournament_plus 8 | — | Unlimited staff seats and volunteers | Keep, derived where numeric. |
| league 1 | — | Everything in Tournament Plus | Everything in `{basePlan}` |
| league 2 | — | Public organization page (branded) | Keep. |
| league 3 | — | House league — registration, divisions, seasons, standings | Keep. |
| league 4 | — | Advanced member roles and permissions | Keep. |
| league 5 | — | Unlimited staff / admin seats | Keep. |
| club / club_large 1 | Rep teams: tryouts, rosters, player documents, season history | club: Everything in League Plus; Rep teams — tryouts, rosters, player documents. club_large: Everything in Club. | Rep teams: tryouts, rosters, player documents, season history |
| club / club_large 2 | A Premium Coaches Portal for every team, with no per-team fee | club: Whole coaching staff included — Premium portals for up to 15 teams. club_large: Whole coaching staff included — no per-team fees. | A `{coachPlan}` for every team, with no per-team fee |
| club / club_large 3 | Accounting: ledgers, the club budget, allocations to teams | club: Accounting — ledger, invoicing, payment reconciliation. club_large: Accounting, Rep teams, and Premium Coaches Portals. | Accounting: ledgers, the club budget, allocations to teams |
| club / club_large 4 | Families: every household across your programs | — | Families: every household across your programs |
| club / club_large 5 | Your club’s public site | — | Your club’s public site |
| club / club_large 6 | House league and tournaments | — | House league and tournaments |
| club / club_large 7 | Unlimited board and staff members | Unlimited staff / admin seats | Unlimited board and staff members |
| club_large size (old duplicate) | Capacity band above | Sized for a larger association — up to 30 teams | Capacity is already shown in What's in use and Change plan, from config; no second hard-coded size sentence. |

### Approved ownership of the three lists — 2026-10-28

**Owner-approved:** `lib/plan-billing-profile.ts` owns the included-item data. `lib/plan-article-content.ts` reads its
existing **article variant** from that registry; the billing body reads the approved **billing variant**. Both variants
live in each plan entry, because the existing published article lists and the shorter Club billing list are different
editorial presentations. Do not silently replace either with the other. Names/prices/caps remain config references.

This removes the page's `PLAN_FEATURES` and the kit's `CLUB_INCLUDES` constants while keeping every existing article
feature string byte-for-byte, with separate regression assertions. The registry covers `tournament` and `club_large`
without inventing new articles or widening the drawer's accepted keys. The rest of every article (headline, pain points,
steps, billing question/subtitle, features label) stays in `plan-article-content.ts` unchanged. The existing drawer is
reused; it is not reworded by approving this billing copy table.

If “one list” instead means **identical feature sentences on billing, drawers and marketing**, that would require
approving changes to those published surfaces too. The Stage 1 instruction to preserve their wording rules that out
as an accidental consequence. The owner accepted the two named display variants in one registry. Every plan must have
both variants, even where no article page exists; preserve the current public article-key set. A new unit guard must
reject a missing variant and pin every existing article feature string and its order against today's source. This
baseline is now enforced by `tests/unit/plan-billing-profile.test.ts` in Part 1.

Article preservation anchors (2026-10-28): SHA-256 of UTF-8 `JSON.stringify(features)` from today's
`lib/plan-article-content.ts` arrays, preserving text and order, with no whitespace normalisation:

| Article key | Feature count | SHA-256 |
|---|---|---|
| team | 8 | `1b4299dfd7c357ddda00976eda1b1fc1eaa0585cad1e9f2e887aab754c386133` |
| tournament_plus | 11 | `c5c3224090d8b2b2a794cbffe1ce06d5e67e0c28c6a45419d65be6d392b794d1` |
| league | 12 | `7bc70028124f074200bb2bd6494df2a19b99d1737702814a1b4035c8f70b9ce2` |
| club | 10 | `61f13d4eaf3215fa04e60f142a2c82736fc2e152ba1ed8678542512a4d8eb97a` |

The Premium drawing has seven items; the current article has eight (including its final parent-organization link
item); the proposed billing list has five. Those are three different presentations. Approval of two registry variants
does not decide which Premium billing list wins the drawing/copy difference.

## 10. Existing shared windows and fee copy retained

These are existing components mounted by the billing implementations, not a second billing vocabulary. Preserve their
words through extraction into a shell-neutral home. `PlanMoveDialog.tsx` was read end to end. Its current sentences are:

| Concept | Today's Club/shared wording | Today's other wording | Proposed treatment |
|---|---|---|---|
| Move title | Move to `{target}`? | — | Keep. |
| Move loading | Loading what the move changes… | — | Keep. |
| Preview failure | The move couldn’t be checked. Try again. / The move couldn’t be checked. Check your connection and try again. | — | Keep the connection-specific variant when known; otherwise the first. |
| Confirm failure | The move didn’t go through. Try again. / The move didn’t go through. Check your connection and try again. | — | Keep. |
| Move checkout failure | Checkout didn’t open. Try again. / Checkout didn’t open. Check your connection and try again. | — | Keep. |
| Confirm busy | Moving… | — | Keep. |
| Checkout busy | Opening checkout… | — | Keep. |
| Window actions | Close / Cancel / Move to `{target}` / Go to Rep teams / Continue to checkout / Contact us | — | Keep. The shared window foot gets its sentence on the left using the existing footer slot. |
| Move up body | `{org}` moves to `{target}` today and can hold up to `{limit}` teams. | — | Keep. |
| Preview figures | Today, for the rest of this billing period / From `{renewal}` / From your next renewal / `{amount}` CAD / month or year | — | Keep; amount/currency from Stripe preview. |
| Up helper | Same subscription and card, with no second checkout. The prorated amount comes from Stripe before you confirm. | — | Keep. |
| Move down body | `{org}` moves to `{target}` on `{date}` / at your next renewal, and can hold up to `{limit}` teams from then. | — | Keep. |
| Down helper | You keep `{plan}` until then, with no credit for the rest of this period. From then it’s `{amount}` CAD / month or year. | — | Keep. |
| Too-small band | `{target}` holds `{limit}` teams and `{org}` has `{active}` active. Archive `{count: team/teams}` first, then come back. | — | Keep; no change to cap checks. |
| No subscription | `{org}` isn’t paying by card yet, so there’s no subscription to change. This starts `{target}` (`{price}` CAD / month or year) at checkout, where you add a card. | — | Keep; return path becomes host-supplied later in Stage 1. |
| Not on sale | `{target}` isn’t open for purchase yet. Contact us and we’ll move `{org}` for you. | — | Keep, subject to actual server refusal and contact door. |
| Moved now | `{org}` is now on `{target}`. | — | Keep as fading page notice. |
| Scheduled | `{org}` moves to `{target}` on `{date}` / at renewal. | — | Keep as fading page notice. |

Stripe fees in both pages use `StripeFeesList.tsx` and `STRIPE_FEE_WORDS` from `lib/online-payment-words.ts`.
Keep that one source. The visible strings are “Stripe fees”; “Stripe charges these fees on your online payments, and
FieldLogicHQ passes them on to every club.”; “Your plan doesn’t change.”; “On your next FieldLogicHQ invoice”; “On your
`{day}` invoice”; “Invoice `{number}` · due `{day}`”; “Invoice `{number}` · paid `{day}`”; “Credited to your account”;
“Returned `{day}`”; “Not billed: test mode”; “Couldn’t be billed yet”; and “Pay the invoice”. Fee descriptions are
server-provided invoice-line words, not re-authored by the body. The cancelled owner's fee list stays available.
No fees means the whole section is absent; no in-app subscription invoice list is added.

Both cancellation/downgrade implementations also mount `PaymentsEndingSection`, which reads the existing online-payment
ending words. Those are already shared and are **not reworded** by this proposal. Preserve the component's data and
date inputs when moving it; no new fee/refund or payment-clearing promise is introduced here.

## 11. Evidence, interpretations and approval scope

1. **Retention mismatch:** old page `confirmCancellation()` tells a Premium coach 90 days, while its review uses 365
   and server `retentionDaysFor()` / `buildCancellationPreflight()` use the coach retention constant. The new profile
   resolves the same server fact everywhere. This is copy correction, not a retention-policy change.
2. **Accounting false promise exists in the server too:** `lib/billing-retention.ts`'s
   `PREMIUM_MODULE_SHUTDOWN_COPY.module_accounting` says “Accounting ledgers, invoices, budgets, and reconciliation”.
   Proposed shared replacement: **“Accounting: ledgers, the club budget, allocations to teams”**, matching the shipped
   Club feature language. Reuse the corrected preflight output, including enabled add-ons. Do not duplicate a static
   offline list in the registry that loses add-on truth, and do not rewrite the server cancellation mechanism.
3. **Notice interpretation:** ruling 11's “success and errors … fading line” means the Club **notice presentation**
   everywhere. Shared rules §2 and the shipped `PageNotice` keep errors persistent. Only successful notices fade.
4. **Restoration wording is bounded:** replace “everything comes back” without a deadline with restoration **within
   the retention window**, using only applicable profile/preflight facts. Never list every team's portal for a plan
   that has none; never make staff free time sound like cancellation.
5. **Free-time chooser:** owner approved the real contact invitation/door while preserving the absence of
   payment/move/cancel; both ending strings change together, and running/portal copy stays unchanged (§14).
6. **No zero-day trial:** Premium now has no trial. The old generic trial-note builder can print “0-day trial”. Omit
   that line when no trial applies; do not change trial configuration.
7. **Included-list direction:** owner approved article content **reading the registry**, with paired billing/article
   variants and preservation guards as explained in §9. Existing article/marketing sentences remain unchanged.
8. **Drawings checked:** read the entire local `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` source, including CSS,
   six-plan registry, all nine tabs, state builders/matrix, both chromes, desktop/phone treatment, all 13 Asks and boot
   code. Compared the proposed-after builders and the ruled A choices; excluded Today screens and rejected options.
   The complete differences are in §12. The owner's HTML was read only and was not rendered or edited.

Owner acceptance completed the original Part 0 checkpoint. The historical follow-up below was documentation only;
subsequent authorisation and the implemented Part 1 foundation are recorded at the top and in plan §9.

## 12. Drawing/source reconciliation — owner decisions, 2026-10-28

Read all 879 source lines of `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html`, including its styles, registry, helpers, every
tab/state and Asks. Compared **proposed-after** builders and approved A answers. Today/Before screens are historical;
Tab 1's Included-first default is an explicitly rejected order alternative (Ask 6A chooses Change first); phone
options B/C and Covered-by options B/C are not the ruled options. Demo amounts, dates and organization names are
examples, not new billing facts. The drawing file's SHA-256 at inspection was
`d7044c4797d8e17c98fd7ccede669fa3c39fd02e80082671e4cf38b7e3982ee4`.

The table lists differences, not permission to choose between them. Recommendations are **not owner rulings**.
References below are to the HTML source's builders/registry rather than a screenshot.

| ID / concept | Drawing source | Copy document | Recommendation for owner decision |
|---|---|---|---|
| D1 Premium included list | `PLANS.team.inc` (304): seven detailed items, transcribed below | §9: five short legacy billing items | Use the seven drawn billing items; preserve the separate eight-item existing article variant unchanged. |
| D2 Included heading, every plan | `incH()` (391): “What {plan} includes” | §1: “What's included” | Keep the approved universal copy heading; owner to resolve this difference explicitly. |
| D3 Free plan price | `planCard()` (373): “Free forever” | §2: “Free” | Keep “Free”; no unnecessary permanent-pricing promise. |
| D4 Capacity column | `chgH()` (416), Tab 4 note (662): “Holds” | §5: “Teams” where relevant | Use “Holds” consistently, since rows can describe teams or tournaments. |
| D5 Usage captions | `meters()` (350–355): “{n} of {limit} tournament at a time”; uncapped “{n} tournaments · unlimited” / “{n} staff seats · unlimited” | §5: “Tournament slots”, “Staff seats”, generic “Unlimited”; only team count fully specified | Use the drawing's connected figure shape and clear pluralised captions (“{n} of {limit} tournament slots”); exact caption is an owner choice. |
| D6 Comp price helper | `planCard()` (372): lowercase “normally …”, no final period | §4: “Normally … .” | Use the approved copy's sentence case and punctuation. |
| D7 Founding band final sentence | `bandH()` (362): “In {month/year} you'll choose a plan for {nextYear}.” | §4: “…for your {nextYear} season.” | Use the approved copy's season wording. |
| D8 Org cancellation paragraph | `cancelH()` (423): “Everything is kept … and comes back if you reactivate.” | §6: retained data; reactivate within that time to restore what the plan allows | Keep the bounded copy promise. |
| D9 Premium cancellation paragraph | `cancelH()` (422): “Cancelling suspends Premium: {offline list} go offline … Everything is kept …” | §6: three shorter sentences, “Cancelling turns off Premium tools”, Basic stays, retention bounded | Keep the copy's product-specific language and show offline detail in the window. |
| D10 Premium warning | `cancelWin()` (692): “Premium turns off the moment you confirm: {list} go offline. Your team's Basic tournament records stay available.” | §6: Premium tools stop; days kept; Basic records stay in Coaches Portal, without the inline list | Keep the approved warning and server-derived list in the same window. |
| D11 Retention/archive paragraph | `cancelWin()` (693): “Everything … Reactivating brings it all back”; sample archive count even on every org | §6: real applicable count, time/plan-bounded restoration | Keep actual preflight count and bounded copy. |
| D12 Premium Keep button | `cancelWin()` (696): “Keep Premium” | §6: “Keep {plan}”, potentially “Keep Premium Coaches Portal” | Use “Keep Premium” for the coach; configured full labels for org plans. |
| D13 Premium confirm button | `cancelWin()` (696/706): “Cancel and suspend” for every plan | §6: coach “Cancel Premium”; org “Cancel and suspend” | Keep the copy's distinct coach confirm action. Entry button “Cancel Premium…” is already ruled and is not reopened. |
| D14 Cancel-window footer sentence | `cancelWin()` has no `fs` (697–698) | §6 adds “Your data is kept for {days} days.” on the left | Keep the copy's sentence, using the existing footer slot. |
| D15 Cancelled coach eyebrow | `cancelledH()` (435): “{workspace} is cancelled” | §7: “Premium is cancelled” | Keep the copy, since Basic still exists. |
| D16 Reactivation title | `cancelledH()` (435): “Reactivate {plan} and everything comes back” | §7: “…and restore your data” | Keep the copy, without an unlimited restoration promise. |
| D17 Restore checklist | Registry `restores` (306/316/322/328/334): fixed items, “Archived tournaments return” unqualified | §7: within-window, profile-specific restores, tournament slot limit and remainder | Keep bounded copy and actual server results. Do not promise a tournament-only org every team's portal. |
| D18 Reactivate coach action | `cancelledH()` (435): “Reactivate Premium Coaches Portal” | §7 permits “Reactivate Premium” | Use “Reactivate Premium”; owner to confirm the short label. |
| D19 Extra cancelled prose | `cancelledH()` has no separate org explanation, reactivation intro or coach restore-helper paragraph | §7 includes these paragraphs | Omit redundant extra paragraphs unless needed for retention/remaining-record truth; do not invent their placement. |
| D20 Downgrade window title | `moveWindows().dg` (653): “Downgrade to Tournament?” | §8: “Downgrade to {target}” | Use the drawn question mark. |
| D21 Downgrade reason/helper | Drawing: “Why are you downgrading?” / “For your records and ours. You can leave it empty.” | §8: “Note for your records” / “You can leave it empty.” | Use the drawing's reason/helper, consistent with cancellation. |
| D22 Downgrade buttons | Drawing: “Keep Tournament Plus” / “Confirm downgrade” | §8: only generic “Close” inventoried plus “Downgrade to {target}” confirm | Explicitly keep “Keep {currentPlan}”; use the copy's target-naming primary action. |
| D23 Lost-feature warning | Drawing lists eight lost Plus features | §8 replaces them with a generic plan-tools sentence plus saved-branding explanation | Keep the detailed loss list from the profile/feature source, plus the true branding consequence; no handwritten screen list. |
| D24 Duplicate downgrade door | `moveAct()` plus `cancelH()` (397/424–425) show the same downgrade in both Change plan and Reduce or cancel | Copy describes moving downgrade to Change plan only | Show it once in Change plan. |
| D25 Club cancellation offline list | `PLANS.club/club_large.cancel.list` (327/333): short programs, active team count | §6: longer server-preflight areas; no drawn team count; accounting is corrected Club wording | Keep one truthful preflight source including add-ons; owner chooses its concise/detailed display and whether to retain the team count. |
| D26 Premium offline-slot name | Registry (305): “the Premium tournament slot” | §6 existing server item: “The Premium local tournament slot” | Keep the existing server item; no second list. |
| D27 Org ending invitation | Drawing notes flag the broken “choose it below” and suggest rewording or a Keep door (613/840), but draw neither fix | §3: “To keep {given}, contact us.” with working door | **Resolved by owner 3a:** contact wording approved; preserve running and portal paths. |
| D28 Org running-band charge sentence | `bandH()`'s Club demo says “Nothing is charged for this…” even when fallback is free | §3/current builder says “Nothing is charged…” for free/comp fallback, “for this” when the owned plan is still paid | **Resolved by owner 3a:** keep current running builder unchanged; do not copy the demo's unconditional sentence. |
| D29 Premium free-time features | `incH()` always renders all seven, including hosting; state note 612 says hosting is unavailable | §9 suppresses hosted-event promises and tournament-seat clause during staff free time | Preserve the already-ruled hosting exclusion; recommend suppressing the drawn hosting item too. Flagged source inconsistency, not a new hosting entitlement. |
| D30 Closed Club move buttons | `moveAct()` (401–403) still prints Move on Club bands, while state note 618 says closed moves become Contact us | §5 consistently says “Contact us to move” when not on sale | Use the live-gate rule already in the shared requirements; owner should acknowledge the source inconsistency. |
| D31 Premium admin eyebrow | Tab 1 B/C explicitly pass `eyebrow:'Organization'` (565/570), while their captions and every-plan note 588 say no eyebrow on Premium | §1 omits it on coach/tournament workspaces | Follow the existing no-organization eyebrow ruling; flag the inconsistent frame arguments. |
| D32 Plan-details door | `chgH()` desktop rows and phone cards (410–416) have no “See what {plan} includes” link, drawer, or drawer placement | §5 keeps the visible door and `?plan=` | **Presence now owner-required (item 5); placement needs a drawing.** Recommend a quiet details link under each target plan's name, on desktop and phone; do not build that placement without a ruling. |
| D33 Quiet last section | No shelf in `body()`; Ask 12A retains it | §5 retains old shelf intros/audience labels conditionally | Presence already ruled; reuse shipped shelf content as the quiet final section. Its precise after-layout is not drawn. |
| D34 Responsive window close | Drawing desktop helper uses an X icon; phone form uses a back arrow (499/501/708) | §8 only mentions plain × as window close | Reuse shipped window behavior: plain × at desktop, back arrow on phone forms. The latter is already shipped in `KitDialog`; record the clarification, no new close control. |

Other differences are **coverage the drawing does not specify**, rather than competing sentences: next-season chooser,
card-on-file/chosen-choice confirmation, action busy labels, specific Stripe/server/read failures, empty/loading counts,
and success notices beyond the two examples. These remain covered by the accepted copy and shipped components.
The drawing confirms the approved success-fades/error-persists interpretation (state note 619 and Ask 11).

### All plans' included items checked

| Profile | Drawn count | Billing proposal count | Comparison |
|---|---|---|---|
| team | 7 | 5 | D1: different list; D29: hosting item must not promise hosting during staff free time. |
| tournament | 8 | 8 | Every item matches; replace example seat/slot numbers with config values. |
| tournament_plus | 8 | 8 | Every item matches; parameterised names/caps only. |
| league | 5 | 5 | Every item matches; parameterised base-plan name only. |
| club | 7 | 7 | Every item matches. |
| club_large | 7 | 7 | Every item matches; both use the same Club list without a duplicate size promise. |

Premium's **seven drawn billing items**, in order: full roster management (positions, jersey numbers, contact info);
game schedule, attendance and lineup builder with PDF export; team budget, dues, expenses and reminders; documents,
season checklist and season-end record; registering/entering tournaments and season results; tournament participation
history; hosting one invite-only event with PDF schedules/results. The **five proposed billing items** are one rep-team
portal; roster/schedule/dues/documents; team budget/reminders; hosted invite-only tournament/PDF exports; unlimited
coaching staff plus tournament admin seats. The seven-item drawing expands the first three, adds the checklist,
season-end/participation-history wording, and omits explicit unlimited coaching staff/admin-seat inclusion. The existing
eight-item article keeps its final “Link to your parent organization…” feature regardless of the billing-list decision.

## 13. Trial-sentence verification — actual checkout code

This is a source audit, not a Stripe payment test or a query of live plan overrides/Dashboard settings. No trial
configuration, pricing or checkout behavior was changed. Defaults are from the canonical config, not a promise of
eligibility to an individual buyer.

| Plan key | Default trial in `lib/plan-config.ts` | What the real checkout does |
|---|---|---|
| tournament | 0 | No default trial; not a paid upgrade target with a trial. |
| team | 0 | Dedicated coach checkout. A positive plan-wide DB override could supply a trial only outside Keep Premium; Keep Premium explicitly omits it. The coach path does not call the organization-history check. |
| tournament_plus | 14 | Ordinary org checkout supplies merged positive trial days only when Stripe history says no prior qualifying subscription. |
| league | 30 | Same org checkout/history condition; checkout additionally requires the live sale gate open. |
| club | 90 | Same org checkout/history condition and live sale gate. |
| club_large | 90 | Same org checkout/history condition and live sale gate. |

Evidence: `lib/plan-config.ts:50/64/78/90/112/135`; `lib/plan-config-db.ts:44–55` merges the **plan-wide**
`trial_days` override; `app/api/billing/create-checkout/route.ts:96–97,341–359` uses that merged value and history;
`lib/plan-move.ts:382–388` excludes never-started (`incomplete`/`incomplete_expired`) subscriptions and Founding
next-season choices from history. A prior trial counts as a used subscription. Returning orgs do not get another
trial; paid-to-paid moves use the same subscription and start no new trial. The move dialog's checkout fallback
uses ordinary org checkout, so inherits its eligibility rules.

**Payment collection:** both real subscription routes omit `payment_method_collection` and `payment_method_types`.
The installed Stripe SDK documents the collection default as `always` and says omitted method types come from
Dashboard settings (`node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts:2215–2239`). Thus omission does **not**
mean a trial collects no payment details. It also does **not** prove cards are the only available method. Subscription
checkout may confirm an existing saved method rather than demand a new card. With a positive `trial_period_days`,
the first subscription charge is deferred to trial end; neither route sets a separate billing-cycle anchor. Official
references: [Stripe Checkout API](https://docs.stripe.com/api/checkout/sessions/create) and
[Stripe trial guide](https://docs.stripe.com/payments/checkout/free-trials).

**Wording finding:** the universal “you add a **card**” promise is not established by these checkout parameters. The
source-supported conditional version is “{days}-day trial — you add a **payment method** at checkout, and you're first
charged when the trial ends.” If eligibility/duration is not known, use the existing “Payment details collected in
Stripe” line, or omit the trial sentence. Never show the default period as if everyone gets it; never show zero days.
`clubTrialLine()` still contains the existing card-specific canon. **Owner ruling T1:** use payment-method wording
everywhere, including pricing; billing adopts it in Stage 1 and the shared public Club sentence changes in its separate
`/marketing` step. Checkout is not changed to force cards. Part 1 prepares that billing vocabulary and changes neither
the public helper nor its callers.

**Separate flows:** Founding comp application bypasses ordinary subscription checkout; its next-season choice uses a
fixed `trial_end` at the promised first-charge instant and `proration_behavior:'none'`
(`lib/next-season-choice.ts:156–168`), not the configured day-count trial. Setup-only card save explicitly requests a
card, creates no subscription, and takes no subscription payment (`lib/billing-setup.ts:112–118`). Coach Keep Premium
omits trial days (`create-team-checkout/route.ts:333–345`). Dev mock orgs can be marked trialing without a real trial
checkout; mock state is not evidence of card collection or charging time. No live override/Dashboard values were assumed.

## 14. Approved org ending-copy edit — complete impact before runtime work

**Do not edit the builder during this docs-only follow-up.** On a later authorised implementation, change both
`lib/free-time-copy.ts:79–81` (the ending band's `keep` sentence) and `:93–95` (the ending `billingCard` sentence) to
“To keep {given}, contact us.” in their existing live-plan branch. Keep the running branch byte-for-byte and keep
the closed-plan branch honest. A working contact door can reuse `FreeTimeBand`'s shipped `action` slot and existing
contact destination; verify the destination and owner access when wiring it. No new payment/move/cancel control.

| Surface/consumer | What reads it / future effect |
|---|---|
| `components/admin/kit/club/BillingKit.tsx:139–144,348–351,410` | Calls `freeTimeCopy`; renders card and band on both Club sizes; never renders its `billingCard`. Ending band changes. |
| `app/[orgSlug]/admin/org/billing/page.tsx:548–553,561–562,887,1347–1351` | Calls builder; renders org band and, when eligible, org `billingCard`. Covers current non-Club admin billing plans. |
| `app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx` | Re-exports the admin billing page, so tournament-tier billing sees the same change. |
| `components/admin/FreeTimeBand.tsx:13,53,63–65` | Type-only import, no builder call. Displays supplied text/phoneText and has the shipped action slot. Future shared body uses this renderer. |
| `lib/help-content/org.tsx:280–286` (`club-plan-and-billing-t-free-time`) | Last-14-days paragraph says the customer can choose the plan there. Update that now-false instruction with the future copy change; check surrounding article search text/keywords at 270–271. |

| Test | Exact old-sentence pin or coverage |
|---|---|
| `tests/unit/free-time-surfaces.test.ts:62–65` | **Only direct org ending-sentence pin found:** “To keep Tournament Plus, choose it below.” Replace that assertion with approved contact wording and preserve its over-limit suffix checks. |
| Same file, 56–60 | Exact running card/title/body/billing line; keep unchanged. |
| Same file, 67–79 | Closed-Club last-day and ended-state copy/tones; retain those branches and no-price/limit checks. No current assertion pins the org ending `billingCard`; add one when implementing. |
| Same file, 22–25,49–53 | Effective-plan routing and private-data boundary regressions; keep. |
| `tests/unit/support-console-stage4b-coach-guard.test.ts:57–66,116–143` | Pins the **portal** “choose it below” band AND billing line, and Keep Premium/hosting/cancel/ended-state behavior. These assertions remain unchanged, except later source relocation with preserved meaning. |
| `tests/unit/support-console-stage4b-ending-reminders.test.ts:62–70,115–123` | Portal Overview intentionally omits “below”; preserve its action/mount behavior. Not an org sentence pin. |

No other direct org sentence pin, UAT assertion or coach-help paragraph was found. Portal copy comes from
`lib/portal-free-time.ts`, not this builder: the current billing page uses it, the free Basic Overview uses its **ended**
band, and `PortalFreeTimeEndingBand` uses its separate Overview projection. The free-time API returns `freeTime:null`
plus `portal` for a coach workspace. None of those portal paths is converted to the org contact invitation.
