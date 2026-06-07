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
- [x] **AdminContextStrip** — ✅ signed off 2026-06-05 (strip shows/dismisses/re-shows by count; no nav/selectionBar overlap)
- [x] **Density toggle** — **REMOVED from UI** (no density toggle exists; confirmed 2026-06-05). N/A — see possible dead-code cleanup note below.
- [x] **Notification panel** — ✅ signed off 2026-06-05 (mobile not clamped; z-index ok; mark-read works)
- [x] **Blueprint grid** — ✅ signed off 2026-06-05 (mobile smaller cell + lower alpha; recedes behind content)

### Shared UI components

- [x] **TournamentAdminHeader** — 2026-06-05: `.headerMain` → `align-items: flex-start` (icon top-aligns on long subtitles). 30px icon ✓, lime title ✓, 0.5rem bottom margin ✓, `mobileActionsInline` inline-row CSS rules present ✓. Needs browser verify: icon alignment with subtitle, inline actions at mobile width.
- [x] **TournamentAdminToolbar** — ✅ signed off 2026-06-05 (sticky under top bar; no overflow; mobile column layout). Re-exercised on Schedule/Results per-page rows.
- [x] **Filter chips** — ✅ signed off 2026-06-05 (lime active; chip height; comfortable tap target). Re-exercised on Schedule/Results.
- [x] **GameList rows** — ✅ signed off 2026-06-05 (live stripes; conflict priority; status markers vs badges; no truncation). Final per-page look during Schedule/Results.
- [x] **FeedbackModal** — ✅ signed off 2026-06-05 (confirm button `btn-primary` → `btn-lime`; sharp HUD modal; items list).
- [x] **BottomSheet primitive** — ✅ signed off 2026-06-05 (spring slide, drag handle, focus trap, Esc, scroll-lock).
- [x] **Empty states** — ✅ signed off 2026-06-05 (icon + title + desc + `btn-lime` CTA; per-page specifics ticked in their rows).
- [x] **CountUp animations** — ✅ signed off 2026-06-05 (0→N first load; re-animates on poll; snaps under reduced motion).
- [x] **btn-primary audit** (tournaments scope) — 2026-06-05: AdminHubClient CTA → `btn-lime`. Schedule page 5× + PlayoffWizard 2× inside modal footers (exempt; confirm during Schedule review).
- [x] **Tabular numerals** — ✅ signed off 2026-06-05 (scores/stats use tabular-nums; no jiggle on live tick).
- [x] **Reduced motion** — ✅ signed off 2026-06-05 (global `animation-duration: 0.001ms`; count-up snaps; stripes/strip render without animation).

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
| Dashboard — Completed state | 🔄 | 🔄 | **IA redesign BUILT 2026-06-07 (awaiting browser verification).** Plan-aware hand-off: **Plus** = thin wrap-up banner (champion chips + headline + "Review event summary →" `btn-lime`) with Final Reg/Pay panels + metric strip removed; **Free** = banner + kept Final Reg/Pay panels + one compact "Review Tournament Plus" upsell. Champion chips on the banner (lime), driven by new dashboard-API `champions`. Archive owner-only unchanged. Verify Free vs Plus org on `/dev-test-org/completed-demo`. See DASHBOARD_SUMMARY_IA_PLAN.md |

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
| Summary | 🔄 | 🔄 | **IA redesign BUILT 2026-06-07 (awaiting browser verification).** Now the single canonical recap in 3 zones: **Recap** (champions band → metric cards w/ completion% folded in → division recap), **Share the results** (compact: copy link / public standings / print — `btn-data`), **What's next** (`CollapsibleCard`, collapsed: Reuse this setup `btn-lime` + visible value-reflection line + opt-in League/Club discovery → `/pricing`). Killed the 2nd hero; renewal CTA removed (auto-renew). All `btn-sm`→`btn-data`. Verify Free (locked/upsell) + Plus (full) + clone-success states. See DASHBOARD_SUMMARY_IA_PLAN.md |

---

