# Coach Portal — Chunk H: "Money by Month" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-30, at the close of the Chunk G session (G committed `06f77442` — the budget
> starter). H was owner-raised at G's approval, with the owner's own 24-25 team spreadsheet as the
> reference shape (rows = expense lines under coded categories, columns = Sep–Aug months, a
> prior-season column, "actualized at end of every month"). **Direction is RATIFIED** ("I agree
> with all of your recommendations") — the shape below is decided; presentation details go to the
> mockup round. This prompt is self-contained.

---

## The prompt

You are planning and building **Chunk H — "Money by Month"** for the premium Coaches Portal.

**The problem in one line:** a treasurer-coach runs their season in a month-columns spreadsheet —
what do we pay, when, how did it actually land — and the portal computes all of that but shows
almost none of it: the monthly math feeds one cumulative chart, payables are framed as
tournament-only, and there is no one-page month view, no import, and no forward look at cash.

Follow the full house process: implementation plan + PM brief → mockups as an artifact (owner
approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions → build the whole
approved chunk in one pass → `/simplify` → `/review` → `/docs` → owner QA → commit only with
explicit per-action OK.

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the ledger**; chunk H is defined at
   the bottom of it (and G's entry above it is the state of the surfaces you inherit). §0 = release
   state. **Rule: tick absorbed items in §1.1 in the same unit of work.**
2. `docs/projects/active/COACH_PORTAL_CHUNK_G_BUDGET_STARTER_PLAN.md` — the immediately preceding
   chunk on the same surfaces. Its header carries the build deviations AND the review findings you
   inherit (see landmines).
3. `memory/design_decisions.md` → the **2026-07-30 Chunk G entry** (D-G1 enforcement levels, the
   derived-checklist rule, gating split) **and the 2026-07-30 Chunk A entry** (list-vs-grid,
   `CoachScrollX`, `useDiscardGuard`, layout primitives). Both bind you.
4. `docs/agents/strategy/BUSINESS_DECISIONS.md` → the **2026-07-30 Decided** entry. **D-G1 binds
   ALL of H:** the product never proposes a dollar figure — including import templates and any
   projection copy.

### ✅ Already decided by the owner (2026-07-30) — do NOT re-open

1. **The month grid**: rows = category/line, columns = the season's months, cells = amounts,
   totals both ways; desktop-first; **Budget · Scheduled · Actual · Difference lens toggle**;
   cell drill-ins (a budget cell edits that line's payment periods; an actual cell lists that
   month's paid expenses) **through the EXISTING forms** — the grid is a navigation surface, never
   a new editor.
2. **"Scheduled" is a separate LENS, never a write into the budget column.** Payables do not merge
   into the estimate; nothing double-counts; **no payable↔line link migration in v1** (revisit
   only if lens-flipping proves annoying in use).
3. **Payables generalize beyond tournaments** — the machinery is already category-aware and
   single-amount payables already work; the "Tournament" framing is the only tournament-specific
   part. Plus one **full payment-schedule view** (every commitment by due date, paid filterable).
4. **Import/export templates**, round-trippable: (a) the month grid (rows × month columns → lines
   + dated periods), (b) a simple list (category · line · amount · notes → lump-sum lines),
   (c) a payables schedule (payee · description · category · amount · due date, optional
   deposit/balance columns). All preview-first with per-row outcomes (the roster-importer
   pattern). **Template amount cells ship EMPTY — an example dollar in a downloadable template is
   a product-supplied figure (D-G1).** Chunk G's first-run surface gains an "Import a spreadsheet"
   door when H ships.
5. **Accepted for the plan round** (recommend v1-vs-fast-follow yourself): cash-flow projection
   (dues installments in vs payables + scheduled budget out, by month — "do we run dry in
   July?"); a **"last season" comparison column** for year-2+ teams (rollover already carries the
   data); month-grid export.

### Ground truth — VERIFIED 2026-07-30 by direct read (Chunk G session). Re-confirm what you build on; do not re-derive.

- **The monthly math already runs.** The Budget-vs-Actual API collects months from period dates
  and paid-expense dates, buckets budget-per-month from each line's dated periods, assigns actuals
  to months by paid date — today feeding only the cumulative chart. ⚠ **Lines with NO dated
  periods are distributed evenly across months** in that series — for the grid this needs a
  design ruling: recommend an honest **"no date yet" column**, never invisible smearing.
- **Payables = the expenses table** with a payable type: single amount + one due date already
  supported (the deposit/balance split is an optional disclosure), each half carries its own
  due date and paid-at, **mark-paid posts into the actuals ledger** (the "actualized" moment is
  continuous, not month-end), and the form already has the full shared category picker. The
  Money hub already has an upcoming-payables panel with due-date countdowns.
- **Cash-flow ingredients all exist:** dues installments carry due dates (money in); payables due
  dates + budget periods (money out); expenses carry paid dates (actuals by month).
- **Rollover carries lines + periods + the season envelope** → the last-season column is derivable
  for any rolled team.
- **Chunk G shipped** (dev `06f77442`): first-run starter, derived checklist strip, the fenced
  Riverdale sample, `?starter=1` deep-link, and the taxonomy-ownership check on the lines POST.
  **Expect NO migration for H's views/lenses/export.** Import can loop the existing line + periods
  writes; if a schema change appears, stop and re-scope. (One sanctioned API tweak if import needs
  it: an explicit sort-order on the lines POST — see landmines on write order.)

### Landmines & contracts (hard-won — respect, don't relearn)

- **D-G1 everywhere:** no product dollar anywhere — templates, placeholders, projection labels,
  help copy. `budget_items.suggested_amount` stays NULL for defaults (a probe asserts this).
- **Write order IS display order** on budget lines (sort_order defaults 0; the read has no
  tiebreaker). Chunk G's starter writes sequentially for this reason. An importer writing many
  lines must preserve sheet order — sequential writes, or add an explicit client-supplied
  sort-order to the lines POST (small API change, not a migration).
- **⚠ Verify the line-EDIT endpoint** for the same taxonomy-ownership gap the POST had (hardened
  in G; the PATCH sibling was NOT checked — G's review flagged it).
- **⚠ The desktop sticky-footer overlap class:** tall desktop modals hide their last ~1.5rem
  under the shared sticky footer (fixed locally in G's two sheets — see `footerFlush` there).
  Any tall modal H adds needs the same treatment, and a portal-wide sweep of the other tall
  Money modals (e.g. a budget line with many periods) is in-scope-adjacent — bring it to the
  decision round.
- **Read vs write:** the grid VIEW and lenses are read-allowed (`money: read` sees numbers today);
  every drill-in EDIT, import, and payable write is `write`-gated. **Probe as the read-only
  assistant** — this leak class bit Chunk A (5 findings) and is standing.
- **Import = preview-first, per-row outcomes, never silent all-or-nothing** (Batch 2 binding
  rule). Match update-vs-add explicitly (category + line name), coach chooses; parse names and
  numbers only — never guess data out of prose.
- **A comparison stays a grid** (CoachScrollX, pinned first column, honest hint — Chunk A D1);
  BvA already has the `.pageWide` opt-in; **two breakpoints only** (900/640); check the
  primitives header in `coaches.module.css` before ANY new reflow rule.
- **Warm rules:** no raw lime fills; on-chips join the restore group or use the shipped
  `.segChoice`; olive = text/border/tint; **all six colour baselines stay unchanged**.
- **Sport-neutral copy** in anything new (seeded names like "Umpire Fees" appear only as data).
- **Git: ONE shared `dev`, tree shared with concurrent sessions.** Diff every shared file, stage
  explicit `:(literal)` pathspecs (bracket dirs stage NOTHING bare), **check `git status` for
  foreign STAGED files before committing** — G's first commit swept in another session's staged
  TODO.md hunk and had to be redone (soft reset + restore --staged + recommit). Audit
  `git show --stat`/`--numstat` after. Never commit/push without explicit per-action owner OK.
  TODO.md: edit the file, leave it out of the commit.
- **Dev server:** a supervisor auto-respawns port 3000; verify health (login 200, no `EACCES`)
  rather than fighting it; new files ⇒ stop → `rm -rf .next` → restart before handoff. ⚠ A
  respawn can RACE your purge and die — re-check the port actually answers after.
- **Probes:** extend `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (**19 tests** — do
  not fork; its provisioning recipe + CHECK-constraint gotchas are documented inline). Creds
  `j2-rep-coach@dev.local` / `coach@dev.local` (devpass123). Computed styles, never screenshots.
  Scope text assertions to `main[class*="coachesMain"]`. Error-check every provisioning insert.

### Owner decisions to bring to the mockup round

- **Where the grid lives** (recommend: a "Months" view toggle on Budget vs. Actual — it already
  owns budget/actual/variance, loads every ingredient, and has the wide-page opt-in).
- **The season's month range** (their spreadsheet runs Sep–Aug; recommend deriving from the
  team's actual dated data + season year, with the "no date yet" column).
- **Lens set for v1** (Budget · Scheduled · Actual · Difference confirmed — recommend Difference
  = Budget − Actual, with Scheduled read-only in v1).
- **Cash-flow projection and the last-season column: v1 or fast-follow** (recommend: last-season
  column in v1 — cheap, their own spreadsheet does it; cash-flow as its own mockup frame, owner
  picks).
- **Import v1 scope** (recommend all three templates if the preview machinery is genuinely shared;
  otherwise grid + list first, payables template fast-follow).
- **Payables rename + placement** ("Payables" / "Payment schedule"; where the full schedule view
  lives — the hub panel grown up, or a tab on Expenses).
- **The sticky-footer sweep**: fold the shared fix in here, or log it separately.

### Definition of done

Plan + PM brief (`docs/projects/active/COACH_PORTAL_CHUNK_H_*`), approved mockups, built in one
pass + `/simplify` + `/review` (**HIGH tier if import ships** — it is a new write path; standard
only if import slips to a fast-follow) + `/docs`, typecheck/tests/lint green, **colour baselines
unchanged**, the Money probe suite extended (grid lenses @360 + desktop, read-only sweep, import
preview + per-row outcomes, D-G1 template-emptiness assertion) and passing, fresh dev restart,
owner QA, committed on `dev` with per-action OK, §1.1 + `memory/design_decisions.md` + help
content updated in the same unit of work.

---

## Program state at handoff (2026-07-30, end of the Chunk G session)

- **Prod:** `cf90d626` (2026-07-29 launch release). **Dev ahead of prod:** overlay-hooks
  relocation · admin dropdown consolidation · free-portal welcome (**dev-only migration 211 —
  FUNCTION-only, the drift gate cannot see it; apply to prod BEFORE promoting**) · Chunk A
  `a737acbf` · Chunk G `06f77442` + docs. Route promotion through `/release`.
- **Concurrent-session repairs:** four of their files had mangled import lines mid-session
  (share button, help tooltip, two lineup screens) — repaired from HEAD in the working tree,
  deliberately left uncommitted for their session. If they're still uncommitted at your pickup,
  re-verify typecheck before trusting the tree.
- **Chunks:** B (chrome — still colliding with the concurrent stream), C (schedule intelligence,
  unblocked), D (parent-facing — needs the retention-vs-acquisition ruling), E (tryouts tidy-up +
  two orphans from A), F (frozen past season — decided, unbuilt), **G ✅ committed**, **H = this**.
- **CP-7 CLOSED 2026-07-30:** the guardian model stays **one guardian per player** — the
  multi-guardian expansion is declined; §1.4 shrinks to the name-split work.
