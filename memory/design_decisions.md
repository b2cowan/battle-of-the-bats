# Design Decisions Log

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

---

### 2026-05-27 — Tournament Notifications page: 6 fixes from design review
**Decision:** (1) `pageHeader margin-bottom` corrected to `1.25rem` (was `1.75rem`) — matches binding standard. (2) `.headerLeft align-items` corrected to `flex-start` (was `center`) — matches binding icon-box alignment decision. (3) `.channelItem cursor` corrected to `pointer` (was `default`) — `<label>` elements wrapping interactive toggles must use pointer cursor. (4) `.channelItemLabel font-size` reduced to `0.82rem` (was `0.85rem`) — matches the data body range (0.72–0.82rem) used in all other admin shell data text. (5) `.muteCardActive .muteSub` gets `color: var(--white-60)` — `--white-40` is low-contrast against the danger-tinted surface in the active/muted state. (6) `.muteCard background` changed from `var(--surface)` to `rgba(255,255,255,0.02)` — matches the channelCard background for surface parity between the two adjacent cards.
**Rationale:** Fixes 1–2 enforce the binding page-header standard from the 2026-05-25 dashboard audit. Fix 3 is a basic interactive affordance. Fix 4 enforces data density. Fix 5 is a contrast improvement in an important destructive-state indicator. Fix 6 removes a surface token inconsistency between neighbouring cards.
**Applies to:** `app/[orgSlug]/admin/tournaments/settings/notifications/notifications.module.css`.

---

### 2026-05-26 — Public Site (Branding) page: accordion, locked-card redesign, renames, button fixes

**Decision:** (1) **Rename** — sidebar nav item `Branding` → `Public Site`; page h1 → `Public Site`. The old name was too generic and didn't communicate that this controls the public-facing tournament website. (2) **Locked cards — compact row pattern** — when a feature requires Tournament Plus, the card renders only its title row + LOCKED badge + a one-line description of the feature (`.lockedHint`). No disabled form controls, no disabled swatches, no disabled grids. The `.lockedHint` is hidden on mobile (≤600px) since the consolidated upsell block covers it. (3) **Single consolidated upsell block** — one `CompactUpsell` component placed above all locked sections replaces the five individual per-card upgrade paragraphs. Free tier sees one CTA; not five. This uses the existing `CompactUpsell` component from `@/components/admin/tournament`. (4) **Mobile accordion** — on ≤600px, each section card collapses to its title row + chevron. Public Pages opens by default; all Advanced Branding sections start closed. On desktop (≥601px) all sections are always expanded. The `.accordionTrigger` button uses `pointer-events: none; cursor: default` on desktop so it behaves as a plain block wrapper. (5) **`TournamentAdminHeader`** replaces the hand-rolled header (48px icon, `margin-bottom: 2rem`, oversized title). Back link removed for consistency with Venues page migration. (6) **Background toggle active state** — `.modeToggleBtnActive` changed from `var(--primary)` navy to `var(--logic-lime)` + `#0f1123` text, matching all other segmented controls in the admin shell. (7) **Logo square** — `.logoPreview border-radius: 50%` → `2px`, matching the sharp-corner HUD aesthetic. Border changed from `2px solid var(--primary)` to `1px solid rgba(var(--primary-rgb), 0.35)`. (8) **Button fixes** — Save Changes: `btn-primary` → `btn btn-lime btn-data`; Upload/Remove buttons: `btn btn-outline btn-data` / `btn btn-ghost btn-data`. Mobile full-width override on `.modeToggle, .modeToggleBtn` removed.
**Rationale:** Locked disabled UI creates a bad free-tier experience by showing features the user can't touch — overwhelming and scroll-heavy. The compact locked row + single upsell block is calmer and more effective. Accordion addresses ~2400px mobile scroll. All button and token fixes enforce prior binding decisions.
**Applies to:** `app/[orgSlug]/admin/tournaments/branding/page.tsx`, `branding.module.css`, `components/admin/AdminSidebar.tsx`.

---

### 2026-05-26 — Mobile bottom nav More dropdown: every item belongs under a section header
**Decision:** No nav item in the More dropdown exists outside a section header (Operations / Setup / Admin). Even a single-item section retains its header. The structural rule is: items always live under a subheader.
**Rationale:** Retrofitting section labels when new items are added is avoidable friction. A consistent header-first structure keeps the dropdown scannable regardless of item count.
**Applies to:** `components/admin/AdminBottomNav.tsx` — More dropdown section structure.

---

### 2026-05-26 — Mobile bottom nav: full design system alignment + 5-tab layout
**Decision:** (1) **Color system** — all purple accent values (`#c084fc`, `rgba(139,47,201,...)`, `#1A1530`) replaced with design system tokens. Active tabs now use `var(--logic-lime)` + `rgba(var(--logic-lime-rgb), 0.12)` icon background + lime `activeDot` glow — matching the desktop sidebar active state exactly. Borders use `rgba(var(--blueprint-blue-rgb), ...)`. Nav bar background changed to `rgba(17,24,39,0.97)` (= `--hud-surface` at 97%, preserving `backdrop-filter` frosted-glass). Dropdown background changed to `var(--hud-surface)`. (2) **setLiveBtn** (inactive tournament CTA in dropdown) restyled from purple to lime ghost: `rgba(--logic-lime-rgb, 0.08)` background, `rgba(--logic-lime-rgb, 0.35)` border, `var(--logic-lime)` text. (3) **5-tab layout** — Dashboard added to `PRIMARY_KEYS` at position 0 (order: Dashboard → Registrations → Schedule → Results → More); removed from `OPERATIONS_MORE`. (4) **Preview Site** moved from `tournamentBlock` (prominent top position) to the dropdown footer — a muted `.dropUtilItem` link positioned between the last section divider and Logout, mirroring its placement in the desktop sidebar footer.
**Rationale:** The purple accent predated the multi-org platform pivot and was never part of the design system. Mobile and desktop admin now share a single active-state color. 5 tabs is the mobile nav convention; Dashboard is the tournament command center and earns a primary slot. Preview Site is a utility action, not a primary workflow step — footer placement matches its priority.
**Applies to:** `components/admin/AdminBottomNav.tsx`, `components/admin/AdminBottomNav.module.css`.

