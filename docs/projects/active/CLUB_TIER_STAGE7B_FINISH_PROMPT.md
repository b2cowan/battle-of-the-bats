# Club Tier Stage 7b: finish (simplify, review, design, docs, marketing, commit)

> **Written 2026-10-21** at the end of the 7b build session. **Paste this into a new chat on `dev`.** The build is done and proven
> on dev; this session cleans it up, reviews it, runs the design / help / copy passes, and commits it when the owner says. Read
> `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` first: broad reading goes to a helper agent, a helper's summary is a lead not
> evidence, and nothing is committed without the owner's go in THIS chat.

## What 7b is (read these, not this summary, before judging anything)

- The build prompt and its rulings: `docs/projects/active/CLUB_TIER_STAGE7B_BUILD_PROMPT.md`.
- The as-built record: plan `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 7, the "7b BUILT 2026-10-21" paragraph
  (departures, found-and-fixed, found-not-fixed).
- Owner rulings: `memory/design_decisions.md`, entry 2026-10-21 "STAGE 7B" (all-or-none; head coach written AND read live; a
  full division names its spots, no refusal; no invitation for the club's own team; no head coach is no block; **"our team" is
  ONE answer, the database's, on every plan**).
- Walk: Owner QA Ledger §358, page https://claude.ai/artifact/WBd2jFdENXDEM38irnNuuF (source
  `docs/projects/active/CLUB_TIER_STAGE7B_WALK.html`). The owner has not walked it yet.

## The files that are this work (and only these)

**Wholly 7b (new or only touched by 7b):**
- `supabase/migrations/346_a_club_enters_its_own_teams.sql` (applied to DEV; function-only)
- `scripts/club-stage7b-atomicity.sql`, `scripts/check-club-money-atomicity.mjs` (Stage 7b probe + a committed-fixture race)
- `lib/club-own-teams-entry.ts`, `lib/own-team-division-match.ts`, `lib/club-own-tournament-team.ts` (rewritten: the one answer)
- `lib/notify-recipients.ts` (`tournamentTeamAdderUserIds` + a shared `scopedToTournament`)
- `lib/registration-words.ts` (`ADD_OUR_TEAMS_WORDS` appended)
- `app/api/admin/teams/our-teams/route.ts` (new), `app/api/admin/teams/rep-team-link/route.ts` (one refusal regex)
- `app/[orgSlug]/admin/tournaments/registrations/components/AddOurTeamsWindow.tsx` (new)
- `app/[orgSlug]/admin/tournaments/registrations/page.tsx` (every hunk in the working tree is 7b's: verify with `git diff`)
- The payment readers moved onto the one answer: `app/api/admin/tournament-dashboard/route.ts`,
  `app/api/admin/tournaments/[tournamentId]/registrations/{payment-reminders,export,bulk,import/commit}/route.ts`,
  `app/api/admin/check-in/route.ts`, `components/admin/CheckInBoard.tsx`, `app/api/admin/communications/route.ts`,
  `app/api/admin/teams/route.ts` (one `ourTeamIdsAmong` + `willBePaid`), `components/coaches/CoachTournamentRecord.tsx`,
  `lib/needs-attention.ts`, `lib/event-recap-read.ts`, `lib/basic-coach-teams.ts`, `lib/import/tournament-teams-commit.ts`
- Tests: `tests/unit/club-stage7b-add-our-teams.test.ts`, `tests/unit/our-team-one-answer-guard.test.ts`
- DB records: `docs/agents/db/DATA_DICTIONARY.md` (gotchas 5a/5b + gotcha 2 on `rep_team_tournament_registrations`),
  `docs/agents/db/schema-snapshots/SNAPSHOT_MANIFEST.json`, `supabase/migrations/MANUAL_PROD_STEPS.json` (the 346 entry)
- Docs: `docs/projects/active/CLUB_TIER_STAGE7B_BUILD_PROMPT.md`, `CLUB_TIER_STAGE7B_WALK.html`, this file

**⚠ Shared with OTHER sessions' uncommitted edits (commit ONLY 7b's hunks, through a private index):**
- `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css`: only the LAST hunk (the `.aot*` block and
  `.aotHeaderGlyph`, appended at the end) is 7b's; every earlier hunk is another session's.
- `TODO.md` (the "Stage 7b · Add our teams — BUILT" line), `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (the
  "7b BUILT" paragraph), `docs/projects/active/OWNER_QA_LEDGER.md` (§358 only), `memory/design_decisions.md` (the STAGE 7B entry).
