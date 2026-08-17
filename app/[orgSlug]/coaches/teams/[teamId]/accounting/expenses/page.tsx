import { moneyLegacyExpensesRedirectPage } from '@/lib/coach-money-legacy-redirect';

// Legacy standalone route — permanent redirect into the Money hub (see the factory's doc).
// ⚠ It has TWO destinations since the Money split (2026-08-16): this screen became Transactions
// and Payables, so an incoming ?tab=payables|schedule crosses to Payables while everything else
// lands on Transactions. The panel itself lives in ./panel, imported by the hub.
export default moneyLegacyExpensesRedirectPage();
