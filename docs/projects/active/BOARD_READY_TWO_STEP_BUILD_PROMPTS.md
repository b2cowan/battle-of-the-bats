# Prompts — Board Ready · two-step sign-in, the build (four sessions)

> Written 2026-11-10, after every ask on the drawings was ruled (ask 1 as the owner amended it; 2–8 and A–F as
> recommended). Each part is its **own fresh chat** (`/clear` first), started with: *"Read and follow
> docs/projects/active/BOARD_READY_TWO_STEP_BUILD_PROMPTS.md, Part N."*
> - Plan of record: `BOARD_READY_PLAN.md` §5 Stage 0a, which holds the rulings, the census facts, the sign-in service
>   facts, the build outline and the `/legal` findings. Read it first.
> - Drawings, the approved mockups: https://claude.ai/artifact/5b956A7svYzjzmZhZUfnkc (source
>   `BOARD_READY_TWO_STEP_SIGNIN_DRAWINGS.html`). **Build to them** (tabs are named below). The words are drafts for the
>   copy pass.
> - Index: `BOARD_READY_PROMPTS_INDEX.md`.

## Order and models

| Part | What | Model | Waits on |
|---|---|---|---|
| 1 | The foundation: the server check, the code step at sign-in, setting it up, backup codes, staff always required, demos and tests | **Opus** | **Wave 2 Fix A committed** (same shared sign-in check) |
| 2 | Your account: Sign-in &amp; security, change password, lost phone, the "ask for a code" window on five actions | **Opus** (changed 2026-11-11, see below) | Part 1 committed ✅ (`7c8f092ab`) |
| 3 | The club's switches, the grace period, and every reset (club, coach, support's owner reset) | **Opus** | **Part 2 committed** (changed 2026-11-11, owner: Part 2 first) |
| 4 | What the club sees, and the words: Members, Overview, the emails, help, policies | Sonnet | Parts 2 and 3 committed |

**Why these models.**
- *Opus for 1 and 3:* both put a security decision in shared code, where one missed route is a hole:
  - the server check across about 350 routes;
  - a reset that crosses organizations;
  - an identity check with a timed wait;
  - a switch a thief would try to turn off.
- *Sonnet for 4:* it builds screens and words on mechanisms Parts 1–3 have already proven.
- *Part 2 moved to Opus (2026-11-11, after Part 1 was built):* the original reason ("screens on proven mechanisms") stopped
  holding. Part 2 has to change Part 1's security rules, not just call them: turning your own two-step off (the move a
  thief makes), replacing a phone you still hold (Part 1 allows that only after a backup code), and checking the current
  password without dropping the person's own session. One wrong order in any of those switches two-step off for a
  password-holder.

**Why Part 2 now runs before Part 3 (owner, 2026-11-11).** Part 2 builds the one "type your code again" window. Two of
Part 3's doors need it (turning a switch off, resetting someone), and so does the lost-phone screen's club version, which
points at Part 3's reset. Run side by side, both sessions would build that window in the same shared files at the same
time. In order, Part 3 plugs into a finished one.

**Not in these prompts:** the short "Two-step sign-in" paragraph `/legal` drafted for the Terms belongs to the Terms work
(`GST_HST_STAGE6_TERMS_PLAN.md`). Sonnet, any time, before the Terms publish.

## Standing for every part
- Branch `dev`, explicit paths, **no commit without the owner's yes**, shared files through a private index.
- Before code: the plain-language **UX summary** (AGENCY_RULES, blocking).
- Broad reading goes to helpers, and their claims are checked against the cited lines.
- **No change to production Auth settings.** The authenticator is already switched on there.
- Finish each part with:
  - `npm run verify:changed`;
  - `npm run typecheck` (shared auth);
  - a dev-server restart (shared modules);
  - `/review`, with its fixes applied;
  - a checkable owner walk published as an Artifact;
  - a product-owner summary.
- A migration checks the latest number at commit time, and updates the data dictionary and snapshots in the same unit.

---

## Part 1 · Opus — the foundation

