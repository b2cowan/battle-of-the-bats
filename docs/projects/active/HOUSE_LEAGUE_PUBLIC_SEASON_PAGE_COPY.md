# House league public season page: the words (`/marketing`, 2026-11-04)

> **Status: ACCEPTED** (owner 2026-11-04: W1–W7 all as recommended; proposed earlier the same day). Ruling: `HOUSE_LEAGUE_STAGE9_PLAN.md` §0k (P1 to P5, all as recommended). Drawing:
> https://claude.ai/artifact/VpHxm3YFtkfjPeYrT3bPJK (source `HOUSE_LEAGUE_PUBLIC_SEASON_PAGE_DRAWINGS.html`, `.club` frames in tabs 2 to 4).
> Reader: a parent on a phone, finding the club's season page by search or an old bookmark. Brand-voice memory read (69 days old; only
> the voice rules are used, no plan names appear). **Not reopened:** "This season has concluded." · "Final standings" / "Standings" ·
> "Ended {date}" · "Playing now" · "Registration closed" · "Email me my link" with "Already signed up?" · "Schedule" · "Register now" · the
> chips "Opens {day}", "Registration open", "Closed {day}", "Starts {day}" (`lib/league-registration-state.ts:97-106`,
> `lib/house-league-season.ts:172-182`). House league has no champion: nothing here says winner or champion.

## 0. Conventions

- Dates go through `formatStoredDate` (`lib/timezone.ts:582-591`): `longMonth` gives "October 25, 2026", `withYear: false` drops the year.
  No clock times appear, so `formatTime()` is not needed.
- "sign-up" is hyphenated everywhere a family reads it ("Already signed up?", `club-site-sections.ts:134,157`). "Sign-ups" stays; never "signups".
- "house league" is lowercase in prose; "House league" is the tab and page title (`club-site-sections.ts:122`, `league/page.tsx:58`).
- The arrow is a trailing "→" inside the link text ("Standings →", `[seasonSlug]/page.tsx:264`; "See the full schedule →",
  `lib/league-schedule-words.ts:165`).

## 1. The line under the title

Today there is no such line: a "Season dates" band over "May 2, 2026 — October 25, 2026" (`[seasonSlug]/page.tsx:125-132`), a missing
end shows "—" (`:33`), and "This season has concluded." sits in a grey box (`:242-254`). The Registration and Price bands go (ruled P1).

| Key | Today | Proposed | Why |
|---|---|---|---|
| `line.fin` | grey box "This season has concluded." (`:253`) + band "May 2, 2026 — October 25, 2026" (`:129`) | **This season has concluded. It ran May 2 to October 25, 2026.** | Drawn (drawings line 292). Two short sentences; "concluded" is the settled word, "ran" is plain past tense. |
| `line.closed` | grey box "Registration closed." / band (`:251`) | **Runs May 2 to October 25, 2026.** | Drawn. The chip already says "Registration closed", so the line carries only the dates. |
| `line.playing` | grey box "This season is currently active. Registration is closed." (`:252`) | **Runs May 2 to October 25, 2026.** | Same as above. The chip says "Playing now". The retired "currently active" sentence goes with the box. |
| `line.ended` | the same grey box (`:252`) | **Ran May 2 to October 25, 2026.** | Drawn. Past tense for a season past its last day that the club has not completed. |
| `line.fmt` | long month both ends, em dash, year on each (`:32-35`, `:129`) | long month, **"to"** between, **year once at the end** when both days share a year; each day keeps its own year across a new year ("Runs October 25, 2026 to March 14, 2027.") | A sentence reads better than a range with a dash, and "to" is the plain word. The chip beside it keeps its short "Oct 25" (settled), so the page shows "Ended Oct 25" and "Ran May 2 to October 25, 2026." together; short in a tag, long in a sentence. |
| `line.start` | "—" for a missing day (`:33`) | start day only: **Starts May 2, 2026.** (day not yet reached) / **Started May 2, 2026.** (reached) | See W2. |
| `line.end` | "—" (`:33`) | end day only: **Runs until October 25, 2026.** (playing) · finished: **It ended October 25, 2026.** after the concluded sentence · ended-not-completed: no line | The chip already says "Ended Oct 25", so repeating the day adds nothing. |
| `line.none` | band absent when both dates are empty (`:125`) | finished: **This season has concluded.** alone · every other state: no line | No filler such as "dates to come". |
| `line.one` | n/a | start and end are the same day: **Runs May 2, 2026.** (**Ran** when past) | A one-day season would otherwise read "May 2 to May 2". |

"Runs" or "Ran" follows the end day against the club's today, not the status alone: a season stuck on "Registration closed" after its
last day reads "Ran". A finished season always reads "It ran".

