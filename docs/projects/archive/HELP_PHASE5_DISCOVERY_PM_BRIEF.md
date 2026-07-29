# Help System Redesign — Phase 5 (Discovery &amp; Orientation) — PM Brief

**Status:** Proposed — awaiting owner sign-off · **Created:** 2026-06-19 · **Priority:** High (closes the worst-served help need)
**Plan:** [HELP_PHASE5_DISCOVERY_PLAN.md](HELP_PHASE5_DISCOVERY_PLAN.md) · **Mockup:** [help-phase5a-discovery-prototype.html](help-phase5a-discovery-prototype.html)

## What this is

The third and final layer of the help redesign. The first two layers are live on dev: the **guide pages** ("I know what I want, where's the answer?") and the **in-context "?" help** on the work pages ("what does *this* mean, right now?"). This layer answers the question a brand-new, non-technical organizer can't even phrase yet: **"Where do I start? What can this platform do for me? And what am I building for everyone else?"**

It's the difference between a new organizer who stumbles through setup and never discovers they could have handed scorekeeping to a volunteer — and one who's gently shown the right next step, and the time-savers they didn't know to look for, exactly when they matter.

## What the organizer sees change

Everything here lives on the **tournament dashboard** (the one screen every organizer lands on) and the **setup wizard** — no new pages, no new menus.

1. **A "what's next" card at the top of the dashboard.** One headline, one sentence, **one** button — and it changes as the tournament moves through its life: getting ready to launch → days-away countdown → game day → wrap-up. It always points at the single most useful next thing, never a wall of options.
2. **Gentle "Did you know?" nudges.** A single, dismissible line under the "what's next" card that surfaces a capability the organizer probably doesn't know exists — and only at the moment it's relevant. Pre-event: *"hand scorekeeping to a volunteer — they get a phone scoring view and can't see your admin."* Game day: *"build your playoff bracket right from the Schedule page."* Dismiss it once and it's gone for good.
3. **"I want to…" shortcuts.** A short, outcome-worded list (not feature names) that changes by stage — *"Preview what teams will see," "Hand scorekeeping to a volunteer," "Reuse this setup for next year."* It's tucked under a "See common tasks" link on the dashboard, and it's also the first thing in the "?" help drawer, so a dismissed tip is always retrievable.
4. **A friendlier first run in the wizard.** First-time organizers get three plain-language bullets up front — *you're building a public page teams register on; your schedule and results go live on game day; nothing is public until you activate.* And every organizer gets a "here's what happens after you save" note on the final step, so the hand-off from wizard to dashboard isn't a cliff.

## Where each piece appears (and why it earns its place)

| Piece | Where | Why it earns the space |
|---|---|---|
| "What's next" card | Pinned at the top of the dashboard, every stage | The dashboard is the one screen everyone returns to; today the top of it is mostly empty. One clear next action removes "what do I do now?" |
| "Did you know?" nudge | One line inside that card | Surfaces the capabilities organizers miss entirely (volunteer scorekeeping, playoff tools) — the unknown-unknowns — without nagging. |
| "I want to…" shortcuts | Under the card + top of the "?" drawer | Answers the questions an organizer is actually asking *right now*, in their words, and gives a home to anything they dismissed. |
| Wizard first-run blurb + "what happens next" | First step (first-timers) + last step (everyone) | The wizard→dashboard hand-off is the single most disorienting moment today; this makes the journey explicit. |

## Who sees what (role &amp; plan)

