'use client';

/**
 * components/coaches/CoachTeamAutoFollow.tsx — makes an accepted coach a RECIPIENT.
 *
 * Renders nothing. It exists to seed the coach's follow of their own team, which is what
 * puts them on the list for schedule-change alerts (B2.3) and the public-schedule highlight.
 *
 * WHY IT IS ITS OWN COMPONENT (B2.2, decision ◆V1). This seeding used to live inside
 * CoachLiveSchedule behind an `if (!live) return` guard, which tied "am I a recipient?" to
 * "is the live schedule currently on screen?". Those are different questions, and conflating
 * them produced a real hole: a coach only became reachable once their event went LIVE, while
 * organizers do most of their rearranging in the days BEFORE. A schedule-change alert sent in
 * that window reached the families who had followed the team deliberately — and not the coach.
 *
 * Mounted on any ACCEPTED registration record, so the coach becomes reachable when their team
 * is in, not when the first ball is thrown.
 *
 * Deliberately unchanged from the original: seeded ONCE per device+tournament (localStorage
 * flag), reading the follow store directly because the hook's state has not hydrated on the
 * first effect pass; never overrides an existing highlight; never re-pins after the coach
 * deliberately un-stars on the public site. Turning it off afterwards is one tap, on the public
 * site or in Account → Notifications.
 */

import { useEffect } from 'react';
import { readFollowedTeamId, useFollowedTeam } from '@/lib/follow';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  teamId: string;
  teamName: string;
  teamDivisionId?: string | null;
  /** Gate: only an accepted team is followed. A pending or rejected entry never seeds. */
  enabled: boolean;
}

export default function CoachTeamAutoFollow({
  orgSlug, tournamentSlug, teamId, teamName, teamDivisionId, enabled,
}: Props) {
  const { follow } = useFollowedTeam(orgSlug, tournamentSlug);

  useEffect(() => {
    if (!enabled || !orgSlug || !tournamentSlug || !teamId) return;
    let seedKey: string;
    try {
      // Same key the live-schedule seeding used, so a coach who was already auto-followed
      // under the old behaviour is not re-seeded (and a deliberate un-star still sticks).
      seedKey = `fl-coach-autopin:${orgSlug}/${tournamentSlug}`;
      if (window.localStorage.getItem(seedKey)) return;
      if (readFollowedTeamId(orgSlug, tournamentSlug)) return;
    } catch {
      return; // storage unavailable → no seeding
    }
    follow({ id: teamId, name: teamName, divisionId: teamDivisionId ?? '' });
    try {
      window.localStorage.setItem(seedKey, '1');
    } catch { /* highlight still applied for this visit */ }
  }, [enabled, orgSlug, tournamentSlug, teamId, teamName, teamDivisionId, follow]);

  return null;
}
