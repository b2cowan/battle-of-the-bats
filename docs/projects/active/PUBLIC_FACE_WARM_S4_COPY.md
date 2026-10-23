# The public face, warm: S4 marketing words (the `/marketing` pass, Step 0)

> **Written 2026-10-23** by `/marketing`, before any S4 code (Ask 4), from a census of the code the same day
> (`PUBLIC_FACE_WARM_S4_BUILD_PROMPT.md` carries the census). Scope: the lines the plan routed to a words pass, the page
> titles and descriptions the build touches, the one new piece of copy (the share card), and the rule for button labels.
> **Words only.** The look is the build's job.
>
> **How the build uses this:** it applies every item marked **Approved**, applies **Approved if** items only when their
> condition holds on the day, and leaves every item marked **Held** exactly as it is today. Anything not in this doc keeps
> its current wording; a page being restyled does not get its sentences rewritten.
>
> Rules applied: `BRAND_STRATEGY.md` (practical, direct, warm; the hero line "Less admin. More sport." is the brand's and is
> not touched; "Canadian" only as a factual callout such as "Billed in CAD", never as an identity claim; full plan names),
> `VISUAL_IDENTITY.md` P3 (sentence case wherever a person reads), P4 (a button says what happens, no arrow), P7 (every page
> says what it is when shared), P8 (no system words), and the truth rule (copy says only what ships). No price or plan fact
> is restated here; those live in `docs/agents/strategy/PLAN_PRICING_FACTS.md`.

## Summary

| # | Line | Verdict |
|---|---|---|
| 1 | The site's default description ("…Canadian sports organizations…"), also in the app manifest | **Approved**, reworded |
| 2 | Pricing's alternative headline in `PRICING_PAGE_COPY.md` | **Approved**, reworded (the record only; not live) |
| 3 | Doubled brand name in page titles ("Pricing — FieldLogicHQ \| FieldLogicHQ") | **Approved**: one rule, every page |
| 4 | Page titles, sentence case, per page | **Approved** |
| 5 | Page descriptions | **Held** as today, except the home page, which gets one (see 1) |
| 6 | The house league card's "automated game notifications" | **Approved if** Stage 9 has not made it true; otherwise **Held** |
| 7 | The marketing share card (new) | **Approved** |
| 8 | Button labels on the marketing pages | **Approved** as a rule; labels listed by the build |
| 9 | The "FieldLogicHQ · Canada" footer lines | **Held** (the S3a decision stands: owner supplies the mailing address) |

---

### 1. The default description

Where: `app/layout.tsx` (the description every page without its own inherits, including the home page and every shared
link to it), repeated word for word in the app manifest (`app/manifest.json/route.ts`, what a phone shows when someone
installs the app).

**Current:** `The all-in-one platform for Canadian sports organizations — tournaments, house leagues, rep teams, and accounting in one place.`

**Finding.** "Canadian sports organizations" is a brand identity statement in the one sentence every shared link and every
install shows. The brand rule keeps "Canadian" for facts such as "Billed in CAD", because the platform is not scoped to a
country, and says the positioning is community sport. "All-in-one platform" is also the filler the voice avoids, and the
sentence does not carry the brand's one line.

**Proposed:** `Less admin. More sport. Tournaments, house leagues, rep teams and club accounting in one place, for the volunteers who run community sport.`

**Why:** it opens with the brand's own hero line, names what the product covers, says who it is for in the brand's words
("community sport"), and is under 160 characters. No em dash, no superlative.

**Verdict: Approved.** One string, used by the layout and by the manifest (the build shares the constant, so they cannot
drift again).

---

### 2. Pricing's alternative headline

Where: `docs/agents/brand/PRICING_PAGE_COPY.md` line ~477, under "Alternative headlines". Not live: the page's real headline is
"Plans built around how you actually operate."

**Current:** `Simple, honest pricing for Canadian sports organizations.`

**Proposed:** `Simple, honest pricing for people who run community sport.`

**Why:** same promise, no country as identity. "Billed in CAD" stays where the page already says it as a fact.

**Verdict: Approved.** This is the record only; the build edits the doc line, not the page.

---

### 3. The doubled brand name

Where: the root layout adds " | FieldLogicHQ" to every title (`'%s | FieldLogicHQ'`), and these pages also put the brand in
their own title, so the browser tab, a search result and a shared link read **"Pricing — FieldLogicHQ | FieldLogicHQ"**:
Pricing, the four "for" pages, What's new, both walkthroughs, both "open the live demo" pages, the four orphan
`/platform/*` pages, and the prospect page ("A FieldLogicHQ walkthrough | FieldLogicHQ").

