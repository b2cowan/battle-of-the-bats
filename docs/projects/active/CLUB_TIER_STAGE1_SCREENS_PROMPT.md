# Club Tier Readiness — Stage 1, session 2 of 2: the club screens (behind the foundation's switch)

> Paste into a fresh session on `dev`: *"execute @docs/projects/active/CLUB_TIER_STAGE1_SCREENS_PROMPT.md"*.
> Written 2026-09-25 from the **ratified** Stage 1 mockups (hub v7, owner: *"I agree with your mockups"*;
> **build spec = v8 or later**, see below), and split from session 1 the same day (owner: *"I agree"*).
> Session 1, `CLUB_TIER_STAGE1_SERVER_PROMPT.md`, built the roles, members, invites and billing logic and
> the pages outside the admin frame. This session builds the club's **admin screens** on the Admin Design
> Continuity foundation. Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (§4A/§4B/§4H
> rows, §5 rulings, §6 Stage 1 + 1b, §8 gates). Hub (the visual spec; republish the SAME path when the walks
> are added): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
> https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups tab, specimens 1–12, warm and dark. Foundation:
> `ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md` (the switch contract) and its plan's slice ledger.
> Memory: `project_club_tier_readiness`, `project_admin_design_continuity`.

## Stop first — three preconditions (do not start without all three)

1. **Session 1 is committed** (plan §6 Stage 1 shows its parts closed, with commit anchors). Its handoff
   lists the reads and refusals this session calls. Read it.
2. **Foundation slice 1 is committed**: the switch, the theme, the club rail (specimen 3), the club phone
   bar and More menu (specimen 4), the kit page header, R1/F1. **Slice 2 (buttons, chips, F2 type) should be
   too.** If it is not, build on slice 1's parts and note what slice 2 will restyle under you. **This stage
   never builds the frame.** If slice 1 is not on `dev`, stop and tell the owner.
3. Nobody else is mid-edit in the screens below. Check each file for another session's uncommitted
   changes first, and never overwrite or restore them.

**Sharing the dev server:** foundation slices 2–5 run beside this session and sweep on the same server.
Ask the owner for a quiet window before any dev-server restart, sweep or walk-prep run that drives many
pages.

## The switch (binding — the foundation's contract applies to this session)

These screens are **redesigned behind the foundation's switch**, and they ship to customers on the
foundation's single release day. So:

- With the switch **on**, the new kit screen renders. With it **off**, today's screen renders **untouched**.
  Leave the legacy screen's code alone. The release slice deletes it, not you.
- Session 1 changed only additive server behaviour, so both versions work against the same routes.
- The foundation's identity check (switch off) must stay quiet after your commits.
- **The foundation does not restyle these screens** (its prompt says so). Your kit version IS their restyle.
  The foundation's release waits on them.