> **BUILT 2026-11-11, committed `7c8f092ab` 2026-11-11** (mig 464 on its own, `6b19b5aca`) (migs 463 + 464 applied to dev; walk §511 ✅ 24/24 2026-11-11). What was built, the census
> correction (twelve sign-in doors) and six open owner calls: `BOARD_READY_PLAN.md` §5 Stage 0a "Part 1 (the foundation)".
> Next is Part 2; Part 3 starts after Part 2 is committed (owner, 2026-11-11; reason under "Order and models").

> **Step 0 DONE 2026-11-11** (both facts hold; results in `BOARD_READY_PLAN.md` §5 Stage 0a, "Sign-in service
> facts"). A session picking up Part 1 **starts at Step 1**. Before Step 1, confirm Wave 2 Fix A is committed
> (`git log` on `lib/api-auth.ts`) and read what it changed there: the census starts from the helpers as Fix A left
> them. Build on Step 0's findings:
> - read "when the code was last typed" from the session token's `amr` `totp` timestamp; refreshes don't move it;
> - clear the person's own half-finished set-ups on each new attempt (10-per-person limit counts them; the service
>   sweeps only those older than about 5 minutes) and give each attempt a unique name;
> - the service accepts a code twice within its window, so the "typed a code in the last 15 minutes" check and
>   backup codes keep their own one-time record;
> - the server check calls `getUser` (it sees a signed-out session at once); never decode the token alone.

**Step 0 · prove the two undocumented facts on dev, before any design is built on them.** Report them; if either
fails, stop and bring the owner a revised shape.
1. Does a session that passed the code stay at that level after the sign-in service refreshes it? Test it with a dev
   account and a short refresh.
2. The hosted limit on authenticators per person, and what happens to a set-up that was started but not finished.
   Clean up the half-finished ones on each new attempt.

**Step 1 · the census (delegate it, then check it).** List every place a server decides "who is signed in":
- the shared helpers in `lib/api-auth.ts` (as Fix A left them) and `lib/platform-auth.ts`;
- every guard that calls the sign-in service itself: `lib/coach-team-guard.ts`, `lib/families-auth.ts`,
  `lib/supabase-server.ts`, and any others the census finds;
- the admin, coaches and platform layouts.

The request layer (`proxy.ts`) skips every API route except `/api/admin`, so it is **not** the place for the check.
Return each one with the routes behind it.

**Step 2 · build:**
- **One migration**, everything this project needs, so later parts add none:
  - the organization's two switches (board, coaches), each off by default, with when each was turned on;
  - whether the owner has closed the one-time prompt;
  - the "test organization" exemption;
  - backup codes, stored as one-way hashes only;
  - each person's grace start per organization;
  - a waiting owner reset: who asked, how, why, when confirmed, when it runs, whether it is held or cancelled.
- **The requirement rule, one function:**
  - a person must use two-step if they are platform staff, or if they hold a seat that some organization's switch
    covers;
  - test organizations are never counted.
  - Part 3 adds the switches' screen, but the rule reads them from day one.
- **The server check:**
  - a password-only session in a required seat is refused in every place the census found;
  - a page is sent to the code step or the set-up step, never shown an error;
  - required seats are asked again after 30 days, read from the time the code was last typed in the session.
  - Add one shared "has typed a code in the last 15 minutes" check for Part 2 to wire.
- **The code step at sign-in** (drawing tab 3):
  - it is a state of the one shared sign-in page;
  - the five other places that sign a person in hand off to it: platform sign-in, the family claim page, team
    sign-up, the follow nudge on public pages, the account-only sign-up;
  - anyone with two-step on is asked, required or not;
  - a password reset never skips it;
  - "Use a different account" signs out this device only.
- **Setting it up** (tab 2, desktop and phone): the three steps, the phone's "Open in authenticator app", and backup
  codes (ten, shown once, used once).
  - Use our own hashed codes unless the sign-in service's own codes have left "experimental".
  - "Your other devices were signed out" is true because the service does it.
- **A backup code used at sign-in** (tab 3): you're in, how many are left, and an offer to set up a new phone.
- **Platform staff always required, no grace period.** Platform "sign in again" (`lib/platform-sign-in-again.ts`
  `checkPasswordAgain`) currently replaces the session with a password-only one; it **becomes a code check**.
