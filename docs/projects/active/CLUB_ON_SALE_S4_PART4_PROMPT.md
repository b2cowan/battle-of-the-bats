# Build prompt — On-sale pages S4, Part 4: the second-subscription alert, the onboarding words, the line — and S4's one walk

> Paste everything below the line into a new chat on `dev` (`/clear` first). Written 2026-11-22, after S4 Part 3 was
> committed (`e1ba46287`, owner "commit"). **Model: Opus** (a webhook change, an ops alert, the close of S4). Helpers read
> on Sonnet. Do not overlap a Plan & billing build session: check the board (`plan-billing`) and `git log` and say so in
> your first message.

---

You are building **Part 4 of 4 of S4 of the on-sale pages** for FieldLogicHQ: **call 45** (a second subscription that
slips through alerts the owner), **call 43** (the onboarding change-plan window's subtitle), **W71 under call 44** (the
/for-tournament-organizers line), and then **S4's one walk**, written once for the whole of S4. Parts 1 (`28df8d79b`),
2 (`dba4cd104`) and 3 (`e1ba46287`) are committed. This is the last build part of S4. The flip is the runbook's, not
this session's.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md`.
2. **The S4 build prompt, `docs/projects/active/CLUB_ON_SALE_S4_BUILD_PROMPT.md`, in full.** Its "Proofs", "Tests and
   checks", "Reviews", "Rules" and "The walk and the hand-back" sections apply unchanged. **Part 4 is its section "Part 4 —
   the second-subscription alert, the onboarding words, the line".**
3. The plan, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: S4, its "S4 drawing round" (calls 35–46, all ruled) and
   the **Part 1, Part 2 and Part 3 entries** under S4 (what they built, decided, recorded and carried to Part 4). Owner
   asks are ruled; do not re-open one.
4. The drawing, `docs/projects/active/CLUB_ON_SALE_S4_DRAWINGS.html`, **tabs 8 and 9** (the onboarding window, the
   /for-tournament-organizers line), desk and phone, both gate states, every numbered note; tab 10's calls 43–45. Tab 6's
   note 3 too (see "Carried" below).
5. The words: `docs/agents/brand/PRICING_PAGE_COPY.md`, its S3b section (W71) — the ruled line is there; check every
   claim in the call 43 subtitle against `docs/agents/strategy/PLAN_PRICING_FACTS.md`.

## What the code showed (leads — open each line before building on it)

- **The "second subscription ignored" branch** is `lib/billing-webhook-handler.ts` ~:537-541 (it moved: Part 3 added an
  ended-subscription guard just above it at ~:527-536). Today it is one `console.warn` and a `break`; the record keeps
  following the subscription on file (`recordFollowsSubscription`, asked of Stripe). That is the branch call 45 alerts
  from. The ended-subscription guard above it is NOT a stray second subscription (a late message for an ended one) —
  do not alert on it.
- **The ops-alert path:** `lib/observability/alerts.ts` (`maybeSendCriticalAlert`, a token bucket via `takeAlertToken`)
  and `lib/observability/capture.ts`. Find how ops alerts reach the owner today (the admin inbox is
  fieldlogichq@gmail.com only — memory) and whether the bucket could swallow a money alert behind unrelated errors; a
  stray subscription is a charge the owner must refund by hand, so it must not be rate-limited away. **If the alert
  means changing a watched automation path** (`WATCHED_PATHS` in `scripts/check-agent-automation.mjs`), stop and ask
  (AGENCY_RULES).
- **The webhook is replayed by Stripe.** The same event can arrive more than once, and `created` and `updated` both land
  in this arm, so one stray subscription can reach the branch several times. Decide how the owner gets ONE alert per
  stray subscription (a dedupe key on the subscription id, e.g. a `platform_events` row), and say what you chose.
- **Carried from Part 2:** two near-simultaneous first presses can each make a Stripe page, and a stray unfollowed
  subscription holds the "Setting up {plan}" wait until it is refunded. Call 45's alert is the catch for both; confirm
  the wait clears once staff refund and cancel the stray one, or record what the owner sees until then.
