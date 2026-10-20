# Club Tier Readiness, Stage 4: the club's public face (walk, then draw the end state)

> **Written 2026-10-19** in the session that closed 5d and ruled Ask 28. **Paste this into a new chat on `dev`.**
> This is a drawing session: nothing is built. It ends with one published drawings page, its asks put to the owner,
> and the records saying "drawn, asks open".

**What Stage 4 is for.** A family who hears about a rep club looks it up. Today that club's public site is built for a
tournament host. The home page leads with tournaments, and a rep-only club gets "No active tournaments right now".
The club's teams can't be found except through an open tryout's card or a shared link. The team and tryout pages wear
the platform's colours, not the club's. A cancelled or private club still serves its team and tryout pages. The editor
only controls the tournament display. By the end of Stage 4, a rep club's site leads with its teams and tryouts, a family can get from
the home page to a team to its tryout in a few taps, the team pages wear the club's colours, the editor can show, hide and
order the sections, and the public pages refuse a cancelled or private club the same way everywhere. The marketing
pages promise only what exists.

**Who reads it:** parents and players (most often on a phone, often for the first time), the club admin who sets it up,
and the head coach who wants to share the team's page.

## Read first

- `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
  - **§6 Stage 4** (the starting proposal and its checklist) and **§4F** (findings F01–F10, recorded 2026-09-25). Several may have
    changed since, so read *Verified state* below before trusting either.
  - The rulings **D3** (the franchise: coaches own their team day to day), **D8** (what an admin sees by default; the
    public site is meant to be in it), **D9**, and **§7** (everything is inside the release unless the owner cancels it).
  - The sequencing rules near the end of the plan. Stage 4 is independent of Stages 5, 6 and 7. It owns the Public Site
    editor's old-look retirement.
  - The PM brief's Stage 4 row.
- **The project index** (the Club Tier hub from 2026-10-19): https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr. Its Stage 4
  row (`stages/s4`) is where your drawings page gets linked. The old all-in-one hub
  https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 is a **frozen archive**:
  - read it only if you need a past drawing's style;
  - never republish it;
  - never put Stage 4 inside it.
- `PUBLIC_FACE_WARM_PLAN.md` (queued, starts after Club Tier): its **Q6** (public tournament and club pages: the colours stay the
  org's, the type is walked anyway) overlaps this stage directly. See Ask 1 below.
- `docs/agents/strategy/BUSINESS_DECISIONS.md`:
  - 2026-10-16 (the Club release waits for everything);
  - 2026-10-19 "No household money" (draw no sibling or household money on a public page);
  - 2026-10-18 (chat is paused: no chat door on a public page);
  - 2026-10-16 "A free event's public pages keep no host logo" (a tournament rule; check it doesn't leak into a club's own
    pages).
- `PLAN_PRICING_FACTS.md`: which plans carry rep teams (Club), house league (League Plus and Club) and the public site. A
  section a plan doesn't carry is **absent**, never empty ("inapplicable = absent").
- `memory/design_decisions.md`: the org-brand rule for public pages (R1-2 / M2 / TH-1, "walking into the venue": an org's
  colours win on its own pages), the 2026-10-01 entry (a record reads first, edits whole), the toolbar rules (2026-10-17), the
  one-window entries (2026-10-18/19) for the editor's windows.
- Auto-memory (outside the repo):
  - how to draw and hand off: `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`,
    `feedback_deep_dive_is_walk_then_stages`, `feedback_project_hub_single_artifact` (**the index format: detail is its own
    artifact, linked; news is a data write**), `feedback_clickable_design_annotations`;
  - the standards: `feedback_portal_is_the_formatting_benchmark`, `feedback_sport_neutral_no_debt`,
    `feedback_tournament_org_separation`;
  - project context: `project_public_face_warm`, `project_club_tier_readiness`;
  - how to argue: `feedback_push_back_by_default`, `feedback_past_decisions_are_reference_not_authority`.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md's rule binds you: broad reading and searching go to a helper agent**,
  and a helper's summary is a lead, not evidence. Open the cited lines yourself before a drawing or a claim to the owner
  rests on them.

## Verified state (2026-10-19, by a helper in the writing session; re-check anything a drawing rests on)

Checked against HEAD `74d57373` on 2026-10-19; the key lines were opened in the writing session. File references are
leads, so re-read them.

| Row | Today | Where |
|---|---|---|
| F01 the tryout loop | **Fixed** (`47455d77`, 09-25): the home page shows one card per open tryout and links to the team's tryout. **Left:** `/{org}/teams` is still only a redirect (to a tournament, or home). | `app/[orgSlug]/page.tsx:41-65` · `teams/page.tsx:11-13` |
| F02 teams invisible | **Still true.** No Teams index; the `teams` section is not tabbable ("no index page yet"); the sitemap lists tournaments and org homes only. A team page is reached only from its tryout's back link or a shared URL. | `lib/org-public-sections.ts:52` · `app/sitemap.ts:59-77` |
| F03 tournament-first home | **Still true.** "Upcoming Events" comes first, with "No active tournaments right now — check back soon!" and a "Live" badge on every card (the fallback branch too). | `app/[orgSlug]/page.tsx:207-226, 437` |
| F04 the master switch | **Fixed** (`69ee4101`, 09-26): Settings has a "Your public site" card with two switches (the site, the directory listing; owner only). The editor shows an Online/Offline chip. | `SettingsKit.tsx:407-436` · `admin/public-site/page.tsx:147-160` |
| F05 the editor | **Partly fixed:** Admin holds the public site by default (D8, `45c6e3b9`). **Still true:** only two tournament toggles; the "Milton's Premier…" placeholder; a social link that isn't https is dropped while the save says it succeeded (a hint under the fields says https is required). | `public-site/page.tsx:192, 262, 267-302` · `api/admin/public-site/route.ts:48-54` |
| F06 missing checks | **Partly fixed:** the team page's schedule and feed refuse a cancelled club. **Still true:** the team page itself has no cancelled, private or entitlement check; the tryout resolver checks neither status nor public; the register API refuses only a cancelled club, after the form is filled in. (The 10-16 security fix `b15b01fe` was the *tournament* team page, not this one.) | `teams/[teamSlug]/page.tsx:33-55` · `lib/public-tryout.ts:28-39` · the tryout register route `:39-46` |
| F07 archives | **Mostly fixed** (`a227fd64`): an archive from another club is not found. **Left:** the archives index checks cancelled but not private. | `archives/[archiveId]/page.tsx:73` · `archives/page.tsx:14-16` |
| F08 colours, titles, chrome | **Still true.** The team page is hard-coded dark, and the tryout page uses the platform's lime. Neither page has its own title or preview. The navbar shows FieldLogicHQ's "Pricing" on a club's page. The footer is empty on club pages. The coach's settings say "Public link" with no URL and no copy button. | `teams/[teamSlug]/page.tsx:66-72` · `TryoutLandingView.tsx:26,116,133` · `Navbar.tsx:333` · `Footer.tsx:100` · coach team settings `:64-75` |
| F09 small dead ends | **Still true.** A closed tryout's "Contact us" never shows, because it reads the org's contact email, which is always empty: the real one lives in the public-site content (DATA_DICTIONARY says so). `/league` shows "No seasons have been published yet" for a rep-only club. `/register` redirects to a tournament or home. | `TryoutLandingView.tsx:154` · `league/page.tsx:151` |
| F10 marketing | **Partly fixed:** the README price, the Club house-league line and the old comparison table are fixed or gone. **Still open:** `/for-clubs` "Coming soon" (leaves at Stage 8), and invoicing and reconciliation claims (pricing section, plan articles, homepage). The homepage's "field bookings" is **true now**: permits have been on production since 10-13. | `app/for-clubs/page.tsx:89,203` · `components/PricingSection.tsx:141,165,172` · `lib/plan-article-content.ts:343,351` · `app/page.tsx:112,608` |

**The public pages a family can reach today** under `/{org}`:
- the home (hero, tournaments, house league, open tryout cards, past tournaments);
- `/league` and each season (schedule, standings, the house-league sign-up, its status);
- `/archives` and one archive;
- `/teams/{team}`: the team page (name, division, tryout banner, the public schedule with Subscribe, past seasons) and its
  `/calendar` feed;
- `/teams/{team}/tryouts` and its sign-up form (older season-numbered tryout addresses redirect there);
- `/teams`, `/news`, `/results`, `/rules`, `/schedule`, `/standings` and `/register` are redirects only.

The volunteer tools (`/check-in`, `/scorekeeper`, `/official`) are not family pages.

**The editor** is at `/{org}/admin/public-site`: Page content (tagline, about, contact email), social links (Instagram, Facebook,
X, website), the two tournament display toggles, the Online/Offline chip and "Preview your public page". The site's on/off
switch and the directory listing are in Organization › Settings, owner only.

**Recent changes on these pages:**
- `88a6e5a6` (09-29): one public tryout rule and the team-named tryout address.
- `97868569` + `f8cf5a0d` (10-11): the team's public feed and the Subscribe button.
- Nothing since. The tryout page hasn't changed since 09-29.

**Where to look on localhost:** UAT Rep Club (`uat-rep-club`, Club plan, public). Its teams are 15u-aaa, 15u-aa, 13u-aaa, 11u-aa,
12u-aa and 14u-aa (active), 16u-aa (closed), 18u-aa (archived) and 9u-aa (a draft year). **Tryouts are open on 15u-aaa.** It
has a linked tournament and an open house-league season, so it shows the rep + house league shape. For the rep-only shape you
need a club without either: ask the owner before making one. No team's schedule is public in the seed, so the schedule and
Subscribe only show after a coach turns that on. Ask the owner first. Account variables in `.env.local`:
`UAT_REP_CLUB_ORG_SLUG`, `UAT_REP_CLUB_{OWNER,ADMIN,TREASURER,REGISTRAR,COACH}_{EMAIL,PASSWORD}`. `UAT_CLUB_ORG_SLUG` is a
different, older org with no teams.

## Step 0 · Before the first drawing

1. **Branch and tree.** `git rev-parse --abbrev-ref HEAD` is `dev`. Other sessions leave files modified in this shared tree;
   you stage nothing of theirs.
2. **Is anyone else drawing these pages?** Ask the owner whether the Public Face Warm project or the Admin type sweep has
   started on any public club page or the Public Site editor. Check `git log --since=2026-10-19` on the public routes and
   the editor. If one has, stop and say so.
3. **Verify the claims in *Verified state* from the code**, by a helper, and read the cited lines yourself. Re-verify every F-row
   the drawings answer, because the 2026-09-25 rows describe a product that has moved.
4. **The questions that decide the shape, asked before anything is drawn** (put them on the drawings page's first screen,
   each argued from the code):
   - **Whose page is the team page?** Under D3 the head coach owns the team day to day. Who edits a team's public blurb, photo,
     staff list, schedule visibility and tryout door: the club admin, the head coach, or both? What does the coach portal show
     the coach about their public page today (F08: no URL, no copy button)? If the answer is "the coach", the editor half of
     this stage is in the coach portal, not the admin.
   - **A club with house league as well as rep teams.** A League Plus or Club org that runs house league already has a public
     league page. Draw the home page for both shapes (rep-only, rep + house league). Never draw an empty section for a module
     the club doesn't run.
   - **What a family does next.** For each page, what is the one thing a parent came to do (find the tryout, see the schedule,
     contact the club)? Is it above the fold at 390?

## Step 1 · The measured look (the drawings page's "Today" section)

Accounts and clubs: use the fixtures the helper found (see *Verified state*). Public pages need no sign-in. Read-only: save
nothing, seed nothing without the owner's yes. Start the dev server only with `npm run dev` (with network access), and
verify `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200. One browser tester at a time.
Probes go in `.probe/`. Capture at **1440 and 390**.

