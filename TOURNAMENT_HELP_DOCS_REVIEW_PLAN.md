# Tournament Help Documentation Review and Upgrade Plan

Status: Proposed
Created: 2026-05-15
Scope: Tournament module help experience for org owners and tournament admins

## PM Brief

### Summary

Tournament help should move from a linear reference article to a quick-answer help surface. Admins should be able to open Help from any tournament page, search for the question they have, jump through a grouped table of contents, and scan common FAQs without reading the entire guide.

### Why It Matters

Tournament organizers are often working under time pressure: opening registration, correcting schedules, entering scores from the field, or closing out an event. A help page that only reads like a manual slows them down. The improved experience should answer "what do I do next?" and "what does this status/control mean?" within a few seconds.

### Customer Impact

- New tournament organizers get a clearer first-run path from draft setup to public launch.
- Returning admins can quickly resolve operational questions during live events.
- Owners understand plan and lifecycle concepts such as active tournament slots, archiving, and sealing.
- Support burden should drop for repeated questions about URLs, activation, registration status, scoring, schedules, and archive behavior.

### Target Users

- Owner: needs lifecycle, billing slot, public URL, archive, and sealing confidence.
- Admin: needs day-to-day workflow help for divisions, teams, schedule, scoring, communication, and public-facing setup.
- Official or scorekeeper: remains mostly out of scope for this help page, but the tournament help should explain what officials see and where score submissions land.

### Success Criteria

- A tournament admin can find a relevant answer from the help page in under 30 seconds.
- The page has grouped contents, search, and FAQs without requiring a backend search service.
- Help content maps to the actual tournament sidebar groups: Dashboard, Setup, Operations, Admin.
- FAQs cover at least the top questions for create, activate, registrations, scheduling, scoring, public URLs, archiving, and sealing.
- Existing module help pages can adopt the same structure later without rewriting the component from scratch.

## Current State Review

### What Exists Today

- `lib/help-content/tournaments.tsx` defines a simple tournament guide with six linear sections.
- `components/help/HelpPageLayout.tsx` renders title, role badge, intro, and sections only.
- `/{orgSlug}/admin/help/tournaments` renders the tournament help page through the shared layout.
- `/{orgSlug}/admin/help` has a role-aware module card hub.
- `components/admin/AdminSidebar.tsx` already sends tournament users to `/{orgSlug}/admin/help/tournaments`.
- The tournament admin module already has some contextual help callouts:
  - Schedule empty state
  - Results empty state
  - Seal warning in tournament management

### UX Gaps

- No table of contents, so users must scroll and visually parse the whole article.
- No search, so quick-answer use cases are weak.
- No FAQ section for the high-frequency questions admins are most likely to ask.
- No content grouping that mirrors the tournament admin navigation.
- The current page does not distinguish "setup before launch" from "live tournament operations" strongly enough.
- The content is accurate at a high level, but it does not cover several visible tournament surfaces:
  - Dashboard launch checklist
  - Venues
  - Contacts and public contact email
  - Announcements
  - Rules and resources
  - Division capacity, pools, and registration open/closed behavior
  - Communication
  - Fee schedule and payment status
  - Preview site
  - Active tournament slot limits
- Help opens in a new tab from the sidebar, which is fine for keeping work context, but the help page itself needs better orientation once opened.

## Recommended Help Information Architecture

### Page Structure

1. Search bar
   - Placeholder: "Search tournament help..."
   - Searches section headings, summaries, body text keywords, and FAQs.
   - Shows filtered groups and matching FAQs.
   - Empty result state suggests clearing the search or using the Help hub.

2. Quick answers
   - Compact FAQ-style links at the top for the most common questions:
     - How do I publish a draft tournament?
     - Why is activation blocked?
     - Where do teams register?
     - How do I add or change divisions?
     - How do I build a schedule?
     - How do officials submit scores?
     - When should I archive or seal?

3. Grouped table of contents
   - Group 1: Getting Started
   - Group 2: Setup
   - Group 3: Registration and Teams
   - Group 4: Schedule and Playoffs
   - Group 5: Scores and Results
   - Group 6: Communication and Public Site
   - Group 7: Closeout, Archives, and Plan Limits

4. Detailed guide sections
   - Keep scan-friendly sections with short summaries, step lists, and "Where to go" links.
   - Use stable anchors so search results and TOC links can jump directly to sections.

5. FAQ section
   - Question/answer rows grouped by topic.
   - Default to expanded for search matches and collapsed otherwise if an accordion is added.

### Proposed Tournament Content Groups

#### Getting Started

- What a tournament contains: divisions, registrations, teams, schedule, results, announcements, rules, and archive state.
- Recommended setup order:
  1. Create tournament draft.
  2. Confirm dates and URL.
  3. Add divisions and capacities.
  4. Add venues.
  5. Add public contact.
  6. Add rules/resources and welcome announcement.
  7. Preview site.
  8. Activate when ready.

#### Setup

- Creating and editing tournaments.
- URL slug guidance and link-breaking warning.
- Dashboard launch checklist.
- Divisions, capacities, pools, and registration open/closed behavior.
- Venues and custom game locations.
- Contacts and the public notification/contact email.
- Branding and tournament-specific public customization, if available in the current product phase.

#### Registration and Teams

