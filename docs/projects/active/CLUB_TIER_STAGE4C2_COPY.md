# Club Tier Stage 4c-2: the words (the teams' side)

> Written 2026-10-22 by `/marketing`, before any code (Part 0 of `CLUB_TIER_STAGE4C2_BUILD_PROMPT.md`). **Status: settled by
> `/marketing`; Part A builds from it.** Build from this table, not from the drawings, where they differ. The two rows marked
> **OWNER** (F7, H7, both Part B) wait for a yes, asked when Part B starts. C12 was ruled 2026-10-22. Inventory IDs follow the string inventory (A1 to K11); the drawings are `CLUB_TIER_STAGE4C2_DRAWINGS.html`.
>
> **House rules applied:** sentence case; "8:00 a.m." (no clock time is new in this stage); the bare possessive; sport-neutral
> examples; "installment" is not used; Canadian spellings; one spelling per thing; no "(optional)" tag on the house-league field.
> The only "Optional" tag is the coach's Questions row, which the spec rules and the checklist already uses.
>
> **Conventions for the builder**
> 1. **Apostrophes.** This doc writes straight apostrophes. Type each string with whatever its words file already uses (the editor
>    strings in `lib/public-site-words.ts` are straight; the save pill and `ClubSiteOffNotice` are curly). **In any string that carries
>    a `possessive()` name, every apostrophe in that string is curly**, so one line never mixes the two (the `siteOnHint` precedent).
> 2. **Possessives.** Every `{name}'s` goes through `possessive()`: "15U AAA's tryout page" but "Mustangs' tryout page".
> 3. **Season name.** `{season}` is the season's name with a trailing word "Season" removed (any case), then the word "season"
>    added where the sentence needs it: "2027 Season" gives "the 2027 season"; "Spring" gives "the Spring season". One helper, used
>    by A1, A21 and the tryout meta.
> 4. **Dates.** Short form "Sep 1", full form "September 1" (month names in full only in sentences about the cut-off). A spaced en
>    dash in date ranges ("Sep 1, 2013 – Aug 31, 2015"), an unspaced one in year ranges ("2012–2013"), both ruled.
> 5. **Role words** come from `staffKindWord()` ("Head coach", "Assistant coach", "Team manager"), never typed again.
> 6. **The save pill** is the house pill, reused as is (`SavePill` in `RepKit.tsx`, `SaveStatusPill` in the portal): "Unsaved
>    changes", "Saving…", "Saved" (fades), and only a failure stays: "Couldn't save · Retry", or the held reason with no Retry.
>    This stage invents no save wording.

---

# PART A: the club's side

## A. Admin team page, Team details

The pair of boxes. Empty placeholders read `Year`. The hint under them is **one rule**: line 1 always says what families read;
line 2 ("Leave a box empty...") shows **only while both boxes are empty**. When a held reason shows, it replaces the hint.

