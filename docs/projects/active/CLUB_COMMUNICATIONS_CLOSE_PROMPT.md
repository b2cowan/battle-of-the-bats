# Club Communications · Stage 1 · the Close (continue prompt)

> Paste: `execute the Close in @docs/projects/active/CLUB_COMMUNICATIONS_CLOSE_PROMPT.md`
> Written 2026-11-22 for a fresh session. Plan: `CLUB_COMMUNICATIONS_PLAN.md` §3 Stage 1. Original Close checklist: the "Close"
> section of `CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md`. Legal spec: `docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md`.
> Model: Opus. Branch: `dev` (check `git rev-parse --abbrev-ref HEAD` before any commit).

> **Executed 2026-11-22:** steps 1 to 6 done (the result of each is the "Close" item in `CLUB_COMMUNICATIONS_PLAN.md` §3 Stage 1). The commit waits for the owner's yes; the sweep waits for renewed test sign-ins; the finish rules and the owner calls below are his.

## Where things stand

Sessions 1, 2 and 3 are committed (`95cac82d6`, `817c95523`, `684ee0b38`, `cc99f58e9`). Walk A §537 passed 35/35 and Walk B §547
passed 47/47 (owner paste 2026-11-20 and 2026-11-21; both recorded in the Owner QA Ledger, the plan header, the board line and
memory). The `navj-club-comms` fixture and its 14 accounts were torn down on dev 2026-11-21 (script
`.probe/club-emails/teardown.mjs`; the club is gone, so a new walk needs a fresh seed).

**Done in the Close so far (2026-11-22), all UNCOMMITTED in the working tree:**

1. `/simplify` over the three sessions: reuse, simplification, efficiency and altitude reviewers; the safe subset applied (seat
   decided once, parallel reads in the options and finish paths, `pluralize`/`BOARD_ROLES`/`inThisYear` reused, unused exports
   removed, the dead `/api/admin/club-emails/sent` route deleted).
