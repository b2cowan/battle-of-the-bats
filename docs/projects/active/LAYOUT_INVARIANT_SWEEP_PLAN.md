# Layout Invariant Sweep — implementation plan

**Status:** Built 2026-08-02 on `dev`, uncommitted. Owner QA pending.
**PM brief:** [LAYOUT_INVARIANT_SWEEP_PM_BRIEF.md](LAYOUT_INVARIANT_SWEEP_PM_BRIEF.md)

## 1. Why

`npm run verify:changed` runs eight checks. Every one reads source text or database state:
lint/typecheck on changed files, colour-token literals, date correctness, snapshot freshness, schema
parity, dictionary coverage, admin org context, observability coverage.

**None of them renders a page.** So the entire class of defect that only exists after the browser
resolves a layout had no gate, and the owner's visual pass was the first thing in the pipeline that
looked at pixels.

Three files already held the right rules — `practice-plan-layout.spec.ts`,
`practice-run-layout.spec.ts`, `drill-library-layout.spec.ts` — each pinned to one feature and one
fixture. They protected three screens; every new screen started unprotected until a bug taught
someone to write another one-off. Two of the three additionally guarded nothing at all, because
they `test.skip(!PROBE_EVENT_ID)` and a skip reports green.

## 2. What was built

| File | Role |
|---|---|
| `scripts/check-layout-invariants.mjs` | The runner: six rules, the landing guard, the baseline ratchet |
| `scripts/layout-screens.mjs` | **The screen list — this is the file you edit** |
| `scripts/uat-fixture-context.mjs` | Resolves the UAT fixture by lookup; throws (never skips) when absent |
| `scripts/.layout-baseline.json` | Generated. Today's known population |
| npm scripts | `check:layout`, `:init`, `:report`, `:prune` |

It is a `scripts/check-*.mjs` guardrail, deliberately matching `check-public-tokens.mjs` — same
baseline-and-ratchet shape, same `--init` / `--report` modes — rather than a second convention.

## 3. The six rules

| id | Holds |
|---|---|
| `page-overflow` | `documentElement.scrollWidth <= clientWidth + 1`. Reports the widest offending elements. |
| `tap-floor` | Interactive elements ≥ 44px tall. |
| `content-overflow` | Nothing spills horizontally while `overflow-x: visible` — wide content must own a scroller. |
| `sticky-no-travel` | Sticky elements can engage **on the axis they declare**, and are not trapped in a non-scrolling ancestor that runs past the viewport. |
| `contrast` | WCAG 2.1 ratio of resolved text colour against the **composited** background: 4.5:1, or 3:1 for large text. |
| `hidden-behind-chrome` | No fully-visible control is trapped under edge-anchored fixed chrome, judged **at the scroll position where that bar can actually trap** — top bars at scroll 0, bottom bars at the end. |

`sticky-no-travel` is the direct guard for the coach-portal shell ruling — *the document is the
scroll container; never re-add overflow to the main element.* Re-adding it traps the masthead in an
ancestor that runs past the viewport with no travel, and this rule fires.

`contrast` walks ancestors compositing `rgba` layers until it reaches opacity, and **declines** when
a gradient or background image intervenes rather than guessing. This is the rule static colour
scanning structurally cannot replace: the source uses the right token, and the *combination* is the
defect.

## 4. Decisions worth not re-litigating

### 4.1 The baseline is not cheating

A blanket 44px floor fails product-wide on day one: the shared `.btnPrimary` / `.btnSecondary`
primitives render at 41px, team nav rows at 38.5px, on every screen. This is recorded inside
`drill-library-layout.spec.ts`, where the response was to narrow that probe to the feature's own
classes — which quietly meant the shell was never checked by anything.

So the sweep ratchets: today's population is snapshotted, **new** findings fail. An entry with a
`reason` is a decision; an entry without one is unargued debt, and every run prints how many are
unexplained so the number stays visible.

### 4.2 Four false-positive classes were found by verifying findings, not by reading code