| ID | Where | Final text | Note |
|---|---|---|---|
| A1 | Field label | `Birth years for the {season} season` | HR-1: see Flags. "2027 Season" reads "Birth years for the 2027 season". |
| A2 | Box placeholders | `Year` and `Year`, a `–` between | As drawn. |
| A3 | September-style affixes | `Sep 1,` before the first box, `Aug 31,` before the second (the to-date is the day before the cut-off: Oct 1 gives `Sep 30,`) | As drawn. Month abbreviations, the house short form. |
| A4 | Hint, both boxes empty | `Families see no birth years yet. Leave a box empty for no limit on that side.` | **Changed.** Drawn: a fixed `Families see "Born 2012–2013"`, wrong for a September club and a made-up number (HR-2). Typing a year swaps in the real line at once. |
| A5 | Hint, one year (January 1 only) | `Families see "Born 2013".` | Second sentence dropped (the rule above). |
| A6 | Hint, a range | `Families see "Born 2012–2013".` | One rule for every state: sentence 2 only while both boxes are empty. The desk frame that showed both sentences on a filled range is the odd one out. |
| A7 | Hint, no upper limit | `Families see "Born 2012 or later".` | Ruled line. |
| A8 | Hint, no lower limit | `Families see "Born 2008 or earlier".` | Ruled line. |
| A9 | Hint, other cut-off, range | `Families see "Born Sep 1, 2013 – Aug 31, 2015".` | Ruled line. |
| A10 | Hint, other cut-off, to-date only | `Families see "Born before Sep 1, 2014".` | Ruled line. |
| A11 | Hint, other cut-off, from-date only | `Families see "Born on or after Sep 1, 2013".` | Ruled line. |
| A12 | Both empty | No family line anywhere. The hint is A4. | Never "Born —" or "All ages". |
| A13 | Cut-off line, January 1 | `{Sport} birthdays count from January 1.` then the link `Change in Settings` | Link only for a person who can open Settings (owner, admin); otherwise the sentence alone. |
| A14 | Cut-off line, other date | `{Sport} birthdays count from {September 1}.` then `Change in Settings` | Same. |
| A15 | Held, not a four-digit year | `Use a four-digit year, like 2013, to save it.` | As drawn. |
| A16 | Held, in the future | `A birth year can't be after {this year}.` | As drawn. |
| A17 | Held, wrong way round, January 1 | `Put the earlier year first to save it.` | As drawn. |
| A18 | Held, wrong way round or the same year, other cut-off | `{Aug 31, 2013} comes before {Sep 1, 2013}. Make the second year later to save it.` | **Changed.** Spec draft "Put the earlier date first to save it." does not fix the case a cut-off change creates (the same year twice: swapping changes nothing). Names the two real dates, so the admin sees why (HR-6). |
| A19 | Held, no silent swap | No text. | A design note, not product copy. |
| A20 | Save pill | The house pill (Convention 6). Held reasons A15 to A18 and C12(b) use the held slot; no "Saved" while held. | HR-3. |
| A21 | After Start next season | `Moved one year later when the {2028} season started. If this team keeps its players, change it back.` | `{2028}` is the new season written by Convention 3 ("2028 season"). Ruled sentence. |
| A22 | Two seasons open | A1 with the newest season's name. No extra words. | |
| A23 | Add a team window | Unchanged. No birth-year field. | |

## B. House league, Add division and Edit division

Old-look windows keep their look and their Save. Edit is the same.

| ID | Where | Final text | Note |
|---|---|---|---|
| B1 | Field label | `Birth years` | No asterisk, no "(optional)". |
| B2 | Boxes | Two year boxes, placeholders `Year`; the affixes of A3 when the season's sport counts from another date. | |
| B3 | Hint | `Families see "Born 2014–2015" beside this division.` and, only while both boxes are empty, `Leave a box empty for no limit on that side.` then `{Sport} birthdays count from {January 1}.` | HR-5: the third sentence now names the sport and the date, as A13 does. No "Change in Settings" link inside the window (a link would leave an open window with a half-typed name). Both empty: `Families see no birth years for this division.` replaces the first sentence. |
| B4 | Held reasons | A15, A16, A17 or A18, and C12(b), under the boxes; Add division and Save refuse until fixed | Same checks, same words. |
| B5 | Buttons | `Cancel` / `Add division` (Edit: its existing `Save`) | Existing. |
| B6 | Capacity's "(optional)" tag | Untouched. | Reported for the One Window pass. |

## C. Club Settings, the card "When birthdays count from"

