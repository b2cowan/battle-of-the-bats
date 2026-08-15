import { moneyLegacyFundraiserRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route — permanent redirect into the Fundraisers tab with this drive open
// (2026-08-14). A fundraiser was the LAST screen in Money reachable only by leaving the hub; the
// August sweep carved it out on the grounds that one fundraiser has no tab of its own, which was
// true and still left the portal one exception. It is now a sub-view of the tab (`?fundraiser=`),
// so bookmarks and emailed links land on the same drive with the hub around it.
export default moneyLegacyFundraiserRedirectPage();
