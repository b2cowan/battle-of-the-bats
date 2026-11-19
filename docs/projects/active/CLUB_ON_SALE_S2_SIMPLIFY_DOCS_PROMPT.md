# On-sale pages S2 — /simplify, then /docs (prompt for a fresh session)

**What this is.** S2 (the paid sign-up doors: Start a club, Start a league season with League Plus) is built on dev,
reviewed (`/review` high-risk, `/design`, `/billing`, `/legal`, `/accounting`) and **uncommitted**. The owner's walk is
https://claude.ai/artifact/CFPvhRJf9hCo9YTzbQBdDq (ledger §545). This session does two follow-ups and nothing else:
**1. `/simplify`** on S2's own code, **2. `/docs`** for the in-app help. Plan of record:
`docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md` (read the S2 "Built 2026-11-19" record first — it lists every file
and every decision; do not re-derive them).

## Rules (binding)
- Branch `dev` only. **No commit and no push without the owner's yes.** The tree holds other sessions' edits in
  shared files — touch only S2's hunks, stage explicit pathspecs only when the owner says commit.
- **No behavior change in /simplify.** Every word on these screens is ruled copy (`CLUB_ON_SALE_COPY.md`, the
  interest line, the noTrial line) — do not reword. If a cleanup would change what a visitor sees or which page they
  land on, it is not a cleanup: list it for the owner instead.
- `lib/plan-config.ts` stays **import-free** (the demo seed scripts load it with plain Node).
  `lib/start-door.ts` imports only `coaches-portal-routes` (client screens use it). `isPaidDoorOpen` lives in
  `lib/plan-gating-server.ts` on purpose (layouts stay light) — do not move it back into `start-plan-server.ts`.
- Help content ships to **production, where the three plans are still closed**. Nothing in a help article may say
  the doors are open, quote a trial length, or name a price as a fresh copy (prices point at
  `docs/agents/strategy/PLAN_PRICING_FACTS.md`). Write it true in both states, or gate it the way the screens are
  gated — and say which you chose.
- One spelling everywhere (`npm run check:spelling`): "Québec" with the accent; "Club · Association".

## Part 1 — /simplify (S2 scope only)
Scope = the S2 file list in the plan's S2 record (same list `/review` used). Places the review flagged as worth a look:
- `app/[orgSlug]/admin/onboarding/PaidPlanStep.tsx` sits beside Run a tournament's `PlanStep` rather than sharing
  its card / choice / terms pieces. Share what is genuinely the same; keep what differs (two cards, per-card
  monthly/yearly, the behalf sentence, trial-known button wording).
- `app/(consumer)/start/club/StartClubForm.tsx` and `.../league/StartLeaguePlusForm.tsx` are near-twins.
- `app/(consumer)/start/StartDoorForm.tsx` grew five per-door maps (`ACCOUNT_DOOR`, `DOOR_COPY`, `SIGNUP_ROUTE`,
  `pickConfirmedAfter`, `shownPickFor`) — one table per door may read better.
- `lib/start-plan-server.ts` `paidDoorRedirect` order is deliberate (staff → owned org → invitation → discover →
  club portal → coach billing); simplify only its shape, never its order.

After /simplify: run `node --import ./tests/ts-resolver.mjs --test tests/unit/on-sale-doors-s2.test.ts` plus the tests
the S2 record lists as updated, `npm run verify:changed`, and `npm run typecheck` (with
`NODE_OPTIONS=--max-old-space-size=8192`; `tests/unit/layout-run-journal.test.ts` is another session's known failure).
Then **`/review` re-review of the changed hunks only** (its "Re-review after a fix" section). If a file was added or
deleted, restart the dev server the AGENTS.md way before hand-off.

## Part 2 — /docs
What a user does differently (from the S2 record): a club or league buyer starts from the pricing page or `/start`,
makes an account (with the "outside Québec for now" line), names the organization, picks the plan, gives a billing
address, pays on Stripe, waits on "Setting up your club/league" and lands in that setup kit; backing out of Stripe
returns to the plan step; a signed-in owner is sent to their own organization; a Premium coach to their portal's
Start your club. The interest window's sentence changed. Find every help article that covers signing up, starting an
organization, choosing a plan, the trial, or Plan & billing (`lib/help-content/*.tsx` and the hub arrays in the
`help/page.tsx` shells, including `keywords` / `searchText`), and bring them in line under the production rule above.

## Hand-off
- Records: add one line to the plan's S2 record ("simplify + docs pass 2026-11-xx: …"). If /simplify changed nothing
  a visitor sees, the walk stands; if a walk step's wording no longer matches a screen, fix the step and re-publish
  the walk to the same link.
- Reply to the owner in product-owner voice: what changed for a reader of the help, what the cleanup touched (in one
  sentence), anything listed rather than done, and ask for his yes to commit S2 together with this pass.
