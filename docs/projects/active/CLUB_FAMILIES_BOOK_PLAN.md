# The Families Book — club-admin family records

**Status:** Planning 2026-08-17. **Phase 1 BUILT on dev 2026-08-17** (migration 251) — records minted,
nothing in the product reads them. **Awaiting the owner's read of the §5-P1 report** (`node
scripts/report-families-backfill.mjs`). **Phase 2 mockup session DONE 2026-08-17** (design only, no
code) — all seven §5.2 gaps resolved in writing, see §5.3. Phases 2–5 not built. Read §5.1 + §5.3
before building Phase 2.
**Tiers:** Club **and League** (owner decision 2026-08-17 — see §1.2).
**Access:** a dedicated Families capability, off by default (owner decision 2026-08-17).
**Mockups (concept):** `claude.ai/code/artifact/f089153c-8583-4c5c-b8c3-d70c5278602b`
**Mockups (Phase 2, buildable — supersedes the concept set where they disagree):**
`claude.ai/code/artifact/e7cc6d9c-343e-45eb-8b94-fb9984f2b949` — see §5.3 for the decisions it embodies.
**Problem statement + evidence:** `claude.ai/code/artifact/e0600ea7-29ed-45dd-97a7-132f68c26c9a`
**Origin:** Finding #35 in `docs/agents/db/DB_ARCHITECTURE_REVIEW.md` (quarterly DBA health check, 2026-08-17).

---

## 1. What was decided, and what I argued against

### 1.1 The finding this rests on

Verified live against dev, not inferred from a plan:

- **70 distinct guardians are named on roster rows. Exactly 1 has a login.** 12 family invitations sent, 0 reached an account.
- A guardian has **no row anywhere**. Their identity is a text email typed onto each child's record, re-typed per child per season per program.
- Signed-in people (coaches, admins) **do** have identity. Children **partly** do — `rep_player_continuity_links` already links a player across seasons. The gap is specifically **the adult who is named but never signs in**.
- `family_links` is already a person↔player↔team link carrying `relationship` and a co-guardian route. It identifies the person by email/`user_id` rather than by a person record. **This is the reuse seam** — see §3.

### 1.2 Owner decisions (2026-08-17)

| Question | Decision | My recommendation | Note |
|---|---|---|---|
| Who can open a family record | **Admins holding a new Families capability**, off by default | same | Agreed |
| Which tiers | **Club and League** | Club only | **Owner overruled, and I now think correctly** — a family with one child in house league and one on a rep team is invisible in *both* modules today. The person record is the only thing that could join them. It does mean league registration guardians must mint people from day one. |
| How far actions go | **Full actions inside the Families area** | Originate-then-hand-off | **Owner overruled after I raised the duplication concern.** Proceeding as directed. The constraint I am holding instead is in §1.3. |

### 1.3 The binding constraint on "full actions"

I raised that full actions rebuild surfaces that already exist (money hub, announcements) and risk two sources of truth. The owner decided for full actions. **Proceeding — with one rule that is not negotiable in review:**

> **An action taken in Families MUST write through the same code path as the equivalent action on its existing surface.** Two doors, one mechanism. No parallel implementation of "record a payment", "send a message" or "record consent".

Rationale: this is the twin-table problem (Finding #34) reappearing at the UX layer. Two implementations of one write is how the money hub and the family page start disagreeing about what a family owes. If a shared path does not exist for an action, **extract one first** — do not fork.

### 1.4 Naming

`module_members` is **already taken** and means staff/admin management (`app/[orgSlug]/admin/org/members`). This area is **Families**, matching the existing `family_links` / family portal vocabulary. Do not call it Members or People.

---

## 2. The two jobs (design brief)

**Lookup.** A parent phones; the registrar finds them by a child's name, a misremembered email, or a phone number, and sees everything at once. Wants search + one dense page.

**Worklist.** Nobody phoned. Eleven families haven't paid, four haven't signed a waiver, thirty played last year and haven't come back. Wants filtered lists + bulk actions.

**Design consequence:** most directory features get built for the lookup job and then go unused — a lookup tool is opened when something goes wrong, a worklist is opened every Monday. **Build the worklists first and let the family page be where a worklist row lands.**

---

## 3. Data model

### 3.1 `org_people` — org-scoped, never platform-wide

`id` · `org_id` (NOT NULL, FK, **indexed** — mig 249's rule) · `email_normalized` (NOT NULL) · `first_name` · `last_name` · `phone` · timestamps · `UNIQUE (org_id, email_normalized)`.

**Org-scoped is a privacy decision, not a technical one.** A platform-wide person record would let one club's data confirm a guardian exists at another club. The same parent at two clubs is deliberately two records.

### 3.2 Former addresses

`org_person_emails` (`person_id`, `email_normalized`, `is_current`, `first_seen_at`, `last_seen_at`, `UNIQUE (org_id, email_normalized)`). Former addresses stay **searchable** — this is what makes a merge safe and a phone call short, and it is how the "changed their email" failure gets closed rather than papered over.

### 3.3 The person↔child relationship — ⚠ CORRECTED 2026-08-17, my first proposal was wrong

**My original proposal was to reuse `family_links` as the relationship table. Verified against the live schema, that does not work, and it fails precisely on the scope the owner added.**

Three facts checked rather than assumed:

| Claim in my first draft | Reality | Consequence |
|---|---|---|
| `family_links` can be the person↔child link | **`family_links.rep_team_id` is NOT NULL** | It is **rep-team-bound by construction** and cannot represent a guardian↔child relationship for a **house league** child. Reusing it breaks half the Club+League scope. |
| `basic_coach_team_players.contact_email` is a source | **`basic_coach_teams` has NO `org_id`** — the free coach product hangs off `team_workspaces`, not an org | An **org-scoped** `org_people` has no org to scope those rows to. **Not a source.** Excluded. |
| League registrations are org-scoped like the rest | **`league_registrations` has NO `org_id`** — it reaches org 2-hop via `season_id → league_seasons.org_id` | Minting requires the join, and the new `person_id` column should arrive **with a denormalized `org_id`** to satisfy the 1-hop tenant rule (Findings #4/#5 precedent). |

**Corrected design — the relationship is `person_id` on each source row:**

- Mint `org_people` from four sources: `rep_roster_players.guardian_email`, `rep_tryout_registrations.guardian_email`, `league_registrations.guardian_email` (via the season join), and `family_links.invited_email`/`claimed_email`.
- Add nullable `person_id` to each. **On `league_registrations`, add `org_id` in the same migration** (NOT NULL after backfill, indexed).
- **`family_links` keeps its current job** — portal access for a rep team's guardians — and simply gains `person_id` so an invited guardian resolves to the same person. It is not promoted into a general relationship table.
- A child's guardians are therefore "every source row for that child carrying a `person_id`", unioned across rep and league. **This is simpler than my original proposal and is the only shape that spans both modules.**

⚠ `family_links` covers only the **12 invited** families against **70 named** guardians — it was never going to be the spine regardless.

### 3.4 What does NOT change

- **Existing email columns stay**, as the honest record of what was typed. This is what makes every phase reversible.
- No column is dropped. No module converts at once.

---

## 4. Matching rules (the riskiest part)

**Matching too eagerly is worse than leaving duplicates** — a wrong merge shows one parent another parent's children.

- **Auto-match on exact normalized email only.**
- Propose for review: same surname + same phone; same surname + a shared child.
- **Never auto-merge** anything else.
- **"Not the same person" must be remembered**, or the pair resurfaces weekly and the reviewer stops trusting the queue. (Same tombstone discipline as `rep_player_continuity_links.status='rejected'`.)
- **On merge, the STRICTEST contact preference wins.** If either record is opted out, the merged family stays opted out. A "newest wins" default would silently re-subscribe people who asked not to be contacted — precisely the failure this project exists to prevent.

⚠ **Normalize on write, everywhere.** Today `early_access_leads` has a stored `email_normalized` column while `family_links` normalizes in application code only. Two disciplines for one job is how two spellings of one parent become two parents.

---

## 5. Phases

⚠ **REORDERED 2026-08-17 (owner-approved), after Phase 1 shipped.** Two corrections, both of which
this plan had already argued for and then contradicted itself on:

1. **The original ordering was "proven against real club data before anything depends on it."** There
   is no real club data (§5.1) and waiting for some is not a plan. The gate is replaced: **seed a
   deliberately messy fixture club** and prove matching against manufactured failure cases — the same
   parent under three spellings, one who changed address mid-season, siblings split across a rep team
   and house league, a shared family inbox on two surnames, an opt-out reappearing under a new
   address. Because production is empty, we are free to build a broken club and iterate against it as
   often as we like. That fixture becomes the permanent test bed for every screen after it.
2. **⚠ The old P2/P3/P4 contradicted §2 of this same plan.** §2 says *"a lookup tool is opened when
   something goes wrong, a worklist is opened every Monday — build the worklists first and let the
   family page be where a worklist row lands"*, and the approved mockups open with the worklist and
   bundle the actions into the first release. The phase list then shipped a read-only directory
   first, which is the textbook feature that gets built and goes unused. **The mockups win.** The
   usual reason for a read-only half-step — de-risking against live customers — does not apply here.

### P1 — Build the records, show nobody ✅ BUILT ON DEV 2026-08-17 (migration 251)
Mint `org_people` + `org_person_emails` across rep, tryout, league and family-link sources (**not**
basic-coach — see §3.3). Add nullable `person_id` columns, plus `org_id` on `league_registrations`.
Nothing in the product reads any of it.
**Exit criterion:** a report the owner and I read together — `node scripts/report-families-backfill.mjs`
(`--prod` for production, `--json` for machine use). **If those numbers look wrong we fix matching
before a screen exists.**

### 5.1 What Phase 1 actually established — read this before starting Phase 2

**⚠ THE EXIT CRITERION IS NOT YET MET, and a green report does not meet it.** This plan's premise was
that minting people from drifting addresses would be *proven against real club data* before anything
depended on it. **There is no real club data.** Production holds exactly one organization carrying
families and it is the Riverdale Ridge demo club; dev holds that same club plus five test/QA orgs. So
the run below proves the MECHANISM, not the MATCHING.

**The report script is therefore the deliverable, not its current numbers.** Re-run it against the
first real club; *that* is when Phase 2 may start.

Run of 2026-08-17 (dev): **117 people across 5 orgs, 117 addresses, every integrity invariant zero.**

| Finding | Number | What it means |
|---|---|---|
| Roster children with no guardian at all | **64 of 163 (39%)** | Nothing to match. An unattached row is the honest outcome, not a failure to try harder — but it caps what any Families screen can show. |
| Guardians in more than one source | 12 | All `family_link ↔ rep_roster` in the demo club. |
| **Parents with children in BOTH rep and house league** | **0** | ⚠ **The entire commercial premise of the Club+League decision is unexercised.** No org on either database has both. |
| Suspected duplicates (surname+phone, shared child) | 0 | Nothing to review yet. |
| Malformed guardian addresses | 2 | Correctly minted nothing. |
| Address changes witnessed (invited→claimed) | 0 | No `claimed_email` exists anywhere, so the former-address path is untested by real data. |
| People whose only source is a tryout | 28 | Kept, deliberately — see the `rep_tryout_registrations.person_id` dictionary entry. |

**⚠⚠ THE FINDING NOBODY ASKED FOR, AND THE ONE THAT SHOULD CHANGE A PHASE: the CHILD has the same
identity problem the PARENT had.** Birth dates are recorded on **1 of 163 roster rows and 0 of 30
tryout rows** (league is better: 21 of 23). So "the same child" can only be judged by name within an
org. Consequences that are not optional to accept:

- **"Same surname + a shared child" (§4) is much weaker than this plan assumed** — it is a name match,
  and it is offered as a proposal for a human precisely because it cannot be more than that.
- **Sibling counts are an INFERENCE, not a fact.** A child registered twice under a nickname reads as
  two siblings; two same-named children in one club read as one.
- **P5's sibling discount and household payment plan rest on that inference.** They should not be
  built until child identity has had its own decision — the same conversation this project just had
  about parents. That is a new open question, added as §8.5.

Two smaller decisions taken during the build, both recorded in `DATA_DICTIONARY.md` rather than here:
**no contact preference is stored on the person in Phase 1** (they already live in two ledgers keyed
on the same `(org, email)`; copying them is the twin-table problem in the one place where being wrong
means emailing someone who opted out — Phase 3 attaches them, strictest-wins), and **`person_id` is
resolved through `org_person_emails`, never through `org_people` alone**, so a row carrying a parent's
old address lands on the same person.

### P2 — The Families area, worklist-first (the mockups' first release)

One release, built in the mockups' own order. Chunks are sequenced, not parallel.

**A · The messy fixture club.** Seed a throwaway org carrying the failure cases listed above. Half a
day, and it unlocks every chunk after it — today the duplicate queue and the cross-programme
household have *nothing* to render (§5.1). Do not seed it into either public demo world.

**B · The area, behind its capability.** A dedicated Families capability, **off by default**.
⚠ Check it on **the specific family being opened**, not "is this an admin" — the coach
player-documents leak needed **both** `documents` **and** `rosterPii`, and one check that looked
sufficient was not. This screen concentrates far more than that one did.

**C · The worklist as the landing.** Not an A–Z list: *owes money · missing forms · no consent · not
back this season · possible duplicates*, with search in the toolbar rather than as the front door.
⚠ Several mockup columns cannot be honestly filled from today's data — see §5.2 before building.

**D · The family page**, where a worklist row lands. Children across rep **and** league, household
balance (**read only in this chunk** — see the money note below), current *and former* contact
details, consent, outstanding forms, history.

**E · The duplicate review queue.** "Not the same person" **must be remembered**, or the pair
resurfaces weekly and the reviewer stops trusting the queue. On merge, the **strictest** contact
preference wins.

**F · Three actions, each through the existing write path (§1.3).** Message the household · record a
payment against the family · export their data.

> ⚠ **Money sequencing.** The household balance and "record a payment" reach into the money module,
> which has just shipped a large redesign with QA walks still owed. Build the balance as a **read**
> in chunk D; add the payment **write** in chunk F, after those walks land. Two doors, one
> mechanism — if a shared write path does not exist, **extract one; never fork**.

### P3 — Household money and the quiet extras (the mockups' second release)

> **Session prompt written 2026-08-17:** `CLUB_FAMILIES_BOOK_P3_PROMPT.md` — gated on owner QA §54
> passing, a real trigger, the money QA walks (for the payment write), and the §8.5 child-identity
> decision (for the household-money four). P3 opens with its own mockup session; chunk A is the
> through-the-person suppression fix for EVERY sender (mig 251's recorded Phase-3 warning).
Sibling discount · financial assistance · household payment plan · move a credit between siblings ·
bounced/undeliverable flag · internal notes with an author and a date.

⚠ **The first four are BLOCKED on the child-identity decision (§8.5)** — they pay real money against
an inference the data does not currently support. The last two are not, and can go earlier if useful.

**P1 and P2 are independently useful** — if the project stalled after P2, a club would have something
it has never had. That is the test a phased plan should pass.

---

### 5.2 ⚠ Where the mockups promise more than the data can currently keep

The mockups are the spec and are not in question. But several cells in them are *assumed* to be
fillable, and a screen that renders an em-dash where a number should be is a worse product than one
that never offered the column. **Settle each of these in the mockup session, before chunk C.**

**Two I confirmed while building Phase 1 — treat as facts:**

- **"Team emails · On / Club newsletter · Opted out" is TWO channels; the data has ONE switch.** The
  opt-out list is deliberately org-wide and channel-less — migration 214's own words: *"an opt-out
  suppresses ALL family email from this org, which is the honest reading of a parent clicking
  unsubscribe in a team email."* Showing two toggles means either building per-channel preferences
  (a real change, with a consent story) or showing one honest switch. **Do not fake the second row.**
- **A household balance is NOT symmetric across the two programmes.** Rep children have real dues
  (schedules, installments, credits). A house-league child has a *paid / not paid* flag against a
  registration fee. The mockup shows dollar amounts for house-league children. Decide whether league
  gains real dues, or whether the balance says something different for a league child.

**Five to verify from the code before promising them:**

1. **"Last contacted · 3 Aug · dues reminder"** — is there a per-family record of what was sent, or
   only per-batch? This column and the "What we've sent them" panel stand or fall together.
2. **"Amara — 2024 · House league"** — a child's history spanning rep *and* league. Rep-to-rep across
   seasons is already linked; **rep-to-league is not, and cannot be without the child-identity
   decision (§8.5).** Likely resolution: show them as separate rows rather than claiming they are one
   child. That is honest and still useful — but it is a design call, not an omission to discover
   mid-build.
3. **"also an assistant coach, Hawks U11"** — the mockup's own caption calls this one of the three
   things that make the person record worth having. It needs a person↔staff match that Phase 1 did
   not build. Cheap to add, but it is work.
4. **"Guardians · Primary / Co-guardian / Portal access"** — only ever populated for families who
   were *invited*. Twelve rows against 117 people. Most families will show one guardian and no portal
   access, which is correct and looks empty.
5. **Forms and consent per child** — rep document templates exist; whether house league has an
   equivalent is unverified.

⚠ And the constraint that governs all of them: **64 of 163 roster children name no guardian at all.**
Two in five rows in the worklist's own source data cannot join a family. Design the empty state for
that first, not last.

### 5.3 Phase 2 mockup session outcome (2026-08-17) — the seven gaps, resolved

**✅ OWNER APPROVED 2026-08-17** — including thin-states-first as the design discipline, after
pressure-testing it (the ruling that emerged: thin is not a cleanup state, it is every new club's
arrival state; there is no single "flip" to the ideal — the family page is useful in week one via
multi-child households, worklists sharpen during season one, retention/duplicates/former addresses
become possible only from year two, and the cross-programme household may appear in week one at a
real combined club — our measured zero is an artifact of no test org running both programmes).

**Artifact:** `claude.ai/code/artifact/e7cc6d9c-343e-45eb-8b94-fb9984f2b949` (five screens, each in a
thin state and a populated state; thin designed first). Every §5.2 item was verified against the
code before being drawn. The decisions, which chunk C–F must build to:

| # | Gap | Decision | Ground |
|---|---|---|---|
| 1 | Two email toggles | **One line: "Club email · On / Opted out", org-wide.** No per-channel rows. | Opt-out ledger is deliberately channel-less (mig 214). |
| 2 | Household balance | **Asymmetric and labelled**: rep = ledger lines summing to "Owing — rep dues"; league child = one Paid/Not-paid line, fee shown as context, **never summed**. | League money is `registration_fee_paid` (hand-toggled boolean) + display-only `league_seasons.registration_fee`. No amounts/installments/payments exist. |
| 3 | "Last contacted" | **Column and "What we've sent them" panel are DEAD — nothing can fill them.** Owes-money lens keeps a **"Chased"** column (dues-reminder stamps per installment: reminded when / never / "not tracked" for league). A real per-recipient family send log is **named new work for P3's messaging chunk**. | No per-recipient record of family email exists anywhere: announcements store counts only (deliberate minimization), league email logs per-batch, the one per-recipient log (mig 100) is platform marketing mail. |
| 4 | Cross-programme child history | **Separate rows; joined through the PARENT; never claims two same-named children are one child.** Rep season rollup stays (continuity links are real). Merge preview states "a merge joins the parent records only". | Birth dates on 1/163 rep rows; child identity is a name guess (§8.5). |
| 5 | "Also an assistant coach" | **CUT from Phase 2.** Catalogued as its own small P3 piece. | Staff are keyed by `user_id`, not stored email; the guardian↔staff identity join does not exist, and `auth.users.email` normalization is unguaranteed — careless matching risks a wrong identity claim. |
| 6 | Guardians panel emptiness | **One guardian + "Portal access · Never invited" is the DESIGNED state.** Each guardian labelled with provenance (named on roster / tryout / registration). Second guardian shown whenever source rows already carry one (a read); adding one is P3. | 12 of 117 people were ever invited. |
| 7 | Forms & consent | **Panel is "rep teams only"**, no rows for league children, absent entirely on a league-only family. | Rep has `rep_document_templates`/`rep_player_documents`; league has NOTHING durable — and ⚠ **the league waiver checkbox is required at submit but NEVER STORED** (no column exists). Recording acceptance at registration is flagged as its own small fix, worth doing before/alongside chunk A. |

**Also settled by verification:**
- **Nav:** Families is a **hub tile** (peer of House League / Rep Teams — it spans both, so it belongs
  to neither) + its own section with two pages (worklist, duplicate queue). The concept mockups'
  tab strip was a simplification. Tile hidden entirely without the capability, like every other tile.
- **Capability:** a new module-level key in the **org-member capability map** (the JSONB override map
  on `organization_members`, checked via `hasCapability`) — one new row in the existing owner-only
  Role-default/Grant/Revoke table in the Manage Member modal. **Role default is off for EVERY role**;
  owners hold it by the existing owner short-circuit. NOT the coach grant system.
- **The two-check rule is stated on the mockup as a build constraint:** every Families read answers
  both "holds the capability" AND "family belongs to this org"; export carries both.
- **New worklist lens the concept set missed:** **"No family on file"** — rows are CHILDREN (64/163
  today), each linking to the roster row where the guardian gets typed (one door per write). On
  today's data this is the landing lens; designed as such.
- **Worklist "Bounced" pill cut** (no delivery-failure data until the P4 bounce flag).
- **Family-page actions in P2 are exactly three** (message / record rep payment / export), each
  through the existing write path; payment plan, assistance, notes stay P3 (§8.5 blocks two of them).

### 5.4 Phase 2 BUILT ON DEV 2026-08-17 (same session as the mockup approval) — owner QA owed

**All chunks 0/A–F built to the §5.3 decisions. Migrations 252 + 253 applied to DEV only.**
No route, table or capability existed before this; nothing was removed.

- **Chunk 0 — and a P1 defect found by reading, not running:** mig 251 made
  `league_registrations.org_id` NOT NULL but `createRegistration()` never set it — **every league
  registration insert (public form AND admin manual add) failed on dev from the moment 251
  applied.** Fixed (both callers pass the org). The waiver fix shipped with it: mig 252 adds
  `waiver_accepted_at`, the public form records acceptance + files a `family_consents` row
  (`basis='league_registration'`) carrying the season's waiver text as evidence.
- **Attachment has ONE home (build decision, recorded in the dictionary):** ~10 write paths touch
  guardian emails; none of them mint people. Mig 252's `families_attach_people(org)` re-runs the
  idempotent mint-and-attach org-scoped, and the area calls it on entry — no per-route minting,
  ever. Rules are 251's verbatim; they must never diverge.
- **Chunk A:** `scripts/seed-families-fixture.mjs` → org `qa-families-fixture` (never the demos).
  Report verified: the Cole surname+phone pair proposes, **2 rep+league households exist** (the
  premise's first-ever occurrences), the Petit invited→claimed hop records a former address, and
  the opt-out sits under that former address (the §5-P1 "dangerous" line is now 1, on purpose).
- **Chunk B:** `module_families` — off by default for EVERY role, League/Club bands only, **both
  pinned by `tests/unit/families-access-guard.test.ts`** (editing a role default now fails the
  build). Hub tile + sidebar section vanish without it (no teaser — absent, not upsold);
  direct-URL hit gets a no-counts access screen. `PLAN_PRICING_FACTS.md` updated in the same
  unit (packaging: Families joins League Plus + Club inclusions, no price change).
- **Chunks C/D/E/F:** worklist (landing lens = "No family on file" when non-empty; **Chased** from
  installment reminder stamps, "Not tracked" for league; search covers FORMER addresses), family
  page (asymmetric money — unpaid rep installments + credits shown unnetted, league = Paid/Not
  paid chip; one email switch; forms panel rep-only and absent for league-only families; history
  = recorded events only), duplicate queue (mig 253 tombstones + `org_person_merges` audit;
  merge repoints parents only, strictest-preference-wins by construction), actions = message +
  export. **Record-a-payment deliberately NOT built** (§5-P2 money note — after the money QA
  walks).
- **One correctness first:** the message door refuses the send if ANY address the person ever
  used is opted out — **suppression through the PERSON**, the exact hole mig 251's header warned
  Phase 3 about, closed on this door ahead of Phase 3 (the address-keyed choke point
  `sendFamilyEmail` still runs underneath; nothing bypasses it).
- **Two honest deviations from the mockups, chosen over forking money/identity logic:** the
  family page shows "Unpaid installments — rep dues" (not a netted balance — credit application
  is the money module's policy) and lists rep seasons as adjacent rows without walking
  continuity links (no linkage claim made either way).
- Verification: typecheck ✓ · **2,113 unit tests ✓** (6 new) · lint 0 errors · `check:demos` ✓
  (neither demo exposes the area: tournament sandbox lacks the module, coach sandbox visitors
  hold no grant) · dictionary + snapshots refreshed (169 tables covered). ⚠ **The Families
  screens are in NO rendered sweep** — `scripts/layout-screens.mjs` is mid-flight in another
  session and the sweep has no admin-org fixture wiring; owner QA is the only visual coverage
  until a follow-up adds them.

**✅ `/simplify` (4 lenses) → `/review` (high-risk, 5 lenses) run same day; all confirmed
findings FIXED.** The ones worth remembering:
- ⚠⚠ **A REVOKED guardian was still the household** (review Critical): the co-guardian read
  filtered on person+child but not link STATUS, and the attach function stamps `person_id` on
  declined/revoked links like any other — so a guardian a coach explicitly removed still
  appeared on the page, rode the export, and would have received "Message this family". The
  `status='verified'` filter is now load-bearing in BOTH readers (page + message recipients),
  with the custody-dispute case named in the comment.
- ⚠⚠ **The merge became ONE transaction** — `families_merge_people` (mig 254, FOR UPDATE): the
  first cut ran five writes from the app and a partial failure left a half-merged, address-less
  person; now all-or-nothing, and concurrent merges of one pair serialize (loser gets a clean
  "Person not found").
- ⚠ **The module catalog / feature-matrix drift detector never learned `module_families`** — the
  safety net built to catch plan-config drift was structurally blind to the new module; added.
  Same class: the cancellation-preflight shutdown copy (Partial map = compile-silent omission).
- ⚠ **All three screens gained stale-response guards** — a slow response from a previous org
  must never paint guardian PII under the next org's header (the coach hubs' isStale lesson).
- ⚠ **The consent write is now AWAITED** — fire-and-forget compliance evidence can be torn down
  mid-flight on Amplify (the after()-drops gotcha); the confirmation email stays
  fire-and-forget, the ledger row does not.
- League-only families' waiver consent is now VISIBLE (the panel was gated on rep children;
  consent is family-level, only the forms half is rep-scoped). Tryout-only people are now
  reachable (they were skipped by the worklist AND unfindable by search — a person the UI
  cannot reach cannot answer "what do you hold about me"). `rejectMatch` now org-validates both
  ids (the one write missing the two-check rule) and refuses self-pairs. Dues-timezone dates go
  through `formatStoredDate`. Reader-timezone `toLocaleDateString` is gone.
- **Recorded, deliberately NOT built:** no per-family send rate-limit (announcements have a 24h
  cap; a household cap is a product decision — P3's messaging chunk), no merge-must-match-a-
  proposed-pair server check (same-org admin action; the queue UI is the only caller), and
  `merged_snapshot` retains PII indefinitely by design (audit record; retention is §8.4's
  deferred decision).

### 5.5 P3 session 1 (2026-08-18) — two gates dropped, two decisions made, the email hole closed

**The trigger gate is RETIRED.** P3 was held partly on "wait for a real club to be using the area".
The owner challenged it and it does not survive: everything expensive in P3 is already held by a
specific decision underneath (child identity, the send-log posture), so the trigger added nothing on
top of those while blocking three cheap items it was never aimed at. It is also circular pre-customer
— waiting for enthusiasm about a half-finished area. **Owner QA is likewise not a gate** (standing
ruling 2026-08-17, pre-customer). What survives is the two decisions below.

#### Owner decisions, 2026-08-18 — BINDING

1. **Dues reminders are TRANSACTIONAL.** A family cannot mute a bill by unsubscribing from club
   announcements. The four dues senders and the tryout offer/waitlist/release mails deliberately
   skip the suppression check — but they MUST identify their sender, which is the trade that makes
   the exemption honest. Suppressing a tryout offer would cost a child a roster spot because a
   parent unsubscribed from newsletters two seasons ago.
2. **A household is CONFIRMED, not inferred, before money moves.** This replaces §8.5's framing.
   The question "what identifies a child?" asks for a universal identity key and is the wrong
   question — the four money features need only *"how many children does this family have, and are
   any two of these rows the same child?"*, answered once, by a human, before any money feature acts.
   Money features refuse to run on an unconfirmed household. This is the posture the duplicate-parent
   queue and the returning-player check already use: propose, verify, never assume. **§8.5 is
   ANSWERED; the four money features are unblocked and go to a mockup session.**
3. **The message log stores a DATE ONLY** — "last contacted 12 Aug". Not a per-recipient record of
   what was sent: that needs a retention window and an answer for a family's data export, and it
   reverses the deliberate count-only minimisation. Closes §8.4's messaging slice.

#### ⚠ Two plan claims the code disproved (add to the list §5.4 started)

- **`rep_player_continuity_links` is NOT the seam for child identity.** §8.5 floats it as the
  candidate. It links the same team's roster across two seasons and structurally cannot join a rep
  player to a league registration, or one child across two teams — the exact join a household needs.
  A good PATTERN to copy (suggested → confirmed | rejected, confidence tier, decided_by audit,
  rejection tombstones); the wrong table to reuse.
- **Birth dates are collected far more widely than "~1 roster row in 163" suggests.** That figure
  describes historic and seeded data. Public rep tryout sign-ups **require** a DOB, the accept RPC
  **carries it onto the roster row**, and the season roll carries it forward. The gaps are the other
  doors: public league registration asks without insisting, and manual admin/coach adds never ask.
  So a DOB is a **confidence signal** for the confirmation screen, not a prerequisite for it.

#### Built this session — the email work (no migration, no new surface)

The audit behind it: **ten senders put mail in a guardian's inbox; three honoured an unsubscribe.**
The other seven had not routed around the guard on purpose — they predate it and never moved.

- **The suppression list now expands THROUGH THE PERSON** (`getFamilySuppressionList`). It returns
  every address of every person who opted out under any address they have ever used. ⚠ This replaces
  P2's `personEmails` argument, which each caller had to remember to pass and therefore protected the
  single door that did. **Every caller now gets it without knowing the concept exists** — closing
  mig 251's recorded Phase-3 trap for all senders at once, not one door at a time. Reads are paged
  (a silent 1000-row cap here means under-suppressing).
- **The house-league season broadcast is guarded.** It was the audit's clearest exposure: a true bulk
  announcement to guardians with no unsubscribe link at all. It now renders in the shared family
  envelope, so it gains sender identification and unsubscribe. `leagueBroadcastHtml` was DELETED — a
  second family-email template with no compliance footer is what made the gap possible.
- **All five transactional notices now name the club.** They previously signed off "FieldLogicHQ" —
  the software vendor, not the club asking for money — and said nothing about why an unsubscribe did
  not stop them. One shared footer (`duesReminderFooterHtml`) states both.
- **`remind-unpaid` was a FIFTH hand-built copy of the dues email** and had drifted exactly as the
  shared template's header predicted: it **never escaped player or guardian names** into a third
  party's inbox. Escaped now, and it shares the footer. Its body still differs on purpose.
- **`tests/unit/family-email-guard.test.ts`** pins the audit: a manifest of all ten senders with each
  one's posture, plus a drift scan that fails when a new file mails a guardian-shaped recipient
  through the raw transport. ⚠ Its shape assertions read **comment-stripped** source — the first
  version passed on prose and would have kept passing if the code were deleted and the paragraph left.

#### ⚠ STILL OPEN — the free-tier gap, which is NOT a re-route

**`lib/basic-coach-announcements.ts` (the free coach's "Email families") still honours no opt-out**,
while the paid coach's identical announcement does — so today whether a family's unsubscribe is
respected depends on what their club pays. **It cannot be fixed by routing it through the choke
point:** `basic_coach_teams` has no `org_id`, and both the suppression list and the unsubscribe token
are org-keyed. A free team has no org to record an opt-out against. (Recorded as a known gap in the
data dictionary since P2 — this session confirmed it, it did not discover it.) Closing it needs its
own per-team opt-out record + its own unsubscribe token shape: **a small migration and an owner
decision, not a cleanup.** Sized as "small" in the 2026-08-18 briefing artifact — that was wrong.

#### Post-build `/review` (2026-08-18, high-risk tier, 5 lenses) — 7 findings fixed

⚠⚠ **The one that matters: the guard test above ran GREEN on a rule it only half-checked.** The
transactional ruling has two clauses — name the sender AND explain the override — and the test
asserted them only across the four dues senders. The **tryout** offer/waitlist/release mails had
neither: they identified the club only when a caller remembered to pass `orgName` (it is optional,
and `orgBrandHeader` returns `''` without it), and said nothing about why an unsubscribe did not stop
them. **A test that asserts the easy half of a rule is worse than no test — its green is read as the
whole rule holding.** Fixed by extracting `lib/family-mail-footer.ts` (pure, dependency-free, because
the dues module must stay client-importable for the preview and the tryout templates live in the mail
transport), applying it to all three tryout templates, and widening the test to all FIVE transactional
senders plus a count assertion that all three tryout templates carry it.

Also fixed:
- **The paging had no ORDER BY.** Page-by-page reads without a deterministic order are not guaranteed
  to return each row once; a missed row here is an address we fail to suppress. All three reads now
  order on a column that is unique within the org. **Paging without ordering is half of paging.**
- **The admin's broadcast banner could no longer account for everyone.** Splitting "opted out" out of
  "skipped" server-side left the confirmation reading "12 delivered, 1 skipped" for a 16-family
  audience. An admin who cannot see where the rest went assumes a bug and re-sends. Counts only,
  never which families.
- **A page-load path got more expensive.** `getFamilySuppressionList` is also read when a coach opens
  the announcement composer (for the reach count). The `.in()` chunks now run in parallel.
- **A whitespace-only address was filed as "opted out"** — the guarded sender reports a
  blank-after-trim address as suppressed. The route now trims before its "no email on file" branch.
- **The unsubscribe line said "team emails"** on a season-wide league broadcast. Now "emails".
- **The test's comment-stripper was regex-only** and guarded `//` solely when preceded by `:`. A
  doubled slash in a path string or a regex literal would have silently truncated the line —
  *weakening* an assertion rather than breaking it. Replaced with a string-aware scan, proven against
  the exact cases the regex failed.

