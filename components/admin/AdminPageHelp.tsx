'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { PageHelpDoor, usePageHelpPublisher, usePublishPageHelp, usePublishedPageHelp } from '@/components/help/PageHelpChannel';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { adminPageTopicAt, helpRequestFor, type PageHelpTopic } from '@/lib/admin-page-help';
import { useClubPlaceAt } from './AdminBarPlace';

/**
 * ⚖ THE ADMIN'S PAGE "?" (navigation Phase 6b, T1–T6, owner 2026-11-13): drawn by the chrome at both widths — the top strip
 * between the bell and the account button (`AdminTopStrip`), the phone bar's last control (`AdminEventHeader`) — never by a page.
 * What it opens: the topic a page handed up (`useHandPageHelp`, the dashboard's board), else the address's answer
 * (`adminPageTopicAt`, the one table), else nothing — no topic, no "?". Never on a cancelled account's one page (its help would
 * bounce to billing). Its own component, so a page handing its topic up re-renders the two doors and not the chrome around them.
 */
function useAdminPageHelp(suspended: boolean): HelpRequest | null {
  const pathname = usePathname();
  const { currentOrg, canOpen } = useOrg();
  const { currentTournament } = useTournament();
  const place = useClubPlaceAt();
  const published = usePublishedPageHelp();
  if (suspended || !currentOrg) return null;
  if (published) return published;
  const base = `/${currentOrg.slug}/admin`;
  // The club's Overview has no place of its own; a tournament-only workspace has no Overview.
  const onOverview = !isTournamentOnlyWorkspace(currentOrg) && pathname.replace(/\/+$/, '') === base;
  // The chosen event is on the server's first paint for a tournament page (navigation Phase 0), so this agrees on both sides.
  const topic = adminPageTopicAt(pathname, base, place, onOverview, { opens: canOpen('module_tournaments'), hasEvent: !!currentTournament?.id });
  return topic ? helpRequestFor(topic, base) : null;
}

/** One end's "?": the strip's or the phone bar's, in that end's own wrapper. */
export function AdminPageHelpDoor({ suspended, className, spacerClassName }: { suspended: boolean; className: string; spacerClassName: string }) {
  return <PageHelpDoor help={useAdminPageHelp(suspended)} className={className} spacerClassName={spacerClassName} />;
}

/**
 * A PAGE THAT PICKS ITS OWN TOPIC HANDS IT TO THE CHROME: the dashboard's board, by the event's stage. The doors draw that one while
 * the page is mounted; it is withdrawn on the way out, and only if it is still this page's (`PageHelpChannel`'s id-guarded clear),
 * so a route change never leaves a stale "?". ⚠ Call it unconditionally (pass `null` while the page does not know yet).
 */
export function useHandPageHelp(topic: PageHelpTopic | null) {
  const { currentOrg } = useOrg();
  usePublishPageHelp(usePageHelpPublisher(), topic && currentOrg ? helpRequestFor(topic, `/${currentOrg.slug}/admin`) : null);
}
