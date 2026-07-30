# Click-away / Escape sweep — retire the remaining hand-rolled dismiss copies

**Status:** ✅ **BUILT ON DEV 2026-07-30 (uncommitted)** — 15 of 17 converted; the 2 remaining are
deliberate and named below. Gate green: typecheck 0, focused lint 0 errors (83 warnings, all
pre-existing in the touched files), 482 tests, all token/date ratchets zero, schema parity 0.
Remaining: owner QA → commit. · owner-approved 2026-07-30 · branch `dev`
**Origin:** spun out of the Admin Dropdown Consolidation by `/simplify`'s reuse lens
(see `COACH_ONBOARDING_QUIET_MODE_PLAN.md` §C0 remainder). Predecessor commits: `e5b8dc89`
(relocation) + `4b08fc8a` (three admin panels).

---

## Why this exists

`lib/overlay-hooks.ts` now owns the open/dismiss contract for transient overlays. Five consumers use
it. **Seventeen more implementations of the same behaviour are still hand-rolled**, and they have
drifted — which is the whole argument for the hook.

The drift is not cosmetic. **Seven of the seventeen have no Escape handler at all**: they close on
outside-click only, so a keyboard user who opens one has no keyboard way to close it. That is the
customer-facing defect hiding inside what looks like a tidy-up job.

## ⚠ THE INVENTORY WAS WRONG TWICE — and the second miss is load-bearing

`/simplify`'s reuse lens (2026-07-30) found the live scan below was **also** incomplete. It grepped
`addEventListener('mousedown'`, which structurally cannot find copies built on `pointerdown`. There
are four of those:

| File | Has Escape? |
|---|---|
| `components/help/HelpTooltip.tsx` | no |
| `components/public/ShareScoreButton.tsx` | yes |
| `app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx` | yes |
| `app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx` | yes (two refs, one dismiss — the exact array shape this sweep added) |

**True total: 21 implementations across 17 files.**

### Why they use `pointerdown`, and why that is a finding rather than a footnote

`HelpTooltip.tsx:35-37` says it outright, and it was read directly rather than taken on trust:

> `pointerdown` fires for both mouse and touch, so a tap outside on a touch device reliably closes the
> popover — **`mousedown` did not fire for taps on iOS Safari, which is what left it stuck/unusable.**

This matches known iOS Safari behaviour: mouse events are only synthesised for elements Safari treats
as clickable, so a tap on inert page background dispatches no `mousedown` at all.

`useDismissable` listens for **`mousedown`**. Therefore **every panel this sweep converted may fail to
dismiss when an iOS user taps blank space** — including both mobile-nav More menus, on a product whose
coach portal is phone-first.

**This is NOT a regression introduced here.** All 15 converted copies already used `mousedown`; their
behaviour was preserved exactly, as the plan required. It is a pre-existing platform-wide gap that
consolidation has now made fixable in one line instead of twenty — four separate authors hit it and
fixed it locally, and nobody could fix it centrally until now.

### Consequences, decided

1. **The four `pointerdown` consumers are NOT converted.** Routing them onto the hook as it stands
   would drag them back to `mousedown` and reintroduce a bug their authors deliberately fixed — on
   coach lineup tools, help tooltips, and the public share button, all mobile-heavy. Converting them
   requires fixing the hook first, not the other way round.
2. **Switching the hook to `pointerdown` is an OWNER DECISION, deliberately not taken here.** It would
   change dismissal for all 20 consumers — well outside "move the copies onto the shared hook".
   Recommendation: **do it**, as a small follow-up with real-device QA. Trade-off to weigh: `pointerdown`
   also fires when a *scroll* gesture starts outside the panel, so a panel would close as the user
   begins scrolling elsewhere. That is arguably correct, but it is a change, and it needs an iPhone —
   which is the owner's lane.
3. **Method note, twice-earned:** both bad counts came from quoting a scan without asking what it
   structurally could not see. Enumerate by *behaviour* (every way a panel can detect an outside
   interaction: `mousedown`, `pointerdown`, `touchstart`, `click`, `focusout`), not by one API string.

## Corrections to the originating report

