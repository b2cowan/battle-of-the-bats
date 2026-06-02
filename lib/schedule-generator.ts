import {
  buildScheduleMetrics,
  type ScheduleMetricGame,
  type ScheduleMetrics,
  type ScheduleMetricTeam,
} from './schedule-metrics.ts';

export interface ScheduleDraftParticipant {
  id: string;
  label: string;
  divisionId: string;
  status?: string | null;
}

export interface ScheduleDraftMetricSide {
  teamId?: string | null;
  slotId?: string | null;
  placeholder?: string | null;
}

export interface ScheduleDraftMatchup<TPayload = unknown> {
  homeParticipantId: string;
  awayParticipantId: string;
  homeLabel: string;
  awayLabel: string;
  homeMetric?: ScheduleDraftMetricSide;
  awayMetric?: ScheduleDraftMetricSide;
  poolId?: string | null;
  payload: TPayload;
}

export interface ScheduleDraftSlot {
  date: string;
  time: string;
  venueId?: string | null;
  venueName: string;
  venueFacilityId?: string | null;
  scheduleFacilityLaneId?: string | null;
  scheduleFacilityLaneLabel?: string | null;
}

export interface SchedulePrioritySettings {
  candidateCount: number;
  maxGamesPerDay: number;
  minRestMinutes: number;
  avoidBackToBack: boolean;
  reduceVenueChanges: boolean;
  balanceTimeSlots: boolean;
}

export interface ScheduleDraftAssignment<TPayload = unknown> extends ScheduleDraftMatchup<TPayload>, ScheduleDraftSlot {
  slotIndex: number;
}

export interface ScoredScheduleDraft<TPayload = unknown> {
  assignments: ScheduleDraftAssignment<TPayload>[];
  metrics: ScheduleMetrics;
  score: number;
  candidateCount: number;
}

export interface GenerateScoredScheduleOptions<TPayload = unknown> {
  tournamentId: string;
  divisionId: string;
  matchups: ScheduleDraftMatchup<TPayload>[];
  slots: ScheduleDraftSlot[];
  participants: ScheduleDraftParticipant[];
  expectedGamesPerParticipant?: number;
  gameDurationMinutes: number;
  bufferMinutes: number;
  priorities: SchedulePrioritySettings;
}

export function generateScoredSchedule<TPayload = unknown>(
  options: GenerateScoredScheduleOptions<TPayload>,
): ScoredScheduleDraft<TPayload> | null {
  if (options.matchups.length === 0 || options.slots.length < options.matchups.length) return null;

  const passes = Math.max(1, Math.min(80, Math.round(options.priorities.candidateCount || 1)));
  let best: ScoredScheduleDraft<TPayload> | null = null;

  for (let pass = 0; pass < passes; pass++) {
    const assignments = buildCandidateAssignments(options, pass);
    if (!assignments) continue;

    const metrics = buildScheduleMetrics({
      games: assignments.map(assignment => toMetricGame(assignment, options)),
      teams: options.participants.map(participantToMetricTeam),
      divisionId: options.divisionId,
      expectedGamesPerParticipant: options.expectedGamesPerParticipant,
      gameDurationMinutes: options.gameDurationMinutes,
      bufferMinutes: options.bufferMinutes,
      maxGamesPerDay: options.priorities.maxGamesPerDay,
    });
    const score = scoreDraft(metrics, options.priorities);
    const candidate: ScoredScheduleDraft<TPayload> = {
      assignments,
      metrics,
      score,
      candidateCount: passes,
    };

    if (!best || candidate.score > best.score || (
      candidate.score === best.score &&
      candidate.metrics.healthScore > best.metrics.healthScore
    )) {
      best = candidate;
    }
  }

  return best;
}

export function defaultSchedulePriorities(): SchedulePrioritySettings {
  return {
    candidateCount: 24,
    maxGamesPerDay: 2,
    minRestMinutes: 60,
    avoidBackToBack: true,
    reduceVenueChanges: true,
    balanceTimeSlots: true,
  };
}

