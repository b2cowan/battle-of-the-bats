# Club Tier Stage 13b · Each person's home and first day (build prompt, two sessions)

> Written 2026-11-07, after fix-now 2 was walked (§480, 23/23). The owner chose 13b before 13c because its drawing is already ruled.
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10 (status log).
> Hub (walk, ladder, findings, drawings): https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY. **Tab 12 "Homes" is the drawing**
> (owner desktop and phone, admin, league admin, registrar, treasurer). The Asks tab holds the rulings. Hub source:
> `.probe/nav-journeys/hub/content.cjs` + `build.cjs`; never edit the html. Evidence: `.probe/nav-journeys/VERIFY.md`.
> Marks: **[V]** = opened this session by the planner (file:line); **[H]** = handed over by a helper, **re-open before editing**.
> Line numbers drift. Branch `dev`, explicit pathspecs. Recommended model: Opus (money figures on the Overview; who sees which
> figure; email wording).

## What 13b is

**Each person opens the club and is shown their own home, and a new person is told what their role opens.** Two halves:

- **Session A, the homes (Asks 2 and 11):** the owner's Overview gains the club band above "This morning"; a club admin sees
  the owner's open setup steps, read-only; the league admin and the registrar get their own "This morning".
- **Session B, the arrival (Ask 10):** both arrival paths end on the role's home, every invite email says what the role opens,
  there is no default role, one line beside the picker says what the person will open, and Help is filtered by role.

13b does **not** change the sidebar's shape (13i), who sees which door (13a), the treasurer's Accounting lines and links (13d),
or the Permits door (13c). The band links to the Calendar, not to Permits, until 13c ships.

## Owner rulings this build carries

- **Ask 2 = A (2026-11-06, as recommended):** "A club band on the owner's Overview": a joined band **above** "This morning",
  built from figures that exist; tiles the summary plan builds (players, free time) join it later. The band goes above
  "This morning", never instead of it; "This morning" and "Your programs" stay exactly as they are.
- **Ask 4 = A:** this stage builds the band from what exists; the summary plan adds its tiles to the same band.
- **Ask 10 = A:** both arrival paths land on the role's home; every invite email carries the role's sentence; **no default
  role**; one line beside the picker says what they will open.
- **Ask 11 = A:** the admin sees the owner's open setup steps, **read-only**, "Still to do", with the steps the admin can do as doors
  (R-F-11: read-only, not "the admin completes them").
- **Standing, do not reopen:** D1 (2026-11-06): the club sees **one cash figure per team** and never a coach's own books; "each
  coach's budget" means the team's standing **with the club** (Accounting › Teams). The two-state coach-season ruling. The
  coach's rep arrival in the Coaches Portal is kept as is (a coach-only member gets no admin door, fix-now 2).

## ⚠ Where the drawing and the code disagree (read before the summary; four of these go to the owner)

The drawing's rule is "built only from figures the product already has". The code census says that is **true for two tiles and
not for the other two.** [H 2026-11-07, re-open each]

| Tile (as drawn) | What exists | What does not |
|---|---|---|
| **Cash on hand** "$2,870 · in the club's 4 books" | `clubCashOnHand(books)` (`lib/club-money-figures.ts:849` [V]) sums the org, tournament and league-season books, never a team's. `position.cashOnHand` on the Accounting summary (`lib/club-budget-report.ts` ~840/893 [H]). | Not in the brief. The summary route is **heavy** (a per-team register walk, ~13 reads per team [H]). |
| **Owed to the club** "$12,690 · teams $10,950 ($3,450 overdue) · house league $1,740" | Teams half: `owedByTheTeams` (`lib/club-money-figures.ts:913` [V]), `position.owedByTheTeams` { amount, overdue } [H]. House league, **per season only**: `seasonMoney(...).owing` / `owingPlayers` (`lib/league-money.ts:159` [V]). | **No org-wide house-league total and no combined figure.** The count `seasonMoney` gives is **registrations (children), not families**; the Families list counts people and mixes rep dues with league fees. |
| **This week** "Nothing booked · Next: Mon, Nov 16 · …" | `readClubCalendar(reader, from, to)` (`lib/club-calendar.ts:123` [V]); window capped at 42 days; refused on Tournament-tier plans [H]. | No "next booked event" selector, and not in the brief. |
| **Needs someone** "12U AA has no head coach · 12 families owe house league fees · 50 forms missing" | Head-coach gaps: `listTeamsWithActiveHeadCoach` (already read by the setup checklist, `lib/club-checklist.ts:9` [V]). | **Absent as counts:** families owing, forms missing (`missingFormsCount` per family only; needs Families access). |

Three more things the census found:

