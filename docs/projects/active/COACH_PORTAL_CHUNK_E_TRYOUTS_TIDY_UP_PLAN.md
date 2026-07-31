# Coach Portal — Chunk E: Tryouts & Development tidy-up — Implementation Plan

> **Status:** ✅ BUILT ON DEV 2026-07-30 (uncommitted) — all 12 work items in one pass.
> Gate green: typecheck 0 · 583 unit tests · focused lint 0 errors · all six colour baselines
> ZERO · date-correctness ZERO · schema parity 0 · **new tryouts probe suite 10/10** (360×740 +
> desktop) · Money suite regression 35/35. NO migration, as predicted.
> **Build deviations from the plan (all verified against the live schema):**
> - The family's registration note ships as `playerNotes` only — the plan's "position
>   preference" field does not exist on the registrations table (it belongs to a different
>   feature's form type); families write preference into the note today.
> - WI-9's venue label derives from the sport pack's EXISTING `defaultFacilityType`
>   (diamond/court/other) — no pack change needed; `getRubricStarter` gained the sport param
>   as a seam (still returns the diamond set for every offered sport, documented).
> - WI-6/D-E4: the Practice-plans card is KEPT (ratified recommendation) — no change shipped.
> - The self-scoring identity is keyed `self:` + deterministic hash, which ALSO hard-excludes
>   it from the public token route (prefix can never match a hashed 43-char token) — stronger
>   than the plan's expiry-based defence, so self sessions carry a far-future expiry instead.
> Remaining: `/simplify` → `/review` → `/docs` → fresh dev restart → owner QA → commit with
> per-action OK (+ ledger/decisions-log/TODO updates in the same unit of work).
> **Created:** 2026-07-30. PM brief: `COACH_PORTAL_CHUNK_E_TRYOUTS_TIDY_UP_PM_BRIEF.md`.
> Mockups artifact: `claude.ai/code/artifact/82b6eac7-89b0-4c28-9d75-777e54e7f86d` rev 1 —
> _approved rev = binding visual spec (NEW/RESTYLED/UNCHANGED labelled per frame)._
> Source: `COACH_PORTAL_CHUNK_E_TRYOUTS_TIDY_UP_BUILD_PROMPT.md` (the four inherited items) + the
> owner-requested discovery pass (three personas + four technical lenses, adversarially verified).
> **No migration expected or planned.** Every work item below is presentation/route/copy work on
> existing tables. If a schema change appears mid-build, stop and re-scope (standing rule).

---

## 0. Ground truth — re-verified by direct read 2026-07-30 (this session)

Corrections and confirmations on top of the build prompt:

- **The Tryout Day tab is the live scoreboard** (`TryoutScoreboardCard` + lock control + evaluator
  chips), plus an "Open check-in" action. Its intro promises "…then score them — the board ranks
  everyone live" but **no scoring instrument exists anywhere on the tab** — the only path is
  Setup → Evaluators → mint a link → open it yourself. The same promise appears in the
  "How tryouts work" walkthrough (step 2) and in `computeNext`'s hint ("Rate players yourself or
  invite helpers") — **three copy surfaces promise self-scoring; zero doors deliver it.**
- **The scoring surface is good and reusable.** `app/tryout-score/[token]/page.tsx`: per-category
  in-flight saves (a second tap never waits on the first), per-cell revert on failure, blind mode,
  lock banner, honest error states (invalid/revoked/expired/load). Reuse it — never a second scorer.
- **Evaluator links:** minted in `tryout-evaluators` POST, TTL **48 h**, token stored **hashed only**
  (`token_hash` unique), raw token surfaced exactly once. Revocable (`revoked_at`). The table has
  **no user column** (columns: id, tryout_id, program_year_id, team_id, org_id, evaluator_name,
  token_hash, expires_at, revoked_at, created_at) — this shapes WI-1's identity design.
