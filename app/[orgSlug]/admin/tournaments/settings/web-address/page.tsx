import WebAddressTab from './WebAddressTab';
import { tournamentSideOnly } from '../club-home';

/** Settings & access › Web address on a Tournament plan (P1); a club's web address is in its organization's Settings (P2). */
export default tournamentSideOnly(WebAddressTab, 'org/settings');
