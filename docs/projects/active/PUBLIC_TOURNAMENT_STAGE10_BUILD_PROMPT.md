# Public tournament pages — Stage 10, printable rules (build prompt, three sessions)

> Written 2026-11-18 (Claude), the day the drawing was ruled. Plan row: `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9
> Stage 10. **The drawing is the spec:** `PUBLIC_TOURNAMENT_STAGE10_RULES_PDF_DRAWINGS.html`
> (https://claude.ai/artifact/9XhPUDPn9BZ7XipjVAym67, version 3 "Ruled 2026-11-18"); its tabs 1–5 are the whole-screen
> and true-size specimens, tab 6 the twelve asks, **all ruled as recommended 2026-11-18** (listed below).
>
> Read `AGENTS.md` and `AGENCY_RULES.md` first. Stage 8 has shipped, so there is **no preview switch**: everything in
> this stage reaches customers on its release. Every public tournament page with a Rules page changes (A2's numbers).

## What Stage 10 is (one paragraph, so every part shares it)

The public Rules page gains a download. On a desk, **"Download rules"** (the white outlined button, small) sits at the
right end of the fixed "subject to change" note; narrowed to a division it reads **"Download U11 rules"**. On a phone it
is the **bare download symbol** in the same place, read aloud "Download the rules as a PDF". The tap opens a
**letter-size PDF** in the PDF kit's own header (8 mm colour bar, logo and name band, grey hairline) and footer, holding
exactly what the page shows: a stamp box (download time, the "subject to change" sentence, the live address, a QR code
to the Rules page on every division), then each section with its icon, its number and its numbered points, a "U13 only"
label on a division-kept section, a short "(continued)" header on every later page, and the downloads as readable text.
The page itself numbers its sections and points too (rows, the desk window's title, the phone's in-place panel). No
rule sections, a Rules page off, or an unpublished tournament: no download.

## How this runs: three sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| 1 | The two blocking owner calls (G1, G2); the file: a new drawn document in the PDF kit, registered with the PDF check and its edge cases; the shared band's long-name wrap; the public route that serves it through the page's gates | `check:pdf` green with the new document; the route answering on dev fixtures; commit on the owner's word |
| 2 | The page: numbers (A2), the desk button and phone symbol (A10) with their states, the admin preview, the tests that pin the old page; layout check entries; `/docs` | The page built to tabs 1–2 of the drawing; owner checks it on dev |
| 3 | `/simplify`, `/review`, the QA walk, the records | Walk published; plan §9 row, board line, ledger updated |

**Every part:** the `dev` branch only; stage explicit pathspecs (the board, TODO and the ledger usually carry other
sessions' hunks: commit only yours); a product-owner summary before any code; the owner does browser testing.
**Token discipline:** broad reads go to a helper; read the hunk you are about to edit, not the whole file.

### Rulings this stage stands on (do not re-open them; cite them)

The drawing's asks, all **a**, owner 2026-11-18:
- **A1** The file prints what the page is showing at the tap: narrowed to U11, every division's sections plus U11's,
  U11 in the header, the desk button "Download U11 rules"; the whole book is View all, then the download. No new control.
- **A2** Numbers on the page **and** in the file: "3 · Pitching limits" on each row and window title, 3.1, 3.2 on points,
  following the organizer's order (moving a section renumbers it). See G2 for what is counted.
- **A3** The stamp: "Rules as of Wed, Nov 18, 2026, 3:12 p.m." (the download's moment, on the org clock), the page's
  fixed "subject to change" sentence, the live address. No new data, no "last changed" column.
- **A4** A QR code beside the stamp, page one only, about 2 cm, opening the Rules page with `?view=all`.
- **A5** The kit's 8 mm colour bar in the look's colour, and section headings in the colour; **a colour under 4.5 : 1
  against white prints its headings in ink** (the bar keeps the colour); every rule prints black.
- **A6** Helvetica, the kit's one face. The colour and logo carry the look.
- **A7** Downloads by name; a link prints its address under the name; an uploaded file says "A file on the Rules page.
  Scan the code on page 1 to open it." Never narrowed by division (the page never narrows them).
- **A8** The public download only. No organizer's copy, no admin-screen button.
- **A9** "U13 only" (the division names, joined) beside the heading of a division-kept section, **in the file only**.
- **A10** Phone: the bare symbol (no border, no fill, no word), 44 px, at the note's first-line end.
- **A11** The shared footer is untouched ("Exported: YYYY-MM-DD"). The kit-wide date form is a TODO chore, not here.
- **A12** The "Division:" bar ships as it is (plan §9 *Later · Light-frame touch-ups*).

Standing: whose look prints is the band's rule, `resolveTournamentLook` (Stage 1a; `lib/tournament-look.ts` names
"Stage 10's printable rules" as a reader). The file goes through the page's own gates (Stage 0's D1 lesson: a new public
read is never a side door). One PDF kit, one PDF check. Spelling and time rules (`formatTime()`, "3:12 p.m.").

### ⚠ Two owner calls the drawing did not ask (Part 1, step 0 — blocking; ask before any code)

**G1 · Does a free tournament get the download?** Every PDF today sits behind the paid **`pdf_exports`** feature
(organizer exports: registrations, schedule, results; every coach PDF), and the help says so in a warning titled "PDF
needs a paid plan" (`lib/help-content/exports.tsx` `export-format-pdf`). The drawing's tab 5 drew a free tournament's
file without anyone asking whether it gets one. **Recommend: every plan.** The file is for the people attending, not
an organizer's export tool; a free event's file carries no colour, no logo and "Generated by FieldLogicHQ", and holding
a family's rulebook back to sell the organizer a plan reads badly. The help warning then names the one exception.
Alternatives: follow `pdf_exports` (a free event's Rules page has no download), or a gate of its own. **This is a gating
decision: run `/strategy` to log it** in `BUSINESS_DECISIONS.md` and the Facts doc (`PLAN_PRICING_FACTS.md`) before
building; `/billing` if a gate key changes.

**G2 · What the numbers count.** A2 says numbers follow the organizer's order, but over which list? Sections differ by
who is looking: a narrowed page leaves other divisions' sections out, and a section whose division's schedule is not
published is held back from everyone. **Recommend: number across the whole published book** (what View all shows).
A narrowed page keeps those numbers, so U11 may read 1, 2, 4 when 3 is U13's, and "rule 4.2" means the same line on
every copy. When a held-back division is published, the sections after its section renumber, the same as an
organizer moving one. Alternative: number the list each visitor sees (no gaps, but "4.2" differs between a U11 and a
U13 coach's copy, which defeats A2's purpose).

## What the code does today (a 2026-11-18 census; re-check before you rely on a line)

**The page.** `app/[orgSlug]/[tournamentSlug]/rules/page.tsx` loads rules, resources and divisions and renders
`components/public/PublicRules.tsx` (also the admin preview's body, `isPreview`, through
`app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx`). `PublicRules` renders the empty state
when the page is off or has no rules and no resources; the fixed note (`styles.note`, 14 px `--club-soft`) with the
contact line; `DivisionFilterBar` when tagged content and a saved division exist; then `PublicRuleSections` (client):
one `PublicLinkList` of `PublicDisclosure` rows (`modalOnDesktop`: a 640 px window on a desk, in place on a phone),
points as a bulleted `<ul>` (`PublicRules.module.css` `.items`), a Copy-link action per section, and the "Downloads &
Resources" row last. Division narrowing: the saved-division cookie, `?view=all` off; untagged sections plus that
division's. Points are plain text, line breaks kept, flat, up to 1000 characters, up to 100 a section.

**The data.** `rules` (title, icon, display_order, division_ids), `rule_items` (content, display_order), `resources`
(label, url, display_order). No `updated_at`, no hidden flag. An uploaded file is told from a link only by `supabase.co`
in its url (`DATA_DICTIONARY.md` ~1452). Gates: `getPublicTournamentBySlug` (active or completed only),
`isPublicPageEnabled(t, 'rules')`, `publicPosts(rules, divisions)` drops sections tagged to an unpublished division.

**The PDF kit** (`lib/export/pdf.ts`, jsPDF 4, letter, mm, 14 mm margin, Helvetica only). **Every PDF is made in the
browser today, and none is offered on a public page.** `drawIdentityBand` (~274) draws the logo (aspect-fit in 24×12 mm
from `settings.logoDataUrl`; `drawLogoSlot` ~226, the only `addImage` in the repo), the name at 14 pt bold in one
`doc.text` (**it does not wrap**; `identityBandHeight` ~253 is fixed), line 2 at 9 pt, a 0.3 mm grey hairline.
`footerParts` / `stampFooters` (~303–333; `stampFooters` is not exported). The drawn documents page by hand: the
development summary (~1886–1968: `continuationHeader`, `ensureRoom`, a heading kept with its first line), the practice
run sheet (~1115, keep-with-next, "(continued)" re-titling), and the **family file** (~3616–3702: numbered "1 · Title"
heads and a hanging-indent numbered list), the closest model. Colours `RUN_INK` / `RUN_MUTED` / `RUN_HAIRLINE`
(~1101), `RUN_LINE_H = 4.2`. Hex to rgb is the private `hexToRgb` (~172).

**Logo data.** `lib/export/resolve-pdf-settings.ts` derives a PNG data URL server-side with sharp (`deriveLogoDataUrl`
~92; stock logos are SVG and webp cannot be drawn), but from the org's PDF settings, not the tournament look. The
signed-in route `/api/admin/org/pdf-settings` serves it to members only, so a public visitor's browser cannot get it.

**QR.** The `qrcode` package runs in Node (`scripts/milton-phone-codes.mjs` uses it); the staff kit uses
`QRCode.toDataURL` in the browser for HTML print. No PDF has embedded one.

**Contrast.** `lib/color-contrast.ts` `contrastRatio(a, b)` (WCAG, needs `#rrggbb`). Don't use pdf.ts's
`accentNeedsLightInk` (perceived luminance, deliberately not WCAG).

