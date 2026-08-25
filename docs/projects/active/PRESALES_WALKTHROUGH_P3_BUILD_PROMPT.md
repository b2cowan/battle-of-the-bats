# Build prompt — Coach walkthrough (Pre-sales P3)

Paste into a fresh session. Owner has already approved this phase; the PM UX summary
requirement is satisfied by the PM brief + approved mockup below — re-present a one-paragraph
UX summary in-conversation before code, then build without further approval gates.

## Mission

Build the head-coach walkthrough: `/for-coaches/walkthrough`, the coach twin of the shipped
tournament walkthrough (`/for-tournament-organizers/walkthrough`, commits `9688ffdc` + `34995f7c`).
Problem-first panels, machine-captured screenshots from the coach demo world, present mode and
the print leave-behind included (both come free if the shared renderer is extracted properly).

## Read first (in this order)

1. `docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md` — the whole program: decisions, review
   results, deferred items, capture gotchas. Binding.
2. `docs/projects/active/PRESALES_WALKTHROUGH_PM_BRIEF.md` + approved mockup (spec):
   https://claude.ai/code/artifact/6f16bc17-d5f3-45b6-bd03-b6df54231f15 — the coach tab.
3. Claude auto-memory `project_presales_walkthrough.md` — capture pitfalls already paid for.
4. The reference implementation: `app/for-tournament-organizers/walkthrough/*` +
   `lib/walkthrough-content.ts` + `lib/marketing-shots.ts` + `scripts/lib/shot-capture.mjs`.

## The build

1. **Extract the shared renderer FIRST.** The /simplify altitude ruling deferred a shared
   walkthrough page component "until the second consumer" — this build IS the second consumer.
   Extract the panel/hero/closing/present/print rendering so both pages consume
   `lib/walkthrough-content.ts` data through one component (repo memory: shared COMPONENT
   beats shared class). The tournament page must not change visually — prove it with
   before/after renders, and mind the CSS-module gotchas (Turbopack `composes` non-transitive;
   no global rules in module CSS; marketing token scope has a ZERO-literal ratchet).
2. **Coach content = the approved mockup's three panels** (mockups are the spec; adding panels
   needs an owner OK first):
   - Fees in your head / unnamed e-transfers → **Player Dues** (installments, overdue
     reminders, Remind all). Plan tag: `Player Dues is part of the Premium Coaches Portal`
     (canon name, never "Premium portal"/"paid plan"; the free portal's Fees tool exists —
     don't erase it, the tournament page's Playoff panel shows the pattern).
   - October refund nightmare → **Season Settlement** (math from the real ledger, block until
     every family is square, one action to close).
   - "Score?" texts while coaching → **bench console / families watch the live score; End game
     sends exactly one notification: the final.**
   Hero: "Run the team. Keep your evenings." · door label "See a coach's season →" (coach door).
3. **Research the coach demo world before writing manifest entries** (fan out readers like P1
   did — it paid for itself): `lib/demo-org.ts` `DEMO_COACH_TEAM_IDS` (five teams, one per
   season phase — pick the team whose PHASE makes each screen photogenic: mid-season for dues
   and game day; season's-end for settlement), exact routes, `ready` selectors proving real
   content (prefer the demo tour's own `data-sandbox-tour` anchors), `prepare` clicks, `clip`.
   ⚠ THEME: the capture core's contexts are `colorScheme: 'dark'`, but the coach portal is
   WARM-themed — verify what a real coach sees and capture THAT; if the core needs a per-shot
   or per-config colorScheme, add it to the shared core (both callers), not a fork.
4. **Capture** with the existing pipeline (`persona: 'coach'`, `door: 'coach'`,
   `npm run capture:marketing-shots`). The coach world re-anchors NIGHTLY: alts/captions must
   be cycle-proof (describe the durable shape, never a number or name the next re-anchor
   changes; the pain headline MAY stage invented old-way specifics). LOOK at every capture —
   the panel sentence must be true of the picture. Door is rate-limited: the core presses once
   per run, never defeat that.
5. **Wire up:** link from `/for-coaches`' pain section (mirror the tournament page's
   `.walkthroughLink`), `app/sitemap.ts` entry, Owner QA Ledger §-row (pictures are the
   blocking check), `TODO.md` pointer, plan + auto-memory updates.
6. **Funnel:** `/simplify` then `/review` (both passes caught real defects on P1 — plan
   records what). Then `verify:changed` — if schema-parity fails, check whether it's the
   PRE-EXISTING dev-only migration drift (other sessions) before blaming this diff, and run
   the post-parity checks individually.
7. **Commit only on explicit owner OK.** Explicit pathspecs; the new PNGs under
   `public/marketing/coach/` MUST be in the same commit (verify:changed hard-requires them);
   `git show --stat HEAD` after; `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Hard rules (from binding docs — do not relearn these the expensive way)

- Demos stay UNGATED; walkthrough routes TO them; ask-first (Start free leads, door second);
  no new nav item; NO demo deep links (front door only — deep-link landings are an open owner
  decision, do not build in passing).
- No prices/promo dates on this surface; full canon plan names only; forbidden-word list and
  "never name competitors" apply to every visible string (docs/agents/brand/BRAND_STRATEGY.md).
- Plain `<img>` on public pages, NEVER `next/image` (P1 /review: first-ever next/image would
  exercise the Amplify sharp path with a recorded outage class).
- Screenshots come only from riverdale-* demo orgs — the capture core enforces it; don't
  weaken the guard, extend it through the shared core if anything's missing.
- Playwright full-page screenshots of walkthrough pages need a scroll-through first (lazy
  images photograph as empty frames — tooling artifact, cost a false alarm once), and
  print-emulation image waits must scope to `/marketing/` images only.
- `npx next typegen` before `npm run typecheck`. Don't restart the shared dev server casually.

## Not in scope

President/club walkthrough (P4, ends in express interest) · demo deep links (owner ruling) ·
sitewide hero/door component cleanup beyond what the renderer extraction itself requires ·
outreach email templates.
