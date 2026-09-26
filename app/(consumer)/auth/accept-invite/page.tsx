import { getOrganizationBySlug } from '@/lib/db';
import { roleLabel } from '@/lib/member-access';
import AcceptInviteForm from './AcceptInviteForm';
import styles from '../auth.module.css';

export const dynamic = 'force-dynamic';

/**
 * The invitee's accept page (Stage 1 specimen 6). A server shell around the form so the FIRST frame
 * is already right (J10-010): the club's name is read here from the club named in the link (public
 * information — a hand-edited link cannot rename a club), and the role and inviter the link carries
 * paint the title until the form confirms both from the server once the session lands. Before
 * this the page titled itself "Accept Invitation" until a background request answered, so a
 * scorekeeper saw the admin wording first.
 *
 * Older links (sent before 2026-09-25) carry only `?org=`; the page then leads with the club alone.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string | string[]; role?: string | string[]; inviter?: string | string[] }>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const linkOrgSlug = one(sp.org);
  const linkRole = one(sp.role);
  const linkInviter = one(sp.inviter)?.slice(0, 80) ?? null;
  const org = linkOrgSlug ? await getOrganizationBySlug(linkOrgSlug).catch(() => null) : null;

  return (
    <div className={styles.page}>
      <AcceptInviteForm
        linkOrgSlug={linkOrgSlug}
        linkOrgName={org?.name ?? null}
        linkRoleLabel={linkRole ? roleLabel(linkRole) : null}
        linkInviter={linkInviter}
      />
    </div>
  );
}
