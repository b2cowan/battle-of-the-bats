import { moneyLegacyRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route — permanent redirect into the Money hub's tab (see the factory's doc).
// The panel itself lives in ./panel, imported by the hub.
export default moneyLegacyRedirectPage('dues');
