# Plan & billing — Stage 1, Part 2: the shared billing body

**Prepared 2026-10-28. Execute this after Part 1's `/simplify` and `/review` are complete.**

You are authorised to build **Part 2 of Stage 1**, the shell-agnostic billing body. This is **not Stage 2** (the
Coaches Portal host) and does not authorise Stage 1 Part 3's all-plan admin cutover/navigation changes. Do not commit.

## 1. Establish the starting point

Read `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`, then these project files:

1. `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`.
2. `docs/projects/active/PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`, especially §9's **latest** owner rulings,
   Part 1 implementation, subsequent simplify/review results, and verification state.
3. `docs/projects/active/PLAN_AND_BILLING_ONE_EXPERIENCE_PM_BRIEF.md`.
4. `docs/projects/active/PLAN_AND_BILLING_COPY.md`. Its §12 comparison is historical; the later owner-ruling table
   in the plan settles those differences. Do not reopen settled choices by reading only an earlier paragraph.
5. `docs/projects/active/PLAN_AND_BILLING_STAGE1_IMPACT_INVENTORY.md`.
6. `docs/projects/active/PLAN_AND_BILLING_STAGE1_BUILD_PROMPT.md`, Part 2 plus the adjoining part boundaries.
7. `docs/projects/active/PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` **end to end as HTML source**. It is the owner's
   untracked file: do not edit it. Compare proposed-after builders and ruled choices, not Today screens or rejected
   options. Use a later owner-approved drawing if the review session supplied one.

Load the relevant memory/design references required by the shared rules, including the nav, table/list and coach
surface standards. Before writing Next route/layout/component-boundary code, read the relevant installed guide in
`node_modules/next/dist/docs/`. Request interception is `proxy.ts`; never create root `middleware.ts`.

Check `git status` and the branch; work on **dev** and preserve other sessions' edits. All paths below are leads:
`/simplify` and `/review` may have renamed or improved them. Read actual current code before building on it.

**Entry gates:**

- Confirm Part 1's `/simplify` and `/review` have completed, with relevant findings fixed or explicitly accepted.
  Use the hand-off/plan or the owner's supplied confirmation; do not rerun Claude slash commands from Codex.
- The owner ruled that Part 1 needs green `npm run verify:changed` before being called done. Check the latest result.
  At this prompt's preparation the complete unit suite, typecheck and focused lint passed, but the full command stopped
  at an unrelated `react-hooks` plugin configuration error. A separate lettering check found unrelated CSS debt.
  These are historical findings, not assumptions about today's tree. Do not waive this gate, hide files from it,
  change a check, or repair unrelated work under this prompt. If the gate is still unmet, report the concrete blocker
  before implementing Part 2. This prompt authorises implementation once the recorded entry gates are satisfied;
  do not request another generic permission when they are already met.

Present an implementation/task list and a plain-language PM UX summary before significant edits, as the repo requires.

## 2. Reuse the Part 1 foundation

Inspect the current versions of:

- `lib/plan-billing-profile.ts`: paired billing/article variants, config references, usage descriptors, supported
  change mechanisms, existing-comp display flag, retention and cancellation projections.
- `lib/plan-billing-words.ts`: concept-keyed billing wording, with references to existing shared builders.
- `lib/billing-cancellation-policy.ts`: one source for selected shutdown areas, their detailed and short projections,
  retention constants, enabled add-ons and the Club active-team count.
- `lib/plan-move-options.ts`, `lib/plan-upgrade.ts`, and the existing server move/downgrade mechanisms.
- `lib/plan-article-content.ts` and the three `tests/unit/plan-billing-*.test.ts` guards.

Do not create another registry, words file or included-list array. Names/prices/caps come from `plan-config` through
the profile; availability comes from the live sale gate. An existing-comp display flag must never grant a comp.
Published article feature strings/order and the public article-key set must remain unchanged; keep their hash guards.

Part 1 deliberately left these presentation changes for this part: adopting the words in the actual body; replacing
Club's hand-built offline list with the shared preflight projection; correcting the old shared accounting description;
and changing the org ending invitation together with its real contact door, consumers, help wording and tests.

## 3. Build one body, independent of either portal's chrome

Extract and generalise the Club benchmark into one body under `components/billing/`, driven by the profile. It must
support every current plan through data, not a collection of plan-specific page implementations.

- The host owns the page title/header, surrounding chrome and return base. The body must not import
  `AdminPageHeader`, `ClubKit.module.css`, `ck.*`, admin-kit `KitDialog`/`PageNotice`, `useTournament()` or
  `useClubBrief()`. Do not merely hide those dependencies behind an alias or thin wrapper.
- Use normal component composition and the existing data contracts; do not invent a second billing framework.
  `OrgProvider` is available in both future hosts, but admin tournament/club providers are not.