## 2. Each age group's card

Drawn at drawings lines 296-307. First place is highlighted (as `column.standLead`, `standings/page.tsx:195`); the table is the standings
page's own, cut to three rows.

| Key | Today | Proposed | Why |
|---|---|---|---|
| `card.title` | n/a (the page lists no table; the Divisions tiles carry the name, `[seasonSlug]/page.tsx:177`) | the **division name** as stored (U9, U11) | Same word as the standings page's tabs (`standings/page.tsx:89`). |
| `card.link` | n/a (a "Final standings →" button, `:264`) | **Full table →** | Drawn. Goes to that age group on the standings page (`?d=`, `standings/page.tsx:86`). Name for assistive tech: W4. |
| `card.col.rank` | `#` (`lib/league-standings.ts:197`) | **#** | Reuse `STANDINGS_WORDS.col`. A shared place reads **T-2**, tooltip "Tied for 2nd" (`:204-206`). |
| `card.col.team` | `Team` (`:197`) | **Team** | Reuse. |
| `card.col.record` | `W-L-T`, tooltip "Wins-losses-ties" (`:197,199`; phone column `standings/page.tsx:123,131`) | **W-L-T** | Reuse. Not sport-specific: only For/Against/Differential come from the sport pack (`standingsLabels`, `:90-100`), and the card leaves those out. |
| `card.col.pts` | `Pts`, tooltip "Points" (`:197,199`) | **Pts** | Reuse. |
| `card.cell.none` | a team with no counted game reads "–" with a screen-reader "No games scored yet" (`:201,207`; `standings/page.tsx:203-204`) | unchanged | A team still waiting for its first game, inside a division that has scored games. |
| `card.foot` | n/a | **3 more teams** · **1 more team** · nothing when the age group has three teams or fewer | Drawn. Counts the rows not shown. Build it as `{n} more team` / `{n} more teams`; `pluralize` (`lib/utils.ts:9`) prints the count first, so "more" cannot go between with it. |
| `card.tie` | n/a | the three rows are the first three in table order; a team level for third that falls to row four is counted in the foot | The Full table link shows every team. No extra words. |

## 3. A division with standings on and no scored game yet

Today the standings page shows the teams A to Z with dashes and "Standings start with the first score. Teams are in alphabetical order
until then." (`lib/league-standings.ts:225`; `standings/page.tsx:166-167`), and "Standings show here once the schedule is up and the
first scores are in." for an unpublished division (`:224`). The coach page already has the short sentence "Standings start with the
first score." (`:259`).

| Key | Today | Proposed | Why |
|---|---|---|---|
| `card.empty` | n/a | the card keeps its heading and says **Standings start with the first score.** No table, no Full table link | Reuses `STANDINGS_WORDS.coach.none` (`:259`), word for word. It is the short form of the standings page's sentence without the alphabetical clause, which a family has no use for here. Only shows while another age group on the page has a table (see W5). |
| `card.none.all` | n/a | no age group has a scored game: **the whole band is absent**, Schedule is the only button | Ruled in §0k ("no table before the first game"). No words. |
| `card.unlisted` | an unpublished division is a "· coming" tab (`standings/page.tsx:89`) | an age group with standings off, or whose schedule is not published, is **not listed**; no words | Ruled for "standings off" (§0k); the unpublished case follows the standings page's own rule (9e·4, `standings/page.tsx:31-38`). |

## 4. The next-season card

The club kit's door card (`ClubKit.module.css:255-271`; `kit.door`, `kit.doorTitle`), above the title (ruled P3). It means every newer
season at this club that `takesSignups` today (`lib/league-registration-state.ts:59`). A season that only opens later does not count.

**What the second line really says.** `publicRegistrationLine` (`:109-117`) never writes the drawing's "Sign-ups close Sunday,
September 13." For a season taking sign-ups it returns **"Registration closes Sep 13."** (short month; "Registration closes Jan 9, 2027."
when the year is not this year; `clubDay`, `:77-80`), or **null** when the club set no close day. Under the heading "Fall 2026 · Registration open" it
reads right: the heading names the season, so the sentence needs no name of its own. It repeats the word "Registration" but gives the one fact the heading lacks.