The `/simplify` reuse lens reported "12 more copies". A live scan (`addEventListener('mousedown'`
across the repo, verified per file) found:

- **17 implementations across 13 files**, not 12.
- **One file missed entirely** — `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` (the rules
  icon picker). It was also mis-countable: the file matches `=== 'Escape'` twice, but neither match is
  in its dismiss effect, so the picker itself has no Escape. It belongs in Group 2, not Group 1.
- The lens's Tier B (missing Escape) was exactly right at 5; the true no-Escape count is **7** once
  `RulesAdmin` and the notification bell are added.

Record this: the count was taken from a subagent summary and repeated to the owner before being
verified. Verify inventories against live code before quoting them.

---

## Groups

### Group 1 — mechanical, zero behaviour change (7 implementations, 4 files)

Already have both outside-click and Escape; each just carries a private copy.

| File | Implementations |
|---|---|
| `app/[orgSlug]/admin/tournaments/schedule/page.tsx` | 4 — venue filter, unpublish control, mobile tools, schedule tools |
| `app/[orgSlug]/admin/tournaments/registrations/page.tsx` | 1 — registration filter |
| `app/[orgSlug]/admin/tournaments/schedule/components/ScopePicker.tsx` | 1 |
| `components/shared/FlipPill.tsx` | 1 — its own comment admits it "mirrors the admin More-menu pattern" |

### Group 2 — mechanical, GAINS Escape-to-close (6 implementations, 6 files)

Outside-click only today. The swap adds Escape as a side effect. **This is the group with user value
and the group that needs QA.**

| File | Panel |
|---|---|
| `components/coaches/CoachesBottomNav.tsx` | mobile coach nav "More" |
| `components/admin/AdminBottomNav.tsx` | mobile admin nav "More" |
| `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` | rules icon picker |
| `app/[orgSlug]/admin/tournaments/schedule/components/ScheduleTimeline.tsx` | timeline menu |
| `components/accounting/PayeeCombobox.tsx` | payee picker |
| `app/platform-admin/customer-users/CustomerUsersClient.tsx` | platform-admin menu (internal only) |

### Group 3 — not mechanical (4 implementations, 3 files)

| Panel | Why it resists | Disposition |
|---|---|---|
| `components/notifications/NotificationBell.tsx` | panel is portaled to `<body>`, so "outside" is `wrapper.contains() \|\| closest('[data-notification-panel]')` — one ref can't express it | **IN** — it is one of the seven with no Escape, so it carries real value. Needs multi-ref support. |
| `components/chat/ChatPanel.tsx` — emoji picker | Escape refocuses the trigger, outside-click does not; checks two separate refs | **IN** — needs multi-ref + a distinct Escape action. |
| `components/chat/ChatPanel.tsx` — reaction/reactor/poll-voter popovers | no container ref at all; relies on ~10 scattered `onMouseDown={e => e.stopPropagation()}` calls; closes three state slots together | **OUT** — converting means restructuring chat markup. Different risk profile from a dismiss swap; deserves its own approval. |
| `components/coaches/CoachPortalShell.tsx` — team switcher | refocuses the trigger on *every* close, not just Escape/outside | **DEFERRED** — another session has this file uncommitted right now. Concurrency, not difficulty. |

---

## Hook extension required by Group 3

Two consumers (bell, emoji picker) need what one ref cannot express. The extension is the minimum
that covers both, and it hits the repo's own two-consumer bar for adding capability:

1. **Multiple boundaries.** `useDismissable` accepts a single `RefObject`; it needs to accept one *or
   an array*. "Inside" becomes "inside any of them". Single-ref callers are unaffected.
2. **A distinct Escape action.** An optional `onEscape` that defaults to `onDismiss` when omitted, so
   the emoji picker can refocus its trigger on Escape without also refocusing on click-away.

Both are additive with backwards-compatible defaults — the five existing consumers keep their exact
behaviour and their call sites do not change.

**Deliberately NOT added:** a portal/selector escape hatch. The bell gets a real ref on its portaled
panel instead, which is the honest fix; a `closest(selector)` option would encode a workaround into
shared code.

---

## Constraints

