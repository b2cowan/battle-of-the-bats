# Club Tier Stage 4c: who runs it (build prompt)

> **Written 2026-10-21** after 4b-2b was committed (`ec512b404`) and walked (§356 ✅ PASSED 2026-10-21, all five calls option A).
> Start it in a new chat on `dev`, and **re-verify every lead below first**: the leads were gathered on 2026-10-21 at HEAD
> `ec512b404`, and another session had uncommitted changes on the tryout pages at the time (Copy as an icon, "See the team"
> replaced by the back link), which may have landed since.
>
> 4c is the last part of the club's public face the owner ruled on 2026-10-19 (drawings ladder ~L415): **"The Public Site editor
> rebuilt (sections, contact, links that say why, the club notice, contacts and documents, the past-year hint), its old look
> retired; the About page; the coach's door; the tryout blurb's editor; birth years on teams and divisions"** — two admin screens,
> one coach section, Asks 2, 6, 10, 15, 16. 4b-2 moved the born-in years, the Born in picker and the team page's Coaches section
> here, each with the place it is entered. After 4c: **4d** sponsors (Ask 17), **4e** a club's own web address.

## What 4c makes true

A club **runs its own site** without asking anyone: it chooses which home sections show and in what order, writes its words and
contacts with the product telling it why a link was refused, posts a one-line notice ("All diamonds are closed tonight") that ends
by itself, and publishes an **About page** with who to contact and its documents and policies. Each team says **who it is for**
("Born 2015–2016"), and a parent finds "which one is my daughter's?" with one **Born in** pick. The club writes each tryout's
**"From the club"** words in a screen (today only the API can). A coach decides, for themselves, whether their **name and role**
appear on the team's public page, and finds the team's address, Copy and Open in one door.

## Read first

- **The drawings and rulings:** https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (source
  `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`, ruled 2026-10-19, all 17 asks option A, ~L2096). For 4c read: the editor
  (section 6, ~L1447–1551) and its round-2 cards (~L1956–1987); the About page (~L1922–1949) and the footer (~L1828–1831); the
  club notice (~L1791, ~L1802); the born-in frames (~L1810–1817, ~L1843, ~L1852, ~L1874, ~L1882–1890, ~L1911); the coach's door
  (~L1557–1615) and the team page's Coaches (~L1145, ~L1171–1175); Asks 2, 5, 6, 10, 12, 15, 16; findings F04, F05, R-02, R-03,
  R-05, R-06, S4-04, S4-05. Round 2 (~L1786 on) is later than round 1 where they differ.
- `memory/design_decisions.md`: 2026-10-19 "A CLUB'S PUBLIC SITE…" (one footer; a darkened colour is said; one name per thing,
  "Past tournaments"), the 2026-10-20 entries (tryout season; a phone's secondary action is its symbol; the address on its own
  line; 20 px between sections), "Edit autosaves, create asks" and its 2026-10-09 exception (a change that tells families waits for
  ✓), "Reorder on a phone = hold and drag", "A window's foot", "One window".
- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4: the 4a judgement calls (~L1030–1036), the 4b-1 finding
  (2) "Public ledger" (~L1097), the 4b-2b findings (~L1157–1162), the lettering C1 note (~L1199), the migrations line (~L1202).
- `docs/projects/active/OWNER_QA_LEDGER.md` §356: calls c2 and c3, and the owner's new head-coach email ask.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to a helper agent, and a helper's summary is a lead, not
  evidence.** Schema = dictionary, same unit of work; decide columns from the snapshots, never migration files.

## The ruled spec (from the drawings; quote them, don't re-derive)

