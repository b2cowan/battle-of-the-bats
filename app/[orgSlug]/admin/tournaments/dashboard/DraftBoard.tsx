'use client';
/**
 * THE DRAFT'S BOARD — Tournament admin redesign Stage 5 (E2; F80–F82), built to hub v45
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 5 tab), ruled 2026-10-10.
 *
 *   ┌ Before you activate · 2 of 3 done · it stays private until then
 *   │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 *   │ ✓ Dates                    May 14–16, 2027                         ›   every row a DOOR to the exact place
 *   │ ✓ Divisions                U11 · U13 · U15 — 24 spots               ›
 *   │ ✓ Who teams can write to   Coach emails go to your organization’s owner, sam@…. Your public site shows no contact.  ›
 *   │                            (always done: the owner when nobody is chosen, 2026-10-19; the public-site half is a nudge)
 *   │ THE REST, WHEN YOU'RE READY 2 of 6
 *   │   Venues · Fees · Schedule · Rules & resources · Game timing & tie-breakers · Public site
 *   └
 *   Start from a past tournament   (one quiet row while the draft has no divisions — the reuse step, into this draft)
 *   Ready to activate              (the board's ONE lime, only when Activate can work: above the checklist on a phone,
 *                                   the right-hand column at a desk)
 *   Preview                        (one door card: the public site and its registration form)
 *
 * One card replaced four blocks (the guidance card, "What everyone else sees", the launch checklist and the reuse
 * banner): two progress counts and three Preview doors said "what next" three ways. The checklist's "ready" is the one
 * Activate reads (lib/tournament-activation, F82), and its question is the event record's (lib/tournament-status-words).
 */
import { useState } from 'react';
import { CheckCircle2, Circle, Copy } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, ClubSection } from '@/components/admin/kit/club/RepKit';
import {
  DRAFT_BOARD_WORDS as W, contactLine, datesLine, divisionsLine, feeLine, feeState, publicSiteLine, timingLine, venuesLine,
  type BoardFees, type DraftSetup,
} from '@/lib/tournament-board-words';
import { statusConfirm } from '@/lib/tournament-status-words';
import { tournamentToday } from '@/lib/timezone';
import { publicHref, useClubPublicOrigin } from '@/lib/use-club-public-origin';
import { BoardDoor } from './GameDayBoard';
import PlanLockLine from '@/components/admin/tournament/PlanLockLine';
import { LOCK_WORDS } from '@/lib/invite-only-words';
import styles from './DraftBoard.module.css';

/** What the dashboard route's checklist says is set (its "ready" is Activate's own rule). */
export type DraftChecklist = {
  hasDates: boolean;
  hasDivisions: boolean;
  hasPublicContact: boolean;
  hasVenues: boolean;
  hasRules: boolean;
  hasGameTiming: boolean;
  hasTieBreakers: boolean;
  hasBranding: boolean;
  ready: boolean;
};

type Row = { key: string; title: string; caption: string; href: string; done: boolean; required?: boolean };