**Reported, NOT fixed — pre-existing, not introduced here:** the league broadcast sends sequentially
with no recipient cap (a few hundred registrations ≈ 60–160s, a real serverless-timeout risk;
`lib/family-notify.ts` already establishes `SEND_CONCURRENCY = 8` and `rep-team-announcements.ts` a
100-recipient cap), and `getRegistrationsForSeason` has no `.range()`, so a season over 1000
registrations silently drops registrants from the target list entirely. Both predate this session and
both deserve their own unit.

#### Deferred to the next unit, deliberately

The message door still has **no send cap** (announcements cap a team at N per 24h by counting their
own log rows; nothing records a per-family send, so there is nothing to count). The cap and the
date-only message log want the **same stored row**, so they land together rather than growing two
mechanisms. That row is the next unit's migration.

## 6. Feature catalogue

Full catalogue with rationale in the mockup artifact. Phase tags summarised.

> ⚠ **THE P4/P5 TAGS BELOW ARE STALE — there is no Phase 4 or Phase 5.** §5 defines P1, P2 and P3
> and stops. The tags are survivors of the ordering the owner **reordered on 2026-08-17** (see §5's
> banner), which collapsed the tail into P3. Worse, they actively contradict §5: the four features
> tagged "P5" here are the *same four* listed inside the **P3** block, and §8.5's original text says
> "decide before P5" about a question that was **answered on 2026-08-18**. Corrected below —
> anything not in P1–P3 is **Later**, meaning nobody has scheduled it, not that a phase exists for
> it. If you find yourself writing "P4" again, define the phase or say "Later".

