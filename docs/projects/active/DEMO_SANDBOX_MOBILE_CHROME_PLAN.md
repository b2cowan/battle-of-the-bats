# Demo Sandbox — the mobile hat

**Status:** BUILT on `dev`, uncommitted. Owner QA pending (ledger entry to be added).
**Date:** 2026-08-07
**Trigger:** owner, on the tournament demo on a phone — *"these many top navs really cram the page"*,
plus a request for a symmetrical banner.
**Mockups (binding spec):** `claude.ai/code/artifact/5914f2c2-ba15-47be-9aa8-25524740df7f`

---

## The measurement that set the scope

Measured on a **390 × 844** viewport against the running dev server, computed geometry (not
screenshots — screenshots have misled on this codebase before):

| Surface | Band | Before | At rest | Scrolled |
|---|---|---:|---:|---:|
| Tournament (`/riverdale-minor-ball/summer-classic`) | banner | 68.27 | 52.56 | 52.56 |
| | moments dock | 38.02 | 38.02 | 0 |
| | guided tour (incl. live pill 25.92) | 76.92 | 44 | 0 |
| | **hat total** | **183.20** | **134.58** | **52.56** |
| Coach (`/see-it-live/coaches`) | **hat total** | **154.78** | **139.08** | **53.06** |

On the tournament fan page the hat was one of **three** stacked fixed bars: hat 183 + event header
134 + score ticker 40 = **357px of an 844px screen, 42%, fixed chrome** before a word of product.

---

## The rule

> **One band is the claim, and it never moves. Everything else is guidance, and guidance yields to
> the product.**

This is what makes the change compatible with the component's standing invariant — *"NEVER
dismissible: the honesty claim has to stay visible for as long as the visitor is inside the
sandbox"*. That invariant protects the **banner**. The moments dock and the guided tour are
navigation and guidance, and nothing promises they are permanent.

---

## What was built

### A · The banner squares up (≤640px)

Identity over status on the left, the signup door pinned right.

- CSS **grid areas**, no DOM restructure of the identity/status elements: `eyebrow` / `status` /
  `actions`. The tournament coat puts its replay countdown in `status`; the coach coat puts its
  honesty claim there. Both are assigned to the same cell and exactly one is ever displayed, so the
  two coats need no separate markup.
- New `.bannerActions` wrapper — on desktop it is a flex child at the end of the row holding exactly
  what already sat there, so desktop is byte-identical in effect.
- **The status line truncates, it never wraps.** A second line hands back every pixel the two-column
  shape buys, and at a finished moment the countdown is replaced by a longer note.

### B · The guidance layer folds on scroll (≤640px)

- New `.guide` / `.guideInner` wrapper around the dock, the stepper and the narration strip.
- Collapse animated with **`grid-template-rows: 1fr → 0fr`** — animates a height nobody measured.
  A `max-height` guess eases wrongly; a JS-measured pixel height is a second copy of the layout that
  can go stale. `.guideInner` must carry `overflow: hidden` **and** `min-height: 0`.
- New shared hook **`lib/use-scroll-collapsed.ts`** — 64/12 hysteresis, matching the shipped values
  in `AdminEventHeader` and `CoachTeamHeader`.
- ⚠ **The hook reads the scroll EVENT's target, not an ancestor walk.** `AdminEventHeader` walks its
  own ancestors for a scroll parent, which works because it sits inside the shell it measures. This
  chrome is `position: fixed` parented to `<body>`; the admin shell's inner scroller is a **sibling
  subtree it can never walk up into**. A capture-phase window listener plus a size test on the
  target (≥60% of viewport height) catches both the document and an app-shell scroller, and stops a
  strip or dialog body speaking for the page.
- `inert` on the folded layer. Zero height + `overflow: hidden` leaves 10–13 controls in the tab
  order; verified 0 reachable when folded.
- The handle's `scrollToTop` comes from the hook rather than local state: the fold is a pure function
  of scroll position, so a second source of truth is one the next scroll event contradicts.

### ⚠ B-safety · The handle back

Rendered **only while folded**, in the banner's right slot beside the CTA. Carries the tour's
position (`2/6`) when there is one to name, `Tour` otherwise — `6/6` reads as a score and `0/6` as a
scolding. Tap area padded to the 44px floor via `::after` rather than a 44px box, which would put the
banner's height straight back.

