# Help Docs — Scannable Format (PM Brief)

**Owner-approved 2026-08-14.** Mockups: Claude artifact "Scannable Help"
(`2499e60b-f83c-4ee8-97c9-b0ce9cd9bb48`). Plan: `HELP_SCANNABLE_FORMAT_PLAN.md`.

## What changes for the user

Today, tapping "?" on a page like Money opens a side panel containing the *entire* topic —
for Money that's roughly 4,700 words of unbroken paragraphs. Finding one answer means reading
or scrolling past everything else.

After this work:

- **The "?" panel becomes a menu of answers.** A two-sentence summary, then a short list of
  titled sub-topics ("Player dues & recording payments", "Imports & exports…") the reader taps
  open — the same expand/collapse pattern the FAQs already use. One question, one tap, done.
- **The full guide gets real structure.** Long topics gain sub-headings with jump-chips at the
  top, numbered steps for "how do I…" answers, term/meaning rows for "what does X mean", and
  the occasional highlighted tip or caution. Support (and search results) can link a coach to
  exactly one answer instead of the top of a wall of text.
- **Screenshots appear where words struggle** — a framed, captioned picture (tap to enlarge)
  showing where a control lives or what a complex screen looks like. Used sparingly and only
  where text can't carry it; never decoration.

## Why it matters

Help is a self-serve support channel — every answer a coach finds alone is a support
conversation that never happens. The current format has good navigation *between* topics but
none *inside* them, and the longest topics (Money) are exactly the ones anxious first-time
treasurers hit. Scannable structure is also what keeps future help honest: the new authoring
rule ("a topic longer than six paragraphs must be sub-topics; a paragraph that's secretly a
list must be a list") is now part of the docs agent's standing instructions, so new features
get scannable help by default instead of drifting back to essays.

## Screenshots — the honest trade-off

Pictures go stale silently — the same drift problem the demo sandboxes taught us. The
mitigation: every screenshot is captured from the seeded demo world by a script (same data,
theme, and size every time) and registered in a manifest, so when a screen changes we re-run
one command and the affected pictures refresh. Any image that can't be refreshed comes out —
the standard forbids keeping a "close enough" stale picture. All images show fictional
Riverdale data only.

## Role/access differences

None. Help renders the same content for everyone who can see the page; the operator's
platform-admin help mirror updates automatically because both read the same source.

## Rollout & how to test

**All four steps are built (2026-08-14).** (1) the machinery; (2) Money converted; (3) every
other long topic — swept to completion rather than left half-done, because the "?" is one
control and had to behave the same everywhere; (4) the screenshot pipeline with its first two
pictures. QA is the Owner QA Ledger's §18, in five batches.

## Where it landed

- **21 topics** now open as a menu of answers, **109 sub-answers** in total.
- **Zero** long topics left in the old paragraph-wall form, anywhere in the product.
- Pictures are possible where words struggle — rare by policy, demo-data-only by mechanism.

## Success criteria — all met, pending your QA

- "?" on a Money page shows a scannable summary + sub-topic list, not 4,700 words. ✅
- Every long topic's sub-answers are individually linkable. ✅
- The "?" behaves identically on every page in the product. ✅
- No change to search behaviour, existing anchors, or short topics. ✅
- New help content arrives already in the scannable format (the standard is binding in the
  docs agent's instructions). ✅

## The one thing to keep an eye on

Screenshots are the only part of this that can rot silently. The mitigation is a one-command
re-capture and a rule in the docs agent's instructions to re-take pictures whenever the screen
they show changes. There is deliberately **no automated freshness check** — proving an image is
*current* would need pixel baselines, and the demo world's dates move nightly, so that check
would cry wolf every morning. If a stale picture ever does ship, that's the moment to revisit.
