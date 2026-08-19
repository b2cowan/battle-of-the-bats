import { insightsLegacyRedirectPage } from '@/lib/coach-insights-legacy-redirect';

// Legacy standalone route — permanent redirect into the Insights portal's tab (see the factory's
// doc). The panel itself lives in ./panel, imported by the hub.
// ⚠ The FOLDER is 'opponents' and the TAB is 'scouting' — the owner renamed the report to
// "Scouting Book" while its drill-in book kept this route (`history/opponents/[opponentKey]`).
// The mapping's one home is `legacyInsightsSection` in lib/coach-insights-links.ts.
export default insightsLegacyRedirectPage('opponents');
