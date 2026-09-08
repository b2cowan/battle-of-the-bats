# Founding Season 2027 — Phase 2 PM brief: the desk, the card, and the 2028 choice

**Plan:** `FOUNDING_SEASON_2027_DESK_PLAN.md` · **Parent:** `FOUNDING_SEASON_2027_PLAN.md` §3 Phase 2
· **Status:** planned 2026-09-07, awaiting mockup approval.

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

**For the reminder emails.** The batch email tool gains a new audience — *founding accounts with no
card on file* — so the summer nudge reaches only the people it is about, instead of everyone. **Nothing
sends this autumn.** The words for that campaign are the parallel Phase 1 chat's job; this phase only
builds the audience and the key it hangs on.

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

## Success criteria

1. The owner can open one page and name every free account, and say for each whether it has a card
   and a 2028 choice.
2. A card saved by a customer shows up on that page without anyone opening Stripe.
3. A founding coach can save a card from their own billing page during the summer window.
4. A 2028 choice made in June results in the first charge on October 1, 2027 — and a test proves no
   path can bring that date forward.
5. The reminder audience counts only accounts with no card, and excludes opted-out and revoked ones.

## Decisions still with the owner

- When the coach read-only window gets built, and what a lapsed coach sees until it exists.
- Whether a 2028 choice made in June takes effect in June or on October 1.
- Whether account notices to founding accounts honour the marketing opt-out or go as service
  messages.
- Acceptance of the "nothing can charge before October 1" argument and the test behind it.

## Priority

High for the desk, the card record and the coach card door — they are cheap now and expensive to
retrofit in a rush next September. Medium for the 2028 checkout, which cannot be exercised until June
2027 and carries the re-verification gate above.
