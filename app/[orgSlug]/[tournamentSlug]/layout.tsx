import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/api-auth';
import { hasSupabaseSessionCookie } from '@/lib/supabase-server';
import { getOrganizationBySlug, getPublicTournamentBySlug, getDivisions, getTeams, getAnnouncements, getRules, getResources } from '@/lib/db';
import { tournamentFrameTabContent } from '@/lib/tournament-page-tabs';
import { hasPublicPlayoffGames } from '@/lib/public-games';
import { hasPlayoffPlan } from '@/lib/playoff-plan';
import { resolveOrgHomeHref } from '@/lib/module-entitlements';
import { getRegistrationState } from '@/lib/registration-state';
import { hasRoundRobin } from '@/lib/tournament-phase';
import { isPublicBracketVisible } from '@/lib/public-pages';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { tournamentToday } from '@/lib/timezone';
import { hasPlanFeature } from '@/lib/plan-features';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { showsFreeCredit } from '@/lib/plan-config';
import { hasOwnTournamentTheme, resolvePublicTournamentTheme } from '@/lib/public-tournament-theme';
import TournamentNavSync from '@/components/TournamentNavSync';
import PoweredByBadge from '@/components/marketing/PoweredByBadge';
import TournamentAcquisitionBanner from '@/components/marketing/TournamentAcquisitionBanner';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import MyTeamDock from '@/components/public/MyTeamDock';
import PublicAppOnly from '@/components/public/PublicAppOnly';
import NotOnFocusedPage from '@/components/public/NotOnFocusedPage';
import FollowDeepLinkPrompt from '@/components/public/FollowDeepLinkPrompt';
import AlertsNudge from '@/components/public/AlertsNudge';
import FollowAccountNudge from '@/components/public/FollowAccountNudge';
import AccountFollowSync from '@/components/public/AccountFollowSync';
import TournamentSideRail from '@/components/public/TournamentSideRail';
import TodaysResultsLine from '@/components/public/TodaysResultsLine';
import TournamentBand from '@/components/public/TournamentBand';
import TournamentFooter from '@/components/public/TournamentFooter';
import clubFrameStyles from '@/components/public/ClubFrame.module.css';
import frameStyles from '@/components/public/TournamentFrame.module.css';
import { publicTournamentContactEmail } from '@/lib/public-frame-server';
import { publicFrameAttr, publicFrameBand, publicFrameHost, publicFrameRoleCss } from '@/lib/public-frame';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, tournamentSlug } = await params;

  // Resolve social-share title/description; fall back gracefully.
  let ogTitle = 'Tournament';
  let ogDescription = 'Live scores, schedule and standings on FieldLogicHQ.';
  try {
    const org = await getOrganizationBySlug(orgSlug);
    if (org && org.subscriptionStatus !== 'canceled') {
      const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
      if (tournament) {
        ogTitle = tournament.name;
        ogDescription = `Live scores, schedule and standings · Hosted by ${org.name} on FieldLogicHQ.`;
      }
    }
  } catch {
    /* fall back to the generic label */
  }

  return {
    title: ogTitle,
    description: ogDescription,
    // The branded OG image is auto-wired from `opengraph-image.tsx` in this
    // segment (event card), overridden by nested routes (game score card, team card).
    openGraph: { title: ogTitle, description: ogDescription, type: 'website' },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription },
    // Unified-app identity (Phase 0): one FieldLogicHQ install, scope '/', so an
    // installed app captures this tournament's links. Per-event install icons are
    // retired (G1) — the home-screen label is the platform name for everyone.
    manifest: '/manifest.json',
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'FieldLogicHQ',
    },
  };
}

