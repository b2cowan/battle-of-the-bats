# Scorekeeper score entry — mobile repair

**Status:** ✅ **COMPLETE on dev** — owner QA passed twice (2026-08-08, first at 361px, then again
after the `/review` fixes and the dismissal ruling), `/review` run (6 findings, all confirmed, 5
fixed — §9), owner ruling on dismissal applied (§10). **LIVE on production (2026-08-10 release, Amplify job 251).**

⚠ **Committed inside `3aeda5fd`, a concurrent agent's docs commit** ("docs(hosting): record the
passed live matrix in the canonical-host ruling"), not under a commit of its own. Another agent
committed and pushed in the window between this work being staged and its own commit running, and
swept the staged files in. **The content is byte-identical to what passed QA and nothing was lost —
but `git log` will not lead anyone here.** History was deliberately NOT rewritten: the commit was
already on `origin/dev` and other agents were live in the tree. **This document is therefore the
durable record of the change; the commit message is not.**
**Trigger:** owner screenshot of the score sheet on a phone — "can you evaluate this modal on mobile",
plus two direct questions: do we still need the +/− steppers if the score is entered after the game,
and how do we force the numeric keypad.
**Mockups (approved, all recommendations):** https://claude.ai/code/artifact/f4bedded-de30-421f-b46c-89f35a674bed
**PM brief:** `SCOREKEEPER_SCORE_ENTRY_MOBILE_PM_BRIEF.md`

---

## 1. The measured defect

The score sheet gives each team a `minmax(0, 1fr)` column inside a three-column grid. On a 390px
viewport that column is **~138px**. The stepper laid `48px | 1fr | 48px` with two `0.4rem` gaps
inside it, i.e. **108.8px of chrome**, leaving the input **~29px** — for a numeral rendered at
`2.35rem` (≈38px).

```
390 viewport
 −32  backdrop padding (1rem each side)
 −2   sheet border
 −28.8 sheet padding (0.9rem each side)  ................  327.2 content
 −28  divider column (1.75rem)
 −16  two 0.5rem grid gaps ..............................  283.2 / 2 = 141.6 per team
 −96  two 48px stepper buttons
 −12.8 two 0.4rem stepper gaps ..........................   32.8px for the score
```

The layout only stops being crushed above a **~470px viewport**. This has been broken on every phone
in circulation since J8-007 shipped the steppers, and the screenshot understated it — the away score
looked absent because a 29px box cannot show a digit.

## 2. Ruling on the steppers — removed

J8-007's stated premise was *"a never-trained volunteer can tap −/+ without a keyboard."* It does not
hold:

1. There is no keyboard-less case — every device reaching this screen has a keypad one tap away.
2. The flow saves **once**. The sheet's own copy says the score becomes final immediately, so there
   is no running tally to step. A stepper is an instrument for a live tally; this is a record written
   after the fact.
3. Cost exceeded benefit: 11 taps for an 11-run game, and the buttons crushed the field they served.

**If live in-progress scoring is ever built it earns a persistent scoreboard with its own thumb
controls.** Removing these does not foreclose that.

## 3. Ruling on the keypad — `type="number"` retired on this surface

Was `type="number" inputMode="numeric"`. iOS renders `type=number` as the numbers-and-punctuation
layout and ignores `inputMode` on several versions; Android keyboards inside an installed PWA (which
the scorekeeper is) fall back to the full layout. Now:

```
type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off"
enterKeyHint="next" | "done"
```

Three sharp edges of `type=number` disappear with it, each material on a screen whose next button is
*Finalize*:

- A laptop **scroll wheel changes the score** while the cursor rests over the field.
- **Spinner arrows** render inside the field — never suppressed here, and sharing that 29px.
- A stray character makes the browser report the field as **empty string**, so the existing
  `replace(/\D/g,'')` sanitiser never sees it and the score **silently blanks**.

## 4. What was built

