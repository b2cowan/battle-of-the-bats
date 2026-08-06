# Coach Portal Chunk G — The Budget Starter — PM Brief

> **Status:** Planned 2026-07-30 — awaiting mockup approval + decisions D1–D6.
> Companion plan: `COACH_PORTAL_CHUNK_G_BUDGET_STARTER_PLAN.md`.

## The problem

A first-season coach opens Season Budget Plan and gets a blank page. The Money hub tells them to
"set a budget," and behind that instruction there is nothing — no structure, no example, no sense
of what finished looks like. Coaches are volunteers, not accountants. The question they actually
have is **"what am I forgetting?"** — a forgotten officials line or tournament deposit wrecks a
season; being 10% off on a line does not. (Season rollover already carries a budget into year two,
so the coach staring at the blank page is specifically the one starting out.)

## What the coach sees and does differently

**1 · The blank page becomes a guided start.** Instead of an icon and an "Add first line" button,
a new coach gets three doors: **build a starting budget** (about a minute of questions), **see a
finished example**, or quietly add lines by hand like today. The "Build your budget" button on the
Money hub now lands them straight in the questions instead of on the blank page.

**2 · A minute of questions produces a real budget.** Five plain, tap-only questions — how many
tournaments, any real travel, do you pay officials, any off-season training, do you supply
uniforms. Their answers pick the right cost lines in the right categories. Then one worksheet
screen: for each line, "if you know the cost, type it — leave blank to price later." Lines they
price become their actual budget, editable like any other. Lines they leave blank go on their
checklist. If they told us "4 tournaments at about $600," we show the multiplication — their
numbers, our arithmetic, nothing guessed.

**3 · "What am I forgetting?" stays answered all season.** The budget page gains one quiet line —
*"Not in your plan yet: Officials, Travel, +4 more"* — built from the standard checklist of what
teams budget for, minus what they've already covered. Tapping an item opens the normal add-line
form with the category filled in and the amount empty. Items they don't need dismiss with one tap.
This also quietly serves the third-season coach who forgot a category — not just beginners.

**4 · They can see what "finished" looks like.** A clearly-labelled sample — a made-up team,
"Riverdale 12U" — shows a filled-in season budget and, on a second tab, what budget-vs-actual looks
like mid-season, including a line that's gone over. It's fenced off visually, labelled as invented,
and there is deliberately **no button to copy it** into their own budget. It stays reachable all
season as a quiet reference, including from the empty budget-vs-actual page.

## The guardrail this is built around (already decided — D-G1)

**The product never proposes a dollar figure.** No suggested amounts, no benchmarks, no prefilled
numbers, no numeric placeholder text. A number the coach types is theirs and is fine; a number the
product supplies is not — anchoring a volunteer low means they under-collect and a real family ends
the season short, and real costs swing too hard by region, age and level for any figure of ours to
be honest. The one nuance for the owner to ratify: the **sample's** numbers (recommendation: yes,
but unmistakably another team's — see D1).

## Role differences

- **Head coach / money-write assistant:** everything above.
- **Read-only money assistant:** sees the sample (it's education) and, once a budget exists, the
  budget itself as today — but never the questions, the checklist, or any add button. Verified by
  an automated pass that logs in as a read-only assistant, because this exact leak class has been
  caught before.

## Why it matters

The budget is the front door to the whole Money pipeline — budget → player dues → reminders →
budget-vs-actual. Today that pipeline starts with our weakest moment: a blank page at the exact
point a nervous volunteer decides whether this tool is for them. This chunk turns the scariest
screen for a first-season coach into the moment the product proves it understands their job — and
it does so without ever guessing at their finances.

## What this is NOT

- Not a cost-estimation or benchmarking feature — rejected, by owner decision, as a harm risk.
- No change to season rollover, dues, or any admin/org budgeting screen.
- No new data storage — priced lines use the existing budget plumbing; the checklist is computed;
  the sample is a built-in illustration; "not relevant to us" dismissals are remembered per device.

## Success criteria

- A brand-new coach can go from blank page to a real multi-line budget, priced only with numbers
  they typed, in under two minutes on a phone.
- No dollar figure anywhere in Money originates from the product; the sample is never mistakable
  for advice (named fictional team, fenced, labelled, uncopyable).
- The checklist keeps working mid-season (forgotten-category door) and never nags — one line,
  dismissible, gone when complete.
- Read-only assistants are offered nothing they can't do.
- Owner QA on a real phone passes; automated mobile + read-only probes extended and green.

## Priority & sizing

Medium chunk, sequenced after Chunk A (same screens, now phone-ready). No migration, no plan/price
change, no new permissions. Collision-free with the active concurrent stream (portal chrome /
onboarding) — it lives entirely inside Money.