- **Role:** the dashboard shows the **same** content to owners and admins — this layer does **not** differ by role. (Verified: the dashboard isn't role-gated.)
- **Plan:** the layer is mostly **plan-neutral** because the highest-value tips point at **free** capabilities — **Staff Kit / volunteer scorekeeping and gate check-in are free on every plan**, and **building a playoff bracket by hand is free**. Where a tip points at a paid feature, the wording adapts honestly:
  - *Auto-generating* a playoff bracket, *importing* a team list from a spreadsheet, the *post-event summary*, and *reusing this setup next year* are **Tournament Plus**. On a free org those shortcuts carry a small "Plus" marker and lead to the upgrade page; the nudges reword themselves to the free path ("build by hand", "share your permanent results link") rather than dangling a locked feature.
  - The *fan app* (install + live scores) is free; only push **score alerts** are Plus — reflected in the (later) persona panel.

## The anti-overwhelm guarantees (the hard rule)

This layer adds **availability and orientation, never nagging.** Concretely:

1. **One thing at a time** — one action and at most one nudge per stage. Never a menu, never a batch.
2. **Just-in-time** — a tip about scorekeepers or playoffs only appears at the stage it's useful; earlier-stage guidance retires automatically as the tournament advances.
3. **Always dismissible** — every nudge closes with one click and never comes back (remembered per tournament).
4. **Invisible to people who know the ropes** — the first-run wizard help shows only to genuine first-timers; once a tip is dismissed it stays gone; a seasoned organizer running their fifth event sees only quiet stage cues, not beginner orientation.
5. **Nothing is lost** — anything dismissed is always retrievable from the "?" help drawer. Tips are sparse *because* the full help is one click away.

## Why it matters

New, non-technical organizers are exactly the people who churn when the product feels opaque — and they're the ones who don't know to search for the features that make game day smooth. This layer meets them on the screen they're already on, shows them one next step, and quietly reveals the time-savers (volunteer handoff, playoff tools, reuse-next-year) that turn a stressful first event into a repeatable one. It should reduce "where do I even start?" support contacts and increase discovery of the free volunteer tools and the Plus features worth upgrading for.

## Sequencing &amp; tradeoffs

- **Ship 5a first** (the card, the two best nudges, the shortcuts, the wizard copy) — it's all static content + a remembered "dismissed" flag, **no database change, low risk, fully reversible.** Get it verified in the browser, then do 5b.
- **5b is the follow-on:** the "what everyone else sees" persona panel (parents/coaches/volunteers), the remaining nudges, and remembering dismissals **across devices** (which needs a small database change). Held back deliberately so the simple, high-value pieces land first and the persona panel can be validated at all screen sizes.
- **Tradeoff accepted in 5a:** dismissals are remembered per browser, not per account — clear your browser or switch devices and a dismissed tip can reappear. That's the price of shipping without a database change now; 5b fixes it.

## How to review it

Open the clickable mockup ([help-phase5a-discovery-prototype.html](help-phase5a-discovery-prototype.html)) and use the **Stage** and **Plan** switchers at the top:
- Watch the "what's next" card and nudge change from Draft → Pre-Event → Game Day → Post-Event → Completed.
- Flip **Free ↔ Plus** to see how the playoff/import/reuse wording and markers adapt.
- Dismiss a nudge (it stays gone; "Reset dismissals" brings them back).
- Click **"See common tasks"** and the **"? Help"** button to see the shortcuts in both places.
- Scroll down for the **wizard** additions (static) and a labeled **5b** preview of the persona panel.

## Success criteria

- A first-time organizer can always answer "what do I do next?" from the dashboard without leaving it.
- The free volunteer tools (scorekeeper handoff, check-in) get discovered before game day, not after.
- Returning organizers see no beginner clutter — measured by low nudge-impression / high-dismiss-once behavior.
- Zero added support load from the layer itself (nothing blocks, everything is dismissible and retrievable).

## Open decisions (details in the plan §8)

1. Game-day nudges — quietly available, or hidden until pre-event only? (Recommend: quiet + dismissible.)
2. Make the scorekeeper nudge disappear automatically once they've visited Staff Kit (small, no database change)? (Recommend: yes.)
3. Build the "what's next" card as a reusable component for future modules (house league, rep teams)? (Recommend: yes.)
4. Put the "I want to…" shortcuts in the "?" drawer on every tournament page, or only the dashboard? (Recommend: every page — it's the safety net for dismissed tips.)
