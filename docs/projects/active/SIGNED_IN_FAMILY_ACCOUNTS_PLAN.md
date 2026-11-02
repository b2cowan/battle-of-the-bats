# Signed-in family accounts — Implementation Plan

**Status:** Planned, nothing built (owner rulings 2026-10-31).
**Decision of record:** `docs/agents/strategy/BUSINESS_DECISIONS.md` — 2026-10-31 "A family gets an account when their child
is PLACED ON A TEAM…" (amends 2026-10-29 "The end state is an app where everyone signs in").
**PM brief:** `SIGNED_IN_FAMILY_ACCOUNTS_PM_BRIEF.md`
**Inputs:** the census `SIGNED_IN_FAMILY_CENSUS.md` (every door, with its `path:line`) · the findings page
https://claude.ai/artifact/89YK6LSVhBxPnzFnrRZtpo · the journeys page https://claude.ai/artifact/QmPoKvcyF3Bg1xpjCWw54C
(source `SIGNED_IN_FAMILY_JOURNEYS.html`: who gets an account when, each journey after these fixes and in the end state).

## The rule this plan builds

An account arrives when there is something in it for the person:

| Who | Account | When |
|---|---|---|
| House-league parent | yes | when the child is **placed on a team** — the placement email is the invitation |
| Rep parent | yes | when the child is on the roster (the existing guardian invite) |
| Tournament coach | yes | at registration (already built; unchanged) |
| House-league volunteer coach | yes | at the coach invite (already built) |
| Tournament parent, fan | never needed | optional, only so follows and alerts carry across devices |
| Tryout volunteer scorer | never | the 48-hour scoring link stays |

**Sent links that stay:** the family's "Your sign-up" pay link (hardened), the family unsubscribe link, a tournament team's
pay link, the tryout scoring link. **No other link is ever sent to a family.** RSVP is answered in the app; a calendar feed is
made inside the app.

## Stages, in dependency order

Sequenced by dependency and rework risk, not by date. Each stage that changes what someone sees is **drawn first**
(an HTML drawings page through `/design`, owner asks answered) and built to the approved drawing.

### Stage 1 — Harden the "Your sign-up" door (house league) · no prerequisite

> **Built 2026-11-01.** Session 1 (Parts 1–4) committed `d79603110` (mig 419, dev only). Session 2 (Parts 5–8) built
> 2026-11-01, walk §437 PASSED 17/17, committed `0e8294ddf` 2026-11-01, no new migration. Before the promote that carries
> Stage 1: mig 419 to prod, UNSUBSCRIBE_SECRET confirmed in Amplify, prod's customised family templates checked. What shipped, and the differences from the items below (no
> separate family secret; a second address leak in the pay block masked; marketing sends refused without the unsubscribe
> secret): the build prompt's ▶ Progress block, `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md`.

The status / pay / withdraw page (census F3, F4, F5) becomes the permanent pre-team door.

1. **One name.** Every house-league family email carries one button, "Your sign-up", in place of "Check your registration",
   "Pay now" and "View your receipt" (`lib/email.ts:907-911`, `lib/house-league-placement-mail.ts:42-44` and the other senders
   listed in census F4).
2. **First names only** on the page opened by the link.
3. **The link ends when the season ends.** Today it is an HMAC over the registration id, never stored, never expiring
   (`lib/league-pay-link.ts:2,24,64`). Ending it and resetting it one family at a time needs **per-registration state** — a
   stored hashed token (the `lib/no-login-token.ts` pattern) or a version number folded into the HMAC. **A migration:**
   dictionary + snapshots in the same unit of work. The tournament team pay link (N2) shares the secret today; separate them
   so a reset never touches a tournament.
4. **The club can reset one family's link** from the registration (a new link is emailed; the old one stops).
5. **No pay button when nothing is owed** — the placement email and the moved-team email stop sending a pay link to a family
   that owes nothing (census F4: "sent even when nothing is owed").
