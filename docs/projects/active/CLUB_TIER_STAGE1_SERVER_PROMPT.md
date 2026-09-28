# Club Tier Readiness — Stage 1, session 1 of 2: behind the screens (roles, members, invites, billing)

> Paste into a fresh session on `dev`: *"execute @docs/projects/active/CLUB_TIER_STAGE1_SERVER_PROMPT.md"*.
> Written 2026-09-25 when the owner split Stage 1 in two (*"I agree"*). This session builds the half of
> Stage 1 that does not depend on the new admin frame, and runs **beside** the Admin Design Continuity
> foundation. Session 2, `CLUB_TIER_STAGE1_SCREENS_PROMPT.md`, builds the club screens on top of this work,
> behind the foundation's switch. Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (§4A/§4B/§4H
> rows with code anchors, §5 rulings, §6 Stage 1 + 1b, §8 gates, §11 register). Hub (the spec, build to
> **v8 or later**): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
> https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9, Stage 1 specimens 1–12 and their tag notes. Rulings and
> asks: the Decisions tab, and `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-09-25 entries: D6, D7,
> paid→paid moves, the Club trial takes a card). Memory: `project_club_tier_readiness`.

## Stop first

- **Stage 0 is committed and walked** (§238 passed 2026-09-25, `adfb9d5f`). Build on it; read its three
  commits (`a227fd64`, `47455d77`, `00466e4c`) before editing their files.
- ⚠ **Another session has uncommitted billing work** (the cancellation-retention project:
  `app/api/billing/webhook/route.ts`, `app/api/billing/cancel/confirm/route.ts`, `lib/billing-retention.ts`,
  `lib/email.ts`, the platform-admin cancel route and the billing page, at the time of writing). Before
  touching any file, check it for changes that are not yours. **Never overwrite, restore or check out
  another session's work.** If Part 3 needs a file that is mid-edit elsewhere, build everything else, then
  stop and tell the owner which file is blocked.

## Sharing the dev server

This session runs **after** the foundation's slice 0 (the baseline), and beside its slice 1. The slices
sweep and screenshot every admin screen on the same dev server, and your edits recompile pages under
them. So **ask the owner for a quiet window before any dev-server restart, any UAT suite run or anything
that drives many pages**. Batch restart-required changes and restart once near handoff. Say in the handoff
which admin screens now look different (the D8 role defaults change what an admin's sidebar and hub show),
so the foundation's identity check can attribute the difference to this session.

## The rule this session lives by

**Everything here reaches production on the next promote, while today's screens are still in use.** So
each change must be safe with today's screens: add to responses rather than reshape them, keep old
callers working, and never ship a control that today's UI cannot reach. Club itself stays unpurchasable
(gates stay `early_access` until Stage 8), which is why shipping ahead of the screens is safe. The
exceptions are pages **outside the admin frame**, which this session builds in full: the coaches portal's
plan-check wall, the invite and accept pages, and the "your access is paused" page. They already live in
themed shells (the coaches portal; the consumer app under `app/(consumer)/`), so they do not wait for the
foundation.

## Rulings that govern it

- **D6** no Founding Season offer for Club · **D7** Club · Association purchasable with proration ·
  **D8** admin gets every plan module by default (Families stays an explicit grant; never `billing` /
  `org_settings`); "tournament-only" is decided from the PLAN · **D10** the coach invite door is Stage 2.
- **Asks 1–6 (accepted as drawn):**
  1. Treasurer read = team names and program years **inside Accounting**, with no Rep Teams grant.
  2. League roles are offered only when the club runs a house league.
  3. (the phone bar, which is the foundation's)
  4. Paid→paid moves: up now, prorated with a preview; down at the next renewal, no credit, refused while
     active teams exceed the smaller band. No second trial.
  5. The Club trial takes a card, and every surface says so in one sentence (`/marketing` writes it).
  6. Coaching staff leave the Members board table.

## Order of work (`/review` at the end of each part; commit only when the owner says)

**Part 1 — Who can open what.**
- Role defaults per D8, plus the **role-defaults guard** (plan §8). Rewrite `plan-gating.spec.ts:162` (it
  codifies A01).
- The treasurer's Accounting-gated read of team names and program years for the allocate wizard,
  allocations and payment requests (C03). This is the Stage 0 probe's empty wizard list, a 403 that was
  swallowed.
- "Tournament-only" decided from the plan, in one helper the hub will call. Delete the onboarding bounce
  for non-owners (J10-014, the loop).
- Stop the non-owner 403 on every page load from the tournament worklist count (Stage 0 probe): don't ask
  when the person has no tournament access.
- **B05 wall, built in full:** the coaches portal checks the club's plan server-side before a portal screen
  mounts and shows a plan-worded wall (the `CoachNotGranted` idea; the owner sees "See plans"). Fail closed.
- **The morning brief's four counts** as one access-filtered read: tryout applications waiting, coach
  payment requests, installments due in 14 days, and assistant coaches awaiting approval. Counts only, no
  money (C04). Session 2's hub renders it.
- ⚠ Before shipping D8, ask the owner for a read-only production count of organizations whose admins would
  gain modules, and name them in the handoff.

**Part 2 — Members and invites.**
- **"What they can open"** is ONE shared computation (role defaults + plan + overrides), used by the
  server's own gate, so a screen and the gate can never disagree. Unit-tested.
- The role change accepts the board roles (treasurer, and league roles only when the club runs a house
  league, per Ask 2). It **never demotes silently**: an unknown role is refused. Role changes respect the seat
  limit. Owner-only powers are never grantable.
- The members read adds a section per row (board / scorekeepers / coaching staff), **additively**, so
  today's Members screen keeps working. The board endpoints refuse coach-role rows: those are managed on
  the team's staff page, and removing one from the board list today also drops coaching assignments (S1-03).
- **Membership policy (A03):** coach-role, pending and suspended rows never count as "belongs to another
  organization", on invite, accept and reinstate. Guard-tested. The head-coach promotion path lands
  somewhere real.
- Invites:
  - the resend email carries the right role label (J10-005);
  - invited-status members do not pass the admin gate (J10-006);
  - the invite link carries organization, role and inviter (J10-010);
  - accept reads the join's answer and retries **only the join** on failure (J10-007, A13);
  - accept lands through the destination resolver (J10-011);
  - an expired link offers "Set a password" through the existing reset flow (J10-008).
  - **The invitee's pages are built in full here** to Stage 1 specimen 6 (pending card, accept, expired).
- Suspend: a suspended member signing in reaches a "your access is paused" page, not a login loop
  (J10-019). A member whose access changed gets an email listing what changed (J10-020).

**Part 3 — Billing and buying (1b), the server half.**
- **D6:** the signup comp is plan-scoped, and an operator's move to Club revokes it. No Founding Season
  offer is ever computed for a Club.
- **A07:** reactivation restores everything cancellation took (the public site, archived tournaments,
  retention intent; the retention emails stop). Coordinate with the cancellation-retention session's files.
- **A10:** one gating source, read by billing, checkout and onboarding.
- **A06:** checkout refuses when a live subscription exists and points to the move instead.
- **The move (Ask 4):**
  - Club → Club · Association, and Tournament Plus → Club, is a change to the ONE subscription.
  - A proration preview is available before confirming.
  - A move down is scheduled for the next renewal, with no credit, and refused while active teams exceed
    the smaller band.
  - There is no second trial.
- The team-cap refusal returns a structured "you can move up" answer that Session 2's screen will offer in
  place.
- The webhook applies the plan and clears a stale custom team limit on a band change. The platform-admin
  plan change applies the Club trial (H02).
- **Verify in the Stripe sandbox, end to end, by API:** `club` and `club_large`, monthly and annual,
  including up, down, refused-down and the preview. Gates stay `early_access`.

**Part 4 — Settings and the checklist, the server half.**
- The public-site master switch and the directory flag, honestly separated (A09): the directory flag
  greys while the site is off, and turning the site off takes down only what goes offline today.
- Venue saves return their refusal reasons (A14).
- The club setup checklist's five steps plus Families (A11), computed server-side with the done-conditions
  in specimen 10's notes, and routing a Club owner there on first sign-in.
- The audit log is already fixed by Stage 0. Confirm it; its screen is Session 2's.

**Part 5 — Tests and handoff.**
- Guards and tests: role defaults; the membership policy; the "what they can open" computation; checkout
  refusal with a live subscription; the webhook band change; the plan-check wall; the proration and
  refused-down paths.
- No owner walk in this session: the walks (§B shell, §B2 buying) come with Session 2's screens. List in
  the handoff exactly what Session 2 can call: each read, each refusal shape, and the checklist computation.
- Plan §6 Stage 1 checkboxes and the §4 ledger rows closed (with commit anchors). Memory
  `project_club_tier_readiness`. Handoff in product-owner voice; offer `/review`.

## Do not

- Restyle or redesign any admin screen or the admin frame (the foundation and Session 2 own them).
- Change a response shape today's screens read. Add fields; don't move or rename them.
- Widen a route's role list to make a button work. Hide the button from the roles the route refuses.
- Flip a plan gate, publish a price, or write customer words (`/marketing` writes the trial sentence;
  build with the drawn words and list them).
- Build the Coach row, the coach invite door, team-level changes (Stage 2), money figures (Stage 3) or
  notification rows (S1-04).
- `git add -A`, restore a shared file, or commit without the owner's word.
