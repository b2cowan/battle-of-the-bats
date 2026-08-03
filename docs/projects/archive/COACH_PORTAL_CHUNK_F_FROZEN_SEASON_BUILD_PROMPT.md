# Coach Portal — Chunk F: "The frozen past season" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-31, at the close of the Chunk B session (B committed `b9fe9ff6`, **and it is
> now LIVE ON PROD** — the 2026-07-31 release `beb953ca` promoted everything; `dev` and `master` are
> level). Chunk F picked by the owner as the next build.
> **PROCESS IS NON-NEGOTIABLE AND OWNER-MANDATED: a plan + PM brief AND approved mockups exist
> BEFORE any code is written.** Step 4 below is a **blocking wait on the owner** — not a box you
> tick yourself. This prompt is self-contained.

---

## The prompt

You are planning and building **Chunk F — The frozen past season** for the premium Coaches Portal.

**The problem in one line:** when a season closes, a coach loses the whole portal and keeps two
doors — so the roster, schedule, lineups, attendance, money records, documents and awards they built
all year become unreachable the moment they need to look something up.

Follow the full house process, in this order, with a hard stop before code:
1. **Read + verify ground truth** (below). **Verify it — do not trust it.** The Chunk B handoff
   carried three confidently-stated facts that were wrong, and §0 below already corrects one of this
   chunk's own load-bearing claims. Assume there are more.
2. **Implementation plan + PM brief** (`docs/projects/active/COACH_PORTAL_CHUNK_F_*`).
3. **Mockups as an artifact** — owner approval = binding visual spec; label every region
   NEW / RESTYLED / UNCHANGED.
4. 🛑 **STOP. This step is a BLOCKING WAIT, not a task you perform.** Post the mockup link and the
   decision list (each with your recommendation), then **end your turn and wait for the owner to
   reply.** You may not proceed on your own approval, on a prediction of what the owner will say, or
   because the work seems obvious.
5. Only then: **build the whole approved chunk in one pass** → `/simplify` → `/review` → `/docs` →
   probes → fresh dev restart → owner QA → commit on `dev` with explicit per-action OK.

**The gate, stated as a test you can actually apply:**
- **If you are about to edit a `.ts` / `.tsx` / `.css` file and the owner has not yet replied
  approving the mockups, you have broken the gate. Stop and back the change out.** Writing the plan,
  the PM brief, the mockup artifact and probe *scaffolding* is allowed before approval; changing
  product behaviour is not.
- **Approval of the PLAN is not approval of the MOCKUPS.** If the owner responds to the plan before
  mockups exist, keep going to mockups — do not read it as clearance to build.
- **An ambiguous reply is not approval.** "Sounds good" / "yes" against a message containing several
  decisions means ask which ones, not assume all of them.
- **"execute this prompt" is an instruction to run the PROCESS, not to write code.** The word
  execute in the invocation does not shorten this list.
- The owner has re-stated this gate on every chunk since A, in their words: *plan + PM brief +
  approved mockups BEFORE any code.* Treat a request to skip it as a misunderstanding worth
  confirming, not an instruction to follow silently.

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the ledger** (chunk F entry) and
   **§1.5 carries the full scope + the three governing rules the owner already decided.** Tick §1.1
   in the same unit of work.
2. `memory/design_decisions.md` — load-bearing here:
   - **Batch 3 (2026-07-28)** — closed seasons are a READ-ONLY Season's End surface, *never a wall,
     never a writable portal*. F extends that surface; it must not contradict it.
   - **Chunk I (2026-07-30)** — the Overview shows ONE anchor by an ordered rule. A closed season's
     Overview (if F gives it one) has to answer to that resolver, not sit beside it.
   - **Chunk B (2026-07-31)** — *help belongs to DOORS, not pages*: **every nav destination carries
     a help icon.** F adds nav destinations to a closed season, so each one owes help — and a probe
     already walks the rendered sidebar and will FAIL if you add a door without it.
   - **Chunk B (2026-07-31)** — ⚠ **`isCoachNavItemVisible` is keyed by DISPLAY LABEL.** F changes
     the closed-season door set. Grep that gate before naming anything.
3. `memory/reference_help_docs_system.md` — help content is single-sourced and **search matches
   keywords, NOT body text**.

