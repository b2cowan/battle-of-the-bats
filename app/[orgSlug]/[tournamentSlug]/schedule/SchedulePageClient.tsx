'use client';
import { useParams } from 'next/navigation';
import ScheduleContent from '@/components/public/ScheduleContent';

export default function SchedulePage() {
  const { orgSlug, tournamentSlug } = useParams();
  return (
    <ScheduleContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
