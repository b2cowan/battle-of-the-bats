'use client';
/**
 * THE PLAYOFF GENERATOR — Tournament admin redesign, Stage 3 addendum (A61–A70, ruled 2026-10-12: "I agree with all of
 * your recommendations, you are good to build"), built to the sheet `TOURNAMENT_PLAYOFF_GENERATOR_SHEET.html` (PG1–PG7).
 * It replaces the old modal (`PlayoffWizard`, retired): the Round-robin generator's two-step window, its frame and its
 * When / Where parts (GeneratorParts — one copy).
 *
 *   1. SETTINGS, in the order the decision is made: Who plays (Brackets → Teams that advance → Seeding, only with two
 *      pools; a playoffs-only event orders its seeds by hand, on the portal's reorder standard) · How it's played (the
 *      public pages' format words, a 3rd-place game where every bracket has semifinals, a second final for double
 *      elimination, and what it makes) · When ("Leave times and diamonds for later" first) · Where (+ Final played on,
 *      one bracket only — P2) · Rules (rest between a team's games: the one rule that acts on a bracket, A64). The
 *      foot's left end says when the bracket can't fit the days, in amber; it never refuses (A65).
 *   2. DRAFTS — only the drafts that differ get a card, named by what they win, no score (A66); one draft has no card
 *      column. The statement first: what saving adds, replaces and keeps, the playoff PLAN it saves (A63), and — P4 —
 *      when saving announces "Playoffs are set". The games by round, as the schedule's rows; Show as diagram (A67) when a game feeds another.
 *
 * Saving is ONE step (mig 327, `replace-division-playoffs`): the games still to play it replaces, the draft's games and
 * the division's plan, together or not at all. A played game is never in reach; a bracket with one keeps its shape —
 * who plays and how it's played read as one held sentence, and the generator only re-places the games still to play
 * (A68). A refused save keeps the draft on screen with the reason.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Division, Game, OrgPlan, Team, Tournament, Venue } from '@/lib/types';
import { formatTime, formatPoolName } from '@/lib/utils';
import { gameLengthMinutes } from '@/lib/booking-length';
import { fieldNounFor } from '@/lib/sports';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { clashLine, clashLineText } from '@/lib/venue-clash-words';
import type { ClashFinding } from '@/lib/venue-clash';
import { hasRoundRobin } from '@/lib/tournament-phase';
import { formatVenueLocation } from '@/lib/venue-label';
import { resolveGameTiming, slotsClearOfTakenGames, toConflictGame } from '@/lib/schedule-conflict';
import { filterStartsAfterRoundRobinCompletion, getRoundRobinCompletion } from '@/lib/playoff-scheduling-guard';
import { generateScoredScheduleDrafts, type ScheduleDraftAssignment, type ScheduleDraftMatchup, type SchedulePrioritySettings } from '@/lib/schedule-generator';
import { bracketGameLabel, bracketHasFeeds, bracketRoundLabel, validateTierRanges } from '@/lib/playoff-bracket';
import { hasPlayoffPlan } from '@/lib/playoff-plan';
import {
  bracketsOf, crossesPools, distinctDrafts, draftMeasures, feederCode, firstRoundOf, fitOf, getsOf, isFinalCode, levelInto,
  normalizeSettings, planOf, poolChoices, seedsSkippingFirstRound, settingsFromPlan, shapesFor, templateOf, thirdPlaceOffered,
  topChoices, TIER_NAMES,
  type DraftWin, type FitWindow, type PlayoffDivisionFacts, type PlayoffDraftMeasures, type PlayoffDraftRow, type PlayoffFormat,
  type PlayoffSettings, type PlayoffShape, type PlayoffTierSetting,
} from '@/lib/playoff-generator';
import {
  BRACKET_WORDS as BW, DRAFT_SAVE_FAILED, GENERATOR_WORDS as GW, PLAYOFF_GENERATOR_WORDS as W, SCHEDULE_DAY_WORDS as SW,
  bracketWhen, durationWords, refusalReason, slotWords,
} from '@/lib/schedule-words';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, ClubRow, ClubRowBand, ClubRowFrame, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { CheckChoice, screenParts } from '@/components/admin/tournament/ScreenParts';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import { arrayMove } from '@dnd-kit/sortable';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { GameTeams } from '../results/ResultsList';
import BracketColumns, { buildBracketColumns } from './components/BracketColumns';
import {
  WhenSection, WhereSection, draftDaySlots, eventDates, fieldNameIn, getVenueResourceKeys, range, selectedResourcesOf, takenOthersOf,
  withCurrent,
  type DateSlot,
} from './GeneratorParts';
import gen from './Generator.module.css';
import pg from './PlayoffGenerator.module.css';

/** The engine's settings that leave a bracket's draft to its one acting rule (A64): rest between a team's games. The
 *  four others score a team's games, and a bracket's sides are slots that each play once — they never bit (F98);
 *  balancing early and late was the one still nudging slots, so it is off. The drafts it tries are fixed. */
const playoffPriorities = (rest: number): SchedulePrioritySettings => ({
  candidateCount: 24, maxGamesPerDay: 99, minRestMinutes: rest, avoidBackToBack: false, reduceVenueChanges: false, balanceTimeSlots: false,
});

const PLAYED = new Set(['submitted', 'completed', 'forfeit']);

/** A game of the bracket, in the window: its place in the bracket, and once drafted, where and when. */
interface DraftRow extends PlayoffDraftRow {
  level: number;
  /** How the window names its bracket ("Red Pool", "Gold"), null for one bracket. */
  label: string | null;
  /** A held bracket's own bracket id (A68: re-placed in place); null for a new bracket. */
  bracketId: string | null;
  venueId: string | null;
  venueFacilityId: string | null;
  laneId: string | null;
  laneLabel: string | null;
}

interface DraftOption { rows: DraftRow[]; measures: PlayoffDraftMeasures | null; win: DraftWin | null }
/** Whether every draft the window left out matched one it shows (else: the ones it shows are the best it found). */
type DraftNote = 'matched' | 'best';

interface Props {
  tournament: Tournament;
  orgSlug?: string;
  /** The org's plan: a club with a Venue library asks the club's check about the drafts. */
  planId?: OrgPlan | null;
  divisions: Division[];
  /** Division to open on; falls back to the first division. */
  defaultDivisionId?: string;
  /** The event's accepted teams. */
  teams: Team[];
  venues: Venue[];
  /** Every game of the event, every division (F69: their fields are taken). */
  existingGames: Game[];
  /** Divisions with a coin toss still owed: "Playoffs are set" waits for it. */
  tossOwedDivisionIds?: ReadonlySet<string>;
  onComplete: () => void;
  onCancel: () => void;
  /** A save refused because the bracket changed since the draft was made: reload the games (the window stays open). */
  onStale?: () => void;
}

