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
| 5 | P5 "Send a new link" button for a team's pay link | call 12 | drawing session only | DONE 2026-11-18, the commit "Board Ready trust call 12: the pay-link button drawn…" (drawing only): https://claude.ai/artifact/XGaoqcuEuo2973Mc4vsq5F, source `BOARD_READY_PAY_LINK_BUTTON_DRAWINGS.html`, round 2 after /design + /ux. All nine asks RULED 2026-11-18 as recommended (1A–9A): (1) one Pay link line under the payments on every team, its ⋯ holding Email the pay link + Send a new link, the due row keeps only Record; (2) the same people as Email the pay link (owner, admins, Run tournaments); (3) "Stop the pay link" when no new link can go out; (4) no copy button; (5) the old link's words unchanged; (6) a lost dispute is asked in the same window before anything stops, with "Only stop the link"; (7) the line reads "Pay link replaced/stopped {date}" until the next send; (8) stopping still works on a completed tournament (a deliberate exception to the lock); (9) Stop answers red-tinted, Send a new link lime. Build notes on the drawing: the record must be told the replaced date, a show-the-line flag and an ever-paid-online flag; the server should return a cause code (its "tournament over" sentence misreads here); dispute-first + stop-only is about a day with tests; someone with the old page open who hasn't pressed Pay is refused (gap accepted). The button's build prompt is row 6. mig 467 is already on production (applied 2026-11-15, release history), so that build has no production order of its own unless it adds a migration |
| 6 | P6 Build the pay-link button | call 12, asks 1A–9A ruled 2026-11-18 | build | DONE 2026-11-18, the commit "Board Ready trust close-out 12: the pay-link button…" (no schema change, so nothing to order on production; it goes with the next promote). One Pay link line under a team's payments (Email the pay link · Send a new link · Stop the pay link), the window in its three forms, the answer as the record's status line; the server's stop-only mode, the dispute asked BEFORE the stop, cause codes; stopping works on a completed event (pinned). Proved on dev 37/37 (`.probe/pay-link-button-prove.mjs`); /review (4 lenses: 2 Medium race fixes + 1 Low applied; rest recorded); /docs (Tournaments help: the line, and a new answer "Sending a new pay link, or stopping it"); /legal not needed (the email's words and recipient are unchanged); /accounting none. Owner browser walk owed. Every row is now DONE: the next chat runs the END OF QUEUE checklist |
| 7 | P7 The leftover findings, each put to the owner as fix or accept | the findings reported while building rows 1–6; call 22 | ruling preparation (report-only, nothing built) | in progress (2026-11-19: census DONE, 28 found, 3 dropped, 2 chores, 1 too small, 22 put to the owner as 16 calls; page published https://claude.ai/artifact/QBdaJMkkMjA4tqRrsHyDXv, source `BOARD_READY_LEFTOVERS_CALLS.html`, after /legal and /design; census note in the sweep report. census committed c08739b35. Owner ruled 2026-11-19 "1A–16A, none changed", recorded in the sweep report's RULED 2026-11-19 block; P8 and P9 written) DONE 2026-11-19 c08739b35 + the commit "Board Ready trust-fix queue P7: the owner's leftover rulings recorded, and P8 + P9 written…" |
| 8 | P8 Build the leftover fixes | leftover calls 1–6, 8–14 (fix parts) + the two chores, ruled 2026-11-19 | build (one small migration, call 3) | DONE 2026-11-19 (whole scope, with row 8b), first half: 329fb446f (1+2), 0598f4ee9 (10), c9a40bc46 (3, mig 506: production either side of the promote), 2feb3cf16 (13), bc7173346 (14), ee5a16daa (chore: backfill script deleted) + the records commit; the fix B probes' cause traced (two-step redirect) and the probes corrected (local). Proofs 29/29, 8/8, 18/18, 8/8. The second half is row 8b |
| 8b | P8b Build the leftover fixes, second half | leftover calls 4, 5, 6, 8, 9, 11, 12 + the owner's Word-file question | build (no migration expected) | DONE 2026-11-19: Word files on permits 150947d52 (owner yes; mig 507, production BEFORE the code), 9 750957c34, 11 707f7b0d2, 4 7d05bc66a, 12 24daf5d95 + records c1b328ceb; then 5, 6 and 8 (the pay-link trio) in ONE commit "Board Ready leftover fixes 5, 6 and 8…" (no schema change; proof 23/23, `.probe/pay-link-trio-prove.mjs`; /simplify, /review, /docs, /legal done). Owner questions recorded in the sweep report: the coach portal's Pay now while stopped RULED and built the same day (commit "Board Ready leftover 6, the coach portal…"); the pay-link rows on the activity screen RULED "owner only" the same day, its build is row 8c. Next: P8c |
| 8c | P8c Show the pay-link actions on the owner's activity screen | the P8b owner call (a), ruled 2026-11-19 "Owner only, as recommended" | build (small, no migration expected) | DONE 2026-11-19, the commit "Board Ready P8c: the pay-link actions on the owner's Audit log…" (no schema change, so nothing to order on production; it goes with the next promote). The three actions join the owner's one list (a filter would be a new control, so none); separate named list in code so "member changes" keeps its meaning. Words: "Emailed the pay link" · "Sent a new pay link (the old one stopped)" · "Stopped the pay link", plus "(stopped at the same moment, so it doesn't work)" and "(the new one didn't go out)"; To = "{team}, {tournament}" at read time, this organization only, never the team's address. Proof `.probe/audit-log-pay-link-prove.mjs` 33/33 on dev; unit 21/21. /review (4 lenses: 6 fixed incl. a failed name read now fails honestly instead of saying "Deleted"; 3 accepted), /docs (Organization + Tournaments help), /legal (re-verified, no wording change), /accounting none. Read as "no TEAM address": the acting member's own email was already in every row (the export's Actor Email). Owner browser check owed. Next: P9b |
| 9 | P9 Look into the walk edits that didn't save | leftover call 7, ruled 2026-11-19 | investigation (report-only) | DONE 2026-11-19, the commit "Board Ready trust-fix queue P9: the walk edits that didn't save…" (records only, nothing built). All three NOT REPRODUCED on dev, each driven through the real screens (Playwright) as well as the routes: the Rules put-back 3 runs (slow, fast, pressing on with a save still in flight), the Members window put-back 2 runs plus a sign-in swap test, §540 W2's second invitation and Cancel 2 runs; every save landed with its activity line, and none of these screens can say saved without the server's yes. The day's record shows the missing requests never reached the server (no activity line, nothing in the issue feed, every landed line the owner's own). All three sit on compound put-back steps (several presses in one tick); nothing more is provable. Probes `.probe/rules-put-back-ui.mjs`, `memberdbg-ui.mjs`, `memberdbg-swap.mjs`, `p2-w2-screens.cjs`, `p2-w2-repro.mjs`, `p9-actor-check.mjs`; fixtures cleaned. One new finding, put to the owner as leftover call 17 (a failed activity-record line reaches only the server log) and RULED 2026-11-19 "fix it": row 9b. Considered and dismissed: a Rules Delete reads any "not found" as already gone (only a dev recompile gives a foreign one). Call 22 answered under the P9 block |
| 9b | P9b A failed activity-record line opens an issue | leftover call 17 (found by P9), ruled 2026-11-19 "fix it" | build (small, no migration) | DONE 2026-11-19, the commit "Board Ready leftover call 17: a failed record line opens an issue…" (no schema change; nothing to order on production, it goes with the next promote). writeOrgAudit, writePlatformAuditLog and writePlatformEvent report a failed line through lib/observability/report-unwritten.ts (action + the line's club + a code, never the payload; bounded; doesn't mark the request captured, a one-option change to capture.ts). The census moved the team-move copy and four never-checked writers (billing, payouts, Connect closed, the retention run) onto the writers. Proved on dev 14/14 (`.probe/p9b-unwritten-prove.ts`); unit guard + 279/279 related; /simplify (4 lenses, applied), /review (4 lenses: 2 Medium fixed, 3 Low fixed, rest accepted); /docs none (no screen); /legal none (no person data leaves; the issue carries only the feed's usual sign-in attribution); /accounting none. NEW: leftover call 18 (three other tables' writers never read their answer + the feed's foreign key) put to the owner and RULED the same day "fix (a)–(c), accept (d)": row 9c |
| 9c | P9c The other records that never check a line saved | leftover call 18 (a)–(c), ruled 2026-11-19 | build (small, no migration) | DONE 2026-11-19, the commit "Board Ready leftover call 18: three more records report a failed line…" (no schema change; nothing to order on production, it goes with the next promote). (a) the records-opened trail and (c) the Stripe Connect event log (both webhooks, one writer `lib/connect-event-log.ts`) read every write's answer and a failed line opens one issue (never the row); DECIDED: a failed ledger line, the first one included, does NOT fail the event (the log is not what makes handling correct; failing it would only drive retries against a broken database); the first line is written ON CONFLICT DO NOTHING. (b) the Sent emails search count fails closed both ways (can't write → refused with the existing "try again" sentence + an issue; can't read or blank → refused, no longer the false limit sentence), so no new words and no /docs. The five record writers share `writeOrReport`. Proved on dev 42/42 (`.probe/p9c-unwritten-prove.ts`); unit 815 related, 814 pass (the 1 failure is a committed bookkeeping screen this change doesn't touch); /simplify + /review (4 lenses each, applied; accepted items in the sweep report); /legal, /accounting none. **This was the queue's last row: the queue is finished, and the END OF QUEUE checklist does not re-run** (its lines are answered above; call 22's wording can change once these fixes are live) |

