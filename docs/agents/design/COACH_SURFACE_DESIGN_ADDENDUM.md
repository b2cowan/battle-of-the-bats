# Coach-Surface Design-System Addendum

> **Living reference — loaded by `/design`.** Binding rules for the coach surface (the org-less Basic floor + the tournament-coach experience on the shared `TeamHQ` shell). Produced by the Combined Coach-Surface Design/UX Pass (2026-06-14). The per-state findings + comps that justify these rules live in [docs/projects/archive/COACH_SURFACE_DESIGN_UX_PASS_FINDINGS.md](../../projects/archive/COACH_SURFACE_DESIGN_UX_PASS_FINDINGS.md); **this doc is the locked rule set.** Extends [memory/design-system.md], [memory/design-principles.md], [memory/design-decisions.md].
>
> **Scope:** every route matched by `isCoachPortalShellPath()` — `/coaches`, `/coaches/team/*`, `/coaches/tournaments/*`, `/coaches/teams`. The org-attached Premium coach portal (`/{orgSlug}/coaches/`) is a different shell; only Rule D-5 (table containment) is shared.
>
> **Token rulings (definitive — these recur):**
> - `var(--text-secondary)` = real global (`globals.css:58,166`) = `var(--white-60)`. `var(--text-tertiary)` = real global (`globals.css:59,167`) = `var(--white-40)`. **NOT ghost tokens.** Valid to use; new coach code *prefers* the `--white-N` scale directly, but no replacement pass is required.
> - `--text-2` / `--text-3` / `--text-muted` / `--surface-3` = **banned ghost tokens** (absent from globals.css). The coach surface has zero usages today — keep it that way.
> - `--team-color` is a **single colour value** set inline per team — there is **no `--team-color-rgb`**. Tint it only with `color-mix(in srgb, var(--team-color, var(--logic-lime)) N%, transparent)`, never `rgba(var(--team-color-rgb), …)`.
> - **`--logic-lime` is the coach portal's permanent accent** (the surface is org-less; `--primary`/`--primary-light` are org-overrideable and BANNED in coach-portal accent positions — rail bar, mobile tab, brand mark, CTAs).

---

## Section i — Phase-Adaptive Hero Spec

The tournament phase hero is the `variant="tournament"` branch of `TeamHQ` — ONE `.hero` container, differentiated per phase by four layers: a phase-keyed left-border accent + chip, a phase-keyed background wash, swapped inner content zones, and a checklist that collapses in the result phase.

**Shell rules (all phases):**
- Container: `background:` per-phase (table below); `border: 1px solid color-mix(in srgb, var(--team-color, var(--logic-lime)) 30%, transparent)`; `border-radius: var(--radius)` (12px — NOT `--radius-lg`; the coach card system uses 12px throughout); `position: relative; overflow: hidden; box-shadow: var(--highlight-top)`; padding `1.25rem 1.5rem` mobile / `1.5rem 2rem` desktop (≥768px).
- Left border: `border-left-width: 3px; border-left-color: [phase accent]` — overrides the 1px left edge only; top/right/bottom stay 1px `var(--border)`.
- Monogram: `52px × 52px; border-radius: var(--radius-sm); background: var(--team-color, var(--logic-lime)); font-family: var(--font-display); font-size: 1.1rem; font-weight: 900; color: #fff`; `teamInitials(name)` from `lib/team-color.ts`. **Never a circle.**
- Watermark: `position: absolute; right: -0.5rem; top: 50%; transform: translateY(-50%); font-family: var(--font-display); font-size: 9rem (mobile 6rem); font-weight: 900; color: var(--team-color, var(--logic-lime)); opacity: 0.07; user-select: none; pointer-events: none; aria-hidden`; same initials as the monogram.
- `.heroHead` flex row: `[ Monogram ] [ heroHeadText: title + sub ] [ Phase chip (margin-left:auto) ]`. heroTitle `var(--white)` 1.15rem 800 -0.01em; heroSub `var(--white-60)` 0.85rem.

**Per-phase identity tuple (locked):**

