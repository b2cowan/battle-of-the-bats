# Public tournament pages · Sponsors — design kickoff prompt

**▶ UNBLOCKED 2026-11-22: Board Ready Stage 6 is drawn and ruled** (`BOARD_READY_PLAN.md` §5 Stage 6, both rounds). Its
rulings REPLACE open questions 1 and 2 below; draw from them, do not re-ask them:
- **Where the logo shows = one record (Stage 6 ask 1A).** A business is kept once and has *places*: a kind (the club, a
  house-league division, a house-league team, a tournament; later a club event), which one, and a last day. A tournament
  place joins **that tournament's Overview strip**. A paid deal whose package has "Your logo on our website" on IS a place;
  a typed place is set on the club's Sponsorships › Sponsors tab.
- **Which plans (ask 2A, `BUSINESS_DECISIONS.md` 2026-11-22):** the existing Tournament Plus branding gate
  (`advanced_tournament_branding`, no new key). A free event's editor shows Sponsors locked and names Tournament Plus;
  Tournament-only organizers get display only (no packages or deals).
- **Limits (ask 11A):** 20 is the club home strip's limit only; the list holds up to 100.
- The club's Sponsorships area (deals, packages, the Sponsors tab) is built by the Stage 6 build prompt
  (`BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md`); this drawing decides only how sponsors look and are set on the
  tournament side, including for an organizer with no club.

**Use this to start a NEW chat with `/design`.** This is a drawing session, not a build: no product code changes until
the drawing is ruled and a build prompt is written from it. Written 2026-11-20.

## Why this session exists

Sponsors on tournament pages is the next item on the public tournament pages ladder (the "Side · Sponsors" row of
`PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9). The *what* is ruled; the *drawing* never happened. The plan's own words
(§7): "The drawing of that choice (where the organization's choice lives, what a tournament organizer sees under each)
… is not drawn yet."

## What is already ruled (do not re-open; cite the reason, not the ruling, if you disagree)

From the owner's 2026-10-27 rulings (plan §10 Ask 5; `docs/agents/strategy/BUSINESS_DECISIONS.md` 2026-10-27 "One
sponsor list per organization"):

1. **One sponsor list per organization, and each sponsor says where it shows:** the club site, and/or chosen
   tournaments. A club adds a business once and ticks the tournaments it backs. A separate per-tournament list was
   rejected because it makes a club enter the same business twice.
2. **A club sponsor is not automatically a tournament sponsor.**
3. **Sponsors follow branding's logic** (owner's note, verbatim in substance): "organization can put their sponsors
   there or let their tournament organizers put their own. Tournament organizers not linked to club get their own
   sponsors section." The branding precedent is the club's tournament-look rule on the public site editor (the
   question before *Always*: the club's look on every tournament, or each organizer's own).
4. **Where they show (plan §7, lean, part of the ruled §7):** a Sponsors strip at the foot of the tournament Overview,
   above the footer, the club's own strip (2 tiles a row on a phone, equal size, no tiers). Overview only, as the club
   shows sponsors on its home only. In the Overview order (plan §5): before the event, after News; after the event,
   after the host card.

## What exists today (read before drawing)

- **The club's sponsor list** (Club Tier Stage 4d): edited on the club's public site editor (Sponsors row; a sponsor
  has a name (the only required field), a logo, a link and an optional last day; at most 20; no tiers; an ended sponsor stays in the editor marked
  Ended and leaves the public page at midnight after its last day). Shown by the club home's Sponsors strip. Read the
  shipped editor row and the shipped strip, and draw from them (`feedback_draw_controls_from_shipped_component`).
- **The tournament-look rule** on the same editor: the precedent for "the organization decides, or lets organizers".
- **A tournament-only organization** (Tournament / Tournament Plus plans) has **no club site and no site editor**, so
  today it has nowhere to keep a sponsor list at all. Its organizer works in the tournament admin (Branding page,
  event settings). Where its list lives is the drawing's hardest question.
- **The tournament Overview as built** (Stages 0–8 on production): band, Register card / game day / Champions, facts,
  News, host card, footer.

## What is still open, and must be in front of the owner by the end of the session

1. **⚠ The plan gate is owed, and it is tied to another project.** Which plans show sponsors on a tournament was left
   to `/strategy`; on 2026-11-10 it was bound to **Board Ready Stage 6, Sponsorships** ("decided together with Stage 6,
   not now"; tournament-only organizers get display only). Stage 6 is not started and not drawn. The plan's lean:
   sponsors follow the Tournament Plus branding gate (a free event cannot show even its own host's logo), with a free
   event's editor showing them locked and naming the plan that has them.
   **Recommendation to put to the owner:** decide the display gate now, through `/strategy`, rather than wait for
   Stage 6. Display does not depend on selling sponsorships; Stage 6's paid deals only *feed* the same list later. If
   the owner prefers to keep the tie, the drawing still proceeds, but the build waits on Stage 6's gate ruling.
2. **Leave room for Board Ready Stage 6 so it is not rework.** Stage 6 (`BOARD_READY_PLAN.md` "Stage 6 —
   Sponsorships") sells packages and records deals; a deal is attached to the club, a house-league division or team, a
   club event **or a tournament**, and "the paid deal feeds the one sponsor list, so the logo shows where the deal says".
   The *where it shows* control drawn here must be the same choice a paid deal sets later, not a second one.
3. **The questions the drawing answers** (one station each, in the house layout, desktop and phone, true size):
   - **A.** The organization's choice: where it lives on the site editor, and its two answers (the club's sponsors on
     its tournaments · each organizer adds their own), modelled on the tournament-look rule.
   - **B.** A sponsor's *where it shows*: the club site and/or chosen tournaments, on the sponsor's own editor row.
     What it reads like at 20 sponsors and a dozen tournaments; what a finished tournament does to the list.
   - **C.** The tournament organizer's side under each answer: what they see when the club decides (read-only, with
     who to ask), and where they add their own when the club lets them.
   - **D.** The tournament-only organization: where its one list lives without a club site.
   - **E.** The Overview strip, before and after the event, desktop and phone, in the light frame, including a
     tournament with its own colours (the band) and with the club's look.
   - **F.** The locked state on a plan without sponsors (only if the gate in 1 says one exists).
   - **G.** Empty states: no sponsors chosen means no strip (an empty part is absent, plan Ask 3).

## How to run it

- **Mockups are a Claude Artifact HTML page**, never the canvas, in the house layout (sticky tabs, *Everything* /
  *Show only what differs*), whole-screen before/after at true size (`feedback_mockups_as_claude_artifacts`). The coach
  portal's written formatting rules are the benchmark (`feedback_portal_is_the_formatting_benchmark`). Every highlight
  is clickable (`feedback_clickable_design_annotations`).
- **Run `/design` on the mockup before handing it to the owner** (`feedback_always_run_design_on_mockups`).
- **Words:** draft them in the drawing; `/marketing` confirms them after the ruling. One spelling everywhere
  (`npm run check:spelling`).
- **`/legal`:** a sponsor's logo and link on a public tournament page is the club's content, as on the club site
  today; flag only if the drawing creates something new (for example, collecting anything from the business).
- **End with the asks**, ranked by how much they change, each with a recommendation, in a paste-back block on the
  page; record the rulings in `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §7 and the board line in the same commit, then
  write the build prompt.

## Out of scope

- Selling sponsorships, packages, deals, invoices, the sponsor's pay link (Board Ready Stage 6).
- Sponsors on any tournament page other than the Overview, and sponsor tiers (ruled: none).
- Team sponsorships in the Coaches Portal (they stay the team's, 2026-11-06).
