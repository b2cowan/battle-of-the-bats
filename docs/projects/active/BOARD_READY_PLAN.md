# Board Ready — what a club board needs before it says yes — Implementation Plan

> **Status:** Planning — nothing ruled, nothing built. Owner questions in §7 come first.
> **Created:** 2026-11-10
> **Branch:** dev
> **PM brief:** `BOARD_READY_PM_BRIEF.md`
> **Source:** board feedback from the prospect demo of 2026-11-10 (the club in `PROSPECT_DEMO_PROGRAM_PLAN.md`), eight
> items, owner's words kept in §1. Runs **alongside** Club Tier Readiness (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`),
> never inside it, except where §3 says a Stage 0 piece belongs to that plan's Stage 8.

## Goal

Turn the eight things a real club board asked for into a sequenced project. It should answer the board's trust
question honestly and add the off-field club work they run today in spreadsheets and email: volunteers and their
screenings, friend requests, group email, custom sign-up forms, club events, camps and sponsorships.

The plan's main finding is that **items 5–8 are one shape asked four times**: *a club-owned thing, with an optional
sign-up form, an optional price, shown on the calendar and the club site*. Built as four features, that would be four
form builders and four payment flows. Built on three shared foundations (the club's **People**, **Forms**, and
**Club events**), each later item is mostly assembly.

## 1. The eight items (owner's words, condensed)

1. Security concerns: we are small and have had no SOC audit. Give encryption details, architecture diagrams and other security material.
2. Friends in the house league team calc: parents list friends in free text, we match to registrants as accurately
   and transparently as possible, and it feeds the auto-draft. Today the registrar does this in Excel.
3. Email distributions to coaches: all rep coaches, all coaches, all house-league coaches.
4. Track volunteers (coaches, parent helpers, board) with documents attached. The club defines each document type and
   how long it lasts (police screening = 3 years from receipt), gets told when one is near or past expiry, and can
   email those who need a new one.
5. Customizable house-league registration forms: custom questions, documents to open/download before submit, "I have read"
   checkboxes.
6. Clinics and camps: scheduled, linked to permits, with their own registration forms, postable on the club site, with
   payment. Similar workflow to house league.
7. **(important)** Organization sponsorships: sponsorship documents and invoices, a link the sponsor fills in (the club's
   sponsorship form) and pays through Stripe. Track what they paid and what they got, and attach a sponsorship to a house-league
   team, division, or club event (tournament, champs day).
8. Organization events: year-end banquet, champs day, camps.

## 2. Facts this plan stands on (census 2026-11-10; the starred ones were re-read from source)

