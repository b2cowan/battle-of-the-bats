# Public site builder — plan

**Status:** DRAWN + RULED 2026-10-21 (A1–A9, owner; A9 against the recommendation: in the first build). BUILT
2026-10-22 in one pass (§6); walk §357 rewritten to cover it.
Drawing: https://claude.ai/artifact/LSWvZmV9r1772Zt4etqcaM (source `PUBLIC_SITE_BUILDER_DRAWINGS.html`).
PM brief: `PUBLIC_SITE_BUILDER_PM_BRIEF.md`. Rides the Club release (Club Tier Stage 4, beside 4c).
Design decision: `memory/design_decisions.md`, 2026-10-21 "The public site is made with the site beside you".

## 1. What changes

The club admin's **Public site** editor (rebuilt in Stage 4c-1, `e6d9790fc`) is one page of nine stacked cards today.
It becomes:

- **Header** — unchanged: title, Online / Offline chip, "Families see it at", Copy link, Open (Open hidden while offline).
  The "It is on. Turn it off in Settings" line retires.
- **Club notice strip** — first in the left column, only while the site is online. "Showing now" as today, Edit + End
  now beside it; Post / Edit open the standard window (a held change, the 2026-10-09 exception). With none showing:
  "No notice showing" + Post a notice.
- **Five rows that open in place** (one open at a time; a one-line summary when closed):
  1. **Look** — Logo (upload, stock logos, remove) · Colours ("From your logo" first when a logo exists, then the nine
     presets, then custom; the existing colour sentence underneath, including the "we made it darker" line) · Type
     (Classic · Serif · Clean, each showing the club's own name) · Banner photo (says phones leave it out).
  2. **Home page** — the 4c-1 section list unchanged (number handle, switch per section, Open now fixed first).
  3. **About the club** — tagline, about, questions email, **plus the social links** (their own card retires).
  4. **Contacts and documents** — the three lists (Who to contact, Documents and policies, Questions families ask), each
     record still opening its window.
  5. **Visibility** — owner: "Public site" and "Listed in the club directory" switch rows with today's Settings
     sentences and the existing "Take it offline?" window; the web address as text + "Change it in Settings". Admin: the
     values as text + "The owner turns the site on and off and changes its address." No greyed switches.
- **Preview** (desktop, right column, stays in view) — the club's home page as families see it, redrawn after each
  autosave; Computer / Phone view pill. While offline, an amber line: "Only you and your admins can see this. Your site is
  offline." **A9:** clicking a part of the preview opens the row that sets it (bar / logo / colours → Look; a home
  section → Home page; About column / footer email / social → About the club; "Contacts and documents" → that row).
  In the preview, links do not navigate.
- **First run (A8)** — until the site first goes online, a "Set up your site · N of 4 ready" card with a segmented bar
  sits above the rows, each row starts with ✓ / ○, and the owner gets the one lime **Go live**. Nothing is required.
  An admin reads "When it's ready, the owner puts it online." After the first Go live the marks and bar never return;
  a missing tagline shows as a small amber pill in the row's summary.
- **Phone** — rows open in place (2026-10-12 rule); Copy link / Open are their symbols alone (2026-10-20); the Look row
  carries a live strip of the club's bar and phone tab row; while offline, Open becomes **Preview** (eye) opening the
  whole site in a full-screen window with a back arrow.

**Settings** (owner only) keeps: Organization details (name, web address — unchanged fields, warning and Save) · a door
card "Your public site — its logo, colours, type and whether it is online are set in Public site" · Delete organization.
Leaves Settings: Your public site (both switches), Organization logo, Colour theme, Hero banner, Font family, Card style.

## 2. Rulings (A1–A9, 2026-10-21)