| ID | Where | Final text | Note |
|---|---|---|---|
| C1 | Card title | `When birthdays count from` | |
| C2 | Lead | `Teams and house-league divisions show who can play by birth year, counted from this date. Most leagues count from January 1.` | As drawn. |
| C3 | Row label | `{Sport}` | One row per sport the club runs. |
| C4 | Row sub-line | `{n} rep team(s)[, {n} house-league season(s)]. Families see "{example}".` | See plurals below. The example is a real line from the club's own teams of that sport (the first team with years, by name), counted with the saved date. Nothing to show: `{n} rep team(s)[, ...]. No birth years entered yet.` |
| C5 | Row value | Month dropdown (`January` to `December`) and day dropdown (`1` to the last day; February stops at 28) | Accessible names: `{Sport} birthdays count from, month` and `{Sport} birthdays count from, day` (K7). |
| C6 | Ask-once title | `Count {softball} birthdays from {September 1}?` | The sport is lower-cased inside the sentence. For a sport with no natural lower-cased noun (`Other`) the window reads `Count birthdays from {September 1}?` and "Every team and house-league division". |
| C7 | Ask-once body | `Every {softball} team and house-league division shows its birth years from {September 1}, on your site. {13U Softball} will read "Born Sep 1, 2013 – Aug 31, 2015". Nothing is sent to families.` | **Changed.** Drawn: "on your site and in your forms". The spec's "where they show" never puts a birth year in a sign-up form. The example sentence is dropped when no team of that sport has years. When C12 applies, its sentence follows this one. |
| C8 | Ask-once buttons | `Keep {January 1}` · `Change` | HR-7: "Keep" names the date being kept (the current saved date). × and Esc do the same as Keep. Buttons together at the right. |
| C9 | After Change | The house pill: `Saved`; on failure `Couldn't save · Retry` (Retry sends the change again); the dropdown shows the saved date until it lands. | GAP filled. The Settings page's other card keeps its held Save and its `Settings saved.` banner; this card has no Save button, so it uses the pill. |
| C10 | Club with no sport yet | `Your sports show here once you add a rep team or a house-league season.` in place of the rows | GAP filled. |
| C11 | Who | Owner and admin (ruled), as Settings; no read-only text. API refusal: `Only an owner or admin can change when birthdays count from.` | GAP filled. A staff member without Settings access never reaches the card. |
| C12 | **RULED 2026-10-22 (option a).** A cut-off moved away from January 1 while a team or division of that sport covers a single year | See the block below. | New row. |

**Plurals (C4, and wherever a count is spoken):** `1 rep team` / `{n} rep teams`; `1 house-league season` / `{n} house-league seasons`; a zero part is left out of the sentence.

### C12: the same year twice (RULED 2026-10-22, option a)

A team or division whose two years are the same (a one-year team under January 1) cannot be read from another date: "Sep 1, 2013 –
Aug 31, 2013" ends before it starts. Ruled: the ask-once window warns with the count; those teams **show no born line** and **stay in
every Born in list**; Team details and the division window **hold the old years** with the reason under the boxes until the club types
new ones. Nothing is changed or carried over for them.

**(a) In the ask-once window, after C7, only when at least one place is affected.** The owner's words, with the count and the date added.

- One place: `{13U Softball} has one birth year and will show none from {September 1} until you set it again.`
- More than one: `{n} teams have one birth year and will show none from {September 1} until you set them again.` (Divisions count with teams: `{n} teams and divisions`; a mix is `{n} teams and {n} divisions`.)

**(b) The held reason under the boxes on Team details and in the division windows, shown at rest** (the old years stay in the boxes; no "to save it": nothing was typed).

`Families see no birth years for this team yet. From {September 1}, the second year has to be later than the first. Change it to show them.` (Division window: "for this division".) It replaces the hint. It clears when the years are valid or the club moves back to January 1.

**(c) On the public side:** no born line (D5), and the place stays in every Born in list, as a team with no years does.

---

## D. Public, families

### D-a. The born line (ONE function, `lib/born-years.ts`; nothing formats it by hand)

| ID | Shape | January 1 | Another cut-off (September 1 shown) |
|---|---|---|---|
| D1 | Range | `Born 2012–2013` | `Born Sep 1, 2013 – Aug 31, 2015` |
| D2 | One year | `Born 2013` | None. One band is two boxes a year apart and reads as a range: `Born Sep 1, 2013 – Aug 31, 2014`. The same year twice is held (A18, C12). |
| D3 | From only | `Born 2012 or later` | `Born on or after Sep 1, 2013` |
| D4 | To only | `Born 2008 or earlier` | `Born before Sep 1, 2014` |
| D5 | Both empty | Nothing | Nothing |

HR-8 resolved by the D2 cell. In the tryout page meta the same line is lower-cased after the dot ("born 2012–2013",
"born before Sep 1, 2014"), ruled.

### D-b. Where the lines show

