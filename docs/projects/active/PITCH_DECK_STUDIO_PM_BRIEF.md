# Pitch Deck Studio — PM Brief

**Approved 2026-08-21 · Plan:** [PITCH_DECK_STUDIO_PLAN.md](PITCH_DECK_STUDIO_PLAN.md)
**Parent:** [PITCH_SLIDE_LIBRARY_PLAN.md](PITCH_SLIDE_LIBRARY_PLAN.md) · **Starts after** that
project's P2b (the five hand-drawn explainers).

## What we're building

A room in platform-admin where the owner assembles pitch material himself, without a developer.

See the whole slide library on one page. See every slideshow we publish, what it is for, and how
many slides it shows. Reorder, add and remove slides — including on the two live marketing pages.
Build a deck aimed at one prospect and hand it over as a private link or a PDF.

## Stage A is built (dev, 2026-08-21) — what you can do today

**Platform-admin → Growth → Pitch Deck Studio.** The library view, read-only. Every slide with its
picture and its words, both decks with their running orders, and a straight answer per slide on
where it is published and what condition it is in. **Nothing to save, no edit controls.** Owner QA
§72.

**⚠ Two corrections to this brief, both from the code:**

**It is twelve stranded slides, not five.** The "five" above was counted before the last two
batches of artwork landed. The library is now 23 slides; the two public pages show 6 and 5. **Twelve finished,
checked slides are missing from the SCROLLING pages** — nine coach, three tournament, including the
coach deck’s overview wheel, which sits second in its running order. ⚠ They are not unreachable:
every one appears in “Present the full deck”, a button in each page’s hero that any visitor can
press. What they miss is the reader who only scrolls. The screen computes that number
itself, so it cannot go stale again.

**Success criterion 4 is NOT met, and could not have been met the planned way.** *"When a slide's
pictured screen changes, the library view says so."* The check we planned to reuse proves a picture
exists with its words recorded — it cannot tell whether the picture still looks like the screen. A
failed re-photograph leaves the old one in place, so a three-month-stale picture passes everything
we run. **Rather than a green tick that means less than it looks like, every card says this in plain
words.** Closing it properly means re-photographing and comparing, which is its own piece of work —
say if you want it queued.

**A column was built and deleted on the same day, and that was the right outcome.** The screen was
to carry a "plan line" column, checking each page’s *"…is part of Tournament Plus"* sentence against
what the plans actually grant. **You then removed every one of those sentences from the walkthrough
pages** — *"we don’t want to compartmentalize features at this stage"* — so the column had nothing
left to read. What replaced it is a build check: nothing in the pitch material may name a plan, tier
or price, and the build fails if one appears. **That is stronger than a column** — a check fails on
its own, a column only helps someone who happens to be looking at it.

**It did catch one thing before it went:** the six coach panels were advertising the Premium Coaches
Portal, which our plan configuration says is in early access and not open for self-serve checkout.
Almost certainly the founding season working as intended — moot for the walkthrough now, but the
same wording appears elsewhere, so it is worth confirming.

## Stage B is built (dev, 2026-08-21) — composition is yours now

**Each deck card in the studio ends in an editor.** Tick the slides the public page should show,
press Publish, and the live page follows on its next visit — no ticket, no deploy. Order is not a
choice you can get wrong: the page always shows your picks in the deck's running order. "Return to
the code default" forgets your saved choice entirely. Owner QA §76.

**Every slide is genuinely pickable.** The ten slides that had no page-length copy got it in the
same session — each sentence checked against what the product actually does before it was written.
So the picker has no dead options, which was the condition you set for making placement a dial.

**The save button refuses a bad page and says why** — an empty page, a duplicate, a slide from the
other deck, a retired number — in plain sentences, at the moment you press it.

**The pages cannot go blank and cannot lie about themselves.** The "7 problems · 90 seconds" line
counts itself and the search description rewrites itself from the slides shown (today's derived
text is character-for-character what the hand-written text said). If the saved record is ever
missing or the database unreachable, the page silently renders the code-built version you have
today — only the studio tells you that is happening.

**Still true: no wording, picture, plan or price can be changed from a browser.** The editor moves
slide numbers and nothing else.

## Stages C + D are built (dev, 2026-08-21) — the composer, and the prospect deck

**The running order itself is yours now.** Each deck card in the studio ends in a composer: move
a slide up or down, remove it, add any built slide from the whole library, and press Publish.
**Reordering a deck reorders the live page by itself** — the page always shows your picks in the
deck's order, so this is the design working, not a surprise; the composer says so right above
the button. "Return to the code default" puts the built-in order back. Click any row to see that
slide in the real frame — exactly as the page or present mode will show it. Owner QA §77.

