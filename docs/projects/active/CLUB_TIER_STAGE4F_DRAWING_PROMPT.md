# Club Tier Readiness, Stage 4f: draw "a Tournaments tab in the club's top row" (prompt)

> **Written 2026-10-25**, the day Stage 4 closed. **Paste this into a new chat on `dev`.** Other sessions share this working copy
> (TODO, the Club plan, the PM brief carry their edits): stage explicit paths only, and commit only your own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.

## What 4f is, and what is already settled

A family on a club's team page today has no way to the club's current and upcoming tournaments. They appear only as a section on
the club's home page. The owner asked (2026-10-24) for a **Tournaments** tab in the club's top row, shown only while the club has a
tournament, with a show/hide switch in the Public site editor like the other parts.

**Ruled — do not reopen** (record each as ruled; add nothing):
- 2026-10-24 (owner): the ask itself — a Tournaments tab, only while the club has a tournament, switchable in the Public site editor.
- 2026-10-25 (owner): Stage 4 is closed **without** 4f; 4f is its own piece of work, kicked off by this prompt. (No release timing
  is implied anywhere; sequence by dependency.)
- The **tournament-to-club link** (advertising the club to people attending its tournaments) is **not** 4f. It lives in
  `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`, because where it sits depends on the phone redesign of the tournament pages.
- The words: the club's other tab is called **Past tournaments**; one spelling, everywhere a family reads it.

## The facts the drawing rests on (re-verify each against the code before drawing on it)

| Fact | Where to look | Consequence for the screen |
|---|---|---|
| The tab row today reads Home · Teams · Tryouts · House league · Past tournaments; a section shows only when the club has something for it; the row shows from two sections up | `lib/org-public-sections.ts` (`ORG_SECTION_TABS_MIN`), `components/public/OrgSectionTabs.tsx` | A new tab shifts the row; draw the row with and without it, at a desk and at phone width |
| The home page carries a Tournaments section of its own | `components/public/ClubSiteHome.tsx`, `app/[orgSlug]/page.tsx` | The tab and the section must not say the same thing twice, or must say why |
| The Public site editor already has "Tournaments" and "Past tournaments" as separate rows in its lists/visibility controls | `app/[orgSlug]/admin/public-site/page.tsx` | A switch for the tab must fit that vocabulary, not add a third word |
| There is a Past tournaments page and a page per tournament; there is **no** list page for current and upcoming ones | `app/[orgSlug]/archives`, `app/[orgSlug]/[tournamentSlug]` | The tab needs a destination: a new list page, drawn here |
| Since 4e a club's tournament pages ride the club's own address too | Stage 4e records in the Club plan | The tab's link works on both addresses (the tab row already handles this; check, do not assume) |
| A club on a plan that does not carry tournaments can still have the public site | the plan gate for tournaments (`/billing` and `docs/agents/strategy/PLAN_PRICING_FACTS.md` hold the facts; **do not restate a plan fact, point at the Facts doc**) | Draw what that club sees: nothing, not a tab that leads nowhere |
| Stage 13 re-checks every stage that adds a navigation door, before the go/no-go | Club plan, Stage 13 | Note 4f as one such door so Stage 13 finds it; do not redesign the navigation here |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, open the cited lines
yourself; disagree out loud). The Club plan `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4 (the 4f
paragraph is the owner's ask, verbatim in spirit) and the Stage 4 drawings https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k
(the shape to follow and the club frame's rules). The Public site builder's drawings (link in the plan, Stage 4). The house UI
rulings in the auto-memory index that touch this screen: mockups are Claude Artifacts at true size; a phone's secondary action is
its symbol alone; absent beats disabled; every highlight is clickable; one spelling. Check each against the code before drawing on it.

## Push back (out loud, on the drawings page, before the work)

1. **A tab that comes and goes.** "Shown only while the club has a tournament" means the top row changes shape between visits. For a
   family who learned the row, a tab that vanishes between tournaments is a small trust cost. Weigh it against **one Tournaments tab
   that always holds Upcoming · Live · Past** (and retires the separate Past tournaments tab). State a recommendation and draw both.
2. **Beside the home section, or instead of it.** If the tab leads to a full list, what is the home's Tournaments section for? Recommend
   one answer (for example: the home keeps a short strip that ends in "All tournaments") and say what each shows.
3. **One switch or two.** The editor has Tournaments and Past tournaments as separate rows. If the tab is one door, does one switch
   govern it? Recommend, with the case of a club that wants only one of the two shown.

## What to produce

1. **One published Artifact** (source `docs/projects/active/CLUB_TIER_STAGE4F_DRAWINGS.html`; load `artifact-design` first), in the
   shape of the Stage 4 drawings: before = today's screen; after = drawn at **true size**, a desktop and a phone for each frame;
   NEW / RESTYLED / UNCHANGED tags; clickable flags; one checkbox per option for each ask; a paste-back summary at the end.
2. **Frames:** (a) the tab row with a tournament, at a desk and on a phone, beside today's row; (b) the row with no tournament (the
   tab absent, or present and empty, per ask 1); (c) the Tournaments page: one live tournament, several upcoming, one of each, and
   the link on to Past tournaments; (d) the home page's Tournaments section after the change; (e) the Public site editor's switch
   and where it sits; (f) a club whose plan does not carry tournaments; (g) the same tab on the club's own address (one small frame
   is enough).
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code (house
   rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`).
4. **Flow + design:** run `/ux` on the journey (who, where, how long, what goes wrong). Run `/design` on the whole page **before
   the hand-off**, apply its fixes, republish, report what it changed.
5. **Asks:** numbered, each with a recommendation; **ask 1 = the tab that comes and goes** (push-back 1).
6. **Records, same unit of work:** a 4f entry in `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 ("drawn, asks open", the link),
   `TODO.md` (the 4f line only), a PM brief line (what a family, an owner and an admin see differently), a `s4f` stage in the Club
   Tier project index (artifact `MBKRySURVFu3V9cZJvmjVr`: read `stages` first, pin `if_version`, state `ruled` only after the owner rules),
   and a short auto-memory file for 4f. Record rulings as ruled.

## Do not

- Build, migrate, seed or touch AWS or DNS.
- Reopen the club frame, the tab row's rules, the Public site builder, or 4e. Push back only if a frame exposes a real conflict, and name it.
- Draw the tournament-to-club link (it is another project), the tournament pages themselves, or any change to the platform's navigation (Stage 13).
- Restate a plan name, price or gate: point at `PLAN_PRICING_FACTS.md`.
- Promise timing anywhere.

## Definition of done

The drawings page is published and linked from the plan; `/ux` and `/design` have run and their changes are reported; every frame in
item 2 is drawn in its empty, working and edge states; ask 1 is answered with a recommendation and both options drawn; the records say
"drawn, asks open"; and a 4f build prompt can be written from the owner's answers without re-deciding anything.
