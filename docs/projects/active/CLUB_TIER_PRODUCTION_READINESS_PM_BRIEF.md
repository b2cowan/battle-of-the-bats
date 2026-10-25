# Club Tier Production Readiness — PM Brief

> **Companion plan:** [CLUB_TIER_PRODUCTION_READINESS_PLAN.md](CLUB_TIER_PRODUCTION_READINESS_PLAN.md)
> **Written:** 2026-09-25 · **Priority:** High — this is the next product programme after the Coaches Portal.

## What it is

A staged programme that takes the Club plan from "built but never tested" to "a rep club can buy it,
set it up, staff it, run a season on it and trust the numbers it shows the board." It is organised
so each part of the Club offer is tackled, walked and signed off one at a time, in the order a real
club meets them, with house league deliberately last. ⚖ Since 2026-10-12 house league is inside the Club release (the
owner: every part of this project ships before Club goes on sale, or is cancelled).

## Why it matters

- Club is the top of the pricing ladder and has **never been validated against one real club**.
  Every Club pricing decision made in June is still a hypothesis.
- The club-admin side of the product has been effectively **static since June** while the Coaches
  Portal received three months of intensive work. The two halves now disagree about money, seasons,
  venues and who can do what. Coaches are on a hardened, tested money model; the club treasurer is
  not.
- The last audit of the club president's journey (June, 50 findings) found the oversight layer
  "part broken and part unguarded". Today's re-verification shows most of those findings are still
  open, and several new ones have appeared where the coach portal moved on without the club side.
- Commercially, every coach in a club is on a free Premium portal until September 2027. A club will
  pay $219 a month only for what the **club side** gives it: honest books, board oversight, a public
  face, families, one venue book. That is exactly the side that has never been QA'd.

## What the club sees and does differently when this is done

**Buying and setting up.** A club owner can be provisioned (or buy) onto Club or Club · Association,
sees the right price and trial, is walked through a club-shaped setup (not a tournament one), and
lands on a hub that leads with the club's own programs. Cancelling and coming back restores
everything, as the billing page already promises.

**Staffing the board.** The owner invites an admin who can actually see the club's modules, a
treasurer and a registrar, from the Members screen, with roles that mean what the screen says. A
volunteer who also coaches at another club can be invited.

**Teams and coaches.** The owner creates teams and program years, names coaches, and each coach lands
in a populated Premium portal at no per-team charge. Starting and closing a season means the same
thing on both sides. The president gets one oversight view of every team: coach in place, roster
size, next event, documents complete, money owed.

**Money the board can repeat.** The treasurer plans a budget for the club's year, allocates to teams,
receives and approves coach requests with a confirmation and a way to reverse a mistake, and reads a
single board summary whose every figure is true by construction and guarded by the same kind of build
check the coach money screens already have. Team money and club money are two clearly separated
things, and the club reads the coach's records rather than keeping a shadow copy.

**A public face that leads with the rep program.** Families find the club's teams, open tryouts and
the club's colours on the club's page. The "tryouts are open" card takes them to the tryout, not back
to the home page. Unlisting the club from the directory no longer takes down its whole website.
The club runs that site itself (Stage 4c-1, built 2026-10-21, walk §357): it chooses which home sections
show and in what order, writes its words and contacts with the editor saying why a link was refused,
lists its documents, policies and families' questions on an About page, and posts a one-line notice
("All diamonds are closed tonight") that shows on every club page and ends by itself — without asking
anyone. Success: a club volunteer can post a field closure from a phone in under a minute, and no
saved link on a club's site is one the editor refused.

**The teams' side (Stage 4c-2, drawn and ruled 2026-10-22; Part A, the club's side, committed `2fcf5efdd` 2026-10-22 and its walk (§360) owed; Part B, the coach's side, next:
https://claude.ai/artifact/2HDwoGLtFS8ACuq2CuSbNn).** A **parent** sees each team's birth years ("Born 2012–2013") on the
Teams page and the tryout page. Before sign-ups open they can already read what a tryout costs and who may come. They can
write to the person running that team's tryouts, with the address copyable on a phone. A **head coach** can give their team's
tryout page their own tryout address, never their sign-in. It comes off by itself if they stop being head coach. They are
told, beside the tryout days, that those days are public before sign-ups open. A **club admin** types each team's birth years
once (they roll forward a year with the season) and writes the tryout blurb on the team's Tryouts page. They can always see
which address a tryout page shows and put the club's back. Success: a parent answers "which team is my child?" and "what does
it cost?" from the tryout link alone, and no tryout page shows last year's years or a departed coach's address.

**Families.** Household records read the same money the Money hub does, a changed guardian email
follows the child, a merge stays merged, and the family export says honestly what it contains.

**One venue book.** Rep, house-league and tournament games read the same venues, and a diamond
double-booked across two programs, or between two of the club's own teams, is flagged.

**Tested and documented.** A Club test fixture and browser suite, admin screens in the layout sweep,
help articles that describe today's screens, and marketing copy that promises only what exists.

## Who benefits

- **Club owners / presidents** — the buyer. Club and Club · Association plans.
- **Treasurers, registrars, admins** — the board roles the plan sells but the screen cannot assign today.
- **Coaches in a club** — their portal stays as it is; what changes is that the club side stops
  contradicting it (seasons, money, venues).
- **Families** — a club page they can use, tryouts they can find, messages that reach the right guardian.
- Standalone Premium coaches are unaffected.

## Stages (each is its own owner mockup session + QA walk; detail in the plan)

