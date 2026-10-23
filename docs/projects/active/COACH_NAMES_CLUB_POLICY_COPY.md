# Coach names: the club decides who is listed. The words

> Written 2026-10-23 by `/marketing`, before the UI is built (Part 0 of `COACH_NAMES_CLUB_POLICY_BUILD_PROMPT.md`). **Status: settled by
> `/marketing`; build from this table, not from the drawings, where they differ** (`COACH_NAMES_CLUB_POLICY_DRAWINGS.html`; the
> changes are listed at the bottom). Help articles are `/docs`'s, from these words.
>
> **House rules applied:** sentence case; **"listed" / "not listed" and nothing else** (never "shown", "public", "visible" for the
> same idea; "shows" is used only for what a page does); role words from `staffKindWord()`, never typed again; the bare
> possessive; no "(optional)" tags; no brand claims of nationality.
>
> **Apostrophes:** type each string with whatever its words file already uses. The Public site strings (`lib/public-site-words.ts`)
> and API messages are **straight**; the coach's Team settings door and the notice are **curly** (as their neighbours are). This
> doc writes straight apostrophes.

---

## 1. The club's side: Public site, the row "Coaches on team pages"

The sixth row, between "Contacts and documents" and "Visibility". Absent (never locked) for a club without Rep teams.

| ID | Where | Final text | Note |
|---|---|---|---|
| 1.1 | Row title | `Coaches on team pages` | As drawn. |
| 1.2 | Closed summary | The choice's name: `Coaches choose` · `Head coaches always` · `Head and assistant coaches always` · `No coach names` | One list of four names, used here, in the radios and in help. |
| 1.3 | Lead | `Who is listed under Coaches on each team's public page. It is the same for every team. A listing shows a name and a role, never an email address, a phone number or a player.` | As drawn. It is about the Coaches shelf, which stays true. |
| 1.4 | Choice 1 | `Coaches choose` + `Each coach decides whether their own name shows. Everyone starts not listed.` | As drawn. |
| 1.5 | Choice 2 | `Head coaches always` + `Every head coach is listed. Assistant coaches and other staff choose for themselves.` | As drawn. |
| 1.6 | Choice 3 | `Head and assistant coaches always` + `Every head coach and assistant coach is listed. Team managers, treasurers and helpers choose for themselves.` | As drawn. |
| 1.7 | Choice 4 | `No coach names` + `Nobody is listed, whatever a coach has chosen. Their choices are kept and apply again if you change this.` | As drawn. |
| 1.8 | Hint under the list | `A coach with no name on file is left out. Names show only while the team has a live season. The same choice decides whether a team's tryout page names its head coach.` | **Third sentence added** (A7, ruled yes): the choice now governs a second public place, and the owner should read that where they choose. |
| 1.9 | Radio group's accessible name | `Who is listed under Coaches` | |
| 1.10 | Save | The house pill: `Saved` (fades); a failure stays: `Couldn't save · Retry`. No new save wording. | |
| 1.11 | Refusal (API, 400) | `Pick one of the four choices.` | |
| 1.12 | Save failure (API, 500) | `Couldn't save your changes. Try again.` | The row's existing line, straight apostrophe. |

### 1a. The admin who is not the owner (read-only)

The row's lead (1.3), then plain facts and one sentence. No radios, no greyed choice.

| ID | Choice | "Listed" fact | "Choose for themselves" fact |
|---|---|---|---|
| 1a.1 | Coaches choose | `Coaches who switch their own name on` | (none: one fact only) |
| 1a.2 | Head coaches always | `Every head coach` | `Assistant coaches and other staff` |
| 1a.3 | Head and assistant coaches always | `Every head coach and assistant coach` | `Team managers, treasurers and helpers` |
| 1a.4 | No coach names | `No one` | (none) |
| 1a.5 | The sentence, all four | `The owner chooses who is listed.` | As drawn. |

Labels for the facts: `Listed` and `Choose for themselves`, as drawn.

### 1b. The two windows that ask first (the "always" choices only)

`KitDialog`, buttons only at the foot: `Not now` on the left, the action on the right. The counts are the real ones from the club's
live teams: **people newly listed** (not those already listed), the **teams** they are on. Singular and plural by count.

| ID | Window | Final text |
|---|---|---|
| 1b.1 | Head coaches, title | `List every head coach on team pages?` |
| 1b.2 | Head coaches, body | `{h} head {coach/coaches} on {t} {team/teams} will be listed under Coaches on {their team's public page / their teams' public pages}, with their name and role. Each one gets a notice and can read it in Team settings.` |
| 1b.3 | Head and assistant coaches, title | `List head and assistant coaches on team pages?` |
| 1b.4 | Head and assistant coaches, body | `{h} head {coach/coaches} and {a} assistant {coach/coaches}, on {t} {team/teams}, will be listed under Coaches on their {team's public page / teams' public pages}, with their name and role. Each one gets a notice and can read it in Team settings.` |
| 1b.5 | Buttons | `Not now` · `List them` |