**Dates.** The zone is global (`ORG_TIME_ZONE = 'America/Toronto'`, `lib/timezone.ts:23`). `formatTime()` for the
clock. "Wed, Nov 18, 2026" has no exported helper; the same `formatInOrgZone(iso, { weekday:'short', month:'short',
day:'numeric', year:'numeric' })` is typed privately in three files. Export one from `lib/timezone.ts` rather than a
fourth copy.

**The PDF check.** `scripts/pdf-documents.mjs` `buildDocuments()`: a drawn document is a `doc({ id, label, entry,
screens, headings, render, edgeCases })` (the family file ~1474 is the model). Coverage
(`scripts/lib/pdf-surface-discovery.mjs`): every exported `download*` function in `lib/export/*.ts` that reaches
`jspdf` needs an entry, and every screen that reaches one must be listed (for Rules: the four files above, including
the admin preview's). Footer wording it matches: `^Page \d+ of \d+$|^Exported:|Generated by FieldLogicHQ`; text must
clear the footer by 3 mm. Anything under `lib/export/` arms the pre-commit PDF check.

**Public routes.** No public route serves a PDF yet. The precedent for a file at a public page's own address is the
team calendar feed (`app/[orgSlug]/teams/[teamSlug]/calendar/route.ts`, `lib/calendar-feed-response.ts`: the page's own
publish question, `X-Robots-Tag: noindex`). Generic limiter: `lib/rate-limit.ts` (`FixedWindowRateLimiter`,
`clientIpFrom`).

**Tests that pin today's page** (each changes on purpose, with the ruling cited):
`tests/unit/public-tournament-stage6-rules.test.ts` (:76–77 the last child is `PublicRuleSections` with section keys
exactly `anchor, icon, items, title`; :67–73 the preview has no copy, download or email action, which A10's inert
preview download changes; :39 item text), `public-page-layout-guard.test.ts:37` (exactly two `<PublicPage>` roots),
`public-tournament-stage2-guard.test.ts:20–41` (`FRAME_ONLY_USERS` for a new component using a shared part),
`phone-secondary-actions-guard.test.ts` (a hand-kept list; a new phone symbol adds its own `describe` block:
`width: 44px`, `border-color: transparent`, `background: none`, the label hidden under 640 px, an `aria-label`).
The Schedule's Calendar button is the visual model (`PublicSchedule.tsx` ~250, `.symbol` 44×44, a `desktopLabel`
shown from 1024 px). Don't copy its installed-app-only wrapper.

