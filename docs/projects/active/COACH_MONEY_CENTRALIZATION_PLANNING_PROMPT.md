# Session prompt — "Where does a coach log money?"

**A PLANNING session. Owner-called. Written 2026-08-21, to be opened in a fresh chat.**

You are not building anything in this session. You are answering a design question the owner has
asked, *with* the owner, and the output is a plan they have agreed to — not code.

**Read before you start:** `COACH_PAYABLES_REBUILD_PLAN.md` §9 (this session's original brief) and
its release-check section. Then **go and open the actual screens**, because §9 says of itself that
it *"was written from one session's memory of five screens"*, and this repo's plans have been wrong
about the product repeatedly — including one audit row that would have led to building the exact
opposite of a standing owner ruling.

---

## 1 · The question

> *"We are getting closer to a centralized model and this project in particular has helped us make
> a lot of ground, but I still feel like I have to go to too many places to log different
> transactions, and as a user it feels confusing."* — the owner, 2026-08-21

Money a coach records today enters through **five different doors**: Transactions, Payables, Player
Dues, Fundraising, and Club. Each grew its own add-form in a different month. The **model** beneath
them converged during the Payables rebuild — a commitment holds installments and payments, the same
shape Player Dues has used for months. **The doors did not converge with it.** That gap is this
session.

---

## 2 · THE DESIGN PRINCIPLE THE OWNER SET FOR THIS SESSION — read this twice

**Owner, 2026-08-21, in their own words:**

> *"Make sure it thinks creatively with the goal of simplicity and ease of use in mind, less focus
> on 'how many clicks' like what seems to have been the primary focus historically. We don't want 5
> buttons to the same place because they are each 'one click away from similar behavior' but rather
> what makes the most sense in a user's mind."*

**This is the measure the session will be judged by, and it disqualifies the obvious answer.**

- **Click-count is not the goal, and it has been over-weighted here before.** A design that reaches
  everything in one tap, from five places, is not simple — it is five things to learn that happen
  to be fast. **Proximity is not clarity.**
- **Do not add doors to reduce distance.** Five buttons that all land in the same place because each
  is "one click from similar behaviour" is precisely the failure named above. If two entry points
  exist, a coach must know which one they are in and why — that is a cost even when both work.
- **The test is the coach's MENTAL MODEL, not the interaction count.** Ask: *when a coach thinks "I
  need to write down that I paid the umpires", what do they believe they are doing?* Recording a
  cost? Paying a bill? Updating the team's book? The right design matches the sentence already in
  their head. A design that is faster but makes them learn our filing system has failed.
- **The strongest version of this work REMOVES screens.** Fewer things that exist beats more things
  that sit close together. **Deletion is a legitimate — and preferred — proposal.**
- **Think creatively.** You are not limited to rearranging the five doors that exist today. If the
  honest answer is a different shape entirely, propose it.

⚠ **This principle should outlive the session.** Once it has been applied and tested against real
proposals, it belongs in `memory/design_decisions.md` as a binding entry.

---

## 3 · What "centralized" must NOT mean

From §9, and still binding:

- **Do not add a sixth door that unifies the other five.** A hub over five inconsistent forms is six
  things to learn, not one. (Same trap as §2's five buttons, wearing a nicer hat.)
- **Do not touch the MODEL to fix the DOORS.** Installments-and-payments is settled, tested, walked
  and about to ship. The complaint is navigational and vocabulary-level. If you find yourself
  proposing a schema change, stop and re-read the complaint.
- **Do not decide it from this document.** Open the five screens and read what each one actually
  asks for today, field by field. Where they genuinely differ is the whole input to this session.

---

## 4 · What you must find out before proposing anything

1. **What does each of the five doors actually ask for?** Field by field. Which fields are the same
   question wearing different words? Which are genuinely different?
2. **Which of the five are different JOBS, and which are only different because they were built in
   different months?** Club money and Player Dues have real reasons to be their own places — money
   owed *to* the team by families, and money settled *with* the club, are different relationships.
   The question is not whether those screens should exist; it is whether **logging into them** needs
   to be its own separate act.
3. **What does a PAYMENT carry today?** Amount, date, method, note, and which installment. **It does
   not carry a payer.** That is why a family can front a *whole* cost but not *one payment* of a
   bill — the payer is a field on the cost form, and a payment record has no such field.
   ⚠ Closing that gap reaches a household's dues credit, which is **real money owed to a real
   family**. It is not a field to add casually, and it is one of the questions this session must put
   to the owner rather than decide alone.
4. **What can be retired?** Name it explicitly. A proposal that adds nothing and removes two screens
   is a better outcome than one that adds a clever hub.

### A third input the owner raised 2026-08-21 — the tag controls

There are more money-tag controls scattered across these screens than anyone intended, and one was
removed from Budget vs. Actual during the §64 walk because it produced a false reading (it narrowed
spending while the plan stayed whole, so Headroom *rose* as you filtered). Treat the tag vocabulary
as part of the same "too many places" complaint — §9 of the payables plan has the detail.

---

## 5 · Deliberately OUT of this session

**Money tables on a phone.** The owner, the same day: *"I don't really like the phone version where
it is still a dropdown with huge tiles, this will become a ton of scrolling."* That is real, and it
is **presentation**, not navigation — it comes from one portal-wide table-to-cards rule and reaches
nine screens, several with nothing to do with logging money. It has its own TODO entry and its own
session.

⚠ **They are SEQUENCED, and this one goes first:** if this session retires or merges screens, there
are fewer card tables left to rework. Do not solve the phone problem here, and do not let it steer
the navigation answer.

---

## 6 · How to work with the owner — this is a conversation, not a delivery

**Ask, do not assume.** The owner has asked explicitly to be consulted. **Put a question to them the
moment their opinion is genuinely required**, rather than choosing a default and reporting it
afterwards. The questions worth asking are the ones where two reasonable answers lead to materially
different products — for example: does a payment learn who paid it? Is Club money a different job or
a different filter on one book? Should Fundraising keep its own door at all?

**Do NOT ask** about anything you can find out by reading the screens, and do not offer a menu where
one option is obviously right — decide those, say that you decided, and move on.

**Disagree out loud, before the work.** If the premise of a request looks wrong, say so first, and
argue from what the code actually does rather than what a plan claims it does. Two owner requests in
the previous session rested on a false premise; in both cases the conclusion survived and the
*reason* changed. Re-frame a wrong question rather than answering it.

### When you are ready to propose

**Show mockups — plural — as options, not a single answer.** For each option give:

- **What the coach sees and does**, in plain language.
- **The trade-offs**, honestly, including what it costs. Every option has a cost; an option
  presented without one has not been thought through.
- **What it removes**, if anything.
- **Your recommendation and the rationale** — say which one you would choose and why. Laying out
  choices neutrally and leaving the judgement to the owner is not the job.

⚠ **Mockups are published as Claude Artifacts**, always — never described in prose, never left in a
file. The owner reviews them visually and rules on them, and **an approved mockup becomes the
spec**: a later build is expected to match it, and where the code and the mockup disagree, the
disagreement gets raised rather than quietly resolved.

---

## 7 · The deliverable

A plan file and a plain-language PM brief in `docs/projects/active/`, plus a one-line entry in
`TODO.md` linking to it — the repo's standard pairing. The plan records **what was decided, what was
rejected and why, and what is deliberately not being built.** No code is written in this session.

⚠ Whatever is decided will need the in-app help and both demo sandboxes re-read afterwards. The
money vocabulary a coach reads is exactly the surface where hand-written demo sentences go stale
while every page still renders perfectly.

---

## 8 · Context you should have

- **The Payables rebuild is finished and its QA section is closed** (§64: Parts A–E walked and
  passed; F, G and H closed unwalked by the owner and carried into the release check). It is what
  converged the model and made this question askable.
- **None of it is on production yet.** Production is on the 2026-08-17 release; dev is well ahead
  and carries database changes. This session does not depend on that shipping, but any proposal
  should assume the rebuilt Payables screen is what a coach will be using.
- **This repo runs one shared `dev` branch and other sessions may be working in it concurrently.**
  A planning session writes no code, so the risk is low — but stage explicit paths if you do commit
  documents, and never `git add -A`.
