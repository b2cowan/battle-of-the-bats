# Design Decisions Log

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

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
