# Signed-in family census — every place a family acts or is identified without a sign-in

> **Run 2026-10-31** from `SIGNED_IN_FAMILY_CENSUS_PROMPT.md`, against the 2026-10-29 direction (end state = a signed-in
> app; public = tournaments and team public pages only — `docs/agents/strategy/BUSINESS_DECISIONS.md:146-158`).
> **Read-only. It decides nothing.** Every row's path was opened and read in this session; helper summaries were leads only.
> Verdicts follow the 2026-10-29 direction as written; where the direction does not settle a row, the row is
> **Undecided** and carries a one-line question (§4).

## 0. Owner answers, 2026-10-31 (supersede the verdicts below where they differ)

Findings and proposals page: https://claude.ai/artifact/89YK6LSVhBxPnzFnrRZtpo (source `SIGNED_IN_FAMILY_CENSUS.html`).

- **Q1** — Signing up (house league or tryout) does **not** create an account. The account comes **when the child is confirmed
  on a team**, and is used for the schedule and team chat. → F1, F2 **Stays public**.
- **Q2** — Paying from an emailed link should stay if possible. → F3/F4/F5 are **not a stop-gap**: they are the family's
  permanent door between sign-up and the team. **Keep, harden** (proposals on the page: first names + status + money only;
  stop at season end; per-family reset; not sent when nothing is owed; "Email me my link" replaces email + reference).
- **Q3** — A calendar feed made inside the signed-in app is fine; what is ruled out is **sending** links. → F8 **Becomes
  signed-in (app)**, keep. D1 (RSVP by emailed link) → rewrite the plan so the reply lives in the app.
- **Q4** — Tryout scorers do not need a sign-in. → N1 keep.
- **Q5** — Tournament team pay link stays. → N2 keep.
- **Q6** — **Delete** the dormant claim link (recommendation accepted 2026-10-31).
- **A** — house league's "confirmed" = **placed on a team** (accepted). **B** — a signed-in returning parent gets a pre-filled
  form; the public form stays (accepted; waits on Stage 14).