| Part | Ruled | Where |
|---|---|---|
| The editor's frame | Rebuilt on **settings cards that save themselves** (the floating "Saved" pill; only an error persists). Header: "Public site", the Online/Offline chip, "Families see it at" + the address + **Copy link** + **Open**; owner sees "It is on. Turn it off in Settings", an admin "The owner turns it on and off in Settings." Site off on a phone: Offline chip, "Your site is off, so families can't see it…", Open absent, Copy link stays. The on/off switch stays in Settings, owner only. What leaves: "Display options" (its two switches become rows), the bottom Save button, the typewriter card titles; the old look retires in the same build (lettering C1: sentence-case titles in the body face, "Settings" named for the page it opens) | Ask 6, ~L1448–1551 |
| Home page sections | "What families see on your home page, in this order. Open now always comes first and shows only while something is open." Rows: Open now ("Always first", locked) · Teams · About the club · House league · Tournaments · Past tournaments, each with its live state line ("Shows once you publish a season"). Show/hide per row; **hold-and-drag order, the number is the handle** (28 × 34 at a desk, 44 × 44 on a phone; no Reorder mode). A section the club doesn't run yet keeps a live switch; a section the **plan** doesn't carry is absent. The home and the tab row follow it | ~L1467–1474, ~L1519 |
| About the club card | "Tagline" ("One line under your name. 27 / 100"), "About", "Families' questions go to" ("Shown in your footer and on every team and tryout page."); a neutral placeholder | ~L1479–1481, ~L1520 |
| Social links | Refused **with a reason beside the field**, never thrown away under a "saved" message (F05): "That isn't a web address. Paste the link to your Facebook page, starting with https://"; a saved one says "Saved as https://instagram.com/lakeshorelynx" | ~L1486–1489, ~L1521 |
| Look | Read only: "Your logo, colours and font are set in Organization › Settings…", the colours in words, readability said, "Change in Settings" (admin: "The owner changes these in Settings."); says when the platform darkened a colour | ~L1502–1508, ~L1523 |
| The club notice | **One at a time**, posted in the editor with **Post notice** (never autosaved; it tells families); "Notice", "More detail", "Ends" (tonight by default, or a later time); **End now** takes it down. Shown at the top of every public page and every team page: "All Riverbend diamonds are closed tonight" / its detail / "Posted 2:40 p.m. by the club · ends tonight". Plain words the club writes, never generated | Ask 16, ~L1791, ~L1802, ~L1956–1958 |
| The About page | "About the club" (back link "Home"; a meta line), the about text, **Who to contact** (role + address, up to twelve, a nudge toward role addresses like registrar@, never a refusal; each with Copy), **Documents and policies** (labelled links under the club's own headings: "Codes of conduct", "Safety", "The club"), the sponsors (4d, absent until then), Questions families ask. Reached from the home's About card and the footer's one door **"Contacts and documents"**. The site carries the club's documents and **never says the club is compliant**. Each list row opens a small window (one window) | Ask 10, ~L1922–1949, ~L1959 |
| The past-year hint | A hint, never a block, under the tagline, the about text or a tryout blurb that mentions a past year: "Mentions 2025 — still true?" | R-06, ~L1960, ~L1976 |
| The tryout blurb's editor | On the **admin's** Tryouts page: "From the club", where the club can say what it costs and who is eligible. No fee field invented | Ask 5, S4-04, ~L1282 |
| Born-in years | An **optional** "born" range on each team and each house-league division (two small fields where the team and division are set up). Shown: home grid and Teams page "Born 2015–2016", tryout rows "Born 2017–2018 · Mon, Sep 7 · Lions Park", the finished meta "For the 2027 season · born 2015–2016", the house league "U13 house league / Born 2015–2016 · 2027 season". **Born in picker**: one pick-one pill ("Born in: any year" / "Born in: 2015"), the toolbar shape, leaving the teams and the house-league division for that year ("3 places for a player born in 2015"). A team with no years always stays listed. A schema change and the dictionary in the same unit | Ask 15, R-02 |
| The coach's door | In Team settings › **Sharing**: "Your team's public page", the address, **Copy link**, **Open** (44 px on a phone), "Anyone with the link sees the team's name, its about text and open tryouts (your club edits those), and the schedule, because you chose Public link." Each coach's own **"Show my name on the team's public page"** ("Your name and role only. Families' questions go to the club."), **off by default**; it reads the live staff list, so it ends when their role ends. Site off: only Copy link (the 4a notice moves into this door) | Ask 2, S4-05, ~L1557–1615 |
| The team page's Coaches | "Coaches" between Schedule and About the team: "Dana Whitfield / Head coach", then "Questions about the team? Email the club at …". **Name and role only, never an email or phone.** No player ever appears on a public page (a build guard) | ~L1145, ~L1171–1175 |
| The walk | Ask 12 ruled "one checkable Stage 4 walk after 4c"; every 4b part has since been walked on its own (§350, §352, §356). Recommended: walk 4c's parts as each lands, as 4b did | Ask 12 |

## Gate asks (bring these to the owner before any code)

1. **Split 4c in two, as 4b was?** Recommended: **4c-1 the club's side** (the editor rebuilt with sections, words, social links,
   the look, the old look retired, the "Public ledger" door renamed; the club notice on every page; the About page with its
   contacts and documents and the footer's door; the past-year hint on the tagline and about) → **4c-2 the teams' side** (born-in
   years with their entry, display and the Born in picker; the tryout blurb's editor with its hint; the coach's door and the
   Coaches section; call c3's line). Each walked on its own. 4c-1 first: everything in it is the club's, one screen and its pages.
2. **The head-coach email on a tryout page (owner, §356): it contradicts a standing ruling.** Ask 2 (2026-10-19) rules the team
   page shows a coach's **name and role only, never an email or phone**, and families' questions go to the club. Before planning
   it, ask: does the owner want to reverse that for tryouts only (a parent's tryout question is often the coach's to answer), or
   is the real need "the club can name a different contact per team"? Draw both. If it goes ahead, settle: who sets it (the
   club, the coach, or the coach with the club's consent); the coach's sign-in email or a separate tryout address (a sign-in email
   published to the open web invites spam and cannot be changed without changing the login — recommended: a separate address the
   coach types, defaulting to blank); what shows when the head coach changes (it ends with their role, like the name switch);
   whether the club Tryouts page's line stays the club's (recommended yes). Recommended placement: 4c-2, beside the coach's door.
3. **Gaps the drawings leave:** "Questions families ask" is ruled (Ask 10) but drawn nowhere — draw it small or move it to 4d;
   the tryout blurb's editor is not drawn — draw it on the admin's Tryouts page; the past-year hint's scope (Ask 6 says any field,
   the note says tagline, about and blurb — recommended the three) and what "past year" means (a four-digit year before this
   calendar year); who may post the notice (recommended owner and admin, as the editor) and the "Ends" choices (recommended:
   tonight, tomorrow night, or a date and time; never "forever"); the About page's address (recommended `/{org}/about` — check
   no tournament uses the slug, as 4b-2b did for `tryouts`) and the meta line's source (recommended none until a field exists:
   no invented "since 1979"); the home's "300 girls" count is ruled "only if the club turns it on" with no switch drawn
   (recommended: out of 4c); the Born in picker on the Tryouts page as well as the Teams page (drawn on both; ruled on Teams).
