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
| 2 | Your account: Sign-in &amp; security, change password, lost phone, the "ask for a code" window on five actions | Sonnet | Part 1 committed |
| 3 | The club's switches, the grace period, and every reset (club, coach, support's owner reset) | **Opus** | Part 1 committed (can run beside Part 2) |
| 4 | What the club sees, and the words: Members, Overview, the emails, help, policies | Sonnet | Parts 2 and 3 committed |

**Why these models.**
- *Opus for 1 and 3:* both put a security decision in shared code, where one missed route is a hole:
  - the server check across about 350 routes;
  - a reset that crosses organizations;
  - an identity check with a timed wait;
  - a switch a thief would try to turn off.
- *Sonnet for 2 and 4:* they build screens and words on mechanisms Parts 1 and 3 have already proven.

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

> **BUILT 2026-11-11, commit owed** (migs 463 + 464 applied to dev; walk §511 owed). What was built, the census
> correction (twelve sign-in doors) and six open owner calls: `BOARD_READY_PLAN.md` §5 Stage 0a "Part 1 (the foundation)".
> Parts 2 and 3 can start once Part 1 is committed.

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

## Part 2 · Sonnet — your account

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