**Money** — household balance (P2) · record a payment against the family (P3) · sibling discount (P3, unblocked 2026-08-18 by the confirmed-household ruling) · financial assistance (P3, same) · household payment plan (P3, same) · move a credit between siblings (P3, same) · who-owes-us ranked (**Later**).

**Reaching people** — message the household once (P3) · contact preferences attached to the person (**✅ BUILT 2026-08-18**, ahead of the rest of P3 — it was correctness, not a feature) · what we've sent them (P3, *date only* — owner ruling 2026-08-18) · second guardian (P3) · bounced/undeliverable flag (**Later**).

**Records & obligations** — consent on the record (P2 read / P3 write) · **answer "what do you hold about me" (P3)** · forms outstanding per family (P2) · internal notes with author and date (P3) · erase on request (later — retention rules deserve their own decision).

**Keeping the club** — find anyone by anything (P2) · played last year, not back yet (**Later**) · tenure and total contributed (**Later**) · volunteer hours and bonds (**later — own project**, big and near-universal in Canadian minor sport).

### The one I'd argue hardest for
**"Export their data" is a small button and a large capability.** Answering a privacy request today means a human searching six places and hoping. It is only possible once a person has a record, and it should be in the first action release, not deferred.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **PII concentration.** Today each coach sees only their own team's guardians. A club-wide directory puts every family's contact details, consent and balances on one searchable screen. | Dedicated capability, off by default (§1.2). ⚠ Precedent: the coach player-documents leak needed **both** `documents` **and** `rosterPii` — a single check was not enough. Audit every Families read against that lesson. |
| **A wrong merge exposes one family's children to another parent.** | §4 — exact email only for auto-match; everything else reviewed; never auto-merge. |
| **Two sources of truth for money/messaging.** | §1.3 — one write path, enforced in review. |
| **League data is modelled separately.** | Accepted with the Club+League decision. League registrations mint people in P1 like every other source; the union read (§3.3) is what makes one family span both programs. |
| **Coaches maintain the data but can't see the result.** | Open question — §8. |

