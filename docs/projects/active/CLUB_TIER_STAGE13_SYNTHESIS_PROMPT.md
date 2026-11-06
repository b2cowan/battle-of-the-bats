# Session 3 prompt — Club Tier Stage 13 expanded: stand back, ladder, end state, ONE publish

**Run in a fresh session.** Plan of record: `CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md` (read §0–§8 and the status log).
The walks are done (session 1–2, 2026-11-06): 26 journeys (O6, the president's view, added last) + the nav, on real screens, by walk helpers on a local production
build. This session turns them into the owner's hub. Follow `/ux`, then `/design` before the hand-off.

**The walk server is stopped** (2026-11-06). The shots are enough for the hub; if a drawing needs a fresh capture, start it
with `node .probe/p5-prodbuild.cjs start` (port 3100; rebuild with `… build` first if `.next` holds only `dev` — a clean
restart of the shared dev server wipes the production build). Never use the :3000 dev server for captures.

## Inputs (all in `.probe/nav-journeys/`, git-ignored scratch)
- `walks/<ID>.md` — one per journey (O1–O5, A1–A5, L1–L5, R1–R5, T1–T5) + `walks/NAV.md`. Station by station: shots,
  measurements, read, findings `F-<ID>-n` with severity, shape questions.
- `VERIFY.md` — **read first.** The parent's checks of helper claims against the shots and the code: what is CONFIRMED,
  RE-FRAMED (known ground, a standing ruling, already planned), corrected, or still UNOPENED. A helper's finding is a lead;
  a finding goes in front of the owner only after its shot is opened.
- `nav-census.md` — the code census of every nav surface per role (13 departures from N1–N10).
- `shots/*.png` + `.json` — captures with measurements. `WALK_BRIEF.md` — how the walks were done.

## Step 1 — finish verification (before writing anything for the owner)
Open the shots behind every High not yet marked CONFIRMED in `VERIFY.md` (at this writing: F-R2-7, F-R3-7, F-R4-2/5,
F-L4-1, F-T2-4, and A2/A4's once their re-walk lands). And settle the re-frames VERIFY lists:
- **How a club buys Club** on the day it goes on sale (F-O1-1): search the Plans & pricing program and Stage 8 for an
  intended purchase path; if none, it is a release gap to route to `/plan` + `/strategy`, not a nav finding.
- **Receipts** on ledger lines / coach requests (F-T3-2, F-T4-2): search the coach and club money plans before saying absent.
- **The dome draft's uneven split** (F-O2-5): the solver, or a seeded rule?
- **The tournament's fee model** in the fixture (F-O5-5) — and frame it against the two standing rulings VERIFY cites.
- **Removing a member** who is also a parent in the same club's family app — does "anywhere else" count it?

## Step 2 — stand back (the parent's seeds; test each against the walk files, add, merge, drop)
1. **The hand-offs between people are the weakest part.** Club → league admin: no notice, and the season says "The club
   hasn't given this season any time yet … in Schedules" (false; a page they can't open). League admin → owner: no door or
   ask. Schedule → coaches and families: only on a send. Tournament ↔ the club's book: no link either way. A coach's claim
   loses meaning on the way (payment method). The strong hand-offs to copy: the rep coach's arrival, the HL coach's team page,
   the treasurer's bell + tile + badge.
2. **Doors are listed by PLAN, not by PERSON, at every edge the sidebar doesn't police.** The org hub's Tournaments tile
   (a registrar lands in a tournament admin of blank and failing pages) and Members tile (refused); locked "Owner only" rows;
   "Also on your plan" for the league admin's own program; N10 keeping a program off the bar until the club runs it — right
   for the owner, wrong for the registrar whose whole job it is; empty Overviews for single-program roles; empty states
   written to the owner.
3. **"Not yours" behaves four ways** (silent bounce · named refusal · "Access restricted" with no heading · "Nothing to
   show"). One rule needed.
4. **The club's time is cut into corners.** Permits buried in Venue library (the owner's own opinion, confirmed by O2, O3,
   A4); permit → schedule is one good link, nothing comes back; the bill hides under View; the season Schedule's main jobs
   hide in "Tools"; hidden-not-disabled gates (Publish, U9 in Generate) leave a first-timer guessing; a rain-out is three
   tools (Schedules' Send the changes, the season's Email families, the public notice) and the Calendar that finds the
   Saturday can't act on it; pulling dates off a permit warns about nothing, anywhere (A4, confirmed) — the permit's and the
   schedule's dates off are two lists; the dome draft's default hands out a tenth of the dome.
5. **Numbers that don't lead to their lines.** Bank "Off by" (→ BC3 Find, already planned), Budget vs. Actual's Not filed /
   Off-plan, "who owes" answered in three unlinked places, house league money with no door for the treasurer.
6. **Family-facing actions.** Buttons that email without saying so (single Approve, Withdraw); no payment reminder (a blank
   email); no part refund; a likely duplicate whose only exits email the family.
7. **One name per thing** (rule 10): "Public site" for two destinations on one screen; "Tournaments" as entry and list;
   Messages / Communications; Coaches / Assistant coaches side by side; "Bill" vs "The bill"; three verbs for billing; two
   exports called "PDF report"; three names for one role; a tournament's name in the house league tab title.
8. **The first day.** The setup checklist never lets the owner go (defect); the invite email is one template for every role;
   the invite form defaults to Staff; no preview of what a role will see; Help is plan-filtered, not role-filtered.
9. **The phone.** The house league season's own second nav (three headers, the strip off the edge, a sideways drag, the
   name three times); the tournament crossing is two taps each way.
