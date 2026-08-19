import { insightsLegacyRedirectPage } from '@/lib/coach-insights-legacy-redirect';

/**
 * Legacy standalone route — permanent redirect into the Insights portal's Attendance tab.
 *
 * ⚠ **THE ONLY ONE OF THE SIX THAT WAS NEVER UNDER `/history`.** Attendance has been a report with
 * exactly one parent — the Insights hub — since it left both navs on 2026-08-15, but it kept a
 * top-level address. Its panel therefore moved INTO `history/attendance/` with the other five, and
 * this file is what keeps every saved link, every emailed link and the Schedule's own button
 * landing on the tab rather than on a 404.
 *
 * ⚠ Deleting this file makes the report unreachable from three places at once (the Schedule
 * button, the Overview coaching-pair tile, and any bookmark) — the same "single inbound link"
 * fragility `tests/unit/coach-attendance-home.test.ts` has always existed to pin.
 */
export default insightsLegacyRedirectPage('attendance');
