# The Families Book — club-admin family records

**Status:** Planning session held 2026-08-17. Owner-approved scope decisions recorded below. **Nothing built.**
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

### 3.3 The person↔child relationship — reuse `family_links`, do not invent

`family_links` already carries `org_id`, `rep_team_id`, `player_id`, `role`, `relationship`, and supports co-guardians. **Add `person_id`** and let it become the relationship table.

⚠ **But `family_links` only exists for *invited* families (12 rows vs 70 named guardians).** Most guardians exist only as roster columns. So:

- Mint `org_people` from **all** sources: `rep_roster_players.guardian_email`, `rep_tryout_registrations.guardian_email`, `league_registrations.guardian_email`, `family_links.invited_email`/`claimed_email`, `basic_coach_team_players.contact_email`.
- Add nullable `person_id` to each of those tables.
- **Reads union the two paths** (typed-on-the-row, and linked-via-family_links) exactly as `rep_player_continuity_links` resolves its dual-source sides. Established precedent in this codebase; do not invent a third pattern.

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

Ordered so the riskiest thing — minting people from drifting addresses — is proven against real club data before anything depends on it.

### P1 — Build the records, show nobody
Mint `org_people` + `org_person_emails` across rep, tryout, league and basic-coach sources. Add nullable `person_id` columns. Nothing in the product reads any of it.
**Exit criterion:** a report the owner and I read together — families created, suspected duplicates, children we could not confidently attach. **If those numbers look wrong we fix matching before a screen exists.**

### P2 — Look them up
Families area behind the new capability. Search (any child, any guardian, any current *or former* email, phone). Family page: children across rep + league, household balance, contact, consent, forms, history. **Read-only.** Plus the duplicate review queue — P1's numbers will demand it.

### P3 — Act on them
Message the household · record a payment against the family · edit contact details · record consent · add an internal note · export their data. **Every one writes through the existing path (§1.3).**

### P4 — Worklists
Owes money · missing forms · no consent · not back this season · can't be reached. Filters + bulk actions. This is the release that turns it from a thing you look at into a thing you use.

### P5 — Household money
Sibling discount · financial assistance · household payment plan · move a credit between siblings. **Deliberately last:** each changes what a family is charged, and none should ship until the record beneath it is trusted.

**P1 and P2 are independently useful** — if the project stalled after P2, a club would still have something it has never had. That is the test a phased plan should pass.

---

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

---

## 9. Standing rules this project must honour

- **Migration + `DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of work.** `check:dictionary` enforces it.
- **`org_id` on every new table, indexed** — `npm run check:indexes` now fails the build otherwise (mig 249, Finding #33).
- New tables: `ENABLE ROW LEVEL SECURITY`. Service-role-only tables get **no policies** (the mig 091 / Finding #30 posture).
- Every new capability is checked on the **specific** resource, not "some team" — the money-form P2 lesson.
- PM brief maintained alongside this plan (`CLUB_FAMILIES_BOOK_PM_BRIEF.md`).
