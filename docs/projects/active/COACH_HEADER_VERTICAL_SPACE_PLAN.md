# Coach portal — header vertical space

**Status:** ✅ **B + C + E ON DEV** — ⚠ **A (desktop scroll-collapse) BUILT 08-18 and REVERTED BY THE OWNER 08-19, see §12**. Originally A+B+C+E built 2026-08-18 (owner approved the four directions same day),
uncommitted, owner QA owed — ledger §59. No migration, no route change, no new screen.
**⚠ D deliberately NOT closed** — owner: *"don't close D forever, I am reconsidering… not opposed to
revisiting moving to the single header."* See §4 and §10.
**Mockup (approved, binding for A/B/C/E):** `claude.ai/code/artifact/ccc08606-fcc2-41b4-b56f-627a8967a7cd`
(source in repo: `docs/projects/active/COACH_HEADER_VERTICAL_SPACE_MOCKUP.html`)
**PM brief:** `COACH_HEADER_VERTICAL_SPACE_PM_BRIEF.md`

---

## AS BUILT — measured on the dev build after the change (2026-08-18)

⚠⚠ **SUPERSEDED IN PART: direction A (the desktop collapse) was REVERTED by the owner on 2026-08-19 —
see §12 for the current numbers.** Everything below describes the 08-18 build. B, C and E stand.

Same rig as the baseline in §1 (Playwright, live dev server, UAT coach fixture).

| | Before | After | Δ |
|---|---|---|---|
| Desktop 1440 — chrome above first content | 234px | **190px** | **−44px** |
| Desktop 1440 — pinned chrome while scrolling | 122px (48 + 74) | **88px** (48 + 40) | **−34px** |
| Desktop — team bar at rest | 74px | **58px** | −16px |
| Desktop — team bar scrolled | 74px (never collapsed) | **40px** | −34px |
| Desktop — page-title band | 80px | **52px** | −28px |
| Phone 390 — chrome above first content | 208px | **188px** | −20px |
| Phone — team bar at rest | 72px | **56px** | −16px |
| Phone — finished-season bar | 98px | **82px** | −16px |
| Phone — page-title band | 120px | 116px | −4px |

**Three honest corrections to the estimates in §6:**
1. **The phone's title band barely moved** (−4px, not "similar to desktop"). Its height is set by the
   44px tap-target floor on the help "?" button, not by the icon tile — shrinking the tile below 44px
   reclaims nothing there. The phone's real gain is B's.
2. **The finished-season phone bar is 82px, not "back to normal ~72px".** The third line B removed was
   the club eyebrow, which is genuinely gone; the residual height is the fixture's long team name
   ("UAT Between Seasons") wrapping its role chip onto a second line. A normal-length name closes the
   gap. Reported as measured rather than as promised.
3. **A's share is −18px, not −34px**, because B had already taken the bar from 74 to 58 before A
   collapsed it. A+B together still deliver the −34px of pinned chrome the plan claimed.

**Verified beyond the tape measure:**
- `--coach-header-h` tracks the collapse live (58px → 40px on scroll, via the existing ResizeObserver).
- **Chat never collapses** — that page does not scroll the document at either width, so its box math
  sees a stable 58px. The risk flagged at §5A does not fire.
- **The practice-plan focus rail follows the chrome correctly**: sticky offset 122px → 104px as the bar
  slims. (Separate observation, NOT caused by this change and not fixed here: on the practice editor
  that rail scrolls away rather than pinning, because its own container is short. The offset formula is
  unchanged by this work.)
- The collapsed desktop bar keeps `.teamHeaderRight` mounted and displayed; the UAT fixture team simply
  has no live status and no public-site flip, so it renders empty there. **The status line's appearance
  in the collapsed desktop bar is the one thing this pass could not prove with the fixture** — it needs
  the owner's eyes on a team with a game this week (ledger §59 step A).