export default function DraftBoard({
  base, orgSlug, tournament, checklist, setup, fees, divisions, games, publicPageCount, finiteSlots,
  canActivate, startFrom, onActivate, inviteOnly,
}: {
  /** An invite-only event (the free tournament tier): no fees step (it tracks no payments) and no spots to count. */
  inviteOnly: boolean;
  /** `/{org}/admin/tournaments` */
  base: string;
  orgSlug: string;
  tournament: { id: string; name: string; slug: string; startDate: string | null; endDate: string | null };
  checklist: DraftChecklist;
  setup: DraftSetup | null;
  fees: BoardFees;
  divisions: ReadonlyArray<{ name: string; capacity: number | null }>;
  games: number;
  publicPageCount: number;
  finiteSlots: boolean;
  /** This member may change the event's status (create_tournaments). */
  canActivate: boolean;
  /** The quiet "Start from a past tournament" row: its door, the plan's lock line (`href`: the plan's panel), or nothing. */
  startFrom: { kind: 'open'; onOpen: () => void } | { kind: 'plan'; href: string } | null;
  /** Activates; resolves once the board has moved on, rejects with the route's words. */
  onActivate: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const publicOrigin = useClubPublicOrigin(orgSlug);

  const sport = setup?.sport ?? null;
  const settingsHref = (section: string) => `${base}/settings/event?section=${section}`;
  const required: Row[] = [
    { key: 'dates', title: W.dates, caption: datesLine(tournament.startDate, tournament.endDate), href: settingsHref('overview'), done: checklist.hasDates, required: true },
    { key: 'divisions', title: W.divisions, caption: divisionsLine(divisions, { spots: !inviteOnly }), href: `${base}/divisions`, done: checklist.hasDivisions, required: true },
    {
      key: 'contact', title: W.contact,
      caption: setup ? contactLine(setup.contact) : '',
      href: settingsHref('contact'), done: checklist.hasPublicContact, required: true,
    },
  ];
  const feesSet = feeState(fees) !== 'notSet';
  const rest: Row[] = [
    { key: 'venues', title: W.venues, caption: setup ? venuesLine(setup.venues, sport) : W.none, href: `${base}/venues`, done: checklist.hasVenues },
    // An invite-only event tracks no payments: no fees step (its Fees & payments card is absent).
    ...(inviteOnly ? [] : [{ key: 'fees', title: W.fees, caption: feeLine(fees), href: settingsHref('fees'), done: feesSet }]),
    { key: 'schedule', title: W.schedule, caption: games > 0 ? W.games(games) : W.noGames, href: `${base}/schedule`, done: games > 0 },
    { key: 'rules', title: W.rules, caption: setup && setup.rules > 0 ? W.sections(setup.rules) : W.none, href: `${base}/rules`, done: checklist.hasRules },
    {
      key: 'timing', title: W.timing, caption: setup ? timingLine(setup.timing, sport) : '',
      href: settingsHref('schedule'), done: checklist.hasGameTiming && checklist.hasTieBreakers,
    },
    {
      key: 'public', title: W.publicSite, caption: setup ? publicSiteLine(setup.publicPages, setup.hasLogo, publicPageCount) : '',
      href: `${base}/branding`, done: checklist.hasBranding,
    },
  ];
  const requiredDone = required.filter(r => r.done).length;
  const restDone = rest.filter(r => r.done).length;
  // Shown only when Activate can work: the server's own rule says ready, and this member may change the status.
  const showReady = checklist.ready && canActivate;

  const question = statusConfirm('activate', {
    name: tournament.name,
    startDate: tournament.startDate,
    today: tournamentToday(),
    finiteSlots,
    openDivisions: setup?.openDivisions ?? null,
  });
  // The club's own web address while one is handed out (Club Tier 4e), else the address this page is on.
  const publicLink = publicOrigin ? publicHref(publicOrigin, orgSlug, `/${tournament.slug}`) : '';

  const row = (r: Row) => (
    <ClubRow
      key={r.key}
      as="link"
      href={r.href}
      title={r.title}
      caption={r.caption || undefined}
      mark={r.done
        ? <CheckCircle2 size={18} className={styles.markDone} />
        : <Circle size={18} className={r.required ? styles.markNeeded : styles.markOpen} />}
      aria-label={[r.title, r.caption, r.done ? 'done' : r.required ? 'still needed' : 'not set yet'].filter(Boolean).join(', ')}
      chevron
    />
  );

  async function activate() {
    setBusy(true);
    setError('');
    try {
      await onActivate();
      setAsking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t activate the tournament.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* the link is on screen to copy by hand */ }
  }

  return (
    <div className={styles.board}>
      {showReady && (
        <ClubSection title={W.ready} className={styles.ready}>
          <p className={styles.readyLine}>{question.body}</p>
          <button type="button" className={`btn btn-lime ${styles.readyButton}`} onClick={() => { setError(''); setAsking(true); }}>
            {question.action}
          </button>
        </ClubSection>
      )}

      <div className={styles.main}>
        <ClubRowFrame>
          <div className={styles.head}>
            <h2 className={styles.title}>{W.title}</h2>
            <p className={styles.progressLine}>{W.progress(requiredDone, required.length)}</p>
            <div className={styles.bar} aria-hidden><i style={{ width: `${Math.round((requiredDone / required.length) * 100)}%` }} /></div>
          </div>
          <ClubRowList inset label={W.title}>{required.map(row)}</ClubRowList>
          <ClubRowList inset label={W.rest}>
            <ClubRowBand count={W.restCount(restDone, rest.length)}>{W.rest}</ClubRowBand>
            {rest.map(row)}
          </ClubRowList>
        </ClubRowFrame>

        {/* Reuse on a plan without it: the one lock line, in the New tournament window's words (specimen 8) — it was a
            lime "Review Tournament Plus" to the bare plan page, a second lime and a different door (F09). */}
        {startFrom?.kind === 'plan' && (
          <PlanLockLine href={startFrom.href}>{LOCK_WORDS.reuseSetup}</PlanLockLine>
        )}
        {startFrom?.kind === 'open' && (
          <ClubRowList label={W.startFrom}>
            <ClubRow
              as="button"
              onClick={startFrom.onOpen}
              aria-haspopup="dialog"
              mark={<Copy size={17} className={styles.markOpen} />}
              title={W.startFrom}
              caption={W.startFromLine}
              chevron
            />
          </ClubRowList>
        )}
      </div>

      <div className={styles.preview}>
        <BoardDoor
          href={`${base}/preview/${tournament.slug}`}
          newTab
          eyebrow={W.previewEyebrow}
          title={W.previewTitle}
          line={W.previewLine}
        />
      </div>

      {asking && (
        <KitDialog
          kind="question"
          title={question.title}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-lime" onClick={() => void activate()} disabled={busy}>{question.action}</button>
            </>
          )}
        >
          <p>{question.body}</p>
          {publicLink && (
            <div className={styles.link}>
              <span className={styles.linkLabel}>{W.publicLink}</span>
              <span className={styles.linkUrl}>{publicLink}</span>
              <button type="button" className={`btn btn-outline btn-data ${styles.copy}`} onClick={() => void copyLink()}>
                {copied ? W.copied : W.copy}
              </button>
            </div>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </KitDialog>
      )}
    </div>
  );
}
