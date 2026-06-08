# Tournament Admin — Visual Redesign QA Checklist (Phase E)

> Companion to `ADMIN_VISUAL_REDESIGN_PLAN.md` (Phases A–D built). Walk every admin surface
> in the matrix below on **mobile and desktop**, in **both density modes**, and across the
> lifecycle/theme axes. Tick each cell. Log issues inline (date + short description);
> implement fixes in the same session. Phase E is the project close-out.

---

## How to use this — "fix once, applies everywhere"

- The **Shared / cross-cutting** section covers global shell components (top app-bar, sidebar,
  bottom nav, context strip, density toggle, notification panel, admin header/toolbar). These
  render on *every* page, so **if one is wrong on one page it's wrong on all** — log it once in
  that section and fix it systemically.
- The **Per-page** sections are for issues unique to that page's own content and layout. If
  something is actually a shared component, move it up to Shared.
- Per-page issues can be logged at any audit depth; mark `🔄` when in progress, `✅` when both
  mobile + desktop pass all density/theme axes.

---

## Test matrix (axes to cover for every page)

| Axis | Values |
|---|---|
| Viewport | **Mobile** (~390px) · **Desktop** (1280px+) · *spot-check tablet 900–1023px for nav/top-bar transitions* |
| Density | **Compact** (desktop default) · **Comfortable** (mobile default) |
| Theme | **Dark** · **Light** |
| Org branding | **Default** (FieldLogicHQ blue) · **Branded** (custom `--primary`, e.g. Milton Bats purple) |
| Lifecycle | **Draft** · **Active / Live** · **Completed** |
| Motion | One pass with **prefers-reduced-motion: reduce** on |

## Test data

| Where | What |
|---|---|
| `dev-test-org/live-demo` | Seeded live-game-day tournament (day 1 = today, LIVE games + bracket); run `node --env-file=.env.local scripts/seed-live-tournament.mjs` to refresh |
| `dev-test-org/(any)` | For Draft + Completed states — clone or set status |
| Branded org | Apply Milton Bats palette (`theme_preset = 'platform'` on milton-softball org) for purple-primary branded pass |
| Free-tier org | Create a separate free-plan Tournament org to check upsell/locked-card states |

---

## Shared / Cross-cutting (fix once → applies to every page)

Walk in **dark + light**, **mobile + desktop**, **compact + comfortable**, **branded + default**.

### Shell & chrome

- [x] **Mobile top app-bar** (≤900px) — OPEN/LIVE/COMPLETED pill correct by phase (`isWithinEventDates`); switcher accessible; bell reachable; `liveDot` reduced-motion gated; no conflict with page headers (status chip removed from dashboard header)
- [x] **Desktop sidebar** — worklist badge on Results ✅; "● Open" for pre-event active (not "● Live") ✅; density toggle removed ✅; Preview Site + Help + Logout in footer ✅
- [x] **Bottom nav** (≤900px, 5 tabs) — worklist badge on Results ✅; context strip docked above nav ✅; More dropdown: Operations/Setup/Admin sections present ✅; Display/density section removed ✅; View Site + Logout in footer ✅
- [ ] **AdminContextStrip** — 2026-06-05 code review PASS: `position:absolute; bottom:100%` inside nav; `--admin-strip-h` set/cleared via `useEffect`; phase/count logic correct; `--hud-surface` + blueprint-border ✓. **Needs browser verify**: strip shows on Teams/Results pages with pending items; dismisses; re-shows when count rises; doesn't overlap selectionBar (fixed: selectionBar bottom now includes `var(--admin-strip-h,0px)`)
- [ ] **Density toggle** — needs browser verify: compact ↔ comfortable live; persists; no flash; visible in sidebar footer + More sheet
- [ ] **Notification panel** — needs browser verify: mobile positioning (not clamped to sidebar); z-index; mark-read
- [ ] **Blueprint grid** — needs browser verify: mobile 28px cell + lower alpha

### Shared UI components