---

### 2026-05-26 — Results + Registrations: mobile toolbar standardized to Schedule model
**Decision:** Both pages now match the Schedule 5-row mobile stack: (1) Division, (2) Round Robin | Flat [native selects], (3) action buttons, (4) Search, (5) Status chips. Specifics: **Results** — new `results-admin.module.css` with `mobileModePair` + `desktopModeControl` pattern (same as Schedule); start group reordered to Division → RR|PO → Flat|Pools on desktop; `ToolbarMenu (Tools)` added containing "Open Scorekeeper View" (moved out of header, header now bare like Schedule); fullWidth row swapped to Search then chips; chip touch targets 34px. **Registrations** — fullWidth row DOM order swapped: `ToolbarSearch` before chips div (fixes both desktop and mobile ordering simultaneously since `flex-direction: column` on mobile means DOM order = display order); chip touch targets 28px → 34px; multi-select icon buttons 28px → 32px; Add Team icon button 28px → 32px.
**Rationale:** Consistent 5-row mobile order across all three pages reduces cognitive friction for admins switching between pages. Swapping DOM order is cleaner than CSS `order` hacks when flex-direction already controls stacking.
**Applies to:** `app/[orgSlug]/admin/tournaments/results/page.tsx`, `results/results-admin.module.css`, `registrations/page.tsx`, `registrations/teams-admin.module.css`. Commit `07b4e25`.

---