export default async function TournamentLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  if (org.subscriptionStatus === 'canceled') notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  // Every public tournament page wears the frame: the organizer's colour band on the club site's light ground (Public
  // tournament pages Stage 1; the switch-off chrome — the dark top bar, the score ticker, the old rail — went in Stage 8
  // Part 3d). This layout no longer reads the preview switch.
  // The free presentation (the badge and the banner): the free plan's and a Premium coach's event's (R6).
  const isFreeTournamentPlan = showsFreeCredit(org.planId);

  // Stage B.2 — the event chrome's conditional door UP to the org's public page (the band's
  // "Hosted by" door, the footer's host line and the desk rail's crumb), via the ONE shared resolver. That resolver owns
  // BOTH halves of the rule — the answer, and whether the head-count query is needed at all
  // (League/Club and non-public orgs are decided without it) — so this layout and the coaches
  // wall cannot drift apart the way the callers of the bare predicate did (audit D1).
  // Kicked off HERE and awaited at the bottom of the render, so any count overlaps the
  // banner/CTA queries below instead of adding a serial round trip to the highest-traffic
  // public layout. Same markup for every visitor: the condition is org-shaped, never
  // viewer-shaped, so the SW-cached anonymous HTML stays identical for everyone.
  // `.catch` at creation, not at the await: between the two the render issues other unguarded
  // queries, and if one of those throws first this promise is never awaited — an unhandled
  // rejection at the Node level rather than a React error. Failing to null just drops the door.
  const orgHomeHrefPromise = resolveOrgHomeHref(org).catch(() => null);
  // The frame's footer shows the address the Rules and News pages already show (the organizer's public-contact switch
  // decides it). Kicked off here and awaited with the host answer, for the same reason; failing to null drops the line.
  const frameContactPromise = publicTournamentContactEmail(tournament.id, org.contactEmail ?? null).catch(() => null);

  // Acquisition banner (free events only) — hidden from members of THIS org. Resolving a
  // Supabase session is the expensive part, so it only runs when (a) the plan is free —
  // paid tiers never render the banner at all — and (b) the visitor carries an auth cookie
  // (hasSupabaseSessionCookie — presence only, never an auth decision); the anonymous
  // majority pays a cookie read instead of an auth resolution on every render
  // (Nav Unification Stage A paper-cut #2; anonymous line in NAV_UNIFICATION_PLAN §5).
  let showAcquisitionBanner = false;
  if (isFreeTournamentPlan) {
    if (await hasSupabaseSessionCookie()) {
      const authCtx = await getAuthContext({ orgSlug }).catch(() => null);
      showAcquisitionBanner = !authCtx || authCtx.org.id !== org.id;
    } else {
      showAcquisitionBanner = true;
    }
  }
  // NB: the flip pill's viewer/hats are deliberately NOT resolved here — the service worker
  // offline-caches this page's HTML as anonymous content, so the pill fetches its identity
  // client-side via /api/public/tournament-viewer instead (see TournamentFlipPill /
  // lib/use-public-flip). Do not thread per-user data into this layout.
  // Free public tournament pages always use the FieldLogicHQ default theme, even if old branding
  // values exist. Nothing is emitted when the tournament has no theme of its own — the org
  // layout's vars then stand. (The rule itself lives in lib/public-tournament-theme.ts, shared
  // with the admin preview layout and the setup wizard's live preview.)
  let tournamentCssVars: string | null = null;
  if (hasOwnTournamentTheme(org, tournament)) {
    const t = resolvePublicTournamentTheme(org, tournament);
    tournamentCssVars = [
      `--primary:       ${t.primary}`,
      `--primary-light: ${t.primaryLight}`,
      `--primary-rgb:   ${t.primaryRgb}`,
      `--primary-glow:  rgba(${t.primaryRgb}, 0.35)`,
      `--primary-faint: rgba(${t.primaryRgb}, 0.08)`,
      `--border:        rgba(${t.primaryRgb}, 0.25)`,
      `--glow:          0 0 32px rgba(${t.primaryRgb}, 0.4)`,
      `--glow-sm:       0 0 16px rgba(${t.primaryRgb}, 0.25)`,
      `--on-primary:    ${t.onPrimary}`,
    ].join('; ');
  }

  // Game-day window — gates the My-Team dock (mirrors lib/follow isTournamentInProgress
  // without importing the client module into this server component). Tournament-local
  // date so the dock survives the UTC day boundary on the final evening (J6-056).
  const todayISO = tournamentToday();
  // "Effectively finished" for the shell (the install/alert nudges): marked complete, the bracket's champion already stamped (champions_crowned_at
  // is on the loaded record — no extra query), or the event has run past its end date.
  // Mirrors the games-derived finished signal the overview body uses, kept cheap for every
  // tournament sub-page so the whole shell agrees the event is over.
  const effectivelyFinished =
    tournament.status === 'completed' ||
    !!tournament.championsCrownedAt ||
    (!!tournament.endDate && todayISO > tournament.endDate);
  // NB: kept in step with lib/follow.isTournamentInProgress (date-window + active) — the
  // game-day dock self-gates to a followed team's live games, so it must NOT go dark the
  // moment a champion is stamped while other games may still be on today. Shell "finished"
  // signals (the install/alert nudges) use effectivelyFinished; live game-day surfaces do not.
  const tournamentInProgress =
    tournament.status === 'active' &&
    !!tournament.startDate && !!tournament.endDate &&
    todayISO >= tournament.startDate && todayISO <= tournament.endDate;

  // Public Register CTA — only when registration is genuinely open/waitlisting
  // (lifecycle + capacity aware). Skip the capacity queries entirely when the
  // register page is hidden, since there's no CTA to show then.
  // Bracket-only tournaments have no round-robin standings — hide that nav tab.
  const navHiddenPages = !hasRoundRobin(tournament)
    ? Array.from(new Set([...(tournament.publicHiddenPages ?? []), 'standings' as const]))
    : (tournament.publicHiddenPages ?? []);

  // An invite-only event has no Registration page (R6): no nav pill, whatever the row stores.
  const registerHidden = (tournament.publicHiddenPages ?? []).includes('register') || runsInviteOnlyEvents(org.planId);
  // Divisions answer two independent questions now (the register CTA's capacity maths and whether
  // this event has a public bracket), so they are fetched unconditionally — but STILL raced against
  // teams rather than awaited in front of them. Awaiting them in sequence would have turned one
  // round-trip into two on the layout that wraps every public tournament page. The only added cost
  // is one query on the tournaments that hide their register page, which previously fetched neither.
  const bracketVisible = isPublicBracketVisible(tournament);
  // Public tournament pages Stage 6 (Ask 14): the frame's tab row hides News/Rules while they have nothing to
  // show. Skipped (and never fetched) when the organizer already hid the page. Raced into the same round trip rather
  // than a second serial await.
  const newsHidden = navHiddenPages.includes('news');
  const rulesHidden = navHiddenPages.includes('rules');
  // A playoff game counts only in a published division (D1): an unpublished bracket's games never surface the tab.
  const [divisions, regTeams, playoffGamesExist, frameAnnouncements, frameRules, frameResources] = await Promise.all([
    getDivisions(tournament.id, { admin: true }),
    registerHidden ? Promise.resolve(null) : getTeams(tournament.id, { admin: true }),
    bracketVisible ? hasPublicPlayoffGames(tournament.id) : Promise.resolve(false),
    !newsHidden ? getAnnouncements(tournament.id, { admin: true }) : Promise.resolve([]),
    !rulesHidden ? getRules(tournament.id, { admin: true }) : Promise.resolve([]),
    !rulesHidden ? getResources(tournament.id, { admin: true }) : Promise.resolve([]),
  ]);

  const registration = regTeams
    ? getRegistrationState(
        tournament,
        divisions,
        regTeams.filter(t => t.status !== 'rejected'),
      )
    : null;
  // Champions: `championsCrownedAt` is the one-time, D1-safe stamp lib/champions-notify.ts only claims once no
  // division's schedule is held back and the whole tournament's playoffs are decided — exactly Ask 14's "the
  // whole tournament is Finished, matching the Overview's own PublicChampions trigger" ruling, at no extra query.
  const frameContent = tournamentFrameTabContent({
    announcementCount: frameAnnouncements.length, ruleCount: frameRules.length, resourceCount: frameResources.length,
    registrationCta: registration?.cta ?? null, championsCrownedAt: tournament.championsCrownedAt, divisions,
  });

  /**
   * Does this tournament have a bracket a fan should be able to navigate to?
   *
   * The bracket has always had a public page and has NEVER had a way in — no entry in the side
   * rail, the phone tabs or the desktop top bar, on any tournament. The overview offers a link
   * only after pool play finishes completely, so for most of an event the page is reachable only
   * by typing the URL. The "See it live" demo made that visible (its tour sends a stranger there
   * and stranded them), but the gap is every customer's, not the sandbox's.
   *
   * The test is STRUCTURAL — has the organizer configured a bracket? — deliberately, not
   * "have playoff games been played?". A tab that appears and disappears as pool play finishes is
   * worse than one that is honestly there from the start, and the page itself renders the seeding
   * picture perfectly well before any bracket game exists.
   *
   * Visibility comes from `isPublicBracketVisible`, the SAME predicate the page itself uses, so the
   * tab appears exactly when the page renders — never a link to a wall, never a page with no way
   * in. That shared rule also carries the bracket-only carve-out: those events hide Standings by
   * format rather than by choice, and their bracket is the whole tournament.
   */
  /**
   * ⚠ "Configured a bracket" means the playoff config EXISTS — not that it names a qualifying
   * count. `teamsQualifying` is optional in practice however the type reads: a real customer
   * tournament with twenty-nine playoff games already built carries
   * `{type:'single', crossover:'standard', hasThirdPlace:false}` and no count at all, and a gate
   * keyed on that number silently denied it the tab. Same bug as the bracket-only case, wearing
   * different clothes — which is why the test is now presence, not shape.
   *
   * ⚖ 2026-10-12 (Stage 3 addendum, A63): "presence" became an accident once a division stopped carrying a plan nobody
   * chose. A config can hold only a division's tie-breakers (the Divisions page writes those), and New tournament wrote
   * none at all — so an event built there never had the tab, bracket or not. The bracket is configured when a division
   * has a saved PLAN (`hasPlayoffPlan` — the Playoff generator writes it with the bracket; that customer's
   * `crossover` counts) or the event has a playoff game (a bracket built by hand saves no plan). The games test is one
   * row, raced with the reads above.
   */
  const hasPublicBracket =
    bracketVisible &&
    (divisions.some(d => hasPlayoffPlan(d.playoffConfig)) || playoffGamesExist);

  // Stage B.2 (resolution): the resolver kicked off near the top has had the whole render to
  // complete in parallel. Null here = "no door": the rail's crumb line falls back to the org's
  // name as inert text, exactly as for any org whose home isn't a real place.
  const orgHomeHref = await orgHomeHrefPromise;
  const frameContactEmail = await frameContactPromise;

  // The frame's band (Stage 1): its colour through the club's roles, its mark, dates and one of the four state words, all
  // worked out by the one helper the admin preview also calls (lib/public-frame.ts publicFrameBand).
  const frameBand = publicFrameBand(org, tournament, todayISO, registration?.state === 'open');
  // Who runs it — ONE answer for the desk band and the footer, from the same door as the rail's crumb (Part 2).
  const frameHost = publicFrameHost(org.name, tournament.name, orgHomeHref);
  // The paid plan's credit (WI-10), never the demo's. It sits in the footer; a free event keeps its badge.
  const showBuiltOnCredit = !isFreeTournamentPlan && !isDemoOrgSlug(orgSlug);
  const fanAlertsEnabled = hasPlanFeature(org.planId, 'fan_score_alerts');

  // Stage 7 (Ask 6): the focused page (the team pay page, lib/public-focused-page.ts) wears none of the event's chrome.
  // Each piece that simply goes away there is wrapped in the one gate that asks the rule; the band and the footer change
  // shape instead and ask it themselves.
  const unlessFocused = (node: React.ReactNode) => (
    <NotOnFocusedPage orgSlug={orgSlug} tournamentSlug={tournament.slug}>{node}</NotOnFocusedPage>
  );

  return (
    <>
      {/* The free plan's FieldLogicHQ badge and its acquisition banner render OUTSIDE the frame's element (both are fixed,
          so where they sit in the markup moves nothing). */}
      {unlessFocused(<>
        {isFreeTournamentPlan && (
          <PoweredByBadge
            orgSlug={orgSlug}
            tournamentSlug={tournament.slug}
            offsetForBanner={showAcquisitionBanner}
          />
        )}
        {showAcquisitionBanner && (
          <TournamentAcquisitionBanner
            orgSlug={orgSlug}
            tournamentSlug={tournament.slug}
            tournamentName={tournament.name}
          />
        )}
      </>)}
      {/* The frame's one outer element: the marker every frame style is keyed to, and the club site's token block (the ONE
          light set). Fixed parts inside it (the rail, the dock, the prompts) inherit its tokens like everything else. */}
      <div className={`${clubFrameStyles.tokens} ${frameStyles.frame}`} data-club-face={frameBand.face} {...publicFrameAttr}>
        <TournamentNavSync
          tournamentId={tournament.id}
          startDate={tournament.startDate ?? null}
          endDate={tournament.endDate ?? null}
          status={tournament.status ?? null}
        />
        {tournamentCssVars && (
          <style dangerouslySetInnerHTML={{ __html: `:root { ${tournamentCssVars} }` }} />
        )}
        {/* Chrome vars. Desktop: --desktop-strip-h → the global desktop STRIP's height (top-anchored toasts and page
            top-padding offset by it). ≤900px (no strip, a bottom bar instead): --desktop-strip-h → 0, zeroed at the SAME
            900px boundary that hides the strip (ConsumerShell .topbarStrip); --bottom-nav-height → 4.5rem, the global
            bottom bar's height (MyTeamDock, the install prompt, the growth chrome and page clearances read it). No
            header-height seed: the frame's element sets its own chrome heights (TournamentFrame.module.css), and the
            platform's old event header that the 161px seed stood in for went in Stage 8 Part 3d. */}
        <style dangerouslySetInnerHTML={{ __html: `:root { --desktop-strip-h: var(--chrome-bar-h); } @media (max-width: 900px) { :root { --bottom-nav-height: 4.5rem; --desktop-strip-h: 0px; } }` }} />
        {/* The frame's colour roles, on <html>: the frame's element reads them through the club's token block, and the app's
            own bar (mounted outside it) reads the ink. Outranks the org layout's :root block. */}
        <style dangerouslySetInnerHTML={{ __html: publicFrameRoleCss(frameBand.roles) }} />
        {/* data-live-chrome scopes mobile-chrome CSS (retired page titles/hero) to the LIVE shell. Card style left with the
            frame (Ask 11): the marker stays 'default', since the light wrapper rule (globals.css
            `[data-card-style][data-color-mode="light"]`) keys on it; the org layout's style is excluded there too. */}
        <div
          className={frameStyles.deskShell}
          data-card-style="default"
          data-color-mode="light"
          data-live-chrome=""
        >
          <TournamentBand
            orgSlug={orgSlug}
            tournamentSlug={tournament.slug}
            name={tournament.name}
            logoUrl={frameBand.logoUrl}
            initials={frameBand.initials}
            dates={frameBand.dates}
            status={frameBand.status}
            hiddenPages={navHiddenPages}
            hasBracket={hasPublicBracket}
            host={frameHost}
            frameContent={frameContent}
          />
          {/* The desk grid's rail cell (self-hides below 1,024 px). */}
          {unlessFocused(<TournamentSideRail hiddenPages={navHiddenPages} hasBracket={hasPublicBracket}
            frameContent={frameContent} />)}
          {/* Today's games are one line under the band (owner ruling 2026-10-28). */}
          <div className={frameStyles.main}>
            <TodaysResultsLine />
            {children}
          </div>
          <TournamentFooter
            name={tournament.name}
            contactEmail={frameContactEmail}
            host={frameHost}
            hiddenPages={navHiddenPages}
            hasBracket={hasPublicBracket}
            showCredit={showBuiltOnCredit}
            frameContent={frameContent}
          />
        </div>
        {/* The fan's own pieces, all gone on the focused page — one gate, in today's order:
            · the game-day "now playing" dock for the followed team (self-gates: followers on game day only; mobile-only);
            · self-onboarding shared links: ?follow=teamId → one-tap "Follow [team]?" (J6-012);
            · the post-install one-time nudge → turn on score alerts (J6-048; installed app + a followed team);
            · the fan app install prompt (J6-054) — both suppressed once the event is finished;
            · "Create an account to follow everywhere", offered (never forced) right after a follow (unified-app Phase 2;
              checks sign-in lazily, so no auth call per view);
            · N2: hydrates the signed-in account's follows into the client follow layer (client-only identity — never
              SSR'd into this SW-cached layout, see the note above). */}
        {/* One app-only gate each: the gate draws its own wrapper, so each piece keeps its own as before. */}
        {unlessFocused(<>
          <PublicAppOnly><MyTeamDock orgSlug={orgSlug} tournamentSlug={tournament.slug} inProgress={tournamentInProgress} fanAlertsEnabled={fanAlertsEnabled} /></PublicAppOnly>
          <PublicAppOnly><FollowDeepLinkPrompt orgSlug={orgSlug} tournamentSlug={tournament.slug} /></PublicAppOnly>
          {!effectivelyFinished && <AlertsNudge orgSlug={orgSlug} tournamentSlug={tournament.slug} enabled={fanAlertsEnabled} />}
          {!effectivelyFinished && (
            <InstallAppPrompt
              appName="FieldLogicHQ"
              subtitle={fanAlertsEnabled
                ? 'Live scores, schedule & alerts — add to your home screen.'
                : 'Live scores & schedule — add to your home screen.'}
              orgSlug={orgSlug}
              tournamentSlug={tournament.slug}
            />
          )}
          <PublicAppOnly><FollowAccountNudge orgSlug={orgSlug} tournamentSlug={tournament.slug} /></PublicAppOnly>
          <PublicAppOnly><AccountFollowSync orgSlug={orgSlug} tournamentSlug={tournament.slug} /></PublicAppOnly>
        </>)}
      </div>
    </>
  );
}
