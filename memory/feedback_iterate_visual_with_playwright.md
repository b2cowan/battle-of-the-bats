---
name: feedback-iterate-visual-with-playwright
description: For visual/CSS fixes, drive the app in Playwright to measure + screenshot, then iterate — don't fix blind on user screenshots
metadata:
  type: feedback
---

For visual/layout/CSS bugs (alignment, button heights, spacing, responsive), do NOT make blind edits and ask the user to screenshot the result. Drive the running app yourself and measure.

**Why:** On the schedule-toolbar publish/alignment work (2026-06-15), several revisions failed because changes were eyeballed from user screenshots. The user called it out: "the fixes clearly aren't working, would be better if you could iterate as you go." A button-height mismatch (mobile Publish 32px vs Tools 24px) was invisible without measuring.

**How to apply:**
- The repo has a Playwright UAT harness: `tests/uat/`, config `playwright.config.ts` (project `uat`), saved sessions in `tests/uat/.auth/*.json` (org-owner etc., refreshed via `auth.setup.ts`). Dev server runs at `http://localhost:3000`.
- Write a throwaway spec (e.g. `tests/uat/_measure-*.spec.ts`) that: `test.use({ storageState: '.auth/org-owner.json' })`, sets `page.setViewportSize` (mobile 414px / desktop 1280px), navigates to the surface, drives the control (click Playoffs, etc.), then `page.evaluate` to dump `getBoundingClientRect().height` + computed styles for the relevant elements, and `page.screenshot` to `tests/uat/results/`.
- Run: `$env:UAT_BASE_URL="http://localhost:3000"; npx playwright test tests/uat/_measure-*.spec.ts --project=uat --reporter=line`
- Read the screenshot with the Read tool to see the actual render. Fix → re-run → confirm numbers. Then delete the temp spec + screenshots.
- Sessions may be stale; if auth fails, re-run the `auth-setup` project or the login helper in `auth.setup.ts`.

See [[design_decisions]] rev 5 (2026-06-15) for the measured before/after. Related: [[project_uat_agent]], [[feedback_restart_dev_server]].