### 2026-05-26 — Schedule admin: mobile touch targets, division label, publish live state
**Decision:** (1) **Touch targets** — primary filter controls (mode selects, venue filter button) bumped from `28px` → `34px` height on mobile; secondary icon buttons (publish/export/tools, add game) bumped `28px` → `32px`. (2) **Division label** — `.scheduleDivisionSelect > span` color changed from `rgba(148,163,184,0.58)` to `var(--white-50)` — the faint slate tint was barely perceptible against the toolbar background; `--white-50` matches the `controlLabel` convention used elsewhere. (3) **Toolbar bottom margin** — `margin-bottom` bumped `1rem` → `1.25rem` on mobile to give breathing room between the 5-row toolbar and the game list below. (4) **Publish live state indicator** — `data-live="true"` attribute added to the publish button when `isPublished`; CSS rule `.publishButton[data-live]:disabled` overrides the gray disabled style to retain lime coloring (`rgba(--logic-lime-rgb, 0.35)` border, `0.07` background, `0.65` text), making the live state visible on mobile where the "Live · Teams" text badge is hidden.
**Rationale:** 28px touch targets are below comfortable thumb-tap size for an admin operating on mobile. The lime live-state indicator closes a visibility gap where admins had no way to confirm a schedule was published without checking the public page. Division label at `--white-50` matches established toolbar label standards.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css`, `app/[orgSlug]/admin/tournaments/schedule/page.tsx`. The `34px` filter control / `32px` icon button pattern should be adopted on other mobile admin toolbars (registrations, results) in future sessions.

---

### 2026-05-26 — Schedule admin: mobile toolbar row order (mobileModePair)
**Decision:** The two mobile mode selects (Round Robin/Playoffs and Flat/Pools or List/Bracket) are wrapped in a `div.mobileModePair` that is `display:none` on desktop and `display:flex; flex: 1 1 100%; order:1` on mobile. This gives them their own dedicated full-width row within `scheduleActionsGroup`, cleanly separating them from the venue filter and action buttons row below. Mobile toolbar now stacks: (1) Division, (2) Round Robin | Flat, (3) Venue | buttons, (4) Search, (5) Status filters.
**Rationale:** Previously the mode selects relied on flex `order` alone, causing inconsistent rendering — Round Robin sometimes appeared full-width instead of 50%/50% beside Flat. The wrapper is an unambiguous full-row boundary.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Select optgroup labels: white-50 on hud-surface
**Decision:** Native `<select>` `<optgroup>` group headers globally use `color: var(--white-50)`, `background: var(--hud-surface)`, `font-style: normal`, `font-weight: 700`. Applied via `globals.css` alongside the existing `select option` rule. Blueprint-blue was tried first but lacked contrast on the dark surface.
**Rationale:** Browser default optgroup rendering produces a light-gray background and italic gray text — near-invisible on the dark HUD surface. `--white-50` is legible as a dimmed label/header while being clearly distinct from selectable options (`--white`). `font-style: normal` overrides the browser-default italic.
**Applies to:** All `<optgroup>` elements globally (`app/globals.css`); most visible in schedule admin venue/slot selects.

---

### 2026-05-25 - Schedule admin: filter row alignment follow-up
**Decision:** Schedule admin filter controls were refined after desktop/mobile review: (1) Desktop Row 2 is `ToolbarSearch` -> venue filter -> right-aligned status chips, so empty space sits between venue and filters instead of after the filters. (2) Desktop shows the Division label and hides mobile mode selects with stronger CSS specificity, preventing duplicate segmented/select controls. (3) Mobile uses a labeled full-width Division row, schedule-local native mode dropdowns that bypass the shared `ToolbarSelect` mobile `width: 100%` rule so they can sit side by side, Venue stretching beside compact icon actions, then Search and status filters. (4) Planning rows always render the venue column on desktop; empty venue cells are hidden visually but still reserve column space, preventing matchup drift between rows with and without venues. Empty venue cells are fully hidden on mobile to avoid a blank third row.
**Rationale:** The filtering workflow should read as a single cluster, and game row columns must remain stable regardless of optional venue data.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Registrations: payment panel typography + toolbar layout
**Decision:** (1) **Payment input fields**: `border-radius: 6px → 2px` (HUD sharp corners), `background: var(--hud-surface) → var(--bg-2)` (matches textarea, avoids lighter-than-panel artifact on `rgba(0,0,0,0.2)` expanded row), `font-family: var(--font-data)` added (mono numbers), `font-size: 0.88rem → 0.82rem` (standard data body size), `:focus { border-color: var(--blueprint-blue); outline: none }` added (matches textarea). (2) **Payment field labels** (`.paymentField span`): `font-family: var(--font-data)` added — without this they fell back to sans-serif despite uppercase/tight-letter-spacing treatment. (3) **"Deposit due" line** (`.paymentDue`): `font-family: var(--font-data)` added, `font-size: 0.8rem → 0.72rem` (tighter data density). (4) **FLAT|POOLS segmented control moved to context group**: Was in `align="end"` group alongside EXPORT/SELECT MANY/TOOLS. Moved to `grow` context group alongside DIVISION select. View mode is context, not utility — grouping it with Division closes the large dead-space gap on desktop between the single Division select and the action cluster. (5) **Filter row search right-aligned**: Added `justify-content: space-between` to `.registrationFilterGroup` so status filter chips stay left and search sits at the far right edge.
**Rationale:** Input background using `var(--hud-surface)` (solid `#111827`) against an `rgba(0,0,0,0.2)` transparent expanded row panel produced a visually lighter floating box. `var(--bg-2)` (`#0F172A`) gives a consistent dark inset feel matching the textarea. Toolbar Row 1 had a single Division select stretching a `flex: 1` grow group, creating a wide empty middle zone on desktop. Moving FLAT|POOLS to the left group mirrors the schedule page layout standard where all context selectors live left, all utility actions live right.
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css` (`.paymentField span`, `.paymentField input`, `.paymentField input:focus`, `.paymentDue`, `.registrationFilterGroup`); `app/[orgSlug]/admin/tournaments/registrations/page.tsx` (toolbar group restructure).

---

### 2026-05-25 — Tournament Venues: Export in header (exception), inline edit, Navigation icon for Maps
**Decision:** (1) **Export back in header** — for setup pages with no filter controls (Venues), Export lives in the header alongside Add Venue as a secondary ghost button. The "Export in toolbar" rule applies to operational pages (Registrations, Schedule) where export is filter-state-aware. No filters = no toolbar needed. (2) **Inline edit** — clicking the pencil icon on a venue card switches the card header to an inline edit form (Name, Address, Notes), auto-expanding to show the facilities panel simultaneously. Modal edit is removed for this surface; `AddVenueModal` is now Add-only. (3) **`Navigation` icon for Maps button** — replaces `ExternalLink`. The navigation arrow communicates "get directions / open in Maps" far more clearly than a generic new-tab icon. (4) **`venueCard.editing` border** — lime border (`rgba(--logic-lime-rgb, 0.35)`) on cards in edit mode; consistent with the lime active-state pattern used on segmented controls and active chips. (5) **`btn-primary` in `AddVenueModal` fixed** — replaced with `btn-lime btn-data` per the global ban on btn-primary outside modals (and then the broader btn-primary ban).
**Rationale:** Removing the toolbar eliminates a full row of vertical dead space. Inline edit reduces modal proliferation and follows the schedule game row editing pattern already established. Navigation icon is universally understood as maps/directions. Editing border gives clear feedback without disrupting surrounding UI.
**Applies to:** `app/[orgSlug]/admin/tournaments/venues/page.tsx`, `venues-admin.module.css`, `components/admin/AddVenueModal.tsx`.

---

### 2026-05-25 — Setup section pages: Export exception to toolbar rule
**Decision:** Setup-section admin pages (Venues, Branding, Event Settings etc.) that have no filter controls may place ExportMenu in the `TournamentAdminHeader` actions alongside the primary CTA. The "Export belongs in toolbar" rule only applies when there is at least one filter control (division select, status chips, search) that makes the export filter-state-aware. A toolbar solely to hold Export creates a full row of dead space and is not justified.
**Rationale:** The original toolbar-placement rule was written for Registrations and Schedule. Those pages have 3–7 filter controls; Export contextualises with them. A setup page with no filters has no filter context to preserve — the toolbar row is pure waste.
**Applies to:** All setup-section admin pages globally.

---

### 2026-05-25 — Tournament Venues page: migrated to TournamentAdminHeader + toolbar; venue list max-width 860px
**Decision:** (1) The tournament venues page (`app/[orgSlug]/admin/tournaments/venues/page.tsx`) was migrated from a hand-rolled custom header (`styles.pageHeader` / `styles.headerLeft`) to the shared `TournamentAdminHeader` + `TournamentAdminToolbar` components, matching Registrations and Schedule. (2) **Export and "Import from Library" moved to toolbar** (`ToolbarGroup align="end"`) — these are utility actions, not primary CTAs. (3) **"Add Venue" remains the sole lime CTA in the header** — one primary action only. (4) `.venueList { max-width: 860px }` — venues is a setup/config page with few items; the full-width list felt sprawling on wide monitors. This is an inner content constraint (not the `.page` wrapper), consistent with how branding.module.css constrains `.settingsContent`. (5) `venueCard border-radius: 8px → 4px` — sharpened toward HUD aesthetic. (6) `facilityEmptyNote` italic removed; `font-family: var(--font-data)` added. (7) `ImportFromLibraryModal` inline styles extracted to CSS classes (`.libraryNote`, `.libraryVenueList`, `.libraryVenueItem`, `.libraryVenueItemSelected`, `.libraryVenueName`, `.libraryVenueAddress`, `.libraryVenueFacilities`, `.libraryEmpty`) in `venues-admin.module.css`.
**Rationale:** Header standardisation makes venues visually consistent with all other admin pages. The smaller `TournamentAdminHeader` (30px icon, 1.05rem lime monospace title, 0.5rem bottom margin vs the old 48px/1.25rem/1.25rem) directly addresses the "too big" space complaint. The `max-width: 860px` on the venue list follows the Event Settings pattern — setup-section pages with few items benefit from a contained width. The toolbar placement rule for Export is established and was violated.
**Applies to:** `app/[orgSlug]/admin/tournaments/venues/page.tsx`, `app/[orgSlug]/admin/org/venues/venues-admin.module.css`. Note: the org venues page (`app/[orgSlug]/admin/org/venues/page.tsx`) still uses the old header classes (they remain in the CSS for backward compat) and is a candidate for the same migration in a future session.

---

### 2026-05-25 — btn-primary is banned from modals; modal confirm uses btn-lime
**Decision:** `btn-primary` (navy gradient) is **banned everywhere** — including inside `.modal` wrappers. The earlier rule permitting it in modals is superseded. Modal confirm/destructive actions use `btn-lime btn-data` (positive/neutral confirms) or `btn-danger btn-data` (destructive confirms). Cancel/close actions use `btn-ghost btn-data`. The navy gradient is invisible on `--hud-surface` dark backgrounds and has no place in the platform's visual language.
**Rationale:** The Activate Tournament confirmation modal made this explicit — `btn-primary` rendered as a near-invisible dark button on the dark modal background. `btn-lime` is the platform's single confirm action colour across all contexts.
**Applies to:** All `.modal` wrappers globally. Supersedes all prior `btn-primary` modal permissions. Audit: grep for `btn-primary` anywhere in the codebase and replace.

---

### 2026-05-25 — Dashboard: ACTIVATE button intentionally compact
**Decision:** The `.activateChip` button on the draft dashboard retains its original compact size (`padding: 0.35rem 0.7rem`) on all viewports including mobile. A 44px min-height override was tried and reverted — the larger size dominated the checklist header and felt visually out of proportion.
**Rationale:** The button sits inline with the "Draft Launch Checklist" heading; a full-height touch target there over-weights a secondary action. The checklist item cards are the primary interaction surface.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — `.activateChip`

---

### 2026-05-25 — Modal buttons use btn-data; FeedbackModal fully audited
**Decision:** All buttons inside `.modal` wrappers use `btn-data` as the size modifier — this overrides the earlier rule that said modal footer buttons use "default size." Confirmed preference after seeing both rendered. Specifically in `FeedbackModal.tsx`: (1) × close → `btn-ghost btn-data`, X icon reduced 16px → 14px. (2) Close/Cancel footer → `btn-ghost btn-data`. (3) Confirm footer → `btn-${type} btn-data`. (4) Header icon reduced 24px → 16px to match the 0.75rem h3 title. (5) Message body div set to `font-data 0.82rem --white-70 line-height:1.55` — message text was a bare string in a div, not a `<p>`, so the `.modal p` global rule didn't reach it. (6) Items list `borderRadius: 8` → `0` (sharp corners).
**Rationale:** Default-size `.btn` is proportioned for standalone CTAs and page-level actions. Inside a compact HUD modal, `btn-data` keeps buttons consistent with the operational density of the admin shell. The size contrast between the small monospace title and a large default button was jarring.
**Applies to:** `components/FeedbackModal.tsx` and all future modal implementations globally — `btn-data` is the standard size for all buttons inside `.modal` wrappers.

---

### 2026-05-25 — Global modal: full HUD rebrand
**Decision:** The global `.modal`, `.modal-header`, `.modal-header h3`, `.modal p`, and `.modal-footer` rules in `globals.css` were updated to match the admin shell HUD aesthetic: (1) `border-radius: var(--radius-lg)` (20px) → `border-radius: 0` — sharp corners are mandatory everywhere in the admin shell. (2) `background: var(--bg-2)` → `background: var(--hud-surface)` — canonical dark admin surface. (3) `border: var(--border)` → `border: 1px solid rgba(var(--blueprint-blue-rgb), 0.4)` — standard admin blueprint-blue border. (4) `box-shadow` changed to use `var(--glow-blue)` instead of `var(--glow-sm)` — blue glow is the admin shell standard. (5) `padding: 2rem` → `1.5rem` — tighter for data-dense context. (6) `.modal-header` gains `border-bottom: 1px solid rgba(var(--blueprint-blue-rgb), 0.25)` and `padding-bottom: 0.75rem`; `margin-bottom: 1.5rem` → `1rem`. (7) `.modal-header h3` changed from `font-display sans-serif 1.5rem 800` to `font-data monospace 0.75rem 700 uppercase letter-spacing:0.1em color:var(--fl-text)`. (8) `.modal p` baseline added: `font-data 0.82rem var(--white-70) line-height:1.55` — prevents body text defaulting to browser sans-serif. (9) `.modal-footer` `border-top` updated to `rgba(var(--blueprint-blue-rgb), 0.25)` matching header separator; margin/padding tightened.
**Rationale:** The pre-existing modal styles used design tokens from a generic light-mode component library (`--radius-lg`, `--bg-2`, `--border`, `--font-display`). Every one of these violated established HUD conventions. The fix is global and applies to all `.modal` usage platform-wide.
**Applies to:** `app/globals.css` — all `.modal` usages globally, including admin shell, platform-admin, and coaches portal.

---

### 2026-05-25 — Dashboard: full design system audit applied (Draft state)
**Decision:** Applied all binding design system rules to `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` and `dashboard.module.css` (Draft state review): (1) `.page { max-width: 960px }` removed — no page-level max-width in admin shell. (2) `h1` reduced from `text-2xl` (1.5rem) → `text-xl` (1.25rem) — page title binding standard. (3) Header `mb-8` (2rem) → `mb-5` (1.25rem) — page header margin-bottom binding standard. (4) Status badge `hidden md:block` wrapper removed — status chip now always visible on all screen sizes; mobile admin operating mode requires status visibility. (5) `.activateChip` hardcoded `color: #ccff66` and `::before background: #ccff66` replaced with `var(--logic-lime)` — no raw hex values for platform brand tokens. (6) Activate confirmation modal converted from `.card` to `.modal` + `.modal-header` + `.modal-footer` — `btn-primary` is only valid inside a `.modal` wrapper. (7) All `btn-sm` removed from both modals: modal ×-close buttons → `btn-ghost btn-data`; modal footer confirm/cancel buttons → default size (no modifier). (8) Dead CSS block (`.setupLinks`, `.setupLink`, `.setupLinkIcon`, `.setupLinkBody`, ~55 lines) deleted — these classes were never referenced in JSX. (9) Optional items accordion toggle inline styles (~12 properties) extracted to `.optionalToggle` CSS class.
**Rationale:** All rules enforce existing binding decisions. The modal `.card` → `.modal` fix is particularly important as `btn-primary` inside `.card` is non-compliant with the btn-primary isolation rule.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css`.

---

### 2026-05-25 — Venues admin: full design system audit applied
**Decision:** Applied all binding design system rules to `app/[orgSlug]/admin/org/diamonds/` (the shared Venues page used by both the org-level and tournament-level venues routes): (1) `btn-primary btn-sm` on Add Venue → `btn btn-lime btn-data`. (2) `.page { max-width: 960px }` removed — no page-level max-width in admin shell. (3) `.pageTitle` font-size reduced `1.75rem` → `1.25rem`. (4) `.pageHeader` margin-bottom reduced `2rem` → `1.25rem`. (5) `.headerLeft` align-items changed `center` → `flex-start` (icon top-aligns with title). (6) `flex-shrink: 0` added to `.headerIcon` to prevent shrinkage. (7) All row action buttons (`Maps` link, Edit pencil, Delete trash) changed from `btn-sm` → `btn-data`. (8) Delete modal close `×` changed from `btn-ghost btn-sm` → `btn-ghost btn-data`. (9) Passive table-row empty state replaced with `.empty-state` block (MapPin icon, "No venues added yet" title, description, `btn btn-lime` CTA) rendered outside the table conditionally. (10) Inline `style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}` on address/notes cells extracted to `.cellMuted` CSS class. (11) Removed now-unused `.emptyTableCell` mobile override rules from the CSS. Added `.cellMuted` and `.emptyCta` classes.
**Rationale:** Every rule above was a binding decision from prior sessions applied consistently to a page that predated those decisions.
**Applies to:** `app/[orgSlug]/admin/org/diamonds/page.tsx`, `app/[orgSlug]/admin/org/diamonds/diamonds-admin.module.css` (also affects `app/[orgSlug]/admin/tournaments/venues/page.tsx` which re-exports this page).

---

### 2026-05-25 — Schedule admin: toolbar restructure matches registrations pattern
**Decision:** Schedule admin toolbar rebuilt to exactly match the registrations layout template: (1) **Add Game button** in `TournamentAdminHeader` with `mobileActionsInline` — keeps button top-right on mobile, same as Add Team in registrations. (2) **Toolbar Row 1** split into `ToolbarGroup grow` (Round Robin/Playoffs segmented + Division select + Flat/Pools or List/Bracket segmented) and `ToolbarGroup align="end"` (Publish control + ExportMenu + Tools menu). All utility buttons in the same end group. (3) Publish control: unpublished state shows a ghost `Globe` icon button (`btn-ghost btn-data`) labeled "Publish" (mobileIconButton collapse); published state shows a compact lime badge ("Live · Teams" or "Live · Generic") + Update + Unpublish (`btn-ghost btn-data`). The badge uses `0.62rem` text and `Live ·` prefix for compactness. (4) **Toolbar Row 2** is a `ToolbarGroup fullWidth` with status filter chips (`s.statusFilters + styles.scheduleStatusFilters`) + ToolbarSearch on the same row. On mobile the fullWidth group stacks below Row 1.
**Rationale:** The previous structure put five independent control groups in the start group (segmented × 2, division select, publish status, publish action), causing overflow and inconsistency. The registrations pattern (grow context group + end utility group + fullWidth filter row) is the established admin shell standard.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Schedule admin: mobile row density, status filters, and button audit
**Decision:** (1) **Venue column hide breakpoint** raised from `680px` to `768px` in `admin-common.module.css` — frees the venue column space (≈120px) at all standard mobile viewports; location is still accessible in the expanded inline panel. (2) **Game-row mobile override** (`.gameRowMain`) added to `schedule-admin.module.css` — overrides admin-common's `@768px` rule that wraps rows and pads `1rem`; game rows now stay single-line with `0.35rem 0.75rem` padding and `min-height: 40px`. Applied to both planning-mode and scoring-mode rows in `GameList.tsx`. (3) **Desktop badge / mobile compact marker** — planning-mode status area replaced with `.planningStatusCell` class (96px desktop → auto on mobile); full badge text wrapped in `.desktopStatusBadge` (hidden on mobile); a `.gameStatusMarker` 18px square initial (`✓` for Final, `✕` for Cancelled) shown on mobile via `data-status` variants matching the registrations `mobileStatusMarker` pattern. (4) **Game status filter chips** — four chips (All / Scheduled / Cancelled / Final) with colour-coded `::before` dots added to the second toolbar row alongside search; chips use the existing `.filterChip` / `.chipActive` admin-common class system with four new variants (`chip_all`, `chip_scheduled`, `chip_cancelled`, `chip_completed`). `filterStatus` state added to `ScheduleAdminPage`; `divisionGames` + `statusCounts` computed for chip counts; filter resets on division or view-mode change. Clicking an active non-all chip toggles it back to "All". (5) **Add Game icon-only on mobile** — `.addGameButton` + `.addGameLabel` classes collapse the header CTA to `32×28px` icon-only below 760px, matching the registrations `addTeamButton` pattern. (6) **Inline form footer btn-sm purge** — all `btn-ghost btn-sm`, `btn-danger btn-sm`, and `btn-lime btn-data btn-sm` in `GameList.tsx` inline form footer replaced with `btn-data` variants; inline `fontSize: '0.72rem'` overrides removed. (7) **Publish toolbar btn-sm purge** — two `btn-ghost btn-sm` buttons (Update / Unpublish) replaced with `btn-ghost btn-data`; inline height/font overrides removed.
**Rationale:** Porting the registrations mobile pattern to schedule: compact rows, status markers, and filter chips are now consistent across both admin list pages. btn-sm is banned in the admin shell; btn-data is the uniform size standard.
**Applies to:** `admin-common.module.css` (breakpoint + chip variants), `schedule-admin.module.css` (all new classes), `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`.

---

### 2026-05-25 — Event Settings page: layout, spacing, and button audit
**Decision:** (1) `.page` max-width removed — the branding.module.css shared by Event Settings and the Branding admin page had `max-width: 720px` which caused large wasted whitespace on the right. Removed entirely per the global "no page-level max-width in admin" rule. (2) `pageTitle` font-size reduced from `1.75rem` to `1.25rem` — the large monospace heading was an oversized hero-style treatment inconsistent with operational admin pages. (3) `.pageHeader` and `.settingsTitleRow` margin-bottom both reduced from `2rem` to `1.25rem` — stacked 2rem margins created 4rem of vertical dead space before the first content card. (4) `btn-primary` on the Save Changes footer button replaced with `btn-lime btn-data` — `btn-primary` is banned outside `.modal` wrappers. (5) `btn-outline btn-sm` on the upsell "Review Tournament Plus" link replaced with `btn-outline btn-data` — `btn-sm` is not the admin shell size standard. (6) `.segmentButtonActive` background changed from `var(--blueprint-blue)` to `var(--logic-lime)` with `color: #0f1123` — logic-lime is the platform's interactive accent; blueprint-blue active state was inconsistent with the layout-toggle pattern already using lime.
**Rationale:** Rules 1–5 enforce existing binding decisions. Rule 6 consolidates segmented control active-state to the single correct accent color across all admin components.
**Applies to:** `app/[orgSlug]/admin/tournaments/branding/branding.module.css` (shared by Branding + Event Settings pages), `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`; segmented control lime active state applies globally to any component using this pattern.