- Keep the Club page's connected price/renewal/usage band, body typography and section order. Reuse shipped controls
  and tokens. Where the drawing is silent, identify the closest shipped component used; do not design a look-alike.
- Make existing windows/notices genuinely reusable in both shells. Preserve the shipped window's focus trap,
  dismissal/history/dirty/busy behavior, layering and responsive treatment. Keep compatible imports for existing
  callers where needed. Move shared implementation/styles to a neutral home without reskinning other screens.
  Successes fade; errors persist. No success/error `FeedbackModal` and no automatic admin navigation after success.
- Window foot: sentence on the left, actions on the right. Plain × on desktop; Back on phone forms. Phone actions
  retain the required tap floor and the change-plan table becomes cards.
- Every URL the body builds uses one host-supplied billing base/return destination. No hard-coded admin billing
  destination inside the body, move dialog or its checkout fallback. Preserve the current server allow-list;
  broadening it to a new coach host belongs to Stage 2.

**Make the extraction reviewable:** use the existing Club host as the minimal live integration for this part, supplying
its existing header/chrome and billing return base. Keep the top-level Club/non-Club switch and the other plans' old
admin view until Part 3. Exercise all other profiles through the actual new body in tests/fixtures, not a second mock
screen. Add no preview route. Do not perform the all-plan cutover, rail/More changes, portal-return fix or legacy-page
deletion from Part 3 just to finish this part.

## 4. Replace provider-dependent counts with safe reads

First check for existing usable endpoints. Staff counts currently have `/api/admin/members/count`; Club teams and
tournament slots currently depend on admin providers. If needed, add the smallest read-only aggregated billing-usage
endpoint/service that returns only counts and limits, with:

- explicit `orgSlug`, authenticated owner/billing authorisation enforced on the server, and no PII;
- counts using the same policies as enforcement (active/non-archived teams; tournament `holdsSlot` rule; actual staff
  seat exemptions), and the effective org limits rather than just static defaults;
- required suspended-owner comeback access, with an explicit reason in `org-billing-access-guard.test.ts` for any new
  `allowSuspendedOrg: true` consumer; never weaken existing checks;
- honest loading/error states. An unread/failed count is not zero. Prevent stale reads or actions from painting data
  for another organization after a context switch.

Do not import server/Stripe/Supabase modules into the client graph. Do not add a migration, a write endpoint or a new
capability. Name any added read route and explain why the existing routes could not supply it in the hand-off.

## 5. Apply the settled product/copy rules

Use the **latest plan §9 owner table** as authority. In particular:

- Order: Your plan → What's in use → applicable free-time/Founding band → Stripe fees → Change plan → What's included
  → (tournament plans only: the quiet discovery section) → Reduce or cancel, which ends the page on every plan (owner 2026-10-29).
- Premium billing uses the seven drawn items, omitting hosting during staff free time. Its eight-item published
  article stays unchanged. Basic records remain available when Premium is cancelled.
- “What's included”, “Free”, and “Holds” are settled. Meter captions are pluralised connected figures, including
  “{n} of {limit} tournament slots” and “{n} staff seats · unlimited”. The comp helper is “Normally $X a year.” using
  the annual config value. Dates, money, names and possessives use the established helpers.
- A quiet “See what {plan} includes” link sits **under each target plan's name**, desktop and phone, and opens the
  existing drawer. Keep `?plan=` entry behavior. A target without a published article still needs honest details:
  reuse the existing detail window with that profile's article variant, label and price, without adding published
  article keys/routes. Never silently show the lower Club price/name for an Association target. Preserve existing
  published article text/order and do not invent replacement sales paragraphs.
- Use only the existing offered moves. Free → Plus uses checkout; Plus → free uses downgrade preflight; Club-band
  moves keep their current mechanism. Plus gets Club rows now, reading “Contact us to move” until Club opens. No
  Premium → Club purchase move, no broader API-only downgrade doors, no merged server mechanism.
- Club cancellation uses **short program names and the real active-team count from the shared server source**,
  including enabled add-ons. Correct the false accounting promise in that shared source rather than hiding it with a
  screen replacement string. Never promise unbuilt invoicing/reconciliation.
- Retention is profile/preflight-driven: Premium 365 days; organizations 90. Coach controls say “Cancel Premium…” /
  “Cancel Premium” / “Keep Premium”. Org cancellation says what it suspends. Restore promises are bounded by retention
  and actual plan limits, with retained remainders explained; no unconditional “everything comes back”.
- Downgrade window: question title, “Why are you downgrading?”, the full records helper, “Keep {current plan}” and
  “Downgrade to {target}”. Show the detailed profile-driven lost-feature list and true branding consequence. One
  downgrade door, in Change plan.
- A non-owner typing the URL gets the same locked card and no billing data/actions for every profile/state.
- Founding wording stays off Club, including any nested free-time suffix. Preserve legitimate existing holders,
  next-season choices, summer card window and card-on-file display. Keep the returning-checkout/webhook race from
  showing a second chooser after a choice was just made.
