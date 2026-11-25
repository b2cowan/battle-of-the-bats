# Board Ready — what a club board needs before it says yes — Implementation Plan

> **Status:** In flight (trued up 2026-11-16). Every owner question in §7 is ruled. **Built, walked and in release
> `release/2026-11-15`:** the third access sweep's fixes A–E, two-step sign-in (four parts), friend requests (three
> parts). **Committed, not yet in a release tag:** deleting a club removes its files (`45c134bea` 2026-11-15).
> **Done since:** the legal pages, published as version 2026-11-17 (GST/HST 6.7); backups written down and a restore
> rehearsed (2026-11-18). **Not started:** the board pack (0c) and Stages 2–7 (none drawn). Where each step stands: the State column in §7b. Deployment state has one home, the release-history
> record; this plan cites commits and release tags only.
> **Created:** 2026-11-10
> **Branch:** dev
> **PM brief:** `BOARD_READY_PM_BRIEF.md`
> **Source:** board feedback from the prospect demo of 2026-11-10 (the club in `PROSPECT_DEMO_PROGRAM_PLAN.md`), eight
> items, owner's words kept in §1. Runs **alongside** Club Tier Readiness (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`),
> never inside it, except where §3 says a Stage 0 piece belongs to that plan's Stage 8.

## Goal

Turn the eight things a real club board asked for into a sequenced project. It should answer the board's trust
question honestly and add the off-field club work they run today in spreadsheets and email: volunteers and their
screenings, friend requests, group email, custom sign-up forms, club events, camps and sponsorships.

The plan's main finding is that **items 5–8 are one shape asked four times**: *a club-owned thing, with an optional
sign-up form, an optional price, shown on the calendar and the club site*. Built as four features, that would be four
form builders and four payment flows. Built on three shared foundations (the club's **People**, **Forms**, and
**Club events**), each later item is mostly assembly.

## 1. The eight items (owner's words, condensed)

1. Security concerns: we are small and have had no SOC audit. Give encryption details, architecture diagrams and other security material.
2. Friends in the house league team calc: parents list friends in free text, we match to registrants as accurately
   and transparently as possible, and it feeds the auto-draft. Today the registrar does this in Excel.
3. Email distributions to coaches: all rep coaches, all coaches, all house-league coaches.
4. Track volunteers (coaches, parent helpers, board) with documents attached. The club defines each document type and
   how long it lasts (police screening = 3 years from receipt), gets told when one is near or past expiry, and can
   email those who need a new one.
5. Customizable house-league registration forms: custom questions, documents to open/download before submit, "I have read"
   checkboxes.
6. Clinics and camps: scheduled, linked to permits, with their own registration forms, postable on the club site, with
   payment. Similar workflow to house league.
7. **(important)** Organization sponsorships: sponsorship documents and invoices, a link the sponsor fills in (the club's
   sponsorship form) and pays through Stripe. Track what they paid and what they got, and attach a sponsorship to a house-league
   team, division, or club event (tournament, champs day).
8. Organization events: year-end banquet, champs day, camps.

## 2. Facts this plan stands on (census 2026-11-10; the starred ones were re-read from source)