---

### 2026-05-25 — Rules/Resources public page layout toggles
**Decision:** Rules and Resources sections on the public rules page each have an independent admin-controlled layout: Rules = `'columns'` (2-col grid, default) | `'single'` (full-width); Resources = `'list'` (stacked, default) | `'grid'` (2-col). Stored in `tournaments.settings` JSONB. Defaults preserve current behaviour for all existing tournaments. Toggle UI in each `section-header` uses two adjacent `icon-btn` buttons in a `.layout-toggle` pill; active state uses `--logic-lime`/`rgba(--logic-lime-rgb, 0.08)` background. Both layout variants collapse to 1 column at ≤768px on the public page.
**Rationale:** Two-col rule cards look good for 2–4 short sections but squish at 6+. A full-width option serves content-heavy orgs. Resources grid aids scanability for 4+ links. Separate control per section because content volume differs. JSONB settings avoids column sprawl for future small preferences.
**Applies to:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`, `app/[orgSlug]/[tournamentSlug]/rules/page.tsx`, `app/[orgSlug]/rules/rules.module.css`; `tournaments.settings` JSONB for future per-tournament prefs.

---

### 2026-05-24 — Public pricing page: eyebrow + label colour, featured segment card, section order
**Decision:** (1) All eyebrow labels, table category headers, and "from→to" bridge labels on public pages use `var(--logic-lime)`, not `var(--blueprint-blue)`. Blueprint blue on a near-black surface fails contrast and reads as dark-blue-on-dark — lime is the correct readable accent. (2) The `segmentCardFeatured` lime highlight was removed from the Coach/Team Manager segment card. Featured styling is reserved for plans that can be purchased; coming-soon products get neutral (muted opacity) treatment. If any segment card needs a highlight in future, it must be the top-revenue live plan (Tournament Plus). (3) Page section order: Hero → Segment picker → **Org plans** (moved up) → Coaches Portal callout → Compare table → Upgrade bridges → Coming soon → FAQ → CTA. The live plan cards must appear before any coming-soon product sections. (4) Coaches Portal feature list condensed from 7 bullets to 3 high-level pillars to reduce text volume. (5) Comparison table converted to a client component (`ComparisonTable.tsx`) with per-category accordion collapse; only the first 2 categories (Tournaments & Scheduling, Registration Operations) are open by default. (6) Page background remains `--pitch-black` (#0A0A0A) for public/marketing pages; `--hud-surface` (#111827) is the admin shell surface and should not be used as the base background for public pages.
**Rationale:** Contrast failure on eyebrows was a direct readability issue across all sections. The featured card misdirected visitors toward a product they couldn't buy. Section order misaligned with visitor intent (most arrive wanting to see plan prices). Table was 48+ rows always-visible; collapsing reduces scroll fatigue without losing information.
**Applies to:** `app/pricing/page.tsx`, `app/pricing/page.module.css`, `app/pricing/ComparisonTable.tsx`; eyebrow-colour rule applies globally to all public-facing pages.

---

### 2026-05-24 — Rules page: btn-purple eliminated, all buttons normalised to design system
**Decision:** `btn-purple` was a phantom class (no CSS definition anywhere) used on 4 buttons in both `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` and `app/admin/rules/RulesAdmin.tsx`. Replaced globally: "Save Changes" (dirty state) → `btn-lime btn-data`; "Save Changes" (clean) → `btn-ghost btn-data`; "Seed Default Data" → `btn-outline btn-data`; "Add Section" → `btn-lime btn-data`; "Upload File" → `btn-lime btn-data`; "Add Link" → `btn-outline btn-data`; resource inline Save → `btn-lime btn-data`; resource inline Cancel → `btn-ghost btn-data`. `btn-purple` is now completely absent from the codebase.
**Rationale:** Phantom classes silently fail — buttons rendered with no colour modifier, looking like unstyled `.btn`. The btn-data + btn-lime/btn-outline/btn-ghost pattern is the correct admin shell standard. Every design review should grep for `btn-purple` (and any other non-system modifier) to catch this category of error.
**Applies to:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`, `app/admin/rules/RulesAdmin.tsx`, and globally (btn-purple is banned)

