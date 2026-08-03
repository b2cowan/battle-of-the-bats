# Coach Portal — Chunk B: "Findability & portal chrome" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-31, at the close of the Chunk C session (C committed `dfab71b6`).
> Chunk B was picked by the owner as the next build.
> **PROCESS IS NON-NEGOTIABLE AND OWNER-MANDATED: a plan + PM brief AND approved mockups exist
> BEFORE any code is written.** No "it's only chrome" exceptions — this chunk is almost entirely
> presentation, which makes the mockups *more* load-bearing, not less. This prompt is self-contained.

---

## The prompt

You are planning and building **Chunk B — Findability & portal chrome** for the premium Coaches Portal.

**The problem in one line:** a coach on a phone cannot reach their notifications at all, cannot tell
Chat from Announcements without opening both, and gets a help icon on fewer than a third of the
pages the product promised one on — so the portal is full of things they own but cannot find.

Follow the full house process, in this order, with a hard stop before code:
1. **Read + verify ground truth** (below). **Verify it — do not trust it.** The Chunk C handoff
   carried two confidently-stated facts that were wrong, and the ledger has been stale before.
2. **Implementation plan + PM brief** (`docs/projects/active/COACH_PORTAL_CHUNK_B_*`).
3. **Mockups as an artifact** — owner approval = binding visual spec; label every region
   NEW / RESTYLED / UNCHANGED.
4. **Owner decisions ratified** (the list below + whatever planning surfaces).
5. Only then: **build the whole approved chunk in one pass** → `/simplify` → `/review` (standard
   tier unless planning finds a write path) → `/docs` → probes → fresh dev restart → owner QA →
   commit on `dev` with explicit per-action OK.

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the ledger.** Chunk B is defined in
   "What's left, grouped into pickable chunks". Tick absorbed items in §1.1 in the same unit of work.
2. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the findings this chunk
   absorbs: **P1 #1** (Chat vs Announcements, f8-0), **P1 #4** (no mobile notification bell, f4-1),
   **P1 #17** (help "?" icons promised everywhere), **P1 #12** (no welcome for cold signups, f0-3).
3. `memory/design_decisions.md` — load-bearing here:
   - **2026-07-31 nav ruling (`4d634258`)** — *"Navigation controls are named by their DESTINATION,
     and a screen has ONE operator door, in the nav."* This is **directly adjacent** to P1 #1 and
     was written by a concurrent stream. Read it before proposing any nav label.
   - **Chunk I (2026-07-30)** — the Overview shows ONE anchor by an ordered rule; **CTAs gate on
     "can complete", never "can see"**. A welcome moment for a cold signup has to live inside that
     resolver, not beside it.
   - **Chunk C (2026-07-31)** — the tab-naming rule (*adding a sibling renames the sibling carrying
     the parent's name*) and the two layout lessons (**a sticky element needs a containing block
     taller than itself**, and **before adding a spacer for fixed chrome, check whether a shared
     rule already reserves it**). Both bite in a chrome chunk.
   - **Quiet Mode (2026-07-29)** — the "Also in your portal" chips were RETIRED. Do not reinvent
     them as the answer to findability.
4. `memory/reference_help_docs_system.md` — help content is single-sourced in
   `lib/help-content/*.tsx` and **search matches keywords, NOT body text**. A help icon that opens
   a guide nobody can find by searching is half a feature.

### ⚠ THIS AREA HAS BEEN MOVING UNDER THREE CONCURRENT STREAMS

More than any chunk so far, Chunk B's ground truth has shifted since the review was written. Before
planning anything, check the state of:
- **the navigation rename** (`4d634258`) — renamed every door by destination, portal-wide;
- **Desktop Phase 2** (`4bebea0e`, `5707272b`) — rebuilt Account and Chat on desktop;
- **Coach Onboarding Quiet Mode** — edited empty states and page headers, and retired the chips.

### The four items you inherit — VERIFIED 2026-07-31, one is already CLOSED

| # | Item | Verified state |
|---|---|---|
| **P1 #2** | Chat has no honest empty state outside a tournament | ✅ **ALREADY FIXED — DROP IT FROM SCOPE.** `components/chat/CoachChatView.tsx` renders `CoachEmptyState` with: *"Only the organizer can open a chat, and only for a tournament your team is entered in — so there's nothing here until then."* That is exactly what the review asked for. **Do not re-plan it.** Tick it in §1.1. |
| **P1 #4** | No notification bell on mobile | **OPEN, confirmed.** The bell lives in `CoachesSidebar` (desktop only — the sidebar is hidden ≤900px). `CoachesBottomNav` has **no bell**. It *does* already carry `useChatUnread` and an `.activeDot`, so there is a precedent for an indicator in that bar — reuse it rather than inventing a second one. A phone-only coach currently cannot reach their notification feed **or** their notification settings at all. |
| **P1 #17** | Help "?" icons promised everywhere | **OPEN. The number has moved: 12 of 41 coach pages carry a `HelpButton`** (the review said 3 of ~25 — other chunks added some). So 29 pages still have none. **Decide the rule, not the list**: which page kinds get one, and what happens on a page whose guide does not exist yet. |
| **P1 #1** | Chat vs Announcements indistinguishable | **OPEN, confirmed** — both labels sit adjacent in the sidebar with no explanation of the difference. ⚠ The nav rename ruling above governs how you may name them. |
| **P1 #12** | No welcome for cold signups | **OPEN for PREMIUM** — the team Overview has no welcome path at all. ⚠ The FREE portal's welcome shipped separately (`e110dc59`); this is the premium coach who never had a free team. Must live inside Chunk I's ONE-anchor resolver. |

