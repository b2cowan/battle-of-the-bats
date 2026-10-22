# Club Tier Readiness, Stage 4c-2: build the teams' side

> **Written 2026-10-22** in the session that drew and ruled 4c-2. **Paste this into a new chat on `dev`.** The drawings are
> drawn and **ruled** (all 13 asks as recommended, plus round 2's club cut-off per sport):
> https://claude.ai/artifact/2HDwoGLtFS8ACuq2CuSbNn (source `docs/projects/active/CLUB_TIER_STAGE4C2_DRAWINGS.html`). The
> already-ruled Stage 4 frames this stage also builds are in https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (End state › 7
> the coach's door, › 3 the team page's Coaches, › 11 the Born in picker). The ruling is recorded in `memory/design_decisions.md`
> (2026-10-22, "STAGE 4C-2, THE TEAMS' SIDE") and the plan (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, Stage 4, "4c-2 RULED").
>
> **Three steps, in order, each its own commit:** **Part 0** the words → **Part A** the club's side (birth years, the cut-off,
> the picker, the blurb) → owner walk → **Part B** the coach's side (the door, the name switch, Coaches, the tryout address, the
> setup line) → owner walk. Part B starts only after Part A is committed and walked.

## What 4c-2 makes true

- A parent sees each team's birth years ("Born 2012–2013") on the club's pages and narrows the Teams and Tryouts pages to one
  birth year. They read what a tryout costs and who may come before sign-ups open. On the team's own tryout page they write to
  the person running that team's tryouts.
- A club admin types each team's birth years once, and they roll forward with the season. The admin sets when birthdays count
  from, per sport, and writes the tryout blurb where the tryout lives. They can always see which address a tryout page shows,
  and put the club's back.
- A head coach shares the team's public page from Team settings and chooses whether their name appears. They can give the
  team's tryout page their own tryout address, which ends by itself with their role. They are told the tryout days are public
  before sign-ups open.

## Read first

- The two drawings above. **The approved drawings are the visual spec** for every surface they depict, including what they tag
  UNCHANGED or RESTYLED. A visual difference found while building goes back to the owner as a question, never a silent judgment.
- The plan's Stage 4 entries "4c-2 DRAWN", "Round 2 RULED" and "4c-2 RULED". The design log entry above. The drawings page's
  Design check and Flow check tabs: their changes are ruled (Ask 13 A).
- `CLUB_TIER_STAGE4C1_COPY.md` (the house voice for this editor family; K2 is the builder's approved words) and
  `CLUB_TIER_STAGE4C_BUILD_PROMPT.md` (its spec rows L52–56 for the past-year hint, the blurb, born years, the door and the
  Coaches section).
- The rules the frames were checked against: `docs/agents/design/TABLE_AND_LIST_STANDARD.md`, the ClubKit field recipe, the
  phone secondary-action rule (`tests/unit/phone-secondary-actions-guard.test.ts`), the 2026-10-21 tryout-card Copy ruling, the
  one-view-pill rule (`components/shared/ViewPills.tsx`, `PILL_HOSTS` in `tests/unit/toolbar-rules-guard.test.ts`), and
  `decision_edit_autosaves_create_asks` (the blurb autosaves; it sends nothing).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. Broad reading goes to a helper; a helper's summary is a lead until you open the
  cited lines.

## The ruled spec (quote it, don't re-derive it)

**Birth years** (Asks 4–7, round 2)
- They belong to each **season** (`rep_program_years`), labelled with its name: "Birth years for the 2027 season". They are
  entered in the admin team page's **Team details**, beside Division (Colour, Sport and Public address each move one cell
  along; the section grows by one desk row). They are not entered in **Add a team**: a new team has no season yet.
- **Start next season** fills the new season's pair **one year later** (an empty box stays empty), with the note "Moved one year
  later when the {2028} season started. If this team keeps its players, change it back." The note shows until the admin saves
  the years or the season's first game has started. No message is sent.
