# Prompt — Board Ready · the public Security page, Step 3: the build

> One session, pasted into a fresh chat on `dev` (`/clear` first). Written 2026-11-21 from the S2 ruling. A build session:
> it adds the page, the footer link and answer 3's link, and ends with a browser walk for the owner. Plan of record:
> `BOARD_READY_PLAN.md` §0c, the "public Security page" item, steps S1–S5 (S1 done `1dd48c91a`; S2 drawn and ruled
> 2026-11-21, all eleven asks as recommended).

## Why this session exists
The owner ruled (2026-11-21) that the security brief becomes a public page at fieldlogichq.ca/security, so a club board's
first two questions (*does our data leak, and is it sold?*) are answered before the first meeting. S1 locked the words;
S2 drew the page and the owner ruled every ask as recommended. This session builds exactly that drawing. It ships in
**the release that carries the legal pages** and is gated on the same switch, so it can never go live ahead of them.

## Read first (re-read the lines you build on; do not trust this summary)
- **The ruled drawing:** https://claude.ai/artifact/9yp7PVd33SjyRQrSBqXZmv (source
  `docs/projects/active/BOARD_READY_SECURITY_PAGE_DRAWINGS.html`, version 2). Build to it
  (`feedback_build_to_approved_mockups`). Its tab 10 holds the eleven rulings; its page generator holds the words
  exactly as the page shows them, and its two diagram functions hold every coordinate.
