'use client';
/**
 * A PLACE'S ADDRESS IS A DOOR, NOT A PAGE (Club Tier Stage 13i, A5; navigation Phase 2 Part B, E3): it goes to the FIRST tab the
 * person holds — a replace, so Back does not return here. One tab is that page with no tab row (13a's one-door rule); none is
 * the ONE "not yours" screen. A club's `/org` (Organization) and a Tournament plan's Settings & access read it.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { NotYours } from './NotYours';
import LoadingState from '@/components/shared/LoadingState';

export default function TabsDoor({ tabs, label }: { tabs: readonly { href: string }[] | null; label: string }) {
  const router = useRouter();
  const { currentOrg, userRole, loading } = useOrg();
  const ready = !loading && !!userRole && !!currentOrg;
  const first = ready ? tabs?.[0]?.href ?? null : null;

  useEffect(() => {
    if (first) router.replace(first);
  }, [first, router]);

  if (!ready || first) return <LoadingState label={label} />;
  return <NotYours page="organization" />;
}