**Help.** `lib/help-content/tournaments.tsx`: the organizer's Rules screen (`venues-contacts-rules` → `rules-records`)
and the public page FAQ (`faq-rules-resources`, already stale: it mentions jump-links that no longer exist);
`lib/help-content/exports.tsx` `export-format-pdf` (the paid-plan warning, G1).

**Demos.** The demo tournament seeds no rules or resources, so its Rules page is empty and the download never shows
there. That is `/demos`' call at its cycle, not this stage's.

## The technical choice, settled here: the file is made on the server, at the page's own address

The page's gates, the narrowing cookie and the logo derivation all live on the server, and a visitor's browser can't
reach the logo route. So the file is a **route handler beside the Rules page** (a child segment such as
`rules/pdf/route.ts`; a `route.ts` cannot share the page's own segment). It answers only when the page would: the same
tournament read, `isPublicPageEnabled`, `publicPosts`, the same cookie and `?view=all` narrowing as `PublicRules`, and at
least one section. It returns `application/pdf` with `Content-Disposition: inline; filename="{Event} rules.pdf"`,
`X-Robots-Tag: noindex`, `Cache-Control: no-store` (the stamp says "as of now", so a cached copy would lie), behind a
per-IP `FixedWindowRateLimiter`. jsPDF, `addImage` and `qrcode` all run in Node; the PDF check already renders every
document there. **One shape function** turns the page's inputs into the sections to show (narrowing, numbering per G2,
division labels); the page and the route both call it, so they can never disagree. That is the end state, not a
stopgap: build it once.