**Rule:** a page's own title never contains the brand name, a dash or "FieldLogicHQ". The layout adds the brand once.
Home is the one exception (it uses an absolute title, below).

**Verdict: Approved.**

---

### 4. Page titles

Sentence case (P3), the page's own name, no brand tail. The tab then reads "<title> | FieldLogicHQ".

| Page | Current | Proposed |
|---|---|---|
| Home | `FieldLogicHQ` | `FieldLogicHQ: less admin, more sport` (absolute, no template tail) |
| Pricing | `Pricing — FieldLogicHQ` | `Pricing` |
| For club executives | `For Club Executives — FieldLogicHQ` | `For club executives` |
| For coaches | `For Coaches — FieldLogicHQ` | `For coaches` |
| For house league administrators | `For House league Administrators — FieldLogicHQ` | `For house league administrators` |
| For tournament organizers | `For Tournament Organizers — FieldLogicHQ` | `For tournament organizers` |
| What's new | `What’s New — FieldLogicHQ` | `What’s new` |
| Live demos | `Live Demos` | `Live demos` |
| Tournament organizers' walkthrough | `The 90-Second Walkthrough for Tournament Organizers — FieldLogicHQ` | `The 90-second walkthrough for tournament organizers` |
| Coaches' walkthrough | `The 90-Second Walkthrough for Head Coaches — FieldLogicHQ` | `The 90-second walkthrough for head coaches` |
| Prospect page (`/pitch/…`, not indexed) | `A FieldLogicHQ walkthrough` | `Your walkthrough` |
| Open the live demo (not indexed) | `Open the live demo — FieldLogicHQ` | `Open the live demo` |
| Open the live coach demo (not indexed) | `Open the live coach demo — FieldLogicHQ` | `Open the live coach demo` |

"House league" in a title is the audience, not a plan name, so it is lower case after "For". The four `/platform/*` pages are
not linked from anywhere (see the build prompt): their titles follow the same rule if they stay.

**Verdict: Approved.**

---

### 5. Page descriptions

Every page that has one keeps it. They were read against the brand rules and none breaks them: they say what the page
holds, name no competitor, and use full plan names where they name a plan. The walkthroughs build theirs from the slides
shown, which stays. The home page has none today (it inherited the default), so it gets the one in item 1.

**Verdict: Held** (apart from the home page).

---

### 6. "Parents get automated game notifications"

Where: the house league card on the home page (`app/page.tsx`, the `entry` line).

**Current:** `Open registration, run your draft, publish the schedule, and track standings — all in one dashboard. Parents get automated game notifications without staff sending a single email.`

**Finding.** The Club Tier readiness plan's own defect list (Stage 9, row I06) says only registration-status emails are
automatic, so this promises a thing that does not ship. The plan records the same promise being fixed in the League copy on
2026-08-20 and missed elsewhere (it names the Club copy); this home-page card still carries it. The truth rule governs.

**Proposed:** `Open registration, run your draft, publish the schedule, and track standings — all in one dashboard. Parents hear about their registration automatically, and you can message the whole league in one go.`

**Why:** both halves are things that ship today (registration-status emails, and season-wide parent messaging, which the "for
leagues" page already describes). It keeps the em dash the sentence already had; the second sentence is plain.

**Verdict: Approved if** Stage 9 has not shipped automatic game notifications on the day of the build. **Held** if it has
(then the original is true). The build checks the Stage 9 state first and says which it found.
**Flag for Stage 9's owner:** the same phrase sits in `lib/marketing-email-defaults.ts` (an email default, not a marketing
page) and in the plan's own rows F10 and I06. Those are not S4's to change.

---

### 7. The marketing share card (new)

One card for the whole marketing site (Ask 8): the new mark's tile, the name, and the brand's line. It carries no other
sentence, so there is nothing on it to go stale.

**Proposed text on the card:** `FieldLogicHQ` and, under it, `Less admin. More sport.`

**Per-page title and description under the card** are items 4 and 5. A page that has no description of its own shows the
home one (item 1).

**Verdict: Approved.**

---

### 8. Button labels

Rule (P4): a label says what happens, in sentence case, with no arrow and no forced capitals. About 90 trailing arrows sit on
the marketing pages today. The build removes the arrow from every button and link whose label stays the same, and does
**not** rewrite a label's words on its own. Two cases need a decision from the build session, listed back to `/marketing`
rather than guessed:

- A label that says nothing about where it leads. The home page's "Learn more →" on the persona cards is one: it should name
  the destination ("See house league", "See the tournament tools"), using the card's own title. The build proposes the
  list; this pass approves it before it ships.