**END OF QUEUE checklist RUN 2026-11-18** (its own chat, records only, nothing built). Row 7 was added on 2026-11-19 for
the leftovers it found, so the queue runs again; rows 8 and 9 were added by the P7 chat on 2026-11-19 after the owner's
rulings. After row 9 the END OF QUEUE checklist does NOT re-run (its five lines are answered here); the row-9 chat
reports the queue finished and answers call 22 (see P7's close-out note under the P9 block). Production order, from `supabase/migrations/MANUAL_PROD_STEPS.json` and each
row's hand-off: **500, 502, 503 before the code** · **504 after 502 and the code** · **505 either side** (467 applied
2026-11-15, per that file). Found at the checklist: call 22's wording "every finding resolved" is NOT yet true once these go
live. About twelve findings reported while building have no ruling (the sweep report's "Found while building, not fixed"
list, P2d's browser write grant on the two facility tables, and the "1,000 users" / support-check / accept-page notes
under "Status, 13"). Each needs a fix-or-accept ruling first.

Status values: `not started` · `in progress (what is done, what is left)` · `DONE <date> <commit hashes>` · `BLOCKED <why>`.
Why this order: P1 is small and in one area; P4 must land before the first live club; P2 and P3 are independent builds; P5 is a
drawing, so it goes last and its build is a later session after the owner rules its asks. P6 is that build (prompt written
2026-11-18 after the owner ruled all nine asks). P7 is the leftovers' ruling preparation; the fixes it rules in get their own
build prompt (P8), written by the P7 chat only after the owner's paste-back. P8 builds before P9 so the investigation
reads the product as P8 leaves it; P9 is report-only and touches none of P8's areas, so a stalled P8 doesn't block it.

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

**Never** run two prompts in one chat. **Never** build the button under P5 (P5 is the drawing; the build is P6, in its own chat). **Never** commit, push, or
touch production without the owner's yes in that chat.

## END OF QUEUE checklist (only when every row is DONE)

Tell the owner, one line each: (a) the pay-link button (P5 drawing, P6 build) is done, and what of its walk is owed; (b) the order to apply the migrations on production, collected from each
prompt's hand-off (mig 467 went to production 2026-11-15, per the release history; check it there rather than restating it); (c) the public roadmap's access-review line may change to
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
  [Corrected 2026-11-18: mig 467 was applied to production 2026-11-15, per the release history. This line is kept as the prompt was written.]
```

---

## P6 — Build the pay-link button (call 12; asks 1A–9A ruled 2026-11-18)

```
Board Ready — trust call 12 (build). The owner ruled all nine asks of the drawing "as recommended" on 2026-11-18
(paste-back "Pay link button (drawings Nov 18, 2026)"). Build what the drawing shows; do not redraw it.