| ID | Surface | Final text |
|---|---|---|
| D6 | Teams page, a team's row | The D line beside the chip. A team with no years shows its name only. |
| D7 | Club home, team grid | The D line under the team. |
| D8 | Club Tryouts page, a row | `{D line} · {first day} · {place}` and the chip, e.g. `Born 2017–2018 · Mon, Sep 7 · Lions Park`. No years: the line starts at the day. |
| D9 | Tryout page meta, open or not open yet | `For the {season} season · {born line}` |
| D10 | Tryout page meta, no years | `For the {season} season` |
| D11 | Tryout page meta, finished | `For the {season} season · {born line}` (a closed page names no season, as today) |
| D12 | House league, band and heading | Heading `{division} house league`; sub-line `{D line} · {season}`, e.g. `Born 2015–2016 · 2027 season`; section label `House league` |
| D13 | House league, a division | The D line beside the division. |
| D14 | Unchanged surfaces | No new words. |

### D-c. The Born in picker (Teams and Tryouts pages)

| ID | Where | Final text | Note |
|---|---|---|---|
| D15 | Pill, nothing picked | `Born in: any year` | |
| D16 | Pill, picked | `Born in: 2015` | |
| D17 | Menu options | A single pick-one dropdown pill opening a year list: first option `Any year`, then each year any listed team or division names, newest first (`2016`, `2015`, ...). The pill shows the pick (D15, D16). Menu name: `Born in`. | GAP filled; ruled shape (one pick-one pill). The pill appears only when at least one listed place has birth years (builder to confirm: with none there is nothing to pick). |
| D18 | Meta, a year picked | `{n} places for a player born in {2015}` | Ruled. |
| D19 | Meta, one | `1 place for a player born in {2015}` | GAP filled. |
| D20 | Meta, none | `No places for a player born in {2015}. Pick another year.` (replaces the meta; the list is empty) | GAP filled. Rare: a team with no years, or held at one year (C12), always stays listed. |
| D21 | Tryouts page | The same three sentences as D18 to D20. | GAP filled. "Place" is a team or a division, on both pages. |
| D22 | September club, two rows for one year | No extra sentence. The rows' own dates say which fits. | |
| D23 | Address `?born=2015` | Not customer-visible. | |

### D-d. Family tryout page

| ID | Where | Final text |
|---|---|---|
| D24 | Blurb heading | `From the club`, shown while open and while not open yet; hidden when finished or closed. |
| D25 | Not-open-yet chip and notice | Existing: `Not open yet`; `Sign-ups for {team} tryouts aren't open yet.` |
| D26 | Days | Existing: day, time range, place, `Directions` on every day. |

---

## E. Admin Tryouts page, Sign-ups section

### E-a. The blurb

| ID | Where | Final text | Note |
|---|---|---|---|
| E1 | Label | `From the club` | The name families read. |
| E2 | Placeholder | `What it costs, who can try out, what to bring and when families hear back.` | As drawn. |
| E3 | Counter | `{n} / 500` at the left. No red and no sentence at the limit. | Screen readers get `{n} of 500 characters` (K6). |
| E4 | Hint, sign-ups open | `Families read this on the tryout page, above Sign up for tryouts, before and while sign-ups are open.` | Ruled. |
| E5 | Hint, sign-ups off | Tryout days still to come: `Families read this on the tryout page now, with your tryout days. Sign-ups aren't open yet.` None to come: `Families read this once a tryout day is coming up, and while sign-ups are open. Right now the page doesn't show it.` | **Changed.** HR-9: the drawn sentence says "once tryout days are posted" and the spec says closed pages show nothing, but a not-open-yet page does show it (Ask 9 A, drawing 2b). The page's three states need two honest sentences. |
| E6 | Past-year hint | `Mentions {2025} — still true?` and `Mentions {2024} and {2025} — still true?` | Existing words, amber, never blocks, above the counter. Birth years are skipped (spec). |
| E7 | Door under the empty box | `Start from last season's words` | Only when the previous season had a blurb. |
| E8 | Saved | `Saved` | The house pill. |
| E9 | Failed | `Couldn't save · Retry` | HR-3. |
| E10 | API: over 500 | `The text under From the club can be up to 500 characters.` | GAP filled. Pattern of "The notice can be up to 80 characters." |
| E11 | API: not the live season | `Only the team's current season can be changed.` | GAP filled. |
| E12 | Past-year hint in the site editor's list window | Same words, now amber. | Colour only. |
| E13 | Phone collapsed variant | Not built. | |

