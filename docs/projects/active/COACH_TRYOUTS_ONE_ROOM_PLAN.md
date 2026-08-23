# Coach Tryouts — One Room (tabs, faces, and a real desktop)

**Status:** BUILT on dev 2026-08-23 · QA §81 PASSED same day (owner-directed) · /review pass
fixed 5 behavioural defects post-QA (face memory, refresh races ×2, quiet-error kick-out,
stray-URL mounts) · no migration · uncommitted
**Mockups (the spec):** https://claude.ai/code/artifact/f3cefd79-fe56-40e8-85cf-5c9ec14553c4
**PM brief:** `COACH_TRYOUTS_ONE_ROOM_PM_BRIEF.md`

## The three findings (owner review 2026-08-23)

1. The tryouts hub already has money-style stage tabs (Set up / Tryout day / Decide / Build team)
   — but the two tryout-day tools, Check-in and Score, live OUTSIDE them as separate full-screen
   pages reached through buttons, each with a "Back to Tryouts" link, and the scorer has a second
   back level inside it (list → player → "All players").
2. Neither field tool has a desktop layout: the phone column stretches edge to edge and a 1–5
   button becomes a ~300px slab (owner screenshot).
3. The "Run your tryout" card under the title carries zero information collapsed — a full-width
   card whose only job is holding the "How tryouts work" toggle, one line under the help "?" that
   opens the same subject.

## The build

### 1. Hub addresses (page.tsx)
- Stages become URL-backed: `?stage=setup|tryout-day|decide|build`. No param → existing
  auto-select-from-phase behaviour (state only; URL not rewritten). An explicit `?stage` in the
  URL counts as a coach choice (retires auto-select, same rule as today's first-click).
- Tryout day gets faces: `?view=board|check-in|score`. `view` is tryout-day-scoped: every other
  stage's tab href drops it (the Money hub's one-shot-keys lesson). No `view` → smart default:
  `check-in` until the first check-in exists (checkedInCount === 0 and scoredCount === 0),
  then `board`; one-shot, never yanks a face the coach picked.
- Stage tabs and face buttons are **Links** (shareable, middle-clickable, Back-safe — the
  CoachTabBar rule), styled as today's underline tabs + a new segmented face row.
- The two navigate-away buttons on the Tryout day intro are deleted, along with that PanelIntro.
- Faces mount on first visit, then stay mounted `display:none` (Money hub pattern) so a face flip
  never loses scorer selection or refetches check-in.

### 2. TryoutFlowHeader
- The `.wrap` card ("Run your tryout" + toggle) is DELETED. "How tryouts work" becomes a quiet
  button at the right end of the stage-tab row; the guide panel (4 steps + Do-this-next) drops
  below the tab bar, content unchanged.
- Auto-open once: when the overview first arrives with `sessionCount === 0 && !hasScorecard`
  (a team that has never touched tryouts) the guide starts open. Any user toggle wins. No stored
  preference — resting state is the link.
- Tabs render as `<Link>`s via an `hrefFor(tab)` prop; `onTabChange` survives for the guide's
  "Take me there" and the prereq prompts (they push the same hrefs).

### 3. TryoutCheckIn — `embedded` prop + desktop
- `embedded`: hides the back link (the hub owns navigation now).
- ≥1100px (embedded): wrap cap ~920px, candidate list becomes a 2-column grid. Phone untouched.

### 4. TryoutScorerSurface — `embedded` prop + desktop two-pane (BOTH doors)
- ≥1024px: master–detail grid — list pane (~280px, rows keep bib/✓/dim-absent) beside the
  score pane (cap ~560px; each category ONE ruled row — label left, fixed-width buttons right —
  so five categories fit one screen; 1–10 keeps the standing 5+5). Detail header shows
  "N of M categories". **No footer** (owner rulings 2026-08-23, post-build walk): "Back to
  list" cut — meaningless beside a list that never leaves — and "Next player" cut with it: a
  tryout runs as stations, not a queue, so list-pick is the whole navigation. (The build
  briefly shipped both buttons; the mockup frames showing them are superseded on this point.)
- Narrow (<1024px): byte-for-byte today's flow — list ⇄ full-screen player, sticky Done,
  5-column scale floor arithmetic untouched.
- `embedded`: no own header/back link (the hub's face row carries identity + blind), locked
  banner still renders, container becomes a contained card instead of a 100dvh page.
- Public token door keeps its full header; wide viewports get the same two-pane below it.
- Focus-refresh: gains a QUIET reload (no loading blank) and the guard relaxes from
  "only when no player selected" to "only when no save in flight" — on desktop a player is
  selected all session and late walk-ups never appeared. Optimistic saves make it safe.
- Fixed-dark posture unchanged (token-exempt annotations on any new pinned colors —
  `check-public-tokens` allowlists this module).

### 5. Old routes → redirects
- `tryouts/check-in/page.tsx` → server `redirect('…/tryouts?stage=tryout-day&view=check-in')`
- `tryouts/score/page.tsx`   → server `redirect('…/tryouts?stage=tryout-day&view=score')`
- The ungranted-assistant UAT expectation survives: the hub shows the same honest empty state.

### 6. Blast radius (found by sweep, all in this unit of work)
- **Demo chrome** (`lib/sandbox-chrome.ts`): the tryout-day dock moment path becomes the
  `?stage=tryout-day&view=score` address (the matcher is already query-aware — the Money
  `?section=` precedent). Tour step 1 becomes `/tryouts?stage=decide`: names the panel its
  sentence/anchor (`tryout-decisions`, on the decision board) actually describe, AND keeps the
  exact-match rule honest — a bare `/tryouts` exact match would false-positive on a dock arrival
  at `/tryouts?view=score` now that both share a pathname.
- `lib/marketing-shots.ts` tryout-day shot path → same new address.
- **Help content** (`lib/help-content/coaches.tsx`): three copy spots name the old doors
  ("tap Score players", "Open day-of check-in") → reworded to the faces.
- **UAT** `tests/uat/scenarios/coach-tryouts-smoke.spec.ts`: drives the face toggle instead of
  the door links; `getByRole('tab')` → links; check test 2's redirect landing.
  `tryout-blindfold-boundary.spec.ts` checked for the same.
- Blind-surface guard (`tryout-report.test.ts` C5) — unaffected: no memory/report imports added
  to blind surfaces.
- `check:layout` renders only the hub (`coach-tryouts`) — no sub-page entries to retire.

## Rules honoured
- Tabs are links; addresses shareable; legacy addresses redirect rather than 404.
- "Five columns always" (owner 2026-08-17) governs both widths; desktop caps the grid instead
  of restyling it.
- Guide-don't-gate: tabs never disabled; prereq prompts unchanged.
- No new year parameter anywhere — `stage`/`view` address the working season's screens only.
