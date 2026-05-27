# Tournament Admin — Review Findings & Improvements

> **Audience:** Product / Business
> **Review scope:** All 20 tournament admin pages — free Tournament tier and Tournament Plus
> **Review date:** 2026-05-21 to 2026-05-22
> **Technical plan:** [TOURNAMENT_SECTION_REVIEW_PLAN.md](TOURNAMENT_SECTION_REVIEW_PLAN.md)

---

## What this review covered

We audited every page a tournament organizer sees when running an event — from the tournament list and dashboard through to the schedule, results, registration, communication, branding, and settings pages. The goal was to find design inconsistencies, UX friction points, and anything that was outright broken or confusing, then fix them in priority order.

The review covered both the **free Tournament tier** (every organizer) and **Tournament Plus** (paid upgrade). Where a finding affects only one tier, it's noted.

---

## Summary scorecard

| Category | Issues found | Fixed / Resolved | Deferred / Open |
|----------|-------------|-------|-----------------|
| Bugs (broken behaviour) | 6 | 5 | 1 (cosmetic, low priority) |
| UX friction (layout / workflow) | 11 | 11 | 0 |
| Design consistency | 2 | 2 | 0 |
| **Total** | **19** | **18** | **1** |

> **Phase E audit complete (2026-05-22):** All four supporting pages (Age Groups, Contacts, Announcements, Rules) already had the correct header/toolbar pattern. No code changes required.

> **Phase 2B verification (2026-05-22):** Registrations, Schedule, and Results passed focused UAT smoke checks. Desktop and 390x844 mobile screenshot checks returned HTTP 200 with no page-level horizontal overflow.

> **Phase 2C verification (2026-05-22):** Data-rich Free and Tournament Plus UAT tournaments passed the final core-admin matrix for Registrations, Schedule, and Results at desktop 1440px and mobile 390x844. Seeded content rendered, Results score modals opened, no duplicate pool labels appeared, no false loading/no-tournament states remained, no page-level horizontal overflow was found, and console/request-failure checks were clean.

> **Phase G code pass (2026-05-22):** Plus-gated and admin tournament API/client flows were hardened to pass the visited `orgSlug`, and Branding now uses compact locked controls for advanced Tournament Plus features instead of broad repeated upgrade framing. TypeScript, focused ESLint, whitespace checks, and the restarted dev-server login probe passed.

> **Phase F design pass (2026-05-22):** Tournament admin design token aliases were added globally, repeated card/border/radius patterns were normalized across the touched settings/supporting surfaces, and Archives empty states now use the structured icon/title/body pattern. TypeScript, focused ESLint, whitespace checks, and the restarted dev-server login probe passed.

> **Phase H responsive hardening pass (2026-05-22):** Supporting tournament admin pages now use labeled mobile-card rows for simple tables, better stacked header/actions, and improved modal/action touch sizing. TypeScript, focused ESLint, whitespace checks, and the restarted dev-server login probe passed; user browser sign-off remains pending.

---

## Findings — Bugs

### BUG-01 — Venues page labelled "Venues" but powered by the wrong-looking system
**What we thought:** The venues page appeared to be re-using an internal "Diamonds" management page, which would show confusing terminology to organizers who just want to manage playing fields.
**What we found on investigation:** The page already shows "Venue Locations" as its title and works correctly. The "diamonds" naming is internal code only — organizers never see it. No user-facing problem.
**Status: ✅ Investigated — not a bug. No change needed.**

---

### BUG-02 — "Staff & Access" settings page title says "Members"
**What an organizer sees:** When they navigate to Settings → Staff & Access from within tournament admin, the page they land on is titled "Members" with the description "Manage who has access to your organization." It functions correctly (they can invite and manage staff from here), but the heading doesn't match where they came from.
**Who it affects:** All tournament organizers who manage staff access.
**Proposed fix:** Update the page title to match the "Staff & Access" label used in the settings hub.
**Status: 🔶 Deferred — cosmetic, low priority. No functional impact.**

---

### BUG-03 — Free organizers couldn't easily find Public Pages visibility controls ✅ FIXED
**What an organizer sees (before):** On the Branding & Public Site settings page, the entire branding section (logo, colors, theme) showed an upgrade prompt for free-tier organizers. The controls for which pages appear on the public tournament site — a **free feature** — were buried below that upgrade prompt. An organizer who just wanted to hide the Registration page from their public site had to scroll past an upgrade prompt to find the toggle.
**Who it affects:** Free Tournament tier organizers only.
**The fix:** Moved the Public Pages visibility controls to the top of the Branding page so they're always the first thing an organizer sees, regardless of plan. The Plus-only branding controls (logo, colors, theme) follow below.
**Status: ✅ Fixed and deployed to dev.**