### E-b. The club's line about the coach's address (only when a coach address is set)

| ID | Where | Final text | Note |
|---|---|---|---|
| E14 | Desk | Line 1: `Tryout questions on this page go to {coach address}`. Line 2: `Set by {name}, head coach. Your footer and the club's Tryouts page keep {club address}.` Button: `Use the club's address`. | Ruled sentence. |
| E14b | Desk, the club has no address | Line 2: `Set by {name}, head coach. The club has no questions address, so without this one the page shows none.` Button: `Remove this address` | New edge (builder: the window then says "The page will show no address instead"). |
| E15 | Phone | Line 1 as E14; line 2 `Set by {name}, head coach.`; the button under it at 44 px. | Ruled (D1): the footer sentence drops on a phone. |
| E16 | Window title | `Use the club's address on {team}'s tryout page?` | Possessive through `possessive()`; apostrophes in this string curly (HR-10). |
| E17 | Window body | `{Dana Whitfield} set {coach address} for tryout questions. The page will show {club address} instead, and {Dana Whitfield} will see that the club changed it.` | Full name used twice: no first-name guessing. |
| E18 | Window buttons | `Keep it` · `Use the club's address` | Together at the right. |
| E19 | Phone | Both words stay (named exception). | |
| E20 | After the reset | Nothing is sent. The coach's row says so (H10). | |
| E21 | Confirmation / failure | `Tryout questions now go to {club address}.` / `Couldn't change the address. Try again.` | GAP filled; the second is the product's action-failure idiom. |

---

# PART B: the coach's side

## F. Coach, Team settings, Sharing

| ID | Where | Final text | Note |
|---|---|---|---|
| F1 | Door title | `Your team's public page` | |
| F2 | Address | The real public address. | |
| F3 | Buttons | `Copy link` · `Open` (44 px on a phone); site off: only `Copy link`. | |
| F4 | Sentence, schedule is Public | `Anyone with the link sees the team's name, its about text and open tryouts (your club edits those), and your games, because you chose Public.` | **Changed from the ruled line.** It said "the schedule" and "Public link". Two earlier rulings break it: the choice is called **Public** (10-20) and a public page shows **games only**, never practices. The spec's own Sharing row reads "Public". |
| F5 | Site-off notice, moved in | `Your club's public site is turned off, so your team's public page doesn't open for anyone right now. The club's owner turns it back on.` | Existing words, existing curly apostrophes. |
| F6 | Name switch label | `Show my name on the team's public page` | |
| F7 | Name switch hint | `Your name and role only. Families' questions go to the club.` | **OWNER.** Ruled, kept, but untrue on a tryout page once a head coach sets a tryout address (families then write to the coach). HR-11. Proposed: `Your name and role only. Never your email or phone.` |
| F8 | Sentence, schedule is not Public | `Anyone with the link sees the team's name, its about text and open tryouts (your club edits those). Your games stay off it because you chose {Staff only / Families}. Choose Public in Schedule visibility to show them.` | GAP filled. Uses the setting's own labels. |
| F9 | Copied | `Copied` | Existing. |

## G. Public team page, Coaches

| ID | Where | Final text | Note |
|---|---|---|---|
| G1 | Heading | `Coaches` | Ruled. A Team manager who switches the name on appears under it; their role line says so. |
| G2 | Rows | `{Name}` over `{Role}` (`Head coach`, `Assistant coach`, `Team manager`, ...) | Name and role only, from `staffKindWord()`; no section when no one has switched on. |
| G3 | Line after the rows | `Questions about the team? Email the club at {club address}.` | From the Stage 4 team-page frame. Absent when the club has no address. |

## H. Coach, Tryouts, Set up, the row "Questions from families"

