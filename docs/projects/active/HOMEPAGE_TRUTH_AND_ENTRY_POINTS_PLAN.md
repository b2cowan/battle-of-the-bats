# Homepage truth + entry points — Batch 1

**Status:** BUILT on `dev`, uncommitted. Owner QA pending. **Batch 1.5 (2026-08-08) built on top —
see the dated section below**: the marketing-wide sweep + the "live products lead" hierarchy.
**Date:** 2026-08-07
**Trigger:** owner, choosing badge copy for the demo doors — *"we need to fix that, the coaches
portal should have been updated to behave like the tournament."*
**Decision:** `BUSINESS_DECISIONS.md` 2026-08-07 (the homepage states availability, not the promo
calendar). **Mockups:** `claude.ai/code/artifact/93944bf1-2387-4c09-99fc-4e054fc8a10e`

---

## The finding

Verified against the **live production database and live pages**, not against plan headers:

| Surface | Said | Correct? |
|---|---|---|
| Checkout gate, live prod DB | Coaches Portal = `live`, opened 2026-07-24 01:13 UTC | the truth |
| `/for-coaches` | "Free until Jan 1, 2027" ×5, "Start free" ×8, "Coming soon" ×0 | ✓ |
| `/start` | "Coach a team · Free" | ✓ |
| `/pricing` | Founding Season promo + FAQ | ✓ |
| **Homepage persona card** | **"Coming soon · express interest"**, greyed | ✗ |

**Root cause, and the thing worth remembering:** every other surface *reads the plan gate*, so they
all flipped together the day the gate opened. The homepage was the single surface that **wrote the
answer down**, so it froze — and the highest-traffic page in the product spent two weeks
contradicting three pages one click behind it.

---

## What was built

### 1 · The homepage card derives its state

The Coaches Portal persona is now produced by a function of the gate, mirroring `coachOption()` in
the `/start` chooser — one gate, one launch, every surface turning on together per environment.

⚠ **Flipping the hardcoded `false` to a hardcoded `true` would have re-armed the identical trap.**
That is the whole point of the change; the badge text is secondary.

- Live → badge **"Free to start · no credit card"**, live treatment, live CTA.
- Gated → the original "Coming soon · express interest" wording, unchanged.
- **Card order deliberately UNTOUCHED.** Whether the two buyable products should lead the grid was
  raised with the owner and not decided — it does not ride along with a truthfulness fix.
- League Plus and Club still read "coming soon", verified correct against the live gates
  (`league`, `club`, `club_large` all `early_access`).

**Badge copy carries no price and no promo date** — per the same-day ruling, persona cards state
availability and the absence of a payment barrier; the $29 anchor and the Founding Season end date
live one click later. Three reasons, all load-bearing:
1. A "then $X" badge on the **Tournament** card would be **false** — that plan is `monthlyPrice: 0,
   trialDays: 0`, permanently free. There is no free *period* to end.
2. A "$29 from January" badge on the **Coaches** card **overstates** the cost, because a free Basic
   Coaches Portal exists and never expires — and the homepage never mentions it.
3. It trades against the promotion's own ratified goal (feedback volume, not revenue).

### 2 · Button parity across the persona pages

`/for-tournament-organizers`: **"Start Free — No Credit Card" → "Start free"**, matching
`/for-coaches` word for word. Changed in **two** places on that page — the hero button and the
Tournament Plus plan card — because a page whose hero says one thing and whose plan card says
something longer reads as two hands.

Nothing is lost: the credit-card objection is answered by the sub-line directly above the hero
button and again in the trust list below it. Measured after the change: "no credit card" still
appears 6× on that page.

**Out of scope, flagged not changed:** `/pricing` still uses "Start Free — No Credit Card" on its
Tournament → Tournament Plus upgrade bridge. Different surface, different job, not in the owner's
directive. The site footer's Title-Case "Start Free" is a nav link and correctly stays.

### 3 · The signup chooser demotes the invitation

