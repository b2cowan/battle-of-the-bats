'use client';
import { useOrg } from '@/lib/org-context';
import { memberHome } from '@/lib/member-home';
import { boardOwnerName } from '@/lib/board-people';
import { useBoardPeople } from '@/lib/use-board-people';
import type { NotYoursPage } from '@/lib/not-yours-words';
import { NotYoursScreen } from './NotYoursScreen';

/**
 * The "not yours" screen on a client page (⚖ Ask 6 = A). The page returns this IN PLACE of its own content (never under
 * its own header): the screen names the page itself. The door home is the landing the person's role resolves to.
 */
export function NotYours({ page, title }: { page: NotYoursPage; title?: string }) {
  const { currentOrg, userRole } = useOrg();
  const people = useBoardPeople();
  return (
    <NotYoursScreen
      page={page}
      title={title}
      ownerName={boardOwnerName(people)}
      viewerRole={userRole}
      home={currentOrg ? memberHome(currentOrg.slug, userRole, currentOrg, page) : null}
    />
  );
}
