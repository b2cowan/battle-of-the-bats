import SettingsAccessDoor from './SettingsAccessDoor';
import { tournamentSideOnly } from './club-home';

/** Settings & access: a Tournament plan's door to its first tab (E3); a club's settings live in its Organization (P2). */
export default tournamentSideOnly(SettingsAccessDoor, 'org');