| Ask | Ruled |
|---|---|
| Option A (who) | Admins and the owner change the Look; the owner alone holds the on/off switch, the directory listing, the name and the web address |
| A1 | Rows beside a preview |
| A2 | The owner and admins see their offline site in the preview |
| A3 | "From your logo" offered first whenever there is a logo |
| A4 | Three tiles: Classic · Serif · Clean; "System" retires |
| A5 | Card style leaves the club's controls; tournaments set it on their Branding page |
| A6 | The Look autosaves with the floating Saved pill |
| A7 | Notice = one strip at the top; Post and Edit open the window |
| A8 | Checklist until first online; nothing required to go live |
| A9 | Clicking the preview to edit — in the first build |

Replaces: Stage 4 Ask 6 (2026-10-19, list of cards, Look read-only) and the Stage 4 drawings' line "the site's on/off
switch stays in Settings (owner only)". The 4c-1 copy for the Look card and the header's Settings links retire.

## 3. Findings from the drawing (verified in code 2026-10-21)

- **Card style has no visible effect on the club's own pages.** The org layout sets `data-card-style`, but the variants
  target the global `.card` class and the club kit uses module classes. It reaches tournament pages only, where the
  tournament's own pick wins and the org value is a fallback (advanced branding plans only).
- **A5 follow-through:** the tournaments' Branding page already has a per-tournament card style picker. So A5 means:
  remove the club-level picker from Settings; keep the stored org value as the silent fallback so no tournament's look
  changes. ⚠ Confirm at the build gate that nothing else surfaces the org value.
- **Fonts:** `clubFace()` maps everything but `dm-serif` and `inter` to the warm pair, so "System" and "Barlow" render
  the same. A4: the stored values stay; "System" and "Barlow" both read as Classic in the picker; new picks write one
  value for Classic (decide which at build; no migration needed either way).
- **Settings' colour preview** draws the retired dark public palette — retires with the move.

## 4. What it takes (for the build prompt)

1. **The preview** — the biggest piece. The home page rendered inside the editor at true layout, scaled; redrawn after
   each save; computer and phone widths. **A2** needs the club's pages to render for that club's own owner and admins
   while the site is offline (today the refusal shows to everyone). That is an access rule on a public route: it must
   not leak the offline site to anyone else, and the staff session is the only key.
2. **A9 click-to-edit** — a map from preview regions to rows; links inert inside the preview.
3. **A3 colours from the logo** — pull two strong colours from the uploaded logo, run them through the existing colour
   roles (fill darkened to 4.5 : 1 etc.), offer as the first chip. Show "From your logo" only when a logo exists.
4. **Moving controls** — logo, colours, type, banner and the two switches into the editor. The editor's write route
   already admits owner + admin; the switches stay owner-only on the server (today's Settings PATCH refuses non-owners —
   that guard must move with them, not be dropped). Autosave replaces the Save button for the moved fields (A6).
5. **Settings** shrinks to name, web address, the door card, delete.
6. **Copy** — `/marketing` for new strings (checklist, Go live, Visibility sentences, preview line, door card).
7. **Help** — `/docs`: the Public site articles (header, Look, Settings and the public site), the role guide line.
8. **Guards** — anything asserting the Look card or the Settings links in the editor; add a guard that the switches stay
   owner-only server-side.

Gate before code: build prompt with the ruled specimens above; `/design` on any new specimen (the preview's offline line,
the click-to-edit hover) before code.

## 5. Sequencing (owner 2026-10-22: "lets build this and rewrite the 357 walk accordingly")

