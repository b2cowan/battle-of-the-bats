# Drawing prompt — Navigation, Phase 6 gate: the page's top row, and the "?" in the strip and the bar (tournament admin + club)

> One **drawing** session, pasted into a fresh chat (`/clear` first). **No code.** Written 2026-11-12 after walk §521 (Phase 5b)
> PASSED 34/34. Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` — read §5 **Phase 4b** (R1–R6, the "?" in the
> Coaches Portal strip), **Phase 5** (the phone bar keeps its "?"), **Phase 6** ("Owed, in order" and the gate answers of
> 2026-11-12) and the bullet "Owner review owed … the page's top row". Where this prompt and the plan differ, the plan wins; where
> the plan and the CODE differ, the code wins — say so out loud. Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. **Model: Opus**
> (layout judgement). Helpers read on Sonnet; open the cited lines yourself before building on a claim.
> **The output is a published drawing + the asks for the owner's rulings.** Build prompts are written only after he rules.

## The one-paragraph version
Two owner items are the same piece of screen, so they are drawn together (the plan said so on 2026-11-11 for the same reason):
(1) **the page's top row** — with the paper titles gone, what is left on the row (the page's buttons and the "?") takes more room
than it earns; and (2) **the "?" moves into the strip (computer) and the bar (phone) in the tournament admin and the club** —
**ruled YES 2026-11-12, not yet drawn, its own phase.** The Coaches Portal already did this for its team pages (Phase 4b R3, owner's
revision: the "?" sits in the strip beside the bell; the phone bar keeps its "?" — Phase 5 F3). The owner's direction (4b): *help's
place should be the same in all three portals.* Draw what each portal's top row looks like once that is true, and bring back the
decisions the rulings did not settle.

## What is already settled — do NOT redraw or re-ask
- **Coaches Portal, team pages:** the "?" is in the strip beside the bell (computer) and in the phone bar; tabs are pinned in the
  band (4b R1 = tabs only, buttons stay in the page); the account menu's Help row stays the full guide. The 2026-07-31 strip
  boundary ("a '?' is not an exit") was **reversed on purpose** by the owner — don't argue it again, but DO read the design-log
  entry so the new drawing states the reason it now rests on.
- **Strip words, the cell, the band, the foot doors, Help in the account menu** — Phases 0–5b, all walked.
- **The "?" move for the tournament admin and the club is ruled YES.** The drawing shows HOW and what is left behind; it does not
  reopen whether.
- **Open Phase 5 calls (Game day chip colour, the lone "+" row, a live team's Season's End title, the team sheet's season-only
  rows)** belong to the closing walk's open list. The *lone "+" row* is a top-row question — if your drawing settles it, say so;
  otherwise leave it.

## ⚠ Facts to verify first (the plan and the code may disagree — NAV_STANDARD's 2026-11-12 rewrite says the code won)
1. **The tournament admin draws its own "?" in the page header; the club draws none** (Help for the club is only the account
   menu). So for the club the move is an *addition*, not a move — confirm in the code and say so to the owner. Ask whether the
   club wants a "?" at all on every page, or only where a page has its own help panel (the "?" opens a per-page panel in the
   Coaches Portal and the tournament admin; check what the club's pages have).
2. **What the "?" opens on each surface** — the page's own help panel, or the full guide. Today: coaches = the page's panel on a
   computer, the full guide from the phone More sheet's Help row, and the bar's "?" on a phone (read `CoachDeskTitle` /
   the help button component; don't trust this sentence).
3. **Pages with no help panel** — 4b's census found most coach pages do open on something other than a heading; do the same census
   for the tournament admin (about how many screens carry a "?", how many have buttons beside it) and for the club.
4. **The strip's room** — the strip already carries the page name, the team/event facts at the right end, the bell and the account
   menu. Measure at 1280, 1366 and 1440 how much a "?" costs the facts (they "give way before the name is cut").

## Read first
1. The plan sections named above; `docs/agents/design/NAV_STANDARD.md` (strip, bar, N2/N3/N11/N13); `memory/design_decisions.md` —
   search it for the 2026-07-31 strip ruling AND the 2026-11-11/12 entries that reversed it, **before** writing any reason (the
   4b session once told the owner the reason was lost; it was not).
2. The shipped pieces to draw from (draw a control from its SHIPPED component): the Coaches Portal strip + `recordSlot`
   (`components/coaches/CoachDeskTitle.tsx`), the tournament admin's page header and its "?" (`AdminPageHeader`, `DeskNamedPage.tsx`),
   the club's strip (`AdminKitRail` / the strip component), the phone bars (coach `CoachBarName`; tournament Phase 3 bar; club bar).
3. Screens to capture as "before" at 1440 × 900 and 390 × 844 (touch), plus 768 × 1024 for the tablet (it wears the phone chrome):
   - Coaches Portal (UAT coach `uat-coach@uat-test-org.local` · `UATPassword2026!`, UAT Test Team): a tabbed page with buttons
     (Ledger or Money), a page with a lone button (Schedule), a page with nothing but the "?" (any lone-"?" page that remains).
   - Tournament admin and club: use dev org sign-ins from the §508/§512/§504 walks (`club-owner@dev.local` · `devpass123`);
     a page with several buttons, a page with one, a page with none, a page with tabs.
   Measure, don't eyeball: the row's height, what sits on it, how far the first content starts below the strip, per portal.

## What to draw (whole screens, true size, before | after, computer and phone)
1. **Top-row census, one picture per portal** — the same five or six page *shapes* in each portal (buttons + "?", one button,
   "?" only, tabs, a form page, a record page), today vs. proposed, with the measured content-start `y` for each.
2. **The strip with the "?"** in each portal at 1440 and 1280: where it sits relative to the bell, and what the facts do. One
   rule for all three (the owner's direction); show the Coaches Portal as the shipped reference.
3. **The phone bar with the "?"** in each portal (the coach bar is the reference; the tournament bar's door is one 44px target
   over page name + line — don't crowd it; the club's bar is the lightest).
4. **The page buttons.** With the "?" gone from the page row, what is left is the page's own buttons (Add, Export …). Draw the
   options the owner has been circling: (A) buttons stay in the page below the strip, no row if there are none (the 4b ruling for
   the Coaches Portal — the reference); (B) buttons ride the strip's right end; (C) buttons in the band. Recommend one; the club,
   tournament and Coaches Portal must end on the *same* answer, and say what happens to a page with tabs (4b R1/R2: nothing rides
   the band).
5. **Help's destination from the "?"**: if the "?" opens a per-page panel and a page has none, what shows? (Hide it? Open the
   guide at the page's section? — check what the code does for the Coaches Portal today and stay consistent.)
6. **Edge cases:** a person with no help access / a suspended org (help is off then — Phase 1 says "never when suspended"); the
   support console; the free Coaches Portal (E13 exception — out of scope unless the "?" lands there by the shared strip: check);
   a long page name at 390 and 1280; the tablet.

## The asks to bring back (recommend one; first option = your recommendation)
- **T1 · The "?" position in the strip** — one place for all three portals (beside the bell? left of the account menu?) and what
  gives way at 1280 and 1366.
- **T2 · The page's buttons** — A / B / C above; one rule for three portals.
- **T3 · The club** — a "?" on every club page, or only where a page has help to show; and whether the club's phone bar gets one.
- **T4 · The lone "+" row and the "?"-only rows still left** — gone, kept, or moved.
- **T5 · Order of the build** — does the "?" move (all three portals' strips + bars) go in one phase or two (strip first, buttons
  second)? Sequence by what must exist first and what would be redone — never by "when".
- **T6 · Anything else the drawing surfaces** — including a disagreement with a ruling, argued from the code (AGENCY_RULES:
  disagree out loud). Don't manufacture one; if the direction is right, say so and name where the risk sits.

## How to present it
- One Claude **Artifact** (HTML), the house drawing layout (memory: mockups as Claude Artifacts — sticky tabs, Everything / Show
  only what differs; whole-screen before/after; true size; every highlight clickable to its note; phone figures as rows).
  Publish to a NEW artifact; save the source as `docs/projects/active/ADMIN_NAV_PHASE6_TOPROW_DRAWINGS.html`; link it from the
  plan's Phase 6 record and the prompts index.
- Run **`/design` on the drawing before hand-off** (delegate it to a helper — the skill loads big memory files) and apply what it finds.
- In the chat: the **product-manager UX summary** (what each kind of operator sees and does differently, both widths, who is
  affected), then the asks T1–T6 with recommendations. **No code, no commit.**
- When he rules: record the rulings in the plan (Phase 6 "Owed" list: item 2 done, item 4 gets its shape), then write the build
  prompt (`ADMIN_NAV_BUILD_PHASE6B_QUESTION_MARK_PROMPT.md`). The build must also: update NAV_STANDARD (the "?" rows and the
  "tournament admin draws its own '?', the club none" line), the design-log entry, the affected guards in the open, the help
  sentences that say where the "?" is (`/docs`), and fold its checks into the closing walk.
