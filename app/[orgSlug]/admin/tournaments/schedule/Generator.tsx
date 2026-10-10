'use client';
/**
 * THE ROUND-ROBIN GENERATOR — Tournament admin redesign Stage 3, S3 (A34, A40; ruled 2026-10-09, as drawn). One name on
 * every door (A34 as amended), and two steps on the kit's form window (KitDialog — full screen with ← on a phone,
 * the wide form at a desk):
 *
 *   1. SETTINGS — What it pairs · When · Where · Rules: today's content under plain headings. The other divisions'
 *      saved games are drawn as taken (the defects pass made the drafts leave them free, F69); the game length is
 *      saved on every game it makes (A39).
 *   2. DRAFTS — three ranked cards that name what decides between them (clashes with the other divisions, back-to-
 *      backs, field moves, the shortest rest, and the games landing on another of the club's bookings: 6a's amber,
 *      which warns and never refuses); the chosen draft's games by day; ONE statement of what saving does; the lime
 *      that says it. A replace asks once, and its teams ARE told (the route records it: moves, cancellations).
 *
 * Its logic is the defects pass's, kept: a draft replaces only games still to play and not kept, in one transaction
 * (mig 320). The frame is tagged for Club Stage 11's scheduler (A40); nothing here is shared yet.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { gameLengthMinutes } from '@/lib/booking-length';
import { AlertTriangle, Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Team, Division, Venue, Game, Tournament, type OrgPlan } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { buildScheduleMetrics, resolveManualTravelBuffers } from '@/lib/schedule-metrics';
import { slotsClearOfTakenGames, toConflictGame } from '@/lib/schedule-conflict';
import { DRAFT_SAVE_FAILED, GENERATOR_WORDS as GW, SCHEDULE_DAY_WORDS as SW, draftStatement, refusalReason } from '@/lib/schedule-words';
import { fieldNounFor } from '@/lib/sports';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { clashLine, clashLineText } from '@/lib/venue-clash-words';
import type { ClashFinding } from '@/lib/venue-clash';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, ClubRow, ClubRowBand, ClubRowFrame, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { CheckChoice, screenParts } from '@/components/admin/tournament/ScreenParts';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  defaultSchedulePriorities,
  generateScoredScheduleDrafts,
  type ScoredScheduleDraft,
  type ScheduleDraftAssignment,
  type ScheduleDraftMatchup,
  type ScheduleDraftParticipant,
  type ScheduleDraftSlot,
  type SchedulePrioritySettings,
} from '@/lib/schedule-generator';
import gen from './Generator.module.css';

interface DateSlot {
  date: string;
  startTime: string;
  endTime: string;
}

// Extends Game with slot metadata so commit() can resolve real slot IDs after ensure
interface SlotGame extends Omit<Game, 'id'> {
  homePoolId?: string | null;
  homeSlotNumber: number;
  awayPoolId?: string | null;
  awaySlotNumber: number;
}

interface SlotPayload {
  homePoolId?: string | null;
  homeSlotNum: number;
  awayPoolId?: string | null;
  awaySlotNum: number;
}

interface DraftOptimizationSummary {
  score: number;
  healthScore: number;
  candidateCount: number;
}

interface DraftOption {
  id: string;
  label: string;
  summary: DraftOptimizationSummary;
  /** What decides between the drafts, in their cards' words (S3). */
  metrics: { backToBacks: number; moves: number; minRest: number | null };
  games: Omit<Game, 'id'>[];
  slotGames: SlotGame[];
  gamesToCommit: Omit<Game, 'id'>[];
  slotGamesToCommit: SlotGame[];
}

type SchedulePresetId = 'balanced' | 'rest' | 'compact' | 'facility' | 'early' | 'custom';

interface SchedulePreset {
  id: Exclude<SchedulePresetId, 'custom'>;
  label: string;
  description: string;
  settings: SchedulePrioritySettings;
}

type PoolSlotEnsureRow = { poolId: string; slotNumber: number; id: string; displayName: string };
type FacilityLaneEnsureRow = { id: string; label: string };

interface ScheduleResource {
  key: string;
  venueId: string;
  venueName: string;
  venueFacilityId?: string | null;
  label: string;
}

interface PartialGenerationContext {
  preservedGames: Game[];
  /** The kept games that have a day and a time — the only ones that can hold a slot or be drawn in the preview. */
  placedPreservedGames: Game[];
  replaceableGames: Game[];
  fixedAssignments: ScheduleDraftAssignment<unknown>[];
}

const DIVISION_SLOT_POOL_ID = '__division__';
const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Default fairness across rest, facility moves, daily load, and time slots.',
    settings: defaultSchedulePriorities(),
  },
  {
    id: 'rest',
    label: 'Rest-friendly',
    description: 'Prioritizes longer breaks and avoids back-to-back games where possible.',
    settings: {
      candidateCount: 40,
      maxGamesPerDay: 2,
      minRestMinutes: 90,
      avoidBackToBack: true,
      reduceVenueChanges: false,
      balanceTimeSlots: true,
    },
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Allows tighter days and shorter rest to finish the schedule faster.',
    settings: {
      candidateCount: 12,
      maxGamesPerDay: 4,
      minRestMinutes: 15,
      avoidBackToBack: false,
      reduceVenueChanges: true,
      balanceTimeSlots: false,
    },
  },
  {
    id: 'facility',
    label: 'Facility-friendly',
    description: 'Scores drafts higher when teams stay on the same selected facility.',
    settings: {
      candidateCount: 40,
      maxGamesPerDay: 3,
      minRestMinutes: 45,
      avoidBackToBack: true,
      reduceVenueChanges: true,
      balanceTimeSlots: false,
    },
  },
  {
    id: 'early',
    label: 'Younger earlier',
    description: 'Favors earlier available slots instead of spreading early and late games evenly.',
    settings: {
      candidateCount: 24,
      maxGamesPerDay: 2,
      minRestMinutes: 60,
      avoidBackToBack: true,
      reduceVenueChanges: true,
      balanceTimeSlots: false,
    },
  },
];

function venueResourceKey(venueId: string) {
  return `venue:${venueId}`;
}

function facilityResourceKey(facilityId: string) {
  return `facility:${facilityId}`;
}

function getVenueResourceKeys(venue: Venue): string[] {
  return venue.facilities?.length
    ? venue.facilities.map(facility => facilityResourceKey(facility.id))
    : [venueResourceKey(venue.id)];
}

interface GeneratorProps {
  tournament: Tournament;
  orgSlug?: string;
  /** The org's plan: a club with a Venue library asks the club's check about the drafts. */
  planId?: OrgPlan | null;
  divisions: Division[];
  /** Division to open on; falls back to the first division. */
  defaultDivisionId?: string;
  teams: Team[];
  venues: Venue[];
  existingGames?: Game[];
  onComplete: () => void;
  onCancel: () => void;
  /** A save refused because the schedule changed since the draft was made: reload the games (the window stays open). */
  onStale?: () => void;
}

