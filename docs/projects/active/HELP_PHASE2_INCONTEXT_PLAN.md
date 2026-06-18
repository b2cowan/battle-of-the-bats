# Help System Redesign — Phase 2: In-Context ("?") Help — Implementation Plan

**Status:** Approved-pending-build — all six owner decisions RESOLVED 2026-06-18 (§9). Build sequencing agreed; awaiting the owner's final "go" to start Wave 0. No code until that go.
**Created:** 2026-06-18
**Branch:** `dev` (all work; never `master`).
**Parent plan:** [HELP_SYSTEM_REDESIGN_PLAN.md](HELP_SYSTEM_REDESIGN_PLAN.md) — this expands its §9 "Phase 2", §5(iii) drawer target-state, and §6 pattern matrix into a build-ready spec.
**PM brief:** [HELP_PHASE2_INCONTEXT_PM_BRIEF.md](HELP_PHASE2_INCONTEXT_PM_BRIEF.md)
**Prerequisite — MET:** Phase 1 (single-scroll guides) and Phase 1.5 (content accuracy audit, all guides) are **built and committed on `dev`**. Guide content is now accurate, which is the gate that lets us surface it prominently on the work pages.

This is **Layer 2 — Contextual** of the three-layer help model (L1 Reference = guide pages; **L2 Contextual = this phase**; L3 Discovery = Phases 3–4). Phase 2 makes the now-accurate guide content reachable *on the page where the work happens*, without leaving the page.

---

## 0. MOCKUP-FIRST SIGN-OFF (per §15 convention)

**Clickable prototype:** [`help-phase2-incontext-prototype.html`](help-phase2-incontext-prototype.html) — open in a browser.

It demonstrates, on a faux tournament admin page:
1. **The "? Help" button** in the work-page header (mirrors the existing "Scorekeeper" button styling/position).
2. **The HelpDrawer slide-over** — click "? Help" → a 420px right-edge panel slides in, renders the relevant guide section inline (summary + prose + steps + FAQ accordion), and links out to the full guide. Backdrop / ✕ / Escape close it; focus returns to the button.
3. **Per-page mapping** — switch the page (Divisions / Schedule / Registrations) and the same "?" opens a *different* guide section, proving the one-line-per-page mapping. Schedule maps to *two* sections shown in order.
4. **FieldHint** — the always-visible muted sentence under the "Pool play" and "Entry fee" labels.
5. **Fixed HelpTooltip** — the small "?" badges next to "Pending Review" — they toggle on tap (touch-safe), close on tap-away/Escape, and take keyboard focus.
6. **Heads-up warnings** — warning callouts adjacent to "Clear Bracket" and "Publish" that state the consequence *before* the click.

**This satisfies the §15 mockup-first gate for Phase 2.** The owner signs off on this look/interaction before any component is built.

---

## 1. SCOPE — five deliverables

| # | Deliverable | New/Fix | Pattern-matrix row it fulfils |
|---|---|---|---|
| A | **HelpDrawer** "?" entry point on every work-page header | New primitive | "Answer a deep question without leaving the page" |
| B | **FieldHint** inline always-visible field-hint primitive | New primitive | "Explain a field that needs 2–3 sentences" |
| C | **HelpTooltip** touch + keyboard fix | Fix existing | "Label a control whose name is non-obvious (one sentence)" |
| D | **Heads-up warnings** before irreversible / high-impact actions | Apply existing HelpCallout | "Warn before an irreversible action" |
| E | **Help entry point on the standalone coaches portal** (none today) | New wiring | — (coverage gap surfaced in Phase 1.5) |

**Out of scope for Phase 2** (deferred to later phases per parent plan): the lifecycle Guidance Rail, "Did you know?" capability spotlights, the persona-journey panel, SetupChecklist, and guided tours (all Phases 3–5). The broad accessibility/token sweep of the *existing* help CSS is Phase 4 — Phase 2 only ships its **new** components a11y-clean and fixes the **one** touch-broken tooltip.