- **The onboarding change-plan window** (call 43): find it (the four plan cards; Part 1's start from it returns to Plan &
  billing's "Setting up {plan}" wait). Its subtitle reads the live gate per plan; the added sentence names only the open
  plans' clauses.
- **W71** (`/for-tournament-organizers`, the League Plus and Club cross-sells): each line shows only while its own plan
  is open; "Plan & billing" links through that plan's own start door (a signed-in owner lands on their Plan & billing,
  S2 trap D; a visitor signs in). The guard: a unit test fails if the League Plus line can render while
  `moveDirection('tournament_plus','league')` is null.

## Carried from Part 3 (decide each; say which you built and which you recorded)

1. **Tab 6 note 3 spacing:** "No billing action needed…" sits flush on "Change plan" on a free-time organization's Plan
   & billing. A spacing fix on S4's own screen; build it here (`/design` confirms).
2. **The webhook's log line** at ~:534 says "is not the subscription on file" even when the ended subscription IS the
   one on file. Wording only; fix it when you touch the file.
3. **Recorded, not Part 4's — leave them unless the owner says otherwise:** a replay after a grant lapses mid-retry; a
   fall-back onto a half-closed club does not un-suspend it; the renewals card does not tag a fallen-back club's open
   bill; the Terms draft 0.4 §9 sentence (`/legal`, owner); staff ending free time early while a cancel waits should warn
   and offer to email the owner (→ `/plan`).

## Owner calls — ask at the start, before code

Calls 43, 44 and 45 are ruled. Ask only what the code leaves open once you have read it, and say what the code does
first. Likely candidates, each with a recommendation:

1. **Where the alert goes and what it says** — the ruled call is "the owner is alerted and refunds by hand from our
   admin". If today's ops path is an email to the admin inbox, recommend that, plus a line on the organization's staff
   record (the support console) so the stray subscription can be found from the club, not only from the inbox. Name the
   organization, both subscription ids, the plan and the amount charged; no person's details beyond what the console
   already shows.
2. **Whether the alert also reaches the support console's "needs attention" list**, if one exists — recommend yes if
   it is already there for similar money states, no if it would be a new list.

## Build (in order) — the S4 build prompt's Part 4, steps 1–3

1. **Call 45:** the second-subscription branch raises the ops alert to the owner, once per stray subscription, naming
   the organization, both subscription ids and the charge. No automatic cancel or refund.