| Stage | Outcome | Gate |
|---|---|---|
| 0 · Ground truth | A seeded Club fixture, the first end-to-end walk, the six "dead control" fixes, and two owner rulings (team money's source of truth; the club's year) | Every club screen opens for owner, admin and treasurer without a 401, 404 or loop |
| 1 · The club shell | Provision / buy / cancel / return; board roles assignable; club-shaped hub, nav and phone bar; onboarding checklist; audit log; settings that say what they do. **Two halves (2026-09-25):** the behind-the-screens work runs now; the screens are redesigned out of sight and reach customers on the new admin design's release day | Owner walk |
| 2 · Rep teams & the coach bridge | Team → coach → portal flow; season lifecycle agreement; documents; tryouts; oversight rollup; Shared Book walk | Owner walk |
| 3 · Club money | 3a bookkeeping core + allocation/request loop with confirm + reverse · 3b budget, Budget vs. Actual and the whole-club summary, with arithmetic gates · 3c the club year and year-end · 3d the last money pages become windows (Payees, an allocation) | Owner walk per part; gates green |
| 4 · The public face | Teams index, tryout funnel, club-first home, editor controls, marketing truth, and (4e) a club's own web address. **Drawn and RULED 2026-10-19 (all 17 asks as recommended)** (https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k): a family's first phone screen shows what is open now and the club's teams, in the club's colours; one plain refusal replaces a system error; round 2 adds a field-closure notice, one Tryouts page, born-in years, sponsors and an About page. **4e hosting spike 2026-10-23:** our host can carry each club's own address at no per-club cost (proven on a test domain, live in under five minutes), subject to AWS raising a five-domain limit (request filed, pending); a club connects `www` and forwards its bare name (`CLUB_TIER_STAGE4E_HOSTING_SPIKE.md`). **4e drawn 2026-10-23, all seven asks ruled as recommended the same day; built on dev, and a real club address was connected end to end on 2026-10-25 with every step passing (40 of 40)** (https://claude.ai/artifact/QiwFeccoRW5XmAnPwfDuVa): the **owner** opens a new *Web address* row on Public site, types the address, copies two records to wherever the club bought it (or sends them as one message to whoever holds that sign-in), and is emailed when the site goes live; months later a dated warning if a record is removed. An **admin** reads every state and can copy the records (ask 2). **Coaches** notice only that their copy-link lines hand out the club's address. **Families** do nothing: old links and posters forward. No support ticket at any step, where every peer has one. **Not yet on production:** the club-address keys and the scheduled status check are production steps still to do, and AWS's 500-domain request is pending | Owner walk |
| 4f · A Tournaments tab (added 2026-10-24) | **A family** on any club page, a team page included, sees Tournaments in the club's top row and reaches what is on now, coming up and finished in one tap (today it is only a section far down the home page). **An owner or admin** shows or hides it with the Tournaments switch they already have in the Public site editor; nothing new to learn. **A club whose plan does not carry tournaments** sees no change. Recommended shape: one tab holding on now and past, because six tabs do not fit a phone or a 1,024 px laptop window. **Drawn and RULED 2026-10-25**, all seven asks as recommended; Past tournaments becomes a sub-option of Tournaments, only while Tournaments is on (https://claude.ai/artifact/1nytYV7uYwY56eg6iM7h6K). Words approved and BUILT 2026-10-25: one Tournaments page, current and upcoming then past; the old Past tournaments address forwards to it; a sealed tournament shows once, as its archive record (owner's call). Success: no tab runs off the row; every finished tournament is on a list | Owner walk §374 (https://claude.ai/artifact/QqB3H2Z88QSvkJxTgCLgJn) |
| 5 · Families | 5a the record is true (the four serious defects and five more) · 5b the screens · 5c a received payment and staff notes · ~~5d household money~~ (cancelled 2026-10-19) | 5a + 5b on production 2026-10-18, walk §329 ✅; 5c walk §345 ✅ 2026-10-19, reaches production with the next promote |
| 6 · Venues, scheduling, permits | One venue book + one clash check across programs and between the club's own teams; the club calendar (in the first release, D5); the Venue library fixed; room left for permits (Stage 10) | Ruled 2026-10-08 (thirteen asks, as recommended); build 6a then 6b |
| 6c · One calendar (added 2026-10-09) | Every calendar in the app compared side by side on a computer and a phone, one written recipe for how a calendar reads, a list of where screens differ on purpose and why; the coach's desktop schedule (opens on today, a Month that says what and when) drawn inside it | Walked 2026-10-11 (§289 ✅); ⚖ inside the Club release since 2026-10-12, like every stage |
| 6d · Calendar feeds (added 2026-10-09) | A coach subscribes once and their calendar stays current; a family subscribes from the team's public page; a club admin keeps the club calendar in their own calendar | On its own (owner 2026-10-11: no longer before Stage 11); **drawn and ratified 2026-10-11** — the first build is the coach's feed and the team's public feed, with cost controls (the club admin's feed deferred; the family view waits for counsel); **built and committed 2026-10-11** (`fb6c14dd` · `97868569` · the doors; the owner adds one production setting before the promote); on production 2026-10-13, walks §298 ✅ closed 2026-10-16; ⚖ inside the Club release since 2026-10-12 |
| 6e · The event form's last corrections (added 2026-10-09) | The coach's add/edit form: the few corrections the schedule deep dive found that the 10-09 rulings haven't already settled | Not drawn; fills any gap; ⚖ holds the release since 2026-10-12 |
| 7 · Tournaments in a club + comms | Host-own-team walk; tournament money into the books (decision); one "message every family" door; the Coaches Portal's Tournaments pages given a proper phone pass (from the schedule deep dive). **Drawn 2026-10-20, 13 asks open** (https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ): a club enters its own teams in one step; a paid fee writes itself into the tournament's own book and Budget vs. Actual answers "did it pay for itself?"; an admin can email every family once; the coach's tournament page is named for the tournament and works on a phone | Owner rules the asks, then walk |
| 8 · Release readiness | UAT suite, layout sweep, help, demo decision, pricing gate flip, Stripe checkout, support posture | Go/no-go |
| 9 · House league (last) | Trust-plan defects; un-park League Plus as the standalone plan; coupling check | ⚖ Inside the Club release (owner 2026-10-12) |
| 10 · Permits & bookings | The club records the permits it holds; scheduling and money read them; a coach enters their own team's permits and the club sees them (added 2026-10-11, inside the release 2026-10-19) | Club permits on production 2026-10-13, walk §296 ✅; coach-entered permits still to draw |
| 11 · The club's schedules (added 2026-10-08) | A scheduler: parameters in, a draft out, adjusted by hand, finalized, kept as a named schedule, summarized and sent | Ruled 2026-10-08; drawn with Stage 10; the release waits for it; League Plus and both Club bands |
| 12 · Payments processing (added 2026-10-19) | Families pay online when they sign up for house league, and teams when they register for a tournament, by card or bank debit; the club nets the full fee and the payment lands in its books; offline payment kept. Built on the July 2026 payments decisions | ⚖ Inside the Club release; counsel sign-off before any live charge |
| 13 · Navigation across the three portals (added 2026-10-20) | The club, the tournament and the Coaches Portal checked together on a computer and a phone, club first: what each area's menus show when you step from one area into another and how you get back, the same door under the same name on both devices, and the club's menu at its full length. One standard everywhere; a difference stays only when it has a written reason | ⚖ Inside the Club release; the last stage before the go/no-go |