Fourth row, tagged `Optional`, not counted in "2 required". **HR-12:** the chip shows while the row is unset (closed, club put back);
once an address is set the status line takes the chip's place, as "Sat, Nov 14 + 2 more" does on the dates row.

| ID | State | Final text |
|---|---|---|
| H1 | Row title | `Questions from families` + chip `Optional` |
| H2 | Closed, nothing set | `They go to the club ({club address}). Add your own address for this team's tryout page.` |
| H2b | Closed, the club has no address | `The page shows no questions address yet. Add your own for this team's tryout page.` |
| H3 | Open, empty | Label `Address for tryout questions`; placeholder `tryouts@yourclub.ca`; hint `Shown on your team's tryout page, where anyone can read it. Use an inbox you're happy to share, not the one you sign in with. It comes off when you stop being head coach.` |
| H4 | Open, filled (you set it) | Status `{address} · on your tryout page`; field as H3; door `Remove and use the club's address` |
| H5 | Refused, your sign-in address | `That's the address you sign in with. Use a separate one, so your sign-in stays private.` |
| H6 | Refused, not an address | `That doesn't look like an email address.` |
| H7 | Accepted with the nudge | `A role address such as tryouts@ keeps working when a volunteer changes. You can use this one if you prefer.` Shown **under** the hint, quiet, never red. |
| H8 | Another head coach set it (you are a head coach) | Status `{address} · set by {name}`; field editable; line `Any head coach can change or remove it. If you change it, it becomes yours and ends when your role does.` |
| H9 | Assistant with tryouts access | Status `{address} · set by {name}`; no field, no remove; line `Only a head coach can change it.` |
| H10 | The club put its own back | `The club put its own address back on {Oct 22}. Questions go to {club address}. You can set your own again.` (chip `Optional`; the year shows when it is not this year) |
| H11 | Loading | The field stays disabled and the row reads `Loading the address…` |
| H12 | Save failed | The house pill: `Couldn't save · Retry`. The page keeps what it showed. |
| H13 | Remove | No confirm. |
| H14 | API, not a head coach | `Only a head coach can set the tryout address.` |
| H15 | Another assistant | Row absent. |
| H16 | Variants B / C | Not built. |

**OWNER (small):** H7. The drawing put the nudge *in place of* the hint. That drops "anyone can read it" and "it comes off when you stop being head coach" at the one moment a coach has typed something. I kept the hint and added the nudge beneath it. A layout call.

## I. Family tryout page, the questions line