2. `/review` at high over the whole feature, five lenses. No Critical or High, no cross-club leak, RLS and grants on the new
   tables correct. Confirmed defects were fixed:
   - `reaches_rep` is now `kind === 'coaches' && people.some(p => p.rep)` (a pick of dual-role coaches used to be readable by a
     league admin). Data dictionary corrected.
   - Migration `520_club_email_claim_refuses_a_send_still_going.sql` (dev only): the claim also refuses (`just_sent`) while a send
     of the same group is `sending` and last touched under 15 minutes ago. Entry added to `MANUAL_PROD_STEPS.json` (pending).
   - Finish with nobody left to send to is allowed ("Mark it finished"); the words read now happens before the take.
   - `recipientOf` chunked; "just sent" clears on the head-coaches toggle and on subject/message edits; a stale count after
     Send is cancelled; a 409 on finish re-reads the record; the layout sweep's two old entries now point at Communications.
   - Tests green (198/198 across the four related files), lint, spelling and dictionary checks clean. Typecheck: only the 2
     known errors in `tests/unit/layout-run-journal.test.ts` (another session's).

**Uncommitted files of this work** (stage explicit pathspecs only; three of them also hold OTHER sessions' hunks, so stage those
partially: `docs/agents/db/DATA_DICTIONARY.md`, `scripts/layout-screens.mjs`, `supabase/migrations/MANUAL_PROD_STEPS.json`):
`lib/club-group-email.ts`, `lib/club-group-email-{read,words,rules,people}.ts`, `lib/club-communications-{auth,place}.ts`,
`lib/families-words.ts`, `components/admin/kit/club/communications/{CommunicationsScreen,EmailColleaguesWindow,ColleagueRecord}.tsx`,
`components/admin/kit/club/families/{EmailFamiliesWindow,EmailLog}.tsx`, `tests/unit/club-group-email-guard.test.ts`,
`supabase/migrations/520_*.sql`, the dictionary and snapshot files, and the deleted `app/api/admin/club-emails/sent/route.ts`.
Do not commit until the owner says so (he has not yet); when he does, run `git show --stat HEAD` afterwards and confirm only
these files landed.

## What is left (do in this order; one result line to the owner after each)

1. **`/dba`** on migrations 492, 493 and 520 (RLS posture, the claim function, the nightly sweep's 60 s statement timeout: a
   backlog could roll back all four stages every night with no alert; consider bounding each stage). Report only; any change to
   the cron job or a watched path (`WATCHED_PATHS` in `scripts/check-agent-automation.mjs`) is its own commit and only if the
   owner asks.
2. **`/marketing`** on the one words block (`lib/club-group-email-words.ts`: PLACE, WINDOW, RECORD, SAY, W): the lede, the empty
   states, the menu choices and their second lines, the "not yours" lines, the member window's line for the switch, the
   readers line and the board line, **inside the limits legal checklist §2b sets**. Three strings are NEW since Walk B and have
   had no words pass: **"Mark it finished"**, **"Everyone it was sent to has it. This closes the email and sends nothing."**,
   **"Marked as finished."** Also decide the wording of a finish that times out (it still reads as "couldn't load", though the
   finish may be running). One spelling everywhere (`npm run check:spelling`; the clock is "8:00 a.m." via `formatTime()`).
3. **`/legal` as-built**: the finished code against checklist §2 (route table, JSON tests, guard samples, the three window
   lines); confirm the privacy draft sentences match what was built. Specific questions to put to it:
   - Is `reaches_rep` meant as "reached at least one rep staff member" (what the column comment and the new code say) so that a
     league admin never reads a pick that included a dual-role coach? (Four reviewers read it that way.)
   - Finishing a stopped email never sends the "copy to the club's inbox" even when the sender ticked it, and the record keeps
     saying the copy was asked for. Allowed, or fix?
   - A narrower seat finishing a mixed pick marks the people it cannot see as `failed` ("no longer in the group") and the row
     becomes done, so they never get it. Should such a finish refuse (`not_yours`) or leave them pending? (A rule, not a patch.)
   - Reply-To on a finish in "Replies come to me" mode is the original sender's address even if they have since left.
4. **`/docs`**: the emailing article moves under Communications and gains coaches and the board; the role table and the
   house-league "who can do what" are corrected; a Communications help topic. It must not say admins open household records,
   call board email formal notice, or say board mail can be turned off (checklist §4). Help content lives in
   `lib/help-content/*.tsx`; keywords and `searchText` follow the one-spelling rule.
5. **Final gate**: `npm run check:spelling`, `npm run verify:changed` (failures in other sessions' files are theirs: report,
   do not fix), `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`, the focused suites, dev-server restart (new files and
   shared modules changed; stop the server BEFORE deleting `.next`), then `npm run check:layout -- --changed` on the dev server
   (the two new Communications screens have never been swept).
6. **Records**: plan §3 Stage 1 ticked with commit hashes; the PM brief's state; the `TODO.md` line (one line, no status); the
   board line in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (same commit as the work); `BOARD_READY_PLAN.md` Stage 2 and
   its prompts index row; the Owner QA Ledger (a closing walk section only if one is published; next free § at the time);
   Claude memory `project_club_communications_hub.md` and the `MEMORY.md` line. `/demos` is at its release cycle, not here.
7. **Tell the owner the release gate in one line**: the clock, the nightly job and the privacy sentences, and what the next
   promote carries (migrations 492, 493 and 520 are dev-only and must go to prod before the code; see `MANUAL_PROD_STEPS.json`).

## Owner calls still open (carry forward; do NOT decide)

- **Does the nightly clean-up also apply to old family emails?** Its first run blanks the words of every existing family email
  older than 12 months and deletes family names older than 24 months, for every club. Old season records would read "Its words
  were deleted" and old stopped emails could not be finished. Ruled for new Communications only, or for history too? If not, it
  needs a start date.
- **Does the Communications switch cover every screen?** Switch off means "no group email from any screen", but the practice
  reminder (`practice-tell`) and team-change notice (`team-changes`) routes still email families. Make them obey the switch, or
  reword the ruling to "typed group email".
- **Count admins saved with Communications switched off** (`capabilities->'module_communications' = 'false'`) on production
  before the promote; the toggle gated nothing before this build and now removes their group email. Assistant sessions read
  production only as counts, so the owner may need to run this.
- Smaller, unruled: skipped mail (no mail key) is recorded as sent on a staging copy; the entitlement description in
  `lib/plan-module-entitlements.ts` still calls Communications "operational email"; the client bundle carries the mail-rendering
  code through `club-group-email-words.ts`; an owner/admin seat ignores a member's own Rep Teams/House League module grant.

## Walk to publish (only on the owner's command)

If he asks for a closing walk (one purpose: the changes since Walk B), cover: Mark it finished on a stopped email with nobody
missed; Send held while a send is still going and returning when the group or words change; a pick of dual-role coaches that a
league admin cannot open; the Communications and "To families" window layout at desk and phone. Needs a fresh fixture
(the old one is torn down). Publish as a checkable Artifact; name exact logins; 20 to 50 boxes, one action per step.

## Rules for this session

- Report in product-owner voice; lead with what the user sees. Disagree out loud before doing work you think is wrong.
- Never change hooks, `.claude/settings*.json`, the cron jobs or the database checks unless the owner asked in this conversation.
- Never touch production; dev only; no `--prod`. Assistant sessions read production as counts and schema only.
- Stage explicit pathspecs; no Co-Authored-By footer (owner preference recorded in memory); no commit or push without his yes.
- Broad reading goes to helper agents; open the cited lines yourself before building on a helper's claim.
