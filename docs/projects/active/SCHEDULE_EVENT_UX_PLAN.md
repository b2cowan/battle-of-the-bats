# Schedule & Event Experience — Rework Plan (Tier 1)

**Status:** COMPLETE on `dev` (uncommitted, 2026-06-28/29) — Phases 1–4 + Tier-2 game-day fields & smart location/Maps + recurrence/series-edit + W-L-T filter + an owner-added **Attendance tab redesign** (compact one-line rows + metric/filter chips, GameChanger-inspired on-brand; /design-logged 2026-06-29). Remaining separate tracks: event-resource **files V2** + a **parent/player surface**. ⚠ Release: apply migs **160, 161, 162** to prod before promoting.
**Companion brief:** `SCHEDULE_EVENT_UX_PM_BRIEF.md`
**Parent:** Premium Coaches Portal walkthrough (`PREMIUM_COACHES_PORTAL_WALKTHROUGH_PLAN.md`) — Schedule surface.
**Surface:** Premium Coaches Portal → Schedule (`/{orgSlug}/coaches/teams/{teamId}/schedule`) — the event create/edit form, the event detail slide-over, and the calendar views.

## Why
A proactive UX + design eval (2026-06-28, two specialist passes, findings verified against the code)
concluded the Schedule section is sound but built as **one generic form + one generic, heavily-stacked
detail panel** that every event type flows through. The biggest wins are structural and need **no
database change**: tailor the form per event type, slim the detail panel, and model multi-day
tournaments correctly. (Full eval findings are summarised at the bottom of this file.)

## Owner decisions (2026-06-28)
- **Per-type forms:** approved — forms may differ per event type where it improves the UX.
- **Uniform:** gets its own dedicated field (lands with the Tier-2 game-day fields, not Tier 1).
- **W-L-T scope:** default = include **League + Tournament**, exclude **Scrimmage**, with coach control —
  exact control model pending owner pick (see "Open decisions").

## Sport-neutral guardrail
Period/score vocabulary and any sport rules route through the Sport Pack (`lib/sports.ts` —
`getSportPack`, `DEFAULT_SPORT`); the lineup work already follows this. New copy stays sport-neutral.

## Conventions / guardrails (carry from the lineup work)
Coaches-portal warm tokens (no monospace data-font); shared `ConfirmProvider`/`useConfirm()` for confirms;
sticky save-bar + `UnsavedChangesGuard` patterns for unsaved edits; `/review` after each phase; restart the
dev server after new files / shared-module changes. The slide-over also hosts the **Attendance / Lineup /
Result** tabs (incl. the just-shipped lineup builder + printouts) — **must not regress those.**

---

## Phase 1 — Per-type, grouped event form (NO migration)
Replace the single undifferentiated input grid with a **type-aware form grouped into labelled sections**
so a coach only sees the fields that matter for the event they're creating.

- **Sections:** **When** · **Where** · **Who** (games only) · **Details/Notes**. Each section is a light
  panel with a small section title (reuse the existing detail-section primitive), not one flat column.
- **Per-type field sets:**
  - *League / Tournament game / Scrimmage:* When (date + time) · Where (location + field/diamond — field
    lands in Tier 2) · **Who** (opponent + Home/Away) · Notes.
  - *Practice:* When (one-off **or** recurring: day-of-week + time + date range) · Where · Notes. (No Who.)
  - *External tournament:* When = **date range** (see Phase 3) · Where · Notes. (No Who, no single time.)
  - *Team event:* When · Where · Notes. (No Who.)
