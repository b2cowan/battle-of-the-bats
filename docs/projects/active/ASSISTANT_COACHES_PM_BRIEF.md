# Assistant Coaches — PM Brief

**Status:** Decisions locked 2026-06-25 — ready to build. Plan: `ASSISTANT_COACHES_PLAN.md`.
**Created:** 2026-06-24

## What this is
Make a team's **coaching staff** first-class: a head coach plus one or more **assistant coaches**, each a real participant who can log in, see their team, and help — starting with team chat and the day-to-day, without being handed the keys to the team's money or families' private information.

## Why it matters
A team is rarely one person. Today everything is built around a single head coach, which means: the coach chat program can't reach the whole staff, and the only way to "add" an assistant is a workaround that accidentally hands them **everything** — the roster's private guardian details, the team's budget and dues, internal notes, and the ability to email every parent. This review's headline finding: the safe, useful first version isn't "add chat" — it's **"add a proper assistant role that can do the helpful things and is locked out of the sensitive ones."** Once that exists, the chat program picks assistants up automatically, with no extra work.

## What the customer sees differently
- **Head coaches** run their own staff. In **every** case — whether the team is coach-run or club-run — the head coach invites their assistants, sets what each can do, and removes them, with a simple invite link. The club president/admin does **not** manage these relationships; they keep oversight (they can see every assistant and remove anyone) and, if their organization has screening rules, can optionally switch on an "admin approval required" setting. *(Decided with owner, 2026-06-24 — this is the franchise model: the coach operates, the org oversees.)*
- **Assistant coaches** get their own login and a focused view of their team. By default they can do the coaching basics — chat, schedule, attendance, lineups, roster (view) — and nothing sensitive. The head coach then **assigns duties per assistant**: this one helps with the budget (set to read, or read-and-edit), that one runs lineups, another can send parent emails. Birthdates, parent contacts, the team's money, and internal notes are all off until the head coach grants them.
- **Clubs** get the whole coaching staff included — no per-assistant fee.

## Customer impact & priority
- **Retention/stickiness:** more of the staff living in the workspace = more reasons the team stays. This is the upsell logic — *more assistants / more delegation on paid plans*, not a charge per person.
- **Acquisition loop:** assistants who later run their own team already know the product.
- **Priority:** high as an enabler — the in-org coach chat project depends on it, and it closes a live privacy over-grant.

## The locked first version
1. Assistants are a lightweight, team-scoped login — not a new account type, not a full member of the organization.
2. The head coach **assigns duties per assistant** (budget read/edit, lineups, announcements, etc.) — safe least-privilege defaults, the coach grants from there.
3. Free on every plan; small cap (1–2) on free teams, unlimited on paid; no per-seat fee.
4. Head coach administers their assistants in **every** case (coach-run *and* club-run); the club admin is override-only (visibility + remove + optional "approval required" lever, default off).
5. Assistants auto-join team chat and get game-day/schedule/results alerts; they don't get money/dues/private-info alerts by default (each adjustable).

## Decisions — all locked (2026-06-25)
- Paid/club teams first; free teams a fast-follow; house league later.
- Per-assistant duty assignment (not a single fixed bundle); team money is a three-way choice per assistant — off, view-only, or view-and-edit.
- Parent announcements draft-only by default (sending is a grantable duty); birthdates/contacts and internal notes off by default.
- Cross-club assistants work with no friction (added as a team guest, not an org member; the one-org rule is a soft default, not a hard lock).
- New assistants see full team-chat history; scorekeeping stays out of this version.

## Success criteria
- An assistant can be added and immediately help (chat, schedule, attendance, lineups) **without ever** seeing the team's money or unlocking families' private data by default.
- The head coach can assign specific duties (e.g. budget read-only) to specific assistants; the org admin can see and remove any assistant but doesn't manage the day-to-day.
- The coach chat program includes assistants with no rework.
- No new privacy over-grant; the existing one is closed in the same release.
