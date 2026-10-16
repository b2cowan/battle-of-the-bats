# Free coach header — the phone — design prompt

> Paste into a fresh session on `dev`. Written 2026-10-15. **This session draws and settles rulings. It does not
> build.**
>
> **Where it comes from.** The owner's 2026-10-13 ruling (*"the account dropdown and notifications bell should be the
> same for free tier coaches"*) was split: **desktop now, phone next.** The ruling said the phone *"gets its own drawing
> once this is ruled"*, because *"it means choosing which bottom bar a free coach uses"*. The desktop half is committed
> (`ad0267e4`, 2026-10-15).
>
> **Why now:** the bell that shipped shows only on a computer. A free coach on a phone (where coaches are at the field)
> gets notices they cannot see until they sit down at a computer; the help article says exactly that. The phone is the
> larger half of the bell's value.

## What this session produces, in order

1. **The plan section and the brief.** Add §9 "The phone" to `FREE_COACH_HEADER_PARITY_PLAN.md` and update its PM
   brief, written as *proposed* before you draw; record each ruling in both as it lands.
2. **The drawings, on the ONE hub** (https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y), as a new "Phone" stage:
   - whole screens, before and after, at true phone size, in Warm and Dark;
   - real captures of today first;
   - clickable NEW / RESTYLED / UNCHANGED tags and red flags;
   - an ask with options gets its options side by side.
3. **The asks.** Each one gets one checkbox per option, a recommendation, the reason, and a paste-back key (for example
   `fchp-phone-asks-v1`).
4. **`/design` on the drawings before the hand-off.** Owner, 2026-10-10: run it, don't offer it.
5. **When ruled:**
   - a build prompt (`FREE_COACH_HEADER_PARITY_PHONE_BUILD_PROMPT.md`);
   - the design log entry (`memory/design_decisions.md`);
   - a `/strategy` entry (see below);
   - the TODO line.

## ⚠ The question under the question: this is a positioning decision, not only a layout

The free portal's phone bar (Home · Scores · Chat · Account) was a deliberate choice. It comes from the **2026-07-25
Business Decisions Log entry "Two-family experience model"**:
- The free portal joined the **consumer** family as a *"tournament companion"*: the fan app's own bar, with Scores and
  Chat one tap away on game weekends, and the portal *"a lens over the tournament the coach signed up for"*.
- Premium stayed in the **operator** family (*"team operations HQ"*).
- The entry says outright that *"the shell difference IS the value ladder"*.

**The 2026-10-13 ruling already moved the free portal's computer top bar to the operator strip.** That change was
recorded in the design log and the plan, but **not in the Business Decisions Log** (checked 2026-10-15: no entry
amends 2026-07-25). Swapping the phone bar too would finish reversing a logged business decision. So:
- Draw the options that **keep** the consumer bar as seriously as the option that swaps it.
- Never ask the owner "which bar?" on its own. Put the trade in the ask: on one side, the companion's Home and Scores
  and the 2026-07-25 value ladder; on the other, one control in one place for a coach who holds a free team and a paid
  team at once (the 10-13 reason).
- Whatever is ruled, **offer `/strategy` to amend the 2026-07-25 entry**. It is owed for the computer half regardless.
- If the drawings show the phone should be something other than what this prompt lists, **say so before drawing more**
  (`feedback_push_back_by_default`).

## The facts (verified in code 2026-10-15 — re-verify before drawing; plans in this repo have been wrong)

- **The free portal at 900px and below today:**
  - **Top:** the free portal's sticky team/event header (the team, the tournament identity and its lifecycle pill, the
    Flip), with a scrolling section tab row under it (Overview · Tournaments · activated sections · Explore).
  - **Bottom:** the global consumer bar Home · Scores · Chat · Account (`ConsumerNav variant="coach"`; Home is
    `/discover`).
  - **The paid strip** (`CoachTopStrip free`) is hidden at this width.
  - **No bell, no notifications page:** a free coach has neither on a phone.
  - **Account utilities** (sign out, feedback, help, workspaces) are on the Account tab (A2.1, 2026-07-25).
  - **Chat** on a phone is the consumer Chat tab, not the in-portal chat the computer now has (A1, 2026-10-13, was
    ruled for the computer only).
