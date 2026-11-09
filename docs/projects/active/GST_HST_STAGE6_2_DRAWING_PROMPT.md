# GST/HST Stage 6 · step 6.2 — the drawing round (kickoff prompt for `/design`)

> Written 2026-11-08 by the 6.2 planning session (`/plan`, Opus). Owner ruled Q4 "a short `/design` round before the build"
> (2026-11-08, "agree as recommended"). Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) §5 6.2
> (the RULED block there holds all six 6.2 rulings). Build prompt that waits on this: [GST_HST_STAGE6_2_BUILD_PROMPT.md](GST_HST_STAGE6_2_BUILD_PROMPT.md)
> — its **Chunk 2** is built to these drawings; Chunk 1 (no visible surface) does not wait.

**Start it with:** `/design execute @docs/projects/active/GST_HST_STAGE6_2_DRAWING_PROMPT.md` (Opus).

## Read first (only these until a frame needs more)
1. The plan's §5 6.2 RULED block (Q1–Q6) — what is ruled and must not be re-opened (no email footer; "Effective {date}" only).
2. Terms draft §1–§3 and §20 (`docs/agents/legal/drafts/TERMS_OF_SERVICE.md`); Privacy Policy draft §6 (its table) — the
   text the frames show, as the preview will show it (notes removed).
3. The shipped components named in Step 2, opened at the cited lines, and the marketing frame as it renders on `/pricing`.
4. Memory: the drawing notes in the index ("Mockups → Claude Artifacts", "Draw a control from its SHIPPED component",
   "/design on every mockup BEFORE hand-off", "Portal = the formatting benchmark").

## What this session is
One short drawing round: an HTML Claude Artifact (house mockup layout, true size, phone and desktop), `/design`'s own review
before hand-off, then the owner approves. **No product code.** The words come from `/legal` (step 1), not from this session.

## Step 1 — `/legal` drafts the page words (before drawing)
Run `/legal` for these strings only, and have it add them as a **"Page words"** block under Terms draft §20
"The words the product shows" (that subsection is already the home for product copy and is never shown on the page):
1. The effective-date line at the top of a page — recommended shape "Effective {date}" (date as the product writes dates).
2. The earlier-version line — ruled shape (Q5): "This is an earlier version, in effect from {date} to {date}. Read the current version."
3. The draft banner on a dev preview — e.g. "Draft — not published" (only ever seen on dev).
4. The mark a still-blank fact shows in a preview (the `[phone]`, `[mailing address]` brackets) — e.g. "to be filled".
5. The link labels: "Terms of Service" and "Privacy Policy" (already the drafts' titles) and, if the menu option below is
   chosen, the short forms ("Terms", "Privacy").
6. The account page's row label (the reserved row; the 2026-07-20 comment).

## Step 2 — draw these frames (phone and desktop each)
1. **The reading page**, Terms of Service, current version, on the **marketing frame** (the site's top nav and the marketing
   footer — these are FieldLogicHQ's own pages, not a club's). Above the text: the title, the effective-date line, nothing
   else (ruled Q5: no "last updated", no "earlier versions" list until a second version exists). The body is long prose with
   numbered `##` sections, `###` subsections, bullet lists and (in the Privacy Policy) **tables** — draw a stretch of §1–§3 of
   the Terms and one Privacy Policy table (§6, who we share with). Borrow by choice from
   `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` R1 (prose holds to 720 px) and R4 (heading levels); note that standard's
   scope is tournament and club pages, so this page is not bound by it — say which rules you borrowed.
   ⚠ Decide whether a contents list (20 sections) earns a place; recommend, do not add by default.
2. **The same page, an earlier version** — the earlier-version line in place.
3. **The dev preview** — the draft banner, and one blank fact showing its "to be filled" mark (§1's telephone line).
4. **The account menu**, desktop popover and phone sheet, drawn from the shipped component
   (`components/shared/AccountMenu.tsx` — rows What's new · Your family · Notification settings · Send feedback · Account
   settings, a separator, Sign out). **Lead option (owner-endorsed recommendation):** a small "Terms · Privacy" line *under*
   Sign out rather than two more full rows. Draw the alternative (two rows) beside it so the owner sees both. Note: the
   platform console's menu hides Account settings — draw that variant too.
5. **Under a sign-in form** — the shared foot row (`StartFoot`, `components/auth/AccountForm.tsx:25`) on the sign-in page,
   with the legal links added; and the platform-admin login card (its own card, `app/platform-admin/login/page.tsx`).
6. **The marketing footer's bottom row** — "© {year} FieldLogicHQ. All rights reserved." with the two links beside it
   (`components/Footer.tsx:160–164`).
7. **The account page's reserved row** (`app/(consumer)/account/page.tsx:68–72`) among the existing rows.

**Not drawn (ruled Q6):** no footer in FieldLogicHQ's own emails — the owner removed it 2026-10-20 and that stands; the
purchase email (6.4) carries the version link in its body.

## House rules for the drawing
Claude Artifact HTML page (never the canvas), house mockup layout, true size, draw every control from its **shipped**
component and shipped strings, every highlight clickable, `/design` review before hand-off (memory notes in the index:
"Mockups → Claude Artifacts", "/design on every mockup BEFORE hand-off", "Draw a control from its SHIPPED component").

## Hand-over
The artifact link and its source path written into the build prompt's **Drawings** line and the plan's §5 6.2 progress line;
the owner's approval (or changes) recorded there. Then the build's Chunk 2 can start.