- **Journeys asks 1–4** (accepted 2026-10-31, journeys page https://claude.ai/artifact/QmPoKvcyF3Bg1xpjCWw54C): tournament
  coaches keep their account at registration; an optional second guardian email; tidy up tournament registration now; "Your
  sign-up" also inside the app.
- **Recorded** in `BUSINESS_DECISIONS.md` 2026-10-31; **build plan** `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` + PM brief.

## 1. The doors

Verdicts: **Stays public** · **Becomes signed-in (app)** · **Stop-gap, retire** · **Undecided**. "Retire" means *does not
survive into the app* — the app replaces it — not "switch it off now"; until the app exists these are the only way a
house-league family can check on or pay for a child.

### 1a. Built — family-facing

| # | Door | Who | What it lets them see or do | How it is secured | State | Where | Verdict |
|---|---|---|---|---|---|---|---|
| F1 | House-league public sign-up form | parent | signs up to 8 children; ticks the waiver and an email-consent line; gets an email with a reference; **leaves with no account** | none; public-form throttle (per IP, global, per guardian email); no captcha | built (9b-1) | page `app/[orgSlug]/league/[seasonSlug]/register/page.tsx:30`; API `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts:64`; "no family account" `docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md:331` | **Undecided — Q1** |
| F2 | Rep tryout public sign-up form | parent | registers one child for a tryout; ticks consent boxes; gets a receipt email (no link); **leaves with no account** | none; throttled; club public + tryouts open | built | page `app/[orgSlug]/teams/[teamSlug]/tryouts/register/page.tsx:21`; API `app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts:29` (required fields :80-85) | **Undecided — Q1** |
| F3 | "Check your registration" — status by email + reference | parent (or anyone holding both) | every child on that sign-up: name, division, status, waitlist place, what is owed and paid, the pay block | guardian email + an **8-hex-character reference (32 bits)** generated at `register/route.ts:60-61`; older sign-ups also accept the first 8 characters of the registration id (`lib/utils.ts:149-151`); throttled | built (9b-1) | page `app/[orgSlug]/league/[seasonSlug]/status/page.tsx:20`; API `app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts:37` (match at :84); the reference + link in every league email `lib/email.ts:907-911` | **Stop-gap, retire** — exists because the family has no account (`HOUSE_LEAGUE_STAGE9_PLAN.md:331`); direction item 3 puts a parent's view of their child behind a sign-in (`BUSINESS_DECISIONS.md:151-152`) |
| F4 | House-league **pay link** — the status page already unlocked | parent | the same view as F3 with no reference needed, plus Pay (card or bank debit), receipts, and "Ask to withdraw a child" | HMAC over the registration id; **never stored, never expires, cannot be revoked one at a time** (only by rotating the shared secret, which also kills every tournament pay link) — `lib/league-pay-link.ts:2,24,64`; plan says so `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md:610-611` | built (12b); online payments currently switched off (`lib/online-payments-switch.ts:17`) | page `app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx:32`; Checkout `app/api/pay/league/[token]/route.ts:65`; sent in sign-up, approval, waitlist promotion, placement and moved-team (`lib/house-league-placement-mail.ts:42-44` — **sent even when nothing is owed**), receipt, "Email the pay link", returned-debit emails | **Stop-gap, retire** for the unlocked status view (child names, withdraw) — same reason as F3. **Undecided — Q2** for a pay-only link |
| F5 | Ask to withdraw a child | parent | writes a withdraw note (300 characters) and raises a Needs-attention item | either F3's email + reference or F4's token; throttled | built (9b-2) | `app/api/league/[orgSlug]/[seasonSlug]/withdraw-request/route.ts:24` (accepts the code at :40) | **Stop-gap, retire** — moves into the parent's signed-in view with F3 |
| F6 | Family unsubscribe link | guardian | opts that email out of the club's family mail | HMAC of org + email, deterministic, never expires; the email address is in the link. **⚠ Finding:** if the unsubscribe secret is not set, the code falls back to a fixed string (`lib/unsubscribe-token.ts:13-20`), which would let anyone forge an opt-out for any address | built | built `lib/unsubscribe-token.ts:126-130`; added to every family email `lib/family-email.ts:146`; lands `app/unsubscribe/route.ts:66` | **Stays public** — a commercial-email opt-out has to work without signing in (CASL); a signed-in app still sends email |
| F7 | Guardian invite → claim | guardian (rep team) | connects a parent's account to one child on a rep team | random token stored hashed, 14-day expiry, single use (`lib/family-guardian.ts:340-346`); **redeeming needs a signed-in account**; whole tier off unless the switch is on (`lib/family-guardian.ts:41`) | built, **switched off** pending counsel | claim page `app/(consumer)/family/claim/[token]/page.tsx:18`; API `app/api/family/claim/[token]/route.ts:36` | **Becomes signed-in (app)** — this *is* the parent-to-child link the app needs; but see §4 (it hangs on a per-season row) |
| F8 | Family calendar feed (rep) | connected guardian | team-level events incl. practices and their addresses in the family's calendar app; no player names | random token stored hashed, minted only from the **signed-in, verified** family view (`app/api/family/teams/[teamId]/route.ts:65`, `lib/family-access.ts:389-391`); revoked with the link; a new press replaces the old one | built; unreachable while the guardian tier is off (`lib/walkthrough-content.ts:402-404`) | `app/api/family/calendar/[token]/route.ts:36` | **Undecided — Q3** |

### 1b. Built — not a family, but a parent may hold it

| # | Door | Who | What | Secured | State | Where | Verdict |
|---|---|---|---|---|---|---|---|
| N1 | Tryout scoring link | volunteer evaluator (often a parent) | lists the tryout's children (names, or bib numbers only when blind) and records scores | random token stored hashed, 48-hour expiry, revocable, reissuable (`lib/tryout-evaluator-token.ts:26`) | built | `app/api/tryout-score/[token]/route.ts:44`; page `app/tryout-score/[token]/page.tsx:7` | **Undecided — Q4** |
| N2 | Tournament team pay link | the team's contact (coach / manager) | what the team owes, pay, receipts — not the team's record | HMAC over the team id, never stored, never expires (`lib/team-pay-link.ts:56-60`) | built (12a); payments switched off | page `app/[orgSlug]/[tournamentSlug]/pay/[token]/page.tsx:15`; API `app/api/pay/team/[token]/route.ts:62` | **Undecided — Q5** |
| N3 | Tournament team registration form | coach / manager | registers a team; no child data | none; **no throttle, no captcha** | built | `app/[orgSlug]/[tournamentSlug]/register/page.tsx:12`; `app/api/register/route.ts:221` | **Stays public** — tournaments stay public (`BUSINESS_DECISIONS.md:150`) |
| N4 | Tournament team workspace claim link | tournament team rep | shows a claim card without signing in, then a paid workspace after sign-in | random token stored hashed, 90-day expiry | built but **dormant** — the only code that mints one is a dev seed route (`app/api/dev/seed/team-claim/route.ts:42`) | page `app/coaches/claim/[token]/page.tsx:39` | **Undecided — Q6** |

### 1c. Stays public by ruling (listed so nobody re-audits them)

| # | Door | What it shows | Where | Verdict |
|---|---|---|---|---|
| P1 | Public team page | team, about, **games only**, coach names that opted in; no players, no practices (excluded at the query, `lib/family-view.ts:87`) | `app/[orgSlug]/teams/[teamSlug]/page.tsx:49` | **Stays public** |
| P2 | Public team calendar | the same games-only feed, no secret by design | `app/[orgSlug]/teams/[teamSlug]/calendar/route.ts:24` | **Stays public** |
| P3 | Tryout information pages | dates, place, birth-year band, club contact | `app/[orgSlug]/tryouts/page.tsx:66`; `app/[orgSlug]/teams/[teamSlug]/tryouts/page.tsx:29` | **Stays public** (no private data, no act) |
| P4 | Public tournament pages, follow-a-team (stored in the browser), fan score cards | public data only | `app/api/consumer/follows/entities/route.ts:23` | **Stays public** |

Family emails with **no** secret in them (informational, not doors): game-change notice (link needs sign-in,
`lib/family-notify.ts:141`), club "Email families", rep announcements, dues reminders, declined/withdrawn emails, refund emails,
bank-debit started, league schedule published (links the public schedule), league practices changed, tryout receipt.

### 1d. Planned or drawn

| # | Door | Who | What | Secured | State | Where | Verdict |
|---|---|---|---|---|---|---|---|
| D1 | Availability / RSVP from an email | guardian | answer In / Out / Maybe for one event; sees the child's first name + last initial | token per event, child and email, hashed, expires at the event | **planned** (Proposed 2026-08-03, not started) | `docs/projects/active/COACH_AVAILABILITY_RSVP_PLAN.md:3`, token page :75-90 | **Stop-gap, retire — before it is built.** It is a no-login family door the direction rules out (`BUSINESS_DECISIONS.md:152`); the plan itself names the signed-in family portal as the other channel (:86-87, :94) |
| D2 | 9f "Invite last season's families" with a pre-filled form | returning family | re-register with details filled in | not specified | planned, waits on Stage 14 | `HOUSE_LEAGUE_STAGE9_PLAN.md:396` | **Becomes signed-in (app)** — pre-filling a public form needs either a secret link (ruled out, `BUSINESS_DECISIONS.md:152`) or a known parent, which is the app |
| D3 | Per-team unsubscribe for free coaches' families | family | opt out of a free team's mail | an unsubscribe token keyed to the team (none exists; the club one has no org to key on) | open gap | `CLUB_FAMILIES_BOOK_PLAN.md:504-508` | **Stays public** (same reason as F6); the shape is still the owner's call recorded there |
| D4 | 9d-3 first practice email | household | lists practice dates; **no link** | nothing to secure | drawn, asks open | `HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html:1122-1126` | not a door |

### 1e. Already removed or withdrawn (no action; listed so they are not rebuilt)

- **Tryout offer Accept / Decline link** — removed 2026-08-26 (`lib/no-login-token.ts:8-9`). The database column for its token
  is still there and only ever cleared (`lib/db.ts:4537`).
- **Team family join link** — removed 2026-09-12 (`COACH_FAMILY_LINK_REMOVAL_PLAN.md`).
- **Shared single-game page** — removed 2026-09-20 with "Share game link" (`OWNER_QA_LEDGER.md` §209). Still described as a
  live level in older ledger text (`OWNER_QA_LEDGER.md:612-618`, and the ticked walk item at :637) — history, not current.
- **9d-3 family calendar link, its add-to-calendar page, the household link (b2) and the calendar button in the practice-change
  email** — withdrawn 2026-10-29 (`BUSINESS_DECISIONS.md:153`; `HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html:594,604,1161`).

## 2. Where the rework risk is concentrated

Almost all of it is in **one door: the house-league family's status page**, reached three ways (F3 reference, F4 pay link, F5
withdraw). It is the only place a house-league family sees their child after signing up, the only place they pay, and the only
place they ask to leave — and Stage 9 (9b-1, 9b-2, 9c placement mail) and Stage 12 (12b–12d: pay, receipts, bank debit,
disputes) were both built on the explicit premise of *no family account* (`HOUSE_LEAGUE_STAGE9_PLAN.md:331`). The pay link is
also the hardest kind of link to take back: it never expires, it is in every house-league email including placement emails that
owe nothing, and it can only be killed for everyone at once. **The point the owner should weigh:** the 10-29 direction does not
just stop new stop-gaps — it reverses the family side of two built stages. That is cheap **today** (online payments are switched
off, no customers, no link has reached a real family) and gets more expensive with every family that receives one. The second
cluster is the two public sign-up forms (F1, F2), which decide where the parent's account would be born (Q1). Everything else
is small, dormant, or not yet built.

