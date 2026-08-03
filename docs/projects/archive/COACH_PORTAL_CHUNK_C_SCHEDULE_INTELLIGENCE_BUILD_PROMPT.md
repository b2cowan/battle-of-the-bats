# Coach Portal — Chunk C: "Schedule intelligence" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-30, at the close of the Chunk E session (E committed `3c158557` the same
> day; the admin tryout-email alignment rode immediately after). Chunk C was picked by the owner
> as the next build. **PROCESS IS NON-NEGOTIABLE AND OWNER-MANDATED: a plan + PM brief AND
> approved mockups exist BEFORE any code is written.** No "quick fix first" exceptions — the
> recurrence defect will tempt you; resist. This prompt is self-contained.

---

## The prompt

You are planning and building **Chunk C — Schedule intelligence** for the premium Coaches Portal.

**The problem in one line:** the schedule's "repeat weekly" locks every generated game to ONE
opponent typed once — so for a real league schedule it saves negative time — there is no way to
import a season that already exists in a spreadsheet or a league email, and on the field the
lineup's touch targets are under the standard the same screen family already meets.

Follow the full house process, in this order, with a hard stop before code:
1. **Read + verify ground truth** (below).
2. **Implementation plan + PM brief** (`docs/projects/active/COACH_PORTAL_CHUNK_C_*`).
3. **Mockups as an artifact** — owner approval = binding visual spec; label every region
   NEW / RESTYLED / UNCHANGED.
4. **Owner decisions ratified** (the list below + whatever planning surfaces).
5. Only then: **build the whole approved chunk in one pass** → `/simplify` → `/review` (high-risk
   tier — this chunk writes schedule data in bulk) → `/docs` → probes → fresh dev restart →
   owner QA → commit on `dev` with explicit per-action OK.

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the ledger**; chunk C is defined in
   "What's left, grouped into pickable chunks". Tick absorbed items in §1.1 in the same unit of
   work. Note §1.7: parts of the LINEUP surface still assume diamond sports — a known, documented
   carry — your touch-target work must not deepen it.
2. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the findings this chunk
   absorbs: **P1 #6** (weekly recurrence fixed-opponent, f2-1), **P1 #7** (no schedule import,
   f2-2), **P1 #9** (lineup touch targets, f2-4/f2-8/f9-4 — found independently by TWO
   reviewers), and the **wow #2 remainder** (arm-care warning + richer chips on the game-day
   card; its *downgrade* half shipped in Batch 4).
3. `memory/design_decisions.md` — four entries are load-bearing here:
   - **Batch 4 (2026-07-29)** — real tournament games are MIRRORED events the ORGANIZER owns.
     The binding field split (organizer: time/opponent/venue/score; coach: arrival/uniform/notes/
     attendance/lineup) and the rule that duplicates are surfaced, never auto-merged.
   - **Chunk I (2026-07-30)** — the Overview shows ONE anchor chosen by an ORDERED rule; game day
     is the working-card shape; **CTAs gate on "can complete", never "can see"**. The wow-#2
     enrichment lands INSIDE that resolver's game-day card — you extend the anchor, you do not
     add a band beside it.
   - **Chunk H2 (2026-07-30)** — the importer rules: preview-first with a VERDICT per row
     (Adds / Updates naming the old value / Can't-import with a reason), the parser NEVER guesses
     (an ambiguous `03/04/2026` is refused, not resolved), a round trip with the app's own export
     must actually close, imports write through the SAME writers the forms use, and zero writes
     is an error, never a quiet success.
   - **Chunk E (2026-07-30)** — discard-guard contract (`useDiscardGuard`/`snapshotEqual`, ONE
     baseline mapping per form), and the opt-in rule for outward side effects.
4. `memory/date_correctness_guardrail.md` + `lib/timezone.ts` — **the schedule is THE surface the
   date-correctness program existed for.** Every "today"/"this week"/"days until" through
   `tournamentToday()`/`calendarDaysBetween()`; the guardrail baseline is ZERO and stays there.

### The four items you inherit (scope floor)

1. **P1 #6 — weekly recurrence locks one opponent.** Ground truth (verified 2026-07-30 by direct
   read): the Add Event modal lives INSIDE the schedule page; recurrence is gated by event type
   (`needsRecurrence` — practices, league games, generic events, ~line 163), and a recurring
   series is created from ONE form whose single `opponent` field stamps every generated game.
   The preview line ("Adds a league game every Tuesday from … through …", ~line 1061) is honest
   about dates and silent about the opponent problem. Recurring EDITS already have a
   this/future/all scope chooser (~line 1293) — recurrence itself isn't re-editable on an
   occurrence (~line 349). The review's judgement: for a round-robin league this is MORE clicks
   than not using it. Decide the fix shape at mockups (per-date opponent entry in the preview?
   recurrence stays practice-only and games go through import? both?) — **bring a
   recommendation, don't hedge.**
