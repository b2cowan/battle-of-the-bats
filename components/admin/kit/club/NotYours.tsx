'use client';
import { useOrg } from '@/lib/org-context';
import { memberHome } from '@/lib/member-home';
import { boardOwnerName } from '@/lib/board-people';
import { useBoardPeople } from '@/lib/use-board-people';
import type { NotYoursPage } from '@/lib/not-yours-words';
import { NotYoursScreen } from './NotYoursScreen';
import { useInPlaceFrame } from './PlaceFrame';

/**
 * The "not yours" screen on a client page (⚖ Ask 6 = A). The page returns this IN PLACE of its own content (never under
 * its own header): the screen names the page itself. The door home is the landing the person's role resolves to.
 */
export function NotYours({ page, title }: { page: NotYoursPage; title?: string }) {
  const { currentOrg, userRole } = useOrg();
  const people = useBoardPeople();
  // Under a place the pinned bar holds the page's `<h1>` (Admin header bar Phase 2): a tab this person cannot open (a
  // season's Email families off the desk) says so under it, as a second-level heading.
  const inPlace = useInPlaceFrame();
  return (
    <NotYoursScreen
      inPlace={inPlace}
      page={page}
      title={title}
      ownerName={boardOwnerName(people)}
      viewerRole={userRole}
      home={currentOrg ? memberHome(currentOrg.slug, userRole, currentOrg, page) : null}
    />
  );
}