---

## 2. CONFIRMED DECISION — HelpDrawer, not deep-link

The parent plan's **Decision 2 was settled on 2026-06-17 (§12): build the HelpDrawer slide-over, not a deep-link-in-new-tab.** Nothing in the current code changes that call — if anything it reinforces it:

- The codebase already has two right-edge panel precedents to model on (`PlanArticlePanel`, the `RulesAdmin` samples drawer) and a fully a11y-complete overlay to copy behaviour from (`BottomSheet`), so the drawer is not a from-scratch risk.
- Keeping the operator on the page (no new tab, no lost filter/scroll state) is the whole point of L2; a tab-switch breaks task context, which is the problem this phase exists to fix.
- The drawer also gives us the surface that L3 (Phase 3) "I want to…" shortcuts plug into, so building it now is load-bearing for later phases.

The drawer's **"Open the full guide ↗"** footer link preserves the deep-link affordance for anyone who wants the whole guide — we get both, drawer-first.

**Decision stands. Phase 2 builds the HelpDrawer.**

---

## 3. ARCHITECTURE (the shared foundation, built once)

Four small pieces of plumbing unlock all five deliverables. Build these first; everything else is wiring.

### 3.1 Content lookup — a module registry + a shared section-id helper
**Problem found in code:** there is **no central registry** — every guide page imports its content module directly, and the section-id fallback logic (`section.id ?? slugify(heading)+'-'+index`) lives **inline** in `HelpPageLayout`. The drawer needs to fetch "section X from module Y" programmatically and resolve ids the *same way the rendered guide does*.

**Build:**
- `lib/help-content/registry.ts` — `helpModules: Record<HelpModuleKey, HelpPageContent>` mapping `'tournaments' | 'coaches' | 'registrations' | …` to the existing content objects. (Pure index; no content moves.)
- Extract the id-resolution into `lib/help-content/index.ts` as `resolveSectionId(section, index)` and have **both** `HelpPageLayout` and the registry use it, so drawer anchors and guide anchors never drift.
- `getHelpSections(moduleKey, ids[])` helper → returns the matching `HelpSection[]` in the order requested. Missing id → dev-time console warning + graceful skip (never throws on a work page).

### 3.2 Extract the per-section renderer — `HelpSectionBlock`
**Problem found in code:** the per-section render (heading → summary → links → content → FAQ accordion, `HelpPageLayout` ~lines 440–494) is **inline** in the guide layout. The drawer must render a section *identically* (same FAQ accordion behaviour, same prose styling).

**Build:** extract that block into `components/help/HelpSectionBlock.tsx` taking `{ section, faqs, variant: 'guide' | 'drawer' }`. `HelpPageLayout` consumes it (no visual change to the guide); the drawer consumes it too. Keep the FAQ `<details>` **uncontrolled** (the deliberate Phase-1 fix — controlling `open` snapped it shut on re-render).

### 3.3 The drawer + its provider
- `components/help/HelpDrawer.tsx` — right-edge slide-over. Models structure on `PlanArticlePanel`, copies overlay behaviour from `BottomSheet` + focus-restore from `FeedbackModal` (see §6 a11y).
- `components/help/HelpDrawerProvider.tsx` + `useHelpDrawer()` — a **single** drawer instance mounted once at the admin layout (and once in each coach shell). Pages don't mount their own drawer; they call `openHelp({ module, sectionIds, pageLabel })`.
- `components/help/HelpButton.tsx` — the "? Help" trigger (styled `btn btn-ghost btn-data`, mirrors the Scorekeeper button). Calls `openHelp(...)`. Used directly by hand-rolled headers.

### 3.4 The page→section mapping (how a page declares its help)
- Add an optional prop to the shared header: `TournamentAdminHeader({ …, help?: { module, sectionIds: string[], label?: string } })`. When `help` is present, the header renders `<HelpButton>` in its actions slot automatically — **one line per page**, co-located with the header it already renders.
- Hand-rolled-header pages (communication, summary, archives, settings, settings/event, notifications, registration-fields) render `<HelpButton help={…} />` directly in their existing header markup.
- The map of page → section ids is small and lives with each page (not a separate config file) so it stays honest when a page changes. Initial map in §5.