---

### BUG-04 — Multi-org owners were redirected to login ✅ FIXED
**What an organizer saw:** A user who belonged to more than one organization could authenticate successfully but still be sent back to the login page when opening an org admin route.
**Why it happened:** The auth context expected exactly one active organization membership. The UAT owner belongs to both the free Tournament org and the Tournament Plus org, which exposed the issue.
**The fix:** Route-aware layouts now resolve the membership for the visited org slug, and the shared auth helper no longer treats multiple active memberships as unauthenticated.
**Status: ✅ Fixed and verified with the UAT owner account.**

---

### BUG-05 — Multi-org owners could see the wrong tournament data ✅ FIXED
**What an organizer saw:** When the same owner belonged to the Free UAT org and the Tournament Plus UAT org, some client-side tournament admin pages could load the first membership's tournament data even while the browser URL showed the other org.
**Why it happened:** The client tournament context and several admin API fetches were not consistently passing the visited `orgSlug` and selected `tournamentId`.
**The fix:** Org context, tournament context, registrations, teams, games, divisions, venues, and pool-slot fetches now scope requests to the visited org/tournament.
**Status: ✅ Fixed and verified in Phase 2C Free/Plus desktop/mobile QA.**

---

### BUG-06 — Plus/admin actions could still resolve against the first org in some flows ✅ FIXED STRUCTURALLY
**What an organizer risked:** After the core Registrations, Schedule, and Results fixes, several supporting tournament admin and Plus-only API paths still depended on membership resolution that could fall back to the first organization for multi-org owners.
**Why it mattered:** A Tournament Plus owner should be approving, cloning, branding, exporting, publishing, and summarizing the tournament in the org shown in the URL, not whichever membership happened to resolve first.
**The fix:** Tournament admin API routes and client calls now pass and validate the visited `orgSlug` across branding, schedule publish, announcements, games, teams, registration fields, exports, reminders, summary, clone/populate, setup/seal/archive, venues, divisions, contacts, dashboard, activity, and PDF settings.
**Status: ✅ Fixed structurally and verified with TypeScript, focused ESLint, whitespace checks, and dev-server login probe. Browser journey sign-off remains in the final verification pass.**

---

## Findings — UX & Workflow

### UX-01 — Schedule page was too cluttered before the first game appeared ✅ FIXED
**What an organizer sees (before):** Opening the Schedule page showed a page title row, then a wide bar of controls including Round Robin/Playoffs toggle, an Auto-Generate button (or a lock icon for free users), a Publish All Divisions button, a Division dropdown, a publish status badge, and a Flat/Pools view toggle — all before a second row with a game count and a search box. On desktop, an organizer would see 3 rows of controls before the first game. On mobile, this stacked even taller.
**What an organizer sees (after):** One compact toolbar row. The Round Robin/Playoffs toggle, division selector, publish status, and grouping toggle stay visible. Auto-Generate, Playoff Wizard, and Publish All Divisions move into a "Tools" dropdown menu — available in one click but not consuming permanent screen space. Free users can still click "Tools → Auto-Generate" and see a clear upgrade prompt explaining what they need. The game list begins immediately below the toolbar.
**Who it affects:** All tournament organizers using the schedule. Most impactful for mobile.
**Status: ✅ Fixed and deployed to dev.**

---

### UX-02 — Tournament dashboard clutters setup guidance and live status together ✅ FIXED
**What an organizer sees (before):** The Dashboard page showed a clone callout, a launch checklist with 4 required items and 4 optional items, and then a separate "Setup quick links" section below — which linked to the exact same 4 destinations already in the checklist (Venues, Divisions, Contacts, Rules & Resources). Every destination appeared twice. For a new organizer on a small screen, the page could run to 10+ cards before any of the useful analytics appeared.
**What an organizer sees (after):** The launch checklist shows the 4 required items. Below them is a single compact "Optional setup — N of 4 complete" toggle. Clicking it expands venues, fee schedule, rules, and branding. The entire duplicate "Setup quick links" section below the checklist is gone. The Activate button is already at the top of the checklist header — no scrolling required to reach it.
**Who it affects:** All organizers setting up a new draft tournament.
**Status: ✅ Fixed and deployed to dev.**

---