### Ground truth — VERIFIED 2026-07-31 (one ledger claim is OVERSTATED)

| Claim | Verified state |
|---|---|
| The season-READ resolver exists | ✅ **TRUE.** `lib/coach-season-read.ts` — GET-only, admits closed assignments, and resolves capabilities **from the season's OWN assignment row**. This is what makes governing rule 1 ("same access as when it was live") fall out of the design rather than needing reconstruction. **Reuse it; do not write a second one.** |
| Per-row "read-only past season" write guards exist | ⚠️ **PARTIAL.** They exist and return a 409 with that exact wording — but only on the **roster/player** paths (player detail, development goals, development measurables). They are **not portal-wide**. |
| The closed-season nav | ✅ Exactly two doors — `Season's End` (`/season-end`) and `Insights` (`/history/results`). |
| **"the year-parameterised pattern shipped in Batch 3"** | ⚠️ **OVERSTATED — this is the estimate-breaking correction.** Exactly **ONE** route accepts `?year=` (`wrapped`), and the season-read resolver is used by exactly **TWO** routes (`wrapped`, `history`). |
| **"every rail it needs already exists… not new plumbing"** | ⚠️ **DO NOT PLAN ON THIS.** Roster, schedule/results, lineups, attendance, money records, documents, awards and staff have **no year-parameterised read path at all**. That is genuinely new plumbing for ~8 sections, not "section pages learning a read-only mode". **Re-size the chunk against what you actually find before committing to "medium".** |

### Ground truth to VERIFY at pickup (don't trust, read)

- Walk the **whole** closed-season experience yourself as a head coach and as an assistant, before
  planning. Batch 3 shipped it; the review is a year older than the code.
- Which write routes reject a closed season **today**, and which would silently accept one. The
  answer decides whether F is mostly *rendering* work or mostly *guarding* work — and getting that
  backwards is how the estimate breaks.
