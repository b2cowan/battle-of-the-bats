# Design Decisions Log

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

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
