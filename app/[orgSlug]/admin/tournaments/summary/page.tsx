'use client';
/**
 * SUMMARY — Tournament admin redesign Stage 4 (D3), built to hub v24
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 4 tab), ruled 2026-10-06.
 *
 *   Summary        [Copy champions link] [Print] [?]     the page's two tools in its title band
 *   How it finished                                       the board's card (the ONE recap, Part 0)
 *   The event in numbers                                  teams · games played · collected · still owed
 *   Next year      [Reuse this setup]                     open, a WHITE button (the board keeps the lime)
 *
 * One name, "Summary" (the rail's word) — the title, the tab, the board's door, the lock lines and the
 * printout. Gone (F33, F34, F50, F53): the champions band, the division recap with its registration
 * counts and its "Leader", the four 143px figure cards, "Share the results", the closed "What's next",
 * the Plus line that called the free public results a Plus feature, and Summary's own reuse window and
 * its "Next tournament draft created" page — Next year opens the frame's one reuse step.
 *
 * PRINT (J1-110): one Letter page — the club, Summary, the event and its dates; How it finished as
 * Division · Team · How it finished; the event in numbers; each division's final standings (W-L-T, the
 * published order); a footer. Rendered as a COPY straight onto <body> (the coaches portal's certificate
 * form): in print every other child of <body> leaves the paper, so no strip, rail, header, button, bar
 * or demo bar can print around it.
 *
 * THE TOURNAMENT PLAN: the title, one sentence, one plain lock line (no full-page upsell, F38). Nothing
 * a free organizer had is lost: How it finished is on their board.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature } from '@/lib/plan-features';
import { useTournament } from '@/lib/tournament-context';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { ClubSection, LoadFailed } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import {
  EventInNumbers, HowItFinished, NextYear, ReuseButton, ShareAction,
} from '@/components/admin/tournament/AfterEventParts';
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import { AFTER_EVENT_LOCK_PLAN, FINISH_WORDS, SHARE_WORDS, SUMMARY_WORDS, hasMoney, winLossRecord } from '@/lib/after-event-words';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import type { EventRecap } from '@/lib/event-recap';
import styles from './summary.module.css';

type SummaryData = {
  tournament: {
    id: string;
    name: string;
    slug: string | null;
    year: number | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  recap: EventRecap;
  publicHome: string | null;
};

const noSubscribe = () => () => {};

const SUMMARY_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-closeout-tournament'], subtopicId: 'faq-post-event-summary' };

export default function TournamentSummaryPage() {
  const { currentOrg } = useOrg();
  usePageTitle(SUMMARY_WORDS.title);
  const { currentTournament } = useTournament();
  const { openReuse } = useSetupWizard();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // The printed page is a portal onto <body>: only in the browser (the certificate's form).
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);

  const tournamentId = currentTournament?.id;
  const hasSummary = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'post_tournament_summary'));
  const canClone = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const planHref = tournamentPlusPanelHref(currentOrg?.slug ?? 'admin');
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  useEffect(() => {
    if (!tournamentId || !hasSummary) return;
    const id = tournamentId;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(id)}/summary${orgQuery}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Unable to load the summary.');
        if (!cancelled) { setSummary(data as SummaryData); setError(''); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load the summary.');
      }
    })();
    return () => { cancelled = true; };
  }, [hasSummary, tournamentId, orgQuery, reloadKey]);

  const track = useCallback((action: 'print' | 'share_public_results') => {
    if (!tournamentId) return;
    // Analytics never blocks the organizer's recap.
    void fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/summary${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => {});
  }, [tournamentId, orgQuery]);

  // A read for a different event than the one on screen is never shown.
  const ready = summary && summary.tournament.id === tournamentId ? summary : null;

  const help = <HelpButton help={SUMMARY_HELP} label={SUMMARY_WORDS.title} iconOnly />;
  const tools = ready ? (
    <>
      <ShareAction recap={ready.recap} onCopied={() => track('share_public_results')} />
      <button
        type="button"
        className={`${screenParts.plainButton} ${screenParts.headerButton}`}
        onClick={() => { track('print'); window.print(); }}
        aria-label={SUMMARY_WORDS.print}
        title={SUMMARY_WORDS.print}
      >
        <Printer size={15} aria-hidden />
        <span className={screenParts.headerButtonLabel}>{SUMMARY_WORDS.print}</span>
      </button>
    </>
  ) : null;
  // The demo tour's closing beat anchors on the title band (it renders in every state of this page).
  const header = (
    <div data-sandbox-tour="post-event-summary">
      <AdminPageHeader inlineActions title={SUMMARY_WORDS.title} actions={hasSummary ? <>{tools}{help}</> : help} />
    </div>
  );

  if (!currentTournament) {
    return <div className={styles.page}>{header}<p className={styles.muted}>{SUMMARY_WORDS.noEvent}</p></div>;
  }

  if (!hasSummary) {
    return (
      <div className={styles.page}>
        {header}
        <ClubSection>
          <p className={styles.lockedSentence}>{SUMMARY_WORDS.lockedSentence}</p>
          <PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{SUMMARY_WORDS.title}</PlanLockLine>
        </ClubSection>
      </div>
    );
  }

  if (error && !ready) {
    return (
      <div className={styles.page}>
        {header}
        <LoadFailed title="The summary didn’t load." onRetry={() => { setError(''); setReloadKey(k => k + 1); }} />
      </div>
    );
  }

  if (!ready) {
    return <div className={styles.page}>{header}<p className={styles.muted}>Loading…</p></div>;
  }

  const { recap, tournament } = ready;
  const hiddenNote = recap.shareHidden ? SHARE_WORDS.hidden : null;

  return (
    <div className={styles.page}>
      {header}

      <div className={styles.top}>
        {recap.finishes.length > 0 && <HowItFinished recap={recap} note={hiddenNote} />}
        <EventInNumbers recap={recap} note={recap.finishes.length > 0 ? null : hiddenNote} />
      </div>

      <NextYear year={tournament.year} wide>
        {canClone
          ? (
            <ReuseButton
              primary={false}
              onClick={() => openReuse({ id: tournament.id, name: tournament.name, year: tournament.year, status: tournament.status }, 'summary')}
            />
          )
          : <PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{SUMMARY_WORDS.title}</PlanLockLine>}
      </NextYear>

      <p className={styles.closing}>
        {SUMMARY_WORDS.closingLine}{' '}
        <a href="/pricing" target="_blank" rel="noopener noreferrer" className={styles.closingLink}>{SUMMARY_WORDS.closingLink}</a>
      </p>

      {inBrowser && createPortal(
        <PrintedSummary club={currentOrg?.name ?? ''} data={ready} />,
        document.body,
      )}
    </div>
  );
}

/** The printed page (D3): hidden on screen; in print, the only thing on the paper. */
function PrintedSummary({ club, data }: { club: string; data: SummaryData }) {
  const { tournament, recap, publicHome } = data;
  const W = SUMMARY_WORDS;
  const C = W.printColumns;
  const dates = formatEventDateRange(tournament.startDate, tournament.endDate, true, { longMonth: true });
  const link = publicHome ? `${window.location.host}${publicHome}` : null;
  return (
    <div className={styles.printCopy} data-summary-print>
      {/* Letter, no @page margin: the browser's own header and footer print IN the margin, so a page
          with none has nowhere to put them; the sheet carries its own padding. */}
      <style>{'@page { size: 8.5in 11in; margin: 0; }'}</style>
      <div className={styles.paper}>
        <p className={styles.paperEyebrow}>{W.printEyebrow(club)}</p>
        <h1 className={styles.paperTitle}>{tournament.name}</h1>
        {dates && <p className={styles.paperDates}>{dates}</p>}

        {recap.finishes.length > 0 && (
          <>
            <h2 className={styles.paperHeading}>{FINISH_WORDS.heading}</h2>
            <table className={styles.paperTable}>
              <thead><tr><th>{C.division}</th><th>{C.team}</th><th>{C.finish}</th></tr></thead>
              <tbody>
                {recap.finishes.map(f => (
                  <tr key={f.divisionId}>
                    <td>{f.divisionName}</td>
                    <td><b>{f.teamName}</b></td>
                    <td>{FINISH_WORDS.printCell(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 className={styles.paperHeading}>{W.figuresHeading}</h2>
        <div className={styles.paperFigures}>
          <div><b>{recap.teamsPlayed}</b><span>{W.teams(recap.teamsPlayed)}</span></div>
          <div><b>{recap.gamesPlayed}</b><span>{W.gamesPlayed(recap.gamesPlayed, recap.playoffGamesPlayed)}</span></div>
          {hasMoney(recap) && (
            <>
              <div><b>{W.money(recap.money.collected)}</b><span>{W.collected}</span></div>
              <div><b>{W.money(recap.money.owed)}</b><span>{W.stillOwed}</span></div>
            </>
          )}
        </div>

        {recap.standings.length > 0 && (
          <>
            <h2 className={styles.paperHeading}>{W.printStandings}</h2>
            <table className={styles.paperTable}>
              <thead><tr><th>{C.division}</th><th>{C.team}</th><th className={styles.paperNum}>{C.record}</th></tr></thead>
              <tbody>
                {recap.standings.flatMap(d => d.rows.map((r, i) => (
                  <tr key={`${d.divisionId}-${i}`}>
                    <td>{i === 0 ? d.divisionName : ''}</td>
                    <td>{r.teamName}</td>
                    <td className={styles.paperNum}>{winLossRecord(r.w, r.l, r.t)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </>
        )}

        <div className={styles.paperFoot}>
          <span>{link}</span>
          <span>{W.printed(formatStoredDate(tournamentToday()))}</span>
        </div>
      </div>
    </div>
  );
}
