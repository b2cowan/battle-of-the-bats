# House league Stage 9f: the words (`/marketing`, 2026-11-03)

> **Status: ACCEPTED by the owner 2026-11-04, every open question as recommended** ("go with your recommendations"). Section 15 records
> each answer; the proposed strings and both word lists (sections 14 and 14.1) are the final words, with no option left open. One
> wording was set by the coordinator on acceptance: "That stays on its Money tab." Copy for the two 9f builds: **9f-1 Finished, honestly** (Archive retired, the word
> "Final", the coach's final place, the Reopen and Complete lines, the free League plan's limit) and **9f-2 Start next season**
> ("Start from" in the existing Create season window, the rare door, the marks on the new season). Source: the drawings
> (`HOUSE_LEAGUE_STAGE9F_DRAWINGS.html`, https://claude.ai/artifact/UN6Su7DsmAU8tcLyAu1d4Z) and the owner's rulings 9f·1 to 9f·17
> in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0j (ruled 2026-11-04). **None is reopened.** Every drawn word is kept unless a house rule, a
> ruling or the code breaks it; each change says why in its row and is gathered in section 13.
>
> Also read: `HOUSE_LEAGUE_STAGE9A_COPY.md` (§2 pill labels, §4 status windows, §8 public labels), `HOUSE_LEAGUE_STAGE9E_COPY.md`
> (format and house voice), the shipped code (`lib/house-league-status-words.ts`, `lib/house-league-season.ts`,
> `lib/free-floor.ts`, `components/admin/kit/club/CreateLeagueSeasonDialog.tsx`, `app/[orgSlug]/league/[seasonSlug]/page.tsx`,
> `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx`, `lib/league-standings.ts`), the `BUSINESS_DECISIONS.md` entry
> "House League 9f·5" (lines 35 to 55) and `scripts/check-spelling-consistency.mjs`. The brand-voice memory file
> (`marketing_brand_voice.md`) exists and was read; it is 69 days old, so plan names were taken from the code and the Facts doc, not
> from it.
>
> **No plan-gate, upgrade or price wording for Start next season.** 9f·16 (does Start from ride a plan?) is `Proposed`, not ruled
> (`BUSINESS_DECISIONS.md` 2026-11-04), so 9f-2 strings name no plan. The one plan name that appears is in 9f·5's refusal, where the
> existing free League plan wording already names "League" and "League Plus".

## 0. Conventions

**Voice.** A volunteer admin on a weeknight: say what changes, once, in the order they would ask. No sales voice, no "unlock",
"powerful", "seamless". Sentence case everywhere. No exclamation marks, no stage names, no "coming soon".

**House rules applied (and how the build gate sees them).**
- **Dates** through `formatStoredDate`: "Aug 28" in this year, "Aug 28, 2027" in another year on chips and rows (`dayLabel` in
  `lib/house-league-season.ts:87`); the status windows pass `withYear: false` for "Ended {date}" (`house-league-status-words.ts:209`). I
  followed both, each where it already lives. No clock times appear in these strings; if one is ever added it goes through
  `formatTime()` ("8:00 a.m.").
- **A name ending in s** takes `possessive()` ("Twins’", "Draft Test 2027’s"). Apostrophes are curly.
- **Numbers** are numerals, pluralised with `pluralize` ("1 age group", "4 age groups", "1 team", "22 teams").
- **"house league"** is lowercase in prose (`House League` is build-gated); the dialog's existing title keeps its hyphen as an
  adjective ("Create a house-league season"). The free plan is "your free League plan" and the paid one "League Plus", exactly as
  `lib/free-floor.ts` and the Facts doc name them. Never "League Starter".
- **Spelling gate** (`check-spelling-consistency.mjs`): nothing here trips the clock, "financial year", `Canceled`, `House League`,
  `Public Site`, `Rep Teams` or the other cased-name rules. "colours" is the house spelling and is used. "installment" does not
  appear.

**Words that mean one thing (checked against the shipped UI).**

| Thing | Words | Never | Evidence |
|---|---|---|---|
| A season that is over | **Finished** (the state, pill, switcher); the act is **Complete** (button, window); the shelf is **Past seasons** | "Archived", "Completed" as a state | `house-league-season.ts:116`, `house-league-status-words.ts:171` |
| A season under way | the pill word is **Playing now**; the group is **Running now**; the Reopen window says "Running" | a fourth word | `house-league-season.ts:104-123`, 9a copy §2, §8 |
| A running season past its last day | admin and public both **Ended {date}** | "Final standings" for it | `house-league-season.ts:121`; public changes in this file |
| Where the table is read | **Standings** (live or ended); **Final standings** only once the club completes the season | "Final" on a calendar | rulings 9f·3 |
| The 1 to 5 draft number | **rating** | "score" | 9e copy §0 |
| Age-group birth years | **birth years** in prose, **Born 2018–2019** as the family-facing line | "born years" in a sentence | `lib/born-years.ts:124-127`, `birthday-cutoff.ts:106` |
| Time the club gives house league | **the club’s time** (from the club’s Schedules); the existing sentence is "The club hasn’t given house league any time yet." | "club time" as a screen word | `lib/league-time.ts:523,529`, 9e copy `rain.prac.club` |
| What came across | **From {season}** (a mark); **Started from {season}** (the line) | "copied", "cloned", "imported" | the drawings, s16 |
| Families counted | **families** | "households" | 9e copy §13.1 |

---

# Part A · 9f-1: Finished, honestly

## 1. The Complete window (admin)

Where: opened from the rare door "Complete the season…" on a running season; league runners only. Desk title "Complete {season}?",
phone "Complete the season?". Kept as built except one line (9f·7, ratings are erased by 9c·2b and no window says so today).

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `cx.ratings` | (absent) | **Player ratings are erased.** | NEW. Ruling 9f·7. Sits after "Your public site lists it under Past seasons, and its schedule and standings stay up." and before "Families are not emailed." so the last line stays the same in every window. Plain verb, no "permanently", no warning colour: it is a fact about the change, like its neighbours. |
| `cx.rest` | "Money stays open: you can still mark fees received." (`house-league-status-words.ts:175`) | **Money stays open: you can still mark fees received and record refunds.** | Ruled (Q1). The drawing's "after" frame has it and the lock line already says refunds (`house-league-money-words.ts:90`), so the window was one clause behind. |

The other lines (`lead`, the four changes, the loose-end warning, the foot "You can reopen it from Past seasons.", the buttons)
are unchanged.

## 2. The Reopen window (admin)

Where: "Reopen the season…" at the end of a finished season's Overview, and from Past seasons; league runners only. Desk title
"Reopen {season}?", phone "Reopen the season?". Rulings 9f·3 and 9f·7.

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `ro.lead` | "The season comes back to Running now. What changes:" (`:204`) | unchanged | "Running" is the window's word since 9a and the home's group word; left as is, with no third use added (ruled, Q5). |
| `ro.edit` | "Registrations, teams and the schedule can be changed again." (`:206`) | unchanged | |
| `ro.public.ended` | Two lines: "Your public site lists it as Playing now, or as Final standings if its dates have passed." and "If its end date has passed it reads "Ended {date}", so you can complete it again." (`:207-209`) | **Your public site lists it as Ended {Aug 28} until you complete it again.** (used when the season’s last day has passed) | Ruling 9f·3: a running season past its end is "Ended", never "Final". The two old lines said the same thing twice and one of them said the retired word. The window knows the dates, so it says the one true sentence. |
| `ro.public.playing` | (same two lines) | **Your public site lists it as Playing now.** (used when the last day has not passed, or there is no last day) | The other half of the old "or". Same sentence shape, so only one of the two ever shows. |
| `ro.ratings` | (absent) | **Player ratings were erased when it finished. They don’t come back.** | NEW. Ruling 9f·7. Past tense because it already happened at Complete; "They don’t come back" is the thing a reopener would otherwise expect. |
| `ro.newer.one` | (absent) | **{Draft Test 2028} is not changed.** | NEW. Ruling 9f·7 ("names a newer season as not changed"). "is not changed" matches the neighbouring lines ("Families are not emailed."). |
| `ro.newer.two` | (absent) | **{Draft Test 2028} and {Fall Ball 2028} are not changed.** | NEW, my plural. The ruling covers one newer season; two or more must not break the sentence. |
| `ro.newer.many` | (absent) | **Your {3} newer seasons are not changed.** | NEW, my plural, for three or more (a list of names would run long on a phone sheet). |
| `ro.notEmailed` | "Families are not emailed." | unchanged | Stays last. |
| `ro.foot` | "You can complete it again at any time." | unchanged | |

Which seasons count as "newer": any season of the club that started after this one (build decision; the words do not depend on it).

## 3. Archive is retired (9f·4)

Archive was a label with no job. What disappears, and what a reader sees instead. "Finished" is already what the admin pill, the
switcher and the shelf say for an archived season (`house-league-season.ts:116`), so no new word enters.

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `arc.door` | "Finished and settled? **Archive the season…**" (`house-league-status-words.ts:228`; the rare door on a finished season) | **Removed.** The finished Overview’s rare doors become "Running it again? Start next season from this one…" (9f-2) and "Need to change something? Reopen the season…" | A finished season is "Finished", full stop (9f·4). Until 9f-2 ships, the only rare door on a finished season is Reopen. |
| `arc.win.title` | "Archive {season}?" / phone "Archive the season?" (`:188`) | **Removed** | The window goes. |
| `arc.win.body` | Lead "The season is put away. What changes:"; changes "Its public page says "This season has been archived."" · "It stays under Past seasons, and its schedule and standings stay up." · "Nothing else changes: it stays locked, and Money stays open." · "Families are not emailed."; foot "You can reopen it from Past seasons."; loose end "{n} players still owe fees." (`:189-197`) | **Removed** | The whole window. The owing warning still lives in the Complete window. |
| `arc.win.button` | "Archive season" / "Archiving…" (`:198`) | **Removed** | |
| `arc.delete.api` | Two refusals from the season DELETE route: "Only a season that has not opened registration can be deleted. Archive it instead." and "This season already has families, teams, games, email or money entries attached, so it can’t be deleted. Archive it instead." (`app/api/admin/house-league/seasons/[seasonId]/route.ts:271,274`) | **Only a season that has not opened registration can be deleted.** and **This season already has families, teams, games, email or money entries attached, so it can’t be deleted.** | Found on the way: retiring Archive would leave two refusals that point at a door that is gone. Each now states the fact and stops; a season ends by being completed, and the Complete window already says so. Follows from 9f·4, not a new ruling. |
| `arc.public.sentence` | "This season has been archived." (`app/[orgSlug]/league/[seasonSlug]/page.tsx:258`) | **This season has concluded.** (an already-archived season reads exactly as a completed one) | Ruling 9f·4: "archived ones read exactly like completed ones everywhere". |
| `arc.public.chip` | "Archived" and "Season complete" in the season page’s header chip (`STATUS_LABEL`, `page.tsx:30-37`) | **No chip** on a finished season (see section 5) | Ruling 9f·4 ("public chip gone"); 9a copy §8 already retired both words. |
| `arc.label` | "Archived" as a status label for the admin | none to remove: the admin pill already reads **Finished** | `house-league-season.ts:116`. |
| `arc.help` | Help article "Closing out a season": "Complete the season when games end, then Archive it if you wish…" and the bullet "Archive the season — an extra step…" (`lib/help-content/house-league.tsx:1621,1630`); keywords `archive season`, `archived` (`:16,1622`) | for the `/docs` pass: drop the Archive step and the sentence about its public page; keep `archive season` as a keyword so a search still lands, pointing at "Finished" | Docs follow the build; not written here. |

The tournament’s and the rep team’s "Archive" are separate products and are not touched.

## 4. Public: the season page and the index

Who reads it: families and anyone with the link (light, club-themed). Rulings 9f·3 and 9f·4.

### 4.1 A season past its last day that the club has not completed

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `pub.ended.chip` | "Final standings" (the row tag, `publicSeasonState`, `house-league-season.ts:169`); "Season active" on the season page’s header chip (`page.tsx:33`) | **Ended {Aug 28}** (same as the admin pill) | Ruling 9f·3. One word for one state in admin and public (`house-league-season.ts:121`). Date is `dayLabel`: "Aug 28", or "Aug 28, 2027" in another year. Tone: neutral on the public side (the admin pill is amber; a family should not read it as a warning). |
| `pub.ended.link` | "Standings →" (`page.tsx:269`, an active season) | unchanged: **Standings →** | Already built. Listed because the ruling names it. |
| `pub.ended.note` | "This season is currently active. Registration is closed." (`page.tsx:256`) | unchanged (ruled, Q6) | True, and 9f·3 targets the word "Final", not this sentence. |

### 4.2 A completed season (and an already-archived one)

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `pub.fin.link` | "Final standings →" (`page.tsx:269`) | unchanged: **Final standings →** | Already built; 9f·3 keeps it, now true only once the club has completed the season. |
| `pub.fin.title` | "Standings" (the standings page title, `STANDINGS_WORDS.title`, `lib/league-standings.ts:195`) | **Final standings** when the season is completed (or archived); **Standings** otherwise | Ruling 9f·3: "on its link and its page title". The sub line under the title stays the season name; the drawing’s "completed {date}" is not added (ruled, Q4). |
| `pub.fin.sentence` | "This season has concluded." (`page.tsx:257`) | unchanged | Also now the only finished sentence (see `arc.public.sentence`). |
| `pub.fin.chip` | "Season complete" (`STATUS_LABEL.completed`) | **No chip** | The shelf is the label: a finished row is untagged (`publicSeasonState` returns null for it, 9a copy §8, "Past season rows: no tag"). The season page’s header chip should come from the same function, so a season is never named two ways. |
| `pub.live.chip` | "Season active" (`STATUS_LABEL.active`) | **Starts {date}** / **Playing now** / **Ended {date}**, from `publicSeasonState` | Not a 9f ruling: it is the 9a-accepted word list (9a copy §8 retired "Season active"), still alive in the same lookup that 9f must edit. |

### 4.3 Retired public words, in one place

| Retired | Replaced by |
|---|---|
| "Final standings" as a tag on a running season past its end | "Ended {date}" |
| "Season complete" (header chip) | no chip |
| "Archived" (header chip) | no chip |
| "This season has been archived." | "This season has concluded." |
| "Season active" (header chip) | "Starts {date}" · "Playing now" · "Ended {date}" |

## 5. The coach’s team page

Where: `/{org}/league/{season}/team/{id}`, the coach of the team, for the 30 days after the season is completed. Rulings 9f·6 and
9f·2 (the table is the live computation; nothing is stored).

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `coach.final` | (absent; the finished view shows no standing line) | **Final place: {2nd} of {6} · {8-3-1} · {17 points}** | Ruling 9f·6. Built from the same line the live page already writes (`coachStandingLine`, `lib/league-standings.ts:266-273`), so the record and points read the same. The drawing wrote "17 pts"; the shipped line says "17 points", and one thing gets one spelling, so "points" wins. |
| `coach.final.tied` | (absent) | **Final place: Tied for {3rd} of {6} · {3-2-0} · {6 points}** | The live line’s tie form (`Tied for 3rd of 6`) reused. 1 point is "1 point" (`pluralize`). |
| `coach.final.none` | (absent) | no line | When the table was never public (division unpublished or Show standings off) or nothing was scored, nothing is written, not even "unranked". Same rule as 9e’s standing line. |
| `coach.final.link` | "See the standings" (`STANDINGS_WORDS.coach.link`, `lib/league-standings.ts:259`) | **See the final standings** on a finished season’s page; **See the standings** stays on a live one | Ruled (Q7). The public page it opens is titled "Final standings" for a completed season: one name for one place. |
| `coach.heading` | "Scores and standings" when the line shows, "Scores" when it does not (`coach.heading`, `:257`) | unchanged | The Final place line sits under it. |
| `coach.sched` | The "Schedule" heading, with "See the season’s schedule" under it (`team/[teamId]/page.tsx:87,97`), shown empty on a finished season | **Removed from a finished season’s page, link included** (no words) | Ruling 9f·6: "the empty Schedule heading goes". The link goes with it (ruled, Q8): a lone link under no heading looks lost, and the schedule stays on the public site. |
| `coach.notice` | "{Season} has finished. This page stays until {Oct 3}." | unchanged | The ruling keeps it; it is what tells the coach the line goes. |

## 6. The free League plan’s one season (9f·5)

Rule as logged (`BUSINESS_DECISIONS.md` 2026-11-04, "House League 9f·5", lines 35 to 55; **Decided**, dormant while the floor is
parked): only a getting-ready, registration-open or registration-closed, or running season holds the one slot; a finished season
holds nothing; Reopen checks the same limit. `/billing` builds it in 9f-1. Its handoff to `/marketing` asked that the refusal
"stop saying "active" while counting finished ones, and say Complete frees the season". Nothing here changes a price, band or plan
name.

### 6.1 Creating a second season

Where: the refusal window the free League plan meets on Create season (`LeagueCapUpgradeModal`), and the same refusal as the
route’s error text for a direct request. Who reads it: a free League club’s owner or league admin.

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `free.new.title` | "One season on your free plan" (`components/admin/LeagueCapUpgrade.tsx:9`) | **One season at a time on your free plan** | The words said "one season"; the rule is one at a time. Matches the tournament’s "Your plan runs one tournament at a time" (`lib/after-event-words.ts:95`). |
| `free.new.named.running` | "Your free League plan includes one active season. League Plus lets you run multiple seasons and age groups side by side." (`LeagueCapUpgrade.tsx:15`) | **Your free League plan runs one season at a time, and {Fall Ball 2027} holds it. Once you complete it, you can start the next. It stays on your site. League Plus runs several seasons and age groups side by side.** | PRIMARY body when one running or open season holds the slot (ruled, Q2). Drops "active" (it counted finished ones), says what frees the slot (Complete, per the handoff) and that the finished season stays (9f·15). Names the holder as the tournament does (`NEXT_YEAR_WORDS.slotTaken`, `lib/after-event-words.ts:97`). "Multiple" becomes "several". |
| `free.new.named.draft` | (same) | **Your free League plan runs one season at a time, and {Draft Test 2028} holds it while it’s getting ready. League Plus runs several seasons and age groups side by side.** | PRIMARY body when the holder is a getting-ready season: it cannot be completed, so "Complete it" would be a dead instruction; this one only states the fact. |
| `free.new.body` | (same) | **Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next. League Plus runs several seasons and age groups side by side.** | FALLBACK body, used only when the refusal carries no single holder to name. |
| `free.new.api` | "Your free League plan includes one active season. Upgrade to League Plus to run multiple seasons." (`lib/free-floor.ts:74`; the 403 body) | **Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next, or upgrade to League Plus to run several seasons.** | The route’s `error` text for any client that shows the server’s words; generic by design (ruled, Q2). The 403 body also carries the holder’s name and status for the window to use. |
| `free.new.buttons` | "Maybe later" · "Express interest in League Plus →" (or "Upgrade to League Plus →" once self-serve) | unchanged | The refusal is the window’s; its buttons are the plan system’s. |

### 6.2 Reopening a finished season

Where: the Reopen window (section 2), shown in place of "What changes" when the reopen would make two live seasons on the free
League plan; and the route’s error text. "In words, before the tap" (BD 2026-11-04): the sentence is on the window the person
already opened, and the Reopen button is absent, not disabled ("absent beats disabled", 9a·4). The window’s only button is **Close**
(never "Cancel": nothing is being asked).

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `free.reopen.lead` | (absent; Reopen skips the limit today, finding F03) | **Your free League plan runs one season at a time, and {Fall Ball 2027} isn’t finished. Complete it first, then you can reopen this one.** | Same rule as 6.1, said for this act. Names the holder because the window can see the club’s other seasons. |
| `free.reopen.lead.draft` | (absent) | **Your free League plan runs one season at a time, and {Draft Test 2028} is still getting ready.** | When the holder is a getting-ready season, there is nothing to complete. |
| `free.reopen.plus` | (absent) | **League Plus runs several seasons and age groups side by side.** | One sentence after the lead, the same League Plus line as 6.1. |
| `free.reopen.api` | (absent) | **Your free League plan runs one season at a time. Complete your current season before you reopen this one.** | The route’s refusal if a request skips the window. |
| `free.reopen.button` | (absent) | **Close** | See above. |

---

# Part B · 9f-2: Start next season

All strings in this part belong to the Create season window ("Create a house-league season", `CreateLeagueSeasonDialog.tsx:72`),
which keeps its title, its Name, Sport and Season dates fields, its error line and its primary button "Create season" as built. The
rulings and the drawings call it the "New season window"; the product’s button says "Create season" (kept, ruled Q9), so the
words below use the product’s. League runners only (9f·9). Phone is the same window as a full-screen sheet; where a shorter form
is drawn it is given.

## 7. The "Start from" field

Where: first field in the window. Who sees it: owner, club admin, league admin. Absent when the club has no season yet (nothing to
start from; no words).

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `sf.label` | (absent; drawing: "Start from") | **Start from** | Drawn. Plain, and it is the ruling’s own word (9f·8). |
| `sf.default` | (absent) | The field opens on the club’s most recent season, shown closed as **{Draft Test 2027} · {Finished}** | Ruling 9f·8. The second word is the season’s pill (`seasonState`), not a new status vocabulary. |
| `sf.blank` | drawn: "A blank season" with sub-line "Name, sport and dates only, as today" | **A blank season** · sub-line: **Name, sport and dates only.** | Drawn. "As today" was a note to the reader, not a screen word. |
| `sf.group` | drawn: group heading "Copy a season" above the list | **No group heading** | Ruled (Q3). "Copy" is a third word for the act (Start from, Bring with it); with a blank option and a short list, a heading adds nothing. |
| `sf.option` | drawn: "Draft Test 2027 Finished · 4 age groups · 22 teams" | **{Draft Test 2027}** · **{Finished} · {4 age groups} · {22 teams}** (second line) | Newest first. The status is the season’s pill word, so a running one reads "Playing now" and a forgotten one reads "Ended Aug 28". |
| `sf.option.live` | drawn: "Fall Ball 2027 Running · 2 age groups · 6 teams" | **{Fall Ball 2027}** · **{Playing now} · {2 age groups} · {6 teams}** | Drawn used "Running"; the pill’s word is "Playing now" (`house-league-season.ts:122`), and a season gets one name per state. A live season is listed (9f·10): it is how an age group gets its own calendar. |
| `sf.option.counts` | (absent) | "1 age group", "1 team", "0 teams" | `pluralize`. A getting-ready season may have none. |
| `sf.phone.title` | drawn: the field opens a drawer titled "Start from" | **Start from** | Drawn. |

## 8. The first statement once a season is picked

Ruling 9f·11: the source is left exactly as it was, and the window says so **first**: directly under the field, before anything else.
Shown for every source, finished or live; not shown for "A blank season".

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `sf.left` | drawn: "Draft Test 2027 isn’t changed. Its families, payments, games and scores stay with it." | **{Draft Test 2027} is left exactly as it was. Its families, payments, games and scores stay with it.** | The ruling’s own sentence is the stronger one: "isn’t changed" could be read as "not yet changed"; "left exactly as it was" cannot. The second sentence is the drawn one, kept. |
| `sf.owes` | drawn (edge 1): "3 players still owe $525 there; that stays on its Money." | **{3 players} still owe {$525} there. That stays on its Money tab.** | The clause appears only when the source is FINISHED and someone owes (ruled, Q10: a running season nearly always has someone owing, so it would be noise there). One player: "1 player still owes $175 there." The amount is formatted as the Overview’s "Still owing" tile shows it. A warning, never a block, and not amber (the copy closes nothing). Two sentences, not a semicolon: the product writes sentences. "Money tab" names the page as the rail does. |
| `sf.forgot` | drawn (edge 5): "It is still running: complete it from its Overview once its scores are in." | **omitted** | Ruled (Q11). The picker already reads "Ended Aug 28" beside that season, which is the same signal. |

## 9. The dates

### 9.1 From a finished season (dates move, 9f·13)

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `sf.dates.desk` | drawn: "52 weeks after Draft Test 2027’s, so every date falls on the same weekday. Registration dates and the early price move the same way; check them on the new season’s Overview." | **52 weeks after {Draft Test 2027}’s dates, so every day falls on the same weekday. The registration dates and the early price move the same way; check them on the new season’s Overview.** | Ruling 9f·13: 52 weeks, same weekday, all five dates. The drawn "52 weeks after … 2027’s" ended on a possessive with no noun; "dates" is the noun. "Overview" is the product’s page name. |
| `sf.dates.phone` | drawn: "52 weeks after Draft Test 2027’s, on the same weekdays." | **52 weeks after {Draft Test 2027}’s dates, on the same weekdays.** | Same fix. |
| `sf.dates.fields` | (the window shows two of the five) | the first and last day arrive filled, e.g. **Apr 29, 2028** to **Aug 26, 2028** | Drawn; the other three follow and are checked on the Overview. |

### 9.2 From a live season (dates come in empty, 9f·10)

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `sf.dates.live` | drawn (edge 3): "When copying from a live season the dates come in empty" (a note, no screen words) | **{Fall Ball 2027} isn’t finished, so no dates come across. Set the new season’s own.** | Ruling 9f·10. "Isn’t finished" is true for getting-ready, open and running sources alike ("is still running" would be wrong for a draft). The date fields show empty. |

### 9.3 The name

Ruling 9f·13: a four-digit year in the source’s name goes up by the same years, otherwise the name comes in empty. Both are
behaviours, not sentences, so the window gets no explanatory line (an extra sentence for each field is how this window would
become a form).

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `sf.name.bumped` | (the field prefilled) | e.g. "Draft Test 2027" becomes **Draft Test 2028** | The field is editable; the person reads and decides. |
| `sf.name.empty` | existing placeholder "Summer 2027" (`CreateLeagueSeasonDialog.tsx:88`) | the field is empty and its placeholder is the **source’s name**, e.g. **Fall Ball** | Drawn ("with the source’s name as its placeholder"). |
| `sf.name.missing` | 9b-1 copy `create.err.nameRequired` "Give the season a name." (`HOUSE_LEAGUE_STAGE9B1_COPY.md:79`); the shipped window holds the button off instead (`CreateLeagueSeasonDialog.tsx:29`) | unchanged: the **Create season** button stays held until there is a name | No new string needed. |
| `sf.name.taken` | "You already have a season with this name. Give this one a different name." (`app/api/admin/house-league/seasons/route.ts:102`) | unchanged | Reused as the drawing says ("refused with today’s words"). The window stays open with the name as typed. |
| `sf.name.reserved` | "That name can’t be used. Try another." (`lib/house-league-season.ts:216`) | unchanged | |

## 10. "Bring with it"

Ruling 9f·12 (the s17 list): settings, age groups (birth years moved up), team names and colours and practice settings ticked;
coaches unticked. The checkboxes are the only choices the copy gives. Desk wording is the long form; the phone drops the second
sentence on each row (drawn).

| Key | Current (source) | Proposed, desk | Proposed, phone | Why |
|---|---|---|---|---|
| `bw.title` | drawn "Bring with it" | **Bring with it** | **Bring with it** | Drawn. |
| `bw.settings` | drawn: "The season’s settings: Fee, how to pay, waiver, email consent, approval and waitlist rules, when "owing" turns amber, home and away balance, two games in a day." (ticked) | **The season’s settings** · Fee, how to pay, waiver, email consent, how new registrations are taken, the waitlist, Owing turns amber, and the schedule rules. | **The season’s settings** | The drawn list used internal names ("approval and waitlist rules", "home and away balance"). These are the labels the season page already shows: "Owing turns amber" (`lib/house-league-money-words.ts:26`), "Email consent", "how new registrations are taken" (`CreateLeagueSeasonDialog.tsx:104`), "Waitlist" (`SeasonRecordBlocks.tsx:254`). The schedule rules are named once as a phrase (ruled, Q12): the build lists whatever labels the Schedule page shows for those two switches, in the same order, and "the schedule rules" is the fallback. |
| `bw.ageGroups` | drawn: "Age groups: Names, sizes, prices, early prices, notes, games per team, Show standings. Born years move up one year: U10 becomes born 2018–2019." (ticked, count 4) | **Age groups** · Names, sizes, prices, early prices, notes, games per team and Show standings. Birth years move up one year: {U10} becomes born {2018–2019}. · **{4}** | **Age groups** · Birth years move up one year. · **{4}** | "Birth years" is the product’s noun; "born 2018–2019" is the family-facing line (`lib/born-years.ts:127`). Moves by the whole years between the two first days (9f·13); the sentence says "one year" in the usual case and is built with the real number ("two years") otherwise. "Show standings" is the switch’s own label (9e copy §3). |
| `bw.ageGroups.live` | drawn (edge 3): the line "opens to chips, all on" (no words) | **Age groups** · Choose which age groups come across. · chips named for each group, all on | same | Without this a running season could not give one age group its own calendar (9f·10, Q19). The birth years hint is dropped, because the dates are empty: birth years stay as they are (ruled, Q13). |
| `bw.teams` | drawn: "Team names and colours: No players. You draft again." (ticked, count 22) | **Team names and colours** · No players. You run the draft again. · **{22}** | **Team names and colours** · **{22}** | "Run the draft" is the button on the Teams page (`house-league-teams-screen-words.ts:36`). |
| `bw.practice` | drawn: "Practice length and teams at once: For each age group." (ticked) | **Practice length and teams at once** · For each age group. | **Practice length and teams at once** | Drawn; "teams at once" is the club schedule’s own label (`club-schedule-settings.ts:15`). |
| `bw.coaches` | drawn: "Coaches: Names and emails, on the same teams. Nobody is invited until you publish teams." (unticked, count 31) | **Coaches** · Names and emails, on the same teams. Nobody is invited until you publish teams. · **{31}** | **Coaches** · Invited only when you publish teams. · **{31}** | Drawn. "Publish teams" is the button (`house-league-teams-screen-words.ts:36`); a volunteer who ticks it learns that the email waits. Unticked by default (9f·12). |

### 10.1 What always starts empty (9f·12)

Ruling: never registrations, money, ratings, games, practices, sends, club time or the budget seed.

| Key | Current (source) | Proposed, desk | Proposed, phone | Why |
|---|---|---|---|---|
| `sf.empty` | drawn: "Always starts empty: registrations and payments, ratings, games and scores, practices, emails and notices, and club time. The club gives the new season its time, as it does every season." | **Always starts empty: registrations and payments, ratings, games and scores, practices, emails and notices, and the club’s time. The club gives the new season its time, as it does every season.** | **Always starts empty: registrations, payments, ratings, games, practices, emails and the club’s time.** | "Money" and "sends" are the ruling’s shorthand; a volunteer reads "payments" and "emails and notices". "The budget seed" is not named: a volunteer would not recognise it, and the new season makes its own budget line when its fees first need one (s17). "Club time" becomes "the club’s time" (9e `rain.prac.club` wording; ruled, Q14). |
| `sf.foot` | drawn: window foot "Families are not emailed." | **Families are not emailed.** | same | The status windows’ shared foot sentence (`NOT_EMAILED`, `house-league-status-words.ts:73`), set at the left of the foot beside Cancel and **Create season** exactly as in 9a·4. |

## 11. What the new season shows (marks, the line, the missing time)

Where: the new season’s Overview while it is **Getting ready** (the checklist before Open registration), for the people who run
house league. Published marks start empty, so Teams and the schedule start unpublished (s16).

| Key | Current (source) | Proposed, desk | Proposed, phone | Why |
|---|---|---|---|---|
| `mk.line` | drawn: "Started from Draft Test 2027: settings, 4 age groups, 22 team names. Check each line, then open registration." | **Started from {Draft Test 2027}: {settings, 4 age groups, 22 team names}. Check each line, then open registration.** | **Started from {Draft Test 2027}. Check each line, then open registration.** | Drawn. The list after the colon names only what was ticked (so "settings, 4 age groups, 22 team names and 31 coaches" when coaches came). Practice settings are not listed: a volunteer would not count them. |
| `mk.from` | drawn: "From Draft Test 2027" on the Age groups, Prices, How to pay and Waiver lines | **From {Draft Test 2027}** | same | Drawn. It says "this was brought over, check it" and goes when the line is edited (s16). |
| `mk.moved` | drawn: "Moved 52 weeks" on the Registration dates line | **Moved 52 weeks** | same | Drawn. Not shown when the source was live (the dates did not come). |
| `mk.ageLine` | drawn: "4 divisions, each with birth years and a size · born years moved up one" | **{4 divisions}, each with birth years and a size · birth years moved up one year** | not shown | The line’s first half is the shipped checklist wording (`house-league-season.ts:321-324`, which says "divisions" in its counts and "Age groups" in its title: a pre-existing mixed word, left as is, ruled Q15). |
| `mk.noTime` | drawn: "No club time yet. The club gives this season its time in the club’s Schedules; games and practices can be made once it has." and phone "No club time yet. The club gives this season its time." | **The club hasn’t given this season any time yet. It gives it in the club’s Schedules; games and practices can be made once it has.** | **The club hasn’t given this season any time yet.** | Ruled (Q14). Reuses the product’s own sentence (`lib/league-time.ts:523,529`: "The club hasn’t given house league any time yet.") so a volunteer meets one phrase in both places; the drawn "No club time yet…" is not used. For a league admin (who cannot open Schedules) the second sentence reads "An owner or an admin gives it, in Schedules." as in `noneGivenLeagueAdmin`. |

## 12. The rare door at the end of each season’s Overview

Ruling 9f·8 and the s1 frame. A sentence and a link, ending the body (a rare door never a foot row), for the league runners only; a
registrar or a treasurer sees none (absent beats a sentence). On a running season it sits below the "Next step: Complete the season"
card. The link ends in an ellipsis because it opens a window (house rule).

| Key | Current (source) | Proposed | Why |
|---|---|---|---|
| `door.start` | drawn: "Running it again? **Start next season from this one…**" | **Running it again?** · **Start next season from this one…** | Drawn, kept. Opens the Create season window with Start from preset to this season. |
| `door.start.order` | the finished season’s doors today: Archive · Reopen | **Start next season** then **Reopen** ("Need to change something? Reopen the season…", unchanged) | s6. |

---

## 13. What changed from the drawings, and why

1. **"isn’t changed" became "is left exactly as it was"** (`sf.left`): the ruling’s own phrase, and the stronger one.
2. **"Running" became the pill’s word** in the picker (`sf.option.live`): "Playing now", or "Ended {date}" for a forgotten season.
3. **"52 weeks after Draft Test 2027’s"** gained its noun ("’s dates") because it ended on a possessive.
4. **"born years" became "birth years"** in prose (`bw.ageGroups`, `mk.ageLine`) to match `lib/born-years.ts`; "Born 2018–2019" is kept as the line families read.
5. **"17 pts" became "17 points"** on the coach’s Final place line to match the shipped standing line.
6. **"Draft Test 2028 is not changed."** gained plural forms for two or more newer seasons.
7. **The Reopen window’s two public-site lines became one** (`ro.public.ended` / `ro.public.playing`), because one of the old two said "Final standings".
8. **The drawn "Copy a season" group heading is dropped** (`sf.group`).
9. **"No club time yet" became the shipped sentence** (`mk.noTime`).
10. **"payments" and "emails and notices"** stay as drawn for "money" and "sends" in the always-empty line; the budget seed is not named.
11. **The Complete window gains "and record refunds"** (`cx.rest`), as the drawing’s "after" frame had it.
12. **The coach’s link reads "See the final standings"** on a finished page (`coach.final.link`), and the "See the season’s schedule" link goes with the Schedule heading.
13. **The free League plan’s refusal names the season that holds the slot** (`free.new.named.*`, `free.reopen.lead`), with the generic sentence as the fallback and the route’s text.
14. **Two DELETE refusals stop pointing at Archive** (`arc.delete.api`), found while retiring it.

## 14. Word list for the 9f-1 build prompt (FINAL)

Only 9f-1 strings. This is the binding list for the build; keys and reasons are in the section noted.

| String | Where it shows | Who reads it | Section |
|---|---|---|---|
| Money stays open: you can still mark fees received and record refunds. | Complete window (replaces "…received.") | league runners | 1 |
| Player ratings are erased. | Complete window, after the public-site line, before "Families are not emailed." | league runners | 1 |
| Your public site lists it as Ended {Aug 28} until you complete it again. | Reopen window (last day passed) | league runners | 2 |
| Your public site lists it as Playing now. | Reopen window (last day not passed, or no last day) | league runners | 2 |
| Player ratings were erased when it finished. They don’t come back. | Reopen window | league runners | 2 |
| {Draft Test 2028} is not changed. · {A} and {B} are not changed. · Your {3} newer seasons are not changed. | Reopen window, when a newer season exists (one, two, three or more) | league runners | 2 |
| (removed) Finished and settled? Archive the season… | finished Overview rare door | league runners | 3 |
| (removed) the Archive window: title "Archive {season}?" and "Archive the season?", lead, four changes, loose end, foot, "Archive season", "Archiving…" | status window | league runners | 3 |
| Only a season that has not opened registration can be deleted. · This season already has families, teams, games, email or money entries attached, so it can’t be deleted. | the season DELETE route’s refusals (the sentence "Archive it instead." goes) | league runners | 3 |
| This season has concluded. (for an archived season too) | public season page | families | 3, 4.2 |
| (removed) "Archived", "Season complete", "Season active" header chips | public season page | families | 3, 4.2, 4.3 |
| Ended {Aug 28} | public season row and season page header chip, in place of "Final standings" and "Season active" | families | 4.1 |
| Starts {date} · Playing now | the season page header chip, from the shared function | families | 4.2 |
| Final standings | the standings page title (completed or archived season only); "Standings" otherwise | families | 4.2 |
| Final place: {2nd} of {6} · {8-3-1} · {17 points} · Final place: Tied for {3rd} of {6} · … | the coach’s team page, 30 days after completion, only if the table was public | team coaches | 5 |
| See the final standings | the coach’s link on a finished page ("See the standings" stays on a live one) | team coaches | 5 |
| (removed) the empty "Schedule" heading and its "See the season’s schedule" link | the coach’s page on a finished season | team coaches | 5 |
| One season at a time on your free plan | refusal window title (Create season) | free League club | 6.1 |
| Your free League plan runs one season at a time, and {Fall Ball 2027} holds it. Once you complete it, you can start the next. It stays on your site. League Plus runs several seasons and age groups side by side. | refusal window body, holder running or open | free League club | 6.1 |
| Your free League plan runs one season at a time, and {Draft Test 2028} holds it while it’s getting ready. League Plus runs several seasons and age groups side by side. | refusal window body, holder getting ready | free League club | 6.1 |
| Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next. League Plus runs several seasons and age groups side by side. | refusal window body, fallback (no single holder to name) | free League club | 6.1 |
| Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next, or upgrade to League Plus to run several seasons. | the route’s error text | free League club | 6.1 |
| Your free League plan runs one season at a time, and {Fall Ball 2027} isn’t finished. Complete it first, then you can reopen this one. · Your free League plan runs one season at a time, and {Draft Test 2028} is still getting ready. · League Plus runs several seasons and age groups side by side. · Close | Reopen window, replacing "What changes"; the Reopen button is absent | free League club | 6.2 |
| Your free League plan runs one season at a time. Complete your current season before you reopen this one. | the route’s error text for Reopen | free League club | 6.2 |

### 14.1 Word list for the later 9f-2 prompt (FINAL)

| String | Where it shows | Who reads it | Section |
|---|---|---|---|
| Start from · A blank season · Name, sport and dates only. · {Season} · {pill} · {n age groups} · {n teams} (no group heading) | Create season window, the first field and its list | league runners | 7 |
| {Draft Test 2027} is left exactly as it was. Its families, payments, games and scores stay with it. | under the field | league runners | 8 |
| {3 players} still owe {$525} there. That stays on its Money tab. | under the line above, only for a FINISHED source when someone owes | league runners | 8 |
| 52 weeks after {Draft Test 2027}’s dates, so every day falls on the same weekday. The registration dates and the early price move the same way; check them on the new season’s Overview. (phone: 52 weeks after {Draft Test 2027}’s dates, on the same weekdays.) | under the Season dates, finished source | league runners | 9.1 |
| {Fall Ball 2027} isn’t finished, so no dates come across. Set the new season’s own. | under the Season dates, live source | league runners | 9.2 |
| Bring with it · The season’s settings · Age groups · Team names and colours · Practice length and teams at once · Coaches, with their sub-lines (section 10; the live-source Age groups line reads "Choose which age groups come across.") | the window, a tick list | league runners | 10 |
| Always starts empty: registrations and payments, ratings, games and scores, practices, emails and notices, and the club’s time. The club gives the new season its time, as it does every season. (phone: Always starts empty: registrations, payments, ratings, games, practices, emails and the club’s time.) | the window, below the list | league runners | 10.1 |
| Families are not emailed. | the window foot | league runners | 10.1 |
| Started from {Draft Test 2027}: {settings, 4 age groups, 22 team names}. Check each line, then open registration. | new season Overview, Getting ready | league runners | 11 |
| From {Draft Test 2027} · Moved 52 weeks | checklist marks | league runners | 11 |
| The club hasn’t given this season any time yet. It gives it in the club’s Schedules; games and practices can be made once it has. (phone: The club hasn’t given this season any time yet.) | new season Overview | league runners | 11 |
| Running it again? Start next season from this one… | the end of each season’s Overview | league runners | 12 |

---

## 15. Open questions for the owner: ALL RULED 2026-11-04 as recommended

The owner accepted every recommendation ("go with your recommendations"). Each question is kept with its answer. None reopens a ruling.

1. **The Complete window’s money line is one clause behind.** The shipped window says "Money stays open: you can still mark fees received." (`house-league-status-words.ts:175`); the drawing’s "after" frame, 9b-2 and the lock line all add "and record refunds". **RULED: add "and record refunds"** in the same edit as `cx.ratings` (section 1).
2. **Does the free League refusal name the season that holds the slot?** The tournament does (`slotTaken`). **RULED: yes.** The named sentences are the window’s body; the generic sentence is the fallback when no single holder can be named, and the route’s error text. The 403 body carries the holder (sections 6.1, 6.2).
3. **Group heading in the Start from list: "Copy a season" (drawn) or none.** **RULED: none.**
4. **The standings page’s sub line on a completed season.** **RULED: the sub line stays the season name**; "completed {date}" is not added.
5. **"Running" in the Reopen window against "Playing now" on the pill.** **RULED: leave it** (the group word; the 9a copy was accepted), and add no third use.
6. **The public season page’s sentence for a running season past its end** ("This season is currently active. Registration is closed."). **RULED: leave as built.**
7. **The coach’s link on a finished season.** **RULED: "See the final standings"** on a finished page only; the live link is unchanged.
8. **The coach page’s "See the season’s schedule" link after the Schedule heading goes.** **RULED: the link goes with the heading.**
9. **"New season" (rulings, drawings) against "Create season" (the product).** **RULED: keep the product’s words.**
10. **The money-owing clause for a live source.** **RULED: only for a finished source.**
11. **A forgotten-to-complete source** (drawn edge 5). **RULED: omit.**
12. **The schedule rules named inside "The season’s settings".** **RULED: the build lists whatever labels the Schedule page shows, in the same order;** "the schedule rules" is the fallback.
13. **Birth years when the dates come in empty (live source).** **RULED: they stay as they are**, and the Age groups line drops its "move up" sentence.
14. **"Club time" as a screen word.** **RULED: "the club’s time"** in the always-empty line, and the shipped sentence in `mk.noTime`.
15. **"divisions" against "age groups" inside the checklist.** **RULED: leave**, fix on its own pass.
16. **The free-floor Start from.** 9f·16 is `Proposed` and excludes the free floor. **RULED: no free-floor words are written**; if 9f·16 is ruled the other way, the window needs one line saying what the cap leaves out.

## 16. Checks

By eye, because `npm run check:spelling` scans code, not this file: no `Canceled`, no `House League`, no `AM`/`PM`, no "financial
year", "colours" (not "colors"), no "installment" needed, no "households", no "unlock", "powerful", "robust", "seamlessly", "leverage"
or "streamline", no exclamation marks. Every possessive goes through `possessive()`. Every date goes through `formatStoredDate`. The
phrases "has been archived" and "Season complete" appear only as retired words (Current columns and the "removed" rows).