### 3.5 FieldHint (trivial)
- `components/help/FieldHint.tsx` → `<p className={styles.fieldHint} id={id}>…</p>`, muted (`--white-40`), associated with its input via `aria-describedby`. No state, no interaction. Add `.fieldHint` to `help.module.css` using tokens (not hex).

---

## 4. DELIVERABLE DETAIL

### A. HelpDrawer "?" entry point

**What the user sees & does.** A quiet "? Help" button in the top-right of the page header, next to Export/Add. Clicking it slides a 420px panel in from the right showing *this page's* guide section(s): the section heading, one-line summary, the prose/steps, and the section's FAQ accordion — then a footer link "Open the full guide ↗" (new tab, scrolled to that section) for the whole picture. Backdrop click, the ✕, or Escape closes it; focus returns to the "?" button.

**Where it appears.** Every tournament-organizer admin page header (see rollout §5). One drawer instance per shell; the button is what's per-page.

**Roles / plans.** Visible to anyone who can see the admin page (owner/admin). Help is **not paywalled** — the drawer renders the same content the (free, relevance-gated) guide shows. Plan-gated *features* referenced inside a section (e.g. Playoff Wizard = Plus) keep their in-prose "Plus" labelling exactly as the guide already states it; the drawer adds no new gating.

**Reuse of existing content.** 100% reuse — the drawer renders existing `HelpSection`s via the shared `HelpSectionBlock`. **No new help copy is authored for Phase 2.** If a section needs more detail, that edit happens in the content module and flows to *both* the guide and the drawer (single source of truth preserved).

**Anti-overwhelm.** Pure **pull**: user-initiated only, never auto-opens, no badge/dot/pulse, no "new!" nag. Invisible cost to returning users (a quiet icon they ignore until needed). Shows one section's worth of content, not the whole guide. Closing is one gesture.

**Accessibility.** `role="dialog" aria-modal="true"`, `aria-labelledby` = section heading; focus moves into the drawer on open and is **trapped**; Escape + backdrop close; focus **restored** to the "?" button on close (the `FeedbackModal` `restoreFocusRef` pattern); body scroll locked while open (`BottomSheet` pattern); the slide animation is covered by the global `prefers-reduced-motion` guard. Button: `aria-haspopup="dialog"`, `aria-label="Help: <page>"`, `:focus-visible` ring. z-index **700** (above page chrome/bottom-sheets at ≤600, below the global modal at 1000 so any modal opened from inside the drawer still overlays correctly). On ≤640px the drawer becomes a full-screen sheet (still slides from the right; not the bottom-sheet pattern).

### B. FieldHint

**What the user sees & does.** A short (1–2 sentence) muted line directly under a form field's label — always visible, no click. Clarifies a genuinely non-obvious control inline.

**Where it appears.** Only on the highest-confusion fields, never blanket. Initial targets: **Divisions** modal (pool count, "inherit vs override" fee behaviour, requires-pool-selection), **Schedule generator** controls (game length, rounds, bracket type), **Registration** bulk-action menu (every action emails the coach; only accepted teams schedule).

**Roles / plans.** Visible to anyone who can see the field. No gating.

**Reuse of existing content.** Short hints are drawn from the *same wording* the guide uses for that concept, kept to one sentence; the field's deeper "?" drawer (the section) carries the full explanation. (FieldHint = the 2–3-sentence case the tooltip is too small for; the drawer = the full case.)

**Anti-overwhelm.** Always-visible but visually subordinate (`--white-40`, 0.76rem). **Not dismissible** — it's a label clarifier, not a nag, so there's nothing to suppress. Discipline: a hint must earn its place (only where the control name is genuinely ambiguous); we do **not** hint every field.