- **`check:layout` — 34 new findings across three fully-detailed screens (Overview, Schedule, Roster) at all four widths, and NOT ONE of them names anything this change touched.** No h1, no page header, no icon tile, no team bar. Every new finding is one of nine chrome elements belonging to OTHER sessions' unbaselined work: the notification bell (tap-floor + a 4px overflow) and the renamed team switcher from the 2026-08-17 slimdown (§55); the five collapsible nav-group headings and the `Skills & Goals` rename from the nav work; plus the Overview's season-setup button and a Schedule row button. The full 48-screen × 4-width run repeats the same chrome set on every coach screen, which is the §55 re-baseline debt firing as predicted.
- ⚠ **NOT re-baselined, deliberately.** A re-baseline here would absorb three other sessions' unargued debt under this change's name. The baseline (2026-08-17 18:54) predates all of it; whoever owns that debt should argue it.
- ⚠ One screen (`coach-attendance @361`) timed out at 150s in the full run. **Checked directly afterwards: it renders fine** (h1 "Insights" — it is the Insights-portal work in flight) — transient dev-server compile contention, not a broken page. An unmeasured screen is still unmeasured, so it is recorded rather than waved off.
- `npm test` — 2169/2169 pass. CSS module purity, palette contrast and text contrast gates clean.
  ESLint clean on all four changed files.

⚠ **`verify:changed`'s operator token ratchet fails on three `#f87171` literals in
`coaches.module.css`** — `.moneyFilterChipOverdue` / `.registerRowOverdue` / `.registerChipOverdue`,
which belong to **another session's in-flight money-register work** in the same file. Not this change,
not fixed here.

---

## 0. The ask, and the honest answer to it

The session opened with: *"can we reclaim vertical space by consolidating the team-identity header
(CoachTeamHeader) into the FieldLogicHQ top strip (CoachTopStrip), or otherwise reduce the space it
takes up."*

**The consolidation premise is already spent.** The two rows share zero content — the 2026-08-17
shell slimdown removed the one real duplicate (the org name, which the sidebar and the masthead both
printed). What is left is not repetition; it is three separate jobs stacked vertically.

**The space is real anyway** — 234px sit above the first line of content at 1440×900 — but the
cheapest, least destructive pixels are not where the ask points. Directions A/B/E below get more than
half of what a strip merge would buy, on both devices instead of one, with no ruling reversed.

**⚠ And the ask, taken literally, is the shape rejected on 2026-08-02** — see §4.

---

## 1. Measured baseline (dev build, UAT coach fixture, 2026-08-18)

Playwright, live dev server, `/{org}/coaches/teams/{id}/schedule`, storage state `tests/uat/.auth/coach.json`.

### Desktop 1440×900 — club org, head coach, quiet week

| Band | Height | Cumulative |
|---|---|---|
| `CoachTopStrip` (fixed) | 48px | 48 |
| `CoachTeamHeader` (sticky) | **74px** | 122 |
| `.coachesMain` padding-top absorbed by the masthead's negative margin → gap to h1 | 32px | 154 |
| `CoachPageHeader` block (48px icon tile / h1) | 48px | 202 |
| `.pageHeader` margin-bottom | 32px | **234** |

First real content (`.listToolbar`) lands at **y = 234** — 26% of a 900px viewport.

### Phone 390×844 — no top strip at this width

| Band | Height | Cumulative |
|---|---|---|
| `CoachTeamHeader` | **72px** (collapses to **36px** on scroll >64) | 72 |
| padding | 16px | 88 |
| `CoachPageHeader` block (title row + actions row) | 100px | 188 |
| margin-bottom | 20px | **208** |

### Closed-season page (`/season-end`)

| Width | Masthead height | Note |
|---|---|---|
| 1440 | 74px | same as live |
| 390 | **98px** | `Complete` chip + `Final 2–1–1` wrap to a third line — the tallest masthead in the product, on the smallest screen |

**Reproduce:** the measurement script is disposable and lives in the session scratchpad; it drives
`resolveUatContext()` + the existing coach storage state and reads `getBoundingClientRect()` on
`header[class*="strip"]`, `header[role="banner"]`, and the outermost `.pageHeader` ancestor of `main h1`.

---

## 2. Duplication audit — checked, not assumed