Every rule that produced a structural finding was checked against an independent measurement before
being believed. **Both structural rules were wrong on the first pass — four distinct faults** — and
none would have been caught by reading the code back:

| # | Rule | Reported | Truth | Cause |
|---|---|---|---|---|
| 1 | `hidden-behind-chrome` | 2 overview cards buried under the bottom nav | centres at y=669, nav began at y=772 — not covered | Next.js dev overlay won the hit test |
| 2 | `hidden-behind-chrome` | 54 controls buried across 11 screens | not buried | `html { scroll-behavior: smooth }` meant the scroll-to-end was measured mid-animation (1496 of 1567) |
| 3 | `sticky-no-travel` | 62 frozen table headers/columns "inert" | correct behaviour | vertical travel checked for elements that stick **horizontally**; and "inert because the table fits" is healthy, not broken |
| 4 | `hidden-behind-chrome` | 46 controls buried | **zero**; `main` reserves exactly the nav's 72px, measured at 361/390/768 | the rule ran at BOTH scroll positions against BOTH bars — but a top bar only traps at scroll 0, and a bottom bar only traps at the end |

Fault 4 is the instructive one, because faults 1 and 2 made it look fixed. Each correction removed
real noise and left a smaller, still-wrong residue that looked plausible. Only measuring the page
directly — counting how many controls actually sit in the nav's band at the true bottom of the
scroll — showed the answer was zero, not "fewer".

The lasting lesson is the one already in this repo's memory: **read real geometry, and then check the
geometry you read.** A plausible-sounding finding measured at the wrong moment, or on the wrong axis,
is indistinguishable from a real one in the output.