**Accessibility.** Plain visible text (not an icon/hover affordance), wired to its input via `aria-describedby` so screen readers announce it on field focus.

### C. HelpTooltip fix (touch + keyboard)

**What's broken (confirmed in code).** The popover has `pointer-events:none` (its content/links are unreachable by touch); the outside-click handler uses `mousedown` (doesn't reliably fire on iOS taps, so a tap flashes it open then it can't be closed/used); there are no keyboard handlers (no `onFocus`/`onBlur`, no Escape); and the ARIA is inconsistent (`role="tooltip"` paired with `aria-expanded`). On an iPad doing game-day check-in, every "?" badge is currently useless.

**The fix.** Restore `pointer-events` on the popover; replace the `mousedown` outside-click with `pointerdown` (touch-safe); add `onFocus`/`onBlur` so keyboard users can open it and Tab-away closes it; add Escape-to-close; set `aria-describedby` on the trigger → popover `id` and drop the `aria-expanded`/`role` mismatch; add a `:focus-visible` ring. Hover behaviour is unchanged for mouse users. (Mirrors the parent plan §6 "HelpTooltip (fixed)" spec.)

**Where it appears / reuse.** This is a **fix to the existing shared component** — it instantly repairs all current usages (accounting, rep-teams, ledger, allocations, dashboard checklist, house-league, org members, platform-admin). No content change; behaviour-only.

**Roles / plans.** Wherever it's already used; unchanged.

**Anti-overwhelm.** No change to *when* tooltips appear — the fix only makes the existing ones work on touch/keyboard.

**Accessibility.** This deliverable *is* the accessibility fix. After it: keyboard-openable, Escape-closable, touch-usable, screen-reader-correct (`aria-describedby`).

### D. Heads-up warnings before irreversible / high-impact actions

The irreversible-action audit found the consequences are **already well-disclosed** for Publish (two-step confirm), Clear-bracket (danger confirm), Format-change, Mark-Completed-via-Event-Settings, Activate, and **Seal (best-guarded — already a `HelpCallout variant=warning`)**. Phase 2 therefore does **not** add warnings everywhere — it closes the *specific gaps* where a permanent consequence is surfaced nowhere before the click:

| Gap (verified) | Phase-2 treatment |
|---|---|
| **Tournaments-list dropdown sets Completed / Archived with ZERO confirm** — a mis-click silently locks or hides a tournament | Add a confirm dialog matching the Event-Settings copy + a one-line consequence ("locks all data" / "hides from public, frees the slot"). Highest-priority fix in this set. |
| **Unpublish** copy doesn't say registration *stays closed* | Add one clarifying line to the existing unpublish confirm copy. |
| **Clear bracket** doesn't mention *entered scores are lost* | Add a `HelpCallout variant=warning` adjacent to the Clear-bracket button (visible only when a bracket exists) + the line to the confirm. |
| **Publish** silently schedules coach reminder emails | Add the "schedules a reminder email to each coach" line to the adjacent pre-publish warning callout (the callout already exists for the reg-close case). |
| **Delete tournament** copy is inaccurate ("teams remain") | Correct the confirm copy to state registration/division data becomes inaccessible. |

**What the user sees & does.** Where a callout is used, a warning-styled box sits next to the action button stating the consequence in plain language *before* they click. The existing confirm dialog remains the second gate (the callout is not a substitute — it sets the expectation; the confirm captures intent).

**Where it appears.** Adjacent to the specific action (Schedule page: clear-bracket + publish; Tournaments-list + Event-Settings: status changes). **Just-in-time** — a warning renders only when its risky state is present (a bracket exists, a division is still open, an unsealed completed tournament exists — exactly like the existing Seal callout).

**Roles / plans.** Visible to whoever can perform the action (owner/admin; some money actions owner/treasurer-only — unchanged).

**Reuse.** Uses the existing `HelpCallout` (`variant=warning`) component and confirm-dialog (`FeedbackModal`) patterns. No new component.