- **Decisions email families — including declines.** `tryout-decisions` POST routes every
  offer/waitlist/cut through `applyTryoutDecisionSideEffects`: offer → branded email with a no-login
  Accept/Decline link (7-day deadline); waitlist → update email; **cut → a "dignified release"
  email** (`tryout_declined` transactional). Withdrawn → nothing. The board UI never says so —
  the three-state control looks like a private triage toggle (optimistic, instantly re-tappable,
  no confirm). **Toggling one row through three states fires three real emails at one family.**
- **One tryout workspace per program year** (`getOrCreateRepTryout` is 1:1 with `program_year_id`).
  The phase model doesn't depend on session count — a two-day tryout works structurally; the thing
  that actually breaks across two weekends is the **48 h evaluator TTL**.
- **The Depth Chart is no longer a page** — `depth-chart/` is a redirect into
  `roster?view=depth` (`DepthChartBoard` inside the Roster page). The board renders a table inside
  `.gridScroll { overflow-x: auto }` — a **pre-existing bare scroller** (predates `CoachScrollX`)
  with sticky first columns via inline `left:` offsets, inside the standard 960 px `.page` column.
- **Development hub two doors:** both destinations read the **same** `development/board` API (the
  report adds `?history=1`). The board is the working surface (edit focus areas/notes); the report
  is a read-only coverage table. The defect is self-description drift: the board door's copy claims
  "a coverage view, not a ranking" while the Insights door says "The coverage report" — two doors,
  one claimed identity, genuinely different jobs underneath.
- **Practice plans placeholder** (`devSlotCard`, "Coming in a later phase…") renders for every team,
  unconditionally, forever — the portal's only permanently-dead card (Batch 3 standard: a dead tab
  is dishonest).
- **Rubric starter is deliberately diamond-only** (`lib/tryout-rubric-templates.ts` documents the
  per-sport lookup as the carry-over). The hub **never passes `sport`** to `TryoutDayCard`, so the
  tryout-window notice runs sportless; the session form hard-labels "Field / diamond" and the rubric
  builder placeholder says "e.g. Hitting".
- **Capability model:** every tryout API gates on `denyUnless(capabilities.tryouts, …)` after
  resolving the assignment — uniformly, all 11 routes, with IDOR checks (landmine sweep: server
  side is complete; this is why the client gaps are honesty bugs, not breaches). Client-side, two
  corrections to the prompt's framing: the hub's "fail open while resolving" is actually
  **permanent** fail-open when no assignment exists at all, and the **check-in sub-page has no
  client gate whatsoever** — the only tryout surface without one (WI-11).
- **Setup forms and guards:** the session modal (5 fields), the rubric builder (name + scale +
  N×3 category fields — the canonical loss case), the evaluator modal (1 field), and the accept
  drawer (number/position/jersey size/fees toggle/total/notes/installment rows) all dismiss on a
  bare scrim click with **no discard guard**. `useDiscardGuard` (Chunk A) is the shipped primitive.

## 0.1 Discovery findings (three personas + four lenses, adversarially verified)

Run 2026-07-30 as a 7-lens multi-agent pass; every blocker/high claim was adversarially verified
against the code and survived (two received precision corrections, noted where relevant). The
findings that drive scope are folded into §0 and the work items; the ones ruled out of v1 are in
§4. Beyond §0's ground truth, the pass established:

- **Candidates arrive through a real public registration form** (`…/tryouts/[yearId]/register`) with
  a confirmation email; coaches add day-of walk-ups at check-in. The full email arc exists:
  registration confirmation → offer with no-login Accept/Decline (guardian reply **never** mutates
  roster status — the coach always finalizes; documented D1/D2 in that phase) → dignified decline /
  welcome email. **The decline email's tone is a strength to preserve.**
- **Every family-facing tryout email is fire-and-forget** — and this platform's own memory says
  post-response work can silently drop on Amplify (`after()` gotcha). The sends must be awaited.