## Part 1 · The file and the route

0. **Ask G1 and G2** (above) with their recommendations. Run `/strategy` for G1. No code until both are ruled.
1. **The shape.** A pure function (a `lib/` module) from (rules, resources, divisions, saved division, `view`) to
   `{ narrowedTo: Division | null, sections: { anchor, number, title, icon, divisionLabel, items }[], resources }`.
   Numbers per G2. `PublicRules` moves onto it in Part 2; the route uses it now. Unit-test it with a case table
   (untagged, tagged, narrowed, held back, a U13-only section in the middle, View all).
2. **The document.** `lib/export/rules-pdf.ts`, exporting a builder plus a `download*` entry the PDF check can find (it
   needs one). Model on the family file. Export the kit pieces it needs from `pdf.ts` (`stampFooters`, `drawIdentityBand`,
   `MARGIN`, the run colours) the way the bracket imports `footerParts`; do not copy them.
   - Page one: the 8 mm bar in the look's colour; the band (logo, the event name, "Tournament rules · {dates} · Hosted
     by {host}", and "· U11 rules" when narrowed); the stamp box (A3) with the QR (A4) as a PNG data URL from
     `qrcode` in Node; then the sections.
   - Sections: the icon (drawn as a small image or vector, the six rule icons), "3  Pitching limits" at 12 pt bold in
     the heading colour (A5: the look's colour, or ink under 4.5 : 1 via `contrastRatio`), the division label (A9), points
     at 10 pt black with a hanging number in a column sized to the widest number in the file, line breaks kept.
   - Paging: a point never splits unless it alone is longer than a page; a split section keeps at least two points on
     each side or moves whole; a heading never ends a page; every later page gets the compact continuation band
     (bar, name left, "Tournament rules (continued)" right, hairline); a continued section repeats its title with
     "(continued)", no icon.
   - Downloads last (A7). Then the shared footer, unchanged (A11).
3. **The long name.** Teach the shared `drawIdentityBand` to break a name that doesn't fit onto two lines (the band
   grows by one line). A one-line name must draw **byte-identically** to today: the PDF check renders every document,
   so prove it with the existing documents passing unchanged plus a long-name edge case. If that proves risky, wrap in
   the rules document only and record why.
4. **The look.** `resolveTournamentLook` for the colour and logo; the free look draws a near-black bar, ink headings, no
   logo. Derive the logo's PNG data URL on the server with the existing sharp derivation (reuse `deriveLogoDataUrl`;
   decide whether to cache it like `pdf_settings.logoDerived`). A logo that fails to derive prints no logo, never a
   failed download.
