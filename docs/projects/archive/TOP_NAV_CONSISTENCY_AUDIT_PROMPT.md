# Investigation prompt — the top nav bar across all four surfaces

> Run this in a FRESH chat. It is an **investigation and recommendation** brief, not a build brief.
> Do not write product code until the owner rules on your findings.

## The question

**Look at the top navigation bar on every part of this app and answer: are we consistent where we
should be consistent, different where we should be different, and does the whole thing make sense
to someone crossing between them?**

The owner asked this after noticing, unprompted, that the header height and content width differed
between an org's public page, the main app, and admin. One of those was drift and was fixed; the
other was deliberate. **That is exactly the kind of judgement this audit has to make, surface by
surface: drift or design?**

## The four surfaces (this is the whole scope)

1. **Marketing** — `/`, `/pricing`, `/for-tournament-organizers`, `/for-leagues`, `/for-clubs`,
   `/for-coaches`, `/changelog`. Rendered by the marketing branch of the shared `Navbar`.
2. **Main app (consumer)** — `/discover`, `/scores`, `/chat`, `/account`, `/following`, plus the
   auth family and the warm sign-up journey. `ConsumerNav` (`variant='consumer'`).
3. **Public pages** — this is really **two** surfaces and you must judge them separately:
   - **Org public**: `/{org}`, `/{org}/league`, `/{org}/teams`, `/{org}/archives` (org branch of
     `Navbar`, plus the new section tab row and — on phones only — the app bottom bar).
   - **Public tournament**: `/{org}/{tournament}/**` (the platform strip via
     `ConsumerNav variant='tournament'`, PLUS the branded event header/`Navbar`, PLUS the desktop
     side rail / mobile tab row). Three chrome layers; already flagged as "at capacity".
4. **Admin / operator** — `/{org}/admin/**` (`AdminTopStrip` + `AdminSidebar`) and the premium
   Coaches Portal `/{org}/coaches/**` (`CoachTopStrip` + `CoachesSidebar`). Also check the
   deliberate exceptions: scorekeeper, check-in, platform-admin, the admin preview shell, and the
   free coach portal (which is consumer-family by ruling).

## Read these first — most of this is already decided, and re-litigating wastes the pass

The value of this audit is finding what **nobody has ruled on**. Ground yourself first:

- `docs/projects/active/NAV_UNIFICATION_PLAN.md` — the execution plan. §3 is the **binding 3-zone
  grammar**; Stage G is the geometry/vocabulary work already done.
- `memory/design_decisions.md` — read the **2026-08-01** entry (chrome-bar height, nav width by
  surface, crumb-vs-tabs) and the **2026-07-31** entries (destination-named controls, ONE operator
  door per screen, the chat-door ruling).
- `docs/agents/strategy/BUSINESS_DECISIONS.md` — the **2026-08-01** entry (app frame is phone-only
  on org pages; section nav is a League/Club benefit) and **2026-07-25** (two-family chrome model).
- `memory/project_navigation_model.md` — the whole program's history and the traps.

**Already ruled — do NOT propose reversing without new evidence:**
- Two bar heights: `--chrome-bar-h` 48px for platform chrome; 72px for a customer-branded identity
  row. Deliberate, not drift.
- Nav **width** differs by surface: tools are full-bleed, branded public pages use the centred
  content column so a customer's name sits above their own content.
- ⇄ = SIDE (flip between two views of one place), plain pill = ENTER (go to a workspace).
- Operator strips carry only genuine leave-this-place doors (wordmark · bell where the hub has one ·
  account · Workspaces). **Chat is deliberately absent from operator strips and deliberately PRESENT
  on the consumer strip** — same icon, different job. Do not "fix" that into consistency.
- The app frame on org public pages is **phone-only**. Adding a desktop strip re-opens a packaging
  decision; it is not a consistency fix.

## What to actually produce

For **each** surface: what the top bar contains, left to right; its height and content alignment;
what it does at phone / tablet / desktop; who sees what (anonymous vs signed-in vs operator).
**Measure, don't eyeball** — the last pass caught a real 4px defect only because it was measured.
Use Playwright against the running dev server.

Then the judgement, which is the point:

1. **Inconsistencies that are DEFECTS** — same job, different treatment, no reason. Rank by how
   likely a real person is to hit them.
2. **Inconsistencies that are CORRECT** — and state the principle that makes them correct, so the
   next person doesn't "fix" them. If a deliberate difference has no written principle, that gap is
   itself a finding.
3. **Things that are consistent but consistently WRONG** — the harder, more valuable category.
4. **Does the whole read as one product?** Cross two or three surfaces the way a multi-hat person
   actually does (fan → their club's page → their admin area → the coaches portal) and say plainly
   whether it holds together.

## Constraints that will bite you

- **The anonymous-public invariant is binding** (plan §5): no new identity fetches, no role-tied DOM,
  no role branching in SSR HTML on public surfaces. Two standing Playwright guards enforce it —
  `tests/uat/scenarios/anonymous-public-invariant.spec.ts` and `org-return-flip-smoke.spec.ts`.
  Run them before and after anything you touch; any proposal that can't stay green doesn't ship.
- **Verify against the running code, not against docs or memory.** Memory files are point-in-time and
  several claims in this program's own history turned out to be stale. Concurrent sessions edit this
  tree; re-check `git status` and current `dev` before asserting anything.
- Dev server: `npm run dev` needs real network access (Supabase). Confirm
  `/platform-admin/login?next=%2Fplatform-admin` returns 200 with no `EACCES` in the log.
- Owner does browser QA; you do measurement and analysis.

## Deliverable

A findings document at `docs/projects/active/TOP_NAV_CONSISTENCY_FINDINGS.md` + a short PM brief,
per `AGENCY_RULES.md`. Lead with a plain-language verdict for a product owner: **does the navigation
read as one product, and what are the three things most worth fixing?** Rank findings by user impact,
separate "defect" from "deliberate", and name which agent owns each follow-up (`/design` for visual
rulings, `/strategy` for anything that is really a packaging call, `/plan` for build work).

**No code changes in this pass** beyond throwaway measurement scripts, which you delete afterwards.
If a finding is a one-line obvious defect, still report it rather than fixing it silently — the owner
wants the map before the repairs.
