# Product Roadmap (living record)

**Status: Draft v0.2, 2026-11-16. Not yet shown to anyone outside the business.** The owner ruled the 13 asks, the
8 tool rows and every conflict they raised on 2026-11-16 (§6), and the same day ruled the public version's thirteen
asks (§6, last entry). The public version is drawn and ruled; what is owed before it is shown is in §4.

This is the one home for the product roadmap: the current version, every version shown to someone, and what changed
between them. It is a living reference and is never archived.

## 1. How this record works

- **The current roadmap sits in §2.** Change it in place and add a line to §6.
- **Every version shown to anyone gets a snapshot in §7**, with the date and who saw it. A snapshot is never edited.
- **Dates appear here on purpose.** Internal plans stay dateless (sequence by dependency). A roadmap presented to a
  prospect is the deliberate exception, and this file is where those dates live.
- **Placements are adjustable.** Owner, 2026-11-14: "if after review of the roadmap we decide to reprioritize and move
  things around we can adjust."
- **"Shipped" means live on production.** The recently-shipped section (§3) is built from the release-history record,
  so every line can be checked.
- First use: the board pack for the Milton Bats pitch (`docs/projects/active/BOARD_READY_PLAN.md`, Stage 0c).

Ruled 2026-11-16: confidence by horizon (rest of 2026 committed, Q1 planned, Q2 targeted, H2 2027 goals), and the
board pack carries the joined page with the product and technology pages behind it as detail.

Ruled 2026-11-16 for the public version (§6, last entry):
- The front page groups its rows as New tools for your club · Moving your club over, and your data · Security and
  reliability (this settles the "three tracks" proposal). §2 keeps its seven lanes; the groups are a view of them.
- Items are worded as commitments, not gaps, with the guard: nothing that isn't on production is in the present
  tense, and no line claims more than its §2 row.

## 2. The current roadmap