- **Two boxes. An empty box means no limit on that side.** The checks hold a value (never saved, the reason under the boxes, the
  pill not saying Saved) when it is not a four-digit year, a year is after this calendar year, or the earlier one is second.
- **No suggestion from the team's label.**
- **House league:** the same pair on each **division**, in the existing Add division and Edit division windows. Those windows
  keep their old look and their Save; the new field carries no "(optional)" tag.
- **A club cut-off per sport (round 2):** club Settings gains a card, "When birthdays count from". It has one row per sport the
  club runs (a non-archived rep team or house-league season of that sport), each a month and a day, default **January 1**, with
  a sentence showing an example family line from the club's own teams. A change asks once (the drawn window: "Count softball
  birthdays from September 1?", Keep January 1 · Change), then saves. Nothing is sent. Teams and divisions store **years** and
  read their sport's cut-off when shown, so a change re-reads every team of that sport at once.
- **The date rule (precise form of the ruling; the drawings show it):** with cut-off M/D, the first box is the year of the
  **from-date** (M/D of that year). The second is the year of the **to-date**, the day before M/D in that year (Jan 1 gives
  Dec 31; Sep 1 gives Aug 31). So with January 1, "2012 – 2013" is Jan 1, 2012 – Dec 31, 2013, and one year is the same year in
  both. With September 1, the boxes sit inside the dates ("Sep 1, [2013] – Aug 31, [2015]"); one band is from 2013 to 2014.
  "Earlier first" is checked on the **dates**: Sep 1, 2013 – Aug 31, 2013 is held with "Put the earlier date first to save it."
  (draft words; `/marketing` settles them).
- **What families read:**
  - January 1: "Born 2012–2013" · "Born 2013" · "Born 2012 or later" · "Born 2008 or earlier".
  - Another cut-off: "Born Sep 1, 2013 – Aug 31, 2015" · "Born on or after Sep 1, 2013" · "Born before Sep 1, 2014"
    (to-date only, said as the day after it).
  - Nothing at all when both boxes are empty (never "Born —" or "All ages").
- **Where they show:** everywhere the Stage 4 drawings put them. That is the home's team grid, the Teams page, the club
  Tryouts page's rows, a team's tryout page meta ("For the 2027 season · born 2012–2013", lower-case after the dot), the
  finished meta, and the house league ("U13 house league / Born 2015–2016 · 2027 season"). Open each frame and match it. Where
  a surface the frames don't show would need a decision, ask.
- **Born in picker** (Stage 4 Ask 15, ruled): one pick-one pill in the house toolbar shape ("Born in: any year" / "Born in:
  2015") on the **Teams** and **Tryouts** pages. Picking a year keeps every team and house-league division whose range
  **overlaps** that calendar year (an open side matches every year beyond it). It keeps every team with no years, always, and
  adds the house-league division for that year. The meta reads "3 places for a player born in 2015". With a September cut-off,
  two teams can match one year, and their rows' dates say which.

**The tryout blurb** (Asks 8–11)
- It is "From the club", in the admin Tryouts page's **Sign-ups** section, under the address. A four-line box that grows,
  **500 characters**, with the house counter "{n} / 500" under it at the left and the **amber** past-year hint above the
  counter. It **autosaves** with the floating pill. The hint line says when families read it: "…before and while sign-ups are
  open". While sign-ups are closed it says the page doesn't show it now.
- **Families see it while the tryout is open and while it is not open yet**; it is hidden once finished or closed.
- **A new season starts blank**, with one door under the empty box, "Start from last season's words". The door shows only when
  the previous season had a blurb, and it fills the box.
- **The past-year hint skips birth years.** A year is not flagged when "born" or "birth" stands within the words around it:
  "born 2012 and 2013", "born in 2012–2013", "2012 and 2013 birth years", "born 2012 or 2013". This is in addition to the
  founding-year skip. The hint is **amber everywhere**, including under a question's answer in the site editor's list window,
  which is grey today.

**The coach's side** (Stage 4 Ask 2, ruled 2026-10-19, built here)
- **The door:** Team settings › Sharing gets "Your team's public page". It has the address, **Copy link** and **Open** (44 px on
  a phone), and the sentence "Anyone with the link sees the team's name, its about text and open tryouts (your club edits
  those), and the schedule, because you chose Public link." The 4a site-off notice moves into this door; with the site off, only
  Copy link shows.
