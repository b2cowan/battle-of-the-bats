'use client';
import { useState, useMemo } from 'react';
import { Sparkles, Check, X, RefreshCw, AlertCircle, Plus, Trash2, Info, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Team, Division, Venue, Game, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { buildScheduleMetrics, resolveManualTravelBuffers } from '@/lib/schedule-metrics';
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
import ScheduleHealthPanel from './components/ScheduleHealthPanel';
import styles from './schedule-admin.module.css';

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
  detail: string;
  summary: DraftOptimizationSummary;
  games: Omit<Game, 'id'>[];
  slotGames: SlotGame[];
  gamesToCommit: Omit<Game, 'id'>[];
  slotGamesToCommit: SlotGame[];
}

type GenerationScope = 'replace' | 'build';

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
  enabled: boolean;
  preservedGames: Game[];
  replaceableGames: Game[];
  fixedAssignments: ScheduleDraftAssignment<unknown>[];
}

const DIVISION_SLOT_POOL_ID = '__division__';
const EFFORT_DESCRIPTIONS: Record<number, string> = {
  12: 'Fast checks fewer drafts and returns quicker.',
  24: 'Balanced checks more drafts without making generation feel slow.',
  40: 'Deep checks the most drafts for tougher schedules.',
};

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

const CUSTOM_PRESET_DESCRIPTION = 'Custom settings are active.';

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
  divisions: Division[];
  teams: Team[];
  venues: Venue[];
  existingGames?: Game[];
  onComplete: () => void;
  onCancel: () => void;
}

