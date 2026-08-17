# The Families Book — club-admin family records

**Status:** Planning 2026-08-17. **Phase 1 BUILT on dev 2026-08-17** (migration 251) — records minted,
nothing in the product reads them. **Awaiting the owner's read of the §5-P1 report** (`node
scripts/report-families-backfill.mjs`). Phases 2–5 not started. Read §5.1 before starting Phase 2.
**Tiers:** Club **and League** (owner decision 2026-08-17 — see §1.2).
**Access:** a dedicated Families capability, off by default (owner decision 2026-08-17).
**Mockups:** `claude.ai/code/artifact/f089153c-8583-4c5c-b8c3-d70c5278602b`
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

## 6. Feature catalogue

Full catalogue with rationale in the mockup artifact. Phase tags summarised:

**Money** — household balance (P2) · record a payment against the family (P3) · who-owes-us ranked (P4) · sibling discount (P5) · financial assistance (P5) · household payment plan (P5) · move a credit between siblings (P5).

**Reaching people** — message the household once (P3) · contact preferences attached to the person (P3, *the correctness fix*) · what we've sent them (P2) · second guardian (P3) · bounced/undeliverable flag (P4).

**Records & obligations** — consent on the record (P2 read / P3 write) · **answer "what do you hold about me" (P3)** · forms outstanding per family (P2) · internal notes with author and date (P3) · erase on request (later — retention rules deserve their own decision).

**Keeping the club** — find anyone by anything (P2) · played last year, not back yet (P4) · tenure and total contributed (P4) · volunteer hours and bonds (**later — own project**, big and near-universal in Canadian minor sport).

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
5. **⚠ NEW, raised by Phase 1 (§5.1): what identifies a CHILD?** Birth dates are effectively absent
   from rep rows, so children are matched by name within an org. That is enough for Phase 2's lookup
   and for a *proposed* duplicate, and **not** enough for P5's sibling discount or household payment
   plan, which pay out real money against an inference. Decide before P5: make a birth date required
   somewhere, adopt an explicit child record (`rep_player_continuity_links` already links a player
   across seasons and may be the seam), or accept the inference in writing with its failure modes
   named. **Do not let this be settled by whoever builds P5 first.**

---

## 9. Standing rules this project must honour

- **Migration + `DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of work.** `check:dictionary` enforces it.
- **`org_id` on every new table, indexed** — `npm run check:indexes` now fails the build otherwise (mig 249, Finding #33).
- New tables: `ENABLE ROW LEVEL SECURITY`. Service-role-only tables get **no policies** (the mig 091 / Finding #30 posture).
- Every new capability is checked on the **specific** resource, not "some team" — the money-form P2 lesson.
- PM brief maintained alongside this plan (`CLUB_FAMILIES_BOOK_PM_BRIEF.md`).