**Anti-overwhelm.** Two tiers, deliberately different:
- **Teaching tips** (e.g. a first-time "here's what publishing does" tip) → dismissible, `flhq-help-dismissed-*` key, invisible to returning users.
- **Permanent-consequence safety warnings** (clear-bracket, archive, delete, publish-closes-reg) → **persist whenever the risky state is present** (NOT permanently dismissible), matching the Seal precedent. A safety warning you can dismiss forever isn't a safety warning. **(This split is owner Decision 9.1.)**

**Accessibility.** Warning is conveyed by text + icon, not colour alone; the warning callout's dismiss button (where present) has an `aria-label`; confirm dialogs already trap focus.

### E. Standalone coaches-portal help entry point

**What's missing (confirmed).** The standalone `/coaches/**` portal has **no help anywhere** — no page, no link, no "?". The coaches guide content exists and was rewritten standalone-first in Phase 1.5, but it's only reachable from the org-linked workspace and the admin/platform-admin hubs. Additionally, the org-linked coach portal's **mobile bottom nav has no Help link** (only the desktop sidebar does).

**What we ship.**
1. **Wire a standalone help page** at `/coaches/help` rendering the existing coaches content via `HelpPageLayout` (same as the org-linked `coaches/help` page — one thin shell, same content module).
2. **Add a "Help" entry to `CoachPortalShell`** — in the desktop rail footer (between "Send feedback" and "All workspaces", with the `HelpCircle` icon the org-linked sidebar already uses) and in the mobile "More" sheet (before "Sign out").
3. **Close the org-linked mobile gap** — add the same Help item to `CoachesBottomNav`'s "More" sheet.
4. **(Lower-priority tail of Phase 2)** a coach-scoped **"?" HelpDrawer** on the team work pages (roster, schedule, fees, announcements), reusing the same HelpDrawer + coaches module, mapping each page to its coaches section. If the foundation (§3) is built, this is cheap; if time-boxed, ship the entry-point + page first and fast-follow the drawer.

**What the user sees & does.** A coach in the free standalone portal gets a Help link (desktop rail + mobile More) that opens the full coaches guide — for the first time. With the tail, a "?" on each team page opens the relevant section inline.

**Roles / plans.** All coaches (the standalone portal is free). Premium-only content inside the guide keeps its existing "Premium" labelling.

**Reuse.** Same coaches content module, same `HelpPageLayout`/`HelpDrawer`. No new content.

**Anti-overwhelm.** A quiet link in the chrome; the optional "?" is pull-only like the admin drawer.

**Accessibility.** Help nav item is a real link/button with label; drawer (if shipped) inherits the §6 a11y. Note the two coach surfaces differ in auth/context (standalone uses `basicTeamId` + Supabase auth; org-linked uses `teamId` + org auth) — the drawer's `module='coaches'` mapping is identical across both; only the shell it mounts in differs.

---

## 5. STAGED ROLLOUT

Build the foundation once, then roll the cheap per-page wiring outward. Each wave is independently shippable and reviewable.

**Wave 0 — Foundation (no user-visible change yet).** §3: registry + `resolveSectionId` + `getHelpSections`; extract `HelpSectionBlock` (refactor guide layout to use it — verify no visual regression); build `HelpDrawer` + provider + `HelpButton`; build `FieldHint`; **fix `HelpTooltip`** (ships value immediately on its own — repairs every existing usage). Add the `help` prop to `TournamentAdminHeader`.

**Wave A — Highest-confusion pages (the proof).** Wire the "?" on **Divisions, Registrations, Schedule, Results** (the four densest / most-asked pages; Divisions and Registrations currently have *zero* help). Add **FieldHint** to the Divisions modal + Schedule generator + Registration bulk menu. Add the **heads-up warnings**: clear-bracket + publish (Schedule), and the **Tournaments-list dropdown Completed/Archived confirm** (the biggest safety gap). This wave alone delivers the bulk of the operator value.