- **The paid portal at 900px and below:**
  - **Bottom bar:** Overview · Schedule · Chat · Roster · More (`CoachesBottomNav`).
  - **The bell's count rides on More.** The feed is a **Notifications row in the More sheet**, which opens
    `/{org}/coaches/notifications` (`CoachNotificationsPage`, built as "the mobile home for a feed that had no phone door
    at all").
  - The strip is hidden at this width.
- **The free bell's data is already built.** The scope is `team-coach` (`lib/notification-bell-scope.ts`), and the API,
  the unread hook and the feed all take that scope. A phone surface is screens only, unless a ruling adds storage.
- **Account → Notifications** has a **Pause** card that already governs the free bell, and **no per-kind card** for a
  free coach. That card (build Part 4) was **deferred to this step**:
  - it was never drawn;
  - storing its switches needs a **migration** (one account-level column on `user_notification_settings` was the build
    prompt's B2 recommendation).
- **A7 (ruled 2026-10-13):** "the rest of the computer frame (rail width, the team header) — leave it; look again with
  the phone step."
- **What the bell carries, its words, and Needs attention / Done:** plan §8, and the help entry "What shows up in my
  notification bell?" in `lib/help-content/coaches.tsx`.

## The asks to draw (a starting list — the session may find others; it decides none of them)

- **P1 · Where the bell lives on a phone.** Draw at least:
  - (a) in the free portal's own team header, top right, beside the Flip;
  - (b) the unread count on the **Account** tab, with a Notifications row at the top of the Account page. This is the
    free twin of the paid portal's "count on More, row in the sheet": the same structure, and the bar does not change;
  - (c) the paid bottom bar, with the bell inside More.

  Draw each in place, with the count showing.
- **P2 · Which bottom bar a free coach uses:** (a) keep the consumer bar, or (b) take the paid bar. Put the
  positioning trade above in the ask itself. If P1 is ruled (c), P2 follows from it; ask them in the order that makes
  that clear.
- **P3 · Where the free coach's notification feed opens on a phone.** A page (like the paid one) or a sheet; where it
  lives; what Back does; how Needs attention and Done look at phone width.
- **P4 · The per-kind switches card** (deferred Part 4). Draw it on Account → Notifications, or recommend ruling it
  out. The ask must say it costs a migration, and that Pause already silences the bell.
- **P5 · A7 revisited:** the computer's rail width and team header, now that the phone is drawn. "Leave it" is a
  legitimate recommendation.
- **P6 · Chat on a phone:** inside the portal (as on the computer since 10-13) or the consumer Chat tab (as today)?
  This follows partly from P2.

**Surface, but do not ask by default:** whether a free coach's bell notices should also arrive as **push** on a phone.
Today they are bell-only by design (never through `notify()`, so the coach is not emailed twice). Push is how a phone
gets attention, so the owner may raise it. If they do, it is its own ask with its own costs.

## Read first

- **The hub:** every screen on the computer stage, the Decisions tab, and the QA tab (§311, closed by the owner
  2026-10-14; leave it as it is).
- **Plan** `FREE_COACH_HEADER_PARITY_PLAN.md`: §1 (rulings), §4 (the bell's facts), §8 (what was built and every
  deviation). The PM brief. `FREE_COACH_HEADER_PARITY_BUILD_PROMPT.md` (Part 4 and B2).
- **`FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` Phase A2:** the phone half that still stands. Its approved A2 mockups
  (artifact `claude.ai/code/artifact/ae44a341-2417-44f6-b743-4501a59c63a0`, round 4: seven mobile screens) are the
  current phone spec you are drawing against.
- **`docs/agents/strategy/BUSINESS_DECISIONS.md`**, the 2026-07-25 two-family entry. **`memory/design_decisions.md`**,
  the 2026-10-13 and 2026-07-25 entries.
- **Code:**
  - `components/coaches/CoachPortalShell.tsx` (+ `.module.css`): the phone header and the tab row;
  - `components/consumer/ConsumerNav.tsx`: the coach variant;
  - `components/coaches/CoachesBottomNav.tsx`: the paid phone bar, the More sheet and its Notifications row;
  - `components/coaches/CoachNotificationsPage.tsx` and `app/[orgSlug]/coaches/notifications/page.tsx`;
  - `components/notifications/NotificationDrawer.tsx` and `useNotificationFeed.ts`;
  - `lib/notification-bell-scope.ts`;
  - `app/(consumer)/account/page.tsx` and `app/(consumer)/account/notifications/*`.
- **Memory:** `project_free_coach_header_parity`, `feedback_mockups_as_claude_artifacts`,
  `feedback_always_run_design_on_mockups`, `feedback_project_hub_single_artifact`, `feedback_clickable_design_annotations`,
  `feedback_portal_is_the_formatting_benchmark`, `decision_drawer_layers_form_vs_menu`, `project_coach_account_menu`,
  `project_coach_notifications_review`, `feedback_qa_walkthroughs_as_checkable_artifacts` (one checkbox per option),
  `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`.

## How to draw

- **Capture today first, on dev, in the FCHP world.** Use `fchp-coach-a@dev.local` / `devpass123`; "reset FCHP"
  rebuilds the world with `.probe/fchp-build/seed-fixture.mjs`. Avery has a few bell notices to show. Also capture the
  paid portal on a phone with the More sheet open on its Notifications row. Note that the uat-test-org coach hits a
  billing wall, so use `rep-club-coach` / `uat-rep-club` (memory). Ask whether another session is using the browser
  before you start.
- **Phone frames** at the true size earlier phone drawings in this repo used (check the coach phone-stage hubs), in Warm
  and Dark.
- **Hub mechanics:**
  - edit `.probe/fchp/hub.src.html`, `build.cjs` and `qa-data.cjs`, then run `node .probe/fchp/build.cjs`, which writes
    `docs/projects/active/FREE_COACH_HEADER_PARITY_HUB.html`. Never edit the built file;
  - parse the inline script before every publish, and keep the tab navigation in its own script;
  - republish to the same URL. The live copy was v9 on 2026-10-15; read it first and check its header for "counts as
    viewed".
- **An ask whose ruling needs a migration says so in the ask.**

## Not this session

- Building anything.
- The "registered / waitlisted" notice. It has its own build prompt (`FREE_COACH_HEADER_PARITY_REGISTERED_BUILD_PROMPT.md`)
  and may run beside this session; it touches no phone screen.
- Premium coaches receiving host-club notices in their paid bell: an unruled follow-up.
- Changing the paid portal's phone bar.

## Git

`dev` only, with explicit pathspecs. The drawings live under `.probe/` (not committed) and in the built hub file, which
is committed with the plan and brief. **Commit only when the owner says.**
