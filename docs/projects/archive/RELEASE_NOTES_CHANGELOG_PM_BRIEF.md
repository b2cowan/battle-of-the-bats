# PM Brief — Release Notes, Changelog & Loose Roadmap

**Status:** Planned · **Priority:** Medium · **Captured:** 2026-06-28

## What we're proposing
Give customers two new ways to see the product is alive and improving:
1. A **public "What's New" / changelog page** on the marketing site listing what shipped, plus a short, **undated** "On the horizon" list of what's coming.
2. An **in-app "What's New"** panel for logged-in admins and coaches, with a small badge that appears when there's something new and clears once they've looked.

Behind the scenes, our release process will **draft** the notes automatically from what changed, and a human will **review and publish** them as part of the same release — so the notes and the features always go live together.

## Why it matters
- **Trust & retention:** customers paying monthly want to see momentum. A visible stream of improvements reassures them they bet on the right tool.
- **Fewer support questions:** "Do you support X?" and "Is anything coming for Y?" get a self-serve answer.
- **Sales proof:** a public changelog is evidence to prospects that the platform is actively maintained — useful next to the pricing/persona pages.
- **Low effort to maintain:** notes are generated from work we already did and reviewed in minutes, not written from scratch.

## What customers see differently
- **Operators (admins/coaches):** a new "What's New" entry point in the app, with a subtle badge when there's news. They can scan recent improvements without leaving the product.
- **Prospects / public:** a `/changelog` page they can browse and that search engines can index, including a soft look-ahead at upcoming themes.
- **No spam:** we are deliberately **not** emailing on every release in V1; the email option is held for major releases later.

## Deliberate tradeoffs
- **Loose horizon, not a dated roadmap.** We show *themes* of what's coming with **no dates**, so we get the trust benefit without turning every slipped timeline into a broken public promise — and without handing competitors our schedule.
- **Human-in-the-loop publishing.** We don't auto-publish raw release notes; a quick human edit prevents internal jargon or half-finished context from reaching customers.
- **No new database/admin tooling in V1.** Notes live as versioned content shipped with each release, which keeps build cost and risk low.

## Phase 3 — what changes (and what doesn't)
**For customers: nothing structural changes.** Same changelog page, same in-app "What's New." The benefit is that the notes stay current *reliably and promptly* — drafted from the work in each release instead of remembered later, so the page never goes stale and the writing stays consistently plain-language.

**The real change is to our release routine.** When we push to production, the flow auto-drafts a customer-facing note from what actually shipped (grouped into New / Fixed / Improved), the owner spends ~5 minutes editing it into plain English (or skips it if the release was purely internal), and it goes live *with* that same deploy. Each release gets tagged so the next draft knows where to start.

**Why it's worth doing:** it removes the "we forgot to update the changelog" failure mode, keeps notes and features perfectly in sync, and makes publishing a release note a ~5-minute habit rather than a writing task. We deliberately keep a human in the loop — we never auto-publish raw release notes, so internal jargon or half-finished context can't leak to customers.

## Success criteria
- Public changelog page live, linked from the marketing site, and indexable.
- In-app badge reliably appears for new entries and clears after viewing.
- Publishing a release note adds ≤ ~5 minutes to a production release (draft generated, human edits, ships with the deploy).
- Horizon section stays current with at most a quarterly light touch.