Stations, in the order a family meets them. For each one:
- *as built*: captures and browser-measured numbers;
- *my read*: what works, what gets in the way, what you would change, with clickable finding flags;
- *shape questions*: Keep · Reshape · Not yet, each with a recommendation.

1. **Finding the club**: a search result or a shared link lands on the club's home. What a rep-only club's home shows today,
   top to bottom, and what's above the fold on a phone.
2. **From the home to a team**: every way a family can reach a team page today (and the ones that don't exist: no Teams
   index, no nav link, not in the sitemap).
3. **The team page**: its title, colours, staff, schedule, the calendar subscribe link (6d), what it says when tryouts are
   open or closed.
4. **The tryout**: the tryout page and its form, a closed tryout's "contact us", the register path, and what a cancelled or
   private club shows on each of them (F06).
5. **The house-league page** for a club that runs it, and what a rep-only club shows at the same address (F09).
6. **The chrome around them**: the navbar (the FieldLogicHQ "Pricing" link on a club's page), the footer (no club contact
   block), the page titles and link previews a parent sees when the link is shared.
7. **The editor** (the club admin's Public Site page) as the owner and as an admin: every setting, what each one does, what
   Preview shows, and the social-link save (F05). Include the owner-only site switch in Settings: is it findable from the
   editor, and does it belong there?
8. **The coach's side**: what a head coach can see or share of their team's public page today.

**Standing back** (the rules that cut across):
- (a) one door, one recipe: the team, tryout and league pages should read as one site in the club's colours, not three
  products;
- (b) the club's brand wins on its own pages, and the FieldLogicHQ mark is a quiet credit;
- (c) the same checks (cancelled, private, entitled) on every public page, so a refusal reads the same everywhere;
- (d) what the share link and preview say;
- (e) the phone first, because that is how families arrive.

## Step 2 · What to draw: the END STATE of Stage 4, in the SAME first publish

Draw the finished stage, never a halfway version in today's look. Before = the captures; after = drawn. Tag every frame
**NEW / RESTYLED / UNCHANGED**, each tag with its own click-open note. Fix chips name the F-row or J4 finding a drawing
answers. Draw 390 frames with the 44 px tap floor, the "after" in the club's colours on the type the owner rules in Ask 1,
and everything at true size in a fixed frame. Starting positions for you to argue with:

- **The club home, two shapes**: rep-only, and rep + house league. Programs first: the teams and an open tryout lead.
  Tournaments come last, and are absent when the club runs none. The club's colours, and a footer with the club's contact.
  Show a club with one open tryout and one with none.
- **A Teams index** (`/{org}/teams` becomes a real page; "Teams" becomes a tab), grouped the way a parent looks (by age group
  or division), each team showing whether its tryout is open.
- **The team page** in the club's colours, with a real title (the team's name and the club's), its staff, its schedule, the
  calendar subscribe link, and the tryout door when one is open.
- **Tryouts findable**: home card → the tryout (already true), and index → team → tryout (needs the index).
- **A closed, cancelled or private club** on each page: the refusal, said once, in the same words everywhere.
- **The editor**: section controls (show, hide, order), what each section shows when it's on, social links that say why they
  were refused, and the club's contact block, which the tryout page's "Contact us" reads (F09). The site's on/off switch
  stays in Settings (F04, fixed); the editor points to it. Draw it in the admin's current window and
  form standard (one window, the toolbar rules). It retires its old look in the same build.
- **The coach's door** to their team's public page (the URL and a copy button), wherever Step 0's ownership answer puts it.
- **Share previews**: what a link to the home, a team and a tryout shows when pasted into a message.
- **Marketing truth (F10)** is not drawn. List each claim, what's true today, and the fix, routed to `/marketing` (copy) and
  `/strategy` (a claim about what a plan includes). `/for-clubs` leaves "Coming soon" at Stage 8, not here.

Check every drawing against the benchmark's **written** rules before the owner sees it:
- `docs/agents/design/TABLE_AND_LIST_STANDARD.md` + `TABLE_EXCEPTION_REGISTER.md`;
- the portal's page-header and section rules;
- the org-brand rule for public pages.

Not the previous hub's CSS. **Run `/design` on the drawings before the hand-off** (owner, 2026-10-10: always, not offered),
apply its changes, and record them on the page's check section. New customer sentences are drawn as placement and tagged
`/marketing`. Use the product's existing words and the spelling gate ("8:00 a.m.", the bare possessive).

## The drawings page (its own artifact, linked from the index)

- One new artifact, `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html` (republish the same path for each round), carrying:
  - the Today walk;
  - the end-state drawings;
  - the design check;
  - the asks: each with a recommendation, "what rides on it", a notes box, and a paste-back button that copies every answer
    in one block.
- **Do not put it inside the index or the archive hub.** Link it from the index with one `ArtifactData` update to
  `stages/s4`:
  - `links` gets {label "Stage 4 drawings", url}, `state` becomes "drawn", and `anchor` becomes "Drawn 2026-MM-DD; asks 1–N
    open";
  - add one `log` row (`sort` "YYYY-MM-DD#NN", one past the day's last).
  - Read the documents first, and pin every write with `if_version`.
- Parse every `<script>` before every publish (one unescaped apostrophe kills the page). Every highlight (finding flag, fix
  chip, tag) opens its explanation on click. Dry-render from disk with Playwright before the publish.

## The asks (each with a recommendation; number them from 1 in this stage)

1. **The type on public club pages (overlaps Public Face Warm Q6).** Stage 4 redraws these pages anyway. Recommended: draw them on
   the warm type now, keeping the club's colours, so Public Face Warm's Q6 shrinks to the tournament pages and nothing is
   redesigned twice. The alternative is today's type now and a second pass later.
2. **Who owns the team page** (from Step 0): the admin, the head coach, or both, and where the coach's door lives.
3. **The home page's order and its two shapes**, and what an empty program does (absent, never "check back soon").
4. **The Teams index**: grouping, what each row shows, and whether it's a tab.
5. **The tryout path and the closed/cancelled/private refusals.**
6. **The editor**: its sections and their order, and the social-link refusal. Admin already has it by default (D8).
7. **The chrome**: the navbar's FieldLogicHQ links on a club's page, the footer contact block, and page titles and previews.
8. **The redirect-only addresses** (`/teams` becomes the index; what `/register`, `/news` and the rest do for a club with no
   tournament), and the archives index's missing private check (F07's remainder).
9. **The marketing-truth list**: confirm the routing to `/marketing` and `/strategy`.
10. **The Stage 4 walk** is its own checkable walk page after the build.

Add or merge asks as the evidence requires. Say which one decides the rest.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files. Don't seed or reseed without the owner's yes, and don't
  write to production.
- Draw chat, family replies, a family login, household money, or a guardian portal on any public page.
- Change a price, a plan or a gate, or write customer copy. Route packaging to `/strategy` and gates to `/billing`, and log
  nothing in `BUSINESS_DECISIONS.md` yourself.
- Republish the archive hub, or splice Stage 4 into the index page.
- Write the Stage 4 build prompt, the design-log rulings or the plan's "ratified" notes before the owner rules.

## Hand-off

- In product-owner voice:
  - what a parent sees differently (on a phone first);
  - what a club admin sets up;
  - what a head coach sees or shares;
  - what a cancelled or private club shows;
  - what the marketing pages stop claiming.
  - **Tell the owner to open the drawings on a phone too.**
- The asks as numbered questions, each with a recommendation. Say which one decides the rest.
- Records written this session (as drawn, asks open, no ruling invented):
  - the Club plan's Stage 4 section ("DRAWN, asks open", with the drawings URL);
  - the PM brief's Stage 4 row;
  - the TODO Club line;
  - the index's `stages/s4` row and a log row;
  - memory `project_club_tier_readiness`.
- Once the owner rules, and only as ruled:
  - the design log and the build prompt(s) (`CLUB_TIER_STAGE4_BUILD_PROMPT.md`);
  - their definition of done: tests that fail on today's code for the missing checks on the team, tryout and register pages
    (F06), the archives index's private check (F07), and the empty "Contact us" (F09); the old-look ratchet for the editor;
    the layout sweep on the public pages; the Stage 4 walk.
- Git: a private index and explicit paths for your files only; confirm with `git show --stat HEAD`. **Commit only when the
  owner says, locally, and do not push** unless the owner asks.
