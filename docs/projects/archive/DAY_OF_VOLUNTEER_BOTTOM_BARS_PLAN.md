# Day-of volunteer shells — the two bottom bars (Option C)

**Status:** ✅ BUILT and **owner QA PASSED 2026-08-07** (ledger Group 3C / §7, all nine parts).
UNCOMMITTED on `dev`. Six defects were found and fixed during the run — four in the QA fixture,
two in the feature — see the ledger's pass note for the list.

All four open calls were answered the same day: Account as a sheet ✔, sign-out one tap deeper ✔,
single-duty two-tab bar ships ✔ — and the public-door question was answered twice, the second
answer overruling the first (§3.5).
**Surfaces:** `/{org}/scorekeeper` and `/{org}/check-in` (the twin day-of volunteer shells)
**Mockups:** Claude Artifact `2bf781e7-0977-4d4a-9432-733b72b81133` — *Scorekeeper: what goes at the bottom*
**PM brief:** `DAY_OF_VOLUNTEER_BOTTOM_BARS_PM_BRIEF.md`

---

## 1 · What was decided

A phone volunteer gets **two pinned bars** at the bottom of the screen:

| Band | Height | Contents |
|---|---|---|
| Filter sub-bar | ~46px | The surface's own status buckets, with counts |
| Tab bar | ~62px + safe-area | The duties this volunteer holds, plus Account |

And the header sheds what the bars now carry: the cross-role hop link and Sign Out.

Per surface:

| | Scorekeeper sub-bar | Check-in sub-bar |
|---|---|---|
| Buckets | To Score · Review · Final · All | All · Not arrived · Checked in · No-show |
| Source | `statusTabs` (relocated) | `CheckInBoard`'s `segmented` arrival filter (relocated) |

Tab bar, gated by the same capabilities the header links already use:

| Tab | Shown when | Goes to |
|---|---|---|
| Score | `submit_scores` | `/{org}/scorekeeper` |
| Gate | `check_in_teams` OR `manage_registrations` | `/{org}/check-in` |
| Account | always | the Account sheet (see §3) |

A single-duty volunteer therefore sees **two** tabs, not three. A permanently disabled tab
teaches nothing and invites a tap that does nothing; absence is the honest form. This is the
weakest case for the design and is called out for QA.

---

## 2 · Geometry is declared, never assumed

⚠ **This is the defect class this plan is most likely to reproduce.** The lineup-builder Undo bar
docked itself at the bottom of a screen and nothing else on that screen was re-derived against the
new budget — the bar landed *behind* the nav on every notched iPhone and two pop-ups lost their
primary button on six of eight phone sizes.

So the bars publish their height rather than each consumer guessing:

- One token for the composed bottom furniture (sub-bar + tab bar + `env(safe-area-inset-bottom)`).
- Everything that reaches the bottom of these two screens composes from it: the scorekeeper page's
  `padding-bottom`, the score sheet's backdrop padding, `InstallAppPrompt`, the check-in board's
  own list tail.
- Verified across notched and non-notched viewports before it is called done.

**Both bars are phone-only (≤640px)** — the same breakpoint the header rules added on 2026-08-07.
Above it the shells keep today's layout and the header keeps Sign Out and the hop link, because
there the row has room. The bars must not appear on a desktop volunteer screen.

---

## 3 · Account is a sheet, not a route (⚠ deviation from the approved mockup)

The mockup drew Account as a full screen. Proposed instead: a **bottom sheet over the board**,
matching `AdminBottomNav`'s existing More-sheet pattern.

Reasons: no new route on either shell; the volunteer never loses their place in a list they were
part-way down; no back-navigation question on a PWA; and the two shells stay byte-identical in
behaviour with one shared component. Visually it is what was drawn.

**Needs an owner nod before building** — mockups are the spec, and this differs from it.

Contents (all of which exist today, homeless or crowded):

- Who is signed in — name, email, and the duties they hold at this org. Matters on a shared or
  borrowed phone at a gate.
- Install this app (today: an interstitial prompt).
- Open the public site (today: the ⇄ pill — **stays in the header too**, it is the flip door).
- Sign out.

⚠ **Sign-out moves from zero taps to one.** It sits in the header today because a volunteer on a
borrowed phone must be able to end their session without hunting (J8-001 — it was a dead 404 link
before that). One tap behind a permanently visible, labelled tab is judged acceptable; if owner QA
disagrees the fallback is to keep Sign Out in the header at every width and let Account hold the
rest.

---

## 3.5 · The public-site door asymmetry (owner-raised 2026-08-07)

The scorekeeper header carries the ⇄ flip pill; the gate check-in header does not.

**What the record actually says.** The top-nav audit (D9, 2026-08-01) listed this as an
inconsistency and routed it to `/design` — its words were *"never considered, not ruled."* The
same day, a one-line rationale appeared in the check-in shell: *"deliberately carries NO ⇄ flip
door — a check-in board has no public twin to flip to — considered and declined."* **There is no
entry in `memory/design_decisions.md`.** So the comment is a guard against an eager "unification",
not a ruling.

**The rationale does not survive inspection.** The scorekeeper's flip does not resolve to a public
mirror of the scoring board — no such page exists there either. It resolves to the public side of
the *event* (schedule and scores). A gate volunteer stands at the same event and has a more
frequent reason to want it: "which field is U13 on?" is a gate question.

**Resolved 2026-08-07, in two steps — the second overrules the first.**

*First:* the Account sheet would carry **Open the public site** on both shells, so the door reached
the gate volunteer regardless, and no ⇄ pill was added to the check-in header.