- **§357 was rewritten, not walked twice.** One walk covers 4c-1's public pages and this builder
  (https://claude.ai/artifact/2V6xD278XTcGgQHiN4yZr6, version 2; ledger §357).
- **Recommended order after it:** this builder → walk §357 → **4c-2** (the teams' side: born years, the coach's door, the
  team page's coaches — it touches no editor screen, so it can start in another session at any time) → **4d** sponsors
  (adds a list the editor shows — build it on the new rows, not the old cards) → **4e** a club's own web address (changes
  the address the editor's header and Settings show; needs its hosting spike first).

## 6. Built 2026-10-22 (one pass)

- **Editor** — five rows that open in place (`BuilderRow`), the notice strip + window (`ClubNotice`), Look
  (`LookPanel`, with `StockLogoWindow` moved out of Settings), Visibility (`VisibilityPanel`), the set-up card, the
  preview pane / window (`SitePreview`). Words in `lib/public-site-words.ts`; rules in `lib/public-site-builder.ts`
  (looks, readiness, the edit rows, Option A's role and field lists); `lib/logo-colours.ts` (A3).
- **Preview** — an admin-path page (`app/[orgSlug]/admin/public-site/preview`) for the club's owner and admins only,
  reading the club AS IF OPEN (A2); AdminChrome's focused shell; framed at 1280 / 390 and scaled; double-buffered redraw
  that keeps the scroll; `data-site-edit` marks on the club's bar, sections, notice and footer (A9; a name, no
  behaviour); links, forms and Follow inert inside the frame. The home and the frame now read through ONE loader each
  (`lib/club-home-data.ts`, `lib/club-frame-data.ts`), shared by the public pages and the preview.
- **Server (Option A)** — `clubLookEditor` (accepted owner or admin) on the logo, stock-logo and banner routes; the
  org-settings PATCH refuses an admin any field outside the look, whole.
- **Settings** — name and web address (Save + guard unchanged), the door card, delete. Card style's club picker gone (A5).
- **Help** — `lib/help-content/org.tsx` (Settings, the editor's article with new Preview / Set up / Visibility subtopics,
  the role guide, the getting-started tip, the not-found article, the field-closure FAQ).

**⚖ A8 as built differs from the drawing, on a fact the drawing missed:** a new club's site is ONLINE from creation
(`organizations.is_public` defaults true), so there is no first "Go live" moment to wait for. The set-up card and the
row marks show while any of the four parts is not ready OR the site is offline; the owner's lime Go live shows whenever
the site is offline. Nothing new is stored. Put to the owner as walk call c1 (the alternative: new clubs start offline,
which would make their tryout and team pages refuse until Go live).

**Also found:** the preview had to be an admin page, not a flag on the public address — the club layout reads no session
(by design, to keep anonymous pages cheap and cacheable), and a staff-only render of a public sub-page could be stored by
the service worker and replayed to the next person on a shared device.

**/simplify + /review done 2026-10-22** (four cleanup lenses, then four review lenses: security and tenancy, correctness,
data and contract, regression). Applied from /simplify: one set of image limits (`lib/org-image-limits.ts`), one typed way
to mark a public part for the preview (`siteEdit(row)`, pinned by a source-scan test), one editor-access rule
(`lib/public-site-rules.ts`, pure, so the preview PAGE never imports the file that resolves auth), debounced preview
redraws, dead words/CSS/ids removed. From /review: **an admin now needs the editor itself** (public-site capability on a
plan that carries the module) to change the look — the owner is unchanged; the starting row of the editor is chosen once,
not re-derived from readiness (finishing a part had closed the row being typed in); a notice window can't open while the
site is offline; two quick Look picks no longer snap back; own colours start from the club's current colours; a refused
upload's message clears on a retry; a shaded edge of a logo is no longer offered as its second colour; the preview's
catch is narrowed to the billing throw; the PDF settings page now says Public site, not Settings, for the logo. Security
lens: no High or Medium — an admin can reach no owner-only field and no other org's assets.
**Known, not changed:** `crossOrigin='anonymous'` on the logo read means a storage host without CORS shows no "From your
logo" chip (silent; the walk's Part 3 tests it); a typed save in flight across an org switch (as the old editor); scroll
restore after a redraw is best-effort on a very long home; the preview boots the admin provider tree inside its frame
(a few extra client calls per redraw).

**Owed:** walk §357; `/marketing` on the new words; `check:layout --changed` on the editor, the preview and Settings.