/** What the window knows of a division: how many teams play (a playoffs-only event: its seed list), and its pools. */
const factsFor = (division: Division | undefined, divisionTeams: readonly Team[], playoffsOnly: boolean, teamCount: number): PlayoffDivisionFacts => ({
  teamCount,
  pools: (division?.pools ?? []).map(p => ({ id: p.id, name: p.name, teamCount: divisionTeams.filter(t => t.poolId === p.id).length })),
  playoffsOnly,
});

const minuteOf = (time: string) => { const [h, m] = time.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const pad = (n: number) => String(n).padStart(2, '0');

export default function PlayoffGenerator({
  tournament, orgSlug, planId, divisions, defaultDivisionId, teams, venues, existingGames, tossOwedDivisionIds, onComplete, onCancel, onStale,
}: Props) {
  const noun = fieldNounFor(tournament.sport);
  const nounPlural = `${noun}s`;
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const playoffsOnly = !hasRoundRobin(tournament);

  const [divisionId, setDivisionId] = useState(defaultDivisionId || divisions[0]?.id || '');
  const division = useMemo(() => divisions.find(d => d.id === divisionId) ?? divisions[0], [divisions, divisionId]);
  const divisionTeams = useMemo(() => teams.filter(t => t.divisionId === division?.id), [teams, division?.id]);

  // ── A playoffs-only event: the seeds, in the order the organizer sets (the Teams page's seed numbers to start) ──
  const bySeedNumber = (list: Team[]) => [...list].sort((a, b) =>
    (typeof a.seed === 'number' ? a.seed : Infinity) - (typeof b.seed === 'number' ? b.seed : Infinity) || (a.name || '').localeCompare(b.name || ''));
  const [seedIds, setSeedIds] = useState<string[]>(() => bySeedNumber(divisionTeams).map(t => t.id));
  const anySeedNumber = divisionTeams.some(t => typeof t.seed === 'number');

  const facts = useMemo(() => factsFor(division, divisionTeams, playoffsOnly, playoffsOnly ? seedIds.length : divisionTeams.length),
    [division, divisionTeams, playoffsOnly, seedIds.length]);

  const [settings, setSettingsState] = useState<PlayoffSettings>(() => settingsFromPlan(division?.playoffConfig, facts));
  const setSettings = (next: Partial<PlayoffSettings>) => setSettingsState(s => normalizeSettings({ ...s, ...next }, facts));

  const lengthOfDivision = (id: string) => gameLengthMinutes(undefined, divisions.find(d => d.id === id)?.settings?.game_duration_minutes, tournament.settings?.game_duration_minutes);
  const [gameLength, setGameLengthState] = useState(() => lengthOfDivision(divisionId));
  const gameLengthSet = useRef(false);
  const setGameLength = (minutes: number) => { gameLengthSet.current = true; setGameLengthState(minutes); };
  const [breakLength, setBreakLength] = useState(tournament.settings?.buffer_minutes ?? 15);
  const [rest, setRest] = useState(60);
  const [later, setLater] = useState(false);
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([{ date: tournament.endDate || tournament.startDate || '', startTime: '09:00', endTime: '20:30' }]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(venues.flatMap(getVenueResourceKeys)));
  const [temporaryCount, setTemporaryCount] = useState(2);
  const [finalOn, setFinalOn] = useState('any');

  const [options, setOptions] = useState<DraftOption[]>([]);
  const [draftNote, setDraftNote] = useState<DraftNote>('matched');
  const [chosenIndex, setChosenIndex] = useState(0);
  const [draftSet, setDraftSet] = useState(0);
  const [showGames, setShowGames] = useState(false);
  const [diagram, setDiagram] = useState(false);
  const [clubFindings, setClubFindings] = useState<Record<string, ClashFinding[]>>({});
  const [committing, setCommitting] = useState(false);
  const [askReplace, setAskReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseDivision(id: string) {
    const next = divisions.find(d => d.id === id);
    if (!next) return;
    const nextTeams = teams.filter(t => t.divisionId === id);
    const nextSeeds = bySeedNumber(nextTeams).map(t => t.id);
    const nextFacts = factsFor(next, nextTeams, playoffsOnly, playoffsOnly ? nextSeeds.length : nextTeams.length);
    setDivisionId(id);
    setSeedIds(nextSeeds);
    setSettingsState(settingsFromPlan(next.playoffConfig, nextFacts));
    if (!gameLengthSet.current) setGameLengthState(lengthOfDivision(id));
    setFinalOn('any');
    setError(null);
    reset();
  }

  // ── The division's games ──
  const divisionGames = useMemo(() => existingGames.filter(g => g.divisionId === division?.id), [existingGames, division?.id]);
  const playoffGames = useMemo(() => divisionGames.filter(g => g.isPlayoff), [divisionGames]);
  // A68: a save replaces only the playoff games still to play and not kept; a played game holds the bracket's shape.
  const replaceable = useMemo(() => playoffGames.filter(g => g.status === 'scheduled' && !g.generatorLocked), [playoffGames]);
  const playedCount = playoffGames.filter(g => PLAYED.has(g.status)).length;
  const held = playedCount > 0;

  // ── The bracket's games: a new bracket from the settings, or a held one's games still to play ──
  const brackets = useMemo(() => bracketsOf(settings, facts), [settings, facts]);
  const labelOfGroup = useMemo(() => new Map(brackets.map(b => [b.group ?? '', b.label])), [brackets]);
  const templateRows: DraftRow[] = useMemo(() => {
    const blank = { date: '', time: '', field: '', venueId: null, venueFacilityId: null, laneId: null, laneLabel: null };
    if (held) {
      // Every playoff game of the division places its level (a game still to play may wait on a played one).
      const all = levelInto(playoffGames.map(g => ({ id: g.id, group: g.bracketId ?? '', code: g.bracketCode ?? g.id, home: g.homePlaceholder ?? '', away: g.awayPlaceholder ?? '', level: 0 })));
      const levelOf = new Map(all.map(r => [r.id, r.level]));
      return replaceable.map(g => ({
        ...blank, group: g.bracketId ?? '', label: g.bracketLabel ?? null, code: g.bracketCode ?? g.id,
        home: g.homePlaceholder ?? '', away: g.awayPlaceholder ?? '', level: levelOf.get(g.id) ?? 1, bracketId: g.bracketId ?? null,
      }));
    }
    return templateOf(settings, facts).map(t => ({ ...blank, group: t.group, label: labelOfGroup.get(t.group ?? '') ?? null, code: t.code, home: t.home, away: t.away, level: t.level, bracketId: null }));
  }, [held, playoffGames, replaceable, settings, facts, labelOfGroup]);

  // ── When: the round robin's end, the chosen days ──
  const availableDates = useMemo(() => eventDates(tournament.startDate, tournament.endDate), [tournament.startDate, tournament.endDate]);
  const roundRobinTiming = useMemo(() => resolveGameTiming(division, tournament), [division, tournament]);
  const rrEnd = useMemo(() => getRoundRobinCompletion(divisionGames, roundRobinTiming.durationMinutes), [divisionGames, roundRobinTiming.durationMinutes]);
  const rrEndDay = rrEnd ? `${rrEnd.getFullYear()}-${pad(rrEnd.getMonth() + 1)}-${pad(rrEnd.getDate())}` : null;
  const rrEndMinute = rrEnd ? rrEnd.getHours() * 60 + rrEnd.getMinutes() : 0;
  const rrEndLabel = rrEnd && rrEndDay ? `${formatShortWeekdayDate(rrEndDay)}, ${formatTime(`${pad(rrEnd.getHours())}:${pad(rrEnd.getMinutes())}`)}` : null;

  // ── Where: the chosen fields; the other divisions' games on them (F69) ──
  const selectedResources = useMemo(() => selectedResourcesOf(venues, selectedKeys), [venues, selectedKeys]);
  const fieldName = fieldNameIn(venues);
  const { line: takenLine, divisions: othersOnDays } = takenOthersOf({ existingGames, divisionId: division?.id ?? '', dateSlots, selectedKeys, venues, divisions });
  const finalChoices = selectedResources.map(r => {
    const venue = venues.find(v => v.id === r.venueId);
    const facility = r.venueFacilityId ? venue?.facilities?.find(f => f.id === r.venueFacilityId) : null;
    return { key: r.key, name: facility?.name ?? venue?.name ?? r.label, venueId: r.venueId, venueFacilityId: r.venueFacilityId ?? null };
  });
  // P2: the final's field for one bracket only; a field taken off Where takes its choice with it.
  const finalField = !held && settings.shape === 'one' ? finalChoices.find(c => c.key === finalOn) ?? null : null;

  // ── The fit check (A65): the rounds laid into the chosen days ──
  const windows: FitWindow[] = later ? [] : dateSlots.flatMap(s => {
    if (!s.date || !s.startTime || !s.endTime) return [];
    if (rrEndDay && s.date < rrEndDay) return [];
    const start = rrEndDay === s.date ? Math.max(minuteOf(s.startTime), rrEndMinute) : minuteOf(s.startTime);
    return [{ date: s.date, startMinute: start, endMinute: minuteOf(s.endTime) }];
  });
  const lanes = selectedResources.length || temporaryCount;
  const fit = fitOf({ levels: templateRows.map(r => r.level), lanes, gameLength, turnover: breakLength, rest, windows });
  const singleFit = !held && !fit.fits && settings.shape !== 'tiers' && settings.format !== 'single'
    ? fitOf({ levels: templateOf({ ...settings, format: 'single' }, facts).map(r => r.level), lanes, gameLength, turnover: breakLength, rest, windows })
    : null;
  const fitDays = windows.length === 1 ? new Date(`${windows[0].date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' }) : windows.length;
  const fitWarning = !later && windows.length > 0 && templateRows.length > 0 && !fit.fits
    ? W.fit({ days: fitDays, depth: fit.depth, span: fit.spanMinutes, holds: fit.holdsMinutes, gameLength, rest, single: singleFit?.fits ? singleFit.spanMinutes : null })
    : null;

  // ── Generate: the draft engine places the bracket's games; only the drafts that differ are kept (A66) ──
  const keyOf = (group: string | null, code: string) => `${group ?? ''}::${code.toUpperCase()}`;
  function generate() {
    setError(null);
    if (!held) {
      if (facts.teamCount < 2) { setError(W.errors.twoTeams); return; }
      if (settings.shape === 'tiers') {
        const v = validateTierRanges(planOf(settings, facts).tierConfigs, facts.teamCount);
        if (!v.ok) { setError(v.error ?? ''); return; }
      }
    }
    if (templateRows.length === 0) { setError(W.errors.twoTeams); return; }
    if (later) {
      setOptions([{ rows: templateRows, measures: null, win: null }]);
      setChosenIndex(0);
      return;
    }
    if (dateSlots.some(s => !s.date)) { setError(W.errors.chooseDays); return; }
    const replacedIds = new Set(replaceable.map(g => g.id));
    const slots = slotsClearOfTakenGames(
      filterStartsAfterRoundRobinCompletion(draftDaySlots({ dateSlots, resources: selectedResources, gameLength, breakLength, temporaryCount }), rrEnd),
      {
        takenGames: existingGames.filter(g => !replacedIds.has(g.id)).map(toConflictGame),
        divisionId: division?.id ?? '',
        draftLengthMinutes: gameLength,
        divisions,
        tournament,
      },
    );
    if (slots.length < templateRows.length) { setError(W.errors.notEnoughSlots(templateRows.length, slots.length, noun)); return; }

    // A held bracket's played games stay where they are: the games after them wait for them.
    const fixed: ScheduleDraftAssignment<unknown>[] = held
      ? playoffGames.filter(g => !replacedIds.has(g.id) && g.status !== 'cancelled' && g.date && g.time).map(g => ({
        matchupId: keyOf(g.bracketId ?? '', g.bracketCode ?? g.id),
        homeParticipantId: `${g.bracketId ?? ''}::${g.homePlaceholder ?? g.homeTeamId ?? g.id}`,
        awayParticipantId: `${g.bracketId ?? ''}::${g.awayPlaceholder ?? g.awayTeamId ?? g.id}`,
        homeLabel: g.homePlaceholder ?? '', awayLabel: g.awayPlaceholder ?? '', payload: {},
        date: g.date, time: g.time, venueId: g.venueId ?? null, venueName: g.location ?? '', venueFacilityId: g.venueFacilityId ?? null,
        scheduleFacilityLaneId: g.scheduleFacilityLaneId ?? null, scheduleFacilityLaneLabel: g.scheduleFacilityLaneLabel ?? null, slotIndex: -1,
      }))
      : [];
    const known = new Set([...templateRows.map(r => keyOf(r.group, r.code)), ...fixed.map(f => f.matchupId!)]);
    const hold = finalField ? { venueId: finalField.venueId, venueFacilityId: finalField.venueFacilityId } : null;
    const matchups: ScheduleDraftMatchup<DraftRow>[] = templateRows.map(r => ({
      matchupId: keyOf(r.group, r.code),
      homeParticipantId: `${r.group ?? ''}::${r.home}`,
      awayParticipantId: `${r.group ?? ''}::${r.away}`,
      homeLabel: r.home,
      awayLabel: r.away,
      homeMetric: { placeholder: r.home },
      awayMetric: { placeholder: r.away },
      poolId: r.group,
      dependsOnMatchupIds: [r.home, r.away].map(feederCode).filter((c): c is string => !!c).map(c => keyOf(r.group, c)).filter(k => known.has(k)),
      dependencyMinRestMinutes: rest,
      onlyOn: hold && isFinalCode(r.code) ? hold : null,
      payload: r,
    }));
    const participants = [...new Set(matchups.flatMap(m => [m.homeParticipantId, m.awayParticipantId]))]
      .map(id => ({ id, label: id.split('::')[1] ?? id, divisionId: division?.id ?? '', status: 'accepted' }));
    const run = (ms: ScheduleDraftMatchup<DraftRow>[], count: number) => generateScoredScheduleDrafts({
      tournamentId: tournament.id, divisionId: division?.id ?? '', matchups: ms, slots, participants,
      gameDurationMinutes: gameLength, bufferMinutes: breakLength, priorities: playoffPriorities(rest), draftSeed: draftSet, fixedAssignments: fixed,
    }, count);
    const drafts = run(matchups, 24);
    if (drafts.length === 0) {
      // Was it the final's field? Without the hold, would a draft fit?
      if (hold && run(matchups.map(m => ({ ...m, onlyOn: null })), 1).length > 0) { setError(W.errors.finalField(finalField!.name)); return; }
      setError(W.errors.noDraft);
      return;
    }
    const mapped = drafts.map(d => d.assignments.map(a => ({
      ...a.payload,
      date: a.date,
      time: a.time,
      venueId: a.venueId ?? null,
      venueFacilityId: a.venueFacilityId ?? null,
      laneId: a.scheduleFacilityLaneId ?? null,
      laneLabel: a.scheduleFacilityLaneLabel ?? null,
      field: a.scheduleFacilityLaneLabel ?? fieldName({ venueId: a.venueId, venueFacilityId: a.venueFacilityId }),
    })));
    const measures = mapped.map(rows => draftMeasures(rows, gameLength));
    const { cards, matchedAll } = distinctDrafts(measures);
    setOptions(cards.map(c => ({ rows: mapped[c.index], measures: measures[c.index], win: c.win })));
    setDraftNote(matchedAll ? 'matched' : 'best');
    setChosenIndex(0);
    setDraftSet(n => n + 1);
    setShowGames(false);
    setDiagram(false);
    setClubFindings({});
  }

  function reset() {
    setOptions([]);
    setChosenIndex(0);
    setShowGames(false);
    setDiagram(false);
    setClubFindings({});
    setAskReplace(false);
  }

  // ── The club's other bookings under each draft's games (6a's check; amber, never a refusal) ──
  const canCheckClub = hasOrgVenueLibrary(planId ?? null);
  useEffect(() => {
    if (!canCheckClub || options.length === 0 || !options[0].measures) return;
    const games = options.flatMap((o, oi) => o.rows.map((r, gi) => ({
      key: `${draftSet}:${oi}:${gi}`, date: r.date, time: r.time, venueId: r.venueId, venueFacilityId: r.venueFacilityId, durationMinutes: gameLength,
    }))).filter(g => g.venueId && g.date && g.time);
    if (!games.length) return;
    let live = true;
    fetch(`/api/admin/tournaments/${encodeURIComponent(tournament.id)}/club-clashes${orgQuery}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ games }),
    })
      .then(r => (r.ok ? r.json() : { findings: {} }))
      .then((d: { findings?: Record<string, ClashFinding[]> }) => { if (live) setClubFindings(d.findings ?? {}); })
      .catch(() => { /* no line, never an error on the drafts */ });
    return () => { live = false; };
  }, [canCheckClub, options, draftSet, gameLength, tournament.id, orgQuery]);
  const clubLineOf = (oi: number, gi: number, r: DraftRow) => {
    const findings = clubFindings[`${draftSet}:${oi}:${gi}`];
    if (!findings?.length) return null;
    const venue = venues.find(v => v.id === r.venueId);
    return clashLineText(clashLine(findings, {
      sport: tournament.sport, venueName: venue?.name ?? '',
      facilityName: r.venueFacilityId ? venue?.facilities?.find(f => f.id === r.venueFacilityId)?.name ?? null : null,
      kinds: venue?.facilities?.map(f => f.facilityType),
    }));
  };
  const clubMeasure = (oi: number, o: DraftOption) => {
    const hits = o.rows.map((r, gi) => ({ r, gi })).filter(({ gi }) => clubFindings[`${draftSet}:${oi}:${gi}`]?.length);
    if (hits.length === 0) return <li className={gen.good}><Check size={13} aria-hidden /> {GW.measures.clubClear}</li>;
    const first = hits[0].r;
    const where = `${first.field}, ${formatShortWeekdayDate(first.date).split(',')[0]} ${formatTime(first.time)}`;
    return <li className={gen.amber}><AlertTriangle size={13} aria-hidden /> {hits.length === 1 ? GW.measures.clubOne(where) : GW.measures.clubMany(hits.length)}</li>;
  };

  // ── The plan these settings save, as the public pages read it (A63) ──
  const planWords = (s: PlayoffSettings) => {
    const bs = bracketsOf(s, facts);
    if (s.shape === 'tiers') {
      return W.plan.who({ shape: 'tiers', n: 0, teams: facts.teamCount, tiers: bs.map(b => ({ label: b.label ?? '', from: b.fromSeed, to: b.fromSeed + b.n - 1, how: W.plan.how(b.format, b.third && thirdPlaceOffered(b.format, [b.n])) })) });
    }
    const who = W.plan.who({ shape: s.shape, n: bs[0]?.n ?? 0, teams: facts.teamCount, pools: s.shape === 'pools' ? bs.map(b => ({ label: b.label ?? '', n: b.n })) : undefined });
    return `${who} · ${W.plan.how(s.format, s.third && thirdPlaceOffered(s.format, bs.map(b => b.n)))}`;
  };
  const savedPlan = hasPlayoffPlan(division?.playoffConfig) ? planWords(settingsFromPlan(division?.playoffConfig, facts)) : null;
  const newPlan = planWords(settings);

  // ── What saving does (the statement first, §294) ──
  const divisionName = division?.name ?? '';
  const published = division?.scheduleVisibility === 'published';
  const poolGames = divisionGames.filter(g => !g.isPlayoff);
  const roundRobinOver = poolGames.length > 0 && poolGames.every(g => g.status === 'completed' || g.status === 'forfeit');
  // P4: "Playoffs are set" goes when a published division's playoff teams are all known — the save says so when it will.
  const announces = published && !division?.playoffsAnnouncedAt && !tossOwedDivisionIds?.has(division?.id ?? '') && (playoffsOnly || roundRobinOver);
  const chosen = options[chosenIndex];
  const statement = later
    ? { ...W.statement.later(divisionName, templateRows.length, noun), bullets: [] as string[] }
    : held
      ? { ...W.statement.held(divisionName, replaceable.length, playedCount, noun), bullets: [] as string[] }
      : replaceable.length > 0
        ? W.statement.replaces(divisionName, replaceable.length, chosen?.rows.length ?? templateRows.length)
        : { ...W.statement.adds(divisionName, chosen?.rows.length ?? templateRows.length, published), bullets: [] as string[] };

  // ── Saving: one step (mig 327) ──
  // A playoffs-only event's seed, by the list on screen. Never for a HELD bracket: its list is hidden and rebuilt from
  // the Teams page's seed numbers, not the order saved — the server carries each re-placed game's own teams instead.
  const teamOfSeed = (ref: string) => {
    const m = ref.match(/^Seed #(\d+)$/);
    return playoffsOnly && !held && m ? seedIds[Number(m[1]) - 1] ?? null : null;
  };
  async function commit() {
    const rows = chosen?.rows ?? [];
    setCommitting(true);
    setError(null);
    try {
      // Temporary facilities ("Facility 2") become this division's lanes, by label.
      const labels = [...new Set(rows.filter(r => r.laneId?.startsWith('draft-facility-')).map(r => r.laneLabel ?? '').filter(Boolean))];
      const laneByLabel = new Map<string, string>();
      if (labels.length) {
        const res = await fetch(`/api/admin/schedule-facility-lanes${orgQuery}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ensure', tournamentId: tournament.id, divisionId: division?.id, labels }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(refusalReason(res.status, data.error, DRAFT_SAVE_FAILED.other));
        for (const lane of (data.lanes ?? []) as Array<{ id: string; label: string }>) laneByLabel.set(lane.label, lane.id);
      }
      // A new bracket: one bracket id per bracket (a pool's or a tier's own). A held one keeps its own (A68).
      const ids = new Map<string, string>();
      const idOf = (r: DraftRow) => {
        if (held) return r.bracketId;
        const k = r.group ?? '';
        if (!ids.has(k)) ids.set(k, crypto.randomUUID());
        return ids.get(k)!;
      };
      const games = rows.map(r => {
        const venue = venues.find(v => v.id === r.venueId);
        const facility = r.venueFacilityId ? venue?.facilities?.find(f => f.id === r.venueFacilityId) : null;
        const lane = r.laneId?.startsWith('draft-facility-') ? laneByLabel.get(r.laneLabel ?? '') ?? null : r.laneId;
        return {
          homeTeamId: teamOfSeed(r.home),
          awayTeamId: teamOfSeed(r.away),
          date: r.date || null,
          time: r.time || null,
          durationMinutes: gameLength,
          venueId: r.venueId || undefined,
          venueFacilityId: r.venueFacilityId || undefined,
          scheduleFacilityLaneId: lane || undefined,
          location: r.laneLabel ?? (venue ? formatVenueLocation(venue.name, facility?.name) : null),
          homePlaceholder: r.home,
          awayPlaceholder: r.away,
          bracketId: idOf(r),
          bracketCode: r.code,
          bracketLabel: held ? r.label : settings.shape === 'one' ? null : r.group,
        };
      });
      const res = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace-division-playoffs',
          tournamentId: tournament.id,
          divisionId: division?.id,
          games,
          replaceGameIds: replaceable.map(g => g.id),
          // A held bracket keeps the plan it was built from; a new one saves this one (A63).
          plan: held ? null : planOf(settings, facts),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The bracket this draft was made from is out of date: reload it, so the next Generate builds from what is there.
        if (data.code === 'schedule_changed' || data.code === 'shape_held') onStale?.();
        throw new Error(refusalReason(res.status, data.error, DRAFT_SAVE_FAILED.other));
      }
      onComplete();
    } catch (e: unknown) {
      // The draft stays on screen; the save is one transaction, so a refusal changed nothing.
      setError(e instanceof Error ? e.message : DRAFT_SAVE_FAILED.other);
    } finally {
      setCommitting(false);
      setAskReplace(false);
    }
  }

  // ════ Step 1 · settings ════
  const cross = crossesPools(settings, facts);
  const shapes = shapesFor(facts);
  const gets = getsOf(settings, facts);
  const getsWords = W.gets({ ...gets, shape: settings.shape });
  const formatSelect = (id: string, value: PlayoffFormat, onChange: (f: PlayoffFormat) => void, label?: string) => (
    <label className={ck.field}>
      <span className={ck.label}>{W.fields.format}</span>
      <select id={id} className={ck.select} value={value} onChange={e => onChange(e.target.value as PlayoffFormat)} aria-describedby={`${id}-hint`}
        aria-label={label ? `${W.fields.format}, ${label}` : undefined}>
        {(Object.keys(W.fields.formats) as PlayoffFormat[]).map(f => <option key={f} value={f}>{W.fields.formats[f]}</option>)}
      </select>
      <span id={`${id}-hint`} className={gen.hint}>{W.fields.formatHints[value]}</span>
    </label>
  );
  const updateTier = (i: number, next: Partial<PlayoffTierSetting>) => setSettings({ tiers: settings.tiers.map((t, j) => (j === i ? { ...t, ...next } : t)) });
  const addTier = () => {
    const last = settings.tiers[settings.tiers.length - 1];
    const used = new Set(settings.tiers.map(t => t.name));
    const name = TIER_NAMES.find(n => !used.has(n)) ?? `Tier ${settings.tiers.length + 1}`;
    setSettings({ tiers: [...settings.tiers, { name, toSeed: Math.min(facts.teamCount, (last?.toSeed ?? 0) + 2), format: 'single', third: false, reset: true }] });
  };
  const skipping = new Set(seedsSkippingFirstRound(seedIds.length, settings.format));
  const nameOfTeam = (id: string) => teams.find(t => t.id === id)?.name ?? '';
  const shuffle = () => {
    const next = [...seedIds];
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    setSeedIds(next);
  };

  const divisionField = (
    <label className={ck.field}>
      <span className={ck.label}>{W.fields.division}</span>
      <select className={ck.select} value={division?.id ?? ''} onChange={e => chooseDivision(e.target.value)}>
        {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </label>
  );
  const whoPlays: ReactNode = held ? (
    <section className={gen.section} aria-labelledby="pg-who">
      <h3 id="pg-who" className={gen.sectionTitle}>{W.sections.who}</h3>
      <div className={gen.pair2}>
        {divisionField}
      </div>
      <div className={pg.held}>
        <p><b>{W.held.lead}</b> {W.held.body(divisionName, playedCount, playoffGames.length, savedPlan)}</p>
        <p className={gen.hint}>{W.held.caption(replaceable.length, noun)}</p>
      </div>
    </section>
  ) : (
    <section className={gen.section} aria-labelledby="pg-who">
      <h3 id="pg-who" className={gen.sectionTitle}>{W.sections.who}</h3>
      <div className={gen.pair2}>
        {divisionField}
        <label className={ck.field}>
          <span className={ck.label}>{W.fields.brackets}</span>
          <select className={ck.select} value={settings.shape} onChange={e => setSettings({ shape: e.target.value as PlayoffShape })}>
            {shapes.map(s => <option key={s} value={s}>{W.fields.shapes[s]}</option>)}
          </select>
        </label>
      </div>
      {settings.shape === 'one' && !playoffsOnly && (
        <>
          <div className={gen.pair2}>
            <label className={ck.field}>
              <span className={ck.label}>{W.fields.advance}</span>
              <select className={ck.select} value={settings.top} onChange={e => setSettings({ top: Number(e.target.value) })} aria-describedby="pg-seeding-hint">
                {topChoices(settings, facts).map(n => <option key={n} value={n}>{W.fields.top(n, facts.teamCount)}</option>)}
              </select>
            </label>
            {facts.pools.length === 2 && (
              <label className={ck.field}>
                <span className={ck.label}>{W.fields.seeding}</span>
                <select className={ck.select} value={settings.seeding} onChange={e => setSettings({ seeding: e.target.value as PlayoffSettings['seeding'] })} aria-describedby="pg-seeding-hint">
                  <option value="cross">{W.fields.seedings.cross}</option>
                  <option value="standings">{W.fields.seedings.standings}</option>
                </select>
              </label>
            )}
          </div>
          <p id="pg-seeding-hint" className={gen.hint}>{W.seeding({ cross, n: settings.top, ...firstRoundOf(settings, facts), division: divisionName })}</p>
        </>
      )}
      {settings.shape === 'pools' && (
        <>
          <div className={gen.pair2}>
            {facts.pools.map(p => (
              <label key={p.id} className={ck.field}>
                <span className={ck.label}>{W.fields.fromPool(formatPoolName(p.name))}</span>
                <select className={ck.select} value={settings.perPool[p.id] ?? 2} onChange={e => setSettings({ perPool: { ...settings.perPool, [p.id]: Number(e.target.value) } })}>
                  {poolChoices(p).map(n => <option key={n} value={n}>{W.fields.top(n, p.teamCount)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className={gen.hint}>{W.poolsHint}</p>
        </>
      )}
      {settings.shape === 'tiers' && (
        <>
          {settings.tiers.map((t, i) => {
            const from = i === 0 ? 1 : settings.tiers[i - 1].toSeed + 1;
            return (
              <div key={i} className={pg.tierRow}>
                <label className={ck.field}>
                  <span className={ck.label}>{W.fields.tierName}</span>
                  <input className={ck.input} value={t.name} maxLength={40} onChange={e => updateTier(i, { name: e.target.value })} />
                </label>
                <label className={ck.field}>
                  <span className={ck.label}>{W.fields.seeds}</span>
                  <select className={ck.select} value={t.toSeed} onChange={e => updateTier(i, { toSeed: Number(e.target.value) })}>
                    {range(from + 1, Math.max(from + 1, facts.teamCount)).map(n => <option key={n} value={n}>{W.fields.seedRange(from, n)}</option>)}
                  </select>
                </label>
                <button type="button" className={gen.remove} disabled={settings.tiers.length <= 1} aria-label={W.fields.removeTier(t.name || W.fields.tierName)}
                  onClick={() => setSettings({ tiers: settings.tiers.filter((_, j) => j !== i) })}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            );
          })}
          {(settings.tiers[settings.tiers.length - 1]?.toSeed ?? 0) + 2 <= facts.teamCount && (
            <button type="button" className={gen.door} onClick={addTier}><Plus size={15} aria-hidden /> {W.fields.addTier}</button>
          )}
          <p className={gen.hint}>{W.tierCoverage(settings.tiers[settings.tiers.length - 1]?.toSeed ?? 0, facts.teamCount, playoffsOnly ? null : divisionName)}</p>
        </>
      )}
      {playoffsOnly && seedIds.length > 0 && (
        <>
          <div className={pg.seedHead}>
            <span className={ck.label}>{W.fields.seedList}</span>
            <span className={gen.headDoors}>
              {anySeedNumber && <button type="button" className={gen.door} onClick={() => setSeedIds(bySeedNumber(divisionTeams).map(t => t.id))}>{W.fields.bySeedNumber}</button>}
              <button type="button" className={gen.door} onClick={shuffle} disabled={seedIds.length < 2}>{W.fields.shuffle}</button>
            </span>
          </div>
          <ReorderList ids={seedIds} names={seedIds.map(nameOfTeam)} onMove={(from, to) => setSeedIds(arrayMove(seedIds, from, to))}
            overWindow position={i => W.fields.seedPlace(i + 1)}>
            <ol className={pg.seedList} aria-label={W.fields.seedList}>
              {seedIds.map((id, i) => (
                <ReorderRow key={id} id={id} number>
                  {({ handle, itemRef, itemStyle }) => (
                    <li ref={itemRef} style={itemStyle} className={pg.seedRow}>
                      {handle}
                      <span className={pg.seedName}>
                        {nameOfTeam(id)}
                        {settings.shape === 'one' && skipping.has(i + 1) && <span className={pg.seedSkips}>{W.fields.skipsFirstRound}</span>}
                      </span>
                    </li>
                  )}
                </ReorderRow>
              ))}
            </ol>
          </ReorderList>
          {anySeedNumber && <p className={gen.hint}>{W.fields.bySeedNumberHint}</p>}
        </>
      )}
    </section>
  );

  const howPlayed: ReactNode = held ? null : (
    <section className={gen.section} aria-labelledby="pg-how">
      <h3 id="pg-how" className={gen.sectionTitle}>{W.sections.how}</h3>
      {settings.shape === 'tiers' ? brackets.map((b, i) => (
        <div key={i} className={pg.tierBlock}>
          <p className={pg.tierName}>{b.label} <small>{W.fields.seedRange(b.fromSeed, b.fromSeed + b.n - 1).toLowerCase()}</small></p>
          {formatSelect(`pg-tier-format-${i}`, settings.tiers[i].format, f => updateTier(i, { format: f }), b.label ?? undefined)}
          {thirdPlaceOffered(settings.tiers[i].format, [b.n]) && (
            <CheckChoice checked={settings.tiers[i].third} onChange={v => updateTier(i, { third: v })} title={W.fields.third} caption={W.fields.thirdCaption} />
          )}
          {settings.tiers[i].format === 'double' && (
            <CheckChoice checked={settings.tiers[i].reset} onChange={v => updateTier(i, { reset: v })} title={W.fields.reset} caption={W.fields.resetCaption} />
          )}
        </div>
      )) : (
        <>
          {formatSelect('pg-format', settings.format, f => setSettings({ format: f }))}
          {thirdPlaceOffered(settings.format, brackets.map(b => b.n)) && (
            <CheckChoice checked={settings.third} onChange={v => setSettings({ third: v })}
              title={settings.shape === 'pools' ? W.fields.thirdInEach : W.fields.third} caption={W.fields.thirdCaption} />
          )}
          {settings.format === 'double' && (
            <CheckChoice checked={settings.reset} onChange={v => setSettings({ reset: v })} title={W.fields.reset} caption={W.fields.resetCaption} />
          )}
        </>
      )}
      <p className={pg.gets}>{getsWords.lead && <b>{getsWords.lead}</b>}{getsWords.rest}</p>
    </section>
  );

  const settingsBody = (
    <div className={gen.settings}>
      {whoPlays}
      {howPlayed}
      <WhenSection
        idPrefix="pg"
        dateSlots={dateSlots}
        availableDates={availableDates}
        onAdd={() => setDateSlots(ds => [...ds, { date: availableDates.find(d => !ds.some(s => s.date === d)) ?? availableDates[0] ?? '', startTime: '09:00', endTime: '20:30' }])}
        onRemove={idx => setDateSlots(ds => (ds.length <= 1 ? ds : ds.filter((_, i) => i !== idx)))}
        onUpdate={(idx, u) => setDateSlots(ds => ds.map((s, i) => (i === idx ? { ...s, ...u } : s)))}
        gameLength={gameLength}
        onGameLength={setGameLength}
        breakLength={breakLength}
        onBreakLength={setBreakLength}
        noun={noun}
        collapsed={later}
        first={<CheckChoice checked={later} onChange={setLater} title={W.fields.later(nounPlural)} caption={W.fields.laterCaption(noun)} />}
        dayHint={rrEndLabel ? W.fields.roundRobinEnds(divisionName, rrEndLabel) : undefined}
      />
      {!later && (
        <WhereSection
          idPrefix="pg"
          venues={venues}
          selectedKeys={selectedKeys}
          onToggle={key => setSelectedKeys(cur => { const next = new Set(cur); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
          onToggleVenue={venue => setSelectedKeys(cur => {
            const keys = getVenueResourceKeys(venue);
            const all = keys.every(k => cur.has(k));
            const next = new Set(cur);
            keys.forEach(k => (all ? next.delete(k) : next.add(k)));
            return next;
          })}
          onAll={() => setSelectedKeys(new Set(venues.flatMap(getVenueResourceKeys)))}
          onNone={() => setSelectedKeys(new Set())}
          takenLine={takenLine}
          temporaryCount={temporaryCount}
          onTemporaryCount={setTemporaryCount}
        >
          {!held && settings.shape === 'one' && finalChoices.length > 0 && (
            <label className={ck.field}>
              <span className={ck.label}>{W.fields.finalOn}</span>
              <select className={ck.select} value={finalField?.key ?? 'any'} onChange={e => setFinalOn(e.target.value)} aria-describedby="pg-final-hint">
                <option value="any">{W.fields.finalAny}</option>
                {finalChoices.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
              <span id="pg-final-hint" className={gen.hint}>{W.fields.finalOnHint}</span>
            </label>
          )}
        </WhereSection>
      )}
      {!later && (
        <section className={gen.section} aria-labelledby="pg-rules">
          <h3 id="pg-rules" className={gen.sectionTitle}>{W.sections.rules}</h3>
          <label className={ck.field}>
            <span className={ck.label}>{W.fields.rest}</span>
            <select className={ck.select} value={rest} onChange={e => setRest(Number(e.target.value))} aria-describedby="pg-rest-hint">
              {withCurrent([0, 15, 30, 45, 60, 75, 90, 120, 150, 180], rest).map(n => <option key={n} value={n}>{GW.fields.minutes(n)}</option>)}
            </select>
            <span id="pg-rest-hint" className={gen.hint}>{W.fields.restHint}</span>
          </label>
        </section>
      )}
      {error && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{error}</Callout>}
    </div>
  );

  // ════ Step 2 · drafts ════
  const timed = !!chosen?.measures;
  const days = new Set((chosen?.rows ?? []).map(r => r.date).filter(Boolean));
  const lastEndWords = (m: PlayoffDraftMeasures) => (m.lastEnd ? (days.size > 1 ? bracketWhen(m.lastEnd.date, m.lastEnd.time) : formatTime(m.lastEnd.time)) : '');
  const showFinalRest = options.some(o => o.measures && o.measures.restBeforeFinal != null && o.measures.restBeforeFinal !== o.measures.shortestRest);
  const showDayLoad = options.some(o => (o.measures?.maxGamesInDay ?? 0) >= 3);
  const measureLines = (o: DraftOption) => {
    const m = o.measures;
    if (!m) return [];
    const lines: Array<{ key: string; node: ReactNode; win?: DraftWin }> = [];
    if (othersOnDays.length > 0) lines.push({ key: 'clash', node: <><Check size={13} aria-hidden /> {GW.measures.noClashes(GW.others(othersOnDays))}</> });
    if (m.shortestRest != null) lines.push({ key: 'rest', node: W.measures.shortestRest(durationWords(m.shortestRest)), win: 'rest' });
    if (showFinalRest && m.restBeforeFinal != null) lines.push({ key: 'finalRest', node: W.measures.restBeforeFinal(durationWords(m.restBeforeFinal)), win: 'finalRest' });
    if (m.lastEnd) lines.push({ key: 'earliest', node: W.measures.lastEnds(lastEndWords(m)), win: 'earliest' });
    if (m.final) lines.push({ key: 'final', node: W.measures.final(bracketWhen(m.final.date, m.final.time), m.final.field) });
    if (showDayLoad) lines.push({ key: 'lightDays', node: W.measures.gamesInDay(m.maxGamesInDay), win: 'lightDays' });
    return lines;
  };
  const oneDraft = options.length === 1;
  const bands = (() => {
    const rows = (chosen?.rows ?? []).map((r, gi) => ({ r, gi }));
    const byLevel = new Map<number, typeof rows>();
    for (const x of rows) byLevel.set(x.r.level, [...(byLevel.get(x.r.level) ?? []), x]);
    return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, list]) => {
      const sorted = [...list].sort((a, b) => (a.r.date || '').localeCompare(b.r.date || '') || (a.r.time || '').localeCompare(b.r.time || '') || a.r.code.localeCompare(b.r.code));
      const rounds = new Map<string, number>();
      for (const { r } of sorted) { const round = bracketRoundLabel(r.code); rounds.set(round, (rounds.get(round) ?? 0) + 1); }
      return { level, list: sorted, title: W.band([...rounds.entries()]) };
    });
  })();
  const sideWords = (ref: string) => {
    const team = teamOfSeed(ref);
    return team ? nameOfTeam(team) : slotWords(ref);
  };
  const groups = [...new Set((chosen?.rows ?? []).map(r => r.group ?? ''))];
  // Show as diagram only when a game feeds another: a lone final (or one per tier) is the same card as its row.
  const hasDiagram = bracketHasFeeds((chosen?.rows ?? []).map(r => ({ bracketCode: r.code, homePlaceholder: r.home, awayPlaceholder: r.away })));
  const draftsBody = (
    <div className={`${gen.drafts}${oneDraft ? ` ${gen.draftsOne}` : ''}`}>
      {!oneDraft && (
        <div className={gen.cards} role="group" aria-label={GW.draftsLabel}>
          {options.map((o, oi) => (
            <button key={oi} type="button" className={gen.card} aria-pressed={chosenIndex === oi} onClick={() => setChosenIndex(oi)}>
              <span className={gen.cardHead}><b>{o.win ? W.cards[o.win] : GW.cards.other(oi + 1)}</b></span>
              <ul className={gen.measures}>
                {measureLines(o).map(l => <li key={l.key} className={l.key === 'clash' ? gen.good : l.win && l.win === o.win ? pg.cardWin : undefined}>{l.node}</li>)}
                {canCheckClub && clubMeasure(oi, o)}
              </ul>
            </button>
          ))}
          {options.length < 3 && <p className={gen.cardsNote}>{draftNote === 'matched' ? GW.onlyNDiffer(options.length) : W.noneBetter}</p>}
        </div>
      )}
      <div className={gen.chosen}>
        <div className={gen.statement}>
          <b>{statement.lead}</b>{statement.rest}
          {statement.bullets.length > 0 && <ul>{statement.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
          {!held && newPlan !== savedPlan && (
            <p className={pg.planLine}>
              {savedPlan == null
                ? <>{W.plan.saves(divisionName)}<b>{newPlan}</b>.</>
                : <>{W.plan.changes(divisionName)}<b>{savedPlan}</b>{W.plan.changesTo}<b>{newPlan}</b>{W.plan.changesEnd}</>}
            </p>
          )}
          {announces && <p className={pg.planLine}>{playoffsOnly ? W.statement.announcesSeeded(divisionName) : W.statement.announces(divisionName)}</p>}
        </div>
        {oneDraft && timed && chosen?.measures && (
          <>
            <ul className={gen.oneLine}>
              {measureLines(chosen).map(l => (
                <li key={l.key} className={l.key === 'clash' ? gen.good : undefined}>
                  {l.key === 'final' && chosen.measures?.final ? W.measures.finalOn(bracketWhen(chosen.measures.final.date, chosen.measures.final.time), chosen.measures.final.field) : l.node}
                </li>
              ))}
              {canCheckClub && clubMeasure(0, chosen)}
            </ul>
            <p className={gen.cardsNote}>{draftNote === 'matched' ? GW.oneDraft : W.noneBetter}</p>
          </>
        )}
        {error && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{error}</Callout>}
        {chosen && chosen.rows.length > 0 && (
          <button type="button" className={gen.seeGames} aria-expanded={showGames} onClick={() => setShowGames(v => !v)}>
            {showGames ? GW.hideGames : GW.seeGames(chosen.rows.length)}<ChevronRight size={16} aria-hidden />
          </button>
        )}
        {chosen && chosen.rows.length > 0 && (
          <div className={gen.games} data-open={showGames || undefined}>
            {hasDiagram && (
              <div className={pg.viewLine}>
                <button type="button" className={gen.door} aria-pressed={diagram} onClick={() => setDiagram(v => !v)}>{diagram ? BW.showList : BW.showDiagram}</button>
              </div>
            )}
            {diagram && hasDiagram ? (
              <div className={pg.diagram}>
                {groups.map(group => {
                  const rows = chosen.rows.filter(r => (r.group ?? '') === group);
                  return (
                    <div key={group} className={pg.diagramGroup}>
                      {groups.length > 1 && <p className={pg.diagramTitle}>{rows[0]?.label ?? group}</p>}
                      <BracketColumns columns={buildBracketColumns(rows.map((r, i) => ({
                        id: `${group}:${r.code}:${i}`, bracketCode: r.code, homePlaceholder: teamOfSeed(r.home) ? nameOfTeam(teamOfSeed(r.home)!) : r.home,
                        awayPlaceholder: teamOfSeed(r.away) ? nameOfTeam(teamOfSeed(r.away)!) : r.away, date: r.date, time: r.time, location: r.field,
                      })))} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <ClubRowFrame>
                {bands.map(band => (
                  <ClubRowList key={band.level} inset label={band.title}>
                    <ClubRowBand count={SW.bandCount(band.list.length)}>{band.title}</ClubRowBand>
                    {band.list.map(({ r, gi }) => {
                      const club = clubLineOf(chosenIndex, gi, r);
                      const caption = [r.field, r.label, bracketGameLabel(r.code)].filter(Boolean).join(' · ');
                      return (
                        <ClubRow
                          key={gi}
                          lead={r.date && r.time ? bracketWhen(r.date, r.time) : W.noTimeYet}
                          captionFirst
                          title={<GameTeams teams={teams} scored={false}
                            g={{ awayTeamId: teamOfSeed(r.away) ?? undefined, homeTeamId: teamOfSeed(r.home) ?? undefined, awayPlaceholder: sideWords(r.away), homePlaceholder: sideWords(r.home) } as Omit<Game, 'id'>} />}
                          caption={<>{caption}{club && <span className={gen.clubLine}><AlertTriangle size={13} aria-hidden /> {club}</span>}</>}
                        />
                      );
                    })}
                  </ClubRowList>
                ))}
              </ClubRowFrame>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ════ The window ════
  const step: 'settings' | 'drafts' = options.length > 0 ? 'drafts' : 'settings';
  const teamsKnown = replaceable.some(g => g.homeTeamId || g.awayTeamId);
  const footNote = playoffGames.length > 0 ? W.footNote.has(divisionName, playoffGames.length, playedCount) : W.footNote.none(divisionName);
  return (
    <>
      <KitDialog
        kind="form"
        wide
        title={W.title}
        identity={<span>{step === 'settings' ? W.caption.settings(tournament.name) : W.caption.drafts(tournament.name, divisionName)}</span>}
        onClose={onCancel}
        busy={committing}
        back={step === 'drafts' ? { label: GW.settings, onBack: reset } : undefined}
        levelKey={step}
        footerStart={step === 'settings'
          ? (fitWarning
            ? <span className={pg.fitWarn} role="status"><AlertTriangle size={16} aria-hidden /><span><b>{fitWarning.lead}</b>{fitWarning.rest}</span></span>
            : <span className={gen.footNote}>{footNote}</span>)
          : undefined}
        footer={step === 'settings' ? (
          <button type="button" className="btn btn-lime" onClick={generate}>{GW.generate}</button>
        ) : (
          <>
            <button type="button" className={screenParts.plainButton} onClick={reset} disabled={committing}>{GW.backToSettings}</button>
            <button type="button" className="btn btn-lime" disabled={committing || !chosen}
              onClick={() => (replaceable.length > 0 ? setAskReplace(true) : void commit())}>
              {replaceable.length > 0 ? W.saveReplace(replaceable.length) : W.save}
            </button>
          </>
        )}
      >
        {step === 'settings' ? settingsBody : draftsBody}
      </KitDialog>

      {askReplace && (
        <KitDialog
          kind="question"
          title={W.replace.title(replaceable.length)}
          onClose={() => setAskReplace(false)}
          busy={committing}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAskReplace(false)} disabled={committing}>{W.replace.back}</button>
              <button type="button" className="btn btn-lime" onClick={() => void commit()} disabled={committing}>{W.replace.go(replaceable.length)}</button>
            </>
          )}
        >
          <p>{published ? (teamsKnown ? W.replace.publishedTeams(divisionName) : W.replace.publishedNoTeams(divisionName)) : W.replace.unpublished(divisionName)}</p>
        </KitDialog>
      )}
    </>
  );
}