### UX-03 — Branding page shows two separate upgrade prompts for Plus features ✅ FIXED
**What an organizer sees (before):** After the fix for BUG-03, free-tier organizers correctly saw Public Pages first, but the "Advanced" section below (hero banner, fonts, card style) was hidden behind a second full upgrade gate. Non-Plus users saw two separate "Upgrade to Tournament Plus" lock cards — one for the main branding block and one for the advanced block.
**What an organizer sees (after):** The second upgrade gate is removed. The "Advanced" section header is now always visible, followed by a single compact note explaining the features require Tournament Plus. The individual controls (hero banner upload, font selector, card style buttons) are shown in a locked/disabled state with "Locked" badges — so an organizer can see exactly what they'd unlock. The double-prompt experience is gone.
**Who it affects:** Free Tournament tier organizers.
**Status: ✅ Fixed and deployed to dev.**

---

### UX-04 — Results page shows score status explanation in the wrong place
**What an organizer sees (before):** Between the status filter chips ("To Be Scored / Pending Review / Completed") and the actual game list, there was a paragraph of text explaining what "Pending Review" and "Completed" mean. This paragraph pushed the game list further down and appeared even when no "Pending Review" scores existed.
**What an organizer sees (after):** A small "Score statuses" help button appears in the filter row. Clicking it opens a compact popover explaining each status with colour indicators. The explanation is available when needed but no longer permanently separates the filters from the game list.
**Who it affects:** All tournament organizers reviewing and finalizing scores.
**Status: ✅ Fixed and deployed to dev.**

---

### UX-05 — Communication page recipient filtering stacks when expanded (Plus) ✅ FIXED
**What an organizer sees (before):** The Communication Hub already collapsed recipient filters behind an "Edit Recipients" button. When a Plus organizer expanded the recipient editor, the targeting filters (Team Status, Payment Status, Divisions, Individual Teams, Contacts) stacked as a series of full-width filter panels. On narrower screens this became a long scroll before the message composer. The "Individual Teams" filter was especially wide. There was also no easy way to collapse the section after opening it without scrolling back to the top.
**What an organizer sees (after):** The filter cards sit in a responsive grid — narrow filters share the same row on wider screens, reducing vertical scroll. The "Individual Teams" card spans the full grid width on its own row (because its scrollable team list needs the space). A second "Done" button now appears at the bottom of the expanded recipient section so organizers don't need to scroll back up to collapse it after making selections.
**Who it affects:** Tournament Plus organizers using targeted messaging.
**Status: ✅ Fixed and deployed to dev.**

---

### UX-06 — Supporting pages (Age Groups, Contacts, Announcements, Rules) use inconsistent header patterns ✅ AUDITED — NO CHANGES NEEDED
**What we found:** All four pages were audited against the shared header pattern (icon + title/subtitle left; primary action button right). Every page already follows this structure:
- **Age Groups** — `styles.pageHeader` + icon/title + "Add Division" button; table immediately below.
- **Contacts** — same `admin-page.module.css`; correct header + "Add Contact" button; contextual callout then table.
- **Announcements** — own `announcements-admin.module.css`; correct header + "New Public Post" button; contextual delivery note then list.
- **Rules & Resources** — `admin-common.module.css`; correct header with BookOpen icon + "Save Changes" / "Seed" actions; content immediately below.
**Status: ✅ Audited — all four pages already match the correct pattern. No code changes made.**

---

### UX-07 — Tournament list page shows lifecycle education above the tournament table ✅ FIXED
**What an organizer sees (before):** The "Manage Tournaments" page had a full-width strip above the tournament table explaining the tournament lifecycle (Draft → Active → Completed → Archived) with the slot usage counter embedded inside it. This strip was always visible, taking up a card's worth of vertical space even for organizers who have been using the platform for months.
**What an organizer sees (after):** A small "How statuses work ▾" link sits right-aligned just above the table — collapsed by default, one click to expand. When expanded, the four status definitions appear in a compact single-row chip bar that dismisses on a second click. The slot usage count ("2 / 3 slots") moves to the page header as a small number next to the "New Tournament" button — always visible but taking no extra height. It turns amber when the limit is reached.
**Who it affects:** All organizers. Unlimited-plan orgs see no slot counter at all.
**Status: ✅ Fixed and deployed to dev.**

---

### UX-08 — Results page header action area had no primary CTA ✅ FIXED
**What an organizer saw (before):** The Results & Scoring page had an Export button in the top-right header area. Unlike the Schedule page (which has Export + Add Game), Results had only Export — leaving the header looking sparse. Export is a secondary action and works better in the toolbar.
**Who it affects:** All organizers reviewing results.
**The fix:** Results now uses the shared tournament admin header and toolbar. View mode, division, grouping, score-status filters, search, and Export all live in one compact toolbar, so the first game list sits closer to the top of the page.
**Status: ✅ Fixed and verified on desktop and 390px mobile smoke checks.**