- **Demos and tests** (tab 9):
  - set-up is refused for the shared demo accounts (`lib/demo-org.ts`), because one visitor setting it up would sign
    out every visitor;
  - the exemption is set on both demos, the Milton demo, and the UAT and fixture clubs;
  - **one new UAT account** with a known authenticator key, and a test that types the code it produces;
  - the UAT platform account gets one too.
- **Guard tests:** a new server route that checks sign-in must go through the check, or sit on an explicit allow-list.
  Kill-test it with mutants.

**Before hand-off:**
- **`/legal`**, light (it changes what we hold: the set-up key, the hashed codes).
- Re-run the third sweep's sign-in probes, and add a password-only owner of a required club. They must be refused.
- **Walk:**
  - set it up on a phone and on a computer;
  - sign in with a code, a wrong code, and a backup code;
  - confirm a demo still opens and refuses set-up;
  - confirm a UAT run passes.

## Part 2 · Opus — your account

> **BUILT 2026-11-11, commit owed (the owner's yes); walk §513 owed.** What was built, the review's Part 1 fix and two
> open owner calls (the database half of that fix; the production secret's deploy line): `BOARD_READY_PLAN.md` §5 Stage 0a
> "Part 2". **For Part 3:** the window is `components/shared/CodeAgainWindow.tsx`, opened by any route that returns
> `freshCodeRefusal()` (`lib/two-step-fresh.ts`) — the reset and the switches call `requireFreshCode()` after their own
> checks and need no client code; "Lost your phone?"'s club version turns on by flipping `CLUB_RESET_DOOR_BUILT` in
> `lib/two-step-lost-phone.ts` and making its rule the reset's rule.

> **Start here (written 2026-11-11 from the Part 1 build, `7c8f092ab`).** Read `BOARD_READY_PLAN.md` §5 Stage 0a, the
> "Part 1 (the foundation)" note and its six open owner calls, before the UX summary. Part 1 is committed; its owner walk
> (§511) is owed but does not gate this part. **Build on Part 1's pieces; do not make second copies of them:**
> - **The one server check** is `getSignedInUser` / `getSessionTwoStep` (`lib/two-step-session.ts`, `lib/api-auth.ts`).
>   "Typed a code in the last 15 minutes" is `provedWithin(state, TWO_STEP_FRESH_MINUTES)`. It already counts a backup
>   code. The guard test `tests/unit/two-step-server-check-guard.test.ts` fails a route that reads the session another way.
> - **Codes:** `lib/two-step-codes.ts` (`verifyAuthenticatorCode` records the use BEFORE it verifies, so a replayed code is
>   refused; `redeemBackupCode`; `createBackupCodes` through the atomic RPC; `backupCodesLeft`).
> - **"Is this person required, and why":** `twoStepRequirementsFor(user)` (`lib/two-step-requirements.ts`), giving
>   `requiredNow` + reasons (staff, club seats with their grace). The status route `app/api/auth/two-step/status` already
>   returns `requiredNow` / `requiredBy` / `backupCodesLeft`, and only to a session that has passed.
> - **Screens:** the set-up page (`app/(consumer)/auth/two-step`, with `step=codes` = "new backup codes, asked first", and
>   `replace=1`) and the code step `components/auth/TwoStepCodeStep.tsx` (modes code / backup / afterBackup).
> - **The existing "type it again" window** is staff-only: `app/platform-admin/SignInAgain.tsx` with
>   `lib/platform-sign-in-again.ts` (`checkCodeAgain`). Part 2's window is the general one; decide in the census whether
>   staff's becomes a use of it. Don't leave two that drift.
> - **The 15-minute rule today has two homes:** `backup-codes` (`two_step_fresh_code`) and `set-up/start` (`needs_fresh_code`).
>   Part 2 gives them one server helper and one client window.
>
> **Three traps found while building Part 1. Each one, done wrong, turns two-step off for a password-holder:**
> 1. **Checking the current password (Change password).** Do NOT reuse `checkPasswordAgain` as it stands: it signs in on
>    the cookie-writing client, which REPLACES the person's own aal2 session with a new aal1 one, and they land on the code
>    step mid-action. Check on a client that keeps no cookies, then revoke the session that check created. Save through
>    the admin API, as `app/api/auth/two-step/reset-password` does, then sign out the other sessions. Do not rely on, or
>    change, the service's "secure password change" setting (standing rule: no production Auth settings).
> 2. **Set up a new phone while you still hold the old one.** `set-up/start` allows a replace only from a session a backup
>    code let in. Widen it to "any proof in the last 15 minutes". Keep its order exactly: the `two_step_replacing` mark
>    is set FIRST, the old authenticator is deleted after it, and the mark is cleared only at verify. Add a mutant that
>    swaps that order.
> 3. **Turn off.** The server refuses when `twoStepRequirementsFor` says required (staff always), and asks for a proof in
>    the last 15 minutes. It removes every authenticator, deletes the backup codes and clears the replacing mark, in an
>    order where a failure part-way leaves two-step ON. A guard test proves a password-only session cannot reach it.
>
> **Two open owner calls land here; raise them in the UX summary rather than deciding them:** call 4 (one shared client
> handler for a `two_step_*` refusal on an already-open page; Part 1 recommends Part 2 builds it), and call 3 (keyed
> backup-code hashes need a new production secret). A third question belongs in the summary too: does the window take a
> backup code as well as the app's code? (Recommended: yes for everyone; the staff window is call 6.) Call 2 (an email when
> two-step is turned on) stays with Part 4. If turning it OFF should also email the account, that is a Part 4 + `/legal`
> line, so say so here.
>
> **The lost-phone screen is shown to a session that has only the password, which may be a thief's.** Its seat-based
> version says only that a club admin can reset it, never which club and never who. The club-reset version points at
> Part 3's door, which does not exist yet: until Part 3 is committed the chooser returns the support version for everyone
> (one place, which Part 3 changes). Build both; Part 2's walk shows the support version, and the club version is
> walked in Part 3's walk once its door exists.

Build to tab 5 and tab 4, on Part 1's pieces.
- **Account › Sign-in &amp; security**, a new rail row and phone row, in every state drawn:
  - on and required, with "can't be turned off" and the reason;
  - on and not required, with Turn off;
  - off and offered;
  - off and required, with the club's deadline.
- In that section:
  - Set up a new phone;
  - New backup codes, with "N of 10 left";
  - Sign out everywhere else (no device list, ruled);
  - **Change password**: ruled in, because no signed-in person can change it today; it asks for the current password,
    and a code if two-step is on.
- The platform menu's hidden Account row: platform staff need a door to this page.
- **Lost your phone?**, both versions, chosen by the account's seats after the password matched. The support address is
  shown as copyable text.
- **"Ask for a code" on five actions**, if the last code was over 15 minutes ago: changing payout or bank details,
  adding an owner or admin, resetting someone's two-step (Part 3's door uses it), turning your own off, and new backup
  codes. Census where each action lives before wiring it. Recording payments never asks.