| Phase | Background wash | Left border (3px) | Chip class | Chip label | Headline |
|---|---|---|---|---|---|
| pending | `color-mix(in srgb, var(--info) 7%, transparent)` | `var(--info)` | `badge-info` | Pending | "Registration submitted" |
| rejected | `color-mix(in srgb, var(--danger) 6%, transparent)` | `var(--danger)` | `badge-danger` | Not accepted | "Not selected for this event" |
| accepted_prep | `color-mix(in srgb, var(--team-color, var(--logic-lime)) 18%, var(--surface) 82%)` | `var(--logic-lime)` | `badge-success` | Accepted | "You're in!" |
| schedule_live | same as accepted_prep (18% team-hue) | `var(--logic-lime)` | `badge-success` | Accepted | "You're in!" |
| game_day | `color-mix(in srgb, var(--success) 8%, transparent)` | `var(--success)` | `badge-success` | Game Day | "Game Day" |
| result | `color-mix(in srgb, var(--logic-lime) 7%, transparent)` | `var(--logic-lime)` | `badge-success` (champion) / `badge-neutral` | Champions / Complete | "Champions!" (placement=1) / "That's a wrap!" |

> **Wash rule:** the **18% team-hue mix is the celebration wash** (accepted/prep/schedule-live). Non-celebration phases override with phase-semantic washes at lower intensity (info 7%, danger 6%, success 8%, lime 7%). Light mode: celebration wash 18%→12%, border 30%→25%; phase-semantic washes reduced proportionally.

**Inner content zones (per phase):**