| # | What exists today | Verdict |
|---|---|---|
| 1 | ★ Production database is **AWS us-east-2 (USA)**, Pro plan; dev is ca-central-1 (`docs/agents/legal/LEGAL_FACTS.md` "Where data lives"). ★ **No MFA exists.** Org delete leaves file storage behind. AES-256 at rest / TLS in transit is Supabase's own claim. Privacy policy v0.2 and breach procedure v0.1 are **drafts**; legal pages are switched off. Data-processing terms for clubs and sub-processor list: **not started** (`LEGAL_INDEX.md`). ~~Open defect: any club member can pull every team's contact emails~~ **⚠ Corrected 2026-11-10:** fixed `b15b01fea`
2026-10-16 and on production. The TODO line was stale and is now archived. The census and this plan repeated it without
opening the record. RLS is on widely but the API runs service-role with checks in the routes (`docs/agents/db/DB_ARCHITECTURE_REVIEW.md` ~L155). No backup/PITR doc, no architecture diagram. | partly built: facts on file, nothing a board can read |
| 2 | Auto-draft is a seeded snake draft with **"Families together"** (siblings by guardian email) and convenor locks (`lib/house-league-draft.ts`). Registration has a 500-char notes box, which is where a "plays with" request lands today. Name matching helpers exist (`lib/continuity-match.ts`, `lib/children-duplicates.ts`). "With a friend" was explicitly **not ruled** in the Stage 9c and draft-at-scale prompts. ★ Ruling: *"no sibling claim from a name match — anywhere, ever"* (`CLUB_FAMILIES_BOOK_P3_PROMPT.md:104`); a match is a question, never an answer. | absent |
| 3 | The "one club send window" parts (`components/admin/kit/club/SendParts.tsx`) power Send the schedule / reminders / Message this family. Coaches are reached only as side effects (copies, coach asks, schedule send). Tournament announcements are the nearest "all coaches" send. Ruling: **two mail paths, never mixed** (colleague mail vs family mail). CASL finding: role-based mail to a named volunteer is not commercial if it carries no offer. | partly built: no group composer |
| 4 | People are scattered: club members (roles), rep team staff memberships, house-league coaches (name + email rows, no account), officials. Documents exist **only for players** (rep document templates), with no expiry. Private storage buckets with signed URLs are in use (permits pattern). Board tab ruling R1 (2026-11-06): names and roles only, never contact details. | absent |
| 5 | **Tournament** registration already has custom questions (short/long text, dropdown, checkbox, file upload). These are the tables `tournament_registration_fields` and `…_field_answers` (mig 056), gated on Tournament Plus. House league has fixed fields plus one waiver text and one "I have read and agree" tick, recorded as a consent. | partly built (tournaments only) |
| 6 | Camps/clinics: **absent**. Permits are **built** (Stage 10a); the scheduler splits permit time into slots held by rep teams or house league (`club_schedule_slot_programs`, house_league only today). Revenue accounting excludes "camps unless explicitly added"; instruction is flagged as its own tax class. | absent; permits built |
| 7 | Team sponsorships with a sponsor invoice: built in the Coaches Portal (team's money; R1 invoice is from the team; R2 no tax). The club site sponsor list is built (logos, links, last day; no money). ★ Ruled 2026-10-27: **one sponsor list per org; each sponsor says where it shows**. Pay links for people without accounts exist (Stripe Connect direct charges, the club is the merchant of record); **online payments are off in production** (Club Tier Stage 12). | partly built: no club money side |
| 8 | Club calendar is built and **read-only** (rep events, house-league games/practices, tournaments). There is no club-owned event. Rulings D3 (*the club never writes a team's schedule*) and D5 (read-only calendar in the first release, public club schedule deferred). ★ 2026-10-31: **no links sent to families** besides the pay link and unsubscribe; RSVP by email is out. | absent |

## 3. Where I disagree with the ask, or widen it

- **Item 1 is not a documentation task first.** A board brief written today has to say that there is no two-step
  sign-in and that our privacy policy is still an unpublished draft. Also, nothing has proven the areas built since the
  2026-10-16 access sweep (house league, families, the club areas) don't leak. A brief that leaves those out promises what the product doesn't do, which is a defect (CLAUDE.md, `/legal`
  rule), not a wording problem. So Stage 0 **fixes first, then documents**.
  - *Corrected by the owner 2026-11-10:* I had guessed the board's worry was US hosting. It isn't. The board asked
    **"does our data leak, and is it sold to vendors?"** and **"what happens if this one-person business stops?"**. The
    pack answers those two.
- **No SOC 2.** It is a long, costly audit sized for selling to enterprises. What a small vendor can honestly offer:
  certified infrastructure (Supabase, AWS, Stripe; each certification **verified on the supplier's own page before it is
  quoted**), holding as little as possible (no card data ever; the club is the merchant), the club in control of its
  data (export, delete), a breach procedure, and candour. An independent penetration test is the one paid step a board
  recognises; it is owner question Q5.
- **Items 5–8 must not be four features.** See the Goal. If camps get their own form builder, the house league gets a second one
  and sponsors a third. The foundations are the plan.
- **Item 3 should be live groups, not lists someone keeps up.** A hand-kept "all house-league coaches" list is wrong the
  day a coach is added. Groups are computed from who holds the role this season; saved custom lists exist only for the
  odd one-off.
- **Item 2, accuracy.** Free-text matching will always be a guess, and the rulings say a guess is only ever a
  *suggestion* the registrar confirms. Accuracy comes from also offering an exact path: each sign-up gets a short
  **friend code** that a parent can pass to the other family. A code match is exact. A typed name is a suggestion.
- ~~Item 4, record-only screening by default.~~ **Overruled by the owner 2026-11-10 (Q2):** a police check is only an
  example. The feature is **documents**: any document the club defines, with a file saved and a custom expiry. How a club
  manages its documents is up to the club, and the product never says "you can't keep a police check here". What
  stays our job is **who can open the files** (a documents seat) and what our terms say about clubs storing
  sensitive files (`/legal`, as the club's data).
- **Item 8 re-opens a ruling.** D5 kept the club calendar read-only. Club-owned events don't break D3 (they are the
  club's own, not a team's schedule), but they do need a new owner ruling to make the calendar writable for club events.

## 4. Shape: one trust track, then three foundations, then assembly

```
Stage 0  Trust pack (item 1) ───────────── runs in parallel from now
Stage 1  Friend requests (item 2) ─────── standalone, house league exists
Stage 2  Group email to coaches (item 3) ─ needs the Stage 0 contact-email fix
Stage 3  The club's people + credentials (item 4)  ── FOUNDATION: People (adds groups to Stage 2)
Stage 4  Forms (item 5) ───────────────── FOUNDATION: Forms (first used by house-league sign-up)
Stage 5  Club events (item 8) ─────────── FOUNDATION: Club events (calendar + club site)
Stage 6  Sponsorships (item 7) ────────── Forms + Club events + Club Tier Stage 12 payments
Stage 7  Camps & clinics (item 6) ─────── Forms + Club events + permits + Stage 12 payments
```

Order is by dependency and rework risk. Release timing is never part of it. Stages 0 and 1 can start while Club Tier finishes. 2 and 3
can swap: groups are live queries, so People only *adds* groups and does not rewire them. 6 goes before 7 because the
owner marked sponsorship important. Both need online payments on in production (Club Tier Stage 12) before a live
sponsor or camp payment, though everything up to the pay button can ship first.
**Every stage gets its own drawing session (`/design`, Artifact, true size) before it is built.**

## 5. Stages

### Stage 0 — Trust pack (item 1)
**0a · Fix what a board would find** (each is a real defect; most belong to Club Tier Stage 8 Release readiness, which
points here, so they aren't tracked twice)
- [ ] **Third access sweep** (replaces "contact-email leak", which was already fixed `b15b01fea` 2026-10-16). It is
  report-only first, on the pattern of the second sweep (`TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md` § Second sweep). It covers
  every route and page added or changed since 2026-10-16, reads as well as writes, tenant boundaries and seat by seat.
  Each finding is fixed with the owner's go. It is the evidence behind the pack's "doesn't leak", and it comes before Stage 2.
- [ ] Two-step sign-in for club admin seats (owner, admin, treasurer, registrar) at minimum; Supabase Auth MFA. Owner call: offered or required.
- [ ] Org delete removes its file storage (gap in `LEGAL_FACTS.md`).
- [ ] Backups: confirm what the Pro plan does (daily backups vs point-in-time recovery), decide whether PITR is worth the add-on, and write it down in `docs/agents/ops/`.
- [ ] Publish the legal pages (privacy policy, terms) already tied to `GST_HST_STAGE6_TERMS_PLAN.md`, so this plan does not duplicate that work.
- [ ] Data-processing terms for clubs and a sub-processor list (`LEGAL_INDEX.md` rows "not started") via `/legal`.

**0b · ~~Canadian data residency~~** **RULED NOT MOVING** (owner 2026-11-10; §8 keeps the estimate). The pack states
plainly where data lives (USA, with the suppliers named), and that is all it needs to say.

**0c · The board pack** (written for a club board, not engineers; built after 0a so it can be honest). It answers the
board's two questions:
- [ ] **"Does our data leak, and is it sold?"** Security & privacy brief, two or three pages:
  - **never sold or shared for marketing**, backed by code facts in `LEGAL_FACTS.md`: no third-party analytics,
    advertising cookies, AI service or SMS;
  - who can see what (by seat, with the role table), and that platform staff access is audit-logged;
  - encryption;
  - sign-in (two-step);
  - how payments work: the club is the merchant and no card data is held;
  - backups and the breach procedure;
  - the club owns its data and can export and delete it;
  - sub-processors and what each does, with only the certifications stated on each supplier's page.
- [ ] The **privacy policy published** (it is the promise "we don't sell your data" in writing), via the legal-pages
  work already tied to `GST_HST_STAGE6_TERMS_PLAN.md`.
- [ ] Architecture diagram and data-flow diagram (what a family's sign-up touches, end to end).
- [ ] A filled-in vendor security questionnaire (the common short form), so the next board gets it on request.
- [ ] A public **Security** page on the marketing site, drawn from the brief (`/marketing` words, `/legal` review).
- [ ] Optional (owner Q5): an independent penetration test, with a summary letter for boards.

**0d · "What if something happens to the owner?"** (board concern 2026-11-10; the owner plans it **later**)
- [ ] Quick message points for the board, to use until the full write-up exists.
- [ ] A `/legal` session: what the terms promise on continuity (notice before the service stops, data export window,
  the club's data handed back), and whether anything needs a legal instrument.
- [ ] The continuity write-up. Candidate contents, for the owner to choose from:
  - who can step in (a named trusted person with sealed access to accounts);
  - a runbook so the service can be kept running or wound down;
  - the club's standing ability to export everything;
  - the notice period;
  - what happens to stored data.

### Stage 1 — Friend requests (item 2)
- [ ] Sign-up form: per child, "Who would you like {child} to play with?" Up to the **club's set maximum per child,
  default 2** (owner ruling 2026-11-10, Q3), first + last, plus an
  optional "their parent's name" to help the match. Each confirmed sign-up shows a short **friend code** on the
  "Your sign-up" page (no new link to families), and a parent may enter another family's code instead of a name.
- [ ] Registrar **Friend requests** queue in the season's registrations: each request shows its best suggestions from
  this season's sign-ups in the same division (normalised name, then parent name). The registrar chooses **Confirm**,
  **Pick another**, **Not signed up** or **Can't honour**. Code matches arrive confirmed. A request made both ways is marked
  "Both asked".
- [ ] Draft: confirmed requests become a **keep-together** group, using the "Families together" machinery. Groups are
  capped at a size (Q3) so friend chains can't break team balance, and the convenor can split one. After a draft, every
  request reads **Honoured** or **Not honoured — why** (cap, division, locked).
- [ ] Draft board: a Friends filter and a mark on the player chip, just like siblings.
- [ ] Transparency is **for the club's admins**: after the draft they see every request as Honoured / Not honoured,
  with the reason. **Parents get no honoured / not-honoured message** (owner ruling 2026-11-10, Q3). On "Your sign-up" a
  parent sees only what they asked for, and never another child's details.
- [ ] Migration first (request rows + code), then `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`.
- [ ] `/legal`: a parent typing another child's name, and how long requests are kept (purge at season end).

### Stage 2 — Group email to coaches and volunteers (item 3)
- [ ] **Email coaches** composer on the one club send window parts, on the colleague-mail path (reply-to the sender,
  no family footer), with a recount at Send.
- [ ] Live groups: All coaches · Rep coaches (head / all staff) · House-league coaches (this season, or one division)
  · Tournament coaches (one tournament). Stage 3 adds Board · Volunteers · "Needs a new {document}".
- [ ] Saved custom lists (pick people), kept small on purpose.
- [ ] Sent history with recipients, like the Families › Emails tab.
- [ ] CASL guard: colleague mail carries no plan, price or offer (`CASL_MEMBER_INVITE_EMAILS.md`). `/legal` reviews the
  wording rules.
- [ ] Prerequisite: the Stage 0a third access sweep (its findings on contact-detail reads).

### Stage 3 — The club's people and their credentials (item 4) — FOUNDATION: People
**3a · People**
- [ ] One admin-only **People** list for every adult who helps run the club: board, rep staff, house-league coaches,
  parent helpers, volunteers. It fills itself from the seats and rosters that already exist. Parent helpers who never sign in are
  added by hand or by CSV. One person, many hats, each with its season.
- [ ] Board tab ruling R1 stands: People is not public, and the board tab keeps names and roles only.

**3b · Documents** (owner ruling 2026-11-10, Q2: it is *documents*, and the club decides what they are)
- [ ] Club-defined **document types**: name (whatever the club calls it, e.g. "Vulnerable sector check", "Respect in
  Sport", "First aid"), a default expiry (N months from the date received, or never), and who needs it (by hat: all
  coaches, on-field helpers, board). No list of allowed or banned documents.
- [ ] Per person: the saved file (private bucket, signed links as permits do), the date received, and an expiry that
  defaults from the type but **can be set per document**, plus who recorded it. Files are opened only by seats the club
  grants to documents.
- [ ] Status board: Valid · Due soon (club-set window, e.g. 60 days) · Expired · Missing, filterable by hat.
- [ ] Reminders: an automatic notice to the person before expiry and on expiry, and **Email everyone who needs a new
  one** (Stage 2 composer, colleague mail).
- [ ] When a person without a valid required document is put on a team, the screen **warns and never blocks** (Q4).
- [ ] Migration first; dictionary + snapshots; `/legal` before drawing (retention of screening records, who sees them).

### Stage 4 — Forms (item 5) — FOUNDATION: Forms
- [ ] Generalise the tournament custom-questions model into one **club form**: question types (short answer, long answer,
  one choice, many choices, yes/no, date, file upload). Each is required or optional, with help text, in a set order.
  **No branching logic in the first pass** (push back if asked; that is where form builders get out of hand).
- [ ] **Document blocks:** the club attaches a PDF and the family must open it before ticking "I have read {document}".
  Ticks are recorded with the document version and time, like today's waiver consent, which becomes one of these blocks
  without losing existing consent records.
- [ ] First use: the house-league season sign-up (copy last season's form). Then tryouts, camps (Stage 7) and sponsors (Stage 6).
- [ ] Answers flow into the registrations list (columns + filter), the export and the draft board notes view, keeping
  ruling A8 (only seats that can open registrations see notes and answers).
- [ ] Gate: the tournament version is Tournament Plus value today, so the club gate is a `/strategy` call (Q6).
- [ ] Migration first; dictionary + snapshots.

### Stage 5 — Club events (item 8) — FOUNDATION: Club events
- [ ] A club-owned event: name, kind (banquet, champs day, AGM, clinic, camp, other), date and time, venue from the venue
  library, optionally held from permit time, and audience (public · families · members · staff).
- [ ] Shows on the club calendar (writable **for club events only**; teams' schedules untouched, D3) and in an **Events**
  section on the club site and in the family app. No RSVP links by email (2026-10-31); a sign-up uses a Stage 4 form.
- [ ] Champs day: an event that gathers the house-league playoff or final games under it.
- [ ] Owner ruling owed: D5 reopened for club events (Q7).
- [ ] Migration first; dictionary + snapshots.

### Stage 6 — Sponsorships (item 7)
- [ ] Club **sponsorship packages**: name, price, what's included (a list of deliverables: logo on the site, field banner, jersey
  crest, named division), how many are available, and an optional sponsorship document (PDF) to send.
- [ ] **Sponsors and deals:** a deal is a sponsor + a package + what it's attached to (the club · a house-league division ·
  a house-league team · a club event · a tournament) + an amount. States: Offered · Form received · Invoiced · Paid ·
  Delivered.
- [ ] **The sponsor link:** a page the business opens without an account. It shows the package, the club's sponsorship form (Stage 4),
  a logo upload, then pay by card (Stripe Connect direct charge, the club is the merchant) or "we'll send a cheque / e-transfer" (recorded by the club).
  A business is not a family, so the 2026-10-31 family-links rule doesn't apply. The tournament team pay link is the
  precedent. `/legal` checks it.
- [ ] **Club invoice** PDF and receipt. The coach invoice's no-tax ruling (R2) was about teams. A club may be a GST/HST
  registrant, and a sponsorship with advertising is not a donation. The tax shape researched in §9 needs the owner's
  acceptance before this is drawn (Q8).
- [ ] **Delivery checklist:** what they got, ticked as each item is delivered.
- [ ] The paid deal feeds the **one sponsor list** (ruled 2026-10-27), so the logo shows where the deal says.
- [ ] Money lands in the club books as sponsorship income. Renewal next season: "Offer again" from last year's deals.
- [ ] Team sponsorships in the Coaches Portal stay the team's (2026-11-06 ruling). They are not merged or moved.
- [ ] Live card payment waits on Club Tier Stage 12's production switch; everything else can ship first.
- [ ] Migration first; dictionary + snapshots.

### Stage 7 — Camps and clinics (item 6)
- [ ] A camp or clinic is a club event (Stage 5) with sessions, a capacity, a price, a waitlist and a sign-up form (Stage 4).
- [ ] Time is held from permit time through the scheduler, adding a camp program alongside house league.
- [ ] Sign-up and pay reuse the house-league path: no account at sign-up, the "Your sign-up" page for status / pay /
  withdraw (2026-10-31 rules), and placement confirmed by the club.
- [ ] Listed in the club site Events section with a Sign up button. An instructor sees the roster and takes attendance.
- [ ] Accounting: add camps as a revenue category, since the readiness plan excludes it "unless explicitly added". Tax class
  for instruction: the per-program Exempt/Taxable setting from §9 (Q8).
- [ ] Live payment waits on Club Tier Stage 12, as for sponsorships.
- [ ] Migration first; dictionary + snapshots.

## 6. Architectural decisions (proposed, for the owner)

- **Three foundations, then assembly** (People, Forms, Club events). **Rationale:** items 5–8 share one shape; four
  separate builds would mean four form builders and four payment flows.
- **Matching suggests and the registrar confirms; a friend code is the exact path.** **Rationale:** the "a match is a
  question" ruling, and accuracy without guessing.
- **Coach groups are live queries.** **Rationale:** a hand-kept list goes stale every season.
- **Documents are the club's to define** (owner, 2026-11-10). They can be any type, with a saved file and a custom expiry. **Rationale:** how a club
  manages its documents is its own business; the product's job is access control on the files.
- **Fix, then document.** **Rationale:** a security brief that leaves out known gaps is a defect.
- **Team money stays the team's.** **Rationale:** the 2026-11-06 ruling; club sponsorships are a new club-level book
  beside it.

## 7. Open questions (owner)

- [x] **Q1 Data residency** — RULED 2026-11-10: **not moving.** The board's concern was leaks and data being sold, not
  location (§8).
- [x] **Q2 Documents** — RULED 2026-11-10: generic documents, any type, saved files, custom expiry; the club decides.
- [x] **Q3 Friend requests** — RULED 2026-11-10: the club sets the maximum per child, default 2; admins see honoured /
  not honoured after the draft; parents get no such message.
- [x] **Q3b** — RULED 2026-11-10 ("agree with your recommendations"): the largest keep-together group is 3 children,
  siblings counted. *Not ruled:* the recommendation also offered "or club-set like the maximum". Ask at the Stage 1
  drawing whether the club can change it.
- [x] **Q4 Missing document** — RULED 2026-11-10: **warn, never block**.
- [ ] **Q5 Penetration test:** still open (no recommendation was made). Recommend deciding once 0a is done, when the pack is ready.
- [x] **Q6 Gates** — RULED 2026-11-10 ("agreed"): §9 as written; `/strategy` logs it.
- [ ] **Q7 Ruling D5:** let the club calendar hold club-owned events?
- [x] **Q8 Tax** — RULED 2026-11-10 ("agreed"): the §9 shape.
- ~~Q9 Board proposal scope~~. **Withdrawn (owner 2026-11-10):** the owner sets the priority sequence as the project
  goes, as on every project. The plan recommends, and the owner decides.

## 7b. Execution order (recommended 2026-11-10; the owner sets priority as it goes)

Each build step is drawing (`/design`), then the owner's ruling, then the build, then a walk. Steps in the same wave can run in
parallel.

| # | Step | Wave | Waits on | Drawing? |
|---|---|---|---|---|
| 1 | **0a-1** Third access sweep (report, then fixes on the owner's go) | 1 | nothing | no |
| 2 | **Stage 1** Friend requests in the draft | 1 | nothing | yes |
| 3 | **0a-2** Two-step sign-in for club admin seats | 1 | nothing | yes |
| 4 | **0a-3** Org delete removes its files · backups written down (PITR call) | 2 | nothing | no |
| 5 | **0a-4** Privacy policy + terms published (the legal-pages work in GST/HST Stage 6) | 2 | that plan | no |
| 6 | **0c** Board pack: brief, diagrams, questionnaire answers, Security page | 2 | 1, 3, 4, 5 | the page only |
| 7 | **Stage 2** Group email to coaches | 2 | 1 | yes |
| 8 | **Stage 3** The club's people + documents with expiry | 3 | nothing (adds groups to 7) | yes |
| 9 | **Stage 4** Custom forms (house-league sign-up first) | 3 | nothing | yes |
| 10 | **Stage 5** Club events | 3 | Q7 | yes |
| 11 | **Stage 6** Sponsorships | 4 | 9, 10; live card pay waits on Club Tier Stage 12 | yes |
| 12 | **Stage 7** Camps & clinics | 4 | 9, 10; live card pay waits on Club Tier Stage 12 | yes |
| — | **0d** Continuity message points + `/legal` + write-up | when the owner calls it | — | no |
| — | **Q5** Penetration test | decide after 6 | — | — |

Why this order:
- Wave 1 has the two things a board will test, safety and the registrar's biggest spreadsheet, and needs nothing else.
- The pack (6) waits for the fixes it describes.
- Group email (7) waits on the sweep (1) because it is a recipient picker.
- People (8) adds groups to it rather than rewiring it.
- The three foundations (8–10) come before the two assemblies (11–12). Sponsorship leads wave 4 on the owner's
  "important" mark.
- 11 and 12 can be built up to the pay button before Stage 12's production switch.

## 8. Moving production to Canada: effort and cost (researched 2026-11-10, for Q1) — **RULED: NOT MOVING**

> **Owner 2026-11-10:** *"we don't need to move the data, the board did not mention any concern of the data being in the
> US, just wanted to understand the security we have in place to ensure data doesn't leak or is being sold to vendors."*
> Kept below as the record of the estimate, in case it is ever asked again.

Measured read-only on production on 2026-11-10: 5 organizations, **no subscriptions**, 18 sign-ins, a 104 MB database
and 7 stored files (6.6 MB). This is the cheapest the move will ever be.

- **Engineering:** about **25–35 hours**:
  - new Supabase project in ca-central-1 (extensions, auth settings, buckets, realtime): ~3 h;
  - dump/restore rehearsal with password hashes and a parity check: ~5–6 h;
  - file copy plus the 6 stored logo/resource URLs rewritten: ~2 h;
  - project ref swapped in ~2 runtime files and ~25 scripts, Amplify env, Vault secrets, 12 pg_cron jobs replayed: ~3 h;
  - cutover runbook and smoke tests: ~4 h;
  - new Amplify app in ca-central-1 with a DNS move: ~5–8 h;
  - docs and `/legal`: ~2–3 h.
- **Owner's hands-on steps:** create the new project and app in the consoles, copy secrets, and make the DNS change.
- **Downtime:** about 30–60 minutes with writes frozen. **Everyone signs in again once.** Reset and verify links already
  sent stop working, and logos in already-sent emails break unless the old project stays paused for a few weeks as the
  rollback.
- **Cost:** about $10–20 once, for a month of overlap (a second Micro project plus a second Amplify app). **No ongoing
  difference** was found; regional price parity is unconfirmed on the pricing pages.
- **Both Amplify branches move** (one app serves `master` and `dev`). That also fixes today's oddity: the dev app is in the
  USA while the dev database is in Canada. Moving only the database leaves the app in the USA, which adds latency and
  moves nothing a board cares about.
- **What stays in the USA no matter what:**
  - Resend: email content and logs are always US-stored; there is no Canadian region.
  - Stripe: no residency option.
  - The business Gmail and the browser push services.
  - Possibly the server rendering: Amplify's current compute region is not documented; ask AWS before claiming it.

  The honest claim afterwards is **"the database and stored files are in Canada"**, never "all data in Canada".
- **Separate and not customer data:** FieldLogicHQ's own Bookkeeping (Aurora DSQL + S3, us-east-2). It bears on the open
  CRA records-in-Canada question (`docs/agents/accounting/RECORDS_RETENTION_AND_LOCATION.md`). DSQL availability in
  ca-central-1 is unconfirmed. In or out of scope is the owner's call.
- **Law, for the board:** PIPEDA does not forbid storing data abroad; it requires accountability, contracts and telling
  people (OPC transborder guidance). Québec Law 25 requires an assessment before data leaves Québec, *including to other
  provinces*, so Canadian hosting doesn't remove that step for a Québec club. BC dropped its public-body residency rule
  in 2021; Nova Scotia's status is unconfirmed. Both bind public bodies, not vendors.
- **Certifications:** Supabase states SOC 2 Type 2 (supabase.com/security), but the report itself is only available on its
  Team/Enterprise plans; Resend states SOC 2 Type II. Quote what each supplier's page says, nothing more.
- **Execution, if approved:** its own short plan from `/dba` + `/release` (rehearse once on a scratch project).

## 9. Specialist findings (2026-11-10; proposed, nothing ruled or logged)

**Gates (`/strategy` brief):** no new price, band or key.
- **Stage 0 is on every plan, never gated:** a security fix sold as an upgrade is a trust defect.
- **Stages 1–7 ride League Plus + both Club bands,** following the "plan choice follows what an organization runs, never
  an upgrade lever" rulings. The three-plan set already exists in code (the venue-library check), and `/billing` reuses it.
- **Stage 4:** reuse the existing custom-questions gate (Tournament Plus and up). The "I have read" consent tick is
  **never gated**.
- **Stage 6:** sponsor *display* stays with the public site. Decide the owed tournament sponsor-display gate together with
  Stage 6; tournament-only organizers get display only.
- **Drift:** none in prices or keys. The Facts header date is stale. The 2026-10-27 "one sponsor list per org" ruling is
  **not in the Business Decisions Log**, so log it.
- **Open:** who pays the card fee on a sponsor payment (the families-pay default doesn't fit a business).

**Tax (product research, not `/accounting`):** `/accounting`'s charter is FieldLogicHQ's own books and excludes a club's
tax. CRA sources were read 2026-11-10.
- **Sponsorship:**
  - A non-profit or charity giving recognition only (logo, banner) is generally *not making a supply*, so no tax.
  - A non-charity non-profit selling real advertising can owe tax if registered.
  - Small suppliers ($50k; charities $250k gross revenue) neither collect nor charge tax.
  - A sponsorship is not a gift, so no donation receipt.
  - **The product needs:** a club setting "registered for GST/HST" with the number (default **no tax**), a per-deal tax
    toggle, the rate by province (never hard-coded 13%), the deliverables listed on the invoice, and never the words
    "donation", "gift" or "tax receipt".
- **Camps and clinics:**
  - Supervised series primarily for children 14 and under are exempt (ETA Sch. V Part VI s.12; CRA GI-037).
  - Overnight camps, and programs primarily for those over 14, are taxable if registered.
  - **The product needs:** a per-program Exempt (default) / Taxable setting and a plain-language warning driven by the age
    range and overnight answer.
- **For house league the same rule gives the club's side:** default exempt, optional taxable switch. ⚠ Corrected
  2026-11-10: this does **not** settle Stage 12's D13, which also asks whether FieldLogicHQ is a platform collector. A
  pointer was added beside D13 in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`.
- **ACCEPTED by the owner 2026-11-10** ("agreed"): the tax shape above for sponsorship invoices, camps and house-league
  fees.
- **A professional should confirm:**
  - a given club's registrant status;
  - whether any club sells true advertising;
  - mixed-age leagues and U15+ programs;
  - one-off clinics;
  - Québec and the PST provinces.

## Words for /marketing
> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk.
- [ ] (none yet; the Stage 0c brief and Security page will be the first)
