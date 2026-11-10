import PdfSettingsPage from '../../../org/settings/pdf/page';
import { tournamentSideOnly } from '../club-home';

/** Settings & access › PDF settings on a Tournament plan (E3); a club's is its Organization tab (P2: no tournament override). */
export default tournamentSideOnly(PdfSettingsPage, 'org/settings/pdf');
