# Club Tier Stage 13i · The sidebar's shape (DRAWING session first, build prompt after)

> Written 2026-11-06 (by `/tasks`, on the owner's request), after the owner ruled all 25 hub asks as recommended. **Ask 25 = A:** the
> sidebar gets its own drawing session, then is built as 13i right after 13a. Paste into a **fresh chat on `dev`**:
> `execute @docs/projects/active/CLUB_TIER_STAGE13I_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is one published drawing
> (a Claude Artifact), the owner's rulings on it, and then a **build prompt** for 13i. Recommended model: Opus. Run `/ux` and
> `/design` before the hand-off. It touches no code, so it can run beside the 13a build ([CLUB_TIER_STAGE13A_BUILD_PROMPT.md](CLUB_TIER_STAGE13A_BUILD_PROMPT.md)).
>
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) (§5 the nav review; the status log
> entry "Owner: the side navigation feels clunky → stage 13i"). Standing rules: `docs/agents/design/NAV_STANDARD.md` (N1–N10 and its exceptions).
> Mark each fact **[V]** (you opened it this session, with file:line or the shot's name) or **[H]** (handed to you here, unverified).
> Everything below is [H] unless marked. Branch `dev`; explicit pathspecs; ask before committing; never push.

## What the owner said, and what was found

The owner finds the side navigation **clunky**. The Stage 13 walk judged *who sees which rows*, not *how moving around feels*; a usability
review of the walk's captures and the code found one cause (hub tab 11, "the sidebar"):

> A program's pages are handled **three ways**: rows stacked under the program in the sidebar (Rep teams, House league), **tabs on the page**
> (Accounting, Families), or a **tile hub plus sidebar rows** (Organization). So nobody can predict what a click will do from the row.

Findings to carry into the drawing (re-open each shot before drawing it; a helper's claim is a lead, not evidence):
1. **High.** A row with an arrow is a link, not a fold: clicking it opens the program's first page and never opens or closes anything. From
   inside a team, clicking "Rep teams" throws you back to the Teams list.
2. **High.** Inside one team the sidebar grows to ~22 rows (the program's six pages, the team's five, then the other programs). Organization falls
   off a 900 px screen. "Roster" reads as a sibling of "Past seasons".
3. **High.** Organization is reachable six ways; its sidebar rows and its tile hub disagree (Members is two clicks through the hub; the hub holds tiles the rows don't).
4. **Med.** House league's only child row is "Seasons", the page its parent row already opens; Public site grows a lone "Site editor". A layer with nothing in it.
5. **Med.** A season page carries its own "← Seasons" and a season picker on top of the sidebar's.
6. **Med.** A tournament swaps the whole sidebar (Calendar, Schedules and Accounting disappear; the way back is one row).
7. **Med.** The phone's More sheet and the desktop sidebar have different shapes (Organization's pages are flat on the phone, hidden on the desktop;
   a team's pages on a phone hang off a disclosure that vanishes on sub-pages).
8. **Med.** "Public site" names the editor in the sidebar and the live site in the header; "Schedule(s)" names five different things (that one is 13h's, not yours).
9. **Low.** "PROGRAMS" sits over Accounting, Families and Public site, which aren't programs. Plan & billing lives in the foot, away from Organization.

**Already fixed, do not draw it as a problem:** the double highlight inside a house league season (Stage 13 fix-now, committed `2a33cc98a`, walk §473 passed 30/30).

## The proposed direction (Ask 25 = A; a starting point, not a decision)

**Places in the sidebar, pages on the page.** One highlighted row. A team or a season block **replaces** its program's pages in the rail instead of
stacking under them. Organization is a hub **or** a list, not both. PROGRAMS regroups. This **re-opens N3** (the arrow rule, 2026-10-17) on purpose;
say so in the drawing, with the old rule beside the new one.

## Disagree out loud (settle these in the drawing, with a recommendation each)

- **The plan contradicts itself.** Its ladder note says "Not on it on purpose: regrouping the sidebar's headings", and then 13i absorbs the PROGRAMS
  regroup. The later entry (the owner's) wins; record that the earlier line is superseded so a builder isn't misled.
- **"Pages on the page" means a tab strip on every program page.** Accounting and Families already have one; Rep teams and House league do not. Before
  the owner rules, draw what a six-page program's tab strip looks like at 1440, 768 and **390** (does it scroll, wrap, or become a menu?). If the phone
  can't carry it, the direction is wrong for the phone and the desktop and phone shapes need separate answers (finding 7).
- **N2 and N3 are written for the shape that is being replaced.** List every rule in `NAV_STANDARD.md` the new shape changes (N2 headings that fold, N3
  chevrons, N7 the More sheet's order, N10 the phone bar, N9 the row's end: eye and waiting count) and draw the rewritten rule, not just the screen.
  A drawing that changes the shape but leaves the standard describing the old one is a half-ruling.
- **Do not widen to the coach portals or the tournament admin by accident.** `NAV_STANDARD.md` covers the club admin, the tournament admin (same
  sidebar, tournament mode), both coach portals and the platform admin's console. Ask: does the new shape live in the shared component (so all of them
  change at once) or only the club's? Find out from the code (`components/admin/admin-nav-config.ts`, `components/admin/ScopeNav.tsx`,
  `components/admin/useAdminKitNav.ts`, `components/admin/AdminKitBottomNav.tsx`) before promising either; say plainly what changes for a coach.
- **13a lands first.** Draw the baseline as *today + 13a as ruled* (Asks 6–9, all A: one in-frame "not yours" screen; the Organization hub shows only the
  doors the person holds, and a one-door person goes straight to it; House league leads for the league admin and registrar; the header pill reads
  "View site" with no duplicate foot door). 13i must not redraw those, and 13c adds a Permits row after 13i.
- **Five people, five different sidebars.** The owner, club admin, league admin, registrar and treasurer see different rows. Draw the new shape for at
  least the owner (the longest) and the registrar or treasurer (the shortest), so a one-door person is not lost behind a shape built for the owner.

## Steps

1. **Read** the plan (§0–§8 and the status log), `NAV_STANDARD.md` in full, and `.probe/nav-journeys/VERIFY.md` and `nav-census.md` (git-ignored scratch).
   The sidebar review's source is the `SIDEBAR` list in `.probe/nav-journeys/hub/content.cjs`; the published hub is
   https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY (tab 11 is the ladder; tab 15 is 13a's drawing).
2. **Re-open the captures** for the nine findings: `.probe/nav-journeys/shots/NAV-*` (desktop and phone, per person). Where a finding has no shot, capture one with
   a local production build (`node .probe/p5-prodbuild.cjs start`, port 3100); **never the :3000 dev server**. Count the rows per role and per screen
   and put the number in the drawing.
3. **Settle the facts the drawing depends on** from the code: how a program's children are built today (config vs component), what "active" tests against,
   how the arrow behaves, where Organization's rows and tiles come from, how the More sheet and the bottom bar are generated from the same config.
4. **Draw** (Claude Artifact, not the design canvas; the house layout: sticky numbered tabs, minimal scroll, an *Everything / Show only what differs* toggle;
   whole-screen before/after at true size; controls drawn from their shipped components; NEW / RESTYLED / UNCHANGED tags; every highlight clickable):
   - The owner's sidebar **today** and **after**, on: the Overview, inside a rep team, inside a house league season, inside Organization, inside Accounting.
   - The **registrar's** and **treasurer's** sidebar after.
   - The same screens at **390** with the bottom bar and the More sheet, so desktop and phone agree on one shape.
   - The tab strip for a six-page program at 1440 / 768 / 390.
   - The one-row highlight rule and the "way back" from a team, a season and a tournament.
   - The rewritten N2 / N3 / N7 wording, old beside new.
5. **Asks** for the owner, each with a recommendation and the alternative (for example: the arrow folds vs. the arrow is removed; Organization as a list vs. as a hub;
   where Plan & billing lives; PROGRAMS renamed or dissolved; the shape for the coach portals). Number them so the paste-back is short.
6. **Run `/ux`, then `/design`**, and apply what they find *before* publishing. Say in the hand-off what each changed.
7. **Publish** the Artifact once. Do not edit the repo's product code.
8. **Hand off in product-owner voice**: what a person sees and does differently, how it feels on a phone, the asks, and the order (13a first, then 13i, then 13c).
   Record in the plan's status log (one entry, with the Artifact link), add the link to the TODO Stage 13 line, and say that the ladder note about "not regrouping headings" is superseded.

## After the owner rules

Write the **13i build prompt** (`CLUB_TIER_STAGE13I_BUILD_PROMPT.md`): the screens, the guards (`tests/unit/nav-standard-guard.test.ts` and `admin-kit-nav.test.ts` rewritten
for the new rules, a phone-bar and More-sheet parity case), the `NAV_STANDARD.md` rewrite, the help articles and the demo tour anchors that name a sidebar row, one QA walk
(its own Owner QA Ledger section), and the staging layout sweep. Sequence: after 13a, before 13c, 13g and 13h.

## Do not

- Build or edit product code. Re-draw the double highlight. Touch the 13a screens. Decide the coach-portal question without reading the shared component.
- Invent a number: row counts and heights come from the captures.
- Record the owner's answers as anything but what they said.
