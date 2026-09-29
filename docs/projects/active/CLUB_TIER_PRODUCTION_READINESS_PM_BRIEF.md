# Club Tier Production Readiness — PM Brief

> **Companion plan:** [CLUB_TIER_PRODUCTION_READINESS_PLAN.md](CLUB_TIER_PRODUCTION_READINESS_PLAN.md)
> **Written:** 2026-09-25 · **Priority:** High — this is the next product programme after the Coaches Portal.

## What it is

A staged programme that takes the Club plan from "built but never tested" to "a rep club can buy it,
set it up, staff it, run a season on it and trust the numbers it shows the board." It is organised
so each part of the Club offer is tackled, walked and signed off one at a time, in the order a real
club meets them, with house league deliberately last so Club can be released to rep clubs that run no
house league.

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

**Families.** Household records read the same money the Money hub does, a changed guardian email
follows the child, a merge stays merged, and the family export says honestly what it contains.

**One venue book.** Rep, house-league and tournament games read the same venues, and a diamond
double-booked across two modules is flagged.

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
| 3 · Club money | 3a bookkeeping core + allocation/request loop with confirm + reverse · 3b budget, Budget vs. Actual and the whole-club summary, with arithmetic gates · 3c the club year and year-end | Owner walk per part; gates green |
| 4 · The public face | Teams index, tryout funnel, club-first home, editor controls, marketing truth | Owner walk |
| 5 · Families | The four HIGH defects; P3 mockup session; migrations confirmed on prod | Owner walk (§54/§56) |
| 6 · Venues, scheduling, permits | One venue book + cross-module clash check; club calendar (decision); permits (decision — new feature) | Owner ruling first |
| 7 · Tournaments in a club + comms | Host-own-team walk; tournament money into the books (decision); one "message every family" door | Owner walk |
| 8 · Release readiness | UAT suite, layout sweep, help, demo decision, pricing gate flip, Stripe checkout, support posture | Go/no-go |
| 9 · House league (last) | Trust-plan defects; un-park League Plus as the standalone plan; coupling check | Separate release |

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

## Trade-offs made in this plan

- **Fix the club side to read the coach's records, rather than rebuilding both.** The coach money
  model has three months of hardening and build gates; the club's team-ledger copy has neither. The
  plan recommends the coach's records become the source of truth for team money (owner ruling D1).
- **Permits and a club-wide calendar are new features, not readiness items.** They are in the plan
  as Stage 6 with an explicit owner decision on whether they gate the first Club release. Nothing for
  them exists today, and the homepage currently claims "field bookings".
- **Families P3 is not release-gating**; the four HIGH defects are.
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