- **The name switch:** each coach gets their own "Show my name on the team's public page" ("Your name and role only. Families'
  questions go to the club."). It is **off by default** and reads the live staff list, so it ends when their role ends.
- **Coaches on the team page:** name and role only, never an email or phone, only coaches who switched it on. No section when
  none has. **No player ever appears on a public page** (a build guard).

**The head coach's tryout address** (Asks 1–3, Ask 13 D2/D3)
- Coach portal › Tryouts › Set up gets a fourth row, **"Questions from families"**, tagged Optional. It does not count toward "2
  required".
  - Closed, it says where questions go now. Open, it holds "Address for tryout questions", its hint, and "Remove and use the
    club's address".
  - It **saves on leaving the field, only when complete and valid**, never part-typed.
  - It refuses the coach's **sign-in address** (compared trimmed, ignoring case) with its reason. It refuses a malformed
    address with "That doesn't look like an email address." It shows the site editor's role-address nudge, which is never a
    refusal.
- **One address per team.** Any **head coach** of the team may set, change or remove it; an assistant with tryouts access reads
  it ("set by …") and cannot change it. It belongs to whoever set it and **ends when they stop being a head coach of the team**
  (removed or demoted). It is never handed on. It carries across seasons while they hold the role.
- **The club** sees it on the team's admin Tryouts page, in the Sign-ups section: "Tryout questions on this page go to {address}
  · Set by {name}, head coach. Your footer and the club's Tryouts page keep {club address}."
  - **Use the club's address** asks once (the drawn window, buttons together at the foot's right).
  - The coach's row then reads "The club put its own address back on {date}." The coach may set one again.
  - On a phone the line stacks, with the button under the sentence.
- **Families** see it only on the team's **own tryout page**, while **open or not open yet**: "Questions about these tryouts?
  Email the head coach" (or "Email {name}, head coach" only when that coach's name switch is on).
  - Finished and closed pages show the club's line.
  - It never appears on the footer, the club Tryouts page, the team page, the sign-up form's closed message, a share card,
    JSON-LD or a link preview.
- **Copy and Directions (Ask 13 D3):** every public tryout day keeps its Directions, and the open page's contact line gains
  Copy. Copy is **built like the status card's Copy and Directions**: symbol + "Copy" at a desk, at the right edge in line with
  Directions; the bare symbol in a 44 px box on a phone. This applies whichever address shows.

**The setup line** (Ask 12)
- Under the coach's tryout session list, above + Add session, whenever the club's site is on: "Anyone can see these days on
  your team's tryout page, even before sign-ups open." The last clause drops once sign-ups are open. There is no line while the
  site is off.
- The "Tryout dates" row's empty text names the tryout page too: "No sessions yet. Once added, they show on your schedule and
  on your team's tryout page."

## Verified state (2026-10-22 at `b7c7d8ce2`; re-check before building on it)