- [x] **TournamentAdminHeader** — 2026-06-05: `.headerMain` → `align-items: flex-start` (icon top-aligns on long subtitles). 30px icon ✓, lime title ✓, 0.5rem bottom margin ✓, `mobileActionsInline` inline-row CSS rules present ✓. Needs browser verify: icon alignment with subtitle, inline actions at mobile width.
- [ ] **TournamentAdminToolbar** — code review PASS: density-driven `--admin-control-h` ✓; mobile column layout ✓; sticky blur ✓. Needs browser verify: sticky positioning below mobile top bar; no horizontal overflow.
- [ ] **Filter chips** — needs browser verify: lime active state; `--admin-chip-h` height; ≥44px comfortable tap target
- [ ] **GameList rows** — needs browser verify: density tokens; live-state stripes; conflict stripe priority; status markers vs badges; no team-name truncation
- [x] **FeedbackModal** — 2026-06-05: confirm button `btn-primary` → `btn-lime` (non-danger types). Global `.modal` CSS: `border-radius:0` ✓, `--hud-surface` ✓, blueprint border ✓, `h3` 0.75rem mono uppercase ✓. Items list `borderRadius:0` inline ✓, `--white-05` token valid ✓. Needs browser verify: warning/success confirm button colour.
- [ ] **BottomSheet primitive** — needs browser verify: spring slide, drag handle, focus trap, Esc, scroll-lock
- [ ] **Empty states** — teams page fixed (3 states + CTAs). Needs sweep of other pages during per-page review.
- [ ] **CountUp animations** — needs browser verify on dashboard stat cards
- [x] **btn-primary audit** (tournaments scope) — 2026-06-05: AdminHubClient CTA → `btn-lime`. Schedule page 5× inside modal footers (exempt; will fix during Schedule review). PlayoffWizard 2× — review during Schedule. Out-of-scope pages (accounting/rep-teams/house-league) deferred.
- [ ] **Tabular numerals** — needs sweep during per-page review
- [ ] **Reduced motion** — global `animation-duration: 0.001ms` ✓ in globals.css. Needs verify: CountUp snaps, stripe no animation, strip no animation

---

## Per-page

Status key: `⬜` not started · `🔄` in progress / issues logged · `✅` mobile + desktop + both densities + dark/light pass

For each: **M** = mobile, **D** = desktop, **C** = compact, **K** = comfortable.

---

### Admin Hub & Onboarding

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Admin hub (`/admin`) | ⬜ | ⬜ | Check hub cards, org counts, pending-attention, League/Club vs Tournament layout |
| Onboarding checklist (`/admin/onboarding`) | ⬜ | ⬜ | 6-step wizard (plan step removed); Back disabled on step 1; density; focused flow hides top app-bar |

---

### Tournament Entry Points

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Tournament list (`/admin/tournaments`) | ⬜ | ⬜ | Cards/rows; `+` create button; Plus-gated slot-limit; plan pill |
| Create/manage wizard | ⬜ | ⬜ | Year derived from dates; start+end required; no contact step; 6-step counter |

---

### Dashboard

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Dashboard — Draft state | ⬜ | ⬜ | Launch checklist; ACTIVATE chip; `isGameDay=false` → registration board |
| Dashboard — Active / Live state | ✅ | ✅ | Metric strip (pre-event) · game-day board (game day) · context strip · no stat cards · no Customize on game day · sparkline wired (renders when trend data > 0) |
| Dashboard — Completed state | ⬜ | ⬜ | Wrap-up view; archive button (owner-only) |

---

### Teams / Registrations

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Teams — List view | ✅ | ✅ | `btn-primary` → `btn-lime` (expanded Accept, Promote, modal CTAs). Mobile docked bar: 3 triage-only actions. Checkbox top-right in card view. |
| Teams — Card view (mobile auto) | ✅ | n/a | Auto card at ≤768px. Checkbox absolute top-right; name row has padding-right clearance. |
| Teams — Filter menus (Status / Payment) | ✅ | ✅ | Desktop inline dropdown; mobile bottom sheet. |
| Teams — Empty state | ✅ | ✅ | 3 distinct cases with `btn-lime` CTAs: Configure Divisions / Add Team / Clear Filters. |

---

### Check-in

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Admin Check-in board (`/admin/tournaments/check-in`) | ✅ | ✅ | Border-radius sweep; gauge cards → blueprint-blue aesthetic; team name 2-line wrap; "Gate view ↗" icon-only on mobile (inline header), full text on desktop; check-in btn icon-only on mobile list |
| Gate / Volunteer view (`/check-in`) | ✅ | ✅ | Background `#0A0A0A` → `var(--hud-surface)`; header sub-label crowding fixed; roster editor DOB removed → `[#][Name][×]` rows; bottom sheet action buttons sharp-cornered |

