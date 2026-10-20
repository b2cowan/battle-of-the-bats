# Club Tier Stage 4b-1: the frame (build prompt)

> **Written 2026-10-20** by the Stage 4a build session, after 4a was committed (`d82ad01a3`). **Paste this into a new chat on
> `dev`.** The owner split 4b in two on 2026-10-20 ("agree with your recommendations"): **4b-1 the frame** (this prompt: how
> every club page looks) and **4b-2 the pages** (what is on them). The frame changes every club page at once, so it ships and is
> walked on its own, and 4b-2 is built inside it. Do not build 4b-2's parts here.

## What 4b-1 makes true

A family who opens any of a club's own pages (home, a team, a tryout and its sign-up, the house league, past tournaments) sees
**the club's site**, not five products: a light page in the club's colours, the club's own bar at the top with its name, logo
and Sign in, the same footer at the bottom with the club's contact, and nothing of FieldLogicHQ's but a quiet credit. No
Discover, no Pricing, no platform phone bar, no green-on-black terminal lettering. Every page title names the page and the club.
Whatever colour a club picked stays readable. **Nothing moves on a page**: the home keeps today's sections in today's order,
the team page keeps its parts; 4b-2 reshapes them inside this frame.

## Read first

- **The drawings and the rulings:** https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (source
  `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`, ruled 2026-10-19, all 17 asks as recommended). For 4b-1 read: Start
  here (the ladder's 4b row), End state 1 (the header chip, the phone and desktop frames), 5 (the in-club "not found"), 8
  (titles; the preview cards are 4b-2), 9 (the club's colour made safe), 10 (house league and past tournaments get the frame,
  one name each), the Design check tab, and Asks 1, 7, 8, 13.
- `memory/design_decisions.md` entry 2026-10-19 "A CLUB'S PUBLIC SITE…" (with its 2026-10-20 amendments).
- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4 (the 4a as-built record: what the refusal and the
  in-club "not found" do today, and the guards).
- `docs/agents/strategy/BUSINESS_DECISIONS.md` 2026-10-19 "A club's own public pages advertise nothing at any width" (amends
  2026-08-01 D1 and point 2), and 2026-07-30 (the quiet "Built on FieldLogicHQ" credit).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's summary
  is a lead, not evidence.** Every file:line below was verified on 2026-10-20 at HEAD `6ee45587`; re-read before you rely on one.
- Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before metadata or layout work. `proxy.ts` does not run on
  public org routes.

## The ruled spec (from the drawings; quote them, don't re-derive)

| Part | Ruled | Where |
|---|---|---|
| Ground | Light: `#F6F5F2` page, `#FFFFFF` cards, ink `#1F1B16`, soft `#4E473D`, dim `#6F675B`, lines `#E4E0D8` / `#D6D0C4`, field border `#948B7D` (3.4 : 1). One green status: `#2C6A2A` on `#E6F0E2`. Cards 8 px, no shadow, **no tints** (DC-02) | drawings `.cs` CSS (~L150), Design check |
| Dark theme | **Club pages stay light** whatever the visitor's theme: "public pages never follow the account theme (TH-1 / M2, R2)". The 4a refusal is the exception (neutral system screen, it follows the theme) — keep it | Design check row 1 |
| Type | Warm faces by default (titles Barlow Condensed 700, text Inter); the club's chosen font kept (DM Serif → DM Serif titles + DM Sans text). Sentence case, **no mono** on club pages (DC-03), only the steps 12 · 14 · 16 · 20 · 24 · 32 (DC-05), bands and column headings in the club's text face in capitals, 700 12 px .06em (DC-06), the status chip the product's Inter pill at 12 px (DC-04). Section heading 16/700; page title 32 px display face | Ask 1A, Ask 13A, Design check |
| The club's colour | Four roles from the main colour: **fill** (bar, footer, buttons), **text on fill** (white or near-black, whichever is clearer), **ink** (darkened to 4.5 : 1 on the darkest ground it sits on: links, the selected tab, Up next), **edge** (3 : 1 on the light ground: a light button's border, the Open now callout). **Accent = decoration only** (the 3 px rule under the bar and over the footer, the logo tile). A colour that fails 4.5 : 1 with both texts has its fill darkened until white clears it. Derived when the page renders, from the colour already saved: every club gets it without doing anything. (The Look card's "We darkened your pink slightly…" sentence is **4c**.) Worked values to test against: Lynx navy `#1F3A5F`/gold; Harbourview yellow `#F2C230` → on `#1F1B16`, ink/edge `#886D1B`; sky `#7CC8E8` → ink `#487487`; pink `#E0457B` → fill `#D04072`, ink `#B03862` | End state 9 |
| The bar | The club's colour band, **72 px, 44 px logo** (initials when none), the name in the title face 20 px (24 at desktop) with a one-line tagline at 12 px, and **Sign in** (44 × 44) at the right. 3 px accent rule underneath. Phone: a white tab row under the bar (14/600, 44 px, the selected tab ink-underlined 3 px). Desktop (content 1,200 px): the tabs sit in the bar beside the name (16/600, the selected one with an accent underline). **No Discover, no Pricing at any width** | End state 1, Ask 7A |
| The phone bar | The platform's bottom bar (Home · Scores · Sign in) **leaves every club page** (home, team, tryout, league, past tournaments); tournament pages keep it | Ask 8A |
| The footer | One footer on every club page: the club's name, "Questions? Email the club", the address with a **Copy** button, social links as 44 × 44 tiles named for screen readers, and the quiet "Built on FieldLogicHQ" credit under a hairline. A part with nothing to show is **absent**. ("Contacts and documents" and the About page it opens are **4c**: leave them out.) | End state 1 footer chip, Ask 10A, /design change 5 |
| Titles | Every club page titled "page · club" ("15U AAA tryouts · Lakeshore Lynx"; the home is the club's name), described in the club's own words (the tagline; never FieldLogicHQ's sales line, S4-02) | Ask 7A, End state 8 |
| Names | "Past tournaments" everywhere a club page says Archives (tab, page heading) | design log "Names" |
| In-club "not found" | The club's bar and footer around it; heading "We couldn't find that page"; buttons full width. Snap the drawing's 28 / 15 px to the steps (32 / 16). "See all teams" waits for 4b-2's Teams page: keep today's single home button | End state 5, second frame |

## Verified state (leads; re-check)

| What | Today | Where |
|---|---|---|
| The club's top bar | The global Navbar's org branch: logo + name, a "›" section crumb, **Discover** (with a click beacon), **Pricing**, Account / "Sign In", and the staff door slot (FlipPill → WorkspacesPill → a direct pill). 72 px (`--nav-height-base`). Not touched by First Look 1d | `components/Navbar.tsx:268-357` (the `<nav data-club-chrome>` at :294) |
| Section tabs | Separate fixed row under the bar, mono uppercase, 2 px `--primary-light` underline; publishes `--org-sections-h` / `--nav-height` | `components/public/OrgSectionTabs.tsx` + `.module.css` |
| Phone bar | ConsumerNav's org-public branch, `aria-label="Primary"` | `components/consumer/ConsumerNav.tsx:147, 282-289` (⚠ another session edits this file: commit through a private index) |
| Footer | **None on club pages** (`resolveSurface` returns null for `/{org}/…`) | `components/Footer.tsx:64-100` |
| Theme | `resolveTheme` → primary, primaryLight (lifted toward white, a dark-ground recipe), onPrimary, isLowContrast; written as `:root` vars by the org layout with the font vars | `lib/themes.ts:112-144`, `app/[orgSlug]/layout.tsx:125-158`; reuse `lib/color-contrast.ts` (relativeLuminance, pickInk) — it has no exported ratio, add one there |
| Org fields | `logoUrl`, `heroBannerUrl`, `themeFont` (system / inter / barlow / dm-serif), `themeCardStyle`, `themePreset/Primary/Accent`; tagline + contact email + social links on `org_public_site_content` (`getOrgPublicSiteContent`) | `lib/types.ts`, `lib/db.ts:1363` |
| Club pages' grounds | Home: tokens on `var(--bg)` (`Home.module.css`, 1,793 lines, 44 mono uses). Team page, tryout landing + register: hard-coded `--pitch-black` and lime inline. League (6 pages + StatusLookupForm) and archives (2 pages, "Digital Ledger", IBM Plex Mono for the whole page): heavy inline dark styles. About 330 inline style objects across league, archives, team and tryout | `app/[orgSlug]/page.tsx` + `Home.module.css`; `teams/[teamSlug]/page.tsx:68`; `components/rep-teams/TryoutLandingView.tsx:28`, `TryoutRegisterView.tsx:29`; `league/page.tsx:59` and the five `[seasonSlug]` pages; `archives/page.tsx:27-60`, `archives/[archiveId]/page.tsx:105-112` |
| Titles | Layout template `'%s \| {Club}'`, no page sets its own title; description inherited from `app/layout.tsx:43` (the platform's sales line) | `app/[orgSlug]/layout.tsx:46-73` |
| Guards that pin today's frame | `tests/uat/scenarios/anonymous-public-invariant.spec.ts` asserts the phone `navigation 'Primary'` with Home · Scores · Sign In on org pages (:186-218), the Discover link (:128-142), the "›" crumb (:147-165), the `Sections` row (:232-260). `tests/unit/club-stage4a-guard.test.ts:125-132` pins the `data-club-chrome` markers and the refusal's `aria-label='Primary'` hook | update them to the rulings, never delete a protection without its replacement |
| Layout sweep | Supports `session: 'anon'` (mkt screens, `scripts/layout-screens.mjs:1764-1772`), **no club public screen**. Context has `clubSlug` (`scripts/uat-fixture-context.mjs:467`); team and tryout paths need a team slug added | not a watched automation path |
| Help | `lib/help-content/org.tsx` `public-org-page-app-access` describes the phone bar, Discover and Pricing; `public-org-page-sections` the tab row | update through `/docs` |

**Fixtures on dev:** `uat-rep-club` (Club, public, tryouts open on `15u-aaa`, a house-league season, an active tournament),
`qa-cancel-lab` (site off: the 4a refusal), `riverdale-minor-ball` (the tournament demo, public). Choose one club colour per test
case from End state 9 (a light colour like the yellow is the case that matters).

## What to build

1. **The colour roles, once.** A pure function from the club's saved colours to fill, text on fill, ink, edge and accent, with
   the darkening rule, unit-tested against End state 9's worked values (navy, yellow, sky, pink). The org layout writes them as
   CSS custom properties alongside today's vars (today's stay: tournament pages read them).
2. **The light ground and type for club pages.** One club-page scope (a wrapper the org layout can apply only on club public
   paths, or a shared shell the club pages render in; decide, and say why in a comment) that sets the ground, the faces and the
   type steps. Tournament pages, admin, coaches and the volunteer desks must look exactly as they do today.
3. **The club's bar, replacing the Navbar's org branch on club pages.** The club's own header component (logo or initials, name,
   tagline, Sign in or the signed-in visitor's Account; the tabs: today's sections, in the bar on desktop and as a row under it on
   a phone; "Archives" → "Past tournaments"). No Discover, no Pricing, no crumb (the tabs answer "where am I"). **Ask the owner
   first, with a drawing, about the one thing the drawings do not show: what a signed-in member of staff sees in the bar.**
   Today that is the ⇄ door (FlipPill / Workspaces / Admin area). Recommended: keep exactly one quiet door, left of the Account
   menu, only for staff of this club; never for a family. Keep the 4a markers (`data-club-chrome`) on whatever replaces the bar
   and the tab row, so the refusal still hides them.
4. **No platform phone bar on club pages** (Ask 8). Tournament pages keep it. Then the refusal's `aria-label='Primary'` hook and
   its guard line can go.
5. **The footer** on every club page, built from what the club already has (contact email, social links); absent parts absent.
   No "Contacts and documents" (4c).
6. **Every existing club page on the light ground, structure unchanged:** the home (`Home.module.css`), the team page and
   `RepTeamPublicSchedule`, the tryout landing and register views and form, the six league pages and `StatusLookupForm`, both
   past-tournament pages (drop "Digital Ledger" and the mono face; one name), and the in-club "not found". Inline dark styles
   become the frame's tokens. **Do not** reorder, add or remove sections, or redraw the home: that is 4b-2. If a page's dark
   hero or a lime banner cannot be made right without restructuring, keep its structure, make it light and readable, and list it
   for 4b-2.
7. **Titles and descriptions:** the layout template "page · club", each club page naming itself, the description from the
   club's tagline. (Preview cards and the sitemap are 4b-2: they need its pages.)
8. **Words:** every new or changed visible word (Sign in, "Questions? Email the club", Copy, "Past tournaments", the footer
   credit, page titles) goes through `/marketing` **before** code. House rules: sentence case, "8:00 a.m.", the bare possessive,
   `npm run check:spelling`.
9. **The layout sweep learns the club pages:** add anonymous screens for a club home, a team page, a tryout page, the house
   league and past tournaments on `uat-rep-club` (add a team slug to the fixture context if needed), so this and every later
   stage is measured.

## Before shipping: the demos

The tournament demo's club (`riverdale-minor-ball`) is public, so its club home changes. Run `npm run check:demos` and check
the demo tour and dock lines (`lib/sandbox-chrome.ts`, `lib/demo-org.ts`) for any step that points at the club's Discover,
Pricing, phone bar or crumb. Do not re-seed production (owner 2026-09-13); a broken tour step is fixed in the tour, and the demo
rebuilds itself on the next master build. The coach demo's club stays off (its public pages show the 4a refusal).

## Definition of done

- **Tests written first and run red before the build** (record the red run): the colour-role function against the four worked
  values and the darkening case; a source guard that no club page renders mono, Discover, Pricing or the platform phone bar, and
  that tournament pages still do (the carve-out); the anonymous UAT spec updated to the rulings (phone: no `Primary` bar on a club
  page, Sign in in the club's bar; desktop: no Discover or Pricing), kept for tournament pages.
- `npm run typecheck` (run `npx next typegen` first), `npm run verify:changed`, the full `npm test` before the commit.
- The dev server restarted once at hand-off (new files, a shared layout), then `npm run check:layout --changed` on the club
  screens you added, at 361, 390, 768 and 1440. A whole-product sweep does not run on dev.
- `/design` on the built frame (phone and desktop, a light-colour club and a dark one) before the walk.
- `/simplify` then `/review` (high-risk: a shared layout and the Navbar).
- `/docs` for `public-org-page-app-access` and `public-org-page-sections` (the phone bar, Discover and Pricing leave club pages).
- **An owner walk for 4b-1 on its own** (owner 2026-10-20), as a checkable Artifact: the same three club pages in a navy club and
  a yellow club, phone and desktop; a tournament page unchanged; the refusal unchanged; a signed-in staff member's bar.
- Records: the Club plan's Stage 4 ladder (4b-1 as built, with the commit), the TODO Stage 4 line, the project index
  (https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr, `stages/s4` + one `log` row, read first, `if_version` on every write), memory
  `project_club_tier_readiness`, the Owner QA Ledger for the walk.

## Before any code

Per `AGENCY_RULES.md`: a short task list, then the product-manager summary (what a family, a coach, an owner and a signed-in
admin see differently; that tournament pages do not change). Ask the staff-door question with a small drawing. Then build.

## Do not

- Build 4b-2 (the home's new order and two shapes, the Teams page and tab, the Born in picker, the club Tryouts page, tryout days,
  the team page's new parts, preview cards, the sitemap, the banner strip), 4c (the editor, the Look card, the About page,
  "Contacts and documents", the coach's door) or 4d/4e.
- Touch tournament public pages, the admin, the coaches portal, the volunteer desks, the 4a refusal, or the marketing pages'
  Navbar branch (Public Face Warm owns those).
- Change a price, a plan or a gate; write customer copy without `/marketing`; seed or reseed without the owner's yes; write to
  production.
- Change shared agent automation or the database checks (`AGENCY_RULES.md`).

## Git

`git rev-parse --abbrev-ref HEAD` is `dev`. The tree is shared: other sessions leave files modified, and **another session's
commit can sweep your uncommitted edits in with theirs** (it happened to 4a's records on 2026-10-20 — check `git show HEAD:<file>`
before assuming yours are uncommitted). Stage explicit paths only; for a file that also holds another session's edits, commit
through a private index (`GIT_INDEX_FILE`) built from HEAD plus only your changes, then `git reset` just your paths in the shared
index. Confirm with `git show --stat HEAD`. **Commit only when the owner says**, locally; do not push.
