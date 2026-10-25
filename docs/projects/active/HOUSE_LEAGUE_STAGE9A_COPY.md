# House league Stage 9a: the words (`/marketing`, 2026-10-24)

> Copy for the 9a build (`HOUSE_LEAGUE_STAGE9A_BUILD_PROMPT.md`, "Before any code" step 2). The drawings are the owner's
> ruled starting point (hub tab "9a drawn", frames A–F); every drawn word is kept unless a house rule or the code breaks it,
> and each change is listed in section 10 with its reason. Rulings in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0 and §0b are not reopened.
>
> **House rules applied.** Sentence case everywhere ("House league", "Public site", "Teams & draft", "Email families"). Times
> read "8:00 a.m." (a clock time never appears in 9a's strings, but `formatTime()` is the only builder if one is added). A name
> ending in s takes the bare apostrophe through `possessive()` (never a hand-built `’s`). Canadian spelling per the gate:
> "installment", no "-ise" spellings. House league says "season"; "fiscal year" is the club's money period and never appears here.
> One word per thing: "Registration" for the sign-up block, "Money" for the book, "Email families" for the composer. Apostrophes in
> strings are the curly `’`. Dates read as the club's stored days through `formatStoredDate` ("Aug 30"; "Aug 30, 2026" when the
> year is not this year). `{n}` strings pluralize: "1 registration is" / "{n} registrations are".
>
> **Plain words, no sales voice.** Nothing here says "unlock", "powerful" or "seamless"; a window says what changes, once.

## 0. Decision recorded today

**Owner, 2026-10-24: the season's "Email families" row is a RENAME ONLY in 9a.** It keeps opening today's season composer
(`seasons/[seasonId]/notifications/`). The switch to the club's Families window, the per-season allowance (Q12c: each season its
own 3 typed sends a day, automatic notices never counted) and retiring the old page and the Registrations "Message registrants"
window all land **together in 9d**. Reason on record: pointing the row at the Families window without Q12c would make every
house-league send count toward the club's 3 a day.

Copy consequence: the page heading, the rail row, the strip pill and the Registrations toolbar entry all say **"Email families"**
(section 7). Nothing in 9a says "Notifications" for this page.

## 1. The home (frame A)

