# PM Brief — Rules & Resources UX Improvements

> **Status:** Planning  
> **Created:** 2026-05-24  
> **Full plan:** `RULES_PAGE_UX_IMPROVEMENTS_PLAN.md`

---

## What is this?

A focused improvement to the Rules & Resources admin page and its connected public page. Five problems identified during design review; all five have a clear fix.

---

## What changes for users

### 1. Platform-native confirmation dialogs
**Before:** Deleting a rule section, deleting a resource, or loading samples shows a browser popup — grey, system-styled, doesn't match the app.  
**After:** A styled in-app modal appears with a clear description of what will be deleted and a danger-coloured confirm button.  
**Who benefits:** Every org admin who manages rules content.

### 2. Click-to-create section cards
**Before:** Admins must type a section title into a small input field, then click "Add Section." Clicking the button without typing first produces a silent error.  
**After:** Clicking "+ Add Section" immediately creates a blank card at the bottom of the list with the title field auto-focused. The user types in context. Enter or the checkmark saves it; Escape removes it. Title is required before saving — no orphan untitled sections.  
**Who benefits:** All org admins building their rules for the first time.

### 3. "Browse Samples" replaces "Seed Default Data"
**Before:** A button labelled "Seed Default Data" — unclear engineering language. Clicking it overwrites all existing rules with a default set.  
**After:** A button labelled "Browse Samples" opens a side drawer showing curated sample rule sections and resources. Admins pick individual samples to add. Existing content is always preserved — nothing is removed or replaced.  
**Who benefits:** New org admins setting up their first tournament who want a starting point without risking their work.

### 4. Empty sections are suppressed on the public page
**Before:** If an admin adds rules but no resources, the public Rules page still shows a "Downloads & Resources" heading with nothing below it. If neither section has content, the public page shows a "Rules Coming Soon" placeholder card.  
**After:** Sections with no content simply don't render. If nothing has been published at all, the public page shows a clean "rules haven't been published yet" message instead of a fake placeholder card.  
**Who benefits:** Visitors (teams, coaches, parents) who see a polished page instead of structural artifacts.

---

## Why this matters

Rules and resources are one of the first things teams check when they receive a tournament invitation. An empty or broken-looking rules page erodes trust in the tournament before it starts. These improvements reduce the chances of an org accidentally publishing an incomplete page, and make it easier for new users to add meaningful content quickly.

---

## Priority

**Medium-high.** No new features are gated on this work, but it affects the quality of every tournament that uses the rules page. Phases 1–4 are low-risk and can ship quickly. Phase 5 (dashboard warning) requires a DB migration.

---

## Success criteria

- No org admin sees a browser `confirm()` popup anywhere in the Rules admin
- New admins can add their first rule section without discovering the empty-input error
- "Browse Samples" is used by at least 30% of new tournaments during their first rules session (measurable via analytics if added to sample-add handler)
- Zero public rules pages show the "Rules Coming Soon" placeholder after this ships
- Public rules page shows no placeholder "Coming Soon" cards — empty sections are cleanly absent