| Fact | Top strip | Masthead | Sidebar | Page title | Verdict |
|---|---|---|---|---|---|
| Club / org name | — | eyebrow (club orgs only; suppressed on team workspaces) | — | — | **once** |
| "Coaches Portal" | beside wordmark | — | — | — | **once** |
| Team name | — | headline | switcher `<select>` (2+ teams only) | — | **twice** (horizontal) |
| Role | — | `.teamHeaderRole` chip | `.sidebarSectionLabel` "Assistant Coach" (assistants only) | — | **twice, assistants only** |
| Season | — | meta line | — | — | **once** (title chip died with P2, 2026-08-16) |
| Record | — | meta line | — | — | **once** |
| Live status / game day | — | right slot | — | — | **once** |
| Scouting-book nudge | — | attached second row | — | — | **once** |
| Public-site flip | — | right slot | — | — | **once** |
| Which screen you are on | — | — | active nav item | h1 | **twice, by design** |
| Bell / account / workspaces | door corner | — | — | — | **once** (moved 2026-08-17) |

**Three duplicates. None between the two header rows.** Two cost no vertical space. The third — screen
name as both a highlighted nav item and a 1.75rem display heading — is the one costing 80px per screen.

---

## 3. Constraints any direction must survive

Read from the code, not from a plan.

1. **`CoachTopStrip` does not exist at ≤900px** (`CoachTopStrip.module.css` `@media (max-width:900px){display:none}`).
   Anything moved into it needs a second implementation for phones.
2. **The masthead's status feed is SSR'd once per team-section entry.** `teams/[teamId]/layout.tsx` is the
   first place `teamId` exists server-side; `getCoachMastheadFeed` + the scouting/game-day nudges ride down
   with the page. `CoachTopStrip` mounts in `CoachesChrome` (portal layout) where `teamId` does not exist.
3. **The record is CANONICAL on every device** (owner ruling 2026-08-02) — it deliberately ignores the
   per-device "count scrimmages" Insights switch. Two implementations make that harder to hold, not easier.
