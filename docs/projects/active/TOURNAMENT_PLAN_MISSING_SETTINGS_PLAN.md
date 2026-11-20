# The Tournament plan's missing settings — Implementation Plan

**Status:** on the board (Owner Morning Brief), id `tournament-settings`.
**History (not kept current):** Opened 2026-11-20 through `/plan` (owner call 4 of the retire-the-old-menu census, ruled
"yes" 2026-11-20, narrowed by ruling 1R the same day). Nothing drawn or built.
**PM brief:** [TOURNAMENT_PLAN_MISSING_SETTINGS_PM_BRIEF.md](TOURNAMENT_PLAN_MISSING_SETTINGS_PM_BRIEF.md).
**Sister plan:** [RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md](RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md) — its step 2 (1R: a
Premium coach's name and web address, print options and deletion request move into the Coaches Portal). **This plan's
first stage is the same drawing as that step's**, so both kinds of workspace end on matching settings.

## Goal

A Tournament or Tournament Plus organization's owner can **change the organization's name** and **send us a request to
delete the organization**, from a page their plan actually reaches — the two things the census found they cannot do
anywhere. The two-step requirement and the birthday cutoff are **not** in scope: under 1R they are not tournament concerns
("Call 4 narrows with it").

## The gap, re-checked in code (2026-11-20)

The census row was a lead; this is what the code does today.

- **Both cards live only on the Organization's Settings page.** `components/admin/kit/club/SettingsKit.tsx` — name and web
  address card `:275-294` (saves through `PATCH /api/admin/org-settings`, `:197-216`); "Delete organization" →
  "Request account deletion…" card `:336-344`, its window `:351-370`, calling the route at `:230-257`. Mounted only by
  `app/[orgSlug]/admin/org/settings/page.tsx`. Owner only (an admin sees the two-step card; others see NotYours).
- **A Tournament / Tournament Plus organization is redirected away from that page.**
  `app/[orgSlug]/admin/org/layout.tsx:35-37` — `isTournamentTier(planId) && !isTeamWorkspaceOrg(org)` →
  `/admin/tournaments` (`TOURNAMENT_TIERS = ['tournament','tournament_plus']`, `lib/billing-urls.ts:5`).
- **⚠ The web address is NOT part of the gap.** The Tournament plan's Settings & access tabs
  (`tournamentSettingsTabs`, `lib/admin-kit-nav.ts:1072-1081`) are Members · Payouts · PDF settings · **Web address**, and
  the Web address tab (`app/[orgSlug]/admin/tournaments/settings/web-address/WebAddressTab.tsx`) lets the owner change the
  slug through the shared `WebAddressWindow`. It sends the slug only — **the name has no home**. The census line ("no page
  to rename itself") is right about the name and wrong if read as the web address.
- **No tournament page edits the organization's name** (the per-event settings page does not touch it), and no account
  menu or help page offers deletion. Our own platform admin can rename an organization
  (`app/api/platform-admin/orgs/[id]/identity/route.ts`), which is the support fallback today, not the customer's door.
- **The routes already serve the plan — only the doors are missing.** `PATCH /api/admin/org-settings` takes `name`
  (`:73-77`), owner only (`:68-70`), no plan gate. `app/api/admin/org/request-deletion/route.ts` is owner only (`:15, :23`),
  no plan gate: POST emails `fieldlogichq@gmail.com` with the organization's name, address, id, plan, owner email, reason and
  time (`:25-45`); GET returns the online-payments ending section. **Nothing is recorded** in the database.
- **Nothing shipped since 2026-11-20 closed any of it.** `f9d1b4507` (steps 1 and 3) and `bd2e7fd58` (Founding removal)
  touched neither card nor either route; the only uncommitted change among these files (`lib/admin-kit-nav.ts`, another
  session's) has no settings, web-address, name or deletion lines.
- **The privacy policy's promise is met by email today.** `lib/legal-documents/privacy/2026-11-17.md:285-287`: "ask us to
  close your account and delete your information … Email **privacy@fieldlogichq.ca**. We will answer within **30 days**."
  Every plan can do that now; the in-product request is a convenience, which sets this item's priority (see the PM brief).

## Stages (by dependency and rework risk — no timing)

### Stage 1 — The drawing, shared with the sister plan's step 2

One `/design` session draws **both** kinds of workspace's settings together: the Premium Coaches Portal's three 1R
additions (sister plan step 2a) and the Tournament plan's two. It is one session because the point is that a customer
moving between the two meets the same shape — a name beside its web address, a deletion request in the same place
relative to billing. Drawn to the house mockup rules (an Artifact page, whole-screen before/after, true size; `/design`
reviews it before hand-off).

- [x] Drawing session, both workspaces on one page (sister plan step 2a + this stage) — 2026-11-20,
  https://claude.ai/artifact/K6TYzjQ1NZSZxfug9u4Rpz v1 (source `SETTINGS_BOTH_WORKSPACES_DRAWINGS.html`), `/design` review
  applied before hand-off.
- [x] Owner rules the named questions below at the drawing — **⚖ RULED 2026-11-20** (owner, paste-back of all eleven asks,
  every one as recommended):
  - **A1 (Q1):** the Web address tab becomes **Name & address** — one card, two rows (Name · Web address), no new tab.
  - **A2 (Q2):** the deletion request is the **last section of Plan & billing**, free Tournament (after "Managing more than
    tournaments?") and Tournament Plus (after Reduce or cancel) — the same place as the Premium portal.
  - **A3 (Q3):** everyone who reaches Settings & access sees the name; only the owner gets **Rename**, others read
    "Owner only" (the web address's rule). The deletion door needs no rule: Plan & billing is owner-only already.
  - **A4 (Q4):** the drafted window (drawing tab 6) goes to `/legal` as written.
  - **A9:** both buttons on Name & address are the white button (two equal actions, no lime on the tab).
  - **A10:** **record each deletion request** (a small database change); the section shows "Request sent {date}. We'll
    reply to {owner email} within 30 days." until we answer. Stage 3's first task (migration + dictionary + snapshots),
    subject to `/legal`.
  - **A11:** the window says a paid plan keeps renewing and points at Cancel; a request does not cancel the plan.
  - (A5–A8 are the sister plan's — recorded there.)

**Named questions for the drawing (open — not decided here):**

- **Q1 · Where the name sits on a Tournament plan.** Options as seen in code: (a) the existing **Web address** tab grows
  into "name and web address" — one card, the window it already opens; (b) a new **Settings** tab on Settings & access (the
  census's suggestion); (c) something else the drawing finds. The web address already has a home, so (b) adds a tab for one
  row unless the deletion request joins it.
- **Q2 · Where the deletion request sits on a Tournament plan.** Under 1R the Premium coach's request goes on the portal's
  **Billing** page, after Cancel Premium, shown to the owner whether or not the plan is paid. Matching that means the
  Tournament plan's **Billing** page (including the free Tournament plan, which has nothing to cancel); the alternative is
  the Q1 Settings tab. Matching across the two workspaces is the reason this stage is shared.
- **Q3 · Who sees each door.** The routes are owner only. Do an admin or staff member see the name read-only (as the Web
  address tab does for non-owners) or not at all?
- **Q4 · The deletion request's wording** — the window's title, its explanation and its confirmation. **`/legal` reviews it
  before it is built** (Stage 2). Carry to the drawing as drafted text, not final.

### Stage 2 — `/legal` on the deletion request (before the build)

Shared with the sister plan's step 2b (`/legal` on the same request's new home in the Coaches Portal): one review for both.

- [x] `/legal` reviews the drawn wording against the privacy policy (§ rights, "ask us to close your account and delete your
  information … within 30 days").
- [ ] **Questions to put to `/legal`, found in the re-check (not decided):** the request goes to `fieldlogichq@gmail.com`
  while the policy names `privacy@fieldlogichq.ca`; nothing is recorded, so nobody can show a request was answered within
  the 30 days the policy promises; and the request is for the **organization**, while the policy's promise is about a
  **person's** account — does the window need to say which it is, and where a staff member (not the owner) asks?
- [ ] Apply what it finds, or record it here as an owner question. A policy that promises what the product does not do is
  a defect to plan, not wording to soften.
- **✅ `/legal` ran 2026-11-20** — `docs/agents/legal/ORG_DELETION_REQUEST_WINDOW.md` (wording v0.2, applied to drawing
  tab 6). No lawyer needed for the window. Applied: "What isn't" names the tax records, the deletion record and backups
  and keeps everyone's sign-in; "Download or print anything you need to keep first"; reply promised within 30 days,
  deletion only on confirmation. For the build: the request goes to **privacy@fieldlogichq.ca**; the A10 record (org,
  who, when, reason, status, when answered) survives deletion as part of the deletion record; the confirmation goes to
  **every active owner**; the reply carries nothing commercial (CASL); "Export them first from Accounting" must name a
  page a Tournament Plus organization has. Privacy Policy: one §9 clause in the next version (carried forward in the
  legal index).
- **Owner questions from `/legal` — ⚖ RULED 2026-11-20** (owner: "L-A yes, L-B copy all"): L-A the paid-plan line as
  recommended; L-B the confirmation email copies every active owner, and one owner's confirmation is enough.
  - **L-A · a paid plan blocks deletion.** Platform-admin deletion refuses an uncancelled subscription, so a paying
    customer's organization can be deleted only when the paid time ends, or now by ending the plan early with no refund
    (Terms §8). /legal recommends the window say exactly that — "{Plan} is paid until {date}. We can delete {name} then,
    or now. Deleting now ends {plan} early, and the time left isn't refunded. Tell us which when we reply." — in place of
    A11's "Cancel it first" line (which does not make deletion sooner). Amends A11's wording, not its rule (a request
    still does not cancel the plan).
  - **L-B · co-owners.** One owner's confirmation deletes an organization other owners run; /legal recommends the
    confirmation email copy every active owner (a co-owner can object in reply). Yes / or require every owner?

### Stage 3 — Build

After Stages 1 and 2. No database change expected (both routes exist and need no plan gate); if `/legal` asks for a record
of requests, that becomes a migration and this stage's **first** task, with `docs/agents/db/DATA_DICTIONARY.md` and
`npm run refresh:snapshots` in the same unit of work.

- [ ] The name door where Q1 lands (likely `app/[orgSlug]/admin/tournaments/settings/…`, reusing the existing name save; the
  `tournamentSettingsTabs` list in `lib/admin-kit-nav.ts` if a tab is added).
- [x] The deletion request where Q2 lands, reusing the existing window and route rather than a copy (if it moves out of
  `SettingsKit.tsx` for both this and the portal, it moves once, shared with the sister plan's step 2c).
  **Built 2026-11-20 (build prompt Session 1, gate "as recommended"), commit owed:** migration 514 records each request
  (dev; prod before the promote); privacy@ and every active owner; one shared window (/legal v0.2 + its 2026-11-20
  addendum) used by Plan & billing (Premium, Tournament, Tournament Plus) and the club's Settings card; staff close it on
  the organization's platform-admin page; Premium's plan card one column (A7). Privacy Policy §9 clause now due.
- [ ] Unit tests for who sees each door (owner; Q3's answer for others) and that a club's Settings page is unchanged.
- [ ] `check:layout --changed` on the touched screens; `npm run verify:changed`.
- [ ] `/review`; `/docs` for the tournament help (rename and closing the account are customer flows).
- [ ] The words in "Words for /marketing" settled in one `/marketing` pass before the walk.

### Stage 4 — The walk and the close

- [ ] One walk (`/tasks`): a Tournament-plan owner renames the organization and sends a deletion request; a Tournament Plus
  owner the same; a non-owner per Q3; a club's Settings page untouched. May ride the sister plan's step 4 walk if they land
  together.
- [ ] The owner's word closes it; plan and brief move to `docs/projects/archive/`.

## Plan gating

Tournament and Tournament Plus only — every other plan already has both doors (a club or league on the Organization's
Settings page; a Premium Coaches Portal through the sister plan's step 2). Nothing about it is a paid feature; no
`/billing` or `/strategy` call is needed.

## Architectural decisions

- **Decision:** reuse the existing name save and the existing deletion route; add doors, not routes. **Rationale:** both
  routes already serve every plan and are owner-guarded; a second route would be two homes for one action.
- **Decision:** one drawing and one `/legal` review with the sister plan. **Rationale:** the owner's call 4 ("drawn together
  with step 2") — the two workspaces should end on matching settings.

## Words for /marketing

- [ ] (none yet — written during the build; the deletion window's words also go through `/legal`, Stage 2)

## Open questions

- [ ] Q1–Q4 above, for the drawing.
- [ ] The `/legal` questions in Stage 2.