The screens this session owns: **the club hub** (`app/[orgSlug]/admin/page.tsx` + `AdminHubClient`),
**Members** (with the Role Guide and the audit log), **Plan & billing**, **Org Settings** (the "Your
public site" card), **the club setup checklist** (onboarding), and the gated `/pricing` + `/for-clubs`
placement (specimen 8). The last one is public, so it is gated by the **plan gate**, not the switch
(see Part 3).

## The visual spec

The ratified hub is the spec for every surface it depicts, in **both themes** (build-to-approved-mockups:
anything deliberately not matched is flagged to the owner at build time, never discovered in the walk).
Every NEW / RESTYLED / UNCHANGED tag's note is part of the spec, so read them (click through on the hub).
Words tagged "copy: /marketing" are placement until `/marketing` supplies the final text. Build with the
drawn words and list them for `/marketing` in the handoff.

**⚠ Build to hub v8 or later, not v7.** v8 (2026-09-25, the same day as ratification) is a correction to the
coaches-portal model, found by the Admin Design Continuity measurement, and changes nothing about what a
screen does:
- **No page header carries a subtitle line** (`CoachPageHeader` has no slot, by the 2026-08-11 ruling).
  Five drawings had one: the hub, Members, Plan & billing, the audit log and the setup checklist. They are
  removed. The checklist's "you can come back to this from Overview" sentence now sits beside its button.
  **The hub's "9 of 15 teams" capacity readout moves** from under the title into the Organization line at
  the foot of the hub, beside "plan & billing", which it opens. It is still built.
- **Eyebrows and chips are monospace**, as the kit's `.eye` / `.chip` really are (`var(--font-data)`).
  The v7 drawings showed them in the body face.
- A drawer's identity line (Manage member: the email and "Admin since") and the invitee's join card are
  not page headers and keep their second line.
The foundation ratified all of this as F1–F4 on 2026-09-25 (ADC hub Decisions tab). The foundation's
frame and kit parts carry it, so this stage inherits it rather than re-implementing it.

## Rulings that govern this stage

- **D6** no Founding Season offer for Club. **D7** Club · Association purchasable with proration (1b).
  **D8** admin gets every plan module; "tournament-only" is decided from the plan. **D10** the coach invite
  door is Stage 2 (the Coach row is drawn, **not built** here).
- **Asks 1–6, accepted as drawn (2026-09-25):**
  1. The treasurer reads teams inside Accounting only: no Rep Teams door.
  2. League roles appear only when the club runs a house league.
  3. One constant club phone bar: the foundation built it, and this stage feeds it the plan-aware program
     order.
  4. Paid→paid moves: up now with a proration preview; down at renewal, refused over the smaller band's cap.
  5. The trial-takes-a-card sentence on billing, checkout and the pricing card (`/marketing`'s words).
  6. Coaching staff sit in a collapsed section, off the Members board table.
- **Admin Design Continuity R0–R5 + F1–F4.** Do not reintroduce org colour, dark literals or a subtitle line.

## Order of work (each part: `/review` before it is called done; commit only when the owner says)

**Part 1 — The hub (specimens 1–2).**
- Program doors ordered by what the club RUNS. Tournaments and house league stay out of the lead until
  the club has one; the "Also on your plan" line; feed the same order to the rail and the phone bar.
- **The morning brief** from session 1's counts, filtered by access, collapsing to one line when nothing
  waits. **No money figure** (C04).
- The "9 of 15 teams" readout in the Organization line (v8). The Coaches Portal line appears only for
  someone who really coaches here. No first-tournament banner for a club.
- For an admin, owner-only areas show as **locked rows**. The treasurer's hub is specimen 2.

**Part 2 — Members (specimen 5).**
- One grouped **dropdown** for Invite and Manage (Admin · Treasurer · Staff · [league roles when the club
  runs a house league] · Scorekeeper).
- The board table with **"What they can open"** from session 1's shared computation, and a chip per
  override. Scorekeepers and Coaching staff are collapsed sections (Ask 6). Invite / Resend / Manage / Remove
  render only for someone who can manage members (J10-012).
- Manage:
  - **one Save**;
  - program rows with Role default / Turn on / Turn off and a consequence sentence each;
  - owner-only powers not offered;
  - **Suspend asks first**.
- The Role Guide rewritten from the role defaults (specimen 5 matrix, the role-matrix kit gap). The
  **audit log** (specimen 11): four sentence-columns, an honest failure state, and "No member changes yet"
  only on a successful empty read.

**Part 3 — Plan & billing and buying (specimens 7–8).**
- The plan card with the **team-capacity readout** (the plan-and-capacity kit gap). The two-band table.
  "What Club includes" (Families in; invoicing and reconciliation out). The cancel review names the club's
  programs. No tournament-slot or seat meters, and no League Plus / Coaches Portal shelf for a Club.
- The move: the preview before confirm, and the down-move's renewal date and refusal (session 1's reads).
  The team-cap refusal offers the move in place. The trial/card sentence. The reactivate card lists exactly
  what reactivation restores; a gated plan's button is "Contact us to reactivate" until the Stage 8 flip.
- **D6 on screen:** no Founding Season banner, price line or chooser ever renders for a Club (billing and
  onboarding).
- `/pricing` and `/for-clubs` placement (specimen 8) are **behind the plan gate** (`early_access`), so the
  Stage 8 flip is one step. These are public pages: not the admin switch, and not the account theme.

**Part 4 — Settings and the checklist (specimens 9–10).**
- The "Your public site" card:
  - **Public site** (the master switch) and **Listed in the club directory**, with the directory switch
    greyed while the site is off (the settings-switch-row kit gap);
  - the confirm names only what goes offline today;
  - hero-banner and Venue Library copy;
  - venue saves show their refusals.
- The club setup checklist from session 1's computation: five steps plus Families, each with a button;
  `?plan=club` read; no plan chooser header; the "come back from Overview" line beside its button (v8).

**Part 5 — Tests, help, walks.**
- The layout sweep lists every screen above (the foundation's slice 0 registered today's versions; add the
  switch-on versions). Both themes are clean.
- `/docs`: a "Set up your club" article; the Members/roles and billing articles rewritten.
- Walks on the hub's QA tab, with the switch on (next free § numbers on the ledger; never re-sort; pin
  identities, not figures):
  - **§B (shell):** the hub as owner, admin and treasurer; Members, the invitee (session 1's pages),
    settings, the checklist, the audit log and the plan-check wall, **in both themes**;
  - **§B2 (buying):** the Stripe sandbox.
- Update plan §6 Stage 1 and memory. Handoff in product-owner voice; offer `/review` and `/docs`. These
  screens reach customers on the **foundation's release day**, and the foundation's slice 6 checks they are
  ready.

## Do not

- Build or restyle the frame (top strip, rail, phone bar, More menu, page header). The foundation owns it.
- Touch today's versions of these screens. They render with the switch off until the release deletes them.
- Build the Coach row, the coach invite door or team-level changes (Stage 2); money screens or figures
  (Stage 3); public-site content beyond the gated pricing placement (Stage 4); notification rows (S1-04);
  an Accounting "Summary" entry (S1-02, Stage 3b).
- Widen a route's role list to make a button work. Hide the button from roles the route refuses.
- Put Founding Season language anywhere a Club can see it, or the organization's colour back in admin chrome.
- Commit with `git add -A`. Stage explicit pathspecs, in a private index if another session is active.
