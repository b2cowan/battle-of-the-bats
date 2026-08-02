# Chunk D — Privacy counsel packet (PIPEDA / CASL / Law 25)

> **Prepared 2026-08-01** as plan item 0.5. **This is an owner-action deliverable, not code.**
> Its purpose is to give external counsel everything they need to review the *guardian tier*
> of the family layer in one pass, and to give the owner a clear list of what we are asking
> them to sign off on.
>
> **Status: awaiting counsel review.**
>
> **Update 2026-08-01 (owner decision):** the guardian tier is now **BUILT AND SWITCHED OFF**
> rather than unbuilt. It is disabled by a server-side flag (`GUARDIAN_TIER_ENABLED`, default
> off) which refuses every guardian request, invite, claim and coach route — so **no guardian
> connection and no consent record can be created** until it is deliberately turned on. A probe
> suite asserts that the switch actually holds, because a feature "shipped disabled" whose
> disable can be stepped around is not disabled.
>
> Nothing about the review changes: **turning it on still requires a sign-off recorded in**
> `docs/agents/strategy/BUSINESS_DECISIONS.md`. What changed is only that sign-off becomes a
> copy change and a flag flip rather than a build. **The consent wording in the product today
> is an explicitly-marked placeholder** (see question 2) and is visibly labelled as a draft on
> screen, so nobody testing it can mistake it for approved text.
>
> Slice 1 (the **follower** tier) is live-ready and **not** blocked by this review — see §1.

---

## 0 · What we are asking counsel to do

Review the design below and answer the seven questions in **§7**. We are not asking for a
general privacy audit of the platform; we are asking whether the *guardian consent flow*, as
designed, is defensible under PIPEDA, CASL and Quebec Law 25, and what wording it needs.

The one-sentence version of the product: **a coach shares a link with the families already on
their team; a parent opens it, says who they are, and the coach approves them; from then on
they can see the team's schedule, and (guardian tier only) their own child's season record.**
Nothing about a child ever becomes public, and there is no way for a stranger to search for a
team or a child.

---

## 1 · Why the follower tier shipped first, and why that is not a shortcut

The family layer has **two tiers**, and they have materially different privacy surfaces:

| | **Family follower** (shipped) | **Guardian** (this review) |
|---|---|---|
| Tied to a child? | **No — never.** Enforced by a database constraint, not a convention | Yes — to one specific roster row |
| Sees | Team schedule, results, game pages, calendar feed, game-change alerts | The above **plus** their own child's season recap, attendance, awards, and the coach's announcement archive |
| Personal data about a minor | **None** | Yes |
| Consent collected | Adult self-consent + standard terms | Child-data consent, guardian attestation, age band |
| Who it is for | Grandparents, aunts, the other household's adults | The accountable adult for money and registration |

The follower tier carries **no child data at all**, so it needs no child-data consent to
collect — the only personal information involved is an adult's own email address and an
optional self-described relationship label ("Grandparent"). That is why it was safe to build
ahead of this review. If counsel disagrees with that reading, say so in **Q1** and we will
treat it as a blocking finding.

---

## 2 · What we collect, from whom, and why

### 2a · Already collected today (pre-existing, for context)

| Data | Where from | Lawful basis today |
|---|---|---|
| Player first/last name, date of birth | Coach types it, or a guardian submits a tryout form | Consent (tryout form) or the club's own membership relationship |
| Guardian name, email, phone | Same | Same |
| Medical notes, emergency contact | Coach types it | Membership relationship; visible only to coaches holding an explicit permission |
| Attendance, development notes, awards, playing time | Coach's own records of their coaching | Legitimate operation of the team |

**Tryout form consents (existing, unchanged):** a data-collection consent and a
guardian/eligibility attestation are **required** to submit; a marketing-email consent is
**optional and separately ticked** (unbundled 2026-07-30). Timestamp and server-captured IP are
stored with each.

### 2b · New in the guardian tier (what this review is about)