6. **"Email me my link"** replaces the email + 8-character reference lookup (`status-lookup/route.ts:37`, match :84). The
   family types their email; if a sign-up exists the link goes **to that inbox only**; the screen says the same thing either
   way (no "no such email" disclosure). The reference stays on every email as a number to quote to the club; it unlocks
   nothing. The withdraw request (F5) accepts the link only, no longer the code (:40).
7. **Unsubscribe secret fix** (census §6): `lib/unsubscribe-token.ts:13-20` refuses to sign or verify without the secret
   instead of falling back to a fixed string. Confirm the secret is set on production before the release that carries it.

Draw first: the "Your sign-up" page with first names, "Email me my link", the expired-link screen, the club's Reset link door.

**Drawn 2026-11-01** (through `/design`, round 2 applied): source `SIGNED_IN_FAMILY_STAGE1_DRAWINGS.html`, page
https://claude.ai/artifact/P1FrRZ9cyLU1oCUpptCEim.

**Ruled 2026-11-01 (owner, all seven asks A).** Where these differ from items 3–5 above, these win; build to the drawing.
1. **When a link stops:** 30 days after the season is finished (`finished_at`; `season_end_date` is informational and
   nullable), but a family still owing keeps theirs until paid.
2. **Button words:** "Your sign-up" on every email, including the ones asking for money.
3. **Which emails carry the button:** the sign-up confirmation always; every later email only when money is owed.
4. **The club's door:** its own row, "Send a new link", for anyone who can change registrations.
5. **Two ended screens:** "season has finished" with no form; "no longer works" with "Email me my link" right there.
6. **A reset covers the whole sign-up:** it stops every link on that sign-up and sends one new one (the token page shows every
   child sharing `signup_ref` + guardian email, `signupRowsForLink`, so the per-link state in item 3 hangs on the sign-up,
   not one registration — item 4's "one family's link" means the whole sign-up).
7. **Emails keep full names** (first names only applies to the page the link opens).

**Build prompt:** `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md` (two sessions). It recommends folding a per-registration version
into the existing signed link instead of a stored token, which also makes item 3's "separate the secrets" unnecessary (a reset
never rotates the secret).

### Stage 2 — Tournament registration tidy-up · no prerequisite

Coaches keep their account at registration (unchanged). What changes:

1. **One email, not two**, for a coach whose registration also makes their account (today: a registration email and
   "Your free FieldLogicHQ Coaches Portal account is ready", `lib/email.ts:333`).
2. **An honest finish screen** — it no longer offers to create the account the coach has just made
   (`components/public/RegisterContent.tsx`, the "Create a Password" step).
3. **No email address inside portal links.**
4. **A throttle on the form** (`app/api/register/route.ts:221`), reusing `lib/public-form-throttle.ts`.
5. **Delete the dormant tournament-team claim link** (census N4: `app/coaches/claim/[token]/page.tsx`, the dev seed route
   `app/api/dev/seed/team-claim/route.ts`, its token code). Grep for the table/column; dropping a column is a migration with
   dictionary + snapshots.

Re-verify items 1–3 against the code when the stage starts: they come from the 2026-10-31 trace, not a fresh read.

Draw first: the finish screen and the one email. **Drawing prompt written 2026-11-01:** `SIGNED_IN_FAMILY_STAGE2_DRAWING_PROMPT.md`.

**Drawing page /design round 2 applied 2026-11-01** (version 2 of the same page; visual fidelity and two "Watch your email"
sentences that were false in some cases; no ask changed). The rulings below were made on version 1.

**The code evidence behind the corrections below (2026-11-01 re-verify, for the build):**
- Item 1: the "Confirm your email" email is ours (`lib/signup-verification.ts:67`, "Confirm your FieldLogicHQ email",
  sent via our mailer, production only via `shouldRequireEmailVerification`), not Supabase's. The registration email fires
  from `/api/register` (`route.ts:641-659`) BEFORE the account exists: the form posts the registration signed out
  (`RegisterContent.tsx:697`), then calls `/api/auth/coach-signup` (:699), deliberately organizer-first. So the merge must
  keep that order and send the coach's ONE email after the account step (or make the account inside `/api/register`).
  "Your free FieldLogicHQ Coaches Portal account is ready" (`lib/email.ts:333`) is hard-coded for EVERY coach (signed-in
  coaches and managers too), not just new ones. Two cases stay at two emails: a platform-admin-customised registration
  template (no place for the panel) and the organizer's coach-confirmation switch off (only the confirm email goes).
