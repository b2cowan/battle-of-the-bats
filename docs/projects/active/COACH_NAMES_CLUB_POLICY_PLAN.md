# Coach names: the club decides who is listed on team pages

**Status:** drawn and ruled 2026-10-23 (all six asks as recommended); build prompt written; A7 (the tryout page's name line) waits for
the owner. Part of Club Tier, rides the Club release. Brief: `COACH_NAMES_CLUB_POLICY_PM_BRIEF.md`. Drawings (Artifact):
https://claude.ai/artifact/ER9Grq3TkLbw7AYjzmhUYS (source `COACH_NAMES_CLUB_POLICY_DRAWINGS.html`). Build prompt:
`COACH_NAMES_CLUB_POLICY_BUILD_PROMPT.md`.

## Why

Club Tier Stage 4c-2 Part B let every coach put their own name on the team's public page. The club has no say: it cannot require
head coaches to be listed, and it cannot forbid names (a safeguarding position some clubs will take). The owner's point, from a
review of the Sharing card's wording: an org president may want all head coaches (or head and assistant coaches) visible and the
coaches unable to overwrite that, or no names at all.

## The decision

One **club-wide** setting, **Coaches on team pages**, four choices: Coaches choose (today, the default), Head coaches always, Head and
assistant coaches always, No coach names. It decides what is **shown** and never changes a coach's own switch, so going back restores
everyone. Where the club has decided for a role, that coach's switch becomes a sentence and plain text.

| Ask | Ruled |
|---|---|
| A1 where | New sixth row on Public site |
| A2 who | Owner only; an admin reads it as text |
| A3 other staff | Keep their own switch |
| A4 asks first | Only the two "always" choices, with a count |
| A5 told | One in-app notice to each newly listed coach |
| A6 under No names | Sentence plus "Not listed by your club" |
| A7 tryout line | **Ruled 2026-10-23: yes**, the same rule governs "Email the head coach"'s name |

Role words: head coach, assistant coach, and manager / treasurer / helper (all from the existing display label; a manager has
`coach_role = 'assistant_coach'`, so the label, not the role, decides).

## Ladder

1. Owner answers A7. 2. `/marketing` words. 3. Migration 352 (`organizations.coach_names_policy`) via `/db`. 4. The rule function and
the shelf. 5. The club's route and the Public site row. 6. The coach's row. 7. The notice. 8. The tryout line (after A7).
9. Help via `/docs`. 10. Walk, as its own Artifact, each step naming its role.

**Status (2026-10-23):** steps 1-10 BUILT on `dev`, committed `509119985`; A7 ruled yes. Migration 352 applied to DEV only. Words settled in `COACH_NAMES_CLUB_POLICY_COPY.md`. Walk §363 ✅ PASSED 40/40 (owner, 2026-10-23): https://claude.ai/artifact/FGyYGQgPs7P6ty15JJdfCK. Prod apply of 352 owed before the code ships.

## Out of scope

Per-team exceptions; any email, phone or player on a public page; changing who may set Schedule visibility (a separate question: a
head coach or a schedule-managing assistant can move a team's games to Public today, which is a bigger exposure than a name, and has
not been looked at yet).