"I was invited" is no longer a card. It is an aside below a hairline rule.

**The reasoning, which generalises:** the cards are things you *decide* — what do you want to build?
An invitation already exists and has your name on it. Listed among the ambitions it made a visitor
read three options and rule two out.

Copy (from `/marketing`, verified against the real flow — creating an account with the invited
address is what surfaces the invitation on `/home`):

> **Joining a club or team you were invited to?**
> Create an account with the email address the invitation was sent to — it'll be waiting for you.
> **Accept an invitation →**

- "Club or team", never "organization" — that is our word, not a volunteer's.
- The email sentence is load-bearing: *which address do I use?* is the question that otherwise
  becomes a support message. **It may get quieter, never shorter.**
- ⚠ It must stay reachable without scrolling on a phone — an invitee who cannot find it takes the
  org-creation path instead, the exact mis-route the Sign-up Invite Guard exists to prevent.
  Measured at 390×844: bottom edge at **728px in an 844px viewport**. Above the fold.
- The footer's duplicate hairline was removed — two rules a few lines apart read as a broken box.

### 4 · A misleading project instruction corrected

`CLAUDE.md` stated *"Demo dates re-anchor nightly in production."* **Neither demo exists on
production.** Verified: zero `riverdale-*` organizations on the live prod database, and zero "See it
live" links rendered anywhere on the live site. The line described the intended end state as fact
and would let any reader assume the demos are live.

---

## Deliberately NOT built (Batch 2, gated on an owner decision)

The demo doors, the per-demo addresses (`/see-it-live/tournament`, `/see-it-live/coaches`) and the
bare-address chooser. Logged **Proposed** in `BUSINESS_DECISIONS.md`.

**Why it is a decision, not a task:** making the demos public has three parts — seed the two
fictional clubs onto production, make the replay/re-anchor schedule actually run there, and turn on
the doors — and it puts a shared no-login session that any stranger can walk into onto the
production system.