---

## 8. Open questions

1. **Can a coach see any of this?** Owner chose admin-only, which I think is right. But coaches *maintain* guardian details and will now be editing data feeding a club-wide record. Decide whether a coach gets a read-only "this parent also has a child on another team" hint, or nothing.
2. **Does the family ever see their own record?** A parent-facing version is a short step once the record exists, and it is how a club stops being the middleman for "what do you hold about me". Not in this project — but it changes what to build if it is coming.
3. **Household balance: live or stored?** Live is always correct and never drifts; stored is faster and survives a child leaving a roster. **Recommendation: assemble live** at current club sizes; revisit only if measured slow.
4. **Retention/erasure rules** — deferred deliberately (§6).
5. **✅ ANSWERED 2026-08-18 — see §5.5 decision 2.** The question was the wrong shape: the money
   features need a **confirmed household**, not a universal child identity. A human confirms which
   rows are one child before any money feature acts; a DOB is a confidence signal in that screen, not
   a prerequisite. ⚠ Two claims in the original text below are WRONG and are kept only as the record:
   `rep_player_continuity_links` cannot serve as the seam (same-team, season-to-season only), and the
   DOB scarcity figure describes historic data — the public tryout form requires one and it is
   carried onto the roster. Original text: **what identifies a CHILD?** Birth dates are effectively absent
   from rep rows, so children are matched by name within an org. That is enough for Phase 2's lookup
   and for a *proposed* duplicate, and **not** enough for P5's sibling discount or household payment
   plan, which pay out real money against an inference. Decide before P5: make a birth date required
   somewhere, adopt an explicit child record (`rep_player_continuity_links` already links a player
   across seasons and may be the seam), or accept the inference in writing with its failure modes
   named. **Do not let this be settled by whoever builds P5 first.**
