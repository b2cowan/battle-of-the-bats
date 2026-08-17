import { moneyLegacyRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route → the Money hub's CLUB tab (money redesign P4, 2026-08-17). See the twin
// note on ../allocations/page.tsx — the two retired together, into one screen.
export default moneyLegacyRedirectPage('club');