2. **P1 #7 — schedule import.** The pattern is already ruled: H2's importer contract (above) +
   the roster bulk-add precedent (paste or file, one editable preview, per-row outcomes).
   Templates carry structure; a schedule template's cells are dates/times/opponents/venues —
   the D-G1 dollar rule doesn't bite here, but "the parser never guesses" bites HARD on dates
   and times. Round-trip with the schedule's own export if one exists (verify at pickup).
3. **P1 #9 — lineup touch targets.** Two independent reviewers: the reorder arrows and the
   per-inning position cells sit under the touch-target size used elsewhere in the same screen
   family. Verify the exact rendered sizes at pickup (Playwright computed styles — the standing
   rule: never infer layout from CSS reading alone) and fix to the 44px family standard. ⚠ §1.7:
   this surface has known diamond-vocabulary debt — fix SIZES, do not add new sport assumptions.
4. **Wow #2 remainder — the fuller game-day card.** Arm-care warning (a pitcher near/over their
   innings cap today) + richer chips on the Overview's game-day anchor. ⚠ This is decision
   SUPPORT: warn, never block, never auto-change a lineup (the D-G1 family of rules). And it
   must live inside Chunk I's anchor resolver — one anchor, capability-gated actions,
   board-tile suppression rules intact.

### Ground truth to VERIFY at pickup (don't trust, read)

- Whether the Add Event modal has a discard guard yet (Chunk A covered Money; Chunk E covered
  tryouts; the event form is large and may still be bare — if so it belongs in this chunk).