5. **Register with the PDF check:** a `doc({...})` entry, the four Rules screens in `screens`, edge cases: a long name; a
   section split across pages; a pale colour (headings fall back to ink); the free look (no logo); narrowed to U11 with
   a U13-only section; a "12.10" number; resources that are all files; a single section. Run `npm run check:pdf`, then
   its `--mutate` proof.
6. **The route** (the settled choice above) with its refusals: page off, unpublished tournament, no sections → 404, the
   same not-found the page gives. Unit-test the gates; on dev, open it for a fixture tournament in each look.
7. Product-owner summary; commit on the owner's word (its own commit: `lib/export/` arms the PDF check).

## Part 2 · The page

1. **`PublicRules` on the shape** (step 1.1): the same sections, with numbers. `PublicRuleSections` shows
   "3 · Pitching limits" (the number in the dim ink, drawing tab 1) on each row and in the desk window's title, and the
   points as a numbered list with a hanging number (the window and the phone's in-place panel). No division label on
   the page (A9).
2. **The download** in the note's row (drawing tab 1): on a desk the white outlined small button (R11; `hostBtn` /
   `.btnSecondary` + `.btnSm`): download icon, "Download rules" or "Download {division} rules", a dim "PDF"; on a phone
   under 1024 px the bare symbol, `aria-label="Download the rules as a PDF"` (or "…the U11 rules…"). The note wraps
   beside it. It is a link to the route (the current `?view=all` carried), not a script, so it works without the
   client bundle; states (tab 2): while the file is fetched the symbol turns to a spinner and the button reads
   "Preparing…" at its own width, and can't be tapped twice; on failure one line under the note, "The rules couldn't be
   prepared. Try again." **If a plain link can't show the spinner, say so in the summary and pick the honest one**
   (a link that opens the PDF viewer needs no "Preparing" at all); don't fake a state.
3. **Absent** when the page shows its empty state, or has downloads but no sections. **The admin preview** shows it
   inert, like the preview's other doors.
4. **Tests:** update the four pinned tests on purpose, citing A2, A10 and the preview ruling; add the phone symbol to
   `phone-secondary-actions-guard.test.ts`; a test that the route and the page call the one shape.
5. **Layout check:** extend the existing Rules entries (`pubt-rules-pale`, `admin-t-rules`) or add narrowed and desk
   states; measure 360, 390 and 1280 for no sideways scroll and no tap under 44 px. `check:layout --changed` only on
   the dev server.
6. **`/docs`:** the organizer's Rules screen (moving a section renumbers it, the download its visitors get); the public
   Rules FAQ (rewrite the stale jump-links answer); the PDF paid-plan warning per G1. `check:spelling` is in
   `verify:changed`.
7. Product-owner summary; the owner checks it on dev; commit on the owner's word.

## Part 3 · Review, the walk, the records

1. `/simplify`, then `/review` (four lenses). Ask the review to try the side doors: a held-back section, a page switched
   off, a draft tournament, another org's slug, a forged `?view=` or cookie, a 100-point section, a logo that fails.
2. **The QA walk:** a checkable Artifact, 20–50 steps, one action each. Cover: desk and phone; narrowed and View all; each
   look (club, Tournament Plus own, free, pale); a long section across pages; the black-and-white print of a real
   printout if the owner has a printer; the QR opening the page; the refusals; the admin preview inert. Fixtures with
   setup and undo scripts in `.probe/`.
3. **Records:** plan §9 row 10 (built, commits, the walk), the board's Public tournament line in the same commit, the
   ledger section. `/release` carries it with the next promote. There is no migration and no switch.

## Not in Stage 10 (say so if a step drifts toward one)

- An organizer's copy, an admin-screen button, or held-back sections in any file (A8).
- A "last changed" date or any new rule column (A3).
- The tournament's own type face in a PDF (A6), or any change to the shared footer's date (A11; TODO chore).
- Restyling the "Division:" bar (A12; plan §9 *Later · Light-frame touch-ups*).
- Seeding rules into the demo (`/demos`' call at its cycle).
- Stage 9 (the game-order rule) and the sponsors row.