- Item 2: the finish screen already carries the check-your-email block (`RegisterContent.tsx:1509-1520`). What is wrong is
  the primary "Create Coaches Portal Account" (:1585-1587, which dead-ends at "Confirm your email before signing in") and
  the "Create your Coaches Portal · Set a password" row (:1570-1580). A signed-in coach never sees the screen (redirect to
  the portal, :854-859); invite-only events have no form. A new coach cannot sign in unconfirmed (`lib/auth.ts:48`); the
  registration stands regardless.
- Item 3: the address rides in EVERY tournament coach email's portal link (`coachPortalUrl`, `lib/email.ts:227`, ~12
  callers incl. game-day reminders and schedule publish), the confirm link's nested return (`registrationPortalPath`,
  `RegisterContent.tsx:252-258`) and the join page's own hand-offs. On `/coaches/join` it is load-bearing: it gates the
  signed-out "You're already set up" answer (`/api/coaches/registration-account-status` returns only on a match) and names
  the invited address on the wrong-account screen. Hence ask 2.
- Item 4: confirmed no throttle. A 429 renders in the existing "Registration Failed" card with no client change
  (`RegisterContent.tsx:651-662`, :1329-1336). The family buckets' global ceiling (150 / 5 min) is shared across every public
  form, hence ask 4.
- Item 5: **no migration.** `team_workspace_claims` stays: `lib/chat-resolvers.ts:126` reads it for Tournament Chat and no
  FK points at it. Redemption lives in team checkout (`app/api/billing/create-team-checkout/route.ts:65-90`,
  `lib/team-checkout.ts`), so the claim branch goes there too, plus `app/team/claim/[token]` and the dev-tools card.
- Found in passing (ask 5): the team pay page pre-fills the coach's FULL email for the receipt (`lib/team-pay-view.ts:156`),
  while Stage 1 masked the family page's (`lib/league-pay-view.ts:163`). Payment already stops once the tournament is over
  (`lib/team-pay-refusal.ts`), and the portal already has Pay now; only a per-team reset is missing.
- Help for the build's `/docs` step: `lib/help-content/tournaments.tsx` `faq-new-coach-confirm-email` (:735-742) and
  `lib/help-content/coaches.tsx` `faq-coach-confirm-email` (:216-227). No demo moment or tour stop is affected.