- `lib/help-content/tournaments.tsx` already carries another session's uncommitted edits; `/docs` will touch it too.
- Do NOT stage anything else in the tree (public-site, tryout, sponsor invoice, club rail, team-payments-list files are other
  sessions' work). Method: `memory` reference "Partial commit out of shared files" (temp index from HEAD, apply exact hunks,
  CAS `update-ref`); after the commit `git show --stat HEAD` and confirm only 7b's files and hunks landed.

## The order (each step's findings fixed before the next)

1. **`/simplify`** on the 7b files above. Likely targets: `lib/club-own-teams-entry.ts` (the head-coach read is done twice per
   list; `listOurTeamRows` re-reads links the helper already read), the window's two division fields (one per width), the
   rep-group read in the route (a second auth context). Keep the behaviour; keep the census guard green.
2. **`/review`** (`.claude/commands/review.md`), high-risk: a migration + a SECURITY DEFINER function + a trigger body + a new
   API route + a shared helper read by ~15 payment surfaces. Tell it where to look (the file list above; the working tree holds
   other sessions' changes it must ignore). Points worth adversarial attention: the lock order in mig 346 (tournament FOR SHARE →
   advisory → new team rows; the guard takes its team row then the advisory lock) against mig 345's payment functions and the
   link route; the census regex in `our-team-one-answer-guard` (does it catch every "what a team owes" reader?); notify's empty-
   list fallback; a member limited to team groups; the window state when the list refreshes after it opened.
   Re-run after fixes: `npm run check:club-money-atomicity` (DEV; includes the race), `npm run typecheck`, the focused tests.
3. **`/design`** on the BUILT window at 390 and 1440 (it was run on the drawing, not the build). Club fixture `uat-rep-club`,
   tournament "UAT Rep Club Invitational 2026", Teams page → Add our teams; sign-ins are in the walk page. Also the header button
   at both widths and the Teams rows ("Our team", the coach column, "No fee"). The two open walk calls (c1 the "No season
   running" band; c2 the phone's symbol-only button and the window's ←) are the owner's; `/design` may advise, not rule.
   ⚠ A whole-product layout sweep does not run on the dev server; `check:layout --changed` only.
4. **`/docs`**: the Tournaments help article (Add our teams beside "Add team" and "Link to a rep team"; one entry per club team;
   our team owes no fee on every plan, and is left out of reminders, check-in owing and the export's money due) and the coaches'
   hosted-tournament article (how a club team's tournament appears without the coach doing anything; "Add my team" stays the
   portal's). Keywords / searchText too. One spelling everywhere (`npm run check:spelling`).
5. **`/marketing`**: every sentence in `ADD_OUR_TEAMS_WORDS` (lib/registration-words.ts) was flagged for it, plus the bell
   notice "Our team · Added by the club" (our-teams route) and the refusals mig 346 raises (a sentence change there means a new
   migration or an edit to 346 BEFORE it reaches prod, plus the route's `DELIBERATE_REFUSALS` and the probe's expected strings).
6. **Gates:** `npm run verify:changed`. Known non-7b reds at the time of writing: the unit test
   `club-stage6b-screens-guard` "the rail draws it directly under Overview" (another session's uncommitted club-rail edit), and
   `check-schema-parity` (migrations 338/342/345 tables still prod-pending). Report any NEW red; do not re-baseline a check.
7. **Records:** update plan §6 Stage 7 "7b BUILT" with the review/simplify/design results; TODO line; ledger §358 (what changed
   after the build); the project index https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr via ArtifactData (`stages/s7`, a `log`
   row; read first, pin `if_version`); republish the walk page if any step it describes changed (grep every step against the
   code first).
8. **Commit only when the owner says so in this chat**, on `dev`, 7b's files and hunks only (two commits is fine: the build,
   then the records). Message ends with the attribution line the session gives. Migration 346 stays prod-pending; it applies
   to production AFTER 345 and BEFORE the code that calls it (see `MANUAL_PROD_STEPS.json`).

## Not in scope

7c (Email families) and 7d (the coach's Tournaments) get their own prompts. The found-not-fixed items in the plan's 7b paragraph
(the portal's "Add my team" Paid/Unpaid choice, the bulk Mark paid email path, games on the coach's Schedule) are reported, not
built, unless the owner says otherwise.
