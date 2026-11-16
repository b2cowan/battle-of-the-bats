# Board Ready — what a club board needs before it says yes — Implementation Plan

> **Status:** Planning — nothing ruled, nothing built. Owner questions in §7 come first.
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
  recognises; it is owner question Q5.
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
- [ ] **Third access sweep** (replaces "contact-email leak", which was already fixed `b15b01fea` 2026-10-16). It is
  report-only first, on the pattern of the second sweep (`TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md` § Second sweep). It covers
  every route and page added or changed since 2026-10-16, reads as well as writes, tenant boundaries and seat by seat.
  Each finding is fixed with the owner's go. It is the evidence behind the pack's "doesn't leak", and it comes before Stage 2.
  → **Swept 2026-11-10, report [`BOARD_READY_ACCESS_SWEEP_3.md`](BOARD_READY_ACCESS_SWEEP_3.md): 2 serious, 5 medium, about
  25 small; nothing reads another club's people.** Serious: (1) inside a club, assistant coaches, scorekeepers and staff
  read the tournament emails and their recipient lists; (2) any signed-in account can delete or replace any club's rules
  files. Both are proven on dev and the same code is on production. Fixes are awaiting the owner's go. The report's seat
  table is the source for the pack's "who can see what".
- [ ] **Two-step sign-in** (§7b step 3). **Drawn 2026-11-10; ALL ASKS RULED 2026-11-10** (ask 1 as amended by the owner; asks 2–8 and A–F as recommended,
  owner: "I agree with the recommendations on this mockup"). **Build prompts written 2026-11-10: `BOARD_READY_TWO_STEP_BUILD_PROMPTS.md`
  (Part 1 Opus, 2 Sonnet, 3 Opus, 4 Sonnet); Part 1 waits for Board Ready Wave 2 Fix A to be committed** (both change the shared sign-in check in `lib/api-auth.ts`); nothing
  built.** Drawings (round 3, after `/design` + `/legal` and the ask 1 ruling):
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
- [ ] Backups: confirm what the Pro plan does (daily backups vs point-in-time recovery), decide whether PITR is worth the add-on, and write it down in `docs/agents/ops/`.
- [ ] Publish the legal pages (privacy policy, terms) already tied to `GST_HST_STAGE6_TERMS_PLAN.md`, so this plan does not duplicate that work.
- [ ] Data-processing terms for clubs and a sub-processor list (`LEGAL_INDEX.md` rows "not started") via `/legal`.

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
- [ ] The **privacy policy published** (it is the promise "we don't sell your data" in writing), via the legal-pages
  work already tied to `GST_HST_STAGE6_TERMS_PLAN.md`.