| Row | Today | Where |
|---|---|---|
| Birth years | No column anywhere. `rep_teams.division` and the team name are free text; `league_divisions` has name + capacity; `league_seasons.division` is a free-text badge | `docs/agents/db/DATA_DICTIONARY.md` |
| Sport per record | `rep_teams.sport` (text, default 'softball'; mixed casing — compare through `normalizeSportId`), `league_seasons.sport` | dictionary L2408, L6475, L7185; `lib/sports.ts` (`normalizeSportId` L87, `OFFERED_SPORT_IDS` L65) |
| Club settings | `organizations` columns, saved through `/api/admin/org-settings` from `components/admin/kit/club/SettingsKit.tsx` (cards: Organization details with a held Save, Your public site door, Delete) | `app/api/admin/org-settings/route.ts` L84 |
| Team details | Inline section, autosaves (`useRecordAutosave`, 0.9 s, `SavePill`); fields Name, Group, Division, Colour, Sport, Public address, Description | `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx` L552–680 |
| Start next season | Admin window → `app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts` L146; coach → `components/coaches/StartNextSeasonModal.tsx` → `app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts` L285; both call `startNextRepSeason` | `lib/rep-season-rollover.ts` L106, insert L223–239 (blurb not carried) |
| HL divisions | Old-look Add/Edit windows on the season page | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx` L720–815; API `app/api/admin/house-league/seasons/[seasonId]/divisions/` |
| Blurb | `rep_program_years.tryout_description`, no limit, written only by seeds and the raw admin API (no live-season check, unlike `tryoutOpen`); shown only while open | API `…/program-years/[yearId]/route.ts` L103; `components/rep-teams/TryoutLandingView.tsx` L49, L69–73 |
| Admin Tryouts page | Head, Sign-ups section (chip, Copy link, Open/Close, dashed address), views, Export, table, foot | `app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx` L341–361 |
| Past-year hint | No birth-year skip; amber under About/tagline, grey in the list window | `lib/past-year-hint.ts`; `app/[orgSlug]/admin/public-site/SiteListRecord.tsx` ~L139; tests `club-stage4c1.test.ts` L90–107 |
| Public surfaces | Home grid `components/public/ClubSiteHome.tsx` L101 (`lib/club-home-data.ts`, `lib/club-site-home.ts`); Teams `app/[orgSlug]/teams/page.tsx` (`lib/club-public-teams.ts`, **no toolbar today**); team page `app/[orgSlug]/teams/[teamSlug]/page.tsx` (`lib/club-team-page.ts`); Tryouts `app/[orgSlug]/tryouts/page.tsx` (`lib/club-tryouts.ts`); tryout page + sign-up (`lib/public-tryout.ts` `resolvePublicTryout`); house league `app/[orgSlug]/league/page.tsx`, `…/league/[seasonSlug]/page.tsx` | — |
| Contact pieces | `components/public/ClubContactLine.tsx` (open state, no Copy), `ClubContactCard.tsx` (Copy, pinned in the phone guard), `TryoutDays.tsx` L27 renders `DirectionsLink` | `tests/unit/phone-secondary-actions-guard.test.ts` |
| Coach Sharing | Schedule visibility + Share our book; `ClubSiteOffNotice` at L962; **no door, no Copy/Open, no name switch** | `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` L906–1009 |
| Staff | `rep_team_staff_memberships` (service role only, all access via `lib/coach-membership.ts`); no public flag. Removal `removeStaffMember` L620–695, role change `setStaffMemberRole` L574–612; a team may have several head coaches | dictionary L2682–2725 |
| Coach tryout setup | `components/rep-teams/TryoutSetupChecklist.tsx` `ROW_META` L34; `TryoutDayCard.tsx` sessions L359, Add session L384; route `app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx`; API refusal "Only the head coach manages tryouts." via the `tryouts` capability | `app/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/route.ts` L52 |
| Guards that fail by design | Born in banned on the tryout surfaces; no "Coaches" on the team page | `tests/unit/club-stage4b2b-guard.test.ts` L134–139; `club-stage4b2a-guard.test.ts` L98–99 |
| Existing "never a player" guards | share cards (`club-stage4b2b-guard` L84, CARDS L27), About page (`club-stage4c1-guard` L73). **No guard keeps a coach email off the footer or share card** | — |
| Latest migration | 347 at the time of writing; take the next free number when you build | `supabase/migrations/` |

## Before any code (the gate)

1. **Re-check the verified state** above. Other sessions share this tree.
2. **Present the product-manager UX summary** for the part you are about to build (AGENCY_RULES; blocking): what each of the
   three people sees and does differently, and who can do what.
3. **Part 0, the words: run `/marketing`** on every draft string in the drawings: labels, hints, held and refusal sentences,
   the cut-off card and its question, the blurb's hint and door, the questions row and its states, the club's line and window,
   the family lines, the setup line. Its output is `docs/projects/active/CLUB_TIER_STAGE4C2_COPY.md`; **the copy wins over the
   drawings**. House rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`, sport-neutral examples.
   Commit the copy doc on its own.
