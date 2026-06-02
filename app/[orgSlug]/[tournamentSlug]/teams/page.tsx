'use client';
import { useParams } from 'next/navigation';
import TeamsContent from '@/components/public/TeamsContent';

export default function TeamsPage() {
  const { orgSlug, tournamentSlug } = useParams();
  return (
    <TeamsContent
      orgSlug={orgSlug as string}
      tournamentSlug={tournamentSlug as string}
    />
  );
}
