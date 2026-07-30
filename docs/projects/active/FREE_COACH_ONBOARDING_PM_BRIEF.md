# PM brief — Free coach portal: the welcome stops promising doors that aren't there

**Date:** 2026-07-29 · **Status:** in build · **Plan:** `FREE_COACH_ONBOARDING_PLAN.md`
**Priority:** high — this is the first screen a brand-new free coach ever sees.

## The problem, in customer terms

A coach signs up, creates a free team home, and the first thing they see is a friendly card telling
them to do three things: add players, add practices and games, send a note to parents.

Two of those three things are **not in their portal**. On the free portal the four team tools start
switched off on purpose, to keep it uncluttered — the coach turns them on from **Explore** when they
want them. So the welcome card is naming Schedule and Announcements as if they were sitting right
there, with no button to press and nothing to click.

The one button the card does have makes it worse. It sends the coach to their Roster page — which
also isn't in their navigation yet. The page works, they can add a player, and then they leave it and
**cannot find their way back**. There is no Roster tab.

This is the free-portal version of the same defect we just spent three phases fixing on the premium
portal: instructions pointing at doors the person doesn't have.

## What the coach sees after this change

The card still says "Let's set up your team", still three steps — but now every step is honest and
every step can be acted on.

- **A tool that isn't on yet** shows a **"Turn on Schedule →"** button and a plain line saying it
  isn't on yet and this will switch it on. Pressing it switches the tool on, drops the coach straight
  into it, and it appears in their tab row from then on.
- **A tool that's already on** just shows **"Open Schedule →"**.
- **A step they've already finished** — a player added, a game on the calendar, a note sent — shows a
  checkmark and stops asking. It doesn't nag about work already done.
- **One click on "Skip this"** clears the whole card. Plenty of coaches only want a team home to
  register a tournament from and have no interest in setup; they shouldn't have to work through three
  steps to make the card go away. Skipping leaves one faint line back to Explore, so nothing is
  hidden forever and it's reversible.

**Explore doesn't change.** It stays the browsable home for all four tools and a permanent tab. The
welcome card is a shortcut into the tools it already names, not a replacement for browsing them.

## Who is affected

- **Coaches who create a team from scratch and haven't finished setup** — they get the fixed card.
- **Coaches whose team came from a tournament registration** — no change at all. Their Overview
  already leads with their tournament, and keeps the quiet "your team, beyond this tournament" note
  and roster nudge it has today. We deliberately did not put a setup card on top of coaches who only
  ever wanted their tournament record.
- **Premium coaches** — untouched. Every tool is already in their sidebar; there is nothing to turn
  on.

## Decisions and tradeoffs

**Turning a tool on from the welcome step partly bypasses Explore** — the page that exists to make
switching tools on deliberate. Owner call, and the reasoning holds: the card *already* promises those
three tools, so that disclosure has effectively been bypassed in copy already. Today it's bypassed
dishonestly. Explore stays the browsable home and the permanent door.

**Some existing scratch teams mid-setup will see the card once.** For the completed-step checkmark to
ever be visible, the card has to survive partial progress — today it vanishes the moment anything is
entered. The alternative was leaving that state dead. It's one click to clear.

**One copy change from the approved mockup.** The mockup's step 3 button read "Turn on Notes", but
the tab it creates is called **Announcements**. Naming the button one thing and the tab another would
recreate the same defect in miniature, so the button reads "Turn on Announcements" while the step's
friendly line stays "Send a note to parents".

**Tone stays deliberately light.** The free portal is the companion, not the operations HQ. The
premium empty states teach in three sentences — what it is, what it unlocks, what's blocking. That is
the wrong voice here, and we did not port it. One short line per step.

## Success criteria

1. A brand-new free coach can act on all three steps without ever hitting a dead end.
2. Nobody lands on a page they can't navigate back from.
3. Finished steps stop asking.
4. A coach who doesn't want setup is out of it in one click, and can find the tools again later.
5. The in-app help guide describes the flow the coach actually gets.

## How to check it

See §7 of the plan for the click-by-click QA script. Short version: make a new free team, press
"Turn on Schedule", confirm you land in Schedule and that Schedule is now a tab; add a player and
confirm step 1 ticks; press "Skip this" on a fresh team and confirm the card collapses to one faint
line that survives a reload.