---

### 2026-05-24 — AUDIT RULE: btn-primary is banned outside overlay modals — replace with btn-lime btn-data
**Decision:** `btn-primary` (navy gradient) is **only** permitted inside a `div.modal` (true overlay dialog with backdrop). Every other primary action in the admin shell — page headers, inline panels, compose forms, drawers, toolbars, inline CTAs — must use `btn-lime btn-data`. This has come up repeatedly across sessions (Announcements, Communications, and others); the root cause is that `btn-primary` is the React/form default and gets used by mistake on new components. **Every design review must grep for `btn-primary` and audit each hit against this rule.**
**Rationale:** The admin shell's brand identity is the logic-lime / dark HUD aesthetic. Navy gradients belong to the modal confirm pattern only. Consistency across pages requires an explicit audit step, not per-page corrections.
**Applies to:** All admin shell pages globally. Audit command: search for `btn-primary` in `app/[orgSlug]/admin/` and verify each is inside a `.modal` wrapper.

---

### 2026-05-24 — btn-data is the standard size modifier for all admin shell action buttons
**Decision:** All buttons in the admin shell use `btn-data` as their size modifier unless a specific exception applies. This covers: page header CTAs, toolbar buttons, inline panel action bars (compose, edit, filters), and inline form submit/cancel buttons. The two documented exceptions are: (1) empty state CTAs — use `btn btn-lime` with a local size class instead; (2) true modal confirm/cancel buttons — use `btn btn-primary` or `btn btn-ghost` at default size. Do not use `btn-sm`, `btn-lg`, or unsized `btn` for admin shell action buttons.
**Rationale:** The platform's operational/terminal aesthetic requires compact, monospace, uppercase buttons throughout the admin shell. Using default `.btn` sizing creates large buttons that look out of place next to data tables and toolbars. `btn-data` enforces: 0.62rem monospace font, uppercase, 2px radius, tight padding.
**Applies to:** All admin shell pages and components globally. See `app/globals.css` `.btn-data` for the definition.

