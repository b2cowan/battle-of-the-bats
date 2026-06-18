# PM Brief — Coach Premium Upgrade: make it a true upgrade, not a re-signup

**Plan:** [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md) · **Created:** 2026-06-18 · **Status:** planning

## What this is
When a coach who already uses the **free** Coaches Portal decides to upgrade a team to **Premium**, the experience should feel like flipping a switch on the team they already have — not filling out a "create a new team" form. Today it's the latter: they re-type the team name, sport, division, and season, pay, and land in an **empty** Premium portal because none of their roster, schedule, or fees come along.

## What changes for the coach
- **Two screens, not a form.** (1) "Here's what Premium adds for *your team*," (2) confirm + pay. The team name and sport are already filled in.
- **Their stuff comes with them.** Roster, schedule, and fees from the free portal are carried into the new Premium portal, so it's populated the moment they arrive — with an honest "here's what we brought over, and the couple of things to double-check" summary.
- **Season and division stop being one-time setup questions.** They're dropped from signup; the season defaults quietly, and (companion work) division and "start next season" become things the coach manages inside the portal — which is the whole point of paying for a tool that runs a team across seasons.

## Why it matters
This is the **conversion moment** — the exact screen where a free coach decides whether Premium is worth $29/month. Right now it asks them to do *more* work to *start over*, and then rewards them with a blank slate. That's the worst possible first impression of the paid product. Making the upgrade carry their existing team forward turns "why am I re-entering everything I already have?" into "oh — it just brought my whole team across." It also makes the multi-season promise real instead of a dead-end every year.

## Model (decided)
Premium is **per team** ($29/mo each). Upgrading scopes to the one team the coach started from; their other free teams stay free and can upgrade separately. Not a whole-account upgrade.

## Customer impact
- **Free coaches considering Premium:** dramatically lower friction at the buy moment; the product proves its value instantly (their team is already there).
- **Existing Premium coaches:** benefit from the companion work — self-serve new seasons + editable division (today both need an admin).
- **No impact in production** until Premium is switched on there; this all lives behind the same per-environment gate (dev now, prod at launch).

## Priority
**High for the launch path.** The upgrade experience is the front door to Premium revenue; it should not ship to a real launch as a re-signup with an empty portal. Sequenced: slim the signup (quick) → carry the team's identity through checkout → migrate the team's data (the real build) → in-portal season/division management (companion, required for the multi-season promise).

## Success criteria
- A coach upgrading from a free team reaches payment in **two screens**, with name + sport pre-filled, and **never re-enters** team details.
- After paying, their **roster, schedule, and fees are present** in the Premium portal on first load, with a clear summary of anything that needs a manual touch.
- A coach can **start a new season** and **change their division** themselves, in-portal, without admin help.
- Production remains express-interest only until its gate is deliberately opened.

## Tradeoffs / honesty
Some data doesn't map perfectly (single-field names must be split; basic "game" events become "scrimmages"; team-wide fees become expenses; simple paid/unpaid fees become a one-line dues schedule). v1 accepts these and **tells the coach** rather than silently losing or misrepresenting data. A flawless copy isn't the goal; a populated, trustworthy portal with a short "check these" list is.
