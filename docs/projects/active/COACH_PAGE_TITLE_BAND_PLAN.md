# Coach portal — the page-title band on a phone

**Status: ✅ RULED · ✅ BOTH PASSES BUILT ON DEV 2026-08-25 · ✅ OWNER QA PASSED 2026-08-25 (§100, no defects). No migration. Awaiting release only.**

---

## AS BUILT — measured on the running dev build, not asserted (2026-08-25)

Playwright over the real coach fixture, computed geometry at nine widths on four screens plus eight
actionless ones. **Every figure below was read off the build; the "before" column is the 2026-08-24
measured baseline.**

| at 390px | band before | band after | masthead | **net** |
| --- | --- | --- | --- | --- |
| **Overview** | 116 (44 + 12 gap + 44 + 16) | **56** (44 + 12) | 56 → 59 | **−57px** |
| A screen with a corner action (Roster · Schedule · Money) | 60 (44 + 16) | **56** (44 + 12) | 56 → 59 | **−1px** |
| A screen with no header action (Documents · Staff · Lineups · Insights · Practice plans · Tryouts · Settings) | 60 (44 + 16) | **48** (36 + 12) | 56 → 59 | **−9px** |
| **Desktop 1440** | 52 (36 + 16) | **52** — unchanged | 58 → 58 | **0px** |

⚠⚠ **I OVERSTATED THE "?" MOVE AND THE MEASUREMENT CAUGHT IT. IT IS WORTH 0px ON MOST SCREENS, NOT
8px.** §5 claimed *"8px on a phone: 44 → the 36px tile floor"*. That is only true where the band has
**no action**. Where a create sits in the title corner — Roster, Schedule, Money, and now Overview —
**the 44px action button still sets the floor**, so removing the 34px "?" changes nothing at all.
The 8px lands on the eight actionless screens and nowhere else. **The corrected claim: the "?" move
buys 0px on a corner-action screen, 8px on an actionless one, and 0px on every desktop.**

⚠⚠ **AND THE PHONE MASTHEAD GREW 3px (56 → 59), WHICH EATS THE TRIM ON MOST SCREENS.** A 44px tap
target in a row whose text stack is ~41px makes the row 44px. That is the honest price of the
ruling's own tap floor and it is not avoidable while the "?" is a 44px circle. **Net effect on an
ordinary corner-action screen is therefore −1px — effectively flat.** The wins that survive are
**Overview (−57px)**, **the actionless screens (−9px)**, one findable home, and the desktop's
permanently-visible help door. ⚠ **Do not quote "4px a screen" from §3 without this line.**
*Not taken, deliberately:* trimming the masthead's phone padding 0.45rem → ~0.3rem would return the
3px and more, but it re-tightens a bar the owner signed off twice in eight days. **Owner's call, not
a fix to slip in behind an approved one.**

**Proven by measurement, each a thing the plan said must not be assumed:**
- **The desktop win is real.** At 1440, scrolled 600px: masthead 58px, **"?" still VISIBLE**. At 390
  scrolled 700px: bar collapses to **36px, "?" hidden** — exactly as ruled.
- **The 900–1100px band is CLEAR.** The masthead row measures **41px — one line — at 900, 1000,
  1100, 1280 and 1440** with name + role left and status + flip + "?" right. No wrap, no sideways
  scroll at any width on any screen measured.
- **Tap floor honoured, tablet unchanged.** The "?" is **44×44 at 361/390/640** and 34×34 at
  ≥768 — identical to what the band gave it, since the band's 44px rule was also ≤640 only.
- **The no-host fallback works.** `/coaches/link-org` (outside the team layout) draws its own
  **44×44** "?" in the band, `aria-label="Help: Link Organization"`. Notifications and the team
  picker never had one and still do not.

⚠⚠ **ONE REGRESSION WAS INTRODUCED AND CAUGHT BY MEASURING — WORTH MORE THAN THE FEATURE.** Reserving
44px on the masthead row (to stop the "?" shifting the bar after hydration) also reached the
**collapsed** bar, taking a scrolled phone from its ruled **36px to 55px** — a 19px permanent cost on
every scrolled phone screen, to buy back 8px on a few unscrolled ones. `.teamHeaderCollapsed
.teamHeaderRow { min-height: 0 }` fixes it; re-measured **36px at 361/390/640/768/900**.
**Generalise: a reservation added for one state of a bar applies to ALL of its states.**