## 3. Doors that hold a child's information (for counsel)

| Door | Child data |
|---|---|
| F1 house-league sign-up | first and last name, **date of birth** (required when divisions sort by age), jersey and position wishes, **a 500-character free-text note** stored as-is (`register/route.ts:101`) |
| F2 tryout sign-up | first and last name, **date of birth (required)**, a 500-character free-text note (`tryouts/.../register/route.ts:71-82`) |
| F3 / F4 status page | every child on the sign-up: name, division, status, waitlist place, what is owed and paid — opened by 32 bits plus an email, or by a link that never expires |
| F5 withdraw request | a 300-character note about the child |
| N1 tryout scoring link | the tryout's children's names (unless blind) and the scores given to them |
| F7 guardian claim (when switched on) | links an adult account to a named child; records consent |
| D1 RSVP (planned) | child's first name + last initial per event |

Worth counsel's eye specifically: the **free-text notes** on both public forms are where a parent will type an allergy or a
medical condition, and nothing on either form was designed to hold health information.

## 4. What the Stage 14 child record would have to anchor

Today **there is no child record** — a child exists only as a per-season row: a house-league sign-up row (name, date of birth,
guardian email inline), a tryout sign-up row (the same, again), and a rep roster row. For a parent-to-child link to survive a
season, the durable child record would have to anchor:

