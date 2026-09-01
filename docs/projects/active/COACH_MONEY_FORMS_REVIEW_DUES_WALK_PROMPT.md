# Money forms review — the PLAYER DUES cluster (evaluation + mockups, then the owner walks)

**Owner-directed 2026-08-30, the forms review's second walk.** The review's charter
(`COACH_MONEY_FORMS_REVIEW_PLANNING_PROMPT.md` — read it first; it is the parent of this session)
asks one question of every money entry form: *now that a coach meets ONE grammar when they record
money, do the setup and edit forms still read as part of the same product?* The first walk
(sponsorships, 2026-08-28) ended with that cluster rebuilt and passed (§121). **This session takes
the dues cluster.** The owner will read your mockup artifact and evaluate the live forms, then
report findings — your deliverable is the evaluation and the drawings, NOT a build.

## 0 · Session shape (the owner set it — do not restructure)

1. **Read the forms from the CODE, never from plans.** Plans here have been wrong repeatedly;
   the §121 walk's costliest finds were things the plans still described the old way.
2. Produce a **severity-ranked gap register** (what reads as a different product, what breaks a
   standing ruling, what is fine and should be said to be fine — do not manufacture findings).
3. Produce **mockups as a Claude Artifact** (`memory/feedback_mockups_as_claude_artifacts.md` is
   binding): current state drawn faithfully in the shipped warm palette, proposed state beside it
   where you recommend change, **a whole-screen before/after**, NEW / RESTYLED / UNCHANGED tags
   **beside elements, never over them** (round 1 of the Add-a-bill mockups failed exactly there).
4. Hand the owner the artifact link + where each live form is on dev. **Then stop.** The owner
   walks, reports findings, and rules; a build prompt comes only after the rulings.

## 1 · The cluster — every dues-side form, by its door

All in the Money hub (`/{org}/coaches/teams/{id}/accounting`), Dues tab unless said otherwise:

- **Generate Player Installments** — `accounting/GenerateInstallmentsModal.tsx` (832 lines), the
  shared bulk-dues door ("Set dues for all players", also reachable from Budget). The three
  radio-card amount modes, the numbered installment rows, Auto `<output>` amounts, the reconcile
  sentence.
- **The dues drawer's forms** — `accounting/dues/panel.tsx` (3,482 lines): the per-player
  schedule/installment editing, **record/correct a payment** ("Save correction" ~line 2656 — note
  its header comment ~1097 about the footer button being the only tell), **Add a credit**
  (forgiveness credits and their guards), **Set refund — {name}** (~line 3232, owner Call 10),
  and the one-tap **Record as paid / Record rest as paid** buttons (deliberately question-free —
  that is a ruling, not a gap).
- **What is deliberately NOT this cluster:** recording a dues payment cold (the one conversation
  owns it — its dues branch was walked with centralization), team money settings, and the club
  tab's installments.

Check the review charter and the QA ledger's forms-review section for which of its open
questions (Q4/Q5/Q6/Q8/Q9/Q10) name dues surfaces — answer from those documents, not from memory.

## 2 · Rulings this walk measures against (all binding; grep before re-deriving)

- **One grammar:** Record is for money that MOVED; setup/edit forms state their kind and never
  re-ask it. A form that needs a way across HANDS OFF, visibly, typing carried — and **a hand-off
  offered inside a control must be as revisable as its siblings** (design_decisions 2026-08-29).
- **The object noun carries the timing** (fold 6A; "+ Pledge" is its newest application) — flag
  any dues door whose name claims more or less than it does.
- **A meta line carries FACTS, never narration, and never restates the columns above it**
  (design_decisions 2026-08-29 — applied four times in one day; expect dues drawer instances).
- **A modal is for a QUESTION, not a field; a record has ONE editor** (2026-08-26).
- Plain asterisk for required, never "(optional)"; one-value fields are dropdowns; installment
  (two Ls) and "8:00 a.m." are build-gated; 44px tap floor to 768 comes from the SURFACE.
- **Auto amounts on the DUES sheet are `<output>`, not inputs — deliberately** (the figure is a
  computed consequence there; the bill editor's typable Auto is the one divergence, documented
  both ends). Do not "align" them without surfacing it as a question.

## 3 · Known carried defects — this walk is where they land (do not rediscover them as news)

1. **Generate Installments: the preview table is computed from the budget while the write uses
   the typed amounts** — pre-existing, found at the 08-13 review, explicitly deferred by the
   owner "to the upcoming modal upgrade". This session IS that upgrade's front door: put it in
   the register with a recommendation.
2. **A re-run replaces hand-built per-player schedules and relabels them budget-generated** —
   owner-accepted as-is on 2026-08-13. Surface it deliberately (accepted-risk row), don't
   relitigate it silently inside a redesign.
3. The charter carries a **"What is this?" phrase collision** finding — verify from today's code
   what survives of it (the fold renamed the bill form's picker to "Filed under" since).

## 4 · Engineering map + traps

- The dues sheet **shares the budget sheet's row classes** (`budget/budget.module.css` —
  `periodInputRow` family) exactly as the bill editor does; any restyle proposal must promise
  variant classes scoped per surface (the Add-a-bill pass's `.planEditor` is the precedent) and
  before/after proof the budget sheet and bill editor didn't move.
- **A row component defined inside render REMOUNTS its manager** (§48's trap, met once already in
  a dues-adjacent sheet) — check for it while reading; it presents as focus loss per keystroke.
- **check:layout cannot see a modal.** Verification claims must come from Playwright against the
  live dev server on the UAT fixture (`uat-coach@uat-test-org.local` / env `UAT_COACH_PASSWORD`,
  org `uat-test-org`; throwaway scripts in `scripts/tmp-*.mjs`, deleted after). The fixture holds
  ZZ QA rows; reseed via `scripts/seed-uat-coach-fixture.mjs` if dues data is thin.
- Dev server: `npm run dev` only; restart rules in `AGENTS.md`. Warm theme is the default; draw
  mockups in the shipped warm literals (the Add-a-bill mockup source in
  `docs/projects/archive/COACH_ADD_A_BILL_FORM_MOCKUP.html` shows the method and the palette).
- The tree may carry OTHER sessions' uncommitted work — stage nothing; this session builds
  nothing.

## 5 · Done means

- Gap register (severity-ranked, accepted-risk rows included) presented in the chat in
  product-owner language.
- Mockup artifact published (whole screens before/after, tags beside elements), link handed over
  with a per-form walking order for the live evaluation.
- The QA ledger gains a forms-review dues-walk section ONLY after the owner reports findings —
  the owner's paste-back is the record, not your evaluation.
- No code changes, no commits, no TODO restructuring beyond a one-line pointer if the charter's
  TODO entry needs it.