4. **Schema through `/db` (and `/dba` for the shapes).** These are proposals; the agent decides and records why:
   - `rep_program_years.born_from_year` / `born_to_year` (smallint, nullable, CHECK 1900–2100) and a carried marker for the
     note;
   - `league_divisions` the same pair;
   - the club cut-off as a jsonb on `organizations` keyed by normalized sport id (`{"softball":{"m":9,"d":1}}`, absent =
     January 1, a CHECK on shape), or a small table;
   - `rep_program_years.tryout_description` CHECK `char_length <= 500`. **First read the longest existing value on dev and
     prod (read-only).** If any exceeds 500, ask before adding it;
   - `rep_team_staff_memberships.show_name_public` boolean default false;
   - the team's tryout address (per team, across seasons): address, set-by membership, set-at, and the club's reset
     date and person.

   Then: `DATA_DICTIONARY.md` in the same unit, `npm run refresh:snapshots`, and `MANUAL_PROD_STEPS` (apply before the code ships).

## What to build

**Part A — the club's side** (one commit, then walk A)
1. **One rule, pure and tested**, in a new `lib/born-years.ts`. It covers the date rule, the family line in every shape, the
   checks with their held sentences, the overlap match with open sides, the one-year-later roll, and the sport's cut-off
   (through `normalizeSportId`, absent = Jan 1). Every surface calls it; nothing formats a born line by hand.
2. **Team details:** the pair, season-labelled, for the team's live season. If two seasons are open, edit the newest and say
   which by its name. It is held and refused per the shared hook's rules, and the cut-off line links to Settings.
3. **Rollover:** `startNextRepSeason` writes the new season's pair one year later and sets the carried marker. Both paths
   (admin and coach) go through it; the note clears per the spec.
4. **House league:** the pair in Add division and Edit division (sport from the season), and the API carrying and checking it.
5. **Settings card** "When birthdays count from": the sports the club runs, month + day dropdowns (days valid for the month; no
   Feb 29), the example sentence, the ask-once window, saved through the org-settings route. Owner and admin, as Settings.
6. **Public:** the born line on every surface listed in the spec, and the Born in pill on Teams and Tryouts. Use the shared
   view pill and add both pages to `PILL_HOSTS`. Carry the pick in the address (`?born=2015`) so a filtered list can be shared.
   The house-league band appears as the ruled frame shows. The meta sentence counts places.