- Staff free time removes payment/move/cancel controls. Ended coach free time is **not cancellation** and must never
  create a retention clock or a second portal. Preserve Keep Premium and Join a club, including their existing visual
  action priority and owner checks.
- Org ending invitation is “To keep {given}, contact us.” Update both band and ending billing line with a working
  contact door. Before editing `lib/free-time-copy.ts`, recheck its complete reader/test census in copy §14. Because
  that builder is shared with the still-live non-Club screen, its affected consumers must get the real contact door in
  the same change. Running copy remains unchanged; portal copy/Keep Premium remains unchanged. Update the now-false
  org help instruction and its search text only where necessary.
- Trial promises use **payment method**, not card-only language. Show a day-count trial only when actual effective
  eligibility/duration is known; otherwise use the approved neutral line or omit the promise. No zero-day trial,
  second trial or checkout change to force cards. The shared public Club helper/pricing/brand rewrite is assigned to
  its separate `/marketing` step; inspect its current state and preserve that boundary.

Preserve every working detail from both current implementations: scheduled move/Keep action, live unavailable-plan
contact doors, cancelled-owner Stripe fees below reactivation, fee-section omission when empty, stable control IDs
including `billing-manage-btn` and `billing-reactivate-btn`, and all applicable card/choice/checkout notices. Consume
`success`, `card_saved`, and `next_season` once without losing the requested drawer state or allowing duplicate choices.

## 6. Tests, documentation and boundaries

- Extend Part 1's tests to exercise the **actual body** with every profile, both owner/non-owner access, and an isolated
  fake extra profile without editing the component. Do not claim a data-factory test alone proves rendering.
- Test the new usage read's owner/org isolation, suspended access, count policies and unavailable/error states.
- Cover free-time running/ending/ended, no-Founding-on-Club, post-checkout chooser suppression, retention/restore
  distinctions, supported change dispatch and host-supplied return destinations. Avoid tests that merely repeat code.
- Repoint source guards to the actual extracted implementation in the same change. The impact inventory identifies
  **six** direct old-screen readers. When Club becomes a thin host, replace its old assertions with equivalent shared
  body assertions; keep the still-live non-Club assertions until Part 3. Remove a frozen legacy exception only when
  its literals have actually left; never update a frozen hash to grandfather new copy or exempt the new body.
- Keep exact article-preservation and pair-completeness assertions. Change the org ending-sentence assertion and add
  the missing ending-billing-line assertion; keep exact running/portal sentence tests.
- Update plan §9, PM brief and the existing one-line TODO index. Record exact files, gates, limitations and remaining
  Part 3 work. Update only help strings this part makes false; the full help rewrite is Stage 5.

**Do not touch** `.claude/settings*.json`, hooks, check scripts, watched automation or production tooling.
`check-public-tokens.mjs` stays unchanged: a deleted-CSS entry is “stale entry, harmless, tidy later” because discovery
uses `existsSync`. General operator CSS/inline TSX coverage already includes `components/billing`; stronger strict
coverage is a separate owner decision and separate commit, not part of this task. Do not hand-edit generated baseline
results or regenerate a whole-product layout baseline locally.

No Coaches Portal page/nav/wall retargeting, no admin retirement, no email/bell link resolver changes, no Covered by
surface, no pricing/entitlement changes, no in-app invoice list, and no Part 3 work. Preserve unrelated sessions' work.

## 7. Verify and hand off

Run expensive checks serially. Use focused lint while implementing; run required unit coverage, `npm run typecheck`
and `npm run verify:changed`. A historical unrelated failure may have changed: report the current exact failure and
paths, distinguish task defects from shared-tree findings, and never claim a failed/aborted command passed. Do not
repair unrelated automation/config/CSS to manufacture a green result. Do not call the part verified unless its
required gate is actually green or the owner explicitly changes that gate.

Browser/visual testing is the owner's. Do not run a full dev layout sweep. After new files/shared modules, restart
the workspace dev server near hand-off using **`npm run dev` with escalated network access**, then confirm
`/platform-admin/login?next=%2Fplatform-admin` returns 200 and logs contain no Supabase `EACCES`. Stop before any cache
deletion; clear `.next` only if needed. Preserve the running server after the required restart.

End with: customer outcome by role; files grouped; checks/results and exact failures; state/flow checklist walked
versus not walked (including no card/invoices/fees, loading/error/success returns, past due, trial, all free-time states,
Founding, cancelled, non-owner URL and 390px); which Stripe returns changed and how checked; deviations/nearest shipped
components; owed `/simplify`, `/review`, `/docs` and owner walk; dev-server restart status; and remaining Part 3 work.
Do not claim all of Stage 1 complete. Do not commit or push.
