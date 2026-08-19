import { insightsLegacyRedirectPage } from '@/lib/coach-insights-legacy-redirect';

// Legacy standalone route — permanent redirect into the Insights portal's tab (see the factory's
// doc). The panel itself lives in ./panel, imported by the hub.
export default insightsLegacyRedirectPage('development');
