# Founding Season 2027 — Phase 2 PM brief: the desk, the card, and the 2028 choice

**Plan:** `FOUNDING_SEASON_2027_DESK_PLAN.md` · **Parent:** `FOUNDING_SEASON_2027_PLAN.md` §3 Phase 2
· **Status:** committed `6eda3722` on `dev` 2026-09-08; mockups approved and rulings D1–D4 taken 2026-09-07. Owner QA §155 outstanding.

## The problem in one paragraph

Every account that joined the Founding Season is free until September 30, 2027. Nothing in the
product turns that off, nothing records whether an account has a card, and nothing lets anyone ask
"who hasn't got one?" without opening Stripe. On October 1, 2027 someone has to convert or close
every one of those accounts. Today that someone would be building a spreadsheet by hand.

## What changes

**For the owner, immediately.** A new **Founding Season** page in platform admin lists every free
account — organizations and Coaches Portal workspaces together, because they are the same kind of
record underneath. Each row says what the account is, when its free season ends, whether a card is on
file, what it chose for 2028, when its owner last signed in, what they have actually done with the
product, and who to email. Two filters answer the two questions that matter: **who has no card**, and
**who has made no choice**. The list exports.

The desk **reads only**. It does not change plans or cancel anything — those controls already exist
in Bulk Operations and on each org's page, and the desk links to them. A read-only desk cannot
convert the wrong account by accident, and how the October turn-off actually runs is a decision that
is not due until May 2027.

**For customers, from June 1, 2027.** Three months before the free season ends, a founding account
sees the summer ask on its billing page: save a card, and choose a plan for 2028 — annual first,
monthly available. **Nothing is charged before October 1, 2027**, and the design makes Stripe itself
responsible for that, not a reminder in someone's calendar.

Coaches get this for the first time. Today a comped Coaches Portal sees no Founding Season message at
all on its billing page — the whole block is suppressed because its wording only ever spoke about
Tournament Plus. That block now speaks for whichever product the account is actually on.

**For the reminder emails — NOT BUILT, and stopped deliberately.** The plan was a new batch-email
audience of *founding accounts with no card on file*. Between the plan and the build, the parallel
Phase 1 chat moved the email-audience registry into a file this phase is forbidden to touch and
took uncommitted edits to both email screens, so wiring it meant editing their work mid-flight.
The desk's **No card yet** filter and its export give the operator the same list by the same rule —
what is missing is only the batch-send wiring, and nothing was going to send this autumn. The plan's
§12 says how it finishes.

## Why it matters

Three live production accounts today, and the sign-up window is open until December 31, 2026. If the
cohort is thirty accounts by January, the October conversion is a morning's work with this desk and a
week of forensics without it. The card question is the one that decides revenue: an account with a
card and a choice converts itself; an account without one has to be chased, and chasing needs a list.

## What we are trading away

- **The desk cannot act.** Converting or cancelling stays where those controls already live. Deliberate.
- **The 2028 checkout is built nine months before it opens.** That is a real risk — Stripe moves, and
  code that never runs rots quietly. The plan pins the whole "when does money move" question to one
  constant, adds a test that fails if a charge could land early, and books a re-verification pass in
  May 2027 as part of the deliverable rather than a hope.
- **"Last activity" is really "owner last signed in."** The product does not keep an activity metric,
  so the column is named for the fact we actually hold rather than implying one we do not.
- **The card and the 2028 choice are kept in their own store, not on the account record.** `/review`
  found that the account table is readable by anyone holding the site's public key for any
  organization with a public page — so putting them there would have published every founding
  account's card details and commitment. The cost is one extra lookup; the alternative was a leak.

## Success criteria

1. The owner can open one page and name every free account, and say for each whether it has a card
   and a 2028 choice.
2. A card saved by a customer shows up on that page without anyone opening Stripe.
3. A founding coach can save a card from their own billing page during the summer window.
4. A 2028 choice made in June results in the first charge on October 1, 2027 — and a test proves no
   path can bring that date forward.
5. Cancelling a 2028 choice withdraws the choice and nothing else — it never suspends an account
   whose free season is still running.
6. ~~The reminder audience counts only accounts with no card~~ — **not built this phase** (above).

## Decisions — all four RULED 2026-09-07, as recommended

- **The coach read-only window is built in the spring with Phase 3.** Until it exists, the coach's
  "if you choose nothing" copy promises only what the product already does.
- **A choice made in June takes effect on October 1**, not in June — so the free season is worth the
  same to every account.
- **Season-ending notices go as service messages**, not marketing campaigns: the customer opted out
  of being sold to, not out of being told what happens to their account.
- **The no-early-charge design is accepted**, with one thing stated plainly: an account that
  deliberately buys a bigger plan mid-season is still charged for it, as today.

**Still open, and not this phase's:** the account table is readable by anyone holding the site's
public key for any organization with a public page, and it already carries the Stripe customer link,
internal notes and the billing-suspension reason. Nothing meaningful is leaking today, but it wants
a decision of its own.

## Priority

High for the desk, the card record and the coach card door — they are cheap now and expensive to
retrofit in a rush next September. Medium for the 2028 checkout, which cannot be exercised until June
2027 and carries the re-verification gate above.
