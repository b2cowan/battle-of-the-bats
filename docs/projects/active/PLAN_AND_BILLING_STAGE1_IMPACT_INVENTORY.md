# Plan & billing — Stage 1 impact inventory

**Parts 1–2 implementation recorded 2026-10-28; verification findings in plan §9.** Companion:
`PLAN_AND_BILLING_COPY.md`; plan/progress: `PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md` §9.

**Part 1 implementation update — 2026-10-28:** registry/words and three focused guard-test files are implemented.
The two current billing list readers and article feature arrays now use the registry. Existing screen/URL guards still
pass without weakened assertions. Only the retention constant-location assertion in
`coaches-portal-cancellation-guard.test.ts` was repointed to the new pure policy, retaining server-use coverage.
Move policy and cancellation data have client-safe homes with compatible server exports. The other legacy screen
strings/preflight presentation move with Parts 2–3. Full checks/results and unrelated shared-tree failures are in plan §9.

## Count and required assertion preservation

**Part 2 relocation checkpoint — 2026-10-28:** all six direct old-screen readers below now also guard the actual
shared body/data, while preserving assertions for the still-live non-Club screen. The Club host is thin. Window,
notice, free-time band, fees and payments-ending implementation/styles moved to neutral homes with compatible
old imports; their direct source guards follow those implementations. The Club literal exception was retired,
not re-hashed. New React rendering tests exercise every profile, both roles, all free-time states and a fake extra
profile. The owner-only count route and billing free-time mode have route/service coverage. Nav/UAT cutover remains
Part 3; exact files, findings and owner checks are recorded in plan §9.

There are **six unit-test files that directly read the old billing screen/CSS**, not just the five initially
identified by slash-path searches. `plan-panel-host` builds its read path from separate arguments. Three more
unit-test files pin the navigation being changed, and one UAT file has the stale non-owner control assertion:
**ten confirmed files to update with implementation**. The broader regression list below is additional coverage,
not a claim that every test in it currently fails.

| Direct screen reader | Evidence | Required update; assertion to preserve |
|---|---|---|
| `tests/unit/support-console-stage4b-coach-guard.test.ts` | 116–143; CSS read at 126 | Repoint to body/words/styles. Keep price/Stripe/cancel/slot exclusion during portal free time, owner-only Keep Premium, its 44px floor, outlined Join a club, and ended-free-time distinction from cancellation/retention/reactivation. |
| `tests/unit/stripe-fees-owner-rulings.test.ts` | 30–36 reads both implementations | Shared cancelled branch must still render the owner's Stripe fees below reactivation, for applicable plans including free/comped accounts. Replace duplicate-implementation assertions with shared behavior coverage. |
| `tests/unit/team-move-words.test.ts` | 93–102 slices the nudge's words | Read the approved words module plus its rendering. Preserve the exact no-double-charge promise and prohibitions on refund/credit/proration promises. |
| `tests/unit/tournament-one-at-a-time.test.ts` | 103–120, page in readers at 113 | Move count-source assertion to the usage API/service that now counts. Still prove use of `holdsSlot` / the shared slot policy; a finished event holds no slot. |
| `tests/unit/gated-plan-availability-copy.test.ts` | 55–88 | Census new body/profile/words sources. Keep every retired-availability-copy prohibition; do not reduce the coverage to the now-thin host. |
| `tests/unit/plan-panel-host.test.ts` | 68–80, split-path page reads at 71 and 79 | Move shared-upgrade/request/owner-gate assertions to the extracted body or action helper. Keep the existing drawer assertions, both URL forms, `?plan=` validation and unsupported-plan rejection. |

| Nav/UAT assertion | Evidence | Required update |
|---|---|---|
| `tests/unit/admin-kit-nav.test.ts` | 69–76, 90–95 | Billing leaves `kitOrgLinks` for foot data. Test owner-only access on every admin plan and cancelled-owner access at its new position. Keep all other role gates. |
| `tests/unit/nav-standard-guard.test.ts` | 124–145 | Add billing in More → You and beside Help in the rail foot, retaining ordering/icon/foot checks. Do not weaken into a mere string-presence assertion. |
| `tests/unit/notification-open-in-place-guard.test.ts` | 188–191 | Finds billing via `kitOrgLinks`. Point at new foot data; still assert equality with `ADMIN_PAGE.billing`. |
| `tests/uat/scenarios/plan-gating.spec.ts` | 187–201 | Replace non-owner disabled `#billing-manage-btn` assertion with the locked-card text and absence of all billing actions; preserve the owner enabled-control check and stable IDs. |

## Regression checks and new tests

