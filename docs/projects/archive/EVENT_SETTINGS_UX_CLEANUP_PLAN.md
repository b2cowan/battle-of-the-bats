# Event Settings UX Cleanup — Implementation Plan

**Branch:** `dev` (single shared branch). **Surface:** `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` (the Event Settings card wall). **Origin:** owner UX review 2026-06-16 of the Live Demo Event Settings page.

**Scope decision (owner 2026-06-16):** do **both** A (copy) and B (restructure); fix Pause-all by **flipping to a positive On/Off** ("Automatic coach emails: On" = sending).

## Problem
The "Notifications & Contact" card is a junk drawer holding five unrelated jobs (public contact + visibility, registration alert routing, 6 automatic-email toggles + a master switch, Score Finalization, Post-Event Results). The title doesn't predict the contents; Score Finalization is a scoring rule with no relation to notifications; the "Pause all … On" master switch is a double-negative (On = everything off). "Fee Schedule" undersells a card that also holds payment instructions + where-they-appear controls.

## A — Copy / label (zero data risk)
1. **Rename card** "Fee Schedule" → **"Fees & Payments"** (matches the registrations money strip + payment reminder language). Update the `sectionId`? No — keep `sectionId="fees"` so existing `?card=fees` anchors and the dashboard checklist links keep working. Title text only.
2. **Trim verbose body paragraphs** across the contact/email sub-sections — label + control carries the meaning; cut intros to one line.
3. **Fix the master email switch** — see B-3 (it's coupled to the restructure).

## B — Restructure (presentational only; no save-payload / API / DB change)
The save handler posts all fields as flat React state regardless of where the JSX renders (verified: `contactShowOnPublic`, `notifyMode`, `coachEmailPauseAll`, `scorePolicyMode` etc. are independent state; `score_finalization` saves via its own endpoint). So B is moving JSX blocks + updating collapsed-summary strings.

1. **Split "Notifications & Contact" into two cards:**
   - **Contact** (`sectionId="contact"`, keep id) — Public Contact (member + the 2 visibility toggles) + Registration Alert Routing. Theme: "who hears about this / how people reach me."
   - **Coach Emails** (new `sectionId="coach-emails"`) — the 6 automatic-email toggles + master switch (renamed) + Post-Event Results (it's an email too). Theme: "what the system auto-sends."
2. **Move Score Finalization** out of this card into **Schedule Rules** (it's a results-management rule; the code comment already notes it was homeless). Insert before the Schedule Rules card's closing tag, after tie-breakers. Update `scheduleRulesSummary` only if it reads cleanly (likely leave as-is).
3. **Flip the master email switch to positive.** Persisted value stays `coach_email_pause_all` (true = paused) — NO migration. UI only: render a switch labelled **"Automatic coach emails"** with **On / Off**, bound to `!coachEmailPauseAll` (On → `setCoachEmailPauseAll(false)`). Place it at the TOP of the email list. When Off, the 6 toggles dim (existing behavior) with the line "All automatic emails are off — turn this on to resume." Drop the word "Pause."
4. **Update collapsed summaries** (`meta`):
   - Contact card: `${notifyMode==='all'?'All registrations':'Assigned only'} · ${contact public|hidden}`.
   - New Coach Emails card: `coachEmailPauseAll ? 'Auto emails off' : 'Auto emails on'` (+ optionally count of off toggles).

## Verify
- `npm run lint:focused -- app/[orgSlug]/admin/tournaments/settings/event/page.tsx`
- `npm run typecheck` (page imports shared types; no shared-module edit, but run to be safe).
- Page-only change → dev server hot-reloads (no restart needed; no new files / shared modules / routes).
- Browser (owner): each card opens to its new scoped content; collapsed summaries read right; toggling "Automatic coach emails" Off dims the list and reads correctly; Score Finalization now lives under Schedule Rules and still saves; Save persists all values unchanged.

## Out of scope / guards
- No change to what any setting *does*, only where it lives + how it's labelled. Same save payload, same endpoints, no migration.
- Keep `sectionId="fees"` and `sectionId="contact"` so existing deep-links/anchors survive; only the new Coach Emails card gets a fresh id.
