# Public Tournament Pages — Mobile Polish (Design-Review Remediation)

**Status:** Implemented 2026-06-01; awaiting browser verification.
**Source:** Deep design evaluation of the public tournament pages (`/{orgSlug}/{tournamentSlug}/*`), targeting the game-day coach/parent audience on mobile.
**Binding decisions:** see `memory/design_decisions.md` → "2026-06-01 — Public tournament pages: mobile remediation direction".

## Scope

Four owner-approved slices addressing the two Critical and the top Major findings from the review. Visual/data-presentation only — no routing or nav-architecture changes.

## Slice 1 — Criticals + cheap wins

- **C1 Standings mobile table** — keep the `<table>` (cards rejected: too tall on mobile). Added `≤640px` breakpoint in `standings.module.css`: reduced cell padding/font; **Team frozen left** (existing `.stickyCol`), **PTS frozen right** (new `.ptsCol`, sticky `right:0` with left shadow). `StandingsContent.tsx` adds `styles.ptsCol` to the PTS `<th>`/`<td>`.
- **C2 Empty-state contrast** — `app/globals.css` `.empty-state p` now `color: var(--white-60)` (was inheriting `--white-30`). Lifts every pre-event "not published yet / no teams yet" message to AA.
- **M5 Stat label** — `TournamentHomeContent.tsx` third hero stat relabeled `Divisions` → `Age Range` (was a duplicate of the first).
- **M2 Nav dead-zone (769–900px)** — `BottomNav.module.css` breakpoint `768px → 900px` (matches where Navbar hides top-nav links); `globals.css` bottom-nav content padding moved into a `≤900px` block.

## Slice 2 — Schedule auto-jump to today

`ScheduleContent.tsx`: today date-groups get `id="schedule-today"`; a one-shot effect (`requestAnimationFrame` + `didAutoScrollRef`) calls `scrollIntoView` on first load when not previewing. `schedule.module.css` `.todayGroup` gets `scroll-margin-top: calc(var(--nav-height) + 1rem)` for the fixed-nav offset.

## Slice 3 — State-dependent home hero

`TournamentHomeContent.tsx`: `isInProgress` = today within `startDate..endDate`. The hero gets `styles.heroCompact` when live; the "Next On The Schedule" block is extracted to a `scheduleBlock` const and rendered **before** announcements when live, after otherwise. `Home.module.css` `.heroCompact` drops `min-height: 100vh` and (≤768px) shrinks the title, trims padding, hides the scroll cue.

## Slice 4 — Contrast floor on custom accents

`lib/themes.ts`: new `mixWithWhite` + `ensureLightTint` (lifts a colour toward white until relative luminance ≥ 0.30, ~6:1 on `--bg`). `resolveTheme` now runs custom primary/accent through `ensureLightTint` for `--primary-light` (fixes the old `primaryLight = customPrimary` dark-on-dark bug). `layout.tsx` light-mode vars add `--primary-light: var(--primary)` so accent text uses the dark primary on white. **Presets are untouched** (hand-tuned); only custom hex values are guarded.

## Verification

- `tsc --noEmit` clean.
- **Restart required before browser test** (Slice 4 touches shared `lib/themes.ts` + `layout.tsx`): stop dev server → `rm -rf .next` → `npm run dev`.
- Browser checks (owner): standings at 390px (Team + PTS pinned, middle scrolls); empty states legible; schedule jumps to today; home at 390px before vs. during event; a deliberately dark custom org primary still renders readable accent text in dark **and** light mode (verify Milton preset unaffected).

## Deferred (not in this pass)

P1 tie-breaker font size, P2 game-time `--font-data`, P3 literal `x` clear glyph, P4 register hardcoded alert hex, P5 card-radius consistency, M4 teams coach contrast / Profile tap target, M6 standings/teams loading skeletons. Tracked as polish for a follow-up.