**Gates:** typecheck ✓ · lint 0 errors ✓ · unit **2455/2455** ✓ · `verify:changed` full chain ✓
(CSS-module purity 252 sheets, spelling, palette + text contrast, dictionary, schema parity, demos
presentable) · `check:layout` on coach-overview/roster/schedule/team-hub/money ✓ **no new findings**.

⚠ **The six layout findings this raised were PROVEN pre-existing, not assumed.** Two are the season
setup chip at ≥768 (32px), already baselined **with a reason that names this exact cause** —
*"re-keyed by the shared-header migration (… gained a real accessible name)"* — so the entries were
re-keyed and the reason carried forward. Four are the **21px `Season insights` body link**, already
baselined at 361 **with no reason**, now also reproducing at 390/768; recorded **unargued on
purpose** — the unexplained count is the instrument that sizes the touch-target debt, and
bulk-writing reasons to close entries is what that plan forbids. ⚠ Nothing in this pass touches that
link; it is debt, recorded, not fixed.
⚠ **12 baseline entries no longer reproduce and were deliberately NOT pruned** — they are the
portal tour's buttons, absent only because the fixture has dismissed the tour. Pruning a
fixture state would make them "new" the next time a fresh fixture shows the tour.

---

> **Owner, 2026-08-25:** *"I like your recommendations for trimming and moving the help icon (1 and
> 3). the only question I have for option 4 is would naming that nav icon where the user is in cause
> confusion as to where the more menu is? can you let me know of another app that you are aware of
> that behaves this way effectively?"*

**The honest answer was no, and option 4 was withdrawn on the strength of it — see §5.**

Mockup (interactive: option × width × skin, self-measuring, all five header shapes):
https://claude.ai/code/artifact/972ab843-5972-458c-91ca-bf7f2e990d70
Source: `COACH_PAGE_TITLE_BAND_MOCKUP.html` (same folder).

Trigger: `COACH_PAGE_TITLE_BAND_DESIGN_PROMPT.md`, written out of the 2026-08-24 Roster phone-chrome
pass, which measured the band and deliberately did not touch it because changing it is a decision
about all ~40 coach screens.

**PM brief:** `COACH_PAGE_TITLE_BAND_PM_BRIEF.md`.

---

## §0 · The ruling

**Keep the band. Trim its margin 16px → 12px portal-wide, and fix Overview's setup chip so Overview
stops costing 116px** (option 1). **Move the help "?" into the masthead's corner AT EVERY WIDTH, rendered LAST** (option 3),
framed as **help placement, not as space**. What it buys is a permanently-visible contextual help
door on desktop plus one findable home at both widths.
**Not the top strip** — settled boundary, §5. **Phone-only would have broken *"one findable home"*.**

⚠ **The pixel figure written here at ruling time — "8px on a phone, 0px on desktop" — was WRONG and
the build measured it so. It is 0px wherever the band has an action, 8px only on the eight actionless
screens, and the phone masthead takes 3px back. See AS BUILT above; do not quote 8px from this
section.**

**Not built:** option 2 (fold the page name into the masthead) — §4.
**Withdrawn:** option 4 (the fifth nav tab naming its section) — §5.

---

## §1 · Measured ground truth

Read from `coaches.module.css` + `CoachPageHeader.tsx` and re-measured live inside the mockup.

| piece | phone (390) | desktop (1440) | who sets it |
| --- | --- | --- | --- |
| band box | **44px** | 36px | the help "?" tap floor (`min-height`/`min-width: var(--tap-min, 44px)`) |
| next floor down | 36px | 36px | `.headerIcon` tile |
| the `<h1>` alone | ~25px | ~25px | Barlow Condensed 1.4rem / line-height 1.1 |
| bottom margin | 16px | 16px | `.pageHeader { margin-bottom: 1rem }` |
| **typical total** | **60px** | 52px | |
| **Overview** | **116px** | 52px | 44 title row + 12 row-gap + 44 actions row + 16 margin |

⚠⚠ **THE TITLE TEXT IS ABOUT A QUARTER OF THE HEIGHT IT IS BLAMED FOR.** Deleting words saves
nothing. Only moving *controls* moves the number, which is why the 2026-08-18 pass took desktop from
80px to 52px and the phone by only −4px.