- **The words:** `docs/agents/legal/drafts/SECURITY_BRIEF.md` v0.4: the page copy, the furniture table (title,
  description, eyebrow, footer link, answer 3's link, the "as of" line), the four **held** lines, the **page condition**,
  "Revise when", "Never add". `/legal`'s S2 read is its row in `docs/agents/legal/LEGAL_INDEX.md`.
- The design log entry `### 2026-11-21 — THE PUBLIC SECURITY PAGE READS AS A DOCUMENT…` in `memory/design_decisions.md`.
- The shipped pieces it is built from: `components/legal/LegalPage.tsx` + `LegalPage.module.css` (frame, head, 720
  column, contents list, tables and their 640px card rule), `components/marketing/MarketingKit.module.css` (`.page`,
  `.heading`, `.eyebrow`), `lib/marketing-metadata.ts` (`marketingMetadata`, the share card), `lib/legal-links.ts`
  (`resolveLegalLinks`, the only source of legal hrefs), `components/legal/LegalLinksProvider.tsx` (the client side of
  it), `components/Footer.tsx` (`STATIC_ROOTS`, the legal row), `components/marketing/BoardQuestions.tsx` (answer 3, and
  answer 4's full-copy clause), `lib/legal-words.ts` (the legal words' one home, and the pattern for this page's).

## What is ruled (do not reopen; cite the reason if you disagree)
1. **The head is the legal pages' document head**, not the marketing headline: eyebrow "Security" (the kit's eyebrow),
   the title on the kit's section-heading step (as Terms and Privacy), S1's opening paragraph, then the "as of" line
   (ruling 5) in the date-line slot, then the hairline. The contents list beside the text from 1080px, the eleven section
   headings verbatim, **unnumbered**, under the shipped label "Contents". The site's bar and footer as on every page;
   the page adds no button.
2. **The diagram is inline SVG in real text at true size, two forms.** Desktop form (viewBox 680 × 492, in a 720 white
   panel with 20px padding) from 768px up; phone form (viewBox 310 × 966, panel padding 16) below 768px, never wider than
   400px. Never scaled below the size drawn (smallest word 12.5px desktop, 13.5px phone). Copy the drawing's coordinates;
   do not re-lay it out. Every label word for word (review rows 1–10, `MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md`),
   only line breaks differ; both forms carry the brief's accessible description word for word as `role="img"` +
   `aria-label`; only one form is in the accessibility tree at a time (the hidden one is `display: none`). The caption
   under the panel is visible text. Panel and inks from the on-sale drawings (white panel, no outline, paper boxes, dim
   lines, the app the one heavy edge); **not** their sketch idiom and **not** the typewriter face (P1): Inter throughout.
   Colours are `--home-*` tokens only, arrowheads included (`npm run check:public-tokens` holds it).
3. **The short answer is one white card** of three rows divided by hairlines: the page's only card.
4. **Tables:** "Who handles it" uses the shipped legal rule (labelled cards below 640px via `data-label`), "Its
   certifications" the card's last line, the "not ours" sentence directly under the table. **"Who can see what" stays a
   two-column table at every width**: an exception to the legal table rule, so it gets a KEEP row in
   `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` (surface, axis "phone reflow", the reason: two columns fit at 390 and
   cards would repeat "Role"/"Can open" eight times; decided owner 2026-11-21, S2 ask 4).
5. **The "as of" line sits once, under the opening.** Its date is a constant in the page's words file
   (`November 21, 2026` today), written with the long month. It moves only when the whole page is re-read against
   production at a promote (S4, then S5's release line), never by a build.
6. **Version B** (both the Data Terms and the companies list published): the four held lines switch on together (W2 and
   W9 under the "not ours" sentence, before the cross-border paragraph; W8 replacing the breach bullet; the 30-day line
   as the full-copy bullet), "Read more" grows to four links, and in W2/W9 the words "Our public list" and "The Data
   Terms" become links. Every href from `resolveLegalLinks()`; never a typed path.
7. **The two doors:** the footer's legal row gains "Security" first (before Terms of Service), rendered only inside the
   existing `legal &&` block; `STATIC_ROOTS` gains `security` so the footer shows on the page. "Questions a board asks"
   answer 3: "birth date" → "date of birth", and a second link "See how we protect it" → `/security` on its own 44px
   line under "Read the Privacy Policy" (the same `answerLink` class).
8. **Print, minimal:** no site bar, footer, contents list or phone bottom bar; white ground, no card shadows; the
   desktop diagram form whole (a Letter page is about 700px wide at 96 dpi, under the 768px switch, so print forces the
   desktop form explicitly and drops the panel padding to 10px); tables stay tables (the card rule is a screen rule);
   sections and the figure avoid page breaks; "Read more" prints each link's address after it, taken from the same
   href with the protocol dropped. No print button.
9. **The share card is the site's**, through `marketingMetadata` with S1's title ("Security and your club's
   information") and description, path `/security`, indexed.
10. **No Dark version:** the page wears the kit's `.page` (always warm); the marketing guard test holds it.
11. **The privacy contact:** the address is the link (`mailto:`) and its visible text; no copy button.

## The build, in order
1. **Blocking gate first:** present the plain-language UX summary (AGENCY_RULES "Product Manager UX Plan"): what a
   visitor, a board member who prints, and a prospect who follows the link from a club page see; that it appears only
   with the legal pages; and that nothing changes for signed-in users. Then the task list. No code before it.
2. **The words file:** one home for the page's text (e.g. `lib/security-page-words.ts`, modelled on `lib/legal-words.ts`),
   copied from v0.4 and the drawing's generator, never retyped from memory. Then, with `/legal`, apply the one-home rule
   the brief's header names: the product's copy becomes the home for the page text, and the draft keeps its
   "Revise when", "Never add", furniture and held-line records and points at the words file. The private brief Artifact
   is not changed in this session.
3. **The route** `app/security/page.tsx`: a server component, static, no data reads; `notFound()` when
   `resolveLegalLinks()` is null (the legal pages' own gate), so there is no "off" state. Metadata via
   `marketingMetadata`. Add `/security` to `app/sitemap.ts` under the same gate if the legal pages are listed there; if
   they are not, match their treatment and say which you chose.
4. **The page component** (in `components/legal/`, so the existing public-token scope covers it): the legal frame,
   reusing `LegalPage.module.css` and the kit rather than a copy of either; the contents list without numbers; section
   anchors with the bar's scroll margin.
5. **The diagram component**: both forms, from the drawing's coordinates; one CSS switch at 768px; the print override.
6. **Version A / B and the page condition** from the live links: held lines, breach line, "Read more" and the two W2/W9
   links on when **both** `dataTermsHref` and `subprocessorsHref` are present. The plain full-copy line (page condition)
   follows the **same predicate as answer 4's "or ask us for a full copy"**: extract one shared helper used by both, so
   the owner's Ask 29 confirmation, when it comes, flips both in one edit.
7. **Footer and answer 3** as ruled 7.
8. **Print styles** as ruled 8. The bar and footer mount in the root layout, outside the page, so hide them for print in
   a way scoped to this page (not a site-wide print rule).
9. **Tests:** add the page to the marketing guard (`tests/unit/public-face-s4-marketing.test.ts`: always warm, its
   metadata, indexed); a unit test that the diagram's text equals the checked labels and the accessible description
   word for word in both forms; the page renders nothing (404) while the legal pages are off; version B lines absent
   until both links exist; the full-copy predicate shared with answer 4; answer 3's two links and "date of birth"; the
   footer's "Security" link only while the legal pages are on. Before touching any check script's scope, look for it in
   `WATCHED_PATHS` (`scripts/check-agent-automation.mjs`); a watched one changes only on the owner's word.
10. **Checks:** `npm run verify:changed` (includes `check:spelling`), `npm run check:public-type`,
    `npm run check:public-tokens`, `npm run typecheck` (new route), and `check:layout --changed` on `/security`,
    `/for-clubs`, `/for-leagues` at 390 and 1440. The dev server restarts once at the end (new files), per AGENTS.md.
11. **Reviews before hand-off:** `/design` on the built page against the drawing (screenshots at 390, 768, 1080, 1440
    and print preview; the diagram's smallest word at 360px); `/legal` on the page as built against the drawing and v0.4
    (every line still word for word, the held lines and page condition behaving); offer `/review` (substantive: a new
    route, a shared predicate, the footer).
12. **The owner's walk:** a short checkable walk Artifact (20–50 boxes, one action each, the exact dev logins where a
    sign-in matters, signed out for the page itself): desktop and phone, every section present, the diagram on a phone
    with no sideways scroll, the two tables, print preview, the footer link, answer 3 on /for-clubs and /for-leagues,
    the link preview, and the page absent with the legal pages switched off on dev if the switch is reachable. Add its
    ledger row.

## Record
In the same commit: tick S3 in `BOARD_READY_PLAN.md` §0c with the commit and the walk's link, the prompts index row,
and the Board Ready board line. Tick the plan's S1 follow-ups this build closes ("date of birth", answer 3's link, the
full-copy rule on one predicate). Stage explicit paths only; do not commit without the owner's word.

## Not in this session
S4 (`/legal` against production at the promote, and moving the "as of" date) and S5 (the `/release` checklist line; a
change to `.claude/commands/release.md`, made in its own commit). The release itself. Any change to the private brief's
page. The sign-up data-flow diagram, the vendor questionnaire (separate §0c items). The wider "birth date" drift in help
articles and the duplicates cards (a spelling chore). Adding "Security" to the site's top bar.
