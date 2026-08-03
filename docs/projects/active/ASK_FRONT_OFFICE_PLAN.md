# Ask the Front Office — Implementation Plan

**Status:** **Phase A BUILT 2026-08-02** (dev, uncommitted, owner QA pending). Phase B still blocked
on the privacy ruling. Companion brief: `ASK_FRONT_OFFICE_PM_BRIEF.md`.
Mockups (binding): Claude Artifact `14a812e8-1fe0-429c-9c54-beab7a581038`, source
`ASK_FRONT_OFFICE_MOCKUPS.html`.
**Origin:** Ideas Backlog shortlist (`docs/projects/IDEAS_BACKLOG.md`), grounded against code 2026-08-02.

## Owner decisions taken at build time (2026-08-02)

| # | Decision | Outcome |
|---|---|---|
| Placement | Where the box lives | **Insights**, between "What stands out" and the report doorways. The page's three voices in order: PUSH (findings) → PULL (the bar) → NAVIGATE (doorways). |
| Shape | Collapsed vs always-open | **Collapsed bar** (~48 px at rest). Questions cost no real estate until a coach asks. |
| Disclosure | Inline vs modal | **Expands in place.** Every receipt is a link OUT to a report, so a coach following one is meant to leave — leaving from inside an overlay returns them to a page they never saw change. Inline also puts the answer and its matching doorway on screen together. |
| Position ask | How a coach picks a position | **Question chip opens a position row**, sourced from the Sport Pack. Server picks the stalest position when none is named. |
| Money degradation | `money` without `rosterPii` | **Player names, not counts-only and not a refusal.** Grouping still happens server-side on the guardian email, so siblings roll up correctly; only the label changes. |
| Assistant visibility | Do assistants see it | **Yes, capability-filtered.** A question they may not ask is absent from the row — never greyed, never error-on-tap. No questions at all ⇒ the bar does not render. |
| Plan gating | Premium inclusion | **Included in the premium portal**, no further gate. No pricing/packaging change, so `PLAN_PRICING_FACTS.md` is untouched. |

### Deliberate deviations from the approved mockups
1. **Selected-chip colour** uses the portal's existing "on" toggle language (lime fill + ink, which
   the warm gate already remaps to olive-on-cream) rather than the mockup's ad-hoc dark-ink chip.
   Matching the mockup literally would have hard-coded a third chip treatment the theme knows
   nothing about — and the rendered result is what the mockup drew.
2. **Opening the bar does not auto-run a question.** The mockup shows a chip selected with an answer
   beneath it; that is the state *after* a tap. Auto-running would answer a question the coach did
   not ask and spend a query per open.

## Adding a question later — the recorded process

The surface reads a **question library** (`lib/coach-ask-questions.ts`). Adding a question is adding
an entry, its assembler case, and its tests. **The bar and the panel never change** — they are fully
generic over the registry.

⚠ **The route is the exception, and it fails silently.** The route fetches only what the asked
question needs, through a few `if (question.id === …)` branches. A question whose data no existing
branch already loads needs a new branch. Forget it and nothing shouts: the assemblers never throw on
absent inputs (by design), so the unit tests pass, the chip renders, and every real request quietly
answers "nothing recorded yet". **Adding a question = registry entry + assembler case + tests + its
fetch.** A declarative per-entry fetch spec was considered and rejected as machinery bought for a
library with a hard ceiling of eight.

**Every entry must declare all six of these. The list is the discipline:**

1. **The chip** — the question in a coach's own words, ending in a question mark.
2. **Who may ask it** — an `allows(caps)` predicate. This gates the chip AND is re-checked by the
   route, so a question reached any other way (stale tab, hand-typed URL, Phase B's model picking a
   tool) hits the same refusal.
3. **Where the answer comes from** — named recorded data, fetched by the route only when that
   question is asked.
4. **The sentence** — one line, assembled from those records by a pure function.
5. **The receipts** — which records get listed, and which report they lead to
   (`askReportHref`, shared with the Insights findings strip).
6. **The empty state** — what it says when nothing is recorded, and what would fill it in.

**The bar every question clears:** *a coach would say this sentence to another coach, and every fact
in it is provable one tap away in the receipts.* Nothing estimates, infers, projects, or compares to
another team. A question answerable only by guessing does not go in the library.

**Effort tiers:**
- **Small** — the portal already computes it for another screen. New entry + assembler + tests.
- **Medium** — the records exist but that math has never been done. New pure module + its tests first.
- **Not possible yet** — the portal does not record it at all. Something must be recorded before any
  question can exist. Most "can we ask X?" ideas land here, and the honest answer is "not until the
  team logs it."

