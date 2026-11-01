'use client';
import { useRef, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import ConfirmProvider from '@/components/coaches/ConfirmProvider';
import dynamic from 'next/dynamic';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { SUBSCRIBE_WORDS as W } from '@/lib/calendar-subscribe-words';
import kit from '@/components/public/ClubKit.module.css';
import styles from './CoachTeam.module.css';

// Loaded when a coach taps Subscribe, as the rep's Export button does: the window brings the portal's whole stylesheet with it.
const CoachCalendarSubscribe = dynamic(() => import('@/components/coaches/CoachCalendarSubscribe'), { ssr: false });

/**
 * THE HOUSE-LEAGUE COACH'S SUBSCRIBE (House League 9d-3 Part 6, ruling 9d3·5, frames b2–b5): a text "Subscribe" on the
 * Schedule heading's line at a desk, the mark alone on a phone (named "Subscribe in your calendar app") — never a toolbar,
 * no download. It opens the rep coach's window (`CoachCalendarSubscribe` over `CalendarSubscribeWindow`, the signed-off
 * words; Club Tier 6d) on this coach's own link (`…/team/{id}/calendar-link`): rebuilt on every open, the same link until
 * Reset. The one new sentence is What's in it (`whatsInLeagueCoach`). Reset asks first — this page has no portal around
 * it, so it brings the portal's question with it (ConfirmProvider); without it Reset would go unasked.
 */
export default function CoachSubscribe({ orgSlug, seasonSlug, teamId, teamName, divisionName }: {
  orgSlug: string; seasonSlug: string; teamId: string; teamName: string; divisionName: string;
}) {
  const [open, setOpen] = useState<null | 'phone' | 'desk'>(null);
  const isPhone = useIsPhone();
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <ConfirmProvider>
      <button
        ref={buttonRef}
        type="button"
        className={`${kit.btn} ${kit.btnSecondary} ${styles.subscribe}`}
        aria-label={W.coachButtonLabel}
        onClick={() => setOpen(isPhone ? 'phone' : 'desk')}
      >
        <CalendarPlus size={18} aria-hidden /> <span className={styles.subscribeLabel}>{W.coachButton}</span>
      </button>
      {open && (
        <CoachCalendarSubscribe
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={teamName}
          linkEndpoint={`/api/league/${encodeURIComponent(orgSlug)}/${encodeURIComponent(seasonSlug)}/team/${teamId}/calendar-link`}
          whatsIn={W.whatsInLeagueCoach(divisionName, open === 'phone')}
          phone={open === 'phone'}
          opener={buttonRef}
          onClose={() => setOpen(null)}
        />
      )}
    </ConfirmProvider>
  );
}