1. **The brief's "NO MONEY (C04)" rule has expired.** Its stated reason, "the club's money figures are known-wrong until Stage 3,
   so the brief says how many things wait, never how much" (`app/api/admin/club-brief/route.ts:22-23` [V]), was Stage 1's.
   Stage 3 has shipped. The band is therefore allowed to show money. Update that header comment and `ClubHubKit.tsx`'s header
   ("counts … never money (C04)", [V] lines 5-9) so they stop contradicting the screen; say it is the reason that expired, not a reversal.
2. **"Owed" already has several definitions** (the summary's per-year `outstanding`, the Teams tab's all-years `outstanding`,
   the brief's installments count, the Families `owedCents`) [H]. `tests/unit/club-money-one-definition-guard.test.ts` pins the
   club's figures to one definition. The band **must call the existing function for each half**, and a combined figure may only be
   the sum of two existing figures. **Do not write a new "owed" query.** This is also the 13d/13e finding (F-T2-4, F-O6-5: two
   "Outstanding" figures); do not add a third.
3. **Gate mismatch.** A treasurer can read the teams' owed figure and each season's ledger but **not** Families [H]. Every
   tile shows only to a reader who holds the gate of the page it opens (Accounting for the two money tiles, the club calendar's
   programs for This week). A tile the reader cannot open is **absent, not greyed.**

### Decisions for the owner (put them in the summary, wait for the answers before building the tile they touch)

1. **Who sees the band.** Ask 2 says "on the owner's Overview"; the drawing shows the owner. **Recommended:** the owner and the
   club admin (an admin holds Accounting by default [H]), each tile gated as above. The treasurer lands on Accounting, not
   the Overview, so is unaffected. The alternative is owner only. Not ruled; do not guess.
2. **"12 families" vs "12 players".** The product can count house-league **registrations** with a balance, not households.
   **Recommended:** say "12 players" (F-T5-1 itself says "$1,740, 12 players"); never mint a family count for one tile.
3. **"Needs someone".** It overlaps "This morning" directly below it (tryout applications, assistant coaches, payment requests
   already live there), and two of its three lines are absent as counts. **Recommended:** the tile carries **only** what "This
   morning" does not: teams with no head coach (existing read). The house-league owing line is already tile 2. "Forms missing"
   is left out of 13b (it needs Families access and a new aggregate); say so, and offer it to the summary plan.
4. **The numbers' cost.** **Recommended:** the band reads from **its own new route, fetched on the Overview only and after
   "This morning" has rendered**, never inside the brief (the brief loads on every club screen for the nav). If the Accounting
   summary's per-team walk cannot be skipped to get cash and owed, **stop and report**; do not ship an Overview that waits on it.

## Before any code: the plain-language summary (required, blocking)

Present a product-manager summary in the conversation first: per item, what each person (owner / admin / league admin /
registrar / treasurer / a person newly invited) sees differently, and what does not change. Put the four decisions above to
the owner and wait. Order the build so a tile waiting on an answer does not hold the rest.

## Session A, the homes

### A1 · The club band (Ask 2; F-O6-1, F-O6-9)

Drawing: hub tab 12. Eyebrow "THE CLUB TODAY · {weekday, month day}". Four tiles, joined as one band (the shared joined-band idiom;
look up the money-figures-band recipe in the portal's kit before drawing any markup). Phone: two by two, same order, above
"This morning". Each tile opens its lines:

- **Cash on hand** · "in the club's {n} books" · opens Accounting.
- **Owed to the club** · "teams {amt} ({amt} overdue) · house league {amt}" · opens Accounting › Teams ("each team's standing"; the
  team's standing **with the club**, never the coach's books). House-league half: sum of `seasonMoney(...).owing` over the
  club's live seasons; nothing to sum → the line is absent. Never a negative; "not yet" states are plain words.
- **This week** · "Nothing booked" or the next event · opens the Calendar. Earliest non-cancelled booking (`state === null`) from
  `readClubCalendar`; a thin selector is allowed, a new calendar query is not.
- **Needs someone** · per owner decision 3.
- A ghost tile "PLAYERS · every program, this season and last · from the summary plan" is **drawn, not built.** Leave it out of the DOM.

States: loading (the band's own skeleton, below the folded content), failed (one quiet retry line; "This morning" unaffected),
a brand-new club (no books, nothing owed: tiles say so plainly, or the band is one line, never zeros that look like a bug).
Money format via the shared money formatter; clock via `formatTime()` if a time shows. Keep the band **and** "This morning" above the
900 px fold on desk (the drawing's rule).

Guards: a source test that the band's route calls `clubCashOnHand`, `owedByTheTeams` and `seasonMoney` and holds **no `.from('…')`
money query of its own**; the one-definition guard still passes; a test that no coach-book module is imported (the
`bank-coach-*` bars already exist [H]); a gate-matrix test (owner, admin, treasurer, registrar, no-Accounting admin → which tiles).

### A2 · The admin's first day (Ask 11; F-A1-4)

The setup checklist is owner-only (`app/api/admin/org/club-checklist/route.ts:19` [V]: `ctx.role !== 'owner'` → forbidden) and a
new admin's Overview is "Nothing is waiting on you this morning" with no guidance [H]. Drawing: a read-only **"Still to do"**
block of the owner's open steps (teams, head coaches, budget...), a door on each step **the admin can open**, gone when setup is done.
Phone the same.

- Let an **admin** read the checklist (owner-or-admin gate on the route; a treasurer, league roles and coaches still 403). The
  checklist's steps themselves are unchanged. Reading it does not let an admin tick or change anything.
- A step whose page the admin cannot open (e.g. Budget when their Accounting is off) shows as text, not a door.
- The owner's "Setup: n of 5 · Continue setup" line is unchanged. The admin sees "Still to do", not the owner's line.
- Do not add a "Setup · n of 5" header chip (F-O1-8). It is on the 13b ladder but I found no drawing for it. If the drawing is on
  tab 12, build it; otherwise it goes to the owner as a question in the summary.

### A3 · The league admin's and the registrar's "This morning" (F-NAV-6)

Today a league role has **no** "This morning" unless registrations wait; at zero the whole section disappears [H]
(`ClubHubKit.tsx` `hasBriefSection`). They already land on the live season (13a), so this is the Overview they reach by choice.
Drawing: **League admin:** "To review {n} · oldest {date}", "Teams {n} · not on a team". **Registrar:** "Find a child or a parent"
first, then "To review {n} · oldest {date}", "Still owing {amt} · {n} players", "Waitlist {n} · {division} is full".

- Census each tile first. A tile with no existing figure is **left out and reported**, same rule as the band.
- The league admin's drawn "Club time {h} · not divided" is the 13d hand-off. **Do not build it here.**
- The registrar's count shows "15", not "9+".
- "Still owing" is the registrar's own season's `seasonMoney` figure, the same definition as the band's house-league half.

### A4 · The small one (L1)

Suppress the "Install FieldLogicHQ" banner on a first landing only (hub tab-11 recommendation L1, "13b, small"). Find the banner,
find what "first landing" can honestly mean without new storage (a flag already set at sign-up, or the browser's own); if it needs a
column, **stop and ask** rather than adding one.

Read the hub before building any other "13b small" item (T1 "first steps" ribbon on Accounting, T5 "when Close is offered"):
build one only if the hub marks it 13b **and** draws it. Otherwise list it as an open owner question.

## Session B, the arrival

### B1 · No default role, and one line saying what they will open (Ask 10; F-A5-5, F-A5-7, F-O1-17)

`InviteMemberDialog.tsx`: `useState(initialRole ?? '')` then `chosen = role || (staff ? 'staff' : roles[0])` ([V] lines 112 and 117),
so the picker silently chooses **Staff**. Change it: the picker starts on "Choose a role" and **Send is off until one is chosen.**
`?invite=volunteer` (the Staff kit's door) still pre-sets Volunteer. Beside the picker: "Can open: {what that role opens}", from the
**same sentence the picker already shows** (`roleOpensSentence` via the roles route [H]). F-A5-7 asks for a preview; the sentence
is the preview. Do not add a screen.

The checklist's step 1 ("Invite an admin and a treasurer") links to the Members list, not the dialog [H]. With no default, the right
door is the Members page with Invite open and no role chosen. Do not preset Admin: the step names two roles.

### B2 · Every invite says what the role opens (Ask 10; F-A1-1, F-T1-1, F-A1-2)

`orgInviteHtml` (`lib/email.ts:1643` [V]) is one generic template: "{inviter} invited you to join {org} on FieldLogicHQ as a {label}".
It has no sentence about the role and none about what FieldLogicHQ is.

- Add the role's sentence and one line on what the product is. **One source for the sentence:** the accept page already shows
  `memberOpensSentence` (`lib/member-access.ts:251` [H]), and the picker shows `roleOpensSentence` (:225), with one deliberate
  difference for admin ("…but not its billing or settings" vs "every program on its plan"). **Use the accept page's**, because the
  email's reader lands there next, and the two must not disagree. The picker keeps its own. Do not edit the admin trim.
- One name per role in the email: F-A1-2 found "administrator / Admin / Admin" and "League admin" vs "league administrator". Use the
  role label the product uses everywhere else.
- `orgMemberAddedHtml` (`lib/email.ts:1745` [V]) is the "already has an account" email. Same sentence.
- ⚠ **Side finding, fix here:** the added email does not escape `orgName` where the invite email does [H lines ~1755-1756]. Confirm [V]
  and escape it in the same edit.
- Resend (`lib/invite-links.ts:83-88` [H]) must send the same text. Check that it builds from the same function.
- Words go to **/marketing** (one pass, before the walk); the email change goes to **/legal** before hand-off (invitations are
  transactional, but this is an email the platform sends, and CLAUDE.md routes it).

### B3 · Both arrival paths end on the role's home (Ask 10; T1's "link, not landing")

Sign-in and invite-accept already share one resolver (`getDestinationForMembership`, `lib/user-contexts.ts:422-498` [H]), and give the
same home to every board role: owner → onboarding checklist until done, otherwise Overview; admin → Overview; treasurer → Accounting;
league admin and registrar → House league; volunteer → their job [H]. The gap is the "added" email: its link is
`/auth/login?next=/{slug}/admin` for every role (`app/api/admin/members/invite/route.ts` ~88-92 [V that a `next=` link is built]), so a
treasurer or league role who clicks it lands on the Overview, not their program.

- Build the "added" email's destination from the **same resolver the sign-in uses** (and `adminDoorHome` for the admin door),
  not a second role table. Keep the coach (`/{slug}/coaches`) and volunteer branches as they are.
- Possible divergence to **check, not assume** [H, not run]: `getDestinationForMembership` has no coach branch, while plain sign-in uses
  the coach context (`/{slug}/coaches`). The picker does not offer Coach, so this only matters for a coach-flow accept. If it is
  real, say so in the summary; fixing it is its own call.
- Guard: a test that, for each role, the "added" email's destination equals the sign-in destination.

### B4 · Help by role (F-A1-9)

Help's first-day content is collapsed and not role-filtered [H]. The hub's "Getting-started paths by role" shows the Treasurer, League admin
and Registrar paths to any role whose plan carries the module, and a treasurer or registrar cannot see the Org admin card, so the guide's
roles section is unreachable to them. Fix: each role's first-day path is open by default for **that** role, and a role is not offered
another role's path as its own. Edit `lib/help-content/*.tsx` (search words move with the prose) and the hub shell; `/docs` checks the rest.

## Not in this build

- 13c (Permits door, empty-week next event F-XR-6, "+ New venue" check), 13d (the treasurer's house-league line and links F-T5-1/F-T5-7,
  the league admin's "Club time"), 13e (the two "Outstanding" figures), the summary plan's tiles (players, free time).
- "Forms missing" and "families owing" as club-wide counts (owner decision 3).
- F-O6-14 and F-T1-9, which are on the 13b ladder but whose text I did not read; read them in the hub and take them **only** if the
  hub says 13b and draws them. Say which, in the summary.
- Owner questions F-XR-8 and F-XR-9; rep dues online; the signed-in family app.

## After the build

- **Reviews:** `/simplify` (a new route, a new tile pattern and an edited email: likely), then `/review` (high: money on the
  Overview, email wording, who can read the checklist).
- **/marketing** one pass on the words below; **/legal** on the emails; **/accounting** only if a figure's definition changed
  (it should not; if it did, that is the bug).
- **Help:** `/docs` for B4 and for the Overview, the admin's first day and the invite flow.
- **Walk:** two walks, one purpose each, as Owner QA Ledger rows and checkable Artifacts, on a fresh Harbourtown copy and a fresh-club copy.
  - Walk A: the owner's band (every tile opens its lines; a no-Accounting admin sees no money; a brand-new club reads plainly), the admin's
    "Still to do", the registrar's and league admin's "This morning", desk and phone.
  - Walk B: invite each role (no default; the line; the email text), accept, and arrive on the role's home; the "added" email's link for a
    treasurer; Help for a treasurer and a registrar.
- **Records:** mark 13b built in the Stage 13 plan with a status-log entry; one line in the PM brief; the data dictionary only if a
  column was added (none is expected); `NAV_STANDARD` only if a nav surface changed (none is expected).
- **Restart:** the dev server needs a restart before hand-off (a new route and files).

## Words for /marketing

- [ ] "THE CLUB TODAY · {date}" and each tile's label and sub-line (the drawing's words, ported as drawn) — the owner's and admin's Overview
- [ ] "Still to do" and its lines — the admin's Overview
- [ ] The invite and "added" emails' role sentence and the one line on what FieldLogicHQ is — every invited person
- [ ] "Choose a role" and "Can open: …" — the invite dialog