7. **The blurb:** the editor in Sign-ups (autosave, 500, counter, amber hint, the state-aware hint line, "Start from last
   season's words" reading the previous season). The admin route gains the 500 cap and the same live-season check as the
   sign-up switch. The tryout page shows the blurb while open **and** not open yet.
8. **The past-year hint:** the born/birth skip with the cases in the spec as tests, and the list window's hint made amber.
9. **Guards:** replace the 4b-2b Born-in ban with a test that pins the born lines. Add tests for the rule (every family-line
   shape, both cut-offs, open sides, overlap, roll, held reasons).

**Part B — the coach's side** (after walk A; one commit, then walk B)
1. **The door** in Sharing, per the Stage 4 frame (address, Copy link, Open, the sentence; the site-off notice moved inside;
   only Copy link while the site is off).
2. **The name switch** per coach (off by default, name and role only, reads the live staff list), and **Coaches** on the team
   page. Replace the 4b-2a "no Coaches" guard with one that allows the section and bans any email, phone or player on the page.
3. **The tryout address:** the coach route (head coaches only, by `coach_role`, not the tryouts capability; sign-in refusal;
   the shared email check and nudge; save only when valid), and the questions row with its seven drawn states. Add the admin
   line and its window, and the club's reset noted on the coach's row.
4. **Ends with the role, twice over:**
   - The **public read** shows the address only while the setter's membership is an active head coach of the team.
   - `removeStaffMember` and `setStaffMemberRole` clear it.
   - A test for each path: removal, demotion, a second head coach, the club's reset.
5. **The family page by state:** the questions line or card per Ask 3, Copy on the open line built like Directions, and the
   phone guard extended to it. A new guard keeps the coach's address off the footer, the club Tryouts page, the team page, the
   sign-up form, every share card, JSON-LD and the link preview.
6. **The setup line** under the sessions and the new empty text, per Ask 12.

## Fixtures (ask the owner before changing any seed; never seed mid-sweep)

The walks need what no fixture has today:
- a team with a head coach **and** an active assistant (one name switch on, one off);
- coaches on **UAT Lakeshore Lynx**, the rep-only club (`buildRepOnlyClub`, `scripts/seed-club-fixture.mjs` L1315). Rebuilding
  the main fixture club resets every saved sign-in, so the coaches belong here;
- birth years on all but one team (Lakeshore's 10U Development is the natural blank), and one sport on a September cut-off;
- a house-league season with divisions on the walk club (Lakeshore has none; the main club's "U9 Rookie" is at L806);
- a blurb naming birth years and one naming a past year;
- one open team with a head coach's tryout address, and one without.

Propose the smallest set, get a yes, then seed.

## Definition of done

- **Tests first, run red:**
  - the born rule (every shape, both cut-offs, open sides, overlap, roll, held reasons);
  - the hint's born/birth skip;
  - the blurb cap;
  - the address rules (sign-in refusal; ends on removal, demotion and club reset; head coaches only);
  - "never on the footer, Tryouts page, team page, sign-up, share card";
  - Coaches name and role only, no player.
- `npx next typegen`, then `npm run typecheck`, `npm run verify:changed` and the full `npm test` before each commit.
- The dev server is restarted once at hand-off (new files, a migration). Run `check:layout --changed` at 361/390/768/1440 on
  the touched screens only.
- **Before each walk:** `/design` on the built screens against the drawings (Ask 13's changes included); `/simplify`, then
  `/review` (high-risk: schema, admin write, coach write, public route, a role-bound rule); `/docs` for Team details, house-league
  divisions, Settings, the admin Tryouts page, the coach's Sharing and tryout setup, and the public site articles.
- **An owner walk per part,** a checkable Artifact with one purpose per walk: A = birth years, the cut-off, the picker, the
  blurb; B = the door, names, the tryout address, the setup line. Include a phone pass of the family pages, and a September-cut-off
  team.
- **Records:** the plan's Stage 4 ladder (each part with its commit); the TODO Stage 4c-2 line; the Owner QA Ledger (a new §
  per walk); memory `project_club_tier_readiness`; MANUAL_PROD_STEPS for the migration(s). The demos follow the product and are
  not touched per commit.

## Do not

- Re-decide anything in the ruled spec. Disagree out loud before building if the code shows a ruling cannot hold; never route
  around it.
- Build 4d or 4e, or the §356 c2 wording pass on the whole sign-up flow.
- Show any coach email on a public page other than the team's own tryout page as ruled, or any player anywhere public.
- Restyle the house-league windows, the 4b-1 frame or the 4b-2 pages beyond the born lines, the picker, the blurb, the Coaches
  section and the contact lines.
- Add a navigation change (Stage 13), change a price, plan or gate, write customer copy without `/marketing`, or write to prod.
- Change shared agent automation or the database checks.

## Git

One shared branch, `dev`. Stage explicit paths only; other sessions' edits sit in TODO, the plan, the ledger and the design log,
so commit your hunks only. Check `git show --stat HEAD` after each commit. No push without the owner's word.
