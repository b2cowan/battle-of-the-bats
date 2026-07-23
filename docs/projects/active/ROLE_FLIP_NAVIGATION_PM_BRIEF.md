# PM Brief — The Flip: one pill to move between your event and your tools

**Ratified 2026-07-22 · Visual spec: the rev-2 proposal artifact (`claude.ai/code/artifact/23f4dbce-60dd-42c1-b9ec-7ca6597651e7`) · Plan: `ROLE_FLIP_NAVIGATION_PLAN.md`**

> **Revision 2026-07-22 — the admin door is now a real header, not a floating button.** In browser testing the floating corner button on desktop crowded each page's own buttons and was easy to miss. So on the admin side the button now lives in a **proper header that runs across the top of every admin screen** — showing the event's name and whether it's live/open/draft, with the button anchored top-right. Scroll down and the header shrinks to just the name and button (exactly like the public event header does), then grows back at the top. Because it's part of the workspace frame, the door to the public side is now on **every** admin screen and always in the same place — including screens like Venues or Settings, where it takes you to the event's public front page; and on org-level screens (not tied to one event) it takes you to your organization's public site. Approved visual: mockup `ebc24a16-51db-4393-bd60-6c43127481ac`.

## What changes for users

Anyone who runs or coaches at a tournament gets **one button, always in the top-right corner, on every screen** — public site, admin, coaches portal, phone or desktop. On the public site it flips them into their tools; inside their tools it flips them back — always landing on the *matching* page (public schedule ⇄ admin schedule; a game ⇄ that game's score entry), always in the same tab, so the installed app never strands them in a browser. Right after a flip, the button reads "Back to …" so round trips land exactly where they left. Hold two roles? The button opens a tiny two-row picker instead.

Two moments get extra love:
- **Score fixed → verified:** the instant an admin saves a score, a one-tap "Score saved — see it live" prompt shows that game exactly as fans see it. The most repeated loop of a live weekend drops from 6 taps (with two wrong landings and a browser breakout) to 3.
- **Coach round trip:** a coach watching the public schedule can duck into their portal (landing on the tournament record, where their fee status is the first thing shown), check anything, and duck back out — one tap each way, on both the free and paid tiers. Today the paid portal has **no way back to the public site at all**.

To give the button its corner: the admin phone's notification bell moves into the More menu (its red count now shows on More itself; desktop bell unchanged), and the public header's share icon becomes a share row on the event's Overview page (game score-card sharing — what people actually share — is untouched). The old mixed account sheet retires; everything in it already lives somewhere fans and operators can find it.

## What does NOT change

Fans see none of this — no button, identical layout, same four bottom tabs for everyone. The global navigation, event branding, and vertical-space rules are untouched. No pricing, gating, or data changes; no migration.

## Why it matters

This is the "1 app" promise made real for the people who pay us: organizers and coaches stop feeling like the public site and their tools are two different apps with a hidden hallway between them. It removes the top three friction complaints the owner raised, closes the one seam-review work item that was never built, and does it with almost no new chrome — one control, learned once.

## Priority & sequencing

High — game-day quality-of-life for every operator, every event. Four phases, each shippable alone: (1) admin loop + foundation, (2) public side, (3) coach side, (4) polish/help-docs/QA. No migrations; help guides update in the same effort so in-app docs never describe the old doors.

## Success looks like

- Fix-and-verify a score: ≤ 3 taps, zero browser breakouts.
- Coach portal ⇄ public site: 1 tap each way, both tiers.
- The button (or its deliberate absence for fans) is on 100% of tournament screens — never a dead corner, never a wrong guess.
- Owner can hand their phone to a volunteer mid-tournament and they can find their way back — every time.