---

### UX-09 — No selected tournament could look like a stuck loading state ✅ FIXED
**What an organizer saw:** Registrations and Results could keep showing a loading message when no tournament was selected. Schedule already handled this honestly with "No tournament selected."
**The fix:** Registrations and Results now clear their page state when there is no current tournament. Results shows the same clear empty-state message instead of spinning forever.
**Who it affects:** New or reset tournament admins before a current tournament is selected.
**Status: ✅ Fixed and verified in the Phase 2B mobile screenshot pass.**

---

### UX-10 — Pool labels could duplicate as "Pool Pool" ✅ FIXED
**What an organizer saw:** Seeded pools named with the word "Pool" could render headers such as "RED POOL POOL" on tournament admin lists.
**The fix:** Pool-name formatting now strips leading or trailing "Pool" before rendering the standard label, and schedule/registration headers no longer append an extra label.
**Status: ✅ Fixed and verified in Phase 2C data-rich QA.**

---

### UX-11 — Supporting admin pages relied on desktop table scanning on phones ✅ FIXED STRUCTURALLY
**What an organizer saw:** Pages like Manage Tournaments, Divisions, Contacts, and Archives used compact desktop tables. They worked, but on a phone the user had to scan across columns or rely on horizontal table behavior to understand the row.
**What an organizer sees after:** At mobile widths, those tables become labeled record cards. Key fields are readable vertically, actions become larger touch targets, and modals/buttons fit the viewport more predictably.
**Who it affects:** All tournament organizers on mobile, especially during setup and post-event archive work.
**Status: ✅ Fixed structurally in Phase H. Browser visual sign-off remains pending.**

---

## Findings — Design Consistency

### DESIGN-01 — Card background depth is inconsistent across settings pages ✅ FIXED
**What an organizer sees:** Across the various settings pages, some cards and panels appear at the wrong visual depth — they use a surface tone that makes them look either too flat or too raised relative to the page background. The effect is subtle but contributes to a less polished feel.
**Who it affects:** All organizers. Most visible in the Settings hub and Event Settings pages.
**The fix:** Added the missing global surface/border/text/radius token aliases that tournament CSS was already referencing, then normalized the repeated card, inset panel, separator, and empty-state patterns in Branding, Event Settings, Registration Questions, Communication, Rules, Schedule generator/bracket surfaces, and Archives.
**Status: ✅ Fixed as part of Phase F.**

---

### DESIGN-02 — Unused icon imports cleaned up in schedule page ✅ FIXED
**What an organizer sees:** Nothing visible — this was an internal code quality issue. After the schedule reformat, a few icon imports were no longer used.
**Status: ✅ Fixed as part of the schedule reformat.**

---

## What's next (planned phases)

The remaining open work is organized into clearly sequenced phases:

| Phase | Focus | Status |
|-------|-------|--------|
| **D1** | Dashboard | ✅ Complete |
| **D2** | Tournament list & Archives | ✅ Complete |
| **E** | Supporting pages (Age Groups, Contacts, Announcements, Rules) | ✅ Complete — all already correct, no changes needed |
| **F** | Design pass — card depth and visual hierarchy across settings | ✅ Complete |
| **G** | Plus tier polish — gate accuracy, upgrade CTAs, Post-Event Summary | ✅ Complete — code pass verified; browser sign-off remains in final handoff |
| **H** | Mobile verification at 390px on all primary operations pages | ◐ Code hardening complete — browser sign-off pending |

---

## Pages confirmed with no issues

The following pages were audited and found to be working correctly with no changes needed:

- **Venues** — correct title, correctly tournament-scoped
- **Registration Questions** — Plus gate correct; card order fixed (active questions now appear before the add form, with an "Add Question" anchor link in the header) ✅ Phase C5 complete
- **Post-Event Summary** — Plus gate and org-scoped summary wiring verified structurally; final browser sign-off queued for handoff
- **Event Settings** — correct behaviour; consistency pass queued as Phase E
- **Settings Hub** — all cards link correctly to the right sub-pages
- **Staff & Access**, **Organization Settings**, **Plan & Subscription** — all contextually appropriate within tournament admin
- **Archives** — correct behaviour; consistency pass queued as Phase D2
- **Age Groups**, **Announcements**, **Contacts**, **Rules** — correct behaviour; Phase E audit confirmed all four already follow the shared header/toolbar pattern ✅