- Whether `resolveCoachContext` (the ~49 write routes' resolver) genuinely refuses closed years, or
  merely happens not to be reachable from a closed season's UI. **A guard that only exists in the
  nav is not a guard** — F puts new doors on those sections.
- Whether the Overview can render for a closed season at all, and what Chunk I's resolver does with
  one. (Its anchor kinds are all live-season shaped: game day / next event / season check / lull /
  pre-season / welcome.)

### Owner-DECIDED scope (from §1.5 — do NOT re-litigate, but DO verify feasibility)

1. **Same access as when it was live, for everyone who had it.** Every coach on that season's staff —
   head or assistant — keeps read access to exactly what their capabilities showed them then. An
   assistant who couldn't see money then can't see it in the archive either.
2. **Everything is read-only.** No writes anywhere in a closed season.
3. **…except staff/entitlement management, which stays live — but governs READ access only.** The
   head coach (and, for club teams, the org admin) can still manage the closed season's staff list;
   revoking an assistant removes their read access to that past season. This is the one deliberate
   write surface on a closed season, and it writes only to who-can-see.

### Landmines & contracts (hard-won — respect, don't relearn)

- **⚠ This chunk is a PERMISSIONS chunk wearing a rendering chunk's clothes.** Rules 1 and 3 together
  mean a revoked assistant must lose access to a *past* season immediately. Treat every new read path
  as a potential leak of a former team-mate's data and probe it as the read-only assistant — that
  leak class has bitten four chunks running.
- **⚠ "Read-only" must be enforced SERVER-SIDE, never by hiding controls.** Chunk B's own review
  found a capability gate that fell open on a rename. A closed-season page that merely doesn't draw
  a Save button is not read-only.
- **Do not add a third standard.** ONE tap floor (`--tap-min`, 44px) and two breakpoints (900/640).
  Check the primitives header in `coaches.module.css` before any new rule.
- **Every new nav destination owes a help icon** (Chunk B rule) — and the existing probe enforces it
  by walking the rendered sidebar. Guides that already exist: `premium-season-end`, `premium-insights`.
- **Warm rules:** lime is RESERVED for conversion; the ink chip is the primary action. All colour
  baselines stay ZERO.
- **Probes:** copy `tests/uat/scenarios/coach-findability-smoke.spec.ts` (the newest exemplar —
  service-role self-provisioning with a marker prefix, asserted teardown, computed styles never
  screenshots, a rule walked from the RENDERED nav rather than a hardcoded list, a vacuous-pass
  guard). Creds pattern: `{marker}-head@dev.local` / `{marker}-assistant@dev.local`, `devpass123`,
  org `dev-club-org`. **Minimum new coverage: a revoked assistant is refused at the API, not just in
  the nav · every closed-season write route answers 4xx · each new door carries help.**
- **Git: ONE shared `dev`, busy tree.** At the time of writing prod == dev (clean baseline), but
  **at least two other agents are active in this working copy** and routinely hold files staged
  mid-session. Stage explicit `:(literal)` pathspecs; if another session has files staged, commit
  with `git commit -- <your pathspecs>` so the index's foreign entries are not swept in; audit
  `git show --stat HEAD` every time. `memory/design_decisions.md` and `PROGRAM_COACH_PORTAL.md` are
  append-shared — check `git diff HEAD` for foreign hunks and never revert someone else's entry.
- **Dev server:** new files ⇒ stop server → `rm -rf .next` → restart → verify login 200, no `EACCES`.

### Owner decisions to bring to the mockup round

- **Does a closed season get an Overview, and what does it show?** Chunk I's one-anchor resolver has
  no closed-season state. Options: no Overview (land on Season's End, today's behaviour), a
  read-only board with no anchor, or a new terminal anchor kind. **Bring a recommendation.**
- **How does a coach move between seasons?** A year switcher in the sidebar, a door on Season's End,
  or URL-only. State what each costs a coach with five years of history.
- **How is "read-only" signalled** — once per screen, once per portal, or per control? Batch 3 has a
  precedent; extending it to ~8 sections is where it gets noisy.
- **How far back does the archive go**, and what happens to a team's first season when there is
  nothing before it?

### Definition of done

Plan + PM brief + approved mockups (binding, labelled) **before any code** · built in one pass ·
`/simplify` → `/review` (**high-risk tier — this touches read authorization**) → `/docs` ·
typecheck / `npm test` / focused lint green · `verify:changed` fully green with all baselines
unchanged · new probe spec passing incl. the revoked-assistant case · layout measured at 361px ·
fresh dev restart · owner QA · committed on `dev` with per-action OK ·
`PROGRAM_COACH_PORTAL.md` §1.1 + §1.5 ticked + `memory/design_decisions.md` entry + help content
updated in the same unit of work.

---

## Program state at handoff (2026-07-31, end of the Chunk B session)

- **✅ THE RELEASE IS DONE.** `origin/master` is at `beb953ca` (2026-07-31, marketing-reviewed
  changelog) and **`dev` is level with it — 0 commits ahead.** Chunks A · G · H · E · I · C · B, the
  desktop public phase, Desktop Phase 2 and the nav unification stages are all **in customers'
  hands**. You are starting from a clean baseline, which is unusual — keep it that way.
- **⚠ Chunk B shipped WITHOUT its owner phone QA.** It was committed and the release promoted it the
  same day. Every chunk since A has found its most serious defect *after* the owner looked at it on a
  real phone, so treat a Chunk B phone pass (mobile notifications · the "Email families" rename ·
  help on the five new doors · the cold-signup welcome) as **outstanding post-release work**, and
  fold any defect found into F's session rather than opening a third stream.
- **Chunks:** A ✅ · G ✅ · H ✅ · E ✅ · I ✅ · C ✅ · B ✅ (`b9fe9ff6`, live) · **F = this** ·
  D (parent-facing — still needs the retention-vs-acquisition ruling before it can start).
- **Nav Unification** is mid-flight in a concurrent session (an operator top strip on the admin and
  coach shells). Its Stage H is the one that touches the coach portal. **Owner ruling 2026-07-31,
  binding and already generalized to the admin strip: the strip carries only genuine
  leave-this-place doors — a section of the work is not an exit.** F adds sections; it does not add
  strip doors.
- **A pattern worth carrying:** every chunk since A has found its most serious defect after the owner
  saw it on a real phone. Budget for that — get mockups approved early, build in one pass, and hand
  off with the dev server clean so QA can start immediately.