READ FIRST
1. The drawing: docs/projects/active/BOARD_READY_PAY_LINK_BUTTON_DRAWINGS.html (published
   https://claude.ai/artifact/XGaoqcuEuo2973Mc4vsq5F). Its tabs are the spec: where the line sits and who sees it, the window
   in its three forms, the answer in the record (four states), the phone, the old link's page (unchanged), and the asks tab.
   Its NEW/UNCHANGED tags carry build notes; read every one.
2. The rulings in words: docs/projects/active/BOARD_READY_PLAN.md, the "Call 12 … DRAWN 2026-11-18" block (asks 1–9 and the
   build notes). ⚠ That block is in the working copy, uncommitted alongside other sessions' plan edits; stage only your own
   hunks of that file.
3. The code (mapped 2026-11-18; re-read it, the map can be stale):
   - Server half, W2 fix D 90d2f23b0 (mig 467: teams.link_version + teams.link_replaced_at; the version lives in the link's
     signature): lib/online-payment-receipt.ts replaceTeamPayLink (~256) and sendTeamPayLink (~215); the only caller,
     app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts action 'replace_pay_link' (~62). No screen
     calls it.
   - The screen: app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx — the "Still due" block (~591), the
     ⋯ on the LAST due row only (~603, CoachToolbarMenu glyph, one item "Email the pay link"), "Pay link sent {date}" (~614),
     the lost-dispute window PayLinkAnywayWindow (OnlinePaymentWindows.tsx ~340). Words: lib/online-payment-words.ts (~750–790).
   - What the record reads: app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts GET (~87–137), which
     carries only pay_link_sent_at and online.payLink (true only when the team can pay now).
   - Refusals: lib/team-pay-facts.ts, lib/team-pay-refusal.ts (strings only; 'tournament_over' reads "is no longer in").
   - The family-link model to copy: the house league's "Send a new link?" (replaceSignupLink, league-signup-link.test.ts).

THE BUILD (the ruled asks; the drawing has the exact words)
1. One "Pay link" line under the payments on every team that shows it; its ⋯ holds the items. The due row keeps only
   Record (the ⋯ leaves the last due row).
2. Who: the same people the server lets email a pay link (owner, admins, anyone with "Run tournaments"; today
   canRefundOnline = create_tournaments). Treasurer-only Accounting seats, scorekeepers, check-in and coaches don't see the
   line, and the server refuses them (it already does; prove it).
   When the line shows: every accepted team while the tournament takes card payments, AND any team that ever paid by card
   (even one later declined), because its link still shows receipts.
3. The menu: "Email the pay link" only while the team can pay now (today's rule); "Send a new link" when it can pay now and
   has an email; otherwise "Stop the pay link". The item stays after a stop; pressing it again stops whatever link is current.
4. No copy button.
5. The old link's page keeps its words. No change to the public pay page.
6. A team that lost a card dispute is asked IN THE SAME WINDOW, before anything stops: Cancel · "Only stop the link" ·
   "Send a new link". "Send a new link" there stops and sends in one step and never opens a second window.
7. The line reads "Pay link replaced {date}" / "Pay link stopped {date}" until the next send, then "Pay link sent {date}"
   again. The answer shows as the record's quiet status line (not a toast), in the four states the drawing shows: sent;
   stopped, nothing owed; stopped but the email didn't go (both halves said); nothing changed (the stop failed).
8. Stopping still works on a COMPLETED tournament, a deliberate exception to the completed-event lock (call 14). Pin it with
   a guard test so a later "lock every route" pass doesn't remove it by accident. Email the pay link stays refused there.
9. Stop answers red-tinted (the danger button), Send a new link lime, from the shipped window kit (the window "Email the pay
   link anyway?" uses).

SERVER CHANGES THE DRAWING NEEDS (each small; confirm from the code)
- A STOP-ONLY answer: today every replace also tries to send. Asks 3 and 6 need "stop, send nothing".
- The DISPUTE CHECK BEFORE THE STOP: today replaceTeamPayLink stops first and asks about a lost dispute afterwards (the
  drawing's "about a day with its tests"). The record already reads each payment's dispute, so the window knows before it opens;
  the server must still refuse to stop-and-send without the yes, and must check BEFORE it moves the version.
- A CAUSE CODE, not a sentence: refusalMessage hands back strings, and for a completed event it says the team "is no longer
  in" the tournament. Return the cause as a code (nothing owed, tournament over, declined, no email, …) and let the record pick
  its own sentence. Keep the public pay page's and the reminders' sentences unchanged.
- What the record must be told: when the link was last stopped, whether that was a replace (sent) or a stop (nothing sent),
  whether to show the line, and whether the team ever paid online. Decide from the code whether replaced-vs-stopped can be
  derived (pay_link_sent_at vs link_replaced_at) or needs a column. A column is a migration: dev first,
  docs/agents/db/DATA_DICTIONARY.md + npm run refresh:snapshots in the same unit, and the hand-off states the production
  order (migration before code).
- The launch switch: the route answers 404 while online payments are off. Say what that means for stopping a link a team
  already paid through, and recommend; don't widen the switch without asking.
- Accepted gap (ask 6's note, do not close): someone with the old page open who hasn't pressed Pay is refused and needs the
  new email.

RULES
- Argue from the code; if a ruled ask can't be built as drawn, stop and say so before building around it.
- Before code: Implementation Plan + a plain-language UX summary for a product manager (what owner/admin/Run-tournaments see;
  what treasurer, scorekeeper, check-in and coach don't; what a family holding the old link sees).
- Prove on DEV only with a probe under .probe/ (extend fixd-probe.mjs or write a new one): send-new-link moves the version,
  the old link is refused and the new one opens; stop-only sends no email; a lost-dispute team is refused a stop-and-send
  without the yes and the version does NOT move; stop works on a completed tournament; a refused role is refused. Never
  --prod; never seed mid-run. Extend tests/unit/team-pay-link-version.test.ts and the payments guards.
- One-spelling gate on every new string (npm run check:spelling); dates via the house date helpers.
- Agents, in order: /simplify if you add a shared helper; /review; /docs (the Tournaments help on team payments and the pay
  link: the new line, Send a new link, Stop the pay link). /legal only if the email's words or who receives it change (the
  new link goes out in today's pay-link email); /accounting none (nothing charged changes) — say so.
- npm run verify:changed and npm run typecheck. Branch dev; explicit pathspecs; no commit without my yes; the board line in
  docs/agents/strategy/OWNER_BRIEF_PROJECTS.json and the sweep report (BOARD_READY_ACCESS_SWEEP_3.md, a "Status, 12" line)
  move in the same commit. Browser testing is mine: finish with a short walk list in product-owner voice (one action per
  step), on the Stripe walk tournament (scripts/seed-stripe-walk-tournament.mjs).
```

---

## P7 — The leftover findings, each put to the owner as fix or accept (ruling preparation; written 2026-11-19)

```
Board Ready — the trust close-out's leftovers (ruling preparation, REPORT-ONLY). Nothing is built in this session.

WHY THIS EXISTS
The END OF QUEUE checklist (2026-11-18) found that call 22's roadmap wording, "a full access review of who can see what,
every finding resolved", will not be true once rows 1–6 go live: about twelve findings were reported while building them
and none has a ruling. "Resolved" means each one is FIXED or ACCEPTED AS DESIGNED with a reason on record. This session
turns each leftover into one owner call with a recommendation, so a later session (P8) can build the ones ruled "fix".

READ FIRST (in this order)
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: the RULED 2026-11-18 block and every "Status, …" block under it,
   especially "Found while building, not fixed" (after fixes 1–11) and the "Reported, not fixed" / "Noted, not fixed"
   lines under Status 13, 13 (c) and 14.
2. docs/projects/active/BOARD_READY_TRUST_CLOSE_CHECKLIST.html: the house pattern for owner calls (the CALLS array, radio
   rows, one paste-back). Copy its look and paste-back shape; do not invent a new one.
3. The commit messages of the queue's builds (git log --since=2026-11-17 --grep=trust -i, full bodies) and each row's
   PROGRESS note: some leftovers are recorded only there ("rest recorded", "1 noted").

THE CENSUS (seed list, NOT the whole list; the census is the job)
Known leftovers, as recorded. For each, re-read the live code first: it may already be fixed, wider than written, or wrong.
 a. The club's player-document upload saves any document template it is sent, unchecked (the coach's route checks it).
 b. Creating a Rules section is still two inserts with a compensating delete (a retried create could add a section twice).
 c. A member limited to some team groups can still save a permit held for the whole club.
 d. …and can still delete a permit, or replace its file, held for a team outside their groups.
 e. The house-league schedule's "outside the permit" warnings send the permit's days, hours and id to anyone who reads the
    season, a registrar included.
 f. The permit file upload still trusts the browser's file type and stores the raw file name.
 g. Any ACTIVE member of any role (a scorekeeper, a coach) can write a tournament's venue facilities and facility lanes from
    their own browser (the app writes both through the service role, so the browser grant may simply be revoked).
 h. Two lists still read only the first 1,000 platform users (the program-year coaches list; the platform staff-delete tool).
 i. The support-address check fails OPEN on a database error, and compares stored emails case-sensitively.
 j. The accept page without a club named in its address accepts the oldest pending invitation.
 k. A one-off backfill script for invited emails predates the empty-email mark (a re-run would undo it).
 l. While a coach's board role waits, the person shows on the board, not under Coaching staff; club and league creation's
    pending-invitation checks don't see a waiting board role.
 m. A Rules record already open in edit mode when its event is completed keeps its fields (its saves are refused).
 n. Whatever the P6 /review recorded and did not fix, and the P3 /review "1 noted" (find them; they are not listed here).
Housekeeping, not a call: the old sweep-3 fix B probes' "a coach row is refused" checks expect the wrong answer (the
request now meets an HTML page first). List it as a chore with its size, do not put it to the owner.
Then widen: look for anything else the queue's builds recorded as reported, noted, left or accepted that has no ruling.
Already ruled (do NOT re-ask): calls 1–22, the pay-link asks 1A–9A (incl. ask 6's accepted gap), 13 (a)/(b)/(c).

FOR EACH LEFTOVER, RECORD
- Is it real today (file:line in the record, never in the owner's page)? Already fixed → say so and drop it.
- In plain words: who could do what they shouldn't, or what could go wrong, and how likely. Rank: Serious / Medium / Small.
- The recommendation: FIX (with its size: lines, a migration or not, a screen change or not) or ACCEPT (with the reason
  that would go on record). Recommend on merit; a past ruling is a reason to cite, not an authority.
- Does it touch what a person's information shows to whom? If yes, it goes through /legal before the page is published.

THE OWNER'S PAGE
- One checkable page, docs/projects/active/BOARD_READY_LEFTOVERS_CALLS.html, published as a Claude Artifact (load
  artifact-design first): one call per leftover (group two only when one fix answers both), the recommended option first,
  each call in product-owner words (what a person sees or could do; no file names, no table names), one paste-back at the
  bottom. Calls only; no walk steps. Say at the top how many leftovers the census found and how many dropped as already fixed.
- Run /design on the page before handing it over (house rule for every page the owner rules from).

RULES THAT BIND THIS SESSION
- REPORT-ONLY. No code, no migrations, no probes that write. Reading dev is fine (db-query --dev, counts and schema);
  production is never touched.
- Argue from the code, not from the record: several Status lines in the sweep report were stale before.
- Disagree out loud: if a leftover is not worth a call (too small to matter, or obviously fixed by the next promote), say so
  and recommend accepting or dropping it, rather than padding the page.
- Do not touch hooks, settings or the database checks. Do not change the public roadmap's wording (call 22 waits until the
  fixes ruled in are built AND live).
- Close-out: the sweep report gets one short "Leftovers census 2026-11-19" note (count found, dropped, page link); PROGRESS
  row 7 moves; the board line in docs/agents/strategy/OWNER_BRIEF_PROJECTS.json moves in the same commit (commit only that
  file's Board Ready lines if another session has the file open; see the partial-commit memory). Branch dev; explicit
  pathspecs; no commit without my yes.

WHEN THE PASTE-BACK COMES (same chat, if it is not heavy; otherwise a fresh one through the launcher line)
- Record each ruling in the sweep report's RULED block, as ruled and nothing more.
- The ones ruled ACCEPT: record the reason; they are resolved.
- The ones ruled FIX: write P8, "Build the leftover fixes", into this file as a new PROGRESS row and prompt block, in the
  style of P1 (one commit each, a probe on dev for every server change, the production order of any migration). Do not
  start building it in this chat.
- Then say whether call 22's wording can change once P8 is live, or what still stands in the way.

DONE LOOKS LIKE
Every leftover is on the owner's page with a recommendation, or reported as already fixed or not worth a call. The page is
published and linked. Nothing was built.
```

---

## P8 — Build the leftover fixes (leftover calls ruled 2026-11-19; written 2026-11-19)

```
Board Ready — the trust close-out's leftover fixes (build). Owner ruled leftover calls 1A–16A "none changed" on 2026-11-19.

READ FIRST (in this order)
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: the "Leftovers census 2026-11-19" note (page call → finding, with
   file:line) and the "RULED 2026-11-19" block under it. That block is your scope, word for word.
2. docs/projects/active/BOARD_READY_LEFTOVERS_CALLS.html: the CALLS array. Each call's "what" and "size" are what the
   owner read; option A is what he chose. Don't build beyond it.
3. How P1 was done (PROGRESS row 1 and commits 49c4c9934..238bc70d3): one commit per fix, a probe under .probe/, a status
   line per item in the sweep report.
Out of scope: call 7 (that is P9), the accepted items (10's five other uploads, 15, 16, the too-small item), anything
in the public roadmap's wording (call 22).

THE FIXES (page call numbers; the chosen option)
1+2 (one commit; they share the group check). A member limited to some team groups:
   - a whole-club permit counts as OUTSIDE their groups, on the stored permit and on the draft (add, edit, renew; and a
     switch from a team to the whole club). Today `teamOutsideGroups` (app/api/admin/org/permits/route.ts:223-230) drops
     a null team.
   - deleting a permit (the delete-permit branch, :326-351) and replacing its file (permits/document/route.ts POST) get
     the same check. Move the check to a shared server helper so the document route can use it.
   - opening a permit's file (permits/document GET) is allowed only for their own groups' teams and the whole club's
     permits. Outside them they see "File attached" and nothing more, as trust call 9 has it: check that the list and
     window payloads also hide the name/size for those permits, not only the GET. The LIST stays whole (owner's ruling).
   - The form may stop offering "the whole club" to them (the page said "can"): do it only if it is a small change.
3. Take away the browser's write permission on a tournament's playing fields and lanes (venue_facilities,
   schedule_facility_lanes): drop the INSERT/UPDATE/DELETE policies and revoke insert/update/delete from authenticated
   (and anon). First re-prove no browser-client code writes either table (the census found none; every write is the
   service role). Migration on dev first; DATA_DICTIONARY.md + npm run refresh:snapshots in the same unit. Production:
   either side of the promote (no code depends on it); say so in the hand-off.
4. Removing a FieldLogicHQ staff member (app/api/platform-admin/company-users/[id]/route.ts:76-83): find the sign-in
   with findAuthUserIdByEmail (lib/auth-account-lookup.ts:34: paged, case-insensitive, fails closed); if the lookup
   fails, refuse and remove nothing, with a sentence that says so. Staff access always ends; the sign-in is deleted only
   when nothing else uses the account (no club seat, no other sign-in history), using the same no-other-use test the
   invitation sweep and the member Cancel use (lib/invitation-sweep.ts ~:134; app/api/admin/members/[memberId]/route.ts
   ~:173-254). Don't invent a second test.
5. Two people on one pay link (lib/online-payment-receipt.ts): replaceTeamPayLink's race loser (:286-300) is refused
   ("someone just replaced this link") and sends nothing, instead of re-bumping; sendTeamPayLink is passed the version
   its own bump made and sends nothing if the version has moved; the send's stamp (:249) is checked (rows updated), and a
   send whose stamp didn't land answers "went out, but the link was stopped meanwhile" rather than "sent".
6. After a stop, automatic emails (teamPayNowLink :401-410, used by the acceptance email and the balance reminder; and
   lib/bank-debit-email.ts:57) leave the Pay button out until someone sends a new link. "Stopped" is what the line reads
   (payLinkLineState, lib/team-pay-refusal.ts:36): decide it on the server from the same stamps, one rule in one place.
   When an automatic email does carry a link, stamp the send so the line reads "Pay link sent [date]" (pay-link ask 7).
   Check the league pay link (bank-debit-email.ts:75) has the same stop rule; if it has no stop, say so and leave it.
8. Record who stopped, replaced or emailed a pay link, and when, in the club's activity record (owner and admins read
   it): the admin, the action, the time; never the payer's email address.
9. The program-year coaches list (app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts:58)
   reads emails the way the Members screen does (peopleSignInFacts, lib/two-step-club-status.ts:30). No new reader sees
   an email.
10. The permit file upload (permits/document/route.ts:83-105) uses trust call 6's checker (checkDocumentUpload,
   lib/document-upload.ts:73): type from the bytes, a cleaned display name. The permit allows PDF/JPEG/PNG only, so a
   DOCX is refused with the permit's own sentence (the shared refusal names DOCX). The five other uploads are ACCEPTED:
   don't touch them.
11. The club's player-document upload (app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/route.ts:82,
   116) keeps a template id only when the coach route would (coaches/…/roster/[playerId]/documents/route.ts:125-132):
   an active template that applies to this team and matches the document type. Fix the DATA_DICTIONARY.md line that
   calls the column unvalidated (~4858).
12. The invitation page (app/api/auth/accept-invite/route.ts; AcceptInviteForm.tsx): with no club named and more than one
   live invitation waiting, the server refuses with a "choose a club" code and the page asks which club; it never picks
   one; the one not chosen stays waiting (not declined, not used). Make the GET's order and the POST's agree. New page
   words go through the spelling gate. This is a consent screen: /legal before hand-off.
13. The staff-address check in the invite route (app/api/admin/members/invite/route.ts:66): when the read errors, refuse
   with "try again", and the refusal depends only on the error, never on the address (a club admin must not be able to
   probe which addresses are staff). Add a strict variant; do NOT change isPlatformAdminEmail (lib/platform-auth.ts:55)
   for its other callers, which want the soft answer. Confirm the typed address is lower-cased before the compare.
14. An open rules or resource record turns read-only when its event locks (RuleSectionRecord.tsx:96/315 and
   ResourceRecord.tsx: editing && canWrite, or an effect). No change to how the screen looks.
Chores (the page said "unless you object"; he didn't):
 - Delete scripts/backfill-invited-email.mjs (its one-time job is done; a re-run would erase the existing-account mark).
 - The three sweep-3 fix B probes (.probe/sweep3-fixB-prove.mjs:81, -fixB2-:59, -fixB3-:87): first trace WHY a coach's
   request now meets an HTML page before the route (if it is the two-step page, say so); then correct the expectation
   and re-run on dev. Report the cause in the sweep report.

RULES THAT BIND THIS SESSION
- Argue from the code, not the census: re-read each item's live code first and tell me if it is already fixed or the
  premise is wrong BEFORE building it.
- Before any code: the Implementation Plan and a plain-language product-manager UX summary (what each role sees
  differently). Then build.
- Branch dev only. Explicit pathspecs, never git add -A. One commit per fix (1+2 together); after each commit
  git show --stat HEAD and confirm only your files landed. No commit or push without my yes.
- Every server change gets a proof on DEV under .probe/ (db-query --dev; never --prod; never seed mid-run): the allowed
  person works, the refused person is refused, nothing else changed.
- Spelling gate on new customer text (npm run check:spelling); times only via formatTime().
- Agents, in order: /simplify (the shared permit check is a new helper), /review, /docs (Permits / Venue library help
  for group-limited members; the pay-link help for the stop rule and the activity record; the invitation page's
  question), /legal (12 always; 4, 6 and 8 as its read said), /accounting none expected (nothing charged changes).
- npm run verify:changed and npm run typecheck (auth and shared modules are touched). Report anything skipped.
- Do not touch hooks, settings or the database checks. Do not edit the public roadmap's wording.
- Context heavy before the end: stop at a commit boundary and mark the row in progress with what is done and left;
  splitting P8 into two chats is expected.
- Browser testing is mine: finish with a short walk list in product-owner voice (who signs in as what, what they should
  and should not see).

DONE LOOKS LIKE
Each fix built with its proof, or reported already fixed / premise wrong. The sweep report gets a status line per item
(commit hash, date). PROGRESS row 8 and the Board Ready board line move in the same commit as the work. The hand-off
names the production order (call 3's migration: either side of the promote; nothing else in P8 needs one unless a fix
adds a migration) alongside the queue's existing order (500, 502, 503 before the code; 504 after 502 and the code; 505
either side).
```

---

## P8b — Build the leftover fixes, second half (written 2026-11-19 by the P8 chat)

```
Board Ready — the trust close-out's leftover fixes, SECOND HALF (build). P8's first chat built 1+2, 10, 3, 13, 14 and the
chores (PROGRESS row 8). This chat builds the rest of P8's scope: fixes 4, 5, 6, 8, 9, 11, 12, exactly as P8's block
words them, with P8's RULES THAT BIND THIS SESSION and DONE LOOKS LIKE (read the P8 block above in full; it binds here).

READ FIRST
1. The P8 block above (the fixes' words, file:line hints, rules).
2. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: the RULED 2026-11-19 block and "Status, leftovers (P8, first chat …)".
3. The first chat's commits for the pattern: 329fb446f..ee5a16daa (one commit per fix, a proof under .probe/, a status
   line per item; proofs sign in with a magic link and send `redirect: 'manual'`; a person with two-step on gets a 307 to
   /auth/login before any /api/admin route runs, so pick un-two-stepped fixture people or count that as refused).

ASK FIRST (one question, then carry on while you wait only on items it doesn't touch):
- The owner asked 2026-11-19 why permit files refuse Word documents. Answer given: nothing in P8 decided it; permits have
  taken only PDF/JPG/PNG since they were built (the window opens the file in the browser, which shows a PDF or picture and
  only downloads a .docx), and player documents already take Word. Recommended: allow it (pass 'docx' in the permit
  route's kinds and change its refusal sentence and the Permits help's two lines). Ask "allow Word files on permits?";
  on a yes, build it as its own small commit with a proof; on a no, record "kept PDF/JPG/PNG, owner 2026-11-…".

PREMISES ALREADY RE-READ BY THE FIRST CHAT (re-check the code; it may have moved):
- 5 is HALF WRONG as P8 words it: replaceTeamPayLink's loser does not re-bump on top; it re-reads and bumps the NEXT
  version, so two presses both succeed, the version moves by 2 and TWO emails go out (the first link already dead).
  Fix the outcome P8 asks for: the second press is refused ("someone just replaced this link"), sends nothing.
  sendTeamPayLink takes no version today (it re-reads), and its stamp (lib/online-payment-receipt.ts ~:249) ignores rows
  updated; the client toasts "sent" whatever happened.
- 6: "stopped" has no flag of its own (a stop bumps teams.link_version and stamps link_replaced_at later than
  pay_link_sent_at); teamPayNowLink (~:401) and the bank-debit email (lib/bank-debit-email.ts:57) build a live link at
  the current version, which quietly reverses a stop. Callers: registrations/bulk/route.ts:173, admin/teams/route.ts:697,
  registrations/payment-reminders/route.ts:219, and the :125 link in the same file (trace which email uses it). The
  league family link (bank-debit-email.ts:75) has NO stop concept (only Send a new link): say so and leave it.
- 8: the club's activity record (org_audit_log, writeOrgAudit in lib/org-audit.ts) is OWNER-ONLY on screen, and its
  screen asks scope=members (MEMBER_AUDIT_ACTIONS), so a new pay-link row is shown nowhere. P7's page told the owner "no
  screen change" and "owner and admins read it" (the second half is wrong). Build the ruled part: write a row for stop,
  replace and email (admin id, action, time, tournament and team ids; NEVER an email address). Do not change who reads the
  record or the screen; put "show pay-link rows on the owner's activity screen? and should admins read it?" to the owner
  in the hand-off as a question.
- 4: the no-other-use test is ONE shared function, readAccountKeepFacts(userId, orgId) in
  lib/member-account-keep-server.ts:14 + accountKeptReason in lib/member-account-keep.ts:35 (P8's "~:134 / ~:173-254"
  points at its two callers). It is org-shaped; a staff removal has no org: reuse it (e.g. a null org meaning "any club
  seat counts") rather than inventing a second test, and say what you did. It counts organization_members rows with no
  status filter, active Basic coach-team memberships and live family links. company-users DELETE today: unpaged
  listUsers(), case-sensitive match, silent skip; findAuthUserIdByEmail throws on a read error (fails closed).
- 9: the coaches route reads emails with ONE listUsers({ perPage: 1000 }) page across the whole platform and ignores
  the read's error; peopleSignInFacts (lib/two-step-club-status.ts:30) is the Members screen's reader. Note in the
  hand-off: a member granted module_rep_teams without module_members sees coach emails there but not on Members (owner
  call, not a fix here).
- 11: TRUE as worded; the coach route's check is inline (roster/[playerId]/documents/route.ts:125-132) — consider a
  small shared helper both routes call. DATA_DICTIONARY.md ~4858 ("unvalidated") and ~4883 ("gotcha 2").
- 12: GET orders invited-then-active, newest first; POST takes the OLDEST live invitation (invited only, 30-day cutoff);
  the club is named only by org slug (?org= / body.orgSlug); codes exist (demo_account, invitation_lapsed,
  one_home_org, join_failed). The page normally sends GET's slug, so POST picks only when GET failed or hadn't answered.
  Consent screen: /legal before hand-off, always.

FOUND BY THE FIRST CHAT, NOT IN SCOPE (do not build; they are in the sweep report as owner calls): getAuthContextWithRole
ignores its group-scope read error (a limited member reads as unlimited for that request); a limited member sees Edit /
Renew / Delete / Replace on a permit outside their groups (refused in words).

Agents, in order: /simplify (only if you add a shared helper: 4's reuse or 11's check), /review, /docs (the pay-link help
for the stop rule, the "second press" answer and the activity record; the invitation page's question; staff removal is
platform-admin only, no help), /legal (12 always; 4, 6, 8 as its read says), /accounting none expected.
When every item is DONE: mark PROGRESS rows 8 and 8b DONE, move the Board Ready board line, and the next chat runs P9.
```

---

## P8c — Show the pay-link actions on the owner's activity screen (ruled 2026-11-19; written 2026-11-19 by the P8b chat)

```
Board Ready — the pay-link rows on the owner's activity screen (build, small). Owner ruled 2026-11-19: "Owner only, as
recommended."

READ FIRST
1. docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md: the P8b status line for 5, 6, 8 and its "Owner calls" (a), RULED.
2. docs/agents/db/DATA_DICTIONARY.md `org_audit_log`: the "Pay-link actions" paragraph (pay_link_emailed | replaced |
   stopped; payload tournamentId, teamId, linkWorks / asked; target null; never an address). Written since commit
   0d37431e9 by the online-payments route.
3. The owner's activity screen and its route: it asks scope=members (MEMBER_AUDIT_ACTIONS) and labels each action; the
   legacy unscoped view (app/api/admin/members/audit/route.ts) has no labels for these. docs/agents/legal/
   AUDIT_LOG_SCOPE_WORDING.md (its re-verify trigger fires when the screen gains an event kind).

THE CHANGE
- The three actions show on the owner's activity screen with words in the log's existing style, naming the team and the
  tournament (read their names at read time; the payload holds only ids). "Emailed the pay link" with linkWorks false
  says the link was stopped meanwhile. Never an email address.
- Who reads the record does NOT change: owner only (admins still don't; that is a wider ruling about the whole record).
- Decide from the code whether they join the members scope or get their own scope/filter, and say why. No drawing session
  unless it adds a control the screen doesn't have (then STOP and ask).

RULES
- Argue from the code; tell me before building if a premise is wrong. Implementation Plan + PM UX summary first.
- Proof on DEV under .probe/: the owner sees the rows with the right words; an admin is still refused the record; no
  address anywhere in the response.
- One spelling (npm run check:spelling). Agents: /review; /docs (the activity screen's help: what it lists); /legal
  (the screen's scope note against the new event list, AUDIT_LOG_SCOPE_WORDING.md); /accounting none.
- npm run verify:changed and typecheck. Branch dev; explicit pathspecs; no commit without my yes; the board line and this
  row move in the same commit. Browser testing is mine: a short walk list.
```

---

## P9 — Look into the walk edits that didn't save (leftover call 7, ruled 2026-11-19; written 2026-11-19)

```
Board Ready — leftover call 7 (investigation, REPORT-ONLY). Owner ruled 2026-11-19: "Look into it: one session tries to
make it happen again." Nothing is fixed in this session; any fix is ruled after it.

WHAT HAPPENED (as recorded; read the records, then the code)
- Owner QA Ledger walk §539 (the first eleven trust fixes), its read-back (docs/projects/active/OWNER_QA_LEDGER.md,
  ~line 28528; commit 2f7afc61f): two of the owner's put-backs didn't reach the database: a "Walk rules" rules section
  kept both its points, and a league admin's Rep teams switch and Senior group limit stayed changed. Both routes were
  replayed afterwards and worked. Recorded as "not explained, an open question, not a finding against the fixes".
- Walk §540 W2 steps 6–7 (~line 28540): a second invitation of an existing account after a Decline, and its Cancel,
  wrote no audit row, though both routes write one. Recorded as "one unexplained gap; route to /debug if it recurs".

THE JOB
- Use /debug's method (.claude/commands/debug.md). For each of the three, form the likely causes from the code (a save
  the screen debounces and drops on close; an optimistic state that never posted; a refused save shown as saved; an
  audit write that swallows its error; a different route than the replay used) and try to reproduce each on DEV, the way
  the owner did it (the screen's own clicks, through a probe or by reasoning from the component's code), not only by
  calling the route.
- For each: REPRODUCED (with the exact steps and the cause, file:line) / NOT REPRODUCED (what was tried) / EXPLAINED
  WITHOUT A DEFECT (e.g. the read-back read too early).
- Anything reproduced: write it as a fix-or-accept call with a recommendation and size, in the house page style
  (append to BOARD_READY_LEFTOVERS_CALLS.html as calls 17+, or a new small page if that reads better; /design first).

RULES
- REPORT-ONLY: no code fixes, no migrations. Probes that write go to DEV only, against test fixtures, and clean up after
  themselves; never --prod; never seed mid-run; no rows holding a person's information read on production.
- Argue from the code. Don't touch hooks, settings or the database checks.
- Close-out: a status line in the sweep report and the QA ledger's two entries (positive facts with anchors); PROGRESS
  row 9; the Board Ready board line. No commit without my yes.

DONE LOOKS LIKE
Each of the three is reproduced, not reproduced, or explained, on record. If any is a defect, its call is on the owner's
page. Then answer call 22 (below).
```

**P7 close-out note: can call 22's wording change once P8 is live?** Yes, on three conditions. (1) P8's fixes are on
production, with migration 505 and call 3's migration applied (call 22 waits for the fixes to be live, not built).
(2) P9 ends with each of its three either explained or ruled (a reproduced defect is a new finding and needs its ruling
first). (3) Neither P8 nor P9 records a new finding left without a ruling: a build that writes "noted, not fixed" puts it
back to the owner first. With the 2026-11-19 rulings, every other leftover is resolved: fixed by P8, or accepted with
its reason on record. The roadmap line is then "a full access review of who can see what, every finding resolved". The
owner's browser walks of rows 3b, 3c, 4 and 6 and the queue's production order are separate from the wording.

**P9's answer to call 22 (2026-11-19).** The three conditions, checked. (1) **Not yet:** P8's and P8b's fixes are built on
dev, not promoted; migrations 505 and 506 go either side of the promote and 507 before the code. (2) **Met:** each of the
three is not reproduced, and the record shows the requests never reached the server; they leave no finding. (3) **Not
yet:** P9 found one (leftover call 17, ruled "fix it" 2026-11-19), so P9b must be live too. So the roadmap line can read
"a full access review of who can see what, every finding resolved" once P8, P8b and P9b are live on production with 505,
506 and 507. P8c (the pay-link rows on the owner's activity screen) is a ruled follow-on, not a finding, and doesn't hold
the wording. The owner's browser walks and the production order stay separate from it, as above.

## P9b — A failed activity-record line opens an issue (leftover call 17, ruled 2026-11-19; written 2026-11-19 by the P9 chat)

```
Board Ready — leftover call 17 (build, small). Owner ruled 2026-11-19: "Fix it (Recommended)".

THE FINDING (P9, 2026-11-19): writeOrgAudit (lib/org-audit.ts) swallows a failed insert with console.error only, by
design (a log row must never turn a successful change into an error for the person who made it). On production that
line reaches no one, so a missing line in a club's activity record would go unnoticed.

THE FIX
- Keep the swallow: the change and the person's answer are unchanged. Also report the failure to the platform's issue
  feed with the existing helper (captureError in lib/observability/capture.ts), with the action name and org id only,
  NEVER the payload (it holds emails and access maps; the file's own comment says so) and never a thrown error's body.
- Check captureError can't throw or hang the route; if it can, bound it.
- Census first (a helper agent): any other audit or activity writer that swallows a failed insert the same way (inserts
  into org_audit_log outside writeOrgAudit, and the other audit tables' writers). Fix the same-shape ones in the same
  change; report the rest as a list.
- A unit guard: a failed insert reaches the capture, with no payload.

RULES: no schema change; no screen change, so no /docs; /review on the change; /legal only if the issue could carry
anything about a person (it must not). Proof on dev: force one failed insert through a probe (e.g. a made-up org id),
see the issue open in platform admin, then close it. Close-out: PROGRESS row 9b, the sweep report's call 17 line, the
Board Ready board line. No commit without my yes.

DONE LOOKS LIKE
A failed activity-record line opens one issue naming the action and the club, and nothing else changes.
```

## P9c — The other records that never check a line saved (leftover call 18 (a)–(c), ruled 2026-11-19; written 2026-11-19 by the P9b chat)

```
Board Ready — leftover call 18 (build, small). Owner ruled 2026-11-19: "Fix a–c, accept d (Recommended)".

THE FINDING (P9b's census, 2026-11-19): three writers never read their insert's answer, so a failed line vanishes.
- (a) lib/platform-record-opens.ts (~line 40): staff's who-opened-which-record trail; its catch {} logs nothing.
- (b) lib/sent-log.ts takeSentEmailSearch (~line 176): the daily Sent-email search counter. A failed insert means
  the search is not counted, so the daily brake fails OPEN.
- (c) app/api/payments/connect-webhook/route.ts (~line 47) and app/api/payments/connect-account-events/route.ts
  (~line 58): the stripe_connect_events ledger insert and its update calls (processed_at / error / org_id stamps).
(d) was ACCEPTED: the issue feed's foreign key on error_events.org_id (report-unwritten.ts carries the club in the
context instead). Do not build it.

THE FIX
- (a) and (c): read the answer; a failure opens an issue the way call 17 does (lib/observability/report-unwritten.ts;
  widen its RECORDS map with the two tables). Never the row. The webhook's answer to Stripe is unchanged by a ledger
  STAMP failure; decide from the code whether a failed ledger INSERT (the idempotency row) should fail the event so
  Stripe retries (it is the dedup key, unlike an audit line); say which and why in the commit.
- (b): when the count can't be written, refuse the search with the existing "try again" answer (fail closed), and
  report it. Check the screen shows that answer sensibly (no new words unless needed).
- Extend tests/unit/org-audit-failure-reported.test.ts's one-writer census to these tables, and a unit guard for (b)
  failing closed.

RULES: no schema change; /review on the change; /docs only if (b)'s refusal is new words on a screen; /legal none
expected (no person data leaves). Proof on dev: force each failure through a probe (made-up ids), see the issue
open, then close and clean it. Close-out: PROGRESS row 9c, the sweep report's call 18 line, the Board Ready board
line. No commit without my yes.

DONE LOOKS LIKE
None of the three can lose a line silently; the search brake can't fail open; nothing else changes.
```
