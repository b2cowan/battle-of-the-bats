import { moneyLegacyRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route → the Money hub's CLUB tab (money redesign P4, 2026-08-17).
// This route named a tab that no longer exists on its own: Allocations and Payments merged into one
// screen telling where the team stands with its club. The file survives so bookmarks and emailed
// links land on the merged tab rather than 404ing. The panel lives in ../club/panel.
export default moneyLegacyRedirectPage('club');
