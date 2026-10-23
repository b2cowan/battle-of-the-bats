# Club Tier Readiness, Stage 4d: the club's sponsors (build prompt)

> **Written 2026-10-23**, after 4c-2 Part B (walk §362 ✅ 52/52) and coach names (walk §363 ✅ 40/40) were walked. HEAD was
> `89d0ecb04`. **Paste this into a new chat on `dev` and re-verify every lead first**: the leads below were gathered by a helper
> reading the code on 2026-10-23, and its line numbers were wrong, so this prompt names **files, not lines**. Other sessions
> share this working copy (TODO, the Club plan, the ledger and the design log carry their edits).
>
> 4d is **small on purpose** ("a small 4d … so it never holds 4a to 4c up"). It is the last piece of the club's public face
> before **4e** (the club's own web address). Do not let it grow.

## What 4d makes true

A club lists its **sponsors** once, in the Public site editor, and families see them: **a strip above the footer on the club's
home page**, and a **Sponsors section on the About page**. Each sponsor has a **name**, an optional **logo** and an optional
**link**, and an optional **end date**: when it passes, the sponsor leaves the public pages by itself and nobody has to remember.
This is the club's thank-you wall, which sponsors often pay for. It is **club-level only**; a team's own sponsors stay in the
team's money book and are unrelated. **No tiers** (a gold sponsor does not show larger).

## Read first

- **The ruling:** the Stage 4 drawings, https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (source
  `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`): **Ask 17, ruled option A on 2026-10-19** (all 17 asks as
  recommended), and the frame marker "Sponsors" in the end-state frames; Ask 10 puts Sponsors on the About page. The drawings show
  the strip and the section but **not the row window with a logo, nor an ended sponsor** (see the gate).
- `docs/projects/active/CLUB_TIER_STAGE4C1_COPY.md` (the words 4c-1 settled: copy for the three existing lists is the model) and
  `docs/projects/active/OWNER_QA_LEDGER.md` §356–§363 for how the last parts were walked.
- `memory/design_decisions.md`: "Edit autosaves, create asks" (and its 2026-10-09 exception), "One window", "A window's foot",
  the 2026-10-19 "A club's public site" entry, "A close × is a plain glyph".
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to a helper agent, and a helper's summary is a lead, not
  evidence.** Schema = dictionary, same unit of work; decide columns from the snapshots, never migration files.

## Verified state (leads; re-check each)

| What | Then |
|---|---|
| Where the three lists live | One row per club in `org_public_site_content`; `contacts`, `documents`, `questions` are `jsonb NOT NULL DEFAULT '[]'` with a named CHECK per column (`jsonb_typeof = 'array'` and a length cap: 12, 30, 10). Added by migration 343. Two admins saving in the same second keep the later one (dictionary gotcha 6; accepted for these lists) |
| The one rule | `lib/public-site-patch.ts` is the **single home for list kinds**: the `ListKind` union, `LIST_MAX` (must equal the migration's CHECK), the per-field max constants, the per-kind row validator (`ROW`, built on `lib/site-field-checks.ts` `checkEmail` / `checkLink`), `checkListRow` (the editor window uses it), the save-time `list()` (throws a refusal naming the field) and the read-time `cleanSiteList` (drops bad rows, caps). `parsePublicSitePatch` has one line per kind. The row-type conditional is hard-wired to the three existing types |
| Types and db mapping | `lib/types.ts` (`OrgPublicSiteContent`, `SiteContact`, `SiteDocument`, `SiteQuestion`); `lib/db.ts` (`getOrgPublicSiteContent` runs each list through `cleanSiteList`; `PUBLIC_SITE_COLUMN` maps field → column; `upsertOrgPublicSiteContent` writes only the fields given) |
| The words | `lib/public-site-words.ts`: a block per list (title, lead, add, edit, field labels, placeholders, remove, saved, removed), `listsSummary` hard-coded to three counts, `listFull` typed to three nouns with a number-to-word map for 10, 12, 30 only |
| The editor | `app/[orgSlug]/admin/public-site/page.tsx`: a `LISTS` record declares each kind's fields and words; `listPart(kind)` draws the card (a `ClubRowList` of rows and an Add button; at the cap, the `listFull` sentence); `saveList` PATCHes the whole list. The notice card is **`ClubNotice.tsx`** (not "ClubNoticeCard"), a different pattern (posted, never autosaved) |
| The row window | `SiteListRecord.tsx`: generic over a list's fields; field kinds are **text, textarea, email, link only**. Create is a dialog that asks (Save, then close); edit reads first and the pencil flips the whole record, autosaving through the record-autosave hook, held by `checkListRow`; remove asks. **There is no file field and no upload hook in it** |
| The route | `app/api/admin/public-site/route.ts` (GET content + facts + live notice; PATCH runs `parsePublicSitePatch` then the upsert; a refusal answers 400 `{error, field}` and saves nothing). A new list kind needs **no route change**. Access: `lib/public-site-access.ts` (`publicSiteEditor`; read needs `module_public_site`, write is owner or admin) |
| The About page | `app/[orgSlug]/about/page.tsx` asks `requirePublicClubPage(orgSlug,'about')`; sections contacts, documents (banded), questions, each absent when empty; its header comment says "Sponsors join in 4d". `lib/club-about.ts` `clubAboutPageShows` is **hard-coded to the three lists** and gates the About page's 404, the footer's "Contacts and documents" door and the home About card's door |
| The home and the footer | `components/public/ClubSiteHome.tsx` draws its sections once each, then maps the club's order. `ClubFrame.tsx` puts `ClubFooter` on **every** club page (data from `lib/club-frame-data.ts`). So **a strip "above the footer on the home page" is NOT a frame change and NOT a home section**: put it in the home, after the sections |
| Home sections registry | `lib/club-site-sections.ts` holds only teams, league, tournaments, about, archives, with a CHECK on both order columns. **Sponsors is not a section** (no order, no hide switch): registering it would need a new migration restating both CHECKs and break exact-array tests. Do not |
| Editor-builder wiring | `lib/public-site-builder.ts` (`SITE_EDIT_ROWS`, `builderReadiness`: "N of 4 ready" counts `lists = contacts + documents + questions`), `lib/site-edit-marks.ts` (`SITE_EDIT_ROW_KEYS`); a public part that is editable carries a `siteEdit('…')` mark (hand-typed `data-site-edit` is banned by a test). The footer door already reuses `siteEdit('lists')` |
| Logo upload today | Only the club's own logo and banner: `app/api/admin/org-logo/route.ts` (gated by `clubLookEditor`; multipart `file`; `ORG_IMAGE_TYPES` jpeg/png/webp and `ORG_LOGO_MAX_BYTES` 2 MB from `lib/org-image-limits.ts`; public bucket `org-logos` via `lib/org-logo-storage.ts` `ensureOrgLogoBucket`; path `{orgId}/logo.{ext}`; `?v=` stamp). It checks the **declared MIME and byte size only**, no pixel or magic-byte check. The browser uploader is inline in `LookPanel.tsx`; **nothing is reusable as a component or route**. `deriveLogoDataUrl` is a PDF/share-card reader with SSRF and pixel-bomb guards, not an upload validator |
| Collisions | No club-side sponsor concept exists. The coach side owns `sponsorships`, sponsor invoices, sponsor arrivals, `MoneyInSource 'sponsor'`, `buildSponsorInvoiceDoc`. **Use `SiteSponsor` and a `sponsors` jsonb column; never a `sponsors` table or a bare `Sponsor` type** |
| Plan gating | The About page is `module_public_site`; the strip rides the same site switch and module. **No new gate, no price, no plan change** (`docs/agents/strategy/PLAN_PRICING_FACTS.md` is untouched) |
| Fixtures | `LAKESHORE_ABOUT` in `scripts/seed-club-fixture.mjs` seeds the rep-only club "UAT Lakeshore Lynx" (`uat-rep-only`): 2 contacts, 3 documents, 1 question. Its banner is uploaded to `org-assets` in the same file. Demo sandboxes have **no** About content; leave them alone |
| Migrations | 352 is the latest. Take the **next free number** after the latest in `supabase/migrations/` (check). Dev only until the Club release; add a `MANUAL_PROD_STEPS.json` entry, applied to prod **before** the code ships |

## Gate asks (bring these to the owner before any code; each with a recommendation)

1. **Draw the undrawn first, small** (as 4b-2b did for the off-season page), then `/design`: the **sponsor row's window with a
   logo box** (empty, filled, refused), the **ended** state of a row in the editor, the strip at 1440 and 390, and the About
   section. Recommended: yes; the logo box is the one new control in the editor and there is no precedent for it in a list window.
2. **What is required.** Recommended: **name required; logo optional; link optional**. A sponsor with no logo shows its name as
   text, never a blank box; a sponsor with no link is not a link. The drawing says "name, logo and link"; this says the club is
   not blocked from thanking a sponsor who sent no artwork.
3. **When a sponsor ends.** Recommended: the end date is a **day, inclusive, in the club's own time zone** (reuse the club
   notice's end rule and its edge tests, do not write a second clock); after it the sponsor **leaves both public places and stays
   in the editor, marked "Ended"**, so renewing is one edit and nothing is lost. A sponsor with no end date never lapses.
4. **Does a sponsor alone open the About page?** Recommended: **no.** A club with sponsors and nothing else gets the home strip
   only; the About page (and its footer and card doors, labelled "Contacts and documents") still opens only for contacts,
   documents or questions, and shows the Sponsors section when it exists. That keeps `clubAboutPageShows` and the door's label
   honest. The alternative (sponsors count, so the door must be renamed) is a wider change.
5. **The strip is the home page's, not every page's.** Recommended as ruled ("on the home page and on the About page"): the
   footer on team, tryout and Teams pages does not carry it.
6. **A cap.** Recommended **20** (the lists cap at 12, 30, 10); the CHECK and `LIST_MAX` must agree.
7. **Order.** Recommended: **the club's list order** (new sponsors at the end), with hold-and-drag reorder only if the other three
   lists already reorder in the editor (check; copy whatever they do, do not invent a fourth idiom).
8. **The logo file's safety.** It is shown to the public and the existing route trusts the declared type. Recommended: a new
   route that **decodes and re-encodes the image** (sharp, with an input-pixel ceiling, capped to a small display size), so a
   mislabelled file or a pixel bomb cannot be stored, and the stored URL is only ever one the route wrote.
9. **Fixtures.** The rep-only club needs: one sponsor with a logo and a link, one with no logo, one ended. Propose the smallest set
   and get a yes; **never seed mid-sweep** (a seed's password reset signs the saved accounts out).

## What to build (after the gate)

1. **Words first.** Every visible word (the card's title and lead, Add, the window's field labels and placeholders, the refusal
   reasons, "Ended", Remove, the strip's heading, the About heading, the full-list sentence) goes through `/marketing` **before
   code**, modelled on `CLUB_TIER_STAGE4C1_COPY.md`. House rules: sentence case, one spelling, `npm run check:spelling`. The word
   is "Sponsors" on the public side; the editor must not borrow the coach money book's vocabulary.
2. **The schema.** One migration: `org_public_site_content.sponsors jsonb NOT NULL DEFAULT '[]'` with a named cap CHECK, a column
   comment giving the row shape (`id`, `name`, optional logo URL, optional link, optional end day). `DATA_DICTIONARY.md` entry with
   its `dict:col` marker, `npm run refresh:snapshots`, `MANUAL_PROD_STEPS.json`. Decide jsonb vs a table in `/db` and write why
   (the recommendation is the same as the three lists: a short list owned by one row).
3. **The rule.** Add the fourth kind where the three live: the union, `LIST_MAX`, the per-field maxima, the `ROW` validator (name
   required; link through `checkLink`; end day a real date; the **logo URL must be https, on this project's storage host and inside
   this club's own folder, or the row is refused on save and dropped on read**; decide in `/db` whether a dropped logo drops the
   row or only the logo, recommended **only the logo**), the `parsePublicSitePatch` line, the types, the `db` mapping, the words
   file. TypeScript will flag most of it. Add the **public-read filter** (an ended sponsor is not returned to a public page) in
   one pure function, tested.
4. **The editor.** A Sponsors entry in the lists card, in the same pattern as contacts and documents, including the full-list
   sentence and the "Ended" mark. The logo box is a **new field kind or a separate upload step in the row window**: build it once,
   in the window, with the standard disabled/busy/refused states; Create still asks, Edit still autosaves, Remove still asks.
   Update the builder's readiness count and its edit marks only if the owner's gate says sponsors count toward "N of 4 ready"
   (recommended: **no**, an empty sponsors list is not "unfinished").
5. **The logo route.** New route for a sponsor's logo, gated by the **public-site editor rule** (write: owner or admin), not the
   look rule. Per-sponsor storage path, a cache stamp, the safety step from gate ask 8, and a defined clean-up order when a
   sponsor or its logo is removed (the list is saved as a whole; delete the file only **after** the database write, as the logo
   route does).
6. **The public places.** The home strip (absent when there is nothing to show; names as text when there is no logo; links open
   in a new tab with `rel="noopener noreferrer sponsored"`; logos carry the sponsor's name as their text alternative; a phone
   wraps, never scrolls sideways). The About page's Sponsors section (absent when empty, after Questions or before Contacts:
   follow the drawing). The strip carries the `siteEdit` mark. Nothing on team, tryout, Teams or tournament pages.
7. **Seed and walk.** The agreed fixtures; a checkable walk Artifact with **one purpose** (the club lists sponsors, families see
   them, an ended sponsor leaves by itself), each step naming the role it needs, the writing steps saying how to put things back,
   and a phone pass.
8. **Help (`/docs`).** The `public-site-editor` article (its `keywords` and `searchText` too; the "six rows" sentence and the
   "Contacts and documents" description will be wrong) and any hub checklist line that lists what the editor holds.

## Definition of done

- **Tests first, run red, and record it.** Cases: the row validator (name, link, date, logo URL host and folder); `list()` refuses
  and `cleanSiteList` drops; the **end-day edge in the club's zone** (the last day shows, the next day does not, a club in another
  zone); the strip and the About section absent when empty or all ended; the About page's door unchanged by sponsors (if gate ask 4
  is as recommended); the logo route refuses a wrong type, an oversize file, a mislabelled file and a non-editor; the strip is on
  the home only (a guard on the frame and the other club pages).
- Existing pins that will move deliberately: `club-stage4c1.test.ts`, `club-stage4c1-guard.test.ts`, `public-site-builder.test.ts`,
  `club-stage4b2a-guard.test.ts`, `club-frame-guard.test.ts`. Say which you moved and why.
- `npx next typegen`, then `npm run typecheck`, `npm run verify:changed`, the full `npm test` before each commit. Confirm whether
  any failure is pre-existing and report it rather than fixing it inside 4d.
- The dev server restarted once at hand-off (a new route and a migration); `check:layout --changed` on the editor, the home and the
  About page at 361, 390, 768 and 1440.
- `/design` before the walk; `/simplify` then `/review` (high-risk: an admin write path, a file upload, a public route, schema);
  `/docs`; `/marketing` ran first.
- Records: the Club plan's Stage 4 ladder (4d as built, with its commit), the TODO Stage 4 line, the project hub
  https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr (`stages/s4` + one `log` row; read it first; `if_version` on every write),
  memory `project_club_tier_readiness`, and a new Owner QA Ledger § for the walk (**check the ledger's last § right before writing
  it**, other sessions take numbers mid-build).

## Before any code

Per `AGENCY_RULES.md`: a short task list, then the product-manager summary in plain words (what a club admin, a coach and a family
each see differently, and who can do what: the owner and admins edit; coaches see nothing new; families see a thank-you strip).
Then the gate asks above. Then build.

## Do not

- Build 4e (the club's own address), tiers, sponsor-supplied pages, click counts, a sponsor payment or invoice, or any link to the
  coach money book's sponsorships.
- Register Sponsors as a home section, add a hide switch, or touch the section-order migration.
- Put the strip in the shared frame or the footer, or on any page but the home and the About page.
- Reuse the club's logo route for sponsors, or trust a declared file type.
- Change prices, plans or gates; write customer copy without `/marketing`; write to production.
- Touch the demo sandboxes (they follow the product).
- Change shared agent automation or the database checks (`AGENCY_RULES.md`).

## Git

`dev` only. Other sessions' edits sit in TODO, the Club plan, the ledger and the design log: read every staged file's diff and
commit only your hunks, through a private index. Check `git show --stat HEAD` after each commit. **Commit only when the owner
says; do not push.**
