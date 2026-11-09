# Signed-in family accounts — Implementation Plan

**Status:** Stages 1–3 built and committed (owner rulings 2026-10-31); Stages 4–5 wait on Club Stage 14. Current status lives in the TODO line.
**Decision of record:** `docs/agents/strategy/BUSINESS_DECISIONS.md` — 2026-10-31 "A family gets an account when their child
is PLACED ON A TEAM…" (amends 2026-10-29 "The end state is an app where everyone signs in").
**PM brief:** `SIGNED_IN_FAMILY_ACCOUNTS_PM_BRIEF.md`
**Inputs:** the census `SIGNED_IN_FAMILY_CENSUS.md` (every door, with its `path:line`) · the findings page
https://claude.ai/artifact/89YK6LSVhBxPnzFnrRZtpo · the journeys page https://claude.ai/artifact/QmPoKvcyF3Bg1xpjCWw54C
(source `SIGNED_IN_FAMILY_JOURNEYS.html`: who gets an account when, each journey after these fixes and in the end state).

> **2026-11-04 (owner):** counsel no longer gates the guardian tier. Wherever this plan says counsel's sign-off gates it, read: the switch stays off until the owner turns it on, after real guardian consent wording are written (`/legal` drafts them). See BUSINESS_DECISIONS.md 2026-11-04.

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

**Built 2026-11-01/02 (Parts 1–7), committed `ce3085b88` 2026-11-02.**
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