---

### 2026-05-24 — Compose panel: max-width 860px centered, btn-data on all action buttons
**Decision:** The communications compose panel uses `max-width: 860px; margin: 0 auto` so all sections (templates, fields, channels, actions) share the same width and are centered in the content area. The page header remains full-width. All three action buttons (× Cancel, Save Draft, Post to Site/Send) use `btn-data` to match the operational data-density aesthetic of other admin pages (Registrations, Schedule). `channelDesc` needs no `max-width` because the panel's own constraint prevents over-stretching.
**Rationale:** Consistent width across all compose sections avoids the "narrow fields, wide channels" mismatch. btn-data aligns the form's button aesthetic with the rest of the admin shell.
**Applies to:** `app/[orgSlug]/admin/tournaments/communication/communication.module.css`, compose panel pattern

---

### 2026-05-24 — .empty-state svg selector must be direct-child only
**Decision:** The global rule targeting SVGs inside `.empty-state` must use the direct-child combinator: `.empty-state > svg`, not `.empty-state svg`. The descendant form matches SVG icons inside buttons nested within the empty state, applying `opacity: 0.4` and `margin-bottom: 1rem` to button icons — causing visual misalignment.
**Rationale:** The rule was written for the decorative icon only. Any `.empty-state` that contains a button with a Lucide icon would be broken by the broad selector.
**Applies to:** `app/globals.css` — global fix affecting all empty states platform-wide

