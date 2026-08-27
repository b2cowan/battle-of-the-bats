# PM brief — what happens to a coach holding an iPad

**Status:** BUILT on dev 2026-08-27, owner-approved from mockups. Owner QA = `OWNER_QA_LEDGER.md`
§115. Plan of record: `COACH_TABLET_BAND_PLAN.md`. Build prompt: `COACH_TABLET_BAND_BUILD_PROMPT.md`.
Raised 2026-08-27 out of Owner QA §113. **No migration.**
Approved mockups: `claude.ai/code/artifact/005d7400-f546-43a2-8d88-f5f020e4f816`.

## The short version

Six coach screens had never been checked for layout problems — not skipped, **missing from the
list**. When they were added, they came back with **318 findings**, every one of them on a phone or
tablet-width screen and **none at desktop width**. They were not new problems; they had been
shipping for months on screens nobody had ever measured.

They are now down to **six**, and those six are one deferred decision, written down.

## What changed for a coach

**On a laptop, nothing — and that was already true before.** All six screens were clean at desktop
width to begin with, and still are.

⚠ **On a phone, about forty small controls did get bigger — an earlier version of this brief said
nothing changed there, and that was wrong.** Only the lineup grid was checked at phone width and
the claim was generalised. The six screens' own numbers say otherwise: 37 problems at each phone
width went to zero, so 37 controls grew. It is an improvement — they were under the standard on
phones too — but the mockups were drawn at tablet size, so **nobody looked at any of it at phone
width**. The lineup grid itself is genuinely unchanged on a phone.

**On a tablet, the lineup builder becomes usable.** The grid where a coach sets who plays which
position each inning was made of dropdowns two-thirds the height a finger needs, too narrow to read
"Bench" in, with a drag handle the size of a pea beside every name. It now behaves on a tablet
exactly as it already behaved on a phone: cells you can hit, positions you can read, and reordering
and removing in the *Batting order* tab where they already lived at full size.

**The cost is two rows.** Twelve hitters never fitted on one screenful at tablet width anyway; the
grid is now 144px taller and **exactly as wide** — no new sideways scrolling. Nothing a coach opens
the builder *for* moved below the fold.

**Everywhere else, small controls got bigger.** A player's profile had a 15px "Preview" button and a
20px "Manage dues" link; an opponent's page had a 16px control that merges two opponents into one
book. Those and about forty others now clear the standard. **No labels changed, no screen was
redesigned, and nothing moved on a laptop.**

## The question that turned out not to be open

The brief asked the owner to decide whether a lineup grid is something a coach taps or something
they use with a mouse, and offered three answers. **The product had already decided, built the
answer and been shipping it on phones for months** — it just switched that answer off above 640px.
So a coach on an iPad was getting the mouse version of a screen the product itself treats as a
finger screen.

That reframing is what made the decision cheap. The "after" in the mockups is not a new design; it
is the phone design, unchanged, applied one breakpoint higher.

**Two options were rejected and should stay rejected.** Declaring the grid a mouse-only surface
would mean telling coaches the between-innings tool wants a laptop — nobody was willing to say that
about a screen used standing up at a field. Lowering the standard itself would have erased 417
recorded problems in one line, which is exactly why it looked attractive.

## How to check it

The owner QA section (§115) links a walkthrough with real checkboxes. The short version: open the
lineup builder on a tablet, try to hit an inning cell with a thumb, check "Bench" is readable, and
confirm reordering still works one tab across. Then the same on a phone, where **nothing should
look different at all** — that is the point of the change.

## ⚠⚠ Two decisions this raised that are still yours

**1 · It does not reach a current full-size iPad.** Measured in portrait on the real build: the iPad
Mini and pre-2018 iPads get the new screen; **the iPad 9th gen, iPad Air, iPad 10th gen and iPad Pro
11" do not** — they are 810–834px wide, above the ceiling, and still show the old 32px cells with
110 controls under the standard. The ceiling came from the automated check, and the options you were
given only ever considered *lowering* it. **So "a coach can operate the lineup builder on a tablet"
is true for small and old tablets only.** If your iPad is a current full-size one, the walkthrough's
Part A will fail — and that will not be a bug, it will be this.

**2 · Between roughly 641 and 713px wide, the grid scrolls sideways and the player's name scrolls
away with it**, with nothing cueing that it scrolls. That overflow is older than this change, but
this pass declared that width a touch band and moved three of the five relevant rules into it. Either
the other two follow, or the claim gets corrected — leaving both standing is the thing not to do.

Neither is decided here. Both are the same shape as the original ruling.

## What was deliberately left undone

**Six findings survive, all in the shared page header** — the help "?" on five screens and the
"Save template" button on one. They are the same controls on every screen in the portal, so they
get fixed everywhere at once or not at all. They are recorded with a written reason rather than
quietly absorbed; the portal's baseline still carries exactly the same number of unexplained
entries as before this work (698), which was the condition the brief set.

## Why it mattered commercially

No customer reported it — there are no live customers yet. What it cost was **credibility in a
demo**: both public sandboxes run the real product, and a prospect opening the coach demo on an
iPad was one tap away from a control that did not respond the way they expected. The lineup builder
is a screen we actively point people at.

## What "done" looks like

- ✅ Mockups approved on a real tablet, not from a description.
- ✅ The tablet question answered and written into the design record, so it stops being re-asked.
- ✅ The six screens clean, or their exceptions named and reasoned — **not** absorbed into the
  baseline.
- ✅ A coach can operate the lineup builder on a tablet.
- ✅ Counted as **distinct controls fixed** (52 of 58), not findings closed.
- ⏳ Owner QA §115.