**Ceiling: about eight chips** (asserted in `tests/unit/coach-ask-questions.test.ts`). Past that the
panel stops being a short list and becomes a menu to read — which is the signal that it is time for
Phase B, not more chips.

**The library is the durable asset.** Phase B's model may only select from it, so every question
added now becomes answerable by any phrasing later, at no extra cost. It is deliberately **not** a
settings screen: each question needs a hand-written honest sentence and empty state, and a
self-serve builder would invite questions the data cannot truthfully answer.

## Goal

A question box at the top of the premium coaches portal that answers plain-language questions
("Who hasn't played catcher recently?", "What does each family still owe?") strictly from the
team's own recorded data, with the exact records used shown underneath as receipts. Never a
guess, never outside data — enforced by architecture, not by prompting.

## Binding constraints

1. **Assemble, never generate.** The answer sentence is built from records returned by pure,
   tested data functions (the `lib/insight-findings.ts` "admission test" pattern: every sentence
   verifiable one tap away). An LLM may *route* a question to a function; it may never author a
   fact. Phase C relaxes this only with a deterministic post-verification (below).
2. **Capability-gated at the source.** Answer functions are filtered by the requesting coach's
   capabilities *before* anything runs (the `lib/insights-digest.ts` per-recipient pattern —
   an assistant without `money` never sees, routes to, or receives a dues answer). Family-identified
   money answers require `money` AND `rosterPii`; degraded no-name answers are a Phase-A decision.
3. **No archived seasons at launch.** The box resolves the ACTIVE year only. It does not join
   `APPROVED_ARCHIVE_DOORS` / `APPROVED_SEASON_AWARE_ROUTES`; any future archive support is its
   own owner decision per the CLAUDE.md ruling.
4. **Third-party outage can never block a coach.** All AI paths degrade to Phase-A chips.

## Phase A — "Quick Asks" (no AI) — ✅ BUILT 2026-08-02

**What shipped:** three new pure modules (position recency, family dues rollup, practice misses),
the question library, one capability-gated GET route, and the collapsed bar on Insights.
`positionLabels` was added to the Sport Pack so prose never prints a position code.
**No schema change** — one new read helper (`getRepTeamPracticeAttendance`) over existing tables.
**Tests:** 128 unit tests across the four modules; full suite green for this work. Typecheck, lint,
colour-token, date-correctness and observability guardrails all clean.

**`/simplify` + `/review` + `/docs` run 2026-08-02.** 11 quality fixes and 11 confirmed defects fixed.
The defects worth remembering, because they are the shapes this feature is prone to:
1. **The sentence could name a record the receipts had dropped** (4 assemblers). The cited record is
   usually the OLDEST relevant one, so a plain `slice(0, CAP)` cut it first. Fixed with
   `pinnedReceipts` — pinning decides what survives the cap, a separate display sort decides where it
   sits. Two regression tests pin the rule; it is the feature's whole promise.
2. **A total could contradict the parts beside it** — `money()` rounded to whole dollars, so two
   families owing $79.50 rendered "combined $159: … $80 and … $80". Now shows cents when there are cents.
3. **A cancelled game's saved lineup counted as a turn played.**
4. **Same-day games had no defined order** (the season-lineups query has no `ORDER BY`), so a
   double-header could cite the wrong half. Now tie-broken on start time.
5. **Arm care mixed two player sets** in one sentence (analytics reads the whole roster, recency the
   active one) — could name a departed player beside a current one.
6. **A revoked answer stayed on screen.** Now derived from the visible question list, so it
   disappears with its chip.
7. A permanent refusal said "try again"; the answer had no screen-reader announcement.

**Deliberately NOT fixed (out of scope, flagged):** the route matches capabilities by team rather
than by season, so a team holding both a draft and an active year with different grants could enforce
one season's capabilities while serving the other's. Inherited verbatim from ~53 existing coach
routes — a platform-wide fix, not this feature's to make.



Tappable pre-written questions (6–8 chips), each backed by one purpose-built pure function,
rendered as one answer sentence + a receipts list linking to the underlying report pages.

Build items:
- **New aggregation modules** (pure, unit-tested, in `lib/`):
  - Position recency: per-player, per-position last-played date across all sport-pack positions —
    generalize the `lib/coach-arm-care.ts` `daysSinceLastOuting` approach (source: saved lineups).
    Route position vocabulary through `lib/sports.ts` Sport Packs; no hard-coded softball terms.
  - Guardian/family grouping + cross-sibling dues rollup (match on guardian identity; reuse
    `lib/dues-status.ts` predicates for overdue/never-paid vocabulary).
  - Attendance-miss ranking (practice-type events, window-scoped) — largely exists in
    team analytics; expose a question-shaped accessor.