- **A no-show is indistinguishable from "not scored yet" everywhere a coach decides**, and a
  candidate with **no guardian email on file** (walk-ups) can be offered/waitlisted/declined with
  zero signal that no notification will ever reach the family.
- **The guardian's registration notes** (position preference, context) are captured, fetched — and
  never rendered anywhere in the coach portal.
- **Rubric save silently drops rows**: a category row with a blank label but typed weight/
  instructions is filtered out on a SUCCESSFUL save — typed work lost with no warning.
- **The evaluator's mid-session failure modes are silent**: a revoke/expiry during scoring just
  reverts cells with no explanation, and the load-error copy promises a retry with no button.
- **Season rollover carries zero tryout data** — rolling with a mid-flight tryout (unresolved
  candidates, unlocked scoring) makes it silently unreachable, with no warning in the rollover sheet.
- **The depth chart is sport-neutral by construction** (positions from `getSportPack()`) and its
  real f9-2 defect is the **bare scroller** (no `CoachScrollX`, no hint) more than the 960 px cap —
  the verify pass held that `.pageWide` alone would not close the finding at common laptop widths.
- **Award TYPES auto-seed** (never blank) — the real blank-picker defect is the **player** picker
  on a rosterless team, plus two adjacent honesty gaps: the Awards report lacks the sibling pages'
  "no season yet" 404 branch, and `TestTypesManager` hand-rolls its empty state instead of
  `CoachEmptyState`.
- **The Practice-plans card is arguably NOT a dead-tab violation** — it is labelled, unclickable,
  and visually demoted; the discovery agent recommends keeping it as an honest roadmap slot. Both
  readings go to the owner (§6 D4).
- **The bias flag is well-judged and correctly invisible to evaluators** — fair language, a
  sample-size gate, shown exactly where the coach acts. Preserve. (Precision note from verify:
  a duplicated evaluator identity inflates the per-category mean — 2× representation — which is
  what makes same-row link reissue (WI-8) the correct fix rather than mint-another-evaluator.)

---

## 1. Work items

### WI-1 — "Score as yourself": an authenticated scoring door on the Tryout Day tab (P1 #16 / f3-4)

**What the coach sees:** the Tryout Day tab gains a primary **Score players** door beside
"Open check-in". It opens a coach-authenticated scoring page — the same field-ready scorer the
evaluator link opens (same component), no token, no expiry — scoring as themselves. Their scores
appear on the live scoreboard as an evaluator chip marked **(you)**.

**Mechanism (no migration):**
- Extract the scorer UI from `app/tryout-score/[token]/page.tsx` into a shared component
  (`components/rep-teams/TryoutScorerSurface.tsx`): props = context + an async `saveScore`
  callback; both the public token page and the new page render it. **Reuse, not a second scorer.**
- New sub-page `app/[orgSlug]/coaches/teams/[teamId]/tryouts/score/page.tsx` — thin authed shell,
  exactly the check-in page pattern (back link to the hub).
- New API `…/tryout-self-score` (GET context / POST score): resolves the coach, gates on
  `denyUnless(capabilities.tryouts)` (scoring is a write), then **finds-or-creates a persistent
  "self" evaluator session** keyed by a deterministic
  `token_hash = hashEvaluatorToken(HMAC(serverSecret, "self:" + tryoutId + ":" + userId))`.
  The raw value never leaves the server and is unguessable without the secret, so the public
  token route cannot be replayed against it; `expires_at` is still set short (48 h) as
  defence-in-depth — **the authed route ignores expiry** (identity, not auth; auth is the session).
  Each write-capable coach gets exactly ONE stable scoring identity per tryout, on any device.