**Wave B — Remaining shared-header pages (one-liners).** Add the `help` prop mapping to **Venues, Check-in, Staff Kit, Rules, Branding, Data Tools** (all use `TournamentAdminHeader` → literally one line each).

**Wave C — Hand-rolled-header pages.** Add `<HelpButton>` to the custom headers on **Communication, Summary, Archives, Settings, Settings/Event, Notifications, Registration-fields**. Slightly more than one line (their headers aren't the shared component) but mechanical.

**Wave D — Coaches portal (deliverable E).** Standalone `/coaches/help` page + Help entry in `CoachPortalShell` (desktop + mobile) + org-linked mobile bottom-nav fix. Then the optional coach team-page "?" drawer tail.

**Initial page → section map (Wave A/B/C):**

| Page | Module / section id(s) |
|---|---|
| Divisions | `tournaments` / `divisions-and-pools` |
| Registrations | `tournaments` / `registrations-and-teams` |
| Schedule | `tournaments` / `recipe-build-tournament-schedule`, `schedule-playoffs` |
| Results | `tournaments` / `scores-and-results`, `recipe-finalize-tournament-scores` |
| Venues | `tournaments` / `venues-contacts-rules` |
| Check-in | `tournaments` / `scores-and-results` *(check-in lives within game-day; confirm during build)* |
| Staff Kit | `tournaments` / `scores-and-results` *(scorekeeper handoff; confirm)* |
| Rules | `tournaments` / `venues-contacts-rules` |
| Branding | `tournaments` / `public-communication`, `public-site-preview` |
| Data Tools | `tournaments` / `data-tools-imports` |
| Communication | `tournaments` / `public-communication` |
| Summary | `tournaments` / `recipe-closeout-tournament` |
| Archives | `tournaments` / `recipe-closeout-tournament` |
| Settings / Settings·Event | `tournaments` / `settings-and-access` |
| Registration-fields | `tournaments` / `registrations-and-teams` |
| Coach team pages (tail) | `coaches` / `recipe-add-player` · `recipe-build-coach-schedule` · `recipe-track-dues` · `recipe-announcements` |

*(A few mappings above are best-guesses to verify against the live section content during the build — flagged with "confirm".)*

---

## 6. ACCESSIBILITY SPEC (new components ship clean)

| Concern | Implementation source |
|---|---|
| Portal to `document.body` | `BottomSheet` pattern |
| Backdrop-click + Escape close | `BottomSheet` keydown listener |
| Body scroll-lock on open, restored on close | `BottomSheet` |
| `role="dialog" aria-modal="true" aria-labelledby` | `BottomSheet` |
| Focus moves into drawer on open; **focus trap** within | new (Tab-cycle within drawer) |
| Focus **restored** to "?" trigger on close | `FeedbackModal` `restoreFocusRef` |
| `onClose` stored in ref (avoid inline-arrow churn) | `FeedbackModal` lines 41–44 |
| `prefers-reduced-motion` | global guard (globals.css ~1005) covers the slide; no per-component block needed |
| `:focus-visible` rings on "?", drawer ✕, tooltip "?" | new (help.module.css, token-based) |
| Tooltip: `pointerdown` outside-click, `onFocus/onBlur`, Escape, `aria-describedby`, `pointer-events` restored | deliverable C |
| FieldHint: visible text + `aria-describedby` on input | deliverable B |

Broad retrofit of `:focus-visible`/reduced-motion across the *existing* help CSS remains **Phase 4** — Phase 2 only guarantees its *new* surfaces and the tooltip fix are clean.

---

## 7. VERIFICATION

- **Static (resource-aware, per AGENCY_RULES):** `npm run lint:focused -- <changed files>` per wave. **Full `npm run typecheck`** is required because Wave 0 touches a shared module (`lib/help-content/index.ts` contract + the extracted `HelpSectionBlock` consumed by `HelpPageLayout`). Re-run typecheck after any wave that touches shared code.
- **Restart rule:** Wave 0 adds new component files and edits a shared module → **dev server must be restarted** (stop → `rm -rf .next` → `npm run dev`) before browser handoff. Batch restart-required changes and restart once near handoff.
- **Browser sign-off (owner):** per wave — open a page, click "?", confirm the right section renders and Escape/backdrop/✕ all close with focus returning; tab to a tooltip and open it with the keyboard, then tap it on a touch device / responsive mode; confirm FieldHints read sensibly; trigger each heads-up warning's risky state and confirm the consequence shows before the confirm dialog. Coaches: confirm the standalone Help link appears (desktop + mobile) and opens the guide.
- **Regression watch:** the `HelpSectionBlock` extraction must not change the guide's appearance or the FAQ accordion's uncontrolled toggle behaviour (the Phase-1 scroll-snap fix). Verify a guide page still scrolls/deep-links correctly after the refactor.
- **Offer `/review`** after Wave 0 (new shared logic) and Wave A (new applied surfaces) per the CLAUDE.md post-edit-review rule. Offer `/docs` only if any *content* wording changes (Phase 2 is mostly mechanism, not copy).

---

## 8. RISK & SIZE

**Low-to-moderate risk, fully reversible** — additive UI plus one component fix; no schema, no billing, no customer data. Foundation (Wave 0) is the only non-trivial piece (a shared-layout refactor + a new overlay); Waves A–D are mostly one-line wiring. Rough size: **Wave 0 ≈ 2–3 focused days; Waves A–D ≈ 2–3 days total.** Biggest regression surface is the `HelpSectionBlock` extraction (mitigated by the no-visual-change verification above).

---

## 9. OWNER DECISIONS — RESOLVED (2026-06-18)

All six confirmed by the owner; recommendations accepted across the board. These are now binding for the build.

**9.1 — Permanent-consequence warnings: SPLIT (not all dismissible).** ✅ Teaching *tips* are dismissible (invisible to returning users). Genuine *safety* warnings (clear-bracket, archive, delete, publish-closes-registration) **persist whenever the risky state is present** — not permanently dismissible — matching the existing Seal warning. The anti-nag guarantee is just-in-time rendering: a safety warning shows only when the risky action is actually possible, so it is never wallpaper.

**9.2 — Coaches: entry-point + page first; in-page "?" drawer is a fast-follow.** ✅ Committed Phase-2 scope for coaches = the standalone `/coaches/help` page + the Help entry points (desktop rail + mobile, plus the org-linked mobile-nav fix). The coach team-page "?" drawer ships as a fast-follow within Phase 2 after the foundation is live and we've seen which coach pages actually cause confusion.

**9.3 — Bundle the Tournaments-list dropdown confirm fix into Phase 2.** ✅ Yes. The unguarded Completed/Archived dropdown (zero confirm today) is fixed in this phase, since we're editing the warning copy on those exact actions and the phase's success criterion is "nothing irreversible from a single un-warned click."

**9.4 — Field hints: start narrow.** ✅ Divisions modal + Schedule generator + Registration bulk menu only. Expand later only on evidence of confusion. A hint must earn its place.

**9.5 — Tablet/phone treatment: device-matched.** ✅ Full-screen help sheet at ≤640px; 420px right-edge side panel above that (consistent with the app's existing panel behaviour).

**9.6 — Scope now = tournaments + coaches.** ✅ Tournaments (flagship, densest, the original complaint) + the coaches portal (glaring zero-help gap) are instrumented in Phase 2 as the proven template. House-league / rep-teams / accounting / org-admin adopt the now-built, module-agnostic pattern in a later pass.

---

## 10. WHAT THIS UNLOCKS

After Phase 2, every tournament work page (and the coaches portal) answers "what does this mean / how do I do this?" in place. It also delivers the **HelpDrawer + content registry + `HelpSectionBlock`** that Phase 3's lifecycle "I want to…" shortcuts and discovery surfaces are built on. The pattern is module-agnostic by construction (drawer takes any `module`/`sectionIds`), so widening to other modules later is wiring, not rebuilding.
