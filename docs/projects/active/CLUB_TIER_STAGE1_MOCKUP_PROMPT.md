# Club Tier Readiness — Stage 1 mockup session prompt ("The club shell")

> Paste into a fresh session on `dev`. Written 2026-09-25. **This session draws; it does not build.**
> Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` — read §3 (exit definition), §4A
> (org shell ledger, A01–A16), §4H (H01–H09), §5 (rulings D1–D12, all landed), §6 Stage 1 + 1b, §11
> (J10 register). PM brief beside it. Project hub (ONE artifact for the project's whole life, republish
> the SAME file path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
> https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Memory: `project_club_tier_readiness`.
> Stage 0 is running in another session (`CLUB_TIER_STAGE0_KICKOFF_PROMPT.md`) — see "Working beside
> Stage 0" before touching the hub file.

## Blocking gate — item ONE is the mockup

1. **Mockups, published on the project hub's Mockup tab, before any code.** Nothing in Stage 1 is
   built until the owner ratifies the drawings — and the owner ratifies **after his Stage 0 walk**,
   so expect one revision round from what he saw there. Draw the DECISIONS, not every control
   (~12 specimens, listed below), and **always the whole screen, before and after**, for the four
   screens a club owner lives on: the hub, Members, Billing, and the phone shell.
2. Every highlight is clickable (owner ruling): a finding flag (`A01`…) opens what the code does
   today and what the drawing changes; every NEW / RESTYLED / UNCHANGED tag carries its own note.
   Findings dialogs jump to the matching `A01 —` heading on the Full Plan tab (already there for the
   headline findings; add headings for any you flag that are missing).
3. **True size for anything that is about size.** The phone bar, the More sheet and any tap target
   are drawn inside a fixed 390px frame with the 44px reference block beside them, and the hand-off
   tells the owner to open the artifact on his phone.
4. Record every ruling the owner makes on the hub's Decisions tab **as it happens**, not at the end.

## What Stage 1 changes (the brief for the drawings)

A club owner, admin, treasurer and registrar each land on a hub that leads with what the club runs;
the board can be staffed from the Members screen with roles that mean what they say; a club can be
bought (both bands), moved between bands with proration, cancelled and brought back; settings say
what they do; the onboarding checklist is a club's, not a tournament's; the phone reaches every
module. Rulings that govern the drawings, all landed 2026-09-25:

- **D8** — an Admin sees every module the plan carries by default (Families stays an explicit
  grant); a treasurer sees accounting plus a read of rep teams; the hub decides "tournament-only"
  from the **plan**, never from a member's permissions.
- **D7** — Club · Association is purchasable at launch; the Club ↔ Club · Association move is a
  prorated change to the one subscription, never a second checkout; both band prices are published
  (marketing writes the words — draw the placement, use the Facts doc's numbers as placeholders and
  tag them "copy: /marketing").
- **D6** — no Founding Season offer for Club: no banner, no "free until", no 2028 chooser on a Club.
- **D12** — **draw in the warm kit** (`docs/agents/design/`, `memory/design_system.md`, the coach
  shared style kit's tokens and components). The "before" frames are the current dark HUD screens;
  the "after" frames are warm. This is the first admin surface drawn warm — say so in the intent
  footer, and note any component the admin side needs that the kit does not yet have.
- **D3/D5** are Stage 6, **D1/D2** Stage 3, **D10** Stage 2 — do not draw those here. Where the hub
  must show a money tile or a team row, draw it as the *slot* with today's true figure, tagged
  UNCHANGED, never a redesigned money surface.

## The specimens (draw these; nothing else)

1. **The club hub, whole screen, before/after, desktop.** Plan-aware order: the club's programs
   first (Rep Teams, Accounting, Families, Public Site), Tournaments last and absent from the lead
   when the club runs none; the "First tournament setup available" banner gone for a club (G01); a
   **president's morning brief** strip — numbers and attention items that already exist behind the
   attention summary (pending tryouts, pending requests, payables due, coach approvals) — drawn as
   the Stage 1 shape with a clear "more comes in Stage 2/3" note. Findings on it: A01, A12, G01, J4-041.
2. **The hub for an Admin and a Treasurer** (two states of specimen 1, not new screens): what D8
   makes visible, and the "isn't turned on for you" wall for a module the plan does not carry
   (the coach-portal plan check, B05 — one specimen of the wall, reusing the coach portal's
   `CoachNotGranted` idea, not a new pattern).
3. **Desktop sidebar at the hub root and inside a module** — the rail is empty at the root today;
   the Org Admin section gains Audit log, PDF settings, Notifications; Rep Teams gains its three
   missing entries; Accounting gains Budget / Budget vs. Actual / Summary as **nav entries only**
   (their screens are Stage 3). Findings: A12, H08, J4-029.
4. **The phone shell at 390px, true size, before/after:** the bottom bar for a club (what the four
   tabs are on the hub root and inside a module; Families no longer wears tournament tabs) and the
   **More sheet** that reaches every module, Org Admin, Billing, Members — with the 44px floor
   block beside the rows. Findings: A12, H08, J4-045. Respect the standing phone rulings in
   `memory/project_coach_mobile_experience` (tab row never shows the active tab twice; icon-only
   actions on mobile admin; a form covers the nav, a menu sits on top of it).
5. **Members, whole screen, before/after.** The invite and Manage pickers as **dropdowns** (house
   rule) carrying Admin, Staff, Treasurer, League admin, Registrar, Scorekeeper, **and a Coach row**
   (the door is Stage 2/D10 — draw the row, tag it "opens Stage 2"); a per-row override signal;
   one Save; Suspend with a confirm; Role Guide copy that matches D8 and the parity policy; the
   "belongs to another organization" refusal gone for volunteers who coach elsewhere (A03).
   Findings: A02, A03, A13, J4-039/040, J10-004/012/018/020/021/022/023/024.
6. **The invite acceptance and the pending card** — the two states an invitee meets (a pending
   card that names the org and the inviter; an accept page that fails honestly on error).
   Findings: J10-007/008/010/011, A13.
7. **Billing for a Club, whole screen, before/after:** the plan card with the **team-capacity
   readout** ("9 of 15 teams"), the shelf without League Plus / Coaches Portal upsell for a Club,
   **Buy Club / Buy Club · Association** as real actions, **the band move as a QUESTION in a window**
   (the modal ruling: a window is for a question or a form — "Move to Club · Association? Your next
   invoice is prorated …" with the number as a placeholder), cancel and **come back** (reactivate
   restores everything — A07), trial/card copy that agrees with the pricing card, and **no
   Founding Season banner** (A08/D6). Findings: A05, A06, A07, A08, A10, A15.
8. **Pricing page + `/for-clubs` band placement** — one specimen each showing where both band
   prices and the "up to 15 / 15–30 teams" line sit; words tagged "copy: /marketing". Finding: F10.
9. **Org Settings** — the public-site switch named for what it does ("Public site: on/off") and a
   separate "Listed in the directory" control; the tournament-first copy replaced; the Venues copy
   for all modules. Findings: A09, F04, A14.
10. **The club onboarding checklist** — a rep club's steps (staff the board, create teams, name
    coaches, public page, budget), every step with a button, Families present, house league offered
    only if the club runs one, no tournament-first header. Finding: A11.
11. **The audit log** — restored and simple (one specimen: the table with actor / action / target /
    when, in the warm kit). Finding: A04.
12. **Notification preferences for a club admin** — the org preference grid gains Rep Teams,
    Accounting and Families sections (the events themselves are Stage 2/3/7 — draw the sections
    with the events named as "arrives with Stage n"). Finding: H06.

Each specimen: one-line design intent in the hub's `#intent` footer; NEW / RESTYLED / UNCHANGED
tags per element with a note; finding flags per instance with a `data-here` sentence.

