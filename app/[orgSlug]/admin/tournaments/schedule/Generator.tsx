'use client';
import { useState, useMemo } from 'react';
import { Sparkles, Check, X, RefreshCw, AlertCircle, Plus, Trash2, Info, SlidersHorizontal } from 'lucide-react';
import { Team, Division, Venue, Game, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { buildScheduleMetrics } from '@/lib/schedule-metrics';
import {
  defaultSchedulePriorities,
  generateScoredSchedule,
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

type PoolSlotEnsureRow = { poolId: string; slotNumber: number; id: string; displayName: string };
type FacilityLaneEnsureRow = { id: string; label: string };

interface ScheduleResource {
  key: string;
  venueId: string;
  venueName: string;
  venueFacilityId?: string | null;
  label: string;
}

const DIVISION_SLOT_POOL_ID = '__division__';
const EFFORT_DESCRIPTIONS: Record<number, string> = {
  12: 'Fast checks fewer drafts and returns quicker.',
  24: 'Balanced checks more drafts without making generation feel slow.',
  40: 'Deep checks the most drafts for tougher schedules.',
};

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
  onComplete: () => void;
  onCancel: () => void;
}

export default function ScheduleGenerator({ tournament, orgSlug, divisions, teams, venues, onComplete, onCancel }: GeneratorProps) {
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
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: tournament.startDate || '', startTime: '09:00', endTime: '20:30' }
  ]);

  const [generationMode, setGenerationMode] = useState<'team' | 'slot'>('team');
  const [slotCountOverride, setSlotCountOverride] = useState<Record<string, number>>({});

  const [generatedGames, setGeneratedGames] = useState<Omit<Game, 'id'>[]>([]);
  const [generatedSlotGames, setGeneratedSlotGames] = useState<SlotGame[]>([]);
  const [draftSummary, setDraftSummary] = useState<DraftOptimizationSummary | null>(null);
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
      maxGamesPerDay: priorities.maxGamesPerDay,
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
    selectedGroupId,
    gamesPerTeam,
    gameLength,
    breakLength,
    priorities.maxGamesPerDay,
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

  function generate() {
    setError(null);
    if (dateSlots.some(s => !s.date)) { setError('Please select a date for all slots'); return; }

    if (generationMode === 'slot') {
      generateSlots(selectedResources);
    } else {
      generateTeams(selectedResources);
    }
  }

  function generateTeams(resourceList: ScheduleResource[]) {
    const groupTeams = teams.filter(t => t.divisionId === selectedGroupId);
    if (groupTeams.length < 2) { setError('Need at least 2 teams to generate a schedule'); return; }

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

    if (allMatchups.length === 0) { setError('No matchups could be generated. Check your pool assignments.'); return; }

    const totalSlots = buildTimeSlots(resourceList);
    if (totalSlots.length < allMatchups.length) {
      setError(`Not enough time slots to schedule ${allMatchups.length} games. Need ${allMatchups.length} slots, but only have ${totalSlots.length} available.`);
      return;
    }

    const newGames: Omit<Game, 'id'>[] = [];
    const participants: ScheduleDraftParticipant[] = groupTeams.map(team => ({
      id: team.id,
      label: team.name,
      divisionId: team.divisionId,
      status: team.status,
    }));
    const draftMatchups: ScheduleDraftMatchup<{ home: Team; away: Team }>[] = allMatchups.map(match => ({
      homeParticipantId: match.home.id,
      awayParticipantId: match.away.id,
      homeLabel: match.home.name,
      awayLabel: match.away.name,
      homeMetric: { teamId: match.home.id },
      awayMetric: { teamId: match.away.id },
      poolId: match.home.poolId ?? null,
      payload: match,
    }));
    const draft = generateScoredSchedule({
      tournamentId: tournament.id,
      divisionId: selectedGroupId,
      matchups: draftMatchups,
      slots: totalSlots,
      participants,
      expectedGamesPerParticipant: gamesPerTeam,
      gameDurationMinutes: gameLength,
      bufferMinutes: breakLength,
      priorities,
    });

    if (!draft) {
      setError('No valid draft could be generated without overlapping a team. Try adding more dates or venues.');
      return;
    }

    draft.assignments.forEach(assignment => {
      newGames.push({
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
      });
    });

    setGeneratedSlotGames([]);
    setGeneratedGames(newGames);
    setDraftSummary({ score: draft.score, healthScore: draft.metrics.healthScore, candidateCount: draft.candidateCount });
  }

  function generateSlots(resourceList: ScheduleResource[]) {
    const allMatchups: ScheduleDraftMatchup<SlotPayload>[] = [];
    const participantMap = new Map<string, ScheduleDraftParticipant>();

    const addSlotRoundRobin = (params: { poolId: string | null; groupName: string; count: number }) => {
      const { poolId, groupName, count } = params;
      if (count < 2) return;
      for (let slotNum = 1; slotNum <= count; slotNum++) {
        const participantId = `${poolId ?? selectedGroupId}-${slotNum}`;
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
            const homeId = `${poolId ?? selectedGroupId}-${home}`;
            const awayId = `${poolId ?? selectedGroupId}-${away}`;
            const homeName = `${groupName} Team ${home}`;
            const awayName = `${groupName} Team ${away}`;
            allMatchups.push({
              homeParticipantId: homeId,
              awayParticipantId: awayId,
              homeLabel: homeName,
              awayLabel: awayName,
              homeMetric: { slotId: homeId, placeholder: homeName },
              awayMetric: { slotId: awayId, placeholder: awayName },
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

    if (allMatchups.length === 0) { setError('No matchups could be generated. Check slot counts (minimum 2).'); return; }

    const totalSlots = buildTimeSlots(resourceList);
    if (totalSlots.length < allMatchups.length) {
      setError(`Not enough time slots for ${allMatchups.length} games. Need ${allMatchups.length} slots but have ${totalSlots.length}.`);
      return;
    }

    const newGames: SlotGame[] = [];
    const draft = generateScoredSchedule({
      tournamentId: tournament.id,
      divisionId: selectedGroupId,
      matchups: allMatchups,
      slots: totalSlots,
      participants: Array.from(participantMap.values()),
      expectedGamesPerParticipant: gamesPerTeam,
      gameDurationMinutes: gameLength,
      bufferMinutes: breakLength,
      priorities,
    });

    if (!draft) {
      setError('No valid slot draft could be generated without overlapping a slot. Try adding more dates or venues.');
      return;
    }

    draft.assignments.forEach(assignment => {
      const match = assignment.payload;
      newGames.push({
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
      });
    });

    setGeneratedGames([]);
    setGeneratedSlotGames(newGames);
    setDraftSummary({ score: draft.score, healthScore: draft.metrics.healthScore, candidateCount: draft.candidateCount });
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
      const gamesToSave = await materializeTemporaryFacilityLanes(generatedGames);
      await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-division-games', divisionId: selectedGroupId }),
      });
      const res = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-save', games: gamesToSave, tournamentId: tournament.id, divisionId: selectedGroupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save games');
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
      const slotGamesToSave = await materializeTemporaryFacilityLanes(generatedSlotGames);
      // 1. Clear existing games for this division
      await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-division-games', divisionId: selectedGroupId }),
      });

      // 2. Save division-wide placeholders directly, or resolve pool slot IDs first.
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

      // 3. Bulk save
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

  function reset() {
    setGeneratedGames([]);
    setGeneratedSlotGames([]);
    setDraftSummary(null);
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

  function updatePriorities(updates: Partial<SchedulePrioritySettings>) {
    setPriorities(current => ({ ...current, ...updates }));
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

  return (
    <div className={styles.generatorOverlay}>
      <div className={styles.generatorModal}>
        <div className={styles.generatorHeader}>
          <h3><Sparkles size={18} /> Schedule Generator</h3>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><X size={18} /></button>
        </div>

        {!hasPreview ? (
          <div className={styles.generatorForm}>

            {/* Mode toggle */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Generation Mode</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${generationMode === 'team' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGenerationMode('team')}
                >
                  Team-based
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${generationMode === 'slot' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGenerationMode('slot')}
                >
                  Slot-based
                </button>
              </div>
              {generationMode === 'slot' && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--white-40)', lineHeight: 1.5 }}>
                  {poolList.length > 0
                    ? <>Creates a schedule using placeholder names (e.g. &quot;Pool A Team 1&quot;). Team names appear publicly once all slots in a pool are assigned.</>
                    : <>Creates a division-wide schedule using placeholder names (e.g. &quot;{currentGroup?.name ?? 'Division'} Team 1&quot;) without requiring pools.</>
                  }
                </p>
              )}
            </div>

            <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
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
                  className="form-input"
                  min="1"
                  max="10"
                  value={gamesPerTeam}
                  onChange={e => setGamesPerTeam(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Slot count per pool or division (slot mode only) */}
            {generationMode === 'slot' && (
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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
                    <div className="form-group" style={{ flex: 2 }}>
                      <select className="form-select" value={slot.date} onChange={e => updateDateSlot(idx, { date: e.target.value })}>
                        <option value="">Select Date...</option>
                        {availableDates.map(d => (
                          <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <input type="time" className="form-input" value={slot.startTime} onChange={e => updateDateSlot(idx, { startTime: e.target.value })} />
                    </div>
                    <div style={{ alignSelf: 'center', color: 'var(--white-20)' }}>to</div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <input type="time" className="form-input" value={slot.endTime} onChange={e => updateDateSlot(idx, { endTime: e.target.value })} />
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDateSlot(idx)} disabled={dateSlots.length === 1}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Game Duration (min)</label>
                <input type="number" className="form-input" value={gameLength} onChange={e => setGameLength(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Turnover Time (min)</label>
                <input type="number" className="form-input" value={breakLength} onChange={e => setBreakLength(Number(e.target.value))} />
              </div>
            </div>

            <div className={styles.priorityPanel}>
              <div className={styles.priorityHeader}>
                <span><Sparkles size={14} /> Scheduling Priorities</span>
                <small>Best of {priorities.candidateCount}</small>
              </div>
              <div className={styles.prioritySection}>
                <div className={styles.prioritySectionHeader}>
                  <span>Limits</span>
                  <small>Hard caps used during generation</small>
                </div>
                <div className={styles.priorityGrid}>
                  <label className={styles.priorityField} title="Caps how many games one team or slot can play in a day.">
                    <span>Max / day</span>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="6"
                      value={priorities.maxGamesPerDay}
                      onChange={e => updatePriorities({ maxGamesPerDay: Number(e.target.value) })}
                    />
                    <small>Per team or slot.</small>
                  </label>
                  <label className={styles.priorityField} title="Minimum time between games for the same team or slot.">
                    <span>Min rest</span>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="360"
                      step="15"
                      value={priorities.minRestMinutes}
                      onChange={e => updatePriorities({ minRestMinutes: Number(e.target.value) })}
                    />
                    <small>Minutes between games.</small>
                  </label>
                </div>
              </div>
              <div className={styles.prioritySection}>
                <div className={styles.prioritySectionHeader}>
                  <span><SlidersHorizontal size={13} /> Preferences</span>
                  <small>Scoring tradeoffs for better drafts</small>
                </div>
                <div className={styles.priorityPreferenceGrid}>
                  <label className={styles.priorityField} title={currentEffortDescription}>
                    <span>Effort</span>
                    <select
                      className="form-select"
                      value={priorities.candidateCount}
                      onChange={e => updatePriorities({ candidateCount: Number(e.target.value) })}
                    >
                      <option value={12}>Fast</option>
                      <option value={24}>Balanced</option>
                      <option value={40}>Deep</option>
                    </select>
                    <small>{currentEffortDescription}</small>
                  </label>
                  <label className={styles.priorityCheck} title="Scores drafts higher when teams have rest between games.">
                    <input
                      type="checkbox"
                      checked={priorities.avoidBackToBack}
                      onChange={e => updatePriorities({ avoidBackToBack: e.target.checked })}
                    />
                    <span>Avoid back-to-back</span>
                  </label>
                  <label className={styles.priorityCheck} title="Scores drafts higher when teams stay at the same selected facility.">
                    <input
                      type="checkbox"
                      checked={priorities.reduceVenueChanges}
                      onChange={e => updatePriorities({ reduceVenueChanges: e.target.checked })}
                    />
                    <span>Reduce facility moves</span>
                  </label>
                  <label className={styles.priorityCheck} title="Scores drafts higher when early and late games are spread more evenly.">
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

            <div className="form-group">
              <label className="form-label">Available Facilities</label>
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

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <button className="btn btn-primary btn-lg" onClick={generate} style={{ width: '100%', marginTop: '1rem' }}>
              Generate Round Robin Draft
            </button>
          </div>
        ) : (
          <div className={styles.generatorPreview}>
            <div className={styles.previewStats}>
              <span>
                Generated <strong>{previewCount}</strong> games for <strong>{divisionName}</strong>
                {generationMode === 'slot' && <span className="badge badge-neutral" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>SLOT SCHEDULE</span>}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={reset}><RefreshCw size={14} /> Start Over</button>
            </div>

            {draftSummary && (
              <div className={styles.optimizationSummary}>
                <span><Sparkles size={13} /> Best of {draftSummary.candidateCount} drafts</span>
                <strong>{draftSummary.score}</strong>
                <small>Health {draftSummary.healthScore}/100</small>
              </div>
            )}

            {generationMode === 'slot' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--white-5)', borderRadius: '2px', margin: '0.75rem 0', fontSize: '0.8rem', color: 'var(--white-60)', lineHeight: 1.5 }}>
                <Info size={14} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--blueprint-blue)' }} />
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

            <div className={styles.previewTableWrap}>
              <table>
                <thead>
                  <tr><th>Date & Time</th><th>Matchup</th><th>Group</th><th>Facility</th></tr>
                </thead>
                <tbody>
                  {generationMode === 'slot' ? (
                    generatedSlotGames.map((g, i) => {
                      const pool = poolList.find(p => p.id === g.homePoolId);
                      return (
                        <tr key={i}>
                          <td style={{ fontSize: '0.8rem' }}>
                            {new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at <strong>{formatTime(g.time)}</strong>
                          </td>
                          <td>{g.homePlaceholder} vs {g.awayPlaceholder}</td>
                          <td><span className="badge badge-neutral">{pool?.name ?? 'Division'}</span></td>
                          <td>{g.location}</td>
                        </tr>
                      );
                    })
                  ) : (
                    generatedGames.map((g, i) => {
                      const homeTeam = teams.find(t => t.id === g.homeTeamId);
                      const awayTeam = teams.find(t => t.id === g.awayTeamId);
                      return (
                        <tr key={i}>
                          <td style={{ fontSize: '0.8rem' }}>
                            {new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at <strong>{formatTime(g.time)}</strong>
                          </td>
                          <td>{homeTeam?.name} vs {awayTeam?.name}</td>
                          <td>
                            {(() => {
                              const usePools = (currentGroup?.poolCount || 0) >= 2;
                              const poolRecord = usePools ? currentGroup?.pools?.find(p => p.id === homeTeam?.poolId) : null;
                              const name = poolRecord ? poolRecord.name : (usePools ? 'Unassigned' : 'None');
                              return <span className="badge badge-neutral">{name}</span>;
                            })()}
                          </td>
                          <td>{g.location}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <div className={styles.previewFooter}>
              <button className="btn btn-ghost" onClick={reset} disabled={committing}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={committing}>
                {committing ? <><RefreshCw className="spin" size={14} /> Saving…</> : <><Check size={14} /> Commit Schedule</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 450, padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--white-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--logic-lime)' }}>
                <AlertCircle size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Commit Schedule?</h3>
              <p style={{ color: 'var(--white-60)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {generationMode === 'slot'
                  ? <>This will save a slot-based schedule and <strong style={{ color: 'var(--danger)' }}>permanently clear</strong> any existing games for <strong>{divisionName}</strong>. {poolList.length > 0 ? 'Team names will appear publicly once all slots are assigned.' : 'Division-wide placeholders will be saved without pool assignments.'}</>
                  : <>This will save the generated schedule and <strong style={{ color: 'var(--danger)' }}>permanently clear</strong> any existing games for the <strong>{divisionName}</strong> division.</>
                }
              </p>
            </div>
            <div className="flex gap-1" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={commit}>
                <Check size={14} /> Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