Concretely this produced four fixes: the dev overlay is exempt; the browser context runs with
`reducedMotion: 'reduce'` (which trips the app's own `scroll-behavior: auto !important`) and the
scroll is driven to a **confirmed** fixed point rather than fired once; `sticky-no-travel` asks
about the axis the CSS actually declares and stays silent when stickiness is moot; and
`hidden-behind-chrome` matches each bar to the scroll position at which it can actually trap.

### 4.3 `hidden-behind-chrome` is deliberately conservative

A finding now requires the element to be fully in the viewport, an **edge-anchored** fixed bar's box
to genuinely contain its centre, the page to be at the scroll position where that bar can trap, and
the hit test to independently agree that something else is on top. Chrome anchored to neither edge —
a floating toast — is out of scope, because it is transient and judging it needs a human.

**A gate that cries wolf gets switched off**, so it errs toward silence. The cost of that choice is
stated plainly: this rule will miss some real overlaps. It is the right trade for a check whose
whole value is that a red result is worth acting on.

### 4.4 A full sweep can exhaust the dev server, and a partial run must never become a baseline

Running all 112 combinations in one process crashed the dev server's V8 heap during the last width;
26 of 112 screens then reported "did not render" and were simply absent from the results. Two
consequences, one of them nearly serious:

- **Operationally**, the sweep is heavy enough to want a fresh dev server. Run it by width
  (`--width=1440`) on a machine that has already compiled the routes, or restart between passes.
- **Correctness** — an unmeasured screen contributes no findings, so a baseline snapshotted from a
  crashed run silently records the product as cleaner than it is. On 2026-08-02 that would have
  overstated the colour fix substantially: the drop looked like 3,869 → 1,146, but part of it was
  simply screens nobody looked at.

`--init` and `--prune` now **refuse to write** when any screen failed to measure, unless
`--allow-partial` is passed. Check mode already exited non-zero. The rule this encodes: *a check
that could not look is not a check that passed.*

## 5. Fixture durability

The old probes pinned the team as a literal UUID and took the practice id from an env var guarded by
`test.skip`. Both fail silently — reseeding rots the UUID, and a missing env var reports green. One
was already guarding nothing.

`uat-fixture-context.mjs` resolves org → team → active program year → the seeded `UAT probe practice`
by the same lookups the seeder uses, checks `error` on every select before trusting an empty result
(the mis-diagnosis recorded in the seeder's header), and **throws with the repair command** when
anything is missing. A check that cannot see its fixture fails.

The runner additionally treats *landing* failures as hard failures: a page containing
"Not assigned to any teams", "Team not found" and similar measures perfectly and means nothing. This
is the trap the coach specs document — the coaches portal resolves org context before coaching
assignments, so a coach screen opened with the org-owner session renders a plausible dead end.

## 6. Verification performed

- Rules exercised against a real signed-in coach session on the dev server.
- Determinism confirmed: identical finding count on repeat runs of the same screen/width.
- Every structural finding class independently re-measured; three false-positive classes found,
  root-caused and eliminated (§4.2), then re-verified as no longer reproducing.
- Contrast maths hand-checked: `rgb(138,129,119)` on white → 3.826:1, matching the reported 3.83:1.

**Not verified / residual risk.** The two high-volume rules — `contrast` (1,874 findings) and
`tap-floor` (1,838) — were spot-checked, not exhaustively audited. `contrast` declines to judge text
over gradients and images, and does not account for an ancestor's `opacity`. `tap-floor` measures an
element's own box, so a small control inside a larger tappable row reads as a miss; that is a
deliberate conservative choice, and the baseline absorbs it.

## 7. Baseline as built — 28 screens × 4 widths, all 112 combinations measured

| Rule | Findings | Reading |
|---|---:|---|
| `page-overflow` | **0** | No coach-portal screen scrolls sideways at any width. Clean. |
| `sticky-no-travel` | **0** | Nothing claims to stick and fails to. Clean. |
| `hidden-behind-chrome` | **0** | Nothing usable is trapped under the masthead or bottom nav. Clean. |
| `content-overflow` | 1 | One 24px spill on the practice-plan schedule strip at 1440. |
| `contrast` | 1,903 | **96% is one token** — see §7.1. |
| `tap-floor` | 1,965 | The known product-wide primitive population — see §7.2. |

The three structural rules landing at zero is a genuine result, not an absence of checking: they are
the rules that produced every false positive in §4.2, and each was hardened until it agreed with an
independent measurement.

### 7.1 `--home-dim: #8A8177` fails WCAG AA wherever it carries normal text — **1,835 of 1,903**

3.83:1 on white, 2.94:1 on the mobile bottom nav's cream, 3.49:1 on the warm card ground — against a
4.5:1 floor. It is the portal's muted colour for labels, counts and helper text, so it is
everywhere. **Raising this one token clears 47% of the entire baseline.**

Smaller contrast populations, each its own decision: `rgb(217,72,43)` on white (4.17:1, 28×),
`rgba(70,55,30,0.4)` on white (24×), and the lime `rgb(87,101,30)` on the dark grounds (~3:1, 6×).

This is a **design decision** (`/design`), deliberately not made as part of a tooling change. It is
also the case static colour scanning structurally cannot reach: the token is used correctly
everywhere; the *value* is the defect.

### 7.2 The tap-floor population is the shared primitives, not scattered mistakes

The heights cluster hard: 39px (419×), 40px (375×), 36px (200×). That is the shell and the shared
button primitives, exactly as `drill-library-layout.spec.ts` recorded. A handful of genuinely small
controls sit underneath — 24px roster name links, 21–22px icon buttons — and those are worth
looking at on their own merits.

## 8. RESOLVED 2026-08-02 — both colour findings fixed at the token

Owner approved against mockup artifact `aa2e9415` (binding visual spec). Ratified in
`memory/design_decisions.md`, which supersedes the original R1-4 values.

| Token | Was | Now | Worst ground (bottom nav) |
|---|---|---|---|
| `--home-dim` | `#8A8177` | `#6A635C` | 2.93:1 → **4.53:1** |
| `--home-live` | `#D9482B` | `#B03A22` | 3.27:1 → **4.63:1** |

Changed in both declared-mirror palette copies, plus the derived `-soft` / `-rgb` values, one
fallback literal, and a chevron drawn as an inline SVG data URI.

**The red is deliberately not the lightest passing value.** `#B33B23` clears the nav by 0.01; that
ground is a composite, so anything that changes behind it drops the ratio back under. `#B03A22`
holds 4.63:1.

### 8.1 The finding underneath the finding

Three earlier sessions had already hit this exact wall and patched around it **locally**:

- the system screens forced `--home-ink-soft` in place of the muted token for the eyebrow, noting
  "only reaches 3.3:1 on paper";
- the same file hand-darkened the red with `color-mix(--home-live 78%, --home-ink)`, noting
  "3.9:1 on paper — just under AA";
- Team HQ's "not switched on" line forced `--white-70`, noting "~3.8:1 on the white card".

Each comment recorded the failing ratio accurately and then routed around it. Nobody looked up.
**A token that three separate surfaces privately work around is a broken token, not three unlucky
surfaces** — and the local fix is the smell. The sweep's real contribution was not spotting a
contrast failure; it was showing that the failure was *one value in 1,835 places* rather than a
handful of awkward screens.

The crash-screen `color-mix` workaround is now removed — that surface takes the corrected token
directly. The other two stay: their reason was contrast, but the editorial choice (body ink for
body copy, a clear step down for a "not set up" figure) stands on its own.

## 8.2 The permanent guard: a palette test on the always-run gate

The browser sweep cannot be automatic — it needs a dev server, a session, seeded data and twenty
minutes. But the defect it found did not need a browser to catch. The tokens are known values, the
grounds are known values, so *whether a colour can ever be legible* is arithmetic.

`tests/unit/warm-palette-contrast.test.ts` asserts it, and `scripts/check-contrast.mjs` puts it on
the `verify:changed` chain — which is what `/review` Stage 0 already runs. **Cost: ~0.45s inside a
~28s gate, under 2%.**

Six assertions: the parse actually found a palette (a vacuously-green test is worse than none); the
two mirror copies agree; every prose ink clears AA on all four grounds; every status accent clears
AA on the two grounds it lands on; the three-step ink hierarchy stays ≥1.5 apart so a contrast fix
cannot collapse muted into secondary; and the light glyph on a live-red fill stays legible.

**Verified by breaking it:** reinstating `#8A8177` turns the gate red and names the token, all four
grounds and the exact ratios. A green test that has never been shown to fail is not evidence.

The division of labour is deliberate and should stay:

| | Question | Cost | Runs |
|---|---|---|---|
| Palette test | Can this colour *ever* be legible on that ground? — a **definition** question | 0.45s | Always, on the gate |
| Browser sweep | Is this actual string legible on what is actually painted behind it? — a **usage** question, including alpha compositing | ~20 min | Deliberately |

One accepted shortfall is recorded in the test with its reason: `--home-amber` on cream paper is
4.49:1, a hundredth under. It is a status accent and the sweep finds no instance of it rendering as
text on that ground. An entry without a reason is not an exemption — same rule as `token-exempt`.

## 9. Findings to route onward

**`--home-dim: #8A8177` fails WCAG AA wherever it carries normal-size text** — 3.83:1 on white,
2.94:1 on the mobile bottom nav's cream. It is used portal-wide for muted labels, counts and helper
text. Raising it is a **design decision** (`/design`), not a tooling change, and is deliberately not
made here.

## 10. Backtest against real history — 2026-08-03

**24 mechanical UI defects from the last ~6 weeks of fixed-and-recorded history were scored against
the six rules. As shipped, the sweep catches 3.** Extending the screen list to the surfaces the
corpus actually names would take it to ~11. The full table and method are in
[LAYOUT_INVARIANT_SWEEP_BACKTEST.md](LAYOUT_INVARIANT_SWEEP_BACKTEST.md).

Five scorings were verified by restoring the pre-fix state and re-running, per the rule that a green
result proves nothing until the tool has been seen red on the real bug. **Three of five "would have
caught" scores were wrong and were rescored to NO**, each for a different reason:

| # | Rule | Verdict | Why |
|---|---|---|---|
| V4 | `contrast` | **red, confirmed** | `--home-dim: #8A8177` reinstated → 3.83 / 3.49 / 2.94:1, matching §7.1 to the hundredth. |
| V3 | `contrast` | **red, confirmed** | Restored pre-fix Development page → ink-on-olive CTA at 2.41:1. |
| V1 | `contrast` | rescored **NO** | The frozen-alias defect lives on the coach tournament record, which is **not in the screen list**. Widened to 11 listed screens: silent. |
| V2 | `contrast` | rescored **NO** | See §10.1 — the rule cannot see text on the portal's own paper. |
| V5 | `hidden-behind-chrome` | rescored **NO** | See §10.2 — the covered element was a heading, and the rule only inspects controls. |

### 10.1 ✅ FIXED — `contrast` was blind to text on the portal ground

`effectiveBg` returns `null` the moment it meets any `background-image`, and `.coachesMain` paints
the blueprint grid on **every org-scoped coach screen, in both themes**. So every text element whose
own ancestors are transparent — page ground text, not card text — is silently declined.

Measured at 390px: **19–53% of text-bearing elements per screen are declined this way**
(roster 43/87, schedule 9/17, development 18/38, tryouts 13/42, overview and team hub 8/42). Every
one is recoverable: the gradient sits on an element that also declares an **opaque
`background-color`**, so the composite is knowable, not a guess. Four genuine AA failures are hiding
in that blind spot today (roster 4.49:1, tryouts 4.39:1 × 3).

This reframes §7.1. The rule found the muted-ink defect because it is used inside **cards**, which
paint an opaque surface and short-circuit the walk. It never looked at the paper.

**Fixed 2026-08-03.** A **gradient** over an opaque `background-color` on the same element now
composites against that colour; a `url()` image still declines, because a photo has no single ground
and guessing one trades a blind spot for a wrong answer — which is worse, since a wrong answer looks
like a real finding. The approximation under-reports where the gradient is darker than the colour
beneath it, never invents findings.

**Verified by breaking it:** with the pre-fix Development page restored, the rule now reports the
white-on-cream text at **1.10:1** that it previously declined outright.

### 10.2 ✅ FIXED — `hidden-behind-chrome` only inspected controls

Restoring the `/coaches/join` overlap put the card heading at y=16 under a 64px fixed nav — the
defect, exactly as reported — and the rule stayed silent, because the nearest **control** sat at
y=150, clear of the bar. Covered *text* is invisible to it.

**Fixed 2026-08-03.** The rule now also inspects prose containers — `h1`–`h4`, `p`, `li`, `dt`, `dd`,
`figcaption`, `blockquote` — never a bare `div`, because a wrapper's centre says nothing about
whether anything readable is covered, and the three-way agreement is the only thing keeping this rule
believable.

**Verified both ways:** with the clearance reverted it reports
`h1 "Create Your Coaches Portal Account" · centre (195,36) sits under fixed nav`; with the shipped
clearance restored it is silent again.

`page-overflow`, `content-overflow` and `sticky-no-travel` were also falsified deliberately and all
three fire correctly: re-adding `overflow-y` to `.coachesMain` reports the masthead as trapped in
`<main>` (the shell ruling, now tested rather than asserted), and an injected 130vw block reports
both overflow rules. **All six rules have now been seen red on a defect** — none of the zeroes is
still unfalsified.

### 10.2b What the two fixes surfaced — FULL PASS, 112/112 measured, nothing skipped

Complete sweep after the fixes, all 28 screens × 4 widths, **zero unmeasured combinations** (the dev
server was restarted between passes; it had reached an 8.1 GB working set and died once, exactly as
§4.4 predicts). Raw new-finding counts: **1,375 / 1,356 / 1,365 / 1,366** at 361 / 390 / 768 / 1440.

**Those numbers are one defect counted 1,347 times.** Deduped, the pass found:

#### A. Every bolded phrase in every in-app help guide is invisible in warm — 1,347–1,353 per width

`components/help/help.module.css` sets `.helpSectionContent strong { color: rgba(255,255,255,0.75) }`
and `.helpFaqAnswer strong { rgba(255,255,255,0.76) }` — hard-coded dark-theme literals that never
remap under the warm gate. Measured on the help hub: **1,654 `<strong>` elements at ~1.1:1 on cream**,
while the surrounding `<p>` (639), `<em>` (140) and `<li>` (117) all resolve correctly to
`rgb(106,99,92)`. So the guides render as sentences with holes where the emphasis was — which is
precisely why it survived: the page looks populated.

Warm is the coach portal's default, so this is what a coach actually sees. **This is the single
highest-value thing the backtest produced**, and it was invisible to the old rule for the exact reason
§10.1 documents: help body copy sits on the portal's gradient ground, never inside a card.

⚠ The colour guardrail covers `components/help` (the `shared` scope) but did not catch these —
`rgba(255,255,255,x)` is a plain white literal, not a brand-coloured one. Worth a look on its own.

#### B. ~~The last attendance row is trapped under the bottom nav~~ — **FALSE POSITIVE, rule fixed**

This was `hidden-behind-chrome`'s first finding ever, at 361 and 390, and it was wrong. Every check
the rule makes agreed: the element was fully in view, its centre (195,789) sat inside the nav's
772–844 band, and the hit test returned the nav's glyph. It read exactly like a trapped row on the
one screen a coach uses one-handed outdoors — the most alarming possible place for one.

It is content inside a **closed accordion**. The practice-run attendance fold keeps its children
mounted, so they carry real boxes — non-zero size, `visibility: visible`, `opacity: 1` — 215px below
their own `<details>` box, landing in the nav's band. Discounting the bar showed `<main>` painted at
that point, never the paragraph. **Layout geometry is not proof of paint**, and `visible()` cannot
tell the difference.

Widening the rule to prose (§10.2) is what exposed it: closed-accordion content is `<p>`, which the
old controls-only selector never reached. This is §4.2 repeating exactly — *a correction that removes
a real blind spot introduces a plausible new false positive, and only an independent measurement
tells them apart.*

**Fixed in the rule, not the product.** A finding now additionally requires the element (or a
descendant — never an ancestor, which would wave this straight through) to appear in
`elementsFromPoint`'s z-ordered stack, proving it is genuinely painted underneath the bar rather than
merely laid out there. Non-mutating, unlike hiding the bar to look behind it. **Verified both ways:**
the practice-run false positive is gone at 361 and 390, and the real `/coaches/join` overlap still
reports its `h1`.

#### C. Nine distinct contrast near-misses — but only THREE colours

| Colour | Token | Where | Ratio |
|---|---|---|---|
| `rgb(161,98,7)` | `--warning-strong` (amber) | roster "12 without a position", practice-run "Over by", announcements "No one to email yet" | 4.06–4.49:1 |
| `rgb(62,122,50)` | warm win/green | roster "Active" pill, dues em-dash cell | 4.08–4.14:1 |
| `rgb(106,99,92)` | **`--home-dim`** | roster "Deactivate", tryout count chips ×3 | 4.39:1 |

**The third row is the important one.** `--home-dim` is the token §8 raised to `#6A635C` last week and
`warm-palette-contrast.test.ts` asserts against **four grounds**. These fail on grounds the test does
not know about — `rgb(226,221,212)` and `rgb(231,229,216)`, the tinted chip and row surfaces. The
palette test is not wrong; **its ground list is incomplete**, and that is a cheaper fix than any of
the individual findings.

#### D. Not findings — two measurement artifacts worth recording

- **A 19-finding cluster on `coach-team-hub` @361 did not reproduce.** Every colour in it was from
  the DARK ramp (`rgba(255,255,255,0.4)` on `rgb(10,10,10)`, navy on near-black) — the page was
  measured mid-theme-resolution on the server that later died. §6's "determinism confirmed" claim
  should be read as *usually*, not *always*.
- **Signatures containing dates rot daily.** The known practice-plan `content-overflow` re-reported as
  new because its signature embeds "Mon, Aug 3" — any baseline entry whose text carries a date breaks
  itself every day. Worth normalising dates out of `sigOf`.

**The baseline is deliberately NOT re-snapshotted.** Absorbing A and B into the ratchet would hide a
help system nobody can read and a row nobody can reach. C is three colour decisions, not nine.

### 10.4 ⚠ Fault 7 — a translucent badge on a translucent row, and the day's third false positive

Straight after the accent ruling the sweep reported the roster's "Active" badge at **1.05:1** —
green on solid olive, an unreadable label on a shipped screen. It was about to be fixed.

`over()` hard-coded `a: 1`, which is correct only when the backing layer is already opaque. The badge
is a 12% green wash on a **10% olive table-row tint** — the commonest badge pattern in the portal —
so the maths declared the result fully opaque *at the row tint's own colour*. Worse, the walk uses
that alpha to decide it has found opaque ground, so it **stopped early**: the error compounded rather
than merely mis-shading. True ground is a pale sage `rgb(210,214,195)`.

**The real numbers ran the other way.** On the true ground the old green measured **3.52:1** — a
genuine shipped failure nobody knew about — and the darkened `--home-win` takes it to **4.61:1**. A
bug in the measurement hid a real defect and then invented a fake one on the same element.

That is **three false positives in one day, two of them nearly acted on** (the closed-accordion "row
trapped under the nav", the gradient-ground blindness, and this). Each looked more plausible than the
truth; each was settled only by measuring the element directly rather than reasoning about the
report. The standing rule this earns: **a finding alarming enough to act on immediately is the one to
re-measure first** — and *a number moving the wrong way is not a regression until you have checked the
number is real.*

### 10.3 What the misses have in common

- **9 of 21 misses are pure coverage** — the right rule existed, the screen was not listed.
- **Truncation is the most common visible symptom and no rule sees it.** An ellipsis is
  working-as-designed to a geometry check; four corpus defects were "the name got cut".
- **The sweep measures one state per screen.** A closed More menu, an unopened popover, a modal and
  a notched phone (`env(safe-area-inset-bottom)` is 0 in headless Chromium) are all unreachable —
  four corpus defects lived in exactly those places.
- **A whole class is constant-drift, not layout** — a 72px token against a 70.31px bar, a 71px bar
  against a 72px sibling, a `styles.changeBarHoisted` that resolves to `undefined`, `@keyframes` in
  the wrong CSS module. Cheap static checks; three of the four reached the owner.
- **A clipped control is invisible to both overflow rules** — `content-overflow` skips anything whose
  `overflow-x` is not `visible`, which is precisely how a control gets clipped.

## 11. Not done / next

**From the backtest (§10), highest value first:**

- [x] **Fix the `contrast` gradient blindness** (§10.1) — done 2026-08-03, verified red then green.
- [x] **Extend `hidden-behind-chrome` to headings and text blocks** (§10.2) — done 2026-08-03,
      verified red then green.
- [x] **Fix the help-guide bold literals** (§10.2b A) — done 2026-08-03. Both took the ramp token
      `--white-75`, byte-identical on dark. Help hub findings **1,347 → 11**.
- [x] **The "trapped attendance row" was a false positive** (§10.2b B) — the RULE was fixed, not the
      product; verified both ways.
- [x] **Add the tinted grounds to `warm-palette-contrast.test.ts`** (§10.2b C) — done 2026-08-03.
      Five grounds added; accent grounds made **per accent** and evidence-driven rather than one
      shared list, so the test cannot cross-produce combinations the product does not have.
- [x] **DESIGN CALL MADE 2026-08-03** (owner-approved, mockup artifact `501936c4`; ratified in
      `memory/design_decisions.md`). Measured across all nine grounds it was never five near-misses:
      **amber failed 8 of 9, blue and win 6 of 9** — hidden because the palette test held the accents
      to the two grounds they passed on. Ruling: the three accents **darkened along lightness only**
      (`--home-amber` → `#835006`, `--home-blue` → `#134FD3`, `--home-win` → `#34662A`, each clearing
      5.0 on its worst ground); `--home-dim` and `--home-live` **unchanged**; the chip surface moved
      onto a **new `--home-fill` token** because a hairline was doing duty as a surface. **`ACCEPTED`
      is now empty** — the five parked entries were deleted, not extended, along with a sixth
      long-standing exemption whose premise the un-blinded sweep disproved.
- [x] **The "unreadable Active badge" was the THIRD false positive of the day** — see §10.4. Fixed in
      the rule's compositing maths, not the product. The badge was genuinely failing at 3.52:1 before
      the accent ruling, which took it to 4.61:1.
- [ ] **Flagged, not fixed: more raw dark-theme literals in the help stylesheet** — "For: Coach" at
      **2.03:1** on cream, the search-results heading, and seven raw white values. The colour
      guardrail covers that file but does not flag plain white / platform-blue literals, which is why
      none were caught.
- [ ] **The other nine raw white text literals in the help stylesheet** — the sweep flagged only the
      two `strong` rules, so the rest either do not render on the help hub or sit on dark-filled
      drawer surfaces. Same class of latent bug; worth converting to ramp tokens on their own merits.
      Related: the colour guardrail covers that file but does not flag plain `rgba(255,255,255,x)`.
- [ ] **Normalise dates out of finding signatures** (§10.2b D) — a baseline entry whose text carries
      a date invalidates itself every day. Deliberately not done here: changing `sigOf` orphans
      existing baseline entries, so it wants its own pass.
- [ ] **Baseline still deliberately NOT re-snapshotted**, pending the design call above.
- [ ] **Extend the screen list beyond the coach portal** (admin, consumer, marketing, the free
      portal, the coach tournament record) — one line each. This is 9 of the 21 misses, and the
      corpus names the exact surfaces.
- [ ] **New rule — `truncation`:** an element with `text-overflow: ellipsis` whose
      `scrollWidth > clientWidth`, scoped to headings and primary labels so it does not fire on
      every table cell.
- [ ] **New static checks (not this tool):** a CSS-module class reference that resolves to
      `undefined`, and `animation-name` with no same-file `@keyframes`. Both already shipped broken;
      the second was swept by hand once and will drift again.
- [ ] **Decide explicitly** whether one-state-per-screen is accepted (and say so in the doc), or
      whether the list gains state variants (More menu open, a popover open).
- [ ] **Conceded as not mechanically catchable here:** judgement defects (weak hierarchy, repeated
      copy, drift from a mockup — 7 more in the corpus, counted separately) and interaction defects
      (iOS tap-away, keyboard dismissal, the two-tap `cursor` bug). The last of those is catchable by
      a lint, not by this sweep.

**Pre-existing:**

- [x] Owner decision on `--home-dim` — resolved 2026-08-02 (§8).
- [ ] Decide whether the sweep formally gates handover, or stays advisory.
- [ ] Retire the overlapping assertions in the three per-feature layout specs once the sweep has
      proven itself, keeping only what is genuinely feature-specific (the run screen's 56px floor,
      tabular numerals, the read-only drill ruling, the GET-only network assertion).
- [ ] Consider adding to `verify:changed` behind a dev-server-present check.

**⚠ Bounds on every number above.** The corpus is only defects that were fixed **and** recorded in a
commit body or plan file — silent fixes and still-open defects are invisible, and it skews to the
last six weeks and to the coach portal. Two corpus items could not be verified at all because the
code has since been deleted or restructured. And the sweep's own reach is bounded by the UAT fixture:
several screens measure a near-empty page, and `ready: 'h1'` proves the shell rendered, not the
content.