---

### 2026-05-24 — Branded checkbox: global platform style for all input[type="checkbox"]
**Decision:** All checkboxes across the platform use a custom branded style: `appearance: none`, 16×16px, 2px border-radius, `--blueprint-blue-rgb` border (unchecked), `--logic-lime` checkmark via `::before` pseudo-element, `--logic-lime-rgb` border + tint background (checked). Applied globally via `input[type="checkbox"]` in `globals.css`. The 18×18px `.selectionCheckbox` variant in `teams-admin.module.css` is the reference; the global uses 16px for standard form checkboxes. All `accent-color` overrides have been removed from module CSS files and inline TSX styles — they have no effect once `appearance: none` is set. The `--logic-lime-rgb` fallback is `217, 249, 157` (matching the global token, not the incorrect `194, 255, 74` used in old fallbacks).
**Rationale:** Standard browser checkboxes clash with the dark HUD aesthetic. The lime-on-dark brand palette makes checked states immediately readable and on-brand. A global rule ensures no new checkboxes are accidentally left unstyled.
**Applies to:** All `input[type="checkbox"]` globally; the 18px `.selectionCheckbox` class in `teams-admin.module.css` is the reference for larger table-row selection variants.

---

### 2026-05-24 — Page header icon box: align-items flex-start not center
**Decision:** `.headerLeft` (the icon + title/subtitle flex row in the page header) uses `align-items: flex-start` so the icon box top-aligns with the title text. `align-items: center` caused the 48px icon box to float ~4px below the title start when the text block was taller — visually misaligned.
**Rationale:** Icon boxes should anchor to the title, not to the midpoint of the entire text group.
**Applies to:** `communication.module.css`, any page header using the icon-box + title/subtitle layout

