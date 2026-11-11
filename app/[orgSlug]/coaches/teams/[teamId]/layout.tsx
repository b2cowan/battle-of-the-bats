import { loadCoachTeamMasthead } from '@/lib/coach-team-masthead';
import CoachTeamHeader from '@/components/coaches/CoachTeamHeader';
import CoachTeamSeasonGate from '@/components/coaches/CoachTeamSeasonGate';
import CoachSeasonRefusalNotice from '@/components/coaches/CoachSeasonRefusalNotice';
import { CoachPageHelpProvider } from '@/components/coaches/CoachPageHelpSlot';
import { CoachDeskNudgeProvider } from '@/components/coaches/CoachDeskNudge';

/**
 * The team segment's layout — it exists for ONE reason: the pinned masthead (desktop shell D2/A2).
 *
 * WHY HERE AND NOT IN THE PORTAL LAYOUT. This is the first place `teamId` exists server-side, so
 * it is the only place the masthead's numbers can ride down WITH the page instead of being fetched
 * after paint. A segment layout is not re-rendered when the coach moves between pages inside the
 * team, so the feed is read once per team entry and every page after the first costs nothing.
 *
 * ⚠ It renders a FRAGMENT. The masthead must stay a direct child of `.coachesMain` — its sticky
 * pin and its negative margins (which cancel the container's padding) are measured against that
 * container, and a wrapper element here would silently break both.
 *
 * ⚠ It NEVER gates access. The portal layout above already handled auth, and each page owns its own
 * "not assigned" wall; a redirect from here would fight them. Anything unresolvable simply renders
 * the children with no masthead.
 */
export default async function CoachTeamLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, teamId } = await params;
  // ⚖ The team's facts, read ONCE per request (navigation Phase 4): this layout's body moved into the shared loader
  // unchanged, so the strip's facts on a computer (the coaches layout's `@stripFacts` slot) and this bar are one answer.
  const masthead = await loadCoachTeamMasthead(orgSlug, teamId);
  if (!masthead) return <>{children}</>;
  const { live, closed, facts } = masthead;

  return (
    /* ⚠ THE PROVIDER EMITS NO DOM, WHICH IS WHY IT MAY WRAP THIS FRAGMENT AT ALL. The masthead has
       to stay a DIRECT child of `.coachesMain` — its sticky pin and its padding-cancelling negative
       margins are measured against that container — and a real wrapper element here would silently
       break both. A context provider renders only its children, so the DOM is byte-identical.
       It wraps the masthead AND the page because the "?" travels upward between them: the page
       publishes its help topic, the masthead draws it (2026-08-25 ruling, `CoachPageHelpSlot`).
       ⚠ Deliberately INSIDE the authenticated branch. The `if (!authCtx) return <>{children}</>`
       above renders no masthead, so it must render no host either — a page publishing to a host
       that draws nothing would lose its "?" entirely. The fallback is automatic: no provider means
       `CoachPageHeader` keeps drawing its own. */
    <CoachPageHelpProvider>
      {/* ⚖ The phone's bar (≤900; Phase 5 retires it). Above 900 it draws nothing: the strip names the page and carries the
          team's facts (navigation Phase 4, E6/E7). `statusYearId` says WHICH season the status describes — a team
          mid-rollover holds two live seasons, and the bar would rather say nothing than mix them. */}
      <CoachTeamHeader teamId={teamId} {...facts} />
      {/* ⚠⚠ **THE ONE PLACE A FINISHED SEASON IS ANSWERED** (2026-08-18). A team with no live season
          has one page, so the live tools are not rendered at all rather than rendered read-only —
          which is what deleted the seventeen read-only branches and twelve "comes back next season"
          notices that used to say it screen by screen. The decision is made HERE, on the server,
          from the two lookups the masthead already needed, so no live page paints against a closed
          season for even a frame.

          ⚠ This layout's docblock says it never gates access, and that is STILL TRUE: "you are not
          on this team" is a different sentence with a different cause, and every page still owns
          it. This says only which season the team is on. */}
      {/* The scouting reminder's facts for the page's top row on a computer (C3) — a provider, no DOM. */}
      <CoachDeskNudgeProvider value={{ teamId, ...facts }}>
      <CoachTeamSeasonGate
        seasonFinished={!live && !!closed}
        closedHref={`/${orgSlug}/coaches/teams/${teamId}/season-end`}
        teamBase={`/${orgSlug}/coaches/teams/${teamId}`}
      >
        {/* A page opened BEFORE the season closed under it: its next save is refused in words, with
            the one door — the gate above covers every page opened after (Club Tier Stage 2,
            specimen 4 frame C). Renders nothing until a save for this team is refused. */}
        <CoachSeasonRefusalNotice teamId={teamId} closedHref={`/${orgSlug}/coaches/teams/${teamId}/season-end`} />
        {children}
      </CoachTeamSeasonGate>
      </CoachDeskNudgeProvider>
    </CoachPageHelpProvider>
  );
}
