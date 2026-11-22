# Prompt — Board Ready Stage 2 · Group email to coaches and volunteers (drawing session)

> One session, pasted into a fresh chat (`/clear` first): `execute @docs/projects/active/BOARD_READY_STAGE2_GROUP_EMAIL_DRAWING_PROMPT.md`.
> Written 2026-11-16 on the owner's request. **Drawings and asks only, no code.** The build prompt is written after the owner
> rules on these drawings. Plan of record: `docs/projects/active/BOARD_READY_PLAN.md` (§1 item 3 at L32; the "live groups"
> widening at L76–78; the two-mail-paths ruling at L53; §5 Stage 2 at ~L685–694; the ladder row 7 at ~L815). Index:
> `BOARD_READY_PROMPTS_INDEX.md` (it has no Stage 2 row yet). Recommended model: Opus. It touches no code, so it can run
> beside any build, including the Club Stage 13e drawing.
>
> The facts below were gathered by a helper on 2026-11-16 and spot-checked by the writer (plan L32, L53, L76–78, L104–105,
> roadmap L276, the colleague-mail header in `lib/families-email-coaches.ts`). **Everything else is a lead, not evidence.**
> Mark each fact **[V]** (you opened it this session, with file:line) or **[H]** (handed to you here).

## The ask (board feedback 2026-11-10, plan L32)
"Email distributions to coaches: all rep coaches, all coaches, all house-league coaches."

The plan widened it (L76–78, a planning call, **not** an owner ruling): **live groups, not lists someone keeps up.** A
hand-kept "all house-league coaches" list is wrong the day a coach is added. Groups are computed from who holds the role
this season; saved custom lists exist only for the odd one-off.

## Why it is time-sensitive
Roadmap ask 11, ruled 2026-11-16 (`docs/agents/strategy/PRODUCT_ROADMAP.md:276`): **"Group email to coaches" stays
Committed for 2026 only if it is built before the roadmap is first shown; otherwise it moves to Q1.** The board's version
of the roadmap calls it "Group email to your coaches". Keep the drawing small enough to build in one or two sessions.
Anything that would push it past that goes on a later list, said out loud.

## Rulings that bind
- **Two mail paths, never mixed** (plan L53): colleague mail vs family mail. This is colleague mail: house mail, replies
  to the sender, **no family footer, no unsubscribe**, sent a few at a time. The pattern already exists. Read the header
  of `lib/families-email-coaches.ts` (L11–21) and `lib/families-coach-ask.ts` (~L132–136). Its guards are
  `tests/unit/family-email-guard.test.ts` and `tests/unit/families-email.test.ts`.
- **CASL** (`docs/agents/legal/CASL_MEMBER_INVITE_EMAILS.md` L14–22): mail to a named person in their role is not a
  commercial message **only if** it carries no plan name, no price, no "try FieldLogicHQ for your own club" line and no
  link to pricing or sign-up. L4 makes "going to people with no role" a re-check trigger. That matters for Stage 3's
  hand-added helpers.
- **Board tab ruling R1** (plan L54): People is not public; the board tab keeps names and roles only.
- **Stage 3 only adds groups** (plan L104–105, L689, L711–712). Board · Volunteers · "Needs a new {document}" arrive later
  and must slot into the same group list without rewiring it. Some of those people will have **no account**. Draw the
  group list so a later group is just another row.
- **The third access sweep is the prerequisite, and it is done** (`BOARD_READY_ACCESS_SWEEP_3.md`). The recipient picker
  respects its seat table (~L353–373; e.g. a treasurer sees "no contact details"). Two contact-read findings are still
  open (~L171–174: staff read recipients on the Communication screen; submitter emails in the score feed). Don't draw
  over either, and say if Stage 2 would widen them.

## No ruling exists for any of these, so they are your asks
Q1–Q9 in the plan cover other stages. **Who may send, which groups, saved lists, history and the Send recount are all
unruled.** Draw a recommendation for each and put it to the owner.

## What exists today (verify each)
- **No coach-group composer exists anywhere.** Coaches are reached only as side effects: copies on family sends, Ask
  the coaches, the schedule send. The nearest "all coaches" send is a **tournament announcement** (tournament admin portal).
  The tournament chat's "All coaches" room is chat, not email. Say plainly whether this new send replaces, sits beside
  or ignores the tournament announcement for a club that runs a tournament.
- **The one club send window parts** (`components/admin/kit/club/SendParts.tsx`): rows, doors, the mail preview, the
  sample, the who-list and the form/email/who levels. They are used by Email families, Message this family, Ask the
  coaches, the email log, the schedule send, reminders and the house league's send windows. **Draw from these shipped
  parts. No new window shape.**
- **Sent history:** the Families › Emails tab (`components/admin/kit/club/families/EmailsTab.tsx`, `EmailLog.tsx`,
  `lib/families-emails-log.ts`) and the season version (`league/email/SeasonEmailsScreen.tsx`).