**These tables are read by code** (`scripts/owner-brief.mjs` feeds the owner's morning page from them). Keep the
column names, keep one item per row, and change a row's **Status** in the same unit of work that changes the fact.
- **Track** is `Product` or `Technology`. **Lane** is one of the seven lanes.
- **Status** is one of: `Not started` · `In progress` · `Built` (built and walked, not yet on production) · `Live`.
- **Ruled** is `Yes` when the owner placed the item himself; blank means the placement is a proposal.
- Sizes are the owner's time, not build time: Small is one round of drawing, rulings and a walk; Medium is two or
  three; Large is four or more.

### Rest of 2026 (committed)

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Product | What the board asked for | Friend requests in the draft, live | Small | Live | |
| Product | What the board asked for | Group email to coaches | Small | In progress | |
| Product | The Club product | One release of everything built since 5 November | Medium | Live | |
| Technology | Security | Two-step sign-in, live | Small | Live | |
| Technology | Security | Access review fixes, live | Small | Live | |
| Technology | Security | Public Security page | Small | Not started | |
| Technology | Reliability | Backups documented, first restore rehearsed | Small | Not started | |
| Technology | Reliability | Uptime monitoring and a public status page | Small | Not started | |
| Technology | Quality and infrastructure | The whole-product layout check, back in every release | Small | In progress | |
| Technology | Privacy, data ownership, continuity | Privacy policy and terms published | Small | Built | |
| Technology | Privacy, data ownership, continuity | Data terms and the supplier list | Small | Not started | |
| Technology | Privacy, data ownership, continuity | Deleting a club removes its files | Small | Built | |

### Q1 2027 (planned)

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Product | What the board asked for | Volunteers and their documents | Large | Not started | |
| Product | What the board asked for | Custom sign-up forms | Large | Not started | |
| Product | What the board asked for | Club events | Medium | Not started | |
| Product | The Club product | Club plan on sale | Large | In progress | Yes |
| Product | The Club product | Club roles walked job by job | Large | Built | |
| Product | The Club product | Phone layout and wording polish, after launch | Large | Not started | |
| Product | The Club product | Schedules on several permits | Medium | Built | Yes |
| Product | The Club product | Families pay online, switched on | Small | Built | Yes |
| Product | Switching and growth | Import from a club's current system | Large | Not started | Yes |
| Technology | Security | Cross-club tests on every change | Medium | Not started | |
| Technology | Security | Harder public forms | Small | Not started | Yes |
| Technology | Security | Alerts for vulnerable components and leaked passwords | Small | Not started | |
| Technology | Reliability | A restore drill every quarter | Small | Not started | |
| Technology | Quality and infrastructure | Hosted checks on every change | Medium | Not started | Yes |
| Technology | Quality and infrastructure | A stated release rhythm | Small | Not started | Yes |
| Technology | Privacy, data ownership, continuity | One-button export of everything, and club closure | Medium | Not started | |
| Technology | Privacy, data ownership, continuity | Continuity commitments in writing, with the export | Small | Not started | Yes |

### Q2 2027 (targeted)

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Product | What the board asked for | Sponsorships | Large | Not started | Yes |
| Product | What the board asked for | Camps and clinics | Large | Not started | |
| Product | The Club product | One Guardians section | Small | Not started | |
| Product | The Club product | Smaller open items | Medium | In progress | Yes |
| Product | Switching and growth | Internal back office (on our version only, not the board's) | Large | In progress | Yes |
| Technology | Reliability | Registration-day speed | Medium | Not started | |
| Technology | Quality and infrastructure | Accessibility checks and a statement | Medium | Not started | |

### H2 2027 (goals)

Proposals, not yet discussed. **No second person, hire or support-cover goal appears on the roadmap** (owner,
2026-11-14).

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Product | What the board asked for | All eight asks live and used through a season | | Not started | |
| Product | The Club product | A club runs a full season end to end | | Not started | |
| Product | Switching and growth | Case studies and comparison pages | Small | Not started | |
| Technology | Security | Security review repeated every year | | Not started | |
| Technology | Reliability | A published uptime record | | Not started | |
| Technology | Privacy, data ownership, continuity | Every commitment in the pack kept and reported on | | Not started | |

### Tied to a trigger (not a date)

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Technology | Reliability | Status page on our own web address, when clubs see it | Small | Not started | Yes |
| Technology | Security | Bot challenge on public forms, if automated sign-ups appear (not on the board's version) | Small | Not started | Yes |

The independent security test is **off the roadmap** (owner, 2026-11-16, ask 6B), so its row is removed. The status
page on our own address (about US$10 a month) is ruled "Later".

**Minute-level database recovery (about US$100 a month): Later, with no date and no trigger, and not on the board's
version** (owner, 2026-11-16: "this is a real cost and I need many customers before I start to think about this
feature"). Its row is removed. What the board's version may say about backups: daily backups kept 7 days, and a
restore rehearsed on a schedule. It must not imply recovery finer than a day.

## 3. Recently shipped

First cut compiled 2026-11-14 from the customer release notes (`lib/release-notes.ts`, which the /changelog page
renders) and the release tags: **47 production releases between 2026-06-28 and 2026-11-05** (tag count verified).
The list of 15 highlights by quarter is on the review page. Cautions for the board's version: the record starts
28 June (nothing recorded 14 May to 27 June); Club items are live in early access while the Club plan is not on sale;
families paying online and a club's own web address are NOT live and must not be claimed; the 17 July "fans follow
teams" item needs a check on the live site; the founding offer (closed 2026-10-25) is left out.
Friend requests and two-step sign-in are built and walked but not on production as of 2026-11-14, so they count
only after the next release.

## 4. Open decisions

Every ask on the 2026-11-14 review page and every conflict it raised was ruled by 2026-11-16 (§6). What remains:

1. ~~**Three tracks** and **commitments, not gaps** wording.~~ Ruled 2026-11-16 with the public version's asks 1 and 4
   (§1, §6).
2. **Market claim.** A comparison with what clubs use today comes before any "top of the market" claim (ruled). It
   has no roadmap row or owner yet.
3. **Q1 review** at the end of January 2027 (ruled). A calendar item, not a decision.
4. **Owed before the public version is shown to anyone** (its thirteen asks were ruled 2026-11-16, §6):
   - ~~`/legal` on the four "Your data is yours" commitments.~~ **Done 2026-11-21**
     (`docs/agents/legal/MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` §3). All four may be shown, reworded: C1 and C3
     move out of the present tense (ask 4A's guard: none is on production), C3 gains "unless you ask us to delete it
     sooner", C4 is true today. The exact slide words are in that file. Owner calls it raises: how the 60 days sits beside
     Terms §9's 90 days, and whether the Q1 export includes uploaded documents. The public drawing's copy takes these
     words when it is next published.
   - ~~The owner's plain line for two product lines ("One Guardians section" and "The rest of the journeys stage", ask 12).~~
     **Ruled 2026-11-18** (§6; the journeys row is split in two). The public drawing's copy for these two rows still has
     to be updated to the ruled lines when the public version is next published.
   - ~~"Group email to coaches" is built, or its row moves to Q1 (ask 11).~~ **Ruled 2026-11-18: it stays in Rest of 2026
     (Committed)** (§6). This replaces ask 11A's condition, so the row no longer has to be built before first showing.
     The Q1 review (end of January 2027) is where a miss would be looked at.
   - A §7 snapshot of the version shown.
5. **"Every finding fixed"** may be said only after the third access sweep's open owner calls are closed and its small
   findings confirmed (ask 13). Until then the public line is "with its fixes live".
6. **The first restore rehearsal.** Until it is done, "restore rehearsed" appears only as the roadmap's commitment;
   the brief and the Security page do not say it (ask 6).

## 5. Tool prices (read from each vendor's pricing page 2026-11-14; US dollars unless noted; not independently re-checked)

| Tool | Free option | Paid option | Recommendation |
|---|---|---|---|
| Uptime monitor and status page (UptimeRobot) | 50 monitors, 5-minute checks, one status page, commercial use allowed | $10 a month: own web address, 1-minute checks | Start free |
| Bot challenge (Cloudflare Turnstile) | Unlimited; works without moving our web address | None needed | Yes, after `/legal` (a new supplier that sees visitors' browser signals) |
| Database backups (Supabase) | Daily, kept 7 days, included in the current plan | $100 a month for minute-level recovery, 7 days | At the first live club |
| Hosted checks (GitHub Actions) | About 2,000 minutes a month; component alerts free | $0.006 a minute beyond that | Free tier |
| Leaked-password scanning (GitHub) | None for private code | $19 a month | Skip; confirm a free open-source scanner inside the hosted checks |
| Shared throttle store (Upstash) | 500,000 operations a month | $0.20 per 100,000 beyond | Pay as you go |
| Accessibility and page-speed checks | Free, open source | None | Yes |

## 6. Rulings and changes

- 2026-11-14 — The owner asked for a product roadmap in the board pack: rest of 2026, Q1 and Q2 2027, goals for H2 2027.
  It is written only after a roadmap evaluation session.
- 2026-11-14 — Keep a roadmap log (this file). The roadmap also shows what was recently built (the owner's idea).
- 2026-11-14 — Milton Bats has no go-live date. It is theirs to set after the pitch and may be staggered. The roadmap
  is not built around it.
- 2026-11-14 — No second person on the roadmap.
- 2026-11-14 — Sponsorships: Q2 (the whole feature). Import: Q1. Internal back office: Q2. Club plan on sale: Q1.
- 2026-11-14 — Hosted checks on every change: on the roadmap in Q1 (owner: "yes this makes sense, Q1 is a good place
  for it, add it to the roadmap"). This is a roadmap placement. Setting it up changes shared automation and still needs
  the owner's go in the session that builds it.

- 2026-11-14 — **Three roadmaps** (owner): a product roadmap, a technology roadmap (security, uptime, infrastructure
  and the like), and one that joins both. Draft v0.2 regroups §2's items into seven lanes: product = what the board
  asked for, the Club product, switching and growth; technology = security, reliability, quality and infrastructure,
  privacy / data ownership / continuity. The owner's review copy, with the tool recommendations and 13 open asks plus
  8 tool rows as a paste-back, is https://claude.ai/artifact/GJaXp2yw9chSpVtPSQtMgj (internal; not a version shown to
  a prospect). The owner rules on the tools later. §2's tables keep the placements; re-cut them into the lanes when
  the asks are ruled.
- 2026-11-14 — New in v0.2, all proposals awaiting the asks: a restore drill every quarter; a stated release rhythm;
  families pay online switched on in Q1; the smaller open items (bank check save for later, read-only accounting
  seat, tournament schedule-editor fix, What's new) grouped in Q2; the back office left off the board's version.

- 2026-11-16 — **The owner ruled the review page** (paste-back "Roadmap asks: 1A · 2A · 3A · 4A · 5b · 6B · 7A · 8A ·
  9A · 10A · 11A · 12A · 13A · T1 Yes · T2 Later · T3 No · T4 No · T5 Later · T6 No · T7 No · T8 Later"):
  - 1A confidence by horizon, four levels. 2A the board pack carries the joined page, with the product and technology
    pages behind it as detail.
  - 3A schedules on several permits stay in Q1 with the Club release. 4A keep Q1 as drafted, review it at the end of
    January 2027. 7A families pay online, switched on in Q1 with the Club plan on sale. 8A the smaller open items
    grouped in Q2. 12A state a regular release rhythm on the technology roadmap. 13A the H2 2027 goals are the
    starting point (still proposals; not individually ruled).
  - 5b continuity: only "the club's data handed back, with an export window". 6B independent security test: left off
    the roadmap. 9A back office stays on our version, off the board's. 10A recently shipped covers the past six months.
    11A do a comparison before claiming top of the market.
  - Tools: T1 uptime monitor Yes. T2 status page on our own address Later. T3 bot challenge No. T4 minute-level
    recovery No. T5 hosted checks tool Later. T6 paid leaked-password scanning No. T7 shared throttle store No.
    T8 accessibility and page-speed checks Later.
  - Three answers conflict with placements already ruled or drafted (T5, T3 and T7, T4): see §4. Setting up hosted
    checks or the uptime monitor is still a separate go in the building session.
- 2026-11-16 — Follow-ups on the conflicts: **T5 = set up within Q1** (the Q1 placement stands). **Minute-level
  recovery: Later, no date, no trigger, not on the board's version** ("this is a real cost and I need many customers
  before I start to think about this feature"); the trigger row is removed. Harder public forms: recommendation given
  (§4 item 2), awaiting his ruling. Continuity: the owner asked what can realistically be offered without another
  person; recommendation given in the session, awaiting his ruling.
- 2026-11-16 — **Continuity commitments ruled** (replaces 5b). Four commitments, no notice period, no named person, no
  code held by a third party: (1) the club's data is always theirs, and they can take all of it themselves in
  ordinary spreadsheet files, without asking us; (2) a reminder to keep a copy at season close and when registration
  closes (a prompt to download, never the data emailed); (3) data handed back on closure, with an export window;
  (4) no lock-in: no long contracts, a cancelled plan ends at its renewal date. Notice period dropped (owner: "I don't
  think that adds much. The product will certainly live long enough for them to extract their data should anything
  happen to me."). The window length in (3) is not set. Wording goes through `/legal` before it reaches the terms or
  the pack.
- 2026-11-16 — **Last three settled** (owner: "timelines I agree · public forms I agree with your approach · I agree
  with 60 days"):
  - Continuity commitments move from rest of 2026 to **Q1, written alongside the one-button export**, because
    commitment (1) is only true once the export exists.
  - **Harder public forms stays in Q1, re-scoped with no new supplier:** sign-up and registration throttles move onto
    the database-backed counter the product already has (it holds across servers, which T7 would have bought); a
    hidden trap field and a minimum fill time on public forms; the remaining browser protections. Size proposed
    Small (was Medium). The bot challenge becomes a trigger row ("if automated sign-ups appear"), off the board's
    version. Board wording: "public forms are rate-limited and screened for automated sign-ups".
  - **Export window on closure: 60 days**, then deleted.
- 2026-11-16 — **Statuses truthed up against production** (no placement changed): friend requests, two-step sign-in and
  the access review fixes are **Live** (release 2026-11-15, production `47cc775b4`), and that release was the "one
  release of everything built since 5 November" (**Live**). Deleting a club removes its files is **Built** (committed
  `45c134bea` 2026-11-15, after that release was cut; it rides the next one).
- 2026-11-16 — **The board's version drawn** (round 1, after `/design`): https://claude.ai/artifact/FUnEBQmUoNWojM12zgkvau,
  source `docs/projects/active/BOARD_READY_ROADMAP_BOARD_VERSION_DRAWINGS.html`. Drawn from §2 and §6 only. Seven asks are
  owed: A1 grouping and A2 commitments wording (= §4 item 1); A3 the data commitments named "Your data is yours", not
  "continuity" (the owner ruled on 2026-11-16 that the pack does not raise "if something happens to the owner"); A4 "restore
  rehearsed" stays a roadmap commitment until the first rehearsal is done; A5 status marks; A6 keep the live release item;
  A7 "Club plan on sale" names a plan on a pitch surface (design decision 2026-08-21). Not a version shown: §7 stays empty
  until the owner sends it.
- 2026-11-16 — **The roadmap is public** (owner: "I want the roadmap to be something that we can present publicly to any
  customer or prospect, there should be nothing pointing to something a specific club asked of me … for those prospects
  that I know want certain functionality I can highlight in those meetings"). The shown version carries no "you asked"
  anywhere: the lane "What the board asked for" is shown as "New for clubs", and its H2 goal as "Every new tool above, live
  and used through a full season". Drawing v3 at the same link.
- 2026-11-16 — **The public version redrawn to sell** (round 4, the owner's ask: "review and update the roadmap based on
  how you think we should be presenting and what would sell the best"; after `/design` and `/marketing` passes). Same
  link, same source file. **No placement in §2 changed, and nothing below is ruled: all of it is proposal until the
  thirteen asks come back** (paste-back "Public roadmap asks: …"; they replace round 3's A1–A7, which are folded in).
  - Front page reads in three blocks: what we've shipped (a release count, 48 release tags from 2026-06-28 to
    2026-11-15, counted 2026-11-16, recount on every rebuild; six highlights across tournaments, rep teams, house
    league and security), what comes next (the grid), what we promise ("Your data is yours", full width).
  - Rows renamed for a customer: New tools for your club · Moving your club over, and your data · Security and
    reliability. "Ready for every club" (our milestone) is gone as a row.
  - 29 of the 40 lines on the front page. Five engineering lines sit on the trust detail page only (layout check,
    cross-club tests, component alerts, public forms, release rhythm); two product lines on the product detail page
    only, awaiting the owner's words (One Guardians section; the rest of the journeys stage).
  - Proposed off the public version: "One release of everything built since 5 November", "Smaller open items", and the
    H2 goals "A club runs a full season end to end" and "Case studies and comparison pages" (each tells a prospect no
    club has finished a season with us). Rows stay in §2.
  - **Correction to round 3:** "every finding fixed" claimed more than the row "Access review fixes, live" holds. The
    third sweep's report still lists owner calls left open (`BOARD_READY_ACCESS_SWEEP_3.md`, "owner calls (not fixed)").
    Public wording is now "with its fixes live" until those are closed (ask 13).
  - **Found by the copy pass:** the shipped line for tryouts promised "offers families answer from the email"; tryout
    decision emails were removed by the owner's ruling of 2026-08-26. Removed from the drawing. The same sentence is
    still in the live customer release notes (`lib/release-notes.ts`), which is a separate fix for the owner to call.
  - Open risk raised as ask 11: "Group email to coaches" is the one unstarted product build in the Committed column.
- 2026-11-16 — **The owner ruled the public version's thirteen asks, every one as recommended** (paste-back "Public
  roadmap asks: 1A · 2A · 3A · 4A · 5A · 6A · 7A · 8A · 9A · 10A · 11A · 12A · 13A"). The round 4 entry above is
  therefore ruled as drawn:
  - 1A the three front-page groups. 2A the customer-visible lines on the front page, the engineering detail on the
    trust page. 3A shipped work first, with the release count.
  - 4A commitments wording, with the guard. 5A "Your data is yours", with no "continuity" anywhere on the public
    version. 6A "restore rehearsed" is the roadmap row only; the brief and the Security page say it only after the
    first rehearsal. 7A status marks as drawn (Live, Under way, nothing on an item not started).
  - 8A "One release of everything built since 5 November" and "Smaller open items" are off the public version.
    9A the Club plan row reads "The club tools out of early access, open to every club". 10A the H2 goals "A club
    runs a full season end to end" and "Case studies and comparison pages" are off the public version and stay on
    ours.
  - 11A "Group email to coaches" stays Committed only if it is built before the roadmap is first shown; otherwise it
    moves to Q1. 12A the two product lines stay on the detail page until the owner gives a plain line for each.
    13A the access review line reads "with its fixes live".
  - No §2 row, placement or status changed. The drawing at the same link is marked ruled.
- 2026-11-18 — **Ask 12's two plain lines RULED** (owner: "I agree with your recommendations", on options A for both and the
  split below). Placement of both rows is unchanged (Q1 2027 table, Guardians row where it was); only the words and the
  split change.
  - **"One Guardians section" (A):** "One place for a player's guardians: a coach adds a parent once, invites them to the
    family app from the same row, and sees who has joined." Status stays Not started (not yet drawn or ruled; the family app
    is still switched off).
  - **"The rest of the journeys stage" (A), split in two.** The finished part is the row "Club roles walked job by job"
    (Built, not Live: its walks passed but it is not recorded as on production): "The club app, walked job by job by each
    role that runs a club: the right home screen, the right menus, clean hand-offs between people, and numbers that open
    into their detail." The unfinished part (13f messages to families say who they reach, 13g the phone, 13h one name per
    thing; after the Canadian launch, owner 2026-11-17) becomes "Phone layout and wording polish, after launch", Not
    started, size Large (three stages, each its own drawing, rulings and walk; the size is the writer's reading of the
    size rule, not a ruling).
  - Both plain lines now come off the "detail page only" holding rule (§4 item 4 ticked). A line still names no
    club's request and no date.
- 2026-11-18 — **Group email row RULED (owner: "group email can stay this year").** "Group email to coaches" stays in Rest
  of 2026 (Committed), status In progress. This replaces ask 11A's condition ("stays Committed only if it is built before
  the roadmap is first shown"). Risk recorded, not ruled on: it is the one unfinished product build in the Committed
  column, its Session 2 walk is owed and Session 3 is not started, and the roadmap is public; if it has not shipped by
  the Q1 review (end of January 2027) the row moves to Q1 and the line is corrected. The `/legal` read of the four "Your
  data is yours" lines is running in another session (2026-11-18).

## 7. Versions shown

None yet.