| ID | State | Final text |
|---|---|---|
| I1 | Open, coach address, name switch off | `Questions about these tryouts? Email the head coach` + address + Copy |
| I2 | Open, coach address, name switch on | `Questions about these tryouts? Email {Name}, head coach` + address + Copy |
| I3 | Not open yet, coach address | The same as I1 / I2. (HR-14: the spec wording wins over the drawing's shorter one.) |
| I4 | Open, no coach address | Existing `Questions? Email the club at {club address}` + Copy |
| I5 | Finished or closed | `Questions? Email the club` + address + Copy; never the coach's |
| I6 | Footer | Existing; the club's address, always. |
| I7 | Copy button | Desk: symbol + `Copy`; phone: the bare symbol in a 44 px box. Accessible names: the coach's line `Copy the head coach's email address` (name on: `Copy {Name's} email address`); the club's `Copy the club's email address`. |
| I8 | After Copy | `Copied` |
| I9 | Directions | Existing; on every day. |
| I10 | Sign-up form's closed message | Unchanged: `Questions? Contact us`. |
| I11 | Share card, JSON-LD, link preview | Never carries the coach's address. No words. |

I7 changes the ruled accessible name (`Copy email address`): two identical buttons on one page are indistinguishable to a screen reader.

## J. The setup line

| ID | Where | Final text |
|---|---|---|
| J1 | Under the sessions, site on | `Anyone can see these days on your team's tryout page, even before sign-ups open.` |
| J2 | Sign-ups open | `Anyone can see these days on your team's tryout page.` |
| J3 | Site off | No line. |
| J4 | "Tryout dates" row, empty | `No sessions yet. Once added, they show on your schedule and on your team's tryout page.` |
| J5 | Row chip | `Required` (existing) |

## K. Accessible names, API messages, process

| ID | Where | Final text |
|---|---|---|
| K1 | Copy symbol | See I7. |
| K2 | Directions | `Directions` (existing) |
| K3 | Admin phone icons | `Add applicant`, `Copy link` (existing) |
| K4 | Window close | `Close` (existing) |
| K5 | Year boxes | January 1: `Earliest birth year` and `Latest birth year`. Other cut-off: `Earliest birth year, counted from {Sep 1}` and `Latest birth year, up to {Aug 31}`. |
| K6 | Blurb | Named by its label `From the club`; the counter is read as `{n} of 500 characters`, polite. |
| K7 | Cut-off dropdowns | See C5. |
| K8 | API refusals | Years: A15, A16, A17 or A18. Blurb: E10, E11. Cut-off: `Pick a month and day from the lists.` Unknown sport: `That isn't a sport your club runs.` Tryout address: H5, H6, H14. Reset with none set: `No coach address is set on this page.` Not owner/admin: C11. Anything else: `Couldn't save your changes. Try again.` (existing) |
| K9 | Name switch | The portal's pill: `Saved` / `Couldn't save · Retry`. Refusal for another person's switch: `You can only change your own setting.` |
| K10 | Names and addresses in the drawings | Sample data, not copy. |
| K11 | Help articles | `/docs` owes Team details, house-league divisions, Settings, the admin Tryouts page, the coach's Sharing and tryout setup, and the public-site articles (keywords and `searchText` too: one spelling). |

---

## Flags resolved

- **HR-1 Season name vs year.** One helper (Convention 3); A1, A21 and the tryout meta all call it. A season named "Spring" reads "the Spring season".
- **HR-2 Hard-coded example.** Dropped. The empty hint says what families see (nothing yet); once a year is typed the real line, computed from the club's cut-off, replaces it. The Settings card (C4) shows a computed example from the club's own teams.
- **HR-3 Two "save failed" wordings.** The house pill is `Couldn't save · Retry`, in the admin kit (`SavePill`) and the portal (`SaveStatusPill`) alike. "Couldn't save your changes. Try again." stays only where it is today: a message line, not the pill (the Public site editor, API fallbacks). Nothing in 4c-2 invents a third.
- **HR-4 Plurals.** Settled under C4 and D17 to D21.
- **HR-5 The cut-off sentence.** One sentence, `{Sport} birthdays count from {date}.`, on Team details and in the division windows; only Team details carries the Settings link.
- **HR-6 Two near-twin held sentences.** The year sentence (A17) for January 1; a dates sentence (A18) for any other cut-off, naming the two real dates.
- **HR-7 "Keep January 1" literal.** `Keep {saved date}`. The window title and body carry the new date.
- **HR-8 Missing one-year shape.** None exists off January 1; D2 explains it.
- **HR-9 Closed-state blurb hint.** Two off-states, because the page has three: E5.
- **HR-10 Possessive of a team name.** E16 through `possessive()`, curly throughout the string; the same for any name added.
- **HR-11 Sharing sentences.** F4 corrected (Public, games only). F7 **kept as ruled and flagged to the owner**, with a proposal.
- **HR-12 "Optional" tag.** Kept (ruled; the checklist already tags "Helpers who score"). The chip yields to the status line once set.
- **HR-13 The explanatory line.** Real product copy, rewritten per audience (H8 for a head coach, H9 for an assistant).
- **HR-14 Two lines for one thing.** The spec wording on every state with a coach address (I1 to I3). A parent seeing the coach's line under the button and the club's in the footer is ruled; the words say which is which.

## For the builder, not words

- The spec's date rule says the to-date is "the day before M/D in that year (Jan 1 gives Dec 31...)". Read literally, January 1, 2013 minus a day is Dec 31, **2012**. The ruled family lines need Dec 31 of the *typed* year for January 1 ("2012–2013" is Jan 1, 2012 to Dec 31, 2013) and the day before the cut-off in the typed year for any other date ("Sep 1, 2013 – Aug 31, 2015"). Pin both in the rule's tests.
