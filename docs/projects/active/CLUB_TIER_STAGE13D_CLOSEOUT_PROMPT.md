# Club Tier Stage 13d · close-out: simplify, review, commit Session C, then the one walk

> Written 2026-11-14 at the end of Session C. Paste into a **fresh chat on `dev`** (Sonnet is fine):
> `execute @docs/projects/active/CLUB_TIER_STAGE13D_CLOSEOUT_PROMPT.md`
>
> Context to read first (in this order, only what you need):
> - Build prompt: [CLUB_TIER_STAGE13D_BUILD_PROMPT.md](CLUB_TIER_STAGE13D_BUILD_PROMPT.md) (sections "Session C", "Help, words, layout", "After each session", "The walk").
> - What was built and where it departed: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10, the three 13d entries
>   (Session A 2026-11-13, Session B 2026-11-13, **Session C 2026-11-14**).
> - Drawing (the spec for the walk's words): https://claude.ai/artifact/QgEYgkVT7rJK3bHTvgAHtx, source [CLUB_TIER_STAGE13D_DRAWINGS.html](CLUB_TIER_STAGE13D_DRAWINGS.html).
>
> Standing rules: branch `dev` only; **explicit pathspecs only**; re-check `git rev-parse --abbrev-ref HEAD` is `dev` before every commit;
> `git show --stat HEAD` after; **never push**; ask the owner before each commit. Product-owner voice in every message to the owner.

Four steps, in order. Each one finishes before the next starts.

## Step 1 · `/simplify` on Session C's diff

Session C is **uncommitted**. Its files (and only these):

| File | What Session C did |
|---|---|
| `lib/coach-club-money.ts` | New block at the end: the method list by direction, `resolveRequestMethod`, `requestMethodAsFiled`, `requestMethodLabel`, `CLUB_REQUEST_METHOD_WORDS`, `requestPaidFacts`, `requestPaidOn`; imports `./types` + `./timezone` |
| `app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/route.ts` | POST validates the method through `resolveRequestMethod` |
| `app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]/route.ts` | PATCH does too, reading the stored `payment_method` first |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx` | The question by direction, the "(as filed)" option, the Paid row, the list row's "Paid {date}", the direction-flip clear |
| `components/admin/kit/club/money/RequestWindows.tsx` | Treasurer's label via `requestMethodLabel(r, 'club')` |
| `lib/coach-money-exports.ts`, `lib/club-money-reads.ts` | Print `methodWord(...)` instead of the raw stored value |
| `lib/demo-coach.ts` | Three demo requests store codes (`etransfer`, `cheque`) |
| `tests/unit/club-stage13d-coach-request.test.ts` | New, 14 tests |
| `lib/help-content/coaches.tsx`, `lib/help-content/accounting.tsx` | /docs sync (already done) |

Run `/simplify` scoped to these files. Things it is worth looking at (not conclusions — decide on the code):
- `requestMethodWord` (private in `coach-club-money.ts`) repeats `methodWord` in `lib/club-money-words.ts`. It was kept private so the
  framework-free module doesn't import `club-money-words` (which pulls `club-money-figures` etc.). Merge only if that import is safe (no cycle,
  no heavier client graph); otherwise leave it with its comment.
- `requestPaidFacts` formats money itself; check whether a shared money formatter is already imported by that module's neighbours.
- The panel computes `requestPaidOn(r)` three times on one row; fine or tidy.

Apply what it finds that is real. Re-run `node --import ./tests/ts-resolver.mjs --test tests/unit/club-stage13d-coach-request.test.ts` after.

## Step 2 · `/review` (standard level) on the same files

Lenses worth the review's time:
- **Contract:** a coach's PATCH of an old pending request that sends its old words back unchanged must keep them; a stored code turned to a
  direction that doesn't offer it (`card` on "the club pays us") must be refused; empty stays null. Does any **other** writer of
  `rep_team_payment_requests.payment_method` exist (grep `payment_method` in `app/`, `lib/`, `scripts/`) that now saves something the screens
  call "(as filed)"? The hand-back path (`lib/club-hand-back*.ts`) and Send the changes create requests: check what method they store.
- **Readers:** every place that prints a request's `paymentMethod` / `payment_method` to a person must go through `methodWord` /
  `requestMethodLabel` (the admin Payment requests page and its CSV already did). Session C fixed two; look for a third.
- **Paid row:** only `status === 'approved'` with `paidOn`. Confirm a **reversed** request never shows "Paid" (its `paid_on` may survive the
  reversal) and the list row still reads "Reversed".
- **Phone:** the Paid row and the method field are plain rows in the coach's request window (rule: phone figures are rows, not tiles).

Apply confirmed findings; record known lows in the plan's Session C entry (append, don't rewrite). Re-run the 14 tests and
`NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` (the default heap runs out on this tree), and `npm run check:spelling`.
The full unit suite (`npm test`) had **22 failures before Session C, all in other sessions' files**: confirm none names a Session C file;
do not fix them.

## Step 3 · Commit Session C (ask the owner first)

1. Re-check the branch is `dev`.
2. **Code + help + test, one commit**, explicit pathspecs: the twelve files in the table above (eleven modified + the new test).
   None of them carries another session's edits (checked 2026-11-14), but run `git diff -- <file>` on each and confirm every hunk is Session C's
   (or Step 1/2's) before staging.
3. **The records need care — two of them hold other sessions' uncommitted lines:**
   - `TODO.md` — Session C changed only the 13d line (`Session C (the coach's request) BUILT 2026-11-14 …`). Other sessions have many
     uncommitted hunks in this file. **Do not stage the whole file.** Commit only the 13d line (temp index or `git add -p` equivalent without
     interactive mode — e.g. build the blob from `git show HEAD:TODO.md` with only that line changed, `git update-index --cacheinfo`).
   - `docs/projects/active/CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md` — Session C added the 2026-11-14 entry at the end of §10 (just before
     "## 11."). Another session has 7 uncommitted lines around §10 line ~732 (the §502 result, "Send the bill", money terms). Commit **only** the
     Session C entry the same way.
   - `docs/projects/active/CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PM_BRIEF.md` — only Session C's paragraph is uncommitted; safe to stage whole
     after a `git diff` look.
   - This prompt file (`CLUB_TIER_STAGE13D_CLOSEOUT_PROMPT.md`, new) goes in with the records.
   Then update the plan entry and the TODO line with the commit hash ("committed `<hash>` 2026-11-14"), as a separate small records commit,
   with the same care.
4. `git show --stat HEAD` after each commit; if a foreign file slipped in, `git reset --soft HEAD~1`, unstage it, re-commit.
5. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (or whatever attribution the session's
   system note gives).
6. No migration in Session C. No dev-server restart needed for Session C alone (only a test file was added), **but Sessions A and B added files and
   a restart is still owed** — do it before the walk (stop the server, then `npm run dev`; verify
   `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200).

## Step 4 · The walk (one, for all of 13d)

**Purpose (one only):** each hand-off reaches the person it is for, and a person who can't act is not shown a door.
Build prompt "The walk" section is the scope; this step is how.

**Rules (binding, owner):** a checkable Artifact with a paste-back; **20–50 boxes, one action per step**; owner calls are never in the box
count; desk and phone; counts come from the fixture, **never** from a prompt or the drawing; walk to a send and stop (R3, 2026-11-06); a
fresh Harbourtown copy. Load the `artifact-design` skill (or `Artifact` quickstart, intent `other`) before writing the page; run `/design`
on it before hand-off.

1. **Ledger section number:** read `docs/projects/active/OWNER_QA_LEDGER.md` and take the next free `§` (the highest on 2026-11-14 was §527 —
   re-read, another session may have taken more). Never sort or renumber.
2. **The fixture — mirror the 13c walk (§502):** `.probe/nav-journeys/seed.mjs <slug>` with `NAVJ_BASE=http://localhost:3000` makes a fresh
   Harbourtown copy with owner / admin / admin2 (no Accounting) / leagueadmin / registrar / treasurer, then `.probe/nav-journeys/fx-13c.mjs
   --slug=<slug>` added that walk's state. Read both, then write `fx-13d.mjs` beside them for a slug like `navj-club-13d` adding:
   - a house league season with **no time given**, and a second one **already asking** (asked > 7 days ago, so "Asked …" and the re-ask both show);
     a schedule ready to **Finalize and send** that gives house league time (for the league admin's bell);
   - a **draft schedule with a bill** on a budget line (and one in review), so "Being billed (draft)", the Fair shares window, the New
     allocation warning and the Bill window's allocation notice all have something to show;
   - a **club tournament whose book has money** (and nothing for the admin without Accounting);
   - **a coach** on one team (check whether the seed already makes one; if not, add one with Money write) and **two pending requests**, one each
     direction, with a method code saved, plus **one old request filed with words** ("E-Transfer") to show "Payment method (as filed)".
   Read the counts back from the copy (a `fx-13d-check.mjs`) and put them in the walk. Record the sign-in line in the ledger like §502's.
3. **The walk's parts, by role** (from the build prompt; trim to the box budget, one action per box):
   - League admin: the no-time line and **Ask for time** (desk + phone, full-width button); "Asked {date}".
   - Owner: the bell for the ask; This morning's "House league asks for time" card and its door; give time (Finalize and send) → the card clears.
   - League admin: the "club gave house league time" bell and its one door; the season line changes.
   - Admin without Accounting: sees the ask card (giving time is not money); no tournament "In the club's book" row.
   - Treasurer: the line's "Being billed (draft)", the read-only Fair shares (no Schedules link), the New allocation warning (and it still saves),
     "Owed to the club" and the door under the books.
   - Owner or admin with Accounting: the Fair shares window's "Open the schedule"; the Bill window's "Accounting already bills this line";
     the tournament's "In the club's book".
   - Registrar: none of the above doors.
   - Coach (Coaches Portal): **"How should the club pay you?"** / **"How are you paying the club?"** (Card only on the second); submit one.
   - Treasurer: the request reads "How they'd like to be paid" / "How it's coming"; **Approve opens with the method already filled in**; the old
     request reads "Payment method (as filed)". Approve one.
   - Coach: the row reads **"Paid {date}"**; the window shows "Paid · $X by {method} on {date}" and the reference. Phone: plain rows.
4. Publish, add the ledger section (status "walk published 2026-11-14, owner walk owed", the artifact link, the sign-in line, the counts),
   point the plan's §10 and the TODO 13d line at it, and commit those records (explicit pathspecs; the TODO/plan care from Step 3 applies).
5. Still owed after the walk, recorded in the plan: `check:layout --changed` on the touched screens (it can't run on dev while another
   session's `app/globals.css` edit widens it to a whole sweep, and `uat-club-org` has finished onboarding — run it on staging or with the
   walk's copy); the fixture teardown after the owner walks it (§502 pattern: remove the org and its accounts, read back).

## Report back to the owner

Product-owner voice: what the reviews changed (if anything), the commit(s) by hash, the walk's link and box count, what is still owed.
