'use client';
import { useParams } from 'next/navigation';
import ScheduleContent from '@/components/public/ScheduleContent';

/**
 * `frameOn` is the preview switch, decided by the server page. Stage 3 Part 2 renders the new body here when it is on; until
 * that body exists both answers read today's Schedule, and with it off that stays so until Stage 8.
 */
export default function SchedulePage(_props: { frameOn: boolean }) {
  const { orgSlug, tournamentSlug } = useParams();
  return (
    <ScheduleContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
