# Theme Toggle Foundation — Build Plan

**Ratified 2026-07-21 (design_decisions.md TH-1…TH-4). Covers the first two steps of the theming
program: the ~2-day color-debt cleanup and the consumer-shell Dark⇄Warm switcher.**
Analysis + all quantified evidence: `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md` (same folder).
Mockup spec: artifact `f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e` rev 1 (Appearance-picker frame + 3-up).
The warm coaches PORTAL build is **not** in this plan — it is gated on round-2 mockups (TH-2).

Discipline: one shared `dev` branch · explicit pathspecs · no commit/push without per-action OK ·
`/simplify` then `/review` after each phase · restart dev server before handoff (shared modules +
new files) · label build vs mockups NEW/RESTYLED/UNCHANGED at owner test.

---

## Phase 0 — Contract prep (no product code)

1. **Theme attribute contract** (already ratified TH-1, restated for the builder):
   - `data-user-theme` on `<html>`: `"dark" | "warm"` (absent = `default`). `default` means each
     shell's current default — consumer shell renders warm exactly as today, coaches portal stays
     dark. Non-choosers must see zero change anywhere.
   - The attribute never re-declares tokens owned by the org/light authorities
     (`data-color-mode` + `buildPublicLightModeCssVars()` stay tournament-scoped; M2 keeps the
     domains disjoint). One injection point per theme.
   - Org-branded surfaces (tournament public, org home, public team pages) and the S1-1/S1-2 warm
     sign-up journey ignore the preference entirely.
2. **Flag to `/db` (prerequisite migration):** a user-level theme preference. Recommend a minimal
   `user_preferences` table (`user_id` PK, `theme text null`) over widening `organization_members`
   (preference is identity-scoped, not membership-scoped; multi-org users must not fork themes).
   `/db` owns the final shape. Data dictionary + snapshots refresh in the same unit of work
   (`npm run refresh:snapshots`, `npm run check:dictionary`).

## Phase 1 — Cleanup (~2 days, invisible, ships first)

1. **`--blueprint-blue` reconciliation.** Change the two declarations in `app/globals.css` to
   derive from the primary family: `--blueprint-blue: var(--primary); --blueprint-blue-rgb:
   var(--primary-rgb);` — OR resolve the open flag the other way (below). Also fix `--glow-blue`
   comment accuracy if it changes resolution.
   - **OPEN FLAG (decide with the owner before shipping the alias — TH-3a):** post-alias, a
     custom-branded org's `--primary` cascades into coaches-portal accents (101 refs in
     `coaches.module.css`) and admin chrome for that org. Options: (a) accept — operator accents
     follow org brand (alias as above, simplest, single-source); (b) pin operator chrome — leave
     `--blueprint-blue` a literal but document it as the *platform-pinned* structural accent and
     add it to the rebrand checklist. The analysis leans (a) for single-source truth; owner call.
   - Verification: manual visual pass over coaches portal (sidebar/bottom-nav/insights doors/modal
     Save buttons), admin dashboard, chat, marketing pricing section — for the DEFAULT org
     (identical values, zero visual change expected) plus one custom-branded org on dev if (a).
2. **Ratchet extension** (`scripts/check-public-tokens.mjs`): add an operator scope — new scan
   roots (`app/[orgSlug]/admin`, `app/[orgSlug]/coaches`, `app/[orgSlug]/scorekeeper`,
   `app/coaches`, `app/platform-admin`, `components/admin`, `components/coaches`) with a
   **separate** baseline file + report doc (`--scope=operator` flag or a sibling script; do not
   conflate with the public redesign baseline). Run `--init` to freeze today's counts
   (admin 211 / coaches 66 / scorekeeper 58 module-css hex). Wire into `npm run verify:changed`.
3. Delete trivially-dead debt while there: the unused `@keyframes pulse-lime`, and swap
   `.btn-danger`'s three raw rgba values onto `rgba(var(--danger-rgb), …)` (exact-value,
   zero-visual-change fixes only — everything else waits for the P2/P3 tranches, tracked in the
   analysis doc §5.2).

## Phase 2 — Consumer Dark⇄Warm switcher

