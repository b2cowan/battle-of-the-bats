import PayoutsTab from './PayoutsTab';
import { tournamentSideOnly } from '../club-home';

/** Settings & access › Payouts on a Tournament plan (E3); a club keeps Payouts in its organization's Settings (P2). */
export default tournamentSideOnly(PayoutsTab, 'org/settings');