| Change | Why |
|---|---|
| Steppers deleted; field is the whole column (~138px × 72px) | §2 |
| `text` + `inputMode` + `pattern` + `maxLength` | §3 |
| `onFocus → select()` | correcting 5 → 3 produced **53** |
| Enter never submits — home → away, away → blur | an irreversible commit must not be reachable from a keyboard action key nobody aimed at; both fields sit inside the `<form>`, so the default was an implicit submit |
| Title `{home} vs {away}` → `{time} · {field} · {division}` | the team names are on the labels directly beneath; the one line the header owns now says **which game**, the thing a volunteer must confirm out of eight on the field. Applies the 2026-08-02 / 2026-08-07 chrome rule |
| `gameMetaLine()` shared by the list card and the sheet | one string, one separator; card separator moved `-` → `·` to match the platform's documented dot (2026-05-27) |
| Backdrop pinned to `--vvh` / `--vv-offset-top`; sheet `max-height: 100%`, body scrolls, actions `flex: none` | see §5 |
| Actions `auto minmax(0,1fr)` at every width; ≤520px stack override removed | recovered ~54px; the header already has a close button, so a full-width Cancel was a second way to do one thing |
| `.formError` given its own danger tone | it was inheriting the neutral callout's grey frame |
| `.scoreDivider` `align-self: end` + margin | it centred on the whole column, so it drifted when a club name wrapped the label to two lines |
| `tabular-nums`, visible `:focus-visible` ring | 2026-05-27 numerals ruling; the field had `outline: 0` and no replacement |

## 5. The keyboard-headroom finding (the reason A beat B)

The sheet autofocuses, so the keypad is up before the volunteer sees anything. On a 375×667 phone with
a ~260px pad, the usable height is ~407px, ~375px once the backdrop's own padding is taken off.

| | sheet height | headroom |
|---|---|---|
| Before | 370px | **5px** |
| A (built) | 326px | 49px |
| B (stacked rows) | 366px | 9px |

Before cleared it by five pixels — which is why Finalize was reachable in the screenshot and would not
have been the moment a team name wrapped the title to a second line. Options B and C were declined:
B spends the headroom, C buys B's name-pairing only below 360px at the cost of a breakpoint this
component has never had (Option C rails ruling, 2026-08-02).

The sheet now sizes to the **real visible area** using the globally published `--vvh` /
`--vv-offset-top`, the same idiom as the tournament chat composer — `position: fixed; inset: 0` is
measured against the layout viewport, which iOS does not shrink for the keyboard.

## 6. Verification

- `tsc --noEmit` clean. `lint:focused` — 0 errors (1 pre-existing warning at page.tsx:312, untouched).
- `verify:changed` — every gate passed **except** `check:demos`, which fails on the **coach** sandbox's
  attendance seed. Unrelated: neither the sweep nor that seed reads anything in this diff.
- Two UAT specs selected the fields by `getByRole('spinbutton')`, a role that only exists for
  `type=number`. Both moved to `textbox` in the same change.

**⚠ `npm run check:layout` CANNOT SEE THIS SCREEN.** The sweep visits no scorekeeper route (it is
behind a volunteer login), so reporting it green would be false comfort — the 2026-08-07 method note
applies. The width claims here are arithmetic against the shipped stylesheet, not rendered
measurement.

## 7. Owner QA

✅ **PASSED 2026-08-08 — no `OWNER_QA_LEDGER` entry needed**, because QA happened inside this piece
of work rather than being deferred to a QA day. Steps 1–8 passed on the first pass at 361px; 9 and 10
plus the re-checks in 3 and 5 passed after the review fixes and the dismissal ruling. Retained as the
regression script for any future change to this sheet. On a phone, in a tournament with games to score:

1. Open a game → the two score boxes are large and both digits visible.
2. Tap a box → the **0–9 keypad** appears, not the full keyboard. (The mockup carries a live
   side-by-side test of the old and new markup if the pad still looks wrong.)
3. Tap a box that already holds a score, type one digit → it **replaces**, not appends.
4. With the keypad open, confirm **Finalize is visible** without dismissing it. Try a small phone.
5. Press the keyboard's action key from each field → moves to the away score, then closes the pad.
   It must **never** finalize.
6. Header reads time · field · division; check a day spanning two tournaments shows the tournament.
7. A long club name still wraps to two lines above its box without truncating.
8. Review-policy tournament still shows the amber note and "Send for review".
9. **Tapping the dark area outside the sheet does NOTHING** — a half-typed score survives it.
10. **There is no ✕.** Cancel is the only way out; Escape does the same from a keyboard.

## 9. `/review` — standard tier, 3 lenses, 6 findings (all confirmed, 0 refuted)

