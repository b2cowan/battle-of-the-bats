# Pitch Deck Studio — Plan

**Status:** APPROVED 2026-08-21 (owner, in session — three rulings recorded below). **Not started.**
**PM brief:** [PITCH_DECK_STUDIO_PM_BRIEF.md](PITCH_DECK_STUDIO_PM_BRIEF.md)
**Parent project:** [PITCH_SLIDE_LIBRARY_PLAN.md](PITCH_SLIDE_LIBRARY_PLAN.md) — this is the
"deck assembly in platform-admin" item that plan parked as *"later, and only if it earns it… build
once there is a library worth assembling from and evidence that per-prospect decks are a real
workflow rather than a nice idea."* **Both conditions are now met**: sixteen slides are built (all
twenty-one once P2b lands), and the owner asked for per-prospect decks unprompted.

**⚠ This project ABSORBS P3 of the parent plan** (the contact sheet + the staleness check). Do not
build P3 separately — the contact sheet *is* this project's library view, and the staleness check is
a column on it. The parent plan's phase list should be updated to say so.

## What this is

A room in platform-admin (**Growth** group, beside Early Access and Email Campaigns — it is
company-owned material aimed at people who are not customers yet) where the owner can:

- see **every slide in the library** — its picture, its words, which decks use it, and whether its
  picture has gone stale;
- see **every deck** — its audience or purpose, its running order, how many slides it holds, and
  where it is published;
- **compose**: add, remove and reorder slides in a deck, including the short pull each public
  walkthrough page shows;
- **build a deck for one prospect** and hand it over as a private link or a PDF.

## The owner's three rulings (2026-08-21, binding)

### 1. ⚠⚠ DECKS ARE DATA. SLIDES ARE CODE. THIS IS THE LOAD-BEARING LINE.

Composition — *which slides, in what order, for what audience* — becomes owner-editable data.
**A slide's headline, claim, picture and plan line stay in code and are never editable in the
browser.**

The reason is not preciousness, and it must not be re-litigated by a future session looking at a
read-only field and deciding to "finish" the CRUD:

> A build check compares each slide's claim against what the plan configuration actually grants
> and against the screen it pictures. That check is why the 2026-08-20 persona-page audit caught
> nineteen overclaims — including one capability promised on six surfaces that the product cannot
> do at all. **Nothing watches a sentence once it is a row in a table.** The same copy also feeds
> the in-app upgrade panels, so a marketing overclaim is shown to paying customers.

Composition, by contrast, has **no truth content**. Any order of true slides is true. That is
exactly the half that should not need a developer at 11pm.

The owner was offered a middle option (edit the words in the tool, queue the change until it passes
the check) and **declined it** in favour of the clean split. A copy change stays a one-line code
edit made in chat. ⚠ If that ever becomes the bottleneck, the queue is the design to revisit —
**not** a plain editable textbox.

### 2. A prospect deck ships as a PRIVATE LINK **and** a PDF.

Both render from the same deck, so they can never disagree. The link is **unlisted, not
authenticated** — anyone holding it can open it. Accepted knowingly: it is marketing material, it
carries no customer data, and a prospect on a call cannot be asked to sign in. ⚠ It must therefore
never be able to name a real organization, and it is `noindex`.

### 3. Sequenced AFTER the parent project's P2b (the five hand-drawn explainers).

So the studio opens onto a finished library rather than a visibly half-built one. ⚠ P2b carries one
small piece of this project's groundwork — see "What P2b must land first" below.

## ⚠ Findings from the CODE that shape this, not from the plan

Every one of these was checked against what the code does. They are the difference between a tool
that works and a tool that quietly publishes a false page.

### F1 — NOTHING RENDERS A DECK TODAY. The deck is a list nobody reads.