1. **Preference plumbing:** the `/db` migration from Phase 0; GET/PATCH on the account API;
   localStorage fast-path key (e.g. `fl_user_theme`); root-layout no-flash inline script (reads
   localStorage → sets `data-user-theme` before paint; reconciles against the account value after
   fetch — one rare repaint acceptable, same tradeoff density accepts). Consolidate with the
   density script: import one exported constant instead of adding a third hand-copied literal
   (the exported `DENSITY_NO_FLASH_SCRIPT` in `lib/admin-density.tsx` is currently dead — unify).
2. **Pref-aware warm gating:** today the four consumer tabs are warm via the static route check
   (`isWarmSkinPath`). New behavior: consumer-shell routes render warm when pref ∈
   {default, warm}, dark when pref = dark — the warm JOURNEY prefixes (`/start`,
   `/coaches/start|claim|welcome`) stay warm unconditionally. Mechanically this is the
   `ConsumerNav` warm-class gate + the per-tab `warm.warm` wrapper gate becoming
   attribute/pref-aware; the dark rendering of each tab is the components' existing base styles
   (they all carry dark tokens under the warm overlay — verify per tab, this is the QA meat).
   `/account/notifications` follows its tab (fully warm today; must be fully dark under pref=dark
   — never half; the WARM_HOLDOUTS lesson).
3. **Appearance card on Account** (rev-1 picker frame = spec): Dark / Warm options with swatch
   previews; Light shown greyed "coming later" ONLY if `/design` agrees — otherwise omit until it
   exists (no dead controls). **Copy (amended per TH-5 §4):** "Applies to your FieldLogicHQ app.
   Tournament pages always show the organizer's colors." — the coaches workspace is mentioned
   only in the release that actually adds the portal to the toggle (full-coverage rule).
4. **Dynamic `theme-color` meta:** status-bar tint follows the active theme (dark `#0a0a0f`, warm
   paper) on consumer routes; org-branded routes unchanged.
5. **QA gates:** no-flash on hard reload + client nav both themes; signed-out (device-only pref)
   vs signed-in (account wins, cross-device); shared-device sanity (sign-out keeps device pref,
   sign-in overlays account pref); PWA installed-app pass; `npm run verify:changed` +
   `npm run typecheck` (shared modules touched).

## Phase 3 — Round-2 mockups (design round, parallel with Phases 1–2)

**RATIFIED 2026-07-21 (TH-5)** — both carve-outs resolved (chat follows the theme; tryouts warm
with the sunlight floor); the warm-portal build plan now exists:
`WARM_PORTAL_THEME_OPTION_PLAN.md` + `_PM_BRIEF.md` (sequenced after this foundation ships).
Original publication note:
`https://claude.ai/code/artifact/bb6c9b81-6148-4808-aa52-288ec993409f` — schedule add/edit modal +
detail slide-over (RSVP editor) + Month grid/day sheet · the warm drag-and-drop lineup builder
(grip/in-flight/mobile-chevron affordances) · Depth Chart warm board · warm→dark boundary
handoffs. Structures mirror the live screens (dedicated recon pass over the lineup editor + depth
chart board). Carries **four NEW warm decisions** for explicit sign-off: unified live-red clash
cues (lineup builder), olive-alpha playing-time heat ramp, warm 3-tint Best/Okay/Never depth
palette + ink rank numbers (dark board keeps its 2026-07-02 pinned palette), gold-strong A-squad
star on warm. Light theme intentionally omitted (TH-3 deferral); Tryouts + Coach Chat remain
carve-out decisions at build-plan time. Ratification of this artifact unlocks writing the
warm-portal build plan.

## Explicitly out of scope here
Warm coaches portal build (own plan after round-2 ratification) · operator debt tranches P2–P4
(standing background workstream per analysis §5.2) · Light theme build · runtime platform brand
editor · admin/scorekeeper theming.

## Success criteria
- A coach/fan flips Dark⇄Warm on Account and the four consumer tabs follow instantly, no flash,
  on every device once signed in; tournament pages never change.
- Non-choosers see pixel-identical surfaces everywhere.
- The operator ratchet fails CI on any NEW hard-coded hex in admin/coaches/scorekeeper.
- Post-alias, one token edit provably moves every blueprint-blue consumer (or the pin decision is
  documented — whichever way the open flag lands).