- An arrow that is part of an illustration, not a button (the walkthrough slide drawings, the changelog's before/after
  marks). Those stay.

**Verdict: Approved** as a rule; the label list comes back for a yes.

---

### 9. "FieldLogicHQ · Canada" in the footer lines

The S3a pass held this until the owner supplies a mailing address. Nothing in S4 changes it. The unsubscribe page carries
the same line and moves to the new lockup in S4; its words stay.

**Verdict: Held.**

---

### Left alone on purpose

- The hero line "Less admin. More sport." and every headline on the marketing pages: restyling does not reword.
- All plan names, prices and capacity claims (their home is `PLAN_PRICING_FACTS.md`).
- "Billed in CAD" and "Canadian dollars" on Pricing: factual callouts the brand allows.
- The Founding Season strip and panel wording: a dated offer with its own copy rules; the build restyles it only.

---

## Item 8, the label list (build session, 2026-10-23), for a yes

Census of every button and link on the marketing set and its chrome. **50 labels lose only their arrow** (words
unchanged, applied under the item 8 rule) and **6 arrows are drawings** (walkthrough slide art, the presenter's
← → keys and hint, release-note menu paths such as "Money → Ledger"), which stay. Case-only fixes are P3 and need no
yes: "Get Started" → "Get started", "Sign In" → "Sign in", "Start Your Organization" → "Start your organization",
"Get Started Free" → "Get started free", "Start Free — No Credit Card" keeps its words in sentence case unless row 9
below is approved.

The labels below name no destination, or promise a sign-up and open a marketing page. Each proposal reuses words the
site already uses elsewhere. **Until this list gets a yes, each keeps today's words with only its arrow removed.**

| # | Where | Today | Opens | Proposed |
|---|---|---|---|---|
| 1 | Home, "What's included", the two in-development strips | Learn more → | /for-leagues, /for-clubs | **See what League Plus includes** · **See what Club includes** (Pricing's own "See what Club includes") |
| 2 | Home, the two role cards | This is me → | /for-tournament-organizers, /for-coaches | **Keep "This is me"**: the card's title names the role, and the drawing kept it |
| 3 | Home, the persona cards' demo door | See it live — no sign-up → | the tournament or coach demo | **Keep** (the 2026-08-10 "one label, the card's title says which" decision stands) |
| 4 | Pricing and the home plan strip, the League Plus + Club interest buttons (3 places) | Express interest | the interest form | **Express interest in League Plus or Club** |
| 5 | Pricing, coach role card, while coach checkout is closed | Express interest | the interest form | **Express interest in the Coaches Portal** |
| 6 | For clubs, For leagues: hero link | Running a tournament? Start free → | /for-tournament-organizers (a marketing page) | **Running a tournament? See tournament plans** |
| 7 | For clubs, For tournament organizers, For leagues: the Coaches Portal cross-sell card | Start free → (open) · Express interest (closed) | /for-coaches · the form | **See the Coaches Portal** · **Express interest in the Coaches Portal** |
| 8 | For coaches, the Tournament cross-sell card | Start free → | /for-tournament-organizers | **See tournament plans** |
| 9 | Pricing, the Tournament → Tournament Plus bridge | Start Free — No Credit Card → | Tournament Plus sign-up | **Start Tournament Plus free** |
| 10 | For tournament organizers, the two plan cards side by side | Start free → · Start free → | free sign-up · Tournament Plus sign-up | **Start free** · **Start Tournament Plus free** |
| 11 | For tournament organizers ×2, For coaches ×2 | See it live → | the matching demo | **See a live tournament** · **See a coach's season** (the walkthroughs' and the For clubs page's own words) |
| 12 | The tournament walkthrough's demo door | See it live — no sign-up → | the tournament demo | **See a live tournament** (its coach twin already reads "See a coach's season") |
| 13 | Both walkthroughs, the closing link | Everything else it does → | the matching For page | **Everything else Tournament does** · **Everything else the Coaches Portal does** |
| 14 | The plan cards (home and Pricing) | Start free — no credit card required | sign-up | **Start free**, with the card's existing "No credit card required" line under the price left as the only copy of it (the drawing's split; no new words) |

Flagged, not S4's: the For leagues Coaches Portal card never switches to a live link when coach checkout opens, unlike
the same card on the other three For pages (a behaviour gap, not a word).

**Ruled 2026-10-23 (owner, in the S4 build session):** the 14 rows **approved as proposed**. Also ruled there: the four
orphan `/platform/*` pages are **retired** (deleted, their addresses sent to the home page); the platform-admin sign-in
**takes the new lockup** in Part B.