⚠ **The 44px floor is not reopenable for 4px.** It is the portal's ratified tap minimum
(`--tap-min`), and the "?" was widened to a 44px *circle* only two days ago (2026-08-23, §80 walk)
after shipping as a 34×44 oval. Shrinking it back is a regression wearing a space-saving's clothes.

---

## §2 · Overview is the biggest number, and it is a one-screen fix

Overview passes `actions={renderSetupChip()}` — a `Season setup · ring · 4/5 · ▾` disclosure roughly
145px wide. At 390px it cannot share the title line with "Overview" + two chips + the 44px "?", so
`.pageHeaderStd`'s phone grid drops it to row 2. That row, plus its 12px gap, **is the whole 56px
gap between Overview and every other screen.**

**The fix already exists and was ruled two days ago.** House rule 3 (2026-08-23): *on a phone, words
become symbols; the words survive as the accessible name.* The chip's symbol is already drawn — it
is the progress ring. Ring-only + `aria-label="Season setup, 4 of 5 done"` + `actionsPhoneInTitleRow`
puts it in the title-line corner beside the "?", exactly as the Money hub's Record "+" does.

- **Overview 116px → 60px** (→ 56px with the §3 margin trim).
- ⚠ **The chip anchors a popover** (`setupChipRef`). It must stay a real positioned element; do not
  swap it for a plain button, and re-check the popover's alignment against a 44px anchor.
- ⚠ **`setupChipQuiet`** already suppresses the `4/5` count in one state. The symbol form must read
  correctly in both — a ring with no count and no words needs its aria-label to carry the state.
- ⚠ **Not shown once setup completes** (`showSetupChip`), so this is the *first-run* screen. That
  makes it more worth fixing, not less: it is the shape a brand-new coach meets first.

---

## §3 · The margin

`.pageHeader { margin-bottom: 1rem }` → `0.75rem` at ≤640px. **4px on every screen.** Small, free,
and the honest size of the portal-wide half of this proposal. Below 12px the band starts crowding
the toolbar beneath it.

⚠ Keep `.pageHeaderNested`'s own `0.75rem` unchanged — it is already at the proposed value, and it
is the one nested override that has always worked (the other two were dead for months).

---

## §4 · Why option 2 is not recommended

Folding the page name into the phone masthead saves the most — ~60px on every screen — and it is the
one I would not build. Four reasons, in descending weight:

1. **⚠⚠ THE EMPTY SLOT WAS NOT EMPTIED BECAUSE IT WAS SURPLUS.** The prompt frames the masthead's
   free right half as *"real estate that did not exist when this question was last considered."* It
   was emptied on 2026-08-24 **because a short status string could not be made to fit there** — two
   separate shrink attempts failed, one ending in `6:30 p.m. · O…`, and that failure is the evidence
   that produced the removal ruling. Filling it with a page name asks the same 390px row to do the
   thing it was just proved unable to do.
   *Honest counter, stated rather than hidden:* the failed string was an **unbounded** one (opponent
   names); a page name comes from a **closed set of ~40 known strings**, longest ≈ 14 characters
   ("Practice plans", "Skills & Goals", "Email families"). That distinction is real. It does not
   rescue the proposal, because —
2. **The team name becomes the compressible half.** The team name is the unbounded segment, so it is
   what ellipsizes to make room. **An identity bar whose identity gives way to a page name has
   stopped being an identity bar.** Visible in the mockup at 390px on a long club/team name.
3. **The phone masthead collapses on scroll** to a bare team name (36px, ruled 2026-08-02, QA §55).
   A page name living there vanishes and returns — **exactly the borrowed space the owner rejected on
   sight on 2026-08-19** — unless the collapse ruling is changed in the same pass to keep the page
   name. Today's band scrolls away honestly, as page content.
4. **The plumbing is a forty-screen change.** The title is written by the page; the masthead by
   `teams/[teamId]/layout.tsx`. Every page must publish its name upward, and three sub-shapes need
   their own answers: the `nested` drill-in (whose `h2` stays in the body), the `embedded` hub tab
   (no identity at all), and the accessible `<h1>` (a visually-hidden one is legitimate but must be
   *stated*). Above 900px nothing changes, so the portal would carry two header shapes and two rules
   for where a page name lives.

⚠ **This is not direction D and must not be confused with it.** Direction D merges `CoachTopStrip`
into the masthead — a *desktop* saving (the strip is `display:none` ≤900px) carrying the five
conditions in `COACH_HEADER_VERTICAL_SPACE_PLAN.md` §10. Option 2 is a *phone* proposal. D remains
open by owner ruling 2026-08-18 and is untouched by this session.