**Drawn 2026-11-01** (page https://claude.ai/artifact/LcsxtXG1eQ5HRwEPqLp9CV, source `SIGNED_IN_FAMILY_STAGE2_DRAWINGS.html`).

**Ruled 2026-11-01 (owner, all five asks A).** Where these differ from items 1–5 above, these win; build to the drawing.
1. **The one email leads with the registration** ("We've got your registration"); the confirm panel sits where the portal panel
   is today. A coach who already has an account gets the same email with "Open your Coaches Portal" instead; the waitlist email
   gets the same panel.
2. **Nothing replaces the address in portal links;** the join page asks for the email first. This applies to every coach email
   that links to the portal (registration, waitlist, accepted, schedule, reminders, the organizer's invitation), not only the
   registration email.
3. **The finish screen keeps "You're In Motion";** the confirm block leads, with a quiet "Already confirmed? Sign in"; no big
   button.
4. **The form has its own limits,** the same numbers and the same words as the family forms.
5. **The team pay link:** mask the coach's address on the team pay page in this stage, **after the Stage 7 walk passes**; no
   reset (no "Send a new link" for a team).

**Corrections to the plan, from the drawing session's reading of the code.** (a) Item 5 needs **no migration**: the table of past
claims stays because Tournament Chat reads it to work out which coaches are in a tournament's chat; only the claim page, its
address, the developer tool and its seed, and the claim branch inside team checkout go. (b) Item 1: the confirm email is ours (not
the sign-in service's), and the registration email is sent before the account exists on purpose (the organizer gets the entry
first); the build keeps that order and sends the coach's one email after the account step. (c) Item 3 reaches six emails, not one.

**Build prompt:** `SIGNED_IN_FAMILY_STAGE2_BUILD_PROMPT.md`.

**Built 2026-11-01/02 (Parts 1–7; commit hashes go in the build prompt's Progress block when the owner commits).**
- **Parts 1–3 (Session 1):** the Register form's own limits (ruling 4); the claim link, its developer tool and the claim
  branch in team checkout are gone, the table stays (correction a); no address in any coach email's portal link, and the
  join page asks for it (ruling 2).
- **Part 4:** ONE email, made server-side: `/api/register` files the entry, starts the organizer's alert, then makes the
  waiting account and sends the registration email with the confirm panel in it. Not the prompt's browser-released hold
  (a lost second call would have left the coach with no email). Two emails stay where ruled: a customised template;
  "Registration received" off sends the plain confirm email only.
- **Part 5:** the finish screen as drawn (ruling 3): the confirm block leads with its heading and a quiet "Already
  confirmed? Sign in"; no big button for a new coach; an address that already has an account gets one Sign in. The card
  says "open the link we sent" only when the server says a link went.
- **Part 6:** the team pay page shows the coach's address partly hidden (ruling 5, after walk §440 passed); no reset.
- **Part 7:** `/simplify`, `/review` (no Critical or High), `/docs`. Reported for the owner: a stranger who registers with
  someone else's address chooses that account's password (the coach sign-up has the same shape; the fix is a passwordless
  account with the password set at confirm, a product call).

### Stage 3 — An optional second guardian email (house league) · no prerequisite

An optional "Second parent's email" on the house-league sign-up form (F1). Both addresses receive the sign-up emails and,
from Stage 4, the team invitation. Throttle and consent rules apply per address. Migration if the registration has no place
for it (decide from the snapshots, never from migration files).

Draw first: the form field and how the club sees two guardians on a registration.

### Stage 4 — The invitation at team placement; "Your sign-up" inside the app · needs counsel AND Stage 14

1. **Placing a child on a team invites the guardian(s)** — the placement email is the invitation; never a separate
   "create an account" email. Accepting signs the parent in (new or existing account) and links them to the child.
2. The parent's app holds the team's schedule (practices included), team chat, In / Out / Maybe, and a calendar feed made
   inside the app (census F8 pattern: minted signed-in, revocable).
3. **"Your sign-up" also shows inside the app** — the same page, so a grandparent paying from email and a parent in the app
   see one thing.
4. Rewrite `COACH_AVAILABILITY_RSVP_PLAN.md` to the app channel (its emailed-link door is ruled out; banner added
   2026-10-31).

**Blocked by:** the PIPEDA / CASL counsel review (the guardian tier, `GUARDIAN_TIER_ENABLED`, stays off until it clears) and
**Stage 14** (one player across seasons): today the guardian link hangs on a per-season rep roster row (census §4), and house
league has no child record at all. The parent account is a person, not an organization member (10-29 P3 — not yet ruled).

### Stage 5 — Next season pre-filled for a signed-in parent · needs Stage 4

A returning parent who is signed in gets next season's form filled in; the public form stays for everyone else. Never a sent
pre-fill link. This is House League 9f's "returning families" item (`HOUSE_LEAGUE_STAGE9_PLAN.md`, 9f row).

## Not in this plan

- Native app vs installed web app, what the app shares with the public site, which plan the family app belongs to — all
  **open** in the 10-29 entry.
- The per-team unsubscribe for free coaches' families (census D3) — its own open call in `CLUB_FAMILIES_BOOK_PLAN.md`.
- Tryout sign-ups (F2) keep their shape: no account at sign-up; the rep guardian invite at roster is the account moment.

## Verification per stage

`npm run verify:changed`; `npm run typecheck` for Stages 1, 2 and 4 (API and auth contracts); unit tests for the token
changes (expiry, per-family reset, a reset leaves tournament pay links working, "Email me my link" says the same thing for
an unknown email); owner browser walk from a checkable QA page; `/docs` for family and registrar help; `/marketing` for the
email and screen words.