4. **Fixtures.** The rep-only club has no coaches or staff; the walk needs a head coach and an assistant (one opted in, one not),
   socials (one refused), two contacts, three documents, a notice, born years on most teams and one team without. Ask before
   changing a seed; never seed mid-sweep.

## Verified state (leads at `ec512b404`; re-check)

| What | Then | Where |
|---|---|---|
| The editor | Old admin look: "Page Content" (tagline ≤100, about ≤1000, contact email), "Social Links", "Display Options" (two switches), one Save. Only the header chip and site line are kit | `app/[orgSlug]/admin/public-site/page.tsx` + `public-site.module.css` |
| Its save | PATCH, owner or admin; a full-row upsert. Contact email only trimmed and cut to 254 (no format check — 4b-2b finding: a `mailto:` can carry extra fields); a URL not starting `https://` is saved as null with no word | `app/api/admin/public-site/route.ts` (~L37–54); `lib/db.ts` get/upsert ~L1363/1387 |
| Site content columns | `tagline, description, contact_email, social_instagram, social_facebook, social_x, social_website, show_upcoming_tournaments, show_archives_link`. No section order, notice, contacts or documents. The banner is `organizations.hero_banner_url` (Settings) | `docs/agents/db/DATA_DICTIONARY.md` ~L421–455 |
| The home's order | Fixed in code: `clubHomeSections` pushes openNow · teams · league · tournaments · about; its header says the editor's show/hide and order is 4c | `lib/club-site-home.ts` ~L10–32; `components/public/ClubSiteHome.tsx` ~L65–70 |
| The tryout blurb | `rep_program_years.tryout_description`, written only by the admin program-year APIs and seeds; **no screen edits it**; rollover does not carry it. The admin Tryouts page (new kit) holds the Open/Closed switch, Copy link and the applicants | `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts` ~L103; `app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx` ~L341–361 |
| Born-in years | **No column anywhere** (`rep_teams.division` is free text; tournament `divisions` has min/max age; house-league divisions: check). DOB is stored on tryout registrations and roster players | snapshots; `lib/db.ts` ~L4282 |
| Staff and names | Access: `rep_team_staff_memberships` (role, status, kind); per season `rep_team_coaches`; names from `organization_members.display_name`. **No public-name flag** for rep teams. Head coaches with emails: `loadHeadCoaches` (email from the auth user only) | `lib/club-team-board.ts` ~L155; `lib/coach-membership.ts` ~L322; `lib/db.ts` ~L3597 |
| The coach's Sharing | A collapse section in team settings: schedule visibility, then the 4a site-off notice (its comment: "Stage 4c moves it into the 'Your team's public page' door"), then "Share our book with the club". **No address, Copy or Open today** | `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` ~L906–1009; `components/coaches/ClubSiteOffNotice.tsx` |
| The team page | Parts: concluded · tryout door/quiet · schedule · about; its header says Coaches arrives in 4c with the coach's switch | `lib/club-team-page.ts`; `app/[orgSlug]/teams/[teamSlug]/page.tsx` |
| About / notice / documents | Nothing: no `/about` route, no notice, the footer's comment says "Contacts and documents" is 4c. `rep_document_templates` are private family-portal forms (not public); `organizations.privacy_policy_url` has no editor | `components/public/ClubFooter.tsx` ~L10 |
| The coach's tryout setup (c3) | Tryout dates row → `TryoutDayCard` (the session list ~L354–380, Add session ~L382); or the row's empty text "No sessions yet — they show on your schedule once added." | `components/rep-teams/TryoutSetupChecklist.tsx` ~L37; `components/rep-teams/TryoutDayCard.tsx` |
| Fixtures | Main club: content + contact, 6 head coaches with emails, no active assistants, no socials. Rep-only club: content + contact + banner, **no coaches or staff** | `scripts/seed-club-fixture.mjs` ~L369–424, ~L1296–1429 |