export default function ScheduleGenerator({ tournament, orgSlug, divisions, teams, venues, existingGames = [], onComplete, onCancel }: GeneratorProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(divisions[0]?.id || '');
  // Initialize from tournament settings so generator matches event-level defaults.
  const [gameLength, setGameLength] = useState(tournament.settings?.game_duration_minutes ?? 90);
  const [breakLength, setBreakLength] = useState(tournament.settings?.buffer_minutes ?? 15);
  const [gamesPerTeam, setGamesPerTeam] = useState(3);
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<Set<string>>(
    () => new Set(venues.flatMap(getVenueResourceKeys)),
  );
  const [temporaryFacilityCount, setTemporaryFacilityCount] = useState(2);
  const [priorities, setPriorities] = useState<SchedulePrioritySettings>(() => defaultSchedulePriorities());
  const [selectedPresetId, setSelectedPresetId] = useState<SchedulePresetId>('balanced');
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: tournament.startDate || '', startTime: '09:00', endTime: '20:30' }
  ]);

  const [generationMode, setGenerationMode] = useState<'team' | 'slot'>('team');
  const [generationScope, setGenerationScope] = useState<GenerationScope>('replace');
  const [slotCountOverride, setSlotCountOverride] = useState<Record<string, number>>({});

  const [generatedGames, setGeneratedGames] = useState<Omit<Game, 'id'>[]>([]);
  const [generatedSlotGames, setGeneratedSlotGames] = useState<SlotGame[]>([]);
  const [gamesToCommit, setGamesToCommit] = useState<Omit<Game, 'id'>[]>([]);
  const [slotGamesToCommit, setSlotGamesToCommit] = useState<SlotGame[]>([]);
  const [replaceableGameIds, setReplaceableGameIds] = useState<string[]>([]);
  const [preservedGameCount, setPreservedGameCount] = useState(0);
  const [lockedGameCount, setLockedGameCount] = useState(0);
  const [replacementGameCount, setReplacementGameCount] = useState(0);
  const [draftSummary, setDraftSummary] = useState<DraftOptimizationSummary | null>(null);
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([]);
  const [selectedDraftOptionIndex, setSelectedDraftOptionIndex] = useState(0);
  const [draftSetIndex, setDraftSetIndex] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPreview = generatedGames.length > 0 || generatedSlotGames.length > 0;
  const previewCount = generatedGames.length || generatedSlotGames.length;
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
  const replaceableExistingGames = useMemo(
    () => currentDivisionExistingGames.filter(game => !game.isPlayoff && game.status === 'scheduled' && !game.generatorLocked),
    [currentDivisionExistingGames],
  );
  const preservedExistingGames = useMemo(
    () => currentDivisionExistingGames.filter(game => game.isPlayoff || game.status !== 'scheduled' || game.generatorLocked),
    [currentDivisionExistingGames],
  );
  const lockedExistingGameCount = useMemo(
    () => currentDivisionExistingGames.filter(game => !game.isPlayoff && game.status === 'scheduled' && game.generatorLocked).length,
    [currentDivisionExistingGames],
  );
  const canBuildFromCurrent = currentDivisionExistingGames.length > 0;
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
  const totalResourceCount = venues.reduce((total, venue) => total + (venue.facilities?.length || 1), 0);
  const currentEffortDescription = EFFORT_DESCRIPTIONS[priorities.candidateCount] ?? EFFORT_DESCRIPTIONS[24];
  const selectedPreset = SCHEDULE_PRESETS.find(preset => preset.id === selectedPresetId);
  const presetDescription = selectedPreset?.description ?? CUSTOM_PRESET_DESCRIPTION;
  const manualTravelBuffers = useMemo(() => resolveManualTravelBuffers({}, tournament), [tournament]);
  const previewMetrics = useMemo(() => {
    if (!hasPreview) return null;
    const previewGames = generationMode === 'slot' ? generatedSlotGames : generatedGames;
    return buildScheduleMetrics({
      games: previewGames,
      teams: generationMode === 'slot' ? [] : teams,
      divisions,
      venues,
      tournament,
      divisionId: selectedGroupId,
      expectedGamesPerParticipant: gamesPerTeam,
      gameDurationMinutes: gameLength,
      bufferMinutes: breakLength,
      manualTravelBuffers,
      maxGamesPerDay: priorities.maxGamesPerDay,
      includePlayoffs: generationScope === 'build',
    });
  }, [
    hasPreview,
    generationMode,
    generatedSlotGames,
    generatedGames,
    teams,
    divisions,
    venues,
    tournament,
    manualTravelBuffers,
    selectedGroupId,
    gamesPerTeam,
    gameLength,
    breakLength,
    priorities.maxGamesPerDay,
    generationScope,
  ]);

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
    return totalSlots;
  }

  function getPartialContext(): PartialGenerationContext {
    if (generationScope !== 'build' || !canBuildFromCurrent) {
      return { enabled: false, preservedGames: [], replaceableGames: [], fixedAssignments: [] };
    }

    return {
      enabled: true,
      preservedGames: preservedExistingGames,
      replaceableGames: replaceableExistingGames,
      fixedAssignments: preservedExistingGames.map(gameToFixedAssignment),
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
      venueName: game.location,
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
        detail: `Health ${draft.metrics.healthScore}/100 | B2B ${draft.metrics.backToBackCount} | Moves ${movement} | Max/day ${draft.metrics.maxGamesInDay}`,
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
    if (index === 0) return 'Best overall';
    const baselineMovement = baseline.metrics.venueChangeCount + baseline.metrics.facilityChangeCount;
    if (movement === bestMovement && movement < baselineMovement) return 'Fewest moves';
    if (draft.metrics.backToBackCount === bestBackToBack && draft.metrics.backToBackCount < baseline.metrics.backToBackCount) return 'Fewest back-to-backs';
    if ((draft.metrics.minRestMinutes ?? 0) === bestRest && (draft.metrics.minRestMinutes ?? 0) > (baseline.metrics.minRestMinutes ?? 0)) return 'Best rest';
    if (draft.metrics.maxGamesInDay === bestMaxDay && draft.metrics.maxGamesInDay < baseline.metrics.maxGamesInDay) return 'Lightest days';
    if (draft.metrics.healthScore > baseline.metrics.healthScore) return 'Highest health';
    return `Option ${index + 1}`;
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
    setDraftSummary(option.summary);
  }

  function applyPartialPreviewContext(partial: PartialGenerationContext) {
    setReplaceableGameIds(partial.enabled ? partial.replaceableGames.map(game => game.id) : []);
    setPreservedGameCount(partial.enabled ? partial.preservedGames.length : 0);
    setLockedGameCount(
      partial.enabled
        ? partial.preservedGames.filter(game => !game.isPlayoff && game.status === 'scheduled' && game.generatorLocked).length
        : 0,
    );
    setReplacementGameCount(partial.enabled ? partial.replaceableGames.length : 0);
  }

  function selectDraftOption(index: number) {
    const option = draftOptions[index];
    if (!option) return;
    setSelectedDraftOptionIndex(index);
    setGeneratedGames(option.games);
    setGeneratedSlotGames(option.slotGames);
    setGamesToCommit(option.gamesToCommit);
    setSlotGamesToCommit(option.slotGamesToCommit);
    setDraftSummary(option.summary);
  }

  function generate(draftSeed = 0) {
    setError(null);
    if (dateSlots.some(s => !s.date)) { setError('Please select a date for all slots'); return; }

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
    if (groupTeams.length < 2) { setError('Need at least 2 teams to generate a schedule'); return; }
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
          players: [],
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

    const preservedMatchupKeys = new Set(
      partial.preservedGames
        .map(game => teamMatchupKey(game.homeTeamId, game.awayTeamId))
        .filter((key): key is string => Boolean(key)),
    );
    const matchupsToGenerate = partial.enabled
      ? allMatchups.filter(match => !preservedMatchupKeys.has(teamMatchupKey(match.home.id, match.away.id) ?? ''))
      : allMatchups;

    if (matchupsToGenerate.length === 0) {
      if (partial.enabled && partial.preservedGames.length > 0) {
        const preservedGames = partial.preservedGames.map(stripGameId);
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
          label: 'Current schedule',
          detail: `Health ${metrics.healthScore}/100 | B2B ${metrics.backToBackCount} | Moves ${metrics.venueChangeCount + metrics.facilityChangeCount} | Max/day ${metrics.maxGamesInDay}`,
          summary: { score: metrics.healthScore, healthScore: metrics.healthScore, candidateCount: 0 },
          games: preservedGames,
          slotGames: [],
          gamesToCommit: [],
          slotGamesToCommit: [],
        }], draftSeed);
        applyPartialPreviewContext(partial);
        return;
      }
      setError('No matchups could be generated. Check your pool assignments.');
      return;
    }

    const totalSlots = buildTimeSlots(resourceList);
    if (totalSlots.length < matchupsToGenerate.length) {
      setError(`Not enough time slots to schedule ${matchupsToGenerate.length} games. Need ${matchupsToGenerate.length} slots, but only have ${totalSlots.length} available.`);
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
      setError('No valid draft could be generated without overlapping a team. Try adding more dates or venues.');
      return;
    }

    applyDraftOptions(buildDraftOptions(drafts, draft => {
      const gamesToCommit = createTeamGamesFromDraft(draft);
      return {
        games: partial.enabled ? [...partial.preservedGames.map(stripGameId), ...gamesToCommit] : gamesToCommit,
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
        .map(game => slotMatchupKey(
          game.homePlaceholder || getTeamLabel(game.homeTeamId),
          game.awayPlaceholder || getTeamLabel(game.awayTeamId),
        ))
        .filter((key): key is string => Boolean(key)),
    );
    const matchupsToGenerate = partial.enabled
      ? allMatchups.filter(match => !preservedMatchupKeys.has(slotMatchupKey(match.homeLabel, match.awayLabel) ?? ''))
      : allMatchups;

    if (matchupsToGenerate.length === 0) {
      if (partial.enabled && partial.preservedGames.length > 0) {
        const preservedSlotGames = partial.preservedGames.map(stripGameIdToSlotGame);
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
          label: 'Current schedule',
          detail: `Health ${metrics.healthScore}/100 | B2B ${metrics.backToBackCount} | Moves ${metrics.venueChangeCount + metrics.facilityChangeCount} | Max/day ${metrics.maxGamesInDay}`,
          summary: { score: metrics.healthScore, healthScore: metrics.healthScore, candidateCount: 0 },
          games: [],
          slotGames: preservedSlotGames,
          gamesToCommit: [],
          slotGamesToCommit: [],
        }], draftSeed);
        applyPartialPreviewContext(partial);
        return;
      }
      setError('No matchups could be generated. Check slot counts (minimum 2).');
      return;
    }

    const totalSlots = buildTimeSlots(resourceList);
    if (totalSlots.length < matchupsToGenerate.length) {
      setError(`Not enough time slots for ${matchupsToGenerate.length} games. Need ${matchupsToGenerate.length} slots but have ${totalSlots.length}.`);
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
      setError('No valid slot draft could be generated without overlapping a slot. Try adding more dates or venues.');
      return;
    }

    applyDraftOptions(buildDraftOptions(drafts, draft => {
      const slotGamesToCommit = createSlotGamesFromDraft(draft);
      return {
        games: [],
        slotGames: partial.enabled ? [...partial.preservedGames.map(stripGameIdToSlotGame), ...slotGamesToCommit] : slotGamesToCommit,
        gamesToCommit: [],
        slotGamesToCommit,
      };
    }), draftSeed);
    applyPartialPreviewContext(partial);
  }

  async function commit() {
    setShowConfirm(false);
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
      await deleteGamesForCurrentScope();
      if (gamesToSave.length > 0) {
        const res = await fetch(`/api/admin/games${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk-save', games: gamesToSave, tournamentId: tournament.id, divisionId: selectedGroupId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save games');
      }
      onComplete();
    } catch (e: unknown) {
      setError(`Failed to save games: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCommitting(false);
    }
  }

  async function commitSlots() {
    setCommitting(true);
    try {
      const slotGamesToSave = await materializeTemporaryFacilityLanes(slotGamesToCommit);
      await deleteGamesForCurrentScope();

      if (slotGamesToSave.length === 0) {
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

      const saveRes = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-save', games: gameRows, tournamentId: tournament.id, divisionId: selectedGroupId }),
      });
      if (!saveRes.ok) throw new Error((await saveRes.json()).error || 'Failed to save games');
      onComplete();
    } catch (e: unknown) {
      setError(`Failed to save schedule: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCommitting(false);
    }
  }

  async function deleteGamesForCurrentScope() {
    const body = generationScope === 'build'
      ? { action: 'delete-games', tournamentId: tournament.id, gameIds: replaceableGameIds }
      : { action: 'delete-division-games', divisionId: selectedGroupId };

    if (generationScope === 'build' && replaceableGameIds.length === 0) return;

    const res = await fetch(`/api/admin/games${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to clear existing games');
  }

  function reset() {
    setGeneratedGames([]);
    setGeneratedSlotGames([]);
    setGamesToCommit([]);
    setSlotGamesToCommit([]);
    setReplaceableGameIds([]);
    setPreservedGameCount(0);
    setLockedGameCount(0);
    setReplacementGameCount(0);
    setDraftSummary(null);
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
  const isBuildPreview = generationScope === 'build' && hasPreview;
  const replaceAllClearsLockedGames = generationScope === 'replace' && lockedExistingGameCount > 0;
  const lockedGameLabel = `${lockedExistingGameCount} kept ${lockedExistingGameCount === 1 ? 'game' : 'games'}`;

  return (
    <div className={styles.generatorOverlay}>
      <div className={styles.generatorModal}>
        <div className={styles.generatorHeader}>
          <h3><Sparkles size={18} /> Schedule Generator</h3>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><X size={18} /></button>
        </div>

        {!hasPreview ? (
          <div className={styles.generatorForm}>

            {/* ── Section 1: Setup ── */}
            <div className={styles.generatorSection}>
              <p className={styles.generatorStepLabel}>1. Schedule Setup</p>

              {/* Mode toggle */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Generation Mode</label>
                <div className={styles.generatorSegmented}>
                  <button
                    type="button"
                    className={`${styles.generatorSegBtn} ${generationMode === 'team' ? styles.generatorSegBtnActive : ''}`}
                    onClick={() => setGenerationMode('team')}
                  >
                    Team-based
                  </button>
                  <button
                    type="button"
                    className={`${styles.generatorSegBtn} ${generationMode === 'slot' ? styles.generatorSegBtnActive : ''}`}
                    onClick={() => setGenerationMode('slot')}
                  >
                    Slot-based
                  </button>
                </div>
                {generationMode === 'team' ? (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--white-40)', lineHeight: 1.5 }}>
                    Schedules accepted teams directly. Teams must be registered and accepted before generating.
                  </p>
                ) : (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--white-40)', lineHeight: 1.5 }}>
                    {poolList.length > 0
                      ? <>Creates a schedule using placeholder names (e.g. &quot;Pool A Team 1&quot;). Team names appear publicly once all slots in a pool are assigned.</>
                      : <>Creates a division-wide schedule using placeholder names (e.g. &quot;{currentGroup?.name ?? 'Division'} Team 1&quot;) without requiring pools.</>
                    }
                  </p>
                )}
              </div>

            {canBuildFromCurrent && (
              <div className={styles.scopeStrip}>
                <div className={styles.scopeCopy}>
                  <span>Schedule Scope</span>
                  <small>
                    {preservedExistingGames.length} protected
                    {lockedExistingGameCount > 0 ? ` (${lockedExistingGameCount} manually kept)` : ''}
                    {' - '}
                    {replaceableExistingGames.length} scheduled replaceable
                  </small>
                </div>
                <div className={styles.scopeButtons} role="group" aria-label="Schedule generation scope">
                  <button
                    type="button"
                    className={`${styles.scopeButton} ${generationScope === 'replace' ? styles.scopeButtonActive : ''}`}
                    title={lockedExistingGameCount > 0 ? 'Clears the division schedule before saving this draft, including manually kept games.' : 'Clears the division schedule before saving this draft.'}
                    aria-pressed={generationScope === 'replace'}
                    onClick={() => setGenerationScope('replace')}
                  >
                    Replace all
                  </button>
                  <button
                    type="button"
                    className={`${styles.scopeButton} ${generationScope === 'build' ? styles.scopeButtonActive : ''}`}
                    title="Keeps submitted, completed, cancelled, playoff, and manually kept games while replacing unlocked scheduled round-robin drafts."
                    aria-pressed={generationScope === 'build'}
                    onClick={() => setGenerationScope('build')}
                  >
                    Build from current
                  </button>
                </div>
                {replaceAllClearsLockedGames && (
                  <div className={styles.scopeWarning}>
                    <AlertTriangle size={13} />
                    <span>Replace all will also clear <strong>{lockedGameLabel}</strong>. Use Build from current to preserve kept games.</span>
                  </div>
                )}
              </div>
            )}

            <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Division</label>
                <select className="form-select" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                  {divisions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Games per {generationMode === 'slot' ? 'Slot' : 'Team'}</label>
                <input
                  type="number"
                  className={`form-input ${styles.compactNumberInput}`}
                  min="1"
                  max="10"
                  value={gamesPerTeam}
                  onChange={e => setGamesPerTeam(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Slot count per pool or division (slot mode only) */}
            {generationMode === 'slot' && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">{poolList.length === 0 ? 'Division Slots' : 'Teams per Pool'}</label>
                {poolList.length === 0 ? (
                  <div className={styles.slotControlGrid}>
                    <label className={styles.slotCountControl}>
                      <span>{currentGroup?.name ?? 'Division'} slots</span>
                      <input
                        type="number"
                        className="form-input"
                        min="2"
                        max="32"
                        value={slotCountOverride[DIVISION_SLOT_POOL_ID] ?? defaultSlotCount(DIVISION_SLOT_POOL_ID)}
                        onChange={e => setSlotCountOverride(prev => ({ ...prev, [DIVISION_SLOT_POOL_ID]: Number(e.target.value) }))}
                      />
                      <small>One placeholder team per slot.</small>
                    </label>
                  </div>
                ) : (
                  <div className={styles.slotControlGrid}>
                    {poolList.map(pool => (
                      <label key={pool.id} className={styles.slotCountControl}>
                        <span>{pool.name}</span>
                        <input
                          type="number"
                          className="form-input"
                          min="2"
                          max="16"
                          value={slotCountOverride[pool.id] ?? defaultSlotCount(pool.id)}
                          onChange={e => setSlotCountOverride(prev => ({ ...prev, [pool.id]: Number(e.target.value) }))}
                        />
                        <small>Placeholder teams in this pool.</small>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            </div>{/* end section 1 */}

            {/* ── Section 2: Dates & Timing ── */}
            <div className={styles.generatorSection}>
              <p className={styles.generatorStepLabel}>2. Dates & Timing</p>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Available Scheduling Dates
                <button type="button" className="btn btn-ghost btn-sm" onClick={addDateSlot} style={{ color: 'var(--logic-lime)' }}>
                  <Plus size={14} /> Add Date
                </button>
              </label>
              <div className={styles.dateSlotList}>
                {dateSlots.map((slot, idx) => (
                  <div key={idx} className={styles.dateSlotRow}>
                    <select className={styles.dateSlotSelect} value={slot.date} onChange={e => updateDateSlot(idx, { date: e.target.value })}>
                      <option value="">Select date…</option>
                      {availableDates.map(d => (
                        <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</option>
                      ))}
                    </select>
                    <input type="time" className={styles.dateSlotTime} value={slot.startTime} onChange={e => updateDateSlot(idx, { startTime: e.target.value })} />
                    <span className={styles.dateSlotSep}>–</span>
                    <input type="time" className={styles.dateSlotTime} value={slot.endTime} onChange={e => updateDateSlot(idx, { endTime: e.target.value })} />
                    <button type="button" className={`btn btn-ghost btn-data ${styles.dateSlotDel}`} onClick={() => removeDateSlot(idx)} disabled={dateSlots.length === 1}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-row form-row-2" style={{ marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Game Duration (min)</label>
                <input type="number" className={`form-input ${styles.compactNumberInput}`} value={gameLength} onChange={e => setGameLength(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Turnover Time (min)</label>
                <input type="number" className={`form-input ${styles.compactNumberInput}`} value={breakLength} onChange={e => setBreakLength(Number(e.target.value))} />
                <small className={styles.fieldHint}>Gap between games at the same facility.</small>
              </div>
            </div>

            </div>{/* end section 2 */}

            {/* ── Section 3: Scheduling Priorities ── */}
            <div className={styles.generatorSection}>
              <p className={styles.generatorStepLabel}>3. Scheduling Priorities</p>

            <div className={styles.priorityPanel}>
              <div className={styles.priorityHeader}>
                <span>Preset</span>
                <small>Best of {priorities.candidateCount}</small>
              </div>
              <div className={styles.presetRail} role="group" aria-label="Schedule priority presets">
                {SCHEDULE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.presetButton} ${selectedPresetId === preset.id ? styles.presetButtonActive : ''}`}
                    title={preset.description}
                    aria-pressed={selectedPresetId === preset.id}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className={styles.presetHint}>{presetDescription}</p>
              <details className={styles.advancedDrawer}>
                <summary className={styles.advancedSummary}>
                  <SlidersHorizontal size={11} /> Advanced Settings
                </summary>
                <div className={styles.advancedDrawerContent}>
                  <div className={styles.prioritySection}>
                    <div className={styles.prioritySectionHeader}>
                      <span>Limits</span>
                      <small>Hard caps used during generation</small>
                    </div>
                    <div className={styles.limitsRow}>
                      <label className={styles.limitItem} title="Caps how many games one team or slot can play in a day.">
                        <span className={styles.limitLabel}>Max / day</span>
                        <input
                          type="number"
                          className={styles.limitInput}
                          min="1"
                          max="6"
                          value={priorities.maxGamesPerDay}
                          onChange={e => updatePriorities({ maxGamesPerDay: Number(e.target.value) })}
                        />
                        <small className={styles.limitUnit}>per team</small>
                      </label>
                      <label className={styles.limitItem} title="Minimum time between games for the same team or slot.">
                        <span className={styles.limitLabel}>Min rest</span>
                        <input
                          type="number"
                          className={styles.limitInput}
                          min="0"
                          max="360"
                          step="15"
                          value={priorities.minRestMinutes}
                          onChange={e => updatePriorities({ minRestMinutes: Number(e.target.value) })}
                        />
                        <small className={styles.limitUnit}>min between games</small>
                      </label>
                    </div>
                  </div>
                  <div className={styles.prioritySection}>
                    <div className={styles.prioritySectionHeader}>
                      <span>Preferences</span>
                      <small>Scoring tradeoffs for better drafts</small>
                    </div>
                    <div className={styles.effortRow}>
                      <span className={styles.limitLabel}>Effort</span>
                      <select
                        className="form-select"
                        value={priorities.candidateCount}
                        onChange={e => updatePriorities({ candidateCount: Number(e.target.value) })}
                      >
                        <option value={12}>Fast</option>
                        <option value={24}>Balanced</option>
                        <option value={40}>Deep</option>
                      </select>
                      <small className={styles.effortHint}>{currentEffortDescription}</small>
                    </div>
                    <div className={styles.prefChecks}>
                      <label className={styles.prefCheck} title="Scores drafts higher when teams have rest between games.">
                        <input
                          type="checkbox"
                          checked={priorities.avoidBackToBack}
                          onChange={e => updatePriorities({ avoidBackToBack: e.target.checked })}
                        />
                        <span>Avoid back-to-back</span>
                      </label>
                      <label className={styles.prefCheck} title="Scores drafts higher when teams stay at the same selected facility.">
                        <input
                          type="checkbox"
                          checked={priorities.reduceVenueChanges}
                          onChange={e => updatePriorities({ reduceVenueChanges: e.target.checked })}
                        />
                        <span>Reduce facility moves</span>
                      </label>
                      <label className={styles.prefCheck} title="Scores drafts higher when early and late games are spread more evenly.">
                        <input
                          type="checkbox"
                          checked={priorities.balanceTimeSlots}
                          onChange={e => updatePriorities({ balanceTimeSlots: e.target.checked })}
                        />
                        <span>Balance early/late</span>
                      </label>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            </div>{/* end section 3 */}

            {/* ── Section 4: Facilities ── */}
            <div className={styles.generatorSection}>
              <p className={styles.generatorStepLabel}>4. Available Facilities</p>

            <div className="form-group">
              <small className={styles.fieldHint} style={{ display: 'block', marginBottom: '0.45rem' }}>Select which fields or diamonds the generator can assign games to.</small>
              {venues.length > 0 && (
                <div className={styles.facilityPickerHeader}>
                  <span>{selectedResourceCount} / {totalResourceCount} selected</span>
                  <div className={styles.facilityPickerActions}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllResources}>All</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearResources}>None</button>
                  </div>
                </div>
              )}
              {venues.length > 0 && (
                <div className={styles.facilityPicker}>
                  {venues.map(venue => {
                    const resourceKeys = getVenueResourceKeys(venue);
                    const selectedCount = resourceKeys.filter(key => selectedResourceKeys.has(key)).length;
                    const allSelected = selectedCount === resourceKeys.length;
                    const facilities = venue.facilities ?? [];
                    return (
                      <div key={venue.id} className={styles.facilityVenueGroup}>
                        <label className={styles.facilityVenueCheck}>
                          <input type="checkbox" checked={allSelected} onChange={() => toggleVenueResources(venue)} />
                          <span className={styles.facilityVenueName}>
                            <strong>{venue.name}</strong>
                            <small>{selectedCount} / {resourceKeys.length} selected</small>
                          </span>
                        </label>
                        {facilities.length > 0 ? (
                          <div className={styles.facilityChildGrid}>
                            {facilities.map(facility => {
                              const key = facilityResourceKey(facility.id);
                              return (
                                <label key={facility.id} className={styles.facilityCheck}>
                                  <input type="checkbox" checked={selectedResourceKeys.has(key)} onChange={() => toggleResource(key)} />
                                  <span>{facility.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className={styles.facilityEmptyText}>No facilities listed. Selecting the venue uses one scheduling lane.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {(venues.length === 0 || selectedResourceCount === 0) && (
                <div className={styles.temporaryFacilityPanel}>
                  <div>
                    <strong>Use temporary facilities</strong>
                    <span>Schedules can be generated now and resolved to real venues later.</span>
                  </div>
                  <label>
                    <span>Facilities</span>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="16"
                      value={temporaryFacilityCount}
                      onChange={e => setTemporaryFacilityCount(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
            </div>

            </div>{/* end section 4 */}

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <div className={styles.generateBtnWrap}>
              <button className="btn btn-lime btn-data" onClick={() => generate(0)}>
                Generate Round Robin Draft
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.generatorPreview}>
            <div className={styles.previewStats}>
              <span>
                Previewing <strong>{previewCount}</strong> games for <strong>{divisionName}</strong>
                {generationMode === 'slot' && <span className="badge badge-neutral" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>SLOT SCHEDULE</span>}
              </span>
              <div className={styles.previewActions}>
                <button className="btn btn-ghost btn-data" onClick={generateAnotherDraftSet}><RefreshCw size={13} /> Another Set</button>
                <button className="btn btn-ghost btn-data" onClick={reset}>Start Over</button>
              </div>
            </div>

            {isBuildPreview && (
              <div className={styles.partialPreviewSummary}>
                <span>Build from current</span>
                <strong>{preservedGameCount}</strong>
                <small>kept</small>
                <strong>{lockedGameCount}</strong>
                <small>locked</small>
                <strong>{replacementGameCount}</strong>
                <small>replaceable</small>
                <strong>{previewGeneratedCount}</strong>
                <small>new</small>
              </div>
            )}

            {draftSummary && (
              <div className={styles.optimizationSummary}>
                <span><Sparkles size={13} /> Set {draftSetIndex + 1} | Best of {draftSummary.candidateCount} drafts</span>
                <strong>{draftSummary.score}</strong>
                <small>Health {draftSummary.healthScore}/100</small>
              </div>
            )}

            {draftOptions.length > 1 && (
              <div className={styles.draftOptionGrid} role="group" aria-label="Generated draft options">
                {draftOptions.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.draftOptionCard} ${selectedDraftOptionIndex === index ? styles.draftOptionCardActive : ''}`}
                    aria-pressed={selectedDraftOptionIndex === index}
                    onClick={() => selectDraftOption(index)}
                  >
                    <span>{option.label}</span>
                    <strong>{option.summary.healthScore}<small>/100</small></strong>
                    <em>{option.detail}</em>
                  </button>
                ))}
              </div>
            )}

            {generationMode === 'slot' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.85rem', background: 'var(--white-5)', borderRadius: '2px', margin: '0.65rem 0', fontSize: '0.75rem', color: 'var(--white-60)', lineHeight: 1.5 }}>
                <Info size={13} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--blueprint-blue)' }} />
                {poolList.length > 0
                  ? 'Team names will appear publicly only once all slots in each pool are assigned via the Slot Assignments tab.'
                  : 'This division-wide draft uses placeholders and does not require pools. Save it now, then assign real teams manually or regenerate team-based when teams are final.'
                }
              </div>
            )}

            {previewMetrics && (
              <ScheduleHealthPanel
                metrics={previewMetrics}
                title="Draft Health"
                subtitle={`${divisionName} · ${generationMode === 'slot' ? 'Slot schedule' : 'Team schedule'}`}
                showTeamTable
              />
            )}

            {(() => {
              const usePools = generationMode === 'slot' ? poolList.length > 0 : (currentGroup?.poolCount || 0) >= 2;
              return (
                <div className={styles.previewTableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Matchup</th>
                        {usePools && <th>Pool</th>}
                        <th>Facility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generationMode === 'slot' ? (
                        generatedSlotGames.map((g, i) => {
                          const pool = poolList.find(p => p.id === g.homePoolId);
                          return (
                            <tr key={i}>
                              <td>{new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · <strong>{formatTime(g.time)}</strong></td>
                              <td>{g.homePlaceholder} vs {g.awayPlaceholder}</td>
                              {usePools && <td><span className="badge badge-neutral">{pool?.name ?? '—'}</span></td>}
                              <td>{g.location}</td>
                            </tr>
                          );
                        })
                      ) : (
                        generatedGames.map((g, i) => {
                          const homeTeam = teams.find(t => t.id === g.homeTeamId);
                          const awayTeam = teams.find(t => t.id === g.awayTeamId);
                          const poolRecord = usePools ? currentGroup?.pools?.find(p => p.id === homeTeam?.poolId) : null;
                          return (
                            <tr key={i}>
                              <td>{new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · <strong>{formatTime(g.time)}</strong></td>
                              <td>{homeTeam?.name} vs {awayTeam?.name}</td>
                              {usePools && <td><span className="badge badge-neutral">{poolRecord?.name ?? 'Unassigned'}</span></td>}
                              <td>{g.location}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <div className={styles.previewFooter}>
              <button className="btn btn-ghost btn-data" onClick={reset} disabled={committing}>Cancel</button>
              <button className="btn btn-lime btn-data" onClick={() => setShowConfirm(true)} disabled={committing}>
                {committing ? <><RefreshCw className="spin" size={14} /> Saving…</> : <><Check size={14} /> Commit Schedule</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: 'var(--white-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.65rem', color: 'var(--logic-lime)' }}>
                <AlertCircle size={18} />
              </div>
              <h3>Commit Schedule?</h3>
            </div>
            <p>
              {generationScope === 'build'
                ? <>This will keep <strong>{preservedGameCount}</strong> protected games{lockedGameCount > 0 ? <> (<strong>{lockedGameCount}</strong> manually kept)</> : null}, replace <strong>{replacementGameCount}</strong> scheduled round-robin games, and save <strong>{previewGeneratedCount}</strong> newly generated games for <strong>{divisionName}</strong>.</>
                : generationMode === 'slot'
                  ? <>This will save a slot-based schedule and <strong style={{ color: 'var(--danger)' }}>permanently clear</strong> any existing games for <strong>{divisionName}</strong>{replaceAllClearsLockedGames ? <>, including <strong style={{ color: 'var(--warning)' }}>{lockedGameLabel}</strong></> : null}. {poolList.length > 0 ? 'Team names will appear publicly once all slots are assigned.' : 'Division-wide placeholders will be saved without pool assignments.'}</>
                  : <>This will save the generated schedule and <strong style={{ color: 'var(--danger)' }}>permanently clear</strong> any existing games for the <strong>{divisionName}</strong> division{replaceAllClearsLockedGames ? <>, including <strong style={{ color: 'var(--warning)' }}>{lockedGameLabel}</strong></> : null}.</>
              }
            </p>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost btn-data" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-lime btn-data" onClick={commit}>
                <Check size={14} /> Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