export default function ScheduleGenerator({ tournament, orgSlug, planId, divisions, defaultDivisionId, teams, venues, existingGames = [], onComplete, onCancel, onStale }: GeneratorProps) {
  const noun = fieldNounFor(tournament.sport);
  const [showGames, setShowGames] = useState(false);
  // The draft games that land on another of the club's bookings, by the draft game's key (6a's check; amber).
  const [clubFindings, setClubFindings] = useState<Record<string, ClashFinding[]>>({});
  const [selectedGroupId, setSelectedGroupId] = useState(defaultDivisionId || divisions[0]?.id || '');
  // Initialize from tournament settings so generator matches event-level defaults.
  // The length box starts at the chosen division's length by THE chain (A39: the division's, else the tournament's,
  // else the one booking length) and follows the division until the organizer sets one. Every game the generator saves
  // carries this length (`saveDraftInOneStep`), so the board, the clash check and the club calendar read the length the
  // drafts were spaced by.
  const lengthOfDivision = (id: string) => gameLengthMinutes(undefined, divisions.find(d => d.id === id)?.settings?.game_duration_minutes, tournament.settings?.game_duration_minutes);
  const [gameLength, setGameLengthState] = useState(() => lengthOfDivision(selectedGroupId));
  const gameLengthSet = useRef(false);
  const setGameLength = (minutes: number) => { gameLengthSet.current = true; setGameLengthState(minutes); };
  const chooseDivision = (id: string) => {
    setSelectedGroupId(id);
    if (!gameLengthSet.current) setGameLengthState(lengthOfDivision(id));
  };
  const [breakLength, setBreakLength] = useState(tournament.settings?.buffer_minutes ?? 15);
  const [gamesPerTeam, setGamesPerTeam] = useState(3);
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<Set<string>>(
    () => new Set(venues.flatMap(getVenueResourceKeys)),
  );
  const [temporaryFacilityCount, setTemporaryFacilityCount] = useState(2);
  // Seed the per-day cap from the organizer's saved Schedule Health rule so generating
  // and grading share one definition of "healthy" (only maxGamesPerDay is unified — the
  // generator's minRestMinutes is a target, not the health back-to-back threshold).
  const [priorities, setPriorities] = useState<SchedulePrioritySettings>(() => {
    const base = defaultSchedulePriorities();
    const savedMaxPerDay = tournament.settings?.schedule_health_rules?.maxGamesPerDay;
    return savedMaxPerDay && savedMaxPerDay !== base.maxGamesPerDay
      ? { ...base, maxGamesPerDay: savedMaxPerDay }
      : base;
  });
  const [selectedPresetId, setSelectedPresetId] = useState<SchedulePresetId>(() => {
    const savedMaxPerDay = tournament.settings?.schedule_health_rules?.maxGamesPerDay;
    // Start in Custom when the saved max/day diverges from the Balanced default.
    return savedMaxPerDay && savedMaxPerDay !== defaultSchedulePriorities().maxGamesPerDay ? 'custom' : 'balanced';
  });
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: tournament.startDate || '', startTime: '09:00', endTime: '20:30' }
  ]);

  const [generationMode, setGenerationMode] = useState<'team' | 'slot'>('team');
  const [slotCountOverride, setSlotCountOverride] = useState<Record<string, number>>({});

  const [generatedGames, setGeneratedGames] = useState<Omit<Game, 'id'>[]>([]);
  const [generatedSlotGames, setGeneratedSlotGames] = useState<SlotGame[]>([]);
  const [gamesToCommit, setGamesToCommit] = useState<Omit<Game, 'id'>[]>([]);
  const [slotGamesToCommit, setSlotGamesToCommit] = useState<SlotGame[]>([]);
  const [replaceableGameIds, setReplaceableGameIds] = useState<string[]>([]);
  const [replacementGameCount, setReplacementGameCount] = useState(0);
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([]);
  const [selectedDraftOptionIndex, setSelectedDraftOptionIndex] = useState(0);
  const [draftSetIndex, setDraftSetIndex] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [askReplace, setAskReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPreview = generatedGames.length > 0 || generatedSlotGames.length > 0;
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';

  const availableDates = useMemo(() => {
    if (!tournament.startDate || !tournament.endDate) return [];
    const start = new Date(tournament.startDate + 'T12:00:00');
    const end = new Date(tournament.endDate + 'T12:00:00');
    const dates = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [tournament.startDate, tournament.endDate]);

  const currentGroup = useMemo(() => divisions.find(g => g.id === selectedGroupId), [divisions, selectedGroupId]);
  const poolList = useMemo(() => (currentGroup?.pools?.length || 0) >= 1 ? currentGroup!.pools! : [], [currentGroup]);
  const currentDivisionExistingGames = useMemo(
    () => existingGames.filter(game => game.divisionId === selectedGroupId),
    [existingGames, selectedGroupId],
  );
  // F70 (Stage 3 defects pass): a draft replaces ONLY these — round robin, still to play, not kept — and keeps every
  // other game of the division. This was "Build from current"; the "Replace all" choice beside it (the default, which
  // deleted played games and their scores) is gone. The server holds the same rule (lib/game-delete-policy.ts and the
  // one-step save, mig 320).
  const replaceableExistingGames = useMemo(
    () => currentDivisionExistingGames.filter(game => !game.isPlayoff && game.status === 'scheduled' && !game.generatorLocked),
    [currentDivisionExistingGames],
  );
  const preservedExistingGames = useMemo(
    () => currentDivisionExistingGames.filter(game => game.isPlayoff || game.status !== 'scheduled' || game.generatorLocked),
    [currentDivisionExistingGames],
  );
  const hasExistingGames = currentDivisionExistingGames.length > 0;
  // F69: every game the save will KEEP, in any division, holds its surface for its length — a draft is offered only
  // the slots left. Only the games this save replaces are left out.
  const takenGames = useMemo(() => {
    const replaced = new Set(replaceableExistingGames.map(game => game.id));
    return existingGames.filter(game => !replaced.has(game.id)).map(game => {
      const taken = toConflictGame(game);
      // This division's temporary facilities ("Facility 2") ARE the draft's: saving ensures the draft's lane by its
      // label, per division. A kept game on Facility 2 holds the draft's Facility 2 — matched by label, since the saved
      // lane's id never equals a draft lane's. (Another division's Facility 2 is its own lane.)
      const draftLane = game.divisionId === selectedGroupId && game.scheduleFacilityLaneId && !game.venueId && !game.venueFacilityId
        ? draftFacilityLaneIdForLabel(game.scheduleFacilityLaneLabel ?? game.location)
        : null;
      return draftLane ? { ...taken, scheduleFacilityLaneId: draftLane } : taken;
    });
  }, [existingGames, replaceableExistingGames, selectedGroupId]);
  const selectedResources = useMemo(() => {
    const resources: ScheduleResource[] = [];
    for (const venue of venues) {
      if (venue.facilities?.length) {
        for (const facility of venue.facilities) {
          const key = facilityResourceKey(facility.id);
          if (!selectedResourceKeys.has(key)) continue;
          resources.push({
            key,
            venueId: venue.id,
            venueName: venue.name,
            venueFacilityId: facility.id,
            label: `${venue.name} - ${facility.name}`,
          });
        }
      } else {
        const key = venueResourceKey(venue.id);
        if (!selectedResourceKeys.has(key)) continue;
        resources.push({
          key,
          venueId: venue.id,
          venueName: venue.name,
          venueFacilityId: null,
          label: venue.name,
        });
      }
    }
    return resources;
  }, [venues, selectedResourceKeys]);
  const selectedResourceCount = selectedResources.length;
  const selectedPreset = SCHEDULE_PRESETS.find(preset => preset.id === selectedPresetId);
  const presetDescription = selectedPreset?.description ?? '';
  const manualTravelBuffers = useMemo(() => resolveManualTravelBuffers({}, tournament), [tournament]);

  function defaultSlotCount(poolId: string): number {
    if (slotCountOverride[poolId] !== undefined) return slotCountOverride[poolId];
    if (poolId === DIVISION_SLOT_POOL_ID) {
      const acceptedTeamCount = teams.filter(team => team.divisionId === selectedGroupId).length;
      return acceptedTeamCount || currentGroup?.capacity || 4;
    }
    const cap = currentGroup?.capacity || 0;
    const count = poolList.length || 1;
    return Math.floor(cap / count) || 4;
  }

  function addDateSlot() {
    let nextDate = '';
    if (availableDates.length > 0) {
      nextDate = availableDates.find(d => !dateSlots.some(s => s.date === d)) || availableDates[0];
    }
    setDateSlots([...dateSlots, { date: nextDate, startTime: '09:00', endTime: '20:30' }]);
  }

  function removeDateSlot(idx: number) {
    if (dateSlots.length <= 1) return;
    setDateSlots(dateSlots.filter((_, i) => i !== idx));
  }

  function updateDateSlot(idx: number, updates: Partial<DateSlot>) {
    const next = [...dateSlots];
    next[idx] = { ...next[idx], ...updates };
    setDateSlots(next);
  }

  function buildTimeSlots(resourceList: ScheduleResource[]): ScheduleDraftSlot[] {
    const totalSlots: ScheduleDraftSlot[] = [];
    const sortedDates = [...dateSlots].sort((a, b) => a.date.localeCompare(b.date));
    const roundTo5 = (d: Date) => { const ms = 1000 * 60 * 5; return new Date(Math.ceil(d.getTime() / ms) * ms); };
    const temporaryFacilities = Array.from(
      { length: Math.max(1, Math.min(16, Math.round(temporaryFacilityCount) || 1)) },
      (_, idx) => ({
        id: `draft-facility-${idx + 1}`,
        label: `Facility ${idx + 1}`,
      }),
    );

    sortedDates.forEach(slot => {
      let current = roundTo5(new Date(`${slot.date}T${slot.startTime}`));
      const end = new Date(`${slot.date}T${slot.endTime}`);
      while (current.getTime() + gameLength * 60000 <= end.getTime()) {
        const timeStr = current.toTimeString().slice(0, 5);
        if (resourceList.length === 0) {
          temporaryFacilities.forEach(facility => totalSlots.push({
            date: slot.date,
            time: timeStr,
            venueId: null,
            venueName: facility.label,
            venueFacilityId: null,
            scheduleFacilityLaneId: facility.id,
            scheduleFacilityLaneLabel: facility.label,
          }));
        } else {
          resourceList.forEach(resource => {
            totalSlots.push({
              date: slot.date,
              time: timeStr,
              venueId: resource.venueId,
              venueName: resource.label,
              venueFacilityId: resource.venueFacilityId ?? null,
            });
          });
        }
        current = roundTo5(new Date(current.getTime() + (gameLength + breakLength) * 60000));
      }
    });
    // F69: drop every slot a kept game already holds (any division), by the Add window's own overlap rule. A draft
    // that no longer fits says so in the "Not enough time slots" words below.
    return slotsClearOfTakenGames(totalSlots, {
      takenGames,
      divisionId: selectedGroupId,
      draftLengthMinutes: gameLength,
      divisions,
      tournament,
    });
  }

  // Every draft builds from the division's current games (empty when it has none): what it keeps stays, fixed,
  // and only what it replaces is open to the draft.
  function getPartialContext(): PartialGenerationContext {
    // A kept game with no day or time yet (a bracket game saved before it was placed) takes no slot: it crashed the
    // draft's sort the moment "Build from current" became the only behaviour (/review, Stage 3 defects pass).
    const placedPreservedGames = preservedExistingGames.filter(game => game.date && game.time);
    return {
      preservedGames: preservedExistingGames,
      placedPreservedGames,
      replaceableGames: replaceableExistingGames,
      fixedAssignments: placedPreservedGames.map(gameToFixedAssignment),
    };
  }

  function gameToFixedAssignment(game: Game): ScheduleDraftAssignment<unknown> {
    const homeLabel = game.homePlaceholder || getTeamLabel(game.homeTeamId) || 'Home';
    const awayLabel = game.awayPlaceholder || getTeamLabel(game.awayTeamId) || 'Away';
    return {
      homeParticipantId: game.homeTeamId || game.homePlaceholder || game.homeSlotId || `home:${game.id}`,
      awayParticipantId: game.awayTeamId || game.awayPlaceholder || game.awaySlotId || `away:${game.id}`,
      homeLabel,
      awayLabel,
      homeMetric: game.homeTeamId
        ? { teamId: game.homeTeamId }
        : { slotId: game.homeSlotId ?? game.homePlaceholder ?? null, placeholder: game.homePlaceholder ?? homeLabel },
      awayMetric: game.awayTeamId
        ? { teamId: game.awayTeamId }
        : { slotId: game.awaySlotId ?? game.awayPlaceholder ?? null, placeholder: game.awayPlaceholder ?? awayLabel },
      payload: {},
      date: game.date,
      time: game.time,
      venueId: game.venueId ?? null,
      // A game placed by venue reference stores no text location (the demo's all are) — and a null name crashed the
      // draft's sort the moment two kept games shared a day and time. That path was "Build from current" only, so the
      // default "Replace all" hid it; it is the only path now (Stage 3 defects pass).
      venueName: game.location ?? '',
      venueFacilityId: game.venueFacilityId ?? null,
      scheduleFacilityLaneId: draftFacilityLaneIdForLabel(game.scheduleFacilityLaneLabel) ?? game.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: game.scheduleFacilityLaneLabel ?? null,
      slotIndex: -1,
    };
  }

  function draftFacilityLaneIdForLabel(label?: string | null): string | null {
    const match = label?.match(/^Facility\s+(\d+)$/i);
    return match ? `draft-facility-${match[1]}` : null;
  }

  function stripGameId(game: Game): Omit<Game, 'id'> {
    const rest: Partial<Game> = { ...game };
    delete rest.id;
    return rest as Omit<Game, 'id'>;
  }

  function stripGameIdToSlotGame(game: Game): SlotGame {
    return {
      ...stripGameId(game),
      homeTeamId: game.homeTeamId || '',
      awayTeamId: game.awayTeamId || '',
      homePlaceholder: game.homePlaceholder || getTeamLabel(game.homeTeamId) || 'Home',
      awayPlaceholder: game.awayPlaceholder || getTeamLabel(game.awayTeamId) || 'Away',
      homePoolId: null,
      homeSlotNumber: 0,
      awayPoolId: null,
      awaySlotNumber: 0,
    };
  }

  function getTeamLabel(teamId?: string | null): string | null {
    if (!teamId) return null;
    return teams.find(team => team.id === teamId)?.name ?? null;
  }

  function teamMatchupKey(homeTeamId?: string | null, awayTeamId?: string | null): string | null {
    if (!homeTeamId || !awayTeamId) return null;
    return [homeTeamId, awayTeamId].sort().join('|');
  }

  function slotMatchupKey(homeLabel?: string | null, awayLabel?: string | null): string | null {
    if (!homeLabel || !awayLabel) return null;
    return [homeLabel, awayLabel].sort().join('|');
  }

  function createTeamGamesFromDraft(draft: ScoredScheduleDraft<{ home: Team; away: Team }>): Omit<Game, 'id'>[] {
    return draft.assignments.map(assignment => ({
      tournamentId: tournament.id,
      divisionId: selectedGroupId,
      homeTeamId: assignment.homeParticipantId,
      awayTeamId: assignment.awayParticipantId,
      date: assignment.date,
      time: assignment.time,
      location: assignment.venueName,
      venueId: assignment.venueId || undefined,
      venueFacilityId: assignment.venueFacilityId ?? undefined,
      scheduleFacilityLaneId: assignment.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: assignment.scheduleFacilityLaneLabel ?? null,
      status: 'scheduled',
    }));
  }

  function createSlotGamesFromDraft(draft: ScoredScheduleDraft<SlotPayload>): SlotGame[] {
    return draft.assignments.map(assignment => {
      const match = assignment.payload;
      return {
        tournamentId: tournament.id,
        divisionId: selectedGroupId,
        homeTeamId: '',
        awayTeamId: '',
        date: assignment.date,
        time: assignment.time,
        location: assignment.venueName,
        venueId: assignment.venueId || undefined,
        venueFacilityId: assignment.venueFacilityId ?? undefined,
        scheduleFacilityLaneId: assignment.scheduleFacilityLaneId ?? null,
        scheduleFacilityLaneLabel: assignment.scheduleFacilityLaneLabel ?? null,
        status: 'scheduled',
        homePlaceholder: assignment.homeLabel,
        awayPlaceholder: assignment.awayLabel,
        homePoolId: match.homePoolId,
        homeSlotNumber: match.homeSlotNum,
        awayPoolId: match.awayPoolId,
        awaySlotNumber: match.awaySlotNum,
      };
    });
  }

  function buildDraftOptions<TPayload>(
    drafts: ScoredScheduleDraft<TPayload>[],
    mapGames: (draft: ScoredScheduleDraft<TPayload>) => {
      games: Omit<Game, 'id'>[];
      slotGames: SlotGame[];
      gamesToCommit?: Omit<Game, 'id'>[];
      slotGamesToCommit?: SlotGame[];
    },
  ): DraftOption[] {
    const movementCounts = drafts.map(draft => draft.metrics.venueChangeCount + draft.metrics.facilityChangeCount);
    const bestMovement = Math.min(...movementCounts);
    const bestBackToBack = Math.min(...drafts.map(draft => draft.metrics.backToBackCount));
    const bestMaxDay = Math.min(...drafts.map(draft => draft.metrics.maxGamesInDay));
    const bestRest = Math.max(...drafts.map(draft => draft.metrics.minRestMinutes ?? 0));
    const baseline = drafts[0];

    return drafts.map((draft, index) => {
      const mapped = mapGames(draft);
      const movement = draft.metrics.venueChangeCount + draft.metrics.facilityChangeCount;
      const label = getDraftOptionLabel({
        index,
        draft,
        movement,
        baseline,
        bestMovement,
        bestBackToBack,
        bestMaxDay,
        bestRest,
      });
      return {
        id: `draft-${index + 1}`,
        label,
        metrics: { backToBacks: draft.metrics.backToBackCount, moves: movement, minRest: draft.metrics.minRestMinutes ?? null },
        summary: { score: draft.score, healthScore: draft.metrics.healthScore, candidateCount: draft.candidateCount },
        ...mapped,
        gamesToCommit: mapped.gamesToCommit ?? mapped.games,
        slotGamesToCommit: mapped.slotGamesToCommit ?? mapped.slotGames,
      };
    });
  }

  function getDraftOptionLabel(params: {
    index: number;
    draft: ScoredScheduleDraft;
    movement: number;
    baseline: ScoredScheduleDraft;
    bestMovement: number;
    bestBackToBack: number;
    bestMaxDay: number;
    bestRest: number;
  }): string {
    const { index, draft, movement, baseline, bestMovement, bestBackToBack, bestMaxDay, bestRest } = params;
    if (index === 0) return GW.cards.best;
    const baselineMovement = baseline.metrics.venueChangeCount + baseline.metrics.facilityChangeCount;
    if (movement === bestMovement && movement < baselineMovement) return GW.cards.moves;
    if (draft.metrics.backToBackCount === bestBackToBack && draft.metrics.backToBackCount < baseline.metrics.backToBackCount) return GW.cards.backToBacks;
    if ((draft.metrics.minRestMinutes ?? 0) === bestRest && (draft.metrics.minRestMinutes ?? 0) > (baseline.metrics.minRestMinutes ?? 0)) return GW.cards.rest;
    if (draft.metrics.maxGamesInDay === bestMaxDay && draft.metrics.maxGamesInDay < baseline.metrics.maxGamesInDay) return GW.cards.lightDays;
    if (draft.metrics.healthScore > baseline.metrics.healthScore) return GW.cards.health;
    return GW.cards.other(index + 1);
  }

  function applyDraftOptions(options: DraftOption[], draftSeed: number) {
    setDraftOptions(options);
    const option = options[0];
    if (!option) return;
    setDraftSetIndex(draftSeed);
    setSelectedDraftOptionIndex(0);
    setGeneratedGames(option.games);
    setGeneratedSlotGames(option.slotGames);
    setGamesToCommit(option.gamesToCommit);
    setSlotGamesToCommit(option.slotGamesToCommit);
  }

  function applyPartialPreviewContext(partial: PartialGenerationContext) {
    setReplaceableGameIds(partial.replaceableGames.map(game => game.id));
    setReplacementGameCount(partial.replaceableGames.length);
  }

  function selectDraftOption(index: number) {
    const option = draftOptions[index];
    if (!option) return;
    setSelectedDraftOptionIndex(index);
    setGeneratedGames(option.games);
    setGeneratedSlotGames(option.slotGames);
    setGamesToCommit(option.gamesToCommit);
    setSlotGamesToCommit(option.slotGamesToCommit);
  }

  function generate(draftSeed = 0) {
    setError(null);
    if (dateSlots.some(s => !s.date)) { setError(GW.errors.chooseDays); return; }

    if (generationMode === 'slot') {
      generateSlots(selectedResources, draftSeed);
    } else {
      generateTeams(selectedResources, draftSeed);
    }
  }

  function generateAnotherDraftSet() {
    generate(draftSetIndex + 1);
  }

  function generateTeams(resourceList: ScheduleResource[], draftSeed = 0) {
    const groupTeams = teams.filter(t => t.divisionId === selectedGroupId);
    if (groupTeams.length < 2) { setError(GW.errors.twoTeams); return; }
    const partial = getPartialContext();

    const pools: Record<string, Team[]> = {};
    const usePools = (currentGroup?.poolCount || 0) >= 2;
    groupTeams.forEach(t => {
      const poolRecord = usePools ? currentGroup?.pools?.find(p => p.id === t.poolId) : null;
      const poolKey = poolRecord ? poolRecord.id : 'Default';
      if (!pools[poolKey]) pools[poolKey] = [];
      pools[poolKey].push(t);
    });

    const allMatchups: { home: Team; away: Team }[] = [];
    Object.values(pools).forEach(poolTeams => {
      if (poolTeams.length < 2) return;
      const teamsPool = [...poolTeams];
      if (teamsPool.length % 2 !== 0) {
        teamsPool.push({
          id: 'BYE',
          name: 'BYE',
          tournamentId: tournament.id,
          divisionId: selectedGroupId,
          coach: '',
          email: '',
          status: 'accepted',
          paymentStatus: 'paid',
          registeredAt: '',
        });
      }
      const n = teamsPool.length;
      const roundsToGenerate = Math.min(gamesPerTeam, n - 1);
      for (let round = 0; round < roundsToGenerate; round++) {
        for (let i = 0; i < n / 2; i++) {
          const home = teamsPool[i];
          const away = teamsPool[n - 1 - i];
          if (home.id !== 'BYE' && away.id !== 'BYE') allMatchups.push({ home, away });
        }
        teamsPool.splice(1, 0, teamsPool.pop()!);
      }
    });

    // Only ROUND-ROBIN games cover a round-robin matchup. Two teams who also meet in a playoff game still need their
    // round-robin game — counting the playoff deleted it (it is replaceable) and never drew it again.
    const preservedMatchupKeys = new Set(
      partial.preservedGames
        .filter(game => !game.isPlayoff)
        .map(game => teamMatchupKey(game.homeTeamId, game.awayTeamId))
        .filter((key): key is string => Boolean(key)),
    );
    const matchupsToGenerate = allMatchups.filter(match => !preservedMatchupKeys.has(teamMatchupKey(match.home.id, match.away.id) ?? ''));

    if (matchupsToGenerate.length === 0) {
      if (partial.preservedGames.length > 0) {
        const preservedGames = partial.placedPreservedGames.map(stripGameId);
        const metrics = buildScheduleMetrics({
          games: preservedGames,
          teams,
          divisions,
          venues,
          tournament,
          divisionId: selectedGroupId,
          expectedGamesPerParticipant: gamesPerTeam,
          gameDurationMinutes: gameLength,
          bufferMinutes: breakLength,
          manualTravelBuffers,
          maxGamesPerDay: priorities.maxGamesPerDay,
        });
        applyDraftOptions([{
          id: 'current-schedule',
          label: GW.cards.current,
          metrics: { backToBacks: metrics.backToBackCount, moves: metrics.venueChangeCount + metrics.facilityChangeCount, minRest: metrics.minRestMinutes ?? null },
          summary: { score: metrics.healthScore, healthScore: metrics.healthScore, candidateCount: 0 },
          games: preservedGames,
          slotGames: [],
          gamesToCommit: [],
          slotGamesToCommit: [],
        }], draftSeed);
        applyPartialPreviewContext(partial);
        return;
      }
      setError(GW.errors.noMatchups);
      return;
    }

    const totalSlots = buildTimeSlots(resourceList);
    if (totalSlots.length < matchupsToGenerate.length) {
      setError(GW.errors.notEnoughSlots(matchupsToGenerate.length, totalSlots.length, noun));
      return;
    }

    const participants: ScheduleDraftParticipant[] = groupTeams.map(team => ({
      id: team.id,
      label: team.name,
      divisionId: team.divisionId,
      status: team.status,
    }));
    const draftMatchups: ScheduleDraftMatchup<{ home: Team; away: Team }>[] = matchupsToGenerate.map(match => ({
      homeParticipantId: match.home.id,
      awayParticipantId: match.away.id,
      homeLabel: match.home.name,
      awayLabel: match.away.name,
      homeMetric: { teamId: match.home.id },
      awayMetric: { teamId: match.away.id },
      poolId: match.home.poolId ?? null,
      payload: match,
    }));
    const drafts = generateScoredScheduleDrafts({
      tournamentId: tournament.id,
      divisionId: selectedGroupId,
      matchups: draftMatchups,
      slots: totalSlots,
      participants,
      expectedGamesPerParticipant: gamesPerTeam,
      gameDurationMinutes: gameLength,
      bufferMinutes: breakLength,
      manualTravelBuffers,
      priorities,
      draftSeed,
      fixedAssignments: partial.fixedAssignments,
    }, 3);

    if (drafts.length === 0) {
      setError(GW.errors.noDraft);
      return;
    }

    applyDraftOptions(buildDraftOptions(drafts, draft => {
      const gamesToCommit = createTeamGamesFromDraft(draft);
      return {
        games: [...partial.placedPreservedGames.map(stripGameId), ...gamesToCommit],
        slotGames: [],
        gamesToCommit,
        slotGamesToCommit: [],
      };
    }), draftSeed);
    applyPartialPreviewContext(partial);
  }

  function generateSlots(resourceList: ScheduleResource[], draftSeed = 0) {
    const allMatchups: ScheduleDraftMatchup<SlotPayload>[] = [];
    const participantMap = new Map<string, ScheduleDraftParticipant>();
    const partial = getPartialContext();

    const addSlotRoundRobin = (params: { poolId: string | null; groupName: string; count: number }) => {
      const { poolId, groupName, count } = params;
      if (count < 2) return;
      for (let slotNum = 1; slotNum <= count; slotNum++) {
        const participantId = `${groupName} Team ${slotNum}`;
        participantMap.set(participantId, {
          id: participantId,
          label: `${groupName} Team ${slotNum}`,
          divisionId: selectedGroupId,
          status: 'accepted',
        });
      }
      const nums = Array.from({ length: count }, (_, i) => i + 1);
      if (nums.length % 2 !== 0) nums.push(0); // 0 = BYE
      const n = nums.length;
      const roundsToGenerate = Math.min(gamesPerTeam, n - 1);
      const rotation = [...nums];
      for (let round = 0; round < roundsToGenerate; round++) {
        for (let i = 0; i < n / 2; i++) {
          const home = rotation[i];
          const away = rotation[n - 1 - i];
          if (home !== 0 && away !== 0) {
            const homeName = `${groupName} Team ${home}`;
            const awayName = `${groupName} Team ${away}`;
            allMatchups.push({
              homeParticipantId: homeName,
              awayParticipantId: awayName,
              homeLabel: homeName,
              awayLabel: awayName,
              homeMetric: { slotId: homeName, placeholder: homeName },
              awayMetric: { slotId: awayName, placeholder: awayName },
              poolId,
              payload: { homePoolId: poolId, homeSlotNum: home, awayPoolId: poolId, awaySlotNum: away },
            });
          }
        }
        rotation.splice(1, 0, rotation.pop()!);
      }
    };

    if (poolList.length === 0) {
      addSlotRoundRobin({
        poolId: null,
        groupName: currentGroup?.name ?? 'Division',
        count: defaultSlotCount(DIVISION_SLOT_POOL_ID),
      });
    } else {
      poolList.forEach(pool => {
        addSlotRoundRobin({
          poolId: pool.id,
          groupName: pool.name,
          count: defaultSlotCount(pool.id),
        });
      });
    }

    const preservedMatchupKeys = new Set(
      partial.preservedGames
        .filter(game => !game.isPlayoff)
        .map(game => slotMatchupKey(
          game.homePlaceholder || getTeamLabel(game.homeTeamId),
          game.awayPlaceholder || getTeamLabel(game.awayTeamId),
        ))
        .filter((key): key is string => Boolean(key)),
    );
    const matchupsToGenerate = allMatchups.filter(match => !preservedMatchupKeys.has(slotMatchupKey(match.homeLabel, match.awayLabel) ?? ''));

    if (matchupsToGenerate.length === 0) {
      if (partial.preservedGames.length > 0) {
        const preservedSlotGames = partial.placedPreservedGames.map(stripGameIdToSlotGame);
        const metrics = buildScheduleMetrics({
          games: preservedSlotGames,
          teams: [],
          divisions,
          venues,
          tournament,
          divisionId: selectedGroupId,
          expectedGamesPerParticipant: gamesPerTeam,
          gameDurationMinutes: gameLength,
          bufferMinutes: breakLength,
          manualTravelBuffers,
          maxGamesPerDay: priorities.maxGamesPerDay,
        });
        applyDraftOptions([{
          id: 'current-schedule',
          label: GW.cards.current,
          metrics: { backToBacks: metrics.backToBackCount, moves: metrics.venueChangeCount + metrics.facilityChangeCount, minRest: metrics.minRestMinutes ?? null },
          summary: { score: metrics.healthScore, healthScore: metrics.healthScore, candidateCount: 0 },
          games: [],
          slotGames: preservedSlotGames,
          gamesToCommit: [],
          slotGamesToCommit: [],
        }], draftSeed);
        applyPartialPreviewContext(partial);
        return;
      }
      setError(GW.errors.noSlotMatchups);
      return;
    }

    const totalSlots = buildTimeSlots(resourceList);
    if (totalSlots.length < matchupsToGenerate.length) {
      setError(GW.errors.notEnoughSlots(matchupsToGenerate.length, totalSlots.length, noun));
      return;
    }

    const drafts = generateScoredScheduleDrafts({
      tournamentId: tournament.id,
      divisionId: selectedGroupId,
      matchups: matchupsToGenerate,
      slots: totalSlots,
      participants: Array.from(participantMap.values()),
      expectedGamesPerParticipant: gamesPerTeam,
      gameDurationMinutes: gameLength,
      bufferMinutes: breakLength,
      manualTravelBuffers,
      priorities,
      draftSeed,
      fixedAssignments: partial.fixedAssignments,
    }, 3);

    if (drafts.length === 0) {
      setError(GW.errors.noDraft);
      return;
    }

    applyDraftOptions(buildDraftOptions(drafts, draft => {
      const slotGamesToCommit = createSlotGamesFromDraft(draft);
      return {
        games: [],
        slotGames: [...partial.placedPreservedGames.map(stripGameIdToSlotGame), ...slotGamesToCommit],
        gamesToCommit: [],
        slotGamesToCommit,
      };
    }), draftSeed);
    applyPartialPreviewContext(partial);
  }

  async function commit() {
    setAskReplace(false);
    if (generationMode === 'slot') {
      await commitSlots();
    } else {
      await commitTeams();
    }
  }

  async function commitTeams() {
    setCommitting(true);
    try {
      const gamesToSave = await materializeTemporaryFacilityLanes(gamesToCommit);
      await saveDraftInOneStep(gamesToSave);
      onComplete();
    } catch (e: unknown) {
      // The draft stays on screen; the route's reply says nothing was saved (one transaction).
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCommitting(false);
    }
  }

  async function commitSlots() {
    setCommitting(true);
    try {
      const slotGamesToSave = await materializeTemporaryFacilityLanes(slotGamesToCommit);

      if (slotGamesToSave.length === 0) {
        await saveDraftInOneStep([]);
        onComplete();
        return;
      }

      // Save division-wide placeholders directly, or resolve pool slot IDs first.
      let gameRows: Array<Record<string, unknown>>;

      if (poolList.length === 0) {
        gameRows = slotGamesToSave.map(g => ({
          tournamentId: tournament.id,
          divisionId: selectedGroupId,
          homeTeamId: null,
          awayTeamId: null,
          date: g.date,
          time: g.time,
          location: g.location,
          venueId: g.venueId,
          venueFacilityId: g.venueFacilityId,
          scheduleFacilityLaneId: g.scheduleFacilityLaneId,
          scheduleFacilityLaneLabel: g.scheduleFacilityLaneLabel,
          status: 'scheduled',
          homeSlotId: null,
          awaySlotId: null,
          homePlaceholder: g.homePlaceholder,
          awayPlaceholder: g.awayPlaceholder,
        }));
      } else {
        const ensureRes = await fetch(`/api/admin/pool-slots${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ensure',
            tournamentId: tournament.id,
            divisionId: selectedGroupId,
            pools: poolList.map(pool => ({
              poolId: pool.id,
              slotCount: defaultSlotCount(pool.id),
              namePrefix: pool.name,
            })),
          }),
        });
        if (!ensureRes.ok) throw new Error((await ensureRes.json()).error || 'Failed to create slot records');
        const { slots } = await ensureRes.json();

        // Build slot lookup: "poolId-slotNumber" to { id, displayName }.
        const slotMap: Record<string, { id: string; displayName: string }> = {};
        (slots as PoolSlotEnsureRow[]).forEach(s => { slotMap[`${s.poolId}-${s.slotNumber}`] = { id: s.id, displayName: s.displayName }; });

        gameRows = slotGamesToSave.map(g => {
          const homeSlot = slotMap[`${g.homePoolId}-${g.homeSlotNumber}`];
          const awaySlot = slotMap[`${g.awayPoolId}-${g.awaySlotNumber}`];
          return {
            tournamentId: tournament.id,
            divisionId: selectedGroupId,
            homeTeamId: null,
            awayTeamId: null,
            date: g.date,
            time: g.time,
            location: g.location,
            venueId: g.venueId,
            venueFacilityId: g.venueFacilityId,
            scheduleFacilityLaneId: g.scheduleFacilityLaneId,
            scheduleFacilityLaneLabel: g.scheduleFacilityLaneLabel,
            status: 'scheduled',
            homeSlotId: homeSlot?.id ?? null,
            awaySlotId: awaySlot?.id ?? null,
            homePlaceholder: homeSlot?.displayName ?? g.homePlaceholder,
            awayPlaceholder: awaySlot?.displayName ?? g.awayPlaceholder,
          };
        });
      }

      await saveDraftInOneStep(gameRows);
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCommitting(false);
    }
  }

  /**
   * F70 + P1 (Stage 3 defects pass): the draft's new games and the removal of the games they replace are ONE request,
   * run by the server as one transaction (mig 320). It used to be a delete, then a save — a failure between them
   * left the division with its games deleted and the draft unsaved. The server re-checks that every replaced game is
   * still to play and not kept, and refuses the whole save if one changed since this draft was made.
   */
  async function saveDraftInOneStep(games: Array<Omit<Game, 'id'> | Record<string, unknown>>) {
    if (games.length === 0 && replaceableGameIds.length === 0) return; // nothing to add, nothing to replace
    const res = await fetch(`/api/admin/games${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'replace-division-round-robin',
        tournamentId: tournament.id,
        divisionId: selectedGroupId,
        // A39 / F76: every game carries the length the drafts were spaced by (it used to save none).
        games: games.map(g => ({ ...g, durationMinutes: gameLength })),
        replaceGameIds: replaceableGameIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // "Generate the draft again" must be able to work: the schedule this draft was made from is out of date, so the
      // page reloads it now (the draft stays on screen; the next Generate builds from what is there).
      if (data.code === 'schedule_changed') onStale?.();
      // The route's own sentence, or ours — never a server error's raw text (the save is one transaction, so a failed
      // one changed nothing, which is what DRAFT_SAVE_FAILED.other says).
      throw new Error(refusalReason(res.status, data.error, DRAFT_SAVE_FAILED.other));
    }
  }

  function reset() {
    setShowGames(false);
    setClubFindings({});
    setGeneratedGames([]);
    setGeneratedSlotGames([]);
    setGamesToCommit([]);
    setSlotGamesToCommit([]);
    setReplaceableGameIds([]);
    setReplacementGameCount(0);
    setDraftOptions([]);
    setSelectedDraftOptionIndex(0);
    setDraftSetIndex(0);
  }

  function toggleResource(key: string) {
    setSelectedResourceKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleVenueResources(venue: Venue) {
    const keys = getVenueResourceKeys(venue);
    const allSelected = keys.every(key => selectedResourceKeys.has(key));
    setSelectedResourceKeys(current => {
      const next = new Set(current);
      keys.forEach(key => {
        if (allSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }

  function selectAllResources() {
    setSelectedResourceKeys(new Set(venues.flatMap(getVenueResourceKeys)));
  }

  function clearResources() {
    setSelectedResourceKeys(new Set());
  }

  function applyPreset(preset: SchedulePreset) {
    setPriorities({ ...preset.settings });
    setSelectedPresetId(preset.id);
  }

  function updatePriorities(updates: Partial<SchedulePrioritySettings>) {
    setPriorities(current => ({ ...current, ...updates }));
    setSelectedPresetId('custom');
  }

  async function materializeTemporaryFacilityLanes<T extends Omit<Game, 'id'>>(games: T[]): Promise<T[]> {
    const labels = Array.from(new Set(
      games
        .filter(game => game.scheduleFacilityLaneId?.startsWith('draft-facility-'))
        .map(game => game.scheduleFacilityLaneLabel || game.location)
        .filter(Boolean),
    ));
    if (labels.length === 0) return games;

    const res = await fetch(`/api/admin/schedule-facility-lanes${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ensure',
        tournamentId: tournament.id,
        divisionId: selectedGroupId,
        labels,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to prepare temporary facilities');

    const laneByLabel = new Map((data.lanes as FacilityLaneEnsureRow[]).map(lane => [lane.label, lane.id]));
    return games.map(game => {
      if (!game.scheduleFacilityLaneId?.startsWith('draft-facility-')) return game;
      const label = game.scheduleFacilityLaneLabel || game.location;
      return {
        ...game,
        venueId: undefined,
        venueFacilityId: undefined,
        scheduleFacilityLaneId: laneByLabel.get(label) ?? game.scheduleFacilityLaneId,
        scheduleFacilityLaneLabel: label,
        location: label,
      };
    });
  }

  const divisionName = divisions.find(g => g.id === selectedGroupId)?.name ?? '';
  const previewGeneratedCount = generationMode === 'slot' ? slotGamesToCommit.length : gamesToCommit.length;
  const step: 'settings' | 'drafts' = hasPreview ? 'drafts' : 'settings';
  const published = currentGroup?.scheduleVisibility === 'published';
  const pooled = poolList.length > 0;
  const [moreRules, setMoreRules] = useState(false);

  // ── What saving does, counted (the one statement under the chosen draft) ──
  const playedCount = preservedExistingGames.filter(g => !g.isPlayoff && ['completed', 'forfeit', 'submitted'].includes(g.status)).length;
  const markedCount = preservedExistingGames.filter(g => !g.isPlayoff && g.status === 'scheduled' && g.generatorLocked).length;
  const statement = draftStatement({
    division: divisionName, added: previewGeneratedCount, replaced: replacementGameCount,
    played: playedCount, kept: markedCount, other: preservedExistingGames.length - playedCount - markedCount, published,
  });

  // ── The other divisions' games on the chosen fields and days, drawn as taken (the drafts leave them free) ──
  const chosenDays = new Set(dateSlots.map(s => s.date).filter(Boolean));
  const fieldName = (g: { venueId?: string | null; venueFacilityId?: string | null; scheduleFacilityLaneLabel?: string | null; location?: string | null }) => {
    const venue = venues.find(v => v.id === g.venueId);
    const facility = g.venueFacilityId ? venue?.facilities?.find(f => f.id === g.venueFacilityId) : null;
    return facility?.name ?? venue?.name ?? g.scheduleFacilityLaneLabel ?? g.location ?? '';
  };
  const resourceOf = (g: Game) => (g.venueFacilityId ? facilityResourceKey(g.venueFacilityId) : g.venueId ? venueResourceKey(g.venueId) : null);
  const takenOthers = existingGames.filter(g => {
    if (g.divisionId === selectedGroupId || g.status === 'cancelled' || !g.date || !g.time || !chosenDays.has(g.date)) return false;
    const key = resourceOf(g);
    return !!key && selectedResourceKeys.has(key);
  });
  const nameOfDivision = (id: string) => divisions.find(d => d.id === id)?.name ?? '';
  const othersOnDays = [...new Set(takenOthers.map(g => nameOfDivision(g.divisionId)))].filter(Boolean);
  const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
  const takenLine = takenOthers.length === 0 ? null : GW.taken({
    divisions: othersOnDays,
    games: takenOthers.length,
    fields: [...new Set(takenOthers.map(fieldName))].filter(Boolean).sort(),
    days: [...new Set(takenOthers.map(g => g.date!))].sort().map(weekday),
    times: [...new Set([...takenOthers].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).map(g => formatTime(g.time!)))],
  });

  // ── The club's other bookings under each draft's games (6a's check; amber, never a refusal) ──
  const canCheckClub = hasOrgVenueLibrary(planId ?? null);
  useEffect(() => {
    if (!canCheckClub || draftOptions.length === 0) return;
    const games = draftOptions.flatMap((o, oi) => (generationMode === 'slot' ? o.slotGamesToCommit : o.gamesToCommit).map((g, gi) => ({
      key: `${draftSetIndex}:${oi}:${gi}`, date: g.date, time: g.time, venueId: g.venueId ?? null,
      venueFacilityId: g.venueFacilityId ?? null, durationMinutes: gameLength,
    }))).filter(g => g.venueId);
    if (!games.length) return;
    let live = true;
    fetch(`/api/admin/tournaments/${encodeURIComponent(tournament.id)}/club-clashes${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games }),
    })
      .then(r => (r.ok ? r.json() : { findings: {} }))
      .then((d: { findings?: Record<string, ClashFinding[]> }) => { if (live) setClubFindings(d.findings ?? {}); })
      .catch(() => { /* no line, never an error on the drafts */ });
    return () => { live = false; };
  }, [canCheckClub, draftOptions, draftSetIndex, generationMode, gameLength, tournament.id, orgQuery]);
  const newGamesOf = (o: DraftOption) => (generationMode === 'slot' ? o.slotGamesToCommit : o.gamesToCommit);
  const clubLineOf = (oi: number, gi: number, g: Omit<Game, 'id'>) => {
    const findings = clubFindings[`${draftSetIndex}:${oi}:${gi}`];
    if (!findings?.length) return null;
    const venue = venues.find(v => v.id === g.venueId);
    return clashLineText(clashLine(findings, {
      sport: tournament.sport, venueName: venue?.name ?? '',
      facilityName: g.venueFacilityId ? venue?.facilities?.find(f => f.id === g.venueFacilityId)?.name ?? null : null,
    }));
  };
  const clubMeasure = (oi: number, o: DraftOption) => {
    const hits = newGamesOf(o).map((g, gi) => ({ g, gi })).filter(({ gi }) => clubFindings[`${draftSetIndex}:${oi}:${gi}`]?.length);
    if (hits.length === 0) return <li className={gen.good}><Check size={13} aria-hidden /> {GW.measures.clubClear}</li>;
    const first = hits[0].g;
    const where = `${fieldName(first)}, ${formatShortWeekdayDate(first.date).split(',')[0]} ${formatTime(first.time)}`;
    return <li className={gen.amber}><AlertTriangle size={13} aria-hidden /> {hits.length === 1 ? GW.measures.clubOne(where) : GW.measures.clubMany(hits.length)}</li>;
  };
  const restWords = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
  };
  const teamWords = (g: Omit<Game, 'id'>, side: 'home' | 'away') => {
    const id = side === 'home' ? g.homeTeamId : g.awayTeamId;
    const ph = side === 'home' ? g.homePlaceholder : g.awayPlaceholder;
    return (id ? teams.find(t => t.id === id)?.name : null) || ph || 'TBD';
  };

  // ── Step 1 · settings: What it pairs · When · Where · Rules ──
  const range = (from: number, to: number, by = 1) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);
  const withCurrent = (list: number[], current: number) => (list.includes(current) ? list : [...list, current].sort((a, b) => a - b));
  const settingsBody = (
    <div className={gen.settings}>
      <section className={gen.section} aria-labelledby="gen-pairs">
        <h3 id="gen-pairs" className={gen.sectionTitle}>{GW.sections.pairs}</h3>
        <div className={gen.pair2}>
          <label className={ck.field}>
            <span className={ck.label}>{GW.fields.division}</span>
            <select className={ck.select} value={selectedGroupId} onChange={e => chooseDivision(e.target.value)}>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{generationMode === 'slot' ? GW.fields.gamesPerSlot : GW.fields.gamesPerTeam}</span>
            <select className={ck.select} value={gamesPerTeam} onChange={e => setGamesPerTeam(Number(e.target.value))} aria-describedby="gen-games-hint">
              {range(1, 10).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <p id="gen-games-hint" className={gen.hint}>{GW.fields.gamesPerTeamHint}</p>
        <label className={ck.field}>
          <span className={ck.label}>{GW.fields.pair}</span>
          <select className={ck.select} value={generationMode} onChange={e => setGenerationMode(e.target.value as 'team' | 'slot')}>
            <option value="team">{GW.fields.pairTeams}</option>
            <option value="slot">{GW.fields.pairSlots}</option>
          </select>
        </label>
        {generationMode === 'slot' && (
          <>
            <p className={gen.hint}>{GW.fields.pairSlotsHint(currentGroup?.name ?? divisionName, pooled)}</p>
            <div className={gen.pair2}>
              {(pooled
                ? poolList.map(p => ({ id: p.id, name: p.name, max: 16 }))
                : [{ id: DIVISION_SLOT_POOL_ID, name: currentGroup?.name ?? divisionName, max: 32 }]
              ).map(p => (
                <label key={p.id} className={ck.field}>
                  <span className={ck.label}>{GW.fields.slots(p.name)}</span>
                  <select className={ck.select} value={slotCountOverride[p.id] ?? defaultSlotCount(p.id)}
                    onChange={e => setSlotCountOverride(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}>
                    {withCurrent(range(2, p.max), defaultSlotCount(p.id)).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={gen.section} aria-labelledby="gen-when">
        <h3 id="gen-when" className={gen.sectionTitle}>{GW.sections.when}</h3>
        {dateSlots.map((slot, idx) => (
          <div key={idx} className={gen.dayRow}>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.day}</span>
              <select className={ck.select} value={slot.date} onChange={e => updateDateSlot(idx, { date: e.target.value })}>
                <option value="">{GW.fields.chooseDay}</option>
                {availableDates.map(d => <option key={d} value={d}>{formatShortWeekdayDate(d)}</option>)}
              </select>
            </label>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.from}</span>
              <input className={ck.input} type="time" value={slot.startTime} onChange={e => updateDateSlot(idx, { startTime: e.target.value })} />
            </label>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.until}</span>
              <input className={ck.input} type="time" value={slot.endTime} onChange={e => updateDateSlot(idx, { endTime: e.target.value })} />
            </label>
            <button type="button" className={gen.remove} onClick={() => removeDateSlot(idx)} disabled={dateSlots.length === 1}
              aria-label={GW.fields.removeDay(slot.date ? formatShortWeekdayDate(slot.date) : GW.fields.day)}>
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className={gen.door} onClick={addDateSlot}><Plus size={15} aria-hidden /> {GW.fields.addDay}</button>
        <div className={gen.pair2}>
          <label className={ck.field}>
            <span className={ck.label}>{GW.fields.gameLength}</span>
            <select className={ck.select} value={gameLength} onChange={e => setGameLength(Number(e.target.value))} aria-describedby="gen-length-hint">
              {withCurrent([30, 45, 60, 75, 90, 105, 120, 135, 150, 180, 210, 240], gameLength).map(n => <option key={n} value={n}>{GW.fields.minutes(n)}</option>)}
            </select>
            <span id="gen-length-hint" className={gen.hint}>{GW.fields.gameLengthHint}</span>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{GW.fields.turnover}</span>
            <select className={ck.select} value={breakLength} onChange={e => setBreakLength(Number(e.target.value))} aria-describedby="gen-turnover-hint">
              {withCurrent([0, 5, 10, 15, 20, 25, 30, 45, 60], breakLength).map(n => <option key={n} value={n}>{GW.fields.minutes(n)}</option>)}
            </select>
            <span id="gen-turnover-hint" className={gen.hint}>{GW.fields.turnoverHint(noun)}</span>
          </label>
        </div>
      </section>

      <section className={gen.section} aria-labelledby="gen-where">
        <div className={gen.sectionHead}>
          <h3 id="gen-where" className={gen.sectionTitle}>{GW.sections.where}</h3>
          {venues.length > 0 && (
            <span className={gen.headDoors}>
              <button type="button" className={gen.door} onClick={selectAllResources}>{GW.fields.allFields}</button>
              <button type="button" className={gen.door} onClick={clearResources}>{GW.fields.noFields}</button>
            </span>
          )}
        </div>
        {venues.map(venue => {
          const facilities = venue.facilities ?? [];
          return (
            <div key={venue.id} className={gen.venue}>
              {/* The venue's name heads its diamonds only when they have names of their own (a park with Diamonds 1–4);
                  a venue that IS its one field ("Maple Field 1") reads once, as its chip. */}
              {facilities.some(f => f.name !== venue.name) && (
                <button type="button" className={gen.venueName} onClick={() => toggleVenueResources(venue)}
                  aria-pressed={getVenueResourceKeys(venue).every(k => selectedResourceKeys.has(k))}>
                  {venue.name}
                </button>
              )}
              <div className={gen.chips}>
                {(facilities.length ? facilities.map(f => ({ key: facilityResourceKey(f.id), name: f.name })) : [{ key: venueResourceKey(venue.id), name: venue.name }]).map(f => (
                  <button key={f.key} type="button" className={gen.chip} aria-pressed={selectedResourceKeys.has(f.key)} onClick={() => toggleResource(f.key)}>
                    {selectedResourceKeys.has(f.key) && <Check size={13} aria-hidden />}{f.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {takenLine && <p className={gen.taken}>{takenLine}</p>}
        {(venues.length === 0 || selectedResourceCount === 0) && (
          <div className={gen.pair2}>
            <p className={gen.hint}><b>{GW.fields.temporary}.</b> {GW.fields.temporaryHint}</p>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.temporaryCount}</span>
              <select className={ck.select} value={temporaryFacilityCount} onChange={e => setTemporaryFacilityCount(Number(e.target.value))}>
                {range(1, 16).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <section className={gen.section} aria-labelledby="gen-rules">
        <h3 id="gen-rules" className={gen.sectionTitle}>{GW.sections.rules}</h3>
        <label className={ck.field}>
          <span className={ck.label}>{GW.fields.aimFor}</span>
          <select className={ck.select} value={selectedPresetId} aria-describedby="gen-preset-hint"
            onChange={e => { const p = SCHEDULE_PRESETS.find(x => x.id === e.target.value); if (p) applyPreset(p); }}>
            {SCHEDULE_PRESETS.map(p => <option key={p.id} value={p.id}>{GW.presets[p.id]}</option>)}
            {selectedPresetId === 'custom' && <option value="custom">{GW.presets.custom}</option>}
          </select>
          {presetDescription && <span id="gen-preset-hint" className={gen.hint}>{presetDescription}</span>}
        </label>
        <div className={gen.rulesLine}>
          <button type="button" className={gen.door} aria-expanded={moreRules} onClick={() => setMoreRules(v => !v)}>
            {moreRules ? GW.fields.fewerRules : GW.fields.moreRules}
          </button>
          <span className={gen.hint}>{GW.fields.rulesSummary(priorities.maxGamesPerDay, priorities.minRestMinutes)}</span>
        </div>
        {moreRules && (
          <div className={gen.more}>
            <div className={gen.pair2}>
              <label className={ck.field}>
                <span className={ck.label}>{GW.fields.maxPerDay}</span>
                <select className={ck.select} value={priorities.maxGamesPerDay} onChange={e => updatePriorities({ maxGamesPerDay: Number(e.target.value) })}>
                  {range(1, 6).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{GW.fields.minRest}</span>
                <select className={ck.select} value={priorities.minRestMinutes} onChange={e => updatePriorities({ minRestMinutes: Number(e.target.value) })}>
                  {withCurrent(range(0, 360, 15), priorities.minRestMinutes).map(n => <option key={n} value={n}>{GW.fields.minutes(n)}</option>)}
                </select>
              </label>
            </div>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.effort}</span>
              <select className={ck.select} value={priorities.candidateCount} onChange={e => updatePriorities({ candidateCount: Number(e.target.value) })}>
                {[12, 24, 40].map(n => <option key={n} value={n}>{GW.fields.effortChoices[n]}</option>)}
              </select>
            </label>
            <CheckChoice checked={priorities.avoidBackToBack} onChange={v => updatePriorities({ avoidBackToBack: v })} title={GW.fields.avoidBackToBack} />
            <CheckChoice checked={priorities.reduceVenueChanges} onChange={v => updatePriorities({ reduceVenueChanges: v })} title={GW.fields.fewerMoves} />
            <CheckChoice checked={priorities.balanceTimeSlots} onChange={v => updatePriorities({ balanceTimeSlots: v })} title={GW.fields.balanceEarlyLate} />
          </div>
        )}
      </section>
      {error && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{error}</Callout>}
    </div>
  );

  // ── Step 2 · drafts: the cards, the chosen draft's games by day, one statement ──
  const chosen = draftOptions[selectedDraftOptionIndex];
  const chosenGames = chosen ? newGamesOf(chosen).map((g, gi) => ({ g, gi })) : [];
  const days = Array.from(new Set(chosenGames.map(({ g }) => g.date))).sort();
  const draftsBody = (
    <div className={gen.drafts}>
      <div className={gen.cards} role="group" aria-label={GW.draftsLabel}>
        {draftOptions.map((o, oi) => (
          <button key={o.id} type="button" className={gen.card} aria-pressed={selectedDraftOptionIndex === oi} onClick={() => selectDraftOption(oi)}>
            <span className={gen.cardHead}>
              <b>{o.label}</b>
              <span className={gen.score}>{o.summary.healthScore}<small>/100</small></span>
            </span>
            <ul className={gen.measures}>
              {othersOnDays.length > 0 && <li className={gen.good}><Check size={13} aria-hidden /> {GW.measures.noClashes(GW.others(othersOnDays))}</li>}
              <li>{GW.measures.loadAndMoves(o.metrics.backToBacks, o.metrics.moves)}</li>
              {o.metrics.minRest != null && <li>{GW.measures.shortestRest(restWords(o.metrics.minRest))}</li>}
              {canCheckClub && newGamesOf(o).length > 0 && clubMeasure(oi, o)}
            </ul>
          </button>
        ))}
        {draftOptions.length > 1 && (
          <button type="button" className={screenParts.plainButton} onClick={generateAnotherDraftSet} disabled={committing}>{GW.threeMore}</button>
        )}
      </div>
      <div className={gen.chosen}>
        {chosenGames.length > 0 && (
          <button type="button" className={gen.seeGames} aria-expanded={showGames} onClick={() => setShowGames(v => !v)}>
            {showGames ? GW.hideGames : GW.seeGames(chosenGames.length)}<ChevronRight size={16} aria-hidden />
          </button>
        )}
        {chosenGames.length > 0 && (
          <div className={gen.games} data-open={showGames || undefined}>
            <ClubRowFrame>
              {days.map(day => {
                const list = chosenGames.filter(({ g }) => g.date === day).sort((a, b) => a.g.time.localeCompare(b.g.time));
                return (
                  <ClubRowList key={day} inset label={formatShortWeekdayDate(day)}>
                    <ClubRowBand count={SW.bandCount(list.length)}>{formatShortWeekdayDate(day)}</ClubRowBand>
                    {list.map(({ g, gi }) => {
                      const club = chosen ? clubLineOf(selectedDraftOptionIndex, gi, g) : null;
                      return (
                        <ClubRow
                          key={gi}
                          lead={formatTime(g.time)}
                          captionFirst
                          title={`${teamWords(g, 'away')} vs ${teamWords(g, 'home')}`}
                          caption={<>{fieldName(g)}{club && <span className={gen.clubLine}><AlertTriangle size={13} aria-hidden /> {club}</span>}</>}
                        />
                      );
                    })}
                  </ClubRowList>
                );
              })}
            </ClubRowFrame>
          </div>
        )}
        {generationMode === 'slot' && previewGeneratedCount > 0 && <Callout tone="info" flush>{GW.slotDraftNote(pooled)}</Callout>}
        <div className={gen.statement}>
          <b>{statement.lead}</b>{statement.rest}
          {statement.bullets.length > 0 && <ul>{statement.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
        </div>
        {error && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{error}</Callout>}
      </div>
    </div>
  );

  const nothingToSave = previewGeneratedCount === 0 && replacementGameCount === 0;
  return (
    <>
      <KitDialog
        kind="form"
        wide
        title={GW.title}
        identity={<span>{step === 'settings' ? GW.caption.settings(tournament.name) : GW.caption.drafts(tournament.name, divisionName)}</span>}
        onClose={onCancel}
        busy={committing}
        back={step === 'drafts' ? { label: GW.settings, onBack: reset } : undefined}
        footer={step === 'settings' ? (
          <>
            <span className={gen.footNote}>{hasExistingGames ? GW.hasGames(divisionName, currentDivisionExistingGames.length) : GW.noGamesYet(divisionName)}</span>
            <button type="button" className="btn btn-lime" onClick={() => generate(0)}>{GW.generate}</button>
          </>
        ) : (
          <>
            <button type="button" className={screenParts.plainButton} onClick={reset} disabled={committing}>{GW.backToSettings}</button>
            <button type="button" className={`btn btn-lime ${gen.save}`} disabled={committing || nothingToSave}
              onClick={() => (replacementGameCount > 0 ? setAskReplace(true) : void commit())}>
              {replacementGameCount > 0 ? GW.saveReplace(replacementGameCount) : GW.save}
            </button>
          </>
        )}
      >
        {step === 'settings' ? settingsBody : draftsBody}
      </KitDialog>

      {askReplace && (
        <KitDialog
          kind="question"
          title={GW.replace.title(replacementGameCount)}
          onClose={() => setAskReplace(false)}
          busy={committing}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAskReplace(false)} disabled={committing}>{GW.replace.back}</button>
              <button type="button" className="btn btn-lime" onClick={() => void commit()} disabled={committing}>{GW.replace.go(replacementGameCount)}</button>
            </>
          )}
        >
          <p>{published ? GW.replace.published(divisionName) : GW.replace.unpublished(divisionName)}</p>
        </KitDialog>
      )}
    </>
  );
}