**Decks you create from scratch.** Name one, say what it's for, compose it from any built slides
— both audiences together is deliberate (a club pitch wants tournament *and* coach material).
The club deck's three reserved numbers stay reserved: try to add #18 and the refusal tells you
whose it is and that its artwork isn't drawn yet.

**A deck for one prospect, handed over in two shapes that cannot disagree.** Every deck you
create gets an **unlisted link** the moment it exists — unguessable, invisible to search
engines, no login. The page renders the slides and nothing else: **the deck's name is your
internal label and never appears on it**, so it can never name the prospect or a real
organization. Open the link and print — the same dark, one-problem-per-page leave-behind the
walkthrough pages produce is the PDF. Deleting the deck kills the link. Owner QA §78.

**The safety net splits deliberately in two.** The two standing decks keep the code fallback —
a broken or unreachable saved deck can never blank a marketing page. Decks you created have no
fallback: a broken one simply doesn't render (its link answers "not found"), and the studio
says why. **And still: no wording, picture, plan or price can be changed from a browser** — the
save refuses a deck whose name or purpose so much as mentions a plan or tier.

## Why it matters

**We have finished pitch material nobody can see.** ⚠ Counted again on 2026-08-21 when stage A put
it on a screen: the library holds 23 slides and the two public pages show 6 and 5. **Twelve sit outside both
pages’ pulls** — nine coach, three tournament. All photographed or drawn, all checked, and no
surface in the product shows them. That is not a backlog — it is work already paid for sitting in
a drawer.

**Targeted selling is a real workflow, not a nice idea.** A prospect looking at us for one specific
reason should get the four slides about that reason, not a general page. Today that means asking an
engineer to write a new page.

**The library grows every time the product does.** The whole reason slides carry permanent numbers
is so they can be tracked as the product changes underneath them. Adding a new slide to the right
slideshows should be a two-minute job for the person who decided it belonged there.

## What changes for the owner

- **One page showing everything we have** — every slide with its picture and its words, and a
  straight answer on whether its picture has gone stale or its plan line has drifted.
- **Composition becomes yours.** Pick the slides for the coaches page, put them in the order you
  want, and save. No ticket, no wait.
- **A deck for a named prospect**, as a link you can send during a call and a PDF you can attach
  afterwards. Both come from the same deck, so they can never disagree.

## What changes for the customer

**Nothing, unless the owner changes a page.** The two walkthrough pages keep working exactly as
they do. Pricing, plans and the demos are untouched. No new navigation anywhere a customer can see.

## The one line we are drawing, and why

**Which slides and in what order is yours. What a slide says is not.**

An automated check compares every slide's claim against what the plans actually grant. That check
is why the copy audit caught nineteen overclaims — including one capability we were advertising on
six surfaces that the product cannot do. Nothing can watch a sentence once it becomes a row in a
database, and the same copy feeds the in-app upgrade panels, so a marketing overclaim reaches
paying customers too.

Composition has no such risk. Any order of true slides is true.

A wording change stays a one-minute request in chat, and it goes through the check on the way. If
that ever becomes the bottleneck, the answer is a review queue — never an open textbox.

## The problem this tool creates, and how it is solved

Both marketing pages close by promising *"every picture above is the real software — not a
mockup."* The moment page composition is owner-editable, a drawing can be added to a page and that
sentence becomes false, with nothing able to notice.

**The owner settled it more simply than we proposed: the claim is gone.** It turned out to be ten
sentences across four pages, not one, and all ten were removed on 2026-08-21. What replaces them
points at the live demo instead — an invitation rather than a denial, and one that stays true
whatever the pictures are. There is nothing left for composition to falsify.

The same principle covers the smaller furniture: the "6 problems · 90 seconds" line counts itself,
and every rule the build currently enforces moves into the save button — the tool refuses a bad
deck and says why, rather than saving it and hoping a test catches it later.

## Priority

**Medium-high, and it is next after the five drawings.** Not urgent enough to interrupt them —
opening the studio onto a half-built library would be a worse first impression than waiting a
phase. It replaces the contact sheet that was already planned, so it is partly work we had
committed to anyway.

## Success criteria

1. The owner reorders the coaches page without help, and the page's own counters and closing
   paragraph follow it correctly.
2. Every built slide is visible somewhere — the twelve stranded slides included.
3. A prospect deck goes from "I know what they care about" to a sent link in under ten minutes.
4. ⚠ **NOT MET BY STAGE A, and not achievable the planned way** — see above. When a slide's
   pictured screen changes, something says so before a prospect finds out. Needs a
   re-photograph-and-compare, not a column.
5. No slide's wording can be changed from a browser.
