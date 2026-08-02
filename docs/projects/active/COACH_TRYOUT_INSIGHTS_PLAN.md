# Coach Tryout Insights — Report · Development Baseline · Candidate Memory

**Status:** 2026-08-02 — rulings R1–R8 ratified; **mockups v1 APPROVED = binding visual spec.**
**Phase 1 (Report) ✅ BUILT on dev, uncommitted — owner QA pending.** Unit 928/928 · typecheck clean ·
lint 0 errors · new suite `tests/unit/tryout-report.test.ts` (14) · catalog trued up. Deliberate
deviations from mockups (recorded): colors follow the live tryout cards' dark-glass token idiom (the
warm mockup styling was presentational); the Final chip carries no date (no trustworthy per-decision
timestamp exists — the PDF's export-date stamp covers it). Phases 2–3 = fresh chats via
`TRYOUT_INSIGHTS_PHASE2_BASELINE_BUILD_PROMPT.md` / `TRYOUT_INSIGHTS_PHASE3_MEMORY_BUILD_PROMPT.md`.
**Scope:** Premium coaches portal only. Standalone-coach-first: nothing here depends on an org public
page or the Club tier.
**Sequencing:** Feature A (Tryout Report) → Feature B (Development Baseline) → Feature C (Candidate
Memory). Each ships independently; A defines the snapshot format B and C reuse.
**Companion:** `COACH_TRYOUT_INSIGHTS_PM_BRIEF.md`.
**Mockups v1:** https://claude.ai/code/artifact/3b8bf1f9-c1c5-407c-9fa6-376a5bf8fee2 (binding once approved)

---

## 1. Why

Tryout evaluation data is the first measurable record of every player's season, captured at the
moment of maximum coach attention — and today it is a closed loop. Scores and notes are never read
outside the tryout module (verified 2026-08-02: no reader of `rep_tryout_scores` /
`rep_tryout_rubrics` exists outside the six live tryout routes + `tryout-history`). Reporting is
minimal: the backend funnel in `tryout-overview` is mostly discarded by the UI, no coach-facing
tryout surface has any export/print, and tryouts is invisible to the Insights digest and platform
metrics. These three features turn the tryout from a one-day tool into a season-long asset:

- **A — Tryout Report:** the artifact that makes the tryout feel finished, defensible, and worth
  paying for (the "fairness receipt").
- **B — Development Baseline:** the bridge from the acquisition feature (tryouts) to the retention
  feature (player development) — the dev hub starts the season populated instead of empty.
- **C — Candidate Memory:** year-over-year growth shown at decision time — the emotional payoff and
  the program-quality claim.

## 2. Binding rulings (ratified by owner 2026-08-02)

These were proposed with rationale and accepted in conversation ("I agree, go ahead"). Log the final
set into `memory/design_decisions.md` at build time, once mockups are signed off.

- **R1 — Two audiences, two documents.** The printable report defaults to a **board-safe summary**:
  aggregates + roster names only; no scores or decisions attached to non-rostered candidates. The
  full candidate table (names × scores × decisions) exists only behind an explicit, per-export
  opt-in the coach must actively confirm.
- **R2 — Bias flags are screen-only.** The evaluator "runs hot / runs cold" indicators never appear
  in any printed/exported artifact. Naming a volunteer as biased in a forwardable document is a
  social grenade; on-screen it is a private coaching aid.
- **R3 — Tryout evaluation content is coach-eyes-only, permanently.** No score, category rating,
  composite, or evaluator note ever reaches a family-facing surface (recap, keepsake, offer page,
  any Chunk D surface). The family recap may state the *fact* "earned a roster spot at tryouts on
  {date}" — never a number. This extends the Chunk D "growth, never judgment" discipline upstream.
- **R4 — The baseline snapshot is context, not a measurable.** A tryout score is a subjective panel
  rating, not a measured drill. It is stored and displayed as a clearly labeled artifact ("Tryout
  snapshot — Aug 12 · 4 evaluators") on the player's development page and **never enters the
  measurables timeline or any trend computation**. No future surface may treat
  tryout-composite → in-season-measurable as a trend. (Same honesty rule as "the recap never labels
  a measurable an improvement.")
- **R5 — Suggested, never automatic.** Focus-area suggestions derived from low tryout categories are
  proposals the coach confirms, edits, or dismisses per player. No focus tag, goal, or vocabulary
  entry is ever written without an explicit coach confirmation — the focus vocabulary discipline
  (commit 18f05650, "one word for one thing") must not be polluted by scorecard categories.
- **R6 — Memory never breaks the blindfold.** Prior-year evaluation data appears **only at the
  Decide stage** (post name-reveal) and on the report. It never appears on the scoring surface, the
  live scoreboard, or check-in while evaluation is blind. (Check-in's existing identity-only
  returning marker — "tried out in {season}", name-visible mode only — is unchanged; identity ≠
  scores.)
- **R7 — Present, don't judge.** Prior vs. current snapshots render side-by-side always; a computed
  delta appears **only when the two scorecards' scales match** (5↔5 or 10↔10). Category-level deltas
  only for categories matched by key. Never force a comparison; incomparable pairs show both cards
  and no arithmetic. (Mirror of the recap rule "a trend whose ends were logged in different units is
  dropped.")
- **R8 — The archive read is a deliberate decision, made here.** Feature C reads a *prior season's*
  evaluation data into a live-season surface. Owner has ruled this acceptable: it is a read-only
  record, of the coach's own recorded data, shown at decision time — it passes the three archive
  questions (record not instrument; the whole read is one card, no subtree; shows what was recorded
  at the time). The build implements it via a **new season-aware read route added to
  `APPROVED_SEASON_AWARE_ROUTES`** in `tests/unit/coach-season-write-guard.test.ts` — editing that
  list is the designed decision point, and this ruling is its authorization. No new archive *door*
  is added (nav is untouched; `/tryouts/history` remains the only archive door).

## 3. The tryout snapshot — shared data spine

One format, three consumers. A snapshot is the per-candidate frozen view of one tryout's evaluation:

```
{
  tryoutId, programYearId, seasonLabel, date (last session date or decision date),
  scaleMax, categories: [{ key, label, weight }],
  perCategory: [{ key, avg, evaluatorCount }],
  composite, evaluatorCount,
  blindUsed: boolean, revealedAt, scoresLockedAt,
  decision: status + offerResponse (for report/memory contexts only)
}
```

- **Features A and C compute snapshots at read time** from existing tables (`rep_tryout_scores` ×
  `rep_tryout_rubrics` × `rep_tryout_registrations`), reusing the exact math in
  `lib/tryout-scoring.ts` (`rankTryoutCandidates`) — the history route already recomputes prior-year
  averages this way; extract the shared shape rather than duplicating it.
- **Feature B stores the snapshot at seed time** (see §5) so a later rubric edit or score change can
  never silently rewrite a baseline the coach already acted on.

## 4. Feature A — the Tryout Report

### UX

Lives on the **Build your team** stage of the tryout hub (replaces/absorbs the current bare 4-stat
row). Two states:

- **Live report** — appears as soon as any score exists. Header: "Tryout report · live — updates as
  you score and decide."
- **Final report** — stamps itself final when **every candidate has a decision** (no
  `pending_review` remaining) — recommendation OQ-1. Header: "Tryout report · final — {date}".

Sections (board-safe by default, per R1):
1. **The funnel** — Registered → Attended → Evaluated → Offered → Accepted → On roster, as a
   proper funnel visual (counts + drop-off), not badge text. Data already computed in
   `tryout-overview` (`candidateCount`, `checkedInCount`, `scoredCount`, decision counts,
   `rosterFromTryouts`) and currently discarded by the client — render it.
2. **Turnout vs. last season** — reuse the history route's `priorTurnout` comparison (trend chip;
   "first recorded tryout" fallback).
3. **Class strength profile** — per-category cross-evaluator averages across all evaluated
   candidates, as horizontal bars: "deep at Speed, thin at Throwing." This is also the hook into
   Feature B's team-level framing.
4. **Roster composition** — returning vs. new (from confirmed continuity links), roster size,
   `source='tryout'` share.
5. **The fairness receipt** — a stated-process block: "N players evaluated by M evaluators on one
   shared scorecard · blind (bib numbers only) until names revealed {date} · scoring locked {date}."
   Only states what is true (each line renders only if the underlying fact holds — no blind, no
   claim). This block is the headline differentiator; copy via `/marketing` review at build.
6. **Export** — shared `ExportMenu`: **"Board summary (PDF)"** default; **"Full detail (PDF/XLSX)"**
   behind an explicit confirm naming the consequence ("includes every candidate's name, scores and
   decision — for coaching staff only"). Bias flags excluded from all exports (R2). PDF via the
   existing `lib/export/pdf.ts` primitives (`buildTablePDF` + a custom layout, same pattern as
   `downloadDevelopmentSummary`).

### Work items

| # | Item |
|---|---|
| A1 | Extend/replace the Build-tab stat row with the report panel (funnel, turnout, strength profile, composition, fairness receipt; live/final states; empty/partial states) |
| A2 | New or extended read route (`tryout-report`) returning the snapshot-based aggregates; reuse `tryout-overview` + history math; no new tables |
| A3 | Board-safe PDF (custom layout) + full-detail PDF/XLSX behind confirm; wire `ExportMenu` |
| A4 | Register both exports in `lib/export/catalog.ts` — and fix the stale tryout entry while there (it points at a nonexistent admin path; the real admin export page is uncatalogued) |
| A5 | Empty/edge states: no rubric, no scores, zero candidates, sessions-but-no-scoring, all-decided-but-nobody-scored |
| A6 | `/docs` sync: report section added to the tryouts guide |

### Edge cases
- A tryout with decisions but no scores (coach skipped scoring): funnel + composition render;
  strength profile and fairness receipt absent — never fabricate.
- **"Offered" states current standing, not offer history** (Phase-1 /simplify altitude finding):
  a coach re-deciding an offered candidate clears the offer trace, so ever-offered is unprovable
  today. The funnel counts currently-offered + accepted; a sticky `first_offered_at` rides the
  Phase 2 migration to make the historical claim honest (see Phase 2 build prompt).
- Walk-ups with no email / no DOB: counted normally; board-safe export unaffected.
- Mixed check-in (scored but never checked in): keep the scoreboard's existing "didn't check in"
  distinction; the funnel counts attendance from check-in only.

## 5. Feature B — Development baseline + suggested focus areas

### UX

Entry: after ≥1 acceptance, the Build stage shows **"Start development from tryouts"** — "Set each
new player's baseline and pick what to work on first. {N} players." Opens a per-player walkthrough
(player k of N, skippable at every step):

- **Snapshot card**: category bars + composite, date, evaluator count, clearly labeled as the tryout
  snapshot.
- **Suggested focus**: categories below the scale midpoint, lowest first, max 2 (OQ-2
  recommendation). Each suggestion maps to the team's existing focus vocabulary via a
  coach-confirmed picker: match an existing focus tag or create one — **never silently minted**
  (R5). Coach may also decline all suggestions and pick freely.
- **Confirm** writes: (1) the stored baseline snapshot onto the player's development record, (2) the
  confirmed focus tags/goals through the existing development-goal flow.
- Re-entry: already-seeded players show "✓ baseline set {date}" and are skipped by default;
  re-running never overwrites a stored baseline (one-time seed per player per season).

On the player's development page, the baseline renders as a **context artifact card** — "Tryout
snapshot — Aug 12 · 4 evaluators" — visually distinct from measurables, with an inline
"coach-eyes-only; families never see this" note (R3, R4).

### Data

**Migration territory** (dev-first, per standing rules; check `ls supabase/migrations/` immediately
before numbering — concurrency lesson from Chunk D). Recommended shape: a small
`rep_player_tryout_baselines` table (roster_player_id FK, program_year_id, snapshot jsonb,
seeded_by/at; UNIQUE per roster player per year) — final call with `/db` at build. Only **rostered**
players are ever seeded; non-rostered candidates' scores remain in tryout history only.
Schema change ⇒ same-unit-of-work: `DATA_DICTIONARY.md` + `npm run refresh:snapshots`.

### Work items

| # | Item |
|---|---|
| B1 | Migration: baseline table (+ dictionary + snapshots) |
| B2 | Seeding walkthrough UI on Build stage (list + per-player card + skip/confirm; re-entry state) |
| B3 | Suggestion engine (below-midpoint rule, max 2, mapping to focus vocabulary via coach-confirmed picker) |
| B4 | Baseline context card on the player development page (distinct from measurables; coach-eyes-only note) |
| B5 | Guard: no baseline data in any family-facing read (assert recap/keepsake payloads never include it — unit-level, same spirit as the coverage boolean rule) |
| B6 | `/docs` sync |

### Edge cases
- Player accepted with zero scores: seeding offers "no snapshot — set focus manually"; never blocks.
- Rubric edited after scoring (category removed is already guarded upstream): snapshot stores what
  the scores actually reference.
- Mid-season acceptance (waitlist promotion): seeding available from the same entry point as long as
  the season is live.

## 6. Feature C — Year-over-year candidate memory

### UX

On the **decision board** (Decide stage, post-reveal only — R6), a candidate with a **confirmed**
continuity link to a prior season gains a **memory strip** inside their existing card, adjacent to
the existing "↩ returning · {season}" chip:

- Side-by-side mini-cards: "{prior season}: composite + decision" vs. "this year: composite" —
  with a **delta chip** ("+0.7") only when scales match (R7); otherwise both cards, no arithmetic,
  and a quiet "different scorecards — shown side by side" note.
- Expandable to category-level comparison (matched category keys only).
- Works for prior *candidates who were never rostered* too (the cut-last-year-came-back kid) —
  prior snapshots come from registrations, not roster rows.
- **Suggested** (unconfirmed) continuity matches show no scores — the existing verify-first flow
  stands; memory renders only on confirmed links (identity must be certain before history attaches).
- Report tie-in: aggregate line "returning candidates improved +X on average" **only** when ≥3
  comparable pairs exist (all same-scale); otherwise the line is absent (silence beats a confident
  lie).

### Access + archive mechanics

- New read endpoint (e.g. `tryout-memory` or an extension of `tryout-decisions`' payload) that
  resolves prior-season snapshots via confirmed continuity links; it addresses a past season, so it
  joins **`APPROVED_SEASON_AWARE_ROUTES`** via `resolveCoachSeasonRead` — authorized by R8. The
  allow-list test edit must cite R8/this plan in the entry comment.
- Capability posture mirrors tryout-history's rule: evaluated against the historic season's own
  assignment where applicable; tryouts capability required (head-coach-only in V1 as today).
- No nav change; no new archive door.

### Work items

| # | Item |
|---|---|
| C1 | Prior-snapshot resolution (confirmed links → prior registration → snapshot recompute; shared math from §3) |
| C2 | Memory strip UI on the decision board (side-by-side, delta-when-comparable, category expand; absent on blind surfaces by construction) |
| C3 | Allow-list edit + season-read wiring, citing R8 |
| C4 | Report aggregate line (≥3 comparable pairs rule) |
| C5 | Probes: memory absent from scorer/scoreboard/check-in DOM; delta absent when scales differ; suggested-link shows no scores |
| C6 | `/docs` sync |

## 7. Cross-cutting

- **Privacy:** all three features are coach-facing reads of data the coach already owns. R3 is the
  hard wall; B5/C5 make it testable. The existing PII-retention TODO (purge policy for declined /
  withdrawn registrations) becomes slightly more load-bearing with C — note it there, don't solve it
  here.
- **Verification:** focused checks per standing workflow (`verify:changed`, `typecheck` — B touches
  shared modules and a migration); UAT smoke extension of `coach-tryouts-smoke.spec.ts` for the
  report panel; layout-invariant screen addition is ONE line if the report page joins the sweep.
- **Not touched:** live tryout mechanics (check-in, scoring, evaluator links, decisions, offers),
  org-admin applicant surface, family-facing surfaces, the intake-link proposal (separate,
  unplanned), all Club-lane items (public sessions display, cross-program pipeline).
- **Business decisions:** none of this changes pricing/packaging (all premium-portal features). If
  the owner later wants the report's board-safe PDF marketed as a headline feature, that's
  `/marketing`, not `/strategy`.

## 8. Open questions (settle at mockup review; recommendations inline)

- **OQ-1 — "Final" moment.** REC: final when every candidate has a decision; also force-final at
  season close. Alternative: explicit "finalize report" button (rejected — a second close ritual).
- **OQ-2 — Suggestion rule.** REC: categories strictly below scale midpoint, lowest first, max 2.
  Owner may prefer 3, or bottom-quartile relative to the class.
- **OQ-3 — Report in the archive.** Should a *past* season's tryout-history page later gain the
  final report view? REC: yes as a follow-up — it passes the three archive questions — but it is a
  separate allow-list decision; explicitly out of v1.

## 9. Mockups

v1 artifact (binding once owner-approved; frames labeled NEW / RESTYLED / UNCHANGED per standing
mockup convention): https://claude.ai/code/artifact/3b8bf1f9-c1c5-407c-9fa6-376a5bf8fee2

7 frames: 01 report live state (Build stage) · 02 final state + full-detail export gate · 03
board-safe PDF · 04 baseline seeding walkthrough · 05 snapshot card on the dev page · 06 memory
strip ×3 states + phone · 07 the unchanged blind scorer (R6 made visible).