- Scoreboard + evaluator chips: the scoreboard route computes the same HMAC per requesting user to
  flag `isSelf`; chip renders "{name} (you)". The **Evaluators card lists shared LINKS only** —
  self rows are excluded (they aren't links; nothing to copy or revoke).
- Copy truing: `computeNext`'s "Rate players yourself or invite helpers" now has a real door behind
  it; Evaluators card subtitle stays helper-framed.

**Security statement (for the decision record):** the coach's own scoring stays behind their login —
no shareable URL for it ever exists. Volunteer links are unchanged (48 h, hashed, revocable). The
rejected alternative — silently minting a normal evaluator token and redirecting into the public
page — would put the head coach's scoring behind an unauthenticated URL in their browser history,
break silently after 48 h (multi-weekend tryouts), and split their scores across identities on
every re-mint.

### WI-2 — Discard guards on tryout setup forms (P1 #5 remainder, deferred here by owner ruling D3)

`useDiscardGuard` + `ConfirmProvider`, per the Chunk A contract (guard back-arrow/X/Cancel/scrim
together, never Save; clean forms close silently; copy names what's at stake; ONE baseline mapping
shared with the open path):

| Form | Baseline (the ONE mapping) | Stake copy names |
|---|---|---|
| Session add/edit modal (`TryoutDayCard`) | add = `BLANK`; edit = `toInputValue`-mapped session | "a session on {date}" / the edited fields |
| Rubric builder (`TryoutRubricCard`) | `openBuilder`'s seed: existing rubric OR the starter draft (our prefill is not the coach's work — Chunk G rider) | "{n} categories and their weights" |
| Accept drawer (`TryoutAcceptDrawer`) | initial state incl. `suggestedDues` prefill | "roster details and {n} fee installments" |

Also in this batch (same forms, same pass):
- **The check-in "Add walk-up" modal** joins the guard list (small form, same loss mode).
- **The evaluator modal** gets the light treatment: dirty = name typed and no link minted yet
  (mirrors the BudgetStarterSheet post-save exemption).
- **Rubric save stops silently dropping typed rows**: a category row with a blank label but a
  typed weight/instruction now blocks save with a named error ("Category 3 needs a name") instead
  of being filtered out.
- **Scroll-lock parity**: the tryout modals adopt `useOverlayOpen` like the Money forms they're
  being aligned to.