| Data | From whom | Purpose |
|---|---|---|
| A link between a signed-in adult account and a specific child's roster row | The parent asks; the coach approves | So a parent can see their own child's information |
| The child's **full name** as typed by the requesting parent | The parent | Matched **by the coach**, by hand, at approval. Never matched automatically, never echoed back, never used to look anything up. **Both name parts are asked for deliberately:** the form discloses nothing (the parent types their own child's name rather than choosing from anything we showed them), and a first name alone would force a coach on a team with two same-named children to guess which one an adult belongs to — the one decision in this flow that must not be a guess. |
| Relationship label ("Mom", "Grandpa") | The parent | Display only. Never used for authorization |
| An **age band** for the child | The parent, at link time | The consent flow branches on it (see §4) |
| Consent record: basis, start date, IP, wording shown | Captured server-side at consent | The audit trail |

**What a guardian can then see about their own child:** attendance rate, the development
focus areas the coach worked on with them and any before/after test readings, awards, playing
time relative to the team's fairness band, and the team's season record.

**What a guardian can never see** — structurally, because the payload has no field for it:
medical notes, admin notes, dues detail, any other child's data, or any other family's contact
details.

---

## 3 · How verification works (and what it deliberately does not do)

1. **Parent-initiated, coach-approved is the primary path.** The coach shares one revocable
   team link. Whoever opens it declares a tier and lands in the coach's approval queue.
2. **There is no public search for a team or a child.** The link is the only door, and it
   travels only where the team sends it. It is revocable — resetting it kills every copy at
   once.
3. **The request page shows the requester nothing from the roster.** No player list, no count,
   no "did you mean" hint. A person who guesses a URL learns only that a team exists.
4. **Email match is an assist, never authorization.** If the requester's email matches the
   guardian contact the coach already typed on that player, the coach sees a hint saying so.
   It never grants access by itself.
5. **A coach-sent direct invite to a specific address, claimed from a session verified as that
   exact address, is treated as already approved** — the invite *was* the approval. This is
   the one mechanism we most want counsel's view on (**Q3**).
