# Signed-in family accounts · Stage 4 · The invitation at team placement (DRAWING session first, build prompt after)

> Written 2026-11-08 (by `/tasks`, on the owner's request). Paste into a **fresh chat on `dev`**:
> `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE4_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is one published drawing (a Claude
> Artifact), the owner's rulings on it, and then a **build prompt** for Stage 4. Recommended model: Opus. Run `/ux` and `/design` before the
> hand-off, and `/legal` before the hand-off too (this stage emails parents about their children and creates accounts for them: see below).
> It touches no code, so it can run beside any build.
>
> Plan of record: [SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md](SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md) (Stage 4, plus the Stage 3b note and the Stage 14 hand-off
> note under it) and its [PM brief](SIGNED_IN_FAMILY_ACCOUNTS_PM_BRIEF.md). Inputs: [SIGNED_IN_FAMILY_CENSUS.md](SIGNED_IN_FAMILY_CENSUS.md) (every door, with
> path:line), the journeys page https://claude.ai/artifact/QmPoKvcyF3Bg1xpjCWw54C ([source](SIGNED_IN_FAMILY_JOURNEYS.html)), the earlier stages' drawings
> ([Stage 3](SIGNED_IN_FAMILY_STAGE3_DRAWINGS.html)) and Club Tier Stage 14's drawings, **tab 7 is this stage's hand-off frame**
> ([CLUB_TIER_STAGE14_DRAWINGS.html](CLUB_TIER_STAGE14_DRAWINGS.html)). Mark each fact **[V]** (you opened it this session, with file:line) or **[H]**
> (handed to you here, unverified). Everything below is [H] unless marked. Branch `dev`; explicit pathspecs; ask before committing; never push.

## Is this stage unblocked? (check first, say the answer at the top of the hand-off)

The plan's Stage 4 header still reads "needs counsel AND Stage 14". Both have moved, and the plan was not updated:

- **Counsel is no longer a gate** (owner, 2026-11-04). The guardian tier (`GUARDIAN_TIER_ENABLED`) stays **off** until the owner switches it on, after real guardian consent wording is written (`/legal` drafts it). This session produces that wording as a draft for the owner.
- **Stage 14 is CLOSED** (owner, 2026-11-06; S1 to S6 built and walked). S6 made a parent's connection **follow the child** (migration 445) and fixed the season-blind link on last season's row. **[V] Open the code and confirm** that is true on dev before drawing on it; the plan's last line ("Stage 4 must not ship on today's link") may now be stale. If a gap remains, the drawing names it and the build prompt carries the fix.

Update the plan's Stage 4 header and "Blocked by" line to say so (that is a plan edit, not product code).

## What the stage is (rulings already made; do not re-ask them)

- **An account comes when the child is placed on a team**, never at sign-up (owner 2026-10-31). The placement email **is** the invitation: never a separate "create an account" email. Accepting signs the parent in (new or existing account) and links them to the **child**.
- **A parent account is a person, not an organization member** (10-29 P3, ruled yes 2026-11-04). It is kept clear of the one-home-organization rules.
- **What a parent sees follows the child's live seasons** (Stage 14 Ask 13). The link points at the child record, not a season's row.
- **No new no-login family doors.** The "Your sign-up" pay link and the unsubscribe link stay; nothing else is sent as a link. **RSVP by emailed link is out**: In / Out / Maybe happens in the app. A calendar feed is fine **only if minted inside the signed-in app** (revocable). The family calendar link drawn in 9d-3 was withdrawn.
- **The parent's app holds** the team's schedule (practices included), team chat, In / Out / Maybe, and the calendar feed. **"Your sign-up" also shows inside the app** (the same page, so a grandparent paying from email and a parent in the app see one thing).
- **A stopped address is never invited** (Stage 3b): the invitation must check `second_parent_stops` (`lib/league-second-parent-stop.ts`) or every copy of the address must be cleared by the stop; an address typed into any new invitation path is refused with `SECOND_PARENT_WORDS.stoppedAddress`; the invitation carries its own Stop line like every second-parent copy. The second guardian gets the invitation too, with the Stage 3 rule that household emails reach a second parent only when their address is on every sign-up named.
- **Not decided, and not yours to decide:** native app vs installed web app, and what the app shares with the public site. Record them as open; draw the screens so they hold either way. (A 2026-07-28 decision killed native; the 2026-10-29 direction said "mobile app". Read both in `BUSINESS_DECISIONS.md` and say plainly how they sit together.)
- Stage 5 (next season pre-filled for a signed-in parent) is **not** in this session.

## What to draw (the questions to settle)

1. **The invitation** a parent receives at placement: the email (it is also the placement notice), what the accept page says, new account vs existing account (same email already a coach, an admin, or a parent of another child), and the failure cases (expired link, wrong email, an address that already has a different person's account, a child placed on two teams).
2. **The parent's first screen** after accepting, on a phone first: the child's team, the next practice or game, In / Out / Maybe, chat, the sign-up/pay page. One child and **three siblings on two teams** (a sibling set is the common case, and the Stage 1 finding was that one link opens every sibling on the sign-up).
3. **"Your sign-up" inside the app** and the way back from the emailed pay link to the app without making the emailed link the account.
4. **The two-guardian household:** second parent invited at the same moment; one removes the other's access? what does each see? A stop; a guardian who is not a parent (a grandparent who pays).
5. **Calendar feed** minted in the app: where the button lives, the revoke, what the feed shows when the child's season closes (Stage 14 S6 already made a closed season's feed an empty feed).
6. **What the coach and the club see** of this: does a coach see who accepted? does the club's Families page show "invited / signed in"? the resend. Read the existing 3b "Stopped" line and the registrar's Families views before drawing so nothing duplicates.
7. **What a parent does when the child is withdrawn, moved to another team, or the season rolls** (the link follows the child: draw the three outcomes in one sentence each).
8. **The consent and privacy words** the first screen needs (children's information, who sees what, what the coach sees). `/legal` drafts; you place them on the screens.

## Disagree out loud (settle these in the drawing, with a recommendation each)

- **"The placement email is the invitation" vs the second-parent rule vs CASL.** Say which email counts as transactional and which is marketing, and whether the first parent's address being unverified at sign-up (the Stage 3 HIGH finding) lets a stranger be invited into another family's child. Read `docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md` (its five open flags) and fold what applies; do not decide the flags, list them for the owner.
- **Is this the first screen of a parent app or a small page?** Draw the smallest thing that satisfies the rulings; say what you left out for the app decision.
- **House league vs rep.** Placement means different things (a draft, a coach's roster). Draw both entry points or say why one covers both; the coach portal's roster and the club's Families book are different people's screens.
- **Do not widen to the coach portal or the club admin by accident.** Read the shared components before promising either.
- **Five open owner flags from Stage 3b and the older proposals P1 to P6** (signed-in app questions) sit around this stage. List which ones this drawing needs answered first and which can wait; do not fold unrelated asks in.

## Steps

1. **Read** the plan (Stages 1 to 4 and 14's hand-off), the census §4 and the guardian-link rows, `BUSINESS_DECISIONS.md` for 2026-10-29, 2026-10-31, 2026-11-04 and 2026-07-28, `CLUB_TIER_STAGE14_DRAWINGS.html` tab 7, and the code for the guardian tier (search `GUARDIAN_TIER_ENABLED`) and the child record.
2. **Settle the facts from the code** (the answer to "is it unblocked" above, how a guardian link is stored and moved, what the placement email is today and who sends it, what already exists for a parent's login, chat, availability and feeds).
3. **Draw** (Claude Artifact, not the design canvas; house layout: sticky numbered tabs, minimal scroll, an *Everything / Show only what differs* toggle; whole-screen before/after at true size; controls drawn from their shipped components; NEW / RESTYLED / UNCHANGED tags; every highlight clickable). Phone first, then the desktop where it differs. Email drawn at the width a phone mail app shows.
4. **Asks** for the owner, each with a recommendation and the alternative, numbered; **put the ones that change the shape of the stage first** (as Stage 3's drawings did).
5. **Run `/ux`, `/design` and `/legal`**, and apply what they find before publishing; say in the hand-off what each changed. A copy or privacy gap you cannot fix is an owner question, not softer wording.
6. **Publish** the Artifact once. Do not edit product code.
7. **Hand off in product-owner voice**: what a parent sees and does differently, what a coach and a registrar see, the asks, and the order (Stage 4 build, then Stage 5). Record it in the plan (one status entry with the Artifact link, the corrected "Blocked by"), the TODO line for this project and the auto-memory note for it.

## After the owner rules

Write the **Stage 4 build prompt** (`SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md`), in sessions, with: the migration (if any) and the production-apply order, the guards (the stopped-address guard, no send path that reads a stop, no invitation to an address on a sign-up it is not on), the `GUARDIAN_TIER_ENABLED` switch stays off, help articles (`/docs`), a QA walk (its own Owner QA Ledger section), the `COACH_AVAILABILITY_RSVP_PLAN.md` rewrite to the app channel (plan item 4), and `/legal` and `/marketing` before hand-off.

## Do not

- Build or edit product code, or switch the guardian tier on.
- Propose a family-facing door that works without a sign-in (secret links, emailed RSVP, a no-login team page) other than the pay link and unsubscribe.
- Decide native vs installed web app, or re-ask a ruled question (account at placement, parent = a person, the link follows the child).
- Record the owner's answers as anything but what they said.