### Ground truth to VERIFY at pickup (don't trust, read)

- Re-count the help-button coverage — other streams are still landing.
- What the notification bell actually opens on desktop, and whether that destination works at
  phone width at all (a bell that opens a desktop-only panel is not a fix).
- Whether the nav rename already changed the Chat/Announcements labels.
- Whether the bottom nav's **More** menu has room, or is already at the scroll cap Batch 1 added.
- Whether Desktop Phase 2 introduced an Account-level notifications surface the portal should
  point at rather than duplicate.

### Landmines & contracts (hard-won — respect, don't relearn)

- **⚠ Chrome changes are portal-wide by definition.** Every edit here lands on ~41 pages. Chunk C's
  QA found *two* portal-wide layout defects (a double nav reservation, and a "sticky" bar with no
  travel) that no probe caught because the probes measured controls, not layout. **Measure composed
  layout at 361px with Playwright computed styles, at more than one scroll position.**
- **⚠ Do not add a third standard.** The portal has ONE tap floor (`--tap-min`, 44px) and two
  breakpoints (900/640), both settled in Chunk C. Check the primitives header in
  `coaches.module.css` before any new rule.
- **A help icon is not a feature until its guide is findable.** Search matches keywords only.
- **Education vs write** (Chunk G rule 4): read-only assistants see, never act. A notification
  surface is education; probe as the read-only assistant anyway — that leak class has bitten three
  chunks running.
- **Warm rules:** lime is RESERVED for conversion (2026-07-30); the ink chip is the primary action
  on a screen the user is already using. All colour baselines stay ZERO.
- **Probes:** copy `tests/uat/scenarios/coach-schedule-smoke.spec.ts` (the newest exemplar —
  service-role self-provisioning with a marker prefix, asserted teardown, computed styles never
  screenshots, a deterministic wait helper instead of `if (count) click()`, geometry assertions).
  Creds pattern: `{marker}-head@dev.local` / `{marker}-assistant@dev.local`, `devpass123`, org
  `dev-club-org`. Minimum new coverage: the bell reachable and openable at 360 · every page kind
  that should carry a help icon does · the read-only sweep.
- **Git: ONE shared `dev`, busy tree.** At the time of writing there are **29 commits on dev ahead
  of prod** and at least two other agents active. Diff every shared file, stage explicit
  `:(literal)` pathspecs, audit `git show --stat HEAD`, per-action owner OK, TODO.md left OUT.
  `memory/design_decisions.md` is append-shared — check `git diff HEAD` on it for foreign hunks,
  and read a filtered diff carefully (a *move* renders as delete+add and looks like a loss).
- **Dev server:** new files ⇒ stop server → `rm -rf .next` → restart → verify login 200, no `EACCES`.

### Owner decisions to bring to the mockup round

- **What actually distinguishes Chat from Announcements** — and whether the answer is a rename, a
  one-line description under each, a merge, or a single "Messages" door with two tabs. **Bring a
  recommendation.** Constrained by the destination-naming ruling.
- **Where the mobile notification bell lives** — in the bottom nav (which is full), in the page
  header, or inside More. State what it costs in each place.
- **The help-icon rule** — which page kinds get one, and what a page with no guide yet should do
  (no icon, or an icon that opens the hub).
- **What a cold-signup premium coach sees first**, given the Overview may show exactly ONE card.

### Definition of done

Plan + PM brief + approved mockups (binding, labelled) **before any code** · built in one pass ·
`/simplify` → `/review` → `/docs` · typecheck / `npm test` / focused lint green ·
`verify:changed` fully green with all baselines unchanged · new probe spec passing · layout
measured at 361px · fresh dev restart · owner QA · committed on `dev` with per-action OK ·
`PROGRAM_COACH_PORTAL.md` §1.1 ticked (**including P1 #2, which is already done**) +
`memory/design_decisions.md` entry + help content updated in the same unit of work.

---

## Program state at handoff (2026-07-31, end of the Chunk C session)

- **⚠⚠ A RELEASE IS OVERDUE AND IS THE BIGGER PRIORITY.** Prod is at `cf90d626` (2026-07-29);
  **29 commits sit on dev**, including Chunks A · G · H · E · I · C, the desktop public phase,
  Desktop Phase 2 (Account + Chat), the nav rename, and the free-Overview coherence work.
  **Two things make this more than a backlog:** customers are living with wrong event times that
  Chunk C has already fixed on dev, and **migration 211 is a FUNCTION-only change that the drift
  gate cannot see** — it must be applied to prod by hand before any promote. Raise this with the
  owner before starting Chunk B if it has not already happened.
- **⚠ Chunk C left ONE deliberate step unrun:** `scripts/fix-coach-event-times.mjs` repairs
  event times stored before the fix. It is **dry-run by default and has NOT been applied on dev or
  prod**. Dev dry run: 17 to correct, 8 correctly refused. Owner approved running it (D-C1).
- **Chunks:** A ✅ · G ✅ · H ✅ · E ✅ · I ✅ · C ✅ (`dfab71b6`) · **B = this** ·
  D (parent-facing — still needs the retention-vs-acquisition ruling) · F (frozen past season —
  decided, unbuilt, collision-free alternative if B stalls).
- **A pattern worth carrying:** every chunk since A has found its most serious defect *after* the
  owner looked at it on a real phone. Budget for that — get mockups approved early, build in one
  pass, and hand off with the dev server clean so QA can start immediately.