| # | What exists today | Verdict |
|---|---|---|
| 1 | ★ Production database is **AWS us-east-2 (USA)**, Pro plan; dev is ca-central-1 (`docs/agents/legal/LEGAL_FACTS.md` "Where data lives"). ★ **No MFA exists.** Org delete leaves file storage behind. AES-256 at rest / TLS in transit is Supabase's own claim. Privacy policy v0.2 and breach procedure v0.1 are **drafts**; legal pages are switched off. Data-processing terms for clubs and sub-processor list: **not started** (`LEGAL_INDEX.md`). ~~Open defect: any club member can pull every team's contact emails~~ **⚠ Corrected 2026-11-10:** fixed `b15b01fea`
2026-10-16 and on production. The TODO line was stale and is now archived. The census and this plan repeated it without
opening the record. RLS is on widely but the API runs service-role with checks in the routes (`docs/agents/db/DB_ARCHITECTURE_REVIEW.md` ~L155). No backup/PITR doc, no architecture diagram. | partly built: facts on file, nothing a board can read |
| 2 | Auto-draft is a seeded snake draft with **"Families together"** (siblings by guardian email) and convenor locks (`lib/house-league-draft.ts`). Registration has a 500-char notes box, which is where a "plays with" request lands today. Name matching helpers exist (`lib/continuity-match.ts`, `lib/children-duplicates.ts`). "With a friend" was explicitly **not ruled** in the Stage 9c and draft-at-scale prompts. ★ Ruling: *"no sibling claim from a name match — anywhere, ever"* (`CLUB_FAMILIES_BOOK_P3_PROMPT.md:104`); a match is a question, never an answer. | absent |
| 3 | The "one club send window" parts (`components/admin/kit/club/SendParts.tsx`) power Send the schedule / reminders / Message this family. Coaches are reached only as side effects (copies, coach asks, schedule send). Tournament announcements are the nearest "all coaches" send. Ruling: **two mail paths, never mixed** (colleague mail vs family mail). CASL finding: role-based mail to a named volunteer is not commercial if it carries no offer. | partly built: no group composer |
| 4 | People are scattered: club members (roles), rep team staff memberships, house-league coaches (name + email rows, no account), officials. Documents exist **only for players** (rep document templates), with no expiry. Private storage buckets with signed URLs are in use (permits pattern). Board tab ruling R1 (2026-11-06): names and roles only, never contact details. | absent |
| 5 | **Tournament** registration already has custom questions (short/long text, dropdown, checkbox, file upload). These are the tables `tournament_registration_fields` and `…_field_answers` (mig 056), gated on Tournament Plus. House league has fixed fields plus one waiver text and one "I have read and agree" tick, recorded as a consent. | partly built (tournaments only) |
| 6 | Camps/clinics: **absent**. Permits are **built** (Stage 10a); the scheduler splits permit time into slots held by rep teams or house league (`club_schedule_slot_programs`, house_league only today). Revenue accounting excludes "camps unless explicitly added"; instruction is flagged as its own tax class. | absent; permits built |
| 7 | Team sponsorships with a sponsor invoice: built in the Coaches Portal (team's money; R1 invoice is from the team; R2 no tax). The club site sponsor list is built (logos, links, last day; no money). ★ Ruled 2026-10-27: **one sponsor list per org; each sponsor says where it shows**. Pay links for people without accounts exist (Stripe Connect direct charges, the club is the merchant of record); **online payments are off in production** (Club Tier Stage 12). | partly built: no club money side |
| 8 | Club calendar is built and **read-only** (rep events, house-league games/practices, tournaments). There is no club-owned event. Rulings D3 (*the club never writes a team's schedule*) and D5 (read-only calendar in the first release, public club schedule deferred). ★ 2026-10-31: **no links sent to families** besides the pay link and unsubscribe; RSVP by email is out. | absent |

## 3. Where I disagree with the ask, or widen it

- **Item 1 is not a documentation task first.** A board brief written today has to say that there is no two-step
  sign-in and that our privacy policy is still an unpublished draft. Also, nothing has proven the areas built since the
  2026-10-16 access sweep (house league, families, the club areas) don't leak. A brief that leaves those out promises what the product doesn't do, which is a defect (CLAUDE.md, `/legal`
  rule), not a wording problem. So Stage 0 **fixes first, then documents**.
  - *Corrected by the owner 2026-11-10:* I had guessed the board's worry was US hosting. It isn't. The board asked
    **"does our data leak, and is it sold to vendors?"** and **"what happens if this one-person business stops?"**. The
    pack answers those two.
- **No SOC 2.** It is a long, costly audit sized for selling to enterprises. What a small vendor can honestly offer:
  certified infrastructure (Supabase, AWS, Stripe; each certification **verified on the supplier's own page before it is
  quoted**), holding as little as possible (no card data ever; the club is the merchant), the club in control of its
  data (export, delete), a breach procedure, and candour. An independent penetration test is the one paid step a board
  recognises; it was owner question Q5, **ruled out of scope 2026-11-15** (§7).
- **Items 5–8 must not be four features.** See the Goal. If camps get their own form builder, the house league gets a second one
  and sponsors a third. The foundations are the plan.
- **Item 3 should be live groups, not lists someone keeps up.** A hand-kept "all house-league coaches" list is wrong the
  day a coach is added. Groups are computed from who holds the role this season; saved custom lists exist only for the
  odd one-off.
- **Item 2, accuracy.** Free-text matching will always be a guess, and the rulings say a guess is only ever a
  *suggestion* the registrar confirms. Accuracy comes from also offering an exact path: each sign-up gets a short
  **friend code** that a parent can pass to the other family. A code match is exact. A typed name is a suggestion.
- ~~Item 4, record-only screening by default.~~ **Overruled by the owner 2026-11-10 (Q2):** a police check is only an
  example. The feature is **documents**: any document the club defines, with a file saved and a custom expiry. How a club
  manages its documents is up to the club, and the product never says "you can't keep a police check here". What
  stays our job is **who can open the files** (a documents seat) and what our terms say about clubs storing
  sensitive files (`/legal`, as the club's data).
- **Item 8 re-opens a ruling.** D5 kept the club calendar read-only. Club-owned events don't break D3 (they are the
  club's own, not a team's schedule), but they do need a new owner ruling to make the calendar writable for club events.
  **Ruled yes 2026-11-15 (Q7, §7).**

## 4. Shape: one trust track, then three foundations, then assembly

```
Stage 0  Trust pack (item 1) ───────────── runs in parallel from now
Stage 1  Friend requests (item 2) ─────── standalone, house league exists
Stage 2  Group email to coaches (item 3) ─ needs the Stage 0 contact-email fix
Stage 3  The club's people + credentials (item 4)  ── FOUNDATION: People (adds groups to Stage 2)
Stage 4  Forms (item 5) ───────────────── FOUNDATION: Forms (first used by house-league sign-up)
Stage 5  Club events (item 8) ─────────── FOUNDATION: Club events (calendar + club site)
Stage 6  Sponsorships (item 7) ────────── Forms + Club events + Club Tier Stage 12 payments
Stage 7  Camps & clinics (item 6) ─────── Forms + Club events + permits + Stage 12 payments
```

Order is by dependency and rework risk. Release timing is never part of it. Stages 0 and 1 can start while Club Tier finishes. 2 and 3
can swap: groups are live queries, so People only *adds* groups and does not rewire them. 6 goes before 7 because the
owner marked sponsorship important. Both need online payments on in production (Club Tier Stage 12) before a live
sponsor or camp payment, though everything up to the pay button can ship first.
**Every stage gets its own drawing session (`/design`, Artifact, true size) before it is built.**

## 5. Stages

### Stage 0 — Trust pack (item 1)
**0a · Fix what a board would find** (each is a real defect; most belong to Club Tier Stage 8 Release readiness, which
points here, so they aren't tracked twice)
- [x] **Third access sweep** (replaces "contact-email leak", which was already fixed `b15b01fea` 2026-10-16). It is
  report-only first, on the pattern of the second sweep (`TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md` § Second sweep). It covers
  every route and page added or changed since 2026-10-16, reads as well as writes, tenant boundaries and seat by seat.
  Each finding is fixed with the owner's go. It is the evidence behind the pack's "doesn't leak", and it comes before Stage 2.
  → **Swept 2026-11-10, report [`BOARD_READY_ACCESS_SWEEP_3.md`](BOARD_READY_ACCESS_SWEEP_3.md): 2 serious, 5 medium, about
  25 small; nothing reads another club's people.** Serious: (1) inside a club, assistant coaches, scorekeepers and staff
  read the tournament emails and their recipient lists; (2) any signed-in account can delete or replace any club's rules
  files. ~~Both are proven on dev and the same code is on production. Fixes are awaiting the owner's go.~~ **Fixes A–E
  committed 2026-11-11** (Wave 2, prompts in `BOARD_READY_PROMPTS_INDEX.md`): A `3d9b1ec13` (findings 1 + 3), B
  `b164c707e` + `ad978ce6b` + `551bd4f82` (finding 2: the files, the link rows, the rules sections), C `ae474966e`
  (findings 6 + 7 and the public smalls), D `0d424d8bc` + `90d2f23b0` (demo billing refused, team pay-link version,
  throttles), E `d8a6bb4c0` (findings 4 + 5 and the seat smalls). All are in `release/2026-11-15`. The report's seat
  table is the source for the pack's "who can see what".
  **Census against the code, 2026-11-16 (read-only; every item of the report re-checked on `dev`): 48 items · 28 fixed
  and confirmed · 9 left open on purpose (owner calls) · 9 open with no ruling (all small) · 2 answerable only on
  production.** None reads another club's people. The report's own status words are stale in places (its line "returning
  -player scan: still open" is fixed by `d8a6bb4c0`; "a See it live session can create real clubs, leagues" is now true
  only of a coach's team, the other two being turned away by the one-club rule). Until the 18 are ruled and the chosen
  fixes are live, the public roadmap says "with its fixes live", never "every finding fixed"
  (`PRODUCT_ROADMAP.md` §4 item 5). **Now said, 2026-11-24:** the fixes went live in the 2026-11-22 promote, so the
  roadmap's line is "A full access review of who can see what, every finding resolved" (call 22); "every finding fixed"
  stays unsaid, because some findings were accepted by decision.
  **The owner's checklist, published 2026-11-16:** https://claude.ai/artifact/2KZrC64ucjBpWCgMkfPCej (source
  `BOARD_READY_TRUST_CLOSE_CHECKLIST.html`). Part A is the 18 open items as calls, each with a recommendation, plus two
  production checks, one new finding and the public wording; nothing is built until it is pasted back.
  **Pasted back 2026-11-18: Part A 22/22 all as recommended (rulings recorded at the top of `BOARD_READY_ACCESS_SWEEP_3.md`);
  Part B PASSED 8/8; Part C PASSED 16/16 (first restore rehearsal done). Facts written to
  `docs/agents/ops/BACKUPS_AND_RESTORE.md`.** Open after it: the owner's go to build fixes 1–14 + call 21 (call 12 needs a
  drawing first), the production read of old link rows (call 19; RUN 2026-11-18, read-only: 3 link rows, none pointing anywhere but a web address, nothing to clean), and the public wording (call 22) once the fixes
  are live.
  **Call 12 (a team's pay link: "Send a new link") DRAWN 2026-11-18, round 2 after `/design` + `/ux`:**
  https://claude.ai/artifact/XGaoqcuEuo2973Mc4vsq5F (source `BOARD_READY_PAY_LINK_BUTTON_DRAWINGS.html`). **ALL NINE
  ASKS RULED 2026-11-18, as recommended (1A–9A)** (paste-back "Pay link button (drawings Nov 18, 2026)"):
  1. one Pay link line under the payments on every team, its ⋯ holding both items, and the due row keeps only Record;
  2. the same people as Email the pay link (owner, admins, Run tournaments);
  3. "Stop the pay link" when no new link can go out;
  4. no copy button;
  5. the old link's words unchanged;
  6. the dispute is asked in the same window before anything stops, with "Only stop the link";
  7. the line reads "Pay link replaced/stopped {date}" until the next send;
  8. stopping still works on a completed tournament, a deliberate exception to the lock;
  9. Stop answers red-tinted, "Send a new link" lime. The drawing widens the premise: a paid team has no
  pay-link control today (the only ⋯ sits on the last "Still due" row), and it is the team whose forwarded link shows
  receipts. So the proposal is one "Pay link" line under the payments on every team, offering "Send a new link", or
  "Stop the pay link" when no new link can go out. Build notes the drawing records:
  - the record must be told when a link was replaced, whether to show the line, and whether the team ever paid online;
  - the server should send back a cause code instead of its refusal sentence (its "tournament over" sentence misreads here);
  - a dispute-first, stop-only answer is about a day of work with tests;
  - a family who has the old page open but hasn't pressed Pay is refused, and that gap is accepted, not closed.
  The build is its own session, from the build prompt written 2026-11-18 (`BOARD_READY_TRUST_FIX_PROMPTS.md` P6, queue row 6).
  Mig 467 was applied to production 2026-11-15 (release history), so the build has no production order of its own unless it
  adds a migration.
- [x] **Two-step sign-in** (§7b step 3). **Drawn 2026-11-10; ALL ASKS RULED 2026-11-10** (ask 1 as amended by the owner; asks 2–8 and A–F as recommended,
  owner: "I agree with the recommendations on this mockup"). **Build prompts written 2026-11-10: `BOARD_READY_TWO_STEP_BUILD_PROMPTS.md`
  (Part 1 Opus, 2 Sonnet, 3 Opus, 4 Sonnet).** **All four parts built, committed and walked** (the "Part N BUILT" notes
  below hold the detail): Part 1 `7c8f092ab` (walk §511 24/24), Part 2 `0a0ee533d` (§513 28/28), Part 3 `5a22b498a`
  (§515 35/35), Part 4 `24e5b9e45` (§520 29/29); all in `release/2026-11-15`. What is left is the open owner calls in
  those notes; none blocks a build. Drawings (round 3, after `/design` + `/legal` and the ask 1 ruling):
  https://claude.ai/artifact/5b956A7svYzjzmZhZUfnkc, source `BOARD_READY_TWO_STEP_SIGNIN_DRAWINGS.html`. Prompt:
  `BOARD_READY_W1_TWO_STEP_SIGNIN_PROMPT.md`.
  - **Decisions (owner asks 1–8, A–F on the drawings' Asks tab; all RULED 2026-11-10, 2–8 and A–F as written
    below):**
    1. **RULED (owner 2026-11-10): offered to everyone; the club decides.**
       - Two-step is available to every account and off unless the person turns it on.
       - A club (any organization kind, every plan) may require it with two owner-only switches, both off by default:
         **"Require it for the board"** (owner, admins, treasurer, registrars, league admins) and **"Also require it
         for coaches"**.
       - **FieldLogicHQ platform staff must always use it** (no grace).
       - Owner's reasoning: required two-step would be a nuisance for the average volunteer coach or admin, while a
         switch satisfies a board with security-minded members.
       - Agreed in the same reply:
         - turning a requirement **off** asks for the owner's code and emails the club's other admins and treasurer;
         - the owner must have two-step on before turning a requirement on;
         - the owner sees a one-time prompt on Overview;
         - every switch change is a club audit line;
         - the 14-day grace period starts when a switch is turned on.
       - One person with any seat a club requires must use it; once on, every sign-in asks.
       - *Replaces* the earlier recommendation (required for the money and family-file seats).
       - **Consequences, recorded so they are not a surprise:**
         - "we offered it" holds in our terms with clubs (the organization's choice), but is a mitigation, not a
           shield, with a privacy regulator;
         - the privacy policy says "available; an organization can require it", nothing stronger;
         - the policy's medical-notes finding 5 stays **open**, reworded, not closed.
    2. Authenticator app only. No emailed codes: "Forgot your password?" goes to the same inbox, so a password plus an
       emailed code is the inbox twice. No SMS. A second device may be set up as a spare.
    3. Recovery:
       - ten one-time backup codes;
       - the club's owner and admins reset anyone but the owner and themselves (the person is emailed and signed out;
         club audit line), **and only when the account reaches no other organization**, because the authenticator is
         the person's, not the club's; otherwise it goes to support, with no reason shown to the club;
       - the owner is reset by support only: a request from the account's address, a confirmation link to it, an
         email to the club's other admins and treasurer (who can put it on hold), a 24-hour wait, and a cancel when the
         owner signs in with the real code; platform audit line written first.
       - **Known gap:** a sole owner gets only the wait. Recommended: support phones the owner on a number from the
         club's records.
    4. No "remember this device" box: staying signed in does the remembering. Required seats are asked again after
       30 days. Five actions ask for a code if the last one was more than 15 minutes ago: payout or bank details,
       adding an owner or admin, resetting someone's two-step, turning your own off, and new backup codes.
    5. "Sign out everywhere else", no device list (less personal information).
    6. Status column on Members (owner and admins) plus an Overview reminder; **not** on The board tab, where it
       would be a list of whose password is worth stealing.
    7. 14-day grace period (from the day a club switches a requirement on, or from accepting a new seat in a club that
       already requires it), a reminder screen at sign-in, two emails
       with no link, then setting it up comes first and only the club's admin waits. **Add "Change password"**: no
       signed-in person can change their password today.
    8. A "test organization" exemption set by platform admin, setting up refused for shared demo accounts, and one
       UAT account with a known authenticator key.
    - From `/design`:
      - A: a coach's reset door lives on the team staff page (coaches aren't managed in Members).
      - B: Done explains on press.
      - D: the data face is a named exception for recorded codes.
      - E: past the deadline stays amber.
      - F: the Overview reminder follows the one-notice rule.
  - **Census facts the build stands on (2026-11-10, checked against the code):**
    - no two-step code exists;
    - one shared sign-in page, a browser password sign-in (`lib/auth.ts`), and five other callers that must hand off
      to the code step;
    - `proxy.ts` skips every `/api/*` route but `/api/admin`, so enforcement belongs in `lib/api-auth.ts`
      (`getAuthenticatedUser` → `getAuthContext*`, about 265 routes), `lib/platform-auth.ts` (about 87 routes) and the
      guards that call `getUser` themselves (`coach-team-guard`, `families-auth`, `supabase-server`);
    - **platform "sign in again" (`lib/platform-sign-in-again.ts` `checkPasswordAgain`) replaces the session with a
      password-only one and must become a code check**;
    - the tournament demo's shared user is the **owner** of its org, and setting up an authenticator signs out every
      other session, so set-up must be refused for demo users;
    - the Milton links and probes skip passwords by design (they need the exemption);
    - `ensureFixtureUser` password resets don't remove factors.
  - **Sign-in service facts (supabase.com, read 2026-11-10):**
    - authenticator enrol, challenge, verify and an admin delete exist;
    - assurance level and methods are in the session token;
    - recovery codes are **experimental**, and there is no "remember this device";
    - verifying an enrolment signs out other sessions;
    - ~~not documented, verify on dev before building~~ **Proven on dev 2026-11-11 (Part 1 Step 0, throwaway users,
      deleted after; probes `.probe/mfa-step0*.mjs`, not committed):**
      - **a refresh keeps the code level.** Three refreshes (same client, a fresh client holding only the refresh token,
        again) all stayed `aal2`, and the `amr` `totp` timestamp **did not move**, so the 30-day re-ask and the
        15-minute check can both read "when the code was last typed" from the session token. Typing a code again later
        moves it (it is the latest verify). A new password sign-in is `aal1` with `nextLevel aal2`.
      - **verifying a set-up signs out every other session immediately**: the other device's unexpired access token is
        refused by `getUser` ("Auth session missing") and its refresh token is gone. A sign-in code (a challenge, not a
        set-up) signs nobody out. So "your other devices were signed out" is true, and a server check that calls
        `getUser` sees it at once; one that only decodes the token would not until it expires (≤1 hour).
      - **limit: 10 authenticators per person, counting half-finished ones** (`too_many_enrolled_mfa_factors`, whose
        message wrongly says "verified"). Ten abandoned set-ups block an eleventh, including a real one.
      - **half-finished set-ups are swept by the service only when the person starts a new one, and only those older
        than about 5 minutes.** So we still clear the person's own unverified ones on each new attempt (an `aal1`
        session may remove an unverified one; admin delete works too).
      - **friendly names must be unique per person, and "no name" counts as one name**: a second unnamed set-up fails
        `mfa_factor_name_conflict`. Name each attempt, or clear first.
      - **a password-only session, once a code is on, cannot**: start a new set-up, remove the authenticator, change the
        password, or change the email (all "AAL2 required"). A stolen password alone cannot turn it off.
      - **⚠ the same code is accepted twice within its 30-second window** (no replay record). Harmless at sign-in
        (both are the person's), but the five "ask for a code" actions and backup codes must not rely on the service
        for one-time use; our backup codes are marked used by us.
  - **Part 1 (the foundation) BUILT 2026-11-11, committed `7c8f092ab` 2026-11-11 (mig 464 `6b19b5aca`); walk §511 ✅ 24/24 2026-11-11** (`BOARD_READY_TWO_STEP_PART1_WALK.html`).
    Rulings in the session (owner 2026-11-11): the database also requires the code (asked: yes); the merge-function defect
    fixed in its own commit (yes); dev requires two-step for staff like production, `TWO_STEP_STAFF_REQUIRED=off` the dev-only
    opt-out (yes). What was built, and where it differs from the outline:
    - **One server check.** Every server "who is signed in" goes through `lib/two-step-session.ts` (`getSignedInUser` /
      `readSessionTwoStep`); ~50 direct `getUser` calls were moved onto it, and `tests/unit/two-step-server-check-guard.test.ts`
      fails the build on any other session read (allow-list: the platform password clock for a staff account with no
      authenticator, and the demo doors' "whose session is this", which gates nothing). Kill-tested, 18 mutants.
    - **The rule** is `lib/two-step-rule.ts`; a club seat is checked in `getAuthContext` (only that club's routes and pages
      wait; personal routes such as notifications stay open, by design), staff in `getPlatformAdminContext`. A refusal is a 401
      `two_step_code` / `two_step_set_up` in a route and a redirect to the code or set-up step in a page.
    - **Census correction:** twelve places sign a person in with a password, not six; all twelve hand off through `signIn()`.
    - **Widened (ruled):** mig 463 puts a RESTRICTIVE `two_step_passed` policy on every table `authenticated` can reach (15)
      and `storage.objects`; mig 464 closes the two merge functions (sweep 3 finding 8).
    - **Lost phone:** a backup code lets that session in; "Set up my new phone" removes the old authenticator (the service
      will not add a second one to a password-level session) and marks the account `two_step_replacing` in `app_metadata`
      until the new one is verified, so two-step never silently turns off mid-way (/review finding).
    - **Not built here (later parts):** the Account section, "Lost your phone?" (the code step shows no link until Part 2),
      the switches' screen, the grace screens and emails, Members, Overview. A password reset asks for the code first; a
      reset let in by a backup code is saved by our server.
    - **Open owner calls from the build** (none blocks the walk):
      1. The code step's guessing limit is the sign-in service's own (a stolen password can call it directly); our code
         cannot add one without a production Auth setting, which this project does not change. Accept, or look at the
         service's MFA rate-limit setting later.
      2. Someone holding the password of an account with two-step OFF could turn it on and lock the owner out (true of a
         password change today too). Recommended: a "two-step sign-in was turned on" email to the account (Part 4, `/legal`).
      3. Backup codes are salted, not keyed, hashes (`/legal`: "one-way (hashed)" wording, not "secure"). A keyed hash needs a
         new server secret on production. Recommended: later, with Part 2's new-codes action.
      4. A page already open when a 30-day re-ask comes due gets plain refusals until it is reloaded. Recommended: Part 2
         adds one shared client handler for the `two_step_*` refusal.
      5. A team registration whose existing-account sign-in needs a code leaves the form (the 409 path); the person returns
         to an empty form. Rare. Recommended: accept for now.
      6. Staff "sign in again" accepts only the app's code, never a backup code.
  - **Part 2 (your account) — rulings at the UX summary (owner 2026-11-11, all four as recommended):**
    - **call 4:** ONE "type your code again" window for the whole product. A press refused for "type your code" (the
      15-minute actions AND the 30-day re-ask on an already-open page) opens it in place, and the press is sent again once;
      a press refused because two-step must be SET UP shows a notice with a link;
    - **call 3:** keyed backup-code hashes now, with "New backup codes"; codes already issued keep working; the new
      production secret is an owner step before the promote;
    - **the window takes a backup code, for everyone including staff (call 6):** staff's "sign in again" becomes the same
      window, keeping its own 10-minute rule and audit lines;
    - **staff doors ask too:** transferring a club's ownership, and adding a staff account or raising one to super admin.
    - Session calls (stated in the summary, not objected to): "Set up a new phone" while still holding the old one ADDS the
      new authenticator first and removes the old one after it is verified (no gap); the backup-code path keeps Part 1's
      mark-first order. Turn off is refused in any covered seat, grace included. Setting up a new phone asks for a code
      (tab 5's note; ask 4's list omits it). Payout coverage = every button that hands out a Stripe link where the bank
      account can change (connect, continue, dashboard, disconnect). Reported, not fixed: every ordinary "Sign out"
      already signs the account out on every device (the default scope). Part 4 + `/legal` emails: "two-step turned off",
      "password changed", call 2's "turned on".
  - **Part 2 (your account) BUILT + COMMITTED `0a0ee533d` 2026-11-11 (mig 468 `d44e62c93`, deploy-file line `bb0df394d`); owner walk §513 ✅ 28/28 2026-11-11**
    (`BOARD_READY_TWO_STEP_PART2_WALK.html`). What was built:
    - **One server helper** `lib/two-step-fresh.ts` (`requireFreshCode` / `hasFreshCode`; two-step off is never asked), wired
      into payouts (connect, continue, dashboard, disconnect), invite-as-admin and role→admin, staff's ownership transfer and
      staff accounts (add; raise to super admin; restore), new backup codes, set-up start AND verify, turn off, change
      password. `tests/unit/two-step-part2.test.ts` holds each door before its first write.
    - **One window** `components/shared/CodeAgainWindow.tsx`, opened product-wide by `CodeAgainProvider` (root layout; patches
      fetch once at module load; answers `two_step_fresh_code` and `two_step_code`, re-sends the press once; a notice for
      `two_step_set_up`; quiet for 2 minutes after a Cancel on the 30-day ask; `x-code-again: manual` opts out). One check
      `lib/code-again-server.ts` for everyone's route and staff's "sign in again" (which keeps its 10 minutes and audit).
    - **Account › Sign-in & security** (`app/(consumer)/account/security`), the rail row, the phone row, the console menu's
      row (`AccountMenu showSecurity`), "Back to your support console". Change password = cookie-less check (its session
      revoked; proved on dev), admin save, others signed out. Sign out everywhere else = `scope: 'others'`.
    - **Set up a new phone:** an `aal2` session ADDS beside the old one and verify removes the old one; a backup-code
      session keeps Part 1's mark-first order. **Turn off:** mark → remove all → confirm → clear → backup codes.
    - **Lost your phone?** on the code step; `lib/two-step-lost-phone.ts` returns `support` for everyone until Part 3 flips
      `CLUB_RESET_DOOR_BUILT`.
    - **Keyed backup-code hashes** (`k1:` HMAC under `TWO_STEP_CODE_KEY`; the old form still checked; dev value in
      `.env.local`).
    - **`/review` (high-risk, 4 lenses) found and fixed a Part 1 hole:** mid-replacement (mark set, no authenticator) the
      sign-in service lets ANY session set up a first authenticator and reach `aal2`. Now `aal2` counts for nothing while the
      mark is set (only our backup codes), and verify removes every other authenticator before it clears the mark. Also
      fixed: verify asks for a fresh code; staff's 10-minute window reads backup codes (was 15); the seat list fails closed;
      a future proof time never counts; ~10 client/robustness fixes. Not fixed (noted): a password-holder can burn the
      account's 10 window tries for 15 minutes; an `aal2` session can call the sign-in service's enrol/unenrol directly (our
      15 minutes guards our own doors only).
    - **Open owner calls from Part 2:**
      1. **The database half of the mid-replacement fix** (`public.session_passed_two_step()`, mig 463, still counts
         `aal2` and "no authenticator" while the mark is set, so a password-holder reaches the 15 tables directly during a
         replacement). Needs a small migration. Recommended: yes, before Part 2 is promoted.
      2. **`TWO_STEP_CODE_KEY` never reaches production:** `amplify.yml` copies server values one by one and has no line for
         it. Needs one line in the deploy file (shared automation: the owner's yes, its own commit) plus the value in
         Amplify. Until then new codes use the unkeyed form (today's).
      3. Staff "Back to your support console" wording; the reason sentence says "Required" during a seat's 14 days too.
  - **Part 3 (the switches, the grace period, the resets) — rulings at the UX summary (owner 2026-11-11, all four as
    recommended):**
    - **admins see the switches read-only:** an admin gets the Settings tab with ONLY the two-step card (read-only, "only
      the owner changes this"); every other Settings card stays owner-only;
    - **"reaches no other organization" = any live tie:** a seat in another organization (any status: invited, active,
      suspended), a Coaches Portal team of their own (free or paid), coaching a house-league team in another club, or a
      family link to another club (anything but declined / revoked). Unsure = support resets it;
    - **a coach's reset door is drawn now** (the club's team staff page person window), built in Part 3 after the owner's yes;
    - **the owner-reset job runs every hour**, so "24 hours" is 24 to 25.
    - Session calls (stated in the summary, not objected to): one new migration (the job's schedule and the confirmation
      link's stored hash; a scheduled job cannot exist without one); the turn-off email also reaches the club's other
      owners; after a reset a seat that requires it is sent to set-up at the next sign-in, and anyone else simply has it
      off (the email says so); a code from the app or a backup code, typed at sign-in during the wait, cancels an owner
      reset; support gets Hold / Release / Cancel on a waiting reset.
  - **Part 3 BUILT + COMMITTED `5a22b498a` 2026-11-11** (mig 469 applied to dev; mig 470, the hourly schedule, applied to dev on
    the owner's yes and committed on its own `d5f9f7f52`; owner walk §515 PASSED 35/35 2026-11-12 `BOARD_READY_TWO_STEP_PART3_WALK.html`, fixture `.probe/two-step-p3/fixture.mjs`,
    `--undo` after the walk). Coach door drawn and approved the same day (`BOARD_READY_TWO_STEP_COACH_RESET_DRAWINGS.html`,
    A1–A3 as recommended). What was built:
    - **The one reset order** `lib/two-step-reset.ts` (`removeEveryAuthenticator`, now also Part 2's turn off; `resetTwoStep`
      = signed out → removed → signed out again). **The club's rule** `lib/two-step-club-reset.ts` (`clubResetDoorRule`,
      `accountReachesAnotherPlace` = any live tie, fails toward support), read by the Members door, the coach door and "Lost
      your phone?" (`CLUB_RESET_DOOR_BUILT = true`). **The club's run** `lib/two-step-club-reset-run.ts` (rule again → the
      viewer's fresh code → reset → club audit line → email).
    - **Switches:** Settings card `TwoStepRequirementCard`, route `/api/admin/org-settings/two-step` (owner changes; admin
      reads, and gets the Settings tab and an open hub row for this card alone; ON needs the owner's own two-step; OFF asks the
      code and emails the club's other owners, admins and treasurer; audit lines `two_step_requirement_on/off`).
    - **Grace:** `lib/two-step-grace.ts` written at every place a covered seat begins (7 sites, test SEAT_STARTS); the login
      page sends a covered person with two-step off to the set-up page's club screen (`why=club`; the gate adds `why=required`):
      during the 14 days "Remind me next time (N days left)", after them "Go to my other teams instead" when the status
      route's `elsewhere` says so.
    - **Support's reset** `lib/two-step-support-reset.ts`: person record › Account (fact, door, record window with How/Why,
      waiting callout with Hold / Release / Cancel / Run it now), confirmation page + POST route (token hashed, 3 days),
      the club notice (no link, Reply-To the contact address), the 24 hours (dev-only `TWO_STEP_RESET_WAIT_MINUTES`, set to 3
      in `.env.local`), the hourly job route, cancel on a real code (the code step's call, the backup-code route, the sign-in
      landing). Audit lines person-level (org null, club in the value) so they show on the person's Story. Mig 469:
      `organization_id` nullable (support also resets a person who owns no club, as "Lost your phone?" already promises),
      token hash, expiry, club notice count, cancelled_by, one open reset per person.
    - **`/review` (high-risk, 4 lenses) found and fixed:** the hourly run CLAIMS a row before resetting (two runs, a hold or a
      cancel could reset twice or a held one); a failed removal never clears the mark for an authenticator that was not the
      person's own before it began; the coach door's seat read fails closed; Release asks for staff's code; a team moving in
      gives grace only to staff newly seated; a re-pressed confirmation re-sends an unfinished club notice; an expired
      unconfirmed request no longer blocks a new one; staff in a club's 14 days no longer loop on "Remind me"; the set-up page
      never returns to itself; the hub's locked Settings row for an admin; Story titles and audit doors; stale errors in the
      coach window; the card's "has until" wording.
    - **`/legal` (light):** no CASL blocker; must-fix applied (the club notice's "reply" had no Reply-To); Part 4 lines in
      `docs/agents/legal/TWO_STEP_SIGNIN_PRIVACY.md` § Part 3.
    - **Open owner calls from Part 3:**
      1. ~~An owner or admin whose own two-step is off can reset others / turn a requirement off with the password alone~~
         **RULED 2026-11-11 (owner, as recommended) and BUILT:** both reset doors show "To reset it, turn on two-step sign-in
         for your own account first" (`own_first` in `clubResetDoorRule`; the run refuses it before asking a code), and the
         switch route needs the owner's own two-step to turn a requirement on OR off.
      2. **Mig 470 (the hourly schedule)** — **owner yes 2026-11-11: applied to dev, its own commit**; on production after mig
         469 and the code (MANUAL_PROD_STEPS).
      3. **The contact address is the reset's hold line:** confirm `hello@fieldlogichq.ca` is read daily while a reset waits.
      4. Noted, not fixed: the support-only line tells an admin the account reaches *somewhere* else (accepted by the ask 3
         ruling); the club's audit line is written after the reset (support's is before); a super admin can start a support
         reset on a staff account; Help still says an admin can't open Settings (Part 4 `/docs`).
  - **Part 4 (what the club sees, and the words) — rulings at the UX summary (owner 2026-11-12, all four as recommended):**
    - **five emails, not two:** the two grace emails (when the 14 days start; 3 days before they end) AND the three account
      alarms the plan carried here from Parts 1 and 2 ("two-step was turned on" — Part 1 call 2 — "turned off", "your password
      was changed"), all with no link, all through `/legal`;
    - **Members reads only the club's own people:** the list's one platform-wide 1,000-account read (past it, emails and last
      sign-in went blank, and the new column would read Off) is replaced by a read of just this club's people, in this change;
    - **the 3-day email rides the existing hourly two-step job** (no new schedule), with one small database change: a
      "reminder sent" stamp so nobody gets it twice;
    - **one notice spot on Overview, two-step first:** the owner's one-time card and "N people still need to set up" share
      the single spot under the bar with the What's-new line, and a two-step notice goes first.
    - Session calls (stated in the summary, not objected to): the column, the phone line, the coaching-staff words and the
      export column are for owners and admins only (a treasurer or registrar who can open Members does not get them); a seat
      no switch covers (staff, volunteers) reads only On or Off.
  - **Part 4 BUILT + COMMITTED `24e5b9e45` 2026-11-12 (mig 475 applied to dev; prod BEFORE the code), walk §520 ✅ 29/29 2026-11-12** https://claude.ai/artifact/Rm73xYcDckZZzuPWv5c18b
    (`BOARD_READY_TWO_STEP_PART4_WALK.html`, built by `.probe/two-step-p4/build-walk.cjs`; fixture `.probe/two-step-p4/fixture.mjs`
    prompt | members | run-job | code | undo). Mig 475 applied to dev (prod BEFORE the code; MANUAL_PROD_STEPS). What was built:
    - **One read of the club's own people** `public.people_sign_in_facts(uuid[])` (mig 475, server key only) → `lib/two-step-club-status.ts`
      (`peopleSignInFacts`, `memberTwoStep`, `clubTwoStepWaiting`); the Members route no longer calls `auth.admin.listUsers`.
    - **Members:** `twoStep` on each row only for an owner/admin viewer (the route decides; the screen follows what came back);
      column, phone line, coaching-staff words, export column. Suspended = On/Off only. The board tab untouched (test).
    - **Overview:** `GET/POST /api/admin/org-settings/two-step/overview` + `TwoStepOverviewNotice` in the one notice spot, What's
      new as its fallback. The owner card closes on ×, Open Settings, the Settings card's owner visit, or a switch turned on
      (`two_step_prompt_closed_at`).
    - **Emails** (`lib/two-step-email-words.ts`, split out so tests read them): the two grace emails sent ONLY by the hourly
      two-step job (`lib/two-step-grace-emails.ts`; session call: also the "started" one, never inside the owner's press —
      paced, 15-second budget, claimed per deadline in `two_step_grace.start_email_for` / `reminder_sent_for`); the three
      account alarms from set-up verify, turn off, change password and the backup-code reset (5-second limit, after the
      change; they say only what happened).
    - **Copy pass** (`/marketing`, 35 word changes across Parts 1–4: "authenticator app" everywhere, "requires" not "asks",
      the lost-phone choices say what happens next, "owners, admins and treasurer", "N days left"). **`/legal`**: no CASL
      blocker; two must-fixes applied (the alarm emails no longer claim a sign-out or old-phone removal that failed); policy
      follow-through applied (privacy draft §3/§5/§9/§10 + notes, finding 5 reworded and open, LEGAL_FACTS line, BREACH_PROCEDURE
      fraudulent reset, L16). **`/docs`**: new "Two-step sign-in" section in the club guide (7 answers, 3 FAQs) and the coaches
      guide; Members, Settings and roles text (admins read the Settings card), sign-in help; the owner/admin role path.
    - **`/review` (high-risk, 4 lenses) found and fixed:** the job's 80-second budget against the app's ~30-second limit (an
      email could be lost); a give-back that could clear a newer deadline; the password email sent before the sign-back-in with
      no time limit; suspended members shown amber; a no-mail-key machine counting every hour as failed; a malformed flag that
      could fail the whole Members read; a line break in a subject.
    - **Open owner calls from Part 4:**
      1. **The plain "Forgot your password?" reset sends none of our alarms** (it changes the password in the browser). Covering
         it means switching on the sign-in service's own "password changed" notice in production Auth settings (not done: the
         project changes no production Auth settings). The alarms' own advice points people to that reset.
         **Closed another way (2026-11-18).** The owner switched the host's stock notice on that day and off again the same
         day. Production Auth has no custom mail server, so the host's mailer reaches only the project's own team: the stock
         notice never reached a customer, and on an in-app change it doubled our alarm. Instead our own "password changed"
         email now covers the ordinary reset too (`15514dbd9`, on `dev`; production gets it with the next promote, and until
         then an ordinary reset there sends nothing, as it always has). **Recommended (`/plan`, Data Terms follow-through
         Section 2): keep it this way.** That is option (b), already built. Option (a), pointing production Auth's mail at
         Resend and switching the stock text back on, is not needed: every account email already goes out from our own sender,
         and a second template would be a second wording to keep in step. Nothing is owed on rewording the stock text.
         Noted, not fixed: the route's "changed in the last 5 minutes" test reads the account's last-updated time, which other
         account changes can move too, so a signed-in person could prompt one "password changed" email to their own address after
         another kind of change (self only, at most one per 10 minutes).
      2. **The contact address now carries six emails' "write to us"** and the Part 3 hold promise: confirm it is read daily.
      3. **`TWO_STEP_CODE_KEY` on production** (Part 2 call 2) must exist and be backed up before the first backup code is made
         there (`/legal` carried it to `/release`).
      4. Copy-pass items left for you: the "Scan" step label on a phone (the drawn labels), the wait after too many wrong
         codes (the service's own number is unknown, so "a few minutes" stays), and whether Account's backup-code line splits.
      5. Noted, not fixed: a hand-edited earlier switch time could push a deadline later; the tournament-only Overview gets no
         notice (it never had the What's-new line either); the support reset's free-text Why has no "don't name anyone" hint
         or retention (L16, `/legal` asks for a `/plan` item).
  - **Build outline:**
    - server enforcement in the helpers above;
    - pages route a password-only session in a required seat to the code or set-up step;
    - our own hashed backup codes, unless the service's codes are stable by then;
    - the re-ask clock from the session's methods;
    - probably one migration: the organization's coach switch and test exemption, backup codes, grace start, and a
      waiting owner reset (existing org and platform audit logs, no new log), with the dictionary and snapshots in the
      same unit;
    - `/docs`: a new "Two-step sign-in" article plus Members, Account and sign-in help;
    - **no change to production Auth settings** (the authenticator is already on there);
    - verify first whether a Premium coach holds an org owner seat.
  - **`/legal` (light, 2026-11-10), no blocker:**
    - *Now:* the Terms draft §3 gains a "Two-step sign-in" paragraph (we may require it; the organization may
      require it; owner resets may take time and need confirmation), and §14 says requiring it for coaches is the
      organization's call, so a later launch needs no change notice.
    - *After the build:*
      - privacy policy §10 gains the drafted paragraph ("scrambled" only if the codes really are hashed);
      - §5 says admins see the on/off status, never codes, apps or devices;
      - §3 and §9 gain the new data kinds and their retention;
      - **finding 5 is reworded, not deleted**: after the ask 1 ruling, every club seat that can open medical notes
        is offered, and required only where the club switches it on;
      - the "No MFA exists" line in `LEGAL_FACTS.md` changes;
      - `BREACH_PROCEDURE.md` gains "a fraudulent reset";
      - the support note joins L16.
    - Applied to the drawings: the admin email no longer says why the owner asked, admins can hold the reset, the
      cross-organization refusal gives the club no reason, and the email reads "This email has no link on purpose".
    - CASL: all of these emails are non-commercial (security and account facts); keep any offer out of them.
    - For a lawyer, optional: the owner-reset check against PIPEDA 4.7, the Terms for a consumer coach, and consent for
      telling the club's admins.
- [x] Org delete removes its file storage — built, committed `45c134bea` 2026-11-15 (`BOARD_READY_ORG_DELETE_FILES_PROMPT.md`;
  deployment state: the release-history record). Demo clubs refused (owner 2026-11-15). Findings: deleting one tournament,
  rep team, player or person still leaves its files; the dev club fixture files sample documents under the web name.
- [x] Backups: confirm what the Pro plan does (daily backups vs point-in-time recovery), decide whether PITR is worth the add-on, and write it down in `docs/agents/ops/`.
  **Done 2026-11-18:** the trust close-out checklist's Part B (the backups read off the host's screen, 8/8) and Part C
  (the first restore rehearsal, 16/16) passed; written in `docs/agents/ops/BACKUPS_AND_RESTORE.md`. Ticked 2026-11-19.
  **RULED 2026-11-16 (owner): daily backups are sufficient; no point-in-time recovery add-on before a single customer.**
  Left: write down what the daily backups are (how long they are kept, read from the host's page, not from memory).
  **Owner's steps written 2026-11-16** in the same checklist (https://claude.ai/artifact/2KZrC64ucjBpWCgMkfPCej):
  Part B reads the backups off the host's screen; Part C rehearses one restore into a separate project and deletes
  it. The ops write-up in `docs/agents/ops/` is written from his paste-back. What the host's own pages say (read
  2026-11-16, to be confirmed on screen in Part B): Pro keeps the last 7 days of daily backups;
  **a database backup does not include uploaded files** (logos, rules files, player documents: only their records),
  and a deleted file cannot be recovered, so the pack says "daily backups of the database" and never implies files;
  a restore over the live project means downtime.
  **Finding while writing the rehearsal (2026-11-16):** a restore into a new project copies the scheduled jobs and the
  Vault keys, and the host starts those jobs at once, so the copy calls the live site's job routes with a valid secret
  (the 5-minute game-change notices and the 15-minute web-address check included). Part C switches the copy's jobs off
  and deletes its two keys by hand; both statements were proven on dev in a rolled-back transaction. The durable fix
  (the live site refuses a second caller for the same job and minute) is the checklist's call 21, and matters before
  the roadmap's quarterly restore drill.
- [x] Publish the legal pages (privacy policy, terms) already tied to `GST_HST_STAGE6_TERMS_PLAN.md`, so this plan does not duplicate that work.
  **Done 2026-11-17** (GST/HST Stage 6 step 6.7: both frozen as version 2026-11-17 and switched on; deployment state is in
  the release-history record). Ticked 2026-11-19.
- [ ] Data-processing terms for clubs and a sub-processor list via `/legal`. **Drafted 2026-11-18** (`docs/agents/legal/drafts/DATA_TERMS_FOR_ORGANIZATIONS.md`, `drafts/SUBPROCESSOR_LIST.md`; research `BOARD_READY_DATA_TERMS_REVIEW.md`); **owner questions 1–11 RULED as recommended 2026-11-18**; **both texts owner-approved and the owner's five steps done 2026-11-18** (ImprovMX agreement countersigned; the host's "password changed" email switched off; server logs expire after 90 days; supplier notices subscribed; the four dates filled); `/accounting` answered the objection refund (0a-6 below) and `/plan` planned the two pages (0a-5 below). Left: the `/legal` record pass and Terms edits, and the AI rule written into `AGENCY_RULES.md`.
- [ ] **0a-5 · The Data Terms page and the list of companies** (planned 2026-11-18, `/plan`, Data Terms follow-through
  Section 2; no code yet). Brief: `docs/agents/legal/DATA_TERMS_ACCEPTANCE_NOTE.md`. Both texts owner-approved 2026-11-18.
  - **What a club sees (UX summary).** Two new public pages beside the Terms and the Privacy Policy, reached from the same
    places: the site footer's legal links, Terms §4, and later the Security page.
    - *Data Terms for organizations*: what we promise about the club's data. It is part of the Terms, so it changes only
      when the Terms get a new version; each version keeps its own dated page, with the same "earlier versions" line as the
      Terms. Nobody ticks anything new: a club's existing Terms tick covers it, and the acceptance record does not change.
    - *The companies that handle your information*: one page naming each supplier, what it does, whose information it
      touches and where. It is a living page: it changes without a Terms version, and every change adds a dated row to its
      "Changes to this list" table.
    - A new supplier: the owner emails each organization's owners by hand from the business address, 30 days ahead, and
      records the date in that table. No send button is built at today's size.
    - Who: everyone (public pages, no sign-in, no plan gate). Nothing changes inside the product.
  - **Recommended sequence (by dependency).** Both pages go live the day the held Terms version publishes with the
    Payments Terms, and T1–T4 ride that version:
    1. *Build the shape ahead* (one session, any time before that day; no database, no drawing, as the pages use the
       Terms' page layout): routes, registry entries, guards, footer links. With no version file yet both pages answer
       "not found" and the footer shows no extra link, so the build can reach production early and show nothing.
    2. *On the publishing day*, the commit that freezes the held Terms (with T1–T4), the privacy version (P1–P4 name
       ImprovMX) and the Payments Terms also writes the Data Terms version at the Terms date and the list's first version.
       The owner reads them on dev before the promote, as at 6.7.
    - **The Payments Terms day is never held for these pages.** If step 1 is not built by then, the held Terms publish
      without T1–T4, and T1–T4 and both pages ride the next Terms version (a minor change with no fresh acceptance, so the
      fallback costs one more version and nothing else). The privacy draft already cuts its list sentence on the same rule.
    - The list never goes live before the privacy version that names ImprovMX (the list draft's own rule); the cross-check
      guard below enforces it.
  - **Fit to the existing legal pages** (census 2026-11-18):
    - *Data Terms*: a frozen dated file per carrying Terms version (`lib/legal-documents/data-terms/<terms-date>.md`), its
      sha256 in `lib/legal-documents.ts`, checked by `tests/unit/legal-documents.test.ts` exactly as the Terms and Privacy
      are (frozen hash, every file listed, no owner notes or brackets). New guard: every Data Terms version date is a Terms
      version date and that Terms file names the Data Terms (T1), so the Data Terms can never change without a Terms
      version. The page in force is the newest Data Terms version at or before the Terms `current`. It is not a door
      document: `legal_acceptances`, the doors' `currentVersion` and the accept-again screen are untouched, and a guard
      asserts the doors still record only Terms and Privacy. Check while building whether adding it to `LegalDocKey`
      widens any door's loop; if it does, give it its own registry entry instead.
    - *The list*: one living file (`lib/legal-documents/subprocessors.md`) with a registry entry `{ lastChange, sha256 }`.
      Guards: a text edit without a new dated change row and a moved `lastChange` fails the build (the table cannot be
      skipped); `lastChange` equals the newest row; every company in the list's table is named in the privacy version in
      force (the drift the page exists to prevent, and what keeps the list from going live before ImprovMX is named); no
      owner notes or brackets.
    - *Addresses*: built only in `lib/legal-paths.ts` / `lib/legal-links.ts` (the legal-links guard): `/legal/data-terms`
      (and `/legal/data-terms/<date>`) and `/legal/subprocessors`, with short redirects `/data-terms` and `/subprocessors`
      shaped like `/privacy` (the frozen Terms link by the short form), added to the route list in
      `tests/unit/legal-links-surfaces-guard.test.ts`; in no sitemap.
    - *Links*: the marketing footer (`components/Footer.tsx`), each link rendered only when its page has a version. Not
      `LegalFootLinks` at the sign-in doors: those keep Terms and Privacy, the two things a person accepts there. Phone
      width checked with `check:layout --changed` (four links in the footer row).
    - *The draft preview cannot serve these.* Since 6.7 the switch is `published`, so preview mode never runs
      (`lib/legal-pages-switch.ts`). Nothing is revived for it: the texts were approved from the drafts, and the owner reads
      the rendered pages on dev after the publishing commit.
    - Security page (0c): links both through `legalPageHref` when it is built.
  - **Asks — RULED 2026-11-19 (owner: "I agree with your recommendations", all three as recommended):** (1) T1–T4 ride the held Terms version, with the
    fallback above; (2) the addresses `/legal/data-terms` and `/legal/subprocessors` ("sub-processors" is the word a
    board's checklist uses; the page title stays in plain words); (3) the footer only, not the sign-in doors.
  - **Words for `/marketing`** (one pass in the build session): the two footer link words and the list page's title line.
  - [x] Build session (the shape): routes, registry entries, the guards above, footer links. `/docs` writes the help line
    that names the pages for the publishing day, not before (help must not point at a "not found" page). **Built
    2026-11-19.** Both pages answer "not found" with no
    title, and the footer shows neither link. Three things differ from the fit above, on purpose:
    - *The list is frozen dated copies, not one living file* (`lib/legal-documents/subprocessors/<date>.md`, the Terms'
      own mechanism). One file plus its hash could not prove a new change row was added: an editor could update the hash
      and skip the row. Now each change is a new copy that adds exactly one row dated that day and leaves every earlier
      row as it was. The newest copy is the page; older copies are the record of what the list said, not pages.
    - *Neither page is a `LegalDocKey`.* That key is the doors' acceptance contract (`current` / `oldestAccepted`, and a
      test requires both once published), so adding the Data Terms there WOULD have widened it. They have their own
      registry entries, and a guard pins the doors to Terms and Privacy.
    - *Added by the review:* the words `data-terms` and `subprocessors` are reserved org addresses; a "§N" after "Data
      Terms" or "Payments Terms" on the Terms page no longer links to the Terms' own section (the held Terms draft has
      both); no text in force may link a page with no published text (so the same-day fallback is enforced), and the
      Data Terms in force must be linked from the Terms in force.
    - Words (`/marketing`): footer links "Data Terms" and "Companies that handle your information"; the list's title "The
      companies that handle your information"; under it "Last changed {date}" (`/legal`: a list changes on the notice
      day, before the company starts, so "Effective" would misstate it).
    - Advisory for whoever builds the Terms' `upcoming` version: a page refuses a version newer than the one in force.
  - [ ] Publishing commit (the Payments Terms day): the version files, T1–T4 in the Terms, the Data Terms §6 address filled.
    The build checks each file as it lands (`tests/unit/legal-data-terms-and-list.test.ts`):
    - each file starts at its first section: no `#` title, and no heading repeating the page title (the list draft's
      "## The companies that handle your information" is not copied);
    - the Data Terms file is named for the Terms version date, and that Terms text links `[Data Terms for
      organizations](/data-terms)`;
    - the list's first copy is named for the day it publishes, and its one change row is dated that day in words
      ("November 19, 2026");
    - every company in the list's table is in bold and named in the Privacy Policy in force, so the privacy version that
      names ImprovMX publishes the same day;
    - each change row names the day a new company STARTS (`/legal`), since the copy publishes on the notice day.
- [ ] **0a-6 · Refunding unused plan time** (`/accounting` 2026-11-18, `docs/agents/accounting/REFUND_UNUSED_PLAN_TIME.md`;
  it serves the Data Terms §6 objection refund and the Terms §8 "we end your plan" refund). Workable by hand today:
  platform admin "End now" on the day the club picks, then "Refund this charge" → Part of it, which issues a credit note
  reversing the tax. Two gaps, no code yet:
  - [ ] (a) Nothing computes the unused part: staff work out days left ÷ days paid × the before-tax amount by hand. A
    figure on the refund screen (the paid period and the end date) would remove the arithmetic. **HELD (owner
    2026-11-19)** until the first such refund is near; until then the `/accounting` note is the procedure. Not built.
  - [x] (b) Can a coach paying for several portals be refunded at all? **Checked 2026-11-19: no real case today.**
    - **The refusal:** `clubStripeFacts` → `customerSharing` (`lib/console-money-store.ts`, `lib/console-money-stripe.ts`).
      It marks the customer shared when the number of `organizations` rows carrying it is not exactly 1, or when a
      portal on it is paid by another club or by no payer. A shared customer is refused everywhere in the console: the
      refund route returns "That charge is not this club's." with nothing sent, and the Money tab itself answers
      `shared` and reads no charges.
    - **Why a coach hits it:** a second portal's checkout reuses the coach's own Stripe customer
      (`buyerStripeCustomer`), and payment writes that customer onto each portal's organization row (`lib/team-checkout.ts`).
      Two personal portals means two rows, so the customer counts as shared. The `coversOtherPortals` carve-out only
      applies when a single organization row carries the customer.
    - **Production, counts only (2026-11-19):** 5 organizations, 1 portal, **0** organizations or portals with a real
      Stripe customer. So there are 0 customers on two or more organizations, 0 of them coaches' portals, and 0 coaches
      paying for two or more portals.
    - **Fixed anyway, owner "go ahead with the fix" (2026-11-19):** the first coach to pay for a second portal would have
      been refused. `customerSharing` now takes the list of organizations holding the customer. Several holders are not
      shared when every one is a portal the SAME person pays for as a person (no club payer). Anything else stays shared:
      two people, a club's own record, a portal another club pays for, or a portal with no payer. The rule runs everywhere
      it did before (each portal's Money tab, its refund, Needs a look, the Today count, the GST/HST return's "which club
      shows it"), and Find now asks the same rule instead of its own stricter copy. That copy had hidden a coach's portal
      even with ONE portal. Each portal reads the coach's whole customer, with the existing "covers other portals" line.
      This is the read the console already used for a coach's single customer, so ownership stays customer-wide. It is
      not per subscription: `/accounting` confirmed the credit note and our tax records follow the charge's own invoice,
      so the books are right from either portal's tab. Its note gained step 5: pick the charge for the portal being ended.
  - Note: Billing staff cannot refund a charge older than 6 months, so a late-year refund of a yearly plan needs Super admin.

**0b · ~~Canadian data residency~~** **RULED NOT MOVING** (owner 2026-11-10; §8 keeps the estimate). The pack states
plainly where data lives (USA, with the suppliers named), and that is all it needs to say.

**0c · The board pack** (written for a club board, not engineers; built after 0a so it can be honest). It answers the
board's two questions:
- [ ] **"Does our data leak, and is it sold?"** Security & privacy brief, two or three pages:
  - **never sold or shared for marketing**, backed by code facts in `LEGAL_FACTS.md`: no third-party analytics,
    advertising cookies, AI service or SMS;
  - who can see what (by seat, with the role table), and that platform staff access is audit-logged;
  - encryption;
  - sign-in (ruled 2026-11-10; the pack's line as written in two-step Part 4, 2026-11-12, use it as is): **"Two-step
    sign-in is available to everyone, and your club can require it for its board and coaches; FieldLogicHQ staff always
    use it."** Only once two-step is on production (the pack is built after 0a, so it can be honest);
  - how payments work: the club is the merchant and no card data is held;
  - backups and the breach procedure;
  - the club owns its data and can export and delete it;
  - sub-processors and what each does, with only the certifications stated on each supplier's page.
- [x] The **privacy policy published** (it is the promise "we don't sell your data" in writing), via the legal-pages
  work already tied to `GST_HST_STAGE6_TERMS_PLAN.md`. **Done 2026-11-17** with the Terms (the 0a box above). Ticked 2026-11-19.
  **Read this as "published in code".** Production reaches it with the promote that carries the legal-pages switch (the
  release history holds the day); on 2026-11-21 production was still `f12aad4d9` and the live pages answered "not found"
  (`/legal`, `docs/agents/legal/MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` §0). Until then nothing says "our published policy".
- [ ] **Security & privacy brief: WRITTEN 2026-11-21** (`/legal`), `docs/agents/legal/drafts/SECURITY_BRIEF.md`,
  published privately for the owner to share: https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR. Every line true on
  production today; its "Revise when" list names the releases that let it say more. The box above it ("Does our data leak")
  stays open until the owner has sent it.
  **v0.2 2026-11-21 (owner: "go ahead with both"): made generic for any prospect, with the checked diagram** (same link;
  the source file renamed from `MILTON_BOARD_SECURITY_BRIEF.md`).
- [ ] Architecture diagram and data-flow diagram (what a family's sign-up touches, end to end). **The architecture half is
  DONE 2026-11-21:** the "where your information lives" diagram, checked label by label (`/legal` review rows 1–10), is in
  the brief. **Left:** the data-flow diagram, drawn from today's sign-up (not from the custom-form parts until they are on
  production).
  **Data-flow diagram DRAWN 2026-11-24 (round 1, after `/design` and `/legal`):** source
  `BOARD_READY_DATA_FLOW_DIAGRAM_DRAWINGS.html` (house-league sign-up, seven numbered steps, a phone step list, a "kept and for
  how long" table). `/legal` corrected it against the code: waiting files go "within a day" (older than 12 hours, swept every
  six hours); sign-up answers are readable by anyone the owner gave House league to, not only four roles; the payment step
  happens later from the family's own link. Four owner calls (retention wording, the coaches line, the payment step, where
  it lives), paste-back "Board Ready 0c data-flow drawing, round 1, my calls". **ALL FOUR RULED 2026-11-24, every one as
  recommended (1A 2A 3A 4A):** (1) the table says plainly that ordinary answers have no automatic removal date and go with
  the club if the club is deleted; (2) the coaches line stays as worded (a coach sees a family's name, email and phone for
  their own team, and no answers unless the owner gave them House league); (3) the payment step is drawn in the present
  tense, "where online payments are on"; (4) the picture lives in the board pack only, beside the brief, not on the public
  Security page. Published for the ruling: https://claude.ai/artifact/BRobdR7zpV3dM8EG26hopW (private). The drawing is
  ruled as drawn; nothing on it changes. **Placed in the brief 2026-11-24** (the private brief Artifact, version 6, a new
  section "What happens to a family's sign-up" after "Where your information lives"; `/legal` read the placement and four
  corrections went into both the brief and the drawing: the caption no longer counts "three" companies, step 6 happens
  whenever staff open the answers, the desk notice is bell-only unless a person turns a phone alert or email on, and the
  second parent's email is named). The brief's footer keeps 21 November and names the section and the payment wording as
  checked 24 November. **Gaps it exposes, for `/plan` and `/legal`:**
  the privacy policy states no clock for waiting files or for health and file answers although the sweeps run; ordinary
  registrations have no removal date and a club cannot delete one itself; any member given House league can read health
  answers (a lawyer's eye). Same pass: the Security page's two "families can't pay online yet" sentences now say families and
  teams pay on Stripe's page where a club has turned online payments on (owner: payments are on in production).
- [ ] A filled-in vendor security questionnaire (the common short form), so the next board gets it on request.
- [ ] A public **Security** page on the marketing site, drawn from the brief (`/marketing` words, `/legal` review).
  **Scoped 2026-11-21 (owner ruling: the brief becomes the public Security page, for any prospect).** Recorded, not built.

  **PM brief.** *What it does:* puts the security brief at fieldlogichq.ca/security, open to anyone, with the diagram.
  *Why it matters:* every club board asks "does our data leak, and is it sold?"; one public page answers it before the
  first meeting, and the owner stops rewriting it per prospect. *Who benefits:* prospects' boards and presidents
  (no sign-in); the owner in sales. Not plan-gated. *Expected impact:* a link to send instead of a document to write; the
  club pages' board questions point at it. *Priority:* High while the club tools are being sold (it is the pack's first
  page). *Success:* the page is live with the legal pages, every line traces to a `/legal` row, and it is re-checked at
  every promote with no line ever untrue on production.

  **Depends on (in order):** the legal-pages switch reaching production (the page is built to ship in **that same
  release**, so it can link Privacy and Terms; until then nothing on it may say "our published policy"); the brief text
  as it stands then (`docs/agents/legal/drafts/SECURITY_BRIEF.md`, its "Revise when" list applied for whatever that
  release carries). The Data Terms and supplier-list links join when those two pages publish.

  **Steps:**
  - [x] S1 · Words: `/marketing` pass on the brief text as page copy (one pass; no prices, plan names or offers; never
    "Canadian" hosting, a certification of our own, or the owner-continuity question, ruling 0d). **Prompt written
    2026-11-21:** `BOARD_READY_SECURITY_PAGE_S1_WORDS_PROMPT.md` (edits the brief in place, so the private brief and the
    page stay one text; settles "date of birth" vs "birth date" with "Questions a board asks").
    **Done 2026-11-21 (`/marketing`, `/legal` on every moved sentence):** the brief is v0.4, the page copy; the private
    page republished at the same link (version 5), diagram unchanged. Moved: the opening ("Two questions come first…"),
    the never-sell bullets folded into the short answer, "What's never on a public page" as its own section, headings,
    the year on the restore. Written for S2/S3: page title "Security and your club's information", the search
    description, eyebrow and footer link "Security", "Read more" with and without the Data Terms, the "as of" line (moved
    only by a full re-read at a promote). Four held lines (W2, W8, W9, the 30-day full copy) wait for the Data Terms.
    **`/legal` finding:** the full-copy line follows the club pages' rule on the public page (Data Terms published, or
    the owner confirms the by-hand procedure, club on-sale plan Ask 29); the private brief keeps it on review row 38.
    **Tasks this leaves for S3:**
    - [x] `BoardQuestions.tsx` answer 3: "birth date" → "date of birth" (the product's field labels say "Date of birth",
      15 to 2). Built in S3, 2026-11-21.
    - [x] `BoardQuestions.tsx` answer 3: a second link, "See how we protect it" → `/security`, after "Read the Privacy
      Policy". Built in S3, 2026-11-21.
    - [x] The full-copy line and answer 4's "or ask us for a full copy" on one rule (above), switched together: both ask
      `fullCopyOffered()` (`lib/full-copy-promise.ts`); the owner's Ask 29 confirmation is its one constant. Built in S3.
    - [x] The held lines and "Read more" version B switch on together with the Data Terms and the list of companies.
      Built in S3 (both pages published = version B; tests hold it).
    - Noted, not S3: the wider "birth date" / "date of birth" drift in help articles and the duplicates cards (a spelling
      chore; the gate does not hold the pair today).
  - [x] S2 · Drawing: `/design` on the page (the marketing site's own layout and the diagram as an inline drawing in the
    site's kit, both themes, phone width) before the build. **Prompt written 2026-11-21:**
    `BOARD_READY_SECURITY_PAGE_S2_DRAWING_PROMPT.md` (nine questions: the frame, the short answer, the diagram's phone
    form with its ten labels unchanged, the two tables on a phone, before and after the Data Terms publish, the "as of"
    line and contact, the two doors in, print, the share card).
    **Drawn 2026-11-21:** https://claude.ai/artifact/9yp7PVd33SjyRQrSBqXZmv (source
    `BOARD_READY_SECURITY_PAGE_DRAWINGS.html`; `/design` pass on the render: no word past a box, no sideways scroll at
    390px). Eleven asks, ranked, each recommended: (1) the legal pages' document head, not the 64px headline (the
    2026-11-09 legal-pages ruling; with the headline the third short answer leaves a laptop's first screen); (2) the
    diagram redrawn in real text at true size, a desktop form from 768px and a stacked phone form below, every label and
    the accessible description word for word, the on-sale panel and inks but not their sketch style; (3) the short answer
    as one white card; (4) suppliers as labelled cards on a phone, roles kept a two-column table (an exception to the legal
    table rule); (5) the "as of" line under the opening, once; (6) version B links "Our public list" and "The Data Terms";
    (7) the footer and answer-3 doors as drawn; (8) a minimal print view; (9) the site's share card; (10) no Dark version
    (marketing is always warm, Ask 5 B, so the prompt's Dark frames are not drawn); (11) the privacy address as a link, no
    copy button. `/legal` on the six moves: all say as is (hrefs from the legal-links helper; the brief's "Revise when"
    now names the diagram's accessible description). No new word. **RULED 2026-11-21 (owner: "i agree with your recommendations, go ahead"): all eleven as recommended.** S3 build prompt written the same day: `BOARD_READY_SECURITY_PAGE_S3_BUILD_PROMPT.md`.
  - [x] S3 · Build `/security` as a public marketing page (static, no data reads), with a footer link beside the legal
    links, and the club pages' "Questions a board asks" pointing to it. Gate it with the legal pages: rendered only
    while they are published (the same switch `BoardQuestions` already follows), so it cannot go live ahead of them.
    `npm run check:spelling` on the copy.
    **Built 2026-11-21 on dev, to the ruled drawing** (committed `f9197cb05`; owner walk §554 **passed 33 of 33,
    2026-11-22**, https://claude.ai/artifact/MsJw2L8YVgvKyxuKZhoWPG, source `BOARD_READY_SECURITY_PAGE_WALK.html`). The page's
    words have one home, `lib/security-page-words.ts` (the brief is v0.5, a pointer plus its records; the private brief
    Artifact keeps its own copy, unchanged). "Not found" while the legal pages are off; in the sitemap only while they are
    on (owner 2026-11-22), the legal pages themselves in none; "security" reserved as an organization address. The diagram is both forms copied coordinate for
    coordinate, with ONE move: "sends email" x 208 → 192 (it crossed its arrow; 192 mirrors "sends an alert"). Below a
    390 screen the diagram panel's side padding gives way so the words stay full size to a 358px screen (at 320 the phone
    form scales to 88%, smallest word 11.8px); the phone form stands at its drawn 310 up to the 768 switch. The roles
    table's exception is TABLE_EXCEPTION_REGISTER K-32. Reviews: `/design` (one fix: the table heads in the body face;
    the label move; the 310 cap), `/legal` (say as is throughout; version B needing both pages confirmed).
    **Owner calls from the reviews:** (a) the legal pages' table heads set in the display face (`.text th` inherited the
    global `th` rule): **ruled and built 2026-11-21** (owner: "make the legal pages table head fix"), one rule in
    `LegalPage.module.css`, so the Terms, Privacy, Data Terms and list pages and /security all set column heads in the
    body face; (b) the contents list has no "current section" mark (the drawing shows one on the first item; the legal
    pages have none): **ruled 2026-11-22 (owner, "go with your recommendations"): no mark is built; the drawing's mark is
    dropped so the drawing and the page agree**; (c) the sitemap: **ruled 2026-11-22 (owner, same words): list the
    page, only while the legal pages are live (the same switch), so it never points search engines at "not found"**;
    **both built 2026-11-22 on dev** (the sitemap entry reads the page's own switch and sits on our own host only; the
    drawing's one mark rule is removed; the sitemap guard test now pins the entry behind the switch). `/review` (four lenses, 2026-11-21): no Critical, High
    or Medium left; applied: the route reads per request like the legal routes, answer 4's clause tested in both
    states, three print rules raised to win by specificity (tables on 1in-margin paper, the white ground, no 44px
    lines). **Follow-up recorded, not built (older than S3):** an organization's web address can be RENAMED to a
    reserved word ("security", "legal", "pricing"…): the two rename paths (the org's own settings and the platform
    admin's identity edit) check only the pattern and uniqueness, not `isReservedOrgSlug`; org create does. No
    organization holds "security" on dev or production (counted 2026-11-21).
  - [ ] S4 · `/legal` reads the page as built against production at the promote (every line still true that day; the
    Data Terms lines only if those pages are live).
  - [ ] S5 · A `/release` checklist line, so the page is re-checked at every promote against the brief's "Revise when"
    list: family payments switched on, `45c134bea` (club deletion removes files), the Data Terms lines (72 hours, 30
    days' notice, a full copy in 30 days), the access follow-ups on production ("every finding resolved" per sweep call
    22), a supplier change, the production-rows AI rule. (A change to `.claude/commands/release.md`; made in its own
    commit when this is built.)

  **Two product findings from the same `/legal` read**
  (`docs/agents/legal/MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` §4), recorded here:
  - [x] **D1 · The staff "pages opened" promise.** Privacy §5 (published in code 2026-11-17) and the Data Terms §5
    (approved, unpublished) said "every page they open in our own tools is recorded"; the record-opens log held club,
    person and sent-email records only. **Owner call ruled 2026-11-22 ("go with your recommendations"), built on dev
    2026-11-22 on his "go with your recommendations" to the build list:** feedback and early-access lead records are now
    logged (mig 521 widens the table's allowed kinds; `tests/unit/records-opened-census-guard.test.ts` pins exactly five
    record doors, each written after the record is found; the club page no longer writes a row for an address with no
    club); the sentence is narrowed to "every club, person, sent email, feedback or early-access lead record they open"
    in the Privacy draft 0.6 (§5, §10), the Data Terms draft §5 and the live Security page. Not logging every page.
    **Read by `/legal` 2026-11-22:** every sentence true of the code once mig 521 is on production; no advance notice
    owed (a narrower promise, no new use of data); `LEGAL_FACTS.md` corrected (a failed write to the log is NOT silent:
    it opens an issue and can email an alert, leftover call 18 (a), so the earlier "fails silently" note here was out of
    date). **Owed:** mig 521 on production BEFORE the promote (`MANUAL_PROD_STEPS.json`, pending); the Privacy draft 0.6
    and the Data Terms publish later with the Payments Terms (the published 2026-11-17 text is frozen). **Last call
    ruled 2026-11-22 (owner, "go with your recommendation"):** §5 does NOT also name the page-visit list. §9 already
    discloses it, and naming it beside the records log would re-promise a list that is browser-driven and can miss a
    visit. Nothing is left open on D1 but the production steps above.
  - [x] **D2 · The database's member test.** Until migs 505 and 506 are on production, a pending invitee's or suspended
    member's own browser can read the club's venues and teams. **Already queued**, no new work:
    `BOARD_READY_TRUST_FIX_PROMPTS.md` hand-off (505 and 506 either side of the promote). The Security page says nothing
    about suspended members until they are applied.
- [ ] **The public roadmap** (owner 2026-11-14: the pack carries a product roadmap; 2026-11-16: it is public, for any
  customer or prospect, and names no club's asks). The record is `docs/agents/strategy/PRODUCT_ROADMAP.md`; this plan
  does not restate it. **Drawn and all thirteen asks ruled 2026-11-16:**
  https://claude.ai/artifact/FUnEBQmUoNWojM12zgkvau (source `BOARD_READY_ROADMAP_BOARD_VERSION_DRAWINGS.html`). Owed
  before it is shown to anyone (the record's §4): `/legal` on the four "Your data is yours" commitments, the owner's
  plain line for two product lines, and a snapshot of the version shown.
- **Two wording rules the roadmap rulings set for the brief and the Security page** (2026-11-16): "restore rehearsed"
  is said only after the first rehearsal is done; "every finding fixed" only after the third sweep's open owner calls
  are closed.
- ~~Optional (owner Q5): an independent penetration test, with a summary letter for boards.~~ **Ruled out of scope 2026-11-15.**
  Instead the brief and the Security page state the checks we run ourselves.

**0d · "What if something happens to the owner?"** (board concern 2026-11-10; the owner plans it **later**)
**RULED 2026-11-16 (owner): not in the board pack.** The pack, the brief and the Security page do not raise it; the owner
answers it himself if a board asks. The items below are not started unless he calls them.
- [ ] Quick message points for the board, to use until the full write-up exists.
- [ ] A `/legal` session: what the terms promise on continuity (notice before the service stops, data export window,
  the club's data handed back), and whether anything needs a legal instrument.
- [ ] The continuity write-up. Candidate contents, for the owner to choose from:
  - who can step in (a named trusted person with sealed access to accounts);
  - a runbook so the service can be kept running or wound down;
  - the club's standing ability to export everything;
  - the notice period;
  - what happens to stored data.

### Stage 1 — Friend requests (item 2)
**State (trued up 2026-11-16): built in three parts, all committed and walked, in `release/2026-11-15`.** Part 1
`9269b5eab` (walk §510 25/25), Part 2 `f291a8bb1` + the nightly job `3628b51a1` (§516 37/37), Part 3 `06a2b17f1`
(§518 48/48), wording follow-up `81e3967e0`. The boxes below are the plan as first written; what was built follows the
drawings and the rulings A1–A15 further down, which differ in places (one "Together" place on the board rows, the
keep-together group fixed at 3). Left: the owner calls in the three "Part N" notes and the `/legal` document
follow-ups.
- [x] Sign-up form: per child, "Who would you like {child} to play with?" Up to the **club's set maximum per child,
  default 2** (owner ruling 2026-11-10, Q3), first + last, plus an
  optional "their parent's name" to help the match. Each confirmed sign-up shows a short **friend code** on the
  "Your sign-up" page (no new link to families), and a parent may enter another family's code instead of a name.
- [x] Registrar **Friend requests** queue in the season's registrations: each request shows its best suggestions from
  this season's sign-ups in the same division (normalised name, then parent name). The registrar chooses **Confirm**,
  **Pick another**, **Not signed up** or **Can't honour**. Code matches arrive confirmed. A request made both ways is marked
  "Both asked".
- [x] Draft: confirmed requests become a **keep-together** group, using the "Families together" machinery. Groups are
  capped at a size (Q3) so friend chains can't break team balance, and the convenor can split one. After a draft, every
  request reads **Honoured** or **Not honoured — why** (cap, division, locked).
- [x] Draft board: a Friends filter and a mark on the player chip, just like siblings. (Built as the drawings' option
  B: one "Together" place for family and friends.)
- [x] Transparency is **for the club's admins**: after the draft they see every request as Honoured / Not honoured,
  with the reason. **Parents get no honoured / not-honoured message** (owner ruling 2026-11-10, Q3). On "Your sign-up" a
  parent sees only what they asked for, and never another child's details.
- [x] Migration first (request rows + code), then `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`.
- [x] `/legal`: a parent typing another child's name, and how long requests are kept (purge at season end).
  **Done 2026-11-10 at the drawing session** (findings below, applied to the drawings).
- **Drawings (2026-11-10, round 2 after `/design` + `/legal`):** https://claude.ai/artifact/KxYr8LW6r5yvsUJ7FmvPL8
  (source `BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html`). Eight tabs: the parent's question, the friend code, the
  settings, the Friend requests queue, the draft board, tidier board rows (5b), after the draft, list + export, asks.
  **ALL ASKS RULED 2026-11-10** — owner: *"i agree with the recommendations in the mockups, i like your proposal in 5b
  as well"*. Every ask A1–A15 is ruled as the drawing recommends: A12 the single trigger, not the earlier 30-day
  option; A13 including the four `/design` proposals drawn in; A14 option B. **The drawings as published (version 3)
  are the build's source of truth.** Agreement is not a go to build: the build prompt comes next, and the build starts
  on the owner's go.
  - **Corrections to this stage, found reading the code:** (1) "Families together" is **not a stored setting**. It is a
    switch in the *Run the draft* window, on by default, shown only when a division has siblings. So the maximum per
    child goes in the Overview's Registration block, and *Keep friends together* sits beside it in the draft window
    (ask A9). (2) **No house-league registration import exists**, from TeamSnap or any file, so there is no column to
    map (ask A4). (3) Today's name matcher only lower-cases. Friend suggestions need accents, hyphens and apostrophes
    ignored, and a first-name prefix treated as similar. (4) The draft has **no group-size cap** today; a family unit
    is placed whole whatever its size.
  - **Asks, with the drawing's recommendation:** A1 group cap fixed at 3 (not club-set); A2 cross-division requests
    allowed at sign-up, shown as "Different division" in the queue (refusing at sign-up would tell an anonymous visitor
    a named child is registered); A3 the result is read live from the teams and nothing re-deals; A4 re-framed, no
    import to map into; A5 families may change requests on "Your sign-up" until their division's teams are made; A6
    the cap never splits siblings; A7 links kept by Both asked, then code, then earliest confirmed; A8 the maximum
    offers None / 1 / 2; A9 the switch lives in the draft window; A10 the code goes in the confirmation email as text;
    A11 requests are seen only by seats that can open Registrations, on every surface; A12 delete when the season is
    marked finished, or 60 days after its last day, with the purge built in this stage; A13 Friend requests is a fifth
    Registrations view with its own amber count (plus four `/design` proposals drawn in for a yes). Added in round 3
    from the owner's note on the crowded board rows (tab 5b): A14 the marks get fixed places in the row, with family and
    friends merged into one "Together" place that turns amber when the group is split (option B; A = one place per
    mark kind); A15 the rating column is headed "RTG", not "RK", because it is a 1–5 rating where 5 is strongest. Names
    already wrap on the real board, so no full-name hover is needed.
  - **`/legal` findings (2026-11-10, applied to the drawings):** the club is responsible for the typed names and
    FieldLogicHQ is its service provider. A non-member child's name is the weakest point (indirect collection), so add
    a caution line on the form. The in-form privacy line must not over-promise: more than one seat sees the names, and
    **nothing purges automatically today**, so the purge ships with this stage or the promise changes. Add a "Delete
    request" action so the club can answer an erasure request. Keep friend names out of "Excel with contact details".
    A code in the confirmation email is transactional if it is neutral and carries no referral push.
  - **Build rules from `/legal`:** typed names are used only for placement (no outreach to a "Not signed up" family,
    never fed into families, people or prospect lists). Requests hang on the season's registration, not the child's
    cross-season record. Matched links and keep-together groups are deleted with the request.
  - **Doc follow-ups (`/legal` to write when asked):** privacy policy draft §5 (friend names + code; the club decides,
    we process) and §9 (the retention row, only once the purge ships); `LEGAL_FACTS.md` (typed non-member names
    beside the second parent's email); club data-processing terms (the club chooses the feature, uses names only for
    placement, owns any export). Lawyer, if the owner chooses: the indirect-collection reading and the notice wording.
    Re-check Québec Law 25 when the first Québec club signs.
  - **Route to `/review` at build:** anonymous free text reaches the Excel/CSV exports. Check formula neutralization in
    the shared table export before the friend columns land.
  - **Part 1 (the family side + the setting) BUILT 2026-11-11, committed `9269b5eab` 2026-11-11**, to drawing tabs 1, 2, 3 (top): the question in each
    child's card under the division line, the friend code (check letter, no lookup) on the confirmation, in the email
    and on "Your sign-up" with Copy, "Plays with" + Change until the division's teams are made, and Overview ›
    Registration "Friend requests" (None · 1 · 2). Mig **461** applied to **dev** 2026-11-11 (404 live sign-ups given a
    code, all passing the form's check; prod step in `MANUAL_PROD_STEPS.json`). `/legal` re-check, `/marketing` words
    pass (5 changes applied), `/docs` (house-league help), `/review` run at the build; its fixes applied: a save is
    one database transaction (a failed Change can no longer lose a family's set), the own-code message lands on its
    block, a reopened season gives codes back, a code matches only a live sign-up, the change route logs no row.
    Left: two simultaneous sign-ups drawing the same new code (about 1 in 33 million) would fail one insert. Walk **§510** (`BOARD_READY_S1_FRIENDS_PART1_WALK.html`).
    Build decisions (not drawn, owner may overrule): a friend needs a first or a last name (a parent's name alone is
    refused); a code that matches nobody waits in To confirm with no match; entering the child's own code is refused in
    words; the friend block shows only once the division is known; the folding of finished friends at the maximum (a
    "build detail" in tab 1) is not built.
  - ⛔ **RELEASE GATE (`/legal`, 2026-11-11): Part 1 is NOT promoted to production without Part 2.** The form says the
    names "are deleted after the season", and the season-finish purge, the 60-day backstop and "Delete request…" ship
    in Part 2. Promote Parts 1 and 2 together (or drop that sentence, which `/legal` does not recommend). Also before
    release: the privacy policy draft §5/§9 lines above (route to `/legal`). Re-read "Only the club staff who handle
    sign-ups see these names" when Part 3 ships: the board must show names only to the Registrations seats.
  - **Part 2 (the registrar + the deletion) BUILT + COMMITTED `f291a8bb1` 2026-11-11 (nightly job mig 472 `3628b51a1`)**, to drawing tab 4 and tab 7's export half: the
    fifth Registrations view **Friend requests** (amber count of rows to confirm; absent at None or off the plan), bands
    To confirm · Confirmed · Closed, the row recipe (one row action: Confirm · Pick one… · Can't honour · Not signed up; the
    rest behind ⋯: Pick another…, Not signed up, Can't honour…, Move back to To confirm, Open {first}'s registration,
    Delete request…), a Both asked pair as one row and one Confirm, a code covering the other direction, Confirm best
    match, the request window (every match with its reason, the other division dimmed, a search of the division's
    sign-ups), the Can't honour window (outlined), the toolbar (division, search, Show only, Export), phone rows, the
    registrations Flags filter "Has a friend request", the two name-free export columns, the view's own file (children's
    names only), and the deletion. Matching runs on read with a new normaliser (`lib/league-friend-queue.ts`;
    `normName` untouched). Migs **471** (the finish trigger deletes requests and clears codes, the 60-day backstop, the
    family save refuses a finished season) + **472** (the nightly job) applied to **dev** 2026-11-11; prod steps in
    `MANUAL_PROD_STEPS.json`; ⚠ 472 is watched automation (its own commit). `/legal` re-check (1 should-fix applied: a
    season with no end date counts a year from its start, else from its creation; the form's line now reads "Only the club
    staff who work on sign-ups and teams see these names…", since the seats that read them run teams too; the Delete
    confirm says it is permanent), `/marketing` words pass (applied), `/docs` (two Registrations articles), `/review`
    (four lenses; fixed: a pair needs a confident match on both sides and one division, a code whose child withdrew offers
    no Confirm, a loose first name elsewhere is Not signed up, covered requests count in Friends Honoured, stale ticks,
    the record reopening, the finish/save race, the backstop sweeps finished seasons, strict ids, CSV-only formula
    safety (an Excel cell is text; an apostrophe there showed on "+1 …" phones)). Walk **§516** (https://claude.ai/artifact/LEdqsZtJFgVw4NqqQH34bb) ✅ 37/37 2026-11-12.
    Build decisions (not drawn, owner may overrule): Confirmed and Closed rows keep a ⋯ with **Move back to To confirm**
    (the drawing's "undo it from ⋯"); **Delete request…** asks first ("Delete {first}'s friend request?", Keep request /
    Delete request); a withdrawn or declined child's requests leave the queue and its count (kept until the deletion);
    the finish confirm's line "Friend requests and friend codes are deleted." and the reopen's "Friend requests were
    deleted too. Families get new friend codes." (neither drawn); the backstop's no-end-date fallback (a year after the
    start, else after creation); a confirmed request whose friend later withdrew stays in Confirmed reading
    "{first} withdrew {day}". Left (review, low): a multi-row decision is one update per request, not one transaction
    (a failure part-way leaves a pair half confirmed, fixed by pressing again); the friends read runs on every reload.
    **Doc follow-ups now due (`/legal`, when asked):** privacy policy draft §5/§9/§11 (friend names, retention: on
    finish or 60 days after the last day, backups roll off; erasure through the club's Delete), `LEGAL_FACTS.md`, the
    club data-processing terms. The drawings and Part 1's walk quote the old form line.
  - ⛔ **RELEASE GATE (2026-11-11, with Part 2): Parts 1 and 2 go to production in ONE promote**, migs 461 → 471 → 472
    in that order; Part 1 alone still breaks the form's promise.
  - **Part 3 (the draft + the board rows) BUILT + COMMITTED `06a2b17f1` 2026-11-12**, to drawing tabs 3 (bottom), 5, 5b and 6: the engine
    (`lib/house-league-draft.ts` `keepTogetherGroups`: household ∪ confirmed links, cap 3, A7 order, siblings never split,
    locks win, a kept-apart pair never joined even through a shared friend; `evenOut` still moves singles only); each
    request's draft outcome stored with the deal (**mig 473**: `league_friend_requests.draft_outcome` kept · over_cap ·
    locked · apart · off, written inside `league_division_draft_apply`, cleared by clear and by every registrar decision;
    applied to **dev** 2026-11-12, prod step in `MANUAL_PROD_STEPS.json`); the Run the draft window's Friends row, "Keep
    friends together" (only with a confirmed request, on by default, held for the visit) and How it deals; the board's
    option B rows for every club (RTG · Player · Together · Note · $ · Age · ⋯, places headed by symbol, absent not empty;
    Together = family + confirmed friends, amber "x of n"; its window lists both, labelled), "Has a friend request" in the
    pool filter, ⋯ "Keep apart from a friend…" / "Keep together with {friend} again"; the after-draft result in Friend
    requests (Not honoured first, every tab-6 reason, live, `lib/league-friend-draft.ts` `friendResult`), the record's
    Friend requests section, the view's file carrying the result. Friend data reaches the board only behind the
    registrations read (the guard test extended); the draft route reads links and returns none. `/legal` re-check (no
    blocker; the form sentence holds: the 'read' seats are owner, admin, league admin, registrar and members granted
    House league), `/marketing` words pass (6 changes), `/docs` (the draft guide's "Keep friends together", a draft FAQ,
    the board article's Together and RTG, two Registrations topics), `/review` (high-risk; fixed: a kept-apart pair joined
    through a shared friend; then the "apart" outcome, so an undone split reads "Kept apart in the draft"; the phone grid
    tightened). Walk **§518** (https://claude.ai/artifact/LLFzexk8mG9RZZPmk1R9MK) ✅ 48/48 2026-11-12, fixture `.probe/friends/part3-walk-fixture.sql`
    after Part 2's.
    Build decisions (not drawn, owner may overrule): the result shows only when ONE division is picked (All divisions
    keeps the queue's bands); result rows keep their ⋯ instead of the drawn chevron, so Delete request… stays reachable;
    three reasons beyond tab 6's list ("{child} wasn’t in the draft", "{child} isn’t on a team", "Drafted with Keep friends
    together off") and "Kept apart in the draft"; the Together count is the others in the group on this team (plain when
    all are, amber "x of n" when not; in the pool, the group's size); the Together window's third status "Apart"; the
    after-draft view keeps the amber count as it was (requests still to confirm); keep-apart works before and after
    publishing.
    Owner calls — RULED 2026-11-12, all three as /legal recommended; (1) and (2) BUILT 2026-11-12, committed `81e3967e0` 2026-11-14 (form line, Can’t honour hint, the draft guide’s quoted line): (1) reword the form sentence to "only to decide which team they play on"; (2) add the Can’t honour hint "Keep it to the team placement. Don’t write anything about a family’s circumstances."; (3) leave the after-draft lock and hand-move reasons as built. Original text of the calls: (1) the form's "only to put friends on the same team" is literally narrower than "Keep apart"
    (same data, same purpose; `/legal`: keep it and say "team placement" in the policy, or reword to "only to decide which
    team they play on"); (2) a field hint on Can't honour's note ("Don't record anything about a family's circumstances",
    `/legal`); (3) the after-draft reasons show the registrar a lock and a hand move, which the board keeps to the runners
    (9c·2a) — drawn and ruled in tab 6, built as drawn.
    Left (review, low): the board read loads the season's registrations and requests on every load (two queries, no N+1);
    a registrar's decision landing between the draft's read and its write can have its cleared outcome overwritten (the
    fingerprint does not cover friend requests); the 361 px phone row was unrendered (walk §518 Q8 looked at it 2026-11-12 and passed).
    **Doc follow-ups due before the Parts 1–3 promote (`/legal`):** privacy policy draft §5/§9 friend-request lines (WRITTEN 2026-11-12, draft v0.2; the
    three owner calls answered in `FRIEND_REQUESTS_PRIVACY.md`, owner to rule); club data-processing terms (not started). `/legal` wrote `docs/agents/legal/FRIEND_REQUESTS_PRIVACY.md`.
  - ⛔ **RELEASE ORDER (Part 3):** mig 473 after 461/471/472 and BEFORE Part 3's code (its reads select `draft_outcome`).

### Stage 2 — Group email to coaches and volunteers (item 3)
- [ ] **Email coaches** composer on the one club send window parts, on the colleague-mail path (reply-to the sender,
  no family footer), with a recount at Send.
- [ ] Live groups: All coaches · Rep coaches (head / all staff) · House-league coaches (this season, or one division)
  · Tournament coaches (one tournament). Stage 3 adds Board · Volunteers · "Needs a new {document}".
- [ ] Saved custom lists (pick people), kept small on purpose.
- [ ] Sent history with recipients, like the Families › Emails tab.
- [ ] CASL guard: colleague mail carries no plan, price or offer (`CASL_MEMBER_INVITE_EMAILS.md`). `/legal` reviews the
  wording rules.
- [ ] Prerequisite: the Stage 0a third access sweep (its findings on contact-detail reads).
- **DRAWN 2026-11-16** (round 2 after `/ux`, `/design`, `/legal`): https://claude.ai/artifact/WVuNq47ywkxKgmFSYew2eF,
  source `BOARD_READY_STAGE2_GROUP_EMAIL_DRAWINGS.html`. Counts from a seeded Harbourtown copy (`navj-grpmail`, removed the
  same day): All coaches 9 · Rep staff 7 / head coaches 6 · House league 2. **Asks 1–13 OWED** (paste-back "Group email
  asks: …"), all recommendations, nothing ruled:
  1 who sends: owner + admin every group; league admin + registrar house-league coaches only; nobody else; team-limited
  members no tab · 2 groups: All coaches · Rep coaches (all staff / head only) · House-league coaches (season / division) ·
  Coaches you pick · 3 saved lists DEFERRED (one-off pick + "Send again to these coaches" instead) · 4 all rep staff count
  as coaches (managers included, said plainly) · 5 tournament announcements LEFT ALONE and "Tournament coaches" DROPPED
  as a group (3 of the seeded tournament's 4 teams are visiting clubs; a pointer line instead) · 6 history = its own list
  on the new tab, each record names its recipients · 7 the door = a new **Group email** tab on Organization after Members
  (changes NAV_STANDARD N11) · 8 rep teams count unless archived (a closed season still counts; live-only would empty the
  list between seasons); unaccepted rep invites left out and named; house-league coaches in whether signed in or not ·
  9 From "{Club} via FieldLogicHQ", reply-to the sender (today's colleague mail says only "FieldLogicHQ") · 10 names and
  teams only, never an address · 11 the recount compares the PEOPLE, not the number, and never sends by itself ·
  12 no daily allowance, just-sent check only · 13 no second door on Rep teams / a season in this build.
  Plan line corrections the drawing makes, pending the asks: L689 "Tournament coaches" (ask 5), L690 saved lists (ask 3).
  `/legal` (`docs/agents/legal/CASL_COACH_GROUP_EMAIL.md`): not a commercial message as drawn; foot "Sent through
  FieldLogicHQ, the software {Club} uses."; a line under the message box against promotion; the reply address named in
  the statement; per-group "why you get this" + "Not right for you? Reply and tell {Sender}."; build-guard rule in that
  file. **Owed from /legal:** a privacy policy §5/§9 sentence for the coach-email log and a retention clock for it (→ `/plan`);
  a `/legal` re-check before each Stage 3 group (a group only from a role the club recorded, never from guardians).
  Third-sweep contact-read findings (staff on the Communication screen; score-feed emails) are NOT widened.
  Fits a one-to-two-session build if asks 3, 5 and 13 go as recommended. Next: the owner's answers, then
  `BOARD_READY_STAGE2_GROUP_EMAIL_BUILD_PROMPT.md`.
- **HOME CHANGED 2026-11-16 (owner ruling):** the coach email is built inside a new club **Communications** place, not
  as an Organization tab. **Asks 6, 7 and 13 are replaced** by `CLUB_COMMUNICATIONS_PLAN.md` (its Stage 1). **Asks 1–5
  and 8–12 RULED 2026-11-16, all as recommended** (owner, in the Club Communications session, answering whether his
  agreement covered these ten). Do not build the Organization › Group email tab. The build runs from
  `CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md`, which also adds **the board** as a group (seat-based, owner request).
  **Built 2026-11-22 inside Club Communications Stage 1:** the coach and board email windows, sessions 1–3 committed
  (`95cac82d6`, `817c95523`, `684ee0b38`, `cc99f58e9`), walks §537 and §547 passed, the Close built 2026-11-22 (record in
  `CLUB_COMMUNICATIONS_PLAN.md` §3 Stage 1). Status lives on the board. This stage's saved lists, tournament-coach group
  and volunteers are not built (Stage 3 and Club Communications Stages 2–4).

### Stage 3 — The club's people and their credentials (item 4) — FOUNDATION: People
**3a · People**
- [ ] One admin-only **People** list for every adult who helps run the club: board, rep staff, house-league coaches,
  parent helpers, volunteers. It fills itself from the seats and rosters that already exist. Parent helpers who never sign in are
  added by hand or by CSV. One person, many hats, each with its season.
- [ ] Board tab ruling R1 stands: People is not public, and the board tab keeps names and roles only.

**3b · Documents** (owner ruling 2026-11-10, Q2: it is *documents*, and the club decides what they are)
- [ ] Club-defined **document types**: name (whatever the club calls it, e.g. "Vulnerable sector check", "Respect in
  Sport", "First aid"), a default expiry (N months from the date received, or never), and who needs it (by hat: all
  coaches, on-field helpers, board). No list of allowed or banned documents.
- [ ] Per person: the saved file (private bucket, signed links as permits do), the date received, and an expiry that
  defaults from the type but **can be set per document**, plus who recorded it. Files are opened only by seats the club
  grants to documents.
- [ ] Status board: Valid · Due soon (club-set window, e.g. 60 days) · Expired · Missing, filterable by hat.
- [ ] Reminders: an automatic notice to the person before expiry and on expiry, and **Email everyone who needs a new
  one** (Stage 2 composer, colleague mail).
- [ ] When a person without a valid required document is put on a team, the screen **warns and never blocks** (Q4).
- [ ] Migration first; dictionary + snapshots; `/legal` before drawing (retention of screening records, who sees them).

### Stage 4 — Forms (item 5) — FOUNDATION: Forms — ✅ COMPLETE (owner's word, 2026-11-22)
All three parts and 4.P are built, committed and walked (§546 41/41, §551 50/50, §553 32/32, §555 19/19). Left, and not part of the
stage: the production promote of Parts 1–3 together (call C1, with its release conditions) and the walk fixture's `off` step on dev.
- [x] Generalise the tournament custom-questions model into one **club form**: question types (short answer, long answer,
  one choice, many choices, yes/no, date, file upload). Each is required or optional, with help text, in a set order.
  **No branching logic in the first pass** (push back if asked; that is where form builders get out of hand).
- [x] **Document blocks:** the club attaches a PDF and the family must open it before ticking "I have read {document}".
  Ticks are recorded with the document version and time, like today's waiver consent, which becomes one of these blocks
  without losing existing consent records.
- [x] First use: the house-league season sign-up (copy last season's form). Then tryouts, camps (Stage 7) and sponsors (Stage 6).
- [x] Answers flow into the registrations list (columns + filter), the export and the draft board notes view, keeping
  ruling A8 (only seats that can open registrations see notes and answers).
- [x] Gate: the tournament version is Tournament Plus value today, so the club gate is a `/strategy` call (Q6).
- [x] Migration first; dictionary + snapshots.

**Drawn 2026-11-20** (round 2 after `/legal`, `/ux`, `/design`): https://claude.ai/artifact/THVuyR2zxwU8ezeFti5of9,
source `BOARD_READY_STAGE4_FORMS_DRAWINGS.html`. **All 20 asks RULED 2026-11-20 as recommended** (owner: *"I agree with
your recommendations"*). These rulings win over the checklist above where they differ. Build prompt:
`BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md`.

1. **Per child or per sign-up:** the club picks per question, "For each child" (default) or "Once per sign-up", shown as
   two groups on the form page. Documents are ticked once per sign-up and recorded on each child.
2. **The tick's words:** the club picks per document, "I have read {document}." or "I have read and agree to
   {document}." The waiver moves in with "agree". *(Amends ruled item 3's wording, on the owner's yes.)*
3. **Where it lives:** its own page one level down, opened from a "Sign-up form" fact in the season Overview's
   Registration block (replacing the Waiver and Email consent facts).
4. **What it can't replace:** a locked "Every sign-up asks" card at the top of the form page (folded once there are
   questions, and on a phone); the club's questions follow the fixed fields; a fixed notice about who is asking sits just
   above the first club question on the family page. None of it can be removed or edited.
5. **Health or medical mark:** a switch per question. Marked answers stay off list columns, the filter, the draft board,
   emails and alerts, and out of every export but one. Optional by default. The window suggests the switch when the
   question's words look medical, and never blocks.
6. **Who opens health answers and files:** the seats that open Registrations (A8); no new permission. Opening a file is
   recorded in the club's activity log.
7. **Changing the form after sign-ups start:** editable while the season is live under the drawing's tab 7 rules (answers
   never lost or reshaped; type and "Asked" lock once answered; archive keeps answers under "No longer asked"; delete only
   while unanswered; no family chased automatically).
8. **New document version:** the club chooses "Their tick stands" or "They must tick again" (with a reason families see).
   Tick-again sign-ups show "Needs a new tick"; places aren't affected; the family ticks on Your sign-up; the club tells
   them through Email families. No automatic email.
9. **Family files:** one per question, up to 8 MB, PDF/JPEG/PNG/HEIC checked on the server, at most 5 per child's
   sign-up; a file question can't be required; the public page limits how fast files come in.
10. **Retention:** family files and health answers removed 90 days after the season is marked finished (or 120 days after
    its last day if it never is); other answers stay with the registration. The privacy policy gains the sentence only once
    the nightly job exists.
11. **Registrations list:** up to three answer columns from a new Tools (⋯) → Answer columns, remembered per person; one
    Filter group per question with choices, plus Documents › Needs a new tick; health questions never a column or filter;
    on a phone answers stay in the record and Tools is absent.
12. **Draft board:** a "Show on the draft board" switch per question, off by default, never for health; those answers join
    the family's note in the note popover and the pool's Filter.
13. **Export:** plain Excel and CSV carry non-health answers; a file answer reads "Attached"; health answers leave only in a
    new opt-in under the divider, "Excel with contact details and health answers".
14. **Coaches:** not in this stage. **First follow-up, its own drawing:** a per-question "Show to the child's coaches"
    switch (it changes ruling A8 and adds to the coach's team page).
15. **Tournament questions:** move onto the club form later, as its own stage, after one house-league season has used it.
    Fix F1–F3 now as a small separate fix (`BOARD_READY_TOURNAMENT_QUESTION_FIXES_PROMPT.md`). **F1–F3 committed `bd74851a3` 2026-11-20**
    (walk: https://claude.ai/artifact/UXVbq4LEexfFFtT6xuZ9eg; **walked 2026-11-20, 31 of 31 passed**; the optional phone-photo
    step 15 was skipped, no iPhone photo to hand, so a real .HEIC upload is unverified). Two departures from the prompt, both measured: the file limit
    is **9 MB for all of one form's files together** (the proxy cuts a whole request at 10 MB, so "10 MB per file" arrived
    broken), and **nosniff is not sent**: the one-hour link is the storage service's response, which sends
    `attachment` and the type read from the bytes but no `X-Content-Type-Options` (probed on dev), and we cannot add a header
    to it. ⚖ **Owner 2026-11-20: the nosniff gap is accepted** (a download is never rendered as a page; serving files
    through our own route would change the "links that expire after one hour" wording and may meet the host's size limit).
16. **Who builds the form:** owner, admin, league admin (who set up a season); the registrar reads it.
17. **Copy last season:** a "Sign-up form" line in Start next season (on by default; the waiver leaves the Settings line)
    and "Copy {season}'s form" on an empty form; questions and documents only, never answers.
18. **A document tick records:** document + version, a fingerprint of what was seen, the words ticked, when a PDF was
    handed over, the time of the tick, the registration, child and sign-up, and the guardian. **No IP address.**
19. **Words (draft; `/marketing` confirms):** club side "Sign-up form", "Your questions", "Documents to read", groups "For
    each child" / "Once per sign-up"; family side never says "form": "From {club}", "Questions from {club}", "Documents and
    agreement".
20. **Families see and change their answers:** Your sign-up shows each child's answers (and the once-per-sign-up ones) in
    folded rows with Change until the teams are made, then the club's contact. New questions and new document versions
    show there too.

**Owed from `/legal` (not optional):** the next Privacy Policy version names "answers to a club's own sign-up questions
and files a family attaches" (§5) and the Data Terms §12 says the same; the §9 retention sentence waits for the nightly
job. The build keeps the policy's promises: 1-hour signed links, server-only reads, never on a public page, never in a
push or bell line. Lawyer's-eye items (no gate): the six in the drawing's `/legal` record, carried in the build prompt.
**Gaps found and owned by this stage:** F5 (waiver has no versions; the move counts first, on dev and production as
counts only, shown to the owner before it runs), F7 (one deleted registration leaves files, closed for the new store),
F8 (the confirmation leaves out a child not signed up).

**Part 1 built 2026-11-20** (the form, the documents and the waiver move; QA walk §546
https://claude.ai/artifact/UVoT5NPhYxC8B1UzKgsVui, **walked 41 of 41 passed 2026-11-20**). Migration 513 applied to dev 2026-11-20 after the counts (prod 0
seasons; dev 7 seasons with waiver text, 333 ticked; owner yes "go ahead"); the prod step is in `MANUAL_PROD_STEPS.json`.
Reviews: `/legal` (`docs/agents/legal/BOARD_READY_STAGE4_PART1_BUILT_WORDS_REVIEW.md`), `/docs` (help `signup-form`),
`/marketing`, `/simplify`, `/review`. Onboarding wizard: its waiver box stays and becomes the season's first document.
**Release order RULED (owner 2026-11-20, call C1):** Parts 1, 2 and 3 reach production together.
**Carried to Part 2 (from the reviews):** save ticks inside the placement's locked step (Part 1 records them just after,
a failure logged); the PDF's open-first gate, and the consent-ledger text names a PDF's file and version; the family page
keeps typed answers across a form change (Part 1 asks for a reload); health answers and files are NEVER kept across a
reload (RULED owner 2026-11-20, call C3, on /legal's recommendation: typed answers are kept for the tab, health answers
and files live in memory only, and after a reload the form says so; nothing is saved on the server before the sign-up); a question delete must also clear attached/removed file rows; Start next season
must honour the questions plan gate when copying (latent: every house-league plan has it); the readers that say "Waiver
accepted" (child page, duplicates, families export) read the ticks or say "Documents ticked" before Part 2 promotes (a
season whose only document is "I have read" leaves `waiver_accepted_at` empty, by /legal's rule).
**Carried to Part 3:** moved ticks count as ticks on version 1 everywhere a version's ticks are counted (Replace already
does); "text as the club held it on {date}" uses the move date, never the tick date; retention covers
`club_form_submissions`; storage objects of a deleted registration's files.
**Part 2 built 2026-11-20 on dev** (the family side of the sign-up form; QA walk §551 https://claude.ai/artifact/4T7SUVwYi2Fa67tcjsU3VN, 50 steps, **walked and passed 50 of 50 by the owner 2026-11-21**; committed `2b3269da6`).
Migration 515 applied to dev 2026-11-20 (the placement saves a child's answers, files and ticks in one transaction, a refusal rolls
the sign-up back; Your sign-up's Change; the sign-up's own answers go with its last child); migration 516 (the six-hourly sweep of
waiting files) is written, applied nowhere, and waits for the owner's yes and its own commit; both are in `MANUAL_PROD_STEPS.json`.
Reviews: `/review` (four lenses; fixes applied: the waiting-file sweep, Remove and the question delete delete the row before the stored
file, Your sign-up leaves no email-only sign-up row, an upload finishing after an earlier child was removed lands on its own child,
focus stays on the field being fixed, a stale tick, Open or choice is dropped after the club changes the form), `/legal`
(`docs/agents/legal/BOARD_READY_STAGE4_PART2_BUILT_REVIEW.md`: the health mark can't come off a question people have answered, the
child's Additional notes are never kept in the tab, rules for Part 3 and the release), `/marketing` (eight strings), `/ux` (a refused
file can be removed, the file picker works by keyboard, "Clear my answer" on an optional choice, the form-changed note takes focus),
`/docs` (house-league help, club and family halves). Probes `.probe/stage4-part2-probe.mjs` 28 of 28 and
`.probe/stage4-part2-files.mjs` 14 of 14 (re-run after the fixes). Walk fixture: `.probe/stage4-part2-walk-fixture.mjs on|off`.
**Carried to Part 3 (added by Part 2):** the three staff readers read `club_form_ticks` (the duplicates line already says "Agreed to
documents on {date}"; the child page and the families export still read `waiver_accepted_at`); the rep-team Waiver fold; stored files of a
deleted registration, of a season delete cascade, and of a replaced file whose storage delete failed (a `removed` row, an object left)
(`/legal`: close these before Parts 1–3 are promoted); one shared signer for the product's signed values; the club's record shows
"Answer changed by the family {date}" on a health answer changed after the sign-up, and never words the PDF hand-over as read or viewed
(`/legal`); the Privacy Policy §5 and Data Terms §12 sentences, with no "within a day" sentence until migration 516 runs; the Email
families "Your sign-up" button (owner call C4, recommended: carry it); a unique key per document version and child on re-ticks (two parents
at once insert two tick rows); Change is not re-checked against teams being made inside the same transaction. Accepted as known: the public
upload and hand-over doors share one platform-wide limit, and the per-address limit trusts the forwarded address like every public form.
**Owner calls RULED 2026-11-20** ("1 yes together, 2 yes rename, 3 agree"): C1 above; C2 the checklist's optional step is
named "Documents" ("On. Families tick each one to sign up." / "Optional. Families sign up without any."), built the same
day; C3 above.
**Part 3 built 2026-11-20 on dev, committed `4dd9e659f` 2026-11-20** (the club's side, retention and the close-out; drawing tabs 6, 8, 9). **Owner calls RULED
2026-11-20 at the UX summary, "as recommended":** (1) ONE scheduled job: migration 516's six-hourly sweep also runs the 90/120-day
removal and deletes the stored files of deleted sign-ups (still waits for the owner's yes and its own commit); (2) Email families carries
the "Your sign-up" button (Part 2's C4); (3) a moved tick reads "recorded before documents had versions; text as the club held it on
{move date}"; (4) "Answer changed by the family {date}" under a health answer only; (5) answer columns are remembered with the account;
(6) the policy sentences go into the unpublished drafts. Migration 518 applied to dev 2026-11-20 (answer columns per person, a cleared
health answer kept as an empty row, the stored-file removal list and its triggers, the retention function); the prod step is in
`MANUAL_PROD_STEPS.json`. Built: Registrations' Tools (⋯) → Answer columns (up to three, never health, absent on a phone), the answer
Filter groups and Documents › Needs a new tick, "Not asked" / "Not answered" cells; the record's Sign-up answers and Documents after Fee;
plain Excel/CSV answer columns and the opt-in "Excel with contact details and health answers" (read from the server when chosen, logged);
file openings as a one-hour download, logged in the club's activity log (ids only); the draft board's note popover and pool Filter carry
board answers; the finish confirm's line; a finished season's form page names the removal date; the child page, duplicates and families
export read the ticks ("ticked" unless a document asked "agree"); a house-league tick no longer counts as a rep team's Waiver copy.
Guards: `tests/unit/club-form-staff-guard.test.ts` (every reader's callers and gate, health never in the list, a mail or push module, or
the browser) and the board-notes guard extended to answers. Probe `.probe/stage4-part3-probe.mjs` 34 of 34 (owner, registrar, treasurer,
coach through the real routes; 35 of 35 after the reviews); walk fixture `.probe/stage4-part3-walk-fixture.mjs on|off`; QA walk §553
https://claude.ai/artifact/QhtSYswpFHJqAAkyy8X6Dk (32 steps, walked ✅ 32 of 32 by the owner 2026-11-21; fixture `off` owed). **Found:** the drawing's "each export is already
recorded in the club's activity log" was not true; only the new health export and file openings are logged (plain exports: an owner
question). Reviews: `/legal` (`docs/agents/legal/BOARD_READY_STAGE4_PART3_BUILT_REVIEW.md`; the Privacy Policy §5 and Data Terms §12
sentences are in the unpublished drafts, the §9 retention sentence waits for migration 516's first production run; a removed file
loses its family-chosen name; the Audit log's scope note names the two new kinds of row), `/docs` (the `signup-form` article's four
registrar sub-topics, the child page's Waiver bullet, the audit log help), `/marketing` ("audit log", the removal notes), `/simplify`
(four lenses: the cleared marker moved to its own table so every answer row is a real answer, one sign-up rule with the family's door,
one season-form lookup, one "last day" rule `league_season_last_day`), `/review` (five lenses, no Critical or High; fixed: every paged
read ordered, a failed board-answers or tick read no longer takes its page down, a club door's resend carries no button, the columns
window saves one tick at a time, a file opens in a tab made on the press, a stale filter pick narrows nothing, a tick never names a
version it didn't record, an archived question nobody answered is no export column, the health export is logged only when it carries
health). **Committed `4dd9e659f` 2026-11-20** (owner "commit"). **Owner calls RULED 2026-11-20** ("go with your
recommendations"): (1) migration 516's schedule YES (its own commit; on production only after the Parts 1–3 code serves); (2) a season
reopened after its finish is skipped by the 120-day clock until it is finished again (migration 519, `league_seasons.reopened_at`);
(3) the audit line for a file opening or a health export is written FIRST, and nothing goes out when it can't be (`writeOrgAuditFirst`);
(4) plain Excel, CSV and PDF exports stay out of the audit log; (5) the Email families button counts required questions only (and any
document to tick).

**The fixed notice above the club's questions is removed (owner 2026-11-21).** Ruling 4's "a fixed notice about who is asking"
no longer stands. `/legal` (`docs/agents/legal/CLUB_FORM_NOTICE_REMOVAL.md`) found that saying data is stored outside Canada is the
club's notice to give, and the published Terms §4 already tell clubs so. The default fields never carried a notice, and the family
reads one form. The club's privacy link moved under Sign up, and still shows only when the club has one. The health line stays.
Part 3 release condition 3 (Privacy 0.4 and Data Terms §12 live no later than the first club that asks a question on production)
stands as written. It no longer has the notice as a safety net in the meantime.

#### 4.P — A club sets its own privacy link (added 2026-11-21, owner; built and committed `f11841ac8` 2026-11-22, walk §555 passed 19 of 19 on 2026-11-22)
**Built as ruled 2026-11-21:** the owner AND an admin set it (Organization › Settings, card "Your privacy policy", field "Link
to your privacy policy"); each change families can see shows on the owner's Audit log as "Privacy policy link added / changed /
removed", never the address; the helper carries Terms §4's words (after `/legal`). No coaches-only door was found (the tryout
page that reads the link serves club teams only).
**What the club does:** in its settings, a club owner or admin pastes the web address of the club's own privacy policy, and can
change or clear it. Every family-facing door that already reads it then shows "{club}'s privacy policy". Those doors are the
house-league sign-up form (under Sign up), the tryout sign-up's consent line, and the guardian accept page.
**Why:** the published Terms §4 tell clubs "you can link your own privacy policy on your forms" and "your own privacy notice is the
place to tell them" that data is stored in the United States. Today only our staff can set the link (the column has no screen and no
route; `lib/privacy-policy.ts:13`), so that promise holds only when we set it by hand. With the form notice removed, the club's own
link is the only way a club tells families about the cross-border storage at the point of sign-up. At the first Québec club it is also
how the club gives its Law 25 s. 8 notice.
**Shape (for the build session to confirm):** one field in the club's settings, http/https only (the existing scheme check is the
single seam), seats that may edit the club's profile, an audit line on change. Help: one line in the settings article and in the
sign-up form article. **Reviews owed at build:** `/legal` (the setting's helper text), `/docs`.

### Stage 5 — Club events (item 8) — FOUNDATION: Club events
- [ ] A club-owned event: name, kind (banquet, champs day, AGM, clinic, camp, other), date and time, venue from the venue
  library, optionally held from permit time, and audience (public · families · members · staff).
- [ ] Shows on the club calendar (writable **for club events only**; teams' schedules untouched, D3) and in an **Events**
  section on the club site and in the family app. No RSVP links by email (2026-10-31); a sign-up uses a Stage 4 form.
- [ ] Champs day: an event that gathers the house-league playoff or final games under it.
- [x] D5 reopened for club events: ruled yes 2026-11-15 (Q7).
- [ ] Migration first; dictionary + snapshots.

### Stage 6 — Sponsorships (item 7)

**Drawn 2026-11-22 (round 1, after /design, /legal, /accounting) and ALL 15 ASKS RULED 2026-11-22** — 1A · 2A · 3C · 4A ·
5A · 6A · 7A · 8A · 9A · 10A · 11A · 12A (+ note) · 13A · 14A · 15A, every one as recommended (ask 3 was ruled earlier the
same day). Drawing: https://claude.ai/artifact/1z9y6ctHK3PNLaJ2HR11U8, source `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWINGS.html`.
Reviews: `docs/agents/legal/BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md`,
`docs/agents/accounting/BOARD_READY_STAGE6_SPONSOR_PAYMENT_FEE_REVIEW.md`. The rulings, as ruled:
1. **Where the logo shows = one record.** A business is kept once and has places. A place is a kind (the club, a house-league
   division, a house-league team, a tournament; later a club event), which one, and a last day. A paid deal whose package has
   "Your logo on our website" on IS a place. Club place → the home strip; division or team place → a "Sponsored by" line
   under its name; tournament place → that tournament's Overview strip; About lists the club's places. A deal's place
   changes on the deal; a typed place on the Sponsors tab.
2. **Tournament sponsors follow the Tournament Plus branding gate:** Tournament Plus and up show sponsors on a tournament; a
   free event's editor shows Sponsors locked and names Tournament Plus; Tournament-only organizers get display only. *(Logged
   by `/strategy` 2026-11-22, `BUSINESS_DECISIONS.md` "Sponsors on a TOURNAMENT": the existing Tournament Plus branding
   key, no new key; the Facts doc's Board Ready line updated.)*
3. **Card fee** (ruled earlier 2026-11-22): see the "Who pays the card fee" line below.
4. **States follow the money** (Offered, Form received, Invoiced, Paid) with delivery counted beside it; Delivered = paid and
   every item ticked. Choosing a cheque or e-transfer issues the invoice at once, so Form received only waits after an
   unfinished card payment. An offer can be withdrawn until it is paid. Callout words = the drawing's tab 5 table.
5. **The logo goes up** by itself when the deal is paid, or earlier when the club ticks the logo line on the checklist;
   **down** by itself after the deal's last day.
6. **A package names its kind of place** (the club, a division, a team, a tournament); each deal picks which one. A taken
   place warns and never blocks.
7. **An open offer holds its place:** a package reads Full when every place is paid, invoiced or offered; the club withdraws
   a stale offer to free one. No business opens a link for a place that has gone.
8. **One sponsorship form per club** (Setup › Sponsorship form, Stage 4's editor with no "for each child" groups and no
   health switch), starting with fixed business fields the club can't remove: business name as it should appear, contact
   name, email and invoice address (required); phone and website (asked, optional); the logo (can come later).
9. **Tax as drawn:** Invoice details holds "Registered for GST/HST" and the number (off by default); each deal's Charge
   switch is off by default and shown only to a registered club; the rate comes from the province of the business's invoice
   address; deliverables listed on the invoice; the tax posts to its own new ledger word, GST/HST collected. A professional
   confirms the province rule.
10. **The paid invoice is the receipt:** the same PDF, its subtitle led by "Paid in full", with the payments received, no
    stamp, as the coach invoice does.
11. **20 is the home strip's limit only;** the list holds up to 100.
12. **Its own club place, Sponsorships** (Deals · Packages · Sponsors · Setup); the owner, admins and the treasurer open it;
    the site editor's Sponsors line becomes a door. **Owner note:** it is also an access a club can give to someone who
    doesn't get it by default, such as a registrar. *(Reading of the note, for the build: a new per-member access in the
    shipped Manage member window, alongside the other areas, default on for owner/admin/treasurer and off for every other
    role, and paired with the plan's entitlement like every area. This replaces the drawing's "a volunteer gets in through
    one of those seats until Stage 3".)*
13. **The offer email** as drawn (F9): sent in the club's name, replies to the club, the club's note optional. The club must
    pick why it may email them (paid in 2 years, asked in 6 months, gave the address, published it for business), kept with
    the date and said back in the foot. The foot: the club's mailing address, an unsubscribe for that club's sponsorship
    offers only, "Sent through FieldLogicHQ". An unsubscribed or family-opted-out address can't be offered again and nobody
    at the club can clear it; the club has "Do not offer again" for a stop said by reply or phone. Sending waits for the
    club's mailing address.
14. **Offer again** from next year's empty Deals: one window, last year's deals ticked; this year's price (last year's as a
    hint); club and tournament places carry over; a division carries over by name; a team is picked again, so its row waits
    until the new teams exist; a business that hasn't paid in two years, or is unsubscribed, is listed but can't be ticked.
15. **The words:** club side "Sponsorships", "Deals", "Packages", "Sponsors", "Setup", "Offer a deal", "Shows on", "Record a
    payment", "Offer again", the five states as written; the business reads "Sponsorship", "About your business", "Questions
    from {club}", "How you'll pay". `/marketing` confirms them, one spelling everywhere.

**Round 2 — drawn 2026-11-22 after /design and /legal (https://claude.ai/artifact/Jw44YSkZ6dFFGTmAVW6ScQ, source
`BOARD_READY_STAGE6_SPONSORSHIPS_ROUND2_DRAWINGS.html`) and ALL 9 ASKS RULED 2026-11-22, each as recommended (A):**
1. **The sponsor's pay block is the shipped one:** one button per way to pay, each with its own total — "Send and pay
   $1,176.39 by card" with "Includes a $41.05 card processing fee and $5.34 HST on it." under it, and "Send, and pay
   $1,130.00 by cheque or e-transfer". The summary above shows the invoice. No radio, no tinted selection.
2. **The invoice follows the coach invoice's recipe:** the sponsorship, the processing fee (when the sponsor paid it) and
   HST are each a row of the one table; Invoiced, Paid and Balance due carry the total; no totals block.
3. **A passed-on fee is booked both ways:** the fee charged is income under Club sponsorship (a line of its own) and the
   same amount is a Payment processing cost, so the HST collected matches the income it was charged on.
4. **Invoice details are changed by the owner, admins and the treasurer only;** anyone else with Sponsorships reads them,
   with a line saying who changes them.
5. **"Full" on a package is grey.**
6. **"e-transfer" in a sentence, "E-transfer" at the start of a label or sentence;** the other two spellings go, including
   the stored ledger method name (a data change for existing clubs). `/marketing` sweeps it and the spelling check holds it.
7. **No registered charity is known:** build for clubs that aren't charities; `/legal` and `/accounting` re-check when the
   owner says a registered charity is using sponsorships.
8. **The offer email's foot carries the club's mailing address alone.**
9. **The registration fee row gets the same card-network hint** (the limit, and that passing the fee on is the club's
   decision and responsibility). A hint only; the registration ruling stands.

The gross-up question is answered by the code (F13, see the card-fee line below). Built from /legal round 2: every offer
keeps who sent it (a name snapshot). /legal's round 2 adds owed policy text: Payments Terms §4 (two fee choices,
sponsorships default the club), §6 (a sponsorship refund never includes the fee), §9 (the sponsor pays; name sponsorships
in the card-network sentence); Privacy §5 (who sent an offer is kept with its reason).

**Still open after both rounds (not ruled by them):**
- ~~The build prompt.~~ **Written 2026-11-22** (owner: "write the build prompt"): `BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md`,
  four parts in order. Two code facts it carries for the owner: there may be no public team page for a team's "Sponsored
  by" line (Part 1 stops and asks), and the mailing-address box is hidden for most clubs today (Invoice details owns it).
- **Part 1's two owner calls, RULED 2026-11-22** (asked at the start of the Part 1 build): (a) **a team's sponsor shows on the
  About page only** — the code has no public page for a house-league team (the only team page is the signed-in coach's), so
  the "Sponsored by" line under a team's name has nowhere to go; the drawing's own F6 fallback. A division's line goes under
  its name on its public schedule and standings, below the division tabs. (b) **The move of today's sponsor list: yes** —
  counts first: production 0 clubs / 0 rows, dev 2 clubs / 6 rows; each became a business with one "The club" place, keeping
  its order, logo, link and last day, with no reason on record for emailing it (migration 525, applied to dev 2026-11-22;
  production step queued). **Part 1 built on dev 2026-11-22** (migration 525: the four tables, the sponsorship fee column,
  the club-owned sponsorship form, the module matrix CHECK widened to the catalog it had already outgrown), **committed
  2026-11-22**, walk §560. **Two words RULED the same day** (owner: "use the legal wording for both", from /legal's re-check
  of the built words): the Manage member grant sentence ends with the four reasons Part 2's offer window allows (paid the
  club in two years, asked in six months, gave or published the address for business use), not the drawn "no business the
  club has never dealt with"; the Payouts sponsorship row's card-network sentence names the cost ceiling and says "nothing at
  all in Québec" (the drawn "none in Québec" read as no limit).
- **Part 2's four owner calls, RULED 2026-11-22** (asked at the start of the Part 2 build, each as recommended): (a) **the
  invoice number is given in Part 2** — choosing a cheque or e-transfer gives the deal its invoice number, issue date and due
  date at once (the coach scheme: `{year}-{seq}` per club, never reused), so the Invoiced callout and the thank-you page read
  as drawn; the PDF, the emailed invoice and Record a payment stay in Part 3; (b) **no card button until Part 3** — Part 2's
  business page shows only the drawn card-off pay block ("Send, and pay … by cheque or e-transfer"); Part 3 adds the card
  button with the flow behind it; (c) **"Make the link only"** — a quiet second button in the Offer window's foot creates the
  deal and opens Copy the link, sends no email and asks no reason (nothing is sent, so nothing needs proving), for the drawings'
  own "give them the link in person" (no reason on record, an unsubscribed address, a referral); undrawn, so it is drawn for
  the owner's look before it is built; (d) **the Offer window's refusals use drafted words** for the `/marketing` pass: the
  business stays in the picker but can't be emailed, with its reason — unsubscribed: "Unsubscribed from your sponsorship
  emails on {date}. We won't email them again." (/legal's tab 9 line); family opt-out: "This address has asked {club} not to
  email it. Give them the link in person instead."; Do not offer again: "You marked them Do not offer again on {date}."
  Said out loud at the same start, from the code: the province rate table moves in Part 2 (the Charge switch's hint needs the
  rate), a "place that has gone" has no drawn words and under ask 7 is only a withdrawn offer, a replaced link or a deleted
  division/team (all three read the drawn withdrawn sentence), changing an invoiced deal's amount or tax waits for Part 3's
  revised invoice, and no clock clears a business's answers (unruled; flagged to `/legal` with Privacy §9).
  **Part 2 code built 2026-11-22** (migration 526 written and held for the dev apply until walk 560 is done, owner's
  instruction; typecheck clean; Part 2 guard tests 37/37). `/marketing` pass applied; `/legal` re-check applied: sending also
  waits for a contact email the email names (finding 1), the CASL record of an email that went is retried (finding 2), the
  barred-address refusals no longer point at the held button (finding 4). "Make the link only" drawn for the owner's look
  (https://claude.ai/artifact/HtZy3KAvEfbSY9MkqzFaSH, two asks), not built. **Two more calls RULED 2026-11-22, as
  recommended (from /legal's re-check):** (e) **the reason keeps its own date** — picking "They paid us in the last 2 years"
  or "They asked us about sponsoring (in the last 6 months)" asks a required "When?" date, refused past 2 years / 6 months,
  and that date is the one kept; "Send the link again" re-emails only while the reason still holds (else it makes the new
  link without emailing it); one field added to the drawn window, so drawn for the owner's look before it is built;
  (f) **a replaced link has its own sentence**: "This link has been replaced. Look for the club’s newer email, or contact
  {club}." (a withdrawn offer keeps the ruled one; neither shows any business details). Migration 526 applied to dev
  2026-11-22 at the owner's word (`MANUAL_PROD_STEPS.json`). **The link-only drawing RULED 2026-11-23, all three as
  recommended (1A · 2A · 3A):** **1A** build as drawn — an outline "Make the link only" between Cancel and Send the offer;
  the reason is required only for Send; the deal's page opens with Copy the link (the callout's lime); the row says "Link
  made, not emailed"; when Send can't go it is absent with its reason and Make the link only stays (and takes the lime), in
  all four cases. On a link-made deal the actions add **Email the offer** (the email half of Offer a deal, its own route;
  a failed email keeps the deal) and Send the link again reads **"Make a new link"**. **2A** on a phone the Offer window's
  foot holds Make the link only and Send the offer; Cancel is the head's ←, which asks first when anything is typed; the
  computer keeps all three — ⚖ a deliberate exception to the 2026-10-09 Cancel-beside rule, for this window only (three
  buttons don't fit at 390). **3A** a required When? (the shipped date field, no day after today) directly under the two
  reasons that run out; the drafted hints; the red line under the field when the day is too long ago, with Send still
  there (pressing it says the same line; the server refuses it too); Send the link again on a run-out reason makes the new
  link, emails nothing, and the notice at the top of the deal says so (/design's open point: the shipped PageNotice there).
  **Built 2026-11-23:** migration **527** (`club_sponsor_deals.link_unsent_at`, the history's "new link made, not emailed";
  the invoice counter's service_role grant taken away, only the SECURITY DEFINER step takes a number) applied to dev; the
  offer record's `reason_on` is now the reason's own day for the two that run out (today for the other two). Guards fixed
  on the way: the new tables classified for the team move, the business's page registered as a club form page, the
  insert-only grants marked, possessives through `possessive()`. Part 2 tests 41/41, typecheck clean. Owner "walk done"
  2026-11-23: the dev server restarted and the probe (`.probe/stage6-p2-link-only-probe.mjs`) passed end to end on UAT Rep
  Only. **Part 2 closed out 2026-11-23** (record: `BOARD_READY_STAGE6_P2_FINISH_PROMPT.md`): `/simplify` and `/review` applied
  (nine fixes; the open `/review` items listed there); `/ux` at 390 (the pay block no longer promises an emailed invoice, 44px
  Copy and foot address, one address on the withdrawn and replaced pages); `/docs` (three sub-topics in the club guide's
  Sponsorships section); `/legal` re-read (the club's stop list is now read in full, a link pasted into the club's own email is
  the club's to justify; two owner questions: a Copy-the-link hint, and Send the link again on an invoiced deal). Walk **§561**
  (4 walks, 50 steps) published; Part 2 committed `c24b35d71` 2026-11-23. **Walk §561 passed 50 of 50, 2026-11-23**; the two
  owner questions ruled: no Copy-the-link hint (the help article carries it), and Send the link again on an invoiced or paid
  deal keeps its confirm as is. Migrations 526 and 527 were applied to
  production 2026-11-23 and Part 2 went live in the evening promote (master job 294, `3077c31e7`), as ruled (the Part 1 tabs read the deals).
- **Part 3's four owner calls, RULED 2026-11-23** (asked at the start of the Part 3 build, each as recommended): (1) **Part 3
  is split**: **3a** the invoice PDF, the invoice and "Paid in full" receipt emails, Record a payment and its void, the books
  (Club sponsorship, GST/HST collected) and the revised invoice, committed and walked on its own; **3b** the card flow on the
  online-payments rail, its books, refunds and the club's "Send the invoice", with its own `/review` and walk (said out loud
  from the code: six guarded payment functions send any flow that isn't a house-league sign-up down the tournament-team
  path, so a new flow changes each; and card can't serve production until Club Tier Stage 12). (2) **The invoice and receipt
  emails carry a link, no attachment** — nothing in the product attaches a file to an email, and the drawings keep the PDF
  out of the offer email so it isn't filtered; the email states the number, amount, due date and how to pay, and its button
  opens the business's page, where the PDF downloads. (3) **Card stays on an invoiced deal's link, at the invoice total, and
  the club pays the fee on that payment** (a Payment processing cost, whichever way the Payouts row is set), so both drawn
  sentences hold: "Their link still lets them pay by card" and "An invoice already issued never gains a fee line
  afterwards". (4) **Card refunds are drawn before they are built** — a small drawing at the start of 3b (the shipped refund
  window, whole or part, never the fee; the deal after a full and after a part refund). Two defaults said with them and not
  objected to: a part payment splits between the sponsorship and its tax in proportion, the last payment taking the
  remainder so both lines land exactly; an invoiced deal's amount or tax changes (the revised invoice: same number, a
  "Revised {date}", emailed again) only while no payment stands — a recorded payment is voided first.
  **Part 3a code built 2026-11-23** (migration **528** applied to dev at the owner's word, "yes, apply 528 to dev", twice,
  re-runnable; applied to prod 2026-11-23 and live in master job 294, `3077c31e7`): the club invoice PDF on the server for both doors (the coach
  invoice's page shared, the coach builder still passes no tax: R2 held), the invoice / revised / "Paid in full" emails
  (a link, no attachment; `.local` addresses never sent), Record a payment (the shipped ledger fields; part payments) and
  Void (the shipped correction question), the revised invoice replacing the "can't change" refusal, the books (platform
  item "Club sponsorship" with a fixed id kept off every team's picker by `itemVisibleToTeam`; "GST/HST collected" its own
  filing, left out of every Budget vs. Actual figure and kept in Cash on hand), each line opening its deal from the Ledger,
  and the database guard on a deal's money. Said out loud from the code: the drawn deal-page money band has no list for a
  part payment or a void, so a small **Payments** card sits under the band (undrawn — for `/design`); the PDF footer prints
  the club's own "Exported: {day} · Generated by FieldLogicHQ" (the club's PDF settings; `/design` + `/accounting` to look).
  Typecheck clean; Part 3a tests and the sponsorship suites 91/91; full suite 35 failures, none in this work except the
  grants guard (fixed) and the team-move list (classified); probe `.probe/stage6-p3a-money-probe.mjs` ALL PASSED on UAT
  Rep Only (its mailing address and settings restored, empty). **Part 3a COMMITTED `0f2b83490` 2026-11-23** after the full close-out (`/simplify`, `/review`, `/marketing`, `/ux`, `/docs`, `/legal`,
  `/accounting`; probe ALL PASSED; walk **§562**, 46 steps, eight owner calls outside the count). **Held back at the owner's
  ruling:** the deal page (`DealScreen.tsx`), the new `DealPaymentWindows.tsx` and `Sponsorships.module.css` — another session is mid-edit on
  the same screens (its record-page redesign is interleaved), so the deal page's Record a payment, Payments card and Void land
  when that session does; the committed words keep `errInvoicedChange` and an optional `emailed` argument so the older page
  compiles. Found and fixed at the review: the Months balance now carries GST/HST collected (so Cash still closes on Cash on hand;
  the row reads "The club’s other books and GST/HST collected"), and a post-payment place failure no longer fails a committed payment
  or skips the receipt. Part 3b (card, refunds drawn first): `BOARD_READY_STAGE6_P3B_KICKOFF_PROMPT.md`.
  **Walk §562 passed 46 of 46, 2026-11-23**; the eight owner calls ruled, each as recommended:
  leave as built (Sponsorships is enough to record and void), one tax row on Months, not now for an "invoiced, not yet paid"
  GST/HST figure — and five that ask for a build: **print "Withdrawn" on a withdrawn invoiced deal's PDF; soften the business
  page's "we'll email your invoice" when the club can't email; keep the original figures on a revised invoice (migration 528,
  dev-only); let a business add a logo after it has paid; add a "GST/HST remitted" word.** **The five built 2026-11-23** at
  the owner's "build the five now", on dev, uncommitted, in files that avoid the other session's held deal page: the
  withdrawn invoice says "Withdrawn {date}" in its subtitle (the house has no stamps; How to pay gone, $0.00 owing); the
  business's page asks the sender's own question (`clubCanEmailInvoice`) before promising an email; **migration 529** (a
  new one after 528, both prod-pending, rather than editing the committed 528) keeps the invoice's first figures on its
  first revision and adds the club-only Admin word "GST/HST remitted" (fixed id), left out of every Budget vs. Actual
  figure by `isPassedOnTax` and carried on Months' one row, now "The club's other books and GST/HST"; the logo route and
  the receipt page take ONE logo on a paid deal, from a business that never sent one, while the deal runs (`linkTakesLogo`;
  the write holds the once-only rule), and a logo save that writes no row no longer deletes the old file. `/review`
  2026-11-23 (4 lenses) fixed: a paid deal's public logo could be replaced from a forwarded link with no time limit (now
  add-once); a pending GST/HST line counted twice on Months' Scheduled lens (now on the other-books row only); a deal
  revised before 529 would have stamped its earlier revision as the "first" figures (now left empty); the help article and
  the export note named the old Months row. Left as found: `scripts/check-club-money-arithmetic.mjs` recomputes the
  other-books net with no GST/HST term (a database check: report only); two uploads at once can leave one unused file in
  storage. **529
  applied to dev 2026-11-23** at the owner's word ("yes, apply 529 to dev"), twice, read back; snapshots refreshed (watermark
  529); applied to production 2026-11-23 before the promote, and live in the evening promote (master job 294, `3077c31e7`). Owed: `/docs` (the club money article names GST/HST collected
  only); ~~`/marketing` on the DRAFT words; a short walk~~ (words settled and committed `5f98b7c1c`; no walk, owner 2026-11-23: "no need for a walk"). ~~Open owner question: a club can still put "GST/HST remitted" on
  its plan.~~ **RULED 2026-11-23 ("sure remove gst/hst from budget plan"):** off the plan — the plan's Filed under hides it
  and both plan saves refuse it (`readPlanWord`, `tax_not_planned`); the ledger's Filed under keeps it.
- **Part 3b · the deal page landed `d07a050fe` 2026-11-23** (the held-back Record a payment, Payments card with Void, the
  invoice PDF link, the revised invoice). **The card-refund drawing RULED 2026-11-23, all seven as recommended** (owner: "I
  agree with all the recommendations, go ahead and build"; https://claude.ai/artifact/RSMZkJKM2JHZkLwH2bg7Z5, source
  `BOARD_READY_STAGE6_P3B_CARD_REFUNDS_DRAWING.html`): (1) each payment opens its own window, Refund (card) or Void (cheque,
  e-transfer) at its foot's start, the inline Void retired; (2) the refund window as drawn — nothing picked, All of it / Part
  of it, a reason for both, never a fee box, the sponsor-paid-fee intro; (3) a full refund ends the deal as Withdrawn (logo
  down, the place freed); (4) a fourth "Refunded" figure in the money band once a refund stands; (5) who may refund = who may
  Record and Void (Sponsorships, per §562's ruling); (6) the shipped refund email, and the business's page lists the refund;
  (7) the invoice lists the refund, `/accounting` confirming whether a credit note is needed before that part is built.
  **`/accounting` answered ask 7 the same day: yes** — the club reduces the GST/HST it collected only with a credit note (CRA
  Memo 12.2 ¶15–23), so each refund that reaches the card on a taxed invoice carries one ("{invoice}-C{n}", the invoice's own
  page titled "Credit note", downloaded by the club and from the business's link), and the invoice still lists the refund.
  **Part 3b code built 2026-11-23** (migration **530** applied to dev 2026-11-23 at the owner's word, "apply 530 to dev", twice, read back; snapshots refreshed; production pending in `MANUAL_PROD_STEPS.json`):
  the third online-payments flow `sponsorship` (its shape, one open page per deal, the guard's arm; the shared cost line and its
  locks answer a sponsorship; the landing, dispute and refund-event paths answer one before every tournament-only writer);
  card on the business's page (one button per way to pay, the fee note, the refund-policy link; an invoiced deal's link pays
  what is owing with the club paying the fee); the card landing (`club_sponsor_card_land`: the invoice when the payment issues
  it, the payment, the sponsorship / fee / GST/HST lines and the fee as Sponsorship › Payment processing, Paid, the receipt
  once); refunds (`club_sponsor_deal_refunds`; open → Stripe → book, a full refund ending the deal as Withdrawn); the payment's
  window and the refund window as drawn; the fourth Refunded figure; "Send the invoice"; the credit note; the refund email
  ("Refund from {club}", the shipped refund block). Said out loud from the code: a sponsor's card DISPUTE is answered in Stripe
  and leaves the deal as it is (the dispute writer would put the money back on a team), and a refund made in the club's own
  Stripe dashboard on a sponsorship is not booked by guesswork — Sponsorships is told to record it in the Ledger. Typecheck
  clean; Part 3b tests + the sponsorship and card-payment suites 110/110. Owed (hand-off prompt `BOARD_READY_STAGE6_P3B_FINISH_PROMPT.md`): `/simplify`
  → `/review` → `/marketing` → `/ux` at 390 → `/docs` → `/legal` (the Payments Terms' sponsorship-card section) →
  `/accounting` → probe → walk.
  **Part 3b chain, state 2026-11-24:** `/accounting`, `/legal`, `/docs`, the probe (4 runs) and the walk (§564) done 2026-11-23/24;
  `/simplify` and `/review` (five lenses) run 2026-11-24, five defects fixed (a sponsor switching card → cheque or a club editing
  terms while a card page was open; the wrong "lines voided" words on a refused refund; the notice guard; a fail-soft page read).
  **Owner 2026-11-24: every other review finding is to be fixed after he finishes walk §564** — Payouts and the bank check learning
  the sponsorship flow (before the payments switch goes on for a real club), the "not recorded" wedge, pending refunds that never
  resolve, `ends_deal` at booking, the `ON DELETE RESTRICT` link, the sponsor notices, credit-note numbering, the lost-dispute
  books, the dashboard refund, the `re_` reference, plus the smaller items: list and order in
  `BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md`. The `/ux` check at 390 ran 2026-11-24 (a real phone-width render of the deal screens; its fixes are committed in the commit after `ef7fe7d28`; six decisions are listed in the after-walk record). **The six decisions RULED and BUILT 2026-11-24** (owner: "all six now, as recommended"; the record is in the after-walk file): an open dispute said before a refund is typed, no money named on a blank part amount, a refunded-away deal says so on the business's page (never "in full", /marketing + /legal), amber for refund trouble, the three refund-area questions follow a phone's keyboard (owner's phone check owed), "Don't pay again" from the first second of Confirming.
  **Part 3b after-walk fixes COMMITTED 2026-11-24** (owner: "go, commit in that order, tweaks included"): the database `0ca618cc3` (migrations 531 to
  534, applied to dev, pending on production after 530), the code, words and tests `6d866f1b9` (the Payouts tab and bank check know a sponsorship,
  a lost dispute is booked, a bounced refund's credit note is kept and cancelled, the arrival wording and the Stripe code on refund emails
  settled, with the walk-time tweaks), and the daily job's refund-retry step on its own `7f2015740`. `/simplify`, `/review` (five lenses),
  `/marketing` and `/legal` run; `/accounting` answered the dispute books. **Walk §565 PASSED 30 of 30, 2026-11-24** (`BOARD_READY_STAGE6_P3B_AFTER_WALK_WALK.html`); owner calls ruled as recommended: no email to the business when its payment
  is taken back; the dispute reminder email later, worded for a sponsor; production order = migrations 530 to 534 and the five files first, the refund-retry step
  of the daily job in its own commit; a refund made in Stripe's own dashboard is a plan item, separate from Part 3b. Owed: migrations 530 to 534 on production before
  the promote, and that plan item. The commit plan: `BOARD_READY_STAGE6_P3B_COMMIT_PLAN.md`.
- ~~The per-deal "Charge HST" switch carries no words telling a club WHEN to turn it on.~~ **Added 2026-11-22 (owner: "add
  the hint")**, words checked against CRA RC4081 then set in brand voice (`docs/agents/accounting/BOARD_READY_STAGE6_SPONSOR_PAYMENT_FEE_REVIEW.md`
  addendum): the switch's hint reads **"13% for an Ontario address, added to the amount. A sponsorship that shows a name or
  logo is usually not charged tax. Turn this on only if your accountant says this deal is taxable."** The rate sentence
  follows the business's province (e.g. "5% for an Alberta address…"); the same words on a phone; static, never reacting to
  the deliverables (classifying a deal would be tax advice); never call a banner or web placement "advertising" (CRA's
  advertising test names TV, radio and periodicals). Replaces the drawn hint's "Your club is registered for GST/HST."
- Policy text owed with the next versions (`/legal` writes): Privacy §5, §9, §12; Terms §4; Payments Terms §3, §4, §9.
- A tax professional: the province-of-the-buyer rule (ask 9) and whether recognition alone is a supply; a lawyer's eye (no
  gate) on the CASL sender question, the two-year clock and a passed-on fee under Québec law.
- Unblocked by this ruling (§7b item 2): the public tournament pages' sponsors drawing can start.

- [ ] Club **sponsorship packages**: name, price, what's included (a list of deliverables: logo on the site, field banner, jersey
  crest, named division), how many are available, and an optional sponsorship document (PDF) to send.
- [ ] **Sponsors and deals:** a deal is a sponsor + a package + what it's attached to (the club · a house-league division ·
  a house-league team · a club event · a tournament) + an amount. States: Offered · Form received · Invoiced · Paid ·
  Delivered.
- [ ] **The sponsor link:** a page the business opens without an account. It shows the package, the club's sponsorship form (Stage 4),
  a logo upload, then pay by card (Stripe Connect direct charge, the club is the merchant) or "we'll send a cheque / e-transfer" (recorded by the club).
  A business is not a family, so the 2026-10-31 family-links rule doesn't apply. The tournament team pay link is the
  precedent. `/legal` checks it.
- [ ] **Club invoice** PDF and receipt. The coach invoice's no-tax ruling (R2) was about teams. A club may be a GST/HST
  registrant, and a sponsorship with advertising is not a donation. The tax shape researched in §9 needs the owner's
  acceptance before this is drawn (Q8).
- [ ] **Delivery checklist:** what they got, ticked as each item is delivered.
- [ ] The paid deal feeds the **one sponsor list** (ruled 2026-10-27), so the logo shows where the deal says.
- [ ] Money lands in the club books as sponsorship income. Renewal next season: "Offer again" from last year's deals.
- [ ] Team sponsorships in the Coaches Portal stay the team's (2026-11-06 ruling). They are not merged or moved.
- [ ] **Who pays the card fee** (ruled 2026-11-22, ask 3, `BUSINESS_DECISIONS.md`): a second club-wide choice on the Payouts
  card, separate from the registration one: "The club pays it" (default; the sponsor pays the invoice to the cent, the fee is
  a Payment processing cost) or "The sponsor pays it" (the fee shows as its own line on the invoice and the pay page before
  paying, with the club's GST/HST on it). ~~Owed to the build: whether that line is grossed up.~~ **Answered by the code
  (round 2 finding F13, 2026-11-22):** no gross-up is needed. `onlineFee()` works the fee out on the amount owed, never on
  the charge, and the club receives the charge less that fee; Stripe's extra cents on the larger charge come out of
  FieldLogicHQ's application fee. On the drawing's deal the club receives $1,135.34 and keeps $1,000.00 after $135.34 HST.
- [ ] Live card payment waits on Club Tier Stage 12's production switch; everything else can ship first.
- [ ] Migration first; dictionary + snapshots.

### Stage 7 — Camps and clinics (item 6)
- [ ] A camp or clinic is a club event (Stage 5) with sessions, a capacity, a price, a waitlist and a sign-up form (Stage 4).
- [ ] Time is held from permit time through the scheduler, adding a camp program alongside house league.
- [ ] Sign-up and pay reuse the house-league path: no account at sign-up, the "Your sign-up" page for status / pay /
  withdraw (2026-10-31 rules), and placement confirmed by the club.
- [ ] Listed in the club site Events section with a Sign up button. An instructor sees the roster and takes attendance.
- [ ] Accounting: add camps as a revenue category, since the readiness plan excludes it "unless explicitly added". Tax class
  for instruction: the per-program Exempt/Taxable setting from §9 (Q8).
- [ ] Live payment waits on Club Tier Stage 12, as for sponsorships.
- [ ] Migration first; dictionary + snapshots.

## 6. Architectural decisions (proposed, for the owner)

- **Three foundations, then assembly** (People, Forms, Club events). **Rationale:** items 5–8 share one shape; four
  separate builds would mean four form builders and four payment flows.
- **Matching suggests and the registrar confirms; a friend code is the exact path.** **Rationale:** the "a match is a
  question" ruling, and accuracy without guessing.
- **Coach groups are live queries.** **Rationale:** a hand-kept list goes stale every season.
- **Documents are the club's to define** (owner, 2026-11-10). They can be any type, with a saved file and a custom expiry. **Rationale:** how a club
  manages its documents is its own business; the product's job is access control on the files.
- **Fix, then document.** **Rationale:** a security brief that leaves out known gaps is a defect.
- **Team money stays the team's.** **Rationale:** the 2026-11-06 ruling; club sponsorships are a new club-level book
  beside it.

## 7. Open questions (owner)

- [x] **Q1 Data residency** — RULED 2026-11-10: **not moving.** The board's concern was leaks and data being sold, not
  location (§8).
- [x] **Q2 Documents** — RULED 2026-11-10: generic documents, any type, saved files, custom expiry; the club decides.
- [x] **Q3 Friend requests** — RULED 2026-11-10: the club sets the maximum per child, default 2; admins see honoured /
  not honoured after the draft; parents get no such message.
- [x] **Q3b** — RULED 2026-11-10 ("agree with your recommendations"): the largest keep-together group is 3 children,
  siblings counted. ~~*Not ruled:* whether the club can change it.~~ **Ruled at the Stage 1 drawing 2026-11-10 (A1):
  fixed at 3, not club-set.**
- [x] **Q4 Missing document** — RULED 2026-11-10: **warn, never block**.
- [x] **Q5 Penetration test** — RULED 2026-11-15 (owner): **out of scope at this stage.** The pack leans instead on the security
  already in place and the checks we run (access sweeps, two-step sign-in, the guards the build enforces), stated plainly.
- [x] **Q6 Gates** — RULED 2026-11-10 ("agreed"): §9 as written; `/strategy` logs it.
- [x] **Q7 Ruling D5** — RULED 2026-11-15 (owner): **yes, the club calendar should be able to handle club events.** Stage 5's
  shape below is unchanged; D3 (the club never writes a team's schedule) still stands.
- [x] **Q8 Tax** — RULED 2026-11-10 ("agreed"): the §9 shape.
- ~~Q9 Board proposal scope~~. **Withdrawn (owner 2026-11-10):** the owner sets the priority sequence as the project
  goes, as on every project. The plan recommends, and the owner decides.

## 7b. Execution order (recommended 2026-11-10; the owner sets priority as it goes)

Each build step is drawing (`/design`), then the owner's ruling, then the build, then a walk. Steps in the same wave can run in
parallel.

| # | Step | Wave | Waits on | Drawing? | State (2026-11-16) |
|---|---|---|---|---|---|
| 1 | **0a-1** Third access sweep (report, then fixes on the owner's go) | 1 | nothing | no | **Done:** swept 2026-11-10; fixes A–E committed 2026-11-11, in `release/2026-11-15`. Owner calls left open by the report are still open (§5 Stage 0a) |
| 2 | **Stage 1** Friend requests in the draft | 1 | nothing | yes | **Done:** three parts committed and walked (§510, §516, §518), in `release/2026-11-15` |
| 3 | **0a-2** Two-step sign-in: offered to everyone, club may require (all asks ruled 2026-11-10) | 1 | ~~build waits on Wave 2 Fix A~~ (Fix A committed `3d9b1ec13`) | yes | **Done:** four parts committed and walked (§511, §513, §515, §520), in `release/2026-11-15` |
| 4 | **0a-3** Org delete removes its files · backups written down | 2 | nothing | no | **Half done:** org delete committed `45c134bea` 2026-11-15 (not yet in a release tag). Backups ruled 2026-11-16 (daily is enough); writing down the retention and a first restore rehearsal are owed |
| 5 | **0a-4** Privacy policy + terms published (the legal-pages work in GST/HST Stage 6) | 2 | that plan | no | Not started here (tracked in that plan). Data terms for clubs and the supplier list: not started |
| 6 | **0c** Board pack: brief, diagrams, questionnaire answers, Security page, the public roadmap | 2 | 1, 3, 4, 5 | the page only | Roadmap drawn and ruled 2026-11-16; everything else not started |
| 7 | **Stage 2** Group email to coaches | 2 | 1 (done) | yes | **Drawn 2026-11-16** (https://claude.ai/artifact/WVuNq47ywkxKgmFSYew2eF), asks 1–13 owed; nothing built. The public roadmap carries it as Committed for 2026 only if it is built before the roadmap is first shown (roadmap ask 11) |
| 8 | **Stage 3** The club's people + documents with expiry | 3 | nothing (adds groups to 7) | yes | Not started, not drawn |
| 9 | **Stage 4** Custom forms (house-league sign-up first) | 3 | nothing | yes | **✅ COMPLETE 2026-11-22 (owner's word): Parts 1–3 and 4.P built and walked; the production promote of Parts 1–3 is what remains.** History: **Drawn 2026-11-20** (round 2 after `/legal`, `/ux`, `/design`): https://claude.ai/artifact/THVuyR2zxwU8ezeFti5of9, source `BOARD_READY_STAGE4_FORMS_DRAWINGS.html`; **all 20 asks ruled 2026-11-20 as recommended** (§5 Stage 4); build prompt `BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md` (three parts) and the tournament fixes `BOARD_READY_TOURNAMENT_QUESTION_FIXES_PROMPT.md` written 2026-11-20; nothing built. **First in the owner's order of 2026-11-20** (prompt `BOARD_READY_STAGE4_FORMS_DRAWING_PROMPT.md`) |
| 10 | **Stage 5** Club events | 3 | ~~Q7~~ (ruled yes 2026-11-15) | yes | Not started, not drawn |
| 11 | **Stage 6** Sponsorships | 4 | 9 (10 no longer, owner 2026-11-20: a club event joins later); live card pay waits on Club Tier Stage 12 | yes | Drawn 2026-11-22 (round 1) and all 15 asks ruled the same day (§5 Stage 6); round 2 (the "sponsor pays the fee" case) and the build prompt next. Not built. Sponsors on the public tournament pages wait for this stage (owner 2026-11-20); their drawing can now start |
| 12 | **Stage 7** Camps & clinics | 4 | 9, 10; live card pay waits on Club Tier Stage 12 | yes | Not started, not drawn |
| — | **0d** Continuity message points + `/legal` + write-up | when the owner calls it; **not in the pack (owner 2026-11-16)** | — | no |
| — | ~~**Q5** Penetration test~~ | ruled out of scope 2026-11-15 | — | — |

Why this order:
- Wave 1 has the two things a board will test, safety and the registrar's biggest spreadsheet, and needs nothing else.
- The pack (6) waits for the fixes it describes.
- Group email (7) waits on the sweep (1) because it is a recipient picker.
- People (8) adds groups to it rather than rewiring it.
- The three foundations (8–10) come before the two assemblies (11–12). Sponsorship leads wave 4 on the owner's
  "important" mark.
- 11 and 12 can be built up to the pay button before Stage 12's production switch.

**ORDER RULED 2026-11-20 (owner, "agree", on the recommendation in that session). It replaces wave 3 and 4 above:**
1. **Now, side by side:** draw and build **Stage 4, custom forms** (prompt `BOARD_READY_STAGE4_FORMS_DRAWING_PROMPT.md`);
   **draft the board pack (0c)**, which goes public with the privacy policy, terms and data terms in the Club release (0a-4);
   finish **Club Communications** as already sequenced (it carries Stage 2).
2. **Stage 6, sponsorships,** drawn while Stage 4 is built, then built on it: the sponsor link's questions are a Stage 4
   form (prompt `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_PROMPT.md`). It **no longer waits for Stage 5**: "a club event"
   joins its "attached to" choices when events exist. When its drawing is ruled, the public tournament pages' sponsors
   drawing can start (owner 2026-11-20: tournament sponsors wait for this stage).
3. **Stage 5, club events,** then "a club event" is added to sponsorship's choices.
4. **Stage 3, people and documents,** once Club Communications has its coach and board email windows (its reminders and
   groups use them). It needs neither forms nor events, so it can move up if a board's screening question becomes urgent.
5. **Stage 7, camps and clinics,** last: it needs forms, events, permit time and online payments.

Why: three things sit on forms (house-league sign-up, the sponsor link, camp sign-ups), and its first use pays off on its
own; building sponsorships first would build a fixed set of sponsor questions and move them into a form later. Events is
only one of sponsorship's five choices, so sponsorship does not wait for it. Card payment for sponsors and camps stays
off until online payments are switched on in production; everything up to the pay button can ship first.

## 8. Moving production to Canada: effort and cost (researched 2026-11-10, for Q1) — **RULED: NOT MOVING**

> **Owner 2026-11-10:** *"we don't need to move the data, the board did not mention any concern of the data being in the
> US, just wanted to understand the security we have in place to ensure data doesn't leak or is being sold to vendors."*
> Kept below as the record of the estimate, in case it is ever asked again.

Measured read-only on production on 2026-11-10: 5 organizations, **no subscriptions**, 18 sign-ins, a 104 MB database
and 7 stored files (6.6 MB). This is the cheapest the move will ever be.

- **Engineering:** about **25–35 hours**:
  - new Supabase project in ca-central-1 (extensions, auth settings, buckets, realtime): ~3 h;
  - dump/restore rehearsal with password hashes and a parity check: ~5–6 h;
  - file copy plus the 6 stored logo/resource URLs rewritten: ~2 h;
  - project ref swapped in ~2 runtime files and ~25 scripts, Amplify env, Vault secrets, 12 pg_cron jobs replayed: ~3 h;
  - cutover runbook and smoke tests: ~4 h;
  - new Amplify app in ca-central-1 with a DNS move: ~5–8 h;
  - docs and `/legal`: ~2–3 h.
- **Owner's hands-on steps:** create the new project and app in the consoles, copy secrets, and make the DNS change.
- **Downtime:** about 30–60 minutes with writes frozen. **Everyone signs in again once.** Reset and verify links already
  sent stop working, and logos in already-sent emails break unless the old project stays paused for a few weeks as the
  rollback.
- **Cost:** about $10–20 once, for a month of overlap (a second Micro project plus a second Amplify app). **No ongoing
  difference** was found; regional price parity is unconfirmed on the pricing pages.
- **Both Amplify branches move** (one app serves `master` and `dev`). That also fixes today's oddity: the dev app is in the
  USA while the dev database is in Canada. Moving only the database leaves the app in the USA, which adds latency and
  moves nothing a board cares about.
- **What stays in the USA no matter what:**
  - Resend: email content and logs are always US-stored; there is no Canadian region.
  - Stripe: no residency option.
  - The business Gmail and the browser push services.
  - Possibly the server rendering: Amplify's current compute region is not documented; ask AWS before claiming it.

  The honest claim afterwards is **"the database and stored files are in Canada"**, never "all data in Canada".
- **Separate and not customer data:** FieldLogicHQ's own Bookkeeping (Aurora DSQL + S3, us-east-2). It bears on the open
  CRA records-in-Canada question (`docs/agents/accounting/RECORDS_RETENTION_AND_LOCATION.md`). DSQL availability in
  ca-central-1 is unconfirmed. In or out of scope is the owner's call.
- **Law, for the board:** PIPEDA does not forbid storing data abroad; it requires accountability, contracts and telling
  people (OPC transborder guidance). Québec Law 25 requires an assessment before data leaves Québec, *including to other
  provinces*, so Canadian hosting doesn't remove that step for a Québec club. BC dropped its public-body residency rule
  in 2021; Nova Scotia's status is unconfirmed. Both bind public bodies, not vendors.
- **Certifications:** Supabase states SOC 2 Type 2 (supabase.com/security), but the report itself is only available on its
  Team/Enterprise plans; Resend states SOC 2 Type II. Quote what each supplier's page says, nothing more.
- **Execution, if approved:** its own short plan from `/dba` + `/release` (rehearse once on a scratch project).

## 9. Specialist findings (2026-11-10; the gates and the tax shape were accepted by the owner 2026-11-10, Q6 and Q8 in §7)

**Gates (`/strategy` brief):** no new price, band or key.
- **Stage 0 is on every plan, never gated:** a security fix sold as an upgrade is a trust defect.
- **Stages 1–7 ride League Plus + both Club bands,** following the "plan choice follows what an organization runs, never
  an upgrade lever" rulings. The three-plan set already exists in code (the venue-library check), and `/billing` reuses it.
- **Stage 4:** reuse the existing custom-questions gate (Tournament Plus and up). The "I have read" consent tick is
  **never gated**.
- **Stage 6:** sponsor *display* stays with the public site. Decide the owed tournament sponsor-display gate together with
  Stage 6; tournament-only organizers get display only.
- **Drift:** none in prices or keys. The Facts header date is stale. The 2026-10-27 "one sponsor list per org" ruling is
  **not in the Business Decisions Log**, so log it.
- ~~**Open:** who pays the card fee on a sponsor payment (the families-pay default doesn't fit a business).~~ **Ruled
  2026-11-22** (owner, Stage 6 ask 3): a separate club-wide choice for sponsorships, "The club pays it" by default, "The
  sponsor pays it" optional, with the club's GST/HST on the fee line (`BUSINESS_DECISIONS.md` 2026-11-22). Built in Stage 6.

**Tax (product research, not `/accounting`):** `/accounting`'s charter is FieldLogicHQ's own books and excludes a club's
tax. CRA sources were read 2026-11-10.
- **Sponsorship:**
  - A non-profit or charity giving recognition only (logo, banner) is generally *not making a supply*, so no tax.
  - A non-charity non-profit selling real advertising can owe tax if registered.
  - Small suppliers ($50k; charities $250k gross revenue) neither collect nor charge tax.
  - A sponsorship is not a gift, so no donation receipt.
  - **The product needs:** a club setting "registered for GST/HST" with the number (default **no tax**), a per-deal tax
    toggle, the rate by province (never hard-coded 13%), the deliverables listed on the invoice, and never the words
    "donation", "gift" or "tax receipt".
- **Camps and clinics:**
  - Supervised series primarily for children 14 and under are exempt (ETA Sch. V Part VI s.12; CRA GI-037).
  - Overnight camps, and programs primarily for those over 14, are taxable if registered.
  - **The product needs:** a per-program Exempt (default) / Taxable setting and a plain-language warning driven by the age
    range and overnight answer.
- **For house league the same rule gives the club's side:** default exempt, optional taxable switch. ⚠ Corrected
  2026-11-10: this does **not** settle Stage 12's D13, which also asks whether FieldLogicHQ is a platform collector. A
  pointer was added beside D13 in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`.
- **ACCEPTED by the owner 2026-11-10** ("agreed"): the tax shape above for sponsorship invoices, camps and house-league
  fees.
- **A professional should confirm:**
  - a given club's registrant status;
  - whether any club sells true advertising;
  - mixed-age leagues and U15+ programs;
  - one-off clinics;
  - Québec and the PST provinces.

## Words for /marketing
> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk.
- [x] The Stage 0c brief as the Security page copy: settled 2026-11-21 (S1), the words and their `/legal` verdicts in `docs/agents/legal/drafts/SECURITY_BRIEF.md` v0.4
