import { moneyLegacyRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route — permanent redirect into the Money hub's tab (see the factory's doc).
// Deep-link params (?line, ?periods, ?starter, ?generate) survive the hop and still mean what
// they meant. The panel itself lives in ./panel, imported by the hub.
export default moneyLegacyRedirectPage('budget');