- [ ] Architecture diagram and data-flow diagram (what a family's sign-up touches, end to end).
- [ ] A filled-in vendor security questionnaire (the common short form), so the next board gets it on request.
- [ ] A public **Security** page on the marketing site, drawn from the brief (`/marketing` words, `/legal` review).
- [ ] Optional (owner Q5): an independent penetration test, with a summary letter for boards.

**0d · "What if something happens to the owner?"** (board concern 2026-11-10; the owner plans it **later**)
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
- [ ] Sign-up form: per child, "Who would you like {child} to play with?" Up to the **club's set maximum per child,
  default 2** (owner ruling 2026-11-10, Q3), first + last, plus an
  optional "their parent's name" to help the match. Each confirmed sign-up shows a short **friend code** on the
  "Your sign-up" page (no new link to families), and a parent may enter another family's code instead of a name.
- [ ] Registrar **Friend requests** queue in the season's registrations: each request shows its best suggestions from
  this season's sign-ups in the same division (normalised name, then parent name). The registrar chooses **Confirm**,
  **Pick another**, **Not signed up** or **Can't honour**. Code matches arrive confirmed. A request made both ways is marked
  "Both asked".
- [ ] Draft: confirmed requests become a **keep-together** group, using the "Families together" machinery. Groups are
  capped at a size (Q3) so friend chains can't break team balance, and the convenor can split one. After a draft, every
  request reads **Honoured** or **Not honoured — why** (cap, division, locked).
- [ ] Draft board: a Friends filter and a mark on the player chip, just like siblings.
- [ ] Transparency is **for the club's admins**: after the draft they see every request as Honoured / Not honoured,
  with the reason. **Parents get no honoured / not-honoured message** (owner ruling 2026-11-10, Q3). On "Your sign-up" a
  parent sees only what they asked for, and never another child's details.
- [ ] Migration first (request rows + code), then `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`.
- [ ] `/legal`: a parent typing another child's name, and how long requests are kept (purge at season end).
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

### Stage 4 — Forms (item 5) — FOUNDATION: Forms
- [ ] Generalise the tournament custom-questions model into one **club form**: question types (short answer, long answer,
  one choice, many choices, yes/no, date, file upload). Each is required or optional, with help text, in a set order.
  **No branching logic in the first pass** (push back if asked; that is where form builders get out of hand).
- [ ] **Document blocks:** the club attaches a PDF and the family must open it before ticking "I have read {document}".
  Ticks are recorded with the document version and time, like today's waiver consent, which becomes one of these blocks
  without losing existing consent records.
- [ ] First use: the house-league season sign-up (copy last season's form). Then tryouts, camps (Stage 7) and sponsors (Stage 6).
- [ ] Answers flow into the registrations list (columns + filter), the export and the draft board notes view, keeping
  ruling A8 (only seats that can open registrations see notes and answers).
- [ ] Gate: the tournament version is Tournament Plus value today, so the club gate is a `/strategy` call (Q6).
- [ ] Migration first; dictionary + snapshots.

### Stage 5 — Club events (item 8) — FOUNDATION: Club events
- [ ] A club-owned event: name, kind (banquet, champs day, AGM, clinic, camp, other), date and time, venue from the venue
  library, optionally held from permit time, and audience (public · families · members · staff).
- [ ] Shows on the club calendar (writable **for club events only**; teams' schedules untouched, D3) and in an **Events**
  section on the club site and in the family app. No RSVP links by email (2026-10-31); a sign-up uses a Stage 4 form.
- [ ] Champs day: an event that gathers the house-league playoff or final games under it.
- [ ] Owner ruling owed: D5 reopened for club events (Q7).
- [ ] Migration first; dictionary + snapshots.

### Stage 6 — Sponsorships (item 7)
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
- [ ] **Q5 Penetration test:** still open (no recommendation was made). Recommend deciding once 0a is done, when the pack is ready.
- [x] **Q6 Gates** — RULED 2026-11-10 ("agreed"): §9 as written; `/strategy` logs it.
- [ ] **Q7 Ruling D5:** let the club calendar hold club-owned events?
- [x] **Q8 Tax** — RULED 2026-11-10 ("agreed"): the §9 shape.
- ~~Q9 Board proposal scope~~. **Withdrawn (owner 2026-11-10):** the owner sets the priority sequence as the project
  goes, as on every project. The plan recommends, and the owner decides.

## 7b. Execution order (recommended 2026-11-10; the owner sets priority as it goes)

Each build step is drawing (`/design`), then the owner's ruling, then the build, then a walk. Steps in the same wave can run in
parallel.

| # | Step | Wave | Waits on | Drawing? |
|---|---|---|---|---|
| 1 | **0a-1** Third access sweep (report, then fixes on the owner's go) | 1 | nothing | no |
| 2 | **Stage 1** Friend requests in the draft | 1 | nothing | yes |
| 3 | **0a-2** Two-step sign-in: offered to everyone, club may require (all asks ruled 2026-11-10) | 1 | build waits on Wave 2 Fix A (same shared sign-in check) | yes |
| 4 | **0a-3** Org delete removes its files · backups written down (PITR call) | 2 | nothing | no |
| 5 | **0a-4** Privacy policy + terms published (the legal-pages work in GST/HST Stage 6) | 2 | that plan | no |
| 6 | **0c** Board pack: brief, diagrams, questionnaire answers, Security page | 2 | 1, 3, 4, 5 | the page only |
| 7 | **Stage 2** Group email to coaches | 2 | 1 | yes |
| 8 | **Stage 3** The club's people + documents with expiry | 3 | nothing (adds groups to 7) | yes |
| 9 | **Stage 4** Custom forms (house-league sign-up first) | 3 | nothing | yes |
| 10 | **Stage 5** Club events | 3 | Q7 | yes |
| 11 | **Stage 6** Sponsorships | 4 | 9, 10; live card pay waits on Club Tier Stage 12 | yes |
| 12 | **Stage 7** Camps & clinics | 4 | 9, 10; live card pay waits on Club Tier Stage 12 | yes |
| — | **0d** Continuity message points + `/legal` + write-up | when the owner calls it | — | no |
| — | **Q5** Penetration test | decide after 6 | — | — |

Why this order:
- Wave 1 has the two things a board will test, safety and the registrar's biggest spreadsheet, and needs nothing else.
- The pack (6) waits for the fixes it describes.
- Group email (7) waits on the sweep (1) because it is a recipient picker.
- People (8) adds groups to it rather than rewiring it.
- The three foundations (8–10) come before the two assemblies (11–12). Sponsorship leads wave 4 on the owner's
  "important" mark.
- 11 and 12 can be built up to the pay button before Stage 12's production switch.

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

## 9. Specialist findings (2026-11-10; proposed, nothing ruled or logged)

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
- **Open:** who pays the card fee on a sponsor payment (the families-pay default doesn't fit a business).

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
- [ ] (none yet; the Stage 0c brief and Security page will be the first)
