# Second opinion: FieldLogicHQ's wordmark, tab mark and home-screen icon

> **Written 2026-10-23 for Codex** (or any second reviewer). The owner asked for an independent look. A Claude session drew three
> directions, and the owner finds that **none of them sells it**. This affects the whole brand. Your job is fresh guidance, not
> a review of Claude's pick. Nothing is built and nothing you do here should change product code or icon files.

## The files

- `docs/projects/active/PUBLIC_FACE_WARM_W_DRAWINGS_STANDALONE.html` is Claude's drawing page. Open it in a browser. Most of it is
  drawn by the script at the bottom: the `G` object holds each mark's geometry on a 64-unit grid, and `places()` draws every
  surface. Its tabs are: today's marks, directions A (the tag), B (the pennant) and C (the clipboard), a side-by-side, what
  changes when it ships, and the asks.
- **Look at "Today" first, then form your own view before you read Claude's recommendation (B).** The three directions are one
  data point, not the brief.

## What FieldLogicHQ is, and the bar

- A platform for the people who run **community sport**: volunteer coaches, club and league executives, tournament organizers,
  and the families who follow them. It serves many sports and four kinds of customer: team, league, tournament and club.
- **The bar, owner's words:** on day one a volunteer, coach or organizer feels it was made to run their league or team, **not a
  terminal**. Most users are not technical.
- **Brand voice:** "Practical. Direct. Warm. Like the most organized person on the volunteer board." Positioning is "community
  sport". The headline is "Less admin. More sport."

## Settled. Do not reopen these.

- The name is spelled **FieldLogicHQ**. Its casing in a wordmark is a design choice.
- **The public face is warm.** Marketing pages are always warm. Signed-out pages are warm. Signed-in users may choose Dark.
- **The palette:** paper `#F8F4ED`, card `#FFFFFF`, ink `#241E15`, soft ink `#4A4235`, dim `#615A54`, olive `#57651E`.
  **Lime `#D9F99D` is a fill, never text on paper.** In Dark the ground is `#0A0A0A` and lime is the accent.
- **One lime per view on marketing pages.** A mark in the bar therefore cannot add a second lime.
- **Faces:** Barlow Condensed 700 for headlines, Inter for text. The typewriter face (IBM Plex Mono) is what reads as a terminal,
  so it is leaving the wordmark. **Google Fonts only**: no self-hosted or paid font. An outlined SVG wordmark needs no font.
- **Sport-neutral:** no ball, stick, net, field markings or any symbol of one sport.
- **Never claim Canadian identity:** no maple leaf, and no "Canadian" in an identity piece.
- The bars' layout is settled. Only the mark inside them changes.

## Open. Argue these on merit.

- What the mark is: symbol, monogram, letterform, wordmark-only, or something else.
- Whether today's ">" survives in any form. It is a command-line prompt.
- **Whether lime stays the brand's signature colour.** It came from the old dark, terminal look.
- The wordmark's face, weight, casing and inks.

## Where a mark must work

A mark that fails any of these fails:

- **The browser tab** at 16 and 32 px, on light and dark browser chrome.
- **The phone home screen** at 192 and 512 px:
  - Android's maskable safe zone: the mark sits inside the centre 80% circle.
  - An iPhone icon is a full square, because iOS paints transparent corners black.
- **The notification badge:** 72 px, a white silhouette that Android tints.
- **The bars:** the marketing bar and footer (warm), the account bar and the admin and coach top strips (warm and Dark).
- **Email:** it cannot load web fonts, and Outlook on Windows blocks images until the reader allows them.
- **The share card:** 1200 × 630.
- **Small and one colour:** black on a club's printed schedule, white on a club's colour, about 11 px.

## Facts from the code that change the problem

- **Today there are four marks that don't match:**
  - the typewriter wordmark;
  - the ">" in every browser tab and the admin and coach strips;
  - the same ">" as the notification badge;
  - an "F over L" monogram on the phone home screen. Its rule strikes through the L, and its "HQ" is navy on black, so it can't
    be seen.
- **The "FL" icon reaches further than the home screen.** It is also the large picture on push notifications and the mark printed
  on every export (schedules, money reports, PDFs). The new mark replaces it in all of those.
- **The name is written about ten different ways** across the product. The fix includes making it one shared piece.
- **The product's chat uses a flag icon for "Report".** This matters if any direction uses a flag.
- **Clubs and teams have their own crests and colours,** and an organization's brand wins on its own pages. Tournament pages
  already install to a phone with the organizer's logo. Our mark is the platform behind them, not their badge.

## What Claude's three directions have in common

Each one puts a symbol on a dark tile next to a two-ink wordmark. That is a narrow range. These areas were not explored:

- a monogram drawn properly;
- a wordmark-led identity with one distinctive letterform, such as the "F", the "L" or the "Q";
- a mark from the name's own meaning: a field divided, or logic as an ordered grid or schedule;
- the crest or badge form that community clubs already speak in. Weigh this against the clubs' own crests.
- a colour-led identity in which olive leads, not lime.

Explore these only if they earn it, and add your own.

## What to return

1. **A critique of the problem and of the three drawn directions.** Say plainly if the question is framed wrong. For example: is
   a symbol the right answer at all, or should lime go?
2. **Four to six directions of your own.** Each must differ in idea, not tint. For each, give:
   - the idea in one line;
   - the geometry, precisely enough to draw (a 64-unit grid is fine);
   - the colours from the palette above;
   - the wordmark: face, weight, casing and inks;
   - how it behaves in each of the places listed above, including the 16 px tab, the badge silhouette and email;
   - what it keeps from today and what it drops;
   - the risk.
3. **A ranking and a recommendation,** argued from the bar and the rules above, not from taste.
4. **The questions you would put to the owner.**
5. **If you can, draw your directions** as a standalone HTML page in the same places at true size. Save it as
   `docs/projects/active/PUBLIC_FACE_WARM_W_CODEX_DRAWINGS.html`. Save your written answer as
   `docs/projects/active/PUBLIC_FACE_WARM_W_CODEX_OPINION.md`.

Do not edit any other file. Do not change icon files, product code, the drawing page or the plan.
