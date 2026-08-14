import { moneyLegacyRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route — permanent redirect into the Money hub's tab (see the factory's doc).
// ⚠ ./[fundraiserId] is NOT legacy: a single fundraiser's detail screen has no hub tab and stays
// a real page. The list panel lives in ./panel, imported by the hub.
export default moneyLegacyRedirectPage('fundraisers');
