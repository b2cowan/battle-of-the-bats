import AuditLogPage from '../../../../org/members/audit/page';
import { tournamentSideOnly } from '../../club-home';

/** The audit log under Settings & access › Members on a Tournament plan; a club's is its Organization tab (P2). */
export default tournamentSideOnly(AuditLogPage, 'org/members/audit');
