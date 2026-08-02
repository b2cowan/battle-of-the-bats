# Tournament Creation Live Preview — Implementation Plan

**Status:** v1 BUILT on `dev` 2026-08-02 (uncommitted) — owner browser QA pending. Companion brief:
`TOURNAMENT_CREATION_LIVE_PREVIEW_PM_BRIEF.md`. Build notes at the bottom of this file.
**Origin:** Ideas Backlog shortlist; grounded 2026-08-02. Approved mockup: section 1 of the
Demo & Preview Mockups artifact (2026-08-02) — the mockup is the visual spec.

## Goal

While an organizer fills in the tournament setup wizard, a live phone-frame preview beside the
form shows their public tournament page assembling itself in real time: the name lands in the
hero, the dates form the range and the "First pitch in N days" countdown, the public link forms.
Creation stops feeling like data entry and starts feeling like watching your event come alive.

## Scope (v1 — slim, per grounding)

- **Desktop-only side panel** inside the existing setup wizard: at viewport ≥ ~1280px the modal
  widens to a two-pane layout (wizard left, phone frame right). Below the breakpoint the panel
  is absent entirely — the current single-pane wizard is unchanged. (The wizard's existing 640px
  mobile collapse is untouched.)
- **Preview binds three things live** from wizard state: tournament name (hero H1; ghost
  placeholder until typed), start/end dates (formatted range + single-largest-unit countdown,
  matching the real Countdown component's behavior), and the derived public link. Divisions
  count may bind once Step 2 entries exist (cheap — same component state); all other hero
  elements render as faithful static dressing.
- **Theming:** the preview renders in the org's current theme (default preset if none). No
  color/theme step is added to the wizard in v1.
- **Both entry paths behave:** blank creation AND the "reuse setup" clone flow (which prefills
  name/dates — the preview shows a fully-formed hero immediately, a nice moment for returning
  organizers).
- **Hero-only, strictly.** The preview mimics the pre-event hero composition only (badge with
  date range + countdown, H1, hosted-by line, register CTA, 3-stat row). No schedule, no
  standings, no live/finished states.

## Drift control (the one real risk)

The real public hero is a server component with live data reads; it cannot render per-keystroke.
The preview is therefore a purpose-built client mimic — which creates a standing risk that a
future hero redesign silently diverges from the preview. Mitigations, in order:
1. Extract the hero's date-range formatting and countdown-text derivation into shared pure
   helpers consumed by BOTH the real hero and the preview (single source for the strings).
2. Keep the preview hero-only and element-minimal (fewer things to drift).
3. A comment-contract on both files naming the other, plus a unit test pinning the shared
   helpers' output.

## Explicit non-goals / open options

- **Theme swatch row (taste-of-premium):** custom colors are Tournament-Plus-gated; live
  repainting during free signup is an upsell decision. OUT of v1 unless the owner opts in.
  If added later: free tier shows the 9 presets only, or full swatches as a deliberate
  premium tease — owner call, and any gating copy goes through the pricing-facts reconciliation.
- No mobile/tablet preview treatment in v1.
- No draft persistence changes — the wizard still submits once at the end.

## Verification

- Manual QA across both entry paths and the 1280px/640px breakpoints (owner browser QA per
  workspace rules).
- Unit test for shared date/countdown helpers.
- `npm run verify:changed`; offer `/review` post-build (touches a large shared wizard component).

## Effort

M. The wizard is a large existing component with two entry paths; layout restructuring plus a
new mimic component is the bulk of the work. No new infrastructure, no schema, no API changes.

---

## Build notes — v1, 2026-08-02 (`dev`, uncommitted)

**What landed**

- `lib/tournament-hero-copy.ts` — the shared strings (drift-control step 1): hero date range,
  lifecycle line ("21 days to go" / in progress / complete), the countdown's single-largest-unit
  duration, the first-pitch ISO target, and the inclusive day count. Pure + client-safe, and it
  takes "today" as an argument so nothing derives a calendar day from the runtime clock.
- `components/public/TournamentHomeContent.tsx` + `components/public/Countdown.tsx` now render
  FROM those helpers (identical output — the extraction is behaviour-preserving).
- `components/admin/TournamentCreationPreview.tsx` (+ `.module.css`) — the phone-frame mimic. It
  mounts the REAL `Countdown` component rather than re-implementing it, so the ticking half can't
  drift at all. Comment-contracts point at each other from both files.
- `components/admin/TournamentSetupWizard.tsx` — a `.wizardDuo` flex wrapper around the existing
  modal; the pane renders on the clone-name pre-step and every main step. The pane hides itself
  below 1280px in CSS (no matchMedia, no hydration flash, no layout participation).
- `previewOrg` prop threaded from the two mount sites (`AdminSidebar`, admin org tournaments page)
  from `useOrg().currentOrg` — no new fetch. Absent org ⇒ no pane, wizard exactly as before.

**Decisions taken during the build**

- Theme resolution mirrors the live tournament layout's rule, not just "the org's theme": an org
  without `advanced_tournament_branding` publishes tournament pages on the platform theme, so the
  preview shows that. Otherwise the org theme. A new draft never has a theme of its own.
- Divisions/team-spots bind only once the organizer REACHES the divisions step (the starter set is
  pre-filled — previewing "6 divisions" on step 1 would show a page they hadn't agreed to). Skipping
  the step un-binds them. The reuse path leaves them unbound (divisions are copied server-side).
- The chooser pre-step ("blank or reuse?") gets no pane — nothing bound yet.
- Registration block uses the product's real strings ("Registration is open" / "Teams can register
  for available divisions now.") rather than mockup-invented copy, with a caption under the phone
  saying this is the page once activated and that a draft is visible to nobody.

**Found + fixed in passing:** the shipped countdown printed "1 minutes" in the final minute before
first pitch (plural tested the raw value, not the floored one). Fixed in the shared helper, so the
public hero, game detail, register page, and the new preview all get it.

**Verification:** typecheck ✅ · focused lint (0 errors) ✅ · `npm test` 946/946 ✅ (18 new pinning
the shared helpers) · token guardrail operator scope back to 0 ✅ · date-correctness ratchet 0 ✅.
`check-schema-parity` fails on pre-existing dev-only coaches-portal migrations — unrelated, untouched.
Owner browser QA outstanding — checklist lives in `OWNER_QA_LEDGER.md` §5.1.

### Funnel run 2026-08-02 — `/simplify` → `/review` → `/docs`

**`/simplify` (4 lenses) — applied:**
- The "which theme does a public tournament page publish in?" rule went from THREE copies (public
  tournament layout, `buildPublicThemeCssVars`, the new preview) to one: `hasOwnTournamentTheme()` +
  `resolvePublicTournamentTheme()` in `lib/public-tournament-theme.ts` (already the client-safe home
  of the shared light-mode vars). All three now call it.
- `firstPlayoffISO` in the hero was an un-migrated copy of the same normalisation — now on the helper.
- Dropped the duplicated `.wizardDuo` wrapper: the modal overlay is already a centred flex row, so
  the preview is simply its second child (`gap` added; the nested confirm is `position:fixed`, out of flow).
- `host` de-stated; theme + `today` memoised per mount instead of per keystroke.
- Skipped: `React.memo` on the pane (the expensive bits are memoised; the tree is ~20 nodes) · sharing
  the hero's static prose (the preview follows the approved mockup, which trims the trailing
  follow-along line; a shared constant would drag the hero's finished/in-progress variants into the mimic).

**`/review` (high-risk tier, 4 lenses) — 3 confirmed defects, all fixed:**
- **High — live public page.** `heroFirstPitchISO(firstScheduledGame?.date ?? startDate, …)` is NOT
  equivalent to the old code: a game always has a date, so the `??` was dead. A timeless game on day
  two moved the real "first pitch in…" countdown off the start date. Restored + commented.
- **Medium — hydration.** `window.location.host` was read during render, and the wizard DOES
  server-render when `/admin/org/tournaments?create=1` opens it. Now `useSyncExternalStore` with a
  server snapshot.
- **Low — honesty.** Division rows with a cleared name were counted in the preview though `save`
  drops them; the preview now counts only rows that will be created.
- Refuted: preview-vs-hero `isPreEvent` gap on a start-date-only tournament (unreachable — both entry
  paths auto-fill an end date). Accepted: `today` is per-mount, so a wizard left open across midnight
  shows yesterday's "days to go" until reopened (the ticking countdown stays right).
- Clean on: cross-org leakage (both mount sites pass the same `currentOrg` that drives the create
  API), plan-gating, server-only imports in the client bundle, `.modalOverlay` gap regressions.

**`/docs`:** `lib/help-content/tournaments.tsx` — the create-a-tournament section now describes the
preview (and that it is display-only), the reuse section notes it arrives pre-filled, and a new
`faq-creation-live-preview` answers "where did my preview go?" (window width + whose colours it
shows). Search keywords/`searchText` updated on both sections so "live preview" is findable.