function buildCandidateAssignments<TPayload>(
  options: GenerateScoredScheduleOptions<TPayload>,
  pass: number,
): ScheduleDraftAssignment<TPayload>[] | null {
  const orderedMatchups = orderMatchups(options.matchups, pass);
  const orderedSlots = orderSlots(options.slots, pass);
  const usedSlotKeys = new Set<string>();
  const assignments: ScheduleDraftAssignment<TPayload>[] = [];

  for (const matchup of orderedMatchups) {
    let bestSlot: { slot: ScheduleDraftSlot; slotIndex: number; penalty: number } | null = null;

    for (let slotIndex = 0; slotIndex < orderedSlots.length; slotIndex++) {
      const slot = orderedSlots[slotIndex];
      const key = slotKey(slot);
      if (usedSlotKeys.has(key)) continue;

      const penalty = scoreSlotFit(matchup, slot, assignments, options, pass, slotIndex);
      if (!Number.isFinite(penalty)) continue;
      if (!bestSlot || penalty < bestSlot.penalty) {
        bestSlot = { slot, slotIndex, penalty };
      }
    }

    if (!bestSlot) return null;
    usedSlotKeys.add(slotKey(bestSlot.slot));
    assignments.push({
      ...matchup,
      ...bestSlot.slot,
      slotIndex: bestSlot.slotIndex,
    });
  }

  return assignments.sort(compareAssignments);
}

function scoreSlotFit<TPayload>(
  matchup: ScheduleDraftMatchup<TPayload>,
  slot: ScheduleDraftSlot,
  assignments: ScheduleDraftAssignment<TPayload>[],
  options: GenerateScoredScheduleOptions<TPayload>,
  pass: number,
  slotIndex: number,
): number {
  const participants = [matchup.homeParticipantId, matchup.awayParticipantId];
  const start = absoluteMinutes(slot);
  const end = start + options.gameDurationMinutes;
  let penalty = slotIndex * 0.02 + jitter(`${pass}:${slotKey(slot)}:${matchup.homeParticipantId}:${matchup.awayParticipantId}`) * 0.15;

  for (const participantId of participants) {
    const current = assignments.filter(assignment =>
      assignment.homeParticipantId === participantId || assignment.awayParticipantId === participantId
    );
    const sameDayCount = current.filter(assignment => assignment.date === slot.date).length;
    if (sameDayCount >= options.priorities.maxGamesPerDay) {
      penalty += 420 + sameDayCount * 80;
    } else {
      penalty += sameDayCount * 18;
    }

    if (isEdgeSlot(slot.time) && options.priorities.balanceTimeSlots) {
      const edgeCount = current.filter(assignment => isEdgeSlot(assignment.time)).length;
      penalty += (edgeCount + 1) * 18;
    }

    for (const assignment of current) {
      const otherStart = absoluteMinutes(assignment);
      const otherEnd = otherStart + options.gameDurationMinutes;
      if (start < otherEnd && otherStart < end) return Number.POSITIVE_INFINITY;

      const rest = start >= otherEnd ? start - otherEnd : otherStart - end;
      if (rest < options.priorities.minRestMinutes) {
        penalty += 220 + (options.priorities.minRestMinutes - rest) * 2.5;
      }
      if (options.priorities.avoidBackToBack && rest <= options.bufferMinutes) {
        penalty += 160;
      }

      if (options.priorities.reduceVenueChanges && slotResourceKey(assignment) !== slotResourceKey(slot)) {
        penalty += assignment.date === slot.date ? 28 : 8;
      }
    }
  }

  return penalty;
}

function scoreDraft(metrics: ScheduleMetrics, priorities: SchedulePrioritySettings): number {
  let score = metrics.healthScore;
  if (metrics.venueConflictCount > 0) score -= metrics.venueConflictCount * 20;
  if (metrics.bufferConflictCount > 0) score -= metrics.bufferConflictCount * 8;
  if (priorities.avoidBackToBack) score -= metrics.backToBackCount * 4;
  if (priorities.reduceVenueChanges) score -= metrics.venueChangeCount * 1.2 + metrics.facilityChangeCount * 0.6;
  if (priorities.minRestMinutes > 0 && metrics.minRestMinutes != null && metrics.minRestMinutes < priorities.minRestMinutes) {
    score -= Math.ceil((priorities.minRestMinutes - metrics.minRestMinutes) / 10);
  }
  if (metrics.maxGamesInDay > priorities.maxGamesPerDay) {
    score -= (metrics.maxGamesInDay - priorities.maxGamesPerDay) * 8;
  }
  if (!priorities.balanceTimeSlots) score += Math.max(0, 15 - metrics.healthBreakdown.timeSlots) * 0.4;
  return Math.round(score * 10) / 10;
}

