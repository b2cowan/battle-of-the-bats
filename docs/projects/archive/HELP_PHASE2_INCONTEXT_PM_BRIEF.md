# Help Redesign — Phase 2: In-Context Help — PM Brief

**Status:** Proposed · **Created:** 2026-06-18 · **Priority:** High (continues the operator-flagged help overhaul)
**Plan:** [HELP_PHASE2_INCONTEXT_PLAN.md](HELP_PHASE2_INCONTEXT_PLAN.md) · **Mockup:** [help-phase2-incontext-prototype.html](help-phase2-incontext-prototype.html)

## What this is

Phase 1 made the help *center* good — guides are now one scannable page, and a content audit (Phase 1.5) made every guide accurate. Both are done and committed. But operators still have to *leave* their work, go to the help center, and come back. **Phase 2 brings the help to them** — onto the actual pages where they're building divisions, fixing a schedule, or reviewing registrations.

This is the "Contextual" layer of the three-layer model (Reference = the guides; **Contextual = this phase**; Discovery = later phases).

## What changes for the user

1. **A quiet "? Help" button on every tournament work page.** Click it and a panel slides in from the right showing *that page's* help — the explanation, the steps, the common questions — without leaving the page. Close it and you're exactly where you left off. (A "see the full guide" link is right there if they want more.)
2. **Plain-English hints under the trickiest fields.** Things like "what does a pool actually do?" or "leave this blank to inherit the tournament fee" now sit quietly under the field itself, always visible — no clicking, no guessing.
3. **The "?" tooltips actually work on tablets now.** Today, tapping a "?" badge on an iPad does nothing (it's a real bug). After this, they work on touch and by keyboard — important because game-day check-in and scoring happen on tablets and phones.
4. **A heads-up before the few actions you can't undo.** Where a consequence is currently hidden, we surface it *before* the click — clearing a playoff bracket also deletes any scores in it; publishing closes registration and emails coaches; archiving/completing from the list dropdown currently happens with **no warning at all** (a one-click mistake locks or hides your tournament — we're fixing that).
5. **The standalone Coaches Portal finally gets help.** Coaches using the free portal have *no* help link today. We're adding one (and fixing a spot where mobile coaches couldn't reach help either).

> See it first: the clickable mockup shows the slide-over, the field hints, the fixed tooltip, and the warnings on a realistic page. Per our convention, you sign off on the look before anything is built.

## Why it matters

Organizers work under time pressure — opening registration, fixing a clash, entering scores from the sideline. Every time the answer lives in a separate help center, they either guess or stop what they're doing. Putting the right answer one quiet click away — on the page, in context — is the single biggest reduction in "where do I find this?" friction, and it should cut repeat support questions about divisions, registration statuses, publishing, and close-out. The tablet tooltip fix matters because that's exactly the device volunteers use on game day.

## Anti-overwhelm (the hard rule, again)

Nothing here nags. The "?" button never pops open on its own — you click it when you want it. Field hints are tiny and muted. Warnings appear **only** when the risky thing is actually possible (you have a bracket to clear, a registration still open). Returning users who already know the ropes simply never click any of it. We're adding *availability*, not noise.

## Who sees what

- The "?" help and field hints appear for whoever can see the admin page (owners/admins). Help itself stays **free** — it's never paywalled; a Plus-only feature mentioned inside a help section keeps its existing "Plus" label, nothing more.
- Coaches get the new portal help for free.
- The warnings appear to whoever can perform the action.

## What's intentionally NOT in this phase

The "what's next" dashboard guidance, the "did you know?" capability nudges, the "what everyone else sees" panel, and guided tours are all **later phases** (Discovery layer). Phase 2 is strictly about answering "what does *this* mean, right now, on this page?"

## Customer impact

- Answers found *in place*, without losing your spot.
- The most-confusing controls (pools, fees, registration statuses) explained inline.
- Tablet/phone help works — game-day volunteers stop hitting a dead "?" badge.
- Fewer accidental, irreversible mistakes from un-warned actions.
- Coaches on the free portal can finally find help.

## Rollout (staged, each step shippable)

1. **Foundation + the tooltip fix** (the fix alone immediately repairs every broken "?" across the app).
2. **The four densest pages first** — Divisions, Registrations, Schedule, Results — plus the field hints and the key warnings. This delivers most of the value.
3. **The rest of the tournament pages** — quick additions.
4. **The Coaches Portal** — help page + entry points.

## How you'll test it

Open a work page → click "? Help" → confirm the right help shows and closes cleanly (and your scroll/filters are untouched). On a tablet/phone (or responsive mode), tap a "?" badge and confirm it now works. Trigger a risky action (e.g. clear a bracket) and confirm the heads-up appears before the confirm box. In the Coaches Portal, confirm the new Help link appears on desktop and mobile.

## Success criteria

- Every tournament work page (and the coaches portal) offers in-context help without navigating away.
- Tooltips work on touch and keyboard everywhere they're already used.
- The actions you can't undo state their consequence before the click; nothing irreversible happens from a single un-warned click.
- No new nagging — returning users aren't interrupted.
- The mechanism is reusable, so house-league / rep-teams / accounting can adopt it later without a rebuild.

## Decisions — RESOLVED (2026-06-18, all confirmed by owner)

1. **Dismissible warnings?** ✅ Split — teaching tips can be dismissed forever; genuine "can't undo this" safety warnings stay whenever the risk is actually present (like the existing Seal warning), so they're never constant wallpaper.
2. **Coaches "?" drawer now, or just the help link first?** ✅ Ship the link/page now (closes the dead end); add the in-page panel as a fast-follow.
3. **Bundle the dropdown-confirm bug-fix here?** ✅ Yes — fix the unguarded archive/complete dropdown in this phase.
4. **Keep field hints to a few fields first?** ✅ Yes — start narrow, expand on evidence.
5. **Tablet behaviour:** ✅ Full-screen help on phones, side panel on larger screens.
6. **How far beyond tournaments now?** ✅ Tournaments + coaches now; other modules adopt the proven pattern later.

## Size & risk

Low risk, fully reversible — it's additive UI plus one bug fix; no data, no billing, no schema. Roughly a few days of focused work for the foundation, then mostly quick page-by-page wiring.
