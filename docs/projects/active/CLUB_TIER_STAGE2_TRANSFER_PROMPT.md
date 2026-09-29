# Club Tier Stage 2 · session 2 — bringing a coach's own portal into the club (B04, Ask 2)

> Paste into a fresh session on `dev`. Written 2026-09-28, the day Stage 2 was **ratified** (hub v15).
> This session is independent of session 1 (`CLUB_TIER_STAGE2_SERVER_PROMPT.md`) and may run beside it.
> The one open billing question was ruled on 2026-09-28 (below), so it can start any time.
>
> **Read first:**
> - Plan `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
>   - §4B, row B04 and the "what the club owns vs reads" paragraph;
>   - §6 "Across every stage — formatting";
>   - §6 Stage 2's blockquotes.
> - Hub https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 2 → **specimen 9** (the spec
>   for the page) and the Decisions tab, **Ask 2**.
> - Memory: `project_club_tier_readiness` and `feedback_portal_is_the_formatting_benchmark`.
> - The facts doc `docs/agents/strategy/PLAN_PRICING_FACTS.md` sells this as the "coach bridge".

## The ruling (owner, 2026-09-28): finish it

- **The move carries every table the team owns,** the team's staff memberships included. A **build gate**
  keeps that list complete.
- **It completes itself once both sides say yes.** There is no FieldLogicHQ operator step. The operator
  step exists today only because the routine is incomplete.
- **The "Basic visibility" link retires** (B12). No club screen reads it, and today it exists only as a
  required first step before a transfer.
- **The club's page says what it's for, what it costs and what moves, before anyone agrees** (J4-034,
  J4-037). There are no internal words ("Phase 5A", "Platform override", "platform-assisted").

## The coach's own subscription: ruled (owner, 2026-09-28), no refund

> *"we don't need to refund them, they just don't need to get charged in the future, so we can leave it as
> cancel now with no refund, make sure the messaging doesn't mention refunds and focuses on how they will
> simply not get charged in the future"*

- **The behaviour is today's:** the coach's own subscription is cancelled the moment the move completes,
  with no refund and no proration (`lib/team-ownership-transfer.ts:200-217, 621`). A cancellation that
  fails is reported to the operator as it is today; the move itself still stands. A Founding Season coach
  has no subscription to cancel.
- **The words never mention a refund, a credit, proration or money back.** They say only that the coach
  **won't be charged again**. This covers every surface a coach or a club reads:
  - the club's request card (drawn: "Sam won't be charged for his own Coaches Portal again. It stops the
    moment the move completes.");
  - the coach's approval screen in their portal;
  - any confirmation or email the move sends;
  - the help article.
  The words are /marketing's to polish, within this rule.
- Log it with `/strategy` (a billing policy for adoption), and check that the Stripe side matches with
  `/billing`.

## What the code does today (verified 2026-09-25 to 09-28)

- **The completion RPC** (`supabase/migrations/067_team_ownership_transfer_rpc.sql:139-276`, called
  from `completeTeamOwnershipTransfer`, `lib/team-ownership-transfer.ts:529-665`) re-parents about 17
  tables. It was never revised.
  - It does **not** move `rep_team_staff_memberships`, the access truth since migration 245.
  - It also skips about 48 `rep_*` tables created since: attendance, lineups, awards,
    opponents/scouting, places, tryout rubric and scores, development, money in, announcements, tags, …
  - After a transfer the head coach is refused by every screen that checks membership.
- **Completion is platform-admin only.** It needs a typed confirmation of the coach's workspace org,
  checks the club's team cap (Club Repackaging) and that the club has Rep Teams, then:
  - cancels the coach's subscription;
  - suspends the workspace org's members;
  - writes the audit and platform events.
- **The club side:** `app/[orgSlug]/admin/org/coaches-portal-links/page.tsx`, reached from Organization →
  "Coaches portal links".
  - It has five sections: invite by slug or email, needs review, awaiting coach, ownership transfer,
    link history.
  - The approve/invite buttons are "Invite Ownership Transfer" and "Approve Ownership".
- **The coach side:** `app/api/coaches/[orgSlug]/team-links/route.ts`, plus whatever portal screen calls
  it. Find it and read it.
- **Billing actions on the link API** are retired: 410 "Org billing transfer has been retired. Teams in a
  Club are included up to the plan cap."
- **S2-01** (fixed in session 1): after an adoption, the coach's closed-season page must offer no season
  doors, because the club holds them.

## What to build

1. **The RPC rewrite, as one new migration.** Never edit 067.
   - Re-parent **every** table that carries the team's org, `rep_team_staff_memberships` included, and
     the membership rows the club side needs.
   - Decide the table list from the **live schema** (the dev and prod snapshots / `information_schema`),
     never from migration files (AGENCY_RULES: the schema is the dictionary).
   - Keep it atomic. A failure leaves both orgs exactly as they were.
   - Update the data dictionary in the same change, and run `refresh:snapshots`.
2. **The coverage gate.** A unit test fails the build when the set of `rep_*` tables that carry `org_id`
   in the schema snapshot differs from the set the RPC re-parents (or explicitly and reasonedly excludes,
   in a list in the test). This is the gate the plan names; it is what stops a table added next year
   from being left behind silently. **Break it on purpose once** and see it report the missing table by
   name.
3. **Self-completion.** When the second side approves, the move completes.
   - Keep today's safety: a typed confirmation from the approving side, the team-cap and plan checks,
     idempotency (a double click never moves twice), and the audit and platform events.
   - The operator page keeps a read-only record, not a button.
4. **Retire the basic link.**
   - A transfer no longer needs one first (`Create the Basic visibility link before requesting ownership
     transfer.` goes).
   - The link API stops creating basic links, and gains the plan/module gate if session 1 hasn't landed
     it (B12).
   - Existing link rows stay as history.
5. **The club's page, built to specimen 9 and the formatting benchmark.**
   - **Name.** It is drawn as "Bring in a coach's team" under **Rep Teams**, not Organization. The name
     is `/marketing`'s; draft it, and use the drawn one until they rule.
   - **The first line** says what the page is for and points a new coach to "Invite a coach" on the
     team's Coaches page.
   - **The request form** is the coach's email → "Send request".
   - **Each waiting request** shows three things before the Approve / Decline buttons:
     - what it costs the club: "included in your Club plan", with the team-place readout "10 of 15
       after", and Stage 1's team-cap window at the cap;
     - what happens to the coach's own plan: they **won't be charged again** (the ruling above; no word about refunds);
     - what moves, in plain words.
     And: "can't be undone".
   - Follow the portal's page header and section rules, and use no tinted panels (§6 "Across every
     stage — formatting").
   - **The coach's side:** their portal screen shows the club's request and their approval in the same
     plain words. Restyle only what the words need.
6. **The smoke test** that exists for the transfer does not check that post-M1 tables moved. Extend it to
   walk a transferred team as its head coach, opening Overview, Roster, Money, Practices and Staff.

## Not in this session

- Anything in session 1's list.
- Club screens other than this page.
- The public site.
- Pricing copy (placement only, the words go to `/marketing`).

## Gates

- `/dba` reviews the migration. `/review` runs at the **high-risk** tier (money, data movement, auth).
- The coverage gate is mutation-proven. Stripe runs in the sandbox, per the ruling above.
- `verify:changed`, `typecheck`, `check:dictionary`, and the targeted unit files.
- The migration is **prod-owed**. Record it in the plan and the release notes' owed list. It goes on
  **before** the release that ships the page.

## Hand-off

- An owner-voice summary.
- The walk steps for session 3's walk list: a coach's own team brought into the test club, then opened
  as its head coach. The fixture needs a standalone coach workspace to adopt; see
  `seed-uat-standalone-coach.mjs`.
- The plan §6 Stage 2 record and memory.
- **Commit only when the owner says**, from a private index.