6. **⚠ NEW, raised by the P1 adversarial review (2026-08-17): should alias CONVERGENCE merge?** Two
   invited addresses claimed by the same signed-in account (A→B and C→B) currently collapse into ONE
   person. Usually that IS one parent whose coach typed two addresses for them — but a shared
   household account claiming two parents' invites would merge those parents, and it is a merge on
   evidence weaker than the exact-email rule everything else honours. Zero occurrences on either
   database today; the behaviour and its risk are documented at the accepting code in mig 251.
   Options: keep (convenient, mostly right), or refuse-and-report like ambiguity (strict, consistent
   with §4). **Decide before the first real club's backfill runs.**
7. **⚠ NEW, raised by the P1 adversarial review: attachment is a ONE-TIME snapshot, and Phase 2 needs
   an ongoing attach.** The backfill ran once. A registration taken tomorrow arrives with no person;
   a coach editing a guardian email afterwards silently de-syncs the row from its person. Left alone,
   the report reads both as backfill bugs (correctly — they are integrity failures) the moment real
   data moves. Re-running the migration is NOT the answer — review traced a case where a re-run after
   a claim lands SPLITS one family into two records. **Phase 2's write paths must attach/re-resolve
   `person_id` at the moment a guardian email is written** — the same normalize-on-write discipline
   §4 already demands, one field over. Related, accepted-and-documented rather than open: an address
   RECYCLED by a genuinely different family attaches to the old family's person (the cost of "one
   address, one person, forever" within an org); the duplicate queue is where a human unpicks it.

---

## 9. Standing rules this project must honour

- **Migration + `DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of work.** `check:dictionary` enforces it.
- **`org_id` on every new table, indexed** — `npm run check:indexes` now fails the build otherwise (mig 249, Finding #33).
- New tables: `ENABLE ROW LEVEL SECURITY`. Service-role-only tables get **no policies** (the mig 091 / Finding #30 posture).
- Every new capability is checked on the **specific** resource, not "some team" — the money-form P2 lesson.
- PM brief maintained alongside this plan (`CLUB_FAMILIES_BOOK_PM_BRIEF.md`).
