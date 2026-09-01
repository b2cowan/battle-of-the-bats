# PM brief — Money that moved has a date in the past

**One line:** the product says "Record is for money that has already moved" and only half means it;
this makes every money door answer the date question the same way.

**Plan:** `COACH_MONEY_DATE_CONSISTENCY_PLAN.md` · **Priority:** medium · **No migration**

---

## What a coach sees differently

Almost nothing — and that is the point. On three screens where the calendar currently offers dates
that haven't happened yet, it stops offering them: **recording a sponsor's cheque**, and the two
places income is recorded. Six other money screens already behave this way, so for most coaches
this reads as "the odd screens stopped being odd".

The one place a coach gains something is the sponsor door. Today, picking next Tuesday for a cheque
lets you fill the whole form and then bounces you on save with a flat refusal. After this, the
product recognises what you meant and offers the right control instead:

> *"That date hasn't arrived yet — a cheque you're expecting isn't recorded, it's promised. Set it
> as the pledge's expected-by date instead."*

That is the same hand-off the owner approved for the bill door: don't just refuse, point at the
thing they actually wanted.

## Why it matters

**The Money hub is built on one distinction:** money that *has* moved versus money that is *going
to*. Bills, pledges and the Scheduled view are the second; Record is the first. Letting Record
accept a future date dissolves that line — and **cash on hand**, the single figure a treasurer
must be able to trust, would start including money nobody has received.

It also closes a smaller, quieter gap the other way: on the expense side the rule lives *only* in
the form. Nothing behind it enforces the rule, so any other route to the same data can write a
future-dated cost. Today that route doesn't exist. The first import that does would find the hole.

## Who is affected

Every coach who records money. No role differences — this is the same rule for head coaches and
for assistants with money access. Nothing changes for anyone reading reports.

## What was traded off

**The owner said either direction was acceptable so long as it was consistent, and we chose to
block rather than to allow.** Allowing future dates everywhere would have been fewer edits, but it
costs the distinction the hub depends on, and would have made the existing help article wrong in
the other direction. Blocking is also the smaller change: six of nine doors already did it.

**We are not capping every date field.** A pledge's *expected-by*, a drive's *start and end*, and a
dues *installment due date* are all supposed to be in the future. Consistency here means the same
*question* answered the same way, not every calendar wearing the same restriction. Capping those
would be a new defect dressed as tidiness.

**One decision is left with the owner** — the date on a dues *credit*. A credit isn't cash moving,
so the argument above doesn't reach it, and a coach may legitimately date one forward. It is
untouched pending a ruling rather than swept in silently.

## Success criteria

- No money-that-moved screen offers a date that hasn't happened.
- The sponsor door names the expected-by alternative rather than only refusing.
- The rule holds behind the forms too, not just in front of them.
- The forward-looking dates still accept future dates — verified, not assumed.
- The help article's existing promise becomes true on every door it covers.

## How to check it

Rides the **§122 walkthrough** (owner-directed) as an extra part, rather than getting a walkthrough
of its own — the two touch the same screens and the owner is walking them together.