## Working beside Stage 0 (the hub file is shared)

- **Read the hub file fresh before every edit** — never edit from a copy already in your context.
  The Stage 0 session adds the QA Walk tab at its very end; your edits are the Mockup tab section,
  the `FINDINGS` entries you add, the `#intent` footer map, the walk sub-nav and the stage strip's
  "Design" chip. They do not overlap. Republish the same path after each round; each publish stacks a
  version on the one URL.
- If a publish is refused because the artifact moved, take the newer content the tool hands back,
  merge your Mockup-tab changes onto it, republish. Never `force`.
- Git: both sessions modify `CLUB_TIER_PRODUCTION_READINESS_HUB.html` in the shared working copy.
  Commit with a private index and explicit pathspecs (`reference_shared_worktree_stage_race`); never
  `git checkout --` or `restore` the hub file. Commit only when the owner says.
- Do not touch the Stage 0 files (`scripts/seed-club-fixture.mjs`, the sweep's routes) or run the
  fixture seed yourself; if you need "before" screenshots of the club with real data, wait for
  Stage 0 to report the fixture exists and take them from `uat-club-org`; until then, `dev-club-org`.

## Inputs to read before drawing

- Plan §4A + §4H rows (what the code does today, with anchors) and §6 Stage 1 + 1b (the build's
  intended shape) — draw to those, argue from the code where they disagree.
- `docs/projects/active/ADMIN_IA_MULTIMODULE_NAV_PLAN.md` — the June IA findings this stage folds in
  (Phases A and C); its "foldable" note is now executed here.
- `memory/design_decisions.md` (in-repo; the 2026-09-25 D12 entry and the 09-23 drawer-layers
  ruling), `memory/design_system.md`, `docs/agents/design/PROJECT_HUB_TEMPLATE.html` rules 7–8,
  `memory/feedback_build_to_approved_mockups`, `memory/feedback_clickable_design_annotations`,
  `memory/feedback_mockups_as_claude_artifacts` (true-size rule), `memory/feedback_form_selects_are_dropdowns`,
  `memory/feedback_mobile_icon_only_actions`, `memory/feedback_required_marker_not_optional_tags`.
- The current screens themselves: `app/[orgSlug]/admin/AdminHubClient.tsx`, `components/admin/AdminSidebar.tsx`,
  `components/admin/AdminBottomNav.tsx`, `app/[orgSlug]/admin/org/{members,billing,settings,members/audit}/page.tsx`,
  `app/[orgSlug]/admin/onboarding/page.tsx` — read them for the "before" frames; do not redraw a
  control that is fine (tag it UNCHANGED so the build cannot drop it).

## Hand-off

Product-owner voice. Lead with what the four roles see differently; list the specimens by number;
say plainly which findings each closes and which it deliberately leaves to a later stage; **tell
the owner to open the hub on his phone for specimens 4 and 5**; name the rulings you need from him
(anything the drawings could not settle) as numbered asks with a recommendation each. Offer
`/design` for a review pass before he looks, if the session has budget. Do not write the Stage 1
build prompt until the drawings are ratified; when they are, derive it from the ratified hub
version and plan §6 Stage 1 + 1b.

## Do not

- Build anything. Change role defaults, gates, billing code, copy files or help.
- Draw money surfaces (Stage 3), the team page or coach invite door (Stage 2), the public site
  (Stage 4), the calendar (Stage 6), permits (Stage 10).
- Write customer copy for prices or plans — placement only, tagged for `/marketing`.
- Mint a second artifact for this project; the hub is the only one.