Variations by what is already true (the count only includes people not already listed):
- **Going from Head coaches always to Head and assistant coaches always** lists only assistants: the title reads `List assistant coaches on team pages?` and the body drops the head clause: `{a} assistant {coach/coaches} on {t} {team/teams} will be listed under Coaches on …`.
- **Nobody would be newly listed** (every head coach is already listed, or the club has no coaches with a name on file): no window. The choice saves at once with the `Saved` pill; there is nothing to confirm.
- **Going the other way** (Head and assistant coaches always to Head coaches always) quietly puts assistants back to their own choice. No window, no notice (`Saved`).
- **Coaches choose** and **No coach names** only take names away or hand the choice back: they save at once. No window.

---

## 2. The coach's side: Team settings, Sharing, the row "Show my name on the team's public page"

The label stays in every state: `Show my name on the team's public page`. Where the club has decided for this coach's role, the switch is
replaced by plain text in the same place. **No tag, no pill, no greyed switch.** The coach's own earlier choice is kept out of sight
and returns when the club goes back to Coaches choose.

| ID | State | Description (under the label) | Control slot |
|---|---|---|---|
| 2.A | The club leaves it to coaches | `Your name and role only.` | The switch, as today. |
| 2.B1 | The club lists head coaches; viewer is a head coach | `Your club lists every head coach, with your name and role. Nothing else.` | `Listed by your club` |
| 2.B2 | The club lists head and assistant coaches; viewer is a head or assistant coach | `Your club lists every head coach and assistant coach, with your name and role. Nothing else.` | `Listed by your club` |
| 2.C | The club lists head coaches; viewer is an assistant coach, manager, treasurer or helper | `Your club lists every head coach. For other staff it's your choice. Your name and role only.` | The switch, which works as today. |
| 2.D | The club lists head and assistant coaches; viewer is a manager, treasurer or helper | `Your club lists every head coach and assistant coach. For other staff it's your choice. Your name and role only.` | The switch, which works as today. |
| 2.E | No coach names; everyone | `Your club isn't listing coach names on public pages.` | `Not listed by your club` |

A phone wraps the full text; nothing is shortened. The save pill under the row is the portal's existing one.

---

## 3. The notice to a coach a choice newly lists

One in-app notice per person, however many teams, only to people a choice newly lists. None when names are hidden or the choice is
handed back. It names no team.

| ID | Where | Final text |
|---|---|---|
| 3.1 | Title | `{Club} now lists you as a coach` |
| 3.2 | Body | `Your name and role show under Coaches on your team's public page. Your club chose this for every team.` |
| 3.3 | Link | The coach's own Team settings. |
| 3.4 | Preferences row, name | `Your club lists you as a coach` |
| 3.5 | Preferences row, description | `Your club chose to list you under Coaches on a team's public page.` |

---

## 4. The family tryout page

No new words. The existing lines stand (`CLUB_TIER_STAGE4C2_COPY.md` I1, I2, I7):

| ID | State | Text |
|---|---|---|
| 4.1 | Club chose No coach names, or the head coach is not listed | `Questions about these tryouts? Email the head coach` + address + Copy; accessible name `Copy the head coach's email address` |
| 4.2 | Head coach is listed (either "always" choice, or their own switch under Coaches choose) | `Questions about these tryouts? Email {Name}, head coach` + address + Copy; accessible name `Copy {Name's} email address` |

---

## What changed from the drawings, and why

| # | Drawing | Final | Why |
|---|---|---|---|
| 1 | Hint had two sentences | A **third** sentence says the choice also decides the tryout page's head-coach name | A7 was ruled yes; a second public place now follows this setting, and the owner reads it where they choose, not in help. |
| 2 | Window: `Coaches will see this in their Team settings.` | `Each one gets a notice and can read it in Team settings.` | A5 added the notice after the window was drawn; the window should say how people hear. |
| 3 | The window's title and body were fixed for the two choices | Variants for assistants-only, and **no window** when nobody is newly listed | The drawing's own note says the count is people not already listed; a window asking to list zero people is noise. |
| 4 | State C: `Your club lists head coaches.` | `Your club lists every head coach.` | Matches state B1, so the same fact is not worded two ways. |
| 5 | State D: `Your club lists head and assistant coaches.` | `Your club lists every head coach and assistant coach.` | Matches the choice's own sub-line (1.6) and state B2. |
| 6 | State E: `…on team pages.` | `…on public pages.` | With A7 the choice reaches the tryout page too; "team pages" would be untrue there. |
| 7 | State B named heads only | Added B2 for the head-and-assistant choice | The drawing said "the role word follows the coach's role" but did not write the sentence; it needs its own so an assistant is not told about "every head coach" alone. |
| 8 | No notice words | Section 3 written | The drawing had only the bell row's sample. |

⚠ Carried for `/docs`: the help articles (`lib/help-content/coaches.tsx`, `org.tsx`) take these names for the four choices and the same sentences; keep "listed / not listed" in every `keywords` and `searchText` too.