---

### Schedule

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Schedule — List view (Round Robin) | ⬜ | ⬜ | Toolbar (division + stage toggle visible mobile); GameList rows; status chips; conflict chip; health panel sticky; venue optgroup labels |
| Schedule — List view (Playoffs) | ⬜ | ⬜ | Playoff stage; bracket toggle visible; list ordering (bracketRoundInfo) |
| Schedule — Bracket view | ⬜ | ⬜ | `BracketConnectors.tsx` SVG beziers; final-round lime spotlight; team-color dots; mobile round carousel (86vw, scroll-snap); drag with `TouchSensor` |
| Schedule — Timeline view | ⬜ | ⬜ | Venue×time grid; drag-to-move; conflict shading; TBD tray; mobile single-facility pager; "now" line; Plus-gated gate |
| Schedule — ScheduleHealthPanel (sticky) | ⬜ | ⬜ | Pinned under chrome; default-collapsed; jump-to-conflict chip; KPI tabular nums |
| Schedule Generator modal | ⬜ | ⬜ | HUD modal header; segmented mode toggle; flat date slot rows; NumberStepper inputs; Generate `btn-lime btn-data`; bottom-sheet at ≤540px |
| Playoff Wizard modal | ⬜ | ⬜ | NumberStepper inputs ≥44px on mobile; Seed Teams step (drag-reorder + Randomize); format selector; bracket preview |

---

### Results

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Results | ⬜ | ⬜ | Same GameList; scoring mode (thumb steppers mobile-only); date · time inline; status mobile markers vs desktop badges; B3 live/overdue/next stripes |

---

### Communication

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Communication | ⬜ | ⬜ | Compose panel `max-width: 860px`; template chips; `btn-data` actions; empty state CTA (no `btn-data`); history log |

---

### Rules & Resources

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Rules | ⬜ | ⬜ | Mobile density pass (0.62rem section title, 0.82rem card title, tight paddings); section save bar; layout toggles (columns/single + list/grid) |

---

### Public Site (Branding)

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Branding / Public Site | ⬜ | ⬜ | Accordion (mobile ≤600px); locked-card compact rows + single upsell; lime segmented bg-toggle active; logo square `border-radius: 2px`; `btn-lime btn-data` Save |

---

### Contacts

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Contacts | ⬜ | ⬜ | List; add contact; import; roles; empty state |

---

### Divisions

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Divisions — Capacity fill board | ⬜ | ⬜ | Card grid (`auto-fill minmax(260px)`); capacity gauge (neutral/lime/amber/red); no-capacity fallback; correct tokens (`--border-2`, `--white-40`) |
| Divisions — Flat-row table (alternate) | ⬜ | ⬜ | 5 columns; column hiding at breakpoints; `.divisionMeta` sub-line mobile; icon-only Add ≤760px |

---

### Venues

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Venues | ⬜ | ⬜ | `TournamentAdminHeader`; `max-width: 860px` list; inline edit (lime border); Add-only modal; `Navigation` icon for Maps; `border-radius: 4px` cards |

---

### Archives

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Archives | ⬜ | ⬜ | List of past tournaments; empty state; density |

---

### Post-Event Summary (Plus)

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Summary | ⬜ | ⬜ | Review in both Free (locked/upsell) and Plus (full) states |

---