| Existing coverage | Evidence / what to retain |
|---|---|
| `lib/billing-urls.test.ts` | 17–40. Actual location is `lib/`. Tournament tiers retain their subscription URL; others/unknown keys retain org billing. Stage 1 fixes portal/mock-portal returns through the existing resolver, not a Stage 2 resolver rewrite. |
| `tests/unit/notification-reader.test.ts` | 86. Existing org billing link still says “Open Plan & billing”. New coach destinations belong to Stage 2. |
| `tests/uat/scenarios/marketing-seam.spec.ts` | 58–68, 104, 110. Viewer-specific billing URLs, neither anonymous nor server-rendered billing deep links. |
| `tests/unit/org-billing-access-guard.test.ts` | 38–50, 65–66, 135–142. New owner usage read route(s) need explicit `allowSuspendedOrg` exceptions/reasons. Retain billing comeback access and every existing guard. |
| `tests/unit/free-time-surfaces.test.ts` | 9, 22–25, 49–80. Effective-plan layout routing and the shared free-time builders. Add coverage for any approved correction to the ending invitation; preserve existing running copy. |
| `tests/unit/plan-reader-door-guard.test.ts` | 179–191. Billing actions use the owned plan, not the temporarily effective free-time plan. |
| `tests/unit/club-stage1-screens-guard.test.ts` | 90, 135. Billing remains non-grantable and hub entries remain owner-only. |
| `tests/uat/scenarios/coach-wall-doors.spec.ts` | 39. Existing subscription link remains valid. Wall retargeting is Stage 2. |

New focused tests required during Parts 1–3: every `OrgPlan` has a registry profile; every profile has **both billing
and article variants**; every existing article feature string/order matches the dated source anchors in the copy
document §9; name/price/cap provenance matches
config; fake added-plan profile renders without screen edits; no screen-authored plan names/prices/included items;
article feature strings/order survive registry relocation unchanged; correct portal/mock-portal return for every plan;
owner-only org-scoped usage reads and suspended-owner access; stable host-supplied return base; return flags handled
once; supported-only change actions; all-plan non-owner lock; cancellation/free-time/retention distinctions. Keep
server moves and downgrade preflights as separate existing mechanisms.

## Checks, baselines and source lists

| File | Observed dependency | Implementation follow-through |
|---|---|---|
| `scripts/check-public-tokens.mjs` | 693–694 explicitly list old page/CSS; mock portal listed at 624; discovery filters named paths with `existsSync` at 335 | **Leave unchanged (owner 2026-10-28).** `page.tsx` stays as the host. After deleting the old CSS, its path is a **stale entry, harmless, tidy later**; it is skipped, not a failed file read. |
| `scripts/check-admin-type.mjs` | 51–61 already include `components/billing` as well as admin directories | No scanner-path edit is needed for a body under `components/billing`. Run unchanged check. |
| `scripts/.css-selector-baseline.json` | 32–36, retiring CSS lists `billingNudgeActions`, `planIcon`, `priceUnit` | Use the existing generation/ratchet workflow after CSS deletion; preserve unrelated baseline work. |
| `scripts/.admin-type-baseline.json` | 87, Club `Billing.module.css` has `heavy: 1` | If extraction removes that debt, regenerate through the existing script, never carry debt into new files. If CSS remains used by the existing move dialog, inspect actual usage before removing it. |
| `scripts/.layout-baseline.json` | `admin-org-billing` at 2912/3512/4096; tournament subscription at 5392/7128; panel at 10527 | Refresh on staging or a local production build at release, not a whole-product dev sweep. These are references, not permission to hand-edit baseline results. |
| `scripts/layout-screens.mjs` | 1462 Club billing; 1682–1687 subscription panel scenario | Preserve plan-drawer door “See what … includes” and dialog name ending in “plan details”, or explicitly update the narrow interaction for the approved replacement. |
| `.claude/settings.json` | 106 has a permission entry naming old CSS | **Leave unchanged.** Stale permission text is not a reason to alter shared permissions in this project. |

**Token coverage checked without edits:** operator CSS scanning already includes `components/billing` (91); the TSX
ratchet scans all `app` and `components` (207–218); admin-type scanning includes billing (61). The extra strict
whole-file admin colour rule covers admin roots (510–516) and the named existing `PlanArticlePanel.module.css` (519),
not every future shared billing stylesheet. **Recommendation only:** extend that stricter zero-debt coverage to the
future shared billing body stylesheet, if the owner wants it, in its own explicitly requested automation commit.
Do not add a whole-folder blanket rule or make any automation edit as part of this task. Existing general token checks
already cover the new location. No further permission is sought for the harmless stale CSS entry.

## Help article census

**Five affected org-help articles in one source file**, including a navigation instruction missing from the prompt's
initial leads. Only statements made false by Stage 1 change; the full rewrite remains Stage 5.