- **Answer registry**: one module mapping question id → {capability requirements, data function,
  sentence assembler, receipts shape, empty-state sentence}. Modeled on the findings-engine
  registry; adding a question = one registry entry.
- **API route** on the standard coach rail (resolveCoachContext; active year only), returning
  {answer, receipts[], links[]} — receipts carry real record identifiers (game dates, installment
  rows) that link to existing report pages.
- **UI**: question chips + answer card + receipts list on the portal (placement: Overview top or
  portal header — owner call at build time; chips are capability-filtered so a restricted
  assistant only sees what they may ask).
- **Honest refusals**: "Nothing recorded for that yet" (with what would populate it) and
  "That needs money access — ask your head coach" as designed states.

Verification: unit tests for each aggregation module (fixtures incl. empty/sparse data);
`npm run verify:changed`; UAT probe for the chips flow. No schema change anticipated in Phase A.

## Phase B — free-text box (first AI integration)

**Gate: owner privacy ruling first** (see Decisions). This is the platform's first LLM dependency.

- **SDK + model:** official Anthropic TypeScript SDK (`@anthropic-ai/sdk`), model `claude-opus-5`,
  server-side only (new env secret `ANTHROPIC_API_KEY`; never client-exposed). Prompt caching on
  the static system prompt + tool definitions.
- **Router-only tool use:** each Phase-A registry entry is exposed as a strict tool
  (`strict: true`, enum'd parameters). The model receives ONLY the tools the current coach's
  capabilities allow, reads the typed question, and returns a tool call (question id + slots:
  position, window, family, player). **The tool result is not sent back for prose** — the server
  executes the chosen function and assembles the answer exactly as Phase A does. One round trip,
  `tool_choice: {type: "any"}`, low effort setting, ~1–3s latency, ~1–3¢/question (sub-cent with
  caching).
- **Out-of-scope questions:** a designated `cannot_answer` tool the model must select when no
  registry entry fits, mapping to the honest-refusal states. Free text never widens what is
  answerable — it only widens how questions can be *phrased*.
- **Failure handling:** timeout/error → fall back to showing the Quick Ask chips with a quiet
  "couldn't understand that just now" note. Typed exceptions per SDK; retries per SDK defaults.
- **Optional pseudonymization mode (owner decision):** before the API call, substitute player
  names with jersey-number placeholders from the roster (and family surnames with stable
  aliases); the model routes on placeholders; real names never leave the platform. Adds a
  matching step for name-slots; recommended if counsel prefers zero minor-PII egress.
- **Cost guardrails:** per-coach daily question cap; usage logged (no new table required if
  logged via existing observability; if a table is added, DATA_DICTIONARY + snapshot refresh in
  the same unit of work per AGENTS.md).
- **Prompt-injection posture:** coach-typed text and roster-derived strings are untrusted; the
  model's only expressible output is a tool selection from a fixed menu, so injected
  instructions cannot exfiltrate or fabricate — worst case is a wrong lookup with visibly wrong
  receipts.

## Phase C — AI-drafted prose (later, optional)

The model drafts the answer sentence from the returned records (richer phrasing, multi-fact
synthesis). Ship only with a deterministic verifier: every name, number, and date in the drafted
sentence must appear in the receipts payload, else fall back to the template sentence. Separate
go/no-go after Phase B telemetry.

## Decisions needed (owner)

1. **Privacy ruling (blocks Phase B):** approve sending question text + team records (incl.
   minors' first names) to Anthropic's API under commercial terms (no training on API data), or
   require pseudonymization mode. Recommend routing the eventual ruling through `/strategy`
   (durable decision) and flagging to counsel alongside the guardian-tier question.
2. **Assistant visibility:** do assistants see the box at all (capability-filtered), or head
   coaches only at launch?
3. **Family-money degradation:** with `money` but not `rosterPii` — "a family owes $340" with no
   name, or refuse outright?
4. **Plan gating:** premium-portal inclusion vs. a further gate. Any pricing/packaging outcome
   updates PLAN_PRICING_FACTS + plan config in the same unit of work.
5. **Launch question set** (proposed): position recency, family dues, attendance misses,
   never-paid, playing-time outliers, arm-care/readiness line.

## Non-goals

Archived seasons; opponent/outside data; chat-style multi-turn memory; anything the receipts
model cannot prove; auto-messaging families from an answer.

## Effort

Phase A: M. Phase B: +M (integration, guardrails, pseudonymization option). Phase C: separate.