- **Who can send club email today has no single rule:**
  - family sends need the Families grant (`lib/families-auth.ts`, `lib/roles.ts` ~L59);
  - house-league season email is the owner, an admin, the league admin or the registrar (`lib/house-league-access.ts`);
  - the schedule send is the owner or an admin (`lib/club-schedule-gate.ts`);
  - tournament announcements need their own permissions;
  - coaches hold none.

## Read first
1. The plan sections above, the PM brief, and the third sweep's findings table and seat table.
2. The code you'll draw over: `SendParts.tsx` and one of its users end to end (`families/EmailFamiliesWindow.tsx`), the
   colleague-mail path, and the Emails tab. Find **where a club owner would look for "email my coaches"**: the
   Organization hub, the people/coaches lists, the house-league season, a rep team, the sidebar. Recommend one home and
   say why. Follow `docs/agents/design/NAV_STANDARD.md`.
3. How each live group is computed from data that already exists: rep coaches (head, and all staff), house-league
   coaches this season (and by division), coaches in one club tournament, and "all coaches" as the de-duplicated union.
   Say what a coach with no email, an invited coach not yet signed in, and one person on three teams each do.
4. Memory, before drawing:
   - `feedback_mockups_as_claude_artifacts.md` (HTML Artifact, the house layout, before/after, true size);
   - `feedback_draw_controls_from_shipped_component.md` and `feedback_portal_is_the_formatting_benchmark.md`;
   - `feedback_always_run_design_on_mockups.md`;
   - the UI conventions index in `reference_memory_index_settled.md`.

## Draw (desktop and phone; a club owner writes from a phone)
1. **The door.** Where "Email coaches" lives, before and after, and what someone who may not send sees: nothing, never
   a dead button.
2. **Pick a group.** All coaches · Rep coaches (head coaches / all staff) · House-league coaches (this season, or one
   division) · Tournament coaches (one tournament). Each shows its **live count**. Show the "Stage 3 adds…" room without
   drawing Stage 3.
3. **The composer** on the shipped send parts: subject, message, the sample as a coach receives it (replies come to the
   sender; no family footer), and the who-list with the people left out and why (no email, the sender themselves).
4. **The recount at Send.** The group changed since the window opened: what the sender is told, and what happens.
5. **Saved custom lists** (pick people), kept small on purpose. Draw the smallest version that earns its place, or
   recommend leaving it out of this build to protect the roadmap date. Say which.
6. **Sent history** beside the Families › Emails tab or inside it: who sent, to which group, how many, when, and the
   recipients.
7. **Phone (390)** for the composer, the group pick and the history, with the bottom bar and the More sheet.
8. Use real counts from a seeded club (a fresh Harbourtown copy, `.probe/nav-journeys/seed.mjs`, a new slug). Remove the
   copy at the end. Never seed or reset the Milton demo world from here.

## Asks to put to the owner (recommend each; numbered for a short paste-back)
- **Who may send?** Recommend from the code. Owner and admin certainly. The league admin, but to house-league coaches only?
  The registrar? A seat with no contact access must never see addresses.
- **Groups in this build:** the four above, or fewer to hold the roadmap date?
- **Saved custom lists:** in, smallest form, or deferred?
- **Does a coach's assistant/staff count as a "coach"** in All coaches, or head coaches only by default?
- **Tournament announcements:** replace, keep beside, or leave alone?
- **The history's home:** one Emails tab for families and colleagues (two kinds), or its own list?
- Anything the drawing needs that the plan doesn't cover. Draw it and ask; never assume.

## Before hand-off
- `/ux`, then `/design`, applied before publishing; say what each changed.
- **`/legal`** (CLAUDE.md: a new email the platform sends). The points:
  - colleague group mail under CASL, including the no-plan/price/offer rule and a build guard that fails on one;
  - the sender's address exposed to every recipient;
  - Stage 3's account-less recipients.
- Publish the Artifact once. Put its link and the asks in `BOARD_READY_PLAN.md` §5 Stage 2 and update ladder row 7.
  Add a Stage 2 row to `BOARD_READY_PROMPTS_INDEX.md`. The plan and index are being edited by another Board Ready
  session: re-read them right before editing and change only your rows.
- Hand the owner a product-owner summary: what the owner, an admin and the league admin each see, how it feels on a
  phone, the asks, and whether the drawing still fits a build before the roadmap is first shown.

## After the owner rules
Write `BOARD_READY_STAGE2_GROUP_EMAIL_BUILD_PROMPT.md`, covering:
- the screens and the live-group queries;
- the colleague-mail sender (never the family envelope);
- the guards (the family-email manifest stays green; a CASL guard; a seat-table guard on who sees addresses);
- the help articles and demo-tour anchors;
- the `/legal` sign-off;
- one QA walk with its own Owner QA Ledger section.

## Standing rules
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index
  (memory `reference_partial_commit_shared_tree.md`).
- No code, no migrations in this session.
- Record the owner's answers as exactly what they said, nothing added.
