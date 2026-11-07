'use client';
/**
 * THE BOARD — an Organization tab for someone without Members (⚖ Club Tier Stage 13i, owner 2026-11-06: "A 'The board'
 * tab"). The Organization hub's tile page retired (13i Ask 3), and with it the card 13a built for exactly these people (R1:
 * "the registrar sees who runs the board, names only"), so the card became this tab, in Members' place.
 *
 * ⚖ NAMES ONLY (13a, ALSO row R1): a person and their role, never an email or a phone number — the board read
 * (`GET /api/admin/board`) returns nothing else. Read-only: inviting and changing roles is Members', which is not theirs.
 */
import { useOrg } from '@/lib/org-context';
import { boardInRankOrder } from '@/lib/board-people';
import { ROLE_LABEL } from '@/lib/member-access';
import { useBoardPeople } from '@/lib/use-board-people';
import { usePageTitle } from '@/lib/usePageTitle';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import { ClubRow, ClubRowList, EmptyCard } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import LoadingState from '@/components/shared/LoadingState';
import { ORG_BOARD_TAB_LABEL } from '@/lib/admin-kit-nav';

export default function OrgBoardPage() {
  const { currentOrg } = useOrg();
  const people = useBoardPeople(!!currentOrg);
  usePageTitle(`${ORG_BOARD_TAB_LABEL} · Organization`);

  return (
    <div className={ck.pageWide}>
      <TabPageHeader eyebrow="Organization" title={ORG_BOARD_TAB_LABEL} />
      <p className={ck.lede}>Who runs {currentOrg?.name ?? 'the club'}: names and roles only. The owner and the admins invite people and change their roles.</p>
      {people === null ? <LoadingState label="Loading the board…" />
        : people.length === 0 ? <EmptyCard title="There are no names to show.">The club’s owner and its admins run the club. If you expected to see people here, refresh the page.</EmptyCard>
        : (
          <ClubRowList label={ORG_BOARD_TAB_LABEL}>
            {boardInRankOrder(people).map((p, i) => <ClubRow key={`${p.role}-${i}`} title={p.name} caption={ROLE_LABEL[p.role] ?? p.role} />)}
          </ClubRowList>
        )}
    </div>
  );
}