| Element | String | Notes |
|---|---|---|
| Page eyebrow / title | House league / **Seasons** | Drawn. |
| Header button | + Create season | Drawn, unchanged. Absent for registrar and treasurer. |
| Group 1 name | **Running now** | Drawn. Holds every season in Registration open, Registration closed or active (including "Ended"). |
| Group 1, nothing in it | No season is running right now. | New (drawing only said empty groups are not drawn; this one stays because it is the page's anchor). |
| Group 2 name | **Getting ready** | Drawn. Only drawn when a season is in draft. No empty line (the group is absent). |
| Group 3 name | **Past seasons** | Drawn, closed shelf with a count pill. Holds completed and archived. Absent when none (no empty line). |
| Shelf toggle aria-label | Past seasons, {n} (collapsed) / expanded | Standard fold control. |
| No seasons at all, title | Run your first season | Replaces "Get started with House league". |
| No seasons at all, body | A season holds your age groups as divisions, with its registrations, teams, schedule and standings. Create one to get started. | The old body ("one division of players") contradicts Q19. |
| No seasons at all, button | Create your first season | Existing string. Absent for roles that cannot create; they see the body line only, with "No seasons yet." as the title. |
| Waiting count (amber pill, alone) | aria-label: {n} registration to review / {n} registrations to review | One aria string everywhere (drawn used two). Counts `pending_review` only. |
| Whole row | a link to the season's Overview | Chevron only; no per-row buttons. |

### The one line of facts per season row

Always in this order, joined by " · ". Sport is always second after the dates (the drawing left it off the 2027 row; it was an
oversight, one pattern now).

| Row is | Line | Example |
|---|---|---|
| Registration open | {dates} · {sport} · {n} divisions · {taken} of {spots} spots taken | May 31 – Aug 30, 2027 · Softball · 3 divisions · 5 of 38 spots taken |
| ...when any division has no size set | {dates} · {sport} · {n} divisions · {taken} players | May 31 – Aug 30, 2027 · Softball · 3 divisions · 5 players |
| Registration closed, Playing now, Starts {date}, Ended {date} | {dates} · {sport} · {n} divisions · {players} players · {teams} teams | May 31 – Aug 30, 2026 · Softball · 2 divisions · 14 players · 6 teams |
| Getting ready | {dates, or Dates not set} · {sport} · {n} divisions | Dates not set · Softball · 0 divisions |
| Past season | same as the running line | May 31 – Aug 30, 2025 · Softball · 2 divisions · 18 players · 6 teams |

Singulars: "1 division", "1 player", "1 team", "1 spot". "{players}" counts `active` registrations (the Waitlist and To review
counts are never folded into it).

### The second line (the `u` line), only when it has something true to say

| Row is | Line | Role variant |
|---|---|---|
| Active, today past its end date | Past its end date: complete it from the season page | For a role that cannot complete (registrar): **Past its end date** alone (absent beats a sentence that points at a door they do not have). |
| Registration open, close date still ahead | Registration closes {date} | Same for all. |
| Registration open, close date passed | Registration was set to close {date} | Drawn line was "Registration closes Aug 1, 2026" beside "Registration open" on a date already gone (F08). Until 9b-1 makes the dates run the form, the honest line is this one. 9b-1 replaces it. |
| Registration closed | Registration is closed. Start the season from its page. | Registrar: **Registration is closed.** |
| Getting ready, steps left | {k} things to do before registration can open | "1 thing to do before registration can open". |
| Getting ready, none left | Ready to open registration | Registrar: **Ready to open registration** (a fact, no door named). |
| Playing now, Starts {date}, Past season | (no second line) | |

The user's shorthand "Ended {date} — complete it from the season page" is the pill plus this line; the pill already says "Ended
{date}", so the line does not repeat the date. The drawn colon is kept (a colon, not a dash, joins the two halves).

## 2. Season state labels (the pill)

The club's today, whole days, the end date inclusive. A missing start date counts as already started; a missing end date counts as
not yet ended. The same function feeds the home pill, the season header pill and the phone strip's pill.

| Label | Status and date condition | Pill colour (words only) |
|---|---|---|
| **Getting ready** | `draft` | neutral |
| **Registration open** | `registration_open`, any dates (the dates do not run the form until 9b-1) | green |
| **Registration closed** | `registration_closed` | neutral |
| **Starts {date}** | `active` and today is before the start date | neutral. New: the drawings had no label for it, but "Activate season" is a manual step, so an active season can precede its first game. |
| **Playing now** | `active` and today is inside the dates | green |
| **Ended {date}** | `active` and today is after the end date (the fixture's 2026 season) | amber ("wait" pill as drawn) |
| **Finished** | `completed` or `archived` | neutral |

Where each lives: the home's Running now / Getting ready / Past seasons group is decided by status alone (`draft` → Getting ready;
`completed`, `archived` → Past seasons; the other three → Running now). Date only changes the word on the pill, never the group.

## 3. A season getting ready: the checklist (frame B, 9a·4)

Heading: **Before you open registration**. Three lines, each with a tick that is a state, not a control. `aria-label` on the tick:
"Done" / "Not done".

| Line | Not done | Done |
|---|---|---|
| Divisions | Add a division, and give each one its number of spots | {n} divisions · {total} spots |
| Dates | Set the first and last day of the season | {dates}, e.g. May 31 – Aug 30, 2027 |
| Fee | Set the registration fee (enter 0 if it is free) | ${fee} per player, or **Free** when the fee is 0 |

- "1 division · 14 spots" in the singular.
- **No helper line under the button.** The primary "Open registration" is absent until all three are done, so the three
  not-done lines are the whole explanation. A line like "Finish the checklist to open registration" would say the same thing
  twice, so it is not written. The heading stays the same when the lines are all done and the button appears beside it.
- A registrar reading a draft season sees the three lines as facts and no button, no pencil, no extra sentence.
- The only code check today is "at least one division" (`PATCH` returns 422 "Add at least one division before opening
  registration"). Dates and fee are not yet required by the server; the checklist enforces them in the screen only. Keep the
  server's message as the API's fallback; do not show it to people, because the checklist makes it unreachable.
- **How-to-pay and registration dates are not on this checklist.** They become required in 9b-1 (9b·1, 9b·9); do not add them
  early.

## 4. The status windows

One window component (`KitDialog`, sentence in `footerStart`, buttons only in `footer`). Full-screen with a back arrow on a phone.
Every status change asks. **Warn, never block**: a loose end is one amber sentence, the button stays pressable.

**Title rule (one rule for all seven).** Desk: "{Verb} {season name}?" with the name in full. Phone full-screen header: "{Verb} the
season?" with the season name bold as the first line of the body (a long name breaks a narrow header). This is what the drawing
did for Complete; it is now the rule for every window.

**Every window's body opens with one lead sentence, then "What changes:" and the list.** Foot sentence at the left, then Cancel,
then the primary at the right. Primary verb matches the title verb.

**Loose-end sentence pattern** (amber, one sentence, only the parts that are non-zero, joined with commas and "and"):
"{a} registration(s) still waiting for review, {b} on the waitlist, and {c} player(s) still owing fees."
Full forms: "1 registration is still waiting for review", "{n} registrations are still waiting for review"; "1 family is on the
waitlist", "{n} families are on the waitlist"; "1 player still owes fees", "{n} players still owe fees". Unpaid fees count =
active registrations whose fee is above $0 and not marked received (the summary has no such count today; the build derives it,
and shows none on a free season). The waitlist clause appears only in windows that end sign-ups (Close registration, Complete).

### 4.1 Open registration (draft to registration open)

| Part | String |
|---|---|
| Title | Open registration for {season}? |
| Lead | Families will be able to register as soon as you open it. |
| Changes | The season appears on your public site and on the House league page. |
| | The sign-up form goes live, and the season shows under Open now. |
| | New registrations are approved while a division has room, and a full division starts a waitlist. *(when the season approves automatically; otherwise)* New registrations wait for your review, and a full division starts a waitlist. |
| | Families are not emailed when you open registration. |
| Loose ends | none (the checklist already ran) |
| Foot (left) | You can close registration at any time. |
| Buttons | Cancel · **Open registration** |

Accuracy (code): a `draft` season 404s on the season, schedule and standings pages; opening makes it listed on the index and
home. The register API refuses unless the status is `registration_open`, and a full division returns `waitlisted`; an under-capacity
registration is `active` when `autoApproveUnderCapacity`, else `pending_review`. No email is sent by the status change.

### 4.2 Close registration (registration open to registration closed)

| Part | String |
|---|---|
| Title | Close registration for {season}? |
| Lead | Families will no longer be able to register. |
| Changes | The sign-up form closes. The season page says "Registration for this season has closed." |
| | Nobody new can join a waitlist. Families already on it keep their place. |
| | You can still approve, waitlist and add registrations by hand. |
| | Families who already registered can still look up their status. |
| | Families are not emailed. |
| Loose ends | the pattern, waiting + waitlist clauses only (fees are not a close-registration matter) |
| Foot (left) | You can reopen registration later. |
| Buttons | Cancel · **Close registration** |

Accuracy: the register page and API both stop at `registration_open`; the status-lookup page and API have no status check;
"You can still approve..." is true today because the admin registration route has no season-status check (Part 1's finished-season
rule only locks completed and archived seasons).

### 4.3 Reopen registration (registration closed to registration open)

**Needs a backward transition the API refuses today** (see section 9, gap 1).

| Part | String |
|---|---|
| Title | Reopen registration for {season}? |
| Lead | The sign-up form goes live again. |
| Changes | Families can register again, and the season shows under Open now. |
| | People already on the waitlist keep their place. |
| | Families are not emailed. |
| Loose end (only when the close date has passed) | Your close date, {date}, has already passed. Until the dates run the form, it does not close registration by itself, so close it again when you are ready. |
| Foot (left) | You can close it again at any time. |
| Buttons | Cancel · **Reopen registration** |

The loose-end sentence is amber and warns. **9b-1 replaces it** with "Your close date, {date}, has passed. Pick a new date so
the form stays open." (S2·b: the dates run the form; the convenor can close early or reopen until a new date).
Not offered once a season is Playing now: late players are added by hand (section 9, ask 2).

### 4.4 Start the season (registration closed to active) — an addition the drawings omitted

Today's code has "Activate season" as the step after Close registration. The drawings jump from Close to Complete, so this window
was never drawn (gap 2). It is the primary "next step" for a closed season, not a rare door.

| Part | String |
|---|---|
| Title | Start {season}? |
| Lead | The season moves to Running now. |
| Changes | Your public site shows it as Playing now, or Starts {date} if its first day is ahead, with Schedule and Standings up front. |
| | Registration stays closed. |
| | Families are not emailed. |
| Loose ends | the pattern, waiting registrations only |
| Foot (left) | Teams and the schedule can still change while it is running. |
| Buttons | Cancel · **Start season** |

### 4.5 Complete the season (active to completed)

Drawn words kept, with the three changes in section 10 (refunds, "marked Final", and a completed-early warning).

| Part | String |
|---|---|
| Title | Complete {season}? |
| Lead | The season moves to Past seasons. What changes: |
| Changes | Registrations, teams and the schedule can no longer be changed. |
| | Money stays open: you can still mark fees received. *(9b-2 adds: " and record refunds.")* |
| | You can still email its families. |
| | Your public site lists it under Past seasons, and its schedule and standings stay up. |
| | Families are not emailed. |
| Loose ends | the pattern, all three clauses |
| Extra loose end (only when today is before the end date) | Its end date, {date}, is still ahead. |
| Foot (left) | You can reopen it from Past seasons. |
| Buttons | Cancel · **Complete season** |

### 4.6 Archive the season (completed to archived)

| Part | String |
|---|---|
| Title | Archive {season}? |
| Lead | The season is put away. What changes: |
| Changes | Its public page says "This season has been archived." |
| | It stays under Past seasons, and its schedule and standings stay up. |
| | Nothing else changes: it stays locked, and Money stays open. |
| | Families are not emailed. |
| Loose ends | "{c} player(s) still owing fees." only (the one loose end that outlives the season) |
| Foot (left) | You can reopen it from Past seasons. |
| Buttons | Cancel · **Archive season** |

Honest by design: in the code, `archived` differs from `completed` by one public sentence and the status word. Archiving does
**not** hide a season (the league index lists both under Past seasons). The window says exactly that and promises nothing more
(ask 1).

### 4.7 Reopen a finished season (completed or archived to active)

**Needs a backward transition the API refuses today** (gap 1). Reopening returns the season to its running state from either
finished status.

| Part | String |
|---|---|
| Title | Reopen {season}? |
| Lead | The season comes back to Running now. What changes: |
| Changes | Registrations, teams and the schedule can be changed again. |
| | Your public site lists it as Playing now, or as Final standings if its dates have passed. |
| | If its end date has passed it reads "Ended {date}", so you can complete it again. |
| | Families are not emailed. |
| Loose ends | none |
| Foot (left) | You can complete it again at any time. |
| Buttons | Cancel · **Reopen season** |

### Button-label summary

| Door | Where it sits | Label (primary) |
|---|---|---|
| Open registration | primary on a Getting ready season, absent until the checklist is done | Open registration |
| Close registration | on the Registration block | Close registration |
| Reopen registration | on the Registration block, a closed season | Reopen registration |
| Start the season | primary on a closed season | Start season |
| Complete | rare door at the end of the page: a sentence plus a link | Complete the season… (link) then **Complete season** (button) |
| Archive | rare door at the end of a completed season's page | Archive the season… (link) then **Archive season** (button) |
| Reopen a finished season | rare door at the end of a finished season's page, and from Past seasons | Reopen the season… (link) then **Reopen season** (button) |

The rare-door sentence (drawn): "This season ended {date}. Complete the season…" when past its end date; otherwise "Done with this
season? Complete the season…". For Archive: "Finished and settled? Archive the season…". For Reopen: "Need to change something? Reopen the
season…". The link text carries the ellipsis because it opens a window (house rule: an ellipsis means "asks").

## 5. A finished season: the locked-state lines

Q16: reads in place, locked, Money open, "Finished" in the switcher. One quiet line at the top of the page body, never a banner
and never a disabled-looking control (every write control is absent).

| Page | Line (9a) | After 9b-2 |
|---|---|---|
| Overview, Teams & draft, Schedule, Standings | This season is finished, so this page is locked. Money stays open for late fees. | "...for late fees and refunds." |
| Email families | No line: the composer stays open on a finished season (owner 2026-10-24, plan §0c). | — |
| Registrations | This season is finished. Registrations are locked, and you can still mark fees received. | "...mark fees received and record refunds." |
| Money | This season is finished. You can still mark fees received. | "...mark fees received and record refunds." |

⚠ The drawn Complete window and the lock rule both promised refunds. **Refunds do not exist until 9b-2** (Q6: "record a refund";
today a decline voids the fee silently, F12). 9a's strings say only what the Part 1 gate can honestly keep open: marking fees received.
Part 1's matrix should list "refunds" as the thing 9b-2 adds to the finished-season exception, not as a 9a promise.

The Email families page on a finished season: the composer stays reachable (families still need a late word), so it carries no
lock line. Whether it stays writable is a Part 1 call (the build prompt says a finished season refuses every write except fees
and refunds, which would lock the composer): **if the gate locks it, use the first row's line; if it stays open, say nothing.**
This is ask 3.

## 6. Absent-state lines (only where something must be said)

The rule is **absent beats a sentence**. Nothing is added where the person simply lacks a control.

| Person | Where | What they see |
|---|---|---|
| Registrar | The season Overview: Add division, the pencils, Open / Close / Complete / Archive / Reopen | **Nothing.** No line, no greyed control (the drawn registrar view). |
| Registrar | The home's second line on an overdue season | "Past its end date" alone (section 1). |
| Registrar | A Getting ready season | The three checklist lines as facts, no button. |
| Registrar | Registrations, Email families | The full tools (Q17). No line. |
| Treasurer | The season frame | The rail's season block lists **Money** only; no strip on a phone beyond it. No sentence. |
| Treasurer | Any other season page reached by link | **You don't have access to this page.** with one link: **Go to Money**. A dead end needs one line and one way out; this is the single place a sentence is needed. Match the product's existing no-access page if one exists; this is its string, not a new pattern. |
| Treasurer | Money | Reads the same page every role reads. Nothing is writable by the treasurer, and no line says so. |
| Club admin, league admin, owner | everywhere | Everything, no lines. |
| Anyone | A finished season's controls | Absent; the lock line (section 5) explains the page once. |

## 7. Rail, phone strip and switcher labels

| Place | String |
|---|---|
| Rail group label (above the switcher) | Season |
| Rail and strip pages, in order | **Overview** · **Registrations** · **Teams & draft** · **Schedule** · **Standings** · **Money** · **Email families** |
| Phone strip: "Teams" | Drawn as "Teams" to fit. **Use "Teams & draft" in both** (the strip scrolls sideways, so width is not a reason to give one page two names). |
| Amber count on Registrations | aria-label: {n} registration to review / {n} registrations to review |
| Switcher: what it lists | Live seasons first, newest first; then Finished ones. |
| Switcher: Finished marker | **Finished** (a small neutral tag after the name; none on live seasons) |
| Switcher aria-label (rail menu button) | Switch season |
| Phone switch button aria-label | Switch season (symbol alone, 44 px, drawn chevron) |
| Phone season header eyebrow | Season |
| Phone header back arrow aria-label | Back to seasons |
| Registrations toolbar (phone) | + aria-label: Add a registration; Tools aria-label: Tools: Export, Email families |
| Registrations toolbar entry for the old modal (recommended, not drawn) | **Email families** (opens today's "Message registrants" window until 9d retires it). Titling the window "Email families" too. Same ruling reason as the row: one spelling for one act. |

## 8. Public labels (frame E)

Words on the league index, the club home's House league section, and the season page's own header chip (one function feeds all
three, so a season is never named two ways).

| Label | When |
|---|---|
| **Registration open** | `registration_open` |
| **Registration closed** | `registration_closed` |
| **Starts {date}** | `active`, today before the start date |
| **Playing now** | `active`, today inside the dates |
| **Final standings** | `active` past the end date; also the primary link on a completed or archived season's page ("Final standings →" exists today) |
| Past season rows | no tag (the shelf is the label); year, then links |

| Link label | Used on |
|---|---|
| **Schedule** | Playing now, Final standings, Past season rows |
| **Standings** | Playing now, Final standings, Past season rows |
| **Register** | Registration open rows (primary) |
| **Season page** | the second link on a Registration open or Registration closed row, and on Past season rows (today the index says "Overview", "View season" and "Overview"; one name now) |

| Group heading | String |
|---|---|
| Index: live seasons | **Running now** (replaces "Current season", which is wrong with two live seasons) |
| Index: finished seasons | **Past seasons** (kept) |
| Club home: live and open sign-ups | **Open now** (Stage 4's list, kept) and **House league** (kept) |

| Row line (club home, Open now) | String |
|---|---|
| Fee above $0 | Registration open · ${fee} per player (the drawn phone string said "$165"; same words at every width) |
| Fee of 0 | Registration open · Free |
| No fee stored | Registration open |

Retired public words: **"Season active"**, **"Season complete"**, **"Archived"** (as a chip on the index and season header; the
season page's own sentences, "This season has concluded." and "This season has been archived.", stay: they are accurate). On the
fallback home (`app/[orgSlug]/page.tsx`), "Season in progress — view standings and schedule" and "Registration closed — season
starting soon" give way to the same row words.

## 9. Code versus the drawings: what the status behaviour actually does

Argued from the code (each cited line read directly unless marked as a helper lead).

**What a status change does for families today**

| Change | What families see |
|---|---|
| draft → registration open | The season page, schedule and standings stop 404ing; it joins the index and club home; the form goes live (`app/[orgSlug]/league/page.tsx:46`, `[seasonSlug]/page.tsx:66`). No email. |
| open → closed | The form is replaced by "Registration is not currently open" / "Registration for this season has closed." (`register/page.tsx:87-97`); the API returns 409 (`register/route.ts:53-58`). No waitlist after closing. |
| closed → active | Label becomes "Season active" with a Standings button. Registration stays closed. No email. |
| active → completed | Listed under Past seasons; public page says "This season has concluded."; "Final standings →" button. No email. |
| completed → archived | Public page says "This season has been archived." **Still listed under Past seasons.** |
| any change | `updateLeagueSeason` only updates the row (`lib/db.ts:2454-2481`); nothing in the admin PATCH emails anyone; no cron reads league status. |

**Gaps between the code and what the drawings promise**

1. **Backward transitions do not exist.** `ALLOWED_TRANSITIONS` is a strict line (draft → open → closed → active → completed →
   archived); everything else returns 422 (`seasons/[seasonId]/route.ts:24-31, 122-130`). The drawings need "Reopen registration"
   and "Reopen a finished season" (and the owner ruled S2·b reopening). 9a must add the two backward steps (closed → open;
   completed or archived → active) to the one route, behind the Part 1 gate.
2. **"Activate season" is missing from the drawings.** The code's step between Close registration and Complete (closed → active)
   has no window and no home in frames B or D. Written as 4.4; the build needs a place for it (the lead action on a closed season).
3. **"Marked Final" is not true today.** The public standings and schedule pages carry no Final marker (`standings/page.tsx:65`
   titles every season "Standings"). The window therefore says the public site "lists it under Past seasons"; the drawn "marked
   Final" would need a build line in Part 5 that the build prompt does not have. The honest public marker that does exist is
   the "Final standings →" link on the season page, and Part 5's "Final standings" tag.
4. **Refunds do not exist until 9b-2**, but the drawn Complete window, the lock rule and Part 1's wording all promise them.
   9a's strings say only "mark fees received" (section 5).
5. **There is no unpaid-fee count.** `LeagueSeasonSummary` has divisions, active, waitlist, pending and team counts only
   (`lib/types.ts:1092-1099`); the drawn "4 players still owe fees" needs a derived count (active registrations with a fee above $0
   and not marked received). The drawn Money band's "Fees still owing" is 9b-2's and is not built here.
6. **Archive does not hide anything.** Complete and Archive both land in Past seasons on the public index and read the same to
   families except one sentence. The Archive window states exactly that (4.6).
7. **The dates do not run the form.** The register API ignores `registrationOpenAt` / `registrationCloseAt` (status only; 9b-1,
   S2·b). The drawn "Registration closes Aug 1, 2026" beside "Registration open" on a passed date therefore misleads; 9a shows
   "Registration was set to close {date}" in that case (section 1).
8. **"Waitlist open" shows on a full division in every status** on the public season page (`[seasonSlug]/page.tsx:187`),
   including closed, active, completed and archived, when nobody can join. Not drawn; a Part 5 neighbour. Gate the chip on
   `registration_open`.
9. **The home's amber waiting count and the admin hub tile disagree with the schema (helper lead, verified in the query).** The
   attention summary counts registrations with `status = 'pending'` (`app/api/admin/attention-summary/route.ts:57`); the table
   only allows `pending_review` (`supabase/migrations/020_house_league.sql:92-95`). That tile reads 0. The 9a home's count must read
   `pending_review`. Worth a fix of its own; outside this copy task.
10. **Status lookup works in every status** (no gate; helper lead, matches the route). The Close and Complete windows therefore
    say families "can still look up their status" (Close only; Complete does not repeat it).

## 10. What changed from the drawings, and why

| Drawn | Now | Why |
|---|---|---|
| Rows without a sport on 2027 (drawn inconsistently) | Sport always second | One pattern; the drawing's two rows differed. |
| "Registration closes Aug 1, 2026" on a passed date | "Registration was set to close {date}" | The date does not run the form (gap 7); the drawn line contradicts the pill. |
| "Teams" in the phone strip | "Teams & draft" | One page, one name. |
| "1 to review" (rail) and "1 registration to review" (home) | "{n} registration(s) to review" everywhere | One aria string. |
| Complete window: "and record refunds" | "mark fees received" only in 9a | Refunds are 9b-2 (gap 4). |
| Complete window: "marked Final" | "lists it under Past seasons, and its schedule and standings stay up" | Not true in the code today (gap 3). |
| Complete window had no completed-early warning | Added "Its end date, {date}, is still ahead." | Completing before the end is a loose end; warns, never blocks. |
| Complete window loose ends: reviews and fees | Added the waitlist clause | A family on a waitlist at completion is stranded. |
| Index heading "Current season" (today) | "Running now" | Two live seasons make a singular wrong. |
| "Overview" / "View season" links (today) | "Season page" | One name for one page. |
| "Season active" / "Season complete" / "Archived" chips (today) | Playing now / Starts {date} / Final standings / no chip | Q14: labelled by what is happening, not by an internal status. |
| Group empty state absent | "No season is running right now." for the first group only | The page needs an anchor when nothing is live. |
| Drawn getting-ready tip ("a division, a price, dates") | Three exact lines with done states | The build prompt's fields; "price" is the fee. |
| Seven windows | Start the season added | The status line has a step the drawings skipped (gap 2). |
| Start the season's lead "The season moves to Running now." (§4.4) | Built as **"The season starts."** (9a build, 2026-10-24) | A closed season is already under Running now on the home (§1 groups by status: open, closed and active are all Running now), so "moves to Running now" would say something that does not happen. |
| "Message registrants" window (unmentioned) | Entry labelled "Email families" in 9a | Same ruling reason as the row. Recommended, not asked. |

## 11. Genuine owner asks (only the ones the code forces)

**Answered 2026-10-24, all three as recommended** (recorded in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0c): Archive stays label-only and
is said plainly, its meaning is 9f's; Reopen registration only from Registration closed; Email families stays open on a
finished season (the Complete window gains "You can still email its families."; the composer gets no locked line).

1. **Archive.** Today it differs from Complete by one public sentence and hides nothing. Keep it exactly that in 9a (the ruling
   says Complete and Archive are rare doors), or give Archive a real effect in 9f (for example, leave the public index after
   some time)? Copy above assumes "keep, say so plainly".
2. **Reopen registration while a season is Playing now.** The status line has no such step, and 9a copy offers Reopen registration
   only from Registration closed. Late players are added by hand. Recommend: no. Say if a convenor should be able to take sign-ups
   again mid-season.
3. **Does a finished season's Email families stay open?** Part 1's wording ("refuses every write except fees and refunds") would
   lock the composer on a finished season, when late word to families is real (a banquet, a make-up game). Recommend: the composer
   stays open on a finished season (it changes nothing in the season). It is a gate decision, not copy.

Not asks (decided on merit, shown above): the six drawn windows, the checklist, the Past seasons shelf, the retired public words.

## 12. Checks

`npm run check:spelling` scans only `app`, `components` and `lib` (`SCAN_ROOTS`, extensions `.ts/.tsx/.js/.jsx/.css`), so it **cannot
check this docs file**; skipped. These strings enter the gate's reach when the build writes them into components. The words in
this file were checked by eye against the enforced list: no "instalment", no "financial year", no `Rep Teams` / `House League` /
`Public Site` capitalizations (the example season names "Dev House League 2026/2027" are the fixture's own data and take
`spelling-ok` if a build copies them into a string), no clock time with "AM/PM".