4. **`--coach-header-h` is published by the masthead and consumed by three surfaces:**
   `.collapseSection` scroll-margin (deep links), `.ppRailInner` sticky offset (practice plans),
   and `chat.module.css` `--coach-topbar-h` (the chat box's viewport height calc). Any height change —
   including a *dynamic* one — reaches all three.
5. **The masthead must return a fragment from the team layout** and stay a direct child of `.coachesMain`
   (sticky pin + padding-cancelling negative margins).
6. **The finished-season variant is load-bearing.** Per CLAUDE.md, the masthead's `Complete` chip is the
   ONLY place the portal names a finished season; the page-title chip was deleted 2026-08-16.
7. **Standalone team workspaces render no eyebrow** (`isTeamWorkspace` → no org line), so any change to the
   eyebrow is a club-org-only change.
8. `.teamHeaderCollapsed` already exists and is phone-only. Desktop non-collapse was an explicit owner call
   (2026-08-02, "same owner call as admin").

---

## 4. ⚠ Conflict register — what each direction re-opens

### The Variant B decision (2026-08-17) — **not** the conflict here
`design_decisions.md` 2026-08-17: *"Variant B (a one-line quiet org whisper above the switcher) was
offered and NOT chosen"*, accepting that Notifications and the team-picker hub carry **no org line**.
Directions A, B, C and E do not touch the sidebar and do not add an org line to non-masthead pages.
**No conflict.**

### The real conflict: the identity strip (2026-08-02) — **Direction D**
`docs/projects/archive/COACH_PORTAL_DESKTOP_SHELL_PLAN.md` §D2:
> *Rejected shapes (do not re-propose): single-line identity strip (stutter ×3 on workspace teams);
> DOM-mirrored page title (thin echo of the h1).*

Direction D **is** that shape. Honest caveat for the owner: **one of the two original reasons has
decayed.** The "stutter ×3" arithmetic counted the sidebar header's org line, which the 2026-08-17
slimdown deleted. The ruling nonetheless stands, and constraints 1–4 and 6 above are independent of the
stutter argument. Reversing it should be a deliberate act, not a side effect of a space exercise.

### A one-clause adjustment: masthead hierarchy — **Direction B**
`design_decisions.md` 2026-08-02 fixes the masthead as `eyebrow → name → meta`, three levels.
Direction B folds the eyebrow into the meta line. Hierarchy survives at two levels (the team name is
still the one confident line) and nothing is removed, but this is a change to a ruling.

### Adjacent but untouched: the page-header ruling (2026-08-11) — **Direction E**
Direction E changes *density only* — tile size, title size, gap. Every slot, every position and the
"no subtitle slot exists" construction are unchanged, so the ruling's substance is intact. It touches
all ~40 screens, which is why it wants its own session.

---

## 5. Directions

### A — the masthead collapses on desktop too  ✅ recommended
Extend `.teamHeaderCollapsed` above 900px. At scroll top: unchanged. Past the 64/12 hysteresis: a single
~40px line — team name left, live status right (**more generous than the phone**, which drops to the bare
name; there is horizontal room on desktop and status is the bar's most perishable content).
Finished season collapses to team name + `Complete`.

- **Gain:** −34px of permanently-pinned chrome while scrolling; 0 at rest; 0 on phone (unchanged).
- **Rulings reversed:** none. Adjusts one small 2026-08-02 call ("desktop keeps the full masthead").
- **⚠ Must check:** `--coach-header-h` now changes *during* scroll. `chat.module.css` sizes the chat box
  from it (chat likely never scrolls the document, so it may never fire — prove it, don't assume);
  `.ppRailInner`'s sticky offset would shift mid-scroll on practice plans; `.collapseSection`
  scroll-margin is only read at deep-link time (safe, but re-verify `?section=`).
- **⚠ Also:** the scouting nudge row already hides when collapsed on phone — same rule applies here, and
  a coach who scrolls past a game-day nudge on desktop loses it until they scroll back up. Acceptable
  (it is a reminder, not a control), but state it.

### B — two lines, not three  ✅ recommended, stacks with A
`.teamHeaderEyebrow` moves from its own line into `.teamHeaderMeta` as the first segment:
`U13 Rockets [Head Coach]` / `Riverdale Ridge · 2026 Season · 12–4–1`.

- **Gain:** −11px everywhere, at rest, both devices. **Fixes the 98px closed-season phone bar** (→ ~72px)
  because `Complete` + `Final 2–1–1` stop being pushed onto a third line.
- **Rulings adjusted:** the three-level masthead hierarchy (§4).
- **No change for standalone team workspaces** (no eyebrow to fold).
- **⚠ Check:** the meta line's `> span + span::before` dot separator must not orphan a dot when the
  eyebrow is absent (workspace orgs) — the existing between-siblings construction already handles this,
  confirm rather than assume.

### C — the role stops being said twice  ✅ recommended, independent
Delete `.sidebarSectionLabel` "Assistant Coach" from `CoachesSidebar`; keep the masthead chip.

- **Gain:** de-duplication only, no pixels.
- **Why this way round:** the chip is always visible, sits beside the team the role belongs to, and is
  the only thing explaining an assistant's missing doors *on a phone* (where the sidebar does not exist).
- **⚠ Check:** `check:layout` rail keys shift again (they already owe a re-baseline from §55).

### D — team identity moves into `CoachTopStrip`  ❌ not recommended
- **Gain:** −74px desktop, **0px phone**.
- **Costs:** constraints 1, 2, 3, 4 and 6 all bite. Two implementations of one identity; the status line
  becomes either a per-page client fetch or new plumbing; the nudge row and the game-day console link
  have no home in a 48px strip; non-team pages (hub, notifications) leave the strip half-empty or show a
  stale team.
- **⚠ Reverses the 2026-08-02 "do not re-propose" ruling** (§4).

### E — page-title band density  ⏸ biggest number, own session
`.headerIcon` 48→36px, `.pageTitle` 1.75rem→~1.4rem, `.pageHeader` margin-bottom 2rem→1.25rem.
Slots, positions, phone grid and the no-subtitle construction all unchanged.

- **Gain:** ~−28px desktop, similar on phone. Larger than A and B combined at rest.
- **Reach:** all ~40 screens + the `nested` and `embedded` variants. Needs its own mockups, its own
  `check:layout` sweep and its own owner walk.

---

## 6. Arithmetic

| Combination | Desktop at rest | Desktop scrolling | Phone | Ruling reversed? |
|---|---|---|---|---|
| A | — | −34px | — | no |
| B | −11px | −11px | −11px (−26px closed-season) | adjusts one |
| A+B | −11px | −45px | −11px (−26px closed) | adjusts one |
| A+B+E | −39px | −73px | −35px | adjusts one |
| D | −74px | −74px | **0px** | **yes (2026-08-02)** |

**Recommendation: A + B now, C alongside, E as its own decision.**

---

## 7. Open decisions for the owner

1. **Is D closed?** One of its two original reasons has decayed. Confirm it stays closed, or reopen it
   knowingly.
2. **Does the collapsed desktop bar keep the status line**, or match the phone's bare-name treatment?
3. **Is the club name on line two acceptable** (Direction B)?
4. **Does E get its own session** with its own mockups?

---

## 8. Build outline — only if A+B+C are approved

Not a commitment; sequencing so the estimate is honest.

1. `CoachTeamHeader.tsx` — the phone-only `matchMedia('(max-width:900px)')` guard in the collapse
   evaluator becomes width-independent; collapsed desktop keeps `.teamHeaderRight` (phone still hides it).
2. `coaches.module.css` — `.teamHeaderCollapsed` rules move out of the `≤900px` block; desktop-specific
   collapsed geometry added; eyebrow relocated into `.teamHeaderMeta` (B); `.sidebarSectionLabel`
   assistant row deleted (C).
3. **Prove the three `--coach-header-h` consumers** (chat, practice-plan rail, `?section=` deep links)
   behave with a height that changes mid-scroll. This is the one place this change can break something
   a screenshot would not show.
4. Gates: `npm run verify:changed`; `npm run check:layout` scoped to the screens the changed classes
   reach (chat, practice plans, a `?section=` page, season-end, Overview, Schedule) at 1440 **and** 390;
   `check:layout` re-baseline (already owed from §55).
5. Demo sandboxes: the coach tour narrates screens, not chrome heights — re-read the tour steps for any
   sentence about the team bar before calling it done.
6. Help docs: the guide describes the bar's contents, not its scroll behaviour — check, likely no change.
7. `/simplify` is **not** indicated (no new abstraction); `/review` is (shared shell CSS + a behaviour
   that reaches three other surfaces).
8. Owner QA ledger: new section; then commit on `dev` with per-action confirmation.

---

## 9. What was NOT proposed, deliberately

- **No org line on the sidebar or on non-masthead pages** — that is Variant B, decided 2026-08-17.
- **No season dial, no second nav, no per-screen finished-season branch** — the standing rulings hold.
- **No removal of the club eyebrow.** B moves it; it is still on every team page. Deleting it would leave
  a multi-org coach with no club name anywhere in the premium portal.

---

## 10. ⚠ DIRECTION D IS NOT CLOSED — owner ruling 2026-08-18

The owner approved A/B/C/E and explicitly **declined to close D**:

> *"don't close D forever, I am reconsidering. let's see how this solution goes but I am not opposed to
> revisiting moving to the single header."*

**What this means for the next session that touches this area.** The 2026-08-02 *"do not re-propose:
single-line identity strip"* is **no longer a standing bar** — it is a decision the owner has put back
on the table, pending how A/B/C/E feel in use. Proposing D again is legitimate. Proposing it *without
the costs below* is not.

**What must be re-answered if D comes back** — none of these were resolved by this pass, and all five
are independent of the "stutter ×3" argument that decayed with the 2026-08-17 slimdown:

1. **The phone.** `CoachTopStrip` is `display:none` at ≤900px. D saves **0px** there and leaves the
   portal with two implementations of one identity. What is the phone's answer?
2. **The status feed.** It is SSR'd once per team-section entry from the team layout — the first place
   `teamId` exists server-side. The strip mounts above that. Either a per-page client fetch (which the
   A2 design deliberately avoided) or a new server-side bridge. Which?
3. **The canonical record.** Owner ruling 2026-08-02: the record reads the same on every device and
   ignores the per-device "count scrimmages" switch. Two implementations make that a discipline again
   rather than a construction.
4. **Two homeless pieces.** The game-week scouting nudge (an attached second row) and the game-day link
   into the bench console. Neither fits a 48px strip.
5. **Pages with no team.** The team-picker hub and Notifications. A strip that changes shape as you
   navigate, or one showing the team you just left. (This is the one place D's question touches the
   2026-08-17 Variant B decision, which otherwise it does not.)

**And one thing D now has to beat rather than merely improve on:** the chrome it would replace is
**88px while scrolling**, not 122px. Its −74px headline was measured against the old bar.

**What would make D cheaper**, if it is revisited: A has already proved the bar can carry its identity
in **40px**. A "one bar" that is the top strip and the team bar *merged at that height* — rather than
identity crammed into the existing 48px strip — is a different proposal from the one rejected in August,
and the one worth mocking first.

---

## 11. `/review` — standard tier, 3 lenses, 2026-08-19

**Gate:** typecheck ✓ · lint ✓ · check:demos ✓ (2 presentable) · check:layout ✓ · migrations n/a ·
`verify:changed` ✗ **on four `#f87171`/`#10151c` literals that belong to another session's
money-filter + register work in the same stylesheet** (grown from 3 to 4 during this session — that
work is still in flight). Not this change.

**Lenses:** correctness/logic · CSS cascade + blast-radius · accessibility/content-loss.
**12 raw findings → 7 after dedup → 4 confirmed → 2 fixed, 1 owner-ruled, 1 accepted.**

### ⚠⚠ FIXED — the nested drill-in header had NEVER overridden anything (pre-existing, since 2026-08-14)

`.headerIconNested` and `.pageTitleNested` were declared **above** `.headerIcon` / `.pageTitle`.
Both classes land on the SAME element (`headerIcon headerIconNested`), the selectors tie on
specificity (0,1,0), so **the later rule wins and the nested values were dead**. A drill-in header
rendered at exactly the hub header's size — 48px/1.75rem before this pass, 36px/1.4rem after it.

**Measured, not reasoned** (Money → Fundraisers → one fundraiser, 1440):

| | before the fix | after the fix |
|---|---|---|
| h1 "Money" | 22.4px / 900 / 36×36 tile | 22.4px / 900 / 36×36 |
| h2 "Chocolate sale" (nested) | **22.4px / 900 / 36×36 — identical** | **17.6px / 800 / 28×28** |

⚠ **`.pageHeaderNested`'s margin was the ONE of the three that always worked** — it happened to sit
below its base rule. That accident is why the shape looked half-right for five days and why the
comment this pass added ("the step between them is preserved") read as plausible. It wasn't: one
review lens *believed that comment* and computed a 27% size gap that did not exist. **A comment is
not evidence; the rendered page is.**

**Fix:** all three nested rules moved below the base rules, with the trap written into the CSS so a
fourth nested override cannot repeat it. The parent/child hierarchy renders for the first time.

### ⚠ FIXED — collapsing pulled the floor out from under keyboard focus (new on desktop)

Two controls live inside regions the collapse hides (the public-site flip, the book nudge's dismiss
button). A keyboard user focused on one who then scrolls — space, PageDown, arrows, a screen
reader's own scrolling — had that control `display:none`'d underneath them, which drops it from the
accessibility tree **and** from focus: the browser silently resets to `<body>` with nothing to say
where focus went. This existed on phones from 2026-08-02 and was never caught; extending collapse to
desktop is what made it worth fixing, not what caused it.

**Fix:** when a collapse hides the focused element, focus lands on the bar itself (`tabIndex={-1}`,
`preventScroll`). Three cases proven in a browser:

| case | result |
|---|---|
| focus inside a region the collapse hides | → lands on the bar (repaired, not lost) |
| focus outside the bar (a nav link) | → untouched; the bar does **not** steal focus |
| focus on something that survives collapse (the team name) | → focus kept |

### OWNER-RULED, no change — the role is stated nowhere on desktop while scrolled

The a11y lens's sharpest finding, and structurally correct: **two changes in this pass that each look
safe alone combined to remove the only copy.** Direction C deleted the rail's "Assistant Coach"
heading *because* the masthead chip says it — and direction A made that chip hide on scroll.

⚠ It also means the justification given to the owner for C ("the chip is always visible") was
**stronger than the facts support** — always visible *at rest*, not always. That correction was put
to the owner, who ruled: *"we don't need that role badge on the side nav, users know what role they
have and don't need to be reminded every day."* **Accepted, no code change.** Desktop now matches the
phone, which has behaved this way since 2026-08-02.

### ACCEPTED — club, season and record hidden while scrolled

Flagged as content loss; it is the approved behaviour of direction A, restored by scrolling up, and
what phones have done since August. Recorded as a deliberate tradeoff, not a defect.

### Dropped / refuted

- The meta-line separator was probed across all six combinations of club/season/record
  present-or-absent — **no stranded dot, no wrongly-visible empty row.** Confirmed, not assumed.
- "Heading hierarchy holds up, 27% gap" — **refuted by direct measurement** (the gap was 0%).
- Team-switch collapse flash + scroll-restoration flash: real, cosmetic, self-correcting. Not fixed.

### Post-fix rendered gate

Scoped sweep over the two nested-variant screens plus their hubs. Every new finding is a rail item,
a top-strip door, a nav-group heading or a long-standing 33–34px page action button. **Not one names
`.pageTitle`, `.headerIcon`, `.pageHeader` or any `teamHeader*` element.** ⚠ `coach-sponsor` carries
**zero** baseline entries — it was added to the sweep after the 2026-08-17 18:54 baseline — so all 36
of its findings are "new" by construction. Re-baseline still owed, still not ours to take.

---

## 12. ⚠⚠ DIRECTION A REVERTED — owner ruling 2026-08-19

> *"I want to revert one thing, I like the size changes we made but you can leave this header as is
> when scrolling."*

**The desktop masthead does not collapse.** The `matchMedia('(max-width: 900px)')` gate and its
breakpoint listener are restored, and every `.teamHeaderCollapsed` rule is back inside the ≤900px
media query. **The phone is untouched** — it collapses exactly as ruled 2026-08-02 and QA'd at §55.

**B, C and E stand unchanged.** The revert is scoped to the collapse alone.

### Measured after the revert

| | before the pass | after (final) |
|---|---|---|
| Desktop — chrome above first content, **at rest and scrolled** | 234px | **190px** |
| Desktop — pinned chrome while scrolling | 122px (48 + 74) | **106px** (48 + 58) |
| Desktop — team bar, any scroll position | 74px | **58px** |
| Phone — chrome above first content | 208px | **188px** |
| Phone — team bar at rest / collapsed | 72 / 36px | **56 / 36px** |
| Page-title band (desktop) | 80px | **52px** |

Verified: desktop reads 58px collapsed=false at scroll 0 and at scroll 500; phone reads 56px → 36px
collapsed=true. `--coach-header-h` is a stable 58px on desktop again, so the chat box and the
practice-plan rail no longer see a height that moves mid-scroll at any width above 900px.

### ⚠ Direction A is now DATA, not a live proposal

It was built, measured (−34px of pinned chrome), reviewed and rejected **on sight**. Do not
re-propose a desktop collapse as a space saving. The owner's distinction is the durable part:

> **Space taken by making a thing SMALLER is kept. Space taken by making a thing DISAPPEAR AND COME
> BACK is borrowed.** Everything that survived this pass is the first kind.

### ⚠ Two things the reverted experiment left behind — both KEPT

1. **The focus repair** (§11). A collapse that hides the focused control drops focus to `<body>`.
   That is a **phone** bug, live since 2026-08-02; the desktop version is only what made a reviewer
   look at it. Reverting the exposure does not unfix the bug.
2. **The nested-header cascade fix** (§11) — same review, unrelated to the collapse, repairs a shape
   that had never once rendered correctly.

### ⚠ Consequences for what this plan claims elsewhere

- §5's direction A entry, §6's arithmetic table and the "AS BUILT" table at the top all describe the
  pre-revert build. The table in this section is the current truth.
- The §10 note that **D must now beat 88px is WRONG** — the figure is **106px**. D's original −74px
  headline was measured against 122px; against 106px the remaining prize is smaller again.