The decision-board choice buttons and one-way toggles (reveal names, lock scoring) stay
deliberately guard-free — they are actions, not forms (the codebase's own precedent, preserved).

### WI-3 — Decisions stop auto-emailing: an opt-in switch, and honesty when it's on (D-E9)

**Owner-directed 2026-07-30 (supersedes the always-on + honesty-line design): decision emails are
OPT-IN, default OFF.** Coaches usually deliver decisions personally; the product must not send
emails the coach didn't choose to send.

- **The switch.** "Email families my decisions" sits directly above the decision buttons on the
  Decide tab, **default OFF**. Its state is always visible at the moment of decision. It is
  device-remembered UI state; **the server never emails unless the decision request itself carries
  the flag**, so the failure direction is always "no email" — never an unwanted one. (No
  migration: the flag rides each decision write; there is no stored per-tryout setting to drift.)
- **Switch OFF (default):** Offer / Waitlist / Not this season record status only. No emails, no
  confirm on a pass (nothing outward happens — the tap is fully recoverable). Helper copy under
  the switch says decisions are only recorded here and the coach reaches out themselves. Offered
  rows keep a per-row **"Email this offer"** action — the EXISTING resend machinery (fresh
  Accept/Decline link + deadline), so a coach can selectively give some families the self-serve
  link. Response badges ("Awaiting response" / "Family accepted") appear only once an offer email
  has actually been sent.
- **Switch ON:** the previously-designed behaviour — automatic sends (offer link / waitlist
  update / dignified release note), **a confirm on every "Not this season" tap** naming the family
  and what they receive (an email cannot be unsent, and the button sits adjacent to Offer), and
  the always-visible line saying each choice emails the family right away.
- **In both modes:** the **"no email on file" chip** on any candidate without a guardian email
  (walk-ups) — shown wherever an email could be attempted (switch ON, or the per-row action);
  the **"didn't check in" marker** on decision-board and scoreboard rows, distinct from "not
  scored yet"; **email sends awaited** when they do fire (the Amplify fire-and-forget gotcha);
  and the **guardian's registration notes** made visible (read-only expand on the decision row +
  the accept drawer's identity panel).
- **Copy truing:** the Decide PanelIntro and the "How tryouts work" step 3 currently promise
  "families reply from a secure link in their email" unconditionally — both become
  true-to-the-switch. The org-admin decision surface is untouched this chunk (flagged in §4).

### WI-4 — Depth chart desktop width (f9-2 remainder)

Two fixes, in priority order (discovery's verify pass held that the cap is the smaller half):
1. **`CoachScrollX` adoption is the load-bearing fix** — `DepthChartBoard`'s `.gridScroll` is a
   pre-existing bare scroller with no swipe hint in ANY viewport band. Wrap the table the way
   Budget vs. Actual does, moving the hand-rolled inline `left:` sticky offsets onto the shared
   pin conventions (`--scrollx-pin-gutter`, opaque pin background).
2. **`.pageWide` only when `view === 'depth'`** — via the Schedule page's conditional-class
   precedent (`view === 'depth' ? styles.pageWide : ''` on the same shared module), NOT BvA's
   separate-module shape; the roster list keeps the 960 px reading column.
Verified empirically with Playwright computed styles at 700/960/1100/1280 px (the standing
"scroll bugs are verified with Playwright, never inference" guardrail) — including that the
sticky columns still pin inside the new scroller. Mobile tap-to-cycle untouched (640 seam
unchanged). The board is already sport-neutral (`getSportPack()` positions) — preserve.

### WI-5 — The two Development doors answer two different questions

Copy-level fix (both destinations are genuinely different jobs on one data source — the board is
the working surface, the report is read-only coverage):
- Board door: **"What's each player working on?"** — "Open the team board to set focus areas and
  log where each player is." (write-capable coaches act here)
- Insights door: **"Is everyone getting attention?"** — unchanged (read-only coverage report).
The word "coverage" appears on exactly ONE door after this. Also: the report's **"History linked"**
column is relabelled **"Returning player"** — it measures cross-season identity continuity, not
attention, and mislabelling it undercuts the report's own headline. (The heavier alternative —
fold the report into the board and retire the second door — is recorded in §4 as later.)

### WI-6 — Practice plans placeholder — OWNER DECISION (D4)

The build prompt framed it as a dead-tab violation; discovery pushed back: the card is labelled,
unclickable, and visually demoted — an honest roadmap slot, not a dead click target (Batch 3's
rule was about nav tabs that promise interaction). Both options are one-line changes:
**(a) keep** as-is (optionally pinning its grid position so it always trails), or **(b) remove**
until the feature builds. Recommendation in §6.

### WI-7 — Development-hub honesty trio (the real "blank award picker" fix)

Award TYPES auto-seed and are never blank; the genuine defects are adjacent:
- **"Give an award" on a rosterless team opens a blank player picker** — gate the action where
  `players.length === 0` is already known, with "Add players to your roster first."
- **The Awards Insights report lacks the "no season yet" 404 branch** its three sibling reports
  already have — add the same honest-empty state.
- **`TestTypesManager` hand-rolls its empty state** — swap for compact `CoachEmptyState` (its
  sibling card one section above already uses it). Plus one line of copy distinguishing Test types
  from the tryout scorecard ("objective measurements you track over the season — not the tryout
  scorecard"), which discovery flagged as a confusable pair.

### WI-8 — Evaluator link lifecycle honesty

- The public scorer's header states the link's life ("Active until Sat 6:00 pm" — `expiresAt` added
  to the context GET). The mint modal already says 48 h.
- **Reissue on the SAME evaluator row:** a "New link" action per evaluator (POST
  `…/tryout-evaluators/{id}/reissue` → new token + new 48 h expiry on the same session row).
  Scores stay attached to the same identity — fixing the lost-link case and the two-weekend
  tryout, making the public page's "expired — ask the coach for a new one" copy honest, and
  closing the verified double-count risk (a re-minted second identity gives one volunteer's
  opinion 2× representation in the composite). "We don't show it again" stays true per-token.
- **Mid-session failure stops being silent:** when a score POST fails because the link was revoked
  or expired, the scorer maps it to the same full-screen state it shows on load (today the cell
  quietly reverts and the volunteer keeps tapping into a void). The load-error state gains the
  **"Try again" button its copy already promises**.
- **"Turn off link" gets a confirm** naming the evaluator ("— {name} loses scoring access
  immediately") — instant outward-facing destruction currently fires on one tap.

### WI-9 — Sport-neutrality touch-ups (fix cheap existing instances; add none)

- Hub passes the team's `sport` into `TryoutDayCard` (the tryout-window notice currently always
  runs sportless).
- "Field / diamond" label + "e.g. Diamond 3" placeholder → sport-pack facility vocabulary from
  `lib/sports.ts` where available.
- The rubric starter template **stays diamond-only** (documented carry-over in
  `lib/tryout-rubric-templates.ts` §1.7 — not this chunk's fight).

### WI-10 — The scorer respects check-in

`isCheckedIn` is already fetched by the scorer context and unused. Checked-in candidates sort
first; not-checked-in collapse under a muted divider — an evaluator in sunlight stops scrolling
past no-shows. (Same data, presentation only. The coach-facing halves of the same fact — the
decision-board/scoreboard "didn't check in" marker — live in WI-3.)

### WI-11 — Gate hardening + the offer-email date fix (landmine-sweep results)

The server side is uniformly solid (all 11 routes `denyUnless(capabilities.tryouts)` with IDOR
checks — the reason none of this is a breach today). Client-side, three fixes:
- **The check-in sub-page gets the hub's capability gate** — it is the only tryout surface with
  none (renders for any coach on the team; the hub's own comment names "the direct-URL case" and
  then this page skips it). Same `canManageTryouts` check, same CoachEmptyState.
- **The hub's fail-open becomes transient-only** — `assignment ? check : true` currently fails
  open PERMANENTLY when no assignment exists at all; once `ctxLoading` is false a missing
  assignment means false (the Development hub's pattern).
- **`canWrite` threads through the four ungated cards** (Rubric/Evaluators/Scoreboard/Decision
  Board — only `TryoutDayCard` has the prop today). A no-op while tryouts is all-or-nothing, but
  it converts a page-level invariant into an explicit, reviewable per-component gate.
And one date-guardrail-class bug found in the sweep: **the offer email's "respond by" deadline is
formatted without the org timezone** — `toLocaleDateString` on the raw instant can show a family
the wrong calendar date depending on server runtime. Pass the org zone from `lib/timezone.ts`.

### WI-12 — Rollover warns before stranding a mid-flight tryout

Season rollover carries roster/coaches/budget/fees and **zero tryout data** — rolling with
unresolved candidates (pending review, or offers still out) or unlocked scoring makes the tryout
silently unreachable. The rollover sheet gains a warning line naming the unresolved count
("4 candidates still undecided — the tryout won't carry into the new season") — **warn, never
block** (the coach may be rolling deliberately). Touches the rollover sheet only as one added
line + a cheap count; no rollover mechanics change.

---

## 2. Landmines & contracts (inherited — binding)

- **The product never appears to make the CUT** (D-G1 analogue). Ranking/composites/bias flags stay
  decision support; no auto-suggested cut line, no keep/cut colour semantics. The board's existing
  "spot may have opened" nudge already never auto-offers — preserve.
- Education vs write (Chunk G rule 4); probe as the read-only assistant.
- A LIST becomes cards; a COMPARISON stays a grid; `CoachScrollX` owns scroller+hint (Chunk A).
- Two breakpoints only (900/640); check the `coaches.module.css` primitives header before any new
  @640 rule; `.modalFlushFooter` for tall modals.
- Warm rules: lime as text/border only; all six colour baselines stay ZERO; new CSS joins the
  guardrail at zero literals.
- Dates: `lib/timezone.ts` for any "today"/"days until" math (guardrail at ZERO). Instant-in-time
  comparisons (token expiry) are fine and not calendar math.
- Git: ONE shared `dev`; explicit `:(literal)` pathspecs; shared-file hunk discipline on
  `memory/design_decisions.md` + `TODO.md`; per-action owner OK before any commit.
- Phase auto-select on the hub (land on the right stage once, never yank) — preserve.

## 3. Verification

- **New probe spec** `tests/uat/scenarios/coach-tryouts-smoke.spec.ts` (Money-suite pattern:
  service-role self-provisioning with a marker prefix, asserted teardown, computed styles, scoped
  text assertions, error-check on every provisioning insert):
  1. The scoring door at 360×740 and desktop — Tryout Day tab shows "Score players"; the page
     renders the scorecard; a tap lands a score; the scoreboard shows the "(you)" chip; a second
     GET resolves the SAME self identity (no duplicate evaluator row).
  2. Read-only sweep — an assistant without the tryouts grant sees the empty state on the hub
     AND on the check-in sub-page (the WI-11 gate), no write controls anywhere, and every write
     API (including the new self-score + reissue routes) answers 403.
  3. Discard guard — dirty rubric builder: scrim/Cancel raises the confirm naming the stake;
     a clean form closes silently; a blank-label row with a typed weight blocks save with the
     named error (no silent drop).
  4. Evaluator reissue — old link dies with the honest state screen, new link works, scored count
     survives on the same row (composite unchanged).
  5. Decide-tab emails — the switch renders OFF by default and a decision recorded with it off
     triggers NO email (asserted at the API layer via the probe's own mail-capture or the
     request payload); switching ON makes "Not this season" raise its confirm; "Email this
     offer" works per-row with the switch off; a no-guardian-email candidate shows the "no email
     on file" chip; a not-checked-in candidate is marked on the board.
  6. Depth view — `?view=depth` gets the wide column + the scroll hint while overflowing
     (computed styles at 700/1100/1280 px); the pinned name column stays put mid-scroll.
- `npm run typecheck` (shared modules touched) · `npm test` · focused lint · `verify:changed`
  fully green with **all six colour baselines unchanged**.
- Fresh dev restart before handoff (new files).

## 4. Later / not-this-chunk (each with why)

- **Per-session scoring scope** (day-1 vs day-2 rubrics; check-in and scores currently pool across
  all sessions) — would need scores keyed to a session: **migration territory, out by rule.** The
  WI-8 reissue action covers the TTL half of the multi-day pain.
- **Per-sport rubric starters** — documented §1.7 carry-over; lands with Multi-Sport P2.
- **A second tryout per program year** (spring + fall) — the 1:1 workspace model is a real
  constraint; no owner demand yet.
- **Post-tryout → Development bridge** (tryout categories seeding development baselines) —
  discovery confirmed NO data path exists today; a real idea, its own chunk if wanted.
- **Fold the coverage report into the board** (retire the second door entirely) — the heavier
  alternative to WI-5's copy fix.
- **Generic "resend notification"** on any decided candidate (today only offers resend).
- ~~The org-admin tryout decision surface keeps its current always-email behaviour~~ →
  **RESOLVED 2026-07-30 (owner-directed, built same day as the E commit):** the admin applicant
  surface now follows the same D-E9 opt-in rule — its own switch (default OFF, shared device key
  with the coach board), decline-confirm, truthful toasts, welcome-email behind the switch.
- **Welcome email naming the fees** attached at accept — template work, fast-follow candidate.
- **Coach-side "mark withdrawn"** for a family that calls to pull out.
- **Rubric field polish**: weight-0 "won't count" badge, duplicate-label warning, weight-total
  readout, end-after-start session validation — all real, all small, none load-bearing.
- **Scoreboard "not yet scored (N)" filter** and a session-logistics strip on Tryout Day.
- **The scorer's fixed near-black theme vs its own "sunlight-legible" comment** — flagged;
  a light-surface option is a design conversation, not a tidy-up.
- **Evaluator per-category note field** — server plumbing exists, UI never built; decide
  build-or-remove when the scorer next changes.
- **CASL consent bundling on the public registration form** (marketing consent gates a family's
  ability to receive transactional status emails) — **route to `/strategy`**, not a build item.

## 5. Definition of done

Approved mockups (binding, NEW/RESTYLED/UNCHANGED) · built in one pass · `/simplify` → `/review` →
`/docs` · gate green (§3) · new probe spec passing · fresh dev restart · owner QA · committed on
`dev` with per-action OK · `PROGRAM_COACH_PORTAL.md` §1.1 ticked (P1 #16, P1 #5 remainder, f9-2
remainder, Development-hub polish) + `memory/design_decisions.md` entry + help content updated in
the same unit of work.

---

## 6. Owner decisions

**D-E1–D-E8 RATIFIED at the recommendations 2026-07-30 ("looks great").** Same message added
**D-E9 (owner-directed): decision emails default OFF, opt-in via the Decide-tab switch** — WI-3
rewritten around it; mockups frame 6 revised to rev 2 accordingly. D-E5's confirm-on-pass now
applies only while the switch is on.

| # | Decision | Recommendation |
|---|----------|----------------|
| D-E1 | **How "score as yourself" works.** (a) Authenticated sub-page reusing the scorer component, with a persistent per-coach self identity (deterministic HMAC-keyed session row — no migration, no URL, no expiry; survives devices); (b) silently mint a normal evaluator token and redirect into the public page. | **(a).** (b) puts the head coach's scoring behind an unauthenticated URL in browser history, breaks silently at 48 h mid-tryout, and re-minting splits their scores across identities (verified: a split identity double-counts in the composite). |
| D-E2 | **The coach's own scores in the math.** Exclude self-scores from the bias flag, or treat uniformly? | **Uniform, labelled "(you)".** Their score counts like anyone's (decision support, coach decides anyway), and "you run hot" is fair, useful information. Special-casing the math invents a second scoring model. |
| D-E3 | **The two Development doors.** (a) Copy differentiation (WI-5, cheap); (b) fold the report into the board, one door. | **(a) now, (b) stays on the later list.** The destinations genuinely differ (working surface vs read-only report); the defect is only that both CLAIM to be coverage. |
| D-E4 | **Practice plans card.** Keep (discovery: honest, demoted, unclickable — not a dead-tab violation) or remove (the prompt's lean)? | **Keep** — it meets the honesty bar and removal deletes a true statement about the roadmap. If practice plans have quietly left the roadmap, remove instead; that's an owner fact, not a code fact. |
| D-E5 | **Decline-tap treatment.** (a) Confirm every "Not this season" tap; (b) one first-cut confirm, device-remembered; (c) undo-toast + delayed send. | **(a).** Cuts are low-frequency and sit adjacent to Offer on the same control; the harm (a wrong decline email to a real family) is the feature's worst failure and cannot be unsent. (c) is the slickest but adds deferred-send machinery to a fire-once email path. |
| D-E6 | **Evaluator link reissue on the same row** (WI-8) — new capability, ships? | **Yes.** Fixes lost links, multi-weekend tryouts, and the verified double-count defect in one move. |
| D-E7 | **Rollover warning** (WI-12) — touch the rollover sheet from this chunk? | **Yes, warn-only.** One line + one count; silently stranding a live tryout is a real data-loss-shaped surprise. |
| D-E8 | **Scope check.** The v1 set is WI-1…WI-12 — larger than the prompt's four items because discovery was asked to find more. Trim if wanted; every item is independently droppable except WI-1/WI-2 (the chunk's core). | Build the set as scoped — it is one QA pass over one area, and nothing in it is speculative. |