**Stage 1, the behind-the-screens half — built 2026-09-25.** A club's admin now opens every
program the plan carries, and a treasurer's allocation wizard lists the club's teams. The board can
be staffed with real roles, and someone who coaches, or sits on a board, at another club can join
(only a scorekeeper keeps one home club). Invitations say who is asking and what the role opens, and
a failed join says so and retries honestly. A club's coaches meet a plain wall when the club's plan
stops including their portal. On billing: a Club never carries the Founding Season offer; a paying
club moves between the two Club sizes on the one subscription it has (up now at Stripe's quoted
price, down at renewal, refused while it has too many teams); and coming back after cancelling
restores everything. All of this was verified against Stripe's sandbox. The club's
redesigned screens (the second half) are built on top of this and reach customers on the new admin
design's release day.

**Stage 2 — drawn and ratified 2026-09-28 (hub v15, all eight asks ruled); the screens built and
committed 2026-09-29 (session 3, `00865a6d`) on top of session 1's server half and session 2's team move.** What a
club gets: a Rep Teams page that works as a health board (one row per team: its season, its head
coach, its roster, what's next, and red where only the club can fix something); a team page where the
club edits the team and runs its seasons with the same *Start next season* / *Close* / *Reopen* doors a
standalone coach has, carrying the roster, budget plan, fee plan, opening balance and player history;
one "Invite a coach" door that works between seasons and emails the coach, who lands on a team that is
already populated; tryouts that always belong to the team's live season; one table of document
templates; and a plain-words page for bringing a coach's own portal into the club. The first ruling
matters most: the drawings recommend **one season model for club and standalone teams**, because the
plan's alternative (next season as a draft beside the live one) would either move a coach's whole
portal to an empty season mid-year or hide the tryout from the coach who runs it.

**The Stage 2 screens, as built (2026-09-29).** A club owner opens Rep Teams on one table — every
team's season, head coach, roster, next event and signed documents — with the only red being what the
club alone can fix: a team with no head coach, or a season running with nobody on it. Each team has a
page: its details (they save as you type), its seasons with *Start next season* / *Close the season* /
*Reopen*, and its coaches. *Invite a coach* asks for an email and whether they're the head coach or an
assistant; the coach gets the email, lands in a working portal with a one-time welcome, and the club
hears the answer either way (a coach who already has an account can answer from their Home page). The
club reads each team's tryout applicants and makes the same calls the coach can; roster and schedule are
read-only, in the club's own time. Document templates are one table, each reaching every team or one
team. On the coach's side, a season the club starts or closes is announced in the portal, and a save
refused because the club just closed the season now says why and offers that season's page instead of a
bare error. Why it matters: before this, a club could not name a new head coach without making them a
board member, could not start a team's next season at all, and saw rosters that added up every season a
team had ever played. Success = the owner's ten Stage 2 walks pass (ledger §249 and §250). Trade-off
taken: the club's pages follow the Coaches Portal's look exactly, so a few older admin pages beside
them still wear the admin's own table style until the design programme reaches them.

**Stage 2 — success met 2026-09-29: all ten walks passed.** The owner's walks raised three small
things, each changed the same day: a row on the club's tables now opens from anywhere on it, not
just the team's name; a team's details say "Saved" in the same floating pill the Coaches Portal
uses, so a failed save can never scroll out of sight; and the reference number a family gets
when they apply for a tryout now shows in the club's applicant window and finds the player in the
coach's check-in search — before, a family could quote it and nobody could match it. Two ideas were
parked for a later drawing: taking *Team groups* and *Rename team URLs* off the Rep Teams toolbar
(groups also limit which teams a director can see, which the page never says). The three changes are
committed. Before release: the stage's two database changes go to production first.

**Looking like one product (owner direction, 2026-09-28).** The Coaches Portal is the formatting benchmark
for every club screen, and by the end of this programme the product has one written formatting standard,
with every exception named. The Stage 2 drawings were redrawn to it the same day. Table cells carry no
action links, headings, numbers, cards and phone lists follow the portal's rules, and a "Formatting check"
page on the hub records what changed. The club admin's navigation groups its pages differently from the
portal's; that is noted for a nav review before release.

**Bringing a coach's own team into the club — built and committed 2026-09-29 (Stage 2, session 2),
not released.** A coach who already runs a team on their own Coaches Portal can now bring it into a club,
whole: its seasons, roster, schedule and results, practices, lineups, attendance, awards, development,
tryouts, documents and money records, and its staff with what each of them can open. Either side asks —
the club from Rep Teams › *Bring in a coach's team*, the coach from *Join a club* — and the other side's
yes moves the team there and then, after typing the team's name. There is no FieldLogicHQ step any more.
Before anyone agrees, both sides read what it costs the club (one team place, included in the plan),
that the coach won't be charged for their own portal again, and that it can't be undone. Before this,
the move ended with a FieldLogicHQ operator and left most of the team behind, so a coach arrived in the
club locked out of their own team. A build gate now lists every table that carries a club's id and
fails when a new one isn't accounted for, so a table added next year can't be left behind silently.
The database change must reach production before the release that ships these pages.

**Stage 3a — club money, the day-to-day loop: drawn 2026-09-30 (hub v20, redrawn the same day in v22 to
match the coaches portal's Money page), all six questions ratified the same day as recommended.** **Both halves are built (2026-10-01): the server committed and reviewed, the screens built and reviewed, the help rewritten. Six walks (ledger §255) are ready on the hub once the test club is rebuilt.** It needs one database change applied to production before it ships, because nearly every coach money action now relies on it. What changes, by person. **The treasurer**
does the whole loop in Accounting (the allocation and payment-request pages used to sit in Rep Teams, which
sent a treasurer away), and Accounting is now one page with tabs, exactly as the coach's Money page is —
Overview, Ledger, Allocations, Payment requests, Budget, Budget vs. Actual — so every money page is one tap
from every other on a phone. Old links still land on the right tab. An admin who holds Rep Teams but not
Accounting no longer sees the two money pages. The ledger reads the way the coach's Ledger reads and names the team
on every club line; the allocations list names the
teams, shows what was allocated, collected and outstanding, and says in words which teams are late; a
payment is recorded with its date, method and reference after a question, and can be undone with a reason
both sides read; a coach's request shows the coach's own words and whether they filed it as new money or
money back, and approving asks first and can be reversed. Reminders go to the team's head coach, late
installments included, after a preview that names every recipient. **An admin with Accounting** does the
same work under the same rule. **A head coach** stops writing into the club's books: they tell the club a
payment is sent, and the club confirms it arrived. They are told when the club records, approves,
declines or takes something back, and their season's figures follow at once. Why it matters: today one
click moves club money with no question and no way back for the club, while a coach can take back a
payment the club itself recorded; "overdue" is never shown on the page that exists to show it; and a
waiting request quietly holds up a team's end-of-season payout to families without the club ever knowing.
Trade-off proposed: a team's page in Accounting becomes the team's account with the club (billed,
received, outstanding) rather than a line-by-line copy of the coaches' books. The copy's balance is close
to the team's cash but not equal to it, and the team's own figures arrive with 3b's summary. Success = the
3a walks pass and every figure on these pages has one definition, held by a build check. Left to 3b: the
Accounting overview's totals, Budget, Budget vs. Actual and the board summary. Left to 3c: the club's
own year. Left to Stage 7: tournament fees in the books.

**Stage 3b — the budget, Budget vs. Actual and the board summary: drawn 2026-10-05 (hub version 36,
Mockups → Stage 3b; the month-by-month view added 2026-10-06); all nine questions ratified 2026-10-06; session 1 built (below).** What changes, by person, if the drawings are
ratified. **The treasurer** plans the club's year the way a coach plans a season: revenue first, then
spending, with a line billed to the teams as many times as it needs (today a second bill from one line is
refused and the rest is stranded), and next year one pick away. Budget vs. Actual finally has an actual
for every line — today it has none and promises "a future update" — read the same way the coach's is:
Collected, Spent, Off-plan and Cash on hand across the top, then the statement. It also gets the coach's month-by-month view, ending each month on what the club held, because a club pays its big bills first and collects from the teams months later; the budget can be laid out by month the same way. Bank reconciliation is left for its own project, for both the club and the coaches. **The president** gets
the one page they would show the board, on the Overview tab: where the club stands today (its own cash,
what the teams owe it, what waits on the club), how the year is going against the budget, and each team's
standing, with the team's own cash shown beside it, labelled as held by the team and never added into the
club's figures. Today the Overview's four figures add every book together, the teams' included, so the
club's "net position" counts money that belongs to the teams. **A head coach** sees one new sentence on
the Club tab saying what the club can read of the team's money (its cash on hand, and what it paid shared
payees) and what it never reads. Why it matters: a club board asks "how much money do we have, and are we
on budget?", and today the screen that should answer gives a wrong total and no actuals. Trade-off
proposed: club spending is matched to the budget the way a coach's is, by budget word, rather than the
per-line link this plan first wrote; that keeps the two sides reading alike, at the cost of old club
lines showing "Not filed" until someone files them. Success = every figure on these pages has one written
definition held by a build check, the walks pass, and a treasurer can hand the board report to the board
without explaining any number on it.

**Stage 3b, session 1 (the server half): built and committed 2026-10-06 (26277b5f), on the test system, not yet released.** Nothing
a treasurer sees has changed yet; the new pages come with session 2. What now works underneath them:
spending can be filed under a budget word and is matched to the plan that way; a budget line can be
billed to the teams as many times as it needs, but never for more than is left on it; the plan carries
revenue as well as spending; and Budget vs. Actual, the month-by-month view and the board summary all
read the same figures, each written down once and held by a build check. Each team's own cash is read
from the coach's books and is never added into the club's money. Someone limited to some team groups
sees the club's totals, but never the names of teams outside their groups. Two calls were made on the
way. Money the club pays a team on request is filed under one fixed word, "Team support", rather than a
word each club invents. An unpaid installment stays in the month it was due. Until session 2 replaces
the old screens, the ledger shows every older line as "Not filed". That is the agreed no-backfill
behaviour. Nothing reaches a real club before release: Club is not on sale, and production has no club
budget lines. The database change must reach production before this code does.

**Stage 3b, session 2 (the screens): built on the test system 2026-10-06; the owner's walks (ledger
§271, eleven short walks on the hub) come next.** What a treasurer now sees:
- **The Budget** reads like a coach's: the year, revenue first, and beside each cost what the teams were
  billed and have paid. A line opens to read, the pencil changes it in place, and "Allocate" bills what
  is left on it. Next year starts from this year's plan in one press.