- The schedule's export surface (does one exist to round-trip against?).
- The exact lineup touch-target render sizes at 360px (probe, don't eyeball).
- The game-day anchor's current chip set + where arm-care data lives
  (`lib/lineup-*`; pitching caps shipped with Lineup Intelligence).
- Whether `seasonToday`-class helpers are used on every schedule "today" comparison you touch.

### Landmines & contracts (hard-won — respect, don't relearn)

- **⚠ MIRRORED EVENTS ARE UNTOUCHABLE BY BULK PATHS.** Batch 4 mirrors real tournament games
  into the team schedule; the organizer owns their facts. Recurrence generation, import commits,
  and any bulk edit/delete MUST skip `isMirroredEvent` rows (the events PATCH 409s and DELETE
  refuses — but your NEW write paths must not even try). Duplicates (an imported game that looks
  like a mirrored one) are SURFACED, never auto-merged — the Batch 4 duplicate-confirm pattern.
- **⚠ Dates.** No raw UTC date math anywhere; the import parser REFUSES ambiguous dates rather
  than resolving them. The date-correctness ratchet is at ZERO and gates the commit.
- **⚠ Sport-neutrality.** Period/game vocabulary via `lib/sports.ts`. The lineup surface's
  existing diamond debt is documented (§1.7) — do not add a new instance; arm-care copy uses the
  pack's period noun ("innings" only via the pack).
- **Education vs write** (Chunk G rule 4): read-only assistants see, never act. Recurrence,
  import, and lineup edits all gate on the schedule/lineup write capabilities — probe as the
  read-only assistant (the leak class that bit Chunk A with 5 findings and Chunk E's check-in).
- **Two breakpoints only** (900/640); check the primitives header in `coaches.module.css` before
  any new @640 rule; `.modalFlushFooter` for tall modals; `CoachScrollX` for any sideways scroll.
- **Warm rules:** lime as text/border only; all colour baselines stay ZERO; new CSS joins the
  guardrail at zero literals.
- **Probes:** copy the pattern of `tests/uat/scenarios/coach-tryouts-smoke.spec.ts` (the newest
  exemplar — service-role self-provisioning with a marker prefix, asserted teardown,
  retry-safe per-test pre-cleans, computed styles never screenshots, text assertions scoped to
  `main[class*="coachesMain"]`, error-check on EVERY provisioning insert). Creds pattern:
  `{marker}-head@dev.local` / `{marker}-assistant@dev.local`, `devpass123`, org `dev-club-org`.
  Minimum new coverage: recurrence generating N games with N opponents · an import preview
  refusing an ambiguous date + skipping a mirrored duplicate · lineup targets ≥ the standard at
  360 · the read-only sweep · a data-level "mirrored rows untouched" assertion after an import.
- **Git: ONE shared `dev`, busy tree.** Diff every shared file, stage explicit `:(literal)`
  pathspecs (bracket dirs stage NOTHING bare), audit `git show --stat HEAD`, per-action owner OK,
  TODO.md edited but left OUT of the commit. `memory/design_decisions.md` is append-shared —
  check `git diff HEAD` on it for foreign hunks before staging.
- **Dev server:** new files ⇒ stop server → `rm -rf .next` → restart → verify login 200, no
  `EACCES`. A supervisor may auto-respawn port 3000 — verify health rather than fighting it.

### Owner decisions to bring to the mockup round

- **The recurrence fix shape** (recommend one): per-date opponent entry on the recurrence
  preview, recurrence narrowed to practices/generic + games via import, or a hybrid. State the
  click-count math for a real 12-game round-robin under each option.
- **Import scope for v1:** which templates (league schedule with opponents · practice block ·
  full mixed), paste vs file vs both, and whether tournament-sourced rows in a pasted league
  sheet are refused or matched against mirrored games.
- **Arm-care warning presentation:** where it renders (the game-day anchor; anywhere else?),
  the threshold copy, and the fair-to-the-kid wording. Warn-only is already ruled — the decision
  is presentation.
- **Whether the event modal's discard guard joins this chunk** (recommend yes if it's bare —
  it's the same P1 #5 family E just closed for tryouts).

### Definition of done

Plan + PM brief + approved mockups (binding, labelled) **before any code** · built in one pass ·
`/simplify` → `/review` (high-risk) → `/docs` · typecheck / `npm test` / focused lint green ·
`verify:changed` fully green with all baselines unchanged · new schedule probe spec passing ·
fresh dev restart · owner QA · committed on `dev` with per-action OK · `PROGRAM_COACH_PORTAL.md`
§1.1 ticked + `memory/design_decisions.md` entry + help content updated in the same unit of work.

---

## Program state at handoff (2026-07-30, end of the Chunk E session)

- **Prod:** `cf90d626` (2026-07-29). **Dev is far ahead and a release conversation is OVERDUE**
  — raise it if the owner hasn't. The queue includes the free-portal welcome (**dev-only
  FUNCTION migration 211 — the drift gate CANNOT see it; apply to prod BEFORE promoting**),
  Chunks A `a737acbf` · G `06f77442` · H `ee46bf89`+`f483405a` · E `3c158557` · the desktop
  public phase (A/B/C committed) · the free-Overview coherence work `a0f56d34` · Chunk I (built,
  QA pending at handoff).
- **Chunks:** A ✅ · G ✅ · H ✅ · E ✅ · I built/QA · B (chrome — check the desktop stream's
  state before starting) · **C = this** · D (parent-facing — needs the retention-vs-acquisition
  ruling) · F (frozen past season — decided, unbuilt, collision-free alternative if C stalls).
- **D-E9 note for this chunk:** decision emails are opt-in everywhere tryout decisions are made
  (coach board + org admin, aligned 2026-07-30). If schedule work ever grows an outward-facing
  send (a "notify families of the new schedule" idea WILL come up), it follows the same opt-in
  rule — raise it as a decision, don't default it on.