- **Preserve every consumer's current behaviour** except the intended Escape gain in Group 2. Any
  focus management, refocus-on-close, or multi-state close that a consumer does today stays.
- **No styling, copy, or markup change** beyond the bell's added ref.
- Check for **nested Escape handlers** — a converted panel inside another Escape-handling surface
  (modal, drawer, chat) could double-close. Verify per consumer, and report findings.
- `components/admin/BottomSheet.tsx` and `components/help/HelpDrawer.tsx` remain **out of scope** —
  full modals (portal + backdrop + scroll-lock + focus trap), correctly not reducible to these hooks.
- ⚠ Concurrent sessions share this working copy. Re-check `git status` before staging; explicit
  pathspecs only; `:(literal)` for bracketed route paths.

---

## Follow-up: the iOS fix (owner-approved 2026-07-30, BUILT — separate commit)

Taken as its own change, deliberately after the sweep landed, so it can be QA'd and reverted on its
own. **19 of 21 implementations now share one dismissal contract.**

**The one-line change:** `useDismissable` now listens on `pointerdown` instead of `mousedown`. The
"not `click`" reasoning is unchanged (a gesture starting inside and ending outside must not dismiss);
what changes is that a tap on inert background now registers on iOS Safari, where `mousedown` simply
never fired.

**The four hold-outs are now converted**, which was only safe once the hook stopped being the
regression: the help tooltip, the public share-score button, the lineup auto-fill popover, and the
lineup Templates/Print pair — the last of which is the two-boundary shape, so it collapsed onto the
array form the sweep added.

**Two behaviour changes worth naming.**

1. **Accepted trade-off:** `pointerdown` also fires when a touch becomes a scroll, so starting a
   scroll outside an open panel now dismisses it. Reads as correct — the user has moved on — and
   matches mainstream UI libraries. **This is the thing to watch in QA**: if it feels twitchy, the
   fallback is to distinguish tap from scroll via `pointercancel`, at real added complexity.
2. **Side effect in chat, judged an improvement.** The reaction popovers keep their own `mousedown`
   listener and their ~10 `stopPropagation` calls — which no longer shield the *emoji picker*, now on
   `pointerdown`. So clicking a reaction while the emoji picker is open now closes the picker. It
   previously stayed open, but only as an accident of event plumbing: the click was genuinely outside
   it, so closing is the correct behaviour.

**Audited and unaffected:** the two modal patterns that stop `mousedown` propagation
(`LeagueCapUpgrade`, `EarlyAccessModalTrigger`) are self-contained backdrop handlers that never used
the hook. The reaction popovers' and team switcher's own listeners stay on `mousedown`, so their
guards still match.

**Help tooltip note:** it also loses its local Escape handler, which only worked while the trigger had
focus — Escape is now document-level, so a tooltip opened by *hover* is dismissable from the keyboard
for the first time.

⚠ **Unverifiable here.** Automated browser testing runs on Chromium, which does not reproduce Safari's
behaviour. **The fix is unproven until someone taps blank space on a real iPhone.** Do not record this
as verified on the strength of the gate passing.

typecheck 0 · focused lint 0 errors · 482 tests · all ratchets zero · schema parity 0.

## `/simplify` outcome (4 lenses, 2026-07-30)

**5 applied, 6 skipped with reasons, 1 escalated to an owner decision** (the `pointerdown` question
above — the single most valuable thing either review produced).

**Applied:** the iOS/`pointerdown` finding and its two consequences (documented above); a duplicated
2-line narrative comment in the two bottom navs trimmed to the same terse factual tag the other sites
use — it restated plan-doc prose in code, in two places, where it would rot; a ⚠ on `onEscape`'s doc
noting it **replaces** rather than composes with `onDismiss`, so a future consumer with a
side-effecting `onDismiss` doesn't silently skip it; a breadcrumb on ChatPanel's unconverted
reaction-popover block, which otherwise sits two lines from a converted one with no in-file
explanation; and a correction to `PayeeCombobox`'s comment, which claimed "every combobox on the page"
was affected when no page renders two at once — a latent cost retired, not a measured one.

