# My Team Card — Unify the Followed-Team Card (Implementation Plan)

**Status:** Planned — design decision logged 2026-07-03 (`memory/design_decisions.md`)
**Branch:** dev · **Migration:** none · **Related:** `STANDINGS_REMODEL_PLAN.md` (same page; the eventual home for a full shared-card hoist)

## Goal
Collapse three drifted followed-team treatments into **one shared presentational `MyTeamCard`**:
- Standings: `components/public/MyTeamStandingsStrip.tsx` (+ `.module.css`) — retire.
- Schedule mobile: the inline `.scorebugBar` block in `components/public/ScheduleContent.tsx`.
- Schedule desktop: the inline `.railCard` twin in `components/public/ScheduleContent.tsx`.

Out of scope (stay separate): `MyTournamentCard` (home page) and `MyTeamDock` (game-day dock).

## Design contract (locked; see decision log 2026-07-03)
Scorebug twin. Token-only, no new tokens, no literal hex.

**Structure (three zones):**
1. Avatar — `teamAvatarHue`/`teamInitials`, 40px / 4px radius.
2. Body (`--font-data`, `min-width:0`): name 900-wt full-strength `-webkit-line-clamp:2`; meta line `record · rank · rankScopeLabel` at `--white-55` (single-line ellipsis); `vs opponent` at `--white-40` (single-line ellipsis).
3. Right rail (`flex-shrink:0`), one of three labelled states:
   - **LIVE** — `--danger` badge + pulsing dot + `RollingNumber` score.
   - **NEXT UP** — micro-label + date + `--primary-light` time.
   - **FINAL** — micro-label (`--white-45`) + last score.

**Container:** `rgba(var(--primary-rgb),0.07)` bg + `0.3` border, `--radius-sm`, `min-height ~60px`, **no `flex-wrap`** (fixed three-zone flex).

**Inherited patterns (binding, 2026-06-25):** identity area links to the team page (`ChevronRight` affordance, name-underline on hover, `aria-label="{team} — view team page"`); any unfollow control is the **filled star, danger-on-hover, separated sibling — never a bare ✕**; who/when only (no venue).

**Parameterized per surface (props, not forks):**
- `rank` + `rankScopeLabel` — Schedule = pool name; Standings = division name.
- `actions` slot (ReactNode) — Schedule passes My Games / Calendar / Score alerts; Standings passes the **"View my division"** jump. Rendered in a quick-action row below the card.
- Unfollow star — shown on Schedule; **omitted on Standings** (unfollow already lives on Schedule + dock).
- `layout` — `strip` (mobile) vs `rail` (desktop): two responsive layouts of the one component.

**Standings switches off `--logic-lime` → org `--primary`** (visible, intended colour change).

## Proposed props (draft)
```
MyTeamCard({
  team, avatar, teamHref,
  record: {w,l,t} | null,
  rank: number | null, rankScopeLabel: string | null,
  opponent: string | null,
  state: 'live' | 'next' | 'final' | 'none',
  live?: { myScore, oppScore },      // RollingNumber rendered inside
  final?: { myScore, oppScore },
  next?: { dateLabel, timeLabel },
  onUnfollow?: () => void,           // omit on Standings
  layout: 'strip' | 'rail',
  actions?: ReactNode,
})
```
Data (opponent, record, live/next/final selection) is computed by each **parent** and passed in — the card stays presentational. Live realtime + `RollingNumber` state remain in the parents.

## Phases
**P1 — Extract the component.** Create `MyTeamCard.tsx` (+ CSS module, or promote the shared `scorebug*` classes into it). Reproduce the scorebug mobile strip and desktop rail exactly.

**P2 — Re-wire Schedule (verify no visual change).** Replace the inline `.scorebugBar` and `.railCard` JSX in `ScheduleContent.tsx` with `MyTeamCard`, passing the existing computed data + the quick-action row via `actions`. Keep live polling / `RollingNumber` / follow-picker wiring in `ScheduleContent`. **Acceptance: Schedule mobile + desktop pixel-identical and still live-updating.**

**P3 — Adopt on Standings.** In `StandingsContent.tsx`, compute + thread the two missing inputs (opponent name for live/next game; W-L-T record — standings already computes standings so the record is available), render `MyTeamCard` with `rankScopeLabel = division.name`, `layout` responsive, `actions = <View my division>`, no unfollow star. Retire `MyTeamStandingsStrip.tsx` + `.module.css`.

**P4 — a11y / theme verification.**
- Confirm low-opacity micro-labels (`NEXT UP` / `FINAL` near `--white-45`) hit AA on the **light** public surface; bump to `--white-55` if faint. Same check on the meta line.
- Confirm the Standings card renders inside the same public-theme token scope so `--white`/`--white-55` resolve identically to Schedule (reason about token parity, not literal colour).
- Touch targets ≥34px; avatar `aria-hidden`.

## Verification
- `npm run verify:changed` (typecheck + lint focused + org-context + dictionary — no schema change expected).
- Browser: Standings + Schedule (mobile + desktop) for a followed team across LIVE / NEXT / FINAL / none states; live update still fires on Schedule.
- Dev-server **restart** before browser test (new shared component file + shared-module edits).
- `/review` (adversarial) after build — shared public component touching a live page.
- `/docs` — user-facing fan flow: check no in-app help references the old Standings card treatment.

## Follow-up (not this project)
Full hoist of Schedule mobile + desktop + Standings (and possibly the home card) into a single canonical `MyTeamCard` owned by the **Standings Remodel** — this project keeps them token-locked so that later merge is near-zero visual delta.
