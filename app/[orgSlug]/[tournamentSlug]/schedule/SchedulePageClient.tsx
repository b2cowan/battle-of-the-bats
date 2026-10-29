'use client';
import { useParams } from 'next/navigation';
import ScheduleContent from '@/components/public/ScheduleContent';
import PublicSchedule from '@/components/public/PublicSchedule';

/**
 * `frameOn` is decided by the server. The new Schedule is preview-only until Stage 8.
 */
export default function SchedulePage({ frameOn }: { frameOn: boolean }) {
  const { orgSlug, tournamentSlug } = useParams();
  if (frameOn) return <PublicSchedule orgSlug={orgSlug as string} tournamentSlug={tournamentSlug as string} />;
  return (
    <ScheduleContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