- **`.heroFeeStrip`** *(accepted phases, when `status.fee.hasSchedule && !status.fee.isPaid`)* — the GLANCE layer. Owed: `rgba(var(--warning-rgb),0.08)` bg + `rgba(var(--warning-rgb),0.3)` border + `--radius-sm`; `TriangleAlert` 15px; "Fee owed · [amount] · due [date]" in `var(--warning)`/`--font-data`/700; contact sub-row `--white-60`. Past-due: `rgba(var(--danger-rgb),0.08)` bg + `rgba(var(--danger-rgb),0.35)` border; `XCircle` 15px; "Fee past due · [amount]" in `var(--danger)`; "Was due [date]" sub-row; **`role="alert"`**. **The strip MUST NOT carry the "organizer records payment manually" process note** — that is the DETAIL layer (`TournamentStatusBlock`). Strip = "is there a problem + who do I call"; block = "how much, by when, what's the process."
- **Checklist past-due badge** — when `status.fee.state === 'past-due'`, the Fee row's `.checkState` renders `<span class="badge badge-danger">Past due</span>` + "Was due [date]" micro-text (`--danger`/`--font-data`/0.72rem). Merely owed → plain "Owed" in `--white-40` mono. **Binary by design** (no third state).
- **`.heroTodayCard`** *(game-day only)* — `rgba(var(--success-rgb),0.07)` bg + `rgba(var(--success-rgb),0.25)` border + `--radius-sm`. "TODAY" label `--font-data` 0.64rem 800 uppercase `--success`. Between-games: game count + "Next: [time] · [location]" + opponent. Live sub-state: `.heroLivePill` + `RollingNumber` scores. **Does NOT start its own poll** — receives a server-derived `todayGames` prop + live patches from `CoachLiveSchedule`'s existing poll. `aria-live="polite"` on the score row. The whole card is a `<Link>` to `game.href` when available.
- **`.heroLivePill`** — define in `TeamHQ.module.css` (do NOT cross-import `CoachLiveSchedule.module.css`'s `.liveBadge`): `rgba(var(--danger-rgb),0.15)` bg + `rgba(var(--danger-rgb),0.35)` border + `--radius-sm` + `padding:0.2rem 0.55rem` + `--font-data` 0.64rem 800 0.08em uppercase `--danger` + a preceding 6px pulsing dot (`var(--danger)`, `animation: pulse 1.4s ease-in-out infinite`).
- **`.heroResultCard`** *(result only — replaces `.afterglow`)* — `rgba(var(--logic-lime-rgb),0.05)` bg + `rgba(var(--logic-lime-rgb),0.2)` border + `--radius-sm`. Placement row: `Trophy` 18px `--logic-lime` + "1st Place" `--white`/1rem/800 when `placement === 1`; else "Event complete · [dateRange]" `--white-60`/0.86rem. Record row: "Final record" `--font-data` uppercase 0.64rem 800 `--white-40` + W–L–T in `--logic-lime`/`--font-data`/1.1rem/800 (champion) or the W=`--success`/L=`--white-60`/T=`--white-40` split (non-champion). Action row: `<a class="btn-ghost">View final standings →</a>` + `<SharePageButton url={…} className="btn-lime" label="Share team" />` — **`SharePageButton` does NOT render lime by default; pass `className="btn-lime"` explicitly.** No checklist in the result hero.

**`TournamentStatusBlock` result-phase rule:** new `isResult?: boolean` prop. When true, suppress Fee + Check-in rows; show Roster only if `roster.state !== 'none'`; if all suppress, render `<p class="statusNote">Event complete — thank you for participating.</p>` in `--white-40`. Eliminates the "permanent open-problem checklist" (J5-052).

**Desktop checklist reflow (≥768px):** `display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 1.5rem` (drop `margin-left:auto`, restore in 1-col via media query). Result action row inline (row) at ≥560px. Apply the grid only after the per-phase checklist row counts are final (game-day=3 rows, result=none).

**Standalone seam rule:** `variant="standalone"` does NOT get the phase hero — it gets the wash-header (Section iv) above the 5-col `.hqStrip`. The hero concept is tournament-only. The strip's Tournaments cell empty state: `latestHistoryLabel = "No tournaments yet"` in `--white-40`.

---

## Section ii — Button & Chip Hierarchy

**Rule CP-1 — Coach button hierarchy** *(hard constraint inside the portal shell):*
```
TIER 1 — btn-lime   : the ONE most-important action per surface (Claim team · Create account · Save roster · Submit)
TIER 2 — btn-ghost  : secondary/destructive, "View all", cancel
        — btn-ghost btn-sm : low-prominence secondary links (section-header "View all") ONLY
BANNED — btn-outline (all coach-portal uses) · btn-primary (gradient) · btn-sm as primary CTA · circle buttons · gradient on functional elements
```
The most journey-critical button is the LOUDEST (btn-lime), never the quietest. **Publish this rule to `CLAUDE.md`/`AGENTS.md` before new coach surfaces are built** (or builders default to `btn-outline`).

> **Section Add buttons vs empty-state CTAs (reconciled):** a section-header ghost-pill Add button (zero-data shortcut, `btn btn-ghost; font-size:0.82rem; padding:0.3rem 0.75rem; --radius-sm`, hidden when N>0) is TIER-2; an empty-state primary CTA (Section iii) is TIER-1 `btn-lime`. Both rules hold — they are different buttons.

**Rule CP-2 — Coach lifecycle chip system** *(distinct from `.badge`, which is `999px`):* `border-radius: var(--radius-sm)` (6px), `--font-data`, 0.62rem, 700, 0.1em, uppercase.

| State | Label | Colour | When |
|---|---|---|---|
| LIVE | `● LIVE` | `--logic-lime` fill + `#0f1123` text, pulse-dot | tournament dates straddle today |
| GAME DAY | `● GAME DAY` | `--logic-lime` 0.85 opacity | start_date = today |
| UPCOMING | `In N days` | `rgba(var(--info-rgb),0.1)` bg + `rgba(var(--info-rgb),0.45)` border + `--info` | 1–14 days |
| FUTURE | `[Month Year]` | `--white-40`, no container | > 14 days |
| COMPLETE | `Complete` | `--white-30` + `--border-2` border | end_date < today |

Registration-status badges demote to trailing meta when a lifecycle chip is present; hidden on LIVE rows.

**Rule CP-3 — Rail/tab active accent:** desktop `railLinkActive::before` AND mobile `.bottomTabActive` use `var(--logic-lime)` — **not `var(--primary)`, not `var(--primary-light)`** (both org-overrideable; mobile currently shows lime accidentally via the `--primary-light` fallback — hardcode lime).

**Rule CP-4 — Hub upsell demotion:** when a coach has real content, the pitch (if shown) is a **compact inline ruled banner** (`border-top: 1px solid var(--border-2)`; no card surface / min-height / box-shadow), never a `styles.card` at the same tier as team/claim cards. "Express interest" in the banner → `btn-ghost btn-sm`. Hub empty-state primary CTA → `btn-lime`.

---

## Section iii — Empty-State Component (`CoachEmptyState`)

Canonical pattern (borrowed from the public `PublicTournamentState`, org-less so the hue is `--logic-lime`):

```css
/* Container (standard) */
background: radial-gradient(110% 80% at 50% 0%, rgba(217,249,157,0.07), transparent 55%), var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius);
box-shadow: var(--highlight-top);
padding: 2rem 1.5rem;          /* compact: 1.25rem */
text-align: center;            /* mobile ≤640px: flex-start / left */
display: flex; flex-direction: column; align-items: center; gap: 0.85rem;
max-width: 560px;

/* Medallion */
width: 52px; height: 52px;     /* compact: 40px */
border-radius: var(--radius);  /* 12px — NOT 50%; circles banned in the coach portal */
color: var(--logic-lime);
background: rgba(217,249,157,0.10);
border: 1px solid rgba(217,249,157,0.25);
box-shadow: 0 0 24px rgba(217,249,157,0.15);
display: grid; place-items: center;
```
- Eyebrow `--font-data` 0.7rem 700 0.12em uppercase `--white-40`; headline 1.1rem 800 `--white`; description 0.88rem `--white-60` max-42ch.
- **Primary CTA is always `btn btn-lime`** — never `.inlineLink`, blueprint-blue `.btnPrimary`, `btn-primary`, `btn-sm`-as-primary, or a bare hex anchor. Secondary → `btn-ghost`.
- **Tournament-mode glow option:** swap the container/medallion lime tints to `color-mix(in srgb, var(--team-color, var(--logic-lime)) 8%/12%/30%/20%, transparent)` for the radial/medallion — **the medallion icon stays `--logic-lime` always.** (Never `rgba(var(--team-color-rgb),…)` — that token doesn't exist.)

**Full-card vs text-note decision rule:**
- **Full `CoachEmptyState`** — when the section IS the content and the coach CAN act: new-team first-run banner, roster/schedule/fee empties, premium BvA, premium schedule.
- **Compact `CoachEmptyState`** — when it's one of several recoverable empties: editor section empties, tournament pending/no-schedule.
- **Text-only `<p>` note** — when the coach CANNOT act from this surface: organizer announcements, team-wide-charges sub-block, announcement-log "No history", `CoachLiveSchedule` static-mode banner (`rgba(var(--info-rgb),0.07)` bg + `rgba(var(--info-rgb),0.18)` border — `--info-rgb` is real at `globals.css:68`, never hardcoded `rgba(59,130,246,…)`).

Empty-state cards always carry the **lime** glow (not the team-hue wash). The team-hue wash is the hero header only; content cards inside sections are lime-glow. No conflict with Section iv.

---

## Section iv — Team-Colour-Wash Rule

The public team-profile hero is the bar (18% team-hue wash + 9rem watermark + record strip). Both coach shells adopt it; the strip/cards stay flat for operational density.

**Standalone hero (NEW — replaces the plain `shared.header` H1):** `.standaloneHero` wrapper = `color-mix(in srgb, var(--team-color, var(--logic-lime)) 18%, var(--surface) 82%)` bg + `color-mix(… 30%, transparent)` border + `--radius` + `position:relative; overflow:hidden; box-shadow:var(--highlight-top); padding:1.5rem`. Watermark 7rem/900/0.07 (mobile 5rem). Monogram 52px desktop / 44px mobile, `--radius-sm`, `--font-display`. The `.hqStrip` stays BELOW it, `--surface`, no wash.

**Tournament hero (UPGRADE):** wash 9%→18% for celebration phases; border plain→30% team-hue mix; add the watermark; monogram 44px→52px. Non-celebration phases keep their phase-semantic washes (Section i).

**Wash-intensity tiers:**

| Tier | Surface | bg wash | border mix | watermark | monogram |
|---|---|---|---|---|---|
| Hero | standalone header · tournament celebration phases | 18% | 30% | 0.07 | 52px |
| Phase-override | pending/rejected/game-day/result | phase-semantic % | phase-semantic | 0.07 | 52px |
| Strip/Card | hqStrip tiles · editor cards | 0% (`--surface`) | `--border` | none | 36px (strip) |

- **`--team-color` scope:** inline via `style={{ '--team-color': teamColor(teamName) }}` on the outermost wrapper; always `var(--team-color, var(--logic-lime))` with fallback. Scoped to wash / watermark / monogram fill **only**.
- **`--team-accent` is excluded from the coach portal** (unlike the public bar) — `--logic-lime` is the permanent accent for every interactive element.
- Monogram: always `--radius-sm` rounded-square (never circle); `teamInitials`/`teamColor` from `lib/team-color.ts`; `--font-display` at ≥52px, `--font-data` at ≤44px.
- Border uses **30% not the public bar's 40%** — deliberately lower for the dense operational context vs the public showcase. Light mode: wash 18%→12%, border 30%→25%.

The monogram is the seam bridge: same source, same rounded-square, same font rules across both variants → "one product, one shell."

---

## Section v — Density / Responsive Rules

**Rule D-1 — Stat-strip legibility floor (mobile ≤700px):** `.hqLabel` ≥0.7rem; `.hqItem strong` ≥1.25rem; add `overflow-wrap: anywhere` to `.hqItem p`. Hard floors — no coach component drops below. Desktop 5-col tiles keep current sizes.

**Rule D-2 — Coach page desktop 2-col reflow (≥961px):** any coach page with 3+ editor sections → `display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 1.5rem; align-items: start`; max-width 1200px (from 960px). Pair by data affinity (Roster/Schedule left, Fees/Announcements right). Full-width sections (Tournament history, ScopeCeilingInterest) stay outside the grid. 700–960px = single column.

**Rule D-3 — Checklist state colour coding:** `.checkState` values use status tokens — Done→`--success`, Needs-action→`--warning`, Overdue→`--danger` + `badge-danger`, Not-started→`--white-60`. **Never `--white-40` for a value the coach must read and act on.** Desktop ≥720px: 2-col grid.

**Rule D-4 — Dense claim/list row (50+ items):** `min-height:48px; padding:0.55rem 0.85rem; display:flex; align-items:center; gap:0.75rem`. Monogram 32×32 `--radius-sm`. Row separator `border-bottom: 1px var(--border-2)`. Group with collapsible headers; "Show all" after 3 rows in `--logic-lime`/0.8rem. Claim button in a dense row: `btn-lime` at 0.82rem/`padding:0.35rem 0.8rem`.

**Rule D-5 — Table containment in modals/slide-overs** *(shared with the org-attached Premium portal):* any table wider than the modal max-width → `overflow-x:auto; -webkit-overflow-scrolling:touch` (modal adds `overflow-x:hidden`). Slide-overs use a tab strip (Details/Attendance/Lineup), active tab `--logic-lime` border-bottom (not blueprint-blue). ≤600px: bottom-sheet (`max-width:100%; border-radius:0 0 var(--radius-lg) var(--radius-lg)`).

---

## Cross-Shell Seam Rules

- **CP-5 — Shell accent token:** `--logic-lime` is the permanent coach-portal accent; `--primary`/`--primary-light` never appear in coach accent positions.
- **CP-6 — Breadcrumb context badge:** every coach detail page gets a one-word badge — `badge-neutral` "Team home" (standalone), `badge-info` "Tournament" (tournament detail). The tournament breadcrumb links to `/coaches/tournaments` (reads "Tournament Records"), not `/coaches`.
- **CP-7 — Page h1 discipline:** no inner h1 repeats "Coaches Portal" (the shell brandText owns it). Tournament list → "Tournament Records"; detail pages → team name.
- **CP-8 — Mobile account surface:** mobile topbar gets a 30×30 lime account chip (`rgba(var(--logic-lime-rgb),0.15)` bg + `rgba(var(--logic-lime-rgb),0.35)` border + `--logic-lime` + `--radius-sm` + `--font-data`) → bottom-sheet (`var(--surface)`, `--radius-lg --radius-lg 0 0`, z-200) with email, All workspaces, Send feedback, Sign out.
- **CP-9 — Nav "My Teams" rename + match fn:** "Teams" → "My Teams"; match covers `p.startsWith(COACHES_TEAMS_PATH) || p === COACHES_TEAM_PATH || p.startsWith(COACHES_TEAM_PATH + '/')` so standalone team homes activate the tab.
- **CP-10 — Hub persona-conditional pitch:** standalone-only → "Take your team further" banner; tournament-only → "Start free team home" btn-lime; both/workspace → no pitch; empty → empty-state with btn-lime.

---

## Owner decisions — RESOLVED 2026-06-14 (these rules are final)

1. **TeamHQ variants — DISTINCT.** Standalone = team-colour identity band + 5-col stat strip (Section iv); the phase hero (Section i) is tournament-only. Unified by the shared monogram + colour, not a shared shell.
2. **Hero wash intensity — 18%** (matches the public team page) for celebration phases; phase-semantic washes for the rest (Section i). Light mode 18%→12%.
3. **`/coaches/join` submitBtn — migrate to `btn btn-lime`** (drop the borrowed square-cornered `auth.module.css` `.submitBtn`).
4. **Monogram font — `--font-display`** at ≥52px (`--font-data` at ≤44px).

The Sections above already reflect these rulings.
