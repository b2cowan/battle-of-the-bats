# Prompt — Board Ready · the public Security page, Step 2: the drawing (`/design`)

> One session, pasted into a fresh chat on `dev` (`/clear` first). Written 2026-11-21. A drawing session, not a build:
> no product code changes. It draws the page, publishes the drawing as an Artifact, and ends with the owner's asks. Plan
> of record: `BOARD_READY_PLAN.md` §0c, the "public Security page" item, steps S1–S5 (S1 done 2026-11-21, `1dd48c91a`).

Run `/design` and do the pass below. Run `/legal` before hand-off on any word that is new or changed (see "The words
are locked"), and `/marketing` on any new word the page needs.

## Why this session exists
The owner ruled on 2026-11-21 that the security brief becomes a public page at fieldlogichq.ca/security, open to any
prospect, so a club board's first two questions (*does our data leak, and is it sold?*) are answered before the first
meeting. S1 settled the words. This session decides **how the page looks and reads**, on the marketing site, in both
themes, at desktop and phone width, so S3 can build it without inventing anything. The private brief
(https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR) is a document drawn for printing and sharing; it is **not** the
design to copy. The public page lives in the site's own kit.

## Read first (re-read the lines you build on; do not trust this summary)
- `docs/agents/legal/drafts/SECURITY_BRIEF.md` **v0.4**: the page copy, section by section; the **held** lines and the
  one **page condition** (where they sit and when they switch on); the furniture table (title, description, eyebrow,
  footer link, the `BoardQuestions` link, the "as of" line); the "Read more" block in two versions; "Revise when" and
  "Never add".
- `docs/agents/legal/MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` rows 1–10: the diagram's labels, each checked.
- `BOARD_READY_PLAN.md` §0c: the Security page item, its PM brief, steps S2–S5 and the tasks S1 left for S3.
- `docs/agents/brand/VISUAL_IDENTITY.md` §1 (P1–P10, the headline exception, the type ladder by name) and §2 (colour,
  Warm / Dark). Name ladder steps; never copy a pixel value.
- **The shipped pieces this page is built from.** Draw from the shipped component, never from memory
  (`feedback_draw_controls_from_shipped_component`):
  - The legal pages (`components/legal/LegalPage.tsx` and its stylesheet): the marketing ground's reading page, a title,
    one line under it, the text, and a contents list beside it on a wide screen. The Security page sits beside these in
    the footer and is gated on the same switch, so this is the nearest precedent.
  - The on-sale pages' drawings (`components/marketing/OnSaleDrawing.tsx`, `SlideDrawings.tsx`): the site's house style
    for an inline drawing, on a paper panel, sized so its words never fall below the size they were drawn for
    (on-sale S3b, 2026-11-21).
  - The site's header and footer (`components/Footer.tsx`: the legal links' row, where "Security" joins), the marketing
    kit (`components/marketing/MarketingKit.module.css`), and "Questions a board asks" (`components/marketing/BoardQuestions.tsx`,
    answer 3, where the link to this page is added).
  - The share card that marketing pages already carry (`lib/marketing-metadata.ts`, P7).

## What is already ruled (do not reopen; cite the reason if you disagree)
- **The words are S1's** (v0.4, `/legal`-read). Layout may reorder nothing that S1 ordered without saying why, and adds
  no claim.
- **Hosting is said plainly as the United States (Ohio), suppliers named; never "Canadian" as a selling point**
  (§0b, owner 2026-11-10). Nothing in the drawing (no flag, no maple leaf, no map of Canada) implies otherwise.
- **The owner-continuity question is not on the page** in any form (§0d, owner 2026-11-16).
- **No certification, audit or penetration test of our own** (pen test out of scope 2026-11-15). No badge, seal, shield
  icon, lock icon or "secure" stamp that reads as one: a drawn badge is a claim. The suppliers' certifications stay text
  in their table column, with "These are each company's own certifications… not ours" directly under the table.
- **No prices, plan names or offers, and no sign-up button** (pitch ruling 2026-08-21). The page's job is to answer, not
  to sell. If the page needs a way onward, it is a text link, and `/marketing` names it.
- **Gated with the legal pages:** the page exists only while they are published, so there is no "off" state to draw.
- **P5, P6, P8:** Warm by default and Dark by choice, no dark island; complete when it loads (no scroll-reveal, no
  collapsed sections hiding a claim); no system words.

## The words are locked
The drawing may change type, order of presentation, spacing, and how a table or the diagram reflows. It may **not**
change a sentence, a heading's meaning, a table cell or a diagram label. **The diagram keeps its ten checked labels
word for word** (review rows 1–10), in every form you draw, the phone form included, and so does its accessible
description. A label that must change to fit (a line break is fine; a new word is not) goes to `/legal` with its
before and after. A word the page needs that S1 did not write (a contents-list label, a "back to top", a phone-only
heading) goes to `/marketing`, then `/legal` if it says anything about the product.