6. **Registration auto-verify** (league/club contexts where the organization itself holds the
   family's registration and payment) matches on the same normalized email. Honest expectation:
   roster emails are hand-entered and go stale, so we expect this to catch perhaps a third to
   a half of claims. The approval queue is a primary path, not an edge case.
7. **Caps:** two guardians per player (one per household, so a two-household family is
   first-class rather than an afterthought). Followers are uncapped as a product matter, with
   an abuse ceiling only. The coach can remove anyone at any time.

---

## 4 · The age-band question

Every child needs a determinable age band **at link time**, because the consent flow branches
on it:

- **Under 13** — guardian consents on the child's behalf (OPC guidance).
- **Under 14 in Quebec** — guardian consents (Law 25).
- **13+ (rest of Canada) / 14+ (Quebec)** — may self-consent, but only through
  age-appropriate language. **We are not building this now** (there are no athlete accounts at
  all — no child ever holds a login), but the age band is stored so the flow never needs a
  data-model rebuild if athlete accounts are ever considered.

A **jurisdiction signal** is stored per consent record for the same reason, so that a Law 25
branch (or a future US COPPA requirement) can be switched on without retrofitting existing
consents.

**We already hold the child's date of birth in most cases** (it is a roster field), so the age
band can usually be derived rather than asked. **Q4** asks whether deriving it is acceptable or
whether it must be affirmed by the guardian.

---

## 5 · CASL posture for family email

Three kinds of message reach a family, and we believe they are not all the same thing:

| Message | Our reading | Consent basis |
|---|---|---|
| "Saturday's game moved to 2pm" | **Transactional** — it is the service the family connected to receive | Express, at link creation |
| "Here is your child's season recap" | **Transactional** | Express, at link creation |
| "Dues are due Friday" | **Transactional** | The existing membership relationship |
| "Registration for next season opens Monday" | **Arguably commercial** | Express opt-in, separately ticked |
| Club newsletters / sponsor content | **Commercial** | Express opt-in, separately ticked |

**What we have built to support this:**

- **Express consent at link creation** is the design move that makes the implied-consent clock
  irrelevant for connected families. A family that clicks the link and ticks the boxes has
  given express consent, dated and evidenced.
- **Implied consent from membership is recorded with its start date** so the 24-month clock
  (6 months for a bare inquiry) is computable rather than assumed.
- **Marketing consent is unbundled** from everything a family must agree to in order to
  participate — already true on the tryout form since 2026-07-30, and carried through into the
  consent ledger as a separate record with its own scope.
- **Every family email now carries a working per-family unsubscribe**, honoured on every send.
  Before this build, the coach's "Email families" had no opt-out at all — that is now closed
  for Premium teams.
- **Sender identification**: family emails name the organization, not just the team.

**Known gap, stated rather than hidden:** free-tier ("Basic") coach teams are not attached to
an organization in our data model, so the per-family unsubscribe does not yet cover their
"Email families" sends. This is a gap we have recorded, not a decision we have made. **Q6.**

---

## 6 · Safeguards already binding on the build

These were set by the owner and are enforced in code, not policy:

1. **Nothing that names a child appears on any public surface.** The one exception found in a
   code audit — a tryout-offer page that rendered a child's full name to anyone holding the
   emailed link — was fixed in this same unit of work: it now shows first name and last
   initial only.
2. **Public game pages are team-level forever.** The data shape handed to that page has no
   player field at all, so it cannot name a child even by mistake. A game page does not exist
   until the coach shares that specific game, and stops existing when they stop.
3. **No 1:1 adult–minor messaging anywhere**, now or in the planned chat phase.
4. **Family chat is deliberately last**, behind this review and a moderation upgrade
   (remove/ban capability, delete-with-visible-notice) that the chat engine does not have yet.
5. **A family link grants the family view, never the coach's view.** New surfaces default to
   the most protective setting.
6. **The team's schedule visibility is a coach-controlled setting** defaulting to
   "connected families only", enforced on the server.
7. **Consent records are never deleted.** Withdrawal is stamped, and the history stays.

---

## 7 · The seven questions we are asking counsel

1. **Is the follower tier's reading correct** — that a team-level relationship carrying an
   adult's own email and a self-described relationship label involves no minor's personal
   information and therefore needs no child-data consent? (If not, this is a blocking finding
   on already-shipped functionality.)
2. **What exact wording** must the guardian consent screen carry? We would like counsel to
   supply or approve the text for: the child-data collection consent, the guardian attestation,
   and the optional marketing consent.
3. **Is "coach-sent invite to a specific address + claim from a session verified as that exact
   address = verified" sufficient**, or must every guardian link carry a second, explicit coach
   approval regardless of how it started?
   *Context added 2026-08-01, because it sharpens the question:* the owner observes that this
   particular path is **not a new trust decision** — the address is already on the player's
   roster row, the coach already emails it, and it already receives tryout offers. On that
   reading, inviting it to connect is the same act we already perform. The genuinely new thing
   is the OTHER path: an unsolicited requester **asserting** a parental relationship the coach
   cannot truly verify. We would value counsel confirming (or rejecting) that distinction, since
   it is the basis on which the two on-ramps are treated differently.
4. **May we derive the age band from the date of birth we already hold**, or must the guardian
   affirm it at link time?
5. **Is our transactional-vs-commercial classification in §5 defensible?** In particular:
   is "registration for next season opens Monday" a commercial electronic message when sent to
   an existing member family?
6. **What is our exposure on the Basic-tier gap** (§5, last paragraph) — free coach teams whose
   family email currently has no unsubscribe? Is this an urgent fix or a scheduled one?
7. **Retention.** How long may we keep a guardian link, a consent record, and a withdrawn
   consent record after a child leaves the program? We currently keep them indefinitely, which
   we suspect is wrong.

---

## 8 · What happens after sign-off

Counsel's answers are recorded as a new entry in
`docs/agents/strategy/BUSINESS_DECISIONS.md`. That entry is what unblocks **Slice 2** (the
guardian tier: the guardian request path, per-player guardian management, co-guardian invites,
the "Your players" band, and the announcements archive). The consent wording counsel supplies
goes straight into the guardian request screen; the schema to hold it already exists, so no
migration is needed to adopt their answers.

If counsel's findings change the *shape* of the flow rather than only its wording, the plan's
Slice 2 section is revised before any of it is built.