### Settings

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Settings hub | ⬜ | ⬜ | Flat 3-card grid (Reg Questions / Staff / Billing); locked cards as links; League/Club redirect |
| Event Settings | 🔄 | 🔄 | 2026-06-05: "Competition Rules" → "Schedule Rules"; Score Finalization moved → Notifications & Contact card. **Cards now collapsible** (new shared `CollapsibleCard` primitive, native `<details>`, bigger lime header; **all 5 start collapsed** per user — clean stack of labelled header bars). **Year field dropped** (derived from start date in save payload). Auto-save footer unchanged. Needs browser verify: collapse toggles persist, auto-save still fires when a collapsed card's field changes. |
| Data Tools (`/admin/tournaments/data-tools`) | 🔄 | 🔄 | 2026-06-05: collapsed the 3 duplicated tool cards into **one "Import & Export" CollapsibleCard**. **Import** + **Export** are dropdown menus (Teams/Schedule · registration XLSX/CSV). **Templates** reworked from an 8-item dropdown → inline **XLSX\|CSV format toggle + 2×2 matrix** (Teams/Schedule × Current/Empty = 4 buttons, no duplication). Removed all page-nav clutter ("Open schedule/results workspace" links + "Reference Data" Divisions/Venues section). **Recent Imports** collapsed-by-default. `ToolbarMenu` got `keepLabel` (mobile labels for primary menus). Removed dead `ActionButton`/`ActionLink`/`PageLink`. Needs browser verify: menus open/position, format toggle switches all 4 template buttons, locked tooltips, mobile reflow. |
| Registration Fields | ⬜ | ⬜ | Field list; add/remove/reorder; drag; density |
| Members & Access | ⬜ | ⬜ | Staff table; `overflow: visible` on `.tableWrap` (tooltip clipping fix); role tooltips; invite flow |
| Subscription / Billing | ⬜ | ⬜ | Plan display; upgrade path; token compliance |

---

### Public Preview (admin-side shell)

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Preview layout + nav | ⬜ | ⬜ | Preview chrome doesn't break public page tokens; back-to-admin link |

---

### Org-level Pages (League / Club tier)

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Org Members | ⬜ | ⬜ | `overflow: visible` on `.tableWrap`; role tooltips; invite; status chips |
| Org Settings | ⬜ | ⬜ | Token compliance; button audit; layout |

---

## Cross-cutting findings log

Log any issue that spans multiple pages here (instead of repeating it in every page row).
Assign a tag (e.g. `[CHROME-1]`) so per-page notes can reference it.

| Tag | Description | Status |
|---|---|---|
| — | *(none yet)* | — |

---

## Token & class compliance checklist (once per session, not per page)

- [ ] `grep -r "btn-primary" app/[orgSlug]/admin/` returns zero results outside `.modal` wrappers
- [ ] `grep -r "btn-sm" app/[orgSlug]/admin/` returns zero results (use `btn-data`)
- [ ] `grep -r "btn-purple" app/` returns zero results (confirmed banned)
- [ ] No undefined tokens (`--text-2`, `--border-1`, `--surface-3`, `--bg-surface`, `--border-subtle`, `--text-tertiary`) in admin/coaches CSS
- [ ] `npm run check:tokens` passes (public-module hex guardrail)
- [ ] Status colour = row colour: every status chip / stripe / badge / legend entry uses the *same* token for the same status (scheduled = info, overdue = danger, next = warning, done = success)
- [ ] Every action is a real button (`btn-lime`, `btn-ghost`, `btn-danger`, `btn-outline`) — no fake-button labels styled to look interactive

---

## Progress summary

| Section | Pages | ✅ Done |
|---|---|---|
| Shared chrome | 17 items | 0 |
| Admin Hub & Onboarding | 2 | 0 |
| Tournament Entry | 2 | 0 |
| Dashboard | 3 | 0 |
| Teams / Registrations | 4 | 0 |
| Check-in | 2 | 0 |
| Schedule | 7 | 0 |
| Results | 1 | 0 |
| Communication | 1 | 0 |
| Rules | 1 | 0 |
| Branding | 1 | 0 |
| Contacts | 1 | 0 |
| Divisions | 2 | 0 |
| Venues | 1 | 0 |
| Archives | 1 | 0 |
| Summary | 1 | 0 |
| Settings | 5 | 0 |
| Preview | 1 | 0 |
| Org-level | 2 | 0 |
| **Total** | **56** | **0** |

---

## Sign-off

- [ ] All shared chrome items pass: dark + light, mobile + desktop, compact + comfortable, branded + default
- [ ] All per-page rows: both M + D columns checked
- [ ] Token/class compliance checklist clean
- [ ] No `btn-primary` outside modals
- [ ] `agent_TOURNAMENT_DESIGN_REVIEW.md` updated with any new binding findings
- [ ] `memory/design_decisions.md` updated with any new binding decisions
- [ ] Move `ADMIN_VISUAL_REDESIGN_PLAN.md` + `ADMIN_VISUAL_REDESIGN_PHASE_A.md` + this checklist to `docs/projects/archive/` when complete
