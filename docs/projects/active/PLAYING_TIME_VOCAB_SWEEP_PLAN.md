# Playing-Time Vocabulary Sweep — Plan

**Status:** APPROVED TO BUILD (owner, 2026-08-04) — execute in its **own chat/session**, not inside
the Game-Day Mode build. Ruling logged in `docs/agents/strategy/BUSINESS_DECISIONS.md`
(2026-08-04 — "Playing time is MEASUREMENT, never a fairness verdict").
**Size:** copy sweep, no schema/gate/feature change. One session.

## PM summary

Rep teams deliberately skew playing time toward stronger players. Today the app frames
playing-time metrics as a fairness judgment ("Is playing time fair?", "the team's fair-play
band"), which takes a side against the paying customer's coaching model and hands parents the
platform's own vocabulary in playing-time disputes. After this sweep the same metrics remain,
described neutrally: where minutes go, who leans on whom — measurement, never a verdict.
Families see the change most in the player recap; coaches see it in Insights, the Overview
tile, and the lineup tool.

## The ratified reword set (exact words — owner-approved, do not re-litigate)

| Surface | Today | Becomes |
|---|---|---|
| Insights doorway + playing-time report title | "Is playing time fair?" | **"Where is playing time going?"** |
| Overview tile verdicts | "Fairly even" / "Uneven" | **"Evenly spread" / "Leans on a few"** |
| Family player recap band copy | "the team's fair-play band" | **"the team's typical range"** |
| Lineup auto-fill / Reshuffle copy | "a fresh fair arrangement" | **"a fresh arrangement with even bench rotation"** |

Other instances of playing-time "fair/fairness" copy found in the sweep follow the same
principle: **describe the mechanic or the distribution; never judge it.** New words beyond the
four ratified above are the builder's judgment call, kept consistent with these.

## In scope (user-facing playing-time fairness copy — inventory from 2026-08-04 grep)

- `lib/help-content/coaches.tsx` — Insights/lineups/recap guide entries + search keywords that
  quote "Is playing time fair?", "fair", "fair-play band", "rotates fairly", "keeps the bench
  fair", etc. (keywords may KEEP "fair" as search synonyms — people will still type it — but
  displayed copy changes).
- `components/family/PlayerRecapView.tsx` — `in_band: 'Right in the team's fair-play band all
  season'` → typical-range wording. **Family-facing, highest stakes.**
- `lib/rep-player-season-recap.ts` / `lib/player-season-recap.ts` — any band-label copy strings.
- `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` — Overview Playing time tile verdicts
  (`'Fairly even' : 'Uneven'`).
- `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` — Insights doorway tile title.
- `app/[orgSlug]/coaches/teams/[teamId]/history/playing-time/page.tsx` — report title/copy.
- `app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx` + `_LineupEditor.tsx` — auto-fill /
  Reshuffle copy.
- `components/coaches/PositionProfileEditor.tsx` — "Playing time stays fair (no back-to-back
  sits)" → describe the mechanic.
- `lib/insight-findings.ts` — user-facing finding sentences in the `fairness` tier (the tier
  **key** stays; it's internal).
- `lib/coach-ask-questions.ts` — any answer sentences using fairness framing.
- Game-Day Mode P1 ships with the new vocabulary already (built in the same sitting as the
  ruling) — verify, don't re-edit.
- `/marketing` check: persona/feature pages for "fair playing time" framing (see the decision's
  handoff block).

## Explicitly OUT of scope

- **Tryout fairness vocabulary** — blind evaluation, "names hidden for fairness", the fairness
  receipt (`lib/tryout-report.ts`, `TryoutReportCard`, tryout help entries, PDF export). It is
  an evaluation-integrity promise, a different concept, deliberately KEPT (owner ruling).
- **Old release notes** (`lib/release-notes.ts`) — historical record, stays as written.
- **Internal identifiers** (`fairPlay`, `FairPlayRow`, tier `'fairness'`, comments) — code-level,
  not user-facing; rename only if trivially safe, never at the cost of diff noise.
- Demo seed comments, `lib/db.ts` "fair denominator" comment, etc. — not user-facing.

## Verification

- Tests that pin copy strings will need updating in the same pass — expect hits in
  `tests/unit/coach-overview.test.ts`, `tests/unit/insight-findings.test.ts`,
  `tests/unit/coach-ask-questions.test.ts`, recap tests; update the pinned strings, never relax
  the assertions.
- `npm run verify:changed` + full `npm test`; `npm run typecheck` if shared modules change.
- `/docs` help entries update in the SAME pass (they are in-scope files, not a follow-up).
- Grep gate before handoff: `[Ff]air` over `app/`, `components/`, `lib/` — every survivor is
  either tryouts, internal, or historical, and the handoff lists them.
- ⚠ Shared working copy: several in-scope files carry other projects' uncommitted hunks
  (help content, coach overview, ask-questions). Commit only with explicit owner OK, explicit
  pathspecs, hunk-level splitting where mixed.

## Owner QA (ledger section at execution time)

Overview tile wording; Insights doorway + report title; a family recap preview showing
"typical range"; lineup Reshuffle copy; tryout surfaces UNCHANGED (fairness receipt still
says "fairness").
