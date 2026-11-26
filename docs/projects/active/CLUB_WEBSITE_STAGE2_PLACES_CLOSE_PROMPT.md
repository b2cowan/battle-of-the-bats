# Club Website Enhancements — Stage 2 · Session 2D close-out prompt (simplify, review, design, walk, commit)

> Written 2026-11-26 by the 2D build session, at the owner's ask ("give me the prompt for simplify, review, design,
> publish the walk then commit"). **One session**, pasted into a fresh chat (`/clear` first), on Opus:
> *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE2_PLACES_CLOSE_PROMPT.md"*
>
> The build: [CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md). The drawing (the
> spec): [CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html](CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html),
> https://claude.ai/artifact/6DBZd4dZaLwLMBnJA4TYps. Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` §7 (M1–M8, D1, and the
> "Session 2D BUILT" entry under D1, which records what the owner said yes to before code).
>
> **The owner's word to commit is given for this session** ("… publish the walk then commit"), for THIS session's lines
> only, once the passes below are done and their findings applied. It does not extend to anything else in the tree.

## Where it stands (re-check each line: other sessions share this working copy and commit daily)

- **Built, not committed.** Mig 549 **applied to dev 2026-11-26** at the owner's word, twice, read back, the closure
  proof `scripts/club-website-stage2-closure-check.sql` 35 of 35 on the applied schema; snapshots refreshed; the dev
  server restarted after it. `MANUAL_PROD_STEPS.json` carries 549 (pending on prod; ORDER after 539, before the promote).
- **Checks run:** the closure tests (8 files, 221 pass), `tsc --noEmit` clean (needs `NODE_OPTIONS=--max-old-space-size=8192`;
  `npm run typecheck` ran out of heap). `npm run verify:changed` stops at `npm test`: ~40 failures, **none in this work**
  (other sessions' uncommitted files: billing words, support console, onboarding, sponsorships…); run its later scripts
  one by one — every one that names this work passes. The focused ESLint step is broken by config ("could not find plugin
  react-hooks"), not by this change: say so, don't fix it here.
- **/legal ran** (verdict appended to `docs/agents/legal/CLUB_WEBSITE_STAGE2_CLOSE_A_PLACE_REVIEW.md`): pass, with one
  change APPLIED — the last reopen over a no-diamond game says "Diamonds at Lions Park reopened" / "reopened the
  diamonds at Lions Park that were closed", never "Lions Park reopened". Its two older notes (the nameless-sender line;
  repNote naming other coaches) are 2B's, not this session's: leave them as recorded.
- **Open owner call, on the board** (`youOwe`): two SEPARATE presses on two diamonds of one park cover a no-diamond game
  only if it is ticked again in the second. Not yours to decide; don't change it.
- **Found in the build:** `leagueClosureReasons` has no caller, so D1's words have no house league surface. Not a defect
  to fix here (it predates 2D); /review may say whether the dead read should go.

## This session's files (commit ONLY these lines)

Wholly this session's: `supabase/migrations/549_a_press_closes_several_diamonds_of_a_park.sql`,
`scripts/club-website-stage2-closure-check.sql` (T16), `lib/place-closures.ts`, `lib/place-closures-server.ts`,
`lib/place-closure-window.ts`, `lib/place-closure-window-server.ts`, `lib/place-closure-mail.ts`,
`lib/place-closure-mail-words.ts`, `app/api/admin/org/place-closures/[closureId]/route.ts`,
`components/admin/kit/club/places/{ClosePlaceWindow.tsx,ReopenPlaceWindow.tsx,TickPicker.tsx,ClosePlace.module.css}`,
`tests/unit/{place-closure-several,place-closure-window,place-closures-guard,place-closure-window-route}.test.ts`,
`docs/projects/active/CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md`, `CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html`, this file.

**Shared — THIS session's hunks only** (each also holds other sessions' uncommitted edits; commit by private index,
`reference_partial_commit_shared_tree.md`, never `git add -A` or a whole file): `lib/club-notice.ts` (`stripLinesShown`,
`closureMoreSentence`), `components/admin/kit/club/ClubHubKit.tsx` (Places closed counts parks), `lib/help-content/org.tsx`
(the Close a place topic), `house-league.tsx` (one step), `coaches.tsx` (one sentence), `tests/unit/admin-overlay-guard.test.ts`
(the TickPicker line), `docs/agents/db/DATA_DICTIONARY.md` (three closure sentences), `supabase/migrations/MANUAL_PROD_STEPS.json`
(the 549 entry), `docs/projects/active/CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (the 2D entry under D1), `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`
(club-website's `next` and one `youOwe` line), `memory/design_decisions.md` (the 2026-11-26 multi-pick entry),
`docs/agents/legal/CLUB_WEBSITE_STAGE2_CLOSE_A_PLACE_REVIEW.md` (the 2D section), the schema snapshots and
`memory/reference_db_schema.md` (refreshed for 549 — check the diff is only that). Read each `git diff` and take only the
hunks this prompt names.

## Do, in order

1. **`/simplify`** on this session's diff (it added `TickPicker`, a new form-field pattern, and grouping helpers beside
   older one-place words). Apply what it finds; re-run the closure tests.
2. **`/review`** (the migration, the press's server half, the Reopen route, the coach email claims). Apply its confirmed
   findings; anything that changes 549 is a NEW edit to 549 re-applied to dev only on the owner's word — ask.
3. **`/design`** against the drawing (tabs 1–6; computer 640px window, phone 390px): the Places field, the chosen rows,
   the diamond field, the phone drawers (SheetFrame `overWindow`), the empty state, the park on each game row. Apply.
4. **The walk Artifact** (Owner QA Ledger **§576**, the next free section — check): 20–50 boxes, one action per step,
   computer and phone, paste-back, exact logins at `http://localhost:3000`, club **Kestrel Bay** (`/kestrel-bay`): house
   league admin `league@kestrel-bay.example.test`, club president `president@kestrel-bay.example.test`, the U13 Ospreys'
   head coach `rep.coach@kestrel-bay.example.test`, password `UATPassword2026!`; a private window for public pages.
   Cover: two of three parks from the schedule (one ✕); two of three diamonds with a game left on; a rep game with no
   diamond recorded (D1: two diamonds closed, reopen one — still marked, no email; reopen the other — cleared, one email
   in /legal's words); nothing chosen (Venue library); All our fields and removing it; one email per family; the Overview
   count; the phone drawers and Done. Say how to set up a no-diamond rep game first (the coach edits the game's place).
   Read §573's walk for the house style and setup, and grep every walk for steps this change made wrong (the old Place
   dropdown): fix them in the same unit of work.
5. **Records:** the plan's 2D entry (passes run, walk §576 published), the board line, the ledger section.
6. **Commit** (the owner's word above): this session's files and hunks only, its own commit; `git show --stat HEAD` to
   confirm. Message: what the admin can now do, mig 549 on dev, the walk, the owner's quote. No push.
7. Hand-off: the walk link, what each pass changed, the open owner call. Offer `/docs` only if a pass changed a flow.

## Not in scope

Combining the strip's lines per park; raising the limit of 10; reopening several at once; the two-separate-presses
behaviour (the owner's call); the 2B /legal notes; other sessions' failing tests.
