# Needs attention clears itself — PM brief

**Plan:** `NEEDS_ATTENTION_CLEARS_ITSELF_PLAN.md` · **Found in:** Owner QA §322, 2026-10-16 · **Priority:** high —
found in the Club Tier walks, where the club's money people and builders live in this zone; which release carries it
is the owner's call.

## What changes

- **Needs attention only holds what is still waiting on you.** When a request is answered, approved, declined,
  withdrawn or expires, its notification leaves Needs attention for everyone it went to — the owner, the admins,
  the treasurer, every coach on the team. It stays readable under All. Nobody has to press Done on work someone else
  already finished. The bell's number drops with it.
- **It covers every kind that waits on someone:** money-back asks, hand-backs without money, payment requests, "I
  sent the payment", requests holding a payout, schedule reviews, team moves, assistant-coach approvals, a free
  coach's payment reminder, the club's failed card payment, and a team marked no-show (clears when the team is
  checked in, the no-show is undone, or the tournament ends).
- **Four old kinds nothing sends any more** leave Needs attention, and any still pinned there are cleared.
- **Notifications reach the people who can act on them.** A club's failed card payment goes to its owners only (not
  admins or coaches); an assistant-coach approval goes to the people who hold Rep Teams for that team's group; a
  no-show goes to the people running check-in for that tournament. Coaches stop seeing the club's billing problems
  in their bell.
- **Stage 2 (drawn first, not yet ruled):** opening something already handled says exactly what happened — "Accepted
  by Morgan Ellis · Oct 16, 5:06 p.m." — and Open goes to the record, never a reload of the page you are on.

## Why it matters

On dev, 1 of the owner's 10 Needs-attention items was actually waiting. A "needs attention" list that is mostly done
work teaches people to ignore it — the one real ask hides among the nine finished ones, and every Open on a finished
one is a dead end.

## Tradeoffs

- Something settled by an automatic path (an ask whose Sundays passed overnight, a tournament ending) leaves Needs
  attention the next time the bell is read, not the instant it happens. Settled by a person, it leaves at once.
- Admins stop receiving "card payment failed" (bell and email). Billing is owner-only, so they could not act on it.

## Success

- After the change, the owner's Needs attention on dev lists exactly the asks still waiting (today: one).
- Answering an ask on the schedule clears the treasurer's copy too, with nobody pressing Done.
- No coach's bell lists the club's failed card payment.
- A new kind can't join Needs attention without saying how it ends (the build fails).