**DRAWN + RULED 2026-11-03 (all six asks A, as recommended).** [Drawings](https://claude.ai/artifact/5NRGyGJgJU11DaVuhL9fHY) · [source](SIGNED_IN_FAMILY_STAGE3_DRAWINGS.html). **BUILT and committed `bacf24a9b` 2026-11-03** (Sessions 1–3 in one commit; /simplify and /review done, the review's fixes and six owner questions are in the build prompt's Progress block; mig 430 applied to dev, prod pending; walk, /docs and /marketing owed).
1. **Placement:** an always-visible box "Second parent's email" under Email and Phone, no name asked, no "(optional)" tag (the 2026-08-26 required-marker ruling).
2. **Emails:** the second address gets every email about the sign-up, including the "Your sign-up" link and the pay link, with a "who added you / not you? tell the club" line on its copy. Receipts and refunds stay with whoever paid, as today. Known cost: the address is typed by the first parent and unconfirmed, so a wrong address can see the child's name and the amount owed; the added line is the only safeguard.
3. **Marketing consent:** the tick-box covers the first parent only; the second address is never on the marketing list.
4. **Club "Email families":** reaches both parents of each household, counted once.
5. **Coach:** sees the second email; the form's coach line is updated to say so.
6. **Club screens:** record window (view and edit), "Add registration" window, export column, and search. The Families book and its second-guardian write are untouched.
Also drawn: one address per sign-up (not per child); the same address as the first is refused inline; the second address has its own hourly send limit; no parent-side edit until Stage 4. A migration is needed (no column exists today). The PIPEDA / CASL counsel review that gates Stage 4 should also be shown this page; nothing here waits on it. Build prompt written 2026-11-03: [SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md](SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md) (six Parts, two sessions).

**Stage 3b — a stop button on the second parent’s emails (BUILT 2026-11-06).** The `/legal` review found the gap (a stranger’s address typed by someone else, with no way off but writing to the club); plan [SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PLAN.md](SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PLAN.md), owner calls O1–O5 ruled as recommended. Every second-parent copy carries a quiet “Stop these emails” link from one footer builder; the link opens a confirm page (a GET writes nothing, one POST stops), the stop clears the address from every sign-up of that club and refuses it afterwards (family form and both registrar windows), the registrar sees “Stopped by the address owner, {date}” and cannot undo it, nobody is emailed, and the first parent’s mail is untouched. Session 1 committed `80c9bc430`; Session 2 committed 2026-11-06; mig 448 dev only (prod owed before the promote); walk §472 owed. Open flags for the owner (reply path with no club contact email, exact-address match, a millisecond race, a mixed address, two footnotes on the pay-link copy) are in `docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md`.

### Stage 4 — The invitation at team placement; "Your sign-up" inside the app · unblocked (drawn 2026-11-08; rulings owed)

1. **Placing a child on a team invites the guardian(s)** — the placement email is the invitation; never a separate
   "create an account" email. Accepting signs the parent in (new or existing account) and links them to the child.
2. The parent's app holds the team's schedule (practices included), team chat, In / Out / Maybe, and a calendar feed made
   inside the app (census F8 pattern: minted signed-in, revocable).
3. **"Your sign-up" also shows inside the app** — the same page, so a grandparent paying from email and a parent in the app
   see one thing.
4. Rewrite `COACH_AVAILABILITY_RSVP_PLAN.md` to the app channel (its emailed-link door is ruled out; banner added
   2026-10-31).

**Blocked by: nothing (corrected 2026-11-08, drawing session).** Counsel stopped being a gate 2026-11-04: the guardian tier
(`GUARDIAN_TIER_ENABLED`, `lib/family-guardian.ts:41`, off unless the env var is the literal `'true'`) stays off until the owner
switches it on, after real consent wording (`/legal` draft `docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md`). Stage 14 is closed
(S6 `4b7341f08`, mig 445 dev only, prod owed). **What Stage 14 did NOT fix, and Stage 4's build owns (the drawing session read the
code):** `family_links` still requires `rep_team_id` (NOT NULL) and `player_id` (a `rep_roster_players` row, strict CHECK
`role='guardian' AND player_id IS NOT NULL`, DATA_DICTIONARY `family_links.player_id`), and its live-unique key is
`(child_id, rep_team_id, invited_email, role)` (mig 445:64-66). So (1) a house-league child cannot be connected at all, and (2) a rep
child who moves to another team loses the connection. The census's "house league has no child record" is stale since mig 435
(`league_registrations.child_id`). Also found: no invitation email exists (`PlayerGuardiansCard` hands the coach a link, "Send this
to them — it works once, and expires in 14 days"); chat is paused product-wide (`lib/chat-pause.ts:27`, ruling 2026-10-18) and no room
a parent could join exists. The parent account is a person, not an organization member (10-29 P3 — ruled yes 2026-11-04, below).
**Stage 14 DRAWN + RULED 2026-11-04, all 14 asks A** (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` Stage 14 note; page tab 7 is
this stage's hand-off frame: the link points at the CHILD, and what a parent sees follows the child's live seasons — Ask 13).
**10-29 P3 RULED 2026-11-04 (Stage 14 Ask 14 A): a parent account is a person, kept clear of the one-home-organization rules.**
**Stage 3b note (2026-11-06): a stopped address must never be invited to sign in.** Stage 3 sends the team invitation to the second guardian’s address too. The stop clears the address from every sign-up of that club, so an invitation built from the sign-up columns cannot reach it, but Stage 14 and Stage 4 add new places an address can live (the child record, the person book). Any such copy of a second address must be cleared by the stop, or the invitation must check `second_parent_stops` (`lib/league-second-parent-stop.ts`) before sending, and an address typed into any new invitation path must be refused with the same words as the form (`SECOND_PARENT_WORDS.stoppedAddress`). The invitation itself needs its own Stop line like every other second-parent copy.
~~Stage 4 is still blocked by counsel and by Stage 14's BUILD. The code read also found the guardian link is never moved at a roll and stays live and season-blind on last
season's row (latent: the tier is off) — Stage 4 must not ship on today's link.~~ **Superseded 2026-11-08:** mig 445 (Stage 14 S6) put
the link on the child and fixed the season-blind row; the remaining gap (per rep team, no house league) is in the "Blocked by" line above.

**DRAWN 2026-11-08 (drawing session, `SIGNED_IN_FAMILY_STAGE4_DRAWING_PROMPT.md`).** Page https://claude.ai/artifact/M87dgZ1W4gEWxXvchoZA3M
· source [SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html](SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html). /ux, /design and /legal ran before the publish and
their findings were applied (version 1 is the reviewed one). Consent and privacy words: `/legal` draft 0.1,
`docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md`, with six build conditions the words rely on. **15 owner asks, not ruled**. Asks 1–3
change the shape: (1) no team chat in Stage 4, because the 2026-10-18 ruling paused chat and sends families to the future Messages project
(the 10-31 ruling put chat in the app; the two collide); (2) split into 4a (invitation, team page, sign-up inside, calendar, club status)
and 4b (In / Out / Maybe + the coach headcount + the `COACH_AVAILABILITY_RSVP_PLAN.md` rewrite); (3) one connection reaches the child on
every team in the club, and one acceptance covers every child on the parent's sign-ups. Recommendations and alternatives are on the page; do
not build from them until the owner rules. Build guards found by the session (whatever the rulings): the Stage 14 join window must name the
connected parents before a join; a Stop ends only a second-parent connection (CASL flag d); a left or removed parent is never re-invited
automatically; CASL flags (a) and (c) are raised for the owner as "before the build". The built claim page's draft notice ("being confirmed
with our privacy advisor") is false since 2026-11-04 and goes in the build. Next: the owner's rulings, then `SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md`.

**RULED 2026-11-08 (owner, all 15 asks A, pasted from the page; no notes).** Where these differ from items 1–4 above, these win;
build to the drawing.
1. Stage 4 ships **without chat**. Rep coaches' updates keep their read-only card. Families get messaging when the Messages project
   brings it back.
2. **Two stages:** 4a = invitation, team page, sign-up inside, calendar, club status. 4b = In / Out / Maybe and the coach's headcount.
3. The connection reaches **the child, on every team in this club** (house league and rep). One acceptance connects the parent to every
   child on their sign-ups in the club, now and as each is placed; the accept page names each child.
4. **Rep:** the coach's Send invitation button on the player's Guardians section sends the email. Nothing happens by itself at roster add.
5. **Signed in with a different email:** refuse, name the invited address partly hidden, offer Sign out. The coach's approval queue goes.
6. **Calendar:** one address per parent, covering every child's team, with Copy and Stop this calendar.
7. **Neither parent removes the other.** Both see who's connected, each can leave, and the club removes.
8. **A joined second parent's Stop:** the Stop line stays; stopping also removes them from the app (only their second-parent connection),
   and the confirm page says so.
9. **30 days.** The parent's "Email me a new invitation" and the club's "Send again" both re-send the placement email with a fresh
   invitation.
10. **Club:** a status per address on the registration record window, with Send again and Remove a parent. **Coach:** nothing new in 4a.
11. A **"Your family" row in the shared account menu**, shown only to an account with a connected child.
12. **No age question.** Work it out from the date of birth and the club's province; no invitation panel for a player 18 or older.
13. Use the **/legal draft** (`docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md` v0.1) as the wording the build ships with, switched off.
14. **Keep the guardian box strict.** A non-guardian can't join; they still get the emails and can pay from the link.
15. **Trust the invitation** (no extra confirm email), as with a password reset.

Not ruled by these asks, and still open for the owner: CASL memo flag (a), whether Publish requires a club contact email or the line names
the registrar (the build prompt carries it as an owner call before the email Part). Build prompt for 4a: `SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md`.

**RULED 2026-11-08 (owner, build Session 1).** **O1 (CASL flag a) = A:** while the guardian tier is on, Publish and the rep Send invitation
refuse until the club has a contact email, saying where to set it. **O2 (raised by the build) = second-parent only:** a stop refuses an
invitation to that address unless it is the first parent on a sign-up of that club (the stop page promised to stop the second-parent copies,
not the address's own child's emails). Also decided in the build, on the code (not owner asks): a house-league child reaches a team only once
its division's teams are **published** (the draft board sets the team earlier); a house-league season is live until completed or archived
(its registration statuses are live); the parent-typed "invite another adult" door (`inviteCoGuardian`) is removed (it broke "an invitation
goes only to an address on the sign-up"); no date of birth = treated as a minor.

**RULED 2026-11-08 (owner, build Session 2).** **O3 (raised by the build) = a new field, refuse until set:** /legal's second-parent and rep
footers print the club's mailing address, and the product held none (the billing address is not used: it was given to pay a plan, possibly
a volunteer's home). The club types a "Mailing address" on the public site's About row (mig 454; the box shows only with the tier on), and
with the tier on, Publish and a club team's rep Send invitation refuse until the club has both the contact email and the mailing address.
**O4 = the coach's own email:** a coach team with no club uses the inviting coach's sign-in email as the contact on its invitation; it has no
mailing address to print (/legal re-reads in the closeout). Also found in Session 2: FieldLogicHQ has no privacy policy page in the product,
so the accept page's "How we use your information" has nowhere to link; publishing it is owed before the tier goes on anywhere real.

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