11. **The president's view (O6, added by the owner 2026-11-06 — "key to sell to club presidents").** Can the owner see the
    whole club at a glance: permits and free time across all permits, each team's budget, each team's tournaments, the
    club's finances, the dome and house league schedules together, this week, players across programs, what is at risk, a
    board summary, and which of it on a phone. Read `walks/O6.md` (its table sorts each question: answered · assembled by
    hand · not answerable from the club). The ANSWERED and ASSEMBLED rows are navigation and belong on the ladder; the
    NOT-ANSWERABLE rows are product work for the "Not navigation" tab — and since the owner names this as a selling point,
    recommend in the hub that the summary layer gets its own plan (`/plan`), rather than squeezing reporting features into a
    nav stage. **The positioning is DECIDED** (Business Decisions Log, 2026-11-06, "Club's headline promise to a president:
    one place that pulls the whole club together") — cite it. **Ruled the same day:** the summary layer FOLLOWS the Club
    release (so its new pieces are not release work); League Plus carries it too; **D1 stays — never propose a view into a
    coach's own books.** O6's Q2 is re-framed by the owner: "each coach's budget" = each team's standing WITH THE CLUB
    (allocated, collected, outstanding, overdue, held-by-the-team cash) — already on Accounting › Teams, so it is ANSWERED
    (2 clicks) and the hub's job is surfacing it, not a gap. Each team's tournament list: still open with the owner.
10. **What to keep** (say so in the hub, so a reshape doesn't break it): the owner's "This morning" Overview, the treasurer's
    landing, the checklist's content, the coach arrival, the close-year screen, the roll-over window, the publish window's
    email preview, permit → schedule pre-fill, the Practice time dialog, the HL coach's team page.

## Step 3 — sort what is NOT navigation
Some findings are defects or product gaps that don't belong in a nav stage (the checklist trap, the false "hasn't given"
line, approving into a full division with no warning, the double-bill risk if confirmed, no part refund, no payment
reminder). List them on their own tab with a recommended home (a fix now / an existing plan / a new item), so the ladder
stays about how people move. Rule from CLAUDE.md: a finding that a policy or plan promises something the product doesn't do
is routed, not softened.

## Step 4 — the stage ladder + the END STATE drawn
Per `feedback_deep_dive_is_walk_then_stages`: draw the END STATE of the reshapes the ladder proposes (before = capture,
after = drawn, NEW / RESTYLED / UNCHANGED, tagged with the stage that delivers it); never an intermediate state that looks
like today. Likely specimens (decide from the evidence): each person's nav + landing (five, desktop and phone); the club's
time as one place (permit → schedule → bill, and house league's share); the hand-off notice (club → league admin); one
"not yours" rule; the season page on a phone; the Organization hub by person. Include ONE whole screen before/after.

## Step 5 — the hub, ONE publish
House layout (`feedback_mockups_as_claude_artifacts`): sticky numbered tabs, one section at a time, an Everything / Show only
what differs toggle where it compares (people, devices). Tabs: How it was walked · The president's view (O6 — its own tab,
first after the method, because the owner names it as the selling point) · Owner · Club admin · League admin ·
Registrar · Treasurer · The nav · Standing back · Not navigation · The ladder · the drawn stages · Asks. Each journey tab:
station by station, the capture (inline it — build from `.probe` source with a build script, as the Schedule deep dive did),
the measurements, the read, clickable finding flags, shape questions with a recommendation. Run `/design` on it before the
hand-off. Then record: plan status log, the TODO line, memory.

## Owner questions to carry in the Asks tab
- ~~Sends on copies~~ — **RULED R3 (owner 2026-11-06): walking to the send is enough; the focus is how the app moves each
  person through the job.** Do not ask it again; judge O2's and L2's last stations from the send screens. Keep the weight of
  the hub on navigation and flow (how each person gets from one step to the next), not on downstream delivery.
- How a club buys Club (if Step 1 finds no plan).
- Every shape question the walks raised, grouped by stage, each with a recommendation.

## Fixture adds before the build stage's walk
An admin who also coaches a rep team; a treasurer or league admin who coaches; a cancelled club; a person in two clubs
(Workspaces); a published house league division. (NAV.md lists why each is needed.)
