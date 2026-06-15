# FP-5 — Tournament Organizer Experience (PM Brief)

**One-liner:** Stop the tournament product from crowning the wrong champion or lying at go-live, then polish the day-one and game-day surfaces so it feels finished.

**Who it's for:** the tournament organizer ("Dana") running the platform's best-selling product end to end (discovery → wizard → registrations → schedule → game day → close). The happy path is strong — FP-5 fixes the trust-breaking correctness bugs and false strings that surface exactly where it matters most: deciding who wins, and what the public sees when the event goes live.

**Priority:** High. Largest of the audit's Wave-2 fix-projects; ships after FP-1 (Trust & Integrity) and FP-3 (Volunteer Day-of), in parallel with the other Wave-2 work.

---

## Proposed functionality (what changes, highest-impact first)

**1. The bracket can no longer crown the wrong champion.**
Today three correctness bugs can hand a playoff to the wrong team:
- A **tied playoff score silently advances the away team** (a coin-flip the software makes for you, invisibly).
- Recording a **coin toss does nothing** to a bracket that's already filled — it looks like the toss was ignored.
- There is **no forfeit handling** — a no-show forces the organizer to invent a score, and that fake margin then distorts the run-differential tie-breakers that decide seeding.

After FP-5: ties on elimination games are caught and held for a decision instead of silently advancing; the coin toss re-seeds the bracket; and **"Mark forfeit" is a real action** — the present team gets the win, but the forfeit is excluded from run-differential so seeding stays honest. This is backed by automated tests on the win/seeding engine, since it decides who wins.

**2. Go-live links and confirmations stop lying.**
- The **Activate modal shows a Public URL that 404s** — the exact link Dana copies to Facebook at go-live. Fixed to the real address.
- A **"hide contact email" privacy setting is silently ignored** on the public news, rules, and home pages. Fixed so the toggle is honored everywhere.
- The **Archive confirmation is wrong twice** — it claims archiving "seals permanently" and "cannot be undone," when archiving is reversible and sealing is a different (Plus) action. Fixed to honest copy.
- The **Results page promises "scores appear live"** even before any schedule exists. Fixed to distinguish "no schedule built yet" from "built but not yet scored."

**3. Day-one mental model + live game day feel finished.**
The setup wizard / Event Settings wall (fees missing from the wizard yet inconsistently gating activation; settings cards that hide their values), the live game-day board (no "what's on right now," frozen live numbers, champion not crowned the instant the final ends), the registrations workflow (a built-but-hidden payment money-strip, broken filter deep-links, generic payment instructions), and volunteer staffing get the polish that makes the product feel complete.

---

## Why it matters / customer impact

These are not cosmetic. The bracket bugs can **produce a visibly wrong result in front of every team and parent at the event** — the highest-trust moment in the whole product. The go-live link bug sends fans to a **404 from the organizer's own Facebook post**. The privacy bypass **leaks a contact email the organizer explicitly chose to hide**. Most FP-5 wins are "a trust-breaking error stops happening" — the kind of thing that, once seen, makes an organizer doubt everything else the platform tells them.

**Roles affected:** owners / admins / staff running tournaments. No change to volunteer, coach, or fan surfaces (FP-3 and FP-2 own those).

---

## Success criteria

- A tied elimination game can **never** silently advance a team.
- Recording a coin toss **re-seeds** an already-filled bracket.
- A forfeit is a **real action** and does **not** poison seeding (excluded from run-differential, still counts as W/L).
- The go-live Public URL is **correct** (no 404).
- The "hide contact email" toggle is **honored on every public page**.
- Archive / Results / confirm copy is **honest** about what actually happens.
- Setup and game-day surfaces are **consistent and scannable** (one activation model; settings show their values; the live board shows what's on now and crowns the champion live).

---

## Notes / scope guards

- **Forfeit needs no database migration** (the game-status field is application-level), so this ships without schema risk.
- **Re-verified 2026-06-15:** two originally-listed items (single-team email names, schedule publish in playoffs) are **already fixed** and dropped from scope. Everything else is confirmed still broken.
- **Coordination:** the public-facing champion render, the public hero scorebug, and the marketing footer are owned by FP-2 / the marketing pass — FP-5 stays on the admin/organizer side of those seams.
- A couple of items (scorekeeper seat policy, a day-of staff-kit panel) may be **documented and deferred** rather than built, pending a billing/scope call — flagged in the plan.

Full implementation detail: `docs/projects/active/FP5_TOURNAMENT_ORGANIZER_PLAN.md`.
