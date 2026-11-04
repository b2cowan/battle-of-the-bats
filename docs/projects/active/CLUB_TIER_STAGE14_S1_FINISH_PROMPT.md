# Club Tier Stage 14 · S1 (the season window): finish it — simplify, review, docs, commit, walk

> **Written 2026-11-04** at the end of the S1 build session. Paste
> `execute @docs/projects/active/CLUB_TIER_STAGE14_S1_FINISH_PROMPT.md` into a new chat on `dev`.
> **The owner asked for this whole run, including the commit** (2026-11-04), so commit without asking again — but stage
> explicit paths only and commit only this session's hunks. Run the steps in order; each later step works on the result of
> the one before. Product-owner voice in every message to the owner.
>
> **Read first:** the S1 entry in the **Progress** block of `docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md` (what
> landed, the seven defaults taken, the checks and their known non-S1 failures), then that prompt's "Decisions already
> made" 1 and 14. The drawing is tab 2 of https://claude.ai/artifact/YRZjgsXZwkeNPnGmpPAapN (source
> `docs/projects/active/CLUB_TIER_STAGE14_DRAWINGS.html`, lines ~337–464). Leads, not evidence: open the code before acting.

## The change (all uncommitted on 2026-11-04; verify with `git status` / `git diff`)

Code and tests (S1 owns the whole file unless noted):
- `lib/season-roll-path.ts` (**new**, the pure words + rules module both windows use)
- `lib/rep-season-rollover.ts` (the roll takes `path` / `carryPlayerIds` / `division` / `currentDivision`; new `seasonWindowFacts`)
- `lib/club-season-words.ts` (`startLead` uses `theSeason`; `rosterCarryDetail` + `START_CARRIES.roster` removed)
- `components/coaches/StartNextSeasonModal.tsx`, `components/admin/kit/club/SeasonDialogs.tsx`
- `components/admin/kit/club/RepKit.module.css`, `app/[orgSlug]/coaches/coaches.module.css` (the `.roll*` blocks only)
- `app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts`, `app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts`
- `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx` and `…/tryouts/page.tsx` (only the `rosterCount` prop removals)
- `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` (the Start-next-season row's description only)
- `scripts/layout-screens.mjs` (screen `admin-rep-team-start-season-players`, helper `openSeasonWindowMovingUp`, a note on
  why there is no coach screen); `scripts/.layout-baseline.json` (three `admin-rep-team-start-season-players|…|tap-floor`
  entries only)
- `tests/unit/season-roll-path.test.ts` (**new**); edits in `club-stage4c2-admin-side.test.ts`, `coach-call-ups-guard.test.ts`,
  `club-stage2-screens-guard.test.ts`

Records (**shared files, other sessions have hunks in them: commit only S1's hunks**): `TODO.md` (the Stage 14 line),
`docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (the 14a line), `CLUB_TIER_STAGE14_BUILD_PROMPT.md`
(the S1 Progress entry), this file. Use the partial-commit method in the memory note "Partial commit out of shared files"
(a temporary index plus exact edits); `git add -p` is interactive and not available.

## Step 1 · `/simplify`

Run it on the files above. What to look at: `season-roll-path.ts` against `born-years.ts` / `club-season-words.ts` (is
anything duplicated, or worded twice?); the two windows' near-identical question + tick-list blocks (the coach one uses
`coaches.module.css`, the club one `RepKit.module.css`; they are two portals with two kits, so do NOT merge them into a
shared component unless that is clearly simpler); the coach window's three `useEffect` reads. Don't change any ruled words.
Re-run `node --import ./tests/ts-resolver.mjs --test tests/unit/season-roll-path.test.ts tests/unit/club-stage2-screens-guard.test.ts tests/unit/club-stage4c2-admin-side.test.ts tests/unit/coach-call-ups-guard.test.ts tests/unit/club-stage2-server-guard.test.ts`
after it.

## Step 2 · `/review` (high-risk: the shared roll + both season routes)

The questions to aim it at:
- **The roll's pre-check:** the roster is read and the ticks are checked BEFORE the season insert. Can a roll still write a
  half state? Is the 409 `players_changed` right when a player was deleted while the window was open?
- **The division write:** path (a) only, never the team's name; the coach route admits a standalone head coach only
  (`mayManageSeasons`); the club route admits the club's owner/admin. Is a stale `currentDivision` a problem?
- **The GET preflights** now return `roll` (names + numbers of the closing season's players). Is anything private sent? Is
  a club admin limited by their team-group scope (`resolveClubTeam`)? Does the coach GET's history-guard posture hold
  (`tests/unit/coach-history-endpoint-guard.test.ts`; it reads the working season, no `?year=`)?
- **Birth years:** path (a) leaves the pair and `born_years_carried = false`; path (b) moves it. Check the club's Team
  details note still reads right after an (a) roll.
- **Fees carry** still maps only carried players (`playerIdMap`).
Apply real findings. Re-run the step-1 tests plus `npm run typecheck`. **Known non-S1 failures; don't chase them:**
`tests/unit/billing-location-evidence.test.ts` (typecheck) and about 23 `npm test` failures in public tournament Stage 8,
billing, Stripe mode and the support console. The `verify:changed` wrapper's ESLint run fails on a config/plugin error, so
lint S1's files directly with `npx eslint <files>`.

## Step 3 · `/docs`

The words that are now false (list them for `/docs`; don't hand-edit): `lib/help-content/coaches.tsx`
`recipe-start-next-season` (~6141–6167: "your roster comes with you", "active roster carries forward automatically"),
`premium-team-settings` (~5995), `premium-season-end` and `premium` if they repeat it; `lib/help-content/rep-teams.tsx`
`recipe-seasons` (~115). The help should describe the question and both paths. It must **not** promise "bring back a past
player" (S3, held) or "medical forms carry" (S4, held). **Not `/docs`'s:** `lib/walkthrough-content.ts:215` (the pre-sales
walkthrough says "it carries the active roster"). Name it to the owner as a `/marketing` item, don't edit it.

## Step 4 · Commit (owner-authorised for this run)

`git rev-parse --abbrev-ref HEAD` must say `dev`. Two commits:
1. **Code + tests + layout + help**: "Club Tier Stage 14a: Start next season asks what the team is doing — the same players
   moving up (a tick list, the division up, birth years stay) or a new group (nobody unless brought anyway, birth years +1)".
   Body: both windows, the roll's pre-check, the 'Season season' fix, the held clauses (S3/S4), no migration.
2. **Record**: the S1 Progress entry ("committed `<hash>` 2026-11-04"), the plan's 14a line, the TODO line (S1 committed;
   walk §… owed; S2 next), the ledger § from step 5. (Or fold the record into one commit after step 5.)
After each: `git show --stat HEAD`. Only S1's paths, and in the shared files only S1's hunks (`git show HEAD -- TODO.md`).
If a foreign file slipped in: `git reset --soft HEAD~1`, unstage it, commit again. **Don't push** unless the owner says so.

## Step 5 · The owner walk, a checkable Artifact (one purpose: "the season window asks")

Follow the house pattern of §450 (`OWNER_QA_LEDGER.md` ~27643 and its page `HOUSE_LEAGUE_STAGE9F2_WALK.html`): a
checkable page with paste-back, steps in lettered parts, a result box. Load `artifact-design` first. **Next free ledger §:**
check; it was **452** on 2026-11-04. Source `docs/projects/active/CLUB_TIER_STAGE14_S1_WALK.html`, published as an Artifact,
plus a ledger § entry (built/committed line, walk link, parts with counts, "Known before the walk", owner calls open).

**A fixture first** (dev only, re-runnable, `--reset`; model `.probe/9f2-walk/fixture.mjs`), because a roll can't be undone
and the walk rolls twice per portal:
- **A standalone Coaches Portal team** (a Premium team workspace whose head coach is a walk sign-in) on a live "2026
  Season", division **"11U AAA"**, about 14 players: 12 active (with numbers), 1 **inactive**, 1 **call-up**. Two copies
  (one per path), or `--reset` between parts.
- **A club team** in a throwaway club (owner sign-in) with the same roster shape, division "11U AAA" and birth years
  **2015–2016**. Two copies, plus one with a division of **"Mosquito"** and **no birth years**.
- Prove the numbers against the real routes before writing them (as §450's `look.mjs` did).

**Parts:**
- **A.** Both windows open with nothing chosen; Start greyed out with "Choose what the team is doing."
- **B.** The coach's path (a): the tick list (12 of 13 coming; inactive at the bottom, unticked; no call-up), All / None,
  the division box "12U AAA" with its hint, the start.
- **C.** The coach's path (b): the box off, the start, an empty roster.
- **D.** The success view's roster line on each path: names who stayed; no "bring back" clause yet (held for S3).
- **E.** After the roll: the new season's roster, the team's division, the birth years (club team: (a) stays 2015–2016,
  (b) moves to 2016–2017 with the Team details note), the old season's one page, a call-up NOT carried.
- **F.** The club's window, same words, inline list; "Mosquito"/no-years team: the box shows "Mosquito" and the cards read
  without birth years.
- **G.** The first line reads "This closes the 2026 Season."; the old goals-offer bullet is gone; Team settings' row text.
- **H.** On a phone (390): the full-screen sheet, the list scrolling inside it, All / None reachable, the greyed-out
  reason in the foot. **The coach window has no automated layout screen** (no standalone fixture for the sweep), so this
  part measures it by eye.

**Owner calls to put on the page** (the seven "Defaults taken" in the S1 Progress entry): the held S3/S4 clauses; no
"Inactive since" line; the dropped "The list scrolls."; the club's Division box; the birth-years box coach-only; a ticked
inactive player returns active.

**Before handing off:** restart the dev server if this session added files or changed shared modules (stop, clear `.next`,
`npm run dev` with network access; check `/platform-admin/login?next=%2Fplatform-admin` returns 200 and the log has no
`EACCES`). Then give the owner the walk link, what changed since the build (review fixes), the `/marketing` item, and S2
(the child record, a migration) as the next session.
