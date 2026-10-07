'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useBackStep } from '@/components/coaches/useBackStep';
import LineupDrawer from '@/components/coaches/LineupDrawer';
import { formatInOrgZone } from '@/lib/timezone';
import { CoachRowList, CoachRow, CoachRowBand } from '@/components/coaches/CoachRowList';
import { COACH_GAME_EVENT_TYPES, formatEventWhen, sideWord } from '@/lib/coach-tournament-games';
import { lineupModeLabel } from '@/lib/lineup-grid';
import type { LineupBadge } from '@/lib/lineup-analysis';
import type { LineupCopyWhat } from '@/lib/lineup-copy';
import type { SportPack } from '@/lib/sports';
import type {
  LineupRulesOverride, RepLineupMode, RepRosterPlayer, RepTeamEvent, RepTeamLineup, RepTeamLineupEntry,
  RepTeamLineupTemplate,
} from '@/lib/types';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './LineupCopyFrom.module.css';

/**
 * COPY FROM — the lineup builder's panel for putting another game's lineup, or a template, onto this
 * game (owner rulings 2026-10-02; docs/projects/active/COACH_LINEUP_COPY_FROM_GAME_PLAN.md).
 *
 * Opened from the builder's Tools menu. Two views in one surface:
 *   · the LIST — a Games / Templates switch (D12), each list with the panel to itself. Games are this
 *     season's games that started BEFORE this one and have a lineup, newest first, in month bands.
 *     It opens on Games, and on Templates only when no earlier game has a lineup and a template exists.
 *   · the QUESTION — "Batting order" or "Order and positions". Each answer performs the copy, so the
 *     question is also the confirmation; nothing opens OUTSIDE the panel, which is what made the old
 *     template confirm's "Keep current" bounce the coach out of the drawer (Mobile plan §13.6 #5).
 *
 * ⚠ A MENU, NOT A FORM (the 2026-09-23 drawer ruling): you tap and it acts, nothing is typed, so the
 * bottom nav stays visible beneath it. Wherever the bar shows (≤900) it is the portal's sheet frame in
 * the MENU layer (Sheet Frame step 5), which answers its outside tap, Escape and the phone's Back and
 * hands focus home to Tools however it closes — its × included, which used to leave focus nowhere.
 * At ≤640 the frame fills the screen ABOVE the nav (`full`, D7); at 641–900 it is the ordinary
 * sheet; above that an anchored panel under Tools, whose keys the page answers.
 *
 * ⚠ The PAGE owns the copy itself (`onCopy`): it links call-ups, maps the rows and writes the notice.
 * This component only finds the source and asks the question.
 */

/** A source the coach picked, with what the page needs to copy it. */
export type LineupCopyPick =
  | {
      kind: 'game';
      /** "vs Lucan Ilderton" */
      label: string;
      /** "Sat, Oct 3" */
      dayLabel: string;
      lineupMode: RepLineupMode;
      inningCount: number;
      entries: RepTeamLineupEntry[];
      rulesOverride: LineupRulesOverride | null;
      /** The source game's call-ups — a copied call-up is linked to THIS game first (D5). */
      callUps: RepRosterPlayer[];
    }
  | { kind: 'template'; template: RepTeamLineupTemplate };

interface GameRow { id: string; title: string; dayLabel: string; caption: string; month: string }

type Chosen =
  | { kind: 'game'; game: GameRow; loaded: Extract<LineupCopyPick, { kind: 'game' }> | null; error: string }
  | { kind: 'template'; template: RepTeamLineupTemplate };

/** "vs Lucan Ilderton" / "@ Strathroy Blaze" — the game by its opponent, as the builder titles it. */
const matchup = (e: Pick<RepTeamEvent, 'opponent' | 'homeAway' | 'name'>) => (e.opponent ? `${sideWord(e.homeAway)} ${e.opponent}` : e.name || 'Game');