## What still has to be decided, by the end of the session
1. **The page's frame.** The legal pages' reading frame (title, one line, text, contents list beside it on a wide
   screen) or a marketing page with a headline (the one named exception) above the reading column. Lean: the legal
   frame with the marketing headline, because a board reads it as a document and it sits in the same footer row; say
   if the evidence says otherwise.
2. **The short answer.** How the three bullets stand out as the first thing read, in the site's kit (the private brief's
   tinted chips are not the site's idiom). It must survive a screenshot (P6).
3. **The diagram, desktop and phone.** The desktop drawing in the site's house style, and a **phone form** that does not
   scroll sideways (the private brief's drawing does: it is a wide SVG in a scroll box). Recommended: the same boxes
   stacked top to bottom, people → app → database, then the three outward services, each label unchanged. Draw both,
   at true size, in both themes.
4. **The two tables on a phone.** "Who handles it" has five columns; "Who can see what" has two. Decide each phone form
   (rows that become stacked records, or a table that scrolls inside its own box), keeping every cell. The
   certifications column and the "not ours" line must stay together.
5. **The held lines and "Read more", in both states.** Draw the page as it ships (Read more version A; the four held
   lines absent; the full-copy line absent unless its page condition is met) and as it reads once the Data Terms
   publish (version B; the held lines in place). Use *Show only what differs* for this pair.
6. **The "as of" line and the contact.** Where the date sits so a reader sees it without hunting, and how the privacy
   address shows (on the real site a link works, but the address is also shown as text).
7. **The two doors in.** The footer row with "Security" beside the legal links (Terms of Service, Privacy Policy, and
   later the Data Terms and the companies' list), and answer 3 of "Questions a board asks" with its second link, "See how
   we protect it". Small specimens of the shipped components, before and after.
8. **Print.** A board member prints this page for a meeting. Decide whether it needs a print view (the private brief has
   one) and what it drops (the site's header and footer, the contents list). Recommended: yes, minimal.
9. **The share card.** What a link to the page shows when pasted into an email or a chat (P7): the S1 title and
   description, on the site's existing card.

## The stations to draw (house layout, true size)
- **A.** The whole page as it ships, desktop, Warm, top to bottom: the cumulative view, so the owner can judge whether
  the short answer and the diagram are what a skimming reader meets first.
- **B.** The same page on a phone (about 390px wide), Warm.
- **C.** Both, Dark (only what differs from A and B).
- **D.** The diagram: desktop and phone forms, side by side, each label marked against its review row.
- **E.** The two tables on a phone.
- **F.** Before and after the Data Terms publish (question 5).
- **G.** The two doors in: footer row and answer 3, before and after.
- **H.** The print view, if recommended.
- **I.** The asks.

## How to run it
- **The drawing is a Claude Artifact HTML page**, never the canvas, in the house layout: sticky section tabs, one
  section visible at a time, the last tab the asks, a `View` row with *Everything* / *Show only what differs* where
  things are compared, numbered markers that match the asks and are clickable (`feedback_mockups_as_claude_artifacts`,
  `feedback_clickable_design_annotations`). Whole screen before detail; true size inside fixed frames (desktop and
  390px phone), so a frame does not reflow with the reader's window. Source file:
  `docs/projects/active/BOARD_READY_SECURITY_PAGE_DRAWINGS.html`, published by that path.
- **Use the site's real tokens and faces** (Barlow Condensed for headings, Inter for text, the Warm and Dark grounds);
  give the document chrome around the specimens a different ground so the frames read as specimens.
- **Run `/design` on the drawing before it goes to the owner** (`feedback_always_run_design_on_mockups`): type on the
  ladder, contrast in both themes, the diagram's smallest word at phone width, no sideways scroll at 390px.
- **`/legal` before hand-off** on every word that is new or moved and on any diagram label that changed (see "The words
  are locked"). If nothing changed, say so in the hand-off.
- **End with the asks**, ranked by how much they change, each with a recommendation, in a paste-back block on the page.
  Tell the owner to open the Artifact on his phone as well as his computer.
- **Record:** the drawing's link and the asks in `BOARD_READY_PLAN.md` §0c S2 (tick it once the owner rules), the
  `BOARD_READY_PROMPTS_INDEX.md` row, and the Board Ready board line, in the same commit. Then the S3 build prompt is
  written from the ruling. Do not commit without the owner's word; stage explicit paths only.

## Not in this session
The build, the route, the footer and `BoardQuestions` code (S3). `/legal`'s read of the page as built at the promote
(S4). The release check line (S5). The sign-up data-flow diagram (a separate §0c item). The vendor questionnaire.
Publishing anything publicly. Changing the private brief's page (it stays as S1 left it until the owner says otherwise).
