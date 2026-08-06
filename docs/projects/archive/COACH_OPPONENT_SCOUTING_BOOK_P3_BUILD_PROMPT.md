# Opponent Scouting Book — Phase 3 Build Prompt ("the moat + bridges")

**Status:** ✅ **EXECUTED 2026-08-04** — owner cleared both gates in-conversation (mockup v3
stage 7 approved; P1/P2 QA gate waived by ordering the build). S1 (tournament intel) and S2
(practice-week planner bridge) built; **S3 skipped** per the dependency note — Game-Day Mode
is still Proposed, so the handoff stays the cross-plan integration point both plans list.
Owner QA = `OWNER_QA_LEDGER.md` §1.14. No new migration; no write-guard list changes (the
intel route lives under events/, is GET-only, and never touches the season rail).

Original gates, kept for the record:

1. **Prior-phase QA:** owner QA for P1 (`OWNER_QA_LEDGER.md` §1.12) and P2 (§1.13) should
   PASS first; if QA surfaces defects, fix those before starting P3.
2. **Mockup sign-off:** the two P3 surfaces with new UI — the **"Their tournament so far"**
   block and the **practice-planner panel** — need mockups produced (extend the existing
   Claude Artifact "Opponent Scouting Book — the coach's loop", artifact id
   def742fe-1b28-48ae-981a-d8a6a9afe45d, republish same path for version history) and an
   **explicit owner OK in-conversation**. Mockups are the spec (memory:
   build-to-approved-mockups). If the owner requests changes, revise + republish + re-seek
   sign-off BEFORE touching code.

**Parent plan:** `COACH_OPPONENT_SCOUTING_BOOK_PLAN.md` — read §4.7, §4.9, §4.10, §5, and
the Status block's ratified rulings first; they bind P3. P1 shipped at `72034c15`; P2 built
2026-08-04 (see the P2 prompt's EXECUTED note + ledger §1.13 for what now exists).

---

## What Phase 3 delivers (three slices — but see the dependency note on S3)

### S1 — Tournament intel: "Their tournament so far" (the moat)
- For a **mirrored tournament game** (the tournament runs on FieldLogicHQ), the Scouting
  tab gains an automatically-assembled block: the opponent's OTHER results in that same
  tournament — today/this weekend, score.unit for/against, current standing. Zero capture;
  refreshed on read; the book fills itself while the team warms up.
- **Scope ruling (plan §9 Q4): SAME tournament only.** This is clearly public data (what
  that tournament's standings pages already show). Widening to the opponent's results in
  OTHER platform tournaments crosses into cross-event profiling and needs an explicit
  owner comfort ruling first — do not build the wider read "while you're in there."
- Public data only — results/standings, never opposing rosters or names.
- Honest constraint stated in-UI: the block exists only when the tournament runs on the
  platform; external tournaments can't offer it (absent, not apologized for).
- API: `GET .../events/[eventId]/tournament-intel` — mirrored games only; caps `schedule`;
  live-season route off the season rail (extend the write-guard route-count expectation
  if its floor is exceeded — the scouting-book it-block scans `/opponents/`, this route
  lives under events, so check which floors actually move).

### S2 — Practice-week planner panel (the bridge from intelligence to preparation)
- When a practice plan is being built in a week containing a booked opponent's game AND
  that opponent has book content: one quiet panel in the planner — book line + top (most
  recent) observation + "full book ›" link to the card. Closes the loop: "they bunt first
  strike" on Saturday becomes Tuesday's bunt-defense block.
- Absent when the book is empty, absent in archives, never a modal. Follow the planner's
  existing data-assembly path; the alias-aware opponent resolution from P2 must be reused
  (an aliased spelling on the game must still find the book).

### S3 — Game-Day Mode handoff — ⚠ BLOCKED ON ANOTHER PROJECT
- Console header opponent name → Scouting-tab content as a sheet; end-game wrap gains the
  capture door ("Add to the book on {opponent}?").
- **Game-Day Mode is PROPOSED and not started** (`COACH_GAME_DAY_MODE_PLAN.md`). If it is
  still unbuilt when P3 starts, SKIP this slice and note it as the cross-plan integration
  point both plans already list — do not build a placeholder. If Game-Day has shipped,
  build the handoff per its plan's integration section.

## Constraints that bind (do not re-litigate)
- INSTRUMENT ruling: everything live-season-only; nothing joins the archive allow-lists.
- Same-tournament-only intel scope (above) — widening = new owner ruling.
- Records/tallies through `WRAPPED_RECORD_EVENT_TYPES` + `lib/coach-season-record` only.
- Numbers-not-names; no photos; game rows never written; mirrored rows stay
  organizer-owned (read-only joins, never writes).
- ⚠ Route placement: NEVER add a static sibling beside `[opponentKey]` under
  `/opponents/` (P2 review lesson — a literal segment shadows the dynamic one and makes a
  team with that name unreachable). Nest under the dynamic segment.
- ⚠ The masthead module stays feature-free — if P3 wants another quiet line anywhere in
  shared chrome, copy the `lib/coach-opponent-nudge.ts` shape (feature-side module taking
  chrome shapes as input), never import feature code into shared chrome.
- Warm + dark theming via tokens only; 900/640 mobile system; icon-only mobile buttons
  with aria-labels.
- No new migration expected. If one proves necessary, dictionary + snapshots in the same
  unit of work.

## Verification bar (match P1/P2)
- Unit: intel assembly from mirrored-game fixtures (present only for mirrored games;
  same-tournament scoping; no roster/name fields in the payload); planner-panel presence
  rules (booked opponent + book content + game week; absent otherwise); alias-aware
  resolution on both new surfaces.
- `npm run typecheck`, full `npm test`, `npm run verify:changed` all green.
- Post-build: offer `/simplify` then `/review` (high-risk: touches mirrored-tournament
  read paths), then `/docs` (premium-scouting section gains the tournament-intel story —
  it is a selling point; the honest external-tournament constraint belongs in the guide).
- New ledger section (§1.15 or next free) with the owner QA script; commit only with
  per-action OK, explicit pathspecs, foreign-hunk hygiene.