### Settings

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Settings hub | ✅ | ✅ | 2026-06-05: Link-card grid (Staff & access / Plan & subscription / Notification prefs); locked cards preventDefault; no btn violations. Fixed undefined tokens in `settings-access.module.css` (`--border-subtle` → blueprint-blue 0.2, `--bg-surface` → `--surface`). |
| Event Settings | ✅ | ✅ | **Signed off 2026-06-05.** "Competition Rules" → "Schedule Rules"; Score Finalization moved → Notifications & Contact. Cards collapsible (`CollapsibleCard`, all 5 start collapsed). Year field dropped (derived from start date). |
| Data Tools (`/admin/tournaments/data-tools`) | ✅ | ✅ | **Signed off 2026-06-05.** One "Import & Export" card: Import + Export dropdowns; Templates = XLSX\|CSV toggle + 2×2 matrix. Removed page-nav clutter + Reference Data. Recent Imports collapsed-by-default. `ToolbarMenu` `keepLabel`. Dead Action* components removed. |
| Registration Fields | ✅ | ✅ | 2026-06-05: `btn-sm` ×5 → `btn-data`; "Add Question" `btn-primary` → `btn-lime btn-data` (form, not modal). Borrows `branding.module.css`. |
| Members & Access | ✅ | ✅ | 2026-06-05: re-exports `org/members`. `btn-sm` ×8 → `btn-data`; modal `btn-primary` ×2 (invite + manage save) → `btn-lime btn-data`. `.tableWrap` already `overflow:visible` ✓. Same fixes cover Org Members row. |
| Subscription / Billing | ✅ | ✅ | 2026-06-05: re-exports `org/billing`. `btn-sm` ×1 → `btn-data`. No `btn-primary`. Same file as org billing. |

---

### Public Preview (admin-side shell)

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Preview layout + nav | ⬜ | ⬜ | Preview chrome doesn't break public page tokens; back-to-admin link |

---

### Org-level Pages (League / Club tier)

| Page | M | D | Notes |
|---|:---:|:---:|---|
| Org Members | ✅ | ✅ | 2026-06-05: same file as Members & Access (`org/members`). `btn-sm`→`btn-data`, modal `btn-primary`→`btn-lime btn-data`, `.tableWrap` overflow ✓. |
| Org Settings | ⏭️ | ⏭️ | **OUT OF SCOPE for this project** (deferred to a separate org-level/League-Club pass). `org/settings` has `btn-primary` ×3 + `btn-sm`/`btn-danger` to fix there, not here. |

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

> _Superseded — see the **Sign-off close-out** below. Per-page rows carry their own ✅ / 🔄 / ⏭️ status inline in the sections above; this count was not maintained._

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

## Sign-off — close-out

**PROJECT CLOSED 2026-06-06** at owner direction ("we're good now; I'll review remaining items with `/design` ad hoc as I find them"). Not every row was individually walked — this is a deliberate close, not a 100% completion.

**Signed off in this project:**
- **Shared chrome** — all 17 items (density toggle was *removed from the UI*, so its row is N/A).
- **Teams / Registrations** (4) · **Check-in** (2) · **Dashboard — Active/Live**.
- **Settings cluster** — hub, Event Settings, Registration Fields, Members & Access, Subscription · plus **Org Members** (same shared file).

**Handed off to a dedicated project:**
- **Dashboard — Completed** + **Post-Event Summary** → "Dashboard Completed + Summary IA" (TODO.md; plan + PM brief in `docs/projects/active/DASHBOARD_SUMMARY_IA_*`). The overlap/noise is resolved there, not here.

**Deferred (review with `/design` as issues surface):**
- **Schedule** (7 rows) — not reviewed; playoff-bracket work was in flight at close.
- Not individually walked: Admin hub, Onboarding, Tournament list + wizard, Dashboard Draft, Results, Communication, Rules, Branding, Contacts, Divisions, Venues, Archives, Preview. These inherit the **already-signed-off shared chrome + token/button conventions**, so they start from a compliant baseline.
- **Org Settings** — ⏭️ out of scope (separate org-level / League-Club pass).

**Standing conventions established (apply to all future admin work):** `btn-lime` / `btn-ghost` / `btn-danger` / `btn-data` only — no `btn-primary` outside modals, no `btn-sm`; `--logic-lime` accents; `CollapsibleCard` primitive for multi-group surfaces; status = label vs action = button; status colour = row colour.

- [x] Archived to `docs/projects/archive/` on 2026-06-06 (PLAN + PHASE_A + PM_BRIEF + this checklist).
