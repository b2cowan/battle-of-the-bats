# Coach Experience — Step-by-Step Test Script

**Companion to:** [COACH_EXPERIENCE_WALKTHROUGH_PLAN.md](COACH_EXPERIENCE_WALKTHROUGH_PLAN.md)
**Where you test:** `https://dev.fieldlogichq.ca` (Amplify dev branch — real emails fire)
**Created:** 2026-06-15

---

## Accounts & fixtures

| Role | Account | Use |
|---|---|---|
| **Coach** (primary lens) | `b2cowan@outlook.com` | Register, portal, free tier, upgrade. **Clean slate** as of 2026-06-15 — no account, no teams. |
| **Organizer** (interaction partner) | `owner@dev.local` | Approve registration, set/record fees, publish schedule, send emails. Owns `dev-test-org`. |

**Tournament:** `dev-test-org` → **Battle of the Bats 2026** (`dev-tournament-2026`) — register into the **U13** division (cap 12, 7 open slots). Deposit **$100** / total **$500**, due **Jul 10**. Email toggles ON. Dates Jul 15–17 (future) → exercises the pending→prep phases cleanly.
- *Alt:* Purple Classic (`branded-dark`) U13 also works if you prefer the one you used before.

**Coach register URL:** `https://dev.fieldlogichq.ca/dev-test-org/dev-tournament-2026/register`

**Before you start:** confirm the fix commit `f084585` is live on the dev branch (Amplify build finished). Use an **InPrivate window** for the coach so you're genuinely signed-out.

---

## How to use this script
- ✅ = pass / as-expected. ✏️ = friction/confusion/idea to capture. 🐞 = bug.
- For each step: do the action, then jot ✅/✏️/🐞 against each checkpoint. Bring the notes back here and we'll decide fix-now / defer / route.
- When an action needs the organizer, the step says **[switch to owner@dev.local]** — do it in a separate normal (non-InPrivate) browser/profile so the two sessions don't collide.

---

## STEP 1 — Register for the tournament

**Act as:** signed-out coach (InPrivate), `b2cowan@outlook.com`.

1. Open the register URL. Pick **U13**. Fill team name (e.g. "Milton Thunder"), First/Last, email, and a password (min 8).
2. Submit.

**Checkpoints**
- [ ] Form is low-friction; division availability + fee schedule ($100/$500) are clear.
- [ ] It's clear that registering also **creates your account** (the password field's framing).
- [ ] Mobile layout is clean (narrow the window or use a phone).
- [ ] Success screen appears ("You're In Motion" / "Registration Submitted") with a clear next step / "Open Coaches Portal" button.
- [ ] No errors; no duplicate-team weirdness.

---

## STEP 2 — Registration → portal (the FIX verification)

**Act as:** signed-out coach (InPrivate). This is where the just-shipped fix is proven.

1. Check your **inbox** for the registration confirmation email.
2. **Verify Layer A:** the email's primary CTA now reads **"Open your Coaches Portal →"** (not "Create Account & Track Registration"), and the copy says your account "is ready."
3. **Click that CTA** (still signed-out / InPrivate).
4. **Verify Layer B:** you should land on **"You're Already Set Up — Sign in to your Coaches Portal"** showing your team name — **NOT** a second First/Last/Password form.
5. Click **"Sign in to your Coaches Portal"**, enter your password.
6. You should land on `/coaches/tournaments` (or your team record) with the team visible.

**Checkpoints**
- [ ] 🎯 Email CTA = "Open your Coaches Portal" (Layer A).
- [ ] 🎯 Clicking it signed-out shows the **"You're Already Set Up → Sign in"** state, not a redundant signup form (Layer B — the bug we fixed).
- [ ] Team name is shown on that screen.
- [ ] Sign-in lands you in the portal with the team present; **you never re-entered name/password**.
- [ ] (Optional) Click "Create a new account" escape hatch — confirms it still falls back to the signup form if needed.
- [ ] Also try the success-screen "Open Coaches Portal" button (from Step 1) — confirm it reaches the portal too.

---

## STEP 3 — Portal while registration is PENDING

**Act as:** coach (now signed in). Organizer has **not** approved yet.

1. Open the team record in the portal (`/coaches/tournaments/{team}`).
2. Explore everything on the pending screen.

**Checkpoints — "Am I impressed? Do I understand what's happening and what's next?"**
- [ ] Status pill clearly says **Pending / Awaiting decision**.
- [ ] Checklist HUD shows **Registered ✓ · Awaiting decision** (and nothing misleading).
- [ ] **Pending fee preview** shows ("fee due if accepted: $X" — your tournament has $100/$500).
- [ ] **Contact-the-organizer** bridge is present (if a contact email is configured).
- [ ] **Head-coach editor** is available (you can set/change head coach name + optional contact email).
- [ ] No broken/empty sections; no schedule shown (correct — not accepted yet).
- [ ] First impression: does it feel trustworthy and clear, or sparse/confusing? (note ✏️)