- **Budget vs. Actual** is the coach's Statement and month-by-month view on the club's year. Every
  figure opens the plan line or the ledger lines it is made of.
- **The Overview is the one page for the board:** where the club stands today, the year against the
  budget, each team's standing, and the club's books, with one export, the board report. Each team's
  own cash is shown and labelled as the team's, and is never added in.
- **Every new ledger line is filed under a budget word**, which is what lets the club's spending meet
  its plan.
- **A payee the club shares with its teams** has a report of what the teams recorded paying it.
- **A coach is told, in one line on their Money › Club tab,** what the club can and cannot see.
- **On a phone, every month grid**, coach and club, opens on the current month.

The old Budget, Allocate and Budget vs. Actual pages are gone. Success: the eleven walks pass and the
figures on every page agree with each other, a check the build already enforces.

**Stage 3c — added to its drawings 2026-10-07 (the owner, during the §271 walks): billing the teams from
a budget line, redrawn.** Today "Allocate" takes the treasurer out of the line's window to a separate
three-step page in an older style, and creating the allocation lands them on yet another page; to see
the result they find their way back to the Budget and reopen the line. 3c draws it again, with two
options: allocate inside the line's own window on one screen (recommended), or a one-screen page that
brings the treasurer back to the line. Either way it takes the Coaches Portal's format, and the same form
sits behind New allocation on the Allocations tab. Why 3c: 3c changes this form anyway (which seasons it
offers, the year's name), so it changes once. Success: a treasurer bills what is left on a line without
losing their place.

**Stage 3c — the club's year: drawn 2026-10-07 (the hub, Mockups → Stage 3c) and ratified the same day,
every question as recommended. One word added at the owner's question: the club's year is its "fiscal
year"** (the board's own word; the club side only — coaches keep "season"). Build prompts written: a server
session, then a screens session. What changes, by person:
- **The treasurer, the first time.** One window, "The club's year", behind the Budget's Tools: the month the
  club's year starts and its name ("2026–27"). A new club meets it on its first, empty plan. A club that
  already has a plan sees exactly what changes before saving: the year it is in keeps its months, the next
  one is short, and planned lines past that short year's end move to the next plan.
- **Every money page** prints the year's name, starts on the year's first month and opens on the year the
  club is in. Today the year is worked out by hand in about a dozen places; the build makes it one.
- **At the end of a year.** Once a year has ended, the Overview says so with one button. Closing asks one
  question that lists what is still open (money the teams owe, requests waiting, lines not filed, cheques
  not cleared), warns and never blocks, and says what it locks and what carries. A closed year is read
  where it already is, through the Year pill, with nothing to change; a line dated into it is refused in
  words; the latest closed year can be reopened, with a reason that is kept.
- **The year that opens** starts on last year's closing balance, locked. What was still owed stays last
  year's bill and is listed on the new year's Overview until it is paid.
- **The annual meeting.** Budget vs. Actual can compare the year with last year, and the Overview's Export on
  a closed year prints the year-end report: the year at a glance, the statement against budget and last
  year, the club's books at both ends, the teams' standing, and what carried.
- **Two windows the owner sent to 3c.** Billing the teams happens inside the budget line's window on one
  screen and comes back to the line; a shared payee's window reads first with what the teams recorded paying
  it inside it.
- **A head coach:** nothing about the club's year reaches the portal. One question for the owner: a club
  bill still owed when its season rolls over disappears from the coach's Club tab today; the drawing keeps it
  there, under the season it was made on, until it is paid.

Why it matters: the board's papers stop moving once they are printed, and the treasurer's year matches the
club's real year. The biggest question is the first: a coach's finished season is one page by binding
ruling, and the recommendation reads a finished club year in place instead, because only the money tabs read
a year and they already do. Success: a treasurer closes a year, prints its papers, and the figures the board
reads are the figures that stay.

**Stage 3c built 2026-10-07 and committed 2026-10-08** (the server half, then the screens; both reviewed, the screens' words settled by /marketing). The owner's eleven walks
are on the hub's QA tab (§283); the one that proves it is done makes an allocation from a budget line and
reads it back. One question for the owner came out of writing the walks: comparing a year with last year is
offered only once last year has money recorded in the same months. That keeps a club in its first year on
FieldLogicHQ from seeing a column of zeros that reads as growth, but it also means the comparison appears
part-way into a year rather than on its first day. Recommended: keep it.

**Stage 3d — added 2026-10-08 (the owner, after the §283 walks).** The last two club money pages become
windows, as the coaches portal's already are. Payees opens over the Ledger instead of leaving it, and an allocation opens
as a window that reads first, instead of a page of its own. A team's account stays a page: it gathers one team's
bills, requests and history in one place. Why it matters: a treasurer stops losing their place, because every money
record opens where they are, the way coaches already work. Priority: after 3c's last two walks; drawn first,
ruled, then built. Success: from the Ledger and from Allocations, nothing sends the treasurer to another page to
read or change one payee or one allocation.

**Stage 3d — drawn and ruled 2026-10-08, every recommendation accepted.** On the hub (Mockups → Stage 3d), with the test
club's real figures. Reading the code first changed the picture in three ways. An allocation can be opened from ten
places, not five. Nothing about an allocation can be changed once it is made: not even its name, and the note New
allocation asks for is never shown again. And the payee picker's "Manage payees…" throws away an entry being typed.
The drawings recommend: Payees opens over the Ledger, and a payee opens inside it. An allocation reads the bill first,
in a window over wherever the treasurer was, and only its name and note can be edited. A team's bill opens one level
inside its allocation. Every door follows one rule: the window opens where you are, and closing it puts you back there.
"Manage payees…" opens over the entry and returns to it with the typing kept. A team's account stays a page. Changing
a bill's amounts or teams after it is made stays out of 3d. And, on the owner's look at the drawings, a money
record's figures sit in one connected strip, as every money summary in the product now does. What a head coach sees:
nothing changes. Next: one build session (no database change), whose walks open Payees and an allocation from every
door, on a phone too.

**Stage 3d built 2026-10-08 and committed 2026-10-09; the owner's eight walks are next.** Payees now opens over the Ledger, from
Tools and from inside an entry being typed, and the entry comes back exactly as it was. An allocation opens as one
window from all ten places that show one, over wherever the treasurer was, and closing it puts them back there. It
reads the bill first; its name and a club note can now be changed, saving as you type; a team's bill opens inside it.
An allocation that counts in a closed year reads in full but can't be renamed, and a late payment can still be
recorded on it. Old bookmarks and notices land on the new windows. One thing the drawing said was wrong and the build
says it honestly instead: renaming a bill renames it on the teams' Club pages and on both Ledgers, not only on the
teams' pages. A head coach sees the new name; nothing else changes for them. Eight walks are on the hub's QA tab
(§285); the one that proves it is done opens an allocation from every door and closes back where it started.

**Stage 5 — Families: walked 2026-10-16, drawn as the finished screens and ratified 2026-10-17 (the hub,
Mockups → Stage 5, P1–P5, each change marked 5a or 5b; every question as recommended). Built in two sessions:
5a, then 5b; the owner walk follows 5b. 5a BUILT 2026-10-17** (the review also closed a hole: a family-portal claim a
coach declined could have made the claimant the family's contact — claims now count only once approved; a member limited
to some teams can no longer be given Families; the message limit reads "three in any 24 hours"; recommend a lawyer reads
the family file's statement before Club goes on sale). The club's family records are on production but no real club can reach them yet (only the
demo club carries them, and it has never opened them), so the four serious defects are fixed in Stage 5's first
build rather than in a hurry. After that build (5a), which keeps today's look: a family's money reads exactly what
the team's own Money hub reads, so a part payment counts (today the test club's families show $750 paid that their
team's book shows as $0); a merge stays merged; a changed guardian email takes the child with it; "Message this
family" opens the same send window every club send uses, says who it reaches, sends replies to the person who wrote
it, allows three a day and keeps only the date and the sender; and the export is a PDF a parent can read that says
exactly what it holds and what it does not (coaching records stay with each team). The walk also found that the area
opens on a list the club cannot act on: since Stage 2 only a team's coach can type a child's guardian, so every "no
family on file" row on a rep team is a dead end; 5b has the row say who adds it and lets the club ask the coaches.
**5b** redraws the screens to the portal's standard (one page with tabs, a family opened over the list and stepped
through with Previous · Next, a duplicate rule that stops proposing real co-parents and lets the reviewer pick which
record survives). **5c** brings record-a-payment, internal notes and the staff match; the second guardian waits for the
guardian portal. **5d, household money (sibling discount, assistance, a payment plan, moving credit), was cancelled by the
owner on 2026-10-19.** A rep team already lowers one player's fee in its own book, and house league is one flat fee, so
the club needs no household money tools. Stage 5 ends at 5c. A treasurer or a
team-limited staff member sees nothing new unless given Families, and a team-limited member can no longer be given it;
a head coach sees nothing different. Families' owner walks (§54 and §56) run once, after 5a and 5b.
**5c walked and drawn 2026-10-19 and ratified the same day, all ten questions as recommended (the hub, Mockups → Stage 5c);
build prompt written.** The first question decided the rest: recording a rep payment writes into the team's own book, which
the club has never been allowed to write, so the club records only its own money (a house-league fee) from a family's record and passes a rep payment it
receives to the team's head coach, who records it with one press in their own book. Families also gets staff notes (signed,
dated, never shown to the family, listed in the family's file); the "also on staff" match is cut, because nothing would use it,
and the coach's private note about a player leaves the family file. A treasurer sees nothing new; a head coach gets a "the club received a payment" notice with Record it;
a family receives nothing new. Found on the way: the family file carries the coach's private note about a player, which its
own wording says it does not.
**5c BUILT 2026-10-19 — the walk is §345. ✅ Walked the same day: all 34 steps passed.** What a club admin now sees: on a family who owes, **Record a payment** beside Message
and Export. One window takes the amount received and spreads it down the children who owe: a house-league fee is ticked and
recorded in the club's books at once (the same tick as Registrations); a rep child's share goes to the team's head coach, and
the child wears an amber "Sent to coach" tag until the coach records it (the family's money figures then move) or says it
never arrived (a red "Not received" tag, and the sender is told). The head coach gets a "Your club" notice and an email:
**Record it** opens their own Record money already filled in; **Not received** asks once. **Notes** follow Children: signed,
dated, newest two then Show all; the author edits, the author or the owner deletes; a merge keeps them; the family file lists
them — and no longer prints the coach's private note about a player. Why it matters: the club can take a family's cheque
without ever writing into a team's own book, and the coach's book stays the one source of truth. Trade-offs: a single note
opens in the standard 640 record window (the drawing had it narrower); a head coach's answer is one press, but the club
cannot record a rep payment itself — by design. Owed: a layout check, counsel's
read of the family file's changed wording, and migration 338 on production with the promote.
**5b BUILT 2026-10-17 — the walk is §329 (ten walks, hub QA tab, Stage 5). ✅ Walked 2026-10-18: all ten passed (one fix on the way: a house-league fee now counts in the family's money line, re-checked); what's left is a lawyer's read of the family file's wording.** What a club admin now sees: Families is
one page with two tabs (Families, Duplicates — with a waiting count on the tab and the menu); one Show pill picks the
list, each with its count; a family opens over the list, says where it sits ("Owes money · 1 of 5") and steps to the
next with Next; its money is one band and each child once; the explanations that used to sit under every card live in
Help. "No family on file" groups children by team, says only a team's coaches can add a rep child's guardian, and Ask
the coaches emails each head coach their players (with a notice in their "Your club" list — informational, not Needs
attention). On Duplicates the admin chooses which record survives, and the rule now proposes only real look-alikes:
UAT Rep Club, whose seed reuses children's names, went from 212 proposals to 0. The Members screen says why a team-limited member can't be given
Families. Departures: Search narrows the list on screen (to find any family, pick All families first); on a phone the
Show list drops under the pill rather than rising as a sheet (a shared control — owner call); "Not the same person" on a
group of three separates all three.

**Stage 6 — venues, the clash check and the club calendar: drawn 2026-10-08 beside 3d, all thirteen
questions ruled as recommended the same day.** On the hub (Mockups → Stage 6), drawn for four people. **A head coach in a club** finds the
club's diamonds at the top of the place picker they already use, picks a diamond from a list, and sees one amber
line before saving: "Diamond 2 is booked by 14U AA practice, 5:30–7:30 p.m." It never stops the save. **The
house-league scheduler** sees the same line when a rep team already holds the diamond. House league's own rule
against two league games on one diamond stays, and it now says so under the field instead of in a pop-up after
Create. **A tournament director** gets the same line later, through the tournament redesign's schedule and setup
stages, which these drawings are made for. **The club admin** gets a read-only club calendar (every team, house
league and the tournaments, with clashes marked) and a Venue library that the league admin can save to, that says
who books each venue, and whose Delete becomes Archive once a venue is in use, so no booking ever loses its place.
**A coach outside a club sees nothing new.** Reading the code first widened one thing: the first release is for a
rep club with no house league, so the clash it actually has is two of its own teams on one diamond, and the check
covers that. On the test system the case is already visible: the public coach demo books its 10U and 12U onto the
same diamond every week, and nothing has ever flagged it. Why it matters: a club finds a double-booked diamond on
the screen, before two teams meet at the gate. Priority: it comes before the tournament redesign's last two stages,
which draw against it. It is built in two parts: 6a, the venue book and the clash check; then 6b, the calendar and
the Venue library. Success: every way an event lands on a diamond, in every program, warns about the club's other
bookings, and the club can see a week of the whole club on one page. **Added the same day, at the owner's
request:** one way to enter where an event is, on every form. Today a coach types a place and hunts for the diamond
under More, while house league and tournaments pick from one list of "venue — diamond". The recommendation is two
fields everywhere, Venue and then the sport's word (Diamond, or Court for basketball), so a coach, a league
admin and a tournament director fill in the same thing the same way. **6a was built on 2026-10-08** (on the test
system; not yet released). A head coach in a club now picks the club's venue and its diamond from two fields side by side,
sees the amber line before saving, and sees each clashing date marked when repeating a practice. A tryout day takes the
same two fields and joins the check too (the owner's call at the start of the build). House league's windows say their own
refusal in red under the field, before Create, and show the amber line when a rep team holds the diamond. Every way a
tournament game is placed now reports the club's other bookings for the tournament redesign to show. A coach outside a club
sees only the word Venue where Location was. On the live site nothing changes yet for anyone: no club there has set up a
venue. Two things learned while building: the public coach demo will **not** start warning on its own (its teams share a
typed park, and the demo club has no venues), so whether the demo shows the line is a demo decision; and two more screens
ask "where" than the drawings counted (the free coach's schedule and the schedule import), now listed for later.
The build was then reviewed and checked on screen, and what that found was fixed before any walk, chiefly: a quick double press
could create a house-league game (or a whole practice series) or a tryout day twice; a very busy club's check could quietly
have missed clashes; a club that later dropped the venue library could not edit an event already on one of its venues;
re-importing a schedule sheet could wipe a stored diamond or keep an old venue under new words; and every house-league
window opened underneath the phone's bottom bar, its Create button out of reach. The owner ruled that a draft tournament's
games count as bookings: the club's own planned tournament holds the diamond. The owner walked all eight checks on
2026-10-09, and every one passed. Two questions came out of the walks for the owner: whether editing a repeating practice
should ask "this one or the whole series" up front (so every date it moves is checked for clashes, not just the one opened),
and whether the series line should say "for every date" instead of "for all". **6b was built on 2026-10-09**
(on the test system; not yet released or committed). The club admin gets **Calendar** under Overview: the whole club's
week on one page — every team's games and practices, house league, and each tournament day as one booking — with the
clashes marked in amber, a count that filters to them, and a read-only window that shows both sides of a clash with each
head coach and a link to the schedule that owns it. Times say once that they are Eastern. Export gives Excel, CSV or a
calendar file of what is on screen. Each person sees only the programs they can open, and nothing on it changes a
schedule. The **Venue library** became a table that says who books each venue this season; a venue reads first and edits
whole; the league admin can now save to it (they were refused); renaming a diamond reaches the upcoming bookings, while
past games keep the name they were played under; a venue anything books is **archived** (it leaves every list, its
bookings keep it, and it can come back) instead of deleted, so a delete can no longer strip a venue from a season of
house-league games. Behind it, only the server can now change the library (before, any member could). Three schedules
that grouped weeks by the phone's or the server's clock now use Eastern time, so a Sunday-night game stays in its own
week. It was reviewed before any walk; the review's main catches were fixed — chiefly a rename that, if a save failed
halfway, could have left the bookings with the old name. The same day the screens were checked in both themes against
the drawings: five things were fixed, the most visible being that on a computer the phone's stacked week also showed under
the grid, and that in Dark the week's bookings looked like holes in the page. The wording was settled: Delete now says
"nothing has ever booked it", and Archive says existing bookings keep the venue. Next: the nine walks (ledger §288, on the
hub's QA tab), the commit on the owner's word, then the joint Stage 10 + 11 mockup session (permits and the club
scheduler).

**Stage 11 — the club's schedules: added by the owner 2026-10-08 and ruled the same day; not yet drawn.** A club admin who has to
share out the dome's winter hours, the pitching tunnel's nights or house league's practice slots does it today
in a spreadsheet and a group email. The proposal: they enter a few parameters (which venue and facilities, when,
which teams, how much each gets, and a few rules folded away until wanted), generate a draft, move slots by hand
the way a tournament director adjusts a generated schedule, and finalize it. Each schedule is kept by name
("Winter dome 2026–27") and can be reopened next month or copied next winter. It prints as the whole dome, one
team or one program, and is sent to the people who need it (house league admins, each team's coaches) with a
preview of who gets what. Families see their team's slots on the team schedule as they see everything else.
Ruled: a club slot shows on the team's schedule as "From the club", read-only, and the coach can hand it back
(the way a tournament's games already appear there); the scheduler and permits share one idea of "time the club
holds", so Stages 10 and 11 are drawn together; it is carried by League Plus and both Club bands alike, never as a
reason to move from one to the other. Why it matters: sharing out facility time is one of the most time-consuming jobs a club volunteer does, and
nothing else in the product does it. Priority: after the venue book and calendar (Stage 6), drawn with permits;
the first release waits for it (owner, 2026-10-08). Success: a club builds its winter
dome schedule in one sitting, every team sees its slots on its own schedule, and a change after sending reaches
only the teams it moved.

**The coach Schedule deep dive joins this project, and one calendar review comes first (owner, 2026-10-09).** The
product has seven calendars: the coach's schedule, the club calendar, house league's schedule, the tournament admin's
schedule, the public league and tournament schedules, and the family app. Each one was designed on its own. Some copy
parts from each other without the reason behind them: on 10-09 the club calendar's phone had Export at the bottom of the
week and a List that repeated the Week, both copied from the coach schedule, where the same choices made sense. So before
the scheduler is drawn (its grid is the club calendar's week), one session lays every calendar side by side on a
computer and a phone and settles one recipe: which views a calendar offers and what each means, the toolbar, how a
booking reads, how a clash is marked, and where Filter and Export sit. It also lists where a screen differs on purpose
and why. Each screen's own project then makes its changes; the review rebuilds nothing itself. The coach's own schedule
work, a separate project until now, folds in: its desktop fixes (open on today, a Month that says what and when) are
drawn inside that review, its calendar subscription becomes Stage 6d, its form corrections Stage 6e, and its Tournaments
pages are drawn with Stage 7. Its first stage, the event sheet, is already built; its walk is still owed. Why it
matters: a coach, a club admin and a parent should read a schedule the same way wherever they open one, and the
scheduler should be built on settled parts. Priority: the review's rulings come before the Stage 10 + 11 session; none
of the coach work holds the release. Success: one written calendar recipe that every calendar either follows or departs
from with a stated reason, and no screen whose calendar part was copied without one.

**One calendar: drawn 2026-10-10, twenty questions open.** The review found nine calendars, not seven (the free coach
portal's schedule and an admin's view of one team's schedule were missing from the count), and compared them on twelve
questions at computer, tablet and phone widths with real captures. What a person would see differently once it is ruled:
every calendar opens on today; "Week" always means seven days starting Monday; a day is always spelled "Sat, Oct 10";
today is marked the same way everywhere; a cancelled or postponed game stays on the page, struck through, instead of
vanishing (today it vanishes from the club calendar and from house league's public schedule, where a postponed game even
reads as on). The coach's desktop schedule gets one row of controls instead of three, and a Month that shows each event's
time. A club admin's view of one team's schedule becomes the coach's own screens, read-only, instead of an older copy
that breaks on a phone. Some differences stay on purpose, each with its reason. A team's list is its season, the club's
is a week. The club's Month counts bookings instead of naming them. Families never see clash marks. The review also
found three date bugs that affect coaches today. The month arrow skips November from Oct 29 to 31, and a coach's
Overview shows a live tournament's dates a day early. Both are recommended as a small fix now, ahead of everything else.
And the scheduler's grid can't simply be the club calendar's week, because a scheduler has to show empty slots. Every
other calendar's changes go to the project that owns it. Priority: the rulings come before the Stage 10 + 11 session.
**Ratified the same day (owner: "I agree with your recommendations"), every question as recommended.** The build comes in
one session, in three parts. First the three date bugs, on their own, so they can ship before Oct 29. Then the rules
written into the product's formatting standard. Then the coach's desktop schedule, the club calendar and the admin's
view of a team's schedule. The other calendars' changes were handed to their owners. The permits and scheduler session
can start now; it doesn't wait for this build.

**Built and committed the same day (2026-10-10).** A coach's schedule now opens on today on a computer too, with an
olive "Today" line where today falls and the season a scroll above; its controls are one row, with Import moved inside
Add Event (so it works on a phone for the first time); Week marks today, Month starts on Monday and shows each event's
time and name, and the month arrow no longer skips November. The club calendar lists bookings as rows by day, shows
cancelled and postponed bookings instead of hiding them (never as clashes), and its spreadsheet gains a Status column.
An admin's view of a team's schedule is now the coach's own screens, read-only, and works on a phone. The Overview's
tournament dates and the free portal's times are right in every time zone. Eleven read-only walks are ready (Owner QA
§289). Success looks like: a coach lands on next week's game without scrolling, and nobody turns up for a called-off game
because the club calendar hid it.

**Stage 14 — one player across seasons and teams: added by the owner 2026-10-22; not yet drawn.** Today a child exists once per
season. Starting next season copies last year's active players as new entries, a player the team let go and later takes back
arrives as a stranger, and every waiver and document is collected again on the new record. A coach adding a kid types them in,
and nothing says "you already have this child." The family library holds the parents, not the children. The proposal: **a child
becomes one record that outlives a season, anchored to the family library**, with each season's roster as that season's
membership of it. A coach adds a returning kid by picking them, not retyping; their history and still-valid documents arrive with
them; typing someone who already exists gets a "same kid?" nudge; and a club with years of duplicates gets a review-and-merge
pass instead of a forced one. **Ruled the same day:** *Start next season* now asks what the team is doing — **the same group moving
up an age group** (11U becomes 12U, the birth years stay, and the roster is a choice to carry) or **a new group in the same age
group** (the birth years roll to the next cohort). It serves a coach who keeps their kids and a club that keeps its slot, which
today's single behaviour only half does. **Open for the owner session:** what a coach may see of a child who played on another
team (medical notes, guardian contact, evaluations); who may link or merge; which documents carry and which must be signed again
each season (a waiver usually must, so the gain is one record with a history and a "needs re-signing" state, not skipping it); and
whether a standalone coach gets the same record. Why it matters: it removes the most repeated chore of every season (re-entering
the same kids and re-collecting the same papers) and is the foundation for a child's whole history in one place. Priority:
inside the Club release; the season window first (small), then the player record. Success: a returning child is picked, not
retyped, and appears once in the family library no matter how many teams and seasons they have played.

**Stage 7 closed 2026-10-22 (all four parts built and walked by the owner):** A club that hosts a tournament now enters its own teams in one window, with no fee for its own team (7b). Visiting teams' fees land in the tournament's own book, so the club sees the tournament's money beside its other activities (7a). A club admin can email every family, some teams' families or one house-league season from Families, and the Emails tab keeps a record of what was sent (7c). A coach's Tournaments is now one banded list and one page named for the tournament, in both portals, and only the event's head coach can change who it names (7d). Still open and not blocking: a review pass on the family email, the owner's three questions about who may change an event's head coach, and moving the house-league season email onto the same sender.

## Trade-offs made in this plan

**Stage 7a built 2026-10-20:** When a club records a visiting team's tournament payment, its tournament book gains the receipt automatically. An owner or admin with Accounting access picks the tournament's filing name in Event settings, then sees its revenue and filed costs together in Accounting → Budget vs. Actual → By activity. A rep team linked to its own club's tournament is labelled Our team and No fee; it creates no receipt. The house league records a fee only when paid, and its book remains outside the club Statement until Stage 9. Existing paid registrations do not create backdated receipts. A tournament admin with Accounting access can record one transfer for two visiting teams; coaches see the own-team no-fee message. Success is a fee-book total that matches new paid figures, with corrections and undos visible as voided history, and a tournament activity total that includes costs from the general book.

- **Fix the club side to read the coach's records, rather than rebuilding both.** The coach money
  model has three months of hardening and build gates; the club's team-ledger copy has neither. The
  plan recommends the coach's records become the source of truth for team money (owner ruling D1).
- **Permits and a club-wide calendar are new features, not readiness items.** Both are decided: the
  club calendar is in the first release (D5), and permits are Stage 10, which the release waits for
  (D4, amended 2026-09-25). Stage 10 sits on Stage 6's venue book and clash check, so the release
  waits for Stage 6 too. On 2026-10-08 the owner added the club scheduler (Stage 11) to what the release
  waits for. The risk left is size, not a decision. Nothing for permits exists today, and
  the homepage's "field bookings" claim comes back only with Stage 10.
- **Families P3 is inside the release** (owner 2026-10-12, like everything in this plan); its four serious defects come first, as Stage 5a.
- **The coach schedule work joins the project but not the release.** Merging it (2026-10-09) keeps every calendar
  decision in one place. The cost is a longer project, so each merged piece is marked as not holding the release. Only
  the calendar review's rulings sit on the release path, because the scheduler, which the release waits for, is drawn on
  them.
- **House league last**, as directed — and because its standalone plan already exists (League Plus,
  parked), no new SKU needs inventing.

## Success criteria

1. One real rep club (or the fixture standing in for one) completes the nine-point exit definition in
   the plan §3 with the owner watching, and every stage's QA walk is on the ledger as PASSED.
2. Every board-facing figure has a build gate, the way coach money figures do, and the same number
   cannot be computed two ways on two screens.
3. The June J4/J10 audit findings routed to Club are each FIXED or explicitly SUPERSEDED — none OPEN.
4. Club and Club · Association can be bought in-product, the gate flip is one owner decision away, and
   the marketing surfaces promise only what exists.
