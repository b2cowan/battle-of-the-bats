import type { Metadata } from 'next';
import { PremiumWelcome } from '@/components/consumer/CoachWelcomeCard';
import { workspaceHoldsFoundingComp } from '@/lib/founding-season';
import { isFoundingSeasonActive } from '@/lib/plan-config';
import { safeNextPath } from '@/lib/safe-redirect';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isTeamWorkspaceOrgRow } from '@/lib/team-org-links';

export const metadata: Metadata = {
  title: "You're in — Premium Coaches Portal — FieldLogicHQ",
  robots: { index: false },
};

/**
 * The Premium welcome (The first look, Stage 3b — F17, G1, 2026-10-20). Reached from the sign-up flow's client-side
 * redirect after a $0 comp workspace is provisioned; checkout complete shows the same card when a paid portal is ready.
 * `next` is the portal URL the provision returned; `team` is the just-created team name (display only).
 *
 * The dates sentence is read from the WORKSPACE `next` names, server-side — never from the calendar (a coach who
 * qualifies after the sign-up window closes still holds the comp) and never from a URL flag. Fails closed: no
 * workspace, no comp row, or a read error is no dates sentence.
 */
export default async function CoachesWelcomePage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; team?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const team = (sp.team ?? '').trim().slice(0, 80);
  // Open-redirect guard (CWE-601): resolve `next` with real URL semantics and require same-origin.
  // A hand-rolled startsWith('/') check is bypassable via backslash/tab smuggling (/\evil.com); the
  // signup redirect passes `next` as a RELATIVE path, so a valid destination survives and anything
  // else (absolute, protocol-relative, smuggled) falls back to the coaches hub.
  const next = safeNextPath((sp.next ?? '').trim(), '/coaches');

  return <PremiumWelcome team={team} href={next} foundingComp={await portalHoldsFoundingComp(next)} />;
}

/** Does the coach workspace a portal path names (`/{slug}/coaches…`) hold the Founding comp? */
async function portalHoldsFoundingComp(portalPath: string): Promise<boolean> {
  const slug = /^\/([a-z0-9-]+)\/coaches(?:[/?#]|$)/i.exec(portalPath)?.[1];
  if (!slug || !isFoundingSeasonActive()) return false;
  try {
    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select('id, account_kind, plan_id')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !org || !isTeamWorkspaceOrgRow(org)) return false;
    return await workspaceHoldsFoundingComp(org.id as string);
  } catch (err) {
    console.error('[coaches welcome] comp read failed:', err);
    return false;
  }
}
