# Nav Consistency: PM brief

**Status:** ruled 2026-10-17 (all fourteen asks as recommended) and built the same day, with one more ruling at the
build: every club's phone bar is Overview · Calendar · Rep teams · Accounting · More, and More opens with Schedules,
House league and Families (a door you can't open is filled by the next program the club runs). QA walks owed. Priority: Club Tier
Stage 8 (it ships inside the Club release). Hub: https://claude.ai/artifact/RtcrWCxpfuNMkTRQMK8pA3

## The problem

Our menus were built one portal at a time. The type already matches everywhere, but how each menu is put together
doesn't. Someone who runs a club and also coaches a team flips between the admin and the coaches portal and finds:
- Sign out in a different place.
- Help missing from the admin's phone menu.
- No way to their account from the coach's phone menu.
- One icon meaning three different things.
- The phone menu in a different order in every portal.

None of it is broken on its own. Together it makes the product feel like several products.

## What changes for people

- **Every sidebar ends the same way:** Help, the other portal, Collapse sidebar. Signing out and sending feedback
  happen from the account menu at the top right, in every portal.
- **Every phone More menu has the same order:** notifications first, then shortcuts, then the same groups as the
  sidebar, then your account, then Help, feedback, the app download and Sign out. Admins get Help on a phone. Coaches
  get their account, Home and feedback on a phone. The club's Organization page and a tournament's Accounting get
  phone doors.
- **One club phone bar.** Overview, Calendar, Rep teams, Accounting and More, on every club.
- **Shortcut tiles come to the admin.** A club admin's menu opens with Schedules, House league and Families. On game
  day, a tournament director's menu opens with Check-in, Staff kit and Teams.
- **One icon per idea.** The trophy means Tournaments, and only Tournaments. Results gets a medal and the club's
  scheduler a timeline; twelve icons change in all.
- **Small words:** "Rep teams" in sentence case like every other menu label, "Club overview" instead of "Back to
  club", and "Admin Area" in the admin's top bar, the way the coach's says "Coaches Portal".
- **The free coach's sidebar rows** look like the paid ones (its width and team header stay as you ruled on 10-15).

Nothing is removed; every page stays where it is in the sidebar. No data changes.

## Who sees what

Club owners and admins, tournament directors, Premium coaches and free coaches all see the changes in their own
portal. Volunteers' game-day screens, the public site and platform admin are unchanged.

## Why it matters

The Club release sells one platform to clubs whose people wear several hats. A consistent menu is the cheapest proof
that it is one product, and a written standard stops the next screen from drifting.

## How it's built

Four small stages, each its own commit and walk: A, the same words, icons and headings; B, one sidebar foot and one
More order; C, the admin tiles; D, the free coach's rows.

## Success looks like

- In any portal, on any device, Help, your account and Sign out are where you expect them.
- No icon means two things in any menu.
- A new screen's menu entry is checked against the written standard.
- The QA walks pass.