- Public registration flow.
- Registration statuses: pending, accepted, waitlist, rejected.
- Accepted teams and schedule eligibility.
- Payment status basics: no schedule, pending, deposit paid, paid in full, past due.
- Exporting team lists.

#### Schedule and Playoffs

- Manual game creation.
- Auto-generate round robin.
- Pools versus flat schedule view.
- Playoff Wizard.
- Bracket view.
- Editing, cancelling, and restoring scheduled games.
- Exporting schedules.

#### Scores and Results

- Admin score entry.
- Official score submission.
- Pending review versus completed results.
- Score finalization behavior when enabled by the org.
- Reverting a score.
- Public results visibility.

#### Communication and Public Site

- Announcements.
- Rules and resources.
- Communication page.
- Preview Site button.
- Public schedule, standings, teams, rules, news, and registration pages.

#### Closeout, Archives, and Plan Limits

- Draft, active, completed, archived, and sealed statuses.
- Completed tournaments still consume a tournament slot.
- Archiving frees a tournament slot while preserving history.
- Sealing creates an immutable snapshot and cannot be undone.
- When to archive versus when to seal.

## FAQ Candidates

- How do I publish a tournament?
- Why can I not activate my tournament?
- What happens when I change the tournament URL slug?
- What is the difference between completed, archived, and sealed?
- Does a completed tournament still count against my plan limit?
- How do I free up a tournament slot?
- Where do teams register?
- Why is a team missing from the schedule builder?
- How do pools work?
- Can I collect different fees by division?
- Where do payment statuses come from?
- How do I generate a round-robin schedule?
- When should I use the Playoff Wizard?
- Can I edit a generated schedule?
- How do officials submit scores?
- What does Pending Review mean?
- Are results public immediately?
- Can I undo a score?
- How do I show rules or resources to teams?
- Which email address do teams see for tournament questions?

## Implementation Plan

### Phase 1 - Data Model and Shared Layout

- Update `lib/help-content/index.ts` to support optional section metadata:
  - `id`
  - `group`
  - `summary`
  - `keywords`
  - `href`
  - `faqs`
- Keep existing `heading` and `content` fields backward-compatible so current module pages continue to render.
- Convert `components/help/HelpPageLayout.tsx` to a client component only if needed for search state.
- Add an in-page search input that filters by heading, summary, keywords, rendered string content where practical, and FAQ text.
- Add grouped table of contents from section metadata.
- Add a FAQ renderer that can show all FAQs, grouped FAQs, or only matching search results.
- Add CSS to `components/help/help.module.css` for the search bar, TOC groups, result counts, section anchors, and FAQ rows.

### Phase 2 - Tournament Content Rewrite

- Rewrite `lib/help-content/tournaments.tsx` around the proposed content groups.
- Add stable section IDs that match user intent, such as:
  - `getting-started`
  - `launch-checklist`
  - `divisions-and-pools`
  - `registrations-and-teams`
  - `schedule-and-playoffs`
  - `scores-and-results`
  - `public-communication`
  - `archive-and-seal`
- Add "Where to go" links for major workflows:
  - `../tournaments/dashboard`
  - `../tournaments/manage`
  - `../tournaments/age-groups`
  - `../tournaments/venues`
  - `../tournaments/contacts`
  - `../tournaments/teams`
  - `../tournaments/schedule`
  - `../tournaments/results`
  - `../tournaments/communication`
  - `../tournaments/archives`
- Add FAQ entries to the tournament help data.
- Preserve current warnings around public URL slug changes and irreversible sealing.

### Phase 3 - Tournament-Specific Quick Answer Polish

- Add a compact "Popular questions" area on the tournament help page using tournament FAQ entries.
- Make search results expose direct section and FAQ matches.
- Consider highlighting matched FAQ rows when search is active.
- Ensure the page works well when opened in a new tab from the sidebar.
- Ensure mobile layout stacks in this order:
  1. Title and role badge
  2. Search
  3. Popular questions
  4. Grouped contents
  5. Matching sections
  6. FAQs

### Phase 4 - Contextual Help Alignment

- Review tournament admin pages for missing contextual cues after the page rewrite:
  - Dashboard: link launch checklist help from draft checklist.
  - Age Groups: explain capacity, pools, and user-selectable pool registration.
  - Contacts: explain public contact selection.
  - Teams: explain accepted teams and payment statuses.
  - Communication: explain audiences and send behavior.
  - Archives: explain archive versus seal.
- Prefer small `HelpTooltip` additions near ambiguous labels and `HelpCallout` only for empty states or irreversible decisions.

### Phase 5 - Verification

- Run lint/type checks used by the project.
- Manually verify:
  - Tournament help renders without hydration warnings.
  - Search filters sections and FAQs.
  - TOC anchor links scroll correctly.
  - Empty search state is clear.
  - Existing help pages still render with the enhanced layout.
  - Mobile layout remains readable.

## Open Product Questions

- Should help open in a new tab, as it does today, or should it stay in the admin shell for easier back navigation?
- Should the Help sidebar link eventually deep-link to context-specific anchors, for example schedule pages open `help/tournaments#schedule-and-playoffs`?
- Should FAQs be module-specific only, or should the Help hub eventually search across all enabled modules?
- Should public tournament visitors get a lightweight public FAQ, or should this remain admin-only for now?

## Recommended Next Step

Build Phases 1 and 2 together. They deliver the user-visible improvement for the tournament module while creating a reusable pattern for the later subscription/module phases.