**Skipped, with reasons.** Dropping the internal boundary ref (defensible: it mirrors the file's own
idiom and keeps the listener effect's deps honest). Merging the two ref-sync effects (they cover
different domains; the codebase already splits them this way twice). Removing the "no live boundary"
guard (unreachable today, but two commented lines protecting a vacuous-truth false dismiss in a
*shared* hook). A single-ref fast path in the pointer handler (2 small allocations per click on a
human-driven event — the efficiency lens quantified it and recommended against). Converting the
positional signature to an options object (would touch all 20 call sites to benefit the 1 that uses
the 4th argument, and breaks a convention 5 pre-existing consumers set). Removing the now-unread
`data-notification-panel` attribute (harmless, and not this pass's business).

**Efficiency verdict:** no meaningful regression. Two honest micro-costs, both deliberate and
documented. One genuine win in `PayeeCombobox`. One correction to this plan's earlier claim: the two
bottom navs were **already** correctly scoped — their gain here is Escape and shared code, *not*
listener lifetime. Only `PayeeCombobox` had the never-detached bug.

**Altitude verdict:** all three judgement calls upheld with independent argument — the `isComposing`
guard belongs in the hook unconditionally (it is a property of text input, not of chat; this very
sweep put it around a live payee text field, and it fails safe where no input exists); array-of-refs
is the most boring of four options for the portaled bell (un-portaling would make its fixed
positioning hostage to ancestor styling); and `onEscape` is correctly per-consumer, because three
distinct focus-return semantics already exist in the wild (never / Escape-only / every close).

**Noted, not actioned:** both bottom navs carry a byte-identical "close the More menu when the route
changes" effect. Pre-existing, unrelated to dismissal, no shared home — a candidate for a later pass.

## `/review` outcome (high-risk tier, 3 lenses, 2026-07-30)

Lenses: hook correctness · regression/blast-radius · accessibility/interaction. Security and
data-contract lenses not run — no data, auth, org-scoping or migration in this diff.

**2 NEW defects found IN THIS WORK, both fixed. 1 Medium accepted as designed. 4 pre-existing logged.**

### [Medium-High, NEW, FIXED] Escape was a trap door, not an escape — 6 of 7 panels

The accessibility lens found the sweep had opened a different keyboard gap than the one it closed.
Escape unmounted the panel with focus still inside it, so the browser fell back to `<body>` — a
keyboard user who tabbed into the notification bell to read a few rows and then pressed Escape was
dumped at the top of the document and had to tab the entire page to get back. **Plausibly worse than
no Escape at all**, since Shift+Tab previously walked back out to the trigger.

Fixed in the hook, not six times over: `useDismissable` now captures `document.activeElement` when the
panel opens and restores it on the Escape path only (a click elsewhere means the user has already
chosen where they are going). A consumer supplying `onEscape` still owns focus itself, so the chat
emoji picker is unaffected. This also upgrades the 5 pre-existing consumers, including the portal
tour, which deliberately moves focus into itself and now hands it back.

### [Medium-High, NEW, FIXED] The payee picker could silently drop what you typed

Adding Escape to a combobox that wasn't built for one created a dead end: Escape closed the suggestion
list but left the caret in the field, **typing did not reopen it** (only `onFocus` did), and a payee is
only committed by picking a listed option. So Escape → keep typing → submit left the field looking
filled while nothing was recorded. Verified by reading the state machine directly, not taken on trust.
Fixed by making typing reopen the list. This path did not exist before the sweep.

### [Medium, NEW, ACCEPTED AS DESIGNED] The IME guard's blast radius

`isComposing` reflects whatever is focused, not this panel, so an active composition anywhere
suppresses Escape for any open panel. Kept: during composition that Escape belongs to the IME, and
having it also dismiss an unrelated panel is the greater surprise. Always recoverable — one more
Escape, the trigger, or a click away. Costs an IME user one extra keypress. Confirmed inert for all 5
pre-existing consumers (none contains a text field).

### Pre-existing, logged not fixed

- **[High] `PayeeCombobox` options only respond to a mouse.** They are wired to `onMouseDown`, so
  **Enter and Space select nothing** — a keyboard user can open the list and tab through every option
  but cannot choose one. A complete keyboard blocker on the widget's purpose, which puts its Escape
  gain in perspective. Untouched here because the mouse path depends on `onMouseDown` firing before
  blur; changing it needs its own testing. **Own ticket.**
- **[Medium] No overlay knows which is topmost.** `useDismissable`, `BottomSheet` and `HelpDrawer`
  each hold an independent document-level Escape listener and none stops propagation, so two open
  overlays both close on one keypress. Pre-existing pattern; this sweep enrolls 15 more participants.
- **[Low] `BottomSheet` / `HelpDrawer` lack the IME guard** the hook now has. If "correct for every
  consumer" is the argument, it applies to them too.
- **[Fact] `ScopePicker.tsx` has zero consumers** anywhere in the app — dead code predating this work.

### Also verified

No regressions in the 5 already-shipped consumers (the deps change is a no-op for stable refs; the IME
guard is inert without a text field). Chat's converted and unconverted halves cannot interfere —
`stopPropagation` keeps each side's clicks off the document. No collision with the concurrent
public-bell removal (zero file overlap, no shared dependency). The one Playwright spec that presses
Escape was traced statically and is unaffected — **inspected, not executed**, since no dev server was
running and this tree holds other sessions' work.

### Framing correction owed to the owner

"Both mobile nav More menus gain Escape" overstates the benefit: **phones have no Escape key.** That
gain accrues to hardware-keyboard, tablet and assistive-tech users — real, but not the primary audience
of a component called BottomNav.

## Build outcome (2026-07-30)

**15 of 17 converted.** Groups 1 and 2 complete as specified. Group 3: the bell and the emoji picker
are in; the chat reaction popovers and the team switcher are out, for the reasons already stated.
A repo-wide grep confirms exactly two hand-rolled `mousedown` dismiss copies remain, and they are
those two.

### Three things the build found that the plan didn't anticipate

1. **The emoji picker was the only copy that got IME composition right.** It carried
   `if (e.isComposing) return` on its Escape handler — so for someone typing Japanese, Chinese or
   Korean, Escape cancels the composition instead of closing the panel. **Every other copy, including
   the shared hook, was missing it.** Rather than preserve it in one consumer, it moved *into*
   `useDismissable`, so all 20 consumers now behave correctly. This is the clearest example yet of the
   argument for consolidating: a correctness detail one author got right now protects everyone.
2. **`PayeeCombobox` never removed its listener.** Its effect had `[]` deps and attached on mount
   regardless of whether the dropdown was open, so every payee field on an expenses form was handling
   every click on the page for the life of the form. Conversion fixed that as a side effect —
   listeners now exist only while open. No behaviour change (closing an already-closed dropdown is a
   no-op), just less work.
3. **`CustomerUsersClient` keys its menu by row id, not a boolean** (`openMenuId: string | null`), so
   it converts as `openMenuId !== null`. Noted because the same shape will recur in the deferred
   team switcher.

### Nested-Escape check (the risk the plan flagged)

Ran it: the only converted panel that plausibly sits inside another Escape-closing surface is the
payee picker. Both of its host pages were checked — **neither has any Escape handler at all**, and
neither renders it inside a `BottomSheet`. No double-close path found. The chat emoji picker and the
chat reaction popovers can both be open in principle and one Escape would close both, but that was
equally true before this change (both had Escape already), so it is not a regression.

### The bell needed a real ref, not a selector

`NotificationPanel` gained an optional `panelRef` prop and the bell passes `[wrapRef, panelRef]`. The
old code found the portaled panel with a `closest('[data-notification-panel]')` global query. The
`data-notification-panel` attribute is left in place — it is a legitimate test/debug hook and removing
it is not this pass's business — but nothing reads it in application code any more.

## Definition of done

1. Groups 1 and 2 fully converted; no hand-rolled dismiss logic remains in those 10 files.
2. Group 3's bell and emoji picker converted with behaviour preserved; the chat reaction popovers and
   the team switcher explicitly left, with reasons recorded here and in `TODO.md`.
3. The seven no-Escape panels close on Escape.
4. Gate green: `typecheck`, focused lint, tests, `verify:changed`, all ratchets at zero.
5. Owner QA: each converted menu opens, selects, closes on click-away, and closes on Escape.
