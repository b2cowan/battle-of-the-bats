# The Families Book — PM brief

**Plan:** `CLUB_FAMILIES_BOOK_PLAN.md` · **Mockups (concept):** `claude.ai/code/artifact/f089153c-8583-4c5c-b8c3-d70c5278602b`
· **Mockups (Phase 2, buildable):** `claude.ai/code/artifact/e7cc6d9c-343e-45eb-8b94-fb9984f2b949`
**Status:** planned 2026-08-17 · **Phase 1 built on dev 2026-08-17** · **Phase 2 mockups done and
owner-approved 2026-08-17** (three unkeepable promises resolved, plan §5.3) · **Phase 2 BUILT on
dev 2026-08-17** — the Families area exists: the worklist (landing on "no family on file" when that
is the day's truth), the family page, the duplicate queue with a permanent memory for "not the same
person", message-the-household (which now honours an opt-out made under an old email address), and
one-click export of everything held about a family. Record-a-payment waits for the money QA walks,
deliberately. Along the way two real defects were found and fixed: league registrations had been
silently broken on dev since Phase 1's migration, and the league waiver a guardian must tick is now
actually stored (it never was). Owner QA §54 owed; production needs two migrations first ·
**Tiers:** Club and League · **Access:** a Families permission, off by default for every role

> **What Phase 1 changed for a customer: nothing, on purpose.** No screen, no menu, no permission, no
> change to what a coach or admin does. Behind the scenes, every parent named anywhere in a club now
> has one record instead of an email address re-typed onto each child's row.
>
> **Two things the owner should know before approving Phase 2** (detail in the plan, §5.1):
> 1. **There is no real club data to test this against yet** — one demo club on production, test orgs
>    on dev. The report proves the machinery works; it cannot yet prove the matching is right. The
>    report is re-runnable, and the first real club is when this actually gets answered.
> 2. **Two in five children on a roster name no parent at all** (64 of 163), and **birth dates are
>    almost never recorded**, so "these two children are siblings" is currently a guess based on a
>    shared email address. That is fine for looking a family up. It is **not** fine for a sibling
>    discount, which is one of the headline commercial promises here — that needs its own decision
>    first.

---

## The problem, in one line

A club can look up a team, a game or a payment. It cannot look up a family — because a parent has no record in the system at all, only an email address typed onto each of their children's rows.

## What's true today

- **70 guardians are named in the system. One has a login.** Guardian details are a coach's typing, so parents exist in the data whether or not they ever hear from us.
- A parent with two children on two teams is **two unrelated entries**. They get two invoices, two emails, and the club has no way to see one household.
- Changing an email address doesn't update a parent — it **creates a stranger**. Their history, consent and opt-out stay filed under an address that is no longer theirs.
- "Do not email me" is stored against a text address. A parent who opts out and later appears under a slightly different address is a new person to the system — **and emailable again**. One shared send path holds that line today in software, not in the data.

## What changes for the customer

A new **Families** area for club admins, on Club and League plans, behind a permission that is off until deliberately granted.

**Week one they can:** find any family by a child's name, a parent's name, a phone number, or an email — *including one the parent no longer uses*. Open a family and see every child across rep teams **and** house league, one household balance, current and former contact details, consent status, which forms are outstanding, and what the club has sent them.

**Then they can act:** message the household once instead of once per child · record a payment against the family and split it across children · fix contact details · record consent · leave an internal note · and export everything held about that family as one file.

**Then it becomes a Monday-morning tool:** who owes us, who's missing a waiver, who has no consent on file, who played last year and hasn't come back, and who we simply cannot reach.

**Later, household money:** sibling discounts, financial assistance, one payment plan across all children, and moving fundraising credit between siblings.

## Why it matters commercially

- **Sibling discounts become possible for the first time.** A near-universal club policy that today cannot even be *detected*, because the system can't tell that two children share a parent. This is new capability, not convenience.
- **The retention list has never existed.** "Played last year, not registered this year" is the cheapest registration a club will ever get, and nobody can produce that list today.
- **Privacy requests stop being a fire drill.** Answering "what do you hold about me" currently means a human searching six places and hoping.
- **It gives Club and League tiers something concrete** that a single-team product structurally cannot offer — households only exist when a club runs several teams.

## Priority and sequencing

Medium-high, and **not next.** Nothing is broken today and the coach money work is mid-flight. The honest trigger to start is the first commitment that depends on it: a parent-facing portal, a household statement, a sibling-discount promise, or a privacy request that has to be answered properly.

Five phases. The first builds the records and shows nobody — it ends with a report we read together (families created, suspected duplicates, children we couldn't confidently attach). **If those numbers look wrong, matching gets fixed before a single screen exists.** Phases 1–2 are independently useful: if the project stalled there, a club would still be able to look up a family for the first time.

## Tradeoffs taken

- **Actions live inside the Families area** (owner decision). I recommended originating there and handing off to the existing money and messaging screens, to avoid rebuilding surfaces that already work. The owner chose full actions; the safeguard is that every action writes through the *same mechanism* as the existing screen — two doors, one path — so the money hub and a family page can never disagree.
- **Club *and* League** (owner decision). I recommended Club only. The owner was right: a family with one child in house league and one on a rep team is invisible in both modules today, and this is the only thing that could join them.
- **Deliberately org-scoped.** The same parent at two different clubs stays two separate records. A platform-wide person would let one club's data confirm a guardian exists at another — a privacy leak dressed as a feature.
- **Nothing is deleted.** The typed email stays on every row as the record of what was actually entered, which is what keeps every phase reversible.

## Success criteria

1. A registrar can find any family in under ten seconds from any detail a parent gives on the phone — including a former email address.
2. A parent with children in two programs appears **once**, with one balance.
3. A family that has opted out **stays** opted out through an email change, a new season, and a record merge.
4. A privacy request is answered from one screen in one action.
5. The duplicate queue trends toward zero and stays there — a queue nobody trusts is worse than no queue.
6. Sibling discounts and financial assistance can be applied without a spreadsheet.

## Risks worth naming to the owner

- **This concentrates personal data.** Today each coach sees only their own team's guardians; this puts every family's contact details, consent and balances on one searchable screen. Hence the dedicated, off-by-default permission — and a precedent worth remembering: an earlier guardian-data leak in the coach portal happened because a surface checked *one* permission when it needed two.
- **A wrong merge is worse than a duplicate** — it shows one parent another parent's children. So only exact email matches are automatic; everything else is proposed for a human, never merged automatically, and a rejected pair is remembered.
- **Coaches maintain this data but won't see the result.** Open question in the plan: whether a coach gets a read-only hint that a parent has a child on another team, or nothing at all.

---

## Update — 2026-08-18: two gates dropped, two decisions made, one promise repaired

**Phase 3 is no longer waiting on anything except design.** It was held partly on a rule saying
"don't start until a real club is using the area". The owner challenged that and it did not survive:
everything genuinely expensive in Phase 3 was already held by a specific decision underneath, so the
rule added nothing while blocking three cheap items it was never aimed at. Owner QA is likewise not
a gate pre-customer (standing ruling). **Four of the six Phase 3 pieces are now clear to build**, and
the two that were held are answered below — so all six go to one mockup session.

### What the owner decided

- **A bill is not an announcement.** Dues reminders and tryout results keep reaching a family that
  has unsubscribed from club email — a parent cannot mute what they owe, and suppressing a tryout
  offer would cost a child a roster spot over a newsletter opt-out from two seasons ago. The price of
  that exemption: those emails must now say plainly **who** is asking and **why** the unsubscribe did
  not stop them.
- **A household is confirmed by a person, not guessed by the software.** The sibling discount and its
  three siblings were blocked on "what identifies a child". That was the wrong question. The family
  page builds its list of children from programme sign-ups, so one child in two programmes counts as
  **two** — which would hand a family a third child's discount with nothing on screen looking wrong.
  Instead, an admin confirms the household once, and money features refuse to act on one nobody has
  confirmed. Same posture as the duplicate-parent queue: propose, verify, never assume.
- **The message log remembers a date, not a dossier.** "Last contacted 12 Aug" answers what a club
  actually asks before phoning a family, without creating a permanent record of who was told what —
  which would need a retention policy and an answer when a family asks for everything you hold.

### What shipped, and what a customer would notice

An audit found **ten things send email to families, and three of them honoured an unsubscribe.** The
rest were not ignoring it on purpose; they were written before the shared safeguard existed and never
moved to it. Fixed this session:

- **An unsubscribe now follows the person, not the address.** A parent who opted out years ago under
  an old email is no longer reachable under their new one — through every sender, not just the one
  screen where this already worked.
- **The house-league season broadcast** was going out with no unsubscribe link at all. It now
  identifies the club and carries one. Its visual design changed as a result.
- **Every dues reminder now names the club.** They used to sign off with our software's name, so a
  family got a bill for real money from a company they have no relationship with.
- **A player's name can no longer inject markup into a bill** — one of the five dues notices was
  never escaping typed-in names.

### The honest gap, and a correction

**The free tier still doesn't honour an unsubscribe.** A paid coach's announcement respects it; the
free coach's identical "Email families" does not — so today whether a family's opt-out is honoured
depends on what their club pays us. That is the hardest thing here to defend to a customer.

⚠ **I sized this as a small re-route and I was wrong.** Free coach teams don't belong to an
organization at all, and both the opt-out list and the unsubscribe link are anchored to one — so
there is nowhere to record a free-tier family's choice. Closing it needs its own small piece of
storage and its own unsubscribe link: a real, if modest, piece of work, and a decision about whether
the free tier should carry it.

**Priority:** the free-tier gap is the highest-value remaining item on customer-trust grounds and is
the one I would take next, alongside the message log and its missing send limit (which share one
record and should be built together).
