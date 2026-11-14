# Product Roadmap (living record)

**Status: Draft v0.1, 2026-11-14. Not yet shown to anyone outside the business.** Open decisions are listed in §4;
the roadmap is not final until they are ruled and the owner has reviewed the whole.

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

Proposed, not yet ruled by the owner:
- Three tracks: trust and resilience, the board's asks, product depth.
- Confidence by horizon: rest of 2026 is committed, Q1 is planned, Q2 is targeted, H2 2027 is goals.
- Items from the internal review are worded as commitments, not gaps, when shown to a prospect.

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
| Product | What the board asked for | Friend requests in the draft, live | Small | Built | |
| Product | What the board asked for | Group email to coaches | Small | Not started | |
| Product | The Club product | One release of everything built since 5 November | Medium | In progress | |
| Technology | Security | Two-step sign-in, live | Small | Built | |
| Technology | Security | Access review fixes, live | Small | Built | |
| Technology | Security | Public Security page | Small | Not started | |
| Technology | Reliability | Backups documented, first restore rehearsed | Small | Not started | |
| Technology | Reliability | Uptime monitoring and a public status page | Small | Not started | |
| Technology | Quality and infrastructure | The whole-product layout check, back in every release | Small | Not started | |
| Technology | Privacy, data ownership, continuity | Privacy policy and terms published | Small | In progress | |
| Technology | Privacy, data ownership, continuity | Data terms and the supplier list | Small | Not started | |
| Technology | Privacy, data ownership, continuity | Deleting a club removes its files | Small | Not started | |
| Technology | Privacy, data ownership, continuity | Continuity commitments in writing | Small | Not started | |

### Q1 2027 (planned)

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Product | What the board asked for | Volunteers and their documents | Large | Not started | |
| Product | What the board asked for | Custom sign-up forms | Large | Not started | |
| Product | What the board asked for | Club events | Medium | Not started | |
| Product | The Club product | Club plan on sale | Large | In progress | Yes |
| Product | The Club product | The rest of the journeys stage | Large | In progress | |
| Product | The Club product | Schedules on several permits | Medium | In progress | |
| Product | The Club product | Families pay online, switched on | Small | Built | |
| Product | Switching and growth | Import from a club's current system | Large | Not started | Yes |
| Technology | Security | Cross-club tests on every change | Medium | Not started | |
| Technology | Security | Harder public forms | Medium | Not started | |
| Technology | Security | Alerts for vulnerable components and leaked passwords | Small | Not started | |
| Technology | Reliability | A restore drill every quarter | Small | Not started | |
| Technology | Quality and infrastructure | Hosted checks on every change | Medium | Not started | Yes |
| Technology | Quality and infrastructure | A stated release rhythm | Small | Not started | |
| Technology | Privacy, data ownership, continuity | One-button export of everything, and club closure | Medium | Not started | |

### Q2 2027 (targeted)

| Track | Lane | Item | Size | Status | Ruled |
|---|---|---|---|---|---|
| Product | What the board asked for | Sponsorships | Large | Not started | Yes |
| Product | What the board asked for | Camps and clinics | Large | Not started | |
| Product | The Club product | One Guardians section | Small | Not started | |
| Product | The Club product | Smaller open items | Medium | In progress | |
| Product | Switching and growth | Internal back office | Large | In progress | Yes |
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
| Technology | Security | Independent security test by an outside firm, at the first paying club | Medium | Not started | |
| Technology | Reliability | Minute-level database recovery, at the first live club | Small | Not started | |
| Technology | Reliability | Status page on our own web address, when clubs see it | Small | Not started | |

The independent security test is not decided: the owner leans out of scope before the first customer because it is a
paid third-party service. Minute-level recovery (about US$100 a month) and the status page on our own address (about
US$10 a month) are recommendations of 2026-11-14.

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

1. **Continuity commitments.** Which of these the owner will put in writing: a notice period, the club's data handed
   back, a named person who can step in, the code held by a third party.
2. **Schedules on several permits.** The 2026-10-12 ruling says everything in the Club plan ships before the Club plan
   goes on sale, which puts this in Q1 with the Club release. The owner can exempt it; until then it stays in Q1.
3. **Small paid tools.** Owner, 2026-11-14: review "service by service and cost by cost". Prices and recommendations
   were presented the same day (§5). The owner's reply covered hosted checks; the other rows are not individually ruled.
4. **H2 2027 goals.**
5. **The roadmap's shape** (tracks, confidence by horizon), proposed in §1.
6. **Q1 load.** Four Large items, the Club release and five Mediums. First candidates to move to Q2 if it is too much:
   club events, harder public forms.

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

## 7. Versions shown

None yet.