function toMetricGame<TPayload>(
  assignment: ScheduleDraftAssignment<TPayload>,
  options: GenerateScoredScheduleOptions<TPayload>,
): ScheduleMetricGame {
  return {
    tournamentId: options.tournamentId,
    divisionId: options.divisionId,
    homeTeamId: assignment.homeMetric?.teamId ?? null,
    awayTeamId: assignment.awayMetric?.teamId ?? null,
    homeSlotId: assignment.homeMetric?.slotId ?? null,
    awaySlotId: assignment.awayMetric?.slotId ?? null,
    homePlaceholder: assignment.homeMetric?.placeholder ?? assignment.homeLabel,
    awayPlaceholder: assignment.awayMetric?.placeholder ?? assignment.awayLabel,
    date: assignment.date,
    time: assignment.time,
    venueId: assignment.venueId ?? null,
    venueFacilityId: assignment.venueFacilityId ?? null,
    scheduleFacilityLaneId: assignment.scheduleFacilityLaneId ?? null,
    scheduleFacilityLaneLabel: assignment.scheduleFacilityLaneLabel ?? null,
    location: assignment.venueName,
    status: 'scheduled',
  };
}

function participantToMetricTeam(participant: ScheduleDraftParticipant): ScheduleMetricTeam {
  return {
    id: participant.id,
    name: participant.label,
    divisionId: participant.divisionId,
    status: participant.status ?? 'accepted',
  };
}

function orderMatchups<TPayload>(
  matchups: ScheduleDraftMatchup<TPayload>[],
  pass: number,
): ScheduleDraftMatchup<TPayload>[] {
  if (pass === 0) return [...matchups];
  if (pass === 1) return [...matchups].reverse();
  const shuffled = deterministicShuffle(matchups, pass * 7919 + 17);
  if (pass % 3 === 0) {
    return shuffled.sort((a, b) => (a.poolId ?? '').localeCompare(b.poolId ?? ''));
  }
  return shuffled;
}

function orderSlots(slots: ScheduleDraftSlot[], pass: number): ScheduleDraftSlot[] {
  const ordered = [...slots].sort(compareSlots);
  if (pass % 4 === 1) {
    return ordered.sort((a, b) => a.venueName.localeCompare(b.venueName) || compareSlots(a, b));
  }
  if (pass % 4 === 2) {
    return ordered.sort((a, b) => a.time.localeCompare(b.time) || a.date.localeCompare(b.date) || a.venueName.localeCompare(b.venueName));
  }
  if (pass % 4 === 3) {
    return deterministicShuffle(ordered, pass * 3571 + 31).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }
  return ordered;
}

function compareAssignments(a: ScheduleDraftAssignment, b: ScheduleDraftAssignment): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.venueName.localeCompare(b.venueName);
}

function compareSlots(a: ScheduleDraftSlot, b: ScheduleDraftSlot): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.venueName.localeCompare(b.venueName);
}

function slotKey(slot: ScheduleDraftSlot): string {
  return `${slot.date}|${slot.time}|${slot.venueId ?? ''}|${slot.venueFacilityId ?? ''}|${slot.scheduleFacilityLaneId ?? slot.scheduleFacilityLaneLabel ?? ''}`;
}

function slotResourceKey(slot: ScheduleDraftSlot): string {
  return slot.venueFacilityId ?? slot.venueId ?? slot.scheduleFacilityLaneId ?? slot.scheduleFacilityLaneLabel ?? slot.venueName;
}

function absoluteMinutes(slot: Pick<ScheduleDraftSlot, 'date' | 'time'>): number {
  return dateToIndex(slot.date) * 24 * 60 + timeToMinutes(slot.time);
}

function timeToMinutes(time: string): number {
  const [hourRaw, minuteRaw] = time.split(':');
  return Number(hourRaw) * 60 + Number(minuteRaw);
}

function dateToIndex(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function isEdgeSlot(time: string): boolean {
  const minutes = timeToMinutes(time);
  return minutes < 12 * 60 || minutes >= 17 * 60;
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const next = [...items];
  let state = seed || 1;
  for (let i = next.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function jitter(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