2. **Call 43:** the onboarding window keeps its four cards; while League Plus and/or Club is open its subtitle adds
   "Running more than tournaments? League Plus adds house league seasons, and Club adds rep teams and the club's books."
   (only the open plan's clause); today's sentence while both are closed.
3. **W71 (call 44, the ruled verb):** "Already running tournaments here? Start League Plus from Plan & billing. Your
   events, teams and staff stay where they are." (Club the same), each only while its plan is open; the guard test.
   Then record W71 as in code in `PRICING_PAGE_COPY.md`.
4. The carried items 1 and 2 above.

## Proofs (dev, Stripe TEST mode, throwaway organizations, teardown proved — the S4 prompt's "Proofs" rules)

- **Call 45:** on a throwaway organization paying in test mode, make a second subscription on the same customer
  through the test API; the signed webhook reaches the branch; the owner gets ONE alert (replay the event: still one);
  the record keeps the first subscription; staff cancel and refund the stray one by hand; the wait (if one showed)
  clears. Drive the webhook the way Part 3 did (signed delivery to the dev server; Part 3's probes are in `.probe/club-on-sale/s4p3/`).
- ⚠ **Staging (dev.fieldlogichq.ca) receives the same Stripe test events on the same dev database, running older code**
  until S4 reaches it. Part 3's proofs had to keep it out of the race. Do the same, and say how.
- S4's end-to-end proofs the build prompt lists that Parts 1–3 already ran need not be re-run; name which you rely on,
  with their evidence files (`club-on-sale-s4/after-p2/`, `after-p3/`).
- **Teardown:** every test customer and subscription you made, proved with `invoices.search` and per-customer lists
  (memory `reference_stripe_list_hides_test_clock_objects`); restore the fixtures you changed (record each first).

## Tests and checks

Unit: the alert fires from the second-subscription branch only (not from the ended-subscription guard, not for a
`mock_` subscription), once per stray subscription under a replay, with the four facts; the onboarding subtitle per
gate state (both closed, League Plus only, Club only, both open); W71 per gate state and its guard; a Premium coach's
Plan & billing unchanged. `npm run verify:changed` (other sessions' work fails parts of it — Part 3 saw failures in
possessive-guard, the support-console foot-note guard, billing-plus-tax-words, plan-ending-screens "End now … No refund"
and support-console-stage4b keepPremium, the last two failing on HEAD too; re-check before calling one yours),
`npm run typecheck` with `NODE_OPTIONS=--max-old-space-size=8192` (the type error in `layout-run-journal.test.ts` is
another session's), the spelling gate. Layout: `check-layout-invariants.mjs --only=<ids>` on the screens touched
(`--changed` widens to the whole product because other sessions touched `app/globals.css`; never sweep on the dev
server). ⚠ The `orgOwner` layout session has expired; refreshing it signs every other session out — ask the owner.
After-shots with the S4 capture script (`.probe/club-on-sale/s4/capture-s4.mjs`,
`--out=docs/projects/active/club-on-sale-s4/after-p4`): the onboarding window and /for-tournament-organizers, desk and
phone, both gate states; the free Tournament fixture (`free-owner@dev.local`) must tick the current Terms once first
(the owner may do it, or it is the walk's first step).

## Reviews before handing off (run them)

`/review` **high-risk** on Part 4 (the webhook and the alert); `/billing` (the alert's completeness, the stray
subscription's wait); `/accounting` (the alert's money: what a stray charge and its hand refund mean for our books and
tax); `/legal` (the alert carries no more of a person's information than needed); `/marketing` (every word as built);
`/design` (tabs 8, 9 and tab 6's note 3 against the build, both states, desk and phone, one lime per screen); **`/docs`**
— S4 changes what an owner does on Plan & billing (starts, the League Plus move, free time falling back): run it, not
offered, for the help articles on Plan & billing, plan changes, free time and cancelling.

## Rules

The S4 prompt's "Rules" section. Branch `dev`; explicit pathspecs; **no commit without the owner's yes**; the plan, the
board, the QA ledger, `PLAN_PRICING_FACTS.md`, `PRICING_PAGE_COPY.md` and `DATA_DICTIONARY.md` carry other sessions'
uncommitted edits — stage only your lines on HEAD (`git hash-object -w` + `git update-index --cacheinfo`, memory
`reference_partial_commit_shared_tree`). A migration (if the dedupe needs one) updates `DATA_DICTIONARY.md` and the
snapshots in the same unit and goes on `MANUAL_PROD_STEPS.json`. Production is read only as counts and schema, never a
person's row.

## The walk (S4's one walk, after the build and its reviews)

The S4 prompt's "The walk and the hand-back" section: **one** Artifact, 20–50 boxes, one action per step, ONE purpose —
"buying from inside the product" — entered in the Owner QA Ledger; owner calls never in the counter; exact logins as
listed there. It covers all four parts: the starts and the wait (Part 1), the League Plus move (Part 2), free time
falling back (Part 3 — its cancel window is seen only on a club that pays while on free time, so the walk makes one or
says it cannot), and Part 4's three. Things the reviews could not see and the walk must:

- Part 3's line under the table on a phone, below the fold (`/design` could not see past it).
- Staff End now on a free-time club through its own window (Part 3 could not prove it live: dev staff sign-in needs
  two-step; the walk uses `uat-platform@fieldlogichq.ca` with its authenticator, or the owner switches staff two-step off
  on dev for the walk).
- ⚠ **`dev-tplus-org` carries a stale suspension stamp with its status active and its site off** (older than Part 3).
  Check it before writing the free-time owner's steps; restore it to a clean free-time state, or pick another fixture,
  and record which.

## Hand-back

What each person sees differently across S4 (product-owner voice), how to see both gate states on dev (Dev tools ›
Plan gates › "Show as closed"), the proofs' results, the reviews' findings and what was applied, the walk's link, and
the owner steps: the walk; the production count of free-time organizations stored `canceled` (Part 3, a count only);
any production step Part 4 adds; S2's migration 508 (`start_plan`) still a promote condition. Records in the same pass
as the build prompt lists them (the plan's S4 stage, the board's `club-tier` line, `PRICING_PAGE_COPY.md`, the PM brief,
the Claude memory file `project_club_on_sale_pages.md`, help content via `/docs`).