- **Walk:** each state, each action asking for a code, change password, and the lost-phone screens.

## Part 3 · Opus — the switches, the grace period, the resets

> **BUILT + COMMITTED `5a22b498a` 2026-11-11** (mig 469 on dev; mig 470 the hourly schedule `d5f9f7f52`, applied to dev); owner walk §515
> https://claude.ai/artifact/SU7aZb1LwgmALGTyCfSf5G; coach door drawn + approved
> https://claude.ai/artifact/EKo6ky1RVPYZzkx7sXyGuA. What was built, the review fixes and four open owner calls:
> `BOARD_READY_PLAN.md` §5 Stage 0a "Part 3 BUILT". **For Part 4:** the grace emails go where `startTwoStepGrace` writes and
> where a switch is turned on; the Members column reads `twoStepFactsFor` (lib/two-step-reset.ts); Help must say an admin opens
> Settings for its two-step card; the /legal policy lines are in `TWO_STEP_SIGNIN_PRIVACY.md` § Part 3.

> **Starts after Part 2 is committed (owner, 2026-11-11).** Turning a switch off and the club's reset ask for the
> owner's or admin's code through **Part 2's one "type your code again" window**: use it, don't build another. The
> lost-phone screen's club version is waiting on your reset door: change Part 2's chooser to show it, and walk it.