---

## STEP 4 — Organizer accepts; portal after COMPLETE

**Part A — [switch to owner@dev.local]** (normal browser):
1. Go to the tournament admin → **Teams / Registrations**.
2. Find your pending team → **Accept** it.
3. (Optional but recommended) Set/confirm the **fee** and add **payment instructions**.

**Part B — back to the coach (InPrivate):**
4. Refresh the team record.

**Checkpoints — "Is it easy to understand my options / next steps?"**
- [ ] Status flips to **Accepted**; hero shows "You're in!" + a **countdown** to first game.
- [ ] Checklist HUD updates (Registered ✓ · Accepted ✓ · Fee Owed/Paid · Roster).
- [ ] **Fee status block** shows amount owed, due date (Jul 10), and any payment instructions.
- [ ] **Roster submit** card appears if the organizer requires a roster.
- [ ] Head-coach assignment still editable.
- [ ] (Optional) **Publish the schedule** as organizer to exercise schedule_live → game_day phases; confirm the coach's live schedule bridge / opponents appear. *(Future dates mean we may need to publish or date-shift — flag it and we'll decide.)*

---

## STEP 5 — Notification emails along the way

**Act as:** organizer triggers each; coach reads the inbox. (Emails fire on dev because RESEND is configured there.)

Trigger and check each:
- [ ] **Registration confirmation** (from Step 1) — clear, correct CTA (already checked in Step 2).
- [ ] **Acceptance** email (from Step 4 accept) — clear, includes payment instructions if set, portal/claim link works.
- [ ] **Payment recorded** — [owner] mark the fee paid → coach gets a payment-confirmation email.
- [ ] **Schedule published** — [owner] publish schedule → coach gets the schedule-published email.
- [ ] **Game-day reminder** — fires the evening before first game (scheduled; may not be live-testable on future dates — note it).
- [ ] **Rejection** (optional) — register a throwaway team and [owner] reject it → confirm the soft "contact organizer" email.

**Checkpoints — "Do they arrive? Is the required action clear and low-friction? Do the links work?"**
- [ ] Each email lands (check spam on first).
- [ ] The required action (pay / view schedule / etc.) is obvious and one-tap.
- [ ] Every portal link resolves correctly (and, post-fix, never dumps you into a redundant signup).
- [ ] Tone/branding is right (from `@fieldlogichq.ca`, not the `onboarding@resend.dev` fallback).

---

## STEP 6 — Free coaches tier: manage a team

**Act as:** coach (signed in). Create/operate a **standalone** free team (no tournament).

1. From the portal hub or `/start/team`, create a standalone team.
2. Build it out: **roster**, **basic schedule**, **manual fee ledger**, **announcements**, **Team HQ stat strip**.
3. Hit the **scope-ceiling** express-interest CTA (Premium features).

**Checkpoints — "What features do I have? Easy to navigate? Do I understand free vs premium?"**
- [ ] Roster: add several players (watch for single-add friction — known J2-016).
- [ ] Schedule: add practices/games (watch ordering + hidden opponent field — J2-017/J2-021).
- [ ] Fees: add a charge across players (single-add friction — J2-022).
- [ ] Announcements: send to roster contacts (confirm/recipient-preview — J2-018).
- [ ] Team HQ stat strip reads correctly.
- [ ] Free vs Premium boundary is honest and clear; scope-ceiling CTA is express-interest (no fake checkout).

---

## STEP 7 — Upgrade to Premium

**Act as:** coach. (Premium `team` plan is gated → express-interest, not live checkout — see plan; we'll decide whether to seed/flip to walk the real surface.)

**Checkpoints — "Do I get proper info about what unlocks?"**
- [ ] Upgrade / scope-ceiling CTA clearly communicates what Premium adds.
- [ ] The free→premium story is motivating and honest.
- [ ] (Decision point) To walk the actual premium feature surface in Step 8, we provision a `team_workspace` for the coach or temporarily flip gates.

---

## STEP 8 — Full Premium experience

**Act as:** coach in a Premium `team_workspace` assigned to a rep team (seeded if needed).

Walk `/{orgSlug}/coaches/*`:
- [ ] Dashboard / team overview + setup checklist.
- [ ] Rep roster; power-calendar/schedule (lineups, attendance, recurrence).
- [ ] Accounting: budget, budget-vs-actual, expenses, fundraisers, dues, payment-requests, allocations.
- [ ] Documents; history; link-org.

**Checkpoints — "What features, how easy to understand/navigate?"**
- [ ] Premium-vs-free is clear from inside.
- [ ] Watch known items: BvA empty state (J2-037), dues/accounting copy (J2-033/34/35), no onboarding email on coach assignment (J2-025).

---

## After each step
Bring your ✅/✏️/🐞 notes back. I'll log each into the **Findings backlog** in the plan with a decision (fix-now / defer / route to a J-id), and — since we're building as we go — build the agreed fixes on local for you to push to dev and re-test.