The tournament card keeps its existing demo door (hidden in production builds by default), and the
comment above it now explains that its being alone is about the *demo* decision, not about the
Coaches Portal's availability.

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` (3 touched pages) | clean — 2 pre-existing warnings on untouched lines |
| `check:tokens` | clean, 0 grandfathered literals |
| `check:contrast` | ✓ 6 assertions, all AA |
| `npm test` | 1439/1439 |
| Browser, rendered | below |

Rendered checks (dev server, real pages):

- **Homepage 1280px** — four cards in the original order: Tournament *(Free to start · no credit
  card, demo door)* · League Plus *(Coming soon)* · Club *(Coming soon)* · **Coaches Portal (Free to
  start · no credit card, no demo door)**.
- **`/for-tournament-organizers`** — Start-CTAs now `Start free` / `Start free →`; the old label is
  gone from the page; "no credit card" still said 6× elsewhere on it.
- **`/for-coaches`** — unchanged, `Start free` / `Start free →`.
- **`/start` at 390×844** — cards *Run a tournament* + *Coach a team* (+ *Start a league season*,
  which is the dev-only League beta flag and correctly absent in production); the aside renders its
  three lines; one hairline on the aside, none on the footer.

---

## `/simplify` + `/review` (2026-08-07, both run)

**`/simplify` — 4 parallel lenses (reuse · simplification · efficiency · altitude).** Two converged
on the same root cause: the fix was at the wrong altitude. Applied:

1. **All four persona cards derive from the gate**, not just the one that was broken — League Plus
   and Club were carrying the identical latent bug and would have frozen the same way on their
   launch day.
2. **`isCoachesPortalPurchasable()`** replaces three hand-written copies of the same predicate. That
   duplication *is* the bug class being fixed; a third copy would have reopened it.
3. Tour state classified once (`tourPhase`) rather than twice; a design rationale that had been
   written out in both the TSX and the CSS now lives once.

**Skipped, with reason:** `.handle` re-spells pill styling that `.stepGo`/`.saidBack` already define.
Real, but the fix means refactoring two shipped controls where composed classes can silently shift
cascade winners (and `composes` is non-transitive under Turbopack — recorded gotcha). Five shared
declarations is not worth that on QA'd controls. **Efficiency found nothing.**

**`/review` — high-risk tier, deterministic gate green, 4 lenses (correctness · regression ·
state/lifecycle · gating-integrity).** Three confirmed, all fixed:

1. **⚠ HIGH — the tour's own auto-scroll folded the sentence it had just written.** Press a step →
   the strip is populated → `ringAnchor` smooth-scrolls to the target → those programmatic scroll
   events are indistinguishable from a visitor's, so the fold fired and the narration went to zero
   height **and `inert`** (so `aria-live` never announced it either). This silently undid the thing
   the chrome was rebuilt for in 2026-08-03 — *"narration, not rings"*. **Fix: the narration strip
   moved OUT of the folding layer.** The rule it establishes: banner = the CLAIM (never moves), dock
   + tour = NAVIGATION (may stand down), narration = a RESPONSE to what the visitor just pressed,
   and a response does not get out of the way of the action that caused it.
   Verified: after a step press the fold still fires (`condensed=true`, guide 0px) while the sentence
   renders at 88px, outside the layer and not inert.
2. **HIGH — the fix moved the drift one click downstream.** With all four cards deriving, a card
   would go live-styled the instant its gate flipped — but `/for-leagues` and `/for-clubs` hard-code
   "Coming soon" and do not read the gate (unlike `/for-coaches`, which does). **Fix: a card
   presents as live only when the gate is open AND someone has supplied its live badge**, so the
   homepage and its destination cannot disagree. Supplying the badge becomes the one deliberate
   launch act — and the comment there says to make the destination gate-aware in the same breath.
3. **MEDIUM — the scroll hook only ever learned the page position from a scroll event.** Rotating a
   phone (many mobile browsers reset scroll on rotation) or landing on a shell that scrolls an inner
   container left the chrome folded/expanded against a stale offset until the next real scroll.
   **Fix: measure on re-baseline and on resize**, from the tracked scroller when one is known.

**Refuted / verified clean (not applied):** `inert={false}` serialising as truthy (checked against
React 19's own DOM code — it calls `removeAttribute`); a ResizeObserver feedback loop during the fold
(the chrome is `position: fixed`, so the published height never feeds its own size); `data-ticker`
racing itself across navigation (single mount site + React's cleanup-before-setup ordering); the
`PERSONAS` shape change (module-local, no importers, no snapshot tests); `emphasisShort` breaking the
copy contract; the new wrappers breaking existing selectors (all descendant, not child); a partial
gating map fail-open (the map is always fully populated); and the DB-outage fallback, which
**fails closed** — it understates availability, never overstates it.

⚠ **`check:layout` is NOT-APPLICABLE here, not skipped and not passed.** Its screen list is 29
coach-portal screens; the homepage, `/start`, the persona pages and both demo orgs are all outside
it. Purpose-built rendered probes were used instead.

**Confirmed but NOT applied — outside this diff, and a prominence decision rather than a defect:**
the desktop nav's persona dropdown still offers "Join a team" as a full-weight item while `/start`
now demotes the same choice to a quiet aside. Two entry points into one journey disagreeing about
prominence is exactly the class of drift this work is about, but changing nav prominence is an owner
/ `/marketing` call. **Listed as follow-up 6.**

---

## Batch 1.5 — the sweep Batch 1 didn't reach, and the hierarchy ruling (2026-08-08)

**Status:** BUILT on `dev`, uncommitted. Owner QA pending.
**Trigger:** owner screenshot — the modules section ("One platform. Every role.") was still badging
the Coaches Portal "Coming soon". Batch 1 cured the persona cards and left five more hand-written
availability claims standing on the same two pages, plus one on `/for-tournament-organizers`.
**Decision:** owner ratified the full recommendation set ("I agree with your recommendations") —
logged as the binding **"live products lead"** entry in `memory/design_decisions.md` (2026-08-08).
**Mockups:** `claude.ai/code/artifact/b4a4c981-d77d-4e49-95cd-9aaf9597872b`

### Truthfulness (all now gate-driven)
- Modules section: Head Coach badge + section intro no longer hardcode "coming soon"; the module
  cards adopted the persona-card contract (`planKey` + nullable `liveBadge` = the launch switch).
- Homepage Coaches Portal callout (the "$29/mo … Coming soon → Express interest" strip that
  deflected live buyers) **retired** — replaced by a real Premium Coaches Portal card in the grid.
- Hero badge + Founding Season callout speak for BOTH promos while both run (fall back otherwise).
- `/pricing`: "Coming next" panel, "Available now" stat, deep-dive body, compare-table subs, and
  the bottom CTA no longer list the Coaches Portal as unfinished (gate-aware where copy flips).
- `/for-tournament-organizers`: coaches cross-sell flips to a live "Start free" link with the gate.

### Hierarchy ("live products lead" — closes Follow-up 2)
- **Hero:** live personas get full cards; gated ones compress into one "On the roadmap" strip
  (data-driven from the same `isLive` split, so launches promote automatically once live copy is
  written).
- **Modules:** two full deep-dives + two one-line in-development strips (`stripLine`).
- **Pricing grid** (shared `PricingSection`, new opt-in `marketingLayout` — in-app callers
  untouched): live org plans + the Premium Coaches Portal as full cards (3-col while exactly 3 are
  live), gated plans in one coming-soon strip with combined express interest. The coaches card
  never takes org-operator CTA overrides and stays out of `RENDERED_PLAN_KEYS`.
- **Segment picker** on /pricing: coach segment moved to second (beside the other live door).
- **Nav:** Tournaments · Coaches · Leagues · Clubs · Pricing.

### /review outcome (same day — 7 confirmed findings, all fixed)
Three-lens adversarial review confirmed the build correct TODAY but found four **scheduled
falsehoods**: fallback branches and price notes hand-writing "free through Dec 31, 2026", which
would have rendered false the day the promo ends. Fixes applied: promo surfaces (hero badge row,
Founding Season callout/notes) now render only while `isFoundingSeasonPromoActive('tournament_plus')`;
plan-card promo wording moved to an expiring `promoNote` (+ "Start now" CTA fallback); /pricing
"Coming next" regains the Coaches Portal if its gate re-closes; a 2-live-card grid state got its
own layout; a stale ViewerAwarePlans comment corrected. Also repaired
`tests/uat/scenarios/pricing-team-smoke.spec.ts`, which had pinned the GATED-and-pre-promo UI and
was failing since the 07-24 launch — now asserts the live state promo-robustly; **runs green 5/5**.
In-app pricing callers re-verified untouched; full-project `tsc` clean. ⚠ `check:demos` fails on
coach-sandbox attendance data (dev DB state, pre-dates and unrelated to this work — needs a
re-seed).

---

## Follow-ups

1. **Owner QA** (test plan supplied in chat; ledger entry owed).
2. ~~**Card order** — open question: should the two buyable products lead the grid?~~ **DECIDED
   2026-08-08: yes — "live products lead" (see Batch 1.5). Built.**
3. **Pricing-page bridge CTA** — leave the longer label, or match?
4. **January runbook** — the homepage routes coaches to the *comped Premium* door while the free
   Basic door sits on `/start`. Right during Founding Season; a live question on 2027-01-01.
5. **Batch 2** — demo doors, gated on the public-demo decision.
6. **Desktop nav prominence** — the persona dropdown still lists "Join a team" as a full-weight
   option while `/start` now demotes it. Owner/`/marketing` call, found by `/review`.
7. **`/for-leagues` and `/for-clubs` should read the gate** the way `/for-coaches` does. Needs
   live copy from `/marketing` for both, and it is the precondition for either card launching.