| Source `lib/help-content/org.tsx` | Evidence | What to inspect/change with the screen |
|---|---|---|
| `recipe-enable-modules` | 220–240, especially 233 | “Organization > Plan & billing” becomes false when the row moves to the foot. |
| `club-plan-and-billing` | 267–325 | Old section names (“Club’s two sizes”, “Teams on your plan”), nav location, move/cancel wording, reason-field description; update summary/search text as well as visible prose where affected. |
| `subscription-ends` | 329–394 | Reactivation and cancellation wording, locked-card roles, correct retention source; no retention-policy change. |
| `stripe-fees` | 1219–1266 | Section placement/door wording only; owner-only visibility, fees on cancelled accounts, every-plan charging and actual invoice promises stay. |
| `leaving-online-payments` | 1270–1340, cancel topic at 1328 | Cancel window wording; preserve clearing, owed money and ownership of the Stripe account. |

`lib/help-content/tournaments.tsx` article `repeat-event-setup` (222–233) links to the subscription URL that remains
valid; no Stage 1 text change needed just because that link exists. Drawer/marketing copy from
`lib/plan-article-content.ts` must keep its existing wording/order while its feature data moves to the registry.

## Runtime seams inspected, not changed

- Both billing components were read end to end. The tournament subscription page remains the alias for the admin
  host; no new page route is needed in Stage 1.
- Club teams currently come from `useClubBrief`; tournament slots come from `useTournament` plus `holdsSlot`;
  staff seats come from `/api/admin/members/count`. Parts 1–3 still need to establish the smallest owner-only
  org-scoped counts read instead of depending on admin contexts. No route was added during the copy checkpoint.
- `PlanMoveDialog`, `StripeFeesList`, `FreeTimeBand`, `plan-upgrade`, cancellation preflight and reactivation source
  were inspected for their displayed words and contracts. Shared copy defects are in the copy review, not fixed yet.
- Read the owner's local `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` end to end as source: all 879 lines, six registry
  entries and included lists, all nine tabs/state helpers, 13 Asks, both chromes and desktop/phone treatment. Compared
  proposed-after builders against the copy, distinguished Before screens/alternative options from ruled A choices,
  and recorded every difference in `PLAN_AND_BILLING_COPY.md` §12. The owner HTML was not edited or rendered.
- The Change plan tables/cards contain no visible plan-details door or drawn placement. The owner now requires the
  door on every plan with a table. Preserve `?plan=` and its tests; await the placement ruling instead of inventing one.
- Trial terms were traced through actual subscription sessions, history/override rules and Stripe SDK defaults.
  Collection is required by default but not explicitly card-only; conditional wording/evidence is in copy §13.
  No checkout setting or shared Club sentence was changed in this documentation task.

## Part 0 state/flow review

This is **source tracing only**, not a browser or payment test. Active/free/trial/past-due price/status branches,
org free time running/ending/ended, coach free time running/ending/ended, Founding/card/no-card/choice states,
cancelled/reactivate/locked-card branches, Stripe read/action failures, no-fee omission, and one-shot
`success`/`card_saved`/`next_season` handling were traced in the two current components. The old non-owner gaps and
the old success-close admin navigation are explicitly carried into the implementation requirements.

Stripe returns **not exercised**: portal return, card-save return, next-season checkout, upgrade checkout
success/cancel, plan-move checkout. No network payment action was taken. Browser and 390px checks remain the owner's;
the approved drawings were inspected in source as requested. Empty invoice state stays in Stripe's portal; the app adds no invoice
list. No runtime behavior changed, so there is no new screen for an owner to walk at this checkpoint.

## Approved org free-time edit — readers and test impact

The owner approved “To keep {given}, contact us.” with a real working contact door, unchanged running copy, and the
portal Keep Premium path untouched. **No runtime edit now:** Part 1 waits for “build Part 1”. Copy §14 contains the
complete pre-edit census. Two runtime callers are `BillingKit.tsx:139–144` and the old billing page `:548–553`;
the tournament subscription URL re-exports the latter; `FreeTimeBand.tsx` is the type-only consumer/renderer.
The old page can also render the separate ending `billingCard`, so both org ending strings need the later edit.

Only `tests/unit/free-time-surfaces.test.ts:65` pins the old org sentence. Preserve its running exact-string tests at
56–60, closed/ended branches at 67–79, and add a missing ending-billing-line assertion. The help article's last-14-days
“choose it there” sentence (`lib/help-content/org.tsx:285`) must follow the future copy update. Portal sentence pins in
`support-console-stage4b-coach-guard` and Overview/reminder checks remain unchanged. No other direct org sentence pin
or UAT pin was found.
