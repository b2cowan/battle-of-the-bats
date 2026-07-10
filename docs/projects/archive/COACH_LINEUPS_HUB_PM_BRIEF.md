# PM Brief — Lineups Hub (Coaches Portal)

**One-liner:** Turn the Lineups page from a list of links into the real home of lineups, saved templates, and season analytics — and lift the lineup builder out of the schedule pop-up onto its own page.

**Status:** Planned 2026-07-07, awaiting owner sign-off. No database change. Premium Coaches Portal only.

## Why it matters
The Lineups nav item currently just points coaches back into a schedule modal to do the real work. Templates have nowhere to live, and there's no season view of how playing time, positions, pitching load, or reused batting orders are actually working out. For a premium feature, that's underwhelming — the page that owns the slot should own the experience.

## What the coach sees differently
- **Lineups becomes a hub** with three zones: games that need a lineup, a real templates manager (view / rename / apply / delete), and a season analytics panel.
- **Editing a lineup opens its own full page** instead of a cramped schedule pop-up — more room for the batting order, positions, generate, and PDFs.
- **The Schedule still shows the lineup** as a read-only glance with an "Edit in Lineups →" link, so coaches can check a batting order without leaving the schedule.
- **Season analytics** (all from real saved lineups): fair playing time, bench balance, position variety, arm-care/pitching load, and — the new one — your real win-loss record for each batting order you've reused, sorted by how often you ran it.

## Honesty guardrail (important tradeoff)
- Every number is backed by lineups the coach actually saved; anything with no data behind it doesn't show up. No invented rows.
- "Records by reused lineup" is grouped by the **batting order you ran**, not by template name — the system doesn't track which template a game came from. When a reused order matches a saved template, we borrow its name; otherwise it's a generic label. Only games with a score entered count toward a record.

## Expected customer impact
- Templates finally have a home → coaches reuse proven lineups faster.
- Season analytics give a head coach real "am I being fair / am I overusing this pitcher / does this order win" answers — a genuine premium differentiator, honestly sourced.
- Cleaner mental model: lineups live in Lineups; the schedule links to them.

## Priority & sequencing
Medium-high (owner-initiated during portal walkthrough). Delivered in three safe steps so each is testable:
1. Move the builder to its own page (no behavior change) — test in isolation first.
2. Rebuild the landing page into zones (games + templates).
3. Add the season analytics panel.

## Success criteria
- A coach can build, view, and reuse lineups entirely from the Lineups area without opening a schedule modal.
- Templates are manageable from the Lineups page.
- Every analytics figure is traceable to a saved lineup; empty states are honest.
- No regression to the schedule, the free/basic portal, or capability gating (assistants without lineup access still can't see it).
- No database migration.