1. **The guardian link itself.** Today it points at a per-season rep roster row and is required to (`COACH_FAMILY_LINK_REMOVAL_PLAN.md:60-62`),
   so a verified parent is disconnected by the next season's roster.
2. **Every season's house-league sign-up and tryout sign-up**, which today carry the child's name and birth date as text on
   each row. The Families-book person on those rows is the **guardian**, not the child (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md:3120-3122`).
3. **Consents and waivers.** The sign-up consent row is keyed to the guardian's email and the one registration row it came from;
   Stage 14c already plans to move documents and waivers to the child with a "needs re-signing this season" state
   (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md:3146-3150`) — consent belongs on the same list.
4. **The parent's account**, as a person, not an organization member (`BUSINESS_DECISIONS.md:157`, P3).

**One tension to rule before Stage 14 is drawn:** the Families book ruled that a household is *confirmed by a human, not
inferred*, and called "what identifies a child?" the wrong question (`CLUB_FAMILIES_BOOK_PLAN.md:449-455`). A durable child
record is a universal child key; Stage 14 has to say how it gets one without inferring it.

## 5. Questions for the owner (one line each)

- **Q1.** When a parent signs a child up (house league or tryout), does that step create the parent's account, or does the form
  stay public with the account made later?
- **Q2.** In the app, can a family still pay from an emailed link that shows only the amount owed (no child names, no withdraw),
  or does paying always mean signing in?
- **Q3.** Is a calendar subscription made from inside the signed-in app, and revocable per family, allowed — or is it one of the
  "secret calendar links" the 10-29 direction rules out?
- **Q4.** Does a tryout volunteer scorer need a sign-in, or does the 48-hour scoring link stay?
- **Q5.** Does a tournament team's pay link stay (the payer is a coach or manager, and tournaments stay public), or must the
  team contact sign in to pay?
- **Q6.** Keep or delete the dormant tournament-team claim link, which nothing in the product sends today?

## 6. Findings outside the verdicts (report only — nothing was changed)

- **The family unsubscribe link can be forged if its secret is missing** — the code uses a fixed fallback string
  (`lib/unsubscribe-token.ts:13-20`). Whether the secret is set on production could not be confirmed from the repo.
- **The tournament registration form has no throttle and no captcha** (`app/api/register/route.ts:221`); the family forms are
  throttled but nowhere uses a captcha; their per-IP limit can be spoofed, with a site-wide limit as the backstop
  (`lib/public-form-throttle.ts:14-18`).
