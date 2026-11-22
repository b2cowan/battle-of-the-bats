import { forwardToOwnAddress } from '@/lib/club-forward';
import { cookies } from 'next/headers';
import { getOrganizationBySlug, getPublicTournamentBySlug, getRules, getResources, getDivisions } from '@/lib/db';
import { publicTournamentContactEmail } from '@/lib/public-frame-server';
import { notFound } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import type { Division, Resource, RuleSection } from '@/lib/types';
import PublicRules from '@/components/public/PublicRules';

export const dynamic = 'force-dynamic';

export default async function RulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const { view } = await searchParams;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/rules${view ? `?view=${encodeURIComponent(view)}` : ''}`);

  const cookieStore = await cookies();
  const prefName = cookieStore.get(`fl_agpref_${orgSlug}`)?.value ?? null;

  const org = await getOrganizationBySlug(orgSlug);
  const tournament = org ? await getPublicTournamentBySlug(org.id, tournamentSlug) : null;
  if (!tournament) notFound();

  // Honor the "show contact email publicly" toggle + resolve the designated
  // contact, instead of the raw fallback that bypassed both (J1-045).
  const contactEmail = await publicTournamentContactEmail(tournament.id, org?.contactEmail ?? null);
  const pageEnabled = isPublicPageEnabled(tournament, 'rules');

  let rules: RuleSection[] = [];
  let resources: Resource[] = [];
  let divisions: Division[] = [];
  if (pageEnabled) {
    [rules, resources, divisions] = await Promise.all([
      getRules(tournament.id, { admin: true, strict: true }),
      getResources(tournament.id, { admin: true, strict: true }),
      getDivisions(tournament.id, { admin: true, strict: true }),
    ]);
    // ⚠ Strict reads, as the printable copy's: a failed divisions read must not turn into "no divisions" (a held-back
    // division's section would then read as ordinary and show). A failed read throws to the platform's "Try again"
    // page (`app/error.tsx`, which `app/[orgSlug]/error.tsx` hands a tournament page to), never to a book that is
    // quietly wrong (owner ruling 2026-11-18).
    // ⚠ The FULL division list goes to the body. Its shape (`shapePublicRules`, shared with the printable copy) drops a
    // rule section aimed at a held-back division and names only published divisions in the picker; a list cut here
    // would let a held-back section through (Stage 10 Part 1, "as built").
  }

  // Public tournament pages Stage 8 Part 3a: the new body is the only body (the old RulesContent is gone).
  return <PublicRules
    orgSlug={orgSlug} tournamentSlug={tournamentSlug} pageEnabled={pageEnabled}
    rules={rules} resources={resources} divisions={divisions} prefName={prefName} view={view} contactEmail={contactEmail} />;
}