---

## §5 · The other two options, and what they are actually for

### Option 3 — the help "?" moves to the masthead's corner  ✅ APPROVED 2026-08-25, **AT EVERY WIDTH**

> **Owner, 2026-08-25, second pass:** *"if we are going to move the help icon on mobile, should we do
> the same on desktop and judge over the 'next up' section slightly? or we can put it in the top nav
> next to the account icon?"*

⚠⚠ **THE QUESTION CAUGHT A DRIFT IN WHAT I HAD PROPOSED, AND IT WAS APPROVED PHONE-ONLY.** The
2026-08-11 ruling states the "?" is chrome with *"its own slot, always LAST, top-right **at every
width** … one findable home."* **A phone-only move gives it TWO homes and breaks that clause.**
**RULED: it moves at every width, and it is rendered LAST in the masthead's right slot** — after the
status stack and after the public-site flip — so *"always last, top-right"* stays literally true
rather than approximately true.

⚠⚠ **AND THE TOP STRIP IS RULED OUT ON A SETTLED BOUNDARY, NOT ON TASTE.** `CoachTopStrip`'s own
docblock states its rule: *"The strip keeps only genuine leave-this-place doors (wordmark · account ·
workspaces); chat is a section of the work, not an exit."* **The chat door was REMOVED from that
strip by owner ruling 2026-07-31** for exactly the two faults a "?" would repeat: it is not an exit,
and it duplicated a door already reachable at the same width. ⚠ **`CoachesSidebar` already carries a
`Help` item** (`{base}/help`, bottom of the rail) — so a "?" beside the account icon would be a
**second desktop help door within ~200px of the first**, which is precisely the no-duplicate-doors
principle the strip's rule exists to hold. **Do not re-propose the top strip for this.**

⚠⚠ **AND I HAD TO CORRECT MY OWN JUSTIFICATION.** I sold this option on *"help stops scrolling
away."* **That is true on DESKTOP and false on a PHONE.**
- **Desktop:** the masthead never collapses (ruled 2026-08-19, built-measured-reverted). The "?"
  becomes permanently visible, and the band's height is set by the 36px tile, so removing the 34px
  "?" costs **0px** — **desktop is a pure win at zero cost, and it is where this option actually
  works.**
- **Phone:** `.teamHeaderCollapsed .teamHeaderRight { display: none }` at ≤900px. The "?" would
  **fold away on scroll anyway**. The 8px and the one-findable-home still land; the stickiness does
  not.
- **RULED: the "?" folds with the collapse on a phone like everything else in that slot** — no
  reopening of the 2026-08-02 bare-name collapse, which was re-affirmed on 2026-08-24 when the status
  slot came off. ⚠ A carve-out (the "?" surviving the 36px collapsed bar — it is a **control**, not a
  fact, and 34px fits) was **raised and left to the owner, deliberately not assumed**: I argued a
  carve-out to this same rule on 2026-08-24 and was overruled correctly.

- **Pixels: 8px on a phone, 0px on desktop.** Phone: 44 → the 36px tile floor, more only on the
  handful of screens with no actions at all. **Desktop: exactly zero** — the band is 36px tile +
  16px margin and the "?" is 34px, so removing it changes nothing. **Presenting this as a space
  saving would be dishonest at either width.**
- **What it actually buys: a permanently-visible contextual help door on desktop**, plus one
  findable home at both widths. ⚠ **See the correction above — the "sticky" half is desktop-only.**
- ⚠ **It does NOT collide with the sidebar's existing `Help` item, and moving it makes that better
  rather than worse.** Those are two different doors — the rail's goes to the full guide **page**,
  the "?" opens the in-context **drawer** at this screen's section. Today they sit at similar
  heights on opposite sides of the content; in the masthead the "?" is a row up and clearly part of
  the bar, which reads less like two spellings of one thing.
- **Why a "?" may sit in an identity bar and a "+" may not.** A "?" means the same thing on every
  screen in the product — *help with what I am looking at*. A page-scoped create inside a bar
  reading "U13 Rockets" cannot tell a coach whether it adds a player, an event or a transaction.
  **The create stays in the band. That asymmetry is the whole reason option 3 is not option 2.**