export default function LineupCopyFrom({
  orgSlug, teamId, event, sportPack, templates, hasPositions, onCopy, onClose, opener,
}: {
  orgSlug: string;
  teamId: string;
  /** This game — what the copy lands on, and the line the Games list stops at. */
  event: RepTeamEvent;
  sportPack: SportPack;
  templates: RepTeamLineupTemplate[];
  /** Whether this lineup already has positions — only then does the question warn it replaces them. */
  hasPositions: boolean;
  /** Performs the copy. Throws with a message the panel shows; resolves once the lineup has it. */
  onCopy: (pick: LineupCopyPick, what: LineupCopyWhat) => Promise<void>;
  onClose: () => void;
  /** Tools — where focus goes home when the panel closes on a phone (the menu item that opened it is gone). */
  opener: RefObject<HTMLElement | null>;
}) {
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [gamesError, setGamesError] = useState('');
  const [tab, setTab] = useState<'games' | 'templates' | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyError, setCopyError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const period = sportPack.periodLabel.toLowerCase();
  const periods = sportPack.periodLabelPlural.toLowerCase();
  /** "Everyone bats · 7 innings" — the shape of a lineup, the same words wherever it is named here. */
  const shape = (mode: RepLineupMode, innings: number) => `${lineupModeLabel(mode)} · ${innings} ${innings === 1 ? period : periods}`;
  const dayLabel = (iso: string) => formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' });
  // Which game the copy lands on — said wherever the builder is out of sight (the full-screen phone).
  const intoWhat = `${matchup(event)}${event.startsAt ? ` · ${dayLabel(event.startsAt)}` : ''}`;

  // The question is a level of its own — Back returns to the list, not out of the panel (§219).
  const backToList = () => { setChosen(null); setCopyError(''); };
  useBackStep(!!chosen, backToList);

  // Focus moves into the panel on open, so a keyboard user lands where the choices are.
  useEffect(() => { panelRef.current?.focus({ preventScroll: true }); }, []);

  /* The season's games, read when the panel opens (the call-up sheet's pattern) — the same events
     read the Lineups room makes, which already carries each game's lineup status and innings. */
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
        const data: {
          events?: RepTeamEvent[];
          lineupStatusByEvent?: Record<string, LineupBadge>;
          lineupInningsByEvent?: Record<string, number>;
        } = await res.json().catch(() => ({}));
        if (!res.ok || !data.lineupStatusByEvent) throw new Error('Your games could not be loaded');
        const status = data.lineupStatusByEvent;
        const innings = data.lineupInningsByEvent ?? {};
        const thisStart = event.startsAt ? Date.parse(event.startsAt) : Number.POSITIVE_INFINITY;
        const thisYear = event.startsAt ? formatInOrgZone(event.startsAt, { year: 'numeric' }) : '';
        const rows = (data.events ?? [])
          .filter(e => e.id !== event.id
            && COACH_GAME_EVENT_TYPES.includes(e.eventType)
            && e.status !== 'cancelled'
            && !!e.startsAt && Date.parse(e.startsAt) < thisStart
            && !!status[e.id] && status[e.id] !== 'not_started')
          .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
          .map(e => {
            const year = formatInOrgZone(e.startsAt, { year: 'numeric' });
            const n = innings[e.id];
            return {
              id: e.id,
              title: matchup(e),
              dayLabel: dayLabel(e.startsAt),
              caption: `${formatEventWhen(e.startsAt)}${n ? ` · ${n} ${n === 1 ? period : periods}` : ''}`,
              month: formatInOrgZone(e.startsAt, year === thisYear ? { month: 'long' } : { month: 'long', year: 'numeric' }),
            };
          });
        if (live) setGames(rows);
      } catch (e) {
        if (live) setGamesError(e instanceof Error ? e.message : 'Your games could not be loaded');
      }
    })();
    return () => { live = false; };
    // Read once per opening; the panel unmounts when it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opens on Games — unless no earlier game has a lineup and there is a template to copy instead.
  const shownTab = tab ?? (games && games.length === 0 && templates.length > 0 ? 'templates' : 'games');

  /* The picked game's lineup, read as it is picked so the answers are ready by the time it is read.
     ⚠ An answer lands ONLY while the panel is still waiting on that same game — a coach who went
     Back and picked another must never be asked about the second game with the first one's rows.
     (State, not a sequence ref: the hooks lint reads a ref behind a row's onClick as a render read.) */
  async function chooseGame(game: GameRow) {
    setCopyError('');
    setChosen({ kind: 'game', game, loaded: null, error: '' });
    const land = (next: Chosen) => setChosen(was => (was?.kind === 'game' && was.game.id === game.id && !was.loaded && !was.error ? next : was));
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${game.id}/lineup`);
      const data: { lineup?: RepTeamLineup | null; entries?: RepTeamLineupEntry[]; callUps?: RepRosterPlayer[] } = await res.json().catch(() => ({}));
      if (!res.ok || !data.lineup) throw new Error('That game’s lineup could not be loaded');
      land({
        kind: 'game', game, error: '',
        loaded: {
          kind: 'game', label: game.title, dayLabel: game.dayLabel,
          lineupMode: data.lineup.lineupMode, inningCount: data.lineup.inningCount,
          entries: data.entries ?? [], rulesOverride: data.lineup.rulesOverride ?? null, callUps: data.callUps ?? [],
        },
      });
    } catch (e) {
      land({ kind: 'game', game, loaded: null, error: e instanceof Error ? e.message : 'That game’s lineup could not be loaded' });
    }
  }

  async function answer(what: LineupCopyWhat) {
    if (!chosen || busy) return;
    const pick: LineupCopyPick | null = chosen.kind === 'template' ? { kind: 'template', template: chosen.template } : chosen.loaded;
    if (!pick) return;
    setBusy(true);
    setCopyError('');
    try {
      await onCopy(pick, what);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Could not copy that lineup');
    } finally {
      // A copy that lands closes the panel, but the panel must not depend on that to leave "Copying…".
      setBusy(false);
    }
  }

  const closeButton = (
    <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
      <X size={18} aria-hidden />
    </button>
  );

  /** The question: what comes across from the source the coach picked. */
  function questionView(c: Chosen) {
    const ready = c.kind === 'template' || !!c.loaded;
    const noun = c.kind === 'template' ? 'template' : 'game';
    const sub = c.kind === 'template'
      ? `Template · ${shape(c.template.lineupMode, c.template.inningCount)}`
      : c.loaded ? `${c.game.dayLabel} · ${shape(c.loaded.lineupMode, c.loaded.inningCount)}` : c.game.dayLabel;
    const answers: [LineupCopyWhat, string, string][] = [
      ['order', 'Batting order', `The same order as that ${noun}. Positions already on this game stay with each player.`],
      ['everything', 'Order and positions', `The whole lineup as it was: the order, every ${period}’s positions, the format and the ${periods}.`],
    ];
    return (
      <>
        <div className={styles.head}>
          <button type="button" className={styles.back} onClick={backToList} disabled={busy}>
            <ChevronLeft size={17} aria-hidden /> {c.kind === 'template' ? 'Templates' : 'Games'}
          </button>
          {closeButton}
        </div>
        <div className={styles.source}>
          <strong>{c.kind === 'template' ? c.template.name : c.game.title}</strong>
          <span>{sub}</span>
        </div>
        <p className={styles.question}>What should come across?</p>
        {c.kind === 'game' && c.error ? <p className={shared.errorText}>{c.error}</p> : (
          <>
            {answers.map(([what, title, line]) => (
              <button key={what} type="button" className={styles.option} disabled={!ready || busy} onClick={() => void answer(what)}>
                <strong>{title}</strong>
                <span>{line}</span>
              </button>
            ))}
            {!ready && <p className={shared.lineupAutoNote}>Loading that lineup…</p>}
            {busy && <p className={shared.lineupAutoNote}>Copying…</p>}
          </>
        )}
        {hasPositions && <p className={shared.lineupAutoNote}>This replaces the lineup on this game. Undo brings it back.</p>}
        {copyError && <p className={shared.errorText}>{copyError}</p>}
        <p className={styles.into}>Copying into {intoWhat}</p>
      </>
    );
  }

  /** The chosen tab's list — the portal's row list, inset (the panel paints the ground). */
  function sourceList() {
    if (shownTab === 'templates') {
      if (templates.length === 0) return <p className={styles.empty}>No saved templates yet. Save one from Tools › Save as template.</p>;
      return (
        <CoachRowList inset label="Templates">
          {templates.map(t => (
            <CoachRow key={t.id} as="button" title={t.name} caption={shape(t.lineupMode, t.inningCount)} door="chevron"
              onClick={() => { setCopyError(''); setChosen({ kind: 'template', template: t }); }} />
          ))}
        </CoachRowList>
      );
    }
    if (gamesError) return <p className={`${styles.empty} ${shared.errorText}`}>{gamesError}</p>;
    if (!games) return <p className={styles.empty}>Loading your games…</p>;
    if (games.length === 0) return <p className={styles.empty}>No earlier game has a lineup yet.</p>;
    return (
      <CoachRowList inset label="Games">
        {games.flatMap((g, i) => [
          ...(i === 0 || games[i - 1].month !== g.month ? [<CoachRowBand key={`band-${g.month}`}>{g.month}</CoachRowBand>] : []),
          <CoachRow key={g.id} as="button" title={g.title} caption={g.caption} door="chevron" onClick={() => void chooseGame(g)} />,
        ])}
      </CoachRowList>
    );
  }

  const body = chosen ? questionView(chosen) : (
    <>
      <div className={styles.head}>
        <div>
          <p className={shared.lineupSheetTitle}>Copy from</p>
          <p className={styles.sub}>Into {intoWhat}</p>
        </div>
        {closeButton}
      </div>
      <div className={`${shared.segChoice} ${shared.segChoiceFull}`} role="tablist" aria-label="Copy from">
        {(['games', 'templates'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={shownTab === t}
            className={`${shared.segBtn} ${shownTab === t ? shared.segBtnActive : ''}`}
            onClick={() => setTab(t)}>
            {t === 'games' ? 'Games' : 'Templates'}
          </button>
        ))}
      </div>
      <div className={styles.list}>{sourceList()}</div>
    </>
  );
  return (
    <LineupDrawer label="Copy from" ref={panelRef} full busy={busy} onClose={onClose} opener={opener}
      popover={{ className: styles.panel, tabIndex: -1 }} bodyClassName={styles.body}>
      {body}
    </LineupDrawer>
  );
}