| Key | Today | Proposed | Why |
|---|---|---|---|
| `next.head.one` | n/a | **{Fall 2026} · Registration open** | Drawn. The name, then the settled chip words. |
| `next.line.one` | n/a | the season's `publicRegistrationLine`: **Registration closes Sep 13.** · no line when it returns null | One sentence, one spelling, as the season's own page shows it (`[seasonSlug]/page.tsx:236`). See W3. |
| `next.btn.one` | n/a | **See Fall 2026 →** | Drawn. Goes to that season's page, so the family meets the price and age groups before the form. |
| `next.head.many` | n/a | **Taking sign-ups now** | Drawn; "sign-ups" is the ruling's word (§0k). |
| `next.line.many` | n/a | the names, newest first, joined with " · ": **Fall 2026 · Winter Skills 2027** | Drawn. Past three names: W6. |
| `next.btn.many` | n/a | **See the house league →** | Drawn. Goes to the club's House league page, where each season sits under "Running now" (`league/page.tsx:64`) with its own Register button. The page and the tab are both "House league"; prose is lowercase. |
| `next.region` | n/a | region label **Taking sign-ups at this club** | One string for one and many (W7). |

## 5. Accessible names

| Key | Proposed | Why |
|---|---|---|
| `a11y.link` | the link reads **Full table** on screen and carries a hidden **for U11** after it (a `kit.srOnly` span, `standings/page.tsx:204`), so a screen reader says "Full table for U11"; the arrow is `aria-hidden` | W4. The drawn visible text is "Full table →". |
| `a11y.table` | each card's table is named by the card heading (`aria-labelledby`), so a reader hears "U11" | No new string. |
| `a11y.region` | the card is an `aside` with `aria-label` "Taking sign-ups at this club"; its heading is a paragraph, not a heading element | The card sits above the title, so a heading element would come before the page's h1. W7. |

## 6. Words that must not appear

"Champion", "champions", "winner", "winners" (house league has none) · "Final" on any season the club has not completed (also "Final
table", "Final results") · "Season active", "Season complete", "Archived", "has been archived", "currently active" · "Next season",
"Coming up", "Check back later", "Check back soon" (nothing links one season to the next, and the card shows a newer season only
while it is open) · "Hurry", "Last chance", "Don't miss", "Limited spots", "Spots left" · "Leaderboard", "Rankings", "Top 3", "Top
three" · "signups", "sign ups" · a weekday in the registration line (the code does not produce one) · exclamation marks · "unlock",
"powerful", "seamless", "robust" · "Sign up now" as a second Register button (the button is "Register now", open seasons only).
"Spots filled", the price and the registration dates are gone from every closed state (ruled P1) and must not return.

## 7. Index of new customer-readable strings

| String | Surface | Reader |
|---|---|---|
| This season has concluded. It ran {May 2} to {October 25, 2026}. | line under the title, finished | families |
| Runs {…}. · Ran {…}. · Starts {…}. · Started {…}. · Runs until {…}. · It ended {…}. | line under the title, other states | families |
| {Division name} · Full table → | each age group card | families |
| {n} more team(s) | each card with more than three teams | families |
| Standings start with the first score. | a card whose division has no scored game (existing string) | families |
| {Season} · Registration open · {Registration closes Sep 13.} · See {Season} → | next-season card, one season | families |
| Taking sign-ups now · {A} · {B} · See the house league → | next-season card, two or more | families |
| hidden "for {division}" · "Taking sign-ups at this club" | screen readers | families using assistive tech |

## 8. Open questions

- **W1. Date format in the line.** Long month both ends, "to", year once ("May 2 to October 25, 2026"), as drawn. Recommend yes, and a
  year on each day only across a new year. The short "Oct 25" stays in the chip.
- **W2. One date missing.** Recommend the §1 table: start only reads "Starts" or "Started", end only reads "Runs until" (playing) or
  "It ended" (finished), and an ended-not-completed season with only an end day shows no line because the chip says it. Neither date:
  only the finished sentence shows.
- **W3. The next-season card's second line.** Recommend reusing `publicRegistrationLine` as it is ("Registration closes Sep 13."), not
  the drawn "Sign-ups close Sunday, September 13.", which would need a second date formatter and a second sentence for one fact. Cost: the date is
  short-month with no weekday. No close day means no line.
- **W4. Name of the "Full table" link.** Recommend visible "Full table →" plus hidden "for U11". "Full U11 table" would drop the
  visible words from the accessible name (a voice-control user saying "click Full table" would miss it).
- **W5. Mixed state: some age groups have scores, one has not.** Recommend the card stays with "Standings start with the first score."
  and no link, so a family's age group is not silently missing. A division with standings off or an unpublished schedule is not listed.
- **W6. Three or more seasons taking sign-ups.** Recommend naming up to three, then "· {n} more" ("Fall 2026 · Winter Skills 2027 ·
  Spring Skills 2027 · 2 more"), so the line cannot run to five lines on a phone.
- **W7. The card's region and its heading.** Recommend `aside` labelled "Taking sign-ups at this club", heading as a paragraph because
  the card sits above the h1. The heading wording stays as drawn.