- **Plumbing is modest and half-built.** `HelpDrawerContext` already exists portal-wide with
  `openHelp(req)`; only the page's `HelpRequest` needs to reach the masthead — a registration hook,
  not a new provider. ⚠ The `nested` variant already ignores `help` by construction; keep that.
- ⚠ Also drops `.headerIcon` on a phone in the drawn version, which is what takes an actionless band
  down to a text row. That is a separate sub-decision and should be ruled separately.

### Option 4 — the fifth nav tab names the section you are in  ❌ WITHDRAWN 2026-08-25

Proposed by this session, questioned by the owner on the same day, and withdrawn on the evidence.
**It was my proposal and it does not survive its own follow-up question.** Recorded in full because
the reasoning generalises to any future change to that bar.

⚠⚠ **THE "YOU ARE HERE" SIGNAL IS ALREADY BUILT — TWICE — SO THE RENAME WAS THE ONLY THING BEING
ADDED, AND THE RENAME IS THE RISKY HALF.** `CoachesBottomNav` already gives the More tab the full
active treatment inside a More section (`isOnTeamMore` → `styles.active`, `strokeWidth 2.5`, and the
`activeDot`), and the sheet already marks the current row (`styles.dropActive` on
`renderMoreItem`). **I proposed adding a signal the product already sends.**

