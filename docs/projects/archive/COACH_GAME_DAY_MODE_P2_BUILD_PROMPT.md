# Game-Day Mode — Phase 2 Build Prompt ("moments")

**Status:** MOCKUP GATE NOT CLEARED — drawing and signing off the P2 frames is this session's
FIRST job, and it may start immediately (mockups touch no code, so this runs safely beside the
Club Shared Book build and owner QA). **Code is gated — see Gate 2.**

**Parent plan:** `COACH_GAME_DAY_MODE_PLAN.md` — §3.7 (moments), §4 (the P2 migration), §7 P2
scope, §9 Q3 (the recap-nudge question, still open) bind. **P1 is COMMITTED dev `bcd695a3`**
(2026-08-04, post /simplify + /review + /docs); owner QA = `OWNER_QA_LEDGER.md` §1.15.

---

## Gate 1 — Mockups (do this first, present in-conversation, explicit owner OK)

Extend the **SAME artifact** — "Game-Day Mode — bench console",
`46d0fa8b-f009-47b2-b62c-0b52f54bf6fe` (republish same URL; rev 3 is the signed-off P1 spec —
do not alter P1 frames except where P2 genuinely changes them). Draw:

1. **The Note button** joining the console footer (plan §3.2 always listed it for P2) — and
   what the footer looks like with it present at ≤640.
2. **The capture sheet:** one line (≤280), an OPTIONAL player tag, save — and the
   "Saved — add another?" idiom (the scouting book's one-sitting pattern). Quiet sheet, never
   a modal, nothing re-prompts.
3. **The end-game wrap with tonight's moments** listed (and the wrap without any — absent,
   not apologized for).
4. **The recap-composer handoff:** the player's recap composer offering that game's moments
   (their tagged ones) as pickable material.
5. **Season Wrapped ingestion** — the minimal honest slot (plan says "surfaced in Wrapped";
   draw the smallest true version, don't invent a new Wrapped section without flagging it).

Present with the sign-off set **one capability question** (the plan is silent): WHO may log a
moment? Recommendation: any console DRIVE grant (`attendance` OR `lineups` OR
`scheduleManage`) — not bare `schedule`, because the Helper's console is read-only by the
§1.15 ruling. Owner may also re-rule the helper board there; inherit whatever §1.15 QA decides.

## Gate 2 — Sequencing (HARD, all three before any code)

1. **Owner QA §1.15 has a verdict** — especially the helper-board deviation question; P2's
   surfaces inherit it.
2. **The Club Shared Book's migration has LANDED on dev.** ONE migration-writing session at a
   time — take the next free number from `supabase/migrations/` at write time, never
   pre-claim one.
3. **Never restart the dev server while owner QA is in progress** — coordinate
   in-conversation before any restart.

## Scope (plan §7 P2)

Moments table + API + capture UI + surfacing in the wrap, the recap composer, and Wrapped.
Explicitly OUT: fairness/playing-time polish (P3 — note its name is now "playing-time
polish" per the 2026-08-04 vocabulary ruling), batting-order edits, wake lock.

## Constraints that bind (do not re-litigate)

- **The D4 test, stated in the plan:** moments are optional flavor and NEVER feed analytics,
  lineups, attendance, or any coverage surface — a half-used log must poison nothing. Add a
  unit test asserting analytics output is IDENTICAL with and without moments present.
- **Append-only:** no UPDATE path at the app layer; DELETE allowed (a coach removes a
  mistake). ≤280 chars app-enforced. `happened_at` defaults to now.
- **No notifications of any kind** — moments never touch `notify()` or the family layer. The
  one-notification-at-End-game promise is untouchable.
- **Live-season instrument:** the moments routes ride `resolveLiveCoachTeamContext` (the P1
  route is the template — never hand-copy the auth chain); they join NEITHER
  `APPROVED_ARCHIVE_DOORS` nor `APPROVED_SEASON_AWARE_ROUTES`; the write-guard contract stays
  green WITHOUT list edits. Event must be a game type belonging to the active year.
- **Migration = dictionary = snapshots, same unit of work** (`rep_team_game_moments`, plan §4;
  `npm run check:dictionary` enforces). Apply to dev; it will be DEV-ONLY/PROD-PENDING —
  say so in the ledger.
- Practice-run bans carry over (no gestures, no sound, no auto-advance); tokens only;
  sport-neutral vocabulary via the Sport Pack; playing-time vocabulary ruling applies.
- Read payload: extend the existing aggregated game-console read rather than adding a second
  read route; per-zone data stays gated at the SOURCE (the §1.15 review's rule — `can` flags
  gate affordances, never data).

## Shared working copy (unchanged rules, learned the hard way 2026-08-04)

- Other sessions' uncommitted hunks live in shared files (help content, strategy log
  especially). Commit with explicit pathspecs only, `:(literal)` for bracketed dirs,
  hunk-level splitting where a shared file mixes sessions (see `bcd695a3`'s split precedent),
  per-action owner OK.
- NEVER round-trip a source file through PowerShell Get-Content/Set-Content (ANSI read →
  whole-file mojibake; memory: ps51-encoding-roundtrip). Edit tool or bash only.

## Verification bar (match P1)

- Unit: moment validation (length/tag/game-type), capability gate, append-only contract
  (no update path), the D4-independence test above, Wrapped/recap ingestion selection rules.
- Existing mirrored-game 409 + season-write-guard + P1's 54 game-day tests stay green.
- `npm run typecheck` · full `npm test` · `npm run verify:changed`.
- Post-build: offer `/simplify`, then `/review` (HIGH-RISK: a new write route + this
  feature's first migration), then `/docs` (the game-day guide section gains moments).
- New `OWNER_QA_LEDGER.md` §1.16 with a phone-first script (capture at the bench incl.
  save-and-another, tag/untagged, delete a mistake, wrap shows tonight's moments, recap
  composer offers them, Wrapped slot, helper/assistant absence per capability ruling,
  archived season untouched, and — critically — analytics/playing-time outputs unchanged).
- Dev-server restart rule before owner browser QA (new files + migration).
