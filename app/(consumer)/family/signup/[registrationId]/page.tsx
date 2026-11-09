import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { familySignupFor, readFamilyHome } from '@/lib/family-home';
import { getOrgForGate } from '@/lib/family-access';
import { openSignupLink } from '@/lib/league-signup-link';
import { buildSignupStatus } from '@/lib/league-signup-status';
import { buildLeaguePayView } from '@/lib/league-pay-view';
import { getClubSiteContent } from '@/lib/club-page-meta';
import { getLeagueSeasonById, getOrganizationBySlug } from '@/lib/db';
import { clubColourRoles, hexChannels } from '@/lib/club-colour-roles';
import { clubFace } from '@/lib/club-site';
import { maskEmail } from '@/lib/utils';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import { FAMILY_HOME_PATH } from '@/lib/family-invitation-panel';
import { FAMILY_HOME_WORDS as W } from '@/lib/family-home-words';
import YourSignup from '@/app/[orgSlug]/league/[seasonSlug]/status/YourSignup';
import PublicPage from '@/components/public/PublicPage';
import frame from '@/components/public/ClubFrame.module.css';
import kit from '@/components/public/ClubKit.module.css';

/**
 * /family/signup/[registrationId] — "Your sign-up" INSIDE the signed-in app (Signed-in family accounts Stage 4a, Part 6.5;
 * drawing 4.2). THE SAME PAGE AND COMPONENT as the emailed one (`YourSignup`): paying, the receipt field and Ask to withdraw
 * behave identically. Two lines differ: the back link goes to the team (or the family list), and "Anyone with this link…"
 * becomes "You're seeing this because you're signed in as {child}'s parent." No club band (it is inside the app); the club's
 * own colours and type are kept so the page reads the same.
 *
 * ⚠ FOUND BY WHO IS SIGNED IN, NOT BY THE LINK: the account must hold a live connection to a child on the sign-up through an
 *   address that is ON the sign-up (lib/family-home.ts `familySignupFor`). The page then rebuilds the sign-up's CURRENT signed
 *   link on the server for the component's actions, so the club's "Send a new link" (Stage 1) never signs anyone out of this.
 * ⚠ 404 while the guardian tier is off, and for a sign-up this account may not open.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: SW.title,
  robots: { index: false, follow: false },
};

export default async function FamilySignupPage({ params }: { params: Promise<{ registrationId: string }> }) {
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const { registrationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const mine = await familySignupFor(user.id, registrationId);
  if (!mine) notFound();
  const link = await openSignupLink(mine.token);
  if (!link.ok) notFound();

  const gate = await getOrgForGate(mine.row.orgId);
  const [org, season, siteContent, home] = await Promise.all([
    gate ? getOrganizationBySlug(gate.slug) : Promise.resolve(null),
    getLeagueSeasonById(link.seasonId, mine.row.orgId),
    getClubSiteContent(mine.row.orgId),
    readFamilyHome(user.id),
  ]);
  if (!org || !season) notFound();
  const contactEmail = siteContent?.contactEmail ?? null;
  const [found, pay] = await Promise.all([
    buildSignupStatus(season, org.name, link.rows),
    buildLeaguePayView(link.registrationId, contactEmail),
  ]);

  // Back to the team (one team for these children), or to the family list.
  const teams = home.teams.filter(t => t.childIds.some(id => mine.row.childIds.includes(id)));
  const back = teams.length === 1 && home.teams.length === 1
    ? { href: teams[0].href, label: teams[0].teamName }
    : { href: FAMILY_HOME_PATH, label: W.family.title };

  // The club's colours and type on the club's own token set, without its bar (the org layout's variables, for this one page).
  const roles = clubColourRoles(org.themePreset, org.themePrimary, org.themeAccent);
  const vars = {
    '--club-fill': roles.fill, '--club-fill-rgb': hexChannels(roles.fill), '--club-on-fill': roles.onFill,
    '--club-ink': roles.ink, '--club-ink-rgb': hexChannels(roles.ink), '--club-edge': roles.edge,
    '--club-accent': roles.accent, '--club-mark': roles.mark, '--club-tile': roles.tile, '--club-tile-ink': roles.tileInk,
  } as React.CSSProperties;

  return (
    <div className={frame.tokens} data-club-face={clubFace(org.themeFont)} style={{ ...vars, background: 'var(--club-ground)', minHeight: '100dvh' }}>
      <PublicPage frame="club" width="form">
        <div>
          <Link href={back.href} className={kit.back}>{W.inApp.back(back.label)}</Link>
          <h1 className={kit.pageName}>{SW.title}</h1>
          <p className={kit.sub} style={{ marginTop: '0.35rem' }}>{season.name}</p>
        </div>
        <YourSignup
          orgSlug={org.slug}
          seasonSlug={season.slug}
          contactEmail={contactEmail}
          found={{ ...found, pay }}
          token={mine.token}
          emailShown={link.rows[0]?.guardian_email ? maskEmail(link.rows[0].guardian_email) : null}
          footLine={W.inApp.seeing(mine.children)}
        />
      </PublicPage>
    </div>
  );
}