*Then owner QA killed the row entirely,* on a plainer argument than the one that created it:
**a volunteer has no errand on the club's public HOME page.** It is a marketing surface. The door a
volunteer might genuinely want is a specific *event's* public schedule — "which field is U13 on?" —
which is a different destination, and is exactly what the scorekeeper's ⇄ pill already resolves to.

It was also, as built, a **dead end**: at a club that is not public the club root 404s by design,
and the QA club is private, so the row took a volunteer to ROUTE_NOT_FOUND. That is the house rule
in CLAUDE.md — hide the entry point rather than let it dead-end — and the row failed it.

**Where this leaves the asymmetry, stated plainly so it is not lost:** the scorekeeper has a public
door (the ⇄ pill, to an event's schedule); the gate shell now has **none**. That may be right — a
gate volunteer's job is the arrivals list — but it is now an open question rather than a settled
one, and it is the ORIGINAL D9 finding resurfacing. **Do not record it as decided.** If it is taken
up, the candidate is the ⇄ pill on check-in (an event schedule, useful at a gate), never the club
root.

The misleading "considered and declined" comment in the check-in shell has been replaced with what
was actually decided and when.

## 4 · What comes off the top of the scorekeeper

The buckets carry their counts into the sub-bar, which makes the three counter tiles
(To Score / Review / Final) a second copy of the same three numbers — so they go.

Date, search, field and division fold behind one **Filters** control. They are set once at the
start of a shift, not touched between games. The date stays visible in the collapsed row (it is
the one piece of state a volunteer must be able to confirm at a glance), and the control shows a
count when any filter is active so a filtered board can never look like an empty one.

**Net effect measured against today:** first game card moves from ~560px down the page to above
the fold on a 390×844 screen.

The check-in board's own top crowding (three gauges + search + division) is **out of scope for
this phase** — see §7.

---

## 5 · The shared-component constraint

`components/admin/CheckInBoard.tsx` is mounted by **two** surfaces: the volunteer gate shell and
the admin gate screen (`/{org}/admin/tournaments/check-in`), which already has `AdminBottomNav`.

Relocating its arrival filter into a pinned sub-bar must therefore be **opt-in per host**, never a
change to the board's default. The admin gate screen must render exactly as it does today —
two bottom bars stacked under an existing bottom nav would be three bands of chrome.

---

## 6 · Build order

1. **Shared bars** — one component pair (sub-bar + tab bar) in `components/volunteer/`, sitting
   beside `DayOfShellHeader.module.css`, so the twins cannot drift. Height token published.
2. **Account sheet** — shared by both shells; capability-aware identity block.
3. **Scorekeeper** — buckets into the sub-bar, counter tiles retired, filters folded, page padding
   re-derived from the token.
4. **Check-in** — arrival filter into the sub-bar via the new per-host flag; admin gate screen
   proven unchanged.
5. **Header cleanup** — hop link and Sign Out drop out below 640px on both shells (desktop keeps
   both).
6. **Geometry sweep** — notched/non-notched, score sheet, install prompt, both shells, both
   duty combinations.

## 7 · Explicitly out of scope

- The check-in board's gauges and toolbar crowding (its own pass, once this lands).
- Anything on the admin gate screen.
- Desktop layout on either shell.
- Any change to what a volunteer is allowed to do — this is chrome only, no capability or API
  change anywhere.

## 8 · How it gets verified

- Focused lint + typecheck on the changed files.
- `npm run check:layout` for the rendered rules that bite here: 44px tap floor on eight new
  targets, nothing trapped under fixed chrome, no sideways scroll.
- Owner QA on a real phone — **`OWNER_QA_LEDGER.md` § Group 3C (§7)**, nine parts, three seeded
  accounts. The two single-duty volunteers (`Dana Scorer`, `Pat Gate`) were added to
  `scripts/seed-qa-day-fixtures.mjs --cancel-lab` for it: no ROLE produces a single-duty
  volunteer, so that case had to be built with capability overrides or it could not be tested.

## 8.5 · What actually landed, and the one deviation found while building

Built as planned, with one desktop change the plan did not anticipate:

**The volunteer gate board's arrival filter is now a 4-across row at EVERY width**, not just on a
phone. It used to be an inline segmented pill on the right of the toolbar. Keeping both forms
would have meant two copies of the same four controls in the DOM driving one piece of state — the
sort of duplication that drifts. The row it becomes is exactly the shape the scorekeeper twin has
always had, so the two shells now present their buckets identically. **The admin gate screen is
untouched** (it never passes the opt-in, and its segmented pill renders exactly as before).

Verification run: focused lint (0 errors — 3 warnings, all pre-existing on untouched lines),
typecheck clean, colour-token guardrail clean (the new stylesheet joined the operator scope with
zero new literals), palette contrast clean, 1,439 unit tests green.

⚠ **The rendered layout sweep does not cover these two screens AT ALL** — checked, not assumed:
`check-layout-invariants.mjs` has zero references to either shell (its screen list is
coach-portal-only, the known coverage gap). Running it would be a false green for this change, so
it was not run. Its three most relevant rules are exactly the ones fixed bottom chrome breaks:
44px tap floor on eight new targets, nothing trapped under fixed chrome, no sideways scroll. Until
these screens join that list, **owner QA on a real phone is the only thing checking them.**

## 9 · Open questions carried into QA

1. Is a two-tab bar (Score + Account) worth 62px for the single-duty volunteer, who is the
   majority? If not, the fallback is: no tab bar for them, sub-bar only, Sign Out stays in
   the header.
2. Is sign-out at one tap acceptable at a gate on a borrowed phone?
3. Does the Filters fold cost more than it saves for a volunteer who works multiple fields and
   changes the field filter often?
