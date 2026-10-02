# Copy a lineup from another game — plan

**Hub (mockup · brief · plan · decisions, one artifact):** `docs/projects/active/COACH_LINEUP_COPY_FROM_GAME_HUB.html`
(https://claude.ai/artifact/1MsdQnRrdVz63UrWztuEDK)
**PM brief:** `docs/projects/active/COACH_LINEUP_COPY_FROM_GAME_PM_BRIEF.md`
**State:** drawn 2026-10-02 (three rounds); **ruled as drawn 2026-10-02** ("looks good, go ahead");
**built on dev 2026-10-02** — see §9. QA walk: the hub's QA Walk tab (OQA §259). The mockup is the
visual spec.

---

## 1. Problem

A coach who wants Sunday's lineup to match Saturday's has one route today: open Saturday's game, save
it as a template, open Sunday's game, load the template. Tournament weekends are when coaches reuse a
lineup most, and every one of them leaves a template behind that nobody uses again.

The owner's use case (2026-10-02): a coach rolls a lineup over a tournament weekend and wants the same
one each day, sometimes the **order only**, sometimes the **order and positions**.

## 2. Findings

**F01 — A game's lineup can only be reused by first making it a template.** The builder's Templates
drawer lists saved templates and offers to save this lineup as one. Nothing reads another game's
lineup. The workaround costs four screens and leaves a throwaway template in the library.

**F02 — "Keep current" bounces the coach out of the drawer** (pre-existing; Mobile Experience plan
§13.6 #5, carried on the owner-calls TODO line). Loading a template over a lineup with positions opens
a confirm dialog mounted at the portal root, outside the drawer's dismiss boundary. Answering "Keep
current" also reads as a tap outside, which closes the drawer. The proposal replaces that confirm with
a step **inside** the panel.

**F03 — The template-load notice blames the roster for a choice the coach made.** "Skipped N players
no longer on the roster" counts every template player who is not in **this game's current lineup**,
including players the coach took out of this game who are still on the team. The copy rules bring
rostered players across, and the notice names only players who have left the team.

**F04 — The notice asks the coach to save a page that saves itself.** "Loaded “X” — review and save
when ready." The lineup autosaves. The new notice says what happened and nothing more.

**F05 — A seventh square does not fit the phone's tool row** (found in round 2). At ≤640 the row is
six 44px squares 8px apart (Call up, Undo, Redo, Print, Templates, Clear), which comes to 304px. Inside
`.coachesMain`'s 16px gutters a 360px phone has 328px and a 390px phone has 358px. Round 2's
seventh square needed 356px. *Closed by D11:* the row becomes five squares, 252px.

**F06 — A disk promises a save the page already made** (round 2). The builder autosaves through the
floating pill, so a disk beside Print reads as "save this lineup". *Closed by D11:* Save as template
is a worded item in Tools and needs no icon.

## 3. What the coach sees

1. **The toolbar** (D11): Setup, then **Call up a player · Undo · Redo · Clear · ⋯ Tools**. The tools
   that change the grid while you build stay on screen; the tools that take a lineup in or out go
   behind Tools.
   - **Tools is the portal's existing toolbar menu**, as on the club Ledger (`CoachToolbarMenu
     label="Tools" icon={MoreHorizontal} collapseOnPhone bareOnPhone drawerOnPhone
     drawerTitle="Tools"`). It is a worded trigger on desktop and a bare ⋯ on a phone, and its items
     each carry a hint:
     - **Copy from…** — "A previous game's lineup or a saved template"
     - **Print…** — "Dugout poster or batting order card"
     - **Save as template…** — "Keep this lineup to reuse on any game"
   - It is a **menu**: on a phone the sheet stops at the nav's top edge, with the nav visible and
     undimmed (2026-09-23 drawer ruling). Choosing an item closes the menu and opens that item.
2. **Copy from** opens its own panel where the menu was: a title, a **Games / Templates** switch
   (D12), and the chosen list scrolling under them while the title and switch stay put.
   - **Phone (≤640): full screen above the nav** (D7), titled "Copy from" with "Into vs Komoka Kings ·
     Sun, Oct 4" under the title, because the builder is out of sight. Rows are 56px. It is a
     menu, so the nav stays.
   - 641–900: a bottom drawer. Desktop: an anchored panel, 360px wide, with the list capped at about
     320px and scrolling.
3. **Choosing a source** asks one question in the same panel: **Batting order** or **Order and
   positions**, with Back to the list on the same switch. There is no separate confirm. When this
   lineup already has positions, one line says "This replaces the lineup on this game. Undo brings it
   back."
4. **After the copy**, the panel closes and the notice above the grid names what was copied and from
   where ("Copied the order and positions from vs Lucan Ilderton (Sat, Oct 3). Emma Ross is called up
   for this game too."). One Undo reverses it. Before game time the lineup returns to Draft, like any
   edit (D11d unchanged).
5. **Print…** opens today's print panel, **unchanged**: the poster with its Landscape / Portrait turn,
   the batting order card, and the notes checkbox. That is **one tap more than today**, the accepted
   cost of the split.
6. **Save as template…** opens a small window with a name field and a **Save template** button.
   Making a template is a create, so it asks. Desktop: an anchored panel. Phone: a short drawer that
   **covers** the nav, because it is a form. Afterwards the notice reads "Saved “Fall Classic
   A-lineup” as a template."
7. **No prompt on a blank lineup** (D4).

## 4. The rules

### 4.1 Order and positions = everything (D2)

Copies the batting order, who starts (nine-player), every inning's positions **including the
pitcher**, the format, the innings, and the game's rule changes from Setup. **Assumed (confirm on
review):** the game's notes and each player's note on that game are not copied, because both are
about that day.

### 4.2 Batting order only

This game's format, innings and rules stay. Players take the source's order. Players on this game who
did not bat in the source go to the bottom, in their current order. **Each player's positions on this
game stay with them.** In nine-player ball, who starts comes across when both games are nine-player;
otherwise this game's format decides.

### 4.3 Who comes across: as is (D3, D5)

| Player | What happens |
|---|---|
| In the source, on the roster | Comes across, even if the coach had taken them out of this game's lineup |
| In this game's lineup, not in the source | Stays, at the bottom of the order, with no positions (the check reports them undecided) |
| Marked Out for this game | Copied as is. The status line and the Lineup check already warn ("Ella Chen is marked Out but still in the lineup") and carry their one-tap fix |
| Left the team | Skipped, and named in the notice |
| A call-up in the copied lineup | **Comes across (D5)**, called up for this game too, in either mode, and named in the notice |

**How a call-up comes across.** A lineup cannot hold a player who is neither rostered nor called up to
that game (the server refuses the save). So the copy links them to this game with the existing
call-up add, **awaited**, and only then lands the rows. Undo puts the lineup back but leaves the
call-up on the game, out of the order, where the existing remove control takes them off. A template
never holds a call-up.

### 4.4 Templates get the same choice (D6)

Loading a template goes through the same two-way step. This retires F02.

## 5. The lists (D12)

- **Games:** this live season's games that **started before this one**, with a saved lineup (status
  other than Not started), not cancelled. Newest first, in **month bands** that stay pinned as the
  list scrolls. Each row reads opponent, then the date and start time written out, then the innings.
  Later games are not listed.
- **Templates:** every saved template, name first, then format and innings.
- **The switch opens on Games**, unless no earlier game has a lineup and a template exists, in which
  case it opens on Templates.
- **Empty states:** "No earlier game has a lineup yet." · "No saved templates yet. Save one from Tools ›
  Save as template."
- **No search.** The game a coach wants is nearly always in the top rows. Add search only if long lists
  prove to be a problem.
- **The live season only.** The builder never learns a year, so `HISTORY_ENDPOINTS` does not change.

## 6. Out of scope

- A prompt on a blank lineup (D4).
- "Copy to next game" from the games list. The Templates tab already applies a template to a game.
- Continuing the order where the last game ended ("rolling" the order). Nothing records who batted last.
- Copying from a later game, or across seasons.

## 7. Build notes

- **No new write path.** The copy maps rows client-side and the ordinary autosave writes them through
  the page's save chain. A call-up (D5) is linked first, awaited, so the autosave never PUTs a player
  the server does not yet admit (the failure mode `removeCallUpFromGame` documents).
- **Reads.** The games list comes from the events read the Lineups hub already uses
  (`lineupStatusByEvent`), fetched when Copy from **opens** (the call-up sheet's pattern), not on page
  load. The source lineup comes from the existing per-game lineup read. Both are sequence-guarded
  like `openCallUpSheet`.
- **One pure mapping function** shared by game and template sources, unit-tested for: order only;
  order and positions; a player missing, extra or departed; a call-up; nine-player ↔ everyone bats;
  a different inning count.
- **Undo.** One snapshot is pushed before the copy, as template load does today.
- **Guards that move** (`coach-lineup-phone-guard`). Update each pin; never delete one:
  - The D2 tool row asserts `['Undo','Redo','Print','Templates']` plus Clear as the editor's square.
    It becomes Undo, Redo, Clear and the Tools trigger. Print and Templates leave the row. Clear's own
    pins (confirm, greyed-out state, in the row at every width) are unchanged.
  - The Templates trigger pins (`LayoutTemplate` glyph, aria-label, "a glyph BUTTON, not a
    role=menu", the name `<input>` inside it) are replaced. Tools is a `CoachToolbarMenu` with
    `role="menu"`, and the name field lives in the Save window.
  - The drawer-layer pins: Templates was `overNav` (a form). Copy from and Tools are **menus** (the
    nav stays), and Copy from is full screen at ≤640. The Save window takes the `overNav` pairing,
    drawer and scrim together, with `useOverlayOpen`.
  - The Print preflight (`confirmPrintIfOpen`) is unchanged and still runs from Print….
- **Checks:** `verify:changed`; `check:layout --only=coach-lineup-builder` at 361/390/768/1440 (the
  row must stay on one line at 361 with 44px squares); the spelling gate.
- **Help** (`/docs`): the Lineups article gets "Copy a lineup from another game", and learns that Print
  and Save as template live in Tools.
- **Demos:** no tour step targets the Templates button or Print (checked 2026-10-02).

## 8. Decisions

| # | Question | Ruling |
|---|---|---|
| D1 | What is it called? | **Copy from** (owner, 2026-10-02); since round 3 it is an item in Tools |
| D2 | Does Order and positions leave the pitcher open? | **No, it copies everything** (owner, 2026-10-02) |
| D3 | Leave out players marked Out? | **No, copy as is**; the existing warning flags them (owner, 2026-10-02) |
| D4 | Prompt on a blank lineup? | **No** (owner, 2026-10-02) |
| D5 | Call-ups in the copied lineup | **Bring them**, called up for this game (owner, 2026-10-02) |
| D6 | Templates get the same two choices | **Yes** (owner, 2026-10-02) |
| D7 | Copy from full screen on a phone | **Yes** (owner, 2026-10-02); it stops at the nav because it is a menu |
| D8 | Save as template out of Copy from | **Yes** (owner, 2026-10-02); round 3 puts it in Tools |
| D9 | The Save square's glyph | **Closed by D11.** A worded menu item needs no glyph |
| D10 | Room for a seventh square on the phone row | **Closed by D11.** Clear stays on the toolbar |
| D11 | Copy from, Print and Save as template behind ⋯, editing tools on screen | **Yes** (owner proposal, round 3). Drawn with the portal's Tools menu; Print is one tap deeper. "As drawn" is owed |
| D12 | Long lists: a Games / Templates switch | **Yes** (owner proposal, round 3). Drawn: earlier games only, newest first, month bands, no search. "As drawn" is owed |

## 9. As built (2026-10-02)

Built on dev to the round-3 drawings, the same day they were ruled.

**What landed**
- `lib/lineup-copy.ts` — `copyLineup`, the one pure mapping for both sources (§4), with
  `tests/unit/lineup-copy.test.ts` (eleven cases). `lib/lineup-grid.ts` imports
  `coach-roster-name` relatively so the test runner can load it.
- `components/coaches/LineupCopyFrom.tsx` (+ `.module.css`) — the panel: the Games / Templates
  switch, month bands, the question. It reads the season's games when it opens and the picked game's
  lineup as it is picked; a stale answer lands only while the panel still waits on that same game.
- The builder page — `toolsControl` (the portal's `CoachToolbarMenu`, as on the club Ledger) holds
  Copy from, Print (today's panel, unchanged) and Save as template (the old drawer's form, as its own
  window); one wrap, one dismiss boundary, three back steps. `copyIntoLineup` links copied call-ups
  first (awaited), then maps, then writes the notice; the notice outlives the copy's own autosave and
  goes with the next edit. The "Start from template?" confirm and its F02 bounce are gone.
- The editor gains `controlsTrailing` so Tools follows Clear: Call up · Undo · Redo · Clear · Tools.
- The events read adds `lineupInningsByEvent` (from the readiness query it already ran) for the
  list rows' innings.

**Departures from the drawing:** the month bands wear the builder's own uppercase label, not the hub's
monospace. The "Into …" line shows only on the full-screen phone panel, as drawn there.

**Fixed on the way:** "Call up a player" was 40px between 641 and 900px — the one short control in
the row, and under the floor at 768 (Mobile plan §13.6 #6, "pre-existing, not fixed"). It takes 44px
there now. The layout sweep caught it the day Tools shortened the row.

**Found, not fixed (report-only):** the Setup panel's "Game rules ▾" is 16px tall at 768 on the sweep's
`coach-lineup-builder-setup` screen. It predates this work; the Setup panel was not touched.

**Checks:** typecheck clean; focused lint clean; unit 5,506 / 5,506; spelling, CSS-module purity,
CSS selectors (the four dead `lineupTemplate*` list rules deleted), date, contrast and token gates
green; `check:layout --only=coach-lineup-builder` no new findings at 361/390/768/1440. Browser probe
(`.probe/copyfrom-shots.mjs`, UAT coach, 1440/390/360, warm and dark, writes intercepted): the row,
the menu, the full-screen phone panel stopping at the nav, the bands, the question, a copy, and the
notice surviving the autosave — all as drawn.

**Owed:** owner QA walk (OQA §259, three walks).

## 10. Simplify, review and help (2026-10-02, the same day)

**/simplify (four lenses — reuse, simplification, efficiency, altitude).** Applied: the panel's lists
are the portal's shared row list (`CoachRowList inset` + `CoachRowBand` + `CoachRow as="button"`,
the Templates tab picker's own recipe — owner ruling "a shared component beats a shared class"), so the
rows gain the list standard's chevron; `formatEventWhen` for the row captions; one `lineupModeLabel`
in `lib/lineup-grid.ts` replaces three hand-copied "9 player ball / Everyone bats" ternaries (builder,
Templates tab, Copy from); one `gameRulesFrom` for the rules-override → Setup mapping (load and copy);
the panel's two views split; call-up links run in parallel; the Tools trigger's row height lives in
`coaches.module.css` beside the row's other controls (`.lineupToolsTrigger`). **At altitude:** the line
above the grid now ends on the coach's next EDIT (`markLineupDirty`), not on the next save — every
notice used to vanish ~1s later under its own action's autosave; the copy-only hold is gone. Skipped:
a sequence-ref stale guard in the panel (the hooks lint reads it as a render read — state is used);
computing the copy once (the updater re-maps from the rows as they are after the awaited links);
teaching the unit-test resolver the `@/` alias (shared test infra — report only; `lineup-grid`'s one
value import is relative instead).

**/review (high-risk tier, five lenses — correctness, security & tenancy, data & contract,
concurrency, regression).** Confirmed and fixed: (1) **Undo after "Order and positions" left the
copied game rules behind**, and the next autosave wrote them — a copy's undo step now carries the rules
(`LineupSnap.rules`, only on steps that change them; Redo restores them too), pinned in the phone
guard; (2) a second copy could start while the first was still linking a call-up (reopen Tools mid-copy)
and the two overwrote each other's call-up list, resurrecting a call-up removed meanwhile — one copy at a
time (`copyingRef`), and linked call-ups merge INTO the current list; (3) the panel's "Copying…" state
reset only on failure — now in `finally`. Refuted: Escape closing the whole panel (a dialog's Escape
dismisses it; Back keeps the one-level step); a fallback to this game's own row for a source player
(that player is already in this game's lineup, so nothing new can be admitted); three unreachable edge
cases (a game with no start, a 0-inning lineup, a player both rostered and called up). Security: every
read and link is scoped server-side to the caller's team and season; `lineupInningsByEvent` rides the
same capability gate as `lineupStatusByEvent`. Regression: nothing else depends on the removed
Templates drawer, the Print square or the deleted list classes.

**/docs.** The Lineups article (`premium-lineups`) gains the sub-topic *Copying a lineup from another
game* (`lineups-copy-from`) and the FAQ *Can I use the same lineup as my last game?*
(`faq-lineup-copy-from-game`); the templates and save/print answers say where Save as template and
Print live now (Tools); "what sends it back to Draft" names a copy; search learns copy from, same
lineup as last game, tournament weekend, tools menu, where did print go. All sections stay under the
350-word standard. No help screenshot shows the builder.

**Print panel, owner ask the same day** ("this isn't clear which one portrait vs. landscape applies to"): the poster's turn switch sat as far from the poster as from the Batting order card. A hairline now closes the poster's group (the poster, its turn and — when the lineup has notes — the notes checkbox, which used to sit under the Batting order card it does nothing to); the card stands below the line.

**Gates after both passes:** typecheck clean for this change; focused lint clean; lineup tests 65/65;
spelling, CSS-module, CSS-selector, date, contrast, token, dictionary and snapshot gates green;
`check:layout --only=coach-lineup-builder` no new findings; the browser probe re-run after the review
fixes. (The full unit run's one failure, and the type errors in `accounting/`, are another session's
in-progress Ledger Parity work.)

## 11. QA, and round 4 (2026-10-02)

**OQA §259 ✅ passed 22/22** — three walks, walked on the UAT Standalone Team; the writing-step
fingerprint was read before recording (ledger §259).

**Round 4 (drawn, hub screen 9) — save over a template you already have.** Owner: "do we not have the
ability to save over an existing template?" It did not: Save as template only created, and an existing
name was refused by the server (409) after pressing Save. The PATCH route the template editor uses
already takes entries, format and innings, so no server work is needed.
- **D13 — the name decides.** One field, one button. A new name saves a new template; a name you already
  have (capitals and spaces aside) turns the button into "Replace “X”…", with a line saying so. Your
  templates are listed under the field (shape, player count, last saved), and tapping one goes straight
  to the question.
- **D14 — "are you sure", inside the window** (owner: "including the are you sure"). A second view: "Replace
  “X”?", Now / After facts, "This can't be undone. Undo takes back changes to the lineup, not to a saved
  template.", a red Replace template (`btnDanger`) and Keep it / Back. Never a pop-up (F02's lesson).
- **D15 (proposed) — call-ups are left out of templates.** Found while drawing (**F07**): Save as template
  sends every row, call-ups included, and the server accepts only the active roster, so saving from a
  game with a call-up fails today with "Templates can only include active roster players". Proposed: leave
  call-ups out and say so in the window; same for Replace.
- **F08** — at the 50-template season limit Save says "Delete one to add another"; Replace adds nothing, so
  it still works, and the message will say "Replace one of yours instead, or delete one".

**Round 4 built 2026-10-02** (owner: "looks good, go ahead with your recommendations" — D13, D14 and D15 as
drawn). `components/coaches/LineupSaveTemplate.tsx` is the window's body: the name match is the server's
own uniqueness rule (trimmed, case-insensitive); "Replace “X”…" (`btnDanger`) opens the in-window question
with its own Back step; Replace PATCHes the named template (order, positions, format, innings — its name
and nothing else kept); call-ups are left out of every save and the order renumbered without them; the
limit message names Replace. Verified in a browser at 1440 and 390 with writes intercepted (a typed
"tournament a-lineup " matched "Tournament A-lineup"; the question showed Now/After; one PATCH to that
template; the notice "Replaced “Tournament A-lineup” with this lineup."). Help: the templates FAQ says how
to save over one and that call-ups aren't saved. Also removed: the dead `.lineupScrollHintUnder` rule
(the phone hint it styled was removed on purpose; the guard asserts it stays gone).