## What to build (after the gate; as 4c-1 then 4c-2 if split)

1. **Words first:** every new or changed visible word (the editor's cards, the section rows' state lines, the refusal reasons, the
   notice and its ends, the About page's headings, the born range and picker, the door's sentence and switch, c3's line) goes
   through `/marketing` **before** code. House rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`.
2. **The schema** (one migration per part, dictionary + both snapshots in the same unit; prod at the promote): the home's
   section order and visibility; the notice (text, detail, ends, who and when posted); the club's contacts and documents (lists,
   with a cap); born years on teams and house-league divisions; a coach's public-name choice per membership. Decide jsonb vs
   columns vs tables in `/db` with the reasons written down.
3. **4c-1:** the editor rebuilt to the frames (every save through the one rule: owner or admin; email checked as an email; a
   refused link says why and is not saved); the home and the tab row obey the order and visibility; the notice on every public
   page and team page (and gone by itself when it ends — tested at the edge); the About page and the footer's door; the past-year
   hint (pure, tested); "Public ledger" → "Past tournaments" on the admin's door.
4. **4c-2:** born years entered where teams and divisions are set up, shown everywhere drawn, the Born in picker (pure filter,
   tested: a team without years always listed); the tryout blurb's editor on the admin's Tryouts page with the hint; the coach's
   door (address, Copy, Open, the sentence, the 4a notice moved in) and the name switch (off by default; ends with the role); the
   team page's Coaches (name and role only; the player guard); c3's line in the tryout setup. The head-coach email only as the
   owner rules it.
5. **The layout sweep:** the editor (owner and admin, site on and off), the About page, a page with a notice, the Teams page with
   the picker, the coach's Sharing door.

## Definition of done

- **Tests first, run red** (record it): section order/visibility (plan-absent vs not-yet-run), the notice's end (the minute it
  ends, the club's zone), the past-year hint, the email and link checks, the Born in filter, the name switch (ends with the role),
  no player or email on the team page (guard).
- `npx next typegen` then `npm run typecheck`, `npm run verify:changed`, the full `npm test` before each commit.
- The dev server restarted once at hand-off, then `check:layout --changed` on the touched screens at 361, 390, 768 and 1440.
- `/design` before each walk; `/simplify` then `/review` (high-risk: an admin write path, a coach write path, a public route,
  schema); `/docs` for the public site, the editor, rep teams and the coach's Sharing.
- **An owner walk per part as a checkable Artifact, one purpose per walk.**
- Records: the Club plan's Stage 4 ladder (each part as built, with its commit), the TODO Stage 4 line, the project hub
  (https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr, `stages/s4` + one `log` row, read first, `if_version` on every write), memory
  `project_club_tier_readiness`, the Owner QA Ledger (check the last § right before writing one).

## Before any code

Per `AGENCY_RULES.md`: a short task list, then the product-manager summary (what a club admin, a coach and a family each see
differently, and who can do what). Ask the gate questions above, drawing anything undrawn small first (as 4b-2b did for the
off-season page). Then build.

## Do not

- Build 4d (sponsors) or 4e (a club's own web address), or the c2 wording pass on the whole sign-up flow (its own item).
- Publish any coach's email, or any player's name, on a public page unless the owner rules it (gate ask 2).
- Change the frame (4b-1) or the year-round and tryout pages (4b-2a, 4b-2b) beyond what the order, the notice, the born range
  and the Coaches section need.
- Touch tournament public pages, the volunteer desks, the 4a refusal, prices, plans or gates; write customer copy without
  `/marketing`; write to production.
- Change shared agent automation or the database checks (`AGENCY_RULES.md`).

## Git

`dev` only. Other sessions share this working copy: read every staged file's diff and confirm every hunk is yours; commit
through a private index (HEAD + your hunks only), verified in an isolated worktree before `dev` moves (expect CRLF-only test
failures there: compare with the main tree); **commit only when the owner says**, locally; do not push.