`deckSlides()` has exactly one caller: the guard test. `WalkthroughPage` builds both its scroll
panels *and* present mode from `w.panels` — the page's short **pull**. A code comment in
`lib/walkthrough-content.ts` states the opposite (*"present mode and the printed leave-behind both
render every built slide already"*) and **is false**.

**Consequence, and it is the reason this project is worth doing at all:** the coach deck holds
eleven built slides and six are reachable. Playing time, awards, player development, the
fundraising credit and the lineup board were photographed in P2a, sit in the manifest, and cannot
be seen anywhere in the product. **Five finished slides with no audience.** Fix the comment when
this is built.

### F2 — ✅ CLOSED 2026-08-21, AND NOT THE WAY THIS PLAN FIRST PROPOSED. Do not build the fix.

**The finding was real:** both walkthroughs closed with *"Every picture above is the real
FieldLogicHQ software, photographed on a live demo we operate ourselves — not a mockup."* The moment
composition is owner-editable, dropping an **explainer** into a page makes that paragraph false, at
11pm, with nothing in the build able to see it.

**This plan originally proposed DERIVING the sentence** from what was in the pull — all-photographs
gets one wording, a pull containing a drawing gets another. ⚠ **The owner's answer was simpler and
better: remove the claim entirely** (2026-08-21, the same session that replaced the picture rule —
see `memory/design_decisions.md`). It turned out to be **ten sentences across four pages**, not one,
and all ten are gone. What replaces them points at the demo instead, which is an invitation rather
than a denial and **stays true whatever the pictures are**.

**So there is no derived-closing machinery to build**, and a future session must not add it —
there is no longer a sentence for composition to falsify. The general rule this finding produced
still stands and is the real content of F3 below: **anything a page asserts about its own contents
must be derived or must not be asserted.**

### F3 — The page's own furniture is hand-typed and build-checked, and goes stale the instant composition becomes data.

Two things break:

- **The meta line** (`"6 problems · 90 seconds · nothing to install"`) is typed, and
  `tests/unit/pitch-slide-library.test.ts` asserts the number matches the panel count. A reorder in
  the tool advertises six problems on a five-problem page and **no test can see it**. → the count
  must compute itself.
- **The SEO description** is written to name each panel in order (deliberately widened in P2a when
  the coach pull grew from two to six). It cannot be asserted the same way and would rot silently.
  → it must be generated from the slides shown, or the studio must make editing it part of the same
  save.

**The general rule this establishes:** every invariant the build check currently enforces has to
move into the SAVE PATH. The tool refuses an invalid deck and says why; it does not save one and
hope a test catches it. Today's assertions to relocate — a pull is a subset of its deck **in deck
order**, no slide appears twice, no slide names a plan, an explainer never claims a real capture,
and at most two rings per slide.

### F4 — A slide is not page-ready. It is missing two things, and one of them is the risky one.

A public page panel carries two fields the slide deliberately does not:

- the **long answer** — the unattended version, with the qualifications and "your call" clauses a
  deck doesn't need because a human is in the room;
- the **plan line**, where the pictured feature is gated.

Both are hand-written per page, per panel. So as things stand the owner could only add a slide that
already happens to have them — i.e. one already on that page. **The tool is not self-serve until
every slide in the library carries its own page copy.** That is a one-time editorial pass over
sixteen slides (twenty-one after P2b), and it belongs in this project.

⚠ **The plan line is the riskiest field in the entire system to let anyone move around freely** —
it is exactly the class of mistake the persona audit found. It stays welded to the slide in code,
where the check can verify it against the live plan configuration. Verified examples that must not
be lost in the move: copying a tournament forward is **Tournament Plus** (#17); team
self-registration and waitlist collection are **base tournament plan**, so #16 needs **no** plan
line at all.

### F5 — A deck stored as data references PERMANENT slide numbers, and a number can retire.

`#08` is already retired; `#18`–`#20` are held. The bank's key set is a compile-time literal today,
so a page naming a slide that does not exist is a **compile error**. Once decks are rows, that
becomes a runtime hole: a retired slide silently vanishes from a deck the owner believes is six
slides long. The library view must show a deck naming a missing slide as a visible problem, and the
save path must refuse to create one.

## What P2b must land first

Two things, both small, both needed by this project:

1. **The picture frame learns to hold a drawing.** Today a slide with no photograph renders with no
   picture at all — the renderer resolves a picture only through the screenshot manifest. The
   studio would otherwise show five blank stages.
2. **Present mode renders the whole DECK rather than the page's pull** (the F1 fix). It is the deck
   rendering already in every respect but its input, and it is what this project previews into.

## Phases

### A — The library view (read-only). Absorbs parent P3's contact sheet.

Every slide on one page: picture, pain, claim, image class, which decks name it, and **staleness** —
when its picture was last taken, whether the screen it pictures still exists, and whether its plan
line still matches the plan configuration. Plus every deck, its purpose, its count and where it is
published. **No editing.** This alone answers "what do we have?" and is the cheapest useful thing.

### B — Decks become data, and the pages stop being able to lie.

The two public pulls move out of code into owner-editable records; the pages read them with the
code deck as a **fallback**, so a missing row can never render an empty marketing page. The meta
line computes itself, the closing paragraph is derived per F2, the SEO description is answered per
F3, and every invariant listed in F3 moves into the save path. **This is the phase that carries all
the risk** — it is where a public marketing page gains a data dependency it has never had.

### C — The composer.

Create and name a deck, give it a purpose, drag to reorder, add and remove. Live preview against
the real slide frame. Every slide's page copy written per F4, so any slide can be dropped onto any
page and simply work.

### D — Prospect decks: the private link and the PDF.

Compose, name it for the prospect, get an unlisted URL and a PDF. The print layout already exists
(dark ground, one slide per page, pictures at full size, our address on the last page), so the PDF
is close to free. The link is `noindex` and names no real organization.

## Risks

- **A marketing page gains a runtime data dependency.** Mitigated by the code-deck fallback and
  caching — the page must render correctly even if the store is unreachable.
- **The owner composing with nothing watching.** This is the whole point of F2 and F3: the checks
  move to the save path rather than disappearing.
- **The unlisted link is readable by anyone holding it.** Accepted by the owner; contains no
  customer data; must never name a real organization.
- **Scope creep toward editing slide copy.** Ruling 1 is binding. A future session that finds a
  read-only field and "completes" the form is the failure mode to guard against — hence this
  document says why, not just what.

## Explicitly NOT in scope

Editing a slide's words or picture in the browser (owner ruling 1) · per-organization or
customer-facing decks · a WYSIWYG slide editor · analytics on prospect-link opens (a reasonable
follow-up, but not a reason to delay the tool).