| Severity | Finding | Fix |
|---|---|---|
| Medium | **`maxLength` truncated a PASTE before the digit filter.** Browsers enforce `maxLength` at the raw edit step, before React sees the value — pasting `ab27` kept `ab2`, stripped to **2**, and finalized a 2 for a 27 with no error, because the field was not empty. A **new** failure mode: `type=number` ignores `maxlength` and rejects unparsable pastes outright | `maxLength` removed; new `sanitizeScore()` strips → de-zeroes → caps. **Sanitise first, cap second** |
| Medium | **Action row overflowed at 320px** on `Submit for Review` (259px needed vs 257 available), and cleared every other width by only **~4px** | `font-size: 0.78rem` + `min-width: 0` scoped to `.sheetActions` — restores ~32px of slack |
| Low-Med | **Enter in the away field ejected keyboard users from the sheet** — `blur()` put focus on `document.body`, so the next Tab restarted at the top of the page | Focus the submit button instead: dismisses the keypad identically, lands on the action |
| Low | **The ✕ scrolled out of view** with the header inside the scrolling body | Header pinned (`flex: none`) alongside the actions; only the middle scrolls |
| Advisory | `007` displayed literally (saved correctly as 7) | Same sanitiser strips leading zeros, keeping a bare `0` |
| Advisory | 1–2 frame snap as the keypad animates (JS-set viewport vars lag the native resize) | **Accepted, not fixed** — the alternative is dropping `--vvh`, which is worse on iOS |

**Ruled out by the lenses** (probed, not assumed): double-submit, tap-outside dismissing a half-typed
score, scroll gestures leaking to the backdrop, typed input lost to the background refresh,
`--vvh` double-counting the keyboard against `interactiveWidget: resizes-content`, dangling CSS
classes, the `·` separator being parsed anywhere, and the `textbox` role still resolving to exactly
the two score inputs.

**⚠ METHOD NOTE — THE MOCKUP LIED ABOUT THE BUTTONS, AND THAT IS WHY THE ROW WAS 2px SHORT.** The
approved mockup drew the action buttons at `0.78rem`; the product declares **no** `font-size` on
them, so they inherit **16px**. The mockup therefore showed a row with comfortable slack over a
product row with 4px. Same trap as the 2026-08-02 warm-vs-dark masthead entry: **a mockup that
re-declares a property the product inherits is not a render of the product.** Resolved by measuring
the real font on a served page (`--font-data` only resolves where next/font has run) rather than by
arithmetic — the fix aligns the product to the approved mockup rather than the reverse.

## 10. Owner ruling — three ways out became one (2026-08-08)

**Trigger:** owner, on the ✕ — *"do we need the X if clicking off removes the modal? are both
necessary?"* There were **three** dismissals for one action: the ✕, Cancel, and a backdrop click.

**Ruled: cut the backdrop click AND the ✕. Cancel is the only way out; Escape is its keyboard twin.**

Why the backdrop click went first, ahead of either visible control:
- **It is the only exit that can destroy work by accident.** A typed 7–4 and a brushed screen edge
  discarded both numbers, with no warning and no undo. The other two are deliberate presses.
- **It barely functions here.** The sheet autofocuses, so the keypad is up from the first frame and
  the backdrop is a **~30px sliver** above the sheet — too small to hit on purpose, and sitting
  exactly where a thumb rests when a one-handed grip shifts.
- **It is invisible.** Tap-outside is a convention, not an affordance; a never-trained volunteer does
  not know it exists, so it was never carrying the "how do I get out" job. **An undiscoverable exit
  that can lose data is all cost.**

The ✕ went too, on the owner's call, and the header measurably gained by it (real font, served page):

| | with ✕ | ✕ removed |
|---|---|---|
| `10:00 AM · Lab Field 1 · U13` @ 320px | 2 lines | **1 line** |
| `2:30 PM · Riverdale Diamond 3 · U15 AA` @ 361/390px | 2 lines | **1 line** |
| a line carrying a tournament name | 2 lines | 2 lines (genuinely long; wraps, never truncates) |

**Escape was added in the same unit of work, and is not optional.** With the ✕ gone and the backdrop
inert, a keyboard user's only exit would otherwise have been to tab to Cancel. The sheet also now
carries `role="dialog"` and a label naming the matchup. **⚠ `aria-modal` was deliberately NOT set —
there is no focus trap, and claiming modality to a screen reader that focus can still leave is a
promise the component does not keep.** A focus trap is the honest follow-up (§8).

## 8. Follow-ups, not done

- **The scorekeeper has zero rendered layout coverage.** Adding it to `check:layout` needs an
  authenticated volunteer session in the sweep. This defect would have been caught on day one by a
  probe that measured the field's computed width.
- `AdminEventHeader` / `CoachTeamHeader` still carry scroll-reading logic inline (carried over from
  the 2026-08-07 entry) — unrelated to this change, still open.
- The coach demo sandbox needs re-seeding; `check:demos` says a re-anchor was already attempted.