---

### 2026-05-24 — Empty state CTAs must not use btn-data
**Decision:** Buttons inside `.empty-state` must use `btn btn-lime` (or `btn btn-outline`) without `btn-data`. `btn-data` enforces 0.62rem monospace uppercase, which is correct for header/table CTAs but creates an undersized, stiff appearance as a centered page-level call-to-action. The empty state CTA gets its own padding via a local `.emptyCta` class.
**Rationale:** `btn-data` is the "operational terminal" aesthetic for data-dense contexts. An empty state is an invitation, not an action bar row. The size and weight need to match the informational hierarchy of the surrounding text.
**Applies to:** Communications page empty state; empty state CTA pattern globally

---

### 2026-05-24 — Communications page replaces Announcements + old Communications pages
**Decision:** The unified `/admin/tournaments/communication` page supersedes both the old Announcements page and the previous Communications page. It handles site posts and email sends from one compose panel with a shared history log. Template chips use a pill style (`--bg-inset`, `--border-subtle`, 20px border-radius). A "× Clear" text button (`.draftClear` style) appears inline at the end of the template row only when title or body has content — preferred over a "Blank" template chip, which is semantically awkward.
**Rationale:** Consolidating site posts and emails into one place reduces context switching. The inline Clear affordance reuses the existing draft-clear pattern for consistency.
**Applies to:** `app/[orgSlug]/admin/tournaments/communication/page.tsx`, template clear pattern globally

---

### 2026-05-24 — Admin pages use full width, no page-level max-width
**Decision:** Tournament admin pages must not set a `max-width` on the `.page` wrapper. The shared admin shell provides its own container constraints. Page-level max-width creates inconsistent layout where the header button appears stranded far from the right edge.
**Rationale:** All pages (Registrations, Schedule, Results) stretch full width. Announcements had a leftover `max-width: 860px` that was removed.
**Applies to:** All tournament admin pages, global

---

### 2026-05-24 — btn-lime for primary admin shell CTAs, btn-primary for modal actions
**Decision:** Primary action buttons in the admin shell page header (Add Team, Add Game, New Post, etc.) use `btn-lime btn-data`. `btn-primary` (navy gradient) is reserved for modal save/confirm buttons.
**Rationale:** The global CSS comment at `.btn-lime` is explicit about this convention. Mixing btn-primary into the admin header produces the wrong brand color (dark navy vs. logic-lime).
**Applies to:** All tournament admin page headers, global convention
**⚠ Extended:** See newer entries "AUDIT RULE: btn-primary is banned outside overlay modals" and "btn-data is the standard size modifier" — those entries supersede the page-header-only scope of this one and apply the rule to all admin shell contexts.

---

### 2026-05-24 — Export button belongs in the toolbar (align="end"), not the page header
**Decision:** ExportMenu always lives in a `ToolbarGroup align="end"` on the first toolbar row, before the Tools menu. It must not live in `TournamentAdminHeader` actions. The header is reserved for one primary lime CTA (Add Team, Add Game) and secondary outline actions (Open Scorekeeper View). Export is a utility/data-extraction action contextually tied to the current filter state.
**Rationale:** Export respects current filter state (division, status), so it belongs near the filters. The header should have one clear primary action. Well-established admin tool pattern: filters + export in the toolbar row, primary create action in the header.
**Applies to:** All tournament admin pages with export (Registrations, Schedule, Results), global convention

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

---

### 2026-05-24 — News Posts: remove delivery note banner
**Decision:** Removed the "Public post only / Email Teams" banner from the News Posts list page entirely.
**Rationale:** The page subtitle ("This does not send email") already communicates the key distinction. Communication is adjacent in the nav. The banner was pure redundancy that added visual weight before users could see their posts.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`

---

### 2026-05-24 — News Posts: action-oriented empty state
**Decision:** Empty state now shows an icon, a "Keep teams informed" title, a one-line description, and an inline "Publish First Post" CTA button — replacing the passive "No posts yet. Create one above." pattern.
**Rationale:** Empty states should be self-contained action prompts, not pointers to other parts of the UI. Removes the awkward "above" reference when the header button is not in the user's focus area.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`, empty state pattern globally

---

### 2026-05-24 — Upgrade upsells must not interrupt active task flows
**Decision:** The Tournament Plus locked-targeting upsell was removed from the New/Edit Post modal. The `NEWS PAGE VISIBILITY` section only renders when `canTargetAnnouncements` is true (Plus/League/Club). Free orgs see a clean Title → Body → Pin → Publish flow.
**Rationale:** Free org posts are all-divisions by default — there is no decision to make, so showing a locked feature block mid-form adds friction to every create/edit action without enabling any task. Upsells belong on plan/subscription pages, not inside creation modals.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`, upgrade gate placement globally