Build to tabs 6, 7 and 8.
- **The club's switches** (Organization › Settings › Sign-in):
  - "Require it for the board" and "Also require it for coaches", both off, owner-only (an admin reads them);
  - the owner must have two-step on before turning one on;
  - **turning one off asks for the owner's code and emails the club's other admins and treasurer**;
  - every change is a club audit line.
- **The grace period:** 14 days from the switch, or from accepting a new seat in a club that already requires it.
  - During it: the reminder screen at sign-in, with "Remind me next time (N days left)".
  - After it: setting it up comes first, "Go to my other teams instead" for a person who has somewhere else to go, and
    only the club's admin waits.
- **Reset by the club** (tab 6, Manage window):
  - the door is for the owner and admins, never for yourself or the owner, and only if the person has two-step on;
  - **only when the person's account reaches no other organization.** Otherwise there is no door, and one line with no
    reason given to the club;
  - the question window, then the reset: the factor is removed, the person is signed out everywhere and emailed;
  - the club audit line reads "Kim Patel reset Dana Whitfield's two-step sign-in".
- **A coach's reset (ask A):** coaches aren't managed in Members. **Draw the door first**, in the team staff page's own
  person window, from that shipped page, and get the owner's yes on the drawing. Then build it.
- **Support resets an owner** (tab 7, person record › Account tab):
  - the record window (How did they ask, Why*);
  - a confirmation link to the account's address;
  - on confirm: the email to the other admins and treasurer (no link, no reason given), a 24-hour wait, a hold when an
    admin replies, and a cancel when the owner signs in with the real code;
  - the platform audit line is written first;
  - a sole owner: the record says no club notice was sent, and support phones the owner on a number from the club's
    records before resetting (a support-runbook line, not code).
- **The timed reset** runs from the existing scheduled-job path (secret header, as the other daily jobs do). It is
  idempotent and refuses a held or cancelled reset.
- **Before hand-off: `/legal`** (new emails: the reset notice, the turn-off notice, the owner-reset confirmation and the
  admin notice). Keep any offer out of them (CASL).
- **Walk:**
  - turn a switch on, see the grace screens, and turn it off with a code;
  - reset a member, and see the cross-organization case;
  - an owner reset end to end on dev, with the wait shortened by a dev-only setting.

## Part 4 · Sonnet — what the club sees, and the words

Build to tabs 6 and 8.
- **Members:**
  - the **Two-step** column between Status and Last sign-in (On, "Not set up · N days" amber, "Not set up" amber past the
    deadline, Off, — for invited);
  - the phone row's second line;
  - the Coaching staff rows' "· Two-step off";
  - the export column, owners and admins only;
  - **never on The board tab** (ruled).
- **Overview:**
  - the owner's one-time prompt (closes for good);
  - the "N people still need to set up" reminder for owners and admins, following the Overview's one-notice rule, and
    gone when the last person sets it up.
- **The two grace emails** (when it starts, and 3 days before it ends): no link, with "This email has no link on purpose"
  (`/legal`).
- **`/docs`:**
  - a new "Two-step sign-in" article (for a person, and for a club owner);
  - Members, Account, and the sign-in help.
- **`/marketing`:** one copy pass over every screen and email in Parts 1–4, before the walk.
- **`/legal` follow-through** (the plan's wording):
  - privacy policy §10, plus §3, §5 and §9;
  - finding 5 reworded, not closed;
  - `LEGAL_FACTS.md` "No MFA exists" corrected;
  - `BREACH_PROCEDURE.md` gains "a fraudulent reset";
  - the support note joins L16.
- **Board pack line** (plan §5 0c): "Two-step sign-in is available to everyone, and your club can require it for its
  board and coaches; FieldLogicHQ staff always use it."
- **Walk:** Members with each state, the Overview notices appearing and leaving, both emails, and the help article.
