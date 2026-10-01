# Tournament admin redesign · Stage 2 drawn — Teams and registration (Teams, registration health, Communications)

> Paste into a fresh session on `dev`. Written 2026-09-30, after Stage 1 (game day) was built (`890d0aac`) and
> walked (§253 ✅, 31 of 31). **Design only: no product code until the owner rules.** Club Tier's Stage 3a drawing
> session may run at the same time; read "Working beside the other sessions" before touching the dev server or a
> shared file.
>
> **Read first:**
> - `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`: §1 (evidence — label every guess as a guess), §2 (the rulings not reopened),
>   **§3 "Registration and teams"** (F15, F16 as fixed by the defects pass, F17, F18, F40 and the note that Stage 2
>   still owns the pool board's SHAPE), §4 (the nine rules across the stations), §5 (the ladder; row 2), **§6 Stage 1
>   as drawn and as built** (the row recipe it extended, what it retired, what it left for Stage 2), §7 (A5 — the Club
>   seams; A11 — a worded action on a phone row; A12 — a row's action is olive), §9, §11 (the formatting check —
>   Stage 1's fifteen departures are the checklist you run before the owner sees a drawing).
> - The hub (ONE artifact; republish the SAME path): `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_HUB.html` =
>   https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM. **Walk tab stations 6 (Teams — Q 6.1) and 7
>   (Communications)**; the Stage 1 tab for the drawing method and the "Reserved — Teams itself is redrawn in Stage
>   2" box; the Decisions tab (the shape questions were ruled 2026-09-29 **as recommended**, so Q 6.1 is already
>   "Reshape, in Stage 2" — draw it, don't re-ask it).
> - `docs/agents/design/TABLE_AND_LIST_STANDARD.md` (incl. §3.6 as amended 2026-09-29: a row that opens, opens from
>   anywhere) and `TABLE_EXCEPTION_REGISTER.md`; Club Tier's Ask 8 rulings (Club plan §6 "Across every stage —
>   formatting").
> - Memory `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
>   `feedback_build_to_approved_mockups`, `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`.

## What Stage 2 draws

**The Teams screen** (`tournaments/registrations/**`, its views, `teams-admin.module.css`,
`components/RegistrationHealthPanel`):
- **The first team on screen one** (F15: today the first row is at 864px on a phone, 699px at a desk): the money
  and registration-health readouts become **closed rows above the list** (Q 6.1, ruled). Registration health keeps
  the demo tour's `registration-health` anchor on its row (the demo force-opens it).
- **A row that fits the phone and opens the team** (rules 3 and 7): one frame on a phone (S.7), the phone row's
  content order, a right chevron, the whole row the target; the team's record opens from it. A worded action in a
  row follows A11 / A12 as ruled on Stage 1 (olive on white, beside the chevron) — say which actions earn one.
- **The pool board's shape:** one frame with the pools as band rows, the Waitlist and "Accepted — needs a spot" as
  bands in the same frame (F40 fixed the ground; the shape is yours). F16's restack from the defects pass is the
  "before".
- **One colour per status, words not glyphs** (F17, J1-073): accepted / pending / waitlisted / rejected each one
  colour everywhere (list, board, phone), and the phone shows words, not single letters.
- **Payments and "Add my team"** are **Club Stage 7's seams** (A5): draw them as today's behaviour, tagged "owned by
  Club Stage 7", placed where the redesign puts them.

**Communications** (`tournaments/communication/**`): F18 — the "Plus unlocks targeting" hint shows on every plan and
the composer has no audience picker. Draw what the screen honestly offers (rule 9, "say the true thing"), and put
the targeting question to the owner as an ask with options (build targeting, or drop the upsell until it exists);
placement only, words tagged for `/marketing`. Plan gating: no gate value changes (A6); reconcile with
`docs/agents/strategy/PLAN_PRICING_FACTS.md`, never restate a price.

**Include the Exhibition format** wherever it changes Teams (an Exhibition event has no pools or bracket —
`TOURNAMENT_EXHIBITION_FORMAT_PLAN.md`: an inapplicable item is ABSENT).

## Method (Stage 1's, which the owner ruled "as drawn")

1. **Measure before drawing.** A probe in `.probe/` (never `test-results/`), the `org-owner` session on
   `uat-plus-org`'s Championship, at 390×844, 360×780, 768×1024 and 1440×900, Warm and Dark, numbers read from the
   browser's geometry: where the first team sits, how many panels come before it, taps to accept a team, to open a
   team's record, to send a message; every control under 44px; every sideways spill. ⚠ The fixture is small — say
   where a real registration (30 teams, three pools, a waitlist) changes the answer; seed nothing without asking.
2. **Draw on a new "Stage 2" tab**, at true size, both widths, whole screen before (today's captures) and after
   (drawn Warm, a Dark copy cloned at load), every flag and fix chip clickable with a `data-here` sentence, NEW /
   RESTYLED / UNCHANGED per element with its own note, the 44px block beside every phone frame. Measured figures on
   the drawing come from the drawing (re-measured at build, as Stage 1 did).
3. **Run the formatting check before the owner sees it** (plan §11's list, plus the standard's §3.6), and put it
   on the Stage 2 tab's last section as Stage 1 did.
4. **The asks,** each with options, a recommendation, the tradeoff and a checkbox per option on the paste-back. At
   least: Communications' targeting (above); which row actions earn a worded button on Teams (A11's shape applied
   here); anything the walk finds that §3 misses — don't force-fit.
5. **Taps to beat** (record today's and the drawing's): accept a pending team; open a team's record; move a team
   to a pool; message every team.

## Working beside the other sessions

- **Club Tier Stage 3a's drawing session** may run at the same time, and the release may be running in another
  chat. **One browser tester at a time:** before any probe, capture or `auth-setup`, ask the owner whether another
  session is measuring or sweeping (a second runner rotates the shared UAT sessions and revokes the other's
  mid-run). Scope anything sweep-like with `--only=`.
- **A new shared pattern is an ask, not an invention.** The admin's rows and tables have one recipe (`ClubRow*` in
  `components/admin/kit/club/RepKit`, extended by Stage 1: `lead`, `captionFirst`, `beside`, `RowAction`,
  `ClubRowFrame`, a band `count`). If Teams needs a new variant (a status column, a pool band with a capacity
  count, a bulk-select row), draw it as an ask tagged "shared — Club Tier's money tables draw tables too", so the
  two programs don't each invent one.
- **No code, no help, no gates.** Your files: the hub's Stage 2 tab, its FINDINGS / INTENTS / Decisions additions,
  the plan's §5 row 2 and a §6-style Stage 2 section, the PM brief, your TODO line, memory. Read the hub fresh
  before every edit; **parse its scripts before every publish** (one bad apostrophe kills every tab); never
  `force` a refused publish.
- **Git:** private index, explicit pathspecs; commit only when the owner says.

## Hand-off

Product-owner voice. Lead with what an organizer sees and does differently on Teams and Communications, with the
measured before and the drawn after (first team's position, taps). **Tell the owner to open the hub on a phone.**
The asks as numbered questions with a recommendation each. Offer `/design` for a review pass if the session has
budget. **Do not write the Stage 2 build prompt until Stage 2 is ruled**; when it is written, its definition of done
includes retiring the old look of every file it rebuilds (the Teams page and its sheet, the health panel,
Communications and its sheet), which `npm run check:old-look` and the strict admin colour gate hold — Admin Design
Continuity's closing step made them this program's.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Design the Club seams' insides (fees to the club ledger, "Add my team" for a club — Club Stage 7), Storm Mode, the
  Big Board, the admin frame or navigation, public pages (a preview only as a door), or the schedule (Stage 3).
- Change a price, a plan name or a gate; write customer copy (draw the placement, tagged `/marketing`).
- Remove a demo tour anchor without naming its new home (`registration-health` stays on its row).
- Mint a second artifact. The hub is the only one.
