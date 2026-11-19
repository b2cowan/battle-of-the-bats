# Board Ready — trust close-out build prompts (written 2026-11-18)

The owner ruled the trust close-out's 22 calls "all as recommended" on 2026-11-18 (rulings: header of `BOARD_READY_ACCESS_SWEEP_3.md`).
Nothing below was built when this was written.

## HOW TO RUN THIS QUEUE

**The owner pastes ONE line into a fresh chat, every time, and nothing else:**

> Run the Board Ready trust-fix queue: read `docs/projects/active/BOARD_READY_TRUST_FIX_PROMPTS.md` and follow its CONDUCTOR section exactly.

## PROGRESS (the conductor updates this table; it is the only memory between chats)

| Order | Prompt | Items | Kind | Status |
|---|---|---|---|---|
| 1 | P1 Access fixes 1–11 | calls 1–11 | build | DONE 2026-11-18 49c4c9934 (1), f781d0f0d (2+9), 2137f6f12 (3), 140eed5a1 (4), 9ec647290 (5), 5258fae20 (6), 517f30e36 (7), a3670460b (8, mig 500: on production the migration goes first, then the code), 643c2dd05 (10), 238bc70d3 (11), records 0dc863151. Built in its own chat (row marked by the P2 chat); owner walk §539 owed |
| 2 | P4 Refuse a second caller for the same job and minute | call 21 | build (before the first live club) | DONE 2026-11-18 c0b346a9e (mig 502, the scheduler side) + the commit "Board Ready trust close-out 21, the site side…" (the owner chose option B, a one-use receipt, over the ruled once-a-minute cap: a restored copy is refused in any minute). Proved on dev 15/15 (`.probe/cron-receipt-prove.mjs`); /simplify + /review applied (refusals email once per issue). PRODUCTION: mig 502 FIRST, then the code. After the promote, check that receipts get stamped used and that no "A scheduled call was refused" issue opens |
| 3 | P2 Existing account gets an invitation | call 13 | build (medium) | DONE 2026-11-18, the commit "Board Ready trust close-out 13: an existing account is invited…" (run ahead of P4 on the owner's word; proved on dev 34/34; owner walk §540 passed 24/24 2026-11-18; reviewed; /legal + /docs applied). Its coach-to-board branch is row 3b; its two open calls were ruled "as recommended" the same day and are rows 3c and 3d |
| 3b | P2b A club's own coach given a board role accepts it too | call 13, owner ruling 2026-11-18 | build (small schema change) | DONE 2026-11-18, the commit "Board Ready trust close-out 13, the last branch: a club's own coach given a board role accepts it too…" (mig 503: on production the migration goes FIRST, then the code). Proved on dev 30/30 (`.probe/coach-board-invite-prove.mjs`); /simplify, /review (4 lenses, fixes applied), /legal (no change, record updated) and /docs (org help) done. Owner browser walk owed. Left as notes: while the role waits the person shows on the board, not under Coaching staff; club/league creation's pending-invitation checks don't see a waiting board role |
| 3c | P2c An unaccepted invitation runs out | call 13 open call (b), owner ruling 2026-11-18 | build | DONE 2026-11-18 c67c20035 (the run-out rule and the removal) + c252216ea (the nightly schedule, mig 504, on the owner's go in this chat; applied to dev, job id 21) (read at use, no schema change; proved on dev 32/32, `.probe/invitation-lapse-prove.mjs`; /simplify, /review (4 lenses, 6 fixes incl. a seat check when Resend revives one), /docs (org help) and /legal (draft privacy §9 bullet held until the removal runs on production) done). The nightly REMOVAL (60 days after the last send) is built, proved by hand, and scheduled on dev. Production order: mig 502 and 503 first (as before), then the code, then 504. Owner browser walk owed |
| 3d | P2d The database's member test counts only active members | call 13 open call (c), owner ruling 2026-11-18 | build (one migration) | DONE 2026-11-18, the commit "Board Ready trust close-out 13 (c): the database's member test counts only active members…" (mig 505, function bodies only, applied to dev; production either side of the promote, no code depends on it). Census wider than the finding: a pending or suspended person could also WRITE a tournament's venue facilities and facility lanes, closed by the same change. Proved on dev before (all four in) and after 21/21 (`.probe/member-test-active-only-prove.mjs`); /review (4 lenses, no defect; 2 record wording fixes applied). No screen changes, so no /docs and no browser walk. Reported, not fixed: any ACTIVE member of any role can still write those two tables from their own browser (owner call) |
| 4 | P3 Lock rules, files and links on a completed event | call 14 | build | DONE 2026-11-18, the commit "Board Ready trust close-out 14: a completed tournament's rules, links and files lock with it…" (no schema change, so nothing to order on production; it goes with the next promote). The three routes take the existing shared guard (scope + club + not completed, the schedule routes' own words); the Rules screen reads the tournaments' lock (banner, no add/samples/handles, read-only records, a locked empty line). Reopen exists and lifts it; a SEALED event never reopens, so its rules page is fixed for good (as its results are). Copy, delete and the club purge are untouched. Proved on dev 26/26 (`.probe/completed-event-lock-prove.mjs`); /review (3 lenses: 1 fix applied, 1 test tightened, 1 noted); /docs (Tournaments help: lock + reopen answers, the Rules article, and the copy answers now say the Rules page's files come along). Owner browser walk owed |
| 5 | P5 "Send a new link" button for a team's pay link | call 12 | drawing session only | not started |

Status values: `not started` · `in progress (what is done, what is left)` · `DONE <date> <commit hashes>` · `BLOCKED <why>`.
Why this order: P1 is small and in one area; P4 must land before the first live club; P2 and P3 are independent builds; P5 is a
drawing, so it goes last and its build is a later session after the owner rules its asks.

## CONDUCTOR (the chat that was just pasted the launcher line follows this, and only this)

You are the conductor of a queue of build prompts. You run ONE prompt per chat, then hand back.

1. **Find your prompt.** Read the PROGRESS table. Take the first row, in Order, whose Status is not `DONE`. If it says `in progress`,
   resume from what the note says is left (re-read the code and `git log` first; the note can be stale). If it says `BLOCKED`, tell
   the owner why and stop. If every row is `DONE`, run the END OF QUEUE checklist instead.
2. **Say which prompt you are running and why**, in two lines. Mark its row `in progress` in the table now.
3. **Run that prompt's block** (the fenced text under its heading) exactly as written, including its own rules. This file's
   rules never loosen a prompt's rules. Do broad reading through helper agents as the repo's CLAUDE.md says. Present the
   Implementation Plan and the plain-language UX summary first, then continue without waiting, unless one of the STOPS below applies.
4. **Run the agents the prompt recommends, in this order, and say so as you go:** `/simplify` (only if you added a new shared
   helper or pattern), then `/review` (any substantive code change), then `/docs` (a user-facing flow or who-sees-what changed),
   then `/legal` (anything about what is collected, emailed or agreed to; P2 always), then `/accounting` (anything that changes
   what is charged, invoiced or reported; none of these five should). Apply what they find or record it as an owner question.
5. **Verify** as the prompt says (`verify:changed`, `typecheck` when shared modules or auth are touched). Report anything skipped.
6. **Close out.** Ask the owner ONCE for confirmation to commit, listing the exact files (explicit pathspecs, branch `dev`, never
   `git add -A`). Do not commit without that yes. After the commit, `git show --stat HEAD` and confirm only your files landed.
7. **Update this file's PROGRESS row** to `DONE <date> <commit hashes>` (or `in progress (…)` if you stopped early), and move the
   board line in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` and the sweep report's status lines as the prompt says.
8. **End the chat's work with a handoff message in product-owner voice:**
   - what the owner now sees differently, in a few lines, and what to click to check it (the walk list);
   - anything owed that only the owner can do (a production step, a ruling, a browser walk), each as one line;
   - **"Clear this chat now."** Then name the NEXT prompt in the queue and what it will do. Tell the owner to paste the same
     launcher line into the fresh chat. Do NOT paste the next prompt's block into this chat and do NOT start it.

**STOPS: end your turn and tell the owner, instead of pushing on, when:**
- a prompt's premise is wrong or already fixed, and the fix would change shape or scope (say what you found, what you recommend);
- an owner decision is needed that the prompt does not already answer (P4's design confirmation; any ruling a prompt says to ask for);
- a step needs production access or touches `.claude` settings, hooks, or the database checks: do not do it;
- a check fails and you cannot fix it inside the prompt's scope: say so with the output;
- the context has grown heavy before the prompt is done. Stop at a clean commit boundary (never mid-edit), mark the row
  `in progress` with exactly what is done and what is left, and tell the owner to clear and paste the launcher line again. P1 has
  eleven items; splitting it into two chats at a commit boundary is expected, not a failure.

**Never** run two prompts in one chat. **Never** build P5's button (its prompt is a drawing session). **Never** commit, push, or
touch production without the owner's yes in that chat.

## END OF QUEUE checklist (only when every row is DONE except P5's build)

Tell the owner, one line each: (a) P5's drawing is published and his asks are owed, and after he pastes them back the button's
build prompt is a new one (offer to write it); (b) the order to apply the migrations on production, collected from each
prompt's hand-off (note: mig 467 is dev-only and goes before its code); (c) the public roadmap's access-review line may change to
"a full access review of who can see what, every finding resolved" only once these fixes are live (call 22); (d) the sweep report's
status lines and the board lines are current; (e) the by-hand restore step stays in the checklist even after P4.

---

## P1 — Access fixes 1–11

```
Board Ready — trust close-out fixes 1–11 (build). Owner ruled all eleven "as recommended" on 2026-11-18.

READ FIRST (in this order)
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md — the RULED 2026-11-18 block at the top is your scope. Items 1–11 only. Each item's finding lives lower in that report; read the finding before touching code.
2. docs/projects/active/BOARD_READY_TRUST_CLOSE_CHECKLIST.html, Part A (CALLS array, ids 1–11) — the owner-facing wording of each item and the option he chose (always the first option).
3. docs/projects/active/BOARD_READY_PLAN.md §5 Stage 0a, and docs/projects/active/BOARD_READY_PROMPTS_INDEX.md (how Fixes A–E were done: one commit each, a probe, a prove script).
Out of scope: items 12, 13, 14, 21, anything about the pay-link button, existing-account invitations, completed-event locks, or the scheduled-job guard. Do not start them.

THE ELEVEN (the chosen option)
1. Demo "See it live" account is refused outright at all three create doors (coach team, club, league), not only by the one-club rule that lets a request through when its own check fails. Add a build check that keeps it so.
2. Permits and the venue library are read only by people who schedule, run tournaments or handle money. Scorekeepers and staff lose the read. Gate every door that renders its absence (a gated read with a still-linked screen is a dead end).
3. "Same player" Confirm on the returning-player card shows only to a coach who can see roster details; others don't see the button. Enforce it on the server route too, not only in the UI.
4. The club's billing facts (amount, renewal date, billing email, processor ids) are sent to the browser only for owner and admins. Note the role-summary hook copies fields by hand: a new or removed field means route + type + the hook's copy.
5. Fee totals stop being sent to check-in volunteers.
6. Uploads (player documents, document templates) get a cleaned name and a checked type.
7. A bad week in the house-league schedule address falls back to the current week instead of crashing.
8. A rules save is one database step so a retried timeout can't add a point twice. This probably needs a function/migration: dev first, update docs/agents/db/DATA_DICTIONARY.md and run npm run refresh:snapshots in the same unit of work. Production gets it with the promote, code first then migration; say so in the hand-off.
9. Readers who can't open a permit file see "File attached" and nothing more (no name, no size).
10. Saving a permit checks the member's own team groups; a group-limited member can't hold a permit for a team outside them.
11. A parent with an unconfirmed email who is refused a family claim is told to confirm their email first.

RULES THAT BIND THIS SESSION
- Argue from what the code does, not from what the report says; the report has been stale in places. For each item, re-read the live code first and tell me if it is already fixed or the premise is wrong BEFORE building.
- Before any code: give me the Implementation Plan and a plain-language product-manager UX summary (what each role sees differently). Then build.
- Branch `dev` only. Stage explicit pathspecs, never `git add -A`. After each commit run `git show --stat HEAD` and confirm only your files landed. Do NOT commit or push without my confirmation. One commit per logical fix (group 9+2 if they share the permit read).
- A server-side change gets a proof: extend or write a probe under .probe/ against DEV only (db-query --dev; never --prod, never seed mid-run). Prove both the allowed role works and the refused role is refused.
- Spelling gate: any new customer-visible text goes through the one-spelling rules (npm run check:spelling); times only via formatTime().
- Verify with `npm run verify:changed` and `npm run typecheck` (shared modules and auth are touched). Report anything skipped.
- Changed who can read what: offer /docs for the help articles that describe those screens, and offer /review before calling it done. If you add a new shared helper, offer /simplify first.
- Do not touch hooks, settings, or database checks/gates. Do not edit the public roadmap wording (that waits until the fixes are live).
- Browser testing is mine. Finish with a short walk list in product-owner voice: who signs in as what, what they should and should not see.

DONE LOOKS LIKE
Each of the 11 is either fixed with a proof, or reported back as already fixed / premise wrong. The sweep report gets a status line per item (commit hash, date). The board line in docs/agents/strategy/OWNER_BRIEF_PROJECTS.json moves in the same commit as the work. Tell me what needs a migration on production and in what order.
```

---

## P2 — An existing account gets an invitation (call 13)

```
Board Ready — trust call 13 (build). Owner ruled 2026-11-18: an existing account is invited to accept, not attached on the spot.

READ FIRST
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: RULED block (item 13) and the "NOT changed" note about the invite's existing-account branch (~lines 320-326).
2. app/api/admin/members/invite/route.ts and the pending-invite flow for a brand-new email (the model to copy: invite row, email, accept screen, role set on accept). Also the existing sign-in / accept pages and the pending-invitation message at sign-up (call 18, accepted as designed: club name only, never the role; do NOT change it).

THE CHANGE
- Today, inviting an email that already has an account makes them an ACTIVE member immediately, with no yes from them. After: they get an invitation like a new person does, and become a member only when they accept. Until then they are pending, hold no seat and see nothing of the club.
- Decide, from the code, how the existing-account person is told (email? next-sign-in banner? both) and what they see if they decline or ignore it. Reuse the new-person flow wherever possible; do not invent a second invitation system.
- Keep the owner/admin experience coherent: the Members screen shows "Pending", can resend and cancel, and the seat/plan limit counting must not count a pending invite as a member (check how it counts today for new people).
- Check every other caller that adds an existing account as active (coach invites, staff add, league admins, anywhere the same branch is copied). List them in your plan; change the ones that are the same defect, report the ones you leave.
- Adjacent finding, REPORT ONLY unless trivial in the same file: GET /api/admin/members reads only the first 1,000 platform users, so past that the list shows blank names and emails. Tell me the fix size; don't expand scope without asking.
- Platform staff accounts and demo accounts: say what happens when they are invited.

RULES
- Argue from the code; tell me before building if the report is wrong about the current branch.
- Before any code: Implementation Plan + a plain-language UX summary for a product manager (what the inviter, the invited person and the other admins see, per role).
- This changes what the product emails and what a person agrees to: run /legal's review (CASL for the new email, privacy for what the invitation reveals) BEFORE hand-off; apply what it finds or record owner questions. Offer /docs for the Members and invitation help articles. Offer /review before done; /simplify first if you add a shared helper.
- One-spelling gate on new customer text (npm run check:spelling); times via formatTime().
- Prove it on DEV only with a probe under .probe/ (existing-account invite creates a pending invite and NO membership; accept creates it; a different signed-in account cannot accept it; a decline or expiry leaves nothing). Never --prod; never seed mid-run.
- Schema change? Update docs/agents/db/DATA_DICTIONARY.md and npm run refresh:snapshots in the same unit; note the production order (code vs migration) in your hand-off.
- npm run verify:changed and npm run typecheck (auth/shared modules touched). Branch dev; explicit pathspecs; no commit without my confirmation; board line in docs/agents/strategy/OWNER_BRIEF_PROJECTS.json moves in the same commit. Browser testing is mine: finish with a short walk list in product-owner voice.
```

---

## P2b — A club's own coach given a board role accepts it too (call 13, owner ruling 2026-11-18)

```
Board Ready — trust call 13, the last branch (build). Owner ruled 2026-11-18: a person who already COACHES in the club and is
then invited to a board role (treasurer, admin, staff…) accepts it, like everyone else. P2 left exactly this branch on the spot.

READ FIRST
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: the "Status, 13" block in the RULED section (what P2 built, call (a)).
2. app/api/admin/members/invite/route.ts: the `if (sameMember)` coach-row branch (marked "OWNER CALL OPEN") — today it
   updates the capability-less coach row to the board role, active, and emails "You've been added".
3. What reads that coach row (do not break coaching): lib/coach-portal-request.ts, lib/user-contexts.ts (coach branch of
   buildMembershipContext), lib/coach-membership.ts (orphan cleanup ~972, tournament-grant projection ~883), lib/assistant-invites.ts
   (~600, flips an invited coach row), lib/api-auth.ts assertTwoStepForSeat. One row per person per club (UNIQUE org+user).
4. The P2 flow to reuse: Home's invitations card (components/home/PendingInvitationsCard.tsx, POST /api/auth/invitations/[memberId]),
   lib/invite-reconciliation.ts listPendingInvitesForUser, the Members screen pending row (Resend / Cancel invitation),
   tests/unit/existing-account-invite-guard.test.ts, .probe/existing-invite-prove.mjs.

THE CHANGE
- The coach keeps coaching untouched while a board role waits. Recommended shape (decide from the code, say if wrong): nullable
  pending_role + pending_capabilities (+ pending_invited_at) on organization_members; the coach row stays role 'coach', active.
- Home's card lists a pending board role; accept moves it onto the row (role, capabilities, accepted_at) and starts two-step
  days; decline CLEARS the pending columns and must never delete the coach row. The role check from P2 (the yes is to the
  role the card showed) applies.
- Members shows the pending board role (today coach rows sit in Coaching staff, which Members can't manage): Resend and Cancel
  invitation work on it; Cancel clears the pending columns only. Seat counting: decide whether a pending board role holds a
  seat (P2 kept "a pending invitation holds the seat" for everyone; keep it consistent).
- The email: the existing-account invitation form (orgInviteHtml existingAccount), never "You've been added". After this,
  orgMemberAddedHtml has no caller: retire it and its email kind if nothing else sends it (tests pin it:
  tests/unit/club-stage13b-arrival-guard.test.ts B2/B3, two-step-part3 SEAT_STARTS — update them).

RULES
- Argue from the code; tell me before building if the shape is wrong. Implementation Plan + plain-language UX summary first.
- Migration on DEV first; docs/agents/db/DATA_DICTIONARY.md + npm run refresh:snapshots in the same unit; hand-off says the
  production order (migration before code). Do not touch database checks/gates or .claude settings.
- Prove on DEV with a probe under .probe/ (a coach invited to the board: coaching still works while pending; accept gives the
  role; decline and Cancel leave the coach row as it was; a different account can't accept). Never --prod; never seed mid-run.
- /review before done; /legal (the "added" email retires); offer /docs for the Members help. One-spelling gate.
- npm run verify:changed and typecheck. Branch dev; explicit pathspecs; no commit without my yes; the board line moves in the
  same commit. Finish with a short walk list in product-owner voice.
```

---

## P2c — An unaccepted invitation runs out (call 13, open call (b), owner ruling 2026-11-18)

```
Board Ready — trust call 13, open call (b) (build). Owner ruled 2026-11-18, "as recommended" (the P2 chat's and /legal's):
an unaccepted club invitation no longer waits forever. Today a pending organization_members row (a new person's or, since P2,
an existing account's) never expires: it holds a seat, keeps its invitee landing on Home at every sign-in until they act,
and is never removed (/legal: docs/agents/legal/CASL_MEMBER_INVITE_EMAILS.md recommendation 3, backlog L9).

THE RULING, AND WHAT IS YOURS TO DECIDE
- An invitation runs out after 30 days (the P2 chat's default; tell the owner if the code argues for another number). A resend
  starts the 30 days again. A lapsed invitation holds no seat, is not on Home, cannot be accepted (both accept doors), and
  Members shows it as run out with Resend and Cancel.
- Removing lapsed rows (retention): decide from the code whether lapsing is read at use (no job) with a purge later, or a nightly
  job. ⚠ A new scheduled job must respect P4's "one caller per job and minute" guard if P4 has landed; if it has not, say so. Read
  how Club Communications' nightly retention runs and reuse it rather than inventing a second scheduler.
- A new person's lapsed invitation leaves an unconfirmed account the invitation made: say what happens to it (the
  member-account-keep rule in lib/member-account-keep.ts decides deletes; never delete an account its owner already had).
- The sign-up page's "You've been invited" message and the self-serve resend (lib/invite-reconciliation.ts findPendingInviteByEmail,
  /api/auth/resend-invite) must not offer a lapsed invitation as live.

RULES
- Argue from the code; Implementation Plan + plain-language UX summary first (inviter, invitee, other admins).
- Schema change? DEV first, DATA_DICTIONARY + npm run refresh:snapshots same unit, production order in the hand-off.
- Prove on DEV with a probe under .probe/ (age a row by hand: it lapses, frees the seat, can't be accepted; a resend revives it;
  nothing else moves). Never --prod, never seed mid-run.
- /review; /legal (what the privacy policy may now say about unaccepted invitations); offer /docs (Members help). Spelling gate.
- verify:changed + typecheck. Branch dev, explicit pathspecs, no commit without my yes, board line in the same commit. Walk list
  in product-owner voice at the end.
```

---

## P2d — The database's member test counts only active members (call 13, open call (c), owner ruling 2026-11-18)

```
Board Ready — trust call 13, open call (c) (build, one migration). Owner ruled 2026-11-18, "as recommended": the database's
membership test counts only ACTIVE members. Found by P2's security review: `is_org_member()` and `can_access_tournament()`
(migrations 009 / 072, read the LIVE bodies on dev) ignore organization_members.status, so a PENDING invitee (now including an
existing account with a live session, since P2) and a SUSPENDED member can read, through their own browser session, the club's
venue library (org_venues, org_venue_facilities) and its tournaments' team names (teams, policy teams_member_read_for_live_feed,
also over Realtime). Every other membership policy found had no authenticated SELECT grant (re-check, don't trust this list).

THE CHANGE
- Both functions require status = 'active'. Before writing it, list EVERY policy and function that calls them (dev
  information_schema / pg_policies), and say for each who loses access: it must be only pending and suspended rows. Check the
  coach rows (capability-less 'coach' role, active) and any team-workspace or tournament-staff path still pass.
- Prove on DEV with the authenticated key as (1) a pending invitee, (2) a suspended member, (3) an active member and (4) a club
  coach: reads of org_venues / org_venue_facilities / teams return nothing for 1–2 and as before for 3–4. A probe under .probe/,
  never --prod, never seed mid-run.
- DATA_DICTIONARY (the two functions' meaning) + npm run refresh:snapshots in the same unit. Production order in the hand-off
  (it only narrows reads, so say whether it can go before or after the code; there may be no code).
- ⚠ Do not touch the database checks/gates themselves (WATCHED_PATHS in scripts/check-agent-automation.mjs); if a check must
  learn the new rule, stop and tell me.
- /review (RLS posture is high-risk). verify:changed + typecheck. Branch dev, explicit pathspecs, no commit without my yes,
  board line in the same commit. Walk list in product-owner voice at the end.
```

---

## P3 — Lock rules, files and links on a completed event (call 14)

```
Board Ready — trust call 14 (build). Owner ruled 2026-11-18: rules, files and links lock with the rest of a completed event.

READ FIRST
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: RULED block (item 14) and finding 2's open owner call (~line 410, "neither the file-store route nor the rules route locks a completed event").
2. How pools and the schedule routes refuse writes on a completed ("sealed") event today: copy that exact check and its error wording; do not invent a second definition of "completed".
3. The server write paths that need the lock: app/api/admin/resources/route.ts (link rows: create, rename, repoint, reorder), app/api/admin/resources/file/route.ts (upload, delete), and the Rules save route (rules sections/points).

THE CHANGE
- Every write above is refused, server-side, on a completed event, with the same message the schedule routes use.
- Every screen that shows those editing controls for a completed event: hide or disable them (gate every door that renders its absence; a button that always errors is the same bug). Read access, the public Rules page and downloads stay exactly as they are.
- How does an owner reopen a completed event today? Confirm that path still exists and that reopening restores editing. If there is no reopen path, tell me before building, as that makes this a one-way lock.
- A COPIED event reuses its source's file addresses; make sure copying a completed event into a new one still works and the copy's files are editable.
- Check that no cron/system writer (rollover, copy, import) is blocked by the new lock.

RULES
- Argue from the code; report if any part is already locked.
- Before code: Implementation Plan + plain-language UX summary for a product manager (what an organizer sees on a completed event before/after, per role).
- Prove on DEV only with a probe under .probe/ (allowed on a live event; refused on a completed one; allowed again after reopen; public read unchanged). Never --prod.
- Offer /docs for the Rules/Resources help article if it describes editing after completion; offer /review before done.
- One-spelling gate on any new text; verify:changed and typecheck (route/auth touched). Branch dev; explicit pathspecs; no commit without my confirmation; board line moves in the same commit; finish with a walk list in product-owner voice.
```

---

## P4 — Refuse a second caller for the same job and minute (call 21)

```
Board Ready — trust call 21 (build). Owner ruled 2026-11-18: before the first live club, the live site refuses a second caller for the same scheduled job in the same minute.

WHY
A "Restore to a New Project" copy of the database copies the pg_cron jobs and the Vault keys and starts the jobs at once. The copy then calls the LIVE site's tick routes with a valid secret (two jobs run every 5 and 15 minutes: game-change emails, web-address checks). Today the by-hand Part C step (unschedule jobs, delete two Vault keys) is the only protection. The first restore rehearsal passed 2026-11-18 with that step.

READ FIRST
1. docs/agents/ops/BACKUPS_AND_RESTORE.md (the trap section) and the checklist Part C steps (docs/projects/active/BOARD_READY_TRUST_CLOSE_CHECKLIST.html, PARTS.C).
2. lib/cron-auth.ts (isCronRequest: shared secret in x-cron-secret) and every route that accepts it (grep isCronRequest). List them with their cadence. Also the scheduler side (migration 183 and later: the tick function reading app_cron_secret and app_cron_base_url from Vault).
3. docs/agents/db/DATA_DICTIONARY.md and any existing run/lock table for these jobs. Some routes may already have their own idempotency; do not duplicate it.

THE CHANGE (design it, then confirm with me before building)
- One door at the top of the machine path: a claim keyed by job name + minute bucket, taken atomically (a unique insert, not read-then-write). The first caller in a bucket runs; a second caller for the same job and bucket gets a quick "already ran this minute" and does nothing.
- Think through and tell me: (a) the real scheduler's own retries inside one minute must not be locked out; (b) if the claim store itself is down, which way does it fail (recommend: let the REAL scheduler proceed and log loudly, since stopping every job is worse; say what that means for the restore case); (c) the answer to the scheduler should look like success so it does not alarm; (d) old claim rows are cleared on a short schedule; (e) the human path (a super-admin session) is not rate-limited by this; (f) honest limit: a restored copy that fires in a DIFFERENT minute than the real job is not caught by a minute bucket. State plainly what this guard does and does not stop, and whether a second layer (e.g. the copy's base URL / environment check) is worth it. The owner decides; give a recommendation.
- Keep the by-hand Part C step in the checklist; update BACKUPS_AND_RESTORE.md to say what the guard now covers.

RULES
- Argue from the code. Read scripts/check-agent-automation.mjs WATCHED_PATHS: if you touch a watched path, it goes in its OWN commit and the message says what behavior changes. Do not touch hooks, .claude settings, or the database checks/gates.
- Before code: Implementation Plan + plain-language summary for a product manager (nothing changes on any screen; say what it protects and what it does not).
- Migration: dev first; update DATA_DICTIONARY.md and npm run refresh:snapshots in the same unit; hand-off states the production order (table before code).
- Prove on DEV only with a probe under .probe/: two simultaneous calls to one job in one minute → one runs, one refused; next minute runs again; a different job in the same minute runs. Never --prod. Do not restore anything.
- Offer /review before done. verify:changed + typecheck. Branch dev; explicit pathspecs; no commit without my confirmation; board line moves in the same commit.
```

---

## P5 — "Send a new link" button for a team's pay link (call 12) — DRAWING SESSION ONLY

```
Board Ready — trust call 12: a club can replace a team's pay link from its own screen. DRAWING SESSION ONLY. Owner ruled 2026-11-18: "draw and build the button (its own short drawing session first)". Build is a later session, after he rules the asks.

READ FIRST
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: the RULED 2026-11-18 block (item 12) and the "Team pay links" finding (~line 275). The server half is already built (W2 fix D, 90d2f23b0: team pay link has a version; `replace_pay_link`; mig 467). No screen calls it yet.
2. lib/team-pay-link.ts and the code that calls replace_pay_link. Find where a club sees and sends a team's pay link today; the button belongs there.
3. Drawing rules: mockups are Claude Artifacts (HTML page, never the canvas), whole-screen before/after at TRUE SIZE, built from the SHIPPED components (draw a control from its shipped component), house layout with Everything / Show-only-what-differs tabs, every highlight clickable. Run /design on the mockup BEFORE hand-off. Run /ux if the flow has more than one step.

WHAT TO DRAW
- Where the button lives, who sees it (which club roles; who must NOT), and what it says. Use plain words a volunteer treasurer understands.
- The confirmation: what replacing does (old link stops working for that team; any link already emailed stops opening; a team mid-payment is sent on to the current link, which the server already does), and whether the club can resend the new link by email in the same step.
- Where the result shows (new link, copy, email it), the phone layout, and the empty/error states.
- What the team's families/coach see if they open the old link (the page already exists; check what it says and whether the wording needs to change).
- An owner-asks tab: numbered asks, each with a recommendation preselected.

RULES
- Argue from what the code does. Tell me before drawing if the premise is wrong (e.g. the server half doesn't behave as the report says).
- No code changes. Before the drawing, give me the plain-language UX summary in the chat (product-manager voice).
- Follow the board's paste-back convention: the owner's reply starts with a short label so a later session can find it.
- Publish the artifact; add a line to docs/projects/active/BOARD_READY_PLAN.md and move the board line in docs/agents/strategy/OWNER_BRIEF_PROJECTS.json in the same unit of work. Do not commit without my confirmation; branch dev; explicit pathspecs.
- Note the production order for the later build: mig 467 is dev-only, apply to prod BEFORE the code.
```