⚠⚠ **NO EFFECTIVE PRECEDENT EXISTS, AND THE CANONICAL IMPLEMENTATION DOES THE OPPOSITE.** UIKit's
`UITabBarController` has auto-generated a More tab since 2008 for exactly this situation; **it keeps
the label "More" and the ••• glyph at all times** and puts the section's name in a **title bar at the
top of the content**. That is the same answer this plan reaches by a different route: *the page title
is how a user knows which More-section they are in.* Material Design's bottom-nav guidance agrees —
labels are short and **static**, because the bar trades on position + fixed label. Every overflow tab
I can point to (Teams, Amazon's "Menu", Slack, Apple Music) leaves it alone. The one genuinely
dynamic fifth tab in wide use is a **profile** tab showing an avatar: the *picture* changes, the
label ("You") does not.

⚠⚠ **AND IT WOULD HAVE ATTACHED A NUMBER TO THE WRONG NOUN.** The More tab carries the
**notification count** (`notifUnread`, bubbled up so a coach sees what is waiting without opening
the sheet). Renamed to "Money" while showing that pip, it reads as *two things waiting in Money*.
That is a defect, not a taste call, and no version of the rename avoids it.

**The owner's framing was the sharper one:** a coach standing in Money who wants Tryouts scans the
bar for the word "More" and finds the word for where they already are.

**Kept as data, not as a live proposal.** The measurement that killed it as a *replacement* for the
band stands and is worth preserving: `.label` is `0.6rem` (9.6px) uppercase with `0.05em` tracking,
`nowrap` + ellipsis, in a `flex:1` tab ≈74px wide at 390px — **Money, Lineups, Tryouts, Staff,
Documents, Settings and Insights fit; Practice plans, Skills & Goals, Email families and Tournaments
truncate.** ⚠ **Do not re-propose renaming that tab.** If a future session wants a stronger
"where am I" signal on a phone, the two existing highlights are the place to strengthen, and the
page-title band is the place the name belongs.

---

## §6 · Constraints this plan does not touch

Restated so a later session cannot reverse one by accident:

1. **All forty screens open the same way** (2026-08-11). §2 and §3 are density/symbol changes inside
   the existing slots — the ruling's substance is untouched, exactly as the 2026-08-18 pass was.
2. **No subtitle slot exists, by construction.** `.pageSub` and `.breadcrumb` are gone. Nothing here
   reintroduces one.
3. **The four action house rules (2026-08-23)** — §2 *applies* rule 3 rather than bending it.
4. **A page needs a heading.** The visible `<h1>` survives in every recommended option. Only option 2
   would have needed a visually-hidden one, and option 2 is not recommended.
5. **No scroll-away band** (2026-08-19). Nothing recommended here disappears and returns.
6. **The desktop masthead does not collapse** (2026-08-19). Untouched.

---

## §7 · Build outline — only if §0 is approved

**Pass 1 (small, one unit of work):**
1. `coaches.module.css` ≤640 block: `.pageHeader { margin-bottom: 0.75rem }`.
2. Overview `renderSetupChip()`: phone symbol form (ring only, `aria-label` carries "Season setup,
   N of M done"), `actionsPhoneInTitleRow` on its `CoachPageHeader`.
3. Re-check the setup popover's alignment against the 44px corner anchor at 361 / 390 / 414.

**Verification** (per `AGENT_VERIFICATION_WORKFLOW.md`): `verify:changed`, then a rendered
`check:layout` sweep on `coach-overview` + two typical screens at 361/390/768/1440.
⚠ **Re-measure Overview in the running build, not in the mockup** — the mockup's figures are its own
geometry, deliberately built from the real CSS values but not a substitute for the product.
⚠ **The `check:layout` baseline is currently another session's uncommitted work** (noted in the
Roster plan §3). Do not run `--init`.

**Documents to correct in the same unit of work** (the prompt's §"Measured facts" requires it):
- `COACH_ROSTER_PHONE_CHROME_PLAN.md` §4 — already corrected to 60/116 on 2026-08-24. ✅ verified.
- **Owner QA Ledger §93** — still quotes the superseded "~72px". **Correct to 60px typical /
  116px Overview.**

**Pass 2 — option 3, the help "?" into the masthead** (separate unit of work, because it touches
every screen's header call and the masthead at once):
1. A registration channel so a page's `HelpRequest` reaches the masthead. `HelpDrawerContext` already
   exists portal-wide with `openHelp(req)`; this is a hook, **not a new provider**.
2. `CoachPageHeader` stops rendering the "?" and registers instead. ⚠ Its `nested` variant already
   ignores `help` by construction — keep that, or a drill-in will register a second request over its
   hub's.
3. The masthead renders the "?" in its right slot **at every width, LAST** — after the status stack
   and after the public-site flip, so the 2026-08-11 *"always LAST, top-right"* clause stays literally
   true. ⚠ **The slot is shared with the public-site flip**, which the 2026-08-24 pass deliberately
   kept alive there — the "?" sits *beside* it, never replaces it, and a team with a public site must
   show both at 361px.
4. ⚠⚠ **MEASURE THE 900–1100px BAND BEFORE CALLING IT DONE.** At 1440 there is room. Between the
   `CoachTopStrip` breakpoint (900) and roughly 1100 the masthead now carries team name + role on the
   left and **three** things on the right (status stack, flip, "?"). **This is the exact narrow-row
   failure that took the status slot off phones on 2026-08-24 — two shrink attempts failed there.**
   Measure at 900 / 1000 / 1100 / 1280 / 1440 with a long club + team name; **do not assert it.**
   If it fails, the answer is a rule about which of the three gives way, decided from a measurement.
5. ⚠ **On a phone the "?" folds with `.teamHeaderCollapsed` like the rest of that slot** — ruled, and
   deliberately not carved out (see above). Nothing about the collapse changes.
6. ⚠ **Decide separately whether `.headerIcon` also leaves the band on a phone.** It is what takes an
   actionless band from 36px to a text row; it is a different question from where help lives, and it
   should be ruled on its own rather than ridden in on this pass.
7. ⚠ **A page with no help request must leave the slot empty**, not render a dead "?" — several
   bespoke screens are exempt from `CoachPageHeader` entirely, and the masthead is mounted by the
   team layout above all of them.
8. ⚠ **Do not touch `CoachTopStrip`.** Its "leave-this-place doors only" rule and the 2026-07-31 chat
   removal are the standing precedent; the sidebar's `Help` item is the duplicate that ruling guards
   against.

**Not built:** option 2. **Withdrawn:** option 4.

---

## §8 · What this session did NOT do, deliberately

- **No decision-log entry.** `memory/design_decisions.md` records decisions the owner has *accepted*.
  Writing one for a ruling that has not been made is the drift `AGENCY_RULES.md` warns about. The
  entry is drafted in the PM brief's closing section and lands the moment the owner rules.
- **No help-content or demo-copy sweep.** Neither is needed for a margin trim; **§2 changes what a
  coach sees on Overview at phone width**, so if it is approved, check `lib/help-content/coaches.tsx`
  for any sentence describing the season-setup chip's label, and the coach demo tour's Overview step.
- **Direction D untouched** (§4).

[[COACH_ROSTER_PHONE_CHROME_PLAN]] · [[COACH_PAGE_HEADER_CONSISTENCY_PLAN]] ·
[[COACH_HEADER_VERTICAL_SPACE_PLAN]] · [[COACH_HEADER_ACTIONS_CONSISTENCY_PLAN]]