**This is not polish.** The 2026-08-06 review found the dock hiding itself during a tour step with
nothing on screen able to bring it back for the rest of the session — a visitor lost the demo's whole
navigation the moment they accepted its invitation. Any fold ships with its handle, same unit of work.

### C · The live pill stands down where the ticker already speaks

- `ScoreTicker` now publishes **`data-ticker="scores"`** on `<html>` while expanded (same idiom as
  the chrome's own `data-sandbox-chrome`). Minimized it is a button with no score in it, so the
  attribute is removed and the pill returns.
- The pill carries `data-beat`, and **only the `live` reading stands down.** The seam state
  (*"Between games — final in 4:12"*) is something the ticker cannot say, so it stays.
- Every surface without a ticker — the whole operator side — is untouched, because the attribute is
  simply absent there.

Grounded in the rail rule (2026-08-02): *the test for chrome content is data the page does not
already show.* Two live indicators for one game also quietly argue against the demo's own claim that
this IS the product.

### D · Copy — the coach claim gets a short form

**Found during verification, not planned.** The two-column banner leaves the status line ~165px on a
390px screen; the coach claim *"Changes show on screen, but nothing is saved."* needs ~230px, so it
ellipsised — the one line in this chrome that must never be optional was ending mid-word.

New `emphasisShort` on `SandboxBannerCopy`, coach = **"Nothing is saved."** The full sentence stays
everywhere else. Guarded in CSS by `.claimFull:has(+ .claimShort)`, so a coat that supplies no short
form can never end up showing no claim at all.

**Owner-visible copy change — flagged for ratification.**

---

## Not built

**Option D (tour docked to the thumb zone).** Presented, not recommended, owner did not select it.
The bottom edge is contested — the public tournament shell has a 72px bottom nav, the coach portal
has its own, and the game-day team dock lands there too. One chrome with two behaviours is the drift
the single-component design exists to prevent.

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` (3 touched files) | clean |
| `check:tokens` | clean — 0 grandfathered literals in every scope |
| `check:demos` | ✓ 2 presentable |
| `npm test` | 1439/1439 pass |
| `check:layout` | **not applicable — see below** |
| Browser probe, 390×844, **real wheel input** | see below |

⚠ **`check:layout` cannot cover this change, and saying it passed would be false comfort.** The sweep
renders `uat-test-org`, which is not a demo org, so `SandboxChrome` is never mounted on any screen it
visits — zero references to either demo slug in the script. (Two runs were attempted anyway; the
first died mid-sweep with `ERR_NETWORK_IO_SUSPENDED`, which the script's own diagnostic attributes to
the dev server exhausting its heap on a full sweep, and the second was stopped because two concurrent
sweeps against one dev server thrash each other. Neither outcome says anything about this change.)
The purpose-built probe below is the stronger evidence for this surface, since it renders the actual
demo orgs at the actual width.

Probe results (both demos, real `mouse.wheel`, not scripted `scrollTop` — the 2026-08-01 structural
finding is that scripted scrollTop on the wrong element passes and lies):

- Tournament hat 183.20 → 134.58 at rest → **52.56 folded**; published `--sandbox-chrome-h` tracks
  (135px / 53px), so the event header and ticker ride up with it.
- Coach hat 154.78 → 139.08 → **53.06**.
- Handle appears folded only; `1/6▾` tournament, `Tour▾` coach (untouched tour). Press returns the
  layer; scroll-up returns it too.
- Tab stops inside the fold: 10 (tournament) / 13 (coach) → **0 reachable** when folded.
- Ticker minimized → `data-ticker` cleared → **pill returns**, hat 167.5.
- Coach status line no longer overflows.
- Handle hit area **60 × 45** (control renders 50 × 25), clears the 44px floor; 7px gap to the CTA
  with the hit box reaching 5px, and `elementFromPoint` at the CTA's centre still returns the CTA —
  i.e. the expanded tap area does not swallow the signup door beside it.
- **Desktop 1440 unchanged before and after scroll** (142.95px both).

---

## Follow-ups

1. **Fold `AdminEventHeader` and `CoachTeamHeader` onto `useScrollCollapsed`.** Both carry the
   reading half inline. Deliberately not ridden along with a demo-chrome change — they are shipped
   surfaces and collapse in place rather than standing down.
2. **Ratify the coach short claim** (section D).
3. **Ledger entry** in `OWNER_QA_LEDGER.md` once QA is scheduled.