- **Name de-duplication (folds eval #4):** for the three game types, the event **name auto-derives** from
  type + opponent ("League Game vs Lady Jays"), shown as an editable, pre-filled value — no longer a
  blocking required field that just repeats the opponent. Non-game types keep an explicit name.
- **Home/Away promotion (folds eval #5):** Home/Away becomes a clear, **default-set** 3-way choice
  (Home / Away / Neutral) with a one-line hint ("affects your printout and home/away record"), because it
  now drives the dugout-poster "@/vs" and the win/loss orientation. Default to **Home**.
- **Type switching:** changing the event type inside the form keeps shared fields and only resets
  type-specific ones (or guards with a confirm) — today picking the wrong type means closing + re-entering.
- Add + Edit share the form; per-type rendering must work for both. Keep the sticky modal footer +
  unsaved-changes guard already in place.

**Out of P1:** the new game-day fields (arrival time, field/diamond, uniform) — those need a migration and
ride in the Tier-2 follow-on; P1 lays the grouped sections they slot into.

## Phase 2 — Slimmer event detail panel (NO migration)
Cut the vertical stacking so a coach reaches the actionable content (attendance/lineup) without scrolling,
especially on mobile.

- Replace the flat label/value list with a **compact event header**: one tidy meta line
  (date · time · place · opponent · Home/Away), with **Notes** as a quiet paragraph below, grouped only
  where a type genuinely has more to show. Raise the faint label contrast.
- **Action-row hierarchy (folds eval #10):** make **Edit** the prominent action; group **Cancel** +
  **Delete** as the destructive pair with a visual separator; fold the tournament **"Add game"** button
  into this row (today it's an orphaned inline-styled block between actions and tabs).
- Keep the **Attendance / Lineup / Result** tab strip directly under the header — verify the lineup builder,
  printouts, templates, and the result/score entry all still work unchanged.
- Mobile: the detail panel becomes a **bottom-sheet** (per the coach design addendum) so the tabbed content
  isn't clipped behind the bottom nav.

## Phase 3 — Tournament structure & calendar spanning (NO migration) — ✅ BUILT 2026-06-29 (dev, uncommitted)
Make a multi-day tournament behave like one, and make game slots attach correctly.
**Built:** multi-day tournaments span every covered day in week (Day n/N) + month (continuation "›") views and read as a date range in list view (no more misleading 12:00 AM); all-day events sort to the top of each day. Add-event menu nests "Game (Tournament)" under "Tournament"; the form adds a "Which tournament?" attach selector (prefills the game onto the tournament's start day) and blocks saving an orphaned, parent-less game slot — when no tournament exists yet it offers a one-tap switch to create one first. /review-passed (one low-severity dead-end guard fixed); typecheck + focused lint clean.

- **Date range:** external tournaments capture a start **date** and end **date** (no single time), reusing
  the existing start/end storage. The detail header reads "Jul 1–3, 2026".
- **Calendar spanning:** week + month views render a tournament across **all its days** (today it shows on
  the start day only).
- **Game-slot discoverability (folds eval #3 second half):** in the add-event picker, visually nest
  "Tournament game" under "Tournament"; when adding a tournament game, offer a **"which tournament?"**
  selector that attaches it to an existing tournament (prevents orphaned, parent-less game slots). The
  in-tournament "Add game" shortcut stays.

## Phase 4 — Event resources: attachments & links (links V1; REQUIRES a small migration) — ✅ BUILT 2026-06-29 (dev, uncommitted)
**Built:** a **"Links"** section on every event (form + detail). Coach adds labelled web links (label + URL);
per-type placeholder hints (tournament→rules, practice→drill video, game→field map, team event→flyer). Detail
shows tappable rows with a video/map/doc/generic icon, opening in a new tab (explicit `window.open`, same as
the venue Maps fix). **mig 162** adds `rep_team_events.resources jsonb` (additive/nullable) holding a typed
array `{type:'link',label,url}` — `type` reserves room for `'file'` V2 (Documents storage) with no schema
change. Validity (http/https), per-event cap (10), and trimming are app-enforced (`lib/rep-event-resources.ts`
`sanitizeResources`) on **every** write path (create single + recurring, edit single + series); client blocks
save on an incomplete/bad row. Threaded through create/single-update/series-update; reads free off the event.
DATA_DICTIONARY + dev/prod snapshots refreshed (#162). /review-passed high-risk + an independent security pass
(no XSS — http(s)-only, React-escaped label; sanitize on all paths). typecheck + lint clean. ⚠ mig 162 DEV-only
/ PROD-PENDING — apply before promoting (event create/edit writing `resources` would 500 on prod pre-mig).
**V1 is coach/assistant-facing** (no parent/player surface yet); built ready to surface there later. **Files V2
deferred.** Original spec below.
Owner **DECIDED 2026-06-28: links first.** Add a **"Resources / Attachments & links"** section to events so
a coach can attach labelled URLs — a YouTube drill, a Google Doc practice plan, a tournament rules page, a
field map. Rides on the Phase 1 grouped form + the Phase 2 detail panel (it's a new section in both).
- **V1 (links):** a per-event list of `{ label, url }`; clickable rows with a recognizable icon
  (video / doc / map / generic) in the slim detail panel, addable in the form. Basic URL validation, a
  per-event count cap, links **open in a new tab** (no auto-embed in V1). Small additive migration (a
  structured per-event resources store) + DATA_DICTIONARY + dev/prod snapshots in the same unit of work
  (mirror the lineup-templates discipline; prod-pending until release).
- **Forward-compatible storage:** model the store as a **typed resource** (`type: 'link' | 'file'`) so
  **file attachments** can join later **without a rebuild**. Files V2 reuses the existing **Documents**
  storage (upload/download, size/type limits, permissions) — its own follow-on, not V1.
- **Per-type prompts:** tournament → rules/schedule; practice → drill videos/plan; game → field map/parking;
  team event → flyer. The section shows for every type (just different placeholder hints).
- **Audience note (important):** V1 is **coach/assistant-facing** (no parent/player login yet — future
  track). Build it ready to surface on a parent/player schedule view when that exists; meanwhile a coach can
  still paste links into a team email/announcement. The "players watch the drills" payoff is gated on that
  future surface — V1 value is the coach's own at-hand reference.

---

## Immediate follow-on (Tier 2 — REQUIRES a small migration)
Rides directly on the Phase 1 grouped form; owner has greenlit the uniform field.
- **New game-day fields — ✅ BUILT 2026-06-29 (dev, uncommitted; mig 160 DEV-applied / PROD-PENDING):**
  **arrival / call time** (When, all timed types; a "be there by" clock time), **field / diamond #** (Where,
  beside Location), **uniform** (games only). Shown on the slim detail header, the spreadsheet export
  (new Arrival / Field / Uniform columns), and the ICS export (field# joins LOCATION; arrival + uniform lead
  the DESCRIPTION). mig 160 = 3 nullable text cols on `rep_team_events`, additive, no CHECK (UI-shaped);
  DATA_DICTIONARY + dev/prod snapshots refreshed (#160) in the same unit of work. /review-passed (high-risk
  tier; 1 low fix). ⚠ reads degrade safely on prod pre-migration (undefined→null) but **event create/edit
  500s on prod until mig 160 is applied** — apply before promoting.
- **Venue field — DECIDED 2026-06-29: "smart free-text," NOT a venue library.** Location stays free text.
  **Name/address split (mig 161 DEV-applied / PROD-PENDING):** `location` is the place **NAME** (shows on the
  schedule + recent chips) and `location_address` is an optional **street address** that powers the Maps link
  (query prefers address, falls back to name) — mirrors `diamonds.name`/`.address`. **Recent-location chips**
  (themed, replacing the native datalist popup, which rendered as an unstyled misaligned white box) suggest the
  team's own past places and **refill both name + address** in one tap. The detail shows a tappable **Google
  Maps** link (reuses shared `getMapsUrl`/`LocationLink`); the address also rides the ICS `LOCATION`.
  **No dedicated coaches venue-library section** — the org venue library (`org_venues`) is admin-only +
  League/Club-plan-gated and would be **empty for standalone Premium (team-workspace) teams**, so it's poor
  value. Forward-compatible: org-venue *suggestions* for org-backed teams can later feed the same chip list with
  no rework. Field/diamond # is free text (no FK), mirroring the no-FK stance.
- **Recurrence for games & team events + series-edit scope (eval #7) — ✅ BUILT 2026-06-29 (dev, uncommitted; NO migration):**
  League games & team events can now **repeat weekly** (was practice-only); scrimmages/tournament games stay
  one-off. Editing a repeating event now offers **This event / This & future / All** (mirrors delete) and
  bulk-applies the shared fields + time-of-day across the chosen scope, each occurrence keeping its own date.
  **Also fixed the latent recurrence-anchor defect** (DATA_DICTIONARY rep_team_events gotcha): the first
  occurrence is now a real anchor (explicit id, inserted first; children reference it) so "this & future / all"
  edits AND deletes resolve the whole series; "This & future" delete from the first occurrence now removes it
  too. /review-passed high-risk (independent adversarial pass: pre-empted a self-FK insert-ordering risk by
  inserting the anchor before its children; hardened the recurring-edit save guard). typecheck + lint clean.
  ⚠ old dev test series created before this fix keep the broken anchor (children → a non-row uuid) — only
  affects pre-existing rows.

## Owner decisions (continued)
- **W-L-T control model — DECIDED 2026-06-28: "smart default + quick filter."** The record defaults to
  **League + Tournament** (scrimmages off); small include/exclude toggles for **League · Tournament ·
  Scrimmage** sit on the widget and recalculate the record live; the coach's selection is **remembered**
  across visits (persist client-side; a per-team setting is not required for V1). An optional category
  breakdown on expand is a nice-to-have. This makes the W-L-T fix a self-contained slot-in (its own small
  phase) independent of P1–P3. (Note: results already exist per event via the team-relative scoring fix —
  mig 158; this is a read/aggregation + filter-UI change, no migration.)
  **✅ BUILT 2026-06-29 (dev, uncommitted; NO migration):** the Season Record widget now defaults to
  League + Tournament (Scrimmage off), with three lime toggle chips that recalc live; the choice is
  remembered per team (client-side); an optional **Breakdown** expands a per-category record (excluded
  categories dimmed). The widget now appears for any finalized game across the three game types (was
  league-only). typecheck + lint clean (one advisory warning on the persisted-state load effect).

## Sequencing rationale
P1 + P2 are the most visible and need **no migration** → ship first, `/review` each. P3 is self-contained.
The Tier-2 field additions (one migration) fast-follow on the P1 form. W-L-T scope is independent and slots
in once the owner picks a control model. Each phase is independently shippable and browser-verifiable.

---

## Eval findings (2026-06-28) — source for this plan
UX/IA + visual-design passes; verified against code. Severity: High/Med/Low.
- **High — one generic form for all 6 types** → per-type grouped form (P1).
- **High — detail panel over-stacked** (pill→title→list→actions→add-slot→tabs) → compact header (P2).
- **High — multi-day tournament stored as a single time; shows on one calendar day** → date range + spanning (P3).
- **High — tournament "game slot" relationship undiscoverable; slots can be orphaned** → nest + attach (P3).
- **High — "Name" required but redundant with opponent** → auto-derive (P1).
- **High — Home/Away easy to skip yet drives printout "@/vs" + W/L orientation** → prominent default-set choice (P1).
- **High — recurring practice can't be edited as a series; only practices recur** → Tier-2 follow-on.
- **Med — missing game-day fields:** arrival/call time, field/diamond #, uniform → Tier-2 follow-on.
- **Med — season W-L-T silently counts league games only** (excludes scrimmage + tournament) → owner decision above.
- **Med — calendar scannability:** no type icons in list rows, tiny month chips, inert "+N more" → polish (Tier 3).
- **Med — detail action-row hierarchy** (Edit/Cancel/Delete equal weight) → fixed in P2.
- **Low — mobile:** detail panel should be a bottom-sheet; week view forces sideways scroll → P2 / Tier 3.
- **Corrected (not a blocker):** the "blue vs lime" accent is a **portal-wide** secondary-accent convention,
  not a Schedule-only anomaly; a minor portal-wide tidy at most (Tier 3), not in this plan's core.
